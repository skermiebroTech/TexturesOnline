// End-to-end test of project files (.tpmproject) and backups (.tpmbackup) in Chromium.
// Usage: NODE_PATH=$(npm root -g) TO_FIXTURES=<dir> node tests/e2e/projects/project-files.e2e.cjs [baseUrl] [--shots <dir>]
// In every editor (texture pack, skin, skin pack, shader, imported shader pack, cape, font): edit a
// project, save its project file, clear the browser's storage, open the file and check the project
// is exactly what was saved (records, files of imported packs, the cape and font drafts). Then a
// project file opened in the wrong editor, damaged and newer files, the home page's backup of
// everything with its reminder, and restoring it from the help page (all, then duplicates skipped,
// then kept both). The texture editor needs the 26.3 client jar from TO_FIXTURES (routed locally).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ROOT, startVite, launch, routeMojang, fixturesDir, unzip } = require('../textures/lib.cjs');
const { zipSync, strToU8, strFromU8 } = require(path.join(ROOT, 'node_modules/fflate'));

const argv = process.argv.slice(2);
const baseArg = argv.find((a) => /^https?:/.test(a));
const shotsDir = argv.includes('--shots') ? argv[argv.indexOf('--shots') + 1] : null;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tpm-projects-'));
if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** First differing path of two dumps (for failure details). */
function diff(a, b, at = '') {
  if (same(a, b)) return '';
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return `${at}: ${JSON.stringify(a)?.slice(0, 80)} != ${JSON.stringify(b)?.slice(0, 80)}`;
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const d = diff(a[k], b[k], `${at}.${k}`);
    if (d) return d;
  }
  return at;
}

// ---------------------------------------------------------------------------------------------
// Browser storage

/** Every project record (Blobs as type, size and hash), imported packs' files and edits, and the cape and font drafts. */
function dump(page) {
  return page.evaluate(async () => {
    const open = (name) =>
      new Promise((res, rej) => {
        const r = indexedDB.open(name);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    const all = (db) =>
      new Promise((res, rej) => {
        const out = {};
        const req = db.transaction('kv').objectStore('kv').openCursor();
        req.onsuccess = () => {
          const c = req.result;
          if (!c) return res(out);
          out[c.key] = c.value;
          c.continue();
        };
        req.onerror = () => rej(req.error);
      });
    const hex = async (buf) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buf)), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
    const plain = async (v) => {
      if (v instanceof Blob) return `blob:${v.type}:${v.size}:${await hex(await v.arrayBuffer())}`;
      if (v instanceof Uint8Array) return `bytes:${v.length}:${await hex(v)}`;
      if (Array.isArray(v)) return Promise.all(v.map(plain));
      if (v && typeof v === 'object') {
        const o = {};
        for (const k of Object.keys(v).sort()) if (v[k] !== undefined) o[k] = await plain(v[k]);
        return o;
      }
      return v;
    };
    const pdb = await open('to-projects');
    const projects = await all(pdb);
    pdb.close();
    const cdb = await open('to-cache');
    const cache = await all(cdb);
    cdb.close();
    const packs = {};
    for (const [k, v] of Object.entries(cache)) if (k.startsWith('packedit:')) packs[k] = await plain(v.files ?? v.edits);
    const cape = JSON.parse(localStorage.getItem('to-cape-maker') || 'null');
    const prefs = JSON.parse(localStorage.getItem('to-cape-maker-prefs') || '{}');
    return {
      projects: await plain(projects),
      packs,
      cape: cape && { png: cape.png, name: cape.name },
      capeSettings: { wear: prefs.wear, edition: prefs.edition, javaVersion: prefs.javaVersion, uuids: prefs.uuids, packVersion: prefs.packVersion },
      font: localStorage.getItem('to-font-maker-draft'),
    };
  });
}

