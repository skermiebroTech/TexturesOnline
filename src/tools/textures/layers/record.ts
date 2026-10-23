// Paint layers as the project stores them (project.layers: each layer's pixels as a PNG) and back.
// Project files carry the record as it is (its Blobs become PNG files in the archive). No DOM.

import type { TextureLayer, TextureLayers } from '../../../core/types';
import { LAYER_BLENDS, type LayerBlend, type LayerStack, type PaintLayer } from './stack';

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

/** The record of a stack; `encode` turns a layer's pixels into a PNG (and may reuse one it made before). */
export function recordOf(s: LayerStack, encode: (img: ImageData) => Blob): TextureLayers {
  return {
    layers: s.layers.map((l) => {
      const r: TextureLayer = { id: l.id, name: l.name, image: encode(l.image) };
      if (l.hidden) r.hidden = true;
      if (l.locked) r.locked = true;
      if (l.opacity < 1) r.opacity = Math.round(l.opacity * 1000) / 1000;
      if (l.blend !== 'normal') r.blend = l.blend;
      return r;
    }),
    active: s.active,
    updatedAt: Date.now(),
  };
}

/**
 * The stack of a record. Null when it can't be used: no layers, an image that doesn't decode or
 * layers of different sizes.
 */
export async function stackOf(r: TextureLayers, decode: (png: Blob) => Promise<ImageData>): Promise<LayerStack | null> {
  if (!r.layers.length) return null;
  const layers: PaintLayer[] = [];
  for (const l of r.layers) {
    let image: ImageData;
    try {
      image = await decode(l.image);
    } catch {
      return null;
    }
    if (layers.length && (image.width !== layers[0].image.width || image.height !== layers[0].image.height)) return null;
    layers.push({
      id: l.id,
      name: l.name,
      image,
      hidden: !!l.hidden,
      locked: !!l.locked,
      opacity: typeof l.opacity === 'number' ? Math.max(0, Math.min(1, l.opacity)) : 1,
      blend: l.blend ?? 'normal',
    });
  }
  return { layers, active: Math.max(0, Math.min(layers.length - 1, r.active)) };
}

/** A stored record checked (project files, older or damaged records): the layers that can be read. */
export function checkLayers(x: unknown): TextureLayers | null {
  if (!isObj(x) || !Array.isArray(x.layers)) return null;
  const layers: TextureLayer[] = [];
  for (const l of x.layers as unknown[]) {
    if (!isObj(l) || !(l.image instanceof Blob)) return null;
    const r: TextureLayer = { id: typeof l.id === 'string' && l.id ? l.id : `l${layers.length}`, name: typeof l.name === 'string' ? l.name.slice(0, 80) : '', image: l.image };
    if (l.hidden === true) r.hidden = true;
    if (l.locked === true) r.locked = true;
    if (typeof l.opacity === 'number' && Number.isFinite(l.opacity) && l.opacity < 1) r.opacity = Math.max(0, l.opacity);
    if (LAYER_BLENDS.includes(l.blend as LayerBlend) && l.blend !== 'normal') r.blend = l.blend as LayerBlend;
    layers.push(r);
  }
  if (!layers.length) return null;
  const active = typeof x.active === 'number' && Number.isInteger(x.active) ? Math.max(0, Math.min(layers.length - 1, x.active)) : layers.length - 1;
  return { layers, active, updatedAt: typeof x.updatedAt === 'number' ? x.updatedAt : 0 };
}

/** Every record of project.layers that can be read (by texture path). */
export function checkLayerRecords(x: unknown): Record<string, TextureLayers> | undefined {
  if (!isObj(x)) return undefined;
  const out: Record<string, TextureLayers> = {};
  for (const [path, r] of Object.entries(x)) {
    const ok = checkLayers(r);
    if (ok) out[path] = ok;
  }
  return Object.keys(out).length ? out : undefined;
}
