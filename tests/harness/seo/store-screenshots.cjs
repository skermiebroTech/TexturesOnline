// Renders the app-store screenshots and artwork from the real app (dark theme):
//   docs/store/screenshots/*.png          1920x1080, Microsoft Store listing (minimum 1366x768)
//   public/screenshots/app/wide-*.webp    1280x720, web app manifest (desktop install dialog)
//   public/screenshots/app/narrow-*.webp  540x1170, web app manifest (phone install sheet)
//   docs/store/poster-art-720x1080.png    2:3 poster art for the Store listing
// Game files come from local fixtures, as for the guide screenshots:
//   TO_FIXTURES  folder with client-26.3.jar, manifest.json and v263.json (required)
// Usage:
//   TO_FIXTURES=/path/to/fixtures NODE_PATH=$(npm root -g) node tests/harness/seo/store-screenshots.cjs [baseUrl] [--only a,b]
//   Without a baseUrl a Vite dev server is started. Shot names: home, texture-editor,
//   texture-effects, skin-editor, shader-maker, narrow-home, narrow-textures, narrow-skins, poster.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const H = require('./guide-screenshots.cjs');

const ROOT = path.resolve(__dirname, '../../..');
const STORE_DIR = path.join(ROOT, 'docs/store/screenshots');
const APP_DIR = path.join(ROOT, 'public/screenshots/app');
const argv = process.argv.slice(2);
const baseArg = argv.find((a) => /^https?:/.test(a));
const only = argv.includes('--only') ? new Set(argv[argv.indexOf('--only') + 1].split(',')) : null;
const want = (name) => !only || only.has(name);
const exe = [process.env.CHROME, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find((p) => p && fs.existsSync(p));

/** 1440x810 CSS pixels at 4/3 = 1920x1080 (a desktop layout, Store size). */
const WIDE = { viewport: { width: 1440, height: 810 }, deviceScaleFactor: 4 / 3 };
/** 360x780 CSS pixels at 1.5 = 540x1170 (a phone). */
const NARROW = { viewport: { width: 360, height: 780 }, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true };

const written = [];
let converter = null;

/** Scales a PNG and encodes it as WebP in the browser (canvas, high-quality smoothing). */
async function toWebp(png, width, height, file, quality = 0.82) {
  const out = await converter.evaluate(
    async ({ b64, width, height, quality }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, 0, width, height);
      return c.toDataURL('image/webp', quality).split(',')[1];
    },
    { b64: png.toString('base64'), width, height, quality },
  );
  fs.writeFileSync(file, Buffer.from(out, 'base64'));
  written.push(`${path.relative(ROOT, file)} ${width}x${height} ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
}

/** Store PNG (1920x1080) and, optionally, the manifest's 1280x720 WebP. */
async function wideShot(page, name, manifestName) {
  await page.mouse.move(2, WIDE.viewport.height - 2).catch(() => {});
  await page.waitForTimeout(400);
  const png = await page.screenshot({ type: 'png' });
  const file = path.join(STORE_DIR, `${name}.png`);
  fs.writeFileSync(file, png);
  written.push(`${path.relative(ROOT, file)} 1920x1080 ${(png.length / 1024).toFixed(0)} KB`);
  if (manifestName) await toWebp(png, 1280, 720, path.join(APP_DIR, `wide-${manifestName}.webp`));
}

async function narrowShot(page, name) {
  await page.waitForTimeout(400);
  const png = await page.screenshot({ type: 'png' });
  await toWebp(png, 540, 1170, path.join(APP_DIR, `narrow-${name}.webp`));
}

async function context(browser, fx, jar, device) {
  const ctx = await browser.newContext({ ...device, colorScheme: 'dark', reducedMotion: 'reduce', acceptDownloads: true });
  await ctx.addInitScript(() => {
    localStorage.setItem('to-theme', 'dark');
    // No "install as an app" suggestion in the pictures
    localStorage.setItem('tpm-install-hint', '1');
  });
  await H.routeMojang(ctx, fx, jar);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  pageerror', e.message));
  await H.hideToastsOnLoad(page);
  return { ctx, page };
}

async function home(browser, base, fx, jar) {
  const { ctx, page } = await context(browser, fx, jar, WIDE);
  await page.goto(base);
  await page.waitForSelector('.home .hero-title');
  await H.waitIdle(page, 1200);
  await wideShot(page, '01-home', 'home');
  await ctx.close();
}

async function textures(browser, base, fx, jar) {
  const { ctx, page } = await context(browser, fx, jar, WIDE);
  await page.goto(`${base}textures/`);
  await page.waitForSelector('.tx-new');
  await page.fill('.tx-name-field input', 'Autumn Glow');
  await page.click('.tx-new .segmented-item[data-value="java"]');
  await page.waitForFunction(() => /26\.3/.test(document.querySelector('.tx-new .vp-trigger')?.textContent ?? ''));
  await page.click('.tx-res-chip:has-text("16×")');
  await page.click('.tx-create-btn');
  await page.waitForURL(/textures\/[0-9a-f-]+\/?$/, { timeout: 30000 });
  await H.txWaitEditor(page);
  // a block on its 3D model, repainted
  await page.click('.tx-browser:not(.tx-mb) .tx-libbar .segmented-item[data-value="blocks"]').catch(() => {});
  await page.waitForSelector('.tx-mb .tx-search-input', { state: 'visible' });
  await page.waitForFunction(() => window.__tx.models.lib, null, { timeout: 120000 });
  await page.fill('.tx-mb .tx-search-input', 'furnace');
  await page.waitForSelector('.tx-mb .tx-tile[data-id="furnace"].loaded', { timeout: 30000 });
  await page.click('.tx-mb .tx-tile[data-id="furnace"]');
  await page.waitForFunction(() => window.__tx.canvas.current()?.key.endsWith('block/furnace_front.png'), null, { timeout: 30000 });
  await H.txStrokes(page, [255, 140, 20, 255], [
    [[4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3], [11, 3]],
    [[3, 4], [3, 5], [3, 6]],
    [[12, 4], [12, 5], [12, 6]],
  ]);
  await H.txStrokes(page, [255, 215, 60, 255], [[[1, 1]], [[14, 1]], [[1, 14]], [[14, 14]]]);
  await page.waitForSelector('.tx-save[data-state="saved"]', { timeout: 30000 });
  await H.waitIdle(page, 1500);
  if (want('texture-editor')) await wideShot(page, '02-texture-editor', 'textures');

  if (want('texture-effects')) {
    const id = page.url().match(/textures\/([0-9a-f-]+)/)[1];
    await page.evaluate((pid) => localStorage.removeItem(`to-tex-last:${pid}`), id);
    await page.reload();
    await H.txWaitEditor(page);
    if (!(await page.isVisible('.tx-mb'))) await page.click('.tx-browser:not(.tx-mb) .tx-libbar .segmented-item[data-value="blocks"]');
    await page.waitForSelector('.tx-mb .tx-search-input', { state: 'visible' });
    await page.click('.tx-mb [aria-label="Show as a grid"]').catch(() => {});
    await page.click('.tx-col-tabs .tab[data-value="effects"]');
    await page.waitForSelector('.tx-preset[data-preset="autumn"]');
    await page.click('.tx-preset[data-preset="autumn"]');
    await page.waitForSelector('.tx-preset-wrap.is-active .tx-preset[data-preset="autumn"]');
    await page.fill('.tx-mb .tx-search-input', 'log');
    await page.waitForTimeout(800);
    await page.evaluate(() => document.activeElement?.blur());
    await page.waitForFunction(() => [...document.querySelectorAll('.tx-mb .tx-tile')].every((t) => t.classList.contains('loaded')), null, { timeout: 60000 }).catch(() => {});
    await page.evaluate(() => document.querySelector('.tx-preset-wrap.is-active')?.scrollIntoView({ block: 'end' }));
    await page.waitForSelector('.tx-save[data-state="saved"]', { timeout: 30000 });
    await H.waitIdle(page, 2500);
    await wideShot(page, '03-texture-effects');
  }
  await ctx.close();
}

async function skins(browser, base, fx, jar) {
  const { ctx, page } = await context(browser, fx, jar, WIDE);
  await H.skOpenStarter(page, base, 'explorer');
  await H.skRename(page, 'Explorer');
  await page.locator('.pc-root').focus();
  await page.keyboard.press('b');
  if ((await page.getAttribute('.sk-toggle-btn', 'aria-pressed')) !== 'true') await page.click('.sk-toggle-btn');
  await H.skColor(page, '#2f7fd8');
  await H.skStroke(page, [[20, 24], [21, 24], [22, 24], [23, 24], [24, 24], [25, 24], [26, 24], [27, 24]]);
  await H.skStroke(page, [[44, 20], [44, 21], [44, 22], [44, 23], [44, 24], [44, 25], [44, 26], [44, 27]]);
  await H.skColor(page, '#f2c14e');
  await H.skStroke(page, [[20, 26], [21, 27], [22, 28], [23, 29], [24, 29], [25, 28], [26, 27], [27, 26]]);
  await H.skApi(page, (e) => e.flush());
  await H.waitIdle(page, 1200);
  await wideShot(page, '04-skin-editor', 'skins');
  await ctx.close();
}

async function shaders(browser, base, fx, jar) {
  const { ctx, page } = await context(browser, fx, jar, WIDE);
  await page.goto(`${base}shaders/`);
  await page.waitForSelector('.sh-card[data-target="iris"] .sh-card-start');
  await page.click('.sh-card[data-target="iris"] .sh-card-start');
  await page.waitForSelector('.sh-new .sh-preset');
  await page.click('.sh-new .sh-preset[data-preset="cinematic"]');
  await page.fill('.sh-new .sh-name-field input, .sh-new input.input', 'Cinematic Glow');
  await page.getByRole('button', { name: 'Create pack' }).click();
  await page.waitForSelector('.sh-editor');
  await H.waitPreview(page);
  await page.click('.sh-time-btn[data-time="sunset"]').catch(() => {});
  await page.waitForTimeout(4000);
  await H.waitPreview(page);
  await H.waitIdle(page, 1000);
  await wideShot(page, '05-shader-maker', 'shaders');
  await ctx.close();
}

async function phone(browser, base, fx, jar) {
  const { ctx, page } = await context(browser, fx, jar, NARROW);
  if (want('narrow-home')) {
    await page.goto(base);
    await page.waitForSelector('.home .hero-title');
    await H.waitIdle(page, 1200);
    await narrowShot(page, 'home');
  }
  if (want('narrow-textures')) {
    await page.goto(`${base}textures/`);
    await page.waitForSelector('.tx-new');
    await page.fill('.tx-name-field input', 'Autumn Glow');
    await page.waitForFunction(() => /\d/.test(document.querySelector('.tx-new .vp-trigger')?.textContent ?? ''));
    await page.evaluate(() => document.activeElement?.blur());
    await page.evaluate(() => document.querySelector('.tx-new')?.scrollIntoView({ block: 'start' }));
    await page.evaluate(() => window.scrollBy(0, -72));
    await H.waitIdle(page, 1000);
    await narrowShot(page, 'textures');
  }
  if (want('narrow-skins')) {
    await H.skOpenStarter(page, base, 'explorer');
    await H.waitIdle(page, 1500);
    await narrowShot(page, 'skins');
  }
  await ctx.close();
}

/** 2:3 poster art: the logo, the name and what it makes, on the dark background. */
async function poster(browser, base) {
  const ctx = await browser.newContext({ viewport: { width: 720, height: 1080 }, deviceScaleFactor: 1, colorScheme: 'dark' });
  const page = await ctx.newPage();
  await page.goto(base);
  await page.waitForSelector('.brand .logo-mark, .brand svg');
  await page.evaluate(() => {
    const logo = document.querySelector('.brand svg').outerHTML;
    document.body.innerHTML = `
      <div style="position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:44px;background:radial-gradient(120% 80% at 50% 30%,#1b2a1f 0%,#0d0f14 60%);font-family:inherit;color:#eef1f7;text-align:center">
        <div style="width:360px;height:360px">${logo}</div>
        <div style="font-size:56px;line-height:64px" class="wordmark">TexturePack<span>Maker</span></div>
        <div style="font-size:26px;line-height:36px;color:#b8c0cf;max-width:560px">Texture packs, skins and shaders for Minecraft Java &amp; Bedrock</div>
      </div>`;
    const svg = document.querySelector('svg');
    svg.setAttribute('width', '360');
    svg.setAttribute('height', '360');
  });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const file = path.join(ROOT, 'docs/store/poster-art-720x1080.png');
  await page.screenshot({ path: file, type: 'png' });
  written.push(`${path.relative(ROOT, file)} 720x1080 ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
  await ctx.close();
}

(async () => {
  const { fx, jar } = H.fixtures();
  fs.mkdirSync(STORE_DIR, { recursive: true });
  fs.mkdirSync(APP_DIR, { recursive: true });
  const server = baseArg ? null : await H.startDevServer();
  const base = (baseArg || server.url).replace(/\/?$/, '/');
  const args = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  if (process.env.HTTPS_PROXY) args.push(`--proxy-server=${process.env.HTTPS_PROXY}`, '--proxy-bypass-list=127.0.0.1;localhost');
  const browser = await chromium.launch({ executablePath: exe, args });
  converter = await (await browser.newContext()).newPage();
  try {
    if (want('home')) await home(browser, base, fx, jar);
    if (want('texture-editor') || want('texture-effects')) await textures(browser, base, fx, jar);
    if (want('skin-editor')) await skins(browser, base, fx, jar);
    if (want('shader-maker')) await shaders(browser, base, fx, jar);
    if (['narrow-home', 'narrow-textures', 'narrow-skins'].some(want)) await phone(browser, base, fx, jar);
    if (want('poster')) await poster(browser, base);
  } finally {
    await browser.close();
    await server?.stop();
  }
  console.log(`\n${written.join('\n')}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
