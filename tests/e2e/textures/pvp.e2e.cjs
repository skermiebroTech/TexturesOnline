// End-to-end checks for PvP / FPS packs in the texture pack maker: the start screen's "PvP / FPS pack"
// option makes a pack for Java 1.8.9 (with the FPS tweaks), Java 26.3 and Bedrock; the editor switches
// the preset on and shows it in the PvP tab (lazy-loaded); every tweak is switched off and on again,
// choices change, a change is undone from its toast, "Draw your own" opens the crosshair in the pixel
// editor; the exported zip / mcpack holds the right files and JSON for each version; light and dark
// themes at 1280 px and a phone-width layout without sideways scrolling; no console errors.
// Java 1.8.9 needs its jar and version JSON in the fixtures (TO_FIXTURES/research-cache), 26.3 the
// usual fixtures; without them the real network is used.
// Usage: NODE_PATH=$(npm root -g) node tests/e2e/textures/pvp.e2e.cjs [baseUrl] [--shots <dir>] [--no-bedrock]
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startVite, launch, routeMojang, fixturesDir, unzip, decodePng } = require('./lib.cjs');

const argv = process.argv.slice(2);
const baseArg = argv.find((a) => /^https?:/.test(a));
const shotsDir = argv.includes('--shots') ? argv[argv.indexOf('--shots') + 1] : null;
const doBedrock = !argv.includes('--no-bedrock');
if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tx-pvp-'));
const J = 'assets/minecraft/textures/';

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
}
const shot = async (page, name) => {
  if (shotsDir) await page.screenshot({ path: path.join(shotsDir, `${name}.png`) });
};

