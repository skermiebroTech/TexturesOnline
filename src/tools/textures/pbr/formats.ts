// The PBR file formats the Material tab writes and reads.
//
// Java, labPBR 1.3 (shaderLABS, https://shaderlabs.org/wiki/LabPBR_Material_Standard), read by PBR
// shaders in Iris and OptiFine; files next to the colour texture:
//   <name>_n.png  R, G: normal X, Y (DirectX: green 0 = up), B: ambient occlusion (255 = none),
//                 A: height (255 = the surface, 0 = 25 % deep; 1 at least, 0 confuses some shaders)
//   <name>_s.png  R: perceptual smoothness (1 - perceptual roughness), G: F0 0-229 (linear) or a metal
//                 230-254 (predefined) / 255 (albedo tinted), B: porosity 0-64 or subsurface 65-255,
//                 A: emission 0-254 (255 = none: an image without alpha must not glow)
// Bedrock, texture sets (https://learn.microsoft.com/minecraft/creator/reference/content/
// texturesetsreference/texturesetsconcepts/texturesetsintroduction), for Vibrant Visuals and RTX:
//   <name>.texture_set.json  "format_version" "1.16.100" (MER) or "1.21.30" (MERS, Vibrant Visuals),
//   "minecraft:texture_set": color (required), metalness_emissive_roughness or
//   metalness_emissive_roughness_subsurface (an image, a [0-255] array or "#RRGGBB" / "#AARRGGBB"),
//   normal or heightmap (never both). Layers name images in the same folder of the same pack.
// The normal maps of both editions use the DirectX convention (Mojang's vanilla texture sets and
// NVIDIA's RTX guide), so a normal map moves between them as it is.

import type { PbrValues } from '../../../core/types';
import { createImageData } from '../../../core/pixels';
import { decodeUnit, encodeUnit } from './material';

// ---------------------------------------------------------------------------------------------
// Java (labPBR)

export const LAB_SUFFIX = { normal: '_n', specular: '_s' } as const;
/** F0 of the non-metals (about 4 %: stone, wood, water) */
export const LAB_DIELECTRIC_F0 = 10;
/** labPBR green 255: a metal tinted by the colour texture */
export const LAB_ALBEDO_METAL = 255;
/** Metalness from which a pixel counts as metal in labPBR (it has metal or not, no in-between) */
const METAL_FROM = 128;

/** Pack paths of a colour texture's labPBR maps ('block/stone.png' -> 'block/stone_n.png', '_s.png'). */
export function labPaths(colourPath: string): { normal: string; specular: string } {
  const stem = colourPath.replace(/\.[^./]+$/, '');
  return { normal: `${stem}${LAB_SUFFIX.normal}.png`, specular: `${stem}${LAB_SUFFIX.specular}.png` };
}

/** The colour texture a labPBR map belongs to ('block/stone_n.png' -> 'block/stone.png'), or null. */
export function labColourPath(path: string): { colour: string; kind: 'normal' | 'specular' } | null {
  const m = /^(.+)_(n|s)\.png$/.exec(path);
  return m ? { colour: `${m[1]}.png`, kind: m[2] === 'n' ? 'normal' : 'specular' } : null;
}

/** labPBR _s from metal / glow / roughness / subsurface (RGBA = M, E, R, S). */
export function labSpecular(mers: ImageData): ImageData {
  const out = createImageData(mers.width, mers.height);
  const s = mers.data;
  const d = out.data;
  for (let i = 0; i < s.length; i += 4) {
    const metal = s[i] >= METAL_FROM;
    d[i] = 255 - s[i + 2];
    d[i + 1] = metal ? LAB_ALBEDO_METAL : LAB_DIELECTRIC_F0;
    // metals can't let light through (Bedrock's rule too: the larger of the two wins)
    d[i + 2] = !metal && s[i + 3] > 0 ? 65 + Math.round((s[i + 3] * 190) / 255) : 0;
    d[i + 3] = s[i + 1] > 0 ? Math.max(1, Math.round((s[i + 1] * 254) / 255)) : 255;
  }
  return out;
}

