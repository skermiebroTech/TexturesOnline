// Resolves the diorama's texture slots from a game AssetIndex (Java or Bedrock, any version), with
// biome tinting and first-frame extraction, falling back to original procedural textures.
// Pure logic apart from AssetIndex I/O.

import type { AssetIndex } from '../../core/types';
import { proceduralTexture, WATER_FRAMES, type ProceduralTextureName, type RGBAImage } from './procedural-textures';
import { TEXTURE_SLOTS, type TextureSlot } from './voxel-world';

export interface SlotTexture {
  image: RGBAImage;
  /** Number of vertically stacked animation frames (water only; 1 otherwise) */
  frames: number;
  /** Game ticks per frame (water animation) */
  frametime: number;
  source: 'asset' | 'procedural';
  path?: string;
  /** Came from a texture pack layered over vanilla (see shared/overlay-assets) */
  fromPack?: boolean;
}
export type SlotTextures = Record<TextureSlot, SlotTexture>;

/**
 * Optional capability of an AssetIndex that layers a texture pack over vanilla: the pack file served
 * for a path (null when vanilla serves it). Duck-typed so this module stays free of the pack code.
 */
interface PackLayer {
  overridePath(path: string): string | null;
}

function packLayerOf(assets: AssetIndex): PackLayer | null {
  return typeof (assets as Partial<PackLayer>).overridePath === 'function' ? (assets as unknown as PackLayer) : null;
}

type RGB = [number, number, number];

/** Plains biome colours (temperature 0.8, downfall 0.4) used when no colormap is readable. */
export const DEFAULT_GRASS_TINT: RGB = [0x91, 0xbd, 0x59];
export const DEFAULT_FOLIAGE_TINT: RGB = [0x77, 0xab, 0x2f];

interface SlotSource {
  /** The block's names across versions (newest first) */
  java: string[];
  bedrock: string[];
  /** Stand-ins for versions without the block (only used when none of the names exist) */
  substitute?: { java: string[]; bedrock: string[] };
  tint?: 'grass' | 'foliage';
  opaque?: boolean;
  procedural: ProceduralTextureName;
}

// Candidate ids relative to the textures root, newest naming first.
const SOURCES: Record<TextureSlot, SlotSource> = {
  grass_top: { java: ['block/grass_block_top', 'blocks/grass_top'], bedrock: ['blocks/grass_top'], tint: 'grass', opaque: true, procedural: 'grass_top' },
  grass_side: { java: ['block/grass_block_side', 'blocks/grass_side'], bedrock: ['blocks/grass_side', 'blocks/grass_side_carried'], tint: 'grass', opaque: true, procedural: 'grass_side' },
  dirt: { java: ['block/dirt', 'blocks/dirt'], bedrock: ['blocks/dirt'], opaque: true, procedural: 'dirt' },
  stone: { java: ['block/stone', 'blocks/stone'], bedrock: ['blocks/stone'], opaque: true, procedural: 'stone' },
  cobblestone: { java: ['block/cobblestone', 'blocks/cobblestone'], bedrock: ['blocks/cobblestone'], opaque: true, procedural: 'cobblestone' },
  gravel: { java: ['block/gravel', 'blocks/gravel'], bedrock: ['blocks/gravel'], opaque: true, procedural: 'gravel' },
  sand: { java: ['block/sand', 'blocks/sand'], bedrock: ['blocks/sand'], opaque: true, procedural: 'sand' },
  water: { java: ['block/water_still', 'blocks/water_still'], bedrock: ['blocks/water_still_grey', 'blocks/water_still'], procedural: 'water' },
  log: { java: ['block/oak_log', 'blocks/log_oak'], bedrock: ['blocks/log_oak'], opaque: true, procedural: 'oak_log' },
  log_top: { java: ['block/oak_log_top', 'blocks/log_oak_top'], bedrock: ['blocks/log_oak_top'], opaque: true, procedural: 'oak_log_top' },
  leaves: { java: ['block/oak_leaves', 'blocks/leaves_oak'], bedrock: ['blocks/leaves_oak', 'blocks/leaves_oak_opaque'], tint: 'foliage', procedural: 'oak_leaves' },
  short_grass: { java: ['block/short_grass', 'block/grass', 'blocks/tallgrass'], bedrock: ['blocks/tallgrass'], tint: 'grass', procedural: 'short_grass' },
  poppy: { java: ['block/poppy', 'blocks/flower_rose'], bedrock: ['blocks/flower_rose'], procedural: 'poppy' },
  dandelion: { java: ['block/dandelion', 'blocks/flower_dandelion'], bedrock: ['blocks/flower_dandelion'], procedural: 'dandelion' },
  // Older versions have no cornflower: use the blue orchid, and 1.6 (no blue flower) the rose, so the art style stays consistent
  cornflower: {
    java: ['block/cornflower'],
    bedrock: ['blocks/flower_cornflower'],
    substitute: { java: ['block/blue_orchid', 'blocks/flower_blue_orchid', 'blocks/flower_rose'], bedrock: ['blocks/flower_blue_orchid'] },
    procedural: 'cornflower',
  },
  torch: { java: ['block/torch', 'blocks/torch_on'], bedrock: ['blocks/torch_on'], procedural: 'torch' },
};

