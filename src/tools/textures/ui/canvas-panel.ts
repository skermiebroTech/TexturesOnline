// Centre panel: the pixel editor for the selected texture with its tool rail, options bar, colour dock,
// animation frames, compare-with-vanilla, upload / reset, HD upscaling and Bedrock alpha-mask mode.

import { PixelCanvas, type Tool, type PixelCanvasSettings } from '../../../shared/pixel-canvas';
import { cloneImageData, decodeImage, encodePng } from '../../../core/image';
import { saveBlob } from '../../../core/download';
import { h, isTypingTarget } from '../../../ui/dom';
import { icon, type IconName } from '../../../ui/icons';
import { badge, button, iconButton, openMenu, segmented, spinner, tooltip } from '../../../ui/components';
import { toast } from '../../../ui/toast';
import { confirmDialog } from '../../../ui/modal';
import { scaleForResolution } from '../project';
import { renderIsoCube } from '../export';
import {
  CATEGORY_INFO,
  alphaDataKind,
  firstSquare,
  frameRect,
  getFrame,
  putFrame,
  readAnimInfo,
  type AnimInfo,
  type RGBA,
  type TextureEntry,
} from './meta';
import { createColorDock } from './color-dock';
import { createFrameStrip } from './frames';
import { openUploadDialog, type UploadScope } from './upload-dialog';
import { ICON_KEY, type TexStore } from './store';
import { paintCanvas } from './thumbs';

export interface OpenTexture {
  key: string;
  entry: TextureEntry | null;
  name: string;
  full: ImageData;
  /** Vanilla pixels at their own size (null for custom textures and the pack icon) */
  vanilla: ImageData | null;
  /** `full` is an upscaled copy of vanilla that hasn't been edited yet */
  upscaled: boolean;
  anim: AnimInfo | null;
  frame: number;
  alphaData: boolean;
}

export interface CanvasPanel {
  el: HTMLElement;
  open(path: string, opts?: { focus?: boolean }): Promise<void>;
  current(): OpenTexture | null;
  canvas(): PixelCanvas | null;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  upload(path?: string, file?: File): void;
  reset(path?: string): Promise<void>;
  download(path: string): Promise<void>;
  setCompare(on: boolean): void;
  stepFrame(d: number): void;
  focusCanvas(): void;
  destroy(): void;
}

export interface CanvasPanelOptions {
  store: TexStore;
  onOpened(t: OpenTexture | null): void;
  onHistory(): void;
  onBrowse(): void;
}

const TOOLS: { tool: Tool; label: string; icon: IconName; key?: string; hint?: string }[] = [
  { tool: 'pencil', label: 'Pencil', icon: 'pencil', key: 'B' },
  { tool: 'eraser', label: 'Eraser', icon: 'eraser', key: 'E' },
  { tool: 'fill', label: 'Fill bucket', icon: 'fill', key: 'G' },
  { tool: 'picker', label: 'Colour picker', icon: 'pipette', key: 'I', hint: 'or hold Alt' },
  { tool: 'line', label: 'Line', icon: 'line', key: 'L' },
  { tool: 'rect', label: 'Rectangle', icon: 'rect', key: 'U' },
  { tool: 'ellipse', label: 'Ellipse', icon: 'ellipse', key: 'O' },
  { tool: 'lighten', label: 'Lighten', icon: 'sun' },
  { tool: 'darken', label: 'Darken', icon: 'moon' },
  { tool: 'noise', label: 'Noise brush', icon: 'noise' },
  { tool: 'select', label: 'Select', icon: 'select', key: 'M' },
  { tool: 'move', label: 'Move', icon: 'move', key: 'V' },
];

const PAINT_TOOLS = new Set<Tool>(['pencil', 'fill', 'line', 'rect', 'rect-fill', 'ellipse']);
const SIZE_TOOLS = new Set<Tool>(['pencil', 'eraser', 'line', 'rect', 'ellipse', 'lighten', 'darken', 'noise']);
const MAX_HD_PIXELS = 4 * 1024 * 1024;

