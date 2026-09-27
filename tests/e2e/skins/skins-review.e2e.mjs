// Regression checks from the Skin Maker review (#/skins): undo and the arm model, popover toggles,
// crash-safe saving, remembered colour, keyboard use of the tool rail, lock hints, skin-source
// errors, and the phone / tablet layouts.
// Run: NODE_PATH=$(npm root -g) node tests/e2e/skins/skins-review.e2e.mjs [screenshotDir]
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
const { encode: encodePng } = projectRequire('fast-png');

const shots = process.argv[2] || path.join(tmpdir(), 'skins-review-e2e');
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
const CORS = { 'access-control-allow-origin': '*' };

function makePng(w, h, fn) {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(fn(x, y), (y * w + x) * 4);
  return Buffer.from(encodePng({ width: w, height: h, data, channels: 4, depth: 8 }));
}

async function newPage(opts = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, ...opts });
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
const model = (page) => api(page, (e) => e.model());

async function waitEditor(page) {
  await page.waitForSelector('.sk-editor .pc-root', { timeout: 20000 });
  await page.waitForFunction(() => !!document.querySelector('.sk-editor')?.__skinEditor);
  await page.waitForTimeout(400);
}
async function paintAt(page, x, y) {
  const [cx, cy] = await api(page, (e, [x, y]) => e.imageToClient(x, y), [x, y]);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.up();
}
async function setColor(page, hex) {
  await page.fill('.sk-block-color .cp-hex', hex);
  await page.keyboard.press('Enter');
}
async function switchToSlim(page, convert = true) {
  await page.click('.sk-right .segmented-item[data-value="slim"]');
  await page.waitForSelector('dialog[open]');
  await page.click(`dialog[open] >> text=${convert ? 'Convert arms' : 'Just switch'}`);
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  await page.waitForTimeout(150);
}
async function openStarter(page, id) {
  await page.goto(`${base}#/skins`);
  await page.waitForSelector(`.sk-starter-${id}`);
  await page.click(`.sk-starter-${id}`);
  await waitEditor(page);
}
const toastTexts = (page) => page.evaluate(() => Array.from(document.querySelectorAll('.toast')).map((t) => t.textContent.trim()));

const RED = [255, 0, 0, 255];
const GREEN = [0, 255, 0, 255];

// =============================================================================================
// 1. Undo keeps the arm model in step with the pixels
{
  const { page, context, errors } = await newPage();
  await openStarter(page, 'template');
  await setColor(page, '#ff0000');
  await page.keyboard.press('b');

  await switchToSlim(page);
  check('convert switches to slim', (await model(page)) === 'slim');
  await page.locator('.pc-root').focus();
  await page.keyboard.press('Control+z');
  check('Ctrl+Z of the conversion switches back to classic', (await model(page)) === 'classic');
  check('the arm switch follows the undo', (await page.getAttribute('.sk-right .segmented-item[data-value="classic"]', 'aria-checked')) === 'true');
  await page.keyboard.press('Control+Shift+z');
  check('redo of the conversion switches to slim again', (await model(page)) === 'slim');
  await page.click('.sk-bar [aria-label^="Undo"]');
  check('the Undo button also switches the model back', (await model(page)) === 'classic');

  // Convert, paint, then the toast's Undo: the new stroke must survive.
  await switchToSlim(page);
  await paintAt(page, 20, 22);
  check('stroke painted after converting', eq(await pixelAt(page, 20, 22), RED));
  await page.click('.toast >> text=Undo');
  await page.waitForTimeout(200);
  check('toast Undo after painting restores classic arms', (await model(page)) === 'classic');
  check('toast Undo after painting keeps the new stroke', eq(await pixelAt(page, 20, 22), RED), JSON.stringify(await pixelAt(page, 20, 22)));

  // Part menu toast: Undo must not remove a stroke painted after the fill.
  await page.click('.sk-part[data-part="rightLeg"] [aria-label^="More for"]');
  await page.click('.menu-item >> text=Fill right leg with colour');
  await paintAt(page, 9, 12);
  const headBefore = await pixelAt(page, 9, 12);
  await page.click('.toast >> text=Undo >> nth=-1');
  await page.waitForTimeout(200);
  check('part menu Undo does not undo a later stroke', eq(await pixelAt(page, 9, 12), headBefore));
  check('part menu Undo explains why', (await toastTexts(page)).some((t) => /painted after that/.test(t)));
  check('no page errors (undo)', errors.length === 0, errors.join(' | '));
  await context.close();
}

