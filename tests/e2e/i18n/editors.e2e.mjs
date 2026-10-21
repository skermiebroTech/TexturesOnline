// The translated editors in Chromium: the converter in German, the merger in Japanese and
// Portuguese, the totem maker in Spanish, and all three in Russian. Each is driven through its main states (pack opened,
// version list, conversion or merge report, skin chosen, pixel editor) and every state is checked
// for English left in the visible text and labels, for content wider than the screen or clipped
// labels, and for console errors, at 1280 and 390 px wide in the dark and the light theme.
//
// Usage: NODE_PATH=$(npm root -g) TO_FIXTURES=<dir> node tests/e2e/i18n/editors.e2e.mjs [baseUrl] [--shots <dir>] [--langs de,ru]
// Without TO_FIXTURES the steps that need Java 26.3 game files (the conversion, the vanilla totem
// outline) are skipped; the rest needs no network. Test packs and skins are made on the fly.
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { ROOT, startVite, launch, routeMojang, fixturesDir } = require('../textures/lib.cjs');

const argv = process.argv.slice(2);
const baseArg = argv.find((a) => /^https?:/.test(a));
const shotsDir = argv.includes('--shots') ? argv[argv.indexOf('--shots') + 1] : null;
/** --langs de,ru: run some languages only */
const LANGS = (argv.includes('--langs') ? argv[argv.indexOf('--langs') + 1] : 'de,ja,pt-br,es,ru').split(',');
if (shotsDir) mkdirSync(shotsDir, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'i18n-editors-'));
const J = 'assets/minecraft/textures/';

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
}

// ------------------------------------------------------------------ test files (original pixel art)
async function encodePng(w, h, fn) {
  const { encode } = await import(join(ROOT, 'node_modules/fast-png/lib/index.js'));
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(fn(x, y), (y * w + x) * 4);
  return encode({ width: w, height: h, data, channels: 4, depth: 8 });
}
const checker = (a, b) => (x, y) => (((x >> 2) + (y >> 2)) % 2 ? a : b);
const enc = (s) => new TextEncoder().encode(typeof s === 'string' ? s : JSON.stringify(s));

