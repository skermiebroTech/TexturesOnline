// Screenshots of the Shader Maker for visual review.
// Usage: NODE_PATH=$(npm root -g) node tests/harness/shaders-view/shots.cjs <baseUrl> [themes=dark,light] [sizes=1440x900,1024x768,390x844] [targets=iris,java-vanilla,bedrock-vibrant]
const { launch, newContext, collectErrors, waitForCanvasPixels, shotPath } = require('./lib.cjs');

const base = (process.argv[2] || 'http://127.0.0.1:5733/').replace(/\/?$/, '/');
const themes = (process.argv[3] || 'dark,light').split(',');
const sizes = (process.argv[4] || '1440x900,1024x768,390x844').split(',').map((s) => s.split('x').map(Number));
const targets = (process.argv[5] || 'iris,java-vanilla,bedrock-vibrant').split(',');
const PRESET = { iris: 'cinematic', 'java-vanilla': 'vivid', 'bedrock-vibrant': 'vivid' };
const SHORT = { iris: 'iris', 'java-vanilla': 'vanilla', 'bedrock-vibrant': 'bedrock' };

async function createProject(page, target) {
  await page.goto(base + '#/shaders', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(`.sh-card[data-target="${target}"] .sh-card-start`);
  await page.click(`.sh-card[data-target="${target}"] .sh-card-start`);
  await page.waitForSelector('.sh-new .sh-preset');
  await page.click(`.sh-new .sh-preset[data-preset="${PRESET[target]}"]`).catch(() => {});
  await page.getByRole('button', { name: 'Create pack' }).click();
  await page.waitForSelector('.sh-editor');
  await waitForCanvasPixels(page);
  await page.waitForTimeout(1200);
}

(async () => {
  const browser = await launch();
  for (const theme of themes) {
    for (const [w, hgt] of sizes) {
      const tag = `${w}-${theme}`;
      const ctx = await newContext(browser, { width: w, height: hgt, theme });
      const page = await ctx.newPage();
      const errors = collectErrors(page);
      await page.goto(base + '#/shaders', { waitUntil: 'networkidle' });
      await page.waitForSelector('.sh-card');
      await page.waitForSelector('.sh-card-render.is-in', { timeout: 90000 }).catch(() => console.log('no renders'));
      await page.waitForTimeout(900);
      await page.screenshot({ path: shotPath(`start-${tag}`) });
      await page.screenshot({ path: shotPath(`start-full-${tag}`), fullPage: true });
      for (const target of targets) {
        await createProject(page, target);
        const t = `${SHORT[target]}-${tag}`;
        await page.screenshot({ path: shotPath(`editor-${t}`) });
        if (w <= 720) {
          await page.click('.editor-tab[data-panel="left"]');
          await page.waitForTimeout(300);
          await page.screenshot({ path: shotPath(`editor-${t}-settings`) });
          await page.click('.editor-tab[data-panel="right"]');
          await page.waitForTimeout(300);
          await page.screenshot({ path: shotPath(`editor-${t}-pack`) });
          await page.click('.editor-tab[data-panel="center"]');
        } else if (w <= 1180) {
          await page.click('.editor-sidetabs [data-value="right"]');
          await page.waitForTimeout(300);
          await page.screenshot({ path: shotPath(`editor-${t}-pack`) });
          await page.click('.editor-sidetabs [data-value="left"]');
        }
      }
      // back on the start screen the recent projects show up
      await page.goto(base + '#/shaders', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.sh-recent-card');
      await page.waitForTimeout(600);
      await page.locator('.sh-recent').scrollIntoViewIfNeeded();
      await page.screenshot({ path: shotPath(`recent-${tag}`) });
      console.log(tag, errors.length ? errors.join('\n') : 'no errors');
      await ctx.close();
    }
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
