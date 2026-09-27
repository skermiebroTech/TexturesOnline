// Bedrock Edition backend of the model library. blocks.json maps each block to terrain short names per
// face (one name, {up, down, side} or all six faces, plus carried_textures for the inventory look);
// textures/terrain_texture.json maps short names to texture paths (a string, a list of variations, or
// objects with overlay_color / tint_color). Bedrock builds block shapes into the game: they are taken
// from the matching Java block models (bedrock-java.ts) when those are available, block entities
// (chests, banners, heads, beds, signs...) use the entity models of block-entities.ts, and without the
// Java models common shapes are rebuilt here and the rest shown as cubes.

import { DIR_VEC, DIRS, rotateAbout, rotY, nearestDir, apply, snap, type BakedQuad, type Dir, type RGB, type Tint, type Vec3 } from './geometry';
import { allVariants, bakeModel, faceTexture, javaBlockTint, variantsForState, type JavaElement, type JsonGet, type ResolvedModel } from './java-models';
import type { BlockState, EditionBackend, ModelCategory, RawView, SpriteLayer, TextureStates } from './types';
import { pretty } from './labels';
import { bedrockEntityBlock, type EntityBlock, type EntityTextureSource } from './block-entities';
import { JAVA_FORMS, JavaShapes, chainStrip, javaTargetFor, pickBedrockTexture, textureTokens, type JavaForms, type JavaTarget, type TextureCandidate, type TextureHow } from './bedrock-java';
import { INVISIBLE_NOTE } from './java-blocks';

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export interface BedrockSource {
  blocks: unknown;
  terrain: unknown;
  items: unknown;
  lang: Record<string, string>;
  hasFile(path: string): boolean;
  animated: Set<string>;
  /** Java block models and blockstates by pack path, for the shapes Bedrock builds in (null: offline) */
  java?: JsonGet | null;
}

export interface TerrainTexture {
  /** Path without extension, e.g. 'textures/blocks/grass_side' */
  path: string;
  overlay?: RGB;
  tint?: RGB;
}

