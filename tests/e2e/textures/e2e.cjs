// End-to-end test of the texture pack maker in Chromium.
// Usage: NODE_PATH=$(npm root -g) node tests/e2e/textures/e2e.cjs [baseUrl] [--no-bedrock] [--shots <dir>]
// Java assets come from the real 26.3 client jar (routed locally when found, else the real network);
// Bedrock assets come from GitHub (network needed).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startVite, launch, routeMojang, fixturesDir, unzip, decodePng, jarEntry } = require('./lib.cjs');

const argv = process.argv.slice(2);
const baseArg = argv.find((a) => /^https?:/.test(a));
const doBedrock = !argv.includes('--no-bedrock');
const shotsDir = argv.includes('--shots') ? argv[argv.indexOf('--shots') + 1] : null;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tx-e2e-'));

let failures = 0;
const results = [];
function check(name, ok, detail = '') {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  console.log(results[results.length - 1]);
  if (!ok) failures++;
}

const JAVA_STONE = 'assets/minecraft/textures/block/stone.png';

async function waitEditor(page) {
  await page.waitForFunction(() => !!window.__tx && document.querySelector('.tx-main'), null, { timeout: 120000 });
}

async function openBySearch(page, query, pathSuffix) {
  await page.fill('.tx-search-input', query);
  const sel = `.tx-tile[data-path$="${pathSuffix}"]`;
  await page.waitForSelector(sel, { timeout: 30000 });
  await page.click(sel);
  await page.waitForFunction((suffix) => window.__tx?.canvas.current()?.key.endsWith(suffix), pathSuffix, { timeout: 60000 });
}

/** Paints image pixels with the pencil in the given colour through real pointer events. */
async function paint(page, color, pixels) {
  await page.evaluate((c) => {
    const pc = window.__tx.canvas.canvas();
    pc.setTool('pencil');
    pc.setColor(c);
  }, color);
  for (const [x, y] of pixels) {
    const pt = await page.evaluate(([px, py]) => {
      const pc = window.__tx.canvas.canvas();
      const r = pc.element.querySelector('canvas').getBoundingClientRect();
      const [sx, sy] = pc.getView().toScreen(px + 0.5, py + 0.5);
      return [r.left + sx, r.top + sy];
    }, [x, y]);
    await page.mouse.click(pt[0], pt[1]);
  }
}

async function waitSaved(page) {
  await page.waitForSelector('.tx-save[data-state="saved"]', { timeout: 30000 });
}

async function exportPack(page, expectExt) {
  await page.click('.tx-export-btn');
  await page.waitForSelector('.tx-export-modal .tx-exp-rows');
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 180000 }),
    page.click(`.tx-export-modal .btn-primary:has-text("Export ${expectExt}")`),
  ]);
  const file = path.join(tmp, download.suggestedFilename());
  await download.saveAs(file);
  await page.waitForSelector('.tx-exp-done', { timeout: 30000 });
  return { file, name: download.suggestedFilename() };
}

/** Straight RGBA pixels of a PNG (palette incl. sub-byte depths, grey, 16-bit). */
async function rgbaOf(bytes) {
  const png = await decodePng(bytes);
  const { width, height, depth, channels: c } = png;
  const d = png.data;
  const out = new Uint8Array(width * height * 4);
  const to8 = (v) => (depth === 8 ? v : depth === 16 ? Math.round((v * 255) / 65535) : Math.round((v * 255) / ((1 << depth) - 1)));
  const rowBytes = Math.ceil((width * depth * (png.palette || depth < 8 ? 1 : c)) / 8);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      if (png.palette || depth < 8) {
        const bit = x * depth;
        const v = depth === 8 ? d[y * rowBytes + x] : (d[y * rowBytes + (bit >> 3)] >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
        if (png.palette) {
          const e = png.palette[v] || [0, 0, 0, 0];
          out.set([e[0], e[1], e[2], e.length > 3 ? e[3] : 255], o);
        } else out.set([to8(v), to8(v), to8(v), 255], o);
      } else {
        const i = (y * width + x) * c;
        if (c >= 3) out.set([to8(d[i]), to8(d[i + 1]), to8(d[i + 2]), c === 4 ? to8(d[i + 3]) : 255], o);
        else out.set([to8(d[i]), to8(d[i]), to8(d[i]), c === 2 ? to8(d[i + 1]) : 255], o);
      }
    }
  }
  return { width, height, data: out };
}

async function pixelOf(bytes, x, y) {
  const img = await rgbaOf(bytes);
  const i = (y * img.width + x) * 4;
  return Array.from(img.data.slice(i, i + 4));
}

