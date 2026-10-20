// End-to-end checks for the model editor of the texture pack maker (Java 26.3): it loads only when
// opened; a block's model (the oak slab) is edited with the fields, the 3D handles and a new cube,
// rotated, given another texture and UV, its inventory pose changed, with undo / redo from the top
// bar; the diamond sword becomes a 3D handheld item from its sprite, flat in the inventory; the
// exported zip holds valid model files and the item definition; the preview shows the new shapes;
// light and dark themes and a phone-width layout without sideways scrolling; Bedrock shows a note
// instead of the editor; no console errors.
// Usage: NODE_PATH=$(npm root -g) node tests/e2e/textures/models.e2e.cjs [baseUrl] [--shots <dir>] [--no-bedrock]
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startVite, launch, routeMojang, fixturesDir, unzip } = require('./lib.cjs');

const argv = process.argv.slice(2);
const baseArg = argv.find((a) => /^https?:/.test(a));
const shotsDir = argv.includes('--shots') ? argv[argv.indexOf('--shots') + 1] : null;
const doBedrock = !argv.includes('--no-bedrock');
if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tx-models-'));

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
}
const shot = async (page, name) => {
  if (shotsDir) await page.screenshot({ path: path.join(shotsDir, `${name}.png`) });
};

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

async function showEntry(page, kind, id) {
  await page.evaluate(([k, i]) => (k === 'block' ? window.__tx.showBlock(i) : window.__tx.preview.showEntry(window.__tx.models.lib.item(i))), [kind, id]);
  await page.waitForFunction((i) => window.__tx.preview.current()?.entry.id === i, id, { timeout: 30000 });
}

const doc = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__tx.modelEditor().test.doc())));
// the model editor's styles arrive with its code: a probe element shows whether they are on the page
const loadedModelEditor = (page) =>
  page.evaluate(() => {
    const probe = document.createElement('div');
    probe.className = 'me-root';
    probe.hidden = true;
    document.body.appendChild(probe);
    const v = getComputedStyle(probe).getPropertyValue('--me-x').trim();
    probe.remove();
    return v !== '';
  });
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

async function setField(page, key, value) {
  const sel = `.me-side-body [data-key="${key}"]`;
  await page.fill(sel, String(value));
  await page.press(sel, 'Enter');
  await page.waitForTimeout(150);
}

