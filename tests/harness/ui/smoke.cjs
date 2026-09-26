// Functional smoke test for the shell/router/theme (run against the dev or preview server).
// Usage: NODE_PATH=$(npm root -g) node tests/harness/ui/smoke.cjs <baseUrl>
const { chromium } = require('playwright');
const fs = require('fs');
const assert = require('assert/strict');

const base = process.argv[2] || 'http://127.0.0.1:5391/';
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find((p) => fs.existsSync(p));

(async () => {
  const browser = await chromium.launch({ executablePath: exe });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (r) => r.abort('internetdisconnected'));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const step = (name) => console.log('ok -', name);

  await page.goto(base, { waitUntil: 'networkidle' });
  assert.equal(await page.evaluate(() => location.hash), '#/');
  assert.match(await page.title(), /TexturesOnline/);
  assert.equal(await page.locator('.nav-link[aria-current="page"]').getAttribute('data-tool'), 'home');
  step('home renders with Home active');

  const font = await page.evaluate(async () => {
    await document.fonts.ready;
    return document.fonts.check('16px Texel');
  });
  assert.ok(font, 'Texel font loaded');
  step('Texel font loaded');

  await page.click('.nav-link[data-tool="help"]');
  await page.waitForSelector('.help-section');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.tool), 'help');
  assert.match(await page.title(), /Install guide/);
  step('navigate to help (lazy route, title, tool accent)');

  await page.evaluate(() => window.scrollTo(0, 1800));
  await page.waitForTimeout(200);
  // DOM click: Playwright's own click would scroll the page first
  await page.evaluate(() => document.querySelector('.nav-link[data-tool="home"]').click());
  await page.waitForSelector('.hero');
  await page.waitForTimeout(200);
  assert.ok((await page.evaluate(() => window.scrollY)) < 5, 'new page starts at top');
  await page.goBack();
  await page.waitForSelector('.help-section');
  await page.waitForTimeout(400);
  const y = await page.evaluate(() => window.scrollY);
  assert.ok(Math.abs(y - 1800) < 40, `scroll restored on back (got ${y})`);
  step('scroll restoration on back');

  await page.goto(base + '#/help?s=faq', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const top = await page.evaluate(() => document.getElementById('help-faq').getBoundingClientRect().top);
  assert.ok(top >= 0 && top < 200, `deep link scrolls to FAQ (top ${top})`);
  assert.equal(await page.locator('.toc-link[aria-current="true"]').innerText(), 'FAQ');
  step('help deep link');

  await page.goto(base + '#/does-not-exist', { waitUntil: 'networkidle' });
  await page.waitForSelector('.empty-state');
  assert.match(await page.title(), /not found/i);
  step('404 view');

  for (const r of ['textures', 'skins', 'shaders', 'kit']) {
    await page.goto(base + `#/${r}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.view');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.tool), r);
  }
  step('tool routes load');

  const before = await page.evaluate(() => document.documentElement.dataset.theme);
  await page.click('.theme-toggle');
  const after = await page.evaluate(() => document.documentElement.dataset.theme);
  assert.notEqual(before, after);
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), after);
  step('theme toggle persists');

  await page.goto(base + '#/kit', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Confirm' }).click();
  await page.waitForSelector('dialog[open]');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  assert.equal(await page.locator('dialog[open]').count(), 0);
  step('modal closes with Escape');

  await page.getByRole('button', { name: 'Prompt' }).click();
  await page.waitForSelector('dialog[open] input');
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Renamed');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.toast:has-text("Renamed to Renamed")', { timeout: 3000 });
  step('prompt dialog submits with Enter');

  // segmented keyboard navigation
  const seg = page.locator('#kit-controls .segmented').first();
  await seg.locator('[aria-checked="true"]').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await seg.locator('[aria-checked="true"]').innerText(), 'Slim');
  step('segmented arrow keys');

  // mobile drawer
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + '#/', { waitUntil: 'networkidle' });
  await page.click('.menu-btn');
  await page.waitForSelector('.nav-drawer[open]');
  await page.click('.drawer-link[data-tool="skins"]');
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => location.hash), '#/skins');
  assert.equal(await page.locator('.nav-drawer').count(), 0);
  step('mobile drawer navigates and closes');

  await browser.close();
  if (errors.length) {
    console.log('page errors:', errors);
    process.exit(1);
  }
  console.log('all smoke checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
