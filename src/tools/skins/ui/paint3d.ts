// Painting on the 3D model: the View / Paint switch, camera view buttons, the hint line over the
// stage and the paint controls under it (layer, tools, colour, brush), plus the stroke logic that
// turns rays on the model into pixel-canvas strokes. Every 3D stroke is one undo step in the same
// history as the 2D template, and both views show each other's hover.

import type { SkinModel } from '../../../core/types';
import { brushOffsets, brushOriginAt, floodRegion, type BrushShape } from '../../../shared/pixel-algorithms';
import type { PixelCanvas, RGBA, StrokeTool, Tool } from '../../../shared/pixel-canvas';
import { toHex } from '../../../ui/color';
import { iconButton, segmented, tooltip } from '../../../ui/components';
import { h } from '../../../ui/dom';
import type { IconName } from '../../../ui/icons';
import { toast } from '../../../ui/toast';
import type { SkinHit, SkinOverlay, SkinPaintCursor, SkinPaintHandler, SkinPreview, SkinView } from '../skin-preview';
import { mirrorFootprint, strokeSteps, surfaceFootprint } from '../surface';
import { FACE_LABELS, mirrorPixel, PART_INFO, partAt, type LayerSelection } from '../templates';

export interface Paint3dHost {
  pc: PixelCanvas;
  model(): SkinModel;
  layers(): LayerSelection;
  setLayers(v: LayerSelection): void;
  mirror(): boolean;
  setMirror(v: boolean): void;
  /** The paint mask (1 = editable), 64 x 64 */
  mask(): Uint8Array;
  /** Why a pixel can't be painted, or null when it can */
  lockReason(x: number, y: number): string | null;
  /** Pixels changed during a stroke: bring the 3D texture and the previews up to date */
  live(): void;
  /** The pixel hovered on the model changed (null = none), with the pixels a click would paint */
  hover(hit: SkinHit | null, pixels: readonly number[], echo: readonly number[]): void;
  /** Opens the colour picker from `anchor` (a second click closes it) */
  openColor(anchor: HTMLElement): void;
  /** Before a camera view button turns the model (auto-rotation stops) */
  beforeView(): void;
  /** Paint mode was switched on or off */
  modeChanged(on: boolean): void;
}

export interface Paint3d {
  /** View / Paint switch, over the stage */
  modeSwitch: HTMLElement;
  /** Front / back / side / top camera buttons, over the stage */
  views: HTMLElement;
  /** What is under the pointer, or how to paint, over the stage */
  hint: HTMLElement;
  /** Layer, tools, colour and brush rows shown under the stage while painting */
  controls: HTMLElement;
  attach(preview: SkinPreview): void;
  enabled(): boolean;
  setEnabled(on: boolean): void;
  /** Tool, colour, brush, layer, mirror or arm model changed elsewhere */
  sync(): void;
  /** Outline a pixel hovered on the 2D template on the model (null clears) */
  showTemplateHover(p: { x: number; y: number } | null): void;
}

const STROKE_TOOLS = new Set<Tool>(['pencil', 'eraser', 'lighten', 'darken', 'noise']);

const TOOLS_3D: { tool: Tool; icon: IconName; label: string }[] = [
  { tool: 'pencil', icon: 'pencil', label: 'Pencil (B)' },
  { tool: 'eraser', icon: 'eraser', label: 'Eraser (E)' },
  { tool: 'fill', icon: 'fill', label: 'Fill a face (G)' },
  { tool: 'picker', icon: 'pipette', label: 'Pick a colour (I)' },
];

const VIEWS: { view: SkinView; key: string; label: string }[] = [
  { view: 'front', key: 'F', label: 'Front view' },
  { view: 'back', key: 'B', label: 'Back view' },
  { view: 'left', key: 'L', label: 'Left side view' },
  { view: 'right', key: 'R', label: 'Right side view' },
  { view: 'top', key: 'T', label: 'Top view' },
];

const toPoints = (pixels: readonly number[]): [number, number][] => pixels.map((p) => [p % 64, Math.floor(p / 64)]);

