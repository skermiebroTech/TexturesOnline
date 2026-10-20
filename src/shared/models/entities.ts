// Mobs in the model library: their looks (variant, baby, wool, profession...) as states, the textures
// each look draws on which model, and baked geometry split into body parts that can be shown or
// hidden. Java uses the game's model layers (mob-geometry.ts, loaded on first use) and the renderers'
// texture choices (mobs-java.ts). Bedrock reads the vanilla client entity definitions, their
// geometry files and pose animations (loaded per mob on first use, like other Bedrock files).
// Pure apart from the asset reads.

import type { BakedQuad, RGB, Tint } from './geometry';
import { bakeEntityModel, mat4Chain, mat4Scale, mat4Translation, type EntityModel, type EntityPart } from './entity-models';
import { addAnimation, flattenGeo, geoToModel, parseGeoFile, type GeoDef, type NativeTurns, type RestPose } from './bedrock-geo';
import { evalMolang } from './molang';
import { ARMOR_MATERIALS, ARMOR_SLOTS, JAVA_MOBS, LEATHER_RGB, type JavaMobSpec, type MobLayerRef, type MobProp, type MobState, type MobValue } from './mobs-java';
import { DYE_COLORS, DYE_RGB } from './block-entities';
import { BEDROCK_TRIM_KEY, bedrockTrimPalette, bedrockTrimPattern, materialLabel, materialNames, patternNames, sortMaterials, sortPatterns, trimLabel, trimPaletteName } from './trims';
import type { BlockState, StateProperty, StateValue, TextureStates } from './types';

export interface EntityPartInfo {
  /** Part (bone) name */
  name: string;
  label: string;
}

export interface EntityView {
  quads: BakedQuad[];
  /** Body parts, indexed by the quads' `part` */
  parts: EntityPartInfo[];
  /** Label of each texture drawn ('Body', 'Wool'...) */
  labels: Map<string, string>;
  /** Texture size each texture's model maps (a texture of another shape doesn't fit the model) */
  texSizes: Map<string, [number, number]>;
  note?: string;
}

export interface EntityBackend {
  ids(): string[];
  name(id: string): string;
  properties(id: string): StateProperty[];
  defaultState(id: string): BlockState;
  /** Every texture the mob can show, with the states that show it (role = its label) */
  textureStates(id: string): TextureStates[];
  /** Whether the geometry is loaded (resolve needs it) */
  ready(id: string): boolean;
  load(id: string): Promise<boolean>;
  resolve(id: string, state: BlockState): EntityView;
}

/** The game's living-entity transform: turned to face south, upside up, feet on the ground. */
export const MOB_TRANSFORM = mat4Chain(mat4Translation(0, 1.5, 0), mat4Scale(1, -1, -1));

const pretty = (s: string): string =>
  s
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase());

/** Parts with cubes, by path, so each can be shown or hidden (overlay layers share the names). */
function partPaths(model: EntityModel): string[] {
  const out: string[] = [];
  const walk = (ps: EntityPart[], pre: string) => {
    for (const p of ps) {
      const path = pre ? `${pre}/${p.name}` : p.name;
      if (p.cubes?.length) out.push(path);
      if (p.children) walk(p.children, path);
    }
  };
  walk(model.parts, '');
  return out;
}

/** Display name of a part path: its own name ('root/body/head' -> 'Head'), helper parts by their bone. */
const partName = (path: string): string => path.slice(path.lastIndexOf('/') + 1).replace(/~\d+$/, '');

interface LayerInput {
  model: EntityModel;
  texture: string;
  label: string;
  tint?: Tint | null;
  /** A worn thing (saddle, helmet...): all of the layer's boxes are this one entry of the parts list */
  part?: { name: string; label: string };
  /** Only the parts (bones) with these names, by lowercase name */
  only?: (name: string) => boolean;
  /** Bedrock: the texture's alpha is where the dye goes (leather armour) */
  tintMask?: boolean | 'armor';
  /** Armour trims: the grey pattern is recoloured from the key palette to the values palette (pack paths) */
  palette?: { key: string; values: string };
}

/** Labels of a trim's palettes in the textures list */
const PALETTE_LABELS = { key: 'Trim colour key', values: 'Trim colours' };

/**
 * Bakes the layers of a look, part by part (quad.part = index into the returned parts): body parts by
 * name (overlay layers share them), each worn thing as one entry (the layers come body first).
 */
function bakeLayers(layers: LayerInput[]): EntityView {
  const parts: EntityPartInfo[] = [];
  const index = new Map<string, number>();
  const quads: BakedQuad[] = [];
  const labels = new Map<string, string>();
  const texSizes = new Map<string, [number, number]>();
  const partIndex = (key: string, label: string) => {
    let i = index.get(key);
    if (i === undefined) {
      i = parts.length;
      index.set(key, i);
      parts.push({ name: key, label });
    }
    return i;
  };
  for (const l of layers) {
    if (!labels.has(l.texture)) labels.set(l.texture, l.label);
    if (!texSizes.has(l.texture)) texSizes.set(l.texture, l.model.texSize);
    if (l.palette) {
      if (!labels.has(l.palette.key)) labels.set(l.palette.key, PALETTE_LABELS.key);
      if (!labels.has(l.palette.values)) labels.set(l.palette.values, PALETTE_LABELS.values);
    }
    for (const path of partPaths(l.model)) {
      const name = partName(path);
      if (l.only && !l.only(name.toLowerCase())) continue;
      // a worn thing named like a body part (a villager's "helmet" hat) reads as the worn one
      const gearLabel = l.part && parts.some((p) => !p.name.startsWith('gear:') && p.label === l.part!.label) ? `${l.part.label} (worn)` : l.part?.label;
      const i = l.part ? partIndex(`gear:${l.part.name}`, gearLabel!) : partIndex(name, pretty(name));
      const baked = bakeEntityModel(l.model, MOB_TRANSFORM, { texture: l.texture, role: l.label, part: i, tint: l.tint ?? null, only: (p) => p === path });
      if (l.tintMask && l.tint) for (const q of baked) q.tintMask = l.tintMask;
      if (l.palette) for (const q of baked) q.palette = l.palette;
      quads.push(...baked);
    }
  }
  return { quads, parts, labels, texSizes };
}

/** Every combination of property values (capped). */
function allStates(props: StateProperty[], cap = 768): BlockState[] {
  let out: BlockState[] = [{}];
  for (const p of props) {
    const next: BlockState[] = [];
    for (const s of out) for (const v of p.values) if (next.length < cap) next.push({ ...s, [p.name]: v.value });
    out = next;
  }
  return out;
}

interface TextureRef {
  path: string;
  label: string;
  /** Worn (armour, saddle...) */
  gear?: boolean;
  /** This mob is where the worn texture opens first */
  home?: boolean;
}

function collectTextures(states: BlockState[], layersOf: (s: BlockState) => TextureRef[]): TextureStates[] {
  const by = new Map<string, TextureStates>();
  for (const s of states) {
    for (const l of layersOf(s)) {
      let t = by.get(l.path);
      if (!t) by.set(l.path, (t = { path: l.path, role: l.label, states: [], dirs: [], gear: l.gear || undefined, home: l.home || undefined }));
      else {
        // a texture of the mob's own look is not worn, even when a worn thing uses it too (an old saddle)
        if (!l.gear) t.gear = undefined;
        if (l.home) t.home = true;
      }
      t.states.push(s);
    }
  }
  return [...by.values()];
}

/** The props a mob's looks are made of (worn things are collected one by one, not combined). */
const lookProps = (props: StateProperty[]) => props.filter((p) => !p.gear);


// ---------------------------------------------------------------------------------------------
// Java

export interface JavaEntityContext {
  hasFile(path: string): boolean;
  /** Pack paths starting with a prefix (finds trim patterns and materials newer than the lists) */
  listFiles?(prefix: string): string[];
  /** Loads the geometry tables (a lazily loaded chunk in the app) */
  geometry?: () => Promise<(name: string) => EntityModel | null>;
}

export class JavaEntities implements EntityBackend {
  private readonly specs = new Map<string, JavaMobSpec>();
  private readonly propCache = new Map<string, StateProperty[]>();
  private readonly texCache = new Map<string, TextureStates[]>();
  private layerOf: ((name: string) => EntityModel | null) | null = null;
  private loading: Promise<boolean> | null = null;

  constructor(private readonly ctx: JavaEntityContext) {
    for (const s of JAVA_MOBS) if (this.paths(s, this.firstState(s)).length) this.specs.set(s.id, s);
  }

  /** Pack path of a texture name: relative to textures/entity/, or to textures/ with a leading '/' */
  private path(rel: string): string {
    return rel.startsWith('/') ? `assets/minecraft/textures${rel}.png` : `assets/minecraft/textures/entity/${rel}.png`;
  }

  /** The first of a texture's places the version has */
  private first(names: string | string[]): string | null {
    for (const t of Array.isArray(names) ? names : [names]) {
      const p = this.path(t);
      if (this.ctx.hasFile(p)) return p;
    }
    return null;
  }

  /** The texture a layer draws in this version: the first of its places the version has */
  private texture(l: MobLayerRef): string | null {
    return this.first(l.texture);
  }

  private firstState(s: JavaMobSpec): MobState {
    return Object.fromEntries(s.props.map((p) => [p.name, p.values[0].value]));
  }

