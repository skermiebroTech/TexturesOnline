// Bedrock draws most non-cube blocks (stairs, fences, lanterns, anvils, candles...) with shapes built
// into the game, the same shapes Java describes in its block models. This maps Bedrock block ids and
// states to Java ones, so a Java block model (loaded at runtime from a public mirror of the game's
// model files, never bundled) can give a Bedrock block its real shape, and maps each Java face texture
// to the Bedrock texture that plays the same part. Pure, no DOM.

import { JavaModelSet, allVariants, blockstatePath, blockstateProperties, defaultState, parseBlockstate, splitId, type Blockstate, type BlockProperty, type JsonGet, type ResolvedModel } from './java-models';
import type { Dir } from './geometry';
import type { BlockState } from './types';

/** Java block models and blockstates, looked up by pack path (a jar, or the mirror's summary files). */
export class JavaShapes {
  readonly models: JavaModelSet;
  private readonly states = new Map<string, Blockstate | null>();
  private readonly cubeCache = new Map<string, boolean>();

  constructor(readonly json: JsonGet) {
    this.models = new JavaModelSet(json);
  }

  blockstate(id: string): Blockstate | null {
    if (!this.states.has(id)) this.states.set(id, parseBlockstate(this.json(blockstatePath(id))));
    return this.states.get(id) ?? null;
  }

  has(id: string): boolean {
    return !!this.blockstate(id);
  }

  properties(id: string): BlockProperty[] {
    const bs = this.blockstate(id);
    return bs ? blockstateProperties(bs) : [];
  }

  defaultState(id: string): BlockState {
    const bs = this.blockstate(id);
    return bs ? defaultState(bs) : {};
  }

  /** Every model the block uses is a plain full cube (or several stacked, like grass overlays). */
  isCube(id: string): boolean {
    let hit = this.cubeCache.get(id);
    if (hit === undefined) {
      const bs = this.blockstate(id);
      hit = !!bs && allVariants(bs).every(({ variant }) => isFullCube(this.models.resolve(variant.model)));
      this.cubeCache.set(id, hit);
    }
    return hit;
  }
}

function isFullCube(m: ResolvedModel): boolean {
  return !!m.elements?.length && m.elements.every((e) => !e.rotation && e.from.every((v) => v === 0) && e.to.every((v) => v === 16));
}

/**
 * The Java model mirror's summary files as a pack-path lookup: block definitions by block id and
 * models by 'block/name' (misode/mcmeta '<version>-summary' branch: assets/block_definition and
 * assets/model data files).
 */
export function mirrorJson(blockDefinitions: Record<string, unknown>, models: Record<string, unknown>): JsonGet {
  return (path) => {
    let m = /^assets\/minecraft\/blockstates\/(.+)\.json$/.exec(path);
    if (m) return blockDefinitions[m[1]];
    m = /^assets\/minecraft\/models\/(.+)\.json$/.exec(path);
    if (m) return models[m[1]];
    return undefined;
  };
}

// ---------------------------------------------------------------------------------------------
// Ids

export interface JavaTarget {
  /** Java block id (or a model id for blocks Java only has as a model, like item frames) */
  id: string;
  /** State the Bedrock id stands for (lit_furnace is lit=true): these properties aren't offered */
  state?: BlockState;
  /** Bedrock keeps several looks under this id (texture variations such as wood types) */
  variants?: boolean;
  /** Java has no blockstate for it: bake this model directly */
  model?: string;
}

/**
 * Bedrock ids whose Java block has another name, or that stand for one state of it. Everything else
 * with the same name in both editions maps to itself.
 */
