// Mobs in the model library: their looks (variant, baby, wool, profession...) as states, the textures
// each look draws on which model, and baked geometry split into body parts that can be shown or
// hidden. Java uses the game's model layers (mob-geometry.ts, loaded on first use) and the renderers'
// texture choices (mobs-java.ts). Bedrock reads the vanilla client entity definitions, their
// geometry files and pose animations (loaded per mob on first use, like other Bedrock files).
// Pure apart from the asset reads.

import type { BakedQuad, Tint } from './geometry';
import { bakeEntityModel, mat4Chain, mat4Scale, mat4Translation, type EntityModel, type EntityPart } from './entity-models';
import { addAnimation, flattenGeo, geoToModel, parseGeoFile, type GeoDef, type NativeTurns, type RestPose } from './bedrock-geo';
import { evalMolang } from './molang';
import { JAVA_MOBS, type JavaMobSpec, type MobLayerRef, type MobState } from './mobs-java';
import type { BlockState, StateProperty, TextureStates } from './types';

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
}

/** Bakes the layers of a look, part by part (quad.part = index into the returned parts). */
function bakeLayers(layers: LayerInput[]): EntityView {
  const parts: EntityPartInfo[] = [];
  const index = new Map<string, number>();
  const quads: BakedQuad[] = [];
  const labels = new Map<string, string>();
  const texSizes = new Map<string, [number, number]>();
  for (const l of layers) {
    if (!labels.has(l.texture)) labels.set(l.texture, l.label);
    if (!texSizes.has(l.texture)) texSizes.set(l.texture, l.model.texSize);
    for (const path of partPaths(l.model)) {
      const name = partName(path);
      let i = index.get(name);
      if (i === undefined) {
        i = parts.length;
        index.set(name, i);
        parts.push({ name, label: pretty(name) });
      }
      quads.push(...bakeEntityModel(l.model, MOB_TRANSFORM, { texture: l.texture, role: l.label, part: i, tint: l.tint ?? null, only: (p) => p === path }));
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

function collectTextures(states: BlockState[], layersOf: (s: BlockState) => { path: string; label: string }[]): TextureStates[] {
  const by = new Map<string, TextureStates>();
  for (const s of states) {
    for (const l of layersOf(s)) {
      let t = by.get(l.path);
      if (!t) by.set(l.path, (t = { path: l.path, role: l.label, states: [], dirs: [] }));
      t.states.push(s);
    }
  }
  return [...by.values()];
}

// ---------------------------------------------------------------------------------------------
// Java

export interface JavaEntityContext {
  hasFile(path: string): boolean;
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

  private path(rel: string): string {
    return `assets/minecraft/textures/entity/${rel}.png`;
  }

  private firstState(s: JavaMobSpec): MobState {
    return Object.fromEntries(s.props.map((p) => [p.name, p.values[0].value]));
  }

  /** The look's layers whose textures exist (none when the base texture is missing). */
  private layers(s: JavaMobSpec, state: MobState): MobLayerRef[] {
    const all = s.layers(state);
    if (!all.length || !this.ctx.hasFile(this.path(all[0].texture))) return [];
    return all.filter((l) => this.ctx.hasFile(this.path(l.texture)));
  }

  private paths(s: JavaMobSpec, state: MobState): { path: string; label: string }[] {
    return this.layers(s, state).map((l) => ({ path: this.path(l.texture), label: l.label }));
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
    // Values the version has textures for (older versions have no baby textures, fewer variants...)
    const props = s.props
      .map((p) => ({ name: p.name, label: p.label, values: p.values.filter((v) => this.paths(s, { ...base, [p.name]: v.value }).length > 0) }))
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
    const out = collectTextures(allStates(this.properties(id)), (st) => this.paths(s, { ...base, ...st }));
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
      inputs.push({ model, texture: this.path(l.texture), label: l.label, tint: l.tint ? { kind: 'fixed', rgb: l.tint } : null });
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
  { id: 'zombie', name: 'Zombie', file: 'zombie', dirs: ['zombie'] },
  { id: 'husk', name: 'Husk', file: 'husk', dirs: ['zombie'] },
  { id: 'drowned', name: 'Drowned', file: 'drowned', dirs: ['zombie'] },
  {
    id: 'zombie_villager',
    name: 'Zombie Villager',
    file: 'zombie_villager_v2',
    dirs: ['zombie_villager2', 'zombie_villager'],
    over: (k, keys) => (VILLAGER_OVERLAY.test(k) ? (k.startsWith('baby_') ? firstWith(keys, /^baby_default$/) : 'default') : null),
  },
  { id: 'skeleton', name: 'Skeleton', file: 'skeleton', dirs: ['skeleton'] },
  { id: 'stray', name: 'Stray', file: 'stray', dirs: ['skeleton'], over: (k) => (k === 'overlay' ? 'default' : null) },
  { id: 'bogged', name: 'Bogged', file: 'bogged', dirs: ['skeleton'], over: (k) => (k === 'overlay' ? 'default' : null) },
  { id: 'wither_skeleton', name: 'Wither Skeleton', file: 'wither_skeleton', dirs: ['skeleton'] },
  { id: 'parched', name: 'Parched', file: 'parched', dirs: ['skeleton'] },
  { id: 'spider', name: 'Spider', file: 'spider', dirs: ['spider'] },
  { id: 'cave_spider', name: 'Cave Spider', file: 'cave_spider', dirs: ['spider'] },
  { id: 'enderman', name: 'Enderman', file: 'enderman', dirs: ['enderman'] },
  { id: 'pig', name: 'Pig', file: 'pig', dirs: ['pig'] },
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
  { id: 'wolf', name: 'Wolf', file: 'wolf', dirs: ['wolf'] },
  { id: 'cat', name: 'Cat', file: 'cat', dirs: ['cat'], vars: WALKING },
  { id: 'ocelot', name: 'Ocelot', file: 'ocelot', dirs: ['cat'], vars: WALKING },
  { id: 'fox', name: 'Fox', file: 'fox', dirs: ['fox'] },
  {
    id: 'horse',
    name: 'Horse',
    file: 'horse_v3',
    dirs: ['horse2', 'horse'],
    over: (k, keys) => (/^(baby_)?markings_/.test(k) ? firstWith(keys, k.startsWith('baby_') ? /^baby_base_/ : /^base_/) : null),
  },
  { id: 'donkey', name: 'Donkey', file: 'donkey_v3', dirs: ['horse2', 'horse'] },
  { id: 'mule', name: 'Mule', file: 'mule_v3', dirs: ['horse2', 'horse'] },
  { id: 'skeleton_horse', name: 'Skeleton Horse', file: 'skeleton_horse_v3', dirs: ['horse2', 'horse'] },
  { id: 'zombie_horse', name: 'Zombie Horse', file: 'zombie_horse_v3', dirs: ['horse2', 'horse'] },
  { id: 'llama', name: 'Llama', file: 'llama', dirs: ['llama'] },
  { id: 'slime', name: 'Slime', file: 'slime', dirs: ['slime'] },
  { id: 'magma_cube', name: 'Magma Cube', file: 'magma_cube', dirs: ['slime'] },
  { id: 'ghast', name: 'Ghast', file: 'ghast', dirs: ['ghast'] },
  { id: 'happy_ghast', name: 'Happy Ghast', file: 'happy_ghast', dirs: ['ghast', 'happy_ghast'] },
  { id: 'blaze', name: 'Blaze', file: 'blaze', dirs: [''] },
  { id: 'piglin', name: 'Piglin', file: 'piglin', dirs: ['piglin'] },
  { id: 'piglin_brute', name: 'Piglin Brute', file: 'piglin_brute', dirs: ['piglin'] },
  { id: 'zombified_piglin', name: 'Zombified Piglin', file: 'zombie_pigman', dirs: ['piglin', 'pigzombie'] },
  { id: 'hoglin', name: 'Hoglin', file: 'hoglin', dirs: ['hoglin'] },
  { id: 'zoglin', name: 'Zoglin', file: 'zoglin', dirs: ['hoglin', 'zoglin'] },
  { id: 'phantom', name: 'Phantom', file: 'phantom', dirs: ['phantom'] },
  { id: 'bee', name: 'Bee', file: 'bee', dirs: ['bee'] },
  { id: 'axolotl', name: 'Axolotl', file: 'axolotl', dirs: ['axolotl'] },
  { id: 'frog', name: 'Frog', file: 'frog', dirs: ['frog'] },
  { id: 'tadpole', name: 'Tadpole', file: 'tadpole', dirs: ['tadpole'] },
  { id: 'allay', name: 'Allay', file: 'allay', dirs: ['allay'] },
  { id: 'warden', name: 'Warden', file: 'warden', dirs: ['warden'], over: (k) => (k !== 'default' ? 'default' : null) },
  { id: 'armor_stand', name: 'Armor Stand', file: 'armor_stand', dirs: [''] },
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
}

interface BedrockLoaded {
  looks: BedrockLook[];
  models: Map<string, EntityModel>;
}

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
    if (!l || l.looks.length < 2) return [];
    return [{ name: 'look', label: 'Look', values: l.looks.map((k) => ({ value: k.key, label: k.label })) }];
  }

  defaultState(id: string): BlockState {
    const l = this.loaded.get(id);
    return l && l.looks.length > 1 ? { look: l.looks[0].key } : {};
  }

  textureStates(id: string): TextureStates[] {
    const l = this.loaded.get(id);
    if (l) {
      const states: BlockState[] = l.looks.length > 1 ? l.looks.map((k) => ({ look: k.key })) : [{}];
      return collectTextures(states, (s) => {
        const look = l.looks.find((k) => k.key === s.look) ?? l.looks[0];
        return look ? look.layers.map((x, i) => ({ path: x.path, label: i ? pretty(x.key) : 'Body' })) : [];
      });
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
   * Part visibility rules of each of the entity's render controllers, for an entity standing still
   * (each controller draws the model once; a bone shows when any of them shows it).
   */
  private async visibility(desc: Record<string, unknown>): Promise<{ re: RegExp; show: boolean }[][]> {
    const list = Array.isArray(desc.render_controllers) ? desc.render_controllers : [];
    const ids: string[] = [];
    for (const c of list) {
      if (typeof c === 'string') ids.push(c);
      else if (isObj(c)) for (const [id, cond] of Object.entries(c)) if ((evalMolang(cond) ?? 0) !== 0) ids.push(id);
    }
    const defs = await this.findDefs('render_controllers', 'render_controllers', ids);
    const out: { re: RegExp; show: boolean }[][] = [];
    for (const id of ids) {
      const d = defs.get(id);
      const pv = isObj(d) && Array.isArray(d.part_visibility) ? d.part_visibility : [];
      const rules: { re: RegExp; show: boolean }[] = [];
      out.push(rules);
      for (const entry of pv) {
        if (!isObj(entry)) continue;
        for (const [pattern, cond] of Object.entries(entry)) {
          const src = pattern.toLowerCase().replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
          rules.push({ re: new RegExp(`^${src}$`), show: (evalMolang(cond) ?? 1) !== 0 });
        }
      }
    }
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
      looks.push({ key, label: pretty(key === 'default' ? 'Default' : key), layers: base ? [base, own] : [own] });
    }
    // Overlays come after the plain looks; bases that other keys draw on stay first.
    looks.sort((a, b) => a.layers.length - b.layers.length);
    const [pose, controllers] = await Promise.all([this.restPose(desc, s.vars), this.visibility(desc)]);
    const models = new Map<string, EntityModel>();
    for (const g of new Set(looks.flatMap((l) => l.layers.map((x) => x.geo)))) {
      const def = await this.flat(g);
      if (!def) continue;
      // per controller the last rule matching a bone decides; a bone shows when any controller shows it
      const hidden = new Set<string>();
      for (const b of def.bones) {
        const name = b.name.toLowerCase();
        const shows = (rules: { re: RegExp; show: boolean }[]) => {
          let show = true;
          for (const r of rules) if (r.re.test(name)) show = r.show;
          return show;
        };
        if (controllers.length && !controllers.some(shows)) hidden.add(name);
      }
      models.set(g, geoToModel(def, pose, [64, 64], hidden, NATIVE_TURNS[g]));
    }
    this.loaded.set(id, { looks: looks.filter((l) => l.layers.every((x) => models.has(x.geo))), models });
    return true;
  }

  resolve(id: string, state: BlockState): EntityView {
    const l = this.loaded.get(id);
    const look = l ? (l.looks.find((k) => k.key === state.look) ?? l.looks[0]) : null;
    if (!l || !look) return { quads: [], parts: [], labels: new Map(), texSizes: new Map() };
    return bakeLayers(look.layers.map((x, i) => ({ model: l.models.get(x.geo)!, texture: x.path, label: i ? pretty(x.key) : 'Body' })));
  }
}
