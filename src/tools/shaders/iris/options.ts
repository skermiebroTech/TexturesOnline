// Web UI options, presets and value normalisation for the Iris / OptiFine shader pack maker.
// Pure logic: safe to import in Node, workers and the browser.

import type { OptionDef, OptionValue, OptionValues } from '../../../core/types';

export const GROUPS = {
  lighting: 'Lighting',
  shadows: 'Shadows',
  sky: 'Sky & Fog',
  water: 'Water',
  waving: 'Waving',
  post: 'Post-processing',
  color: 'Color',
  performance: 'Performance',
} as const;

export type Tonemap = 'aces' | 'filmic' | 'reinhard' | 'none';
export type EffectQuality = 'low' | 'medium' | 'high' | 'ultra';
export const SHADOW_RESOLUTIONS = ['1024', '2048', '3072', '4096', '8192'] as const;
export type ShadowResolution = (typeof SHADOW_RESOLUTIONS)[number];

export const OPTIONS: OptionDef[] = [
  // ---- Lighting
  { key: 'sunStrength', label: 'Sunlight strength', group: GROUPS.lighting, type: 'range', default: 1, min: 0, max: 3, step: 0.05, unit: '×',
    description: 'How bright direct sunlight is. Shaded areas are not affected.' },
  { key: 'sunColor', label: 'Sunlight color', group: GROUPS.lighting, type: 'color', default: '#fff0d9',
    description: 'Color of sunlight during the day. Near sunrise and sunset it blends into the sunset color.' },
  { key: 'ambientStrength', label: 'Ambient light', group: GROUPS.lighting, type: 'range', default: 1, min: 0.25, max: 2, step: 0.05, unit: '×',
    description: 'Soft light from the sky that fills in shaded areas. Lower gives deeper, moodier shade.' },
  { key: 'nightBrightness', label: 'Night brightness', group: GROUPS.lighting, type: 'range', default: 0.3, min: 0, max: 1, step: 0.05,
    description: 'Moonlight and the lowest light level at night and in caves. 0 gives very dark nights.' },
  { key: 'torchColor', label: 'Torch light color', group: GROUPS.lighting, type: 'color', default: '#ffc27a',
    description: 'Color of the light from torches, lanterns, lava and other light sources.' },
  { key: 'torchStrength', label: 'Torch light strength', group: GROUPS.lighting, type: 'range', default: 1, min: 0, max: 3, step: 0.05, unit: '×',
    description: 'How bright light from torches and glowing blocks is, and how much the light sources themselves glow.' },
  { key: 'handLight', label: 'Handheld light', group: GROUPS.lighting, type: 'toggle', default: true,
    description: 'Holding a torch, lantern, glowstone or lava bucket lights up the area around you.' },

  // ---- Shadows
  { key: 'shadows', label: 'Shadows', group: GROUPS.shadows, type: 'toggle', default: true,
    description: 'Real shadows from the sun and moon. The biggest effect on frame rate: turn off on slow computers.' },
  { key: 'shadowBrightness', label: 'Shadow brightness', group: GROUPS.shadows, type: 'range', default: 0.25, min: 0, max: 1, step: 0.05, dependsOn: 'shadows',
    description: 'How much light still reaches shadowed spots. 0 gives deep, dark shadows.' },
  { key: 'shadowSoftness', label: 'Shadow softness', group: GROUPS.shadows, type: 'range', default: 1, min: 0, max: 4, step: 0.1, dependsOn: 'shadows',
    description: 'How blurry shadow edges are. 0 is sharp and crisp.' },
  { key: 'sunAngle', label: 'Sun path tilt', group: GROUPS.shadows, type: 'range', default: -30, min: -60, max: 60, step: 5, unit: '°',
    description: 'Tilts the path of the sun and moon so shadows fall at an angle, even at noon.' },
  { key: 'cloudShadows', label: 'Cloud shadows', group: GROUPS.shadows, type: 'toggle', default: false,
    description: 'Soft shadows of drifting clouds move across the landscape.' },

  // ---- Sky & Fog
  { key: 'skyColor', label: 'Daytime sky', group: GROUPS.sky, type: 'color', default: '#5b93e6',
    description: 'Color of the sky straight overhead during the day.' },
  { key: 'horizonColor', label: 'Horizon & haze', group: GROUPS.sky, type: 'color', default: '#b9d4f0',
    description: 'Color of the sky near the horizon and of distant fog during the day.' },
  { key: 'sunsetColor', label: 'Sunrise & sunset', group: GROUPS.sky, type: 'color', default: '#ff8a4a',
    description: 'Glow around the sun at dawn and dusk. Also tints sunlight while the sun is low.' },
  { key: 'nightSkyColor', label: 'Night sky', group: GROUPS.sky, type: 'color', default: '#0c1528',
    description: 'Color of the sky at night.' },
  { key: 'customSky', label: 'Use custom sky colors', group: GROUPS.sky, type: 'range', default: 0.7, min: 0, max: 1, step: 0.05,
    description: "Blend between Minecraft's own biome sky colors (0) and your colors above (1). Caves, the Nether and the End keep their own colors." },
  { key: 'fogDensity', label: 'Fog density', group: GROUPS.sky, type: 'range', default: 1, min: 0, max: 3, step: 0.05, unit: '×',
    description: 'Thickness of the haze in the distance. Fog is thicker near sea level and at sunrise.' },
  { key: 'rainFog', label: 'Rain fog', group: GROUPS.sky, type: 'range', default: 1, min: 0, max: 3, step: 0.05, unit: '×',
    description: 'Extra fog while it rains or snows.' },

  // ---- Water
  { key: 'waterColor', label: 'Water color', group: GROUPS.water, type: 'color', default: '#2f7ac4',
    description: 'Tint of water. Deeper water gets closer to this color.' },
  { key: 'waterTransparency', label: 'Water transparency', group: GROUPS.water, type: 'range', default: 0.6, min: 0, max: 1, step: 0.05,
    description: 'How far you can see into and under water. 1 is crystal clear.' },
  { key: 'waterWaves', label: 'Water waves', group: GROUPS.water, type: 'toggle', default: true,
    description: 'Animated waves and ripples on the water surface. Lily pads bob along.' },
  { key: 'waveHeight', label: 'Wave height', group: GROUPS.water, type: 'range', default: 0.5, min: 0, max: 2, step: 0.05, dependsOn: 'waterWaves',
    description: 'How tall the waves are.' },
  { key: 'waveSpeed', label: 'Wave speed', group: GROUPS.water, type: 'range', default: 1, min: 0.25, max: 3, step: 0.05, unit: '×', dependsOn: 'waterWaves',
    description: 'How fast the waves move.' },
  { key: 'waterReflections', label: 'Reflections', group: GROUPS.water, type: 'range', default: 1, min: 0, max: 2, step: 0.05, unit: '×',
    description: 'How much water reflects the sky and the sun, especially when you look across it.' },

  // ---- Waving
  { key: 'wavingLeaves', label: 'Waving leaves', group: GROUPS.waving, type: 'toggle', default: true,
    description: 'Tree leaves sway in the wind.' },
  { key: 'wavingPlants', label: 'Waving grass & flowers', group: GROUPS.waving, type: 'toggle', default: true,
    description: 'Grass, ferns, flowers, saplings and seagrass sway in the wind.' },
  { key: 'wavingCrops', label: 'Waving crops', group: GROUPS.waving, type: 'toggle', default: true,
    description: 'Wheat, carrots, potatoes and other crops sway in the wind.' },
  { key: 'wavingVines', label: 'Waving vines', group: GROUPS.waving, type: 'toggle', default: true,
    description: 'Vines, cave vines, weeping vines and hanging roots move gently.' },
  { key: 'wavingAmount', label: 'Wind strength', group: GROUPS.waving, type: 'range', default: 1, min: 0, max: 2, step: 0.05, unit: '×',
    description: 'How far plants sway. Wind is stronger while it rains.' },
  { key: 'wavingSpeed', label: 'Wind speed', group: GROUPS.waving, type: 'range', default: 1, min: 0.25, max: 3, step: 0.05, unit: '×',
    description: 'How fast plants sway.' },

  // ---- Post-processing
  { key: 'tonemap', label: 'Tone mapping', group: GROUPS.post, type: 'select', default: 'aces',
    options: [
      { value: 'aces', label: 'Cinematic (ACES)' },
      { value: 'filmic', label: 'Filmic (soft highlights)' },
      { value: 'reinhard', label: 'Soft (Reinhard)' },
      { value: 'none', label: 'None (plain)' },
    ],
    description: 'How bright light is squeezed onto your screen. Changes the overall film look of the pack.' },
  { key: 'exposure', label: 'Exposure', group: GROUPS.post, type: 'range', default: 0, min: -2, max: 2, step: 0.05, unit: 'EV',
    description: 'Overall brightness, like a camera. +1 is twice as bright, -1 half as bright.' },
  { key: 'bloomStrength', label: 'Bloom', group: GROUPS.post, type: 'range', default: 0.2, min: 0, max: 1, step: 0.05,
    description: 'Soft glow around bright things like the sun, torches and lava. 0 turns bloom off.' },
  { key: 'bloomThreshold', label: 'Bloom threshold', group: GROUPS.post, type: 'range', default: 1, min: 0, max: 3, step: 0.05,
    description: 'How bright something must be before it glows. Lower makes more of the image glow.' },
  { key: 'godrays', label: 'God rays', group: GROUPS.post, type: 'range', default: 0.6, min: 0, max: 2, step: 0.05,
    description: 'Beams of light streaming from the sun through trees and around hills. 0 turns them off.' },
  { key: 'vignette', label: 'Vignette', group: GROUPS.post, type: 'range', default: 0.3, min: 0, max: 1, step: 0.05,
    description: 'Darkens the corners of the screen for a cinematic look.' },

  // ---- Color
  { key: 'contrast', label: 'Contrast', group: GROUPS.color, type: 'range', default: 1, min: 0.5, max: 1.5, step: 0.01,
    description: 'Difference between dark and bright parts of the image.' },
  { key: 'saturation', label: 'Saturation', group: GROUPS.color, type: 'range', default: 1, min: 0, max: 2, step: 0.01,
    description: 'How colorful everything is. 0 is black and white.' },
  { key: 'vibrance', label: 'Vibrance', group: GROUPS.color, type: 'range', default: 0.1, min: -1, max: 1, step: 0.01,
    description: 'Boosts dull colors while leaving already colorful ones alone. Gentler than saturation.' },
  { key: 'temperature', label: 'Temperature', group: GROUPS.color, type: 'range', default: 0, min: -1, max: 1, step: 0.01,
    description: 'Shifts the whole image cooler (blue, below 0) or warmer (orange, above 0).' },
  { key: 'tint', label: 'Tint', group: GROUPS.color, type: 'range', default: 0, min: -1, max: 1, step: 0.01,
    description: 'Shifts the whole image toward green (below 0) or magenta (above 0).' },
  { key: 'gamma', label: 'Gamma', group: GROUPS.color, type: 'range', default: 1, min: 0.5, max: 2, step: 0.01,
    description: 'Brightens (above 1) or darkens (below 1) the mid-tones while keeping black and white.' },

  // ---- Performance
  { key: 'shadowResolution', label: 'Shadow resolution', group: GROUPS.performance, type: 'select', default: '2048', dependsOn: 'shadows',
    options: [
      { value: '1024', label: '1024 (fast, blurry)' },
      { value: '2048', label: '2048 (balanced)' },
      { value: '3072', label: '3072 (sharp)' },
      { value: '4096', label: '4096 (very sharp)' },
      { value: '8192', label: '8192 (extreme, strong GPU only)' },
    ],
    description: 'Detail of the shadow map. Higher is sharper but slower.' },
  { key: 'shadowDistance', label: 'Shadow distance', group: GROUPS.performance, type: 'range', default: 112, min: 32, max: 256, step: 16, unit: 'blocks', dependsOn: 'shadows',
    description: 'How far away shadows are drawn. Shorter distances make nearby shadows sharper and run faster.' },
  { key: 'effectQuality', label: 'Effect quality', group: GROUPS.performance, type: 'select', default: 'medium',
    options: [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' },
      { value: 'ultra', label: 'Ultra' },
    ],
    description: 'How many samples soft shadows and god rays use. Higher is smoother but slower.' },
];

