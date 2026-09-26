// In-game options of the generated pack. Every entry becomes a line in shaders/lib/settings.glsl
// (so it can be changed in the Iris / OptiFine "Shader Options" menu), a place on an option
// screen in shaders.properties and a readable name in lang/en_US.lang. The web UI values only
// choose the defaults.

import type { RGB, Settings, EffectQuality } from './options';

export type ScreenId = 'LIGHTING' | 'SHADOWS' | 'SKY' | 'SKY_COLORS' | 'WATER' | 'WAVING' | 'POST' | 'COLOR' | 'PERFORMANCE';

interface BaseOption {
  /** Macro / const name in GLSL */
  name: string;
  label: string;
  comment: string;
  screen: ScreenId | null;
}

export interface BoolOption extends BaseOption {
  kind: 'bool';
  value(s: Settings): boolean;
}

export interface ValueOption extends BaseOption {
  kind: 'value';
  /** 'define' -> #define NAME v // [..]; 'const' -> const int|float NAME = v; // [..] (whitelisted names only) */
  form: 'define' | 'const-int' | 'const-float';
  /** Allowed values before the chosen one is merged in */
  list: number[];
  decimals: number;
  value(s: Settings): number;
  slider: boolean;
  /** Readable names for some values, keyed by the formatted value */
  valueLabels?: (formatted: string, n: number) => string | null;
}

export type GameOption = BoolOption | ValueOption;

/** Evenly spaced list lo..hi (inclusive) with float noise removed. */
export function steps(lo: number, hi: number, step: number): number[] {
  const out: number[] = [];
  const n = Math.round((hi - lo) / step);
  for (let i = 0; i <= n; i++) out.push(Number((lo + i * step).toFixed(6)));
  return out;
}

/** Fixed-decimal formatting as used in option lists ('-0.00' never appears). */
export function formatValue(n: number, decimals: number): string {
  const s = (Math.round(n * 10 ** decimals) / 10 ** decimals).toFixed(decimals);
  return /^-0(\.0+)?$/.test(s) ? s.slice(1) : s;
}

/**
 * The option's allowed values as strings with the chosen value merged in (sorted numerically,
 * no duplicates), plus the formatted default. Loaders compare values as strings, so both use
 * exactly the same formatting.
 */
export function optionList(opt: ValueOption, s: Settings): { value: string; list: string[] } {
  const value = formatValue(opt.value(s), opt.decimals);
  const set = new Map<string, number>();
  for (const n of opt.list) set.set(formatValue(n, opt.decimals), Number(formatValue(n, opt.decimals)));
  set.set(value, Number(value));
  const list = [...set.entries()].sort((a, b) => a[1] - b[1]).map(([k]) => k);
  return { value, list };
}

const channel = (c: RGB, i: number): number => c[i] / 255;
const COLOR_LIST = steps(0, 1, 0.05);

function colorOptions(prefix: string, label: string, screen: ScreenId, pick: (s: Settings) => RGB, what: string): ValueOption[] {
  const names = ['Red', 'Green', 'Blue'];
  return ['R', 'G', 'B'].map((ch, i) => ({
    kind: 'value' as const,
    form: 'define' as const,
    name: `${prefix}_${ch}`,
    label: `${label} ${names[i]}`,
    comment: `Amount of ${names[i].toLowerCase()} in ${what}.`,
    screen,
    list: COLOR_LIST,
    decimals: 2,
    slider: true,
    value: (s: Settings) => channel(pick(s), i),
  }));
}

const QUALITY_SHADOW_SAMPLES: Record<EffectQuality, number> = { low: 4, medium: 8, high: 16, ultra: 24 };
const QUALITY_GODRAY_SAMPLES: Record<EffectQuality, number> = { low: 8, medium: 12, high: 16, ultra: 24 };
const TONEMAP_IDS = { none: 0, reinhard: 1, aces: 2, filmic: 3 } as const;

/** Defaults used for a strength slider whose feature the user switched off (value 0). */
const BLOOM_FALLBACK = 0.2;
const GODRAYS_FALLBACK = 0.6;

