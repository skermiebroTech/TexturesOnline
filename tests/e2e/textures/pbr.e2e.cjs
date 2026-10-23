// End-to-end checks of the Material tab (PBR) of the texture pack maker: the tab loads on first use for
// the open texture, the lit 3D preview draws and shows each map, the light moves and stops, night
// mode, quick materials (with Undo from the toast), the parts of a texture (colourful, bright, some
// colours, an area selected in the pixel editor), values, bumps, "Use on similar textures", taking the
// material off; the exported Java zip holds labPBR _n / _s next to the textures and the Bedrock mcpack
// texture sets with their layers and the "pbr" capability; an opened pack's PBR files show in the tab
// and export unchanged; a phone layout without sideways scrolling; light and dark themes; no console
// errors. Bedrock needs the network (bedrock-samples on GitHub).
// Usage: NODE_PATH=$(npm root -g) TO_FIXTURES=<dir> node tests/e2e/textures/pbr.e2e.cjs [baseUrl] [--shots <dir>] [--no-bedrock]
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ROOT, startVite, launch, routeMojang, fixturesDir, unzip, decodePng } = require('./lib.cjs');

const argv = process.argv.slice(2);
const baseArg = argv.find((a) => /^https?:/.test(a));
const shotsDir = argv.includes('--shots') ? argv[argv.indexOf('--shots') + 1] : null;
const doBedrock = !argv.includes('--no-bedrock');
if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tx-pbr-'));
const J = 'assets/minecraft/textures/';
const ORE = `${J}block/diamond_ore.png`;

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
}
const shot = async (page, name) => {
  if (shotsDir) await page.screenshot({ path: path.join(shotsDir, `${name}.png`) });
};
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

async function rgba(bytes) {
  const png = await decodePng(bytes);
  const { width, height, channels: c } = png;
  const out = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    if (c === 4) out.set(png.data.subarray(i * 4, i * 4 + 4), i * 4);
    else if (c === 3) out.set([png.data[i * 3], png.data[i * 3 + 1], png.data[i * 3 + 2], 255], i * 4);
  }
  return { width, height, data: out };
}
const json = (bytes) => JSON.parse(Buffer.from(bytes).toString('utf8'));

async function newPack(page, base, { name, bedrock = false }) {
  await page.goto(base + '#/textures');
  await page.waitForSelector('.tx-new .tx-start-opt');
  if (bedrock) {
    await page.click('.tx-new .segmented-item[data-value="bedrock"]');
    await page.waitForFunction(() => /Bedrock/.test(document.querySelector('.tx-new .vp-trigger')?.textContent ?? ''));
  }
  await page.fill('.tx-name-field input', name);
  await page.click('.tx-create-btn');
  await page.waitForURL(/(#\/|\/)textures\/[0-9a-f-]+\/?$/, { timeout: 15000 });
  await page.waitForFunction(() => !!window.__tx && document.querySelector('.tx-main'), null, { timeout: 180000 });
}

async function openTexture(page, p) {
  await page.evaluate((x) => window.__tx.open(x), p);
  await page.waitForFunction((x) => window.__tx.canvas.current()?.key === x, p, { timeout: 30000 });
}

/** The Material tab from the side panel's tabs (desktop) or the tab bar (phones). */
async function materialTab(page, phone = false) {
  await page.click(phone ? '.tx-tabbar-btn[data-v="material"]' : '.tx-col-tabs .tab[data-value="material"]');
  await page.waitForSelector('.pbr-presets', { state: 'visible', timeout: 60000 });
  await page.waitForTimeout(400);
}

const material = (page, p) => page.evaluate((x) => JSON.parse(JSON.stringify(window.__tx.store.project.pbr?.[x] ?? null)), p);

/** Mean brightness and spread of the 3D preview's pixels (a screenshot of the stage). */
async function heroStats(page) {
  const buf = await (await page.$('.pbr-hero')).screenshot();
  const img = await rgba(buf);
  let sum = 0;
  let sq = 0;
  const n = img.width * img.height;
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3;
    sum += v;
    sq += v * v;
  }
  const mean = sum / n;
  return { mean, spread: Math.sqrt(sq / n - mean * mean), buf };
}

async function setSlider(page, sel, value) {
  await page.fill(`${sel} input[type=number]`, String(value));
  await page.press(`${sel} input[type=number]`, 'Enter');
  await page.waitForTimeout(150);
}

async function exportPack(page, ext) {
  await page.waitForSelector('.tx-save[data-state="saved"]', { timeout: 30000 });
  await page.click('.tx-export-btn');
  await page.waitForSelector('.tx-export-modal .tx-exp-rows');
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 300000 }), page.click(`.tx-export-modal .btn-primary:has-text("Export ${ext}")`)]);
  const file = path.join(tmp, download.suggestedFilename());
  await download.saveAs(file);
  await page.waitForSelector('.tx-exp-done', { timeout: 60000 });
  const warnings = await page.$$eval('.tx-exp-warnings li', (l) => l.map((x) => x.textContent));
  await page.click('.tx-export-modal .btn-primary:has-text("Done")');
  return { zip: unzip(file), warnings, file };
}

