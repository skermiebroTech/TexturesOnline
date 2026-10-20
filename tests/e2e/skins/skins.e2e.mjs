// End-to-end checks for the Skin Maker (#/skins).
// Run: NODE_PATH=$(npm root -g) node tests/e2e/skins/skins.e2e.mjs [screenshotDir]
// Needs the global 'playwright' package. Mojang/playerdb/texture requests are routed to local
// fixtures; the game-files check serves a local 26.3 client jar (SKINS_JAR=/path/to/26.3.jar) and
// is skipped without it.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, statSync, openSync, readSync, closeSync } from 'node:fs';
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

const shots = process.argv[2] || path.join(tmpdir(), 'skins-e2e');
mkdirSync(shots, { recursive: true });
const executablePath = process.env.CHROMIUM_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => existsSync(p));
const jarPath = process.env.SKINS_JAR || '';

const server = await createServer({ root, logLevel: 'error', server: { port: 0, host: '127.0.0.1', hmr: false, watch: null } });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({
  executablePath,
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---- fixtures ----
function makePng(w, h, fn) {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = fn(x, y);
      data.set(c, (y * w + x) * 4);
    }
  }
  return Buffer.from(encodePng({ width: w, height: h, data, channels: 4, depth: 8 }));
}
const px = (img, x, y) => Array.from(img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4));

async function newPage(opts = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, ...opts });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  // Nothing in these tests may reach the real skin services.
  await context.route(/playerdb\.co|textures\.minecraft\.net|mc-heads\.net/, (route) => route.abort());
  return { page, context, errors };
}

const api = (page, fn, arg) => page.evaluate(([f, a]) => {
  const e = document.querySelector('.sk-editor').__skinEditor;
  return new Function('e', 'a', `return (${f})(e, a)`)(e, a);
}, [fn.toString(), arg]);
const pixelAt = (page, x, y) => api(page, (e, [x, y]) => Array.from(e.getImage().data.slice((y * 64 + x) * 4, (y * 64 + x) * 4 + 4)), [x, y]);

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

async function download(page, kind) {
  await page.click('.sk-export-btn');
  await page.waitForSelector(`.sk-export-item[data-kind="${kind}"]`);
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.click(`.sk-export-item[data-kind="${kind}"]`)]);
  const file = await dl.path();
  return { name: dl.suggestedFilename(), bytes: readFileSync(file) };
}

async function closeModal(page) {
  for (let i = 0; i < 3; i++) {
    if (!(await page.$('dialog[open]'))) break;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }
  await page.waitForFunction(() => !document.querySelector('dialog[open]'), null, { timeout: 5000 });
}

const RED = [230, 30, 40, 255];

