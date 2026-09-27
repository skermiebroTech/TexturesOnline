// End-to-end checks for painting on the 3D model in the Skin Maker (#/skins/:id): rays land on the
// right pixel of the right layer, mirror and part locks apply, a 3D stroke is one undo step, fast
// drags leave no gaps, fill / picker / eraser work on the model, the 2D template and the model stay in
// sync, the camera controls turn instead of painting, and touch painting works on phones.
// Run: NODE_PATH=$(npm root -g) node tests/e2e/skins/skins-3d.e2e.mjs [screenshotDir]
// Needs the global 'playwright' package.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const projectRequire = createRequire(path.join(root, 'package.json'));
const { decode: decodePng } = projectRequire('fast-png');

const shots = process.argv[2] || path.join(tmpdir(), 'skins-3d-e2e');
mkdirSync(shots, { recursive: true });
const executablePath = process.env.CHROMIUM_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => existsSync(p));

const server = await createServer({ root, logLevel: 'error', server: { port: 0, host: '127.0.0.1', hmr: false, watch: null } });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function newPage(opts = {}, theme = 'dark') {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme, ...opts });
  await context.addInitScript((t) => {
    try {
      localStorage.setItem('to-theme', t);
    } catch {
      /* ignore */
    }
  }, theme);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  await context.route(/playerdb\.co|textures\.minecraft\.net|mc-heads\.net/, (route) => route.abort());
  return { page, context, errors };
}

const api = (page, fn, arg) =>
  page.evaluate(
    ([f, a]) => {
      const e = document.querySelector('.sk-editor').__skinEditor;
      return new Function('e', 'a', `return (${f})(e, a)`)(e, a);
    },
    [fn.toString(), arg],
  );
const pixelAt = (page, x, y) => api(page, (e, [x, y]) => Array.from(e.getImage().data.slice((y * 64 + x) * 4, (y * 64 + x) * 4 + 4)), [x, y]);
const imageData = (page) => api(page, (e) => Array.from(e.getImage().data));
const to3d = (page, x, y) => api(page, (e, [x, y]) => e.pixelTo3d(x, y), [x, y]);
const hit3d = (page, [cx, cy]) => api(page, (e, [cx, cy]) => e.hit3d(cx, cy), [cx, cy]);

async function openStarter(page, starter) {
  await page.goto(`${base}#/skins`);
  await page.waitForSelector(`.sk-starter-${starter}`);
  await page.click(`.sk-starter-${starter}`);
  await page.waitForSelector('.sk-editor .pc-root', { timeout: 20000 });
  await page.waitForFunction(() => !!document.querySelector('.sk-editor')?.__skinEditor);
  await page.waitForSelector('.sk-3d .preview-stage canvas', { state: 'attached', timeout: 20000 });
  await page.waitForTimeout(600);
}

async function setColor(page, hex) {
  await page.fill('.sk-block-color .cp-hex', hex);
  await page.keyboard.press('Enter');
}

async function view(page, v) {
  await page.click(`.sk-view-btn[data-view="${v}"]`);
  await page.waitForTimeout(550);
}
const layer = (page, v) => page.click(`.sk-3d-paint .segmented-item[data-value="${v}"]`);
const tool = (page, t) => page.click(`.sk-3d-tools [data-tool="${t}"]`);

async function click3d(page, x, y) {
  const p = await to3d(page, x, y);
  if (!p) return null;
  await page.mouse.move(p[0], p[1]);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(120);
  return p;
}

/** Colour of the 3D view at a client point (from a screenshot, so it is what the user sees). */
async function screenColor(page, [cx, cy]) {
  const buf = await page.screenshot({ clip: { x: Math.round(cx) - 1, y: Math.round(cy) - 1, width: 3, height: 3 } });
  const img = decodePng(buf);
  const ch = img.channels;
  const i = (1 * img.width + 1) * ch;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
}

