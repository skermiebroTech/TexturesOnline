// Vanilla Java target on other versions: export for older shader families, and a version without
// core shaders (export disabled, controls greyed out with a reason).
// Usage: NODE_PATH=$(npm root -g) node tests/e2e/shaders/vanilla-versions.e2e.cjs <baseUrl> [versions]
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert/strict');
const ROOT = path.resolve(__dirname, '../../..');
const { unzipSync, strFromU8 } = require(path.join(ROOT, 'node_modules/fflate'));
const { launch, newContext, collectErrors } = require('../../harness/shaders-view/lib.cjs');

const base = (process.argv[2] || 'http://127.0.0.1:5734/').replace(/\/?$/, '/');
const versions = (process.argv[3] || '1.21.4,1.20.1').split(',');
const EXPECT = { '1.21.4': 46, '1.20.1': 15, '1.21.8': 64, '1.18.2': 8 };

async function pickVersion(page, v) {
  await page.click('.sh-pack .vp-trigger');
  await page.waitForSelector('.vp-item');
  await page.fill('.vp-pop input', v);
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter');
  await page.waitForFunction((v) => document.querySelector('.sh-pack .vp-name')?.textContent?.includes(v), v);
}

(async () => {
  const browser = await launch();
  const ctx = await newContext(browser, { width: 1440, height: 900 });
  const page = await ctx.newPage();
  const errors = collectErrors(page);
  await page.goto(base + '#/shaders', { waitUntil: 'domcontentloaded' });
  await page.click('.sh-card[data-target="java-vanilla"] .sh-card-start');
  await page.waitForSelector('.sh-new .sh-preset');
  await page.click('.sh-new .sh-preset[data-preset="noir"]');
  await page.getByRole('button', { name: 'Create pack' }).click();
  await page.waitForSelector('.sh-editor');

  for (const v of versions) {
    await pickVersion(page, v);
    const dl = page.waitForEvent('download', { timeout: 180000 });
    await page.click('.sh-bar-export');
    const d = await dl;
    await page.waitForSelector('.sh-export-head.is-success');
    const file = path.join(os.tmpdir(), `vanilla-${v}.zip`);
    await d.saveAs(file);
    const zip = unzipSync(new Uint8Array(fs.readFileSync(file)));
    const meta = JSON.parse(strFromU8(zip['pack.mcmeta']));
    if (EXPECT[v]) assert.equal(meta.pack.pack_format, EXPECT[v], `pack_format for ${v}`);
    const shaders = Object.keys(zip).filter((n) => n.startsWith('assets/minecraft/shaders/'));
    assert.ok(shaders.length > 0, 'patched shaders');
    const warnings = await page.locator('.sh-export-warnings li').allInnerTexts();
    console.log(`ok - ${v}: pack_format ${meta.pack.pack_format}, ${shaders.length} shader files${warnings.length ? `, warnings: ${warnings.join(' | ')}` : ''}`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  await pickVersion(page, '1.16.5');
  assert.ok(await page.locator('.sh-bar-export').isDisabled(), 'export disabled for 1.16.5');
  assert.ok(await page.locator('[data-option="contrast"].is-unavailable').count(), 'controls greyed out');
  const note = await page.locator('.sh-pack .sh-note.is-warn').first().innerText();
  assert.match(note, /1\.17/);
  console.log('ok - 1.16.5: export disabled,', note);
  const bad = errors.filter((e) => !/Failed to load resource/.test(e));
  assert.deepEqual(bad, []);
  await browser.close();
  console.log('ALL PASS');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