export function cloneImage(img: RGBAImage): RGBAImage {
  return { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };
}

/** Top-left square frame of an image (animation strips store frames vertically). */
export function firstFrame(img: RGBAImage): RGBAImage {
  const size = Math.min(img.width, img.height);
  if (img.width === size && img.height === size) return cloneImage(img);
  const out = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    const src = y * img.width * 4;
    out.set(img.data.subarray(src, src + size * 4), y * size * 4);
  }
  return { width: size, height: size, data: out };
}

/** Multiplies RGB by a colour (0-255). */
export function tintImage(img: RGBAImage, tint: RGB): RGBAImage {
  const out = cloneImage(img);
  const d = out.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = (d[i] * tint[0]) / 255;
    d[i + 1] = (d[i + 1] * tint[1]) / 255;
    d[i + 2] = (d[i + 2] * tint[2]) / 255;
  }
  return out;
}

/** Bedrock style: alpha is a tint mask (255 = fully tinted); output is opaque. */
export function tintByAlphaMask(img: RGBAImage, tint: RGB): RGBAImage {
  const out = cloneImage(img);
  const d = out.data;
  for (let i = 0; i < d.length; i += 4) {
    const m = d[i + 3] / 255;
    d[i] = d[i] * (1 - m + (m * tint[0]) / 255);
    d[i + 1] = d[i + 1] * (1 - m + (m * tint[1]) / 255);
    d[i + 2] = d[i + 2] * (1 - m + (m * tint[2]) / 255);
    d[i + 3] = 255;
  }
  return out;
}

/** Java grass side: tinted overlay alpha-composited over the base (overlay is resampled to the base size). */
export function compositeOverlay(base: RGBAImage, overlay: RGBAImage, tint: RGB): RGBAImage {
  const out = cloneImage(base);
  const d = out.data;
  const o = overlay.data;
  for (let y = 0; y < base.height; y++) {
    const oy = Math.min(overlay.height - 1, Math.floor((y * overlay.height) / base.height));
    for (let x = 0; x < base.width; x++) {
      const ox = Math.min(overlay.width - 1, Math.floor((x * overlay.width) / base.width));
      const oi = (oy * overlay.width + ox) * 4;
      const a = o[oi + 3] / 255;
      if (a <= 0) continue;
      const i = (y * base.width + x) * 4;
      d[i] = d[i] * (1 - a) + ((o[oi] * tint[0]) / 255) * a;
      d[i + 1] = d[i + 1] * (1 - a) + ((o[oi + 1] * tint[1]) / 255) * a;
      d[i + 2] = d[i + 2] * (1 - a) + ((o[oi + 2] * tint[2]) / 255) * a;
    }
  }
  return out;
}

export function forceOpaque(img: RGBAImage): RGBAImage {
  const out = cloneImage(img);
  for (let i = 3; i < out.data.length; i += 4) out.data[i] = 255;
  return out;
}

function hasTranslucency(img: RGBAImage): boolean {
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i] < 255) return true;
  return false;
}

/** Biome colour lookup exactly like the game: x = (1 - temp) * 255, y = (1 - rain * temp) * 255. */
export function sampleColormap(img: RGBAImage, temperature: number, downfall: number): RGB | null {
  if (img.width < 1 || img.height < 1) return null;
  const t = Math.min(1, Math.max(0, temperature));
  const r = Math.min(1, Math.max(0, downfall)) * t;
  const x = Math.min(img.width - 1, Math.floor((1 - t) * (img.width - 1)));
  const y = Math.min(img.height - 1, Math.floor((1 - r) * (img.height - 1)));
  const i = (y * img.width + x) * 4;
  if (img.data[i + 3] === 0) return null;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
}

// Bedrock resolves duplicate stems by extension priority .tga > .png (e.g. blocks/tallgrass has both,
// with different pixels), so probe in the same order as the game.
function roots(assets: AssetIndex): { root: string; exts: string[] } {
  return assets.edition === 'java'
    ? { root: 'assets/minecraft/textures/', exts: ['.png'] }
    : { root: 'textures/', exts: ['.tga', '.png'] };
}

