// End-to-end test of the Shader Maker's preview textures: the real game textures load by default
// (Java and Bedrock), importing a pack (file picker and drag and drop) changes the preview's pixels,
// a saved Texture Pack Maker project (with an effect) can be picked, the choice survives a reload,
// and the export never contains textures.
//
// Usage: NODE_PATH=$(npm root -g) node tests/e2e/shaders/preview-textures.e2e.cjs [baseUrl]
//   Without a baseUrl the app is built into a temp folder and served with `vite preview`.
//   Vanilla textures come from Mojang (Java 26.3 client jar, Bedrock samples), so it needs a network.
//   Screenshots go to $SHOTS_DIR (default: <tmp>/shaders-view-screens).
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const assert = require('assert/strict');
const { spawn } = require('child_process');
const ROOT = path.resolve(__dirname, '../../..');
const { zipSync, unzipSync, strToU8 } = require(path.join(ROOT, 'node_modules/fflate'));
const { launch, newContext, collectErrors, waitForCanvasPixels, shotPath } = require('../../harness/shaders-view/lib.cjs');

const argUrl = process.argv[2] && /^https?:/.test(process.argv[2]) ? process.argv[2] : null;

let server = null;
async function startServer() {
  const port = 5950 + Math.floor(Math.random() * 40);
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'shader-textures-e2e-'));
  server = spawn(path.join(ROOT, 'tests/harness/shaders-view/serve.sh'), [out, String(port)], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server did not start')), 180000);
    server.stdout.on('data', (d) => {
      if (/Local:/.test(String(d))) {
        clearTimeout(t);
        resolve(`http://127.0.0.1:${port}/`);
      }
    });
    server.stderr.on('data', (d) => process.stderr.write(d));
    server.on('exit', (code) => reject(new Error(`server exited ${code}`)));
  });
}