// =============================================================================================
// 1b. Old 64x32 export of a slim skin widens the arms instead of leaving a gap
{
  const { page, context, errors } = await newPage();
  const { decode: decodePng } = projectRequire('fast-png');
  const { readFileSync } = await import('node:fs');
  await page.goto(`${base}#/skins`);
  await page.click('.sk-model-pick .segmented-item[data-value="slim"]');
  await page.click('.sk-starter-template');
  await waitEditor(page);
  check('slim starter opens slim', (await model(page)) === 'slim');
  await page.click('.sk-export-btn');
  await page.click('.sk-export-item[data-kind="java-legacy"]');
  await page.waitForSelector('.sk-losses');
  check('legacy dialog says slim arms are widened', /widened/.test((await page.textContent('.sk-losses')) || ''));
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.modal-footer >> text=Download 64×32 PNG')]);
  const img = decodePng(readFileSync(await dl.path()));
  const at = (x, y) => Array.from(img.data.slice((y * 64 + x) * 4, (y * 64 + x) * 4 + 4));
  check('legacy export fills the 4th arm column', at(47, 24)[3] === 255 && eq(at(47, 24), at(46, 24)), `${at(47, 24)} vs ${at(46, 24)}`);
  check('no page errors (legacy slim)', errors.length === 0, errors.join(' | '));
  await context.close();
}

// =============================================================================================
// 2. Popovers toggle instead of stacking up
{
  const { page, context, errors } = await newPage();
  await openStarter(page, 'blank');
  const count = (sel) => page.locator(sel).count();
  await page.click('.sk-export-btn');
  await page.waitForTimeout(100);
  await page.click('.sk-export-btn');
  await page.waitForTimeout(100);
  check('second click on Export closes its menu', (await count('.sk-export-menu')) === 0);
  await page.click('.sk-export-btn');
  await page.click('.sk-export-btn');
  await page.click('.sk-export-btn');
  await page.waitForTimeout(100);
  check('rapid Export clicks leave at most one menu', (await count('.sk-export-menu')) === 1, String(await count('.sk-export-menu')));
  await page.keyboard.press('Escape');
  await page.click('.sk-well-primary');
  await page.waitForTimeout(100);
  await page.click('.sk-well-primary', { force: true });
  await page.waitForTimeout(100);
  check('second click on the paint colour closes its picker', (await count('.sk-color-pop')) === 0);
  await page.click('.sk-part[data-part="head"] [aria-label^="More for"]');
  await page.click('.sk-part[data-part="head"] [aria-label^="More for"]');
  await page.waitForTimeout(100);
  check('part menu button toggles', (await count('.menu')) === 0);
  check('no page errors (popovers)', errors.length === 0, errors.join(' | '));
  await context.close();
}

// =============================================================================================
// 3. Never lose work: reload right after a stroke, backup recovery, remembered colour
{
  const { page, context, errors } = await newPage();
  let dialogs = 0;
  page.on('dialog', (d) => {
    dialogs++;
    void d.accept();
  });
  await openStarter(page, 'blank');
  const id = (await page.evaluate(() => location.pathname + location.hash)).split('/').pop();
  await setColor(page, '#00ff00');
  await page.keyboard.press('b');
  await page.waitForTimeout(500);
  await paintAt(page, 10, 10);
  await page.reload();
  await waitEditor(page);
  check('stroke survives an immediate reload', eq(await pixelAt(page, 10, 10), GREEN), JSON.stringify(await pixelAt(page, 10, 10)));
  check('no "Leave site?" prompt when the backup was written', dialogs === 0, String(dialogs));
  check('paint colour is remembered', (await page.inputValue('.sk-block-color .cp-hex')).toLowerCase() === '#00ff00');

  // A backup newer than the saved project (the IndexedDB write never finished) is restored.
  await api(page, (e) => e.flush());
  const png = makePng(64, 64, (x, y) => (x === 3 && y === 3 ? [1, 2, 3, 255] : [200, 100, 50, 255])).toString('base64');
  await page.evaluate(([key, png]) => localStorage.setItem(key, JSON.stringify({ png, model: 'slim', name: 'Recovered', t: Date.now() + 60000 })), [`to-skin-backup:${id}`, png]);
  await page.reload();
  await waitEditor(page);
  check('newer local backup is restored', eq(await pixelAt(page, 3, 3), [1, 2, 3, 255]));
  check('restored backup brings its model and name', (await model(page)) === 'slim' && (await page.inputValue('.sk-name')) === 'Recovered');
  check('restoring is announced', (await toastTexts(page)).some((t) => /Restored the changes/.test(t)));
  await api(page, (e) => e.flush());
  await page.waitForTimeout(200);
  check('backup is cleared once saved', !(await page.evaluate((key) => localStorage.getItem(key), `to-skin-backup:${id}`)));
  await page.reload();
  await waitEditor(page);
  check('recovered skin was saved for good', eq(await pixelAt(page, 3, 3), [1, 2, 3, 255]) && (await toastTexts(page)).every((t) => !/Restored/.test(t)));
  check('no page errors (saving)', errors.length === 0, errors.join(' | '));
  await context.close();
}

