// Baseline values of the vanilla Vibrant Visuals settings and fog definitions
// (Bedrock 1.26.50 resource pack), stored as compact parameter tables. The generator applies
// the user's adjustments on top of these so that "Default" reproduces the vanilla look,
// biome by biome. Structure only; no game art.

import type { Curve, RGB } from './keyframes';
import { flat } from './keyframes';

export const VANILLA_BASE_VERSION = '1.26.50';

export type Dimension = 'overworld' | 'nether' | 'end';

// ---------------------------------------------------------------- lighting

export interface VanillaLighting {
  id: string;
  file: string;
  dimension: Dimension;
  sunIlluminance: Curve<number>;
  sunColor: Curve<RGB>;
  moonIlluminance: Curve<number>;
  moonColor: Curve<RGB>;
  orbitalOffset: number;
  flash: { illuminance: number; color: RGB };
  emissiveDesaturation: number;
  ambient: { illuminance: number; color: RGB };
  skyIntensity: number;
}

const sunDay = (peak: number, low = 1, glow = 0.01): Curve<number> => [
  [0, peak], [0.05, peak], [0.282, low], [0.2915, glow], [0.292, 0],
  [0.709, 0], [0.719, low], [0.95, peak], [1, peak],
];
const SUN_SHORT_DAY: Curve<number> = [[0, 100], [0.05, 100], [0.313846, 0], [0.68423, 0], [0.95, 100], [1, 100]];
const SUN_PALE: Curve<number> = [[0, 5], [0.05, 5], [0.282, 0.2], [0.292, 0], [0.709, 0], [0.719, 0.2], [0.95, 5], [1, 5]];

const SUN_COLOR_KEYS = [0.140811, 0.216944, 0.242908, 0.269504, 0.314561, 0.506998, 0.717949, 0.801062, 1] as const;
const sunColors = (colors: RGB[]): Curve<RGB> => SUN_COLOR_KEYS.map((t, i) => [t, colors[i]] as const);
const SUN_COLOR: Curve<RGB> = sunColors([
  [255, 173, 81], [255, 155, 82], [255, 127, 0], [255, 127, 0], [255, 154, 154],
  [255, 105, 0], [255, 133, 133], [255, 173, 81], [255, 227, 215],
]);
const SUN_COLOR_MUSHROOM: Curve<RGB> = sunColors([
  [174, 158, 255], [182, 158, 255], [187, 153, 255], [187, 153, 255], [242, 229, 255],
  [170, 153, 255], [232, 209, 255], [174, 158, 255], [221, 214, 255],
]);
const sunUniform = (c: RGB): Curve<RGB> => sunColors(SUN_COLOR_KEYS.map(() => c));

const MOON_NIGHT: Curve<number> = [[0, 0], [0.2, 0], [0.225, 0.4], [0.735, 0.4], [0.75, 0], [1, 0]];
const WHITE: RGB = [255, 255, 255];
const DEFAULT_FLASH = { illuminance: 10, color: [228, 93, 255] as RGB };
const DEFAULT_AMBIENT = { illuminance: 0.02, color: WHITE };

function overworldLighting(name: string, o: Partial<VanillaLighting> = {}): VanillaLighting {
  return {
    id: `minecraft:${name}`,
    file: name === 'default_lighting' ? 'global.json' : `${name}.json`,
    dimension: 'overworld',
    sunIlluminance: sunDay(100),
    sunColor: SUN_COLOR,
    moonIlluminance: MOON_NIGHT,
    moonColor: flat<RGB>([163, 182, 255]),
    orbitalOffset: 0,
    flash: DEFAULT_FLASH,
    emissiveDesaturation: 0,
    ambient: DEFAULT_AMBIENT,
    skyIntensity: 1,
    ...o,
  };
}

