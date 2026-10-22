// Phone checks for the texture pack editor, with touch (as on Android phones): 390 × 844 (dark),
// 360 × 640 (light) and landscape 844 × 390 (dark, then light). A pack is created from the start
// screen; a quick-start tile, a block, an item and a mob picked in the library open on the Paint tab
// with the canvas showing (the block's "Edit shape" is in the texture's menu); a finger tap and a
// finger drag paint the right pixels; pinching zooms the canvas, not the page; the controls a finger
// needs (swap colours, palette, library switch, grid / list, clear search, pack name, "Used by",
// "Edit shape", 3D camera views, mob parts) take a 44 px tap; nothing is cut off at the right edge
// unless it is in a row that scrolls with a fade; no sideways page scrolling; landscape keeps the
// phone tab bar, drops the site bar and gives the canvas at least 250 px; the hints say "Tap" and
// the keyboard hints are hidden; the model editor's buttons don't overlap; the colour picker shows the
// whole hex value; a sound's weight / volume / pitch tags aren't cut off; no console errors.
// Usage: NODE_PATH=$(npm root -g) TO_FIXTURES=<dir> node tests/e2e/textures/phone.e2e.cjs [baseUrl] [--shots <dir>]
// (PHONE_ONLY=390|360|landscape runs one of the three)
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { startVite, launch, routeMojang, fixturesDir } = require('./lib.cjs');

const argv = process.argv.slice(2);
const baseArg = argv.find((a) => /^https?:/.test(a));
const shotsDir = argv.includes('--shots') ? argv[argv.indexOf('--shots') + 1] : null;
if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const OAK = 'assets/minecraft/textures/block/oak_log.png';

const PHONES = [
  { tag: '390', w: 390, h: 844, scheme: 'dark', other: 'light' },
  { tag: '360', w: 360, h: 640, scheme: 'light', other: 'dark' },
  { tag: 'landscape', w: 844, h: 390, scheme: 'dark', other: 'light', landscape: true },
];

// The game's sounds, made up: one sound has a weight, a volume and a pitch to show as tags.
const SOUNDS_JSON = {
  'block.stone.break': { sounds: ['block/stone/break1', { name: 'block/stone/break2', volume: 0.9, pitch: 0.8, weight: 2 }] },
  'ui.button.click': { sounds: ['random/click'] },
};
const hashOf = (s) => crypto.createHash('sha1').update(s).digest('hex');
const SOUND_INDEX = { objects: { 'minecraft/sounds.json': { hash: hashOf('sounds.json'), size: 1 } } };
for (const e of Object.values(SOUNDS_JSON)) for (const s of e.sounds) SOUND_INDEX.objects[`minecraft/sounds/${typeof s === 'string' ? s : s.name}.ogg`] = { hash: hashOf(String(s.name ?? s)), size: 1 };
async function routeSounds(ctx) {
  const cors = { 'access-control-allow-origin': '*' };
  await ctx.route(/^https:\/\/piston-meta\.mojang\.com\/v1\/packages\/[0-9a-f]+\/\d+\.json$/, (r) => r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(SOUND_INDEX) }));
  await ctx.route(/^https:\/\/(raw\.githubusercontent\.com\/misode\/mcmeta\/|cdn\.jsdelivr\.net\/gh\/misode\/mcmeta@)[^/]+-assets\/assets\/minecraft\/sounds\.json$/, (r) =>
    r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(SOUNDS_JSON) }),
  );
  await ctx.route(/^https:\/\/resources\.download\.minecraft\.net\//, (r) => r.fulfill({ status: 404, body: '' }));
}

