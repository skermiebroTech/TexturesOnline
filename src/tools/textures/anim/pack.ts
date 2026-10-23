// Animations in pack files (project.animations): what each Java version reads in a .png.mcmeta
// "animation" section, the section written from an animation (merged into the texture's other
// .mcmeta sections), and Bedrock's textures/flipbook_textures.json: entries for the pack's
// animations, tied to the block's atlas tile in terrain_texture.json and merged with the game's list.
// No DOM.
//
// Checked against the game's code: 1.6.1-1.7.10 read frametime, frames (index / {index, time}),
// width and height but no interpolate (added by 1.8.9); up to 1.12.2 frames are squares as wide as
// the image, stacked top to bottom (width / height are read but not used, and a frame index past the
// end makes the texture missing); 1.13+ cuts frames of width x height in rows (else squares of the
// short side) and skips bad frames with a warning. Interpolation blends the colour and keeps the first
// frame's alpha up to 1.21.1; 1.21.2+ blends all four channels (ARGB.lerp, then the
// animate_sprite_interpolate shader).

import type { AnimationStep, TextureAnimation, TexturePackProject } from '../../../core/types';
import { bundledPackFormat, comparePackFormats } from '../../../editions/java/packformats';
import { stringifyPretty } from '../../../editions/java/packmeta';
import { parseJsonLoose } from '../project';
import { clampTicks, flipbookTiming, normalizeFrames, timingFromFlipbook } from './timing';

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const posInt = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : undefined);

// ---------------------------------------------------------------------------------------------
// Java versions

export interface JavaAnimRules {
  /** "interpolate" is read (1.8+) */
  interpolate: boolean;
  /** Frames of any size, in rows (width / height, 1.13+); before, squares as wide as the image */
  layout: boolean;
  /** How interpolation blends: every channel (1.21.2+) or the colour only */
  blend: 'rgba' | 'rgb';
}

/** Whether a version is the release or newer (versions the table doesn't know: newer snapshots). */
function atLeast(version: string, release: string): boolean {
  const legacy = /^1\.(\d+)(?:\.(\d+))?$/.exec(version.trim());
  const want = /^1\.(\d+)(?:\.(\d+))?$/.exec(release);
  if (legacy && want) {
    const a = Number(legacy[1]);
    const b = Number(want[1]);
    return a !== b ? a > b : Number(legacy[2] ?? 0) >= Number(want[2] ?? 0);
  }
  const f = bundledPackFormat(version.trim());
  const r = bundledPackFormat(release);
  if (!f || !r) return !legacy;
  return comparePackFormats(f, r) >= 0;
}

export function javaAnimRules(version: string): JavaAnimRules {
  return { interpolate: atLeast(version, '1.8'), layout: atLeast(version, '1.13'), blend: atLeast(version, '1.21.2') ? 'rgba' : 'rgb' };
}

/** The oldest version the pack is made for (its target, or the low end of its compatibility range). */
export function lowestJavaVersion(project: Pick<TexturePackProject, 'version' | 'compat'>): string {
  let lowest = project.version;
  const range = project.compat;
  if (range?.minVersion && range.maxVersion) {
    for (const v of [range.minVersion, range.maxVersion]) if (!atLeast(v, lowest)) lowest = v;
  }
  return lowest;
}

/** What the pack's oldest version reads (a pack for 1.7.10-26.3 can only use what 1.7.10 has). */
export const packAnimRules = (project: Pick<TexturePackProject, 'version' | 'compat'>): JavaAnimRules => javaAnimRules(lowestJavaVersion(project));

// ---------------------------------------------------------------------------------------------
// Java .mcmeta

/** Frame count of an image cut as an animation describes. */
export function frameCount(anim: Pick<TextureAnimation, 'frameWidth' | 'frameHeight'>, w: number, h: number): number {
  if (anim.frameWidth < 1 || anim.frameHeight < 1 || w % anim.frameWidth || h % anim.frameHeight) return 0;
  return (w / anim.frameWidth) * (h / anim.frameHeight);
}

/**
 * The "animation" section for an image of w x h. Width and height are only written when the game
 * wouldn't find the frames on its own (frames that aren't squares of the short side).
 */
export function animationSection(anim: TextureAnimation, w: number, h: number, rules: JavaAnimRules): Record<string, unknown> {
  const count = Math.max(1, frameCount(anim, w, h));
  const out: Record<string, unknown> = {};
  if (anim.interpolate && rules.interpolate) out.interpolate = true;
  const square = anim.frameWidth === anim.frameHeight && anim.frameWidth === Math.min(w, h);
  if (!square && rules.layout) {
    out.width = anim.frameWidth;
    out.height = anim.frameHeight;
  }
  const ft = clampTicks(anim.frametime);
  if (ft !== 1) out.frametime = ft;
  const frames = normalizeFrames(anim.frames, ft, count);
  if (frames) out.frames = frames.map((s) => (s.time !== undefined ? { index: s.index, time: s.time } : s.index));
  return out;
}

