// Java Edition block and item models: blockstates (variants with x/y rotation and uvlock, weighted
// lists, multipart with when / OR / AND), model parent chains with texture variables, element baking
// that follows the game's FaceBakery (default UVs, face rotation, element rotation with rescale, the
// block state's rotation and uvlock), and item model definitions (items/*.json from 1.21.4, the older
// models/item overrides). Works for every version with models (1.8+). Pure, no DOM.

import {
  DIR_VEC,
  DIRS,
  IDENTITY,
  apply,
  cornerUv,
  defaultFaceUv,
  faceCorner,
  mul,
  nearestDir,
  normRotation,
  normalize,
  rotX,
  rotY,
  rotZ,
  rotateAbout,
  snap,
  transpose,
  type BakedQuad,
  type Dir,
  type Mat3,
  type RGB,
  type Tint,
  type UV4,
  type Vec3,
} from './geometry';

/** Reads a parsed JSON file by pack path (undefined when missing or unreadable). */
export type JsonGet = (path: string) => unknown;

export interface JavaFace {
  uv?: UV4;
  texture: string;
  cullface?: Dir;
  rotation?: number;
  tintindex?: number;
}

export interface JavaElementRotation {
  origin: Vec3;
  axis?: 'x' | 'y' | 'z';
  angle?: number;
  rescale?: boolean;
  /** 26.x: free rotation given as Euler angles */
  x?: number;
  y?: number;
  z?: number;
}

export interface JavaElement {
  from: Vec3;
  to: Vec3;
  rotation?: JavaElementRotation;
  shade?: boolean;
  /** 26.x: light the element as if it faced this way */
  shadeDir?: Dir;
  faces: Partial<Record<Dir, JavaFace>>;
}

export interface ResolvedModel {
  /** Normalised id, e.g. 'minecraft:block/furnace' */
  id: string;
  /** The model and its parents, child first */
  chain: string[];
  /** Merged texture variables (child wins); values are refs or '#other' */
  textures: Record<string, string>;
  /** Variables whose sprite is marked force_translucent (26.1+) */
  translucent: string[];
  /** Elements of the nearest model in the chain that has them */
  elements: JavaElement[] | null;
  /** The chain ends at a built-in model instead of elements */
  builtin: 'generated' | 'entity' | 'missing' | null;
  ambientOcclusion: boolean;
  /** Models of the chain that don't exist */
  missing: string[];
}

export interface Variant {
  model: string;
  x: number;
  y: number;
  uvlock: boolean;
  weight: number;
}

export type Condition = { OR: Condition[] } | { AND: Condition[] } | Record<string, string>;

export interface Blockstate {
  variants: { key: string; when: Record<string, string>; options: Variant[] }[] | null;
  multipart: { when: Condition | null; apply: Variant[] }[] | null;
}

export interface BlockProperty {
  name: string;
  values: string[];
}

// ---------------------------------------------------------------------------------------------
// Ids and paths

/** ['minecraft', 'block/stone'] from 'minecraft:block/stone' or 'block/stone'. */
export function splitId(ref: string): [string, string] {
  const i = ref.indexOf(':');
  return i < 0 ? ['minecraft', ref] : [ref.slice(0, i) || 'minecraft', ref.slice(i + 1)];
}

/**
 * Normalised model id. Blockstates before 1.13 name models relative to models/block/
 * ("model": "furnace"), so a bare name gets the block/ folder.
 */
export function modelId(ref: string): string {
  const [ns, path] = splitId(ref.trim());
  return `${ns}:${path.includes('/') ? path : `block/${path}`}`;
}

export function modelPath(id: string): string {
  const [ns, path] = splitId(id);
  return `assets/${ns}/models/${path}.json`;
}

export function javaTexturePath(ref: string): string {
  const [ns, path] = splitId(ref);
  return `assets/${ns}/textures/${path}.png`;
}

export function blockstatePath(blockId: string): string {
  return `assets/minecraft/blockstates/${blockId}.json`;
}

export function itemDefinitionPath(itemId: string): string {
  return `assets/minecraft/items/${itemId}.json`;
}

// ---------------------------------------------------------------------------------------------
// Parsing helpers (tolerant: packs and old versions have odd files)

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function num(v: unknown, fb = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fb;
}

function vec3(v: unknown): Vec3 | null {
  return Array.isArray(v) && v.length >= 3 && v.slice(0, 3).every((n) => typeof n === 'number' && Number.isFinite(n)) ? [v[0], v[1], v[2]] : null;
}