// ---------------------------------------------------------------------------------------------
// Tiny image + pack builders

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
/** RGBA PNG; `px(x, y)` returns [r, g, b, a]. */
function png(w, h, px) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) raw.set(px(x, y), y * (w * 4 + 1) + 1 + x * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return new Uint8Array(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
/** Uncompressed 32-bit top-down TGA. */
function tga(w, h, px) {
  const out = Buffer.alloc(18 + w * h * 4);
  out.set([0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, w & 255, w >> 8, h & 255, h >> 8, 32, 0x28]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = px(x, y);
      out.set([b, g, r, a], 18 + (y * w + x) * 4);
    }
  }
  return new Uint8Array(out);
}
/** A flat colour with a faint checker so it still reads as a texture. */
const flat = (rgb) => (x, y) => {
  const d = (x + y) % 2 ? 0 : 18;
  return [Math.max(0, rgb[0] - d), Math.max(0, rgb[1] - d), Math.max(0, rgb[2] - d), 255];
};
const MAGENTA = [255, 0, 255];
const YELLOW = [255, 235, 0];
const RED = [255, 0, 0];
const J = 'assets/minecraft/textures/block/';

/** Java pack: blocks in several resolutions (16x, 32x, 64x) and an empty grass overlay. */
function javaPack(rgb, name) {
  return zipSync({
    'pack.mcmeta': strToU8(JSON.stringify({ pack: { pack_format: 64, description: name } })),
    [`${J}sand.png`]: png(32, 32, flat(rgb)),
    [`${J}stone.png`]: png(64, 64, flat(rgb)),
    [`${J}dirt.png`]: png(16, 16, flat(rgb)),
    [`${J}cobblestone.png`]: png(32, 32, flat(rgb)),
    [`${J}gravel.png`]: png(16, 16, flat(rgb)),
    [`${J}grass_block_side.png`]: png(32, 32, flat(rgb)),
    [`${J}grass_block_side_overlay.png`]: png(32, 32, () => [0, 0, 0, 0]),
  });
}

/** Bedrock pack: magenta .tga beats a green .png of the same name (engine priority). */
function bedrockPack() {
  const manifest = {
    format_version: 2,
    header: { name: 'Bedrock Magenta', description: 'test', uuid: '6f1c2c55-2b43-4c0e-9d1a-0c6a1e2f3a41', version: [1, 0, 0], min_engine_version: [1, 21, 0] },
    modules: [{ type: 'resources', uuid: '8a2d9a0e-5c3b-4f6e-a1b2-3c4d5e6f7a82', version: [1, 0, 0] }],
  };
  return zipSync({
    'manifest.json': strToU8(JSON.stringify(manifest)),
    'textures/blocks/sand.tga': tga(32, 32, flat(MAGENTA)),
    'textures/blocks/sand.png': png(32, 32, flat([0, 200, 0])),
    'textures/blocks/dirt.png': png(16, 16, flat(MAGENTA)),
    'textures/blocks/stone.png': png(16, 16, flat(MAGENTA)),
    'textures/blocks/gravel.png': png(16, 16, flat(MAGENTA)),
    'textures/blocks/cobblestone.png': png(16, 16, flat(MAGENTA)),
  });
}

// ---------------------------------------------------------------------------------------------
// Page helpers

function step(msg) {
  console.log(`  ok - ${msg}`);
}

const PREFS = { autoRotate: false, animateDay: false, showHelp: true, timeOfDay: 6000, collapsed: {} };

async function openContext(browser) {
  const ctx = await newContext(browser, { width: 1440, height: 900, theme: 'dark' });
  await ctx.addInitScript((prefs) => {
    try {
      if (!localStorage.getItem('to-shaders-prefs')) localStorage.setItem('to-shaders-prefs', JSON.stringify(prefs));
    } catch {}
  }, PREFS);
  return ctx;
}

async function createProject(page, base, target, name) {
  await page.goto(base + '#/shaders', { waitUntil: 'domcontentloaded' });
  await page.click(`.sh-card[data-target="${target}"] .sh-card-start`);
  await page.waitForSelector('.sh-new .sh-preset');
  await page.fill('.sh-new .sh-name-field input, .sh-new input.input', name);
  await page.getByRole('button', { name: 'Create pack' }).click();
  await page.waitForSelector('.sh-editor');
  await waitForCanvasPixels(page);
}

/** Waits until the textures button shows `source` fully loaded; returns its dataset. */
async function waitTextures(page, source, timeout = 180000) {
  await page.waitForFunction(
    (s) => {
      const b = document.querySelector('.sh-tex-btn');
      return b && b.dataset.source === s && b.dataset.state === 'ready' && b.dataset.slots;
    },
    source,
    { timeout },
  );
  await page.waitForTimeout(900); // a couple of frames with the new textures
  return page.evaluate(() => ({ ...document.querySelector('.sh-tex-btn').dataset, label: document.querySelector('.sh-tex-label').textContent }));
}

/** Share of preview pixels that are clearly magenta / cyan / yellow, plus a coarse picture. */
async function sample(page) {
  return page.evaluate(async () => {
    const c = document.querySelector('.sh-stage-host canvas');
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const W = 160;
    const H = 100;
    const tmp = document.createElement('canvas');
    tmp.width = W;
    tmp.height = H;
    const ctx = tmp.getContext('2d');
    ctx.drawImage(c, 0, 0, W, H);
    const d = ctx.getImageData(0, 0, W, H).data;
    let magenta = 0;
    let cyan = 0;
    let yellow = 0;
    const grid = [];
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      if (r > 100 && b > 100 && g < 0.55 * Math.min(r, b)) magenta++;
      if (g > 100 && b > 100 && r < 0.55 * Math.min(g, b)) cyan++;
      if (r > 110 && g > 100 && b < 0.4 * Math.min(r, g)) yellow++;
      if ((i / 4) % 5 === 0) grid.push(r, g, b);
    }
    const n = W * H;
    return { magenta: magenta / n, cyan: cyan / n, yellow: yellow / n, grid };
  });
}

function diff(a, b) {
  let s = 0;
  for (let i = 0; i < a.grid.length; i++) s += Math.abs(a.grid[i] - b.grid[i]);
  return s / a.grid.length;
}

const pct = (x) => `${(x * 100).toFixed(1)}%`;

async function openMenu(page) {
  if ((await page.getAttribute('.sh-tex-btn', 'aria-expanded')) !== 'true') await page.click('.sh-tex-btn');
  await page.waitForSelector('.sh-tex-menu .sh-tex-item[data-key="vanilla"]');
}

