// The texture pack maker in German, Japanese, Spanish, Portuguese and Russian, in Chromium. Each language
// starts a pack and goes through the library (blocks, all textures, mobs, sounds), the pixel editor,
// the effects, painting on the 3D model, a mob, the sound editor, the GUI section (library, preview
// screens, splash texts), the model editor, the PvP tab, the Material tab (quick materials, a part,
// "Use on similar textures"), the pack settings, the keyboard shortcuts and the export
// dialog. Every state is checked for English left in
// the visible text and labels, for content wider than the screen or clipped labels, and for console
// errors, at 1280 and 390 px wide in the dark and the light theme.
//
// Usage: NODE_PATH=$(npm root -g) TO_FIXTURES=<dir> node tests/e2e/i18n/textures.e2e.mjs [baseUrl] [--shots <dir>] [--langs de,ja] [--widths 390]
// Needs the Java 26.3 game files of TO_FIXTURES (the textures, models and mobs of a new pack); the
// game's sounds are routed with a small made-up list. Names that come from the game's own files
// (texture, block, item and mob names, sound events) are in English in every language and are not
// counted as English left over.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url);
const { startVite, launch, routeMojang, fixturesDir } = require('../textures/lib.cjs');

const argv = process.argv.slice(2);
const baseArg = argv.find((a) => /^https?:/.test(a));
const opt = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);
const shotsDir = opt('--shots');
if (shotsDir) mkdirSync(shotsDir, { recursive: true });
const LANGS = (opt('--langs') ?? 'de,ja,es,pt-br,ru').split(',');
const WIDTHS = (opt('--widths') ?? '1280,390').split(',').map(Number);

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
}

// ------------------------------------------------------------------ the game's sounds (made up)
const SOUNDS_JSON = {
  'ambient.cave': { sounds: ['ambient/cave/cave1', 'ambient/cave/cave2'] },
  'block.stone.break': { sounds: ['block/stone/break1', { name: 'block/stone/break2', volume: 0.9, pitch: 0.8, weight: 2 }] },
  'entity.creeper.primed': { sounds: ['random/fuse'] },
  'music_disc.cat': { sounds: [{ name: 'records/cat', stream: true }] },
  'ui.button.click': { sounds: ['random/click'] },
};
const hashOf = (s) => createHash('sha1').update(s).digest('hex');
const INDEX = { objects: { 'minecraft/sounds.json': { hash: hashOf('sounds.json'), size: 1 } } };
for (const e of Object.values(SOUNDS_JSON)) for (const s of e.sounds) INDEX.objects[`minecraft/sounds/${typeof s === 'string' ? s : s.name}.ogg`] = { hash: hashOf(String(s.name ?? s)), size: 1 };

async function routeSounds(ctx) {
  const cors = { 'access-control-allow-origin': '*' };
  await ctx.route(/^https:\/\/piston-meta\.mojang\.com\/v1\/packages\/[0-9a-f]+\/\d+\.json$/, (r) => r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(INDEX) }));
  await ctx.route(/^https:\/\/(raw\.githubusercontent\.com\/misode\/mcmeta\/|cdn\.jsdelivr\.net\/gh\/misode\/mcmeta@)[^/]+-assets\/assets\/minecraft\/sounds\.json$/, (r) =>
    r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(SOUNDS_JSON) }),
  );
  await ctx.route(/^https:\/\/resources\.download\.minecraft\.net\//, (r) => r.fulfill({ status: 404, body: '' }));
}

// ------------------------------------------------------------------ checks run in the page
/**
 * Names from the game's files: texture, block, item and mob names, sound events and files. They
 * are English in every language (the game's own names, searched in English).
 */
const GAME_NAMES = [
  '.tx-tile', '.tx-tile-name', '.tx-tile-id', '.tx-mb-tile', '.tx-head-title', '.tx-head-sub', '.tx-usedby-chip', '.tx-pv-texname', '.tx-pv-name', '.tx-pv-sub', '.snd-row',
  '.me-title-name', '.me-title-sub', '.me-tex-name', '.me-tp-name', '.me-tp-tile', '.tx-rc-name', '.gui-sp-text',
];

