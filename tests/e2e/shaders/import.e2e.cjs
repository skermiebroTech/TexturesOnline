// End-to-end test of opening shader packs:
//  1. export an Iris pack from the Shader Maker, open the .zip again: it comes back as a normal
//     project with the same settings (generator editor, sliders and preview);
//  2. open BSL (from $TO_FIXTURES, skipped when missing) in the pack editor, change two options,
//     export, unzip and check that only those two #define / const lines changed; the settings
//     .txt alternative holds the same two values; choices survive a reload;
//  3. a zip that holds no pack gets a friendly error.
//
// Usage: NODE_PATH=$(npm root -g) node tests/e2e/shaders/import.e2e.cjs [baseUrl]
//   Without a baseUrl the app is built into a temp folder and served with `vite preview`.
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert/strict');
const { spawn } = require('child_process');
const ROOT = path.resolve(__dirname, '../../..');
const { unzipSync, zipSync, strFromU8, strToU8 } = require(path.join(ROOT, 'node_modules/fflate'));
const { launch, newContext, collectErrors, waitForCanvasPixels } = require('../../harness/shaders-view/lib.cjs');

const argUrl = process.argv[2] && /^https?:/.test(process.argv[2]) ? process.argv[2] : null;
const FIX = process.env.TO_FIXTURES ? path.join(process.env.TO_FIXTURES, 'research-cache/iris/packs/BSL_v10.1.8.zip') : null;
const BSL = FIX && fs.existsSync(FIX) ? FIX : null;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'shader-import-e2e-'));
const PROJECT_URL = /(#\/|\/)shaders\/[0-9a-f-]{36}$/;

let server = null;
async function startServer() {
  const port = 5950 + Math.floor(Math.random() * 40);
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'shader-import-dist-'));
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

function step(msg) {
  console.log(`  ok - ${msg}`);
}

