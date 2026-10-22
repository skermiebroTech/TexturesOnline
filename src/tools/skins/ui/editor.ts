// Skin editor: tool rail + 64x64 (or HD 128x128) pixel canvas with part guides, colours and parts on
// the left, live 3D preview on the right. Autosaves to IndexedDB.

import { debounce } from '../../../core/events';
import { decodeImage, encodePng } from '../../../core/image';
import { navigate } from '../../../core/router';
import { getProject, saveProject } from '../../../core/storage';
import { saveBlob } from '../../../core/download';
import type { SkinModel } from '../../../core/types';
import { PixelCanvas, type RGBA, type Tool } from '../../../shared/pixel-canvas';
import { colorPicker } from '../../../ui/color-picker';
import { toHex } from '../../../ui/color';
import { button, editorLayout, emptyState, iconButton, openMenu, openPopover, segmented, slider, spinner, toggle, tooltip, type EditorPanel } from '../../../ui/components';
import { h, isTypingTarget, prefersReducedMotion } from '../../../ui/dom';
import { icon, setIcon, type IconName } from '../../../ui/icons';
import { openModal, openShortcutsSheet } from '../../../ui/modal';
import type { PopoverHandle } from '../../../ui/popover';
import { toast } from '../../../ui/toast';
import { kit } from '../../../ui/i18n/kit';
import type { SkinAnimation, SkinPreview } from '../skin-preview';
import { exportSkin, openExportMenu } from './export-modal';
import { hdLossPercent, type SkinProjectData } from '../export';
import { resizeSkin, type SkinSize } from '../hd';
import {
  convertArms,
  copyToMirror,
  countBaseHoles,
  describeRect,
  drawPartOverlay,
  fillPart,
  maskForParts,
  mirrorFaceRect,
  mirrorMapFor,
  partAt,
  PARTS,
  PART_INFO,
  scaleOf,
  withMirrorParts,
  type FaceRect,
  type LayerSelection,
  type SkinPart,
  type SkinScale,
} from '../templates';
import { drawFigure, drawHead, drawPaperDoll } from './figure';
import { SKIN_PALETTES } from './palettes';
import { normalizeSkinImage } from './sources';
import { setOuterSeeThrough, setPartVisible } from './preview-extras';
import { createPaint3d, drawPixelOutline, maxBrushFor } from './paint3d';
import { fmt } from '../../../i18n/editor-text';
import { editorText as t, type SkinEditorText } from '../i18n/editor';
import { t as startText } from '../i18n/text';
import { poseText } from '../i18n/pose';

// ---------------------------------------------------------------------------------------------
// Preferences (per browser)

interface Prefs {
  layers: LayerSelection;
  mirror: boolean;
  guides: boolean;
  grid: boolean;
  animation: SkinAnimation;
  backdrop: string;
  seeThrough: boolean;
  autoRotate: boolean;
  palette: string;
  base3d: boolean;
  outer3d: boolean;
  /** Last paint colour (RGBA) */
  color: [number, number, number, number];
  /** Side panel shown next to the canvas on tablets */
  side: 'left' | 'right';
  /** What the main editor area shows: the 2D template or the 3D model (the other goes to the side panel) */
  workspace: '2d' | '3d';
}

const PREFS_KEY = 'to-skin-editor';
const DEFAULT_PREFS: Prefs = {
  layers: 'both',
  mirror: false,
  guides: true,
  grid: true,
  animation: 'idle',
  backdrop: 'studio',
  seeThrough: false,
  autoRotate: false,
  palette: 'skin',
  base3d: true,
  outer3d: true,
  color: [62, 124, 214, 255],
  side: 'right',
  workspace: '2d',
};

function loadPrefs(): Prefs {
  const defaults: Prefs = { ...DEFAULT_PREFS, animation: prefersReducedMotion() ? 'none' : DEFAULT_PREFS.animation };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    const p: Prefs = raw ? { ...defaults, ...(JSON.parse(raw) as Partial<Prefs>) } : defaults;
    const c = p.color;
    if (!Array.isArray(c) || c.length !== 4 || c.some((v) => typeof v !== 'number' || !(v >= 0 && v <= 255))) p.color = [...DEFAULT_PREFS.color];
    if (!['base', 'outer', 'both'].includes(p.layers)) p.layers = 'both';
    if (p.side !== 'left' && p.side !== 'right') p.side = 'right';
    if (p.workspace !== '2d' && p.workspace !== '3d') p.workspace = '2d';
    return p;
  } catch {
    return defaults;
  }
}

function savePrefs(p: Prefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* private mode */
  }
}

// ---------------------------------------------------------------------------------------------

// Names are read from the editor's text when the controls are built (never stored at import).
const TOOLS: { tool: Tool; icon: IconName; text: keyof SkinEditorText['tools']; key?: string }[] = [
  { tool: 'pencil', icon: 'pencil', text: 'pencil', key: 'B' },
  { tool: 'eraser', icon: 'eraser', text: 'eraser', key: 'E' },
  { tool: 'fill', icon: 'fill', text: 'fill', key: 'G' },
  { tool: 'picker', icon: 'pipette', text: 'picker', key: 'I' },
  { tool: 'line', icon: 'line', text: 'line', key: 'L' },
  { tool: 'rect', icon: 'rect', text: 'rect', key: 'U' },
  { tool: 'rect-fill', icon: 'rect-fill', text: 'rectFill', key: 'U' },
  { tool: 'ellipse', icon: 'ellipse', text: 'ellipse', key: 'O' },
  { tool: 'lighten', icon: 'sun', text: 'lighten' },
  { tool: 'darken', icon: 'moon', text: 'darken' },
  { tool: 'noise', icon: 'noise', text: 'noise' },
  { tool: 'select', icon: 'select', text: 'select', key: 'M' },
  { tool: 'move', icon: 'move', text: 'move', key: 'V' },
];

type BackdropId = keyof SkinEditorText['right']['backdrops'];
const BACKDROPS: { id: BackdropId; color: string | null; swatch: string }[] = [
  { id: 'studio', color: null, swatch: 'transparent' },
  { id: 'sky', color: '#8ec5ff', swatch: '#8ec5ff' },
  { id: 'night', color: '#11141c', swatch: '#11141c' },
  { id: 'paper', color: '#eef1f6', swatch: '#eef1f6' },
];

const ANIMATIONS: (SkinAnimation & keyof SkinEditorText['right']['animations'])[] = ['idle', 'walk', 'run', 'none'];

const TIPS: (keyof SkinEditorText['tips'])[] = ['hover', 'mirror', 'outer', 'lock', 'shading', 'keys', 'paint3d', 'hd'];

/** A sentence that may start with a part's name (German "den rechten Arm …"), capitalised. */
function upperFirst(s: string): string {
  return s.charAt(0).toLocaleUpperCase() + s.slice(1);
}

function isLight(): boolean {
  return document.documentElement.dataset.theme === 'light';
}

function notFound(root: HTMLElement, title: string, text: string): () => void {
  root.append(
    h(
      'div',
      { class: 'sk-missing container' },
      emptyState({
        icon: 'human',
        title,
        text,
        action: button({ label: t.missing.allSkins, icon: 'arrow-left', variant: 'primary', onClick: () => navigate('/skins') }),
      }),
    ),
  );
  return () => undefined;
}

/** Asks a question with several answers; resolves null when dismissed. */
function choose<T extends string>(title: string, body: Node, options: { value: T; label: string; variant?: 'primary' | 'secondary' | 'ghost' }[]): Promise<T | null> {
  return new Promise((resolve) => {
    let answered = false;
    openModal({
      title,
      body,
      width: 520,
      onClose: () => {
        if (!answered) resolve(null);
      },
      actions: options.map((o) => ({
        label: o.label,
        variant: o.variant ?? 'secondary',
        onClick: () => {
          answered = true;
          resolve(o.value);
        },
      })),
    });
  });
}