// =============================================================================================
// 1. Template → paint with mirror → export Java PNG → slim → reload → Bedrock pack
{
  const { page, context, errors } = await newPage();
  await page.goto(`${base}#/skins`);
  await page.waitForSelector('.sk-starter-template');
  await page.click('.sk-starter-template');
  await waitEditor(page);
  const where = await page.evaluate(() => location.pathname + location.hash);
  check('template creates a project and opens the editor', /\/skins\/[\w-]+$/.test(where), where);
  const headFront = await pixelAt(page, 9, 12);
  check('template paints the head', headFront[3] === 255, JSON.stringify(headFront));

  // Colour via the hex field of the inline picker, pencil, mirror on.
  await page.fill('.sk-block-color .cp-hex', '#e61e28');
  await page.keyboard.press('Enter');
  await page.keyboard.press('b');
  await page.click('.sk-toggle-btn');
  check('mirror toggle is on', (await page.getAttribute('.sk-toggle-btn', 'aria-pressed')) === 'true');
  await paintAt(page, 44, 22); // right arm, front, column 0
  await page.waitForTimeout(200);
  check('painted pixel on the right arm', eq(await pixelAt(page, 44, 22), RED), JSON.stringify(await pixelAt(page, 44, 22)));
  check('true body mirror paints the left arm', eq(await pixelAt(page, 39, 54), RED), JSON.stringify(await pixelAt(page, 39, 54)));
  // Right side face mirrors to the left side face of the other arm (flipped).
  await paintAt(page, 40, 25); // right arm, right side, column 0
  check('side faces mirror across limbs', eq(await pixelAt(page, 43, 57), RED), JSON.stringify(await pixelAt(page, 43, 57)));

  // Hover tooltip names the face.
  const [hx, hy] = await api(page, (e) => e.imageToClient(9, 10));
  await page.mouse.move(hx, hy);
  await page.waitForTimeout(150);
  const tipText = await page.textContent('.sk-tip');
  check('hover tooltip names part, face and layer', /Head · Front · Base layer/.test(tipText || ''), tipText);
  await page.screenshot({ path: path.join(shots, 'e2e-editor.png') });

  // Java PNG export
  const java = await download(page, 'java');
  const img = decodePng(java.bytes);
  check('Java export is a 64x64 PNG', img.width === 64 && img.height === 64 && java.name.endsWith('.png'), `${img.width}x${img.height} ${java.name}`);
  const toRgba = (d) => ({ width: d.width, height: d.height, data: d.channels === 4 ? d.data : null });
  const jimg = toRgba(img);
  check('exported PNG has the painted pixel', jimg.data && eq(px(jimg, 44, 22), RED), JSON.stringify(jimg.data && px(jimg, 44, 22)));
  check('exported PNG has the mirrored pixel', jimg.data && eq(px(jimg, 39, 54), RED), JSON.stringify(jimg.data && px(jimg, 39, 54)));
  check('export modal explains where to upload', /Skins/.test((await page.textContent('.modal')) || '') && /Classic/.test((await page.textContent('.modal')) || ''));
  await closeModal(page);

  // Rename
  await page.fill('.sk-name', 'Red Arms');
  await page.keyboard.press('Enter');

  // Switch to slim and convert the arms
  await page.click('.sk-3d-controls .segmented-item[data-value="slim"]');
  await page.waitForSelector('.modal');
  check('slim switch explains 3px arms', /3 pixels/.test((await page.textContent('.modal')) || ''));
  await page.click('.modal-footer >> text=Convert arms');
  await page.waitForTimeout(300);
  check('model is slim', (await api(page, (e) => e.model())) === 'slim');
  check('slim conversion keeps the outer column', eq(await pixelAt(page, 44, 22), RED));
  check('slim conversion moves the left arm pixel', eq(await pixelAt(page, 38, 54), RED), JSON.stringify(await pixelAt(page, 38, 54)));
  check('slim conversion clears the unused column', (await pixelAt(page, 55, 22))[3] === 0);

  // Persisted after reload
  await api(page, (e) => e.flush());
  await page.reload();
  await waitEditor(page);
  check('reload keeps the slim model', (await api(page, (e) => e.model())) === 'slim');
  check('reload keeps the painted pixels', eq(await pixelAt(page, 44, 22), RED) && eq(await pixelAt(page, 38, 54), RED));
  check('reload keeps the name', (await page.inputValue('.sk-name')) === 'Red Arms', await page.inputValue('.sk-name'));

  // Bedrock skin pack
  const pack = await download(page, 'bedrock-pack');
  const files = unzipSync(new Uint8Array(pack.bytes));
  const names = Object.keys(files).sort();
  check('mcpack file name', pack.name === 'Red Arms.mcpack', pack.name);
  check('mcpack contents', ['manifest.json', 'skins.json', 'texts/en_US.lang', 'texts/languages.json'].every((n) => names.includes(n)) && names.some((n) => /\.png$/.test(n)), names.join(','));
  const manifest = JSON.parse(strFromU8(files['manifest.json']));
  const skins = JSON.parse(strFromU8(files['skins.json']));
  const lang = strFromU8(files['texts/en_US.lang']);
  check('manifest is a skin pack', manifest.format_version === 2 && manifest.modules?.[0]?.type === 'skin_pack' && /^[0-9a-f-]{36}$/.test(manifest.header?.uuid), JSON.stringify(manifest));
  check('skins.json uses the slim geometry', skins.skins?.[0]?.geometry === 'geometry.humanoid.customSlim' && skins.skins[0].type === 'free', JSON.stringify(skins));
  check('lang names the pack and skin', lang.includes(`skinpack.${skins.localization_name}=Red Arms`) && lang.includes(`skin.${skins.localization_name}.${skins.skins[0].localization_name}=Red Arms`), lang);
  check('languages.json', eq(JSON.parse(strFromU8(files['texts/languages.json'])), ['en_US']));
  const packPng = decodePng(files[skins.skins[0].texture]);
  check('skin PNG in the pack is 64x64 with the pixels', packPng.width === 64 && packPng.height === 64 && eq(px(packPng, 44, 22), RED));
  await closeModal(page);
  const pack2 = await download(page, 'bedrock-pack');
  const manifest2 = JSON.parse(strFromU8(unzipSync(new Uint8Array(pack2.bytes))['manifest.json']));
  check('uuids stay stable across exports', manifest2.header.uuid === manifest.header.uuid && manifest2.modules[0].uuid === manifest.modules[0].uuid);
  check('pack version goes up', manifest2.header.version[2] === manifest.header.version[2] + 1, `${manifest.header.version} -> ${manifest2.header.version}`);
  await closeModal(page);

  // Legacy export
  await page.click('.sk-export-btn');
  await page.click('.sk-export-item[data-kind="java-legacy"]');
  await page.waitForSelector('.sk-losses, .sk-note');
  const lossText = (await page.textContent('.modal')) || '';
  check('legacy export explains what is lost', /slim arms/i.test(lossText), lossText.slice(0, 200));
  const [ldl] = await Promise.all([page.waitForEvent('download'), page.click('.modal-footer >> text=Download 64×32 PNG')]);
  const legacy = decodePng(readFileSync(await ldl.path()));
  check('legacy export is 64x32', legacy.width === 64 && legacy.height === 32 && eq(px(legacy, 44, 22), RED));

  // Bedrock PNG
  const bpng = await download(page, 'bedrock-png');
  check('Bedrock PNG export', decodePng(bpng.bytes).width === 64 && /bedrock\.png$/.test(bpng.name), bpng.name);
  await closeModal(page);

  // Shortcuts sheet
  await page.locator('.pc-root').focus();
  await page.keyboard.press('?');
  await page.waitForSelector('.shortcuts-modal');
  check('? opens the shortcuts sheet', /Mirror/.test((await page.textContent('.shortcuts-modal')) || ''));
  await closeModal(page);

  // Undo via toolbar
  const before = await pixelAt(page, 44, 22);
  await page.fill('.sk-block-color .cp-hex', '#10ff10');
  await page.keyboard.press('Enter');
  await paintAt(page, 44, 22);
  await page.click('.sk-bar-actions [aria-label^="Undo"]');
  check('undo button reverts the stroke', eq(await pixelAt(page, 44, 22), before));

  // Lock to part keeps paint inside
  await page.click('.sk-part[data-part="head"] [aria-label^="Only paint"]');
  await paintAt(page, 20, 22); // body front
  check('lock to part blocks painting elsewhere', !eq(await pixelAt(page, 20, 22), [16, 255, 16, 255]));
  await paintAt(page, 10, 12); // head front
  check('lock to part allows the locked part', eq(await pixelAt(page, 10, 12), [16, 255, 16, 255]), JSON.stringify(await pixelAt(page, 10, 12)));

  // Part menu: fill the right leg, then copy it to the left leg.
  await page.click('.sk-part[data-part="head"] [aria-label^="Only paint"]'); // unlock
  await page.click('.sk-part[data-part="rightLeg"] [aria-label^="More for"]');
  await page.click('.menu-item >> text=Fill right leg with colour');
  check('part menu fills the part', eq(await pixelAt(page, 5, 25), [16, 255, 16, 255]), JSON.stringify(await pixelAt(page, 5, 25)));
  await page.click('.sk-part[data-part="rightLeg"] [aria-label^="More for"]');
  await page.click('.menu-item >> text=Copy to left leg');
  check('part menu copies to the other side', eq(await pixelAt(page, 22, 57), [16, 255, 16, 255]), JSON.stringify(await pixelAt(page, 22, 57)));
  // Hiding a part in 3D and toggling guides must not throw.
  await page.click('.sk-part[data-part="leftLeg"] [aria-label^="Show"]');
  check('eye button hides the part', (await page.getAttribute('.sk-part[data-part="leftLeg"] [aria-label^="Show"]', 'aria-pressed')) === 'false');
  await page.locator('.pc-root').focus();
  await page.keyboard.press('p');
  check('P toggles part guides', (await page.getAttribute('[aria-label^="Part guides"]', 'aria-pressed')) === 'false');
  await page.keyboard.press('p');
  // Flipping without a selection is refused with a hint.
  const beforeFlip = await api(page, (e) => Array.from(e.getImage().data).join(','));
  await page.keyboard.press('h');
  await page.waitForTimeout(150);
  const afterFlip = await api(page, (e) => Array.from(e.getImage().data).join(','));
  check('H without a selection does not scramble the skin', beforeFlip === afterFlip);
  check('H without a selection explains why', /Select an area first/.test((await page.textContent('.toast-region')) || ''));
  // Back to the start screen: the skin is listed.
  await api(page, (e) => e.flush());
  await page.click('.sk-bar [aria-label="All skins"]');
  await page.waitForSelector('.sk-recent');
  check('recent skins list the project', /Red Arms/.test((await page.textContent('.sk-recent-grid')) || ''));

  check('no page errors (editor flow)', errors.length === 0, errors.join(' | '));
  await context.close();
}