// =============================================================================================
// 4. Keyboard: the tool rail is one tab stop with arrow keys; lock hints; mirror + lock
{
  const { page, context, errors } = await newPage();
  await openStarter(page, 'template');
  const stops = await page.$$eval('.sk-rail-tools button', (bs) => bs.filter((b) => b.tabIndex === 0).map((b) => b.dataset.tool));
  check('tool rail has a single tab stop (the current tool)', eq(stops, ['pencil']), JSON.stringify(stops));
  await page.focus('.sk-rail-tools button[data-tool="pencil"]');
  await page.keyboard.press('ArrowDown');
  const focused = await page.evaluate(() => document.activeElement?.dataset.tool);
  check('arrow key moves along the rail', focused === 'eraser', focused);
  await page.keyboard.press('Enter');
  check('Enter picks the focused tool', (await page.getAttribute('.sk-rail-tools [data-tool="eraser"]', 'aria-pressed')) === 'true');
  await page.keyboard.press('Tab');
  const after = await page.evaluate(() => (document.activeElement?.closest('.sk-rail-tools') ? 'rail' : 'out'));
  check('Tab leaves the rail in one step', after === 'out');

  // Painting the outer layer only: hovering the base layer says why it's locked.
  await page.locator('.pc-root').focus();
  await page.keyboard.press('2');
  const [hx, hy] = await api(page, (e) => e.imageToClient(10, 10));
  await page.mouse.move(hx, hy);
  await page.waitForTimeout(150);
  check('tooltip explains a locked layer', /Locked: painting the outer layer only/.test((await page.textContent('.sk-tip')) || ''), await page.textContent('.sk-tip'));
  await page.keyboard.press('3');

  // Lock the right arm with Mirror on: the left arm (its mirror) stays paintable.
  await page.keyboard.press('b');
  await setColor(page, '#ff0000');
  await page.click('.sk-part[data-part="rightArm"] [aria-label^="Only paint"]');
  await page.click('.sk-toggle-btn');
  await paintAt(page, 37, 54); // left arm front
  check('mirror partner of a locked part is paintable', eq(await pixelAt(page, 37, 54), RED), JSON.stringify(await pixelAt(page, 37, 54)));
  const bodyBefore = await pixelAt(page, 22, 24);
  await paintAt(page, 22, 24);
  check('other parts stay locked', eq(await pixelAt(page, 22, 24), bodyBefore));
  check('no page errors (keyboard)', errors.length === 0, errors.join(' | '));
  await context.close();
}

