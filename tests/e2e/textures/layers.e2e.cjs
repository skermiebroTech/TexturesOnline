// End-to-end checks of paint layers in the texture editor: a texture starts as one layer with the
// panel closed; the Layers button opens it; layers are added, painted (the stroke lands on the
// active layer only), shown through each other, hidden and locked (painting is refused and says
// why), renamed, dragged to a new place, given an opacity and a blend mode, merged down and
// flattened, and a locked layer is made from the game's texture; the eyedropper takes what shows
// or only the active layer; a selection moves the active layer's pixels only; Ctrl+Z / Ctrl+Y take
// back and redo strokes and layer changes in order, each on its own layer; layers survive a reload
// and a project file; animated textures keep their layers through every frame and frame change;
// the exported PNG is the layers flattened, and an opened pack is one layer again; a phone with
// touch uses the panel as a sheet with buttons to move layers; light and dark; no console errors.
// Usage: NODE_PATH=$(npm root -g) TO_FIXTURES=<dir> node tests/e2e/textures/layers.e2e.cjs [baseUrl] [--shots <dir>]
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startVite, launch, routeMojang, fixturesDir, unzip, decodePng } = require('./lib.cjs');

const argv = process.argv.slice(2);
const baseArg = argv.find((a) => /^https?:/.test(a));
const shotsDir = argv.includes('--shots') ? argv[argv.indexOf('--shots') + 1] : null;
if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tx-pl-'));
const J = 'assets/minecraft/textures/';
const STONE = `${J}block/stone.png`;
const APPLE = `${J}item/apple.png`;
const GLASS = `${J}block/glass.png`;

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
}
const shot = async (page, name) => {
  if (shotsDir) await page.screenshot({ path: path.join(shotsDir, `${name}.png`) });
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const near = (a, b, d = 1) => !!a && !!b && a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= d);
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const RED = [255, 0, 0, 255];
const BLUE = [0, 0, 255, 255];

/** The W3C compositing result (what the editor's blend modes follow), rounded once. */
function blend(under, over, mode, opacity = 1) {
  const ab = under[3] / 255;
  const as = (over[3] / 255) * opacity;
  const ao = as + ab * (1 - as);
  const B = (b, s) => (mode === 'multiply' ? b * s : mode === 'screen' ? b + s - b * s : mode === 'lighten' ? Math.max(b, s) : mode === 'overlay' ? (b <= 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s)) : s);
  const out = [];
  for (let c = 0; c < 3; c++) {
    const cs = over[c] / 255;
    const cb = under[c] / 255;
    out.push(Math.round(((as * ((1 - ab) * cs + ab * B(cb, cs)) + ab * (1 - as) * cb) / ao) * 255));
  }
  return [...out, Math.round(ao * 255)];
}

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

/** The layers as the editor holds them (bottom first). */
const layers = (page) =>
  page.evaluate(() => {
    const s = window.__tx.canvas.layers();
    return s ? { active: s.stack.active, list: s.stack.layers.map((l) => ({ name: l.name, hidden: l.hidden, locked: l.locked, opacity: l.opacity, blend: l.blend })) } : null;
  });
const names = async (page) => (await layers(page))?.list.map((l) => l.name) ?? null;
/** A pixel of the flattened texture */
const pixel = (page, x, y) => page.evaluate(([a, b]) => window.__tx.pixel(a, b), [x, y]);
/** A pixel of layer i (in the whole texture) */
const layerPixel = (page, i, x, y) =>
  page.evaluate(([k, a, b]) => {
    const img = window.__tx.canvas.layers().stack.layers[k].image;
    const o = (b * img.width + a) * 4;
    return Array.from(img.data.slice(o, o + 4));
  }, [i, x, y]);
const toastSeen = (page, re) => page.waitForFunction((src) => [...document.querySelectorAll('.toast')].some((t) => new RegExp(src).test(t.textContent || '')), re.source, { timeout: 8000 }).then(() => true, () => false);

/** Screen point of a texel of the pixel editor */
const texelPoint = (page, x, y) =>
  page.evaluate(([px, py]) => {
    const pc = window.__tx.canvas.canvas();
    const r = pc.element.querySelector('canvas').getBoundingClientRect();
    const [sx, sy] = pc.getView().toScreen(px + 0.5, py + 0.5);
    return [r.left + sx, r.top + sy];
  }, [x, y]);

