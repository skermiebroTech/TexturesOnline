// Pose maker maths: what each angle does to a limb, the body carrying the head and arms, presets,
// clamping, mirroring and the stored text form.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  JOINT_AXES,
  NEUTRAL_POSE,
  POSE_JOINTS,
  POSE_PRESETS,
  clampPose,
  clonePose,
  limbDirection,
  mirrorLimb,
  mirrorPose,
  parsePose,
  poseTransforms,
  presetOf,
  presetPose,
  samePose,
  serializePose,
  type Pose,
} from '../../src/tools/skins/pose';
import { Quaternion, Vector3 } from 'three';

const close = (a: readonly number[], b: readonly number[], eps = 1e-6) => a.every((v, i) => Math.abs(v - b[i]) < eps);
const dir = (p: Pose, j: Parameters<typeof limbDirection>[1]) => limbDirection(poseTransforms(p), j);
const withJoint = (j: keyof Pose, v: [number, number, number]): Pose => ({ ...clonePose(NEUTRAL_POSE), rightArm: [0, 0, 0], leftArm: [0, 0, 0], [j]: v });

test('a zero pose leaves every part where skinview3d puts it', () => {
  const zero: Pose = { ...clonePose(NEUTRAL_POSE), rightArm: [0, 0, 0], leftArm: [0, 0, 0] };
  const t = poseTransforms(zero);
  assert.deepEqual(t.parts.head.position, [0, 0, 0]);
  assert.ok(close(t.parts.body.position, [0, -6, 0]));
  assert.ok(close(t.parts.rightArm.position, [-5, -2, 0]));
  assert.ok(close(t.parts.leftArm.position, [5, -2, 0]));
  assert.deepEqual(t.parts.rightLeg.position, [-1.9, -12, -0.1]);
  for (const j of POSE_JOINTS) assert.ok(close(t.parts[j].quaternion, [0, 0, 0, 1]), `${j} not turned`);
  // Cape at the top of the back, turned to face backwards, at skinview3d's resting angle.
  assert.ok(close(t.cape.position, [0, 8, -2]));
  assert.ok(close(t.elytra.position, [0, 8, -2]));
  assert.ok(close(t.player.quaternion, [0, 0, 0, 1]));
  assert.ok(Math.abs(t.leftWing.z - 0.2617994) < 1e-6, 'wings folded');
});

test('raising an arm points it forwards, then up; "out" points it away from the body on each side', () => {
  // The player faces +z; the right arm hangs at -x, the left at +x.
  assert.ok(close(dir(withJoint('rightArm', [90, 0, 0]), 'rightArm'), [0, 0, 1]), 'right arm forwards');
  assert.ok(close(dir(withJoint('leftArm', [90, 0, 0]), 'leftArm'), [0, 0, 1]), 'left arm forwards');
  assert.ok(close(dir(withJoint('rightArm', [180, 0, 0]), 'rightArm'), [0, 1, 0]), 'straight up');
  assert.ok(close(dir(withJoint('rightArm', [-45, 0, 0]), 'rightArm'), [0, -Math.SQRT1_2, -Math.SQRT1_2]), 'backwards');
  assert.ok(close(dir(withJoint('rightArm', [0, 90, 0]), 'rightArm'), [-1, 0, 0]), 'right arm out to the right');
  assert.ok(close(dir(withJoint('leftArm', [0, 90, 0]), 'leftArm'), [1, 0, 0]), 'left arm out to the left');
  // Roll turns the arm about its own length: it still hangs down.
  assert.ok(close(dir(withJoint('rightArm', [0, 0, 60]), 'rightArm'), [0, -1, 0]));
});

test('legs swing forwards and spread out, mirrored on each side', () => {
  assert.ok(close(dir(withJoint('rightLeg', [90, 0, 0]), 'rightLeg'), [0, 0, 1]), 'sitting leg forwards');
  assert.ok(close(dir(withJoint('leftLeg', [-30, 0, 0]), 'leftLeg'), [0, -Math.cos(Math.PI / 6), -0.5]));
  const r = dir(withJoint('rightLeg', [0, 30, 0]), 'rightLeg');
  const l = dir(withJoint('leftLeg', [0, 30, 0]), 'leftLeg');
  assert.ok(r[0] < 0 && l[0] > 0 && Math.abs(r[0] + l[0]) < 1e-9, 'legs spread apart symmetrically');
});

test('the body bends at the hips and carries the head, the arms and the cape; the legs stay', () => {
  const p = withJoint('body', [90, 0, 0]);
  const t = poseTransforms(p);
  // Hips at y = -12: leaning 90° forwards puts the neck (12 above the hips) 12 in front of them.
  assert.ok(close(t.parts.head.position, [0, -12, 12]), `head ${t.parts.head.position}`);
  assert.ok(close(t.parts.body.position, [0, -12, 6]), `body ${t.parts.body.position}`);
  assert.ok(close(t.parts.rightArm.position, [-5, -12, 10]), `arm ${t.parts.rightArm.position}`);
  assert.deepEqual(t.parts.rightLeg.position, [-1.9, -12, -0.1]);
  assert.ok(close(t.parts.rightLeg.quaternion, [0, 0, 0, 1]), 'legs keep their own angle');
  // The arms turn with the body: arms along the body now point back towards the hips.
  assert.ok(close(limbDirection(t, 'rightArm'), [0, 0, -1]));
  // The cape moved with the back (skin space +8 = player space).
  // Cape (skin space 0, 0, -2) turned 90° about the hips: 2 above them and 12 in front, +8 in player space.
  assert.ok(close(t.cape.position, [0, -2, 12]), `cape ${t.cape.position}`);
});

