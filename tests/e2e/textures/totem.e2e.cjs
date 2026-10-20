// End-to-end test of the custom Totem of Undying maker in Chromium.
// Usage: NODE_PATH=$(npm root -g) TO_FIXTURES=<dir> node tests/e2e/textures/totem.e2e.cjs [baseUrl] [--shots <dir>]
// Builds skins on the fly (original pixel art, no game files): a 64x64 skin and a legacy 64x32
// one. Java 26.3 game files (for the gold outline, the default skins and "Open in Texture Pack
// Maker") come from TO_FIXTURES (client jar, routed locally) or the real network. The username
// lookup is answered locally. With --shots, every step is captured at 1280 and 390 px, dark and light.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ROOT, startVite, launch, routeMojang, fixturesDir, unzip, decodePng, jarEntry } = require('./lib.cjs');

const argv = process.argv.slice(2);
const baseArg = argv.find((a) => /^https?:/.test(a));
const shotsDir = argv.includes('--shots') ? argv[argv.indexOf('--shots') + 1] : null;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tx-totem-'));
const JAVA_PATH = 'assets/minecraft/textures/item/totem_of_undying.png';
const LEGACY_PATH = 'assets/minecraft/textures/items/totem.png';
const BEDROCK_PATH = 'textures/items/totem.png';

let failures = 0;
const results = [];
function check(name, ok, detail = '') {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  console.log(results[results.length - 1]);
  if (!ok) failures++;
}

// ------------------------------------------------------------------ test skins
const SKIN = [225, 175, 135, 255];
const HAIR = [90, 55, 30, 255];
const EYE = [40, 90, 220, 255];
const SHIRT = [200, 40, 40, 255];
const PANTS = [40, 60, 200, 255];
const GREY = [120, 120, 120, 255];
const NONE = [0, 0, 0, 0];

/** Original test skin: brown hair, blue eyes, red shirt, blue trousers. Outer layer empty. */
function skinPixel(x, y, h) {
  const inRect = (x0, y0, w, hh) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + hh;
  if (h === 64 && ((y < 16 && x >= 32) || (y >= 32 && y < 48) || (y >= 48 && (x < 16 || x >= 48)))) return NONE;
  if (h === 32 && y < 16 && x >= 32) return x === 63 && y === 0 ? NONE : inRect(40, 8, 8, 2) ? [250, 210, 40, 255] : NONE; // a gold band on the hat
  if (inRect(8, 8, 8, 8)) {
    if (y < 10) return HAIR;
    if (y === 12 && (x === 9 || x === 14)) return EYE;
    return SKIN;
  }
  if (inRect(20, 20, 8, 12)) return SHIRT;
  if (inRect(44, 20, 4, 12) || inRect(36, 52, 4, 12)) return (y - 20) % 32 < 4 ? SHIRT : SKIN;
  if (inRect(4, 20, 4, 12) || inRect(20, 52, 4, 12)) return PANTS;
  return GREY;
}

async function encodePng(w, h, fn) {
  const { encode } = await import(path.join(ROOT, 'node_modules/fast-png/lib/index.js'));
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(fn(x, y), (y * w + x) * 4);
  return encode({ width: w, height: h, data, channels: 4, depth: 8 });
}

async function makeSkins() {
  const files = { modern: path.join(tmp, 'Red Shirt.png'), legacy: path.join(tmp, 'old_school.png') };
  fs.writeFileSync(files.modern, await encodePng(64, 64, (x, y) => skinPixel(x, y, 64)));
  fs.writeFileSync(files.legacy, await encodePng(64, 32, (x, y) => skinPixel(x, y, 32)));
  return files;
}

