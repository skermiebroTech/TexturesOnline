// Regression checks from the texture pack maker review: interrupted exports, navigation while the
// game files fail to load, undo back to vanilla, the category picker, upload limits, deleting with
// unsaved changes, renaming from two places, the reset/save race and Bedrock alpha masks.
// Usage: NODE_PATH=$(npm root -g) node tests/e2e/textures/review.cjs [baseUrl] [--no-bedrock]
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startVite, launch, routeMojang, fixturesDir, ROOT } = require('./lib.cjs');

const argv = process.argv.slice(2);
const baseArg = argv.find((a) => /^https?:/.test(a));
const doBedrock = !argv.includes('--no-bedrock');
let failures = 0;
let total = 0;
function check(name, ok, detail = '') {
  total++;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

const STONE = 'assets/minecraft/textures/block/stone.png';

async function newPack(page, base, name, edition = 'java') {
  await page.goto(base + '#/textures');
  await page.waitForSelector('.tx-new');
  await page.fill('.tx-name-field input', name);
  if (edition === 'bedrock') {
    await page.click('.tx-new .segmented-item[data-value="bedrock"]');
    await page.waitForTimeout(200);
  }
  await page.click('.tx-create-btn');
  await page.waitForFunction(() => !!window.__tx && document.querySelector('.tx-main'), null, { timeout: 180000 });
  return page.evaluate(() => window.__tx.store.project.id);
}

async function open(page, p) {
  await page.evaluate((x) => window.__tx.open(x), p);
  await page.waitForFunction((x) => window.__tx.canvas.current()?.key === x, p, { timeout: 60000 });
}

async function paintAt(page, x, y, color) {
  await page.evaluate((c) => {
    const pc = window.__tx.canvas.canvas();
    pc.setTool('pencil');
    pc.setColor(c);
  }, color);
  const pt = await page.evaluate(([px, py]) => {
    const pc = window.__tx.canvas.canvas();
    const r = pc.element.querySelector('canvas').getBoundingClientRect();
    const [sx, sy] = pc.getView().toScreen(px + 0.5, py + 0.5);
    return [r.left + sx, r.top + sy];
  }, [x, y]);
  await page.mouse.click(pt[0], pt[1]);
}

async function pngFile(name, w, h) {
  const { encode } = await import(path.join(ROOT, 'node_modules/fast-png/lib/index.js'));
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([(i * 13) % 256, 120, 60, 255], i * 4);
  const file = path.join(os.tmpdir(), name);
  if (!fs.existsSync(file)) fs.writeFileSync(file, encode({ width: w, height: h, data, channels: 4, depth: 8 }));
  return file;
}

(async () => {
  const server = baseArg ? null : await startVite();
  const base = baseArg || server.url;
  const fx = fixturesDir();
  const browser = await launch();
  const errors = [];
  const fresh = async () => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    // These flows use the texture grid: start the browser in All textures mode.
    await ctx.addInitScript(() => { try { localStorage.setItem('to-tex-library-mode', 'textures'); } catch { /* storage blocked */ } });
    await routeMojang(ctx, fx);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    return { ctx, page };
  };
  try {
    // ---- export interrupted by navigation / Esc: no download afterwards
    {
      const { ctx, page } = await fresh();
      await newPack(page, base, 'Interrupted');
      await page.click('.tx-col-tabs .tab[data-value="effects"]');
      await page.click('.tx-preset[data-preset="noir"]');
      let downloads = 0;
      page.on('download', () => downloads++);
      await page.click('.tx-export-btn');
      await page.click('.tx-export-modal .btn-primary');
      await page.waitForSelector('.tx-exp-progress');
      await page.waitForTimeout(300);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(4000);
      check('Esc during an export cancels it (no download)', downloads === 0, `${downloads} downloads`);
      await page.click('.tx-export-btn');
      await page.click('.tx-export-modal .btn-primary');
      await page.waitForSelector('.tx-exp-progress');
      await page.waitForTimeout(300);
      const t0 = Date.now();
      await page.evaluate(() => history.back());
      await page.waitForSelector('.tx-new', { timeout: 10000 });
      const took = Date.now() - t0;
      await page.waitForTimeout(4000);
      check('navigating away mid-export leaves at once and cancels it', downloads === 0 && took < 3000, `${took} ms, ${downloads} downloads`);
      await ctx.close();
    }

    // ---- game files fail to download: leaving and retrying
    {
      const { ctx, page } = await fresh();
      await ctx.route(/client\.jar/, (r) => r.abort('internetdisconnected'));
      await page.goto(base + '#/textures');
      await page.fill('.tx-name-field input', 'Offline');
      await page.click('.tx-create-btn');
      await page.waitForSelector('.tx-assets .btn:has-text("Try again")', { timeout: 60000 });
      check('failed download offers Try again, own .jar and a way back', (await page.isVisible('.tx-assets .btn:has-text("Use my own .jar")')) && (await page.isVisible('.tx-assets-back')));
      await page.click('.tx-assets-back');
      await page.waitForSelector('.tx-new');
      check('leaving the failed editor cleans up the page', (await page.evaluate(() => document.body.className)) === '', await page.evaluate(() => document.body.className));
      await page.goBack();
      await page.waitForSelector('.tx-assets .btn:has-text("Try again")', { timeout: 60000 });
      await ctx.unroute(/client\.jar/);
      await page.click('.tx-assets .btn:has-text("Try again")');
      await page.waitForFunction(() => !!window.__tx && document.querySelector('.tx-main'), null, { timeout: 60000 });
      check('Try again loads the editor once the network is back', true);
      await ctx.close();
    }

    const { ctx, page } = await fresh();
    const id = await newPack(page, base, 'Review');

    // ---- undo back to the original is not an edit
    await open(page, STONE);
    await paintAt(page, 2, 2, [255, 0, 255, 255]);
    check('painting marks the texture edited', await page.evaluate((p) => window.__tx.store.isEdited(p), STONE));
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(200);
    check('undoing every change makes it unedited again', !(await page.evaluate((p) => window.__tx.store.isEdited(p), STONE)), await page.textContent('.tx-edited-chip'));
    await page.keyboard.press('Control+Shift+z');
    await page.waitForTimeout(200);
    check('redo makes it edited again', await page.evaluate((p) => window.__tx.store.isEdited(p), STONE));

    // ---- category picker
    await page.fill('.tx-search-input', '');
    await page.click('.tx-catpick');
    await page.waitForSelector('.tx-catmenu');
    const cats = await page.$$eval('.tx-catmenu-item', (els) => els.map((e) => e.dataset.cat));
    check('category menu lists the categories with counts', cats.includes('block') && cats.includes('item') && cats.includes('entity') && cats.length >= 8, cats.join(','));
    await page.click('.tx-catmenu-item[data-cat="item"]');
    await page.waitForTimeout(300);
    const onlyItems = await page.$$eval('.tx-tile', (els) => els.map((e) => e.dataset.path));
    check('choosing Items shows only items', onlyItems.length > 0 && onlyItems.every((p) => p.includes('/item/')), `${onlyItems.length} tiles`);
    await page.focus('.tx-catpick');
    await page.keyboard.press('ArrowDown');
    await page.waitForSelector('.tx-catmenu');
    await page.keyboard.press('Home');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    check('the menu works from the keyboard (back to All)', /All textures/.test(await page.textContent('.tx-catpick')));

    // ---- upload limits
    await page.click('.tx-act-upload');
    await page.waitForSelector('.tx-upload');
    check('Replace is disabled until a picture is chosen', await page.isDisabled('dialog[open] .modal-footer .btn-primary'));
    const bad = path.join(os.tmpdir(), 'tx-review-not-an-image.png');
    fs.writeFileSync(bad, 'not an image');
    await page.setInputFiles('.tx-upload .dropzone input[type=file]', bad);
    await page.waitForSelector('.tx-upload .dropzone-error:not([hidden])');
    check('a broken picture gets a friendly error', /couldn't be read/.test(await page.textContent('.tx-upload .dropzone-error')));
    const huge = await pngFile('tx-review-huge.png', 6400, 6400);
    await page.setInputFiles('.tx-upload .dropzone input[type=file]', huge);
    await page.waitForFunction(() => /huge/.test(document.querySelector('.tx-upload .dropzone-error')?.textContent ?? ''), null, { timeout: 60000 });
    check('a gigantic picture is refused kindly', true, await page.textContent('.tx-upload .dropzone-error'));
    const ok = await pngFile('tx-review-ok.png', 64, 64);
    await page.setInputFiles('.tx-upload .dropzone input[type=file]', ok);
    await page.waitForSelector('.tx-up-editor:not([hidden])');
    check('a good picture enables Replace', await page.isEnabled('dialog[open] .modal-footer .btn-primary'));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    // ---- rename in the top bar shows in the Pack tab
    await page.click('.tx-col-tabs .tab[data-value="pack"]');
    await page.fill('.tx-name-input', 'Renamed Pack');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    check('renaming in the top bar updates the Pack tab', (await page.inputValue('.tx-pack .field input')) === 'Renamed Pack', await page.inputValue('.tx-pack .field input'));

    // ---- reset while a save is running must stay reset
    const raced = await page.evaluate(async (p) => {
      const { store } = window.__tx;
      const img = new ImageData(16, 16);
      img.data.fill(200);
      store.setImage(p, img);
      const saving = store.flush();
      store.resetToVanilla(p);
      await saving;
      await store.flush();
      return !!store.project.overrides[p];
    }, 'assets/minecraft/textures/block/dirt.png');
    check('reset during an autosave is not undone by it', !raced);

    // ---- delete with an unsaved change doesn't bring the pack back
    await page.fill('.tx-pack .field input', 'About to go');
    await page.click('.tx-danger .btn');
    await page.click('dialog[open] .btn-danger');
    await page.waitForSelector('.tx-new');
    await page.waitForTimeout(1500);
    const still = await page.evaluate(async (pid) => !!(await (await import('/src/core/storage.ts')).getProject(pid)), id);
    check('deleting right after a change removes the pack for good', !still);
    await ctx.close();

    // ---- Bedrock: tint masks vs plain cut-outs
    if (doBedrock) {
      const b = await fresh();
      await newPack(b.page, base, 'Masks', 'bedrock');
      await open(b.page, 'textures/blocks/grass_side.tga');
      const grass = await b.page.evaluate(() => ({ banner: !document.querySelector('.tx-banner').hidden, mode: window.__tx.canvas.canvas().channelMode }));
      check('Bedrock grass_side.tga opens in Colour mode with the mask note', grass.banner && grass.mode === 'rgb', JSON.stringify(grass));
      await open(b.page, 'textures/blocks/leaves_oak.tga');
      const leaves = await b.page.evaluate(() => ({ banner: !document.querySelector('.tx-banner').hidden, mode: window.__tx.canvas.canvas().channelMode }));
      check('Bedrock leaves (plain cut-out) open normally', !leaves.banner && leaves.mode === 'rgba', JSON.stringify(leaves));
      await b.ctx.close();
    }
  } catch (e) {
    check('no unexpected exception', false, e.message.split('\n')[0]);
  } finally {
    await browser.close();
    server?.stop();
  }
  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' || '));
  console.log(`\n${total - failures}/${total} checks passed`);
  process.exit(failures ? 1 : 0);
})();