/**
 * Path of a slot's texture. A texture pack's own file wins over vanilla even when it uses another
 * version's (or the other edition's) name for the block, so older packs still show in the preview.
 */
function resolvePath(assets: AssetIndex, src: SlotSource): string | null {
  const { root, exts } = roots(assets);
  const java = assets.edition === 'java';
  const pack = packLayerOf(assets);
  if (pack) {
    for (const id of java ? [...src.java, ...src.bedrock] : [...src.bedrock, ...src.java]) {
      for (const ext of exts) {
        const hit = pack.overridePath(root + id + ext);
        if (hit) return hit;
      }
    }
  }
  const sub = src.substitute ? (java ? src.substitute.java : src.substitute.bedrock) : [];
  for (const id of [...(java ? src.java : src.bedrock), ...sub]) {
    for (const ext of exts) {
      const p = root + id + ext;
      if (assets.hasFile(p)) return pack?.overridePath(p) ?? p;
    }
  }
  return null;
}

/** Every texture id (relative to the textures root, no extension) the diorama may read, both editions. */
export function previewTextureIds(): string[] {
  const ids = new Set<string>(['colormap/grass', 'colormap/foliage']);
  for (const [slot, src] of Object.entries(SOURCES) as [TextureSlot, SlotSource][]) {
    for (const id of [...src.java, ...src.bedrock, ...(src.substitute?.java ?? []), ...(src.substitute?.bedrock ?? [])]) {
      ids.add(id);
      if (slot === 'grass_side') ids.add(`${id}_overlay`);
    }
  }
  return [...ids].sort();
}

async function readFrametime(assets: AssetIndex, path: string): Promise<number> {
  const meta = path + '.mcmeta';
  if (!assets.hasFile(meta)) return 2;
  try {
    const json = JSON.parse(await assets.readText(meta)) as { animation?: { frametime?: number } };
    const ft = json.animation?.frametime;
    return typeof ft === 'number' && ft > 0 ? ft : 1;
  } catch {
    return 2;
  }
}

/** Tallest water strip uploaded (WebGL guarantees 4096 on practically every device). */
export const MAX_STRIP_HEIGHT = 4096;
/** Widest texture uploaded: HD packs (1024x and up) are reduced, the preview never shows more detail. */
export const MAX_TEXTURE_SIZE = 512;

/**
 * Halves the size (averaging 2x2 blocks, alpha-weighted) until the width is at most `max`. Square
 * frames of a vertical strip stay aligned because both sides shrink by the same power of two.
 */
export function limitSize(img: RGBAImage, max = MAX_TEXTURE_SIZE): RGBAImage {
  let cur = img;
  while (cur.width > max && cur.width % 2 === 0 && cur.height % 2 === 0) {
    const w = cur.width / 2;
    const h = cur.height / 2;
    const out = new Uint8ClampedArray(w * h * 4);
    const s = cur.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0, a = 0, r0 = 0, g0 = 0, b0 = 0;
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
          const i = ((y * 2 + dy) * cur.width + x * 2 + dx) * 4;
          const al = s[i + 3];
          r += s[i] * al;
          g += s[i + 1] * al;
          b += s[i + 2] * al;
          a += al;
          r0 += s[i];
          g0 += s[i + 1];
          b0 += s[i + 2];
        }
        const o = (y * w + x) * 4;
        // colour under fully transparent pixels still matters (Bedrock tint masks): plain average there
        out[o] = a > 0 ? r / a : r0 / 4;
        out[o + 1] = a > 0 ? g / a : g0 / 4;
        out[o + 2] = a > 0 ? b / a : b0 / 4;
        out[o + 3] = a / 4;
      }
    }
    cur = { width: w, height: h, data: out };
  }
  return cur;
}

/** Keeps the first frames of a vertical strip so it fits in `maxHeight` pixels. */
export function limitStrip(img: RGBAImage, frames: number, maxHeight = MAX_STRIP_HEIGHT): { image: RGBAImage; frames: number } {
  const frameH = img.height / frames;
  if (img.height <= maxHeight || frames <= 1) return { image: img, frames };
  const keep = Math.max(1, Math.floor(maxHeight / frameH));
  const h = keep * frameH;
  return { image: { width: img.width, height: h, data: img.data.slice(0, img.width * h * 4) }, frames: keep };
}

/**
 * Java before 1.13 (and some packs) ship blue, pre-coloured water. The preview tints water with
 * PreviewParams.waterColor, so convert coloured water to the neutral grey the modern game uses,
 * keeping its light/dark detail. Grey textures are returned unchanged.
 */
