// Bedrock entity geometry (models/entity/*.geo.json, models/mobs.json): parses every format the
// vanilla files use (1.8 / 1.10 objects keyed by identifier, "minecraft:geometry" arrays from 1.12 on),
// follows "geometry.child:geometry.parent" inheritance, applies static rest poses from animations
// (e.g. a spider's leg pose) and turns the bones into the same part model the Java mobs use, so one
// baker and one box UV unwrap serve both editions. Bedrock space is y up with the feet at 0; the part
// model is Java's (y down, feet at 24). Pure, no DOM.

import type { Dir, Vec3 } from './geometry';
import type { EntityCube, EntityModel, EntityPart } from './entity-models';
import { evalMolang } from './molang';

export interface GeoCube {
  origin: Vec3;
  size: Vec3;
  /** Box UV offset, or a texture rectangle per face ([u, v] and [w, h]) */
  uv: [number, number] | Partial<Record<Dir, { uv: [number, number]; size: [number, number] }>>;
  inflate?: number;
  mirror?: boolean;
  rotation?: Vec3;
  pivot?: Vec3;
}

export interface GeoBone {
  name: string;
  parent?: string;
  pivot: Vec3;
  rotation?: Vec3;
  mirror?: boolean;
  inflate?: number;
  cubes: GeoCube[];
  /** 1.8 models sometimes rest in another pose than they are modelled in */
  bindPoseRotation?: Vec3;
  neverRender?: boolean;
  /** Replaces the inherited bone of the same name instead of adding to it */
  reset?: boolean;
  /** The file gives the pivot (a child geometry's bone without one keeps the inherited pivot) */
  hasPivot?: boolean;
}

export interface GeoDef {
  id: string;
  parent?: string;
  texSize?: [number, number];
  bones: GeoBone[];
}

const num = (v: unknown, fb = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fb);
const vec = (v: unknown, fb: Vec3 = [0, 0, 0]): Vec3 => (Array.isArray(v) && v.length >= 3 ? [num(v[0]), num(v[1]), num(v[2])] : fb);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const DIR_NAMES: Dir[] = ['north', 'south', 'east', 'west', 'up', 'down'];

function parseCube(c: Record<string, unknown>): GeoCube | null {
  if (!Array.isArray(c.size) || !Array.isArray(c.origin)) return null;
  let uv: GeoCube['uv'] = [0, 0];
  if (Array.isArray(c.uv)) uv = [num(c.uv[0]), num(c.uv[1])];
  else if (isObj(c.uv)) {
    const faces: Partial<Record<Dir, { uv: [number, number]; size: [number, number] }>> = {};
    for (const d of DIR_NAMES) {
      const f = c.uv[d];
      if (!isObj(f) || !Array.isArray(f.uv)) continue;
      const size = Array.isArray(f.uv_size) ? f.uv_size : [0, 0];
      faces[d] = { uv: [num(f.uv[0]), num(f.uv[1])], size: [num(size[0]), num(size[1])] };
    }
    uv = faces;
  }
  return {
    origin: vec(c.origin),
    size: vec(c.size),
    uv,
    inflate: typeof c.inflate === 'number' ? c.inflate : undefined,
    mirror: typeof c.mirror === 'boolean' ? c.mirror : undefined,
    rotation: Array.isArray(c.rotation) ? vec(c.rotation) : undefined,
    pivot: Array.isArray(c.pivot) ? vec(c.pivot) : undefined,
  };
}

function parseBones(list: unknown): GeoBone[] {
  if (!Array.isArray(list)) return [];
  const out: GeoBone[] = [];
  for (const b of list) {
    if (!isObj(b) || typeof b.name !== 'string') continue;
    out.push({
      name: b.name,
      parent: typeof b.parent === 'string' ? b.parent : undefined,
      pivot: vec(b.pivot),
      rotation: Array.isArray(b.rotation) ? vec(b.rotation) : undefined,
      mirror: typeof b.mirror === 'boolean' ? b.mirror : undefined,
      inflate: typeof b.inflate === 'number' ? b.inflate : undefined,
      cubes: Array.isArray(b.cubes) ? b.cubes.filter(isObj).map(parseCube).filter((c): c is GeoCube => !!c) : [],
      bindPoseRotation: Array.isArray(b.bind_pose_rotation) ? vec(b.bind_pose_rotation) : undefined,
      neverRender: b.neverRender === true || b.never_render === true,
      reset: b.reset === true || undefined,
      hasPivot: Array.isArray(b.pivot) || undefined,
    });
  }
  return out;
}

