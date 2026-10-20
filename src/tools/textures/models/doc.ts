// Editable Java block / item model: built from a model resolved through its parent chain (the game's
// own rules, java-models.ts), edited cube by cube, and written back as a self-contained model file
// (no parent, every texture variable, the merged display transforms) that keeps any other keys the
// pack's file had. Pure, no DOM.

import { DIRS, defaultFaceUv, type Dir, type UV4, type Vec3 } from '../../../shared/models/geometry';
import { faceTexture, isIdentityTransform, parseDisplayTransform, parseElements, type DisplayTransform, type JavaElementRotation, type ResolvedModel } from '../../../shared/models/java-models';

export type { DisplayTransform } from '../../../shared/models/java-models';

export interface EditFace {
  /** Texture variable, '#side' */
  texture: string;
  /** Texture area (1/16 of the texture, [u1, v1, u2, v2]); none = follows the cube (the game's default) */
  uv?: UV4;
  rotation?: 0 | 90 | 180 | 270;
  cullface?: Dir;
  tintindex?: number;
  /** Other keys of the face in the file */
  extra?: Record<string, unknown>;
}

export interface EditElement {
  /** Name shown in the cube list (written as "name", which the game ignores) */
  name?: string;
  from: Vec3;
  to: Vec3;
  rotation?: JavaElementRotation;
  /** false: no directional shading */
  shade?: boolean;
  shadeDir?: Dir;
  faces: Partial<Record<Dir, EditFace>>;
  /** Other keys of the element in the file (light_emission...) */
  extra?: Record<string, unknown>;
}

export interface EditModel {
  /** Texture variables: name -> texture ref or '#other' */
  textures: Record<string, string>;
  /** Variables whose sprite is forced translucent (26.1+ sprite objects) */
  translucent: string[];
  elements: EditElement[];
  /** Display transforms by slot name as the file writes them ('gui', 'thirdperson_righthand'...) */
  display: Record<string, DisplayTransform>;
  /** "gui_light" (undefined: the game's default, side) */
  guiLight?: 'side' | 'front';
  /** "ambientocclusion" (undefined: on) */
  ambientOcclusion?: boolean;
  /** Other top-level keys of the pack's file (legacy "overrides", "credit"...) */
  extra: Record<string, unknown>;
}

const OWN_KEYS = new Set(['parent', 'textures', 'elements', 'display', 'gui_light', 'ambientocclusion']);
const ELEMENT_KEYS = new Set(['name', 'from', 'to', 'rotation', 'shade', 'shade_direction_override', 'faces']);
const FACE_KEYS = new Set(['uv', 'texture', 'cullface', 'rotation', 'tintindex']);

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function rest(o: Record<string, unknown>, known: Set<string>): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  let any = false;
  for (const [k, v] of Object.entries(o)) {
    if (known.has(k)) continue;
    out[k] = v;
    any = true;
  }
  return any ? out : undefined;
}

export function emptyModel(): EditModel {
  return { textures: {}, translucent: [], elements: [], display: {}, extra: {} };
}

/**
 * The editable form of a model: its resolved textures, elements and display (as the game merges them
 * from the parent chain), plus the keys of `own` (the model's own file) that the editor doesn't handle.
 */