/** The 2D template canvas pixel at the centre of an image pixel (what the canvas shows). */
const canvas2dColor = (page, x, y) =>
  page.evaluate(([x, y]) => {
    const e = document.querySelector('.sk-editor').__skinEditor;
    const c = document.querySelector('.sk-canvas-host .pc-canvas');
    const r = c.getBoundingClientRect();
    const [cx, cy] = e.imageToClient(x, y);
    const d = c.getContext('2d').getImageData(Math.round(((cx - r.left) * c.width) / r.width), Math.round(((cy - r.top) * c.height) / r.height), 1, 1).data;
    return [d[0], d[1], d[2], d[3]];
  }, [x, y]);

const RED = [230, 30, 40, 255];
const GREEN = [30, 200, 60, 255];
const BLUE = [0, 0, 255, 255];
const YELLOW = [250, 210, 20, 255];
const PURPLE = [140, 40, 200, 255];

// =============================================================================================
// 1. Desktop: paint mode, layers, mirror, undo, interpolation, tools, sync, camera controls
{
  const { page, context, errors } = await newPage();
  await openStarter(page, 'explorer');

  // Enter paint mode from the switch over the stage.
  await page.click('.sk-3d-mode [data-value="paint"]');
  await page.waitForTimeout(200);
  check('paint switch turns paint mode on', (await api(page, (e) => e.paint3d())) === true);
  check(
    'paint opens the 3D model in the main editor, the template moves to the side panel',
    (await page.isVisible('.sk-center .sk-3d-wrap')) && (await page.isVisible('.sk-center .sk-3d-paint')) && (await page.isVisible('.sk-right .sk-canvas-host')),
  );
  check('the stage shows it takes paint', await page.isVisible('.sk-3d-wrap.is-painting'));
  check('spinning is disabled while painting', await page.isDisabled('.sk-canvas-bar [aria-label="Spin automatically"]'));

  await view(page, 'front');
  await setColor(page, '#e61e28');
  await tool(page, 'pencil');

  // Base layer: the ray ignores the (faded) hat and lands on the head front.
  await layer(page, 'base');
  const face = await to3d(page, 10, 12);
  check('head front pixel is on screen in the front view', !!face, String(face));
  check('ray at that point hits the head front base pixel', eq(await hit3d(page, face), { x: 10, y: 12, layer: 'base' }), JSON.stringify(await hit3d(page, face)));
  await page.mouse.move(face[0], face[1]);
  await page.waitForTimeout(150);
  check('hovering the model names the face in the status bar', /Head · Front · Base layer · 10, 12/.test((await page.textContent('.sk-status')) || ''), await page.textContent('.sk-status'));
  check('hovering the model shows it in the stage hint', /Head · Front · 10, 12/.test((await page.textContent('.sk-3d-hint')) || ''), await page.textContent('.sk-3d-hint'));
  await page.screenshot({ path: path.join(shots, 'e2e-3d-hover.png') });
  const hatFront = await pixelAt(page, 42, 12);
  const before = await imageData(page);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(150);
  check('click on the model paints the head front pixel', eq(await pixelAt(page, 10, 12), RED), JSON.stringify(await pixelAt(page, 10, 12)));
  const after = await imageData(page);
  const changed = [];
  for (let i = 0; i < after.length; i += 4) if (after.slice(i, i + 4).some((v, k) => v !== before[i + k])) changed.push(i / 4);
  check('exactly one pixel changed (1px brush)', changed.length === 1 && changed[0] === 12 * 64 + 10, JSON.stringify(changed));
  check('the hat stays as it was', eq(await pixelAt(page, 42, 12), hatFront));
  // The template highlights the face hovered on the model; move away to read the bare pixel.
  await page.mouse.move(10, 10);
  await page.waitForTimeout(150);
  check('the 2D template shows the 3D stroke at once', eq(await canvas2dColor(page, 10, 12), RED), JSON.stringify(await canvas2dColor(page, 10, 12)));
  check('a 3D stroke is undoable', await page.isEnabled('.sk-bar-actions [aria-label^="Undo"]'));

  // Both layers: empty hat pixels are looked through; opaque ones are painted.
  await layer(page, 'both');
  const hatAlpha = (await pixelAt(page, 44, 9))[3];
  const behindBrim = await to3d(page, 12, 9);
  const bothHit = behindBrim && (await hit3d(page, behindBrim));
  check('painting both layers hits what is visible (hat brim or face)', hatAlpha > 0 ? bothHit?.layer === 'outer' && bothHit.x === 44 && bothHit.y === 9 : eq(bothHit, { x: 12, y: 9, layer: 'base' }), `${hatAlpha} ${JSON.stringify(bothHit)}`);

  // Outer layer: the hat.
  await layer(page, 'outer');
  await setColor(page, '#1ec83c');
  check('outer layer: the ray hits the hat', eq(await hit3d(page, await to3d(page, 42, 12)), { x: 42, y: 12, layer: 'outer' }));
  await click3d(page, 42, 12);
  check('outer layer paints the hat pixel', eq(await pixelAt(page, 42, 12), GREEN), JSON.stringify(await pixelAt(page, 42, 12)));
  check('outer layer leaves the face under it alone', eq(await pixelAt(page, 10, 12), RED));

  // Mirror paints the other arm.
  await layer(page, 'base');
  await page.click('.sk-3d-mirror');
  check('mirror button in the 3D panel turns mirror on', (await page.getAttribute('.sk-toggle-btn', 'aria-pressed')) === 'true');
  await setColor(page, '#e61e28');
  await click3d(page, 45, 24);
  check('mirror: right arm front painted', eq(await pixelAt(page, 45, 24), RED), JSON.stringify(await pixelAt(page, 45, 24)));
  check('mirror: left arm front painted too', eq(await pixelAt(page, 38, 56), RED), JSON.stringify(await pixelAt(page, 38, 56)));
  await page.click('.sk-3d-mirror');

  // A fast drag across the face: no gaps, one undo step for the whole stroke.
  await setColor(page, '#fad214');
  const rowBefore = [];
  for (let x = 8; x < 16; x++) rowBefore.push(await pixelAt(page, x, 14));
  const a = await to3d(page, 8, 14);
  const b = await to3d(page, 15, 14);
  await page.mouse.move(a[0], a[1]);
  await page.mouse.down();
  await page.mouse.move(b[0], b[1], { steps: 2 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  const row = [];
  for (let x = 8; x < 16; x++) row.push(await pixelAt(page, x, 14));
  check('a fast drag paints every pixel along the way', row.every((c) => eq(c, YELLOW)), JSON.stringify(row));
  await page.click('.sk-bar-actions [aria-label^="Undo"]');
  const undone = [];
  for (let x = 8; x < 16; x++) undone.push(await pixelAt(page, x, 14));
  check('one undo takes back the whole 3D stroke', eq(undone, rowBefore), JSON.stringify(undone));
  check('the undo stops at the stroke (the mirror click stays)', eq(await pixelAt(page, 38, 56), RED));
  await page.click('.sk-bar-actions [aria-label^="Redo"]');
  check('redo brings the stroke back', eq(await pixelAt(page, 11, 14), YELLOW));

  // Brushes fold over box edges: a 3px brush on the left column of the face reaches the side.
  await page.click('.sk-3d-size [aria-label^="Bigger"]');
  await page.click('.sk-3d-size [aria-label^="Bigger"]');
  check('brush size shows in the 3D panel', /3 px/.test((await page.textContent('.sk-3d-size')) || ''));
  await setColor(page, '#8c28c8');
  await click3d(page, 8, 11);
  check('3px brush paints around the pixel', eq(await pixelAt(page, 8, 11), PURPLE) && eq(await pixelAt(page, 9, 12), PURPLE));
  check('3px brush wraps onto the side of the head', eq(await pixelAt(page, 7, 11), PURPLE), JSON.stringify(await pixelAt(page, 7, 11)));
  await page.click('.sk-3d-size [aria-label^="Smaller"]');
  await page.click('.sk-3d-size [aria-label^="Smaller"]');

  // Picker takes the colour into the shared colour state.
  await tool(page, 'picker');
  await click3d(page, 10, 12);
  check('eyedropper on the model picks the colour', (await page.inputValue('.sk-block-color .cp-hex')).toLowerCase() === '#e61e28', await page.inputValue('.sk-block-color .cp-hex'));
  check('eyedropper is the shared tool', (await page.getAttribute('.sk-rail-tools [data-tool="picker"]', 'aria-pressed')) === 'true');

  // Fill stays inside the clicked face.
  await setColor(page, '#ffffff');
  await page.click('.sk-part[data-part="head"] [aria-label^="More for"]');
  await page.click('.menu-item >> text=Fill head with colour');
  await setColor(page, '#0000ff');
  await tool(page, 'fill');
  await click3d(page, 10, 12);
  let faceFilled = true;
  for (let y = 8; y < 16; y++) for (let x = 8; x < 16; x++) if (!eq(await pixelAt(page, x, y), BLUE)) faceFilled = false;
  check('fill covers the clicked face', faceFilled);
  check('fill does not leak onto the top or the side', eq(await pixelAt(page, 10, 4), [255, 255, 255, 255]) && eq(await pixelAt(page, 4, 12), [255, 255, 255, 255]));

  // 2D → 3D: the model shows what the template paints (read back from the screen).
  await tool(page, 'pencil');
  await setColor(page, '#ffffff');
  const [tx, ty] = await api(page, (e) => e.imageToClient(12, 13));
  await page.mouse.move(tx, ty);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(400);
  const onModel = await to3d(page, 12, 13);
  const seen = await screenColor(page, onModel);
  const around = await screenColor(page, await to3d(page, 10, 13));
  check('template strokes show on the model', seen[0] > 150 && seen[1] > 150 && seen[2] > 150 && around[2] > around[0] + 60, `${seen} vs ${around}`);

  // Eraser on the outer layer clears hat pixels.
  await layer(page, 'outer');
  await tool(page, 'eraser');
  await click3d(page, 42, 12);
  check('eraser on the model clears the hat pixel', (await pixelAt(page, 42, 12))[3] === 0);

  // Part locks apply on the model.
  await layer(page, 'base');
  await tool(page, 'pencil');
  await setColor(page, '#e61e28');
  await page.click('.sk-part[data-part="head"] [aria-label^="Only paint"]');
  const bodyBefore = await pixelAt(page, 20, 24);
  const bodyPos = await to3d(page, 20, 24);
  await page.mouse.move(bodyPos[0], bodyPos[1]);
  await page.waitForTimeout(120);
  check('locked parts show why in the hint', /Locked/.test((await page.textContent('.sk-3d-hint')) || ''), await page.textContent('.sk-3d-hint'));
  check('locked parts show a not-allowed cursor', (await page.getAttribute('.sk-3d .preview-stage', 'data-cursor')) === 'locked');
  await page.mouse.down();
  await page.mouse.up();
  check('locked parts are not painted from the model', eq(await pixelAt(page, 20, 24), bodyBefore));
  await click3d(page, 11, 10);
  check('the unlocked part still paints', eq(await pixelAt(page, 11, 10), RED));
  await page.click('.sk-part[data-part="head"] [aria-label^="Only paint"]');

  // Turning the camera never paints: right-drag, Space + drag, drag on the background.
  const snapshot = await imageData(page);
  const p0 = await to3d(page, 10, 12);
  await page.mouse.move(p0[0], p0[1]);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(p0[0] + 80, p0[1], { steps: 4 });
  await page.mouse.up({ button: 'right' });
  const p1 = await to3d(page, 10, 12);
  check('right-drag turns the model', !p1 || Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) > 10, `${p0} -> ${p1}`);
  await view(page, 'front');
  const q0 = await to3d(page, 10, 12);
  await page.mouse.move(q0[0], q0[1]);
  await page.keyboard.down(' ');
  await page.mouse.down();
  await page.mouse.move(q0[0] - 60, q0[1] + 20, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.up(' ');
  const q1 = await to3d(page, 10, 12);
  check('Space + drag turns the model', !q1 || Math.hypot(q1[0] - q0[0], q1[1] - q0[1]) > 10, `${q0} -> ${q1}`);
  const stage = await page.locator('.sk-3d .preview-stage').boundingBox();
  await view(page, 'front');
  const r0 = await to3d(page, 10, 12);
  // Open background right of the model (the body-part figure sits on the left edge).
  await page.mouse.move(stage.x + stage.width - 160, stage.y + stage.height / 2);
  await page.mouse.down();
  await page.mouse.move(stage.x + stage.width - 100, stage.y + stage.height / 2, { steps: 4 });
  await page.mouse.up();
  const r1 = await to3d(page, 10, 12);
  check('dragging the background turns the model', !r1 || Math.hypot(r1[0] - r0[0], r1[1] - r0[1]) > 10, `${r0} -> ${r1}`);
  check('turning the camera painted nothing', eq(await imageData(page), snapshot));

  // Wheel zooms towards the pointer.
  await view(page, 'front');
  const z0 = await to3d(page, 12, 12);
  const z1a = await to3d(page, 8, 12);
  await page.mouse.move(z0[0], z0[1]);
  await page.mouse.wheel(0, -400);
  await page.waitForTimeout(150);
  const z1 = await to3d(page, 12, 12);
  const z2 = await to3d(page, 8, 12);
  check('wheel zooms in', Math.abs(z2[0] - z1[0]) > Math.abs(z1a[0] - z0[0]) * 1.2, `${z1a[0] - z0[0]} -> ${z2[0] - z1[0]}`);
  check('zooming keeps the pointed pixel under the pointer', Math.hypot(z1[0] - z0[0], z1[1] - z0[1]) < 12, `${z0} -> ${z1}`);
  await page.click('.sk-canvas-bar [aria-label^="Reset view"]');

  // Top view shows the top of the head.
  await view(page, 'top');
  check('top view looks at the top of the head', !!(await to3d(page, 12, 4)) && !(await to3d(page, 12, 12)));
  await view(page, 'back');
  check('back view looks at the back of the head', !!(await to3d(page, 28, 12)) && !(await to3d(page, 12, 12)));
  await view(page, 'left');
  check('left side view looks at the left side of the head', !!(await to3d(page, 20, 12)));

  // Keyboard: D leaves and re-enters paint mode; the view keeps working.
  await page.locator('.sk-3d .preview-stage canvas').focus();
  await page.keyboard.press('d');
  check('D leaves paint mode', (await api(page, (e) => e.paint3d())) === false && (await page.isVisible('.sk-3d-controls')));
  await page.keyboard.press('d');
  check('D enters paint mode', (await api(page, (e) => e.paint3d())) === true);
  await page.keyboard.press('?');
  await page.waitForSelector('.shortcuts-modal');
  check('shortcuts list painting on the model', /Paint on the 3D model/.test((await page.textContent('.shortcuts-modal')) || ''));
  await page.keyboard.press('Escape');

  // Slim arms map onto the 3-pixel-wide arms.
  await page.click('.sk-3d-mode [data-value="view"]');
  await page.click('.sk-3d-controls .segmented-item[data-value="slim"]');
  await page.waitForSelector('.modal');
  await page.click('.modal-footer >> text=Just switch');
  await page.waitForTimeout(300);
  await page.click('.sk-3d-mode [data-value="paint"]');
  await view(page, 'front');
  await setColor(page, '#1ec83c');
  const slimPos = await to3d(page, 46, 24);
  check('slim arm: the ray hits the outer column of the 3px arm', eq(await hit3d(page, slimPos), { x: 46, y: 24, layer: 'base' }), JSON.stringify(await hit3d(page, slimPos)));
  await click3d(page, 46, 24);
  check('slim arm pixel painted from the model', eq(await pixelAt(page, 46, 24), GREEN));

  check('no page errors (desktop)', errors.length === 0, errors.join(' | '));
  await context.close();
}

// =============================================================================================
// 2. Phone: the 3D tab paints with one finger, turns with two
{
  const { page, context, errors } = await newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await openStarter(page, 'robot');
  await page.click('.editor-tab[data-panel="right"]');
  await page.waitForTimeout(400);
  await page.tap('.sk-3d-mode [data-value="paint"]');
  await page.waitForTimeout(200);
  check('phone: paint strip is on the 3D tab', (await page.isVisible('.sk-3d-paint')) && (await page.isVisible('.sk-3d-well')) && (await page.isVisible('.sk-3d-tools [data-tool="fill"]')));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  check('phone: no sideways scrolling', !overflow);
  await page.tap('.sk-view-btn[data-view="front"]');
  await page.waitForTimeout(550);
  const layerBase = '.sk-3d-paint .segmented-item[data-value="base"]';
  await page.tap(layerBase);
  const p = await to3d(page, 10, 12);
  const beforeTap = await pixelAt(page, 10, 12);
  const color = await api(page, () => null).then(() => page.evaluate(() => getComputedStyle(document.querySelector('.sk-3d-well .sk-well-fill')).backgroundColor));
  await page.touchscreen.tap(p[0], p[1]);
  await page.waitForTimeout(200);
  const afterTap = await pixelAt(page, 10, 12);
  check('phone: a tap on the model paints', !eq(afterTap, beforeTap) && color.includes(`${afterTap[0]}, ${afterTap[1]}, ${afterTap[2]}`), `${beforeTap} -> ${afterTap} (${color})`);

  // Two fingers turn the model and never paint.
  const snapshot = await imageData(page);
  const cdp = await context.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
  const [cx, cy] = p;
  await touch('touchStart', [[cx - 30, cy]]);
  await touch('touchStart', [[cx - 30, cy], [cx + 30, cy]]);
  for (let k = 1; k <= 6; k++) await touch('touchMove', [[cx - 30 + k * 12, cy], [cx + 30 + k * 12, cy]]);
  await touch('touchEnd', []);
  await page.waitForTimeout(200);
  const moved = await to3d(page, 10, 12);
  check('phone: two fingers turn the model', !moved || Math.hypot(moved[0] - p[0], moved[1] - p[1]) > 10, `${p} -> ${moved}`);
  check('phone: two fingers paint nothing', eq(await imageData(page), snapshot));
  check('no page errors (phone)', errors.length === 0, errors.join(' | '));
  await context.close();
}

// =============================================================================================
// 3. Screenshots: desktop, tablet and phone, dark and light, painting with the hover outline
for (const theme of ['dark', 'light']) {
  for (const [w, hgt, mobile] of [
    [1440, 900, false],
    [1024, 768, false],
    [390, 844, true],
  ]) {
    const { page, context, errors } = await newPage(mobile ? { viewport: { width: w, height: hgt }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : { viewport: { width: w, height: hgt } }, theme);
    await openStarter(page, 'explorer');
    if (mobile) await page.click('.editor-tab[data-panel="right"]');
    else if (w <= 1180) await page.click('.editor-sidetabs .segmented-item[data-value="right"]');
    await page.click('.sk-3d-mode [data-value="paint"]');
    await page.click(`.sk-view-btn[data-view="front"]`);
    await page.waitForTimeout(600);
    if (!mobile) {
      await page.click('.sk-3d-size [aria-label^="Bigger"]');
      const pos = await to3d(page, 11, 11);
      await page.mouse.move(pos[0], pos[1]);
    }
    await page.waitForTimeout(400);
    const fits = await page.evaluate(() => {
      const panel = document.querySelector('.sk-center').getBoundingClientRect();
      const stage = document.querySelector('.sk-3d-wrap').getBoundingClientRect();
      const inPanel = Array.from(document.querySelectorAll('.sk-3d-paint button, .sk-3d-paint .segmented, .sk-3d-paint output')).every((el) => {
        const r = el.getBoundingClientRect();
        return r.left >= panel.left && r.right <= panel.right - 2;
      });
      const overlays = ['.sk-3d-mode', '.sk-3d-views', '.sk-3d-hint'].map((s) => document.querySelector(s).getBoundingClientRect());
      const inStage = overlays.every((r) => r.left >= stage.left && r.right <= stage.right && r.top >= stage.top && r.bottom <= stage.bottom);
      const [mode, views] = overlays;
      return inPanel && inStage && mode.right < views.left;
    });
    check(`3D paint controls fit (${w} ${theme})`, fits);
    await page.screenshot({ path: path.join(shots, `skins3d-${w}-${theme}.png`) });
    check(`no page errors (${w} ${theme})`, errors.length === 0, errors.join(' | '));
    await context.close();
  }
}

await browser.close();
await server.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
