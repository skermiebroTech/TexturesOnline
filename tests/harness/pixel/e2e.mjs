// End-to-end checks for the pixel canvas harness.
// Run: NODE_PATH=$(npm root -g) node tests/harness/pixel/e2e.mjs [screenshotDir]
// Needs the global 'playwright' package; set CHROMIUM_PATH to use a specific Chromium build.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const shots = process.argv[2] || path.join(tmpdir(), 'pixel-harness-screens');
mkdirSync(shots, { recursive: true });
const executablePath = process.env.CHROMIUM_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => existsSync(p));

const server = await createServer({
  root,
  logLevel: 'error',
  server: { port: 0, host: '127.0.0.1', hmr: false, watch: null },
});
await server.listen();
const base = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await chromium.launch(executablePath ? { executablePath } : {});

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function openPage(opts = {}, query = '') {
  const context = await browser.newContext({ viewport: { width: 1200, height: 760 }, deviceScaleFactor: 2, ...opts });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !(m.location()?.url || '').includes('favicon')) errors.push(m.text()); });
  await page.goto(`${base}/tests/harness/pixel/index.html${query}`);
  await page.waitForFunction(() => window.pcReady === true);
  return { page, context, errors };
}

const H = {
  px: (page, x, y) => page.evaluate(([x, y]) => window.harness.px(x, y), [x, y]),
  client: (page, x, y) => page.evaluate(([x, y]) => window.harness.toClient(x, y), [x, y]),
  load: (page, w, h, fill = null) => page.evaluate(([w, h, fill]) => window.harness.load(w, h, fill), [w, h, fill]),
  call: (page, fn, arg) => page.evaluate(fn, arg),
  async click(page, x, y, opts = {}) {
    const [cx, cy] = await H.client(page, x, y);
    await page.mouse.click(cx, cy, opts);
  },
  async drag(page, pts, opts = {}) {
    const [sx, sy] = await H.client(page, pts[0][0], pts[0][1]);
    await page.mouse.move(sx, sy);
    await page.mouse.down(opts);
    for (const [x, y] of pts.slice(1)) {
      const [cx, cy] = await H.client(page, x, y);
      await page.mouse.move(cx, cy, { steps: opts.steps ?? 1 });
    }
    await page.mouse.up(opts);
  },
  async hover(page, x, y) {
    const [cx, cy] = await H.client(page, x, y);
    await page.mouse.move(cx - 3, cy - 3);
    await page.mouse.move(cx, cy);
    await page.waitForTimeout(60);
  },
  focusCanvas: (page) => page.evaluate(() => window.harness.pc.focus()),
  shot: (page, name, clip) => page.screenshot({ path: path.join(shots, `pixel-${name}.png`), ...(clip ? { clip } : {}) }),
};

const BLACK = [0, 0, 0, 255];
const RED = [255, 0, 0, 255];
const BLUE = [0, 0, 255, 255];
const CLEAR = [0, 0, 0, 0];

