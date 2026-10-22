// Poses for the skin pose maker: a pose is a few angles per body part in degrees, with the same
// meaning for both sides (an arm's "raise" lifts it forwards whichever arm it is). poseTransforms()
// turns a pose into the positions and rotations of skinview3d's player parts: the body bends at the
// hips and carries the head, the arms and the cape with it, the whole player can tilt (flying), and
// the elytra wings open. Pure (three.js maths only), so the unit tests run it in Node.

import { Euler, Quaternion, Vector3 } from 'three';

export type PoseJoint = 'head' | 'body' | 'rightArm' | 'leftArm' | 'rightLeg' | 'leftLeg';
export const POSE_JOINTS: readonly PoseJoint[] = ['head', 'body', 'rightArm', 'leftArm', 'rightLeg', 'leftLeg'];

/** The three angles of a part, in degrees. Their meaning depends on the part (see JOINT_AXES). */
export type JointAngles = readonly [number, number, number];

export interface Pose {
  head: JointAngles;
  body: JointAngles;
  rightArm: JointAngles;
  leftArm: JointAngles;
  rightLeg: JointAngles;
  leftLeg: JointAngles;
  /** The whole player leans forward by this many degrees (90 lies flat, as when flying) */
  tilt: number;
  /** Elytra wings: 0 folded, 100 spread wide */
  wings: number;
  /** Extra swing of the cape away from the back, in degrees */
  cape: number;
}

export type PoseAxis = 'nod' | 'turn' | 'tilt' | 'lean' | 'twist' | 'bend' | 'raise' | 'out' | 'roll' | 'swing';

/** What each of a part's three angles does, and its range in degrees. */
export const JOINT_AXES: Record<PoseJoint, readonly { axis: PoseAxis; min: number; max: number }[]> = {
  // nod: look down (+) or up (-); turn: towards the player's left (+); tilt: head on the left shoulder (+)
  head: [
    { axis: 'nod', min: -80, max: 80 },
    { axis: 'turn', min: -90, max: 90 },
    { axis: 'tilt', min: -45, max: 45 },
  ],
  // lean: forwards (+) from the hips; twist: shoulders towards the player's left (+); bend: sideways
  body: [
    { axis: 'lean', min: -45, max: 90 },
    { axis: 'twist', min: -60, max: 60 },
    { axis: 'bend', min: -30, max: 30 },
  ],
  // raise: forwards and up (+, 180 = straight up) or backwards (-); out: away from the body; roll: about the arm
  rightArm: [
    { axis: 'raise', min: -90, max: 180 },
    { axis: 'out', min: -60, max: 180 },
    { axis: 'roll', min: -90, max: 90 },
  ],
  leftArm: [
    { axis: 'raise', min: -90, max: 180 },
    { axis: 'out', min: -60, max: 180 },
    { axis: 'roll', min: -90, max: 90 },
  ],
  // swing: forwards (+) or backwards (-); out: away from the other leg; roll: toes in or out
  rightLeg: [
    { axis: 'swing', min: -90, max: 120 },
    { axis: 'out', min: -20, max: 90 },
    { axis: 'roll', min: -45, max: 45 },
  ],
  leftLeg: [
    { axis: 'swing', min: -90, max: 120 },
    { axis: 'out', min: -20, max: 90 },
    { axis: 'roll', min: -45, max: 45 },
  ],
};

export const TILT_RANGE = { min: -30, max: 90 } as const;
export const WINGS_RANGE = { min: 0, max: 100 } as const;
export const CAPE_RANGE = { min: 0, max: 80 } as const;

const ZERO: JointAngles = [0, 0, 0];

/** Arms hang slightly away from the body, as in the game's idle pose. */
export const NEUTRAL_POSE: Pose = {
  head: ZERO,
  body: ZERO,
  rightArm: [0, 4, 0],
  leftArm: [0, 4, 0],
  rightLeg: ZERO,
  leftLeg: ZERO,
  tilt: 0,
  wings: 0,
  cape: 0,
};

