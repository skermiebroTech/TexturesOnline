// End-to-end checks of the Skin Pack Maker (/skin-pack-maker) at 1280 and 390 px: a pack built
// from three skins (an uploaded 64×64 PNG, an uploaded HD 128×128 PNG whose slim arms are detected,
// a starter skin), renamed, reordered (dragging on desktop, the arrow buttons on a phone, keyboard
// focus kept), arms set, a pack icon from the first face; the downloaded .mcpack is checked file by
// file; a skin painted in the skin editor comes back into the pack; a reload keeps the pack; the
// exported file opens again as the same pack, a texture pack is refused with a reason; no console
// errors, nothing wider than the screen.
// Run: NODE_PATH=$(npm root -g) node tests/e2e/skins/skins-pack.e2e.mjs [screenshotDir]
// Needs the global 'playwright' package. Starts its own Vite server.
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
const { unzipSync, zipSync, strFromU8, strToU8 } = projectRequire('fflate');

const shots = process.argv[2] || path.join(tmpdir(), 'skins-pack-e2e');
mkdirSync(shots, { recursive: true });
const executablePath = process.env.CHROMIUM_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => existsSync(p));

const server = await createServer({ root, logLevel: 'error', server: { port: 0, host: '127.0.0.1', hmr: false, watch: null } });
await server.listen();
const base = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await chromium.launch({ executablePath, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---- fixtures ----
function makePng(w, h, fn) {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(fn(x, y), (y * w + x) * 4);
  return Buffer.from(encodePng({ width: w, height: h, data, channels: 4, depth: 8 }));
}
const RED = [200, 30, 40, 255];
const BLUE = [30, 60, 210, 255];
/** Solid skin with a face colour and an empty hat (so the pack icon can be checked). */
const classicPng = makePng(64, 64, (x, y) => (y >= 8 && y < 16 && x >= 8 && x < 16 ? [250, 210, 160, 255] : y >= 8 && y < 16 && x >= 40 && x < 48 ? [0, 0, 0, 0] : RED));
/** HD skin with the slim arms' unused columns left empty: the maker should pick slim arms. */
const slimHoles = [[54, 20, 2, 12], [46, 52, 2, 12], [50, 16, 2, 4], [42, 48, 2, 4]].map((r) => r.map((v) => v * 2));
const hdSlimPng = makePng(128, 128, (x, y) => (slimHoles.some(([x0, y0, w, h]) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h) ? [0, 0, 0, 0] : BLUE));
const texturePackZip = Buffer.from(zipSync({ 'manifest.json': strToU8('{"format_version":2,"header":{"name":"Not skins"},"modules":[{"type":"resources","uuid":"a"}]}'), 'textures/blocks/stone.png': new Uint8Array(classicPng) }));
const px = (img, x, y) => Array.from(img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4));

async function newPage(width, height) {
  const context = await browser.newContext({ viewport: { width, height }, acceptDownloads: true, hasTouch: width < 600, isMobile: false });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  await context.route(/playerdb\.co|textures\.minecraft\.net|mc-heads\.net/, (route) => route.abort());
  return { page, context, errors };
}

const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const state = (page) =>
  page.evaluate(() => {
    const api = document.querySelector('.skp').__packBuilder;
    const p = api.pack();
    return { id: p.id, name: p.name, description: p.description, skins: p.skins.map((s) => [s.name, s.model]), url: location.pathname + location.search };
  });
const shown = (page) =>
  page.$$eval('.skp-skin', (els) =>
    els.map((el) => [el.querySelector('.skp-skin-name').value, el.querySelector('.skp-arms [aria-checked="true"]').dataset.value, el.querySelector('.skp-num').textContent]),
  );
/** First pixel of skin `i` of the pack on screen. */
const skinPixel = (page, i, x, y) =>
  page.evaluate(
    async ([i, x, y]) => {
      const skin = document.querySelector('.skp').__packBuilder.pack().skins[i];
      const bmp = await createImageBitmap(skin.image);
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      const ctx = c.getContext('2d');
      ctx.drawImage(bmp, 0, 0);
      return [bmp.width, Array.from(ctx.getImageData(x, y, 1, 1).data)];
    },
    [i, x, y],
  );

async function closeModal(page) {
  for (let i = 0; i < 3 && (await page.$('dialog[open]')); i++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }
  await page.waitForFunction(() => !document.querySelector('dialog[open]'), null, { timeout: 5000 });
}

async function download(page) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('.skp-download')]);
  const file = await dl.path();
  return { name: dl.suggestedFilename(), bytes: readFileSync(file), file };
}

