import type { OptionDef, OptionValue, OptionValues } from '../../../core/types';
import type { RGB } from './keyframes';
import { clamp, parseHexColor, toHex } from './keyframes';

export const GROUPS = {
  sun: 'Sun & Sky',
  lighting: 'Lighting',
  shadows: 'Shadows',
  fog: 'Fog & Atmosphere',
  water: 'Water',
  color: 'Color & Tone',
  nights: 'Nights',
} as const;

export type WaterStyle = 'clear' | 'tropical' | 'ocean' | 'swamp' | 'muddy' | 'tea';
export type ToneMapper = 'generic' | 'aces' | 'hable' | 'reinhard' | 'reinhard_luma' | 'reinhard_luminance';

export const TONE_MAPPERS: readonly ToneMapper[] = ['generic', 'aces', 'hable', 'reinhard', 'reinhard_luma', 'reinhard_luminance'];
export const SHADOW_TEXEL_SIZES = ['8', '16', '32', '64', '128', '256'] as const;

export const OPTIONS: OptionDef[] = [
  // Sun & Sky
  { key: 'sunBrightness', label: 'Sun brightness', group: GROUPS.sun, type: 'range', default: 1, min: 0.25, max: 4, step: 0.05, unit: '×',
    description: 'How strong daylight is. Auto-exposure evens out big changes, so the effect is gentler than the number suggests.' },
  { key: 'daylightColor', label: 'Daylight color', group: GROUPS.sun, type: 'color', default: '#ffe3d7',
    description: 'Color of sunlight during the day. Biomes with their own sunlight keep their character.' },
  { key: 'sunsetColor', label: 'Sunrise & sunset color', group: GROUPS.sun, type: 'color', default: '#ff7f00',
    description: 'Color of sunlight while the sun is low. Also warms the horizon at dusk.' },
  { key: 'sunsetGlow', label: 'Sunset glow', group: GROUPS.sun, type: 'range', default: 1, min: 0, max: 6, step: 0.1, unit: '×',
    description: 'Size of the bright haze around the sun at dawn and dusk.' },
  { key: 'skyColor', label: 'Sky color', group: GROUPS.sun, type: 'color', default: '#6782aa',
    description: 'Daytime sky color straight overhead.' },
  { key: 'horizonColor', label: 'Horizon color', group: GROUPS.sun, type: 'color', default: '#b7bdc6',
    description: 'Daytime sky color near the horizon.' },
  { key: 'skyDensity', label: 'Sky scattering', group: GROUPS.sun, type: 'range', default: 1, min: 0.2, max: 1.1, step: 0.05, unit: '×',
    description: 'How much the air scatters light. Lower gives a deeper, darker sky.' },
  { key: 'sunTilt', label: 'Sun path tilt', group: GROUPS.sun, type: 'range', default: 0, min: 0, max: 60, step: 1, unit: '°',
    description: 'Tilts the path of the sun and moon so shadows fall at an angle all day.' },

  // Lighting
  { key: 'caveLight', label: 'Cave & ambient light', group: GROUPS.lighting, type: 'range', default: 1, min: 0, max: 10, step: 0.1, unit: '×',
    description: 'Minimum light everywhere, most visible in caves and in the Nether. Higher is brighter.' },
  { key: 'glowColor', label: 'Glow color strength', group: GROUPS.lighting, type: 'range', default: 1, min: 0, max: 1, step: 0.05,
    description: 'How colorful the light from glowing surfaces is. 0 makes it white.' },
  { key: 'coloredLights', label: 'Colored block light', group: GROUPS.lighting, type: 'toggle', default: false,
    description: 'Torches, lanterns, fire, froglights and other light sources tint their surroundings (Minecraft 26.10 or newer).' },
  { key: 'torchColor', label: 'Torch & lantern color', group: GROUPS.lighting, type: 'color', default: '#efe39d', dependsOn: 'coloredLights',
    description: 'Light color of torches, candles, lanterns, campfires and fire. Other lights keep their own colors.' },

  // Shadows
  { key: 'shadowFill', label: 'Shadow fill light', group: GROUPS.shadows, type: 'range', default: 1, min: 0.1, max: 1, step: 0.05,
    description: 'How much light from the sky brightens shadows. Lower makes shadows darker and moodier.' },
  { key: 'blockyShadows', label: 'Pixel shadows', group: GROUPS.shadows, type: 'toggle', default: false,
    description: 'Shadows snap to the texture pixel grid for a crisp, blocky look instead of soft edges.' },
  { key: 'shadowTexel', label: 'Shadow pixel size', group: GROUPS.shadows, type: 'select', default: '16', dependsOn: 'blockyShadows',
    options: SHADOW_TEXEL_SIZES.map((s) => ({ value: s, label: `${s}x textures` })),
    description: 'Match the resolution of your texture pack (16x for vanilla textures).' },

  // Fog & Atmosphere
  { key: 'fogAmount', label: 'Volumetric fog', group: GROUPS.fog, type: 'range', default: 1, min: 0, max: 4, step: 0.05, unit: '×',
    description: 'Thickness of the misty air in biomes that have it: jungles, swamps, forests, the pale garden and the End.' },
  { key: 'lightShafts', label: 'Light shaft focus', group: GROUPS.fog, type: 'range', default: 0, min: -0.5, max: 0.5, step: 0.05,
    description: 'Higher gathers fog glow and light shafts around the sun; lower spreads the glow across the sky.' },
  { key: 'classicFog', label: 'Customize classic fog', group: GROUPS.fog, type: 'toggle', default: false,
    description: 'Also change distance fog and underwater fog. These work in every graphics mode, not only Vibrant Visuals.' },
  { key: 'fogDistance', label: 'Fog distance', group: GROUPS.fog, type: 'range', default: 1, min: 0.25, max: 2, step: 0.05, unit: '×', dependsOn: 'classicFog',
    description: 'Lower brings distance fog closer; higher pushes it out to the edge of your render distance.' },
  { key: 'underwaterVisibility', label: 'Underwater visibility', group: GROUPS.fog, type: 'range', default: 1, min: 0.5, max: 4, step: 0.1, unit: '×', dependsOn: 'classicFog',
    description: 'How far you can see under water.' },

  // Water
  { key: 'waterStyle', label: 'Water look', group: GROUPS.water, type: 'select', default: 'clear',
    options: [
      { value: 'clear', label: 'Crystal clear (vanilla)' },
      { value: 'tropical', label: 'Tropical' },
      { value: 'ocean', label: 'Deep ocean' },
      { value: 'swamp', label: 'Swampy green' },
      { value: 'muddy', label: 'Muddy river' },
      { value: 'tea', label: 'Dark tea' },
    ],
    description: 'Tints Vibrant Visuals water by simulating algae, mud and dissolved plant matter.' },
  { key: 'biomeWaterColor', label: 'Biome water colors', group: GROUPS.water, type: 'range', default: 0, min: 0, max: 1, step: 0.05,
    description: "Blends each biome's classic water color into Vibrant Visuals water (Minecraft 26.0 or newer)." },
  { key: 'waves', label: 'Surface waves', group: GROUPS.water, type: 'toggle', default: false,
    description: 'Animated ripples on the water surface (visual only; the water itself stays flat).' },
  { key: 'waveHeight', label: 'Wave height', group: GROUPS.water, type: 'range', default: 1, min: 0, max: 3, step: 0.05, dependsOn: 'waves',
    description: 'How tall the ripples look.' },
  { key: 'waveSpeed', label: 'Wave speed', group: GROUPS.water, type: 'range', default: 2, min: 0.1, max: 10, step: 0.1, dependsOn: 'waves',
    description: 'How fast the ripples move.' },
  { key: 'caustics', label: 'Underwater caustics', group: GROUPS.water, type: 'toggle', default: true,
    description: 'Moving patterns of light on surfaces under water.' },
  { key: 'causticsStrength', label: 'Caustics sharpness', group: GROUPS.water, type: 'range', default: 1, min: 1, max: 6, step: 1, dependsOn: 'caustics',
    description: 'Higher values give thinner, more defined light lines.' },

  // Color & Tone
  { key: 'brightness', label: 'Brightness', group: GROUPS.color, type: 'range', default: 1, min: 0.5, max: 2, step: 0.05, unit: '×',
    description: 'Overall image brightness.' },
  { key: 'contrast', label: 'Contrast', group: GROUPS.color, type: 'range', default: 1.15, min: 0.5, max: 2, step: 0.05,
    description: 'Difference between dark and bright areas. Vanilla is 1.15.' },
  { key: 'saturation', label: 'Saturation', group: GROUPS.color, type: 'range', default: 1.05, min: 0, max: 2.5, step: 0.05,
    description: '0 is black and white.' },
  { key: 'warmth', label: 'Warmth', group: GROUPS.color, type: 'range', default: 0, min: -100, max: 100, step: 5,
    description: 'Shifts the whole image warmer (orange) or cooler (blue). Each biome keeps its own mood.' },
  { key: 'tint', label: 'Color tint', group: GROUPS.color, type: 'color', default: '#ffffff',
    description: 'Gently tints the whole image. White means no tint.' },
  { key: 'toneMapper', label: 'Tone mapping', group: GROUPS.color, type: 'select', default: 'generic',
    options: [
      { value: 'generic', label: 'Vanilla (generic)' },
      { value: 'aces', label: 'Cinematic (ACES)' },
      { value: 'hable', label: 'Filmic (Hable)' },
      { value: 'reinhard', label: 'Soft (Reinhard)' },
      { value: 'reinhard_luma', label: 'Soft, rich color (Reinhard luma)' },
      { value: 'reinhard_luminance', label: 'Soft, bright (Reinhard luminance)' },
    ],
    description: 'How bright light is squeezed onto your screen. Changes the overall film look.' },
  { key: 'splitTone', label: 'Split toning', group: GROUPS.color, type: 'toggle', default: false,
    description: 'Tint shadows and highlights with different colors, like a movie color grade.' },
  { key: 'shadowTint', label: 'Shadow tint', group: GROUPS.color, type: 'color', default: '#6fa8c8', dependsOn: 'splitTone',
    description: 'Color mixed into the darkest parts of the image.' },
  { key: 'highlightTint', label: 'Highlight tint', group: GROUPS.color, type: 'color', default: '#ffc98a', dependsOn: 'splitTone',
    description: 'Color mixed into the brightest parts of the image.' },

  // Nights
  { key: 'moonBrightness', label: 'Moonlight brightness', group: GROUPS.nights, type: 'range', default: 1, min: 0, max: 5, step: 0.1, unit: '×',
    description: 'How bright moonlit nights are. At 0 the moon is hidden.' },
  { key: 'moonColor', label: 'Moonlight color', group: GROUPS.nights, type: 'color', default: '#a3b6ff',
    description: 'Color of moonlight. Biomes with their own moonlight keep their character.' },
  { key: 'nightSkyColor', label: 'Night sky color', group: GROUPS.nights, type: 'color', default: '#282828',
    description: 'Color of the sky overhead at night.' },
  { key: 'nightBrightness', label: 'Brighter nights', group: GROUPS.nights, type: 'range', default: 0, min: 0, max: 1, step: 0.05,
    description: 'Raises the minimum light after sunset so nights are easier to see in. Caves get brighter at night too (Minecraft 26.0 or newer).' },
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
    description: 'Vibrant Visuals exactly as Minecraft ships it. A clean starting point.',
    values: {},
    swatch: ['#6782aa', '#ffe3d7'],
  },
  {
    id: 'cinematic',
    label: 'Cinematic',
    description: 'Film-style tone mapping, teal shadows and warm highlights, richer fog and sun glow.',
    values: {
      toneMapper: 'aces', contrast: 1.3, saturation: 0.95, brightness: 1.05, warmth: 10,
      sunsetGlow: 2.5, fogAmount: 1.6, lightShafts: 0.15, shadowFill: 0.75,
      splitTone: true, shadowTint: '#6fa8c8', highlightTint: '#ffc98a',
    },
    swatch: ['#2f5d73', '#ffb86b'],
  },
  {
    id: 'vivid',
    label: 'Vivid',
    description: 'Punchy colors, a deep blue sky, tropical water and crisp sunlight.',
    values: {
      saturation: 1.45, contrast: 1.25, brightness: 1.05, sunBrightness: 1.25,
      skyColor: '#4a86d8', horizonColor: '#a9cdf2', waterStyle: 'tropical',
      caustics: true, causticsStrength: 2, toneMapper: 'hable',
    },
    swatch: ['#2f7de0', '#5bd35b'],
  },
  {
    id: 'soft',
    label: 'Soft & Dreamy',
    description: 'Gentle contrast, pastel sky, glowing haze and lavender-pink toning.',
    values: {
      contrast: 0.95, saturation: 0.9, brightness: 1.1, toneMapper: 'reinhard_luma',
      skyColor: '#8ea6d9', horizonColor: '#efd6e6', daylightColor: '#fff0e8',
      sunsetGlow: 3.5, fogAmount: 2, lightShafts: -0.1, caveLight: 1.5,
      splitTone: true, shadowTint: '#a89ad8', highlightTint: '#ffd6e4', tint: '#fff4fa',
    },
    swatch: ['#c9b6f0', '#ffd6e4'],
  },
  {
    id: 'noir',
    label: 'Moody Noir',
    description: 'Almost black and white, hard contrast, dark shadows and heavy mist.',
    values: {
      saturation: 0.12, contrast: 1.55, brightness: 0.9, toneMapper: 'aces', warmth: -15,
      shadowFill: 0.35, fogAmount: 2.6, lightShafts: 0.25, caveLight: 0.5,
      moonBrightness: 0.7, nightSkyColor: '#121212',
    },
    swatch: ['#1a1a1a', '#bdbdbd'],
  },
  {
    id: 'golden',
    label: 'Golden Hour',
    description: 'Warm, low-sun light all day with glowing sunsets and amber highlights.',
    values: {
      sunBrightness: 0.85, daylightColor: '#ffd8a8', sunsetColor: '#ff8a3d', warmth: 35,
      contrast: 1.2, saturation: 1.15, sunsetGlow: 2.5, horizonColor: '#e9caa6',
      lightShafts: 0.1, fogAmount: 1.3, sunTilt: 20,
    },
    swatch: ['#ff8a3d', '#ffd8a8'],
  },
  {
    id: 'fantasy',
    label: 'Fantasy',
    description: 'Violet skies, pink sunsets, bright magical moonlight and colored torch light.',
    values: {
      skyColor: '#7b6ad6', horizonColor: '#f1a9d8', daylightColor: '#ffe6f4', sunsetColor: '#ff5fa2',
      moonColor: '#b38cff', moonBrightness: 3, nightSkyColor: '#2a1a4a', saturation: 1.35,
      tint: '#f7f0ff', coloredLights: true, torchColor: '#ffc4e8', waterStyle: 'tropical',
      fogAmount: 1.5, sunTilt: 25, sunsetGlow: 2,
    },
    swatch: ['#7b6ad6', '#ff5fa2'],
  },
  {
    id: 'clearwater',
    label: 'Clear Water',
    description: 'Glass-clear water with sharp caustics, gentle waves and long underwater view distance.',
    values: {
      waterStyle: 'clear', caustics: true, causticsStrength: 3, waves: true, waveHeight: 0.6, waveSpeed: 1.5,
      classicFog: true, underwaterVisibility: 2.5, saturation: 1.1,
    },
    swatch: ['#44aff5', '#d8f4ff'],
  },
  {
    id: 'performance',
    label: 'Performance',
    description: 'Thin fog, no caustics or waves: a clean, light look. Frame rate mostly depends on your video settings.',
    values: {
      fogAmount: 0.35, lightShafts: 0, sunsetGlow: 0.8, waves: false, caustics: false, coloredLights: false,
    },
    swatch: ['#5bd35b', '#b4bccb'],
  },
  {
    id: 'toon',
    label: 'Blocky Toon',
    description: 'Pixel-sharp shadows, bold colors and soft tone mapping for a cartoon look.',
    values: {
      blockyShadows: true, shadowTexel: '16', saturation: 1.4, contrast: 1.1, toneMapper: 'reinhard',
      shadowFill: 0.8, skyColor: '#5b9cf0',
    },
    swatch: ['#5b9cf0', '#ffcf4a'],
  },
];

