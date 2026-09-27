// Which vanilla shader "family" a version belongs to, detected from the version's own shader
// sources, plus a pack-format based summary the UI can use before any game files are loaded.

import type { PackFormat } from '../../../core/types';
import { CORE, INCLUDE, expandForAnalysis, mentions } from './glsl';

/** Asset prefixes the view must read from the version's jar and pass as `sources`. */
export const shaderSourcePrefixes: readonly string[] = ['assets/minecraft/shaders/', 'assets/minecraft/post_effect/'];

export type ImportSyntax = 'include' | 'moj_ns' | 'moj';
export type FogApi = 'v1' | 'v2';

/**
 * F1  1.17 – 1.21.1   program JSON, plain uniforms, `#moj_import <x.glsl>`
 * F2  1.21.2 – 1.21.4 program JSON v2, `#moj_import <minecraft:x.glsl>`
 * F3  1.21.5          no program JSON, plain uniforms
 * F4  1.21.6 – 26.2   std140 uniform blocks (GL: matched by name)
 * F6  26.3+           `#include`, explicit locations, shaderc; always-on end_of_frame post effect
 */
export type FamilyId = 'F1' | 'F2' | 'F3' | 'F4' | 'F6';

export interface Family {
  id: FamilyId;
  json: boolean;
  import: ImportSyntax;
  ubo: boolean;
  explicitLocations: boolean;
  fogApi: FogApi | null;
  /** Full-screen `post_effect/end_of_frame.json` is honoured (26.3+) */
  endOfFrame: boolean;
  /** Major resource pack format (0 when unknown) */
  packFormat: number;
}

const RE_INCLUDE = /^[ \t]*#[ \t]*include[ \t]*[<"]/m;
const RE_MOJ_NS = /#[ \t]*moj_import[ \t]*<[ \t]*minecraft:/;
const RE_UBO = /layout\s*\(\s*std140\s*\)\s*uniform\s+\w+/;
const RE_LOC_OUT = /layout\s*\(\s*location\s*=\s*\d+\s*\)\s*out\b/;

/** First pack format that ships the always-on end_of_frame post effect hook (26.3). */
export const END_OF_FRAME_FORMAT = 97;

export function majorFormat(pf: PackFormat | number | null | undefined): number {
  if (pf == null) return 0;
  const n = typeof pf === 'number' ? pf : pf.major;
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}