export const VANILLA_LIGHTING: readonly VanillaLighting[] = [
  overworldLighting('default_lighting'),
  overworldLighting('cold_lighting', { sunIlluminance: SUN_SHORT_DAY }),
  overworldLighting('coolish_lighting', { sunIlluminance: SUN_SHORT_DAY }),
  overworldLighting('desert_lighting', { moonColor: flat<RGB>([62, 108, 255]) }),
  {
    ...overworldLighting('end_lighting'),
    dimension: 'end',
    sunIlluminance: flat(100),
    sunColor: flat(WHITE),
    moonIlluminance: flat(100),
    moonColor: flat(WHITE),
    flash: { illuminance: 3, color: [228, 93, 255] },
    ambient: { illuminance: 0.125, color: WHITE },
  },
  overworldLighting('hot_lighting', { sunIlluminance: SUN_SHORT_DAY, moonColor: flat<RGB>([36, 86, 255]) }),
  overworldLighting('ice_plains_spikes_lighting', { sunIlluminance: sunDay(50), sunColor: sunUniform([215, 224, 255]) }),
  overworldLighting('mangrove_swamp_lighting', { moonColor: flat<RGB>([88, 129, 255]) }),
  overworldLighting('mesa_lighting', { moonColor: flat<RGB>([88, 129, 255]) }),
  overworldLighting('mushroom_island_lighting', { sunColor: SUN_COLOR_MUSHROOM }),
  {
    ...overworldLighting('nether_lighting'),
    dimension: 'nether',
    sunIlluminance: flat(100),
    sunColor: flat(WHITE),
    moonIlluminance: flat(100),
    moonColor: flat(WHITE),
    ambient: { illuminance: 0.5, color: WHITE },
  },
  overworldLighting('pale_garden_lighting', {
    sunIlluminance: SUN_PALE,
    sunColor: sunUniform([195, 216, 255]),
    moonColor: flat<RGB>([217, 225, 255]),
  }),
  overworldLighting('roofed_forest_lighting', { sunIlluminance: sunDay(70) }),
  overworldLighting('swampland_lighting'),
  overworldLighting('warmish_lighting', { moonColor: flat<RGB>([88, 129, 255]) }),
];

// ---------------------------------------------------------------- atmospherics

export type BlendStops = Record<'min' | 'start' | 'mie_start' | 'max', number | Curve<number>>;

export interface VanillaAtmospherics {
  id: string;
  file: string;
  dimension: Dimension;
  blend: BlendStops;
  rayleigh: Curve<number>;
  sunMie: Curve<number>;
  moonMie: Curve<number>;
  glare: Curve<number>;
  zenith: Curve<RGB>;
  horizon: Curve<RGB>;
}

const OVERWORLD_BLEND: BlendStops = {
  min: flat(0),
  start: [[0, 0.8], [0.25, 0.5], [0.300912, 0.25], [0.75, 0.25], [0.827004, 0.5], [1, 0.8]],
  mie_start: [[0, 0.5], [0.1, 0.5], [0.2, 1], [0.8, 1], [0.9, 0.5], [1, 0.5]],
  max: flat(0.25),
};
const RAYLEIGH: Curve<number> = [[0, 10], [0.138743, 10], [0.25, 5], [0.330402, 5], [0.640704, 5], [0.717412, 5], [0.92931, 10], [1, 10]];
const SUN_MIE: Curve<number> = [[0, 0], [0.2, 0], [0.25, 0.75], [0.4, 0], [0.6, 0], [0.75, 0.75], [0.8, 0], [1, 0]];
const GLARE: Curve<number> = [[0, 0], [0.2, 0], [0.25, 0.0737705], [0.4, 0], [0.6, 0], [0.75, 0.05], [0.8, 0], [1, 0]];

const zenith = (noon: RGB, day: RGB, night: RGB): Curve<RGB> => [
  [0, noon], [0.199685, day], [0.35256, night], [0.64488, night], [0.800315, day],
];

const HORIZON_KEYS = [
  0, 0.167053, 0.217114, 0.239274, 0.276382, 0.361464, 0.401799,
  0.616996, 0.654508, 0.706861, 0.748744, 0.786432, 0.830049,
] as const;
const horizon = (colors: RGB[]): Curve<RGB> => HORIZON_KEYS.map((t, i) => [t, colors[i]] as const);
const HORIZON_COLORS: RGB[] = [
  [183, 189, 198], [183, 189, 198], [243, 184, 149], [255, 187, 163], [136, 108, 108], [168, 168, 238], [83, 117, 157],
  [83, 117, 157], [144, 144, 238], [223, 187, 237], [255, 211, 179], [226, 213, 191], [183, 189, 198],
];
/** Default horizon with a different noon colour (first and last key). */
const horizonNoon = (c: RGB): Curve<RGB> => horizon(HORIZON_COLORS.map((x, i) => (i === 0 || i === 12 ? c : x)));