/** Empties this browser's projects, imported packs and drafts (game files stay cached), on a page without an editor. */
async function clearStorage(page, base) {
  await page.goto(base + 'privacy');
  await page.waitForSelector('main h1');
  await page.evaluate(async () => {
    const open = (name) =>
      new Promise((res, rej) => {
        const r = indexedDB.open(name);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    const done = (tx) => new Promise((res, rej) => ((tx.oncomplete = res), (tx.onerror = () => rej(tx.error))));
    const pdb = await open('to-projects');
    const t1 = pdb.transaction('kv', 'readwrite');
    t1.objectStore('kv').clear();
    await done(t1);
    pdb.close();
    const cdb = await open('to-cache');
    const t2 = cdb.transaction('kv', 'readwrite');
    const st = t2.objectStore('kv');
    const req = st.openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return;
      if (String(c.key).startsWith('packedit:')) c.delete();
      c.continue();
    };
    await done(t2);
    cdb.close();
    const theme = localStorage.getItem('to-theme');
    localStorage.clear();
    if (theme) localStorage.setItem('to-theme', theme);
  });
}

async function download(page, click) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), click()]);
  const file = path.join(tmp, `${Date.now()}-${dl.suggestedFilename()}`);
  await dl.saveAs(file);
  return { file, name: dl.suggestedFilename() };
}

async function openWith(page, selector, file) {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 15000 }), page.click(selector)]);
  await chooser.setFiles(file);
}

async function toastText(page, re, timeout = 20000) {
  await page.waitForFunction((src) => [...document.querySelectorAll('.toast')].some((t) => new RegExp(src).test(t.textContent || '')), re.source, { timeout });
  return page.$$eval('.toast', (ts) => ts.map((t) => t.textContent).join(' | '));
}

function manifestOf(file) {
  const z = unzip(file);
  return { manifest: JSON.parse(strFromU8(z['manifest.json'])), entries: Object.keys(z) };
}

const idFromUrl = (url) => decodeURIComponent(url.replace(/\/$/, '').split('/').pop());

async function closeModals(page) {
  for (let i = 0; i < 4 && (await page.$('dialog[open]')); i++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }
}

// ---------------------------------------------------------------------------------------------
// Texture editor helpers (as in tests/e2e/textures/e2e.cjs)

