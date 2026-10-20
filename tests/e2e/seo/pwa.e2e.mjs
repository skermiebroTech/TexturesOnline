// Installable app on a built site served like GitHub Pages: manifest and installability (Chrome's
// own checks over CDP), the service worker (offline start of every route, translated pages and
// private project links, at the domain root and under a project path), the update notice, files
// shared to the app, and the "Install app" entries.
//   NODE_PATH=$(npm root -g) node tests/e2e/seo/pwa.e2e.mjs [distDir]
// Without distDir the site is built into a temp folder first.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { startPagesServer } from './pages-server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
let dist = process.argv[2];
const tmp = mkdtempSync(join(tmpdir(), 'pwa-e2e-'));
if (!dist) {
  dist = join(tmp, 'dist');
  execFileSync(process.execPath, [join(ROOT, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', dist, '--emptyOutDir', '--logLevel', 'error'], { cwd: ROOT, stdio: 'inherit' });
}

let failed = 0;
const check = (cond, msg, detail = '') => {
  if (cond) console.log(`  ok - ${msg}`);
  else {
    failed++;
    console.log(`  not ok - ${msg} ${detail}`);
  }
};

/** A free TCP port (the same origin must come back after a "deploy"). */
const freePort = () =>
  new Promise((res) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => res(port));
    });
  });

/** A copy of the build whose worker serves another version (`entry` changes the app's entry script name). */
function deploy(name, { entry } = {}) {
  const dir = join(tmp, name);
  cpSync(dist, dir, { recursive: true });
  const file = join(dir, 'sw.js');
  let sw = readFileSync(file, 'utf8');
  sw = sw.replace(/"version":"([^"]+)"/, (_m, v) => `"version":"${v}-${name}"`);
  if (entry) sw = sw.replace(/"entry":"[^"]+"/, `"entry":"${entry}"`);
  writeFileSync(file, sw);
  return dir;
}

const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });

async function newContext(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark', reducedMotion: 'reduce', ...opts });
  // Only the site itself (start screens need no game files).
  await ctx.route((url) => url.hostname !== '127.0.0.1', (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|net::ERR_/.test(m.text())) errors.push(m.text());
  });
  return { ctx, page, errors };
}

/** Waits until a service worker controls the page and has finished installing (precache done). */
async function waitForWorker(page) {
  return page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
    const active = reg.active;
    if (active && active.state !== 'activated') await new Promise((r) => active.addEventListener('statechange', () => active.state === 'activated' && r(), { once: false }));
    const names = await caches.keys();
    return { scope: reg.scope, names, active: reg.active?.state };
  });
}

/** The version the controlling worker serves. */
const workerVersion = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        const c = new MessageChannel();
        c.port1.onmessage = (e) => resolve(e.data);
        navigator.serviceWorker.controller.postMessage({ type: 'GET_INFO' }, [c.port2]);
        setTimeout(() => resolve(null), 3000);
      }),
  );

const READY = {
  home: '.home .hero-title',
  textures: '[data-tool-intro="textures"]',
  help: '.help .help-section',
  guide: '.guide-page h1',
  privacy: '.privacy-page h1',
};