const OPTION_MAP = new Map(OPTIONS.map((o) => [o.key, o]));

export function defaults(): OptionValues {
  const v: OptionValues = {};
  for (const o of OPTIONS) v[o.key] = o.default;
  return v;
}

export interface Preset {
  id: string;
  label: string;
  description: string;
  values: Partial<OptionValues>;
  swatch: [string, string];
}

export const PRESETS: Preset[] = [
  {
    id: 'default',
    label: 'Default',
    description: 'Balanced soft shadows, clear blue skies, gentle bloom and waving plants. A great place to start.',
    values: {},
    swatch: ['#5b93e6', '#fff0d9'],
  },
  {
    id: 'cinematic',
    label: 'Cinematic',
    description: 'Filmic tone mapping, warm light, deep shadows, strong sun rays and a subtle vignette.',
    values: {
      tonemap: 'filmic', exposure: -0.15, contrast: 1.12, saturation: 0.92, vibrance: 0.2, temperature: 0.12,
      sunColor: '#ffe2bf', sunsetColor: '#ff7a3d', horizonColor: '#c8d3df', shadowBrightness: 0.12, ambientStrength: 0.85,
      bloomStrength: 0.3, bloomThreshold: 0.8, godrays: 1, vignette: 0.45, fogDensity: 1.5, shadowSoftness: 1.3,
    },
    swatch: ['#2f4f66', '#ffb86b'],
  },
  {
    id: 'vibrant',
    label: 'Vibrant',
    description: 'Punchy colors, a deep blue sky, tropical water and bright sunshine.',
    values: {
      saturation: 1.3, vibrance: 0.4, contrast: 1.08, sunStrength: 1.15, skyColor: '#3d86f2', horizonColor: '#a6d2ff',
      waterColor: '#1aa6d9', waterTransparency: 0.75, customSky: 0.9, fogDensity: 0.6, bloomStrength: 0.2, godrays: 0.5,
      temperature: 0.05, vignette: 0.2,
    },
    swatch: ['#2f7de0', '#5bd35b'],
  },
  {
    id: 'soft',
    label: 'Soft & Dreamy',
    description: 'Gentle contrast, pastel skies, glowing haze and soft blurry shadows.',
    values: {
      tonemap: 'reinhard', exposure: 0.2, contrast: 0.9, saturation: 0.95, vibrance: 0.25, tint: 0.12, gamma: 1.05,
      skyColor: '#8fb0e8', horizonColor: '#f1dbe9', sunsetColor: '#ff9fae', sunColor: '#fff2ea', nightSkyColor: '#1b1a38',
      bloomStrength: 0.5, bloomThreshold: 0.6, godrays: 0.9, fogDensity: 1.8, shadowSoftness: 3, shadowBrightness: 0.4,
      ambientStrength: 1.2, waterColor: '#5fa8d8', vignette: 0.2, customSky: 0.9,
    },
    swatch: ['#c9b6f0', '#ffd6e4'],
  },
  {
    id: 'noir',
    label: 'Noir',
    description: 'Black and white film look with hard contrast, dark shadows, heavy mist and a strong vignette.',
    values: {
      saturation: 0, vibrance: 0, contrast: 1.3, tonemap: 'filmic', exposure: -0.1, gamma: 0.95, vignette: 0.7,
      shadowBrightness: 0.05, ambientStrength: 0.7, nightBrightness: 0.1, fogDensity: 2, rainFog: 2,
      bloomStrength: 0.2, bloomThreshold: 0.9, godrays: 1.2, shadowSoftness: 0.6,
    },
    swatch: ['#1a1a1a', '#bdbdbd'],
  },
  {
    id: 'fantasy',
    label: 'Fantasy',
    description: 'Violet skies, pink sunsets, turquoise water, magical glowing lights and bright nights.',
    values: {
      skyColor: '#7a5cf0', horizonColor: '#f2a9dc', sunsetColor: '#ff5fa2', nightSkyColor: '#26104a', sunColor: '#ffe6f6',
      waterColor: '#22c9bd', torchColor: '#ffa8e0', customSky: 1, saturation: 1.2, vibrance: 0.35, tint: 0.18,
      bloomStrength: 0.45, bloomThreshold: 0.7, godrays: 1.1, nightBrightness: 0.65, fogDensity: 1.3, sunAngle: -40,
      waterTransparency: 0.75,
    },
    swatch: ['#7a5cf0', '#ff5fa2'],
  },
  {
    id: 'golden',
    label: 'Golden Hour',
    description: 'Warm, amber sunlight all day, glowing sunsets, long sun rays and honey-colored haze.',
    values: {
      sunColor: '#ffc98a', sunsetColor: '#ff7b2e', skyColor: '#6c9de0', horizonColor: '#f4c99b', temperature: 0.3,
      contrast: 1.06, saturation: 1.12, vibrance: 0.2, bloomStrength: 0.3, bloomThreshold: 0.8, godrays: 1.3,
      fogDensity: 1.3, sunAngle: -45, torchColor: '#ffb061', vignette: 0.35, shadowBrightness: 0.2,
    },
    swatch: ['#ff8a3d', '#ffd8a8'],
  },
  {
    id: 'performance',
    label: 'Performance',
    description: 'For slower computers: no shadows, bloom or god rays. Keeps waving plants, water waves and color grading.',
    values: {
      shadows: false, cloudShadows: false, bloomStrength: 0, godrays: 0, effectQuality: 'low', shadowResolution: '1024',
      shadowDistance: 64,
    },
    swatch: ['#5bd35b', '#b4bccb'],
  },
  {
    id: 'ultra',
    label: 'Ultra',
    description: 'For strong graphics cards: sharp long-distance shadows, cloud shadows, smooth god rays and rich bloom.',
    values: {
      shadows: true, shadowResolution: '4096', shadowDistance: 192, effectQuality: 'ultra', cloudShadows: true,
      shadowSoftness: 1.2, bloomStrength: 0.25, godrays: 0.8,
    },
    swatch: ['#b07cff', '#ffcf4a'],
  },
];

