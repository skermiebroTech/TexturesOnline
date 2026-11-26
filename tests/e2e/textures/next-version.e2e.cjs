// End-to-end checks of every tool on the newest Java development version (lib.cjs NEXT_VERSION, e.g.
// 26.4-pre-1), with its real client jar from the fixtures (client-<version>.jar next to client-26.3.jar).
// Skips when that jar isn't there. Texture editor: the version is picked with the snapshots switch,
// its new textures are listed with categories, new blocks and items show in 3D, animated textures
// play, the zip has the version's pack format; a 26.3 pack switched to it is told which textures the
// game renamed. Pack Doctor, the converter and Merge rename those textures; the font maker, the
// totem maker and the vanilla shader maker export for the version (shaders: the post effect's vertex
// shader is one the version has). No console errors.
// Usage: NODE_PATH=$(npm root -g) TO_FIXTURES=<dir> SKINS_JAR=<dir>/client-26.3.jar node tests/e2e/textures/next-version.e2e.cjs [baseUrl]
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ROOT, NEXT_VERSION: V, startVite, launch, routeMojang, fixturesDir, nextJar, unzip } = require('./lib.cjs');

const argv = process.argv.slice(2);
const baseArg = argv.find((a) => /^https?:/.test(a));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tx-next-'));
const J = 'assets/minecraft/textures/';

let failures = 0;
const results = [];
function check(name, ok, detail = '') {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  console.log(results[results.length - 1]);
  if (!ok) failures++;
}
const json = (b) => (b ? JSON.parse(Buffer.from(b).toString('utf8')) : undefined);

/** Picks a version in a version picker, switching snapshots on first. */
async function pickVersion(page, trigger, id) {
  await page.locator(trigger).first().click();
  const pop = page.locator('.vp-pop:visible').last();
  await pop.locator('.vp-list').waitFor();
  const sw = pop.locator('.vp-pop-head .switch');
  if ((await sw.getAttribute('aria-checked')) !== 'true') await sw.click();
  await pop.locator('input[type=search]').fill(id);
  await pop.locator('.vp-item', { has: page.locator(`.vp-item-name:text-is("${id}")`) }).first().click({ timeout: 60000 });
  await page.waitForFunction(([sel, v]) => document.querySelector(sel)?.textContent.includes(v), [trigger, id], { timeout: 30000 });
}

async function waitEditor(page, version) {
  await page.waitForFunction((v) => !!window.__tx && document.querySelector('.tx-main') && window.__tx.store.project.version === v && window.__tx.store.assets?.version === v && window.__tx.store.entries.length > 1000, version, { timeout: 180000 });
}

async function openTexture(page, p) {
  await page.evaluate((x) => window.__tx.open(x), p);
  await page.waitForFunction((x) => window.__tx.canvas.current()?.key === x, p, { timeout: 60000 });
}

async function download(page, click, timeout = 180000) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout }), click()]);
  const file = path.join(tmp, `${Date.now()}-${dl.suggestedFilename()}`);
  await dl.saveAs(file);
  return { file, name: dl.suggestedFilename(), zip: unzip(file) };
}

async function exportEditor(page) {
  await page.click('.tx-export-btn');
  await page.waitForSelector('.tx-export-modal .tx-exp-rows');
  const d = await download(page, () => page.click('.tx-export-modal .btn-primary:has-text("Export .zip")'));
  await page.waitForSelector('.tx-exp-done', { timeout: 30000 });
  d.warnings = await page.$$eval('.tx-exp-warnings li', (l) => l.map((x) => x.textContent.trim()));
  await page.click('.tx-export-modal .btn-primary:has-text("Done")');
  return d;
}

/** pack.mcmeta of the version alone: min_format / max_format, nothing older. */
const forVersion = (meta, f) => meta?.pack && meta.pack.min_format === f && meta.pack.max_format === f && !('pack_format' in meta.pack) && !('supported_formats' in meta.pack);

async function png(w, h, rgba) {
  const { encode } = await import(path.join(ROOT, 'node_modules/fast-png/lib/index.js'));
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set(rgba, i * 4);
  return encode({ width: w, height: h, data, channels: 4, depth: 8 });
}

