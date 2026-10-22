// Cape maker at /cape-maker: paint the 64x32 cape texture (cape and elytra faces) with the skin
// editor's pixel canvas and colour tools while a 3D player wears it, start from a design drawn by
// code or open a cape PNG, then download the PNG (mods and clients) or an elytra texture pack (no
// mods). Says plainly where custom capes work. The cape is kept in this browser (cape/store.ts).

import '../view.css';
import './cape.css';
import type { RouteContext } from '../../../core/router';
import { href as routeHref } from '../../../core/router';
import { debounce } from '../../../core/events';
import { decodeImage, loadImageCodecs } from '../../../core/image-lazy';
import { listProjects } from '../../../core/storage';
import { saveBlob } from '../../../core/download';
import type { Edition, SkinModel } from '../../../core/types';
import { DEFAULT_JAVA_VERSION } from '../../../editions/versions';
import { PixelCanvas, type RGBA, type Tool } from '../../../shared/pixel-canvas';
import { colorPicker } from '../../../ui/color-picker';
import { toHex } from '../../../ui/color';
import { button, iconButton, openPopover, segmented, select, setButtonBusy, spinner, textInput, tooltip } from '../../../ui/components';
import { dropzone } from '../../../ui/dropzone';
import { h, isTypingTarget } from '../../../ui/dom';
import { icon, type IconName } from '../../../ui/icons';
import { toast } from '../../../ui/toast';
import { versionPicker } from '../../../ui/version-picker';
import type { PopoverHandle } from '../../../ui/popover';
import { fmt } from '../../../i18n/editor-text';
import { kit } from '../../../ui/i18n/kit';
import type { SkinProjectData } from '../export';
import type { SkinPreview } from '../skin-preview';
import { createStarterSkin, type StarterId } from '../starters';
import { SKIN_PALETTES } from '../ui/palettes';
import { loadSkinsText } from '../i18n/load';
import { capeText as t } from '../i18n/cape';
import { editorText } from '../i18n/editor';
import { t as startText } from '../i18n/text';
import {
  CAPE_DESIGNS,
  CAPE_H,
  CAPE_REGIONS,
  CAPE_W,
  CapeFileError,
  FIRST_ELYTRA_VERSION,
  copyCapeToElytra,
  countSeeThrough,
  createCapeDesign,
  isBlankCape,
  mirrorWithinRegion,
  normalizeCapeImage,
  regionAt,
  regionOf,
  usedMask,
  type CapeDesignId,
  type CapeRegion,
} from './cape';
import { readSavedCape, writeSavedCape } from './store';

const packBuilder = () => import('./pack');

const TOOLS: { tool: Tool; icon: IconName; text: keyof typeof editorText.tools; key: string }[] = [
  { tool: 'pencil', icon: 'pencil', text: 'pencil', key: 'B' },
  { tool: 'eraser', icon: 'eraser', text: 'eraser', key: 'E' },
  { tool: 'fill', icon: 'fill', text: 'fill', key: 'G' },
  { tool: 'picker', icon: 'pipette', text: 'picker', key: 'I' },
  { tool: 'line', icon: 'line', text: 'line', key: 'L' },
  { tool: 'rect', icon: 'rect', text: 'rect', key: 'U' },
  { tool: 'rect-fill', icon: 'rect-fill', text: 'rectFill', key: 'U' },
  { tool: 'lighten', icon: 'sun', text: 'lighten', key: '' },
  { tool: 'darken', icon: 'moon', text: 'darken', key: '' },
  { tool: 'noise', icon: 'noise', text: 'noise', key: '' },
  { tool: 'select', icon: 'select', text: 'select', key: 'M' },
  { tool: 'move', icon: 'move', text: 'move', key: 'V' },
];

const STARTER_SKINS: StarterId[] = ['explorer', 'knight', 'robot', 'hoodie', 'ninja', 'wizard'];
type Wear = 'cape' | 'elytra';
type Anim = 'idle' | 'walk' | 'run' | 'fly';

interface Prefs {
  wear: Wear;
  animation: Anim;
  skin: string;
  guides: boolean;
  grid: boolean;
  mirror: boolean;
  palette: string;
  color: RGBA;
  edition: Edition;
  javaVersion: string;
  /** Bedrock elytra pack: kept so importing it again replaces the pack */
  uuids?: { header: string; module: string };
  packVersion?: [number, number, number];
}