/** Serves Java 1.8.9's version JSON and client jar (with Range) from the research fixtures. */
async function route189(context, fx) {
  if (!fx) return false;
  const vj = path.join(fx, 'research-cache', 'version-json', '1.8.9.json');
  const jar = path.join(fx, 'research-cache', 'jars', '1.8.9.jar');
  if (!fs.existsSync(vj) || !fs.existsSync(jar)) return false;
  const info = JSON.parse(fs.readFileSync(vj, 'utf8'));
  const jarUrl = info.downloads.client.url;
  const size = fs.statSync(jar).size;
  const fd = fs.openSync(jar, 'r');
  const cors = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range, content-length, accept-ranges' };
  await context.route(/^https:\/\/piston-meta\.mojang\.com\/v1\/packages\/[0-9a-f]+\/1\.8\.9\.json$/, (r) => r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: fs.readFileSync(vj) }));
  const jarRe = new RegExp(`^https://(launcher|piston-data)\\.mojang\\.com/v1/objects/${info.downloads.client.sha1}/client\\.jar$`);
  await context.route(jarRe, (r) => {
    const range = r.request().headers()['range'];
    const m = range && /bytes=(\d+)-(\d+)?/.exec(range);
    if (!m) return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/java-archive', 'content-length': String(size) }, body: fs.readFileSync(jar) });
    const start = Number(m[1]);
    const end = Math.min(size - 1, m[2] ? Number(m[2]) : size - 1);
    const buf = Buffer.alloc(end - start + 1);
    fs.readSync(fd, buf, 0, buf.length, start);
    return r.fulfill({ status: 206, headers: { ...cors, 'content-type': 'application/java-archive', 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': String(buf.length), 'accept-ranges': 'bytes' }, body: buf });
  });
  void jarUrl;
  return true;
}

async function rgba(bytes) {
  const png = await decodePng(bytes);
  const { width, height, channels: c, depth } = png;
  const out = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    if (png.palette) {
      const e = png.palette[png.data[i]] || [0, 0, 0, 0];
      out.set([e[0], e[1], e[2], e.length > 3 ? e[3] : 255], i * 4);
    } else if (depth === 8 && c === 4) out.set(png.data.subarray(i * 4, i * 4 + 4), i * 4);
    else if (depth === 8 && c === 3) out.set([png.data[i * 3], png.data[i * 3 + 1], png.data[i * 3 + 2], 255], i * 4);
    else if (depth === 8 && c === 2) out.set([png.data[i * 2], png.data[i * 2], png.data[i * 2], png.data[i * 2 + 1]], i * 4);
  }
  return { width, height, data: out };
}
const alphaAt = (img, x, y) => img.data[(y * img.width + x) * 4 + 3];
const json = (bytes) => JSON.parse(Buffer.from(bytes).toString('utf8'));

async function pickVersion(page, version) {
  await page.click('.tx-new .vp-trigger');
  await page.fill('.vp-pop input[type=search]', version);
  await page.click(`.vp-item:has(.vp-item-name:text-is("${version}"))`);
  await page.waitForFunction((v) => document.querySelector('.tx-new .vp-trigger')?.textContent.includes(v), version);
}

/** A new PvP pack from the start screen; resolves when the preset is on. */
async function newPvpPack(page, base, { name, version, bedrock = false, fps = false, viaQuery = true }) {
  await page.goto(base + (viaQuery ? '#/textures?start=pvp' : '#/textures'));
  await page.waitForSelector('.tx-new .tx-start-opt');
  if (!viaQuery) await page.click('.tx-start-opt[data-start="pvp"]');
  if (bedrock) {
    await page.click('.tx-new .segmented-item[data-value="bedrock"]');
    await page.waitForFunction(() => /Bedrock/.test(document.querySelector('.tx-new .vp-trigger')?.textContent ?? ''));
  } else if (version) await pickVersion(page, version);
  if (fps) await page.click('.tx-start-fps .switch');
  await page.fill('.tx-name-field input', name);
  await page.click('.tx-create-btn');
  await page.waitForURL(/(#\/|\/)textures\/[0-9a-f-]+\/?$/, { timeout: 15000 });
  await page.waitForFunction(() => !!window.__tx && document.querySelector('.tx-main'), null, { timeout: 180000 });
  // the preset goes on once the game files are loaded, then the cards show it
  await page.waitForFunction(() => document.querySelector('.pvp-tweak.is-on') && !window.__tx.store.project.pvp?.pending, null, { timeout: 120000 });
  await page.waitForTimeout(300);
}

const isOn = (page, id) => page.evaluate((i) => document.querySelector(`.pvp-tweak[data-tweak="${i}"] .switch`)?.getAttribute('aria-checked') === 'true', id);
async function flip(page, id) {
  const was = await isOn(page, id);
  await page.click(`.pvp-tweak[data-tweak="${id}"] .switch`);
  await page.waitForFunction(([i, w]) => document.querySelector(`.pvp-tweak[data-tweak="${i}"] .switch`)?.getAttribute('aria-checked') === String(!w) && !document.querySelector('.pvp-tweak.is-busy'), [id, was], { timeout: 60000 });
}
async function choose(page, id, value) {
  await page.click(`.pvp-tweak[data-tweak="${id}"] .segmented-item[data-value="${value}"]`);
  await page.waitForFunction(([i, v]) => document.querySelector(`.pvp-tweak[data-tweak="${i}"] .segmented-item[data-value="${v}"]`)?.getAttribute('aria-checked') === 'true' && !document.querySelector('.pvp-tweak.is-busy'), [id, value], { timeout: 60000 });
}

async function exportZip(page, ext) {
  await page.waitForSelector('.tx-save[data-state="saved"]', { timeout: 30000 });
  await page.click('.tx-export-btn');
  await page.waitForSelector('.tx-export-modal .tx-exp-rows');
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 300000 }), page.click(`.tx-export-modal .btn-primary:has-text("Export ${ext}")`)]);
  const file = path.join(tmp, download.suggestedFilename());
  await download.saveAs(file);
  await page.waitForSelector('.tx-exp-done', { timeout: 30000 });
  const warnings = await page.$$eval('.tx-exp-warnings li', (l) => l.map((x) => x.textContent));
  await page.click('.tx-export-modal .btn-primary:has-text("Done")');
  return { zip: unzip(file), warnings };
}

const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const loadedPvp = (page) =>
  page.evaluate(() => {
    const probe = document.createElement('div');
    probe.className = 'pvp-tweak';
    probe.hidden = true;
    document.body.appendChild(probe);
    const v = getComputedStyle(probe).borderTopWidth;
    probe.remove();
    return v === '2px';
  });