try {
  // ------------------------------------------------------------------ drawing
  {
    const { page, context, errors } = await openPage();
    await H.load(page, 16, 16);
    await page.evaluate(() => { const p = window.harness.pc; p.setTool('pencil'); p.setColor([0, 0, 0, 255]); });

    await H.click(page, 2, 3);
    check('pointer focus does not show the keyboard focus ring', await page.evaluate(() => document.activeElement === window.harness.pc.element && getComputedStyle(window.harness.pc.element).boxShadow === 'none'));
    check('pencil click paints one pixel', eq(await H.px(page, 2, 3), BLACK) && eq(await H.px(page, 3, 3), CLEAR));
    check('change emitted once per stroke', (await page.evaluate(() => window.harness.events.change)) === 1);

    await H.drag(page, [[0, 0], [15, 0]]);
    const row0 = await page.evaluate(() => { const r = []; for (let x = 0; x < 16; x++) r.push(window.harness.px(x, 0)[3]); return r; });
    check('fast drag is interpolated into a continuous line', row0.every((a) => a === 255), JSON.stringify(row0));
    check('stroke commits a single change', (await page.evaluate(() => window.harness.events.change)) === 2);

    await page.evaluate(() => window.harness.pc.undo());
    check('undo removes the last stroke', eq(await H.px(page, 7, 0), CLEAR) && eq(await H.px(page, 2, 3), BLACK));
    await page.evaluate(() => window.harness.pc.redo());
    check('redo restores it', eq(await H.px(page, 7, 0), BLACK));

    await H.click(page, 2, 3, { button: 'right' });
    check('right click paints the secondary colour (transparent = erase)', eq(await H.px(page, 2, 3), CLEAR));

    // Shift+click line from the last point
    await H.click(page, 3, 5);
    await page.keyboard.down('Shift');
    await H.click(page, 9, 5);
    await page.keyboard.up('Shift');
    const row5 = await page.evaluate(() => { const r = []; for (let x = 3; x <= 9; x++) r.push(window.harness.px(x, 5)[3]); return r; });
    check('shift+click draws a line from the last point', row5.every((a) => a === 255), JSON.stringify(row5));

    // Rect + fill inside
    await H.load(page, 16, 16);
    await page.evaluate(() => { const p = window.harness.pc; p.setTool('rect'); p.setColor([255, 0, 0, 255]); });
    await H.drag(page, [[4, 4], [8, 7], [10, 10]], { steps: 3 });
    const rectOk = eq(await H.px(page, 4, 4), RED) && eq(await H.px(page, 10, 10), RED) && eq(await H.px(page, 7, 10), RED) && eq(await H.px(page, 7, 7), CLEAR);
    check('rectangle tool draws an outline (live preview leaves no trail)', rectOk && eq(await H.px(page, 8, 7), CLEAR));
    await page.evaluate(() => { const p = window.harness.pc; p.setTool('fill'); p.setColor([0, 0, 255, 255]); });
    await H.click(page, 7, 7);
    check('fill fills inside the outline only', eq(await H.px(page, 5, 5), BLUE) && eq(await H.px(page, 9, 9), BLUE) && eq(await H.px(page, 1, 1), CLEAR) && eq(await H.px(page, 4, 7), RED));
    await page.evaluate(() => { window.harness.pc.fillContiguous = false; window.harness.pc.setColor([0, 255, 0, 255]); });
    await H.click(page, 0, 0);
    check('global fill replaces every matching pixel', eq(await H.px(page, 15, 15), [0, 255, 0, 255]) && eq(await H.px(page, 5, 5), BLUE));
    await page.evaluate(() => { window.harness.pc.fillContiguous = true; });

    // Ellipse with shift = circle
    await H.load(page, 16, 16);
    await page.evaluate(() => { const p = window.harness.pc; p.setTool('ellipse'); p.setColor([255, 0, 0, 255]); });
    await page.keyboard.down('Shift');
    await H.drag(page, [[2, 2], [12, 8]], { steps: 2 });
    await page.keyboard.up('Shift');
    const ell = await page.evaluate(() => window.harness.getImage());
    let minX = 99, maxX = -1, minY = 99, maxY = -1;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (ell.data[(y * 16 + x) * 4 + 3]) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    check('shift constrains the ellipse to a circle', eq([minX, minY, maxX, maxY], [2, 2, 12, 12]), JSON.stringify([minX, minY, maxX, maxY]));

    // Brush size + mirror
    await H.load(page, 16, 16);
    await page.evaluate(() => { const p = window.harness.pc; p.setTool('pencil'); p.setColor([0, 0, 0, 255]); p.setBrushSize(3); p.setMirror(true, false); });
    await H.click(page, 2, 2);
    const b3 = await page.evaluate(() => { const o = []; for (let y = 0; y < 5; y++) for (let x = 0; x < 16; x++) if (window.harness.px(x, y)[3]) o.push(`${x},${y}`); return o; });
    check('brush size 3 + mirror X paints two 3x3 blocks', b3.length === 18 && b3.includes('1,1') && b3.includes('3,3') && b3.includes('14,2') && b3.includes('12,3'), b3.join(' '));
    await page.evaluate(() => { const p = window.harness.pc; p.setBrushSize(1); p.setMirror(false, false); });

    // Alt temporary picker
    await H.load(page, 16, 16, [10, 200, 30, 255]);
    await page.evaluate(() => window.harness.pc.setColor([0, 0, 0, 255]));
    await page.keyboard.down('Alt');
    await H.click(page, 6, 6);
    await page.keyboard.up('Alt');
    check('alt+click picks the colour without painting', eq(await page.evaluate(() => window.harness.pc.color), [10, 200, 30, 255]) && eq(await H.px(page, 6, 6), [10, 200, 30, 255]));
    check('colorpick event fired', (await page.evaluate(() => window.harness.events.colorpick.length)) >= 1);
    check('tool unchanged after temporary pick', (await page.evaluate(() => window.harness.pc.tool)) === 'pencil');

    // Lighten / darken
    await H.load(page, 16, 16, [100, 100, 100, 255]);
    await page.evaluate(() => { const p = window.harness.pc; p.setTool('lighten'); p.setShadeStrength(0.5); });
    await H.drag(page, [[1, 1], [4, 1], [1, 1]]);
    check('lighten applies once per stroke even when scrubbing back', eq(await H.px(page, 2, 1), [178, 178, 178, 255]), JSON.stringify(await H.px(page, 2, 1)));
    await H.click(page, 8, 8, { button: 'right' });
    check('right click with lighten darkens', eq(await H.px(page, 8, 8), [50, 50, 50, 255]));

    // Mask
    await H.load(page, 16, 16);
    await page.evaluate(() => { const p = window.harness.pc; p.setTool('pencil'); p.setColor([255, 0, 0, 255]); document.getElementById('mask').click(); });
    await H.drag(page, [[2, 8], [13, 8]]);
    const maskRow = await page.evaluate(() => { const r = []; for (let x = 0; x < 16; x++) r.push(window.harness.px(x, 8)[3] ? 1 : 0); return r.join(''); });
    check('mask keeps locked pixels untouched', maskRow === '0011111100000000', maskRow);
    await page.evaluate(() => { const p = window.harness.pc; p.setTool('fill'); p.setColor([0, 0, 255, 255]); });
    await H.click(page, 1, 1);
    check('fill respects the mask', eq(await H.px(page, 1, 1), BLUE) && eq(await H.px(page, 12, 1), CLEAR));
    await page.evaluate(() => { const p = window.harness.pc; p.setTool('pencil'); p.setColor([255, 0, 0, 255]); });
    await H.click(page, 1, 3);
    await page.evaluate(() => window.harness.pc.flipH());
    check('flip with a mask and no selection flips inside the editable area', eq(await H.px(page, 6, 3), RED) && eq(await H.px(page, 1, 3), BLUE) && eq(await H.px(page, 14, 3), CLEAR));
    await page.evaluate(() => document.getElementById('mask').click());

    // Tiled wrap
    await H.load(page, 16, 16);
    await page.evaluate(() => { const p = window.harness.pc; p.setTool('pencil'); p.setColor([0, 0, 0, 255]); p.setTiledPreview(true); p.setZoom(8); });
    await H.click(page, -1, 4);
    check('tiled preview wraps painting across edges', eq(await H.px(page, 15, 4), BLACK));
    await page.evaluate(() => window.harness.pc.setTiledPreview(false));

    // Channel modes
    await H.load(page, 4, 4, [10, 20, 30, 0]);
    await page.evaluate(() => { const p = window.harness.pc; p.setChannelMode('rgb'); p.setTool('pencil'); p.setColor([200, 100, 50, 255]); });
    await H.click(page, 1, 1);
    check('rgb channel mode paints colour and keeps alpha', eq(await H.px(page, 1, 1), [200, 100, 50, 0]));
    await page.evaluate(() => { const p = window.harness.pc; p.setChannelMode('alpha'); p.setColor([255, 255, 255, 255]); });
    await H.click(page, 2, 2);
    check('alpha channel mode paints alpha only', eq(await H.px(page, 2, 2), [10, 20, 30, 255]));
    await page.evaluate(() => window.harness.pc.setChannelMode('rgba'));

    check('no page errors while drawing', errors.length === 0, errors.join(' | '));
    await context.close();
  }

  // ------------------------------------------------------------------ selection / move / transforms
  {
    const { page, context, errors } = await openPage();
    await H.load(page, 16, 16);
    await page.evaluate(() => {
      const p = window.harness.pc;
      p.setTool('rect-fill');
      p.setColor([255, 0, 0, 255]);
    });
    await H.drag(page, [[2, 2], [5, 5]], { steps: 2 });
    await page.evaluate(() => window.harness.pc.setTool('select'));
    await H.drag(page, [[2, 2], [5, 5]], { steps: 2 });
    check('marquee selection', eq(await page.evaluate(() => window.harness.pc.getSelection()), { x: 2, y: 2, w: 4, h: 4 }));
    await page.evaluate(() => { window.harness.pc.setTool('move'); window.harness.events.change = 0; });
    await H.drag(page, [[3, 3], [6, 3], [9, 4]], { steps: 3 });
    check('move drags the selected pixels', eq(await H.px(page, 8, 3), RED) && eq(await H.px(page, 11, 6), RED) && eq(await H.px(page, 2, 2), CLEAR) && eq(await H.px(page, 7, 2), CLEAR));
    check('move emits change on release', (await page.evaluate(() => window.harness.events.change)) === 1);
    check('selection follows the moved pixels', eq(await page.evaluate(() => window.harness.pc.getSelection()), { x: 8, y: 3, w: 4, h: 4 }));
    await H.drag(page, [[9, 4], [15, 4]], { steps: 3 });
    await H.drag(page, [[15, 4], [5, 4]], { steps: 3 });
    check('moving off-canvas and back keeps the lifted pixels', eq(await H.px(page, 4, 3), RED) && eq(await H.px(page, 7, 6), RED));
    await page.keyboard.press('Enter');
    await page.evaluate(() => window.harness.pc.undo());
    check('undo steps back one drag', eq(await H.px(page, 11, 6), CLEAR) && eq(await page.evaluate(() => window.harness.pc.getSelection()), { x: 14, y: 3, w: 4, h: 4 }));
    await page.evaluate(() => { const p = window.harness.pc; p.undo(); p.undo(); });
    check('undo all moves returns to the original', eq(await H.px(page, 2, 2), RED) && eq(await H.px(page, 8, 3), CLEAR) && eq(await page.evaluate(() => window.harness.pc.getSelection()), { x: 2, y: 2, w: 4, h: 4 }));

    // Keyboard nudge + flip of selection
    await H.focusCanvas(page);
    await page.evaluate(() => window.harness.pc.setTool('select'));
    await page.keyboard.press('ArrowRight');
    check('arrow keys nudge the selection', eq(await H.px(page, 6, 2), RED) && eq(await H.px(page, 2, 2), CLEAR));
    await page.keyboard.press('Escape');
    check('escape deselects', (await page.evaluate(() => window.harness.pc.getSelection())) === null);

    // Whole-image transforms
    await H.load(page, 4, 2);
    await page.evaluate(() => { const p = window.harness.pc; p.setTool('pencil'); p.setColor([255, 0, 0, 255]); });
    await H.click(page, 0, 0);
    await page.evaluate(() => window.harness.pc.flipH());
    check('flip H whole image', eq(await H.px(page, 3, 0), RED) && eq(await H.px(page, 0, 0), CLEAR));
    await page.evaluate(() => window.harness.pc.flipV());
    check('flip V whole image', eq(await H.px(page, 3, 1), RED));
    await H.load(page, 4, 4);
    await H.click(page, 0, 0);
    await page.evaluate(() => window.harness.pc.rotate90());
    check('rotate 90 clockwise', eq(await H.px(page, 3, 0), RED));
    await page.evaluate(() => { const p = window.harness.pc; p.setSelection({ x: 2, y: 0, w: 2, h: 2 }); p.flipH(); });
    check('flip applies to the selection only', eq(await H.px(page, 2, 0), RED) && eq(await H.px(page, 3, 0), CLEAR));
    await page.evaluate(() => window.harness.pc.deselect());

    // Copy / paste / clear / filter
    await H.load(page, 8, 8);
    await H.click(page, 1, 1);
    await page.evaluate(() => { const p = window.harness.pc; p.setSelection({ x: 0, y: 0, w: 3, h: 3 }); p.copy(); p.deselect(); p.paste(); });
    check('paste creates a movable selection and switches to move', (await page.evaluate(() => window.harness.pc.tool)) === 'move');
    await H.drag(page, [[3, 3], [7, 7]], { steps: 2 });
    check('pasted pixels move without destroying the original', eq(await H.px(page, 1, 1), RED) && eq(await H.px(page, 7, 7), RED) && eq(await H.px(page, 3, 3), CLEAR));
    await page.evaluate(() => { const p = window.harness.pc; p.commitSelection(); p.selectAll(); p.clear(); p.deselect(); });
    check('clear empties the selection', eq(await H.px(page, 1, 1), CLEAR) && eq(await H.px(page, 7, 7), CLEAR));
    await page.evaluate(() => window.harness.pc.undo());
    check('clear is undoable', eq(await H.px(page, 1, 1), RED));
    await page.evaluate(() => document.getElementById('invert').click());
    check('applyFilter is applied and undoable', eq(await H.px(page, 1, 1), [0, 255, 255, 255]));
    await page.evaluate(() => window.harness.pc.undo());
    check('applyFilter undo', eq(await H.px(page, 1, 1), RED));
    check('undo restores the selection that was active', eq(await page.evaluate(() => window.harness.pc.getSelection()), { x: 0, y: 0, w: 8, h: 8 }));
    await page.evaluate(() => { const p = window.harness.pc; p.deselect(); p.applyFilter((img) => new ImageData(img.width * 2, img.height * 2)); });
    check('applyFilter can change the image size', eq(await page.evaluate(() => [window.harness.pc.width, window.harness.pc.height]), [16, 16]));
    await page.evaluate(() => window.harness.pc.undo());
    check('size change is undoable', eq(await page.evaluate(() => [window.harness.pc.width, window.harness.pc.height]), [8, 8]) && eq(await H.px(page, 1, 1), RED));

    // Keyboard copy/paste through clipboard events
    await H.load(page, 8, 8);
    await page.evaluate(() => { const p = window.harness.pc; p.setTool('pencil'); p.setColor([255, 0, 0, 255]); });
    await H.click(page, 0, 0);
    await H.focusCanvas(page);
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Control+c');
    await page.keyboard.press('Delete');
    check('ctrl+a, delete clears everything', eq(await H.px(page, 0, 0), CLEAR));
    await page.keyboard.press('Control+z');
    check('ctrl+z undoes the delete', eq(await H.px(page, 0, 0), RED));
    await page.keyboard.press('Control+Shift+z');
    check('ctrl+shift+z redoes', eq(await H.px(page, 0, 0), CLEAR));
    await page.keyboard.press('Control+y');

    check('no page errors in selection tests', errors.length === 0, errors.join(' | '));
    await context.close();
  }

  // ------------------------------------------------------------------ keyboard, zoom, history depth
  {
    const { page, context, errors } = await openPage();
    await H.load(page, 16, 16);
    await H.focusCanvas(page);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    check('keyboard cursor: arrows + Enter paint without a pointer', eq(await H.px(page, 9, 8), BLACK), JSON.stringify(await H.px(page, 9, 8)));
    check('keyboard focus shows the focus ring', await page.evaluate(() => getComputedStyle(window.harness.pc.element).boxShadow !== 'none'));
    await H.shot(page, 'keyboard-cursor');
    await page.keyboard.press('Escape');
    const seq = [['g', 'fill'], ['i', 'picker'], ['l', 'line'], ['u', 'rect'], ['u', 'rect-fill'], ['o', 'ellipse'], ['m', 'select'], ['v', 'move'], ['e', 'eraser'], ['b', 'pencil']];
    let allTools = true;
    for (const [k, t] of seq) {
      await page.keyboard.press(k);
      if ((await page.evaluate(() => window.harness.pc.tool)) !== t) allTools = false;
    }
    check('tool shortcuts', allTools);
    check('tool events emitted for shortcuts', (await page.evaluate(() => window.harness.events.tool.length)) >= seq.length);
    await page.keyboard.press(']');
    await page.keyboard.press(']');
    await page.keyboard.press('[');
    check('[ and ] change brush size', (await page.evaluate(() => window.harness.pc.brushSize)) === 2);
    await page.evaluate(() => { const p = window.harness.pc; p.setColor([1, 2, 3, 255]); p.setSecondaryColor([4, 5, 6, 255]); });
    await page.keyboard.press('x');
    check('x swaps colours', eq(await page.evaluate(() => [window.harness.pc.color, window.harness.pc.secondaryColor]), [[4, 5, 6, 255], [1, 2, 3, 255]]));
    const grid0 = await page.evaluate(() => window.harness.pc.showGrid);
    await page.keyboard.press('#');
    check('# toggles the grid', (await page.evaluate(() => window.harness.pc.showGrid)) === !grid0);
    await page.keyboard.press('#');

    await page.click('#text');
    await page.keyboard.type('bge');
    check('shortcuts are ignored while typing in inputs', (await page.evaluate(() => window.harness.pc.tool)) === 'pencil');
    await page.evaluate(() => document.activeElement.blur());
    await page.keyboard.press('e');
    check('shortcuts work again when the page has focus', (await page.evaluate(() => window.harness.pc.tool)) === 'eraser');
    await page.click('#fliph');
    await page.keyboard.press('b');
    check('shortcuts work after clicking a toolbar button', (await page.evaluate(() => window.harness.pc.tool)) === 'pencil');
    await page.evaluate(() => {
      const r = document.createElement('input');
      r.type = 'range'; r.min = '1'; r.max = '10'; r.value = '5'; r.id = 'range';
      document.getElementById('side').append(r);
    });
    await page.focus('#range');
    await page.keyboard.press('e');
    await page.keyboard.press('ArrowRight');
    check('shortcuts work while a slider has focus, arrows still move the slider', (await page.evaluate(() => [window.harness.pc.tool, document.getElementById('range').value].join())) === 'eraser,6');
    await page.keyboard.press('b');
    await page.evaluate(() => document.getElementById('range').remove());

    // Zoom
    await page.keyboard.press('0');
    const fit = await page.evaluate(() => window.harness.pc.getZoom());
    const [cx, cy] = await H.client(page, 3, 3);
    await page.mouse.move(cx, cy);
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(50);
    const z1 = await page.evaluate(() => window.harness.pc.getZoom());
    const [ax, ay] = await H.client(page, 3, 3);
    check('wheel zooms in', z1 > fit, `${fit} -> ${z1}`);
    check('wheel zoom keeps the pixel under the cursor', Math.abs(ax - cx) < z1 && Math.abs(ay - cy) < z1, `${cx},${cy} vs ${ax},${ay}`);
    await page.keyboard.press('-');
    await page.keyboard.press('-');
    check('- zooms out', (await page.evaluate(() => window.harness.pc.getZoom())) < z1);
    await page.keyboard.press('0');
    check('0 fits the image', (await page.evaluate(() => window.harness.pc.getZoom())) === fit);
    const crisp = await page.evaluate(() => { const p = window.harness.pc; p.setZoom(7.3); return p.getZoom() * devicePixelRatio; });
    check('zoom snaps to whole device pixels', Number.isInteger(crisp), String(crisp));

    // Space-drag pan
    await page.keyboard.press('0');
    await page.evaluate(() => { window.harness.events.change = 0; });
    const v0 = await page.evaluate(() => window.harness.pc.getView());
    await page.mouse.move(400, 400);
    await page.keyboard.down(' ');
    await page.mouse.down();
    await page.mouse.move(450, 430, { steps: 3 });
    await page.mouse.up();
    await page.keyboard.up(' ');
    const v1 = await page.evaluate(() => window.harness.pc.getView());
    check('space + drag pans without painting', Math.round(v1.offsetX - v0.offsetX) === 50 && Math.round(v1.offsetY - v0.offsetY) === 30 && (await page.evaluate(() => window.harness.events.change)) === 0, JSON.stringify([v0, v1]));
    // Middle drag pan
    await page.mouse.move(450, 430);
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(430, 430, { steps: 2 });
    await page.mouse.up({ button: 'middle' });
    const v2 = await page.evaluate(() => window.harness.pc.getView());
    check('middle drag pans', Math.round(v2.offsetX - v1.offsetX) === -20);

    // History depth for 64x64
    await H.load(page, 64, 64);
    const depth = await page.evaluate(() => {
      const p = window.harness.pc;
      p.setColor([255, 0, 0, 255]);
      for (let i = 0; i < 150; i++) p.applyFilter((img) => { img.data[(i % 4096) * 4 + 3] = 255; img.data[(i % 4096) * 4] = i; return img; });
      let n = 0;
      while (p.canUndo()) { p.undo(); n++; }
      return n;
    });
    check('>= 100 undo steps on 64x64', depth >= 100, String(depth));
    const fullDepth = await page.evaluate(() => {
      const p = window.harness.pc;
      p.setImage(new ImageData(512, 512));
      for (let i = 0; i < 40; i++) p.applyFilter((img) => { for (let k = 0; k < img.data.length; k += 4) img.data[k] = (img.data[k] + 7) & 255; img.data[3] = 255; return img; });
      let n = 0;
      while (p.canUndo()) { p.undo(); n++; }
      return n;
    });
    check('512x512 full-image edits keep a useful history within the memory budget', fullDepth >= 16, String(fullDepth));

    check('no page errors in keyboard tests', errors.length === 0, errors.join(' | '));
    await context.close();
  }

  // ------------------------------------------------------------------ performance at 512x512
  {
    const { page, context, errors } = await openPage({}, '?size=512');
    const perf = await page.evaluate(async () => {
      const p = window.harness.pc;
      p.setShowGrid(true);
      p.setZoom(4);
      const t0 = performance.now();
      for (let i = 0; i < 60; i++) p['render']();
      const renderMs = (performance.now() - t0) / 60;
      p.setTool('fill');
      p.setColor([255, 0, 255, 255]);
      p.fillContiguous = false;
      p.fillTolerance = 40;
      const t1 = performance.now();
      p['doFill'](100, 100, false);
      const fillMs = performance.now() - t1;
      return { renderMs, fillMs };
    });
    check('512x512 frame renders in < 8 ms', perf.renderMs < 8, JSON.stringify(perf));
    check('512x512 global fill + commit in < 150 ms', perf.fillMs < 150, JSON.stringify(perf));
    await page.evaluate(() => { const p = window.harness.pc; p.setTool('pencil'); p.setBrushSize(8); p.zoomToFit(); });
    const t = Date.now();
    await H.drag(page, [[10, 10], [500, 400], [20, 480]], { steps: 40 });
    const strokeMs = Date.now() - t;
    check('long brush stroke on 512x512 stays responsive', strokeMs < 3000, `${strokeMs} ms`);
    check('stroke painted', eq(await H.px(page, 255, 205), [255, 0, 255, 255]) || (await H.px(page, 255, 205))[3] === 255);
    await H.shot(page, '512-fit');
    check('no page errors at 512', errors.length === 0, errors.join(' | '));
    await context.close();
  }

  // ------------------------------------------------------------------ touch: pinch zoom, two-finger tap undo
  {
    const { page, context, errors } = await openPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
    await H.load(page, 16, 16);
    await page.evaluate(() => { const p = window.harness.pc; p.setTool('pencil'); p.setColor([0, 0, 0, 255]); });
    const [tx, ty] = await H.client(page, 4, 4);
    await page.touchscreen.tap(tx, ty);
    check('tap paints on touch screens', eq(await H.px(page, 4, 4), BLACK));
    const cdp = await context.newCDPSession(page);
    const z0 = await page.evaluate(() => window.harness.pc.getZoom());
    const [mx, my] = await H.client(page, 8, 8);
    const pts = (d) => [{ x: mx - d, y: my, id: 1 }, { x: mx + d, y: my, id: 2 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(20) });
    for (let d = 24; d <= 80; d += 8) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(d) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(50);
    const z1 = await page.evaluate(() => window.harness.pc.getZoom());
    check('pinch zooms in', z1 > z0 * 1.5, `${z0} -> ${z1}`);
    check('pinch does not paint', (await page.evaluate(() => window.harness.pc.getImage().data.filter((v, i) => i % 4 === 3 && v).length)) === 1);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(30) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(50);
    check('two-finger tap undoes', eq(await H.px(page, 4, 4), CLEAR));
    await page.evaluate(() => window.harness.pc.zoomToFit());
    await H.shot(page, 'phone');
    check('no page errors on touch', errors.length === 0, errors.join(' | '));
    await context.close();
  }

  // ------------------------------------------------------------------ review regressions
  {
    const { page, context, errors } = await openPage();
    const dragPx = async (from, to) => {
      const [sx, sy] = await H.client(page, from[0], from[1]);
      const [ex, ey] = await H.client(page, to[0], to[1]);
      await page.mouse.move(sx, sy);
      await page.mouse.down();
      await page.mouse.move(ex, ey, { steps: 3 });
      await page.mouse.up();
    };

    // Colour hidden under alpha 0 (Bedrock tint masks) must survive moving a selection away and back.
    await page.evaluate(() => {
      const p = window.harness.pc;
      const img = new ImageData(8, 8);
      for (let i = 0; i < 64; i++) img.data.set([10, 200, 30, 0], i * 4);
      img.data.set([255, 0, 0, 255], 0);
      p.setImage(img);
      p.setSelection({ x: 0, y: 0, w: 2, h: 2 });
      p.setTool('move');
    });
    const [ox0, oy0] = await H.client(page, 0, 0);
    const [ox1, oy1] = await H.client(page, 3, 0);
    await page.mouse.move(ox0, oy0);
    await page.mouse.down();
    await page.mouse.move(ox1, oy1, { steps: 3 });
    await page.mouse.move(ox0, oy0, { steps: 3 });
    await page.mouse.up();
    check('hidden colour under alpha 0 survives moving a selection away and back', eq(await H.px(page, 1, 1), [10, 200, 30, 0]) && eq(await H.px(page, 0, 0), RED), JSON.stringify(await H.px(page, 1, 1)));
    await dragPx([0, 0], [4, 4]);
    check('moved transparent pixels keep their hidden colour over empty pixels', eq(await H.px(page, 5, 5), [10, 200, 30, 0]) && eq(await H.px(page, 4, 4), RED));
    await page.evaluate(() => window.harness.pc.commitSelection());

    // A pen's eraser end while a selection floats must not be undone by the next move.
    await page.evaluate(() => {
      const p = window.harness.pc;
      window.harness.load(8, 8, [0, 0, 255, 255]);
      p.setSelection({ x: 0, y: 0, w: 4, h: 4 });
      p.setTool('move');
    });
    await dragPx([1, 1], [4, 4]);
    await page.evaluate(([x, y]) => {
      const c = window.harness.pc.element.querySelector('canvas');
      const o = { pointerId: 9, pointerType: 'pen', clientX: x, clientY: y, button: 5, buttons: 32, bubbles: true };
      c.dispatchEvent(new PointerEvent('pointerdown', o));
      c.dispatchEvent(new PointerEvent('pointerup', { ...o, buttons: 0 }));
    }, await H.client(page, 5, 5));
    check('pen eraser erases while the move tool is active', eq(await H.px(page, 5, 5), CLEAR));
    await dragPx([5, 4], [6, 4]);
    check('the erased pixel is not restored by the next move', eq(await H.px(page, 5, 5), CLEAR) || eq(await H.px(page, 6, 5), CLEAR));
    await page.evaluate(() => window.harness.pc.deselect());

    // Rotating a thin selection at the top edge keeps every pixel on the canvas.
    await page.evaluate(() => {
      const p = window.harness.pc;
      window.harness.load(8, 8);
      const img = p.getImage();
      for (let x = 0; x < 4; x++) img.data.set([255, 0, 0, 255], (1 * 8 + x) * 4);
      p.setImage(img);
      p.setSelection({ x: 0, y: 1, w: 4, h: 1 });
      p.rotate90();
      p.commitSelection();
    });
    const redCount = await page.evaluate(() => window.harness.pc.getImage().data.filter((v, i) => i % 4 === 3 && v).length);
    check('rotating a selection near an edge keeps all its pixels', redCount === 4, String(redCount));
    check('rotated selection stays inside the image', eq(await page.evaluate(() => window.harness.pc.getSelection()), { x: 1, y: 0, w: 1, h: 4 }), JSON.stringify(await page.evaluate(() => window.harness.pc.getSelection())));
    await page.evaluate(() => window.harness.pc.deselect());

    // Hiding the editor (collapsed panel, phone tab) and showing it again keeps the view.
    await page.evaluate(() => { window.harness.load(16, 16); window.harness.pc.setZoom(20); });
    const vh0 = await page.evaluate(() => window.harness.pc.getView());
    await page.evaluate(() => { document.getElementById('stage').style.display = 'none'; });
    await page.waitForTimeout(120);
    await page.evaluate(() => { document.getElementById('stage').style.display = ''; });
    await page.waitForTimeout(120);
    const vh1 = await page.evaluate(() => window.harness.pc.getView());
    check('hiding and showing the editor keeps the view', vh0.offsetX === vh1.offsetX && vh0.offsetY === vh1.offsetY && vh0.scale === vh1.scale, JSON.stringify([vh0, vh1]));

    // Device pixel ratio changes (another monitor, browser zoom) resize the backing store and keep the view.
    const [c8x, c8y] = await H.client(page, 8, 8);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 760, deviceScaleFactor: 1, mobile: false });
    await page.waitForTimeout(250);
    const dprState = await page.evaluate(() => {
      const p = window.harness.pc;
      const c = p.element.querySelector('canvas');
      return { backing: c.width, css: Math.round(c.getBoundingClientRect().width), zoom: p.getZoom() };
    });
    const [d8x, d8y] = await H.client(page, 8, 8);
    check('a device pixel ratio change resizes the backing canvas', dprState.backing === dprState.css, JSON.stringify(dprState));
    check('a device pixel ratio change keeps zoom and position', dprState.zoom === 20 && Math.abs(d8x - c8x) <= 1 && Math.abs(d8y - c8y) <= 1, JSON.stringify([c8x, c8y, d8x, d8y]));
    await cdp.send('Emulation.clearDeviceMetricsOverride');
    await page.waitForTimeout(150);

    // Undo with nothing to undo leaves a floating paste alone.
    const floatKept = await page.evaluate(() => {
      const p = window.harness.pc;
      window.harness.load(8, 8);
      p.clearHistory();
      p.pasteImage(new ImageData(new Uint8ClampedArray([255, 0, 0, 255]), 1, 1), { x: 2, y: 2 });
      p.undo();
      p.undo();
      const after = [p.getSelection(), p.canUndo(), window.harness.px(2, 2).join()];
      p.deselect();
      return after;
    });
    check('undo of a paste restores the selection; extra undo is a no-op', eq(floatKept, [null, false, '0,0,0,0']), JSON.stringify(floatKept));

    // Letters typed in a listbox (type-ahead) are not tool shortcuts.
    await page.evaluate(() => {
      const lb = document.createElement('div');
      lb.setAttribute('role', 'listbox');
      lb.tabIndex = 0;
      lb.id = 'lb';
      lb.textContent = 'list';
      document.getElementById('side').append(lb);
      window.harness.pc.setTool('pencil');
      window.harness.pc.setSelection({ x: 0, y: 0, w: 2, h: 2 });
    });
    await page.focus('#lb');
    await page.keyboard.press('e');
    await page.keyboard.press('Delete');
    check('shortcuts are ignored in list boxes', (await page.evaluate(() => window.harness.pc.tool)) === 'pencil' && !!(await page.evaluate(() => window.harness.pc.getSelection())));
    await page.evaluate(() => { document.getElementById('lb').remove(); window.harness.pc.deselect(); });

    // A canvas built while detached picks up theme colours once it is attached.
    const themed = await page.evaluate(async () => {
      document.documentElement.dataset.theme = 'light';
      const holder = document.createElement('div');
      holder.style.cssText = 'position:fixed;left:0;top:0;width:200px;height:200px';
      const Ctor = window.harness.pc.constructor;
      const pc2 = new Ctor(holder, { image: new ImageData(4, 4) });
      document.body.append(holder);
      await new Promise((r) => setTimeout(r, 150));
      const colors = pc2['colors'];
      pc2.destroy();
      holder.remove();
      document.documentElement.dataset.theme = 'dark';
      return colors;
    });
    const pending = await page.evaluate(async () => {
      const holder = document.createElement('div');
      holder.style.cssText = 'position:fixed;left:0;top:0;width:300px;height:300px';
      const pc2 = new (window.harness.pc.constructor)(holder, { image: new ImageData(16, 16) });
      pc2.setZoom(4);
      document.body.append(holder);
      await new Promise((r) => setTimeout(r, 150));
      const z = pc2.getZoom();
      pc2.destroy();
      holder.remove();
      return z;
    });
    check('setZoom before the canvas is laid out is applied once it is', pending === 4, String(pending));
    check('canvas built while detached uses the light theme colours once attached', themed.a === '#dfe3ea' && themed.b === '#eceef3', JSON.stringify(themed));

    // Transparency checkerboard follows the pixel grid when zoomed in.
    await page.mouse.move(2, 2);
    await page.evaluate(() => { window.harness.load(16, 16); window.harness.pc.setShowGrid(false); window.harness.pc.setZoom(20); });
    await page.waitForTimeout(80);
    const cells = await page.evaluate(() => {
      const p = window.harness.pc;
      const c = p.element.querySelector('canvas');
      const g = c.getContext('2d');
      const v = p.getView();
      const d = devicePixelRatio;
      const at = (x, y) => { const [sx, sy] = v.toScreen(x, y); return Array.from(g.getImageData(Math.round(sx * d), Math.round(sy * d), 1, 1).data).join(','); };
      return [at(2.25, 2.25), at(2.75, 2.25), at(2.25, 2.75), at(3.25, 2.25), at(2.25, 3.25)];
    });
    check('checkerboard cells are aligned to image pixels', cells[0] !== cells[1] && cells[1] === cells[2] && cells[0] === cells[3] && cells[0] === cells[4], JSON.stringify(cells));
    await page.evaluate(() => window.harness.pc.setShowGrid(true));

    // History stays within a hard memory cap for large images.
    const bigDepth = await page.evaluate(() => {
      const p = window.harness.pc;
      p.setImage(new ImageData(2048, 2048));
      for (let i = 0; i < 20; i++) p.applyFilter((img) => { img.data[0] = i + 1; img.data[img.data.length - 1] = i + 1; return img; });
      const bytes = p['undoStack'].reduce((t, e) => t + e.data.byteLength, 0);
      return { steps: p['undoStack'].length, mb: Math.round(bytes / 1048576) };
    });
    check('history of a 2048x2048 image stays under the hard memory cap', bigDepth.mb <= 192 && bigDepth.steps >= 1, JSON.stringify(bigDepth));
    await page.evaluate(() => window.harness.load(16, 16));

    check('no page errors in review regressions', errors.length === 0, errors.join(' | '));
    await context.close();
  }

  // ------------------------------------------------------------------ screenshots
  {
    const { page, context } = await openPage();
    await page.evaluate(() => { const p = window.harness.pc; p.setTool('pencil'); p.setColor([240, 200, 60, 255]); p.setBrushSize(2); });
    await H.hover(page, 6.2, 9.4);
    await H.shot(page, 'editor-16');

    await page.evaluate(() => { window.harness.loadSample(64); const p = window.harness.pc; p.setMirror(true, true); p.setBrushSize(5); p.setBrushShape('round'); p.setColor([230, 80, 80, 255]); });
    await H.hover(page, 18, 22);
    await H.shot(page, 'mirror-brush-64');

    await page.evaluate(() => { const p = window.harness.pc; p.setMirror(false, false); p.setBrushSize(1); p.setTool('select'); });
    await H.drag(page, [[10, 30], [30, 44]], { steps: 3 });
    await page.evaluate(() => window.harness.pc.setTool('move'));
    await H.drag(page, [[15, 35], [22, 28]], { steps: 3 });
    await page.mouse.move(5, 5);
    await H.shot(page, 'selection-move');

    await page.evaluate(() => { window.harness.loadSample(16); const p = window.harness.pc; p.deselect(); p.setTiledPreview(true); p.setTool('pencil'); p.setZoom(10); });
    await H.hover(page, 15, 3);
    await H.shot(page, 'tiled');

    await page.evaluate(() => { const p = window.harness.pc; p.setTiledPreview(false); window.harness.loadSample(64); document.getElementById('mask').click(); document.getElementById('overlay').click(); p.setTool('picker'); });
    await H.hover(page, 12, 20);
    await H.shot(page, 'mask-overlay-picker');

    await page.evaluate(() => { document.getElementById('mask').click(); document.getElementById('overlay').click(); window.harness.pc.setChannelMode('alpha'); });
    await H.shot(page, 'alpha-view');
    await page.evaluate(() => { window.harness.pc.setChannelMode('rgba'); document.getElementById('theme').click(); window.harness.pc.setTool('fill'); });
    await page.waitForTimeout(50);
    await H.hover(page, 30, 40);
    await H.shot(page, 'light-theme');
    await context.close();
  }
} catch (err) {
  check('harness run completed', false, err?.stack || String(err));
} finally {
  await browser.close();
  await server.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed. Screenshots: ${shots}`);
process.exit(failed.length ? 1 : 0);