export function presetValues(id: string): OptionValues {
  const p = PRESETS.find((x) => x.id === id);
  const out = defaults();
  if (p) for (const [k, val] of Object.entries(p.values)) if (val !== undefined) out[k] = val;
  return out;
}

// ---------------------------------------------------------------- typed settings

export interface Settings {
  sunBrightness: number;
  daylightColor: RGB;
  sunsetColor: RGB;
  sunsetGlow: number;
  skyColor: RGB;
  horizonColor: RGB;
  skyDensity: number;
  sunTilt: number;
  caveLight: number;
  glowColor: number;
  coloredLights: boolean;
  torchColor: RGB;
  shadowFill: number;
  blockyShadows: boolean;
  shadowTexel: number;
  fogAmount: number;
  lightShafts: number;
  classicFog: boolean;
  fogDistance: number;
  underwaterVisibility: number;
  waterStyle: WaterStyle;
  biomeWaterColor: number;
  waves: boolean;
  waveHeight: number;
  waveSpeed: number;
  caustics: boolean;
  causticsStrength: number;
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  tint: RGB;
  toneMapper: ToneMapper;
  splitTone: boolean;
  shadowTint: RGB;
  highlightTint: RGB;
  moonBrightness: number;
  moonColor: RGB;
  nightSkyColor: RGB;
  nightBrightness: number;
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
  if (d.step !== undefined && Number.isInteger(d.step) && Number.isInteger(d.min ?? 0)) n = Math.round(n);
  return n;
}

