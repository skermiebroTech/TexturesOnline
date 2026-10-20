// The translated Shader Maker in Chromium: the start screen, the "New pack" dialog, the editor of
// each target (Iris / OptiFine, vanilla Java, Bedrock Vibrant Visuals) with presets and settings
// changed, the preview textures menu, the keyboard help and the export dialog, plus the pack editor
// of an opened Iris pack, in German, Japanese, Spanish and Portuguese. Every state is checked for
// English left in the visible text and labels, for content wider than the screen or clipped labels,
// and for console errors, at 1280 and 390 px wide in the dark and the light theme.
//
// Usage: NODE_PATH=$(npm root -g) TO_FIXTURES=<dir> node tests/e2e/i18n/shaders.e2e.mjs [baseUrl] [--shots <dir>] [--quick]
// Without a baseUrl the app is built into a temp folder and served with `vite preview` (a dev server
// reloads the page when it first optimizes a dependency). Without TO_FIXTURES the vanilla export and
// the game textures come from Mojang's servers.
// --quick runs one combination (1280 px, dark) only; --combo 390-light,390-dark picks combinations.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { ROOT, launch, routeMojang, fixturesDir } = require('../textures/lib.cjs');

const argv = process.argv.slice(2);
const baseArg = argv.find((a) => /^https?:/.test(a));
const shotsDir = argv.includes('--shots') ? argv[argv.indexOf('--shots') + 1] : null;
const quick = argv.includes('--quick');
const only = argv.includes('--combo') ? argv[argv.indexOf('--combo') + 1].split(',') : null;
if (shotsDir) mkdirSync(shotsDir, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'i18n-shaders-'));

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
}

// ------------------------------------------------------------------ test pack (original, made here)
/** A small Iris shader pack whose own option names are not English (they are the pack's text, shown as they are). */
function makeIrisPack() {
  const { zipSync } = require(join(ROOT, 'node_modules/fflate'));
  const enc = (s) => new TextEncoder().encode(s);
  const zip = zipSync({
    'shaders/shaders.properties': enc('screen=SOMBRA BRILLO NIEBLA [AGUA]\nscreen.AGUA=OLAS\nsliders=BRILLO OLAS\nprofile.BAJO=SOMBRA=0 !NIEBLA\nprofile.ALTO=SOMBRA=2 NIEBLA\n'),
    'shaders/lib/settings.glsl': enc('#define SOMBRA 1 // [0 1 2]\n#define BRILLO 0.5 // [0.0 0.5 1.0]\n//#define NIEBLA\n#define OLAS 2 // [1 2 3 4]\n'),
    'shaders/final.fsh': enc('#version 120\n#include "/lib/settings.glsl"\nvoid main() {\n#ifdef NIEBLA\n  gl_FragColor = vec4(BRILLO);\n#else\n  gl_FragColor = vec4(float(SOMBRA + OLAS));\n#endif\n}\n'),
    'shaders/final.vsh': enc('#version 120\nvoid main() { gl_Position = ftransform(); }\n'),
    'shaders/lang/en_us.lang': enc('screen.AGUA=Agua\noption.SOMBRA=Sombra\nvalue.SOMBRA.0=Baja\nvalue.SOMBRA.1=Media\nvalue.SOMBRA.2=Alta\noption.BRILLO=Brillo\noption.NIEBLA=Niebla\noption.OLAS=Olas\nprofile.BAJO=Bajo\nprofile.ALTO=Alto\n'),
  });
  const file = join(tmp, 'Sombras.zip');
  writeFileSync(file, zip);
  return file;
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
  // code, file names and the pack's own option names are shown as they are
  const skip = (el) => !!el.closest('code, kbd, script, style, textarea, .site-footer, .pe-gutter, .pe-file-name, .pe-code-path, .pe-pack-file, .sh-export-file-name, .pe-opt-label, .pe-screen-title, .pe-opt-value, .pe-change-name, .pe-change-values, .pe-profile, .sh-title, .pe-pack-name, .sh-recent-name, .sh-tex-sub');
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
  const labelled = [...root.querySelectorAll('[aria-label], [title], [placeholder], [data-tooltip]'), ...document.querySelectorAll('dialog[open] [aria-label], .popover [aria-label], .popover [placeholder], [role=tooltip]')];
  for (const el of labelled) {
    if (skip(el) || !visible(el)) continue;
    for (const a of ['aria-label', 'title', 'placeholder', 'data-tooltip']) {
      const v = el.getAttribute(a);
      if (v && v.trim()) out.push(v.trim());
    }
  }
  for (const d of document.querySelectorAll('dialog[open], .popover, .toast')) {
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
      if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return true;
    }
    return false;
  };
  const describe = (el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${(el.textContent ?? '').trim().slice(0, 60)}"`;
  const roots = [document.querySelector('main') ?? document.body, ...document.querySelectorAll('dialog[open], .popover')];
  for (const root of roots) {
    for (const el of root.querySelectorAll('*')) {
      if (el.closest('.site-footer, svg, canvas, textarea, .pe-code-text')) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.display === 'inline' || cs.position === 'fixed') continue;
      const r = el.getBoundingClientRect();
      // Screen-reader-only text sits in a 1px box on purpose.
      if (r.width <= 1 || r.height <= 1 || el.closest('.sr-only')) continue;
      if ((r.right > vw + 1 || r.left < -1) && !scroller(el)) issues.push(`outside the screen: ${describe(el)} (${Math.round(r.left)}–${Math.round(r.right)} of ${vw})`);
      const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!ownText || el.classList.contains('truncate')) continue;
      // the version picker's secondary line ("Pack 97.1") is made to give way with an ellipsis
      if (el.classList.contains('vp-sub')) continue;
      if (el.scrollWidth > el.clientWidth + 1 && cs.overflowX !== 'auto' && cs.overflowX !== 'scroll') issues.push(`${cs.textOverflow === 'ellipsis' ? 'cut off' : 'spills out'}: ${describe(el)} (${el.scrollWidth} > ${el.clientWidth})`);
    }
  }
  return [...new Set(issues)];
}

