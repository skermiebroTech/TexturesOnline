// Dialog screenshots (new pack, export progress/success) at a given size and theme.
// Usage: NODE_PATH=$(npm root -g) node tests/harness/shaders-view/dialogs.cjs <baseUrl> [theme] [WxH]
const { launch, newContext, collectErrors, waitForCanvasPixels, shotPath } = require('./lib.cjs');

const base = (process.argv[2] || 'http://127.0.0.1:5734/').replace(/\/?$/, '/');
const theme = process.argv[3] || 'dark';
const [w, hgt] = (process.argv[4] || '390x844').split('x').map(Number);
const tag = `${w}-${theme}`;

(async () => {
  const browser = await launch();
  const ctx = await newContext(browser, { width: w, height: hgt, theme });
  const page = await ctx.newPage();
  const errors = collectErrors(page);
  await page.goto(base + '#/shaders', { waitUntil: 'domcontentloaded' });
  await page.click('.sh-card[data-target="java-vanilla"] .sh-card-start');
  await page.waitForSelector('.sh-new .sh-preset');
  await page.waitForTimeout(400);
  await page.screenshot({ path: shotPath(`dialog-new-${tag}`) });
  await page.click('.sh-new .sh-preset[data-preset="warm-sunset"]');
  await page.getByRole('button', { name: 'Create pack' }).click();
  await page.waitForSelector('.sh-editor');
  await waitForCanvasPixels(page);
  const dl = page.waitForEvent('download', { timeout: 180000 });
  await page.click('.sh-bar-export');
  await page.waitForSelector('.sh-export-step.is-active');
  await page.screenshot({ path: shotPath(`dialog-export-progress-${tag}`) });
  await dl;
  await page.waitForSelector('.sh-export-head.is-success');
  await page.waitForTimeout(300);
  await page.screenshot({ path: shotPath(`dialog-export-done-${tag}`) });
  console.log(errors.join('\n') || 'no errors');
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
