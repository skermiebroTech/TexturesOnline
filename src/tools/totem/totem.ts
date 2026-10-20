// Custom Totem of Undying: turns a player skin into the 16x16 totem item texture and packs it (pack.ts) as a
// Java resource pack (.zip) or a Bedrock resource pack (.mcpack). Pure apart from Blob/zip output:
// no DOM, so the mapping is unit tested in Node.
//
// The layouts are drawn on the shape of the vanilla totem (Java 1.14+ / Bedrock): a head box at
// columns 4-11, rows 1-8, wings across rows 8-10, the body below and a narrowing foot. The vanilla
// texture itself is only read at runtime (from the game files the browser downloads) to keep its
// gold outline or wings, never stored in this repository.

import type { Edition, SkinModel } from '../../core/types';
import { convertLegacySkin, createImageData, resizeNearest } from '../../core/pixels';
import { compareJavaVersions } from '../convert/paths';
import { detectSlim, faceRect, type SkinPart } from '../skins/templates';

export const TOTEM_SIZE = 16;
/** Totems of Undying were added in Java 1.11 (Bedrock 1.0). */
export const FIRST_TOTEM_VERSION = '1.11';
/** 1.13 renamed the item textures (items/totem.png -> item/totem_of_undying.png). */
export const FLATTENING_VERSION = '1.13';
export const JAVA_TOTEM_PATH = 'assets/minecraft/textures/item/totem_of_undying.png';
export const JAVA_LEGACY_TOTEM_PATH = 'assets/minecraft/textures/items/totem.png';
export const BEDROCK_TOTEM_PATH = 'textures/items/totem.png';
export const JAVA_ICON_SIZE = 128;
export const BEDROCK_ICON_SIZE = 256;

export type TotemStyle = 'classic' | 'bighead' | 'fullbody';

export interface TotemOptions {
  style: TotemStyle;
  /** Draw the outer layer (hat, jacket, sleeves, trousers) over the base layer */
  outer: boolean;
  /** Keep the vanilla totem's outline pixels (the figure is trimmed to the totem's shape) */
  outline: boolean;
  /** Keep the vanilla totem wherever the figure leaves the totem's shape empty (wing tips...) */
  wings: boolean;
}

export const DEFAULT_OPTIONS: TotemOptions = { style: 'classic', outer: true, outline: false, wings: false };

export interface StyleInfo {
  id: TotemStyle;
  name: string;
  description: string;
}

export const STYLES: readonly StyleInfo[] = [
  { id: 'classic', name: 'Classic', description: 'Full-size face on top, arms spread like the totem’s wings, body and legs below.' },
  { id: 'bighead', name: 'Big head', description: 'An oversized head with a small body under it.' },
  { id: 'fullbody', name: 'Full body', description: 'The whole player standing, arms down, so the outfit shows.' },
];

/** Where one body part goes: its front face is resampled into this rectangle of the 16x16 item. */
interface Placement {
  part: SkinPart;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Arms held out sideways: 'cw' for the right arm (pointing left), 'ccw' for the left arm. */
  rotate?: 'cw' | 'ccw';
}

/** Drawn in order: later parts cover earlier ones. */
export const LAYOUTS: Record<TotemStyle, readonly Placement[]> = {
  classic: [
    { part: 'rightArm', x: 1, y: 9, w: 3, h: 2, rotate: 'cw' },
    { part: 'leftArm', x: 12, y: 9, w: 3, h: 2, rotate: 'ccw' },
    { part: 'body', x: 4, y: 9, w: 8, h: 4 },
    { part: 'rightLeg', x: 4, y: 13, w: 4, h: 3 },
    { part: 'leftLeg', x: 8, y: 13, w: 4, h: 3 },
    { part: 'head', x: 4, y: 1, w: 8, h: 8 },
  ],
  bighead: [
    { part: 'rightArm', x: 3, y: 10, w: 2, h: 3 },
    { part: 'leftArm', x: 11, y: 10, w: 2, h: 3 },
    { part: 'body', x: 5, y: 10, w: 6, h: 3 },
    { part: 'rightLeg', x: 5, y: 13, w: 3, h: 3 },
    { part: 'leftLeg', x: 8, y: 13, w: 3, h: 3 },
    { part: 'head', x: 3, y: 0, w: 10, h: 10 },
  ],
  fullbody: [
    { part: 'rightArm', x: 3, y: 6, w: 2, h: 5 },
    { part: 'leftArm', x: 11, y: 6, w: 2, h: 5 },
    { part: 'body', x: 5, y: 6, w: 6, h: 5 },
    { part: 'rightLeg', x: 5, y: 11, w: 3, h: 5 },
    { part: 'leftLeg', x: 8, y: 11, w: 3, h: 5 },
    { part: 'head', x: 5, y: 0, w: 6, h: 6 },
  ],
};