const range = (
  name: string, label: string, comment: string, screen: ScreenId | null, list: number[], value: (s: Settings) => number, decimals = 2,
): ValueOption => ({ kind: 'value', form: 'define', name, label, comment, screen, list, decimals, value, slider: true });

const bool = (name: string, label: string, comment: string, screen: ScreenId | null, value: (s: Settings) => boolean): BoolOption =>
  ({ kind: 'bool', name, label, comment, screen, value });

export const GAME_OPTIONS: GameOption[] = [
  // Pack info line on the main screen (no effect on rendering)
  {
    kind: 'value', form: 'define', name: 'PACK_INFO', label: 'Shader pack', comment: '', screen: null,
    list: [0], decimals: 0, value: () => 0, slider: false,
  },

  // ---- Lighting
  range('SUN_STRENGTH', 'Sunlight', 'Brightness of direct sunlight.', 'LIGHTING', steps(0, 3, 0.25), (s) => s.sunStrength),
  ...colorOptions('SUN', 'Sunlight', 'LIGHTING', (s) => s.sunColor, 'daytime sunlight'),
  range('AMBIENT_STRENGTH', 'Ambient Light', 'Soft sky light that fills in shaded areas.', 'LIGHTING', steps(0.25, 2, 0.25), (s) => s.ambientStrength),
  range('NIGHT_BRIGHTNESS', 'Night Brightness', 'Moonlight and the lowest light level at night and in caves.', 'LIGHTING', steps(0, 1, 0.1), (s) => s.nightBrightness),
  range('TORCH_STRENGTH', 'Torch Light', 'Brightness of torches, lanterns and glowing blocks.', 'LIGHTING', steps(0, 3, 0.25), (s) => s.torchStrength),
  ...colorOptions('TORCH', 'Torch Light', 'LIGHTING', (s) => s.torchColor, 'torch and lantern light'),
  bool('HAND_LIGHT', 'Handheld Light', 'Light sources held in your hands light up the area around you.', 'LIGHTING', (s) => s.handLight),

  // ---- Shadows
  bool('SHADOWS', 'Shadows', 'Real sun and moon shadows. Big performance impact!', 'SHADOWS', (s) => s.shadows),
  range('SHADOW_BRIGHTNESS', 'Shadow Brightness', 'How much light still reaches shadowed spots.', 'SHADOWS', steps(0, 1, 0.05), (s) => s.shadowBrightness),
  range('SHADOW_SOFTNESS', 'Shadow Softness', 'Blur of shadow edges. 0 is sharp.', 'SHADOWS', steps(0, 4, 0.25), (s) => s.shadowSoftness),
  {
    kind: 'value', form: 'const-float', name: 'sunPathRotation', label: 'Sun Path Tilt', screen: 'SHADOWS',
    comment: 'Tilts the path of the sun and moon so shadows fall at an angle.',
    list: steps(-60, 60, 5), decimals: 1, slider: true, value: (s) => s.sunAngle,
  },
  bool('CLOUD_SHADOWS', 'Cloud Shadows', 'Soft shadows of drifting clouds on the landscape.', 'SHADOWS', (s) => s.cloudShadows),

  // ---- Sky & fog
  range('SKY_CUSTOM', 'Custom Sky Colors', 'Blend between biome sky colors (0) and the custom colors (1).', 'SKY', steps(0, 1, 0.1), (s) => s.customSky),
  range('FOG_DENSITY', 'Fog Density', 'Thickness of distant haze.', 'SKY', steps(0, 3, 0.25), (s) => s.fogDensity),
  range('RAIN_FOG', 'Rain Fog', 'Extra fog while it rains or snows.', 'SKY', steps(0, 3, 0.25), (s) => s.rainFog),
  ...colorOptions('SKY', 'Day Sky', 'SKY_COLORS', (s) => s.skyColor, 'the daytime sky'),
  ...colorOptions('HORIZON', 'Horizon', 'SKY_COLORS', (s) => s.horizonColor, 'the horizon and distant haze'),
  ...colorOptions('SUNSET', 'Sunset', 'SKY_COLORS', (s) => s.sunsetColor, 'sunrise and sunset glow'),
  ...colorOptions('NIGHT', 'Night Sky', 'SKY_COLORS', (s) => s.nightSkyColor, 'the night sky'),

  // ---- Water
  ...colorOptions('WATER', 'Water', 'WATER', (s) => s.waterColor, 'the water color'),
  range('WATER_CLARITY', 'Water Clarity', 'How far you can see into water. 1 is crystal clear.', 'WATER', steps(0, 1, 0.1), (s) => s.waterTransparency),
  bool('WATER_WAVES', 'Water Waves', 'Animated waves on the water surface.', 'WATER', (s) => s.waterWaves),
  range('WAVE_HEIGHT', 'Wave Height', 'How tall water waves are.', 'WATER', steps(0, 2, 0.25), (s) => s.waveHeight),
  range('WAVE_SPEED', 'Wave Speed', 'How fast water waves move.', 'WATER', steps(0.25, 3, 0.25), (s) => s.waveSpeed),
  range('WATER_REFLECTIONS', 'Reflections', 'How strongly water reflects the sky and sun.', 'WATER', steps(0, 2, 0.25), (s) => s.waterReflections),

  // ---- Waving
  bool('WAVING_LEAVES', 'Waving Leaves', 'Tree leaves sway in the wind.', 'WAVING', (s) => s.wavingLeaves),
  bool('WAVING_PLANTS', 'Waving Grass', 'Grass, flowers and saplings sway in the wind.', 'WAVING', (s) => s.wavingPlants),
  bool('WAVING_CROPS', 'Waving Crops', 'Wheat, carrots and other crops sway in the wind.', 'WAVING', (s) => s.wavingCrops),
  bool('WAVING_VINES', 'Waving Vines', 'Vines and hanging plants move gently.', 'WAVING', (s) => s.wavingVines),
  range('WAVING_STRENGTH', 'Wind Strength', 'How far plants sway.', 'WAVING', steps(0, 2, 0.25), (s) => s.wavingAmount),
  range('WAVING_SPEED', 'Wind Speed', 'How fast plants sway.', 'WAVING', steps(0.25, 3, 0.25), (s) => s.wavingSpeed),

  // ---- Post-processing
  {
    kind: 'value', form: 'define', name: 'TONEMAP', label: 'Tone Mapping', screen: 'POST',
    comment: 'How bright light is squeezed onto the screen.',
    list: [0, 1, 2, 3], decimals: 0, slider: false, value: (s) => TONEMAP_IDS[s.tonemap],
    valueLabels: (f) => ({ '0': 'None', '1': 'Soft (Reinhard)', '2': 'Cinematic (ACES)', '3': 'Filmic' } as Record<string, string>)[f] ?? null,
  },
  range('EXPOSURE', 'Exposure', 'Overall brightness in camera stops.', 'POST', steps(-2, 2, 0.25), (s) => s.exposure),
  bool('BLOOM', 'Bloom', 'Soft glow around bright light sources.', 'POST', (s) => s.bloomStrength > 0),
  range('BLOOM_STRENGTH', 'Bloom Strength', 'How strong the glow is.', 'POST', steps(0.05, 1, 0.05),
    (s) => (s.bloomStrength > 0 ? s.bloomStrength : BLOOM_FALLBACK)),
  range('BLOOM_THRESHOLD', 'Bloom Threshold', 'How bright something must be before it glows.', 'POST', steps(0, 3, 0.25), (s) => s.bloomThreshold),
  bool('GODRAYS', 'God Rays', 'Beams of light streaming from the sun.', 'POST', (s) => s.godrays > 0),
  range('GODRAYS_STRENGTH', 'God Ray Strength', 'How bright the light beams are.', 'POST', steps(0.1, 2, 0.1),
    (s) => (s.godrays > 0 ? s.godrays : GODRAYS_FALLBACK)),
  range('VIGNETTE_STRENGTH', 'Vignette', 'Darkens the corners of the screen.', 'POST', steps(0, 1, 0.05), (s) => s.vignette),

  // ---- Color
  range('CONTRAST', 'Contrast', 'Difference between dark and bright areas.', 'COLOR', steps(0.5, 1.5, 0.05), (s) => s.contrast),
  range('SATURATION', 'Saturation', 'How colorful the image is. 0 is black and white.', 'COLOR', steps(0, 2, 0.1), (s) => s.saturation),
  range('VIBRANCE', 'Vibrance', 'Boosts dull colors more than colorful ones.', 'COLOR', steps(-1, 1, 0.1), (s) => s.vibrance),
  range('TEMPERATURE', 'Temperature', 'Cooler (blue) below 0, warmer (orange) above 0.', 'COLOR', steps(-1, 1, 0.1), (s) => s.temperature),
  range('TINT', 'Tint', 'Greener below 0, more magenta above 0.', 'COLOR', steps(-1, 1, 0.1), (s) => s.tint),
  range('GAMMA', 'Gamma', 'Brightens or darkens the mid-tones.', 'COLOR', steps(0.5, 2, 0.05), (s) => s.gamma),

  // ---- Performance
  {
    kind: 'value', form: 'const-int', name: 'shadowMapResolution', label: 'Shadow Resolution', screen: 'PERFORMANCE',
    comment: 'Detail of the shadow map. Higher is sharper but slower.',
    list: [512, 1024, 2048, 3072, 4096, 8192], decimals: 0, slider: true, value: (s) => Number(s.shadowResolution),
  },
  {
    kind: 'value', form: 'const-float', name: 'shadowDistance', label: 'Shadow Distance', screen: 'PERFORMANCE',
    comment: 'How far away shadows are drawn. Shorter is sharper and faster.',
    list: [32, 48, 64, 80, 96, 112, 128, 160, 192, 224, 256], decimals: 1, slider: true, value: (s) => s.shadowDistance,
    valueLabels: (_f, n) => `${Math.round(n)} blocks`,
  },
  {
    kind: 'value', form: 'define', name: 'SHADOW_SAMPLES', label: 'Shadow Quality', screen: 'PERFORMANCE',
    comment: 'Samples used to smooth shadow edges. Higher is smoother but slower.',
    list: [4, 8, 12, 16, 24, 32], decimals: 0, slider: true, value: (s) => QUALITY_SHADOW_SAMPLES[s.effectQuality],
  },
  {
    kind: 'value', form: 'define', name: 'GODRAYS_SAMPLES', label: 'God Ray Quality', screen: 'PERFORMANCE',
    comment: 'Samples used for god rays. Higher is smoother but slower.',
    list: [8, 12, 16, 24, 32], decimals: 0, slider: true, value: (s) => QUALITY_GODRAY_SAMPLES[s.effectQuality],
  },
];

