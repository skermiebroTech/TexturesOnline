// Bedrock Edition backend of the model library. blocks.json maps each block to terrain short names per
// face (one name, {up, down, side} or all six faces, plus carried_textures for the inventory look);
// textures/terrain_texture.json maps short names to texture paths (a string, a list of variations, or
// objects with overlay_color / tint_color). Block shapes are drawn by the game itself, so common ones
// (plants, torches, slabs, stairs, fences, panes, doors...) are rebuilt here and the rest shown as cubes.

import { rotateAbout, rotY, nearestDir, apply, snap, type BakedQuad, type Dir, type RGB, type Tint, type Vec3 } from './geometry';
import { bakeModel, type JavaElement, type ResolvedModel } from './java-models';
import type { BlockState, EditionBackend, ModelCategory, RawView, SpriteLayer, TextureStates } from './types';
import { pretty } from './labels';

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export interface BedrockSource {
  blocks: unknown;
  terrain: unknown;
  items: unknown;
  lang: Record<string, string>;
  hasFile(path: string): boolean;
  animated: Set<string>;
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

const CROSS = /(^|_)(flower|tulip|sapling|fern|roots|sprouts|dandelion|poppy|orchid|allium|azure_bluet|houstonia|daisy|cornflower|lily_of_the_valley|wither_rose|torchflower|eyeblossom|deadbush|tallgrass|short_grass|short_dry_grass|tall_dry_grass|seagrass|kelp|reeds|web|dripleaf|pitcher_plant|propagule|spore_blossom|hanging_roots|vines|sweet_berry_bush|wheat|carrots|potatoes|beetroot|nether_wart|bamboo_sapling|fungus|firefly_bush|cactus_flower|bush|hanging_moss|red_mushroom|brown_mushroom|coral|coral_fan|mangrove_propagule)$/;
const DOUBLE = /^(double_plant|sunflower|lilac|rose_bush|peony|tall_grass|large_fern|pitcher_plant)$/;
const APPROX = /(anvil|lantern|bell|brewing_stand|cauldron|hopper|flower_pot|candle|campfire|chain|lectern|grindstone|stonecutter|^bamboo$|scaffolding|dripstone|amethyst_cluster|amethyst_bud|sea_pickle|turtle_egg|conduit|beacon|end_rod|lightning_rod|chorus|piston|banner|sign|skull|frame|decorated_pot|^bed$|shulker_box|lever|tripwire|cocoa|dragon_egg|fence_gate|head|composter|pointed|hanging|heavy_core|vault|trial_spawner|crafter|chest$|bubble_column|end_gateway|end_portal$|portal$|fire$|structure_void|barrier)/;

export function bedrockShape(id: string): { shape: Shape; height?: number } {
  if (/^(water|flowing_water|lava|flowing_lava)$/.test(id)) return { shape: 'liquid' };
  if (DOUBLE.test(id)) return { shape: 'double_cross' };
  if (/torch$/.test(id) && !/torchflower/.test(id)) return { shape: 'torch' };
  if (/_slab\d*$/.test(id) && !/(^double_|double_slab)/.test(id)) return { shape: 'slab' };
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
  if (CROSS.test(id) && !/_block$/.test(id)) return { shape: 'cross' };
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

export class BedrockBackend implements EditionBackend {
  private readonly blocks: Record<string, Record<string, unknown>> = {};
  private readonly terrain: Record<string, unknown>;
  private readonly itemAtlas: Record<string, unknown>;
  private readonly blockList: string[];
  private readonly itemList: string[];

  constructor(private readonly src: BedrockSource) {
    if (isObj(src.blocks)) {
      for (const [k, v] of Object.entries(src.blocks)) if (k !== 'format_version' && isObj(v)) this.blocks[k] = v;
    }
    const td = (a: unknown) => (isObj(a) && isObj(a.texture_data) ? a.texture_data : {});
    this.terrain = td(src.terrain);
    this.itemAtlas = td(src.items);
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

  blockProperties(id: string): { name: string; values: string[] }[] {
    const out: { name: string; values: string[] }[] = [];
    const v = this.variationCount(id);
    if (v.count > 1) out.push({ name: 'variant', values: Array.from({ length: v.count }, (_, i) => String(i)) });
    const b = this.blocks[id];
    if (b && b.carried_textures && b.textures && JSON.stringify(b.carried_textures) !== JSON.stringify(b.textures)) out.push({ name: 'look', values: ['world', 'inventory'] });
    return out;
  }

  defaultBlockState(id: string): BlockState {
    const s: BlockState = {};
    for (const p of this.blockProperties(id)) s[p.name] = p.values[0];
    return s;
  }

  resolveBlock(id: string, state: BlockState): RawView {
    const look = state.look ?? 'world';
    const f = this.faces(id, look);
    if (!f) return { shape: 'special', quads: [], sprite: [], category: 'special', note: 'This block has no textures of its own.' };
    const variant = Number(state.variant ?? 0) || 0;
    const { shape, height } = bedrockShape(id);
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
        ? 'Bedrock draws this block with its own shape. It is shown as a simple cube with the textures blocks.json gives each face.'
        : shape === 'liquid'
          ? 'Liquids are drawn by the game from their still and flowing textures, shown here as a still source block.'
          : undefined,
    };
  }

  blockTextureStates(id: string): TextureStates[] {
    const out = new Map<string, { path: string; role: string; states: BlockState[]; dirs: Set<string> }>();
    const props = this.blockProperties(id);
    const looks = props.find((p) => p.name === 'look')?.values ?? [null];
    const variants = props.find((p) => p.name === 'variant')?.values ?? [null];
    for (const look of looks)
      for (const variant of variants) {
        const state: BlockState = {};
        if (variant !== null) state.variant = variant;
        if (look !== null) state.look = look;
        for (const q of this.resolveBlock(id, state).quads) {
          if (!q.texture) continue;
          let hit = out.get(q.texture);
          if (!hit) out.set(q.texture, (hit = { path: q.texture, role: q.role, states: [], dirs: new Set() }));
          if (!hit.states.some((x) => x.variant === state.variant && x.look === state.look)) hit.states.push(state);
          hit.dirs.add(q.dir);
        }
      }
    return [...out.values()].map((v) => ({ ...v, dirs: [...v.dirs] }));
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
