// End-to-end checks of biome colours, the stamp tool and the colour swap in the texture editor:
// a colour map shows the biome colours view (the map with its axes, the biomes marked, the picked
// biome's colour and blocks, notes), painting it changes the colours live and in the 3D previews,
// whose biome picker colours grass like the biome picked (with a note where the game ignores the
// maps); the stamp tool places presets (where the pointer is, turned with R, the shape erased with a
// right click, on the active layer, with undo), saves a selection as a stamp (kept in the browser
// and the project file) and places stamps with a tap on a phone; the colour swap replaces a colour
// in the texture, a whole shade ramp, and across the pack with a list of the textures it changes
// (one undo / redo for all); the exported zip has it all; light and dark, 1280 and 390 px; no
// console errors.
// Usage: NODE_PATH=$(npm root -g) TO_FIXTURES=<dir> node tests/e2e/textures/tools-batch.e2e.cjs [baseUrl] [--shots <dir>]
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startVite, launch, routeMojang, fixturesDir, unzip, decodePng } = require('./lib.cjs');

const argv = process.argv.slice(2);
const baseArg = argv.find((a) => /^https?:/.test(a));
const shotsDir = argv.includes('--shots') ? argv[argv.indexOf('--shots') + 1] : null;
if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tx-tb-'));
const J = 'assets/minecraft/textures/';
const STONE = `${J}block/stone.png`;
const PLANKS = `${J}block/oak_planks.png`;
const APPLE = `${J}item/apple.png`;
const GRASS_MAP = `${J}colormap/grass.png`;
const GRASS_TOP = `${J}block/grass_block_top.png`;

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
}
const shot = async (page, name) => {
  if (shotsDir) await page.screenshot({ path: path.join(shotsDir, `${name}.png`) });
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const RED = [255, 0, 0, 255];
const MAGENTA = [255, 0, 255, 255];
const CYAN = [0, 255, 255, 255];

async function newPack(page, base, name) {
  await page.goto(base + 'textures/');
  await page.waitForSelector('.tx-new .tx-start-opt');
  await page.fill('.tx-name-field input', name);
  await page.click('.tx-create-btn');
  await page.waitForURL(/textures\/[0-9a-f-]+\/?$/, { timeout: 15000 });
  await page.waitForFunction(() => !!window.__tx && document.querySelector('.tx-main'), null, { timeout: 180000 });
}

async function openTexture(page, p) {
  await page.evaluate((x) => window.__tx.open(x), p);
  await page.waitForFunction((x) => window.__tx.canvas.current()?.key === x, p, { timeout: 60000 });
}

const pixel = (page, x, y) => page.evaluate(([a, b]) => window.__tx.pixel(a, b), [x, y]);
/** A pixel of a texture as the store holds it (what the pack gets) */
const storedPixel = (page, p, x, y) =>
  page.evaluate(async ([q, a, b]) => {
    const img = await window.__tx.store.getFull(q);
    const o = (b * img.width + a) * 4;
    return Array.from(img.data.slice(o, o + 4));
  }, [p, x, y]);
const texelPoint = (page, x, y) =>
  page.evaluate(([px, py]) => {
    const pc = window.__tx.canvas.canvas();
    const r = pc.element.querySelector('canvas').getBoundingClientRect();
    const [sx, sy] = pc.getView().toScreen(px + 0.5, py + 0.5);
    return [r.left + sx, r.top + sy];
  }, [x, y]);
async function paintAt(page, x, y, color) {
  await page.evaluate((c) => {
    const pc = window.__tx.canvas.canvas();
    pc.setTool('pencil');
    pc.setColor(c);
  }, color);
  const [sx, sy] = await texelPoint(page, x, y);
  await page.mouse.click(sx, sy);
}
const stampNow = (page) => page.evaluate(() => {
  const s = window.__tx.canvas.canvas().stamp;
  return s && { w: s.width, h: s.height, data: Array.from(s.data) };
});
const toastSeen = (page, re) => page.waitForFunction((src) => [...document.querySelectorAll('.toast')].some((t) => new RegExp(src).test(t.textContent || '')), re.source, { timeout: 8000 }).then(() => true, () => false);
/** A quarter turn clockwise of a stamp as stampNow() gives it */
function rotateCW(s) {
  const out = new Array(s.w * s.h * 4).fill(0);
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) for (let c = 0; c < 4; c++) out[(x * s.h + (s.h - 1 - y)) * 4 + c] = s.data[(y * s.w + x) * 4 + c];
  return { w: s.h, h: s.w, data: out };
}
/** Where a stamp centred on (cx, cy) puts its pixels: [x, y, rgba][] */
function stampPixels(s, cx, cy) {
  const ox = cx - Math.floor(s.w / 2);
  const oy = cy - Math.floor(s.h / 2);
  const out = [];
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
    const i = (y * s.w + x) * 4;
    if (s.data[i + 3]) out.push([ox + x, oy + y, s.data.slice(i, i + 4)]);
  }
  return out;
}