/** Defaults with a preset's values applied (unknown preset ids give the defaults). */
export function presetValues(id: string): OptionValues {
  const out = defaults();
  const p = PRESETS.find((x) => x.id === id);
  if (p) for (const [k, val] of Object.entries(p.values)) if (val !== undefined) out[k] = val;
  return out;
}

// ---------------------------------------------------------------- typed, normalised settings

export type RGB = [number, number, number];

export interface Settings {
  sunStrength: number;
  sunColor: RGB;
  ambientStrength: number;
  nightBrightness: number;
  torchColor: RGB;
  torchStrength: number;
  handLight: boolean;
  shadows: boolean;
  shadowBrightness: number;
  shadowSoftness: number;
  sunAngle: number;
  cloudShadows: boolean;
  skyColor: RGB;
  horizonColor: RGB;
  sunsetColor: RGB;
  nightSkyColor: RGB;
  customSky: number;
  fogDensity: number;
  rainFog: number;
  waterColor: RGB;
  waterTransparency: number;
  waterWaves: boolean;
  waveHeight: number;
  waveSpeed: number;
  waterReflections: number;
  wavingLeaves: boolean;
  wavingPlants: boolean;
  wavingCrops: boolean;
  wavingVines: boolean;
  wavingAmount: number;
  wavingSpeed: number;
  tonemap: Tonemap;
  exposure: number;
  bloomStrength: number;
  bloomThreshold: number;
  godrays: number;
  vignette: number;
  contrast: number;
  saturation: number;
  vibrance: number;
  temperature: number;
  tint: number;
  gamma: number;
  shadowResolution: ShadowResolution;
  shadowDistance: number;
  effectQuality: EffectQuality;
}

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

