import type { OptionDef, OptionValue, OptionValues } from '../../../core/types';

export const GROUPS = {
  color: 'Color & Tone',
  style: 'Style & Lens',
  foliage: 'Waving Plants',
  fog: 'Fog',
  lighting: 'Lighting',
} as const;

export const OPTIONS: OptionDef[] = [
  // Color & Tone
  { key: 'brightness', label: 'Brightness', group: GROUPS.color, type: 'range', default: 1, min: 0.5, max: 1.6, step: 0.01, unit: '×',
    description: 'Makes the whole world brighter or darker. Menus and the hotbar are never changed.' },
  { key: 'contrast', label: 'Contrast', group: GROUPS.color, type: 'range', default: 1, min: 0.5, max: 1.8, step: 0.01,
    description: 'Difference between dark and bright areas. 1 is vanilla.' },
  { key: 'saturation', label: 'Saturation', group: GROUPS.color, type: 'range', default: 1, min: 0, max: 2, step: 0.01,
    description: 'How colorful everything is. 0 is black and white, 1 is vanilla.' },
  { key: 'vibrance', label: 'Vibrance', group: GROUPS.color, type: 'range', default: 0, min: -1, max: 1, step: 0.01,
    description: 'Boosts dull colors more than colors that are already strong, so skin tones and bright blocks stay natural.' },
  { key: 'gamma', label: 'Midtones (gamma)', group: GROUPS.color, type: 'range', default: 1, min: 0.5, max: 2, step: 0.01,
    description: 'Brightens (above 1) or darkens (below 1) the middle tones while keeping pure black and white.' },
  { key: 'temperature', label: 'Temperature', group: GROUPS.color, type: 'range', default: 0, min: -1, max: 1, step: 0.01,
    description: 'Shifts the colors warmer (orange, positive) or cooler (blue, negative).' },
  { key: 'tintColor', label: 'Tint color', group: GROUPS.color, type: 'color', default: '#ffffff',
    description: 'A color the whole world is tinted with. Only its hue counts: a dark pick tints like its bright version, black and grey do nothing, and brightness stays about the same.' },
  { key: 'tintStrength', label: 'Tint strength', group: GROUPS.color, type: 'range', default: 0, min: 0, max: 1, step: 0.01,
    description: 'How strongly the tint color is applied. 0 turns the tint off.' },

  // Style & Lens
  { key: 'grayscale', label: 'Black & white', group: GROUPS.style, type: 'range', default: 0, min: 0, max: 1, step: 0.01,
    description: 'Fades the colors out. 1 is fully black and white.' },
  { key: 'sepia', label: 'Sepia', group: GROUPS.style, type: 'range', default: 0, min: 0, max: 1, step: 0.01,
    description: 'Old photograph look with brown tones.' },
  { key: 'posterize', label: 'Posterize', group: GROUPS.style, type: 'range', default: 0, min: 0, max: 16, step: 1, unit: 'levels',
    description: 'Limits every color channel to this many shades for a retro, comic-like look. 0 or 1 turns it off.' },
  { key: 'vignette', label: 'Vignette', group: GROUPS.style, type: 'range', default: 0, min: 0, max: 1, step: 0.01,
    description: 'Darkens the corners of the screen to draw the eye to the center.' },
  { key: 'bloom', label: 'Bloom', group: GROUPS.style, type: 'toggle', default: false,
    description: 'Bright things like the sun, lava and glowstone softly glow. Needs Minecraft 26.3 or newer.' },
  { key: 'bloomStrength', label: 'Bloom strength', group: GROUPS.style, type: 'range', default: 0.35, min: 0.05, max: 1, step: 0.01, dependsOn: 'bloom',
    description: 'How bright the glow is.' },
  { key: 'bloomThreshold', label: 'Bloom threshold', group: GROUPS.style, type: 'range', default: 0.7, min: 0.3, max: 0.95, step: 0.01, dependsOn: 'bloom',
    description: 'How bright something must be before it glows. Lower values make more things glow.' },

  // Waving plants
  { key: 'waving', label: 'Waving plants', group: GROUPS.foliage, type: 'toggle', default: false,
    description: 'Grass, ferns, sugar cane and vines sway in the wind. Works in Java 1.17 to 1.21.4 and 1.21.6 to 1.21.10.' },
  { key: 'waveAmount', label: 'Sway amount', group: GROUPS.foliage, type: 'range', default: 0.5, min: 0.1, max: 1, step: 0.01, dependsOn: 'waving',
    description: 'How far the tops of plants move.' },
  { key: 'waveSpeed', label: 'Sway speed', group: GROUPS.foliage, type: 'range', default: 1, min: 0.25, max: 3, step: 0.05, unit: '×', dependsOn: 'waving',
    description: 'How fast plants sway. The motion follows game time, so it pauses with the game.' },

  // Fog
  { key: 'fogStart', label: 'Fog start', group: GROUPS.fog, type: 'range', default: 1, min: 0.05, max: 1, step: 0.01, unit: '×',
    description: 'Where the distance haze begins, compared to vanilla. Lower values make the haze start closer for a misty look. Fog never ends further away than vanilla, so chunk edges stay hidden.' },
  { key: 'fogEnvironment', label: 'Water & weather fog distance', group: GROUPS.fog, type: 'range', default: 1, min: 0.25, max: 3, step: 0.05, unit: '×',
    description: 'How far you can see under water, in rain, in foggy biomes and during boss fights. Higher values let you see further. Blindness, Darkness, lava and powder snow keep their normal fog. Needs Minecraft 1.21.6 or newer.' },
  { key: 'fogTint', label: 'Fog tint', group: GROUPS.fog, type: 'color', default: '#ffffff',
    description: 'Tints the fog color. The fog still follows the time of day and biome.' },
  { key: 'fogTintStrength', label: 'Fog tint strength', group: GROUPS.fog, type: 'range', default: 0, min: 0, max: 1, step: 0.01,
    description: 'How strongly the fog tint is applied. 0 turns it off.' },

  // Lighting
  { key: 'nightDarkness', label: 'Darker nights & caves', group: GROUPS.lighting, type: 'range', default: 0, min: 0, max: 1, step: 0.01,
    description: 'Dim light gets dimmer, so nights and caves feel darker while daylight and torches stay bright. Needs Minecraft 1.21.2 or newer.' },
];