function samePixels(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Opens a popover from `anchor`, or closes it when it is already open (a second click toggles). */
function togglePopover(anchor: HTMLElement, open: () => PopoverHandle): void {
  const current = openPopovers.get(anchor);
  if (current?.open) {
    current.close();
    return;
  }
  openPopovers.set(anchor, open());
}
const openPopovers = new WeakMap<HTMLElement, PopoverHandle>();

// ---- Crash-safe backup ----
// IndexedDB writes started while the page unloads often never finish, so the last few strokes
// before a reload or tab close are also written synchronously to localStorage and recovered on
// the next visit.

const BACKUP_PREFIX = 'to-skin-backup:';

interface SkinBackup {
  png: string;
  model: SkinModel;
  name: string;
  t: number;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function writeBackup(id: string, b: SkinBackup): boolean {
  try {
    localStorage.setItem(BACKUP_PREFIX + id, JSON.stringify(b));
    return true;
  } catch {
    return false;
  }
}

function readBackup(id: string): SkinBackup | null {
  try {
    const raw = localStorage.getItem(BACKUP_PREFIX + id);
    if (!raw) return null;
    const b = JSON.parse(raw) as Partial<SkinBackup>;
    if (typeof b.png !== 'string' || typeof b.t !== 'number') return null;
    return { png: b.png, t: b.t, model: b.model === 'slim' ? 'slim' : 'classic', name: typeof b.name === 'string' ? b.name : '' };
  } catch {
    return null;
  }
}

function clearBackup(id: string): void {
  try {
    localStorage.removeItem(BACKUP_PREFIX + id);
  } catch {
    /* private mode */
  }
}

export interface SkinEditorTestApi {
  getImage(): ImageData;
  /** Skin width and height: 64, or 128 for HD */
  size(): number;
  imageToClient(x: number, y: number): [number, number];
  model(): SkinModel;
  flush(): Promise<void>;
  /** 3D paint mode on? */
  paint3d(): boolean;
  /** Client position of a pixel's centre on the 3D model (null: facing away, hidden or no preview) */
  pixelTo3d(x: number, y: number): [number, number] | null;
  /** The skin pixel under a client point of the 3D view, with the layer rules of paint mode */
  hit3d(clientX: number, clientY: number): { x: number; y: number; layer: string } | null;
}

export async function mountEditor(root: HTMLElement, id: string): Promise<() => void> {
  const found = await getProject<SkinProjectData>(id);
  if (!found || found.kind !== 'skin') {
    return notFound(root, t.missing.title, t.missing.text);
  }
  const project: SkinProjectData = found;
  let initial: ImageData | null = null;
  // Changes made just before the page was closed may only be in the local backup.
  let recovered = false;
  const savedModel = project.model;
  const savedName = project.name;
  const backup = readBackup(id);
  if (backup && backup.t > (project.updatedAt || 0)) {
    try {
      const img = await decodeImage(base64ToBytes(backup.png), 'png');
      if ((img.width === 64 && img.height === 64) || (img.width === 128 && img.height === 128)) {
        initial = img;
        project.model = backup.model;
        if (backup.name.trim()) project.name = backup.name.trim().slice(0, 60);
        recovered = true;
      }
    } catch {
      /* unreadable backup: fall back to the saved skin */
    }
  }
  if (recovered && initial) {
    // Nothing to announce when the backup matches what was saved anyway.
    const saved = await decodeImage(project.image, 'png').catch(() => null);
    if (saved && samePixels(saved.data, initial.data) && savedModel === project.model && savedName === project.name) recovered = false;
  }
  if (!recovered) clearBackup(id);
  if (!initial) {
    try {
      const decoded = await decodeImage(project.image, 'png');
      initial = (decoded.width === 64 && decoded.height === 64) || (decoded.width === 128 && decoded.height === 128) ? decoded : normalizeSkinImage(decoded).image;
    } catch {
      return notFound(root, t.missing.damagedTitle, t.missing.damagedText);
    }
  }

  const prefs = loadPrefs();
  const setPref = <K extends keyof Prefs>(k: K, v: Prefs[K]) => {
    prefs[k] = v;
    savePrefs(prefs);
  };
  let model: SkinModel = project.model === 'slim' ? 'slim' : 'classic';
  /** Image pixels per template texel: 1 for 64x64, 2 for HD 128x128 (follows the canvas, undo included) */
  let scale: SkinScale = scaleOf(initial.width);
  /** Width (= height) of the skin image */
  const W = () => 64 * scale;
  const locked = new Set<SkinPart>();
  const hidden = new Set<SkinPart>();
  let highlight: SkinPart | null = null;
  let hoverPixel: { x: number; y: number } | null = null;
  let hoverRect: FaceRect | null = null;
  /** What a click on the 3D model would paint (outlined on the template too) */
  let hover3d: { pixels: readonly number[]; echo: readonly number[] } | null = null;
  let preview: SkinPreview | null = null;
  let destroyed = false;
  const disposers: (() => void)[] = [];

  // =============================================================================================
  // Top bar

  const headCanvas = h('canvas', { class: 'sk-bar-head pixelated', 'aria-hidden': 'true' });
  const nameInput = h('input', {
    class: 'sk-name',
    type: 'text',
    value: project.name,
    maxLength: 60,
    spellcheck: false,
    autocomplete: 'off',
    'aria-label': t.bar.name,
  });
  const saveIcon = h('span', { class: 'sk-save-icon' }, icon('check'));
  const saveText = h('span', { class: 'sk-save-text' }, t.bar.saved);
  const saveState = h('button', { type: 'button', class: 'sk-save', dataset: { state: 'saved' }, 'aria-live': 'polite' }, saveIcon, saveText);
  const hdBadge = h('button', { type: 'button', class: 'sk-hd-badge', hidden: scale !== 2, 'aria-label': t.bar.hdBadge }, 'HD');
  tooltip(hdBadge, t.bar.hdBadgeTip);
  hdBadge.addEventListener('click', () => {
    if (layout.current() !== 'right' && window.matchMedia('(max-width: 720px)').matches) layout.show('right');
    sizeSeg.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
  });
  const undoBtn = iconButton('undo', t.bar.undo, () => pc.undo(), { disabled: true });
  const redoBtn = iconButton('redo', t.bar.redo, () => pc.redo(), { disabled: true });
  const keysBtn = iconButton('keyboard', t.bar.shortcuts, () => showShortcuts(), { class: 'sk-keys-btn' });
  const exportBtn = button({ label: t.bar.export, icon: 'download', iconEnd: 'chevron-down', variant: 'primary', class: 'sk-export-btn' });
  exportBtn.setAttribute('aria-haspopup', 'menu');
  exportBtn.setAttribute('aria-label', t.bar.export); // the label text is hidden on phones
  const totemExtra = {
    title: t.bar.totemTitle,
    sub: t.bar.totemText,
    icon: 'totem' as const,
    onPick: () =>
      void flushSave()
        .catch(() => undefined)
        .then(() => navigate(`/totem-maker?skin=${encodeURIComponent(id)}`)),
  };
  exportBtn.addEventListener('click', () => togglePopover(exportBtn, () => openExportMenu(exportBtn, (kind) => void doExport(kind), [totemExtra], { hd: scale === 2 })));
  const backBtn = iconButton('arrow-left', t.bar.allSkins, () => navigate('/skins'));

  const bar = h(
    'div',
    { class: 'sk-bar' },
    backBtn,
    h('div', { class: 'sk-bar-title' }, headCanvas, nameInput, hdBadge, saveState),
    h('div', { class: 'sk-bar-actions' }, undoBtn, redoBtn, h('span', { class: 'toolbar-sep' }), keysBtn, exportBtn),
  );

  // =============================================================================================
  // Center: canvas bar, tool rail, canvas

  const layerSeg = segmented<LayerSelection>({
    value: prefs.layers,
    label: t.canvas.layerLabel,
    size: 'sm',
    options: [
      { value: 'base', label: t.canvas.base },
      { value: 'outer', label: t.canvas.outer },
      { value: 'both', label: t.canvas.both },
    ],
    onChange: (v) => setLayers(v),
  });
  tooltip(layerSeg, t.canvas.layerTip);
  const mirrorBtn = h('button', { type: 'button', class: 'sk-toggle-btn', 'aria-pressed': String(prefs.mirror) }, icon('mirror'), h('span', null, t.canvas.mirror));
  tooltip(mirrorBtn, t.canvas.mirrorTip);
  mirrorBtn.addEventListener('click', () => setMirror(!prefs.mirror));
  const guidesBtn = iconButton('label', t.canvas.guides, () => setGuides(!prefs.guides), { active: prefs.guides });
  const gridBtn = iconButton('grid', t.canvas.grid, () => pc.setShowGrid(!pc.showGrid), { active: prefs.grid, class: 'sk-grid-btn' });
  const fitBtn = iconButton('aspect-ratio', t.canvas.fit, () => fitView());

  const workspaceSeg = segmented<'2d' | '3d'>({
    value: prefs.workspace,
    label: t.canvas.workspace,
    size: 'sm',
    options: [
      { value: '2d', label: '2D', icon: 'grid' },
      { value: '3d', label: '3D', icon: 'cube' },
    ],
    onChange: (v) => setWorkspace(v),
  });
  workspaceSeg.classList.add('sk-workspace');
  tooltip(workspaceSeg, t.canvas.workspaceTip);
  const canvasTools = h('div', { class: 'sk-tools-group' }, guidesBtn, gridBtn, fitBtn);
  const barTools = h('div', { class: 'sk-bar-tools' }, canvasTools);
  const canvasBar = h(
    'div',
    { class: 'sk-canvas-bar' },
    workspaceSeg,
    h('span', { class: 'toolbar-sep' }),
    h('div', { class: 'sk-cb-group' }, h('span', { class: 'sk-cb-label' }, t.canvas.paintOn), layerSeg),
    h('span', { class: 'toolbar-sep' }),
    mirrorBtn,
    h('span', { class: 'grow' }),
    barTools,
  );

  const toolButtons = new Map<Tool, ReturnType<typeof iconButton>>();
  const railTools = h('div', { class: 'sk-rail-tools', role: 'toolbar', 'aria-label': t.canvas.tools });
  for (const tl of TOOLS) {
    const label = t.tools[tl.text];
    const b = iconButton(tl.icon, tl.key ? `${label} (${tl.key})` : label, () => pc.setTool(tl.tool), { active: false, class: 'sk-tool' });
    b.dataset.tool = tl.tool;
    toolButtons.set(tl.tool, b);
    railTools.appendChild(b);
  }
  // The rail is one tab stop; arrow keys move between tools in whichever direction it is laid out
  // (a column, two columns, or rows on phones). Enter or Space picks the tool.
  const toolList = [...toolButtons.values()];
  railTools.addEventListener('keydown', (e) => {
    const cur = e.target as HTMLButtonElement;
    const i = toolList.indexOf(cur as (typeof toolList)[number]);
    if (i < 0) return;
    let next: HTMLElement | undefined;
    const dirs: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    const d = dirs[e.key];
    if (e.key === 'Home') next = toolList[0];
    else if (e.key === 'End') next = toolList[toolList.length - 1];
    else if (d) {
      const r0 = cur.getBoundingClientRect();
      const cx = r0.left + r0.width / 2;
      const cy = r0.top + r0.height / 2;
      let best = Infinity;
      for (const b of toolList) {
        if (b === cur) continue;
        const r = b.getBoundingClientRect();
        const dx = r.left + r.width / 2 - cx;
        const dy = r.top + r.height / 2 - cy;
        const along = dx * d[0] + dy * d[1];
        if (along < 4) continue;
        const score = along + 3 * Math.abs(d[0] ? dy : dx);
        if (score < best) {
          best = score;
          next = b;
        }
      }
      next ??= toolList[(i + (d[0] + d[1] > 0 ? 1 : toolList.length - 1)) % toolList.length];
    }
    if (!next) return;
    e.preventDefault();
    toolList.forEach((b) => (b.tabIndex = b === next ? 0 : -1));
    next.focus();
  });
  const primarySwatch = h('button', { type: 'button', class: 'sk-well sk-well-primary', 'aria-label': t.canvas.paintColour }, h('span', { class: 'sk-well-fill' }));
  const secondarySwatch = h('button', { type: 'button', class: 'sk-well sk-well-secondary', 'aria-label': t.canvas.rightColour }, h('span', { class: 'sk-well-fill' }));
  const swapBtn = h('button', { type: 'button', class: 'sk-swap', 'aria-label': t.canvas.swap }, icon('arrows-horizontal'));
  tooltip(primarySwatch, t.canvas.paintColour);
  tooltip(secondarySwatch, t.canvas.rightColourTip);
  tooltip(swapBtn, t.canvas.swap);
  const wells = h('div', { class: 'sk-wells' }, primarySwatch, secondarySwatch, swapBtn);
  const rail = h('div', { class: 'sk-rail' }, wells, railTools);

  const tip = h('div', { class: 'sk-tip', role: 'tooltip', hidden: true });
  const canvasHost = h('div', { class: 'sk-canvas-host' }, tip);
  const statusText = h('span', { class: 'sk-status-text' });
  const status = h('div', { class: 'sk-status' }, icon('info'), statusText);
  const center = h('section', { class: 'panel sk-center', 'aria-label': t.canvas.template }, canvasBar, h('div', { class: 'sk-work' }, rail, canvasHost), status);

  // =============================================================================================
  // Left: colours, brush, parts, guides

  const paletteChips = h('div', { class: 'sk-chips', role: 'group', 'aria-label': t.left.presets });
  const pickerSlot = h('div', { class: 'sk-picker-slot' });
  let picker: ReturnType<typeof colorPicker> | null = null;
  let pickerColor: RGBA = [0, 0, 0, 255];
  const buildPicker = () => {
    const group = SKIN_PALETTES.find((g) => g.id === prefs.palette) ?? SKIN_PALETTES[0];
    picker = colorPicker({
      value: pc ? pc.color : [0, 0, 0, 255],
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
    const b = h('button', { type: 'button', class: 'sk-chip', dataset: { id: g.id }, 'aria-pressed': String(g.id === prefs.palette) }, t.left.palettes[g.id]);
    b.addEventListener('click', () => {
      setPref('palette', g.id);
      buildPicker();
    });
    paletteChips.appendChild(b);
  }

  // Up to 8 px on 64x64 skins and 16 px on HD skins (the same reach on the model).
  const makeBrushSlider = (value = 1) => slider({ label: t.left.brushSize, min: 1, max: maxBrushFor(scale), step: 1, value, unit: 'px', onInput: (v) => pc.setBrushSize(v) });
  let brushSlider = makeBrushSlider();
  const brushShape = segmented<'square' | 'round'>({
    value: 'square',
    size: 'sm',
    label: t.left.brushShape,
    options: [
      { value: 'square', label: t.left.square, icon: 'rect' },
      { value: 'round', label: t.left.round, icon: 'ellipse' },
    ],
    onChange: (v) => pc.setBrushShape(v),
  });

  // Parts list
  const partRows = new Map<SkinPart, { row: HTMLElement; eye: ReturnType<typeof iconButton>; lock: ReturnType<typeof iconButton> }>();
  const partsList = h('ul', { class: 'sk-parts', 'aria-label': t.left.parts });
  for (const part of PARTS) {
    const info = PART_INFO[part];
    const eye = iconButton('eye', fmt(t.left.show3d, { part: info.label }), () => togglePartVisible(part), { size: 'sm', active: true });
    const lock = iconButton('lock', fmt(t.left.lockPart, { part: info.label }), () => toggleLock(part), { size: 'sm', active: false });
    const more = iconButton('more-horizontal', fmt(t.left.more, { part: info.label }), () => togglePopover(more, () => partMenu(part, more)), { size: 'sm' });
    more.setAttribute('aria-haspopup', 'menu');
    const row = h(
      'li',
      { class: 'sk-part', dataset: { part }, style: { '--part': info.color } },
      h('span', { class: 'sk-part-dot', 'aria-hidden': 'true' }),
      h('span', { class: 'sk-part-name' }, h('span', null, info.label), h('span', { class: 'sk-part-sub' }, `+ ${info.sub}`)),
      h('span', { class: 'sk-part-actions' }, lock, eye, more),
    );
    row.addEventListener('pointerenter', () => setHighlight(part));
    row.addEventListener('pointerleave', () => setHighlight(null));
    row.addEventListener('focusin', () => setHighlight(part));
    row.addEventListener('focusout', (e) => {
      if (!row.contains(e.relatedTarget as Node)) setHighlight(null);
    });
    partRows.set(part, { row, eye, lock });
    partsList.appendChild(row);
  }
  const resetPartsBtn = button({ label: t.left.reset, variant: 'ghost', size: 'sm', onClick: () => resetParts() });
  resetPartsBtn.hidden = true;

  const guidesToggle = toggle({ label: t.left.guidesToggle, description: t.left.guidesText, value: prefs.guides, onChange: (v) => setGuides(v) });
  const seeThroughToggle = toggle({
    label: t.left.seeThrough,
    description: t.left.seeThroughText,
    value: prefs.seeThrough,
    onChange: (v) => {
      setPref('seeThrough', v);
      applySeeThrough();
    },
  });

  const block = (title: string, cls: string, ...children: (Node | null)[]) =>
    h('section', { class: ['sk-block', cls] }, h('h3', { class: 'section-title' }, title), ...children);

  const left = h(
    'aside',
    { class: 'panel sk-left', 'aria-label': t.left.label },
    h(
      'div',
      { class: 'sk-left-scroll scroll' },
      block(t.left.colour, 'sk-block-color', paletteChips, pickerSlot),
      h(
        'section',
        { class: 'sk-block sk-block-parts' },
        h('div', { class: 'sk-block-head' }, h('h3', { class: 'section-title' }, t.left.parts), resetPartsBtn),
        h('p', { class: 'sk-block-hint' }, icon('lock', { size: 24 }), h('span', null, t.left.partsHint)),
        partsList,
      ),
      block(t.left.brush, 'sk-block-brush', brushSlider, brushShape),
      block(t.left.guides, 'sk-block-guides', guidesToggle, seeThroughToggle),
    ),
  );

  // =============================================================================================
  // Right: 3D preview

  const stage = h('div', { class: 'sk-3d' }, h('div', { class: 'sk-3d-loading' }, spinner(24)));
  const animSeg = segmented<SkinAnimation>({
    value: prefs.animation,
    size: 'sm',
    label: t.right.animation,
    options: ANIMATIONS.map((value) => ({ value, label: t.right.animations[value] })),
    onChange: (v) => {
      setPref('animation', v);
      preview?.setAnimation(v);
    },
  });
  const rotateBtn = iconButton('rotate', t.right.spin, () => {
    setPref('autoRotate', !prefs.autoRotate);
    rotateBtn.setActive(prefs.autoRotate);
    preview?.setAutoRotate(prefs.autoRotate);
  }, { size: 'sm', active: prefs.autoRotate });
  const resetCamBtn = iconButton('target', t.right.resetView, () => preview?.resetCamera(), { size: 'sm' });
  const shotBtn = iconButton('camera', t.right.picture, () => void screenshot(), { size: 'sm' });
  const modelSeg = segmented<SkinModel>({
    value: model,
    size: 'sm',
    label: t.right.armStyle,
    options: [
      { value: 'classic', label: t.right.classic },
      { value: 'slim', label: t.right.slim },
    ],
    onChange: (v) => void switchModel(v),
  });
  const layerChip = (label: string, key: 'base3d' | 'outer3d') => {
    const b = h('button', { type: 'button', class: 'sk-chip', 'aria-pressed': String(prefs[key]) }, icon(prefs[key] ? 'eye' : 'eye-off'), label);
    b.addEventListener('click', () => {
      setPref(key, !prefs[key]);
      b.setAttribute('aria-pressed', String(prefs[key]));
      b.replaceChildren(icon(prefs[key] ? 'eye' : 'eye-off'), label);
      applyLayers3d();
    });
    return b;
  };
  const backdropBtns = BACKDROPS.map((b) => {
    const name = t.right.backdrops[b.id];
    const el = h('button', { type: 'button', class: 'sk-backdrop', 'aria-label': fmt(t.right.background, { name }), 'aria-pressed': String(prefs.backdrop === b.id), style: { '--sw': b.swatch }, dataset: { id: b.id } });
    tooltip(el, name);
    el.addEventListener('click', () => {
      setPref('backdrop', b.id);
      backdropBtns.forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.id === b.id)));
      applyBackdrop();
    });
    return el;
  });
  const dollFront = h('canvas', { class: 'sk-doll pixelated', 'aria-label': t.right.frontView, role: 'img' });
  const dollBack = h('canvas', { class: 'sk-doll pixelated', 'aria-label': t.right.backView, role: 'img' });

  const stageWrap = h('div', { class: 'sk-3d-wrap', dataset: { backdrop: prefs.backdrop } }, stage, h('div', { class: 'sk-3d-anim' }, animSeg));
  // Body-part figure over the stage: a click shows or hides a part in 3D (to reach the sides of the
  // body, the inside of an arm...), a double-click or Shift+click shows only that part and turns the
  // camera around it.
  const figureButtons = new Map<SkinPart, HTMLButtonElement>();
  const figureGrid = h('div', { class: 'sk-body-toggle-grid' });
  for (const part of ['head', 'rightArm', 'body', 'leftArm', 'rightLeg', 'leftLeg'] as SkinPart[]) {
    const info = PART_INFO[part];
    const b = h('button', { type: 'button', class: 'sk-fig-part', dataset: { part }, style: { '--part': info.color }, 'aria-pressed': 'true' });
    tooltip(b, fmt(t.right.figurePart, { part: info.label }));
    b.addEventListener('click', (e) => {
      if (e.detail >= 2 || e.shiftKey) soloPart(part);
      else togglePartVisible(part);
    });
    figureButtons.set(part, b);
    figureGrid.appendChild(b);
  }
  const figureAll = h('button', { type: 'button', class: 'sk-fig-all is-off', tabIndex: -1, 'aria-hidden': 'true' }, icon('eye'), h('span', null, t.right.all));
  tooltip(figureAll, t.right.allTip);
  figureAll.addEventListener('click', () => showAllParts());
  const figure = h('div', { class: 'sk-body-toggle', role: 'group', 'aria-label': t.right.figure }, figureGrid, figureAll);

  const sizeSeg = segmented<'64' | '128'>({
    value: scale === 2 ? '128' : '64',
    size: 'sm',
    label: t.right.sizeLabel,
    options: [
      { value: '64', label: '64×64' },
      { value: '128', label: t.right.hd },
    ],
    onChange: (v) => void switchSize(v === '128' ? 128 : 64),
  });
  sizeSeg.classList.add('sk-size-seg');
  tooltip(sizeSeg, t.right.sizeTip);
  // The pose maker (its own dialog and 3D view) loads when it is opened.
  const poseBtn = button({ label: poseText.open, icon: 'human-arms-up', size: 'sm', variant: 'secondary', class: 'sk-pose-open', title: poseText.openTip, onClick: () => void openPose() });
  const viewControls = h(
    'div',
    { class: 'sk-3d-controls' },
    h('div', { class: 'sk-ctl' }, h('span', { class: 'sk-ctl-label' }, t.right.arms), modelSeg),
    h('div', { class: 'sk-ctl' }, h('span', { class: 'sk-ctl-label' }, t.right.size), sizeSeg),
    h('div', { class: 'sk-ctl' }, h('span', { class: 'sk-ctl-label' }, t.right.show), h('div', { class: 'sk-chips' }, layerChip(t.right.base, 'base3d'), layerChip(t.right.outer, 'outer3d'))),
    h('div', { class: 'sk-ctl' }, h('span', { class: 'sk-ctl-label' }, t.right.backdrop), h('div', { class: 'sk-backdrops' }, backdropBtns)),
    h('div', { class: 'sk-ctl' }, h('span', { class: 'sk-ctl-label' }, poseText.row), h('div', null, poseBtn)),
  );
  const camTools = h('div', { class: 'sk-tools-group' }, rotateBtn, resetCamBtn, shotBtn);
  const rightTitle = h('h2', null, t.right.preview);
  const openBigBtn = iconButton('expand', t.right.paintBig, () => setWorkspace('3d'), { size: 'sm' });
  const headTools = h('div', { class: 'sk-head-tools' }, camTools);
  // Holds the 2D template while the 3D model fills the main editor area.
  const templateSlot = h('div', { class: 'sk-template-slot' });
  const right = h(
    'aside',
    { class: 'panel sk-right', 'aria-label': t.right.preview, dataset: { mode: 'view' } },
    h('div', { class: 'panel-header' }, rightTitle, openBigBtn, headTools),
    templateSlot,
    stageWrap,
    viewControls,
    h('div', { class: 'sk-dolls' }, h('figure', null, dollFront, h('figcaption', null, t.right.front)), h('figure', null, dollBack, h('figcaption', null, t.right.back))),
  );

  // =============================================================================================
  // Layout

  const layout = editorLayout({
    left,
    center,
    right,
    labels: { left: t.tabs.parts, center: t.tabs.paint, right: t.tabs.model },
    icons: { left: 'human', center: 'brush', right: 'cube' },
    initial: 'center',
    onPanelChange: (p: EditorPanel) => {
      if (p === 'center') requestAnimationFrame(() => pc?.redraw());
    },
  });
  // Tablets show one side panel next to the canvas: it opens on the live 3D view, and the other tab
  // (colours, brush and parts) is called Paint there, since the canvas has no tab of its own.
  const sideLeft = layout.querySelector<HTMLElement>('.editor-sidetabs .segmented-item[data-value="left"]');
  const sideLeftText = sideLeft?.querySelector('span:not(.icon)');
  const sideLeftIcon = sideLeft?.querySelector<HTMLSpanElement>('.icon');
  if (sideLeftText) sideLeftText.textContent = t.tabs.paint;
  if (sideLeftIcon) setIcon(sideLeftIcon, 'brush');
  layout.show(prefs.side);
  layout.show('center');
  // Remember the side panel (tablet tabs and phone tabs both set data-side).
  const sideObserver = new MutationObserver(() => {
    const side = layout.dataset.side;
    if ((side === 'left' || side === 'right') && side !== prefs.side) setPref('side', side);
  });
  sideObserver.observe(layout, { attributes: true, attributeFilter: ['data-side'] });
  const editorRoot = h('div', { class: 'sk-editor' }, bar, layout);
  disposers.push(() => sideObserver.disconnect());
  root.append(editorRoot);

  // =============================================================================================
  // Pixel canvas

  const pc = new PixelCanvas(canvasHost, {
    image: initial,
    showGrid: prefs.grid,
    label: t.canvas.canvasLabel,
    mirrorMap: mirrorMapFor(model, scale),
    decodeImage: (b) => decodeImage(b),
  });
  canvasHost.appendChild(tip);
  // Arm conversions are pixel steps in the canvas history; wrap undo/redo (the canvas calls these
  // for Ctrl+Z and two-finger taps too) so the arm model follows the pixels.
  const modelSteps: { from: SkinModel; to: SkinModel; before: Uint8ClampedArray; after: Uint8ClampedArray }[] = [];
  const baseUndo = pc.undo.bind(pc);
  const baseRedo = pc.redo.bind(pc);
  pc.undo = () => {
    baseUndo();
    syncModelWithHistory('undo');
  };
  pc.redo = () => {
    baseRedo();
    syncModelWithHistory('redo');
  };
  // On narrow screens use every pixel of width: the default fit leaves generous margins.
  const fitView = () => {
    pc.zoomToFit();
    const w = canvasHost.clientWidth;
    const hh = canvasHost.clientHeight;
    if (w && w < 560) {
      // HD skins have twice the pixels: allow whole device pixels (e.g. 2.5× on a 2× screen) so they
      // still fill the width instead of dropping a whole zoom step.
      const step = scale === 2 ? Math.min(3, window.devicePixelRatio || 1) : 1;
      const snug = Math.floor(Math.min((w - 12) / W(), (hh - 12) / W()) * step) / step;
      if (snug > pc.getZoom()) pc.setZoom(snug);
    }
  };
  let firstLayout = true;
  const hostObserver = new ResizeObserver(() => {
    if (!firstLayout || !canvasHost.clientWidth) return;
    firstLayout = false;
    requestAnimationFrame(() => fitView());
  });
  hostObserver.observe(canvasHost);
  disposers.push(() => hostObserver.disconnect());
  pc.setMirror(prefs.mirror, false);
  pc.setColor(prefs.color);
  pc.setSecondaryColor([0, 0, 0, 0]);
  disposers.push(() => pc.destroy());

  const overlay = (ctx: CanvasRenderingContext2D, view: Parameters<typeof drawPartOverlay>[1]) => {
    const focus = highlight ? new Set([highlight]) : locked.size ? (prefs.mirror ? withMirrorParts(locked) : locked) : null;
    drawPartOverlay(ctx, view, {
      model,
      scale,
      outlines: prefs.guides,
      labels: prefs.guides,
      layers: prefs.layers,
      hover: prefs.guides || highlight ? hoverRect : null,
      hoverMirror: prefs.mirror && hoverRect ? mirrorFaceRect(hoverRect, model, scale) : null,
      focus,
      pointer: hoverPixel,
      theme: isLight() ? 'light' : 'dark',
    });
    if (hover3d) {
      drawPixelOutline(ctx, view, hover3d.echo, 0.6, W());
      drawPixelOutline(ctx, view, hover3d.pixels, 1, W());
    }
  };
  pc.setOverlay(overlay);
  buildPicker();

  let mask: Uint8Array = new Uint8Array(W() * W());
  const updateMask = () => {
    const parts = locked.size ? (prefs.mirror ? withMirrorParts(locked) : locked) : null;
    mask = maskForParts(parts, model, prefs.layers, scale);
    pc.setMask(mask);
    if (hoverPixel) updateHoverUi();
  };
  updateMask();

  // ---- painting on the 3D model ----
  const paint3d = createPaint3d({
    pc,
    model: () => model,
    scale: () => scale,
    layers: () => prefs.layers,
    setLayers: (v) => setLayers(v),
    mirror: () => prefs.mirror,
    setMirror: (v) => setMirror(v),
    mask: () => mask,
    lockReason: (x, y) => lockReasonAt(x, y),
    live: () => scheduleLive(),
    hover: (hit, pixels, echo) => {
      hover3d = hit ? { pixels, echo } : null;
      if (hit) {
        hoverPixel = { x: hit.x, y: hit.y };
        hoverRect = partAt(hit.x, hit.y, model, scale);
      } else if (!pointer) {
        hoverPixel = null;
        hoverRect = null;
      }
      updateHoverUi();
      pc.redraw();
    },
    openColor: (anchor) => togglePopover(anchor, () => openColorPopover(anchor, 'top-start')),
    beforeView: () => {
      if (!prefs.autoRotate) return;
      setPref('autoRotate', false);
      rotateBtn.setActive(false);
      preview?.setAutoRotate(false);
    },
    modeChanged: (on) => {
      right.dataset.mode = on ? 'paint' : 'view';
      stageWrap.dataset.mode = on ? 'paint' : 'view';
      if (on && workspace === '2d') setWorkspace('3d');
      rotateBtn.disabled = on;
      stageWrap.classList.toggle('is-painting', on);
      // Leaving paint mode: the Show chips and the see-through option apply again.
      if (!on && preview) {
        applyLayers3d();
        if (prefs.seeThrough) applySeeThrough();
      }
    },
  });
  // The mode switch and the figure share the top-left corner, stacked, so they never overlap.
  stageWrap.append(h('div', { class: 'sk-3d-side' }, paint3d.modeSwitch, figure), paint3d.views, paint3d.hint);
  stageWrap.dataset.mode = 'view';
  viewControls.after(paint3d.controls);

  // ---- 2D / 3D workspace: the chosen view fills the main editor area, the other one moves to
  // the side panel. Both views are moved, not rebuilt, so the canvas history and the WebGL view
  // stay alive; each resizes itself to its new home.
  let workspace: '2d' | '3d' = '2d';
  const work = center.querySelector<HTMLElement>('.sk-work')!;
  const status3d = center.querySelector<HTMLElement>('.sk-status')!;
  const setTabLabel = (panel: 'center' | 'right', text: string, iconName: 'brush' | 'cube' | 'grid') => {
    layout.querySelectorAll<HTMLElement>(`.editor-tab[data-panel='${panel}'], .editor-sidetabs .segmented-item[data-value='${panel}']`).forEach((tab) => {
      const label = tab.querySelector('span:not(.icon)');
      const ic = tab.querySelector<HTMLSpanElement>('.icon');
      if (label) label.textContent = text;
      if (ic) setIcon(ic, iconName);
    });
  };
  function setWorkspace(ws: '2d' | '3d'): void {
    if (ws === workspace) return;
    workspace = ws;
    setPref('workspace', ws);
    workspaceSeg.setValue(ws);
    editorRoot.dataset.workspace = ws;
    if (ws === '3d') {
      work.appendChild(stageWrap);
      templateSlot.appendChild(canvasHost);
      center.insertBefore(paint3d.controls, status3d);
      barTools.replaceChildren(camTools);
      headTools.replaceChildren(canvasTools);
      rightTitle.textContent = t.right.template;
      right.setAttribute('aria-label', t.right.template);
      center.setAttribute('aria-label', t.right.model);
      setTabLabel('center', t.tabs.model, 'cube');
      setTabLabel('right', t.tabs.template, 'grid');
      paint3d.setEnabled(true);
    } else {
      paint3d.setEnabled(false);
      work.appendChild(canvasHost);
      templateSlot.after(stageWrap);
      viewControls.after(paint3d.controls);
      barTools.replaceChildren(canvasTools);
      headTools.replaceChildren(camTools);
      rightTitle.textContent = t.right.preview;
      right.setAttribute('aria-label', t.right.preview);
      center.setAttribute('aria-label', t.canvas.template);
      setTabLabel('center', t.tabs.paint, 'brush');
      setTabLabel('right', t.tabs.model, 'cube');
    }
    if (layout.current() !== 'center' && window.matchMedia('(max-width: 720px)').matches) layout.show('center');
    requestAnimationFrame(() => {
      fitView();
      pc.redraw();
    });
  }
  editorRoot.dataset.workspace = '2d';
  if (prefs.workspace === '3d') {
    prefs.workspace = '2d';
    setWorkspace('3d');
  }

  // ---- sync UI from the canvas ----
  const syncTool = () =>
    toolButtons.forEach((b, tool) => {
      b.setActive(tool === pc.tool);
      if (!railTools.contains(document.activeElement)) b.tabIndex = tool === pc.tool ? 0 : -1;
    });
  const syncColors = () => {
    const c = pc.color;
    const s = pc.secondaryColor;
    (primarySwatch.firstElementChild as HTMLElement).style.background = `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${c[3] / 255})`;
    (secondarySwatch.firstElementChild as HTMLElement).style.background = s[3] === 0 ? '' : `rgba(${s[0]}, ${s[1]}, ${s[2]}, ${s[3] / 255})`;
    secondarySwatch.classList.toggle('is-clear', s[3] === 0);
    primarySwatch.setAttribute('aria-label', fmt(t.canvas.paintColourValue, { hex: toHex(c, c[3] < 255) }));
    if (picker && (c[0] !== pickerColor[0] || c[1] !== pickerColor[1] || c[2] !== pickerColor[2] || c[3] !== pickerColor[3])) {
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
  railTools.addEventListener('focusout', (e) => {
    if (!railTools.contains(e.relatedTarget as Node | null)) requestAnimationFrame(syncTool);
  });
  const saveColor = debounce(() => setPref('color', pc.color as Prefs['color']), 400);
  disposers.push(() => saveColor.flush());
  disposers.push(
    pc.on('tool', () => {
      syncTool();
      paint3d.sync();
    }),
    pc.on('settings', (s) => {
      syncColors();
      paint3d.sync();
      const c = pc.color;
      if (c.some((v, i) => v !== prefs.color[i])) saveColor();
      brushSlider.setValue(s.brushSize);
      brushShape.setValue(s.brushShape);
      if (s.showGrid !== prefs.grid) {
        setPref('grid', s.showGrid);
        gridBtn.setActive(s.showGrid);
      }
    }),
    pc.on('colorpick', syncColors),
    pc.on('history', syncHistory),
  );

  primarySwatch.addEventListener('click', () => togglePopover(primarySwatch, () => openColorPopover(primarySwatch)));
  const openColorPopover = (anchor: HTMLElement, placement?: 'top-start'): PopoverHandle => {
    const phone = window.matchMedia('(max-width: 720px)').matches;
    const content = h('div', { class: 'sk-color-pop' });
    const group = SKIN_PALETTES.find((g) => g.id === prefs.palette) ?? SKIN_PALETTES[0];
    const chips = h('div', { class: 'sk-chips' });
    const slot = h('div');
    const build = (gid: string) => {
      const g = SKIN_PALETTES.find((x) => x.id === gid) ?? group;
      slot.replaceChildren(
        colorPicker({
          value: pc.color,
          palette: g.colors,
          onChange: (c) => pc.setColor(c),
          onEyedropper: () => {
            pc.setTool('picker');
            pop.close();
          },
        }),
      );
      chips.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === g.id)));
    };
    for (const g of SKIN_PALETTES) {
      const b = h('button', { type: 'button', class: 'sk-chip', dataset: { id: g.id } }, t.left.palettes[g.id]);
      b.addEventListener('click', () => {
        setPref('palette', g.id);
        build(g.id);
        buildPicker();
      });
      chips.appendChild(b);
    }
    build(group.id);
    content.append(chips, slot);
    const pop = openPopover(anchor, content, { placement: placement ?? (phone ? 'top-start' : 'right-start'), label: t.canvas.paintColour, focus: true, class: 'sk-color-popover' });
    return pop;
  };
  secondarySwatch.addEventListener('click', () => {
    const s = pc.secondaryColor;
    pc.setSecondaryColor(s[3] === 0 ? pc.color : [0, 0, 0, 0]);
    toast(s[3] === 0 ? t.canvas.rightNowPaints : t.canvas.rightNowErases, { duration: 2500 });
  });
  swapBtn.addEventListener('click', () => pc.swapColors());

  // ---- hover tooltip & status ----
  let tipIndex = Math.floor(Math.random() * TIPS.length);
  const showTipText = () => {
    status.classList.remove('is-hover');
    statusText.textContent = t.tips[TIPS[tipIndex % TIPS.length]];
  };
  showTipText();
  const tipTimer = window.setInterval(() => {
    if (!hoverRect && !document.hidden) {
      tipIndex++;
      showTipText();
    }
  }, 12000);
  disposers.push(() => clearInterval(tipTimer));

  let pointer: { x: number; y: number; type: string } | null = null;
  let touchTipTimer = 0;
  const placeTip = () => {
    if (!pointer || !hoverPixel) {
      tip.hidden = true;
      return;
    }
    if (pointer.type === 'touch') {
      // Fingers cover the pixel: show the part name at the top of the canvas for a moment.
      tip.hidden = false;
      tip.style.transform = `translate(${Math.round((canvasHost.clientWidth - tip.offsetWidth) / 2)}px, 8px)`;
      clearTimeout(touchTipTimer);
      touchTipTimer = window.setTimeout(() => (tip.hidden = true), 1400);
      return;
    }
    const r = canvasHost.getBoundingClientRect();
    tip.hidden = false;
    let x = pointer.x - r.left + 16;
    let y = pointer.y - r.top + 20;
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    if (x + tw > r.width - 8) x = pointer.x - r.left - tw - 12;
    if (y + th > r.height - 8) y = pointer.y - r.top - th - 12;
    tip.style.transform = `translate(${Math.round(Math.max(4, x))}px, ${Math.round(Math.max(4, y))}px)`;
  };
  /** Why the hovered pixel can't be painted, or null when it can. */
  const lockReason = (r: FaceRect): string | null => (hoverPixel ? lockReasonAt(hoverPixel.x, hoverPixel.y, r) : null);
  /** Why a pixel can't be painted (locked part or layer), or null when it can. */
  const lockReasonAt = (x: number, y: number, r: FaceRect | null = partAt(x, y, model, scale)): string | null => {
    if (mask[y * W() + x]) return null;
    if (!r) return t.status.unused;
    if (prefs.layers !== 'both' && r.layer !== prefs.layers) {
      return prefs.layers === 'base' ? t.status.lockedBase : t.status.lockedOuter;
    }
    const open = [...(prefs.mirror ? withMirrorParts(locked) : locked)].map((p) => PART_INFO[p].label);
    return open.length ? fmt(t.status.lockedOnly, { parts: open.join(t.status.listSeparator) }) : t.status.locked;
  };
  const updateHoverUi = () => {
    if (hoverRect) {
      const text = describeRect(hoverRect);
      const reason = lockReason(hoverRect);
      tip.replaceChildren(
        h('span', { class: 'sk-tip-dot', style: { background: PART_INFO[hoverRect.part].color } }),
        h('span', { class: 'sk-tip-text' }, text, reason ? h('span', { class: 'sk-tip-lock' }, icon('lock'), reason) : null),
      );
      tip.classList.toggle('is-locked', !!reason);
      statusText.textContent = reason ? `${text} · ${reason}` : `${text} · ${hoverPixel!.x}, ${hoverPixel!.y}`;
      status.classList.add('is-hover');
    } else if (hoverPixel) {
      tip.classList.remove('is-locked');
      tip.replaceChildren(h('span', { class: 'sk-tip-dot is-unused' }), h('span', { class: 'sk-tip-text' }, t.status.unused));
      statusText.textContent = t.status.unusedLong;
      status.classList.add('is-hover');
    } else {
      showTipText();
    }
    placeTip();
  };
  const onHostMove = (e: PointerEvent) => {
    pointer = { x: e.clientX, y: e.clientY, type: e.pointerType };
    placeTip();
    if (e.buttons && preview) scheduleLive();
  };
  const onHostLeave = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return;
    pointer = null;
    tip.hidden = true;
  };
  disposers.push(() => clearTimeout(touchTipTimer));
  canvasHost.addEventListener('pointermove', onHostMove);
  canvasHost.addEventListener('pointerleave', onHostLeave);
  disposers.push(
    pc.on('hover', (p) => {
      hoverPixel = p;
      hoverRect = p ? partAt(p.x, p.y, model, scale) : null;
      updateHoverUi();
      pc.redraw();
      paint3d.showTemplateHover(p);
    }),
  );

  // ---- previews (3D, paper dolls, head) ----
  let liveRaf = 0;
  const scheduleLive = () => {
    if (liveRaf) return;
    liveRaf = requestAnimationFrame(() => {
      liveRaf = 0;
      if (destroyed) return;
      const img = pc.getImage();
      preview?.setSkin(img);
      drawDolls(img);
    });
  };
  disposers.push(() => cancelAnimationFrame(liveRaf));
  const drawDolls = (img: ImageData) => {
    // 3 CSS px per skin texel (48x96), in whole device pixels (an even number for HD, so every HD
    // pixel gets whole device pixels too).
    let s = Math.max(3, Math.round(3 * Math.min(3, window.devicePixelRatio || 1)));
    if (scale === 2) s = Math.max(4, 2 * Math.round(s / 2));
    drawPaperDoll(dollFront, img, model, 'front', s);
    drawPaperDoll(dollBack, img, model, 'back', s);
    drawHead(headCanvas, img, 32);
  };
  drawDolls(initial);

  const applyLayers3d = () => preview?.setLayers({ inner: prefs.base3d, outer: prefs.outer3d });
  const applyBackdrop = () => {
    const b = BACKDROPS.find((x) => x.id === prefs.backdrop) ?? BACKDROPS[0];
    (right.querySelector('.sk-3d-wrap') as HTMLElement).dataset.backdrop = b.id;
    preview?.setBackground(b.color);
  };
  let seeThroughWarned = false;
  const applySeeThrough = () => {
    if (!preview) return;
    const ok = setOuterSeeThrough(preview, prefs.seeThrough);
    if (!ok && prefs.seeThrough && !seeThroughWarned) {
      seeThroughWarned = true;
      toast(t.right.seeThroughMissing, { tone: 'warn' });
    }
    applyLayers3d();
  };

  void import('../skin-preview')
    .then(({ createSkinPreview }) => {
      if (destroyed) return;
      stage.replaceChildren();
      preview = createSkinPreview(stage, {
        model,
        skin: pc.getImage(),
        animation: prefs.animation,
        autoRotate: prefs.autoRotate,
        background: (BACKDROPS.find((x) => x.id === prefs.backdrop) ?? BACKDROPS[0]).color,
      });
      // Parts hidden or highlighted while the preview was still loading.
      for (const p of hidden) setPartVisible(preview, p, false);
      if (highlight) preview.setHighlight(highlight);
      applyLayers3d();
      if (prefs.seeThrough) applySeeThrough();
      paint3d.attach(preview);
      disposers.push(() => preview?.destroy());
    })
    .catch(() => {
      stage.replaceChildren(h('p', { class: 'sk-3d-error muted' }, t.right.loadFailed));
    });

  // ---- saving ----
  let version = 0;
  let savedVersion = 0;
  let saving: Promise<void> | null = null;
  let saveErrorShown = false;
  const setSaveState = (state: 'saved' | 'saving' | 'unsaved' | 'error', detail?: string) => {
    saveState.dataset.state = state;
    const map = { saved: ['check', t.bar.saved], saving: ['cloud', t.bar.saving], unsaved: ['clock', t.bar.unsaved], error: ['warning', t.bar.saveError] } as const;
    saveIcon.replaceChildren(icon(map[state][0]));
    saveText.textContent = map[state][1];
    saveState.title = detail ?? (state === 'error' ? t.bar.clickToRetry : t.bar.savedHere);
  };
  const persist = async (): Promise<void> => {
    if (saving) {
      await saving;
      if (savedVersion === version) return;
    }
    const v = version;
    setSaveState('saving');
    saving = (async () => {
      try {
        project.image = new Blob([encodePng(latest)], { type: 'image/png' });
        project.model = model;
        project.name = nameInput.value.trim() || startText.defaultName;
        await saveProject(project);
        savedVersion = v;
        if (version === v) clearBackup(id);
        if (!destroyed) setSaveState(version === v ? 'saved' : 'unsaved');
      } catch (err) {
        backupNow();
        if (!destroyed) setSaveState('error', err instanceof Error ? err.message : undefined);
        if (!saveErrorShown) {
          saveErrorShown = true;
          toast(err instanceof Error ? fmt(t.saveFailed, { error: err.message }) : t.saveFailedPlain, { tone: 'error', duration: 8000 });
        }
        throw err;
      } finally {
        saving = null;
      }
    })();
    try {
      await saving;
    } catch {
      /* state shown */
    }
    if (version !== savedVersion && !destroyed) scheduleSave();
  };
  const scheduleSave = debounce(() => void persist(), 600);
  const markDirty = () => {
    version++;
    setSaveState('unsaved');
    scheduleSave();
  };
  const flushSave = async () => {
    scheduleSave.cancel();
    if (version !== savedVersion || saving) await persist();
  };
  /** Synchronous copy of unsaved work (see readBackup); false when it could not be written. */
  const backupNow = (): boolean => {
    if (version === savedVersion) return true;
    return writeBackup(id, { png: bytesToBase64(encodePng(latest)), model, name: nameInput.value.trim() || startText.defaultName, t: Date.now() });
  };
  saveState.addEventListener('click', () => void flushSave());

  nameInput.addEventListener('input', () => markDirty());
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') nameInput.blur();
  });
  nameInput.addEventListener('blur', () => {
    if (!nameInput.value.trim()) {
      nameInput.value = startText.defaultName;
      markDirty();
    }
  });

  let latest: ImageData = initial;
  let holes = countBaseHoles(initial, model);
  let holesTipShown = false;
  const onImageChanged = (img: ImageData) => {
    latest = img;
    // Making a skin HD (or 64x64), and undoing that, changes the canvas size.
    syncSize();
    preview?.setSkin(img);
    drawDolls(img);
    markDirty();
    const nextHoles = countBaseHoles(img, model);
    // Bedrock (the only place HD skins show) allows see-through base pixels, so no tip for HD.
    if (nextHoles > holes && !holesTipShown && pc.tool === 'eraser' && scale === 1) {
      holesTipShown = true;
      toast(t.holes, { tone: 'info', duration: 7000 });
    }
    holes = nextHoles;
  };
  disposers.push(pc.on('change', onImageChanged));

  const onPageHide = () => {
    backupNow();
    void flushSave();
  };
  const onVisibility = () => {
    if (document.visibilityState !== 'hidden') return;
    backupNow();
    void flushSave();
  };
  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (version === savedVersion) return;
    const safe = backupNow();
    void flushSave();
    // Only ask "Leave site?" when not even the local backup could be written.
    if (!safe) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  window.addEventListener('pagehide', onPageHide);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('beforeunload', onBeforeUnload);
  disposers.push(() => {
    window.removeEventListener('pagehide', onPageHide);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('beforeunload', onBeforeUnload);
  });

  // =============================================================================================
  // Actions

  function setLayers(v: LayerSelection) {
    setPref('layers', v);
    layerSeg.setValue(v);
    updateMask();
    pc.redraw();
    paint3d.sync();
  }

  function setMirror(v: boolean) {
    setPref('mirror', v);
    mirrorBtn.setAttribute('aria-pressed', String(v));
    pc.setMirror(v, false);
    updateMask();
    pc.redraw();
    paint3d.sync();
  }

  function setGuides(v: boolean) {
    setPref('guides', v);
    guidesBtn.setActive(v);
    guidesToggle.setValue(v);
    pc.redraw();
  }

  function setHighlight(part: SkinPart | null) {
    if (highlight === part) return;
    highlight = part;
    preview?.setHighlight(part);
    partRows.forEach((r, p) => r.row.classList.toggle('is-highlight', p === part));
    pc.redraw();
  }

  function syncPartsUi() {
    partRows.forEach((r, p) => {
      const isLocked = locked.has(p);
      const isHidden = hidden.has(p);
      r.lock.setActive(isLocked);
      r.lock.setIcon(isLocked ? 'lock' : 'unlock');
      r.eye.setActive(!isHidden);
      r.eye.setIcon(isHidden ? 'eye-off' : 'eye');
      r.row.classList.toggle('is-locked', isLocked);
      r.row.classList.toggle('is-hidden', isHidden);
    });
    resetPartsBtn.hidden = locked.size === 0 && hidden.size === 0;
    figureButtons.forEach((b, p) => {
      const shown = !hidden.has(p);
      b.setAttribute('aria-pressed', String(shown));
      b.setAttribute('aria-label', fmt(shown ? t.right.figureShown : t.right.figureHidden, { part: PART_INFO[p].label }));
      b.classList.toggle('is-focus', focusedPart === p);
    });
    // The figure is pinned to the top, so showing or hiding "All" below it never moves a part.
    const none = hidden.size === 0;
    figureAll.classList.toggle('is-off', none);
    figureAll.tabIndex = none ? -1 : 0;
    figureAll.setAttribute('aria-hidden', String(none));
  }

  /** Part the camera turns around (after "show only"); null = the whole player */
  let focusedPart: SkinPart | null = null;
  function setFocus(part: SkinPart | null) {
    if (focusedPart === part) return;
    focusedPart = part;
    preview?.focusPart(part);
  }

  /** Shows only one part in 3D and frames the camera on it, so every side can be turned to. */
  function soloPart(part: SkinPart) {
    for (const p of PARTS) {
      if (p === part) hidden.delete(p);
      else hidden.add(p);
      if (preview) setPartVisible(preview, p, p === part);
    }
    if (preview) applyLayers3d();
    setFocus(part);
    syncPartsUi();
    statusText.textContent = upperFirst(fmt(t.status.showingOnly, { part: PART_INFO[part].it }));
  }

  function showAllParts() {
    for (const p of hidden) if (preview) setPartVisible(preview, p, true);
    hidden.clear();
    if (preview) applyLayers3d();
    setFocus(null);
    syncPartsUi();
  }

  let visibilityWarned = false;
  function togglePartVisible(part: SkinPart) {
    if (hidden.has(part)) hidden.delete(part);
    else hidden.add(part);
    if (focusedPart && (hidden.has(focusedPart) || hidden.size === 0)) setFocus(null);
    if (preview) {
      const ok = setPartVisible(preview, part, !hidden.has(part));
      if (!ok && !visibilityWarned) {
        visibilityWarned = true;
        toast(t.right.hidingMissing, { tone: 'warn' });
      }
      applyLayers3d();
    }
    syncPartsUi();
  }

  function toggleLock(part: SkinPart) {
    if (locked.has(part)) locked.delete(part);
    else locked.add(part);
    updateMask();
    syncPartsUi();
    pc.redraw();
    if (locked.size) statusText.textContent = fmt(t.status.paintingInside, { parts: [...(prefs.mirror ? withMirrorParts(locked) : locked)].map((p) => PART_INFO[p].label).join(t.status.listSeparator) });
  }

  function resetParts() {
    locked.clear();
    for (const p of hidden) if (preview) setPartVisible(preview, p, true);
    hidden.clear();
    setFocus(null);
    applyLayers3d();
    updateMask();
    syncPartsUi();
    pc.redraw();
  }

  /** Undo from a toast: only steps back while nothing else was painted since `after`. */
  function undoIfUnchanged(after: Uint8ClampedArray) {
    if (samePixels(pc.getImage().data, after)) pc.undo();
    else toast(t.paintedSince, { duration: 3500 });
  }

  function applyImageOp(label: string, fn: (img: ImageData) => ImageData) {
    pc.deselect();
    pc.applyFilter(fn);
    const after = pc.getImage().data;
    toast(label, { tone: 'success', duration: 3500, action: { label: t.undo, onClick: () => undoIfUnchanged(after) } });
  }

  function partMenu(part: SkinPart, anchor: HTMLElement): PopoverHandle {
    const info = PART_INFO[part];
    const other = PART_INFO[info.mirror];
    const layer = prefs.layers === 'outer' ? 'outer' : 'base';
    const c = pc.color;
    const items = [
      {
        label: upperFirst(fmt(t.partMenu.fill, { part: layer === 'outer' ? info.outerIt : info.it })),
        icon: 'fill' as IconName,
        onClick: () => applyImageOp(upperFirst(fmt(t.partMenu.filled, { part: info.it })), (img) => fillPart(img, part, layer, model, [c[0], c[1], c[2], layer === 'base' ? 255 : c[3]])),
      },
      ...(info.mirror !== part
        ? [
            {
              label: upperFirst(fmt(t.partMenu.copyTo, { part: other.it })),
              icon: 'mirror' as IconName,
              onClick: () => applyImageOp(upperFirst(fmt(t.partMenu.copied, { part: info.it, other: other.it })), (img) => copyToMirror(img, part, model)),
            },
          ]
        : []),
      {
        label: upperFirst(fmt(t.partMenu.clear, { part: info.outerIt })),
        icon: 'eraser' as IconName,
        onClick: () => applyImageOp(upperFirst(fmt(t.partMenu.cleared, { part: info.outerIt })), (img) => fillPart(img, part, 'outer', model, null)),
      },
      {
        label: upperFirst(fmt(t.partMenu.showOnly, { part: info.it })),
        icon: 'eye' as IconName,
        onClick: () => soloPart(part),
      },
      ...(hidden.size
        ? [
            {
              label: t.partMenu.showAll,
              icon: 'eye' as IconName,
              onClick: () => showAllParts(),
            },
          ]
        : []),
    ];
    return openMenu(anchor, items, { label: fmt(t.partMenu.actions, { part: info.label }) });
  }

  async function switchModel(to: SkinModel) {
    if (to === model) return;
    const from = model;
    const text = to === 'slim' ? t.arms.toSlim : t.arms.toClassic;
    const answer = await choose<'convert' | 'switch'>(
      to === 'slim' ? t.arms.toSlimTitle : t.arms.toClassicTitle,
      h('div', { class: 'stack' }, h('p', null, text), h('p', { class: 'muted small' }, t.arms.undoLater)),
      [
        { value: 'switch', label: t.arms.justSwitch, variant: 'ghost' },
        { value: 'convert', label: t.arms.convert, variant: 'primary' },
      ],
    );
    if (!answer) {
      modelSeg.setValue(model);
      return;
    }
    let after: Uint8ClampedArray | null = null;
    if (answer === 'convert') after = convertAndSwitch(from, to);
    else {
      setModel(to);
      markDirty();
    }
    toast(to === 'slim' ? t.arms.switchedSlim : t.arms.switchedClassic, {
      tone: 'success',
      duration: 5000,
      action: {
        label: t.undo,
        onClick: () => {
          if (model !== to) return;
          if (!after) {
            setModel(from);
            markDirty();
          } else if (samePixels(pc.getImage().data, after)) {
            pc.undo(); // the history hook below switches the model back too
          } else {
            convertAndSwitch(to, from); // painted since: convert back, keeping the new paint
          }
        },
      },
    });
  }

  /**
   * Converts the arm pixels as one undoable step and switches the model. The step is remembered so
   * undo/redo (buttons, Ctrl+Z, two-finger tap) also switch the model back and forth with it.
   */
  function convertAndSwitch(from: SkinModel, to: SkinModel): Uint8ClampedArray {
    const before = pc.getImage();
    const converted = convertArms(before, from, to);
    pc.setImage(converted, { resetHistory: false, resetView: false });
    modelSteps.push({ from, to, before: before.data, after: converted.data });
    if (modelSteps.length > 32) modelSteps.shift();
    setModel(to);
    onImageChanged(pc.getImage());
    return converted.data;
  }

  function setModel(m: SkinModel) {
    if (m === model) return;
    model = m;
    project.model = m;
    afterModelChange();
    drawDolls(latest);
  }

  /** After an undo/redo: the pixel layout decides the arm model when it matches a conversion step. */
  function syncModelWithHistory(dir: 'undo' | 'redo') {
    const cur = pc.getImage().data;
    for (let i = modelSteps.length - 1; i >= 0; i--) {
      const st = modelSteps[i];
      if (dir === 'undo' && model === st.to && samePixels(cur, st.before)) return setModel(st.from);
      if (dir === 'redo' && model === st.from && samePixels(cur, st.after)) return setModel(st.to);
    }
  }

  function afterModelChange() {
    modelSeg.setValue(model);
    pc.setMirrorMap(mirrorMapFor(model, scale));
    preview?.setModel(model);
    updateMask();
    hoverRect = hoverPixel ? partAt(hoverPixel.x, hoverPixel.y, model, scale) : null;
    pc.redraw();
    paint3d.sync();
  }

  /** Follows the canvas size (HD or not): layout tables, mask, brush range and controls. */
  function syncSize(): void {
    const next = scaleOf(pc.width);
    if (next === scale) return;
    scale = next;
    pc.setMirrorMap(mirrorMapFor(model, scale));
    hoverPixel = null;
    hoverRect = null;
    hover3d = null;
    updateMask();
    sizeSeg.setValue(scale === 2 ? '128' : '64');
    hdBadge.hidden = scale !== 2;
    if (pc.brushSize > maxBrushFor(scale)) pc.setBrushSize(maxBrushFor(scale));
    const fresh = makeBrushSlider(pc.brushSize);
    brushSlider.replaceWith(fresh);
    brushSlider = fresh;
    paint3d.sync();
    pc.redraw();
    requestAnimationFrame(() => fitView());
  }

  /** A figure of a skin for the size dialogs. */
  function sizeFigure(img: ImageData, label: string): HTMLElement {
    const c = h('canvas', { class: 'sk-figure', 'aria-hidden': 'true' });
    requestAnimationFrame(() => drawFigure(c, img, model));
    return h('figure', { class: 'sk-export-figure' }, h('div', { class: 'sk-export-stage' }, c), h('figcaption', null, label));
  }

  /** Makes the skin HD (every pixel doubled) or reduces it to 64x64, as one undoable step. */
  async function switchSize(to: SkinSize) {
    const current: SkinSize = scale === 2 ? 128 : 64;
    if (to === current) return;
    const img = pc.getImage();
    const reduced = to === 64 ? resizeSkin(img, 64) : null;
    const lost = to === 64 ? hdLossPercent(img) : 0;
    const body =
      to === 128
        ? h(
            'div',
            { class: 'stack' },
            h('p', null, t.size.hdText),
            h('p', { class: 'sk-note' }, icon('smartphone'), h('span', null, h('strong', null, t.size.hdStrong), t.size.hdNote)),
            h('p', { class: 'muted small' }, t.arms.undoLater),
          )
        : h(
            'div',
            { class: 'stack sk-export' },
            h('div', { class: 'sk-export-compare' }, sizeFigure(img, startText.pick.hd), h('span', { class: 'sk-export-arrow' }, icon('arrow-right')), sizeFigure(reduced!, '64×64')),
            lost
              ? h('p', { class: 'sk-note is-warn' }, icon('warning'), h('span', null, fmt(t.size.lost, { percent: lost })))
              : h('p', { class: 'sk-note' }, icon('check'), h('span', null, t.size.nothingLost)),
            h('p', { class: 'muted small' }, t.size.javaOnly),
          );
    const answer = await choose<'go' | 'cancel'>(to === 128 ? t.size.makeHdTitle : t.size.reduceTitle, body, [
      { value: 'cancel', label: kit.cancel, variant: 'ghost' },
      { value: 'go', label: to === 128 ? t.size.makeHd : t.size.reduce, variant: 'primary' },
    ]);
    if (answer !== 'go' || destroyed) {
      sizeSeg.setValue(current === 128 ? '128' : '64');
      return;
    }
    pc.deselect();
    pc.applyFilter((src) => resizeSkin(src, to));
    const after = pc.getImage().data;
    toast(to === 128 ? t.size.nowHd : t.size.reduced, {
      tone: 'success',
      duration: 5000,
      action: { label: t.undo, onClick: () => undoIfUnchanged(after) },
    });
  }

  async function screenshot() {
    if (!preview) return;
    try {
      const blob = await preview.screenshot();
      saveBlob(blob, `${nameInput.value.trim() || 'skin'}-3d.png`);
      toast(t.right.pictureSaved, { tone: 'success' });
    } catch (err) {
      toast(err instanceof Error ? err.message : t.right.pictureFailed, { tone: 'error' });
    }
  }

  async function openPose() {
    try {
      const { openPoseStudio } = await import('./pose-studio');
      if (destroyed) return;
      openPoseStudio({ image: pc.getImage(), model, name: nameInput.value.trim() || startText.defaultName });
    } catch {
      toast(t.right.loadFailed, { tone: 'error' });
    }
  }

  async function doExport(kind: Parameters<typeof exportSkin>[0]) {
    project.name = nameInput.value.trim() || startText.defaultName;
    project.model = model;
    await exportSkin(kind, project, pc.getImage(), () => (destroyed ? void persist() : markDirty()), () => !destroyed);
  }

  function showShortcuts() {
    const s = t.shortcuts;
    const k = s.keys;
    openShortcutsSheet([
      {
        title: s.tools,
        items: [
          { keys: ['B'], label: t.tools.pencil },
          { keys: ['E'], label: t.tools.eraser },
          { keys: ['G'], label: t.tools.fill },
          { keys: ['I'], label: t.tools.picker },
          { keys: ['Alt'], label: s.pickHeld },
          { keys: ['L'], label: t.tools.line },
          { keys: ['U'], label: s.rectAgain },
          { keys: ['O'], label: t.tools.ellipse },
          { keys: ['M'], label: t.tools.select },
          { keys: ['V'], label: t.tools.move },
        ],
      },
      {
        title: s.skin,
        items: [
          { keys: ['Y'], label: s.mirror },
          { keys: ['1'], label: s.base },
          { keys: ['2'], label: s.outer },
          { keys: ['3'], label: s.both },
          { keys: ['P'], label: s.guides },
          { keys: ['D'], label: s.paint3d },
          { keys: ['H'], label: s.flip },
          { keys: ['R'], label: s.rotate },
        ],
      },
      {
        title: s.colourBrush,
        items: [
          { keys: ['X'], label: s.swap },
          { keys: [k.rightClick], label: s.second },
          { keys: ['['], label: s.smaller },
          { keys: [']'], label: s.bigger },
          { keys: ['Shift', k.click], label: s.straight },
        ],
      },
      {
        title: s.editView,
        items: [
          { keys: ['Mod', 'Z'], label: s.undo },
          { keys: ['Mod', 'Shift', 'Z'], label: s.redo },
          { keys: ['Mod', 'S'], label: s.save },
          { keys: ['0'], label: s.fit },
          { keys: ['+'], label: s.zoomIn },
          { keys: ['-'], label: s.zoomOut },
          { keys: ['#'], label: s.grid },
          { keys: [k.space], label: s.pan },
          { keys: ['?'], label: s.list },
        ],
      },
      {
        title: s.on3d,
        items: [
          { keys: [k.drag], label: s.drag3d },
          { keys: [k.rightDrag], label: s.turn },
          { keys: [k.space, k.drag], label: s.turnAlt },
          { keys: [k.wheel], label: s.wheelZoom },
          { keys: [k.arrows], label: s.turnPlayer },
          { keys: [k.home], label: s.resetView },
        ],
      },
    ], s.title);
  }

  // ---- keyboard ----
  const modalOpen = () => !!document.querySelector('dialog[open]');
  const onKeyCapture = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target) || modalOpen()) return;
    const k = e.key.toLowerCase();
    // Flipping or rotating the whole template scrambles the skin; only allow it on a selection.
    if ((k === 'h' || k === 'r') && !pc.getSelection() && editorRoot.isConnected) {
      e.preventDefault();
      toast(t.selectFirst, { duration: 3500 });
    }
  };
  const onKey = (e: KeyboardEvent) => {
    if (!editorRoot.isConnected) return;
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      void flushSave().then(() => toast(t.savedNow, { tone: 'success', duration: 1500 }));
      return;
    }
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target) || modalOpen()) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest?.('[role="menu"], [role="listbox"], [role="slider"]')) return;
    let handled = true;
    switch (e.key) {
      case '?':
        showShortcuts();
        break;
      case 'y':
      case 'Y':
        setMirror(!prefs.mirror);
        toast(prefs.mirror ? t.mirrorOn : t.mirrorOff, { duration: 1800 });
        break;
      case '1':
        setLayers('base');
        break;
      case '2':
        setLayers('outer');
        break;
      case '3':
        setLayers('both');
        break;
      case 'p':
      case 'P':
        setGuides(!prefs.guides);
        break;
      case 'd':
      case 'D':
        if (workspace === '2d') setWorkspace('3d');
        else paint3d.setEnabled(!paint3d.enabled());
        break;
      default:
        handled = false;
    }
    if (handled) e.preventDefault();
  };
  window.addEventListener('keydown', onKeyCapture, true);
  window.addEventListener('keydown', onKey);
  disposers.push(() => {
    window.removeEventListener('keydown', onKeyCapture, true);
    window.removeEventListener('keydown', onKey);
  });

  // Theme changes recolour the overlay tags.
  const themeObserver = new MutationObserver(() => pc.redraw());
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  disposers.push(() => themeObserver.disconnect());

  syncPartsUi();
  syncHistory();

  // Test and debugging hook (read-only helpers).
  const api: SkinEditorTestApi = {
    getImage: () => pc.getImage(),
    size: () => pc.width,
    imageToClient: (x, y) => {
      const v = pc.getView();
      const r = pc.element.getBoundingClientRect();
      return [r.left + v.offsetX + (x + 0.5) * v.scale, r.top + v.offsetY + (y + 0.5) * v.scale];
    },
    model: () => model,
    flush: () => flushSave(),
    paint3d: () => paint3d.enabled(),
    pixelTo3d: (x, y) => preview?.pixelToClient(x, y) ?? null,
    hit3d: (cx, cy) => {
      const hit = preview?.hitTest(cx, cy);
      return hit ? { x: hit.x, y: hit.y, layer: hit.layer } : null;
    },
  };
  Object.defineProperty(editorRoot, '__skinEditor', { value: api });

  if (recovered) {
    markDirty();
    toast(t.restored, { tone: 'success', duration: 5000 });
  }

  return () => {
    destroyed = true;
    backupNow();
    void flushSave();
    for (const d of disposers.splice(0).reverse()) {
      try {
        d();
      } catch {
        /* ignore */
      }
    }
    canvasHost.removeEventListener('pointermove', onHostMove);
    canvasHost.removeEventListener('pointerleave', onHostLeave);
  };
}
