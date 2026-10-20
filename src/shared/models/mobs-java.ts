// Java Edition mobs: which model layers the game draws for each mob and which textures go on them,
// with the choices that change the look (variant, baby, wool, profession, collar...) and the things a
// mob can wear (saddles, armour and its trims, harnesses, carpets). Texture paths are relative to
// textures/entity/ (to textures/ with a leading '/', as trims are) without .png; model names are the
// layers of mob-geometry.ts. Follows the 26.x renderers (baby models
// and textures, temperature variants, equipment layers); textures missing from the version on show are
// left out, so older versions show the mobs whose files and layouts still match, and worn things take
// the path the version keeps them at (armour moved to entity/equipment/ in 1.21.2, saddles in 1.21.5).
// Pure.

import type { RGB } from './geometry';
import { DYE_COLORS, DYE_RGB } from './block-entities';
import { JAVA_TRIM_DIRS, JAVA_TRIM_KEY, TRIM_MATERIALS, TRIM_PATTERNS, javaTrimPalette, javaTrimPattern, materialNames, patternNames, trimLabel } from './trims';

export interface MobValue {
  value: string;
  label: string;
}

export interface MobProp {
  name: string;
  label: string;
  values: MobValue[];
  /** Something the mob wears (saddle, armour, carpet...), listed apart from its looks; the first value is "none" */
  gear?: boolean;
  /** Choices shown as one control ('armor': the four armour pieces) */
  group?: string;
  /** Only offered in looks it applies to (a saddle on adults, a dye colour with leather on) */
  showIf?: (s: MobState) => boolean;
  /** The state the choice needs to show (a dye colour needs leather on); the version has the choice when that state draws its layer */
  with?: MobState;
  /** A colour: it shows as the tint of a worn layer rather than a layer of its own */
  tint?: boolean;
  /** Only in versions that have this texture (renderers that draw a layer since a version) */
  since?: string;
  /** A colour of a worn layer's palette (trim material): the version has the value when that palette is there */
  palette?: boolean;
  /** Values the version has beyond the listed ones (newer trim patterns), from its file list (pack paths) */
  discover?: (list: (prefix: string) => string[]) => MobValue[];
}

/** One textured model the game draws for a mob (base, then overlays in drawing order). */
export interface MobLayerRef {
  /** Model layer (mob-geometry.ts) */
  model: string;
  /**
   * Texture relative to textures/entity/ (relative to textures/ with a leading '/'), without extension;
   * several = where versions keep it, the first one the version has wins
   */
  texture: string | string[];
  /** What this texture is, e.g. 'Body', 'Wool', 'Profession' */
  label: string;
  /** Colour the game multiplies the texture with (dyed collars, wool) */
  tint?: RGB;
  /** The gear choice that puts this layer on */
  gear?: string;
  /** A worn thing's entry in the parts list: the layer's boxes show and hide together */
  part?: { name: string; label: string };
  /**
   * Armour trims: the texture is a grey pattern the game recolours from the `key` palette's colours to
   * the `values` palette's (texture names like `texture`, the first one the version has wins)
   */
  palette?: { key: string[]; values: string[] };
}

export type MobState = Record<string, string>;

export interface JavaMobSpec {
  id: string;
  name: string;
  props: MobProp[];
  layers(s: MobState): MobLayerRef[];
  /** Gear looks that between them show every worn texture (a full iron set, a saddle...) */
  gearStates?: MobState[];
  /** Gear choices whose textures open on this mob first (humanoid armour on the armour stand) */
  home?: string[];
}

const pretty = (s: string): string => s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const values = (...v: (string | [string, string])[]): MobValue[] => v.map((x) => (typeof x === 'string' ? { value: x, label: pretty(x) } : { value: x[0], label: x[1] }));
const prop = (name: string, label: string, ...v: (string | [string, string])[]): MobProp => ({ name, label, values: values(...v) });
const AGE = prop('age', 'Age', 'adult', 'baby');
const baby = (s: MobState) => s.age === 'baby';
const B = (s: MobState) => (baby(s) ? '_baby' : '');
const L = (model: string, texture: string | string[], label = 'Body', tint?: RGB): MobLayerRef => ({ model, texture, label, tint });

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

