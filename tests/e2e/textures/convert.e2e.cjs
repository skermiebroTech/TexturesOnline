// End-to-end test of the texture pack converter in Chromium.
// Usage: NODE_PATH=$(npm root -g) TO_FIXTURES=<dir> node tests/e2e/textures/convert.e2e.cjs [baseUrl] [--shots <dir>]
// Builds tiny packs on the fly (original pixel art, no game files): a Java 1.12.2 pack, a Bedrock
// pack and a zip of loose PNGs. Java 26.3 game files come from TO_FIXTURES (client jar, routed
// locally) or the real network; Bedrock game files come from GitHub (network needed).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ROOT, startVite, launch, routeMojang, fixturesDir, unzip, decodePng } = require('./lib.cjs');

const argv = process.argv.slice(2);
const baseArg = argv.find((a) => /^https?:/.test(a));
const shotsDir = argv.includes('--shots') ? argv[argv.indexOf('--shots') + 1] : null;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tx-convert-'));
const J = 'assets/minecraft/textures/';

let failures = 0;
const results = [];
function check(name, ok, detail = '') {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  console.log(results[results.length - 1]);
  if (!ok) failures++;
}

// ------------------------------------------------------------------ test packs
async function encodePng(w, h, fn) {
  const { encode } = await import(path.join(ROOT, 'node_modules/fast-png/lib/index.js'));
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(fn(x, y), (y * w + x) * 4);
  return encode({ width: w, height: h, data, channels: 4, depth: 8 });
}
const checkerArt = (a, b) => (x, y) => (((x >> 2) + (y >> 2)) % 2 ? a : b);
const enc = (s) => new TextEncoder().encode(typeof s === 'string' ? s : JSON.stringify(s));

async function makePacks() {
  const { zipSync } = require(path.join(ROOT, 'node_modules/fflate'));
  const RED = [220, 30, 30, 255];
  const BLUE = [30, 60, 220, 255];
  const frames = (w, n) => (x, y) => [40 * (Math.floor(y / w) + 1), 120, 90, 255];
  const java = zipSync({
    'pack.mcmeta': enc({ pack: { pack_format: 3, description: 'Old school pack' } }),
    'pack.png': await encodePng(64, 64, checkerArt([250, 200, 40, 255], [40, 40, 40, 255])),
    [`${J}blocks/stone.png`]: await encodePng(16, 16, checkerArt(RED, [90, 90, 90, 255])),
    [`${J}blocks/grass_top.png`]: await encodePng(16, 16, checkerArt([60, 160, 60, 255], [80, 190, 70, 255])),
    [`${J}blocks/sea_lantern.png`]: await encodePng(16, 80, frames(16, 5)),
    [`${J}blocks/sea_lantern.png.mcmeta`]: enc({ animation: { frametime: 5, interpolate: true } }),
    'assets/minecraft/models/block/stone.json': enc({ parent: 'block/cube_all', textures: { all: 'blocks/stone' } }),
    'assets/minecraft/sounds/dig/stone1.ogg': new Uint8Array([79, 103, 103, 83]),
  });
  const bedrock = zipSync({
    'manifest.json': enc({
      format_version: 2,
      header: { name: 'Phone Pack', description: 'Made on a phone', uuid: '8f0b5a0e-6c55-4d3b-9b1e-0a4c2f9d7e11', version: [1, 0, 0], min_engine_version: [1, 21, 0] },
      modules: [{ type: 'resources', uuid: '2a6d8c1b-3f4e-4a5b-8c7d-9e0f1a2b3c4d', version: [1, 0, 0] }],
    }),
    'pack_icon.png': await encodePng(64, 64, checkerArt([40, 120, 250, 255], [250, 250, 250, 255])),
    'textures/blocks/stone.png': await encodePng(16, 16, checkerArt(BLUE, [90, 90, 90, 255])),
    'textures/blocks/sea_lantern.png': await encodePng(16, 64, frames(16, 4)),
    'textures/flipbook_textures.json': enc([{ flipbook_texture: 'textures/blocks/sea_lantern', atlas_tile: 'sea_lantern', ticks_per_frame: 3, blend_frames: false }]),
    'texts/en_US.lang': enc('pack.name=Phone Pack'),
  });
  const loose = zipSync({
    'My textures/stone.png': await encodePng(16, 16, checkerArt([250, 120, 0, 255], [60, 60, 60, 255])),
    'My textures/diamond_sword.png': await encodePng(16, 16, (x, y) => (x === y ? [80, 220, 230, 255] : [0, 0, 0, 0])),
    'My textures/holiday photo.png': await encodePng(8, 8, () => [1, 2, 3, 255]),
  });
  const files = { java: path.join(tmp, 'Old School.zip'), bedrock: path.join(tmp, 'Phone Pack.mcpack'), loose: path.join(tmp, 'My textures.zip') };
  fs.writeFileSync(files.java, java);
  fs.writeFileSync(files.bedrock, bedrock);
  fs.writeFileSync(files.loose, loose);
  return files;
}