/** Detects the shader family from the sources themselves; null when there are no core shaders (≤ 1.16.5). */
export function detectFamily(sources: Record<string, string>, packFormat: PackFormat | number | null | undefined): Family | null {
  const coreKeys = Object.keys(sources).filter((k) => k.startsWith(CORE));
  const shaderText = coreKeys.filter((k) => k.endsWith('.vsh') || k.endsWith('.fsh')).map((k) => sources[k]).join('\n');
  if (!shaderText.trim()) return null;
  const fog = sources[`${INCLUDE}fog.glsl`] ?? '';
  const json = coreKeys.some((k) => k.endsWith('.json'));
  const imp: ImportSyntax = RE_INCLUDE.test(shaderText) ? 'include' : RE_MOJ_NS.test(shaderText) ? 'moj_ns' : 'moj';
  const ubo = RE_UBO.test(shaderText + '\n' + fog);
  const explicitLocations = RE_LOC_OUT.test(shaderText);
  const fogApi: FogApi | null = /\bapply_fog\s*\(/.test(fog) ? 'v2' : /\blinear_fog\s*\(/.test(fog) ? 'v1' : null;
  const pf = majorFormat(packFormat);
  // #include and end_of_frame arrived in the same release; an unknown format is trusted to the sources.
  const endOfFrame = imp === 'include' && (pf === 0 || pf >= END_OF_FRAME_FORMAT);
  const id: FamilyId = imp === 'include' ? 'F6' : ubo ? 'F4' : json ? (imp === 'moj_ns' ? 'F2' : 'F1') : 'F3';
  return { id, json, import: imp, ubo, explicitLocations, fogApi, endOfFrame, packFormat: pf };
}

export function importLine(fam: Family, file: string): string {
  if (fam.import === 'include') return `#include <minecraft:${file}>`;
  if (fam.import === 'moj_ns') return `#moj_import <minecraft:${file}>`;
  return `#moj_import <${file}>`;
}

/** Terrain vertex shader that carries plant geometry, or null when waving cannot be done safely. */
export function wavingTarget(sources: Record<string, string>, fam: Family): { path: string; mode: 'F1' | 'F2' | 'F4' } | { reason: string } {
  const pf = fam.packFormat;
  if (fam.id === 'F3' || pf === 55) return { reason: 'Java 1.21.5 does not give the terrain shader a game time, so plants cannot move.' };
  if (fam.id === 'F6' || pf >= 75) {
    return {
      reason: 'From Java 1.21.11 on, plants share one render layer with grass blocks and leaves' +
        (pf >= 84 || fam.id === 'F6' ? ' and vertex order is no longer predictable' : '') +
        ', so waving would bend whole blocks.',
    };
  }
  if (fam.json && !fam.ubo) {
    const f1 = `${CORE}rendertype_cutout.vsh`;
    const f2 = `${CORE}terrain.vsh`;
    if (fam.id === 'F1' && sources[f1] !== undefined) return { path: f1, mode: 'F1' };
    if (sources[f2] !== undefined) return { path: f2, mode: 'F2' };
    if (sources[f1] !== undefined) return { path: f1, mode: 'F1' };
    return { reason: 'This version has no recognisable terrain vertex shader.' };
  }
  if (fam.ubo) {
    const path = `${CORE}terrain.vsh`;
    const code = sources[path];
    if (code === undefined) return { reason: 'This version has no terrain vertex shader.' };
    const expanded = expandForAnalysis(code, sources, path);
    // 1.21.11+ merged the cutout layers (chunk sections are drawn through ChunkSection).
    if (mentions(expanded, 'ChunkSection') || mentions(expanded, 'ChunkPosition')) {
      return { reason: 'In this version plants share one render layer with grass blocks and leaves, so waving would bend whole blocks.' };
    }
    return { path, mode: 'F4' };
  }
  return { reason: 'This version has no recognisable terrain vertex shader.' };
}

// ---------------------------------------------------------------- UI-facing summary

export type Feature = 'grading' | 'vignette' | 'bloom' | 'waving' | 'fog' | 'fogEnvironment' | 'nightDarkness';

export interface VanillaSupport {
  /** Core shaders exist, so a vanilla shader pack can be made for this version */
  supported: boolean;
  /** false when the version could not be placed (e.g. an unknown snapshot id); the result is then a best guess */
  known: boolean;
  packFormat: number | null;
  family: FamilyId | 'legacy' | null;
  features: Record<Feature, boolean>;
  /** Option key -> available for this version (unavailable controls should be greyed out) */
  options: Record<string, boolean>;
  /** Option key or feature -> why it is unavailable */
  reasons: Record<string, string>;
  notes: string[];
}

const FEATURE_OPTIONS: Record<Feature, string[]> = {
  grading: ['brightness', 'contrast', 'saturation', 'vibrance', 'gamma', 'temperature', 'tintColor', 'tintStrength', 'grayscale', 'sepia', 'posterize'],
  vignette: ['vignette'],
  bloom: ['bloom', 'bloomStrength', 'bloomThreshold'],
  waving: ['waving', 'waveAmount', 'waveSpeed'],
  fog: ['fogStart', 'fogTint', 'fogTintStrength'],
  fogEnvironment: ['fogEnvironment'],
  nightDarkness: ['nightDarkness'],
};

/** Shown when a 1.17+ version arrives without any shader files (the game files could not be read). */
export function missingSourcesMessage(versionId: string): string {
  const v = versionId?.trim() ? `Java ${versionId.trim()}` : 'this version';
  return `The shader files of ${v} could not be read, so nothing was changed. Load the game files again (or pick the client .jar again) and export once more.`;
}

export const NO_CORE_SHADERS_MESSAGE =
  'Vanilla shaders need Java Edition 1.17 or newer. Older versions have no core shaders a resource pack can change. Pick 1.17+ or use the Iris / OptiFine target instead.';

const FEATURE_REASONS: Record<Feature, string> = {
  grading: '',
  vignette: '',
  bloom: 'Bloom needs Java 26.3 or newer (the first version with an always-on full-screen effect).',
  waving: 'Waving plants work in Java 1.17 – 1.21.4 and 1.21.6 – 1.21.10.',
  fog: '',
  fogEnvironment: 'Separate water and weather fog exists from Java 1.21.6 on.',
  nightDarkness: 'The light map became a shader in Java 1.21.2.',
};

function familyForFormat(pf: number): FamilyId | 'legacy' {
  if (pf < 7) return 'legacy';
  if (pf <= 34) return 'F1';
  if (pf <= 46) return 'F2';
  if (pf <= 55) return 'F3';
  if (pf < END_OF_FRAME_FORMAT) return 'F4';
  return 'F6';
}

function summarize(pf: number, known: boolean): VanillaSupport {
  const family = familyForFormat(pf);
  const supported = family !== 'legacy';
  const wavingOk = supported && ((pf >= 7 && pf <= 46) || (pf >= 63 && pf <= 69));
  const features: Record<Feature, boolean> = {
    grading: supported,
    vignette: supported,
    bloom: supported && pf >= END_OF_FRAME_FORMAT,
    waving: wavingOk,
    fog: supported,
    fogEnvironment: supported && pf >= 63,
    nightDarkness: supported && pf >= 42,
  };
  const options: Record<string, boolean> = {};
  const reasons: Record<string, string> = {};
  for (const [feature, keys] of Object.entries(FEATURE_OPTIONS) as [Feature, string[]][]) {
    for (const k of keys) options[k] = features[feature];
    if (!features[feature]) {
      const why = supported ? FEATURE_REASONS[feature] : NO_CORE_SHADERS_MESSAGE;
      reasons[feature] = why;
      for (const k of keys) reasons[k] = why;
    }
  }
  const notes: string[] = [];
  if (!supported) notes.push(NO_CORE_SHADERS_MESSAGE);
  else {
    notes.push('The pack only works in the exact version it was made for. Shaders change between versions, so make a new pack for each version.');
    if (family !== 'F6') {
      notes.push('Colors are adjusted per object (world, sky, hand and entities) rather than on the finished image. Menus, the hotbar and items in the inventory keep their normal look.');
    } else {
      notes.push('Colors, vignette and bloom run on the finished image before menus and the hotbar are drawn, so the interface keeps its normal look.');
    }
  }
  if (!known) notes.push('This version could not be identified exactly; availability is checked again when its game files load.');
  return { supported, known, packFormat: pf || null, family, features, options, reasons, notes };
}

/**
 * Weekly snapshots ('21w10a'): the release each run of snapshots led up to, as [year, first week,
 * representative pack format]. Core shaders arrived in 21w10a; earlier ids have none.
 */
const WEEKLY_SNAPSHOTS: readonly [number, number, number][] = [
  [21, 10, 7], [21, 37, 8], [22, 3, 8], [22, 11, 9], [22, 42, 12], [23, 3, 13], [23, 12, 15], [23, 31, 18],
  [23, 40, 22], [24, 3, 32], [24, 18, 34], [24, 33, 42], [24, 44, 46], [25, 2, 55], [25, 15, 63], [25, 31, 69],
  [25, 41, 75],
];

/** Approximate pack format of a weekly snapshot id (also April Fools ids like '24w14potato'); 1 before 21w10a. */
function packFormatFromWeekly(id: string): number | null {
  const m = /^(\d\d)w(\d\d)[a-z]/i.exec(id.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  let pf = 1;
  for (const [y, w, f] of WEEKLY_SNAPSHOTS) if (year > y || (year === y && week >= w)) pf = f;
  return pf;
}

function packFormatFromId(id: string): number | null {
  const s = id.trim();
  const rel = /^(\d+)\.(\d+)(?:\.(\d+))?(?:[-_ ](?:pre|rc|snapshot)[-_ ]?\d*)?$/i.exec(s);
  if (!rel) return null;
  const major = Number(rel[1]);
  const minor = Number(rel[2]);
  const patch = rel[3] ? Number(rel[3]) : 0;
  if (major === 1) {
    // Every release before 1.17 (1.0 – 1.16.5) has no core shaders.
    if (minor < 17) return 1;
    if (minor <= 17) return 7;
    if (minor === 18) return 8;
    if (minor === 19) return patch >= 4 ? 13 : patch === 3 ? 12 : 9;
    if (minor === 20) return patch >= 5 ? 32 : patch >= 3 ? 22 : patch === 2 ? 18 : 15;
    if (minor === 21) {
      const table = [34, 34, 42, 42, 46, 55, 63, 64, 64, 69, 69, 75];
      return patch < table.length ? table[patch] : 75;
    }
    return minor > 21 ? END_OF_FRAME_FORMAT : null;
  }
  if (major === 26) {
    if (minor <= 1) return 84;
    if (minor === 2) return 88;
    return END_OF_FRAME_FORMAT + (minor - 3);
  }
  return major > 26 ? END_OF_FRAME_FORMAT : null;
}

/**
 * Which effects work for a version, without loading any game files. Pass the resource pack format
 * when known (most precise) or a Java version id such as '1.21.4' or '26.3'. The generator itself
 * decides from the real shader sources, so treat this as a hint for greying out controls.
 */
export function supportedFor(target: PackFormat | number | string): VanillaSupport {
  if (typeof target === 'string') {
    const pf = packFormatFromId(target);
    if (pf !== null) return summarize(pf, true);
    // Weekly snapshots are placed by date: close, but their shaders may differ from the release.
    const weekly = packFormatFromWeekly(target);
    return summarize(weekly ?? END_OF_FRAME_FORMAT, false);
  }
  const pf = majorFormat(target);
  if (pf === 0) return summarize(END_OF_FRAME_FORMAT, false);
  return summarize(pf, true);
}

/** Exact availability once the version's shader sources are loaded. */
export function supportFromSources(sources: Record<string, string>, packFormat: PackFormat | number | null | undefined): VanillaSupport {
  const fam = detectFamily(sources, packFormat);
  if (!fam) return summarize(1, true);
  const base = summarize(fam.packFormat || (fam.id === 'F6' ? END_OF_FRAME_FORMAT : fam.id === 'F4' ? 63 : fam.id === 'F3' ? 55 : fam.id === 'F2' ? 42 : 7), fam.packFormat > 0);
  base.family = fam.id;
  const set = (feature: Feature, ok: boolean, reason: string): void => {
    base.features[feature] = ok;
    for (const k of FEATURE_OPTIONS[feature]) {
      base.options[k] = ok;
      if (ok) delete base.reasons[k];
      else base.reasons[k] = reason;
    }
    if (ok) delete base.reasons[feature];
    else base.reasons[feature] = reason;
  };
  set('bloom', fam.endOfFrame, FEATURE_REASONS.bloom);
  const wave = wavingTarget(sources, fam);
  set('waving', 'path' in wave, 'reason' in wave ? wave.reason : '');
  set('fog', fam.fogApi !== null, 'This version has an unfamiliar fog shader, so fog cannot be changed.');
  set('fogEnvironment', fam.fogApi === 'v2', FEATURE_REASONS.fogEnvironment);
  set('nightDarkness', sources[`${CORE}lightmap.fsh`] !== undefined, FEATURE_REASONS.nightDarkness);
  if (fam.id === 'F6' && !fam.endOfFrame) {
    const why = 'This snapshot uses the new shader compiler but has no full-screen effect hook yet, so colors cannot be changed safely.';
    set('grading', false, why);
    set('vignette', false, why);
  }
  return base;
}
