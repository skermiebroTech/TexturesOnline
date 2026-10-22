// The glyph drawing canvas: one character's pixels, big, with the game's guide rows (accent room
// and the second row below the baseline are shaded, the baseline and x-height are lines) and the
// advance marked. Click or drag to draw; starting on an inked pixel erases instead (the pencil),
// the eraser always erases. Keyboard: arrows move a cursor, Space toggles the pixel under it.
// Also the small glyph thumbnails of the character list.

import { h } from '../../ui/dom';
import { CELL_ASCENT, TOP_EXTRA, cellH, cellW, emptyMask, glyphAdvance, inkWidth, unit, type GlyphSize, type Mask } from './font';

export type DrawTool = 'pencil' | 'eraser';

export interface GlyphCanvas {
  el: HTMLCanvasElement;
  /** Shows a glyph (null = empty) at a glyph size */
  show(mask: Mask | null, size: GlyphSize, label: string): void;
  setTool(tool: DrawTool): void;
  destroy(): void;
}

/** CSS pixels per gui pixel of the big canvas (the cell is 8 × 12 gui pixels). */
const GUI_PX = 28;

function cssVar(el: Element, name: string, fallback: string): string {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return v || fallback;
}

export function glyphCanvas(opts: { onStroke(mask: Mask): void }): GlyphCanvas {
  const el = h('canvas', { class: 'fm-canvas', tabIndex: 0, role: 'img' }) as HTMLCanvasElement;
  let size: GlyphSize = 8;
  let mask: Mask = emptyMask(8);
  let tool: DrawTool = 'pencil';
  let painting: { value: 0 | 1; last: [number, number] | null; changed: boolean } | null = null;
  let cursor: [number, number] | null = null;
  const dpr = () => Math.max(1, Math.min(3, Math.round(window.devicePixelRatio || 1)));

  const zoom = () => GUI_PX / unit(size);

  function paint() {
    const w = cellW(size);
    const hh = cellH(size);
    const k = unit(size);
    const z = zoom() * dpr();
    el.width = w * z;
    el.height = hh * z;
    const ctx = el.getContext('2d')!;
    const bg = cssVar(el, '--surface-2', '#222');
    const shade = cssVar(el, '--surface-3', '#333');
    const ink = cssVar(el, '--text', '#fff');
    const line = cssVar(el, '--border', '#444');
    const accent = cssVar(el, '--tool-accent', '#5c5');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, el.width, el.height);
    // rows only Java 1.13+ uses
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, el.width, TOP_EXTRA * k * z);
    ctx.fillRect(0, (TOP_EXTRA + 8) * k * z, el.width, el.height);
    // pixels
    ctx.fillStyle = ink;
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) ctx.fillRect(x * z, y * z, z, z);
    // grid: thin per pixel, stronger per gui pixel
    ctx.fillStyle = line;
    for (let x = 0; x <= w; x++) ctx.fillRect(Math.min(el.width - 1, x * z), 0, x % k === 0 ? 2 : 1, el.height);
    for (let y = 0; y <= hh; y++) ctx.fillRect(0, Math.min(el.height - 1, y * z), el.width, y % k === 0 ? 2 : 1);
    // baseline and x-height
    ctx.fillStyle = accent;
    ctx.fillRect(0, CELL_ASCENT * k * z - 2, el.width, 3);
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0, (TOP_EXTRA + 2) * k * z - 1, el.width, 2);
    ctx.globalAlpha = 1;
    // advance
    const ink0 = inkWidth(mask, w, hh);
    if (ink0) {
      const adv = glyphAdvance(mask, size) * k;
      ctx.fillStyle = accent;
      for (let y = 0; y < el.height; y += 8 * dpr()) ctx.fillRect(Math.min(el.width - 2, adv * z) - 1, y, 3, 4 * dpr());
    }
    if (cursor && document.activeElement === el) {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3 * dpr();
      ctx.strokeRect(cursor[0] * z + 1.5, cursor[1] * z + 1.5, z - 3, z - 3);
    }
    el.style.width = `${(w * zoom())}px`;
    el.style.aspectRatio = `${w} / ${hh}`;
  }

  function cellAt(ev: PointerEvent): [number, number] | null {
    const r = el.getBoundingClientRect();
    const w = cellW(size);
    const hh = cellH(size);
    const x = Math.floor(((ev.clientX - r.left) / r.width) * w);
    const y = Math.floor(((ev.clientY - r.top) / r.height) * hh);
    return x >= 0 && y >= 0 && x < w && y < hh ? [x, y] : null;
  }

  function set(x: number, y: number, v: 0 | 1): boolean {
    const i = y * cellW(size) + x;
    if (mask[i] === v) return false;
    mask[i] = v;
    return true;
  }

  function line(a: [number, number], b: [number, number], v: 0 | 1): boolean {
    let [x0, y0] = a;
    const [x1, y1] = b;
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let changed = false;
    for (;;) {
      changed = set(x0, y0, v) || changed;
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
    return changed;
  }

  el.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    const c = cellAt(ev);
    if (!c) return;
    ev.preventDefault();
    el.focus({ preventScroll: true });
    el.setPointerCapture(ev.pointerId);
    const value: 0 | 1 = tool === 'eraser' ? 0 : mask[c[1] * cellW(size) + c[0]] ? 0 : 1;
    painting = { value, last: c, changed: set(c[0], c[1], value) };
    cursor = c;
    paint();
  });
  el.addEventListener('pointermove', (ev) => {
    if (!painting) return;
    const c = cellAt(ev);
    if (!c) return;
    if (painting.last) painting.changed = line(painting.last, c, painting.value) || painting.changed;
    painting.last = c;
    cursor = c;
    paint();
  });
  const end = () => {
    if (!painting) return;
    const changed = painting.changed;
    painting = null;
    if (changed) opts.onStroke(mask.slice());
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('lostpointercapture', end);
  el.addEventListener('focus', () => {
    cursor ??= [0, TOP_EXTRA * unit(size)];
    paint();
  });
  el.addEventListener('blur', () => paint());
  el.addEventListener('keydown', (ev) => {
    const w = cellW(size);
    const hh = cellH(size);
    cursor ??= [0, TOP_EXTRA * unit(size)];
    const moves: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const m = moves[ev.key];
    if (m) {
      ev.preventDefault();
      cursor = [Math.max(0, Math.min(w - 1, cursor[0] + m[0])), Math.max(0, Math.min(hh - 1, cursor[1] + m[1]))];
      paint();
      return;
    }
    if (ev.key === ' ' || ev.key === 'Enter') {
      ev.preventDefault();
      const [x, y] = cursor;
      const v: 0 | 1 = tool === 'eraser' ? 0 : mask[y * w + x] ? 0 : 1;
      if (set(x, y, v)) {
        paint();
        opts.onStroke(mask.slice());
      }
    }
  });
  const themeObserver = new MutationObserver(() => paint());
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  return {
    el,
    show(m, s, label) {
      size = s;
      mask = m ? m.slice() : emptyMask(s);
      if (cursor && (cursor[0] >= cellW(s) || cursor[1] >= cellH(s))) cursor = null;
      el.setAttribute('aria-label', label);
      paint();
    },
    setTool(t) {
      tool = t;
    },
    destroy() {
      themeObserver.disconnect();
    },
  };
}

/** A small canvas of a glyph for the character list (drawn at one canvas pixel per glyph pixel). */
export function glyphThumb(mask: Mask, size: GlyphSize, canvas?: HTMLCanvasElement): HTMLCanvasElement {
  const w = cellW(size);
  const hh = cellH(size);
  const c = canvas ?? (h('canvas', { class: 'fm-thumb', 'aria-hidden': 'true' }) as HTMLCanvasElement);
  c.width = w;
  c.height = hh;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, hh);
  for (let i = 0; i < w * hh; i++) if (mask[i]) img.data.set([255, 255, 255, 255], i * 4);
  ctx.putImageData(img, 0, 0);
  return c;
}