// ---------------------------------------------------------------------------------------------
// Skin -> figure

/** A 64x64 skin from a 64x64, legacy 64x32 or HD 128x128 image. */
export function normalizeTotemSkin(img: ImageData): ImageData {
  if (img.width === 64 && (img.height === 64 || img.height === 32)) return convertLegacySkin(img, { forceOpaqueBase: false });
  if (img.width === 128 && img.height === 128) return resizeNearest(img, 64, 64);
  throw new Error(`Skins are 64×64 pixels (or the old 64×32); this image is ${img.width}×${img.height}.`);
}

/**
 * Index of the source pixel for destination pixel i when n pixels are made from m: the first and
 * last pixels are kept and the rest spread evenly, so 8 -> 6 keeps the eyes of a face (drops
 * columns 2 and 5) and 12 -> 3 keeps the top, the middle and the foot of a leg.
 */
export function sampleIndex(i: number, n: number, m: number): number {
  if (n <= 1) return Math.floor((m - 1) / 2);
  return Math.round((i * (m - 1)) / (n - 1));
}

function over(dst: Uint8ClampedArray, o: number, src: Uint8ClampedArray, s: number): void {
  const sa = src[s + 3];
  if (!sa) return;
  if (sa === 255 || !dst[o + 3]) {
    dst[o] = src[s];
    dst[o + 1] = src[s + 1];
    dst[o + 2] = src[s + 2];
    dst[o + 3] = sa;
    return;
  }
  const a = sa / 255;
  const da = dst[o + 3] / 255;
  const outA = a + da * (1 - a);
  for (let c = 0; c < 3; c++) dst[o + c] = Math.round((src[s + c] * a + dst[o + c] * da * (1 - a)) / outA);
  dst[o + 3] = Math.round(outA * 255);
}

