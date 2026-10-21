// Renders the screenshots used by the SEO guide pages (public/screenshots/guides/*.jpg, 1280x800
// viewport, dark theme; the model editor and PvP shots in the light theme) by driving the real app: texture
// pack maker, model editor, PvP tab, skin editor and shader maker.
//
// Game files are served offline from local fixtures through route interception:
//   TO_FIXTURES  folder with client-26.3.jar, manifest.json and v263.json (required)
//   SKINS_JAR    26.3 client jar for the skin editor (default: $TO_FIXTURES/client-26.3.jar)
// Other requests (Bedrock samples, model data mirrors) go to the network, through $HTTPS_PROXY if set.
//
// Usage:
//   TO_FIXTURES=/path/to/fixtures NODE_PATH=$(npm root -g) node tests/harness/seo/guide-screenshots.cjs [baseUrl] [--only a,b]
//   Without a baseUrl a Vite dev server is started on a free port. With one, point it at a served
//   build (npm run build && node tests/e2e/seo/pages-server.mjs dist 5781 &) or a running dev server.
//   --only takes shot names without .jpg (e.g. --only texture-editor,shader-iris).
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const outDir = path.join(ROOT, 'public/screenshots/guides');
const argv = process.argv.slice(2);
const baseArg = argv.find((a) => /^https?:/.test(a));
const only = argv.includes('--only') ? new Set(argv[argv.indexOf('--only') + 1].split(',')) : null;
const want = (name) => !only || only.has(name);
const exe = [process.env.CHROME, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find((p) => p && fs.existsSync(p));
const QUALITY = 80;
const MAX_BYTES = 158 * 1024;
const VIEW = { width: 1280, height: 800 };

function fixtures() {
  const fx = process.env.TO_FIXTURES;
  const need = ['client-26.3.jar', 'manifest.json', 'v263.json'];
  if (!fx || need.some((f) => !fs.existsSync(path.join(fx, f)))) {
    console.error(`Set TO_FIXTURES to a folder containing ${need.join(', ')} (the Minecraft 26.3 game files).`);
    process.exit(2);
  }
  const jar = process.env.SKINS_JAR || path.join(fx, 'client-26.3.jar');
  if (!fs.existsSync(jar)) {
    console.error(`SKINS_JAR (${jar}) does not exist.`);
    process.exit(2);
  }
  return { fx, jar };
}

/** Serves Mojang's version manifest, the 26.3 version JSON and the client jar (with Range) locally. */
async function routeMojang(context, fx, jarPath) {
  const manifest = fs.readFileSync(path.join(fx, 'manifest.json'));
  const v263 = fs.readFileSync(path.join(fx, 'v263.json'));
  const jarSize = fs.statSync(jarPath).size;
  const jarFd = fs.openSync(jarPath, 'r');
  const cors = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range, content-length, accept-ranges' };
  await context.route(/^https:\/\/(piston-meta|launchermeta)\.mojang\.com\/mc\/game\/version_manifest_v2\.json/, (r) => r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: manifest }));
  await context.route(/^https:\/\/piston-meta\.mojang\.com\/v1\/packages\/[0-9a-f]+\/26\.3\.json$/, (r) => r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: v263 }));
  await context.route(/^https:\/\/piston-data\.mojang\.com\/v1\/objects\/[0-9a-f]+\/client\.jar$/, (r) => {
    const range = r.request().headers()['range'];
    const m = range && /bytes=(\d+)-(\d+)?/.exec(range);
    if (!m) return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/java-archive', 'content-length': String(jarSize) }, body: fs.readFileSync(jarPath) });
    const start = Number(m[1]);
    const end = Math.min(jarSize - 1, m[2] ? Number(m[2]) : jarSize - 1);
    const buf = Buffer.alloc(end - start + 1);
    fs.readSync(jarFd, buf, 0, buf.length, start);
    return r.fulfill({
      status: 206,
      headers: { ...cors, 'content-type': 'application/java-archive', 'content-range': `bytes ${start}-${end}/${jarSize}`, 'content-length': String(buf.length), 'accept-ranges': 'bytes' },
      body: buf,
    });
  });
  // Skin lookups never leave the machine.
  await context.route(/playerdb\.co|textures\.minecraft\.net|mc-heads\.net/, (r) => r.abort());
}

async function startDevServer() {
  const { createServer } = await import(path.join(ROOT, 'node_modules/vite/dist/node/index.js'));
  const server = await createServer({ root: ROOT, configFile: path.join(ROOT, 'vite.config.ts'), logLevel: 'error', server: { port: 0, host: '127.0.0.1', hmr: false, watch: null } });
  await server.listen();
  return { url: server.resolvedUrls.local[0], stop: () => server.close() };
}

// ------------------------------------------------------------------------------------- helpers
const written = [];
async function shot(page, name, clip, { keepMouse = false } = {}) {
  const file = path.join(outDir, `${name}.jpg`);
  if (!keepMouse) await page.mouse.move(VIEW.width - 2, VIEW.height - 2).catch(() => {});
  await page.waitForTimeout(300);
  // JPEG quality ~80, lowered a little when a busy shot would go over the size budget
  for (let q = QUALITY; q >= 66; q -= 4) {
    await page.screenshot({ path: file, type: 'jpeg', quality: q, ...(clip ? { clip } : {}) });
    if (fs.statSync(file).size <= MAX_BYTES) break;
  }
  report(name, file, clip);
}

