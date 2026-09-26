// Screenshot harness for the ui module.
// Usage: NODE_PATH=$(npm root -g) node tests/harness/ui/screens.cjs <baseUrl> <outDir> [routes=/,/help,/kit] [sizes=1440x900,820x1180,390x844] [themes=dark,light] [full=1]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const base = process.argv[2] || 'http://127.0.0.1:5391/';
const out = process.argv[3] || '.';
const routes = (process.argv[4] || '/,/help,/kit').split(',');
const sizes = (process.argv[5] || '1440x900,820x1180,390x844').split(',').map((s) => s.split('x').map(Number));
const themes = (process.argv[6] || 'dark,light').split(',');
const full = (process.argv[7] || '1') === '1';
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find((p) => fs.existsSync(p));

(async () => {
  const browser = await chromium.launch({ executablePath: exe });
  const errors = [];
  for (const theme of themes) {
    for (const [w, hgt] of sizes) {
      const ctx = await browser.newContext({ viewport: { width: w, height: hgt }, colorScheme: theme, reducedMotion: 'no-preference' });
      await ctx.addInitScript((t) => localStorage.setItem('to-theme', t), theme);
      const page = await ctx.newPage();
      page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${theme} ${w}] ${m.text()}`); });
      page.on('pageerror', (e) => errors.push(`[${theme} ${w}] pageerror ${e.message}`));
      for (const r of routes) {
        await page.goto(base + '#' + r, { waitUntil: 'networkidle' }).catch(() => {});
        await page.waitForTimeout(1200);
        const name = `ui-${r === '/' ? 'home' : r.replace(/\W+/g, '')}-${w}-${theme}.png`;
        await page.screenshot({ path: path.join(out, name), fullPage: full });
        console.log('saved', name);
      }
      await ctx.close();
    }
  }
  await browser.close();
  if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
})();
