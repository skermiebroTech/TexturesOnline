// Screenshots of the Skin Maker for visual review.
// Run: NODE_PATH=$(npm root -g) node tests/harness/skins/shots.mjs <outDir> [sizes=1440x900,1024x768,390x844] [themes=dark,light] [scenes=start,editor]
// Scenes: start, editor, parts (phone Parts tab), 3d (phone 3D tab), export, legacy, shortcuts, defaults
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const out = process.argv[2] || '/tmp/skins-shots';
const sizes = (process.argv[3] || '1440x900,1024x768,390x844').split(',').map((s) => s.split('x').map(Number));
const themes = (process.argv[4] || 'dark,light').split(',');
const scenes = (process.argv[5] || 'start,editor').split(',');
const starter = process.env.STARTER || 'explorer';
mkdirSync(out, { recursive: true });
const executablePath = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => existsSync(p));

const server = await createServer({ root, logLevel: 'error', server: { port: 0, host: '127.0.0.1', hmr: false, watch: null } });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];

async function openEditor(page) {
  await page.goto(base + '#/skins');
  await page.waitForSelector('.sk-starter');
  await page.click(`.sk-starter-${starter}`);
  await page.waitForSelector('.sk-editor .pc-root');
  await page.waitForTimeout(1500);
}

async function paint(page) {
  const api = () => page.evaluate(() => !!document.querySelector('.sk-editor').__skinEditor);
  if (!(await api())) return;
  const pt = (x, y) => page.evaluate(([x, y]) => document.querySelector('.sk-editor').__skinEditor.imageToClient(x, y), [x, y]);
  const [ax, ay] = await pt(8, 9);
  const [hx, hy] = await pt(45, 24);
  await page.mouse.move(hx, hy);
  await page.waitForTimeout(300);
  void ax;
  void ay;
}

for (const theme of themes) {
  for (const [w, hgt] of sizes) {
    const ctx = await browser.newContext({ viewport: { width: w, height: hgt }, colorScheme: theme, deviceScaleFactor: 1 });
    await ctx.addInitScript((t) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('to-theme', t);
        sessionStorage.setItem('seeded', '1');
      }
    }, theme);
    const page = await ctx.newPage();
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`[${theme} ${w}] ${m.text()}`);
    });
    page.on('pageerror', (e) => errors.push(`[${theme} ${w}] pageerror ${e.message}`));
    for (const scene of scenes) {
      const name = `skins-${scene}-${w}-${theme}.png`;
      if (scene === 'start') {
        await page.goto(base + '#/skins');
        await page.waitForSelector('.sk-starter');
        await page.waitForTimeout(800);
        await page.screenshot({ path: path.join(out, name), fullPage: true });
      } else if (scene === 'editor') {
        await openEditor(page);
        await paint(page);
        await page.waitForTimeout(700);
        await page.screenshot({ path: path.join(out, name) });
      } else if (scene === 'parts' || scene === '3d') {
        await openEditor(page);
        const tab = scene === 'parts' ? 'left' : 'right';
        await page.click(`.editor-tab[data-panel="${tab}"]`).catch(() => page.click(`.editor-sidetabs [data-value="${tab}"]`));
        await page.waitForTimeout(1200);
        await page.screenshot({ path: path.join(out, name) });
      } else if (scene === 'export' || scene === 'legacy') {
        await openEditor(page);
        await page.click('.sk-export-btn');
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(out, `skins-exportmenu-${w}-${theme}.png`) });
        const [dl] = await Promise.all([
          scene === 'export' ? page.waitForEvent('download', { timeout: 5000 }).catch(() => null) : Promise.resolve(null),
          page.click(`.sk-export-item[data-kind="${scene === 'export' ? 'bedrock-pack' : 'java-legacy'}"]`),
        ]);
        void dl;
        await page.waitForTimeout(800);
        await page.screenshot({ path: path.join(out, name) });
        await page.keyboard.press('Escape');
      } else if (scene === 'shortcuts') {
        await openEditor(page);
        await page.keyboard.press('?');
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(out, name) });
        await page.keyboard.press('Escape');
      } else if (scene === 'defaults') {
        await page.goto(base + '#/skins');
        await page.waitForSelector('.sk-starter');
        await page.click('text=Choose a default skin');
        await page.waitForSelector('.sk-default', { timeout: 60000 }).catch(() => null);
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(out, name) });
        await page.keyboard.press('Escape');
      }
      console.log('saved', name);
    }
    await ctx.close();
  }
}
await browser.close();
await server.close();
if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
