// End-to-end checks of the GUI section of the texture pack maker: the GUI library (HUD, inventory
// and containers, buttons, menu backgrounds, title screen, enchantment glint), opening pieces in the
// pixel editor (Java 26.3 sprites; Java 1.20.1 atlas areas selected), the live preview following the
// open texture and updating as you paint, every preview screen and window, clicking a part of the
// preview, "Show bigger", the splash text editor, the panorama (the jar's 1 × 1 stand-ins replaced),
// the exported zip / mcpack holding the right files, a phone layout without sideways scrolling, and
// no console errors. Bedrock needs the network (bedrock-samples on GitHub).
// The panorama pictures the game keeps outside its jar are routed to made-up images.
// Usage: NODE_PATH=$(npm root -g) TO_FIXTURES=<dir> node tests/e2e/textures/gui.e2e.cjs [baseUrl] [--shots <dir>] [--no-bedrock]
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ROOT, startVite, launch, routeMojang, fixturesDir, unzip, decodePng } = require('./lib.cjs');

const argv = process.argv.slice(2);
const baseArg = argv.find((a) => /^https?:/.test(a));
const shotsDir = argv.includes('--shots') ? argv[argv.indexOf('--shots') + 1] : null;
const doBedrock = !argv.includes('--no-bedrock');
if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tx-gui-'));
const J = 'assets/minecraft/textures/';

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
}
const shot = async (page, name) => {
  if (shotsDir) await page.screenshot({ path: path.join(shotsDir, `${name}.png`) });
};

/** A made-up panorama face: one colour per face, with a grid so turning shows. */
async function facePng(i) {
  const { encode } = await import(path.join(ROOT, 'node_modules/fast-png/lib/index.js'));
  const colours = [[200, 60, 60], [60, 200, 60], [60, 60, 200], [200, 200, 60], [120, 200, 255], [120, 80, 40], [0, 0, 0]];
  const [r, g, b] = colours[i];
  const n = 64;
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const line = x % 16 === 0 || y % 16 === 0;
      data.set(i === 6 ? [0, 0, 0, Math.round((y / n) * 128)] : line ? [r >> 1, g >> 1, b >> 1, 255] : [r, g, b, 255], (y * n + x) * 4);
    }
  }
  return Buffer.from(encode({ width: n, height: n, data, channels: 4, depth: 8 }));
}

/** The panorama pictures the jar only has as 1 × 1 stand-ins (from the misode/mcmeta mirror). */
async function routePanorama(context) {
  const faces = await Promise.all([0, 1, 2, 3, 4, 5, 6].map(facePng));
  const fetched = [];
  await context.route(/^https:\/\/(raw\.githubusercontent\.com\/misode\/mcmeta\/|cdn\.jsdelivr\.net\/gh\/misode\/mcmeta@)[^/]+-assets\/assets\/minecraft\/textures\/gui\/title\/background\/panorama_(\d|overlay)\.png$/, (r) => {
    const m = /panorama_(\d|overlay)\.png$/.exec(r.request().url());
    fetched.push(m[1]);
    return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'image/png' }, body: faces[m[1] === 'overlay' ? 6 : Number(m[1])] });
  });
  return fetched;
}