const SKY_DAY: RGB = [103, 130, 170];
const SKY_NIGHT: RGB = [40, 40, 40];

function overworldAtmos(name: string, o: Partial<VanillaAtmospherics> = {}): VanillaAtmospherics {
  return {
    id: `minecraft:${name}`,
    file: name === 'default_atmospherics' ? 'atmospherics.json' : `${name}.json`,
    dimension: 'overworld',
    blend: OVERWORLD_BLEND,
    rayleigh: RAYLEIGH,
    sunMie: SUN_MIE,
    moonMie: flat(0),
    glare: GLARE,
    zenith: zenith(SKY_DAY, SKY_DAY, SKY_NIGHT),
    horizon: horizon(HORIZON_COLORS),
    ...o,
  };
}

/** Nether biomes: one flat sky colour; vanilla omits the mie/glare fields (written as 0). */
function netherAtmos(name: string, color: RGB, rayleigh: number): VanillaAtmospherics {
  return {
    id: `minecraft:${name}`,
    file: `${name}.json`,
    dimension: 'nether',
    blend: { min: 0, start: 0.8, mie_start: 0.5, max: 1 },
    rayleigh: flat(rayleigh),
    sunMie: flat(0),
    moonMie: flat(0),
    glare: flat(0),
    zenith: flat(color),
    horizon: flat(color),
  };
}

export const VANILLA_ATMOSPHERICS: readonly VanillaAtmospherics[] = [
  overworldAtmos('default_atmospherics'),
  netherAtmos('basalt_deltas_atmospherics', [104, 95, 112], 0.1),
  netherAtmos('crimson_forest_atmospherics', [51, 3, 3], 0.15),
  overworldAtmos('desert_atmospherics', {
    zenith: zenith([73, 132, 157], [73, 132, 157], [35, 47, 67]),
    horizon: horizonNoon([200, 194, 172]),
  }),
  {
    id: 'minecraft:end_atmospherics',
    file: 'end_atmospherics.json',
    dimension: 'end',
    blend: { min: 0, start: 1, mie_start: 0.5, max: 0.25 },
    // Vanilla uses 50, above the documented limit of 11; kept as shipped.
    rayleigh: flat(50),
    sunMie: flat(0),
    moonMie: flat(0),
    glare: flat(0),
    zenith: flat<RGB>([22, 17, 36]),
    horizon: flat<RGB>([1, 1, 5]),
  },
  netherAtmos('hell_atmospherics', [51, 8, 8], 0.15),
  overworldAtmos('hot_atmospherics', { zenith: zenith(SKY_DAY, SKY_DAY, [32, 46, 71]) }),
  overworldAtmos('ice_plains_spikes_atmospherics', {
    zenith: zenith([159, 175, 196], [159, 175, 196], SKY_NIGHT),
    horizon: horizon([
      [159, 175, 196], [159, 175, 196], [159, 175, 196], [159, 175, 196], [136, 108, 108], [105, 114, 129], [83, 117, 157],
      [105, 114, 129], [144, 155, 238], [203, 187, 237], [159, 175, 196], [159, 175, 196], [159, 175, 196],
    ]),
  }),
  overworldAtmos('mangrove_swamp_atmospherics', { zenith: zenith([140, 175, 228], SKY_DAY, SKY_NIGHT) }),
  overworldAtmos('mesa_atmospherics', {
    zenith: zenith([71, 140, 163], [71, 140, 163], [37, 48, 63]),
    horizon: horizonNoon([203, 192, 160]),
  }),
  overworldAtmos('mushroom_island_atmospherics', {
    zenith: zenith([129, 147, 173], [129, 147, 173], SKY_NIGHT),
    horizon: horizon([
      [233, 255, 187], [183, 189, 198], [255, 97, 97], [255, 97, 97], [136, 108, 108], [168, 168, 238], [106, 83, 157],
      [106, 83, 157], [144, 144, 238], [223, 187, 237], [200, 146, 255], [226, 213, 191], [233, 255, 187],
    ]),
  }),
  overworldAtmos('pale_garden_atmospherics', {
    zenith: zenith([122, 127, 135], [122, 127, 135], SKY_NIGHT),
    horizon: horizonNoon([198, 195, 183]),
  }),
  overworldAtmos('roofed_forest_atmospherics', { zenith: zenith([55, 87, 122], SKY_DAY, SKY_NIGHT) }),
  netherAtmos('soulsand_valley_atmospherics', [27, 71, 69], 0.15),
  overworldAtmos('swampland_atmospherics', { zenith: zenith([128, 153, 170], [139, 147, 133], SKY_NIGHT) }),
  overworldAtmos('warmish_atmospherics', { zenith: zenith(SKY_DAY, SKY_DAY, [37, 48, 63]) }),
  netherAtmos('warped_forest_atmospherics', [30, 15, 30], 0.25),
];