const PREFS_KEY = 'to-cape-maker-prefs';
const DEFAULT_PREFS: Prefs = {
  wear: 'cape',
  animation: 'idle',
  skin: 'starter:explorer',
  guides: true,
  grid: true,
  mirror: false,
  palette: 'clothes',
  color: [196, 48, 58, 255],
  edition: 'java',
  javaVersion: DEFAULT_JAVA_VERSION,
};

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    const p: Prefs = { ...DEFAULT_PREFS, ...(raw ? (JSON.parse(raw) as Partial<Prefs>) : {}) };
    if (p.wear !== 'cape' && p.wear !== 'elytra') p.wear = 'cape';
    if (!['idle', 'walk', 'run', 'fly'].includes(p.animation)) p.animation = 'idle';
    if (p.edition !== 'java' && p.edition !== 'bedrock') p.edition = 'java';
    if (typeof p.javaVersion !== 'string' || !p.javaVersion) p.javaVersion = DEFAULT_JAVA_VERSION;
    const c = p.color;
    if (!Array.isArray(c) || c.length !== 4 || c.some((v) => typeof v !== 'number' || !(v >= 0 && v <= 255))) p.color = [...DEFAULT_PREFS.color];
    return p;
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function savePrefs(p: Prefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* private mode */
  }
}

const REGION_COLOR: Record<CapeRegion['part'], string> = { cape: '#4fb3ff', elytra: '#b07cff' };

function blankCape(): ImageData {
  return new ImageData(CAPE_W, CAPE_H);
}

/** The outside of a cape design, drawn for its card. */
function drawDesignCard(c: HTMLCanvasElement, img: ImageData): void {
  const face = regionOf('capeOutside');
  const wing = regionOf('wingOutside');
  const k = 4;
  c.width = (face.w + wing.w) * k + k * 2;
  c.height = wing.h * k;
  const ctx = c.getContext('2d');
  if (!ctx) return;
  const at = (r: CapeRegion, ox: number, oy: number, kk: number) => {
    for (let y = 0; y < r.h; y++)
      for (let x = 0; x < r.w; x++) {
        const i = ((r.y + y) * CAPE_W + r.x + x) * 4;
        if (!img.data[i + 3]) continue;
        ctx.fillStyle = `rgba(${img.data[i]},${img.data[i + 1]},${img.data[i + 2]},${img.data[i + 3] / 255})`;
        ctx.fillRect(ox + x * kk, oy + y * kk, kk, kk);
      }
  };
  at(face, 0, ((wing.h - face.h) * k) / 2, k);
  at(wing, (face.w + 2) * k, 0, k);
}

export interface CapeMakerTestApi {
  getImage(): ImageData;
  imageToClient(x: number, y: number): [number, number];
  wear(): Wear;
  /** The 3D preview is ready */
  ready(): boolean;
  flush(): void;
}