/** A clip at a 16:10 ratio (min 960 wide) around a box, kept inside the viewport. */
function clip1610(box, width = 1088) {
  width = Math.max(960, Math.min(VIEW.width, width));
  const height = Math.min(VIEW.height, Math.round((width * 10) / 16));
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const x = Math.max(0, Math.min(VIEW.width - width, Math.round(cx - width / 2)));
  const y = Math.max(0, Math.min(VIEW.height - height, Math.round(cy - height / 2)));
  return { x, y, width, height };
}

/** A 16:10 clip with some margin around a dialog. */
function clipAround(box) {
  return clip1610(box, Math.round(Math.max(960, (box.height + 56) * 1.6, box.width + 240)));
}

async function hideToasts(page) {
  await page.addStyleTag({ content: '.toast-region{display:none!important}' });
}

/** Hides toasts ("Saved", tips) on every page load of this tab. */
async function hideToastsOnLoad(page) {
  await page.addInitScript(() => {
    addEventListener('DOMContentLoaded', () => {
      const st = document.createElement('style');
      st.textContent = '.toast-region{display:none!important}';
      document.head.appendChild(st);
    });
  });
}

function report(name, file, clip) {
  const kb = (fs.statSync(file).size / 1024).toFixed(0);
  written.push(`${name}.jpg ${clip ? `${clip.width}x${clip.height}` : `${VIEW.width}x${VIEW.height}`} ${kb} KB`);
  console.log('wrote', file, `${kb} KB`);
}