const RENAMED: Record<string, JavaTarget> = {
  beetroot: { id: 'beetroots' },
  carpet: { id: 'white_carpet', variants: true },
  cave_vines_body_with_berries: { id: 'cave_vines_plant', state: { berries: 'true' } },
  cave_vines_head_with_berries: { id: 'cave_vines', state: { berries: 'true' } },
  // The old stonecutter (a plain cube), not the stonecutter_block Java has
  stonecutter: { id: '' },
  chain: { id: 'iron_chain' },
  coral: { id: 'tube_coral', variants: true },
  coral_fan: { id: 'tube_coral_fan', variants: true },
  coral_fan_dead: { id: 'dead_tube_coral_fan', variants: true },
  coral_fan_hang: { id: 'tube_coral_wall_fan', variants: true },
  coral_fan_hang2: { id: 'fire_coral_wall_fan', variants: true },
  coral_fan_hang3: { id: 'horn_coral_wall_fan', variants: true },
  daylight_detector: { id: 'daylight_detector', state: { inverted: 'false' } },
  daylight_detector_inverted: { id: 'daylight_detector', state: { inverted: 'true' } },
  deadbush: { id: 'dead_bush' },
  deprecated_anvil: { id: 'anvil' },
  dirt_with_roots: { id: 'rooted_dirt' },
  double_plant: { id: 'tall_grass', variants: true },
  end_brick_stairs: { id: 'end_stone_brick_stairs' },
  fence: { id: 'oak_fence', variants: true },
  fence_gate: { id: 'oak_fence_gate' },
  golden_rail: { id: 'powered_rail' },
  grass_path: { id: 'dirt_path' },
  lit_redstone_lamp: { id: 'redstone_lamp', state: { lit: 'true' } },
  redstone_lamp: { id: 'redstone_lamp', state: { lit: 'false' } },
  normal_stone_slab: { id: 'stone_slab' },
  normal_stone_stairs: { id: 'stone_stairs' },
  pistonArmCollision: { id: 'piston_head', state: { type: 'normal' } },
  stickyPistonArmCollision: { id: 'piston_head', state: { type: 'sticky' } },
  portal: { id: 'nether_portal' },
  powered_comparator: { id: 'comparator', state: { powered: 'true' } },
  unpowered_comparator: { id: 'comparator', state: { powered: 'false' } },
  powered_repeater: { id: 'repeater', state: { powered: 'true' } },
  unpowered_repeater: { id: 'repeater', state: { powered: 'false' } },
  prismarine_bricks_stairs: { id: 'prismarine_brick_stairs' },
  red_flower: { id: 'poppy', variants: true },
  yellow_flower: { id: 'dandelion' },
  reeds: { id: 'sugar_cane' },
  sapling: { id: 'oak_sapling', variants: true },
  small_dripleaf_block: { id: 'small_dripleaf' },
  snow_layer: { id: 'snow' },
  stained_glass_pane: { id: 'white_stained_glass_pane', variants: true },
  stone_slab: { id: 'smooth_stone_slab', variants: true },
  stone_slab2: { id: 'red_sandstone_slab', variants: true },
  stone_slab3: { id: 'end_stone_brick_slab', variants: true },
  stone_slab4: { id: 'mossy_stone_brick_slab', variants: true },
  stonecutter_block: { id: 'stonecutter' },
  tallgrass: { id: 'short_grass', variants: true },
  trapdoor: { id: 'oak_trapdoor' },
  tripWire: { id: 'tripwire' },
  redstone_torch: { id: 'redstone_torch', state: { lit: 'true' } },
  unlit_redstone_torch: { id: 'redstone_torch', state: { lit: 'false' } },
  redstone_ore: { id: 'redstone_ore', state: { lit: 'false' } },
  lit_redstone_ore: { id: 'redstone_ore', state: { lit: 'true' } },
  waterlily: { id: 'lily_pad' },
  web: { id: 'cobweb' },
  wooden_button: { id: 'oak_button' },
  wooden_door: { id: 'oak_door' },
  wooden_pressure_plate: { id: 'oak_pressure_plate' },
  wooden_slab: { id: 'oak_slab', variants: true },
  frame: { id: 'item_frame', model: 'minecraft:block/item_frame' },
  glow_frame: { id: 'glow_item_frame', model: 'minecraft:block/glow_item_frame' },
};

/** Older Java names (the mirror follows one version; these ids changed over time). */
const JAVA_ALIASES: Record<string, string[]> = {
  iron_chain: ['chain'],
  short_grass: ['grass'],
  dirt_path: ['grass_path'],
};