/** Parses '#rgb' / '#rrggbb' (case-insensitive, '#' optional) into 0..255 channels. */
export function parseHexColor(value: unknown): RGB | null {
  if (typeof value !== 'string') return null;
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!m) return null;
  let hex = m[1];
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toHexColor(c: RGB): string {
  return '#' + c.map((x) => Math.round(clamp(x, 0, 255)).toString(16).padStart(2, '0')).join('');
}

function def(key: string): OptionDef {
  const d = OPTION_MAP.get(key);
  if (!d) throw new Error(`Unknown option ${key}`);
  return d;
}

function readNumber(v: OptionValues, key: string): number {
  const d = def(key);
  const raw: OptionValue | undefined = v[key];
  let n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
  if (!Number.isFinite(n)) n = d.default as number;
  n = clamp(n, d.min ?? -Infinity, d.max ?? Infinity);
  if (d.step !== undefined && d.step > 0) {
    const base = d.min ?? 0;
    n = base + Math.round((n - base) / d.step) * d.step;
    n = clamp(Number(n.toFixed(6)), d.min ?? -Infinity, d.max ?? Infinity);
  }
  return Object.is(n, -0) ? 0 : n;
}

function readBool(v: OptionValues, key: string): boolean {
  const raw = v[key];
  if (typeof raw === 'boolean') return raw;
  if (raw === 'true' || raw === 1 || raw === '1') return true;
  if (raw === 'false' || raw === 0 || raw === '0') return false;
  return def(key).default as boolean;
}