function uv4(v: unknown): UV4 | undefined {
  return Array.isArray(v) && v.length >= 4 && v.slice(0, 4).every((n) => typeof n === 'number' && Number.isFinite(n)) ? [v[0], v[1], v[2], v[3]] : undefined;
}

function parseElements(v: unknown): JavaElement[] | null {
  if (!Array.isArray(v)) return null;
  const out: JavaElement[] = [];
  for (const e of v) {
    if (!isObj(e)) continue;
    const from = vec3(e.from);
    const to = vec3(e.to);
    if (!from || !to || !isObj(e.faces)) continue;
    const faces: Partial<Record<Dir, JavaFace>> = {};
    for (const d of DIRS) {
      const f = (e.faces as Record<string, unknown>)[d];
      if (!isObj(f) || typeof f.texture !== 'string') continue;
      faces[d] = {
        texture: f.texture,
        uv: uv4(f.uv),
        cullface: typeof f.cullface === 'string' && (DIRS as readonly string[]).includes(f.cullface) ? (f.cullface as Dir) : undefined,
        rotation: typeof f.rotation === 'number' ? f.rotation : undefined,
        tintindex: typeof f.tintindex === 'number' ? f.tintindex : undefined,
      };
    }
    let rotation: JavaElementRotation | undefined;
    if (isObj(e.rotation)) {
      const r = e.rotation;
      const origin = vec3(r.origin) ?? [8, 8, 8];
      if (typeof r.axis === 'string' && ['x', 'y', 'z'].includes(r.axis)) {
        rotation = { origin, axis: r.axis as 'x' | 'y' | 'z', angle: num(r.angle), rescale: r.rescale === true };
      } else if (typeof r.x === 'number' || typeof r.y === 'number' || typeof r.z === 'number') {
        rotation = { origin, x: num(r.x), y: num(r.y), z: num(r.z) };
      }
    }
    const sdo = typeof e.shade_direction_override === 'string' && (DIRS as readonly string[]).includes(e.shade_direction_override) ? (e.shade_direction_override as Dir) : undefined;
    out.push({ from, to, faces, rotation, shade: e.shade === false ? false : undefined, shadeDir: sdo });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Model resolution

export class JavaModelSet {
  private readonly cache = new Map<string, ResolvedModel>();

  constructor(private readonly json: JsonGet) {}

  has(ref: string): boolean {
    return isObj(this.json(modelPath(modelId(ref))));
  }

  /** The model with its parent chain merged (cached). Never throws; missing models resolve to builtin 'missing'. */
  resolve(ref: string): ResolvedModel {
    const id = modelId(ref);
    const hit = this.cache.get(id);
    if (hit) return hit;
    const chain: string[] = [];
    const textures: Record<string, string> = {};
    const translucent = new Set<string>();
    const missing: string[] = [];
    let elements: JavaElement[] | null = null;
    let builtin: ResolvedModel['builtin'] = null;
    let ao: boolean | undefined;
    let cur: string | null = id;
    const seen = new Set<string>();
    while (cur && !seen.has(cur) && chain.length < 32) {
      seen.add(cur);
      const [, path] = splitId(cur);
      if (path.startsWith('builtin/')) {
        chain.push(cur);
        const kind = path.slice('builtin/'.length);
        if (!elements) builtin = kind === 'generated' ? 'generated' : kind === 'entity' ? 'entity' : 'missing';
        break;
      }
      const j = this.json(modelPath(cur));
      if (!isObj(j)) {
        missing.push(cur);
        if (!elements && chain.length === 0) builtin = 'missing';
        break;
      }
      chain.push(cur);
      if (isObj(j.textures)) {
        for (const [k, v] of Object.entries(j.textures)) {
          if (k in textures) continue;
          if (typeof v === 'string') textures[k] = v;
          else if (isObj(v) && typeof v.sprite === 'string') {
            textures[k] = v.sprite;
            if (v.force_translucent === true) translucent.add(k);
          }
        }
      }
      if (!elements && Array.isArray(j.elements)) elements = parseElements(j.elements);
      if (ao === undefined && typeof j.ambientocclusion === 'boolean') ao = j.ambientocclusion;
      cur = typeof j.parent === 'string' ? modelId(j.parent) : null;
    }
    // Item models (layer0...) end at builtin/generated even when a later file has elements.
    const res: ResolvedModel = { id, chain, textures, translucent: [...translucent], elements, builtin: elements ? null : builtin, ambientOcclusion: ao ?? true, missing };
    this.cache.set(id, res);
    return res;
  }
}

/**
 * Follows a texture variable ('front', '#front') through '#' references. Returns the final ref (null
 * when undefined or circular) and the variables visited.
 */
export function resolveTextureVar(textures: Record<string, string>, name: string): { ref: string | null; via: string[] } {
  const via: string[] = [];
  let key = name.startsWith('#') ? name.slice(1) : name;
  for (let i = 0; i < 32; i++) {
    via.push(key);
    const v = textures[key];
    if (v === undefined) return { ref: null, via };
    if (!v.startsWith('#')) return { ref: v, via };
    key = v.slice(1);
  }
  return { ref: null, via };
}

/** Texture ref and role of a face texture value ('#side' or a direct 'block/x'). */
export function faceTexture(model: ResolvedModel, value: string, dir: Dir): { ref: string | null; role: string } {
  if (!value.startsWith('#')) return { ref: value, role: dir };
  const { ref, via } = resolveTextureVar(model.textures, value);
  return { ref, role: via[via.length - 1] ?? value.slice(1) };
}

// ---------------------------------------------------------------------------------------------
// Blockstates

export function parseVariantKey(key: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!key || key === 'normal') return out;
  for (const pair of key.split(',')) {
    const eq = pair.indexOf('=');
    if (eq <= 0) continue;
    out[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  }
  return out;
}

function parseVariantList(v: unknown): Variant[] {
  const list = Array.isArray(v) ? v : [v];
  const out: Variant[] = [];
  for (const o of list) {
    if (!isObj(o) || typeof o.model !== 'string') continue;
    out.push({ model: o.model, x: num(o.x), y: num(o.y), uvlock: o.uvlock === true, weight: Math.max(1, num(o.weight, 1)) });
  }
  return out;
}

function parseCondition(v: unknown): Condition | null {
  if (!isObj(v)) return null;
  if (Array.isArray(v.OR)) return { OR: v.OR.map(parseCondition).filter((c): c is Condition => !!c) };
  if (Array.isArray(v.AND)) return { AND: v.AND.map(parseCondition).filter((c): c is Condition => !!c) };
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v)) if (typeof val === 'string' || typeof val === 'boolean' || typeof val === 'number') out[k] = String(val);
  return out;
}

