// Renders public/screenshots/{textures,skins,shaders}.jpg (1280x800, used as the tools' social
// preview image and structured-data screenshot) from a served build of the site.
// Usage: npm run build && node tests/e2e/seo/pages-server.mjs dist 5781 &
//        NODE_PATH=$(npm root -g) node tests/harness/seo/screenshots.cjs http://127.0.0.1:5781/
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const base = process.argv[2] || 'http://127.0.0.1:5781/';
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find((p) => fs.existsSync(p));
const outDir = path.resolve(__dirname, '../../../public/screenshots');

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark', reducedMotion: 'reduce' });
  await ctx.addInitScript(() => localStorage.setItem('to-theme', 'dark'));
  // Only the site itself: the start screens need no game files.
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (r) => r.abort());
  const page = await ctx.newPage();
  for (const tool of ['textures', 'skins', 'shaders']) {
    await page.goto(`${base}${tool}/`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-tool-intro]', { timeout: 15000 });
    await page.waitForTimeout(1200);
    const file = path.join(outDir, `${tool}.jpg`);
    await page.screenshot({ path: file, type: 'jpeg', quality: 82 });
    console.log('wrote', file, fs.statSync(file).size, 'bytes');
  }
  await browser.close();
})();