/** The player figure of a style on a transparent 16x16 image (no vanilla pixels). */
export function renderFigure(skinImage: ImageData, style: TotemStyle, opts: { outer?: boolean; model?: SkinModel } = {}): ImageData {
  const skin = normalizeTotemSkin(skinImage);
  const model: SkinModel = opts.model ?? (detectSlim(skin) ? 'slim' : 'classic');
  const outer = opts.outer ?? true;
  const out = createImageData(TOTEM_SIZE, TOTEM_SIZE);
  const src = skin.data;
  for (const p of LAYOUTS[style]) {
    const layers = [faceRect(p.part, 'front', 'base', model), outer ? faceRect(p.part, 'front', 'outer', model) : null];
    for (const r of layers) {
      if (!r) continue;
      // Size of the face as it is drawn (arms held out are turned a quarter)
      const rw = p.rotate ? r.h : r.w;
      const rh = p.rotate ? r.w : r.h;
      for (let y = 0; y < p.h; y++) {
        const ry = sampleIndex(y, p.h, rh);
        for (let x = 0; x < p.w; x++) {
          const rx = sampleIndex(x, p.w, rw);
          let sx: number;
          let sy: number;
          if (p.rotate === 'cw') {
            sx = ry;
            sy = r.h - 1 - rx;
          } else if (p.rotate === 'ccw') {
            sx = r.w - 1 - ry;
            sy = rx;
          } else {
            sx = rx;
            sy = ry;
          }
          const dx = p.x + x;
          const dy = p.y + y;
          if (dx < 0 || dy < 0 || dx >= TOTEM_SIZE || dy >= TOTEM_SIZE) continue;
          over(out.data, (dy * TOTEM_SIZE + dx) * 4, src, ((r.y + sy) * 64 + r.x + sx) * 4);
        }
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// The vanilla totem

export interface TotemShape {
  /** The vanilla texture at 16x16 */
  image: ImageData;
  /** 1 where the vanilla totem has a pixel */
  mask: Uint8Array;
  /** 1 on its outline: pixels next to a see-through pixel or the edge (4 neighbours) */
  outline: Uint8Array;
}

/** Silhouette and outline of a vanilla totem texture (any size; read at 16x16). */
export function totemShape(vanilla: ImageData): TotemShape {
  const N = TOTEM_SIZE;
  let image = vanilla;
  // An animated strip keeps its first frame; HD textures are read at 16x16.
  if (image.height > image.width) image = cropTop(image);
  if (image.width !== N || image.height !== N) image = resizeNearest(image, N, N);
  const mask = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i++) mask[i] = image.data[i * 4 + 3] > 0 ? 1 : 0;
  const outline = new Uint8Array(N * N);
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < N && y < N && mask[y * N + x] === 1;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) if (mask[y * N + x] && (!solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1))) outline[y * N + x] = 1;
  return { image, mask, outline };
}

function cropTop(img: ImageData): ImageData {
  const s = img.width;
  return createImageData(s, s, new Uint8ClampedArray(img.data.subarray(0, s * s * 4)));
}

/**
 * The totem texture: the figure of the chosen style, optionally on the vanilla totem (wings) and
 * inside its outline. Without `shape` (game files not loaded) the figure is returned on its own.
 */
export function makeTotem(skinImage: ImageData, opts: TotemOptions, shape: TotemShape | null = null, model?: SkinModel): ImageData {
  const fig = renderFigure(skinImage, opts.style, { outer: opts.outer, model });
  if (!shape || (!opts.outline && !opts.wings)) return fig;
  const N = TOTEM_SIZE;
  const out = createImageData(N, N);
  const v = shape.image.data;
  for (let i = 0; i < N * N; i++) {
    const o = i * 4;
    if (opts.wings && shape.mask[i]) over(out.data, o, v, o);
    if (opts.outline && !shape.mask[i]) continue;
    over(out.data, o, fig.data, o);
  }
  if (opts.outline) {
    for (let i = 0; i < N * N; i++) {
      if (!shape.outline[i]) continue;
      out.data.set(v.subarray(i * 4, i * 4 + 4), i * 4);
    }
  }
  return out;
}

/** Nearest-neighbour upscale to a square icon (16 -> 128 or 256), centred on a transparent square. */
export function totemIcon(img: ImageData, size: number): ImageData {
  const k = Math.max(1, Math.floor(size / Math.max(img.width, img.height)));
  const out = createImageData(size, size);
  const ox = Math.floor((size - img.width * k) / 2);
  const oy = Math.floor((size - img.height * k) / 2);
  for (let y = 0; y < img.height * k; y++)
    for (let x = 0; x < img.width * k; x++) {
      const s = (Math.floor(y / k) * img.width + Math.floor(x / k)) * 4;
      out.data.set(img.data.subarray(s, s + 4), ((oy + y) * size + ox + x) * 4);
    }
  return out;
}

export function isBlank(img: ImageData): boolean {
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i]) return false;
  return true;
}

/** Distinct opaque colours of an image, most used first (at most `max`). */
export function imageColors(img: ImageData, max = 16): [number, number, number, number][] {
  const counts = new Map<number, number>();
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    const key = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, max)
    .map(([k]) => [(k >> 16) & 255, (k >> 8) & 255, k & 255, 255] as [number, number, number, number]);
}

