// End-to-end checks of the pack's picture card (the share button in the editor's top bar): a pack
// with painted textures gives a 1200×675 PNG with the changed textures in it, pixel for pixel, and a
// block made of one of them (with only items changed, the first item big); a pack with many changes
// shows two rows and a "+N" tile; a pack with nothing changed still gives a card; the button shows
// it is busy, then a toast says where the file went; on a phone (light and dark) the button fits the
// bar, a tap downloads the card, and where the browser can share files the card goes to the share
// sheet instead; Japanese, Polish and Russian names draw; no console errors.
// Usage: NODE_PATH=$(npm root -g) TO_FIXTURES=<dir> node tests/e2e/textures/share.e2e.cjs [baseUrl] [--shots <dir>] [--cards <dir>]
// (--cards keeps the PNG cards it made there)
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startVite, launch, routeMojang, fixturesDir, decodePng } = require('./lib.cjs');

const argv = process.argv.slice(2);
const baseArg = argv.find((a) => /^https?:/.test(a));
const opt = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : null);
const shotsDir = opt('--shots');
const cardsDir = opt('--cards');
for (const d of [shotsDir, cardsDir]) if (d) fs.mkdirSync(d, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tx-share-'));
const J = 'assets/minecraft/textures/';
const MAGENTA = [255, 0, 255];
const LIME = [0, 255, 64];

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
}
const shot = async (page, name) => {
  if (shotsDir) await page.screenshot({ path: path.join(shotsDir, `${name}.png`) });
};
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const toastSeen = (page, re) => page.waitForFunction((src) => [...document.querySelectorAll('.toast')].some((t) => new RegExp(src).test(t.textContent || '')), re.source, { timeout: 30000 }).then(() => true, () => false);

async function newPack(page, base, name, lang = '') {
  await page.goto(base + (lang ? `${lang}/` : '') + 'textures/');
  await page.waitForSelector('.tx-new .tx-start-opt');
  await page.fill('.tx-name-field input', name);
  await page.click('.tx-create-btn');
  await page.waitForURL(/textures\/[0-9a-f-]+\/?$/, { timeout: 15000 });
  await page.waitForFunction(() => !!window.__tx && document.querySelector('.tx-main'), null, { timeout: 180000 });
}

/** Paints textures in the store: stripes of a colour over the game's texture (what an edit looks like). */
const paint = (page, paths, rgb, every = 3) =>
  page.evaluate(
    async ([list, c, n]) => {
      for (const p of list) {
        const src = await window.__tx.store.getFull(p);
        const img = new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);
        for (let y = 0; y < img.height; y++)
          for (let x = 0; x < img.width; x++) {
            const o = (y * img.width + x) * 4;
            if ((x + y) % n === 0 && img.data[o + 3] > 0) img.data.set([c[0], c[1], c[2], 255], o);
          }
        window.__tx.store.setImage(p, img);
      }
    },
    [paths, rgb, every],
  );

const setMeta = (page, name, description) =>
  page.evaluate(([n, d]) => {
    const s = window.__tx.store;
    s.project.name = n;
    s.project.description = d;
    s.touch('meta');
  }, [name, description]);

/** Clicks the share button and returns the downloaded card. */
async function shareDownload(page, file, tap = false) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), tap ? page.tap('.tx-share-btn') : page.click('.tx-share-btn')]);
  const out = path.join(tmp, `${Date.now()}-${dl.suggestedFilename()}`);
  await dl.saveAs(out);
  if (cardsDir && file) fs.copyFileSync(out, path.join(cardsDir, file));
  const bytes = fs.readFileSync(out);
  return { name: dl.suggestedFilename(), bytes, png: await decodePng(bytes) };
}

