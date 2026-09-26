// Manual + automated test bench for the pixel canvas. Open /tests/harness/pixel/index.html on the dev server.
import { PixelCanvas, TOOLS, type RGBA, type Tool } from '../../../src/shared/pixel-canvas';
import { createImage, hexToRgba, mulberry32, rgbaToHex } from '../../../src/shared/pixel-algorithms';

const params = new URLSearchParams(location.search);
const startSize = Number(params.get('size') || 16);

/** Original procedural test art: a mossy stone tile (no game assets). */
function sampleImage(size: number, seed = 7): ImageData {
  const img = createImage(size, size);
  const rand = mulberry32(seed);
  const cell = Math.max(1, size / 16);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = Math.floor(x / cell);
      const gy = Math.floor(y / cell);
      const r = mulberry32(gx * 131 + gy * 977 + seed)();
      const v = 100 + Math.floor(r * 50);
      let c: RGBA = [v, v + 4, v + 10, 255];
      if (gy < 4 + ((gx * 7) % 3)) c = [60 + Math.floor(r * 40), 150 + Math.floor(r * 50), 50, 255];
      if ((gx + gy * 3) % 11 === 0 && gy > 5) c = [70, 72, 80, 255];
      const i = (y * size + x) * 4;
      img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = c[3];
    }
  }
  // A few transparent holes so the checkerboard is visible.
  for (let k = 0; k < size / 4; k++) {
    const x = Math.floor(rand() * size);
    const y = Math.floor(size / 2 + rand() * (size / 2));
    img.data[(y * size + x) * 4 + 3] = 0;
  }
  return img;
}

function blankImage(w: number, h: number): ImageData {
  return createImage(w, h);
}

const app = document.getElementById('app')!;
const bar = document.createElement('div');
bar.className = 'bar';
const main = document.createElement('main');
const stage = document.createElement('div');
stage.id = 'stage';
const side = document.createElement('div');
side.id = 'side';
main.append(stage, side);
app.append(bar, main);

const initial = params.get('blank') === '1' ? blankImage(startSize, startSize) : sampleImage(startSize);
const pc = new PixelCanvas(stage, { image: initial, showGrid: true, label: 'Test texture' });

const events = { change: 0, history: 0, colorpick: [] as RGBA[], hover: null as null | { x: number; y: number }, tool: [] as Tool[], zoom: [] as number[], selection: 0 };
pc.on('change', () => { events.change++; log(`change #${events.change}`); });
pc.on('history', () => { events.history++; syncButtons(); });
pc.on('colorpick', (c) => { events.colorpick.push(c); primary.value = rgbaToHex(c, false); log(`colorpick ${rgbaToHex(c)}`); });
pc.on('hover', (p) => { events.hover = p; status.textContent = p ? `hover ${p.x},${p.y}` : 'hover -'; });
pc.on('tool', (t) => { events.tool.push(t); syncButtons(); });
pc.on('zoom', (z) => { events.zoom.push(z); });
pc.on('selection', () => { events.selection++; });
pc.on('settings', () => syncButtons());

// ---- toolbar
const toolButtons = new Map<Tool, HTMLButtonElement>();
for (const t of TOOLS) {
  const b = document.createElement('button');
  b.textContent = t;
  b.dataset.tool = t;
  b.addEventListener('click', () => pc.setTool(t));
  toolButtons.set(t, b);
  bar.append(b);
}
const sep = () => { const s = document.createElement('span'); s.className = 'sep'; return s; };
bar.append(sep());

const primary = document.createElement('input');
primary.type = 'color';
primary.value = '#000000';
primary.id = 'primary';
primary.addEventListener('input', () => { const c = hexToRgba(primary.value)!; pc.setColor([c[0], c[1], c[2], pc.color[3]]); });
const secondary = document.createElement('input');
secondary.type = 'color';
secondary.id = 'secondary';
secondary.value = '#ffffff';
secondary.addEventListener('input', () => pc.setSecondaryColor(hexToRgba(secondary.value)!));
const size = document.createElement('input');
size.type = 'number';
size.min = '1';
size.max = '64';
size.value = '1';
size.id = 'size';
size.addEventListener('input', () => pc.setBrushSize(Number(size.value)));
const text = document.createElement('input');
text.type = 'text';
text.id = 'text';
text.placeholder = 'type here (shortcuts off)';
bar.append(primary, secondary, size, text, sep());

function toggle(label: string, get: () => boolean, set: (v: boolean) => void, id: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.id = id;
  b.addEventListener('click', () => { set(!get()); syncButtons(); });
  toggles.push([b, get]);
  bar.append(b);
  return b;
}
const toggles: [HTMLButtonElement, () => boolean][] = [];
let maskOn = false;
let overlayOn = false;
toggle('mirror X', () => pc.mirrorX, (v) => pc.setMirror(v, pc.mirrorY), 'mirrorx');
toggle('mirror Y', () => pc.mirrorY, (v) => pc.setMirror(pc.mirrorX, v), 'mirrory');
toggle('grid', () => pc.showGrid, (v) => pc.setShowGrid(v), 'grid');
toggle('tiled', () => pc.tiledPreview, (v) => pc.setTiledPreview(v), 'tiled');
toggle('contiguous', () => pc.fillContiguous, (v) => { pc.fillContiguous = v; }, 'contiguous');
toggle('round', () => pc.brushShape === 'round', (v) => pc.setBrushShape(v ? 'round' : 'square'), 'round');
toggle('lock left half', () => maskOn, (v) => { maskOn = v; pc.setMask(v ? leftHalfMask() : null); }, 'mask');
toggle('overlay', () => overlayOn, (v) => { overlayOn = v; pc.setOverlay(v ? demoOverlay : null); }, 'overlay');
const channel = document.createElement('select');
channel.id = 'channel';
for (const m of ['rgba', 'rgb', 'alpha']) channel.append(new Option(m, m));
channel.addEventListener('change', () => pc.setChannelMode(channel.value as 'rgba'));
bar.append(channel, sep());