// ---------------------------------------------------------------------------------------------
// Things mobs wear: the game's equipment layers (EquipmentLayerRenderer and the layers that call it)

const adult = (s: MobState) => !baby(s);
const DYES: [string, string][] = DYE_COLORS.map((c) => [c, pretty(c)]);
/** Leather's colour when undyed (equipment/leather.json, color_when_undyed) */
export const LEATHER_RGB: RGB = [0xa0, 0x65, 0x40];
const dyeOf = (s: MobState, undyed: RGB | null): RGB | null => (s.dye && s.dye !== 'none' ? (DYE_RGB[s.dye as keyof typeof DYE_RGB] ?? undyed) : undyed);
const gearLayer = (model: string, texture: string[], label: string, gear: string, part: [string, string], tint?: RGB | null): MobLayerRef => ({
  model,
  texture,
  label,
  tint: tint ?? undefined,
  gear,
  part: { name: part[0], label: part[1] },
});
const dyeProp = (showIf: (s: MobState) => boolean, need: MobState): MobProp => ({ ...prop('dye', 'Dye', ['none', 'Undyed'], ...DYES), gear: true, showIf, with: need, tint: true });

/** A saddle: the mob's saddle layer on the saddle texture (before 1.21.5: `old`, often the mob's own texture). */
function saddle(model: string, equipment: string, old: (s: MobState) => string[] = () => []) {
  return {
    prop: { ...prop('saddle', 'Saddle', ['none', 'Off'], ['on', 'On']), gear: true, showIf: adult } as MobProp,
    layers: (s: MobState): MobLayerRef[] => (s.saddle === 'on' && adult(s) ? [gearLayer(model, [`equipment/${equipment}/saddle`, ...old(s)], 'Saddle', 'saddle', ['saddle', 'Saddle'])] : []),
    states: [{ saddle: 'on' }] as MobState[],
  };
}

export const ARMOR_MATERIALS: [string, string][] = [
  ['leather', 'Leather'],
  ['copper', 'Copper'],
  ['chainmail', 'Chainmail'],
  ['iron', 'Iron'],
  ['gold', 'Gold'],
  ['diamond', 'Diamond'],
  ['netherite', 'Netherite'],
  ['turtle_scute', 'Turtle shell'],
];
/** Armour pieces: state name, label, layer suffix */
export const ARMOR_SLOTS: [string, string][] = [
  ['helmet', 'Helmet'],
  ['chestplate', 'Chestplate'],
  ['leggings', 'Leggings'],
  ['boots', 'Boots'],
];
/** Materials a piece comes in (the turtle shell is a helmet) */
const slotMaterials = (slot: string) => ARMOR_MATERIALS.filter(([m]) => m !== 'turtle_scute' || slot === 'helmet');
/** Before 1.21.2: textures/models/armor/<name>_layer_1 (_2 for leggings) */
const OLD_ARMOR: Record<string, string> = { leather: 'leather', chainmail: 'chainmail', iron: 'iron', gold: 'gold', diamond: 'diamond', netherite: 'netherite', turtle_scute: 'turtle' };
const wearsLeather = (s: MobState) => ARMOR_SLOTS.some(([slot]) => s[slot] === 'leather');

/** Wears some humanoid armour */
const wearsArmor = (s: MobState) => ARMOR_SLOTS.some(([slot]) => !!s[slot] && s[slot] !== 'none');
/** A full set of a material (the pieces it comes in) */
const armorSet = (m: string): MobState => Object.fromEntries(ARMOR_SLOTS.filter(([slot]) => slotMaterials(slot).some(([x]) => x === m)).map(([slot]) => [slot, m]));
const TEX = 'assets/minecraft/textures/';
/** Trim patterns and materials a version has beyond the listed ones (from its folders) */
const discoverPatterns = (list: (prefix: string) => string[]): MobValue[] =>
  JAVA_TRIM_DIRS.patterns
    .flatMap((d) => patternNames(list(TEX + d), TEX + d))
    .filter((p) => !(TRIM_PATTERNS as readonly string[]).includes(p))
    .map((p) => ({ value: p, label: trimLabel(p) }));
