// End-to-end checks of the texture maker's feature pages (/painting-maker, /gui-maker,
// /music-disc-maker, /enchantment-glint-maker): each shows the texture start screen with its own
// heading and button and the page's introduction below, and its new pack opens the editor on the
// feature once (the paintings, the GUI with the hotbar, the records with cat, the enchantment glint),
// while /textures and saved packs open as before. Also a phone and a translated page.
// The game's sound list is a tiny generated stand-in (no Mojang files); Java textures come from
// TO_FIXTURES (client jar) or the network.
// Usage: NODE_PATH=$(npm root -g) TO_FIXTURES=<dir> node tests/e2e/textures/landing.e2e.cjs [baseUrl] [--shots <dir>]
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
const shot = async (page, name) => {
  if (shotsDir) await page.screenshot({ path: path.join(shotsDir, `${name}.png`) });
};

// ------------------------------------------------------------------ the game's sound list (stand-ins)
const SOUNDS_JSON = {
  'block.stone.break': { sounds: ['block/stone/break1'] },
  'music_disc.13': { sounds: [{ name: 'records/13', stream: true }] },
  'music_disc.cat': { sounds: [{ name: 'records/cat', stream: true }] },
  'music_disc.pigstep': { sounds: [{ name: 'records/pigstep', stream: true }] },
};
const hashOf = (s) => crypto.createHash('sha1').update(s).digest('hex');
const INDEX = { objects: { 'minecraft/sounds.json': { hash: hashOf('sounds.json'), size: 1 } } };
for (const e of Object.values(SOUNDS_JSON)) for (const s of e.sounds) INDEX.objects[`minecraft/sounds/${typeof s === 'string' ? s : s.name}.ogg`] = { hash: hashOf(JSON.stringify(s)), size: 1 };

async function routeSounds(ctx) {
  const cors = { 'access-control-allow-origin': '*' };
  await ctx.route(/^https:\/\/piston-meta\.mojang\.com\/v1\/packages\/[0-9a-f]+\/\d+\.json$/, (r) => r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(INDEX) }));
  await ctx.route(/^https:\/\/(raw\.githubusercontent\.com\/misode\/mcmeta\/|cdn\.jsdelivr\.net\/gh\/misode\/mcmeta@)[^/]+-assets\/assets\/minecraft\/sounds\.json$/, (r) =>
    r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(SOUNDS_JSON) }),
  );
}

// ------------------------------------------------------------------ helpers
const editorReady = (page) => page.waitForFunction(() => !!window.__tx && document.querySelector('.tx-main'), null, { timeout: 180000 });
const openKey = (page) => page.evaluate(() => window.__tx.canvas.current()?.key ?? null);
const lib = (page) => page.evaluate(() => document.querySelector('.tx-editor')?.dataset.lib ?? null);
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

/** A feature page's start screen: its heading, button and resolution, then Create. */
async function createFrom(page, base, route, { name, title, button, res }) {
  await page.goto(base + route);
  await page.waitForSelector('.tx-new .tx-create-btn');
  const focus = route.split('/').pop();
  check(`${focus}: the start screen names the feature`, (await page.textContent('.tx-start-hero h1'))?.trim() === title, await page.textContent('.tx-start-hero h1'));
  check(`${focus}: the button says what it makes`, (await page.textContent('.tx-create-btn .btn-label'))?.trim() === button);
  check(`${focus}: no PvP start on a feature page`, (await page.locator('.tx-new .tx-start-opt').count()) === 0);
  check(`${focus}: the resolution starts at ${res}×`, (await page.textContent('.tx-res-chip[aria-checked="true"]'))?.trim() === `${res}×`);
  await page.waitForSelector(`[data-tool-intro="${route === '/' ? '' : focus}"].is-below, [data-tool-intro].is-below`, { timeout: 30000 });
  if (name) await page.fill('.tx-name-field input', name);
  await page.click('.tx-create-btn');
  await page.waitForURL(/\/textures\/[0-9a-f-]+\/?$/, { timeout: 15000 });
  await editorReady(page);
}