// ------------------------------------------------------------------ helpers
async function openSource(page, file) {
  await page.setInputFiles('.cv-dz input[type=file]', file);
  await page.waitForSelector('.cv-pack:not([hidden]) .cv-pack-name', { timeout: 60000 });
}

async function convertTo(page, edition, version) {
  await page.click(`.cv-ed[data-value="${edition}"]`);
  if (edition === 'java' && version) {
    const cur = await page.textContent('.cv-version .vp-trigger');
    if (!cur.includes(version)) {
      await page.click('.cv-version .vp-trigger');
      await page.fill('.vp-pop input[type=search]', version);
      await page.click(`.vp-item:has(.vp-item-name:text-is("${version}"))`);
    }
  }
  await page.click('.cv-go');
  await page.waitForSelector('.cv-result .cv-dl-btn, .cv-result .cv-res-icon.is-error', { timeout: 300000 });
  const err = await page.$('.cv-result .cv-res-icon.is-error');
  if (err) throw new Error(`conversion failed: ${(await page.textContent('.cv-result')).trim().slice(0, 300)}`);
}

async function download(page) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 180000 }), page.click('.cv-dl-btn')]);
  const file = path.join(tmp, dl.suggestedFilename());
  await dl.saveAs(file);
  await page.waitForSelector('.cv-install:not([hidden])', { timeout: 30000 });
  return { file, name: dl.suggestedFilename(), zip: unzip(file) };
}

const json = (b) => (b ? JSON.parse(Buffer.from(b).toString('utf8').replace(/^\/\/.*$/gm, '')) : undefined);

async function shot(page, name) {
  if (!shotsDir) return;
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(shotsDir, `${name}.png`), fullPage: true });
}

