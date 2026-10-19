// Java Edition mobs: which model layers the game draws for each mob and which textures go on them,
// with the choices that change the look (variant, baby, wool, profession, collar...). Texture paths are
// relative to textures/entity/ without .png; model names are the layers of mob-geometry.ts. Follows the
// 26.x renderers (baby models and textures, temperature variants); textures missing from the version
// on show are left out, so older versions show the mobs whose files and layouts still match. Pure.

import type { RGB } from './geometry';
import { DYE_RGB } from './block-entities';

export interface MobValue {
  value: string;
  label: string;
}

export interface MobProp {
  name: string;
  label: string;
  values: MobValue[];
}

/** One textured model the game draws for a mob (base, then overlays in drawing order). */
export interface MobLayerRef {
  /** Model layer (mob-geometry.ts) */
  model: string;
  /** Texture relative to textures/entity/, without extension */
  texture: string;
  /** What this texture is, e.g. 'Body', 'Wool', 'Profession' */
  label: string;
  /** Colour the game multiplies the texture with (dyed collars, wool) */
  tint?: RGB;
}

export type MobState = Record<string, string>;

export interface JavaMobSpec {
  id: string;
  name: string;
  props: MobProp[];
  layers(s: MobState): MobLayerRef[];
}

const pretty = (s: string): string => s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const values = (...v: (string | [string, string])[]): MobValue[] => v.map((x) => (typeof x === 'string' ? { value: x, label: pretty(x) } : { value: x[0], label: x[1] }));
const prop = (name: string, label: string, ...v: (string | [string, string])[]): MobProp => ({ name, label, values: values(...v) });
const AGE = prop('age', 'Age', 'adult', 'baby');
const baby = (s: MobState) => s.age === 'baby';
const B = (s: MobState) => (baby(s) ? '_baby' : '');
const L = (model: string, texture: string, label = 'Body', tint?: RGB): MobLayerRef => ({ model, texture, label, tint });

/** A mob drawn with one model and one texture. */
function simple(id: string, name: string, model: string, texture: string): JavaMobSpec {
  return { id, name, props: [], layers: () => [L(model, texture)] };
}

/** A mob with a baby model and texture (`<texture>_baby`). */
function aged(id: string, name: string, model: string, texture: string, babyModel = `${model}_baby`): JavaMobSpec {
  return { id, name, props: [AGE], layers: (s) => [L(baby(s) ? babyModel : model, texture + B(s))] };
}

const TEMPERATURES = ['temperate', 'warm', 'cold'] as const;
const BIOMES = ['plains', 'desert', 'jungle', 'savanna', 'snow', 'swamp', 'taiga'];
const PROFESSIONS = ['armorer', 'butcher', 'cartographer', 'cleric', 'farmer', 'fisherman', 'fletcher', 'leatherworker', 'librarian', 'mason', 'nitwit', 'shepherd', 'toolsmith', 'weaponsmith'];
const LEVELS: [string, string][] = [
  ['stone', 'Novice (stone)'],
  ['iron', 'Apprentice (iron)'],
  ['gold', 'Journeyman (gold)'],
  ['emerald', 'Expert (emerald)'],
  ['diamond', 'Master (diamond)'],
];
const CATS = ['tabby', 'black', 'red', 'siamese', 'british_shorthair', 'calico', 'persian', 'ragdoll', 'white', 'jellie', 'all_black'];
const WOLVES: [string, string][] = [
  ['pale', 'Pale'],
  ['ashen', 'Ashen'],
  ['black', 'Black'],
  ['chestnut', 'Chestnut'],
  ['rusty', 'Rusty'],
  ['snowy', 'Snowy'],
  ['spotted', 'Spotted'],
  ['striped', 'Striped'],
  ['woods', 'Woods'],
];
const HORSES = ['white', 'creamy', 'chestnut', 'brown', 'black', 'gray', 'darkbrown'];
const MARKINGS: [string, string][] = [
  ['none', 'None'],
  ['white', 'White stockings'],
  ['whitefield', 'White field'],
  ['whitedots', 'White dots'],
  ['blackdots', 'Black dots'],
];
const RABBITS = ['brown', 'white', 'black', 'white_splotched', 'gold', 'salt', 'toast', 'caerbannog'];
const PANDAS: [string, string][] = [
  ['normal', 'Normal'],
  ['lazy', 'Lazy'],
  ['worried', 'Worried'],
  ['playful', 'Playful'],
  ['brown', 'Brown'],
  ['weak', 'Weak'],
  ['aggressive', 'Aggressive'],
];

