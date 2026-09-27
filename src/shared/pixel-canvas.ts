// Pixel editing engine shared by the texture and skin editors.
// The model is a straight-RGBA ImageData owned by this class. Canvases are only used for display:
// pixels are pushed with putImageData onto an internal canvas and never read back.

import './pixel-canvas.css';
import {
  type BrushShape,
  type ChannelMode,
  type Point,
  type RGBA,
  type Rect,
  brushOffsets,
  brushOrigin,
  brushOriginAt,
  clamp,
  clampByte,
  clampRect,
  clearPixels,
  cloneImage,
  constrainSquare,
  copyRegion,
  createImage,
  diffBounds,
  extractRect,
  flipHorizontal,
  flipVertical,
  floodFill,
  forEachEllipsePoint,
  forEachLinePoint,
  forEachRectPoint,
  mod,
  noiseColor,
  normalizeRect,
  outlineSegments,
  pasteImage,
  pickColor,
  rectContains,
  rectsEqual,
  rgbaToHex,
  rotate90,
  sameColor,
  scaleNearest,
  shadePixel,
  snapLineEnd,
  stampLine,
  unionRect,
  writePixel,
  writeRegion,
} from './pixel-algorithms';

export type { BrushShape, ChannelMode, RGBA, Rect } from './pixel-algorithms';

export type Tool =
  | 'pencil' | 'eraser' | 'fill' | 'picker' | 'line' | 'rect' | 'rect-fill' | 'ellipse'
  | 'lighten' | 'darken' | 'noise' | 'select' | 'move';

export const TOOLS: readonly Tool[] = [
  'pencil', 'eraser', 'fill', 'picker', 'line', 'rect', 'rect-fill', 'ellipse', 'lighten', 'darken', 'noise', 'select', 'move',
];

export interface PixelView {
  /** CSS pixels per image pixel */
  scale: number;
  /** CSS position of the image's top-left corner inside the canvas element */
  offsetX: number;
  offsetY: number;
  /** Image pixel coords -> CSS coords relative to the canvas element */
  toScreen(x: number, y: number): [number, number];
}

/** Custom symmetry: returns the pixels that should also be painted when (x, y) is painted. */
export type MirrorMap = (x: number, y: number) => ReadonlyArray<readonly [number, number]>;

export interface PixelCanvasOptions {
  image: ImageData;
  /** Draws after pixels (grid, part outlines, labels). ctx is in screen space (CSS px); use toScreen() */
  overlay?: ((ctx: CanvasRenderingContext2D, view: PixelView) => void) | null;
  /** Optional per-pixel paint mask (non-zero = editable), length width*height */
  mask?: Uint8Array | null;
  /** Pixel grid (only drawn at zoom >= 6). Default true. */
  showGrid?: boolean;
  /** Draw a 3x3 tiled ghost around the image; painting wraps around the edges. */
  tiledPreview?: boolean;
  /** Small coordinates / zoom readout in the corner. Default true. */
  hud?: boolean;
  /** Darken pixels the mask locks. Default true. */
  dimMasked?: boolean;
  /** Accessible name. Default "Pixel editor". */
  label?: string;
  /** Replaces the geometric mirror when mirrorX or mirrorY is on (e.g. mirroring skin limbs). */
  mirrorMap?: MirrorMap | null;
  /** Enables pasting images from the system clipboard (must decode to straight RGBA). */
  decodeImage?: (file: Blob) => Promise<ImageData>;
}

export interface PixelCanvasSettings {
  tool: Tool;
  color: RGBA;
  secondaryColor: RGBA;
  brushSize: number;
  brushShape: BrushShape;
  mirrorX: boolean;
  mirrorY: boolean;
  fillContiguous: boolean;
  fillTolerance: number;
  shadeStrength: number;
  showGrid: boolean;
  tiledPreview: boolean;
  channelMode: ChannelMode;
}

export interface PixelCanvasEvents {
  change: ImageData;
  colorpick: RGBA;
  hover: { x: number; y: number } | null;
  history: void;
  tool: Tool;
  settings: PixelCanvasSettings;
  zoom: number;
  selection: Rect | null;
}

export const PIXEL_SHORTCUTS: ReadonlyArray<{ keys: string; action: string }> = [
  { keys: 'B', action: 'Pencil' },
  { keys: 'E', action: 'Eraser' },
  { keys: 'G', action: 'Fill bucket' },
  { keys: 'I', action: 'Color picker' },
  { keys: 'Alt (hold)', action: 'Temporary color picker' },
  { keys: 'L', action: 'Line (hold Shift to snap angles)' },
  { keys: 'U', action: 'Rectangle (press again for filled)' },
  { keys: 'O', action: 'Ellipse (hold Shift for a circle)' },
  { keys: 'M', action: 'Select' },
  { keys: 'V', action: 'Move' },
  { keys: 'X', action: 'Swap primary and secondary colors' },
  { keys: '[ ]', action: 'Smaller / bigger brush' },
  { keys: 'Shift + click', action: 'Straight line from the last point' },
  { keys: 'Right click', action: 'Paint with the secondary color' },
  { keys: 'Ctrl/Cmd + Z', action: 'Undo' },
  { keys: 'Ctrl/Cmd + Shift + Z, Ctrl + Y', action: 'Redo' },
  { keys: 'Ctrl/Cmd + A, Ctrl/Cmd + D', action: 'Select all, deselect' },
  { keys: 'Ctrl/Cmd + C / X / V', action: 'Copy, cut, paste' },
  { keys: 'Delete', action: 'Clear the selection' },
  { keys: 'Enter, Esc', action: 'Drop the moved selection, deselect' },
  { keys: 'Arrow keys', action: 'Nudge the selection (Shift: 8 px)' },
  { keys: 'H, Shift + H', action: 'Flip horizontally, vertically' },
  { keys: 'R', action: 'Rotate 90°' },
  { keys: '#', action: 'Toggle pixel grid' },
  { keys: '0', action: 'Zoom to fit' },
  { keys: '+ / -', action: 'Zoom in / out' },
  { keys: 'Space + drag, middle drag', action: 'Pan' },
  { keys: 'Mouse wheel, pinch', action: 'Zoom' },
  { keys: 'Two-finger tap', action: 'Undo (touch screens)' },
];

// Zoom levels in device pixels per image pixel. Integers keep every image pixel the same size on screen.
const ZOOM_STEPS = [1 / 16, 1 / 12, 1 / 8, 1 / 6, 1 / 4, 1 / 3, 1 / 2, 1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256];
const MAX_DS = 256;
const GRID_MIN_SCALE = 6;
const MAX_BRUSH = 64;
const HISTORY_BUDGET = 64 * 1024 * 1024;
const HISTORY_MAX = 500;
const HISTORY_MIN = 16;
const HISTORY_HARD_LIMIT = 3 * HISTORY_BUDGET;
const TOOL_KEYS: Record<string, Tool> = { b: 'pencil', e: 'eraser', g: 'fill', i: 'picker', l: 'line', o: 'ellipse', m: 'select', v: 'move' };
const TOOL_SET = new Set<string>(TOOLS);

type PaintOp = 'set' | 'lighten' | 'darken' | 'noise';
/** Tools that paint along a stroke (also accepted by beginStroke). */
export type StrokeTool = 'pencil' | 'eraser' | 'lighten' | 'darken' | 'noise';
type ShapeTool = 'line' | 'rect' | 'rect-fill' | 'ellipse';

interface Floating {
  buf: ImageData;
  x: number;
  y: number;
  /** The image with the lifted pixels removed */
  base: Uint8ClampedArray<ArrayBuffer>;
  /** Lifted without a user selection (move tool on the whole image) */
  implicit: boolean;
  /** Image area last written by compose() */
  composed: Rect | null;
}

interface RectEntry { kind: 'rect'; rect: Rect; data: Uint8ClampedArray<ArrayBuffer>; selBefore: Rect | null; selAfter: Rect | null }
interface FullEntry { kind: 'full'; width: number; height: number; data: Uint8ClampedArray<ArrayBuffer>; selBefore: Rect | null; selAfter: Rect | null }
type HistoryEntry = RectEntry | FullEntry;

type Gesture =
  | { kind: 'stroke'; id: number; touch: boolean; last: Point; lastF: [number, number] }
  | { kind: 'shape'; id: number; touch: boolean; tool: ShapeTool; start: Point; end: Point }
  | { kind: 'pick'; id: number; touch: boolean; secondary: boolean }
  | { kind: 'pan'; id: number; touch: boolean; cx: number; cy: number; ox: number; oy: number }
  | { kind: 'marquee'; id: number; touch: boolean; start: Point; moved: boolean; prevSel: Rect | null }
  | { kind: 'move'; id: number; touch: boolean; fx: number; fy: number; x0: number; y0: number; moved: boolean; lifted: boolean }
  | { kind: 'pinch'; ids: [number, number]; d0: number; ds0: number; ix: number; iy: number; mx0: number; my0: number; t0: number; travel: number }
  | { kind: 'ignore'; id: number; touch: boolean }
  /** A stroke driven through beginStroke() / setPixels() / endStroke(), e.g. painting on a 3D model. */
  | { kind: 'external'; id: number; touch: boolean };

type Listener = (arg: never) => void;

let activeCanvas: PixelCanvas | null = null;
let clipboard: { img: ImageData; token: string } | null = null;
let idCounter = 0;

// Inputs that take typed text. Sliders, checkboxes and colour wells do not, so shortcuts keep working after using them.
const TEXT_INPUT_TYPES = new Set(['text', 'search', 'url', 'tel', 'email', 'password', 'number', 'date', 'datetime-local', 'month', 'time', 'week']);

function isEditableTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable) return true;
  if (t instanceof HTMLInputElement) return TEXT_INPUT_TYPES.has(t.type);
  const tag = t.tagName;
  return tag === 'TEXTAREA' || tag === 'SELECT';
}

function hasTextSelection(): boolean {
  const s = typeof window.getSelection === 'function' ? window.getSelection() : null;
  return !!s && !s.isCollapsed && s.toString().length > 0;
}

function normalizeColor(c: ArrayLike<number>): RGBA {
  return [clampByte(c[0] ?? 0), clampByte(c[1] ?? 0), clampByte(c[2] ?? 0), clampByte(c[3] ?? 255)];
}

export class PixelCanvas {
  readonly element: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly imgCanvas: HTMLCanvasElement;
  private readonly imgCtx: CanvasRenderingContext2D;
  private maskCanvas: HTMLCanvasElement | null = null;
  private readonly hud: HTMLDivElement;
  private readonly hudPos: HTMLSpanElement;
  private readonly hudZoom: HTMLSpanElement;
  private readonly live: HTMLDivElement;

  private img: ImageData;
  private baseline: Uint8ClampedArray<ArrayBuffer>;
  private display: ImageData | null = null;
  private mask: Uint8Array | null = null;
  private overlay: PixelCanvasOptions['overlay'] = null;
  private overlayFailed = false;
  private mirrorMap: MirrorMap | null;
  private readonly decode: ((file: Blob) => Promise<ImageData>) | null;
  private readonly dimMasked: boolean;

  private _tool: Tool = 'pencil';
  private _color: RGBA = [0, 0, 0, 255];
  private _secondary: RGBA = [0, 0, 0, 0];
  private _brushSize = 1;
  private _brushShape: BrushShape = 'square';
  private _mirrorX = false;
  private _mirrorY = false;
  private _fillContiguous = true;
  private _fillTolerance = 0;
  private _shadeStrength = 0.15;
  private _showGrid: boolean;
  private _tiled: boolean;
  private _channelMode: ChannelMode = 'rgba';

  private dpr = 1;
  private ds = 1;
  private ox = 0;
  private oy = 0;
  private autoFit = true;
  private viewReady = false;
  private zoomAcc = 0;
  private lastZoomWheel = 0;
  private lastPanWheel = 0;

  private gesture: Gesture | null = null;
  private readonly touches = new Map<number, { x: number; y: number }>();
  private penDown = false;
  private hoverF: [number, number] | null = null;
  private hoverPixel: { x: number; y: number } | null = null;
  private hoverIsTouch = false;
  private pointerInside = false;
  private spaceDown = false;
  private altDown = false;
  private shiftDown = false;
  private lastPointF: [number, number] | null = null;
  private lastShapeShift = false;
  private pendingZoom = 0;
  private kb: Point | null = null;
  private clientRect: DOMRect | null = null;

  private sel: Rect | null = null;
  private committedSel: Rect | null = null;
  private float: Floating | null = null;
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private touched: Uint32Array;
  private gen = 0;
  private clip: Rect | null = null;
  private op: PaintOp = 'set';
  private opColor: RGBA = [0, 0, 0, 255];
  private opAmount = 0;
  private sx0 = Infinity; private sy0 = Infinity; private sx1 = -1; private sy1 = -1;
  /** Counts pixels plotRaw actually changed (setPixels reports whether anything changed). */
  private plotChanges = 0;
  private dx0 = Infinity; private dy0 = Infinity; private dx1 = -1; private dy1 = -1;

  private raf = 0;
  private destroyed = false;
  private checker: CanvasPattern | null = null;
  private checkerKey = '';
  private pixelChecker: CanvasPattern | null = null;
  private pixelCheckerKey = '';
  private colors = { a: '#282e3c', b: '#1f2430', grid: 'rgba(0,0,0,0.3)', gridLight: 'rgba(255,255,255,0.1)', border: 'rgba(255,255,255,0.16)', accent: '#5bd35b', mask: 'rgba(6,8,12,0.58)' };
  private colorsPending = false;
  private dprCleanup: (() => void) | null = null;
  private antsTimer = 0;
  private antsPhase = 0;
  private liveTimer = 0;
  private readonly reducedMotion: MediaQueryList | null;
  private readonly ro: ResizeObserver;
  private readonly themeObserver: MutationObserver;
  private readonly cleanups: Array<() => void> = [];
  private readonly listeners = new Map<keyof PixelCanvasEvents, Set<Listener>>();

