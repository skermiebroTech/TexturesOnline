// The translated skin editor and skin pack maker in Chromium: German (an HD template skin: start
// screen, painting, hover names, parts menu, 3D painting, export menu, the Java HD dialog, Reduce to
// 64×64, the shortcut list), Japanese (a starter skin, the export menu and the skin pack maker),
// Spanish (/skin-pack-maker: a pack of two skins and its ready dialog), Portuguese (saved skins,
// the default skins dialog, the old Java export) and Russian (all of it: the editor, every export
// dialog, the skin pack maker and the start screen's saved skins, lookup and default skins), and in
// every language the cape maker (/cape-maker) and the pose maker's three tabs and saved picture. Every state is checked for English left in the
// visible text and labels, content wider than the screen or clipped labels, and console errors, at
// 1280 and 390 px (the editor also at 360 px) in the dark and the light theme.
//
// Usage: NODE_PATH=$(npm root -g) TO_FIXTURES=<dir> node tests/e2e/i18n/skins.e2e.mjs [baseUrl] [--shots <dir>] [--langs de,ru]
// Without TO_FIXTURES the default skins step (Java 26.3 game files) is skipped; the rest needs no
// network. Skin services are blocked: nothing reaches the real player lookup.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { startVite, launch, routeMojang, fixturesDir } = require('../textures/lib.cjs');

const argv = process.argv.slice(2);
const baseArg = argv.find((a) => /^https?:/.test(a));
const shotsDir = argv.includes('--shots') ? argv[argv.indexOf('--shots') + 1] : null;
/** --only 390-dark: run one width and theme (while fixing something) */
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
/** --langs de,ru: run some languages only */
const LANGS = (argv.includes('--langs') ? argv[argv.indexOf('--langs') + 1] : 'de,ja,es,pt-br,ru').split(',');
if (shotsDir) mkdirSync(shotsDir, { recursive: true });

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
}

// ------------------------------------------------------------------ checks run in the page
/** Visible text and labels of the page's main content, open dialogs, popovers and tooltips. */
function collectTexts() {
  const root = document.querySelector('main') ?? document.body;
  const visible = (el) => {
    if (!el.getClientRects().length) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  const skip = (el) => !!el.closest('code, kbd, script, style, .site-footer, .tool-intro, .sr-only-skip');
  const out = [];
  const walk = (scope) => {
    const w = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const el = n.parentElement;
      const text = n.textContent.replace(/\s+/g, ' ').trim();
      if (!text || !el || skip(el)) continue;
      if (!visible(el) && !el.closest('.sr-only')) continue;
      out.push(text);
    }
  };
  walk(root);
  const labelled = [...root.querySelectorAll('[aria-label], [title], [placeholder]'), ...document.querySelectorAll('dialog[open] [aria-label], dialog[open] [title], .popover [aria-label], .popover [placeholder], [role=tooltip], .toast')];
  for (const el of labelled) {
    if (skip(el) || !visible(el)) continue;
    for (const a of ['aria-label', 'title', 'placeholder']) {
      const v = el.getAttribute(a);
      if (v && v.trim()) out.push(v.trim());
    }
  }
  for (const d of document.querySelectorAll('dialog[open], .popover, [role=tooltip], .toast')) walk(d);
  return [...new Set(out)];
}

