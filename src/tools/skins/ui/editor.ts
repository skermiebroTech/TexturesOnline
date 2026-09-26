// Skin editor: tool rail + 64x64 pixel canvas with part guides, colours and parts on the left, live
// 3D preview on the right. Autosaves to IndexedDB.

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
import { icon, type IconName } from '../../../ui/icons';
import { openModal, openShortcutsSheet } from '../../../ui/modal';
import { toast } from '../../../ui/toast';
import type { SkinAnimation, SkinPreview } from '../skin-preview';
import { exportSkin, openExportMenu } from './export-modal';
import type { SkinProjectData } from '../export';
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
  withMirrorParts,
  type FaceRect,
  type LayerSelection,
  type SkinPart,
} from '../templates';
import { drawHead, drawPaperDoll } from './figure';
import { SKIN_PALETTES } from './palettes';
import { normalizeSkinImage } from './sources';
import { setOuterSeeThrough, setPartVisible } from './preview-extras';

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
};

function loadPrefs(): Prefs {
  const defaults: Prefs = { ...DEFAULT_PREFS, animation: prefersReducedMotion() ? 'none' : DEFAULT_PREFS.animation };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...defaults, ...(JSON.parse(raw) as Partial<Prefs>) } : defaults;
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

const TOOLS: { tool: Tool; icon: IconName; label: string; key?: string }[] = [
  { tool: 'pencil', icon: 'pencil', label: 'Pencil', key: 'B' },
  { tool: 'eraser', icon: 'eraser', label: 'Eraser', key: 'E' },
  { tool: 'fill', icon: 'fill', label: 'Fill', key: 'G' },
  { tool: 'picker', icon: 'pipette', label: 'Pick a colour', key: 'I' },
  { tool: 'line', icon: 'line', label: 'Line', key: 'L' },
  { tool: 'rect', icon: 'rect', label: 'Rectangle', key: 'U' },
  { tool: 'rect-fill', icon: 'rect-fill', label: 'Filled rectangle', key: 'U' },
  { tool: 'ellipse', icon: 'ellipse', label: 'Ellipse', key: 'O' },
  { tool: 'lighten', icon: 'sun', label: 'Lighten (shading)' },
  { tool: 'darken', icon: 'moon', label: 'Darken (shading)' },
  { tool: 'noise', icon: 'noise', label: 'Noise (texture)' },
  { tool: 'select', icon: 'select', label: 'Select', key: 'M' },
  { tool: 'move', icon: 'move', label: 'Move', key: 'V' },
];

const BACKDROPS: { id: string; label: string; color: string | null; swatch: string }[] = [
  { id: 'studio', label: 'Studio (transparent)', color: null, swatch: 'transparent' },
  { id: 'sky', label: 'Sky', color: '#8ec5ff', swatch: '#8ec5ff' },
  { id: 'night', label: 'Night', color: '#11141c', swatch: '#11141c' },
  { id: 'paper', label: 'Light', color: '#eef1f6', swatch: '#eef1f6' },
];

const ANIMATIONS: { value: SkinAnimation; label: string }[] = [
  { value: 'idle', label: 'Idle' },
  { value: 'walk', label: 'Walk' },
  { value: 'run', label: 'Run' },
  { value: 'none', label: 'Still' },
];

const TIPS = [
  'Hover the template to see which part and face you are painting.',
  'Turn on Mirror to paint both arms or both legs at once.',
  'Paint hats, jackets and sleeves on the Outer layer — it can be see-through.',
  'Lock a part in the Parts list so you can’t paint outside it.',
  'Shading tip: use Lighten and Darken to add depth.',
  'Press ? to see every keyboard shortcut.',
];

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
        action: button({ label: 'All skins', icon: 'arrow-left', variant: 'primary', onClick: () => navigate('/skins') }),
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

export interface SkinEditorTestApi {
  getImage(): ImageData;
  imageToClient(x: number, y: number): [number, number];
  model(): SkinModel;
  flush(): Promise<void>;
}

