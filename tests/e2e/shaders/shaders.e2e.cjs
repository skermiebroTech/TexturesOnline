// End-to-end test of the Shader Maker for all three targets: create a project, apply a preset (and
// undo it from the toast), tweak options, undo/redo, check the live preview draws, reload to check
// the settings were saved, export, then unzip the download and check the pack.
//
// Usage: NODE_PATH=$(npm root -g) node tests/e2e/shaders/shaders.e2e.cjs [baseUrl] [targets]
//   Without a baseUrl the app is built into a temp folder and served with `vite preview`.
//   Java files come from Mojang's servers (the vanilla export downloads the 26.3 shader files).
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert/strict');
const { spawn } = require('child_process');
const ROOT = path.resolve(__dirname, '../../..');
const { unzipSync, strFromU8 } = require(path.join(ROOT, 'node_modules/fflate'));
const { launch, newContext, collectErrors, waitForCanvasPixels } = require('../../harness/shaders-view/lib.cjs');

const argUrl = process.argv[2] && /^https?:/.test(process.argv[2]) ? process.argv[2] : null;
const targets = (process.argv[argUrl ? 3 : 2] || 'iris,java-vanilla,bedrock-vibrant').split(',');

let server = null;
async function startServer() {
  const port = 5800 + Math.floor(Math.random() * 150);
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'shaders-e2e-'));
  server = spawn(path.join(ROOT, 'tests/harness/shaders-view/serve.sh'), [out, String(port)], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('server did not start')), 180000);
    const onData = (d) => {
      if (/Local:/.test(String(d))) {
        clearTimeout(t);
        resolve(`http://127.0.0.1:${port}/`);
      }
    };
    server.stdout.on('data', onData);
    server.stderr.on('data', (d) => process.stderr.write(d));
    server.on('exit', (code) => reject(new Error(`server exited ${code}`)));
  });
}

const PLAN = {
  iris: {
    startPreset: 'cinematic',
    applyPreset: 'noir',
    slider: { key: 'sunStrength', value: '2.35' },
    toggle: 'cloudShadows',
    ext: '.zip',
  },
  'java-vanilla': {
    startPreset: 'vivid',
    applyPreset: 'cinematic',
    slider: { key: 'contrast', value: '1.37' },
    toggle: 'bloom',
    ext: '.zip',
  },
  'bedrock-vibrant': {
    startPreset: 'vivid',
    applyPreset: 'cinematic',
    slider: { key: 'saturation', value: '1.8' },
    toggle: 'waves',
    ext: '.mcpack',
  },
};

function step(msg) {
  console.log(`  ok - ${msg}`);
}

async function switchState(page, key) {
  return page.getAttribute(`[data-option="${key}"] .switch`, 'aria-checked');
}

async function waitSaved(page) {
  await page.waitForFunction(() => document.querySelector('.sh-save')?.dataset.state === 'saved', null, { timeout: 15000 });
}