async function waitIdle(page, ms = 800) {
  await page.waitForFunction(() => !document.querySelector('.spinner:not([hidden])') || ![...document.querySelectorAll('.spinner')].some((s) => s.offsetParent), null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

// ------------------------------------------------------------------------------------- textures
async function txWaitEditor(page) {
  await page.waitForFunction(() => !!window.__tx && document.querySelector('.tx-main'), null, { timeout: 120000 });
  await page.waitForSelector('.tx-tile.loaded', { timeout: 120000 });
}

/** Paints pencil strokes through real pointer events; each stroke is a list of image pixels. */
async function txStrokes(page, color, strokes) {
  await page.evaluate((c) => {
    const pc = window.__tx.canvas.canvas();
    pc.setTool('pencil');
    pc.setColor(c);
  }, color);
  for (const stroke of strokes) {
    const pts = await page.evaluate((list) => {
      const pc = window.__tx.canvas.canvas();
      const r = pc.element.querySelector('canvas').getBoundingClientRect();
      return list.map(([px, py]) => {
        const [sx, sy] = pc.getView().toScreen(px + 0.5, py + 0.5);
        return [r.left + sx, r.top + sy];
      });
    }, stroke);
    await page.mouse.move(pts[0][0], pts[0][1]);
    await page.mouse.down();
    for (const p of pts.slice(1)) await page.mouse.move(p[0], p[1], { steps: 4 });
    await page.mouse.up();
  }
}

async function texturesFlow(browser, base, fx, jar) {
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1, colorScheme: 'dark', reducedMotion: 'reduce', acceptDownloads: true });
  await ctx.addInitScript(() => localStorage.setItem('to-theme', 'dark'));
  await routeMojang(ctx, fx, jar);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  pageerror', e.message));

  // 1. new texture pack form
  await page.goto(`${base}textures/`);
  await page.waitForSelector('.tx-new');
  await page.fill('.tx-name-field input', 'My First Pack');
  await page.click('.tx-new .segmented-item[data-value="java"]');
  await page.waitForFunction(() => /26\.3/.test(document.querySelector('.tx-new .vp-trigger')?.textContent ?? ''));
  await page.click('.tx-res-chip:has-text("32×")');
  await page.fill('.tx-new textarea', 'Brighter blocks with a warm autumn look');
  await page.evaluate(() => document.activeElement?.blur());
  await waitIdle(page);
  if (want('new-texture-pack')) {
    // The form is taller than 800px: a taller window just for this shot, cropped to 3:2 below the
    // sticky header (same 1280px layout).
    await page.setViewportSize({ width: VIEW.width, height: 1000 });
    const top = await page.evaluate(() => {
      const r = document.querySelector('.tx-new').getBoundingClientRect();
      window.scrollTo(0, r.top + window.scrollY - 100);
      return document.querySelector('.tx-new').getBoundingClientRect().top;
    });
    await page.waitForTimeout(300);
    await shot(page, 'new-texture-pack', { x: 0, y: Math.round(top - 22), width: VIEW.width, height: Math.round((VIEW.width * 2) / 3) });
    await page.setViewportSize(VIEW);
  }
  await page.click('.tx-res-chip:has-text("16×")');
  await page.click('.tx-create-btn');
  await page.waitForURL(/textures\/[0-9a-f-]+\/?$/, { timeout: 15000 });
  await txWaitEditor(page);
  await hideToasts(page);

  // 2. editor: a block in Blocks mode, its 3D model and a few painted strokes
  await page.click('.tx-browser:not(.tx-mb) .tx-libbar .segmented-item[data-value="blocks"]').catch(() => {});
  await page.waitForSelector('.tx-mb .tx-search-input', { state: 'visible' });
  await page.waitForFunction(() => window.__tx.models.lib, null, { timeout: 120000 });
  await page.fill('.tx-mb .tx-search-input', 'furnace');
  await page.waitForSelector('.tx-mb .tx-tile[data-id="furnace"].loaded', { timeout: 30000 });
  await page.click('.tx-mb .tx-tile[data-id="furnace"]');
  await page.waitForFunction(() => window.__tx.preview.current()?.entry.id === 'furnace', null, { timeout: 30000 });
  await page.waitForFunction(() => window.__tx.canvas.current()?.key.endsWith('block/furnace_front.png'), null, { timeout: 30000 });
  // an orange glow line and a few gold rivets on the front
  await txStrokes(page, [255, 140, 20, 255], [
    [[4, 3], [5, 3], [6, 3], [7, 3], [8, 3], [9, 3], [10, 3], [11, 3]],
    [[3, 4], [3, 5], [3, 6]],
    [[12, 4], [12, 5], [12, 6]],
  ]);
  await txStrokes(page, [255, 215, 60, 255], [[[1, 1]], [[14, 1]], [[1, 14]], [[14, 14]]]);
  await page.waitForSelector('.tx-save[data-state="saved"]', { timeout: 30000 });
  await waitIdle(page, 1200);
  if (want('texture-editor')) await shot(page, 'texture-editor');

  // 3. effects: the Autumn preset on the whole pack; the thumbnails show it (the canvas shows
  // your own pixels, so no texture is left open for this shot)
  const projectId = page.url().match(/textures\/([0-9a-f-]+)/)[1];
  await page.evaluate((id) => localStorage.removeItem(`to-tex-last:${id}`), projectId);
  await page.reload();
  await txWaitEditor(page);
  await hideToasts(page);
  // Blocks mode: its icons are rendered from the models with the effects applied.
  if (!(await page.isVisible('.tx-mb'))) await page.click('.tx-browser:not(.tx-mb) .tx-libbar .segmented-item[data-value="blocks"]');
  await page.waitForSelector('.tx-mb .tx-search-input', { state: 'visible' });
  await page.click('.tx-mb [aria-label="Show as a grid"]').catch(() => {});
  await page.click('.tx-col-tabs .tab[data-value="effects"]');
  await page.waitForSelector('.tx-preset[data-preset="autumn"]');
  await page.click('.tx-preset[data-preset="autumn"]');
  await page.waitForSelector('.tx-preset-wrap.is-active .tx-preset[data-preset="autumn"]');
  await page.fill('.tx-mb .tx-search-input', 'moss');
  await page.waitForTimeout(800);
  await page.evaluate(() => document.activeElement?.blur());
  await page.waitForFunction(() => [...document.querySelectorAll('.tx-mb .tx-tile')].every((t) => t.classList.contains('loaded')), null, { timeout: 60000 }).catch(() => {});
  // the applied preset with its before/after strip
  await page.evaluate(() => document.querySelector('.tx-preset-wrap.is-active')?.scrollIntoView({ block: 'end' }));
  await page.waitForSelector('.tx-save[data-state="saved"]', { timeout: 30000 });
  await waitIdle(page, 2500);
  if (want('texture-effects')) await shot(page, 'texture-effects');

  // 4. pack settings (icon, version range) and the export dialog
  await page.click('.tx-col-tabs .tab[data-value="pack"]');
  await page.waitForSelector('.tx-pack');
  const compat = page.locator('.tx-pack .toggle', { hasText: 'Also works in other versions' }).locator('.switch');
  if ((await compat.getAttribute('aria-checked')) !== 'true') await compat.click();
  await page.waitForSelector('.tx-mcmeta', { timeout: 30000 });
  await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.tx-pack > *')];
    const versionCard = cards.find((c) => /Game version/.test(c.querySelector('h3, .card-title')?.textContent ?? ''));
    versionCard?.scrollIntoView({ block: 'start' });
  });
  await waitIdle(page, 1000);
  if (want('pack-settings')) await shot(page, 'pack-settings');
  await page.click('.tx-export-btn');
  await page.waitForSelector('.tx-export-modal .tx-exp-rows');
  await waitIdle(page, 800);
  if (want('texture-export')) {
    const box = await page.locator('dialog[open]').first().boundingBox();
    await shot(page, 'texture-export', clipAround(box));
  }
  await page.keyboard.press('Escape');

  // 5. open an existing pack (a tiny zip built here)
  if (want('open-existing-pack')) {
    const zipFile = path.join(os.tmpdir(), 'Ocean Glass.zip');
    fs.writeFileSync(zipFile, await tinyJavaPack(page));
    await page.goto(`${base}textures/`);
    await page.waitForSelector('.tx-open-dz');
    await page.setInputFiles('.tx-open-dz input[type=file]', zipFile);
    await page.waitForURL(/textures\/[0-9a-f-]+\/?$/, { timeout: 60000 });
    const warn = await page.waitForSelector('dialog[open]', { timeout: 3000 }).catch(() => null);
    if (warn) {
      await waitIdle(page, 600);
    }
    await txWaitEditor(page);
    if (await page.isVisible('.tx-mb')) await page.click('.tx-mb .tx-libbar .segmented-item[data-value="textures"]');
    await page.click('.tx-browser:not(.tx-mb) .tx-edited-chip');
    await page.waitForSelector('.tx-browser:not(.tx-mb) .tx-tile[data-path$="block/stone.png"]');
    await page.click('.tx-browser:not(.tx-mb) .tx-tile[data-path$="block/stone.png"]');
    await page.waitForFunction(() => window.__tx.canvas.current()?.key.endsWith('block/stone.png'), null, { timeout: 30000 });
    await waitIdle(page, 1500);
    await shot(page, 'open-existing-pack');
  }
  await ctx.close();
}