async function newPack(page, base, name) {
  await page.goto(base + '#/textures');
  await page.waitForSelector('.tx-new');
  await page.fill('.tx-name-field input', name);
  await page.locator('.tx-create-btn').tap();
  await page.waitForURL(/(#\/|\/)textures\/[0-9a-f-]+\/?$/, { timeout: 15000 });
  await page.waitForFunction(() => !!window.__tx && document.querySelector('.tx-main'), null, { timeout: 120000 });
  await page.waitForFunction(() => window.__tx.models.lib?.usageReady, null, { timeout: 180000 });
  await page.waitForTimeout(400);
}

const mobileTab = (page) => page.evaluate(() => document.querySelector('.tx-editor')?.dataset.mobile ?? null);
const tapTab = async (page, v) => {
  await page.locator(`.tx-tabbar-btn[data-v="${v}"]`).tap();
  await page.waitForFunction((x) => document.querySelector('.tx-editor')?.dataset.mobile === x, v);
  await page.waitForTimeout(250);
};

/** The pixel editor's canvas on screen: its box, or null when it isn't showing. */
const canvasBox = (page) =>
  page.evaluate(() => {
    const pc = window.__tx.canvas.canvas();
    const c = pc?.element.querySelector('canvas');
    if (!c || !c.offsetParent) return null;
    const r = c.getBoundingClientRect();
    const vis = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
    return { x: r.x, y: r.y, w: r.width, h: r.height, visibleH: vis };
  });

/** Screen point of the middle of texel (x, y) of the pixel editor. */
const texelScreen = (page, x, y) =>
  page.evaluate(
    ([px, py]) => {
      const pc = window.__tx.canvas.canvas();
      const r = pc.element.querySelector('canvas').getBoundingClientRect();
      const [sx, sy] = pc.getView().toScreen(px + 0.5, py + 0.5);
      return [r.left + sx, r.top + sy];
    },
    [x, y],
  );

async function touch(cdp, type, pts) {
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1 })) });
}

/**
 * How big a tap on `sel` is: from the middle of each visible match, how far a finger can land and
 * still hit it (elementFromPoint, so ::after hit areas count and covering elements don't).
 */
const hitSizes = (page, sel) =>
  page.evaluate((s) => {
    const out = [];
    for (const el of document.querySelectorAll(s)) {
      if (!el.checkVisibility?.({ visibilityProperty: true }) || !el.getBoundingClientRect().width) continue;
      // scrolled into view first (a row that scrolls sideways, a panel that scrolls down)
      el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const hits = (x, y) => {
        const t = document.elementFromPoint(x, y);
        return !!t && (t === el || el.contains(t));
      };
      if (!hits(cx, cy)) {
        out.push({ label: (el.getAttribute('aria-label') || el.textContent || el.className).trim().slice(0, 30), w: 0, h: 0 });
        continue;
      }
      const reach = (dx, dy) => {
        let d = 0;
        while (d < 60 && hits(cx + dx * (d + 1), cy + dy * (d + 1))) d++;
        return d;
      };
      out.push({ label: (el.getAttribute('aria-label') || el.textContent || el.className).trim().slice(0, 30), w: reach(-1, 0) + reach(1, 0) + 1, h: reach(0, -1) + reach(0, 1) + 1 });
    }
    return out;
  }, sel);

async function checkTargets(page, tag, name, sel, { min = 44, need = true } = {}) {
  const sizes = await hitSizes(page, sel);
  if (!sizes.length) {
    if (need) check(`${tag}: ${name} on screen`, false, sel);
    return;
  }
  const small = sizes.filter((s) => s.w < min - 1 || s.h < min - 1);
  check(`${tag}: ${name} take a ${min} px tap`, small.length === 0, small.length ? small.map((s) => `${s.label} ${s.w}×${s.h}`).join(', ') : `${sizes.length} × ≥ ${Math.min(...sizes.map((s) => Math.min(s.w, s.h)))} px`);
}