(async () => {
  const server = baseArg ? null : await startVite();
  const base = baseArg || server.url;
  const fx = fixturesDir();
  const browser = await launch();
  const errors = [];
  const watch = (page, tag) => {
    page.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon|Failed to load resource|ERR_|404/.test(m.text())) errors.push(`${tag}: ${m.text()}`);
    });
  };
  const context = async (viewport = { width: 1280, height: 860 }) => {
    const ctx = await browser.newContext({ viewport });
    await routeMojang(ctx, fx);
    await routeSounds(ctx);
    return ctx;
  };
  try {
    // ------------------------------------------------------------------ the intro pages
    {
      const ctx = await context();
      const page = await ctx.newPage();
      watch(page, 'pages');
      for (const [route, tool] of [['painting-maker', 'painting'], ['gui-maker', 'gui'], ['music-disc-maker', 'disc'], ['enchantment-glint-maker', 'glint']]) {
        await page.goto(base + route);
        await page.waitForSelector(`[data-tool-intro="${tool}"].is-below`, { timeout: 30000 });
        check(`${route}: the introduction is below the start screen`, (await page.locator('.tx-start .tx-new').count()) === 1);
        check(`${route}: the footer links the page`, (await page.locator(`.site-footer a[href$="${route}/"], .site-footer a[href$="${route}"]`).count()) > 0);
      }
      await page.goto(base + 'textures');
      await page.waitForSelector('[data-tool-intro="textures"].is-below .tool-intro-related', { timeout: 30000 });
      check('/textures suggests the four feature pages', (await page.locator('.tool-intro-related a.guide-card').count()) === 4);
      check('/textures keeps its own start screen (PvP start offered)', (await page.locator('.tx-new .tx-start-opt').count()) === 2);
      await page.close();
      await ctx.close();
    }

    // ------------------------------------------------------------------ painting maker
    {
      const ctx = await context();
      const page = await ctx.newPage();
      watch(page, 'painting');
      await createFrom(page, base, 'painting-maker', { title: 'Make your own Minecraft paintings', button: 'Create painting pack', res: 64 });
      await page.waitForFunction(() => /\/painting\//.test(window.__tx.canvas.current()?.key ?? ''), null, { timeout: 60000 });
      check('painting: opens a painting', /painting\/kebab\.png$/.test((await openKey(page)) ?? ''), await openKey(page));
      check('painting: the list shows the paintings', (await page.textContent('.tx-browser:not(.tx-mb):not([hidden]) .tx-catpick-label'))?.trim() === 'Paintings');
      check('painting: every tile is a painting', await page.evaluate(() => [...document.querySelectorAll('.tx-browser:not(.tx-mb):not([hidden]) .tx-tile')].every((t) => /painting/.test(t.getAttribute('data-path') ?? t.textContent ?? ''))));
      check('painting: an unnamed pack is called My Paintings', await page.evaluate(() => window.__tx.store.project.name === 'My Paintings'));
      check('painting: 64× pack', await page.evaluate(() => window.__tx.store.project.resolution === 64));
      check('painting: the painting opens at 64 px per block', await page.evaluate(() => window.__tx.canvas.current().full.width === 64));
      check('painting: the focus is used once', await page.evaluate(() => !('focus' in window.__tx.store.project)));
      await shot(page, 'painting-editor');
      // saved without the focus: opening the pack again shows every texture
      await page.waitForSelector('.tx-save[data-state="saved"]', { timeout: 30000 });
      await page.reload();
      await editorReady(page);
      await page.waitForTimeout(600);
      check('painting: reopened, the list is not filtered any more', (await page.locator('.tx-browser:not(.tx-mb):not([hidden]) .tx-catpick.is-filtered').count()) === 0);
      check('painting: reopened in All textures (the mode stays)', (await lib(page)) === '' && (await page.isVisible('.tx-browser:not(.tx-mb)')));
      await page.close();
      await ctx.close();
    }

    // ------------------------------------------------------------------ GUI maker
    {
      const ctx = await context();
      const page = await ctx.newPage();
      watch(page, 'gui');
      await createFrom(page, base, 'gui-maker', { name: 'GUI landing', title: 'Design your own Minecraft GUI', button: 'Create GUI pack', res: 16 });
      await page.waitForFunction(() => window.__tx.canvas.current()?.key.endsWith('gui/sprites/hud/hotbar.png'), null, { timeout: 60000 });
      check('gui: GUI mode', (await lib(page)) === 'gui');
      check('gui: the hotbar is open', true);
      check('gui: the hotbar is marked in the GUI list', (await page.getAttribute('.gui-tile[data-piece="hotbar.bar"]', 'aria-pressed')) === 'true');
      check('gui: the preview shows the HUD', await page.evaluate(() => window.__tx.guiMode().preview.screen() === 'hud'));
      check('gui: the name typed is kept', await page.evaluate(() => window.__tx.store.project.name === 'GUI landing'));
      await shot(page, 'gui-editor');
      await page.close();
      await ctx.close();
    }

    // ------------------------------------------------------------------ enchantment glint
    {
      const ctx = await context();
      const page = await ctx.newPage();
      watch(page, 'glint');
      await createFrom(page, base, 'enchantment-glint-maker', { title: 'Change the enchantment glint', button: 'Create glint pack', res: 16 });
      await page.waitForFunction(() => window.__tx.canvas.current()?.key.endsWith('misc/enchanted_glint_item.png'), null, { timeout: 60000 });
      check('glint: GUI mode with the item glint open', (await lib(page)) === 'gui');
      await page.waitForFunction(() => window.__tx.guiMode()?.preview.screen() === 'glint', null, { timeout: 10000 }).catch(() => undefined);
      check('glint: the preview shows the Glint screen', await page.evaluate(() => window.__tx.guiMode().preview.screen() === 'glint'));
      check('glint: the armour glint is listed next to it', (await page.locator('.gui-tile[data-piece="glint.armor"]').count()) === 1);
      await shot(page, 'glint-editor');
      await page.close();
      await ctx.close();
    }

    // ------------------------------------------------------------------ music disc maker
    {
      const ctx = await context();
      const page = await ctx.newPage();
      watch(page, 'disc');
      await createFrom(page, base, 'music-disc-maker', { title: 'Put your own music on a disc', button: 'Create music disc pack', res: 16 });
      await page.waitForFunction(() => document.querySelector('.snd-panel .tx-head-sub')?.textContent.startsWith('music_disc.cat'), null, { timeout: 60000 });
      check('disc: Sounds mode', (await lib(page)) === 'sounds');
      check('disc: cat is picked', true);
      const rows = await page.$$eval('.snd-row .tx-tile-id', (r) => r.map((x) => x.textContent));
      check('disc: the list shows the records only', rows.length === 3 && rows.every((id) => id.startsWith('music_disc.')), rows.join(','));
      check('disc: the disc’s picture waits in the pixel editor', /item\/music_disc_cat\.png$/.test((await openKey(page)) ?? ''), await openKey(page));
      check('disc: Replace is offered', (await page.locator('.snd-var-replace').count()) > 0);
      await shot(page, 'disc-editor');
      // switching to the textures shows the disc
      await page.locator('.tx-libbar .segmented-item[data-value="textures"]:visible').first().click();
      await page.waitForTimeout(400);
      check('disc: the textures show the disc in the pixel editor', (await lib(page)) === '' && /music_disc_cat\.png$/.test((await openKey(page)) ?? ''));
      await page.close();
      await ctx.close();
    }

    // ------------------------------------------------------------------ the texture maker as before
    {
      const ctx = await context();
      const page = await ctx.newPage();
      watch(page, 'textures');
      await page.goto(base + 'textures');
      await page.waitForSelector('.tx-new .tx-start-opt');
      check('/textures: its own heading', (await page.textContent('.tx-start-hero h1'))?.includes('Make Minecraft look'));
      check('/textures: Create pack', (await page.textContent('.tx-create-btn .btn-label'))?.trim() === 'Create pack');
      await page.click('.tx-create-btn');
      await page.waitForURL(/\/textures\/[0-9a-f-]+\/?$/, { timeout: 15000 });
      await editorReady(page);
      await page.waitForTimeout(600);
      check('/textures: a new pack opens in Blocks as before', (await lib(page)) === '' && (await page.isVisible('.tx-mb')));
      check('/textures: no focus on the project', await page.evaluate(() => !('focus' in window.__tx.store.project)));
      await page.close();
      await ctx.close();
    }

    // ------------------------------------------------------------------ phone
    {
      const ctx = await context({ width: 390, height: 844 });
      const page = await ctx.newPage();
      watch(page, 'phone');
      await page.goto(base + 'gui-maker');
      await page.waitForSelector('.tx-new .tx-create-btn');
      await page.waitForSelector('[data-tool-intro="gui"].is-below', { timeout: 30000 });
      check('phone: the GUI maker page has no sideways scroll', await noSideScroll(page));
      await shot(page, 'phone-start');
      await page.click('.tx-create-btn');
      await page.waitForURL(/\/textures\/[0-9a-f-]+\/?$/, { timeout: 15000 });
      await editorReady(page);
      await page.waitForFunction(() => window.__tx.canvas.current()?.key.endsWith('gui/sprites/hud/hotbar.png'), null, { timeout: 60000 });
      check('phone: the editor opens on the hotbar', (await lib(page)) === 'gui');
      check('phone: on the Paint tab', await page.evaluate(() => document.querySelector('.tx-editor')?.dataset.mobile === 'editor'));
      check('phone: no sideways scroll in the editor', await noSideScroll(page));
      await shot(page, 'phone-editor');
      await page.close();
      await ctx.close();
    }

    // ------------------------------------------------------------------ a translated page
    {
      const ctx = await context();
      const page = await ctx.newPage();
      watch(page, 'de');
      await page.goto(base + 'de/music-disc-maker');
      await page.waitForSelector('[data-tool-intro="disc"].is-below', { timeout: 30000 });
      check('de: the start screen in German', (await page.textContent('.tx-create-btn .btn-label'))?.trim() === 'Schallplatten-Pack erstellen');
      check('de: the introduction in German', (await page.textContent('[data-tool-intro="disc"] h2'))?.includes('Schallplatten'));
      await page.close();
      await ctx.close();
    }

    check('no console errors', errors.length === 0, errors.slice(0, 4).join(' | '));
  } catch (err) {
    console.error(err);
    failures++;
  } finally {
    await browser.close();
    server?.stop();
  }
  console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
  process.exit(failures ? 1 : 0);
})();
