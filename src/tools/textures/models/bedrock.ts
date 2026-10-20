// A Java model as Bedrock geometry (format 1.12.0) for add-on makers: one bone, a cube per element,
// centred on the block like Bedrock block geometry (x and z from -8 to 8), in Bedrock's mirrored x, with
// per-face UVs on a 16 x 16 texture (Blockbench's conversion). Bedrock geometry has one texture, so faces
// keep their place on their own texture. Pure.

import { DIRS, defaultFaceUv } from '../../../shared/models/geometry';
import type { EditModel } from './doc';
import { tidy } from './doc';

export function bedrockIdentifier(name: string): string {
  const id = name
    .toLowerCase()
    .replace(/^.*[:/]/, '')
    .replace(/[^a-z0-9_.]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `geometry.${id || 'custom'}`;
}

export function toBedrockGeometry(m: EditModel, name: string): Record<string, unknown> {
  const cubes = m.elements.map((e) => {
    const size = [e.to[0] - e.from[0], e.to[1] - e.from[1], e.to[2] - e.from[2]].map(tidy);
    const cube: Record<string, unknown> = { origin: [tidy(8 - e.to[0]), tidy(e.from[1]), tidy(e.from[2] - 8)], size };
    const r = e.rotation;
    if (r) {
      cube.pivot = [tidy(8 - r.origin[0]), tidy(r.origin[1]), tidy(r.origin[2] - 8)];
      const rot = r.axis ? [r.axis === 'x' ? r.angle ?? 0 : 0, r.axis === 'y' ? r.angle ?? 0 : 0, r.axis === 'z' ? r.angle ?? 0 : 0] : [r.x ?? 0, r.y ?? 0, r.z ?? 0];
      cube.rotation = [tidy(-rot[0]), tidy(-rot[1]), tidy(rot[2])];
    }
    const uv: Record<string, unknown> = {};
    for (const d of DIRS) {
      const f = e.faces[d];
      if (!f) continue;
      const [u1, v1, u2, v2] = f.uv ?? defaultFaceUv(d, e.from, e.to);
      let at = [u1, v1];
      let span = [u2 - u1, v2 - v1];
      // Bedrock reads top and bottom faces the other way round
      if (d === 'up' || d === 'down') {
        at = [u2, v2];
        span = [-span[0], -span[1]];
      }
      uv[d] = { uv: at.map(tidy), uv_size: span.map(tidy) };
    }
    cube.uv = uv;
    return cube;
  });
  return {
    format_version: '1.12.0',
    'minecraft:geometry': [
      {
        description: { identifier: bedrockIdentifier(name), texture_width: 16, texture_height: 16, visible_bounds_width: 2, visible_bounds_height: 2.5, visible_bounds_offset: [0, 0.75, 0] },
        bones: [{ name: 'root', pivot: [0, 0, 0], cubes }],
      },
    ],
  };
}