const QUICK_PICKS: { label: string; ids: string[] }[] = [
  { label: 'Grass block', ids: ['block/grass_block_side', 'blocks/grass_side_carried', 'blocks/grass_side'] },
  { label: 'Stone', ids: ['block/stone', 'blocks/stone'] },
  { label: 'Oak planks', ids: ['block/oak_planks', 'blocks/planks_oak'] },
  { label: 'Diamond ore', ids: ['block/diamond_ore', 'blocks/diamond_ore'] },
  { label: 'Diamond sword', ids: ['item/diamond_sword', 'items/diamond_sword'] },
  { label: 'Apple', ids: ['item/apple', 'items/apple'] },
  { label: 'Creeper', ids: ['entity/creeper/creeper'] },
  { label: 'Sun', ids: ['environment/celestial/sun', 'environment/sun'] },
];

export function createCanvasPanel(opts: CanvasPanelOptions): CanvasPanel {
  const { store } = opts;
  const project = store.project;
  let pc: PixelCanvas | null = null;
  let cur: OpenTexture | null = null;
  let token = 0;
  let comparing = false;
  const offs: (() => void)[] = [];

  // ---------------------------------------------------------------- header
  const headThumb = h('canvas', { class: 'tx-head-thumb pixelated', 'aria-hidden': 'true' });
  const headTitle = h('h2', { class: 'tx-head-title truncate' }, 'No texture open');
  const headSub = h('span', { class: 'tx-head-sub truncate' });
  const headBadges = h('span', { class: 'tx-head-badges' });

  const compareBtn = button({ label: 'Compare', icon: 'eye', variant: 'ghost', size: 'sm', title: 'Hold to see the original — or hold C', class: 'tx-act-compare' });
  const uploadBtn = button({ label: 'Upload', icon: 'upload', variant: 'ghost', size: 'sm', title: 'Replace with your own image', class: 'tx-act-upload', onClick: () => panel.upload() });
  const resetBtn = button({ label: 'Reset', icon: 'reset', variant: 'ghost', size: 'sm', title: 'Back to the original texture', class: 'tx-act-reset', onClick: () => void panel.reset() });
  const moreBtn = iconButton('more-vertical', 'More actions', () => {
    if (!cur) return;
    const t = cur;
    openMenu(moreBtn, [
      { label: 'Download PNG', icon: 'download', onClick: () => void panel.download(t.key) },
      { label: 'Copy texture name', icon: 'copy', onClick: () => void navigator.clipboard?.writeText(t.entry?.id ?? t.name).then(() => toast('Copied', { tone: 'success', duration: 1600 })) },
      { label: 'Fit to screen', icon: 'expand', onClick: () => pc?.zoomToFit() },
    ]);
  }, { size: 'sm' });
  const actions = h('div', { class: 'tx-head-actions' }, compareBtn, uploadBtn, resetBtn, moreBtn);
  const header = h(
    'header',
    { class: 'tx-texhead' },
    h('div', { class: 'tx-head-thumbbox checker' }, headThumb),
    h('div', { class: 'tx-head-text' }, h('div', { class: 'row', style: { '--gap': '8px' } }, headTitle, headBadges), headSub),
    actions,
  );

  // ---------------------------------------------------------------- alpha-mask banner
  const channelSeg = segmented<'rgb' | 'alpha' | 'rgba'>({
    value: 'rgb',
    size: 'sm',
    label: 'Paint mode',
    options: [
      { value: 'rgb', label: 'Colour' },
      { value: 'alpha', label: 'Mask' },
      { value: 'rgba', label: 'Both' },
    ],
    onChange: (v) => pc?.setChannelMode(v),
  });
  const maskBanner = h(
    'div',
    { class: 'tx-banner', hidden: true, role: 'note' },
    icon('info'),
    h('span', { class: 'grow' }, 'Bedrock uses this texture’s transparency as a tint or dye mask. Paint colour and mask separately so you don’t break it.'),
    channelSeg,
  );

  // ---------------------------------------------------------------- tool rail
  const railButtons = new Map<Tool, HTMLButtonElement>();
  const rail = h('div', { class: 'tx-rail', role: 'toolbar', 'aria-label': 'Drawing tools', 'aria-orientation': 'vertical' });
  TOOLS.forEach((t, i) => {
    const b = h('button', { type: 'button', class: 'tx-tool', 'aria-pressed': 'false', 'aria-label': `${t.label}${t.key ? ` (${t.key})` : ''}`, dataset: { tool: t.tool } }, icon(t.icon));
    tooltip(b, `${t.label}${t.key ? ` — ${t.key}` : ''}${t.hint ? ` ${t.hint}` : ''}`);
    b.addEventListener('click', () => {
      if (!pc) return;
      if (t.tool === 'rect' && (pc.tool === 'rect' || pc.tool === 'rect-fill')) pc.setTool(pc.tool === 'rect' ? 'rect-fill' : 'rect');
      else pc.setTool(t.tool);
    });
    railButtons.set(t.tool, b);
    rail.appendChild(b);
    if (i === 3 || i === 6 || i === 9) rail.appendChild(h('span', { class: 'tx-rail-sep', 'aria-hidden': 'true' }));
  });
  rail.addEventListener('keydown', (e) => {
    const bs = [...railButtons.values()];
    const i = bs.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    let n = -1;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') n = (i + 1) % bs.length;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') n = (i - 1 + bs.length) % bs.length;
    if (n < 0) return;
    e.preventDefault();
    bs[n].focus();
  });

  // ---------------------------------------------------------------- stage
  const host = h('div', { class: 'tx-canvas-host' });
  const compareCanvas = h('canvas', { class: 'tx-compare', 'aria-hidden': 'true', hidden: true });
  const compareTag = h('span', { class: 'tx-compare-tag', hidden: true }, icon('eye', { size: 16 }), 'Original');
  const loading = h('div', { class: 'tx-stage-loading', hidden: true }, spinner(24), h('span', null, 'Loading texture…'));
  const dropHint = h('div', { class: 'tx-drop-hint', 'aria-hidden': 'true' }, icon('upload', { size: 48 }), h('span', null, 'Drop to replace this texture'));
  const emptyEl = h('div', { class: 'tx-stage-empty' });
  const stage = h('div', { class: 'tx-stage' }, host, compareCanvas, compareTag, loading, dropHint, emptyEl);

  // ---------------------------------------------------------------- options bar
  const sizeVal = h('output', { class: 'tx-size-val', 'aria-live': 'polite' }, '1');
  const sizeDown = iconButton('minus', 'Smaller brush — [', () => pc?.setBrushSize(pc.brushSize - 1), { size: 'sm' });
  const sizeUp = iconButton('plus', 'Bigger brush — ]', () => pc?.setBrushSize(pc.brushSize + 1), { size: 'sm' });
  const sizeGroup = h('div', { class: 'tx-opt tx-opt-size' }, h('span', { class: 'tx-opt-label' }, 'Size'), sizeDown, sizeVal, sizeUp);
  const mirrorX = iconButton('mirror', 'Mirror left ↔ right', () => pc?.setMirror(!pc.mirrorX, pc.mirrorY), { size: 'sm', active: false });
  const mirrorY = iconButton('mirror', 'Mirror top ↕ bottom', () => pc?.setMirror(pc.mirrorX, !pc.mirrorY), { size: 'sm', active: false, class: 'tx-rot90' });
  const mirrorGroup = h('div', { class: 'tx-opt' }, mirrorX, mirrorY);
  const fillAll = h('button', { type: 'button', class: 'chip tx-opt-chip', 'aria-pressed': 'false' }, 'Fill all matching');
  tooltip(fillAll, 'Recolour every pixel of that colour, not just the touching ones');
  fillAll.addEventListener('click', () => pc?.setFillContiguous(!pc.fillContiguous));
  const filledChip = h('button', { type: 'button', class: 'chip tx-opt-chip', 'aria-pressed': 'false' }, 'Filled');
  filledChip.addEventListener('click', () => pc?.setTool(pc.tool === 'rect-fill' ? 'rect' : 'rect-fill'));
  const strength = h('input', { type: 'range', class: 'range tx-mini-range', min: 2, max: 60, step: 1, value: 15, 'aria-label': 'Strength' });
  strength.addEventListener('input', () => {
    pc?.setShadeStrength(Number(strength.value) / 100);
    strength.style.setProperty('--fill', `${((Number(strength.value) - 2) / 58) * 100}%`);
  });
  const strengthGroup = h('label', { class: 'tx-opt' }, h('span', { class: 'tx-opt-label' }, 'Strength'), strength);
  const toolOpts = h('div', { class: 'tx-optgroup' }, sizeGroup, mirrorGroup, fillAll, filledChip, strengthGroup);

  const gridBtn = iconButton('grid', 'Pixel grid — #', () => pc?.setShowGrid(!pc.showGrid), { size: 'sm', active: true });
  const tiledBtn = iconButton('grid-2x2-2', 'Tiled 3×3 view (see seams)', () => pc?.setTiledPreview(!pc.tiledPreview), { size: 'sm', active: false });
  const flipH = iconButton('flip-h', 'Flip left ↔ right — H', () => pc?.flipH(), { size: 'sm' });
  const flipV = iconButton('flip-v', 'Flip top ↕ bottom — Shift+H', () => pc?.flipV(), { size: 'sm' });
  const rotate = iconButton('rotate', 'Rotate 90° — R', () => pc?.rotate90(), { size: 'sm' });
  const zoomOut = iconButton('zoom-out', 'Zoom out — −', () => pc?.zoomOut(), { size: 'sm' });
  const zoomIn = iconButton('zoom-in', 'Zoom in — +', () => pc?.zoomIn(), { size: 'sm' });
  const zoomVal = h('button', { type: 'button', class: 'tx-zoom-val' }, '100%');
  tooltip(zoomVal, 'Fit to screen — 0');
  zoomVal.addEventListener('click', () => pc?.zoomToFit());
  const viewOpts = h(
    'div',
    { class: 'tx-optgroup tx-optgroup-view' },
    gridBtn,
    tiledBtn,
    h('span', { class: 'toolbar-sep' }),
    flipH,
    flipV,
    rotate,
    h('span', { class: 'toolbar-sep' }),
    zoomOut,
    zoomVal,
    zoomIn,
  );
  const optbar = h('div', { class: 'tx-optbar', role: 'toolbar', 'aria-label': 'Tool options' }, toolOpts, viewOpts);

  const dock = createColorDock(() => pc);
  const frames = createFrameStrip((i) => selectFrame(i));

  const workspace = h('div', { class: 'tx-workspace' }, rail, stage);
  const el = h(
    'section',
    { class: 'panel tx-center is-empty', 'aria-label': 'Texture editor' },
    header,
    maskBanner,
    workspace,
    frames.el,
    optbar,
    dock.el,
  );

  // ---------------------------------------------------------------- empty state
  const renderEmpty = () => {
    const has = (id: string) => store.byPath.has(`${store.assets.edition === 'java' ? 'assets/minecraft/textures/' : 'textures/'}${id}.png`) || store.byPath.has(`textures/${id}.tga`);
    const pathOf = (id: string) => {
      const root = store.assets.edition === 'java' ? 'assets/minecraft/textures/' : 'textures/';
      return store.byPath.has(`${root}${id}.png`) ? `${root}${id}.png` : `${root}${id}.tga`;
    };
    const picks = QUICK_PICKS.map((q) => ({ q, id: q.ids.find(has) })).filter((x): x is { q: (typeof QUICK_PICKS)[number]; id: string } => !!x.id);
    const chips = picks.map(({ q, id }) => {
      const path = pathOf(id);
      const c = h('canvas', { class: 'pixelated', 'aria-hidden': 'true' });
      const b = h('button', { type: 'button', class: 'tx-pick' }, h('span', { class: 'tx-pick-img checker' }, c), h('span', null, q.label));
      b.addEventListener('click', () => void panel.open(path, { focus: true }));
      const e = store.byPath.get(path);
      if (e)
        void store
          .getFull(path)
          .then((img) => {
            const f = firstSquare(img);
            paintCanvas(c, f);
          })
          .catch(() => undefined);
      return b;
    });
    emptyEl.replaceChildren(
      h(
        'div',
        { class: 'tx-empty-inner' },
        h('div', { class: 'empty-icon' }, icon('image', { size: 48 })),
        h('h3', null, 'Pick a texture to paint'),
        h('p', { class: 'muted' }, 'Choose any texture from the list, or start with one of these:'),
        h('div', { class: 'tx-picks' }, chips),
        button({ label: 'Browse all textures', icon: 'search', variant: 'secondary', class: 'tx-browse-btn', onClick: () => opts.onBrowse() }),
      ),
    );
  };
  renderEmpty();

  // ---------------------------------------------------------------- canvas lifecycle
  const ensureCanvas = (img: ImageData): PixelCanvas => {
    if (pc) return pc;
    pc = new PixelCanvas(host, { image: img, showGrid: true, label: 'Texture pixels', decodeImage: (b) => decodeImage(b) });
    pc.setColor([91, 211, 91, 255]);
    offs.push(
      pc.on('change', (img2) => onChange(img2)),
      pc.on('settings', (s) => syncSettings(s)),
      pc.on('tool', () => syncSettings(pc!.getSettings())),
      pc.on('history', () => opts.onHistory()),
      pc.on('zoom', (z) => {
        zoomVal.textContent = `${Math.round(z * 100)}%`;
        if (comparing) drawCompare();
      }),
      pc.on('colorpick', () => dock.sync()),
    );
    syncSettings(pc.getSettings());
    return pc;
  };

  function syncSettings(s: PixelCanvasSettings) {
    for (const [tool, b] of railButtons) b.setAttribute('aria-pressed', String(tool === s.tool || (tool === 'rect' && s.tool === 'rect-fill')));
    const rectB = railButtons.get('rect');
    if (rectB) rectB.querySelector('.icon')?.replaceWith(icon(s.tool === 'rect-fill' ? 'rect-fill' : 'rect'));
    sizeVal.textContent = String(s.brushSize);
    sizeGroup.hidden = !SIZE_TOOLS.has(s.tool === 'rect-fill' ? 'rect' : s.tool);
    mirrorGroup.hidden = !SIZE_TOOLS.has(s.tool === 'rect-fill' ? 'rect' : s.tool) && s.tool !== 'fill';
    mirrorX.setActive(s.mirrorX);
    mirrorY.setActive(s.mirrorY);
    fillAll.hidden = s.tool !== 'fill';
    fillAll.setAttribute('aria-pressed', String(!s.fillContiguous));
    filledChip.hidden = s.tool !== 'rect' && s.tool !== 'rect-fill';
    filledChip.setAttribute('aria-pressed', String(s.tool === 'rect-fill'));
    strengthGroup.hidden = !['lighten', 'darken', 'noise'].includes(s.tool);
    strength.value = String(Math.round(s.shadeStrength * 100));
    strength.style.setProperty('--fill', `${((Number(strength.value) - 2) / 58) * 100}%`);
    gridBtn.setActive(s.showGrid);
    tiledBtn.setActive(s.tiledPreview);
    channelSeg.setValue(s.channelMode);
    dock.sync();
  }

  let paletteTimer: ReturnType<typeof setTimeout> | null = null;
  function onChange(img: ImageData) {
    const t = cur;
    if (!t || !pc) return;
    if (t.anim) {
      putFrame(t.full, t.anim, t.frame, img);
      frames.update(t.full, t.frame);
    } else {
      t.full = img;
    }
    t.upscaled = false;
    const copy = t.anim ? cloneImageData(t.full) : img;
    store.setImage(t.key, copy);
    store.events.emit('image', { path: t.key, full: copy });
    if (PAINT_TOOLS.has(pc.tool)) dock.noteUsed(pc.color as RGBA);
    paintHeader();
    if (paletteTimer) clearTimeout(paletteTimer);
    paletteTimer = setTimeout(() => dock.setPalette(pc ? pc.getImage() : null), 400);
  }

  // ---------------------------------------------------------------- header paint
  function paintHeader() {
    const t = cur;
    headBadges.replaceChildren();
    if (!t) {
      headTitle.textContent = 'No texture open';
      headSub.textContent = 'Choose a texture from the list';
      return;
    }
    const f = t.anim ? getFrame(t.full, t.anim, 0) : t.full;
    paintCanvas(headThumb, f);
    headTitle.textContent = t.name;
    const size = `${t.full.width}×${t.full.height}`;
    headSub.textContent = t.key === ICON_KEY ? `Pack icon · ${size}` : `${t.entry?.id ?? t.key} · ${size}${t.anim ? ` · ${t.anim.count} frames` : ''}`;
    headSub.title = t.key;
    const edited = t.key === ICON_KEY ? !!project.icon : store.isEdited(t.key);
    if (t.key !== ICON_KEY && t.entry) headBadges.append(badge(CATEGORY_INFO[t.entry.category].short, 'gray'));
    if (edited && t.key !== ICON_KEY) headBadges.append(badge('Edited', 'green'));
    if (t.anim) headBadges.append(badge('Animated', 'blue'));
    if (t.upscaled) {
      const b = badge(`Upscaled to ${project.resolution}×`, 'purple');
      tooltip(b, `Vanilla is ${t.vanilla?.width}×${t.vanilla?.height}. Your pack is ${project.resolution}×, so it was scaled up for extra detail. It is saved at this size when you edit it.`);
      headBadges.append(b);
    }
    if (t.entry?.custom) headBadges.append(badge('Custom', 'gold'));
    const canCompare = !!t.vanilla && (edited || t.upscaled);
    compareBtn.disabled = !canCompare;
    resetBtn.disabled = t.key === ICON_KEY ? !project.icon : !edited;
    resetBtn.querySelector('.btn-label')!.textContent = t.vanilla || t.key === ICON_KEY ? 'Reset' : 'Remove';
    compareBtn.hidden = t.key === ICON_KEY || !t.vanilla;
  }

  // ---------------------------------------------------------------- open
  const hdFor = (entry: TextureEntry | null, vanilla: ImageData, anim: boolean): boolean => {
    const res = project.resolution;
    if (!entry || res <= 16 || entry.category === 'colormap' || entry.category === 'font') return false;
    const base = anim && vanilla.height > vanilla.width ? vanilla.width : 16;
    const factor = Math.round(res / base);
    if (factor <= 1) return false;
    return vanilla.width * factor <= 2048 && vanilla.width * vanilla.height * factor * factor <= MAX_HD_PIXELS;
  };

  async function load(path: string): Promise<OpenTexture> {
    if (path === ICON_KEY) {
      let full: ImageData;
      try {
        full = await store.getFull(ICON_KEY);
      } catch {
        full = await defaultIcon();
      }
      return { key: ICON_KEY, entry: null, name: 'Pack icon', full, vanilla: null, upscaled: false, anim: null, frame: 0, alphaData: false };
    }
    const entry = store.byPath.get(path) ?? store.ensureEntry(path) ?? null;
    const edited = store.isEdited(path);
    const vanilla = await store.getVanilla(path);
    let full = edited || !vanilla ? await store.getFull(path) : cloneImageData(vanilla);
    let upscaled = false;
    if (!edited && vanilla && hdFor(entry, vanilla, !!entry?.animated)) {
      full = scaleForResolution(vanilla, project.resolution, !!entry?.animated && vanilla.height > vanilla.width);
      upscaled = full.width !== vanilla.width;
    }
    const anim = entry ? await readAnimInfo(project, store.assets, entry, full, vanilla?.width ?? null) : null;
    let alphaData = false;
    if (project.edition === 'bedrock' && /\.tga$/i.test(path)) {
      const k = alphaDataKind(full);
      alphaData = k.hidden > 0.02 || k.faint > 0;
    }
    return { key: path, entry, name: entry?.pretty ?? path, full, vanilla, upscaled, anim, frame: 0, alphaData };
  }

  async function defaultIcon(): Promise<ImageData> {
    const root = project.edition === 'java' ? 'assets/minecraft/textures/' : 'textures/';
    const tryIds = project.edition === 'java' ? [['block/grass_block_top', 'block/grass_block_side'], ['block/stone', 'block/stone']] : [['blocks/grass_carried', 'blocks/grass_side_carried'], ['blocks/stone', 'blocks/stone']];
    for (const [top, side] of tryIds) {
      try {
        const [a, b] = await Promise.all([store.getFull(`${root}${top}.png`), store.getFull(`${root}${side}.png`)]);
        return renderIsoCube(firstSquare(a), firstSquare(b), 64);
      } catch {
        /* next */
      }
    }
    const img = new ImageData(64, 64);
    return img;
  }

  let loadingTimer: ReturnType<typeof setTimeout> | null = null;
  async function open(path: string, o: { focus?: boolean } = {}): Promise<void> {
    const my = ++token;
    setCompare(false);
    if (loadingTimer) clearTimeout(loadingTimer);
    loadingTimer = setTimeout(() => {
      if (my === token) loading.hidden = false;
    }, 160);
    let t: OpenTexture;
    try {
      t = await load(path);
    } catch (err) {
      if (my !== token) return;
      loading.hidden = true;
      console.error(err);
      toast(err instanceof Error ? err.message : "This texture couldn't be opened.", { tone: 'error' });
      return;
    } finally {
      if (loadingTimer) clearTimeout(loadingTimer);
    }
    if (my !== token) return;
    loading.hidden = true;
    cur = t;
    el.classList.remove('is-empty');
    const frameImg = getFrame(t.full, t.anim, 0);
    const canvas = ensureCanvas(frameImg);
    canvas.setImage(frameImg, { resetHistory: true, resetView: true });
    canvas.setChannelMode(t.alphaData ? (alphaDataKind(t.full).hidden > 0.3 || alphaDataKind(t.full).faint > 0 ? 'rgb' : 'rgba') : 'rgba');
    maskBanner.hidden = !t.alphaData;
    frames.set(t.full, t.anim, 0);
    dock.setPalette(frameImg);
    paintHeader();
    opts.onHistory();
    opts.onOpened(t);
    if (path !== ICON_KEY) {
      try {
        localStorage.setItem(`to-tex-last:${project.id}`, path);
      } catch {
        /* storage blocked */
      }
    }
    if (o.focus) canvas.focus();
  }

  function selectFrame(i: number) {
    const t = cur;
    if (!t?.anim || !pc) return;
    t.frame = i;
    const f = getFrame(t.full, t.anim, i);
    pc.setImage(f, { resetHistory: true, resetView: false });
    dock.setPalette(f);
    opts.onHistory();
    if (comparing) drawCompare();
  }

  // ---------------------------------------------------------------- compare with vanilla
  const tmp = document.createElement('canvas');
  function drawCompare() {
    const t = cur;
    if (!t?.vanilla || !pc) return;
    const v = pc.getView();
    const r = host.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    compareCanvas.width = Math.round(r.width * dpr);
    compareCanvas.height = Math.round(r.height * dpr);
    compareCanvas.style.width = `${r.width}px`;
    compareCanvas.style.height = `${r.height}px`;
    const ctx = compareCanvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, r.width, r.height);
    const fw = t.anim ? t.anim.frameW : t.full.width;
    const fh = t.anim ? t.anim.frameH : t.full.height;
    const sx = t.vanilla.width / t.full.width;
    const sy = t.vanilla.height / t.full.height;
    const fr = t.anim ? frameRect(t.anim, t.frame) : { x: 0, y: 0, w: fw, h: fh };
    paintCanvas(tmp, t.vanilla);
    ctx.imageSmoothingEnabled = false;
    const cs = getComputedStyle(el);
    ctx.fillStyle = cs.getPropertyValue('--checker-b').trim() || '#1d222c';
    ctx.fillRect(v.offsetX, v.offsetY, fw * v.scale, fh * v.scale);
    ctx.drawImage(tmp, fr.x * sx, fr.y * sy, fr.w * sx, fr.h * sy, v.offsetX, v.offsetY, fw * v.scale, fh * v.scale);
  }
  function setCompare(on: boolean) {
    if (on && (!cur?.vanilla || !pc || compareBtn.disabled)) return;
    if (on === comparing) return;
    comparing = on;
    compareCanvas.hidden = !on;
    compareTag.hidden = !on;
    compareBtn.setAttribute('aria-pressed', String(on));
    if (on) drawCompare();
  }
  compareBtn.setAttribute('aria-pressed', 'false');
  compareBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    compareBtn.setPointerCapture(e.pointerId);
    setCompare(true);
  });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) compareBtn.addEventListener(ev, () => setCompare(false));
  compareBtn.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault();
      setCompare(true);
    }
  });
  compareBtn.addEventListener('keyup', (e) => {
    if (e.key === ' ' || e.key === 'Enter') setCompare(false);
  });
  compareBtn.addEventListener('blur', () => setCompare(false));
  compareBtn.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---------------------------------------------------------------- drag & drop an image onto the canvas
  let dragDepth = 0;
  stage.addEventListener('dragenter', (e) => {
    if (!cur || !e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    dragDepth++;
    stage.classList.add('dragging');
  });
  stage.addEventListener('dragover', (e) => {
    if (!cur || !e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  stage.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) stage.classList.remove('dragging');
  });
  stage.addEventListener('drop', (e) => {
    if (!cur) return;
    e.preventDefault();
    dragDepth = 0;
    stage.classList.remove('dragging');
    const f = e.dataTransfer?.files?.[0];
    if (f) panel.upload(cur.key, f);
  });

  // ---------------------------------------------------------------- replace / reset helpers
  /** Replaces the open texture's pixels (undo through a toast when history can't cover it). */
  async function replaceFull(path: string, next: ImageData, label: string, viaHistory: boolean) {
    const before = cur && cur.key === path ? cloneImageData(cur.full) : null;
    const wasEdited = path === ICON_KEY ? !!project.icon : store.isEdited(path);
    if (cur && cur.key === path && viaHistory && pc && !cur.anim && pc.width === next.width && pc.height === next.height) {
      pc.setImage(next, { resetHistory: false, resetView: false });
      onChange(pc.getImage());
      toast(`${label} — press Ctrl+Z to undo`, { tone: 'success' });
      return;
    }
    store.setImage(path, next);
    if (cur && cur.key === path) await open(path);
    store.events.emit('image', { path, full: next });
    toast(label, {
      tone: 'success',
      action: before
        ? {
            label: 'Undo',
            onClick: () => {
              if (wasEdited) store.setImage(path, before);
              else if (path !== ICON_KEY) store.resetToVanilla(path);
              if (cur?.key === path) void open(path);
            },
          }
        : undefined,
    });
  }

  const panel: CanvasPanel = {
    el,
    open,
    current: () => cur,
    canvas: () => pc,
    undo: () => pc?.undo(),
    redo: () => pc?.redo(),
    canUndo: () => !!pc?.canUndo(),
    canRedo: () => !!pc?.canRedo(),
    upload(path, file) {
      const key = path ?? cur?.key;
      if (!key) {
        toast('Open a texture first, then upload an image for it.', { tone: 'info' });
        return;
      }
      const go = async () => {
        const t = cur && cur.key === key ? cur : await load(key);
        openUploadDialog({
          file,
          name: t.name,
          width: t.full.width,
          height: t.full.height,
          anim: t.anim ? { frameW: t.anim.frameW, frameH: t.anim.frameH, count: t.anim.count, index: t.frame } : null,
          alphaData: t.alphaData,
          onApply: (img: ImageData, scope: UploadScope) => {
            let next: ImageData;
            if (!t.anim || scope === 'full') next = img;
            else {
              next = cloneImageData(t.full);
              if (scope === 'frame') putFrame(next, t.anim, t.frame, img);
              else for (let i = 0; i < t.anim.count; i++) putFrame(next, t.anim, i, img);
            }
            void replaceFull(key, next, `Replaced ${t.name}`, true);
          },
        });
      };
      void go().catch((err) => toast(err instanceof Error ? err.message : "Couldn't open that texture.", { tone: 'error' }));
    },
    async reset(path) {
      const key = path ?? cur?.key;
      if (!key) return;
      if (key === ICON_KEY) {
        store.setIconBlob(undefined);
        if (cur?.key === ICON_KEY) await open(ICON_KEY);
        toast('Pack icon reset — an automatic icon will be used', { tone: 'success' });
        return;
      }
      const hasVanilla = store.assets.hasFile(key);
      const name = store.byPath.get(key)?.pretty ?? key;
      if (!hasVanilla) {
        const ok = await confirmDialog('Remove this texture?', `"${name}" isn't part of vanilla Minecraft ${store.assets.version}, so removing it deletes it from your pack.`, 'Remove', true);
        if (!ok) return;
      }
      let before: ImageData | null = null;
      try {
        before = cloneImageData(await store.getFull(key));
      } catch {
        before = null;
      }
      store.resetToVanilla(key);
      if (!hasVanilla) store.rebuildEntries();
      if (cur?.key === key) {
        if (hasVanilla) await open(key);
        else {
          cur = null;
          el.classList.add('is-empty');
          paintHeader();
          opts.onOpened(null);
        }
      }
      toast(hasVanilla ? `${name} is back to vanilla` : `Removed ${name}`, {
        tone: 'success',
        action: before
          ? {
              label: 'Undo',
              onClick: () => {
                store.setImage(key, before!);
                void open(key);
              },
            }
          : undefined,
      });
    },
    async download(path) {
      try {
        const img = await store.getFull(path);
        const name = path === ICON_KEY ? 'pack' : (store.byPath.get(path)?.name ?? 'texture');
        saveBlob(new Blob([encodePng(img)], { type: 'image/png' }), `${name}.png`);
      } catch (err) {
        toast(err instanceof Error ? err.message : "Couldn't download that texture.", { tone: 'error' });
      }
    },
    setCompare,
    stepFrame(d) {
      if (!cur?.anim) return;
      selectFrame((cur.frame + d + cur.anim.count) % cur.anim.count);
      frames.set(cur.full, cur.anim, cur.frame);
    },
    focusCanvas: () => pc?.focus(),
    destroy() {
      offs.forEach((f) => f());
      frames.destroy();
      dock.destroy();
      pc?.destroy();
      pc = null;
      if (paletteTimer) clearTimeout(paletteTimer);
    },
  };

  // global "hold C to compare" (ignored while typing)
  const onKey = (e: KeyboardEvent) => {
    if (e.key.toLowerCase() !== 'c' || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target) || document.querySelector('dialog[open]')) return;
    if (e.type === 'keydown' && !e.repeat) setCompare(true);
    if (e.type === 'keyup') setCompare(false);
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  offs.push(() => {
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
  });
  offs.push(store.events.on('entries', () => renderEmpty()));

  paintHeader();
  return panel;
}