/** Metal / glow / roughness / subsurface from a labPBR _s (porosity and the exact F0 have no place in it). */
export function fromLabSpecular(spec: ImageData): ImageData {
  const out = createImageData(spec.width, spec.height);
  const s = spec.data;
  const d = out.data;
  for (let i = 0; i < s.length; i += 4) {
    d[i] = s[i + 1] >= 230 ? 255 : 0;
    d[i + 1] = s[i + 3] === 255 ? 0 : Math.min(255, Math.round((s[i + 3] * 255) / 254));
    d[i + 2] = 255 - s[i];
    d[i + 3] = s[i + 2] >= 65 ? Math.round(((s[i + 2] - 65) * 255) / 190) : 0;
  }
  return out;
}

/** labPBR _n as written (height kept at 1 or more). */
export function labNormal(normal: ImageData): ImageData {
  const out = createImageData(normal.width, normal.height, new Uint8ClampedArray(normal.data));
  for (let i = 3; i < out.data.length; i += 4) if (out.data[i] === 0) out.data[i] = 1;
  return out;
}

// ---------------------------------------------------------------------------------------------
// Bedrock (texture sets)

export const TEXTURE_SET_FORMAT = '1.16.100';
/** First format with metalness_emissive_roughness_subsurface (Vibrant Visuals) */
export const TEXTURE_SET_FORMAT_MERS = '1.21.30';
export const TEXTURE_SET_EXT = '.texture_set.json';
export const MER_KEY = 'metalness_emissive_roughness';
export const MERS_KEY = 'metalness_emissive_roughness_subsurface';

export interface TextureSetLayers {
  color?: string | number[];
  mer?: string | number[];
  mers?: string | number[];
  normal?: string;
  heightmap?: string | number[];
}

/** <name>.texture_set.json for a colour texture ('textures/blocks/stone.png' -> 'textures/blocks/stone.texture_set.json'). */
export const textureSetPath = (colourPath: string): string => `${colourPath.replace(/\.[^./]+$/, '')}${TEXTURE_SET_EXT}`;

/** Bedrock RGB normal map (Z rebuilt from X and Y, alpha opaque) from a labPBR-layout normal map. */
export function bedrockNormal(lab: ImageData): ImageData {
  const out = createImageData(lab.width, lab.height);
  const s = lab.data;
  const d = out.data;
  for (let i = 0; i < s.length; i += 4) {
    const x = decodeUnit(s[i]);
    const y = decodeUnit(s[i + 1]);
    d[i] = s[i];
    d[i + 1] = s[i + 1];
    d[i + 2] = encodeUnit(Math.sqrt(Math.max(0, 1 - x * x - y * y)));
    d[i + 3] = 255;
  }
  return out;
}

/** labPBR-layout normal map (no occlusion, height unknown: the surface) from a Bedrock normal map. */
export function fromBedrockNormal(img: ImageData): ImageData {
  const out = createImageData(img.width, img.height);
  const s = img.data;
  const d = out.data;
  for (let i = 0; i < s.length; i += 4) {
    d[i] = s[i];
    d[i + 1] = s[i + 1];
    d[i + 2] = 255;
    d[i + 3] = 255;
  }
  return out;
}

/** Metal / glow / roughness / subsurface from a Bedrock MER (no subsurface) or MERS image. */
export function fromBedrockMers(img: ImageData, layout: 'mer' | 'mers'): ImageData {
  if (layout === 'mers') return createImageData(img.width, img.height, new Uint8ClampedArray(img.data));
  const out = createImageData(img.width, img.height, new Uint8ClampedArray(img.data));
  for (let i = 3; i < out.data.length; i += 4) out.data[i] = 0;
  return out;
}

/**
 * Reads a texture set. Values are the layers as written (image names, or uniform values as arrays:
 * hex strings are turned into arrays, "#AARRGGBB" in RGBA order). null when it isn't a texture set.
 */