export function parseBlockstate(json: unknown): Blockstate | null {
  if (!isObj(json)) return null;
  if (isObj(json.variants)) {
    const variants = Object.entries(json.variants)
      .map(([key, v]) => ({ key, when: parseVariantKey(key), options: parseVariantList(v) }))
      .filter((v) => v.options.length > 0);
    return variants.length ? { variants, multipart: null } : null;
  }
  if (Array.isArray(json.multipart)) {
    const multipart = json.multipart
      .filter(isObj)
      .map((p) => ({ when: p.when === undefined ? null : parseCondition(p.when), apply: parseVariantList(p.apply) }))
      .filter((p) => p.apply.length > 0);
    return multipart.length ? { variants: null, multipart } : null;
  }
  return null;
}

export function matchesCondition(cond: Condition | null, state: Record<string, string>): boolean {
  if (!cond) return true;
  if ('OR' in cond && Array.isArray(cond.OR)) return cond.OR.some((c) => matchesCondition(c, state));
  if ('AND' in cond && Array.isArray(cond.AND)) return cond.AND.every((c) => matchesCondition(c, state));
  for (const [k, v] of Object.entries(cond as Record<string, string>)) {
    const allowed = v.split('|');
    if (!allowed.includes(state[k] ?? '')) return false;
  }
  return true;
}

const VALUE_ORDER = [
  'false', 'true', 'none', 'low', 'tall', 'side', 'up', 'down', 'north', 'east', 'south', 'west',
  'bottom', 'top', 'lower', 'upper', 'foot', 'head', 'left', 'right', 'single', 'double', 'floor', 'wall', 'ceiling',
  'straight', 'inner_left', 'inner_right', 'outer_left', 'outer_right', 'x', 'y', 'z',
];