/** Content wider than the screen, page side-scrolling, and labels that are cut off or spill out. */
function layoutIssues() {
  const issues = [];
  const vw = document.documentElement.clientWidth;
  if (document.documentElement.scrollWidth > vw + 1) issues.push(`page scrolls sideways (${document.documentElement.scrollWidth} > ${vw})`);
  const clipped = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (/auto|scroll|hidden|clip/.test(cs.overflowX)) return true;
    }
    return false;
  };
  const describe = (el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${(el.textContent ?? '').trim().slice(0, 60)}"`;
  const roots = [document.querySelector('main') ?? document.body, ...document.querySelectorAll('dialog[open], .popover')];
  for (const root of roots) {
    for (const el of root.querySelectorAll('*')) {
      if (el.closest('.site-footer, svg, canvas, .tool-intro')) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.display === 'inline' || cs.position === 'fixed') continue;
      const r = el.getBoundingClientRect();
      if (r.width <= 1 || r.height <= 1 || el.closest('.sr-only')) continue;
      // Editor panels that slide off screen on phones sit in a clipping container.
      if ((r.right > vw + 1 || r.left < -1) && !clipped(el)) issues.push(`outside the screen: ${describe(el)} (${Math.round(r.left)}–${Math.round(r.right)} of ${vw})`);
      const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      // The status line under the canvas ends in an ellipsis by design (long hover names, tips).
      if (!ownText || el.classList.contains('truncate') || el.classList.contains('sk-status-text')) continue;
      // Off-screen panels are not what the user sees.
      if (r.right < 0 || r.left > vw) continue;
      if (el.scrollWidth > el.clientWidth + 1 && cs.overflowX !== 'auto' && cs.overflowX !== 'scroll') issues.push(`${cs.textOverflow === 'ellipsis' ? 'cut off' : 'spills out'}: ${describe(el)} (${el.scrollWidth} > ${el.clientWidth})`);
      // Text running past the box that clips it (a menu item cut at its edge, a segmented
      // button's label hidden under its neighbour).
      // (The canvas toolbar scrolls sideways by design.)
      if (!el.closest('.sk-canvas-bar')) {
        for (let p = el.parentElement; p && p !== root.parentElement; p = p.parentElement) {
          const ps = getComputedStyle(p);
          if (ps.overflowX === 'visible') continue;
          // Its content box: text over the padding looks cut too.
          const b = p.getBoundingClientRect();
          const pr = { left: b.left + parseFloat(ps.borderLeftWidth) + parseFloat(ps.paddingLeft), right: b.right - parseFloat(ps.borderRightWidth) - parseFloat(ps.paddingRight) };
          if (r.right > pr.right + 1 || r.left < pr.left - 1) issues.push(`cut by its container: ${describe(el)} (${Math.round(r.left)}–${Math.round(r.right)} in ${Math.round(pr.left)}–${Math.round(pr.right)})`);
          break;
        }
      }
    }
  }
  return [...new Set(issues)];
}

// ------------------------------------------------------------------ English detection
/** Names and words every language keeps, key names, and the test's own skin names. */
const KEEP = [
  'Texture Pack Maker', 'Minecraft Launcher', 'Minecraft: Java Edition', 'Minecraft', 'Java Edition', 'Bedrock Edition', 'Java', 'Bedrock', 'Mojang', 'CustomSkinLoader',
  'Steve', 'Alex', 'Notch', 'jeb_', 'Dinnerbone', 'Ninja', 'HD', 'PNG', 'MB', 'px', 'WebGL', 'Ctrl', 'Shift', 'Alt', 'Esc', 'Enter', 'Home', 'Space', 'Creeper',
  // Skins saved on earlier pages of the run keep their names (German, Portuguese, Spanish, the test's) everywhere.
  'Mein Skin', 'Minha skin', 'Mi skin', 'Kubik',
];
const ENGLISH = /(?<!\p{L})(the|and|your|with|you|to|of|is|are|this|that|from|can|it|its|were|has|have|not|or|on|by|be|will|skin pack|choose|drop|download|upload|cancel|loading|saving|getting|starting|open|change|remove|keep|pick|try|add|click|browse|edit|undo|redo|paint|mirror|layer|outer|base layer|arms|front|back|show|hide|reset|size|brush|colour|tool|tools|done|saved)(?!\p{L})/iu;

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
/** Headings of the cape maker and the pose maker in each language. */
const CAPE_POSE = {
  de: { cape: 'Mach deinen eigenen Minecraft-Umhang', pose: 'Posen-Editor' },
  es: { cape: 'Haz tu propia capa de Minecraft', pose: 'Creador de poses' },
  'pt-br': { cape: 'Faça a sua própria capa de Minecraft', pose: 'Criador de poses' },
  ja: { cape: 'Minecraftのマントを自分で作ろう', pose: 'ポーズメーカー' },
  ru: { cape: 'Создай свой плащ для Minecraft', pose: 'Редактор поз' },
};

const server = baseArg ? null : await startVite();
const base = (baseArg || server.url).replace(/\/?$/, '/');
const fx = fixturesDir();
console.log(`base ${base} · fixtures ${fx ?? '(none: the default skins step is skipped)'}`);
const browser = await launch();

async function inspect(page, label, locale, opts = {}) {
  await page.waitForTimeout(opts.wait ?? 150);
  const texts = await page.evaluate(collectTexts);
  const left = english(texts, locale);
  check(`${label}: no English left`, left.length === 0, left.slice(0, 6).map((t) => `"${t.slice(0, 90)}"`).join(' · '));
  const layout = await page.evaluate(layoutIssues);
  check(`${label}: nothing overflows`, layout.length === 0, layout.slice(0, 6).join(' · '));
  if (shotsDir) {
    const path = join(shotsDir, `${label.replace(/[^\w.-]+/g, '-')}.png`);
    const dialog = await page.$('dialog[open], .popover');
    if (opts.full && !dialog) {
      // The tool itself (not the introduction and footer below it).
      const bottom = await page.evaluate(() => {
        const el = document.querySelector('.sk-start');
        return el ? Math.ceil(el.getBoundingClientRect().bottom + window.scrollY + 16) : 0;
      });
      const width = page.viewportSize().width;
      await page.screenshot({ path, fullPage: true, ...(bottom ? { clip: { x: 0, y: 0, width, height: bottom } } : {}) });
    } else await page.screenshot({ path });
  }
}