// ------------------------------------------------------------------ English detection
/** Names and words every language keeps, and the test files' own names. */
const KEEP = [
  'Texture Pack Maker', 'Shader Maker', 'Texture Packs', 'Texture Pack', 'Minecraft Launcher', 'Minecraft', 'Java Edition', 'Bedrock Edition', 'Java', 'Bedrock', 'OptiFine', 'Iris', 'Sodium',
  'Fabric', 'Vibrant Visuals', 'Vulkan', 'OpenGL', 'GLSL', 'JSON', 'ACES', 'Reinhard luminance', 'Reinhard luma', 'Reinhard', 'Hable', 'Mojang', 'GitHub', 'Sombras', 'Sombra', 'Brillo', 'Niebla', 'Agua',
  'Olas', 'Bajo', 'Alto', 'OK', 'PNG', 'GPU', 'UUID', 'EV', 'HD', 'MB', 'KB', 'GB', 'Ctrl', 'Shift', 'Alt', 'Esc', 'Enter', 'Home', 'Arrows', 'Tab', 'Mod', 'Low',
];
const ENGLISH = /(?<!\p{L})(the|and|your|with|you|to|of|is|are|this|that|from|can|it|its|were|has|have|not|or|on|by|be|will|choose|drop|download|upload|cancel|loading|reading|saving|getting|starting|open|change|remove|keep|pick|try|add|click|browse|edit|undo|redo|shadows|preview|settings|fog|water|night|sky|light|lighting)(?!\p{L})/iu;

function english(texts, locale) {
  const found = [];
  for (const text of texts) {
    let s = text;
    for (const k of KEEP) s = s.split(k).join(' ');
    s = s.replace(/\S*[./_\\0-9:#×]\S*/g, ' ');
    const words = s.match(/[A-Za-z]{2,}/g) ?? [];
    if (locale === 'ja' ? words.length >= 2 && !/[぀-ヿ一-鿿]/.test(text) : ENGLISH.test(s)) found.push(text);
  }
  return found;
}

// ------------------------------------------------------------------ run
const LANG = { de: 'de', es: 'es', 'pt-br': 'pt-BR', ja: 'ja' };
/** A word of each language's start screen, to see the translation arrived. */
const START = { de: 'Starten', es: 'Empezar', 'pt-br': 'Começar', ja: '始める' };
const PLAN = {
  iris: { slider: { key: 'sunStrength', value: '2.35' }, toggle: 'cloudShadows', preset: 'noir' },
  'java-vanilla': { slider: { key: 'contrast', value: '1.37' }, toggle: 'bloom', preset: 'cinematic' },
  'bedrock-vibrant': { slider: { key: 'saturation', value: '1.8' }, toggle: 'waves', preset: 'cinematic' },
};
const TARGETS = Object.keys(PLAN);
const LOCALES = ['de', 'ja', 'es', 'pt-br'];

/** Builds the app and serves it like the shader harness does (tests/harness/shaders-view/serve.sh). */
async function startPreview() {
  const port = 5900 + Math.floor(Math.random() * 90);
  const out = mkdtempSync(join(tmpdir(), 'i18n-shaders-dist-'));
  const proc = spawn(join(ROOT, 'tests/harness/shaders-view/serve.sh'), [out, String(port)], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('preview server did not start')), 300000);
    proc.stdout.on('data', (d) => {
      if (/Local:/.test(String(d))) {
        clearTimeout(t);
        resolve();
      }
    });
    proc.on('exit', (c) => reject(new Error(`preview server exited ${c}`)));
  });
  return {
    url: `http://127.0.0.1:${port}/`,
    stop() {
      try {
        process.kill(-proc.pid, 'SIGTERM');
      } catch {
        proc.kill();
      }
    },
  };
}

