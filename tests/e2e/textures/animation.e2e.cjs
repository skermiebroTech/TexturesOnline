// End-to-end checks of the animation maker: a still block is made animated from the texture's menu;
// frames are painted, added, dragged to a new place, copied and pasted (keyboard), deleted; the onion
// skin shows the frame before; the timing window sets the speed, a frame's own time, blending and a
// typed play order (and refuses a frame that doesn't exist); the strip plays the animation; a GIF is
// imported as frames with its timing and the animation saved as a GIF; an item is animated too and a
// mob skin can't be; the record survives a reload; the Java 26.3 zip holds the strips and their
// .png.mcmeta files and opens again with its animations editable; a phone with touch moves frames
// with the menu; Bedrock writes flipbook entries merged with the game's list and says it can't
// animate items; light and dark themes; no console errors. Bedrock needs the network
// (bedrock-samples on GitHub).
// Usage: NODE_PATH=$(npm root -g) TO_FIXTURES=<dir> node tests/e2e/textures/animation.e2e.cjs [baseUrl] [--shots <dir>] [--no-bedrock]
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startVite, launch, routeMojang, fixturesDir, unzip, decodePng, ROOT } = require('./lib.cjs');

const argv = process.argv.slice(2);
const baseArg = argv.find((a) => /^https?:/.test(a));
const shotsDir = argv.includes('--shots') ? argv[argv.indexOf('--shots') + 1] : null;
const doBedrock = !argv.includes('--no-bedrock');
if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tx-anim-'));
const J = 'assets/minecraft/textures/';
const STONE = `${J}block/stone.png`;
const APPLE = `${J}item/apple.png`;
const GIF = path.join(ROOT, 'tests/tools/anim/anim-small.gif');

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
}
const shot = async (page, name) => {
  if (shotsDir) await page.screenshot({ path: path.join(shotsDir, `${name}.png`) });
};
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const json = (bytes) => JSON.parse(Buffer.from(bytes).toString('utf8'));
const RED = [255, 0, 0, 255];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function newPack(page, base, { name, bedrock = false }) {
  await page.goto(base + 'textures/');
  await page.waitForSelector('.tx-new .tx-start-opt');
  if (bedrock) {
    await page.click('.tx-new .segmented-item[data-value="bedrock"]');
    await page.waitForFunction(() => /Bedrock/.test(document.querySelector('.tx-new .vp-trigger')?.textContent ?? ''));
  }
  await page.fill('.tx-name-field input', name);
  await page.click('.tx-create-btn');
  await page.waitForURL(/textures\/[0-9a-f-]+\/?$/, { timeout: 15000 });
  await page.waitForFunction(() => !!window.__tx && document.querySelector('.tx-main'), null, { timeout: 180000 });
}

async function openTexture(page, p) {
  await page.evaluate((x) => window.__tx.open(x), p);
  await page.waitForFunction((x) => window.__tx.canvas.current()?.key === x, p, { timeout: 60000 });
}

/** An entry of the texture's ⋮ menu. */
async function textureMenu(page, label) {
  await page.click('.tx-head-actions .icon-btn:last-child');
  await page.click(`[role=menuitem]:has-text("${label}")`);
}

/** An entry of the frames strip's menu. */
async function stripMenu(page, label) {
  await page.click('.tx-frames-more');
  await page.click(`[role=menuitem]:has-text("${label}")`);
}

const frameCount = (page) => page.$$eval('.tx-frames-list .tx-frame', (l) => l.length);
const record = (page, p) => page.evaluate((x) => JSON.parse(JSON.stringify(window.__tx.store.project.animations?.[x] ?? null)), p);
const current = (page) => page.evaluate(() => window.__tx.canvas.current().frame);
const pixel = (page, x, y) => page.evaluate(([a, b]) => window.__tx.pixel(a, b), [x, y]);

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

/** The pixel canvas as the screen shows it (to see the onion skin, which isn't in the texture). */
async function canvasShot(page) {
  const box = await page.evaluate(() => {
    const r = window.__tx.canvas.canvas().element.querySelector('canvas').getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  });
  return page.screenshot({ clip: box });
}

