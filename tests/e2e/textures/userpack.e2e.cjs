// End-to-end check of a big real-world pack the site owner uses (a server's resource pack with its own
// namespace: thousands of textures, models, item definitions, animations, sounds, fonts and core
// shaders). The pack is never part of the repo: set TO_USERPACK to its .zip; without it this skips.
// Everything it looks for (names, paths, counts) is read from the pack itself at run time.
// Usage: NODE_PATH=$(npm root -g) TO_USERPACK=/path/to/pack.zip node tests/e2e/textures/userpack.e2e.cjs [baseUrl]
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startVite, launch, routeMojang, fixturesDir, unzip } = require('./lib.cjs');

const PACK = process.env.TO_USERPACK;
if (!PACK || !fs.existsSync(PACK)) {
  console.log('SKIP  set TO_USERPACK to a resource pack .zip to run this test');
  process.exit(0);
}
const argv = process.argv.slice(2);
const baseArg = argv.find((a) => /^https?:/.test(a));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tx-userpack-'));
/** The longest the page may be busy in one go while a pack opens (ms) */
const MAX_TASK = 500;

let failures = 0;
const results = [];
function check(name, ok, detail = '') {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  console.log(results[results.length - 1]);
  if (!ok) failures++;
}

// ---------------------------------------------------------------------------------------------- what the pack has
const input = unzip(PACK);
const names = Object.keys(input).filter((n) => !n.endsWith('/'));
const dec = new TextDecoder();
const jsonOf = (n) => {
  try {
    return JSON.parse(dec.decode(input[n]).replace(/^﻿/, ''));
  } catch {
    return null;
  }
};
const declared = jsonOf('pack.mcmeta')?.pack ?? {};
const textures = names.filter((n) => /^assets\/[^/]+\/textures\/.+\.png$/.test(n));
const ownTextures = textures.filter((n) => !n.startsWith('assets/minecraft/'));
const ownItems = names.filter((n) => /^assets\/[^/]+\/items\/.+\.json$/.test(n) && !n.startsWith('assets/minecraft/'));
const itemId = (n) => {
  const m = /^assets\/([^/]+)\/items\/(.+)\.json$/.exec(n);
  return `${m[1]}:${m[2]}`;
};
// an animated texture of the pack's own namespace, and an item whose look depends on its state
const animated = ownTextures.find((n) => input[`${n}.mcmeta`] && jsonOf(`${n}.mcmeta`)?.animation);
const stateful = ownItems.find((n) => /"(select|condition|range_dispatch)"/.test(dec.decode(input[n])));
const plainItem = ownItems.find((n) => jsonOf(n)?.model?.type === 'model');
console.log(`pack: ${names.length} files, ${textures.length} textures (${ownTextures.length} own), ${ownItems.length} own item definitions, format ${JSON.stringify(declared.min_format ?? declared.pack_format)}`);

const longTasks = () => {
  window.__long = [];
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) window.__long.push(Math.round(e.duration));
  }).observe({ type: 'longtask', buffered: true });
};
const longest = (page) => page.evaluate(() => Math.max(0, ...(window.__long ?? [])));
const resetLong = (page) => page.evaluate(() => (window.__long = []));

async function openFromStart(page, base) {
  await page.goto(base + '#/textures');
  await page.waitForSelector('.tx-open-dz');
  await resetLong(page);
  const t0 = Date.now();
  await page.setInputFiles('.tx-open-dz input[type=file]', PACK);
  // a pack with notes shows them first; then it opens in the editor
  await page.waitForFunction(() => /textures\/[0-9a-f-]{36}\/?$/.test(location.href) || document.querySelector('dialog[open] .btn-primary'), null, { timeout: 300000 });
  const modal = await page.$('dialog[open] .btn-primary');
  if (modal) await modal.click();
  await page.waitForFunction(() => !!window.__tx && document.querySelector('.tx-main'), null, { timeout: 300000 });
  return Date.now() - t0;
}

