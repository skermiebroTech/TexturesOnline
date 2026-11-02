// End-to-end checks of the skin's picture card (Export menu → Share a picture), at 1280 and 390 px
// in the dark and the light theme: a 1200×675 PNG with the skin's face (pixel for pixel) and the
// player in 3D from the front and the back, named after the skin; the default name isn't printed;
// a toast says where the file went; on a phone the menu item fits and a tap downloads the card, and
// where the browser can share files the card goes to the share sheet; a Japanese name draws; no
// console errors, nothing wider than the screen.
// Run: NODE_PATH=$(npm root -g) node tests/e2e/skins/skins-share.e2e.mjs [screenshotDir] [--cards <dir>]
// (--cards keeps the PNG cards it made there). Needs the global 'playwright' package.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const projectRequire = createRequire(path.join(root, 'package.json'));
const { decode: decodePng } = projectRequire('fast-png');

const argv = process.argv.slice(2);
const cardsDir = argv.includes('--cards') ? argv[argv.indexOf('--cards') + 1] : null;
const shots = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--cards') || path.join(tmpdir(), 'skins-share-e2e');
mkdirSync(shots, { recursive: true });
if (cardsDir) mkdirSync(cardsDir, { recursive: true });
const executablePath = process.env.CHROMIUM_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => existsSync(p));

const server = await createServer({ root, logLevel: 'error', server: { port: 0, host: '127.0.0.1', hmr: false, watch: null } });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

let failures = 0;
function check(name, ok, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
}

async function newPage(width, theme, locale) {
  const phone = width < 600;
  const context = await browser.newContext({ viewport: { width, height: phone ? 844 : 860 }, colorScheme: theme, deviceScaleFactor: 1, acceptDownloads: true, hasTouch: phone, isMobile: phone, locale });
  await context.addInitScript((t) => {
    try {
      localStorage.setItem('to-theme', t);
    } catch {
      /* ignore */
    }
  }, theme);
  await context.route(/playerdb\.co|textures\.minecraft\.net|mc-heads\.net/, (route) => route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  return { page, context, errors, phone };
}

const sideways = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const toastSeen = (page, re) => page.waitForFunction((src) => [...document.querySelectorAll('.toast')].some((t) => new RegExp(src).test(t.textContent || '')), re.source, { timeout: 30000 }).then(() => true, () => false);
const SHARE_ITEM = '.sk-export-item:has([data-icon="share"])';

async function openStarter(page, lang = '') {
  await page.goto(`${base}${lang ? `${lang}/` : ''}skins/`);
  await page.waitForSelector('.sk-starter-explorer');
  await page.click('.sk-starter-explorer');
  await page.waitForSelector('.sk-3d .preview-stage canvas', { state: 'attached', timeout: 20000 });
  await page.waitForFunction(() => !!document.querySelector('.sk-editor')?.__skinEditor);
}

async function rename(page, name) {
  await page.fill('.sk-name', name);
  await page.press('.sk-name', 'Enter');
}

/** Picks Share a picture in the Export menu and returns the downloaded card. */
async function shareCard(page, file, tap = false) {
  await (tap ? page.tap('.sk-export-btn') : page.click('.sk-export-btn'));
  await page.waitForSelector(SHARE_ITEM);
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), tap ? page.tap(SHARE_ITEM) : page.click(SHARE_ITEM)]);
  const bytes = readFileSync(await dl.path());
  if (cardsDir && file) writeFileSync(path.join(cardsDir, file), bytes);
  return { name: dl.suggestedFilename(), bytes, png: decodePng(bytes) };
}

/** Share of a box's pixels that aren't the card's dark ground (the player is there). */
function filled(png, x0, y0, x1, y1) {
  const ch = png.channels;
  let n = 0;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const o = (y * png.width + x) * ch;
      if (Math.max(png.data[o], png.data[o + 1], png.data[o + 2]) > 70) n++;
    }
  return n / ((x1 - x0) * (y1 - y0));
}

function colours(png) {
  const seen = new Set();
  for (let i = 0; i < png.width * png.height && seen.size < 3000; i++) {
    const o = i * png.channels;
    seen.add((png.data[o] << 16) | (png.data[o + 1] << 8) | png.data[o + 2]);
  }
  return seen.size;
}

/** The face as the card draws it: 16 card pixels per skin pixel, hat on top. Matching cells of 8×8. */
async function faceMatches(page, png) {
  const face = await page.evaluate(() => {
    const img = document.querySelector('.sk-editor').__skinEditor.getImage();
    const s = img.width / 64;
    const px = (x, y) => Array.from(img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4));
    const out = [];
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        const hat = px((40 + x) * s, (8 + y) * s);
        out.push(hat[3] >= 128 ? hat.slice(0, 3) : px((8 + x) * s, (8 + y) * s).slice(0, 3));
      }
    return out;
  });
  // the face box: 128 px wide at the left edge, its top found by its first row of exact colours
  let best = 0;
  for (let top = 40; top < 400; top += 1) {
    let hits = 0;
    for (let i = 0; i < 64; i++) {
      const x = 56 + (i % 8) * 16 + 8;
      const y = top + Math.floor(i / 8) * 16 + 8;
      if (y >= png.height) break;
      const o = (y * png.width + x) * png.channels;
      if (png.data[o] === face[i][0] && png.data[o + 1] === face[i][1] && png.data[o + 2] === face[i][2]) hits++;
    }
    best = Math.max(best, hits);
    if (best === 64) break;
  }
  return best;
}