/** Java block for a Bedrock block id (null: Java has no such block). `has` checks Java block ids. */
export function javaTargetFor(bedrockId: string, has: (javaId: string) => boolean): JavaTarget | null {
  const t = RENAMED[bedrockId];
  if (t && !t.id) return null;
  if (t) {
    if (t.model) return t;
    for (const id of [t.id, ...(JAVA_ALIASES[t.id] ?? [])]) if (has(id)) return { ...t, id };
    return null;
  }
  const dbl = /^(.*?)_?double_(.*slab)$/.exec(bedrockId);
  if (dbl) {
    const id = `${dbl[1] ? `${dbl[1]}_` : ''}${dbl[2]}`;
    if (has(id)) return { id, state: { type: 'double' } };
  }
  if (has(bedrockId)) return { id: bedrockId };
  return null;
}

/**
 * Bedrock blocks that are one block where Java has several (a floor and a wall torch, an empty and a
 * filled cauldron): offered as one property whose values pick the Java block and state.
 */
export interface JavaForms {
  prop: string;
  default: string;
  values: Record<string, { id: string; state: BlockState }>;
}

const wallForms = (floor: string, wall: string): JavaForms => ({
  prop: 'facing',
  default: 'up',
  values: {
    up: { id: floor, state: {} },
    north: { id: wall, state: { facing: 'north' } },
    south: { id: wall, state: { facing: 'south' } },
    west: { id: wall, state: { facing: 'west' } },
    east: { id: wall, state: { facing: 'east' } },
  },
});

export const JAVA_FORMS: Record<string, JavaForms> = {
  torch: wallForms('torch', 'wall_torch'),
  soul_torch: wallForms('soul_torch', 'soul_wall_torch'),
  copper_torch: wallForms('copper_torch', 'copper_wall_torch'),
  redstone_torch: wallForms('redstone_torch', 'redstone_wall_torch'),
  unlit_redstone_torch: wallForms('redstone_torch', 'redstone_wall_torch'),
  cauldron: {
    prop: 'level',
    default: '0',
    values: {
      '0': { id: 'cauldron', state: {} },
      '1': { id: 'water_cauldron', state: { level: '1' } },
      '2': { id: 'water_cauldron', state: { level: '2' } },
      '3': { id: 'water_cauldron', state: { level: '3' } },
    },
  },
};

// ---------------------------------------------------------------------------------------------
// Textures

export interface TextureCandidate {
  /** Face of the block the texture is listed on in blocks.json */
  dir: Dir;
  /** terrain_texture.json key */
  key: string;
  /** Atlas path without extension, e.g. 'textures/blocks/planks_oak' */
  stem: string;
  /** Index among the key's variations */
  index: number;
}

const SYNONYMS: Record<string, string> = {
  up: 'top',
  upper: 'top',
  down: 'bottom',
  lower: 'bottom',
  sides: 'side',
  off: '',
  on: 'lit',
  powered: 'lit',
  big: 'dark',
  darkoak: 'dark',
  stalk: 'stem',
  leaves: 'leaf',
  moist: 'wet',
};

/** Words of a texture name, lower-case, trailing digits dropped, synonyms folded. */
export function textureTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/^.*[:/]/, '')
    .split(/[_\s]+/)
    .map((t) => t.replace(/\d+$/, ''))
    .map((t) => (t in SYNONYMS ? SYNONYMS[t] : t))
    .filter(Boolean);
}

function stemName(p: string): string {
  return p.slice(p.lastIndexOf('/') + 1);
}

/** 'wheat_stage_7' and 'wheat_stage7' are the same name. */
const sameName = (a: string, b: string) => a.replace(/_(\d)/g, '$1') === b.replace(/_(\d)/g, '$1');
const numbers = (s: string) => (s.match(/\d+/g) ?? []).map(Number).join(',');

const DRIED_GHAST_FACE: Record<string, string> = { north: 'back', south: 'front', west: 'right', east: 'left', top: 'top', bottom: 'bottom' };