const discoverMaterials = (list: (prefix: string) => string[]): MobValue[] =>
  JAVA_TRIM_DIRS.palettes
    .flatMap((d) => materialNames(list(TEX + d), TEX + d))
    .filter((m) => !TRIM_MATERIALS.some(([x]) => x === m))
    .map((m) => ({ value: m, label: trimLabel(m) }));
const FIRST_TRIM_MATERIAL = TRIM_MATERIALS[0][0];

/**
 * Humanoid armour (HumanoidArmorLayer): a model layer per piece (`<model>#helmet`...), the humanoid
 * texture for the helmet, chestplate and boots and the leggings texture for leggings; babies with
 * their own armour models wear the humanoid_baby textures (26.x). Leather is dyed (brown undyed) with
 * an undyed overlay on top. A trim (since 1.20; 1.19.4 behind an experiment) goes over each adult piece
 * on the same model: its pattern recoloured with the trim material's palette, the darker one when the
 * piece is made of the trim's material (EquipmentLayerRenderer; babies' armour has no trim).
 */
function armor(model: string, babyModel: string | null) {
  const ironSet = armorSet('iron');
  const props: MobProp[] = [
    ...ARMOR_SLOTS.map(([slot, label]): MobProp => ({ ...prop(slot, label, ['none', 'None'], ...slotMaterials(slot)), gear: true, group: 'armor', showIf: (s) => adult(s) || !!babyModel })),
    dyeProp((s) => (adult(s) || !!babyModel) && wearsLeather(s), { helmet: 'leather' }),
    {
      ...prop('trim', 'Trim', ['none', 'None'], ...TRIM_PATTERNS.map((p): [string, string] => [p, trimLabel(p)])),
      gear: true,
      showIf: (s) => adult(s) && wearsArmor(s),
      with: { ...ironSet, trim_material: FIRST_TRIM_MATERIAL },
      discover: discoverPatterns,
    },
    {
      ...prop('trim_material', 'Trim material', ...TRIM_MATERIALS),
      gear: true,
      showIf: (s) => adult(s) && wearsArmor(s) && !!s.trim && s.trim !== 'none',
      // (on chainmail, which is no trim material: every material shows its own palette)
      with: { ...armorSet('chainmail'), trim: TRIM_PATTERNS[0] },
      palette: true,
      discover: discoverMaterials,
    },
  ];
  const layers = (s: MobState): MobLayerRef[] => {
    const isBaby = baby(s);
    if (isBaby && !babyModel) return [];
    const out: MobLayerRef[] = [];
    const trims: MobLayerRef[] = [];
    const trim = !isBaby && s.trim && s.trim !== 'none' ? s.trim : null;
    const trimMaterial = s.trim_material || FIRST_TRIM_MATERIAL;
    for (const [slot, label] of ARMOR_SLOTS) {
      const m = s[slot];
      if (!m || m === 'none' || !slotMaterials(slot).some(([x]) => x === m)) continue;
      const legs = slot === 'leggings';
      const layer = `${isBaby ? babyModel : model}#${slot}`;
      const dir = isBaby ? 'humanoid_baby' : legs ? 'humanoid_leggings' : 'humanoid';
      const old = (name: string) => (isBaby || !OLD_ARMOR[m] ? [] : [`/models/armor/${name}_layer_${legs ? 2 : 1}`]);
      const texLabel = legs && !isBaby ? 'Leggings armour' : 'Armour';
      out.push(gearLayer(layer, [`equipment/${dir}/${m}`, ...old(OLD_ARMOR[m])], texLabel, slot, [slot, label], m === 'leather' ? dyeOf(s, LEATHER_RGB) : null));
      if (m === 'leather') {
        const overlay = [`equipment/${dir}/leather_overlay`, ...(isBaby ? [] : [`/models/armor/leather_layer_${legs ? 2 : 1}_overlay`])];
        out.push(gearLayer(layer, overlay, `${texLabel} overlay`, slot, [slot, label]));
      }
      if (trim) {
        // the darker palette when the piece is of the trim's material, where the version has one
        const values = m === trimMaterial ? [...javaTrimPalette(`${trimMaterial}_darker`), ...javaTrimPalette(trimMaterial)] : javaTrimPalette(trimMaterial);
        trims.push({
          ...gearLayer(layer, javaTrimPattern(trim, legs).map((t) => `/${t}`), legs ? 'Leggings trim' : 'Trim', 'trim', ['trim', 'Trim']),
          palette: { key: JAVA_TRIM_KEY.map((t) => `/${t}`), values: values.map((t) => `/${t}`) },
        });
      }
    }
    // (after every piece, so the parts list ends with the trim; each still draws over its own piece)
    return [...out, ...trims];
  };
  // a full set of each material (the turtle shell on its own); each trim pattern on iron; each
  // material's palette on iron (gold for iron's own) and each darker palette on its own material
  const states: MobState[] = ARMOR_MATERIALS.map(([m]) => armorSet(m));
  for (const p of TRIM_PATTERNS) states.push({ ...ironSet, trim: p, trim_material: FIRST_TRIM_MATERIAL });
  for (const [m] of TRIM_MATERIALS) {
    states.push({ ...armorSet(m === 'iron' ? 'gold' : 'iron'), trim: TRIM_PATTERNS[0], trim_material: m });
    if (ARMOR_MATERIALS.some(([a]) => a === m)) states.push({ ...armorSet(m), trim: TRIM_PATTERNS[0], trim_material: m });
  }
  return { props, layers, states };
}