export const GAME_OPTION_MAP = new Map(GAME_OPTIONS.map((o) => [o.name, o]));

export interface ScreenDef {
  id: ScreenId;
  label: string;
  comment: string;
  columns: number;
  /** Option names, '<empty>' spacers and '[SCREEN]' links in display order */
  items: string[];
}

export const SCREENS: ScreenDef[] = [
  {
    id: 'LIGHTING', label: 'Lighting', comment: 'Sunlight, ambient light, nights and torches.', columns: 2,
    items: ['SUN_STRENGTH', 'TORCH_STRENGTH', 'SUN_R', 'TORCH_R', 'SUN_G', 'TORCH_G', 'SUN_B', 'TORCH_B', '<empty>', '<empty>',
      'AMBIENT_STRENGTH', 'NIGHT_BRIGHTNESS', 'HAND_LIGHT'],
  },
  {
    id: 'SHADOWS', label: 'Shadows', comment: 'Sun and moon shadows, softness and cloud shadows.', columns: 2,
    items: ['SHADOWS', 'CLOUD_SHADOWS', 'SHADOW_BRIGHTNESS', 'SHADOW_SOFTNESS', 'sunPathRotation'],
  },
  {
    id: 'SKY', label: 'Sky & Fog', comment: 'Sky colors for each time of day, fog and rain fog.', columns: 2,
    items: ['SKY_CUSTOM', '[SKY_COLORS]', 'FOG_DENSITY', 'RAIN_FOG'],
  },
  {
    id: 'SKY_COLORS', label: 'Sky Colors', comment: 'Day sky, horizon, sunset and night sky colors.', columns: 3,
    items: ['SKY_R', 'SKY_G', 'SKY_B', 'HORIZON_R', 'HORIZON_G', 'HORIZON_B', 'SUNSET_R', 'SUNSET_G', 'SUNSET_B', 'NIGHT_R', 'NIGHT_G', 'NIGHT_B'],
  },
  {
    id: 'WATER', label: 'Water', comment: 'Water color, clarity, waves and reflections.', columns: 3,
    items: ['WATER_WAVES', 'WAVE_HEIGHT', 'WAVE_SPEED', 'WATER_REFLECTIONS', 'WATER_CLARITY', '<empty>', 'WATER_R', 'WATER_G', 'WATER_B'],
  },
  {
    id: 'WAVING', label: 'Waving Plants', comment: 'Leaves, grass, crops and vines moving in the wind.', columns: 2,
    items: ['WAVING_LEAVES', 'WAVING_PLANTS', 'WAVING_CROPS', 'WAVING_VINES', 'WAVING_STRENGTH', 'WAVING_SPEED'],
  },
  {
    id: 'POST', label: 'Effects', comment: 'Tone mapping, exposure, bloom, god rays and vignette.', columns: 2,
    items: ['TONEMAP', 'EXPOSURE', 'BLOOM', 'GODRAYS', 'BLOOM_STRENGTH', 'GODRAYS_STRENGTH', 'BLOOM_THRESHOLD', 'VIGNETTE_STRENGTH'],
  },
  {
    id: 'COLOR', label: 'Color Grading', comment: 'Contrast, saturation, vibrance, white balance and gamma.', columns: 2,
    items: ['CONTRAST', 'SATURATION', 'VIBRANCE', 'GAMMA', 'TEMPERATURE', 'TINT'],
  },
  {
    id: 'PERFORMANCE', label: 'Performance', comment: 'Quality settings that change your frame rate.', columns: 2,
    items: ['shadowMapResolution', 'shadowDistance', 'SHADOW_SAMPLES', 'GODRAYS_SAMPLES'],
  },
];