async function runTarget(browser, base, target) {
  const plan = PLAN[target];
  console.log(`# ${target}`);
  const ctx = await newContext(browser, { width: 1440, height: 900, theme: 'dark' });
  const page = await ctx.newPage();
  const errors = collectErrors(page);

  // ---- create
  await page.goto(base + '#/shaders', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.sh-card');
  assert.equal(await page.locator('.sh-card').count(), 3, 'three target cards');
  await page.click(`.sh-card[data-target="${target}"] .sh-card-start`);
  await page.waitForSelector('.sh-new .sh-preset');
  await page.click(`.sh-new .sh-preset[data-preset="${plan.startPreset}"]`);
  assert.equal(await page.getAttribute(`.sh-new .sh-preset[data-preset="${plan.startPreset}"]`, 'aria-checked'), 'true');
  await page.fill('.sh-new .sh-name-field input, .sh-new input.input', `E2E ${target}`);
  await page.getByRole('button', { name: 'Create pack' }).click();
  await page.waitForSelector('.sh-editor');
  const url = page.url();
  assert.match(url, /#\/shaders\/[0-9a-f-]{36}$/);
  assert.equal(await page.getAttribute(`.sh-settings .sh-preset[data-preset="${plan.startPreset}"]`, 'aria-pressed'), 'true');
  step('project created from the start screen with a preset');

  const stats = await waitForCanvasPixels(page);
  step(`preview renders (luma ${stats.min}..${stats.max}, ${stats.levels} levels)`);

  // ---- preset + toast undo
  await page.click(`.sh-settings .sh-preset[data-preset="${plan.applyPreset}"]`);
  assert.equal(await page.getAttribute(`.sh-settings .sh-preset[data-preset="${plan.applyPreset}"]`, 'aria-pressed'), 'true');
  await page.locator('.toast').getByRole('button', { name: 'Undo' }).click();
  assert.equal(await page.getAttribute(`.sh-settings .sh-preset[data-preset="${plan.startPreset}"]`, 'aria-pressed'), 'true');
  await page.click(`.sh-settings .sh-preset[data-preset="${plan.applyPreset}"]`);
  assert.equal(await page.getAttribute(`.sh-settings .sh-preset[data-preset="${plan.applyPreset}"]`, 'aria-pressed'), 'true');
  step('preset applied, undone from the toast, applied again');

  // ---- tweak options
  const num = page.locator(`[data-option="${plan.slider.key}"] input[type="number"]`);
  await num.scrollIntoViewIfNeeded();
  await num.fill(plan.slider.value);
  await num.press('Enter');
  assert.equal(Number(await num.inputValue()), Number(plan.slider.value));
  await page.waitForTimeout(1000); // separate undo step
  const before = await switchState(page, plan.toggle);
  await page.locator(`[data-option="${plan.toggle}"] .switch`).scrollIntoViewIfNeeded();
  await page.click(`[data-option="${plan.toggle}"] .switch`);
  const after = await switchState(page, plan.toggle);
  assert.notEqual(before, after, 'toggle flipped');
  assert.equal(await page.locator('.sh-settings .sh-preset.is-active').count(), 0, 'custom look after tweaks');
  step(`options changed (${plan.slider.key}=${plan.slider.value}, ${plan.toggle}=${after})`);

  // ---- undo / redo
  await page.locator('.sh-stage-host canvas').focus();
  await page.keyboard.press('Control+z');
  assert.equal(await switchState(page, plan.toggle), before, 'undo restores the toggle');
  await page.keyboard.press('Control+Shift+z');
  assert.equal(await switchState(page, plan.toggle), after, 'redo re-applies the toggle');
  step('Ctrl+Z / Ctrl+Shift+Z');

  // ---- persistence
  await waitSaved(page);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.sh-editor');
  assert.equal(Number(await page.locator(`[data-option="${plan.slider.key}"] input[type="number"]`).inputValue()), Number(plan.slider.value));
  assert.equal(await switchState(page, plan.toggle), after);
  assert.equal(await page.locator('.sh-title').innerText(), `E2E ${target}`);
  step('settings and name survive a reload');

  await waitForCanvasPixels(page);

  // ---- export
  const dlPromise = page.waitForEvent('download', { timeout: 180000 });
  await page.click('.sh-bar-export');
  const download = await dlPromise;
  await page.waitForSelector('.sh-export-head.is-success', { timeout: 60000 });
  const name = download.suggestedFilename();
  assert.equal(name, `E2E ${target}${plan.ext}`);
  const file = path.join(os.tmpdir(), `shaders-e2e-${target}${plan.ext}`);
  await download.saveAs(file);
  const zip = unzipSync(new Uint8Array(fs.readFileSync(file)));
  const names = Object.keys(zip);
  const text = (p) => strFromU8(zip[p]);
  step(`exported ${name} (${fs.statSync(file).size} bytes, ${names.length} entries)`);

  if (target === 'iris') {
    assert.ok(names.includes('shaders/'), 'explicit shaders/ directory entry');
    assert.ok(names.includes('shaders/shaders.properties'), 'shaders.properties');
    const settings = text('shaders/lib/settings.glsl');
    assert.match(settings, /#define SUN_STRENGTH 2\.35\b/, 'settings.glsl carries the chosen sun strength');
    assert.match(settings, after === 'true' ? /^#define CLOUD_SHADOWS\b/m : /^\/\/\s*#define CLOUD_SHADOWS\b/m, 'cloud shadow toggle');
    assert.ok(names.some((n) => /^shaders\/(gbuffers_terrain|composite|final)\.fsh$/.test(n)), 'shader programs present');
    step('iris pack: shaders/ tree, settings.glsl values, shaders.properties');
  } else if (target === 'java-vanilla') {
    const meta = JSON.parse(text('pack.mcmeta'));
    // min/max_format: int or [major, minor]; a bare max means "any minor" (research java-packs §1)
    const pf = (v, dflt) => (Array.isArray(v) ? { major: v[0], minor: v.length > 1 ? v[1] : dflt } : { major: v, minor: dflt });
    const min = pf(meta.pack.min_format, 0);
    const max = pf(meta.pack.max_format, Infinity);
    const inRange = (major, minor) => (major > min.major || (major === min.major && minor >= min.minor)) && (major < max.major || (major === max.major && minor <= max.minor));
    assert.ok(inRange(97, 1), `26.3 (97.1) accepted by ${JSON.stringify(meta.pack)}`);
    assert.ok(!inRange(96, 0) && !inRange(98, 0), 'range is 26.3 only');
    assert.ok(!('supported_formats' in meta.pack), 'no supported_formats on a 26.3-only pack');
    assert.match(meta.pack.description, /26\.3/);
    assert.ok(names.includes('pack.png'));
    assert.ok(names.includes('assets/minecraft/post_effect/end_of_frame.json'), 'end_of_frame post effect');
    JSON.parse(text('assets/minecraft/post_effect/end_of_frame.json'));
    const shaders = names.filter((n) => /^assets\/minecraft\/shaders\/.+\.(fsh|vsh|glsl)$/.test(n));
    assert.ok(shaders.length > 0, 'patched shader files');
    const all = shaders.map(text).join('\n');
    assert.match(all, /1\.37/, 'contrast value baked into the shaders');
    step(`vanilla pack: pack.mcmeta 97.1, end_of_frame + ${shaders.length} shader files`);
  } else {
    const manifest = JSON.parse(text('manifest.json'));
    assert.ok(manifest.capabilities.includes('pbr'), 'pbr capability');
    assert.equal(manifest.format_version, 2);
    assert.equal(manifest.header.name, `E2E ${target}`);
    assert.ok(names.includes('pack_icon.png'));
    const jsons = names.filter((n) => n.endsWith('.json'));
    for (const j of jsons) JSON.parse(text(j));
    for (const dir of ['lighting/', 'atmospherics/', 'color_grading/', 'water/']) assert.ok(names.some((n) => n.startsWith(dir) && n.endsWith('.json')), `${dir} files`);
    const grade = JSON.parse(text('color_grading/color_grading.json'));
    assert.ok(grade, 'color_grading.json parses');
    step(`bedrock pack: manifest with pbr, ${jsons.length} JSON files parse`);

    // a second export bumps the pack version and keeps the uuids
    const dl2 = page.waitForEvent('download', { timeout: 60000 });
    await page.getByRole('button', { name: 'Export again' }).click();
    const second = await dl2;
    const f2 = file + '.2';
    await second.saveAs(f2);
    const m2 = JSON.parse(strFromU8(unzipSync(new Uint8Array(fs.readFileSync(f2)))['manifest.json']));
    assert.equal(m2.header.uuid, manifest.header.uuid);
    assert.ok(m2.header.version[2] > manifest.header.version[2], 'version bumped');
    step('re-export keeps the uuids and bumps the version');
  }
  await page.keyboard.press('Escape');

  const bad = errors.filter((e) => !/favicon|net::ERR|Failed to load resource/.test(e));
  assert.deepEqual(bad, [], 'no page errors');
  await ctx.close();
}

(async () => {
  const base = (argUrl || (await startServer())).replace(/\/?$/, '/');
  const browser = await launch();
  let failed = 0;
  try {
    for (const t of targets) {
      try {
        await runTarget(browser, base, t);
      } catch (err) {
        failed++;
        for (const p of browser.contexts().flatMap((c) => c.pages())) {
          await p.screenshot({ path: path.join(os.tmpdir(), `shaders-e2e-fail-${t}.png`) }).catch(() => {});
        }
        console.log(`  not ok - ${t}: ${err && err.stack ? err.stack : err}`);
      }
    }
    // not found page
    const ctx = await newContext(browser);
    const page = await ctx.newPage();
    await page.goto(base + '#/shaders/nope', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.empty-state');
    assert.match(await page.locator('.empty-state h3').innerText(), /not found/i);
    console.log('  ok - unknown project shows a not-found state');
    await ctx.close();
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