async function openStart(page, base) {
  await page.goto(base + '#/shaders', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.pe-open-drop');
}

async function openPack(page, file) {
  await page.setInputFiles('.pe-open-drop input[type=file]', file);
}

async function waitSaved(page) {
  await page.waitForFunction(() => document.querySelector('.sh-save')?.dataset.state === 'saved', null, { timeout: 15000 });
}

function lines(text) {
  return text.split(/\r\n|\n/);
}

// ---------------------------------------------------------------------------------------------
async function roundTrip(browser, base) {
  console.log('# own Iris pack: export, then open it again');
  const ctx = await newContext(browser, { width: 1440, height: 900, theme: 'dark' });
  const page = await ctx.newPage();
  const errors = collectErrors(page);
  await openStart(page, base);
  await page.click('.sh-card[data-target="iris"] .sh-card-start');
  await page.waitForSelector('.sh-new .sh-preset');
  await page.click('.sh-new .sh-preset[data-preset="cinematic"]');
  await page.fill('.sh-new input.input', 'Round Trip Pack');
  await page.getByRole('button', { name: 'Create pack' }).click();
  await page.waitForSelector('.sh-editor');
  const firstUrl = page.url();
  assert.match(firstUrl, PROJECT_URL);
  const num = page.locator('[data-option="sunStrength"] input[type="number"]');
  await num.scrollIntoViewIfNeeded();
  await num.fill('2.35');
  await num.press('Enter');
  const toggle = page.locator('[data-option="cloudShadows"] .switch');
  await toggle.scrollIntoViewIfNeeded();
  await toggle.click();
  const cloudShadows = await toggle.getAttribute('aria-checked');
  await waitSaved(page);
  step(`project made (sunStrength 2.35, cloudShadows ${cloudShadows})`);

  const dl = page.waitForEvent('download', { timeout: 120000 });
  await page.click('.sh-bar-export');
  const download = await dl;
  await page.waitForSelector('.sh-export-head.is-success', { timeout: 60000 });
  const zipPath = path.join(TMP, download.suggestedFilename());
  await download.saveAs(zipPath);
  const entries = unzipSync(new Uint8Array(fs.readFileSync(zipPath)));
  const meta = JSON.parse(strFromU8(entries['shaders/texturepackmaker.json']));
  assert.equal(meta.app, 'TexturePackMaker');
  assert.equal(meta.target, 'iris');
  assert.equal(meta.settings.sunStrength, 2.35);
  step(`exported ${download.suggestedFilename()} with shaders/texturepackmaker.json`);
  await page.keyboard.press('Escape');

  await openStart(page, base);
  await openPack(page, zipPath);
  await page.waitForSelector('.sh-editor', { timeout: 30000 });
  await page.waitForFunction((u) => location.href !== u && /shaders\/[0-9a-f-]{36}$/.test(location.href), firstUrl);
  assert.equal(await page.locator('.sh-title').innerText(), 'Round Trip Pack');
  assert.equal(Number(await page.locator('[data-option="sunStrength"] input[type="number"]').inputValue()), 2.35);
  assert.equal(await page.getAttribute('[data-option="cloudShadows"] .switch', 'aria-checked'), cloudShadows);
  assert.equal(await page.locator('.pe-editor').count(), 0, 'opened in the Shader Maker editor, not the pack editor');
  const stats = await waitForCanvasPixels(page);
  step(`re-imported as a new project with the same settings; preview draws (luma ${stats.min}..${stats.max})`);

  // the start screen lists both projects
  await openStart(page, base);
  await page.waitForSelector('.sh-recent-card');
  assert.ok((await page.locator('.sh-recent-card').count()) >= 2);
  const bad = errors.filter((e) => !/favicon|net::ERR|Failed to load resource/.test(e));
  assert.deepEqual(bad, [], 'no page errors');
  await ctx.close();
}

// ---------------------------------------------------------------------------------------------
async function editBsl(browser, base) {
  console.log('# BSL: change two options, export, compare');
  const ctx = await newContext(browser, { width: 1440, height: 900, theme: 'light' });
  const page = await ctx.newPage();
  const errors = collectErrors(page);
  await openStart(page, base);
  await openPack(page, BSL);
  await page.waitForSelector('.pe-editor', { timeout: 60000 });
  assert.match(page.url(), PROJECT_URL);
  assert.match(await page.locator('.pe-options-panel .panel-header').innerText(), /\d{3} options/);
  step('BSL opened in the pack editor');

  // option 1: the "Realtime Shadows" switch (#define SHADOW) off
  await page.locator('.pe-screen[data-screen="LIGHTING"] > summary').first().click();
  const sw = page.locator('[data-option="SHADOW"] .switch').first();
  assert.equal(await sw.getAttribute('aria-checked'), 'true');
  await sw.click();
  assert.equal(await sw.getAttribute('aria-checked'), 'false');
  // option 2: the shadow map resolution slider one step up (2048 -> 3072)
  const range = page.locator('[data-option="shadowMapResolution"] input[type=range]').first();
  await range.focus();
  await page.keyboard.press('ArrowRight');
  assert.match(await page.locator('[data-option="shadowMapResolution"] .pe-opt-value').first().innerText(), /3K|3072/);
  await page.waitForFunction(() => document.querySelectorAll('.pe-changes .pe-change').length === 2);
  assert.equal(await page.locator('.pe-profile[aria-pressed="true"]').count(), 0, 'custom profile after changes');
  await waitSaved(page);
  step('two options changed (SHADOW off, shadowMapResolution 3072), summary lists 2');

  // search finds options inside collapsed screens
  await page.fill('.pe-options-tools input', 'motion blur');
  await page.waitForFunction(() => [...document.querySelectorAll('.pe-opt[data-option="MOTION_BLUR"]')].some((e) => !e.hidden && e.offsetParent));
  const emptyScreens = await page.evaluate(() =>
    [...document.querySelectorAll('.pe-screen')].filter((s) => s.offsetParent && ![...s.querySelectorAll('.pe-opt')].some((o) => o.offsetParent)).map((s) => s.dataset.screen),
  );
  assert.deepEqual(emptyScreens, [], 'only screens with matches stay visible');
  await page.fill('.pe-options-tools input', '');
  step('search reveals options in collapsed screens');

  // choices survive a fresh page load (loaded through the '#/' link form, which works for any router base)
  const id = page.url().match(/shaders\/([0-9a-f-]{36})/)[1];
  await page.goto('about:blank');
  await page.goto(`${base}#/shaders/${id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.pe-editor');
  await page.waitForFunction(() => document.querySelectorAll('.pe-changes .pe-change').length === 2);
  step('choices saved in this browser');

  // export with the settings .txt alternative
  await page.click('.sh-bar-export');
  await page.waitForSelector('.pe-export');
  await page.locator('.pe-export-toggle .switch').click();
  const downloads = [];
  page.on('download', (d) => downloads.push(d));
  await page.locator('.sh-export-footer').getByRole('button', { name: /Export \.zip/ }).click();
  await page.waitForSelector('.sh-export-head.is-success', { timeout: 60000 });
  await page.waitForFunction(() => true);
  for (let i = 0; i < 50 && downloads.length < 2; i++) await page.waitForTimeout(100);
  assert.equal(downloads.length, 2, 'pack and settings file downloaded');
  const zipDl = downloads.find((d) => d.suggestedFilename().endsWith('.zip'));
  const txtDl = downloads.find((d) => d.suggestedFilename().endsWith('.txt'));
  assert.equal(zipDl.suggestedFilename(), 'BSL_v10.1.8 (edited).zip');
  assert.equal(txtDl.suggestedFilename(), 'BSL_v10.1.8.zip.txt');
  const outZip = path.join(TMP, 'bsl-edited.zip');
  const outTxt = path.join(TMP, 'bsl.txt');
  await zipDl.saveAs(outZip);
  await txtDl.saveAs(outTxt);

  const orig = unzipSync(new Uint8Array(fs.readFileSync(BSL)));
  const next = unzipSync(new Uint8Array(fs.readFileSync(outZip)));
  const files = (z) => Object.keys(z).filter((k) => !k.endsWith('/')).sort();
  assert.deepEqual(files(next), files(orig), 'same files');
  assert.ok(Object.keys(next).includes('shaders/'), 'directory entries for OptiFine');
  const changed = files(orig).filter((k) => Buffer.compare(Buffer.from(orig[k]), Buffer.from(next[k])) !== 0);
  assert.deepEqual(changed, ['shaders/lib/settings.glsl'], 'only settings.glsl changed');
  const a = lines(strFromU8(orig['shaders/lib/settings.glsl']));
  const b = lines(strFromU8(next['shaders/lib/settings.glsl']));
  assert.equal(a.length, b.length);
  const diff = a.map((l, i) => [l, b[i]]).filter(([x, y]) => x !== y);
  assert.deepEqual(diff, [
    ['  #define SHADOW', '  //#define SHADOW'],
    ['  const int shadowMapResolution = 2048; //[512 1024 1536 2048 3072 4096 8192]', '  const int shadowMapResolution = 3072; //[512 1024 1536 2048 3072 4096 8192]'],
  ]);
  const txt = fs.readFileSync(outTxt, 'utf8').split('\n').filter((l) => l && !l.startsWith('#'));
  assert.deepEqual(txt.sort(), ['SHADOW=false', 'shadowMapResolution=3072']);
  step('export: only the two option lines differ; settings .txt has the same two values');
  await page.keyboard.press('Escape');

  // Files tab: edit, see it marked, revert
  await page.locator('.pe-tabs .tab[data-value="files"]').click();
  await page.waitForSelector('.pe-files-layout');
  await page.fill('.pe-tree-tools input', 'item.properties');
  await page.locator('.pe-files.is-flat .pe-file').first().click();
  await page.waitForFunction(() => document.querySelector('.pe-code-path')?.textContent === 'shaders/item.properties');
  await page.locator('.pe-textarea').click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type('\n# edited in the browser');
  await page.waitForFunction(() => Boolean(document.querySelector('.pe-files.is-flat .pe-file.is-edited')));
  assert.equal(await page.locator('.pe-code-head .badge', { hasText: 'Edited' }).isVisible(), true);
  await page.getByRole('button', { name: 'Revert file' }).click();
  await page.waitForFunction(() => !document.querySelector('.pe-file.is-edited'));
  assert.doesNotMatch(await page.locator('.pe-textarea').inputValue(), /edited in the browser/);
  step('Files tab: edit marks the file, revert restores it');

  const bad = errors.filter((e) => !/favicon|net::ERR|Failed to load resource/.test(e));
  assert.deepEqual(bad, [], 'no page errors');
  await ctx.close();
}

// ---------------------------------------------------------------------------------------------
async function notAPack(browser, base) {
  console.log('# friendly error for a zip without a pack');
  const ctx = await newContext(browser, { width: 900, height: 800, theme: 'dark' });
  const page = await ctx.newPage();
  const file = path.join(TMP, 'photos.zip');
  fs.writeFileSync(file, zipSync({ 'holiday.png': new Uint8Array([137, 80, 78, 71]), 'notes.txt': strToU8('hi') }));
  await openStart(page, base);
  await openPack(page, file);
  await page.waitForSelector('.sh-export-head.is-error');
  assert.match(await page.locator('.sh-export-msg').innerText(), /No pack was found/);
  step('explains what a pack looks like');
  await ctx.close();
}

(async () => {
  const base = (argUrl || (await startServer())).replace(/\/?$/, '/');
  const browser = await launch();
  let failed = 0;
  const run = async (name, fn) => {
    try {
      await fn(browser, base);
    } catch (err) {
      failed++;
      for (const p of browser.contexts().flatMap((c) => c.pages())) await p.screenshot({ path: path.join(os.tmpdir(), `shader-import-fail-${name}.png`) }).catch(() => {});
      console.log(`  not ok - ${name}: ${err && err.stack ? err.stack : err}`);
    }
  };
  try {
    await run('round-trip', roundTrip);
    if (BSL) await run('bsl', editBsl);
    else console.log('# skip BSL test (set TO_FIXTURES to a folder with research-cache/iris/packs/BSL_v10.1.8.zip)');
    await run('not-a-pack', notAPack);
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