/**
 * A texture's .mcmeta with its animation: the other sections of `base` (the pack's or the game's
 * file: GUI scaling, texture blur, villager hats) are kept, since the pack's file replaces the game's.
 */
export function animationMcmeta(anim: TextureAnimation, base: string | null, w: number, h: number, rules: JavaAnimRules): string {
  const parsed = base ? parseJsonLoose(base) : null;
  const json: Record<string, unknown> = isObj(parsed) ? { ...parsed } : {};
  delete json.animation;
  return stringifyPretty({ animation: animationSection(anim, w, h, rules), ...json });
}

/** Things a version can't do with this animation (for the export's warnings). */
export function javaAnimLosses(anim: TextureAnimation, w: number, rules: JavaAnimRules): ('interpolate' | 'size')[] {
  const out: ('interpolate' | 'size')[] = [];
  if (anim.interpolate && !rules.interpolate) out.push('interpolate');
  if (!rules.layout && (anim.frameWidth !== anim.frameHeight || anim.frameWidth !== w)) out.push('size');
  return out;
}

/** An animation as a .mcmeta describes it, for an image of w x h (null: no animation, or frames that don't fit). */
export function animationFromMcmeta(text: string, w: number, h: number, scale = 1): Omit<TextureAnimation, 'updatedAt'> | null {
  const json = parseJsonLoose(text);
  const a = isObj(json) ? json.animation : undefined;
  if (!isObj(a)) return null;
  const fwRaw = posInt(a.width);
  const fhRaw = posInt(a.height);
  const fw = fwRaw ? Math.round(fwRaw * scale) : undefined;
  const fh = fhRaw ? Math.round(fhRaw * scale) : undefined;
  let frameWidth: number;
  let frameHeight: number;
  if (fw) [frameWidth, frameHeight] = [fw, fh ?? h];
  else if (fh) [frameWidth, frameHeight] = [w, fh];
  else frameWidth = frameHeight = Math.min(w, h);
  if (!frameWidth || !frameHeight || w % frameWidth || h % frameHeight) return null;
  const count = (w / frameWidth) * (h / frameHeight);
  const frametime = clampTicks(posInt(a.frametime) ?? 1);
  const list: AnimationStep[] | undefined = Array.isArray(a.frames)
    ? a.frames.flatMap((f): AnimationStep[] => {
        if (typeof f === 'number') return [{ index: Math.floor(f) }];
        if (!isObj(f) || typeof f.index !== 'number') return [];
        const time = posInt(f.time);
        return [time ? { index: Math.floor(f.index), time } : { index: Math.floor(f.index) }];
      })
    : undefined;
  const frames = normalizeFrames(list, frametime, count);
  return { frameWidth, frameHeight, frametime, ...(frames ? { frames } : {}), ...(a.interpolate === true ? { interpolate: true } : {}) };
}

// ---------------------------------------------------------------------------------------------
// Bedrock flipbooks

export interface FlipbookEntry {
  flipbook_texture: string;
  atlas_tile: string;
  atlas_index?: number;
  atlas_tile_variant?: number;
  ticks_per_frame?: number;
  frames?: number[];
  blend_frames?: boolean;
  replicate?: number;
  [k: string]: unknown;
}

const FLIPBOOK = 'textures/flipbook_textures.json';
export const FLIPBOOK_PATH = FLIPBOOK;
const stemOf = (p: string) => p.replace(/\.(png|tga)$/i, '');

export function parseFlipbooks(text: string | null | undefined): FlipbookEntry[] {
  const json = text ? parseJsonLoose(text) : null;
  if (!Array.isArray(json)) return [];
  return json.filter((e): e is FlipbookEntry => isObj(e) && typeof e.flipbook_texture === 'string' && typeof e.atlas_tile === 'string');
}

/** Where a texture is in terrain_texture.json: its tile name, and the place in the tile's list. */
export interface AtlasTile {
  tile: string;
  index?: number;
  variant?: number;
}

/** The terrain atlas tiles that show a texture (path without extension, e.g. 'textures/blocks/magma'). */
export function terrainTilesOf(terrain: unknown, stem: string): AtlasTile[] {
  const data = isObj(terrain) && isObj(terrain.texture_data) ? terrain.texture_data : null;
  if (!data) return [];
  const pathOf = (v: unknown): string | null => (typeof v === 'string' ? v : isObj(v) && typeof v.path === 'string' ? v.path : null);
  const same = (v: unknown) => {
    const p = pathOf(v);
    return !!p && stemOf(p) === stem;
  };
  const out: AtlasTile[] = [];
  for (const [tile, entry] of Object.entries(data)) {
    const t = isObj(entry) ? entry.textures : undefined;
    if (Array.isArray(t)) {
      t.forEach((v, i) => {
        if (same(v)) out.push({ tile, index: i });
        const vars = isObj(v) && Array.isArray(v.variations) ? v.variations : null;
        vars?.forEach((x, j) => {
          if (same(x)) out.push({ tile, index: i, variant: j });
        });
      });
    } else if (same(t)) out.push({ tile });
    else if (isObj(t) && Array.isArray(t.variations)) t.variations.forEach((x, j) => same(x) && out.push({ tile, variant: j }));
  }
  return out;
}