/** What a card's pixels hold: how many colours, how many pixels of a colour. */
function stats(png, colors = []) {
  const ch = png.channels ?? png.data.length / (png.width * png.height);
  const seen = new Set();
  const counts = colors.map(() => 0);
  let opaque = 0;
  for (let i = 0; i < png.width * png.height; i++) {
    const o = i * ch;
    const r = png.data[o];
    const g = png.data[o + 1];
    const b = png.data[o + 2];
    if (ch < 4 || png.data[o + 3] === 255) opaque++;
    if (seen.size < 5000) seen.add((r << 16) | (g << 8) | b);
    colors.forEach((c, k) => {
      if (r === c[0] && g === c[1] && b === c[2]) counts[k]++;
    });
  }
  return { colors: seen.size, counts, opaque: opaque / (png.width * png.height) };
}

/** Colourful pixels (a block, a texture) in a box of the card. */
function busy(png, x0, y0, x1, y1) {
  const ch = png.channels ?? png.data.length / (png.width * png.height);
  let n = 0;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const o = (y * png.width + x) * ch;
      const r = png.data[o];
      const g = png.data[o + 1];
      const b = png.data[o + 2];
      if (Math.max(r, g, b) - Math.min(r, g, b) > 40 || Math.max(r, g, b) > 120) n++;
    }
  return n / ((x1 - x0) * (y1 - y0));
}

/** Pixels within a few steps of a colour in a box of the card. */
function near(png, x0, y0, x1, y1, rgb, tol = 24) {
  const ch = png.channels ?? png.data.length / (png.width * png.height);
  let n = 0;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const o = (y * png.width + x) * ch;
      if (Math.abs(png.data[o] - rgb[0]) <= tol && Math.abs(png.data[o + 1] - rgb[1]) <= tol && Math.abs(png.data[o + 2] - rgb[2]) <= tol) n++;
    }
  return n;
}