const HORSE_ARMOR: [string, string][] = [
  ['leather', 'Leather'],
  ['copper', 'Copper'],
  ['iron', 'Iron'],
  ['gold', 'Gold'],
  ['diamond', 'Diamond'],
  ['netherite', 'Netherite'],
];

/** Horse armour (adults): entity/equipment/horse_body since 1.21.2, entity/horse/armor before; leather dyed. */
function horseArmor(model: string, since?: string) {
  const props: MobProp[] = [
    { ...prop('armor', 'Armour', ['none', 'None'], ...HORSE_ARMOR), gear: true, showIf: adult, since },
    { ...dyeProp((s) => adult(s) && s.armor === 'leather', { armor: 'leather' }), since },
  ];
  const layers = (s: MobState): MobLayerRef[] => {
    const m = s.armor;
    if (!m || m === 'none' || !adult(s)) return [];
    const part: [string, string] = ['horse_armor', 'Horse armour'];
    const out = [gearLayer(model, [`equipment/horse_body/${m}`, `horse/armor/horse_armor_${m}`], 'Horse armour', 'armor', part, m === 'leather' ? dyeOf(s, LEATHER_RGB) : null)];
    if (m === 'leather') out.push(gearLayer(model, ['equipment/horse_body/leather_overlay'], 'Horse armour overlay', 'armor', part));
    return out;
  };
  return { props, layers, states: HORSE_ARMOR.map(([m]) => ({ armor: m })) as MobState[] };
}

/** Wolf armour (adults): the armour, its dyed overlay (only drawn when dyed) and crack stages. */
function wolfArmor() {
  const on = (s: MobState) => adult(s) && s.armor === 'armadillo_scute';
  const props: MobProp[] = [
    { ...prop('armor', 'Armour', ['none', 'None'], ['armadillo_scute', 'Wolf armour']), gear: true, showIf: adult },
    dyeProp(on, { armor: 'armadillo_scute' }),
    { ...prop('cracks', 'Cracks', 'none', 'low', 'medium', 'high'), gear: true, showIf: on, with: { armor: 'armadillo_scute' } },
  ];
  const layers = (s: MobState): MobLayerRef[] => {
    if (!on(s)) return [];
    const part: [string, string] = ['wolf_armor', 'Wolf armour'];
    const out = [gearLayer('wolf_armor', ['equipment/wolf_body/armadillo_scute', 'wolf/wolf_armor'], 'Wolf armour', 'armor', part)];
    const dye = dyeOf(s, null);
    if (dye) out.push(gearLayer('wolf_armor', ['equipment/wolf_body/armadillo_scute_overlay', 'wolf/wolf_armor_overlay'], 'Wolf armour dye', 'dye', part, dye));
    if (s.cracks && s.cracks !== 'none') out.push(gearLayer('wolf_armor', [`wolf/wolf_armor_crackiness_${s.cracks}`], 'Wolf armour cracks', 'cracks', part));
    return out;
  };
  const states: MobState[] = [{ armor: 'armadillo_scute' }, { armor: 'armadillo_scute', dye: 'red' }, ...['low', 'medium', 'high'].map((c) => ({ armor: 'armadillo_scute', cracks: c }))];
  return { props, layers, states };
}