// =============================================================================================
// 1b. Skin pack maker: bundle two saved skins into one .mcpack
{
  const { page, context, errors } = await newPage();
  const rename = async (name) => {
    await page.fill('.sk-name', name);
    await page.keyboard.press('Enter');
    await api(page, (e) => e.flush());
  };
  await page.goto(`${base}#/skins`);
  await page.waitForSelector('.sk-starter-template');
  await page.click('.sk-starter-template');
  await waitEditor(page);
  check('first skin starts classic', (await api(page, (e) => e.model())) === 'classic');
  await rename('Classic Pal');
  await page.click('.sk-bar [aria-label="All skins"]');
  await page.waitForSelector('.sk-model-pick .segmented-item[data-value="slim"]');
  await page.click('.sk-model-pick .segmented-item[data-value="slim"]');
  await page.click('.sk-starter-robot');
  await waitEditor(page);
  check('second skin starts slim', (await api(page, (e) => e.model())) === 'slim');
  await rename('Slim Bot');

  // The pack modal lists the current skin first plus the other saved skin.
  await page.click('.sk-export-btn');
  await page.click('.sk-export-item[data-kind="bedrock-pack"]');
  await page.waitForSelector('.sk-pack-list .sk-pack-skin:not(.is-current)');
  const rows = await page.$$eval('.sk-pack-skin', (els) => els.map((e) => ({ text: e.textContent, current: e.classList.contains('is-current'), checked: e.querySelector('input').checked })));
  check('pack modal shows this skin first, always included', rows[0]?.current && rows[0].checked && /Slim Bot/.test(rows[0].text) && /Slim arms/.test(rows[0].text), JSON.stringify(rows));
  check('pack modal lists the other saved skin, unticked', rows.length === 2 && /Classic Pal/.test(rows[1].text) && /Classic arms/.test(rows[1].text) && !rows[1].checked, JSON.stringify(rows));
  check('pack name defaults to the skin name', (await page.inputValue('.sk-pack .input')) === 'Slim Bot');
  await page.click('.sk-pack-skin:not(.is-current)');
  check('ticking a skin updates the count', (await page.textContent('.sk-pack-count')) === '2 skins', await page.textContent('.sk-pack-count'));
  await page.fill('.sk-pack .input', 'Duo Pack');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(shots, 'e2e-skin-pack.png') });
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.click('.modal-footer >> text=Download pack')]);
  const readPack = async (d) => unzipSync(new Uint8Array(readFileSync(await d.path())));
  const files = await readPack(dl);
  const skins = JSON.parse(strFromU8(files['skins.json']));
  const manifest = JSON.parse(strFromU8(files['manifest.json']));
  const lang = strFromU8(files['texts/en_US.lang']);
  check('pack file is named after the pack', dl.suggestedFilename() === 'Duo Pack.mcpack', dl.suggestedFilename());
  check('skins.json has 2 skins with their own geometry', eq(skins.skins?.map((x) => x.geometry), ['geometry.humanoid.customSlim', 'geometry.humanoid.custom']), JSON.stringify(skins));
  check('both skin PNGs are in the pack', skins.skins.every((x) => files[x.texture] && decodePng(files[x.texture]).width === 64));
  check('lang names the pack and both skins', lang.includes('=Duo Pack\n') && lang.includes('=Slim Bot\n') && lang.includes('=Classic Pal\n'), lang);
  check('manifest header uses the pack name', manifest.header?.name === 'Duo Pack', JSON.stringify(manifest.header));
  await page.waitForSelector('.sk-export-meta');
  const meta = await page.textContent('.sk-export-meta');
  check('ready modal counts the skins', /Pack v1\.0\.0 · 2 skins/.test(meta || ''), meta);
  check('ready modal is titled for a pack', /skin pack is ready/.test((await page.textContent('.modal-title')) || ''));
  await closeModal(page);

  // The choice is saved with the project: after a reload the pack keeps both skins.
  await api(page, (e) => e.flush());
  await page.reload();
  await waitEditor(page);
  await page.click('.sk-export-btn');
  await page.click('.sk-export-item[data-kind="bedrock-pack"]');
  await page.waitForSelector('.sk-pack-list .sk-pack-skin:not(.is-current)');
  check('pack modal remembers the chosen skins', await page.isChecked('.sk-pack-skin:not(.is-current) input'));
  check('pack modal remembers the pack name', (await page.inputValue('.sk-pack .input')) === 'Duo Pack');
  const [dl2] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.click('.modal-footer >> text=Download pack')]);
  const files2 = await readPack(dl2);
  const manifest2 = JSON.parse(strFromU8(files2['manifest.json']));
  check('re-export keeps both skins', JSON.parse(strFromU8(files2['skins.json'])).skins.length === 2);
  check('re-export keeps the uuids and bumps the version', manifest2.header.uuid === manifest.header.uuid && eq(manifest2.header.version, [1, 0, 1]), JSON.stringify(manifest2.header));
  await closeModal(page);

  // Cancel downloads nothing.
  let downloads = 0;
  page.on('download', () => downloads++);
  await page.click('.sk-export-btn');
  await page.click('.sk-export-item[data-kind="bedrock-pack"]');
  await page.waitForSelector('.sk-pack-list');
  await page.click('.modal-footer >> text=Cancel');
  await page.waitForTimeout(500);
  check('cancelling the pack modal downloads nothing', downloads === 0 && !(await page.$('dialog[open]')));

  check('no page errors (skin pack)', errors.length === 0, errors.join(' | '));
  await context.close();
}