export const OPTION_KEYS: readonly string[] = OPTIONS.map((o) => o.key);
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
    description: 'Exactly how vanilla Minecraft looks. A clean starting point for your own settings.',
    values: {},
    swatch: ['#78a7ff', '#5bd35b'],
  },
  {
    id: 'cinematic',
    label: 'Cinematic',
    description: 'Film-like contrast, slightly muted warm colors, a soft vignette and a light distance haze.',
    values: {
      contrast: 1.18, saturation: 0.9, vibrance: 0.15, gamma: 0.95, temperature: 0.15,
      vignette: 0.45, fogStart: 0.75, bloom: true, bloomStrength: 0.3, bloomThreshold: 0.75,
    },
    swatch: ['#1f3a4a', '#ffb86b'],
  },
  {
    id: 'vivid',
    label: 'Vivid',
    description: 'Punchy, saturated colors and crisp contrast with gently swaying grass.',
    values: {
      contrast: 1.12, saturation: 1.3, vibrance: 0.35, brightness: 1.04,
      waving: true, waveAmount: 0.45, waveSpeed: 1,
    },
    swatch: ['#2f7de0', '#5bd35b'],
  },
  {
    id: 'soft',
    label: 'Soft',
    description: 'Low contrast, lifted midtones, pastel colors and a dreamy haze.',
    values: {
      contrast: 0.85, saturation: 0.85, gamma: 1.15, brightness: 1.03,
      tintColor: '#ffd6ec', tintStrength: 0.12, fogStart: 0.55, fogTint: '#ffe6f2', fogTintStrength: 0.35,
      bloom: true, bloomStrength: 0.45, bloomThreshold: 0.6, waving: true, waveAmount: 0.35, waveSpeed: 0.7,
    },
    swatch: ['#c9b6f0', '#ffd6e4'],
  },
  {
    id: 'noir',
    label: 'Noir',
    description: 'Black and white with hard contrast, a heavy vignette, dark nights and thick mist.',
    values: {
      grayscale: 1, contrast: 1.4, gamma: 0.9, vignette: 0.7, fogStart: 0.5, nightDarkness: 0.6,
    },
    swatch: ['#111111', '#bdbdbd'],
  },
  {
    id: 'retro',
    label: 'Retro',
    description: 'Posterized colors, warm faded film tones and a rounded vignette, like an old console.',
    values: {
      posterize: 6, sepia: 0.25, saturation: 1.15, contrast: 1.05, vignette: 0.35, temperature: 0.1,
    },
    swatch: ['#8a5a2b', '#e8c170'],
  },
  {
    id: 'warm-sunset',
    label: 'Warm Sunset',
    description: 'Golden, warm light with orange-tinted fog and glowing highlights all day long.',
    values: {
      temperature: 0.6, tintColor: '#ffb070', tintStrength: 0.2, saturation: 1.1, contrast: 1.08,
      fogStart: 0.7, fogTint: '#ff9a5a', fogTintStrength: 0.45, vignette: 0.3,
      bloom: true, bloomStrength: 0.5, bloomThreshold: 0.65,
    },
    swatch: ['#ff8a3d', '#ffd8a8'],
  },
  {
    id: 'cool-winter',
    label: 'Cool Winter',
    description: 'Crisp blue tones, pale colors, icy fog and darker, colder nights.',
    values: {
      temperature: -0.55, tintColor: '#bfe3ff', tintStrength: 0.15, saturation: 0.8, gamma: 1.05,
      fogStart: 0.6, fogTint: '#cfe8ff', fogTintStrength: 0.5, fogEnvironment: 0.8, nightDarkness: 0.3,
    },
    swatch: ['#3d6fa8', '#dff1ff'],
  },
];

