// Texture metadata helpers for the texture pack editor: category labels, friendly names, search,
// animation strips, block faces for the 3D preview and palette extraction. Pure apart from AssetIndex reads.

import type { AssetIndex, Edition, TextureCategory, TextureInfo, TexturePackProject } from '../../../core/types';
import type { IconName } from '../../../ui/icons';
import { cropImageData, createImageData } from '../../../core/image';
import { parseLenientJson } from '../../../editions/bedrock/catalog';
import { textureRoot } from '../project';

export interface TextureEntry extends TextureInfo {
  /** Not a vanilla texture of this version (imported or from another version) */
  custom?: boolean;
  /** Lower-case search haystacks */
  hay: string;
  pretty: string;
}

export const CATEGORY_INFO: Record<TextureCategory, { label: string; icon: IconName; short: string }> = {
  block: { label: 'Blocks', short: 'Block', icon: 'box' },
  item: { label: 'Items', short: 'Item', icon: 'sword' },
  entity: { label: 'Mobs', short: 'Mob', icon: 'human' },
  armor: { label: 'Armor', short: 'Armor', icon: 'shirt' },
  gui: { label: 'GUI', short: 'GUI', icon: 'layout' },
  particle: { label: 'Particles', short: 'Particle', icon: 'sparkle' },
  environment: { label: 'Sky', short: 'Sky', icon: 'cloud-sun' },
  painting: { label: 'Paintings', short: 'Painting', icon: 'image' },
  effect: { label: 'Effects', short: 'Effect icon', icon: 'potion' },
  font: { label: 'Fonts', short: 'Font', icon: 'text-cursor' },
  map: { label: 'Maps', short: 'Map', icon: 'map' },
  colormap: { label: 'Colour maps', short: 'Colour map', icon: 'colors-swatch' },
  misc: { label: 'Misc', short: 'Misc', icon: 'more-horizontal' },
  other: { label: 'Other', short: 'Other', icon: 'files' },
};

const SMALL_WORDS = new Set(['of', 'on', 'and', 'the', 'a', 'in']);