// =============================================================================================
// 2. Upload a legacy 64x32 PNG
{
  const { page, context, errors } = await newPage();
  await page.goto(`${base}#/skins`);
  await page.waitForSelector('.sk-import .dropzone');
  const BLUE = [20, 60, 220, 255];
  const legacyPng = makePng(64, 32, (x, y) => {
    if (x >= 44 && x < 48 && y >= 20 && y < 32) return x === 44 ? BLUE : [200, 150, 110, 255]; // right arm front
    if (y >= 16) return [90, 90, 90, 255];
    if (x < 32) return [180, 130, 90, 255];
    return [0, 0, 0, 0];
  });
  // Wrong size first
  await page.setInputFiles('.sk-import .dropzone input[type=file]', { name: 'bad.png', mimeType: 'image/png', buffer: makePng(100, 50, () => [1, 2, 3, 255]) });
  await page.waitForSelector('.dropzone-error:not([hidden])');
  const err = await page.textContent('.dropzone-error');
  check('wrong size is explained', /100×50/.test(err || '') && /64×64/.test(err || ''), err);
  await page.setInputFiles('.sk-import .dropzone input[type=file]', { name: 'old_skin.png', mimeType: 'image/png', buffer: legacyPng });
  await waitEditor(page);
  const img = await api(page, (e) => ({ w: e.getImage().width, h: e.getImage().height }));
  check('legacy upload becomes 64x64', img.w === 64 && img.h === 64);
  check('legacy right arm kept', eq(await pixelAt(page, 44, 22), BLUE));
  check('legacy left arm is the mirrored right arm', eq(await pixelAt(page, 39, 52), BLUE), JSON.stringify(await pixelAt(page, 39, 52)));
  check('legacy upload named from the file', (await page.inputValue('.sk-name')) === 'old skin');
  check('no page errors (upload)', errors.length === 0, errors.join(' | '));
  await context.close();
}