async function makeFiles() {
  const { zipSync } = require(join(ROOT, 'node_modules/fflate'));
  const RED = [220, 30, 30, 255];
  const GREY = [90, 90, 90, 255];
  const BLUE = [30, 60, 220, 255];
  // Pack names avoid English words: they are the user's text, shown as they are.
  const legacy = zipSync({
    'pack.mcmeta': enc({ pack: { pack_format: 3, description: 'Pixelwelt' } }),
    'pack.png': await encodePng(64, 64, checker([250, 200, 40, 255], [40, 40, 40, 255])),
    [`${J}blocks/stone.png`]: await encodePng(16, 16, checker(RED, GREY)),
    [`${J}blocks/grass_top.png`]: await encodePng(16, 16, checker([60, 160, 60, 255], [80, 190, 70, 255])),
    [`${J}blocks/quartz_ore.png`]: await encodePng(16, 16, checker(BLUE, GREY)),
    [`${J}blocks/flower_rose.png`]: await encodePng(16, 16, checker(RED, [0, 0, 0, 0])),
    'assets/minecraft/models/block/stone.json': enc({ parent: 'block/cube_all', textures: { all: 'blocks/stone' } }),
    'assets/minecraft/sounds/dig/stone1.ogg': new Uint8Array([79, 103, 103, 83]),
  });
  const modern = zipSync({
    'pack.mcmeta': enc({ pack: { min_format: [97, 1], max_format: 97, description: 'Bloco' } }),
    [`${J}block/stone.png`]: await encodePng(16, 16, checker(BLUE, GREY)),
    [`${J}block/dirt.png`]: await encodePng(16, 16, checker([120, 80, 40, 255], GREY)),
    'assets/minecraft/lang/en_us.json': enc({ 'block.minecraft.stone': 'Pedra' }),
  });
  const modern2 = zipSync({
    'pack.mcmeta': enc({ pack: { min_format: [97, 1], max_format: 97, description: 'Kachel' } }),
    [`${J}block/stone.png`]: await encodePng(16, 16, checker(RED, BLUE)),
    'assets/minecraft/lang/en_us.json': enc({ 'block.minecraft.dirt': 'Terra' }),
  });
  const bedrock = zipSync({
    'manifest.json': enc({
      format_version: 2,
      header: { name: 'Celular', description: 'Celular', uuid: '8f0b5a0e-6c55-4d3b-9b1e-0a4c2f9d7e11', version: [1, 0, 0], min_engine_version: [1, 21, 0] },
      modules: [{ type: 'resources', uuid: '2a6d8c1b-3f4e-4a5b-8c7d-9e0f1a2b3c4d', version: [1, 0, 0] }],
    }),
    'textures/blocks/stone.png': await encodePng(16, 16, checker(BLUE, GREY)),
  });
  const loose = zipSync({
    'Texturas/stone.png': await encodePng(16, 16, checker([250, 120, 0, 255], GREY)),
    'Texturas/foto.png': await encodePng(8, 8, () => [1, 2, 3, 255]),
  });
  const skin = await encodePng(64, 64, (x, y) => {
    if (y < 16 && x >= 32) return [0, 0, 0, 0];
    if (x >= 8 && x < 16 && y >= 8 && y < 16) return y < 10 ? [60, 40, 20, 255] : [230, 180, 140, 255];
    if (x >= 20 && x < 28 && y >= 20 && y < 32) return [40, 120, 220, 255];
    return [90, 90, 120, 255];
  });
  const files = {
    legacy: join(tmp, 'Pixelwelt.zip'),
    modern: join(tmp, 'Bloco.zip'),
    modern2: join(tmp, 'Kachel.zip'),
    bedrock: join(tmp, 'Celular.mcpack'),
    loose: join(tmp, 'Texturas.zip'),
    skin: join(tmp, 'Aventureira.png'),
  };
  writeFileSync(files.legacy, legacy);
  writeFileSync(files.modern, modern);
  writeFileSync(files.modern2, modern2);
  writeFileSync(files.bedrock, bedrock);
  writeFileSync(files.loose, loose);
  writeFileSync(files.skin, skin);
  return files;
}

// ------------------------------------------------------------------ checks run in the page
/** Visible text and labels of the page's main content (the footer is the public pages' and checked there). */
function collectTexts() {
  const root = document.querySelector('main') ?? document.body;
  const visible = (el) => {
    if (!el.getClientRects().length) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  const skip = (el) => !!el.closest('code, kbd, script, style, .site-footer, .sr-only-skip');
  const out = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    const text = n.textContent.replace(/\s+/g, ' ').trim();
    if (!text || !el || skip(el)) continue;
    if (!visible(el) && !el.closest('.sr-only')) continue;
    out.push(text);
  }
  // Labels read out or shown on hover, of everything on screen plus open dialogs and popovers.
  const labelled = [...root.querySelectorAll('[aria-label], [title], [placeholder]'), ...document.querySelectorAll('dialog[open] [aria-label], .popover [aria-label], .popover [placeholder], [role=tooltip]')];
  for (const el of labelled) {
    if (skip(el) || !visible(el)) continue;
    for (const a of ['aria-label', 'title', 'placeholder']) {
      const v = el.getAttribute(a);
      if (v && v.trim()) out.push(v.trim());
    }
  }
  for (const d of document.querySelectorAll('dialog[open], .popover')) {
    const w = document.createTreeWalker(d, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const text = n.textContent.replace(/\s+/g, ' ').trim();
      if (text && n.parentElement && !skip(n.parentElement) && visible(n.parentElement)) out.push(text);
    }
  }
  return [...new Set(out)];
}