export function modelFromResolved(model: ResolvedModel, own: unknown): EditModel {
  const ownObj = isObj(own) ? own : {};
  const rawEls = Array.isArray(ownObj.elements) ? ownObj.elements.filter(isObj) : null;
  // extras of the file's own elements line up with the parsed ones when every element was readable
  const extrasFor = rawEls && model.elements && rawEls.length === model.elements.length && model.chain[0] === model.id ? rawEls : null;
  const elements: EditElement[] = (model.elements ?? []).map((el, i) => {
    const raw = extrasFor?.[i];
    const faces: Partial<Record<Dir, EditFace>> = {};
    for (const d of DIRS) {
      const f = el.faces[d];
      if (!f) continue;
      const rawFace = raw && isObj(raw.faces) && isObj((raw.faces as Record<string, unknown>)[d]) ? ((raw.faces as Record<string, unknown>)[d] as Record<string, unknown>) : null;
      const face: EditFace = { texture: f.texture.startsWith('#') ? f.texture : `#${f.texture}` };
      if (f.uv) face.uv = [...f.uv];
      const r = f.rotation ? (((Math.round(f.rotation / 90) * 90) % 360) + 360) % 360 : 0;
      if (r) face.rotation = r as 90 | 180 | 270;
      if (f.cullface) face.cullface = f.cullface;
      if (f.tintindex !== undefined && f.tintindex >= 0) face.tintindex = f.tintindex;
      const fx = rawFace ? rest(rawFace, FACE_KEYS) : undefined;
      if (fx) face.extra = fx;
      faces[d] = face;
    }
    const out: EditElement = { from: [...el.from], to: [...el.to], faces };
    if (raw && typeof raw.name === 'string' && raw.name.trim()) out.name = raw.name.trim().slice(0, 60);
    if (el.rotation) out.rotation = { ...el.rotation, origin: [...el.rotation.origin] };
    if (el.shade === false) out.shade = false;
    if (el.shadeDir) out.shadeDir = el.shadeDir;
    const ex = raw ? rest(raw, ELEMENT_KEYS) : undefined;
    if (ex) out.extra = ex;
    return out;
  });
  const display: Record<string, DisplayTransform> = {};
  for (const [k, v] of Object.entries(model.display ?? {})) display[k] = cloneTransform(v);
  const doc: EditModel = {
    textures: { ...model.textures },
    translucent: [...model.translucent],
    elements,
    display,
    extra: rest(ownObj, OWN_KEYS) ?? {},
  };
  if (model.guiLight) doc.guiLight = model.guiLight;
  if (!model.ambientOcclusion) doc.ambientOcclusion = false;
  return doc;
}

export function cloneTransform(t: DisplayTransform): DisplayTransform {
  return { rotation: [...t.rotation], translation: [...t.translation], scale: [...t.scale] };
}

export function cloneModel(m: EditModel): EditModel {
  return structuredClone(m);
}

// ---------------------------------------------------------------------------------------------
// Writing

/** Rounds away float dust (4 decimals is far finer than the game's 1/16 grid needs). */
export function tidy(n: number): number {
  const r = Math.round(n * 10000) / 10000;
  return Object.is(r, -0) ? 0 : r;
}

const v3 = (v: Vec3): Vec3 => [tidy(v[0]), tidy(v[1]), tidy(v[2])];

function faceJson(f: EditFace): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  if (f.uv) o.uv = f.uv.map(tidy);
  o.texture = f.texture.startsWith('#') ? f.texture : `#${f.texture}`;
  if (f.rotation) o.rotation = f.rotation;
  if (f.cullface) o.cullface = f.cullface;
  if (f.tintindex !== undefined && f.tintindex >= 0) o.tintindex = f.tintindex;
  return { ...o, ...(f.extra ?? {}) };
}

function elementJson(e: EditElement): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  if (e.name) o.name = e.name;
  o.from = v3(e.from);
  o.to = v3(e.to);
  if (e.rotation) {
    const r = e.rotation;
    if (r.axis) {
      const rot: Record<string, unknown> = { angle: tidy(r.angle ?? 0), axis: r.axis, origin: v3(r.origin) };
      if (r.rescale) rot.rescale = true;
      o.rotation = rot;
    } else {
      const rot: Record<string, unknown> = { x: tidy(r.x ?? 0), y: tidy(r.y ?? 0), z: tidy(r.z ?? 0), origin: v3(r.origin) };
      if (r.rescale) rot.rescale = true;
      o.rotation = rot;
    }
  }
  if (e.shade === false) o.shade = false;
  if (e.shadeDir) o.shade_direction_override = e.shadeDir;
  const faces: Record<string, unknown> = {};
  for (const d of DIRS) {
    const f = e.faces[d];
    if (f) faces[d] = faceJson(f);
  }
  o.faces = faces;
  return { ...o, ...(e.extra ?? {}) };
}