/** A small Java pack (pack.mcmeta, icon, two recoloured textures) made in the page with fflate. */
async function tinyJavaPack(page) {
  const { zipSync, strToU8 } = require(path.join(ROOT, 'node_modules/fflate'));
  const png = async (fill) =>
    Buffer.from(
      await page.evaluate(async (f) => {
        const c = document.createElement('canvas');
        c.width = c.height = 16;
        const g = c.getContext('2d');
        for (let y = 0; y < 16; y++)
          for (let x = 0; x < 16; x++) {
            const [h, s, l] = f;
            g.fillStyle = `hsl(${h + ((x * 7 + y * 13) % 20)} ${s}% ${l + ((x * 3 + y * 5) % 4) * 4}%)`;
            g.fillRect(x, y, 1, 1);
          }
        const b = await new Promise((r) => c.toBlob(r, 'image/png'));
        return Array.from(new Uint8Array(await b.arrayBuffer()));
      }, fill),
    );
  return Buffer.from(
    zipSync({
      'pack.mcmeta': strToU8(JSON.stringify({ pack: { description: 'Sea-glass stone and planks', min_format: [97, 1], max_format: 97 } }, null, 2)),
      'pack.png': new Uint8Array(await png([190, 60, 45])),
      'assets/minecraft/textures/block/stone.png': new Uint8Array(await png([185, 35, 50])),
      'assets/minecraft/textures/block/oak_planks.png': new Uint8Array(await png([170, 45, 40])),
      'assets/minecraft/textures/block/cobblestone.png': new Uint8Array(await png([200, 30, 38])),
    }),
  );
}


// ------------------------------------------------------------------------------------- skins
async function newCtx(browser, fx, jar) {
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1, colorScheme: 'dark', reducedMotion: 'reduce', acceptDownloads: true });
  await ctx.addInitScript(() => localStorage.setItem('to-theme', 'dark'));
  await routeMojang(ctx, fx, jar);
  return ctx;
}

const skApi = (page, fn, arg) =>
  page.evaluate(([f, a]) => new Function('e', 'a', `return (${f})(e, a)`)(document.querySelector('.sk-editor').__skinEditor, a), [fn.toString(), arg]);

async function skOpenStarter(page, base, starter, model) {
  await page.goto(`${base}skins/`);
  await page.waitForSelector(`.sk-starter-${starter}`);
  if (model) await page.click(`.sk-model-pick .segmented-item[data-value="${model}"]`);
  await page.click(`.sk-starter-${starter}`);
  await page.waitForSelector('.sk-editor .pc-root', { timeout: 20000 });
  await page.waitForFunction(() => !!document.querySelector('.sk-editor')?.__skinEditor);
  await page.waitForSelector('.sk-3d .preview-stage canvas', { state: 'attached', timeout: 20000 });
  await page.waitForTimeout(600);
}

async function skRename(page, name) {
  await page.fill('.sk-name', name);
  await page.keyboard.press('Enter');
  await skApi(page, (e) => e.flush());
}

async function skColor(page, hex) {
  await page.fill('.sk-block-color .cp-hex', hex);
  await page.keyboard.press('Enter');
}

/** Drags the pencil along skin pixels on the 2D template. */
async function skStroke(page, pts) {
  const cl = [];
  for (const [x, y] of pts) cl.push(await skApi(page, (e, [x, y]) => e.imageToClient(x, y), [x, y]));
  await page.mouse.move(cl[0][0], cl[0][1]);
  await page.mouse.down();
  for (const c of cl.slice(1)) await page.mouse.move(c[0], c[1], { steps: 3 });
  await page.mouse.up();
}