function action(label: string, fn: () => void, id: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.id = id;
  b.addEventListener('click', fn);
  bar.append(b);
  return b;
}
const undoBtn = action('undo', () => pc.undo(), 'undo');
const redoBtn = action('redo', () => pc.redo(), 'redo');
action('fit', () => pc.zoomToFit(), 'fit');
action('zoom +', () => pc.zoomIn(), 'zoomin');
action('zoom -', () => pc.zoomOut(), 'zoomout');
action('flip H', () => pc.flipH(), 'fliph');
action('flip V', () => pc.flipV(), 'flipv');
action('rotate', () => pc.rotate90(), 'rotate');
action('clear', () => pc.clear(), 'clear');
action('invert', () => pc.applyFilter((img) => {
  for (let i = 0; i < img.data.length; i += 4) { img.data[i] = 255 - img.data[i]; img.data[i + 1] = 255 - img.data[i + 1]; img.data[i + 2] = 255 - img.data[i + 2]; }
  return img;
}), 'invert');
action('copy', () => pc.copy(), 'copy');
action('paste', () => pc.paste(), 'paste');
action('theme', () => {
  const root = document.documentElement;
  root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
}, 'theme');
const sizeSel = document.createElement('select');
sizeSel.id = 'imgsize';
for (const n of [16, 32, 64, 128, 512]) sizeSel.append(new Option(`${n}x${n}`, String(n)));
sizeSel.value = String(startSize);
sizeSel.addEventListener('change', () => pc.setImage(sampleImage(Number(sizeSel.value))));
bar.append(sizeSel);

const status = document.createElement('div');
const logEl = document.createElement('pre');
logEl.style.whiteSpace = 'pre-wrap';
side.append(status, logEl);
function log(msg: string): void {
  logEl.textContent = `${msg}\n${logEl.textContent ?? ''}`.slice(0, 2000);
}

function syncButtons(): void {
  for (const [t, b] of toolButtons) b.setAttribute('aria-pressed', String(pc.tool === t));
  for (const [b, get] of toggles) b.setAttribute('aria-pressed', String(get()));
  undoBtn.disabled = !pc.canUndo();
  redoBtn.disabled = !pc.canRedo();
  size.value = String(pc.brushSize);
}
syncButtons();

function leftHalfMask(): Uint8Array {
  const img = pc.getImage();
  const m = new Uint8Array(img.width * img.height);
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width / 2; x++) m[y * img.width + x] = 1;
  return m;
}

function demoOverlay(ctx: CanvasRenderingContext2D, view: { scale: number; toScreen(x: number, y: number): [number, number] }): void {
  const img = pc.getImage();
  const [x0, y0] = view.toScreen(0, 0);
  const [x1, y1] = view.toScreen(img.width / 2, img.height / 2);
  ctx.strokeStyle = '#4fb3ff';
  ctx.lineWidth = 2;
  ctx.strokeRect(x0 + 1, y0 + 1, x1 - x0 - 2, y1 - y0 - 2);
  ctx.fillStyle = '#4fb3ff';
  ctx.font = '12px system-ui';
  ctx.fillText('Head', x0 + 6, y0 + 16);
}

// ---- test hooks
interface HarnessApi {
  pc: PixelCanvas;
  events: typeof events;
  getImage(): { width: number; height: number; data: number[] };
  px(x: number, y: number): number[];
  toClient(x: number, y: number): [number, number];
  load(w: number, h: number, fill?: RGBA | null): void;
  loadSample(size: number): void;
}
const api: HarnessApi = {
  pc,
  events,
  getImage() {
    const im = pc.getImage();
    return { width: im.width, height: im.height, data: Array.from(im.data) };
  },
  px(x, y) {
    const im = pc.getImage();
    const i = (y * im.width + x) * 4;
    return Array.from(im.data.slice(i, i + 4));
  },
  toClient(x, y) {
    const r = pc.element.getBoundingClientRect();
    const [sx, sy] = pc.getView().toScreen(x + 0.5, y + 0.5);
    return [r.left + sx, r.top + sy];
  },
  load(w, h, fill = null) {
    const img = createImage(w, h);
    if (fill) for (let i = 0; i < w * h; i++) img.data.set(fill, i * 4);
    pc.setImage(img);
    events.change = 0;
  },
  loadSample(n) {
    pc.setImage(sampleImage(n));
    events.change = 0;
  },
};
(window as unknown as { harness: HarnessApi; getImage: HarnessApi['getImage']; pcReady: boolean }).harness = api;
(window as unknown as { getImage: HarnessApi['getImage'] }).getImage = api.getImage;
requestAnimationFrame(() => requestAnimationFrame(() => { (window as unknown as { pcReady: boolean }).pcReady = true; }));
