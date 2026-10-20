// Isometric block pictures (pack icons, start-screen art). Kept apart from export.ts so start screens
// can draw them without loading the exporter.

import { createImageData } from '../../core/pixels';

/** Nearest-sampled isometric cube: top face full light, left 80%, right 62%. */
export function renderIsoCube(top: ImageData, side: ImageData, size: number): ImageData {
  const out = createImageData(size, size);
  const d = out.data;
  const margin = Math.max(1, Math.round(size * 0.04));
  const hw = (size - 2 * margin) / (2 * 1.1547); // half width; total height = 2.3094 * hw
  const hh = hw * 0.57735;
  const v = hw * 1.1547;
  const cx = size / 2;
  const y0 = (size - (2 * hh + v)) / 2;
  const sample = (img: ImageData, s: number, t: number, shade: number, o: number) => {
    const x = Math.min(img.width - 1, Math.max(0, Math.floor(s * img.width)));
    const y = Math.min(img.height - 1, Math.max(0, Math.floor(t * img.height)));
    const i = (y * img.width + x) * 4;
    const a = img.data[i + 3];
    if (!a) return;
    d[o] = img.data[i] * shade;
    d[o + 1] = img.data[i + 1] * shade;
    d[o + 2] = img.data[i + 2] * shade;
    d[o + 3] = a;
  };
  const inside = (x: number) => x >= 0 && x < 1;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = px + 0.5;
      const y = py + 0.5;
      const o = (py * size + px) * 4;
      // top face: T0 (cx, y0) + u*(hw, hh) + w*(-hw, hh)
      const dx = x - cx;
      const dy = y - y0;
      const u = (dx / hw + dy / hh) / 2;
      const w = (dy / hh - dx / hw) / 2;
      if (inside(u) && inside(w)) {
        sample(top, u, w, 1, o);
        continue;
      }
      const ly = y - (y0 + hh);
      if (x < cx) {
        // left face from (cx - hw, y0 + hh) towards (cx, y0 + 2hh), down by v
        const s = (x - (cx - hw)) / hw;
        const t = (ly - s * hh) / v;
        if (inside(s) && inside(t)) sample(side, s, t, 0.8, o);
      } else {
        // right face from (cx, y0 + 2hh) towards (cx + hw, y0 + hh), down by v
        const s = (x - cx) / hw;
        const t = (ly - hh + s * hh) / v;
        if (inside(s) && inside(t)) sample(side, s, t, 0.62, o);
      }
    }
  }
  return out;
}
