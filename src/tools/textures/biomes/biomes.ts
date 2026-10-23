// Biome colours: how the game picks grass, leaf and leaf-litter colours from the colour maps
// (textures/colormap/*.png) by a biome's temperature and rainfall, the biomes the editor marks on
// them, and where the game uses other colours instead. No DOM.
//
// Checked against the game: the lookup is ColorMapColorUtil.get in 26.3 (the same arithmetic in
// every version from 1.6.1): rainfall *= temperature, x = (int) ((1 - temperature) * 255),
// y = (int) ((1 - rainfall) * 255), index = y << 8 | x, with both values clamped to 0..1 as floats
// first (Biome.getGrassColorFromTexture), so the maps are read as 256 x 256. Climates are the
// game's: data/minecraft/worldgen/biome/*.json (1.19+), the biome classes before (1.6.1 has a cold
// taiga and a hotter jungle); Bedrock's are bedrock-samples' behavior_pack/biomes/*.biome.json and
// its colours the client biome files (resource_pack/biomes/*.client_biome.json). Fixed colours:
// swamps since 1.7 draw their grass in one of two greens picked by noise
// (BiomeSpecialEffects.GrassColorModifier.SWAMP: 0x4C763C / 0x6A7039; 1.6 mixed the map's colour with
// 0x4E0E4E), dark forests mix the map's colour with 0x28340A, and badlands, cherry groves, pale gardens,
// mangrove swamps (leaves) and dappled forests have colours of their own. Java's spruce and birch
// leaves are always 0x619961 and 0x80A755 (BlockColors); Bedrock tints them from birch.png and
// evergreen.png (its block tint methods birch_foliage / evergreen_foliage) and swamps from their own
// maps.

import type { Edition } from '../../../core/types';
import { bundledPackFormat, comparePackFormats } from '../../../editions/java/packformats';

export type RGB = [number, number, number];

/** An image as the lookups read it (ImageData or the preview's RGBAImage) */
export interface MapImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/** The colour maps: Java has grass and foliage (and dry_foliage from 1.21.5), Bedrock all eight. */
export type ColorMap = 'grass' | 'foliage' | 'dry_foliage' | 'birch' | 'evergreen' | 'swamp_grass' | 'swamp_foliage' | 'mangrove_swamp_foliage';

const BEDROCK_MAPS: readonly ColorMap[] = ['grass', 'foliage', 'dry_foliage', 'birch', 'evergreen', 'swamp_grass', 'swamp_foliage', 'mangrove_swamp_foliage'];