function coarsePointer(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}

/** Fill colour of the brush preview on the model. */
function previewFill(tool: Tool, c: RGBA): string | null {
  switch (tool) {
    case 'eraser':
      return 'rgba(255, 255, 255, 0.35)';
    case 'lighten':
      return 'rgba(255, 255, 255, 0.25)';
    case 'darken':
      return 'rgba(0, 0, 0, 0.35)';
    case 'picker':
      return null;
    default:
      return c[3] === 0 ? 'rgba(255, 255, 255, 0.35)' : `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${((c[3] / 255) * 0.7).toFixed(3)})`;
  }
}

export function createPaint3d(host: Paint3dHost): Paint3d {
  const pc = host.pc;
  let preview: SkinPreview | null = null;
  let on = false;
  let mode: 'stroke' | 'pick' | 'fill' | null = null;
  let last: SkinHit | null = null;
  let hoverHit: SkinHit | null = null;
  let templateHover: { x: number; y: number } | null = null;
  /** What the last hover showed, so pointer moves within the same footprint change nothing */
  let hoverKey = '';
  let toolWarned = false;

  // ---- UI ----

  const modeSwitch = segmented<'view' | 'paint'>({
    value: 'view',
    size: 'sm',
    label: '3D mode',
    options: [
      { value: 'view', label: 'View', icon: 'hand' },
      { value: 'paint', label: 'Paint', icon: 'brush' },
    ],
    onChange: (v) => setEnabled(v === 'paint'),
  });
  modeSwitch.classList.add('sk-3d-mode');
  const viewItem = modeSwitch.querySelector<HTMLElement>('[data-value="view"]');
  const paintItem = modeSwitch.querySelector<HTMLElement>('[data-value="paint"]');
  if (viewItem) tooltip(viewItem, 'Turn and zoom the model (D)');
  if (paintItem) tooltip(paintItem, 'Paint on the model (D)');

  const views = h('div', { class: 'sk-3d-views', role: 'group', 'aria-label': 'Camera views' });
  for (const v of VIEWS) {
    const b = h('button', { type: 'button', class: 'sk-view-btn', dataset: { view: v.view }, 'aria-label': v.label }, v.key);
    tooltip(b, v.label);
    b.addEventListener('click', () => {
      host.beforeView();
      preview?.setView(v.view);
    });
    views.appendChild(b);
  }

  const hintDot = h('span', { class: 'sk-3d-hint-dot', 'aria-hidden': 'true' });
  const hintText = h('span', { class: 'sk-3d-hint-text' });
  const hint = h('div', { class: 'sk-3d-hint' }, hintDot, hintText);

  const layerSeg = segmented<LayerSelection>({
    value: host.layers(),
    size: 'sm',
    label: 'Layer to paint on',
    options: [
      { value: 'base', label: 'Base' },
      { value: 'outer', label: 'Outer' },
      { value: 'both', label: 'Both' },
    ],
    onChange: (v) => host.setLayers(v),
  });
  tooltip(layerSeg, 'Which layer to paint on (1 / 2 / 3)');

  const well = h('button', { type: 'button', class: 'sk-well sk-3d-well', 'aria-label': 'Paint colour', 'aria-haspopup': 'dialog' }, h('span', { class: 'sk-well-fill' }));
  tooltip(well, 'Paint colour');
  well.addEventListener('click', () => host.openColor(well));
  const toolButtons = new Map<Tool, ReturnType<typeof iconButton>>();
  const toolRow = h('div', { class: 'sk-3d-tools', role: 'toolbar', 'aria-label': 'Tools for painting on the model' }, well);
  for (const t of TOOLS_3D) {
    const b = iconButton(t.icon, t.label, () => pc.setTool(t.tool), { size: 'sm', active: false });
    b.dataset.tool = t.tool;
    toolButtons.set(t.tool, b);
    toolRow.appendChild(b);
  }
  const mirrorBtn = iconButton('mirror', 'Mirror: paint both arms or legs at once (Y)', () => host.setMirror(!host.mirror()), { size: 'sm', active: host.mirror() });
  mirrorBtn.classList.add('sk-3d-mirror');
  toolRow.append(h('span', { class: 'toolbar-sep', 'aria-hidden': 'true' }), mirrorBtn);

  const sizeValue = h('output', { class: 'sk-3d-size-value', 'aria-live': 'polite' }, '1 px');
  const smaller = iconButton('minus', 'Smaller brush ([)', () => pc.setBrushSize(pc.brushSize - 1), { size: 'sm' });
  const bigger = iconButton('plus', 'Bigger brush (])', () => pc.setBrushSize(pc.brushSize + 1), { size: 'sm' });
  const sizeRow = h('div', { class: 'sk-3d-size', role: 'group', 'aria-label': 'Brush size' }, smaller, sizeValue, bigger);

  const row = (label: string, control: HTMLElement) => h('div', { class: 'sk-ctl' }, h('span', { class: 'sk-ctl-label' }, label), control);
  const controls = h('div', { class: 'sk-3d-paint' }, row('Layer', layerSeg), row('Tool', toolRow), row('Brush', sizeRow));

  // ---- hints ----

  const idleHint = () => (coarsePointer() ? 'One finger paints · two fingers turn' : 'Drag to paint · right-drag to turn');

  function setHint(hit: SkinHit | null, reason: string | null): void {
    hint.classList.toggle('is-locked', !!reason);
    hint.classList.toggle('is-idle', !hit);
    if (!hit) {
      hintDot.style.background = '';
      hintText.textContent = idleHint();
      return;
    }
    const info = PART_INFO[hit.part];
    hintDot.style.background = info.color;
    const name = hit.layer === 'outer' ? info.outerLabel : info.label;
    hintText.textContent = reason ? reason : `${name} · ${FACE_LABELS[hit.face]} · ${hit.x}, ${hit.y}`;
  }

  // ---- painting ----

  const brush = (): { size: number; shape: BrushShape } => ({ size: pc.brushSize, shape: pc.brushShape });

  function stamp(fx: number, fy: number): void {
    const { size, shape } = brush();
    const pixels = surfaceFootprint(fx, fy, size, shape, host.model());
    if (pixels.length) pc.setPixels(toPoints(pixels));
  }

  /** The same-colour area around a pixel within its face (respecting the paint mask). */
  function faceRegion(x: number, y: number, img: ImageData): number[] {
    const r = partAt(x, y, host.model());
    if (!r) return [];
    const region = floodRegion(img, x, y, { tolerance: pc.fillTolerance, mask: host.mask(), bounds: r });
    if (!region) return [];
    const out: number[] = [];
    for (let yy = r.y; yy < r.y + r.h; yy++) for (let xx = r.x; xx < r.x + r.w; xx++) if (region[yy * 64 + xx]) out.push(yy * 64 + xx);
    return out;
  }

  /** The fill regions a click at (x, y) covers: its face, and the mirrored face with Mirror on. */
  function fillRegions(x: number, y: number): { main: number[]; echo: number[] } {
    const img = pc.getImage();
    const main = faceRegion(x, y, img);
    let echo: number[] = [];
    if (host.mirror()) {
      const m = mirrorPixel(x, y, host.model());
      if (m && (m[0] !== x || m[1] !== y)) echo = faceRegion(m[0], m[1], img).filter((p) => !main.includes(p));
    }
    return { main, echo };
  }

  function fillAt(hit: SkinHit): void {
    const { main, echo } = fillRegions(hit.x, hit.y);
    if (!main.length && !echo.length) return;
    if (pc.getSelection()) pc.deselect();
    const color = pc.color;
    pc.beginStroke();
    pc.setPixels(toPoints(main), color, { mirror: false });
    if (echo.length) pc.setPixels(toPoints(echo), color, { mirror: false });
    pc.endStroke();
  }

  function pick(hit: SkinHit | undefined): void {
    if (hit) pc.setColor(pc.getPixel(hit.x, hit.y));
  }

  /** The stroke tool for a press (the pen's eraser end erases). */
  function strokeTool(e: PointerEvent): StrokeTool {
    const tool: Tool = e.button === 5 ? 'eraser' : pc.tool;
    if (STROKE_TOOLS.has(tool)) return tool as StrokeTool;
    // Lines, shapes and selections only make sense on the flat template.
    pc.setTool('pencil');
    if (!toolWarned) {
      toolWarned = true;
      toast('Shapes and selections work on the template. On the model you paint with the pencil.', { duration: 4000 });
    }
    return 'pencil';
  }

  const handler: SkinPaintHandler = {
    layers: () => host.layers(),
    alphaAt: (x, y) => pc.getPixel(x, y)[3],
    begin(hit, e) {
      const tool: Tool = e.button === 5 ? 'eraser' : pc.tool;
      if (tool === 'picker') {
        mode = 'pick';
        pick(hit);
        return true;
      }
      if (tool === 'fill') {
        mode = 'fill';
        fillAt(hit);
        return true;
      }
      if (pc.getSelection()) pc.deselect();
      pc.beginStroke({ tool: strokeTool(e) });
      mode = 'stroke';
      last = hit;
      stamp(hit.fx, hit.fy);
      host.live();
      return true;
    },
    extend(hits) {
      if (mode === 'pick') {
        pick(hits[hits.length - 1]);
        return;
      }
      if (mode !== 'stroke' || !pc.stroking) return;
      for (const hit of hits) {
        // On one face, fill the gap between samples; across an edge the walked rays already did.
        if (last && last.part === hit.part && last.face === hit.face && last.layer === hit.layer) {
          for (const [fx, fy] of strokeSteps(last, hit)) stamp(fx, fy);
        } else {
          stamp(hit.fx, hit.fy);
        }
        last = hit;
      }
      host.live();
    },
    end(commit) {
      if (mode === 'stroke') {
        if (commit) pc.endStroke();
        else {
          pc.cancelStroke();
          host.live();
        }
      }
      mode = null;
      last = null;
    },
    hover(hit) {
      hoverHit = hit;
      return applyHover();
    },
    undo() {
      pc.undo();
    },
  };

  /** Outlines what a click would paint at the hovered point, on the model and on the template. */
  function applyHover(): SkinPaintCursor {
    const hit = hoverHit;
    if (!hit) {
      if (hoverKey === '') return 'paint';
      hoverKey = '';
      host.hover(null, [], []);
      setHint(null, null);
      if (templateHover) showTemplateHover(templateHover);
      else preview?.setOverlay(null);
      return 'paint';
    }
    const model = host.model();
    const tool: Tool = mode === 'pick' ? 'picker' : pc.tool;
    const reason = tool === 'picker' ? null : host.lockReason(hit.x, hit.y);
    const at = hit.y * 64 + hit.x;
    let pixels: number[];
    let echo: number[] = [];
    let cursor: SkinPaintCursor = 'paint';
    if (tool === 'picker') {
      pixels = [at];
      cursor = 'pick';
    } else if (tool === 'fill') {
      const regions = reason ? { main: [at], echo: [] } : fillRegions(hit.x, hit.y);
      pixels = regions.main.length ? regions.main : [at];
      echo = regions.echo;
    } else {
      const { size, shape } = brush();
      pixels = surfaceFootprint(hit.fx, hit.fy, size, shape, model);
      if (host.mirror()) echo = mirrorFootprint(pixels, model).filter((p) => !pixels.includes(p));
    }
    const overlay: SkinOverlay = reason
      ? { pixels: [at], fill: null, tone: 'locked' }
      : { pixels, echo, fill: previewFill(tool === 'fill' ? 'pencil' : tool, pc.color) };
    const key = `${at}|${reason ?? ''}|${overlay.fill ?? ''}|${overlay.pixels.join(',')}|${(overlay.echo ?? []).join(',')}`;
    if (key !== hoverKey) {
      hoverKey = key;
      preview?.setOverlay(overlay);
      host.hover(hit, overlay.pixels, overlay.echo ?? []);
      setHint(hit, reason);
    }
    return reason ? 'locked' : cursor;
  }

  function showTemplateHover(p: { x: number; y: number } | null): void {
    templateHover = p;
    if (!preview || hoverHit) return;
    const model = host.model();
    if (!p || !partAt(p.x, p.y, model)) {
      preview.setOverlay(null);
      return;
    }
    const tool = pc.tool;
    let pixels: number[] = [p.y * 64 + p.x];
    if (tool !== 'picker' && tool !== 'fill' && tool !== 'select' && tool !== 'move') {
      // The 2D brush footprint, as the pencil lays it out on the template.
      const { size, shape } = brush();
      const [ox, oy] = brushOriginAt(p.x, p.y, size);
      pixels = [];
      for (const [dx, dy] of brushOffsets(size, shape)) {
        const x = ox + dx;
        const y = oy + dy;
        if (x >= 0 && y >= 0 && x < 64 && y < 64 && partAt(x, y, model)) pixels.push(y * 64 + x);
      }
    }
    const echo = host.mirror() && tool !== 'picker' ? mirrorFootprint(pixels, model).filter((q) => !pixels.includes(q)) : [];
    preview.setOverlay({ pixels, echo, fill: tool === 'fill' ? null : previewFill(tool, pc.color) });
  }

  // ---- state ----

  function sync(): void {
    const tool = pc.tool;
    toolButtons.forEach((b, t) => b.setActive(t === tool));
    const c = pc.color;
    (well.firstElementChild as HTMLElement).style.background = `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${c[3] / 255})`;
    well.setAttribute('aria-label', `Paint colour ${toHex(c, c[3] < 255)}`);
    layerSeg.setValue(host.layers());
    mirrorBtn.setActive(host.mirror());
    sizeValue.textContent = `${pc.brushSize} px`;
    smaller.disabled = pc.brushSize <= 1;
    bigger.disabled = pc.brushSize >= 8;
    if (!preview) return;
    if (on) {
      preview.setPaintLayers(host.layers());
      if (hoverHit && !mode) applyHover();
    } else if (templateHover) {
      showTemplateHover(templateHover);
    }
  }

  function setEnabled(v: boolean): void {
    if (v === on) return;
    on = v;
    modeSwitch.setValue(on ? 'paint' : 'view');
    if (!on) {
      hoverHit = null;
      hoverKey = '';
      host.hover(null, [], []);
    }
    setHint(null, null);
    if (preview) {
      preview.setPaintLayers(host.layers());
      preview.setPaintMode(on ? handler : null);
    }
    host.modeChanged(on);
    sync();
  }

  setHint(null, null);
  sync();

  return {
    modeSwitch,
    views,
    hint,
    controls,
    attach(p) {
      preview = p;
      p.setPaintLayers(host.layers());
      if (on) p.setPaintMode(handler);
    },
    enabled: () => on,
    setEnabled,
    sync,
    showTemplateHover,
  };
}

/** Pixels (y * 64 + x) as an outline on the 2D template: dark halo, light line, in screen space. */
export function drawPixelOutline(
  ctx: CanvasRenderingContext2D,
  view: { scale: number; toScreen(x: number, y: number): [number, number] },
  pixels: readonly number[],
  alpha = 1,
): void {
  if (!pixels.length) return;
  const set = new Set(pixels);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  for (const p of set) {
    const x = p % 64;
    const y = Math.floor(p / 64);
    const edge = (x0: number, y0: number, x1: number, y1: number) => {
      const [ax, ay] = view.toScreen(x0, y0);
      const [bx, by] = view.toScreen(x1, y1);
      ctx.moveTo(Math.round(ax) + 0.5, Math.round(ay) + 0.5);
      ctx.lineTo(Math.round(bx) + 0.5, Math.round(by) + 0.5);
    };
    if (!set.has(p - 64) || y === 0) edge(x, y, x + 1, y);
    if (!set.has(p + 64) || y === 63) edge(x, y + 1, x + 1, y + 1);
    if (!set.has(p - 1) || x === 0) edge(x, y, x, y + 1);
    if (!set.has(p + 1) || x === 63) edge(x + 1, y, x + 1, y + 1);
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