/** RGBA pixels of a PNG (palette images expanded). */
async function rgba(bytes) {
  const img = await decodePng(bytes);
  const out = new Uint8Array(img.width * img.height * 4);
  for (let i = 0; i < img.width * img.height; i++) {
    if (img.palette) {
      const p = img.palette[img.data[i]];
      out.set([p[0], p[1], p[2], p.length > 3 ? p[3] : 255], i * 4);
    } else if (img.channels === 4) out.set(img.data.subarray(i * 4, i * 4 + 4), i * 4);
    else if (img.channels === 3) out.set([img.data[i * 3], img.data[i * 3 + 1], img.data[i * 3 + 2], 255], i * 4);
  }
  return { w: img.width, h: img.height, data: out, at: (x, y) => Array.from(out.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4)) };
}

// ------------------------------------------------------------------ helpers
/** The big preview's 16x16 pixels, read from its canvas. */
const previewPixels = (page) =>
  page.evaluate(() => {
    const c = document.querySelector('.tt-big-canvas');
    if (!c) return null;
    return Array.from(c.getContext('2d').getImageData(0, 0, 16, 16).data);
  });
const px = (arr, x, y) => arr.slice((y * 16 + x) * 4, (y * 16 + x) * 4 + 4);
const same = (a, b) => a.join() === b.join();

async function uploadSkin(page, file) {
  await page.setInputFiles('.tt-dz input[type=file]', file);
  await page.waitForSelector('.tt-chosen:not([hidden]) .tt-chosen-name', { timeout: 15000 });
  await page.waitForSelector('.tt-big-canvas');
}

async function download(page, selector) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), page.click(selector)]);
  const file = path.join(tmp, dl.suggestedFilename());
  await dl.saveAs(file);
  return { file, name: dl.suggestedFilename(), bytes: fs.readFileSync(file) };
}

const json = (b) => (b ? JSON.parse(Buffer.from(b).toString('utf8')) : undefined);

async function setToggle(page, cls, on) {
  const sw = page.locator(`.${cls} .switch`);
  if ((await sw.getAttribute('aria-checked')) !== String(on)) await sw.click();
}

async function pickVersion(page, id) {
  await page.click('.tt-version .vp-trigger');
  await page.waitForSelector('.vp-item');
  const search = page.locator('.vp-search input, input.vp-search, [role="combobox"]').first();
  if (await search.count()) await search.fill(id);
  await page.locator('.vp-item', { has: page.locator(`.vp-item-name:text-is("${id}")`) }).first().click();
  await page.waitForFunction((v) => document.querySelector('.tt-version .vp-trigger')?.textContent.includes(v), id);
}

/** Screenshots of the current state: 1280 and 390 px, dark and light. */
async function shots(page, name) {
  if (!shotsDir) return;
  const vp = page.viewportSize();
  for (const theme of ['dark', 'light']) {
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, theme);
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 860 });
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        document.activeElement?.blur?.();
      });
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(shotsDir, `totem-${name}-${width}-${theme}.png`), fullPage: true });
    }
  }
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await page.setViewportSize(vp);
}

async function noOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

