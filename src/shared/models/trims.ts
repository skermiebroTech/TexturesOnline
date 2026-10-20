// Armour trims: the patterns and materials of the game, and how it colours a pattern. A trim pattern
// is a grey texture drawn over worn humanoid armour on the armour's own model; the game recolours it
// per trim material by swapping colours: every colour of a key palette (8 greys, lightest first) becomes
// the colour at the same place of the material's palette. When the trim material is the armour's own
// (an iron trim on iron armour) the material's darker palette is used, so the trim still shows.
// Java keeps the palettes in trims/color_palettes/ (atlases/armor_trims.json, "paletted_permutations")
// until 26.3 moved them to palettes/ (palettes/trim_base.png as the key, named by the pattern's .mcmeta);
// patterns are trims/models/armor/<pattern>(_leggings) before 1.21.2 and trims/entity/humanoid(_leggings)/
// since. Bedrock keeps them in textures/trims/. Babies' armour never shows a trim. Pure.

/** Trim patterns in the game's order (TrimPatterns); a version has those whose textures it ships. */
export const TRIM_PATTERNS = ['sentry', 'dune', 'coast', 'wild', 'ward', 'eye', 'vex', 'tide', 'snout', 'rib', 'spire', 'wayfinder', 'shaper', 'silence', 'raiser', 'host', 'flow', 'bolt'] as const;

/** Trim materials (value, label); a version has those whose palette it ships. */
export const TRIM_MATERIALS: [string, string][] = [
  ['amethyst', 'Amethyst'],
  ['copper', 'Copper'],
  ['diamond', 'Diamond'],
  ['emerald', 'Emerald'],
  ['gold', 'Gold'],
  ['iron', 'Iron'],
  ['lapis', 'Lapis lazuli'],
  ['netherite', 'Netherite'],
  ['quartz', 'Quartz'],
  ['redstone', 'Redstone'],
  ['resin', 'Resin'],
];

const PATTERN_ORDER = new Map<string, number>(TRIM_PATTERNS.map((p, i) => [p, i]));

export const trimLabel = (name: string): string => name.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

/** Patterns in the game's order, ones the game doesn't list (newer, a pack's own) after them by name. */
export function sortPatterns(names: Iterable<string>): string[] {
  return [...new Set(names)].sort((a, b) => (PATTERN_ORDER.get(a) ?? 999) - (PATTERN_ORDER.get(b) ?? 999) || a.localeCompare(b));
}

/** Materials in the picker's order (alphabetical), unknown ones after the known ones by name. */
export function sortMaterials(names: Iterable<string>): string[] {
  const order = new Map(TRIM_MATERIALS.map(([m], i) => [m, i]));
  return [...new Set(names)].sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999) || a.localeCompare(b));
}

export const materialLabel = (m: string): string => TRIM_MATERIALS.find(([x]) => x === m)?.[1] ?? trimLabel(m);

/**
 * The palette the game colours a trim with: the material's darker one when the armour is made of the
 * trim's material and the version has a darker palette (iron, gold, diamond, netherite, copper), else
 * the material's own. `has` tells whether a palette name exists.
 */
export function trimPaletteName(material: string, armor: string | null | undefined, has: (name: string) => boolean): string {
  return armor === material && has(`${material}_darker`) ? `${material}_darker` : material;
}

// ------------------------------------------------------------------------------- Java paths
// (relative to assets/minecraft/textures/, without .png; the first one a version has wins)

/** The pattern texture for a piece (leggings have their own layout). */
export const javaTrimPattern = (pattern: string, legs: boolean): string[] =>
  legs ? [`trims/entity/humanoid_leggings/${pattern}`, `trims/models/armor/${pattern}_leggings`] : [`trims/entity/humanoid/${pattern}`, `trims/models/armor/${pattern}`];

/** The key palette (the grey shades patterns are drawn in). */
export const JAVA_TRIM_KEY = ['palettes/trim_base', 'trims/color_palettes/trim_palette'];

/** A material's palette (or its darker one: `name` = `<material>_darker`). */
export const javaTrimPalette = (name: string): string[] => [`palettes/trim/${name}`, `trims/color_palettes/${name}`];

/** Folders where a version keeps its patterns and palettes (to find ones this list doesn't know). */
export const JAVA_TRIM_DIRS = { patterns: ['trims/entity/humanoid/', 'trims/models/armor/'], palettes: ['palettes/trim/', 'trims/color_palettes/'] };

// ------------------------------------------------------------------------------- Bedrock paths