/** Every geometry defined in one geo file, keyed by identifier. */
export function parseGeoFile(json: unknown): Map<string, GeoDef> {
  const out = new Map<string, GeoDef>();
  if (!isObj(json)) return out;
  const list = json['minecraft:geometry'];
  if (Array.isArray(list)) {
    for (const g of list) {
      if (!isObj(g) || !isObj(g.description) || typeof g.description.identifier !== 'string') continue;
      const [id, parent] = g.description.identifier.split(':');
      const d = g.description;
      const tw = num(d.texture_width, 0);
      const th = num(d.texture_height, 0);
      out.set(id, { id, parent, texSize: tw && th ? [tw, th] : undefined, bones: parseBones(g.bones) });
    }
    return out;
  }
  for (const [key, g] of Object.entries(json)) {
    if (!key.startsWith('geometry.') || !isObj(g)) continue;
    const [id, parent] = key.split(':');
    const tw = num(g.texturewidth, 0);
    const th = num(g.textureheight, 0);
    out.set(id, { id, parent, texSize: tw && th ? [tw, th] : undefined, bones: parseBones(g.bones) });
  }
  return out;
}

/**
 * A geometry with its parents merged in: a child bone of a parent bone's name takes its place and adds
 * its boxes to the inherited ones (a sheep's wool over its body), or replaces them with `reset`.
 */
export function flattenGeo(id: string, lookup: (id: string) => GeoDef | undefined): GeoDef | null {
  const chain: GeoDef[] = [];
  const seen = new Set<string>();
  let cur = lookup(id);
  while (cur && !seen.has(cur.id)) {
    chain.unshift(cur);
    seen.add(cur.id);
    cur = cur.parent ? lookup(cur.parent) : undefined;
  }
  if (!chain.length) return null;
  const bones = new Map<string, GeoBone>();
  let texSize: [number, number] | undefined;
  for (const g of chain) {
    if (g.texSize) texSize = g.texSize;
    for (const b of g.bones) {
      const old = bones.get(b.name);
      if (!old) {
        bones.set(b.name, b);
        continue;
      }
      // what the child bone doesn't say it inherits (armour bones give only an inflate, or `reset`)
      const merged: GeoBone = {
        ...b,
        pivot: b.hasPivot ? b.pivot : old.pivot,
        hasPivot: b.hasPivot ?? old.hasPivot,
        parent: b.parent ?? old.parent,
        rotation: b.rotation ?? old.rotation,
        bindPoseRotation: b.bindPoseRotation ?? old.bindPoseRotation,
      };
      if (b.reset) bones.set(b.name, merged);
      else {
        // the inherited boxes keep their bone's inflate and mirror, unless the child bone sets an inflate
        const kept = old.cubes.map((c) => ({ ...c, inflate: b.inflate ?? c.inflate ?? old.inflate, mirror: c.mirror ?? old.mirror }));
        bones.set(b.name, { ...merged, cubes: [...kept, ...b.cubes] });
      }
    }
  }
  return { id, texSize, bones: [...bones.values()] };
}

const rad = (d: number) => (d * Math.PI) / 180;

/**
 * Turns (degrees) the game gives some bones itself, by lowercase bone name: `bone` sets the bone's
 * rotation (with its children; animations left out), `boxes` turns only the bone's own boxes.
 */
export type NativeTurns = Record<string, { bone?: Vec3; boxes?: Vec3 }>;

/**
 * Bedrock geometry as a part model in Java's model space: y flipped about 24 (feet at y 24), the same
 * x, z and rotation angles (a creeper, an iron golem, a spider with its leg pose, a cow, a goat bake to
 * the same faces and texture areas as the Java models). Bones become
 * parts nested like the bones (pivots relative to the parent), cubes with their own rotation become
 * child parts, per-face UVs keep their rectangles. `rest` poses the bones the way the entity's idle
 * animations do; `hidden` bones (render controller part visibility) are left out with their children;
 * `turns` adds the turns the game applies without them being in the files. `bind`: the geometry of the
 * entity wearing this one (armour, saddles drawn as attachables): bones of the same name sit and turn
 * like the wearer's bones.
 */
