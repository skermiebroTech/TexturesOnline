// Detail screenshots: options panel, search, unavailable options, compare, export dialog.
// Usage: NODE_PATH=$(npm root -g) node tests/harness/shaders-view/details.cjs <baseUrl> [theme] [WxH]
const { launch, newContext, collectErrors, waitForCanvasPixels, shotPath } = require('./lib.cjs');

const base = (process.argv[2] || 'http://127.0.0.1:5733/').replace(/\/?$/, '/');
const theme = process.argv[3] || 'dark';
const [w, hgt] = (process.argv[4] || '1440x900').split('x').map(Number);
const tag = `${w}-${theme}`;

async function create(page, target, preset) {
  await page.goto(base + '#/shaders', { waitUntil: 'domcontentloaded' });
  await page.click(`.sh-card[data-target="${target}"] .sh-card-start`);
  await page.waitForSelector('.sh-new .sh-preset');
  if (preset) await page.click(`.sh-new .sh-preset[data-preset="${preset}"]`);
  await page.getByRole('button', { name: 'Create pack' }).click();
  await page.waitForSelector('.sh-editor');
  await waitForCanvasPixels(page);
}

(async () => {
  const browser = await launch();
  const ctx = await newContext(browser, { width: w, height: hgt, theme });
  const page = await ctx.newPage();
  const errors = collectErrors(page);

  // Vanilla: options + unavailable controls for 1.21.5
  await create(page, 'java-vanilla', 'cinematic');
  await page.evaluate(() => document.querySelector('.sh-settings-body').scrollTo(0, 360));
  await page.waitForTimeout(300);
  await page.screenshot({ path: shotPath(`detail-options-${tag}`) });
  await page.click('.sh-pack .vp-trigger');
  await page.waitForSelector('.vp-item');
  await page.fill('.vp-pop input', '1.21.5');
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const el = document.querySelector('[data-option="bloom"]');
    el?.scrollIntoView({ block: 'center' });
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: shotPath(`detail-unavailable-${tag}`) });
  await page.evaluate(() => document.querySelector('.sh-pack-body').scrollTo(0, 99999));
  await page.waitForTimeout(200);
  await page.screenshot({ path: shotPath(`detail-vanilla-pack-${tag}`) });

  // search
  await page.keyboard.press('/');
  await page.keyboard.type('fog');
  await page.waitForTimeout(300);
  await page.screenshot({ path: shotPath(`detail-search-${tag}`) });
  await page.keyboard.press('Escape');

  // compare (hold C)
  await page.locator('.sh-stage-host canvas').focus();
  await page.keyboard.down('c');
  await page.waitForTimeout(900);
  await page.screenshot({ path: shotPath(`detail-compare-${tag}`) });
  await page.keyboard.up('c');

  // Iris: export dialog success
  await create(page, 'iris', 'golden');
  const dl = page.waitForEvent('download', { timeout: 60000 });
  await page.click('.sh-bar-export');
  await page.waitForSelector('.sh-export-head.is-success', { timeout: 60000 });
  await dl;
  await page.waitForTimeout(300);
  await page.screenshot({ path: shotPath(`detail-export-iris-${tag}`) });
  await page.keyboard.press('Escape');

  // Bedrock pack panel
  await create(page, 'bedrock-vibrant', 'cinematic');
  await page.evaluate(() => document.querySelector('.sh-pack-body').scrollTo(0, 99999));
  await page.waitForTimeout(200);
  await page.screenshot({ path: shotPath(`detail-bedrock-pack-${tag}`) });

  // shortcuts sheet
  await page.locator('.sh-stage-host canvas').focus();
  await page.keyboard.press('?');
  await page.waitForTimeout(400);
  await page.screenshot({ path: shotPath(`detail-shortcuts-${tag}`) });
  await page.keyboard.press('Escape');

  // not found
  await page.goto(base + '#/shaders/does-not-exist', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.empty-state');
  await page.screenshot({ path: shotPath(`detail-notfound-${tag}`) });

  console.log(errors.join('\n') || 'no errors');
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