/** The model as a JSON object for the pack (self-contained: no parent). */
export function modelJson(m: EditModel): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const extra = { ...m.extra };
  // keys that usually come first stay first
  for (const k of ['credit', 'loader']) {
    if (k in extra) {
      out[k] = extra[k];
      delete extra[k];
    }
  }
  if (m.guiLight) out.gui_light = m.guiLight;
  if (m.ambientOcclusion === false) out.ambientocclusion = false;
  const textures: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(m.textures)) textures[k] = m.translucent.includes(k) ? { sprite: v, force_translucent: true } : v;
  if (Object.keys(textures).length) out.textures = textures;
  out.elements = m.elements.map(elementJson);
  const display: Record<string, unknown> = {};
  for (const [slot, t] of Object.entries(m.display)) {
    if (isIdentityTransform(t)) continue;
    display[slot] = { rotation: v3(t.rotation), translation: v3(t.translation), scale: v3(t.scale) };
  }
  if (Object.keys(display).length) out.display = display;
  return { ...out, ...extra };
}

/** JSON text laid out like the game's own files: nested objects indented, number lists on one line. */
export function prettyJson(value: unknown, indent = '  '): string {
  const walk = (v: unknown, pad: string): string => {
    if (Array.isArray(v)) {
      if (v.every((x) => x === null || typeof x !== 'object')) return `[${v.map((x) => JSON.stringify(x)).join(', ')}]`;
      if (!v.length) return '[]';
      const inner = pad + indent;
      return `[\n${v.map((x) => inner + walk(x, inner)).join(',\n')}\n${pad}]`;
    }
    if (isObj(v)) {
      const keys = Object.keys(v).filter((k) => v[k] !== undefined);
      if (!keys.length) return '{}';
      const inner = pad + indent;
      return `{\n${keys.map((k) => `${inner}${JSON.stringify(k)}: ${walk(v[k], inner)}`).join(',\n')}\n${pad}}`;
    }
    return JSON.stringify(v) ?? 'null';
  };
  return walk(value, '') + '\n';
}

export function modelText(m: EditModel): string {
  return prettyJson(modelJson(m));
}

/** Reads a model file the editor wrote (or any self-contained model) back. */
export function modelFromJson(json: unknown, id = 'minecraft:custom'): EditModel {
  const resolved = resolveOwn(json, id);
  return modelFromResolved(resolved, json);
}

/** A model file on its own (no parent lookup) in the resolved shape. */
function resolveOwn(json: unknown, id: string): ResolvedModel {
  const textures: Record<string, string> = {};
  const translucent: string[] = [];
  const o = isObj(json) ? json : {};
  if (isObj(o.textures))
    for (const [k, v] of Object.entries(o.textures)) {
      if (typeof v === 'string') textures[k] = v;
      else if (isObj(v) && typeof v.sprite === 'string') {
        textures[k] = v.sprite;
        if (v.force_translucent === true) translucent.push(k);
      }
    }
  const display: Record<string, DisplayTransform> = {};
  if (isObj(o.display))
    for (const [k, v] of Object.entries(o.display)) {
      const d = parseDisplayTransform(v);
      if (d) display[k] = d;
    }
  return {
    id,
    chain: [id],
    textures,
    translucent,
    elements: parseElements(o.elements) ?? [],
    builtin: null,
    ambientOcclusion: o.ambientocclusion !== false,
    missing: [],
    display,
    guiLight: o.gui_light === 'front' || o.gui_light === 'side' ? o.gui_light : undefined,
  };
}

// ---------------------------------------------------------------------------------------------
// Baking for the 3D view

