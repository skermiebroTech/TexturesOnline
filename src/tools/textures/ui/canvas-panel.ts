// Centre panel: the pixel editor for the selected texture with its tool rail, options bar, colour dock,
// animation frames, compare-with-vanilla, upload / reset, HD upscaling and Bedrock alpha-mask mode.
// In the 3D workspace the stage holds the 3D model instead (painted with the same tools) and the pixel
// editor moves to the side panel. Each texture keeps its own undo history while you switch between them.

import { PixelCanvas, type PixelHistory, type PixelView, type Tool, type PixelCanvasSettings } from '../../../shared/pixel-canvas';
import { cloneImageData, decodeImage, encodePng } from '../../../core/image';
import { saveBlob } from '../../../core/download';
import { h, isTypingTarget } from '../../../ui/dom';
import { icon, setIcon, type IconName } from '../../../ui/icons';
import { badge, button, iconButton, openMenu, segmented, spinner, tooltip, type MenuItem } from '../../../ui/components';
import { toast } from '../../../ui/toast';
import { confirmDialog, openModal } from '../../../ui/modal';
import { scaleForResolution } from '../project';
import {
  CATEGORY_INFO,
  displayAlphaData,
  firstSquare,
  frameRect,
  getFrame,
  hasAlphaData,
  isBedrockStrip,
  isTintMaskBlock,
  opaqueCopy,
  putFrame,
  readAnimInfo,
  animInfoFromRecord,
  recordFromInfo,
  stripLayout,
  type AnimInfo,
  type RGBA,
  type TextureEntry,
} from './meta';
import { createColorDock } from './color-dock';
import { createFrameStrip, type OnionMode } from './frames';
import type { TextureAnimation } from '../../../core/types';
import { addEmptyFrame, addFrames, deleteFrame, duplicateFrame, framesOf, makeAnimated, maxFramesFor, moveFrameTo, replaceFrames, NEW_FRAMETIME, type Animated } from '../anim/editing';
import { javaAnimRules } from '../anim/pack';
import { animBlock, type AnimBlock } from '../anim/rules';
import { ta } from '../anim/i18n/text';
import { kit } from '../../../ui/i18n/kit';
import { openUploadDialog, type UploadScope } from './upload-dialog';
import { ICON_KEY, type TexStore } from './store';
import { paintCanvas } from './thumbs';
import type { EditorText } from './i18n/editor';
import { autoPackIcon } from './icon';
import { fmt, fmtNodes } from '../../../i18n/editor-text';
import { te } from './i18n/editor';
import { byPointer } from './media';
import { scrollFade } from './scroll-fade';

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
  /** Pixels when opened, if the texture wasn't edited then: undoing back to them un-edits it */
  base: ImageData | null;
  baseUpscaled: boolean;
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
  /** '3d': the stage shows `stage3d` (the model) and the pixel editor (`canvasBox`) is placed elsewhere */
  setWorkspace(ws: Workspace): void;
  workspace(): Workspace;
  /** The pixel editor with its compare overlay */
  readonly canvasBox: HTMLElement;
  /** Where the 3D model goes in the 3D workspace */
  readonly stage3d: HTMLElement;
  /** Shows a stroke in progress in the previews (at most once per frame) */
  live(): void;
  /** Outlines texels on the pixel editor (what a press on the model would paint); null clears */
  showHover(h: { pixels: readonly number[]; echo?: readonly number[] } | null): void;
  destroy(): void;
}

export type Workspace = '2d' | '3d';

/** Tools that work on the 3D model (the others need the flat texture). */
export const TOOLS_3D = new Set<Tool>(['pencil', 'eraser', 'fill', 'picker', 'lighten', 'darken', 'noise']);

export interface CanvasPanelOptions {
  store: TexStore;
  /** Shown under the texture header (e.g. the "Used by" chips) */
  belowHeader?: HTMLElement;
  onOpened(t: OpenTexture | null): void;
  onHistory(): void;
  onBrowse(): void;
  /** The 2D / 3D switch over the stage was used */
  onWorkspace?(ws: Workspace): void;
  /** Another animation frame of the open texture is being edited */
  onFrame?(t: OpenTexture): void;
  /** The open texture's frames or timing changed (made animated, frames added, moved, deleted...) */
  onAnimation?(t: OpenTexture): void;
  /** Tool, colour, brush, mirror or another setting changed */
  onSettings?(): void;
  /** The pointer moved over another texel of the pixel editor (null = off it) */
  onCanvasHover?(p: { x: number; y: number } | null): void;
  /** More entries for the texture's menu (⋮), read when it opens */
  menuItems?(): MenuItem[];
}

type RailTool = keyof EditorText['canvas']['tools'] & Tool;
const TOOLS: { tool: RailTool; readonly label: string; icon: IconName; key?: string; readonly hint?: string }[] = (
  [
    ['pencil', 'pencil', 'B'],
    ['eraser', 'eraser', 'E'],
    ['fill', 'fill', 'G'],
    ['picker', 'pipette', 'I'],
    ['line', 'line', 'L'],
    ['rect', 'rect', 'U'],
    ['ellipse', 'ellipse', 'O'],
    ['lighten', 'sun'],
    ['darken', 'moon'],
    ['noise', 'noise'],
    ['select', 'select', 'M'],
    ['move', 'move', 'V'],
  ] as [RailTool, IconName, string?][]
).map(([tool, ic, key]) => ({
  tool,
  icon: ic,
  key,
  get label() {
    return te.canvas.tools[tool];
  },
  get hint() {
    return tool === 'picker' ? te.canvas.tools.pickerHint : undefined;
  },
}));

const PAINT_TOOLS = new Set<Tool>(['pencil', 'fill', 'line', 'rect', 'rect-fill', 'ellipse']);
const SIZE_TOOLS = new Set<Tool>(['pencil', 'eraser', 'line', 'rect', 'ellipse', 'lighten', 'darken', 'noise']);
const MAX_HD_PIXELS = 4 * 1024 * 1024;
/** Undo histories kept for textures you switched away from */
const KEPT_HISTORIES = 48;

function samePixels(a: ImageData, b: ImageData): boolean {
  if (a.width !== b.width || a.height !== b.height) return false;
  const x = a.data;
  const y = b.data;
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
}