for (const width of [1280, 390]) {
  for (const theme of ['dark', 'light']) {
    const tag = `${width}-${theme}`;
    const { page, context, errors, phone } = await newPage(width, theme);
    await openStarter(page);
    // the default name is not printed on the card
    if (!phone && theme === 'dark') {
      // an empty name field gives the skin the default name ("My skin")
      await rename(page, '');
      await page.click('.sk-bar');
      const plain = await shareCard(page, 'skin-default-name.png');
      check(`share ${tag}: an unnamed skin's card is named "skin"`, plain.name === 'skin-card.png', plain.name);
    }
    await rename(page, 'Night Explorer');
    await (phone ? page.tap('.sk-export-btn') : page.click('.sk-export-btn'));
    await page.waitForSelector(SHARE_ITEM);
    const item = await page.$eval(SHARE_ITEM, (b) => {
      const r = b.getBoundingClientRect();
      return { text: b.textContent, left: r.left, right: r.right, h: r.height, vw: document.documentElement.clientWidth };
    });
    check(`share ${tag}: the Export menu has Share a picture`, /Share a picture/.test(item.text) && /front and back/.test(item.text), item.text);
    check(`share ${tag}: the item is on screen and finger-sized`, item.left >= 0 && item.right <= item.vw + 1 && item.h >= 40, JSON.stringify(item));
    await page.screenshot({ path: path.join(shots, `share-menu-${tag}.png`) });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);

    if (phone && theme === 'light') {
      // a browser that can share files: the card goes to the share sheet
      await page.evaluate(() => {
        window.__shared = null;
        navigator.canShare = (d) => !!d?.files?.length;
        navigator.share = async (d) => {
          const f = d.files[0];
          const b = new Uint8Array(await f.arrayBuffer());
          window.__shared = { name: f.name, type: f.type, size: f.size, sig: String.fromCharCode(...b.slice(1, 4)), title: d.title };
        };
      });
      await page.tap('.sk-export-btn');
      await page.tap(SHARE_ITEM);
      check(`share ${tag}: the share sheet gets the card`, await toastSeen(page, /Picture shared/));
      const s = await page.evaluate(() => window.__shared);
      check(`share ${tag}: …as a PNG named after the skin`, !!s && s.type === 'image/png' && s.sig === 'PNG' && s.size > 10000 && s.name === 'Night Explorer-card.png' && s.title === 'Night Explorer', JSON.stringify(s));
    } else {
      const busy = page.waitForFunction(() => document.querySelector('.sk-export-btn')?.getAttribute('aria-busy') === 'true', null, { timeout: 5000 }).then(() => true, () => false);
      const card = await shareCard(page, !phone && theme === 'dark' ? 'skin.png' : null, phone);
      check(`share ${tag}: Export shows it is busy meanwhile`, await busy);
      check(`share ${tag}: a 1200×675 PNG named after the skin`, card.png.width === 1200 && card.png.height === 675 && card.name === 'Night Explorer-card.png', `${card.name} ${card.png.width}×${card.png.height}`);
      check(`share ${tag}: not blank`, colours(card.png) > 300, String(colours(card.png)));
      const hits = await faceMatches(page, card.png);
      check(`share ${tag}: the skin's face is on it, pixel for pixel`, hits >= 60, `${hits}/64`);
      const front = filled(card.png, 640, 60, 880, 560);
      const back = filled(card.png, 900, 60, 1140, 560);
      check(`share ${tag}: the player stands there twice (front and back)`, front > 0.12 && back > 0.12, `${front.toFixed(2)} ${back.toFixed(2)}`);
      check(`share ${tag}: a toast says where it went`, await toastSeen(page, /Picture saved: Night Explorer-card\.png/));
    }
    await page.waitForFunction(() => !document.querySelector('.sk-export-btn')?.hasAttribute('aria-busy'), null, { timeout: 30000 });
    check(`share ${tag}: nothing wider than the screen`, (await sideways(page)) <= 0, String(await sideways(page)));
    check(`share ${tag}: no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
    await context.close();
  }
}

// Japanese: the item and the toast in Japanese, a Japanese name on the card
{
  const { page, context, errors } = await newPage(1280, 'dark', 'ja-JP');
  await openStarter(page, 'ja');
  await rename(page, '夜の探検家');
  await page.click('.sk-export-btn');
  await page.waitForSelector(SHARE_ITEM);
  check('share ja: the item is Japanese', /画像を共有/.test(await page.textContent(SHARE_ITEM)));
  await page.keyboard.press('Escape');
  const card = await shareCard(page, 'skin-japanese.png');
  check('share ja: a 1200×675 card', card.png.width === 1200 && card.png.height === 675);
  check('share ja: the toast is Japanese', await toastSeen(page, /画像を保存しました/));
  check('share ja: no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await context.close();
}

await browser.close();
await server.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nAll skin share card checks passed');
process.exit(failures ? 1 : 0);