/** Llama carpets (adults) and the trader llama's decor (LlamaDecorLayer). */
function llamaDecor(trader: boolean) {
  const values: [string, string][] = trader ? [['trader', 'Trader'], ...DYES] : [['none', 'None'], ...DYES];
  const props: MobProp[] = [{ ...prop('decor', 'Carpet', ...values), gear: true, showIf: adult }];
  const layers = (s: MobState): MobLayerRef[] => {
    const part: [string, string] = ['decor', trader ? 'Decor' : 'Carpet'];
    const d = s.decor ?? values[0][0];
    if (baby(s)) return trader ? [gearLayer('llama_baby#decor', ['equipment/llama_body/trader_llama_baby'], 'Trader decor', 'decor', part)] : [];
    if (d === 'trader') return [gearLayer('llama#decor', ['equipment/llama_body/trader_llama', 'llama/decor/trader_llama'], 'Trader decor', 'decor', part)];
    if (d === 'none') return [];
    return [gearLayer('llama#decor', [`equipment/llama_body/${d}`, `llama/decor/${d}`], 'Carpet', 'decor', part)];
  };
  return { props, layers, states: values.filter(([v]) => v !== 'none').map(([v]) => ({ decor: v })) as MobState[] };
}

/** The happy ghast's harness in its sixteen colours (ghastlings can't be harnessed). */
function harness() {
  const props: MobProp[] = [{ ...prop('harness', 'Harness', ['none', 'None'], ...DYES), gear: true, showIf: adult }];
  const layers = (s: MobState): MobLayerRef[] => {
    const c = s.harness;
    if (!c || c === 'none' || baby(s)) return [];
    return [gearLayer('happy_ghast_harness', [`equipment/happy_ghast_body/${c}_harness`], 'Harness', 'harness', ['harness', 'Harness'])];
  };
  return { props, layers, states: DYE_COLORS.map((c) => ({ harness: c })) as MobState[] };
}

const NAUTILUS_ARMOR = HORSE_ARMOR.filter(([m]) => m !== 'leather');

/** Nautilus armour (adults). */
function nautilusArmor() {
  const props: MobProp[] = [{ ...prop('armor', 'Armour', ['none', 'None'], ...NAUTILUS_ARMOR), gear: true, showIf: adult }];
  const layers = (s: MobState): MobLayerRef[] =>
    s.armor && s.armor !== 'none' && adult(s) ? [gearLayer('nautilus_armor', [`equipment/nautilus_body/${s.armor}`], 'Nautilus armour', 'armor', ['nautilus_armor', 'Nautilus armour'])] : [];
  return { props, layers, states: NAUTILUS_ARMOR.map(([m]) => ({ armor: m })) as MobState[] };
}

interface Gear {
  props: MobProp[];
  layers(s: MobState): MobLayerRef[];
  states: MobState[];
}
const asGear = (g: { prop: MobProp; layers(s: MobState): MobLayerRef[]; states: MobState[] }): Gear => ({ props: [g.prop], layers: g.layers, states: g.states });

/** Humanoid armour and its trims open on the armour stand (and baby armour on the zombie) */
const ARMOR_HOME = [...ARMOR_SLOTS.map(([slot]) => slot), 'dye', 'trim'];