/** Java textures Bedrock names differently (one name each); '' drops the face (Bedrock has no such layer). */
const TEXTURE_RENAMES: Record<string, string> = {
  anvil: 'anvil_base',
  piston_top: 'piston_top_normal',
  turtle_egg: 'turtle_egg_not_cracked',
  composter_compost: 'compost',
  composter_ready: 'compost_ready',
  redstone_torch: 'redstone_torch_on',
  comparator: 'comparator_off',
  repeater: 'repeater_off',
  tripwire_hook: 'trip_wire_source',
  tripwire: 'trip_wire',
  sandstone: 'sandstone_normal',
  red_sandstone: 'red_sandstone_normal',
  cut_sandstone: 'sandstone_smooth',
  cut_red_sandstone: 'red_sandstone_smooth',
  chiseled_sandstone: 'sandstone_carved',
  chiseled_red_sandstone: 'red_sandstone_carved',
  kelp: 'kelp_top',
  kelp_plant: 'kelp_a',
  cave_vines: 'cave_vines_head',
  cave_vines_lit: 'cave_vines_head_berries',
  cave_vines_plant: 'cave_vines_body',
  cave_vines_plant_lit: 'cave_vines_body_berries',
  twisting_vines: 'twisting_vines_bottom',
  twisting_vines_plant: 'twisting_vines_base',
  weeping_vines: 'weeping_vines_bottom',
  weeping_vines_plant: 'weeping_vines_base',
  mushroom_stem: 'mushroom_block_skin_stem',
  red_mushroom_block: 'mushroom_block_skin_red',
  brown_mushroom_block: 'mushroom_block_skin_brown',
  pale_moss_carpet_side_small: 'pale_moss_carpet_side_tip',
  pale_moss_carpet_side_tall: 'pale_moss_carpet_side_base',
  big_dripleaf_side: 'big_dripleaf_side1',
  big_dripleaf_tip: 'big_dripleaf_side2',
  redstone_dust_dot: 'redstone_dust_cross',
  redstone_dust_overlay: '',
  bamboo_stalk: 'bamboo_stem',
  bamboo_large_leaves: 'bamboo_leaf',
  bamboo_small_leaves: 'bamboo_small_leaf',
  farmland: 'farmland_dry',
  farmland_moist: 'farmland_wet',
  rail: 'rail_normal',
  rail_corner: 'rail_normal_turned',
  firefly_bush_emissive: 'firefly_bush_firefly',
  open_eyeblossom: 'eyeblossom_blooming',
  open_eyeblossom_emissive: 'eyeblossom_eyes_blooming',
  closed_eyeblossom: 'eyeblossom_closed',
};

/** Tall plants Bedrock still names after their old shared id (double_plant_<name>_top). */
const DOUBLE_PLANTS: Record<string, string> = { sunflower: 'sunflower', lilac: 'syringa', peony: 'paeonia', rose_bush: 'rose', large_fern: 'fern', tall_grass: 'grass' };

/** Bedrock names of Java textures whose names differ in more than word order. */
export function bedrockTextureNames(javaName: string): string[] {
  let m: RegExpExecArray | null;
  if (javaName in TEXTURE_RENAMES) return [TEXTURE_RENAMES[javaName]];
  if ((m = /^dried_ghast_hydration_(\d)_(\w+)$/.exec(javaName))) return [DRIED_GHAST_FACE[m[2]] ? `dried_ghast_state_${Number(m[1]) + 1}_${DRIED_GHAST_FACE[m[2]]}` : ''];
  if ((m = /^pointed_dripstone_(up|down)_tip_merge$/.exec(javaName))) return [`pointed_dripstone_${m[1]}_merge`];
  if ((m = /^(sunflower|lilac|peony|rose_bush|large_fern|tall_grass)_(\w+)$/.exec(javaName))) return [`double_plant_${DOUBLE_PLANTS[m[1]]}_${m[2]}`];
  if ((m = /^honey_block_(\w+)$/.exec(javaName))) return [`honey_${m[1]}`];
  if ((m = /^end_portal_frame_(\w+)$/.exec(javaName))) return [`endframe_${m[1]}`];
  if ((m = /^dirt_path_(\w+)$/.exec(javaName))) return [`grass_path_${m[1]}`];
  if ((m = /^(powered|detector|activator)_rail(_on)?$/.exec(javaName))) return [`rail_${m[1] === 'powered' ? 'golden' : m[1]}${m[2] ? '_powered' : ''}`];
  if ((m = /^(.*lightning_rod)_on$/.exec(javaName))) return [`${m[1]}_powered`, 'lightning_rod_powered'];
  return [];
}