async function skinsFlow(browser, base, fx, jar) {
  const ctx = await newCtx(browser, fx, jar);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  pageerror', e.message));
  await hideToastsOnLoad(page);

  // 6. 2D template painting with the 3D preview
  await skOpenStarter(page, base, 'explorer');
  await skRename(page, 'Explorer');
  await page.locator('.pc-root').focus();
  await page.keyboard.press('b');
  if ((await page.getAttribute('.sk-toggle-btn', 'aria-pressed')) !== 'true') await page.click('.sk-toggle-btn');
  await skColor(page, '#2f7fd8');
  // a blue stripe across the chest and down the right arm (mirrored onto the left arm)
  await skStroke(page, [[20, 24], [21, 24], [22, 24], [23, 24], [24, 24], [25, 24], [26, 24], [27, 24]]);
  await skStroke(page, [[44, 20], [44, 21], [44, 22], [44, 23], [44, 24], [44, 25], [44, 26], [44, 27]]);
  await skColor(page, '#f2c14e');
  await skStroke(page, [[20, 26], [21, 27], [22, 28], [23, 29], [24, 29], [25, 28], [26, 27], [27, 26]]);
  await skApi(page, (e) => e.flush());
  const [hx, hy] = await skApi(page, (e) => e.imageToClient(10, 12));
  await page.mouse.move(hx, hy);
  await page.waitForTimeout(800);
  if (want('skin-editor-2d')) await shot(page, 'skin-editor-2d', null, { keepMouse: true });

  // 7. 3D paint mode with a part hidden
  await page.click('.sk-workspace [data-value="3d"]');
  await page.waitForTimeout(700);
  await page.click('.sk-fig-part[data-part="leftArm"]');
  await page.waitForTimeout(500);
  await page.click('.sk-view-btn[data-view="front"]').catch(() => {});
  await page.waitForTimeout(700);
  // a few dabs on the model's chest
  await skColor(page, '#d8452f');
  for (const [x, y] of [[21, 22], [22, 22], [25, 22], [26, 22]]) {
    const pt = await skApi(page, (e, [x, y]) => e.pixelTo3d(x, y), [x, y]);
    if (!pt) continue;
    await page.mouse.click(pt[0], pt[1]);
    await page.waitForTimeout(100);
  }
  await skApi(page, (e) => e.flush());
  // turn the model a little (right-drag turns the camera in paint mode)
  const stage = await page.locator('.sk-center .sk-3d-wrap').boundingBox();
  await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height * 0.8);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(stage.x + stage.width / 2 - 32, stage.y + stage.height * 0.8 - 10, { steps: 8 });
  await page.mouse.up({ button: 'right' });
  await waitIdle(page, 800);
  if (want('skin-editor-3d')) await shot(page, 'skin-editor-3d');

  // the skin pack export (bundling several saved skins), if this version of the app has it
  if (want('skin-pack-export')) {
    await page.click('.sk-workspace [data-value="2d"]');
    await page.click('.sk-bar [aria-label="All skins"]');
    await skOpenStarter(page, base, 'robot', 'slim');
    await skRename(page, 'Robot');
    await page.click('.sk-bar [aria-label="All skins"]');
    await skOpenStarter(page, base, 'wizard', 'classic');
    await skRename(page, 'Wizard');
    await page.click('.sk-export-btn');
    await page.click('.sk-export-item[data-kind="bedrock-pack"]');
    const hasList = await page.waitForSelector('.sk-pack-list .sk-pack-skin:not(.is-current)', { timeout: 8000 }).then(() => true).catch(() => false);
    if (!hasList) console.log('SKIP  skin-pack-export: the Bedrock skin pack dialog has no skin list in this build');
    else {
      for (const row of await page.$$('.sk-pack-skin:not(.is-current)')) {
        if (!(await row.$eval('input', (i) => i.checked))) await row.click();
      }
      await page.fill('.sk-pack .input', 'Adventure Crew');
      await page.evaluate(() => document.activeElement?.blur());
      await waitIdle(page, 800);
      const box = await page.locator('dialog[open]').first().boundingBox();
      await shot(page, 'skin-pack-export', clipAround(box));
    }
    await page.keyboard.press('Escape');
  }
  await ctx.close();
}

// ------------------------------------------------------------------------------------- shaders
async function waitPreview(page, timeout = 90000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const ok = await page.evaluate(async () => {
      const c = document.querySelector('.sh-stage-host canvas');
      if (!c || !c.width) return false;
      await new Promise((r) => requestAnimationFrame(() => r()));
      const t = document.createElement('canvas');
      t.width = 64;
      t.height = 40;
      const g = t.getContext('2d');
      g.drawImage(c, 0, 0, 64, 40);
      const d = g.getImageData(0, 0, 64, 40).data;
      let min = 255, max = 0;
      const seen = new Set();
      for (let i = 0; i < d.length; i += 4) {
        const l = Math.round((d[i] + d[i + 1] + d[i + 2]) / 3);
        min = Math.min(min, l);
        max = Math.max(max, l);
        seen.add(l >> 3);
      }
      return max - min > 40 && seen.size > 8;
    });
    if (ok) return;
    await page.waitForTimeout(500);
  }
  throw new Error('shader preview stayed blank');
}

async function shaderShot(browser, base, fx, jar, target, preset, name, file, { time, scroll } = {}) {
  const ctx = await newCtx(browser, fx, jar);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  pageerror', e.message));
  await hideToastsOnLoad(page);
  await page.goto(`${base}shaders/`);
  await page.waitForSelector(`.sh-card[data-target="${target}"] .sh-card-start`);
  await page.click(`.sh-card[data-target="${target}"] .sh-card-start`);
  await page.waitForSelector('.sh-new .sh-preset');
  await page.click(`.sh-new .sh-preset[data-preset="${preset}"]`);
  await page.fill('.sh-new .sh-name-field input, .sh-new input.input', name);
  await page.getByRole('button', { name: 'Create pack' }).click();
  await page.waitForSelector('.sh-editor');
  await waitPreview(page);
  if (time) await page.click(`.sh-time-btn[data-time="${time}"]`);
  if (scroll) {
    // bring the fine-tune sliders into view in the Look panel
    await page.evaluate((how) => {
      const head = [...document.querySelectorAll('.sh-block-head')].find((e) => /Fine-tune/.test(e.textContent));
      if (!head) return;
      let sc = head.parentElement;
      while (sc && sc.scrollHeight <= sc.clientHeight + 4) sc = sc.parentElement;
      if (!sc) return;
      const off = head.getBoundingClientRect().top - sc.getBoundingClientRect().top;
      sc.scrollTop += how === 'top' ? off - 8 : off - sc.clientHeight * 0.45;
    }, scroll);
  }
  // let the textures and the scene settle
  await page.waitForTimeout(4000);
  await waitPreview(page);
  await waitIdle(page, 1000);
  await shot(page, file);
  await ctx.close();
}