// =============================================================================================
// 3. Import by username (routed to local fixtures)
{
  const { page, context, errors } = await newPage();
  const GREEN = [30, 200, 60, 255];
  const skinPng = makePng(64, 64, (x, y) => {
    if (x === 8 && y === 8) return GREEN;
    // slim: 4th arm columns stay empty
    const inRect = (rx, ry, w, h) => x >= rx && x < rx + w && y >= ry && y < ry + h;
    if (inRect(0, 0, 32, 16) || inRect(0, 16, 54, 16) || inRect(16, 48, 30, 16)) return [150, 110, 80, 255];
    return [0, 0, 0, 0];
  });
  const textures = Buffer.from(JSON.stringify({ textures: { SKIN: { url: 'http://textures.minecraft.net/texture/fixture', metadata: { model: 'slim' } } } })).toString('base64');
  await context.unroute(/playerdb\.co|textures\.minecraft\.net|mc-heads\.net/);
  let requested = [];
  await context.route(/playerdb\.co|textures\.minecraft\.net|mc-heads\.net/, async (route) => {
    const url = route.request().url();
    requested.push(url);
    if (url.includes('playerdb.co') && /Nobody_Here/.test(url)) {
      return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ message: 'No Minecraft user could be found.', code: 'minecraft.invalid_username', data: {}, success: false }) });
    }
    if (url.includes('playerdb.co')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ code: 'player.found', success: true, data: { player: { username: 'Fixture_Player', skin_texture: 'https://textures.minecraft.net/texture/fixture', properties: [{ name: 'textures', value: textures }] } } }),
      });
    }
    if (url.includes('textures.minecraft.net/texture/fixture')) return route.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: skinPng });
    return route.abort();
  });
  await page.goto(`${base}#/skins`);
  await page.waitForSelector('#sk-username');
  await page.fill('#sk-username', 'bad name!');
  await page.click('.sk-user-row .btn');
  check('invalid username is explained', /letters, numbers or underscores/.test((await page.textContent('.sk-field-error')) || ''));
  await page.fill('#sk-username', 'Nobody_Here');
  await page.click('.sk-user-row .btn');
  await page.waitForFunction(() => /No Java Edition player/.test(document.querySelector('.sk-field-error')?.textContent || ''));
  check('unknown player is explained', true);
  await page.fill('#sk-username', 'fixture_player');
  await page.click('.sk-user-row .btn');
  await waitEditor(page);
  check('username import opens the editor', (await page.inputValue('.sk-name')) === "Fixture_Player's skin", await page.inputValue('.sk-name'));
  check('username import uses the profile model (slim)', (await api(page, (e) => e.model())) === 'slim');
  check('username import keeps the pixels', eq(await pixelAt(page, 8, 8), GREEN));
  check('skin came from textures.minecraft.net over https', requested.some((u) => u.startsWith('https://textures.minecraft.net/texture/fixture')));
  check('no page errors (username)', errors.length === 0, errors.join(' | '));
  await context.close();
}

