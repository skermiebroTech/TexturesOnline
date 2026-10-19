// End-to-end test of the texture pack merger in Chromium.
// Usage: NODE_PATH=$(npm root -g) TO_FIXTURES=<dir> node tests/e2e/textures/merge.e2e.cjs [baseUrl] [--shots <dir>]
// Builds tiny packs on the fly (original pixel art, no game files): two Java 26.3 packs, a Java
// 1.12.2 pack and two Bedrock packs. Java 26.3 game files come from TO_FIXTURES (client jar, routed
// locally) or the real network; Bedrock game files come from GitHub (network needed).
// With --shots, every step is captured at 1280 and 390 px, dark and light.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ROOT, startVite, launch, routeMojang, fixturesDir, unzip, decodePng } = require('./lib.cjs');

const argv = process.argv.slice(2);
const baseArg = argv.find((a) => /^https?:/.test(a));
const shotsDir = argv.includes('--shots') ? argv[argv.indexOf('--shots') + 1] : null;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tx-merge-'));
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
const solid = (c) => () => c;
const enc = (s) => new TextEncoder().encode(typeof s === 'string' ? s : JSON.stringify(s));
const RED = [220, 30, 30, 255];
const BLUE = [30, 60, 220, 255];
const GOLD = [250, 200, 40, 255];

async function makePacks() {
  const { zipSync } = require(path.join(ROOT, 'node_modules/fflate'));
  const frames = (w) => (x, y) => [40 * (Math.floor(y / w) + 1), 120, 90, 255];
  const top = zipSync({
    'pack.mcmeta': enc({ pack: { min_format: [97, 1], max_format: 97, description: 'Top pack' } }),
    'pack.png': await encodePng(64, 64, checkerArt(GOLD, [40, 40, 40, 255])),
    [`${J}block/stone.png`]: await encodePng(16, 16, solid(RED)),
    [`${J}block/sea_lantern.png`]: await encodePng(16, 16, solid([200, 240, 230, 255])),
    'assets/minecraft/lang/en_us.json': enc({ 'block.minecraft.stone': 'Red rock' }),
    'assets/minecraft/sounds.json': enc({ 'block.stone.break': { sounds: ['top/stone'] } }),
  });
  const extra = zipSync({
    'pack.mcmeta': enc({ pack: { min_format: [97, 1], max_format: 97, description: 'Extras' } }),
    [`${J}block/diamond_ore.png`]: await encodePng(16, 16, checkerArt([80, 220, 230, 255], [90, 90, 90, 255])),
    [`${J}block/stone.png`]: await encodePng(16, 16, solid([20, 200, 20, 255])),
    'assets/minecraft/atlases/blocks.json': enc({ sources: [{ type: 'directory', source: 'extra', prefix: 'extra/' }] }),
  });
  const old = zipSync({
    'pack.mcmeta': enc({ pack: { pack_format: 3, description: 'Old school pack' } }),
    'pack.png': await encodePng(64, 64, checkerArt(BLUE, [250, 250, 250, 255])),
    [`${J}blocks/stone.png`]: await encodePng(16, 16, solid(BLUE)),
    [`${J}blocks/dirt.png`]: await encodePng(16, 16, checkerArt([120, 80, 40, 255], [90, 60, 30, 255])),
    [`${J}blocks/sea_lantern.png`]: await encodePng(16, 80, frames(16)),
    [`${J}blocks/sea_lantern.png.mcmeta`]: enc({ animation: { frametime: 7, interpolate: true } }),
    'assets/minecraft/lang/en_us.json': enc({ 'block.minecraft.stone': 'Blue rock', 'block.minecraft.dirt': 'Old dirt' }),
    'assets/minecraft/models/block/dirt.json': enc({ parent: 'block/cube_all', textures: { all: 'blocks/dirt' } }),
  });
  const manifest = (name, h, m) =>
    enc({
      format_version: 2,
      header: { name, description: `${name} for phones`, uuid: h, version: [1, 0, 0], min_engine_version: [1, 21, 0] },
      modules: [{ type: 'resources', uuid: m, version: [1, 0, 0] }],
    });
  const terrain = (data) => enc({ resource_pack_name: 'vanilla', texture_name: 'atlas.terrain', padding: 8, num_mip_levels: 4, texture_data: data });
  const phone = zipSync({
    'manifest.json': manifest('Phone Pack', '8f0b5a0e-6c55-4d3b-9b1e-0a4c2f9d7e11', '2a6d8c1b-3f4e-4a5b-8c7d-9e0f1a2b3c4d'),
    'pack_icon.png': await encodePng(64, 64, checkerArt([40, 120, 250, 255], [250, 250, 250, 255])),
    'textures/blocks/stone.png': await encodePng(16, 16, solid(RED)),
    'textures/terrain_texture.json': terrain({ phone_block: { textures: 'textures/blocks/phone' } }),
    'texts/en_US.lang': enc('pack.name=Phone Pack\ntile.stone.name=Phone stone\n'),
  });
  const tablet = zipSync({
    'manifest.json': manifest('Tablet Pack', '0d1c2b3a-4f5e-4d6c-8b7a-695847362514', '1e2d3c4b-5a69-4788-9a0b-1c2d3e4f5a6b'),
    'textures/blocks/stone.png': await encodePng(16, 16, solid(BLUE)),
    'textures/blocks/dirt.png': await encodePng(16, 16, solid([120, 80, 40, 255])),
    'textures/terrain_texture.json': terrain({ tablet_block: { textures: 'textures/blocks/tablet' } }),
    'texts/en_US.lang': enc('pack.name=Tablet Pack\ntile.dirt.name=Tablet dirt\n'),
  });
  const files = {
    top: path.join(tmp, 'Top Pack.zip'),
    extra: path.join(tmp, 'Extras.zip'),
    old: path.join(tmp, 'Old School.zip'),
    phone: path.join(tmp, 'Phone Pack.mcpack'),
    tablet: path.join(tmp, 'Tablet Pack.mcpack'),
  };
  fs.writeFileSync(files.top, top);
  fs.writeFileSync(files.extra, extra);
  fs.writeFileSync(files.old, old);
  fs.writeFileSync(files.phone, phone);
  fs.writeFileSync(files.tablet, tablet);
  return files;
}