/** Controls cut by an edge must be in a sideways scroller that fades that edge; no page scrolling sideways. */
async function checkEdges(page, tag, where) {
  const r = await page.evaluate(() => {
    const bad = [];
    const sel = 'button, a[href], input, select, [role="button"], [role="tab"], .chip, .segmented-item, .icon-btn, .tx-tool, .tx-pal';
    for (const el of document.querySelectorAll(sel)) {
      const b = el.getBoundingClientRect();
      if (b.width < 2 || b.height < 2 || !el.checkVisibility?.({ visibilityProperty: true })) continue;
      if (b.bottom <= 0 || b.top >= innerHeight) continue;
      let clipper = null;
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
        const ab = a.getBoundingClientRect();
        if (b.right > ab.right + 1 || b.left < ab.left - 1) {
          clipper = a;
          break;
        }
      }
      const offPage = b.right > innerWidth + 1 || b.left < -1;
      if (!clipper && !offPage) continue;
      // fine inside a sideways scroller whose cut edge fades out
      const cs = clipper && getComputedStyle(clipper);
      const scrolls = cs && (cs.overflowX === 'auto' || cs.overflowX === 'scroll') && clipper.scrollWidth > clipper.clientWidth + 1;
      const fades = cs && (cs.maskImage || cs.webkitMaskImage || 'none') !== 'none';
      if (scrolls && fades) continue;
      bad.push(`${(el.getAttribute('aria-label') || el.textContent || el.className).trim().slice(0, 24)} r=${Math.round(b.right)} in ${clipper ? clipper.className.split(' ')[0] : 'page'}${scrolls ? ' (scrolls, no fade)' : ''}`);
    }
    return { bad: [...new Set(bad)].slice(0, 8), sideways: document.documentElement.scrollWidth - innerWidth };
  });
  check(`${tag}: ${where}: nothing cut off at an edge without a scroll fade`, r.bad.length === 0, r.bad.join(' | '));
  check(`${tag}: ${where}: no sideways page scrolling`, r.sideways <= 0, `${r.sideways}px`);
}