export default async function view(root: HTMLElement, ctx: RouteContext): Promise<() => void> {
  await loadSkinsText(ctx.locale);
  root.classList.add('skins-view', 'cm-view');
  const prefs = loadPrefs();
  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) => {
    prefs[k] = v;
    savePrefs(prefs);
  };
  const disposers: (() => void)[] = [];
  let destroyed = false;
  let preview: SkinPreview | null = null;

  // ---- the cape (saved in this browser, or a starter design)
  const saved = readSavedCape();
  let initial: ImageData | null = null;
  if (saved) {
    try {
      const img = await decodeImage(saved.png, 'png');
      if (img.width === CAPE_W && img.height === CAPE_H) initial = img;
    } catch {
      /* damaged: start again */
    }
  }
  const firstVisit = !initial;
  initial ??= createCapeDesign('plain');
  let capeName = saved?.name?.trim() || t.defaultName;

  // =============================================================================================
  // Header

  const nameInput = h('input', { class: 'input cm-name-input', type: 'text', value: capeName, maxLength: 40, spellcheck: false, autocomplete: 'off', 'aria-label': t.name });
  const hero = h(
    'header',
    { class: 'cm-hero' },
    h('div', { class: 'cm-hero-text' }, h('span', { class: 'eyebrow' }, icon('bookmark'), t.hero.eyebrow), h('h1', { class: 'pixel-shadow' }, t.hero.title), h('p', { class: 'lead' }, t.hero.lead)),
  );

  // =============================================================================================
  // Paint card: bar, tool rail, canvas, status

  const undoBtn = iconButton('undo', editorText.bar.undo, () => pc.undo(), { disabled: true });
  const redoBtn = iconButton('redo', editorText.bar.redo, () => pc.redo(), { disabled: true });
  const mirrorBtn = h('button', { type: 'button', class: 'sk-toggle-btn cm-mirror', 'aria-pressed': String(prefs.mirror) }, icon('mirror'), h('span', null, t.canvas.mirror));
  tooltip(mirrorBtn, t.canvas.mirrorTip);
  mirrorBtn.addEventListener('click', () => setMirror(!prefs.mirror));
  const guidesBtn = iconButton('label', t.canvas.guides, () => setGuides(!prefs.guides), { active: prefs.guides });
  const gridBtn = iconButton('grid', t.canvas.grid, () => pc.setShowGrid(!pc.showGrid), { active: prefs.grid });
  const fitBtn = iconButton('aspect-ratio', t.canvas.fit, () => pc.zoomToFit());
  const bar = h(
    'div',
    { class: 'cm-bar' },
    h('label', { class: 'cm-name' }, icon('pen-square'), nameInput),
    h('span', { class: 'grow' }),
    mirrorBtn,
    h('span', { class: 'toolbar-sep' }),
    h('div', { class: 'sk-tools-group' }, guidesBtn, gridBtn, fitBtn),
    h('span', { class: 'toolbar-sep' }),
    undoBtn,
    redoBtn,
  );

  const toolButtons = new Map<Tool, ReturnType<typeof iconButton>>();
  const railTools = h('div', { class: 'sk-rail-tools cm-rail-tools', role: 'toolbar', 'aria-label': t.canvas.tools });
  for (const tl of TOOLS) {
    const label = editorText.tools[tl.text];
    const b = iconButton(tl.icon, tl.key ? `${label} (${tl.key})` : label, () => pc.setTool(tl.tool), { active: false, class: 'sk-tool' });
    b.dataset.tool = tl.tool;
    toolButtons.set(tl.tool, b);
    railTools.appendChild(b);
  }
  const primarySwatch = h('button', { type: 'button', class: 'sk-well sk-well-primary', 'aria-label': editorText.canvas.paintColour }, h('span', { class: 'sk-well-fill' }));
  const secondarySwatch = h('button', { type: 'button', class: 'sk-well sk-well-secondary', 'aria-label': editorText.canvas.rightColour }, h('span', { class: 'sk-well-fill' }));
  const swapBtn = h('button', { type: 'button', class: 'sk-swap', 'aria-label': editorText.canvas.swap }, icon('arrows-horizontal'));
  tooltip(primarySwatch, editorText.canvas.paintColour);
  tooltip(secondarySwatch, editorText.canvas.rightColourTip);
  tooltip(swapBtn, editorText.canvas.swap);
  const rail = h('div', { class: 'sk-rail cm-rail' }, h('div', { class: 'sk-wells' }, primarySwatch, secondarySwatch, swapBtn), railTools);
  const canvasHost = h('div', { class: 'cm-canvas-host' });
  const statusText = h('span', { class: 'cm-status-text sk-status-text' }, t.canvas.hint);
  const status = h('div', { class: 'sk-status cm-status', 'aria-live': 'polite' }, icon('info'), statusText);
  const paintCard = h('section', { class: 'panel cm-paint', 'aria-label': t.canvas.label }, bar, h('div', { class: 'cm-work-area' }, rail, canvasHost), status);

  // =============================================================================================
  // Colour card

  const paletteChips = h('div', { class: 'sk-chips', role: 'group', 'aria-label': editorText.left.presets });
  const pickerSlot = h('div', { class: 'sk-picker-slot' });
  let picker: ReturnType<typeof colorPicker> | null = null;
  let pickerColor: RGBA = [0, 0, 0, 255];
  const buildPicker = () => {
    const group = SKIN_PALETTES.find((g) => g.id === prefs.palette) ?? SKIN_PALETTES[0];
    picker = colorPicker({
      value: pcReady ? pc.color : prefs.color,
      palette: group.colors,
      inline: true,
      onChange: (c) => {
        pickerColor = c;
        pc.setColor(c);
      },
      onEyedropper: () => {
        pc.setTool('picker');
      },
    });
    pickerSlot.replaceChildren(picker);
    paletteChips.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === group.id)));
  };
  for (const g of SKIN_PALETTES) {
    const b = h('button', { type: 'button', class: 'sk-chip', dataset: { id: g.id }, 'aria-pressed': String(g.id === prefs.palette) }, editorText.left.palettes[g.id]);
    b.addEventListener('click', () => {
      set('palette', g.id);
      buildPicker();
    });
    paletteChips.appendChild(b);
  }
  const colourCard = h('section', { class: 'panel cm-colour' }, h('h2', { class: 'section-title' }, editorText.left.colour), paletteChips, pickerSlot);

  // =============================================================================================
  // 3D preview card

  const stage = h('div', { class: 'cm-3d' }, h('div', { class: 'sk-3d-loading' }, spinner(24)));
  const wearSeg = segmented<Wear>({
    value: prefs.wear,
    size: 'sm',
    label: t.preview.wearLabel,
    options: [
      { value: 'cape', label: t.preview.wear.cape },
      { value: 'elytra', label: t.preview.wear.elytra },
    ],
    onChange: (v) => {
      set('wear', v);
      pushCape();
    },
  });
  const animSeg = segmented<Anim>({
    value: prefs.animation,
    size: 'sm',
    label: t.preview.animation,
    options: (['idle', 'walk', 'run', 'fly'] as Anim[]).map((value) => ({ value, label: t.preview.animations[value] })),
    onChange: (v) => {
      const was = prefs.animation;
      set('animation', v);
      preview?.setAnimation(v);
      // Flying lies the player down with the wings spread: step back and look from behind and above.
      if (v === 'fly' || was === 'fly') preview?.setOrbit(v === 'fly' ? FLY_VIEW : BACK_VIEW);
    },
  });
  const backBtn = button({ label: t.preview.back, size: 'sm', variant: 'secondary', onClick: () => preview?.setOrbit(BACK_VIEW) });
  const frontBtn = button({ label: t.preview.front, size: 'sm', variant: 'secondary', onClick: () => preview?.setOrbit(FRONT_VIEW) });
  const stageWrap = h(
    'div',
    { class: 'cm-3d-wrap' },
    stage,
    h('div', { class: 'cm-3d-top' }, wearSeg, h('span', { class: 'grow' }), h('div', { class: 'cm-3d-views' }, backBtn, frontBtn)),
    h('div', { class: 'cm-3d-anim' }, animSeg),
  );
  const skinOptions = (saved: SkinProjectData[]) => [
    ...STARTER_SKINS.map((id) => ({ value: `starter:${id}`, label: startText.starters[id].name })),
    ...saved.map((p) => ({ value: `skin:${p.id}`, label: p.name || startText.untitled })),
  ];
  let savedSkins: SkinProjectData[] = [];
  const skinSelect = select<string>({
    label: t.preview.skin,
    value: prefs.skin.startsWith('starter:') ? prefs.skin : DEFAULT_PREFS.skin,
    options: skinOptions([]),
    onChange: (v) => {
      set('skin', v);
      void showSkin(v);
    },
  });
  skinSelect.classList.add('cm-skin');
  const previewCard = h('section', { class: 'panel cm-preview', 'aria-label': t.preview.title }, h('div', { class: 'panel-header' }, h('h2', null, t.preview.title)), stageWrap, h('div', { class: 'cm-preview-foot' }, skinSelect));

  // =============================================================================================
  // Designs, upload, elytra copy

  const designGrid = h('div', { class: 'cm-designs', role: 'list' });
  for (const id of CAPE_DESIGNS) {
    const c = h('canvas', { class: 'cm-design-pic', 'aria-hidden': 'true' });
    const b = h('button', { type: 'button', class: 'cm-design', role: 'listitem', dataset: { design: id } }, c, h('span', null, t.designs.names[id]));
    b.addEventListener('click', () => applyDesign(id));
    drawDesignCard(c, createCapeDesign(id));
    designGrid.appendChild(b);
  }
  const upload = dropzone({
    accept: '.png,image/png',
    label: t.designs.upload,
    hint: t.designs.uploadHint,
    icon: 'upload',
    compact: true,
    onFiles: ([file]) => void openFile(file),
  });
  const copyBtn = button({ label: t.designs.copyElytra, icon: 'copy', variant: 'secondary', size: 'sm', title: t.designs.copyElytraTip, onClick: () => applyOp(t.designs.copied, (img) => copyCapeToElytra(img)) });
  const clearBtn = button({ label: t.designs.clear, icon: 'trash', variant: 'ghost', size: 'sm', onClick: () => applyOp(t.designs.cleared, () => blankCape()) });
  const designsCard = h(
    'section',
    { class: 'panel cm-card cm-designs-card', 'aria-labelledby': 'cm-designs-title' },
    h('div', { class: 'cm-card-head' }, h('h2', { id: 'cm-designs-title' }, t.designs.title), h('p', { class: 'muted' }, t.designs.text)),
    designGrid,
    h('div', { class: 'cm-designs-foot' }, upload, h('div', { class: 'cm-designs-actions' }, copyBtn, clearBtn)),
  );

  // =============================================================================================
  // Downloads

  const pngBtn = button({ label: t.download.downloadPng, icon: 'download', variant: 'primary', class: 'cm-png-btn', onClick: () => void downloadPng() });
  const editionSeg = segmented<Edition>({
    value: prefs.edition,
    size: 'sm',
    label: t.download.edition,
    options: [
      { value: 'java', label: kit.edition.java },
      { value: 'bedrock', label: kit.edition.bedrock },
    ],
    onChange: (v) => {
      set('edition', v);
      syncPackUi();
    },
  });
  const vPicker = versionPicker({
    edition: 'java',
    value: prefs.javaVersion,
    label: t.download.version,
    onChange: (_e, v) => {
      set('javaVersion', v);
      syncPackUi();
    },
  });
  let packNameTouched = false;
  const packNameField = textInput({
    label: t.download.packName,
    value: fmt(t.download.packDefault, { name: capeName }),
    maxLength: 64,
    onInput: () => (packNameTouched = true),
  });
  const packNote = h('p', { class: 'sk-note cm-pack-note' });
  const packBtn = button({ label: t.download.downloadPack, icon: 'package', variant: 'secondary', class: 'cm-pack-btn', onClick: () => void downloadPack() });
  const versionWrap = h('div', { class: 'cm-version' }, vPicker);
  const downloadCard = h(
    'section',
    { class: 'panel cm-card cm-download', 'aria-labelledby': 'cm-download-title' },
    h('div', { class: 'cm-card-head' }, h('h2', { id: 'cm-download-title' }, t.download.title)),
    h(
      'div',
      { class: 'cm-download-grid' },
      h(
        'div',
        { class: 'cm-download-item cm-download-png' },
        h('div', { class: 'cm-download-head' }, h('span', { class: 'sk-import-icon' }, icon('image')), h('div', null, h('h3', null, t.download.png), h('p', { class: 'muted small' }, t.download.pngSub))),
        pngBtn,
      ),
      h(
        'div',
        { class: 'cm-download-item cm-download-pack' },
        h('div', { class: 'cm-download-head' }, h('span', { class: 'sk-import-icon' }, icon('package')), h('div', null, h('h3', null, t.download.pack), h('p', { class: 'muted small' }, t.download.packSub))),
        h('div', { class: 'cm-pack-fields' }, editionSeg, versionWrap, packNameField),
        packNote,
        packBtn,
      ),
    ),
  );

  // =============================================================================================
  // Where capes work

  const whereItem = (ic: IconName, title: string, ...text: (string | Node)[]) =>
    h('div', { class: 'cm-where-item' }, h('span', { class: 'sk-import-icon' }, icon(ic)), h('div', null, h('h3', null, title), ...text.map((x) => (typeof x === 'string' ? h('p', null, x) : x))));
  const whereCard = h(
    'section',
    { class: 'panel cm-card cm-where', 'aria-labelledby': 'cm-where-title' },
    h('div', { class: 'cm-card-head' }, h('h2', { id: 'cm-where-title' }, t.where.title)),
    h(
      'div',
      { class: 'cm-where-grid' },
      whereItem('monitor', t.where.javaTitle, t.where.java, t.where.javaMods),
      whereItem('smartphone', t.where.bedrockTitle, t.where.bedrock),
      whereItem('package', t.where.elytraTitle, t.where.elytra),
      whereItem('camera', t.where.pictureTitle, t.where.picture, h('p', null, h('a', { class: 'sk-help-link', href: routeHref('/skins') }, icon('arrow-right'), t.where.openSkins))),
    ),
  );

  const page = h(
    'div',
    { class: 'cm container' },
    hero,
    h('div', { class: 'cm-work' }, paintCard, previewCard, colourCard),
    designsCard,
    downloadCard,
    whereCard,
  );
  root.append(page);

  // =============================================================================================
  // Pixel canvas

  let pcReady = false;
  const pc = new PixelCanvas(canvasHost, {
    image: initial,
    showGrid: prefs.grid,
    label: t.canvas.label,
    mask: usedMask(),
    dimMasked: true,
    mirrorMap: (x, y) => mirrorWithinRegion(x, y),
    decodeImage: (b) => decodeImage(b),
  });
  pcReady = true;
  disposers.push(() => pc.destroy());
  pc.setColor(prefs.color);
  pc.setSecondaryColor([0, 0, 0, 0]);
  pc.setMirror(prefs.mirror, false);
  buildPicker();

  let hover: { x: number; y: number } | null = null;
  pc.setOverlay((g, v) => {
    const s = v.scale;
    if (!prefs.guides || s < 2) return;
    const px = (n: number) => Math.round(n);
    const rect = (r: CapeRegion) => {
      const [x0, y0] = v.toScreen(r.x, r.y);
      const [x1, y1] = v.toScreen(r.x + r.w, r.y + r.h);
      return [px(x0), px(y0), px(x1) - px(x0), px(y1) - px(y0)] as const;
    };
    const hovered = hover ? regionAt(hover.x, hover.y) : null;
    g.save();
    for (const r of CAPE_REGIONS) {
      const [x, y, w, hh] = rect(r);
      g.globalAlpha = 0.85;
      g.strokeStyle = REGION_COLOR[r.part];
      g.lineWidth = r === hovered ? 2 : 1;
      if (r === hovered) {
        g.fillStyle = REGION_COLOR[r.part];
        g.globalAlpha = 0.14;
        g.fillRect(x, y, w, hh);
        g.globalAlpha = 1;
      }
      g.strokeRect(x + 0.5, y + 0.5, w - 1, hh - 1);
    }
    g.globalAlpha = 1;
    // Tags on the big faces.
    if (s >= 5) {
      const fontPx = s >= 10 ? 16 : 8;
      g.font = `${fontPx}px 'Texel', monospace`;
      g.textBaseline = 'middle';
      const padX = fontPx >= 16 ? 6 : 3;
      const tagH = fontPx >= 16 ? 22 : 12;
      const tags: [CapeRegion, string][] = [
        [regionOf('capeOutside'), t.tags.outside],
        [regionOf('capeInside'), t.tags.inside],
        [regionOf('wingOutside'), t.tags.outside],
        [regionOf('wingInside'), t.tags.inside],
      ];
      for (const [r, text] of tags) {
        const [x, y, w] = rect(r);
        const tw = Math.round(g.measureText(text).width + padX * 2);
        if (tw > w - 4) continue;
        g.globalAlpha = hovered === r ? 0.25 : 0.92;
        g.fillStyle = REGION_COLOR[r.part];
        g.fillRect(x + 2, y + 2, tw, tagH);
        g.fillStyle = '#0b0e14';
        g.fillText(text, x + 2 + padX, y + 2 + tagH / 2 - (fontPx >= 16 ? 1 : 0));
      }
      // "Elytra" over the wing faces, in the unused strip below them.
      const wingsTop = v.toScreen(22, 22);
      const tw = Math.round(g.measureText(t.tags.elytra).width + padX * 2);
      if (tw < 24 * s - 4 && s * 3 > tagH) {
        g.globalAlpha = 0.92;
        g.fillStyle = REGION_COLOR.elytra;
        g.fillRect(px(wingsTop[0]) + 2, px(wingsTop[1]) + 4, tw, tagH);
        g.fillStyle = '#0b0e14';
        g.fillText(t.tags.elytra, px(wingsTop[0]) + 2 + padX, px(wingsTop[1]) + 4 + tagH / 2 - (fontPx >= 16 ? 1 : 0));
      }
    }
    g.restore();
  });

  // Fit the texture once the canvas has its size.
  let firstLayout = true;
  const hostObserver = new ResizeObserver(() => {
    if (!firstLayout || !canvasHost.clientWidth) return;
    firstLayout = false;
    requestAnimationFrame(() => pc.zoomToFit());
  });
  hostObserver.observe(canvasHost);
  disposers.push(() => hostObserver.disconnect());

  // ---- sync UI from the canvas
  const syncTool = () => toolButtons.forEach((b, tool) => b.setActive(tool === pc.tool));
  const syncColors = () => {
    const c = pc.color;
    const s = pc.secondaryColor;
    (primarySwatch.firstElementChild as HTMLElement).style.background = `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${c[3] / 255})`;
    (secondarySwatch.firstElementChild as HTMLElement).style.background = s[3] === 0 ? '' : `rgba(${s[0]}, ${s[1]}, ${s[2]}, ${s[3] / 255})`;
    secondarySwatch.classList.toggle('is-clear', s[3] === 0);
    primarySwatch.setAttribute('aria-label', fmt(editorText.canvas.paintColourValue, { hex: toHex(c, c[3] < 255) }));
    if (picker && c.some((v, i) => v !== pickerColor[i])) {
      pickerColor = [...c] as RGBA;
      picker.setValue(c);
    }
  };
  const syncHistory = () => {
    undoBtn.disabled = !pc.canUndo();
    redoBtn.disabled = !pc.canRedo();
  };
  syncTool();
  syncColors();
  const saveColor = debounce(() => set('color', [...pc.color] as RGBA), 400);
  disposers.push(() => saveColor.flush());
  disposers.push(
    pc.on('tool', syncTool),
    pc.on('settings', (s) => {
      syncColors();
      if (pc.color.some((v, i) => v !== prefs.color[i])) saveColor();
      if (s.showGrid !== prefs.grid) {
        set('grid', s.showGrid);
        gridBtn.setActive(s.showGrid);
      }
    }),
    pc.on('colorpick', syncColors),
    pc.on('history', syncHistory),
    pc.on('hover', (p) => {
      hover = p;
      const r = p ? regionAt(p.x, p.y) : null;
      statusText.textContent = p ? (r ? fmt(t.canvas.at, { region: t.regions[r.id], x: p.x, y: p.y }) : t.canvas.unused) : t.canvas.hint;
      status.classList.toggle('is-hover', !!p);
      pc.redraw();
    }),
    pc.on('change', () => {
      scheduleLive();
      scheduleSave();
    }),
  );
  syncHistory();

  const openColorPopover = (anchor: HTMLElement): PopoverHandle => {
    const group = SKIN_PALETTES.find((g) => g.id === prefs.palette) ?? SKIN_PALETTES[0];
    const content = h(
      'div',
      { class: 'sk-color-pop' },
      colorPicker({
        value: pc.color,
        palette: group.colors,
        onChange: (c) => pc.setColor(c),
        onEyedropper: () => {
          pc.setTool('picker');
          pop.close();
        },
      }),
    );
    const pop = openPopover(anchor, content, { placement: window.matchMedia('(max-width: 720px)').matches ? 'bottom-start' : 'right-start', label: editorText.canvas.paintColour, focus: true, class: 'sk-color-popover' });
    return pop;
  };
  let colorPop: PopoverHandle | null = null;
  primarySwatch.addEventListener('click', () => {
    if (colorPop?.open) {
      colorPop.close();
      return;
    }
    colorPop = openColorPopover(primarySwatch);
  });
  secondarySwatch.addEventListener('click', () => {
    const s = pc.secondaryColor;
    pc.setSecondaryColor(s[3] === 0 ? pc.color : [0, 0, 0, 0]);
    toast(s[3] === 0 ? editorText.canvas.rightNowPaints : editorText.canvas.rightNowErases, { duration: 2500 });
  });
  swapBtn.addEventListener('click', () => pc.swapColors());

  function setMirror(v: boolean): void {
    set('mirror', v);
    mirrorBtn.setAttribute('aria-pressed', String(v));
    pc.setMirror(v, false);
    pc.redraw();
  }
  function setGuides(v: boolean): void {
    set('guides', v);
    guidesBtn.setActive(v);
    pc.redraw();
  }

  /** An undoable change of the whole texture, with an Undo button in the toast. */
  function applyOp(message: string, fn: (img: ImageData) => ImageData): void {
    pc.deselect();
    pc.applyFilter(fn);
    const after = pc.getImage().data;
    toast(message, {
      tone: 'success',
      duration: 4000,
      action: {
        label: editorText.undo,
        onClick: () => {
          const now = pc.getImage().data;
          if (now.length === after.length && now.every((v, i) => v === after[i])) pc.undo();
          else toast(editorText.paintedSince, { duration: 3500 });
        },
      },
    });
  }

  function applyDesign(id: CapeDesignId): void {
    applyOp(fmt(t.designs.applied, { name: t.designs.names[id] }), () => createCapeDesign(id));
  }

  async function openFile(file: File): Promise<void> {
    upload.setError(null);
    let img: ImageData;
    try {
      img = await decodeImage(new Uint8Array(await file.arrayBuffer()), 'png');
    } catch {
      upload.setError(t.designs.unreadable);
      return;
    }
    let res: ReturnType<typeof normalizeCapeImage>;
    try {
      res = normalizeCapeImage(img);
    } catch (err) {
      upload.setError(err instanceof CapeFileError ? fmt(t.designs.notCape, { size: `${img.width}×${img.height}` }) : t.designs.unreadable);
      return;
    }
    const opened = fmt(t.designs.opened, { file: file.name });
    applyOp(opened, () => res.image);
    if (res.change === 'reduced') toast(fmt(t.designs.reduced, { size: `${img.width}×${img.height}` }), { tone: 'info', duration: 6000 });
    if (res.change === 'placed') toast(t.designs.placed, { tone: 'info', duration: 6000 });
    const base = file.name.replace(/\.png$/i, '').replace(/[_-]+/g, ' ').trim();
    if (base && nameInput.value.trim() === t.defaultName) {
      nameInput.value = base.slice(0, 40);
      nameChanged();
    }
  }

  // =============================================================================================
  // Saving in this browser

  let saveWarned = false;
  const saveNow = async () => {
    const { encodePng } = await loadImageCodecs();
    const ok = writeSavedCape({ png: encodePng(pc.getImage()), name: capeName, t: Date.now() });
    if (!ok && !saveWarned) {
      saveWarned = true;
      toast(t.saveFailed, { tone: 'warn', duration: 7000 });
    }
  };
  const scheduleSave = debounce(() => void saveNow(), 500);
  disposers.push(() => scheduleSave.flush());
  if (firstVisit) scheduleSave();

  const nameChanged = () => {
    capeName = nameInput.value.trim() || t.defaultName;
    if (!packNameTouched) packNameField.input.value = fmt(t.download.packDefault, { name: capeName });
    scheduleSave();
  };
  nameInput.addEventListener('input', nameChanged);
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') nameInput.blur();
  });

  // =============================================================================================
  // 3D preview

  const BACK_VIEW = { yaw: 150, pitch: 12, zoom: 0.95, focusY: 0 };
  const FRONT_VIEW = { yaw: 30, pitch: 10, zoom: 0.95, focusY: 0 };
  const FLY_VIEW = { yaw: 160, pitch: 34, zoom: 0.62, focusY: 0 };
  let liveRaf = 0;
  const pushCape = () => preview?.setCape(pc.getImage(), prefs.wear);
  const scheduleLive = () => {
    if (liveRaf) return;
    liveRaf = requestAnimationFrame(() => {
      liveRaf = 0;
      if (!destroyed) pushCape();
    });
  };
  disposers.push(() => cancelAnimationFrame(liveRaf));

  async function skinFor(value: string): Promise<{ image: ImageData; model: SkinModel } | null> {
    if (value.startsWith('skin:')) {
      const p = savedSkins.find((s) => `skin:${s.id}` === value);
      if (!p) return null;
      try {
        const img = await decodeImage(p.image, 'png');
        if (img.width !== img.height) return null;
        return { image: img, model: p.model === 'slim' ? 'slim' : 'classic' };
      } catch {
        return null;
      }
    }
    const id = value.replace(/^starter:/, '') as StarterId;
    return { image: createStarterSkin(STARTER_SKINS.includes(id) ? id : 'explorer', 'classic'), model: 'classic' };
  }

  async function showSkin(value: string): Promise<void> {
    const s = await skinFor(value);
    if (!s || !preview || destroyed) return;
    preview.setModel(s.model);
    preview.setSkin(s.image);
  }

  void import('../skin-preview')
    .then(async ({ createSkinPreview }) => {
      if (destroyed) return;
      const first = (await skinFor(prefs.skin.startsWith('skin:') ? DEFAULT_PREFS.skin : prefs.skin))!;
      if (destroyed) return;
      stage.replaceChildren();
      preview = createSkinPreview(stage, { model: first.model, skin: first.image, animation: prefs.animation, background: null });
      stage.querySelector('canvas')?.setAttribute('aria-label', t.preview.stage);
      pushCape();
      preview.setOrbit(prefs.animation === 'fly' ? FLY_VIEW : BACK_VIEW, true);
      disposers.push(() => preview?.destroy());
      if (prefs.skin.startsWith('skin:') || ctx.query.get('skin')) void showSkin(skinSelect.querySelector('select')!.value);
    })
    .catch(() => stage.replaceChildren(h('p', { class: 'sk-3d-error muted' }, t.preview.loadFailed)));

  // Saved skins join the skin list (and ?skin=<id> from the skin editor picks one).
  void listProjects('skin')
    .then((list) => {
      if (destroyed) return;
      savedSkins = (list as SkinProjectData[]).filter((p) => p.image instanceof Blob);
      skinSelect.setOptions(skinOptions(savedSkins));
      const wanted = ctx.query.get('skin');
      const pick = wanted && savedSkins.some((p) => p.id === wanted) ? `skin:${wanted}` : savedSkins.some((p) => `skin:${p.id}` === prefs.skin) ? prefs.skin : null;
      if (pick) {
        skinSelect.setValue(pick);
        set('skin', pick);
        void showSkin(pick);
      }
    })
    .catch(() => undefined);

  // =============================================================================================
  // Downloads

  function syncPackUi(): void {
    const java = prefs.edition === 'java';
    versionWrap.hidden = !java;
    const v = prefs.javaVersion;
    void packBuilder().then(({ javaHasElytra }) => {
      if (destroyed) return;
      const ok = !java || javaHasElytra(v);
      packBtn.disabled = !ok;
      packNote.classList.toggle('is-warn', !ok);
      packNote.replaceChildren(icon(ok ? 'info' : 'warning'), h('span', null, !ok ? fmt(t.download.noElytra, { version: v, first: FIRST_ELYTRA_VERSION }) : java ? t.download.javaInstall : t.download.bedrockInstall));
    });
  }
  syncPackUi();

  function checkCape(img: ImageData): boolean {
    if (isBlankCape(img)) {
      toast(t.download.blank, { tone: 'warn' });
      return false;
    }
    return true;
  }

  async function downloadPng(): Promise<void> {
    const img = pc.getImage();
    if (!checkCape(img)) return;
    setButtonBusy(pngBtn, true);
    try {
      const { capePngFile } = await packBuilder();
      const f = capePngFile(img, capeName);
      saveBlob(f.blob, f.filename);
      toast(fmt(t.download.downloaded, { file: f.filename }), { tone: 'success' });
      const holes = countSeeThrough(img);
      if (holes) toast(fmt(t.download.seeThrough, { count: holes }), { tone: 'info', duration: 7000 });
    } catch {
      toast(t.download.failed, { tone: 'error' });
    } finally {
      setButtonBusy(pngBtn, false);
    }
  }

  async function downloadPack(): Promise<void> {
    const img = pc.getImage();
    if (!checkCape(img)) return;
    setButtonBusy(packBtn, true);
    try {
      const { buildElytraPack } = await packBuilder();
      const pack = await buildElytraPack(img, {
        name: packNameField.input.value.trim() || fmt(t.download.packDefault, { name: capeName }),
        description: t.download.packDescription,
        edition: prefs.edition,
        version: prefs.javaVersion,
        uuids: prefs.uuids,
        packVersion: prefs.packVersion,
      });
      if (pack.uuids) {
        set('uuids', pack.uuids);
        set('packVersion', pack.packVersion);
      }
      saveBlob(pack.blob, pack.filename);
      toast(fmt(t.download.downloaded, { file: pack.filename }), { tone: 'success' });
    } catch {
      toast(t.download.failed, { tone: 'error' });
    } finally {
      setButtonBusy(packBtn, false);
      syncPackUi();
    }
  }

  // ---- keyboard: Ctrl+S saves (the canvas has its own tool keys)
  const onKey = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      scheduleSave.flush();
      toast(editorText.savedNow, { tone: 'success', duration: 1500 });
      return;
    }
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
    if ((e.key === 'y' || e.key === 'Y') && page.isConnected) {
      setMirror(!prefs.mirror);
      e.preventDefault();
    }
  };
  window.addEventListener('keydown', onKey);
  disposers.push(() => window.removeEventListener('keydown', onKey));

  const api: CapeMakerTestApi = {
    getImage: () => pc.getImage(),
    imageToClient: (x, y) => {
      const v = pc.getView();
      const r = pc.element.getBoundingClientRect();
      return [r.left + v.offsetX + (x + 0.5) * v.scale, r.top + v.offsetY + (y + 0.5) * v.scale];
    },
    wear: () => prefs.wear,
    ready: () => !!preview,
    flush: () => scheduleSave.flush(),
  };
  Object.defineProperty(page, '__capeMaker', { value: api });

  return () => {
    destroyed = true;
    for (const d of disposers.splice(0).reverse()) {
      try {
        d();
      } catch {
        /* ignore */
      }
    }
  };
}