/** terrain_texture.json of the pack over the game's (the pack's tiles win). */
export function mergeTerrain(game: unknown, pack: unknown): unknown {
  const g = isObj(game) && isObj(game.texture_data) ? game.texture_data : {};
  const p = isObj(pack) && isObj(pack.texture_data) ? pack.texture_data : {};
  return { texture_data: { ...g, ...p } };
}

/** An animation's timing on a flipbook entry (atlas fields and anything else on `base` kept). */
export function flipbookEntry(anim: TextureAnimation, stem: string, where: AtlasTile, count: number, base?: FlipbookEntry): FlipbookEntry {
  const { ticks, frames } = flipbookTiming(anim, count);
  const e: FlipbookEntry = { ...(base ?? {}), flipbook_texture: stem, atlas_tile: where.tile } as FlipbookEntry;
  if (!base) {
    if (where.index !== undefined && (where.index > 0 || where.variant !== undefined)) e.atlas_index = where.index;
    if (where.variant !== undefined) e.atlas_tile_variant = where.variant;
  }
  e.ticks_per_frame = ticks;
  if (frames) e.frames = frames;
  else delete e.frames;
  // Bedrock blends frames unless told not to
  if (anim.interpolate) delete e.blend_frames;
  else e.blend_frames = false;
  if (anim.replicate && anim.replicate > 1) e.replicate = anim.replicate;
  else delete e.replicate;
  return e;
}

/** The animation an entry gives a texture with `count` square frames. */
export function animationFromFlipbook(e: FlipbookEntry, frameSize: number, count: number): Omit<TextureAnimation, 'updatedAt'> {
  const timing = timingFromFlipbook(posInt(e.ticks_per_frame), Array.isArray(e.frames) ? e.frames : undefined, count);
  return {
    frameWidth: frameSize,
    frameHeight: frameSize,
    frametime: timing.frametime,
    ...(timing.frames ? { frames: timing.frames } : {}),
    ...(e.blend_frames !== false ? { interpolate: true } : {}),
    ...(posInt(e.replicate) && posInt(e.replicate)! > 1 ? { replicate: posInt(e.replicate) } : {}),
  };
}

const entryKey = (e: FlipbookEntry) => `${stemOf(e.flipbook_texture)}|${e.atlas_tile}|${e.atlas_index ?? ''}|${e.atlas_tile_variant ?? ''}`;

export interface OwnFlipbook {
  /** Texture path without extension */
  stem: string;
  anim: TextureAnimation;
  /** Frames in the texture as exported */
  count: number;
}

/**
 * The flipbook list to write: the game's entries, then the pack's own over them, then the editor's
 * animations (each replaces the entries of its texture, or gets new ones for the tiles that show it).
 * Textures no tile shows can't be animated and are returned in `unplaced`.
 */
export function mergeFlipbooks(game: readonly FlipbookEntry[], pack: readonly FlipbookEntry[] | null, own: readonly OwnFlipbook[], terrain: unknown): { entries: FlipbookEntry[]; unplaced: string[] } {
  const list: FlipbookEntry[] = [];
  const at = new Map<string, number>();
  const put = (e: FlipbookEntry) => {
    const k = entryKey(e);
    const i = at.get(k);
    if (i === undefined) {
      at.set(k, list.length);
      list.push(e);
    } else list[i] = e;
  };
  for (const e of game) put({ ...e });
  for (const e of pack ?? []) put({ ...e });
  const unplaced: string[] = [];
  for (const o of own) {
    const mine = list.filter((e) => stemOf(e.flipbook_texture) === o.stem);
    if (mine.length) {
      for (const e of mine) list[at.get(entryKey(e))!] = flipbookEntry(o.anim, e.flipbook_texture, { tile: e.atlas_tile }, o.count, e);
      continue;
    }
    const tiles = terrainTilesOf(terrain, o.stem);
    if (!tiles.length) {
      unplaced.push(o.stem);
      continue;
    }
    for (const w of tiles) put(flipbookEntry(o.anim, o.stem, w, o.count));
  }
  return { entries: list, unplaced };
}

/** Pretty flipbook JSON, one entry per block of lines (short frame lists on one line). */
export const flipbookJson = (entries: readonly FlipbookEntry[]): string => stringifyPretty(entries);

