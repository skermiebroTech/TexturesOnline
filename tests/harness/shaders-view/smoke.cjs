// Quick look at the Shader Maker: start screen, new-project dialog and the editor for one target.
// Usage: NODE_PATH=$(npm root -g) node tests/harness/shaders-view/smoke.cjs <baseUrl> [target] [theme] [WxH]
const { launch, newContext, collectErrors, waitForCanvasPixels, shotPath } = require('./lib.cjs');

const base = (process.argv[2] || 'http://127.0.0.1:5733/').replace(/\/?$/, '/');
const target = process.argv[3] || 'iris';
const theme = process.argv[4] || 'dark';
const [w, hgt] = (process.argv[5] || '1440x900').split('x').map(Number);

(async () => {
  const browser = await launch();
  const ctx = await newContext(browser, { width: w, height: hgt, theme });
  const page = await ctx.newPage();
  const errors = collectErrors(page);
  await page.goto(base + '#/shaders', { waitUntil: 'networkidle' });
  await page.waitForSelector('.sh-card');
  await page.waitForSelector('.sh-card-render.is-in', { timeout: 60000 }).catch(() => console.log('no real renders'));
  await page.waitForTimeout(800);
  await page.screenshot({ path: shotPath(`smoke-start-${theme}-${w}`), fullPage: true });

  await page.click(`.sh-card[data-target="${target}"] .sh-card-start`);
  await page.waitForSelector('.sh-preset');
  await page.waitForTimeout(300);
  await page.screenshot({ path: shotPath(`smoke-new-${target}-${theme}-${w}`) });
  await page.click('.sh-preset[data-preset="cinematic"]').catch(() => {});
  await page.getByRole('button', { name: 'Create pack' }).click();
  await page.waitForSelector('.sh-editor');
  await waitForCanvasPixels(page).catch((e) => console.log(e.message));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: shotPath(`smoke-editor-${target}-${theme}-${w}`) });
  console.log(errors.join('\n') || 'no errors');
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
