// Custom font maker at /font-maker: start from a built-in style, a font file (turned into pixels,
// or kept as a TrueType provider for Java 1.13+), an existing pack or the game's own font; draw
// each character on its pixel grid; check it in chat, on a sign, in a book, on the title screen and
// in a tooltip; download a Java .zip or Bedrock .mcpack, or add the font to a texture pack project.
// Shares the converter's page layout and card styles (cv-*); own classes are fm-.

import '../convert/convert.css';
import './fonts.css';
import type { AssetIndex, Edition, Progress, TexturePackProject } from '../../core/types';
import type { RouteContext } from '../../core/router';
import { href as routeHref, navigate } from '../../core/router';
import { h, formatBytes, timeAgo, uid } from '../../ui/dom';
import { icon, type IconName } from '../../ui/icons';
import { badge, button, iconButton, progressBar, segmented, setButtonBusy, slider, textInput, toggle } from '../../ui/components';
import { dropzone } from '../../ui/dropzone';
import { toast } from '../../ui/toast';
import { confirmDialog, openModal } from '../../ui/modal';
import { versionPicker } from '../../ui/version-picker';
import { listProjects, saveProject } from '../../core/storage';
import { saveBlob } from '../../core/download';
import { friendlyError, isAbortError } from '../../core/net';
import { DEFAULT_JAVA_VERSION, loadAssets } from '../../editions/versions';
import { siteFooter } from '../../app/footer';
import { kit } from '../../ui/i18n/kit';
import { fmt, fmtNodes } from '../../i18n/editor-text';
import { t } from './i18n/text';
import { loadFontsText } from './i18n/load';
import {
  GLYPH_SIZES,
  GROUPS,
  GROUP_IDS,
  bedrockPages,
  cellH,
  cloneFont,
  cpLabel,
  emptyMask,
  fromDraft,
  flipMask,
  glyphAdvance,
  glyphsFor,
  groupOf,
  isDrawable,
  javaFontSupport,
  newFont,
  resizeFont,
  setGlyph,
  shiftMask,
  spaceFor,
  targetCovers,
  toDraft,
  ttfUsed,
  type FontDoc,
  type FontTarget,
  type GlyphSize,
  type GroupId,
  type Mask,
} from './font';
import { STARTER_STYLES, starterFont, starterGlyph, type StarterStyle } from './starter';
import { glyphCanvas, glyphThumb, type DrawTool } from './editor';
import { SCENES, makeScene, missingChars, textStrip, type PreviewFont, type SceneId, type SceneText } from './render';
import { fitSize, fontHasChar, loadFontFace, rasterGlyph, type RasterOptions } from './raster';
import { readFontFile, type FontFileInfo } from './sfnt';
import { readDraft, writeDraft } from './draft';
import { projectsText } from '../../shared/i18n/projects';
import { registerOpener, takePending } from '../../shared/project-file/handoff';
import { openProjectButton, saveProjectFile } from '../../shared/project-file/entry';
import type { ProjectItem } from '../../shared/project-file/format';

// The importer (zip reader) and the pack builder (zip writer, PNG encoder) load when they are used.
const importer = () => import('./import');
const packBuilder = () => import('./pack');

type Source = 'starter' | 'file' | 'pack' | 'game';
type StyleChoice = StarterStyle | 'blank';

const SOURCES: { id: Source; label: () => string; icon: IconName }[] = [
  { id: 'starter', label: () => t.start.starter, icon: 'text-start-a' },
  { id: 'file', label: () => t.start.file, icon: 'file-text' },
  { id: 'pack', label: () => t.start.pack, icon: 'package' },
  { id: 'game', label: () => t.start.game, icon: 'box' },
];

const SCENE_ICONS: Record<SceneId, IconName> = { chat: 'message-text', sign: 'road-sign', book: 'book-open', title: 'monitor', tooltip: 'card-text' };
const DEVICE_FONTS = ['sans-serif', 'serif', 'monospace'] as const;
type DeviceFont = (typeof DEVICE_FONTS)[number];

const charText = (cp: number) => String.fromCodePoint(cp);

interface LoadedFont {
  family: string;
  name: string;
  info: FontFileInfo | null;
  /** Characters of the tool's groups the font has */
  chars: number[];
}

