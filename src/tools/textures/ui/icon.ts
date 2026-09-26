// The pack icon as the game will show it: the user's icon, or the automatic isometric grass block
// drawn from the pack's own grass textures (effects and biome tint applied, like the exporter).

import { createImageData } from '../../../core/image';
import { DEFAULT_GRASS_TINT, compositeOverlay, tintImage } from '../../../shared/preview/preview-textures';
import { applyEffects } from '../effects';
import { renderIsoCube } from '../export';
import { firstSquare } from './meta';
import { ICON_KEY, type TexStore } from './store';

const cache = new WeakMap<TexStore, { key: string; img: ImageData }>();

const asImage = (x: { width: number; height: number; data: Uint8ClampedArray }): ImageData =>
  x instanceof ImageData ? x : new ImageData(new Uint8ClampedArray(x.data), x.width, x.height);

export async function autoPackIcon(store: TexStore, size = 64): Promise<ImageData> {
  const java = store.project.edition === 'java';
  const root = java ? 'assets/minecraft/textures/' : 'textures/';
  const find = (ids: string[]) => {
    for (const id of ids) for (const ext of ['.png', '.tga']) if (store.byPath.has(root + id + ext)) return root + id + ext;
    return null;
  };
  const top = find(java ? ['block/grass_block_top', 'blocks/grass_top'] : ['blocks/grass_carried', 'blocks/grass_top']);
  const side = find(java ? ['block/grass_block_side', 'blocks/grass_side'] : ['blocks/grass_side_carried']);
  const overlay = java ? find(['block/grass_block_side_overlay', 'blocks/grass_side_overlay']) : null;
  const fx = JSON.stringify(store.project.effects.filter((l) => l.enabled));
  const key = [top, side, overlay].map((p) => (p ? `${p}:${store.stamp(p)}` : '-')).join('|') + fx + size;
  const hit = cache.get(store);
  if (hit && hit.key === key) return hit.img;
  let img: ImageData;
  try {
    if (!top || !side) throw new Error('no grass');
    const layers = store.project.effects;
    const fxOf = (p: string, im: ImageData) => applyEffects(im, layers, { path: p, category: 'block', animated: false });
    let t = fxOf(top, firstSquare(await store.getFull(top)));
    let s = fxOf(side, firstSquare(await store.getFull(side)));
    if (java) {
      t = asImage(tintImage(t, DEFAULT_GRASS_TINT));
      if (overlay) {
        const o = fxOf(overlay, firstSquare(await store.getFull(overlay)));
        if (o.width === s.width) s = asImage(compositeOverlay(s, o, DEFAULT_GRASS_TINT));
      }
    }
    img = renderIsoCube(t, s, size);
  } catch {
    img = createImageData(size, size);
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
