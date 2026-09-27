// Flat item sprites extruded the way the game builds generated item models (ItemModelGenerator): a
// front and back face per layer plus one-pixel-deep edge strips wherever an opaque pixel meets a
// transparent one. Pure; images are straight RGBA.

import type { BakedQuad, Tint } from './geometry';
import { bakeModel, type JavaElement, type ResolvedModel } from './java-models';

export interface SpriteImageLayer {
  path: string;
  role: string;
  tint: Tint | null;
  image: { width: number; height: number; data: Uint8ClampedArray | Uint8Array };
}

type SpanFacing = 'up' | 'down' | 'left' | 'right';
const OFFSET: Record<SpanFacing, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

interface Span {
  facing: SpanFacing;
  min: number;
  max: number;
  anchor: number;
}

/** Edge spans of one frame, exactly as the game groups them (per row / column anchor). */
function spans(img: SpriteImageLayer['image'], w: number, h: number): Span[] {
  const transparent = (x: number, y: number) => x < 0 || y < 0 || x >= w || y >= h || img.data[(y * img.width + x) * 4 + 3] === 0;
  const out: Span[] = [];
  const index = new Map<string, Span>();
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (transparent(x, y)) continue;
      for (const facing of ['up', 'down', 'left', 'right'] as SpanFacing[]) {
        const [dx, dy] = OFFSET[facing];
        if (!transparent(x + dx, y + dy)) continue;
        const rows = facing === 'up' || facing === 'down';
        const anchor = rows ? y : x;
        const k = rows ? x : y;
        const key = `${facing}:${anchor}`;
        const s = index.get(key);
        if (s) {
          s.min = Math.min(s.min, k);
          s.max = Math.max(s.max, k);
        } else {
          const n: Span = { facing, min: k, max: k, anchor };
          index.set(key, n);
          out.push(n);
        }
      }
    }
  return out;
}

function layerElements(texture: string, img: SpriteImageLayer['image']): JavaElement[] {
  const w = img.width;
  const h = Math.min(img.height, img.width) || img.height; // first frame of a strip
  const els: JavaElement[] = [
    {
      from: [0, 0, 7.5],
      to: [16, 16, 8.5],
      faces: { south: { texture, uv: [0, 0, 16, 16], tintindex: 0 }, north: { texture, uv: [16, 0, 0, 16], tintindex: 0 } },
    },
  ];
  const sx = 16 / w;
  const sy = 16 / h;
  for (const sp of spans(img, w, h)) {
    const face = (dir: 'up' | 'down' | 'west' | 'east', uv: [number, number, number, number]) => ({ [dir]: { texture, uv, tintindex: 0 } });
    if (sp.facing === 'up' || sp.facing === 'down') {
      // a row of pixels whose top (or bottom) neighbour is transparent: a strip across the thickness
      const y = 16 - (sp.facing === 'up' ? sp.anchor : sp.anchor + 1) * sy;
      const uv: [number, number, number, number] = [sp.min * sx, sp.anchor * sy, (sp.max + 1) * sx, (sp.anchor + 1) * sy];
      els.push({ from: [sp.min * sx, y, 7.5], to: [(sp.max + 1) * sx, y, 8.5], faces: face(sp.facing, uv) });
    } else {
      const x = (sp.facing === 'left' ? sp.anchor : sp.anchor + 1) * sx;
      const uv: [number, number, number, number] = [sp.anchor * sx, sp.min * sy, (sp.anchor + 1) * sx, (sp.max + 1) * sy];
      els.push({ from: [x, 16 - (sp.max + 1) * sy, 7.5], to: [x, 16 - sp.min * sy, 8.5], faces: face(sp.facing === 'left' ? 'west' : 'east', uv) });
    }
  }
  return els;
}

/** Quads of an extruded item sprite (front faces south, +z), layers stacked in order. */
export function extrudeSprite(layers: SpriteImageLayer[]): BakedQuad[] {
  const out: BakedQuad[] = [];
  layers.forEach((layer, i) => {
    if (!layer.image.width || !layer.image.height) return;
    const model: ResolvedModel = {
      id: `sprite:${layer.path}`,
      chain: [],
      textures: { [layer.role]: layer.path },
      translucent: [],
      elements: layerElements(`#${layer.role}`, layer.image),
      builtin: null,
      ambientOcclusion: false,
      missing: [],
    };
    // Later layers sit a hair in front so they never z-fight the layer below.
    const lift = i * 0.0005;
    for (const q of bakeModel(model, { part: i, texturePath: (ref) => ref, tint: () => layer.tint })) {
      q.tintindex = layer.tint ? 0 : -1;
      if (lift) {
        const dz = q.normal[2] * lift;
        q.positions = q.positions.map((p) => [p[0], p[1], p[2] + dz]) as BakedQuad['positions'];
      }
      out.push(q);
    }
  });
  return out;
}