export function parseTextureSet(text: string | unknown): { formatVersion: string; layers: TextureSetLayers } | null {
  let json: unknown = text;
  if (typeof text === 'string') {
    try {
      json = JSON.parse(text.replace(/^﻿/, ''));
    } catch {
      return null;
    }
  }
  const set = json && typeof json === 'object' ? (json as Record<string, unknown>)['minecraft:texture_set'] : null;
  if (!set || typeof set !== 'object') return null;
  const o = set as Record<string, unknown>;
  const layer = (v: unknown, channels: number): string | number[] | undefined => {
    if (typeof v === 'string') {
      const hex = /^#?([0-9a-f]{2}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(v.trim());
      // names are plain words; a 6 / 8 digit hex with '#' is a value ("#FBA34C")
      if (hex && (v.trim().startsWith('#') || channels === 1)) return hexValues(hex[1]);
      return v.trim() || undefined;
    }
    if (typeof v === 'number' && Number.isFinite(v)) return [clamp255(v)];
    if (Array.isArray(v) && v.length && v.every((x) => typeof x === 'number' && Number.isFinite(x))) return v.map(clamp255);
    return undefined;
  };
  const layers: TextureSetLayers = {};
  const color = layer(o.color, 4);
  const mer = layer(o[MER_KEY], 3);
  const mers = layer(o[MERS_KEY], 4);
  const normal = layer(o.normal, 3);
  const height = layer(o.heightmap, 1);
  if (color !== undefined) layers.color = color;
  if (mer !== undefined) layers.mer = mer;
  if (mers !== undefined) layers.mers = mers;
  if (typeof normal === 'string') layers.normal = normal;
  if (height !== undefined) layers.heightmap = height;
  const fv = (json as Record<string, unknown>).format_version;
  return { formatVersion: typeof fv === 'string' ? fv : TEXTURE_SET_FORMAT, layers };
}

const clamp255 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

function hexValues(hex: string): number[] {
  const bytes = hex.match(/../g)!.map((b) => parseInt(b, 16));
  // ARGB for four channels
  return bytes.length === 4 ? [bytes[1], bytes[2], bytes[3], bytes[0]] : bytes;
}

/**
 * A texture set's JSON. `mers` is an image name or uniform values: three values (no subsurface) are
 * written as MER, four as MERS (which needs format 1.21.30 and Vibrant Visuals).
 */
export function buildTextureSet(o: { color: string; mers?: string | PbrValues | [number, number, number]; subsurface?: boolean; normal?: string }): string {
  const set: Record<string, unknown> = { color: o.color };
  let mersLayer = false;
  if (o.mers !== undefined) {
    const asMers = typeof o.mers === 'string' ? !!o.subsurface : o.mers.length === 4;
    mersLayer = asMers;
    set[asMers ? MERS_KEY : MER_KEY] = o.mers;
  }
  if (o.normal) set.normal = o.normal;
  const json = { format_version: mersLayer ? TEXTURE_SET_FORMAT_MERS : TEXTURE_SET_FORMAT, 'minecraft:texture_set': set };
  // number arrays on one line, like Mojang's files
  return JSON.stringify(json, null, 2).replace(/\[\s*([\d,\s]+?)\s*\]/g, (_m, inner: string) => `[${inner.trim().split(/\s*,\s*/).join(', ')}]`) + '\n';
}

/** Layer image names for a colour texture: '<name>_mer(s)', '<name>_normal', unless a texture already has that name. */
export function layerNames(colourPath: string, taken: (stem: string) => boolean): { mer: string; mers: string; normal: string } {
  const stem = colourPath.replace(/\.[^./]+$/, '');
  const name = stem.slice(stem.lastIndexOf('/') + 1);
  const dir = stem.slice(0, stem.lastIndexOf('/') + 1);
  const pick = (suffix: string) => {
    // vanilla has colour textures such as piston_top_normal.png: never write over one
    let n = `${name}${suffix}`;
    for (let i = 2; taken(`${dir}${n}`); i++) n = `${name}_pbr${i > 2 ? i - 1 : ''}${suffix}`;
    return n;
  };
  return { mer: pick('_mer'), mers: pick('_mers'), normal: pick('_normal') };
}

/** Images a texture set's layers name, as pack paths without extension (in the set's folder). */
export function layerStems(setPath: string, layers: TextureSetLayers): { color?: string; mer?: string; mers?: string; normal?: string; heightmap?: string } {
  const dir = setPath.slice(0, setPath.lastIndexOf('/') + 1);
  const out: { color?: string; mer?: string; mers?: string; normal?: string; heightmap?: string } = {};
  for (const k of ['color', 'mer', 'mers', 'normal', 'heightmap'] as const) {
    const v = layers[k];
    if (typeof v === 'string' && /^[\w.\- ]+$/.test(v)) out[k] = `${dir}${v}`;
  }
  return out;
}