// ---------------------------------------------------------------- colour grading

export interface VanillaColorGrading {
  id: string;
  file: string;
  temperature: number;
  contrast: number;
  saturation: number;
  gain: number;
  gamma: number;
  offset: number;
}

const grading = (name: string, temperature: number, contrast = 1.15, saturation = 1.05): VanillaColorGrading => ({
  id: `minecraft:${name}`,
  file: name === 'default_color_grading' ? 'color_grading.json' : `${name}.json`,
  temperature,
  contrast,
  saturation,
  gain: 1,
  gamma: 2.2,
  offset: 0,
});

export const VANILLA_COLOR_GRADING: readonly VanillaColorGrading[] = [
  grading('default_color_grading', 6500),
  grading('cold_color_grading', 10000),
  grading('coolish_color_grading', 9000),
  grading('desert_color_grading', 4400),
  grading('hot_color_grading', 4000, 1.3),
  grading('ice_plains_spikes_color_grading', 11000),
  grading('lush_caves_color_grading', 4800, 1.3),
  grading('mangrove_swamp_color_grading', 5125),
  grading('mesa_color_grading', 4800, 1.15, 1.0),
  grading('mushroom_island_color_grading', 6500),
  grading('pale_garden_color_grading', 9000),
  grading('roofed_forest_color_grading', 6500),
  grading('swampland_color_grading', 6500),
  grading('warmish_color_grading', 4800),
];

export const VANILLA_TONE_MAPPING = 'generic';

// ---------------------------------------------------------------- water

export const VANILLA_WATER = {
  id: 'minecraft:default_water',
  file: 'water.json',
  particles: { chlorophyll: 0, suspended_sediment: 0, cdom: 0 },
  caustics: { enabled: true, frame_length: 0.09, scale: 0.5, power: 1 },
  waves: {
    enabled: false,
    frequency: 1,
    octaves: 28,
    depth: 1,
    speed: 2,
    shape: 1.5,
    pull: 0.38,
    mix: 0.2,
    frequency_scaling: 1.2,
    speed_scaling: 1.03,
  },
} as const;

// ---------------------------------------------------------------- fogs

export type FogMedium = 'air' | 'weather' | 'water' | 'lava' | 'lava_resistance' | 'powder_snow';

export interface DistanceFog {
  fog_start: number;
  fog_end: number;
  fog_color: string;
  render_distance_type: 'fixed' | 'render';
  /** Only on water fog */
  transition?: boolean;
}

export interface VanillaVolumetric {
  density: number;
  scattering: number;
  absorption: RGB | [number, number, number];
  g: number;
}

export interface VanillaFog {
  id: string;
  file: string;
  format: '1.16.100' | '1.21.90';
  distance: Partial<Record<FogMedium, DistanceFog>>;
  volumetric?: VanillaVolumetric;
}

/** The water transition fog is identical in every vanilla fog file. */
export const WATER_TRANSITION = { init_start: 0, init_end: 0.01, min_percent: 0.25, mid_seconds: 5, mid_percent: 0.6, max_seconds: 30 } as const;
export const VOLUMETRIC_HEIGHT = 320;