(async () => {
  const fx = fixturesDir();
  if (!fx) {
    console.log('SKIP  share e2e needs TO_FIXTURES (the 26.3 client jar)');
    return;
  }
  const vite = baseArg ? null : await startVite();
  const base = baseArg ?? vite.url;
  const browser = await launch();
  const errors = [];
  const watch = (page) => {
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/Failed to load resource|net::ERR|favicon/i.test(m.text())) errors.push(m.text());
    });
  };
  try {
    // ---------------------------------------------------------------- desktop: a pack with painted textures
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, colorScheme: 'dark', acceptDownloads: true });
    await routeMojang(ctx, fx);
    const page = await ctx.newPage();
    watch(page);
    await newPack(page, base, 'E2E Share');
    check('the share button is in the top bar, next to Export', await page.isVisible('.tx-bar-actions .tx-share-btn + .tx-export-btn'));
    check('it is labelled', (await page.getAttribute('.tx-share-btn', 'aria-label')) === 'Share a picture of your pack');
    await setMeta(page, 'Crystal §bCaves', '§7A cosy §6golden§7 pack for survival, with brighter ores and crisp tools.');
    await paint(page, [`${J}block/oak_log.png`, `${J}block/oak_log_top.png`, `${J}block/stone.png`, `${J}block/diamond_ore.png`, `${J}block/oak_planks.png`], LIME, 4);
    await paint(page, [`${J}item/diamond_sword.png`, `${J}item/apple.png`, `${J}item/diamond_pickaxe.png`], MAGENTA, 3);
    await page.evaluate(() => window.__tx.store.flush());
    // the click shows a busy button straight away
    const busyNow = page.waitForFunction(() => document.querySelector('.tx-share-btn')?.getAttribute('aria-busy') === 'true', null, { timeout: 5000 }).then(() => true, () => false);
    const card = await shareDownload(page, 'pack-several-textures.png');
    check('the button showed it was busy', await busyNow);
    check('the card is a PNG named after the pack', /^Crystal Caves-card\.png$/.test(card.name), card.name);
    check('the card is 1200×675', card.png.width === 1200 && card.png.height === 675, `${card.png.width}×${card.png.height}`);
    const st = stats(card.png, [MAGENTA, LIME]);
    check('the card is not blank (many colours, fully opaque)', st.colors > 200 && st.opaque > 0.999, JSON.stringify(st));
    check('the painted items are in it, pixel-crisp (exact colour, scaled up)', st.counts[0] > 600, String(st.counts[0]));
    check('the painted blocks are in it', st.counts[1] > 300, String(st.counts[1]));
    check('a block stands on the right (the hero)', busy(card.png, 820, 60, 1140, 380) > 0.25, String(busy(card.png, 820, 60, 1140, 380).toFixed(2)));
    check('a toast says where the picture went', await toastSeen(page, /Picture saved: Crystal Caves-card\.png/));
    await page.waitForFunction(() => !document.querySelector('.tx-share-btn')?.hasAttribute('aria-busy'));
    check('the button is back to its icon', !!(await page.$('.tx-share-btn [data-icon="share"]')));
    await shot(page, 'share-desktop-dark');

    // many changes: two rows and a "+N" tile; Polish and Russian letters in the name
    const many = await page.evaluate(() =>
      window.__tx.store.entries
        .filter((e) => (e.category === 'block' || e.category === 'item') && !e.animated)
        .slice(40, 100)
        .map((e) => e.path),
    );
    await paint(page, many, MAGENTA, 5);
    await setMeta(page, 'Żółte Łąki · Пак «Ёжик»', '§eŁagodne kolory§r i czyste narzędzia. Мягкие цвета.');
    const big = await shareDownload(page, 'pack-many-textures.png');
    const bs = stats(big.png, [MAGENTA]);
    check('many changes: still 1200×675 and full', big.png.width === 1200 && big.png.height === 675 && bs.colors > 200, JSON.stringify(bs));
    const band = (y0, y1) => stats({ ...big.png, data: big.png.data.slice(y0 * 1200 * (big.png.channels ?? 4), y1 * 1200 * (big.png.channels ?? 4)), height: y1 - y0 }, [MAGENTA]).counts[0];
    check('many changes: the strip has two rows of textures', band(420, 482) > 400 && band(504, 566) > 400, `${band(420, 482)} ${band(504, 566)}`);
    check('many changes: the last tile counts the rest (accent text)', near(big.png, 1064, 500, 1136, 572, [91, 211, 91]) > 150, String(near(big.png, 1064, 500, 1136, 572, [91, 211, 91])));

    // a pack with nothing changed still makes a card
    await newPack(page, base, 'Nothing Changed');
    const plain = await shareDownload(page, 'pack-unchanged.png');
    const ps = stats(plain.png);
    check('nothing changed: a card of the pack’s blocks', plain.png.width === 1200 && ps.colors > 100, JSON.stringify(ps));
    // only items changed: no block to stand up, the first item is the hero, big and flat
    await paint(page, [`${J}item/diamond_sword.png`, `${J}item/bow.png`, `${J}item/golden_apple.png`], MAGENTA, 3);
    const items = await shareDownload(page, 'pack-items-only.png');
    const is = stats(items.png, [MAGENTA]);
    check('items only: the hero is an item, drawn big (lots of its exact colour)', is.counts[0] > 3000 && near(items.png, 820, 60, 1140, 380, MAGENTA, 0) > 1500, `${is.counts[0]} ${near(items.png, 820, 60, 1140, 380, MAGENTA, 0)}`);
    await ctx.close();

    // ---------------------------------------------------------------- Japanese
    const jctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, colorScheme: 'dark', acceptDownloads: true, locale: 'ja-JP' });
    await routeMojang(jctx, fx);
    const jp = await jctx.newPage();
    watch(jp);
    await newPack(jp, base, 'クリスタル洞窟パック', 'ja');
    check('ja: the button is labelled in Japanese', (await jp.getAttribute('.tx-share-btn', 'aria-label')) === 'パックの画像を共有');
    await setMeta(jp, 'クリスタル洞窟パック', '鉱石が明るく、道具がくっきり見えるサバイバル向けのパックです。');
    await paint(jp, [`${J}block/stone.png`, `${J}block/bricks.png`, `${J}item/diamond_sword.png`, `${J}item/golden_apple.png`], MAGENTA, 3);
    const jcard = await shareDownload(jp, 'pack-japanese.png');
    check('ja: a 1200×675 card', jcard.png.width === 1200 && jcard.png.height === 675);
    check('ja: the toast is Japanese', await toastSeen(jp, /画像を保存しました/));
    await jctx.close();

    // ---------------------------------------------------------------- phone, light and dark
    for (const scheme of ['light', 'dark']) {
      const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, hasTouch: true, isMobile: true, deviceScaleFactor: 2, acceptDownloads: true });
      await phone.addInitScript((t) => localStorage.setItem('to-theme', t), scheme);
      await routeMojang(phone, fx);
      const pp = await phone.newPage();
      watch(pp);
      await newPack(pp, base, `Phone ${scheme}`);
      const box = await pp.$eval('.tx-share-btn', (b) => {
        const r = b.getBoundingClientRect();
        return { left: r.left, right: r.right, w: r.width, h: r.height, vw: window.innerWidth, shown: !!b.offsetParent };
      });
      check(`phone ${scheme}: the share button is in the bar, finger-sized, on screen`, box.shown && box.w >= 36 && box.h >= 36 && box.left >= 0 && box.right <= box.vw, JSON.stringify(box));
      const bar = await pp.$eval('.tx-bar', (b) => {
        const name = b.querySelector('.tx-name-input').getBoundingClientRect();
        const acts = b.querySelector('.tx-bar-actions').getBoundingClientRect();
        return { nameRight: name.right, actsLeft: acts.left, overflow: b.scrollWidth > b.clientWidth + 1 };
      });
      check(`phone ${scheme}: the name doesn't run under the buttons`, bar.nameRight <= bar.actsLeft + 1 && !bar.overflow, JSON.stringify(bar));
      check(`phone ${scheme}: no sideways scrolling`, await noSideScroll(pp));
      await shot(pp, `share-phone-${scheme}`);
      await paint(pp, [`${J}block/stone.png`, `${J}item/apple.png`], MAGENTA, 3);
      if (scheme === 'dark') {
        const c = await shareDownload(pp, null, true);
        check(`phone ${scheme}: a tap downloads the card`, c.png.width === 1200 && c.png.height === 675 && stats(c.png, [MAGENTA]).counts[0] > 200);
      } else {
        // a browser that can share files: the card goes to the share sheet
        await pp.evaluate(() => {
          window.__shared = null;
          navigator.canShare = (d) => !!d?.files?.length && d.files.every((f) => f.type === 'image/png');
          navigator.share = async (d) => {
            const f = d.files[0];
            const bytes = new Uint8Array(await f.arrayBuffer());
            window.__shared = { name: f.name, type: f.type, size: f.size, sig: Array.from(bytes.slice(1, 4)), title: d.title };
          };
        });
        await pp.tap('.tx-share-btn');
        check(`phone ${scheme}: the share sheet gets the card`, await toastSeen(pp, /Picture shared/));
        const s = await pp.evaluate(() => window.__shared);
        check(`phone ${scheme}: …as a PNG file named after the pack`, !!s && s.type === 'image/png' && s.size > 10000 && String.fromCharCode(...s.sig) === 'PNG' && s.name === `Phone ${scheme}-card.png` && s.title === `Phone ${scheme}`, JSON.stringify(s));
        // closing the share sheet without sharing: no toast, no error
        await pp.evaluate(() => {
          navigator.share = async () => {
            throw new DOMException('cancelled', 'AbortError');
          };
        });
        await pp.evaluate(() => document.querySelectorAll('.toast').forEach((t) => t.remove()));
        await pp.tap('.tx-share-btn');
        await pp.waitForFunction(() => !document.querySelector('.tx-share-btn')?.hasAttribute('aria-busy'), null, { timeout: 30000 });
        await pp.waitForTimeout(300);
        const after = await pp.$$eval('.toast', (t) => t.map((x) => x.textContent));
        check(`phone ${scheme}: a closed share sheet says nothing`, !after.some((t) => /Picture|Couldn/.test(t)), after.join(' | '));
      }
      await phone.close();
    }

    check('no console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
  } catch (err) {
    console.error(err);
    failures++;
  } finally {
    await browser.close();
    vite?.stop();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(failures ? `\n${failures} check(s) failed` : '\nAll share card checks passed');
  process.exit(failures ? 1 : 0);
})();