function collectTexts(gameNames) {
  const root = document.querySelector('main') ?? document.body;
  const visible = (el) => {
    if (!el.getClientRects().length) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  const game = gameNames.join(', ');
  const skip = (el) => !!el.closest('code, kbd, script, style, input, textarea, .site-footer, .sr-only-skip, [data-tool-intro]') || !!el.closest(game);
  const out = [];
  const add = (n) => {
    const el = n.parentElement;
    const text = n.textContent.replace(/\s+/g, ' ').trim();
    if (!text || !el || skip(el)) return;
    if (!visible(el) && !el.closest('.sr-only')) return;
    out.push(text);
  };
  for (const r of [root, ...document.querySelectorAll('dialog[open], .popover, .menu, [role=tooltip]')]) {
    const walker = document.createTreeWalker(r, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) add(n);
  }
  const labelled = [...root.querySelectorAll('[aria-label], [title], [placeholder]'), ...document.querySelectorAll('dialog[open] [aria-label], dialog[open] [placeholder], .popover [aria-label], .popover [placeholder], .menu [aria-label]')];
  for (const el of labelled) {
    if (skip(el) || !visible(el)) continue;
    for (const a of ['aria-label', 'title', 'placeholder']) {
      const v = el.getAttribute(a);
      if (v && v.trim()) out.push(v.trim());
    }
  }
  return [...new Set(out)];
}

function layoutIssues() {
  const issues = [];
  const vw = document.documentElement.clientWidth;
  if (document.documentElement.scrollWidth > vw + 1) issues.push(`page scrolls sideways (${document.documentElement.scrollWidth} > ${vw})`);
  const scroller = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflowX === 'auto' || cs.overflowX === 'scroll' || cs.overflowX === 'hidden' || cs.overflowX === 'clip') return true;
    }
    return false;
  };
  const describe = (el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${(el.textContent ?? '').trim().slice(0, 60)}"`;
  const roots = [document.querySelector('main') ?? document.body, ...document.querySelectorAll('dialog[open], .popover, .menu')];
  for (const root of roots) {
    for (const el of root.querySelectorAll('*')) {
      if (el.closest('.site-footer, svg, canvas')) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.display === 'inline' || cs.position === 'fixed') continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 1 || r.height <= 1 || el.closest('.sr-only')) continue;
      if ((r.right > vw + 1 || r.left < -1) && !scroller(el)) issues.push(`outside the screen: ${describe(el)} (${Math.round(r.left)}–${Math.round(r.right)} of ${vw})`);
      const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!ownText || el.classList.contains('truncate') || cs.textOverflow === 'ellipsis') continue;
      if (el.scrollWidth <= el.clientWidth + 1 || cs.overflowX === 'auto' || cs.overflowX === 'scroll') continue;
      // On touch screens a transparent ::after widens what a tap hits past the control, which
      // scrollWidth counts: then measure the content itself against the control's inside.
      if (getComputedStyle(el, '::after').position === 'absolute') {
        const range = document.createRange();
        range.selectNodeContents(el);
        const c = range.getBoundingClientRect();
        const inLeft = r.left + parseFloat(cs.borderLeftWidth);
        const inRight = r.right - parseFloat(cs.borderRightWidth);
        if (c.left >= inLeft - 1 && c.right <= inRight + 1) continue;
      }
      issues.push(`spills out: ${describe(el)} (${el.scrollWidth} > ${el.clientWidth})`);
    }
  }
  return [...new Set(issues)];
}

/** Labels cut off with an ellipsis that are not game names (those are long in every language). */
function cutLabels(gameNames) {
  const out = [];
  const game = gameNames.join(', ');
  for (const el of document.querySelectorAll('main *, dialog[open] *, .popover *, .menu *')) {
    const cs = getComputedStyle(el);
    if (cs.textOverflow !== 'ellipsis' || cs.display === 'none' || !el.getClientRects().length) continue;
    // The version picker's detail (pack format) is the part made to give way first.
    if (el.closest(game) || el.closest('input, select, .site-footer, .tx-rc, .vp-sub')) continue;
    // File paths are as long in every language.
    if (/^[\w./:-]+$/.test(el.textContent.trim())) continue;
    if (el.scrollWidth > el.clientWidth + 1) out.push(`"${el.textContent.trim().slice(0, 50)}" (${el.className})`);
  }
  return out;
}