/** The editable model in the resolved shape bakeModel() takes (texture variables resolved as the game does). */
export function toResolved(m: EditModel, id = 'minecraft:editing'): ResolvedModel {
  return {
    id,
    chain: [id],
    textures: { ...m.textures },
    translucent: [...m.translucent],
    elements: m.elements.map((e) => ({
      from: e.from,
      to: e.to,
      rotation: e.rotation,
      shade: e.shade === false ? false : undefined,
      shadeDir: e.shadeDir,
      faces: Object.fromEntries(
        DIRS.filter((d) => e.faces[d]).map((d) => {
          const f = e.faces[d]!;
          return [d, { texture: f.texture, uv: f.uv, rotation: f.rotation, cullface: f.cullface, tintindex: f.tintindex }];
        }),
      ),
    })),
    builtin: null,
    ambientOcclusion: m.ambientOcclusion !== false,
    missing: [],
    display: m.display,
    guiLight: m.guiLight,
  };
}

/** Texture ref a face shows (null when its variable isn't set). */
export function faceRef(m: EditModel, face: EditFace, dir: Dir): string | null {
  return faceTexture(toResolvedTexturesOnly(m), face.texture, dir).ref;
}

function toResolvedTexturesOnly(m: EditModel): ResolvedModel {
  return { id: '', chain: [], textures: m.textures, translucent: [], elements: null, builtin: null, ambientOcclusion: true, missing: [] };
}

/** The uv a face shows: its own, else the game's default for where the cube is. */
export function effectiveUv(e: EditElement, dir: Dir): UV4 {
  return e.faces[dir]?.uv ?? defaultFaceUv(dir, e.from, e.to);
}

// ---------------------------------------------------------------------------------------------
// Edits (each mutates the model it is given; callers keep their own copies for undo)

export const ALL_FACES: readonly Dir[] = DIRS;

/** Variable a new face uses: the most used one, else the first one that isn't the particle. */
export function mainTextureVar(m: EditModel): string {
  const count = new Map<string, number>();
  for (const e of m.elements) for (const f of Object.values(e.faces)) if (f) count.set(f.texture, (count.get(f.texture) ?? 0) + 1);
  let best = '';
  let n = 0;
  for (const [k, c] of count) if (c > n) [best, n] = [k, c];
  if (best) return best;
  const keys = Object.keys(m.textures);
  for (const pref of ['all', 'texture', 'side', 'layer0', 'cross', 'plant', 'top']) if (keys.includes(pref)) return `#${pref}`;
  const first = keys.find((k) => k !== 'particle') ?? keys[0];
  return first ? `#${first}` : '#texture';
}

export function newElement(m: EditModel, opts: { from?: Vec3; to?: Vec3; texture?: string } = {}): EditElement {
  const texture = opts.texture ?? mainTextureVar(m);
  const faces: Partial<Record<Dir, EditFace>> = {};
  for (const d of DIRS) faces[d] = { texture };
  return { from: opts.from ?? [6, 0, 6], to: opts.to ?? [10, 4, 10], faces };
}

export function addElement(m: EditModel, el: EditElement, at = m.elements.length): number {
  const i = Math.max(0, Math.min(m.elements.length, at));
  m.elements.splice(i, 0, el);
  return i;
}

export function duplicateElement(m: EditModel, i: number): number {
  const src = m.elements[i];
  if (!src) return -1;
  const copy = structuredClone(src);
  if (copy.name) copy.name = `${copy.name} copy`.slice(0, 60);
  m.elements.splice(i + 1, 0, copy);
  return i + 1;
}

export function deleteElement(m: EditModel, i: number): void {
  if (i >= 0 && i < m.elements.length) m.elements.splice(i, 1);
}

/** Moves a cube up or down the list (draw order). Returns its new index. */
export function reorderElement(m: EditModel, i: number, delta: number): number {
  const j = Math.max(0, Math.min(m.elements.length - 1, i + delta));
  if (j === i || !m.elements[i]) return i;
  const [el] = m.elements.splice(i, 1);
  m.elements.splice(j, 0, el);
  return j;
}

/** Moves a cube (and its rotation origin) by a distance. */
export function moveElement(m: EditModel, i: number, delta: Vec3): void {
  const e = m.elements[i];
  if (!e) return;
  for (let a = 0; a < 3; a++) {
    e.from[a] += delta[a];
    e.to[a] += delta[a];
    if (e.rotation) e.rotation.origin[a] += delta[a];
  }
}

