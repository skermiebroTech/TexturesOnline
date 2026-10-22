// End-to-end checks for the skin editor's pose maker and the cape maker (/cape-maker), at 1280 and
// 390 px in the dark and the light theme: every preset pose, moving and resetting one part, camera
// views and zoom, backgrounds, "Save picture" at 1×/2×/4× (transparent too) with the model in the
// picture; the cape maker's designs, painting, mirror, opening a cape PNG, copying onto the elytra,
// the 3D cape and elytra, the PNG and both elytra packs, keeping the cape after a reload, and the
// cape showing up in the pose maker. No console errors, nothing wider than the screen.
// Run: NODE_PATH=$(npm root -g) node tests/e2e/skins/skins-pose-cape.e2e.mjs [screenshotDir]
// Needs the global 'playwright' package.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const projectRequire = createRequire(path.join(root, 'package.json'));
const { decode: decodePng, encode: encodePng } = projectRequire('fast-png');
const { unzipSync, strFromU8 } = projectRequire('fflate');

const shots = process.argv[2] || path.join(tmpdir(), 'skins-pose-cape-e2e');
mkdirSync(shots, { recursive: true });
const executablePath = process.env.CHROMIUM_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => existsSync(p));

const server = await createServer({ root, logLevel: 'error', server: { port: 0, host: '127.0.0.1', hmr: false, watch: null } });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

let failures = 0;
function check(name, ok, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
}

const PRESETS = ['standing', 'walking', 'running', 'waving', 'sitting', 'crouching', 'flying', 'tpose', 'victory', 'dab', 'fighting', 'pointing'];