/** Serves an older Java version's JSON and client jar (with Range) from the research fixtures. */
async function routeJava(context, fx, version) {
  if (!fx) return false;
  const vj = path.join(fx, 'research-cache', 'version-json', `${version}.json`);
  const jar = path.join(fx, 'research-cache', 'jars', `${version}.jar`);
  if (!fs.existsSync(vj) || !fs.existsSync(jar)) return false;
  const info = JSON.parse(fs.readFileSync(vj, 'utf8'));
  const size = fs.statSync(jar).size;
  const fd = fs.openSync(jar, 'r');
  const cors = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range, content-length, accept-ranges' };
  const esc = version.replace(/\./g, '\\.');
  await context.route(new RegExp(`^https://piston-meta\\.mojang\\.com/v1/packages/[0-9a-f]+/${esc}\\.json$`), (r) => r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: fs.readFileSync(vj) }));
  await context.route(new RegExp(`^https://(launcher|piston-data)\\.mojang\\.com/v1/objects/${info.downloads.client.sha1}/client\\.jar$`), (r) => {
    const range = r.request().headers()['range'];
    const m = range && /bytes=(\d+)-(\d+)?/.exec(range);
    if (!m) return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/java-archive', 'content-length': String(size) }, body: fs.readFileSync(jar) });
    const start = Number(m[1]);
    const end = Math.min(size - 1, m[2] ? Number(m[2]) : size - 1);
    const buf = Buffer.alloc(end - start + 1);
    fs.readSync(fd, buf, 0, buf.length, start);
    return r.fulfill({ status: 206, headers: { ...cors, 'content-type': 'application/java-archive', 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': String(buf.length), 'accept-ranges': 'bytes' }, body: buf });
  });
  return true;
}

async function pickVersion(page, version) {
  await page.click('.tx-new .vp-trigger');
  await page.fill('.vp-pop input[type=search]', version);
  await page.click(`.vp-item:has(.vp-item-name:text-is("${version}"))`);
  await page.waitForFunction((v) => document.querySelector('.tx-new .vp-trigger')?.textContent.includes(v), version);
}

async function newPack(page, base, { name, version, bedrock = false }) {
  await page.goto(base + '#/textures');
  await page.waitForSelector('.tx-new .tx-start-opt');
  if (bedrock) {
    await page.click('.tx-new .segmented-item[data-value="bedrock"]');
    await page.waitForFunction(() => /Bedrock/.test(document.querySelector('.tx-new .vp-trigger')?.textContent ?? ''));
  } else if (version) await pickVersion(page, version);
  await page.fill('.tx-name-field input', name);
  await page.click('.tx-create-btn');
  await page.waitForURL(/(#\/|\/)textures\/[0-9a-f-]+\/?$/, { timeout: 15000 });
  await page.waitForFunction(() => !!window.__tx && document.querySelector('.tx-main'), null, { timeout: 180000 });
}

/** GUI mode from the library switch; resolves when the library lists its pieces. */
async function guiMode(page) {
  await page.locator('.tx-libbar .segmented-item[data-value="gui"]:visible').first().click();
  await page.waitForSelector('.gui-lib .gui-tile', { timeout: 60000 });
  await page.waitForFunction(() => !!window.__tx.guiMode(), null, { timeout: 30000 });
}

async function openTile(page, id, suffix) {
  await page.locator(`.gui-tile[data-piece="${id}"]`).scrollIntoViewIfNeeded();
  await page.click(`.gui-tile[data-piece="${id}"]`);
  await page.waitForFunction((s) => window.__tx.canvas.current()?.key.endsWith(s), suffix, { timeout: 60000 });
  await page.waitForTimeout(400);
}

const hits = (page) => page.evaluate(() => window.__tx.guiMode().preview.hits().map((h) => ({ id: h.piece?.id ?? null, path: h.path, x: h.x, y: h.y, w: h.w, h: h.h })));
const hitIds = async (page) => new Set((await hits(page)).map((h) => h.id).filter(Boolean));
const screenNow = (page) => page.evaluate(() => window.__tx.guiMode().preview.screen());

/** Paints pixels of the open texture with the pencil through real pointer events. */
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

/** Pixels of the preview, inside the area where a piece is drawn, that are strongly blue. */
const bluePixels = (page, id) =>
  page.evaluate((pid) => {
    const cv = document.querySelector('.gui-pv-stage:not(.is-big) .gui-pv-canvas');
    const pv = window.__tx.guiMode().preview;
    const hit = pv.hits().find((x) => x.piece?.id === pid);
    if (!hit) return -1;
    const R = pv.size().r;
    const d = cv.getContext('2d').getImageData(hit.x * R, hit.y * R, hit.w * R, hit.h * R).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 2] > 200 && d[i] < 60 && d[i + 1] < 60) n++;
    return n;
  }, id);

async function exportFile(page, ext) {
  await page.waitForSelector('.tx-save[data-state="saved"]', { timeout: 30000 });
  await page.click('.tx-export-btn');
  await page.waitForSelector('.tx-export-modal .tx-exp-rows');
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 300000 }), page.click(`.tx-export-modal .btn-primary:has-text("Export ${ext}")`)]);
  const file = path.join(tmp, download.suggestedFilename());
  await download.saveAs(file);
  await page.waitForSelector('.tx-exp-done', { timeout: 30000 });
  await page.click('.tx-export-modal .btn-primary:has-text("Done")');
  return unzip(file);
}

const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