(async () => {
  const fx = fixturesDir();
  const vite = baseArg ? null : await startVite();
  const base = baseArg ?? vite.url;
  const browser = await launch();
  const errors = [];
  const watch = (page) => {
    page.on('console', (m) => {
      if (m.type() === 'error' && !/Failed to load resource|net::ERR|favicon/i.test(m.text())) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(String(e)));
  };
  try {
    // ------------------------------------------------------------------ Java 26.3
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, colorScheme: 'dark', acceptDownloads: true });
    await routeMojang(ctx, fx);
    const page = await ctx.newPage();
    watch(page);
    await newPack(page, base, { name: 'E2E PBR' });
    await openTexture(page, ORE);
    const before = await page.evaluate(() => [...performance.getEntriesByType('resource')].filter((r) => /pbr\//.test(r.name)).length);
    check('the Material tab code loads only when the tab opens', before === 0, `${before} files`);
    await materialTab(page);
    check('Material tab names the open texture', (await page.textContent('.pbr-title')).includes('diamond_ore.png'));
    check('Java: the note says these need a labPBR shader', /labPBR/.test(await page.textContent('.pbr-intro')) && /shader maker/.test(await page.textContent('.pbr-about')));
    check('no material yet: None is picked', (await page.getAttribute('.pbr-preset[data-preset="none"]', 'aria-pressed')) === 'true');
    check('Java has no "The game’s" choice', await page.isHidden('.pbr-preset[data-preset="game"]'));
    const look0 = await heroStats(page);
    check('the lit 3D preview draws the block', look0.spread > 12, `spread ${look0.spread.toFixed(1)}`);
    await shot(page, 'pbr-java-1280-dark');

    // quick materials
    await page.click('.pbr-preset[data-preset="glowSpots"]');
    let m = await material(page, ORE);
    check('Glowing spots: colourful pixels glow', m?.preset === 'glowSpots' && m.spots.length === 1 && m.spots[0].where.kind === 'colourful' && m.spots[0].values[1] === 255, JSON.stringify(m));
    check('Glowing spots has bumps', !!m.bumps);
    await page.click('.pbr-preset[data-preset="metal"]');
    check('Metal replaces it', (await material(page, ORE)).preset === 'metal');
    await page.click('.toast:has-text("Metal on") .toast-actions .btn:has-text("Undo")');
    await page.waitForTimeout(200);
    check('Undo from the toast brings Glowing spots back', (await material(page, ORE))?.preset === 'glowSpots');

    // the maps on the block, the light and night
    await page.click('.pbr-map[data-view="glow"]');
    await page.waitForTimeout(300);
    check('the glow map shows on the block, with its explanation', (await page.textContent('.pbr-caption')).includes('white parts give off light') && (await page.textContent('.pbr-view-tag')) === 'Glow');
    const glowView = await heroStats(page);
    check('the glow map looks different from the texture', Math.abs(glowView.mean - look0.mean) > 3, `${look0.mean.toFixed(1)} -> ${glowView.mean.toFixed(1)}`);
    await page.click('.pbr-map[data-view="bumps"]');
    await page.waitForTimeout(300);
    const bumpsView = await heroStats(page);
    check('the bump map shows (blue-ish normal map)', bumpsView.mean !== glowView.mean);
    await page.click('.pbr-map[data-view="look"]');
    const moving = await page.getAttribute('.pbr-move', 'aria-pressed');
    await setSlider(page, '.pbr-light', 200);
    check('moving the light slider holds the light still', (await page.getAttribute('.pbr-move', 'aria-pressed')) === 'false', `was ${moving}`);
    await page.click('.pbr-move');
    check('the light can move again', (await page.getAttribute('.pbr-move', 'aria-pressed')) === 'true');
    await page.click('.pbr-move');
    await page.click('.pbr-night');
    await page.waitForTimeout(400);
    const night = await heroStats(page);
    check('night: dark around the block, the spots still glow', (await page.$eval('.pbr-hero', (e) => e.classList.contains('is-night'))) && night.mean < look0.mean, `${night.mean.toFixed(1)} < ${look0.mean.toFixed(1)}`);
    await shot(page, 'pbr-java-night');
    await page.click('.pbr-night');

    // fine-tune: values of the whole texture
    await setSlider(page, '.pbr-values .slider[data-value="shine"]', 80);
    m = await material(page, ORE);
    check('Shine 80 % = roughness 51', m.base[2] === 51 && m.preset === undefined, JSON.stringify(m.base));
    await setSlider(page, '.pbr-values .slider[data-value="through"]', 50);
    check('Light through 50 % = subsurface 128', (await material(page, ORE)).base[3] === 128);
    await setSlider(page, '.pbr-values .slider[data-value="through"]', 0);

    // parts
    await page.click('.pbr-part[data-part="0"]');
    await page.waitForSelector('.pbr-where .pbr-kind select');
    const covered = Number((await page.textContent('.pbr-mask-count')).replace(/\D/g, ''));
    check('a part shows how many pixels it covers', covered > 10 && covered < 200, `${covered}`);
    await setSlider(page, '.pbr-values .slider[data-value="glow"]', 60);
    check('the values edit the part', (await material(page, ORE)).spots[0].values[1] === 153);
    await page.selectOption('.pbr-where .pbr-kind select', 'bright');
    check('Bright pixels', (await material(page, ORE)).spots[0].where.kind === 'bright');
    await page.selectOption('.pbr-where .pbr-kind select', 'colour');
    await page.waitForSelector('.pbr-colour');
    await page.click('.pbr-colour:nth-child(2)');
    m = await material(page, ORE);
    check('Pixels of some colours: a swatch adds its colour', m.spots[0].where.kind === 'colour' && m.spots[0].where.colours.length === 2, JSON.stringify(m.spots[0].where));
    await page.selectOption('.pbr-where .pbr-kind select', 'area');
    await page.evaluate(() => window.__tx.canvas.canvas().setSelection({ x: 2, y: 3, w: 4, h: 5 }));
    await page.click('.pbr-area-row .btn');
    m = await material(page, ORE);
    check('An area you select: the pixel editor’s selection', JSON.stringify(m.spots[0].where.rect) === '[2,3,4,5]' && JSON.stringify(m.spots[0].where.size) === '[16,16]', JSON.stringify(m.spots[0].where));
    await page.selectOption('.pbr-where .pbr-kind select', 'colourful');
    await page.click('.pbr-part-add');
    check('Add a part', (await material(page, ORE)).spots.length === 2 && (await page.getAttribute('.pbr-part[data-part="1"]', 'aria-pressed')) === 'true');
    await page.click('.pbr-part-remove');
    check('Remove this part', (await material(page, ORE)).spots.length === 1);
    await page.click('.pbr-part[data-part="-1"]');

    // bumps
    await page.click('.pbr-bumps .toggle .switch');
    check('bumps off', (await material(page, ORE)).bumps === null && (await page.isHidden('.pbr-bump-opts')));
    await page.click('.pbr-bumps .toggle .switch');
    await setSlider(page, '.pbr-bump-opts .slider:nth-child(1)', 2);
    check('bump strength', (await material(page, ORE)).bumps.strength === 2);
    const files = await page.textContent('.pbr-files');
    check('says which files the export writes', files.includes('diamond_ore_n.png') && files.includes('diamond_ore_s.png'), files);

    // use on similar textures
    await page.click('.pbr-similar-btn');
    await page.waitForSelector('.pbr-sim-modal .pbr-sim-row');
    check('similar textures: names ending in _ore', /_ore/.test(await page.textContent('.pbr-sim-row[data-kind="suffix"]')));
    await shot(page, 'pbr-similar');
    await page.click('.pbr-sim-row[data-kind="suffix"] .switch');
    const applyLabel = await page.textContent('.pbr-sim-modal .btn-primary');
    await page.click('.pbr-sim-modal .btn-primary');
    await page.waitForTimeout(300);
    const similar = await page.evaluate(() => Object.keys(window.__tx.store.project.pbr ?? {}));
    check('the material goes on every *_ore texture', similar.includes(`${'assets/minecraft/textures/'}block/deepslate_diamond_ore.png`) && similar.includes(`${'assets/minecraft/textures/'}block/iron_ore.png`) && similar.length > 10, `${applyLabel}: ${similar.length}`);

    // export
    const { zip, warnings } = await exportPack(page, '.zip');
    const n = zip[`${J}block/diamond_ore_n.png`];
    const s = zip[`${J}block/diamond_ore_s.png`];
    check('Java zip: diamond_ore_n.png and _s.png next to the texture', !!n && !!s);
    check('Java zip: the similar ores got theirs', !!zip[`${J}block/deepslate_diamond_ore_s.png`] && !!zip[`${J}block/iron_ore_n.png`]);
    check('Java zip: the vanilla colour texture is not added', !zip[ORE]);
    if (s) {
      const spec = await rgba(s);
      const alphas = new Set();
      for (let i = 3; i < spec.data.length; i += 4) alphas.add(spec.data[i]);
      check('_s: emission in alpha (255 = none, below for the gems)', alphas.has(255) && [...alphas].some((a) => a < 255), [...alphas].join(','));
      check('_s: F0 4 % for stone', spec.data[1] === 10);
      const nm = await rgba(n);
      check('_n: 16 × 16 with height in alpha', nm.width === 16 && nm.data[3] >= 1);
    }
    check('Java export: no warnings', warnings.length === 0, warnings.join(' | '));

    // reload: saved with the project
    await page.reload();
    await page.waitForFunction(() => !!window.__tx && document.querySelector('.tx-main'), null, { timeout: 180000 });
    check('materials are saved with the project', (await material(page, ORE))?.spots.length === 1);
    await openTexture(page, ORE);
    await materialTab(page);
    await page.click('.pbr-remove-btn');
    check('Take the material off', (await material(page, ORE)) === null && (await page.getAttribute('.pbr-preset[data-preset="none"]', 'aria-pressed')) === 'true');

    // a texture the game draws flat
    await openTexture(page, `${J}gui/sprites/hud/heart/full.png`);
    await page.waitForTimeout(200);
    check('a GUI texture: no materials, a note says why', (await page.isVisible('.pbr-flat')) && (await page.isHidden('.pbr-body')));

    // light theme
    await page.emulateMedia({ colorScheme: 'light' });
    await openTexture(page, `${J}block/oak_leaves.png`);
    await page.click('.pbr-preset[data-preset="plants"]');
    await page.waitForTimeout(400);
    await shot(page, 'pbr-java-1280-light');
    await ctx.close();

    // ------------------------------------------------------------------ an opened Java pack with labPBR maps
    {
      const { zipSync } = require(path.join(ROOT, 'node_modules/fflate'));
      const { encode } = await import(path.join(ROOT, 'node_modules/fast-png/lib/index.js'));
      const map = (fill) => Buffer.from(encode({ width: 16, height: 16, data: new Uint8Array(16 * 16 * 4).map((_v, i) => fill[i % 4]), channels: 4, depth: 8 }));
      const sBytes = map([200, 255, 0, 255]);
      const nBytes = map([128, 128, 255, 200]);
      const file = path.join(tmp, 'labpbr-pack.zip');
      fs.writeFileSync(
        file,
        zipSync({
          'pack.mcmeta': Buffer.from(JSON.stringify({ pack: { pack_format: 97, description: 'labPBR test' } })),
          [`${J}block/iron_block_s.png`]: sBytes,
          [`${J}block/iron_block_n.png`]: nBytes,
        }),
      );
      const ictx = await browser.newContext({ viewport: { width: 1280, height: 860 }, colorScheme: 'dark', acceptDownloads: true });
      await routeMojang(ictx, fx);
      const ip = await ictx.newPage();
      watch(ip);
      await ip.goto(base + '#/textures');
      await ip.waitForSelector('.tx-open-dz');
      await ip.setInputFiles('.tx-open-dz input[type=file]', file);
      // notes about the pack come in a dialog first
      await ip.waitForFunction(() => /textures\/[0-9a-f-]+\/?$/.test(location.href) || document.querySelector('dialog[open] .btn-primary'), null, { timeout: 60000 });
      const warn = await ip.$('dialog[open] .btn-primary');
      if (warn) await warn.click();
      await ip.waitForURL(/(#\/|\/)textures\/[0-9a-f-]+\/?$/, { timeout: 60000 });
      await ip.waitForFunction(() => !!window.__tx && document.querySelector('.tx-main'), null, { timeout: 180000 });
      const im = await material(ip, `${J}block/iron_block.png`);
      check('opened pack: _n / _s become the texture’s material', im?.map?.layout === 'specular' && im?.normal?.layout === 'labpbr');
      check('opened pack: the maps are not textures of their own', await ip.evaluate((p) => !window.__tx.store.byPath.has(p) && !window.__tx.store.project.overrides[p], `${J}block/iron_block_s.png`));
      await openTexture(ip, `${J}block/iron_block.png`);
      await materialTab(ip);
      const shine = Number(await ip.inputValue('.pbr-values .slider[data-value="shine"] input[type=number]'));
      check('opened pack: the Material tab shows its shine', Math.abs(shine - 78) <= 1, `${shine}`);
      check('opened pack: shows the files it keeps', (await ip.textContent('.pbr-files')).includes('iron_block_s.png'));
      check('opened pack: uses its bump map', await ip.isVisible('.pbr-bumps .tx-inline-note'));
      const { zip: iz } = await exportPack(ip, '.zip');
      check('opened pack: _n / _s exported unchanged', Buffer.from(iz[`${J}block/iron_block_s.png`]).equals(sBytes) && Buffer.from(iz[`${J}block/iron_block_n.png`]).equals(nBytes));
      await ictx.close();
    }

    // ------------------------------------------------------------------ phone
    {
      const pctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light', deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      await routeMojang(pctx, fx);
      const pp = await pctx.newPage();
      watch(pp);
      await newPack(pp, base, { name: 'E2E PBR phone' });
      await openTexture(pp, ORE);
      await materialTab(pp, true);
      check('390 px: Material tab in the tab bar', (await pp.getAttribute('.tx-editor', 'data-mobile')) === 'material');
      check('390 px: no sideways scrolling', await noSideScroll(pp));
      // names that would run together are hidden (kept for screen readers) and the tab shows its icon
      const clipped = await pp.$$eval('.tx-tabbar-btn span:not(.icon)', (els) => els.filter((e) => e.clientWidth > 1 && e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent));
      check('390 px: the seven tab bar labels fit', clipped.length === 0, clipped.join(', '));
      const unnamed = await pp.$$eval('.tx-tabbar-btn', (bs) =>
        bs.filter((b) => (b.querySelector('span:not(.icon)')?.clientWidth ?? 0) <= 1 && !(b.querySelector('.icon')?.getBoundingClientRect().width > 0)).map((b) => b.dataset.v),
      );
      check('390 px: every tab shows its name or its icon', unnamed.length === 0, unnamed.join(', '));
      const small = await pp.$$eval('.pbr-preset, .pbr-part, .pbr-map, .pbr-light-btns .icon-btn', (els) => els.filter((e) => e.offsetParent && Math.min(e.getBoundingClientRect().width, e.getBoundingClientRect().height) < 40).length);
      check('390 px: finger-sized buttons', small === 0, `${small} small`);
      check('390 px: touch wording', true);
      await pp.tap('.pbr-preset[data-preset="glowSpots"]');
      await pp.tap('.pbr-part[data-part="0"]');
      await pp.selectOption('.pbr-where .pbr-kind select', 'colour');
      check('390 px: “Tap the colours”', (await pp.textContent('.pbr-where')).includes('Tap the colours'));
      await shot(pp, 'pbr-390-light');
      await pp.emulateMedia({ colorScheme: 'dark' });
      await pp.evaluate(() => document.querySelector('.tx-side-body[data-tab="material"]').scrollTo(0, 0));
      await pp.waitForTimeout(300);
      await shot(pp, 'pbr-390-dark');
      await pctx.close();
    }

    // ------------------------------------------------------------------ Bedrock
    if (doBedrock) {
      const bctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, colorScheme: 'light', acceptDownloads: true });
      const bp = await bctx.newPage();
      watch(bp);
      await newPack(bp, base, { name: 'E2E PBR Bedrock', bedrock: true });
      const STONE = 'textures/blocks/stone.png';
      await openTexture(bp, STONE);
      await materialTab(bp);
      await bp.waitForFunction(() => document.querySelector('.pbr-preset[data-preset="game"]:not([hidden])'), null, { timeout: 60000 });
      check('Bedrock: starts from the game’s material', (await bp.getAttribute('.pbr-preset[data-preset="game"]', 'aria-pressed')) === 'true');
      check('Bedrock: the note is about Vibrant Visuals', /Vibrant Visuals/.test(await bp.textContent('.pbr-intro')));
      await setSlider(bp, '.pbr-values .slider[data-value="metal"]', 100);
      const bm = await material(bp, STONE);
      check('Bedrock: a slider gives the whole texture one value (the game’s map gives way)', bm && !bm.map && bm.base[0] === 255, JSON.stringify(bm?.base));
      await bp.click('.pbr-bumps .toggle .switch');
      await shot(bp, 'pbr-bedrock-1280-light');
      // an edited texture without a material keeps the game's set
      await openTexture(bp, 'textures/blocks/dirt.png');
      const pt = await bp.evaluate(() => {
        const pc = window.__tx.canvas.canvas();
        pc.setTool('pencil');
        pc.setColor([200, 40, 40, 255]);
        const r = pc.element.querySelector('canvas').getBoundingClientRect();
        const [sx, sy] = pc.getView().toScreen(3.5, 4.5);
        return [r.left + sx, r.top + sy];
      });
      await bp.mouse.click(pt[0], pt[1]);
      await bp.waitForFunction(() => window.__tx.store.isEdited('textures/blocks/dirt.png'));
      const { zip: bz, warnings: bw } = await exportPack(bp, '.mcpack');
      const manifest = json(bz['manifest.json']);
      check('mcpack: manifest has the "pbr" capability', JSON.stringify(manifest.capabilities) === '["pbr"]', JSON.stringify(manifest.capabilities));
      const mev = manifest.header.min_engine_version;
      check('mcpack: min_engine_version 1.21.120 or newer', mev[0] > 1 || mev[1] > 21 || mev[2] >= 120, JSON.stringify(mev));
      const set = bz['textures/blocks/stone.texture_set.json'] && json(bz['textures/blocks/stone.texture_set.json']);
      check('mcpack: stone.texture_set.json with uniform MER and a normal map', set && set['minecraft:texture_set'].color === 'stone' && JSON.stringify(set['minecraft:texture_set'].metalness_emissive_roughness)?.startsWith('[255,') && set['minecraft:texture_set'].normal === 'stone_normal', JSON.stringify(set));
      check('mcpack: the normal map and the colour texture are in the pack', !!bz['textures/blocks/stone_normal.png'] && !!bz[STONE]);
      const dirtSet = bz['textures/blocks/dirt.texture_set.json'];
      check('mcpack: the edited dirt keeps the game’s texture set', !!dirtSet && /dirt_mers/.test(Buffer.from(dirtSet).toString()) && !!(bz['textures/blocks/dirt_mers.tga'] || bz['textures/blocks/dirt_mers.png']));
      check('mcpack: no warnings', bw.length === 0, bw.join(' | '));
      await bctx.close();
    }
  } catch (err) {
    console.error(err);
    failures++;
  } finally {
    await browser.close();
    vite?.stop();
  }
  check('no console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
  console.log(failures ? `\n${failures} check(s) failed` : '\nAll PBR checks passed');
  process.exit(failures ? 1 : 0);
})();