// =============================================================================================
// 4. Default skins from the game files (local jar served with Range support)
if (jarPath && existsSync(jarPath)) {
  const { page, context, errors } = await newPage();
  const size = statSync(jarPath).size;
  const fd = openSync(jarPath, 'r');
  await context.route(/piston-data\.mojang\.com\/v1\/objects\/.*client\.jar/, async (route) => {
    const range = route.request().headers()['range'];
    const m = range && /bytes=(\d+)-(\d*)/.exec(range);
    const start = m ? Number(m[1]) : 0;
    const end = m && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    const buf = Buffer.alloc(end - start + 1);
    readSync(fd, buf, 0, buf.length, start);
    await route.fulfill({
      status: m ? 206 : 200,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-expose-headers': 'content-range, content-length',
        'content-type': 'application/java-archive',
        ...(m ? { 'content-range': `bytes ${start}-${end}/${size}` } : {}),
      },
      body: buf,
    });
  });
  await page.goto(`${base}#/skins`);
  await page.click('text=Choose a default skin');
  const ok = await page.waitForSelector('.sk-default', { timeout: 90000 }).then(() => true).catch(() => false);
  if (ok) {
    const count = await page.locator('.sk-default').count();
    check('game files list the default skins', count === 9, String(count));
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(shots, 'e2e-defaults.png') });
    await page.click('.sk-defaults .segmented-item[data-value="slim"]');
    await page.click('.sk-default[aria-label^="Alex"]');
    await waitEditor(page);
    check('Alex opens as a slim skin', (await page.inputValue('.sk-name')) === 'Alex' && (await api(page, (e) => e.model())) === 'slim');
    const face = await pixelAt(page, 10, 12);
    check('Alex skin pixels come from the jar', face[3] === 255);
  } else {
    const txt = await page.textContent('.modal').catch(() => '');
    check('game files load (needs network for the version list)', false, txt?.slice(0, 200));
  }
  closeSync(fd);
  check('no page errors (game files)', errors.filter((e) => !/piston|mojang/i.test(e)).length === 0, errors.join(' | '));
  await context.close();
} else {
  console.log('SKIP  game files check (set SKINS_JAR to a 26.3 client jar)');
}

// =============================================================================================
// 5. Phone layout: bottom tabs Paint / 3D / Parts
{
  const { page, context, errors } = await newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await page.goto(`${base}#/skins`);
  await page.click('.sk-starter-robot');
  await waitEditor(page);
  const tabs = await page.$$eval('.editor-tab', (els) => els.map((e) => ({ label: e.textContent?.trim(), order: getComputedStyle(e).order })).sort((a, b) => Number(a.order) - Number(b.order)).map((t) => t.label));
  check('phone tabs read Paint / 3D / Parts', eq(tabs, ['Paint', '3D', 'Parts']), JSON.stringify(tabs));
  await page.click('.editor-tab[data-panel="right"]');
  await page.waitForTimeout(500);
  check('3D tab shows the preview', await page.isVisible('.sk-3d-wrap'));
  await page.click('.editor-tab[data-panel="left"]');
  check('Parts tab lists the parts', await page.isVisible('.sk-part[data-part="leftLeg"]'));
  check('no page errors (phone)', errors.length === 0, errors.join(' | '));
  await context.close();
}

