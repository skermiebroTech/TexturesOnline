// End-to-end checks for mob models in the texture pack maker: the Mobs list, opening a mob texture
// shows its mob, painting the creeper's face on the 3D model (one undo step, the texture's history),
// the hover names the body part, hiding / soloing body parts, the "Used by" chip, a phone tap, things
// mobs wear (a saddle on the pig painted on its own texture, iron armour on the zombie with the
// chestplate hidden to paint the body, armour opening on the armour stand), and the Bedrock creeper
// drawn from Bedrock's own geometry and a Bedrock horse in armour.
// Usage: NODE_PATH=$(npm root -g) node tests/e2e/textures/mobs.e2e.cjs [baseUrl] [--no-bedrock] [--shots <dir>]
const fs = require('node:fs');
const path = require('node:path');
const { startVite, launch, routeMojang, fixturesDir } = require('./lib.cjs');

const argv = process.argv.slice(2);
const baseArg = argv.find((a) => /^https?:/.test(a));
const doBedrock = !argv.includes('--no-bedrock');
const shotsDir = argv.includes('--shots') ? argv[argv.indexOf('--shots') + 1] : null;
if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });

let failures = 0;
const results = [];
function check(name, ok, detail = '') {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  console.log(results[results.length - 1]);
  if (!ok) failures++;
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const CREEPER = 'assets/minecraft/textures/entity/creeper/creeper.png';
const SADDLE = 'assets/minecraft/textures/entity/equipment/pig_saddle/saddle.png';
const PIG = 'assets/minecraft/textures/entity/pig/pig_temperate.png';
const IRON = 'assets/minecraft/textures/entity/equipment/humanoid/iron.png';
const ZOMBIE = 'assets/minecraft/textures/entity/zombie/zombie.png';

async function newPack(page, base, name, bedrock = false) {
  await page.goto(base + '#/textures');
  await page.waitForSelector('.tx-new');
  if (bedrock) {
    await page.click('.tx-new .segmented-item[data-value="bedrock"]');
    await page.waitForFunction(() => /Bedrock/.test(document.querySelector('.tx-new .vp-trigger')?.textContent ?? ''));
  }
  await page.fill('.tx-name-field input', name);
  await page.click('.tx-create-btn');
  await page.waitForURL(/(#\/|\/)textures\/[0-9a-f-]+\/?$/, { timeout: 15000 });
  await page.waitForFunction(() => !!window.__tx && document.querySelector('.tx-main'), null, { timeout: 120000 });
  await page.waitForFunction(() => window.__tx.models.lib?.usageReady, null, { timeout: 180000 });
}

/** Waits for a mob's 3D model with `path` open in the pixel editor. */
async function mobShown(page, id, texture) {
  await page.waitForFunction((i) => window.__tx.preview.current()?.entry.id === i && window.__tx.preview.view3d()?.mode === 'model', id, { timeout: 60000 });
  await page.waitForFunction((p) => window.__tx.canvas.current()?.key === p && !!window.__tx.canvas.canvas(), texture, { timeout: 30000 });
  await page.waitForTimeout(400);
}

/** Screen point of texel (x, y) of a texture on the 3D model, null when no face shows it. */
async function texelPoint(page, p, x, y, w, h, tries = 40) {
  for (let i = 0; i < tries; i++) {
    const pt = await page.evaluate(([pp, xx, yy, ww, hh]) => window.__tx.preview.view3d()?.texelPoint(pp, xx, yy, ww, hh) ?? null, [p, x, y, w, h]);
    if (pt) return pt;
    await page.waitForTimeout(200);
  }
  return null;
}

const pixel = (page, x, y) => page.evaluate(([xx, yy]) => window.__tx.pixel(xx, yy), [x, y]);

/** The first opaque texel of the open texture in a region that a face shows on screen. */
async function shownTexel(page, p, w, h, [u0, v0, u1, v1]) {
  const opaque = await page.evaluate(
    ([a, b, c, d]) => {
      const out = [];
      for (let v = b; v < d; v++) for (let u = a; u < c; u++) if (window.__tx.pixel(u, v)?.[3] === 255) out.push([u, v]);
      return out;
    },
    [u0, v0, u1, v1],
  );
  for (const [u, v] of opaque) {
    const pt = await page.evaluate(([pp, uu, vv, ww, hh]) => window.__tx.preview.view3d()?.texelPoint(pp, uu, vv, ww, hh) ?? null, [p, u, v, w, h]);
    if (pt) return { u, v, pt };
  }
  return null;
}
const setColor = (page, c) => page.evaluate((cc) => window.__tx.canvas.canvas().setColor(cc), c);
const setTool = (page, t) => page.evaluate((tt) => window.__tx.canvas.canvas().setTool(tt), t);
const isEdited = (page, p) => page.evaluate((pp) => window.__tx.store.isEdited(pp), p);
const partChips = (page) =>
  page.evaluate(() => [...document.querySelectorAll('.tx-pv-partsection .tx-pv-part')].map((b) => ({ name: b.dataset.part, label: b.textContent.trim(), on: b.getAttribute('aria-pressed') === 'true' })));

(async () => {
  const server = baseArg ? null : await startVite();
  const base = baseArg || server.url;
  const fx = fixturesDir();
  console.log(`base ${base} · fixtures ${fx ?? '(none: real network)'}`);
  const browser = await launch();
  const errors = [];
  const watch = (page) => {
    page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon|ERR_|404/.test(m.text())) errors.push(m.text());
    });
  };
  try {
    // ------------------------------------------------------------------ Java 26.3, desktop
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await routeMojang(ctx, fx);
    const page = await ctx.newPage();
    watch(page);
    await newPack(page, base, 'E2E Mobs');

    // the Mobs list
    await page.locator('.tx-libbar .segmented-item[data-value="mobs"]:visible').first().click();
    await page.waitForFunction(() => document.querySelectorAll('.tx-mb-tile').length > 10, null, { timeout: 30000 });
    const tiles = await page.evaluate(() => [...document.querySelectorAll('.tx-mb-tile')].map((t) => t.dataset.id));
    check('the Mobs list shows mobs', tiles[0] === 'allay', tiles.slice(0, 4).join(', '));
    const count = await page.evaluate(() => document.querySelector('.tx-mb')?.textContent.match(/(\d+) mobs/)?.[1]);
    check('the list counts the mobs', Number(count) >= 80, `${count} mobs`);
    await page.locator('.tx-search-input[placeholder="Search mobs"]:visible').fill('creep');
    await page.waitForFunction(() => document.querySelectorAll('.tx-mb-tile').length < 5, null, { timeout: 10000 }).catch(() => undefined);
    const found = await page.evaluate(() => [...document.querySelectorAll('.tx-mb-tile')].map((t) => t.dataset.id));
    check('searching the list finds the creeper', eq(found, ['creeper']), found.join(', '));
    await page.locator('.tx-search-input[placeholder="Search mobs"]:visible').fill('');

    // opening the creeper texture shows the creeper
    await page.evaluate((p) => window.__tx.open(p), CREEPER);
    await page.waitForFunction(() => window.__tx.preview.current()?.entry.kind === 'entity', null, { timeout: 60000 }).catch(() => undefined);
    const cur = await page.evaluate(() => window.__tx.preview.current() && { kind: window.__tx.preview.current().entry.kind, id: window.__tx.preview.current().entry.id });
    check('opening creeper.png shows the creeper mob', eq(cur, { kind: 'entity', id: 'creeper' }), JSON.stringify(cur));
    const used = await page.evaluate(() => [...document.querySelectorAll('.tx-usedby-chip')].map((b) => `${b.dataset.kind}:${b.dataset.id}`));
    check('"Used by" names the creeper', used.includes('entity:creeper'), used.join(', '));

    // the 3D workspace with the creeper
    await page.evaluate(() => window.__tx.setWorkspace('3d'));
    await page.evaluate(() => window.__tx.showMob('creeper'));
    await mobShown(page, 'creeper', CREEPER);
    check('the mob is drawn as a model in the main stage', await page.evaluate(() => !!document.querySelector('.tx-stage3d .tx-pv-hero .preview-stage canvas')));
    const chips = await partChips(page);
    check('the parts list names the creeper parts', chips.length === 6 && chips.every((c) => c.on) && chips.some((c) => c.label === 'Head'), chips.map((c) => c.label).join(', '));

    // paint the face
    await setTool(page, 'pencil');
    await setColor(page, [20, 120, 255, 255]);
    const face = await texelPoint(page, CREEPER, 12, 12, 64, 32);
    check('the creeper face texel is on screen', !!face, JSON.stringify(face));
    if (face) {
      await page.mouse.move(face.x, face.y);
      await page.waitForTimeout(250);
      const hint = await page.evaluate(() => document.querySelector('.tx-pv-hint:not(.is-idle)')?.textContent ?? null);
      check('hovering names the body part and texel', /Head/.test(hint ?? '') && /12, 12/.test(hint ?? ''), hint?.trim());
      const before = await pixel(page, 12, 12);
      await page.mouse.down();
      await page.mouse.up();
      await page.waitForTimeout(300);
      check('a click paints texel (12, 12) of creeper.png', eq(await pixel(page, 12, 12), [20, 120, 255, 255]), JSON.stringify(await pixel(page, 12, 12)));
      check('creeper.png is marked edited', await isEdited(page, CREEPER));
      if (shotsDir) await page.screenshot({ path: path.join(shotsDir, 'mobs-creeper-painted.png') });
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(250);
      check('undo restores the texel', eq(await pixel(page, 12, 12), before), JSON.stringify(await pixel(page, 12, 12)));
      check('undoing everything makes it vanilla again', !(await isEdited(page, CREEPER)));
      // a drag along the face is one stroke
      const a = await texelPoint(page, CREEPER, 9, 9, 64, 32);
      const b = await texelPoint(page, CREEPER, 14, 9, 64, 32);
      if (a && b) {
        await page.mouse.move(a.x, a.y);
        await page.mouse.down();
        await page.mouse.move(b.x, b.y, { steps: 12 });
        await page.mouse.up();
        await page.waitForTimeout(300);
        const row = [];
        for (let x = 9; x <= 14; x++) row.push(eq(await pixel(page, x, 9), [20, 120, 255, 255]));
        check('a drag paints a row of the face', row.filter(Boolean).length >= 5, JSON.stringify(row));
        await page.keyboard.press('Control+z');
        await page.waitForTimeout(250);
        check('the drag is one undo step', !(await isEdited(page, CREEPER)));
      } else check('face row on screen', false);
    }

    // parts: hide the head, solo the body, show all
    await page.click('.tx-pv-partsection .tx-pv-part[data-part="head"]');
    await page.waitForTimeout(500);
    let st = await partChips(page);
    check('a part chip hides that part', st.find((c) => c.name === 'head')?.on === false && st.filter((c) => c.on).length === 5);
    check('the hidden head is gone from the model', !(await texelPoint(page, CREEPER, 12, 12, 64, 32, 5)));
    check('the floating Parts button counts the parts shown', /5 of 6/.test(await page.textContent('.tx-pv-partsbtn')));
    await page.dblclick('.tx-pv-partsection .tx-pv-part[data-part="body"]');
    await page.waitForTimeout(500);
    st = await partChips(page);
    check('double-click shows only that part', st.filter((c) => c.on).map((c) => c.name).join() === 'body', JSON.stringify(st.filter((c) => c.on)));
    // the body can still be painted while it is on its own
    const bodyPt = await texelPoint(page, CREEPER, 20, 24, 64, 32);
    check('the solo body is paintable', !!bodyPt);
    await page.click('.tx-pv-partsection .tx-pv-parts-all');
    await page.waitForTimeout(500);
    st = await partChips(page);
    check('Show all brings every part back', st.every((c) => c.on));
    check('the face is back on screen', !!(await texelPoint(page, CREEPER, 12, 12, 64, 32)));

    // the floating parts popover in the 3D workspace
    await page.click('.tx-pv-partsbtn');
    await page.waitForSelector('.tx-pv-partspop .tx-pv-part');
    await page.click('.tx-pv-partspop .tx-pv-part[data-part="head"]');
    await page.waitForTimeout(400);
    st = await partChips(page);
    check('the Parts popover hides parts too', st.find((c) => c.name === 'head')?.on === false);
    if (shotsDir) await page.screenshot({ path: path.join(shotsDir, 'mobs-parts.png') });
    await page.keyboard.press('Escape');
    await page.click('.tx-pv-partsection .tx-pv-parts-all');

    // another mob with overlays: the sheep shows its wool and body textures
    await page.evaluate(() => window.__tx.showMob('sheep'));
    await page.waitForFunction(() => window.__tx.preview.current()?.entry.id === 'sheep', null, { timeout: 30000 });
    await page.waitForTimeout(800);
    const sheepTex = await page.evaluate(() => {
      const c = window.__tx.preview.current();
      return window.__tx.models.lib.resolve(c.entry, c.state).textures.map((t) => t.path);
    });
    check('the sheep draws its body and wool', sheepTex.some((p) => /sheep\.png$/.test(p) || /sheep_temperate|sheep\/sheep/.test(p)) && sheepTex.some((p) => /wool/.test(p)), sheepTex.join(', '));
    const pageNoScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    check('desktop: no horizontal scroll', pageNoScroll);

    // ---------------------------------------------------------------- things mobs wear
    const current = () => page.evaluate(() => window.__tx.preview.current() && { id: window.__tx.preview.current().entry.id, state: window.__tx.preview.current().state });
    const shownTextures = () =>
      page.evaluate(() => {
        const c = window.__tx.preview.current();
        return window.__tx.models.lib
          .resolve(c.entry, c.state)
          .textures.filter((t) => t.faces > 0)
          .map((t) => t.path);
      });
    // the creeper wears nothing: no "Wearing" choices
    await page.evaluate(() => window.__tx.showMob('creeper'));
    await page.waitForFunction(() => window.__tx.preview.current()?.entry.id === 'creeper', null, { timeout: 30000 });
    await page.waitForTimeout(400);
    check('a mob that wears nothing has no "Wearing" choices', !(await page.isVisible('.tx-pv-gearhead')));
    // a saddle on the pig
    await page.evaluate(() => window.__tx.showMob('pig'));
    await page.waitForFunction(() => window.__tx.preview.current()?.entry.id === 'pig', null, { timeout: 30000 });
    await page.waitForSelector('.tx-pv-state[data-prop="saddle"]', { timeout: 30000 });
    check('the pig offers a saddle under "Wearing"', await page.isVisible('.tx-pv-gearhead'));
    await page.click('.tx-pv-state[data-prop="saddle"] .segmented-item[data-value="on"]');
    await page.waitForFunction(() => window.__tx.preview.current()?.state.saddle === 'on', null, { timeout: 10000 });
    await page.waitForTimeout(800);
    check('the saddle is drawn on its own texture', (await shownTextures()).includes(SADDLE), (await shownTextures()).join(', '));
    st = await partChips(page);
    check('the saddle is a part of its own', st.some((c) => c.name === 'gear:saddle' && c.label === 'Saddle' && c.on), st.map((c) => c.label).join(', '));
    // paint the saddle on the model: the first opaque saddle texel on screen
    await page.evaluate((p) => window.__tx.open(p), SADDLE);
    await page.waitForFunction((p) => window.__tx.canvas.current()?.key === p && !!window.__tx.canvas.canvas(), SADDLE, { timeout: 30000 });
    await page.waitForTimeout(500);
    check('opening the saddle keeps the saddled pig', eq(await current(), { id: 'pig', state: { variant: 'temperate', age: 'adult', saddle: 'on' } }), JSON.stringify(await current()));
    await setTool(page, 'pencil');
    await setColor(page, [250, 20, 200, 255]);
    const saddleHit = await shownTexel(page, SADDLE, 64, 64, [28, 8, 64, 32]);
    check('a saddle texel is on screen', !!saddleHit, JSON.stringify(saddleHit));
    if (saddleHit) {
      await page.mouse.click(saddleHit.pt.x, saddleHit.pt.y);
      await page.waitForTimeout(400);
      check('a click paints the saddle', eq(await pixel(page, saddleHit.u, saddleHit.v), [250, 20, 200, 255]) && (await isEdited(page, SADDLE)), JSON.stringify(await pixel(page, saddleHit.u, saddleHit.v)));
      check('the pig under the saddle is untouched', !(await isEdited(page, PIG)));
      if (shotsDir) await page.screenshot({ path: path.join(shotsDir, 'mobs-pig-saddle.png') });
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(250);
      check('undo restores the saddle', !(await isEdited(page, SADDLE)));
    }
    const usedSaddle = await page.evaluate(() => [...document.querySelectorAll('.tx-usedby-chip')].map((b) => b.dataset.id));
    check('"Used by" on the saddle names the pig', usedSaddle[0] === 'pig', usedSaddle.join(', '));

    // humanoid armour opens on the armour stand
    await page.evaluate((p) => window.__tx.open(p), IRON);
    await page.waitForFunction(() => window.__tx.preview.current()?.entry.id === 'armor_stand', null, { timeout: 30000 }).catch(() => undefined);
    const stand = await current();
    check('opening iron armour shows it on the armour stand', stand?.id === 'armor_stand' && stand.state.helmet === 'iron' && stand.state.chestplate === 'iron' && stand.state.boots === 'iron', JSON.stringify(stand));
    const usedIron = await page.evaluate(() => [...document.querySelectorAll('.tx-usedby-chip, .tx-usedby-more')].map((b) => b.dataset.id ?? b.textContent));
    check('"Used by" on armour lists its wearers, the armour stand first', usedIron[0] === 'armor_stand' && usedIron.length >= 4, usedIron.join(', '));

    // iron armour on the zombie, chestplate hidden to paint the body under it
    await page.evaluate(() => window.__tx.showMob('zombie'));
    await page.waitForFunction(() => window.__tx.preview.current()?.entry.id === 'zombie', null, { timeout: 30000 });
    await page.waitForSelector('.tx-pv-state[data-prop="armor"] select', { timeout: 30000 });
    await page.selectOption('.tx-pv-state[data-prop="armor"] select', 'iron');
    await page.waitForFunction(() => window.__tx.preview.current()?.state.chestplate === 'iron', null, { timeout: 10000 });
    await page.waitForTimeout(800);
    const zs = (await current()).state;
    check('"Armour: Iron" puts on the whole set', ['helmet', 'chestplate', 'leggings', 'boots'].every((k) => zs[k] === 'iron'), JSON.stringify(zs));
    check('the armour pieces show as toggles', (await page.locator('.tx-pv-piece[aria-pressed="true"]').count()) === 4);
    st = await partChips(page);
    check('each armour piece is a part', ['Helmet', 'Chestplate', 'Leggings', 'Boots'].every((l) => st.some((c) => c.label === l && c.name.startsWith('gear:'))), st.map((c) => c.label).join(', '));
    await page.evaluate((p) => window.__tx.open(p), ZOMBIE);
    await page.waitForFunction((p) => window.__tx.canvas.current()?.key === p && !!window.__tx.canvas.canvas(), ZOMBIE, { timeout: 30000 });
    await page.waitForTimeout(500);
    check('the chestplate covers the body', !!(await texelPoint(page, IRON, 22, 22, 64, 32, 10)));
    await page.click('.tx-pv-partsection .tx-pv-part[data-part="gear:chestplate"]');
    await page.waitForTimeout(600);
    check('hiding the chestplate takes it off the model', !(await texelPoint(page, IRON, 22, 22, 64, 32, 5)));
    check('the helmet stays', !!(await texelPoint(page, IRON, 12, 12, 64, 32, 10)));
    await setColor(page, [10, 200, 90, 255]);
    // the body (u 16..40, v 16..32), mostly behind the raised arms: a texel of it that shows
    const body = await shownTexel(page, ZOMBIE, 64, 64, [16, 20, 40, 32]);
    check('the zombie body under the chestplate is on screen', !!body);
    if (body) {
      await page.mouse.click(body.pt.x, body.pt.y);
      await page.waitForTimeout(400);
      check('a click paints the zombie body', eq(await pixel(page, body.u, body.v), [10, 200, 90, 255]), JSON.stringify(await pixel(page, body.u, body.v)));
      check('the armour is untouched', !(await isEdited(page, IRON)));
      if (shotsDir) await page.screenshot({ path: path.join(shotsDir, 'mobs-zombie-armour.png') });
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(250);
    }
    await page.click('.tx-pv-partsection .tx-pv-parts-all');
    // a piece off, then the leather dye
    await page.click('.tx-pv-piece[data-piece="boots"]');
    await page.waitForFunction(() => window.__tx.preview.current()?.state.boots === 'none', null, { timeout: 10000 });
    check('a piece toggle takes one piece off', (await current()).state.helmet === 'iron');
    check('no dye choice without leather', !(await page.isVisible('.tx-pv-state[data-prop="dye"]')));
    await page.selectOption('.tx-pv-state[data-prop="armor"] select', 'leather');
    await page.waitForSelector('.tx-pv-state[data-prop="dye"]', { timeout: 10000 });
    check('leather armour offers a dye', await page.isVisible('.tx-pv-state[data-prop="dye"] select'));
    check('desktop: no horizontal scroll with armour choices', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await ctx.close();

    // ------------------------------------------------------------------ phone: tap paints the mob
    const pctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    await routeMojang(pctx, fx);
    const pp = await pctx.newPage();
    watch(pp);
    await newPack(pp, base, 'E2E Mobs phone');
    await pp.evaluate(() => window.__tx.setWorkspace('3d'));
    await pp.evaluate(() => window.__tx.showMob('creeper'));
    await mobShown(pp, 'creeper', CREEPER);
    await pp.click('.tx-tabbar-btn[data-v="editor"]');
    await pp.waitForTimeout(600);
    check('phone: no horizontal scroll with a mob', await pp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    check('phone: the Parts button is on the model', await pp.isVisible('.tx-pv-partsbtn'));
    await setTool(pp, 'pencil');
    await setColor(pp, [255, 0, 200, 255]);
    const tpt = await texelPoint(pp, CREEPER, 11, 11, 64, 32);
    if (tpt) {
      await pp.touchscreen.tap(tpt.x, tpt.y);
      await pp.waitForTimeout(400);
      check('phone: a one-finger tap paints the creeper', eq(await pixel(pp, 11, 11), [255, 0, 200, 255]), JSON.stringify(await pixel(pp, 11, 11)));
    } else check('phone: creeper face texel on screen', false);
    if (shotsDir) await pp.screenshot({ path: path.join(shotsDir, 'mobs-phone.png') });
    await pctx.close();

    // ------------------------------------------------------------------ Bedrock: its own geometry
    if (doBedrock) {
      const bctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const bp = await bctx.newPage();
      watch(bp);
      await newPack(bp, base, 'E2E Mobs Bedrock', true);
      await bp.evaluate(() => window.__tx.setWorkspace('3d'));
      await bp.evaluate(() => window.__tx.showMob('creeper'));
      const BC = 'textures/entity/creeper/creeper.png';
      await mobShown(bp, 'creeper', BC);
      const ids = await bp.evaluate(() => window.__tx.models.lib.entities().length);
      check('Bedrock: the mob list is there', ids >= 70, `${ids} mobs`);
      await setTool(bp, 'pencil');
      await setColor(bp, [200, 30, 30, 255]);
      const bpt = await texelPoint(bp, BC, 12, 12, 64, 32);
      check('Bedrock: the creeper face texel is on screen', !!bpt);
      if (bpt) {
        await bp.mouse.click(bpt.x, bpt.y);
        await bp.waitForTimeout(300);
        check('Bedrock: a click paints the creeper face', eq(await pixel(bp, 12, 12), [200, 30, 30, 255]), JSON.stringify(await pixel(bp, 12, 12)));
        await bp.keyboard.press('Control+z');
        await bp.waitForTimeout(200);
        check('Bedrock: undo restores it', !(await isEdited(bp, BC)));
      }
      // a Bedrock-only pose: the wolf stands on four legs (its body turned by its setup animation)
      await bp.evaluate(() => window.__tx.showMob('wolf'));
      await bp.waitForFunction(() => window.__tx.preview.current()?.entry.id === 'wolf' && window.__tx.models.lib.ready(window.__tx.preview.current().entry), null, { timeout: 30000 });
      await bp.waitForTimeout(800);
      const wolf = await bp.evaluate(() => {
        const c = window.__tx.preview.current();
        const v = window.__tx.models.lib.resolve(c.entry, c.state);
        const body = v.quads.filter((q) => v.parts[q.part]?.name === 'body').flatMap((q) => q.positions);
        const span = (k) => Math.max(...body.map((p) => p[k])) - Math.min(...body.map((p) => p[k]));
        return { y: span(1) * 16, z: span(2) * 16 };
      });
      check('Bedrock: the wolf body lies along the wolf', wolf.z > wolf.y, JSON.stringify(wolf));
      // horse armour: another texture of the horse model, a part of its own
      await bp.evaluate(() => window.__tx.showMob('horse'));
      await bp.waitForFunction(() => window.__tx.preview.current()?.entry.id === 'horse', null, { timeout: 30000 });
      await bp.waitForSelector('.tx-pv-state[data-prop="armor"] select', { timeout: 30000 });
      await bp.selectOption('.tx-pv-state[data-prop="armor"] select', 'iron');
      await bp.waitForFunction(() => window.__tx.preview.current()?.state.armor === 'iron', null, { timeout: 10000 });
      await bp.waitForTimeout(800);
      const horse = await bp.evaluate(() => {
        const c = window.__tx.preview.current();
        const v = window.__tx.models.lib.resolve(c.entry, c.state);
        return { textures: v.textures.filter((t) => t.faces > 0).map((t) => t.path), parts: v.parts.map((p) => p.label) };
      });
      check('Bedrock: horse armour is drawn from its texture', horse.textures.includes('textures/entity/horse2/armor/horse_armor_iron.png'), horse.textures.join(', '));
      check('Bedrock: horse armour is a part of its own', horse.parts.includes('Horse armour'), horse.parts.join(', '));
      const HA = 'textures/entity/horse2/armor/horse_armor_iron.png';
      await bp.evaluate((p) => window.__tx.open(p), HA);
      await bp.waitForFunction((p) => window.__tx.canvas.current()?.key === p && !!window.__tx.canvas.canvas(), HA, { timeout: 30000 });
      await bp.waitForTimeout(500);
      check('Bedrock: opening the armour keeps the armoured horse', await bp.evaluate(() => window.__tx.preview.current()?.state.armor === 'iron'));
      const hpt = await shownTexel(bp, HA, 64, 64, [0, 0, 64, 64]);
      check('Bedrock: the horse armour is on screen', !!hpt);
      if (shotsDir) await bp.screenshot({ path: path.join(shotsDir, 'mobs-bedrock-horse.png') });
      if (shotsDir) await bp.screenshot({ path: path.join(shotsDir, 'mobs-bedrock.png') });
      await bctx.close();
    }
  } catch (err) {
    check('no unexpected exception', false, err && err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : String(err));
  } finally {
    await browser.close();
    server?.stop();
  }
  const errs = [...new Set(errors)];
  check('no page errors', errs.length === 0, errs.slice(0, 5).join(' || '));
  console.log(`\n${results.length - failures}/${results.length} checks passed`);
  process.exit(failures ? 1 : 0);
})();
