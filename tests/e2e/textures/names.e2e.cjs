// End-to-end checks of name-based textures (an item renamed in an anvil gets its own texture): the
// window opens from the texture's menu, the preview's Names button and the names under the texture
// header; a look is made from typed names, painted, renamed, given a 3D shape in the model editor,
// removed and brought back with Undo; the Java 26.3 zip has the item definition that picks it by name
// (over the model editor's own) and the Java 1.21.4 zip OptiFine CIT properties instead; the 1.21.4
// zip opens again with its look; Bedrock says it can't; a phone layout without sideways scrolling;
// light and dark themes; no console errors. Java 1.21.4 needs its jar and version JSON in
// TO_FIXTURES/research-cache, Bedrock the network (bedrock-samples on GitHub).
// Usage: NODE_PATH=$(npm root -g) TO_FIXTURES=<dir> node tests/e2e/textures/names.e2e.cjs [baseUrl] [--shots <dir>] [--no-bedrock]
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startVite, launch, routeMojang, fixturesDir, unzip, decodePng } = require('./lib.cjs');

const argv = process.argv.slice(2);
const baseArg = argv.find((a) => /^https?:/.test(a));
const shotsDir = argv.includes('--shots') ? argv[argv.indexOf('--shots') + 1] : null;
const doBedrock = !argv.includes('--no-bedrock');
if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tx-names-'));
const J = 'assets/minecraft/textures/';
const SWORD = `${J}item/diamond_sword.png`;
const LOOK = `${J}item/names/diamond_sword/excalibur.png`;

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
const text = (bytes) => Buffer.from(bytes).toString('latin1');

/** Serves a Java version's JSON and client jar (with Range) from the research fixtures. */
async function routeVersion(context, fx, version) {
  if (!fx) return false;
  const vj = path.join(fx, 'research-cache', 'version-json', `${version}.json`);
  const jar = path.join(fx, 'research-cache', 'jars', `${version}.jar`);
  if (!fs.existsSync(vj) || !fs.existsSync(jar)) return false;
  const info = JSON.parse(fs.readFileSync(vj, 'utf8'));
  const size = fs.statSync(jar).size;
  const fd = fs.openSync(jar, 'r');
  const cors = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range, content-length, accept-ranges' };
  await context.route(new RegExp(`^https://piston-meta\\.mojang\\.com/v1/packages/[0-9a-f]+/${version.replace(/\./g, '\\.')}\\.json$`), (r) => r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: fs.readFileSync(vj) }));
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

async function openTexture(page, p) {
  await page.evaluate((x) => window.__tx.open(x), p);
  await page.waitForFunction((x) => window.__tx.canvas.current()?.key === x, p, { timeout: 30000 });
}

/** The window from the texture's ⋮ menu. */
async function namesFromMenu(page) {
  await page.click('.tx-head-actions .icon-btn:last-child');
  await page.click('[role=menuitem]:has-text("Name-based textures")');
  await page.waitForSelector('.nm-modal .nm-head, .nm-modal .nm-note', { timeout: 60000 });
  await page.waitForTimeout(300);
}

/** Types names into the open names box and makes the look. */
async function createLook(page, names) {
  for (const n of names) {
    await page.fill('.nm-form .nm-input', n);
    await page.press('.nm-form .nm-input', 'Enter');
  }
  await page.click('.nm-create');
  await page.waitForSelector('.nm-modal', { state: 'detached' });
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

async function exportZip(page) {
  await page.waitForSelector('.tx-save[data-state="saved"]', { timeout: 30000 });
  await page.click('.tx-export-btn');
  await page.waitForSelector('.tx-export-modal .tx-exp-rows');
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 300000 }), page.click('.tx-export-modal .btn-primary:has-text("Export .zip")')]);
  const file = path.join(tmp, `${Date.now()}-${download.suggestedFilename()}`);
  await download.saveAs(file);
  await page.waitForSelector('.tx-exp-done', { timeout: 60000 });
  const warnings = await page.$$eval('.tx-exp-warnings li', (l) => l.map((x) => x.textContent));
  await page.click('.tx-export-modal .btn-primary:has-text("Done")');
  return { zip: unzip(file), warnings, file };
}

