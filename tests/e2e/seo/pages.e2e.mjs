// Public pages, crawlable URLs and routing on a built site served like GitHub Pages.
//   NODE_PATH=$(npm root -g) node tests/e2e/seo/pages.e2e.mjs [distDir]
// Without distDir the site is built into a temp folder first. Env:
//   SEO_BASE=/TexturesOnline/   mount path (default "/TexturesOnline/", a GitHub project site)
//   SEO_SCREENS=<dir>           also save screenshots of every page with JavaScript off and on
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { startPagesServer } from './pages-server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const BASE = process.env.SEO_BASE ?? '/TexturesOnline/';
const SHOTS = process.env.SEO_SCREENS;
let dist = process.argv[2];
let tmp = null;
if (!dist) {
  tmp = mkdtempSync(join(tmpdir(), 'seo-dist-'));
  dist = join(tmp, 'dist');
  execFileSync(process.execPath, [join(ROOT, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', dist, '--emptyOutDir', '--logLevel', 'warn'], { cwd: ROOT, stdio: 'inherit' });
}
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const PAGES = [
  { path: '', tool: 'home', ready: '.home .hero-title' },
  { path: 'textures/', tool: 'textures', ready: '[data-tool-intro="textures"].is-below' },
  { path: 'skins/', tool: 'skins', ready: '[data-tool-intro="skins"].is-below' },
  { path: 'shaders/', tool: 'shaders', ready: '[data-tool-intro="shaders"].is-below' },
  { path: 'help/', tool: 'help', ready: '.help .help-section' },
  { path: 'guides/', tool: 'help', ready: '.guides-index .guide-card' },
  { path: 'guides/make-a-texture-pack/', tool: 'help', ready: '.guide-page h1' },
  { path: 'guides/minecraft-pack-format-versions/', tool: 'help', ready: '.formats-table' },
  { path: 'guides/install-resource-packs/', tool: 'help', ready: '.guide-page .guide-tabs' },
];

let failed = 0;
const ok = (msg) => console.log(`  ok - ${msg}`);
const check = (cond, msg, detail = '') => {
  if (cond) ok(msg);
  else {
    failed++;
    console.log(`  not ok - ${msg} ${detail}`);
  }
};

const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find((p) => existsSync(p));
const server = await startPagesServer({ dist, base: BASE });
// A project path is served as on GitHub Pages: the 404 fallback finds the site root from a
// *.github.io host name, so that host is mapped to the local server.
const HOST = BASE === '/' ? '127.0.0.1' : 'skermiebrotech.github.io';
const base = server.url.replace('127.0.0.1', HOST);
const browser = await chromium.launch({
  executablePath: exe,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', `--host-resolver-rules=MAP ${HOST} 127.0.0.1`],
});

async function newPage(js = true) {
  const ctx = await browser.newContext({ javaScriptEnabled: js, viewport: { width: 1280, height: 900 }, colorScheme: 'dark', reducedMotion: 'reduce' });
  // Only the site itself (the start screens work without game files).
  await ctx.route((url) => url.hostname !== HOST, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|net::ERR_/.test(m.text())) errors.push(m.text());
  });
  return { ctx, page, errors };
}

try {
  console.log(`# site at ${base}`);

  // ---- JavaScript off: prerendered content
  {
    const { ctx, page } = await newPage(false);
    for (const p of PAGES) {
      const res = await page.goto(base + p.path, { waitUntil: 'load' });
      const h1 = (await page.locator('main h1').first().innerText()).trim();
      const text = (await page.locator('main').innerText()).length;
      const canonical = await page.getAttribute('link[rel="canonical"]', 'href');
      check(res.status() === 200 && h1 && text > 800 && canonical?.endsWith(`/${p.path}`), `no-JS ${p.path || '/'}: "${h1}" (${text} chars)`, `status ${res.status()} canonical ${canonical}`);
      const visible = await page.locator('main h1').first().isVisible();
      check(visible, `no-JS ${p.path || '/'} content is visible`);
      if (SHOTS) await page.screenshot({ path: join(SHOTS, `nojs-${p.path.replace(/\//g, '_') || 'home'}.png`), fullPage: false });
    }
    await ctx.close();
  }

  // ---- JavaScript on: each page boots into the right view
  {
    const { ctx, page, errors } = await newPage(true);
    for (const p of PAGES) {
      await page.goto(base + p.path, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector(p.ready, { timeout: 20000 });
      const tool = await page.evaluate(() => document.documentElement.dataset.tool);
      const robots = await page.getAttribute('meta[name="robots"]', 'content');
      check(tool === p.tool && robots?.startsWith('index'), `JS ${p.path || '/'} boots the ${p.tool} view`, `tool=${tool} robots=${robots}`);
      if (SHOTS) {
        await page.waitForTimeout(600);
        await page.screenshot({ path: join(SHOTS, `js-${p.path.replace(/\//g, '_') || 'home'}.png`), fullPage: false });
      }
    }
    check(errors.length === 0, 'no console errors while booting public pages', errors.join('\n'));
    await ctx.close();
  }

  // ---- In-app navigation: clean URLs, no reloads, back/forward
  {
    const { ctx, page, errors } = await newPage(true);
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.home .tool-card');
    await page.evaluate(() => (window.__stay = 1));
    await page.click('.mainnav a[data-tool="skins"]');
    await page.waitForSelector('[data-tool-intro="skins"].is-below');
    check(page.url() === `${base}skins/` && (await page.evaluate(() => window.__stay)) === 1, 'nav link -> /skins/ without a reload', page.url());
    check((await page.getAttribute('link[rel="canonical"]', 'href'))?.endsWith('/skins/'), 'canonical follows in-app navigation');
    await page.click('.site-footer a[href$="guides/make-a-skin/"]');
    await page.waitForSelector('.guide-page h1');
    check(page.url() === `${base}guides/make-a-skin/` && (await page.evaluate(() => window.__stay)) === 1, 'footer guide link without a reload', page.url());
    check((await page.title()).includes('Skin'), 'title updated', await page.title());
    await page.goBack();
    await page.waitForSelector('[data-tool-intro="skins"].is-below');
    check(page.url() === `${base}skins/`, 'back returns to /skins/', page.url());
    await page.goBack();
    await page.waitForSelector('.home .hero-title');
    check(page.url() === base, 'back again returns home', page.url());
    await page.goForward();
    await page.waitForSelector('[data-tool-intro="skins"].is-below');
    check(page.url() === `${base}skins/` && (await page.evaluate(() => window.__stay)) === 1, 'forward works without reloads', page.url());
    // help deep link to a section keeps the query
    await page.click('.mainnav a[data-tool="help"]');
    await page.waitForSelector('.help .help-section');
    await page.click('.help-quick-card[data-section="iris"]');
    await page.waitForTimeout(400);
    check(page.url() === `${base}help/?s=iris`, 'help section links update the query', page.url());
    check(errors.length === 0, 'no console errors while navigating', errors.join('\n'));
    await ctx.close();
  }

  // ---- Private deep links (404.html fallback) and old hash links
  {
    const { ctx, page, errors } = await newPage(true);
    const res = await page.goto(`${base}shaders/not-a-real-project`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.view-shaders .empty-state', { timeout: 20000 });
    const robots = await page.getAttribute('meta[name="robots"]', 'content');
    check(res.status() === 404 && robots?.startsWith('noindex'), 'project deep link boots the app from 404.html and is noindex', `status ${res.status()} robots ${robots}`);
    check(page.url() === `${base}shaders/not-a-real-project`, 'deep link URL is kept', page.url());
    check(!(await page.$('link[rel="canonical"]')), 'no canonical on private pages');

    await page.goto(`${base}#/textures`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-tool-intro="textures"].is-below');
    check(page.url() === `${base}textures/`, 'old #/textures link redirects to /textures/', page.url());
    await page.goto(`${base}#/help?s=faq`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.help .help-section');
    check(page.url() === `${base}help/?s=faq`, 'old #/help?s=faq link keeps the section', page.url());
    await page.goto(`${base}textures/#/skins`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-tool-intro="skins"].is-below');
    check(page.url() === `${base}skins/`, 'a hash route on another page wins', page.url());
    // an old-style link inside the app is handled without a reload
    await page.evaluate(() => {
      window.__stay = 1;
      const a = Object.assign(document.createElement('a'), { href: '#/help', textContent: 'old link', id: 'old-link' });
      document.querySelector('main')?.prepend(a);
    });
    await page.click('#old-link');
    await page.waitForSelector('.help .help-section');
    check(page.url() === `${base}help/` && (await page.evaluate(() => window.__stay)) === 1, 'in-app #/ links navigate without a reload', page.url());
    await page.goto(`${base}kit/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    check((await page.getAttribute('meta[name="robots"]', 'content'))?.startsWith('noindex'), 'UI kit is reachable and noindex');
    check(errors.length === 0, 'no console errors on deep and legacy links', errors.join('\n'));
    await ctx.close();
  }

  // ---- Files next to the pages
  {
    const { ctx, page } = await newPage(true);
    for (const f of ['sitemap.xml', 'robots.txt', 'llms.txt', 'llms-full.txt', 'site.webmanifest', 'icons/icon-512.png', 'apple-touch-icon.png', 'og-image.png', 'screenshots/textures.jpg']) {
      const r = await page.request.get(server.url + f);
      check(r.status() === 200, `${f} is served`);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  await server.close();
  if (tmp) rmSync(tmp, { recursive: true, force: true });
}
console.log(failed ? `FAILED (${failed})` : 'ALL PASS');
process.exit(failed ? 1 : 0);