/** Content wider than the screen, page side-scrolling, and labels that are cut off or spill out. */
function layoutIssues() {
  const issues = [];
  const vw = document.documentElement.clientWidth;
  if (document.documentElement.scrollWidth > vw + 1) issues.push(`page scrolls sideways (${document.documentElement.scrollWidth} > ${vw})`);
  const scroller = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX;
      if (o === 'auto' || o === 'scroll') return true;
    }
    return false;
  };
  const describe = (el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${(el.textContent ?? '').trim().slice(0, 60)}"`;
  const roots = [document.querySelector('main') ?? document.body, ...document.querySelectorAll('dialog[open], .popover')];
  for (const root of roots) {
    for (const el of root.querySelectorAll('*')) {
      if (el.closest('.site-footer, svg, canvas')) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.display === 'inline' || cs.position === 'fixed') continue;
      const r = el.getBoundingClientRect();
      // Screen-reader-only text sits in a 1px box on purpose.
      if (r.width <= 1 || r.height <= 1 || el.closest('.sr-only')) continue;
      if ((r.right > vw + 1 || r.left < -1) && !scroller(el)) issues.push(`outside the screen: ${describe(el)} (${Math.round(r.left)}–${Math.round(r.right)} of ${vw})`);
      const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!ownText || el.classList.contains('truncate')) continue;
      if (el.scrollWidth > el.clientWidth + 1 && cs.overflowX !== 'auto' && cs.overflowX !== 'scroll') issues.push(`${cs.textOverflow === 'ellipsis' ? 'cut off' : 'spills out'}: ${describe(el)} (${el.scrollWidth} > ${el.clientWidth})`);
    }
  }
  return [...new Set(issues)];
}

// ------------------------------------------------------------------ English detection
/** Names and words every language keeps, and the test files' own names. */
const KEEP = [
  'Texture Pack Maker', 'Texture Packs', 'Texture Pack', 'Minecraft Launcher', 'Minecraft', 'Java Edition', 'Bedrock Edition', 'Java', 'Bedrock', 'OptiFine', 'Mojang', 'GitHub',
  'Steve', 'Alex', 'Classic', 'Big head', 'Full body', 'Pixelwelt', 'Bloco', 'Kachel', 'Celular', 'Texturas', 'Aventureira', 'jeb_', 'Dinnerbone', 'Notch', 'OK', 'PNG', 'TGA', 'JPEG', 'HD', 'MB', 'KB', 'GB', 'Ctrl', 'Shift', 'Alt', 'Esc', 'Enter',
];
const ENGLISH = /(?<!\p{L})(the|and|your|with|you|to|of|is|are|this|that|from|can|it|its|were|has|have|not|or|on|by|be|will|choose|drop|download|convert|merge|upload|cancel|loading|reading|saving|getting|starting|open|change|remove|keep|pick|try|add|click|browse|edit|undo|redo)(?!\p{L})/iu;

