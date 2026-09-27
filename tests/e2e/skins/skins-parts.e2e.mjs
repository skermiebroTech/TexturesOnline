// End-to-end checks for the 2D / 3D workspace switch and the body-part toggles on the 3D stage:
// the 3D model opens in the main editor, a click hides a part, a double-click shows only that part
// and frames the camera on it, rays skip hidden parts, and "All" brings everything back.
// Run: NODE_PATH=$(npm root -g) node tests/e2e/skins/skins-parts.e2e.mjs
// Needs the global 'playwright' package.
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const executablePath = process.env.CHROMIUM_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => existsSync(p));

const server = await createServer({ root, logLevel: 'error', server: { port: 0, host: '127.0.0.1', hmr: false, watch: null } });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

let failed = 0;
function check(name, ok, detail = '') {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
}

const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
await context.route(/playerdb\.co|textures\.minecraft\.net|mc-heads\.net/, (route) => route.abort());
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text());
});
const api = (fn, arg) =>
  page.evaluate(
    ([f, a]) => new Function('e', 'a', `return (${f})(e, a)`)(document.querySelector('.sk-editor').__skinEditor, a),
    [fn.toString(), arg],
  );
const figure = () =>
  page.$$eval('.sk-fig-part', (els) => Object.fromEntries(els.map((e) => [e.dataset.part, (e.getAttribute('aria-pressed') === 'true' ? 'on' : 'off') + (e.classList.contains('is-focus') ? '*' : '')])));

try {
  await page.goto(`${base}skins`);
  await page.waitForSelector('.sk-starter-explorer');
  await page.click('.sk-starter-explorer');
  await page.waitForFunction(() => !!document.querySelector('.sk-editor')?.__skinEditor);
  await page.waitForSelector('.sk-3d .preview-stage canvas', { state: 'attached', timeout: 20000 });
  await page.waitForTimeout(800);

  // 2D / 3D workspace
  check('opens on the 2D template', (await page.getAttribute('.sk-editor', 'data-workspace')) === '2d' && (await page.isVisible('.sk-center .sk-canvas-host')));
  await page.click('.sk-workspace [data-value="3d"]');
  await page.waitForTimeout(600);
  check(
    '3D puts the model in the main editor and the template in the side panel',
    (await page.isVisible('.sk-center .sk-3d-wrap')) && (await page.isVisible('.sk-right .sk-canvas-host')) && (await api((e) => e.paint3d())) === true,
  );
  const box = await page.locator('.sk-center .sk-3d-wrap').boundingBox();
  const figBox = await page.locator('.sk-body-toggle').boundingBox();
  check('the part figure is a small panel on the stage', figBox && figBox.width < 120 && figBox.height < 200 && figBox.x >= box.x, JSON.stringify(figBox));

  // hide / show one part
  await page.click('.sk-fig-part[data-part="rightArm"]');
  await page.waitForTimeout(300);
  let f = await figure();
  check('a click hides a part', f.rightArm === 'off' && f.body === 'on' && (await page.isVisible('.sk-fig-all')));
  check('the parts list follows', await page.locator('.sk-part[data-part="rightArm"]').evaluate((e) => e.classList.contains('is-hidden')));
  await page.click('.sk-fig-part[data-part="rightArm"]');
  await page.waitForTimeout(300);
  f = await figure();
  check('a second click shows it again', f.rightArm === 'on' && !(await page.isVisible('.sk-fig-all')));

  // show only one part: the camera frames it and rays only reach it
  await page.dblclick('.sk-fig-part[data-part="leftLeg"]');
  await page.waitForTimeout(800);
  f = await figure();
  check('a double-click shows only that part', f.leftLeg === 'on*' && ['head', 'body', 'rightArm', 'leftArm', 'rightLeg'].every((p) => f[p] === 'off'), JSON.stringify(f));
  await page.click('.sk-view-btn[data-view="left"]');
  await page.waitForTimeout(700);
  const mid = [box.x + box.width / 2, box.y + box.height / 2];
  const hit = await api((e, [x, y]) => e.hit3d(x, y), mid);
  // Left leg: base at x 16-31, pants (outer) at x 0-15, both at y 48-63 of the 64x64 skin.
  check('the camera turns around the isolated part', !!hit && hit.x < 32 && hit.y >= 48, JSON.stringify(hit));
  const before = await api((e) => Array.from(e.getImage().data));
  await page.mouse.click(mid[0], mid[1]);
  await page.waitForTimeout(300);
  const after = await api((e) => Array.from(e.getImage().data));
  check('painting works on the isolated part', before.some((v, i) => v !== after[i]));

  // part menu and show all
  await page.click('.sk-fig-all');
  await page.waitForTimeout(700);
  f = await figure();
  check('"All" shows every part and recentres', Object.values(f).every((v) => v === 'on') && !(await page.isVisible('.sk-fig-all')));
  await page.click('.sk-part[data-part="head"] [aria-label^="More for"]');
  await page.click('.menu >> text=Show only the head in 3D');
  await page.waitForTimeout(600);
  f = await figure();
  check('the part menu can show only one part', f.head === 'on*' && f.body === 'off');

  // back to 2D
  await page.click('.sk-workspace [data-value="2d"]');
  await page.waitForTimeout(400);
  check('2D puts the template back in the main editor', (await page.isVisible('.sk-center .sk-canvas-host')) && (await page.isVisible('.sk-right .sk-3d-wrap')) && (await api((e) => e.paint3d())) === false);
  check('no page errors', errors.length === 0, errors.join(' | '));
} catch (err) {
  failed++;
  console.log(`FAIL  ${err && err.stack ? err.stack : err}`);
} finally {
  await browser.close();
  await server.close();
}
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