export async function mountEditor(root: HTMLElement, id: string): Promise<() => void> {
  const found = await getProject<SkinProjectData>(id);
  if (!found || found.kind !== 'skin') {
    return notFound(root, 'Skin not found', 'This skin is not saved in this browser. It may have been deleted, or it was made on another device.');
  }
  const project: SkinProjectData = found;
  let initial: ImageData;
  try {
    const decoded = await decodeImage(project.image, 'png');
    initial = decoded.width === 64 && decoded.height === 64 ? decoded : normalizeSkinImage(decoded).image;
  } catch {
    return notFound(root, "This skin can't be opened", 'The saved image is damaged. Try making a new skin.');
  }

  const prefs = loadPrefs();
  const setPref = <K extends keyof Prefs>(k: K, v: Prefs[K]) => {
    prefs[k] = v;
    savePrefs(prefs);
  };
  let model: SkinModel = project.model === 'slim' ? 'slim' : 'classic';
  const locked = new Set<SkinPart>();
  const hidden = new Set<SkinPart>();
  let highlight: SkinPart | null = null;
  let hoverPixel: { x: number; y: number } | null = null;
  let hoverRect: FaceRect | null = null;
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
    'aria-label': 'Skin name',
  });
  const saveIcon = h('span', { class: 'sk-save-icon' }, icon('check'));
  const saveText = h('span', { class: 'sk-save-text' }, 'Saved');
  const saveState = h('button', { type: 'button', class: 'sk-save', dataset: { state: 'saved' }, 'aria-live': 'polite' }, saveIcon, saveText);
  const undoBtn = iconButton('undo', 'Undo (Ctrl+Z)', () => pc.undo(), { disabled: true });
  const redoBtn = iconButton('redo', 'Redo (Ctrl+Shift+Z)', () => pc.redo(), { disabled: true });
  const keysBtn = iconButton('keyboard', 'Keyboard shortcuts (?)', () => showShortcuts());
  const exportBtn = button({ label: 'Export', icon: 'download', iconEnd: 'chevron-down', variant: 'primary', class: 'sk-export-btn' });
  exportBtn.setAttribute('aria-haspopup', 'menu');
  exportBtn.addEventListener('click', () => openExportMenu(exportBtn, (kind) => void doExport(kind)));
  const backBtn = iconButton('arrow-left', 'All skins', () => navigate('/skins'));

  const bar = h(
    'div',
    { class: 'sk-bar' },
    backBtn,
    h('div', { class: 'sk-bar-title' }, headCanvas, nameInput, saveState),
    h('div', { class: 'sk-bar-actions' }, undoBtn, redoBtn, h('span', { class: 'toolbar-sep' }), keysBtn, exportBtn),
  );

  // =============================================================================================
  // Center: canvas bar, tool rail, canvas

  const layerSeg = segmented<LayerSelection>({
    value: prefs.layers,
    label: 'Layer to paint on',
    size: 'sm',
    options: [
      { value: 'base', label: 'Base' },
      { value: 'outer', label: 'Outer' },
      { value: 'both', label: 'Both' },
    ],
    onChange: (v) => setLayers(v),
  });
  tooltip(layerSeg, 'Which layer to paint on (1 / 2 / 3)');
  const mirrorBtn = h('button', { type: 'button', class: 'sk-toggle-btn', 'aria-pressed': String(prefs.mirror) }, icon('mirror'), h('span', null, 'Mirror'));
  tooltip(mirrorBtn, 'Mirror: paint both arms or both legs at once (Y)');
  mirrorBtn.addEventListener('click', () => setMirror(!prefs.mirror));
  const guidesBtn = iconButton('label', 'Part guides (P)', () => setGuides(!prefs.guides), { active: prefs.guides });
  const gridBtn = iconButton('grid', 'Pixel grid (#)', () => pc.setShowGrid(!pc.showGrid), { active: prefs.grid });
  const fitBtn = iconButton('aspect-ratio', 'Fit to screen (0)', () => fitView());

  const canvasBar = h(
    'div',
    { class: 'sk-canvas-bar' },
    h('div', { class: 'sk-cb-group' }, h('span', { class: 'sk-cb-label' }, 'Paint on'), layerSeg),
    h('span', { class: 'toolbar-sep' }),
    mirrorBtn,
    h('span', { class: 'grow' }),
    guidesBtn,
    gridBtn,
    fitBtn,
  );

  const toolButtons = new Map<Tool, ReturnType<typeof iconButton>>();
  const railTools = h('div', { class: 'sk-rail-tools', role: 'toolbar', 'aria-label': 'Drawing tools' });
  for (const t of TOOLS) {
    const b = iconButton(t.icon, t.key ? `${t.label} (${t.key})` : t.label, () => pc.setTool(t.tool), { active: false, class: 'sk-tool' });
    b.dataset.tool = t.tool;
    toolButtons.set(t.tool, b);
    railTools.appendChild(b);
  }
  const primarySwatch = h('button', { type: 'button', class: 'sk-well sk-well-primary', 'aria-label': 'Paint colour' }, h('span', { class: 'sk-well-fill' }));
  const secondarySwatch = h('button', { type: 'button', class: 'sk-well sk-well-secondary', 'aria-label': 'Right-click colour' }, h('span', { class: 'sk-well-fill' }));
  const swapBtn = h('button', { type: 'button', class: 'sk-swap', 'aria-label': 'Swap colours (X)' }, icon('arrows-horizontal'));
  tooltip(primarySwatch, 'Paint colour');
  tooltip(secondarySwatch, 'Right-click colour (transparent = erase)');
  tooltip(swapBtn, 'Swap colours (X)');
  const wells = h('div', { class: 'sk-wells' }, primarySwatch, secondarySwatch, swapBtn);
  const rail = h('div', { class: 'sk-rail' }, wells, railTools);

  const tip = h('div', { class: 'sk-tip', role: 'tooltip', hidden: true });
  const canvasHost = h('div', { class: 'sk-canvas-host' }, tip);
  const statusText = h('span', { class: 'sk-status-text' });
  const status = h('div', { class: 'sk-status' }, icon('info'), statusText);
  const center = h('section', { class: 'panel sk-center', 'aria-label': 'Skin template' }, canvasBar, h('div', { class: 'sk-work' }, rail, canvasHost), status);

  // =============================================================================================
  // Left: colours, brush, parts, guides

  const paletteChips = h('div', { class: 'sk-chips', role: 'group', 'aria-label': 'Colour presets' });
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
    const b = h('button', { type: 'button', class: 'sk-chip', dataset: { id: g.id }, 'aria-pressed': String(g.id === prefs.palette) }, g.label);
    b.addEventListener('click', () => {
      setPref('palette', g.id);
      buildPicker();
    });
    paletteChips.appendChild(b);
  }

  const brushSlider = slider({ label: 'Brush size', min: 1, max: 8, step: 1, value: 1, unit: 'px', onInput: (v) => pc.setBrushSize(v) });
  const brushShape = segmented<'square' | 'round'>({
    value: 'square',
    size: 'sm',
    label: 'Brush shape',
    options: [
      { value: 'square', label: 'Square', icon: 'rect' },
      { value: 'round', label: 'Round', icon: 'ellipse' },
    ],
    onChange: (v) => pc.setBrushShape(v),
  });

  // Parts list
  const partRows = new Map<SkinPart, { row: HTMLElement; eye: ReturnType<typeof iconButton>; lock: ReturnType<typeof iconButton> }>();
  const partsList = h('ul', { class: 'sk-parts', 'aria-label': 'Body parts' });
  for (const part of PARTS) {
    const info = PART_INFO[part];
    const eye = iconButton('eye', `Show ${info.label} in 3D`, () => togglePartVisible(part), { size: 'sm', active: true });
    const lock = iconButton('lock', `Only paint the ${info.label}`, () => toggleLock(part), { size: 'sm', active: false });
    const more = iconButton('more-horizontal', `More for ${info.label}`, () => partMenu(part, more), { size: 'sm' });
    more.setAttribute('aria-haspopup', 'menu');
    const row = h(
      'li',
      { class: 'sk-part', dataset: { part }, style: { '--part': info.color } },
      h('span', { class: 'sk-part-dot', 'aria-hidden': 'true' }),
      h('span', { class: 'sk-part-name' }, h('span', null, info.label), h('span', { class: 'sk-part-sub' }, `+ ${info.outerLabel.replace(/^(Left|Right) /, '').toLowerCase()}`)),
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
  const resetPartsBtn = button({ label: 'Reset', variant: 'ghost', size: 'sm', onClick: () => resetParts() });
  resetPartsBtn.hidden = true;

  const guidesToggle = toggle({ label: 'Part guides', description: 'Outlines and names on the template.', value: prefs.guides, onChange: (v) => setGuides(v) });
  const seeThroughToggle = toggle({
    label: 'See-through outer layer',
    description: 'In 3D, so you can see the base layer under hats and jackets.',
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
    { class: 'panel sk-left', 'aria-label': 'Colours and parts' },
    h(
      'div',
      { class: 'sk-left-scroll scroll' },
      block('Colour', 'sk-block-color', paletteChips, pickerSlot),
      block('Brush', 'sk-block-brush', brushSlider, brushShape),
      h(
        'section',
        { class: 'sk-block sk-block-parts' },
        h('div', { class: 'sk-block-head' }, h('h3', { class: 'section-title' }, 'Body parts'), resetPartsBtn),
        h('p', { class: 'sk-block-hint' }, icon('lock', { size: 24 }), h('span', null, 'Lock parts to paint only inside them. The eye hides a part in 3D.')),
        partsList,
      ),
      block('Guides', 'sk-block-guides', guidesToggle, seeThroughToggle),
    ),
  );

  // =============================================================================================
  // Right: 3D preview

  const stage = h('div', { class: 'sk-3d' }, h('div', { class: 'sk-3d-loading' }, spinner(24)));
  const animSeg = segmented<SkinAnimation>({
    value: prefs.animation,
    size: 'sm',
    label: 'Animation',
    options: ANIMATIONS,
    onChange: (v) => {
      setPref('animation', v);
      preview?.setAnimation(v);
    },
  });
  const rotateBtn = iconButton('rotate', 'Spin automatically', () => {
    setPref('autoRotate', !prefs.autoRotate);
    rotateBtn.setActive(prefs.autoRotate);
    preview?.setAutoRotate(prefs.autoRotate);
  }, { size: 'sm', active: prefs.autoRotate });
  const resetCamBtn = iconButton('target', 'Reset camera', () => preview?.resetCamera(), { size: 'sm' });
  const shotBtn = iconButton('camera', 'Save a picture of the 3D view', () => void screenshot(), { size: 'sm' });
  const modelSeg = segmented<SkinModel>({
    value: model,
    size: 'sm',
    label: 'Arm style',
    options: [
      { value: 'classic', label: 'Classic' },
      { value: 'slim', label: 'Slim' },
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
    const el = h('button', { type: 'button', class: 'sk-backdrop', 'aria-label': `Background: ${b.label}`, 'aria-pressed': String(prefs.backdrop === b.id), style: { '--sw': b.swatch }, dataset: { id: b.id } });
    tooltip(el, b.label);
    el.addEventListener('click', () => {
      setPref('backdrop', b.id);
      backdropBtns.forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.id === b.id)));
      applyBackdrop();
    });
    return el;
  });
  const dollFront = h('canvas', { class: 'sk-doll pixelated', 'aria-label': 'Front view', role: 'img' });
  const dollBack = h('canvas', { class: 'sk-doll pixelated', 'aria-label': 'Back view', role: 'img' });

  const right = h(
    'aside',
    { class: 'panel sk-right', 'aria-label': '3D preview' },
    h('div', { class: 'panel-header' }, h('h2', null, '3D preview'), rotateBtn, resetCamBtn, shotBtn),
    h('div', { class: 'sk-3d-wrap', dataset: { backdrop: prefs.backdrop } }, stage, h('div', { class: 'sk-3d-anim' }, animSeg)),
    h(
      'div',
      { class: 'sk-3d-controls' },
      h('div', { class: 'sk-ctl' }, h('span', { class: 'sk-ctl-label' }, 'Arms'), modelSeg),
      h('div', { class: 'sk-ctl' }, h('span', { class: 'sk-ctl-label' }, 'Show'), h('div', { class: 'sk-chips' }, layerChip('Base', 'base3d'), layerChip('Outer', 'outer3d'))),
      h('div', { class: 'sk-ctl' }, h('span', { class: 'sk-ctl-label' }, 'Backdrop'), h('div', { class: 'sk-backdrops' }, backdropBtns)),
    ),
    h('div', { class: 'sk-dolls' }, h('figure', null, dollFront, h('figcaption', null, 'Front')), h('figure', null, dollBack, h('figcaption', null, 'Back'))),
  );

  // =============================================================================================
  // Layout

  const layout = editorLayout({
    left,
    center,
    right,
    labels: { left: 'Parts', center: 'Paint', right: '3D' },
    icons: { left: 'human', center: 'brush', right: 'cube' },
    initial: 'center',
    onPanelChange: (p: EditorPanel) => {
      if (p === 'center') requestAnimationFrame(() => pc?.redraw());
    },
  });
  const editorRoot = h('div', { class: 'sk-editor' }, bar, layout);
  root.append(editorRoot);

  // =============================================================================================
  // Pixel canvas

  const pc = new PixelCanvas(canvasHost, {
    image: initial,
    showGrid: prefs.grid,
    label: 'Skin template. Paint with the current tool.',
    mirrorMap: mirrorMapFor(model),
    decodeImage: (b) => decodeImage(b),
  });
  canvasHost.appendChild(tip);
  // On narrow screens use every pixel of width: the default fit leaves generous margins.
  const fitView = () => {
    pc.zoomToFit();
    const w = canvasHost.clientWidth;
    const hh = canvasHost.clientHeight;
    if (w && w < 560) {
      const snug = Math.floor(Math.min((w - 12) / 64, (hh - 12) / 64));
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
  pc.setColor([62, 124, 214, 255]);
  pc.setSecondaryColor([0, 0, 0, 0]);
  disposers.push(() => pc.destroy());

  const overlay = (ctx: CanvasRenderingContext2D, view: Parameters<typeof drawPartOverlay>[1]) => {
    const focus = highlight ? new Set([highlight]) : locked.size ? locked : null;
    drawPartOverlay(ctx, view, {
      model,
      outlines: prefs.guides,
      labels: prefs.guides,
      layers: prefs.layers,
      hover: prefs.guides || highlight ? hoverRect : null,
      hoverMirror: prefs.mirror && hoverRect ? mirrorFaceRect(hoverRect, model) : null,
      focus,
      pointer: hoverPixel,
      theme: isLight() ? 'light' : 'dark',
    });
  };
  pc.setOverlay(overlay);
  buildPicker();

  const updateMask = () => {
    const parts = locked.size ? (prefs.mirror ? withMirrorParts(locked) : locked) : null;
    pc.setMask(maskForParts(parts, model, prefs.layers));
  };
  updateMask();

  // ---- sync UI from the canvas ----
  const syncTool = () => toolButtons.forEach((b, t) => b.setActive(t === pc.tool));
  const syncColors = () => {
    const c = pc.color;
    const s = pc.secondaryColor;
    (primarySwatch.firstElementChild as HTMLElement).style.background = `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${c[3] / 255})`;
    (secondarySwatch.firstElementChild as HTMLElement).style.background = s[3] === 0 ? '' : `rgba(${s[0]}, ${s[1]}, ${s[2]}, ${s[3] / 255})`;
    secondarySwatch.classList.toggle('is-clear', s[3] === 0);
    primarySwatch.setAttribute('aria-label', `Paint colour ${toHex(c, c[3] < 255)}`);
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
  disposers.push(
    pc.on('tool', syncTool),
    pc.on('settings', (s) => {
      syncColors();
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

  primarySwatch.addEventListener('click', () => {
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
      const b = h('button', { type: 'button', class: 'sk-chip', dataset: { id: g.id } }, g.label);
      b.addEventListener('click', () => {
        setPref('palette', g.id);
        build(g.id);
        buildPicker();
      });
      chips.appendChild(b);
    }
    build(group.id);
    content.append(chips, slot);
    const pop = openPopover(primarySwatch, content, { placement: phone ? 'top-start' : 'right-start', label: 'Paint colour', focus: true });
  });
  secondarySwatch.addEventListener('click', () => {
    const s = pc.secondaryColor;
    pc.setSecondaryColor(s[3] === 0 ? pc.color : [0, 0, 0, 0]);
    toast(s[3] === 0 ? 'Right-click now paints with this colour.' : 'Right-click now erases.', { duration: 2500 });
  });
  swapBtn.addEventListener('click', () => pc.swapColors());

  // ---- hover tooltip & status ----
  let tipIndex = Math.floor(Math.random() * TIPS.length);
  const showTipText = () => {
    status.classList.remove('is-hover');
    statusText.textContent = TIPS[tipIndex % TIPS.length];
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
  const updateHoverUi = () => {
    if (hoverRect) {
      const text = describeRect(hoverRect);
      tip.replaceChildren(h('span', { class: 'sk-tip-dot', style: { background: PART_INFO[hoverRect.part].color } }), text);
      statusText.textContent = `${text} · ${hoverPixel!.x}, ${hoverPixel!.y}`;
      status.classList.add('is-hover');
    } else if (hoverPixel) {
      tip.replaceChildren(h('span', { class: 'sk-tip-dot is-unused' }), 'Unused area (not shown in game)');
      statusText.textContent = 'Unused area — pixels here are not shown in game.';
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
      hoverRect = p ? partAt(p.x, p.y, model) : null;
      updateHoverUi();
      pc.redraw();
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
    // 3 CSS px per skin pixel (48x96), in whole device pixels.
    const s = Math.max(3, Math.round(3 * Math.min(3, window.devicePixelRatio || 1)));
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
      toast('See-through mode is not available in this 3D preview.', { tone: 'warn' });
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
      applyLayers3d();
      if (prefs.seeThrough) applySeeThrough();
      disposers.push(() => preview?.destroy());
    })
    .catch(() => {
      stage.replaceChildren(h('p', { class: 'sk-3d-error muted' }, 'The 3D preview could not be loaded. You can still paint and export.'));
    });

  // ---- saving ----
  let version = 0;
  let savedVersion = 0;
  let saving: Promise<void> | null = null;
  let saveErrorShown = false;
  const setSaveState = (state: 'saved' | 'saving' | 'unsaved' | 'error', detail?: string) => {
    saveState.dataset.state = state;
    const map = { saved: ['check', 'Saved'], saving: ['cloud', 'Saving…'], unsaved: ['clock', 'Unsaved'], error: ['warning', "Couldn't save"] } as const;
    saveIcon.replaceChildren(icon(map[state][0]));
    saveText.textContent = map[state][1];
    saveState.title = detail ?? (state === 'error' ? 'Click to try again' : 'Your skin is saved in this browser');
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
        project.name = nameInput.value.trim() || 'My skin';
        await saveProject(project);
        savedVersion = v;
        if (!destroyed) setSaveState(version === v ? 'saved' : 'unsaved');
      } catch (err) {
        if (!destroyed) setSaveState('error', err instanceof Error ? err.message : undefined);
        if (!saveErrorShown) {
          saveErrorShown = true;
          toast(`Couldn't save your skin in this browser${err instanceof Error ? `: ${err.message}` : '.'} Export it to keep a copy.`, { tone: 'error', duration: 8000 });
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
  saveState.addEventListener('click', () => void flushSave());

  nameInput.addEventListener('input', () => markDirty());
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') nameInput.blur();
  });
  nameInput.addEventListener('blur', () => {
    if (!nameInput.value.trim()) {
      nameInput.value = 'My skin';
      markDirty();
    }
  });

  let latest: ImageData = initial;
  let holes = countBaseHoles(initial, model);
  let holesTipShown = false;
  const onImageChanged = (img: ImageData) => {
    latest = img;
    preview?.setSkin(img);
    drawDolls(img);
    markDirty();
    const nextHoles = countBaseHoles(img, model);
    if (nextHoles > holes && !holesTipShown && pc.tool === 'eraser') {
      holesTipShown = true;
      toast('Heads-up: holes in the base layer show up solid in game. Only the outer layer can be see-through.', { tone: 'info', duration: 7000 });
    }
    holes = nextHoles;
  };
  disposers.push(pc.on('change', onImageChanged));

  const onPageHide = () => void flushSave();
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') void flushSave();
  };
  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (version !== savedVersion) {
      void flushSave();
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
  }

  function setMirror(v: boolean) {
    setPref('mirror', v);
    mirrorBtn.setAttribute('aria-pressed', String(v));
    pc.setMirror(v, false);
    updateMask();
    pc.redraw();
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
  }

  let visibilityWarned = false;
  function togglePartVisible(part: SkinPart) {
    if (hidden.has(part)) hidden.delete(part);
    else hidden.add(part);
    if (preview) {
      const ok = setPartVisible(preview, part, !hidden.has(part));
      if (!ok && !visibilityWarned) {
        visibilityWarned = true;
        toast('Hiding parts is not available in this 3D preview.', { tone: 'warn' });
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
    if (locked.size) statusText.textContent = `Painting only inside: ${[...locked].map((p) => PART_INFO[p].label).join(', ')}`;
  }

  function resetParts() {
    locked.clear();
    for (const p of hidden) if (preview) setPartVisible(preview, p, true);
    hidden.clear();
    applyLayers3d();
    updateMask();
    syncPartsUi();
    pc.redraw();
  }

  function applyImageOp(label: string, fn: (img: ImageData) => ImageData) {
    pc.deselect();
    pc.applyFilter(fn);
    toast(label, { tone: 'success', duration: 2500, action: { label: 'Undo', onClick: () => pc.undo() } });
  }

  function partMenu(part: SkinPart, anchor: HTMLElement) {
    const info = PART_INFO[part];
    const other = PART_INFO[info.mirror];
    const layer = prefs.layers === 'outer' ? 'outer' : 'base';
    const c = pc.color;
    const items = [
      {
        label: `Fill ${layer === 'outer' ? info.outerLabel.toLowerCase() : info.label.toLowerCase()} with colour`,
        icon: 'fill' as IconName,
        onClick: () => applyImageOp(`Filled the ${info.label.toLowerCase()}`, (img) => fillPart(img, part, layer, model, [c[0], c[1], c[2], layer === 'base' ? 255 : c[3]])),
      },
      ...(info.mirror !== part
        ? [
            {
              label: `Copy to ${other.label.toLowerCase()}`,
              icon: 'mirror' as IconName,
              onClick: () => applyImageOp(`Copied the ${info.label.toLowerCase()} to the ${other.label.toLowerCase()}`, (img) => copyToMirror(img, part, model)),
            },
          ]
        : []),
      {
        label: `Clear ${info.outerLabel.toLowerCase()} (outer layer)`,
        icon: 'eraser' as IconName,
        onClick: () => applyImageOp(`Cleared the ${info.outerLabel.toLowerCase()}`, (img) => fillPart(img, part, 'outer', model, null)),
      },
    ];
    openMenu(anchor, items, { label: `${info.label} actions` });
  }

  async function switchModel(to: SkinModel) {
    if (to === model) return;
    const from = model;
    const text =
      to === 'slim'
        ? 'Slim arms are 3 pixels wide instead of 4. Convert your arm pixels so sleeves and hands still line up? The column next to the body is removed.'
        : 'Classic arms are 4 pixels wide instead of 3. Convert your arm pixels to fill the wider arms? The column next to the body is repeated.';
    const answer = await choose<'convert' | 'switch'>(
      to === 'slim' ? 'Switch to slim arms?' : 'Switch to classic arms?',
      h('div', { class: 'stack' }, h('p', null, text), h('p', { class: 'muted small' }, 'You can undo this afterwards.')),
      [
        { value: 'switch', label: 'Just switch', variant: 'ghost' },
        { value: 'convert', label: 'Convert arms', variant: 'primary' },
      ],
    );
    if (!answer) {
      modelSeg.setValue(model);
      return;
    }
    const before = pc.getImage();
    model = to;
    project.model = to;
    if (answer === 'convert') pc.setImage(convertArms(before, from, to), { resetHistory: false, resetView: false });
    afterModelChange();
    onImageChanged(pc.getImage());
    toast(`Switched to ${to === 'slim' ? 'slim' : 'classic'} arms`, {
      tone: 'success',
      action: {
        label: 'Undo',
        onClick: () => {
          model = from;
          project.model = from;
          if (answer === 'convert') pc.undo();
          afterModelChange();
          onImageChanged(pc.getImage());
        },
      },
    });
  }

  function afterModelChange() {
    modelSeg.setValue(model);
    pc.setMirrorMap(mirrorMapFor(model));
    preview?.setModel(model);
    updateMask();
    hoverRect = hoverPixel ? partAt(hoverPixel.x, hoverPixel.y, model) : null;
    pc.redraw();
  }

  async function screenshot() {
    if (!preview) return;
    try {
      const blob = await preview.screenshot();
      saveBlob(blob, `${nameInput.value.trim() || 'skin'}-3d.png`);
      toast('Saved a picture of your skin', { tone: 'success' });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not capture the 3D view.', { tone: 'error' });
    }
  }

  async function doExport(kind: Parameters<typeof exportSkin>[0]) {
    project.name = nameInput.value.trim() || 'My skin';
    project.model = model;
    await exportSkin(kind, project, pc.getImage(), () => markDirty());
  }

  function showShortcuts() {
    openShortcutsSheet([
      {
        title: 'Tools',
        items: [
          { keys: ['B'], label: 'Pencil' },
          { keys: ['E'], label: 'Eraser' },
          { keys: ['G'], label: 'Fill' },
          { keys: ['I'], label: 'Pick a colour' },
          { keys: ['Alt'], label: 'Pick while held' },
          { keys: ['L'], label: 'Line' },
          { keys: ['U'], label: 'Rectangle (again: filled)' },
          { keys: ['O'], label: 'Ellipse' },
          { keys: ['M'], label: 'Select' },
          { keys: ['V'], label: 'Move' },
        ],
      },
      {
        title: 'Skin',
        items: [
          { keys: ['Y'], label: 'Mirror on / off' },
          { keys: ['1'], label: 'Paint on base layer' },
          { keys: ['2'], label: 'Paint on outer layer' },
          { keys: ['3'], label: 'Paint on both layers' },
          { keys: ['P'], label: 'Part guides on / off' },
          { keys: ['H'], label: 'Flip the selection' },
          { keys: ['R'], label: 'Rotate the selection' },
        ],
      },
      {
        title: 'Colour & brush',
        items: [
          { keys: ['X'], label: 'Swap colours' },
          { keys: ['Right click'], label: 'Paint with the second colour' },
          { keys: ['['], label: 'Smaller brush' },
          { keys: [']'], label: 'Bigger brush' },
          { keys: ['Shift', 'Click'], label: 'Straight line from last point' },
        ],
      },
      {
        title: 'Edit & view',
        items: [
          { keys: ['Mod', 'Z'], label: 'Undo' },
          { keys: ['Mod', 'Shift', 'Z'], label: 'Redo' },
          { keys: ['Mod', 'S'], label: 'Save now' },
          { keys: ['0'], label: 'Fit to screen' },
          { keys: ['+'], label: 'Zoom in' },
          { keys: ['-'], label: 'Zoom out' },
          { keys: ['#'], label: 'Pixel grid' },
          { keys: ['Space'], label: 'Hold and drag to pan' },
          { keys: ['?'], label: 'This list' },
        ],
      },
    ], 'Skin editor shortcuts');
  }

  // ---- keyboard ----
  const modalOpen = () => !!document.querySelector('dialog[open]');
  const onKeyCapture = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target) || modalOpen()) return;
    const k = e.key.toLowerCase();
    // Flipping or rotating the whole template scrambles the skin; only allow it on a selection.
    if ((k === 'h' || k === 'r') && !pc.getSelection() && editorRoot.isConnected) {
      e.preventDefault();
      toast('Select an area first (M), then press H to flip or R to rotate it.', { duration: 3500 });
    }
  };
  const onKey = (e: KeyboardEvent) => {
    if (!editorRoot.isConnected) return;
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      void flushSave().then(() => toast('Saved', { tone: 'success', duration: 1500 }));
      return;
    }
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target) || modalOpen()) return;
    const t = e.target as HTMLElement | null;
    if (t?.closest?.('[role="menu"], [role="listbox"], [role="slider"]')) return;
    let handled = true;
    switch (e.key) {
      case '?':
        showShortcuts();
        break;
      case 'y':
      case 'Y':
        setMirror(!prefs.mirror);
        toast(prefs.mirror ? 'Mirror on: both sides paint together' : 'Mirror off', { duration: 1800 });
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
    imageToClient: (x, y) => {
      const v = pc.getView();
      const r = pc.element.getBoundingClientRect();
      return [r.left + v.offsetX + (x + 0.5) * v.scale, r.top + v.offsetY + (y + 0.5) * v.scale];
    },
    model: () => model,
    flush: () => flushSave(),
  };
  Object.defineProperty(editorRoot, '__skinEditor', { value: api });

  return () => {
    destroyed = true;
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