const irisPack = makeIrisPack();
const server = baseArg ? null : await startPreview();
const base = (baseArg || server.url).replace(/\/?$/, '/');
const fx = fixturesDir();
console.log(`base ${base} · fixtures ${fx ?? '(none: game files come from Mojang)'}`);
const browser = await launch();

async function inspect(page, label, locale) {
  await page.waitForTimeout(150);
  const texts = await page.evaluate(collectTexts);
  const left = english(texts, locale);
  check(`${label}: no English left`, left.length === 0, left.slice(0, 6).map((t) => `"${t.slice(0, 90)}"`).join(' · '));
  const layout = await page.evaluate(layoutIssues);
  check(`${label}: nothing overflows`, layout.length === 0, layout.slice(0, 6).join(' · '));
  if (shotsDir) {
    const dialog = await page.$('dialog[open]');
    await page.screenshot({ path: join(shotsDir, `${label.replace(/[^\w.-]+/g, '-')}.png`), fullPage: !dialog && label.includes('start') });
  }
}

async function openPage(ctx, path, ready) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|Failed to load resource|net::ERR/.test(m.text())) errors.push(m.text());
  });
  await page.goto(base + path);
  await page.waitForSelector(ready, { timeout: 90000 });
  return { page, errors };
}

/** At phone width the editor shows one panel at a time: checks each one. */
async function inspectPanels(page, label, locale, width) {
  if (width > 1180) return inspect(page, label, locale);
  for (const p of ['left', 'center', 'right']) {
    const tab = page.locator(`.editor-tab[data-panel="${p}"]`);
    if (!(await tab.count()) || !(await tab.isVisible())) continue;
    await tab.click();
    await inspect(page, `${label}-${p}`, locale);
  }
  const center = page.locator('.editor-tab[data-panel="center"]');
  if ((await center.count()) && (await center.isVisible())) await center.click();
}

async function closeDialog(page) {
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('dialog[open]'), null, { timeout: 10000 }).catch(() => undefined);
}

async function shaderTarget(page, locale, target, tag, width) {
  const plan = PLAN[target];
  const id = `${locale}-${target}-${tag}`;
  await page.click(`.sh-card[data-target="${target}"] .sh-card-start`);
  await page.waitForSelector('.sh-new .sh-preset', { timeout: 60000 });
  await inspect(page, `${id}-1-new`, locale);
  await page.click('dialog[open] .modal-footer .btn-primary');
  // at phone width the editor opens on the preview, so the settings exist but are not shown
  await page.waitForSelector('.sh-editor .sh-option', { state: 'attached', timeout: 90000 });
  await page.waitForSelector('.sh-stage-host canvas', { timeout: 90000 });
  await page.waitForTimeout(2500);

  // a preset, a slider and a switch
  if (width <= 1180) await page.click('.editor-tab[data-panel="left"]');
  await page.click(`.sh-settings .sh-preset[data-preset="${plan.preset}"]`);
  const num = page.locator(`[data-option="${plan.slider.key}"] input[type="number"]`);
  await num.scrollIntoViewIfNeeded();
  await num.fill(plan.slider.value);
  await num.press('Enter');
  const sw = page.locator(`[data-option="${plan.toggle}"] .switch`);
  await sw.scrollIntoViewIfNeeded();
  if (await sw.isEnabled()) await sw.click();
  const custom = (await page.textContent('.sh-custom-note')) ?? '';
  check(`${id}: custom look note translated`, custom.trim().length > 0 && !/Custom look/.test(custom), custom.trim());
  await page.locator('.sh-settings-body').evaluate((el) => el.scrollTo(0, 0));
  await inspectPanels(page, `${id}-2-editor`, locale, width);

  // all groups open, help text shown
  if (width <= 1180) await page.click('.editor-tab[data-panel="left"]');
  await page.$$eval('.sh-settings details.sh-group', (ds) => ds.forEach((d) => (d.open = true)));
  await inspect(page, `${id}-3-settings`, locale);

  // preview textures menu
  if (width <= 1180) await page.click('.editor-tab[data-panel="center"]');
  await page.click('.sh-tex-btn');
  await page.waitForSelector('.sh-tex-menu');
  await inspect(page, `${id}-4-textures`, locale);
  await page.keyboard.press('Escape');

  // keyboard help
  await page.locator('.sh-stage-host').click({ position: { x: 5, y: 5 } }).catch(() => undefined);
  await page.keyboard.press('?');
  await page.waitForSelector('dialog[open]');
  await inspect(page, `${id}-5-keys`, locale);
  await closeDialog(page);

  // export
  await page.click('.sh-bar-export');
  await page.waitForSelector('.sh-export-head.is-success, .sh-export-head.is-error', { timeout: 240000 });
  const ok = await page.$('.sh-export-head.is-success');
  check(`${id}: export succeeds`, !!ok, ok ? '' : (await page.textContent('.sh-export-head')).trim());
  await inspect(page, `${id}-6-export`, locale);
  await closeDialog(page);
}