  /**
   * The look's layers with the textures the version has (none when the base texture is missing); a
   * trim's palettes where the version has them (without, the game draws the pattern uncoloured).
   */
  private layers(s: JavaMobSpec, state: MobState): (MobLayerRef & { path: string; palettePaths?: { key: string; values: string } })[] {
    const all = s.layers(state);
    const out: (MobLayerRef & { path: string; palettePaths?: { key: string; values: string } })[] = [];
    for (const l of all) {
      const path = this.texture(l);
      if (!path) {
        if (l === all[0]) return [];
        continue;
      }
      const key = l.palette ? this.first(l.palette.key) : null;
      const values = l.palette ? this.first(l.palette.values) : null;
      out.push(key && values ? { ...l, path, palettePaths: { key, values } } : { ...l, path });
    }
    return out;
  }

  private paths(s: JavaMobSpec, state: MobState): TextureRef[] {
    const out: TextureRef[] = [];
    for (const l of this.layers(s, state)) {
      const ref = { label: l.label, gear: !!l.gear, home: !!l.gear && !!s.home?.includes(l.gear) };
      out.push({ ...ref, path: l.path });
      if (l.palettePaths) out.push({ ...ref, path: l.palettePaths.key, label: PALETTE_LABELS.key }, { ...ref, path: l.palettePaths.values, label: PALETTE_LABELS.values });
    }
    return out;
  }

  /** Whether a gear choice's value shows in this version (its textures are there, or it's "none"). */
  private gearShows(s: JavaMobSpec, base: MobState, p: MobProp, value: string): boolean {
    if (value === p.values[0].value) return true;
    if (p.since && !this.ctx.hasFile(this.path(p.since))) return false;
    const layers = this.layers(s, { ...base, ...p.with, [p.name]: value });
    // a trim material is a palette; a dye colour tints a worn layer; other gear draws layers of its own
    if (p.palette) return layers.some((l) => !!l.gear && !!l.palettePaths && l.palettePaths.values.endsWith(`/${value}.png`));
    return layers.some((l) => (p.tint ? !!l.tint && !!l.gear : l.gear === p.name));
  }

  /** A choice's values, with the ones the version has beyond the listed ones (newer trim patterns). */
  private valuesOf(p: MobProp): MobValue[] {
    if (!p.discover || !this.ctx.listFiles) return p.values;
    const known = new Set(p.values.map((v) => v.value));
    const extra = p.discover((prefix) => this.ctx.listFiles!(prefix)).filter((v) => !known.has(v.value) && known.add(v.value));
    return extra.length ? [...p.values, ...extra.sort((a, b) => a.label.localeCompare(b.label))] : p.values;
  }

  ids(): string[] {
    return [...this.specs.keys()];
  }

  name(id: string): string {
    return this.specs.get(id)?.name ?? pretty(id);
  }

  properties(id: string): StateProperty[] {
    const hit = this.propCache.get(id);
    if (hit) return hit;
    const s = this.specs.get(id);
    if (!s) return [];
    const base = this.firstState(s);
    // Values the version has textures for (older versions have no baby textures, fewer variants, no
    // copper armour...)
    const props: StateProperty[] = s.props
      .map((p) => {
        const values = p.gear ? this.valuesOf(p).filter((v) => this.gearShows(s, base, p, v.value)) : p.values.filter((v) => this.paths(s, { ...base, [p.name]: v.value }).length > 0);
        const out: StateProperty = { name: p.name, label: p.label, values };
        if (p.gear) out.gear = true;
        if (p.group) out.group = p.group;
        if (p.showIf) out.showIf = p.showIf;
        return out;
      })
      .filter((p) => p.values.length > 1);
    this.propCache.set(id, props);
    return props;
  }

  defaultState(id: string): BlockState {
    return Object.fromEntries(this.properties(id).map((p) => [p.name, p.values[0].value]));
  }

  textureStates(id: string): TextureStates[] {
    const hit = this.texCache.get(id);
    if (hit) return hit;
    const s = this.specs.get(id);
    if (!s) return [];
    const base = this.firstState(s);
    const props = this.properties(id);
    // every look; then each worn thing on the default look, at each age that can wear it
    const states = allStates(lookProps(props));
    const shown = new Set(props.map((p) => p.name));
    const ages = props.find((p) => p.name === 'age')?.values.map((v) => v.value) ?? [base.age ?? ''];
    for (const g of s.gearStates ?? []) {
      const gear = Object.fromEntries(Object.entries(g).filter(([k]) => shown.has(k)));
      if (!Object.keys(gear).length) continue;
      for (const age of ages) states.push({ ...this.defaultState(id), ...(age ? { age } : {}), ...gear });
    }
    // values the version has beyond the listed ones (a newer trim pattern), each on the choice's own look
    for (const p of s.props) {
      if (!p.discover) continue;
      const listed = new Set(p.values.map((v) => v.value));
      for (const v of props.find((x) => x.name === p.name)?.values ?? []) if (!listed.has(v.value)) states.push({ ...this.defaultState(id), ...p.with, [p.name]: v.value });
    }
    const out = collectTextures(states, (st) => this.paths(s, { ...base, ...st }));
    this.texCache.set(id, out);
    return out;
  }

  ready(): boolean {
    return !!this.layerOf;
  }

  load(): Promise<boolean> {
    if (this.layerOf) return Promise.resolve(true);
    this.loading ??= (this.ctx.geometry ? this.ctx.geometry() : import('./mob-geometry').then((m) => m.mobLayer)).then(
      (f) => {
        this.layerOf = f;
        return true;
      },
      () => {
        this.loading = null;
        return false;
      },
    );
    return this.loading;
  }

  resolve(id: string, state: BlockState): EntityView {
    const s = this.specs.get(id);
    if (!s || !this.layerOf) return { quads: [], parts: [], labels: new Map(), texSizes: new Map() };
    const inputs: LayerInput[] = [];
    for (const l of this.layers(s, { ...this.firstState(s), ...state })) {
      const model = this.layerOf(l.model);
      if (!model) continue;
      inputs.push({ model, texture: l.path, label: l.label, tint: l.tint ? { kind: 'fixed', rgb: l.tint } : null, part: l.part, palette: l.palettePaths });
    }
    return bakeLayers(inputs);
  }
}

// ---------------------------------------------------------------------------------------------
// Bedrock

interface BedrockMobSpec {
  id: string;
  name: string;
  /** Client entity file in entity/ */
  file: string;
  /** Texture folders under textures/entity/ (finding the mob of a texture before its file is read) */
  dirs: string[];
  /** Texture keys to leave out (saddles, armour, beams...) */
  skip?: RegExp;
  /** Texture keys drawn over another one (overlays), and the key they go over */
  over?: (key: string, keys: string[]) => string | null;
  /** Molang variables the game sets for the mob standing around (its animation controllers read them) */
  vars?: Record<string, number>;
  /** Wears humanoid armour (the armour items' attachables) */
  armor?: boolean;
  /**
   * Worn textures open on this mob first; the folders / file prefixes of the ones it wears that are
   * outside its own folders (known before its entity file is read)
   */
  home?: string[];
  /** The trader llama: its decor is always on */
  trader?: boolean;
}

/** Cats' animation controllers: standing around is their walking state at speed 0 */
const WALKING = { 'variable.state': 3 };

/**
 * Bones whose boxes the game turns itself (degrees), by geometry: these models keep their bodies
 * standing up in the file, with the legs and head laid out for the turned body.
 */
const CAT_TURNS: NativeTurns = {
  body: { boxes: [90, 0, 0] },
  // the tail laid out straight back (the game places its two pieces itself)
  tail1: { bone: [0, 0, 0], boxes: [90, 0, 0] },
  tail2: { bone: [0, 0, 0], boxes: [90, 0, 0] },
};
const NATIVE_TURNS: Record<string, NativeTurns> = {
  'geometry.cat': CAT_TURNS,
  'geometry.ocelot.v1.8': CAT_TURNS,
  'geometry.fox': { body: { boxes: [90, 0, 0] }, tail: { bone: [90, 0, 0] } },
  'geometry.polarbear': { body: { boxes: [90, 0, 0] } },
  'geometry.llama.v1.8': { body: { boxes: [90, 0, 0] } },
};

const SKIP_COMMON = /saddle|^armor|_armor|armor_none|beam|^charged$|decor|ropes|tendrils|markings_none|^cracked_none$|^ghost$|breeze_wind|_wind$/;
const firstWith = (keys: string[], re: RegExp) => keys.find((k) => re.test(k)) ?? null;
const VILLAGER_OVERLAY = /^(baby_)?(desert|jungle|plains|savanna|snow|swamp|taiga)$|^(armorer|butcher|cartographer|cleric|farmer|fisherman|fletcher|leatherworker|librarian|shepherd|tool_smith|weapon_smith|stonemason|nitwit|unskilled)$|^level_/;

