// Real game textures in the preview (Java 26.3 from Mojang, Bedrock from bedrock-samples), day
// cycle animation and the screenshot button.
// Usage: NODE_PATH=$(npm root -g) node tests/harness/shaders-view/textures.cjs <baseUrl>
const assert = require('assert/strict');
const { launch, newContext, collectErrors, waitForCanvasPixels, shotPath } = require('./lib.cjs');
const base = (process.argv[2] || 'http://127.0.0.1:5734/').replace(/\/?$/, '/');

async function create(page, target) {
  await page.goto(base + '#/shaders', { waitUntil: 'domcontentloaded' });
  await page.click(`.sh-card[data-target="${target}"] .sh-card-start`);
  await page.waitForSelector('.sh-new .sh-preset');
  await page.getByRole('button', { name: 'Create pack' }).click();
  await page.waitForSelector('.sh-editor');
  await waitForCanvasPixels(page);
}

(async () => {
  const browser = await launch();
  const ctx = await newContext(browser, { width: 1440, height: 900 });
  const page = await ctx.newPage();
  const errors = collectErrors(page);
  for (const target of ['java-vanilla', 'bedrock-vibrant']) {
    await create(page, target);
    assert.equal(await page.getAttribute('.sh-tex-btn', 'aria-pressed'), 'false');
    await page.click('.sh-tex-btn');
    await page.waitForFunction(() => {
      const b = document.querySelector('.sh-tex-btn');
      return b.getAttribute('aria-pressed') === 'true' && !b.classList.contains('is-loading');
    }, null, { timeout: 120000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: shotPath(`textures-${target}`) });
    console.log('ok - real textures', target);
  }
  // remembered for the next project of the same edition (already downloaded)
  await create(page, 'iris');
  await page.waitForFunction(() => document.querySelector('.sh-tex-btn').getAttribute('aria-pressed') === 'true', null, { timeout: 60000 });
  console.log('ok - textures preference remembered');

  // day cycle
  const t0 = await page.locator('.sh-clock').innerText();
  await page.keyboard.press('d');
  await page.waitForTimeout(4000);
  const t1 = await page.locator('.sh-clock').innerText();
  assert.notEqual(t0, t1, 'clock moves while the day cycle plays');
  await page.keyboard.press('d');
  console.log('ok - day cycle', t0, '->', t1);
  await page.keyboard.press('4');
  await page.waitForTimeout(1500);
  assert.equal(await page.locator('.sh-clock').innerText(), '00:00');
  await page.screenshot({ path: shotPath('night-iris') });
  console.log('ok - night preset');

  const dl = page.waitForEvent('download');
  await page.click('.sh-stage-tools [aria-label^="Save a screenshot"]');
  const d = await dl;
  assert.match(d.suggestedFilename(), /preview\.png$/);
  console.log('ok - screenshot download', d.suggestedFilename());
  console.log(errors.join('\n') || 'no errors');
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