const looks = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__tx.store.project.nameVariants ?? {})));

(async () => {
  const fx = fixturesDir();
  const vite = baseArg ? null : await startVite();
  const base = baseArg ?? vite.url;
  const browser = await launch();
  const errors = [];
  const watch = (page) => {
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text())) errors.push(m.text());
    });
  };
  try {
    // ------------------------------------------------------------------ Java 26.3
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, colorScheme: 'dark', acceptDownloads: true });
    await routeMojang(ctx, fx);
    const page = await ctx.newPage();
    watch(page);
    await newPack(page, base, { name: 'E2E Names' });
    await openTexture(page, SWORD);
    const before = await page.evaluate(() => [...performance.getEntriesByType('resource')].filter((r) => /names\/dialog/.test(r.name)).length);
    check('the names window loads only when it opens', before === 0, `${before} files`);
    await namesFromMenu(page);
    check('the texture menu opens the window for the Diamond Sword', (await page.textContent('.nm-head-name')) === 'Diamond Sword');
    check('26.3: works without mods (1.21.5+)', /1\.21\.5 and newer, no mods/.test(await page.textContent('.nm-note')));
    check('no looks yet: the form to add one is open', await page.isVisible('.nm-form .nm-input'));
    await shot(page, 'names-new-1280-dark');
    // an empty name and a § are handled
    await page.click('.nm-create');
    check('an empty name is not taken', /Type a name first/.test(await page.textContent('.nm-msg')));
    await page.fill('.nm-form .nm-input', '§bExcalibur');
    await page.press('.nm-form .nm-input', 'Enter');
    check('colour codes are left out of a name', (await page.textContent('.nm-chips')).includes('bExcalibur') && /Colour codes/.test(await page.textContent('.nm-msg')));
    await page.click('.nm-chip-x');
    await page.fill('.nm-form .nm-input', 'Excalibur');
    await page.press('.nm-form .nm-input', 'Enter');
    await page.fill('.nm-form .nm-input', 'Excalibur');
    await page.press('.nm-form .nm-input', 'Enter');
    check('the same name twice is refused', /already has a texture/.test(await page.textContent('.nm-msg')));
    await page.fill('.nm-form .nm-input', 'Sword of Light');
    await shot(page, 'names-adding-1280-dark');
    await page.click('.nm-create');
    await page.waitForSelector('.nm-modal', { state: 'detached' });
    await page.waitForFunction((p) => window.__tx.canvas.current()?.key === p, LOOK, { timeout: 30000 });
    let v = await looks(page);
    check('the look is made with both names (the one still typed too)', JSON.stringify(v['diamond_sword/excalibur']?.names) === JSON.stringify(['Excalibur', 'Sword of Light']), JSON.stringify(v));
    check('its texture opens to paint, named after the name', (await page.textContent('.tx-head-title')) === 'Excalibur');
    check('it starts as a copy of the sword', JSON.stringify(await page.evaluate(() => window.__tx.pixel(13, 2))) !== JSON.stringify([0, 0, 0, 0]));
    check('the row under the header says what it is for', /For a Diamond Sword named “Excalibur” or “Sword of Light”/.test(await page.textContent('.tx-names-for')));
    await paintAt(page, 0, 0, [255, 0, 0, 255]);
    check('painting the look', JSON.stringify(await page.evaluate(() => window.__tx.pixel(0, 0))) === JSON.stringify([255, 0, 0, 255]));
    await shot(page, 'names-painting-1280-dark');

    // the item: its looks under the header and the preview's Names button
    await openTexture(page, SWORD);
    await page.waitForSelector('.tx-names-chip', { timeout: 30000 });
    check('the sword lists its look under the header', (await page.textContent('.tx-names-chip')).includes('Excalibur'));
    check('the sword itself is unchanged', JSON.stringify(await page.evaluate(() => window.__tx.pixel(0, 0))) !== JSON.stringify([255, 0, 0, 255]));
    await page.evaluate(() => window.__tx.models.load());
    await page.evaluate(() => window.__tx.preview.showEntry(window.__tx.models.lib.item('diamond_sword')));
    await page.waitForSelector('.tx-pv-namesbtn:not([hidden])', { timeout: 30000 });
    check('the preview’s Names button counts the looks', (await page.textContent('.tx-pv-namesbtn .tx-pv-shapebadge')) === '1');
    await page.click('.tx-pv-namesbtn');
    await page.waitForSelector('.nm-modal .nm-look');
    check('the window lists the look as tooltips', (await page.$$eval('.nm-look .nm-tip', (l) => l.map((x) => x.textContent))).join('|') === 'Excalibur|Sword of Light');
    await shot(page, 'names-list-1280-dark');

    // change the names
    await page.click('.nm-look .nm-names');
    await page.click('.nm-look .nm-chip:has-text("Sword of Light") .nm-chip-x');
    await page.fill('.nm-look .nm-input', 'Caliburn');
    await page.press('.nm-look .nm-input', 'Enter');
    await page.click('.nm-look .btn-primary:has-text("Save")');
    v = await looks(page);
    check('names changed', JSON.stringify(v['diamond_sword/excalibur'].names) === JSON.stringify(['Excalibur', 'Caliburn']));

    // a second look, removed and brought back
    await page.click('.nm-add-btn');
    await createLook(page, ['Shadow']);
    check('a second look', Object.keys(await looks(page)).length === 2);
    await openTexture(page, SWORD);
    await page.evaluate(() => window.__tx.names());
    await page.waitForSelector('.nm-modal .nm-look[data-id="diamond_sword/shadow"]');
    await page.click('.nm-look[data-id="diamond_sword/shadow"] .nm-remove');
    await page.click('dialog[open] .btn-danger');
    await page.waitForFunction(() => !window.__tx.store.project.nameVariants['diamond_sword/shadow']);
    check('removing deletes its texture', await page.evaluate(() => !window.__tx.store.project.overrides['assets/minecraft/textures/item/names/diamond_sword/shadow.png']));
    await page.click('.toast .toast-actions .btn:has-text("Undo")');
    await page.waitForFunction(() => !!window.__tx.store.project.nameVariants['diamond_sword/shadow']);
    check('Undo brings it back with its texture', await page.evaluate(() => !!window.__tx.store.project.overrides['assets/minecraft/textures/item/names/diamond_sword/shadow.png']));
    await page.click('.nm-look[data-id="diamond_sword/shadow"] .nm-remove');
    await page.click('dialog[open] .btn-danger');
    await page.waitForFunction(() => !window.__tx.store.project.nameVariants['diamond_sword/shadow']);

    // a 3D shape for the look
    await page.click('.nm-look[data-id="diamond_sword/excalibur"] .nm-shape');
    await page.waitForSelector('.me-root', { timeout: 60000 });
    check('the model editor opens the look', (await page.textContent('.me-title-name')).includes('“Excalibur”'));
    await page.click('.me-preset[data-preset="sprite3d"]');
    await page.waitForTimeout(900);
    await shot(page, 'names-shape-1280-dark');
    await page.click('.me-back');
    await page.waitForSelector('.me-root', { state: 'detached' });
    const shape = await page.evaluate(async () => JSON.parse(await window.__tx.store.project.extraFiles['assets/minecraft/models/item/names/diamond_sword/excalibur.json'].text()));
    check('the look’s model has cubes now', Array.isArray(shape.elements) && shape.elements.length > 0);
    // the sword itself gets a shape too ("flat in the inventory"): the look goes in front of it
    await page.evaluate(() => window.__tx.editModel('item', 'diamond_sword'));
    await page.waitForSelector('.me-root', { timeout: 60000 });
    await page.click('.me-preset[data-preset="sprite3d"]');
    await page.waitForTimeout(900);
    await page.click('.me-back');
    await page.waitForSelector('.me-root', { state: 'detached' });

    const ex = await exportZip(page);
    const def = ex.zip['assets/minecraft/items/diamond_sword.json'] && json(ex.zip['assets/minecraft/items/diamond_sword.json']);
    check('26.3 zip: the item definition picks the look by name', def?.model?.type === 'minecraft:select' && def.model.property === 'minecraft:component' && def.model.component === 'minecraft:custom_name', JSON.stringify(def));
    check('26.3 zip: the names and the look’s model', JSON.stringify(def?.model?.cases) === JSON.stringify([{ when: ['Excalibur', 'Caliburn'], model: { type: 'minecraft:model', model: 'minecraft:item/names/diamond_sword/excalibur' } }]), JSON.stringify(def?.model?.cases));
    check('26.3 zip: anything else shows the sword’s own (edited) model', JSON.stringify(def?.model?.fallback ?? '').includes('diamond_sword'), JSON.stringify(def?.model?.fallback));
    const lookPng = ex.zip[LOOK] && (await decodePng(ex.zip[LOOK]));
    check('26.3 zip: the painted texture', !!lookPng && lookPng.data[0] === 255 && lookPng.data[1] === 0);
    check('26.3 zip: the look’s 3D model', Array.isArray(json(ex.zip['assets/minecraft/models/item/names/diamond_sword/excalibur.json']).elements));
    check('26.3 zip: no OptiFine files, no removed look', !Object.keys(ex.zip).some((k) => k.includes('optifine') || k.includes('shadow')));
    check('26.3 zip: no warnings about names', !ex.warnings.some((w) => /name-based/.test(w)), ex.warnings.join(' | '));

    // light theme and a phone
    await page.emulateMedia({ colorScheme: 'light' });
    await openTexture(page, SWORD);
    await page.evaluate(() => window.__tx.names());
    await page.waitForSelector('.nm-modal .nm-look');
    await shot(page, 'names-list-1280-light');
    await page.click('.nm-modal .modal-footer .btn');
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark' });
    await routeMojang(phone, fx);
    const pp = await phone.newPage();
    watch(pp);
    await newPack(pp, base, { name: 'E2E Names phone' });
    await openTexture(pp, SWORD);
    await namesFromMenu(pp);
    check('phone: no sideways scrolling in the window', await noSideScroll(pp));
    await shot(pp, 'names-new-390-dark');
    await createLook(pp, ['Excalibur', 'Sword of Light']);
    await pp.waitForTimeout(500);
    check('phone: the look opens on the Paint tab', (await pp.getAttribute('.tx-tabbar-btn[data-v="editor"]', 'aria-current')) === 'page');
    check('phone: the row under the header fits', await pp.$eval('.tx-names-edit', (b) => b.getBoundingClientRect().right <= window.innerWidth));
    await shot(pp, 'names-painting-390-dark');
    await openTexture(pp, SWORD);
    await pp.evaluate(() => window.__tx.names());
    await pp.waitForSelector('.nm-modal .nm-look');
    check('phone: the list fits', await noSideScroll(pp));
    await shot(pp, 'names-list-390-dark');
    await pp.emulateMedia({ colorScheme: 'light' });
    await shot(pp, 'names-list-390-light');
    await phone.close();

    // ------------------------------------------------------------------ Java 1.21.4: OptiFine CIT
    const has1214 = await routeVersion(ctx, fx, '1.21.4');
    await page.emulateMedia({ colorScheme: 'dark' });
    await newPack(page, base, { name: 'E2E Names 1214', version: '1.21.4' });
    check('Java 1.21.4 loads (fixtures: ' + (has1214 ? 'local jar' : 'network') + ')', (await page.textContent('.tx-bar-sub')).includes('1.21.4'));
    await openTexture(page, SWORD);
    await namesFromMenu(page);
    check('1.21.4: needs OptiFine or CIT Resewn', /Needs OptiFine or the CIT Resewn mod/.test(await page.textContent('.nm-note')));
    await shot(page, 'names-optifine-1280-dark');
    await createLook(page, ['Excalibur']);
    await paintAt(page, 1, 1, [0, 255, 0, 255]);
    const old = await exportZip(page);
    const props = old.zip['assets/minecraft/optifine/cit/names/diamond_sword/excalibur.properties'];
    check('1.21.4 zip: a CIT properties file', !!props);
    const p = props ? text(props) : '';
    check('1.21.4 zip: type, item, texture and name', /^type=item$/m.test(p) && /^items=diamond_sword$/m.test(p) && /^texture=textures\/item\/names\/diamond_sword\/excalibur\.png$/m.test(p) && /^components\.custom_name=Excalibur$/m.test(p), p);
    const oldDef = old.zip['assets/minecraft/items/diamond_sword.json'];
    check('1.21.4 zip: no item definition picking by name', !oldDef || !JSON.stringify(json(oldDef)).includes('custom_name'));
    check('1.21.4 zip: the texture', !!old.zip[LOOK]);
    check('1.21.4: the export says it needs OptiFine', old.warnings.some((w) => /needs OptiFine or the CIT Resewn mod/.test(w)), old.warnings.join(' | '));

    // the 1.21.4 zip opens again with its look
    const ip = await ctx.newPage();
    watch(ip);
    await ip.goto(base + '#/textures');
    await ip.waitForSelector('.tx-open-dz');
    await ip.setInputFiles('.tx-open-dz input[type=file]', old.file);
    await ip.waitForFunction(() => /textures\/[0-9a-f-]+\/?$/.test(location.href) || document.querySelector('dialog[open] .btn-primary'), null, { timeout: 60000 });
    const warn = await ip.$('dialog[open] .btn-primary');
    if (warn) await warn.click();
    await ip.waitForURL(/(#\/|\/)textures\/[0-9a-f-]+\/?$/, { timeout: 60000 });
    await ip.waitForFunction(() => !!window.__tx && document.querySelector('.tx-main'), null, { timeout: 180000 });
    const opened = await looks(ip);
    check('opened 1.21.4 pack: its look is back', JSON.stringify(Object.values(opened).map((x) => [x.item, x.names])) === JSON.stringify([['diamond_sword', ['Excalibur']]]), JSON.stringify(opened));
    check('opened pack: the CIT file became the look', await ip.evaluate(() => !Object.keys(window.__tx.store.project.extraFiles).some((k) => k.endsWith('.properties'))));
    await openTexture(ip, SWORD);
    await ip.waitForSelector('.tx-names-chip', { timeout: 60000 });
    await ip.click('.tx-names-chip');
    await ip.waitForFunction((x) => window.__tx.canvas.current()?.key === x, LOOK);
    check('opened pack: the look’s painted texture', JSON.stringify(await ip.evaluate(() => window.__tx.pixel(1, 1))) === JSON.stringify([0, 255, 0, 255]));
    await ip.close();

    // ------------------------------------------------------------------ Bedrock
    if (doBedrock) {
      await newPack(page, base, { name: 'E2E Names Bedrock', bedrock: true });
      await openTexture(page, 'textures/items/diamond_sword.png');
      await namesFromMenu(page);
      check('Bedrock: says it can’t, and offers nothing to add', /Bedrock Edition can’t do this/.test(await page.textContent('.nm-note')) && !(await page.$('.nm-form, .nm-add-btn')));
      await shot(page, 'names-bedrock-1280-dark');
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
  console.log(failures ? `\n${failures} check(s) failed` : '\nAll name-based texture checks passed');
  process.exit(failures ? 1 : 0);
})();