async function waitTextureEditor(page) {
  await page.waitForFunction(() => !!window.__tx && document.querySelector('.tx-main'), null, { timeout: 120000 });
}
async function paintTexture(page, color, pixels) {
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

const skinApi = (page, fn, arg) =>
  page.evaluate(([f, a]) => new Function('e', 'a', `return (${f})(e, a)`)(document.querySelector('.sk-editor').__skinEditor, a), [fn.toString(), arg]);
async function waitSkinEditor(page) {
  await page.waitForSelector('.sk-editor .pc-root', { timeout: 20000 });
  await page.waitForFunction(() => !!document.querySelector('.sk-editor')?.__skinEditor);
  await page.waitForTimeout(300);
}
async function paintSkin(page, x, y) {
  const [cx, cy] = await skinApi(page, (e, [px, py]) => e.imageToClient(px, py), [x, y]);
  await page.mouse.click(cx, cy);
}

/** A tiny Iris pack: two programs with one option each (original test content). */
function irisPack() {
  const file = path.join(tmp, 'Tiny Iris.zip');
  fs.writeFileSync(
    file,
    zipSync({
      'shaders/shaders.properties': strToU8('screen=GLOW STRENGTH\nsliders=STRENGTH\n'),
      'shaders/final.fsh': strToU8('#version 120\n#define GLOW // glow on\n#define STRENGTH 2 //[1 2 3 4]\nvoid main() { gl_FragColor = vec4(1.0); }\n'),
      'shaders/final.vsh': strToU8('#version 120\nvoid main() { gl_Position = ftransform(); }\n'),
    }),
  );
  return file;
}

// ---------------------------------------------------------------------------------------------

(async () => {
  const server = baseArg ? null : await startVite();
  const base = baseArg || server.url;
  const fx = fixturesDir();
  console.log(`base ${base} · fixtures ${fx ?? '(none: the texture editor part is skipped)'} · tmp ${tmp}`);
  const browser = await launch();
  const errors = [];
  try {
    const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 900 } });
    await routeMojang(ctx, fx);
    await ctx.route(/playerdb\.co|textures\.minecraft\.net|mc-heads\.net/, (r) => r.abort());
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon|ERR_|404|Failed to load resource/.test(m.text())) errors.push(m.text());
    });
    const files = {};

    // ---------------------------------------------------------------- texture pack
    if (fx) {
      await page.goto(base + 'textures');
      await page.waitForSelector('.tx-new');
      check('texture start screen offers “Open a project file”', await page.isVisible('.tx-open [data-project-file="open"]'));
      await page.fill('.tx-name-field input', 'PF Pack');
      await page.click('.tx-create-btn');
      await page.waitForURL(/\/textures\/[0-9a-f-]+\/?$/, { timeout: 15000 });
      const texId = idFromUrl(page.url());
      await waitTextureEditor(page);
      await page.waitForSelector('.tx-tile.loaded', { timeout: 120000 });
      if (await page.isVisible('.tx-mb')) await page.click('.tx-mb .tx-libbar .segmented-item[data-value="textures"]');
      await page.fill('.tx-browser:not(.tx-mb) .tx-search-input', 'stone');
      await page.click('.tx-tile[data-path$="block/stone.png"]');
      await page.waitForFunction(() => window.__tx?.canvas.current()?.key.endsWith('block/stone.png'), null, { timeout: 60000 });
      await paintTexture(page, [255, 0, 0, 255], [[2, 2], [3, 2], [9, 11]]);
      await page.click('.tx-col-tabs .tab[data-value="effects"]');
      await page.click('.tx-preset[data-preset="dark-mode"]');
      await page.waitForSelector('.tx-preset-wrap.is-active .tx-preset[data-preset="dark-mode"]');
      await page.waitForSelector('.tx-save[data-state="saved"]', { timeout: 30000 });
      const f = await download(page, () => page.click('.tx-file-btn'));
      files.textures = f.file;
      check('texture editor saves a .tpmproject', f.name === 'PF Pack.tpmproject', f.name);
      const { manifest, entries } = manifestOf(f.file);
      check('the file says it is a texture pack project, with its id', manifest.format === 'texture-pack-maker' && manifest.version === 1 && manifest.tool === 'textures' && manifest.items[0]?.id === texId, JSON.stringify(manifest.items));
      check('the edited texture is a PNG at its pack path', entries.includes('items/0-texturepack/project/overrides/assets/minecraft/textures/block/stone.png'), entries.join(', '));
      check('no game files in the project file', entries.length <= 4, `${entries.length} entries`);
      const before = await dump(page);
      await clearStorage(page, base);
      await page.goto(base + 'textures');
      await page.waitForSelector('.tx-recent-empty');
      await openWith(page, '.tx-open [data-project-file="open"]', f.file);
      await page.waitForURL(new RegExp(`/textures/${texId}/?$`), { timeout: 20000 });
      await toastText(page, /Opened/);
      const after = await dump(page);
      check('texture pack opened from the file is identical (id, edits, effects, version, times)', same(before.projects, after.projects), diff(before.projects, after.projects));
      await waitTextureEditor(page);
      await page.waitForFunction(() => window.__tx?.store.project.overrides['assets/minecraft/textures/block/stone.png'], null, { timeout: 60000 });
      check('the editor shows the opened pack', (await page.evaluate(() => window.__tx.store.project.effects.length)) > 0);
      // the same file again: a copy next to it, nothing replaced
      await page.goto(base + 'textures');
      await page.waitForSelector('.tx-rc');
      await openWith(page, '.tx-open [data-project-file="open"]', f.file);
      const t = await toastText(page, /as a copy/);
      check('opening it again adds a copy and says so', /as a copy/.test(t), t);
      await page.waitForURL(/\/textures\/[0-9a-f-]+\/?$/);
      check('the copy has its own id', idFromUrl(page.url()) !== texId);
      await waitTextureEditor(page);
      const names = await page.evaluate(() => window.__tx.store.project.name);
      check('the copy is named as a copy', names === 'PF Pack (copy)', names);
    } else check('texture editor part skipped (no TO_FIXTURES)', true);

    // ---------------------------------------------------------------- skins and a skin pack
    await page.goto(base + 'skins');
    await page.click('.sk-starter-knight');
    await waitSkinEditor(page);
    const skinA = idFromUrl(page.url());
    await paintSkin(page, 9, 9);
    await skinApi(page, (e) => e.flush());
    await page.goto(base + 'skins');
    await page.click('.sk-starter-ninja');
    await waitSkinEditor(page);
    const skinB = idFromUrl(page.url());
    await paintSkin(page, 10, 10);
    await skinApi(page, (e) => e.flush());
    await page.click('.sk-export-btn');
    await page.click('.sk-export-item[data-kind="bedrock-pack"]');
    await page.waitForSelector('.sk-pack-list .sk-pack-skin:not(.is-current)');
    await page.click('.sk-pack-skin:not(.is-current)');
    await download(page, () => page.click('.modal-footer >> text=Download pack'));
    await closeModals(page);
    await skinApi(page, (e) => e.flush());
    await page.click('.sk-export-btn');
    const skinFile = await download(page, () => page.click('.sk-export-item:has-text("Save project file")'));
    files.skins = skinFile.file;
    const sm = manifestOf(skinFile.file).manifest;
    check('a skin with others in its Bedrock pack saves as a skin pack', sm.tool === 'skinpack' && same(sm.items.map((i) => i.id), [skinB, skinA]), JSON.stringify(sm.items));
    const skinsBefore = await dump(page);
    await clearStorage(page, base);
    await page.goto(base + 'skins');
    await page.waitForSelector('.sk-imports');
    await openWith(page, '.sk-imports [data-project-file="open"]', skinFile.file);
    await page.waitForURL(new RegExp(`/skins/${skinB}/?$`), { timeout: 20000 });
    await waitSkinEditor(page);
    const skinsAfter = await dump(page);
    const skinsOf = (d) => ({ a: d.projects[`project:${skinA}`], b: d.projects[`project:${skinB}`] });
    check('both skins come back identical, still one pack', !!skinsOf(skinsBefore).a && same(skinsOf(skinsBefore), skinsOf(skinsAfter)) && Object.keys(skinsAfter.projects).length === 2, diff(skinsOf(skinsBefore), skinsOf(skinsAfter)));

    // ---------------------------------------------------------------- shader (generator)
    await page.goto(base + 'shaders');
    await page.click('.sh-card[data-target="iris"] .sh-card-start');
    await page.waitForSelector('.sh-new .sh-preset');
    await page.click('.sh-new .sh-preset[data-preset="cinematic"]');
    await page.fill('.sh-new input.input', 'PF Shader');
    await page.getByRole('button', { name: 'Create pack' }).click();
    await page.waitForSelector('.sh-editor');
    const shaderId = idFromUrl(page.url());
    const num = page.locator('[data-option="sunStrength"] input[type="number"]');
    await num.scrollIntoViewIfNeeded();
    await num.fill('1.7');
    await num.press('Enter');
    await page.waitForFunction(() => document.querySelector('.sh-save')?.dataset.state === 'saved', null, { timeout: 15000 });
    const shaderFile = await download(page, () => page.click('.sh-file-btn'));
    files.shaders = shaderFile.file;
    check('shader editor saves a .tpmproject', shaderFile.name === 'PF Shader.tpmproject', shaderFile.name);
    const shaderBefore = (await dump(page)).projects[`project:${shaderId}`];
    await clearStorage(page, base);
    await page.goto(base + 'shaders');
    await page.waitForSelector('.pe-open');
    await openWith(page, '.pe-open [data-project-file="open"]', shaderFile.file);
    await page.waitForURL(new RegExp(`/shaders/${shaderId}/?$`), { timeout: 20000 });
    const shaderAfter = (await dump(page)).projects[`project:${shaderId}`];
    check('shader project comes back with its settings', !!shaderBefore && shaderAfter?.settings?.sunStrength === 1.7 && same(shaderBefore, shaderAfter), diff(shaderBefore, shaderAfter));

    // ---------------------------------------------------------------- imported shader pack
    await page.goto(base + 'shaders');
    await page.waitForSelector('.pe-open-drop');
    await page.setInputFiles('.pe-open-drop input[type=file]', irisPack());
    await page.waitForSelector('.pe-editor', { timeout: 60000 });
    const packId = idFromUrl(page.url());
    await page.locator('.pe-tabs .tab[data-value="files"]').click();
    await page.waitForSelector('.pe-files-layout');
    await page.fill('.pe-tree-tools input', 'final.fsh');
    await page.locator('.pe-files.is-flat .pe-file').first().click();
    await page.waitForFunction(() => document.querySelector('.pe-code-path')?.textContent === 'shaders/final.fsh');
    await page.locator('.pe-textarea').click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type('\n// edited for the project file test');
    await page.waitForFunction(() => Boolean(document.querySelector('.pe-files.is-flat .pe-file.is-edited')));
    await page.waitForFunction(() => document.querySelector('.sh-save')?.dataset.state === 'saved', null, { timeout: 15000 });
    const packFile = await download(page, () => page.click('.sh-file-btn'));
    files.pack = packFile.file;
    const pe = manifestOf(packFile.file).entries;
    check('an imported pack’s project file holds its own files', pe.includes('items/0-shader/files/shaders/final.fsh') && pe.includes('items/0-shader/files/shaders/shaders.properties'), pe.join(', '));
    const packBefore = await dump(page);
    await clearStorage(page, base);
    await page.goto(base + 'shaders');
    await page.waitForSelector('.pe-open');
    await openWith(page, '.pe-open [data-project-file="open"]', packFile.file);
    await page.waitForURL(new RegExp(`/shaders/${packId}/?$`), { timeout: 20000 });
    await page.waitForSelector('.pe-editor', { timeout: 60000 });
    const packAfter = await dump(page);
    check('imported pack comes back with its files and the edit', same(packBefore.packs, packAfter.packs) && Object.keys(packAfter.packs).length === 2, diff(packBefore.packs, packAfter.packs));
    const packRecord = (d) => d.projects[`project:${packId}`];
    check('imported pack record is identical', !!packRecord(packBefore) && same(packRecord(packBefore), packRecord(packAfter)), diff(packRecord(packBefore), packRecord(packAfter)));
    await page.locator('.pe-tabs .tab[data-value="files"]').click();
    await page.waitForSelector('.pe-files .pe-file.is-edited');
    check('the pack editor shows the edited file', true);

    // ---------------------------------------------------------------- cape
    await page.goto(base + 'cape-maker');
    await page.waitForSelector('.cm-design');
    await page.locator('.cm-design').nth(3).click();
    await page.fill('.cm-name-input', 'PF Cape');
    await page.click('.cm-download .segmented-item[data-value="bedrock"]');
    await page.evaluate(() => document.querySelector('.cm').__capeMaker.flush());
    const capeHash = () => page.evaluate(async () => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', document.querySelector('.cm').__capeMaker.getImage().data)), (b) => b.toString(16).padStart(2, '0')).join(''));
    const capeImage = await capeHash();
    const capeFile = await download(page, () => page.click('.cm-file-btn'));
    files.cape = capeFile.file;
    check('cape maker saves a .tpmproject', capeFile.name === 'PF Cape.tpmproject' && manifestOf(capeFile.file).manifest.tool === 'cape', capeFile.name);
    const capeBefore = await dump(page);
    await clearStorage(page, base);
    await page.goto(base + 'cape-maker');
    await page.waitForSelector('.cm-design');
    check('after clearing, the cape maker starts over', (await capeHash()) !== capeImage);
    await openWith(page, '.cm-open-file-btn', capeFile.file);
    await toastText(page, /PF Cape/);
    await page.evaluate(() => document.querySelector('.cm').__capeMaker.flush());
    await page.waitForTimeout(200);
    const capeAfter = await dump(page);
    check('the cape comes back identical, with its name', (await capeHash()) === capeImage && (await page.inputValue('.cm-name-input')) === 'PF Cape');
    check('the cape’s stored copy and pack settings are identical', same(capeBefore.cape, capeAfter.cape) && same(capeBefore.capeSettings, capeAfter.capeSettings) && capeAfter.capeSettings.edition === 'bedrock', diff(capeBefore, capeAfter));
    // a cape of the user's is never replaced without asking
    await page.locator('.cm-design').nth(1).click();
    await openWith(page, '.cm-open-file-btn', capeFile.file);
    await page.waitForSelector('dialog[open].pf-modal');
    check('opening a cape over another one asks first', /Replace your cape/.test(await page.textContent('dialog[open] .modal-title')));
    if (shotsDir) await page.screenshot({ path: path.join(shotsDir, 'cape-replace-1440-dark.png') });
    await page.click('dialog[open] .modal-footer >> text=Replace');
    const replaced = await page
      .waitForFunction(async (want) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', document.querySelector('.cm').__capeMaker.getImage().data)), (b) => b.toString(16).padStart(2, '0')).join('') === want, capeImage, { timeout: 10000 })
      .then(() => true, () => false);
    check('…and replaces it when told to', replaced);

    // ---------------------------------------------------------------- font
    await page.goto(base + 'font-maker');
    await page.waitForSelector('.fm-style');
    await page.click('.fm-style[data-style="bold"]');
    await page.click('.fm-ed-choice[data-value="bedrock"]');
    await page.fill('.fm-name-field input', 'PF Font');
    await page.waitForTimeout(900);
    const fontFile = await download(page, () => page.click('.fm-file-btn'));
    files.fonts = fontFile.file;
    check('font maker saves a .tpmproject', manifestOf(fontFile.file).manifest.tool === 'fonts', fontFile.name);
    const fontBefore = await dump(page);
    await clearStorage(page, base);
    await page.goto(base + 'font-maker');
    await page.waitForSelector('.fm-style');
    await page.click('.fm-tab[data-source="pack"]');
    await openWith(page, '.fm-pack [data-project-file="open"]', fontFile.file);
    await toastText(page, /opened/i);
    await page.waitForTimeout(900);
    const fontAfter = await dump(page);
    check('the font comes back identical (glyphs, size, space)', !!fontBefore.font && fontBefore.font === fontAfter.font, `${fontBefore.font?.length} / ${fontAfter.font?.length}`);
    check('…with its pack name and edition', (await page.inputValue('.fm-name-field input')) === 'PF Font' && (await page.getAttribute('.fm-ed-choice[data-value="bedrock"]', 'aria-checked')) === 'true');

    // ---------------------------------------------------------------- wrong editor, damaged and newer files
    await page.goto(base + 'textures');
    await page.waitForSelector('.tx-open-dz');
    await page.setInputFiles('.tx-open-dz input[type=file]', files.skins);
    await page.waitForURL(/\/skins\/[0-9a-f-]+\/?$/, { timeout: 20000 });
    check('a skin project dropped on the texture pack maker opens in the skin editor', true, page.url());
    const notZip = path.join(tmp, 'notes.tpmproject');
    fs.writeFileSync(notZip, 'hello');
    const noManifest = path.join(tmp, 'pack.tpmproject');
    fs.writeFileSync(noManifest, zipSync({ 'pack.mcmeta': strToU8('{}') }));
    const newer = path.join(tmp, 'future.tpmproject');
    fs.writeFileSync(newer, zipSync({ 'manifest.json': strToU8(JSON.stringify({ format: 'texture-pack-maker', version: 99, tool: 'skins', items: [] })) }));
    for (const [file, re, what] of [
      [notZip, /isn't a project file/, 'a file that is not a zip'],
      [noManifest, /isn't a Texture Pack Maker project file/, 'a zip that is not a project'],
      [newer, /newer version of Texture Pack Maker \(format 99\)/, 'a file from a newer version'],
    ]) {
      await page.goto(base + 'skins');
      await page.waitForSelector('.sk-imports');
      await openWith(page, '.sk-imports [data-project-file="open"]', file);
      const msg = await toastText(page, re).catch(() => '');
      check(`${what} is refused with a clear message`, re.test(msg), msg);
    }

    // ---------------------------------------------------------------- back up everything (home), restore (help)
    // Every editor's project back in this browser (each part above cleared the others): opened by
    // dropping its file on the texture pack maker's drop zone, which sends it to its own editor.
    for (const f of [files.textures, files.skins, files.shaders, files.pack].filter(Boolean)) {
      await page.goto(base + 'textures');
      await page.waitForSelector('.tx-open-dz');
      await page.setInputFiles('.tx-open-dz input[type=file]', f);
      await page.waitForURL(/\/(textures|skins|shaders)\/[0-9a-f-]+\/?$/, { timeout: 20000 });
      await page.waitForTimeout(500);
    }
    await page.goto(base + 'cape-maker');
    await page.waitForSelector('.cm-design');
    await openWith(page, '.cm-open-file-btn', files.cape);
    await page.waitForFunction(() => document.querySelector('.cm-name-input')?.value === 'PF Cape');
    await page.evaluate(() => document.querySelector('.cm').__capeMaker.flush());
    await page.goto(base);
    await page.waitForSelector('.recent-card', { timeout: 20000 });
    check('home shows the reminder that projects live only in this browser', await page.isVisible('.recent-reminder'));
    if (shotsDir) await page.locator('.recent').screenshot({ path: path.join(shotsDir, 'home-projects-1440-dark.png') });
    await page.click('.recent-backup');
    await page.waitForSelector('dialog[open] .pf-summary li .pf-type-icon');
    const summary = await page.$$eval('dialog[open] .pf-summary li', (els) => els.map((e) => e.textContent.trim()));
    check('the backup dialog says what goes in', summary.some((s) => /skins?$/.test(s)) && summary.includes('Your cape') && summary.includes('Your font'), summary.join(' | '));
    if (shotsDir) await page.screenshot({ path: path.join(shotsDir, 'backup-1440-dark.png') });
    const backup = await download(page, () => page.click('dialog[open] .modal-footer >> text=Download backup'));
    check('the backup is a dated .tpmbackup', /^Texture Pack Maker backup \d{4}-\d\d-\d\d\.tpmbackup$/.test(backup.name), backup.name);
    await page.waitForFunction(() => document.querySelector('.recent-reminder')?.hidden === true);
    check('the reminder goes away after a backup', true);
    const everything = await dump(page);
    const projectCount = Object.keys(everything.projects).length;
    const bm = manifestOf(backup.file).manifest;
    check('the backup holds every project, the cape and the font', bm.tool === 'backup' && bm.items.length === projectCount + 2, `${bm.items.length} items, ${projectCount} projects`);

    await clearStorage(page, base);
    await page.goto(base + 'help?s=backup');
    await page.waitForSelector('#help-backup [data-backup="open"]');
    await openWith(page, '#help-backup [data-backup="open"]', backup.file);
    await page.waitForSelector('dialog[open].pf-restore-modal .pf-row');
    const rows = await page.$$eval('dialog[open] .pf-row', (els) => els.map((e) => ({ type: e.dataset.type, checked: e.querySelector('input').checked })));
    check('the restore dialog lists everything, all ticked', rows.length === bm.items.length && rows.every((r) => r.checked), JSON.stringify(rows));
    check('nothing is marked as already here', (await page.$$('dialog[open] .pf-row-tag:not([hidden])')).length === 0);
    if (shotsDir) await page.screenshot({ path: path.join(shotsDir, 'restore-1440-dark.png') });
    await page.click('dialog[open] .modal-footer .btn-primary');
    const restored = await toastText(page, /Restored \d+ projects/);
    check('restoring says how many came back', new RegExp(`Restored ${bm.items.length} projects`).test(restored), restored);
    const back = await dump(page);
    check('every project is back exactly as it was', same(everything.projects, back.projects), diff(everything.projects, back.projects));
    check('imported pack files are back', same(everything.packs, back.packs));
    check('the cape and the font are back', same(everything.cape, back.cape) && same(everything.capeSettings, back.capeSettings) && everything.font === back.font, diff(everything, back));

    // the same backup again: projects already here are skipped, or kept both
    await page.goto(base + 'help?s=backup');
    await page.waitForSelector('#help-backup [data-backup="open"]');
    await openWith(page, '#help-backup [data-backup="open"]', backup.file);
    await page.waitForSelector('dialog[open] .pf-existing:not([hidden])');
    const disabled = await page.$eval('dialog[open] .modal-footer .btn-primary', (b) => b.disabled);
    check('a second restore skips everything already here', disabled && (await page.$$('dialog[open] .pf-row-tag:not([hidden])')).length === bm.items.length);
    await page.click('dialog[open] .pf-existing .segmented-item[data-value="copy"]');
    const label = await page.textContent('dialog[open] .modal-footer .btn-primary');
    check('“Keep both” picks the projects (not the cape and font)', new RegExp(`Restore ${projectCount} projects`).test(label ?? ''), label);
    if (shotsDir) await page.screenshot({ path: path.join(shotsDir, 'restore-again-1440-dark.png') });
    await page.click('dialog[open] .modal-footer .btn-primary');
    await toastText(page, new RegExp(`Restored ${projectCount} projects`));
    const doubled = await dump(page);
    check('“Keep both” adds copies next to the projects', Object.keys(doubled.projects).length === projectCount * 2);
    check('…and leaves the ones already here untouched', Object.entries(everything.projects).every(([k, v]) => same(doubled.projects[k], v)));

    // phone width, light theme: the dialogs
    if (shotsDir) {
      for (const [w, h, theme] of [[390, 844, 'light'], [390, 844, 'dark'], [1280, 860, 'light']]) {
        const c2 = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: theme, acceptDownloads: true });
        await c2.addInitScript((t) => localStorage.setItem('to-theme', t), theme);
        const p2 = await c2.newPage();
        await p2.goto(base + 'help?s=backup');
        await p2.waitForSelector('#help-backup [data-backup="open"]');
        await openWith(p2, '#help-backup [data-backup="open"]', backup.file);
        await p2.waitForSelector('dialog[open] .pf-row');
        await p2.waitForTimeout(400);
        await p2.screenshot({ path: path.join(shotsDir, `restore-${w}-${theme}.png`) });
        await closeModals(p2);
        await p2.click('#help-backup [data-backup="all"]');
        await p2.waitForSelector('dialog[open] .pf-summary');
        await p2.waitForTimeout(400);
        await p2.screenshot({ path: path.join(shotsDir, `backup-${w}-${theme}.png`) });
        await c2.close();
      }
    }

    check('no page errors', errors.length === 0, errors.join(' | '));
    await ctx.close();
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
