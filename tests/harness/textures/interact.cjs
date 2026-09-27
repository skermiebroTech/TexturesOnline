// Interaction screenshots for the texture pack maker (dialogs, menus, special textures).
// Usage: NODE_PATH=$(npm root -g) node tests/harness/textures/interact.cjs <baseUrl|-> <outDir> [theme=dark] [scenes=all] [width=1440] [height=900]
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startVite, launch, routeMojang, fixturesDir, ROOT } = require('../../e2e/textures/lib.cjs');

const argBase = process.argv[2] || '-';
const out = process.argv[3] || '.';
const theme = process.argv[4] || 'dark';
const want = process.argv[5] && process.argv[5] !== 'all' ? new Set(process.argv[5].split(',')) : null;
const W = Number(process.argv[6] || 1440);
const H = Number(process.argv[7] || 900);
fs.mkdirSync(out, { recursive: true });
const on = (s) => !want || want.has(s);

async function makePng() {
  const { encode } = await import(path.join(ROOT, 'node_modules/fast-png/lib/index.js'));
  const w = 96;
  const h = 96;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const d = Math.hypot(x - 48, y - 48);
      data.set(d < 40 ? [255 - x * 2, 80 + y, 200, 255] : [30, 20 + x, 60, 255], i);
    }
  const file = path.join(os.tmpdir(), 'tx-upload-sample.png');
  fs.writeFileSync(file, encode({ width: w, height: h, data, channels: 4, depth: 8 }));
  return file;
}