/** A mob with things to wear: its gear choices after its own, gear layers over its body. */
function wearing(spec: JavaMobSpec, gear: Gear[], home?: string[]): JavaMobSpec {
  return {
    ...spec,
    props: [...spec.props, ...gear.flatMap((g) => g.props)],
    layers: (s) => [...spec.layers(s), ...gear.flatMap((g) => g.layers(s))],
    gearStates: gear.flatMap((g) => g.states),
    home,
  };
}

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
  wearing(aged('zombie', 'Zombie', 'zombie', 'zombie/zombie'), [armor('zombie', 'zombie_baby')], ARMOR_HOME),
  wearing(aged('husk', 'Husk', 'husk', 'zombie/husk'), [armor('husk', 'husk_baby')]),
  wearing(
    {
      id: 'drowned',
      name: 'Drowned',
      props: [AGE],
      layers: (s) => {
        const m = baby(s) ? 'drowned_baby' : 'drowned';
        return [L(m, `zombie/drowned${B(s)}`), L(`${m}#outer`, `zombie/drowned_outer_layer${B(s)}`, 'Outer layer')];
      },
    },
    [armor('drowned', 'drowned_baby')],
  ),
  wearing(villagerLike('zombie_villager', 'Zombie Villager', 'zombie_villager', 'zombie_villager'), [armor('zombie_villager', 'zombie_villager_baby')]),
  wearing(simple('giant', 'Giant', 'giant', 'zombie/zombie'), [armor('giant', null)]),
  wearing(simple('skeleton', 'Skeleton', 'skeleton', 'skeleton/skeleton'), [armor('skeleton', null)]),
  wearing({ id: 'stray', name: 'Stray', props: [], layers: () => [L('stray', 'skeleton/stray'), L('stray#outer', 'skeleton/stray_overlay', 'Clothes')] }, [armor('stray', null)]),
  wearing({ id: 'bogged', name: 'Bogged', props: [], layers: () => [L('bogged', 'skeleton/bogged'), L('bogged#outer', 'skeleton/bogged_overlay', 'Clothes')] }, [armor('bogged', null)]),
  wearing(simple('wither_skeleton', 'Wither Skeleton', 'wither_skeleton', 'skeleton/wither_skeleton'), [armor('wither_skeleton', null)]),
  wearing(simple('parched', 'Parched', 'parched', 'skeleton/parched'), [armor('parched', null)]),
  { id: 'spider', name: 'Spider', props: [], layers: () => [L('spider', 'spider/spider'), L('spider', 'spider/spider_eyes', 'Eyes (glow)')] },
  { id: 'cave_spider', name: 'Cave Spider', props: [], layers: () => [L('cave_spider', 'spider/cave_spider'), L('cave_spider', 'spider/spider_eyes', 'Eyes (glow)')] },
  { id: 'enderman', name: 'Enderman', props: [], layers: () => [L('enderman', 'enderman/enderman'), L('enderman', 'enderman/enderman_eyes', 'Eyes (glow)')] },
  wearing(
    {
      id: 'pig',
      name: 'Pig',
      props: [prop('variant', 'Variant', ...TEMPERATURES), AGE],
      layers: (s) => {
        const v = s.variant ?? 'temperate';
        return [L(baby(s) ? 'pig_baby' : v === 'cold' ? 'cold_pig' : 'pig', `pig/pig_${v}${B(s)}`)];
      },
    },
    [asGear(saddle('pig#saddle', 'pig_saddle', () => ['pig/pig_saddle']))],
  ),
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
  wearing({
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
  }, [wolfArmor()]),
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
  wearing(
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
    // before 1.21.5 the saddle was part of the coat texture
    [asGear(saddle('horse#saddle', 'horse_saddle', (s) => [`horse/horse_${s.coat ?? 'white'}`])), horseArmor('horse_armor')],
    ['armor', 'dye'],
  ),
  wearing(aged('donkey', 'Donkey', 'donkey', 'horse/donkey'), [asGear(saddle('donkey#saddle', 'donkey_saddle', () => ['horse/donkey']))]),
  wearing(aged('mule', 'Mule', 'mule', 'horse/mule'), [asGear(saddle('mule#saddle', 'mule_saddle', () => ['horse/mule']))]),
  // undead horses wear horse armour since 1.21.11 (when the nautilus came)
  wearing(aged('skeleton_horse', 'Skeleton Horse', 'skeleton_horse', 'horse/horse_skeleton'), [
    asGear(saddle('skeleton_horse#saddle', 'skeleton_horse_saddle', () => ['horse/horse_skeleton'])),
    horseArmor('undead_horse_armor', 'equipment/nautilus_body/iron'),
  ]),
  wearing(aged('zombie_horse', 'Zombie Horse', 'zombie_horse', 'horse/horse_zombie'), [
    asGear(saddle('zombie_horse#saddle', 'zombie_horse_saddle', () => ['horse/horse_zombie'])),
    horseArmor('undead_horse_armor', 'equipment/nautilus_body/iron'),
  ]),
  wearing(
    {
      id: 'llama',
      name: 'Llama',
      props: [prop('variant', 'Variant', 'creamy', 'white', 'brown', 'gray'), AGE],
      layers: (s) => [L(baby(s) ? 'llama_baby' : 'llama', `llama/llama_${s.variant ?? 'creamy'}${B(s)}`)],
    },
    [llamaDecor(false)],
    ['decor'],
  ),
  wearing(
    {
      id: 'trader_llama',
      name: 'Trader Llama',
      props: [prop('variant', 'Variant', 'creamy', 'white', 'brown', 'gray'), AGE],
      layers: (s) => [L(baby(s) ? 'trader_llama_baby' : 'trader_llama', `llama/llama_${s.variant ?? 'creamy'}${B(s)}`)],
    },
    [llamaDecor(true)],
  ),
  { id: 'slime', name: 'Slime', props: [], layers: () => [L('slime', 'slime/slime'), L('slime#outer', 'slime/slime', 'Body')] },
  simple('magma_cube', 'Magma Cube', 'magma_cube', 'slime/magmacube'),
  { id: 'ghast', name: 'Ghast', props: [prop('face', 'Face', 'calm', 'shooting')], layers: (s) => [L('ghast', s.face === 'shooting' ? 'ghast/ghast_shooting' : 'ghast/ghast')] },
  wearing(aged('happy_ghast', 'Happy Ghast', 'happy_ghast', 'ghast/happy_ghast'), [harness()]),
  simple('blaze', 'Blaze', 'blaze', 'blaze/blaze'),
  wearing(aged('piglin', 'Piglin', 'piglin', 'piglin/piglin'), [armor('piglin', 'piglin_baby')]),
  wearing(simple('piglin_brute', 'Piglin Brute', 'piglin_brute', 'piglin/piglin_brute'), [armor('piglin_brute', null)]),
  wearing(aged('zombified_piglin', 'Zombified Piglin', 'zombified_piglin', 'piglin/zombified_piglin'), [armor('zombified_piglin', 'zombified_piglin_baby')]),
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
  // armorstand/wood before 26.1
  wearing({ id: 'armor_stand', name: 'Armor Stand', props: [], layers: () => [L('armor_stand', ['armorstand/armorstand', 'armorstand/wood'])] }, [armor('armor_stand', null)], ARMOR_HOME),
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
  wearing(
    {
      id: 'strider',
      name: 'Strider',
      props: [prop('look', 'Look', 'warm', ['cold', 'Cold (out of lava)']), AGE],
      layers: (s) => [L(baby(s) ? 'strider_baby' : 'strider', `strider/strider${s.look === 'cold' ? '_cold' : ''}${B(s)}`)],
    },
    [asGear(saddle('strider#saddle', 'strider_saddle', () => ['strider/strider_saddle']))],
  ),
  { id: 'sniffer', name: 'Sniffer', props: [AGE], layers: (s) => [L(baby(s) ? 'sniffer_baby' : 'sniffer', baby(s) ? 'sniffer/snifflet' : 'sniffer/sniffer')] },
  // before 1.21.5 the saddle was part of the camel texture
  wearing(aged('camel', 'Camel', 'camel', 'camel/camel'), [asGear(saddle('camel#saddle', 'camel_saddle', () => ['camel/camel']))]),
  wearing(simple('camel_husk', 'Camel Husk', 'camel', 'camel/camel_husk'), [asGear(saddle('camel_husk#saddle', 'camel_husk_saddle'))]),
  wearing(aged('nautilus', 'Nautilus', 'nautilus', 'nautilus/nautilus'), [asGear(saddle('nautilus#saddle', 'nautilus_saddle')), nautilusArmor()], ['saddle', 'armor']),
  wearing(
    {
      id: 'zombie_nautilus',
      name: 'Zombie Nautilus',
      props: [prop('variant', 'Variant', ['normal', 'Normal'], ['warm', 'Warm (coral)'])],
      layers: (s) => [s.variant === 'warm' ? L('zombie_nautilus_coral', 'nautilus/zombie_nautilus_coral') : L('zombie_nautilus', 'nautilus/zombie_nautilus')],
    },
    [asGear(saddle('nautilus#saddle', 'nautilus_saddle')), nautilusArmor()],
  ),
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