async function packEditor(page, locale, tag) {
  const id = `${locale}-packedit-${tag}`;
  await page.setInputFiles('.pe-open-drop input[type=file]', irisPack);
  await page.waitForSelector('.pe-editor .pe-opt, .pe-editor .pe-empty', { timeout: 60000 });
  await page.$$eval('.pe-options details', (ds) => ds.forEach((d) => (d.open = true)));
  const bool = page.locator('.pe-opt.is-bool .switch').first();
  if (await bool.count()) await bool.click();
  await page.waitForTimeout(300);
  await inspect(page, `${id}-1-options`, locale);
  await page.click('.pe-tabs [data-value="files"], .pe-tabs button:nth-child(2)');
  await page.waitForSelector('.pe-files .pe-file', { state: 'attached' });
  await page.fill('.pe-tree-panel input[type=search]', 'settings');
  await page.click('.pe-files.is-flat .pe-file');
  await page.waitForSelector('.pe-code-text:not([hidden])');
  await inspect(page, `${id}-2-files`, locale);
  await page.click('.sh-bar-export');
  await page.waitForSelector('.pe-export-summary');
  await inspect(page, `${id}-3-export`, locale);
  await closeDialog(page);
}

try {
  const combos = quick ? [[1280, 'dark']] : [[1280, 'dark'], [390, 'light'], [1280, 'light'], [390, 'dark']];
  for (const [ci, [width, theme]] of combos.entries()) {
    const tag = `${width}-${theme}`;
    if (only && !only.includes(tag)) continue;
    const ctx = await browser.newContext({ viewport: { width, height: width > 600 ? 860 : 800 }, colorScheme: theme, deviceScaleFactor: 1 });
    await ctx.addInitScript((t) => {
      try {
        localStorage.setItem('to-theme', t);
      } catch {
        /* private mode */
      }
    }, theme);
    await routeMojang(ctx, fx);
    for (const [li, locale] of LOCALES.entries()) {
      // the first two combinations go through every target; the others through one each, in turn
      const targets = ci < 2 ? TARGETS : [TARGETS[(li + ci) % TARGETS.length]];
      const { page, errors } = await openPage(ctx, `${locale}/shaders/`, '.sh-card');
      check(`${locale} start ${tag}: page language`, (await page.getAttribute('html', 'lang')) === LANG[locale]);
      check(`${locale} start ${tag}: start screen translated`, (await page.textContent('.sh-card-start')).trim() === START[locale], (await page.textContent('.sh-card-start')).trim());
      await inspect(page, `${locale}-start-${tag}`, locale);
      for (const target of targets) {
        try {
          await shaderTarget(page, locale, target, tag, width);
        } catch (err) {
          check(`${locale} ${target} ${tag}: runs`, false, String(err).slice(0, 300));
          if (shotsDir) await page.screenshot({ path: join(shotsDir, `FAIL-${locale}-${target}-${tag}.png`) }).catch(() => undefined);
        }
        await page.goto(`${base}${locale}/shaders/`);
        await page.waitForSelector('.sh-card');
      }
      await page.waitForSelector('.sh-recent:not([hidden]) .sh-recent-card').catch(() => undefined);
      await inspect(page, `${locale}-start-recent-${tag}`, locale);
      if (ci < 2 || li === ci) {
        try {
          await packEditor(page, locale, tag);
        } catch (err) {
          check(`${locale} pack editor ${tag}: runs`, false, String(err).slice(0, 300));
          if (shotsDir) await page.screenshot({ path: join(shotsDir, `FAIL-${locale}-packedit-${tag}.png`) }).catch(() => undefined);
        }
      }
      check(`${locale} ${tag}: no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
      await page.close();
    }
    await ctx.close();
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