/** Sets one corner coordinate keeping from <= to (the corners swap when a face is dragged past the other). */
export function setExtent(m: EditModel, i: number, axis: 0 | 1 | 2, side: 'from' | 'to', value: number): void {
  const e = m.elements[i];
  if (!e) return;
  e[side][axis] = value;
  if (e.from[axis] > e.to[axis]) {
    const t = e.from[axis];
    e.from[axis] = e.to[axis];
    e.to[axis] = t;
  }
}

/** Position (from) and size, the way the numeric fields show a cube. */
export function setPositionSize(m: EditModel, i: number, pos: Vec3, size: Vec3): void {
  const e = m.elements[i];
  if (!e) return;
  const old = [...e.from] as Vec3;
  for (let a = 0; a < 3; a++) {
    const s = Math.max(0, size[a]);
    e.from[a] = pos[a];
    e.to[a] = pos[a] + s;
    if (e.rotation) e.rotation.origin[a] += pos[a] - old[a];
  }
}

/** Sets (null: removes) a cube's rotation. */
export function setRotation(m: EditModel, i: number, r: JavaElementRotation | null): void {
  const e = m.elements[i];
  if (!e) return;
  if (r) e.rotation = { ...r, origin: [...r.origin] };
  else delete e.rotation;
}

export function setFace(m: EditModel, i: number, dir: Dir, patch: Partial<EditFace> | null): void {
  const e = m.elements[i];
  if (!e) return;
  if (patch === null) {
    delete e.faces[dir];
    return;
  }
  const cur = e.faces[dir] ?? { texture: mainTextureVar(m) };
  const next: EditFace = { ...cur, ...patch };
  for (const k of Object.keys(patch) as (keyof EditFace)[]) if (patch[k] === undefined) delete next[k];
  e.faces[dir] = next;
}

/** A new texture variable for a texture ref (reuses one that already points at it). */
export function textureVarFor(m: EditModel, ref: string): string {
  for (const [k, v] of Object.entries(m.textures)) if (v === ref && k !== 'particle') return `#${k}`;
  const base =
    ref
      .replace(/^.*[:/]/, '')
      .replace(/[^a-z0-9_]+/gi, '_')
      .toLowerCase()
      .slice(0, 32) || 'texture';
  let name = base;
  for (let n = 2; name in m.textures; n++) name = `${base}_${n}`;
  m.textures[name] = ref;
  if (!m.textures.particle) m.textures.particle = `#${name}`;
  return `#${name}`;
}

/** Drops texture variables nothing uses (the particle and anything another variable points at stay). */
export function pruneTextures(m: EditModel): void {
  const used = new Set<string>(['particle']);
  const mark = (v: string) => {
    let key = v.startsWith('#') ? v.slice(1) : v;
    for (let n = 0; n < 16 && !used.has(key); n++) {
      used.add(key);
      const next = m.textures[key];
      if (!next?.startsWith('#')) break;
      key = next.slice(1);
    }
  };
  for (const e of m.elements) for (const f of Object.values(e.faces)) if (f) mark(f.texture);
  const p = m.textures.particle;
  if (p?.startsWith('#')) mark(p);
  // layer textures of generated items are read by the game by name
  for (const k of Object.keys(m.textures)) if (/^layer\d+$/.test(k)) used.add(k);
  for (const k of Object.keys(m.textures)) if (!used.has(k)) delete m.textures[k];
  m.translucent = m.translucent.filter((k) => k in m.textures);
}

export function setDisplay(m: EditModel, slot: string, t: DisplayTransform | null): void {
  if (!t) delete m.display[slot];
  else m.display[slot] = cloneTransform(t);
}

/** Size of a cube along each axis. */
export function sizeOf(e: EditElement): Vec3 {
  return [e.to[0] - e.from[0], e.to[1] - e.from[1], e.to[2] - e.from[2]];
}

/** A short name for a cube in lists: its own name, else "Cube 3". */
export function elementLabel(m: EditModel, i: number): string {
  return m.elements[i]?.name || `Cube ${i + 1}`;
}