async function meanLuma(bytes) {
  const img = await rgbaOf(bytes);
  let s = 0;
  for (let i = 0; i < img.data.length; i += 4) s += 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
  return s / (img.data.length / 4);
}

(async () => {
  const server = baseArg ? null : await startVite();
  const base = baseArg || server.url;
  const fx = fixturesDir();
  console.log(`base ${base} · fixtures ${fx ?? '(none: real network)'} · tmp ${tmp}`);
  const browser = await launch();
  const errors = [];
  try {
    // ------------------------------------------------------------------ Java 26.3
    const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 900 } });
    await routeMojang(ctx, fx);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon|ERR_|404/.test(m.text())) errors.push(m.text());
    });

    await page.goto(base + '#/textures');
    await page.waitForSelector('.tx-new');
    check('start screen shows the new pack form and open dropzone', await page.isVisible('.tx-open-dz'));
    const pickerText = await page.textContent('.tx-new .vp-trigger');
    check('Java 26.3 is the default version', /Java 26\.3/.test(pickerText ?? ''), pickerText?.trim());
    await page.fill('.tx-name-field input', 'E2E Java');
    await page.click('.tx-create-btn');
    await page.waitForURL(/#\/textures\/[0-9a-f-]+$/, { timeout: 15000 });
    const t0 = Date.now();
    await waitEditor(page);
    await page.waitForSelector('.tx-tile.loaded', { timeout: 120000 });
    check('Java assets loaded and thumbnails decoded', true, `${((Date.now() - t0) / 1000).toFixed(1)} s`);
    const count = await page.evaluate(() => window.__tx.store.entries.length);
    check('texture list has the whole 26.3 set', count > 3500, `${count} textures`);

    await openBySearch(page, 'stone', 'block/stone.png');
    const title = await page.textContent('.tx-head-title');
    check('search "stone" opens Stone in the editor', title?.trim() === 'Stone', title?.trim());

    const RED = [255, 0, 0, 255];
    await paint(page, RED, [[3, 4], [4, 4], [5, 4], [10, 12]]);
    const px = await page.evaluate(() => window.__tx.pixel(3, 4));
    check('pencil paints pixels', JSON.stringify(px) === JSON.stringify(RED), JSON.stringify(px));
    await waitSaved(page);
    check('autosave reports Saved', true);

    await page.reload();
    await waitEditor(page);
    await page.waitForFunction(() => window.__tx?.canvas.current()?.key.endsWith('block/stone.png'), null, { timeout: 60000 });
    const after = await page.evaluate(() => window.__tx.pixel(3, 4));
    check('edit survives a page reload (IndexedDB)', JSON.stringify(after) === JSON.stringify(RED), JSON.stringify(after));
    const editedLabel = await page.textContent('.tx-edited-chip .tx-chip-count');
    check('browser shows 1 edited texture', editedLabel?.trim() === '1', editedLabel?.trim());

    // effects preset
    await page.click('.tx-col-tabs .tab[data-value="effects"]');
    await page.waitForSelector('.tx-preset[data-preset="dark-mode"]');
    await page.click('.tx-preset[data-preset="dark-mode"]');
    await page.waitForSelector('.tx-preset-wrap.is-active .tx-preset[data-preset="dark-mode"]');
    const layers = await page.evaluate(() => window.__tx.store.project.effects.length);
    check('one-click preset fills the effect stack', layers > 0, `${layers} layers`);
    await waitSaved(page);
    if (shotsDir) await page.screenshot({ path: path.join(shotsDir, 'textures-e2e-java-effects.png') });

    // export
    const javaZip = await exportPack(page, '.zip');
    check('Java export downloads a .zip', javaZip.name.endsWith('.zip'), javaZip.name);
    const zip = unzip(javaZip.file);
    const mcmeta = JSON.parse(Buffer.from(zip['pack.mcmeta']).toString('utf8'));
    check(
      'pack.mcmeta targets 26.3 (min_format [97,1], max_format 97)',
      JSON.stringify(mcmeta.pack.min_format) === '[97,1]' && mcmeta.pack.max_format === 97 && !('pack_format' in mcmeta.pack),
      JSON.stringify(mcmeta.pack),
    );
    check('pack.png is included', !!zip['pack.png']);
    check('edited stone texture is in the pack', !!zip[JAVA_STONE]);
    if (zip[JAVA_STONE]) {
      const p = await pixelOf(zip[JAVA_STONE], 3, 4);
      check('edited pixel is still red (with Dark Mode applied)', p[0] > p[1] + 80 && p[0] > p[2] + 80 && p[3] === 255, JSON.stringify(p));
    }
    const dirtPath = 'assets/minecraft/textures/block/dirt.png';
    check('effect-processed vanilla textures are included', !!zip[dirtPath] && Object.keys(zip).filter((k) => k.endsWith('.png')).length > 1000, `${Object.keys(zip).length} files`);
    if (zip[dirtPath] && fx) {
      const vanilla = jarEntry(fx, dirtPath);
      const [a, b] = [await meanLuma(zip[dirtPath]), await meanLuma(vanilla)];
      check('Dark Mode made dirt darker than vanilla', a < b - 5, `${a.toFixed(1)} < ${b.toFixed(1)}`);
    }
    const animMeta = Object.keys(zip).filter((k) => k.endsWith('.png.mcmeta')).length;
    check('animation .mcmeta files travel with processed textures', animMeta > 50, `${animMeta} .mcmeta`);
    if (shotsDir) await page.screenshot({ path: path.join(shotsDir, 'textures-e2e-java-exported.png') });
    await page.click('.tx-export-modal .btn-primary:has-text("Done")');

    // import the exported zip back
    await page.goto(base + '#/textures');
    await page.waitForSelector('.tx-open-dz');
    await page.setInputFiles('.tx-open-dz input[type=file]', javaZip.file);
    await page.waitForURL(/#\/textures\/[0-9a-f-]+$/, { timeout: 60000 });
    const warnModal = await page.$('dialog[open] .btn-primary:has-text("Open in editor")');
    if (warnModal) await warnModal.click();
    await waitEditor(page);
    const imported = await page.evaluate((p) => ({ edited: window.__tx.store.isEdited(p), name: window.__tx.store.project.name, version: window.__tx.store.project.version }), JAVA_STONE);
    check('import: pack reopened as Java 26.3', imported.version === '26.3', JSON.stringify(imported));
    check('import: stone is an edited texture', imported.edited);
    await page.evaluate((p) => window.__tx.open(p), JAVA_STONE);
    const ip = await page.evaluate(() => window.__tx.pixel(3, 4));
    check('import: painted pixel survived the round trip', ip && ip[0] > ip[1] + 80, JSON.stringify(ip));
    await ctx.close();

    // ------------------------------------------------------------------ Bedrock (latest)
    if (doBedrock) {
      const bctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 900 } });
      const bp = await bctx.newPage();
      bp.on('pageerror', (e) => errors.push(`pageerror ${e.message}`));
      await bp.goto(base + '#/textures');
      await bp.waitForSelector('.tx-new');
      await bp.click('.tx-new .segmented-item[data-value="bedrock"]');
      await bp.waitForFunction(() => /Bedrock/.test(document.querySelector('.tx-new .vp-trigger')?.textContent ?? ''));
      await bp.fill('.tx-name-field input', 'E2E Bedrock');
      await bp.click('.tx-create-btn');
      await waitEditor(bp);
      await bp.waitForSelector('.tx-tile.loaded', { timeout: 120000 });
      const bcount = await bp.evaluate(() => window.__tx.store.entries.length);
      check('Bedrock latest assets loaded', bcount > 1000, `${bcount} textures`);
      await openBySearch(bp, 'stone', 'blocks/stone.png');
      await paint(bp, [0, 0, 255, 255], [[2, 2], [3, 2]]);
      await waitSaved(bp);
      const mc = await exportPack(bp, '.mcpack');
      check('Bedrock export downloads a .mcpack', mc.name.endsWith('.mcpack'), mc.name);
      const bz = unzip(mc.file);
      const manifest = JSON.parse(Buffer.from(bz['manifest.json']).toString('utf8'));
      check(
        'manifest.json: format 2, resources module, uuids and version',
        manifest.format_version === 2 && manifest.modules?.[0]?.type === 'resources' && /^[0-9a-f-]{36}$/.test(manifest.header?.uuid) && Array.isArray(manifest.header?.version),
        JSON.stringify({ v: manifest.header?.version, min: manifest.header?.min_engine_version }),
      );
      check('manifest has no pbr capability', !(manifest.capabilities ?? []).includes('pbr'));
      check('pack_icon.png is included', !!bz['pack_icon.png']);
      const bs = bz['textures/blocks/stone.png'];
      check('edited Bedrock stone texture is in the pack', !!bs);
      if (bs) {
        const p = await pixelOf(bs, 2, 2);
        check('Bedrock edited pixel is blue', p[2] > 200 && p[0] < 40, JSON.stringify(p));
      }
      await bctx.close();
    }
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