// ------------------------------------------------------------------ helpers
const names = (page) => page.$$eval('.mg-list .mg-name', (els) => els.map((e) => e.textContent.trim()));

async function addPacks(page, files) {
  const before = (await names(page)).length;
  await page.setInputFiles('.mg-dz input[type=file]', files);
  await page.waitForFunction((n) => document.querySelectorAll('.mg-list .mg-row').length === n && !document.querySelector('.mg-dz.is-busy'), before + files.length, { timeout: 60000 });
}

async function rowHandle(page, name) {
  return page.locator('.mg-row', { has: page.locator(`.mg-name:text-is("${name}")`) });
}

async function dragTo(page, fromName, toName) {
  await page.evaluate(() => document.querySelector('.mg-list').scrollIntoView({ block: 'center' }));
  const from = (await rowHandle(page, fromName)).locator('.mg-handle');
  const to = await rowHandle(page, toName);
  const a = await from.boundingBox();
  const b = await to.boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  const steps = 8;
  const ty = b.y + 4;
  for (let i = 1; i <= steps; i++) await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2 + ((ty - (a.y + a.height / 2)) * i) / steps);
  await page.mouse.up();
}

async function merge(page) {
  await page.click('.mg-go');
  await page.waitForSelector('.mg-result .mg-dl-btn, .mg-result .cv-res-icon.is-error', { timeout: 120000 });
  const err = await page.$('.mg-result .cv-res-icon.is-error');
  if (err) throw new Error(`merge failed: ${(await page.textContent('.mg-result')).trim().slice(0, 300)}`);
}

async function download(page) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 300000 }), page.click('.mg-dl-btn')]);
  const file = path.join(tmp, dl.suggestedFilename());
  await dl.saveAs(file);
  await page.waitForSelector('.cv-install:not([hidden])', { timeout: 30000 });
  return { file, name: dl.suggestedFilename(), zip: unzip(file) };
}

const json = (b) => (b ? JSON.parse(Buffer.from(b).toString('utf8')) : undefined);
async function pixel(bytes, x = 0) {
  const img = await decodePng(bytes);
  return { w: img.width, h: img.height, rgba: Array.from(img.data.slice(x * 4, x * 4 + 4)) };
}

/** Screenshots of the current state: 1280 and 390 px, dark and light. */
async function shots(page, name) {
  if (!shotsDir) return;
  const vp = page.viewportSize();
  for (const theme of ['dark', 'light']) {
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, theme);
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 860 });
      // The sticky top bar would be drawn over the page wherever it was scrolled to.
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        document.activeElement?.blur?.();
      });
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(shotsDir, `merge-${name}-${width}-${theme}.png`), fullPage: true });
    }
  }
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await page.setViewportSize(vp);
}