function readBool(v: OptionValues, key: string): boolean {
  const raw = v[key];
  if (typeof raw === 'boolean') return raw;
  if (raw === 'true' || raw === 1) return true;
  if (raw === 'false' || raw === 0) return false;
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
 * Clean option values: every option present, ranges clamped, colours as lowercase #rrggbb,
 * unknown choices replaced by the default. Unknown keys are dropped.
 */
export function normalizeOptions(v: OptionValues | Partial<OptionValues> | null | undefined): OptionValues {
  const src = copyDefined(v);
  const out: OptionValues = {};
  for (const d of OPTIONS) {
    if (d.type === 'range') out[d.key] = readNumber(src, d.key);
    else if (d.type === 'toggle') out[d.key] = readBool(src, d.key);
    else if (d.type === 'select') out[d.key] = readSelect(src, d.key);
    else out[d.key] = toHex(readColor(src, d.key));
  }
  return out;
}

/** Fills missing values with defaults, clamps ranges and rejects invalid colours/choices. */
export function readSettings(v: OptionValues | Partial<OptionValues> | null | undefined): Settings {
  const src = copyDefined(v);
  return {
    sunBrightness: readNumber(src, 'sunBrightness'),
    daylightColor: readColor(src, 'daylightColor'),
    sunsetColor: readColor(src, 'sunsetColor'),
    sunsetGlow: readNumber(src, 'sunsetGlow'),
    skyColor: readColor(src, 'skyColor'),
    horizonColor: readColor(src, 'horizonColor'),
    skyDensity: readNumber(src, 'skyDensity'),
    sunTilt: readNumber(src, 'sunTilt'),
    caveLight: readNumber(src, 'caveLight'),
    glowColor: readNumber(src, 'glowColor'),
    coloredLights: readBool(src, 'coloredLights'),
    torchColor: readColor(src, 'torchColor'),
    shadowFill: readNumber(src, 'shadowFill'),
    blockyShadows: readBool(src, 'blockyShadows'),
    shadowTexel: Number(readSelect(src, 'shadowTexel')),
    fogAmount: readNumber(src, 'fogAmount'),
    lightShafts: readNumber(src, 'lightShafts'),
    classicFog: readBool(src, 'classicFog'),
    fogDistance: readNumber(src, 'fogDistance'),
    underwaterVisibility: readNumber(src, 'underwaterVisibility'),
    waterStyle: readSelect<WaterStyle>(src, 'waterStyle'),
    biomeWaterColor: readNumber(src, 'biomeWaterColor'),
    waves: readBool(src, 'waves'),
    waveHeight: readNumber(src, 'waveHeight'),
    waveSpeed: readNumber(src, 'waveSpeed'),
    caustics: readBool(src, 'caustics'),
    causticsStrength: readNumber(src, 'causticsStrength'),
    brightness: readNumber(src, 'brightness'),
    contrast: readNumber(src, 'contrast'),
    saturation: readNumber(src, 'saturation'),
    warmth: readNumber(src, 'warmth'),
    tint: readColor(src, 'tint'),
    toneMapper: readSelect<ToneMapper>(src, 'toneMapper'),
    splitTone: readBool(src, 'splitTone'),
    shadowTint: readColor(src, 'shadowTint'),
    highlightTint: readColor(src, 'highlightTint'),
    moonBrightness: readNumber(src, 'moonBrightness'),
    moonColor: readColor(src, 'moonColor'),
    nightSkyColor: readColor(src, 'nightSkyColor'),
    nightBrightness: readNumber(src, 'nightBrightness'),
  };
}

/** Option defaults as typed settings (the vanilla reference point for relative adjustments). */
export const DEFAULT_SETTINGS: Readonly<Settings> = readSettings(defaults());

export interface WaterConcentrations { cdom: number; chlorophyll: number; suspended_sediment: number }

export const WATER_STYLES: Record<WaterStyle, WaterConcentrations & { color: RGB; clarity: number }> = {
  clear: { cdom: 0, chlorophyll: 0, suspended_sediment: 0, color: [68, 175, 245], clarity: 0.92 },
  tropical: { cdom: 0, chlorophyll: 0.4, suspended_sediment: 1.5, color: [40, 200, 210], clarity: 0.85 },
  ocean: { cdom: 1, chlorophyll: 0.2, suspended_sediment: 0, color: [22, 96, 190], clarity: 0.7 },
  swamp: { cdom: 3, chlorophyll: 5, suspended_sediment: 15, color: [78, 112, 60], clarity: 0.35 },
  muddy: { cdom: 1.5, chlorophyll: 0.5, suspended_sediment: 120, color: [128, 102, 64], clarity: 0.2 },
  tea: { cdom: 9, chlorophyll: 0.5, suspended_sediment: 5, color: [112, 76, 32], clarity: 0.3 },
};