export default async function view(root: HTMLElement, ctx: RouteContext): Promise<() => void> {
  await loadFontsText(ctx.locale);
  root.classList.add('fonts-view');
  let alive = true;
  const ctrl = new AbortController();

  const restored = readDraft();
  let doc: FontDoc = restored && restored.glyphs.size ? restored : starterFont('classic', 8);
  let docName = restored && restored.glyphs.size ? t.start.current : t.start.styleNames.classic;
  let selected = 0x41;
  let group: GroupId = 'basic';
  let tool: DrawTool = 'pencil';
  let edition: Edition = 'java';
  let javaVersion = DEFAULT_JAVA_VERSION;
  let packName = t.pack.defaultName;
  let scene: SceneId = 'chat';
  let sample = t.preview.sampleDefault;
  let ttfFamily: string | null = null;
  let loaded: LoadedFont | null = null;
  let clip: Mask | null = null;
  const undoStack: FontDoc[] = [];
  const redoStack: FontDoc[] = [];
  const bedrock: { uuids?: { header: string; module: string }; packVersion?: [number, number, number] } = {};

  const live = h('p', { class: 'sr-only', 'aria-live': 'polite' });
  const announce = (text: string) => {
    live.textContent = '';
    requestAnimationFrame(() => (live.textContent = text));
  };

  let draftTimer = 0;
  function changed(opts: { list?: boolean } = {}) {
    clearTimeout(draftTimer);
    draftTimer = window.setTimeout(() => writeDraft(doc), 600);
    paintEditor();
    if (opts.list !== false) paintList();
    paintGroups();
    paintChosen();
    paintPreview();
    paintExport();
    clearInstall();
  }

  /** The font has edits of the user's since it was last replaced (replacing it then asks first). */
  let dirty = !!(restored && restored.glyphs.size);
  function remember(edit = true) {
    if (edit) dirty = true;
    undoStack.push(cloneFont(doc));
    if (undoStack.length > 100) undoStack.shift();
    redoStack.length = 0;
  }

  /** Replaces the whole font (undoable). */
  function replaceDoc(next: FontDoc, name: string) {
    remember(false);
    dirty = false;
    doc = next;
    docName = name;
    void ensureTtfFace();
    changed();
  }

  // ---------------------------------------------------------------- step 1: start from
  const tabIds = Object.fromEntries(SOURCES.map((s) => [s.id, uid('fm-tab')])) as Record<Source, string>;
  const panelIds = Object.fromEntries(SOURCES.map((s) => [s.id, uid('fm-panel')])) as Record<Source, string>;
  let source: Source = 'starter';
  const tabs = SOURCES.map((s) => {
    const b = h('button', { type: 'button', class: 'fm-tab', role: 'tab', id: tabIds[s.id], 'aria-controls': panelIds[s.id], dataset: { source: s.id } }, icon(s.icon), h('span', null, s.label()));
    b.addEventListener('click', () => showSource(s.id));
    b.addEventListener('keydown', (ev) => {
      const i = SOURCES.findIndex((x) => x.id === s.id);
      const d = ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1 : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -1 : 0;
      if (!d) return;
      ev.preventDefault();
      const next = SOURCES[(i + d + SOURCES.length) % SOURCES.length].id;
      showSource(next);
      tabs.find((tab) => tab.dataset.source === next)?.focus();
    });
    return b;
  });
  const tabList = h('div', { class: 'fm-tabs', role: 'tablist', 'aria-label': t.start.sources }, tabs);

  // Starter styles
  const styleChoices: StyleChoice[] = [...STARTER_STYLES, 'blank'];
  const styleCards = styleChoices.map((s) => {
    const thumb = h('span', { class: 'fm-style-sample' });
    const font = s === 'blank' ? null : starterFont(s, 8);
    if (font) thumb.appendChild(textStrip(previewOf(font, null), 'Aa Bb Жж', { shadow: true }));
    else thumb.appendChild(h('span', { class: 'fm-blank-grid', 'aria-hidden': 'true' }));
    const b = h(
      'button',
      { type: 'button', class: 'cv-ed fm-style', dataset: { style: s } },
      thumb,
      h('span', { class: 'cv-ed-text' }, h('strong', null, t.start.styleNames[s]), h('span', { class: 'faint small' }, t.start.styleText[s])),
    );
    b.addEventListener('click', () => void chooseStyle(s));
    return b;
  });
  const starterPanel = h('div', { class: 'fm-styles', role: 'list', 'aria-label': t.start.styles }, styleCards.map((c) => h('div', { role: 'listitem' }, c)));

  async function confirmReplace(): Promise<boolean> {
    if (!dirty || (!doc.glyphs.size && !doc.ttf)) return true;
    return confirmDialog(t.start.replaceTitle, t.start.replaceText, t.start.replace);
  }

  async function chooseStyle(s: StyleChoice) {
    if (!(await confirmReplace()) || !alive) return;
    const next = s === 'blank' ? newFont(doc.size) : starterFont(s, doc.size);
    next.space = doc.space;
    replaceDoc(next, t.start.styleNames[s]);
    announce(fmt(t.start.started, { name: t.start.styleNames[s], count: next.glyphs.size }));
  }

  // Font file / device font
  const fontDz = dropzone({ accept: '.ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2', label: t.start.drop, hint: t.start.dropHint, icon: 'upload', onFiles: ([f]) => void openFontFile(f) });
  fontDz.classList.add('fm-dz', 'fm-font-dz');
  const deviceRow = h(
    'div',
    { class: 'fm-device' },
    h('span', { class: 'faint small' }, t.start.orDevice),
    h(
      'div',
      { class: 'fm-chips' },
      DEVICE_FONTS.map((f) => {
        const b = h('button', { type: 'button', class: 'fm-chip', dataset: { device: f }, style: { fontFamily: f } }, t.start.device[f]);
        b.addEventListener('click', () => void useDeviceFont(f));
        return b;
      }),
    ),
  );
  const fontInfo = h('div', { class: 'fm-font-info', hidden: true });
  const rasterOpts: RasterOptions = { px: 10, threshold: 128, offsetY: 0 };
  let onlyEmpty = false;
  const sizeSlider = slider({ label: t.start.pixelSize, min: 4, max: 96, step: 1, value: rasterOpts.px, unit: 'px', description: t.start.pixelSizeHint, onInput: (v) => ((rasterOpts.px = v), paintRasterSample()) });
  const thresholdSlider = slider({ label: t.start.threshold, min: 1, max: 254, step: 1, value: rasterOpts.threshold, description: t.start.thresholdHint, onInput: (v) => ((rasterOpts.threshold = v), paintRasterSample()) });
  const baselineSlider = slider({ label: t.start.baseline, min: -12, max: 12, step: 1, value: 0, unit: 'px', description: t.start.baselineHint, onInput: (v) => ((rasterOpts.offsetY = v), paintRasterSample()) });
  sizeSlider.classList.add('fm-raster-size');
  thresholdSlider.classList.add('fm-raster-threshold');
  const onlyEmptyToggle = toggle({ label: t.start.onlyEmpty, description: t.start.onlyEmptyHint, value: false, onChange: (v) => (onlyEmpty = v) });
  const rasterSample = h('div', { class: 'fm-raster-sample checker-dark' });
  const applyBtn = button({ label: t.start.apply, icon: 'magic-edit', variant: 'primary', class: 'fm-apply', onClick: () => applyRaster() });
  const embedBox = h('div', { class: 'fm-embed' });
  const rasterPanel = h(
    'div',
    { class: 'fm-raster', hidden: true },
    rasterSample,
    h('div', { class: 'fm-sliders' }, sizeSlider, thresholdSlider, baselineSlider),
    onlyEmptyToggle,
    h('div', { class: 'cv-actions' }, applyBtn),
    embedBox,
  );
  const filePanel = h('div', { class: 'fm-file' }, fontDz, deviceRow, fontInfo, rasterPanel);

  /** Characters of the tool's groups (and anything already in the font) a font has. */
  function charsOf(family: string, info: FontFileInfo | null): number[] {
    const all = new Set<number>([...GROUP_IDS.filter((g) => g !== 'other').flatMap((g) => GROUPS[g as Exclude<GroupId, 'other'>]), ...doc.glyphs.keys()]);
    if (info?.chars) return [...all].filter((cp) => info.chars!.has(cp));
    return [...all].filter((cp) => fontHasChar(family, cp));
  }

  async function openFontFile(file: File | undefined) {
    if (!file) return;
    fontDz.setError(null);
    fontDz.classList.add('is-busy');
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      let info: FontFileInfo | null = null;
      try {
        info = readFontFile(bytes);
      } catch {
        info = null;
      }
      if (info && (info.format === 'unknown' || info.format === 'collection')) throw new Error('not a font');
      const family = await loadFontFace(bytes);
      if (!alive) return;
      const name = info?.name || file.name.replace(/\.(ttf|otf|woff2?)$/i, '');
      setLoaded({ family, name, info, chars: charsOf(family, info) }, file.name);
    } catch {
      fontDz.setError(t.start.notFont);
    } finally {
      fontDz.classList.remove('is-busy');
    }
  }

  function useDeviceFont(f: DeviceFont) {
    setLoaded({ family: f, name: fmt(t.start.deviceName, { name: t.start.device[f] }), info: null, chars: charsOf(f, null) }, null);
  }

  let loadedFile: string | null = null;
  function setLoaded(f: LoadedFont, fileName: string | null) {
    loaded = f;
    loadedFile = fileName;
    rasterOpts.px = fitSize(f.family, doc.size);
    sizeSlider.setValue(rasterOpts.px);
    fontInfo.hidden = false;
    fontInfo.replaceChildren(
      icon('check', { size: 16 }),
      h('span', null, f.chars.length ? fmt(t.start.loaded, { name: f.name, count: f.chars.length }) : fmt(t.start.loadedNoCount, { name: f.name })),
    );
    rasterPanel.hidden = false;
    paintRasterSample();
    paintEmbed();
  }

  function paintRasterSample() {
    if (!loaded) return;
    const fam = loaded.family;
    const text = 'AaBbGgJj 0123 ÄéÑ ЖжЯя あア';
    const glyphs = new Map<number, Mask>();
    for (const ch of text) {
      const cp = ch.codePointAt(0)!;
      if (cp === 0x20 || !loaded.chars.includes(cp)) continue;
      const m = rasterGlyph(fam, cp, doc.size, rasterOpts);
      if (m) glyphs.set(cp, m);
    }
    const font: PreviewFont = { size: doc.size, glyphs, space: 4, ttf: null };
    rasterSample.replaceChildren(textStrip(font, [...text].filter((c) => c === ' ' || glyphs.has(c.codePointAt(0)!)).join(''), { shadow: true }));
  }

  function applyRaster() {
    if (!loaded) return;
    const next = cloneFont(doc);
    let n = 0;
    for (const cp of loaded.chars) {
      if (onlyEmpty && next.glyphs.has(cp)) continue;
      const m = rasterGlyph(loaded.family, cp, doc.size, rasterOpts);
      if (!m) continue;
      next.glyphs.set(cp, m);
      n++;
    }
    if (!n) {
      toast(t.start.appliedNone, { tone: 'info' });
      return;
    }
    replaceDoc(next, loaded.name);
    const msg = fmt(t.start.applied, { count: n, name: loaded.name });
    toast(msg, { tone: 'success' });
    announce(msg);
  }

  function paintEmbed() {
    embedBox.replaceChildren();
    if (!loaded || !loaded.info) return;
    const info = loaded.info;
    if (!info.truetype) {
      embedBox.appendChild(h('p', { class: 'fm-note' }, icon('circle-info', { size: 16 }), h('span', null, t.start.embedOnlyTtf)));
      return;
    }
    const on = !!doc.ttf && doc.ttf.bytes === info.truetype;
    const emb = toggle({
      label: t.start.embed,
      description: t.start.embedHint,
      value: on,
      onChange: (v) => {
        remember();
        doc.ttf = v ? { bytes: info.truetype!, file: (loadedFile ?? 'font.ttf').replace(/\.woff$/i, '.ttf'), size: 9, oversample: 4, shift: [0, 1], chars: info.chars ?? new Set() } : null;
        void ensureTtfFace();
        changed({ list: false });
        paintEmbed();
      },
    });
    emb.classList.add('fm-embed-toggle');
    embedBox.appendChild(emb);
    if (on && doc.ttf) embedBox.appendChild(ttfSettings());
  }

  function ttfSettings(): HTMLElement {
    const ttf = doc.ttf!;
    const set = (k: 'size' | 'oversample' | 'shift', v: number) => {
      if (!doc.ttf) return;
      if (k === 'shift') doc.ttf.shift = [doc.ttf.shift[0], v];
      else doc.ttf[k] = v;
      changed({ list: false });
    };
    return h(
      'div',
      { class: 'fm-sliders' },
      slider({ label: t.start.ttfSize, min: 4, max: 24, step: 0.5, value: ttf.size, unit: 'px', onInput: (v) => set('size', v) }),
      slider({ label: t.start.ttfOversample, min: 1, max: 8, step: 1, value: ttf.oversample, onInput: (v) => set('oversample', v) }),
      slider({ label: t.start.ttfShift, min: -4, max: 4, step: 0.5, value: ttf.shift[1], unit: 'px', onInput: (v) => set('shift', v) }),
    );
  }

  async function ensureTtfFace() {
    if (!doc.ttf) {
      ttfFamily = null;
      return;
    }
    if (loaded?.info?.truetype === doc.ttf.bytes) {
      ttfFamily = loaded.family;
      return;
    }
    const bytes = doc.ttf.bytes;
    try {
      const fam = await loadFontFace(bytes);
      if (alive && doc.ttf?.bytes === bytes) {
        ttfFamily = fam;
        paintPreview();
      }
    } catch {
      ttfFamily = null;
    }
  }

  // Existing pack
  const packDz = dropzone({ accept: '.zip,.mcpack,application/zip', label: t.start.packDrop, hint: t.start.packHint, icon: 'package', onFiles: ([f]) => void openPack(f) });
  packDz.classList.add('fm-dz', 'fm-pack-dz');
  const packNotes = h('div', { class: 'fm-import-notes', hidden: true });
  // a font saved as a .tpmproject (or a backup) opens from here too
  const packPanel = h('div', { class: 'fm-pack' }, packDz, openProjectButton({ class: 'fm-open-project' }), packNotes);
  async function openPack(file: File | undefined) {
    if (!file) return;
    packDz.setError(null);
    packDz.classList.add('is-busy');
    try {
      const { importFontPack } = await importer();
      const r = await importFontPack(file, doc.size);
      if (!alive) return;
      if (!(await confirmReplace())) return;
      const name = r.name || file.name.replace(/\.(zip|mcpack)$/i, '');
      replaceDoc(r.doc, name);
      if (r.edition !== edition) chooseEdition(r.edition);
      if (r.name) {
        packName = r.name;
        nameField.setValue(packName);
      }
      packNotes.hidden = !r.notes.length;
      packNotes.replaceChildren(h('ul', { class: 'cv-note-list' }, r.notes.map((n) => h('li', null, n))));
      toast(fmt(t.start.packLoaded, { name, count: r.doc.glyphs.size }), { tone: 'success' });
    } catch (err) {
      console.warn(err);
      packDz.setError(err instanceof Error && 'code' in err ? err.message : t.import.failed);
    } finally {
      packDz.classList.remove('is-busy');
    }
  }

  // The game's own font
  const gameText = h('p', { class: 'fm-note' }, icon('lock', { size: 16 }), h('span'));
  const gameBedrock = h('p', { class: 'fm-note', hidden: true }, icon('circle-info', { size: 16 }), h('span', null, t.start.gameBedrock));
  const gameBar = progressBar({ label: t.start.gameLoad });
  const gameStatus = h('div', { class: 'fm-game-status', hidden: true }, gameBar);
  const gameBtn = button({ label: t.start.gameLoad, icon: 'download', variant: 'secondary', class: 'fm-game-btn', onClick: () => void loadGameFont() });
  const gamePanel = h('div', { class: 'fm-game' }, gameText, gameBedrock, gameStatus, h('div', { class: 'cv-actions' }, gameBtn));
  function paintGame() {
    (gameText.lastChild as HTMLElement).textContent = fmt(t.start.gameText, { version: javaVersion });
    gameBedrock.hidden = edition !== 'bedrock';
  }
  async function loadGameFont() {
    const version = javaVersion;
    setButtonBusy(gameBtn, true);
    gameStatus.hidden = false;
    gameBar.set({ label: fmt(t.start.gameLoading, { version }), fraction: null });
    try {
      const assets: AssetIndex = await loadAssets('java', version, { signal: ctrl.signal, onProgress: (p: Progress) => gameBar.set(p) });
      const { importJavaFont } = await importer();
      const src = { has: (p: string) => assets.hasFile(p), read: (p: string) => assets.readFile(p), list: (p: string) => assets.listFiles(p) };
      const r = await importJavaFont(src, doc.size, { modern: javaFontSupport(version).json });
      if (!alive) return;
      if (!(await confirmReplace())) return;
      replaceDoc(r.doc, fmt(t.start.gameName, { version }));
      const msg = fmt(t.start.gameLoaded, { version, count: r.doc.glyphs.size });
      toast(msg, { tone: 'success' });
      announce(msg);
    } catch (err) {
      if (!alive || ctrl.signal.aborted || isAbortError(err)) return;
      console.error(err);
      toast(friendlyError(err), { tone: 'error' });
    } finally {
      gameStatus.hidden = true;
      if (gameBtn.isConnected) setButtonBusy(gameBtn, false);
    }
  }

  const panels: Record<Source, HTMLElement> = { starter: starterPanel, file: filePanel, pack: packPanel, game: gamePanel };
  const panelEls = SOURCES.map((s) => h('div', { class: 'fm-panel', role: 'tabpanel', id: panelIds[s.id], 'aria-labelledby': tabIds[s.id], dataset: { source: s.id } }, panels[s.id]));
  function showSource(s: Source) {
    source = s;
    tabs.forEach((tab) => {
      const on = tab.dataset.source === s;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
    });
    panelEls.forEach((p) => (p.hidden = p.dataset.source !== s));
    if (s === 'game') paintGame();
  }
  const picker = h('div', { class: 'fm-picker', hidden: !!(restored && restored.glyphs.size) }, tabList, ...panelEls);
  const chosen = h('div', { class: 'fm-chosen' });
  function paintChosen() {
    const change = button({ label: picker.hidden ? t.start.change : t.start.keep, icon: picker.hidden ? 'repeat' : 'check', variant: 'ghost', size: 'sm', class: 'cv-change fm-change' });
    change.setAttribute('aria-label', picker.hidden ? t.start.change : t.start.keep);
    change.addEventListener('click', () => {
      picker.hidden = !picker.hidden;
      paintChosen();
      if (!picker.hidden) tabs.find((tab) => tab.dataset.source === source)?.focus();
    });
    const sampleFont = previewOf(doc, ttfFamily);
    chosen.replaceChildren(
      h(
        'div',
        { class: 'cv-pack-row fm-chosen-row' },
        h('span', { class: 'fm-chosen-sample' }, textStrip(sampleFont, 'Aa', { shadow: true })),
        h(
          'div',
          { class: 'cv-pack-info' },
          h('strong', { class: 'cv-pack-name truncate fm-chosen-name' }, docName),
          h('span', { class: 'cv-pack-badges' }, badge(fmt(t.start.glyphCount, { count: doc.glyphs.size }), 'green'), doc.ttf ? badge(fmt(t.start.withTtf, { file: doc.ttf.file }), 'gray') : null),
        ),
        change,
      ),
    );
  }
  const step1 = stepCard(1, t.start.title, t.start.text, 'text-start-a', h('div', { class: 'cv-step-body' }, chosen, picker, live));

  // ---------------------------------------------------------------- step 2: draw
  const groupSeg = h('div', { class: 'fm-groups', role: 'tablist', 'aria-label': t.draw.groups });
  const groupButtons = GROUP_IDS.map((g) => {
    const b = h('button', { type: 'button', role: 'tab', class: 'fm-group', dataset: { group: g } }, h('span', { class: 'fm-group-name' }, t.draw.groupNames[g]), h('span', { class: 'fm-group-count faint' }));
    b.addEventListener('click', () => chooseGroup(g));
    return b;
  });
  groupSeg.append(...groupButtons);
  const list = h('div', { class: 'fm-list', role: 'listbox', 'aria-label': t.draw.groups });
  const otherEmpty = h('p', { class: 'faint small fm-other-empty', hidden: true }, t.draw.otherEmpty);
  const kanaNote = h('p', { class: 'fm-note', hidden: true }, icon('circle-info', { size: 16 }), h('span', null, t.draw.kanaNote));

  function groupChars(g: GroupId): number[] {
    if (g === 'other') return [...doc.glyphs.keys()].filter((cp) => groupOf(cp) === 'other').concat(extraChars.filter((cp) => !doc.glyphs.has(cp))).sort((a, b) => a - b);
    return [...GROUPS[g]];
  }
  const extraChars: number[] = [];

  function chooseGroup(g: GroupId) {
    group = g;
    const chars = groupChars(g);
    if (chars.length && !chars.includes(selected)) selected = chars[0];
    paintGroups();
    paintList();
    paintEditor();
  }

  function paintGroups() {
    for (const b of groupButtons) {
      const g = b.dataset.group as GroupId;
      const chars = groupChars(g);
      const done = chars.filter((cp) => doc.glyphs.has(cp)).length;
      b.setAttribute('aria-selected', String(g === group));
      (b.querySelector('.fm-group-count') as HTMLElement).textContent = g === 'other' ? String(done) : fmt(t.draw.groupCount, { done, total: chars.length });
    }
    kanaNote.hidden = group !== 'kana';
  }

  const itemOf = new Map<number, HTMLButtonElement>();
  function paintList() {
    const chars = groupChars(group);
    otherEmpty.hidden = !(group === 'other' && !chars.length);
    itemOf.clear();
    list.replaceChildren(
      ...chars.map((cp) => {
        const m = doc.glyphs.get(cp);
        const label = fmt(m ? t.draw.char : t.draw.charEmpty, { char: `${charText(cp)} ${cpLabel(cp)}` });
        const b = h(
          'button',
          { type: 'button', class: ['fm-item', !m && 'is-empty'], role: 'option', 'aria-selected': String(cp === selected), 'aria-label': label, title: `${charText(cp)} ${cpLabel(cp)}`, dataset: { cp: String(cp) } },
          m ? glyphThumb(m, doc.size) : h('span', { class: 'fm-item-char', 'aria-hidden': 'true' }, charText(cp)),
        );
        b.addEventListener('click', () => select(cp));
        itemOf.set(cp, b);
        return b;
      }),
    );
  }

  function paintItem(cp: number) {
    const b = itemOf.get(cp);
    if (!b) return;
    const m = doc.glyphs.get(cp);
    b.classList.toggle('is-empty', !m);
    b.setAttribute('aria-label', fmt(m ? t.draw.char : t.draw.charEmpty, { char: `${charText(cp)} ${cpLabel(cp)}` }));
    b.replaceChildren(m ? glyphThumb(m, doc.size) : h('span', { class: 'fm-item-char', 'aria-hidden': 'true' }, charText(cp)));
  }

  function select(cp: number, focusCanvas = false) {
    const prev = itemOf.get(selected);
    prev?.setAttribute('aria-selected', 'false');
    selected = cp;
    const g = groupOf(cp) === 'other' && !GROUPS[group as Exclude<GroupId, 'other'>]?.includes(cp) ? 'other' : group;
    if (g !== group || !itemOf.has(cp)) {
      group = groupOf(cp);
      paintGroups();
      paintList();
    }
    itemOf.get(cp)?.setAttribute('aria-selected', 'true');
    itemOf.get(cp)?.scrollIntoView({ block: 'nearest' });
    paintEditor();
    if (focusCanvas) canvas.el.focus();
  }

  const canvas = glyphCanvas({
    onStroke: (mask) => {
      remember();
      setGlyph(doc, selected, mask);
      changedGlyph();
    },
  });

  function changedGlyph() {
    paintItem(selected);
    changed({ list: false });
  }

  function setSelected(mask: Mask | null) {
    remember();
    setGlyph(doc, selected, mask);
    changedGlyph();
  }

  const charTitle = h('div', { class: 'fm-char-title' });
  const widthInfo = h('p', { class: 'fm-width faint small', title: t.draw.widthHint });
  const toolSeg = segmented<DrawTool>({
    value: tool,
    label: t.draw.tools,
    size: 'sm',
    options: [
      { value: 'pencil', label: t.draw.pencil, icon: 'pencil' },
      { value: 'eraser', label: t.draw.eraser, icon: 'eraser' },
    ],
    onChange: (v) => {
      tool = v;
      canvas.setTool(v);
    },
  });
  toolSeg.classList.add('fm-tool-seg');
  const current = () => doc.glyphs.get(selected) ?? emptyMask(doc.size);
  const moveBtn = (ic: IconName, label: string, dx: number, dy: number) => iconButton(ic, label, () => setSelected(shiftMask(current(), doc.size, dx, dy)), { size: 'sm', class: `fm-move-${ic}` });
  const undoBtn = iconButton('undo', t.draw.undo, () => undo(), { size: 'sm', class: 'fm-undo' });
  const redoBtn = iconButton('redo', t.draw.redo, () => redo(), { size: 'sm', class: 'fm-redo' });
  const actions = h(
    'div',
    { class: 'fm-actions' },
    h(
      'div',
      { class: 'fm-action-row' },
      moveBtn('arrow-left', t.draw.left, -1, 0),
      moveBtn('arrow-right', t.draw.right, 1, 0),
      moveBtn('arrow-up', t.draw.up, 0, -1),
      moveBtn('arrow-down', t.draw.down, 0, 1),
      iconButton('flip-h', t.draw.flip, () => setSelected(flipMask(current(), doc.size, 'h')), { size: 'sm' }),
      undoBtn,
      redoBtn,
    ),
    h(
      'div',
      { class: 'fm-action-row' },
      button({ label: t.draw.clear, icon: 'trash', size: 'sm', variant: 'ghost', class: 'fm-clear', onClick: () => setSelected(null) }),
      button({
        label: t.draw.copy,
        icon: 'copy',
        size: 'sm',
        variant: 'ghost',
        class: 'fm-copy',
        onClick: () => {
          clip = doc.glyphs.get(selected)?.slice() ?? null;
          paintEditor();
        },
      }),
      button({ label: t.draw.paste, icon: 'clipboard', size: 'sm', variant: 'ghost', class: 'fm-paste', onClick: () => clip && setSelected(clip.slice()) }),
      button({
        label: t.draw.fromStarter,
        icon: 'magic-edit',
        size: 'sm',
        variant: 'ghost',
        class: 'fm-starter',
        title: t.draw.fromStarterTip,
        onClick: () => {
          const m = starterGlyph(selected, 'classic', doc.size);
          if (!m) toast(fmt(t.draw.noStarter, { char: charText(selected) }), { tone: 'info' });
          else setSelected(m);
        },
      }),
    ),
  );
  const prevBtn = iconButton('chevron-left', t.draw.prev, () => step(-1), { size: 'sm', class: 'fm-prev' });
  const nextBtn = iconButton('chevron-right', t.draw.next, () => step(1), { size: 'sm', class: 'fm-next' });
  function step(d: number) {
    const chars = groupChars(group);
    const i = chars.indexOf(selected);
    if (!chars.length) return;
    select(chars[(i + d + chars.length) % chars.length]);
  }
  const emptyNote = h('p', { class: 'faint small fm-empty-note' }, t.draw.empty);
  const editorBox = h(
    'div',
    { class: 'fm-editor' },
    h('div', { class: 'fm-canvas-wrap' }, h('div', { class: 'fm-char-nav' }, prevBtn, charTitle, nextBtn), canvas.el, widthInfo, emptyNote),
    h('div', { class: 'fm-side' }, toolSeg, actions, h('p', { class: 'fm-note fm-guides' }, icon('circle-info', { size: 16 }), h('span', null, t.draw.guides))),
  );

  function paintEditor() {
    const m = doc.glyphs.get(selected) ?? null;
    charTitle.replaceChildren(h('span', { class: 'fm-char-big', 'aria-hidden': 'true' }, charText(selected)), h('span', { class: 'faint small' }, cpLabel(selected)));
    canvas.show(m, doc.size, fmt(t.draw.canvas, { char: charText(selected) }));
    widthInfo.textContent = m ? fmt(t.draw.width, { advance: glyphAdvance(m, doc.size) }) : '';
    emptyNote.hidden = !!m;
    undoBtn.disabled = !undoStack.length;
    redoBtn.disabled = !redoStack.length;
    (actions.querySelector('.fm-paste') as HTMLButtonElement).disabled = !clip;
  }

  function undo() {
    const prev = undoStack.pop();
    if (!prev) return;
    redoStack.push(cloneFont(doc));
    doc = prev;
    void ensureTtfFace();
    changed();
  }
  function redo() {
    const next = redoStack.pop();
    if (!next) return;
    undoStack.push(cloneFont(doc));
    doc = next;
    void ensureTtfFace();
    changed();
  }

  // Adding a character
  const addInput = h('input', { class: 'input fm-add-input', type: 'text', maxLength: 8, placeholder: t.draw.addPlaceholder, 'aria-label': t.draw.add, autocomplete: 'off', spellcheck: false });
  const addError = h('p', { class: 'fm-field-error', role: 'alert', hidden: true });
  const addBtn = button({ label: t.draw.addButton, icon: 'plus', size: 'sm', variant: 'secondary', class: 'fm-add-btn', onClick: () => addChar() });
  addInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addChar();
  });
  addInput.addEventListener('input', () => (addError.hidden = true));
  function addChar() {
    const cps = [...addInput.value.normalize('NFC')].map((c) => c.codePointAt(0)!).filter((cp) => isDrawable(cp));
    if (cps.length !== 1) {
      addError.hidden = false;
      addError.textContent = t.draw.addInvalid;
      return;
    }
    const cp = cps[0];
    addInput.value = '';
    if (groupOf(cp) === 'other' && !extraChars.includes(cp)) extraChars.push(cp);
    group = groupOf(cp);
    selected = cp;
    paintGroups();
    paintList();
    select(cp, true);
    announce(fmt(t.draw.added, { char: charText(cp) }));
  }
  const addRow = h('div', { class: 'fm-add' }, h('label', { class: 'field-label', htmlFor: (addInput.id = uid('fm-add')) }, t.draw.add), h('div', { class: 'fm-add-row' }, addInput, addBtn), addError);

  // Font settings
  const sizeSeg = segmented<string>({
    value: String(doc.size),
    label: t.draw.resolution,
    size: 'sm',
    options: GLYPH_SIZES.map((s) => ({ value: String(s), label: `${s} × ${cellH(s)}` })),
    onChange: (v) => {
      const s = Number(v) as GlyphSize;
      if (s === doc.size) return;
      remember();
      doc = resizeFont(doc, s);
      changed();
      toast(fmt(t.draw.resized, { size: s }), { tone: 'info' });
    },
  });
  sizeSeg.classList.add('fm-size-seg');
  const spaceSlider = slider({
    label: t.draw.space,
    min: 1,
    max: 12,
    step: 1,
    value: doc.space,
    unit: 'px',
    description: t.draw.spaceHint,
    onInput: (v) => {
      doc.space = v;
      changed({ list: false });
    },
  });
  spaceSlider.classList.add('fm-space');
  const settings = h('div', { class: 'fm-settings' }, h('div', { class: 'field' }, h('div', { class: 'field-head' }, h('span', { class: 'field-label' }, t.draw.resolution)), sizeSeg, h('div', { class: 'field-desc' }, t.draw.resolutionHint)), spaceSlider);

  const step2 = stepCard(2, t.draw.title, t.draw.text, 'pencil', h('div', { class: 'cv-step-body' }, groupSeg, kanaNote, list, otherEmpty, editorBox, addRow, settings));

  // ---------------------------------------------------------------- preview
  const target = (): FontTarget => ({ edition, version: javaVersion });
  function previewOf(d: FontDoc, family: string | null, tg: FontTarget | null = null): PreviewFont {
    const glyphs = tg ? glyphsFor(d, tg) : d.glyphs;
    const useTtf = d.ttf && family && (!tg || ttfUsed(d, tg));
    return { size: d.size, glyphs, space: tg ? spaceFor(d, tg) : d.space, ttf: useTtf ? { family: family!, size: d.ttf!.size, shift: d.ttf!.shift, chars: d.ttf!.chars } : null };
  }
  const sceneTabs = h('div', { class: 'fm-scenes', role: 'tablist', 'aria-label': t.preview.scenes });
  const sceneButtons = SCENES.map((s) => {
    const b = h('button', { type: 'button', role: 'tab', class: 'fm-scene', dataset: { scene: s } }, icon(SCENE_ICONS[s], { size: 16 }), h('span', null, t.preview.sceneNames[s]));
    b.addEventListener('click', () => {
      scene = s;
      paintPreview();
    });
    return b;
  });
  sceneTabs.append(...sceneButtons);
  const stage = h('div', { class: 'fm-stage' });
  const sceneCanvas = h('canvas', { class: 'fm-scene-canvas pixelated', role: 'img' }) as HTMLCanvasElement;
  stage.appendChild(sceneCanvas);
  const sampleInput = h('textarea', { class: 'textarea fm-sample', rows: 2, maxLength: 200, spellcheck: false, id: uid('fm-sample') }) as HTMLTextAreaElement;
  sampleInput.value = sample;
  sampleInput.addEventListener('input', () => {
    sample = sampleInput.value;
    paintPreview();
  });
  const missingBox = h('div', { class: 'fm-missing', role: 'status' });
  const targetNote = h('p', { class: 'fm-note fm-target-note', hidden: true }, icon('circle-info', { size: 16 }), h('span'));
  const previewTitleId = uid('fm-prev');
  const previewCard = h(
    'section',
    { class: 'card fm-preview', 'aria-labelledby': previewTitleId },
    h('div', { class: 'cv-step-head' }, h('span', { class: 'fm-prev-icon', 'aria-hidden': 'true' }, icon('message-text')), h('div', null, h('h2', { id: previewTitleId }, t.preview.title), h('p', { class: 'muted' }, t.preview.text))),
    h(
      'div',
      { class: 'cv-step-body' },
      sceneTabs,
      stage,
      h('div', { class: 'field' }, h('div', { class: 'field-head' }, h('label', { class: 'field-label', htmlFor: sampleInput.id }, t.preview.sample)), sampleInput),
      missingBox,
      targetNote,
    ),
  );

  const sceneText = (): SceneText => ({
    sample: sample.replace(/\s+/g, ' ').trim() || ' ',
    player: t.preview.player,
    friend: t.preview.friend,
    joined: t.preview.joined,
    reply: t.preview.reply,
    page: t.preview.page,
    singleplayer: t.preview.singleplayer,
    multiplayer: t.preview.multiplayer,
    options: t.preview.options,
    itemName: t.preview.itemName,
    mainHand: t.preview.mainHand,
    damage: t.preview.damage,
    speed: t.preview.speed,
  });

  let raf = 0;
  let resizeObs: ResizeObserver | null = null;
  function paintPreview() {
    cancelAnimationFrame(raf);
    for (const b of sceneButtons) b.setAttribute('aria-selected', String(b.dataset.scene === scene));
    const tg = target();
    const font = previewOf(doc, ttfFamily, tg);
    const sc = makeScene(scene, font, sceneText(), stageGui());
    const k = font.size / 8;
    sceneCanvas.width = sc.w * k;
    sceneCanvas.height = sc.h * k;
    sceneCanvas.setAttribute('aria-label', fmt(t.preview.image, { scene: t.preview.sceneNames[scene] }));
    sceneCanvas.style.setProperty('--w', String(sc.w));
    sceneCanvas.style.setProperty('--h', String(sc.h));
    const c2 = sceneCanvas.getContext('2d')!;
    const draw = (time: number) => {
      c2.setTransform(1, 0, 0, 1, 0, 0);
      c2.clearRect(0, 0, sceneCanvas.width, sceneCanvas.height);
      c2.imageSmoothingEnabled = false;
      sc.draw(c2, k, time);
    };
    draw(performance.now());
    const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (sc.animated && motion) {
      const loop = (time: number) => {
        if (!alive || !sceneCanvas.isConnected) return;
        if (document.visibilityState === 'visible') draw(time);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }
    fitStage();
    // characters of the sample the game would take from its own font
    const allText = `${sceneText().sample}`;
    const missing = missingChars(font, allText).filter((cp) => cp !== 0x20);
    missingBox.classList.toggle('is-ok', !missing.length);
    missingBox.replaceChildren(
      icon(missing.length ? 'circle-info' : 'check', { size: 16 }),
      h('span', null, missing.length ? fmt(t.preview.missing, { chars: missing.slice(0, 24).map(charText).join(' ') + (missing.length > 24 ? ' …' : '') }) : t.preview.allThere),
    );
    const notes: string[] = [];
    if (tg.edition === 'java' && !javaFontSupport(tg.version).json) notes.push(fmt(t.preview.legacy, { version: tg.version }));
    if (tg.edition === 'bedrock') notes.push(t.preview.bedrock);
    if (font.ttf && doc.ttf) notes.push(fmt(t.preview.ttfFallback, { file: doc.ttf.file }));
    targetNote.hidden = !notes.length;
    (targetNote.lastChild as HTMLElement).textContent = notes.join(' ');
  }

  /** Width the scenes may use, in gui pixels: drawn at least twice their size. */
  const stageGui = () => Math.floor(((stage.clientWidth || 340) - 16) / 2);
  let lastGui = 0;
  /** Largest whole-number scale (up to 3) that fits the stage, fractional when even 2 doesn't fit. */
  function fitStage() {
    const w = Number(sceneCanvas.style.getPropertyValue('--w')) || 1;
    const avail = (stage.clientWidth || 340) - 16;
    const z = avail >= w * 2 ? Math.min(3, Math.floor(avail / w)) : avail / w;
    sceneCanvas.style.width = `${Math.floor(w * z)}px`;
    lastGui = stageGui();
  }

  // ---------------------------------------------------------------- step 3: download
  const editionCards = (['java', 'bedrock'] as Edition[]).map((e) => {
    const b = h(
      'button',
      { type: 'button', class: 'cv-ed fm-ed-choice', role: 'radio', dataset: { value: e } },
      h('span', { class: 'cv-ed-icon' }, icon(e === 'java' ? 'laptop' : 'gamepad')),
      h('span', { class: 'cv-ed-text' }, h('strong', null, e === 'java' ? t.download.java : t.download.bedrock), h('span', { class: 'faint small' }, e === 'java' ? t.download.javaText : t.download.bedrockText)),
      h('span', { class: 'cv-ed-check' }, icon('check', { size: 16 })),
    );
    b.addEventListener('click', () => chooseEdition(e));
    b.addEventListener('keydown', (ev) => {
      if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(ev.key)) return;
      ev.preventDefault();
      const other: Edition = e === 'java' ? 'bedrock' : 'java';
      chooseEdition(other);
      (editionGroup.querySelector(`[data-value="${other}"]`) as HTMLElement | null)?.focus();
    });
    return b;
  });
  const editionGroup = h('div', { class: 'cv-eds fm-eds', role: 'radiogroup', 'aria-label': t.download.edition }, editionCards);
  const vPicker = versionPicker({
    edition: 'java',
    value: javaVersion,
    label: t.download.javaVersion,
    onChange: (_e, v) => {
      javaVersion = v;
      targetChanged();
    },
  });
  const pickerWrap = h('div', { class: 'cv-version fm-version' }, vPicker);
  const nameField = textInput({
    label: t.download.packName,
    value: packName,
    maxLength: 64,
    placeholder: t.pack.defaultName,
    onInput: (v) => {
      packName = v;
      clearInstall();
    },
  });
  nameField.classList.add('fm-name-field');
  const hint = h('div', { class: 'cv-hint fm-hint', role: 'status' });
  const dlBtn = button({ label: t.download.download, icon: 'download', variant: 'primary', size: 'lg', class: 'fm-dl-btn', onClick: () => void download() });
  const addBtnPack = button({ label: t.download.addToPack, icon: 'image', variant: 'secondary', size: 'lg', class: 'fm-project-btn', onClick: () => void chooseProject() });
  const fileBtn = button({ label: projectsText.save, icon: 'save', variant: 'ghost', class: 'fm-file-btn pf-wrap-btn', title: projectsText.saveTip, onClick: () => void saveFontFile() });
  const installBox = h('div', { class: 'cv-install fm-install', hidden: true });
  const step3 = stepCard(3, t.download.title, t.download.text, 'package', h('div', { class: 'cv-step-body' }, editionGroup, pickerWrap, nameField, hint, h('div', { class: 'cv-actions fm-dl-actions' }, dlBtn, addBtnPack), fileBtn, installBox));

  function chooseEdition(e: Edition) {
    if (e === edition) return;
    edition = e;
    targetChanged();
  }

  function targetChanged() {
    for (const b of editionCards) {
      const on = b.dataset.value === edition;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    }
    pickerWrap.hidden = edition !== 'java';
    paintGame();
    paintPreview();
    paintExport();
    clearInstall();
  }

  function paintExport() {
    const tg = target();
    const has = doc.glyphs.size > 0 || ttfUsed(doc, tg);
    dlBtn.disabled = !has;
    addBtnPack.disabled = !has;
    const label = dlBtn.querySelector('.btn-label');
    if (label) label.textContent = edition === 'java' ? t.download.downloadZip : t.download.downloadMcpack;
    if (!has) {
      hint.replaceChildren(t.download.empty);
      return;
    }
    const parts: (string | Node)[] = [];
    if (edition === 'java') {
      const support = javaFontSupport(javaVersion);
      if (support.json) {
        const n = doc.glyphs.size;
        parts.push(...fmtNodes(t.download.javaModern, { version: javaVersion, file: h('code', null, 'assets/minecraft/font/default.json'), count: n, sheets: Math.ceil(n / 256) }));
        if (doc.ttf) parts.push(t.download.javaTtf);
      } else parts.push(...fmtNodes(t.download.javaLegacy, { version: javaVersion, file: h('code', null, 'textures/font/ascii.png') }));
    } else parts.push(fmt(t.download.bedrockFiles, { pages: bedrockPages(doc.glyphs.keys()).length }));
    const dropped = [...doc.glyphs.keys()].filter((cp) => !targetCovers(tg, cp));
    const box = [h('span', null, ...parts)];
    if (dropped.length) box.push(h('span', { class: 'fm-dropped' }, fmt(t.download.notUsed, { count: dropped.length, chars: dropped.slice(0, 12).map(charText).join(' ') + (dropped.length > 12 ? ' …' : '') })));
    hint.replaceChildren(...box);
  }

  function clearInstall() {
    installBox.hidden = true;
    installBox.replaceChildren();
  }

  async function download() {
    if (dlBtn.disabled) return;
    setButtonBusy(dlBtn, true);
    try {
      const { buildFontPack } = await packBuilder();
      const r = await buildFontPack(doc, { name: packName, description: t.download.description, edition, version: javaVersion, uuids: bedrock.uuids, packVersion: bedrock.packVersion });
      if (!alive) return;
      if (edition === 'bedrock') {
        bedrock.uuids = r.uuids;
        bedrock.packVersion = r.packVersion;
      }
      saveBlob(r.blob, r.filename);
      installBox.hidden = false;
      installBox.replaceChildren(
        h('div', { class: 'cv-file' }, icon('check', { size: 20 }), h('strong', null, r.filename), h('span', { class: 'faint small' }, `${formatBytes(r.blob.size)} · ${fmt(t.download.files, { count: r.files.length })}${r.packVersion ? ` · v${r.packVersion.join('.')}` : ''}`)),
        ...(r.notes.length ? [h('ul', { class: 'cv-note-list fm-pack-notes' }, r.notes.map((n) => h('li', null, n)))] : []),
        h('p', { class: 'small muted' }, edition === 'bedrock' ? t.download.installBedrock : t.download.installJava, h('a', { href: routeHref(`/help#${edition === 'bedrock' ? 'bedrock-packs' : 'java-packs'}`) }, t.download.installHelp)),
      );
      announce(fmt(t.download.downloaded, { file: r.filename }));
    } catch (err) {
      console.error(err);
      toast(friendlyError(err, t.download.buildFailed), { tone: 'error' });
    } finally {
      if (dlBtn.isConnected) setButtonBusy(dlBtn, false);
      paintExport();
    }
  }

  async function chooseProject() {
    let projects: TexturePackProject[] = [];
    try {
      projects = ((await listProjects('texturepack')) as TexturePackProject[]).filter((p) => p.edition === edition);
    } catch {
      projects = [];
    }
    if (!alive) return;
    const ed = edition === 'java' ? kit.edition.java : kit.edition.bedrock;
    let modal: { close(): void } | null = null;
    const pick = async (p: TexturePackProject | null) => {
      modal?.close();
      await addToProject(p);
    };
    const newBtn = button({ label: t.download.newProject, icon: 'plus', variant: 'primary', class: 'fm-new-project', onClick: () => void pick(null) });
    const listEl = h(
      'div',
      { class: 'fm-projects', role: 'list' },
      projects.length
        ? projects.map((p) => {
            const b = h(
              'button',
              { type: 'button', class: 'fm-project', role: 'listitem', dataset: { id: p.id } },
              icon('image'),
              h('span', { class: 'fm-project-text' }, h('strong', { class: 'truncate' }, p.name), h('span', { class: 'faint small' }, fmt(t.download.projectInfo, { edition: p.edition === 'java' ? fmt(kit.edition.javaVersion, { version: p.version }) : kit.edition.bedrock, when: timeAgo(p.updatedAt) }))),
            );
            b.addEventListener('click', () => void pick(p));
            return b;
          })
        : h('p', { class: 'faint small' }, fmt(t.download.projectsNone, { edition: ed })),
    );
    modal = openModal({ title: t.download.projectsTitle, body: h('div', { class: 'fm-project-modal' }, h('p', { class: 'muted small' }, t.download.projectsText), listEl, newBtn), width: 520, class: 'fm-projects-modal', actions: [{ label: kit.cancel, variant: 'secondary' }] });
  }

  async function addToProject(existing: TexturePackProject | null) {
    setButtonBusy(addBtnPack, true);
    try {
      const { addFontToProject, newFontProject, fontSlug } = await packBuilder();
      let project: TexturePackProject;
      let replaced = false;
      if (existing) {
        const r = addFontToProject(existing, doc, fontSlug(packName || existing.name));
        project = r.project;
        replaced = r.replaced;
      } else project = newFontProject(doc, { name: packName, description: t.download.description, edition, version: javaVersion });
      await saveProject(project);
      if (!alive) return;
      if (replaced) toast(t.download.replacedFont, { tone: 'info' });
      navigate(`/textures/${encodeURIComponent(project.id)}`);
    } catch (err) {
      console.error(err);
      toast(friendlyError(err, t.download.saveFailed), { tone: 'error' });
      if (addBtnPack.isConnected) setButtonBusy(addBtnPack, false);
    }
  }

  // ---------------------------------------------------------------- project files
  async function saveFontFile(): Promise<boolean> {
    const { fontItem } = await import('../../shared/project-file/records');
    const ttf = doc.ttf ? { bytes: doc.ttf.bytes, file: doc.ttf.file, size: doc.ttf.size, oversample: doc.ttf.oversample, shift: doc.ttf.shift, chars: [...doc.ttf.chars] } : null;
    const item = fontItem({ draft: toDraft(doc), name: docName, ttf, settings: { edition, javaVersion, packName, uuids: bedrock.uuids, packVersion: bedrock.packVersion } });
    if (!item) {
      toast(t.download.empty, { tone: 'info' });
      return false;
    }
    return saveProjectFile({ tool: 'fonts', item });
  }

  /** A font from a project file (asks first when it would replace the user's own font). */
  async function openFontItem(item: ProjectItem): Promise<void> {
    const { readFontItem } = await import('../../shared/project-file/records');
    let f: Awaited<ReturnType<typeof readFontItem>>;
    let next: FontDoc | null;
    try {
      f = await readFontItem(item);
      next = fromDraft(f.draft);
    } catch {
      next = null;
    }
    if (!next) {
      toast(t.import.failed, { tone: 'error' });
      return;
    }
    if (f!.ttf) next.ttf = { ...f!.ttf, chars: new Set(f!.ttf.chars) };
    if (!(await confirmReplace()) || !alive) return;
    const name = f!.name || t.start.current;
    replaceDoc(next, name);
    const st = f!.settings;
    if (st.javaVersion) {
      javaVersion = st.javaVersion;
      vPicker.setValue('java', st.javaVersion);
    }
    if (st.packName !== undefined) {
      packName = st.packName;
      nameField.setValue(packName);
    }
    bedrock.uuids = st.uuids;
    bedrock.packVersion = st.packVersion;
    if (st.edition && st.edition !== edition) chooseEdition(st.edition);
    else targetChanged();
    toast(fmt(t.start.packLoaded, { name, count: next.glyphs.size }), { tone: 'success' });
  }

  // ---------------------------------------------------------------- page
  const heroFont = starterFont('classic', 8);
  const heroGlyph = heroFont.glyphs.get(0x41)!;
  const art = h(
    'div',
    { class: 'cv-hero-art fm-hero-art', 'aria-hidden': 'true' },
    h('figure', null, h('span', { class: 'fm-hero-glyph' }, glyphThumb(heroGlyph, 8)), h('figcaption', null, icon('pencil', { size: 16 }), t.hero.yourGlyph)),
    h('span', { class: 'cv-hero-arrows' }, icon('arrow-right', { size: 32 })),
    h('figure', null, h('span', { class: 'fm-hero-chat' }, textStrip(previewOf(heroFont, null), 'Hello!', { shadow: true })), h('figcaption', null, icon('message-text', { size: 16 }), t.hero.inGame)),
  );
  const grid = h('div', { class: 'container fm-grid' }, step1, step2, previewCard, step3);
  grid.querySelectorAll('.cv-step').forEach((el, i) => el.classList.add(`fm-area-${i + 1}`));
  const page = h(
    'div',
    { class: 'cv-page fm-page accent-green' },
    h(
      'header',
      { class: 'container cv-hero' },
      h('div', { class: 'cv-hero-text' }, h('span', { class: 'eyebrow' }, icon('text-start-a'), t.hero.eyebrow), h('h1', { class: 'pixel-shadow' }, t.hero.title), h('p', { class: 'lead' }, t.hero.lead)),
      art,
    ),
    grid,
    siteFooter(),
  );
  root.appendChild(page);
  showSource('starter');
  targetChanged();
  chooseGroup('basic');
  paintChosen();
  const offOpener = registerOpener('font', openFontItem);
  const pendingFont = takePending('font');
  if (pendingFont) void openFontItem(pendingFont);
  else if (restored && restored.glyphs.size) toast(t.start.restored, { tone: 'info' });
  resizeObs = new ResizeObserver(() => (stageGui() !== lastGui ? paintPreview() : fitStage()));
  resizeObs.observe(stage);

  return () => {
    alive = false;
    offOpener();
    ctrl.abort();
    cancelAnimationFrame(raf);
    clearTimeout(draftTimer);
    writeDraft(doc);
    resizeObs?.disconnect();
    canvas.destroy();
  };
}

function stepCard(n: number, title: string, text: string, ic: IconName, body: HTMLElement): HTMLElement {
  const id = uid('fm-step');
  return h(
    'section',
    { class: 'card cv-step fm-step', 'aria-labelledby': id, dataset: { step: String(n) } },
    h('div', { class: 'cv-step-head' }, h('span', { class: 'cv-step-n', 'aria-hidden': 'true' }, String(n)), h('div', null, h('h2', { id }, title), h('p', { class: 'muted' }, text)), h('span', { class: 'cv-step-icon', 'aria-hidden': 'true' }, icon(ic))),
    body,
  );
}