async function exportZip(page) {
  await page.click('.tx-export-btn');
  await page.waitForSelector('.tx-export-modal .tx-exp-rows');
  const rows = await page.textContent('.tx-export-modal .tx-exp-rows');
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 180000 }), page.click('.tx-export-modal .btn-primary:has-text("Export .zip")')]);
  const file = path.join(tmp, download.suggestedFilename());
  await download.saveAs(file);
  await page.waitForSelector('.tx-exp-done', { timeout: 30000 });
  const warnings = await page.$$eval('.tx-exp-warnings li', (l) => l.map((x) => x.textContent));
  await page.click('.tx-export-modal .btn-primary:has-text("Done")');
  return { file, rows, warnings };
}

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
    // ------------------------------------------------------------------ desktop, dark
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark', acceptDownloads: true });
    await routeMojang(ctx, fx);
    const page = await ctx.newPage();
    watch(page);
    await newPack(page, base, 'E2E Models');
    check('the model editor is not loaded with the texture editor', !(await loadedModelEditor(page)));

    // a block: the oak slab
    await showEntry(page, 'block', 'oak_slab');
    await page.waitForSelector('.tx-pv-shapebtn:not([hidden])', { timeout: 30000 });
    check('a block in the preview offers "Edit shape"', true);
    await page.click('.tx-pv-shapebtn');
    await page.waitForSelector('.me-root .me-cuberow', { timeout: 60000 });
    check('the model editor loads when opened', await loadedModelEditor(page));
    let d = await doc(page);
    check('the slab opens with its one cube, resolved from its parents', d.elements.length === 1 && d.elements[0].to[1] === 8 && d.textures.side === 'minecraft:block/oak_planks', JSON.stringify(d.elements[0]?.to));
    check('nothing is saved before an edit', (await page.textContent('.me-status')).includes('Not changed'));
    await shot(page, 'models-slab-open');

    // fields
    await setField(page, 'size.1', 12);
    d = await doc(page);
    check('typing a size changes the cube', d.elements[0].to[1] === 12, JSON.stringify(d.elements[0].to));
    // add a cube and drag its move handle along x
    await page.click('.me-cubes-head .icon-btn');
    await page.waitForFunction(() => window.__tx.modelEditor().test.doc().elements.length === 2);
    const before = (await doc(page)).elements[1].from[0];
    const hp = await page.evaluate(() => window.__tx.modelEditor().test.viewport().handlePoint('move', 0));
    const origin = await page.evaluate(() => window.__tx.modelEditor().test.viewport().handlePoint('move', 0, 1) && window.__tx.modelEditor().test.viewport().screenPoint([0.5, 0.25, 0.5]));
    check('the move handle is on screen', !!hp, JSON.stringify(hp));
    if (hp && origin) {
      const dx = hp.x - origin.x;
      const dy = hp.y - origin.y;
      const len = Math.hypot(dx, dy) || 1;
      await page.mouse.move(hp.x, hp.y);
      await page.mouse.down();
      for (let k = 1; k <= 8; k++) await page.mouse.move(hp.x + (dx / len) * 12 * k, hp.y + (dy / len) * 12 * k);
      await page.mouse.up();
      await page.waitForTimeout(200);
    }
    const after = (await doc(page)).elements[1].from[0];
    check('dragging the x arrow moves the new cube along x, on the grid', after > before && Number.isInteger(after), `${before} -> ${after}`);
    // undo / redo from the top bar
    await page.click('.tx-bar-actions [aria-label^="Undo"]');
    await page.waitForTimeout(150);
    check('undo in the top bar takes the drag back', (await doc(page)).elements[1].from[0] === before);
    await page.click('.tx-bar-actions [aria-label^="Redo"]');
    await page.waitForTimeout(150);
    check('redo puts it back', (await doc(page)).elements[1].from[0] === after);
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(150);
    check('Ctrl+Z undoes step by step (drag, then the new cube)', (await doc(page)).elements.length === 1);
    await page.keyboard.press('Control+Shift+z');
    await page.keyboard.press('Control+Shift+z');
    await page.waitForTimeout(150);
    check('Ctrl+Shift+Z redoes them', (await doc(page)).elements.length === 2);

    // rotation: one axis, 22.5 degrees
    await page.click('.me-side-body .segmented[aria-label="Rotation axis"] .segmented-item[data-value="y"]');
    await page.waitForTimeout(150);
    d = await doc(page);
    check('turning the cube on Y sets a 22.5° rotation around its centre', d.elements[1].rotation?.axis === 'y' && d.elements[1].rotation.angle === 22.5, JSON.stringify(d.elements[1].rotation));

    // faces: the top face gets another texture and the whole texture as its UV
    await page.click('.me-side-tabs .tab[data-value="faces"]');
    await page.click('.me-facebtn[data-face="up"]');
    await page.click('.me-side-body .btn:has-text("Change")');
    await page.waitForSelector('.me-tp-modal .me-tp-tile');
    await page.fill('.me-tp-modal input[type="search"]', 'diamond_block');
    await page.waitForSelector('.me-tp-modal .me-tp-tile[data-path$="block/diamond_block.png"]');
    await shot(page, 'models-texture-picker');
    await page.click('.me-tp-modal .me-tp-tile[data-path$="block/diamond_block.png"]');
    await page.waitForTimeout(200);
    d = await doc(page);
    check('the picked texture becomes a texture variable of the face', d.elements[1].faces.up?.texture === '#diamond_block' && d.textures.diamond_block === 'minecraft:block/diamond_block', JSON.stringify(d.elements[1].faces.up));
    await page.click('.me-side-body .btn:has-text("Whole texture")');
    await page.waitForTimeout(150);
    d = await doc(page);
    check('"Whole texture" sets the face UV to 0 0 16 16', JSON.stringify(d.elements[1].faces.up?.uv) === '[0,0,16,16]');
    await shot(page, 'models-slab-faces');

    // display: the inventory pose
    await page.click('.me-side-tabs .tab[data-value="display"]');
    await page.waitForSelector('.me-slots:not([hidden]) .me-slot');
    await setField(page, 'drot.1', 45);
    d = await doc(page);
    check('the inventory rotation can be changed', d.display.gui?.rotation[1] === 45, JSON.stringify(d.display.gui));
    for (const s of ['firstperson_righthand', 'thirdperson_righthand', 'ground', 'fixed', 'head']) await page.click(`.me-slots .me-slot[data-slot="${s}"]`);
    check('every display slot shows its preview', (await page.getAttribute('.me-slot[data-slot="head"]', 'aria-checked')) === 'true');
    await page.click('.me-slots .me-slot[data-slot="thirdperson_righthand"]');
    await page.waitForTimeout(300);
    await shot(page, 'models-slab-thirdperson');
    await page.click('.me-side-tabs .tab[data-value="model"]');
    const issues = await page.evaluate(() => window.__tx.modelEditor().test.issues());
    check('the edited slab has no problems for 26.3', issues.length === 0, JSON.stringify(issues));
    await page.waitForFunction(() => /Saved/.test(document.querySelector('.me-status')?.textContent ?? ''), null, { timeout: 5000 }).catch(() => null);
    check('the edits are saved into the pack', await page.evaluate(() => !!window.__tx.store.project.extraFiles['assets/minecraft/models/block/oak_slab.json']));
    await shot(page, 'models-slab-model-tab');

    // back: the preview shows the new shape
    await page.click('.me-back');
    await page.waitForSelector('.tx-main', { state: 'visible' });
    await page.waitForFunction(() => {
      const c = window.__tx.preview.current();
      const v = c && window.__tx.models.lib.resolve(c.entry, c.state);
      return v && Math.max(...v.quads.flatMap((q) => q.positions.map((p) => p[1]))) === 0.75;
    }, null, { timeout: 15000 }).catch(() => null);
    const top = await page.evaluate(() => {
      const c = window.__tx.preview.current();
      const v = window.__tx.models.lib.resolve(c.entry, c.state);
      return { y: Math.max(...v.quads.flatMap((q) => q.positions.map((p) => p[1]))), n: v.quads.length };
    });
    check('the 3D preview uses the pack’s new slab model', top.y === 0.75 && top.n === 12, JSON.stringify(top));
    check('the preview marks the block as custom', await page.isVisible('.tx-pv-shapebadge'));

    // an item: a 3D sword from its sprite, flat in the inventory
    await page.evaluate(() => window.__tx.editModel('item', 'diamond_sword'));
    await page.waitForSelector('.me-start:not([hidden]) .me-preset[data-preset="sprite3d"]', { timeout: 30000 });
    check('a flat item offers the 3D-from-sprite start point', true);
    await shot(page, 'models-sword-start');
    await page.click('.me-start .me-preset[data-preset="sprite3d"]');
    await page.waitForFunction(() => window.__tx.modelEditor().test.doc().elements.length > 5, null, { timeout: 10000 }).catch(() => null);
    d = await doc(page);
    check('the sword becomes a few dozen cubes at most', d.elements.length > 5 && d.elements.length < 60, `${d.elements.length} cubes`);
    check('the 3D sword keeps the handheld display', JSON.stringify(d.display.thirdperson_righthand?.rotation) === '[0,-90,55]');
    await page.click('.me-side-tabs .tab[data-value="model"]');
    await page.click('.me-side-body .toggle:has-text("Flat in the inventory") .switch');
    await page.waitForTimeout(300);
    const plan = await page.evaluate(() => window.__tx.modelEditor().test.plan());
    check('flat in the inventory saves the shape as item/diamond_sword_3d', plan.target === 'minecraft:item/diamond_sword_3d', plan.target);
    await page.click('.me-side-tabs .tab[data-value="display"]');
    await page.click('.me-slots .me-slot[data-slot="firstperson_righthand"]');
    await page.waitForTimeout(300);
    await shot(page, 'models-sword-firstperson');
    await page.click('.me-slots .me-slot[data-slot="thirdperson_righthand"]');
    await page.waitForTimeout(300);
    await shot(page, 'models-sword-thirdperson');
    await page.click('.me-side-tabs .tab[data-value="cube"]');
    await shot(page, 'models-sword-desktop-dark');

    // export
    await page.waitForSelector('.tx-save[data-state="saved"]', { timeout: 30000 });
    const ex = await exportZip(page);
    check('the export summary counts the custom models', /Custom models\s*2/.test(ex.rows ?? ''), ex.rows);
    const zip = unzip(ex.file);
    const names = Object.keys(zip);
    const text = (p) => new TextDecoder().decode(zip[p]);
    const json = (p) => {
      try {
        return JSON.parse(text(p));
      } catch {
        return null;
      }
    };
    const SLAB = 'assets/minecraft/models/block/oak_slab.json';
    const SWORD3D = 'assets/minecraft/models/item/diamond_sword_3d.json';
    const DEF = 'assets/minecraft/items/diamond_sword.json';
    check('the zip has the slab, the 3D sword and the sword’s item definition', [SLAB, SWORD3D, DEF].every((p) => names.includes(p)), names.filter((n) => n.includes('models') || n.includes('items')).join(', '));
    check('no flat sword model or blockstate is written when not needed', !names.includes('assets/minecraft/models/item/diamond_sword.json') && !names.some((n) => n.includes('/blockstates/')));
    const slab = json(SLAB);
    check('the slab model is valid JSON without a parent', !!slab && !slab.parent && slab.elements.length === 2, JSON.stringify(slab)?.slice(0, 120));
    check('every cube is within -16..32', !!slab && slab.elements.every((e) => [...e.from, ...e.to].every((v) => v >= -16 && v <= 32)));
    check('the rotation is written the way the game reads it', slab?.elements[1].rotation?.axis === 'y' && slab.elements[1].rotation.angle === 22.5);
    check('every face texture variable resolves', !!slab && slab.elements.every((e) => Object.values(e.faces).every((f) => slab.textures[f.texture.slice(1)])));
    check('the inventory pose is written', slab?.display?.gui?.rotation?.[1] === 45);
    const sword = json(SWORD3D);
    check('the 3D sword is a valid model with its cubes', !!sword && sword.elements.length === d.elements.length && sword.textures?.layer0 === 'minecraft:item/diamond_sword');
    const def = json(DEF);
    check('the item definition keeps the flat model in the inventory and uses the 3D one in hand', def?.model?.type === 'minecraft:select' && def.model.property === 'minecraft:display_context' && def.model.fallback?.model === 'minecraft:item/diamond_sword_3d' && def.model.cases?.[0]?.model?.model === 'minecraft:item/diamond_sword', JSON.stringify(def));
    check('no export warnings', ex.warnings.length === 0, ex.warnings.join(' | '));
    // opening the sword again keeps editing the same files (not its own item definition read back)
    await page.evaluate(() => window.__tx.editModel('item', 'diamond_sword'));
    await page.waitForSelector('.me-root .me-cuberow', { timeout: 30000 });
    const again = await page.evaluate(() => ({ plan: window.__tx.modelEditor().test.plan().target, n: window.__tx.modelEditor().test.doc().elements.length }));
    check('reopening the 3D sword edits item/diamond_sword_3d with its cubes', again.plan === 'minecraft:item/diamond_sword_3d' && again.n === d.elements.length, JSON.stringify(again));
    await page.click('.me-back');

    // ------------------------------------------------------------------ light theme
    await page.evaluate(() => window.__tx.editModel('block', 'oak_slab'));
    await page.waitForSelector('.me-root .me-cuberow');
    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'light';
    });
    await page.waitForTimeout(300);
    const light = await page.evaluate(() => getComputedStyle(document.querySelector('.me-side')).backgroundColor);
    check('the model editor follows the light theme', /255, 255, 255/.test(light), light);
    await shot(page, 'models-slab-desktop-light');
    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'dark';
    });
    await page.click('.me-back');
    await ctx.close();

    // ------------------------------------------------------------------ phone
    const pctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'light' });
    await routeMojang(pctx, fx);
    const phone = await pctx.newPage();
    watch(phone);
    await newPack(phone, base, 'E2E Models Phone');
    await phone.evaluate(() => window.__tx.editModel('item', 'iron_sword'));
    await phone.waitForSelector('.me-start:not([hidden]) .me-preset[data-preset="sprite3d"]', { timeout: 60000 });
    check('phone: no sideways scrolling with the model editor open', await noSideScroll(phone));
    await shot(phone, 'models-phone-start');
    await phone.tap('.me-start .me-preset[data-preset="sprite3d"]');
    await phone.waitForFunction(() => window.__tx.modelEditor().test.doc().elements.length > 5, null, { timeout: 10000 }).catch(() => null);
    const pr = await phone.evaluate(() => {
      const r = (s) => document.querySelector(s)?.getBoundingClientRect();
      const stage = r('.me-stage');
      const side = r('.me-side');
      return { stage: stage && { top: stage.top, bottom: stage.bottom, w: stage.width }, side: side && { top: side.top, w: side.width } };
    });
    check('phone: the 3D view sits above the panels, full width', !!pr.stage && !!pr.side && pr.side.top >= pr.stage.bottom - 1 && pr.stage.w > 360, JSON.stringify(pr));
    await phone.tap('.me-side-tabs .tab[data-value="cubes"]');
    check('phone: the cube list is a tab', await phone.isVisible('.me-side-body .me-cubelist .me-cuberow'));
    await phone.tap('.me-side-body .me-cuberow:nth-child(2)');
    check('phone: picking a cube opens its fields', await phone.isVisible('.me-side-body [data-key="pos.0"]'));
    await shot(phone, 'models-phone-cube');
    await phone.tap('.me-side-tabs .tab[data-value="display"]');
    await phone.tap('.me-slotlist .me-chip:nth-child(3)');
    await phone.waitForTimeout(300);
    check('phone: no sideways scrolling in the display tab', await noSideScroll(phone));
    await shot(phone, 'models-phone-display');
    await phone.evaluate(() => {
      document.documentElement.dataset.theme = 'dark';
    });
    await phone.tap('.me-side-tabs .tab[data-value="faces"]');
    await phone.waitForTimeout(300);
    await shot(phone, 'models-phone-faces-dark');
    check('phone: no sideways scrolling in the faces tab', await noSideScroll(phone));
    await pctx.close();

    // ------------------------------------------------------------------ Bedrock: a note, no editor
    if (doBedrock) {
      const bctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const bp = await bctx.newPage();
      watch(bp);
      try {
        await newPack(bp, base, 'E2E Models Bedrock', true);
        await bp.evaluate(() => window.__tx.showBlock('stone'));
        await bp.waitForSelector('.tx-pv-shapebtn:not([hidden])', { timeout: 30000 });
        await bp.click('.tx-pv-shapebtn');
        await bp.waitForSelector('dialog[open] .modal-title');
        const title = await bp.textContent('dialog[open] .modal-title');
        check('Bedrock: "Edit shape" explains that shapes need an add-on', /Bedrock/.test(title ?? '') && /add-on/.test((await bp.textContent('dialog[open] .modal-body')) ?? ''), title);
        check('Bedrock: no model editor opens', !(await bp.$('.me-root')));
        await shot(bp, 'models-bedrock-note');
        await bp.click('dialog[open] .btn-primary');
      } catch (e) {
        check('Bedrock note', false, String(e).slice(0, 200));
      }
      await bctx.close();
    }
  } catch (e) {
    check('run without exceptions', false, e && e.stack ? e.stack.split('\n').slice(0, 3).join(' ') : String(e));
  } finally {
    check('no console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
    await browser.close();
    server?.stop();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(failures ? `\n${failures} check(s) failed` : '\nall model editor checks passed');
  process.exit(failures ? 1 : 0);
})();
