// The enchantment glint drawn over an item, frame by frame, for the GUI preview. Pure (no DOM).
//
// The game adds the glint texture over the item's own pixels (blending source colour × source
// colour, plus what is there), scrolled and turned a little. Java 1.15+ scrolls one layer
// diagonally and turned 10°; older versions add two layers turned -50° and 10° that scroll sideways
// at different speeds. Bedrock's glint looks like the newer one.

import { createImageData } from '../../../core/pixels';

export interface GlintOptions {
  /** Milliseconds (animation time) */
  time: number;
  /** Two sideways layers (Java before 1.15) */
  legacy?: boolean;
  /** How much of the glint texture spans the item (1: all of it) */
  span?: number;
  /** Glint strength (Java's accessibility setting, 0.75 by default since 1.19) */
  strength?: number;
}

interface Layer {
  angle: number;
  u: number;
  v: number;
}

/** Scroll offsets of the glint layers at a time (fractions of the texture). */
export function glintLayers(time: number, legacy = false): Layer[] {
  if (legacy) {
    return [
      { angle: (-50 * Math.PI) / 180, u: (time % 3000) / 3000, v: 0 },
      { angle: (10 * Math.PI) / 180, u: -(time % 4873) / 4873, v: 0 },
    ];
  }
  // Java: 8 × glint speed (0.5) × milliseconds, wrapped at 110 000 and 30 000
  const t = time * 4;
  return [{ angle: (10 * Math.PI) / 180, u: -(t % 110000) / 110000, v: (t % 30000) / 30000 }];
}

/**
 * The item with the glint added, `scale` output pixels per item pixel (the glint is finer than the
 * item's pixels, as in the game at a large GUI scale).
 */
export function glintItem(item: ImageData, glint: ImageData | null, scale: number, opts: GlintOptions): ImageData {
  const w = item.width * scale;
  const h = item.height * scale;
  const out = createImageData(w, h);
  const d = out.data;
  const s = item.data;
  const layers = glint ? glintLayers(opts.time, opts.legacy) : [];
  const span = opts.span ?? 0.25;
  const strength = opts.strength ?? (opts.legacy ? 1 : 0.75);
  const gw = glint?.width ?? 1;
  const gh = glint?.height ?? 1;
  const g = glint?.data;
  const trig = layers.map((l) => ({ ...l, cos: Math.cos(l.angle), sin: Math.sin(l.angle) }));
  for (let y = 0; y < h; y++) {
    const iy = (y / scale) | 0;
    const fv = ((y + 0.5) / h) * span;
    for (let x = 0; x < w; x++) {
      const ix = (x / scale) | 0;
      const si = (iy * item.width + ix) * 4;
      const a = s[si + 3];
      const o = (y * w + x) * 4;
      if (!a) continue;
      let r = s[si];
      let gg = s[si + 1];
      let b = s[si + 2];
      if (g) {
        const fu = ((x + 0.5) / w) * span;
        for (const l of trig) {
          // texture matrix: translate, then rotate the item's coordinates
          let u = fu * l.cos - fv * l.sin + l.u;
          let v = fu * l.sin + fv * l.cos + l.v;
          u -= Math.floor(u);
          v -= Math.floor(v);
          const gi = (((v * gh) | 0) * gw + ((u * gw) | 0)) * 4;
          const ga = g[gi + 3] / 255;
          r += ((g[gi] * g[gi]) / 255) * ga * strength;
          gg += ((g[gi + 1] * g[gi + 1]) / 255) * ga * strength;
          b += ((g[gi + 2] * g[gi + 2]) / 255) * ga * strength;
        }
      }
      d[o] = r > 255 ? 255 : r;
      d[o + 1] = gg > 255 ? 255 : gg;
      d[o + 2] = b > 255 ? 255 : b;
      d[o + 3] = a;
    }
  }
  return out;
}
