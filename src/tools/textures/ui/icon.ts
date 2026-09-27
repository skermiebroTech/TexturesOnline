// The pack icon as the game will show it: the user's icon, or the automatic isometric grass block
// drawn from the pack's own grass textures with effects and the (effect-processed) grass colour,
// the same way the exporter builds pack.png / pack_icon.png.

import { createImageData } from '../../../core/image';
import { applyEffects } from '../effects';
import { renderIsoCube } from '../export';
import { ICON_KEY, type TexStore } from './store';

const cache = new WeakMap<TexStore, { key: string; img: ImageData }>();

const SOURCES = {
  java: {
    top: ['block/grass_block_top', 'blocks/grass_top'],
    side: ['block/grass_block_side', 'blocks/grass_side'],
    fallback: ['block/stone', 'blocks/stone'],
    grassMap: 'assets/minecraft/textures/colormap/grass.png',
  },
  bedrock: {
    top: ['blocks/grass_carried', 'blocks/grass_top'],
    side: ['blocks/grass_side_carried', 'blocks/grass_side'],
    fallback: ['blocks/stone'],
    grassMap: 'textures/colormap/grass.png',
  },
};

/** Grey art gets the biome tint in game: decide before effects recolour it (as the exporter does). */
function isGrayscale(img: ImageData): boolean {
  const d = img.data;
  let sat = 0;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    const max = Math.max(d[i], d[i + 1], d[i + 2]);
    const min = Math.min(d[i], d[i + 1], d[i + 2]);
    sat += max ? (max - min) / max : 0;
    n++;
  }
  return n > 0 && sat / n <= 0.12;
}

function firstFrame(img: ImageData, opaque: boolean): ImageData {
  const h = Math.min(img.height, img.width);
  const out = createImageData(img.width, h, new Uint8ClampedArray(img.data.subarray(0, img.width * h * 4)));
  if (opaque) for (let i = 3; i < out.data.length; i += 4) out.data[i] = 255;
  return out;
}

function multiply(img: ImageData, tint: ArrayLike<number>): ImageData {
  const out = createImageData(img.width, img.height, new Uint8ClampedArray(img.data));
  for (let i = 0; i < out.data.length; i += 4) {
    out.data[i] = (out.data[i] * tint[0]) / 255;
    out.data[i + 1] = (out.data[i + 1] * tint[1]) / 255;
    out.data[i + 2] = (out.data[i + 2] * tint[2]) / 255;
  }
  return out;
}

export async function autoPackIcon(store: TexStore, size = 64): Promise<ImageData> {
  const edition = store.project.edition;
  const src = SOURCES[edition];
  const root = edition === 'java' ? 'assets/minecraft/textures/' : 'textures/';
  const find = (ids: string[]) => {
    for (const id of ids) for (const ext of ['.png', '.tga']) if (store.byPath.has(root + id + ext)) return root + id + ext;
    return null;
  };
  const top = find(src.top);
  const side = find(src.side);
  const stone = find(src.fallback);
  const layers = store.project.effects;
  const fx = JSON.stringify(layers.filter((l) => l.enabled));
  const key = [top, side, stone].map((p) => (p ? `${p}:${store.stamp(p)}` : '-')).join('|') + fx + size;
  const hit = cache.get(store);
  if (hit && hit.key === key) return hit.img;
  const load = async (path: string | null) => {
    if (!path) return null;
    try {
      const raw = await store.getFull(path);
      const gray = isGrayscale(raw);
      const shown = applyEffects(raw, layers, { path, category: 'block', animated: raw.height > raw.width });
      return { img: firstFrame(shown, /\.tga$/i.test(path)), gray };
    } catch {
      return null;
    }
  };
  let img: ImageData;
  const t = await load(top);
  const s = await load(side);
  if (t && s) {
    const grass = applyEffects(createImageData(1, 1, new Uint8ClampedArray([124, 189, 107, 255])), layers, { path: src.grassMap, category: 'colormap' }).data;
    img = renderIsoCube(t.gray ? multiply(t.img, grass) : t.img, s.img, size);
  } else {
    const st = await load(stone);
    img = st ? renderIsoCube(st.img, st.img, size) : createImageData(size, size);
  }
  cache.set(store, { key, img });
  return img;
}

/** The icon to show: the pack's own, else the automatic one. */
export async function packIconImage(store: TexStore): Promise<{ img: ImageData; auto: boolean }> {
  try {
    return { img: await store.getFull(ICON_KEY), auto: false };
  } catch {
    return { img: await autoPackIcon(store), auto: true };
  }
}