const water = (end: number, color: string): Partial<Record<FogMedium, DistanceFog>> => ({
  water: { fog_start: 0, fog_end: end, fog_color: color, render_distance_type: 'fixed', transition: true },
});
const OVERWORLD_AIR: Partial<Record<FogMedium, DistanceFog>> = {
  air: { fog_start: 0.92, fog_end: 1, fog_color: '#ABD2FF', render_distance_type: 'render' },
  ...water(60, '#44AFF5'),
  weather: { fog_start: 0.23, fog_end: 0.7, fog_color: '#666666', render_distance_type: 'render' },
  lava: { fog_start: 0, fog_end: 0.64, fog_color: '#991A00', render_distance_type: 'fixed' },
  lava_resistance: { fog_start: 2, fog_end: 4, fog_color: '#991A00', render_distance_type: 'fixed' },
};
const nether = (color: string, waterColor: string): Partial<Record<FogMedium, DistanceFog>> => ({
  air: { fog_start: 10, fog_end: 96, fog_color: color, render_distance_type: 'fixed' },
  ...water(15, waterColor),
  weather: { fog_start: 10, fog_end: 96, fog_color: color, render_distance_type: 'fixed' },
});
const vol = (density: number, scattering: number, g: number, absorption: RGB | [number, number, number] = [0, 0, 0]): VanillaVolumetric =>
  ({ density, scattering, absorption, g });

const NONE = vol(0, 0, 0.75);
const HUMID = vol(0.05, 0.06, 0.4);
const TEMPERATE = vol(0.05, 0.04, 0.6);
const SWAMP = vol(0.05, 0.06, 0.4, [0.2549019753932953, 0.12995001673698425, 0.18875093758106232]);
const MUSHROOM = vol(0.05, 0.01, 0.3, [0.042, 0.137, 0.012]);
const THICK = vol(0.07, 0.5, 0.3, [0.25, 0.125, 0.125]);

function fog(
  name: string,
  distance: Partial<Record<FogMedium, DistanceFog>>,
  volumetric?: VanillaVolumetric,
  o: { id?: string; format?: VanillaFog['format'] } = {},
): VanillaFog {
  return {
    id: `minecraft:fog_${o.id ?? name}`,
    file: `${name}_fog_setting.json`,
    format: o.format ?? (volumetric ? '1.21.90' : '1.16.100'),
    distance,
    ...(volumetric ? { volumetric } : {}),
  };
}