export type PosePresetId = 'standing' | 'walking' | 'running' | 'waving' | 'sitting' | 'crouching' | 'flying' | 'tpose' | 'victory' | 'dab' | 'fighting' | 'pointing';

const pose = (p: Partial<Pose>): Pose => ({ ...NEUTRAL_POSE, ...p });

/** Preset poses (all original, made from the part angles above). */
export const POSE_PRESETS: readonly { id: PosePresetId; pose: Pose }[] = [
  { id: 'standing', pose: pose({}) },
  { id: 'walking', pose: pose({ head: [4, -6, 0], rightArm: [28, 4, 0], leftArm: [-26, 4, 0], rightLeg: [-26, 1, 0], leftLeg: [26, 1, 0], cape: 6 }) },
  { id: 'running', pose: pose({ head: [-8, 0, 0], body: [12, 0, 0], rightArm: [70, 8, 0], leftArm: [-60, 8, 0], rightLeg: [-50, 2, 0], leftLeg: [55, 2, 0], cape: 35 }) },
  { id: 'waving', pose: pose({ head: [-4, 12, 6], rightArm: [150, 42, 0], leftArm: [0, 4, 0], body: [0, 6, 0] }) },
  { id: 'sitting', pose: pose({ head: [6, 0, 0], rightArm: [38, 6, 0], leftArm: [38, 6, 0], rightLeg: [90, 6, 0], leftLeg: [90, 6, 0] }) },
  { id: 'crouching', pose: pose({ head: [-24, 0, 0], body: [28, 0, 0], rightArm: [24, 6, 0], leftArm: [24, 6, 0], cape: 18 }) },
  { id: 'flying', pose: pose({ tilt: 80, head: [-60, 0, 0], rightArm: [0, 24, 0], leftArm: [0, 24, 0], rightLeg: [0, 4, 0], leftLeg: [0, 4, 0], wings: 100, cape: 40 }) },
  { id: 'tpose', pose: pose({ rightArm: [0, 90, 0], leftArm: [0, 90, 0] }) },
  { id: 'victory', pose: pose({ head: [-18, 0, 0], rightArm: [165, 28, 0], leftArm: [165, 28, 0], rightLeg: [0, 6, 0], leftLeg: [0, 6, 0] }) },
  // One arm straight up and out, the other across the face, the head tucked into it.
  { id: 'dab', pose: pose({ head: [32, -34, 0], body: [8, -8, 0], rightArm: [0, 135, 0], leftArm: [100, -50, 0], rightLeg: [0, 8, 0], leftLeg: [0, 8, 0] }) },
  { id: 'fighting', pose: pose({ head: [6, 18, 0], body: [8, -18, 0], rightArm: [118, 14, -30], leftArm: [42, 18, 0], rightLeg: [-22, 8, 0], leftLeg: [24, 8, 0], cape: 12 }) },
  { id: 'pointing', pose: pose({ head: [0, -16, 0], rightArm: [88, 10, 0], leftArm: [0, 4, 0] }) },
];

export function presetPose(id: PosePresetId): Pose {
  return clonePose((POSE_PRESETS.find((p) => p.id === id) ?? POSE_PRESETS[0]).pose);
}

