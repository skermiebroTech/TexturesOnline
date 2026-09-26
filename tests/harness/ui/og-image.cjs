// Renders public/og-image.png (1200x630 social preview) from the live home page.
// Usage: NODE_PATH=$(npm root -g) node tests/harness/ui/og-image.cjs <baseUrl>
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const base = process.argv[2] || 'http://127.0.0.1:5391/';
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find((p) => fs.existsSync(p));
const out = path.resolve(__dirname, '../../../public/og-image.png');

(async () => {
  const browser = await chromium.launch({ executablePath: exe });
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, colorScheme: 'dark', reducedMotion: 'reduce' });
  await ctx.addInitScript(() => localStorage.setItem('to-theme', 'dark'));
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (r) => r.abort());
  const page = await ctx.newPage();
  await page.goto(base + '#/', { waitUntil: 'networkidle' });
  await page.addStyleTag({
    content: '.hero{min-height:566px!important;padding-top:40px!important;padding-bottom:24px!important}.hero-art-hint,.hero-cta .btn-secondary{display:none!important}',
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: out });
  await browser.close();
  console.log('wrote', out);
})();