async function newPage(width, theme) {
  const phone = width < 600;
  const context = await browser.newContext({ viewport: { width, height: phone ? 844 : 860 }, colorScheme: theme, deviceScaleFactor: 1, acceptDownloads: true, hasTouch: phone });
  await context.addInitScript((t) => {
    try {
      localStorage.setItem('to-theme', t);
    } catch {
      /* ignore */
    }
  }, theme);
  await context.route(/playerdb\.co|textures\.minecraft\.net|mc-heads\.net/, (route) => route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  return { page, context, errors, phone };
}

const sideways = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
/** Elements of a container that stick out of the screen. */
const outside = (page, sel) =>
  page.evaluate((s) => {
    const vw = document.documentElement.clientWidth;
    const out = [];
    for (const el of document.querySelectorAll(`${s} *`)) {
      const r = el.getBoundingClientRect();
      if (r.width && (r.right > vw + 1 || r.left < -1) && !el.closest('canvas')) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`);
    }
    return out.slice(0, 5);
  }, sel);

async function download(page, click) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), click()]);
  const file = await dl.path();
  return { name: dl.suggestedFilename(), bytes: readFileSync(file) };
}

const pose = (page) => page.evaluate(() => document.querySelector('.sk-pose').__poseStudio.state());

async function setSlider(page, sel, value) {
  await page.$eval(
    `${sel} input.range`,
    (el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    },
    value,
  );
}

/** Share of a picture's pixels that are see-through, and whether its middle has the model in it. */
function pictureInfo(bytes) {
  const img = decodePng(bytes);
  const ch = img.channels ?? img.data.length / (img.width * img.height);
  let clear = 0;
  let midOpaque = 0;
  for (let y = 0; y < img.height; y++)
    for (let x = 0; x < img.width; x++) {
      const a = ch === 4 ? img.data[(y * img.width + x) * 4 + 3] : 255;
      if (a === 0) clear++;
      if (a > 0 && Math.abs(x - img.width / 2) < img.width * 0.15 && Math.abs(y - img.height / 2) < img.height * 0.3) midOpaque++;
    }
  return { width: img.width, height: img.height, clearShare: clear / (img.width * img.height), midOpaque, corner: ch === 4 ? img.data[3] : 255 };
}

// ------------------------------------------------------------------ cape maker
async function capeMaker(width, theme) {
  const tag = `${width}-${theme}`;
  const { page, context, errors, phone } = await newPage(width, theme);
  await page.goto(`${base}#/cape-maker`);
  await page.waitForSelector('.cm .pc-root', { timeout: 30000 });
  await page.waitForFunction(() => document.querySelector('.cm')?.__capeMaker?.ready(), null, { timeout: 30000 });
  await page.waitForTimeout(800);
  const cm = (fn, arg) => page.evaluate(([f, a]) => new Function('c', 'a', `return (${f})(c, a)`)(document.querySelector('.cm').__capeMaker, a), [fn.toString(), arg]);
  const pixel = (x, y) => cm((c, [x, y]) => Array.from(c.getImage().data.slice((y * 64 + x) * 4, (y * 64 + x) * 4 + 4)), [x, y]);
  check(`cape ${tag}: page title and heading`, /Cape Maker/i.test(await page.title()) && /cape/i.test(await page.textContent('.cm-hero h1')));
  check(`cape ${tag}: starts with a design on the cape`, (await pixel(5, 5))[3] === 255);
  await page.screenshot({ path: path.join(shots, `cape-${tag}.png`) });

  // Designs: twelve, each paints the cape and the elytra; the toast's Undo brings the old one back.
  check(`cape ${tag}: twelve starter designs`, (await page.$$('.cm-design')).length === 12);
  const before = await pixel(5, 5);
  await page.click('.cm-design[data-design="stars"]');
  await page.waitForTimeout(200);
  const stars = await pixel(5, 5);
  check(`cape ${tag}: a design repaints the cape`, JSON.stringify(stars) !== JSON.stringify(before), `${before} -> ${stars}`);
  check(`cape ${tag}: the design paints the elytra too`, (await pixel(40, 10))[3] === 255);
  await page.click('.toast .btn, .toast button');
  await page.waitForTimeout(200);
  check(`cape ${tag}: Undo in the toast restores the cape`, JSON.stringify(await pixel(5, 5)) === JSON.stringify(before));
  await page.click('.cm-design[data-design="checker"]');
  await page.waitForTimeout(200);

  // Paint one pixel with the pencil, then mirror paints its twin across the face.
  await page.fill('.cm-colour .cp-hex', '#ff00aa').catch(() => undefined);
  await page.keyboard.press('Enter').catch(() => undefined);
  await page.click('.cm-rail-tools [data-tool="pencil"]');
  const [cx, cy] = await cm((c) => c.imageToClient(3, 6));
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(150);
  const painted = await pixel(3, 6);
  check(`cape ${tag}: the pencil paints the pixel`, painted[3] === 255 && JSON.stringify(painted) !== JSON.stringify(await pixel(4, 6)) , String(painted));
  await page.click('.cm-mirror');
  const [mx, my] = await cm((c) => c.imageToClient(2, 9));
  await page.mouse.click(mx, my);
  await page.waitForTimeout(150);
  check(`cape ${tag}: mirror paints the twin pixel of the face`, JSON.stringify(await pixel(9, 9)) === JSON.stringify(await pixel(2, 9)));
  await page.click('.cm-mirror');
  // Hovering names the face.
  const [hx, hy] = await cm((c) => c.imageToClient(15, 8));
  await page.mouse.move(hx, hy);
  await page.waitForTimeout(150);
  check(`cape ${tag}: hover names the face`, /Cape inside/.test(await page.textContent('.cm-status-text')), await page.textContent('.cm-status-text'));

  // Opening a cape PNG: an HD 128x64 file is reduced to 64x32.
  const hd = new Uint8Array(128 * 64 * 4);
  for (let i = 0; i < 128 * 64; i++) hd.set([20, 120, 220, 255], i * 4);
  const hdPng = Buffer.from(encodePng({ width: 128, height: 64, data: hd, channels: 4 }));
  await page.setInputFiles('.cm-designs-foot input[type="file"]', { name: 'blue_cape.png', mimeType: 'image/png', buffer: hdPng });
  await page.waitForTimeout(600);
  check(`cape ${tag}: an HD cape PNG opens reduced`, JSON.stringify(await pixel(5, 5)) === JSON.stringify([20, 120, 220, 255]));
  check(`cape ${tag}: the file names the cape`, (await page.inputValue('.cm-name-input')) === 'blue cape', await page.inputValue('.cm-name-input'));
  await page.setInputFiles('.cm-designs-foot input[type="file"]', { name: 'skin.png', mimeType: 'image/png', buffer: Buffer.from(encodePng({ width: 64, height: 64, data: new Uint8Array(64 * 64 * 4), channels: 4 })) });
  await page.waitForTimeout(400);
  check(`cape ${tag}: a 64x64 skin is refused with a message`, /not a cape texture/.test((await page.textContent('.cm-designs-foot')) ?? ''));

  // Copy onto the elytra.
  await page.click('.cm-design[data-design="heart"]');
  await page.click('.cm-designs-actions .btn-secondary');
  await page.waitForTimeout(200);
  check(`cape ${tag}: copying puts the cape's top-left colour on the elytra`, JSON.stringify(await pixel(36, 2)) === JSON.stringify(await pixel(1, 1)));

  // 3D: elytra, flying.
  await page.click('.cm-3d-top [data-value="elytra"]');
  await page.click('.cm-3d-anim [data-value="fly"]');
  await page.waitForTimeout(900);
  check(`cape ${tag}: shows the elytra`, (await cm((c) => c.wear())) === 'elytra');
  await page.locator('.cm-preview').screenshot({ path: path.join(shots, `cape-elytra-${tag}.png`) });
  await page.click('.cm-3d-top [data-value="cape"]');
  await page.click('.cm-3d-anim [data-value="walk"]');

  // Downloads.
  await page.locator('.cm-download').scrollIntoViewIfNeeded();
  const png = await download(page, () => page.click('.cm-png-btn'));
  const pi = decodePng(png.bytes);
  check(`cape ${tag}: the cape PNG is 64x32`, pi.width === 64 && pi.height === 32 && /-cape\.png$/.test(png.name), `${png.name} ${pi.width}x${pi.height}`);
  const zip = await download(page, () => page.click('.cm-pack-btn'));
  const zf = unzipSync(new Uint8Array(zip.bytes));
  check(`cape ${tag}: Java elytra pack has pack.mcmeta and the 26.3 wings texture`, /\.zip$/.test(zip.name) && !!zf['pack.mcmeta'] && !!zf['assets/minecraft/textures/entity/equipment/wings/elytra.png'], `${zip.name}: ${Object.keys(zf)}`);
  await page.click('.cm-pack-fields [data-value="bedrock"]');
  await page.waitForTimeout(200);
  check(`cape ${tag}: Bedrock hides the Java version`, await page.isHidden('.cm-version'));
  const mc = await download(page, () => page.click('.cm-pack-btn'));
  const mf = unzipSync(new Uint8Array(mc.bytes));
  check(`cape ${tag}: Bedrock elytra pack`, /\.mcpack$/.test(mc.name) && JSON.parse(strFromU8(mf['manifest.json'])).modules[0].type === 'resources' && !!mf['textures/models/armor/elytra.png'], `${mc.name}: ${Object.keys(mf)}`);
  await page.click('.cm-pack-fields [data-value="java"]');

  check(`cape ${tag}: nothing wider than the screen`, (await sideways(page)) <= 0 && (await outside(page, '.cm')).length === 0, `${await sideways(page)} ${await outside(page, '.cm')}`);
  if (phone) await page.screenshot({ path: path.join(shots, `cape-full-${tag}.png`), fullPage: true });

  // Kept after a reload.
  const kept = await pixel(5, 5);
  await cm((c) => c.flush());
  await page.waitForTimeout(400);
  await page.reload();
  await page.waitForSelector('.cm .pc-root', { timeout: 30000 });
  await page.waitForTimeout(500);
  check(`cape ${tag}: the cape is kept after a reload`, JSON.stringify(await pixel(5, 5)) === JSON.stringify(kept));

  // The cape on the player in the skin editor's pose maker.
  await page.goto(`${base}#/skins`);
  await page.waitForSelector('.sk-starter-knight');
  await page.click('.sk-starter-knight');
  await page.waitForSelector('.sk-3d .preview-stage canvas', { state: 'attached', timeout: 20000 });
  if (phone) {
    await page.click('.editor-tab[data-panel="right"]');
    await page.waitForTimeout(300);
  }
  await page.click('.sk-pose-open');
  await page.waitForSelector('.sk-pose-view canvas', { timeout: 20000 });
  await page.waitForTimeout(500);
  await page.click('.sk-pose-tabs [data-value="scene"]');
  await page.click('.sk-pose-block .segmented [data-value="cape"]');
  await page.waitForTimeout(300);
  const st = await pose(page);
  check(`cape ${tag}: the pose maker wears the cape from the cape maker`, st.hasCape && st.wear === 'cape' && (await page.isHidden('.sk-pose-nocape')), JSON.stringify(st));
  await page.click('.sk-pose-views [data-view="back"]');
  await page.waitForTimeout(600);
  await page.locator('.sk-pose-stage').screenshot({ path: path.join(shots, `pose-cape-${tag}.png`) });
  check(`cape ${tag}: no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
  await context.close();
}

// ------------------------------------------------------------------ pose maker
async function poseMaker(width, theme) {
  const tag = `${width}-${theme}`;
  const { page, context, errors, phone } = await newPage(width, theme);
  await page.goto(`${base}#/skins`);
  await page.waitForSelector('.sk-starter-explorer');
  await page.click('.sk-starter-explorer');
  await page.waitForSelector('.sk-3d .preview-stage canvas', { state: 'attached', timeout: 20000 });
  await page.waitForTimeout(500);
  if (phone) {
    await page.click('.editor-tab[data-panel="right"]');
    await page.waitForTimeout(300);
  }
  // The editor's own animations are still there.
  check(`pose ${tag}: the editor keeps its animations`, (await page.$$('.sk-3d-controls .segmented-item')).length >= 4);
  await page.click('.sk-pose-open');
  await page.waitForSelector('.sk-pose-view canvas', { timeout: 20000 });
  await page.waitForTimeout(600);
  check(`pose ${tag}: dialog opens with its 3D view`, !!(await page.$('dialog[open] .sk-pose-stage canvas')));
  await page.click('.sk-pose-tabs [data-value="scene"]');
  check(`pose ${tag}: no cape yet, a note links the cape maker`, (await page.isVisible('.sk-pose-nocape a[href*="cape-maker"]')) && !(await pose(page)).hasCape);

  // Every preset, found again from its angles.
  await page.click('.sk-pose-tabs [data-value="poses"]');
  check(`pose ${tag}: twelve presets`, (await page.$$('.sk-pose-preset')).length === PRESETS.length);
  for (const id of PRESETS) {
    await page.click(`.sk-pose-preset[data-pose="${id}"]`);
    await page.waitForTimeout(120);
    const s = await pose(page);
    if (s.preset !== id) check(`pose ${tag}: preset ${id}`, false, JSON.stringify(s));
  }
  check(`pose ${tag}: every preset applies`, true);
  await page.click('.sk-pose-preset[data-pose="waving"]');
  await page.waitForTimeout(400);
  await page.locator('.sk-pose-stage').screenshot({ path: path.join(shots, `pose-waving-${tag}.png`) });
  check(`pose ${tag}: the pressed preset is marked`, (await page.getAttribute('.sk-pose-preset[data-pose="waving"]', 'aria-pressed')) === 'true');
  // Mirror swaps the waving arm.
  const waving = (await pose(page)).pose;
  await page.click('.sk-pose-pane[data-tab="poses"] .btn-secondary');
  const mirrored = (await pose(page)).pose;
  check(`pose ${tag}: mirror makes a different pose`, mirrored !== waving && (await pose(page)).preset === null);

  // Adjust: move the right arm, reset it.
  await page.click('.sk-pose-preset[data-pose="standing"]');
  await page.click('.sk-pose-tabs [data-value="adjust"]');
  await page.click('.sk-pose-parts [data-part="rightArm"]');
  await setSlider(page, '.sk-pose-sliders [data-axis="raise"]', 90);
  await page.waitForTimeout(150);
  let s = await pose(page);
  const vals = s.pose.slice(2).split(',').map(Number);
  check(`pose ${tag}: the raise slider moves the right arm`, vals[6] === 90 && s.preset === null, s.pose);
  check(`pose ${tag}: the pose is named "Your own pose"`, /Your own pose/.test(await page.textContent('.sk-pose-name')));
  await page.click('.sk-pose-pane[data-tab="adjust"] .sk-pose-row .btn-ghost');
  await page.waitForTimeout(150);
  s = await pose(page);
  check(`pose ${tag}: Reset Right Arm brings back the standing pose`, s.preset === 'standing', s.pose);
  // Copy the left arm's raise to the right.
  await page.click('.sk-pose-parts [data-part="leftArm"]');
  await setSlider(page, '.sk-pose-sliders [data-axis="raise"]', 45);
  await page.click('.sk-pose-pane[data-tab="adjust"] .sk-pose-row .btn-secondary');
  s = await pose(page);
  const v2 = s.pose.slice(2).split(',').map(Number);
  check(`pose ${tag}: Copy to Right Arm copies the angles`, v2[6] === 45 && v2[9] === 45, s.pose);
  await page.click('.sk-pose-parts [data-part="whole"]');
  check(`pose ${tag}: Whole has tilt, wings and cape sliders`, (await page.$$('.sk-pose-sliders .range')).length === 3);
  await page.screenshot({ path: path.join(shots, `pose-adjust-${tag}.png`) });

  // Scene: camera views, zoom, backgrounds.
  await page.click('.sk-pose-tabs [data-value="scene"]');
  for (const v of ['front', 'side', 'back', 'low', 'high', 'face', 'angle']) await page.click(`.sk-pose-views [data-view="${v}"]`);
  check(`pose ${tag}: seven camera views`, (await page.$$('.sk-pose-views [data-view]')).length === 7);
  await setSlider(page, '.sk-pose-zoom', 150);
  await page.waitForTimeout(150);
  check(`pose ${tag}: zoom slider shows 150`, (await page.inputValue('.sk-pose-zoom input.field-value')) === '150');
  await page.click('.sk-pose-views [data-view="angle"]');
  for (const bg of ['sky', 'night', 'paper', 'transparent', 'studio']) {
    await page.click(`.sk-pose-bg[data-id="${bg}"]`);
    if ((await page.getAttribute('.sk-pose-stage', 'data-bg')) !== bg) check(`pose ${tag}: background ${bg}`, false);
  }
  check(`pose ${tag}: backgrounds switch the stage`, true);
  await page.screenshot({ path: path.join(shots, `pose-scene-${tag}.png`) });

  // Save picture: 1×, 2×, 4×, transparent.
  await page.click('.sk-pose-preset[data-pose="victory"]').catch(() => undefined);
  await page.click('.sk-pose-tabs [data-value="poses"]');
  await page.click('.sk-pose-preset[data-pose="victory"]');
  await page.click('.sk-pose-tabs [data-value="scene"]');
  for (const scale of ['1', '2', '4']) {
    await page.click(`.sk-pose-scale [data-value="${scale}"]`);
    const want = (await pose(page)).size;
    const pic = await download(page, () => page.click('.sk-pose-save'));
    const info = pictureInfo(pic.bytes);
    const longSide = Math.max(info.width, info.height);
    check(`pose ${tag}: ${scale}× picture is ${want.width}×${want.height}`, info.width === want.width && info.height === want.height && longSide === Math.min(4096, 640 * Number(scale)) && /-pose\.png$/.test(pic.name), `${pic.name} ${info.width}x${info.height}`);
    if (scale === '1') check(`pose ${tag}: studio background is solid`, info.corner === 255 && info.clearShare === 0, JSON.stringify(info));
  }
  await page.click('.sk-pose-scale [data-value="2"]');
  await page.click('.sk-pose-bg[data-id="transparent"]');
  const clear = pictureInfo((await download(page, () => page.click('.sk-pose-save'))).bytes);
  check(`pose ${tag}: transparent picture: clear corners, the model in the middle`, clear.corner === 0 && clear.clearShare > 0.5 && clear.midOpaque > 500, JSON.stringify(clear));
  await page.click('.sk-pose-bg[data-id="studio"]');

  check(`pose ${tag}: the dialog fits the screen`, (await sideways(page)) <= 0 && (await outside(page, 'dialog[open]')).length === 0, `${await outside(page, 'dialog[open]')}`);
  // Closing and opening again keeps the pose (per browser).
  await page.keyboard.press('Escape');
  await page.waitForSelector('dialog[open]', { state: 'detached' });
  await page.click('.sk-pose-open');
  await page.waitForSelector('.sk-pose-view canvas');
  check(`pose ${tag}: the pose is remembered`, (await pose(page)).preset === 'victory');
  await page.keyboard.press('Escape');
  check(`pose ${tag}: no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
  await context.close();
}

try {
  for (const [w, theme] of [
    [1280, 'dark'],
    [390, 'light'],
    [1280, 'light'],
    [390, 'dark'],
  ]) {
    await poseMaker(w, theme);
    await capeMaker(w, theme);
  }
} catch (err) {
  console.error(err);
  failures++;
} finally {
  await browser.close();
  await server.close();
}
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