async function noOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
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
    const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 860 }, colorScheme: 'dark' });
    await routeMojang(ctx, fx);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon|ERR_|404|Failed to load resource/.test(m.text())) errors.push(m.text());
    });

    // ---------------------------------------------------------------- entry points
    await page.goto(base + 'textures');
    await page.waitForSelector('.tx-merge-link');
    await page.click('.tx-merge-link');
    await page.waitForURL(/merge-texture-packs\/?$/, { timeout: 15000 });
    await page.waitForSelector('.mg-dz');
    check('"Merge packs" on the texture start screen opens the merger', true);
    check('page title', /Merge Minecraft Texture Packs/.test(await page.title()), await page.title());
    check('no main-menu item is marked current', (await page.$$('.mainnav a[aria-current="page"]')).length === 0);
    await page.waitForSelector('[data-tool-intro="merge"]', { timeout: 15000 }).catch(() => null);
    check('the merge introduction is mounted below the tool', !!(await page.$('[data-tool-intro="merge"]')));
    check('footer links to the merger', !!(await page.$('.site-footer a[href$="merge-texture-packs/"]')));
    check('nothing to merge before packs are added', await page.isDisabled('.mg-go'));
    await shots(page, '1-start');

    // ---------------------------------------------------------------- add Java packs
    await addPacks(page, [packs.top, packs.old]);
    let order = await names(page);
    check('two packs added in the order chosen', order.join() === 'Top Pack,Old School', order.join());
    const badges = await page.$$eval('.mg-row .mg-badges', (els) => els.map((e) => e.textContent));
    check('editions and versions detected', /Java 26\.3/.test(badges[0]) && /Java 1\.12\.2/.test(badges[1]), badges.join(' | '));
    check('texture counts shown', /2 textures/.test(await page.textContent('.mg-row:nth-child(1) .mg-counts')) && /3 textures/.test(await page.textContent('.mg-row:nth-child(2) .mg-counts')));
    check('top pack is marked as the winner', /Wins conflicts/.test(await page.textContent('.mg-row:nth-child(1)')));
    check('Java 26.3 is the default target (newest pack)', /26\.3/.test(await page.textContent('.mg-version .vp-trigger')));
    const hint = await page.textContent('.mg-hint');
    check('hint: the old pack gets the new names', /Old School \(Java 1\.12\.2\) will get the texture names of Java 26\.3/.test(hint), hint.trim());
    check('merge button counts the packs', /Merge 2 packs/.test(await page.textContent('.mg-go')));
    await addPacks(page, [packs.extra]);
    order = await names(page);
    check('third pack appended at the bottom', order.join() === 'Top Pack,Old School,Extras', order.join());
    await shots(page, '2-packs');

    // ---------------------------------------------------------------- reorder
    await dragTo(page, 'Extras', 'Top Pack');
    order = await names(page);
    check('drag by the handle moves a pack to the top', order.join() === 'Extras,Top Pack,Old School', order.join());
    check('rank numbers follow the order', (await page.$$eval('.mg-row .mg-rank', (els) => els.map((e) => e.textContent).join())) === '1,2,3');
    await (await rowHandle(page, 'Extras')).locator('.mg-handle').focus();
    await page.keyboard.press('ArrowDown');
    order = await names(page);
    check('arrow key on the handle moves a pack down', order.join() === 'Top Pack,Extras,Old School', order.join());
    check('focus stays on the moved pack’s handle', await page.evaluate(() => document.activeElement?.closest('.mg-row')?.querySelector('.mg-name')?.textContent === 'Extras'));
    await (await rowHandle(page, 'Old School')).locator('.mg-up').click();
    order = await names(page);
    check('"Move up" button', order.join() === 'Top Pack,Old School,Extras', order.join());
    await (await rowHandle(page, 'Old School')).locator('.mg-down').click();
    order = await names(page);
    check('"Move down" button', order.join() === 'Top Pack,Extras,Old School', order.join());
    check('first pack can’t move up, last can’t move down', (await page.isDisabled('.mg-row:first-child .mg-up')) && (await page.isDisabled('.mg-row:last-child .mg-down')));
    check('live region announces moves', /moved to position 3 of 3/.test(await page.textContent('.mg-page [aria-live="polite"].sr-only')));

    // ---------------------------------------------------------------- mixed editions
    await addPacks(page, [packs.phone]);
    const alert = await page.textContent('.mg-hint');
    check('Java + Bedrock: explained, with a link to the converter', /can’t be merged together/.test(alert) && !!(await page.$('.mg-hint.is-alert a[href$="texture-pack-converter/"]')), alert.trim().slice(0, 120));
    check('Java + Bedrock: merge disabled', await page.isDisabled('.mg-go'));
    check('Java + Bedrock: the odd pack is highlighted', !!(await page.$('.mg-row.is-odd-edition[data-edition="bedrock"]')));
    await shots(page, '3-mixed');
    await (await rowHandle(page, 'Phone Pack')).locator('.mg-remove').click();
    check('removing the Bedrock pack clears the alert', !(await page.$('.mg-hint.is-alert')) && !(await page.isDisabled('.mg-go')));

    // ---------------------------------------------------------------- settings + merge
    await page.fill('.mg-name-field input', 'My Merged Pack');
    check('description lists the packs', /Merged from Top Pack, Extras and Old School/.test(await page.textContent('.mg-desc')));
    const iconOpts = await page.$$eval('.mg-icon-opt', (els) => els.map((e) => `${e.getAttribute('aria-label')}:${e.getAttribute('aria-checked')}`));
    check('icon choices: packs with an icon + generated, top pack chosen', iconOpts.join() === 'Top Pack:true,Old School:false,Generated from the merged textures:false', iconOpts.join());
    await page.click('.mg-icon-opt[aria-label="Old School"]');
    await shots(page, '4-settings');
    await merge(page);
    const head = await page.textContent('.mg-result h2');
    check('result headline', /3 packs merged into “My Merged Pack”/.test(head), head.trim());
    const contrib = await page.$$eval('.mg-contrib-row', (els) => els.map((e) => e.textContent));
    check('files from each pack are listed in order', contrib.length === 3 && /Top Pack/.test(contrib[0]) && /Extras/.test(contrib[1]) && /Old School/.test(contrib[2]), contrib.join(' | ').slice(0, 200));
    check('the old pack’s renames are counted', /renamed/.test(contrib[2]), contrib[2]);
    await page.click('.mg-conflicts > summary');
    const conflicts = await page.textContent('.mg-conflicts');
    check('conflict: block/stone.png from Top Pack, overriding Extras and Old School', /block\/stone\.png\s*from Top Pack, overriding Extras and Old School/.test(conflicts), conflicts.replace(/\s+/g, ' ').slice(0, 200));
    check('conflict: sea lantern from Top Pack', /block\/sea_lantern\.png\s*from Top Pack, overriding Old School/.test(conflicts));
    await page.click('.mg-merged > summary');
    const merged = await page.textContent('.mg-merged');
    check('merged files: the language file', /assets\/minecraft\/lang\/en_us\.json/.test(merged), merged.replace(/\s+/g, ' ').slice(0, 160));
    await shots(page, '5-result');

    const j = await download(page);
    check('download is a .zip named after the pack', j.name === 'My Merged Pack.zip', j.name);
    const mcmeta = json(j.zip['pack.mcmeta']);
    check('pack.mcmeta for Java 26.3', JSON.stringify(mcmeta?.pack?.min_format) === '[97,1]' && mcmeta.pack.max_format === 97, JSON.stringify(mcmeta?.pack));
    check('description lists the packs', mcmeta?.pack?.description === 'Merged from Top Pack, Extras and Old School', mcmeta?.pack?.description);
    const stone = await pixel(j.zip[`${J}block/stone.png`]);
    check('stone from the top pack', stone.rgba.join() === RED.join(), stone.rgba.join());
    check('diamond ore from Extras', !!j.zip[`${J}block/diamond_ore.png`]);
    check('old blocks/dirt.png became block/dirt.png', !!j.zip[`${J}block/dirt.png`] && !Object.keys(j.zip).some((k) => k.startsWith(`${J}blocks/`)));
    const lantern = await pixel(j.zip[`${J}block/sea_lantern.png`]);
    check('sea lantern is the top pack’s still image', lantern.h === 16, `${lantern.w}x${lantern.h}`);
    check('the old pack’s animation did not attach to it', json(j.zip[`${J}block/sea_lantern.png.mcmeta`])?.animation?.interpolate !== true);
    check('language file merged key by key', JSON.stringify(json(j.zip['assets/minecraft/lang/en_us.json'])) === JSON.stringify({ 'block.minecraft.stone': 'Red rock', 'block.minecraft.dirt': 'Old dirt' }));
    check('model texture name updated', json(j.zip['assets/minecraft/models/block/dirt.json'])?.textures?.all === 'block/dirt');
    check('atlas and sounds carried over', !!j.zip['assets/minecraft/atlases/blocks.json'] && !!j.zip['assets/minecraft/sounds.json']);
    // Old School's icon is a blue and white checkerboard of 4 px squares: (4, 0) is blue.
    const icon = await pixel(j.zip['pack.png'], 4);
    check('pack.png is the chosen pack’s icon (Old School)', icon.w === 64 && icon.rgba.join() === BLUE.join(), `${icon.w} ${icon.rgba.join()}`);
    await shots(page, '6-downloaded');

    await page.click('.mg-open-btn');
    await page.waitForURL(/textures\/[0-9a-f-]+\/?$/, { timeout: 15000 });
    await page.waitForFunction(() => !!window.__tx && document.querySelector('.tx-main'), null, { timeout: 120000 });
    const opened = await page.evaluate(() => ({ name: window.__tx.store.project.name, version: window.__tx.store.project.version, edited: window.__tx.store.isEdited('assets/minecraft/textures/block/dirt.png') }));
    check('"Open in editor" opens the merged project', opened.name === 'My Merged Pack' && opened.version === '26.3' && opened.edited, JSON.stringify(opened));

    // ---------------------------------------------------------------- Bedrock
    await page.goto(base + 'merge-texture-packs');
    await page.waitForSelector('.mg-dz');
    await addPacks(page, [packs.phone, packs.tablet]);
    check('Bedrock packs: no version picker', await page.isHidden('.mg-version'));
    check('Bedrock hint', /one \.mcpack for Bedrock/.test(await page.textContent('.mg-hint')));
    await merge(page);
    const b = await download(page);
    check('Bedrock download is a .mcpack', b.name === 'Merged Pack.mcpack', b.name);
    const manifest = json(b.zip['manifest.json']);
    check('manifest: name, description, resources module', manifest?.header?.name === 'Merged Pack' && manifest.header.description === 'Merged from Phone Pack and Tablet Pack' && manifest.modules?.[0]?.type === 'resources', JSON.stringify(manifest?.header));
    check('manifest: fresh uuids', !['8f0b5a0e-6c55-4d3b-9b1e-0a4c2f9d7e11', '0d1c2b3a-4f5e-4d6c-8b7a-695847362514'].includes(manifest?.header?.uuid));
    const bstone = await pixel(b.zip['textures/blocks/stone.png']);
    check('Bedrock stone from the top pack', bstone.rgba.join() === RED.join(), bstone.rgba.join());
    check('Bedrock dirt from the lower pack', !!b.zip['textures/blocks/dirt.png']);
    const terrain = json(b.zip['textures/terrain_texture.json']);
    check('terrain_texture.json merged entry by entry', !!terrain?.texture_data?.phone_block && !!terrain?.texture_data?.tablet_block, JSON.stringify(terrain?.texture_data));
    const lang = Buffer.from(b.zip['texts/en_US.lang'] || []).toString('utf8');
    check('.lang merged key by key', /tile\.stone\.name=Phone stone/.test(lang) && /tile\.dirt\.name=Tablet dirt/.test(lang) && !/pack\.name=Tablet/.test(lang), lang);
    check('pack_icon.png from the top pack', !!b.zip['pack_icon.png']);
    await shots(page, '7-bedrock-result');

    // ---------------------------------------------------------------- phone width
    await page.setViewportSize({ width: 390, height: 844 });
    let overflow = await noOverflow(page);
    check('result: no horizontal scroll at 390 px', overflow <= 0, `${overflow}px`);
    await page.click('.mg-again');
    await addPacks(page, [packs.top, packs.old, packs.extra]);
    overflow = await noOverflow(page);
    check('pack list: no horizontal scroll at 390 px', overflow <= 0, `${overflow}px`);
    await (await rowHandle(page, 'Extras')).locator('.mg-up').click();
    order = await names(page);
    check('phone: move-up button works', order.join() === 'Top Pack,Extras,Old School', order.join());
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
