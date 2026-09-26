// Browser regression checks for the ui review fixes (run against the dev or preview server).
// Usage: NODE_PATH=$(npm root -g) node tests/harness/ui/review.cjs <baseUrl> [screenshotDir]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');

const base = process.argv[2] || 'http://127.0.0.1:5391/';
const shots = process.argv[3] || '';
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find((p) => fs.existsSync(p));

// Small Mojang manifest fixture: releases interleaved with weekly snapshots (as in the real one).
const manifest = {
  latest: { release: '26.3', snapshot: '26.4-snapshot-1' },
  versions: [
    ['26.4-snapshot-1', 'snapshot', '2026-09-20T10:00:00+00:00'],
    ['26.3', 'release', '2026-09-01T10:00:00+00:00'],
    ['26.3-rc-1', 'snapshot', '2026-08-25T10:00:00+00:00'],
    ['1.21.11', 'release', '2025-12-09T10:00:00+00:00'],
    ['25w45a', 'snapshot', '2025-11-04T10:00:00+00:00'],
    ['1.21.10', 'release', '2025-10-07T10:00:00+00:00'],
    ['25w41a', 'snapshot', '2025-10-01T10:00:00+00:00'],
    ['1.21.9', 'release', '2025-09-30T10:00:00+00:00'],
    ['1.20.6', 'release', '2024-04-29T10:00:00+00:00'],
    ['24w14a', 'snapshot', '2024-04-03T10:00:00+00:00'],
    ['1.20.4', 'release', '2023-12-07T10:00:00+00:00'],
  ].map(([id, type, releaseTime]) => ({ id, type, url: `https://piston-meta.mojang.com/v1/packages/x/${id}.json`, time: releaseTime, releaseTime, sha1: 'x', complianceLevel: 1 })),
};

(async () => {
  const browser = await chromium.launch({ executablePath: exe });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (r) => {
    if (r.request().url().includes('version_manifest_v2.json')) {
      return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(manifest) });
    }
    return r.abort('internetdisconnected');
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const step = (name) => console.log('ok -', name);
  const shot = async (name) => shots && page.screenshot({ path: path.join(shots, name) });

  await page.goto(base + '#/kit', { waitUntil: 'networkidle' });

  // Repeated Esc makes browsers close a dialog without a cancelable 'cancel' event.
  await page.getByRole('button', { name: 'Blocking' }).click();
  await page.waitForSelector('dialog.modal[open]');
  await page.waitForTimeout(250);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  assert.equal(await page.locator('dialog.modal[open]').count(), 1, 'blocking dialog stays open');
  await page.waitForSelector('dialog.modal', { state: 'detached', timeout: 6000 });
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('modal-open')), false, 'page scroll unlocked');
  step('blocking dialog survives repeated Esc and unlocks scrolling when closed');

  await page.getByRole('button', { name: 'Modal', exact: true }).click();
  await page.waitForSelector('dialog.modal[open]');
  await page.waitForTimeout(250);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  assert.equal(await page.locator('dialog.modal').count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('modal-open')), false);
  step('dismissible dialog cleans up after repeated Esc');

  // Toast actions stay clickable above a modal, and toasts survive the modal closing.
  await page.getByRole('button', { name: 'Toast over dialog' }).click();
  await page.waitForSelector('dialog.modal[open]');
  await page.waitForTimeout(400);
  await shot('ui-review-toast-over-modal.png');
  await page.locator('.toast button:has-text("Undo delete")').click({ timeout: 2000 });
  await page.waitForSelector('.toast:has-text("Restored")');
  await page.getByRole('button', { name: 'Done' }).click();
  await page.waitForTimeout(400);
  assert.equal(await page.locator('dialog.modal').count(), 0);
  assert.equal(await page.locator('.toast:has-text("Restored")').count(), 1, 'toast outlives the dialog');
  assert.equal(await page.evaluate(() => document.querySelector('.toast-region').parentElement.tagName), 'BODY');
  assert.equal(await page.evaluate(() => document.querySelectorAll('.toast-region').length), 1);
  assert.equal(await page.evaluate(() => document.querySelector('.toast-region').getAttribute('aria-live')), 'polite');
  step('toast actions work over modals; toasts outlive the modal');

  // Navigating (e.g. browser Back) closes dialogs that belong to the old page.
  await page.getByRole('button', { name: 'Confirm' }).click();
  await page.waitForSelector('dialog[open]');
  await page.evaluate(() => (location.hash = '#/help'));
  await page.waitForTimeout(500);
  assert.equal(await page.locator('dialog[open]').count(), 0);
  step('dialogs close on navigation');

  // Help: in-page links keep working after the URL was updated by a table-of-contents jump.
  await page.click('.toc-link:has-text("FAQ")');
  await page.waitForFunction(() => location.hash === '#/help?s=faq');
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => location.hash), '#/help?s=faq');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
  await page.evaluate(() => document.querySelector('.site-footer a[href="#/help?s=faq"]').click());
  // smooth scrolling: wait until it settles near the FAQ heading
  await page
    .waitForFunction(() => {
      const top = document.getElementById('help-faq').getBoundingClientRect().top;
      return top > 0 && top < 200;
    }, null, { timeout: 8000 })
    .catch(() => undefined);
  const faqTop = await page.evaluate(() => document.getElementById('help-faq').getBoundingClientRect().top);
  assert.ok(faqTop > 0 && faqTop < 200, `footer FAQ link scrolls to the FAQ (top ${faqTop})`);
  await page.evaluate(() => window.scrollBy(0, 400));
  await page.waitForTimeout(150);
  const before = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => (location.hash = '#/'));
  await page.waitForSelector('.hero');
  await page.goBack();
  await page.waitForSelector('.help-section');
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => window.scrollY);
  assert.ok(Math.abs(after - before) < 40, `back restores the reading position, not the deep link (${before} -> ${after})`);
  step('help deep links, footer links and back navigation');

  // Version picker: one heading per line, compact snapshot names.
  await page.goto(base + '#/kit', { waitUntil: 'networkidle' });
  const trigger = page.locator('#kit-files .vp-trigger').first();
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  await page.waitForSelector('.vp-item');
  await page.locator('.vp-pop .switch').click();
  await page.waitForSelector('.vp-item.snapshot', { timeout: 15000 });
  const groups = await page.$$eval('.vp-group', (els) => els.map((e) => e.textContent));
  assert.equal(new Set(groups).size, groups.length, `no repeated headings: ${groups.join(', ')}`);
  const names = await page.$$eval('.vp-item-name', (els) => els.map((e) => e.textContent));
  assert.ok(names.includes('26.3-rc-1') && names.includes('25w45a'), names.join(', '));
  const truncated = await page.$$eval('.vp-item-name', (els) => els.filter((e) => e.scrollWidth > e.clientWidth).length);
  assert.equal(truncated, 0, 'no version name is cut off');
  await shot('ui-review-version-picker.png');
  await page.keyboard.press('Escape');
  step('version picker grouping and names');

  // Mobile drawer closes on Back.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + '#/', { waitUntil: 'networkidle' });
  await page.evaluate(() => (location.hash = '#/help'));
  await page.waitForSelector('.help-section');
  await page.click('.menu-btn');
  await page.waitForSelector('.nav-drawer[open]');
  await page.goBack();
  await page.waitForTimeout(500);
  assert.equal(await page.locator('.nav-drawer').count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('modal-open')), false);
  step('mobile drawer closes on back');

  await browser.close();
  if (errors.length) {
    console.log('page errors:', errors);
    process.exit(1);
  }
  console.log('all review checks passed');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
