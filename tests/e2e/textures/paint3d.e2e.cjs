// End-to-end checks for painting textures on the 3D model in the texture pack maker: the 2D / 3D
// switch (button and D key), a click on a face paints the texel of the texture it shows (grass block
// side and its tinted overlay, furnace front, lit front), the stroke is one undo step in that texture's
// own history (kept while other textures are painted), fill / eraser / colour picker on the model, the
// pixel editor and the model stay in sync, the camera controls turn instead of painting, touch painting
// on a phone, and on Bedrock the grass side's tint mask survives painting.
// Usage: NODE_PATH=$(npm root -g) node tests/e2e/textures/paint3d.e2e.cjs [baseUrl] [--no-bedrock] [--shots <dir>]
const fs = require('node:fs');
const path = require('node:path');
const { startVite, launch, routeMojang, fixturesDir, decodePng } = require('./lib.cjs');

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
const J = 'assets/minecraft/textures/block/';

async function waitEditor(page) {
  await page.waitForFunction(() => !!window.__tx && document.querySelector('.tx-main'), null, { timeout: 120000 });
}

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
  await waitEditor(page);
  await page.waitForFunction(() => window.__tx.models.lib?.usageReady, null, { timeout: 180000 });
}

async function showBlock(page, id) {
  await page.evaluate((i) => window.__tx.showBlock(i), id);
  await page.waitForFunction((i) => window.__tx.preview.current()?.entry.id === i, id, { timeout: 30000 });
  // the block's main texture opens in the pixel editor
  await page.waitForFunction(() => {
    const t = window.__tx.canvas.current();
    const lib = window.__tx.models.lib;
    const cur = window.__tx.preview.current();
    return !!t && !!window.__tx.canvas.canvas() && !!cur && lib.resolve(cur.entry, cur.state).textures.some((x) => x.path === t.key);
  }, null, { timeout: 30000 });
  await page.waitForTimeout(300);
}

/** Screen point of texel (x, y) of a texture on the 3D model (retries while the model loads). */
async function texelPoint(page, path, x, y, size = 16) {
  for (let i = 0; i < 60; i++) {
    const pt = await page.evaluate(([p, xx, yy, s]) => window.__tx.preview.view3d()?.texelPoint(p, xx, yy, s, s) ?? null, [path, x, y, size]);
    if (pt) return pt;
    await page.waitForTimeout(200);
  }
  return null;
}