/** Default values with one preset applied (unknown ids give plain defaults). */
export function presetValues(id: string): OptionValues {
  const p = PRESETS.find((x) => x.id === id);
  const out = defaults();
  if (p) for (const [k, val] of Object.entries(p.values)) if (val !== undefined) out[k] = val;
  return out;
}

// ---------------------------------------------------------------- typed, validated settings

export type RGB = [number, number, number];

export interface Settings {
  brightness: number;
  contrast: number;
  saturation: number;
  vibrance: number;
  gamma: number;
  temperature: number;
  tintColor: RGB;
  tintStrength: number;
  grayscale: number;
  sepia: number;
  /** 0 = off, otherwise 2..16 levels per channel */
  posterize: number;
  vignette: number;
  bloom: boolean;
  bloomStrength: number;
  bloomThreshold: number;
  waving: boolean;
  waveAmount: number;
  waveSpeed: number;
  fogStart: number;
  fogEnvironment: number;
  fogTint: RGB;
  fogTintStrength: number;
  nightDarkness: number;
}

function def(key: string): OptionDef {
  const d = OPTION_MAP.get(key);
  if (!d) throw new Error(`Unknown option ${key}`);
  return d;
}

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

function readNumber(v: OptionValues, key: string): number {
  const d = def(key);
  const raw: OptionValue | undefined = v[key];
  let n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
  if (!Number.isFinite(n)) n = d.default as number;
  n = clamp(n, d.min ?? -Infinity, d.max ?? Infinity);
  if (d.step !== undefined && Number.isInteger(d.step)) n = Math.round(n);
  return n;
}

function readBool(v: OptionValues, key: string): boolean {
  const raw = v[key];
  if (typeof raw === 'boolean') return raw;
  if (raw === 'true' || raw === 1) return true;
  if (raw === 'false' || raw === 0) return false;
  return def(key).default as boolean;
}

/** Parses '#rgb' / '#rrggbb' (with or without '#'); null when invalid. */
export function parseHex(value: unknown): RGB | null {
  if (typeof value !== 'string') return null;
  let s = value.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(s)) s = s.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(s)) return null;
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

export function toHex(c: RGB): string {
  return '#' + c.map((x) => clamp(Math.round(x), 0, 255).toString(16).padStart(2, '0')).join('');
}

function readColor(v: OptionValues, key: string): RGB {
  return parseHex(v[key]) ?? (parseHex(def(key).default) as RGB);
}

function copyDefined(v: OptionValues | Partial<OptionValues> | null | undefined): OptionValues {
  const src: OptionValues = {};
  if (v && typeof v === 'object') {
    for (const [k, val] of Object.entries(v)) if (val !== undefined && k !== '__proto__') src[k] = val;
  }
  return src;
}

/** Every option present, ranges clamped, colors as lowercase #rrggbb; unknown keys dropped. */
export function normalizeOptions(v: OptionValues | Partial<OptionValues> | null | undefined): OptionValues {
  const src = copyDefined(v);
  const out: OptionValues = {};
  for (const d of OPTIONS) {
    if (d.type === 'range') out[d.key] = readNumber(src, d.key);
    else if (d.type === 'toggle') out[d.key] = readBool(src, d.key);
    else if (d.type === 'color') out[d.key] = toHex(readColor(src, d.key));
    else out[d.key] = typeof src[d.key] === 'string' && d.options?.some((o) => o.value === src[d.key]) ? src[d.key] : d.default;
  }
  return out;
}

/** Fills missing values with defaults, clamps ranges and rejects invalid colors. */
export function readSettings(v: OptionValues | Partial<OptionValues> | null | undefined): Settings {
  const src = copyDefined(v);
  const posterize = readNumber(src, 'posterize');
  return {
    brightness: readNumber(src, 'brightness'),
    contrast: readNumber(src, 'contrast'),
    saturation: readNumber(src, 'saturation'),
    vibrance: readNumber(src, 'vibrance'),
    gamma: readNumber(src, 'gamma'),
    temperature: readNumber(src, 'temperature'),
    tintColor: readColor(src, 'tintColor'),
    tintStrength: readNumber(src, 'tintStrength'),
    grayscale: readNumber(src, 'grayscale'),
    sepia: readNumber(src, 'sepia'),
    posterize: posterize >= 2 ? posterize : 0,
    vignette: readNumber(src, 'vignette'),
    bloom: readBool(src, 'bloom'),
    bloomStrength: readNumber(src, 'bloomStrength'),
    bloomThreshold: readNumber(src, 'bloomThreshold'),
    waving: readBool(src, 'waving'),
    waveAmount: readNumber(src, 'waveAmount'),
    waveSpeed: readNumber(src, 'waveSpeed'),
    fogStart: readNumber(src, 'fogStart'),
    fogEnvironment: readNumber(src, 'fogEnvironment'),
    fogTint: readColor(src, 'fogTint'),
    fogTintStrength: readNumber(src, 'fogTintStrength'),
    nightDarkness: readNumber(src, 'nightDarkness'),
  };
}