// ------------------------------------------------------------------ run
(async () => {
  const skins = await makeSkins();
  const server = baseArg ? null : await startVite();
  const base = baseArg || server.url;
  const fx = fixturesDir();
  console.log(`base ${base} · fixtures ${fx ?? '(none: real network)'} · tmp ${tmp}`);
  if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });
  const browser = await launch();
  const errors = [];
  try {
    const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 860 }, colorScheme: 'dark' });
    await routeMojang(ctx, fx);
    // Username lookups answered locally: playerdb gives the texture URL, the PNG is our skin.
    await ctx.route(/^https:\/\/playerdb\.co\/api\/player\/minecraft\//, (r) =>
      r.fulfill({
        status: 200,
        headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
        body: JSON.stringify({ success: true, code: 'player.found', data: { player: { username: 'TotemFriend', skin_texture: 'https://textures.minecraft.net/texture/e2etotemskin', properties: [] } } }),
      }),
    );
    await ctx.route(/^https:\/\/textures\.minecraft\.net\/texture\/e2etotemskin$/, (r) => r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'image/png' }, body: fs.readFileSync(skins.modern) }));
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon|ERR_|404|Failed to load resource/.test(m.text())) errors.push(m.text());
    });

    // ---------------------------------------------------------------- entry points
    await page.goto(base + 'skins');
    await page.waitForSelector('.sk-totem-link');
    await page.click('.sk-totem-link');
    await page.waitForURL(/totem-maker\/?$/, { timeout: 15000 });
    await page.waitForSelector('.tt-dz');
    check('"Make a custom totem" on the skin start screen opens the totem maker', true);
    check('page title', /Custom Totem of Undying Maker/.test(await page.title()), await page.title());
    check('h1', (await page.textContent('.tt-page h1')).trim() === 'Custom Totem of Undying Maker');
    check('no main-menu item is marked current', (await page.$$('.mainnav a[aria-current="page"]')).length === 0);
    await page.waitForSelector('[data-tool-intro="totem"]', { timeout: 15000 }).catch(() => null);
    check('the totem introduction is mounted below the tool', !!(await page.$('[data-tool-intro="totem"]')));
    check('footer links to the totem maker', !!(await page.$('.site-footer a[href$="totem-maker/"]')));
    check('nothing to download before a skin is chosen', (await page.isDisabled('.tt-dl-btn')) && (await page.isDisabled('.tt-open-btn')));
    check('empty preview', await page.isVisible('.tt-preview-empty'));
    await shots(page, '1-start');

    // ---------------------------------------------------------------- upload a skin
    await uploadSkin(page, skins.modern);
    check('uploaded skin shown with its name', (await page.textContent('.tt-chosen-name')).trim() === 'Red Shirt');
    check('default pack name follows the skin', (await page.inputValue('.tt-name-field input')) === 'Red Shirt Totem');
    let pix = await previewPixels(page);
    check('Classic: face at full size (hair, eyes)', same(px(pix, 4, 1), HAIR) && same(px(pix, 5, 5), EYE) && same(px(pix, 10, 5), EYE) && same(px(pix, 6, 6), SKIN), `${px(pix, 4, 1)} ${px(pix, 5, 5)}`);
    check('Classic: shirt below the head, arms out to the sides, trousers at the bottom', same(px(pix, 6, 10), SHIRT) && same(px(pix, 3, 9), SHIRT) && same(px(pix, 1, 9), SKIN) && same(px(pix, 14, 9), SKIN) && same(px(pix, 5, 14), PANTS));
    check('Classic: corners stay see-through', px(pix, 0, 0)[3] === 0 && px(pix, 15, 15)[3] === 0 && px(pix, 0, 12)[3] === 0);
    check('style thumbnails are drawn for all three styles', (await page.$$('.tt-style .tt-style-canvas')).length === 3);
    check('pop and hotbar previews', !!(await page.$('.tt-pop-canvas')) && (await page.$$('.tt-hotbar canvas')).length === 2);
    check('Java hint names the texture path', (await page.textContent('.tt-hint')).includes(JAVA_PATH));
    let overflow = await noOverflow(page);
    check('no horizontal scroll at 1280 px', overflow <= 0, `${overflow}px`);
    await shots(page, '2-classic');

    // ---------------------------------------------------------------- styles + options
    await page.click('.tt-style[data-value="fullbody"]');
    pix = await previewPixels(page);
    check('Full body: smaller head at the top, legs to the bottom row', same(px(pix, 5, 0), HAIR) && same(px(pix, 6, 13), PANTS) && same(px(pix, 6, 15), PANTS) && px(pix, 1, 9)[3] === 0, `${px(pix, 5, 0)} ${px(pix, 6, 15)}`);
    await page.click('.tt-style[data-value="bighead"]');
    pix = await previewPixels(page);
    check('Big head: 10-pixel head from the top row', same(px(pix, 3, 0), HAIR) && same(px(pix, 12, 0), HAIR) && same(px(pix, 7, 11), SHIRT));
    await page.click('.tt-style[data-value="classic"]');
    check('style radio state', (await page.getAttribute('.tt-style[data-value="classic"]', 'aria-checked')) === 'true');

    await setToggle(page, 'tt-opt-outline', true);
    await page.waitForSelector('.tt-shape.is-ready', { timeout: 180000 });
    check('gold outline: the vanilla totem of Java 26.3 is loaded', /Java 26\.3/.test(await page.textContent('.tt-shape')));
    pix = await previewPixels(page);
    if (fx) {
      const vanilla = await rgba(jarEntry(fx, JAVA_PATH));
      let kept = 0;
      let outlinePx = 0;
      let outside = 0;
      const solid = (x, y) => x >= 0 && y >= 0 && x < 16 && y < 16 && vanilla.at(x, y)[3] > 0;
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          if (!solid(x, y)) {
            if (px(pix, x, y)[3] !== 0) outside++;
            continue;
          }
          if (!solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1)) {
            outlinePx++;
            if (same(px(pix, x, y), vanilla.at(x, y))) kept++;
          }
        }
      check('gold outline: every outline pixel is the vanilla one', outlinePx > 20 && kept === outlinePx, `${kept}/${outlinePx}`);
      check('gold outline: nothing outside the vanilla shape', outside === 0, `${outside}`);
      check('gold outline: the eyes stay inside the frame', same(px(pix, 5, 5), EYE));
    }
    await setToggle(page, 'tt-opt-wings', true);
    await setToggle(page, 'tt-opt-outer', false);
    await shots(page, '3-outline-wings');
    await setToggle(page, 'tt-opt-outline', false);
    await setToggle(page, 'tt-opt-wings', false);
    await setToggle(page, 'tt-opt-outer', true);
    pix = await previewPixels(page);
    check('options off again: back to the plain figure', px(pix, 0, 9)[3] === 0 && same(px(pix, 1, 9), SKIN));

    // ---------------------------------------------------------------- pixel editor
    await page.click('.tt-edit-btn');
    await page.waitForSelector('.tt-ed-modal .pc-canvas');
    await page.waitForTimeout(300);
    await page.click('.tt-ed-swatch >> nth=0');
    await shots(page, '4-editor');
    // Paint the top-left corner pixel (see-through before). The canvas fits the image the way
    // PixelCanvas.zoomToFit does: centred, whole pixels, a small margin.
    const box = await page.locator('.tt-ed-modal .pc-canvas').boundingBox();
    const pad = Math.round(Math.min(box.width, box.height) * 0.06 + 8);
    const cell = Math.floor((Math.min(box.width, box.height) - pad * 2) / 16);
    const ox = Math.round((box.width - 16 * cell) / 2);
    const oy = Math.round((box.height - 16 * cell) / 2);
    await page.mouse.click(box.x + ox + cell / 2, box.y + oy + cell / 2);
    await page.click('.tt-ed-modal .modal-footer .btn-primary');
    await page.waitForSelector('.tt-ed-modal', { state: 'detached' });
    pix = await previewPixels(page);
    check('pixel editor: the painted pixel is in the totem', px(pix, 0, 0)[3] === 255, px(pix, 0, 0).join());
    check('pixel editor: "Edited by hand" shown', await page.isVisible('.tt-edited'));
    await shots(page, '5-edited');

    // ---------------------------------------------------------------- PNG + Java pack
    const pngFile = await download(page, '.tt-png-btn');
    const pngImg = await rgba(pngFile.bytes);
    check('Download PNG: totem_of_undying.png, 16x16, with the hand edit', pngFile.name === 'totem_of_undying.png' && pngImg.w === 16 && pngImg.h === 16 && pngImg.at(0, 0)[3] === 255, `${pngFile.name} ${pngImg.w}x${pngImg.h}`);
    check('PNG matches the preview', same(Array.from(pngImg.data), pix));

    await page.fill('.tt-name-field input', 'My Totem');
    const jz = await download(page, '.tt-dl-btn');
    const zip = unzip(jz.file);
    check('Java download is a .zip named after the pack', jz.name === 'My Totem.zip', jz.name);
    check('Java zip: pack.mcmeta, pack.png and item/totem_of_undying.png only', Object.keys(zip).sort().join() === [JAVA_PATH, 'pack.mcmeta', 'pack.png'].sort().join(), Object.keys(zip).join());
    const mcmeta = json(zip['pack.mcmeta']);
    check('pack.mcmeta for Java 26.3', JSON.stringify(mcmeta?.pack?.min_format) === '[97,1]' && mcmeta.pack.max_format === 97, JSON.stringify(mcmeta?.pack));
    check('description names the skin', mcmeta?.pack?.description === 'Totem of Undying that looks like Red Shirt', mcmeta?.pack?.description);
    const tex = await rgba(zip[JAVA_PATH]);
    check('texture in the zip is the totem', tex.w === 16 && same(Array.from(tex.data), pix));
    const icon = await rgba(zip['pack.png']);
    check('pack.png is the totem at 128x128', icon.w === 128 && icon.h === 128 && same(icon.at(5 * 8 + 2, 5 * 8 + 2), EYE));
    check('install help shown', await page.isVisible('.tt-install'));
    await shots(page, '6-java-download');

    // Java 1.12.2: old texture name and pack format 3
    await pickVersion(page, '1.12.2');
    check('1.12.2 hint names items/totem.png', (await page.textContent('.tt-hint')).includes(LEGACY_PATH));
    const oz = unzip((await download(page, '.tt-dl-btn')).file);
    check('Java 1.12.2 zip: items/totem.png and pack_format 3', !!oz[LEGACY_PATH] && !oz[JAVA_PATH] && json(oz['pack.mcmeta'])?.pack?.pack_format === 3, Object.keys(oz).join());
    await pickVersion(page, '1.10.2');
    check('1.10.2: explains totems came in 1.11 and blocks the download', /no Totem of Undying/.test(await page.textContent('.tt-hint')) && (await page.isDisabled('.tt-dl-btn')));
    await shots(page, '7-too-old');
    await pickVersion(page, '26.3');

    // ---------------------------------------------------------------- Bedrock
    await page.click('.tt-ed-choice[data-value="bedrock"]');
    check('Bedrock: no version picker', await page.isHidden('.tt-version'));
    check('Bedrock hint names textures/items/totem.png', (await page.textContent('.tt-hint')).includes(BEDROCK_PATH));
    const bz = await download(page, '.tt-dl-btn');
    const b = unzip(bz.file);
    check('Bedrock download is a .mcpack', bz.name === 'My Totem.mcpack', bz.name);
    check('mcpack: manifest.json, pack_icon.png and textures/items/totem.png only', Object.keys(b).sort().join() === ['manifest.json', 'pack_icon.png', BEDROCK_PATH].sort().join(), Object.keys(b).join());
    const manifest = json(b['manifest.json']);
    check('manifest: name, resources module', manifest?.header?.name === 'My Totem' && manifest.modules?.[0]?.type === 'resources', JSON.stringify(manifest?.header));
    const btex = await rgba(b[BEDROCK_PATH]);
    check('Bedrock texture is the totem', same(Array.from(btex.data), pix));
    const bicon = await rgba(b['pack_icon.png']);
    check('pack_icon.png is the totem at 256x256', bicon.w === 256 && bicon.h === 256);
    const b2 = json(unzip((await download(page, '.tt-dl-btn')).file)['manifest.json']);
    check('downloading again keeps the uuids and raises the version', b2.header.uuid === manifest.header.uuid && b2.header.version.join() !== manifest.header.version.join(), `${manifest.header.version} -> ${b2.header.version}`);
    await shots(page, '8-bedrock');
    await page.click('.tt-ed-choice[data-value="java"]');

    // ---------------------------------------------------------------- other skin sources
    await page.click('.tt-change');
    await page.click('.tt-tab[data-source="username"]');
    await page.fill('.tt-user input', 'TotemFriend');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('.tt-chosen-name')?.textContent.trim() === 'TotemFriend', null, { timeout: 15000 });
    check('username lookup: the player’s skin is used', true);
    check('hand edits are replaced by the new skin', await page.isHidden('.tt-edited'));
    check('pack name keeps what the user typed', (await page.inputValue('.tt-name-field input')) === 'My Totem');

    await page.click('.tt-change');
    await page.click('.tt-tab[data-source="upload"]');
    await uploadSkin(page, skins.legacy);
    const notes = await page.textContent('.tt-chosen');
    check('legacy 64x32 skin: converted, with a note', /old 64×32 skin/.test(notes) && (await page.textContent('.tt-chosen-name')).trim() === 'old school', notes.trim().slice(0, 120));
    pix = await previewPixels(page);
    check('legacy skin: hat band over the face, mirrored left leg', same(px(pix, 4, 1), [250, 210, 40, 255]) && same(px(pix, 10, 14), PANTS) && same(px(pix, 14, 9), SKIN));

    await page.click('.tt-change');
    await page.click('.tt-tab[data-source="default"]');
    await page.waitForSelector('.tt-defaults .tt-skin-opt', { timeout: 180000 });
    const defaults = await page.$$eval('.tt-defaults .tt-skin-opt .tt-skin-name', (els) => els.map((e) => e.textContent));
    check('default skins listed from the game files', defaults.includes('Steve') && defaults.includes('Alex') && defaults.length === 9, defaults.join());
    await shots(page, '9-defaults');
    await page.click('.tt-defaults .tt-skin-opt[data-skin="steve-wide"]');
    await page.waitForFunction(() => document.querySelector('.tt-chosen-name')?.textContent.trim() === 'Steve');
    check('default skin chosen: Steve', true);

    // A saved skin project (made in the skin editor) shows under "My skins"
    await page.goto(base + 'skins');
    await page.setInputFiles('.sk-import .dropzone input[type=file]', skins.modern);
    await page.waitForURL(/skins\/[0-9a-f-]+\/?$/, { timeout: 30000 });
    await page.goto(base + 'totem-maker');
    await page.waitForSelector('.tt-dz');
    await page.click('.tt-tab[data-source="saved"]');
    await page.waitForSelector('.tt-saved .tt-skin-opt', { timeout: 15000 });
    await page.click('.tt-saved .tt-skin-opt');
    await page.waitForFunction(() => document.querySelector('.tt-chosen-name')?.textContent.trim() === 'Red Shirt');
    check('"My skins": a saved skin project can be used', true);

    // ---------------------------------------------------------------- phone width
    await page.setViewportSize({ width: 390, height: 844 });
    overflow = await noOverflow(page);
    check('no horizontal scroll at 390 px', overflow <= 0, `${overflow}px`);
    await page.click('.tt-change');
    for (const s of ['username', 'saved', 'default']) {
      await page.click(`.tt-tab[data-source="${s}"]`);
      overflow = await noOverflow(page);
      check(`phone: the ${s} tab fits`, overflow <= 0, `${overflow}px`);
    }
    await page.setViewportSize({ width: 1280, height: 860 });

    // ---------------------------------------------------------------- open in the texture tool
    await page.click('.tt-open-btn');
    await page.waitForURL(/textures\/[0-9a-f-]+\/?$/, { timeout: 15000 });
    await page.waitForFunction(() => !!window.__tx && document.querySelector('.tx-main'), null, { timeout: 180000 });
    const opened = await page.evaluate((p) => ({ name: window.__tx.store.project.name, version: window.__tx.store.project.version, edited: window.__tx.store.isEdited(p) }), JAVA_PATH);
    check('"Open in Texture Pack Maker" opens a project with the totem', opened.name === 'Red Shirt Totem' && opened.version === '26.3' && opened.edited, JSON.stringify(opened));
    await ctx.close();
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