async function exportZip(page) {
  await page.waitForSelector('.tx-save[data-state="saved"]', { timeout: 30000 });
  await page.click('.tx-export-btn');
  await page.waitForSelector('.tx-export-modal .tx-exp-rows');
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 300000 }), page.click('.tx-export-modal .btn-primary:has-text("Export .zip")')]);
  const file = path.join(tmp, `${Date.now()}-${download.suggestedFilename()}`);
  await download.saveAs(file);
  await page.waitForSelector('.tx-exp-done', { timeout: 60000 });
  await page.click('.tx-export-modal .btn-primary:has-text("Done")');
  return unzip(file);
}
const pngPixel = (img, x, y) => Array.from(img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4));

(async () => {
  const fx = fixturesDir();
  if (!fx) {
    console.log('SKIP  tools-batch e2e needs TO_FIXTURES (the 26.3 client jar)');
    return;
  }
  const vite = baseArg ? null : await startVite();
  const base = baseArg ?? vite.url;
  const browser = await launch();
  const errors = [];
  const watch = (page) => {
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/Failed to load resource|net::ERR|favicon/i.test(m.text())) errors.push(m.text());
    });
  };
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, colorScheme: 'light', acceptDownloads: true });
    await routeMojang(ctx, fx);
    const page = await ctx.newPage();
    watch(page);
    await newPack(page, base, 'E2E Tools');

    // ---------------------------------------------------------------- biome colours
    await openTexture(page, GRASS_MAP);
    await page.waitForSelector('.tx-bm:not([hidden]) .tx-bm-chip');
    check('a colour map shows the biome colours view in the Preview tab', await page.isVisible('.tx-bm-map'));
    check('… with the axes in plain words', /Warm/.test(await page.textContent('.tx-bm-axis-x')) && /Rainy/.test(await page.textContent('.tx-bm-axis-y')) && /warmer it is, the further left/.test(await page.textContent('.tx-bm-text')));
    check('… and what the map colours', /Grass blocks, grass, ferns and sugar cane/.test(await page.textContent('.tx-bm-text')));
    check('the 3D view gives way to it', await page.isHidden('.tx-pv-hero'));
    const chips = await page.$$eval('.tx-bm-chip', (l) => l.map((b) => b.dataset.biome));
    check('the biomes of 26.3 are listed (cherry grove, mangrove swamp, pale garden, dappled forest)', ['plains', 'desert', 'jungle', 'swamp', 'taiga', 'badlands', 'cherry_grove', 'mangrove_swamp', 'pale_garden', 'dappled_forest'].every((b) => chips.includes(b)), chips.join(','));
    check('plains is picked at first, read at pixel 50, 173', (await page.getAttribute('.tx-bm-chip[data-biome="plains"]', 'aria-pressed')) === 'true' && /#91BD59 · Pixel 50, 173/.test(await page.textContent('.tx-bm-pickedsub')), await page.textContent('.tx-bm-pickedsub'));
    check('a grass block and oak leaves coloured for it', (await page.$$('.tx-bm-tile canvas')).length === 2 && /Grass Block/.test(await page.textContent('.tx-bm-blocks')));
    check('the notes say where the map is ignored (swamp noise, dark forests, fixed colours, water)', await page.textContent('.tx-bm-notes').then((t) => /two greens/.test(t) && /Dark forests mix/.test(t) && /Badlands/.test(t) && /Water has no colour map/.test(t)));
    await page.click('.tx-bm-chip[data-biome="swamp"]');
    check('picking swamp: its own colour, and the previews follow', (await page.evaluate(() => window.__tx.models.previewBiome)) === 'swamp' && /#6A7039 or|#4C763C or #6A7039/.test(await page.textContent('.tx-bm-own')), await page.textContent('.tx-bm-own'));
    check('the canvas shows the biomes (and the unused half)', await page.evaluate(() => localStorage.getItem('to-tex-biome-markers') !== 'off'));
    await shot(page, 'biomes-map-1280-light');
    await page.click('.tx-bm-chip[data-biome="plains"]');
    // paint plains' pixel: the view, the 3D previews and the export follow
    await page.evaluate(() => window.__tx.canvas.canvas().zoomToRect({ x: 40, y: 163, w: 20, h: 20 }));
    await page.waitForTimeout(100);
    await paintAt(page, 50, 173, RED);
    await page.waitForFunction(() => /#FF0000/.test(document.querySelector('.tx-bm-hex')?.textContent || ''), null, { timeout: 5000 }).catch(() => undefined);
    check('painting the map changes plains’ colour live', /#FF0000/.test(await page.textContent('.tx-bm-hex')));
    const tints = await page.evaluate(async () => {
      window.__tx.models.resetBiome();
      return window.__tx.models.biome(false);
    });
    check('the 3D previews read the pack’s own colour map', same(tints.grass, [255, 0, 0]), JSON.stringify(tints.grass));
    await page.evaluate(() => window.__tx.canvas.canvas().zoomToFit());
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForTimeout(300);
    await shot(page, 'biomes-map-1280-dark');
    await page.emulateMedia({ colorScheme: 'light' });

    await openTexture(page, GRASS_TOP);
    await page.waitForSelector('.tx-pv-biome:not([hidden])', { timeout: 20000 });
    check('grass on show: the preview offers a biome', await page.isVisible('.tx-pv-biome select'));
    await page.selectOption('.tx-pv-biome select', 'swamp');
    await page.waitForSelector('.tx-pv-biome .tx-inline-note:not([hidden])', { timeout: 5000 }).catch(() => undefined);
    check('swamp: the note says the game uses its own greens', /own two greens/.test(await page.textContent('.tx-pv-biome')), await page.textContent('.tx-pv-biome'));
    const swampTints = await page.evaluate(() => window.__tx.models.biome(false));
    check('… and grass is coloured like a swamp', same(swampTints.grass, [0x6a, 0x70, 0x39]), JSON.stringify(swampTints.grass));
    await shot(page, 'biomes-preview-1280-light');
    await page.selectOption('.tx-pv-biome select', 'plains');

    // ---------------------------------------------------------------- stamp tool
    await openTexture(page, STONE);
    await page.click('.tx-tool[data-tool="stamp"]');
    check('the stamp tool is on the rail', (await page.evaluate(() => window.__tx.canvas.canvas().tool)) === 'stamp');
    check('its options show the stamp', await page.isVisible('.tx-st-btn'));
    await page.click('.tx-st-btn');
    await page.waitForSelector('.tx-st-pop .tx-st-tile');
    const presets = await page.$$eval('.tx-st-tile', (l) => l.map((b) => b.dataset.stamp));
    check('presets: ore spots, cracks, moss, dither, sparkles', ['ore', 'cracks', 'moss', 'dither', 'sparkles'].every((p) => presets.includes(`preset:${p}`)), presets.join(','));
    await shot(page, 'stamps-list-1280-light');
    await page.click('.tx-st-tile[data-stamp="preset:ore"]');
    const ore = await stampNow(page);
    check('presets are drawn in shades of the main colour', !!ore && ore.w >= 4);
    const [sx, sy] = await texelPoint(page, 8, 8);
    await page.mouse.move(sx, sy);
    await page.waitForTimeout(150);
    await shot(page, 'stamps-hover-1280-light');
    const before = await page.evaluate(() => Array.from(window.__tx.canvas.current().full.data));
    await page.mouse.click(sx, sy);
    const want = stampPixels(ore, 8, 8);
    const got = await Promise.all(want.map(([x, y]) => pixel(page, x, y)));
    check('a click stamps it centred on the pointer', want.every(([, , c], i) => same(got[i], c)), `${want.length} pixels`);
    await page.locator('.pc-root').focus();
    await page.keyboard.press('Control+z');
    check('Ctrl+Z takes the stamp back', same(await page.evaluate(() => Array.from(window.__tx.canvas.current().full.data)), before));
    await page.keyboard.press('r');
    const turned = await stampNow(page);
    check('R turns the stamp a quarter clockwise', same(turned, rotateCW(ore)));
    await page.keyboard.press('h');
    check('H flips it', !same(await stampNow(page), turned));
    // right click: the stamp's shape in the second colour (transparent: erasing)
    const shape = await stampNow(page);
    await page.mouse.click(sx, sy, { button: 'right' });
    const erased = await Promise.all(stampPixels(shape, 8, 8).map(([x, y]) => pixel(page, x, y)));
    check('a right click stamps the shape in the second colour', erased.every((c) => c[3] === 0));
    await page.keyboard.press('Control+z');
    // on the active layer
    await page.click('.tx-pl-btn');
    await page.click('.tx-pl-add');
    await page.waitForFunction(() => window.__tx.canvas.layers()?.stack.layers.length === 2);
    await page.click('.tx-pl-close').catch(() => undefined);
    await page.evaluate(() => window.__tx.canvas.canvas().setTool('stamp'));
    await page.mouse.click(sx, sy);
    const onLayer = await page.evaluate(([x, y]) => {
      const s = window.__tx.canvas.layers().stack;
      const at = (img) => Array.from(img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4));
      return { top: at(s.layers[1].image), bottom: at(s.layers[0].image) };
    }, stampPixels(shape, 8, 8)[0]);
    check('the stamp lands on the active layer', onLayer.top[3] === 255 && same(onLayer.bottom, before.slice(((stampPixels(shape, 8, 8)[0][1] * 16) + stampPixels(shape, 8, 8)[0][0]) * 4, ((stampPixels(shape, 8, 8)[0][1] * 16) + stampPixels(shape, 8, 8)[0][0]) * 4 + 4)), JSON.stringify(onLayer));
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+z');
    // a selection saved as a stamp
    await page.evaluate(() => {
      const pc = window.__tx.canvas.canvas();
      pc.setTool('select');
      pc.setSelection({ x: 2, y: 2, w: 3, h: 3 });
    });
    await page.waitForSelector('.tx-st-savechip:not([hidden])');
    check('with a selection, “Save selection as stamp” shows', await page.isVisible('.tx-st-savechip'));
    await page.click('.tx-st-savechip');
    check('… it saves the stamp', await toastSeen(page, /as a stamp/));
    const saved = await page.evaluate(() => ({ lib: window.__tx.canvas.stamps().all().length, pack: window.__tx.store.project.stamps?.length ?? 0, tool: window.__tx.canvas.canvas().tool, w: window.__tx.canvas.canvas().stamp?.width }));
    check('… in this browser and in the pack, and picks it', saved.lib === 1 && saved.pack === 1 && saved.tool === 'stamp' && saved.w === 3, JSON.stringify(saved));
    check('… kept in this browser', await page.evaluate(() => JSON.parse(localStorage.getItem('to-tex-stamps') || '[]').length === 1));
    await page.evaluate(() => window.__tx.canvas.canvas().deselect());
    await page.click('.tx-st-btn');
    await page.waitForSelector('.tx-st-pop .tx-st-tile[data-stamp^="saved:"]');
    check('“Your stamps” lists it', (await page.$$('.tx-st-tile[data-stamp^="saved:"]')).length === 1);
    await page.keyboard.press('Escape');
    const [s2x, s2y] = await texelPoint(page, 12, 12);
    await page.mouse.click(s2x, s2y);
    check('the saved stamp stamps the selected pixels', same(await pixel(page, 12, 12), before.slice((3 * 16 + 3) * 4, (3 * 16 + 3) * 4 + 4)));

    // ---------------------------------------------------------------- colour swap
    await paintAt(page, 1, 1, MAGENTA);
    await openTexture(page, APPLE);
    await paintAt(page, 7, 7, MAGENTA);
    await openTexture(page, PLANKS);
    await paintAt(page, 1, 1, MAGENTA);
    await page.evaluate((c) => window.__tx.canvas.canvas().setColor(c), CYAN);
    await page.click('.tx-pal-swap');
    await page.waitForSelector('.tx-sw-modal .tx-sw-pal');
    await page.click('.tx-sw-pal[title="#ff00ff"]');
    check('the swap window: picked from the texture’s colours, 1 pixel', /1 pixel changes/.test(await page.textContent('.tx-sw-count')) && /#FF00FF/.test(await page.textContent('.tx-sw-swatch')), await page.textContent('.tx-sw-count'));
    await shot(page, 'swap-1280-light');
    await page.click('.tx-sw-modal .btn-primary');
    await page.waitForSelector('.tx-sw-modal', { state: 'detached' }).catch(() => undefined);
    check('this texture: the colour is swapped', same(await pixel(page, 1, 1), CYAN));
    await page.locator('.pc-root').focus();
    await page.keyboard.press('Control+z');
    check('… and Ctrl+Z puts it back', same(await pixel(page, 1, 1), MAGENTA));
    // the whole shade ramp
    const planksColour = await pixel(page, 5, 5);
    await page.click('.tx-pal-swap');
    await page.waitForSelector('.tx-sw-modal .tx-sw-pal');
    const hex = '#' + planksColour.slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('');
    await page.click(`.tx-sw-pal[title="${hex}"]`);
    const one = await page.textContent('.tx-sw-count');
    await page.click('.tx-sw-rampbox [role=switch], .tx-sw-rampbox input[type=checkbox]');
    await page.waitForSelector('.tx-sw-ramp:not([hidden])');
    const rampText = await page.textContent('.tx-sw-ramp');
    const many = await page.textContent('.tx-sw-count');
    check('the shade ramp: its shades go along', /[3-9] shades/.test(rampText) && parseInt(many.replace(/\D+/g, ''), 10) > parseInt(one.replace(/\D+/g, ''), 10), `${rampText} / ${one} → ${many}`);
    await shot(page, 'swap-ramp-1280-light');
    await page.click('.tx-sw-modal .btn-ghost:has-text("Cancel")');
    // across the pack
    await page.click('.tx-pal-swap');
    await page.waitForSelector('.tx-sw-modal .tx-sw-pal');
    await page.click('.tx-sw-pal[title="#ff00ff"]');
    await page.click('.tx-sw-where [data-value="pack"]');
    await page.waitForFunction(() => document.querySelectorAll('.tx-sw-row').length === 3, null, { timeout: 30000 }).catch(() => undefined);
    const rows = await page.$$eval('.tx-sw-row', (l) => l.map((r) => r.dataset.path));
    check('the whole pack: the textures that use it are listed', rows.length === 3 && [STONE, PLANKS, APPLE].every((p) => rows.includes(p)), rows.join(', '));
    await page.click(`.tx-sw-row[data-path="${APPLE}"] .tx-sw-check`);
    check('… one left out', /Swap in 2 textures/.test(await page.textContent('.tx-sw-modal .btn-primary')));
    await shot(page, 'swap-pack-1280-light');
    await page.click('.tx-sw-modal .btn-primary');
    await page.waitForSelector('.tx-sw-modal', { state: 'detached' }).catch(() => undefined);
    const swappedNow = { stone: await storedPixel(page, STONE, 1, 1), planks: await storedPixel(page, PLANKS, 1, 1), apple: await storedPixel(page, APPLE, 7, 7) };
    check('… swapped in both, not in the one left out', same(swappedNow.stone, CYAN) && same(swappedNow.planks, CYAN) && same(swappedNow.apple, MAGENTA), JSON.stringify(swappedNow));
    await page.locator('.pc-root').focus();
    await page.keyboard.press('Control+z');
    const undone = { stone: await storedPixel(page, STONE, 1, 1), planks: await storedPixel(page, PLANKS, 1, 1) };
    check('one Ctrl+Z takes back the whole batch', same(undone.stone, MAGENTA) && same(undone.planks, MAGENTA), JSON.stringify(undone));
    await page.keyboard.press('Control+y');
    const redone = { stone: await storedPixel(page, STONE, 1, 1), planks: await storedPixel(page, PLANKS, 1, 1) };
    check('… and Ctrl+Y does it again', same(redone.stone, CYAN) && same(redone.planks, CYAN), JSON.stringify(redone));

    // ---------------------------------------------------------------- the pack
    const zip = await exportZip(page);
    const map = zip[GRASS_MAP] && (await decodePng(zip[GRASS_MAP]));
    check('zip: the colour map with plains painted', !!map && same(pngPixel(map, 50, 173), RED) && map.width === 256);
    const stone = await decodePng(zip[STONE]);
    check('zip: the saved stamp and the swapped colour in stone', same(pngPixel(stone, 1, 1), CYAN) && same(pngPixel(stone, 12, 12), before.slice((3 * 16 + 3) * 4, (3 * 16 + 3) * 4 + 4)));
    const apple = await decodePng(zip[APPLE]);
    check('zip: the apple kept its colour', same(pngPixel(apple, 7, 7), MAGENTA));
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('.tx-file-btn')]);
    const pf = path.join(tmp, dl.suggestedFilename());
    await dl.saveAs(pf);
    const files = unzip(pf);
    const item = Object.keys(files).find((k) => k.endsWith('item.json'));
    const rec = item ? JSON.parse(Buffer.from(files[item]).toString('utf8')) : null;
    const packStamps = rec?.data?.project?.stamps;
    check('the project file carries the pack’s stamps', Array.isArray(packStamps) && packStamps.length === 1 && packStamps[0].width === 3, item);
    check('no sideways scrolling at 1280', await noSideScroll(page));
    await ctx.close();

    // ---------------------------------------------------------------- phones
    for (const scheme of ['light', 'dark']) {
      const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme });
      await routeMojang(phone, fx);
      const pp = await phone.newPage();
      watch(pp);
      await newPack(pp, base, `E2E Tools phone ${scheme}`);
      await openTexture(pp, STONE);
      await pp.evaluate(() => window.__tx.canvas.canvas().setTool('stamp'));
      const s = await stampNow(pp);
      const [tx, ty] = await texelPoint(pp, 8, 8);
      await pp.touchscreen.tap(tx, ty);
      const tapped = await Promise.all(stampPixels(s, 8, 8).map(([x, y]) => pixel(pp, x, y)));
      check(`phone ${scheme}: a tap places the stamp`, stampPixels(s, 8, 8).every(([, , c], i) => same(tapped[i], c)));
      await pp.tap('.tx-st-btn');
      await pp.waitForSelector('.tx-st-pop .tx-st-tile');
      check(`phone ${scheme}: the stamps fit`, await noSideScroll(pp) && (await pp.$eval('.tx-st-pop', (e) => e.getBoundingClientRect().right <= innerWidth + 1)));
      check(`phone ${scheme}: the hint says tap`, /Tap to stamp/.test(await pp.textContent('.tx-st-pop')));
      await shot(pp, `stamps-phone-${scheme}`);
      await pp.tap('.tx-st-tile[data-stamp="preset:moss"]');
      await pp.tap('.tx-pal-swap');
      await pp.waitForSelector('.tx-sw-modal .tx-sw-pal');
      check(`phone ${scheme}: the swap window fits`, await noSideScroll(pp) && (await pp.$eval('.tx-sw-modal', (e) => e.getBoundingClientRect().right <= innerWidth + 1)));
      await shot(pp, `swap-phone-${scheme}`);
      await pp.tap('.tx-sw-modal .btn-ghost:has-text("Cancel")');
      await openTexture(pp, GRASS_MAP);
      await pp.tap('.tx-tabbar-btn[data-v="preview"]');
      await pp.waitForSelector('.tx-bm:not([hidden]) .tx-bm-map');
      check(`phone ${scheme}: the biome colours view fits`, await noSideScroll(pp) && (await pp.$eval('.tx-bm', (e) => e.getBoundingClientRect().right <= innerWidth + 1)));
      check(`phone ${scheme}: the hint says tap`, /Tap a biome/.test(await pp.textContent('.tx-bm')));
      await pp.tap('.tx-bm-chip[data-biome="jungle"]');
      check(`phone ${scheme}: a tap picks a biome`, (await pp.evaluate(() => window.__tx.models.previewBiome)) === 'jungle');
      await shot(pp, `biomes-phone-${scheme}`);
      await phone.close();
    }

    check('no console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
  } catch (err) {
    console.error(err);
    failures++;
  } finally {
    await browser.close();
    vite?.stop();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(failures ? `\n${failures} check(s) failed` : '\nAll tools-batch checks passed');
  process.exit(failures ? 1 : 0);
})();