function readSelect<T extends string>(v: OptionValues, key: string): T {
  const d = def(key);
  const raw = v[key];
  const s = typeof raw === 'number' ? String(raw) : raw;
  if (typeof s === 'string' && d.options?.some((o) => o.value === s)) return s as T;
  return d.default as T;
}

function readColor(v: OptionValues, key: string): RGB {
  return parseHexColor(v[key]) ?? (parseHexColor(def(key).default) as RGB);
}

function copyDefined(v: OptionValues | Partial<OptionValues> | null | undefined): OptionValues {
  const src: OptionValues = {};
  if (v && typeof v === 'object') {
    for (const [k, val] of Object.entries(v)) if (val !== undefined && k !== '__proto__') src[k] = val;
  }
  return src;
}

/**
 * Cleans option values: every option present, numbers clamped and snapped to their step,
 * colours as lowercase #rrggbb, unknown choices replaced by the default, unknown keys dropped.
 */
export function normalizeOptions(v: OptionValues | Partial<OptionValues> | null | undefined): OptionValues {
  const src = copyDefined(v);
  const out: OptionValues = {};
  for (const d of OPTIONS) {
    if (d.type === 'range') out[d.key] = readNumber(src, d.key);
    else if (d.type === 'toggle') out[d.key] = readBool(src, d.key);
    else if (d.type === 'select') out[d.key] = readSelect(src, d.key);
    else out[d.key] = toHexColor(readColor(src, d.key));
  }
  return out;
}

