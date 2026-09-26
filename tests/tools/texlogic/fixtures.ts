/** Synthetic game files and helpers shared by the texlogic unit tests (no Mojang assets). */
import { unzipSync } from 'fflate';
import { createImageData, decodeImage, encodePng, encodeTga } from '../../../src/core/image';
import type { AssetIndex, Edition, TextureInfo } from '../../../src/core/types';
import { javaTextureCategory } from '../../../src/editions/java/textures';
import { bedrockTextureCategory } from '../../../src/editions/bedrock/catalog';

export function img(w: number, h: number, fn: (x: number, y: number) => [number, number, number, number]): ImageData {
  const out = createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.data.set(fn(x, y), (y * w + x) * 4);
  return out;
}

export const solid = (w: number, h: number, c: [number, number, number, number]) => img(w, h, () => c);
export const noisy = (w: number, h: number, seed = 1) =>
  img(w, h, (x, y) => [(x * 37 + y * 11 + seed * 5) % 200 + 30, (x * 7 + y * 23 + seed) % 180 + 40, (x * 3 + y * 5) % 90 + 60, 255]);
/** Diamond shape on transparent background whose alpha-0 pixels hide a colour. */
export const itemArt = () =>
  img(16, 16, (x, y) => (Math.abs(x - 7.5) + Math.abs(y - 7.5) < 6 ? [220, 40 + y * 8, 40, 255] : [x * 10, y * 10, 99, 0]));

export type FileSpec = Record<string, ImageData | string>;

/** An in-memory AssetIndex over synthetic files (PNG or TGA encoded by extension). */
export function fakeAssets(edition: Edition, version: string, spec: FileSpec, animated: string[] = []): AssetIndex {
  const files = new Map<string, Uint8Array>();
  for (const [path, v] of Object.entries(spec)) {
    files.set(path, typeof v === 'string' ? new TextEncoder().encode(v) : path.endsWith('.tga') ? encodeTga(v) : encodePng(v));
  }
  const root = edition === 'java' ? 'assets/minecraft/textures/' : 'textures/';
  const textures: TextureInfo[] = [];
  for (const path of files.keys()) {
    if (!path.startsWith(root) || !/\.(png|tga)$/.test(path)) continue;
    const rel = path.slice(root.length);
    const id = rel.replace(/\.(png|tga)$/, '');
    textures.push({
      path,
      id,
      name: id.split('/').pop()!,
      category: edition === 'java' ? javaTextureCategory(rel) : bedrockTextureCategory(rel),
      ext: path.endsWith('.tga') ? 'tga' : 'png',
      ...(files.has(`${path}.mcmeta`) || animated.includes(path) ? { animated: true } : {}),
    });
  }
  const read = async (p: string) => {
    const b = files.get(p);
    if (!b) throw new Error(`missing ${p}`);
    return b;
  };
  return {
    edition,
    version,
    textures,
    hasFile: (p) => files.has(p),
    listFiles: (prefix) => [...files.keys()].filter((p) => p.startsWith(prefix)),
    readFile: read,
    readText: async (p) => new TextDecoder().decode(await read(p)),
    readImage: async (p) => decodeImage(await read(p), p.split('.').pop()),
  };
}

export async function unzipBlob(blob: Blob): Promise<Record<string, Uint8Array>> {
  return unzipSync(new Uint8Array(await blob.arrayBuffer()));
}

export const text = (b: Uint8Array | undefined) => (b ? new TextDecoder().decode(b) : undefined);
export const json = (b: Uint8Array | undefined) => (b ? JSON.parse(new TextDecoder().decode(b)) : undefined);

export function javaSpec(): FileSpec {
  return {
    'version.json': JSON.stringify({ id: '26.3', pack_version: { resource_major: 97, resource_minor: 1, data_major: 121, data_minor: 0 } }),
    'assets/minecraft/textures/block/stone.png': noisy(16, 16, 1),
    'assets/minecraft/textures/block/grass_block_top.png': img(16, 16, (x, y) => [120 + ((x + y) % 5) * 8, 120 + ((x + y) % 5) * 8, 120 + ((x + y) % 5) * 8, 255]),
    'assets/minecraft/textures/block/grass_block_side.png': img(16, 16, (_x, y) => (y < 3 ? [90, 160, 60, 255] : [134, 96, 67, 255])),
    'assets/minecraft/textures/block/water_still.png': img(16, 64, (x, y) => [40, 80 + ((y >> 4) * 20), 200 - x, 180]),
    'assets/minecraft/textures/block/water_still.png.mcmeta': '{\n  "animation": {\n    "frametime": 2,\n    "frames": [0, 1, 2, 3, 3, 2]\n  }\n}\n',
    'assets/minecraft/textures/block/glass.png': img(16, 16, (x, y) => (x === 0 || y === 0 || x === 15 || y === 15 ? [200, 220, 230, 255] : [0, 0, 0, 0])),
    'assets/minecraft/textures/block/glass.png.mcmeta': '{"texture":{"mipmap_strategy":"mean"}}',
    'assets/minecraft/textures/item/apple.png': itemArt(),
    'assets/minecraft/textures/font/ascii.png': solid(16, 16, [255, 255, 255, 255]),
    'assets/minecraft/textures/colormap/grass.png': noisy(4, 4, 3),
    'assets/minecraft/textures/gui/sprites/widget/button.png': noisy(20, 4, 4),
    'assets/minecraft/textures/gui/sprites/widget/button.png.mcmeta': '{"gui":{"scaling":{"type":"nine_slice","width":200,"height":20,"border":3}}}',
    'assets/minecraft/textures/gui/sprites/friends/loading.png': noisy(5, 6, 5),
    'assets/minecraft/textures/gui/sprites/friends/loading.png.mcmeta': '{"animation":{"width":5,"height":2,"frametime":6}}',
  };
}

export function bedrockSpec(): FileSpec {
  return {
    'textures/blocks/stone.png': noisy(16, 16, 7),
    'textures/blocks/grass_carried.png': solid(16, 16, [90, 170, 70, 255]),
    'textures/blocks/grass_side_carried.png': img(16, 16, (_x, y) => (y < 3 ? [90, 170, 70, 255] : [134, 96, 67, 255])),
    // alpha is a tint mask: dirt part has alpha 0 but visible colour
    'textures/blocks/grass_side.tga': img(16, 16, (x, y) => (y < 3 ? [150, 150, 150, 255] : [134 + (x % 3), 96, 67, 0])),
    'textures/blocks/leaves_oak.tga': img(16, 16, (x, y) => [60, 100 + x, 40, (x + y) % 4 === 0 ? 0 : 255]),
    'textures/items/apple.png': itemArt(),
    'textures/ui/button.png': noisy(8, 8, 9),
    'textures/ui/button.json': '{ "nineslice_size": 2, "base_size": [8, 8] }',
    'textures/colormap/grass.png': noisy(4, 4, 2),
  };
}