async function pick(page, key) {
  await openMenu(page);
  await page.click(`.sh-tex-menu .sh-tex-item[data-key="${key}"]`);
  await page.waitForSelector('.sh-tex-menu', { state: 'detached' });
}

async function importFile(page, name, bytes, mimeType = 'application/zip') {
  await page.setInputFiles('.sh-tex-input', { name, mimeType, buffer: Buffer.from(bytes) });
}

async function dropFile(page, name, bytes) {
  await page.evaluate(
    async ({ name, bytes }) => {
      const file = new File([new Uint8Array(bytes)], name, { type: 'application/zip' });
      const dt = new DataTransfer();
      dt.items.add(file);
      const view = document.querySelector('.sh-stage-view');
      view.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt }));
      view.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
      window.__dropHintShown = !document.querySelector('.sh-drop').hidden;
      view.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    },
    { name, bytes: [...bytes] },
  );
  assert.equal(await page.evaluate(() => window.__dropHintShown), true, 'drop hint shows while dragging');
  assert.equal(await page.locator('.sh-drop').isHidden(), true, 'drop hint hides after the drop');
}

/** Stores a Texture Pack Maker project straight into IndexedDB (red textures + an invert effect = cyan). */
async function injectTextureProject(page, id, name) {
  const files = {};
  for (const b of ['sand', 'stone', 'dirt', 'cobblestone', 'gravel', 'grass_block_side']) files[`${J}${b}.png`] = [...png(16, 16, flat(RED))];
  files[`${J}grass_block_side_overlay.png`] = [...png(16, 16, () => [0, 0, 0, 0])];
  await page.evaluate(
    async ({ id, name, files }) => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open('to-projects');
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      const overrides = {};
      for (const [p, bytes] of Object.entries(files)) overrides[p] = new Blob([new Uint8Array(bytes)], { type: 'image/png' });
      const now = Date.now();
      const project = {
        id, kind: 'texturepack', name, createdAt: now, updatedAt: now, edition: 'java', version: '1.21.5', description: 'e2e',
        resolution: 16, overrides, extraFiles: {}, effects: [{ id: 'fx1', type: 'invert', enabled: true, params: { mode: 'rgb', amount: 100 }, categories: ['block'] }],
      };
      await new Promise((res, rej) => {
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(project, 'project:' + id);
        tx.oncomplete = res;
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    },
    { id, name, files },
  );
}

// ---------------------------------------------------------------------------------------------

async function javaFlow(browser, base) {
  console.log('# java');
  const ctx = await openContext(browser);
  const page = await ctx.newPage();
  const errors = collectErrors(page);
  await createProject(page, base, 'java-vanilla', 'E2E textures');

  // ---- vanilla by default
  let d = await waitTextures(page, 'vanilla');
  assert.equal(d.label, 'Minecraft 26.3');
  const [from, total] = d.slots.split('/').map(Number);
  assert.equal(from, total, `every block from the game files (${d.slots})`);
  const vanilla = await sample(page);
  await page.screenshot({ path: shotPath('textures-java-vanilla') });
  step(`Minecraft 26.3 textures load by default (${d.slots} blocks, no click needed)`);

  // ---- simple
  await pick(page, 'simple');
  d = await waitTextures(page, 'simple');
  assert.equal(d.label, 'Simple');
  assert.equal(d.slots.split('/')[0], '0');
  const simple = await sample(page);
  assert.ok(diff(vanilla, simple) > 3, `simple art looks different (${diff(vanilla, simple).toFixed(1)})`);
  step(`Simple textures (picture differs by ${diff(vanilla, simple).toFixed(1)})`);

  // ---- import a pack with the file picker
  await importFile(page, 'Magenta Test.zip', javaPack(MAGENTA, 'Magenta Test'));
  d = await waitTextures(page, 'imported');
  assert.equal(d.label, 'Imported: Magenta Test');
  assert.ok(Number(d.packSlots) >= 5, `pack textures shown (${d.packSlots})`);
  const magenta = await sample(page);
  assert.ok(magenta.magenta > vanilla.magenta + 0.03, `magenta pixels ${pct(vanilla.magenta)} -> ${pct(magenta.magenta)}`);
  await page.screenshot({ path: shotPath('textures-java-imported') });
  step(`imported pack changes the preview (magenta ${pct(vanilla.magenta)} -> ${pct(magenta.magenta)}, ${d.packSlots} blocks from the pack)`);

  // ---- persists across a reload (pack bytes kept in IndexedDB)
  await page.waitForFunction(() => document.querySelector('.sh-save')?.dataset.state === 'saved', null, { timeout: 15000 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.sh-editor');
  d = await waitTextures(page, 'imported', 60000);
  assert.equal(d.label, 'Imported: Magenta Test');
  const again = await sample(page);
  assert.ok(again.magenta > vanilla.magenta + 0.03, `still magenta after reload (${pct(again.magenta)})`);
  step('imported pack is remembered after a reload');

  // ---- a saved texture pack project (with an effect)
  const projectId = '0e2e0000-0000-4000-8000-00000000c0de';
  await injectTextureProject(page, projectId, 'E2E Cyan Pack');
  await openMenu(page);
  const item = page.locator(`.sh-tex-menu .sh-tex-item[data-key="project:${projectId}"]`);
  await item.waitFor();
  assert.match(await item.innerText(), /E2E Cyan Pack/);
  assert.match(await item.innerText(), /1 effect/);
  assert.equal(await page.locator('.sh-tex-menu .sh-tex-item[data-key="imported"]').getAttribute('aria-checked'), 'true');
  await page.screenshot({ path: shotPath('textures-java-menu') });
  await item.click();
  d = await waitTextures(page, 'project');
  assert.equal(d.label, 'My pack: E2E Cyan Pack');
  const cyan = await sample(page);
  assert.ok(cyan.cyan > vanilla.cyan + 0.03, `cyan pixels (red + invert effect) ${pct(vanilla.cyan)} -> ${pct(cyan.cyan)}`);
  assert.ok(cyan.magenta < magenta.magenta / 3, 'the imported pack is no longer shown');
  await page.screenshot({ path: shotPath('textures-java-project') });
  step(`saved texture project with its effects (cyan ${pct(vanilla.cyan)} -> ${pct(cyan.cyan)})`);

  await page.waitForFunction(() => document.querySelector('.sh-save')?.dataset.state === 'saved', null, { timeout: 15000 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.sh-editor');
  d = await waitTextures(page, 'project', 60000);
  assert.equal(d.label, 'My pack: E2E Cyan Pack');
  assert.ok((await sample(page)).cyan > vanilla.cyan + 0.03, 'project textures after reload');
  step('texture project choice is remembered after a reload');

  // ---- drag and drop a pack onto the preview
  await dropFile(page, 'Yellow Drop.zip', javaPack(YELLOW, 'Yellow Drop'));
  d = await waitTextures(page, 'imported');
  assert.equal(d.label, 'Imported: Yellow Drop');
  const yellow = await sample(page);
  assert.ok(yellow.yellow > vanilla.yellow + 0.03, `yellow pixels ${pct(vanilla.yellow)} -> ${pct(yellow.yellow)}`);
  step(`drag and drop import (yellow ${pct(vanilla.yellow)} -> ${pct(yellow.yellow)})`);

  // ---- back to Minecraft
  await pick(page, 'vanilla');
  d = await waitTextures(page, 'vanilla');
  const back = await sample(page);
  assert.ok(diff(back, vanilla) < diff(yellow, vanilla), 'Minecraft textures again');
  assert.ok(back.yellow < yellow.yellow / 2);
  step('switching back to the Minecraft textures');

  // ---- not a pack
  await importFile(page, 'notes.zip', strToU8('not a zip at all'));
  await page.locator('.toast.tone-error').first().waitFor({ timeout: 15000 });
  assert.equal(await page.getAttribute('.sh-tex-btn', 'data-source'), 'vanilla', 'a bad file keeps the current choice');
  step('a file that is not a pack shows an error and changes nothing');

  const bad = errors.filter((e) => !/favicon|net::ERR|Failed to load resource/.test(e));
  assert.deepEqual(bad, [], 'no page errors');

  // ---- Iris uses 26.3, and the export never contains textures
  await createProject(page, base, 'iris', 'E2E iris textures');
  d = await waitTextures(page, 'vanilla', 60000);
  assert.equal(d.label, 'Minecraft 26.3');
  await importFile(page, 'Magenta Test.zip', javaPack(MAGENTA, 'Magenta Test'));
  await waitTextures(page, 'imported');
  const dl = page.waitForEvent('download', { timeout: 120000 });
  await page.click('.sh-bar-export');
  const download = await dl;
  const file = path.join(os.tmpdir(), 'shader-textures-e2e-iris.zip');
  await download.saveAs(file);
  const names = Object.keys(unzipSync(new Uint8Array(fs.readFileSync(file))));
  assert.ok(names.some((n) => n.startsWith('shaders/')), 'iris pack exported');
  assert.ok(!names.some((n) => /textures\/|\.mcmeta$|magenta/i.test(n) && !n.startsWith('shaders/')), `no textures in the export: ${names.filter((n) => /textures/.test(n)).join(', ')}`);
  await page.keyboard.press('Escape');
  step(`Iris preview uses 26.3; export has only the shader pack (${names.length} entries)`);
  await ctx.close();
}

async function bedrockFlow(browser, base) {
  console.log('# bedrock');
  const ctx = await openContext(browser);
  const page = await ctx.newPage();
  const errors = collectErrors(page);
  await createProject(page, base, 'bedrock-vibrant', 'E2E bedrock textures');

  let d = await waitTextures(page, 'vanilla');
  assert.equal(d.label, 'Minecraft Bedrock');
  const [from, total] = d.slots.split('/').map(Number);
  assert.ok(from >= total - 1, `Bedrock blocks from the game files (${d.slots})`);
  const vanilla = await sample(page);
  await page.screenshot({ path: shotPath('textures-bedrock-vanilla') });
  step(`latest Bedrock textures load by default (${d.slots})`);

  await importFile(page, 'Bedrock Magenta.mcpack', bedrockPack(), 'application/octet-stream');
  d = await waitTextures(page, 'imported');
  assert.equal(d.label, 'Imported: Bedrock Magenta');
  const bed = await sample(page);
  assert.ok(bed.magenta > vanilla.magenta + 0.03, `magenta ${pct(vanilla.magenta)} -> ${pct(bed.magenta)}`);
  await page.screenshot({ path: shotPath('textures-bedrock-imported') });
  step(`Bedrock .mcpack (.tga wins over .png) changes the preview (magenta ${pct(bed.magenta)})`);

  // a Java pack in a Bedrock project: warned, still shown where the names match
  await importFile(page, 'Java Yellow.zip', javaPack(YELLOW, 'Java Yellow'));
  d = await waitTextures(page, 'imported');
  const warn = page.locator('.toast.tone-warn', { hasText: 'Java pack' });
  await warn.first().waitFor({ timeout: 10000 });
  const y = await sample(page);
  assert.ok(y.yellow > vanilla.yellow + 0.03, `Java pack textures mapped onto Bedrock (yellow ${pct(y.yellow)})`);
  step('a Java pack in a Bedrock project is shown with a warning');

  const bad = errors.filter((e) => !/favicon|net::ERR|Failed to load resource/.test(e));
  assert.deepEqual(bad, [], 'no page errors');
  await ctx.close();
}

(async () => {
  const base = (argUrl || (await startServer())).replace(/\/?$/, '/');
  const browser = await launch();
  let failed = 0;
  try {
    for (const [name, flow] of [['java', javaFlow], ['bedrock', bedrockFlow]]) {
      try {
        await flow(browser, base);
      } catch (err) {
        failed++;
        for (const p of browser.contexts().flatMap((c) => c.pages())) {
          await p.screenshot({ path: path.join(os.tmpdir(), `shader-textures-e2e-fail-${name}.png`) }).catch(() => {});
        }
        console.log(`  not ok - ${name}: ${err && err.stack ? err.stack : err}`);
      }
    }
  } finally {
    await browser.close();
    if (server) server.kill();
  }
  console.log(failed ? `FAILED (${failed})` : 'ALL PASS');
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  if (server) server.kill();
  process.exit(1);
});
