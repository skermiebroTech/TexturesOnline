// Functional checks of the texture pack maker UI beyond the main E2E flow: keyboard browsing,
// shortcuts sheet, reset + undo, uploads into animation strips, pack icon painting, undo/redo,
// compare, list view, context menu, version switching and deleting a pack.
// Usage: NODE_PATH=$(npm root -g) node tests/e2e/textures/smoke.cjs [baseUrl] [--no-version-switch]
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startVite, launch, routeMojang, fixturesDir, ROOT } = require('./lib.cjs');

const argv = process.argv.slice(2);
const baseArg = argv.find((a) => /^https?:/.test(a));
let failures = 0;
let total = 0;
function check(name, ok, detail = '') {
  total++;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

async function samplePng(w, h) {
  const { encode } = await import(path.join(ROOT, 'node_modules/fast-png/lib/index.js'));
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([200, (i * 7) % 255, 40, 255], i * 4);
  const file = path.join(os.tmpdir(), `tx-smoke-${w}x${h}.png`);
  fs.writeFileSync(file, encode({ width: w, height: h, data, channels: 4, depth: 8 }));
  return file;
}

(async () => {
  const server = baseArg ? null : await startVite();
  const base = baseArg || server.url;
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // These flows use the texture grid: start the browser in All textures mode.
  await ctx.addInitScript(() => { try { localStorage.setItem('to-tex-library-mode', 'textures'); } catch { /* storage blocked */ } });
  await routeMojang(ctx, fixturesDir());
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const cur = () => page.evaluate(() => window.__tx.canvas.current()?.key ?? null);
  try {
    await page.goto(base + '#/textures');
    await page.fill('.tx-name-field input', 'Smoke');
    await page.click('.tx-create-btn');
    await page.waitForFunction(() => !!window.__tx);
    await page.waitForSelector('.tx-tile.loaded', { timeout: 120000 });

    // keyboard browsing
    await page.focus('.tx-grid');
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => !!window.__tx.canvas.current());
    const k1 = await cur();
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction((k) => window.__tx.canvas.current()?.key !== k, k1);
    const k2 = await cur();
    check('arrow keys in the texture grid open the next texture', !!k1 && !!k2 && k1 !== k2, `${k1} -> ${k2}`);
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction((k) => window.__tx.canvas.current()?.key !== k, k2);
    check('arrow down moves a row', (await cur()) !== k2);

    // '/' focuses search, '?' opens the shortcuts sheet
    await page.click('.tx-bar', { position: { x: 600, y: 30 } });
    await page.keyboard.press('/');
    await page.waitForTimeout(100);
    check('"/" focuses the search box', await page.evaluate(() => document.activeElement?.classList.contains('tx-search-input')));
    await page.click('.tx-bar', { position: { x: 600, y: 30 } });
    await page.keyboard.press('Shift+/');
    await page.waitForSelector('.shortcuts', { timeout: 5000 }).catch(() => null);
    check('"?" opens the keyboard shortcuts sheet', await page.isVisible('.shortcuts'));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // paint, undo/redo via the top bar
    await page.fill('.tx-search-input', 'cobblestone');
    await page.click('.tx-tile[data-path$="block/cobblestone.png"]');
    await page.waitForFunction(() => window.__tx.canvas.current()?.key.endsWith('block/cobblestone.png'));
    const before = await page.evaluate(() => window.__tx.pixel(1, 1));
    await page.evaluate(() => window.__tx.canvas.canvas().setColor([0, 255, 0, 255]));
    const pt = await page.evaluate(() => {
      const pc = window.__tx.canvas.canvas();
      const r = pc.element.querySelector('canvas').getBoundingClientRect();
      const [x, y] = pc.getView().toScreen(1.5, 1.5);
      return [r.left + x, r.top + y];
    });
    await page.mouse.click(pt[0], pt[1]);
    check('undo button enabled after painting', await page.isEnabled('.tx-bar [aria-label^="Undo"]'));
    await page.click('.tx-bar [aria-label^="Undo"]');
    const undone = await page.evaluate(() => window.__tx.pixel(1, 1));
    check('toolbar undo restores the pixel', JSON.stringify(undone) === JSON.stringify(before), JSON.stringify(undone));
    await page.click('.tx-bar [aria-label^="Redo"]');
    const redone = await page.evaluate(() => window.__tx.pixel(1, 1));
    check('toolbar redo repaints it', JSON.stringify(redone) === '[0,255,0,255]', JSON.stringify(redone));

    // compare (hold C)
    await page.click('.tx-bar', { position: { x: 600, y: 30 } });
    await page.keyboard.down('c');
    await page.waitForTimeout(150);
    check('holding C shows the original', await page.isVisible('.tx-compare-tag'));
    await page.keyboard.up('c');
    await page.waitForTimeout(100);
    check('releasing C hides it', !(await page.isVisible('.tx-compare-tag')));

    // reset to vanilla + undo from the toast
    await page.click('.tx-act-reset');
    await page.waitForFunction(() => !window.__tx.store.isEdited('assets/minecraft/textures/block/cobblestone.png'));
    const reset = await page.evaluate(() => window.__tx.pixel(1, 1));
    check('reset brings back vanilla pixels', JSON.stringify(reset) === JSON.stringify(before), JSON.stringify(reset));
    await page.click('.toast .btn:has-text("Undo")');
    await page.waitForFunction(() => window.__tx.store.isEdited('assets/minecraft/textures/block/cobblestone.png'));
    await page.waitForFunction(() => JSON.stringify(window.__tx.pixel(1, 1)) === '[0,255,0,255]');
    check('undo in the toast restores the edit', true);

    // context menu on a tile
    const tile = await page.$('.tx-tile[data-path$="block/cobblestone.png"]');
    const tb = await tile.boundingBox();
    await page.mouse.click(tb.x + 10, tb.y + 10, { button: 'right' });
    await page.waitForSelector('.menu');
    const items = await page.$$eval('.menu .menu-item', (els) => els.map((e) => e.textContent.trim()));
    check('context menu offers reset, download and upload', items.includes('Reset to vanilla') && items.includes('Download PNG') && items.some((t) => t.startsWith('Replace')), items.join(' | '));
    await page.keyboard.press('Escape');

    // list view
    await page.click('.tx-seg [aria-label^="Show as a list"]');
    await page.waitForTimeout(200);
    check('list view shows names', await page.isVisible('.tx-grid.is-list .tx-tile-name'));
    await page.click('.tx-seg [aria-label^="Show as a grid"]');

    // upload into an animation strip (all frames)
    await page.fill('.tx-search-input', 'prismarine');
    await page.click('.tx-tile[data-path$="block/prismarine.png"]');
    await page.waitForFunction(() => window.__tx.canvas.current()?.anim?.count > 1);
    const strip = await page.evaluate(() => {
      const t = window.__tx.canvas.current();
      return { w: t.full.width, h: t.full.height, frames: t.anim.count };
    });
    const png = await samplePng(strip.w, strip.w);
    await page.click('.tx-act-upload');
    await page.setInputFiles('.tx-upload .dropzone input[type=file]', png);
    await page.waitForSelector('.tx-up-editor:not([hidden])');
    await page.click('dialog[open] .segmented-item[data-value="all-frames"]');
    await page.click('dialog[open] .btn-primary');
    await page.waitForFunction(() => window.__tx.store.isEdited('assets/minecraft/textures/block/prismarine.png'));
    const frames = await page.evaluate(() => {
      const t = window.__tx.canvas.current();
      const px = (x, y) => Array.from(t.full.data.slice((y * t.full.width + x) * 4, (y * t.full.width + x) * 4 + 4));
      return { size: [t.full.width, t.full.height], a: px(0, 0), b: px(0, t.anim.frameH * (t.anim.count - 1)) };
    });
    check('upload fills every frame and keeps the strip size', frames.size[0] === strip.w && frames.size[1] === strip.h && frames.a[0] === 200 && frames.b[0] === 200, JSON.stringify(frames));

    // frame navigation with "." and ","
    await page.click('.tx-bar', { position: { x: 600, y: 30 } });
    await page.keyboard.press('.');
    check('"." moves to the next frame', (await page.evaluate(() => window.__tx.canvas.current().frame)) === 1);

    // pack icon painting
    await page.click('.tx-col-tabs .tab[data-value="pack"]');
    await page.click('.tx-pack .btn:has-text("Paint")');
    await page.waitForFunction(() => window.__tx.canvas.current()?.key === '@icon');
    await page.evaluate(() => window.__tx.canvas.canvas().setColor([255, 0, 255, 255]));
    const ip = await page.evaluate(() => {
      const pc = window.__tx.canvas.canvas();
      const r = pc.element.querySelector('canvas').getBoundingClientRect();
      const [x, y] = pc.getView().toScreen(2.5, 2.5);
      return [r.left + x, r.top + y];
    });
    await page.mouse.click(ip[0], ip[1]);
    await page.waitForSelector('.tx-save[data-state="saved"]');
    await page.waitForFunction(() => window.__tx.store.project.icon instanceof Blob);
    check('painting the pack icon stores pack.png', true);

    // icon from current texture
    await page.fill('.tx-search-input', 'diamond ore');
    await page.click('.tx-tile[data-path$="block/diamond_ore.png"]');
    await page.waitForFunction(() => window.__tx.canvas.current()?.key.endsWith('diamond_ore.png'));
    const iconBefore = await page.evaluate(() => window.__tx.store.project.icon.size);
    await page.click('.tx-pack .btn:has-text("From texture")');
    await page.waitForFunction((n) => window.__tx.store.project.icon && window.__tx.store.project.icon.size !== n, iconBefore);
    check('icon can be made from the open texture', true);

    // version switch (Java 1.20.1: textures come from the real network)
    if (!argv.includes('--no-version-switch')) {
      await page.click('.tx-pack .vp-trigger');
      await page.fill('.vp-pop input[type=search]', '1.20.1');
      await page.waitForTimeout(400);
      await page.keyboard.press('Enter');
      await page.click('dialog[open] .btn-primary:has-text("Switch version")');
      await page.waitForFunction(() => window.__tx?.store.project.version === '1.20.1' && window.__tx.store.assets.version === '1.20.1', null, { timeout: 180000 });
      const kept = await page.evaluate(() => window.__tx.store.isEdited('assets/minecraft/textures/block/cobblestone.png'));
      check('switching to 1.20.1 reloads textures and keeps edits', kept);
    }

    // delete from the danger zone
    await page.click('.tx-col-tabs .tab[data-value="pack"]');
    await page.click('.tx-danger .btn');
    await page.click('dialog[open] .btn-danger');
    await page.waitForURL(/(#\/|\/)textures\/?$/);
    await page.waitForSelector('.tx-new');
    await page.waitForTimeout(500);
    const names = await page.$$eval('.tx-rc-name', (els) => els.map((e) => e.textContent));
    check('deleting a pack returns to the start screen without it', !names.includes('Smoke'), names.join(', '));
  } catch (e) {
    check('no unexpected exception', false, e.message.split('\n')[0]);
    await page.screenshot({ path: path.join(os.tmpdir(), 'tx-smoke-failure.png') });
  } finally {
    await browser.close();
    server?.stop();
  }
  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' || '));
  console.log(`\n${total - failures}/${total} checks passed`);
  process.exit(failures ? 1 : 0);
})();