(async () => {
  const fx = fixturesDir();
  if (!fx && !baseArg) {
    console.log('SKIP  phone checks need the game files: set TO_FIXTURES');
    return;
  }
  const server = baseArg ? null : await startVite();
  const base = baseArg ?? server.url;
  const browser = await launch();
  const errors = [];
  const shot = async (page, name) => {
    if (shotsDir) await page.screenshot({ path: path.join(shotsDir, `phone-${name}.png`) });
  };
  try {
    for (const P of PHONES.filter((p) => !process.env.PHONE_ONLY || p.tag === process.env.PHONE_ONLY)) {
      const tag = `${P.tag} ${P.w}×${P.h}`;
      const ctx = await browser.newContext({ viewport: { width: P.w, height: P.h }, deviceScaleFactor: 2.75, hasTouch: true, isMobile: true, colorScheme: P.scheme, userAgent: UA });
      await routeMojang(ctx, fx);
      await routeSounds(ctx);
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(`${tag}: ${m.text()}`);
      });
      const cdp = await ctx.newCDPSession(page);
      await newPack(page, base, `Phone ${P.tag}`);
      check(`${tag}: a finger is the main pointer`, await page.evaluate(() => matchMedia('(pointer: coarse)').matches));

      // ---------------------------------------------------------------- layout
      const lay = await page.evaluate(() => {
        const tb = document.querySelector('.tx-tabbar');
        const top = document.querySelector('.topbar');
        return { tabbar: !!tb && getComputedStyle(tb).display !== 'none' && tb.getBoundingClientRect().bottom <= innerHeight + 1, siteBar: !!top && getComputedStyle(top).display !== 'none' };
      });
      check(`${tag}: the phone tab bar is on screen`, lay.tabbar);
      if (P.landscape || P.h <= 700) check(`${tag}: the site bar makes way for the editor`, !lay.siteBar);
      else check(`${tag}: the site bar stays on a tall phone`, lay.siteBar);
      check(`${tag}: a new pack opens on the Paint tab`, (await mobileTab(page)) === 'editor');

      // ---------------------------------------------------------------- quick start
      await page.locator('.tx-pick:visible').first().tap();
      await page.waitForFunction(() => !!window.__tx.canvas.current(), null, { timeout: 15000 });
      await page.waitForTimeout(300);
      check(`${tag}: a quick-start tile opens on the Paint tab`, (await mobileTab(page)) === 'editor' && !!(await canvasBox(page)));

      // ---------------------------------------------------------------- the library opens textures on Paint
      const openFromLibrary = async (mode, id, path) => {
        await tapTab(page, 'textures');
        await page.locator(`.tx-libbar .segmented-item[data-value="${mode}"]:visible`).tap();
        const search = page.locator('.tx-mb .tx-search-input:visible');
        await search.tap();
        await search.fill(id.replace(/_/g, ' '));
        await page.waitForSelector(`.tx-mb .tx-tile[data-id="${id}"]:visible`, { timeout: 30000 });
        await page.waitForTimeout(300);
        await page.locator(`.tx-mb .tx-tile[data-id="${id}"]:visible`).first().tap();
        await page.waitForFunction((p) => window.__tx.canvas.current()?.key === p, path, { timeout: 30000 });
        await page.waitForTimeout(500);
        const tab = await mobileTab(page);
        const box = await canvasBox(page);
        check(`${tag}: a ${mode.replace(/s$/, '')} from the library opens on the Paint tab with the canvas`, tab === 'editor' && !!box && box.visibleH > 100, `tab ${tab}, canvas ${box ? `${Math.round(box.w)}×${Math.round(box.visibleH)}` : 'hidden'}`);
      };
      await openFromLibrary('items', 'diamond_sword', 'assets/minecraft/textures/item/diamond_sword.png');
      await openFromLibrary('mobs', 'creeper', 'assets/minecraft/textures/entity/creeper/creeper.png');
      // the library's own controls, with a search typed (its clear button shows)
      await tapTab(page, 'textures');
      await page.locator('.tx-libbar .segmented-item[data-value="blocks"]:visible').tap();
      await page.locator('.tx-mb .tx-search-input:visible').fill('oak log');
      await page.waitForSelector('.tx-mb .tx-tile[data-id="oak_log"]:visible', { timeout: 30000 });
      await shot(page, `${P.tag}-library`);
      await checkTargets(page, tag, 'library switch (Blocks / Items / Mobs / All / GUI / Sounds)', '.tx-libbar .segmented-item');
      await checkTargets(page, tag, 'grid / list buttons', '.tx-mb .tx-seg .icon-btn');
      await checkTargets(page, tag, '"Clear search"', '.tx-mb .tx-search-clear');
      check(`${tag}: no "/" keyboard hint in the search field`, !(await page.locator('.tx-search-kbd:visible').count()));
      await checkEdges(page, tag, 'library');
      await page.locator('.tx-mb .tx-tile[data-id="oak_log"]:visible').first().tap();
      await page.waitForFunction((p) => window.__tx.canvas.current()?.key === p, OAK, { timeout: 30000 });
      await page.waitForTimeout(600);
      const box = await canvasBox(page);
      check(`${tag}: a block from the library opens on the Paint tab with the canvas`, (await mobileTab(page)) === 'editor' && !!box && box.visibleH > 100, box ? `${Math.round(box.w)}×${Math.round(box.visibleH)}` : 'hidden');
      if (P.landscape) check(`${tag}: the canvas gets at least 250 px of height`, !!box && box.visibleH >= 250, box ? `${Math.round(box.visibleH)} px` : 'hidden');

      // ---------------------------------------------------------------- the Paint tab
      await shot(page, `${P.tag}-paint`);
      await page.emulateMedia({ colorScheme: P.other });
      await page.waitForTimeout(300);
      await shot(page, `${P.tag}-paint-${P.other}`);
      await page.emulateMedia({ colorScheme: P.scheme });
      await checkTargets(page, tag, 'swap colours', '.tx-swap');
      await checkTargets(page, tag, 'palette swatches', '.tx-pal-row .tx-pal');
      await checkTargets(page, tag, '"Used by" chips', '.tx-usedby-chip');
      await checkTargets(page, tag, 'pack name field', '.tx-name-input');
      await checkTargets(page, tag, 'drawing tools', '.tx-tool', { min: 40 });
      await checkEdges(page, tag, 'Paint tab');

      // finger tap and drag paint the pixels under the finger
      await page.evaluate(() => {
        const pc = window.__tx.canvas.canvas();
        pc.setTool('pencil');
        pc.setBrushSize(1);
        pc.setColor([255, 0, 0, 255]);
      });
      const scrollBefore = await page.evaluate(() => [scrollX, scrollY]);
      let [x, y] = await texelScreen(page, 3, 3);
      await page.touchscreen.tap(x, y);
      await page.waitForTimeout(300);
      check(`${tag}: a finger tap paints the texel under it`, eq(await page.evaluate(() => window.__tx.pixel(3, 3)), [255, 0, 0, 255]), JSON.stringify(await page.evaluate(() => window.__tx.pixel(3, 3))));
      const p0 = await texelScreen(page, 1, 10);
      const p1 = await texelScreen(page, 14, 10);
      await touch(cdp, 'touchStart', [p0]);
      for (let i = 1; i <= 13; i++) await touch(cdp, 'touchMove', [[p0[0] + ((p1[0] - p0[0]) * i) / 13, p0[1]]]);
      await touch(cdp, 'touchEnd', []);
      await page.waitForTimeout(400);
      const row = await page.evaluate(() => {
        let n = 0;
        for (let i = 1; i <= 14; i++) if (JSON.stringify(window.__tx.pixel(i, 10)) === '[255,0,0,255]') n++;
        return n;
      });
      check(`${tag}: a finger drag paints the row it crosses`, row >= 13, `${row} / 14`);
      check(`${tag}: painting doesn't scroll the page`, eq(await page.evaluate(() => [scrollX, scrollY]), scrollBefore));

      // pinch zooms the canvas, not the page
      const z0 = await page.evaluate(() => window.__tx.canvas.canvas().getView().scale);
      const before = await page.evaluate(() => JSON.stringify(Array.from(window.__tx.canvas.current().full.data)));
      const cb = await canvasBox(page);
      const cx = cb.x + cb.w / 2;
      const cy = cb.y + Math.min(cb.h, cb.visibleH) / 2;
      await touch(cdp, 'touchStart', [
        [cx - 30, cy],
        [cx + 30, cy],
      ]);
      for (let i = 1; i <= 10; i++)
        await touch(cdp, 'touchMove', [
          [cx - 30 - 8 * i, cy],
          [cx + 30 + 8 * i, cy],
        ]);
      await touch(cdp, 'touchEnd', []);
      await page.waitForTimeout(500);
      const z1 = await page.evaluate(() => window.__tx.canvas.canvas().getView().scale);
      check(`${tag}: pinching zooms the canvas`, z1 > z0 * 1.2, `${z0.toFixed(1)} → ${z1.toFixed(1)} px per texel`);
      check(`${tag}: pinching doesn't zoom the page`, (await page.evaluate(() => visualViewport.scale)) === 1);
      check(`${tag}: pinching doesn't paint`, (await page.evaluate(() => JSON.stringify(Array.from(window.__tx.canvas.current().full.data)))) === before);
      await page.evaluate(() => window.__tx.canvas.canvas().zoomToFit());

      // "Edit shape" from the texture's menu
      await page.locator('.tx-head-actions .icon-btn:visible').last().tap();
      const editItem = page.locator('.menu-item:visible', { hasText: 'Edit shape' });
      check(`${tag}: the texture's menu offers "Edit shape"`, (await editItem.count()) === 1);
      if (await editItem.count()) {
        await editItem.tap();
        await page.waitForFunction(() => !!window.__tx.modelEditor(), null, { timeout: 30000 });
        await page.waitForTimeout(800);
        check(`${tag}: "Edit shape" opens the model editor`, await page.isVisible('.me-root'));
        await page.locator('.me-back').tap();
        await page.waitForFunction(() => !window.__tx.modelEditor(), null, { timeout: 10000 });
        await page.waitForTimeout(400);
      }

      // ---------------------------------------------------------------- Preview: touch wording and targets
      await tapTab(page, 'preview');
      await page.waitForFunction(() => window.__tx.preview.current()?.entry.id === 'oak_log', null, { timeout: 30000 });
      await page.waitForTimeout(600);
      const hint = await page.textContent('.tx-pv-texhint');
      check(`${tag}: the preview says "Tap", not "Click"`, /^Tap /.test(hint ?? '') && !/click/i.test(hint ?? ''), hint);
      await shot(page, `${P.tag}-preview`);
      await checkTargets(page, tag, '"Edit shape"', '.tx-pv-shapebtn');
      await checkEdges(page, tag, 'Preview tab');

      // a mob's parts
      await page.evaluate(() => window.__tx.showMob('creeper'));
      await page.waitForFunction(() => window.__tx.preview.current()?.entry.id === 'creeper' && window.__tx.preview.view3d()?.mode === 'model', null, { timeout: 60000 });
      await page.waitForTimeout(600);
      await tapTab(page, 'preview');
      const parts = await page.evaluate(() => [...document.querySelectorAll('.tx-pv-partsection p')].map((p) => p.textContent).join(' '));
      check(`${tag}: mob parts say "Double-tap"`, /Double-tap/.test(parts) && !/click/i.test(parts), parts);
      await page.locator('.tx-pv-part').first().scrollIntoViewIfNeeded();
      await checkTargets(page, tag, 'mob part chips', '.tx-pv-part');

      // ---------------------------------------------------------------- 3D workspace: camera views
      await page.evaluate(() => window.__tx.setWorkspace('3d'));
      await page.evaluate((p) => window.__tx.open(p), OAK);
      await page.evaluate(() => window.__tx.showBlock('oak_log'));
      await page.waitForTimeout(1200);
      if ((await mobileTab(page)) !== 'editor') await tapTab(page, 'editor');
      await page.waitForTimeout(600);
      await shot(page, `${P.tag}-paint3d`);
      await checkTargets(page, tag, '3D camera views (F / B / L / R / T)', '.tx-pv-view-btn');
      const overlaps = await page.evaluate(() => {
        const els = [...document.querySelectorAll('.tx-stage3d .tx-pv-views, .tx-stage3d .tx-pv-float, .tx-stage3d .tx-pv-hint:not(.is-idle), .tx-ws-switch, .tx-stage3d .tx-pv-partsbtn')].filter((e) => e.checkVisibility?.({ visibilityProperty: true }) && e.getBoundingClientRect().width);
        const out = [];
        for (let i = 0; i < els.length; i++)
          for (let j = i + 1; j < els.length; j++) {
            const a = els[i].getBoundingClientRect();
            const b = els[j].getBoundingClientRect();
            if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) out.push(`${els[i].className} × ${els[j].className}`);
          }
        return out;
      });
      check(`${tag}: the 3D view's buttons don't overlap`, overlaps.length === 0, overlaps.join(', '));
      await checkEdges(page, tag, '3D workspace');
      await page.evaluate(() => window.__tx.setWorkspace('2d'));

      // ---------------------------------------------------------------- model editor: the empty model's card
      await page.evaluate(() => window.__tx.editModel('item', 'diamond_sword'));
      await page.waitForFunction(() => !!window.__tx.modelEditor() && !!document.querySelector('.me-start:not([hidden])'), null, { timeout: 30000 });
      await page.waitForTimeout(800);
      const meOverlap = await page.evaluate(() => {
        const vis = (e) => e.checkVisibility?.({ visibilityProperty: true }) && e.getBoundingClientRect().width > 0;
        const card = document.querySelector('.me-start');
        const controls = [...document.querySelectorAll('.me-stage .me-view-btn, .me-stage-tools .segmented, .me-stage-tools .me-snap')].filter(vis);
        const c = card.getBoundingClientRect();
        const hit = controls.filter((e) => {
          const b = e.getBoundingClientRect();
          return b.left < c.right && c.left < b.right && b.top < c.bottom && c.top < b.bottom;
        });
        return hit.map((e) => e.textContent.trim() || e.className);
      });
      check(`${tag}: the model editor's "start from" card covers none of its buttons`, meOverlap.length === 0, meOverlap.join(', '));
      const meTabs = await page.evaluate(() => {
        const t = [...document.querySelectorAll('.me-side-tabs .tabs')].find((e) => e.getBoundingClientRect().width > 0);
        return t ? { fits: t.scrollWidth <= t.clientWidth + 1, w: `${t.scrollWidth} in ${t.clientWidth} px` } : { fits: true, w: 'no tabs' };
      });
      check(`${tag}: the model editor's tabs fit their row`, meTabs.fits, meTabs.w);
      check(`${tag}: model editor: no sideways page scrolling`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await shot(page, `${P.tag}-model-editor`);
      await page.locator('.me-back').tap();
      await page.waitForFunction(() => !window.__tx.modelEditor(), null, { timeout: 10000 });

      // ---------------------------------------------------------------- colour picker
      await tapTab(page, 'editor');
      await page.locator('.tx-swatch-primary').tap();
      await page.waitForSelector('.cp-hex', { timeout: 5000 });
      const hex = await page.evaluate(() => {
        const i = document.querySelector('.cp-hex');
        const cs = getComputedStyle(i);
        const c = document.createElement('canvas').getContext('2d');
        c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const text = Math.max(...['#5bd35b', '#dddddd', '#000000', i.value].map((s) => c.measureText(s).width));
        const room = i.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        // on screen without scrolling the picker: inside its popover's box and the viewport
        const b = i.getBoundingClientRect();
        const p = i.closest('.popover').getBoundingClientRect();
        const shown = b.top >= Math.max(0, p.top) - 1 && b.bottom <= Math.min(innerHeight, p.bottom) + 1 && b.left >= 0 && b.right <= innerWidth;
        return { fits: i.scrollWidth <= i.clientWidth && text <= room, shown, value: `${i.value}: ${Math.round(text)} px of text in ${Math.round(room)} px` };
      });
      check(`${tag}: the colour picker shows the whole hex value`, hex.fits, hex.value);
      check(`${tag}: the colour picker's hex field is on screen`, hex.shown);
      await shot(page, `${P.tag}-colour`);
      await page.keyboard.press('Escape');

      // ---------------------------------------------------------------- a sound's tags
      await tapTab(page, 'textures');
      await page.locator('.tx-libbar .segmented-item[data-value="sounds"]:visible').first().tap();
      await page.waitForFunction(() => document.querySelectorAll('.snd-row').length > 0, null, { timeout: 60000 });
      await page.locator('.snd-row:has-text("block.stone.break")').first().tap();
      await page.waitForSelector('.snd-panel .snd-var .snd-tag', { timeout: 30000 });
      if ((await mobileTab(page)) !== 'editor') await tapTab(page, 'editor');
      const tags = await page.evaluate(() => {
        const out = { n: 0, cut: [] };
        for (const t of document.querySelectorAll('.snd-panel .snd-tag')) {
          const b = t.getBoundingClientRect();
          if (!b.width) continue;
          out.n++;
          for (let a = t.parentElement; a && a !== document.body; a = a.parentElement) {
            const cs = getComputedStyle(a);
            if (cs.overflowX === 'visible') continue;
            const ab = a.getBoundingClientRect();
            if (b.right > ab.right + 1 || b.left < ab.left - 1) {
              out.cut.push(`${t.textContent} in ${a.className.split(' ')[0]}`);
              break;
            }
          }
          if (b.right > innerWidth + 1) out.cut.push(`${t.textContent} off the screen`);
        }
        return out;
      });
      check(`${tag}: a sound's tags (weight · volume · pitch) aren't cut off`, tags.n >= 3 && tags.cut.length === 0, tags.cut.length ? tags.cut.join(', ') : `${tags.n} tags`);
      await shot(page, `${P.tag}-sound`);
      await ctx.close();
    }
  } finally {
    await browser.close();
    server?.stop();
  }
  check('no console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
  console.log(failures ? `\n${failures} check(s) failed` : '\nall phone checks passed');
  process.exitCode = failures ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