export const VANILLA_FOGS: readonly VanillaFog[] = [
  fog('bamboo_jungle', water(60, '#14A2C5'), HUMID),
  fog('bamboo_jungle_hills', water(60, '#1B9ED8'), HUMID),
  fog('basalt_deltas', nether('#685f70', '#423e42')),
  fog('beach', water(60, '#157cab'), TEMPERATE),
  fog('birch_forest', water(60, '#0677ce')),
  fog('birch_forest_hills', water(60, '#0a74c4')),
  fog('cherry_grove', water(60, '#5db7ef')),
  fog('cold_beach', water(60, '#1463a5')),
  fog('cold_ocean', water(60, '#14559b')),
  fog('cold_taiga', water(60, '#205e83'), TEMPERATE),
  fog('cold_taiga_hills', water(60, '#245b78'), TEMPERATE),
  fog('cold_taiga_mutated', water(60, '#205e83'), TEMPERATE),
  fog('crimson_forest', nether('#330303', '#905957')),
  fog('dappled_forest', water(60, '#1E97F2'), undefined, { format: '1.21.90' }),
  fog('deep_cold_ocean', water(60, '#185390')),
  fog('deep_frozen_ocean', water(60, '#1a4879'), NONE),
  fog('deep_lukewarm_ocean', water(60, '#0e72b9'), TEMPERATE),
  fog('deep_ocean', water(60, '#1463a5')),
  fog('deep_warm_ocean', water(60, '#0686ca'), TEMPERATE),
  fog('default', OVERWORLD_AIR),
  fog('desert', water(60, '#32A598'), NONE),
  fog('desert_hills', water(60, '#1a7aa1'), NONE),
  fog('dry', OVERWORLD_AIR, NONE),
  fog('extreme_hills_edge', water(60, '#045cd5')),
  fog('extreme_hills', water(60, '#007BF7')),
  fog('extreme_hills_mutated', water(60, '#0E63AB')),
  fog('extreme_hills_plus_trees', water(60, '#0E63AB'), TEMPERATE),
  fog('extreme_hills_plus_trees_mutated', water(60, '#0E63AB'), TEMPERATE),
  fog('flower_forest', water(60, '#20A3CC'), NONE),
  fog('forest', water(60, '#1E97F2')),
  fog('forest_hills', water(60, '#056bd1')),
  fog('frozen_ocean', water(60, '#174985'), NONE),
  fog('frozen_river', water(60, '#185390'), NONE),
  fog('hell', nether('#330808', '#905957')),
  fog('humid', OVERWORLD_AIR, HUMID),
  fog('ice_mountains', water(60, '#1156a7'), NONE),
  fog('ice_plains', water(60, '#14559b'), NONE),
  fog('ice_plains_spikes', water(60, '#14559b'), vol(0.05, 0.02, 0.3)),
  fog('jungle_edge', water(60, '#0D8AE3'), TEMPERATE),
  fog('jungle', water(60, '#14A2C5'), HUMID),
  fog('jungle_hills', water(60, '#1B9ED8'), HUMID),
  fog('jungle_mutated', water(60, '#1B9ED8'), HUMID),
  fog('lukewarm_ocean', water(60, '#0a74c4'), TEMPERATE),
  fog('lush_caves', OVERWORLD_AIR, HUMID),
  fog('mangrove_swamp', water(30, '#4d7a60'), HUMID),
  fog('mega_spruce_taiga', water(60, '#2d6d77')),
  // The vanilla file name is misspelled; the identifier is not.
  fog('mega_spruse_taiga_mutated', water(60, '#2d6d77'), undefined, { id: 'mega_spruce_taiga_mutated' }),
  fog('mega_taiga', water(60, '#2d6d77'), TEMPERATE),
  fog('mega_taiga_hills', water(60, '#286378'), TEMPERATE),
  fog('mega_taiga_mutated', water(60, '#2d6d77')),
  fog('mesa_bryce', water(60, '#497F99'), NONE),
  fog('mesa', water(60, '#4E7F81'), NONE),
  fog('mesa_mutated', water(60, '#497F99')),
  fog('mesa_plateau', water(60, '#55809E'), NONE),
  fog('mesa_plateau_stone', water(60, '#55809E'), NONE),
  fog('mushroom_island', water(60, '#8a8997'), MUSHROOM),
  fog('mushroom_island_shore', water(60, '#818193'), MUSHROOM),
  fog('ocean', water(60, '#1165b0')),
  fog('pale_garden', {
    air: { fog_start: 0.92, fog_end: 1, fog_color: '#817770', render_distance_type: 'render' },
    weather: { fog_start: 0.23, fog_end: 0.7, fog_color: '#403C44', render_distance_type: 'render' },
    ...water(60, '#556980'),
  }, THICK),
  fog('plains', water(60, '#44AFF5')),
  fog('powder_snow', { powder_snow: { fog_start: 0, fog_end: 2, fog_color: '#9FBBC8', render_distance_type: 'fixed' } }),
  fog('river', water(60, '#0084FF')),
  fog('roofed_forest', water(60, '#3B6CD1'), vol(0.05, 0.04, 0.75)),
  fog('roofed_forest_mutated', OVERWORLD_AIR, vol(0.05, 0.04, 0.75)),
  fog('savanna', water(60, '#2C8B9C')),
  fog('savanna_mutated', water(60, '#2590A8')),
  fog('savanna_plateau', water(60, '#2590A8')),
  fog('semi_humid', OVERWORLD_AIR, TEMPERATE),
  fog('soulsand_valley', nether('#1B4745', '#905957')),
  fog('stone_beach', water(60, '#0d67bb')),
  fog('sulfur_cave', {
    air: { fog_start: 0.92, fog_end: 1, fog_color: '#8cb831', render_distance_type: 'render' },
    weather: { fog_start: 0.23, fog_end: 0.7, fog_color: '#8cb831', render_distance_type: 'render' },
    ...water(60, '#17543c'),
  }, THICK, { id: 'sulfur_caves' }),
  fog('sunflower_plains', water(60, '#44AFF5'), NONE),
  fog('swampland', water(30, '#232317'), SWAMP),
  fog('swampland_mutated', water(30, '#232317'), SWAMP),
  fog('taiga', water(60, '#287082'), TEMPERATE),
  fog('taiga_hills', water(60, '#236583'), TEMPERATE),
  fog('taiga_mutated', water(60, '#1E6B82'), TEMPERATE),
  fog('the_end', {
    air: { fog_start: 0.92, fog_end: 1, fog_color: '#0B080C', render_distance_type: 'render' },
    ...water(15, '#62529e'),
  }, vol(0.25, 0.02, 0.8)),
  fog('warm_ocean', water(60, '#0289d5'), TEMPERATE),
  fog('warped_forest', nether('#1a051A', '#905957')),
];