export const bedrockTrimPattern = (pattern: string, legs: boolean): string => `textures/trims/${pattern}${legs ? '_leggings' : ''}`;
export const BEDROCK_TRIM_KEY = 'textures/trims/color_palettes/trim_palette';
export const bedrockTrimPalette = (name: string): string => `textures/trims/color_palettes/${name}`;

/** Names of the PNGs right in a folder (Bedrock's texture-set maps left out). */
function pngNames(files: Iterable<string>, dir: string): string[] {
  const out: string[] = [];
  for (const f of files) {
    if (!f.startsWith(dir)) continue;
    const m = /^([a-z0-9_]+)\.png$/.exec(f.slice(dir.length));
    if (m && !/_(mers|mer|normal|heightmap)$/.test(m[1])) out.push(m[1]);
  }
  return out;
}

/** Pattern names among the files of a pattern folder (leggings layouts left out). */
export const patternNames = (files: Iterable<string>, dir: string): string[] => pngNames(files, dir).filter((n) => !n.endsWith('_leggings'));

/** Material names among the files of a palette folder (darker variants and the key left out). */
export const materialNames = (files: Iterable<string>, dir: string): string[] => pngNames(files, dir).filter((n) => !n.endsWith('_darker') && n !== 'trim_palette' && n !== 'trim_base');

// ------------------------------------------------------------------------------- colouring

export interface RgbaImage {
  width: number;
  height: number;
  /** Straight RGBA, rows top first */
  data: Uint8ClampedArray | Uint8Array;
}

/**
 * The game's palette swap (PaletteMapping / PalettedPermutations): keys are the key palette's pixels,
 * values the material palette's, in reading order. A key with alpha 0 is skipped and a later key of the
 * same colour wins; a pixel matches a key by its RGB alone; a matched pixel takes the value's RGB and
 * its alpha times the value's alpha (integer, / 255); other pixels keep their colour; transparent pixels
 * stay as they are. null when the palettes differ in size (the game draws the pattern uncoloured then).
 */
export function paletteMapping(key: RgbaImage, values: RgbaImage): ((rgba: number) => number) | null {
  const n = key.width * key.height;
  if (n !== values.width * values.height || !n) return null;
  const map = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    const k = i * 4;
    if (!key.data[k + 3]) continue;
    const rgb = (key.data[k] << 16) | (key.data[k + 1] << 8) | key.data[k + 2];
    map.set(rgb, ((values.data[k + 3] << 24) | (values.data[k] << 16) | (values.data[k + 1] << 8) | values.data[k + 2]) >>> 0);
  }
  return (rgba) => {
    const a = rgba >>> 24;
    if (!a) return rgba >>> 0;
    const v = map.get(rgba & 0xffffff);
    if (v === undefined) return rgba >>> 0;
    return ((Math.floor((a * (v >>> 24)) / 255) << 24) | (v & 0xffffff)) >>> 0;
  };
}

/** A pattern coloured with a palette pair, as the game draws it (a copy; the pattern as is when the palettes don't fit). */
export function recolorTrim<T extends RgbaImage>(pattern: T, key: RgbaImage, values: RgbaImage): RgbaImage {
  const f = paletteMapping(key, values);
  const out = new Uint8ClampedArray(pattern.data.length);
  out.set(pattern.data);
  if (!f) return { width: pattern.width, height: pattern.height, data: out };
  const d = pattern.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = f(((d[i + 3] << 24) | (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]) >>> 0);
    out[i] = (v >>> 16) & 255;
    out[i + 1] = (v >>> 8) & 255;
    out[i + 2] = v & 255;
    out[i + 3] = v >>> 24;
  }
  return { width: pattern.width, height: pattern.height, data: out };
}

/** The key palette's colours with what each becomes in a material's palette (for showing the mapping). */
export function paletteSwatches(key: RgbaImage, values: RgbaImage | null): { key: [number, number, number]; value: [number, number, number, number] | null }[] {
  const out: { key: [number, number, number]; value: [number, number, number, number] | null }[] = [];
  const n = key.width * key.height;
  const fits = !!values && values.width * values.height === n;
  for (let i = 0; i < n; i++) {
    const k = i * 4;
    if (!key.data[k + 3]) continue;
    out.push({
      key: [key.data[k], key.data[k + 1], key.data[k + 2]],
      value: fits ? [values!.data[k], values!.data[k + 1], values!.data[k + 2], values!.data[k + 3]] : null,
    });
  }
  return out;
}