/** 'grass_block_top' -> 'Grass Block Top' */
export function prettyName(name: string): string {
  return name
    .replace(/[_\-.]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

export function makeEntry(t: TextureInfo, custom = false): TextureEntry {
  const pretty = prettyName(t.name);
  return { ...t, custom: custom || undefined, pretty, hay: `${t.id.toLowerCase().replace(/[_/]+/g, ' ')} ${t.name.toLowerCase()}` };
}

/** Vanilla textures plus the pack's own textures that aren't in this version. */
export function buildEntries(project: TexturePackProject, assets: AssetIndex, categoryForPath: (p: string, e: Edition) => TextureCategory): TextureEntry[] {
  const list: TextureEntry[] = assets.textures.map((t) => makeEntry(t));
  const known = new Set(assets.textures.map((t) => t.path));
  const root = textureRoot(project.edition);
  for (const path of Object.keys(project.overrides)) {
    if (known.has(path) || !path.startsWith(root) || !/\.(png|tga)$/i.test(path)) continue;
    const rel = path.slice(root.length);
    const id = rel.replace(/\.(png|tga)$/i, '');
    const name = id.slice(id.lastIndexOf('/') + 1);
    list.push(makeEntry({ path, id, name, category: categoryForPath(path, project.edition), ext: /\.tga$/i.test(path) ? 'tga' : 'png' }, true));
  }
  return list;
}

// ---------------------------------------------------------------------------------------------
// Search

/** Search score (higher is better), -1 when a token doesn't match. */
export function searchScore(tokens: string[], e: TextureEntry): number {
  let score = 0;
  const name = e.name.toLowerCase();
  for (const tok of tokens) {
    if (name === tok) score += 120;
    else if (name.startsWith(tok)) score += 70;
    else if (new RegExp(`(^|_)${escapeRe(tok)}`).test(name)) score += 55;
    else if (name.includes(tok)) score += 40;
    else if (e.hay.includes(tok)) score += 22;
    else if (tok.length >= 3 && isSubsequence(tok, name)) score += 6;
    else return -1;
  }
  return score - name.length * 0.3;
}

export function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .replace(/[_/]+/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isSubsequence(needle: string, hay: string): boolean {
  let i = 0;
  for (let j = 0; j < hay.length && i < needle.length; j++) if (hay[j] === needle[i]) i++;
  return i === needle.length;
}

// ---------------------------------------------------------------------------------------------
// Animation strips

export interface AnimInfo {
  frameW: number;
  frameH: number;
  count: number;
  cols: number;
  /** Game ticks per frame (default) */
  frametime: number;
  /** Explicit playback order (index + ticks), when the .mcmeta lists frames */
  sequence: { index: number; time: number }[];
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : undefined;
}

/**
 * Frame layout of an animation strip. `scale` converts the metadata's pixel sizes to the image's
 * (an HD copy of a 16x strip has scale 2).
 */
export function animLayout(imgW: number, imgH: number, opts: { width?: number; height?: number; frametime?: number; frames?: unknown[] }, scale = 1): AnimInfo | null {
  let fw: number;
  let fh: number;
  const w = opts.width ? Math.round(opts.width * scale) : undefined;
  const hh = opts.height ? Math.round(opts.height * scale) : undefined;
  if (w) {
    fw = w;
    fh = hh ?? imgH;
  } else if (hh) {
    fw = imgW;
    fh = hh;
  } else {
    fw = fh = Math.min(imgW, imgH);
  }
  if (fw < 1 || fh < 1 || imgW % fw || imgH % fh) return null;
  const cols = imgW / fw;
  const count = cols * (imgH / fh);
  if (count < 2) return null;
  const frametime = opts.frametime ?? 1;
  const sequence: { index: number; time: number }[] = [];
  if (Array.isArray(opts.frames)) {
    for (const f of opts.frames) {
      if (typeof f === 'number' && f >= 0 && f < count) sequence.push({ index: Math.floor(f), time: frametime });
      else if (f && typeof f === 'object') {
        const idx = (f as { index?: unknown }).index;
        if (typeof idx === 'number' && idx >= 0 && idx < count) sequence.push({ index: Math.floor(idx), time: num((f as { time?: unknown }).time) ?? frametime });
      }
    }
  }
  if (!sequence.length) for (let i = 0; i < count; i++) sequence.push({ index: i, time: frametime });
  return { frameW: fw, frameH: fh, count, cols, frametime, sequence };
}

const flipbookCache = new WeakMap<AssetIndex, Promise<Map<string, number>>>();

async function bedrockFlipbooks(assets: AssetIndex): Promise<Map<string, number>> {
  let p = flipbookCache.get(assets);
  if (!p) {
    p = (async () => {
      const map = new Map<string, number>();
      const path = 'textures/flipbook_textures.json';
      try {
        const json = parseLenientJson<unknown>(await assets.readText(path));
        if (Array.isArray(json)) {
          for (const e of json) {
            const tex = (e as { flipbook_texture?: unknown }).flipbook_texture;
            if (typeof tex === 'string') map.set(tex.replace(/\.(png|tga)$/i, ''), num((e as { ticks_per_frame?: unknown }).ticks_per_frame) ?? 1);
          }
        }
      } catch {
        /* no flipbook list: defaults */
      }
      return map;
    })();
    flipbookCache.set(assets, p);
  }
  return p;
}

/** Animation info for a texture, from the pack's own .mcmeta, vanilla's, or Bedrock's flipbook list. */
export async function readAnimInfo(project: TexturePackProject, assets: AssetIndex, entry: TextureEntry, img: ImageData, vanillaWidth: number | null): Promise<AnimInfo | null> {
  if (!entry.animated && !(project.edition === 'java' && project.extraFiles[entry.path + '.mcmeta'])) return null;
  const scale = vanillaWidth ? img.width / vanillaWidth : 1;
  if (project.edition === 'java') {
    const metaPath = entry.path + '.mcmeta';
    let text: string | null = null;
    const own = project.extraFiles[metaPath];
    try {
      if (own) text = await own.text();
      else if (assets.hasFile(metaPath)) text = await assets.readText(metaPath);
    } catch {
      text = null;
    }
    if (!text) return entry.animated ? animLayout(img.width, img.height, {}) : null;
    try {
      const json = parseLenientJson<{ animation?: Record<string, unknown> }>(text);
      const a = json?.animation;
      if (!a || typeof a !== 'object') return null;
      return animLayout(img.width, img.height, {
        width: num(a.width),
        height: num(a.height),
        frametime: num(a.frametime),
        frames: Array.isArray(a.frames) ? a.frames : undefined,
      }, own ? 1 : scale);
    } catch {
      return animLayout(img.width, img.height, {});
    }
  }
  const stem = entry.path.replace(/\.(png|tga)$/i, '');
  const ticks = (await bedrockFlipbooks(assets)).get(stem);
  return animLayout(img.width, img.height, { frametime: ticks ?? 1 });
}

export function frameRect(a: AnimInfo, i: number): { x: number; y: number; w: number; h: number } {
  return { x: (i % a.cols) * a.frameW, y: Math.floor(i / a.cols) * a.frameH, w: a.frameW, h: a.frameH };
}

export function getFrame(img: ImageData, a: AnimInfo | null, i: number): ImageData {
  if (!a) return img;
  const r = frameRect(a, Math.max(0, Math.min(a.count - 1, i)));
  return cropImageData(img, r.x, r.y, r.w, r.h);
}

/** Writes `frame` into `full` at frame i (in place). */
export function putFrame(full: ImageData, a: AnimInfo, i: number, frame: ImageData): void {
  const r = frameRect(a, i);
  const w = Math.min(r.w, frame.width);
  const hgt = Math.min(r.h, frame.height);
  for (let y = 0; y < hgt; y++) {
    const s = y * frame.width * 4;
    full.data.set(frame.data.subarray(s, s + w * 4), ((r.y + y) * full.width + r.x) * 4);
  }
}

/** Top-left square of an image (first frame of a vertical strip). */
export function firstSquare(img: ImageData): ImageData {
  if (img.height <= img.width) return img;
  return cropImageData(img, 0, 0, img.width, img.width);
}

// ---------------------------------------------------------------------------------------------
// Cube faces for the 3D preview

export type Face = 'up' | 'down' | 'north' | 'south' | 'east' | 'west';
export interface FacePlan {
  /** texture id (relative to the root, without extension) per face role */
  up: string;
  down: string;
  side: string;
  front?: string;
}

const SUFFIX = /_(top|bottom|side|front|back|end)$/;

/**
 * Which textures make up the block a texture belongs to (grass_block_top -> top/side/dirt, oak_log ->
 * oak_log_top ends, furnace_front -> front + furnace_side + furnace_top ...). Null = all sides the same.
 */
export function planCube(id: string, has: (id: string) => boolean, edition: Edition): FacePlan | null {
  const slash = id.lastIndexOf('/');
  const dir = id.slice(0, slash + 1);
  const name = id.slice(slash + 1);
  const x = (n: string) => (has(dir + n) ? dir + n : undefined);

  if (edition === 'java' && /^grass_block(_top|_side|_side_overlay|_snow)?$/.test(name)) {
    const snowy = name === 'grass_block_snow';
    return { up: snowy ? x('snow') ?? id : x('grass_block_top') ?? id, down: x('dirt') ?? id, side: snowy ? id : x('grass_block_side') ?? id };
  }
  if (edition === 'bedrock' && /^grass_(top|side|side_carried|carried|side_snowed)$/.test(name)) {
    return { up: x('grass_top') ?? x('grass_carried') ?? id, down: x('dirt') ?? id, side: name === 'grass_side_snowed' ? id : x('grass_side_carried') ?? x('grass_side') ?? id };
  }
  const m = SUFFIX.exec(name);
  const base = m ? name.slice(0, -m[0].length) : name;
  const top = x(`${base}_top`) ?? x(`${base}_end`);
  const bottom = x(`${base}_bottom`) ?? top;
  const side = x(`${base}_side`) ?? (m ? x(base) : undefined);
  const front = x(`${base}_front`);
  if (!top && !side && !front) return null;
  let down = bottom ?? id;
  if (/^(dirt_path|mycelium|podzol|farmland|grass_path)$/.test(base)) down = x('dirt') ?? down;
  if (base === 'crafting_table') down = x('oak_planks') ?? x('planks_oak') ?? down;
  return { up: top ?? id, down, side: side ?? (m?.[1] === 'side' ? id : x(base) ?? id), front };
}

export type Tint = [number, number, number];
const WATER_TINT: Tint = [0x3f, 0x76, 0xe4];

/** Biome tint the game applies to a texture (preview only). */
export function tintFor(id: string, edition: Edition): { tint: 'grass' | 'foliage' | 'fixed'; color?: Tint } | null {
  const name = id.slice(id.lastIndexOf('/') + 1);
  if (edition === 'java') {
    if (/^(grass_block_top|grass_block_side_overlay|short_grass|grass|fern|tall_grass_(top|bottom)|large_fern_(top|bottom)|sugar_cane|potted_fern)$/.test(name)) return { tint: 'grass' };
    if (name === 'birch_leaves') return { tint: 'fixed', color: [0x80, 0xa7, 0x55] };
    if (name === 'spruce_leaves') return { tint: 'fixed', color: [0x61, 0x99, 0x61] };
    if (/^(oak|jungle|acacia|dark_oak|mangrove)_leaves$|^vine$/.test(name)) return { tint: 'foliage' };
    if (/^water_(still|flow|overlay)$/.test(name)) return { tint: 'fixed', color: WATER_TINT };
    return null;
  }
  if (/^(grass_top|grass_side|tallgrass|double_plant_grass_(top|bottom)|fern|reeds)$/.test(name)) return { tint: 'grass' };
  if (/^leaves_(oak|jungle|acacia|big_oak|birch|spruce)(_opaque)?$|^vine$/.test(name)) return { tint: 'foliage' };
  if (/^water_(still|flow)(_grey)?$/.test(name)) return { tint: 'fixed', color: WATER_TINT };
  return null;
}

/** Share of fully transparent pixels. */
export function transparentShare(img: ImageData): number {
  let n = 0;
  const d = img.data;
  for (let i = 3; i < d.length; i += 4) if (d[i] === 0) n++;
  return n / (img.width * img.height);
}

/** Bedrock alpha-as-data detection: hidden colour under alpha 0, or faint mask alpha values. */
export function alphaDataKind(img: ImageData): { hidden: number; faint: number } {
  const d = img.data;
  let hidden = 0;
  let faint = 0;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a === 0 && (d[i] | d[i + 1] | d[i + 2]) !== 0) hidden++;
    else if (a > 0 && a < 24) faint++;
  }
  const total = img.width * img.height;
  return { hidden: hidden / total, faint: faint / total };
}

// ---------------------------------------------------------------------------------------------
// Palette

export type RGBA = [number, number, number, number];

/** The most used colours of an image, sorted into a pleasant ramp (greys first, then by hue). */
export function extractPalette(img: ImageData, max = 32): RGBA[] {
  const counts = new Map<number, number>();
  const d = img.data;
  const step = img.width * img.height > 65536 ? 4 : 1;
  for (let i = 0; i < d.length; i += 4 * step) {
    if (d[i + 3] === 0) continue;
    const key = ((d[i] << 24) | (d[i + 1] << 16) | (d[i + 2] << 8) | d[i + 3]) >>> 0;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, max);
  const cols: RGBA[] = top.map(([k]) => [(k >>> 24) & 255, (k >>> 16) & 255, (k >>> 8) & 255, k & 255]);
  const hsv = (c: RGBA) => {
    const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const dd = mx - mn;
    let hue = 0;
    if (dd) {
      if (mx === r) hue = ((g - b) / dd) % 6;
      else if (mx === g) hue = (b - r) / dd + 2;
      else hue = (r - g) / dd + 4;
      hue = (hue * 60 + 360) % 360;
    }
    return { h: hue, s: mx ? dd / mx : 0, v: mx };
  };
  return cols
    .map((c) => ({ c, ...hsv(c) }))
    .sort((a, b) => {
      const ga = a.s < 0.14 ? 0 : 1;
      const gb = b.s < 0.14 ? 0 : 1;
      if (ga !== gb) return ga - gb;
      if (ga === 0) return a.v - b.v;
      const ha = Math.floor(a.h / 30);
      const hb = Math.floor(b.h / 30);
      return ha - hb || a.v - b.v;
    })
    .map((x) => x.c);
}

export function rgbaHex(c: RGBA): string {
  const hx = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hx(c[0])}${hx(c[1])}${hx(c[2])}${c[3] < 255 ? hx(c[3]) : ''}`;
}

/** Tiles an image 3x3 (for seamless previews). */
export function tile3(img: ImageData): ImageData {
  const out = createImageData(img.width * 3, img.height * 3);
  for (let ty = 0; ty < 3; ty++)
    for (let y = 0; y < img.height; y++) {
      const row = img.data.subarray(y * img.width * 4, (y + 1) * img.width * 4);
      for (let tx = 0; tx < 3; tx++) out.data.set(row, ((ty * img.height + y) * out.width + tx * img.width) * 4);
    }
  return out;
}

export function sameSize(a: ImageData, b: ImageData): boolean {
  return a.width === b.width && a.height === b.height;
}