// ------------------------------------------------------------------ English detection
const KEEP = [
  'Texture Pack Maker', 'Texture Packs', 'Texture Pack', 'Texture pack', 'Minecraft Java Edition', 'Minecraft', 'Java', 'Bedrock', 'Mojang', 'Ogg Vorbis', 'Scale2x', 'Scale3x', 'Game Boy', 'PICO-8',
  'Pixelwelt', 'Bloco', 'Kachel', 'Celular', 'Кубомир', 'PNG', 'JPG', 'GIF', 'WebP', 'TGA', 'MP3', 'WAV', 'OGG', 'M4A', 'JSON', 'UV', 'HD', 'GUI', 'FMOD', 'FSB5', 'Creeper', 'Sprite', 'Noir', 'Cartoon',
  'Ctrl', 'Shift', 'Alt', 'Esc', 'Enter', 'Delete', 'Chrome', 'Edge', 'Firefox', 'Safari', 'https', 'kHz', 'Mob', 'Mobs', 'Pack', 'Packs', 'Add-on',
];
const ENGLISH = /(?<!\p{L})(the|and|your|with|you|to|of|is|are|this|that|from|can|it|its|were|has|have|not|or|on|by|be|will|choose|drop|download|convert|merge|upload|cancel|loading|reading|saving|getting|starting|open|change|remove|keep|pick|try|add|click|browse|edit|undo|redo|search|show|hide)(?!\p{L})/iu;