const BEDROCK_MOBS: BedrockMobSpec[] = [
  { id: 'creeper', name: 'Creeper', file: 'creeper', dirs: ['creeper'] },
  { id: 'zombie', name: 'Zombie', file: 'zombie', dirs: ['zombie'], armor: true },
  { id: 'husk', name: 'Husk', file: 'husk', dirs: ['zombie'], armor: true },
  { id: 'drowned', name: 'Drowned', file: 'drowned', dirs: ['zombie'], armor: true },
  {
    id: 'zombie_villager',
    name: 'Zombie Villager',
    file: 'zombie_villager_v2',
    dirs: ['zombie_villager2', 'zombie_villager'],
    over: (k, keys) => (VILLAGER_OVERLAY.test(k) ? (k.startsWith('baby_') ? firstWith(keys, /^baby_default$/) : 'default') : null),
    armor: true,
  },
  { id: 'skeleton', name: 'Skeleton', file: 'skeleton', dirs: ['skeleton'], armor: true },
  { id: 'stray', name: 'Stray', file: 'stray', dirs: ['skeleton'], over: (k) => (k === 'overlay' ? 'default' : null), armor: true },
  { id: 'bogged', name: 'Bogged', file: 'bogged', dirs: ['skeleton'], over: (k) => (k === 'overlay' ? 'default' : null), armor: true },
  { id: 'wither_skeleton', name: 'Wither Skeleton', file: 'wither_skeleton', dirs: ['skeleton'], armor: true },
  { id: 'parched', name: 'Parched', file: 'parched', dirs: ['skeleton'], armor: true },
  { id: 'spider', name: 'Spider', file: 'spider', dirs: ['spider'] },
  { id: 'cave_spider', name: 'Cave Spider', file: 'cave_spider', dirs: ['spider'] },
  { id: 'enderman', name: 'Enderman', file: 'enderman', dirs: ['enderman'] },
  { id: 'pig', name: 'Pig', file: 'pig', dirs: ['pig'], home: ['textures/entity/saddle_v2'] },
  { id: 'cow', name: 'Cow', file: 'cow', dirs: ['cow'] },
  { id: 'mooshroom', name: 'Mooshroom', file: 'mooshroom', dirs: ['cow'] },
  { id: 'sheep', name: 'Sheep', file: 'sheep', dirs: ['sheep'] },
  { id: 'chicken', name: 'Chicken', file: 'chicken', dirs: ['chicken'] },
  {
    id: 'villager',
    name: 'Villager',
    file: 'villager_v2',
    dirs: ['villager2', 'villager'],
    skip: /^(baby_)?base[2-6]$/,
    over: (k, keys) => (VILLAGER_OVERLAY.test(k) ? (k.startsWith('baby_') ? firstWith(keys, /^baby_base$/) : 'base') : null),
  },
  { id: 'wandering_trader', name: 'Wandering Trader', file: 'wandering_trader', dirs: ['wandering_trader'] },
  { id: 'witch', name: 'Witch', file: 'witch', dirs: [''] },
  { id: 'evoker', name: 'Evoker', file: 'evocation_illager', dirs: ['illager'] },
  { id: 'vindicator', name: 'Vindicator', file: 'vindicator', dirs: ['illager'] },
  { id: 'pillager', name: 'Pillager', file: 'pillager', dirs: ['pillager', 'illager'] },
  { id: 'ravager', name: 'Ravager', file: 'ravager', dirs: ['illager'] },
  { id: 'vex', name: 'Vex', file: 'vex', dirs: ['vex', 'illager'] },
  { id: 'iron_golem', name: 'Iron Golem', file: 'iron_golem', dirs: ['iron_golem'], over: (k) => (k.startsWith('cracked_') ? 'default' : null) },
  { id: 'snow_golem', name: 'Snow Golem', file: 'snow_golem', dirs: [''] },
  { id: 'wolf', name: 'Wolf', file: 'wolf', dirs: ['wolf'], home: [] },
  { id: 'cat', name: 'Cat', file: 'cat', dirs: ['cat'], vars: WALKING },
  { id: 'ocelot', name: 'Ocelot', file: 'ocelot', dirs: ['cat'], vars: WALKING },
  { id: 'fox', name: 'Fox', file: 'fox', dirs: ['fox'] },
  {
    id: 'horse',
    name: 'Horse',
    file: 'horse_v3',
    dirs: ['horse2', 'horse'],
    over: (k, keys) => (/^(baby_)?markings_/.test(k) ? firstWith(keys, k.startsWith('baby_') ? /^baby_base_/ : /^base_/) : null),
    home: ['textures/entity/horse2/armor/', 'textures/entity/horse/armor/'],
  },
  { id: 'donkey', name: 'Donkey', file: 'donkey_v3', dirs: ['horse2', 'horse'] },
  { id: 'mule', name: 'Mule', file: 'mule_v3', dirs: ['horse2', 'horse'] },
  { id: 'skeleton_horse', name: 'Skeleton Horse', file: 'skeleton_horse_v3', dirs: ['horse2', 'horse'] },
  { id: 'zombie_horse', name: 'Zombie Horse', file: 'zombie_horse_v3', dirs: ['horse2', 'horse'] },
  { id: 'llama', name: 'Llama', file: 'llama', dirs: ['llama'], home: ['textures/entity/llama/decor/'] },
  { id: 'trader_llama', name: 'Trader Llama', file: 'trader_llama', dirs: ['llama'], trader: true },
  { id: 'slime', name: 'Slime', file: 'slime', dirs: ['slime'] },
  { id: 'magma_cube', name: 'Magma Cube', file: 'magma_cube', dirs: ['slime'] },
  { id: 'ghast', name: 'Ghast', file: 'ghast', dirs: ['ghast'] },
  { id: 'happy_ghast', name: 'Happy Ghast', file: 'happy_ghast', dirs: ['ghast', 'happy_ghast'], home: ['textures/entity/harness/'] },
  { id: 'blaze', name: 'Blaze', file: 'blaze', dirs: [''] },
  { id: 'piglin', name: 'Piglin', file: 'piglin', dirs: ['piglin'], armor: true },
  { id: 'piglin_brute', name: 'Piglin Brute', file: 'piglin_brute', dirs: ['piglin'], armor: true },
  { id: 'zombified_piglin', name: 'Zombified Piglin', file: 'zombie_pigman', dirs: ['piglin', 'pigzombie'], armor: true },
  { id: 'hoglin', name: 'Hoglin', file: 'hoglin', dirs: ['hoglin'] },
  { id: 'zoglin', name: 'Zoglin', file: 'zoglin', dirs: ['hoglin', 'zoglin'] },
  { id: 'phantom', name: 'Phantom', file: 'phantom', dirs: ['phantom'] },
  { id: 'bee', name: 'Bee', file: 'bee', dirs: ['bee'] },
  { id: 'axolotl', name: 'Axolotl', file: 'axolotl', dirs: ['axolotl'] },
  { id: 'frog', name: 'Frog', file: 'frog', dirs: ['frog'] },
  { id: 'tadpole', name: 'Tadpole', file: 'tadpole', dirs: ['tadpole'] },
  { id: 'allay', name: 'Allay', file: 'allay', dirs: ['allay'] },
  { id: 'warden', name: 'Warden', file: 'warden', dirs: ['warden'], over: (k) => (k !== 'default' ? 'default' : null) },
  { id: 'armor_stand', name: 'Armor Stand', file: 'armor_stand', dirs: [''], armor: true, home: ['textures/models/armor/', 'textures/trims/'] },
  { id: 'polar_bear', name: 'Polar Bear', file: 'polar_bear', dirs: ['polarbear', 'bear'] },
  { id: 'panda', name: 'Panda', file: 'panda', dirs: ['panda'] },
  { id: 'rabbit', name: 'Rabbit', file: 'rabbit', dirs: ['rabbit'] },
  { id: 'parrot', name: 'Parrot', file: 'parrot', dirs: ['parrot'] },
  { id: 'turtle', name: 'Turtle', file: 'turtle', dirs: ['sea_turtle', 'turtle'] },
  { id: 'goat', name: 'Goat', file: 'goat', dirs: ['goat'] },
  { id: 'dolphin', name: 'Dolphin', file: 'dolphin', dirs: [''] },
  { id: 'squid', name: 'Squid', file: 'squid', dirs: ['squid', ''] },
  { id: 'glow_squid', name: 'Glow Squid', file: 'glow_squid', dirs: ['glow_squid', 'squid'] },
  { id: 'guardian', name: 'Guardian', file: 'guardian', dirs: [''], skip: /^elder$/ },
  { id: 'elder_guardian', name: 'Elder Guardian', file: 'elder_guardian', dirs: [''], skip: /^default$/ },
  { id: 'silverfish', name: 'Silverfish', file: 'silverfish', dirs: [''] },
  { id: 'endermite', name: 'Endermite', file: 'endermite', dirs: [''] },
  { id: 'bat', name: 'Bat', file: 'bat', dirs: [''] },
  { id: 'strider', name: 'Strider', file: 'strider', dirs: ['strider'] },
  { id: 'sniffer', name: 'Sniffer', file: 'sniffer', dirs: ['sniffer'] },
  { id: 'camel', name: 'Camel', file: 'camel', dirs: ['camel'] },
  { id: 'camel_husk', name: 'Camel Husk', file: 'camel_husk', dirs: ['camel', 'camel_husk'] },
  { id: 'nautilus', name: 'Nautilus', file: 'nautilus', dirs: ['nautilus'], home: ['textures/entity/nautilus/armor/'] },
  { id: 'zombie_nautilus', name: 'Zombie Nautilus', file: 'zombie_nautilus', dirs: ['nautilus'] },
  { id: 'armadillo', name: 'Armadillo', file: 'armadillo', dirs: ['armadillo'] },
  { id: 'breeze', name: 'Breeze', file: 'breeze', dirs: ['breeze'], over: (k) => (k === 'breeze_eyes' ? 'default' : null) },
  { id: 'creaking', name: 'Creaking', file: 'creaking', dirs: ['creaking'], over: (k) => (k === 'eyes' ? 'default' : null) },
  { id: 'wither', name: 'Wither', file: 'wither', dirs: ['wither_boss', 'wither'] },
  { id: 'ender_dragon', name: 'Ender Dragon', file: 'ender_dragon', dirs: ['dragon', 'enderdragon'] },
  { id: 'cod', name: 'Cod', file: 'cod', dirs: ['fish'] },
  { id: 'salmon', name: 'Salmon', file: 'salmon', dirs: ['fish'] },
  { id: 'pufferfish', name: 'Pufferfish', file: 'pufferfish', dirs: ['fish'] },
  {
    id: 'tropical_fish',
    name: 'Tropical Fish',
    file: 'tropicalfish',
    dirs: ['fish'],
    over: (k) => {
      const m = /^([ab])Pattern/i.exec(k);
      return m ? `type${m[1].toUpperCase()}` : null;
    },
  },
];

