// Seeds a few projects into IndexedDB and screenshots the "recent projects" section of home.
// Usage: NODE_PATH=$(npm root -g) node tests/harness/ui/recent.cjs <baseUrl> <outDir> [theme] [width]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const base = process.argv[2] || 'http://127.0.0.1:5391/';
const out = process.argv[3] || '.';
const theme = process.argv[4] || 'dark';
const width = Number(process.argv[5] || 1440);
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find((p) => fs.existsSync(p));

(async () => {
  const browser = await chromium.launch({ executablePath: exe });
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme });
  await ctx.addInitScript((t) => localStorage.setItem('to-theme', t), theme);
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (r) => r.abort('internetdisconnected'));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + '#/', { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const storage = await import('/src/core/storage.ts');
    const png = async (w, h, draw) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      draw(c.getContext('2d'));
      return await new Promise((r) => c.toBlob(r, 'image/png'));
    };
    const icon = await png(16, 16, (g) => {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { g.fillStyle = `hsl(${(x * 20 + y * 7) % 360} 60% ${40 + ((x ^ y) & 3) * 8}%)`; g.fillRect(x, y, 1, 1); }
    });
    const skin = await png(64, 64, (g) => {
      g.fillStyle = '#c68c68'; g.fillRect(8, 8, 8, 8);
      g.fillStyle = '#ec9640'; g.fillRect(8, 8, 8, 2);
      g.fillStyle = '#fff'; g.fillRect(9, 12, 1, 1); g.fillRect(14, 12, 1, 1);
      g.fillStyle = '#284078'; g.fillRect(10, 12, 1, 1); g.fillRect(13, 12, 1, 1);
    });
    const now = Date.now();
    const base = { createdAt: now - 86400000 * 3 };
    await storage.saveProject({ ...base, id: 'demo-tex', kind: 'texturepack', name: 'Autumn Vibes', updatedAt: now, edition: 'java', version: '26.3', description: '', icon, resolution: 16, overrides: {}, extraFiles: {}, effects: [] });
    await storage.saveProject({ ...base, id: 'demo-skin', kind: 'skin', name: 'Explorer', updatedAt: now - 3600000, model: 'slim', image: skin });
    await storage.saveProject({ ...base, id: 'demo-shader', kind: 'shader', name: 'Golden Hour', updatedAt: now - 7200000, target: 'iris', version: '26.3', description: '', settings: {} });
    await storage.saveProject({ ...base, id: 'demo-bedrock', kind: 'texturepack', name: 'Crystal Clear Bedrock Pack With A Long Name', updatedAt: now - 86400000, edition: 'bedrock', version: 'latest', description: '', resolution: 32, overrides: {}, extraFiles: {}, effects: [] });
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const sec = page.locator('section.recent');
  await sec.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await sec.screenshot({ path: path.join(out, `ui-recent-${width}-${theme}.png`) });
  // menu
  await page.locator('.recent-menu').first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, `ui-recent-menu-${theme}.png`) });
  await page.keyboard.press('Escape');
  console.log('saved recent', errors.length ? errors : 'no errors');
  await browser.close();
})();