async function exportPack(page, ext) {
  await page.waitForSelector('.tx-save[data-state="saved"]', { timeout: 30000 });
  await page.click('.tx-export-btn');
  await page.waitForSelector('.tx-export-modal .tx-exp-rows');
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 300000 }), page.click(`.tx-export-modal .btn-primary:has-text("Export ${ext}")`)]);
  const file = path.join(tmp, `${Date.now()}-${download.suggestedFilename()}`);
  await download.saveAs(file);
  await page.waitForSelector('.tx-exp-done', { timeout: 60000 });
  const warnings = await page.$$eval('.tx-exp-warnings li', (l) => l.map((x) => x.textContent.trim()));
  await page.click('.tx-export-modal .btn-primary:has-text("Done")');
  return { zip: unzip(file), warnings, file };
}

/** Image descriptors and the size of a GIF (enough to tell its frames apart from its header). */
function gifInfo(bytes) {
  const b = Buffer.from(bytes);
  let delays = 0;
  for (let i = 0; i + 3 < b.length; i++) if (b[i] === 0x21 && b[i + 1] === 0xf9 && b[i + 2] === 0x04) delays++;
  return { sig: b.subarray(0, 6).toString('latin1'), w: b.readUInt16LE(6), h: b.readUInt16LE(8), loops: b.includes(Buffer.from('NETSCAPE2.0')), frames: delays };
}