  constructor(container: HTMLElement, opts: PixelCanvasOptions) {
    if (!opts || !opts.image || !(opts.image.width > 0) || !(opts.image.height > 0)) {
      throw new Error('PixelCanvas needs a non-empty image');
    }
    const uid = ++idCounter;
    this.element = document.createElement('div');
    this.element.className = 'pc-root';
    this.element.tabIndex = 0;
    this.element.setAttribute('role', 'application');
    this.element.setAttribute('aria-roledescription', 'pixel editor');
    this.element.setAttribute('aria-label', opts.label ?? 'Pixel editor');

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'pc-canvas';
    this.canvas.dataset.cursor = 'paint';
    this.canvas.setAttribute('aria-hidden', 'true');

    this.hud = document.createElement('div');
    this.hud.className = 'pc-hud';
    this.hud.setAttribute('aria-hidden', 'true');
    this.hudPos = document.createElement('span');
    this.hudPos.className = 'pc-hud-pos';
    const sep = document.createElement('span');
    sep.className = 'pc-hud-sep';
    sep.textContent = '·';
    this.hudZoom = document.createElement('span');
    this.hudZoom.className = 'pc-hud-zoom';
    this.hud.append(this.hudPos, sep, this.hudZoom);
    this.hud.hidden = opts.hud === false;

    const help = document.createElement('div');
    help.className = 'pc-sr';
    help.id = `pc-help-${uid}`;
    help.textContent = 'Arrow keys move the keyboard cursor, Enter uses the current tool there. Tool shortcuts: B pencil, E eraser, G fill, I picker, L line, U rectangle, O ellipse, M select, V move. Ctrl+Z undo.';
    this.element.setAttribute('aria-describedby', help.id);
    this.live = document.createElement('div');
    this.live.className = 'pc-sr';
    this.live.setAttribute('aria-live', 'polite');

    this.element.append(this.canvas, this.hud, help, this.live);

    const ctx = this.canvas.getContext('2d');
    this.imgCanvas = document.createElement('canvas');
    const imgCtx = this.imgCanvas.getContext('2d');
    if (!ctx || !imgCtx) throw new Error('This browser cannot draw on a canvas');
    this.ctx = ctx;
    this.imgCtx = imgCtx;

    this.img = cloneImage(opts.image);
    this.baseline = this.img.data.slice();
    this.touched = new Uint32Array(this.img.width * this.img.height);
    this.imgCanvas.width = this.img.width;
    this.imgCanvas.height = this.img.height;
    this._showGrid = opts.showGrid ?? true;
    this._tiled = !!opts.tiledPreview;
    this.overlay = opts.overlay ?? null;
    this.mirrorMap = opts.mirrorMap ?? null;
    this.decode = opts.decodeImage ?? null;
    this.dimMasked = opts.dimMasked !== false;
    this.dpr = window.devicePixelRatio || 1;
    this.reducedMotion = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

    container.appendChild(this.element);
    this.refreshColors();
    this.applyMask(opts.mask ?? null);
    this.markAll();

    // Events
    const c = this.canvas;
    this.listen(c, 'pointerdown', this.onPointerDown as EventListener);
    this.listen(c, 'pointermove', this.onPointerMove as EventListener);
    this.listen(c, 'pointerup', this.onPointerUp as EventListener);
    this.listen(c, 'pointercancel', this.onPointerCancel as EventListener);
    this.listen(c, 'lostpointercapture', this.onLostCapture as EventListener);
    this.listen(c, 'pointerenter', this.onPointerEnter as EventListener);
    this.listen(c, 'pointerleave', this.onPointerLeave as EventListener);
    this.listen(c, 'wheel', this.onWheel as EventListener, { passive: false });
    this.listen(c, 'contextmenu', (e) => e.preventDefault());
    this.listen(c, 'dblclick', (e) => e.preventDefault());
    this.listen(this.element, 'focus', () => setActive(this));
    this.listen(this.element, 'blur', () => {
      delete this.element.dataset.pointerFocus;
      if (this.kb) {
        this.kb = null;
        this.requestRender();
      }
    });
    this.listen(window, 'keydown', this.onKeyDown as EventListener);
    this.listen(window, 'keyup', this.onKeyUp as EventListener);
    this.listen(window, 'blur', this.onWindowBlur);
    this.listen(window, 'copy', this.onCopy as EventListener);
    this.listen(window, 'cut', this.onCut as EventListener);
    this.listen(window, 'paste', this.onPaste as EventListener);
    if (this.reducedMotion) {
      const onMotion = () => this.updateAnts();
      this.reducedMotion.addEventListener('change', onMotion);
      this.cleanups.push(() => this.reducedMotion?.removeEventListener('change', onMotion));
    }
    const scheme = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    if (scheme) {
      const onScheme = () => this.refreshColors();
      scheme.addEventListener('change', onScheme);
      this.cleanups.push(() => scheme.removeEventListener('change', onScheme));
    }

    this.themeObserver = new MutationObserver(() => this.refreshColors());
    this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'data-tool', 'style'] });
    if (document.body) this.themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-theme'] });

    this.ro = new ResizeObserver((entries) => this.onResize(entries));
    try {
      this.ro.observe(this.canvas, { box: 'device-pixel-content-box' });
    } catch {
      this.ro.observe(this.canvas);
    }
    this.watchDpr();
    this.cleanups.push(() => this.dprCleanup?.());

    setActive(this);
    this.updateHud();
  }

  // ---------------------------------------------------------------------------
  // Public API: image

  /** A copy of the current pixels (straight RGBA). */
  getImage(): ImageData {
    return cloneImage(this.img);
  }

  get width(): number { return this.img.width; }
  get height(): number { return this.img.height; }

  /**
   * Replaces the image. By default history is reset and the view is refitted when the size changes.
   * With resetHistory: false the replacement is undoable. Never emits 'change'.
   */
  setImage(img: ImageData, opts: { resetHistory?: boolean; resetView?: boolean } = {}): void {
    if (!img || !(img.width > 0) || !(img.height > 0) || img.data.length !== img.width * img.height * 4) {
      throw new Error('setImage needs a valid ImageData');
    }
    this.cancelGesture();
    this.float = null;
    const resetHistory = opts.resetHistory ?? true;
    const prev = this.img;
    const next = cloneImage(img);
    const dimsChanged = prev.width !== next.width || prev.height !== next.height;
    const selBefore = this.committedSel;
    this.sel = null;
    this.committedSel = null;
    if (resetHistory) {
      this.undoStack = [];
      this.redoStack = [];
      this.lastPointF = null;
    } else if (dimsChanged) {
      this.pushHistory({ kind: 'full', width: prev.width, height: prev.height, data: this.baseline, selBefore, selAfter: null });
    } else {
      const r = diffBounds(next.data, this.baseline, next.width, next.height);
      if (r) this.pushHistory({ kind: 'rect', rect: r, data: copyRegion(this.baseline, prev.width, r), selBefore, selAfter: null });
    }
    this.img = next;
    this.baseline = next.data.slice();
    if (dimsChanged) this.onDimensionsChanged();
    this.markAll();
    if (opts.resetView ?? dimsChanged) this.zoomToFit();
    this.emitSelection();
    this.emit('history', undefined);
    this.requestRender();
  }

  // ---------------------------------------------------------------------------
  // Public API: settings (properties behave like their setters)

  get tool(): Tool { return this._tool; }
  set tool(t: Tool) { this.setTool(t); }
  get color(): RGBA { return [...this._color] as RGBA; }
  set color(c: RGBA) { this.setColor(c); }
  get secondaryColor(): RGBA { return [...this._secondary] as RGBA; }
  set secondaryColor(c: RGBA) { this.setSecondaryColor(c); }
  get brushSize(): number { return this._brushSize; }
  set brushSize(n: number) { this.setBrushSize(n); }
  get brushShape(): BrushShape { return this._brushShape; }
  set brushShape(s: BrushShape) { this.setBrushShape(s); }
  get mirrorX(): boolean { return this._mirrorX; }
  set mirrorX(v: boolean) { this.setMirror(v, this._mirrorY); }
  get mirrorY(): boolean { return this._mirrorY; }
  set mirrorY(v: boolean) { this.setMirror(this._mirrorX, v); }
  get fillContiguous(): boolean { return this._fillContiguous; }
  set fillContiguous(v: boolean) { this.setFillContiguous(v); }
  get fillTolerance(): number { return this._fillTolerance; }
  set fillTolerance(v: number) { this.setFillTolerance(v); }
  get shadeStrength(): number { return this._shadeStrength; }
  set shadeStrength(v: number) { this.setShadeStrength(v); }
  get channelMode(): ChannelMode { return this._channelMode; }
  set channelMode(m: ChannelMode) { this.setChannelMode(m); }
  get showGrid(): boolean { return this._showGrid; }
  get tiledPreview(): boolean { return this._tiled; }

  setTool(t: Tool): void {
    if (!TOOL_SET.has(t) || t === this._tool) return;
    this.endGesture();
    if (t !== 'select' && t !== 'move') this.finalizeFloat();
    this._tool = t;
    this.updateCursor();
    this.requestRender();
    this.emit('tool', t);
    this.emitSettings();
  }

  setColor(c: RGBA): void {
    const n = normalizeColor(c);
    if (sameColor(n, this._color)) return;
    this._color = n;
    this.requestRender();
    this.emitSettings();
  }

  setSecondaryColor(c: RGBA): void {
    const n = normalizeColor(c);
    if (sameColor(n, this._secondary)) return;
    this._secondary = n;
    this.emitSettings();
  }

  /** Swaps primary and secondary colours (emits 'colorpick' with the new primary). */
  swapColors(): void {
    const p = this._color;
    this._color = this._secondary;
    this._secondary = p;
    this.requestRender();
    this.emit('colorpick', [...this._color] as RGBA);
    this.emitSettings();
  }

  setBrushSize(n: number): void {
    const v = clamp(Math.round(Number(n) || 1), 1, MAX_BRUSH);
    if (v === this._brushSize) return;
    this._brushSize = v;
    this.requestRender();
    this.emitSettings();
  }

  setBrushShape(s: BrushShape): void {
    if ((s !== 'square' && s !== 'round') || s === this._brushShape) return;
    this._brushShape = s;
    this.requestRender();
    this.emitSettings();
  }

  setMirror(x: boolean, y: boolean): void {
    if (!!x === this._mirrorX && !!y === this._mirrorY) return;
    this._mirrorX = !!x;
    this._mirrorY = !!y;
    this.requestRender();
    this.emitSettings();
  }

  setMirrorMap(fn: MirrorMap | null): void {
    this.mirrorMap = fn;
    this.requestRender();
  }

  setFillContiguous(v: boolean): void {
    if (!!v === this._fillContiguous) return;
    this._fillContiguous = !!v;
    this.emitSettings();
  }

  /** 0..255: how different a colour may be and still be filled. */
  setFillTolerance(v: number): void {
    const n = clamp(Math.round(Number(v) || 0), 0, 255);
    if (n === this._fillTolerance) return;
    this._fillTolerance = n;
    this.emitSettings();
  }

  /** 0..1: strength of the lighten / darken / noise tools. */
  setShadeStrength(v: number): void {
    const n = clamp(Number(v) || 0, 0, 1);
    if (n === this._shadeStrength) return;
    this._shadeStrength = n;
    this.emitSettings();
  }

  /**
   * 'rgba' (normal), 'rgb' (show colours fully opaque, paint colour only and keep alpha) or
   * 'alpha' (show alpha as greyscale, paint alpha only: white = opaque, black = transparent).
   */
  setChannelMode(m: ChannelMode): void {
    if ((m !== 'rgba' && m !== 'rgb' && m !== 'alpha') || m === this._channelMode) return;
    this._channelMode = m;
    this.markAll();
    this.requestRender();
    this.emitSettings();
  }

  setShowGrid(v: boolean): void {
    if (!!v === this._showGrid) return;
    this._showGrid = !!v;
    this.requestRender();
    this.emitSettings();
  }

  setTiledPreview(v: boolean): void {
    if (!!v === this._tiled) return;
    this._tiled = !!v;
    this.setHover(this.hoverF);
    this.requestRender();
    this.emitSettings();
  }

  setMask(m: Uint8Array | null): void {
    this.applyMask(m);
    this.requestRender();
  }

  setOverlay(fn: PixelCanvasOptions['overlay']): void {
    this.overlay = fn ?? null;
    this.overlayFailed = false;
    this.requestRender();
  }

  getSettings(): PixelCanvasSettings {
    return {
      tool: this._tool,
      color: [...this._color] as RGBA,
      secondaryColor: [...this._secondary] as RGBA,
      brushSize: this._brushSize,
      brushShape: this._brushShape,
      mirrorX: this._mirrorX,
      mirrorY: this._mirrorY,
      fillContiguous: this._fillContiguous,
      fillTolerance: this._fillTolerance,
      shadeStrength: this._shadeStrength,
      showGrid: this._showGrid,
      tiledPreview: this._tiled,
      channelMode: this._channelMode,
    };
  }

  // ---------------------------------------------------------------------------
  // Public API: history

  undo(): void {
    if (this.hasPendingEdit()) {
      this.cancelGesture();
      return;
    }
    const e = this.undoStack.pop();
    if (!e) return;
    this.float = null;
    this.swapEntry(e);
    this.sel = e.selBefore ? { ...e.selBefore } : null;
    this.committedSel = this.sel;
    this.redoStack.push(e);
    this.afterHistoryMove();
  }

  redo(): void {
    if (this.hasPendingEdit()) this.cancelGesture();
    const e = this.redoStack.pop();
    if (!e) return;
    this.float = null;
    this.swapEntry(e);
    this.sel = e.selAfter ? { ...e.selAfter } : null;
    this.committedSel = this.sel;
    this.undoStack.push(e);
    this.afterHistoryMove();
  }

  canUndo(): boolean { return this.undoStack.length > 0; }

  private hasPendingEdit(): boolean {
    const k = this.gesture?.kind;
    return k === 'stroke' || k === 'shape' || k === 'move' || k === 'marquee' || k === 'external';
  }
  canRedo(): boolean { return this.redoStack.length > 0; }

  /** Forgets all undo/redo steps. */
  clearHistory(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.emit('history', undefined);
  }

  // ---------------------------------------------------------------------------
  // Public API: programmatic strokes (painting from outside the canvas, e.g. on a 3D model)

  /**
   * Starts a stroke driven from outside the canvas. Everything painted with setPixels() until
   * endStroke() becomes one undo step (cancelStroke() takes it back). A gesture in progress on the
   * canvas is finished first. `tool` picks the paint (pencil = colour, eraser = transparent,
   * lighten / darken / noise shade); `secondary` paints with the secondary colour.
   */
  beginStroke(opts: { tool?: StrokeTool; secondary?: boolean } = {}): void {
    if (this.destroyed) return;
    this.endGesture();
    this.finalizeFloat();
    const tool = opts.tool ?? 'pencil';
    this.prepareEdit(tool === 'eraser' || tool === 'lighten' || tool === 'darken' || tool === 'noise' ? tool : 'pencil', !!opts.secondary);
    this.gesture = { kind: 'external', id: -1, touch: false };
    this.updateCursor();
  }

  /** True while a stroke started with beginStroke() is open. */
  get stroking(): boolean {
    return this.gesture?.kind === 'external';
  }

  /**
   * Paints pixels in the open stroke (without one, the call is its own undo step). With `rgba` the
   * pixels get exactly that colour (null = transparent), otherwise the stroke's tool paints them. The
   * paint mask, the selection and mirror painting apply as they do for the pencil (mirror: false paints
   * only the given pixels); each pixel is painted at most once per stroke. The canvas shows the change
   * at once; 'change' is emitted by endStroke(). Returns true when a pixel changed.
   */
  setPixels(points: Iterable<readonly [number, number]>, rgba?: RGBA | null, opts: { mirror?: boolean } = {}): boolean {
    if (this.destroyed) return false;
    const oneShot = !this.stroking;
    if (oneShot) this.beginStroke();
    const saved = rgba === undefined ? null : { op: this.op, color: this.opColor };
    if (rgba !== undefined) {
      this.op = 'set';
      this.opColor = rgba ? normalizeColor(rgba) : [0, 0, 0, 0];
    }
    const before = this.plotChanges;
    const W = this.img.width;
    const H = this.img.height;
    for (const p of points) {
      const x = Math.floor(p[0]);
      const y = Math.floor(p[1]);
      if (opts.mirror === false) {
        if (x >= 0 && y >= 0 && x < W && y < H) this.plotRaw(x, y);
      } else {
        this.plot(x, y);
      }
    }
    if (saved) {
      this.op = saved.op;
      this.opColor = saved.color;
    }
    const changed = this.plotChanges !== before;
    if (changed) this.requestRender();
    if (oneShot) this.endStroke();
    return changed;
  }

  /** Closes the stroke: records it as one undo step and emits 'change'. Returns true when it changed pixels. */
  endStroke(): boolean {
    if (!this.stroking) return false;
    this.gesture = null;
    const changed = this.commit();
    this.updateCursor();
    this.requestRender();
    return changed;
  }

  /** Abandons the open stroke and puts its pixels back. */
  cancelStroke(): void {
    if (this.stroking) this.cancelGesture();
  }

  /** One pixel (straight RGBA; transparent black outside the image). */
  getPixel(x: number, y: number): RGBA {
    x = Math.floor(x);
    y = Math.floor(y);
    if (!(x >= 0 && y >= 0 && x < this.img.width && y < this.img.height)) return [0, 0, 0, 0];
    const i = (y * this.img.width + x) * 4;
    const d = this.img.data;
    return [d[i], d[i + 1], d[i + 2], d[i + 3]];
  }

  // ---------------------------------------------------------------------------
  // Public API: view

  zoomToFit(): void {
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const W = this.img.width;
    const H = this.img.height;
    if (!this.viewReady || !cw || !ch) {
      // Not laid out yet: fit once the real size is known.
      this.autoFit = true;
      this.pendingZoom = 0;
      return;
    }
    const pad = Math.round(Math.min(cw, ch) * 0.06 + 8 * this.dpr);
    const fit = Math.min((cw - pad * 2) / W, (ch - pad * 2) / H);
    let ds = fit >= 1 ? Math.floor(fit) : 1 / Math.ceil(1 / Math.max(fit, 1e-6));
    ds = clamp(ds, this.minDs(), MAX_DS);
    const changed = ds !== this.ds;
    this.ds = ds;
    this.ox = Math.round((cw - W * ds) / 2);
    this.oy = Math.round((ch - H * ds) / 2);
    this.autoFit = true;
    this.zoomAcc = ds;
    this.afterViewChange(changed);
  }

  /** Sets the zoom in CSS pixels per image pixel (snapped so pixels stay crisp), keeping the view centre. */
  setZoom(scale: number): void {
    if (!(scale > 0)) return;
    if (!this.viewReady) {
      this.pendingZoom = scale;
      return;
    }
    this.applyZoom(this.snapDs(scale * this.dpr), this.canvas.width / 2, this.canvas.height / 2);
  }

  /** CSS pixels per image pixel. */
  getZoom(): number {
    return this.ds / this.dpr;
  }

  zoomIn(): void { this.stepZoom(1); }
  zoomOut(): void { this.stepZoom(-1); }

  /** Current view transform (CSS px), as passed to the overlay. */
  getView(): PixelView {
    return this.viewInfo();
  }

  /** Converts client (viewport) coordinates to fractional image coordinates. */
  clientToImage(clientX: number, clientY: number): [number, number] {
    this.clientRect = null;
    const [dx, dy] = this.clientToDevice(clientX, clientY);
    return [(dx - this.ox) / this.ds, (dy - this.oy) / this.ds];
  }

  redraw(): void {
    this.requestRender();
  }

  focus(): void {
    this.element.focus({ preventScroll: true });
  }

  // ---------------------------------------------------------------------------
  // Public API: operations (on the selection if any, else the whole image)

  clear(): void {
    this.endGesture();
    const f = this.float;
    if (f) {
      if (f.composed) {
        writeRegion(this.img.data, this.img.width, f.composed, copyRegion(f.base, this.img.width, f.composed));
        this.markDirtyRect(f.composed);
      }
      this.float = null;
      if (f.implicit) this.sel = null;
      else this.sel = this.sel ? clampRect(this.sel, this.img.width, this.img.height) : null;
    } else {
      const r = this.editClip() ?? { x: 0, y: 0, w: this.img.width, h: this.img.height };
      this.markDirtyRect(clearPixels(this.img, r, this.mask, this._channelMode));
    }
    this.commit();
    this.emitSelection();
    this.requestRender();
  }

  flipH(): void { this.transform('h'); }
  flipV(): void { this.transform('v'); }
  rotate90(): void { this.transform('r'); }

  /** Runs an ImageData -> ImageData transform on the selection (or whole image) as one undoable step. */
  applyFilter(fn: (img: ImageData) => ImageData): void {
    this.endGesture();
    this.finalizeFloat();
    const W = this.img.width;
    const H = this.img.height;
    const region = this.sel ? clampRect(this.sel, W, H) : null;
    if (region) {
      const out = fn(extractRect(this.img, region));
      this.assertImage(out);
      this.markDirtyRect(pasteImage(this.img, out, region.x, region.y, { mask: this.mask, clip: region }));
      this.commit();
      this.requestRender();
      return;
    }
    const out = fn(this.getImage());
    this.assertImage(out);
    if (out.width === W && out.height === H) {
      if (this.mask) pasteImage(this.img, out, 0, 0, { mask: this.mask });
      else this.img.data.set(out.data);
      this.markAll();
      this.commit();
    } else {
      const prevBaseline = this.baseline;
      const selBefore = this.committedSel;
      this.img = cloneImage(out);
      this.baseline = this.img.data.slice();
      this.sel = null;
      this.committedSel = null;
      this.pushHistory({ kind: 'full', width: W, height: H, data: prevBaseline, selBefore, selAfter: null });
      this.onDimensionsChanged();
      this.markAll();
      this.zoomToFit();
      this.emitSelection();
      this.emitChange();
    }
    this.requestRender();
  }

  // ---------------------------------------------------------------------------
  // Public API: selection & clipboard

  getSelection(): Rect | null {
    return this.sel ? { ...this.sel } : null;
  }

  /** Sets the selection (clamped to the image); null deselects. */
  setSelection(r: Rect | null): void {
    this.endGesture();
    this.finalizeFloat();
    const next = r ? clampRect({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) }, this.img.width, this.img.height) : null;
    if (rectsEqual(next, this.sel)) return;
    this.sel = next;
    this.committedSel = next;
    this.emitSelection();
    this.requestRender();
  }

  selectAll(): void { this.setSelection({ x: 0, y: 0, w: this.img.width, h: this.img.height }); }
  deselect(): void { this.setSelection(null); }

  /** Drops a moved (floating) selection into place; it is already part of the image and history. */
  commitSelection(): void {
    this.endGesture();
    this.finalizeFloat();
    this.requestRender();
  }

  /** Copies the selection (or the whole image) to the editor clipboard. */
  copy(): boolean {
    let img: ImageData;
    if (this.float) img = cloneImage(this.float.buf);
    else if (this.sel) {
      const r = clampRect(this.sel, this.img.width, this.img.height);
      if (!r) return false;
      img = extractRect(this.img, r);
    } else img = this.getImage();
    clipboard = { img, token: `texturesonline-pixels:${img.width}x${img.height}:${Math.random().toString(36).slice(2, 10)}` };
    return true;
  }

  /** Copies then clears the selection. Needs a selection. */
  cut(): boolean {
    if (!this.sel && !this.float) return false;
    if (!this.copy()) return false;
    this.clear();
    return true;
  }

  /** Pastes the editor clipboard as a movable selection. */
  paste(): boolean {
    if (!clipboard) return false;
    this.pasteImage(clipboard.img);
    return true;
  }

  canPaste(): boolean {
    return !!clipboard;
  }

  /** Places an image as a movable selection (scaled down to fit when larger than the canvas). */
  pasteImage(src: ImageData, at?: { x: number; y: number }): void {
    this.assertImage(src);
    this.endGesture();
    this.finalizeFloat();
    const W = this.img.width;
    const H = this.img.height;
    let buf = cloneImage(src);
    if (buf.width > W || buf.height > H) {
      const s = Math.min(W / buf.width, H / buf.height);
      buf = scaleNearest(buf, Math.max(1, Math.floor(buf.width * s)), Math.max(1, Math.floor(buf.height * s)));
    }
    const x = at ? Math.round(at.x) : this.sel ? this.sel.x : Math.floor((W - buf.width) / 2);
    const y = at ? Math.round(at.y) : this.sel ? this.sel.y : Math.floor((H - buf.height) / 2);
    this.float = { buf, x, y, base: this.img.data.slice(), implicit: false, composed: null };
    this.compose();
    this.commit();
    if (this._tool !== 'select' && this._tool !== 'move') this.setTool('move');
    this.emitSelection();
    this.updateAnts();
    this.requestRender();
  }

  // ---------------------------------------------------------------------------
  // Events

  on(ev: 'change', cb: (img: ImageData) => void): () => void;
  on(ev: 'colorpick', cb: (c: RGBA) => void): () => void;
  on(ev: 'hover', cb: (p: { x: number; y: number } | null) => void): () => void;
  on(ev: 'history', cb: () => void): () => void;
  on(ev: 'tool', cb: (t: Tool) => void): () => void;
  on(ev: 'settings', cb: (s: PixelCanvasSettings) => void): () => void;
  on(ev: 'zoom', cb: (scale: number) => void): () => void;
  on(ev: 'selection', cb: (r: Rect | null) => void): () => void;
  on(ev: keyof PixelCanvasEvents, cb: Listener): () => void {
    let set = this.listeners.get(ev);
    if (!set) {
      set = new Set();
      this.listeners.set(ev, set);
    }
    set.add(cb);
    return () => { set.delete(cb); };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.cancelGesture();
    this.destroyed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    window.clearInterval(this.antsTimer);
    window.clearTimeout(this.liveTimer);
    this.ro.disconnect();
    this.themeObserver.disconnect();
    for (const fn of this.cleanups.splice(0)) fn();
    this.listeners.clear();
    this.element.remove();
    if (activeCanvas === this) activeCanvas = null;
  }

  // ---------------------------------------------------------------------------
  // Internals: events

  private emit<K extends keyof PixelCanvasEvents>(ev: K, arg: PixelCanvasEvents[K]): void {
    const set = this.listeners.get(ev);
    if (!set || set.size === 0) return;
    for (const cb of [...set]) {
      try {
        (cb as (a: PixelCanvasEvents[K]) => void)(arg);
      } catch (err) {
        console.error(`PixelCanvas "${ev}" listener failed`, err);
      }
    }
  }

  private emitChange(): void {
    const set = this.listeners.get('change');
    if (set && set.size) this.emit('change', this.getImage());
  }

  private emitSettings(): void {
    const set = this.listeners.get('settings');
    if (set && set.size) this.emit('settings', this.getSettings());
  }

  private emitSelection(): void {
    this.updateAnts();
    this.emit('selection', this.getSelection());
  }

  private listen(target: EventTarget, type: string, fn: EventListener, opts?: AddEventListenerOptions): void {
    target.addEventListener(type, fn, opts);
    this.cleanups.push(() => target.removeEventListener(type, fn, opts));
  }

  // ---------------------------------------------------------------------------
  // Internals: history

  private pushHistory(e: HistoryEntry): void {
    this.undoStack.push(e);
    this.redoStack = [];
    if (this.undoStack.length > HISTORY_MAX) this.undoStack.splice(0, this.undoStack.length - HISTORY_MAX);
    let total = 0;
    for (const x of this.undoStack) total += x.data.byteLength;
    // Keep a few steps even for big images, but never let history grow far past the budget.
    while (this.undoStack.length > 1 && total > HISTORY_BUDGET && (this.undoStack.length > HISTORY_MIN || total > HISTORY_HARD_LIMIT)) {
      total -= this.undoStack.shift()!.data.byteLength;
    }
    this.emit('history', undefined);
  }

  /** Records everything that changed since the last commit as one undo step and emits 'change'. */
  private commit(): boolean {
    const W = this.img.width;
    const H = this.img.height;
    const r = diffBounds(this.img.data, this.baseline, W, H);
    if (!r) {
      if (!this.float) this.committedSel = this.sel;
      return false;
    }
    const before = copyRegion(this.baseline, W, r);
    writeRegion(this.baseline, W, r, copyRegion(this.img.data, W, r));
    const selAfter = this.sel ? { ...this.sel } : null;
    this.pushHistory({ kind: 'rect', rect: r, data: before, selBefore: this.committedSel, selAfter });
    this.committedSel = selAfter;
    this.emitChange();
    return true;
  }

  private swapEntry(e: HistoryEntry): void {
    if (e.kind === 'rect') {
      const W = this.img.width;
      const cur = copyRegion(this.img.data, W, e.rect);
      writeRegion(this.img.data, W, e.rect, e.data);
      writeRegion(this.baseline, W, e.rect, e.data);
      e.data = cur;
      this.markDirtyRect(e.rect);
      return;
    }
    const cur = this.img;
    this.img = createImage(e.width, e.height, e.data);
    this.baseline = this.img.data.slice();
    e.data = cur.data;
    e.width = cur.width;
    e.height = cur.height;
    if (cur.width !== this.img.width || cur.height !== this.img.height) {
      this.onDimensionsChanged();
      this.zoomToFit();
    }
    this.markAll();
  }

  private afterHistoryMove(): void {
    this.lastPointF = null;
    this.emitSelection();
    this.emit('history', undefined);
    this.emitChange();
    this.requestRender();
  }

  // ---------------------------------------------------------------------------
  // Internals: painting

  private markDirty(x: number, y: number): void {
    if (x < this.sx0) this.sx0 = x;
    if (x > this.sx1) this.sx1 = x;
    if (y < this.sy0) this.sy0 = y;
    if (y > this.sy1) this.sy1 = y;
    if (x < this.dx0) this.dx0 = x;
    if (x > this.dx1) this.dx1 = x;
    if (y < this.dy0) this.dy0 = y;
    if (y > this.dy1) this.dy1 = y;
  }

  private markDirtyRect(r: Rect | null): void {
    if (!r || r.w <= 0 || r.h <= 0) return;
    this.markDirty(r.x, r.y);
    this.markDirty(r.x + r.w - 1, r.y + r.h - 1);
  }

  private markAll(): void {
    this.dx0 = 0;
    this.dy0 = 0;
    this.dx1 = this.img.width - 1;
    this.dy1 = this.img.height - 1;
  }

  private strokeRect(): Rect | null {
    if (this.sx1 < 0) return null;
    return { x: this.sx0, y: this.sy0, w: this.sx1 - this.sx0 + 1, h: this.sy1 - this.sy0 + 1 };
  }

  private resetStrokeDirty(): void {
    this.sx0 = Infinity; this.sy0 = Infinity; this.sx1 = -1; this.sy1 = -1;
  }

  /** Puts back the committed pixels under the current gesture's changes. */
  private restoreStroke(): void {
    const r = this.strokeRect();
    if (r) {
      writeRegion(this.img.data, this.img.width, r, copyRegion(this.baseline, this.img.width, r));
      this.markDirtyRect(r);
    }
    this.resetStrokeDirty();
    this.nextGen();
  }

  private nextGen(): void {
    this.gen = (this.gen + 1) >>> 0;
    if (this.gen === 0) {
      this.touched.fill(0);
      this.gen = 1;
    }
  }

  /** Selection limits painting; an off-image selection allows nothing. */
  private editClip(): Rect | null {
    if (!this.sel) return null;
    return clampRect(this.sel, this.img.width, this.img.height) ?? { x: 0, y: 0, w: 0, h: 0 };
  }

  private prepareEdit(tool: Tool, secondary: boolean): void {
    this.clip = this.editClip();
    this.resetStrokeDirty();
    this.nextGen();
    this.opAmount = this._shadeStrength;
    switch (tool) {
      case 'eraser':
        this.op = 'set';
        this.opColor = [0, 0, 0, 0];
        break;
      case 'lighten':
        this.op = secondary ? 'darken' : 'lighten';
        break;
      case 'darken':
        this.op = secondary ? 'lighten' : 'darken';
        break;
      case 'noise':
        this.op = 'noise';
        this.opColor = secondary ? this._secondary : this._color;
        break;
      default:
        this.op = 'set';
        this.opColor = secondary ? this._secondary : this._color;
    }
  }

  private plotRaw(x: number, y: number): void {
    const clip = this.clip;
    if (clip && (x < clip.x || y < clip.y || x >= clip.x + clip.w || y >= clip.y + clip.h)) return;
    const p = y * this.img.width + x;
    if (this.mask && !this.mask[p]) return;
    if (this.touched[p] === this.gen) return;
    this.touched[p] = this.gen;
    const d = this.img.data;
    const i = p * 4;
    let changed: boolean;
    switch (this.op) {
      case 'set': changed = writePixel(d, i, this.opColor, this._channelMode); break;
      case 'lighten': changed = shadePixel(d, i, this.opAmount, this._channelMode); break;
      case 'darken': changed = shadePixel(d, i, -this.opAmount, this._channelMode); break;
      default: changed = writePixel(d, i, noiseColor(this.opColor, this.opAmount), this._channelMode);
    }
    if (changed) {
      this.markDirty(x, y);
      this.plotChanges++;
    }
  }

  /** Plots one pixel with tiling wrap and mirroring applied. */
  private readonly plot = (x: number, y: number): void => {
    const W = this.img.width;
    const H = this.img.height;
    if (this._tiled) {
      x = mod(x, W);
      y = mod(y, H);
    } else if (x < 0 || y < 0 || x >= W || y >= H) return;
    this.plotRaw(x, y);
    if (!this._mirrorX && !this._mirrorY) return;
    if (this.mirrorMap) {
      for (const [mx, my] of this.mirrorMap(x, y)) {
        if (mx >= 0 && my >= 0 && mx < W && my < H) this.plotRaw(mx, my);
      }
      return;
    }
    if (this._mirrorX) this.plotRaw(W - 1 - x, y);
    if (this._mirrorY) this.plotRaw(x, H - 1 - y);
    if (this._mirrorX && this._mirrorY) this.plotRaw(W - 1 - x, H - 1 - y);
  };

  private stampAt(ox: number, oy: number): void {
    const offs = brushOffsets(this._brushSize, this._brushShape);
    for (let k = 0; k < offs.length; k++) this.plot(ox + offs[k][0], oy + offs[k][1]);
  }

  private readonly stampPixel = (px: number, py: number): void => {
    const [ox, oy] = brushOriginAt(px, py, this._brushSize);
    this.stampAt(ox, oy);
  };

  /** All image pixels (after wrap and mirroring) that a point maps to. */
  private targetsOf(x: number, y: number): Point[] {
    const W = this.img.width;
    const H = this.img.height;
    if (this._tiled) {
      x = mod(x, W);
      y = mod(y, H);
    } else if (x < 0 || y < 0 || x >= W || y >= H) return [];
    const out: Point[] = [[x, y]];
    if (!this._mirrorX && !this._mirrorY) return out;
    if (this.mirrorMap) {
      for (const [mx, my] of this.mirrorMap(x, y)) if (mx >= 0 && my >= 0 && mx < W && my < H) out.push([mx, my]);
      return out;
    }
    if (this._mirrorX) out.push([W - 1 - x, y]);
    if (this._mirrorY) out.push([x, H - 1 - y]);
    if (this._mirrorX && this._mirrorY) out.push([W - 1 - x, H - 1 - y]);
    return out;
  }

  private doFill(fx: number, fy: number, secondary: boolean): void {
    this.prepareEdit('fill', secondary);
    const color = secondary ? this._secondary : this._color;
    const seen = new Set<number>();
    for (const [x, y] of this.targetsOf(Math.floor(fx), Math.floor(fy))) {
      const key = y * this.img.width + x;
      if (seen.has(key)) continue;
      seen.add(key);
      const r = floodFill(this.img, x, y, color, {
        tolerance: this._fillTolerance,
        contiguous: this._fillContiguous,
        mask: this.mask,
        bounds: this.clip,
        channels: this._channelMode,
      });
      this.markDirtyRect(r);
    }
    this.commit();
    this.requestRender();
  }

  private doPick(fx: number, fy: number, secondary: boolean): void {
    const t = this.targetsOf(Math.floor(fx), Math.floor(fy))[0];
    if (!t) return;
    const c = pickColor(this.img, t[0], t[1], this._channelMode);
    if (secondary) {
      if (sameColor(c, this._secondary)) return;
      this._secondary = c;
      this.emitSettings();
      return;
    }
    if (sameColor(c, this._color)) return;
    this._color = c;
    this.emit('colorpick', [...c] as RGBA);
    this.emitSettings();
    this.requestRender();
  }

  private drawShape(g: Extract<Gesture, { kind: 'shape' }>): void {
    this.restoreStroke();
    const [x0, y0] = g.start;
    let [x1, y1] = g.end;
    if (this.shiftDown) {
      [x1, y1] = g.tool === 'line' ? snapLineEnd(x0, y0, x1, y1) : constrainSquare(x0, y0, x1, y1);
    }
    switch (g.tool) {
      case 'line':
        forEachLinePoint(x0, y0, x1, y1, this.stampPixel);
        break;
      case 'rect':
        forEachRectPoint(x0, y0, x1, y1, false, this.stampPixel);
        break;
      case 'rect-fill':
        forEachRectPoint(x0, y0, x1, y1, true, this.plot);
        break;
      case 'ellipse':
        forEachEllipsePoint(x0, y0, x1, y1, false, this.stampPixel);
        break;
    }
    this.requestRender();
  }

  // ---------------------------------------------------------------------------
  // Internals: floating selection (move)

  /** Lifts the selection (or the whole image) so it can be moved without destroying what is under it. */
  private lift(area?: Rect | null): void {
    const W = this.img.width;
    const H = this.img.height;
    const implicit = !this.sel;
    const r = (this.sel && clampRect(this.sel, W, H)) || area || { x: 0, y: 0, w: W, h: H };
    const buf = extractRect(this.img, r, this.mask);
    const base = this.img.data.slice();
    clearPixels({ width: W, height: H, data: base }, r, this.mask);
    this.float = { buf, x: r.x, y: r.y, base, implicit, composed: r };
    this.sel = { ...r };
    this.updateAnts();
  }

  /** Rebuilds the image as base + floating pixels at the floating position. */
  private compose(): void {
    const f = this.float;
    if (!f) return;
    const W = this.img.width;
    const H = this.img.height;
    const next = clampRect({ x: f.x, y: f.y, w: f.buf.width, h: f.buf.height }, W, H);
    const restore = unionRect(f.composed, next);
    if (restore) {
      writeRegion(this.img.data, W, restore, copyRegion(f.base, W, restore));
      this.markDirtyRect(restore);
    }
    // In colour/alpha views invisible pixels carry visible data, so they move like any other pixel.
    if (next) pasteImage(this.img, f.buf, f.x, f.y, { mask: this.mask, skipTransparent: this._channelMode === 'rgba' });
    f.composed = next;
    this.sel = { x: f.x, y: f.y, w: f.buf.width, h: f.buf.height };
  }

  private finalizeFloat(): void {
    const f = this.float;
    if (!f) return;
    this.float = null;
    if (f.implicit) this.sel = null;
    else this.sel = this.sel ? clampRect(this.sel, this.img.width, this.img.height) : null;
    this.committedSel = this.sel;
    this.emitSelection();
    this.requestRender();
  }

  /** Forgets a float that never moved; the image still equals the committed state. */
  private dropUnmovedFloat(): void {
    const f = this.float;
    if (!f) return;
    this.float = null;
    this.sel = f.implicit ? null : this.committedSel;
    this.emitSelection();
  }

  private nudge(dx: number, dy: number): void {
    if (!this.float) this.lift();
    const f = this.float!;
    f.x += dx;
    f.y += dy;
    this.compose();
    this.commit();
    this.emitSelection();
    this.requestRender();
  }

  private transform(kind: 'h' | 'v' | 'r'): void {
    this.endGesture();
    const W = this.img.width;
    const H = this.img.height;
    const hasSel = !!this.sel || !!this.float;
    if (hasSel || this.mask || (kind === 'r' && W !== H)) {
      // With a paint mask and no selection, transform within the editable area (e.g. one skin part).
      if (!this.float) this.lift(hasSel ? null : this.maskBounds());
      const f = this.float!;
      if (kind === 'h') flipHorizontal(f.buf);
      else if (kind === 'v') flipVertical(f.buf);
      else {
        const inside = f.x >= 0 && f.y >= 0 && f.x + f.buf.width <= W && f.y + f.buf.height <= H;
        const r = rotate90(f.buf, true);
        f.x += Math.floor((f.buf.width - r.width) / 2);
        f.y += Math.floor((f.buf.height - r.height) / 2);
        f.buf = r;
        // Rotating about the centre can push a selection near an edge off the canvas; nudge it back in.
        if (inside) {
          if (r.width <= W) f.x = clamp(f.x, 0, W - r.width);
          if (r.height <= H) f.y = clamp(f.y, 0, H - r.height);
        }
      }
      this.compose();
      this.commit();
      if (!hasSel) this.finalizeFloat();
      else this.emitSelection();
    } else {
      if (kind === 'h') flipHorizontal(this.img);
      else if (kind === 'v') flipVertical(this.img);
      else this.img.data.set(rotate90(this.img, true).data);
      this.markAll();
      this.commit();
    }
    this.requestRender();
  }

  // ---------------------------------------------------------------------------
  // Internals: gestures

  private eventToImage(e: { clientX: number; clientY: number }): [number, number] {
    const [dx, dy] = this.clientToDevice(e.clientX, e.clientY);
    return [(dx - this.ox) / this.ds, (dy - this.oy) / this.ds];
  }

  private clientToDevice(cx: number, cy: number): [number, number] {
    const r = this.clientRect ?? (this.clientRect = this.canvas.getBoundingClientRect());
    const sx = r.width ? this.canvas.width / r.width : this.dpr;
    const sy = r.height ? this.canvas.height / r.height : this.dpr;
    return [(cx - r.left) * sx, (cy - r.top) * sy];
  }

  /** Device pixels per CSS pixel of the canvas element. */
  private clientScale(): number {
    const r = this.clientRect ?? (this.clientRect = this.canvas.getBoundingClientRect());
    return r.width ? this.canvas.width / r.width : this.dpr;
  }

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (this.destroyed) return;
    setActive(this);
    this.clientRect = null;
    // Pointer focus should not show the keyboard focus ring (see .pc-root[data-pointer-focus] in the CSS).
    this.element.dataset.pointerFocus = '';
    if (document.activeElement !== this.element) this.element.focus({ preventScroll: true, focusVisible: false });
    if (this.kb) this.kb = null;
    const touch = e.pointerType === 'touch';
    if (touch) {
      this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.penDown) return;
      if (this.touches.size === 2) {
        e.preventDefault();
        this.beginPinch();
        return;
      }
      if (this.touches.size > 2) return;
    } else if (e.pointerType === 'pen') {
      this.penDown = true;
    }
    if (this.gesture) return;
    e.preventDefault();
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // Capture can fail for synthetic events; dragging still works while inside the canvas.
    }
    const [fx, fy] = this.eventToImage(e);
    this.hoverIsTouch = touch;
    if (!touch) this.setHover([fx, fy]);
    this.shiftDown = e.shiftKey;
    const id = e.pointerId;

    if (e.button === 1 || this.spaceDown) {
      this.gesture = { kind: 'pan', id, touch, cx: e.clientX, cy: e.clientY, ox: this.ox, oy: this.oy };
      this.updateCursor();
      return;
    }
    if (e.button !== 0 && e.button !== 2 && e.button !== 5) return;
    const secondary = e.button === 2;
    const tool: Tool = e.altKey ? 'picker' : e.button === 5 ? 'eraser' : this._tool;
    this.startTool(tool, fx, fy, id, touch, secondary, e.shiftKey);
  };

  private startTool(tool: Tool, fx: number, fy: number, id: number, touch: boolean, secondary: boolean, shift: boolean): void {
    // A pen's eraser end can paint while the move tool is active: drop the floating pixels first,
    // otherwise the next move would put back what was just erased.
    if (this.float && tool !== 'select' && tool !== 'move' && tool !== 'picker') this.finalizeFloat();
    switch (tool) {
      case 'pencil':
      case 'eraser':
      case 'lighten':
      case 'darken':
      case 'noise': {
        this.prepareEdit(tool, secondary);
        const o = brushOrigin(fx, fy, this._brushSize);
        if (shift && this.lastPointF) {
          const s = brushOrigin(this.lastPointF[0], this.lastPointF[1], this._brushSize);
          stampLine(s, o, this._brushSize, this._brushShape, this.plot);
        } else {
          this.stampAt(o[0], o[1]);
        }
        this.gesture = { kind: 'stroke', id, touch, last: o, lastF: [fx, fy] };
        this.requestRender();
        break;
      }
      case 'line':
      case 'rect':
      case 'rect-fill':
      case 'ellipse': {
        this.prepareEdit(tool, secondary);
        const p: Point = [Math.floor(fx), Math.floor(fy)];
        const g: Extract<Gesture, { kind: 'shape' }> = { kind: 'shape', id, touch, tool, start: p, end: p };
        this.gesture = g;
        this.drawShape(g);
        break;
      }
      case 'fill':
        this.doFill(fx, fy, secondary);
        this.gesture = { kind: 'ignore', id, touch };
        break;
      case 'picker':
        this.doPick(fx, fy, secondary);
        this.gesture = { kind: 'pick', id, touch, secondary };
        break;
      case 'select': {
        const px = Math.floor(fx);
        const py = Math.floor(fy);
        if (this.sel && rectContains(this.sel, px, py)) {
          this.beginMove(fx, fy, id, touch);
          break;
        }
        this.finalizeFloat();
        const start: Point = [clamp(px, 0, this.img.width - 1), clamp(py, 0, this.img.height - 1)];
        this.gesture = { kind: 'marquee', id, touch, start, moved: false, prevSel: this.sel };
        this.sel = null;
        this.updateAnts();
        this.requestRender();
        break;
      }
      case 'move':
        this.beginMove(fx, fy, id, touch);
        break;
    }
    this.updateCursor();
  }

  private beginMove(fx: number, fy: number, id: number, touch: boolean): void {
    const lifted = !this.float;
    if (lifted) this.lift();
    const f = this.float!;
    this.gesture = { kind: 'move', id, touch, fx, fy, x0: f.x, y0: f.y, moved: false, lifted };
    this.requestRender();
  }

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (this.destroyed) return;
    this.clientRect = null;
    const touch = e.pointerType === 'touch';
    if (touch && this.touches.has(e.pointerId)) this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = this.gesture;
    if (g?.kind === 'pinch') {
      if (g.ids.includes(e.pointerId)) this.movePinch(g);
      return;
    }
    if (!touch) {
      if (this.kb) { this.kb = null; }
      this.altDown = e.altKey;
      this.hoverIsTouch = false;
    }
    const [fx, fy] = this.eventToImage(e);
    if (!g || g.id !== e.pointerId) {
      if (!touch) {
        this.setHover([fx, fy]);
        this.updateCursor();
      }
      return;
    }
    if (!touch) this.setHover([fx, fy]);
    switch (g.kind) {
      case 'pan': {
        const s = this.clientScale();
        this.ox = Math.round(g.ox + (e.clientX - g.cx) * s);
        this.oy = Math.round(g.oy + (e.clientY - g.cy) * s);
        this.autoFit = false;
        this.clampOffsets();
        this.requestRender();
        break;
      }
      case 'stroke': {
        const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
        const list = events.length ? events : [e];
        for (const ev of list) {
          const [x, y] = this.eventToImage(ev);
          const o = brushOrigin(x, y, this._brushSize);
          if (o[0] !== g.last[0] || o[1] !== g.last[1]) {
            stampLine(g.last, o, this._brushSize, this._brushShape, this.plot, true);
            g.last = o;
          }
          g.lastF = [x, y];
        }
        this.requestRender();
        break;
      }
      case 'shape': {
        this.shiftDown = e.shiftKey;
        const end: Point = [Math.floor(fx), Math.floor(fy)];
        if (end[0] !== g.end[0] || end[1] !== g.end[1] || this.shiftDown !== this.lastShapeShift) {
          g.end = end;
          this.lastShapeShift = this.shiftDown;
          this.drawShape(g);
        }
        break;
      }
      case 'pick':
        this.doPick(fx, fy, g.secondary);
        break;
      case 'marquee': {
        const end: Point = [clamp(Math.floor(fx), 0, this.img.width - 1), clamp(Math.floor(fy), 0, this.img.height - 1)];
        if (end[0] !== g.start[0] || end[1] !== g.start[1]) g.moved = true;
        if (g.moved) {
          this.sel = normalizeRect(g.start[0], g.start[1], end[0], end[1]);
          this.updateAnts();
          this.requestRender();
        }
        break;
      }
      case 'move': {
        const f = this.float;
        if (!f) break;
        const nx = g.x0 + Math.round(fx - g.fx);
        const ny = g.y0 + Math.round(fy - g.fy);
        if (nx !== f.x || ny !== f.y) {
          f.x = nx;
          f.y = ny;
          g.moved = true;
          this.compose();
          this.requestRender();
        }
        break;
      }
      default:
        break;
    }
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (this.destroyed) return;
    if (e.pointerType === 'touch') this.touches.delete(e.pointerId);
    if (e.pointerType === 'pen') this.penDown = false;
    const g = this.gesture;
    if (!g) return;
    if (g.kind === 'pinch') {
      if (g.ids.includes(e.pointerId)) this.endPinch(g, e.pointerId);
      return;
    }
    if (g.id !== e.pointerId) return;
    this.finishGesture(true);
    if (e.pointerType === 'touch') {
      this.hoverF = null;
      this.setHover(null);
    }
  };

  private readonly onPointerCancel = (e: PointerEvent): void => {
    if (e.pointerType === 'touch') this.touches.delete(e.pointerId);
    if (e.pointerType === 'pen') this.penDown = false;
    const g = this.gesture;
    if (!g) return;
    if (g.kind === 'pinch') {
      if (g.ids.includes(e.pointerId)) this.gesture = null;
      return;
    }
    if (g.id === e.pointerId) this.finishGesture(true);
  };

  private readonly onLostCapture = (e: PointerEvent): void => {
    const g = this.gesture;
    if (g && g.kind !== 'pinch' && g.id === e.pointerId && !this.touches.has(e.pointerId)) this.finishGesture(true);
  };

  private readonly onPointerEnter = (e: PointerEvent): void => {
    this.pointerInside = true;
    if (e.pointerType !== 'touch') setActive(this);
  };

  private readonly onPointerLeave = (e: PointerEvent): void => {
    this.pointerInside = false;
    if (e.pointerType === 'touch') return;
    if (!this.gesture) this.setHover(null);
  };

  /** Completes the current gesture (commit = keep its result). */
  private finishGesture(commit: boolean): void {
    const g = this.gesture;
    if (!g) return;
    if (!commit) {
      this.cancelGesture();
      return;
    }
    this.gesture = null;
    switch (g.kind) {
      case 'stroke':
        this.commit();
        this.lastPointF = g.lastF;
        break;
      case 'shape':
        this.commit();
        this.lastPointF = [g.end[0] + 0.5, g.end[1] + 0.5];
        break;
      case 'external':
        this.commit();
        break;
      case 'marquee':
        if (!g.moved) this.sel = null;
        this.committedSel = this.sel;
        this.emitSelection();
        break;
      case 'move':
        if (g.moved) {
          this.commit();
          this.emitSelection();
        } else if (g.lifted) {
          this.dropUnmovedFloat();
        }
        break;
      default:
        break;
    }
    if (g.kind !== 'pinch') {
      try {
        if (this.canvas.hasPointerCapture(g.id)) this.canvas.releasePointerCapture(g.id);
      } catch {
        // ignore
      }
    }
    this.updateCursor();
    this.requestRender();
  }

  /** Finishes any gesture in progress, keeping its result. */
  private endGesture(): void {
    if (this.gesture) this.finishGesture(true);
  }

  /** Aborts the gesture in progress, undoing its uncommitted effect. */
  private cancelGesture(): void {
    const g = this.gesture;
    if (!g) return;
    this.gesture = null;
    switch (g.kind) {
      case 'stroke':
      case 'shape':
      case 'external':
        this.restoreStroke();
        break;
      case 'marquee':
        this.sel = g.prevSel;
        this.updateAnts();
        break;
      case 'move': {
        const f = this.float;
        if (!f) break;
        if (g.lifted) {
          const r = unionRect(f.composed, { x: g.x0, y: g.y0, w: f.buf.width, h: f.buf.height });
          const c = r && clampRect(r, this.img.width, this.img.height);
          if (c) {
            writeRegion(this.img.data, this.img.width, c, copyRegion(this.baseline, this.img.width, c));
            this.markDirtyRect(c);
          }
          this.dropUnmovedFloat();
        } else {
          f.x = g.x0;
          f.y = g.y0;
          this.compose();
        }
        break;
      }
      default:
        break;
    }
    this.updateCursor();
    this.requestRender();
  }

  private beginPinch(): void {
    const g = this.gesture;
    if (g && g.kind !== 'pinch') this.cancelGesture();
    const [[idA, a], [idB, b]] = [...this.touches.entries()];
    this.clientRect = null;
    const [ax, ay] = this.clientToDevice(a.x, a.y);
    const [bx, by] = this.clientToDevice(b.x, b.y);
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    this.gesture = {
      kind: 'pinch',
      ids: [idA, idB],
      d0: Math.max(1, Math.hypot(bx - ax, by - ay)),
      ds0: this.ds,
      ix: (mx - this.ox) / this.ds,
      iy: (my - this.oy) / this.ds,
      mx0: mx,
      my0: my,
      t0: performance.now(),
      travel: 0,
    };
    this.setHover(null);
  }

  private movePinch(g: Extract<Gesture, { kind: 'pinch' }>): void {
    const a = this.touches.get(g.ids[0]);
    const b = this.touches.get(g.ids[1]);
    if (!a || !b) return;
    const [ax, ay] = this.clientToDevice(a.x, a.y);
    const [bx, by] = this.clientToDevice(b.x, b.y);
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    const d = Math.max(1, Math.hypot(bx - ax, by - ay));
    g.travel = Math.max(g.travel, Math.abs(d - g.d0), Math.hypot(mx - g.mx0, my - g.my0));
    const ds = this.snapDs(g.ds0 * (d / g.d0));
    const changed = ds !== this.ds;
    this.ds = ds;
    this.ox = Math.round(mx - g.ix * ds);
    this.oy = Math.round(my - g.iy * ds);
    this.autoFit = false;
    this.clampOffsets();
    this.afterViewChange(changed);
  }

  private endPinch(g: Extract<Gesture, { kind: 'pinch' }>, liftedId: number): void {
    const other = g.ids[0] === liftedId ? g.ids[1] : g.ids[0];
    const tap = performance.now() - g.t0 < 300 && g.travel < 12 * this.dpr;
    this.gesture = this.touches.has(other) ? { kind: 'ignore', id: other, touch: true } : null;
    if (tap) this.undo();
  }

  // ---------------------------------------------------------------------------
  // Internals: wheel & zoom

  private readonly onWheel = (e: WheelEvent): void => {
    if (this.destroyed) return;
    e.preventDefault();
    this.clientRect = null;
    const [ax, ay] = this.clientToDevice(e.clientX, e.clientY);
    let dx = e.deltaX;
    let dy = e.deltaY;
    if (e.deltaMode === 1) { dx *= 16; dy *= 16; } else if (e.deltaMode === 2) { dx *= this.canvas.height; dy *= this.canvas.height; }
    const now = performance.now();
    const s = this.clientScale();
    if (!e.ctrlKey && !e.metaKey) {
      if (e.shiftKey) {
        this.panBy(-(dy || dx) * s, 0);
        return;
      }
      // Two-finger trackpad scrolling produces horizontal deltas; treat that gesture as panning.
      if ((e.deltaMode === 0 && dx !== 0) || now - this.lastPanWheel < 180) {
        this.lastPanWheel = now;
        this.panBy(-dx * s, -dy * s);
        return;
      }
    }
    if (dy === 0) return;
    if (e.ctrlKey || e.metaKey || (e.deltaMode === 0 && Math.abs(dy) < 40)) {
      if (now - this.lastZoomWheel > 250) this.zoomAcc = this.ds;
      this.zoomAcc = clamp(this.zoomAcc * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.004)), this.minDs(), MAX_DS);
      this.applyZoom(this.snapDs(this.zoomAcc), ax, ay, true);
    } else {
      this.stepZoom(dy < 0 ? 1 : -1, ax, ay);
    }
    this.lastZoomWheel = now;
  };

  private panBy(dx: number, dy: number): void {
    this.ox = Math.round(this.ox + dx);
    this.oy = Math.round(this.oy + dy);
    this.autoFit = false;
    this.clampOffsets();
    this.requestRender();
  }

  private minDs(): number {
    const m = Math.max(this.img.width, this.img.height);
    const n = clamp(Math.floor(m / 16), 1, 16);
    return 1 / n;
  }

  private snapDs(v: number): number {
    const c = clamp(v, this.minDs(), MAX_DS);
    const s = c >= 1 ? Math.round(c) : 1 / Math.round(1 / c);
    return clamp(s, this.minDs(), MAX_DS);
  }

  private stepZoom(dir: 1 | -1, ax = this.canvas.width / 2, ay = this.canvas.height / 2): void {
    if (!this.viewReady) return;
    const cur = this.ds;
    let next = cur;
    if (dir > 0) next = ZOOM_STEPS.find((z) => z > cur + 1e-9) ?? MAX_DS;
    else for (let i = ZOOM_STEPS.length - 1; i >= 0; i--) if (ZOOM_STEPS[i] < cur - 1e-9) { next = ZOOM_STEPS[i]; break; }
    this.applyZoom(next, ax, ay);
  }

  private applyZoom(ds: number, ax: number, ay: number, keepAcc = false): void {
    const next = clamp(ds, this.minDs(), MAX_DS);
    if (!keepAcc) this.zoomAcc = next;
    if (next === this.ds) return;
    const ix = (ax - this.ox) / this.ds;
    const iy = (ay - this.oy) / this.ds;
    this.ds = next;
    this.ox = Math.round(ax - ix * next);
    this.oy = Math.round(ay - iy * next);
    this.autoFit = false;
    this.clampOffsets();
    this.afterViewChange(true);
  }

  private clampOffsets(): void {
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const iw = this.img.width * this.ds;
    const ih = this.img.height * this.ds;
    const mx = Math.min(48 * this.dpr, iw);
    const my = Math.min(48 * this.dpr, ih);
    this.ox = Math.round(clamp(this.ox, mx - iw, cw - mx));
    this.oy = Math.round(clamp(this.oy, my - ih, ch - my));
  }

  private afterViewChange(zoomChanged: boolean): void {
    this.updateHud();
    this.requestRender();
    if (zoomChanged) this.emit('zoom', this.getZoom());
  }

  private viewInfo(): PixelView {
    const dpr = this.dpr;
    const ds = this.ds;
    const ox = this.ox;
    const oy = this.oy;
    return {
      scale: ds / dpr,
      offsetX: ox / dpr,
      offsetY: oy / dpr,
      toScreen: (x: number, y: number): [number, number] => [(ox + x * ds) / dpr, (oy + y * ds) / dpr],
    };
  }

  private onResize(entries: ResizeObserverEntry[]): void {
    if (this.destroyed) return;
    const entry = entries[entries.length - 1];
    const dpr = window.devicePixelRatio || 1;
    let w = Math.round(entry.contentRect.width * dpr);
    let h = Math.round(entry.contentRect.height * dpr);
    const dev = entry.devicePixelContentBoxSize?.[0];
    // Exact device size when the browser reports a plausible one (it can disagree under zoom emulation).
    if (dev && Math.abs(dev.inlineSize - w) <= 2 && Math.abs(dev.blockSize - h) <= 2) {
      w = dev.inlineSize;
      h = dev.blockSize;
    }
    this.resizeTo(w, h, dpr);
  }

  /** Browsers do not always report a device-pixel-ratio change (moving to another monitor) as a resize. */
  private watchDpr(): void {
    if (typeof window.matchMedia !== 'function' || this.destroyed) return;
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    const onChange = () => {
      mq.removeEventListener('change', onChange);
      if (this.destroyed) return;
      const dpr = window.devicePixelRatio || 1;
      const r = this.canvas.getBoundingClientRect();
      this.resizeTo(Math.round(r.width * dpr), Math.round(r.height * dpr), dpr);
      this.watchDpr();
    };
    mq.addEventListener('change', onChange);
    this.dprCleanup = () => mq.removeEventListener('change', onChange);
  }

  private resizeTo(w: number, h: number, dpr: number): void {
    this.clientRect = null;
    if (this.colorsPending && this.element.isConnected) this.refreshColors();
    // A hidden editor (display: none, a collapsed panel) keeps its last view until it is shown again.
    if (!w || !h) return;
    const pw = this.canvas.width;
    const ph = this.canvas.height;
    const prevDpr = this.dpr;
    const prevZoom = this.ds / prevDpr;
    const dprChanged = dpr !== prevDpr;
    if (this.viewReady && w === pw && h === ph && !dprChanged) return;
    // The image point at the centre of the old view stays at the centre of the new one.
    const cx = (pw / 2 - this.ox) / this.ds;
    const cy = (ph / 2 - this.oy) / this.ds;
    if (dprChanged) {
      this.dpr = dpr;
      this.ds = this.snapDs(prevZoom * dpr);
      this.checkerKey = '';
      this.refreshColors();
    }
    this.canvas.width = w;
    this.canvas.height = h;
    if (!this.viewReady || this.autoFit) {
      const z = this.pendingZoom;
      this.pendingZoom = 0;
      this.viewReady = true;
      this.zoomToFit();
      if (z) this.setZoom(z);
    } else {
      this.ox = Math.round(w / 2 - cx * this.ds);
      this.oy = Math.round(h / 2 - cy * this.ds);
      this.clampOffsets();
      this.afterViewChange(this.ds / this.dpr !== prevZoom);
    }
    this.render();
  }

  // ---------------------------------------------------------------------------
  // Internals: keyboard & clipboard

  private acceptsKeys(target: EventTarget | null): boolean {
    if (this.destroyed || activeCanvas !== this) return false;
    if (!this.element.isConnected || this.element.getClientRects().length === 0) return false;
    if (isEditableTarget(target)) return false;
    if (target instanceof Element && !this.element.contains(target)) {
      const dialog = target.closest('dialog, [role="dialog"], [role="alertdialog"], [aria-modal="true"]');
      if (dialog && !dialog.contains(this.element)) return false;
    }
    return true;
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.defaultPrevented || !this.acceptsKeys(e.target)) return;
    const t = e.target;
    const onCanvas = t === this.element || t === document.body || t === document.documentElement || t === null || t === window;
    const onControl = !onCanvas && t instanceof HTMLElement && !!t.closest('button, a[href], input, [role="button"], [role="tab"], [role="radio"], [role="menuitem"], [role="option"], [role="slider"], [role="switch"], [role="checkbox"]');
    // Lists, menus and grids use letters for type-ahead and Escape/Delete for themselves.
    const inWidget = !onCanvas && t instanceof Element && !!t.closest('[role="listbox"], [role="grid"], [role="treegrid"], [role="tree"], [role="menu"], [role="menubar"], [role="combobox"]');
    const key = e.key;
    const mod = e.ctrlKey || e.metaKey;

    if (key === ' ') {
      if (mod || (!onCanvas && !this.pointerInside) || (onControl && !this.pointerInside)) return;
      e.preventDefault();
      if (!this.spaceDown) {
        this.spaceDown = true;
        this.updateCursor();
      }
      return;
    }
    if (key === 'Alt') {
      if (this.pointerInside || onCanvas) {
        e.preventDefault();
        if (!this.altDown) {
          this.altDown = true;
          this.updateCursor();
          this.requestRender();
        }
      }
      return;
    }
    if (key === 'Shift') {
      this.shiftDown = true;
      if (this.gesture?.kind === 'shape') this.drawShape(this.gesture);
      return;
    }

    if (mod && !e.altKey) {
      const k = key.toLowerCase();
      if (k === 'z') {
        e.preventDefault();
        if (e.shiftKey) this.redo(); else this.undo();
      } else if (k === 'y' && !e.shiftKey) {
        e.preventDefault();
        this.redo();
      } else if (k === 'a' && !e.shiftKey && (onCanvas || onControl) && !inWidget) {
        e.preventDefault();
        this.selectAll();
      } else if (k === 'd' && !e.shiftKey && !inWidget) {
        e.preventDefault();
        this.deselect();
      }
      return;
    }
    if (e.altKey || mod || inWidget) return;

    if (key === 'Escape') {
      if (this.gesture && this.gesture.kind !== 'pinch') {
        e.preventDefault();
        this.cancelGesture();
      } else if (this.float || this.sel) {
        e.preventDefault();
        this.finalizeFloat();
        this.deselect();
      } else if (this.kb) {
        this.kb = null;
        this.requestRender();
      }
      return;
    }
    if (key === 'Enter') {
      if (onControl) return;
      if (this.float) {
        e.preventDefault();
        this.commitSelection();
      } else if (this.kb && t === this.element) {
        e.preventDefault();
        this.applyAtKeyboardCursor(e.shiftKey);
      }
      return;
    }
    if (key === 'Delete' || key === 'Backspace') {
      if (this.sel || this.float) {
        e.preventDefault();
        this.clear();
      }
      return;
    }
    if (key.startsWith('Arrow')) {
      if (!onCanvas) return;
      const step = e.shiftKey ? 8 : 1;
      const dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0;
      const dy = key === 'ArrowUp' ? -step : key === 'ArrowDown' ? step : 0;
      e.preventDefault();
      if ((this.sel || this.float) && (this._tool === 'select' || this._tool === 'move') && !this.gesture) {
        this.nudge(dx, dy);
      } else if (t === this.element) {
        this.moveKeyboardCursor(Math.sign(dx) * (e.shiftKey ? 4 : 1), Math.sign(dy) * (e.shiftKey ? 4 : 1));
      }
      return;
    }
    if (this.gesture) return;
    // Held keys only repeat for brush size and zoom; a held H or U should not flicker.
    if (e.repeat && key !== '[' && key !== ']' && key !== '+' && key !== '=' && key !== '-' && key !== '_') return;

    const lower = key.length === 1 ? key.toLowerCase() : key;
    const toolKey = TOOL_KEYS[lower];
    let handled = true;
    if (toolKey && key.length === 1 && !e.shiftKey) this.setTool(toolKey);
    else if (lower === 'u' && !e.shiftKey) this.setTool(this._tool === 'rect' ? 'rect-fill' : 'rect');
    else if (lower === 'x' && !e.shiftKey) this.swapColors();
    else if (key === '[') this.setBrushSize(this._brushSize - 1);
    else if (key === ']') this.setBrushSize(this._brushSize + 1);
    else if (key === '0') this.zoomToFit();
    else if (key === '+' || key === '=') this.zoomAtPointer(1);
    else if (key === '-' || key === '_') this.zoomAtPointer(-1);
    else if (lower === 'h') { if (e.shiftKey) this.flipV(); else this.flipH(); }
    else if (lower === 'r' && !e.shiftKey) this.rotate90();
    else if (key === '#') this.setShowGrid(!this._showGrid);
    else handled = false;
    if (handled) e.preventDefault();
  };

  private zoomAtPointer(dir: 1 | -1): void {
    if (this.hoverF && this.pointerInside) {
      this.stepZoom(dir, this.ox + this.hoverF[0] * this.ds, this.oy + this.hoverF[1] * this.ds);
    } else {
      this.stepZoom(dir);
    }
  }

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    if (this.destroyed) return;
    if (e.key === ' ' && this.spaceDown) {
      this.spaceDown = false;
      this.updateCursor();
    } else if (e.key === 'Alt' && this.altDown) {
      this.altDown = false;
      if (this.pointerInside) e.preventDefault();
      this.updateCursor();
      this.requestRender();
    } else if (e.key === 'Shift') {
      this.shiftDown = false;
      if (this.gesture?.kind === 'shape') this.drawShape(this.gesture);
    }
  };

  private readonly onWindowBlur = (): void => {
    this.spaceDown = false;
    this.altDown = false;
    this.shiftDown = false;
    this.updateCursor();
  };

  private readonly onCopy = (e: ClipboardEvent): void => {
    if (!this.acceptsKeys(e.target) || hasTextSelection()) return;
    if (!this.copy() || !clipboard) return;
    e.clipboardData?.setData('text/plain', clipboard.token);
    e.preventDefault();
  };

  private readonly onCut = (e: ClipboardEvent): void => {
    if (!this.acceptsKeys(e.target) || hasTextSelection()) return;
    if (!this.cut() || !clipboard) return;
    e.clipboardData?.setData('text/plain', clipboard.token);
    e.preventDefault();
  };

  private readonly onPaste = (e: ClipboardEvent): void => {
    if (!this.acceptsKeys(e.target)) return;
    const dt = e.clipboardData;
    const text = dt?.getData('text/plain') ?? '';
    if (clipboard && text === clipboard.token) {
      e.preventDefault();
      this.pasteImage(clipboard.img);
      return;
    }
    const item = dt ? [...dt.items].find((it) => it.kind === 'file' && it.type.startsWith('image/')) : undefined;
    const file = item?.getAsFile();
    if (file && this.decode) {
      e.preventDefault();
      this.decode(file)
        .then((img) => {
          if (!this.destroyed) this.pasteImage(img);
        })
        .catch((err) => {
          console.warn('The pasted image could not be read', err);
          this.announce('The pasted image could not be read');
        });
      return;
    }
    if (clipboard && !text && !file) {
      e.preventDefault();
      this.pasteImage(clipboard.img);
    }
  };

  private moveKeyboardCursor(dx: number, dy: number): void {
    delete this.element.dataset.pointerFocus;
    const W = this.img.width;
    const H = this.img.height;
    const cur = this.kb ?? (this.hoverPixel ? [this.hoverPixel.x, this.hoverPixel.y] as Point : [Math.floor(W / 2), Math.floor(H / 2)] as Point);
    const next: Point = this.kb ? [clamp(cur[0] + dx, 0, W - 1), clamp(cur[1] + dy, 0, H - 1)] : cur;
    this.kb = next;
    this.hoverF = [next[0] + 0.5, next[1] + 0.5];
    this.setHover(this.hoverF);
    this.ensureVisible(next[0], next[1]);
    const c = pickColor(this.img, next[0], next[1], 'rgba');
    this.announce(`${next[0]}, ${next[1]}: ${c[3] === 0 ? 'transparent' : rgbaToHex(c)}`);
    this.requestRender();
  }

  private applyAtKeyboardCursor(secondary: boolean): void {
    if (!this.kb) return;
    const fx = this.kb[0] + 0.5;
    const fy = this.kb[1] + 0.5;
    const tool = this._tool;
    if (tool === 'fill') this.doFill(fx, fy, secondary);
    else if (tool === 'picker') this.doPick(fx, fy, secondary);
    else if (tool === 'select' || tool === 'move') return;
    else {
      const strokeTool: StrokeTool = tool === 'eraser' || tool === 'lighten' || tool === 'darken' || tool === 'noise' ? tool : 'pencil';
      this.prepareEdit(strokeTool, secondary);
      this.stampPixel(this.kb[0], this.kb[1]);
      this.commit();
      this.lastPointF = [fx, fy];
    }
    this.requestRender();
  }

  private ensureVisible(x: number, y: number): void {
    const px = this.ox + (x + 0.5) * this.ds;
    const py = this.oy + (y + 0.5) * this.ds;
    const m = Math.max(this.ds, 24 * this.dpr);
    let dx = 0;
    let dy = 0;
    if (px < m) dx = m - px; else if (px > this.canvas.width - m) dx = this.canvas.width - m - px;
    if (py < m) dy = m - py; else if (py > this.canvas.height - m) dy = this.canvas.height - m - py;
    if (dx || dy) this.panBy(dx, dy);
  }

  private announce(msg: string): void {
    window.clearTimeout(this.liveTimer);
    this.liveTimer = window.setTimeout(() => { this.live.textContent = msg; }, 120);
  }

  // ---------------------------------------------------------------------------
  // Internals: hover, cursor, HUD

  private setHover(f: [number, number] | null): void {
    this.hoverF = f;
    let p: { x: number; y: number } | null = null;
    if (f) {
      let x = Math.floor(f[0]);
      let y = Math.floor(f[1]);
      const W = this.img.width;
      const H = this.img.height;
      if (this._tiled) {
        x = mod(x, W);
        y = mod(y, H);
        p = { x, y };
      } else if (x >= 0 && y >= 0 && x < W && y < H) p = { x, y };
    }
    const prev = this.hoverPixel;
    if (p?.x !== prev?.x || p?.y !== prev?.y) {
      this.hoverPixel = p;
      this.emit('hover', p ? { ...p } : null);
      this.updateHud();
    }
    this.requestRender();
  }

  private updateCursor(): void {
    const g = this.gesture;
    let c: string;
    if (g?.kind === 'pan') c = 'grabbing';
    else if (this.spaceDown) c = 'grab';
    else if (g?.kind === 'move') c = 'move';
    else if (this.altDown || this._tool === 'picker' || g?.kind === 'pick') c = 'pick';
    else if (this._tool === 'move') c = 'move';
    else if (this._tool === 'select') {
      const h = this.hoverF;
      c = h && this.sel && rectContains(this.sel, Math.floor(h[0]), Math.floor(h[1])) ? 'move' : 'select';
    } else c = 'paint';
    if (this.canvas.dataset.cursor !== c) this.canvas.dataset.cursor = c;
  }

  private updateHud(): void {
    const p = this.hoverPixel;
    this.hudPos.textContent = p ? `${p.x}, ${p.y}` : '';
    const z = this.ds / this.dpr;
    this.hudZoom.textContent = `${z >= 1 ? Math.round(z * 100) : Math.round(z * 1000) / 10}%`;
  }

  // ---------------------------------------------------------------------------
  // Internals: rendering

  private requestRender(): void {
    if (this.raf || this.destroyed) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.render();
    });
  }

  private updateAnts(): void {
    const need = !!this.sel && !this.destroyed && !this.reducedMotion?.matches;
    if (need && !this.antsTimer) {
      this.antsTimer = window.setInterval(() => {
        if (document.hidden || this.element.getClientRects().length === 0) return;
        this.antsPhase = (this.antsPhase + 1) % 1024;
        this.requestRender();
      }, 110);
    } else if (!need && this.antsTimer) {
      window.clearInterval(this.antsTimer);
      this.antsTimer = 0;
    }
  }

  private refreshColors(): void {
    if (this.destroyed) return;
    // Views often build their DOM detached and attach it later; theme variables only resolve once connected.
    this.colorsPending = !this.element.isConnected;
    const cs = getComputedStyle(this.element);
    const v = (name: string, fallback: string) => cs.getPropertyValue(name).trim() || fallback;
    this.colors = {
      a: v('--pc-checker-a', '#282e3c'),
      b: v('--pc-checker-b', '#1f2430'),
      grid: v('--pc-grid', 'rgba(0,0,0,0.3)'),
      gridLight: v('--pc-grid-light', 'rgba(255,255,255,0.1)'),
      border: v('--pc-border', 'rgba(255,255,255,0.16)'),
      accent: v('--pc-accent', '#5bd35b'),
      mask: v('--pc-mask', 'rgba(6,8,12,0.58)'),
    };
    const cell = Math.max(4, Math.round(8 * this.dpr));
    const key = `${this.colors.a}|${this.colors.b}|${cell}`;
    if (key !== this.checkerKey) {
      this.checkerKey = key;
      const c = document.createElement('canvas');
      c.width = cell * 2;
      c.height = cell * 2;
      const g = c.getContext('2d');
      if (g) {
        g.fillStyle = this.colors.a;
        g.fillRect(0, 0, cell * 2, cell * 2);
        g.fillStyle = this.colors.b;
        g.fillRect(cell, 0, cell, cell);
        g.fillRect(0, cell, cell, cell);
        this.checker = this.ctx.createPattern(c, 'repeat');
      }
    }
    this.buildMaskCanvas();
    this.requestRender();
  }

  /** Bounding box of the editable pixels, or null without a mask. */
  private maskBounds(): Rect | null {
    const m = this.mask;
    if (!m) return null;
    const W = this.img.width;
    let x0 = W, y0 = this.img.height, x1 = -1, y1 = -1;
    for (let p = 0; p < m.length; p++) {
      if (!m[p]) continue;
      const x = p % W;
      const y = (p - x) / W;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    return x1 < 0 ? { x: 0, y: 0, w: 0, h: 0 } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  private applyMask(m: Uint8Array | null): void {
    if (m && m.length !== this.img.width * this.img.height) {
      console.warn(`PixelCanvas: mask length ${m.length} does not match image ${this.img.width}x${this.img.height}; ignoring it`);
      m = null;
    }
    this.mask = m ? new Uint8Array(m) : null;
    this.buildMaskCanvas();
  }

  private buildMaskCanvas(): void {
    if (!this.mask || !this.dimMasked) {
      this.maskCanvas = null;
      return;
    }
    const W = this.img.width;
    const H = this.img.height;
    const c = this.maskCanvas ?? document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, W, H);
    // Draw a solid tint through a pixel mask: put the mask as alpha, then colour it in.
    const data = createImage(W, H);
    const d = data.data;
    for (let p = 0; p < W * H; p++) if (!this.mask[p]) d[p * 4 + 3] = 255;
    g.putImageData(data, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = this.colors.mask;
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
    this.maskCanvas = c;
  }

  private onDimensionsChanged(): void {
    const W = this.img.width;
    const H = this.img.height;
    this.imgCanvas.width = W;
    this.imgCanvas.height = H;
    this.display = null;
    this.touched = new Uint32Array(W * H);
    this.gen = 0;
    if (this.mask && this.mask.length !== W * H) {
      console.warn('PixelCanvas: image size changed, the paint mask was removed');
      this.mask = null;
    }
    this.buildMaskCanvas();
    this.kb = null;
    this.lastPointF = null;
    this.setHover(this.hoverF);
  }

  private flushImage(): void {
    if (this.dx1 < 0) return;
    const W = this.img.width;
    const H = this.img.height;
    const x0 = clamp(this.dx0, 0, W - 1);
    const y0 = clamp(this.dy0, 0, H - 1);
    const x1 = clamp(this.dx1, 0, W - 1);
    const y1 = clamp(this.dy1, 0, H - 1);
    this.dx0 = Infinity; this.dy0 = Infinity; this.dx1 = -1; this.dy1 = -1;
    let src = this.img;
    if (this._channelMode !== 'rgba') {
      if (!this.display || this.display.width !== W || this.display.height !== H) this.display = createImage(W, H);
      const s = this.img.data;
      const d = this.display.data;
      const alpha = this._channelMode === 'alpha';
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const i = (y * W + x) * 4;
          if (alpha) { d[i] = d[i + 1] = d[i + 2] = s[i + 3]; } else { d[i] = s[i]; d[i + 1] = s[i + 1]; d[i + 2] = s[i + 2]; }
          d[i + 3] = 255;
        }
      }
      src = this.display;
    }
    this.imgCtx.putImageData(src, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
  }

  private drawImageClipped(src: CanvasImageSource, x0: number, y0: number): void {
    const W = this.img.width;
    const H = this.img.height;
    const ds = this.ds;
    const sx = Math.max(0, Math.floor(-x0 / ds));
    const sy = Math.max(0, Math.floor(-y0 / ds));
    const ex = Math.min(W, Math.ceil((this.canvas.width - x0) / ds));
    const ey = Math.min(H, Math.ceil((this.canvas.height - y0) / ds));
    if (ex <= sx || ey <= sy) return;
    this.ctx.drawImage(src, sx, sy, ex - sx, ey - sy, x0 + sx * ds, y0 + sy * ds, (ex - sx) * ds, (ey - sy) * ds);
  }

  private render(): void {
    if (this.destroyed) return;
    this.flushImage();
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    if (!cw || !ch) return;
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.setLineDash([]);
    ctx.clearRect(0, 0, cw, ch);
    ctx.imageSmoothingEnabled = false;
    const { ds, ox, oy, dpr } = this;
    const W = this.img.width;
    const H = this.img.height;
    const iw = W * ds;
    const ih = H * ds;

    if (this._tiled) {
      ctx.globalAlpha = 0.5;
      for (let ty = -1; ty <= 1; ty++) {
        for (let tx = -1; tx <= 1; tx++) {
          if (tx || ty) this.drawImageClipped(this.imgCanvas, ox + tx * iw, oy + ty * ih);
        }
      }
      ctx.globalAlpha = 1;
    }

    // Transparency checkerboard, anchored to the image corner.
    const rx = Math.max(0, ox);
    const ry = Math.max(0, oy);
    const rx2 = Math.min(cw, ox + iw);
    const ry2 = Math.min(ch, oy + ih);
    const checker = rx2 > rx && ry2 > ry && this._channelMode === 'rgba' ? this.transparencyPattern() : null;
    if (checker) {
      checker.setTransform(new DOMMatrix([1, 0, 0, 1, ox, oy]));
      ctx.fillStyle = checker;
      ctx.fillRect(rx, ry, rx2 - rx, ry2 - ry);
    }
    this.drawImageClipped(this.imgCanvas, ox, oy);
    if (this.maskCanvas) this.drawImageClipped(this.maskCanvas, ox, oy);

    if (this._showGrid && ds / dpr >= GRID_MIN_SCALE && rx2 > rx && ry2 > ry) {
      // Engraved hairlines: a dark line with a faint light line beside it reads on light and dark pixels alike.
      const gx0 = Math.max(1, Math.ceil(-ox / ds));
      const gx1 = Math.min(W - 1, Math.floor((cw - ox) / ds));
      const gy0 = Math.max(1, Math.ceil(-oy / ds));
      const gy1 = Math.min(H - 1, Math.floor((ch - oy) / ds));
      const lw = ds >= 24 && dpr >= 2 ? 2 : 1;
      ctx.fillStyle = this.colors.gridLight;
      for (let x = gx0; x <= gx1; x++) ctx.fillRect(ox + x * ds, ry, lw, ry2 - ry);
      for (let y = gy0; y <= gy1; y++) ctx.fillRect(rx, oy + y * ds, rx2 - rx, lw);
      ctx.fillStyle = this.colors.grid;
      for (let x = gx0; x <= gx1; x++) ctx.fillRect(ox + x * ds - lw, ry, lw, ry2 - ry);
      for (let y = gy0; y <= gy1; y++) ctx.fillRect(rx, oy + y * ds - lw, rx2 - rx, lw);
    }

    ctx.strokeStyle = this.colors.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(ox) - 0.5, Math.round(oy) - 0.5, Math.round(iw) + 1, Math.round(ih) + 1);

    if (this.overlay && !this.overlayFailed) {
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      try {
        this.overlay(ctx, this.viewInfo());
      } catch (err) {
        this.overlayFailed = true;
        console.error('PixelCanvas overlay failed; it is disabled until setOverlay() is called again', err);
      }
      ctx.restore();
      ctx.imageSmoothingEnabled = false;
    }

    this.drawMirrorGuides();
    this.drawSelection();
    this.drawHover();
  }

  /**
   * Checkerboard behind transparent pixels. Once pixels are big enough it follows the pixel grid
   * so it never cuts pixels in odd places.
   */
  private transparencyPattern(): CanvasPattern | null {
    const ds = this.ds;
    const css = ds / this.dpr;
    if (css < GRID_MIN_SCALE || !Number.isInteger(ds)) return this.checker;
    // 2x2 cells inside each pixel keep a lone transparent pixel recognisable; single cells only when tiny.
    const split = css >= 8;
    const size = split ? ds : ds * 2;
    const key = `${this.colors.a}|${this.colors.b}|${ds}|${split}`;
    if (key !== this.pixelCheckerKey) {
      const c = document.createElement('canvas');
      c.width = size;
      c.height = size;
      const g = c.getContext('2d');
      if (!g) return this.checker;
      const half = split ? Math.floor(ds / 2) : ds;
      g.fillStyle = this.colors.a;
      g.fillRect(0, 0, size, size);
      g.fillStyle = this.colors.b;
      g.fillRect(half, 0, size - half, half);
      g.fillRect(0, half, half, size - half);
      this.pixelChecker = this.ctx.createPattern(c, 'repeat');
      this.pixelCheckerKey = key;
    }
    return this.pixelChecker ?? this.checker;
  }

  private drawMirrorGuides(): void {
    if (this.mirrorMap || (!this._mirrorX && !this._mirrorY)) return;
    const ctx = this.ctx;
    const { ds, ox, oy, dpr } = this;
    const iw = this.img.width * ds;
    const ih = this.img.height * ds;
    const lw = Math.max(1, Math.round(dpr));
    const half = lw % 2 ? 0.5 : 0;
    const ext = 10 * dpr;
    ctx.save();
    ctx.lineWidth = lw;
    ctx.setLineDash([6 * dpr, 4 * dpr]);
    ctx.strokeStyle = this.colors.accent;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    if (this._mirrorX) {
      const x = Math.round(ox + iw / 2) + half;
      ctx.moveTo(x, oy - ext);
      ctx.lineTo(x, oy + ih + ext);
    }
    if (this._mirrorY) {
      const y = Math.round(oy + ih / 2) + half;
      ctx.moveTo(ox - ext, y);
      ctx.lineTo(ox + iw + ext, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  private drawSelection(): void {
    const s = this.sel;
    if (!s) return;
    const ctx = this.ctx;
    const { ds, ox, oy, dpr } = this;
    const x = Math.round(ox + s.x * ds) + 0.5;
    const y = Math.round(oy + s.y * ds) + 0.5;
    const w = Math.max(1, Math.round(s.w * ds) - 1);
    const h = Math.max(1, Math.round(s.h * ds) - 1);
    const dash = Math.max(3, Math.round(4 * dpr));
    ctx.save();
    ctx.lineWidth = 1;
    ctx.setLineDash([dash, dash]);
    ctx.strokeStyle = '#000';
    ctx.lineDashOffset = -this.antsPhase;
    ctx.strokeRect(x, y, w, h);
    ctx.strokeStyle = '#fff';
    ctx.lineDashOffset = -this.antsPhase + dash;
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }

  private footprintFor(tool: Tool, fx: number, fy: number): Point[] {
    const size = this._brushSize;
    switch (tool) {
      case 'pencil':
      case 'eraser':
      case 'lighten':
      case 'darken':
      case 'noise': {
        const [ox, oy] = brushOrigin(fx, fy, size);
        return brushOffsets(size, this._brushShape).map(([dx, dy]) => [ox + dx, oy + dy] as Point);
      }
      case 'line':
      case 'rect':
      case 'ellipse': {
        const [ox, oy] = brushOriginAt(Math.floor(fx), Math.floor(fy), size);
        return brushOffsets(size, this._brushShape).map(([dx, dy]) => [ox + dx, oy + dy] as Point);
      }
      case 'move':
        return [];
      default:
        return [[Math.floor(fx), Math.floor(fy)]];
    }
  }

  private drawHover(): void {
    const f = this.hoverF;
    if (!f || this.hoverIsTouch) return;
    const g = this.gesture;
    if (g && (g.kind === 'pan' || g.kind === 'pinch' || g.kind === 'shape' || g.kind === 'marquee' || g.kind === 'move')) return;
    if (this.spaceDown) return;
    const tool: Tool = this.altDown || g?.kind === 'pick' ? 'picker' : this._tool;
    const W = this.img.width;
    const H = this.img.height;
    const { ds, ox, oy } = this;
    const ctx = this.ctx;

    let fill: string | null = null;
    if (ds >= 3 && tool !== 'picker' && tool !== 'select' && tool !== 'fill' && tool !== 'move') {
      if (tool === 'eraser') fill = 'rgba(255,255,255,0.28)';
      else if (tool === 'lighten') fill = 'rgba(255,255,255,0.22)';
      else if (tool === 'darken') fill = 'rgba(0,0,0,0.3)';
      else {
        const c = this._color;
        fill = `rgba(${c[0]},${c[1]},${c[2]},${(c[3] / 255) * 0.65})`;
      }
    }

    const brushTool = tool === 'pencil' || tool === 'eraser' || tool === 'lighten' || tool === 'darken' || tool === 'noise'
      || tool === 'line' || tool === 'rect' || tool === 'ellipse';
    if (brushTool && !this._tiled && !this.mirrorMap) {
      // Fast path: the brush outline is cached per size/shape and translated to each mirror copy.
      const size = this._brushSize;
      const [bx, by] = tool === 'line' || tool === 'rect' || tool === 'ellipse'
        ? brushOriginAt(Math.floor(f[0]), Math.floor(f[1]), size)
        : brushOrigin(f[0], f[1], size);
      const shape = this.brushShapeCache(size);
      const origins: Point[] = [[bx, by]];
      const mx = W - bx - size;
      const my = H - by - size;
      if (this._mirrorX) origins.push([mx, by]);
      if (this._mirrorY) origins.push([bx, my]);
      if (this._mirrorX && this._mirrorY) origins.push([mx, my]);
      const visible = origins.filter(([x, y]) => x + size > 0 && y + size > 0 && x < W && y < H);
      if (!visible.length) return;
      if (fill) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(ox, oy, W * ds, H * ds);
        ctx.clip();
        ctx.fillStyle = fill;
        for (const [x0, y0] of visible) {
          for (let i = 0; i < shape.spans.length; i += 3) {
            ctx.fillRect(ox + (x0 + shape.spans[i + 1]) * ds, oy + (y0 + shape.spans[i]) * ds, (shape.spans[i + 2] - shape.spans[i + 1]) * ds, ds);
          }
        }
        ctx.restore();
      }
      this.strokeOutline(shape.segs, visible);
      return;
    }

    const base = this.footprintFor(tool, f[0], f[1]);
    if (!base.length) return;
    // Pixels shown: under the pointer, plus where they really land (wrap) and their mirror images.
    const shown = new Map<number, Point>();
    const stride = 4 * (W + H) + 8;
    const add = (x: number, y: number) => {
      if (!this._tiled && (x < 0 || y < 0 || x >= W || y >= H)) return;
      shown.set((y + 2 * H + 2) * stride + (x + 2 * W + 2), [x, y]);
    };
    const mirrored = tool !== 'picker' && tool !== 'select';
    for (const [x, y] of base) {
      add(x, y);
      if (!mirrored) continue;
      for (const [mx, my] of this.targetsOf(x, y)) add(mx, my);
    }
    if (!shown.size) return;
    const pts = [...shown.values()];
    if (fill) {
      ctx.fillStyle = fill;
      for (const [x, y] of pts) ctx.fillRect(ox + x * ds, oy + y * ds, ds, ds);
    }
    this.strokeOutline(outlineSegments(pts), [[0, 0]]);
    if (tool === 'picker') this.drawPickerSwatch(f);
  }

  private shapeCache: { key: string; segs: number[]; spans: number[] } | null = null;

  /** Outline segments and row spans ([dy, x0, x1) triples) of the current brush, cached. */
  private brushShapeCache(size: number): { segs: number[]; spans: number[] } {
    const key = `${this._brushShape}:${size}`;
    if (this.shapeCache?.key === key) return this.shapeCache;
    const offs = brushOffsets(size, this._brushShape);
    const spans: number[] = [];
    for (let y = 0; y < size; y++) {
      let x0 = -1;
      let x1 = -1;
      for (const [dx, dy] of offs) {
        if (dy !== y) continue;
        if (x0 < 0 || dx < x0) x0 = dx;
        if (dx + 1 > x1) x1 = dx + 1;
      }
      if (x0 >= 0) spans.push(y, x0, x1);
    }
    this.shapeCache = { key, segs: outlineSegments(offs), spans };
    return this.shapeCache;
  }

  /** Strokes outline segments (pixel units) at each origin with a dark halo and a light core. */
  private strokeOutline(segs: number[], origins: Point[]): void {
    const ctx = this.ctx;
    const { ds, ox, oy, dpr } = this;
    ctx.save();
    ctx.beginPath();
    for (const [bx, by] of origins) {
      for (let i = 0; i < segs.length; i += 4) {
        ctx.moveTo(Math.round(ox + (bx + segs[i]) * ds) + 0.5, Math.round(oy + (by + segs[i + 1]) * ds) + 0.5);
        ctx.lineTo(Math.round(ox + (bx + segs[i + 2]) * ds) + 0.5, Math.round(oy + (by + segs[i + 3]) * ds) + 0.5);
      }
    }
    ctx.lineCap = 'square';
    ctx.lineWidth = Math.max(2, Math.round(3 * dpr));
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.stroke();
    ctx.lineWidth = Math.max(1, Math.round(dpr));
    ctx.strokeStyle = this.kb ? this.colors.accent : 'rgba(255,255,255,0.95)';
    ctx.stroke();
    ctx.restore();
  }

  private drawPickerSwatch(f: [number, number]): void {
    const t = this.targetsOf(Math.floor(f[0]), Math.floor(f[1]))[0];
    if (!t) return;
    const c = pickColor(this.img, t[0], t[1], this._channelMode);
    const ctx = this.ctx;
    const { ds, ox, oy, dpr } = this;
    const size = Math.round(26 * dpr);
    const gap = Math.round(14 * dpr);
    let x = Math.round(ox + f[0] * ds) + gap;
    let y = Math.round(oy + f[1] * ds) - gap - size;
    if (x + size > this.canvas.width - 4) x -= size + gap * 2;
    if (y < 4) y += size + gap * 2;
    ctx.save();
    if (this.checker) {
      this.checker.setTransform(new DOMMatrix([1, 0, 0, 1, x, y]));
      ctx.fillStyle = this.checker;
      ctx.fillRect(x, y, size, size);
    }
    ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${c[3] / 255})`;
    ctx.fillRect(x, y, size, size);
    ctx.lineWidth = Math.max(1, Math.round(dpr));
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeRect(x - 0.5, y - 0.5, size + 1, size + 1);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
    ctx.restore();
  }

  private assertImage(img: ImageData): void {
    if (!img || !(img.width > 0) || !(img.height > 0) || !img.data || img.data.length !== img.width * img.height * 4) {
      throw new Error('The filter did not return a valid image');
    }
  }
}

function setActive(pc: PixelCanvas): void {
  activeCanvas = pc;
}
