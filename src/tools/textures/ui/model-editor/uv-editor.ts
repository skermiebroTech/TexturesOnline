// The UV view of the model editor: the face's texture with the area the face shows outlined. Drag the
// area to move it, a corner to resize it, or drag on the texture to draw a new area. Mirrored areas
// (u1 > u2 or v1 > v2) stay mirrored. Values are in the game's UV units (0..16 across the texture).

import { h } from '../../../../ui/dom';
import type { UV4 } from '../../../../shared/models/geometry';
import { tm } from '../i18n/model-editor';

export interface UvEditor {
  el: HTMLElement;
  /** Shows a texture (null: none) and the face's area; `auto`: the area follows the cube (drawn dashed) */
  set(img: ImageData | null, uv: UV4 | null, auto: boolean): void;
  destroy(): void;
}

export interface UvEditorOptions {
  /** A new area while dragging (`final` once the drag ends) */
  onChange(uv: UV4, final: boolean): void;
  /** Grid step in UV units */
  snap(): number;
  label?: string;
}

type Part = 'move' | 'draw' | 0 | 1 | 2 | 3;

export function createUvEditor(opts: UvEditorOptions): UvEditor {
  const canvas = h('canvas', { class: 'me-uv-canvas', tabIndex: 0, role: 'img', 'aria-label': opts.label ?? tm.uvCanvas });
  const el = h('div', { class: 'me-uv checker' }, canvas);
  let img: ImageData | null = null;
  let uv: UV4 | null = null;
  let auto = false;
  let drag: { id: number; part: Part; start: [number, number]; from: UV4 } | null = null;
  const source = document.createElement('canvas');
  const ro = new ResizeObserver(() => draw());
  ro.observe(el);

  const size = () => {
    const w = Math.max(64, Math.floor(el.clientWidth));
    return { w, h: w };
  };

  function draw() {
    const { w, h: hh } = size();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr);
    if (canvas.height !== Math.round(hh * dpr)) canvas.height = Math.round(hh * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${hh}px`;
    const g = canvas.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, hh);
    if (img) {
      g.imageSmoothingEnabled = false;
      g.drawImage(source, 0, 0, w, hh);
    }
    // 16 x 16 grid
    const styles = getComputedStyle(el);
    g.strokeStyle = styles.getPropertyValue('--me-uv-grid').trim() || 'rgba(255,255,255,0.12)';
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 1; i < 16; i++) {
      const x = Math.round((i / 16) * w) + 0.5;
      const y = Math.round((i / 16) * hh) + 0.5;
      g.moveTo(x, 0);
      g.lineTo(x, hh);
      g.moveTo(0, y);
      g.lineTo(w, y);
    }
    g.stroke();
    if (!uv) return;
    const accent = styles.getPropertyValue('--tool-accent').trim() || '#5bd35b';
    const [x0, y0, x1, y1] = rectPx(uv, w, hh);
    g.fillStyle = 'rgba(0,0,0,0)';
    g.save();
    g.globalAlpha = 0.18;
    g.fillStyle = accent;
    g.fillRect(x0, y0, x1 - x0, y1 - y0);
    g.restore();
    g.setLineDash(auto ? [5, 4] : []);
    g.lineWidth = 3;
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0 - 1, y1 - y0 - 1);
    g.lineWidth = 1.5;
    g.strokeStyle = accent;
    g.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0 - 1, y1 - y0 - 1);
    g.setLineDash([]);
    // where u1, v1 is (the face's first corner), and the corner knobs
    for (const [i, [cx, cy]] of corners(uv, w, hh).entries()) {
      g.fillStyle = i === 0 ? accent : '#ffffff';
      g.strokeStyle = 'rgba(0,0,0,0.7)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.rect(cx - 4, cy - 4, 8, 8);
      g.fill();
      g.stroke();
    }
  }

  function rectPx(u: UV4, w: number, hh: number): [number, number, number, number] {
    const a = [Math.min(u[0], u[2]), Math.min(u[1], u[3]), Math.max(u[0], u[2]), Math.max(u[1], u[3])];
    return [(a[0] / 16) * w, (a[1] / 16) * hh, (a[2] / 16) * w, (a[3] / 16) * hh];
  }

  /** Corners in the uv's own order: (u1,v1), (u2,v1), (u2,v2), (u1,v2). */
  function corners(u: UV4, w: number, hh: number): [number, number][] {
    const px = (x: number) => (x / 16) * w;
    const py = (y: number) => (y / 16) * hh;
    return [
      [px(u[0]), py(u[1])],
      [px(u[2]), py(u[1])],
      [px(u[2]), py(u[3])],
      [px(u[0]), py(u[3])],
    ];
  }

  const toUv = (e: PointerEvent): [number, number] => {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / Math.max(1, r.width)) * 16, ((e.clientY - r.top) / Math.max(1, r.height)) * 16];
  };
  const snapTo = (v: number) => {
    const s = opts.snap();
    return s > 0 ? Math.round(v / s) * s : Math.round(v * 1000) / 1000;
  };
  const clamp = (v: number) => Math.max(0, Math.min(16, v));

  canvas.addEventListener('pointerdown', (e) => {
    if (!img || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const p = toUv(e);
    let part: Part = 'draw';
    if (uv) {
      const cs = corners(uv, r.width, r.height);
      const k = cs.findIndex(([cx, cy]) => Math.hypot(cx - (e.clientX - r.left), cy - (e.clientY - r.top)) < 10);
      if (k >= 0) part = k as 0 | 1 | 2 | 3;
      else {
        const [x0, y0, x1, y1] = rectPx(uv, 16, 16);
        if (p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1) part = 'move';
      }
    }
    drag = { id: e.pointerId, part, start: p, from: uv ? [...uv] : [p[0], p[1], p[0], p[1]] };
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* best effort */
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) {
      if (uv && e.pointerType !== 'touch') {
        const r = canvas.getBoundingClientRect();
        const cs = corners(uv, r.width, r.height);
        const near = cs.some(([cx, cy]) => Math.hypot(cx - (e.clientX - r.left), cy - (e.clientY - r.top)) < 10);
        canvas.style.cursor = near ? 'nwse-resize' : 'crosshair';
      }
      return;
    }
    const p = toUv(e);
    const f = drag.from;
    let next: UV4;
    if (drag.part === 'move') {
      const w = f[2] - f[0];
      const hh = f[3] - f[1];
      let nu = snapTo(Math.min(f[0], f[2]) + p[0] - drag.start[0]);
      let nv = snapTo(Math.min(f[1], f[3]) + p[1] - drag.start[1]);
      nu = Math.max(0, Math.min(16 - Math.abs(w), nu));
      nv = Math.max(0, Math.min(16 - Math.abs(hh), nv));
      const u0 = w >= 0 ? nu : nu - w;
      const v0 = hh >= 0 ? nv : nv - hh;
      next = [u0, v0, u0 + w, v0 + hh];
    } else if (drag.part === 'draw') {
      const a = [snapTo(clamp(drag.start[0])), snapTo(clamp(drag.start[1]))];
      const b = [snapTo(clamp(p[0])), snapTo(clamp(p[1]))];
      next = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
    } else {
      const k = drag.part;
      const u = snapTo(clamp(p[0]));
      const v = snapTo(clamp(p[1]));
      next = [...f];
      if (k === 0 || k === 3) next[0] = u;
      else next[2] = u;
      if (k === 0 || k === 1) next[1] = v;
      else next[3] = v;
    }
    uv = next;
    draw();
    opts.onChange(next, false);
  });
  const end = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    if (uv) opts.onChange(uv, true);
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  return {
    el,
    set(next, area, isAuto) {
      if (next !== img) {
        img = next;
        if (img) {
          source.width = img.width;
          source.height = img.height;
          source.getContext('2d')?.putImageData(img, 0, 0);
        }
      }
      if (!drag) uv = area ? [...area] : null;
      auto = isAuto;
      draw();
    },
    destroy() {
      ro.disconnect();
    },
  };
}