/** Whether a Java version is the release or newer (newer snapshots the table doesn't know count as newer). */
export function javaAtLeast(version: string, release: string): boolean {
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

/** The colour maps a version reads. */
export function colorMapsOf(edition: Edition, version: string): ColorMap[] {
  if (edition === 'bedrock') return [...BEDROCK_MAPS];
  return javaAtLeast(version, '1.21.5') ? ['grass', 'foliage', 'dry_foliage'] : ['grass', 'foliage'];
}

/** The pack path of a colour map. */
export function colorMapPath(edition: Edition, map: ColorMap): string {
  return `${edition === 'java' ? 'assets/minecraft/textures/' : 'textures/'}colormap/${map}.png`;
}

/** The colour map a texture path is (null: it isn't one the game reads). */
export function colorMapOf(path: string, edition: Edition, version: string): ColorMap | null {
  const m = /(?:^|\/)textures\/colormap\/([a-z_]+)\.png$/.exec(path);
  if (!m) return null;
  const name = m[1] as ColorMap;
  return colorMapsOf(edition, version).includes(name) ? name : null;
}

// ---------------------------------------------------------------------------------------------
// The lookup

/** The cell of a 256 x 256 map the game reads for a climate (as ColorMapColorUtil.get). */
export function mapCell(temperature: number, downfall: number): { x: number; y: number } {
  // the climate is a float, clamped as a float, then used as a double
  const t = Math.fround(Math.min(1, Math.max(0, Math.fround(temperature))));
  const d = Math.fround(Math.min(1, Math.max(0, Math.fround(downfall)))) * t;
  return { x: Math.trunc((1 - t) * 255), y: Math.trunc((1 - d) * 255) };
}

/**
 * The colour of a map for a climate. A map of another size than the game's 256 x 256 is read at
 * the same place relative to its size (the game would read it wrongly: see mapIsGameSize).
 */
export function mapColor(img: MapImage, temperature: number, downfall: number): RGB | null {
  if (img.width < 1 || img.height < 1) return null;
  const c = mapCell(temperature, downfall);
  const x = img.width === 256 ? c.x : Math.min(img.width - 1, Math.floor((c.x * img.width) / 256));
  const y = img.height === 256 ? c.y : Math.min(img.height - 1, Math.floor((c.y * img.height) / 256));
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
}

/** The game reads colour maps as 256 x 256 pixels. */
export const mapIsGameSize = (img: { width: number; height: number }): boolean => img.width === 256 && img.height === 256;

/** True for a cell the game can read (below the diagonal: only warm places can be very rainy). */
export const cellUsed = (x: number, y: number): boolean => y >= x;

// ---------------------------------------------------------------------------------------------
// Biomes

/** Where a biome's colour comes from */
export type Look =
  /** The colour map at the biome's climate */
  | { kind: 'map'; map: ColorMap }
  /** The map's colour mixed half and half with another (dark forests; swamps in 1.6) */
  | { kind: 'mix'; map: ColorMap; with: RGB }
  /** A colour of the biome's own: the map isn't read */
  | { kind: 'fixed'; rgb: RGB }
  /** Two greens picked by noise as you walk (swamp grass, Java 1.7+): the map isn't read */
  | { kind: 'noise'; rgb: [RGB, RGB] };

export interface Climate {
  temperature: number;
  downfall: number;
}

export interface BiomeLooks {
  climate: Climate;
  grass: Look;
  foliage: Look;
  /** Leaf litter (null where the game has no dry foliage) */
  dry: Look | null;
  /** Bedrock's birch and spruce leaves (Java's are fixed colours, whatever the biome) */
  birch: Look;
  evergreen: Look;
  /**
   * Water: the biome's water colour (Java 1.13+, Bedrock). Before 1.13 Java's water texture is blue
   * and biomes multiply it by white (swamps by 0xE0FFAE).
   */
  water: RGB;
}

export type BiomeId =
  | 'desert' | 'savanna' | 'badlands' | 'jungle' | 'sparse_jungle' | 'mushroom_fields' | 'swamp' | 'mangrove_swamp'
  | 'plains' | 'forest' | 'dark_forest' | 'pale_garden' | 'birch_forest' | 'dappled_forest' | 'cherry_grove' | 'meadow'
  | 'river' | 'taiga' | 'windswept_hills' | 'snowy_taiga' | 'snowy_plains';

interface BiomeDef {
  id: BiomeId;
  /** Java: the first version with the biome and its climate (`old`: the climate of versions before `old.before`) */
  java: { since: string; climate: Climate; old?: { before: string; climate: Climate } } | null;
  /** Bedrock: its id and climate (the latest release's, from bedrock-samples) */
  bedrock: { id: string; climate: Climate; water: RGB } | null;
  /** Java water colour (1.13+) */
  water?: RGB;
}

const hex = (n: number): RGB => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
const cl = (temperature: number, downfall: number): Climate => ({ temperature, downfall });
const JAVA_WATER = hex(0x3f76e4);

/** The biomes marked on the maps, warm and dry first. */
const BIOMES: readonly BiomeDef[] = [
  { id: 'desert', java: { since: '1.6', climate: cl(2, 0) }, bedrock: { id: 'desert', climate: cl(2, 0), water: hex(0x32a598) } },
  { id: 'savanna', java: { since: '1.7', climate: cl(2, 0), old: { before: '1.18', climate: cl(1.2, 0) } }, bedrock: { id: 'savanna', climate: cl(1.2, 0), water: hex(0x2c8b9c) } },
  { id: 'badlands', java: { since: '1.7', climate: cl(2, 0) }, bedrock: { id: 'mesa', climate: cl(2, 0), water: hex(0x4e7f81) } },
  { id: 'jungle', java: { since: '1.6', climate: cl(0.95, 0.9), old: { before: '1.7', climate: cl(1.2, 0.9) } }, bedrock: { id: 'jungle', climate: cl(0.95, 0.9), water: hex(0x14a2c5) } },
  { id: 'sparse_jungle', java: { since: '1.7', climate: cl(0.95, 0.8) }, bedrock: { id: 'jungle_edge', climate: cl(0.95, 0.8), water: hex(0x0d8ae3) } },
  { id: 'mushroom_fields', java: { since: '1.6', climate: cl(0.9, 1) }, bedrock: { id: 'mushroom_island', climate: cl(0.9, 1), water: hex(0x8a8997) } },
  { id: 'swamp', java: { since: '1.6', climate: cl(0.8, 0.9) }, bedrock: { id: 'swampland', climate: cl(0.8, 0.9), water: hex(0x617b64) }, water: hex(0x617b64) },
  { id: 'mangrove_swamp', java: { since: '1.19', climate: cl(0.8, 0.9) }, bedrock: { id: 'mangrove_swamp', climate: cl(0.8, 0.9), water: hex(0x3a7a6a) }, water: hex(0x3a7a6a) },
  { id: 'plains', java: { since: '1.6', climate: cl(0.8, 0.4) }, bedrock: { id: 'plains', climate: cl(0.8, 0.4), water: hex(0x44aff5) } },
  { id: 'forest', java: { since: '1.6', climate: cl(0.7, 0.8) }, bedrock: { id: 'forest', climate: cl(0.7, 0.8), water: hex(0x1e97f2) } },
  { id: 'dark_forest', java: { since: '1.7', climate: cl(0.7, 0.8) }, bedrock: { id: 'roofed_forest', climate: cl(0.7, 0.8), water: hex(0x3b6cd1) } },
  { id: 'pale_garden', java: { since: '1.21.4', climate: cl(0.7, 0.8) }, bedrock: { id: 'pale_garden', climate: cl(0.7, 0.8), water: hex(0x76889d) }, water: hex(0x76889d) },
  { id: 'birch_forest', java: { since: '1.7', climate: cl(0.6, 0.6) }, bedrock: { id: 'birch_forest', climate: cl(0.6, 0.6), water: hex(0x0677ce) } },
  { id: 'dappled_forest', java: { since: '26.3', climate: cl(0.6, 0.6) }, bedrock: { id: 'dappled_forest', climate: cl(0.6, 0.6), water: hex(0x375154) }, water: hex(0x375154) },
  { id: 'cherry_grove', java: { since: '1.20', climate: cl(0.5, 0.8) }, bedrock: { id: 'cherry_grove', climate: cl(0.3, 0.8), water: hex(0x5db7ef) }, water: hex(0x5db7ef) },
  { id: 'meadow', java: { since: '1.18', climate: cl(0.5, 0.8) }, bedrock: { id: 'meadow', climate: cl(0.3, 0.8), water: hex(0x44aff5) }, water: hex(0x0e4ecf) },
  { id: 'river', java: { since: '1.6', climate: cl(0.5, 0.5) }, bedrock: { id: 'river', climate: cl(0.5, 0.5), water: hex(0x0084ff) } },
  { id: 'taiga', java: { since: '1.6', climate: cl(0.25, 0.8), old: { before: '1.7', climate: cl(0.05, 0.8) } }, bedrock: { id: 'taiga', climate: cl(0.25, 0.8), water: hex(0x287082) } },
  { id: 'windswept_hills', java: { since: '1.6', climate: cl(0.2, 0.3) }, bedrock: { id: 'extreme_hills', climate: cl(0.2, 0.3), water: hex(0x007bf7) } },
  { id: 'snowy_taiga', java: { since: '1.7', climate: cl(-0.5, 0.4) }, bedrock: { id: 'cold_taiga', climate: cl(-0.5, 0.4), water: hex(0x205e83) }, water: hex(0x3d57d6) },
  { id: 'snowy_plains', java: { since: '1.6', climate: cl(0, 0.5) }, bedrock: { id: 'ice_plains', climate: cl(0, 0.5), water: hex(0x14559b) } },
];

export const BIOME_IDS: readonly BiomeId[] = BIOMES.map((b) => b.id);
/** The biome previews show unless another is picked (the game's own default for its previews) */
export const DEFAULT_BIOME: BiomeId = 'plains';

/** The biomes a version has, in the order of the list. */
export function biomesOf(edition: Edition, version: string): BiomeId[] {
  return BIOMES.filter((b) => (edition === 'bedrock' ? !!b.bedrock : !!b.java && javaAtLeast(version, b.java.since))).map((b) => b.id);
}

/** The game's id of a biome in an edition (Bedrock names a few differently). */
export function gameBiomeId(id: BiomeId, edition: Edition): string {
  const b = BIOMES.find((x) => x.id === id);
  return edition === 'bedrock' ? (b?.bedrock?.id ?? id) : id;
}

const SWAMP_NOISE: [RGB, RGB] = [hex(0x4c763c), hex(0x6a7039)];

/** Where a biome's colours come from in a version (null: the version doesn't have it). */
export function biomeLooks(id: BiomeId, edition: Edition, version: string): BiomeLooks | null {
  const b = BIOMES.find((x) => x.id === id);
  if (!b) return null;
  const map = (m: ColorMap): Look => ({ kind: 'map', map: m });
  const fixed = (n: number): Look => ({ kind: 'fixed', rgb: hex(n) });
  if (edition === 'bedrock') {
    if (!b.bedrock) return null;
    const out: BiomeLooks = { climate: b.bedrock.climate, grass: map('grass'), foliage: map('foliage'), dry: map('dry_foliage'), birch: map('birch'), evergreen: map('evergreen'), water: b.bedrock.water };
    switch (id) {
      case 'swamp':
        return { ...out, grass: map('swamp_grass'), foliage: map('swamp_foliage'), dry: fixed(0x7b5334) };
      case 'mangrove_swamp':
        return { ...out, grass: map('swamp_grass'), foliage: map('mangrove_swamp_foliage'), dry: fixed(0x7b5334) };
      case 'badlands':
        return { ...out, grass: fixed(0x90814d), foliage: fixed(0xaea42a) };
      case 'cherry_grove':
        return { ...out, grass: fixed(0xb6db61), foliage: fixed(0xb6db61) };
      case 'pale_garden':
        return { ...out, grass: fixed(0x778272), foliage: fixed(0x878d76), dry: fixed(0xa0a69c) };
      case 'dappled_forest':
        return { ...out, grass: fixed(0xdf6827), foliage: fixed(0xe68e30), dry: fixed(0x8c3a04) };
      case 'dark_forest':
        // "grass_is_shaded": the map's colour, darkened (shown as Java mixes it)
        return { ...out, grass: { kind: 'mix', map: 'grass', with: hex(0x28340a) }, dry: fixed(0x7b5334) };
      default:
        return out;
    }
  }
  const j = b.java;
  if (!j || !javaAtLeast(version, j.since)) return null;
  const climate = j.old && !javaAtLeast(version, j.old.before) ? j.old.climate : j.climate;
  const dry = javaAtLeast(version, '1.21.5') ? map('dry_foliage') : null;
  const out: BiomeLooks = {
    climate,
    grass: map('grass'),
    foliage: map('foliage'),
    dry,
    birch: fixed(0x80a755),
    evergreen: fixed(0x619961),
    water: javaAtLeast(version, '1.13') ? (b.water ?? JAVA_WATER) : id === 'swamp' ? hex(0xe0ffae) : hex(0xffffff),
  };
  const dryFixed = (n: number) => (dry ? fixed(n) : null);
  switch (id) {
    case 'swamp':
      if (!javaAtLeast(version, '1.7')) {
        const mix = hex(0x4e0e4e);
        return { ...out, grass: { kind: 'mix', map: 'grass', with: mix }, foliage: { kind: 'mix', map: 'foliage', with: mix } };
      }
      return { ...out, grass: { kind: 'noise', rgb: SWAMP_NOISE }, foliage: fixed(0x6a7039), dry: dryFixed(0x7b5334) };
    case 'mangrove_swamp':
      return { ...out, grass: { kind: 'noise', rgb: SWAMP_NOISE }, foliage: fixed(0x8db127), dry: dryFixed(0x7b5334) };
    case 'dark_forest':
      return { ...out, grass: { kind: 'mix', map: 'grass', with: hex(0x28340a) }, dry: dryFixed(0x7b5334) };
    case 'badlands':
      return { ...out, grass: fixed(0x90814d), foliage: fixed(0x9e814d) };
    case 'cherry_grove':
      return { ...out, grass: fixed(0xb6db61), foliage: fixed(0xb6db61) };
    case 'pale_garden':
      return { ...out, grass: fixed(0x778272), foliage: fixed(0x878d76), dry: dryFixed(0xa0a69c) };
    case 'dappled_forest':
      return { ...out, grass: fixed(0xdf6827), foliage: fixed(0xe68e30), dry: dryFixed(0x8c3a04) };
    default:
      return out;
  }
}

/** Colours when a map can't be read (the vanilla maps' colours for plains, as the previews used). */
const FALLBACK: Record<ColorMap, RGB> = {
  grass: hex(0x91bd59),
  foliage: hex(0x77ab2f),
  dry_foliage: hex(0xa37a4a),
  birch: hex(0x80a755),
  evergreen: hex(0x619961),
  swamp_grass: hex(0x6a7039),
  swamp_foliage: hex(0x6a7039),
  mangrove_swamp_foliage: hex(0x8db127),
};

/** The colour a look gives (`maps`: the pack's colour maps, the game's where the pack has none). */
export function lookColor(look: Look, climate: Climate, maps: Partial<Record<ColorMap, MapImage>>): RGB {
  switch (look.kind) {
    case 'fixed':
      return [...look.rgb];
    case 'noise':
      // the commoner of the two greens
      return [...look.rgb[1]];
    case 'map':
    case 'mix': {
      const img = maps[look.map];
      const c = (img && mapColor(img, climate.temperature, climate.downfall)) ?? FALLBACK[look.map];
      if (look.kind === 'map') return c;
      // ((colour & 0xFEFEFE) + other) >> 1
      return [((c[0] & 0xfe) + look.with[0]) >> 1, ((c[1] & 0xfe) + look.with[1]) >> 1, ((c[2] & 0xfe) + look.with[2]) >> 1];
    }
  }
}

/** The maps a biome's colours read (to know which to load, and what an edit changes). */
export function mapsRead(looks: BiomeLooks): ColorMap[] {
  const out = new Set<ColorMap>();
  for (const l of [looks.grass, looks.foliage, looks.dry, looks.birch, looks.evergreen]) if (l && (l.kind === 'map' || l.kind === 'mix')) out.add(l.map);
  return [...out];
}

/** Whether a biome's colour of a kind of plant is read from `map` (false: the game ignores the map there). */
export function readsMap(looks: BiomeLooks, map: ColorMap): boolean {
  return mapsRead(looks).includes(map);
}

/** A map's cell for a biome (where the marker goes). */
export function biomeCell(looks: BiomeLooks): { x: number; y: number } {
  return mapCell(looks.climate.temperature, looks.climate.downfall);
}

/** Every colour a biome gives the previews: grass, foliage, dry foliage, birch, spruce and water. */
export interface BiomeTints {
  grass: RGB;
  foliage: RGB;
  dry_foliage: RGB;
  birch: RGB;
  evergreen: RGB;
  water: RGB;
}

export function biomeTints(looks: BiomeLooks, maps: Partial<Record<ColorMap, MapImage>>): BiomeTints {
  const at = (l: Look) => lookColor(l, looks.climate, maps);
  return {
    grass: at(looks.grass),
    foliage: at(looks.foliage),
    dry_foliage: looks.dry ? at(looks.dry) : FALLBACK.dry_foliage,
    birch: at(looks.birch),
    evergreen: at(looks.evergreen),
    water: [...looks.water],
  };
}

export const rgbHex = (c: RGB): string => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