function english(texts, locale) {
  const found = [];
  for (const text of texts) {
    let s = text;
    for (const k of KEEP) s = s.split(k).join(' ');
    // Paths, file names, versions, keys and quoted examples of the (English) game names.
    s = s.replace(/[“"«「][^”"»」]*[”"»」]/g, ' ').replace(/\S*[./_\\0-9:#×§]\S*/g, ' ');
    const words = s.match(/[A-Za-z]{2,}/g) ?? [];
    if (locale === 'ja' ? words.length >= 2 && !/[぀-ヿ一-鿿]/.test(text) : ENGLISH.test(s)) found.push(text);
    // Russian: two Latin words and no Cyrillic is English (or another language) left over.
    else if (locale === 'ru' && words.length >= 2 && !/\p{Script=Cyrillic}/u.test(text)) found.push(text);
  }
  return found;
}

// ------------------------------------------------------------------ run
const LANG = { de: 'de', es: 'es', 'pt-br': 'pt-BR', ja: 'ja', ru: 'ru' };
/** A few words each language's editor shows, to be sure the page is in that language. */
const EXPECT = {
  de: { create: 'Pack erstellen', export: 'Exportieren', effects: 'Effekte' },
  es: { create: 'Crear pack', export: 'Exportar', effects: 'Efectos' },
  'pt-br': { create: 'Criar pack', export: 'Exportar', effects: 'Efeitos' },
  ja: { create: 'パックを作る', export: '書き出す', effects: '効果' },
  ru: { create: 'Создать пак', export: 'Экспорт', effects: 'Эффекты' },
};
const PACK_NAME = { de: 'Pixelwelt', es: 'Celular', 'pt-br': 'Bloco', ja: 'Kachel', ru: 'Кубомир' };

const fx = fixturesDir();
if (!fx) {
  console.log('TO_FIXTURES with the Java 26.3 game files is needed: skipped');
  process.exit(0);
}
const server = baseArg ? null : await startVite();
const base = (baseArg || server.url).replace(/\/?$/, '/');
console.log(`base ${base} · fixtures ${fx}`);
const browser = await launch();

async function inspect(page, label, locale, opts = {}) {
  await page.waitForTimeout(opts.wait ?? 250);
  const texts = await page.evaluate(collectTexts, GAME_NAMES);
  const left = english(texts, locale);
  check(`${label}: no English left`, left.length === 0, left.slice(0, 8).map((t) => `"${t.slice(0, 90)}"`).join(' · '));
  const layout = await page.evaluate(layoutIssues);
  check(`${label}: nothing overflows`, layout.length === 0, layout.slice(0, 6).join(' · '));
  const cut = await page.evaluate(cutLabels, GAME_NAMES);
  check(`${label}: no label cut off`, cut.length === 0, cut.slice(0, 6).join(' · '));
  if (shotsDir) await page.screenshot({ path: join(shotsDir, `${label.replace(/[^\w.-]+/g, '-')}.png`), fullPage: !!opts.full });
}

/** Shows a part of the editor: on a phone through the tab bar, on a computer through the side tabs. */
async function show(page, phone, v) {
  if (phone) await page.click(`.tx-tabbar-btn[data-v="${v}"]`);
  else if (v !== 'editor' && v !== 'textures') await page.click(`.tx-col-tabs .tab[data-value="${v}"]`);
  else if (v === 'textures') await page.click('.tx-col-tabs .tab[data-value="textures"]').catch(() => undefined);
  await page.waitForTimeout(250);
}

async function closeDialog(page) {
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('dialog[open]'), null, { timeout: 5000 }).catch(() => undefined);
}

try {
  for (const width of WIDTHS) {
    for (const theme of ['dark', 'light']) {
      const tag = `${width}-${theme}`;
      const phone = width < 600;
      const ctx = await browser.newContext({ viewport: { width, height: phone ? 780 : 860 }, colorScheme: theme, deviceScaleFactor: phone ? 2 : 1, acceptDownloads: true, hasTouch: phone });
      await ctx.addInitScript((t) => {
        try {
          localStorage.setItem('to-theme', t);
        } catch {
          /* private mode */
        }
      }, theme);
      await routeMojang(ctx, fx);
      await routeSounds(ctx);

      for (const lang of LANGS) {
        const L = `${lang}-${tag}`;
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`));
        page.on('console', (m) => {
          if (m.type() === 'error' && !/favicon|Failed to load resource|ERR_|404/.test(m.text())) errors.push(m.text());
        });
        try {
          // ------------------------------------------------ start screen
          await page.goto(`${base}${lang}/textures/`);
          await page.waitForSelector('.tx-new');
          check(`${L}: page language`, (await page.getAttribute('html', 'lang')) === LANG[lang]);
          check(`${L}: create button translated`, (await page.textContent('.tx-create-btn')).trim() === EXPECT[lang].create, (await page.textContent('.tx-create-btn')).trim());
          await inspect(page, `tex-${L}-01-start`, lang, { full: true });

          // ------------------------------------------------ new pack: library
          await page.fill('.tx-name-field input', PACK_NAME[lang]);
          await page.click('.tx-create-btn');
          await page.waitForURL(/\/textures\/[0-9a-f-]+\/?$/, { timeout: 15000 });
          await page.waitForFunction(() => !!window.__tx && document.querySelector('.tx-main'), null, { timeout: 180000 });
          if (phone) await show(page, phone, 'textures');
          // the list is showing (a phone's list, with finger-sized controls above it, has room for about ten)
          await page.waitForFunction(() => document.querySelectorAll('.tx-mb-tile').length > 6, null, { timeout: 120000 });
          check(`${L}: export button translated`, ((await page.getAttribute('.tx-export-btn', 'aria-label')) ?? (await page.textContent('.tx-export-btn'))).includes(EXPECT[lang].export));
          await inspect(page, `tex-${L}-02-blocks`, lang);
          await page.evaluate(() => window.__tx.setLibraryMode('textures'));
          await page.waitForSelector('.tx-tile.loaded', { timeout: 120000 });
          await inspect(page, `tex-${L}-03-all-textures`, lang);
          await page.locator('.tx-browser:not(.tx-mb) .tx-search-input:visible').fill('zzqq');
          await page.waitForSelector('.tx-browser:not(.tx-mb) .empty, .tx-browser:not(.tx-mb) .tx-empty', { timeout: 10000 }).catch(() => undefined);
          await inspect(page, `tex-${L}-04-no-match`, lang);
          await page.locator('.tx-browser:not(.tx-mb) .tx-search-input:visible').fill('');

          // ------------------------------------------------ pixel editor
          await page.evaluate(() => window.__tx.open('assets/minecraft/textures/block/stone.png'));
          await page.waitForFunction(() => window.__tx.canvas.current()?.key.endsWith('block/stone.png') && !!window.__tx.canvas.canvas(), null, { timeout: 60000 });
          if (phone) await show(page, phone, 'editor');
          await page.evaluate(() => {
            const pc = window.__tx.canvas.canvas();
            pc.setTool('pencil');
            pc.setColor([200, 30, 30, 255]);
          });
          const pt = await page.evaluate(() => {
            const pc = window.__tx.canvas.canvas();
            const r = pc.element.querySelector('canvas').getBoundingClientRect();
            const [sx, sy] = pc.getView().toScreen(4.5, 4.5);
            return [r.left + sx, r.top + sy];
          });
          await page.mouse.click(pt[0], pt[1]).catch(() => undefined);
          await page.waitForSelector('.tx-save[data-state="saved"]', { timeout: 30000 }).catch(() => undefined);
          await inspect(page, `tex-${L}-05-pixel-editor`, lang);

          // ------------------------------------------------ effects
          await show(page, phone, 'effects');
          await page.waitForSelector('.tx-preset[data-preset="dark-mode"]');
          check(`${L}: effects tab translated`, (await page.textContent(phone ? '.tx-tabbar-btn[data-v="effects"]' : '.tx-col-tabs .tab[data-value="effects"]')).includes(EXPECT[lang].effects));
          await page.click('.tx-preset[data-preset="dark-mode"]');
          await page.waitForSelector('.tx-preset-wrap.is-active .tx-preset[data-preset="dark-mode"]');
          await inspect(page, `tex-${L}-06-effects`, lang);
          await page.click('.tx-fx-add, .tx-effects .btn:has(.icon[data-icon="plus"])').catch(() => undefined);
          if (await page.$('.menu, .popover')) {
            await inspect(page, `tex-${L}-07-add-effect`, lang);
            await page.keyboard.press('Escape');
          }

          // ------------------------------------------------ painting on the 3D block
          await page.evaluate(() => window.__tx.setWorkspace('3d'));
          await page.evaluate(() => window.__tx.showBlock('furnace'));
          await page.waitForFunction(() => window.__tx.preview.current()?.entry.id === 'furnace', null, { timeout: 30000 });
          if (phone) await show(page, phone, 'editor');
          await inspect(page, `tex-${L}-08-paint3d`, lang, { wait: 800 });
          if (!phone) {
            await show(page, phone, 'preview');
            await inspect(page, `tex-${L}-09-preview`, lang);
          } else {
            await show(page, phone, 'preview');
            await inspect(page, `tex-${L}-09-preview`, lang);
          }

          // ------------------------------------------------ a mob with armour
          await page.evaluate(() => window.__tx.setLibraryMode('mobs'));
          await page.evaluate(() => window.__tx.showMob('zombie'));
          await page.waitForFunction(() => window.__tx.preview.current()?.entry.id === 'zombie' && window.__tx.preview.view3d()?.mode === 'model', null, { timeout: 60000 });
          await page.waitForSelector('.tx-pv-state[data-prop="armor"] select', { timeout: 30000 }).catch(() => undefined);
          if (phone) await show(page, phone, 'preview');
          await inspect(page, `tex-${L}-10-mob`, lang, { wait: 600 });
          if (phone) await show(page, phone, 'editor');
          if (await page.isVisible('.tx-pv-partsbtn')) {
            await page.click('.tx-pv-partsbtn');
            await page.waitForSelector('.tx-pv-partspop .tx-pv-part', { timeout: 5000 }).catch(() => undefined);
            await inspect(page, `tex-${L}-11-mob-parts`, lang);
            await page.keyboard.press('Escape');
          }
          if (phone) await show(page, phone, 'textures');
          await inspect(page, `tex-${L}-12-mob-list`, lang);
          await page.evaluate(() => window.__tx.setWorkspace('2d'));

          // ------------------------------------------------ sounds
          if (phone) await show(page, phone, 'textures');
          await page.locator('.tx-libbar .segmented-item[data-value="sounds"]:visible').first().click();
          await page.waitForFunction(() => document.querySelectorAll('.snd-row').length > 0, null, { timeout: 60000 });
          await inspect(page, `tex-${L}-13-sound-list`, lang);
          await page.locator('.snd-row:has-text("block.stone.break"), .snd-row').first().click();
          await page.waitForSelector('.snd-panel .snd-var', { timeout: 30000 });
          if (phone) await show(page, phone, 'editor');
          await inspect(page, `tex-${L}-14-sound-editor`, lang);
          await page.locator('.snd-var-replace').first().click();
          await page.waitForSelector('.menu [role="menuitem"]', { timeout: 5000 }).catch(() => undefined);
          await inspect(page, `tex-${L}-15-sound-replace-menu`, lang);
          await page.keyboard.press('Escape');

          // ------------------------------------------------ GUI and menus: library, preview screens, splash texts
          if (phone) await show(page, phone, 'textures');
          await page.locator('.tx-libbar .segmented-item[data-value="gui"]:visible').first().click();
          await page.waitForSelector('.gui-lib .gui-tile', { timeout: 60000 });
          await page.waitForFunction(() => window.__tx.canvas.current()?.key.includes('/gui/'), null, { timeout: 60000 }).catch(() => undefined);
          await inspect(page, `tex-${L}-15b-gui-list`, lang, { wait: 600 });
          await page.locator('.gui-tile[data-piece="hearts.full"]').click();
          await page.waitForFunction(() => window.__tx.canvas.current()?.key.endsWith('heart/full.png'), null, { timeout: 60000 });
          if (phone) await inspect(page, `tex-${L}-15c-gui-paint`, lang);
          await show(page, phone, 'preview');
          for (const screen of ['hud', 'inventory', 'title', 'menu', 'glint']) {
            await page.locator(`.gui-pv-screen[data-screen="${screen}"]:visible`).first().click();
            await inspect(page, `tex-${L}-15d-gui-${screen}`, lang, { wait: 400 });
          }
          if (phone) await show(page, phone, 'textures');
          await page.locator('.gui-splash-row:visible').click();
          await page.waitForSelector('.gui-sp .gui-sp-edit', { timeout: 30000 });
          await inspect(page, `tex-${L}-15e-gui-splashes`, lang);
          await page.click('.gui-sp-edit');
          await page.waitForSelector('.gui-sp-row');
          await inspect(page, `tex-${L}-15f-gui-splashes-edit`, lang);
          if (phone) await show(page, phone, 'textures');
          await page.locator('.tx-libbar .segmented-item[data-value="blocks"]:visible').first().click();

          // ------------------------------------------------ model editor
          await page.evaluate(() => window.__tx.showBlock('oak_slab'));
          await page.waitForFunction(() => window.__tx.preview.current()?.entry.id === 'oak_slab', null, { timeout: 30000 });
          if (phone) await show(page, phone, 'preview');
          await page.waitForSelector('.tx-pv-shapebtn:not([hidden])', { timeout: 30000 });
          await page.click('.tx-pv-shapebtn');
          await page.waitForSelector(phone ? '.me-root .me-side-tabs' : '.me-root .me-cuberow', { timeout: 60000 });
          await inspect(page, `tex-${L}-16-model-cube`, lang, { wait: 600 });
          for (const tab of ['cubes', 'faces', 'display', 'model']) {
            const t = await page.$(`.me-side-tabs .tab[data-value="${tab}"]`);
            if (!t || !(await t.isVisible())) continue;
            await t.click();
            await inspect(page, `tex-${L}-17-model-${tab}`, lang);
          }
          await page.click('.me-back');
          await page.waitForSelector('.tx-main', { state: 'visible' });

          // ------------------------------------------------ PvP tab, its preset switched on
          await show(page, phone, 'pvp');
          await page.waitForSelector('.pvp-tweak', { state: 'visible', timeout: 60000 });
          await inspect(page, `tex-${L}-17b-pvp`, lang);
          await page.click('.pvp-preset-btn');
          await page.waitForFunction(() => document.querySelectorAll('.pvp-tweak.is-on').length >= 5 && !document.querySelector('.pvp-tweak.is-busy'), null, { timeout: 60000 });
          await inspect(page, `tex-${L}-17c-pvp-on`, lang, { wait: 400 });
          await page.evaluate(() => document.querySelector('.pvp-tweak[data-tweak="crosshair"]')?.scrollIntoView({ block: 'start' }));
          await inspect(page, `tex-${L}-17d-pvp-crosshair`, lang);

          // ------------------------------------------------ Material tab: quick materials, a part, similar textures
          await page.evaluate(() => window.__tx.open('assets/minecraft/textures/block/diamond_ore.png'));
          await page.waitForFunction(() => window.__tx.canvas.current()?.key.endsWith('/diamond_ore.png'), null, { timeout: 30000 });
          await show(page, phone, 'material');
          await page.waitForSelector('.pbr-presets', { state: 'visible', timeout: 60000 });
          await inspect(page, `tex-${L}-17e-material`, lang, { wait: 600 });
          await page.click('.pbr-preset[data-preset="glowSpots"]');
          await page.click('.pbr-part[data-part="0"]');
          await page.selectOption('.pbr-where .pbr-kind select', 'colour');
          await page.evaluate(() => document.querySelector('.pbr-where')?.scrollIntoView({ block: 'start' }));
          await inspect(page, `tex-${L}-17f-material-part`, lang, { wait: 400 });
          await page.evaluate(() => document.querySelector('.pbr-actions')?.scrollIntoView({ block: 'end' }));
          await inspect(page, `tex-${L}-17g-material-bumps`, lang);
          await page.click('.pbr-similar-btn');
          await page.waitForSelector('.pbr-sim-modal .pbr-sim-row');
          await page.click('.pbr-sim-row[data-kind="suffix"] .switch');
          await inspect(page, `tex-${L}-17h-material-similar`, lang);
          await closeDialog(page);

          // ------------------------------------------------ pack settings
          await show(page, phone, 'pack');
          await inspect(page, `tex-${L}-18-pack`, lang);
          const codes = await page.$('.tx-mc-codes-btn, .tx-pack-codes, button[aria-label][data-codes]');
          if (codes) {
            await codes.click();
            await inspect(page, `tex-${L}-19-pack-codes`, lang);
            await page.keyboard.press('Escape');
          }

          // ------------------------------------------------ keyboard shortcuts
          if (!phone) {
            await page.locator('body').click({ position: { x: 3, y: 3 } }).catch(() => undefined);
            await page.click('.tx-bar-actions [aria-keyshortcuts="?"], .tx-shortcuts-btn').catch(() => page.keyboard.press('?'));
            if (await page.waitForSelector('dialog[open]', { timeout: 3000 }).catch(() => null)) {
              await inspect(page, `tex-${L}-20-shortcuts`, lang);
              await closeDialog(page);
            }
          }

          // ------------------------------------------------ export
          await page.click('.tx-export-btn');
          await page.waitForSelector('.tx-export-modal .tx-exp-rows');
          await inspect(page, `tex-${L}-21-export`, lang);
          const [download] = await Promise.all([page.waitForEvent('download', { timeout: 180000 }), page.click('.tx-export-modal .modal-footer .btn-primary')]);
          await download.path();
          await page.waitForSelector('.tx-exp-done', { timeout: 60000 });
          await page.$$eval('.tx-export-modal details', (ds) => ds.forEach((d) => (d.open = true)));
          await inspect(page, `tex-${L}-22-exported`, lang);
          await closeDialog(page);

          // ------------------------------------------------ back on the start screen: the pack in the list
          await page.goto(`${base}${lang}/textures/`);
          await page.waitForSelector('.tx-rc, .tx-recent', { timeout: 15000 }).catch(() => undefined);
          await inspect(page, `tex-${L}-23-start-recent`, lang, { full: true });
        } catch (err) {
          check(`${L}: walk-through finished`, false, String(err?.message ?? err).split('\n')[0]);
          if (shotsDir) await page.screenshot({ path: join(shotsDir, `tex-${L}-FAILED.png`) }).catch(() => undefined);
        }
        check(`${L}: no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
        await page.close();
      }
      await ctx.close();
    }
  }
} catch (err) {
  console.error(err);
  failures++;
} finally {
  await browser.close();
  server?.stop();
}

console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