const pixel = (page, x, y) => page.evaluate(([xx, yy]) => window.__tx.pixel(xx, yy), [x, y]);
const openKey = (page) => page.evaluate(() => window.__tx.canvas.current()?.key ?? null);
const setColor = (page, c) => page.evaluate((cc) => window.__tx.canvas.canvas().setColor(cc), c);
const setTool = (page, t) => page.evaluate((tt) => window.__tx.canvas.canvas().setTool(tt), t);
const isEdited = (page, p) => page.evaluate((pp) => window.__tx.store.isEdited(pp), p);

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
    await newPack(page, base, 'E2E Paint 3D');
    await showBlock(page, 'grass_block');
    await page.waitForFunction(() => window.__tx.canvas.current(), null, { timeout: 30000 });

    // the switch: keyboard (D) and button
    await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => undefined);
    await page.keyboard.press('d');
    await page.waitForFunction(() => window.__tx.workspace() === '3d', null, { timeout: 5000 }).catch(() => null);
    check('D switches to the 3D workspace', (await page.evaluate(() => window.__tx.workspace())) === '3d');
    check('the 3D model fills the main stage', await page.evaluate(() => !!document.querySelector('.tx-stage3d .tx-pv-hero .preview-stage canvas')));
    check('the pixel editor moves to the side panel', await page.evaluate(() => !!document.querySelector('.tx-pv-canvasslot .tx-canvas-box .pc-root')));
    check('shape and selection tools are hidden in 3D', await page.evaluate(() => getComputedStyle(document.querySelector('.tx-tool[data-tool="line"]')).display === 'none' && getComputedStyle(document.querySelector('.tx-tool[data-tool="fill"]')).display !== 'none'));
    await page.click('.tx-ws-switch .segmented-item[data-value="2d"]');
    check('the 2D button goes back to the flat texture', (await page.evaluate(() => window.__tx.workspace())) === '2d' && (await page.evaluate(() => !!document.querySelector('.tx-stage > .tx-canvas-box .pc-root'))));
    await page.click('.tx-ws-switch .segmented-item[data-value="3d"]');
    check('the 3D button opens the 3D workspace', (await page.evaluate(() => window.__tx.workspace())) === '3d');

    // grass block side: a click paints that texel
    const SIDE = J + 'grass_block_side.png';
    const OVERLAY = J + 'grass_block_side_overlay.png';
    const RED = [230, 20, 20, 255];
    await setTool(page, 'pencil');
    await setColor(page, RED);
    const sp = await texelPoint(page, SIDE, 9, 11);
    check('grass side texel is on screen', !!sp, JSON.stringify(sp));
    if (sp) {
      await page.mouse.move(sp.x, sp.y);
      await page.waitForFunction(() => /Side/.test(document.querySelector('.tx-pv-hint')?.textContent ?? ''), null, { timeout: 5000 }).catch(() => null);
      const hint = await page.textContent('.tx-pv-hint');
      check('hovering names the texture and texel', /Side/.test(hint ?? '') && /9, 11/.test(hint ?? ''), hint?.trim());
      const before = await page.evaluate((p) => window.__tx.store.getFull(p).then((img) => Array.from(img.data.slice((11 * img.width + 9) * 4, (11 * img.width + 9) * 4 + 4))), SIDE);
      await page.mouse.click(sp.x, sp.y);
      await page.waitForFunction((p) => window.__tx.canvas.current()?.key === p, SIDE, { timeout: 15000 });
      await page.waitForTimeout(200);
      check('clicking the grass side paints texel (9, 11) of grass_block_side', eq(await pixel(page, 9, 11), RED), JSON.stringify(await pixel(page, 9, 11)));
      check('the painted texture is marked edited', await isEdited(page, SIDE));
      if (shotsDir) await page.screenshot({ path: path.join(shotsDir, 'paint3d-grass.png') });
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(200);
      check('undo restores the texel', eq(await pixel(page, 9, 11), before), JSON.stringify(await pixel(page, 9, 11)));
      check('undoing everything makes it vanilla again', !(await isEdited(page, SIDE)));
      await page.keyboard.press('Control+Shift+z');
      await page.waitForTimeout(200);
      check('redo paints it again', eq(await pixel(page, 9, 11), RED));
    }
    // the tinted overlay over the side's top rows takes paint itself
    const op = await texelPoint(page, OVERLAY, 6, 1);
    if (op) {
      await setColor(page, [255, 255, 255, 255]);
      await page.mouse.click(op.x, op.y);
      await page.waitForFunction((p) => window.__tx.canvas.current()?.key === p, OVERLAY, { timeout: 15000 });
      await page.waitForTimeout(200);
      check('the grass overlay on top of the side is painted (not the side under it)', eq(await pixel(page, 6, 1), [255, 255, 255, 255]), JSON.stringify(await pixel(page, 6, 1)));
    } else check('grass overlay texel is on screen', false);

    // furnace: a stroke across the front, then the side, then back: each keeps its own undo
    await showBlock(page, 'furnace');
    const FRONT = J + 'furnace_front.png';
    const FSIDE = J + 'furnace_side.png';
    const BLUE = [20, 60, 250, 255];
    await setColor(page, BLUE);
    const fp = await texelPoint(page, FRONT, 4, 8);
    check('furnace front texel is on screen', !!fp);
    if (fp) {
      await page.mouse.move(fp.x, fp.y);
      await page.mouse.down();
      await page.mouse.move(fp.x + 50, fp.y, { steps: 12 });
      await page.mouse.up();
      await page.waitForFunction((p) => window.__tx.canvas.current()?.key === p, FRONT, { timeout: 15000 });
      await page.waitForTimeout(200);
      // every blue texel of the front, as (x, y)
      const painted = await page.evaluate((c) => {
        const out = [];
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (JSON.stringify(window.__tx.pixel(x, y)) === JSON.stringify(c)) out.push([x, y]);
        return out;
      }, BLUE);
      // one 8-connected run of texels, as a line drawn across the face would be
      const seen = new Set([0]);
      const stack = [0];
      while (stack.length) {
        const i = stack.pop();
        painted.forEach((p, j) => {
          if (!seen.has(j) && Math.abs(p[0] - painted[i][0]) <= 1 && Math.abs(p[1] - painted[i][1]) <= 1) {
            seen.add(j);
            stack.push(j);
          }
        });
      }
      const span = painted.length ? Math.max(...painted.map((p) => p[0])) - Math.min(...painted.map((p) => p[0])) : 0;
      check('a drag paints a gap-free line across the front', painted.length >= 4 && span >= 3 && seen.size === painted.length, JSON.stringify(painted));
      check('the stroke is one undo step', await page.evaluate(() => window.__tx.canvas.canUndo()));
      // the 3D model shows it live
      await page.mouse.move(5, 5);
      await page.waitForTimeout(300);
      const pp = painted.length ? await texelPoint(page, FRONT, painted[0][0], painted[0][1]) : null;
      if (pp) {
        const shot = await decodePng(await page.screenshot({ clip: { x: Math.round(pp.x) - 1, y: Math.round(pp.y) - 1, width: 3, height: 3 } }));
        const ch = shot.channels;
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < shot.width * shot.height; i++) (r += shot.data[i * ch]), (g += shot.data[i * ch + 1]), (b += shot.data[i * ch + 2]);
        check('the 3D model shows the stroke', b > r + 60 * 9 && b > g + 40 * 9, JSON.stringify([r, g, b].map((v) => Math.round(v / 9))));
      }
    }
    const sp2 = await texelPoint(page, FSIDE, 3, 3);
    if (sp2) {
      await page.mouse.click(sp2.x, sp2.y);
      await page.waitForFunction((p) => window.__tx.canvas.current()?.key === p, FSIDE, { timeout: 15000 });
      await page.waitForTimeout(200);
      check('a face of another texture opens and paints it', eq(await pixel(page, 3, 3), BLUE));
    }
    // back to the front through the model: its history is still there
    await setTool(page, 'picker');
    const fp2 = await texelPoint(page, FRONT, 0, 0);
    if (fp2) {
      await page.mouse.click(fp2.x, fp2.y);
      await page.waitForFunction((p) => window.__tx.canvas.current()?.key === p, FRONT, { timeout: 15000 });
      await page.waitForTimeout(200);
      const picked = await page.evaluate(() => window.__tx.canvas.canvas().color);
      check('the colour picker takes a texel colour from the model', eq(picked, await pixel(page, 0, 0)), JSON.stringify(picked));
      check('the front keeps its undo history after painting the side', await page.evaluate(() => window.__tx.canvas.canUndo()));
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(200);
      check('undo takes the front stroke back', !(await isEdited(page, FRONT)));
    }
    // fill on the model fills the matching area of the texture
    await setTool(page, 'fill');
    await setColor(page, [250, 200, 0, 255]);
    const TOP = J + 'furnace_top.png';
    const tp = await texelPoint(page, TOP, 8, 8);
    if (tp) {
      const target = await page.evaluate((p) => window.__tx.store.getFull(p).then((img) => Array.from(img.data.slice((8 * 16 + 8) * 4, (8 * 16 + 8) * 4 + 4))), TOP);
      await page.mouse.click(tp.x, tp.y);
      await page.waitForFunction((p) => window.__tx.canvas.current()?.key === p, TOP, { timeout: 15000 });
      await page.waitForTimeout(200);
      check('fill on the model recolours the touching area of that colour', eq(await pixel(page, 8, 8), [250, 200, 0, 255]), JSON.stringify(target));
    }
    // eraser
    await setTool(page, 'eraser');
    const ep = await texelPoint(page, TOP, 2, 2);
    if (ep) {
      await page.mouse.click(ep.x, ep.y);
      await page.waitForTimeout(200);
      check('the eraser clears a texel', (await pixel(page, 2, 2))[3] === 0);
    }
    // right-drag turns the camera instead of painting
    await setTool(page, 'pencil');
    const editedBefore = await page.evaluate(() => [...window.__tx.store.editedPaths()].length);
    const az = () => page.evaluate(() => window.__tx.preview.view3d().paintHitAt(720, 500)?.index ?? -1);
    const a0 = await az();
    const c = await page.evaluate(() => {
      const r = document.querySelector('.tx-stage3d .preview-stage canvas').getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await page.mouse.move(c.x, c.y);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(c.x + 160, c.y + 40, { steps: 8 });
    await page.mouse.up({ button: 'right' });
    await page.waitForTimeout(300);
    const a1 = await az();
    check('right-drag turns the model without painting', (await page.evaluate(() => [...window.__tx.store.editedPaths()].length)) === editedBefore && a0 !== a1, `${a0} -> ${a1}`);
    // two-way hover: the pixel editor outlines the texel under the pointer on the model
    if (shotsDir) await page.screenshot({ path: path.join(shotsDir, 'paint3d-furnace.png') });
    await ctx.close();

    // ------------------------------------------------------------------ phone: touch painting
    const pctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    await routeMojang(pctx, fx);
    const pp = await pctx.newPage();
    watch(pp);
    await newPack(pp, base, 'E2E Paint 3D phone');
    await showBlock(pp, 'furnace');
    await pp.evaluate(() => window.__tx.setWorkspace('3d'));
    await pp.click('.tx-tabbar-btn[data-v="editor"]');
    await pp.waitForTimeout(600);
    const noScroll = await pp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    check('phone: no horizontal scroll in the 3D workspace', noScroll);
    await setColor(pp, [255, 0, 200, 255]);
    await setTool(pp, 'pencil');
    const tpt = await texelPoint(pp, FRONT, 7, 7);
    if (tpt) {
      await pp.touchscreen.tap(tpt.x, tpt.y);
      await pp.waitForFunction((p) => window.__tx.canvas.current()?.key === p, FRONT, { timeout: 15000 });
      await pp.waitForTimeout(300);
      check('phone: a one-finger tap paints the texel', eq(await pixel(pp, 7, 7), [255, 0, 200, 255]), JSON.stringify(await pixel(pp, 7, 7)));
    } else check('phone: furnace front texel on screen', false);
    if (shotsDir) await pp.screenshot({ path: path.join(shotsDir, 'paint3d-phone.png') });
    await pctx.close();

    // ------------------------------------------------------------------ Bedrock: tint mask survives
    if (doBedrock) {
      const bctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const bp = await bctx.newPage();
      watch(bp);
      await newPack(bp, base, 'E2E Paint 3D Bedrock', true);
      await showBlock(bp, 'grass');
      await bp.evaluate(() => window.__tx.setWorkspace('3d'));
      const BSIDE = 'textures/blocks/grass_side.tga';
      const hasTga = await bp.evaluate((p) => window.__tx.store.byPath.has(p), BSIDE);
      const bside = hasTga ? BSIDE : 'textures/blocks/grass_side_carried.png';
      await setTool(bp, 'pencil');
      await setColor(bp, [200, 30, 30, 255]);
      const bpt = await texelPoint(bp, bside, 5, 2);
      check('Bedrock grass side texel is on screen', !!bpt, bside);
      if (bpt) {
        const alphaBefore = await bp.evaluate((p) => window.__tx.store.getFull(p).then((img) => img.data[(2 * img.width + 5) * 4 + 3]), bside);
        await bp.mouse.click(bpt.x, bpt.y);
        await bp.waitForFunction((p) => window.__tx.canvas.current()?.key === p, bside, { timeout: 15000 });
        await bp.waitForTimeout(300);
        const after = await pixel(bp, 5, 2);
        check('Bedrock: the texel takes the colour', after[0] === 200 && after[1] === 30 && after[2] === 30, JSON.stringify(after));
        check('Bedrock: the tint mask (alpha) of the painted texel is kept', after[3] === alphaBefore, `${alphaBefore} -> ${after[3]}`);
        await bp.keyboard.press('Control+z');
        await bp.waitForTimeout(200);
        check('Bedrock: undo restores it', !(await isEdited(bp, bside)));
      }
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
