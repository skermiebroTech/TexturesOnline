// Interaction screenshots for the ui module (dialogs, popovers, menus, toasts).
// Usage: NODE_PATH=$(npm root -g) node tests/harness/ui/interact.cjs <baseUrl> <outDir> [theme]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const base = process.argv[2] || 'http://127.0.0.1:5391/';
const out = process.argv[3] || '.';
const theme = process.argv[4] || 'dark';
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find((p) => fs.existsSync(p));
// Offline fixtures for the version lists (pass FIXTURES=<dir with manifest.json + versions.json>)
const fixtures = process.env.FIXTURES || '';

(async () => {
  const browser = await chromium.launch({ executablePath: exe });
  const errors = [];
  const shot = async (page, name) => {
    await page.screenshot({ path: path.join(out, `ui-${name}-${theme}.png`) });
    console.log('saved', name);
  };
  const mk = async (w, h) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: theme, ignoreHTTPSErrors: true });
    await ctx.addInitScript((t) => localStorage.setItem('to-theme', t), theme);
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) => {
      const url = route.request().url();
      if (fixtures && /version_manifest_v2\.json/.test(url)) return route.fulfill({ path: path.join(fixtures, 'manifest.json'), contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
      if (fixtures && /data\.min\.json/.test(url)) return route.fulfill({ path: path.join(fixtures, 'versions.json'), contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
      return route.abort('internetdisconnected');
    });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push('pageerror ' + e.message));
    return page;
  };

  // Desktop: kit interactions
  let page = await mk(1440, 900);
  await page.goto(base + '#/kit', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Modal' }).click();
  await page.waitForTimeout(400);
  await shot(page, 'modal');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Shortcuts' }).click();
  await page.waitForTimeout(400);
  await shot(page, 'shortcuts');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  for (const n of ['Info', 'Success', 'Warning', 'Error', 'With action']) await page.getByRole('button', { name: n, exact: true }).click();
  await page.waitForTimeout(500);
  await shot(page, 'toasts');
  await page.locator('.swatch-btn').first().scrollIntoViewIfNeeded();
  await page.locator('.swatch-btn').first().click();
  await page.waitForTimeout(400);
  await shot(page, 'swatch-popover');
  await page.keyboard.press('Escape');
  await page.locator('.vp-trigger').first().scrollIntoViewIfNeeded();
  await page.locator('.vp-trigger').first().click();
  await page.waitForTimeout(4000);
  await shot(page, 'version-picker');
  await page.keyboard.type('1.20');
  await page.waitForTimeout(300);
  await shot(page, 'version-picker-search');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.waitForTimeout(300);
  await shot(page, 'menu');
  await page.keyboard.press('Escape');
  // keyboard focus ring
  await page.goto(base + '#/', { waitUntil: 'networkidle' });
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.waitForTimeout(700);
  await shot(page, 'focus');
  await page.getByRole('button', { name: 'Start creating' }).first().click();
  await page.waitForTimeout(400);
  await shot(page, 'start-dialog');
  await page.context().close();

  // Phone: menu drawer + sheet modal
  page = await mk(390, 844);
  await page.goto(base + '#/help', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.waitForTimeout(400);
  await shot(page, 'drawer');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.goto(base + '#/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Start creating' }).first().click();
  await page.waitForTimeout(500);
  await shot(page, 'start-sheet');
  await page.context().close();

  // 404
  page = await mk(1440, 900);
  await page.goto(base + '#/nope/nothing', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await shot(page, '404');
  await page.context().close();

  await browser.close();
  if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
})();
