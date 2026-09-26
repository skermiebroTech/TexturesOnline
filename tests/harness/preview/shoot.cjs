// Screenshots the preview harness pages with headless Chromium (software WebGL).
// Usage: NODE_PATH=$(npm root -g) node tests/harness/preview/shoot.cjs <baseUrl> <outDir> [page] [cases...]
//   cases: "<assets>:<preset>" for the shader page, e.g. java:sunset none:noon
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const [base = 'http://localhost:5317', outDir = '.', pageName = 'shader', ...cases] = process.argv.slice(2);
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find((p) => fs.existsSync(p));

(async () => {
  const browser = await chromium.launch({
    executablePath: exe,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({ viewport: { width: 1000, height: 720 } });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  const list = cases.length ? cases : ['none:default'];
  for (const c of list) {
    const [assets, preset, extra = ''] = c.split(':');
    const url = `${base}/tests/harness/preview/${pageName}.html?assets=${assets}&preset=${preset}&dpr=1${extra ? '&' + extra : ''}`;
    await page.goto(url);
    await page.waitForFunction(() => window.__ready !== undefined, null, { timeout: 30000 });
    await page.evaluate(() => window.__ready);
    await page.waitForTimeout(1500);
    const file = path.join(outDir, `preview-${pageName}-${assets}-${preset}${extra ? '-' + extra.replace(/[^a-z0-9]+/gi, '_') : ''}.png`);
    await page.locator('#view').screenshot({ path: file });
    console.log('saved', file);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