const QUICK_PICKS: { pick: keyof EditorText['canvas']['picks']; ids: string[] }[] = [
  { pick: 'grass', ids: ['block/grass_block_side', 'blocks/grass_side_carried', 'blocks/grass_side'] },
  { pick: 'stone', ids: ['block/stone', 'blocks/stone'] },
  { pick: 'planks', ids: ['block/oak_planks', 'blocks/planks_oak'] },
  { pick: 'diamondOre', ids: ['block/diamond_ore', 'blocks/diamond_ore'] },
  { pick: 'sword', ids: ['item/diamond_sword', 'items/diamond_sword'] },
  { pick: 'apple', ids: ['item/apple', 'items/apple'] },
  { pick: 'creeper', ids: ['entity/creeper/creeper'] },
  { pick: 'sun', ids: ['environment/celestial/sun', 'environment/sun'] },
];

export function createCanvasPanel(opts: CanvasPanelOptions): CanvasPanel {
  const { store } = opts;
  const project = store.project;
  let pc: PixelCanvas | null = null;
  let cur: OpenTexture | null = null;
  let token = 0;
  let comparing = false;
  const offs: (() => void)[] = [];
  let ws: Workspace = '2d';
  /** Undo / redo of textures (and animation frames) switched away from, with their untouched pixels */
  const histories = new Map<string, { history: PixelHistory; base: ImageData | null; baseUpscaled: boolean }>();
  const historyKey = (t: OpenTexture) => `${t.key}#${t.anim ? t.frame : 0}`;

  // ---------------------------------------------------------------- header
  const headThumb = h('canvas', { class: 'tx-head-thumb pixelated', 'aria-hidden': 'true' });
  const headTitle = h('h2', { class: 'tx-head-title truncate' }, te.canvas.noTexture);
  const headSub = h('span', { class: 'tx-head-sub truncate' });
  const headBadges = h('span', { class: 'tx-head-badges' });

  const compareBtn = button({ label: te.canvas.compare, icon: 'eye', variant: 'ghost', size: 'sm', title: te.canvas.compareHint, class: 'tx-act-compare' });
  const uploadBtn = button({ label: te.canvas.upload, icon: 'upload', variant: 'ghost', size: 'sm', title: te.canvas.uploadHint, class: 'tx-act-upload', onClick: () => panel.upload() });
  const resetBtn = button({ label: te.canvas.reset, icon: 'reset', variant: 'ghost', size: 'sm', title: te.canvas.resetHint, class: 'tx-act-reset', onClick: () => void panel.reset() });
  const moreBtn = iconButton('more-vertical', te.canvas.more, () => {
    if (!cur) return;
    const t = cur;
    openMenu(moreBtn, [
      { label: te.canvas.downloadPng, icon: 'download', onClick: () => void panel.download(t.key) },
      { label: te.canvas.copyName, icon: 'copy', onClick: () => void navigator.clipboard?.writeText(t.entry?.id ?? t.name).then(() => toast(te.canvas.copied, { tone: 'success', duration: 1600 })) },
      { label: te.canvas.fit, icon: 'expand', onClick: () => pc?.zoomToFit() },
      { label: ws === '3d' ? te.canvas.paint2d : te.canvas.paint3d, icon: ws === '3d' ? 'grid' : 'cube', onClick: () => opts.onWorkspace?.(ws === '3d' ? '2d' : '3d') },
      // the animation maker: a still texture can be made animated or get frames from a GIF
      ...(t.key !== ICON_KEY && (!t.anim || t.anim.still)
        ? [
            { label: ta.menu.make, icon: 'play' as const, onClick: () => void anim.make() },
            { label: ta.menu.import, icon: 'images' as const, onClick: () => void anim.import() },
          ]
        : []),
      ...(t.anim && !t.anim.still ? [{ label: ta.actions.gif, icon: 'download' as const, onClick: () => void anim.gif() }] : []),
      ...(opts.menuItems?.() ?? []),
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
    label: te.canvas.paintMode,
    options: [
      { value: 'rgb', label: te.canvas.colour },
      { value: 'alpha', label: te.canvas.mask },
      { value: 'rgba', label: te.canvas.both },
    ],
    onChange: (v) => {
      pc?.setChannelMode(v);
      if (pc) dock.setPalette(paletteSource(pc.getImage()));
    },
  });
  const bannerText = h('span', { class: 'grow' });
  const maskBanner = h('div', { class: 'tx-banner', hidden: true, role: 'note' }, icon('info'), bannerText, channelSeg);
  function paintBanner(t: OpenTexture) {
    maskBanner.hidden = !t.alphaData;
    if (!t.alphaData) return;
    const tint = !!t.entry && isTintMaskBlock(t.full, t.entry.category);
    bannerText.replaceChildren(
      tint ? te.canvas.tintMask : te.canvas.dyeMask,
      ...fmtNodes(te.canvas.maskSafe, { colour: h('strong', null, te.canvas.colour), mask: h('strong', null, te.canvas.mask) }),
    );
  }
  /** Colours to offer: in colour-only mode every pixel counts, even the see-through ones. */
  const paletteSource = (img: ImageData): ImageData => (cur?.alphaData && pc?.channelMode === 'rgb' ? opaqueCopy(img) : img);

  // ---------------------------------------------------------------- tool rail
  const railButtons = new Map<Tool, HTMLButtonElement>();
  const rail = h('div', { class: 'tx-rail', role: 'toolbar', 'aria-label': te.canvas.drawingTools, 'aria-orientation': 'vertical' });
  TOOLS.forEach((t, i) => {
    const b = h('button', { type: 'button', class: 'tx-tool', 'aria-pressed': 'false', 'aria-label': `${t.label}${t.key ? ` (${t.key})` : ''}`, dataset: { tool: t.tool } }, icon(t.icon));
    tooltip(b, `${t.label}${t.key ? ` — ${t.key}` : ''}${t.hint ? ` ${t.hint}` : ''}`);
    b.addEventListener('click', () => {
      if (!pc) return;
      if (ws === '3d' && !TOOLS_3D.has(t.tool)) {
        toast(fmt(te.canvas.flatOnly, { tool: t.label }), { duration: 3200 });
        return;
      }
      if (t.tool === 'rect' && (pc.tool === 'rect' || pc.tool === 'rect-fill')) pc.setTool(pc.tool === 'rect' ? 'rect-fill' : 'rect');
      else pc.setTool(t.tool);
    });
    railButtons.set(t.tool, b);
    rail.appendChild(b);
    // (the shapes and the selection tools need the flat texture: the 3D workspace hides them and their separators)
    if (i === 3 || i === 6 || i === 9) rail.appendChild(h('span', { class: ['tx-rail-sep', i !== 3 && 'tx-2d-only'], 'aria-hidden': 'true' }));
  });
  rail.addEventListener('keydown', (e) => {
    const bs = [...railButtons.values()].filter((b) => b.offsetParent !== null);
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
  const compareTag = h('span', { class: 'tx-compare-tag', hidden: true }, icon('eye', { size: 16 }), te.canvas.original);
  const loading = h('div', { class: 'tx-stage-loading', hidden: true }, spinner(24), h('span', null, te.canvas.loading));
  const dropHint = h('div', { class: 'tx-drop-hint', 'aria-hidden': 'true' }, icon('upload', { size: 48 }), h('span', null, te.canvas.dropToReplace));
  const emptyEl = h('div', { class: 'tx-stage-empty' });
  const canvasBox = h('div', { class: 'tx-canvas-box' }, host, compareCanvas, compareTag);
  const stage3d = h('div', { class: 'tx-stage3d', hidden: true });
  const wsSwitch = segmented<Workspace>({
    value: ws,
    size: 'sm',
    label: te.canvas.paintOn,
    options: [
      { value: '2d', label: '2D', icon: 'grid' },
      { value: '3d', label: '3D', icon: 'cube' },
    ],
    onChange: (v) => {
      wsSwitch.setValue(ws);
      opts.onWorkspace?.(v);
    },
  });
  wsSwitch.classList.add('tx-ws-switch');
  const ws2d = wsSwitch.querySelector<HTMLElement>('[data-value="2d"]');
  const ws3d = wsSwitch.querySelector<HTMLElement>('[data-value="3d"]');
  if (ws2d) tooltip(ws2d, te.canvas.paintFlatKey);
  if (ws3d) tooltip(ws3d, te.canvas.paint3dKey);
  const stage = h('div', { class: 'tx-stage' }, canvasBox, stage3d, wsSwitch, loading, dropHint, emptyEl);

  // ---------------------------------------------------------------- options bar
  const sizeVal = h('output', { class: 'tx-size-val', 'aria-live': 'polite' }, '1');
  const sizeDown = iconButton('minus', te.canvas.smaller, () => pc?.setBrushSize(pc.brushSize - 1), { size: 'sm' });
  const sizeUp = iconButton('plus', te.canvas.bigger, () => pc?.setBrushSize(pc.brushSize + 1), { size: 'sm' });
  const sizeGroup = h('div', { class: 'tx-opt tx-opt-size' }, h('span', { class: 'tx-opt-label' }, te.canvas.size), sizeDown, sizeVal, sizeUp);
  const mirrorX = iconButton('mirror', te.canvas.mirrorX, () => pc?.setMirror(!pc.mirrorX, pc.mirrorY), { size: 'sm', active: false });
  const mirrorY = iconButton('mirror', te.canvas.mirrorY, () => pc?.setMirror(pc.mirrorX, !pc.mirrorY), { size: 'sm', active: false, class: 'tx-rot90' });
  const mirrorGroup = h('div', { class: 'tx-opt' }, mirrorX, mirrorY);
  const fillAll = h('button', { type: 'button', class: 'chip tx-opt-chip', 'aria-pressed': 'false' }, te.canvas.fillAll);
  tooltip(fillAll, te.canvas.fillAllHint);
  fillAll.addEventListener('click', () => pc?.setFillContiguous(!pc.fillContiguous));
  const filledChip = h('button', { type: 'button', class: 'chip tx-opt-chip', 'aria-pressed': 'false' }, te.canvas.filled);
  filledChip.addEventListener('click', () => pc?.setTool(pc.tool === 'rect-fill' ? 'rect' : 'rect-fill'));
  const strength = h('input', { type: 'range', class: 'range tx-mini-range', min: 2, max: 60, step: 1, value: 15, 'aria-label': te.canvas.strength });
  strength.addEventListener('input', () => {
    pc?.setShadeStrength(Number(strength.value) / 100);
    strength.style.setProperty('--fill', `${((Number(strength.value) - 2) / 58) * 100}%`);
  });
  const strengthGroup = h('label', { class: 'tx-opt' }, h('span', { class: 'tx-opt-label' }, te.canvas.strength), strength);
  const toolOpts = h('div', { class: 'tx-optgroup' }, sizeGroup, mirrorGroup, fillAll, filledChip, strengthGroup);

  const gridBtn = iconButton('grid', te.canvas.grid, () => pc?.setShowGrid(!pc.showGrid), { size: 'sm', active: true });
  const tiledBtn = iconButton('grid-2x2-2', te.canvas.tiled, () => pc?.setTiledPreview(!pc.tiledPreview), { size: 'sm', active: false });
  const flipH = iconButton('flip-h', te.canvas.flipH, () => pc?.flipH(), { size: 'sm' });
  const flipV = iconButton('flip-v', te.canvas.flipV, () => pc?.flipV(), { size: 'sm' });
  const rotate = iconButton('rotate', te.canvas.rotate, () => pc?.rotate90(), { size: 'sm' });
  const zoomOut = iconButton('zoom-out', te.canvas.zoomOut, () => pc?.zoomOut(), { size: 'sm' });
  const zoomIn = iconButton('zoom-in', te.canvas.zoomIn, () => pc?.zoomIn(), { size: 'sm' });
  const zoomVal = h('button', { type: 'button', class: 'tx-zoom-val' }, '100%');
  tooltip(zoomVal, te.canvas.fitKey);
  zoomVal.addEventListener('click', () => pc?.zoomToFit());
  // Grid, tiling and zoom belong to the flat view: the 3D workspace hides them.
  for (const b of [gridBtn, tiledBtn, zoomOut, zoomVal, zoomIn]) b.classList.add('tx-2d-only');
  // (touch screens pinch to zoom: they hide these, and "Fit" is in the texture's menu)
  for (const b of [zoomOut, zoomVal, zoomIn]) b.classList.add('tx-zoom-ctl');
  const viewOpts = h(
    'div',
    { class: 'tx-optgroup tx-optgroup-view' },
    gridBtn,
    tiledBtn,
    h('span', { class: 'toolbar-sep tx-2d-only' }),
    flipH,
    flipV,
    rotate,
    h('span', { class: 'toolbar-sep tx-2d-only tx-zoom-ctl' }),
    zoomOut,
    zoomVal,
    zoomIn,
  );
  const optbar = h('div', { class: 'tx-optbar', role: 'toolbar', 'aria-label': te.canvas.toolOptions }, toolOpts, viewOpts);

  const dock = createColorDock(() => pc);
  const frames = createFrameStrip({
    select: (i) => selectFrame(i),
    add: () => anim.edit((a, t) => [duplicateFrame(a, t.frame), t.frame + 1]),
    // the moved frame is the one selected after it was picked up
    move: (from, to) => anim.edit((a) => [moveFrameTo(a, from, to), to]),
    remove: (i) => anim.remove(i),
    copy: (i) => anim.copy(i),
    paste: (i) => anim.paste(i),
    menu: (anchor) => anim.menu(anchor),
    timing: () => void anim.timing(),
    onion: () => anim.setOnion(onion === 'off' ? 'prev' : 'off'),
  });

  const workspace = h('div', { class: 'tx-workspace' }, rail, stage);
  // Short screens: wrap the vertical tool rail into two columns instead of scrolling it.
  const railRo = new ResizeObserver(() => {
    if (getComputedStyle(rail).flexDirection !== 'column') {
      rail.classList.remove('two-col');
      return;
    }
    rail.classList.remove('two-col');
    if (rail.scrollHeight > rail.clientHeight + 2) rail.classList.add('two-col');
  });
  railRo.observe(workspace);
  offs.push(() => railRo.disconnect());

  // Horizontal scrollers (the rail on phones, the options bar, the palette, the "Used by" chips):
  // fade the side with more to show.
  const scrollers = [rail, optbar, dock.scroller, ...(opts.belowHeader ? [opts.belowHeader] : [])].map((sc) => scrollFade(sc));
  offs.push(() => scrollers.forEach((f) => f.destroy()));
  const el = h(
    'section',
    { class: 'panel tx-center is-empty', 'aria-label': te.canvas.label },
    header,
    opts.belowHeader ?? null,
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
      const b = h('button', { type: 'button', class: 'tx-pick' }, h('span', { class: 'tx-pick-img checker' }, c), h('span', null, te.canvas.picks[q.pick]));
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
        h('h3', null, te.canvas.pickTitle),
        h('p', { class: 'muted' }, te.canvas.pickText),
        h('div', { class: 'tx-picks' }, chips),
        button({ label: te.canvas.browseAll, icon: 'search', variant: 'secondary', class: 'tx-browse-btn', onClick: () => opts.onBrowse() }),
      ),
    );
  };
  renderEmpty();

  // ---------------------------------------------------------------- canvas lifecycle
  const ensureCanvas = (img: ImageData): PixelCanvas => {
    if (pc) return pc;
    pc = new PixelCanvas(host, { image: img, showGrid: true, label: te.canvas.pixels, decodeImage: (b) => decodeImage(b), overlay: (ctx, view) => drawHover(ctx, view) });
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
      pc.on('hover', (p) => opts.onCanvasHover?.(p)),
    );
    syncSettings(pc.getSettings());
    return pc;
  };

  function syncSettings(s: PixelCanvasSettings) {
    // A shortcut picked a tool the model can't take (a shape, the selection): back to the pencil.
    if (ws === '3d' && pc && !TOOLS_3D.has(s.tool === 'rect-fill' ? 'rect' : s.tool)) {
      const label = TOOLS.find((t) => t.tool === (s.tool === 'rect-fill' ? 'rect' : s.tool))?.label ?? te.canvas.thatTool;
      toast(fmt(te.canvas.flatOnlyKey, { tool: label }), { duration: 3000 });
      pc.setTool('pencil');
      return;
    }
    for (const [tool, b] of railButtons) {
      b.setAttribute('aria-pressed', String(tool === s.tool || (tool === 'rect' && s.tool === 'rect-fill')));
      const off = ws === '3d' && !TOOLS_3D.has(tool);
      b.classList.toggle('is-2d-only', off);
      b.setAttribute('aria-disabled', String(off));
    }
    const rectB = railButtons.get('rect');
    const rectIcon = rectB?.querySelector<HTMLElement>('.icon');
    if (rectIcon) setIcon(rectIcon, s.tool === 'rect-fill' ? 'rect-fill' : 'rect');
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
    requestAnimationFrame(() => {
      scrollers.forEach((f) => f.paint());
    });
    opts.onSettings?.();
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
    const copy = t.anim ? cloneImageData(t.full) : img;
    if (t.base && !pc.canUndo() && samePixels(t.full, t.base)) {
      // everything was undone: the texture is untouched again, not an edit that looks like vanilla
      t.upscaled = t.baseUpscaled;
      if (store.isEdited(t.key)) store.resetToVanilla(t.key);
    } else {
      t.upscaled = false;
      store.setImage(t.key, copy);
    }
    store.events.emit('image', { path: t.key, full: copy });
    if (PAINT_TOOLS.has(pc.tool)) dock.noteUsed(pc.color as RGBA);
    paintHeader();
    if (paletteTimer) clearTimeout(paletteTimer);
    paletteTimer = setTimeout(() => dock.setPalette(pc ? paletteSource(pc.getImage()) : null), 400);
  }

  let hover3d: { pixels: readonly number[]; echo?: readonly number[] } | null = null;
  /** Texels a press on the 3D model would paint, outlined on the flat texture */
  function drawHover(ctx: CanvasRenderingContext2D, view: PixelView) {
    drawOnion(ctx, view);
    if (!hover3d || !pc) return;
    const w = pc.width;
    if (hover3d.echo?.length) outlineTexels(ctx, view, hover3d.echo, w, 0.55);
    outlineTexels(ctx, view, hover3d.pixels, w, 1);
  }

  // ---------------------------------------------------------------- onion skin
  const ONION_KEY = 'to-tex-onion';
  let onion: OnionMode = 'off';
  try {
    const v = localStorage.getItem(ONION_KEY);
    if (v === 'prev' || v === 'both') onion = v;
  } catch {
    /* storage blocked */
  }
  /** Bumped whenever the open texture's frames change place (cached onion pictures are then stale) */
  let animVersion = 0;
  let onionCache: { key: string; prev: HTMLCanvasElement | null; next: HTMLCanvasElement | null } = { key: '', prev: null, next: null };
  /** The frames before (and after) the one being painted, faintly over it */
  function drawOnion(ctx: CanvasRenderingContext2D, view: PixelView) {
    const t = cur;
    if (onion === 'off' || !t?.anim || t.anim.still || t.anim.count < 2) return;
    const a = t.anim;
    const key = `${t.key}|${t.frame}|${animVersion}|${onion}`;
    if (onionCache.key !== key) {
      const pic = (i: number) => {
        const c = document.createElement('canvas');
        paintCanvas(c, getFrame(t.full, a, (i + a.count) % a.count));
        return c;
      };
      onionCache = { key, prev: pic(t.frame - 1), next: onion === 'both' && a.count > 2 ? pic(t.frame + 1) : null };
    }
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (const [c, alpha] of [[onionCache.next, 0.2], [onionCache.prev, 0.34]] as const) {
      if (!c) continue;
      ctx.globalAlpha = alpha;
      ctx.drawImage(c, view.offsetX, view.offsetY, a.frameW * view.scale, a.frameH * view.scale);
    }
    ctx.restore();
  }

  let liveRaf = 0;
  /** A stroke in progress (painting on the model): the previews get its pixels without saving them yet. */
  function live() {
    if (liveRaf) return;
    liveRaf = requestAnimationFrame(() => {
      liveRaf = 0;
      const t = cur;
      if (!t || !pc) return;
      const img = pc.getImage();
      let full = img;
      if (t.anim) {
        full = cloneImageData(t.full);
        putFrame(full, t.anim, t.frame, img);
      }
      store.events.emit('image', { path: t.key, full });
    });
  }

  /** Keeps the open texture's undo steps for when it is opened again. */
  function stashHistory() {
    const t = cur;
    if (!t || !pc || t.key === ICON_KEY) return;
    if (!pc.canUndo() && !pc.canRedo()) {
      histories.delete(historyKey(t));
      return;
    }
    const k = historyKey(t);
    histories.delete(k);
    histories.set(k, { history: pc.saveHistory(), base: t.base, baseUpscaled: t.baseUpscaled });
    while (histories.size > KEPT_HISTORIES) histories.delete(histories.keys().next().value!);
  }

  /** Brings back the undo steps of a texture opened again, when its pixels are still the ones they lead to. */
  function restoreHistory(t: OpenTexture) {
    if (!pc) return;
    const k = historyKey(t);
    const kept = histories.get(k);
    if (!kept) return;
    histories.delete(k);
    if (pc.restoreHistory(kept.history)) {
      t.base = kept.base;
      t.baseUpscaled = kept.baseUpscaled;
    }
  }

  // ---------------------------------------------------------------- header paint
  function paintHeader() {
    const t = cur;
    headBadges.replaceChildren();
    if (!t) {
      headTitle.textContent = te.canvas.noTexture;
      headSub.textContent = te.canvas.chooseTexture;
      return;
    }
    const f0 = t.anim ? getFrame(t.full, t.anim, 0) : firstSquare(t.full);
    const f = t.alphaData && t.entry ? displayAlphaData(f0, t.entry.category) : f0;
    paintCanvas(headThumb, f);
    headTitle.textContent = t.name;
    const size = `${t.full.width}×${t.full.height}`;
    const cat = t.entry ? CATEGORY_INFO[t.entry.category].short : '';
    headSub.textContent = t.key === ICON_KEY ? fmt(te.canvas.packIconSub, { size }) : `${cat ? `${cat} · ` : ''}${size}${t.anim ? ` · ${fmt(te.canvas.frames, { count: t.anim.count })}` : ''} · ${t.entry?.id ?? t.key}`;
    headSub.title = t.key;
    const edited = t.key === ICON_KEY ? !!project.icon : store.isEdited(t.key);
    if (edited && t.key !== ICON_KEY) headBadges.append(badge(te.canvas.edited, 'green'));
    if (t.anim && !t.anim.still) headBadges.append(badge(te.canvas.animated, 'blue'));
    if (t.upscaled) {
      const b = badge(fmt(te.canvas.upscaled, { res: project.resolution }), 'purple');
      tooltip(b, fmt(te.canvas.upscaledHint, { width: String(t.vanilla?.width), height: String(t.vanilla?.height), res: project.resolution }));
      headBadges.append(b);
    }
    if (t.entry?.custom) headBadges.append(badge(te.canvas.custom, 'gold'));
    const canCompare = !!t.vanilla && (edited || t.upscaled);
    compareBtn.disabled = !canCompare;
    resetBtn.disabled = t.key === ICON_KEY ? !project.icon : !edited;
    resetBtn.querySelector('.btn-label')!.textContent = t.vanilla || t.key === ICON_KEY ? te.canvas.reset : te.canvas.remove;
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
      return { key: ICON_KEY, entry: null, name: te.canvas.packIcon, full, vanilla: null, upscaled: false, anim: null, frame: 0, alphaData: false, base: null, baseUpscaled: false };
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
    let anim = entry ? await readAnimInfo(project, store.assets, entry, full, vanilla?.width ?? null) : null;
    if (!anim && entry && project.edition === 'bedrock' && isBedrockStrip(entry, full)) anim = stripLayout(full);
    const alphaData = project.edition === 'bedrock' && /\.tga$/i.test(path) && hasAlphaData(full);
    const pristine = !edited && !!vanilla;
    return { key: path, entry, name: entry?.pretty ?? path, full, vanilla, upscaled, anim, frame: 0, alphaData, base: pristine ? cloneImageData(full) : null, baseUpscaled: upscaled };
  }

  const defaultIcon = (): Promise<ImageData> => autoPackIcon(store, 64);

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
      toast(err instanceof Error ? err.message : te.canvas.openFailed, { tone: 'error' });
      return;
    } finally {
      if (loadingTimer) clearTimeout(loadingTimer);
    }
    if (my !== token) return;
    loading.hidden = true;
    stashHistory();
    cur = t;
    el.classList.remove('is-empty');
    const frameImg = getFrame(t.full, t.anim, 0);
    const canvas = ensureCanvas(frameImg);
    canvas.setImage(frameImg, { resetHistory: true, resetView: true });
    restoreHistory(t);
    // Alpha that is data (tint / dye / glow masks): paint colours by default so the mask survives.
    canvas.setChannelMode(t.alphaData ? 'rgb' : 'rgba');
    paintBanner(t);
    animVersion++;
    frames.set(t.full, t.anim, 0, stripOpts(t));
    dock.setPalette(paletteSource(frameImg));
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
    stashHistory();
    t.frame = i;
    const f = getFrame(t.full, t.anim, i);
    pc.setImage(f, { resetHistory: true, resetView: false });
    restoreHistory(t);
    dock.setPalette(paletteSource(f));
    opts.onHistory();
    opts.onFrame?.(t);
    if (comparing) drawCompare();
  }

  function setWorkspace(next: Workspace) {
    if (next === ws) return;
    ws = next;
    wsSwitch.setValue(ws);
    el.dataset.workspace = ws;
    stage3d.hidden = ws !== '3d';
    if (ws === '3d') {
      setCompare(false);
      if (pc && !TOOLS_3D.has(pc.tool === 'rect-fill' ? 'rect' : pc.tool)) {
        if (pc.getSelection()) pc.deselect();
        pc.setTool('pencil');
      }
    } else if (!canvasBox.isConnected || canvasBox.parentElement !== stage) {
      stage.insertBefore(canvasBox, stage3d);
    }
    if (pc) syncSettings(pc.getSettings());
    requestAnimationFrame(() => pc?.redraw());
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
    // a GIF (or several pictures) brings frames: the animation maker's import
    const list = [...(e.dataTransfer?.files ?? [])];
    if (f && (list.length > 1 || /\.gif$/i.test(f.name) || f.type === 'image/gif') && cur.key !== ICON_KEY) void anim.import(list);
    else if (f) panel.upload(cur.key, f);
  });

  // ---------------------------------------------------------------- replace / reset helpers
  /** Replaces the open texture's pixels (undo through a toast when history can't cover it). */
  async function replaceFull(path: string, next: ImageData, label: string, viaHistory: boolean) {
    const before = cur && cur.key === path ? cloneImageData(cur.full) : null;
    const wasEdited = path === ICON_KEY ? !!project.icon : store.isEdited(path);
    if (cur && cur.key === path && viaHistory && pc && !cur.anim && pc.width === next.width && pc.height === next.height) {
      pc.setImage(next, { resetHistory: false, resetView: false });
      onChange(pc.getImage());
      toast(fmt(byPointer(te.canvas.undoHint, te.canvas.undoHintTouch), { action: label }), { tone: 'success' });
      return;
    }
    store.setImage(path, next);
    if (cur && cur.key === path) await open(path);
    store.events.emit('image', { path, full: next });
    toast(label, {
      tone: 'success',
      action: before
        ? {
            label: te.canvas.undo,
            onClick: () => {
              if (wasEdited) store.setImage(path, before);
              else if (path !== ICON_KEY) store.resetToVanilla(path);
              if (cur?.key === path) void open(path);
            },
          }
        : undefined,
    });
  }

  // ---------------------------------------------------------------- animation maker
  /** How the game blends frames for this pack (Java before 1.21.2 keeps the first frame's alpha) */
  const blendMode = (): 'rgba' | 'rgb' => (project.edition === 'java' ? javaAnimRules(project.version).blend : 'rgba');
  const stripOpts = (t: OpenTexture) => ({ editable: !!t.anim && !t.anim.still && t.key !== ICON_KEY, blend: blendMode() });
  /** A frame copied with "Copy frame" (pasted into any animation, resized to its frames) */
  let frameClip: ImageData | null = null;

  /** The open texture's animation as the editor saves it (from the pack's or the game's timing the first time). */
  const animatedOf = (t: OpenTexture): Animated | null => (t.anim && !t.anim.still ? { full: t.full, anim: store.animation(t.key) ?? recordFromInfo(t.anim) } : null);

  /**
   * Puts new frames and timing on the open texture (null animation: it isn't animated any more) and
   * shows `frame`. `undo`: a toast with Undo, for changes the pixel history can't take back.
   */
  function applyAnim(t: OpenTexture, next: { full: ImageData; anim: TextureAnimation | null }, frame: number, undo?: string) {
    const before = { full: cloneImageData(t.full), anim: store.animation(t.key) ?? null, frame: t.frame, edited: store.isEdited(t.key) };
    // the frames moved: their undo steps no longer fit
    for (const k of [...histories.keys()]) if (k.startsWith(`${t.key}#`)) histories.delete(k);
    store.setImage(t.key, next.full);
    store.setAnimation(t.key, next.anim);
    animVersion++;
    const restore = () => {
      if (before.edited) store.setImage(t.key, before.full);
      else store.resetToVanilla(t.key);
      store.setAnimation(t.key, before.anim);
      if (cur?.key === t.key) void open(t.key).then(() => cur && cur.anim && selectFrame(Math.min(before.frame, cur.anim.count - 1)));
    };
    const toastUndo = () => undo && toast(undo, { tone: 'success', action: { label: te.canvas.undo, onClick: restore } });
    const info = next.anim ? animInfoFromRecord(next.anim, next.full.width, next.full.height) : null;
    if (!info || info.count < 2 || !pc || cur !== t) {
      // not animated any more (or another texture is open): read it again as the game would
      if (cur === t) void open(t.key).then(() => opts.onAnimation?.(cur!));
      toastUndo();
      return;
    }
    const sameSize = t.anim?.frameW === info.frameW && t.anim?.frameH === info.frameH;
    t.full = next.full;
    t.anim = info;
    t.frame = Math.max(0, Math.min(info.count - 1, frame));
    t.upscaled = false;
    t.base = null;
    t.baseUpscaled = false;
    const f = getFrame(t.full, t.anim, t.frame);
    pc.setImage(f, { resetHistory: true, resetView: !sameSize });
    frames.set(t.full, t.anim, t.frame, stripOpts(t));
    dock.setPalette(paletteSource(f));
    store.events.emit('image', { path: t.key, full: t.full });
    paintHeader();
    opts.onHistory();
    opts.onAnimation?.(t);
    toastUndo();
  }

  const cantText = (b: AnimBlock): string => ta.cant[b];

  async function blockOf(t: OpenTexture): Promise<AnimBlock | null> {
    if (t.key === ICON_KEY) return 'icon';
    const fw = t.anim ? t.anim.frameW : t.full.width;
    const fh = t.anim ? t.anim.frameH : t.full.height;
    try {
      return await animBlock(t.key, { w: fw, h: fh }, project, store.assets);
    } catch {
      return null;
    }
  }

  function showCant(b: AnimBlock) {
    openModal({
      title: ta.cant.title,
      body: h('p', { class: 'tx-cant-anim' }, icon(project.edition === 'bedrock' ? 'info' : 'warning'), h('span', null, cantText(b))),
      width: 460,
      class: 'tx-cant-modal',
      actions: [{ label: kit.ok, variant: 'primary' }],
    });
  }

  const dialogs = () => import('../anim/dialogs');

  const anim = {
    /** Makes the open (still) texture animated: two copies of it, or the frames of a strip */
    async make() {
      const t = cur;
      if (!t || (t.anim && !t.anim.still)) return;
      const b = await blockOf(t);
      if (b) return showCant(b);
      if (cur !== t) return;
      const strip = t.anim?.still ? t.anim : null;
      const r = makeAnimated(t.full, strip ? strip.frameW : t.full.width, strip ? strip.frameH : t.full.height);
      const n = r.full.height / r.anim.frameHeight;
      applyAnim(t, r, strip ? t.frame : 1);
      toast(fmt(ta.made, { count: n }), { tone: 'success', duration: 5000 });
    },
    /** Applies a change to the open animation: `fn` gives its new frames and timing and the frame to show */
    edit(fn: (a: Animated, t: OpenTexture) => [Animated, number], undo?: string) {
      const t = cur;
      const a = t && animatedOf(t);
      if (!t || !a) return;
      const [next, frame] = fn(a, t);
      if (next === a) {
        if (next.full.height / next.anim.frameHeight >= maxFramesFor(next.anim.frameHeight)) toast(fmt(ta.toasts.tooMany, { max: maxFramesFor(next.anim.frameHeight) }), { tone: 'warn' });
        return;
      }
      applyAnim(t, next, frame, undo);
    },
    remove(i: number) {
      const t = cur;
      const a = t && animatedOf(t);
      if (!t || !a) return;
      const { next, full } = deleteFrame(a, i);
      if (next) applyAnim(t, next, Math.min(i, next.full.height / next.anim.frameHeight - 1), fmt(ta.toasts.deleted, { n: i + 1 }));
      else applyAnim(t, { full, anim: null }, 0, fmt(ta.toasts.stillNow, { n: i + 1 }));
    },
    copy(i: number) {
      const t = cur;
      if (!t?.anim) return;
      frameClip = cloneImageData(getFrame(t.full, t.anim, i));
      toast(fmt(ta.toasts.copied, { n: i + 1 }), { tone: 'success', duration: 1600 });
    },
    paste(i: number) {
      if (!frameClip) {
        toast(ta.toasts.nothingToPaste, { tone: 'info' });
        return;
      }
      const clip = frameClip;
      anim.edit((a) => [addFrames(a, i + 1, [clip]), i + 1]);
    },
    still() {
      const t = cur;
      if (!t?.anim) return;
      applyAnim(t, { full: cloneImageData(getFrame(t.full, t.anim, t.frame)), anim: null }, 0, fmt(ta.toasts.still, { n: t.frame + 1 }));
    },
    setOnion(mode: OnionMode) {
      onion = mode;
      frames.setOnion(mode);
      try {
        localStorage.setItem(ONION_KEY, mode);
      } catch {
        /* storage blocked */
      }
      pc?.redraw();
    },
    menu(anchor: HTMLElement) {
      const t = cur;
      if (!t?.anim) return;
      const n = t.anim.count;
      const i = t.frame;
      openMenu(anchor, [
        { label: ta.actions.duplicate, icon: 'plus', onClick: () => anim.edit((a) => [duplicateFrame(a, i), i + 1]) },
        { label: ta.actions.empty, icon: 'image-new', onClick: () => anim.edit((a) => [addEmptyFrame(a, i), i + 1]) },
        { label: byPointer(ta.actions.copyKey, ta.actions.copy), icon: 'copy', onClick: () => anim.copy(i) },
        { label: byPointer(ta.actions.pasteKey, ta.actions.paste), icon: 'clipboard', disabled: !frameClip, onClick: () => anim.paste(i) },
        { label: ta.actions.left, icon: 'arrow-left', disabled: i === 0, onClick: () => anim.edit((a) => [moveFrameTo(a, i, i - 1), i - 1]) },
        { label: ta.actions.right, icon: 'arrow-right', disabled: i === n - 1, onClick: () => anim.edit((a) => [moveFrameTo(a, i, i + 1), i + 1]) },
        { label: byPointer(ta.actions.deleteKey, ta.actions.delete), icon: 'trash', danger: true, onClick: () => anim.remove(i) },
        { label: ta.actions.timing, icon: 'clock', onClick: () => void anim.timing() },
        { label: onion === 'both' ? ta.actions.nextOff : ta.actions.next, icon: 'images', onClick: () => anim.setOnion(onion === 'both' ? 'prev' : 'both') },
        { label: ta.actions.import, icon: 'upload', onClick: () => void anim.import() },
        { label: ta.actions.gif, icon: 'download', onClick: () => void anim.gif() },
        { label: ta.actions.still, icon: 'image', onClick: () => anim.still() },
      ], { label: ta.strip.more, placement: 'top-end' });
    },
    async timing() {
      const t = cur;
      const a = t && animatedOf(t);
      if (!t || !a) return;
      const { openTimingDialog } = await dialogs();
      openTimingDialog({
        anim: a.anim,
        frames: framesOf(a),
        edition: project.edition,
        canBlend: project.edition === 'bedrock' || javaAnimRules(project.version).interpolate,
        blend: blendMode(),
        onApply: (next) => {
          if (cur === t) applyAnim(t, { full: t.full, anim: next }, t.frame, ta.toasts.timing);
        },
      });
    },
    async import(files?: File[]) {
      const t = cur;
      if (!t) return;
      const a = animatedOf(t);
      if (!a) {
        const b = await blockOf(t);
        if (b) return showCant(b);
      }
      const strip = t.anim?.still ? t.anim : null;
      const fw = a ? a.anim.frameWidth : strip ? strip.frameW : t.full.width;
      const fh = a ? a.anim.frameHeight : strip ? strip.frameH : t.full.height;
      const n = a ? a.full.height / a.anim.frameHeight : 0;
      const { openImportDialog } = await dialogs();
      openImportDialog({
        frameW: fw,
        frameH: fh,
        animated: !!a,
        current: t.frame,
        room: { replace: maxFramesFor(fh), after: Math.max(0, maxFramesFor(fh) - n) },
        blend: blendMode(),
        files,
        onApply: (list, times, mode) => {
          if (cur !== t) return;
          const label = fmt(ta.toasts.imported, { count: list.length });
          if (a && mode === 'after') {
            const now = animatedOf(t) ?? a;
            applyAnim(t, addFrames(now, t.frame + 1, list, times ?? []), t.frame + 1, label);
            return;
          }
          const base: Animated = a ?? { full: t.full, anim: { frameWidth: fw, frameHeight: fh, frametime: NEW_FRAMETIME, updatedAt: Date.now() } };
          const r = replaceFrames(base, list, times ?? undefined);
          applyAnim(t, r.full.height / fh >= 2 ? r : { full: r.full, anim: null }, 0, label);
        },
      });
    },
    async gif() {
      const t = cur;
      if (!t?.anim || t.anim.still) return;
      const a = t.anim;
      const { openGifDialog } = await dialogs();
      openGifDialog({
        name: t.entry?.name ?? 'animation',
        source: { frames: Array.from({ length: a.count }, (_, i) => getFrame(t.full, a, i)), steps: a.sequence, interpolate: !!a.interpolate, blend: blendMode() },
      });
    },
  };
  frames.setOnion(onion);

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
        toast(te.canvas.uploadFirst, { tone: 'info' });
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
            void replaceFull(key, next, fmt(te.canvas.replaced, { name: t.name }), true);
          },
        });
      };
      void go().catch((err) => toast(err instanceof Error ? err.message : te.canvas.openTextureFailed, { tone: 'error' }));
    },
    async reset(path) {
      const key = path ?? cur?.key;
      if (!key) return;
      if (key === ICON_KEY) {
        store.setIconBlob(undefined);
        if (cur?.key === ICON_KEY) await open(ICON_KEY);
        toast(te.canvas.iconReset, { tone: 'success' });
        return;
      }
      const hasVanilla = store.assets.hasFile(key);
      const name = store.byPath.get(key)?.pretty ?? key;
      if (!hasVanilla) {
        const ok = await confirmDialog(te.canvas.removeTitle, fmt(te.canvas.removeText, { name, version: store.assets.version }), te.canvas.remove, true);
        if (!ok) return;
      }
      let before: ImageData | null = null;
      try {
        before = cloneImageData(await store.getFull(key));
      } catch {
        before = null;
      }
      // an animation made here goes with its pixels (and comes back with them)
      const beforeAnim = store.animation(key) ?? null;
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
      toast(fmt(hasVanilla ? te.canvas.backToVanilla : te.canvas.removed, { name }), {
        tone: 'success',
        action: before
          ? {
              label: te.canvas.undo,
              onClick: () => {
                store.setImage(key, before!);
                if (beforeAnim) store.setAnimation(key, beforeAnim);
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
        toast(err instanceof Error ? err.message : te.canvas.downloadFailed, { tone: 'error' });
      }
    },
    setCompare,
    stepFrame(d) {
      if (!cur?.anim) return;
      selectFrame((cur.frame + d + cur.anim.count) % cur.anim.count);
      frames.set(cur.full, cur.anim, cur.frame, stripOpts(cur));
    },
    focusCanvas: () => pc?.focus(),
    setWorkspace,
    workspace: () => ws,
    canvasBox,
    stage3d,
    live,
    showHover(hv) {
      if (!hv && !hover3d) return;
      hover3d = hv;
      pc?.redraw();
    },
    destroy() {
      offs.forEach((f) => f());
      if (liveRaf) cancelAnimationFrame(liveRaf);
      histories.clear();
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
  // the key-up never arrives when the window loses focus mid-hold
  const onBlur = () => setCompare(false);
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  window.addEventListener('blur', onBlur);
  offs.push(() => {
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
    window.removeEventListener('blur', onBlur);
  });
  offs.push(store.events.on('entries', () => renderEmpty()));

  paintHeader();
  return panel;
}

/** Texels (y * width + x) as an outline on the pixel editor: dark halo, light line, in screen space. */
function outlineTexels(ctx: CanvasRenderingContext2D, view: PixelView, pixels: readonly number[], width: number, alpha: number): void {
  if (!pixels.length) return;
  const set = new Set(pixels);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  const edge = (x0: number, y0: number, x1: number, y1: number) => {
    const [ax, ay] = view.toScreen(x0, y0);
    const [bx, by] = view.toScreen(x1, y1);
    ctx.moveTo(Math.round(ax) + 0.5, Math.round(ay) + 0.5);
    ctx.lineTo(Math.round(bx) + 0.5, Math.round(by) + 0.5);
  };
  for (const p of set) {
    const x = p % width;
    const y = (p - x) / width;
    if (!set.has(p - width)) edge(x, y, x + 1, y);
    if (!set.has(p + width)) edge(x, y + 1, x + 1, y + 1);
    if (x === 0 || !set.has(p - 1)) edge(x, y, x, y + 1);
    if (x === width - 1 || !set.has(p + 1)) edge(x + 1, y, x + 1, y + 1);
  }
  ctx.lineCap = 'square';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.stroke();
  ctx.restore();
}