function hexColor(v: unknown): RGB | undefined {
  if (typeof v !== 'string') return undefined;
  const m = /^#?([0-9a-f]{6})/i.exec(v.trim());
  if (!m) return undefined;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** The variations of an atlas entry ("textures": string | string[] | {path} | {path}[]). */
export function atlasTextures(entry: unknown): TerrainTexture[] {
  const t = isObj(entry) ? entry.textures : undefined;
  const one = (v: unknown): TerrainTexture | null => {
    if (typeof v === 'string') return { path: v };
    if (isObj(v) && typeof v.path === 'string') return { path: v.path, overlay: hexColor(v.overlay_color), tint: hexColor(v.tint_color) };
    return null;
  };
  if (Array.isArray(t)) return t.map(one).filter((x): x is TerrainTexture => !!x);
  const o = one(t);
  return o ? [o] : [];
}

type FaceNames = Record<Dir, string>;

/** Short name per face from a blocks.json "textures" value. */
export function faceNames(v: unknown): FaceNames | null {
  if (typeof v === 'string') return { up: v, down: v, north: v, south: v, east: v, west: v };
  if (!isObj(v)) return null;
  const s = (k: string) => (typeof v[k] === 'string' ? (v[k] as string) : undefined);
  const side = s('side');
  const any = side ?? s('north') ?? s('up') ?? s('down');
  if (!any) return null;
  return {
    up: s('up') ?? side ?? any,
    down: s('down') ?? side ?? any,
    north: s('north') ?? side ?? any,
    south: s('south') ?? side ?? any,
    east: s('east') ?? side ?? any,
    west: s('west') ?? side ?? any,
  };
}

// ---------------------------------------------------------------------------------------------
// Engine-drawn shapes, described as Java-style elements so they bake exactly like block models.

type Shape =
  | 'cube' | 'cross' | 'double_cross' | 'torch' | 'slab' | 'stairs' | 'fence' | 'wall' | 'pane' | 'door' | 'trapdoor'
  | 'carpet' | 'plate' | 'button' | 'flat' | 'panel' | 'cake' | 'liquid' | 'low' | 'approx';

const box = (from: Vec3, to: Vec3, faces: Partial<Record<Dir, string>>, extra: Partial<JavaElement> = {}): JavaElement => ({
  from,
  to,
  faces: Object.fromEntries(Object.entries(faces).map(([d, t]) => [d, { texture: t }])),
  ...extra,
});
const all6 = (tex: (d: Dir) => string): Partial<Record<Dir, string>> => ({ up: tex('up'), down: tex('down'), north: tex('north'), south: tex('south'), east: tex('east'), west: tex('west') });
const own = (d: Dir) => `#${d}`;

function crossElements(tex: string, yOff = 0): JavaElement[] {
  const rot = { origin: [8, 8 + yOff, 8] as Vec3, axis: 'y' as const, angle: 45, rescale: true };
  return [
    { from: [0.8, yOff, 8], to: [15.2, 16 + yOff, 8], rotation: rot, faces: { north: { texture: tex, uv: [0, 0, 16, 16] }, south: { texture: tex, uv: [0, 0, 16, 16] } } },
    { from: [8, yOff, 0.8], to: [8, 16 + yOff, 15.2], rotation: rot, faces: { west: { texture: tex, uv: [0, 0, 16, 16] }, east: { texture: tex, uv: [0, 0, 16, 16] } } },
  ];
}

function shapeElements(shape: Shape, height = 16): JavaElement[] {
  switch (shape) {
    case 'cube':
    case 'approx':
      return [box([0, 0, 0], [16, 16, 16], all6(own))];
    case 'liquid':
      return [box([0, 0, 0], [16, 14, 16], all6(own))];
    case 'low':
      return [box([0, 0, 0], [16, height, 16], all6(own))];
    case 'cross':
      return crossElements('#north');
    case 'double_cross':
      return [...crossElements('#down'), ...crossElements('#up', 16)];
    case 'torch':
      return [
        {
          from: [7, 0, 7],
          to: [9, 10, 9],
          shade: false,
          faces: {
            down: { texture: '#down', uv: [7, 13, 9, 15] },
            up: { texture: '#up', uv: [7, 6, 9, 8] },
            north: { texture: '#north', uv: [7, 6, 9, 16] },
            south: { texture: '#south', uv: [7, 6, 9, 16] },
            east: { texture: '#east', uv: [7, 6, 9, 16] },
            west: { texture: '#west', uv: [7, 6, 9, 16] },
          },
        },
      ];
    case 'slab':
      return [box([0, 0, 0], [16, 8, 16], all6(own))];
    case 'stairs':
      return [
        box([0, 0, 0], [16, 8, 16], all6(own)),
        box([0, 8, 8], [16, 16, 16], { up: '#up', north: '#north', south: '#south', east: '#east', west: '#west' }),
      ];
    case 'fence':
      return [
        box([6, 0, 6], [10, 16, 10], all6(own)),
        box([7, 12, 0], [9, 15, 16], { up: '#up', down: '#down', east: '#east', west: '#west', north: '#north', south: '#south' }),
        box([7, 6, 0], [9, 9, 16], { up: '#up', down: '#down', east: '#east', west: '#west', north: '#north', south: '#south' }),
      ];
    case 'wall':
      return [box([4, 0, 4], [12, 16, 12], all6(own)), box([5, 0, 0], [11, 14, 16], { up: '#up', east: '#east', west: '#west', north: '#north', south: '#south' })];
    case 'pane':
      return [box([7, 0, 0], [9, 16, 16], { up: '#east', down: '#east', east: '#north', west: '#north', north: '#east', south: '#east' })];
    case 'door':
      return [
        box([0, 0, 13], [16, 16, 16], { up: '#down', down: '#down', north: '#down', south: '#down', east: '#down', west: '#down' }),
        box([0, 16, 13], [16, 32, 16], { up: '#side', down: '#side', north: '#side', south: '#side', east: '#side', west: '#side' }),
      ];
    case 'trapdoor':
      return [box([0, 0, 0], [16, 3, 16], all6(own))];
    case 'carpet':
      return [box([0, 0, 0], [16, 1, 16], all6(own))];
    case 'plate':
      return [box([1, 0, 1], [15, 1, 15], all6(own))];
    case 'button':
      return [box([5, 0, 6], [11, 2, 10], all6(own))];
    case 'flat':
      return [{ from: [0, 1, 0], to: [16, 1, 16], faces: { up: { texture: '#up' }, down: { texture: '#up', uv: [0, 16, 16, 0] } } }];
    case 'panel':
      return [{ from: [0, 0, 0.8], to: [16, 16, 0.8], faces: { north: { texture: '#north' }, south: { texture: '#north', uv: [16, 0, 0, 16] } } }];
    case 'cake':
      return [box([1, 0, 1], [15, 8, 15], all6(own))];
  }
}

const CROSS = /(^|_)(flower|tulip|sapling|fern|roots|sprouts|dandelion|poppy|orchid|allium|azure_bluet|houstonia|daisy|cornflower|lily_of_the_valley|wither_rose|torchflower|eyeblossom|deadbush|tallgrass|short_grass|short_dry_grass|tall_dry_grass|seagrass|kelp|reeds|web|dripleaf|pitcher_plant|propagule|spore_blossom|hanging_roots|vines|sweet_berry_bush|wheat|carrots|potatoes|beetroot|nether_wart|bamboo_sapling|fungus|firefly_bush|cactus_flower|bush|hanging_moss|with_berries|red_mushroom|brown_mushroom|coral|coral_fan|mangrove_propagule)$/;
const DOUBLE = /^(double_plant|sunflower|lilac|rose_bush|peony|tall_grass|large_fern|pitcher_plant)$/;
const APPROX = /(anvil|lantern|bell|brewing_stand|cauldron|hopper|flower_pot|candle|campfire|(^|_)chain$|lectern|grindstone|stonecutter_block|^bamboo$|scaffolding|amethyst_cluster|amethyst_bud|sea_pickle|turtle_egg|conduit|beacon|end_rod|lightning_rod|chorus|piston|banner|sign|skull|frame|decorated_pot|^bed$|shulker_box|lever|tripwire|cocoa|dragon_egg|fence_gate|_head$|composter|pointed|hanging|heavy_core|vault|trial_spawner|crafter|chest$|bubble_column|end_gateway|end_portal$|portal$|fire$|structure_void|barrier)/;

export function bedrockShape(id: string): { shape: Shape; height?: number } {
  if (/^(water|flowing_water|lava|flowing_lava|bubble_column)$/.test(id)) return { shape: 'liquid' };
  if (DOUBLE.test(id)) return { shape: 'double_cross' };
  if (/torch$/.test(id) && !/torchflower/.test(id)) return { shape: 'torch' };
  if (/_slab\d*$/.test(id) && !/double/.test(id)) return { shape: 'slab' };
  if (/_stairs$/.test(id)) return { shape: 'stairs' };
  if (/(^|_)fence$/.test(id)) return { shape: 'fence' };
  if (/_wall$/.test(id) && !/(banner|sign|torch|fan|coral)/.test(id)) return { shape: 'wall' };
  if (/(glass_pane|iron_bars)$/.test(id)) return { shape: 'pane' };
  if (/_door$/.test(id)) return { shape: 'door' };
  if (/trapdoor$/.test(id)) return { shape: 'trapdoor' };
  if (/carpet$/.test(id)) return { shape: 'carpet' };
  if (/pressure_plate$/.test(id)) return { shape: 'plate' };
  if (/_button$/.test(id)) return { shape: 'button' };
  if (/(^|_)rail$/.test(id) || id === 'redstone_wire' || id === 'waterlily' || id === 'lily_pad' || id === 'pink_petals' || id === 'leaf_litter' || id === 'wildflowers') return { shape: 'flat' };
  if (/^(ladder|vine|glow_lichen|sculk_vein|resin_clump)$/.test(id)) return { shape: 'panel' };
  if (id === 'cake') return { shape: 'cake' };
  if (id === 'snow_layer') return { shape: 'low', height: 2 };
  if (/^(farmland|grass_path|dirt_path)$/.test(id)) return { shape: 'low', height: 15 };
  if (id === 'enchanting_table') return { shape: 'low', height: 12 };
  if (id === 'end_portal_frame') return { shape: 'low', height: 13 };
  if (/^daylight_detector/.test(id)) return { shape: 'low', height: 6 };
  if (/(repeater|comparator)$/.test(id)) return { shape: 'low', height: 2 };
  if (CROSS.test(id) && !/(_block|^dirt_with_roots)$/.test(id)) return { shape: 'cross' };
  if (APPROX.test(id)) return { shape: 'approx' };
  return { shape: 'cube' };
}

// ---------------------------------------------------------------------------------------------

const GRASS_TEX = /^(grass_top|grass_side|grass_carried|tallgrass|fern|double_plant_grass_(top|bottom)|double_plant_fern_(top|bottom)|reeds|short_grass|bush)$/;
const FOLIAGE_TEX = /^(leaves_(oak|jungle|acacia|big_oak)(_opaque)?|vine)$/;

function tintForTexture(path: string, tex: TerrainTexture): { tint: Tint | null; mask: boolean } {
  const name = path.slice(path.lastIndexOf('/') + 1);
  if (/^grass_side(_snowed)?$/.test(name)) return { tint: { kind: 'grass' }, mask: true };
  if (GRASS_TEX.test(name)) return { tint: { kind: 'grass' }, mask: false };
  if (FOLIAGE_TEX.test(name)) return { tint: { kind: 'foliage' }, mask: false };
  if (name === 'leaves_birch' || name === 'leaves_birch_opaque') return { tint: { kind: 'fixed', rgb: [0x80, 0xa7, 0x55] }, mask: false };
  if (name === 'leaves_spruce' || name === 'leaves_spruce_opaque') return { tint: { kind: 'fixed', rgb: [0x61, 0x99, 0x61] }, mask: false };
  if (/^mangrove_leaves/.test(name)) return { tint: { kind: 'fixed', rgb: [0x92, 0xc6, 0x48] }, mask: false };
  if (/^water_(still|flow)(_grey)?$/.test(name)) return { tint: { kind: 'water' }, mask: false };
  if (/^redstone_dust/.test(name)) return { tint: { kind: 'fixed', rgb: [255, 51, 0] }, mask: false };
  if (tex.overlay) return { tint: { kind: 'fixed', rgb: tex.overlay }, mask: true };
  if (tex.tint) return { tint: { kind: 'fixed', rgb: tex.tint }, mask: false };
  return { tint: null, mask: false };
}

export interface TextureMatch {
  /** Java texture of the face, e.g. 'minecraft:block/oak_planks' */
  java: string;
  dir: Dir;
  /** Bedrock atlas path picked for it (null: none) */
  bedrock: string | null;
  how: TextureHow | null;
}

type BaseShape = { kind: 'java'; target: JavaTarget | null; forms: JavaForms | null; variants: boolean } | { kind: 'engine'; cube?: boolean };
type ShapeKind =
  /** Drawn by an entity model; `base` is the block model it's drawn with (bell frame, lectern...) */
  | { kind: 'entity'; entity: EntityBlock; base: BaseShape | null }
  | { kind: 'invisible' }
  | BaseShape;

/** Bedrock blocks that are invisible in the world: shown as their icon. */
const INVISIBLE = /^(barrier|structure_void|light_block(_\d+)?)$/;
const ENGINE_NOTE =
  "Bedrock builds this block's shape in the game. The shapes are read from the game's block models, which couldn't be loaded (they need an internet connection the first time), so it's shown as a simple cube with the textures blocks.json gives each face.";
const JAVA_NOTE = 'Bedrock builds this shape in the game. Shown with the matching block model and the textures blocks.json gives this block.';

/** Model rotation of an item frame hanging on a wall (the model hangs on the south side facing north). */
const FRAME_ROTATION: Record<string, { x: number; y: number }> = { north: { x: 0, y: 0 }, east: { x: 0, y: 90 }, south: { x: 0, y: 180 }, west: { x: 0, y: 270 }, up: { x: 270, y: 0 }, down: { x: 90, y: 0 } };

export class BedrockBackend implements EditionBackend {
  private readonly blocks: Record<string, Record<string, unknown>> = {};
  private readonly terrain: Record<string, unknown>;
  private readonly itemAtlas: Record<string, unknown>;
  private readonly blockList: string[];
  private readonly itemList: string[];
  /** Java block models giving Bedrock's built-in shapes (null when they couldn't be loaded) */
  readonly java: JavaShapes | null;
  private readonly globalTextures = new Map<string, { stem: string; tex: TerrainTexture }>();
  private readonly globalKeys = new Map<string, { stem: string; tex: TerrainTexture }>();
  private readonly shapeCache = new Map<string, ShapeKind>();
  readonly entitySource: EntityTextureSource;

  constructor(private readonly src: BedrockSource) {
    if (isObj(src.blocks)) {
      for (const [k, v] of Object.entries(src.blocks)) if (k !== 'format_version' && isObj(v)) this.blocks[k] = v;
    }
    const td = (a: unknown) => (isObj(a) && isObj(a.texture_data) ? a.texture_data : {});
    this.terrain = td(src.terrain);
    this.itemAtlas = td(src.items);
    this.java = src.java ? new JavaShapes(src.java) : null;
    this.entitySource = {
      edition: 'bedrock',
      find: (...rels) => {
        for (const r of rels) {
          const f = this.file(`textures/${r}`);
          if (f) return f;
        }
        return null;
      },
      path: (rel) => `textures/${rel}.png`,
    };
    for (const [key, entry] of Object.entries(this.terrain))
      atlasTextures(entry).forEach((t, i) => {
        const name = t.path.slice(t.path.lastIndexOf('/') + 1);
        if (!this.globalTextures.has(name)) this.globalTextures.set(name, { stem: t.path, tex: t });
        if (i === 0 && !this.globalKeys.has(key)) this.globalKeys.set(key, { stem: t.path, tex: t });
      });
    this.blockList = Object.keys(this.blocks)
      .filter((k) => k !== 'air' && (faceNames(this.blocks[k].textures) || faceNames(this.blocks[k].carried_textures)))
      .sort();
    this.itemList = Object.keys(this.itemAtlas)
      .filter((k) => atlasTextures(this.itemAtlas[k]).some((t) => this.file(t.path)))
      .sort();
  }

  blockIds(): string[] {
    return this.blockList;
  }

  itemIds(): string[] {
    return this.itemList;
  }

  blockName(id: string): string | null {
    const l = this.src.lang;
    return l[`tile.${id}.name`] ?? l[`tile.minecraft:${id}.name`] ?? null;
  }

  itemName(id: string): string | null {
    const l = this.src.lang;
    return l[`item.${id}.name`] ?? l[`item.minecraft:${id}.name`] ?? l[`tile.${id}.name`] ?? null;
  }

  hasTexture(path: string): boolean {
    return this.src.hasFile(path);
  }

  isAnimated(path: string): boolean {
    return this.src.animated.has(path);
  }

  /** Pack path of an atlas texture path (the engine prefers .tga over .png). */
  file(stem: string): string | null {
    for (const ext of ['tga', 'png']) if (this.src.hasFile(`${stem}.${ext}`)) return `${stem}.${ext}`;
    return null;
  }

  private terrainOf(name: string, atlas = this.terrain): TerrainTexture[] {
    return atlasTextures(atlas[name]);
  }

  private faces(id: string, look: string): FaceNames | null {
    const b = this.blocks[id];
    if (!b) return null;
    if (look === 'inventory') return faceNames(b.carried_textures) ?? faceNames(b.textures);
    return faceNames(b.textures) ?? faceNames(b.carried_textures);
  }

  private variationCount(id: string, look = 'world'): { count: number; labels: string[] } {
    const f = this.faces(id, look);
    if (!f) return { count: 1, labels: [] };
    let best: TerrainTexture[] = [];
    for (const d of Object.values(f)) {
      const list = this.terrainOf(d);
      const distinct = new Set(list.map((t) => t.path)).size;
      if (distinct > 1 && list.length > best.length) best = list;
    }
    return { count: Math.max(1, best.length), labels: distinctLabels(best.map((t) => t.path.slice(t.path.lastIndexOf('/') + 1))) };
  }

  variantLabels(id: string): string[] {
    return this.variationCount(id).labels;
  }

  private hasLook(id: string): boolean {
    const b = this.blocks[id];
    return !!(b && b.carried_textures && b.textures && JSON.stringify(b.carried_textures) !== JSON.stringify(b.textures));
  }

  // ------------------------------------------------------------------ shapes

  /** How a block is drawn: an entity model, an icon (invisible), a Java block model, or the built-in fallback shapes. */
  shapeOf(id: string): ShapeKind {
    let s = this.shapeCache.get(id);
    if (!s) {
      s = this.computeShape(id);
      this.shapeCache.set(id, s);
    }
    return s;
  }

  private computeShape(id: string): ShapeKind {
    const entity = bedrockEntityBlock(id, this.entitySource);
    if (entity) return { kind: 'entity', entity, base: entity.mode === 'add' ? this.baseShape(id) : null };
    if (INVISIBLE.test(id)) return { kind: 'invisible' };
    return this.baseShape(id);
  }

  private baseShape(id: string): BaseShape {
    if (/^(flowing_)?(water|lava)$|^bubble_column$/.test(id) || !this.java) return { kind: 'engine' };
    const java = this.java;
    const forms = JAVA_FORMS[id] ?? null;
    if (forms && Object.values(forms.values).every((v) => java.has(v.id))) return { kind: 'java', target: javaTargetFor(id, (j) => java.has(j)), forms, variants: false };
    const target = javaTargetFor(id, (j) => java.has(j));
    if (!target) return { kind: 'engine' };
    if (target.model) return java.models.has(target.model) ? { kind: 'java', target, forms: null, variants: false } : { kind: 'engine' };
    // Java draws it as a plain cube: blocks.json's faces say it all.
    if (java.isCube(target.id)) return { kind: 'engine', cube: true };
    return { kind: 'java', target, forms: null, variants: target.variants ?? !this.variationsAreStates(id, target.id) };
  }

  /**
   * A Bedrock texture list holds several looks (legacy colour and wood lists) unless the Java block's own
   * textures name its entries (candle and lit candle, door halves, turtle egg cracks, dried ghast
   * states): then the Java states choose between them and no 'variant' is offered.
   */
  private variationsAreStates(id: string, javaId: string): boolean {
    if (this.variationCount(id).count <= 1) return true;
    const own = this.candidates(id, 'world', null);
    const multi = new Set(own.filter((c) => this.terrainOf(c.key).length > 1).map((c) => c.stem));
    const bs = this.java!.blockstate(javaId);
    if (!bs) return true;
    for (const { variant } of allVariants(bs)) {
      const m = this.java!.models.resolve(variant.model);
      for (const el of m.elements ?? [])
        for (const [dir, face] of Object.entries(el.faces)) {
          const ref = face ? faceTexture(m, face.texture, dir as Dir).ref : null;
          if (!ref) continue;
          const pick = pickBedrockTexture(ref, dir as Dir, own, (n) => this.globalStem(n));
          if (pick && multi.has(pick.stem) && (pick.how === 'exact' || pick.how === 'alias' || pick.how === 'name' || pick.how === 'global')) return true;
        }
    }
    return false;
  }

  /** The Java block, its state and the Bedrock state left for this block (forms and fixed states applied). */
  private javaFor(shape: Extract<BaseShape, { kind: 'java' }>, state: BlockState): { id: string; state: BlockState } {
    let id = shape.target?.id ?? '';
    const s: BlockState = {};
    for (const [k, v] of Object.entries(state)) if (k !== 'look' && k !== 'variant') s[k] = v;
    if (shape.forms) {
      const form = shape.forms.values[state[shape.forms.prop] ?? shape.forms.default] ?? shape.forms.values[shape.forms.default];
      delete s[shape.forms.prop];
      id = form.id;
      Object.assign(s, form.state);
    }
    if (shape.target?.state) Object.assign(s, shape.target.state);
    if (!shape.target?.model && this.java) {
      // Keep only what this Java block knows, with its defaults for the rest.
      const props = this.java.properties(id);
      const base = this.java.defaultState(id);
      const out: BlockState = { ...base };
      for (const p of props) if (s[p.name] !== undefined && p.values.includes(s[p.name])) out[p.name] = s[p.name];
      return { id, state: out };
    }
    return { id, state: s };
  }

  private javaProperties(shape: Extract<BaseShape, { kind: 'java' }>): { name: string; values: string[] }[] {
    const java = this.java!;
    const out: { name: string; values: string[] }[] = [];
    if (shape.target?.model) return [{ name: 'facing', values: ['north', 'south', 'west', 'east', 'up', 'down'] }, { name: 'map', values: ['false', 'true'] }];
    if (shape.forms) {
      out.push({ name: shape.forms.prop, values: Object.keys(shape.forms.values) });
      // Properties the forms' blocks share with each other (lit, level...)
      const fixed = new Set([shape.forms.prop, ...Object.keys(shape.target?.state ?? {})]);
      const first = Object.values(shape.forms.values)[0];
      for (const p of java.properties(first.id)) if (!fixed.has(p.name) && !(p.name in first.state)) out.push(p);
      return out;
    }
    const id = shape.target!.id;
    const fixed = new Set(Object.keys(shape.target!.state ?? {}));
    const combined = new Set(this.javaCombined(id));
    for (const p of java.properties(id)) if (!fixed.has(p.name) && !combined.has(p.name)) out.push(p);
    return out;
  }

  /** Door and tall plant halves, bed parts: shown together, like on Java. */
  private javaCombined(javaId: string): string[] {
    const props = this.java?.properties(javaId) ?? [];
    const out: string[] = [];
    const half = props.find((p) => p.name === 'half');
    if (half && half.values.includes('lower') && half.values.includes('upper')) out.push('half');
    const part = props.find((p) => p.name === 'part');
    if (part && part.values.includes('head') && part.values.includes('foot') && props.some((p) => p.name === 'facing')) out.push('part');
    return out;
  }

  blockProperties(id: string): { name: string; values: string[] }[] {
    const shape = this.shapeOf(id);
    if (shape.kind === 'entity') {
      const out = shape.entity.properties.map((p) => ({ name: p.name, values: [...p.values] }));
      if (shape.base?.kind === 'java') for (const p of this.javaProperties(shape.base)) if (!out.some((o) => o.name === p.name)) out.push(p);
      return out;
    }
    const out: { name: string; values: string[] }[] = [];
    if (shape.kind === 'java') out.push(...this.javaProperties(shape));
    const v = this.variationCount(id, shape.kind === 'invisible' ? 'inventory' : 'world');
    if (v.count > 1 && (shape.kind !== 'java' || shape.variants)) out.push({ name: 'variant', values: Array.from({ length: v.count }, (_, i) => String(i)) });
    if (shape.kind !== 'invisible' && this.hasLook(id)) out.push({ name: 'look', values: ['world', 'inventory'] });
    return out;
  }

  defaultBlockState(id: string): BlockState {
    const shape = this.shapeOf(id);
    if (shape.kind === 'entity') {
      const s = { ...shape.entity.defaults };
      if (shape.base?.kind === 'java') for (const [k, v] of Object.entries(this.javaBaseDefaults(shape.base))) if (s[k] === undefined) s[k] = v;
      return s;
    }
    const s: BlockState = {};
    if (shape.kind === 'java' && this.java) Object.assign(s, this.javaBaseDefaults(shape));
    for (const p of this.blockProperties(id)) if (s[p.name] === undefined) s[p.name] = p.values[0];
    return s;
  }

  private javaBaseDefaults(shape: Extract<BaseShape, { kind: 'java' }>): BlockState {
    const s: BlockState = {};
    if (this.java) {
      if (shape.target?.model) Object.assign(s, { facing: 'north', map: 'false' });
      else {
        const first = shape.forms ? shape.forms.values[shape.forms.default] : null;
        const def = this.java.defaultState(first?.id ?? shape.target!.id);
        for (const p of this.javaProperties(shape)) {
          if (shape.forms && p.name === shape.forms.prop) s[p.name] = shape.forms.default;
          else if (def[p.name] !== undefined) s[p.name] = def[p.name];
          else s[p.name] = p.values[0];
        }
      }
    }
    return s;
  }

  combinedProperties(): string[] {
    return [];
  }

  // ------------------------------------------------------------------ views

  resolveBlock(id: string, state: BlockState): RawView {
    const shape = this.shapeOf(id);
    if (shape.kind === 'entity') {
      const e = shape.entity;
      const quads = e.quads({ ...e.defaults, ...state });
      if (!shape.base) return { shape: 'model', quads, sprite: [], category: 'special', note: e.note };
      const base = shape.base.kind === 'java' ? this.javaView(id, shape.base, state) : null;
      const b = base ?? this.engineView(id, state, 'world', shape.base.kind === 'engine' && shape.base.cube);
      return { shape: 'model', quads: [...b.quads, ...quads], sprite: [], category: b.category === 'cube' ? 'shape' : b.category, note: e.note };
    }
    if (shape.kind === 'invisible') return this.iconView(id, state, 'inventory', 'special', INVISIBLE_NOTE);
    const look = state.look ?? 'world';
    if (shape.kind === 'java' && this.java) {
      if (look === 'inventory') {
        const icon = this.iconView(id, state, 'inventory', 'shape');
        if (icon.sprite.length) return { ...icon, note: 'Bedrock shows this block as its inventory icon here.' };
      }
      const view = this.javaView(id, shape, state);
      if (view) return view;
    }
    return this.engineView(id, state, look, shape.kind === 'engine' && shape.cube);
  }

  /** The block as a flat icon from its first (carried) texture: invisible blocks, inventory looks. */
  private iconView(id: string, state: BlockState, look: string, category: ModelCategory, note?: string): RawView {
    const f = this.faces(id, look);
    const key = f ? (f.north ?? f.up) : null;
    const list = key ? this.terrainOf(key) : [];
    const variant = Number(state.variant ?? 0) || 0;
    const tex = list.length ? list[variant % list.length] : undefined;
    const path = tex ? this.file(tex.path) : null;
    return { shape: 'sprite', quads: [], sprite: path ? [{ path, role: 'sprite', tint: tex?.tint ? { kind: 'fixed', rgb: tex.tint } : null }] : [], category, note };
  }

  /** Own texture candidates of a block for a look (restricted to one variation when the block has several looks). */
  private candidates(id: string, look: string, variant: number | null): (TextureCandidate & { tex: TerrainTexture })[] {
    const f = this.faces(id, look);
    const out: (TextureCandidate & { tex: TerrainTexture })[] = [];
    if (!f) return out;
    for (const dir of DIRS) {
      const key = f[dir];
      const list = this.terrainOf(key);
      list.forEach((tex, index) => {
        if (variant !== null && list.length > 1 && index !== variant % list.length) return;
        out.push({ dir, key, stem: tex.path, index, tex });
      });
    }
    return out;
  }

  /** How each Java face texture of a block's shape was matched to a Bedrock texture (audits and tests). */
  explainTextures(id: string, state: BlockState = this.defaultBlockState(id)): TextureMatch[] {
    const shape = this.shapeOf(id);
    const base = shape.kind === 'entity' ? shape.base : shape.kind === 'invisible' ? null : shape;
    const out: TextureMatch[] = [];
    if (base?.kind === 'java' && this.java) this.javaView(id, base, state, (m) => out.push(m));
    return out;
  }

  private javaView(id: string, shape: Extract<BaseShape, { kind: 'java' }>, state: BlockState, collect?: (m: TextureMatch) => void): RawView | null {
    const java = this.java!;
    const look = state.look ?? 'world';
    const own = this.candidates(id, look, shape.variants ? Number(state.variant ?? 0) || 0 : null);
    const { id: javaId, state: jstate } = this.javaFor(shape, state);
    const models: ResolvedModel[] = [];
    const quads: BakedQuad[] = [];
    let part = 0;
    if (shape.target?.model) {
      const model = java.models.resolve(`${shape.target.model}${state.map === 'true' ? '_map' : ''}`);
      models.push(model);
      const r = FRAME_ROTATION[state.facing ?? 'north'] ?? FRAME_ROTATION.north;
      quads.push(...bakeModel(model, { x: r.x, y: r.y }));
    } else {
      const bs = java.blockstate(javaId);
      if (!bs) return null;
      const combined = this.javaCombined(javaId);
      const parts: { s: BlockState; offset: Vec3 }[] = [];
      if (combined.includes('half')) parts.push({ s: { ...jstate, half: 'lower' }, offset: [0, 0, 0] }, { s: { ...jstate, half: 'upper' }, offset: [0, 1, 0] });
      else if (combined.includes('part')) {
        const f = DIR_VEC[(jstate.facing as Dir) ?? 'north'] ?? DIR_VEC.north;
        parts.push({ s: { ...jstate, part: 'foot' }, offset: [0, 0, 0] }, { s: { ...jstate, part: 'head' }, offset: [f[0], 0, f[2]] });
      } else parts.push({ s: jstate, offset: [0, 0, 0] });
      for (const { s, offset } of parts)
        for (const v of variantsForState(bs, s)) {
          const model = java.models.resolve(v.model);
          models.push(model);
          quads.push(...bakeModel(model, { x: v.x, y: v.y, uvlock: v.uvlock, offset, part: part++, tint: (i) => javaBlockTint(javaId, s, i) }));
        }
    }
    if (!quads.length) return null;
    const picked = new Map<string, { path: string | null; tint: Tint | null; mask: boolean; role: string }>();
    const out = quads.map((q) => {
      const strip = q.texture ? chainStrip(q.ref, own, Math.min(...q.uvs.map((u) => u[0]))) : null;
      if (strip) {
        collect?.({ java: q.ref, dir: q.dir, bedrock: strip.stem, how: 'alias' });
        return { ...q, texture: this.file(strip.stem), uvs: q.uvs.map(([u, v]) => [u + strip.du, v]) as BakedQuad['uvs'], tint: null, tintindex: -1 };
      }
      const key = `${q.ref}|${q.dir}`;
      let hit = picked.get(key);
      if (!hit) {
        const pick = q.texture ? pickBedrockTexture(q.ref, q.dir, own, (n) => this.globalStem(n), shape.variants) : null;
        collect?.({ java: q.ref, dir: q.dir, bedrock: pick?.stem ?? null, how: pick?.how ?? null });
        if (!pick) hit = { path: null, tint: null, mask: false, role: q.role };
        else if (!pick.stem) hit = { path: '', tint: null, mask: false, role: q.role };
        else {
          const tex = own.find((c) => c.stem === pick.stem)?.tex ?? this.globalTextures.get(pick.stem.slice(pick.stem.lastIndexOf('/') + 1))?.tex ?? { path: pick.stem };
          const t = tintForTexture(pick.stem, tex);
          hit = { path: this.file(pick.stem), tint: t.tint ?? (q.tintindex >= 0 ? q.tint : null), mask: t.mask, role: q.role };
        }
        picked.set(key, hit);
      }
      return { ...q, texture: hit.path, ref: q.ref, tint: hit.tint, tintindex: hit.tint ? 0 : -1, tintMask: hit.mask || undefined };
    });
    const category: ModelCategory = models.some((m) => m.chain.some((c) => /(^|:)block\/(cross|tinted_cross|crop|flower_pot_cross|cross_emissive)$/.test(c))) ? 'plant' : 'shape';
    // Faces of layers Bedrock doesn't have (redstone dust overlay) are left out.
    return { shape: 'model', quads: out.filter((q) => q.texture !== ''), sprite: [], category, note: JAVA_NOTE };
  }

  /**
   * A block texture anywhere in the atlas named like this (item icons don't count): by file name, or by
   * atlas key when the file it points at has the same words (birch_planks -> planks_birch, not
   * piston_top -> piston_inner).
   */
  private globalStem(name: string): string | null {
    const ok = (g: { stem: string } | undefined) => !!g && g.stem.startsWith('textures/blocks/') && !!this.file(g.stem);
    const g = this.globalTextures.get(name);
    if (ok(g)) return g!.stem;
    const k = this.globalKeys.get(name);
    if (ok(k)) {
      const words = new Set(textureTokens(k!.stem));
      if (textureTokens(name).every((t) => words.has(t))) return k!.stem;
    }
    return null;
  }

  /** The shapes Bedrock builds in, redrawn here without the game's block models (offline). */
  private engineView(id: string, state: BlockState, look: string, cube = false): RawView {
    const f = this.faces(id, look);
    if (!f) return { shape: 'special', quads: [], sprite: [], category: 'special', note: 'This block has no textures of its own.' };
    const variant = Number(state.variant ?? 0) || 0;
    const { shape, height } = cube ? { shape: 'cube' as Shape, height: undefined } : bedrockShape(id);
    const textures: Record<string, string> = {};
    const info = new Map<string, { path: string | null; tint: Tint | null; mask: boolean }>();
    for (const [dir, name] of Object.entries(f)) {
      const list = this.terrainOf(name);
      const tex = list.length ? list[variant % list.length] : undefined;
      const path = tex ? this.file(tex.path) : null;
      textures[dir] = name;
      if (!info.has(name) || variant) info.set(name, { path, ...(tex ? tintForTexture(tex.path, tex) : { tint: null, mask: false }) });
    }
    textures.side = f.north;
    const model: ResolvedModel = { id: `bedrock:${id}`, chain: [], textures, translucent: [], elements: shapeElements(shape, height), builtin: null, ambientOcclusion: true, missing: [] };
    let quads = bakeModel(model, { texturePath: (ref) => info.get(ref)?.path ?? null });
    quads = quads.map((q) => {
      const i = info.get(q.ref);
      return { ...q, role: shapeRole(shape, q), tint: i?.tint ?? null, tintindex: i?.tint ? 0 : -1, tintMask: i?.mask || undefined };
    });
    // Show the block's front to the default camera (which looks at the north and east faces).
    const front = (['north', 'east', 'south', 'west'] as Dir[]).find((d) => /front|face|_eye$/.test(f[d]) && f[d] !== f.north);
    const yaw = front === 'south' ? 180 : front === 'east' ? 270 : front === 'west' ? 90 : 0;
    if (yaw) quads = rotateQuads(quads, yaw);
    const category: ModelCategory = shape === 'cube' ? 'cube' : shape === 'cross' || shape === 'double_cross' ? 'plant' : shape === 'liquid' || shape === 'approx' ? 'special' : 'shape';
    const approx = shape === 'approx';
    return {
      shape: 'model',
      quads,
      sprite: [],
      category,
      approximate: approx || undefined,
      note: approx
        ? this.java
          ? 'Bedrock builds this block\'s shape in the game and there is no matching block model: shown as a simple cube with the textures blocks.json gives each face.'
          : ENGINE_NOTE
        : shape === 'liquid'
          ? 'Liquids are drawn by the game from their still and flowing textures, shown here as a still source block.'
          : undefined,
    };
  }

  blockTextureStates(id: string): TextureStates[] {
    const out = new Map<string, { path: string; role: string; states: BlockState[]; keys: Set<string>; dirs: Set<string> }>();
    const base = this.defaultBlockState(id);
    const states: BlockState[] = [base];
    for (const p of this.blockProperties(id)) for (const v of p.values) if (base[p.name] !== v) states.push({ ...base, [p.name]: v });
    // Every look of every variation (their textures differ per variation).
    const looks = this.blockProperties(id).find((p) => p.name === 'look')?.values ?? [];
    const variants = this.blockProperties(id).find((p) => p.name === 'variant')?.values ?? [];
    for (const look of looks) for (const variant of variants) states.push({ ...base, look, variant });
    for (const state of states.slice(0, 400)) {
      const v = this.resolveBlock(id, state);
      const add = (path: string, role: string, dir: string | null) => {
        let hit = out.get(path);
        if (!hit) out.set(path, (hit = { path, role, states: [], keys: new Set(), dirs: new Set() }));
        const k = JSON.stringify(state);
        if (!hit.keys.has(k)) {
          hit.keys.add(k);
          hit.states.push(state);
        }
        if (dir) hit.dirs.add(dir);
      };
      for (const q of v.quads) if (q.texture) add(q.texture, q.role, q.dir);
      for (const s of v.sprite) add(s.path, s.role, null);
    }
    return [...out.values()].map((v) => ({ path: v.path, role: v.role, states: v.states, dirs: [...v.dirs] }));
  }

  itemOptions(id: string): string[] {
    const list = this.terrainOf(id, this.itemAtlas);
    const paths = [...new Set(list.map((t) => t.path))];
    return paths.length > 1 ? paths.map((p) => pretty(p.slice(p.lastIndexOf('/') + 1))) : ['Default'];
  }

  resolveItem(id: string, option: number): RawView {
    const list = [...new Map(this.terrainOf(id, this.itemAtlas).map((t) => [t.path, t])).values()];
    const tex = list[Math.max(0, Math.min(list.length - 1, option))];
    const path = tex ? this.file(tex.path) : null;
    const sprite: SpriteLayer[] = path ? [{ path, role: 'layer0', tint: tex.tint ? { kind: 'fixed', rgb: tex.tint } : null }] : [];
    return { shape: 'sprite', quads: [], sprite, category: 'item' };
  }

  itemTexturePaths(id: string): string[] {
    return [...new Set(this.terrainOf(id, this.itemAtlas).map((t) => this.file(t.path)).filter((p): p is string => !!p))];
  }
}

/** Texture role of a quad of an engine shape (plants, torches and door halves get their own names). */
function shapeRole(shape: Shape, q: BakedQuad): string {
  if (shape === 'cross') return 'cross';
  if (shape === 'torch') return 'torch';
  if (shape === 'double_cross') return q.element >= 2 ? 'upper' : 'lower';
  if (shape === 'door') return q.element >= 1 ? 'upper' : 'lower';
  if (shape === 'flat' || shape === 'panel') return 'texture';
  return q.dir;
}

/** Labels for a list of variation file names without the words they all share ('Wool Colored White' -> 'White'). */
export function distinctLabels(names: string[]): string[] {
  const toks = names.map((n) => n.split('_').filter(Boolean));
  if (toks.length < 2) return names.map((n) => pretty(n));
  let pre = 0;
  while (toks.every((t) => t.length > pre + 1 && t[pre] === toks[0][pre])) pre++;
  let suf = 0;
  while (toks.every((t) => t.length > pre + suf + 1 && t[t.length - 1 - suf] === toks[0][toks[0].length - 1 - suf])) suf++;
  const out = toks.map((t) => pretty(t.slice(pre, t.length - suf).join('_')));
  return new Set(out).size === out.length ? out : names.map((n) => pretty(n));
}

/** Rotates quads about the block's vertical axis (Java-style y: 90 = north turns east). */
export function rotateQuads(quads: BakedQuad[], yDeg: number): BakedQuad[] {
  const m = rotY(-yDeg);
  const c: Vec3 = [0.5, 0.5, 0.5];
  return quads.map((q) => {
    const normal = apply(m, q.normal).map(snap) as Vec3;
    const wd = nearestDir(normal);
    return {
      ...q,
      positions: q.positions.map((p) => rotateAbout(p, c, m).map(snap) as Vec3) as BakedQuad['positions'],
      normal,
      worldDir: q.worldDir ? wd : null,
    };
  });
}

/** Parses a Bedrock .lang file (key=value lines, '##' comments, tab-separated trailing comments). */
export function parseLang(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    if (!raw || raw.startsWith('#')) continue;
    const eq = raw.indexOf('=');
    if (eq <= 0) continue;
    let v = raw.slice(eq + 1);
    const tab = v.indexOf('\t');
    if (tab >= 0) v = v.slice(0, tab);
    out[raw.slice(0, eq).trim()] = v.trim();
  }
  return out;
}