export function geoToModel(
  g: GeoDef,
  rest?: RestPose,
  fallbackTex: [number, number] = [64, 64],
  hidden?: Set<string>,
  turns?: NativeTurns,
  bind?: GeoDef,
): EntityModel {
  const tex = g.texSize ?? fallbackTex;
  if (bind) {
    const wearer = new Map(bind.bones.map((b) => [b.name.toLowerCase(), b]));
    g = {
      ...g,
      bones: g.bones.map((b) => {
        const w = wearer.get(b.name.toLowerCase());
        return w ? { ...b, pivot: w.pivot, rotation: w.rotation, bindPoseRotation: w.bindPoseRotation } : b;
      }),
    };
  }
  const byName = new Map(g.bones.map((b) => [b.name, b]));
  const kids = new Map<string, GeoBone[]>();
  const roots: GeoBone[] = [];
  for (const b of g.bones) {
    if (b.parent && byName.has(b.parent) && b.parent !== b.name) {
      let list = kids.get(b.parent);
      if (!list) kids.set(b.parent, (list = []));
      list.push(b);
    } else roots.push(b);
  }
  const jp = (p: Vec3): Vec3 => [p[0], 24 - p[1], p[2]];
  // Bedrock angles turn the way Java's do once the y flip is applied (checked against the Java models).
  const jr = (r: Vec3 | undefined): Vec3 => (r ? [rad(r[0]), rad(r[1]), rad(r[2])] : [0, 0, 0]);
  const add = (a: Vec3 | undefined, b: Vec3 | undefined): Vec3 | undefined => (!a ? b : !b ? a : [a[0] + b[0], a[1] + b[1], a[2] + b[2]]);

  const cubeOf = (c: GeoCube, bone: GeoBone, origin: Vec3): EntityCube => {
    const [w, h, d] = c.size;
    // Java space: the box from its top (y down), relative to the part's origin
    const from: Vec3 = [c.origin[0] - origin[0], 24 - (c.origin[1] + h) - origin[1], c.origin[2] - origin[2]];
    const inflate = c.inflate ?? bone.inflate;
    const mirror = c.mirror ?? bone.mirror;
    const cube: EntityCube = { uv: [0, 0], from, size: [w, h, d], inflate: inflate || undefined, mirror: mirror || undefined };
    if (Array.isArray(c.uv)) cube.uv = c.uv;
    else {
      // Bedrock face names to the box layout's polygons (Java model space has y down: its 'down'
      // polygon is the visual top). Rectangles as [u1, v1, u2, v2] like the box layout passes them.
      const f = c.uv;
      const rect = (r: { uv: [number, number]; size: [number, number] }): [number, number, number, number] => [r.uv[0], r.uv[1], r.uv[0] + r.size[0], r.uv[1] + r.size[1]];
      const faceUv: EntityCube['faceUv'] = {};
      const faces: Dir[] = [];
      const map: [Dir, Dir][] = [
        ['up', 'down'],
        ['down', 'up'],
        ['north', 'north'],
        ['south', 'south'],
        ['west', 'west'],
        ['east', 'east'],
      ];
      for (const [bed, java] of map) {
        const r = f[bed];
        if (!r) continue;
        faces.push(java);
        faceUv[java] = rect(r);
      }
      cube.faceUv = faceUv;
      cube.faces = faces;
    }
    return cube;
  };

  /** A bone's rotation (degrees) and offset (pixels, Bedrock axes) after the rest animations. */
  const posed = (b: GeoBone): { rot: Vec3; pos: Vec3 } => {
    // `this` starts at the bone's own rotation and each animation adds to it ("90 - this" turns the
    // bone to 90, "-this" undoes it).
    const fixed = turns?.[b.name.toLowerCase()]?.bone;
    const rot: Vec3 = b.rotation ? [...b.rotation] : [0, 0, 0];
    // for positions `this` starts at the pivot measured from the parent's (from 0, 24, 0 for a root
    // bone): "-14 - this" on a root bone keeps a pivot at y 10; the offset is what the animations add
    const up = (b.parent && b.parent !== b.name && byName.get(b.parent)?.pivot) || [0, 24, 0];
    const at: Vec3 = [b.pivot[0] - up[0], b.pivot[1] - up[1], b.pivot[2] - up[2]];
    const pos: Vec3 = [...at];
    const ch = rest?.get(b.name.toLowerCase());
    const apply = (cur: Vec3, list: Channel[]) => {
      for (const c of list)
        for (let k = 0; k < 3; k++) {
          const v = evalMolang(c[k], { this: cur[k] });
          if (v !== null) cur[k] += v;
        }
    };
    if (ch) {
      apply(rot, ch.rotation);
      apply(pos, ch.position);
    }
    return { rot: fixed ?? rot, pos: [pos[0] - at[0], pos[1] - at[1], pos[2] - at[2]] };
  };

  const walk = (b: GeoBone, parentPivot: Vec3, parentShift: Vec3): EntityPart => {
    const { rot, pos } = posed(b);
    // an animated position moves the bone and everything under it
    const shift: Vec3 = [parentShift[0] + pos[0], parentShift[1] - pos[1], parentShift[2] + pos[2]];
    const pivot = jp(b.pivot);
    const moved: Vec3 = [pivot[0] + shift[0], pivot[1] + shift[1], pivot[2] + shift[2]];
    const parentMoved: Vec3 = [parentPivot[0] + parentShift[0], parentPivot[1] + parentShift[1], parentPivot[2] + parentShift[2]];
    const part: EntityPart = {
      name: b.name,
      pose: { offset: [moved[0] - parentMoved[0], moved[1] - parentMoved[1], moved[2] - parentMoved[2]], rotation: jr(rot) },
      cubes: [],
      children: [],
    };
    if (!b.neverRender && b.cubes.length) {
      // the bind pose turns the bone's own boxes only, not its children (a sheep's body, not its legs)
      const turn = add(b.bindPoseRotation, turns?.[b.name.toLowerCase()]?.boxes);
      let into = part;
      if (turn) {
        into = { name: `${b.name}~0`, pose: { offset: [0, 0, 0], rotation: jr(turn) }, cubes: [], children: [] };
        part.children!.push(into);
      }
      for (const c of b.cubes) {
        if (c.rotation && (c.rotation[0] || c.rotation[1] || c.rotation[2])) {
          // without a pivot a cube turns about its centre
          const cp = jp(c.pivot ?? [c.origin[0] + c.size[0] / 2, c.origin[1] + c.size[1] / 2, c.origin[2] + c.size[2] / 2]);
          into.children!.push({
            name: `${b.name}~${into.children!.length + 1}`,
            pose: { offset: [cp[0] - pivot[0], cp[1] - pivot[1], cp[2] - pivot[2]], rotation: jr(c.rotation) },
            cubes: [cubeOf(c, b, cp)],
          });
        } else into.cubes!.push(cubeOf(c, b, pivot));
      }
    }
    for (const k of kids.get(b.name) ?? []) if (!hidden?.has(k.name.toLowerCase())) part.children!.push(walk(k, pivot, shift));
    return part;
  };
  return { texSize: tex, parts: roots.filter((r) => !hidden?.has(r.name.toLowerCase())).map((r) => walk(r, [0, 0, 0], [0, 0, 0])) };
}