// ------------------------------------------------------------------------------------- models
const MODEL_SHOTS = ['model-edit-shape', 'model-sprite-start', 'model-3d-sword', 'model-display', 'model-flat-inventory', 'model-block-shape'];

/** Types a number into one of the model editor's fields (data-key 'size.1', 'pos.0'...). */
async function meField(page, key, value) {
  const sel = `.me-side-body [data-key="${key}"]`;
  await page.fill(sel, String(value));
  await page.press(sel, 'Enter');
  await page.waitForTimeout(150);
}

/** The model editor (light theme): the diamond sword made 3D from its sprite, its hand pose and flat-in-the-inventory option, and stone reshaped into a step. */
async function modelsFlow(browser, base, fx, jar) {
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'reduce' });
  await ctx.addInitScript(() => localStorage.setItem('to-theme', 'light'));
  await routeMojang(ctx, fx, jar);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  pageerror', e.message));
  await hideToastsOnLoad(page);
  await page.goto(`${base}textures/`);
  await page.waitForSelector('.tx-new');
  await page.fill('.tx-name-field input', '3D Items');
  await page.click('.tx-new .segmented-item[data-value="java"]');
  await page.waitForFunction(() => /26\.3/.test(document.querySelector('.tx-new .vp-trigger')?.textContent ?? ''));
  await page.click('.tx-create-btn');
  await page.waitForURL(/textures\/[0-9a-f-]+\/?$/, { timeout: 15000 });
  await txWaitEditor(page);
  await page.waitForFunction(() => window.__tx.models.lib?.usageReady, null, { timeout: 180000 });

  // 1. the diamond sword in the Items list, with "Edit shape" in the preview
  await page.locator('.tx-libbar .segmented-item[data-value="items"]:visible').first().click();
  await page.waitForSelector('.tx-mb .tx-search-input', { state: 'visible' });
  await page.fill('.tx-mb .tx-search-input', 'diamond sword');
  await page.waitForSelector('.tx-mb .tx-tile[data-id="diamond_sword"].loaded', { timeout: 30000 });
  await page.click('.tx-mb .tx-tile[data-id="diamond_sword"]');
  await page.waitForFunction(() => window.__tx.preview.current()?.entry.id === 'diamond_sword', null, { timeout: 30000 });
  await page.waitForSelector('.tx-pv-shapebtn:not([hidden])', { timeout: 30000 });
  await page.evaluate(() => document.activeElement?.blur());
  await waitIdle(page, 1500);
  if (want('model-edit-shape')) {
    await page.hover('.tx-pv-shapebtn');
    await shot(page, 'model-edit-shape', null, { keepMouse: true });
  }

  // 2. the model editor opens on the flat sword: start points
  await page.click('.tx-pv-shapebtn');
  await page.waitForSelector('.me-start:not([hidden]) .me-preset[data-preset="sprite3d"]', { timeout: 60000 });
  await waitIdle(page, 1500);
  if (want('model-sprite-start')) await shot(page, 'model-sprite-start');

  // 3. 3D item from sprite: the cubes, one picked
  await page.click('.me-start .me-preset[data-preset="sprite3d"]');
  await page.waitForFunction(() => window.__tx.modelEditor().test.doc().elements.length > 5, null, { timeout: 10000 });
  const n = await page.evaluate(() => window.__tx.modelEditor().test.doc().elements.length);
  console.log(`  3D sword: ${n} cubes`);
  await page.evaluate(() => window.__tx.modelEditor().test.select(4));
  await page.click('.me-side-tabs .tab[data-value="cube"]');
  await waitIdle(page, 1200);
  if (want('model-3d-sword')) await shot(page, 'model-3d-sword');

  // 4. Display: how it is held in third person
  await page.click('.me-side-tabs .tab[data-value="display"]');
  await page.waitForSelector('.me-slots:not([hidden]) .me-slot');
  await page.click('.me-slots .me-slot[data-slot="thirdperson_righthand"]');
  await waitIdle(page, 1200);
  if (want('model-display')) await shot(page, 'model-display');

  // 5. Model tab: flat in the inventory
  await page.click('.me-side-tabs .tab[data-value="model"]');
  await page.click('.me-side-body .toggle:has-text("Flat in the inventory") .switch');
  await page.waitForFunction(() => window.__tx.modelEditor().test.plan().target === 'minecraft:item/diamond_sword_3d');
  await page.click('.me-slots .me-slot[data-slot="gui"]').catch(() => {});
  await page.evaluate(() => {
    const t = [...document.querySelectorAll('.me-side-body .toggle')].find((e) => /Flat in the inventory/.test(e.textContent));
    t?.scrollIntoView({ block: 'center' });
  });
  await waitIdle(page, 1200);
  if (want('model-flat-inventory')) await shot(page, 'model-flat-inventory');
  await page.click('.me-back');
  await page.waitForSelector('.tx-main', { state: 'visible' });

  // 6. a block: stone made into a step from the Slab start point and one more cube
  await page.evaluate(() => window.__tx.editModel('block', 'stone'));
  await page.waitForSelector('.me-root .me-cuberow', { timeout: 60000 });
  await page.click('.me-side-tabs .tab[data-value="model"]');
  await page.click('.me-side-body .me-preset[data-preset="slab"]');
  await page.waitForFunction(() => window.__tx.modelEditor().test.doc().elements[0]?.to[1] === 8);
  await page.click('.me-cubes-head .icon-btn');
  await page.waitForFunction(() => window.__tx.modelEditor().test.doc().elements.length === 2);
  await page.click('.me-side-tabs .tab[data-value="cube"]');
  for (const [k, v] of [['size.0', 16], ['size.1', 8], ['size.2', 8], ['pos.0', 0], ['pos.1', 8], ['pos.2', 8]]) await meField(page, k, v);
  await page.evaluate(() => document.activeElement?.blur());
  await waitIdle(page, 1200);
  if (want('model-block-shape')) await shot(page, 'model-block-shape');
  await ctx.close();
}