(async () => {
  const fx = fixturesDir();
  const vite = baseArg ? null : await startVite();
  const base = baseArg ?? vite.url;
  const browser = await launch();
  const errors = [];
  const watch = (page) => {
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/Failed to load resource|net::ERR|favicon/i.test(m.text())) errors.push(m.text());
    });
  };
  try {
    // ------------------------------------------------------------------ Java 26.3
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, colorScheme: 'dark', acceptDownloads: true });
    await routeMojang(ctx, fx);
    const page = await ctx.newPage();
    watch(page);
    await newPack(page, base, { name: 'E2E Animation' });
    await openTexture(page, STONE);
    check('a still block has no frames strip', await page.isHidden('.tx-frames'));
    await textureMenu(page, 'Make animated');
    await page.waitForSelector('.tx-frames:not([hidden]) .tx-frame');
    let rec = await record(page, STONE);
    check('made animated: two frames, 0.2 s each', (await frameCount(page)) === 2 && rec?.frameWidth === 16 && rec?.frameHeight === 16 && rec?.frametime === 4, JSON.stringify(rec));
    check('the texture is a strip of two frames', await page.evaluate(() => window.__tx.canvas.current().full.height === 32));
    check('the second frame is open to paint', (await current(page)) === 1);
    check('the toast says how to go on', /Animated with 2 frames/.test(await page.textContent('.toast')));
    check('no window code is loaded yet', !(await page.evaluate(() => performance.getEntriesByType('resource').some((r) => /anim\/dialogs/.test(r.name)))));
    await page.waitForTimeout(300);
    await paintAt(page, 4, 4, RED);
    check('painting frame 2 paints the second frame only', same(await pixel(page, 4, 20), RED) && !same(await pixel(page, 4, 4), RED));
    await shot(page, 'anim-made-1280-dark');

    // add a frame: a copy of the selected one, after it
    await page.click('.tx-frames-list .tx-frame[data-i="0"]');
    await page.click('.tx-frame-add');
    check('+ adds a copy of the selected frame after it', (await frameCount(page)) === 3 && (await current(page)) === 1 && same(await pixel(page, 4, 36), RED) && !same(await pixel(page, 4, 20), RED));

    // onion skin: the frame before shows faintly on the canvas (not in the texture)
    await page.click('.tx-frames-list .tx-frame[data-i="0"]');
    const plain = await canvasShot(page);
    await page.click('.tx-frames-onion');
    await page.waitForTimeout(150);
    const onion = await canvasShot(page);
    check('onion skin: the button is on', (await page.getAttribute('.tx-frames-onion', 'aria-pressed')) === 'true');
    check('onion skin: the frame before (the red one, looping) shows on the canvas', !plain.equals(onion));
    check('onion skin: the texture is unchanged', !same(await pixel(page, 4, 4), RED));
    check('onion skin is remembered', (await page.evaluate(() => localStorage.getItem('to-tex-onion'))) === 'prev');
    await shot(page, 'anim-onion-1280-dark');

    // drag the red frame (3) to the front
    const from = await page.$eval('.tx-frames-list .tx-frame[data-i="2"]', (b) => {
      const r = b.getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2];
    });
    const to = await page.$eval('.tx-frames-list .tx-frame[data-i="0"]', (b) => {
      const r = b.getBoundingClientRect();
      return [r.left + 4, r.top + r.height / 2];
    });
    await page.mouse.move(from[0], from[1]);
    await page.mouse.down();
    await page.mouse.move(from[0] - 10, from[1], { steps: 3 });
    await page.mouse.move(to[0], to[1], { steps: 6 });
    check('dragging shows where the frame goes', await page.isVisible('.tx-frames-drop'));
    await page.mouse.up();
    await page.waitForFunction(() => window.__tx.canvas.current().frame === 0);
    check('drag: the red frame is first now, and selected', same(await pixel(page, 4, 4), RED) && !same(await pixel(page, 4, 36), RED));

    // copy and paste with the keyboard, then delete
    await page.focus('.tx-frames-list .tx-frame[data-i="0"]');
    await page.keyboard.press('Control+c');
    check('Ctrl+C copies the frame', /Frame 1 copied/.test(await page.textContent('.toast:last-child')));
    await page.keyboard.press('Control+v');
    await page.waitForFunction(() => document.querySelectorAll('.tx-frames-list .tx-frame').length === 4);
    check('Ctrl+V pastes it as a new frame after it', same(await pixel(page, 4, 20), RED) && (await current(page)) === 1);
    await page.focus('.tx-frames-list .tx-frame[data-i="1"]');
    await page.keyboard.press('Delete');
    await page.waitForFunction(() => document.querySelectorAll('.tx-frames-list .tx-frame').length === 3);
    check('Delete deletes the frame (with Undo)', !same(await pixel(page, 4, 20), RED) && (await page.isVisible('.toast .btn:has-text("Undo")')));

    // timing: speed, a frame's own time, blending
    await page.click('.tx-frames-timing');
    await page.waitForSelector('.an-timing-modal');
    check('the timing window explains ticks', /20 ticks make 1 second/.test(await page.textContent('.an-timing-modal .an-intro')));
    await page.fill('.an-timing-modal .an-speed input', '2');
    check('the speed in seconds', /0\.1 s \(10 frames a second\)/.test(await page.textContent('.an-timing-modal .an-per')));
    await page.fill('.an-timing-modal .an-times input[data-i="1"]', '10');
    check('one loop with a frame of its own time', /One loop takes 0\.7 s \(14 ticks\)/.test(await page.textContent('.an-timing-modal .an-loop')));
    await page.click('.an-timing-modal .switch');
    await shot(page, 'anim-timing-1280-dark');
    await page.click('.an-timing-modal .btn-primary:has-text("Apply")');
    rec = await record(page, STONE);
    check('timing saved: speed, frame 2’s own time and blending', rec.frametime === 2 && rec.interpolate === true && same(rec.frames, [{ index: 0 }, { index: 1, time: 10 }, { index: 2 }]), JSON.stringify(rec));
    check('the strip marks the frame with its own time', (await page.textContent('.tx-frames-list .tx-frame[data-i="1"] .tx-frame-time')) === '10');

    // a typed play order; a frame that doesn't exist is refused
    await page.click('.tx-frames-timing');
    await page.waitForSelector('.an-timing-modal');
    await page.click('.an-timing-modal .an-more summary');
    await page.fill('.an-timing-modal .an-order', '1, 2, 9');
    check('a frame that doesn’t exist is named', /There is no frame 9: the frames are 1 to 3/.test(await page.textContent('.an-timing-modal .an-msg')));
    await page.click('.an-timing-modal .btn-primary:has-text("Apply")');
    check('… and Apply waits for a good order', await page.isVisible('.an-timing-modal'));
    await page.fill('.an-timing-modal .an-order', '1-3, 2:6');
    await page.click('.an-timing-modal .btn-primary:has-text("Apply")');
    await page.waitForSelector('.an-timing-modal', { state: 'detached' });
    rec = await record(page, STONE);
    check('the typed order is saved (it replaces the times typed over)', same(rec.frames, [{ index: 0 }, { index: 1 }, { index: 2 }, { index: 1, time: 6 }]), JSON.stringify(rec.frames));

    // play and pause the strip's preview
    const still = await page.$eval('.tx-frames-preview', (c) => c.toDataURL());
    await page.click('.tx-frames-play');
    await page.waitForTimeout(400);
    const moving = await page.$eval('.tx-frames-preview', (c) => c.toDataURL());
    check('Play plays the animation at game speed', (await page.getAttribute('.tx-frames-play', 'aria-pressed')) === 'true' && moving !== still);
    await page.click('.tx-frames-play');
    check('… and pauses', (await page.getAttribute('.tx-frames-play', 'aria-pressed')) === 'false');

    // import a GIF: its frames replace these, its timing in ticks
    await stripMenu(page, 'Import GIF or frames');
    await page.waitForSelector('.an-import-modal');
    await page.setInputFiles('.an-import-modal input[type=file]', GIF);
    await page.waitForSelector('.an-import:not([hidden])');
    check('the GIF’s frames and length', /4 frames · 0\.4 s/.test(await page.textContent('.an-found')), await page.textContent('.an-found'));
    await page.click('.an-import-modal .segmented-item[data-value="replace"]');
    await shot(page, 'anim-import-1280-dark');
    await page.click('.an-import-modal .btn-primary:has-text("Import")');
    await page.waitForFunction(() => document.querySelectorAll('.tx-frames-list .tx-frame').length === 4);
    rec = await record(page, STONE);
    // delays 10, 5, 20, 7 hundredths of a second: 2, 1, 4, 1 ticks
    check('GIF timing converted to ticks', rec.frametime === 1 && same(rec.frames, [{ index: 0, time: 2 }, { index: 1 }, { index: 2, time: 4 }, { index: 3 }]), JSON.stringify(rec));
    check('GIF frames resized to the texture, sharp', await page.evaluate(() => window.__tx.canvas.current().full.width === 16 && window.__tx.canvas.current().full.height === 64));

    // save as GIF
    await stripMenu(page, 'Save as GIF');
    await page.waitForSelector('.an-gif-modal');
    await page.click('.an-gif-modal .segmented-item[data-value="4"]');
    const [gifDl] = await Promise.all([page.waitForEvent('download'), page.click('.an-gif-modal .btn-primary:has-text("Save GIF")')]);
    const gifFile = path.join(tmp, gifDl.suggestedFilename());
    await gifDl.saveAs(gifFile);
    const gi = gifInfo(fs.readFileSync(gifFile));
    // blending is on: a frame per tick (2 + 1 + 4 + 1)
    check('Save as GIF: a looping GIF89a, 4×, blended tick by tick', gi.sig === 'GIF89a' && gi.w === 64 && gi.h === 64 && gi.loops && gi.frames === 8 && /stone\.gif$/.test(gifFile), JSON.stringify(gi));

    // an item, and a mob skin that can't be animated
    await openTexture(page, APPLE);
    await textureMenu(page, 'Make animated');
    await page.waitForSelector('.tx-frames:not([hidden]) .tx-frame');
    await paintAt(page, 8, 8, [0, 0, 255, 255]);
    check('an item can be animated (Java)', !!(await record(page, APPLE)));
    await openTexture(page, `${J}entity/zombie/zombie.png`);
    await textureMenu(page, 'Make animated');
    await page.waitForSelector('.tx-cant-modal');
    check('a mob skin can’t: the window says why', /Java Edition only animates blocks, items/.test(await page.textContent('.tx-cant-modal')));
    await shot(page, 'anim-cant-1280-dark');
    await page.click('.tx-cant-modal .btn-primary');
    check('… and nothing changed', !(await record(page, `${J}entity/zombie/zombie.png`)));

    // the record survives a reload
    await page.waitForSelector('.tx-save[data-state="saved"]', { timeout: 30000 });
    await page.reload();
    await page.waitForFunction(() => !!window.__tx && document.querySelector('.tx-main'), null, { timeout: 180000 });
    await openTexture(page, STONE);
    await page.waitForSelector('.tx-frames:not([hidden]) .tx-frame');
    check('after a reload: 4 frames with their times', (await frameCount(page)) === 4 && (await record(page, STONE))?.frames?.length === 4);
    await page.emulateMedia({ colorScheme: 'light' });
    await shot(page, 'anim-strip-1280-light');
    await page.emulateMedia({ colorScheme: 'dark' });

    const ex = await exportPack(page, '.zip');
    const meta = ex.zip[`${STONE}.mcmeta`] && json(ex.zip[`${STONE}.mcmeta`]);
    check('zip: stone.png.mcmeta with the GIF’s timing, blending', same(meta, { animation: { interpolate: true, frames: [{ index: 0, time: 2 }, 1, { index: 2, time: 4 }, 3] } }), JSON.stringify(meta));
    const png = ex.zip[STONE] && (await decodePng(ex.zip[STONE]));
    check('zip: stone.png is a strip of 4 frames', png?.width === 16 && png?.height === 64);
    const appleMeta = ex.zip[`${APPLE}.mcmeta`] && json(ex.zip[`${APPLE}.mcmeta`]);
    check('zip: apple.png.mcmeta', same(appleMeta, { animation: { frametime: 4 } }), JSON.stringify(appleMeta));
    check('zip: no animation warnings for 26.3', !ex.warnings.some((w) => /animation/i.test(w)), ex.warnings.join(' | '));

    // the zip opens again with its animations editable
    const ip = await ctx.newPage();
    watch(ip);
    await ip.goto(base + 'textures/');
    await ip.waitForSelector('.tx-open-dz');
    await ip.setInputFiles('.tx-open-dz input[type=file]', ex.file);
    await ip.waitForFunction(() => /textures\/[0-9a-f-]+\/?$/.test(location.href) || document.querySelector('dialog[open] .btn-primary'), null, { timeout: 60000 });
    const warn = await ip.$('dialog[open] .btn-primary');
    if (warn) await warn.click();
    await ip.waitForURL(/textures\/[0-9a-f-]+\/?$/, { timeout: 60000 });
    await ip.waitForFunction(() => !!window.__tx && document.querySelector('.tx-main'), null, { timeout: 180000 });
    await openTexture(ip, STONE);
    await ip.waitForSelector('.tx-frames:not([hidden]) .tx-frame');
    check('opened zip: 4 frames, editable', (await frameCount(ip)) === 4 && (await ip.isVisible('.tx-frames-timing')));
    await ip.click('.tx-frames-timing');
    await ip.waitForSelector('.an-timing-modal');
    check('opened zip: the timing window shows the pack’s times', (await ip.inputValue('.an-timing-modal .an-times input[data-i="2"]')) === '4');
    await ip.fill('.an-timing-modal .an-speed input', '3');
    await ip.click('.an-timing-modal .btn-primary:has-text("Apply")');
    const again = await exportPack(ip, '.zip');
    const meta2 = json(again.zip[`${STONE}.mcmeta`]);
    check('opened zip: the changed speed is exported (times of their own kept)', same(meta2, { animation: { interpolate: true, frametime: 3, frames: [{ index: 0, time: 2 }, 1, { index: 2, time: 4 }, 3] } }), JSON.stringify(meta2));
    await ip.close();

    // ------------------------------------------------------------------ a phone with touch
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark' });
    await routeMojang(phone, fx);
    const pp = await phone.newPage();
    watch(pp);
    await newPack(pp, base, { name: 'E2E Animation phone' });
    await openTexture(pp, STONE);
    await pp.evaluate(() => window.__tx.showSide('editor'));
    await textureMenu(pp, 'Make animated');
    await pp.waitForSelector('.tx-frames:not([hidden]) .tx-frame');
    await pp.waitForTimeout(300);
    await paintAt(pp, 4, 4, RED);
    await pp.tap('.tx-frame-add');
    await pp.waitForTimeout(300);
    await paintAt(pp, 4, 4, [0, 0, 255, 255]);
    check('phone: + adds a frame', (await frameCount(pp)) === 3);
    check('phone: the strip fits, no sideways scrolling', (await noSideScroll(pp)) && (await pp.$eval('.tx-frames-more', (b) => b.getBoundingClientRect().right <= window.innerWidth)));
    await pp.tap('.tx-frames-more');
    const labels = await pp.$$eval('[role=menuitem]', (l) => l.map((x) => x.textContent.trim()));
    check('phone: the menu has no keyboard hints', labels.includes('Copy frame') && !labels.some((l) => /Ctrl|\(Delete\)/.test(l)), labels.join(' | '));
    await shot(pp, 'anim-menu-390-dark');
    await pp.tap('[role=menuitem]:has-text("Move earlier")');
    await pp.waitForFunction(() => window.__tx.canvas.current().frame === 1);
    check('phone: Move earlier moves the frame (no dragging needed)', same(await pixel(pp, 4, 20), [0, 0, 255, 255]) && same(await pixel(pp, 4, 36), RED));
    await shot(pp, 'anim-strip-390-dark');
    await pp.tap('.tx-frames-timing');
    await pp.waitForSelector('.an-timing-modal');
    check('phone: the timing window fits', await noSideScroll(pp));
    await shot(pp, 'anim-timing-390-dark');
    await pp.emulateMedia({ colorScheme: 'light' });
    await shot(pp, 'anim-timing-390-light');
    await pp.tap('.an-timing-modal .btn-secondary');
    await pp.tap('.tx-frames-more');
    await pp.tap('[role=menuitem]:has-text("Import GIF")');
    await pp.waitForSelector('.an-import-modal');
    check('phone: the import window says Tap', /Tap to choose/.test(await pp.textContent('.an-import-modal .dropzone')));
    await shot(pp, 'anim-import-390-light');
    await phone.close();

    // ------------------------------------------------------------------ Bedrock
    if (doBedrock) {
      await newPack(page, base, { name: 'E2E Animation Bedrock', bedrock: true });
      const GLOW = 'textures/blocks/glowstone.png';
      await openTexture(page, GLOW);
      await textureMenu(page, 'Make animated');
      await page.waitForSelector('.tx-frames:not([hidden]) .tx-frame', { timeout: 60000 });
      await page.click('.tx-frames-timing');
      await page.waitForSelector('.an-timing-modal');
      check('Bedrock: the timing window says frames share one speed', /Bedrock plays every frame at one speed/.test(await page.textContent('.an-timing-modal')));
      await page.fill('.an-timing-modal .an-times input[data-i="1"]', '8');
      await page.click('.an-timing-modal .btn-primary:has-text("Apply")');
      await openTexture(page, 'textures/items/apple.png');
      await textureMenu(page, 'Make animated');
      await page.waitForSelector('.tx-cant-modal');
      check('Bedrock: items can’t be animated, and the window says so', /Bedrock Edition can’t animate items/.test(await page.textContent('.tx-cant-modal')));
      await shot(page, 'anim-bedrock-item-1280-dark');
      await page.click('.tx-cant-modal .btn-primary');
      const bx = await exportPack(page, '.mcpack');
      const list = bx.zip['textures/flipbook_textures.json'] && json(bx.zip['textures/flipbook_textures.json']);
      const mine = list?.filter((e) => e.flipbook_texture === 'textures/blocks/glowstone');
      check('mcpack: a flipbook entry for glowstone (8 ticks = the frame twice at 4)', same(mine, [{ flipbook_texture: 'textures/blocks/glowstone', atlas_tile: 'glowstone', ticks_per_frame: 4, frames: [0, 1, 1], blend_frames: false }]), JSON.stringify(mine));
      check('mcpack: merged with the game’s list (magma, lava…)', !!list?.some((e) => e.flipbook_texture === 'textures/blocks/magma') && list.length > 40, `${list?.length} entries`);
      const gp = bx.zip['textures/blocks/glowstone.png'] && (await decodePng(bx.zip['textures/blocks/glowstone.png']));
      check('mcpack: glowstone.png is a strip of square frames', gp && gp.height === gp.width * 2);
    }
    check('no console errors', !errors.length, errors.slice(0, 3).join(' | '));
  } catch (err) {
    console.error(err);
    failures++;
  } finally {
    await browser.close();
    vite?.stop();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(failures ? `\n${failures} check(s) failed` : '\nAll animation checks passed');
  process.exit(failures ? 1 : 0);
})();