async function exportZip(page, file) {
  await page.click('.tx-export-btn');
  await page.waitForSelector('.tx-export-modal .tx-exp-rows');
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 300000 }), page.click('.tx-export-modal .btn-primary:has-text("Export .zip")')]);
  await download.saveAs(file);
  await page.waitForSelector('.tx-exp-done', { timeout: 60000 });
  await page.click('.tx-export-modal .btn-primary:has-text("Done")');
  return unzip(file);
}

const pretty = (id) => id.slice(id.lastIndexOf('/') + 1).replace(/^.*:/, '').replace(/_/g, ' ');

(async () => {
  const server = baseArg ? null : await startVite();
  const base = baseArg || server.url;
  const fx = fixturesDir();
  console.log(`base ${base} · fixtures ${fx ?? '(none: real network)'} · tmp ${tmp}`);
  const browser = await launch();
  const errors = [];
  const watch = (page) => {
    page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon|ERR_|404/.test(m.text())) errors.push(m.text());
    });
  };
  try {
    const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 900 } });
    await routeMojang(ctx, fx);
    await ctx.addInitScript(longTasks);
    const page = await ctx.newPage();
    watch(page);

    // ------------------------------------------------------------------ opening
    const ms = await openFromStart(page, base);
    const busy = await longest(page);
    check('the pack opens from the start screen', true, `${ms} ms`);
    check(`the page never freezes while it opens (longest task under ${MAX_TASK} ms)`, busy < MAX_TASK, `${busy} ms`);
    const proj = await page.evaluate(() => {
      const p = window.__tx.store.project;
      return { version: p.version, overrides: Object.keys(p.overrides), extra: Object.keys(p.extraFiles).length, icon: !!p.icon };
    });
    const fmts = await page.evaluate(async () => (await import('/src/editions/java/packformats.ts')).KNOWN_RELEASE_FORMATS);
    const major = (v) => (Array.isArray(v) ? v[0] : v);
    const lo = major(declared.min_format ?? declared.pack_format);
    const hi = major(declared.max_format ?? declared.pack_format);
    const f = fmts[proj.version];
    check('version: the newest release the declared format range accepts', !!f && f.major >= lo && f.major <= hi && !Object.entries(fmts).some(([, g]) => g.major >= lo && g.major <= hi && g.major > f.major), `${proj.version} for ${lo}–${hi}`);
    check('every texture of every namespace is editable', textures.every((t) => proj.overrides.includes(t)), `${proj.overrides.length} of ${textures.length}`);
    check('every other file is kept', proj.overrides.length + proj.extra + (proj.icon ? 1 : 0) === names.length, `${proj.extra} other files`);

    // ------------------------------------------------------------------ browsing textures
    const listed = await page.evaluate((own) => {
      const by = window.__tx.store.byPath;
      return own.filter((p) => by.get(p)?.custom).length;
    }, ownTextures);
    check('the texture list has the pack\'s own namespace', listed === ownTextures.length, `${listed} of ${ownTextures.length}`);
    if (animated) {
      await page.evaluate(() => window.__tx.setLibraryMode('textures'));
      const search = '.tx-browser:not(.tx-mb) .tx-search-input';
      await page.waitForSelector(search, { state: 'visible' });
      await page.fill(search, pretty(animated.replace(/\.png$/, '')));
      const tile = `.tx-tile[data-path="${animated}"]`;
      await page.waitForSelector(tile, { timeout: 30000 });
      check('an animated texture of the namespace is found by name, with the animated badge', !!(await page.$(`${tile} .tx-badge-anim`)));
      await page.click(tile);
      await page.waitForFunction((p) => window.__tx.canvas.current()?.key === p, animated, { timeout: 60000 });
      const anim = await page.evaluate(() => {
        const a = window.__tx.canvas.current()?.anim;
        return a && { count: a.count, frametime: a.frametime };
      });
      check('it opens in the 2D editor as an animation', !!anim && anim.count > 1, JSON.stringify(anim));
    }

    // ------------------------------------------------------------------ items and models
    await page.evaluate(() => window.__tx.setLibraryMode('items'));
    await page.waitForFunction(() => window.__tx.models.lib, null, { timeout: 180000 });
    await page.waitForFunction((n) => window.__tx.models.lib.items().filter((e) => e.id.includes(':')).length >= n, ownItems.length, { timeout: 60000 }).catch(() => null);
    const shapes = await page.evaluate((ids) => {
      const l = window.__tx.models.lib;
      const out = { listed: 0, drawn: 0, missing: 0, failed: [] };
      for (const id of ids) {
        const e = l.item(id);
        if (!e) continue;
        out.listed++;
        try {
          for (let i = 0; i < Math.max(1, l.properties(e)[0]?.values.length ?? 1); i++) {
            const v = l.resolve(e, i ? { model: String(i) } : undefined);
            if (i === 0 && (v.sprite.length || v.quads.length)) out.drawn++;
            out.missing += v.textures.filter((t) => t.missing && t.faces > 0).length;
          }
        } catch (err) {
          out.failed.push(`${id}: ${err.message}`);
        }
      }
      return out;
    }, ownItems.map(itemId));
    check('the Items list has every item definition of the namespace', shapes.listed === ownItems.length, `${shapes.listed} of ${ownItems.length}`);
    check('every look of every item resolves without an error', !shapes.failed.length, shapes.failed.slice(0, 3).join(' | '));
    check('nearly every item draws from its models and textures (parents across namespaces)', shapes.drawn >= ownItems.length * 0.95, `${shapes.drawn} of ${ownItems.length}`);
    check('no texture the models use is missing', shapes.missing === 0, `${shapes.missing}`);
    for (const n of [plainItem, stateful].filter(Boolean)) {
      const id = itemId(n);
      await page.fill('.tx-mb .tx-search-input', pretty(id));
      const tile = `.tx-mb .tx-tile[data-id="${id}"]`;
      await page.waitForSelector(tile, { timeout: 30000 });
      await page.click(tile);
      await page.waitForFunction((x) => window.__tx.preview.current()?.entry.id === x, id, { timeout: 30000 });
      await page.waitForFunction(() => !!window.__tx.canvas.current(), null, { timeout: 30000 });
      check(`an item ${n === stateful ? 'with select / condition / range looks' : 'model'} shows in the 3D preview and opens its texture`, true, id);
    }

    // ------------------------------------------------------------------ edit, save, reload
    const target = ownTextures.find((p) => !input[`${p}.mcmeta`]);
    await page.evaluate((p) => window.__tx.open(p), target);
    await page.waitForFunction((p) => window.__tx.canvas.current()?.key === p, target, { timeout: 60000 });
    await page.evaluate(() => {
      const pc = window.__tx.canvas.canvas();
      pc.setTool('pencil');
      pc.setColor([255, 0, 255, 255]);
    });
    const pt = await page.evaluate(() => {
      const pc = window.__tx.canvas.canvas();
      const r = pc.element.querySelector('canvas').getBoundingClientRect();
      const [sx, sy] = pc.getView().toScreen(0.5, 0.5);
      return [r.left + sx, r.top + sy];
    });
    await page.mouse.click(pt[0], pt[1]);
    await page.waitForSelector('.tx-save[data-state="saved"]', { timeout: 60000 });
    await page.reload();
    await page.waitForFunction(() => !!window.__tx && document.querySelector('.tx-main'), null, { timeout: 300000 });
    const kept = await page.evaluate(async (p) => {
      const f = await window.__tx.store.getFull(p);
      return [...f.data.slice(0, 4)];
    }, target);
    check('a painted texture of the namespace is still there after a reload', kept.join() === '255,0,255,255', kept.join());

    // ------------------------------------------------------------------ export
    await resetLong(page);
    const out = await exportZip(page, path.join(tmp, 'export.zip'));
    const outNames = Object.keys(out);
    const dropped = names.filter((n) => !out[n]);
    const changed = names.filter((n) => out[n] && n !== 'pack.mcmeta' && n !== target && Buffer.compare(Buffer.from(out[n]), Buffer.from(input[n])) !== 0);
    check('export: no file dropped or added', !dropped.length && outNames.length === names.length, `${dropped.slice(0, 3).join(', ')} · ${outNames.length} of ${names.length}`);
    check('export: every untouched file is byte for byte the same', !changed.length, changed.slice(0, 5).join(', '));
    check('export: the painted texture changed', Buffer.compare(Buffer.from(out[target]), Buffer.from(input[target])) !== 0);
    const meta = JSON.parse(dec.decode(out['pack.mcmeta'])).pack;
    check('export: pack.mcmeta declares the version the project targets', major(meta.min_format ?? meta.pack_format) <= f.major && major(meta.max_format ?? meta.pack_format) >= f.major && meta.description === declared.description, JSON.stringify(meta));
    check('export: the page never freezes for long', (await longest(page)) < 2000, `${await longest(page)} ms`);

    // ------------------------------------------------------------------ Pack Doctor, for the pack's own version
    await page.evaluate((v) => localStorage.setItem('doctor.javaVersion', v), proj.version);
    await page.goto(base + 'pack-doctor');
    await page.waitForSelector('.dr-dz');
    await page.setInputFiles('.dr-dz input[type=file]', PACK);
    await page.waitForSelector('.dr-result .dr-headline, .dr-result .cv-res-icon.is-error', { timeout: 300000 });
    await page.waitForFunction(() => !document.querySelector('.dr-result .cv-res-icon.is-busy'), null, { timeout: 300000 });
    const issues = await page.$$eval('.dr-issue', (els) => els.map((e) => `${e.dataset.code} ${[...e.classList].find((c) => c.startsWith('sev-'))}`));
    check('Pack Doctor: no false problems on the pack\'s own version (notes only)', issues.every((i) => i.endsWith('sev-info')), issues.join(', '));

    // ------------------------------------------------------------------ converter
    await page.goto(base + 'texture-pack-converter');
    await page.waitForSelector('.cv-dz');
    await page.setInputFiles('.cv-dz input[type=file]', PACK);
    await page.waitForSelector('.cv-pack:not([hidden]) .cv-pack-name', { timeout: 120000 });
    await page.click('.cv-ed[data-value="bedrock"]');
    await page.click('.cv-go');
    await page.waitForSelector('.cv-result .cv-dl-btn, .cv-result .cv-res-icon.is-error', { timeout: 600000 });
    const cvErr = await page.$('.cv-result .cv-res-icon.is-error');
    const cvText = (await page.textContent('.cv-result')).replace(/\s+/g, ' ');
    check('Java → Bedrock: converts what it can and says what it left out', !cvErr && /left out/.test(cvText), cvText.slice(0, 160));
    await ctx.close();

    // ------------------------------------------------------------------ phone width
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await routeMojang(phone, fx);
    const pp = await phone.newPage();
    watch(pp);
    await openFromStart(pp, base);
    const overflow = async () => pp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check('phone: the pack opens without sideways scrolling', (await overflow()) <= 0);
    await pp.locator('.tx-tabbar-btn[data-v="textures"]').tap();
    await pp.locator('.tx-libbar .segmented-item[data-value="items"]:visible').tap();
    if (stateful) {
      const id = itemId(stateful);
      await pp.locator('.tx-mb .tx-search-input:visible').fill(pretty(id));
      const tile = pp.locator(`.tx-mb .tx-tile[data-id="${id}"]:visible`).first();
      await tile.waitFor({ timeout: 120000 });
      await tile.tap();
      await pp.waitForFunction(() => !!window.__tx.canvas.current(), null, { timeout: 30000 });
      check('phone: an item of the namespace opens on the Paint tab', (await pp.evaluate(() => document.querySelector('.tx-editor')?.dataset.mobile)) === 'editor');
      check('phone: no sideways scrolling in the editor', (await overflow()) <= 0);
    }
    await phone.close();
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