/** Villagers and zombie villagers: body, biome clothes, profession and level badge on one model. */
function villagerLike(id: string, name: string, dir: string, model: string): JavaMobSpec {
  return {
    id,
    name,
    props: [AGE, prop('type', 'Biome', ...BIOMES), prop('profession', 'Profession', 'none', ...PROFESSIONS), prop('level', 'Level', ...LEVELS)],
    layers(s) {
      if (baby(s)) return [L(`${model}_baby`, `${dir}/${dir}_baby`), L(`${model}_baby`, `${dir}/baby/${s.type ?? 'plains'}`, 'Biome clothes')];
      const out = [L(model, `${dir}/${dir}`), L(model, `${dir}/type/${s.type ?? 'plains'}`, 'Biome clothes')];
      const p = s.profession ?? 'none';
      if (p !== 'none') {
        out.push(L(model, `${dir}/profession/${p}`, 'Profession'));
        if (p !== 'nitwit') out.push(L(model, `${dir}/profession_level/${s.level ?? 'stone'}`, 'Level badge'));
      }
      return out;
    },
  };
}

const RED_COLLAR = DYE_RGB.red;

export const JAVA_MOBS: JavaMobSpec[] = [
  simple('creeper', 'Creeper', 'creeper', 'creeper/creeper'),
  aged('zombie', 'Zombie', 'zombie', 'zombie/zombie'),
  aged('husk', 'Husk', 'husk', 'zombie/husk'),
  {
    id: 'drowned',
    name: 'Drowned',
    props: [AGE],
    layers: (s) => {
      const m = baby(s) ? 'drowned_baby' : 'drowned';
      return [L(m, `zombie/drowned${B(s)}`), L(`${m}#outer`, `zombie/drowned_outer_layer${B(s)}`, 'Outer layer')];
    },
  },
  villagerLike('zombie_villager', 'Zombie Villager', 'zombie_villager', 'zombie_villager'),
  simple('skeleton', 'Skeleton', 'skeleton', 'skeleton/skeleton'),
  { id: 'stray', name: 'Stray', props: [], layers: () => [L('stray', 'skeleton/stray'), L('stray#outer', 'skeleton/stray_overlay', 'Clothes')] },
  { id: 'bogged', name: 'Bogged', props: [], layers: () => [L('bogged', 'skeleton/bogged'), L('bogged#outer', 'skeleton/bogged_overlay', 'Clothes')] },
  simple('wither_skeleton', 'Wither Skeleton', 'wither_skeleton', 'skeleton/wither_skeleton'),
  simple('parched', 'Parched', 'parched', 'skeleton/parched'),
  { id: 'spider', name: 'Spider', props: [], layers: () => [L('spider', 'spider/spider'), L('spider', 'spider/spider_eyes', 'Eyes (glow)')] },
  { id: 'cave_spider', name: 'Cave Spider', props: [], layers: () => [L('cave_spider', 'spider/cave_spider'), L('cave_spider', 'spider/spider_eyes', 'Eyes (glow)')] },
  { id: 'enderman', name: 'Enderman', props: [], layers: () => [L('enderman', 'enderman/enderman'), L('enderman', 'enderman/enderman_eyes', 'Eyes (glow)')] },
  {
    id: 'pig',
    name: 'Pig',
    props: [prop('variant', 'Variant', ...TEMPERATURES), AGE],
    layers: (s) => {
      const v = s.variant ?? 'temperate';
      return [L(baby(s) ? 'pig_baby' : v === 'cold' ? 'cold_pig' : 'pig', `pig/pig_${v}${B(s)}`)];
    },
  },
  {
    id: 'cow',
    name: 'Cow',
    props: [prop('variant', 'Variant', ...TEMPERATURES), AGE],
    layers: (s) => {
      const v = s.variant ?? 'temperate';
      const m = v === 'temperate' ? 'cow' : `${v}_cow`;
      return [L(baby(s) ? `${m}_baby` : m, `cow/cow_${v}${B(s)}`)];
    },
  },
  {
    id: 'mooshroom',
    name: 'Mooshroom',
    props: [prop('variant', 'Variant', 'red', 'brown'), AGE],
    layers: (s) => [L(baby(s) ? 'mooshroom_baby' : 'mooshroom', `cow/mooshroom_${s.variant ?? 'red'}${B(s)}`)],
  },
  {
    id: 'sheep',
    name: 'Sheep',
    props: [prop('wool', 'Wool', 'wool', ['undercoat', 'Undercoat (dyed sheep)'], 'sheared'), AGE],
    layers: (s) => {
      if (baby(s)) return s.wool === 'sheared' ? [L('sheep_baby', 'sheep/sheep_baby')] : [L('sheep_baby', 'sheep/sheep_baby'), L('sheep_baby#wool', 'sheep/sheep_wool_baby', 'Wool')];
      const out = [L('sheep', 'sheep/sheep')];
      if (s.wool === 'undercoat') out.push(L('sheep#wool_undercoat', 'sheep/sheep_wool_undercoat', 'Wool undercoat'));
      if (s.wool !== 'sheared') out.push(L('sheep#wool', 'sheep/sheep_wool', 'Wool'));
      return out;
    },
  },
  {
    id: 'chicken',
    name: 'Chicken',
    props: [prop('variant', 'Variant', ...TEMPERATURES), AGE],
    layers: (s) => {
      const v = s.variant ?? 'temperate';
      return [L(baby(s) ? 'chicken_baby' : v === 'cold' ? 'cold_chicken' : 'chicken', `chicken/chicken_${v}${B(s)}`)];
    },
  },
  villagerLike('villager', 'Villager', 'villager', 'villager'),
  simple('wandering_trader', 'Wandering Trader', 'wandering_trader', 'wandering_trader/wandering_trader'),
  simple('witch', 'Witch', 'witch', 'witch/witch'),
  simple('evoker', 'Evoker', 'evoker', 'illager/evoker'),
  simple('vindicator', 'Vindicator', 'vindicator', 'illager/vindicator'),
  simple('pillager', 'Pillager', 'pillager', 'illager/pillager'),
  simple('illusioner', 'Illusioner', 'illusioner', 'illager/illusioner'),
  simple('ravager', 'Ravager', 'ravager', 'illager/ravager'),
  { id: 'vex', name: 'Vex', props: [prop('mood', 'Mood', 'normal', 'charging')], layers: (s) => [L('vex', s.mood === 'charging' ? 'illager/vex_charging' : 'illager/vex')] },
  {
    id: 'iron_golem',
    name: 'Iron Golem',
    props: [prop('crack', 'Cracks', 'none', 'low', 'medium', 'high')],
    layers: (s) => {
      const out = [L('iron_golem', 'iron_golem/iron_golem')];
      if (s.crack && s.crack !== 'none') out.push(L('iron_golem', `iron_golem/iron_golem_crackiness_${s.crack}`, 'Cracks'));
      return out;
    },
  },
  simple('snow_golem', 'Snow Golem', 'snow_golem', 'snow_golem/snow_golem'),
  {
    id: 'wolf',
    name: 'Wolf',
    props: [prop('variant', 'Variant', ...WOLVES), prop('mood', 'Mood', 'wild', 'tame', 'angry'), AGE],
    layers: (s) => {
      const v = s.variant ?? 'pale';
      const mood = s.mood ?? 'wild';
      const tex = `wolf/wolf${v === 'pale' ? '' : `_${v}`}${mood === 'wild' ? '' : `_${mood}`}${B(s)}`;
      const m = baby(s) ? 'wolf_baby' : 'wolf';
      const out = [L(m, tex)];
      if (mood === 'tame') out.push(L(m, `wolf/wolf_collar${B(s)}`, 'Collar (dyed)', RED_COLLAR));
      return out;
    },
  },
  {
    id: 'cat',
    name: 'Cat',
    props: [prop('variant', 'Variant', ...CATS), prop('collar', 'Collar', 'none', ['red', 'Red (tamed)']), AGE],
    layers: (s) => {
      const m = baby(s) ? 'cat_baby' : 'cat';
      const out = [L(m, `cat/cat_${s.variant ?? 'tabby'}${B(s)}`)];
      if (s.collar === 'red') out.push(L(m, `cat/cat_collar${B(s)}`, 'Collar (dyed)', RED_COLLAR));
      return out;
    },
  },
  aged('ocelot', 'Ocelot', 'ocelot', 'cat/ocelot'),
  {
    id: 'fox',
    name: 'Fox',
    props: [prop('variant', 'Variant', 'red', 'snow'), prop('sleeping', 'Sleeping', 'no', 'yes'), AGE],
    layers: (s) => [L(baby(s) ? 'fox_baby' : 'fox', `fox/fox${s.variant === 'snow' ? '_snow' : ''}${s.sleeping === 'yes' ? '_sleep' : ''}${B(s)}`)],
  },
  {
    id: 'horse',
    name: 'Horse',
    props: [prop('coat', 'Coat', ...HORSES), prop('markings', 'Markings', ...MARKINGS), AGE],
    layers: (s) => {
      const m = baby(s) ? 'horse_baby' : 'horse';
      const out = [L(m, `horse/horse_${s.coat ?? 'white'}${B(s)}`)];
      if (s.markings && s.markings !== 'none') out.push(L(m, `horse/horse_markings_${s.markings}${B(s)}`, 'Markings'));
      return out;
    },
  },
  aged('donkey', 'Donkey', 'donkey', 'horse/donkey'),
  aged('mule', 'Mule', 'mule', 'horse/mule'),
  aged('skeleton_horse', 'Skeleton Horse', 'skeleton_horse', 'horse/horse_skeleton'),
  aged('zombie_horse', 'Zombie Horse', 'zombie_horse', 'horse/horse_zombie'),
  {
    id: 'llama',
    name: 'Llama',
    props: [prop('variant', 'Variant', 'creamy', 'white', 'brown', 'gray'), AGE],
    layers: (s) => [L(baby(s) ? 'llama_baby' : 'llama', `llama/llama_${s.variant ?? 'creamy'}${B(s)}`)],
  },
  { id: 'slime', name: 'Slime', props: [], layers: () => [L('slime', 'slime/slime'), L('slime#outer', 'slime/slime', 'Body')] },
  simple('magma_cube', 'Magma Cube', 'magma_cube', 'slime/magmacube'),
  { id: 'ghast', name: 'Ghast', props: [prop('face', 'Face', 'calm', 'shooting')], layers: (s) => [L('ghast', s.face === 'shooting' ? 'ghast/ghast_shooting' : 'ghast/ghast')] },
  aged('happy_ghast', 'Happy Ghast', 'happy_ghast', 'ghast/happy_ghast'),
  simple('blaze', 'Blaze', 'blaze', 'blaze/blaze'),
  aged('piglin', 'Piglin', 'piglin', 'piglin/piglin'),
  simple('piglin_brute', 'Piglin Brute', 'piglin_brute', 'piglin/piglin_brute'),
  aged('zombified_piglin', 'Zombified Piglin', 'zombified_piglin', 'piglin/zombified_piglin'),
  aged('hoglin', 'Hoglin', 'hoglin', 'hoglin/hoglin'),
  aged('zoglin', 'Zoglin', 'zoglin', 'hoglin/zoglin'),
  { id: 'phantom', name: 'Phantom', props: [], layers: () => [L('phantom', 'phantom/phantom'), L('phantom', 'phantom/phantom_eyes', 'Eyes (glow)')] },
  {
    id: 'bee',
    name: 'Bee',
    props: [prop('mood', 'Mood', 'calm', 'angry'), prop('nectar', 'Nectar', 'no', 'yes'), AGE],
    layers: (s) => [L(baby(s) ? 'bee_baby' : 'bee', `bee/bee${s.mood === 'angry' ? '_angry' : ''}${s.nectar === 'yes' ? '_nectar' : ''}${B(s)}`)],
  },
  {
    id: 'axolotl',
    name: 'Axolotl',
    props: [prop('variant', 'Variant', ['lucy', 'Leucistic (pink)'], ['wild', 'Brown'], ['gold', 'Gold'], ['cyan', 'Cyan'], ['blue', 'Blue']), AGE],
    layers: (s) => [L(baby(s) ? 'axolotl_baby' : 'axolotl', `axolotl/axolotl_${s.variant ?? 'lucy'}${B(s)}`)],
  },
  { id: 'frog', name: 'Frog', props: [prop('variant', 'Variant', ...TEMPERATURES)], layers: (s) => [L('frog', `frog/frog_${s.variant ?? 'temperate'}`)] },
  simple('tadpole', 'Tadpole', 'tadpole', 'tadpole/tadpole'),
  simple('allay', 'Allay', 'allay', 'allay/allay'),
  {
    id: 'warden',
    name: 'Warden',
    props: [prop('glow', 'Glowing layer', 'none', 'bioluminescent', 'heart', ['spots_1', 'Pulsating spots 1'], ['spots_2', 'Pulsating spots 2'])],
    layers: (s) => {
      const out = [L('warden', 'warden/warden')];
      const g = s.glow ?? 'none';
      if (g === 'bioluminescent') out.push(L('warden', 'warden/warden_bioluminescent_layer', 'Bioluminescent layer'));
      else if (g === 'heart') out.push(L('warden', 'warden/warden_heart', 'Heart'));
      else if (g.startsWith('spots_')) out.push(L('warden', `warden/warden_pulsating_spots_${g.slice(6)}`, 'Pulsating spots'));
      return out;
    },
  },
  simple('armor_stand', 'Armor Stand', 'armor_stand', 'armorstand/armorstand'),
  aged('polar_bear', 'Polar Bear', 'polar_bear', 'bear/polarbear'),
  {
    id: 'panda',
    name: 'Panda',
    props: [prop('variant', 'Variant', ...PANDAS), AGE],
    layers: (s) => {
      const v = s.variant ?? 'normal';
      if (baby(s)) return [L('panda_baby', v === 'normal' ? 'panda/panda_baby' : `panda/${v}_panda_baby`)];
      return [L('panda', v === 'normal' ? 'panda/panda' : `panda/panda_${v}`)];
    },
  },
  {
    id: 'rabbit',
    name: 'Rabbit',
    props: [prop('variant', 'Variant', ...RABBITS), AGE],
    layers: (s) => [L(baby(s) ? 'rabbit_baby' : 'rabbit', `rabbit/rabbit_${s.variant ?? 'brown'}${B(s)}`)],
  },
  {
    id: 'parrot',
    name: 'Parrot',
    props: [prop('variant', 'Variant', ['red_blue', 'Red'], ['blue', 'Blue'], ['green', 'Green'], ['yellow_blue', 'Cyan'], ['grey', 'Grey'])],
    layers: (s) => [L('parrot', `parrot/parrot_${s.variant ?? 'red_blue'}`)],
  },
  aged('turtle', 'Turtle', 'turtle', 'turtle/turtle'),
  aged('goat', 'Goat', 'goat', 'goat/goat'),
  aged('dolphin', 'Dolphin', 'dolphin', 'dolphin/dolphin'),
  aged('squid', 'Squid', 'squid', 'squid/squid'),
  aged('glow_squid', 'Glow Squid', 'glow_squid', 'squid/glow_squid'),
  simple('guardian', 'Guardian', 'guardian', 'guardian/guardian'),
  simple('elder_guardian', 'Elder Guardian', 'elder_guardian', 'guardian/guardian_elder'),
  simple('silverfish', 'Silverfish', 'silverfish', 'silverfish/silverfish'),
  simple('endermite', 'Endermite', 'endermite', 'endermite/endermite'),
  simple('bat', 'Bat', 'bat', 'bat/bat'),
  {
    id: 'strider',
    name: 'Strider',
    props: [prop('look', 'Look', 'warm', ['cold', 'Cold (out of lava)']), AGE],
    layers: (s) => [L(baby(s) ? 'strider_baby' : 'strider', `strider/strider${s.look === 'cold' ? '_cold' : ''}${B(s)}`)],
  },
  { id: 'sniffer', name: 'Sniffer', props: [AGE], layers: (s) => [L(baby(s) ? 'sniffer_baby' : 'sniffer', baby(s) ? 'sniffer/snifflet' : 'sniffer/sniffer')] },
  aged('camel', 'Camel', 'camel', 'camel/camel'),
  simple('camel_husk', 'Camel Husk', 'camel', 'camel/camel_husk'),
  aged('armadillo', 'Armadillo', 'armadillo', 'armadillo/armadillo'),
  { id: 'breeze', name: 'Breeze', props: [], layers: () => [L('breeze', 'breeze/breeze'), L('breeze#eyes', 'breeze/breeze_eyes', 'Eyes (glow)')] },
  { id: 'creaking', name: 'Creaking', props: [], layers: () => [L('creaking', 'creaking/creaking'), L('creaking', 'creaking/creaking_eyes', 'Eyes (glow)')] },
  { id: 'wither', name: 'Wither', props: [prop('look', 'Look', 'normal', ['invulnerable', 'Invulnerable'])], layers: (s) => [L('wither', s.look === 'invulnerable' ? 'wither/wither_invulnerable' : 'wither/wither')] },
  { id: 'ender_dragon', name: 'Ender Dragon', props: [], layers: () => [L('ender_dragon', 'enderdragon/dragon'), L('ender_dragon', 'enderdragon/dragon_eyes', 'Eyes (glow)')] },
  simple('cod', 'Cod', 'cod', 'fish/cod'),
  simple('salmon', 'Salmon', 'salmon', 'fish/salmon'),
  simple('pufferfish', 'Pufferfish', 'pufferfish_big', 'fish/pufferfish'),
  {
    id: 'tropical_fish',
    name: 'Tropical Fish',
    props: [prop('shape', 'Shape', ['a', 'Small (A)'], ['b', 'Large (B)']), prop('pattern', 'Pattern', 'none', '1', '2', '3', '4', '5', '6')],
    layers: (s) => {
      const shape = s.shape ?? 'a';
      const m = shape === 'a' ? 'tropical_fish_small' : 'tropical_fish_large';
      const out = [L(m, `fish/tropical_${shape}`)];
      if (s.pattern && s.pattern !== 'none') out.push(L(`${m}#pattern`, `fish/tropical_${shape}_pattern_${s.pattern}`, 'Pattern'));
      return out;
    },
  },
];