/** Typed settings with defaults filled in and every value validated. */
export function readSettings(v: OptionValues | Partial<OptionValues> | null | undefined): Settings {
  const s = copyDefined(v);
  return {
    sunStrength: readNumber(s, 'sunStrength'),
    sunColor: readColor(s, 'sunColor'),
    ambientStrength: readNumber(s, 'ambientStrength'),
    nightBrightness: readNumber(s, 'nightBrightness'),
    torchColor: readColor(s, 'torchColor'),
    torchStrength: readNumber(s, 'torchStrength'),
    handLight: readBool(s, 'handLight'),
    shadows: readBool(s, 'shadows'),
    shadowBrightness: readNumber(s, 'shadowBrightness'),
    shadowSoftness: readNumber(s, 'shadowSoftness'),
    sunAngle: readNumber(s, 'sunAngle'),
    cloudShadows: readBool(s, 'cloudShadows'),
    skyColor: readColor(s, 'skyColor'),
    horizonColor: readColor(s, 'horizonColor'),
    sunsetColor: readColor(s, 'sunsetColor'),
    nightSkyColor: readColor(s, 'nightSkyColor'),
    customSky: readNumber(s, 'customSky'),
    fogDensity: readNumber(s, 'fogDensity'),
    rainFog: readNumber(s, 'rainFog'),
    waterColor: readColor(s, 'waterColor'),
    waterTransparency: readNumber(s, 'waterTransparency'),
    waterWaves: readBool(s, 'waterWaves'),
    waveHeight: readNumber(s, 'waveHeight'),
    waveSpeed: readNumber(s, 'waveSpeed'),
    waterReflections: readNumber(s, 'waterReflections'),
    wavingLeaves: readBool(s, 'wavingLeaves'),
    wavingPlants: readBool(s, 'wavingPlants'),
    wavingCrops: readBool(s, 'wavingCrops'),
    wavingVines: readBool(s, 'wavingVines'),
    wavingAmount: readNumber(s, 'wavingAmount'),
    wavingSpeed: readNumber(s, 'wavingSpeed'),
    tonemap: readSelect<Tonemap>(s, 'tonemap'),
    exposure: readNumber(s, 'exposure'),
    bloomStrength: readNumber(s, 'bloomStrength'),
    bloomThreshold: readNumber(s, 'bloomThreshold'),
    godrays: readNumber(s, 'godrays'),
    vignette: readNumber(s, 'vignette'),
    contrast: readNumber(s, 'contrast'),
    saturation: readNumber(s, 'saturation'),
    vibrance: readNumber(s, 'vibrance'),
    temperature: readNumber(s, 'temperature'),
    tint: readNumber(s, 'tint'),
    gamma: readNumber(s, 'gamma'),
    shadowResolution: readSelect<ShadowResolution>(s, 'shadowResolution'),
    shadowDistance: readNumber(s, 'shadowDistance'),
    effectQuality: readSelect<EffectQuality>(s, 'effectQuality'),
  };
}