(async () => {
  const server = baseArg ? null : await startVite();
  const base = baseArg || server.url;
  const fx = fixturesDir();
  console.log(`base ${base} · fixtures ${fx ?? '(none: real network)'}`);
  const browser = await launch();
  const errors = [];
  const watch = (page) => {
    page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon|ERR_|404/.test(m.text())) errors.push(m.text());
    });
  };
  try {
    // ------------------------------------------------------------------ start screen stays light
    {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' });
      await routeMojang(ctx, fx);
      const page = await ctx.newPage();
      watch(page);
      await page.goto(base + '#/textures');
      await page.waitForSelector('.tx-new .tx-start-opt');
      check('the start screen offers a PvP / FPS pack', (await page.textContent('.tx-start-opt[data-start="pvp"]')).includes('PvP / FPS pack'));
      check('the PvP code is not loaded with the start screen', !(await loadedPvp(page)));
      await page.click('.tx-start-opt[data-start="pvp"]');
      check('choosing it shows the FPS option and renames the button', (await page.isVisible('.tx-start-fps')) && (await page.textContent('.tx-create-btn')).includes('Create PvP pack'));
      await shot(page, 'pvp-start-1280-light');
      await ctx.close();
    }

    // ------------------------------------------------------------------ Java 1.8.9, light, with FPS
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, colorScheme: 'light', acceptDownloads: true });
    await routeMojang(ctx, fx);
    const has189 = await route189(ctx, fx);
    const page = await ctx.newPage();
    watch(page);
    await newPvpPack(page, base, { name: 'E2E PvP 1.8.9', version: '1.8.9', fps: true });
    check('Java 1.8.9 loads (fixtures: ' + (has189 ? 'local jar' : 'network') + ')', (await page.textContent('.tx-bar-sub')).includes('1.8.9'));
    check('the PvP tab opens with the new pack', (await page.getAttribute('.tx-editor', 'data-side')) === 'pvp');
    for (const id of ['lowFire', 'clearGlass', 'noPumpkin', 'crosshair', 'swords', 'lowRes', 'still']) check(`1.8.9 preset: ${id} is on`, await isOn(page, id));
    const shieldCard = await page.$eval('.pvp-tweak[data-tweak="shield"]', (el) => ({ cls: el.className, disabled: el.querySelector('.switch').disabled, reason: el.querySelector('.pvp-reason')?.textContent ?? '' }));
    check('1.8.9: the shield tweak is off with its reason', shieldCard.disabled && /1\.9/.test(shieldCard.reason), shieldCard.reason);
    check('the FPS tweaks are effect layers in the Effects tab', (await page.evaluate(() => window.__tx.store.project.effects.map((l) => l.type).join(','))) === 'downscale,stillFrames');
    await shot(page, 'pvp-189-panel-1280-light');

    // every tweak off and on again
    for (const id of ['lowFire', 'clearGlass', 'noPumpkin', 'crosshair', 'swords', 'lowRes', 'still']) {
      await flip(page, id);
      const off = !(await isOn(page, id));
      await flip(page, id);
      check(`1.8.9: ${id} switches off and on`, off && (await isOn(page, id)));
    }
    check('switching off put back the game’s glass (then on again)', !!(await page.evaluate(() => window.__tx.store.project.overrides['assets/minecraft/textures/blocks/glass.png'] || window.__tx.store.isEdited('assets/minecraft/textures/blocks/glass.png'))));
    // choices
    await choose(page, 'swords', 'tiny');
    await choose(page, 'lowFire', 'lowest');
    await page.click('.pvp-tweak[data-tweak="crosshair"] .pvp-design[data-design="circle"]');
    await page.waitForFunction(() => document.querySelector('.pvp-design[data-design="circle"]')?.getAttribute('aria-checked') === 'true' && !document.querySelector('.pvp-tweak.is-busy'), null, { timeout: 30000 });
    check('choices change: weapon size, fire height, crosshair design', (await page.evaluate(() => JSON.stringify([window.__tx.store.project.pvp.tweaks.swords.options.size, window.__tx.store.project.pvp.tweaks.lowFire.options.height, window.__tx.store.project.pvp.tweaks.crosshair.options.design]))) === '["tiny","lowest","circle"]');
    // undo from the toast
    await page.click('.pvp-tweak[data-tweak="noPumpkin"] .switch');
    await page.waitForFunction(() => document.querySelector('.pvp-tweak[data-tweak="noPumpkin"] .switch')?.getAttribute('aria-checked') === 'false');
    // the newest toast is the one for this change
    await page.locator('.toast:has-text("No pumpkin blur") button:has-text("Undo")').last().click();
    await page.waitForFunction(() => document.querySelector('.pvp-tweak[data-tweak="noPumpkin"] .switch')?.getAttribute('aria-checked') === 'true', null, { timeout: 10000 });
    check('a change is undone from its toast', !!(await page.evaluate(() => window.__tx.store.isEdited('assets/minecraft/textures/misc/pumpkinblur.png'))));
    // draw your own crosshair
    await page.click('.pvp-tweak[data-tweak="crosshair"] .pvp-draw button');
    await page.waitForFunction(() => window.__tx.canvas.current()?.key === 'assets/minecraft/textures/gui/icons.png', null, { timeout: 30000 });
    await page.waitForFunction(() => !!window.__tx.canvas.canvas()?.getSelection(), null, { timeout: 10000 }).catch(() => undefined);
    const sel = await page.evaluate(() => window.__tx.canvas.canvas().getSelection());
    check('"Draw your own" opens icons.png with the crosshair square selected', sel && sel.x === 0 && sel.y === 0 && sel.w === 16 && sel.h === 16, JSON.stringify(sel));
    await shot(page, 'pvp-189-draw-crosshair');
    await page.click('.tx-col-tabs .tab[data-value="pvp"]');
    const ex189 = await exportZip(page, '.zip');
    const z = ex189.zip;
    check('1.8.9 zip: pack format 1', json(z['pack.mcmeta']).pack.pack_format === 1, JSON.stringify(json(z['pack.mcmeta'])));
    check('1.8.9 zip: no export warnings', ex189.warnings.length === 0, ex189.warnings.join(' | '));
    const fire = z[`${J}blocks/fire_layer_1.png`] && (await rgba(z[`${J}blocks/fire_layer_1.png`]));
    check('1.8.9 zip: fire_layer_1 lowered (one frame, top clear, 8×)', fire && fire.width === 8 && fire.height === 8 && alphaAt(fire, 4, 2) === 0, fire && `${fire.width}x${fire.height}`);
    check('1.8.9 zip: no animation .mcmeta for still textures', !z[`${J}blocks/fire_layer_1.png.mcmeta`] && !z[`${J}blocks/water_still.png.mcmeta`] && !!z[`${J}blocks/water_still.png`]);
    check('1.8.9 zip: fire blocks use the copy', !!z[`${J}blocks/fire_layer_1_world.png`] && json(z['assets/minecraft/models/block/fire_n_alt.json']).textures.fire === 'blocks/fire_layer_1_world');
    check('1.8.9 zip: the fire model particle keeps the original (atlas)', json(z['assets/minecraft/models/block/fire_n_alt.json']).textures.particle === 'blocks/fire_layer_1');
    const sword = json(z['assets/minecraft/models/item/diamond_sword.json']);
    check('1.8.9 zip: diamond_sword "firstperson" at 50 %, third person as the game has it', sword.parent === 'builtin/generated' && sword.display.firstperson.scale[0] === 0.85 && sword.display.thirdperson.scale[0] === 0.85 && !sword.display.firstperson_righthand, JSON.stringify(sword.display));
    check('1.8.9 zip: every sword, no shield', ['wooden', 'stone', 'iron', 'golden', 'diamond'].every((m) => z[`assets/minecraft/models/item/${m}_sword.json`]) && !z['assets/minecraft/models/item/shield.json']);
    const glass = await rgba(z[`${J}blocks/glass_red.png`]);
    check('1.8.9 zip: stained glass clear inside, border kept', alphaAt(glass, 4, 4) === 0 && alphaAt(glass, 0, 4) > 0, `${glass.width}`);
    const icons = await rgba(z[`${J}gui/icons.png`]);
    check('1.8.9 zip: crosshair circle in icons.png, the hearts stay', alphaAt(icons, 7, 7) === 255 && alphaAt(icons, 7, 6) === 0 && alphaAt(icons, 7, 3) === 255 && alphaAt(icons, 20, 4) > 0);
    const pumpkin = await rgba(z[`${J}misc/pumpkinblur.png`]);
    check('1.8.9 zip: pumpkin blur clear', pumpkin.data.every((v, i) => i % 4 !== 3 || v === 0));
    await ctx.close();

    // ------------------------------------------------------------------ Java 26.3, dark
    const dctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, colorScheme: 'dark', acceptDownloads: true });
    await routeMojang(dctx, fx);
    const dp = await dctx.newPage();
    watch(dp);
    await newPvpPack(dp, base, { name: 'E2E PvP 26.3', viaQuery: false });
    for (const id of ['lowFire', 'clearGlass', 'noPumpkin', 'crosshair', 'swords', 'shield']) check(`26.3 preset: ${id} is on`, await isOn(dp, id));
    check('26.3 preset: FPS tweaks are off', !(await isOn(dp, 'lowRes')) && !(await isOn(dp, 'still')));
    await shot(dp, 'pvp-263-panel-1280-dark');
    for (const id of ['lowFire', 'clearGlass', 'noPumpkin', 'crosshair', 'swords', 'shield', 'lowRes', 'still']) {
      const was = await isOn(dp, id);
      await flip(dp, id);
      await flip(dp, id);
      check(`26.3: ${id} switches and back`, (await isOn(dp, id)) === was);
    }
    await choose(dp, 'swords', 'weapons');
    await choose(dp, 'shield', 'lower');
    await flip(dp, 'lowRes');
    await choose(dp, 'lowRes', 'all');
    const ex263 = await exportZip(dp, '.zip');
    const y = ex263.zip;
    check('26.3 zip: no export warnings', ex263.warnings.length === 0, ex263.warnings.join(' | '));
    check('26.3 zip: crosshair sprite', !!y[`${J}gui/sprites/hud/crosshair.png`] && !y[`${J}gui/icons.png`]);
    const cs = await rgba(y[`${J}gui/sprites/hud/crosshair.png`]);
    check('26.3 zip: crosshair "cross with a gap"', cs.width === 15 && alphaAt(cs, 7, 7) === 255 && alphaAt(cs, 8, 7) === 0 && alphaAt(cs, 9, 7) === 255);
    const fire1 = await rgba(y[`${J}block/fire_1.png`]);
    check('26.3 zip: fire_1 lowered, its animation kept', alphaAt(fire1, 8, 3) === 0 && !!y[`${J}block/fire_1.png.mcmeta`] && fire1.height > fire1.width);
    check('26.3 zip: fire block models use fire_1_world', json(y['assets/minecraft/models/block/fire_floor1.json']).textures.fire === 'minecraft:block/fire_1_world' && !!y[`${J}block/fire_1_world.png`] && !!y[`${J}block/fire_1_world.png.mcmeta`]);
    const s263 = json(y['assets/minecraft/models/item/netherite_sword.json']);
    check('26.3 zip: swords keep their parent, first-person slots set', s263.parent === 'minecraft:item/handheld' && s263.display.firstperson_righthand.scale[0] === 0.442 && s263.display.firstperson_lefthand && !s263.display.gui);
    check('26.3 zip: all weapons (axes, mace, spears in hand)', !!y['assets/minecraft/models/item/iron_axe.json'] && !!y['assets/minecraft/models/item/mace.json'] && !!y['assets/minecraft/models/item/iron_spear_in_hand.json'] && !y['assets/minecraft/models/item/iron_spear.json']);
    check('26.3 zip: no item definitions written', !Object.keys(y).some((f) => f.startsWith('assets/minecraft/items/')));
    const sh = json(y['assets/minecraft/models/item/shield.json']);
    const shb = json(y['assets/minecraft/models/item/shield_blocking.json']);
    check('26.3 zip: shield and blocking shield 6 lower', sh.display.firstperson_righthand.translation[1] === -4.25 && shb.display.firstperson_righthand.translation[1] === -2.75 && sh.display.gui, JSON.stringify([sh.display.firstperson_righthand, shb.display.firstperson_righthand]));
    const stone = await rgba(y[`${J}block/stone.png`]);
    const apple = await rgba(y[`${J}item/apple.png`]);
    check('26.3 zip: blocks and items at 8×', stone.width === 8 && apple.width === 8);
    // phone width
    await dp.setViewportSize({ width: 390, height: 844 });
    await dp.waitForTimeout(300);
    await dp.click('.tx-tabbar-btn[data-v="pvp"]');
    await dp.waitForSelector('.tx-side-body[data-tab="pvp"] .pvp-tweak', { state: 'visible' });
    check('390 px: PvP tab in the tab bar, no sideways scrolling', await noSideScroll(dp));
    await dctx.close();

    // ------------------------------------------------------------------ phone, light
    {
      const pctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light', deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      await routeMojang(pctx, fx);
      const pp = await pctx.newPage();
      watch(pp);
      await pp.goto(base + '#/textures?start=pvp');
      await pp.waitForSelector('.tx-new .tx-start-opt');
      check('390 px: start screen without sideways scrolling', await noSideScroll(pp));
      await shot(pp, 'pvp-start-390-light');
      await pp.fill('.tx-name-field input', 'E2E PvP phone');
      await pp.click('.tx-create-btn');
      await pp.waitForFunction(() => !!window.__tx && document.querySelector('.pvp-tweak.is-on') && !window.__tx.store.project.pvp?.pending, null, { timeout: 180000 });
      check('390 px: a new PvP pack opens on the PvP tab', (await pp.getAttribute('.tx-editor', 'data-mobile')) === 'pvp');
      check('390 px: PvP panel without sideways scrolling', await noSideScroll(pp));
      // names that would run together are hidden (kept for screen readers) and the tab shows its icon
      const clipped = await pp.$$eval('.tx-tabbar-btn span:not(.icon)', (els) => els.filter((e) => e.clientWidth > 1 && e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent));
      check('390 px: the tab bar labels fit', clipped.length === 0, clipped.join(', '));
      await shot(pp, 'pvp-263-390-light');
      await pp.emulateMedia({ colorScheme: 'dark' });
      await pp.waitForTimeout(200);
      await shot(pp, 'pvp-263-390-dark');
      await pctx.close();
    }

    // ------------------------------------------------------------------ Bedrock
    if (doBedrock) {
      const bctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, colorScheme: 'light', acceptDownloads: true });
      const bp = await bctx.newPage();
      watch(bp);
      await newPvpPack(bp, base, { name: 'E2E PvP Bedrock', bedrock: true, fps: true });
      for (const id of ['clearGlass', 'noPumpkin', 'crosshair', 'lowRes']) check(`Bedrock preset: ${id} is on`, await isOn(bp, id));
      for (const id of ['lowFire', 'swords', 'shield', 'still']) {
        const d = await bp.$eval(`.pvp-tweak[data-tweak="${id}"]`, (el) => ({ disabled: el.querySelector('.switch').disabled, reason: el.querySelector('.pvp-reason')?.textContent ?? '' }));
        check(`Bedrock: ${id} is unavailable with a reason`, d.disabled && /Bedrock/.test(d.reason), d.reason);
      }
      await shot(bp, 'pvp-bedrock-panel-1280-light');
      const exb = await exportZip(bp, '.mcpack');
      const b = exb.zip;
      check('Bedrock mcpack: manifest', !!b['manifest.json']);
      const bg = await rgba(b['textures/blocks/glass.png']);
      check('Bedrock mcpack: clear glass at 8×', bg.width === 8 && alphaAt(bg, 4, 4) === 0 && alphaAt(bg, 0, 4) > 0);
      const bi = await rgba(b['textures/gui/icons.png']);
      check('Bedrock mcpack: crosshair in gui/icons.png', alphaAt(bi, 7, 7) === 255 && alphaAt(bi, 7, 6) === 0);
      check('Bedrock mcpack: pumpkin blur clear', !!b['textures/misc/pumpkinblur.png']);
      await bctx.close();
    }
  } catch (err) {
    check('no unexpected exception', false, err && err.stack ? err.stack.split('\n').slice(0, 4).join(' | ') : String(err));
  } finally {
    await browser.close();
    server?.stop();
  }
  const errs = [...new Set(errors)];
  check('no console errors', errs.length === 0, errs.slice(0, 5).join(' || '));
  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
})();