export function sortValues(values: Iterable<string>): string[] {
  const list = [...new Set(values)];
  if (list.every((v) => /^-?\d+$/.test(v))) return list.sort((a, b) => Number(a) - Number(b));
  return list.sort((a, b) => {
    const ia = VALUE_ORDER.indexOf(a);
    const ib = VALUE_ORDER.indexOf(b);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

function collectCondition(cond: Condition | null, into: Map<string, Set<string>>): void {
  if (!cond) return;
  if ('OR' in cond && Array.isArray(cond.OR)) return cond.OR.forEach((c) => collectCondition(c, into));
  if ('AND' in cond && Array.isArray(cond.AND)) return cond.AND.forEach((c) => collectCondition(c, into));
  for (const [k, v] of Object.entries(cond as Record<string, string>)) {
    let s = into.get(k);
    if (!s) into.set(k, (s = new Set()));
    for (const part of v.split('|')) s.add(part);
  }
}

/** Every property the blockstate file distinguishes, with its values in a sensible order. */
export function blockstateProperties(bs: Blockstate): BlockProperty[] {
  const map = new Map<string, Set<string>>();
  if (bs.variants) {
    for (const v of bs.variants)
      for (const [k, val] of Object.entries(v.when)) {
        let s = map.get(k);
        if (!s) map.set(k, (s = new Set()));
        s.add(val);
      }
  } else if (bs.multipart) {
    for (const p of bs.multipart) collectCondition(p.when, map);
    // Conditions only name the values that add a part: add the "not connected" value too.
    for (const [name, s] of map) {
      if ([...s].every((v) => v === 'true' || v === 'false')) {
        s.add('true');
        s.add('false');
      } else if (/^(north|south|east|west|up|down)$/.test(name) && !s.has('none') && !s.has('false')) s.add('none');
    }
  }
  return [...map.entries()].map(([name, values]) => ({ name, values: sortValues(values) }));
}

const PREFERRED: Record<string, string[]> = {
  facing: ['north'],
  horizontal_facing: ['north'],
  half: ['bottom', 'lower'],
  axis: ['y'],
  waterlogged: ['false'],
  lit: ['false'],
  powered: ['false'],
  open: ['false'],
  snowy: ['false'],
  hinge: ['left'],
  shape: ['straight', 'north_south'],
  type: ['bottom', 'single'],
  attached: ['false'],
  face: ['floor', 'wall'],
  rotation: ['0'],
  part: ['foot'],
  occupied: ['false'],
  triggered: ['false'],
  enabled: ['true'],
  inverted: ['false'],
  hanging: ['false'],
  in_wall: ['false'],
  extended: ['false'],
  short: ['false'],
  mode: ['compare', 'save'],
};

const CONNECT = ['true', 'side', 'low'];

/** A good first state to show: north-facing, unlit, bottom half; multipart connections along north-south. */
export function defaultState(bs: Blockstate, props: BlockProperty[] = blockstateProperties(bs)): Record<string, string> {
  const state: Record<string, string> = {};
  // Fences, panes and walls (multipart, or plain variants before 1.9): connect along north-south.
  const multipart = !!bs.multipart || (['north', 'south', 'east', 'west'].every((n) => props.some((p) => p.name === n)) && !props.some((p) => p.name === 'facing'));
  for (const p of props) {
    let v: string | undefined;
    if (multipart && (p.name === 'north' || p.name === 'south')) v = CONNECT.find((c) => p.values.includes(c));
    else if (multipart && ['east', 'west', 'up', 'down'].includes(p.name)) v = ['false', 'none'].find((c) => p.values.includes(c));
    v ??= PREFERRED[p.name]?.find((c) => p.values.includes(c));
    state[p.name] = v ?? p.values[0];
  }
  if (bs.variants && bs.variants.length && !bs.variants.some((v) => variantMatches(v.when, state))) {
    // The preferred combination doesn't exist: fall back to the first listed variant.
    Object.assign(state, bs.variants[0].when);
  }
  return state;
}

function variantMatches(when: Record<string, string>, state: Record<string, string>): boolean {
  for (const [k, v] of Object.entries(when)) if (state[k] !== v) return false;
  return true;
}

/** Models applied for a state: one variant (the `pick`-th of a weighted list), or every matching multipart part. */
export function variantsForState(bs: Blockstate, state: Record<string, string>, pick = 0): Variant[] {
  if (bs.variants) {
    const v = bs.variants.find((x) => variantMatches(x.when, state)) ?? bs.variants[0];
    return [v.options[Math.min(Math.max(0, pick), v.options.length - 1)]];
  }
  const out: Variant[] = [];
  for (const p of bs.multipart ?? []) if (matchesCondition(p.when, state)) out.push(p.apply[0]);
  return out;
}

/** Every variant the file can apply, each with a state that selects it (for "all textures of this block"). */
export function allVariants(bs: Blockstate, props: BlockProperty[] = blockstateProperties(bs)): { variant: Variant; when: Record<string, string> }[] {
  const out: { variant: Variant; when: Record<string, string> }[] = [];
  if (bs.variants) for (const v of bs.variants) for (const o of v.options) out.push({ variant: o, when: v.when });
  else
    for (const p of bs.multipart ?? []) {
      const when = firstStateFor(p.when, props);
      for (const o of p.apply) out.push({ variant: o, when });
    }
  return out;
}

/** A partial state that satisfies a multipart condition (first alternative of ORs). */
function firstStateFor(cond: Condition | null, props: BlockProperty[]): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (c: Condition | null) => {
    if (!c) return;
    if ('OR' in c && Array.isArray(c.OR)) return walk(c.OR[0] ?? null);
    if ('AND' in c && Array.isArray(c.AND)) return c.AND.forEach(walk);
    for (const [k, v] of Object.entries(c as Record<string, string>)) out[k] = v.split('|')[0];
  };
  walk(cond);
  for (const p of props) if (!(p.name in out) && cond && 'OR' in cond) out[p.name] = p.values.includes('none') ? 'none' : p.values.includes('false') ? 'false' : p.values[0];
  return out;
}

// ---------------------------------------------------------------------------------------------
// Baking (FaceBakery)

/** Blockstate rotation: X first, then Y, both clockwise-looking-down-the-axis as the game applies them. */
export function variantMatrix(x: number, y: number): Mat3 {
  return mul(rotY(-y), rotX(-x));
}

const UV_LOCAL_TO_GLOBAL: Record<Dir, Mat3> = {
  south: IDENTITY,
  east: rotY(90),
  west: rotY(-90),
  north: rotY(180),
  up: rotX(-90),
  down: rotX(90),
};

function sign(v: number): number {
  return v === 0 ? 0 : v > 0 ? 1 : -1;
}

/** The game's uvlock: re-maps a face's uv so the texture stays aligned with the world after rotation. */
export function uvLock(uv: UV4, rotation: number, dir: Dir, m: Mat3): { uv: UV4; rotation: 0 | 90 | 180 | 270 } {
  const rotated = nearestDir(apply(m, DIR_VEC[dir]));
  const t = mul(mul(transpose(UV_LOCAL_TO_GLOBAL[dir]), transpose(m)), UV_LOCAL_TO_GLOBAL[rotated]);
  const tp = (u: number, v: number): [number, number] => {
    const p = rotateAbout([u / 16, v / 16, 0], [0.5, 0.5, 0.5], t);
    return [16 * p[0], 16 * p[1]];
  };
  const [f, f1, f4, f5] = uv;
  const [f2, f3] = tp(f, f1);
  const [f6, f7] = tp(f4, f5);
  let f8: number, f9: number, f10: number, f11: number;
  if (sign(f - f4) === sign(f2 - f6)) {
    f8 = f2;
    f9 = f6;
  } else {
    f8 = f6;
    f9 = f2;
  }
  if (sign(f1 - f5) === sign(f3 - f7)) {
    f10 = f3;
    f11 = f7;
  } else {
    f10 = f7;
    f11 = f3;
  }
  const r = (rotation * Math.PI) / 180;
  const v = apply(t, [Math.cos(r), Math.sin(r), 0]);
  const deg = (Math.atan2(v[1], v[0]) * 180) / Math.PI;
  const rot = ((-Math.round(deg / 90) * 90) % 360 + 360) % 360;
  return { uv: [snap(f8), snap(f10), snap(f9), snap(f11)], rotation: rot as 0 | 90 | 180 | 270 };
}

function elementTransform(r: JavaElementRotation | undefined): { m: Mat3; origin: Vec3; scale: Vec3 } | null {
  if (!r) return null;
  const origin: Vec3 = [r.origin[0] / 16, r.origin[1] / 16, r.origin[2] / 16];
  if (r.axis) {
    const angle = r.angle ?? 0;
    const m = r.axis === 'x' ? rotX(angle) : r.axis === 'y' ? rotY(angle) : rotZ(angle);
    let scale: Vec3 = [1, 1, 1];
    if (r.rescale && angle % 90 !== 0) {
      const s = 1 / Math.cos((Math.abs(angle) * Math.PI) / 180);
      scale = r.axis === 'x' ? [1, s, s] : r.axis === 'y' ? [s, 1, s] : [s, s, 1];
    }
    return { m, origin, scale };
  }
  return { m: mul(mul(rotX(r.x ?? 0), rotY(r.y ?? 0)), rotZ(r.z ?? 0)), origin, scale: [1, 1, 1] };
}

export interface BakeOptions {
  x?: number;
  y?: number;
  uvlock?: boolean;
  /** Block offset (e.g. [0, 1, 0] for the upper half of a door) */
  offset?: Vec3;
  part?: number;
  /** Maps a texture ref to a pack path (null = missing). Defaults to javaTexturePath. */
  texturePath?: (ref: string) => string | null;
  /** Tint for a face's tintindex (null = untinted) */
  tint?: (tintindex: number) => Tint | null;
}

/** Bakes a resolved model's elements into quads, exactly as the game positions and maps them. */
export function bakeModel(model: ResolvedModel, opts: BakeOptions = {}): BakedQuad[] {
  const out: BakedQuad[] = [];
  if (!model.elements) return out;
  const m = variantMatrix(opts.x ?? 0, opts.y ?? 0);
  const rotated = !!(opts.x || opts.y);
  const off = opts.offset ?? [0, 0, 0];
  const texPath = opts.texturePath ?? javaTexturePath;
  model.elements.forEach((el, ei) => {
    const min: Vec3 = [el.from[0] / 16, el.from[1] / 16, el.from[2] / 16];
    const max: Vec3 = [el.to[0] / 16, el.to[1] / 16, el.to[2] / 16];
    const et = elementTransform(el.rotation);
    for (const dir of DIRS) {
      const face = el.faces[dir];
      if (!face) continue;
      let uv = face.uv ?? defaultFaceUv(dir, el.from, el.to);
      let rot: number = normRotation(face.rotation);
      if (opts.uvlock && rotated) ({ uv, rotation: rot } = uvLock(uv, rot, dir, m));
      const positions = [0, 1, 2, 3].map((i) => {
        let p = faceCorner(dir, i, min, max);
        if (et) p = rotateAbout(p, et.origin, et.m, et.scale);
        if (rotated) p = rotateAbout(p, [0.5, 0.5, 0.5], m);
        return [snap(p[0] + off[0]), snap(p[1] + off[1]), snap(p[2] + off[2])] as Vec3;
      }) as BakedQuad['positions'];
      const uvs = [0, 1, 2, 3].map((i) => cornerUv(uv, rot, i)) as BakedQuad['uvs'];
      let n = DIR_VEC[dir];
      if (et) n = apply(et.m, n);
      if (rotated) n = apply(m, n);
      const normal = normalize(n).map((c) => snap(c)) as Vec3;
      const axisDir = nearestDir(normal);
      const dv = DIR_VEC[axisDir];
      const worldDir = dv[0] * normal[0] + dv[1] * normal[1] + dv[2] * normal[2] > 0.999 ? axisDir : null;
      const { ref, role } = faceTexture(model, face.texture, dir);
      const tintindex = face.tintindex ?? -1;
      out.push({
        positions,
        uvs,
        normal,
        dir,
        worldDir,
        texture: ref ? texPath(ref) : null,
        ref: ref ?? face.texture,
        role,
        tintindex,
        tint: tintindex >= 0 && opts.tint ? opts.tint(tintindex) : null,
        shade: el.shade !== false,
        shadeDir: el.shadeDir,
        part: opts.part ?? 0,
        element: ei,
      });
    }
  });
  return out;
}

// ---------------------------------------------------------------------------------------------
// Tints (the game's BlockColors / ItemColors, reduced to the vanilla defaults)

const rgbOf = (hex: number): RGB => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];

const GRASS_BLOCKS = /^(grass_block|grass|short_grass|tall_grass|tallgrass|fern|large_fern|double_grass|double_fern|double_plant|potted_fern|sugar_cane|reeds|bush|pink_petals|wildflowers|flower_pot)$/;
const FOLIAGE_BLOCKS = /^(oak_leaves|jungle_leaves|acacia_leaves|dark_oak_leaves|vine|leaves|leaves2|big_oak_leaves)$/;

/** Redstone wire colour for a power level (RedStoneWireBlock). */
export function redstoneColor(power: number): RGB {
  const f = Math.max(0, Math.min(15, power)) / 15;
  const r = f * 0.6 + (f > 0 ? 0.4 : 0.3);
  const g = Math.max(0, Math.min(1, f * f * 0.7 - 0.5));
  const b = Math.max(0, Math.min(1, f * f * 0.6 - 0.7));
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/** How the game tints a block's tintindex faces (vanilla colours; biome colours use the default biome). */
export function javaBlockTint(blockId: string, state: Record<string, string> = {}): Tint | null {
  const id = blockId.replace(/^minecraft:/, '');
  if (GRASS_BLOCKS.test(id)) return { kind: 'grass' };
  if (FOLIAGE_BLOCKS.test(id)) return { kind: 'foliage' };
  if (id === 'birch_leaves') return { kind: 'fixed', rgb: rgbOf(0x80a755) };
  if (id === 'spruce_leaves') return { kind: 'fixed', rgb: rgbOf(0x619961) };
  if (id === 'mangrove_leaves') return { kind: 'fixed', rgb: rgbOf(0x92c648) };
  if (id === 'lily_pad' || id === 'waterlily') return { kind: 'fixed', rgb: rgbOf(0x208030) };
  if (/^(water|flowing_water|bubble_column|water_cauldron|cauldron)$/.test(id)) return { kind: 'water' };
  if (id === 'leaf_litter') return { kind: 'dry_foliage' };
  if (id === 'redstone_wire') return { kind: 'fixed', rgb: redstoneColor(state.power !== undefined ? Number(state.power) : 15) };
  if (/^attached_(pumpkin|melon)_stem$/.test(id)) return { kind: 'fixed', rgb: [224, 199, 28] };
  if (/^(pumpkin|melon)_stem$/.test(id)) {
    const age = Number(state.age ?? 7);
    return { kind: 'fixed', rgb: [age * 32, 255 - age * 8, age * 4] };
  }
  return { kind: 'grass' };
}

/** A tint from an item definition's "tints" entry (1.21.4+). */
export function itemTintFrom(entry: unknown): Tint | null {
  if (!isObj(entry) || typeof entry.type !== 'string') return null;
  const type = entry.type.replace(/^minecraft:/, '');
  const color = (v: unknown): RGB | null => {
    if (typeof v === 'number' && Number.isFinite(v)) return rgbOf(v >>> 0);
    if (Array.isArray(v) && v.length >= 3 && v.every((n) => typeof n === 'number')) return [Math.round(v[0] * 255), Math.round(v[1] * 255), Math.round(v[2] * 255)];
    return null;
  };
  switch (type) {
    case 'grass':
      return { kind: 'grass' };
    case 'constant': {
      const c = color(entry.value);
      return c ? { kind: 'fixed', rgb: c } : null;
    }
    default: {
      const c = color(entry.default);
      return c ? { kind: 'fixed', rgb: c } : null;
    }
  }
}

/** Item tints of versions before item definitions (ItemColors). */
export function legacyItemTint(itemId: string, tintindex: number): Tint | null {
  if (/^leather_(helmet|chestplate|leggings|boots|horse_armor)$/.test(itemId) && tintindex === 0) return { kind: 'fixed', rgb: rgbOf(0xa06540) };
  if (/^(potion|splash_potion|lingering_potion|tipped_arrow)$/.test(itemId) && tintindex === 0) return { kind: 'fixed', rgb: rgbOf(0x385dc6) };
  if (/^(grass_block|grass|tall_grass|fern|large_fern|short_grass)$/.test(itemId)) return { kind: 'grass' };
  if (FOLIAGE_BLOCKS.test(itemId)) return { kind: 'fixed', rgb: rgbOf(0x48b518) };
  if (itemId === 'birch_leaves') return { kind: 'fixed', rgb: rgbOf(0x80a755) };
  if (itemId === 'spruce_leaves') return { kind: 'fixed', rgb: rgbOf(0x619961) };
  if (itemId === 'lily_pad' || itemId === 'waterlily') return { kind: 'fixed', rgb: rgbOf(0x71c35c) };
  return null;
}

// ---------------------------------------------------------------------------------------------
// Item model definitions (assets/minecraft/items/*.json, 1.21.4+)

export type ItemLeaf =
  | { kind: 'model'; model: string; tints: (Tint | null)[] }
  | { kind: 'special'; base: string | null; type: string; texture?: string }
  | { kind: 'empty' };

export interface ItemOption {
  /** Short description of when the game shows it, e.g. 'Pulling 1', 'Blocking', 'Christmas' */
  label: string;
  /** Models drawn together (composite items like beds have several), with their offset in blocks */
  leaves: { leaf: ItemLeaf; offset: Vec3 }[];
}

function leafKey(o: ItemOption): string {
  return JSON.stringify(o.leaves.map((l) => [l.leaf, l.offset]));
}

/** Every distinct look of an item definition, with labels for the states that pick them. */
export function itemOptions(def: unknown): ItemOption[] {
  const root = isObj(def) ? def.model : undefined;
  const out: ItemOption[] = [];
  const seen = new Set<string>();
  const add = (o: ItemOption) => {
    const k = leafKey(o);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(o);
  };
  const walk = (node: unknown, labels: string[], offset: Vec3): ItemOption[] => {
    if (!isObj(node) || typeof node.type !== 'string') return [];
    const type = node.type.replace(/^minecraft:/, '');
    const off = translationOf(node.transformation, offset);
    const label = labels.filter(Boolean).join(' · ');
    switch (type) {
      case 'model': {
        if (typeof node.model !== 'string') return [];
        const tints = Array.isArray(node.tints) ? node.tints.map(itemTintFrom) : [];
        return [{ label, leaves: [{ leaf: { kind: 'model', model: node.model, tints }, offset: off }] }];
      }
      case 'special': {
        const sm = isObj(node.model) ? node.model : {};
        const stype = typeof sm.type === 'string' ? sm.type.replace(/^minecraft:/, '') : 'special';
        const texture = typeof sm.texture === 'string' ? sm.texture : undefined;
        return [{ label, leaves: [{ leaf: { kind: 'special', base: typeof node.base === 'string' ? node.base : null, type: stype, texture }, offset: off }] }];
      }
      case 'empty':
        return [{ label, leaves: [{ leaf: { kind: 'empty' }, offset: off }] }];
      case 'composite': {
        const parts = (Array.isArray(node.models) ? node.models : []).map((m) => walk(m, [], off)[0]).filter(Boolean);
        return parts.length ? [{ label, leaves: parts.flatMap((p) => p.leaves) }] : [];
      }
      case 'condition':
        return [...walk(node.on_false, [...labels, ''], off), ...walk(node.on_true, [...labels, conditionLabel(node)], off)];
      case 'select': {
        const res: ItemOption[] = [];
        if (Array.isArray(node.cases))
          for (const c of node.cases) if (isObj(c)) res.push(...walk(c.model, [...labels, whenLabel(c.when)], off));
        if (node.fallback) res.unshift(...walk(node.fallback, labels, off));
        return res;
      }
      case 'range_dispatch': {
        const res: ItemOption[] = [];
        if (node.fallback) res.push(...walk(node.fallback, labels, off));
        if (Array.isArray(node.entries)) for (const e of node.entries) if (isObj(e)) res.push(...walk(e.model, labels, off));
        return res;
      }
      case 'bundle/selected_item':
        return [];
      default:
        return [];
    }
  };
  for (const o of walk(root, [], [0, 0, 0])) add(o);
  return out;
}

function translationOf(t: unknown, base: Vec3): Vec3 {
  if (!isObj(t) || !Array.isArray(t.translation)) return base;
  const v = vec3(t.translation);
  return v ? [base[0] + v[0], base[1] + v[1], base[2] + v[2]] : base;
}

function prettyWord(s: string): string {
  const w = s.replace(/^minecraft:/, '').replace(/[_/]+/g, ' ').trim();
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function whenLabel(when: unknown): string {
  if (typeof when === 'string') return prettyWord(when);
  if (Array.isArray(when) && when.length) {
    const s = when.map((w) => String(w));
    if (s.includes('12-24') || s.includes('12-25')) return 'Christmas';
    return prettyWord(s[0]);
  }
  return '';
}

function conditionLabel(node: Record<string, unknown>): string {
  const p = typeof node.property === 'string' ? node.property.replace(/^minecraft:/, '') : '';
  const map: Record<string, string> = {
    using_item: 'In use',
    broken: 'Broken',
    damaged: 'Damaged',
    has_component: 'With component',
    fishing_rod_cast: 'Cast',
    bundle_has_selected_item: 'Open',
    selected: 'Selected',
    carried: 'Carried',
    extended_view: 'Extended',
    keybind_down: 'Key held',
    view_entity: 'Viewing',
    component: 'Linked',
  };
  return map[p] ?? (p ? prettyWord(p) : 'On');
}

/** Names of models used only as other items' variants (bow_pulling_0...), for pre-1.21.4 item lists. */
export function legacyOverrideModels(json: unknown): string[] {
  if (!isObj(json) || !Array.isArray(json.overrides)) return [];
  return json.overrides.filter(isObj).map((o) => o.model).filter((m): m is string => typeof m === 'string');
}