(async () => {
  const server = baseArg ? null : await startVite();
  const base = baseArg || server.url;
  const fx = fixturesDir();
  const browser = await launch();
  const errors = [];
  const watch = (page, tag) => {
    page.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon|Failed to load resource|ERR_|404/.test(m.text())) errors.push(`${tag}: ${m.text()}`);
    });
  };
  try {
    // ------------------------------------------------------------------ Java 26.3: sprites
    {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, acceptDownloads: true });
      await routeMojang(ctx, fx);
      const fetched = await routePanorama(ctx);
      const page = await ctx.newPage();
      watch(page, '26.3');
      await newPack(page, base, { name: 'GUI 26.3' });
      await guiMode(page);
      check('26.3: GUI mode shows the library', (await page.locator('.gui-lib .gui-tile').count()) > 60, `${await page.locator('.gui-lib .gui-tile').count()} pieces`);
      const sections = await page.$$eval('.gui-sec', (s) => s.map((x) => x.dataset.section));
      check('26.3: every section', ['hud', 'screens', 'widgets', 'backgrounds', 'title', 'glint'].every((s) => sections.includes(s)), sections.join(','));
      check('26.3: the hotbar opens with GUI mode', await page.evaluate(() => window.__tx.canvas.current()?.key.endsWith('gui/sprites/hud/hotbar.png')));
      check('26.3: no 2D / 3D switch in GUI mode', !(await page.isVisible('.tx-ws-switch')));
      await shot(page, '26.3-01-library');

      // hearts: sprite file, the HUD shows them
      await openTile(page, 'hearts.full', 'gui/sprites/hud/heart/full.png');
      check('26.3: the preview follows to the HUD', (await screenNow(page)) === 'hud');
      check('26.3: the HUD draws the hearts', (await hitIds(page)).has('hearts.full'));
      check('26.3: the piece is marked in the library', (await page.getAttribute('.gui-tile[data-piece="hearts.full"]', 'aria-pressed')) === 'true');
      // paint the heart blue: the preview shows it
      const before = await bluePixels(page, 'hearts.full');
      await paint(page, [20, 30, 250, 255], [[2, 2], [3, 3], [4, 4], [5, 3], [6, 2]]);
      await page.waitForTimeout(500);
      const after = await bluePixels(page, 'hearts.full');
      check('26.3: painting shows in the preview straight away', after > before, `${before} → ${after} blue pixels`);
      await shot(page, '26.3-02-hearts-painted');

      // other HUD looks follow their pieces
      await openTile(page, 'heartsPoisoned.full', 'heart/poisoned_full.png');
      check('26.3: poisoned hearts show poisoned', (await hitIds(page)).has('heartsPoisoned.full'));
      await openTile(page, 'air.full', 'gui/sprites/hud/air.png');
      check('26.3: air bubbles show under water', (await hitIds(page)).has('air.full'));
      await openTile(page, 'heartsMount.full', 'heart/vehicle_full.png');
      check('26.3: the mount’s hearts while riding', (await hitIds(page)).has('heartsMount.full'));

      // screens
      await openTile(page, 'inventory.window', 'gui/container/inventory.png');
      check('26.3: inventory screen', (await screenNow(page)) === 'inventory' && (await hitIds(page)).has('inventory.window'));
      for (const [c, id] of [['chest', 'chest.window'], ['largeChest', 'chest.window'], ['furnace', 'furnace.arrow'], ['crafting', 'crafting.window']]) {
        await page.selectOption('.gui-pv-window select', c);
        await page.waitForTimeout(150);
        check(`26.3: ${c} window`, (await hitIds(page)).has(id));
      }
      await shot(page, '26.3-03-crafting');
      const items = (await hits(page)).filter((h) => !h.id && /\/item\//.test(h.path));
      check('26.3: the pack’s item textures fill the slots', items.length >= 6, `${items.length}`);
      await page.click('.gui-pv-screen[data-screen="title"]');
      await page.waitForTimeout(400);
      const titleIds = await hitIds(page);
      check('26.3: title screen: logo and buttons', titleIds.has('logo.logo') && titleIds.has('button.normal') && titleIds.has('button.hover'), [...titleIds].join(','));
      await page.click('.gui-pv-screen[data-screen="menu"]');
      await page.waitForTimeout(300);
      const menuIds = await hitIds(page);
      check('26.3: menu: background, list and a greyed-out button', menuIds.has('backgrounds.menu') && menuIds.has('backgrounds.list') && menuIds.has('button.disabled'), [...menuIds].join(','));
      await page.click('.gui-pv-ingame .switch');
      await page.waitForTimeout(300);
      check('26.3: menu in game', (await hitIds(page)).has('backgrounds.inworldMenu'));
      await page.click('.gui-pv-screen[data-screen="glint"]');
      await page.waitForTimeout(300);
      check('26.3: glint screen', (await hitIds(page)).has('glint.item'));

      // a click on the preview opens that part
      await page.click('.gui-pv-screen[data-screen="hud"]');
      await page.waitForTimeout(300);
      const bar = (await hits(page)).find((h) => h.id === 'hotbar.bar');
      const box = await page.locator('.gui-pv-stage:not(.is-big) .gui-pv-canvas').boundingBox();
      const size = await page.evaluate(() => window.__tx.guiMode().preview.size());
      // (between the items of the sixth and seventh slot: the bar itself)
      await page.mouse.click(box.x + ((bar.x + 3 + 5 * 20 + 17.5) / size.w) * box.width, box.y + ((bar.y + bar.h / 2) / size.h) * box.height);
      await page.waitForFunction(() => window.__tx.canvas.current()?.key.endsWith('gui/sprites/hud/hotbar.png'), null, { timeout: 30000 }).catch(() => undefined);
      check('26.3: clicking the hotbar in the preview opens it', await page.evaluate(() => window.__tx.canvas.current()?.key.endsWith('gui/sprites/hud/hotbar.png')));
      // and an item in it opens the item's texture
      await page.mouse.click(box.x + ((bar.x + 3 + 20 + 8) / size.w) * box.width, box.y + ((bar.y + bar.h / 2) / size.h) * box.height);
      await page.waitForFunction(() => window.__tx.canvas.current()?.key.endsWith('item/iron_pickaxe.png'), null, { timeout: 30000 }).catch(() => undefined);
      check('26.3: clicking an item in the hotbar opens it', await page.evaluate(() => window.__tx.canvas.current()?.key.endsWith('item/iron_pickaxe.png')));
      check('26.3: GUI mode stays on', await page.isVisible('.gui-lib'));

      // the panorama: the real pictures instead of the jar's 1 × 1 stand-ins
      await openTile(page, 'panorama.front', 'gui/title/background/panorama_0.png');
      const pano = await page.evaluate(() => [window.__tx.canvas.current().full.width, window.__tx.canvas.current().full.height]);
      check('26.3: the panorama opens as the real picture', pano[0] === 64 && pano[1] === 64, pano.join('×'));
      check('26.3: the panorama came from the asset mirror', fetched.includes('0'), fetched.join(','));
      check('26.3: the panorama shows on the title screen', (await screenNow(page)) === 'title');
      await paint(page, [255, 255, 255, 255], [[10, 10]]);
      await shot(page, '26.3-04-title');

      // show bigger
      await page.click('.gui-pv-bigger');
      await page.waitForSelector('.gui-pv-modal .gui-pv-stage.is-big canvas');
      await page.waitForTimeout(400);
      const bigScale = await page.evaluate(() => {
        const cv = document.querySelector('.gui-pv-modal canvas');
        return cv.width;
      });
      check('26.3: the bigger preview draws', bigScale > 600, `${bigScale}px`);
      await shot(page, '26.3-05-bigger');
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('dialog[open]'));

      // splash texts
      await page.click('.gui-splash-row');
      await page.waitForSelector('.gui-sp .gui-sp-edit', { timeout: 30000 });
      const gameCount = await page.locator('.gui-sp-readonly li').count();
      check('26.3: the game’s splash texts are listed', gameCount > 300, `${gameCount}`);
      check('26.3: the splash editor takes the centre', (await page.isVisible('.gui-sp')) && !(await page.isVisible('.tx-col-center .pc-root, .tx-col-center .tx-canvas-panel')));
      await page.click('.gui-sp-edit');
      await page.waitForSelector('.gui-sp-row');
      await page.fill('.gui-sp-new', 'Painted in the browser!');
      await page.press('.gui-sp-new', 'Enter');
      await page.waitForTimeout(300);
      const after1 = await page.evaluate(async () => (await window.__tx.store.project.extraFiles['assets/minecraft/texts/splashes.txt']?.text()) ?? '');
      check('26.3: a splash text is added to the pack’s file', after1.split('\n').includes('Painted in the browser!') && after1.split('\n').length > 300);
      await page.click('.gui-sp-reset');
      await page.waitForTimeout(200);
      check('26.3: back to the game’s list (the file goes)', await page.evaluate(() => !window.__tx.store.project.extraFiles['assets/minecraft/texts/splashes.txt']));
      await page.click('.gui-sp-empty');
      await page.fill('.gui-sp-new', 'First!\nSecond!');
      await page.click('.gui-sp-add');
      await page.waitForTimeout(200);
      check('26.3: pasting lines adds each', (await page.locator('.gui-sp-row').count()) === 2);
      await page.locator('.gui-sp-row .gui-sp-field').first().fill('First, changed');
      await page.waitForTimeout(700);
      await page.locator('.gui-sp-row .gui-sp-show').nth(1).click();
      check('26.3: a splash shows on the title screen', (await screenNow(page)) === 'title');
      await shot(page, '26.3-06-splashes');

      // the zip
      await page.click('.gui-tile[data-piece="hearts.full"]');
      const zip = await exportFile(page, '.zip');
      check('26.3 zip: the painted heart', !!zip[`${J}gui/sprites/hud/heart/full.png`]);
      check('26.3 zip: the panorama face', !!zip[`${J}gui/title/background/panorama_0.png`]);
      check('26.3 zip: splashes.txt', Buffer.from(zip['assets/minecraft/texts/splashes.txt'] ?? []).toString() === 'First, changed\nSecond!\n');
      const heart = await decodePng(zip[`${J}gui/sprites/hud/heart/full.png`]);
      check('26.3 zip: heart keeps its size', heart.width === 9 && heart.height === 9, `${heart.width}×${heart.height}`);
      check('26.3: no sideways scrolling', await noSideScroll(page));
      await page.close();
      await ctx.close();
    }

    // ------------------------------------------------------------------ Java 1.20.1: atlas areas
    {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, acceptDownloads: true });
      await routeMojang(ctx, fx);
      await routePanorama(ctx);
      const routed = await routeJava(ctx, fx, '1.20.1');
      const page = await ctx.newPage();
      watch(page, '1.20.1');
      await newPack(page, base, { name: 'GUI 1.20.1', version: '1.20.1' });
      await guiMode(page);
      check('1.20.1: the note names the atlases', (await page.textContent('.gui-lib-note')).includes('gui/icons.png'), routed ? 'fixtures' : 'network');
      await openTile(page, 'hearts.full', 'gui/icons.png');
      const sel = await page.evaluate(() => window.__tx.canvas.canvas().getSelection());
      check('1.20.1: hearts open icons.png with the heart selected', sel && sel.x === 52 && sel.y === 0 && sel.w === 9 && sel.h === 9, JSON.stringify(sel));
      check('1.20.1: zoomed in on it', await page.evaluate(() => window.__tx.canvas.canvas().getZoom() >= 8));
      check('1.20.1: the HUD draws hearts from the atlas', (await hitIds(page)).has('hearts.full'));
      await paint(page, [20, 30, 250, 255], [[56, 4]]);
      await openTile(page, 'button.hover', 'gui/widgets.png');
      const sel2 = await page.evaluate(() => window.__tx.canvas.canvas().getSelection());
      check('1.20.1: buttons are areas of widgets.png', sel2 && sel2.y === 86 && sel2.w === 200, JSON.stringify(sel2));
      check('1.20.1: buttons show on the title screen', (await screenNow(page)) === 'title' && (await hitIds(page)).has('button.hover'));
      await openTile(page, 'furnace.arrow', 'gui/container/furnace.png');
      const sel3 = await page.evaluate(() => window.__tx.canvas.canvas().getSelection());
      check('1.20.1: the furnace arrow is beside the window', sel3 && sel3.x === 176 && sel3.y === 14, JSON.stringify(sel3));
      await page.click('.gui-pv-screen[data-screen="menu"]');
      await page.waitForTimeout(300);
      check('1.20.1: the dirt menu background', (await hitIds(page)).has('backgrounds.dirt'));
      await shot(page, '1.20.1-01-atlas');
      const zip = await exportFile(page, '.zip');
      check('1.20.1 zip: gui/icons.png with the painted heart', !!zip[`${J}gui/icons.png`]);
      const icons = await decodePng(zip[`${J}gui/icons.png`]);
      const i = (4 * icons.width + 56) * 4;
      check('1.20.1 zip: the pixel is in the heart’s area', icons.data[i + 2] > 200 && icons.data[i] < 60, Array.from(icons.data.slice(i, i + 4)).join(','));
      await page.close();
      await ctx.close();
    }

    // ------------------------------------------------------------------ phone
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2.75, hasTouch: true, isMobile: true, colorScheme: 'dark' });
      await routeMojang(ctx, fx);
      await routePanorama(ctx);
      const page = await ctx.newPage();
      watch(page, 'phone');
      await newPack(page, base, { name: 'GUI phone' });
      await page.locator('.tx-tabbar-btn[data-v="textures"]').tap();
      await guiMode(page);
      check('phone: no sideways scrolling in the library', await noSideScroll(page));
      const tileBox = await page.locator('.gui-tile[data-piece="hearts.half"]').boundingBox();
      check('phone: finger-sized pieces', tileBox && tileBox.width >= 44 && tileBox.height >= 44, tileBox && `${tileBox.width}×${tileBox.height}`);
      await page.locator('.gui-tile[data-piece="hearts.half"]').tap();
      await page.waitForFunction(() => window.__tx.canvas.current()?.key.endsWith('heart/half.png'), null, { timeout: 60000 });
      await page.waitForTimeout(300);
      check('phone: a piece opens on the Paint tab', (await page.getAttribute('.tx-tabbar-btn[data-v="editor"]', 'aria-current')) === 'page');
      await page.locator('.tx-tabbar-btn[data-v="preview"]').tap();
      await page.waitForTimeout(500);
      check('phone: the Preview tab shows the GUI preview', await page.isVisible('.gui-pv .gui-pv-canvas'));
      check('phone: the preview fits the screen', await noSideScroll(page));
      await shot(page, 'phone-01-preview');
      await page.locator('.tx-tabbar-btn[data-v="textures"]').tap();
      await page.locator('.gui-splash-row').tap();
      await page.waitForSelector('.gui-sp .gui-sp-edit', { timeout: 30000 });
      check('phone: splash texts open on the Edit tab', (await page.textContent('.tx-tabbar-btn[data-v="editor"]')).trim().length > 0 && (await page.getAttribute('.tx-tabbar-btn[data-v="editor"]', 'aria-current')) === 'page');
      check('phone: splash texts fit the screen', await noSideScroll(page));
      await shot(page, 'phone-02-splashes');
      await page.close();
      await ctx.close();
    }

    // ------------------------------------------------------------------ Bedrock
    if (doBedrock) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, acceptDownloads: true });
      const page = await ctx.newPage();
      watch(page, 'bedrock');
      await newPack(page, base, { name: 'GUI Bedrock', bedrock: true });
      await guiMode(page);
      await openTile(page, 'hearts.full', 'textures/ui/heart.png');
      check('Bedrock: hearts are textures/ui/heart.png', (await hitIds(page)).has('hearts.full'));
      await paint(page, [20, 30, 250, 255], [[4, 4]]);
      await openTile(page, 'hotbar.slot5', 'textures/ui/hotbar_4.png');
      check('Bedrock: the hotbar is drawn slot by slot', (await hitIds(page)).has('hotbar.slot5') && (await hitIds(page)).has('hotbar.slot1'));
      await page.click('.gui-pv-screen[data-screen="inventory"]');
      await page.waitForTimeout(300);
      check('Bedrock: the inventory window from its nine-slice pieces', (await hitIds(page)).has('window.panel') && (await hitIds(page)).has('window.slot'));
      check('Bedrock: no menu screen', !(await page.isVisible('.gui-pv-screen[data-screen="menu"]')));
      await page.click('.gui-splash-row');
      await page.waitForSelector('.gui-sp .gui-sp-empty', { timeout: 30000 });
      await page.click('.gui-sp-empty');
      await page.fill('.gui-sp-new', 'Bedrock splash!');
      await page.press('.gui-sp-new', 'Enter');
      await page.waitForTimeout(300);
      await shot(page, 'bedrock-01-splashes');
      const zip = await exportFile(page, '.mcpack');
      check('Bedrock mcpack: textures/ui/heart.png', !!zip['textures/ui/heart.png']);
      check('Bedrock mcpack: splashes.json', JSON.stringify(JSON.parse(Buffer.from(zip['splashes.json'] ?? Buffer.from('{}')).toString())) === JSON.stringify({ splashes: ['Bedrock splash!'] }));
      await page.close();
      await ctx.close();
    }

    check('no console errors', errors.length === 0, errors.slice(0, 4).join(' | '));
  } catch (err) {
    console.error(err);
    failures++;
  } finally {
    await browser.close();
    server?.stop();
  }
  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
})();