// ------------------------------------------------------------------------------------- PvP packs
const PVP_SHOTS = ['pvp-start', 'pvp-tweaks', 'pvp-crosshair', 'pvp-bedrock'];

/** Java 1.8.9's version JSON and client jar from $TO_FIXTURES/research-cache, when there (else the network). */
async function route189(context, fx) {
  const vj = path.join(fx, 'research-cache', 'version-json', '1.8.9.json');
  const jarPath = path.join(fx, 'research-cache', 'jars', '1.8.9.jar');
  if (!fs.existsSync(vj) || !fs.existsSync(jarPath)) return;
  const sha1 = JSON.parse(fs.readFileSync(vj, 'utf8')).downloads.client.sha1;
  const size = fs.statSync(jarPath).size;
  const fd = fs.openSync(jarPath, 'r');
  const cors = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range, content-length, accept-ranges' };
  await context.route(/^https:\/\/piston-meta\.mojang\.com\/v1\/packages\/[0-9a-f]+\/1\.8\.9\.json$/, (r) => r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: fs.readFileSync(vj) }));
  await context.route(new RegExp(`^https://(launcher|piston-data)\\.mojang\\.com/v1/objects/${sha1}/client\\.jar$`), (r) => {
    const m = /bytes=(\d+)-(\d+)?/.exec(r.request().headers()['range'] || '');
    if (!m) return r.fulfill({ status: 200, headers: { ...cors, 'content-length': String(size) }, body: fs.readFileSync(jarPath) });
    const start = Number(m[1]);
    const end = Math.min(size - 1, m[2] ? Number(m[2]) : size - 1);
    const buf = Buffer.alloc(end - start + 1);
    fs.readSync(fd, buf, 0, buf.length, start);
    return r.fulfill({ status: 206, headers: { ...cors, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': String(buf.length), 'accept-ranges': 'bytes' }, body: buf });
  });
}

/** Scrolls the PvP tab so a tweak's card sits near the top. */
async function pvpScrollTo(page, id) {
  await page.evaluate((i) => {
    const card = document.querySelector(`.pvp-tweak[data-tweak="${i}"]`);
    const body = card?.closest('.tx-side-body');
    if (card && body) body.scrollTop += card.getBoundingClientRect().top - body.getBoundingClientRect().top - 12;
  }, id);
  await page.waitForTimeout(300);
}

/** PvP packs (light theme): the start option, the PvP tab on Java 1.8.9 with the fire open, "Draw your own" crosshair, and Bedrock. */
async function pvpFlow(browser, base, fx, jar) {
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'reduce' });
  await ctx.addInitScript(() => localStorage.setItem('to-theme', 'light'));
  await routeMojang(ctx, fx, jar);
  await route189(ctx, fx);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  pageerror', e.message));
  await hideToastsOnLoad(page);

  // 1. start screen: PvP / FPS pack for Java 1.8.9
  await page.goto(`${base}textures/?start=pvp`);
  await page.waitForSelector('.tx-new .tx-start-opt[data-start="pvp"][aria-checked="true"]');
  await page.fill('.tx-name-field input', 'Bedwars PvP');
  await page.click('.tx-new .vp-trigger');
  await page.fill('.vp-pop input[type=search]', '1.8.9');
  await page.click('.vp-item:has(.vp-item-name:text-is("1.8.9"))');
  await page.waitForFunction(() => /1\.8\.9/.test(document.querySelector('.tx-new .vp-trigger')?.textContent ?? ''));
  await page.click('.tx-start-fps .switch');
  await page.evaluate(() => document.activeElement?.blur());
  await waitIdle(page);
  if (want('pvp-start')) {
    // a taller window, cropped to 1280×800 below the sticky header (same 1280px layout)
    await page.setViewportSize({ width: VIEW.width, height: 1100 });
    const top = await page.evaluate(() => {
      const r = document.querySelector('.tx-new').getBoundingClientRect();
      window.scrollTo(0, r.top + window.scrollY - 100);
      return document.querySelector('.tx-new').getBoundingClientRect().top;
    });
    await page.waitForTimeout(300);
    await shot(page, 'pvp-start', { x: 0, y: Math.round(top - 22), width: VIEW.width, height: VIEW.height });
    await page.setViewportSize(VIEW);
  }

  // 2. the editor: the preset is on, the overlay fire texture open
  await page.click('.tx-create-btn');
  await page.waitForURL(/textures\/[0-9a-f-]+\/?$/, { timeout: 15000 });
  await txWaitEditor(page);
  await page.waitForFunction(() => document.querySelector('.pvp-tweak.is-on') && !window.__tx.store.project.pvp?.pending, null, { timeout: 120000 });
  await page.evaluate(() => window.__tx.open('assets/minecraft/textures/blocks/fire_layer_1.png'));
  await page.waitForFunction(() => window.__tx.canvas.current()?.key.endsWith('fire_layer_1.png'), null, { timeout: 30000 });
  await pvpScrollTo(page, 'lowFire');
  await waitIdle(page, 1500);
  if (want('pvp-tweaks')) await shot(page, 'pvp-tweaks');

  // 3. "Draw your own" crosshair: icons.png with the crosshair square selected
  await page.click('.pvp-tweak[data-tweak="crosshair"] .pvp-draw button');
  await page.waitForFunction(() => !!window.__tx.canvas.canvas()?.getSelection(), null, { timeout: 30000 });
  // zoom in on the top-left corner of the sheet, where the crosshair is
  const corner = await page.evaluate(() => {
    const pc = window.__tx.canvas.canvas();
    const r = pc.element.querySelector('canvas').getBoundingClientRect();
    const [x, y] = pc.getView().toScreen(8, 8);
    return [r.left + x, r.top + y];
  });
  await page.mouse.move(corner[0], corner[1]);
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, -240);
    await page.waitForTimeout(120);
  }
  // your own design: a grey diamond around the centre pixel (grey and white show best in game)
  await txStrokes(page, [170, 170, 170, 255], [
    [[7, 3], [8, 4], [9, 5], [10, 6], [11, 7], [10, 8], [9, 9], [8, 10], [7, 11], [6, 10], [5, 9], [4, 8], [3, 7], [4, 6], [5, 5], [6, 4], [7, 3]],
  ]);
  await pvpScrollTo(page, 'crosshair');
  await waitIdle(page, 1200);
  if (want('pvp-crosshair')) await shot(page, 'pvp-crosshair');

  // 4. Bedrock: the tweaks a Bedrock pack can't have are off, with the reason
  if (want('pvp-bedrock')) {
    await page.goto(`${base}textures/?start=pvp`);
    await page.waitForSelector('.tx-new .tx-start-opt[data-start="pvp"][aria-checked="true"]');
    await page.fill('.tx-name-field input', 'Bedrock PvP');
    await page.click('.tx-new .segmented-item[data-value="bedrock"]');
    await page.waitForFunction(() => /Bedrock/.test(document.querySelector('.tx-new .vp-trigger')?.textContent ?? ''));
    await page.click('.tx-create-btn');
    await page.waitForURL(/textures\/[0-9a-f-]+\/?$/, { timeout: 15000 });
    await txWaitEditor(page);
    await page.waitForFunction(() => document.querySelector('.pvp-tweak.is-on') && !window.__tx.store.project.pvp?.pending, null, { timeout: 180000 });
    await page.evaluate(() => window.__tx.open('textures/blocks/glass_red.png'));
    await page.waitForFunction(() => window.__tx.canvas.current()?.key.endsWith('glass_red.png'), null, { timeout: 30000 });
    await pvpScrollTo(page, 'lowFire');
    await waitIdle(page, 1500);
    await shot(page, 'pvp-bedrock');
  }
  await ctx.close();
}