// =============================================================================================
// 5. Skin sources: odd answers and odd files
{
  const { page, context, errors } = await newPage();
  await context.unroute(/playerdb\.co|textures\.minecraft\.net|mc-heads\.net/);
  await context.route(/playerdb\.co|textures\.minecraft\.net|mc-heads\.net/, (route) => {
    const url = route.request().url();
    if (url.includes('playerdb')) return route.abort();
    return route.fulfill({ status: 200, contentType: 'text/html', headers: CORS, body: '<html>maintenance</html>' });
  });
  await page.goto(`${base}#/skins`);
  await page.fill('#sk-username', 'Someone');
  await page.press('#sk-username', 'Enter');
  await page.waitForFunction(() => !document.querySelector('.sk-field-error')?.hidden, null, { timeout: 20000 });
  check('a non-image answer is not blamed on the connection', /didn't send a usable skin/.test((await page.textContent('.sk-field-error')) || ''), await page.textContent('.sk-field-error'));

  const input = '.sk-import .dropzone input[type=file]';
  await page.setInputFiles(input, { name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]) });
  await page.waitForSelector('.dropzone-error:not([hidden])');
  check('a JPEG renamed to .png is explained', /JPEG/.test((await page.textContent('.dropzone-error')) || ''));
  await page.setInputFiles(input, { name: 'empty.png', mimeType: 'image/png', buffer: makePng(64, 64, () => [0, 0, 0, 0]) });
  await waitEditor(page);
  check('a fully see-through skin opens with a note', (await toastTexts(page)).some((t) => /completely see-through/.test(t)));
  check('no page errors (sources)', errors.length === 0, errors.join(' | '));
  await context.close();
}

// =============================================================================================
// 6. Starting twice at once makes one skin
{
  const { page, context, errors } = await newPage();
  await page.goto(`${base}#/skins`);
  await page.waitForSelector('.sk-starter-robot');
  const before = await page.evaluate(async () => (await (await import('/src/core/storage.ts')).listProjects('skin')).length);
  await page.evaluate(() => {
    document.querySelector('.sk-starter-robot').click();
    document.querySelector('.sk-starter-ninja').click();
  });
  await waitEditor(page);
  const afterCount = await page.evaluate(async () => (await (await import('/src/core/storage.ts')).listProjects('skin')).length);
  check('two quick starter clicks create one skin', afterCount === before + 1, `${before} -> ${afterCount}`);
  check('no page errors (double start)', errors.length === 0, errors.join(' | '));
  await context.close();
}

// =============================================================================================
// 7. Phone: every tool is reachable without scrolling. Tablet: the side panel opens on 3D.
{
  const { page, context, errors } = await newPage({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await openStarter(page, 'explorer');
  const rail = await page.evaluate(() => {
    const r = document.querySelector('.sk-rail');
    const vw = document.documentElement.clientWidth;
    const tools = Array.from(document.querySelectorAll('.sk-rail-tools button')).map((b) => b.getBoundingClientRect());
    return { scrolls: r.scrollWidth > r.clientWidth + 1, allVisible: tools.every((t) => t.left >= 0 && t.right <= vw && t.width >= 30), n: tools.length };
  });
  check('phone rail shows all 13 tools without scrolling', rail.n === 13 && rail.allVisible && !rail.scrolls, JSON.stringify(rail));
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  check('no sideways scrolling on a 360px phone', !overflow);
  await page.screenshot({ path: path.join(shots, 'review-phone-360.png') });
  check('no page errors (phone)', errors.length === 0, errors.join(' | '));
  await context.close();
}
{
  const { page, context, errors } = await newPage({ viewport: { width: 1024, height: 768 } });
  await openStarter(page, 'knight');
  check('tablet side panel opens on the 3D preview', await page.isVisible('.sk-3d-wrap'));
  check('tablet side tab for colours and parts is called Paint', /Paint/.test((await page.textContent('.editor-sidetabs .segmented-item[data-value="left"]')) || ''));
  const fits = await page.evaluate(() => {
    const panel = document.querySelector('.sk-right').getBoundingClientRect();
    return Array.from(document.querySelectorAll('.sk-3d-controls .sk-chip, .sk-3d-controls .sk-backdrop, .sk-ctl-label')).every((el) => {
      const r = el.getBoundingClientRect();
      return r.right <= panel.right - 2 && el.scrollWidth <= el.clientWidth + 1;
    });
  });
  check('3D controls fit the tablet side panel', fits);
  await page.click('.editor-sidetabs .segmented-item[data-value="left"]');
  await page.reload();
  await waitEditor(page);
  check('tablet remembers the chosen side panel', await page.isVisible('.sk-block-parts'));
  check('no page errors (tablet)', errors.length === 0, errors.join(' | '));
  await context.close();
}

await browser.close();
await server.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