export interface BedrockEntityContext {
  hasFile(path: string): boolean;
  listFiles(prefix: string): string[];
  /** Parsed JSON of a vanilla file (lenient), or undefined when it can't be read */
  readJson(path: string): Promise<unknown>;
}

interface BedrockLook {
  key: string;
  label: string;
  /** Base first, then overlays */
  layers: { key: string; path: string; geo: string }[];
  /** A baby look (babies wear nothing, or their own armour) */
  baby: boolean;
}

/** Something a Bedrock mob wears: a choice and the layers each value draws over a look. */
interface BedrockGear {
  prop: StateProperty;
  /** Layers for the chosen value on a look ('none' draws nothing; a colour choice draws through others) */
  layers?(value: string, look: BedrockLook, state: BlockState): LayerInput[];
  /** Replaces the look's own textures (a saddled strider's texture) */
  swap?(value: string, look: BedrockLook): BedrockLook;
  /** The mob's own model hides bones while this is on (a nautilus's shell under its armour) */
  hidesBase?: boolean;
  /** Looks that together show every texture of the choice */
  states: BlockState[];
}

interface BedrockLoaded {
  looks: BedrockLook[];
  models: Map<string, EntityModel>;
  /** The mob's own models with armour on, where armour hides bones */
  armored: Map<string, EntityModel>;
  gear: BedrockGear[];
  /** Worn textures open on this mob first */
  home: boolean;
}

/** A render controller of the entity: what it draws and the bones it shows, by Molang condition. */
interface RenderController {
  id: string;
  geometry: string;
  textures: string[];
  arrays: Record<string, string[]>;
  rules: { re: RegExp; cond: unknown }[];
}