// =============================================================================================
// 6. HD 128x128 skins: create, paint, export Bedrock PNG / pack (kept HD) and Java (reduced),
//    Make HD / Reduce, uploads, the start page and phone widths.
{
  const { page, context, errors } = await newPage();
  const pixelHd = (x, y) => api(page, (e, [x, y]) => {
    const img = e.getImage();
    const i = (y * img.width + x) * 4;
    return Array.from(img.data.slice(i, i + 4));
  }, [x, y]);
  const size = () => api(page, (e) => e.size());
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  /** Screenshots at 1280 and 390 px, dark and light. */
  const hdShots = async (name) => {
    const vp = page.viewportSize();
    for (const theme of ['dark', 'light']) {
      await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme);
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 860 });
        await page.waitForTimeout(450);
        await page.screenshot({ path: path.join(shots, `hd-${name}-${width}-${theme}.png`) });
      }
    }
    await page.evaluate(() => (document.documentElement.dataset.theme = 'dark'));
    await page.setViewportSize(vp);
    await page.waitForTimeout(300);
  };

  await page.goto(`${base}#/skins`);
  await page.waitForSelector('.sk-model-pick .segmented-item[data-value="128"]');
  await page.click('.sk-model-pick .segmented-item[data-value="128"]');
  const note = await page.textContent('.sk-size-note');
  check('HD size explains Bedrock only', /HD skin, Bedrock only/.test(note || '') && /Java/.test(note || ''), note);
  await hdShots('start');
  await page.click('.sk-starter-template');
  await waitEditor(page);
  check('HD template opens a 128x128 skin', (await size()) === 128, String(await size()));
  check('HD badge in the top bar', await page.isVisible('.sk-hd-badge'));
  check('HD template is the template doubled', eq(await pixelHd(18, 24), await pixelHd(19, 25)) && (await pixelHd(18, 24))[3] === 255);
  check('size control shows HD', (await page.getAttribute('.sk-size-seg [data-value="128"]', 'aria-checked')) === 'true');

  // Paint one HD pixel with mirror on: the true body mirror works per HD pixel.
  await page.fill('.sk-block-color .cp-hex', '#e61e28');
  await page.keyboard.press('Enter');
  await page.keyboard.press('b');
  await page.click('.sk-toggle-btn');
  await paintAt(page, 88, 44); // right arm, front, first HD column
  await page.waitForTimeout(200);
  check('HD paints a single 128-grid pixel', eq(await pixelHd(88, 44), RED) && !eq(await pixelHd(89, 44), RED), JSON.stringify([await pixelHd(88, 44), await pixelHd(89, 44)]));
  check('HD mirror paints the left arm pixel', eq(await pixelHd(79, 108), RED), JSON.stringify(await pixelHd(79, 108)));
  await page.click('.sk-toggle-btn');
  const [hx, hy] = await api(page, (e) => e.imageToClient(20, 20));
  await page.mouse.move(hx, hy);
  await page.waitForTimeout(150);
  check('HD hover names the face', /Head · Front · Base layer/.test((await page.textContent('.sk-tip')) || ''), await page.textContent('.sk-tip'));
  check('HD brush goes up to 16 px', (await page.getAttribute('.sk-block-brush input[type=range]', 'max')) === '16');
  await hdShots('editor');

  // Bedrock PNG keeps HD.
  const bpng = await download(page, 'bedrock-png');
  const bimg = decodePng(bpng.bytes);
  check('Bedrock PNG export is 128x128', bimg.width === 128 && bimg.height === 128 && eq(px(bimg, 88, 44), RED), `${bimg.width}x${bimg.height}`);
  check('Bedrock ready modal says HD', /128×128 HD/.test((await page.textContent('.sk-export-meta')) || ''), await page.textContent('.sk-export-meta'));
  await closeModal(page);

  // Java: asks first, explains, downloads 64x64.
  await page.click('.sk-export-btn');
  await page.waitForSelector('.sk-export-item[data-kind="java"]');
  check('export menu says Java is reduced', /Reduced to 64×64/.test((await page.textContent('.sk-export-item[data-kind="java"]')) || ''));
  await page.click('.sk-export-item[data-kind="java"]');
  await page.waitForSelector('.sk-java-hd-note');
  check('Java HD export explains the 64x64 limit', /Java Edition only shows 64×64 skins without mods/.test((await page.textContent('.modal')) || ''));
  await hdShots('java-export');
  const [jdl] = await Promise.all([page.waitForEvent('download'), page.click('.modal-footer .btn-primary')]);
  const jimg = decodePng(readFileSync(await jdl.path()));
  check('Java export of an HD skin is 64x64', jimg.width === 64 && jimg.height === 64 && jdl.suggestedFilename().endsWith('.png'), `${jimg.width}x${jimg.height}`);
  await page.waitForSelector('.sk-export-notes');
  check('Java ready modal keeps the note', /only shows 64×64 skins without mods/.test((await page.textContent('.sk-export-notes')) || ''));
  await closeModal(page);
  // The HD file for mods, on request.
  await page.click('.sk-export-btn');
  await page.click('.sk-export-item[data-kind="java"]');
  await page.waitForSelector('.sk-java-hd-note');
  const [hdl] = await Promise.all([page.waitForEvent('download'), page.click('.modal-footer .btn-secondary')]);
  const himg = decodePng(readFileSync(await hdl.path()));
  check('Java HD-mod export is 128x128', himg.width === 128 && /-hd\.png$/.test(hdl.suggestedFilename()), `${himg.width} ${hdl.suggestedFilename()}`);
  await closeModal(page);
  // Old 64x32 from the reduced skin.
  await page.click('.sk-export-btn');
  await page.click('.sk-export-item[data-kind="java-legacy"]');
  await page.waitForSelector('.modal-footer .btn-primary');
  const [ldl] = await Promise.all([page.waitForEvent('download'), page.click('.modal-footer .btn-primary')]);
  const limg = decodePng(readFileSync(await ldl.path()));
  check('legacy export of an HD skin is 64x32', limg.width === 64 && limg.height === 32);
  await closeModal(page);

  // Pack with only this HD skin.
  await page.fill('.sk-name', 'HD Hero');
  await api(page, (e) => e.flush());
  const pack = await download(page, 'bedrock-pack');
  const pfiles = unzipSync(new Uint8Array(pack.bytes));
  const pskins = JSON.parse(strFromU8(pfiles['skins.json']));
  const ppng = decodePng(pfiles[pskins.skins[0].texture]);
  check('HD skin pack keeps 128x128', ppng.width === 128 && pskins.skins[0].geometry === 'geometry.humanoid.custom', `${ppng.width}`);
  await closeModal(page);

  // Reload keeps HD.
  await page.reload();
  await waitEditor(page);
  check('reload keeps the HD skin', (await size()) === 128 && eq(await pixelHd(88, 44), RED));

  // Reduce to 64x64 (warns about detail), undo, make HD again.
  await page.click('.sk-size-seg [data-value="64"]');
  await page.waitForSelector('.modal .sk-export-compare');
  const reduceText = (await page.textContent('.modal')) || '';
  check('reduce warns about lost detail', /finer HD detail/.test(reduceText) && /Java export makes a 64×64 copy/.test(reduceText), reduceText.slice(0, 200));
  await hdShots('reduce');
  await page.click('.modal-footer .btn-primary');
  await page.waitForTimeout(300);
  check('reduce makes a 64x64 skin', (await size()) === 64 && !(await page.isVisible('.sk-hd-badge')));
  check('reduce keeps the layout (head pixel)', (await pixelHd(9, 12))[3] === 255);
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(300);
  check('undo brings HD back', (await size()) === 128 && eq(await pixelHd(88, 44), RED) && (await page.getAttribute('.sk-size-seg [data-value="128"]', 'aria-checked')) === 'true');
  check('mask follows the size (painting still works after undo)', await (async () => {
    await paintAt(page, 18, 18);
    await page.waitForTimeout(150);
    return eq(await pixelHd(18, 18), RED);
  })());

  // A 64x64 skin in the same pack: sizes mix.
  await page.goto(`${base}#/skins`);
  await page.click('.sk-model-pick .segmented-item[data-value="64"]');
  await page.waitForSelector('.sk-recent .sk-hd-tag:not([hidden])');
  check('recent list tags HD skins', /HD/.test((await page.textContent('.sk-recent-grid')) || ''));
  await page.click('.sk-starter-robot');
  await waitEditor(page);
  check('64x64 starter after switching back', (await size()) === 64);
  await page.click('.sk-export-btn');
  await page.click('.sk-export-item[data-kind="bedrock-pack"]');
  await page.waitForSelector('.sk-pack-skin:not(.is-current)');
  await page.waitForTimeout(300);
  check('pack modal marks the HD skin', /HD 128×128/.test((await page.textContent('.sk-pack-skin:not(.is-current)')) || ''), await page.textContent('.sk-pack-skin:not(.is-current)'));
  await page.check('.sk-pack-skin:not(.is-current) input');
  const [mdl] = await Promise.all([page.waitForEvent('download'), page.click('.modal-footer .btn-primary')]);
  const mfiles = unzipSync(new Uint8Array(readFileSync(await mdl.path())));
  const mskins = JSON.parse(strFromU8(mfiles['skins.json']));
  const msizes = mskins.skins.map((s) => decodePng(mfiles[s.texture]).width);
  check('mixed pack has a 64x64 and a 128x128 skin', eq(msizes, [64, 128]), JSON.stringify(msizes));
  await page.waitForSelector('.sk-export-meta');
  check('mixed pack modal counts the HD skin', /2 skins · 1 HD/.test((await page.textContent('.sk-export-meta')) || ''), await page.textContent('.sk-export-meta'));
  await closeModal(page);

  // Make HD from 64x64.
  await page.click('.sk-size-seg [data-value="128"]');
  await page.waitForSelector('.modal-footer .btn-primary');
  check('Make HD explains Bedrock only', /HD skins are for Bedrock Edition/.test((await page.textContent('.modal')) || ''));
  const before = await pixelHd(9, 12);
  await page.click('.modal-footer .btn-primary');
  await page.waitForTimeout(300);
  check('Make HD doubles the skin', (await size()) === 128 && eq(await pixelHd(18, 24), before) && eq(await pixelHd(19, 25), before));

  // Uploads: HD stays HD; a 64x64 upload is doubled while HD is picked.
  await page.goto(`${base}#/skins`);
  const hdPng = makePng(128, 128, (x, y) => (x < 64 && y < 32 ? [20, 140, 60, 255] : y >= 16 && y < 64 ? [90, 60, 200, 255] : [0, 0, 0, 0]));
  await page.waitForSelector('.sk-import .dropzone');
  await page.setInputFiles('.sk-import .dropzone input[type=file]', { name: 'hd_skin.png', mimeType: 'image/png', buffer: hdPng });
  await waitEditor(page);
  check('HD upload stays 128x128', (await size()) === 128 && eq(await pixelHd(1, 1), [20, 140, 60, 255]));
  check('HD upload says it stays HD', /stays HD/.test((await page.textContent('.toast-region')) || ''));
  await page.goto(`${base}#/skins`);
  await page.click('.sk-model-pick .segmented-item[data-value="128"]');
  const sdPng = makePng(64, 64, (x, y) => (y < 16 ? [200, 100, 20, 255] : [0, 0, 0, 0]));
  await page.waitForSelector('.sk-import .dropzone');
  await page.setInputFiles('.sk-import .dropzone input[type=file]', { name: 'small.png', mimeType: 'image/png', buffer: sdPng });
  await waitEditor(page);
  check('64x64 upload is doubled when HD is picked', (await size()) === 128 && eq(await pixelHd(17, 17), [200, 100, 20, 255]));

  // Phone width: no horizontal scroll on the start page and the HD editor.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  check('HD editor fits a phone (no horizontal scroll)', (await overflow()) <= 0, String(await overflow()));
  await page.goto(`${base}#/skins`);
  await page.waitForSelector('.sk-size-note');
  check('start page fits a phone (no horizontal scroll)', (await overflow()) <= 0, String(await overflow()));
  check('no page errors (HD)', errors.length === 0, errors.join(' | '));
  await context.close();
}

await browser.close();
await server.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