/** Main screen layout: pack info + profile, then the sub-screens. */
export const MAIN_SCREEN: string[] = [
  'PACK_INFO', '<profile>', '[LIGHTING]', '[SHADOWS]', '[SKY]', '[WATER]', '[WAVING]', '[POST]', '[COLOR]', '[PERFORMANCE]',
];

export interface ProfileDef {
  id: string;
  label: string;
  /** Option assignments, in shaders.properties syntax */
  items: string[];
}

/** Quality profiles (all set the same options, only the values differ). */
export const PROFILES: ProfileDef[] = [
  { id: 'LOW', label: 'Low', items: ['!SHADOWS', 'shadowMapResolution=1024', 'shadowDistance=64.0', 'SHADOW_SAMPLES=4', 'GODRAYS_SAMPLES=8'] },
  { id: 'MEDIUM', label: 'Medium', items: ['SHADOWS', 'shadowMapResolution=2048', 'shadowDistance=112.0', 'SHADOW_SAMPLES=8', 'GODRAYS_SAMPLES=12'] },
  { id: 'HIGH', label: 'High', items: ['SHADOWS', 'shadowMapResolution=3072', 'shadowDistance=160.0', 'SHADOW_SAMPLES=16', 'GODRAYS_SAMPLES=16'] },
  { id: 'ULTRA', label: 'Ultra', items: ['SHADOWS', 'shadowMapResolution=4096', 'shadowDistance=192.0', 'SHADOW_SAMPLES=24', 'GODRAYS_SAMPLES=24'] },
];

export const PROFILE_COMMENT = 'Low: no shadows, fastest. Medium: balanced. High: sharper, longer shadows. Ultra: for strong graphics cards.';