// ------------------------------------------------------------------ run
(async () => {
  const packs = await makePacks();
  const server = baseArg ? null : await startVite();
  const base = baseArg || server.url;
  const fx = fixturesDir();
  console.log(`base ${base} · fixtures ${fx ?? '(none: real network)'} · tmp ${tmp}`);
  if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });
  const browser = await launch();
  const errors = [];
  try {
    const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 860 } });
    await routeMojang(ctx, fx);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon|ERR_|404/.test(m.text())) errors.push(m.text());
    });

    // entry point on the texture start screen
    await page.goto(base + 'textures');
    await page.waitForSelector('.tx-convert-link');
    await page.click('.tx-convert-link');
    await page.waitForURL(/texture-pack-converter\/?$/, { timeout: 15000 });
    await page.waitForSelector('.cv-dz');
    check('"Convert a pack" on the texture start screen opens the converter', true);
    await page.waitForSelector('[data-tool-intro]', { timeout: 15000 }).catch(() => null);
    check('the converter introduction is mounted below the tool', !!(await page.$('.cv-page [data-tool-intro], [data-tool-intro]')));
    check('nothing to convert before a pack is chosen', await page.isDisabled('.cv-go'));
    await shot(page, 'convert-1-start');

    // ---------------------------------------------------------------- Java 1.12.2 -> Java 26.3
    await openSource(page, packs.java);
    const badgeText = await page.textContent('.cv-pack-badges');
    check('detected a Java 1.12.2 pack', /Java 1\.12\.2/.test(badgeText), badgeText);
    check('pack summary counts its textures', /3 textures/.test(await page.textContent('.cv-pack-info')));
    check('Bedrock is the default target for a Java pack', (await page.getAttribute('.cv-ed[data-value="bedrock"]', 'aria-checked')) === 'true');
    await shot(page, 'convert-2-pack');
    await page.click('.cv-ed[data-value="java"]');
    await page.waitForFunction(() => /26\.3/.test(document.querySelector('.cv-version .vp-trigger')?.textContent ?? ''));
    check('Java 26.3 is the default Java version', true);
    await convertTo(page, 'java', '26.3');
    await shot(page, 'convert-3-result-java');
    const head = await page.textContent('.cv-res-titles h2');
    check('result: all 3 textures converted to Java 26.3', /All 3 textures converted/.test(head), head.trim());
    const j = await download(page);
    check('Java download is a .zip', j.name.endsWith('.zip'), j.name);
    const mcmeta = json(j.zip['pack.mcmeta']);
    check('pack.mcmeta targets 26.3', JSON.stringify(mcmeta?.pack?.min_format) === '[97,1]' && mcmeta.pack.max_format === 97, JSON.stringify(mcmeta?.pack));
    check('description carried over', mcmeta?.pack?.description === 'Old school pack');
    check('blocks/stone.png renamed to block/stone.png', !!j.zip[`${J}block/stone.png`] && !j.zip[`${J}blocks/stone.png`]);
    check('blocks/grass_top.png renamed to block/grass_block_top.png', !!j.zip[`${J}block/grass_block_top.png`]);
    check('animation .mcmeta moved with its texture', json(j.zip[`${J}block/sea_lantern.png.mcmeta`])?.animation?.frametime === 5);
    check('model texture reference updated', json(j.zip['assets/minecraft/models/block/stone.json'])?.textures?.all === 'block/stone');
    check('sounds kept for Java', !!j.zip['assets/minecraft/sounds/dig/stone1.ogg']);
    const icon = j.zip['pack.png'] && (await decodePng(j.zip['pack.png']));
    check('pack.png is the pack’s own icon', icon && icon.width === 64, icon && `${icon.width}x${icon.height}`);
    await shot(page, 'convert-4-downloaded');

    // open in the editor, then back
    await page.click('.cv-open-btn');
    await page.waitForURL(/textures\/[0-9a-f-]+\/?$/, { timeout: 15000 });
    await page.waitForFunction(() => !!window.__tx && document.querySelector('.tx-main'), null, { timeout: 120000 });
    const opened = await page.evaluate(() => ({ name: window.__tx.store.project.name, version: window.__tx.store.project.version, edited: window.__tx.store.isEdited('assets/minecraft/textures/block/stone.png') }));
    check('"Open in editor" opens the converted project', opened.name === 'Old School (Java 26.3)' && opened.version === '26.3' && opened.edited, JSON.stringify(opened));
    await page.goto(base + 'textures');
    await page.waitForSelector('.tx-rc');
    const names = await page.$$eval('.tx-rc-name', (els) => els.map((e) => e.textContent.trim()));
    check('converted pack is listed with the texture projects', names.includes('Old School (Java 26.3)'), names.join(', '));

    // ---------------------------------------------------------------- Java -> Bedrock
    await page.goto(base + 'texture-pack-converter');
    await openSource(page, packs.java);
    await convertTo(page, 'bedrock');
    await shot(page, 'convert-5-result-bedrock');
    const b = await download(page);
    check('Bedrock download is a .mcpack', b.name.endsWith('.mcpack'), b.name);
    const manifest = json(b.zip['manifest.json']);
    check('manifest.json: resources module, name and description', manifest?.modules?.[0]?.type === 'resources' && manifest.header.name === 'Old School (Bedrock)' && manifest.header.description === 'Old school pack', JSON.stringify(manifest?.header));
    check('pack_icon.png included', !!b.zip['pack_icon.png']);
    check('textures/blocks/stone.png included', !!b.zip['textures/blocks/stone.png']);
    check('grass top mapped to Bedrock’s grass_top', !!b.zip['textures/blocks/grass_top.png'] || !!b.zip['textures/blocks/grass_top.tga']);
    const flip = json(b.zip['textures/flipbook_textures.json']) || [];
    const sl = flip.find((e) => e.flipbook_texture === 'textures/blocks/sea_lantern');
    check('flipbook entry for the animated sea lantern', sl && sl.ticks_per_frame === 5 && sl.blend_frames === true && sl.atlas_tile === 'sea_lantern', JSON.stringify(sl));
    check('no Java files in the .mcpack', !Object.keys(b.zip).some((k) => k.startsWith('assets/') || k === 'pack.mcmeta'));
    const dropped = await page.textContent('.cv-result');
    check('report lists the left-out model and sound', /Other files left out/.test(dropped));

    // ---------------------------------------------------------------- Bedrock -> Java
    await page.click('.cv-again');
    await openSource(page, packs.bedrock);
    check('detected a Bedrock pack', /Bedrock/.test(await page.textContent('.cv-pack-badges')));
    check('Bedrock target is disabled for a Bedrock pack', await page.isDisabled('.cv-ed[data-value="bedrock"]'));
    check('Java is selected for a Bedrock pack', (await page.getAttribute('.cv-ed[data-value="java"]', 'aria-checked')) === 'true');
    await convertTo(page, 'java', '26.3');
    await shot(page, 'convert-6-result-b2j');
    const bj = await download(page);
    check('Bedrock -> Java: stone at block/stone.png', !!bj.zip[`${J}block/stone.png`]);
    const bm = json(bj.zip['pack.mcmeta']);
    check('Bedrock -> Java: pack.mcmeta for 26.3 with the manifest description', bm?.pack?.max_format === 97 && bm.pack.description === 'Made on a phone', JSON.stringify(bm?.pack));
    check('Bedrock -> Java: flipbook became .mcmeta', json(bj.zip[`${J}block/sea_lantern.png.mcmeta`])?.animation?.frametime === 3);
    check('Bedrock -> Java: pack.png from pack_icon.png', !!bj.zip['pack.png']);

    // ---------------------------------------------------------------- loose PNGs -> Bedrock
    await page.click('.cv-again');
    await openSource(page, packs.loose);
    check('loose PNGs accepted as a source', /PNG textures/.test(await page.textContent('.cv-pack-badges')), await page.textContent('.cv-pack-info'));
    await convertTo(page, 'bedrock');
    const lp = await download(page);
    check('loose PNGs -> .mcpack with stone and the sword', !!lp.zip['textures/blocks/stone.png'] && !!lp.zip['textures/items/diamond_sword.png'], Object.keys(lp.zip).join(', '));

    // ---------------------------------------------------------------- phone width
    await page.setViewportSize({ width: 390, height: 844 });
    await page.click('.cv-again');
    await shot(page, 'convert-7-phone-start');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check('no horizontal scroll at 390 px', overflow <= 0, `${overflow}px`);
    await ctx.close();
  } catch (err) {
    check('no unexpected exception', false, err && err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : String(err));
  } finally {
    await browser.close();
    server?.stop();
  }
  const errs = [...new Set(errors)];
  check('no page errors', errs.length === 0, errs.slice(0, 5).join(' || '));
  console.log(`\n${results.length - failures}/${results.length} checks passed`);
  process.exit(failures ? 1 : 0);
})();