async function pickFiles(page, trigger, files) {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click(trigger)]);
  await chooser.setFiles(files);
}

for (const [width, height, tag] of [[1280, 900, 'desktop'], [390, 844, 'phone']]) {
  const { page, context, errors } = await newPage(width, height);
  const phone = width < 600;
  await page.goto(`${base}/skin-pack-maker/`);
  await page.waitForSelector('.skp-details');
  await page.waitForSelector('[data-tool-intro="skinpack"]');
  check(`${tag}: the page is the pack builder, empty, with the introduction below`, (await page.textContent('.skp-hero h1')).includes('Make your own skin pack') && (await page.isVisible('.skp-empty')) && (await page.isDisabled('.skp-download')));
  await page.screenshot({ path: path.join(shots, `${tag}-1-empty.png`) });

  // ---- three skins: two uploads (several at once) and a starter
  await pickFiles(page, '.skp-add-upload', [
    { name: 'red_knight.png', mimeType: 'image/png', buffer: classicPng },
    { name: 'blue-mage.png', mimeType: 'image/png', buffer: hdSlimPng },
  ]);
  await page.waitForFunction(() => document.querySelectorAll('.skp-skin').length === 2, null, { timeout: 15000 });
  await page.click('.skp-add-starters');
  await page.waitForSelector('dialog[open] .skp-starter[data-starter="wizard"]');
  await page.click('dialog[open] .skp-starter[data-starter="wizard"]');
  check(`${tag}: the starter dialog counts the pick`, /Add 1 skin/.test(await page.textContent('dialog[open] .modal-footer .btn-primary')));
  await page.click('dialog[open] .modal-footer .btn-primary');
  await page.waitForFunction(() => document.querySelectorAll('.skp-skin').length === 3);
  await page.waitForTimeout(600);
  let st = await state(page);
  check(`${tag}: three skins, names from the files, arms detected (HD slim)`, eq(st.skins, [['red knight', 'classic'], ['blue mage', 'slim'], ['Wizard', 'classic']]), JSON.stringify(st.skins));
  check(`${tag}: the pack is saved and in the address`, new RegExp(`\\?pack=${st.id}$`).test(st.url), st.url);
  check(`${tag}: the count and the HD tag show`, (await page.textContent('.skp-count')) === '3 skins' && (await page.isVisible('.skp-skin:nth-child(2) .skp-hd')));
  const iconPx = await page.evaluate(() => Array.from(document.querySelector('.skp-icon-canvas').getContext('2d').getImageData(64, 64, 1, 1).data));
  check(`${tag}: the pack icon is the first skin's face`, eq(iconPx, [250, 210, 160, 255]), JSON.stringify(iconPx));

  // ---- names
  await page.fill('.skp-name', 'E2E Crew');
  await page.fill('.skp-desc', 'Made by the test');
  const names = ['Alpha', 'Bravo', 'Charlie'];
  for (let i = 0; i < 3; i++) await page.fill(`.skp-skin:nth-child(${i + 1}) .skp-skin-name`, names[i]);

  // ---- order: Charlie to the front
  if (!phone) {
    await page.dragAndDrop('.skp-skin:nth-child(3) .skp-handle', '.skp-skin:nth-child(1)', { targetPosition: { x: 20, y: 80 } });
    await page.waitForTimeout(300);
  } else {
    await page.click('.skp-skin:nth-child(3) .skp-up');
    await page.click('.skp-skin:nth-child(2) .skp-up');
  }
  check(`${tag}: ${phone ? 'the arrow buttons' : 'dragging'} put Charlie first`, eq((await shown(page)).map((s) => s[0]), ['Charlie', 'Alpha', 'Bravo']), JSON.stringify(await shown(page)));
  // keyboard: the moved skin's button keeps focus, and the order is announced
  await page.focus('.skp-skin:nth-child(2) .skp-down');
  await page.keyboard.press('Enter');
  const focus = await page.evaluate(() => ({ cls: document.activeElement.className, name: document.activeElement.closest('.skp-skin')?.querySelector('.skp-skin-name').value }));
  check(`${tag}: keyboard move keeps focus on the moved skin`, focus.name === 'Alpha' && /skp-up|skp-down/.test(focus.cls), JSON.stringify(focus));
  // Alpha is last now: focus went to its up button, which moves it back
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  check(`${tag}: moves are announced`, /Alpha moved to place 2 of 3/.test(await page.textContent('.skp-live')), await page.textContent('.skp-live'));
  check(`${tag}: the first skin can't move up, the last can't move down`, (await page.isDisabled('.skp-skin:nth-child(1) .skp-up')) && (await page.isDisabled('.skp-skin:nth-child(3) .skp-down')));

  // ---- arms: Charlie (a classic starter) to slim; Bravo's picture says slim, the hint stays hidden
  await page.click('.skp-skin:nth-child(1) .skp-arms [data-value="slim"]');
  await page.waitForTimeout(200);
  check(`${tag}: a mismatch between arms and picture is pointed out`, (await page.isVisible('.skp-skin:nth-child(1) .skp-hint')) && !(await page.isVisible('.skp-skin:nth-child(3) .skp-hint')));
  check(`${tag}: what shows is what is stored`, eq(await shown(page), [['Charlie', 'slim', '1'], ['Alpha', 'classic', '2'], ['Bravo', 'slim', '3']]), JSON.stringify(await shown(page)));
  check(`${tag}: nothing wider than the screen`, (await overflow(page)) <= 0, String(await overflow(page)));
  await page.screenshot({ path: path.join(shots, `${tag}-2-pack.png`), fullPage: phone });

  // ---- export
  const dl = await download(page);
  await page.waitForSelector('dialog[open] .sk-export-done');
  check(`${tag}: the ready dialog names the pack and the Dressing Room`, /Your Bedrock skin pack is ready/.test(await page.textContent('dialog[open]')) && /Dressing Room/.test(await page.textContent('dialog[open]')));
  await page.screenshot({ path: path.join(shots, `${tag}-3-ready.png`) });
  await closeModal(page);
  const files = unzipSync(new Uint8Array(dl.bytes));
  const manifest = JSON.parse(strFromU8(files['manifest.json']));
  const skinsJson = JSON.parse(strFromU8(files['skins.json']));
  const lang = strFromU8(files['texts/en_US.lang']);
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  check(`${tag}: file name is the pack name`, dl.name === 'E2E Crew.mcpack', dl.name);
  check(
    `${tag}: manifest.json is a current skin pack manifest`,
    manifest.format_version === 2 && manifest.header.name === 'E2E Crew' && manifest.header.description === 'Made by the test' && uuid.test(manifest.header.uuid) && uuid.test(manifest.modules[0].uuid) && manifest.header.uuid !== manifest.modules[0].uuid && manifest.modules[0].type === 'skin_pack' && eq(manifest.header.version, [1, 0, 0]),
    JSON.stringify(manifest),
  );
  check(
    `${tag}: skins.json lists the skins in order with their geometry`,
    skinsJson.serialize_name === skinsJson.localization_name && eq(skinsJson.skins.map((s) => [s.localization_name, s.geometry, s.type]), [['Charlie', 'geometry.humanoid.customSlim', 'free'], ['Alpha', 'geometry.humanoid.custom', 'free'], ['Bravo', 'geometry.humanoid.customSlim', 'free']]),
    JSON.stringify(skinsJson),
  );
  check(`${tag}: texts/en_US.lang names the pack and every skin`, ['E2E Crew', 'Charlie', 'Alpha', 'Bravo'].every((n) => lang.includes(`=${n}\n`)) && lang.startsWith(`skinpack.${skinsJson.localization_name}=E2E Crew`), lang);
  check(`${tag}: languages.json and pack_icon.png are there`, eq(JSON.parse(strFromU8(files['texts/languages.json'])), ['en_US']) && decodePng(files['pack_icon.png']).width === 128);
  const tex = skinsJson.skins.map((s) => decodePng(files[s.texture]));
  check(`${tag}: textures keep their pixels and sizes (HD stays 128)`, eq(tex.map((t) => t.width), [64, 64, 128]) && eq(px(tex[1], 0, 0), RED) && eq(px(tex[2], 0, 0), BLUE), JSON.stringify(tex.map((t) => [t.width, px(t, 0, 0)])));

  // ---- painting a skin in the editor and coming back
  await page.click('.skp-skin:nth-child(2) .skp-edit');
  await page.waitForSelector('.sk-editor .pc-root', { timeout: 20000 });
  await page.waitForFunction(() => !!document.querySelector('.sk-editor')?.__skinEditor);
  check(`${tag}: Paint opens the skin editor with a way back to the pack`, /\/skins\/[\w-]+\?pack=/.test(page.url()) && (await page.textContent('.sk-pack-back')).includes('Back to the skin pack'), page.url());
  await page.waitForTimeout(300);
  // a black dot on the chest
  // (on a phone the colour panel is folded away: the colour the editor starts with paints)
  if (await page.isVisible('.sk-block-color .cp-hex')) {
    await page.fill('.sk-block-color .cp-hex', '#000000');
    await page.keyboard.press('Enter');
  }
  await page.keyboard.press('b');
  const [cx, cy] = await page.evaluate(() => document.querySelector('.sk-editor').__skinEditor.imageToClient(21, 22));
  if (phone) await page.touchscreen.tap(cx, cy);
  else await page.mouse.click(cx, cy);
  await page.waitForTimeout(200);
  const painted = await page.evaluate(() => Array.from(document.querySelector('.sk-editor').__skinEditor.getImage().data.slice((22 * 64 + 21) * 4, (22 * 64 + 21) * 4 + 4)));
  await page.click('.sk-pack-back');
  await page.waitForSelector('.skp-skin');
  await page.waitForTimeout(500);
  const back = await skinPixel(page, 1, 21, 22);
  check(`${tag}: the edit is in the pack after coming back`, !eq(painted, RED) && eq(back[1], painted), JSON.stringify({ painted, back }));
  check(`${tag}: coming back keeps the rest of the pack`, eq(await shown(page), [['Charlie', 'slim', '1'], ['Alpha', 'classic', '2'], ['Bravo', 'slim', '3']]), JSON.stringify(await shown(page)));

  // ---- reload
  await page.reload();
  await page.waitForSelector('.skp-skin');
  await page.waitForTimeout(400);
  st = await state(page);
  check(`${tag}: a reload keeps the pack`, st.name === 'E2E Crew' && st.description === 'Made by the test' && eq(st.skins, [['Charlie', 'slim'], ['Alpha', 'classic'], ['Bravo', 'slim']]) && (await page.inputValue('.skp-name')) === 'E2E Crew', JSON.stringify(st));

  // ---- open the exported pack again
  await pickFiles(page, '.skp-open', [{ name: 'E2E Crew.mcpack', mimeType: 'application/octet-stream', buffer: dl.bytes }]);
  await page.waitForFunction((id) => document.querySelector('.skp').__packBuilder.pack().id !== id && document.querySelectorAll('.skp-skin').length === 3, st.id, { timeout: 20000 });
  await page.waitForTimeout(400);
  const opened = await state(page);
  check(`${tag}: the exported pack opens as the same pack`, opened.name === 'E2E Crew' && opened.description === 'Made by the test' && eq(opened.skins, [['Charlie', 'slim'], ['Alpha', 'classic'], ['Bravo', 'slim']]), JSON.stringify(opened));
  const openedPx = await skinPixel(page, 2, 0, 0);
  check(`${tag}: opened skins keep their pixels`, openedPx[0] === 128 && eq(openedPx[1], BLUE), JSON.stringify(openedPx));
  check(`${tag}: both packs are listed under Your skin packs`, (await page.locator('.skp-packs:not([hidden]) .skp-pack-link').count()) === 2 && (await page.locator('.skp-pack-link.is-current').count()) === 1);
  const again = await download(page);
  await closeModal(page);
  const files2 = unzipSync(new Uint8Array(again.bytes));
  const skins2 = JSON.parse(strFromU8(files2['skins.json']));
  check(
    `${tag}: exporting the opened pack gives the same skins`,
    eq(skins2.skins.map((s) => [s.localization_name, s.geometry, s.texture]), skinsJson.skins.map((s) => [s.localization_name, s.geometry, s.texture])) && skinsJson.skins.every((s) => Buffer.compare(Buffer.from(files[s.texture]), Buffer.from(files2[s.texture])) === 0 || s.localization_name === 'Alpha'),
    JSON.stringify(skins2),
  );

  // ---- a texture pack is refused with a reason
  await pickFiles(page, '.skp-open', [{ name: 'textures.zip', mimeType: 'application/zip', buffer: texturePackZip }]);
  await page.waitForSelector('.toast.tone-error', { timeout: 10000 });
  check(`${tag}: a texture pack is refused with a reason`, /This is a texture pack, not a skin pack/.test(await page.textContent('.toast.tone-error')));

  // ---- switching back to the first pack
  await page.click(`.skp-pack-link[data-pack="${st.id}"]`);
  await page.waitForFunction((id) => document.querySelector('.skp').__packBuilder.pack().id === id, st.id);
  check(`${tag}: Your skin packs switches packs`, (await page.inputValue('.skp-name')) === 'E2E Crew' && page.url().endsWith(`?pack=${st.id}`), page.url());
  check(`${tag}: nothing wider than the screen at the end`, (await overflow(page)) <= 0, String(await overflow(page)));
  await page.screenshot({ path: path.join(shots, `${tag}-4-packs.png`), fullPage: true });
  check(`${tag}: no console errors`, errors.length === 0, errors.join(' | '));
  await context.close();
}

await browser.close();
await server.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