async function offlineRoutes(label, page, base) {
  const cases = [
    { path: '', ready: READY.home, lang: 'en', note: 'home (precached)' },
    { path: 'textures/', ready: READY.textures, lang: 'en', note: 'texture tool (visited)' },
    { path: 'de/', ready: READY.home, lang: 'de', note: 'German home (never visited: app shell)' },
    { path: 'de/help/', ready: READY.help, lang: 'de', note: 'German help (never visited)' },
    { path: 'ja/guides/make-a-skin/', ready: READY.guide, lang: 'ja', note: 'Japanese guide (never visited)' },
    { path: 'skins/', ready: '[data-tool-intro="skins"]', lang: 'en', note: 'skin tool (never visited)' },
    { path: 'privacy/', ready: READY.privacy, lang: 'en', note: 'privacy page (never visited)' },
    { path: 'help', ready: READY.help, lang: 'en', note: 'folder path without its slash' },
  ];
  for (const c of cases) {
    let ok = false;
    let detail = '';
    try {
      await page.goto(base + c.path, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForSelector(c.ready, { timeout: 20000 });
      const lang = await page.evaluate(() => document.documentElement.lang);
      ok = lang === c.lang;
      detail = `lang ${lang} url ${page.url()}`;
    } catch (err) {
      detail = String(err).split('\n')[0];
    }
    check(ok, `${label} offline: /${c.path} opens (${c.note})`, detail);
  }
  // A private project link (the 404.html fallback online) boots the app offline too.
  await page.goto(`${base}shaders/not-a-real-project`, { waitUntil: 'domcontentloaded' });
  const booted = await page.waitForSelector('.view-shaders .empty-state', { timeout: 20000 }).then(() => true, () => false);
  check(booted, `${label} offline: a project link boots the app`);
}

try {
  // ------------------------------------------------------------ domain root
  const port = await freePort();
  let server = await startPagesServer({ dist, port, base: '/' });
  const base = server.url;
  console.log(`# site at ${base}`);
  {
    const { ctx, page, errors } = await newContext();
    // Manifest file and headers
    const res = await page.request.get(`${base}site.webmanifest`);
    check(res.status() === 200 && /application\/manifest\+json/.test(res.headers()['content-type'] ?? ''), 'manifest is served as application/manifest+json', res.headers()['content-type']);
    const manifest = await res.json();
    check(manifest.file_handlers?.length === 2 && JSON.stringify(manifest.file_handlers).includes('.mcpack'), 'manifest has file handlers for packs and skins');

    await page.goto(base, { waitUntil: 'load' });
    await page.waitForSelector(READY.home);
    const cdp = await ctx.newCDPSession(page);
    const app = await cdp.send('Page.getAppManifest');
    check(app.errors.length === 0 && app.url.endsWith('/site.webmanifest'), "Chrome parses the manifest without errors", JSON.stringify(app.errors));
    const sw = await waitForWorker(page);
    check(sw.scope === base && sw.active === 'activated', 'service worker registers for the whole site', JSON.stringify(sw));
    check(sw.names.some((n) => n.startsWith('tpm-precache-')), 'app files are precached', sw.names.join(' '));
    const precached = await page.evaluate(async () => {
      const name = (await caches.keys()).find((n) => n.startsWith('tpm-precache-'));
      const keys = (await (await caches.open(name)).keys()).map((r) => new URL(r.url).pathname);
      return { count: keys.length, has404: keys.includes('/404.html'), hasIndex: keys.includes('/index.html'), hasEntry: keys.some((k) => /^\/assets\/index-.+\.js$/.test(k)) };
    });
    check(precached.count > 50 && precached.has404 && precached.hasIndex && precached.hasEntry, 'precache holds the app shell, home page and app code', JSON.stringify(precached));
    // Visit one tool page online, so it is in the page cache
    await page.goto(`${base}textures/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(READY.textures);
    await page.waitForTimeout(500);

    // ---- offline: server gone and the network cut
    await server.close();
    await ctx.setOffline(true);
    await offlineRoutes('root', page, base);
    check(errors.filter((e) => !/Failed to fetch|NetworkError|net::/.test(e)).length === 0, 'no console errors offline', errors.join('\n'));
    await ctx.setOffline(false);

    // ---- an update with new app code: a quiet notice, reload on request
    server = await startPagesServer({ dist: deploy('beta', { entry: 'assets/index-NEWBUILD.js' }), port, base: '/' });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(READY.home);
    const before = await workerVersion(page);
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    const toast = await page.waitForSelector('.toast:has-text("new version")', { timeout: 30000 }).then(() => true, () => false);
    check(toast, 'a downloaded update shows the "new version" notice');
    const stays = await page.evaluate(() => new Promise((r) => setTimeout(() => r(!!document.querySelector('.toast')), 7000)));
    check(stays, 'the notice stays until the visitor acts on it');
    await Promise.all([page.waitForEvent('load', { timeout: 20000 }), page.click('.toast button:has-text("Reload")')]);
    await page.waitForSelector(READY.home);
    const after = await workerVersion(page);
    check(before && after && before.version !== after.version && after.entry === 'assets/index-NEWBUILD.js', 'Reload switches to the new version', `${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
    const caches1 = await page.evaluate(() => caches.keys());
    check(caches1.filter((n) => n.startsWith('tpm-precache-')).length === 2, 'the previous build stays cached for tabs still running it', caches1.join(' '));
    await server.close();

    // ---- an update while the page already runs the new code: no notice
    // (the page runs the real entry script; only the "beta" worker claimed another one)
    server = await startPagesServer({ dist: deploy('cafe'), port, base: '/' });
    await page.evaluate(() => (window.__stay = 1));
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    // (waitForFunction can't wait on an async check: it would take the returned promise as true)
    for (const until = Date.now() + 30000; Date.now() < until; await page.waitForTimeout(250)) {
      const settled = await page.evaluate(async () => {
        const reg = await navigator.serviceWorker.getRegistration();
        return !reg.installing && !reg.waiting;
      });
      if (settled) break;
    }
    await page.waitForTimeout(1500);
    const quiet = await page.evaluate(() => ({ toast: [...document.querySelectorAll('.toast')].some((t) => /new version/i.test(t.textContent)), stay: window.__stay }));
    const third = await workerVersion(page);
    check(!quiet.toast && quiet.stay === 1 && third.version !== after.version, 'a worker for the build the page runs takes over silently', JSON.stringify({ quiet, third }));
    // The worker deletes old caches once it activates, which waits for the old worker's background
    // refreshes (at most BACKGROUND_MS, 10 s, on a stalled connection) and can take a while on a busy machine.
    let caches2 = [];
    for (const until = Date.now() + 30000; Date.now() < until; await page.waitForTimeout(250)) {
      caches2 = await page.evaluate(() => caches.keys());
      if (caches2.filter((n) => n.startsWith('tpm-precache-')).length <= 2) break;
    }
    check(caches2.filter((n) => n.startsWith('tpm-precache-')).length === 2, 'old precaches are cleaned up (two kept)', caches2.join(' '));

    // ---- files shared to the app (Web Share Target) go to the right tool
    const skin = await page.evaluate(async () => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      g.fillStyle = '#3a7';
      g.fillRect(0, 0, 64, 64);
      const b = await new Promise((r) => c.toBlob(r, 'image/png'));
      return Array.from(new Uint8Array(await b.arrayBuffer()));
    });
    const share = async (name, bytes, type) => {
      await page.evaluate(
        ({ url, name, bytes, type }) => {
          const form = Object.assign(document.createElement('form'), { method: 'post', enctype: 'multipart/form-data', action: url });
          const input = Object.assign(document.createElement('input'), { type: 'file', name: 'files' });
          const dt = new DataTransfer();
          dt.items.add(new File([new Uint8Array(bytes)], name, { type }));
          input.files = dt.files;
          form.append(input);
          document.body.append(form);
          form.submit();
        },
        { url: `${base}share-target/`, name, bytes, type },
      );
    };
    await share('Green Steve.png', skin, 'image/png');
    const opened = await page.waitForURL(/\/skins\/[^/]+$/, { timeout: 30000 }).then(() => true, () => false);
    check(opened, 'a skin shared to the app opens in the skin editor', page.url());
    await share('notes.txt', [104, 105], 'text/plain');
    const refused = await page.waitForSelector('.toast.tone-error:has-text("can’t open")', { timeout: 20000 }).then(() => true, () => false);
    check(refused && !page.url().includes('share-target'), 'a file the app can’t use is refused with a message', page.url());
    await server.close();
    await ctx.close();
  }

  // ------------------------------------------------------------ Chrome's install criteria
  // (a normal profile: Playwright's usual contexts count as incognito, where installing is off)
  server = await startPagesServer({ dist, port, base: '/' });
  {
    const profile = await chromium.launchPersistentContext(join(tmp, 'profile'), {
      executablePath: exe,
      args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
      viewport: { width: 1280, height: 900 },
    });
    const page = profile.pages()[0] ?? (await profile.newPage());
    await page.goto(base, { waitUntil: 'load' });
    await page.waitForSelector(READY.home);
    await waitForWorker(page);
    const cdp = await profile.newCDPSession(page);
    const installability = await cdp.send('Page.getInstallabilityErrors');
    check(installability.installabilityErrors.length === 0, 'Chrome: the site is installable', JSON.stringify(installability.installabilityErrors));
    const app = await cdp.send('Page.getAppManifest');
    const parsed = app.manifest;
    if (parsed) {
      // Chrome on Linux leaves file handlers out of its parsed copy (they are platform features);
      // where it has them, both must be there.
      if (parsed.fileHandlers) check(parsed.fileHandlers.length === 2, 'Chrome reads the file handlers', JSON.stringify(parsed.fileHandlers));
      check((parsed.shortcuts ?? []).length === 4, 'Chrome reads the four shortcuts');
      const mode = (v) => String(v).replace(/^k/, '').replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
      check(mode(parsed.display) === 'standalone' && (parsed.displayOverrides ?? []).map(mode)[0] === 'window-controls-overlay', 'Chrome reads the display modes', JSON.stringify({ d: parsed.display, o: parsed.displayOverrides }));
      check(mode(parsed.launchHandler?.clientMode) === 'focus-existing', 'Chrome reads the launch handler', JSON.stringify(parsed.launchHandler));
      check(new URL(parsed.shareTarget?.action ?? 'x:').pathname === '/share-target/', 'Chrome reads the share target', JSON.stringify(parsed.shareTarget));
    } else console.log('  # this Chrome does not return the parsed manifest over CDP');
    await profile.close();
  }
  await server.close();

  // ------------------------------------------------------------ install entries
  server = await startPagesServer({ dist, port, base: '/' });
  {
    const { ctx, page, errors } = await newContext();
    await page.goto(`${base}help/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(READY.help);
    const hiddenAtFirst = await page.evaluate(() => document.querySelector('.site-footer .footer-install')?.hidden);
    check(hiddenAtFirst === true, 'no "Install app" link until the browser offers installing');
    // The browser's install event (Chrome fires it when the site is installable)
    await page.evaluate(() => {
      window.__prompted = 0;
      const e = new Event('beforeinstallprompt', { cancelable: true });
      e.prompt = async () => void (window.__prompted += 1);
      e.userChoice = Promise.resolve({ outcome: 'dismissed' });
      window.dispatchEvent(e);
    });
    const visible = await page.isVisible('.site-footer .footer-install');
    check(visible, 'footer "Install app" appears once installing is possible');
    await page.setViewportSize({ width: 390, height: 800 });
    await page.click('.menu-btn');
    const inMenu = await page.waitForSelector('.nav-drawer .drawer-install:not([hidden])', { timeout: 5000 }).then(() => true, () => false);
    check(inMenu, 'the phone menu has "Install app" too');
    await page.click('.nav-drawer .drawer-install');
    await page.waitForTimeout(400);
    check((await page.evaluate(() => window.__prompted)) === 1, 'it opens the browser’s install prompt');
    check((await page.evaluate(() => document.querySelector('.site-footer .footer-install')?.hidden)) === true, 'the entry hides once the prompt has been used');
    // Dismissed the prompt: no suggestion after exporting
    const hintAfterDismiss = await page.evaluate(async () => {
      const a = Object.assign(document.createElement('a'), { href: 'data:,x', download: 'My Pack.zip' });
      document.body.append(a);
      a.addEventListener('click', (e) => e.preventDefault());
      a.click();
      await new Promise((r) => setTimeout(r, 2200));
      return [...document.querySelectorAll('.toast')].some((t) => /install/i.test(t.textContent));
    });
    check(!hintAfterDismiss, 'no export suggestion after the visitor said no to installing');
    check(errors.length === 0, 'no console errors around the install entries', errors.join('\n'));
    await ctx.close();
  }
  {
    // A fresh visitor exports a pack: one suggestion, once
    const { ctx, page } = await newContext();
    await page.goto(`${base}textures/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(READY.textures);
    await page.evaluate(() => {
      const e = new Event('beforeinstallprompt', { cancelable: true });
      e.prompt = async () => undefined;
      e.userChoice = Promise.resolve({ outcome: 'accepted' });
      window.dispatchEvent(e);
    });
    const exportOnce = () =>
      page.evaluate(async () => {
        const a = Object.assign(document.createElement('a'), { href: 'data:,x', download: 'My Pack.mcpack' });
        a.addEventListener('click', (e) => e.preventDefault());
        document.body.append(a);
        a.click();
        await new Promise((r) => setTimeout(r, 2200));
        const t = [...document.querySelectorAll('.toast')].filter((x) => /install/i.test(x.textContent));
        t.forEach((x) => x.querySelector('[aria-label="Dismiss notification"]')?.click());
        return t.length;
      });
    check((await exportOnce()) === 1, 'after the first export: one "install as an app" suggestion');
    await page.waitForTimeout(400);
    check((await exportOnce()) === 0, 'never again after that');
    await ctx.close();
  }
  {
    // iPhone: no install prompt in Safari, so the steps are shown
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
    const { ctx, page } = await newContext({ userAgent: ua, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await page.goto(`${base}help/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(READY.help);
    await page.click('.site-footer .footer-install');
    const steps = await page.waitForSelector('dialog[open] .pwa-install-steps', { timeout: 5000 }).then((el) => el.innerText(), () => '');
    check(/Add to Home Screen/.test(steps), 'iPhone: "Install app" explains Share › Add to Home Screen', steps);
    await ctx.close();
  }
  await server.close();

  // ------------------------------------------------------------ project path
  {
    const pport = await freePort();
    let pserver = await startPagesServer({ dist, port: pport, base: '/TexturesOnline/' });
    const pbase = pserver.url;
    console.log(`# site at ${pbase}`);
    const { ctx, page, errors } = await newContext();
    await page.goto(pbase, { waitUntil: 'load' });
    await page.waitForSelector(READY.home);
    const sw = await waitForWorker(page);
    check(sw.scope === pbase, 'project path: the worker’s scope is the project folder', sw.scope);
    await page.goto(`${pbase}textures/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(READY.textures);
    await pserver.close();
    await ctx.setOffline(true);
    await offlineRoutes('project path', page, pbase);
    check(errors.filter((e) => !/Failed to fetch|NetworkError|net::/.test(e)).length === 0, 'no console errors under a project path', errors.join('\n'));
    await ctx.close();
  }
} finally {
  await browser.close();
  rmSync(tmp, { recursive: true, force: true });
}
console.log(failed ? `FAILED (${failed})` : 'ALL PASS');
process.exit(failed ? 1 : 0);