// ---------------------------------------------------------------------------------------------
// The totem pop (in-game preview)

/** Item activation curve from the game: f in 0..1 -> eased progress (0 at start, ~1.4 at the end). */
export function activationCurve(f: number): number {
  const f2 = f * f;
  const f3 = f2 * f;
  return 10.25 * f3 * f2 - 24.95 * f2 * f2 + 25.5 * f3 - 13.8 * f2 + 4.4 * f;
}

/**
 * Apparent size (relative to the item's size at distance 1), spin (the item's width factor, -1..1)
 * and tilt of the item at time f (0..1 of the animation).
 */
export function popFrame(f: number): { scale: number; spin: number; tilt: number } {
  const a = activationCurve(f) * Math.PI;
  const z = 10 - 9 * Math.sin(a);
  const spin = Math.cos((900 * Math.abs(Math.sin(a)) * Math.PI) / 180);
  const tilt = (6 * Math.cos(f * 8) * Math.PI) / 180;
  return { scale: 1 / Math.max(1, z), spin, tilt };
}

// ---------------------------------------------------------------------------------------------
// Versions and paths

/** Last release before the totem (1.11 snapshots sort after it and count as having one). */
const LAST_WITHOUT_TOTEM = '1.10.2';
/** Last release with the old item texture names (1.13 snapshots sort after it). */
const LAST_OLD_NAMES = '1.12.2';

/** Java versions from 1.11 (and its snapshots) have the Totem of Undying. */
export function javaHasTotem(version: string): boolean {
  return compareJavaVersions(version, LAST_WITHOUT_TOTEM) > 0;
}

/**
 * Texture path for a Java version: items/totem.png up to 1.12.2, item/totem_of_undying.png from
 * 1.13 (and its snapshots; the game files, when loaded, decide for the very first ones).
 */
export function javaTotemPath(version: string): string {
  return compareJavaVersions(version, LAST_OLD_NAMES) > 0 ? JAVA_TOTEM_PATH : JAVA_LEGACY_TOTEM_PATH;
}

/**
 * The texture path to write. When the version's game files are known the file they contain wins
 * (snapshots around the 1.13 rename), otherwise the release rule above.
 */
export function totemTexturePath(edition: Edition, version: string, files?: { hasFile(path: string): boolean } | null): string {
  if (edition === 'bedrock') return BEDROCK_TOTEM_PATH;
  if (files) {
    if (files.hasFile(JAVA_TOTEM_PATH)) return JAVA_TOTEM_PATH;
    if (files.hasFile(JAVA_LEGACY_TOTEM_PATH)) return JAVA_LEGACY_TOTEM_PATH;
  }
  return javaTotemPath(version);
}

// ---------------------------------------------------------------------------------------------
// Packs

export interface TotemPackOptions {
  name: string;
  description?: string;
  edition: Edition;
  /** Java version id ('26.3', '1.12.2'); ignored for Bedrock */
  version: string;
  /** Texture path override (from the game files, see totemTexturePath) */
  path?: string;
  /** Bedrock: keep these uuids so a re-import replaces the pack; new ones when missing */
  uuids?: { header: string; module: string };
  /** Bedrock: the previous pack version (bumped) */
  packVersion?: [number, number, number];
}

export interface TotemPack {
  blob: Blob;
  filename: string;
  /** Paths inside the archive */
  files: string[];
  texturePath: string;
  uuids?: { header: string; module: string };
  packVersion?: [number, number, number];
}

export const DEFAULT_PACK_NAME = 'Custom Totem';

export function totemDescription(skinName: string | null | undefined): string {
  const who = (skinName ?? '').trim();
  return who ? `Totem of Undying that looks like ${who}` : 'A custom Totem of Undying';
}

/** Default pack name for a skin name: "Notch" -> "Notch Totem". */
export function defaultPackName(skinName: string | null | undefined): string {
  const who = (skinName ?? '')
    .replace(/['’]s skin$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
  return who ? `${who} Totem` : DEFAULT_PACK_NAME;
}