async function openPage(ctx, path, ready) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|Failed to load resource|ERR_FAILED|net::/.test(m.text())) errors.push(m.text());
  });
  await page.goto(base + path);
  await page.waitForSelector(ready, { timeout: 60000 });
  return { page, errors };
}

/** Waits for the editor and starts on the 2D template (the editor remembers the last view). */
async function waitEditor(page) {
  await page.waitForSelector('.sk-editor .pc-root', { state: 'attached', timeout: 30000 });
  await page.waitForFunction(() => !!document.querySelector('.sk-editor')?.__skinEditor);
  if ((await page.getAttribute('.sk-workspace [data-value="2d"]', 'aria-checked')) !== 'true') await page.click('.sk-workspace [data-value="2d"]');
  await page.waitForTimeout(500);
}

const api = (page, fn, arg) =>
  page.evaluate(([f, a]) => {
    const e = document.querySelector('.sk-editor').__skinEditor;
    return new Function('e', 'a', `return (${f})(e, a)`)(e, a);
  }, [fn.toString(), arg]);

async function closeLayers(page) {
  for (let i = 0; i < 4; i++) {
    if (!(await page.$('dialog[open], .popover'))) break;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }
}

/** On phones the editor shows one panel at a time (bottom tabs). */
async function showPanel(page, phone, panel) {
  if (!phone) return;
  await page.click(`.editor-tab[data-panel="${panel}"]`);
  await page.waitForTimeout(400);
}

async function hoverPixel(page, x, y) {
  const [cx, cy] = await api(page, (e, [x, y]) => e.imageToClient(x, y), [x, y]);
  await page.mouse.move(cx, cy);
  await page.waitForTimeout(200);
}