// ---------------------------------------------------------------------------------------------
// Rest poses from animations

/** An animation channel: three Molang values (degrees for rotation, pixels for position). */
type Channel = [unknown, unknown, unknown];

/** Animation channels per bone, applied in order on top of the bind pose (see geoToModel). */
export type RestPose = Map<string, { rotation: Channel[]; position: Channel[] }>;

/** A channel's value at time 0: a [x, y, z] array, one value for all three, or the first keyframe. */
function channelAt0(v: unknown): Channel | null {
  if (Array.isArray(v)) return v.length >= 3 ? [v[0], v[1], v[2]] : null;
  if (typeof v === 'number' || typeof v === 'string') return [v, v, v];
  if (isObj(v)) {
    const keys = Object.keys(v)
      .map((k) => [k, Number(k)] as const)
      .filter(([, t]) => Number.isFinite(t))
      .sort((a, b) => a[1] - b[1]);
    if (!keys.length) return null;
    const first = v[keys[0][0]];
    if (isObj(first)) return channelAt0(first.post ?? first.pre);
    return channelAt0(first);
  }
  return null;
}

/** Adds an animation's bone channels (at time 0) to a rest pose. */
export function addAnimation(pose: RestPose, animation: unknown): void {
  if (!isObj(animation) || !isObj(animation.bones)) return;
  for (const [bone, ch] of Object.entries(animation.bones)) {
    if (!isObj(ch)) continue;
    const r = channelAt0(ch.rotation);
    const p = channelAt0(ch.position);
    if (!r && !p) continue;
    const key = bone.toLowerCase();
    let e = pose.get(key);
    if (!e) pose.set(key, (e = { rotation: [], position: [] }));
    if (r) e.rotation.push(r);
    if (p) e.position.push(p);
  }
}