(async () => {
  const server = argBase === '-' ? await startVite() : null;
  const base = server ? server.url : argBase;
  const fx = fixturesDir();
  const browser = await launch();
  const errors = [];
  const tag = `${W}-${theme}`;
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: theme, deviceScaleFactor: W < 761 ? 2 : 1, acceptDownloads: true });
  await routeMojang(ctx, fx);
  await ctx.addInitScript((t) => localStorage.setItem('to-theme', t), theme);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const shot = async (name, opts = {}) => {
    await page.waitForTimeout(opts.wait ?? 400);
    await page.screenshot({ path: path.join(out, `textures-${name}-${tag}.png`) });
    console.log('saved', `textures-${name}-${tag}.png`);
  };
  const tablet = W <= 1180 && W > 760;
  const phone = W <= 760;
  const showTextures = async () => {
    if (phone) await page.click('.tx-tabbar-btn[data-v="textures"]');
    else if (tablet) await page.click('.tx-col-tabs .tab[data-value="textures"]');
  };
  const showEditor = async () => {
    if (phone) await page.click('.tx-tabbar-btn[data-v="editor"]');
  };
  const side = async (v) => {
    if (phone) await page.click(`.tx-tabbar-btn[data-v="${v}"]`);
    else await page.click(`.tx-col-tabs .tab[data-value="${v}"]`);
  };
  const open = async (q, suffix) => {
    await showTextures();
    await page.fill('.tx-search-input', q);
    await page.waitForSelector(`.tx-tile[data-path$="${suffix}"]`);
    await page.click(`.tx-tile[data-path$="${suffix}"]`);
    await page.waitForFunction((s) => window.__tx?.canvas.current()?.key.endsWith(s), suffix);
    await showEditor();
  };

  try {
    if (on('404')) {
      await page.goto(base + '#/textures/does-not-exist');
      await page.waitForSelector('.tx-missing');
      await shot('404');
    }
    if (on('loading')) {
      // hold the jar back to capture the one-time download panel
      const lctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: theme, deviceScaleFactor: W < 761 ? 2 : 1 });
      await lctx.addInitScript((t) => localStorage.setItem('to-theme', t), theme);
      await routeMojang(lctx, fx);
      await lctx.route(/client\.jar$/, () => {});
      const lp = await lctx.newPage();
      await lp.goto(base + '#/textures');
      await lp.waitForSelector('.tx-new');
      await lp.click('.tx-create-btn');
      await lp.waitForSelector('.asset-panel');
      await lp.waitForTimeout(1500);
      await lp.screenshot({ path: path.join(out, `textures-loading-${tag}.png`) });
      console.log('saved', `textures-loading-${tag}.png`);
      await lctx.close();
    }

    await page.goto(base + '#/textures');
    await page.waitForSelector('.tx-new');
    await page.fill('.tx-name-field input', '§6Golden §bSky');
    await page.click('.tx-res-chip:has-text("32")');
    await page.click('.tx-create-btn');
    await page.waitForFunction(() => !!window.__tx);
    await showTextures();
    await page.waitForSelector('.tx-tile.loaded', { timeout: 90000 });

    if (on('hd')) {
      await open('oak planks', 'block/oak_planks.png');
      await shot('hd-upscaled');
    }
    if (on('list')) {
      await showTextures();
      await page.fill('.tx-search-input', 'sword');
      await page.click('.tx-seg .icon-btn[aria-label^="Show as a list"]');
      await page.waitForTimeout(600);
      await shot('list-mode');
      await page.click('.tx-seg .icon-btn[aria-label^="Show as a grid"]');
    }
    if (on('context')) {
      await showTextures();
      await page.fill('.tx-search-input', 'apple');
      await page.waitForSelector('.tx-tile.loaded');
      const t = await page.$('.tx-tile');
      const b = await t.boundingBox();
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2, { button: 'right' });
      await page.waitForSelector('.menu');
      await shot('context-menu');
      await page.keyboard.press('Escape');
    }
    if (on('animated')) {
      await open('prismarine', 'block/prismarine.png');
      await page.waitForSelector('.tx-frames:not([hidden])');
      await page.click('.tx-frame >> nth=3');
      await page.click('.tx-frames-play');
      await shot('animated', { wait: 900 });
      await page.click('.tx-frames-play');
    }
    if (on('compare')) {
      await open('stone', 'block/stone.png');
      await page.evaluate(() => {
        const pc = window.__tx.canvas.canvas();
        pc.setColor([240, 60, 200, 255]);
        pc.setBrushSize(4);
      });
      const box = await page.locator('.pc-canvas').boundingBox();
      await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.6, { steps: 12 });
      await page.mouse.up();
      await shot('drawn');
      if (!phone) {
        const cb = await page.locator('.tx-act-compare').boundingBox();
        await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2);
        await page.mouse.down();
        await shot('compare', { wait: 300 });
        await page.mouse.up();
      }
    }
    if (on('shortcuts')) {
      await page.locator('.tx-bar').click({ position: { x: 400, y: 10 } });
      await page.keyboard.press('Shift+/');
      await page.waitForSelector('.shortcuts');
      await shot('shortcuts');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
    const ensureOpen = async () => {
      if (!(await page.evaluate(() => !!window.__tx.canvas.current()))) await open('stone', 'block/stone.png');
    };
    if (on('upload')) {
      await ensureOpen();
      const file = await makePng();
      await page.click('.tx-act-upload');
      await page.waitForSelector('.tx-upload .dropzone');
      await page.setInputFiles('.tx-upload .dropzone input[type=file]', file);
      await page.waitForSelector('.tx-up-editor:not([hidden])');
      await shot('upload');
      await page.click('dialog[open] .btn-primary');
      await shot('uploaded');
    }
    if (on('picker')) {
      await ensureOpen();
      await page.click('.tx-swatch-primary');
      await page.waitForSelector('.color-picker');
      await shot('color-picker');
      await page.keyboard.press('Escape');
    }
    if (on('pack')) {
      await side('pack');
      await page.waitForTimeout(400);
      await page.click('.tx-pack .toggle .switch');
      await page.waitForSelector('.tx-mcmeta', { timeout: 20000 });
      await page.locator('.tx-compat-body').scrollIntoViewIfNeeded();
      await shot('pack-compat', { wait: 800 });
      await page.locator('.tx-pack-hero').scrollIntoViewIfNeeded();
      await page.click('.tx-codes-wrap summary');
      await shot('pack-codes');
    }
    if (on('effects-edit')) {
      await side('effects');
      await page.click('.tx-preset[data-preset="neon-outline"]');
      await page.waitForTimeout(300);
      await page.click('.tx-layer >> nth=2 >> .tx-l-title');
      await shot('effects-layer', { wait: 800 });
      await page.click('.tx-fx-head .btn:has-text("Add")');
      await page.waitForSelector('.tx-add-list');
      await shot('effects-add');
      await page.keyboard.press('Escape');
    }
    if (on('export')) {
      await page.click('.tx-export-btn');
      await page.waitForSelector('.tx-export-modal .tx-exp-rows');
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 180000 }), page.click('.tx-export-modal .btn-primary')]);
      await dl.path();
      await page.waitForSelector('.tx-exp-done');
      await shot('export-done');
      await page.click('.tx-export-modal .btn-primary:has-text("Done")');
    }
    if (on('bedrock')) {
      await page.goto(base + '#/textures');
      await page.waitForSelector('.tx-new');
      await page.click('.tx-new .segmented-item[data-value="bedrock"]');
      await page.waitForTimeout(300);
      await shot('start-bedrock');
      await page.fill('.tx-name-field input', 'Pocket Pals');
      await page.click('.tx-create-btn');
      await page.waitForFunction(() => !!window.__tx, null, { timeout: 120000 });
      await showTextures();
      await page.waitForSelector('.tx-tile.loaded', { timeout: 120000 });
      await open('grass side', 'blocks/grass_side.tga');
      await page.waitForSelector('.tx-banner:not([hidden])');
      if (!phone) await side('preview');
      await shot('bedrock-mask', { wait: 2500 });
      await side('pack');
      await page.locator('.tx-pack .card:has-text("Bedrock pack")').scrollIntoViewIfNeeded();
      await shot('bedrock-pack', { wait: 600 });
    }
  } catch (e) {
    console.error('FAILED', e.message.split('\n')[0]);
    await page.screenshot({ path: path.join(out, `textures-failure-${tag}.png`) }).catch(() => {});
  } finally {
    await browser.close();
    server?.stop();
  }
  if (errors.length) console.log('ERRORS:\n' + [...new Set(errors)].join('\n'));
})();