// The helpers are shared with tests/harness/seo/store-screenshots.cjs.
module.exports = { fixtures, routeMojang, startDevServer, waitIdle, hideToastsOnLoad, txWaitEditor, txStrokes, skOpenStarter, skApi, skRename, skColor, skStroke, waitPreview };

// ------------------------------------------------------------------------------------- main
if (require.main === module) (async () => {
  const { fx, jar } = fixtures();
  fs.mkdirSync(outDir, { recursive: true });
  const server = baseArg ? null : await startDevServer();
  const base = (baseArg || server.url).replace(/\/?$/, '/');
  const args = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
  if (process.env.HTTPS_PROXY) args.push(`--proxy-server=${process.env.HTTPS_PROXY}`, '--proxy-bypass-list=127.0.0.1;localhost');
  const browser = await chromium.launch({ executablePath: exe, args });
  try {
    if (['new-texture-pack', 'texture-editor', 'texture-effects', 'pack-settings', 'texture-export', 'open-existing-pack'].some(want)) await texturesFlow(browser, base, fx, jar);
    if (['skin-editor-2d', 'skin-editor-3d', 'skin-pack-export'].some(want)) await skinsFlow(browser, base, fx, jar);
    if (want('shader-vanilla')) await shaderShot(browser, base, fx, jar, 'java-vanilla', 'vivid', 'Vivid Vanilla', 'shader-vanilla', { scroll: 'top' });
    if (want('shader-iris')) await shaderShot(browser, base, fx, jar, 'iris', 'cinematic', 'Cinematic Glow', 'shader-iris', { time: 'sunset', scroll: 'half' });
    if (want('bedrock-vibrant-visuals')) await shaderShot(browser, base, fx, jar, 'bedrock-vibrant', 'vivid', 'Bright Vibrant', 'bedrock-vibrant-visuals', { scroll: 'half' });
    if (MODEL_SHOTS.some(want)) await modelsFlow(browser, base, fx, jar);
    if (PVP_SHOTS.some(want)) await pvpFlow(browser, base, fx, jar);
  } finally {
    await browser.close();
    await server?.stop();
  }
  console.log('\n' + written.join('\n'));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