export function clonePose(p: Pose): Pose {
  return {
    head: [...p.head],
    body: [...p.body],
    rightArm: [...p.rightArm],
    leftArm: [...p.leftArm],
    rightLeg: [...p.rightLeg],
    leftLeg: [...p.leftLeg],
    tilt: p.tilt,
    wings: p.wings,
    cape: p.cape,
  };
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
/** Angles are kept to whole degrees (sliders step by 1). */
const round = (v: number) => Math.round(v);

/** A copy with every angle a whole number inside its range. */
export function clampPose(p: Pose): Pose {
  const out = clonePose(p);
  for (const j of POSE_JOINTS) {
    const axes = JOINT_AXES[j];
    out[j] = [0, 1, 2].map((i) => clamp(round(num(p[j][i], 0)), axes[i].min, axes[i].max)) as unknown as JointAngles;
  }
  out.tilt = clamp(round(num(p.tilt, 0)), TILT_RANGE.min, TILT_RANGE.max);
  out.wings = clamp(round(num(p.wings, 0)), WINGS_RANGE.min, WINGS_RANGE.max);
  out.cape = clamp(round(num(p.cape, 0)), CAPE_RANGE.min, CAPE_RANGE.max);
  return out;
}

export function samePose(a: Pose, b: Pose): boolean {
  return serializePose(a) === serializePose(b);
}

/** The preset a pose is exactly, or null for a pose of its own. */
export function presetOf(p: Pose): PosePresetId | null {
  const s = serializePose(p);
  return POSE_PRESETS.find((x) => serializePose(x.pose) === s)?.id ?? null;
}

/**
 * Short text form of a pose (stored per browser): "1:" then the 18 part angles, tilt, wings and cape,
 * comma separated, e.g. "1:0,0,0,0,0,0,0,4,0,…". Values are clamped on the way in and out.
 */
export function serializePose(p: Pose): string {
  const c = clampPose(p);
  return `1:${[...POSE_JOINTS.flatMap((j) => c[j]), c.tilt, c.wings, c.cape].join(',')}`;
}

/** Reads serializePose() text (or the same object as JSON); null when it is not a pose. */
export function parsePose(text: string | null | undefined): Pose | null {
  if (!text) return null;
  const m = /^1:([-\d.,\s]+)$/.exec(text.trim());
  if (!m) return null;
  const values = m[1].split(',').map((v) => Number(v.trim()));
  if (values.length !== POSE_JOINTS.length * 3 + 3 || values.some((v) => !Number.isFinite(v))) return null;
  const p = clonePose(NEUTRAL_POSE);
  POSE_JOINTS.forEach((j, i) => (p[j] = [values[i * 3], values[i * 3 + 1], values[i * 3 + 2]]));
  const n = POSE_JOINTS.length * 3;
  p.tilt = values[n];
  p.wings = values[n + 1];
  p.cape = values[n + 2];
  return clampPose(p);
}

/** Copies one side's arm or leg to the other (a mirrored pose of that limb). */
export function mirrorLimb(p: Pose, from: PoseJoint): Pose {
  const out = clonePose(p);
  const other: Partial<Record<PoseJoint, PoseJoint>> = { rightArm: 'leftArm', leftArm: 'rightArm', rightLeg: 'leftLeg', leftLeg: 'rightLeg' };
  const to = other[from];
  if (to) out[to] = [...p[from]];
  return out;
}

/** The whole pose mirrored left to right (a wave with the other hand). */
export function mirrorPose(p: Pose): Pose {
  const out = clonePose(p);
  out.rightArm = [...p.leftArm];
  out.leftArm = [...p.rightArm];
  out.rightLeg = [...p.leftLeg];
  out.leftLeg = [...p.rightLeg];
  out.head = [p.head[0], -p.head[1], -p.head[2]];
  out.body = [p.body[0], -p.body[1], -p.body[2]];
  return out;
}

// ---------------------------------------------------------------------------------------------
// Transforms

/** Position and rotation of one object, in its parent's space (skinview3d's player parts). */
export interface PartTransform {
  position: [number, number, number];
  /** Quaternion x, y, z, w */
  quaternion: [number, number, number, number];
}

export interface PoseTransforms {
  /** Parts of PlayerObject.skin (positions in the skin's space, as skinview3d places them) */
  parts: Record<PoseJoint, PartTransform>;
  /** PlayerObject.cape and PlayerObject.elytra (player space) */
  cape: PartTransform;
  elytra: PartTransform;
  /** Rotation of each elytra wing group (radians; the right wing mirrors the left) */
  leftWing: { x: number; y: number; z: number };
  /** The whole PlayerObject */
  player: PartTransform;
}

const RAD = Math.PI / 180;
/** Where skinview3d puts each part at rest (skin space). The arms' and legs' pivots are at the joint. */
const REST: Record<PoseJoint, [number, number, number]> = {
  head: [0, 0, 0],
  body: [0, -6, 0],
  rightArm: [-5, -2, 0],
  leftArm: [5, -2, 0],
  rightLeg: [-1.9, -12, -0.1],
  leftLeg: [1.9, -12, -0.1],
};
/** The body bends here (between the legs, at the top of them). */
const HIPS = new Vector3(0, -12, 0);
/** skinview3d: the skin sits 8 up in the player, the cape and elytra 8 up and 2 behind. */
const SKIN_Y = 8;
const BACK: [number, number, number] = [0, 0, -2];
/** The cape's default angle away from the back (skinview3d's resting cape). */
const CAPE_REST = 10.8 * RAD;
const WING_FOLDED = { x: 0.2617994, z: 0.2617994 };
const WING_SPREAD = { x: 0.34906584, z: Math.PI / 2 };

/** Local rotation of a part from its three pose angles. */
export function jointEuler(joint: PoseJoint, a: JointAngles): Euler {
  const [p, q, r] = a.map((v) => v * RAD);
  // Order 'XZY': a part first turns about its own length (y), then sideways (z), then forwards (x).
  switch (joint) {
    case 'head':
      // turn, then nod, then tilt
      return new Euler(p, q, r, 'YXZ');
    case 'body':
      return new Euler(p, q, r, 'XZY');
    // Arms and legs hang down their -y axis: positive x swings them backwards in three.js, so "raise"
    // and "swing" are negated; "out" turns about z, towards -x for the right side and +x for the left.
    case 'rightArm':
    case 'rightLeg':
      return new Euler(-p, r, -q, 'XZY');
    case 'leftArm':
    case 'leftLeg':
      return new Euler(-p, -r, q, 'XZY');
  }
}

const quat = (e: Euler) => new Quaternion().setFromEuler(e);
const qArr = (q: Quaternion): [number, number, number, number] => [q.x, q.y, q.z, q.w];
const vArr = (v: Vector3): [number, number, number] => [v.x, v.y, v.z];

/** The positions and rotations that show a pose (see PoseTransforms). */
export function poseTransforms(input: Pose): PoseTransforms {
  const p = clampPose(input);
  const bodyQ = quat(jointEuler('body', p.body));
  /** A part carried by the body: its rest place turned about the hips, its rotation after the body's. */
  const carried = (rest: [number, number, number], local: Quaternion): PartTransform => {
    const pos = new Vector3(...rest).sub(HIPS).applyQuaternion(bodyQ).add(HIPS);
    return { position: vArr(pos), quaternion: qArr(bodyQ.clone().multiply(local)) };
  };
  const parts = {} as Record<PoseJoint, PartTransform>;
  for (const j of POSE_JOINTS) {
    const local = quat(jointEuler(j, p[j]));
    if (j === 'rightLeg' || j === 'leftLeg') parts[j] = { position: [...REST[j]], quaternion: qArr(local) };
    else if (j === 'body') parts[j] = carried(REST.body, new Quaternion());
    else parts[j] = carried(REST[j], local);
  }
  // The cape hangs from the top of the back: skin space -> player space (+8 up).
  const inPlayer = (t: PartTransform): PartTransform => ({ position: [t.position[0], t.position[1] + SKIN_Y, t.position[2]], quaternion: t.quaternion });
  const capeLocal = quat(new Euler(CAPE_REST + p.cape * RAD, Math.PI, 0, 'XYZ'));
  const cape = inPlayer(carried(BACK, capeLocal));
  const elytra = inPlayer(carried(BACK, new Quaternion()));
  const k = p.wings / 100;
  const leftWing = { x: WING_FOLDED.x + k * (WING_SPREAD.x - WING_FOLDED.x), y: 0.01, z: WING_FOLDED.z + k * (WING_SPREAD.z - WING_FOLDED.z) };
  const player: PartTransform = { position: [0, 0, 0], quaternion: qArr(quat(new Euler(p.tilt * RAD, 0, 0))) };
  return { parts, cape, elytra, leftWing, player };
}

/** The direction an arm or leg points (from its joint, unit vector, skin space) — used by the tests. */
export function limbDirection(t: PoseTransforms, joint: PoseJoint): [number, number, number] {
  const q = new Quaternion(...t.parts[joint].quaternion);
  return vArr(new Vector3(0, -1, 0).applyQuaternion(q));
}
