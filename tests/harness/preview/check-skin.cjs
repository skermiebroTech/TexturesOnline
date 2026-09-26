// Functional checks for the skin preview harness: live paint fast path, highlight, layers, screenshot.
// Usage: NODE_PATH=$(npm root -g) node tests/harness/preview/check-skin.cjs <baseUrl> <outDir>
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const [base = 'http://localhost:5317', outDir = '.'] = process.argv.slice(2);
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find((p) => fs.existsSync(p));

(async () => {
  const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 520 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${base}/tests/harness/preview/skin.html?assets=java&anim=none`);
  await page.evaluate(() => window.__ready);
  const t0 = Date.now();
  const paint = await page.evaluate(() => window.__paint(40));
  console.log('paint x40:', JSON.stringify(paint), `${Date.now() - t0}ms`);
  await page.evaluate(() => { window.__a.setHighlight('left_arm'); window.__a.setLayers({ inner: true, outer: false }); });
  await page.waitForTimeout(400);
  await page.locator('#view').screenshot({ path: path.join(outDir, 'preview-skin-highlight.png') });
  const size = await page.evaluate(async () => (await window.__a.screenshot()).size);
  console.log('screenshot bytes:', size);
  await page.evaluate(() => { window.__a.setHighlight(null); window.__a.setLayers({ inner: true, outer: true }); window.__a.setModel('slim'); window.__a.setAnimation('run'); window.__a.setBackground('#282e3c'); });
  await page.waitForTimeout(600);
  await page.locator('#view').screenshot({ path: path.join(outDir, 'preview-skin-slim-run.png') });
  await page.evaluate(() => { window.__a.destroy(); window.__b.destroy(); });
  const left = await page.evaluate(() => document.querySelectorAll('.preview-stage').length);
  console.log('stages after destroy:', left);
  console.log('errors:', errors.filter((e) => !e.includes('404')).length ? errors : 'none');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