async function paintAt(page, x, y, color, tap = false) {
  await page.evaluate((c) => {
    const pc = window.__tx.canvas.canvas();
    pc.setTool('pencil');
    pc.setColor(c);
  }, color);
  const [sx, sy] = await texelPoint(page, x, y);
  if (tap) await page.touchscreen.tap(sx, sy);
  else await page.mouse.click(sx, sy);
}

/** The row of a layer in the panel (by name) */
const row = (name) => `.tx-plr:has(.tx-plr-name:text-is("${name}"))`;

async function setOpacity(page, pct) {
  await page.$eval(
    '.tx-pl-opacity',
    (el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    },
    pct,
  );
}

async function panelMenu(page, label) {
  await page.click('.tx-pl-more');
  await page.click(`[role=menuitem]:has-text("${label}")`);
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
  return { zip: unzip(file), file };
}

/** The texture as the store holds it (what the pack gets) */
const stored = (page, p) => page.evaluate(async (x) => Array.from((await window.__tx.store.getFull(x)).data), p);
/** Indexes of the RGBA values that differ */
const diffAt = (a, b) => a.map((v, i) => (v !== b[i] ? i : -1)).filter((i) => i >= 0);

/** The flattened texture (all of it) as the editor holds it */
const fullOf = (page) => page.evaluate(() => {
  const t = window.__tx.canvas.current();
  return { w: t.full.width, h: t.full.height, data: Array.from(t.full.data) };
});