try {
  const runs = [];
  for (const width of [1280, 390]) for (const theme of ['dark', 'light']) runs.push({ width, theme, full: true });
  for (const theme of ['dark', 'light']) runs.push({ width: 360, theme, full: false });
  for (const { width, theme, full } of runs) {
    const tag = `${width}-${theme}`;
    if (only && only !== tag) continue;
    const phone = width < 600;
    const ctx = await browser.newContext({ viewport: { width, height: phone ? 780 : 860 }, colorScheme: theme, deviceScaleFactor: 1, acceptDownloads: true, hasTouch: phone });
    await ctx.addInitScript((t) => {
      try {
        localStorage.setItem('to-theme', t);
      } catch {
        /* private mode */
      }
    }, theme);
    await ctx.route(/playerdb\.co|textures\.minecraft\.net|mc-heads\.net/, (route) => route.abort());
    await routeMojang(ctx, fx);

    // ---------------------------------------------------------- German: HD template skin, the whole editor
    if (LANGS.includes('de')) {
      const { page, errors } = await openPage(ctx, 'de/skins/', '.sk-starter-template');
      check(`de skins ${tag}: page is German`, (await page.getAttribute('html', 'lang')) === LANG.de && /Gestalte deinen eigenen Skin/.test(await page.textContent('.sk-hero h1')));
      if (full) await inspect(page, `de-skins-1-start-${tag}`, 'de', { full: true });
      await page.click('.sk-model-pick .segmented-item[data-value="128"]');
      check(`de skins ${tag}: HD note in German`, /HD-Skin, nur Bedrock/.test(await page.textContent('.sk-size-note')));
      if (full) await inspect(page, `de-skins-2-hd-${tag}`, 'de');
      await page.click('.sk-starter-template');
      await waitEditor(page);
      check(`de skins ${tag}: the editor stays in German`, /^\/de\/skins\/[\w-]+\/?$/.test(await page.evaluate(() => location.pathname)), await page.evaluate(() => location.pathname));
      check(`de skins ${tag}: HD skin`, (await api(page, (e) => e.size())) === 128);
      // Paint, then hover the head's front face.
      await page.keyboard.press('b');
      const [px, py] = await api(page, (e) => e.imageToClient(90, 44));
      await page.mouse.click(px, py);
      await hoverPixel(page, 18, 20);
      const tip = (await page.textContent('.sk-status-text')) ?? '';
      check(`de skins ${tag}: hover names part, face and layer in German`, /Kopf · Vorne · Grundebene/.test(tip), tip);
      await inspect(page, `de-skins-3-editor-${tag}`, 'de');
      // Parts list and a part's menu.
      await showPanel(page, phone, 'left');
      await page.click('.sk-part[data-part="rightArm"] .sk-part-actions button:last-child');
      await page.waitForSelector('.popover [role="menuitem"]');
      const menu = await page.textContent('.popover');
      check(`de skins ${tag}: part menu in German`, /Den rechten Arm einfärben/.test(menu) && /Auf den linken Arm kopieren/.test(menu), menu.slice(0, 160));
      await inspect(page, `de-skins-4-parts-${tag}`, 'de');
      await closeLayers(page);
      // Painting on the 3D model.
      await showPanel(page, phone, 'center');
      await page.click('.sk-workspace [data-value="3d"]');
      await page.waitForTimeout(400);
      await page.click('.sk-3d-mode [data-value="paint"]');
      await page.waitForTimeout(700);
      check(`de skins ${tag}: 3D paint mode`, (await api(page, (e) => e.paint3d())) === true);
      await inspect(page, `de-skins-5-paint3d-${tag}`, 'de', { wait: 400 });
      // The size control and the Reduce to 64×64 dialog (in the side panel).
      await showPanel(page, phone, 'right');
      await page.click('.sk-size-seg [data-value="64"]');
      await page.waitForSelector('dialog[open] .sk-export-compare');
      check(`de skins ${tag}: reduce dialog in German`, /Auf 64×64 verkleinern/.test(await page.textContent('dialog[open]')));
      await inspect(page, `de-skins-6-reduce-${tag}`, 'de', { wait: 400 });
      await page.click('dialog[open] .modal-footer .btn-ghost');
      await page.waitForSelector('dialog[open]', { state: 'detached' }).catch(() => undefined);
      await showPanel(page, phone, 'center');
      // Export menu and the Java HD dialog.
      await page.click('.sk-export-btn');
      await page.waitForSelector('.sk-export-item[data-kind="java"]');
      check(`de skins ${tag}: export menu in German`, /Bedrock-Skinpaket \(\.mcpack\)/.test(await page.textContent('.sk-export-menu')));
      await inspect(page, `de-skins-7-export-menu-${tag}`, 'de');
      await page.click('.sk-export-item[data-kind="java"]');
      await page.waitForSelector('.sk-java-hd-note');
      const hdDialog = await page.textContent('dialog[open]');
      check(`de skins ${tag}: Java HD dialog in German`, /128×128 für Mods/.test(hdDialog) && /64×64 herunterladen/.test(hdDialog), hdDialog.slice(0, 120));
      await inspect(page, `de-skins-8-java-hd-${tag}`, 'de', { wait: 400 });
      const [dl] = await Promise.all([page.waitForEvent('download'), page.click('dialog[open] .modal-footer .btn-primary')]);
      check(`de skins ${tag}: Java download keeps the file name`, /\.png$/.test(dl.suggestedFilename()), dl.suggestedFilename());
      await page.waitForSelector('dialog[open] .sk-export-done');
      check(`de skins ${tag}: ready dialog in German`, /Dein Java-Skin ist fertig/.test(await page.textContent('dialog[open]')));
      await inspect(page, `de-skins-9-java-ready-${tag}`, 'de', { wait: 400 });
      await closeLayers(page);
      // The keyboard shortcut list (desktop only: phones have no keyboard button in view).
      if (!phone) {
        await page.keyboard.press('?');
        await page.waitForSelector('dialog[open] .shortcuts');
        await inspect(page, `de-skins-10-shortcuts-${tag}`, 'de');
        await closeLayers(page);
      }
      check(`de skins ${tag}: no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
      await page.close();
    }

    // ---------------------------------------------------------- Japanese: starter skin and the skin pack maker
    if (LANGS.includes('ja')) {
      const { page, errors } = await openPage(ctx, 'ja/skins/', '.sk-starter-explorer');
      check(`ja skins ${tag}: page is Japanese`, (await page.getAttribute('html', 'lang')) === LANG.ja && /スキン/.test(await page.textContent('.sk-hero h1')));
      await page.click('.sk-model-pick .segmented-item[data-value="64"]');
      if (full) await inspect(page, `ja-skins-1-start-${tag}`, 'ja', { full: true });
      await page.click('.sk-starter-explorer');
      await waitEditor(page);
      await hoverPixel(page, 44, 22);
      check(`ja skins ${tag}: hover in Japanese`, /右腕 · 前 · ベースレイヤー/.test((await page.textContent('.sk-status-text')) ?? ''), await page.textContent('.sk-status-text'));
      await inspect(page, `ja-skins-2-editor-${tag}`, 'ja');
      await showPanel(page, phone, 'right');
      await inspect(page, `ja-skins-3-preview-${tag}`, 'ja', { wait: 600 });
      await showPanel(page, phone, 'center');
      await page.click('.sk-export-btn');
      await page.waitForSelector('.sk-export-item[data-kind="bedrock-pack"]');
      await inspect(page, `ja-skins-4-export-menu-${tag}`, 'ja');
      await page.click('.sk-export-item[data-kind="bedrock-pack"]');
      await page.waitForSelector('dialog[open] .sk-pack-list .sk-pack-skin:not(.is-current)').catch(async (err) => {
        if (shotsDir) await page.screenshot({ path: join(shotsDir, `ja-skins-5-pack-${tag}-failed.png`) });
        throw err;
      });
      check(`ja skins ${tag}: pack maker in Japanese`, /スキンパックを作る/.test(await page.textContent('dialog[open]')));
      await inspect(page, `ja-skins-5-pack-${tag}`, 'ja', { wait: 400 });
      await closeLayers(page);
      check(`ja skins ${tag}: no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
      await page.close();
    }

    // ---------------------------------------------------------- Spanish: the skin pack maker page
    if (LANGS.includes('es')) {
      const { page, errors } = await openPage(ctx, 'es/skin-pack-maker/', '.sk-starter-knight');
      check(`es pack maker ${tag}: page is Spanish`, (await page.getAttribute('html', 'lang')) === LANG.es && /Diseña tu propia skin/.test(await page.textContent('.sk-hero h1')));
      if (full) await inspect(page, `es-pack-1-start-${tag}`, 'es', { full: true });
      await page.click('.sk-starter-knight');
      await waitEditor(page);
      await page.fill('.sk-name', 'Kachel');
      await api(page, (e) => e.flush());
      await page.click('.sk-export-btn');
      await page.click('.sk-export-item[data-kind="bedrock-pack"]');
      await page.waitForSelector('dialog[open] .sk-pack-skin:not(.is-current)');
      await page.check('dialog[open] .sk-pack-skin:not(.is-current) input');
      check(`es pack maker ${tag}: count in Spanish`, /^\d+ skins$/.test((await page.textContent('.sk-pack-count')).trim()), await page.textContent('.sk-pack-count'));
      await inspect(page, `es-pack-2-choose-${tag}`, 'es', { wait: 400 });
      const [dl] = await Promise.all([page.waitForEvent('download'), page.click('dialog[open] .modal-footer .btn-primary')]);
      check(`es pack maker ${tag}: downloads a .mcpack`, /\.mcpack$/.test(dl.suggestedFilename()), dl.suggestedFilename());
      await page.waitForSelector('dialog[open] .sk-export-done');
      const ready = await page.textContent('dialog[open]');
      check(`es pack maker ${tag}: ready dialog in Spanish`, /Tu pack de skins de Bedrock está listo/.test(ready) && /Vestidor/.test(ready) && /Equipar/.test(ready), ready.slice(0, 160));
      await inspect(page, `es-pack-3-ready-${tag}`, 'es', { wait: 400 });
      await closeLayers(page);
      check(`es pack maker ${tag}: no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
      await page.close();
    }

    // ---------------------------------------------------------- Portuguese: saved skins, defaults, old Java
    if (LANGS.includes('pt-br')) {
      const { page, errors } = await openPage(ctx, 'pt-br/skins/', '.sk-recent-grid .sk-recent');
      check(`pt-br skins ${tag}: page is Portuguese`, (await page.getAttribute('html', 'lang')) === LANG['pt-br'] && /Crie sua própria skin/.test(await page.textContent('.sk-hero h1')));
      await page.click('.sk-recent-menu');
      await page.waitForSelector('.popover [role="menuitem"]');
      check(`pt-br skins ${tag}: saved skin menu in Portuguese`, /Renomear/.test(await page.textContent('.popover')));
      if (full) await inspect(page, `pt-br-skins-1-saved-${tag}`, 'pt-br');
      await closeLayers(page);
      // Username lookup: the services are blocked here, so the error explains it.
      await page.fill('#sk-username', 'Notch');
      await page.click('.sk-user-row .btn-primary');
      await page.waitForSelector('.sk-field-error:not([hidden])', { timeout: 30000 });
      if (full) await inspect(page, `pt-br-skins-2-lookup-${tag}`, 'pt-br');
      if (fx) {
        await page.click('.sk-game-actions .btn');
        await page.waitForSelector('dialog[open] .sk-default', { timeout: 300000 });
        check(`pt-br skins ${tag}: default skins in Portuguese`, /Skins padrão do Minecraft/.test(await page.textContent('dialog[open]')));
        await inspect(page, `pt-br-skins-3-defaults-${tag}`, 'pt-br', { wait: 600 });
        await closeLayers(page);
      }
      await page.click('.sk-starter-blank');
      await waitEditor(page);
      check(`pt-br skins ${tag}: new skin named in Portuguese`, (await page.inputValue('.sk-name')) === 'Minha skin');
      await page.click('.sk-export-btn');
      await page.click('.sk-export-item[data-kind="java-legacy"]');
      await page.waitForSelector('dialog[open] .sk-export-compare');
      check(`pt-br skins ${tag}: old Java dialog in Portuguese`, /Exportar para versões antigas do Java/.test(await page.textContent('dialog[open]')));
      await inspect(page, `pt-br-skins-4-legacy-${tag}`, 'pt-br', { wait: 400 });
      await closeLayers(page);
      check(`pt-br skins ${tag}: no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
      await page.close();
    }
    // ---------------------------------------------------------- Russian: the whole editor, the exports and the pack maker
    if (LANGS.includes('ru')) {
      const { page, errors } = await openPage(ctx, 'ru/skins/', '.sk-starter-template');
      check(`ru skins ${tag}: page is Russian`, (await page.getAttribute('html', 'lang')) === LANG.ru && /Создай свой скин/.test(await page.textContent('.sk-hero h1')));
      // A second saved skin first, so the skin pack maker has something to choose from.
      await page.click('.sk-starter-ninja');
      await waitEditor(page);
      await api(page, (e) => e.flush());
      await page.goto(`${base}ru/skins/`);
      await page.waitForSelector('.sk-starter-template');
      if (full) await inspect(page, `ru-skins-1-start-${tag}`, 'ru', { full: true });
      await page.click('.sk-model-pick .segmented-item[data-value="128"]');
      check(`ru skins ${tag}: HD note in Russian`, /HD-скин, только для Bedrock/.test(await page.textContent('.sk-size-note')));
      if (full) await inspect(page, `ru-skins-2-hd-${tag}`, 'ru');
      await page.click('.sk-starter-template');
      await waitEditor(page);
      check(`ru skins ${tag}: the editor stays in Russian`, /^\/ru\/skins\/[\w-]+\/?$/.test(await page.evaluate(() => location.pathname)), await page.evaluate(() => location.pathname));
      // A Latin name: headless Chromium without a UTF-8 locale saves other file names as "download".
      await page.fill('.sk-name', 'Kubik');
      await page.locator('.sk-name').press('Enter');
      await page.evaluate(() => document.activeElement?.blur());
      await api(page, (e) => e.flush());
      await page.keyboard.press('b');
      const [px, py] = await api(page, (e) => e.imageToClient(90, 44));
      await page.mouse.click(px, py);
      await hoverPixel(page, 18, 20);
      const tip = (await page.textContent('.sk-status-text')) ?? '';
      check(`ru skins ${tag}: hover names part, face and layer in Russian`, /Голова · Спереди · Основа/.test(tip), tip);
      await inspect(page, `ru-skins-3-editor-${tag}`, 'ru');
      await showPanel(page, phone, 'left');
      await inspect(page, `ru-skins-4-left-${tag}`, 'ru');
      await page.click('.sk-part[data-part="rightArm"] .sk-part-actions button:last-child');
      await page.waitForSelector('.popover [role="menuitem"]');
      const menu = await page.textContent('.popover');
      check(`ru skins ${tag}: part menu in Russian`, /Залить: правая рука/.test(menu) && /Копировать на: левая рука/.test(menu), menu.slice(0, 160));
      await inspect(page, `ru-skins-5-parts-${tag}`, 'ru');
      await closeLayers(page);
      await showPanel(page, phone, 'center');
      await page.click('.sk-workspace [data-value="3d"]');
      await page.waitForTimeout(400);
      await page.click('.sk-3d-mode [data-value="paint"]');
      await page.waitForTimeout(700);
      await inspect(page, `ru-skins-6-paint3d-${tag}`, 'ru', { wait: 400 });
      await page.click('.sk-workspace [data-value="2d"]');
      await showPanel(page, phone, 'right');
      await inspect(page, `ru-skins-7-preview-${tag}`, 'ru', { wait: 400 });
      await page.click('.sk-size-seg [data-value="64"]');
      await page.waitForSelector('dialog[open] .sk-export-compare');
      check(`ru skins ${tag}: reduce dialog in Russian`, /Уменьшить до 64×64/.test(await page.textContent('dialog[open]')));
      await inspect(page, `ru-skins-8-reduce-${tag}`, 'ru', { wait: 400 });
      await page.click('dialog[open] .modal-footer .btn-ghost');
      await page.waitForSelector('dialog[open]', { state: 'detached' }).catch(() => undefined);
      await showPanel(page, phone, 'center');
      await page.click('.sk-export-btn');
      await page.waitForSelector('.sk-export-item[data-kind="java"]');
      const exportMenu = await page.textContent('.sk-export-menu');
      check(`ru skins ${tag}: export menu in Russian`, /Набор скинов Bedrock \(\.mcpack\)/.test(exportMenu) && /Скин Bedrock \(\.png\)/.test(exportMenu) && /Старый скин Java \(64×32\)/.test(exportMenu), exportMenu.slice(0, 160));
      await inspect(page, `ru-skins-9-export-menu-${tag}`, 'ru');
      await page.click('.sk-export-item[data-kind="java"]');
      await page.waitForSelector('.sk-java-hd-note');
      const hdDialog = await page.textContent('dialog[open]');
      check(`ru skins ${tag}: Java HD dialog in Russian`, /128×128 для модов/.test(hdDialog) && /Скачать 64×64/.test(hdDialog), hdDialog.slice(0, 120));
      await inspect(page, `ru-skins-10-java-hd-${tag}`, 'ru', { wait: 400 });
      const [dl] = await Promise.all([page.waitForEvent('download'), page.click('dialog[open] .modal-footer .btn-primary')]);
      check(`ru skins ${tag}: Java download keeps the file name`, /\.png$/.test(dl.suggestedFilename()), dl.suggestedFilename());
      await page.waitForSelector('dialog[open] .sk-export-done');
      check(`ru skins ${tag}: ready dialog in Russian`, /Твой скин Java готов/.test(await page.textContent('dialog[open]')));
      await inspect(page, `ru-skins-11-java-ready-${tag}`, 'ru', { wait: 400 });
      await closeLayers(page);
      // Bedrock .png and its Dressing Room steps
      await page.click('.sk-export-btn');
      await page.waitForSelector('.sk-export-item[data-kind="bedrock-png"]');
      await page.click('.sk-export-item[data-kind="bedrock-png"]');
      await page.waitForSelector('dialog[open] .sk-export-done', { timeout: 30000 }).catch(() => undefined);
      if (await page.$('dialog[open]')) {
        await inspect(page, `ru-skins-12-bedrock-png-${tag}`, 'ru', { wait: 400 });
        await closeLayers(page);
      }
      // The skin pack maker with this skin and another saved one, and its ready dialog
      await page.click('.sk-export-btn');
      await page.waitForSelector('.sk-export-item[data-kind="bedrock-pack"]');
      await page.click('.sk-export-item[data-kind="bedrock-pack"]');
      await page.waitForSelector('dialog[open] .sk-pack-list .sk-pack-skin:not(.is-current)');
      const other = await page.$('dialog[open] .sk-pack-skin:not(.is-current) input');
      if (other) await other.check();
      check(`ru skins ${tag}: pack maker in Russian`, /Набор скинов/.test(await page.textContent('dialog[open]')) && /Скачать набор/.test(await page.textContent('dialog[open] .modal-footer')));
      await inspect(page, `ru-skins-13-pack-${tag}`, 'ru', { wait: 400 });
      const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('dialog[open] .modal-footer .btn-primary')]);
      check(`ru skins ${tag}: downloads a .mcpack`, /\.mcpack$/.test(dl2.suggestedFilename()), dl2.suggestedFilename());
      await page.waitForSelector('dialog[open] .sk-export-done');
      const ready = await page.textContent('dialog[open]');
      check(`ru skins ${tag}: pack ready dialog in Russian`, /Гардеробная/.test(ready) && /Надеть/.test(ready), ready.slice(0, 160));
      await inspect(page, `ru-skins-14-pack-ready-${tag}`, 'ru', { wait: 400 });
      await closeLayers(page);
      // The old Java export
      await page.click('.sk-export-btn');
      await page.waitForSelector('.sk-export-item[data-kind="java-legacy"]');
      await page.click('.sk-export-item[data-kind="java-legacy"]');
      await page.waitForSelector('dialog[open] .sk-export-compare');
      check(`ru skins ${tag}: old Java dialog in Russian`, /Экспорт для старых версий Java/.test(await page.textContent('dialog[open]')));
      await inspect(page, `ru-skins-15-legacy-${tag}`, 'ru', { wait: 400 });
      await closeLayers(page);
      if (!phone) {
        await page.keyboard.press('?');
        await page.waitForSelector('dialog[open] .shortcuts');
        await inspect(page, `ru-skins-16-shortcuts-${tag}`, 'ru');
        await closeLayers(page);
      }
      // Back on the start screen: saved skins, the username lookup and the default skins
      await page.goto(`${base}ru/skins/`);
      await page.waitForSelector('.sk-recent-grid .sk-recent');
      await page.click('.sk-recent-menu');
      await page.waitForSelector('.popover [role="menuitem"]');
      check(`ru skins ${tag}: saved skin menu in Russian`, /Переименовать/.test(await page.textContent('.popover')));
      if (full) await inspect(page, `ru-skins-17-saved-${tag}`, 'ru');
      await closeLayers(page);
      await page.fill('#sk-username', 'Notch');
      await page.click('.sk-user-row .btn-primary');
      await page.waitForSelector('.sk-field-error:not([hidden])', { timeout: 30000 });
      if (full) await inspect(page, `ru-skins-18-lookup-${tag}`, 'ru');
      if (fx) {
        await page.click('.sk-game-actions .btn');
        await page.waitForSelector('dialog[open] .sk-default', { timeout: 300000 });
        check(`ru skins ${tag}: default skins in Russian`, /Стандартные скины Minecraft/.test(await page.textContent('dialog[open]')));
        await inspect(page, `ru-skins-19-defaults-${tag}`, 'ru', { wait: 600 });
        await closeLayers(page);
      }
      check(`ru skins ${tag}: no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
      await page.close();
    }
    // ---------------------------------------------------------- every language: the cape maker and the pose maker
    if (full) {
      for (const l of LANGS) {
        const want = CAPE_POSE[l];
        const { page, errors } = await openPage(ctx, `${l}/cape-maker/`, '.cm .pc-root');
        await page.waitForFunction(() => document.querySelector('.cm')?.__capeMaker?.ready(), null, { timeout: 30000 });
        check(`${l} cape ${tag}: page in its language`, (await page.getAttribute('html', 'lang')) === LANG[l] && (await page.textContent('.cm-hero h1')).trim() === want.cape, await page.textContent('.cm-hero h1'));
        await inspect(page, `${l}-cape-1-editor-${tag}`, l, { wait: 600 });
        await page.click('.cm-design[data-design="stars"]');
        await page.click('.cm-3d-top [data-value="elytra"]');
        await page.waitForSelector('.toast');
        await inspect(page, `${l}-cape-2-design-${tag}`, l, { wait: 300 });
        await page.locator('.cm-download').scrollIntoViewIfNeeded();
        await page.click('.cm-pack-fields [data-value="bedrock"]');
        await inspect(page, `${l}-cape-3-download-${tag}`, l, { wait: 300 });
        await page.locator('.cm-where').scrollIntoViewIfNeeded();
        await inspect(page, `${l}-cape-4-where-${tag}`, l, { wait: 200 });
        const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.cm-pack-btn')]);
        // (Headless Chromium without a UTF-8 locale names non-ASCII downloads "download": check the bytes.)
        check(`${l} cape ${tag}: Bedrock elytra pack downloads`, readFileSync(await dl.path()).subarray(0, 2).toString('latin1') === 'PK', dl.suggestedFilename());
        // The pose maker of the skin editor, wearing that cape.
        await page.goto(`${base}${l}/skins/`);
        await page.waitForSelector('.sk-starter-knight');
        await page.click('.sk-starter-knight');
        await waitEditor(page);
        await showPanel(page, phone, 'right');
        await page.click('.sk-pose-open');
        await page.waitForSelector('dialog[open] .sk-pose-view canvas', { timeout: 30000 });
        check(`${l} pose ${tag}: dialog in its language`, (await page.textContent('dialog[open] .modal-title, dialog[open] h2')).trim() === want.pose, await page.textContent('dialog[open] h2'));
        for (const tab of ['poses', 'adjust', 'scene']) {
          await page.click(`.sk-pose-tabs [data-value="${tab}"]`);
          if (tab === 'poses') await page.click('.sk-pose-preset[data-pose="flying"]');
          if (tab === 'adjust') await page.click('.sk-pose-parts [data-part="leftArm"]');
          if (tab === 'scene') await page.click('.sk-pose-bg[data-id="transparent"]');
          await inspect(page, `${l}-pose-${tab}-${tag}`, l, { wait: 400 });
        }
        const [pic] = await Promise.all([page.waitForEvent('download'), page.click('.sk-pose-save')]);
        check(`${l} pose ${tag}: Save picture downloads a PNG`, readFileSync(await pic.path()).subarray(1, 4).toString('latin1') === 'PNG', pic.suggestedFilename());
        const saved = (await page.textContent('.toast')).replace(/\s+/g, ' ').trim();
        check(`${l} pose ${tag}: saved toast in its language`, english([saved], l).length === 0 && saved.includes(`-pose.png`), saved);
        check(`${l} cape and pose ${tag}: no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
        await page.close();
      }
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
