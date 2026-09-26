// Screenshot harness for the texture pack maker.
// Usage: NODE_PATH=$(npm root -g) node tests/harness/textures/shots.cjs <baseUrl|-> <outDir> [sizes=1440x900,1024x768,390x844] [themes=dark,light] [scenes=all]
// Scenes: start, editor, effects, pack, export, upload, empty, phone-tabs. '-' starts its own Vite server.
const fs = require('node:fs');
const path = require('node:path');
const { startVite, launch, routeMojang, fixturesDir } = require('../../e2e/textures/lib.cjs');

const argBase = process.argv[2] || '-';
const out = process.argv[3] || '.';
const sizes = (process.argv[4] || '1440x900,1024x768,390x844').split(',').map((s) => s.split('x').map(Number));
const themes = (process.argv[5] || 'dark,light').split(',');
const scenes = new Set((process.argv[6] || 'start,editor,effects,pack,export').split(','));
fs.mkdirSync(out, { recursive: true });

(async () => {
  const server = argBase === '-' ? await startVite() : null;
  const base = server ? server.url : argBase;
  const fx = fixturesDir();
  const browser = await launch();
  const errors = [];
  try {
    for (const theme of themes) {
      for (const [w, hgt] of sizes) {
        const tag = `${w}-${theme}`;
        const ctx = await browser.newContext({ viewport: { width: w, height: hgt }, colorScheme: theme, deviceScaleFactor: w < 761 ? 2 : 1 });
        await routeMojang(ctx, fx);
        await ctx.addInitScript((t) => localStorage.setItem('to-theme', t), theme);
        const page = await ctx.newPage();
        page.on('console', (m) => {
          if (m.type() === 'error') errors.push(`[${tag}] ${m.text()}`);
        });
        page.on('pageerror', (e) => errors.push(`[${tag}] pageerror ${e.message}`));
        const shot = async (name) => {
          await page.waitForTimeout(350);
          await page.screenshot({ path: path.join(out, `textures-${name}-${tag}.png`) });
          console.log('saved', `textures-${name}-${tag}.png`);
        };
        const phone = w < 761;

        await page.goto(base + '#/textures', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.tx-new');
        if (scenes.has('start')) await shot('start');

        // create a Java pack (26.3 default)
        await page.fill('.tx-name-field input', 'Emerald Dreams');
        await page.click('.tx-res-chip:has-text("32")');
        await page.click('.tx-create-btn');
        await page.waitForSelector('.tx-main', { timeout: 90000 });
        const tablet = !phone && w <= 1180;
        await page.waitForTimeout(300);
        if (scenes.has('empty')) await shot('empty');

        // open a texture through search
        if (phone) await page.click('.tx-tabbar-btn[data-v="textures"]');
        if (tablet) await page.click('.tx-col-tabs .tab[data-value="textures"]');
        await page.waitForSelector('.tx-tile.loaded', { timeout: 90000 });
        if (tablet && scenes.has('tablet-textures')) await shot('tablet-textures');
        await page.fill('.tx-search-input', 'diamond ore');
        await page.waitForTimeout(400);
        await page.click('.tx-tile >> nth=0');
        if (phone && !(await page.isVisible('.tx-center'))) await page.click('.tx-tabbar-btn[data-v="editor"]');
        await page.waitForSelector('.tx-center:not(.is-empty)');
        await page.waitForTimeout(500);
        // paint a few pixels
        const box = await page.locator('.pc-canvas').boundingBox();
        if (box) {
          await page.mouse.move(box.x + box.width / 2 - 20, box.y + box.height / 2 - 20);
          await page.mouse.down();
          await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 10, { steps: 6 });
          await page.mouse.up();
        }
        await page.waitForTimeout(900);
        if (scenes.has('editor')) await shot('editor');

        if (scenes.has('effects')) {
          if (phone) await page.click('.tx-tabbar-btn[data-v="effects"]');
          else await page.click('.tx-col-tabs .tab[data-value="effects"]');
          await page.waitForTimeout(600);
          await shot('effects-presets');
          await page.click('.tx-preset[data-preset="autumn"]');
          await page.waitForTimeout(1200);
          await shot('effects-applied');
          if (!phone) {
            await page.click('.tx-col-tabs .tab[data-value="preview"]');
            await page.waitForTimeout(1500);
            await shot('preview');
          }
        }
        if (scenes.has('pack')) {
          if (phone) await page.click('.tx-tabbar-btn[data-v="pack"]');
          else await page.click('.tx-col-tabs .tab[data-value="pack"]');
          await page.waitForTimeout(900);
          await shot('pack');
        }
        if (scenes.has('export')) {
          await page.click('.tx-export-btn');
          await page.waitForSelector('.tx-export-modal .tx-exp-rows');
          await page.waitForTimeout(300);
          await shot('export');
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
        }
        if (phone && scenes.has('phone-tabs')) {
          await page.click('.tx-tabbar-btn[data-v="textures"]');
          await page.fill('.tx-search-input', '');
          await page.waitForTimeout(800);
          await shot('phone-textures');
          await page.click('.tx-tabbar-btn[data-v="preview"]');
          await page.waitForTimeout(1500);
          await shot('phone-preview');
        }
        if (scenes.has('start')) {
          await page.goto(base + '#/textures');
          await page.waitForSelector('.tx-rc');
          await page.waitForTimeout(400);
          await page.screenshot({ path: path.join(out, `textures-start-recent-${tag}.png`), fullPage: true });
          console.log('saved', `textures-start-recent-${tag}.png`);
        }
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
    server?.stop();
  }
  if (errors.length) console.log('ERRORS:\n' + [...new Set(errors)].join('\n'));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