(async () => {
  const fx = fixturesDir();
  if (!fx) {
    console.log('SKIP  layers e2e needs TO_FIXTURES (the 26.3 client jar)');
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
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, colorScheme: 'dark', acceptDownloads: true });
    await routeMojang(ctx, fx);
    const page = await ctx.newPage();
    watch(page);
    await newPack(page, base, 'E2E Layers');
    await openTexture(page, STONE);
    const stone = await pixel(page, 4, 4);
    const stone88 = await pixel(page, 8, 8);

    // ---------------------------------------------------------------- one layer, panel closed
    check('a texture starts as one layer', (await layers(page)) === null);
    const btnText = (await page.textContent('.tx-pl-btn')).trim();
    check('the Layers button is there, the panel closed', (await page.isVisible('.tx-pl-btn')) && (await page.isHidden('.tx-pl')) && btnText === 'Layers', btnText);
    await paintAt(page, 0, 0, BLUE);
    check('one layer paints as before', same(await pixel(page, 0, 0), BLUE) && (await layers(page)) === null);
    await page.keyboard.press('Control+z');
    check('… and undoes as before', same(await pixel(page, 0, 0), await page.evaluate(() => Array.from(window.__tx.canvas.current().base.data.slice(0, 4)))));
    await page.click('.tx-pl-btn');
    await page.waitForSelector('.tx-pl:not([hidden]) .tx-plr');
    check('the panel lists the one layer', (await page.$$('.tx-plr')).length === 1 && /Layer 1/.test(await page.textContent('.tx-plr')));
    check('the panel says what the game gets', /flattened into one picture/.test(await page.textContent('.tx-pl-note')));
    check('the open panel is remembered', (await page.evaluate(() => localStorage.getItem('to-tex-layers-open'))) === '1');
    await shot(page, 'layers-one-1280-dark');

    // ---------------------------------------------------------------- add, paint, show through
    await page.click('.tx-pl-add');
    await page.waitForFunction(() => window.__tx.canvas.layers()?.stack.layers.length === 2);
    check('+ adds “Layer 2” above and paints on it', same(await names(page), ['Layer 1', 'Layer 2']) && (await layers(page)).active === 1);
    check('the button shows the layer and the count', /Layer 2\s*2/.test(await page.textContent('.tx-pl-btn')));
    check('the list shows the top layer first', same(await page.$$eval('.tx-plr .tx-plr-name', (l) => l.map((x) => x.textContent)), ['Layer 2', 'Layer 1']));
    check('the texture looks the same (the new layer is empty)', same(await pixel(page, 4, 4), stone));
    await paintAt(page, 4, 4, RED);
    check('a stroke lands on the active layer only', same(await layerPixel(page, 1, 4, 4), RED) && same(await layerPixel(page, 0, 4, 4), stone));
    check('the texture is the layers flattened', same(await pixel(page, 4, 4), RED) && same(await pixel(page, 8, 8), stone88));

    // the eyedropper: what shows, or the active layer only
    await page.evaluate(() => window.__tx.canvas.canvas().setTool('picker'));
    check('the eyedropper offers “This layer only”', await page.isVisible('.tx-pick-layer'));
    let pt = await texelPoint(page, 2, 8);
    await page.mouse.click(pt[0], pt[1]);
    check('the eyedropper takes what shows (the layer under)', same(await page.evaluate(() => window.__tx.canvas.canvas().color), await pixel(page, 2, 8)));
    await page.click('.tx-pick-layer');
    await page.mouse.click(pt[0], pt[1]);
    check('… or only the active layer (transparent there)', same(await page.evaluate(() => window.__tx.canvas.canvas().color), [0, 0, 0, 0]));
    await page.click('.tx-pick-layer');

    // opacity and blend mode
    await setOpacity(page, 50);
    await page.waitForFunction(() => window.__tx.canvas.layers().stack.layers[1].opacity === 0.5);
    check('opacity 50%: red shows half over the stone', near(await pixel(page, 4, 4), blend(stone, RED, 'normal', 0.5)), JSON.stringify(await pixel(page, 4, 4)));
    check('the row says 50%', /50%/.test(await page.textContent(row('Layer 2'))));
    await page.selectOption('.tx-pl-blend', 'multiply');
    await page.waitForFunction(() => window.__tx.canvas.layers().stack.layers[1].blend === 'multiply');
    check('multiply: the stone darkened red, at half strength', near(await pixel(page, 4, 4), blend(stone, RED, 'multiply', 0.5)), `${JSON.stringify(await pixel(page, 4, 4))} vs ${JSON.stringify(blend(stone, RED, 'multiply', 0.5))}`);
    const shown = await page.evaluate(() => window.__tx.canvas.canvas().getShownPixel(4, 4));
    check('the canvas shows the same pixels the pack gets', same(shown, await pixel(page, 4, 4)));
    await shot(page, 'layers-blend-1280-dark');
    await page.selectOption('.tx-pl-blend', 'screen');
    await page.waitForFunction(() => window.__tx.canvas.layers().stack.layers[1].blend === 'screen');
    check('screen: lighter', near(await pixel(page, 4, 4), blend(stone, RED, 'screen', 0.5)));

    // undo and redo: layer changes and strokes in order
    await page.locator('.pc-root').focus();
    await page.keyboard.press('Control+z');
    check('Ctrl+Z: back to multiply', (await layers(page)).list[1].blend === 'multiply');
    await page.keyboard.press('Control+z');
    check('Ctrl+Z: back to normal', (await layers(page)).list[1].blend === 'normal');
    await page.keyboard.press('Control+z');
    check('Ctrl+Z: back to full strength', (await layers(page)).list[1].opacity === 1 && same(await pixel(page, 4, 4), RED));
    await page.keyboard.press('Control+z');
    check('Ctrl+Z: the stroke is gone', same(await pixel(page, 4, 4), stone) && (await layers(page)).list.length === 2);
    await page.keyboard.press('Control+z');
    check('Ctrl+Z: the added layer is gone', (await layers(page)).list.length === 1);
    for (let i = 0; i < 5; i++) await page.keyboard.press('Control+y');
    const redone = await layers(page);
    check('Ctrl+Y ×5: layer, stroke, strength and blend back', redone.list.length === 2 && redone.list[1].opacity === 0.5 && redone.list[1].blend === 'screen' && near(await pixel(page, 4, 4), blend(stone, RED, 'screen', 0.5)), JSON.stringify(redone));
    await setOpacity(page, 100);
    await page.selectOption('.tx-pl-blend', 'normal');
    await page.waitForFunction(() => window.__tx.canvas.layers().stack.layers[1].blend === 'normal');

    // undo goes back to the layer a stroke was painted on
    await page.click(row('Layer 1'));
    check('clicking a layer makes it active', (await layers(page)).active === 0);
    await paintAt(page, 1, 10, BLUE);
    check('painting Layer 1', same(await layerPixel(page, 0, 1, 10), BLUE));
    await page.click(row('Layer 2'));
    await page.locator('.pc-root').focus();
    await page.keyboard.press('Control+z');
    check('Ctrl+Z on Layer 2 undoes the stroke on Layer 1 and selects it', !same(await layerPixel(page, 0, 1, 10), BLUE) && (await layers(page)).active === 0);
    await page.keyboard.press('Control+y');
    check('Ctrl+Y paints it again, back on Layer 2', same(await layerPixel(page, 0, 1, 10), BLUE) && (await layers(page)).active === 1, JSON.stringify([await layerPixel(page, 0, 1, 10), (await layers(page)).active, await page.evaluate(() => window.__tx.canvas.canvas().redoStack.map((e) => e.kind))]));

    // hide and lock: painting is refused and says why
    await page.click(`${row('Layer 2')} .tx-plr-eye`);
    check('hiding Layer 2 shows the stone under it', same(await pixel(page, 4, 4), stone) && (await layers(page)).list[1].hidden);
    await paintAt(page, 3, 5, RED);
    check('painting a hidden layer is refused', same(await layerPixel(page, 1, 3, 5), [0, 0, 0, 0]));
    check('… and a toast says to show it', await toastSeen(page, /“Layer 2” is hidden/));
    await page.click(`${row('Layer 2')} .tx-plr-eye`);
    await page.click(`${row('Layer 2')} .tx-plr-lock`);
    await page.waitForTimeout(2600);
    await paintAt(page, 3, 5, RED);
    check('painting a locked layer is refused, with a toast', same(await layerPixel(page, 1, 3, 5), [0, 0, 0, 0]) && (await toastSeen(page, /“Layer 2” is locked/)));
    await page.click(`${row('Layer 2')} .tx-plr-lock`);
    check('unlocked again', !(await layers(page)).list[1].locked);

    // rename (double-click) and drag to a new place
    await page.dblclick(`${row('Layer 2')} .tx-plr-name`);
    await page.fill('.tx-plr-input', 'Shine');
    await page.keyboard.press('Enter');
    check('double-click renames', same(await names(page), ['Layer 1', 'Shine']));
    const from = await page.$eval(row('Layer 1'), (b) => {
      const r = b.getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2];
    });
    const to = await page.$eval(row('Shine'), (b) => {
      const r = b.getBoundingClientRect();
      return [r.left + r.width / 2, r.top + 4];
    });
    await page.mouse.move(from[0], from[1]);
    await page.mouse.down();
    await page.mouse.move(from[0], from[1] - 10, { steps: 3 });
    await page.mouse.move(to[0], to[1], { steps: 6 });
    check('dragging shows where the layer goes', await page.isVisible('.tx-pl-drop'));
    await page.mouse.up();
    await page.waitForFunction(() => window.__tx.canvas.layers().stack.layers[1].name === 'Layer 1');
    check('drag: Layer 1 is on top now, the active layer stays Shine', same(await names(page), ['Shine', 'Layer 1']) && (await layers(page)).active === 0);
    check('… and the stone covers the red', same(await pixel(page, 4, 4), stone), JSON.stringify([await pixel(page, 4, 4), stone, await layers(page)]));
    await page.locator('.pc-root').focus();
    await page.keyboard.press('Control+z');
    check('Ctrl+Z puts the order back', same(await names(page), ['Layer 1', 'Shine']) && same(await pixel(page, 4, 4), RED));

    // a layer from the game's texture, locked at the bottom
    await panelMenu(page, 'New layer from the game’s texture');
    await page.waitForFunction(() => window.__tx.canvas.layers().stack.layers.length === 3);
    let ls = await layers(page);
    check('the game’s texture comes in at the bottom, locked', ls.list[0].name === 'Game texture' && ls.list[0].locked && ls.list[ls.active].name === 'Shine' && same(await layerPixel(page, 0, 8, 8), stone88));
    await shot(page, 'layers-three-1280-dark');

    // selection and move: only the active layer's pixels move
    await page.click('.tx-pl-add');
    await page.waitForFunction(() => window.__tx.canvas.layers().stack.layers.length === 4);
    await paintAt(page, 1, 1, BLUE);
    const under11 = await layerPixel(page, 1, 1, 1);
    await page.evaluate(() => {
      const pc = window.__tx.canvas.canvas();
      pc.setTool('select');
      pc.setSelection({ x: 0, y: 0, w: 3, h: 3 });
    });
    await page.locator('.pc-root').focus();
    await page.keyboard.press('ArrowRight');
    await page.evaluate(() => window.__tx.canvas.canvas().commitSelection());
    check('moving a selection moves the active layer’s pixels', same(await layerPixel(page, 3, 2, 1), BLUE) && same(await layerPixel(page, 3, 1, 1), [0, 0, 0, 0]));
    check('… and leaves the layers under it alone', same(await layerPixel(page, 1, 1, 1), under11));
    await page.evaluate(() => window.__tx.canvas.canvas().deselect());

    // merge down and delete
    const beforeMerge = await fullOf(page);
    await page.click('.tx-pl-merge');
    await page.waitForFunction(() => window.__tx.canvas.layers().stack.layers.length === 3);
    check('merge down: one layer fewer, the picture unchanged', same(await names(page), ['Game texture', 'Layer 1', 'Shine']) && same(await fullOf(page), beforeMerge));
    check('… merged into Shine', same(await layerPixel(page, 2, 2, 1), BLUE) && same(await layerPixel(page, 2, 4, 4), RED));
    await page.click(row('Game texture'));
    await page.click('.tx-pl-delete');
    await page.waitForFunction(() => window.__tx.canvas.layers().stack.layers.length === 2);
    check('delete removes the layer (even a locked one)', same(await names(page), ['Layer 1', 'Shine']), JSON.stringify(await names(page)));
    await page.locator('.pc-root').focus();
    await page.keyboard.press('Control+z');
    check('Ctrl+Z brings it back', same(await names(page), ['Game texture', 'Layer 1', 'Shine']));
    await setOpacity(page, 60);
    await page.waitForFunction(() => window.__tx.canvas.layers().stack.layers[0].opacity === 0.6);

    // the record survives a reload
    const flatBefore = await fullOf(page);
    const layersBefore = await layers(page);
    await page.waitForSelector('.tx-save[data-state="saved"]', { timeout: 30000 });
    const rec = await page.evaluate((p) => {
      const r = window.__tx.store.project.layers?.[p];
      return r && { n: r.layers.length, png: r.layers.every((l) => l.image instanceof Blob && l.image.type === 'image/png'), active: r.active };
    }, STONE);
    check('the project stores the layers as PNGs', rec?.n === 3 && rec.png, JSON.stringify(rec));
    await page.reload();
    await page.waitForFunction(() => !!window.__tx && document.querySelector('.tx-main'), null, { timeout: 180000 });
    await openTexture(page, STONE);
    await page.waitForSelector('.tx-pl:not([hidden]) .tx-plr');
    check('after a reload: the same layers', same(await layers(page), layersBefore), JSON.stringify(await layers(page)));
    check('after a reload: the same picture', same(await fullOf(page), flatBefore));
    await page.emulateMedia({ colorScheme: 'light' });
    await shot(page, 'layers-reload-1280-light');
    await page.emulateMedia({ colorScheme: 'dark' });

    // the exported PNG is the layers flattened
    const ex = await exportZip(page);
    const png = await decodePng(ex.zip[STONE]);
    const flat = await fullOf(page);
    check('zip: stone.png is the layers flattened', png.width === flat.w && png.height === flat.h && same(Array.from(png.data), flat.data));
    check('zip: no layer files in the pack', !Object.keys(ex.zip).some((k) => /layer/i.test(k)));

    // a project file carries the layers
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('.tx-file-btn')]);
    const pf = path.join(tmp, dl.suggestedFilename());
    await dl.saveAs(pf);
    const entries = Object.keys(unzip(pf));
    check('the project file holds each layer as a PNG', entries.filter((e) => /\/layers\/.*\.png$/.test(e)).length === 3, entries.join(', '));

    // flatten: one layer again, nothing stored; Ctrl+Z
    await panelMenu(page, 'Flatten into one layer');
    await page.waitForFunction(() => window.__tx.canvas.layers().stack.layers.length === 1);
    check('flatten: one layer, the picture unchanged', same(await fullOf(page), flat) && (await page.$$('.tx-plr')).length === 1);
    await page.waitForSelector('.tx-save[data-state="saved"]', { timeout: 30000 });
    check('… and the project stores no layers for it', await page.evaluate((p) => !window.__tx.store.project.layers?.[p], STONE));
    await page.locator('.pc-root').focus();
    await page.keyboard.press('Control+z');
    check('Ctrl+Z: the layers are back', (await layers(page)).list.length === 3);

    // ---------------------------------------------------------------- rewritten from elsewhere
    // A PvP tweak rewrites a layered texture that is open: its layers are dropped, the editor shows
    // the tweaked pixels, and the next stroke changes only the pixel it paints.
    await openTexture(page, GLASS);
    if (await page.isHidden('.tx-pl')) await page.click('.tx-pl-btn');
    await page.click('.tx-pl-add');
    await page.waitForFunction(() => window.__tx.canvas.layers()?.stack.layers.length === 2);
    await paintAt(page, 3, 3, RED);
    await page.waitForSelector('.tx-save[data-state="saved"]', { timeout: 30000 });
    await page.evaluate(() => window.__tx.showSide('pvp'));
    await page.waitForSelector('.pvp-tweak[data-tweak="clearGlass"] .switch', { timeout: 60000 });
    await page.click('.pvp-tweak[data-tweak="clearGlass"] .switch');
    await page.waitForFunction(() => document.querySelector('.pvp-tweak[data-tweak="clearGlass"] .switch')?.getAttribute('aria-checked') === 'true' && !document.querySelector('.pvp-tweak.is-busy'), null, { timeout: 60000 });
    await page.waitForFunction(() => window.__tx.canvas.layers() === null, null, { timeout: 15000 }).catch(() => undefined);
    check('a PvP tweak on a layered texture drops its layers', (await layers(page)) === null);
    check('… and says so', await toastSeen(page, /changed outside the layers/));
    const tweaked = await stored(page, GLASS);
    check('the tweak cleared the glass (and the red painted inside it)', tweaked[(3 * 16 + 3) * 4 + 3] === 0);
    await page.evaluate(() => window.__tx.showSide('preview'));
    await page.waitForFunction(() => !window.__tx.canvas.canvas().isLocked);
    await paintAt(page, 4, 4, BLUE);
    await page.waitForFunction((p) => window.__tx.store.isEdited(p), GLASS);
    let after = await stored(page, GLASS);
    let changed = diffAt(tweaked, after);
    check('a stroke after the tweak changes only its own pixel (the old layers don’t come back)', changed.length > 0 && changed.every((i) => Math.floor(i / 4) === 4 * 16 + 4), `changed values at ${changed.slice(0, 8).join(',')}`);
    // the tweak switched off and on again: the same holds
    await page.evaluate(() => window.__tx.showSide('pvp'));
    for (let k = 0; k < 2; k++) {
      const was = await page.getAttribute('.pvp-tweak[data-tweak="clearGlass"] .switch', 'aria-checked');
      await page.click('.pvp-tweak[data-tweak="clearGlass"] .switch');
      await page.waitForFunction((w) => document.querySelector('.pvp-tweak[data-tweak="clearGlass"] .switch')?.getAttribute('aria-checked') !== w && !document.querySelector('.pvp-tweak.is-busy'), was, { timeout: 60000 });
    }
    // any other rewrite through the store: layers again, then the texture replaced from outside
    await page.evaluate(() => window.__tx.showSide('preview'));
    await page.click('.tx-pl-add');
    await page.waitForFunction(() => window.__tx.canvas.layers()?.stack.layers.length === 2);
    await paintAt(page, 2, 2, RED);
    await page.evaluate((p) => {
      const img = new ImageData(16, 16);
      for (let i = 0; i < 256; i++) img.data.set([0, 200, 0, 255], i * 4);
      window.__tx.store.setImage(p, img);
    }, GLASS);
    await page.waitForFunction(() => window.__tx.canvas.layers() === null && !window.__tx.canvas.canvas().isLocked, null, { timeout: 15000 });
    const green = await stored(page, GLASS);
    await paintAt(page, 1, 5, BLUE);
    after = await stored(page, GLASS);
    changed = diffAt(green, after);
    check('a rewrite from elsewhere: the next stroke keeps the new pixels', changed.length > 0 && changed.every((i) => Math.floor(i / 4) === 5 * 16 + 1) && same(await pixel(page, 2, 2), [0, 200, 0, 255]), `changed values at ${changed.slice(0, 8).join(',')}`);

    // ---------------------------------------------------------------- an animated texture
    await openTexture(page, APPLE);
    check('another texture: one layer', (await layers(page)) === null && (await page.$$('.tx-plr')).length === 1);
    await page.click('.tx-pl-add');
    await page.waitForFunction(() => window.__tx.canvas.layers()?.stack.layers.length === 2);
    await paintAt(page, 3, 3, RED);
    await page.click('.tx-head-actions .icon-btn:last-child');
    await page.click('[role=menuitem]:has-text("Make animated")');
    await page.waitForSelector('.tx-frames:not([hidden]) .tx-frame');
    ls = await layers(page);
    check('made animated: both layers get the frames', ls?.list.length === 2 && (await page.evaluate(() => window.__tx.canvas.layers().stack.layers.every((l) => l.image.height === 32))));
    check('frame 2 is open, on Layer 2', (await page.evaluate(() => window.__tx.canvas.current().frame)) === 1 && ls.active === 1);
    await paintAt(page, 2, 6, BLUE);
    check('painting frame 2 paints Layer 2’s frame 2 only', same(await layerPixel(page, 1, 2, 22), BLUE) && same(await layerPixel(page, 1, 2, 6), [0, 0, 0, 0]) && same(await pixel(page, 2, 22), BLUE));
    await page.click('.tx-frame-add');
    await page.waitForFunction(() => window.__tx.canvas.current().full.height === 48);
    check('+ frame: every layer gets the copy', await page.evaluate(() => window.__tx.canvas.layers().stack.layers.every((l) => l.image.height === 48)) && same(await layerPixel(page, 1, 2, 38), BLUE));
    const appleFlat = await fullOf(page);
    const ex2 = await exportZip(page);
    const applePng = await decodePng(ex2.zip[APPLE]);
    check('zip: the animated apple is the layers flattened, every frame', applePng.height === 48 && same(Array.from(applePng.data), appleFlat.data));
    await shot(page, 'layers-animated-1280-dark');

    // an opened pack is one layer again
    const ip = await ctx.newPage();
    watch(ip);
    await ip.goto(base + 'textures/');
    await ip.waitForSelector('.tx-open-dz');
    await ip.setInputFiles('.tx-open-dz input[type=file]', ex.file);
    await ip.waitForFunction(() => /textures\/[0-9a-f-]+\/?$/.test(location.href) || document.querySelector('dialog[open] .btn-primary'), null, { timeout: 60000 });
    const warn = await ip.$('dialog[open] .btn-primary');
    if (warn) await warn.click();
    await ip.waitForURL(/textures\/[0-9a-f-]+\/?$/, { timeout: 60000 });
    await ip.waitForFunction(() => !!window.__tx && document.querySelector('.tx-main'), null, { timeout: 180000 });
    await openTexture(ip, STONE);
    check('an opened pack: the texture is one layer with the flattened pixels', (await layers(ip)) === null && same((await fullOf(ip)).data, flat.data));
    await ip.close();

    // the project file opens with its layers
    const op = await ctx.newPage();
    watch(op);
    await op.goto(base + 'textures/');
    await op.waitForSelector('.tx-new');
    const [chooser] = await Promise.all([op.waitForEvent('filechooser', { timeout: 15000 }), op.click('.tx-open [data-project-file="open"]')]);
    await chooser.setFiles(pf);
    await op.waitForURL(/textures\/[0-9a-f-]+\/?$/, { timeout: 30000 });
    await op.waitForFunction(() => !!window.__tx && document.querySelector('.tx-main'), null, { timeout: 180000 });
    await openTexture(op, STONE);
    check('a project file opens with the layers', same(await names(op), ['Game texture', 'Layer 1', 'Shine']) && same((await fullOf(op)).data, flat.data));
    await op.close();
    await ctx.close();

    // ---------------------------------------------------------------- a phone with touch
    for (const scheme of ['dark', 'light']) {
      const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme });
      await routeMojang(phone, fx);
      const pp = await phone.newPage();
      watch(pp);
      await newPack(pp, base, `E2E Layers phone ${scheme}`);
      await openTexture(pp, STONE);
      await pp.evaluate(() => window.__tx.showSide('editor'));
      await pp.waitForSelector('.tx-pl-btn');
      check(`phone ${scheme}: the Layers button is an icon`, (await pp.isVisible('.tx-pl-btn')) && (await pp.isHidden('.tx-pl-btn-label')));
      await pp.tap('.tx-pl-btn');
      await pp.waitForSelector('.tx-pl:not([hidden])');
      await pp.tap('.tx-pl-add');
      await pp.waitForFunction(() => window.__tx.canvas.layers()?.stack.layers.length === 2);
      await paintAt(pp, 3, 1, RED, true);
      check(`phone ${scheme}: a finger paints the new layer above the sheet`, same(await layerPixel(pp, 1, 3, 1), RED));
      const box = await pp.$eval('.tx-pl', (e) => {
        const r = e.getBoundingClientRect();
        const s = e.closest('.tx-stage').getBoundingClientRect();
        const bar = document.querySelector('.tx-tabbar').getBoundingClientRect();
        const foot = e.querySelector('.tx-pl-foot').getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, stop: s.top, bar: bar.top, foot: foot.bottom };
      });
      check(`phone ${scheme}: the panel is a sheet on the tab bar, all of it in view`, box.left <= 1 && box.right >= 389 && Math.abs(box.bottom - box.bar) <= 2 && box.foot <= box.bottom && box.top > box.stop + 40, JSON.stringify(box));
      const fit = await pp.evaluate(() => {
        const c = window.__tx.canvas.canvas().element.getBoundingClientRect();
        return { bottom: c.bottom, sheet: document.querySelector('.tx-pl').getBoundingClientRect().top };
      });
      check(`phone ${scheme}: the canvas fits above the sheet`, fit.bottom <= fit.sheet + 1, JSON.stringify(fit));
      check(`phone ${scheme}: rows have no drag hint, buttons move layers`, !(await pp.getAttribute('.tx-plr', 'title')));
      await pp.tap('.tx-pl-foot .icon-btn[aria-label="Move down"]');
      check(`phone ${scheme}: Move down`, same(await names(pp), ['Layer 2', 'Layer 1']) && (await layers(pp)).active === 0);
      await pp.tap('.tx-pl-foot .icon-btn[aria-label="Move up"]');
      check(`phone ${scheme}: Move up`, same(await names(pp), ['Layer 1', 'Layer 2']));
      check(`phone ${scheme}: no sideways scrolling`, await noSideScroll(pp));
      const small = await pp.$$eval('.tx-pl button:not([hidden]), .tx-pl-btn', (bs) => bs.filter((b) => b.offsetParent && b.getBoundingClientRect().width > 0 && (b.getBoundingClientRect().width < 36 || b.getBoundingClientRect().height < 36)).map((b) => b.getAttribute('aria-label')));
      check(`phone ${scheme}: tap targets are big enough`, small.length === 0, small.join(', '));
      await shot(pp, `layers-phone-${scheme}`);
      await pp.tap('.tx-pl-close');
      check(`phone ${scheme}: the sheet closes`, await pp.isHidden('.tx-pl'));
      // an animated texture: the frames strip takes room from the canvas, the sheet still fits
      await openTexture(pp, APPLE);
      await pp.tap('.tx-head-actions .icon-btn:last-child');
      await pp.tap('[role=menuitem]:has-text("Make animated")');
      await pp.waitForSelector('.tx-frames:not([hidden]) .tx-frame');
      await pp.tap('.tx-pl-btn');
      await pp.waitForSelector('.tx-pl:not([hidden])');
      const anim = await pp.$eval('.tx-pl', (e) => ({ foot: e.querySelector('.tx-pl-foot').getBoundingClientRect().bottom, bar: document.querySelector('.tx-tabbar').getBoundingClientRect().top, canvas: window.__tx.canvas.canvas().element.getBoundingClientRect().height }));
      check(`phone ${scheme}: with the frames strip the sheet is all in view and the canvas keeps some room`, anim.foot <= anim.bar + 1 && anim.canvas >= 48, JSON.stringify(anim));
      await shot(pp, `layers-phone-animated-${scheme}`);
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
  console.log(failures ? `\n${failures} check(s) failed` : '\nAll layer checks passed');
  process.exit(failures ? 1 : 0);
})();