/** A 26.3 pack with a texture 26.4 renamed (the friends tab button) and one it kept. */
async function oldPack() {
  const { zipSync, strToU8 } = require(path.join(ROOT, 'node_modules/fflate'));
  const file = path.join(tmp, 'Old GUI.zip');
  fs.writeFileSync(
    file,
    zipSync({
      'pack.mcmeta': strToU8(JSON.stringify({ pack: { description: 'Old GUI', min_format: [97, 1], max_format: 97 } })),
      [`${J}gui/sprites/friends/button.png`]: await png(200, 20, [200, 40, 40, 255]),
      [`${J}block/stone.png`]: await png(16, 16, [40, 40, 200, 255]),
    }),
  );
  return file;
}

(async () => {
  const fx = fixturesDir();
  const jarPath = nextJar(fx);
  if (!jarPath) {
    console.log(`SKIP  no client-${V}.jar in TO_FIXTURES: nothing to check`);
    process.exit(0);
  }
  const { unzipSync } = require(path.join(ROOT, 'node_modules/fflate'));
  const jarNames = new Set();
  const fromJar = unzipSync(new Uint8Array(fs.readFileSync(jarPath)), {
    filter: (f) => {
      jarNames.add(f.name);
      return f.name === 'version.json';
    },
  });
  const FORMAT = json(fromJar['version.json']).pack_version.resource_major;
  const server = baseArg ? null : await startVite();
  const base = baseArg || server.url;
  console.log(`base ${base} · ${V} (resource pack format ${FORMAT}) · tmp ${tmp}`);
  const browser = await launch();
  const errors = [];
  const watch = (page) => {
    page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon|ERR_|404|Failed to load resource/.test(m.text())) errors.push(m.text());
    });
  };
  try {
    const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 900 } });
    await routeMojang(ctx, fx);
    const page = await ctx.newPage();
    watch(page);
    const packs = { old: await oldPack() };

    // ---------------------------------------------------------------- texture editor: a new pack
    await page.goto(base + '#/textures');
    await page.waitForSelector('.tx-new');
    await pickVersion(page, '.tx-new .vp-trigger', V);
    check(`the version picker offers ${V} with snapshots on`, true, (await page.textContent('.tx-new .vp-trigger')).trim());
    await page.fill('.tx-name-field input', 'E2E Next');
    await page.click('.tx-create-btn');
    await page.waitForURL(/(#\/|\/)textures\/[0-9a-f-]+\/?$/, { timeout: 15000 });
    await waitEditor(page, V);
    const list = await page.evaluate((paths) => {
      const s = window.__tx.store;
      return { count: s.entries.length, cats: paths.map((p) => s.entries.find((e) => e.path === p)?.category ?? null), gone: !!s.entries.find((e) => e.path.endsWith('gui/sprites/friends/button.png')) };
    }, ['block/icicle_tip', 'item/ice_ball', 'entity/zombie/frostbite', 'particle/freezing_0', 'gui/sprites/friends/tab'].map((p) => `${J}${p}.png`));
    check(`the texture list has the whole ${V} set`, list.count > 3500, `${list.count} textures`);
    check('new textures are listed with their categories', list.cats.join() === 'block,item,entity,particle,gui', list.cats.join());
    check('a texture the version no longer has is not listed', !list.gone);

    // 3D previews of new blocks and items
    await page.waitForFunction(() => window.__tx.models.lib?.usageReady, null, { timeout: 180000 });
    for (const id of ['icicle', 'ice_crystal', 'snow_bricks', 'calcite_pillar', 'polished_calcite_stairs', 'brittle_ice']) {
      const shown = await page.evaluate((i) => window.__tx.showBlock(i), id);
      if (!shown) {
        check(`block ${id}: listed`, false);
        continue;
      }
      await page.waitForFunction((i) => window.__tx.preview.current()?.entry.id === i, id, { timeout: 30000 });
      const v = await page.evaluate(() => {
        const c = window.__tx.preview.current();
        const m = window.__tx.models.lib.resolve(c.entry, c.state);
        return { shape: m.shape, quads: m.quads.length, textures: [...new Set(m.quads.map((q) => q.texture))], missing: m.quads.filter((q) => !q.texture || !window.__tx.store.assets.hasFile(q.texture)).length };
      });
      let point = null;
      for (let i = 0; i < 40 && !point; i++) {
        point = await page.evaluate((t) => window.__tx.preview.facePoint(t), v.textures[0]);
        if (!point) await page.waitForTimeout(250);
      }
      check(`block ${id}: a 3D model with the version's textures, drawn in the preview`, v.shape === 'model' && v.quads > 0 && v.missing === 0 && !!point, `${v.quads} faces, ${v.textures.map((t) => t.replace(J, '')).join(' ')}`);
    }
    for (const id of ['ice_ball', 'icicle', 'music_disc_flurry', 'frostbite_spawn_egg']) {
      await page.evaluate((i) => window.__tx.preview.showEntry(window.__tx.models.lib.item(i)), id);
      await page.waitForFunction((i) => window.__tx.preview.current()?.entry.id === i, id, { timeout: 30000 });
      const v = await page.evaluate(() => {
        const c = window.__tx.preview.current();
        const m = window.__tx.models.lib.resolve(c.entry, c.state);
        const t = [...m.quads.map((q) => q.texture), ...m.sprite.map((s) => s.path)];
        return { shape: m.shape, n: t.length, missing: t.filter((p) => !p || !window.__tx.store.assets.hasFile(p)).length };
      });
      check(`item ${id}: shown with the version's textures`, v.n > 0 && v.missing === 0, `${v.shape}, ${v.n} textures`);
    }

    // animations: the game's (the loading spinner moved to widget/ in 26.4) and one made here
    await openTexture(page, `${J}gui/sprites/widget/loading.png`);
    await page.waitForSelector('.tx-frames:not([hidden]) .tx-frame', { timeout: 30000 });
    const spinner = await page.$$eval('.tx-frames-list .tx-frame', (l) => l.length);
    check('an animated texture of the version opens with its frames', spinner === 3, `${spinner} frames`);
    const SNOW = `${J}block/snow_bricks.png`;
    await openTexture(page, SNOW);
    await page.click('.tx-head-actions .icon-btn:last-child');
    await page.click('[role=menuitem]:has-text("Make animated")');
    await page.waitForSelector('.tx-frames:not([hidden]) .tx-frame');
    check('a new block can be animated', (await page.$$eval('.tx-frames-list .tx-frame', (l) => l.length)) === 2);
    await page.waitForSelector('.tx-save[data-state="saved"]', { timeout: 30000 });

    // GUI mode lists the version's pieces
    await page.locator('.tx-libbar .segmented-item[data-value="gui"]:visible').first().click();
    await page.waitForSelector('.gui-lib .gui-tile', { timeout: 60000 });
    check('GUI mode lists the version’s pieces', (await page.$$('.gui-lib .gui-tile')).length > 50, `${(await page.$$('.gui-lib .gui-tile')).length} pieces`);

    const made = await exportEditor(page);
    check(`export: pack.mcmeta for ${V} alone (format ${FORMAT})`, forVersion(json(made.zip['pack.mcmeta']), FORMAT), JSON.stringify(json(made.zip['pack.mcmeta'])?.pack));
    check('export: the animated new block with its .mcmeta', !!made.zip[SNOW] && json(made.zip[`${SNOW}.mcmeta`])?.animation?.frametime > 0, Object.keys(made.zip).filter((k) => k.includes('snow')).join());
    check('export: no warnings', made.warnings.length === 0, made.warnings.join(' | '));
    packs.made = path.join(tmp, 'Made For Next.zip');
    fs.copyFileSync(made.file, packs.made);

    // ---------------------------------------------------------------- texture editor: a 26.3 pack switched to the version
    await page.goto(base + '#/textures');
    await page.waitForSelector('.tx-open-dz');
    await page.setInputFiles('.tx-open-dz input[type=file]', packs.old);
    await page.waitForURL(/(#\/|\/)textures\/[0-9a-f-]+\/?$/, { timeout: 60000 });
    const warn = await page.$('dialog[open] .btn-primary:has-text("Open in editor")');
    if (warn) await warn.click();
    await waitEditor(page, '26.3');
    check('a 26.3 pack opens as 26.3', true);
    await page.click('.tx-col-tabs .tab[data-value="pack"]');
    await pickVersion(page, '.tx-pack .vp-trigger', V);
    await page.click('dialog[open] .btn-primary:has-text("Switch version")');
    await waitEditor(page, V);
    const kept = await page.evaluate((p) => window.__tx.store.isEdited(p), `${J}gui/sprites/friends/button.png`);
    check(`switched to ${V}: the pack's own textures are kept`, kept);
    const moved = await exportEditor(page);
    check(`switched pack: pack.mcmeta for ${V}`, forVersion(json(moved.zip['pack.mcmeta']), FORMAT), JSON.stringify(json(moved.zip['pack.mcmeta'])?.pack));
    check('switched pack: the export says which texture the game renamed', moved.warnings.some((w) => w.includes('gui/sprites/friends/button.png → gui/sprites/friends/tab.png')), moved.warnings.join(' | '));

    // ---------------------------------------------------------------- Pack Doctor
    await page.goto(base + 'pack-doctor');
    await page.waitForSelector('.dr-dz');
    await page.setInputFiles('.dr-dz input[type=file]', packs.old);
    await page.waitForSelector('.dr-result .dr-headline', { timeout: 120000 });
    await pickVersion(page, '.dr-version .vp-trigger', V);
    await page.waitForFunction((v) => document.querySelector('.dr-result .cv-res-titles .eyebrow')?.textContent.includes(v), V, { timeout: 60000 });
    await page.waitForFunction(() => !document.querySelector('.dr-result .cv-res-icon.is-busy'), null, { timeout: 120000 });
    const codes = await page.$$eval('.dr-issue', (els) => els.map((e) => e.dataset.code));
    check(`Pack Doctor for ${V}: old pack format and the renamed texture found`, codes.includes('format-mismatch') && codes.includes('renamed-textures'), codes.join());
    await page.click('.dr-fix-all');
    await page.waitForSelector('.dr-result .dr-ba', { timeout: 120000 });
    await page.waitForFunction(() => !document.querySelector('.dr-result .btn.is-busy'), null, { timeout: 60000 });
    const doc = await download(page, () => page.click('.dr-download'), 120000);
    check('Pack Doctor: the fixed pack has the new name and format', !!doc.zip[`${J}gui/sprites/friends/tab.png`] && !doc.zip[`${J}gui/sprites/friends/button.png`] && json(doc.zip['pack.mcmeta'])?.pack?.max_format === FORMAT, Object.keys(doc.zip).join());

    // ---------------------------------------------------------------- converter
    await page.goto(base + 'texture-pack-converter');
    await page.setInputFiles('.cv-dz input[type=file]', packs.old);
    await page.waitForSelector('.cv-pack:not([hidden]) .cv-pack-name', { timeout: 60000 });
    await page.click('.cv-ed[data-value="java"]');
    await pickVersion(page, '.cv-version .vp-trigger', V);
    await page.click('.cv-go');
    await page.waitForSelector('.cv-result .cv-dl-btn, .cv-result .cv-res-icon.is-error', { timeout: 300000 });
    const cvErr = await page.$('.cv-result .cv-res-icon.is-error');
    check(`converter: a 26.3 pack converts to ${V}`, !cvErr, cvErr ? (await page.textContent('.cv-result')).trim().slice(0, 200) : '');
    if (!cvErr) {
      const cv = await download(page, () => page.click('.cv-dl-btn'));
      check('converter: renamed texture and the version’s pack format', !!cv.zip[`${J}gui/sprites/friends/tab.png`] && !cv.zip[`${J}gui/sprites/friends/button.png`] && forVersion(json(cv.zip['pack.mcmeta']), FORMAT), Object.keys(cv.zip).join());
    }

    // ---------------------------------------------------------------- merge
    await page.goto(base + 'merge-texture-packs');
    await page.waitForSelector('.mg-dz');
    await page.setInputFiles('.mg-dz input[type=file]', [packs.made, packs.old]);
    await page.waitForFunction(() => document.querySelectorAll('.mg-list .mg-row').length === 2 && !document.querySelector('.mg-dz.is-busy'), null, { timeout: 60000 });
    const target = (await page.textContent('.mg-version .vp-trigger')).trim();
    check(`merge: the newest pack's version (${V}) is the target`, target.includes(V), target);
    await page.click('.mg-go');
    await page.waitForSelector('.mg-result .mg-dl-btn, .mg-result .cv-res-icon.is-error', { timeout: 120000 });
    const mgErr = await page.$('.mg-result .cv-res-icon.is-error');
    check('merge: the packs merge', !mgErr, mgErr ? (await page.textContent('.mg-result')).trim().slice(0, 200) : '');
    if (!mgErr) {
      const mg = await download(page, () => page.click('.mg-dl-btn'), 300000);
      check('merge: the 26.3 pack’s texture under its new name, the version’s format', !!mg.zip[`${J}gui/sprites/friends/tab.png`] && !mg.zip[`${J}gui/sprites/friends/button.png`] && json(mg.zip['pack.mcmeta'])?.pack?.max_format === FORMAT, Object.keys(mg.zip).filter((k) => k.endsWith('.png')).length + ' textures');
    }

    // ---------------------------------------------------------------- font maker
    await page.goto(base + 'font-maker');
    await page.waitForSelector('.fm-canvas');
    await pickVersion(page, '.fm-version .vp-trigger', V);
    const font = await download(page, () => page.click('.fm-dl-btn'), 120000);
    check(`font maker: a ${V} pack with default.json`, !!font.zip['assets/minecraft/font/default.json'] && forVersion(json(font.zip['pack.mcmeta']), FORMAT), JSON.stringify(json(font.zip['pack.mcmeta'])?.pack));

    // ---------------------------------------------------------------- totem maker
    await page.goto(base + 'totem-maker');
    await page.waitForSelector('.tt-tabs');
    await page.click('.tt-tab[data-source="default"]');
    await page.click('.tt-defaults .tt-skin-opt[data-skin="steve-wide"]');
    await page.waitForFunction(() => document.querySelector('.tt-chosen-name')?.textContent.trim() === 'Steve', null, { timeout: 30000 });
    await pickVersion(page, '.tt-version .vp-trigger', V);
    const totem = await download(page, () => page.click('.tt-dl-btn'), 120000);
    check(`totem maker: a ${V} pack with item/totem_of_undying.png`, !!totem.zip[`${J}item/totem_of_undying.png`] && forVersion(json(totem.zip['pack.mcmeta']), FORMAT), Object.keys(totem.zip).join());

    // ---------------------------------------------------------------- vanilla shaders
    await page.goto(base + '#/shaders', { waitUntil: 'domcontentloaded' });
    await page.click('.sh-card[data-target="java-vanilla"] .sh-card-start');
    await page.waitForSelector('.sh-new .sh-preset');
    await page.click('.sh-new .sh-preset[data-preset="noir"]');
    await page.getByRole('button', { name: 'Create pack' }).click();
    await page.waitForSelector('.sh-editor');
    await pickVersion(page, '.sh-pack .vp-trigger', V);
    const sh = await download(page, () => page.click('.sh-bar-export'));
    await page.waitForSelector('.sh-export-head.is-success');
    const shWarnings = await page.locator('.sh-export-warnings li').allInnerTexts();
    const eof = json(sh.zip['assets/minecraft/post_effect/end_of_frame.json']);
    const vertex = [...new Set((eof?.passes ?? []).map((p) => p.vertex_shader))];
    const vertexOk = vertex.length > 0 && vertex.every((id) => jarNames.has(`assets/minecraft/shaders/${id.replace(/^minecraft:/, '')}.vsh`));
    check(`vanilla shaders: pack.mcmeta for ${V}`, forVersion(json(sh.zip['pack.mcmeta']), FORMAT), JSON.stringify(json(sh.zip['pack.mcmeta'])?.pack));
    check('vanilla shaders: the colour grading post effect uses a vertex shader the version has', vertexOk, vertex.join());
    check('vanilla shaders: colours were not skipped', !shWarnings.some((w) => /Colors, vignette and bloom skipped/.test(w)), shWarnings.join(' | '));
    await ctx.close();
  } catch (err) {
    check('no unexpected exception', false, err && err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : String(err));
  } finally {
    await browser.close();
    server?.stop();
  }
  const errs = [...new Set(errors)];
  check('no console errors', errs.length === 0, errs.slice(0, 5).join(' || '));
  console.log(`\n${results.length - failures}/${results.length} checks passed`);
  process.exit(failures ? 1 : 0);
})();