export type TextureHow = 'exact' | 'alias' | 'name' | 'global' | 'single' | 'partial' | 'face';

/**
 * Picks the Bedrock texture for a Java face texture. Own textures (the block's blocks.json faces) win
 * when their name says the same thing; a block texture elsewhere in the atlas with exactly the Java
 * name comes next (lit candles, cake inside); then a lone own texture; the best partial name match;
 * and last the texture blocks.json lists on the same face.
 */
export function pickBedrockTexture(
  javaRef: string,
  faceDir: Dir,
  own: TextureCandidate[],
  global: (name: string) => string | null,
  /** The own textures are one look of the block (a wood type): a lone one wins over the atlas */
  ownFirst = false,
): { stem: string; how: TextureHow } | null {
  const javaName = splitId(javaRef)[1].replace(/^.*\//, '');
  const jt = textureTokens(javaName);
  const distinct = [...new Map(own.map((c) => [c.stem, c])).values()];
  const exact = distinct.find((c) => sameName(stemName(c.stem), javaName));
  if (exact) return { stem: exact.stem, how: 'exact' };
  for (const alias of bedrockTextureNames(javaName)) {
    if (!alias) return { stem: '', how: 'alias' };
    const hit = distinct.find((c) => sameName(stemName(c.stem), alias));
    if (hit) return { stem: hit.stem, how: 'alias' };
    const g = global(alias);
    if (g) return { stem: g, how: 'alias' };
  }
  // Words of the file names (the atlas keys are only a tie-break: a key can name another file).
  let best: TextureCandidate | null = null;
  let bestScore = 0;
  let bestFull = false;
  let tie = false;
  for (const c of distinct) {
    const ct = new Set(textureTokens(stemName(c.stem)));
    const hits = jt.filter((t) => ct.has(t)).length;
    if (!hits) continue;
    const keyHits = jt.filter((t) => textureTokens(c.key).includes(t)).length;
    // Growth stages and such: the same numbers settle a tie (wheat_stage7 -> wheat_stage_7).
    const nums = numbers(javaName) && numbers(javaName) === numbers(stemName(c.stem)) ? 0.05 : 0;
    const score = hits / (jt.length + ct.size - hits) + nums + keyHits * 0.01 + (c.dir === faceDir ? 0.001 : 0);
    if (score > bestScore + 1e-9) {
      best = c;
      bestScore = score;
      bestFull = hits === jt.length;
      tie = false;
    } else if (Math.abs(score - bestScore) < 1e-9) tie = true;
  }
  if (best && bestFull && !tie && jt.length > 1) return { stem: best.stem, how: 'name' };
  if (ownFirst && distinct.length === 1) return { stem: distinct[0].stem, how: 'single' };
  const g = global(javaName);
  if (g) return { stem: g, how: 'global' };
  const byKey = distinct.find((c) => c.key === javaName);
  if (byKey) return { stem: byKey.stem, how: 'exact' };
  if (distinct.length === 1) return { stem: distinct[0].stem, how: 'single' };
  if (best) return { stem: best.stem, how: 'partial' };
  const onFace = own.find((c) => c.dir === faceDir) ?? own[0];
  return onFace ? { stem: onFace.stem, how: 'face' } : null;
}

/**
 * Bedrock splits a Java chain texture (two 3-pixel strips side by side) into two textures: the strip at
 * u 0..3 is '<name>2' and the one at u 3..6 is '<name>1'. Returns the texture and the u shift for a face.
 */
export function chainStrip(javaRef: string, own: TextureCandidate[], minU: number): { stem: string; du: number } | null {
  if (!/(^|_)chain$/.test(splitId(javaRef)[1].replace(/^.*\//, ''))) return null;
  const want = minU >= 3 - 1e-6 ? '1' : '2';
  const hit = own.find((c) => c.stem.endsWith(`chain${want}`));
  return hit ? { stem: hit.stem, du: want === '1' ? -3 : 0 } : null;
}