export function neutralizeWater(img: RGBAImage): RGBAImage {
  const d = img.data;
  let chroma = 0;
  let lumaSum = 0;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const r = d[i], g = d[i + 1], b = d[i + 2];
    chroma += Math.max(r, g, b) - Math.min(r, g, b);
    lumaSum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
    n++;
  }
  if (!n || chroma / n < 24) return img;
  const scale = 185 / Math.max(1, lumaSum / n);
  const out = cloneImage(img);
  const o = out.data;
  for (let i = 0; i < o.length; i += 4) {
    const v = (0.2126 * o[i] + 0.7152 * o[i + 1] + 0.0722 * o[i + 2]) * scale;
    o[i] = o[i + 1] = o[i + 2] = v;
  }
  return out;
}

function proceduralSlot(slot: TextureSlot): SlotTexture {
  const name = SOURCES[slot].procedural;
  const image = proceduralTexture(name);
  return { image, frames: slot === 'water' ? WATER_FRAMES : 1, frametime: 2, source: 'procedural' };
}

/** All slots from original procedural art. */
export function proceduralSlotTextures(): SlotTextures {
  const out = {} as SlotTextures;
  for (const s of TEXTURE_SLOTS) out[s] = proceduralSlot(s);
  return out;
}

async function loadTints(assets: AssetIndex): Promise<{ grass: RGB; foliage: RGB }> {
  const { root } = roots(assets);
  const read = async (name: string, fallback: RGB): Promise<RGB> => {
    const p = `${root}colormap/${name}.png`;
    if (!assets.hasFile(p)) return fallback;
    try {
      return sampleColormap(await assets.readImage(p), 0.8, 0.4) ?? fallback;
    } catch {
      return fallback;
    }
  };
  const [grass, foliage] = await Promise.all([read('grass', DEFAULT_GRASS_TINT), read('foliage', DEFAULT_FOLIAGE_TINT)]);
  return { grass, foliage };
}

async function loadSlot(assets: AssetIndex, slot: TextureSlot, tints: { grass: RGB; foliage: RGB }): Promise<SlotTexture> {
  const src = SOURCES[slot];
  const path = resolvePath(assets, src);
  if (!path) return proceduralSlot(slot);
  const read = await assets.readImage(path);
  if (!read || read.width < 1 || read.height < 1) throw new Error(`Empty image: ${path}`);
  const raw = limitSize(read);
  const tint = src.tint ? tints[src.tint] : null;
  const pack = packLayerOf(assets);
  let fromPack = !!pack?.overridePath(path);

  if (slot === 'water') {
    // any resolution: frames are square tiles as wide as the texture
    const frameCount = raw.height > raw.width && raw.height % raw.width === 0 ? raw.height / raw.width : 1;
    const strip = limitStrip(frameCount > 1 ? cloneImage(raw) : firstFrame(raw), frameCount);
    return { image: neutralizeWater(strip.image), frames: strip.frames, frametime: await readFrametime(assets, path), source: 'asset', path, fromPack };
  }

  let img = firstFrame(raw);
  if (slot === 'grass_side' && tint) {
    // Java: a tinted overlay texture on top (any edition's pack may bring one). Bedrock: alpha is the tint mask.
    const overlayPath = path.replace(/\.(png|tga)$/i, '_overlay.png');
    if (assets.hasFile(overlayPath)) {
      try {
        img = compositeOverlay(img, firstFrame(await assets.readImage(overlayPath)), tint);
        fromPack ||= !!pack?.overridePath(overlayPath);
      } catch {
        // keep the untinted side
      }
    } else if (!path.includes('carried') && hasTranslucency(img)) {
      img = tintByAlphaMask(img, tint);
    }
  } else if (tint) {
    img = tintImage(img, tint);
  }
  if (src.opaque) img = forceOpaque(img);
  return { image: img, frames: 1, frametime: 2, source: 'asset', path, fromPack };
}

/**
 * Loads every slot from the given assets; any slot that is missing or fails to decode uses procedural art.
 * Never rejects (except when aborted).
 */
export async function loadSlotTextures(assets: AssetIndex | null, signal?: AbortSignal): Promise<SlotTextures> {
  if (!assets) return proceduralSlotTextures();
  const tints = await loadTints(assets).catch(() => ({ grass: DEFAULT_GRASS_TINT, foliage: DEFAULT_FOLIAGE_TINT }));
  const entries = await Promise.all(
    TEXTURE_SLOTS.map(async (slot) => {
      if (signal?.aborted) return [slot, proceduralSlot(slot)] as const;
      try {
        return [slot, await loadSlot(assets, slot, tints)] as const;
      } catch {
        return [slot, proceduralSlot(slot)] as const;
      }
    }),
  );
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const out = {} as SlotTextures;
  for (const [slot, tex] of entries) out[slot] = tex;
  return out;
}