const SADDLED = { 'query.is_saddled': 1 };
const ARMORED = { 'variable.has_armor': 1 };
const SADDLE_PART = { name: 'saddle', label: 'Saddle' };
const TRIM_PART = { name: 'trim', label: 'Trim' };
const NONE: StateValue = { value: 'none', label: 'None' };
const DYE_VALUES: StateValue[] = [{ value: 'none', label: 'Undyed' }, ...DYE_COLORS.map((c) => ({ value: c, label: pretty(c) }))];
const dyeTint = (s: BlockState, undyed: RGB | null): Tint | null => {
  const rgb = s.dye && s.dye !== 'none' ? (DYE_RGB[s.dye as keyof typeof DYE_RGB] ?? undyed) : undyed;
  return rgb ? { kind: 'fixed', rgb } : null;
};
/** Bedrock armour item names to the material names used here */
const BEDROCK_MATERIAL: Record<string, string> = { golden: 'gold', turtle_shell: 'turtle_scute' };
/** Bedrock armour texture stems (textures/models/armor/<stem>) to their baby texture */
const BABY_ARMOR: Record<string, string> = { chain_1: 'chainmail_baby', cloth_1: 'leather_baby', turtle_1: 'turtle_scute_baby' };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export class BedrockEntities implements EntityBackend {
  private readonly specs = new Map<string, BedrockMobSpec>();
  private readonly loaded = new Map<string, BedrockLoaded>();
  private readonly loads = new Map<string, Promise<boolean>>();
  private readonly geoFiles = new Map<string, Promise<Map<string, GeoDef>>>();
  private readonly geoIndex = new Map<string, GeoDef>();
  private allGeoScanned: Promise<void> | null = null;

  constructor(private readonly ctx: BedrockEntityContext) {
    for (const s of BEDROCK_MOBS) if (ctx.hasFile(`entity/${s.file}.entity.json`)) this.specs.set(s.id, s);
  }

  ids(): string[] {
    return [...this.specs.keys()];
  }

  name(id: string): string {
    return this.specs.get(id)?.name ?? pretty(id);
  }

  properties(id: string): StateProperty[] {
    const l = this.loaded.get(id);
    if (!l) return [];
    const out: StateProperty[] = [];
    if (l.looks.length > 1) out.push({ name: 'look', label: 'Look', values: l.looks.map((k) => ({ value: k.key, label: k.label })) });
    for (const g of l.gear) if (g.prop.values.length > 1) out.push(g.prop);
    return out;
  }

  defaultState(id: string): BlockState {
    return Object.fromEntries(this.properties(id).map((p) => [p.name, p.values[0].value]));
  }

  textureStates(id: string): TextureStates[] {
    const l = this.loaded.get(id);
    if (l) {
      const states: BlockState[] = l.looks.length > 1 ? l.looks.map((k) => ({ look: k.key })) : [{}];
      const base = this.defaultState(id);
      for (const g of l.gear) for (const st of g.states) states.push({ ...base, ...st });
      return collectTextures(states, (s) =>
        this.layersOf(l, { ...base, ...s }).flatMap((x) => {
          const ref = { label: x.label, gear: !!x.part || x.gear, home: (!!x.part || x.gear) && l.home };
          const out: TextureRef[] = [{ ...ref, path: x.texture }];
          if (x.palette) out.push({ ...ref, path: x.palette.key, label: PALETTE_LABELS.key }, { ...ref, path: x.palette.values, label: PALETTE_LABELS.values });
          return out;
        }),
      );
    }
    // Before the entity file is read: the textures in the mob's folders whose names fit it.
    if (!this.specs.has(id)) return [];
    return (this.guesses().get(id) ?? []).map((p) => ({ path: p, role: 'Body', states: [{}], dirs: [] }));
  }

  private guessCache: Map<string, string[]> | null = null;
  /**
   * Mob id -> textures it probably uses, from the folders the mobs keep their textures in: a file goes
   * to the mobs of its folder whose names it carries (husk.png to the husk), else to every mob of that
   * folder (a cat's tabby.png).
   */
  private guesses(): Map<string, string[]> {
    if (this.guessCache) return this.guessCache;
    const out = new Map<string, string[]>();
    const byDir = new Map<string, BedrockMobSpec[]>();
    for (const s of this.specs.values()) for (const d of s.dirs) byDir.set(d, [...(byDir.get(d) ?? []), s]);
    const words = (s: BedrockMobSpec) => [s.id, s.file.replace(/_v\d+$/, ''), ...s.id.split('_')].filter((w) => w.length > 2);
    for (const [dir, specs] of byDir) {
      const prefix = dir ? `textures/entity/${dir}/` : 'textures/entity/';
      for (const p of this.ctx.listFiles(prefix)) {
        if (!/\.(png|tga)$/i.test(p) || p.slice(prefix.length).includes('/')) continue;
        const name = p.slice(prefix.length).replace(/\.(png|tga)$/i, '').toLowerCase().replace(/[-\s]/g, '_');
        let owners = specs.filter((s) => words(s).some((w) => name.includes(w)));
        if (!owners.length && dir) owners = specs;
        for (const s of owners) out.set(s.id, [...(out.get(s.id) ?? []), p]);
      }
    }
    // worn textures kept outside the mob's folders (armour, harnesses...)
    for (const s of this.specs.values())
      for (const prefix of s.home ?? []) for (const p of this.ctx.listFiles(prefix)) if (/\.(png|tga)$/i.test(p) && !/_none\.|\/items\/|_mers\./.test(p)) out.set(s.id, [...(out.get(s.id) ?? []), p]);
    this.guessCache = out;
    return out;
  }

  ready(id: string): boolean {
    return this.loaded.has(id);
  }

  private texturePath(p: string): string | null {
    for (const ext of ['.png', '.tga']) if (this.ctx.hasFile(p + ext)) return p + ext;
    return this.ctx.hasFile(p) ? p : null;
  }

  /** Geometry by identifier: files named like it first, then every geometry file. */
  private async geo(id: string): Promise<GeoDef | undefined> {
    const hit = this.geoIndex.get(id);
    if (hit) return hit;
    const files = [...this.ctx.listFiles('models/entity/').filter((f) => f.endsWith('.json')), 'models/mobs.json'];
    const tokens = id.replace(/^geometry\./, '').split(/[._]/).filter((t) => t.length > 2 && !/^v\d/.test(t));
    const near = files.filter((f) => tokens.some((t) => f.slice(f.lastIndexOf('/') + 1).includes(t)));
    for (const f of near) {
      await this.readGeoFile(f);
      const g = this.geoIndex.get(id);
      if (g) return g;
    }
    this.allGeoScanned ??= Promise.all(files.map((f) => this.readGeoFile(f))).then(() => undefined);
    await this.allGeoScanned;
    return this.geoIndex.get(id);
  }

  private readGeoFile(path: string): Promise<Map<string, GeoDef>> {
    let p = this.geoFiles.get(path);
    if (!p) {
      p = this.ctx.readJson(path).then((json) => {
        const m = parseGeoFile(json);
        for (const [k, v] of m) if (!this.geoIndex.has(k)) this.geoIndex.set(k, v);
        return m;
      });
      this.geoFiles.set(path, p);
    }
    return p;
  }

  private async flat(id: string): Promise<GeoDef | null> {
    // load the whole parent chain first
    const seen = new Set<string>();
    let cur = await this.geo(id);
    while (cur?.parent && !seen.has(cur.parent)) {
      seen.add(cur.parent);
      cur = await this.geo(cur.parent);
    }
    return flattenGeo(id, (x) => this.geoIndex.get(x));
  }

  private readonly defFiles = new Map<string, Promise<Record<string, unknown> | null>>();
  private readonly scanned = new Map<string, Promise<void>>();

  /** The "animations" / "render_controllers" object of a vanilla file (cached). */
  private defsIn(path: string, key: string): Promise<Record<string, unknown> | null> {
    let p = this.defFiles.get(path);
    if (!p) {
      p = this.ctx.readJson(path).then((json) => (isObj(json) && isObj(json[key]) ? (json[key] as Record<string, unknown>) : null));
      this.defFiles.set(path, p);
    }
    return p;
  }

  /**
   * Definitions by id from a folder of definition files: the files named after the id's subject first
   * ('animation.cat.walk' in cat.animation.json), then every file of the folder.
   */
  private async findDefs(dir: string, key: string, ids: string[]): Promise<Map<string, unknown>> {
    const found = new Map<string, unknown>();
    if (!ids.length) return found;
    const files = this.ctx.listFiles(`${dir}/`).filter((f) => f.endsWith('.json'));
    const take = async (f: string) => {
      const defs = await this.defsIn(f, key);
      if (defs) for (const id of ids) if (!found.has(id) && defs[id] !== undefined) found.set(id, defs[id]);
    };
    const subjects = new Set(ids.map((id) => id.split('.')[id.startsWith('controller.') ? 2 : 1] ?? '').filter(Boolean));
    for (const f of files) {
      const name = f.slice(dir.length + 1);
      if ([...subjects].some((t) => name.startsWith(t) || name.includes(t.split('_')[0]))) await take(f);
      if (ids.every((id) => found.has(id))) return found;
    }
    let all = this.scanned.get(dir);
    if (!all) {
      all = Promise.all(files.map((f) => this.defsIn(f, key))).then(() => undefined);
      this.scanned.set(dir, all);
    }
    await all;
    for (const f of files) await take(f);
    return found;
  }

  /**
   * The pose the entity holds standing still at time 0 (a spider's legs, a wolf's body...): the
   * animations its scripts and animation controllers play with every query at 0, in their order.
   */
  private async restPose(desc: Record<string, unknown>, vars?: Record<string, number>): Promise<RestPose> {
    const pose: RestPose = new Map();
    const anims = isObj(desc.animations) ? desc.animations : {};
    const scripts = isObj(desc.scripts) ? desc.scripts : {};
    // [animation or controller id], in play order; animations weighted 0 (walking...) are left out
    const order: string[] = [];
    const named = (list: unknown, out: string[]) => {
      for (const e of Array.isArray(list) ? list : []) {
        const entries: [string, unknown][] = typeof e === 'string' ? [[e, 1]] : isObj(e) ? Object.entries(e) : [];
        for (const [name, weight] of entries) {
          const id = anims[name];
          if (typeof id === 'string' && (evalMolang(weight, { vars }) ?? 0) > 0) out.push(id);
        }
      }
    };
    named(scripts.animate, order);
    // older entity files list their controllers by id
    for (const e of Array.isArray(desc.animation_controllers) ? desc.animation_controllers : [])
      if (isObj(e)) for (const id of Object.values(e)) if (typeof id === 'string') order.push(id);

    const ctrlIds = order.filter((id) => id.startsWith('controller.'));
    const ctrls = await this.findDefs('animation_controllers', 'animation_controllers', ctrlIds);
    const ids: string[] = [];
    for (const id of order) {
      if (!id.startsWith('controller.')) {
        ids.push(id);
        continue;
      }
      // the state the controller settles in when nothing happens
      const c = ctrls.get(id);
      const states = isObj(c) && isObj(c.states) ? c.states : {};
      let state = isObj(c) && typeof c.initial_state === 'string' ? c.initial_state : 'default';
      const seen = new Set<string>();
      while (!seen.has(state) && isObj(states[state])) {
        seen.add(state);
        const tr = (states[state] as Record<string, unknown>).transitions;
        const next = (Array.isArray(tr) ? tr : []).flatMap((t) => (isObj(t) ? Object.entries(t) : [])).find(([, cond]) => (evalMolang(cond, { vars }) ?? 0) !== 0);
        if (!next || !isObj(states[next[0]])) break;
        state = next[0];
      }
      const s = states[state];
      const inner: string[] = [];
      if (isObj(s)) named(s.animations, inner);
      ids.push(...inner.filter((x) => !x.startsWith('controller.')));
    }
    const defs = await this.findDefs('animations', 'animations', ids);
    for (const id of ids) addAnimation(pose, defs.get(id));
    return pose;
  }

  /**
   * The entity's render controllers: what each draws and its part visibility rules (each controller
   * draws the model once; a bone shows when any of them shows it).
   */
  private async controllers(desc: Record<string, unknown>): Promise<RenderController[]> {
    const list = Array.isArray(desc.render_controllers) ? desc.render_controllers : [];
    const ids: string[] = [];
    for (const c of list) {
      if (typeof c === 'string') ids.push(c);
      else if (isObj(c)) for (const [id, cond] of Object.entries(c)) if ((evalMolang(cond) ?? 0) !== 0) ids.push(id);
    }
    const defs = await this.findDefs('render_controllers', 'render_controllers', ids);
    const out: RenderController[] = [];
    for (const id of ids) {
      const d = defs.get(id);
      const pv = isObj(d) && Array.isArray(d.part_visibility) ? d.part_visibility : [];
      const rules: RenderController['rules'] = [];
      for (const entry of pv) {
        if (!isObj(entry)) continue;
        for (const [pattern, cond] of Object.entries(entry)) {
          const src = pattern.toLowerCase().replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
          rules.push({ re: new RegExp(`^${src}$`), cond });
        }
      }
      const arrays: Record<string, string[]> = {};
      const ar = isObj(d) && isObj(d.arrays) && isObj(d.arrays.textures) ? d.arrays.textures : {};
      for (const [k, v] of Object.entries(ar)) if (Array.isArray(v)) arrays[k.toLowerCase()] = v.filter((x): x is string => typeof x === 'string');
      const textures = isObj(d) && Array.isArray(d.textures) ? d.textures.filter((x): x is string => typeof x === 'string') : [];
      out.push({ id, geometry: isObj(d) && typeof d.geometry === 'string' ? d.geometry : 'Geometry.default', textures, arrays, rules });
    }
    return out;
  }

  /** Bones none of the controllers shows (lowercase names), with the Molang values given. */
  private hiddenBones(def: GeoDef, ctrls: RenderController[], vars?: Record<string, number>): Set<string> {
    const hidden = new Set<string>();
    if (!ctrls.length) return hidden;
    for (const b of def.bones) {
      const name = b.name.toLowerCase();
      const shows = (c: RenderController) => {
        let show = true;
        for (const r of c.rules) if (r.re.test(name)) show = (evalMolang(r.cond, { vars }) ?? 1) !== 0;
        return show;
      };
      if (!ctrls.some(shows)) hidden.add(name);
    }
    return hidden;
  }

  /** Bones a controller shows on its own (lowercase names), with the Molang values given. */
  private shownBones(def: GeoDef, ctrl: RenderController, vars?: Record<string, number>): Set<string> {
    const hidden = this.hiddenBones(def, [ctrl], vars);
    return new Set(def.bones.map((b) => b.name.toLowerCase()).filter((n) => !hidden.has(n)));
  }

  /** The look's layers and the worn things' layers for a state (base first). */
  private layersOf(l: BedrockLoaded, state: BlockState): (LayerInput & { gear?: boolean })[] {
    const look = l.looks.find((k) => k.key === state.look) ?? l.looks[0];
    if (!look) return [];
    let own = look;
    const on = (g: BedrockGear) => !!state[g.prop.name] && state[g.prop.name] !== 'none' && g.prop.values.some((v) => v.value === state[g.prop.name]);
    for (const g of l.gear) if (g.swap && on(g)) own = g.swap(state[g.prop.name], own);
    const armored = l.gear.some((g) => g.hidesBase && on(g));
    const out: (LayerInput & { gear?: boolean })[] = own.layers.map((x, i) => ({
      model: (armored && l.armored.get(x.geo)) || l.models.get(x.geo)!,
      texture: x.path,
      label: i ? pretty(x.key) : 'Body',
      gear: own !== look && x.path !== look.layers[i]?.path,
    }));
    for (const g of l.gear) if (g.layers && on(g)) out.push(...g.layers(state[g.prop.name], look, state));
    return out;
  }

  load(id: string): Promise<boolean> {
    if (this.loaded.has(id)) return Promise.resolve(true);
    let p = this.loads.get(id);
    if (!p) {
      p = this.loadNow(id).catch(() => {
        this.loads.delete(id);
        return false;
      });
      this.loads.set(id, p);
    }
    return p;
  }

  private async loadNow(id: string): Promise<boolean> {
    const s = this.specs.get(id);
    if (!s) return false;
    const json = await this.ctx.readJson(`entity/${s.file}.entity.json`);
    const desc = isObj(json) && isObj(json['minecraft:client_entity']) && isObj(json['minecraft:client_entity'].description) ? json['minecraft:client_entity'].description : null;
    if (!desc) return false;
    const textures = isObj(desc.textures) ? (desc.textures as Record<string, unknown>) : {};
    const geometry = isObj(desc.geometry) ? (desc.geometry as Record<string, unknown>) : {};
    const geoKeys = Object.keys(geometry).filter((k) => typeof geometry[k] === 'string');
    const keys = Object.keys(textures).filter((k) => typeof textures[k] === 'string' && !SKIP_COMMON.test(k) && !s.skip?.test(k));
    const geoFor = (key: string): string | null => {
      const exact = geoKeys.find((g) => g === key);
      if (exact) return exact;
      if (/(^|_)baby(_|$)/.test(key) && geoKeys.includes('baby')) return 'baby';
      return geoKeys.includes('default') ? 'default' : (geoKeys[0] ?? null);
    };
    const looks: BedrockLook[] = [];
    const seenPaths = new Set<string>();
    const layerOf = (key: string) => {
      const path = this.texturePath(String(textures[key]));
      const g = geoFor(key);
      return path && g ? { key, path, geo: String(geometry[g]) } : null;
    };
    for (const key of keys) {
      const own = layerOf(key);
      if (!own) continue;
      const baseKey = s.over?.(key, keys) ?? null;
      const base = baseKey && baseKey !== key ? layerOf(baseKey) : null;
      // a look per texture file (several keys can name the same file)
      const tag = `${base?.path ?? ''}|${own.path}`;
      if (seenPaths.has(tag)) continue;
      seenPaths.add(tag);
      // a base that only shows under overlays isn't a look of its own twice
      const baby = geoFor(key) === 'baby' || /(^|_)baby(_|$)|^ghastling$/.test(key);
      looks.push({ key, label: pretty(key === 'default' ? 'Default' : key), layers: base ? [base, own] : [own], baby });
    }
    // Overlays come after the plain looks; bases that other keys draw on stay first.
    looks.sort((a, b) => a.layers.length - b.layers.length || Number(a.baby) - Number(b.baby));
    const [pose, controllers] = await Promise.all([this.restPose(desc, s.vars), this.controllers(desc)]);
    // controllers drawing a saddle or armour on their own; the others draw the mob
    const isGear = (c: RenderController) => /^Texture\.\w*saddle\w*$|^Array\.armor\[/i.test((c.textures[0] ?? '').trim());
    const main = controllers.filter((c) => !isGear(c));
    const models = new Map<string, EntityModel>();
    const armored = new Map<string, EntityModel>();
    const defs = new Map<string, GeoDef>();
    for (const g of new Set(looks.flatMap((l) => l.layers.map((x) => x.geo)))) {
      const def = await this.flat(g);
      if (!def) continue;
      defs.set(g, def);
      // per controller the last rule matching a bone decides; a bone shows when any controller shows it
      const hidden = this.hiddenBones(def, main);
      models.set(g, geoToModel(def, pose, [64, 64], hidden, NATIVE_TURNS[g]));
      const hiddenArmored = this.hiddenBones(def, main, ARMORED);
      if ([...hiddenArmored].some((b) => !hidden.has(b))) armored.set(g, geoToModel(def, pose, [64, 64], hiddenArmored, NATIVE_TURNS[g]));
    }
    const shown = looks.filter((l) => l.layers.every((x) => models.has(x.geo)));
    const ctx: GearContext = { spec: s, textures, geometry, looks: shown, models, defs, pose, main, gearCtrls: controllers.filter(isGear), desc };
    const gear = await this.gearOf(ctx);
    this.loaded.set(id, { looks: shown, models, armored, gear, home: !!s.home });
    return true;
  }

  /** Model of a worn geometry drawn over a look (bones of the wearer's names sit like the wearer's). */
  private wornModel(c: GearContext, geoId: string, def: GeoDef, look: BedrockLook, hidden?: Set<string>, tex: [number, number] = [64, 64]): EntityModel {
    const own = look.layers[0].geo;
    return geoToModel(def, c.pose, tex, hidden, NATIVE_TURNS[geoId], geoId === own ? undefined : c.defs.get(own));
  }

  /** Geometry id of a controller's geometry expression for an adult ("Geometry.saddle", "q.is_baby ? ... : Geometry.default"). */
  private static geometryKey(expr: string): string | null {
    const t = /^(.+?)\?\s*Geometry\.(\w+)\s*:\s*Geometry\.(\w+)\s*$/i.exec(expr.trim());
    if (t) return (evalMolang(t[1]) ?? 0) !== 0 ? t[2] : t[3];
    return /^Geometry\.(\w+)$/i.exec(expr.trim())?.[1] ?? null;
  }

  /** The things a mob wears: saddles, armour, carpets, harnesses (what its files and the game draw). */
  private async gearOf(c: GearContext): Promise<BedrockGear[]> {
    const gear: BedrockGear[] = [];
    const { textures, looks, spec } = c;
    const lookOf = (st: BlockState) => looks.find((k) => k.key === st.look) ?? looks[0];
    const adults = looks.filter((l) => !l.baby);
    const firstAdult = adults[0];
    if (!firstAdult) return gear;
    const adultOnly = (st: BlockState) => !lookOf(st)?.baby;
    const path = (key: string) => (typeof textures[key] === 'string' ? this.texturePath(String(textures[key])) : null);
    const keys = Object.keys(textures);
    /** Which choices a colour applies to (shown with any of them) */
    const dyed: ((st: BlockState) => boolean)[] = [];
    const tinted = (p: string, st: BlockState, undyed: RGB | null): Pick<LayerInput, 'tint' | 'tintMask'> => {
      const tint = dyeTint(st, undyed);
      return tint ? { tint, tintMask: /\.tga$/i.test(p) ? 'armor' : undefined } : {};
    };

    // ---- saddles
    const saddles = new Map<string, LayerInput[]>();
    for (const look of adults) {
      const geo = look.layers[0].geo;
      const def = c.defs.get(geo);
      if (!def) continue;
      const out: LayerInput[] = [];
      // bones the mob's own controllers show once saddled (horses, camels): drawn with its texture
      const plain = this.hiddenBones(def, c.main);
      const saddled = this.hiddenBones(def, c.main, SADDLED);
      const bones = new Set([...plain].filter((b) => !saddled.has(b)));
      if (bones.size) out.push({ model: geoToModel(def, c.pose, [64, 64], saddled, NATIVE_TURNS[geo]), texture: look.layers[0].path, label: 'Saddle', part: SADDLE_PART, only: (n) => bones.has(n) });
      // a saddle drawn by its own controller (pigs, nautiluses)
      for (const ctrl of c.gearCtrls) {
        const key = /^Texture\.(\w*saddle\w*)$/i.exec(ctrl.textures[0].trim())?.[1];
        const p = key ? path(key) : null;
        const gk = BedrockEntities.geometryKey(ctrl.geometry);
        const gid = gk && typeof c.geometry[gk] === 'string' ? String(c.geometry[gk]) : null;
        if (!p || !gid) continue;
        const sdef = gid === geo ? def : await this.flat(gid);
        if (!sdef) continue;
        // the controller hides every bone but the saddled ones (a hidden parent still draws its children)
        const shows = this.shownBones(sdef, ctrl, SADDLED);
        out.push({ model: this.wornModel(c, gid, sdef, look), texture: p, label: 'Saddle', part: SADDLE_PART, only: (n) => shows.has(n) });
      }
      if (out.length) saddles.set(look.key, out);
    }
    // a saddled texture in place of the mob's own, when the mob's controller swaps to it (striders)
    const drawn = (key: string) => c.main.some((ctrl) => [...ctrl.textures, ...Object.values(ctrl.arrays).flat()].some((t) => new RegExp(`\\bTexture\\.${key}\\b`, 'i').test(t)));
    const saddledKey = (look: BedrockLook) => {
      const k = look.layers[0].key;
      const sk = k === 'default' ? 'saddled' : `${k}_saddled`;
      return keys.includes(sk) && path(sk) && drawn(sk) ? sk : null;
    };
    const swaps = adults.filter((l) => saddledKey(l));
    if (saddles.size || swaps.length) {
      gear.push({
        prop: { name: 'saddle', label: 'Saddle', values: [{ value: 'none', label: 'Off' }, { value: 'on', label: 'On' }], gear: true, showIf: (st) => saddles.has(lookOf(st)?.key) || !!(lookOf(st) && !lookOf(st)!.baby && saddledKey(lookOf(st)!)) },
        layers: (_v, look) => saddles.get(look.key) ?? [],
        swap: (_v, look) => {
          const sk = look.baby ? null : saddledKey(look);
          return sk ? { ...look, layers: [{ ...look.layers[0], key: sk, path: path(sk)! }, ...look.layers.slice(1)] } : look;
        },
        states: [{ look: (saddles.size ? [...saddles.keys()][0] : swaps[0].key), saddle: 'on' }, ...swaps.map((l) => ({ look: l.key, saddle: 'on' }))],
      });
    }

    // ---- armour drawn as another texture of the mob's own model (horses)
    // the armour array a controller draws from (horses: the mob's own controller; nautiluses: their own)
    const mainArmorCtrl = c.main.find((ctrl) => ctrl.arrays['array.armor'] && ctrl.textures.some((t) => /Array\.armor\[/i.test(t)));
    const ctrlArmor = c.gearCtrls.find((ctrl) => ctrl.arrays['array.armor'] && /^Array\.armor\[/i.test(ctrl.textures[0].trim()));
    const mainArmor = !!mainArmorCtrl;
    const armorKeys = ((mainArmorCtrl ?? ctrlArmor)?.arrays['array.armor'] ?? []).map((t) => t.replace(/^Texture\./i, '')).filter((k) => /^armor_(?!none$)/.test(k) && path(k));
    if (armorKeys.length) {
      const order = ['leather', 'copper', 'chainmail', 'iron', 'gold', 'diamond', 'netherite'];
      const mats = armorKeys.map((k) => k.slice(6)).sort((a, b) => (order.indexOf(a) + 99) % 99 - (order.indexOf(b) + 99) % 99);
      const values = [NONE, ...mats.map((m) => ({ value: m, label: pretty(m) }))];
      const part = mainArmor ? { name: 'horse_armor', label: 'Horse armour' } : { name: 'armor', label: 'Armour' };
      let layer: (m: string, look: BedrockLook, st: BlockState) => LayerInput[];
      if (mainArmor) {
        layer = (m, look, st) => {
          const p = path(`armor_${m}`);
          const model = c.models.get(look.layers[0].geo);
          return p && model ? [{ model, texture: p, label: 'Horse armour', part, ...(m === 'leather' ? tinted(p, st, LEATHER_RGB) : {}) }] : [];
        };
      } else {
        const gk = BedrockEntities.geometryKey(ctrlArmor!.geometry);
        const gid = gk && typeof c.geometry[gk] === 'string' ? String(c.geometry[gk]) : null;
        const adef = gid ? await this.flat(gid) : null;
        const shows = adef ? this.shownBones(adef, ctrlArmor!, ARMORED) : new Set<string>();
        const byLook = new Map(adef && gid ? adults.map((l) => [l.key, this.wornModel(c, gid, adef, l, undefined, [128, 128])]) : []);
        layer = (m, look) => {
          const p = path(`armor_${m}`);
          const model = byLook.get(look.key);
          return p && model ? [{ model, texture: p, label: 'Armour', part, only: (n) => shows.has(n) }] : [];
        };
      }
      gear.push({
        prop: { name: 'armor', label: 'Armour', values, gear: true, showIf: adultOnly },
        layers: (m, look, st) => (look.baby ? [] : layer(m, look, st)),
        hidesBase: !mainArmor,
        states: mats.map((m) => ({ look: firstAdult.key, armor: m })),
      });
      if (mats.includes('leather')) dyed.push((st) => adultOnly(st) && st.armor === 'leather');
    }

    // ---- llama carpets and the trader llama's decor
    const decorKeys = keys.filter((k) => /^decor_(?!none$)/.test(k) && path(k));
    if (decorKeys.length) {
      const colour = (k: string) => (k === 'decor_wandering_trader' ? 'trader' : k.slice(6) === 'silver' ? 'light_gray' : k.slice(6));
      const byValue = new Map(decorKeys.map((k) => [colour(k), k]));
      const carpets = DYE_COLORS.filter((d) => byValue.has(d)).map((d) => ({ value: d, label: pretty(d) }));
      const values = spec.trader && byValue.has('trader') ? [{ value: 'trader', label: 'Trader' }, ...carpets] : [NONE, ...carpets];
      const part = { name: 'decor', label: spec.trader ? 'Decor' : 'Carpet' };
      gear.push({
        prop: { name: 'decor', label: 'Carpet', values, gear: true, showIf: adultOnly },
        layers: (v, look) => {
          // babies wear no carpet; a baby trader llama has its own decor
          const key = look.baby ? (spec.trader && keys.includes('baby_decor_wandering_trader') ? 'baby_decor_wandering_trader' : null) : byValue.get(v);
          const p = key ? path(key) : null;
          const model = c.models.get(look.layers[0].geo);
          return p && model ? [{ model, texture: p, label: v === 'trader' || look.baby ? 'Trader decor' : 'Carpet', part }] : [];
        },
        states: values.filter((v) => v.value !== 'none').map((v) => ({ look: firstAdult.key, decor: v.value })),
      });
    }

    // ---- wolf armour (drawn on the wolf's bones with its own geometry)
    if (spec.id === 'wolf' && this.ctx.hasFile('textures/entity/wolf/wolf_armor.png')) {
      const adef = await this.flat('geometry.wolf.armor');
      if (adef) {
        const byLook = new Map(adults.map((l) => [l.key, this.wornModel(c, 'geometry.wolf.armor', adef, l)]));
        const part = { name: 'wolf_armor', label: 'Wolf armour' };
        const tex = (n: string) => this.texturePath(`textures/entity/wolf/${n}`);
        gear.push({
          prop: { name: 'armor', label: 'Armour', values: [NONE, { value: 'armadillo_scute', label: 'Wolf armour' }], gear: true, showIf: adultOnly },
          layers: (_v, look, st) => {
            const model = byLook.get(look.key);
            if (!model || look.baby) return [];
            const dye = st.dye && st.dye !== 'none' ? tex('wolf_armor_dyed') : null;
            const base = dye ?? tex('wolf_armor');
            const out: LayerInput[] = base ? [{ model, texture: base, label: dye ? 'Wolf armour (dyed)' : 'Wolf armour', part, ...(dye ? tinted(dye, st, null) : {}) }] : [];
            const crack = st.cracks && st.cracks !== 'none' ? tex(`wolf_armor_cracked_${st.cracks}`) : null;
            if (crack) out.push({ model, texture: crack, label: 'Wolf armour cracks', part });
            return out;
          },
          states: [{ look: firstAdult.key, armor: 'armadillo_scute' }],
        });
        const on = (st: BlockState) => adultOnly(st) && st.armor === 'armadillo_scute';
        if (tex('wolf_armor_dyed')) {
          dyed.push(on);
          gear.push({ prop: { name: 'dye', label: 'Dye', values: [], gear: true }, states: [{ look: firstAdult.key, armor: 'armadillo_scute', dye: 'red' }] });
        }
        const cracks = ['low', 'medium', 'high'].filter((x) => tex(`wolf_armor_cracked_${x}`));
        if (cracks.length)
          gear.push({
            prop: { name: 'cracks', label: 'Cracks', values: [NONE, ...cracks.map((x) => ({ value: x, label: pretty(x) }))], gear: true, showIf: on },
            states: cracks.map((x) => ({ look: firstAdult.key, armor: 'armadillo_scute', cracks: x })),
          });
      }
    }

    // ---- the happy ghast's harness (goggles up: nobody riding)
    if (spec.id === 'happy_ghast') {
      const hdef = await this.flat('geometry.harness');
      const colours = DYE_COLORS.filter((d) => this.texturePath(`textures/entity/harness/harness_${d}`));
      if (hdef && colours.length) {
        const byLook = new Map(adults.map((l) => [l.key, this.wornModel(c, 'geometry.harness', hdef, l, new Set(['goggles']))]));
        gear.push({
          prop: { name: 'harness', label: 'Harness', values: [NONE, ...colours.map((d) => ({ value: d, label: pretty(d) }))], gear: true, showIf: adultOnly },
          layers: (v, look) => {
            const p = this.texturePath(`textures/entity/harness/harness_${v}`);
            const model = byLook.get(look.key);
            return p && model ? [{ model, texture: p, label: 'Harness', part: { name: 'harness', label: 'Harness' } }] : [];
          },
          states: colours.map((d) => ({ look: firstAdult.key, harness: d })),
        });
      }
    }

    // ---- humanoid armour: the armour items' attachables, on the mob's bones
    if (spec.armor) gear.push(...(await this.armorGear(c, dyed)));

    // ---- one dye colour for whatever leather / dyeable thing is worn
    const dyeAt = gear.findIndex((g) => g.prop.name === 'dye');
    if (dyed.length) {
      const prop: StateProperty = { name: 'dye', label: 'Dye', values: DYE_VALUES, gear: true, showIf: (st) => dyed.some((f) => f(st)) };
      if (dyeAt >= 0) gear[dyeAt] = { ...gear[dyeAt], prop };
      else gear.push({ prop, states: [] });
    } else if (dyeAt >= 0) gear.splice(dyeAt, 1);
    return gear;
  }

  private attachables: Promise<{ material: string; slot: string; geo: string; texture: string; leather: boolean }[]> | null = null;

  /** The armour items' attachables (attachables/<material>_<slot>.json): geometry and texture. */
  private armorItems() {
    this.attachables ??= (async () => {
      const files = this.ctx.listFiles('attachables/').filter((f) => /\/[a-z_]+_(helmet|chestplate|leggings|boots)\.json$/.test(f));
      const out: { material: string; slot: string; geo: string; texture: string; leather: boolean }[] = [];
      await Promise.all(
        files.map(async (f) => {
          const m = /\/([a-z_]+)_(helmet|chestplate|leggings|boots)\.json$/.exec(f)!;
          const json = await this.ctx.readJson(f);
          const d = isObj(json) && isObj(json['minecraft:attachable']) && isObj(json['minecraft:attachable'].description) ? json['minecraft:attachable'].description : null;
          const geo = d && isObj(d.geometry) && typeof d.geometry.default === 'string' ? d.geometry.default : null;
          const tex = d && isObj(d.textures) && typeof d.textures.default === 'string' ? d.textures.default : null;
          if (!geo || !tex) return;
          const mat = isObj(d!.materials) ? String(d!.materials.default ?? '') : '';
          out.push({ material: BEDROCK_MATERIAL[m[1]] ?? m[1], slot: m[2], geo, texture: tex, leather: /leather/.test(mat) });
        }),
      );
      return out;
    })();
    return this.attachables;
  }

  private async armorGear(c: GearContext, dyed: ((st: BlockState) => boolean)[]): Promise<BedrockGear[]> {
    const items = await this.armorItems();
    if (!items.length) return [];
    const { looks } = c;
    const lookOf = (st: BlockState) => looks.find((k) => k.key === st.look) ?? looks[0];
    // babies wear their own armour where the mob says so
    const babyArmor = (Array.isArray(isObj(c.desc.scripts) ? c.desc.scripts.pre_animation : null) ? ((c.desc.scripts as Record<string, unknown>).pre_animation as unknown[]) : []).some((x) => typeof x === 'string' && /use_dedicated_baby_armor\s*=\s*(true|1)/.test(x));
    const wears = (look: BedrockLook) => !look.baby || babyArmor;
    const models = new Map<string, EntityModel | null>();
    const modelFor = async (geoId: string, look: BedrockLook) => {
      const key = `${geoId}|${look.layers[0].geo}`;
      if (!models.has(key)) {
        const def = await this.flat(geoId);
        models.set(key, def ? this.wornModel(c, geoId, def, look, undefined, [64, 32]) : null);
      }
      return models.get(key)!;
    };
    // the pieces for each look: material -> slot -> layer
    const pieces = new Map<string, Map<string, LayerInput>>();
    for (const look of looks) {
      if (!wears(look)) continue;
      for (const it of items) {
        let geo = it.geo;
        let texture = this.texturePath(it.texture);
        if (look.baby) {
          geo = `geometry.humanoid.baby.armor.${it.slot}`;
          const stem = it.texture.slice(it.texture.lastIndexOf('/') + 1);
          const dir = it.texture.slice(0, it.texture.lastIndexOf('/') + 1);
          texture = this.texturePath(dir + (BABY_ARMOR[stem] ?? stem.replace(/_[12]$/, '_baby')));
        }
        if (!texture) continue;
        const model = await modelFor(geo, look);
        if (!model) continue;
        const key = `${look.key}|${it.material}`;
        if (!pieces.has(key)) pieces.set(key, new Map());
        const label = it.slot === 'leggings' && !look.baby ? 'Leggings armour' : 'Armour';
        pieces.get(key)!.set(it.slot, { model, texture, label, part: { name: it.slot, label: pretty(it.slot) }, tint: it.leather ? { kind: 'fixed', rgb: LEATHER_RGB } : null, tintMask: it.leather && /\.tga$/i.test(texture) ? 'armor' : undefined });
      }
    }
    const order = ARMOR_MATERIALS.map(([m]) => m);
    const label = new Map(ARMOR_MATERIALS);
    const gear: BedrockGear[] = [];
    const firstAdult = looks.find((l) => !l.baby)!;
    // trims: textures/trims/<pattern>(_leggings), coloured with color_palettes/ (adults only)
    const trimKey = this.texturePath(BEDROCK_TRIM_KEY);
    const patterns = trimKey ? sortPatterns(patternNames(this.ctx.listFiles('textures/trims/'), 'textures/trims/')) : [];
    const trimMats = patterns.length ? sortMaterials(materialNames(this.ctx.listFiles('textures/trims/color_palettes/'), 'textures/trims/color_palettes/')) : [];
    const palette = (name: string) => this.texturePath(bedrockTrimPalette(name));
    const trimLayer = (slot: string, armorMat: string, layer: LayerInput, st: BlockState): LayerInput | null => {
      const pattern = st.trim && st.trim !== 'none' ? st.trim : null;
      if (!pattern || !trimMats.length) return null;
      const legs = slot === 'leggings';
      const texture = this.texturePath(bedrockTrimPattern(pattern, legs));
      if (!texture) return null;
      const mat = st.trim_material && trimMats.includes(st.trim_material) ? st.trim_material : trimMats[0];
      const values = palette(trimPaletteName(mat, armorMat, (n) => !!palette(n)));
      return { model: layer.model, texture, label: legs ? 'Leggings trim' : 'Trim', part: TRIM_PART, palette: trimKey && values ? { key: trimKey, values } : undefined };
    };
    for (const [slot, slotLabel] of ARMOR_SLOTS) {
      const mats = [...new Set(items.filter((i) => i.slot === slot).map((i) => i.material))].sort((a, b) => ((order.indexOf(a) + 99) % 99) - ((order.indexOf(b) + 99) % 99));
      if (!mats.length) continue;
      gear.push({
        prop: { name: slot, label: slotLabel, values: [NONE, ...mats.map((m) => ({ value: m, label: label.get(m) ?? pretty(m) }))], gear: true, group: 'armor', showIf: (st) => !!lookOf(st) && wears(lookOf(st)!) },
        layers: (m, look, st) => {
          const layer = pieces.get(`${look.key}|${m}`)?.get(slot);
          if (!layer) return [];
          return [layer.tint ? { ...layer, tint: dyeTint(st, LEATHER_RGB) } : layer];
        },
        states: [],
      });
    }
    const setOf = (m: string): BlockState => Object.fromEntries(items.filter((i) => i.material === m).map((i) => [i.slot, m]));
    // a full set of each material
    if (gear.length) {
      const sets = order.filter((m) => items.some((i) => i.material === m));
      gear[0] = { ...gear[0], states: sets.map((m) => ({ look: firstAdult.key, ...setOf(m) })) };
      if (items.some((i) => i.leather)) dyed.push((st) => !!lookOf(st) && wears(lookOf(st)!) && ARMOR_SLOTS.some(([slot]) => st[slot] === 'leather'));
    }
    if (gear.length && patterns.length && trimMats.length) {
      const trimmable = (st: BlockState) => !!lookOf(st) && !lookOf(st)!.baby && ARMOR_SLOTS.some(([slot]) => !!st[slot] && st[slot] !== 'none');
      const iron = setOf('iron');
      gear.push({
        prop: { name: 'trim', label: 'Trim', values: [NONE, ...patterns.map((p) => ({ value: p, label: trimLabel(p) }))], gear: true, showIf: trimmable },
        // over each worn piece, after all of them (babies' armour has none)
        layers: (_v, look, st) => {
          if (look.baby) return [];
          const out: LayerInput[] = [];
          for (const [slot] of ARMOR_SLOTS) {
            const m = st[slot];
            const layer = m && m !== 'none' ? pieces.get(`${look.key}|${m}`)?.get(slot) : undefined;
            const trim = layer ? trimLayer(slot, m, layer, st) : null;
            if (trim) out.push(trim);
          }
          return out;
        },
        states: patterns.map((p) => ({ look: firstAdult.key, ...iron, trim: p, trim_material: trimMats[0] })),
      });
      const states: BlockState[] = [];
      for (const m of trimMats) {
        states.push({ look: firstAdult.key, ...setOf(m === 'iron' ? 'gold' : 'iron'), trim: patterns[0], trim_material: m });
        if (items.some((i) => i.material === m)) states.push({ look: firstAdult.key, ...setOf(m), trim: patterns[0], trim_material: m });
      }
      gear.push({
        prop: { name: 'trim_material', label: 'Trim material', values: trimMats.map((m) => ({ value: m, label: materialLabel(m) })), gear: true, showIf: (st) => trimmable(st) && !!st.trim && st.trim !== 'none' },
        states,
      });
    }
    return gear;
  }

  resolve(id: string, state: BlockState): EntityView {
    const l = this.loaded.get(id);
    if (!l || !l.looks.length) return { quads: [], parts: [], labels: new Map(), texSizes: new Map() };
    return bakeLayers(this.layersOf(l, { ...this.defaultState(id), ...state }));
  }
}

interface GearContext {
  spec: BedrockMobSpec;
  textures: Record<string, unknown>;
  geometry: Record<string, unknown>;
  looks: BedrockLook[];
  models: Map<string, EntityModel>;
  defs: Map<string, GeoDef>;
  pose: RestPose;
  main: RenderController[];
  gearCtrls: RenderController[];
  desc: Record<string, unknown>;
}