function english(texts, locale) {
  const found = [];
  for (const text of texts) {
    let s = text;
    for (const k of KEEP) s = s.split(k).join(' ');
    s = s.replace(/\S*[./_\\0-9:#×]\S*/g, ' ');
    const words = s.match(/[A-Za-z]{2,}/g) ?? [];
    if (locale === 'ja' ? words.length >= 2 && !/[぀-ヿ一-鿿]/.test(text) : ENGLISH.test(s)) found.push(text);
    // Russian: two Latin words and no Cyrillic is English (or another language) left over.
    else if (locale === 'ru' && words.length >= 2 && !/\p{Script=Cyrillic}/u.test(text)) found.push(text);
  }
  return found;
}

// ------------------------------------------------------------------ run
const LANG = { de: 'de', es: 'es', 'pt-br': 'pt-BR', ja: 'ja', ru: 'ru' };

const files = await makeFiles();
const server = baseArg ? null : await startVite();
const base = (baseArg || server.url).replace(/\/?$/, '/');
const fx = fixturesDir();
console.log(`base ${base} · fixtures ${fx ?? '(none: steps that need game files are skipped)'}`);
const browser = await launch();

async function inspect(page, label, locale) {
  await page.waitForTimeout(120);
  const texts = await page.evaluate(collectTexts);
  const left = english(texts, locale);
  check(`${label}: no English left`, left.length === 0, left.slice(0, 6).map((t) => `"${t.slice(0, 90)}"`).join(' · '));
  const layout = await page.evaluate(layoutIssues);
  check(`${label}: nothing overflows`, layout.length === 0, layout.slice(0, 6).join(' · '));
  if (shotsDir) {
    // The tool itself (not the introduction and footer below it); with a dialog open, the screen.
    const dialog = await page.$('dialog[open]');
    const bottom = await page.evaluate(() => {
      const grid = document.querySelector('.cv-grid, .tt-grid');
      return grid ? Math.ceil(grid.getBoundingClientRect().bottom + window.scrollY + 16) : 0;
    });
    const path = join(shotsDir, `${label.replace(/[^\w.-]+/g, '-')}.png`);
    const width = page.viewportSize().width;
    if (dialog || !bottom) await page.screenshot({ path });
    else await page.screenshot({ path, fullPage: true, clip: { x: 0, y: 0, width, height: bottom } });
  }
}

async function openPage(ctx, path, ready) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  await page.goto(base + path);
  await page.waitForSelector(ready, { timeout: 60000 });
  return { page, errors };
}

try {
  for (const width of [1280, 390]) {
    for (const theme of ['dark', 'light']) {
      const tag = `${width}-${theme}`;
      const ctx = await browser.newContext({ viewport: { width, height: width > 600 ? 860 : 780 }, colorScheme: theme, deviceScaleFactor: 1 });
      await ctx.addInitScript((t) => {
        try {
          localStorage.setItem('to-theme', t);
        } catch {
          /* private mode */
        }
      }, theme);
      await routeMojang(ctx, fx);

      // ---------------------------------------------------------- German converter
      if (LANGS.includes('de')) {
        const { page, errors } = await openPage(ctx, 'de/texture-pack-converter/', '.cv-dz');
        check(`de converter ${tag}: page is German`, (await page.getAttribute('html', 'lang')) === LANG.de && /umwandeln/.test(await page.textContent('.cv-hero h1')));
        check(`de converter ${tag}: step titles translated`, (await page.textContent('.cv-step h2')).trim() === 'Pack wählen');
        await inspect(page, `de-convert-1-start-${tag}`, 'de');
        await page.setInputFiles('.cv-dz input[type=file]', files.legacy);
        await page.waitForSelector('.cv-pack:not([hidden]) .cv-pack-name');
        check(`de converter ${tag}: pack summary in German`, /4 Texturen/.test(await page.textContent('.cv-pack-info')), (await page.textContent('.cv-pack-info')).trim());
        await page.click('.cv-ed[data-value="java"]');
        await page.waitForFunction(() => /Texturen, die zwischen Java/.test(document.querySelector('.cv-hint')?.textContent ?? ''));
        await inspect(page, `de-convert-2-pack-${tag}`, 'de');
        await page.click('.cv-version .vp-trigger');
        await page.waitForSelector('.vp-pop .vp-item, .vp-pop .vp-status', { timeout: 60000 });
        check(`de converter ${tag}: version search in German`, (await page.getAttribute('.vp-pop input[type=search]', 'placeholder')) === 'Versionen suchen, z. B. 1.20');
        await inspect(page, `de-convert-3-versions-${tag}`, 'de');
        await page.keyboard.press('Escape');
        if (fx) {
          await page.click('.cv-go');
          await page.waitForSelector('.cv-result .cv-dl-btn, .cv-result .cv-res-icon.is-error', { timeout: 300000 });
          const head = (await page.textContent('.cv-res-titles h2')).trim();
          check(`de converter ${tag}: report headline in German`, /von 4 Texturen umgewandelt|Alle 4 Texturen umgewandelt/.test(head), head);
          await page.$$eval('.cv-result details', (ds) => ds.forEach((d) => (d.open = true)));
          await inspect(page, `de-convert-4-report-${tag}`, 'de');
        }
        check(`de converter ${tag}: no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
        await page.close();
      }

      // ---------------------------------------------------------- Japanese merger
      if (LANGS.includes('ja')) {
        const { page, errors } = await openPage(ctx, 'ja/merge-texture-packs/', '.mg-dz');
        check(`ja merge ${tag}: page is Japanese`, (await page.getAttribute('html', 'lang')) === LANG.ja && /結合/.test(await page.textContent('.cv-hero h1')));
        await inspect(page, `ja-merge-1-start-${tag}`, 'ja');
        await page.setInputFiles('.mg-dz input[type=file]', [files.modern, files.modern2, files.legacy]);
        await page.waitForFunction(() => document.querySelectorAll('.mg-list .mg-row').length === 3 && !document.querySelector('.mg-dz.is-busy'), null, { timeout: 60000 });
        check(`ja merge ${tag}: merge button counts in Japanese`, /3個のパックを結合/.test(await page.textContent('.mg-go')));
        await inspect(page, `ja-merge-2-packs-${tag}`, 'ja');
        await page.click('.mg-go');
        await page.waitForSelector('.mg-result .mg-dl-btn, .mg-result .cv-res-icon.is-error', { timeout: 120000 });
        const head = (await page.textContent('.mg-result h2')).trim();
        check(`ja merge ${tag}: report in Japanese`, /3個のパックを「/.test(head), head);
        await page.$$eval('.mg-result details', (ds) => ds.forEach((d) => (d.open = true)));
        await inspect(page, `ja-merge-3-report-${tag}`, 'ja');
        check(`ja merge ${tag}: no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
        await page.close();
      }

      // ---------------------------------------------------------- Portuguese merger and converter
      if (LANGS.includes('pt-br')) {
        const { page, errors } = await openPage(ctx, 'pt-br/merge-texture-packs/', '.mg-dz');
        await page.setInputFiles('.mg-dz input[type=file]', [files.modern, files.bedrock]);
        await page.waitForSelector('.mg-hint.is-alert a');
        const hint = await page.textContent('.mg-hint');
        check(`pt-br merge ${tag}: mixed editions explained in Portuguese, with the converter link`, /não podem ser juntados/.test(hint) && (await page.textContent('.mg-hint a')) === 'Conversor de texture packs', hint.trim().slice(0, 120));
        await inspect(page, `pt-br-merge-1-mixed-${tag}`, 'pt-br');
        check(`pt-br merge ${tag}: no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
        await page.close();

        const c = await openPage(ctx, 'pt-br/texture-pack-converter/', '.cv-dz');
        await c.page.setInputFiles('.cv-dz input[type=file]', files.loose);
        await c.page.waitForSelector('.cv-pack:not([hidden]) .cv-pack-name');
        await c.page.$$eval('.cv-pack details', (ds) => ds.forEach((d) => (d.open = true)));
        const notes = await c.page.textContent('.cv-pack');
        check(`pt-br converter ${tag}: loose PNG notes in Portuguese`, /imagem não correspondeu/.test(notes), notes.trim().slice(0, 160));
        await inspect(c.page, `pt-br-convert-1-loose-${tag}`, 'pt-br');
        check(`pt-br converter ${tag}: no console errors`, c.errors.length === 0, c.errors.slice(0, 3).join(' | '));
        await c.page.close();
      }

      // ---------------------------------------------------------- Spanish totem maker
      if (LANGS.includes('es')) {
        const { page, errors } = await openPage(ctx, 'es/totem-maker/', '.tt-tabs');
        check(`es totem ${tag}: page is Spanish`, (await page.getAttribute('html', 'lang')) === LANG.es && /tótems/.test(await page.textContent('.cv-hero h1')));
        await inspect(page, `es-totem-1-start-${tag}`, 'es');
        await page.click('.tt-tab[data-source="upload"]');
        await page.setInputFiles('.tt-dz input[type=file]', files.skin);
        await page.waitForSelector('.tt-chosen:not([hidden]) .tt-chosen-name');
        await page.waitForSelector('.tt-big-canvas');
        check(`es totem ${tag}: style names kept, descriptions in Spanish`, /Classic/.test(await page.textContent('.tt-styles')) && /brazos abiertos/.test(await page.textContent('.tt-styles')));
        await inspect(page, `es-totem-2-skin-${tag}`, 'es');
        if (fx) {
          await page.locator('.tt-opt-outline .switch').click();
          await page.waitForSelector('.tt-shape.is-ready', { timeout: 300000 });
          check(`es totem ${tag}: vanilla outline status in Spanish`, /Ajustado al tótem vanilla de Java 26\.3/.test(await page.textContent('.tt-shape')));
          await inspect(page, `es-totem-3-outline-${tag}`, 'es');
        }
        await page.click('.tt-edit-btn');
        await page.waitForSelector('.tt-ed-modal .pc-canvas');
        check(`es totem ${tag}: pixel editor in Spanish`, /Editar los píxeles del tótem/.test(await page.textContent('.tt-ed-modal')));
        await inspect(page, `es-totem-4-editor-${tag}`, 'es');
        await page.click('.tt-ed-modal .modal-footer .btn-secondary');
        await page.waitForSelector('.tt-ed-modal', { state: 'detached' });
        check(`es totem ${tag}: no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
        await page.close();
      }
      // ---------------------------------------------------------- Russian converter, merger and totem maker
      if (LANGS.includes('ru')) {
        const c = await openPage(ctx, 'ru/texture-pack-converter/', '.cv-dz');
        check(`ru converter ${tag}: page is Russian`, (await c.page.getAttribute('html', 'lang')) === LANG.ru && (await c.page.textContent('.cv-step h2')).trim() === 'Выбери пак', (await c.page.textContent('.cv-step h2')).trim());
        await inspect(c.page, `ru-convert-1-start-${tag}`, 'ru');
        await c.page.setInputFiles('.cv-dz input[type=file]', files.legacy);
        await c.page.waitForSelector('.cv-pack:not([hidden]) .cv-pack-name');
        check(`ru converter ${tag}: pack summary in Russian (plural form for 4)`, /4 текстуры/.test(await c.page.textContent('.cv-pack-info')), (await c.page.textContent('.cv-pack-info')).trim());
        await c.page.click('.cv-ed[data-value="java"]');
        await c.page.waitForFunction(() => /Текстуры, переименованные между Java/.test(document.querySelector('.cv-hint')?.textContent ?? ''));
        await c.page.$$eval('.cv-pack details', (ds) => ds.forEach((d) => (d.open = true)));
        await inspect(c.page, `ru-convert-2-pack-${tag}`, 'ru');
        await c.page.click('.cv-version .vp-trigger');
        await c.page.waitForSelector('.vp-pop .vp-item, .vp-pop .vp-status', { timeout: 60000 });
        check(`ru converter ${tag}: version search in Russian`, (await c.page.getAttribute('.vp-pop input[type=search]', 'placeholder')) === 'Поиск версий, напр. 1.20');
        await inspect(c.page, `ru-convert-3-versions-${tag}`, 'ru');
        await c.page.keyboard.press('Escape');
        await c.page.click('.cv-ed[data-value="bedrock"]');
        await inspect(c.page, `ru-convert-4-bedrock-${tag}`, 'ru');
        if (fx) {
          await c.page.click('.cv-ed[data-value="java"]');
          await c.page.click('.cv-go');
          await c.page.waitForSelector('.cv-result .cv-dl-btn, .cv-result .cv-res-icon.is-error', { timeout: 300000 });
          const head = (await c.page.textContent('.cv-res-titles h2')).trim();
          check(`ru converter ${tag}: report headline in Russian`, /Конвертировано \d+ из 4 текстур|Все текстуры конвертированы: 4/.test(head), head);
          await c.page.$$eval('.cv-result details', (ds) => ds.forEach((d) => (d.open = true)));
          await inspect(c.page, `ru-convert-5-report-${tag}`, 'ru');
        }
        check(`ru converter ${tag}: no console errors`, c.errors.length === 0, c.errors.slice(0, 3).join(' | '));
        await c.page.close();

        const l = await openPage(ctx, 'ru/texture-pack-converter/', '.cv-dz');
        await l.page.setInputFiles('.cv-dz input[type=file]', files.loose);
        await l.page.waitForSelector('.cv-pack:not([hidden]) .cv-pack-name');
        await l.page.$$eval('.cv-pack details', (ds) => ds.forEach((d) => (d.open = true)));
        check(`ru converter ${tag}: loose PNG notes in Russian`, /изображение не совпало/.test(await l.page.textContent('.cv-pack')), (await l.page.textContent('.cv-pack')).trim().slice(0, 160));
        await inspect(l.page, `ru-convert-6-loose-${tag}`, 'ru');
        check(`ru converter loose ${tag}: no console errors`, l.errors.length === 0, l.errors.slice(0, 3).join(' | '));
        await l.page.close();

        const m = await openPage(ctx, 'ru/merge-texture-packs/', '.mg-dz');
        await inspect(m.page, `ru-merge-1-start-${tag}`, 'ru');
        await m.page.setInputFiles('.mg-dz input[type=file]', [files.modern, files.modern2, files.legacy]);
        await m.page.waitForFunction(() => document.querySelectorAll('.mg-list .mg-row').length === 3 && !document.querySelector('.mg-dz.is-busy'), null, { timeout: 60000 });
        check(`ru merge ${tag}: merge button counts in Russian`, /Объединить 3 пака/.test(await m.page.textContent('.mg-go')), (await m.page.textContent('.mg-go')).trim());
        await inspect(m.page, `ru-merge-2-packs-${tag}`, 'ru');
        await m.page.click('.mg-go');
        await m.page.waitForSelector('.mg-result .mg-dl-btn, .mg-result .cv-res-icon.is-error', { timeout: 120000 });
        const head = (await m.page.textContent('.mg-result h2')).trim();
        check(`ru merge ${tag}: report in Russian`, /3 пака объединены в «/.test(head), head);
        await m.page.$$eval('.mg-result details', (ds) => ds.forEach((d) => (d.open = true)));
        await inspect(m.page, `ru-merge-3-report-${tag}`, 'ru');
        check(`ru merge ${tag}: no console errors`, m.errors.length === 0, m.errors.slice(0, 3).join(' | '));
        await m.page.close();

        const x = await openPage(ctx, 'ru/merge-texture-packs/', '.mg-dz');
        await x.page.setInputFiles('.mg-dz input[type=file]', [files.modern, files.bedrock]);
        await x.page.waitForSelector('.mg-hint.is-alert a');
        const hint = await x.page.textContent('.mg-hint');
        check(`ru merge ${tag}: mixed editions explained in Russian, with the converter link`, /нельзя объединить/.test(hint) && (await x.page.textContent('.mg-hint a')) === 'Конвертер текстурпаков', hint.trim().slice(0, 160));
        await inspect(x.page, `ru-merge-4-mixed-${tag}`, 'ru');
        check(`ru merge mixed ${tag}: no console errors`, x.errors.length === 0, x.errors.slice(0, 3).join(' | '));
        await x.page.close();

        const { page, errors } = await openPage(ctx, 'ru/totem-maker/', '.tt-tabs');
        check(`ru totem ${tag}: page is Russian`, (await page.getAttribute('html', 'lang')) === LANG.ru && /Выбери скин/.test(await page.textContent('.tt-step h2, .cv-step h2')));
        await inspect(page, `ru-totem-1-start-${tag}`, 'ru');
        await page.click('.tt-tab[data-source="upload"]');
        await page.setInputFiles('.tt-dz input[type=file]', files.skin);
        await page.waitForSelector('.tt-chosen:not([hidden]) .tt-chosen-name');
        await page.waitForSelector('.tt-big-canvas');
        check(`ru totem ${tag}: style names kept, descriptions in Russian`, /Classic/.test(await page.textContent('.tt-styles')) && /руки раскинуты/.test(await page.textContent('.tt-styles')));
        await inspect(page, `ru-totem-2-skin-${tag}`, 'ru');
        if (fx) {
          await page.locator('.tt-opt-outline .switch').click();
          await page.waitForSelector('.tt-shape.is-ready', { timeout: 300000 });
          check(`ru totem ${tag}: vanilla outline status in Russian`, /Подогнано под ванильный тотем Java 26\.3/.test(await page.textContent('.tt-shape')));
          await inspect(page, `ru-totem-3-outline-${tag}`, 'ru');
        }
        check(`ru totem ${tag}: edit button in Russian`, (await page.textContent('.tt-edit-btn')).trim() === 'Править пиксели', (await page.textContent('.tt-edit-btn')).trim());
        await page.click('.tt-edit-btn');
        await page.waitForSelector('.tt-ed-modal .pc-canvas');
        check(`ru totem ${tag}: pixel editor in Russian`, /Пиксели тотема/.test(await page.textContent('.tt-ed-modal')));
        await inspect(page, `ru-totem-4-editor-${tag}`, 'ru');
        await page.click('.tt-ed-modal .modal-footer .btn-secondary');
        await page.waitForSelector('.tt-ed-modal', { state: 'detached' });
        check(`ru totem ${tag}: no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
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