test('nodding the head looks down, turning looks to the left, and twisting turns the shoulders', () => {
  // The direction the face looks (the head's +z).
  const face = (p: Pose) => new Vector3(0, 0, 1).applyQuaternion(new Quaternion(...poseTransforms(p).parts.head.quaternion)).toArray();
  assert.ok(face(withJoint('head', [30, 0, 0]))[1] < -0.4, 'looks down');
  assert.ok(face(withJoint('head', [0, 45, 0]))[0] > 0.6, 'looks to the left (+x)');
  // Twisting 60° to the left brings the right shoulder forwards.
  const twisted = poseTransforms(withJoint('body', [0, 60, 0]));
  assert.ok(close(twisted.parts.rightArm.position, [-2.5, -2, 5 * Math.sin(Math.PI / 3)]), `right shoulder comes forwards ${twisted.parts.rightArm.position}`);
});

test('tilt lays the whole player down and wings open', () => {
  const t = poseTransforms({ ...clonePose(NEUTRAL_POSE), tilt: 90, wings: 100 });
  const [x, , , w] = t.player.quaternion;
  assert.ok(Math.abs(2 * Math.atan2(x, w) - Math.PI / 2) < 1e-6);
  assert.ok(Math.abs(t.leftWing.z - Math.PI / 2) < 1e-6);
  assert.ok(Math.abs(t.leftWing.x - 0.34906584) < 1e-6);
});

test('poses are clamped to whole degrees inside each range', () => {
  const wild: Pose = { ...clonePose(NEUTRAL_POSE), head: [500, -500, 12.6], rightArm: [Number.NaN, 400, -1000], tilt: 1000, wings: -5, cape: 1e9 };
  const c = clampPose(wild);
  assert.deepEqual(c.head, [JOINT_AXES.head[0].max, JOINT_AXES.head[1].min, 13]);
  assert.deepEqual(c.rightArm, [0, JOINT_AXES.rightArm[1].max, JOINT_AXES.rightArm[2].min]);
  assert.equal(c.tilt, 90);
  assert.equal(c.wings, 0);
  assert.equal(c.cape, 80);
  // The original is untouched.
  assert.equal(wild.head[0], 500);
});

test('presets: about ten distinct, valid poses, found again from their angles', () => {
  assert.ok(POSE_PRESETS.length >= 10);
  const texts = new Set(POSE_PRESETS.map((p) => serializePose(p.pose)));
  assert.equal(texts.size, POSE_PRESETS.length, 'every preset is different');
  for (const p of POSE_PRESETS) {
    assert.ok(samePose(p.pose, clampPose(p.pose)), `${p.id} is inside the ranges`);
    assert.equal(presetOf(presetPose(p.id)), p.id);
  }
  const t = presetPose('tpose');
  assert.ok(close(dir(t, 'rightArm'), [-1, 0, 0]) && close(dir(t, 'leftArm'), [1, 0, 0]), 'T-pose arms straight out');
  const sit = presetPose('sitting');
  assert.ok(dir(sit, 'rightLeg')[2] > 0.99, 'sitting legs forwards');
  assert.ok(presetPose('flying').wings === 100);
  // A changed preset is a pose of its own.
  const changed = presetPose('waving');
  changed.head = [0, 0, 0];
  assert.equal(presetOf(changed), null);
  // presetPose hands out copies.
  presetPose('standing').head = [9, 9, 9] as unknown as Pose['head'];
  assert.deepEqual(presetPose('standing').head, [0, 0, 0]);
});

test('serialize and parse round-trip, and reject anything else', () => {
  for (const p of POSE_PRESETS) assert.ok(samePose(parsePose(serializePose(p.pose))!, p.pose), p.id);
  const s = serializePose(presetPose('dab'));
  assert.match(s, /^1:(-?\d+,){20}-?\d+$/);
  assert.equal(parsePose(''), null);
  assert.equal(parsePose(null), null);
  assert.equal(parsePose('2:0,0'), null);
  assert.equal(parsePose('1:0,0,0'), null, 'too few values');
  assert.equal(parsePose(`${s},4`), null, 'too many values');
  assert.equal(parsePose('1:a,b'), null);
  // Out-of-range stored values come back clamped.
  const big = parsePose(`1:${Array(21).fill(999).join(',')}`)!;
  assert.equal(big.head[0], 80);
  assert.equal(big.wings, 100);
});

test('mirroring swaps sides and turns the head the other way', () => {
  const wave = presetPose('waving');
  const m = mirrorPose(wave);
  assert.deepEqual(m.leftArm, wave.rightArm);
  assert.deepEqual(m.rightArm, wave.leftArm);
  assert.equal(m.head[1], -wave.head[1]);
  assert.ok(samePose(mirrorPose(m), wave), 'mirroring twice gives the pose back');
  const both = mirrorLimb(wave, 'rightArm');
  assert.deepEqual(both.leftArm, wave.rightArm);
  assert.deepEqual(mirrorLimb(wave, 'head').head, wave.head, 'the head has no other side');
});
