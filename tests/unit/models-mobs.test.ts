/**
 * Mob models: the Java part tables (every layer the mob list uses exists and its UV boxes stay on the
 * texture, the creeper's face and the sheep's wool land where the textures draw them), the Bedrock
 * geometry converter (bind poses, inheritance, rest animations with `this`, game-applied turns), the
 * Molang evaluator, and against real game files (TO_FIXTURES) the texture sizes of the 26.3 jar, the
 * library's mobs and texture usage, and the Bedrock vanilla mobs matching their Java twins.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JAVA_MOBS, type MobState } from '../../src/shared/models/mobs-java';
import { mobLayer, mobLayerNames } from '../../src/shared/models/mob-geometry';
import { bakeEntityModel, type EntityModel } from '../../src/shared/models/entity-models';
import { BedrockEntities, MOB_TRANSFORM, type EntityView } from '../../src/shared/models/entities';
import { addAnimation, flattenGeo, geoToModel, parseGeoFile, type GeoDef, type RestPose } from '../../src/shared/models/bedrock-geo';
import { evalMolang } from '../../src/shared/models/molang';
import { raycastQuads, texelAt } from '../../src/shared/models/model-paint';
import { loadModelLibrary } from '../../src/shared/models/index';
import { parseLenientJson } from '../../src/editions/bedrock/catalog';
import type { BakedQuad } from '../../src/shared/models/geometry';
import { bedrockSamplesDir, javaEntityTextureSizes, javaJarAssets, javaJarPath, pngSize } from '../tools/models/fixtures';

const ROOT = new URL('../../', import.meta.url).pathname;
const near = (a: number, b: number, eps = 1e-4) => Math.abs(a - b) < eps;

/** Texture-pixel rectangle a quad shows, for a texture of the given size. */
function uvRect(q: BakedQuad, w: number, h: number): number[] {
  const us = q.uvs.map((u) => (u[0] / 16) * w);
  const vs = q.uvs.map((u) => (u[1] / 16) * h);
  return [Math.min(...us), Math.min(...vs), Math.max(...us), Math.max(...vs)].map((x) => Math.round(x * 1000) / 1000);
}

function bounds(qs: BakedQuad[]) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const q of qs) for (const p of q.positions) for (let i = 0; i < 3; i++) (min[i] = Math.min(min[i], p[i] * 16)), (max[i] = Math.max(max[i], p[i] * 16));
  return { min: min.map((v) => Math.round(v * 100) / 100), max: max.map((v) => Math.round(v * 100) / 100) };
}

const bake = (m: EntityModel, only?: (p: string) => boolean) => bakeEntityModel(m, MOB_TRANSFORM, { texture: 't', role: 'r', only });

/** Each mob's looks: the first state, then every value of each choice on its own. */
function looks(spec: (typeof JAVA_MOBS)[number]): MobState[] {
  const first = Object.fromEntries(spec.props.map((p) => [p.name, p.values[0].value]));
  const out: MobState[] = [first];
  for (const p of spec.props) for (const v of p.values.slice(1)) out.push({ ...first, [p.name]: v.value });
  return out;
}

// ------------------------------------------------------------------------------------------ Java tables

/**
 * Flat fins the game itself maps partly off the texture (the salmon's right fin starts at u -4, the
 * small tropical fish's tail and fin and the big pufferfish's back fin run past the edge): layer, parts.
 */
const QUIRKS: [RegExp, RegExp][] = [
  [/^salmon/, /right_fin$/],
  [/^pufferfish_big$/, /top_back_fin$/],
  [/^tropical_fish_small/, /(tail|top_fin)$/],
];

test('Java mobs: every layer the mob list draws is in the part tables, with its UV boxes on the texture', () => {
  assert.ok(JAVA_MOBS.length >= 60, `${JAVA_MOBS.length} mobs`);
  const ids = new Set<string>();
  const used = new Set<string>();
  for (const spec of JAVA_MOBS) {
    assert.ok(!ids.has(spec.id), `duplicate mob ${spec.id}`);
    ids.add(spec.id);
    for (const st of looks(spec)) {
      const layers = spec.layers(st);
      assert.ok(layers.length, `${spec.id} draws nothing for ${JSON.stringify(st)}`);
      for (const l of layers) {
        used.add(l.model);
        assert.ok(mobLayer(l.model), `${spec.id}: no layer ${l.model}`);
        assert.ok(!/\.png$|^\/|textures\//.test(l.texture), `${spec.id}: texture is relative to textures/entity: ${l.texture}`);
      }
    }
  }
  for (const name of used) {
    const m = mobLayer(name)!;
    const [w, h] = m.texSize;
    const quirk = QUIRKS.find(([layer]) => layer.test(name))?.[1];
    const qs = bake(m, (p) => !quirk?.test(p));
    assert.ok(qs.length, `${name} has faces`);
    for (const q of qs) {
      const r = uvRect(q, w, h);
      assert.ok(r[0] >= -1e-6 && r[1] >= -1e-6 && r[2] <= w + 1e-6 && r[3] <= h + 1e-6, `${name}: ${q.role} face ${q.worldDir} uses ${r.join(',')} outside ${w}x${h}`);
    }
  }
  // the tables hold the layers for the mobs (and a few spare ones), not dead weight
  assert.ok(used.size >= mobLayerNames().length * 0.8, `${used.size} of ${mobLayerNames().length} layers used`);
});

test('Java creeper: the head faces south with its face on u 8..16, v 8..16, and a ray paints the face', () => {
  const m = mobLayer('creeper')!;
  assert.deepEqual(m.texSize, [64, 32]);
  const head = bake(m, (p) => p.endsWith('head'));
  const front = head.find((q) => q.worldDir === 'south')!;
  assert.deepEqual(uvRect(front, 64, 32), [8, 8, 16, 16]);
  // the creeper stands on y 0 and is 26 pixels tall
  const b = bounds(bake(m));
  assert.ok(near(b.min[1], 0) && near(b.max[1], 26), JSON.stringify(b));
  // ray from the front into the middle of the face
  const all = bake(m);
  const hit = raycastQuads(all, [0, 22 / 16, 2], [0, 0, -1])!;
  const t = texelAt(all[hit.index], hit.uv, 64, 32);
  assert.ok(t.x >= 8 && t.x < 16 && t.y >= 8 && t.y < 16, JSON.stringify(t));
});

test('Java sheep: the wool layer wraps the body a little bigger, on the wool texture layout', () => {
  const body = bounds(bake(mobLayer('sheep')!, (p) => p.endsWith('body')));
  const wool = bounds(bake(mobLayer('sheep#wool')!, (p) => p.endsWith('body')));
  for (let i = 0; i < 3; i++) assert.ok(wool.min[i] < body.min[i] && wool.max[i] > body.max[i], `axis ${i}: ${JSON.stringify({ body, wool })}`);
  const spec = JAVA_MOBS.find((s) => s.id === 'sheep')!;
  const layers = spec.layers(looks(spec)[0]);
  assert.ok(layers.some((l) => l.model === 'sheep#wool' && /wool/.test(l.texture)), JSON.stringify(layers));
});

// ------------------------------------------------------------------------------------------ Molang

test('Molang: arithmetic, logic, math in degrees, queries at rest and `this`', () => {
  assert.equal(evalMolang('1 + 2 * 3'), 7);
  assert.equal(evalMolang('(1 + 2) * 3'), 9);
  assert.equal(evalMolang('-this', { this: 30 }), -30);
  assert.equal(evalMolang('90 - this', { this: 30 }), 60);
  assert.ok(near(evalMolang('math.cos(60)')!, 0.5));
  assert.ok(near(evalMolang('math.sin(query.anim_time * 38.17) * 80')!, 0));
  assert.equal(evalMolang('query.is_baby ? 4 : 2'), 2);
  assert.equal(evalMolang('!query.is_baby'), 1);
  assert.equal(evalMolang('variable.state == 3', { vars: { 'variable.state': 3 } }), 1);
  assert.equal(evalMolang('v.state == 3', { vars: { 'variable.state': 3 } }), 1);
  assert.equal(evalMolang('math.lerprotate(0, 90, 0.5)'), 45);
  assert.equal(evalMolang('math.clamp(5, 0, 2)'), 2);
  assert.equal(evalMolang('1 < 2 && 2 >= 2'), 1);
  assert.equal(evalMolang('query.x ?? 7'), 0);
  assert.equal(evalMolang(12), 12);
  assert.equal(evalMolang(true), 1);
  // statements and strings are out of scope
  assert.equal(evalMolang('variable.a = 1;'), null);
  assert.equal(evalMolang("query.property('minecraft:climate_variant')"), null);
  assert.equal(evalMolang('1 +'), null);
});

// ------------------------------------------------------------------------------------------ Bedrock converter

const geo = (bones: unknown[], extra: Record<string, unknown> = {}): GeoDef =>
  flattenGeo('geometry.t', (id) => parseGeoFile({ format_version: '1.12.0', 'minecraft:geometry': [{ description: { identifier: 'geometry.t', texture_width: 64, texture_height: 32 }, bones, ...extra }] }).get(id))!;

test('Bedrock converter: a cube becomes the same box as in Java model space, feet on y 0', () => {
  const m = geoToModel(geo([{ name: 'body', pivot: [0, 0, 0], cubes: [{ origin: [-4, 0, -2], size: [8, 12, 4], uv: [16, 16] }] }]));
  assert.deepEqual(m.texSize, [64, 32]);
  const qs = bake(m);
  assert.deepEqual(bounds(qs), { min: [-4, 0, -2], max: [4, 12, 2] });
  // box UV: the south face is the front of the layout (u 16+4 .. 16+4+8, v 16+4 .. 16+4+12)
  assert.deepEqual(uvRect(qs.find((q) => q.worldDir === 'south')!, 64, 32), [20, 20, 28, 32]);
});

test('Bedrock converter: the bind pose turns a bone’s boxes but not its children (sheep, panda, turtle)', () => {
  const g = geo([
    { name: 'body', pivot: [0, 19, 2], bind_pose_rotation: [90, 0, 0], cubes: [{ origin: [-4, 13, -5], size: [8, 16, 6], uv: [28, 8] }] },
    { name: 'leg0', parent: 'body', pivot: [-3, 12, 7], cubes: [{ origin: [-5, 0, 5], size: [4, 12, 4], uv: [0, 16] }] },
  ]);
  const m = geoToModel(g);
  const body = bounds(bake(m, (p) => p.startsWith('body/body~')));
  const leg = bounds(bake(m, (p) => p.endsWith('leg0')));
  // the body lies along z, 16 long, over the legs
  assert.ok(near(body.max[2] - body.min[2], 16) && near(body.max[1] - body.min[1], 6), JSON.stringify(body));
  assert.ok(body.min[1] >= 12 - 1e-6, JSON.stringify(body));
  // the leg still stands straight under it
  assert.deepEqual(leg, { min: [-5, 0, -9], max: [-1, 12, -5] });
});

test('Bedrock converter: inherited bones add their boxes unless reset', () => {
  const file = {
    format_version: '1.8.0',
    'geometry.base': { texturewidth: 64, textureheight: 32, bones: [{ name: 'head', pivot: [0, 24, 0], cubes: [{ origin: [-4, 24, -4], size: [8, 8, 8], uv: [0, 0] }] }] },
    'geometry.wool:geometry.base': { bones: [{ name: 'head', pivot: [0, 24, 0], cubes: [{ origin: [-4, 24, -4], size: [8, 8, 8], uv: [0, 16], inflate: 0.5 }] }] },
    'geometry.slim:geometry.base': { bones: [{ name: 'head', reset: true, pivot: [0, 24, 0], cubes: [{ origin: [-3, 24, -3], size: [6, 6, 6], uv: [0, 0] }] }] },
  };
  const defs = parseGeoFile(file);
  const wool = flattenGeo('geometry.wool', (id) => defs.get(id))!;
  assert.equal(wool.bones.length, 1);
  assert.equal(wool.bones[0].cubes.length, 2);
  assert.deepEqual(wool.texSize, [64, 32]);
  const slim = flattenGeo('geometry.slim', (id) => defs.get(id))!;
  assert.equal(slim.bones[0].cubes.length, 1);
  assert.deepEqual(slim.bones[0].cubes[0].size, [6, 6, 6]);
});

test('Bedrock converter: rest animations with `this` (setup poses, positions from the parent pivot)', () => {
  const g = geo([
    { name: 'body', pivot: [0, 10, 2], rotation: [30, 0, 0], cubes: [{ origin: [-3, 3, -1], size: [6, 9, 6], uv: [18, 14] }] },
    { name: 'leg', pivot: [-2.5, 8, 7], cubes: [{ origin: [-2.5, 0, 6], size: [2, 8, 2], uv: [0, 18] }] },
    { name: 'head', pivot: [0, 0, 0], cubes: [] },
    { name: 'spike', parent: 'head', pivot: [0, 24, 0], cubes: [{ origin: [-1, 19.5, -1], size: [2, 9, 2], uv: [0, 0] }] },
  ]);
  const pose: RestPose = new Map();
  addAnimation(pose, {
    bones: {
      // the wolf's setup: "90 - this" turns the body to 90 whatever the file says, "-14 - this" keeps it in place
      body: { rotation: ['90 - this', 0, 0], position: ['-this', '-14 - this', '2.0 - this'] },
      leg: { position: ['-2.5 - this', '-16 - this', '7 - this'], rotation: [{ '0.0': ['math.cos(query.anim_time * 38.17) * 80 * query.modified_move_speed', 0, 0] }] },
      // the guardian's spikes: positions measured from the parent's pivot
      spike: { position: ['-this', '12 - this', '-this'] },
    },
  });
  const m = geoToModel(g, pose);
  const body = m.parts.find((p) => p.name === 'body')!;
  assert.ok(near(body.pose!.rotation![0], Math.PI / 2), String(body.pose!.rotation));
  assert.deepEqual(body.pose!.offset, [0, 14, 2]);
  const leg = bounds(bake(m, (p) => p === 'leg'));
  assert.deepEqual(leg, { min: [-2.5, 0, -8], max: [-0.5, 8, -6] });
  // the spike's pivot goes from y 24 to y 12 (above the head's pivot at 0)
  const spike = bounds(bake(m, (p) => p.endsWith('spike')));
  assert.ok(near((spike.min[1] + spike.max[1]) / 2, 12), JSON.stringify(spike));
});

test('Bedrock converter: hidden bones and game-applied turns', () => {
  const g = geo([
    { name: 'body', pivot: [0, 7, 1], cubes: [{ origin: [-2, -1, -2], size: [4, 16, 6], uv: [20, 0] }] },
    { name: 'leg', parent: 'body', pivot: [1, 6, 7], cubes: [{ origin: [0, 0, 6], size: [2, 6, 2], uv: [8, 13] }] },
    { name: 'saddle', parent: 'body', pivot: [0, 7, 1], cubes: [{ origin: [-2, 7, -2], size: [4, 2, 6], uv: [0, 0] }] },
  ]);
  const m = geoToModel(g, undefined, [64, 32], new Set(['saddle']), { body: { boxes: [90, 0, 0] } });
  const names = (ps: typeof m.parts, pre = ''): string[] => ps.flatMap((p) => [pre + p.name, ...names(p.children ?? [], pre + p.name + '/')]);
  assert.ok(!names(m.parts).some((n) => n.includes('saddle')), names(m.parts).join());
  const body = bounds(bake(m, (p) => p.startsWith('body/body~')));
  assert.ok(near(body.max[2] - body.min[2], 16) && near(body.max[1] - body.min[1], 6), JSON.stringify(body));
  // the leg is not turned with the body's boxes
  assert.deepEqual(bounds(bake(m, (p) => p.endsWith('leg'))), { min: [0, 0, -8], max: [2, 6, -6] });
});

// ------------------------------------------------------------------------------------------ real files

const jar = javaJarPath('26.3');
test('Java 26.3: each mob layer’s texture exists with the size its part table expects', { skip: !jar && 'Java 26.3 client jar not found (set TO_FIXTURES)' }, () => {
  const sizes = javaEntityTextureSizes('26.3');
  let checked = 0;
  const missing: string[] = [];
  for (const spec of JAVA_MOBS) {
    for (const st of looks(spec)) {
      for (const l of spec.layers(st)) {
        const path = `assets/minecraft/textures/entity/${l.texture}.png`;
        const size = sizes.get(path);
        if (!size) {
          missing.push(path);
          continue;
        }
        const [w, h] = mobLayer(l.model)!.texSize;
        // same layout: the same size or a whole multiple of it (HD packs keep the aspect)
        assert.ok(size[0] * h === size[1] * w && size[0] % w === 0, `${spec.id}: ${path} is ${size.join('x')}, ${l.model} expects ${w}x${h}`);
        checked++;
      }
    }
  }
  assert.ok(checked > 200, `${checked} textures checked`);
  assert.deepEqual([...new Set(missing)], [], 'every texture named for 26.3 is in the jar');
});

const javaAssets = javaJarAssets('26.3');
test('Java 26.3 library: mobs show up, resolve to parts, and creeper.png is used by the creeper', { skip: !javaAssets && 'Java 26.3 client jar not found (set TO_FIXTURES)' }, async () => {
  const lib = await loadModelLibrary(javaAssets!);
  const mobs = lib.entities();
  assert.ok(mobs.length >= 80, `${mobs.length} mobs`);
  const creeper = lib.entity('creeper')!;
  assert.ok(creeper, 'creeper');
  assert.equal(lib.category(creeper), 'mob');
  await lib.prepare(creeper);
  const v = lib.resolve(creeper);
  assert.ok(v.quads.length >= 36, `${v.quads.length} quads`);
  assert.deepEqual(v.parts?.map((p) => p.label).sort(), ['Body', 'Head', 'Left front leg', 'Left hind leg', 'Right front leg', 'Right hind leg']);
  assert.ok(v.quads.every((q) => q.texture === 'assets/minecraft/textures/entity/creeper/creeper.png'));
  const usage = lib.usageOf('assets/minecraft/textures/entity/creeper/creeper.png');
  assert.ok(usage.entities.includes('creeper'), JSON.stringify(usage));
  // the sheep's choices include its wool colours, and its look draws the body and the wool
  const sheep = lib.entity('sheep')!;
  await lib.prepare(sheep);
  const props = lib.properties(sheep).map((p) => p.name);
  assert.ok(props.includes('wool') || props.includes('color'), props.join());
  const sv = lib.resolve(sheep);
  assert.ok(new Set(sv.quads.map((q) => q.texture)).size >= 2, 'sheep body and wool');
});

const BEDROCK = bedrockSamplesDir() ?? '/nonexistent';
const bedrockReady = existsSync(join(BEDROCK, 'models', 'entity', 'creeper.geo.json'));

function bedrockEntities(): BedrockEntities {
  const idx = JSON.parse(readFileSync(join(ROOT, 'public/data/bedrock/index-main.json'), 'utf8')) as { dirs: Record<string, string[]> };
  const files: string[] = [];
  for (const [dir, list] of Object.entries(idx.dirs)) for (const f of list) files.push(dir ? `${dir}/${f}` : f);
  const set = new Set(files);
  return new BedrockEntities({
    hasFile: (p) => set.has(p),
    listFiles: (p) => files.filter((f) => f.startsWith(p)),
    readJson: async (p) => {
      const f = join(BEDROCK, p);
      if (!existsSync(f)) return undefined;
      try {
        return parseLenientJson(readFileSync(f, 'utf8'));
      } catch {
        return undefined;
      }
    },
  });
}

/** Face direction + texture rectangle of every quad, sorted (to compare models drawn on one layout). */
function faceSet(v: { quads: BakedQuad[] }, w: number, h: number): string[] {
  return v.quads.map((q) => `${q.worldDir} ${uvRect(q, w, h).join(',')}`).sort();
}

test('Bedrock vanilla: the creeper and the cow match the Java models face for face', { skip: !bedrockReady && 'Bedrock samples not found (set TO_FIXTURES)' }, async () => {
  const be = bedrockEntities();
  assert.ok(be.ids().length >= 70, `${be.ids().length} mobs`);
  assert.ok(await be.load('creeper'));
  const bc = be.resolve('creeper', be.defaultState('creeper'));
  const jc = { quads: bake(mobLayer('creeper')!) };
  assert.deepEqual(faceSet(bc, 64, 32), faceSet(jc, 64, 32));
  assert.deepEqual(bounds(bc.quads), bounds(jc.quads));
  // the cow: its body lies down by its bind pose, like Java's turned body
  assert.ok(await be.load('cow'));
  const bw = be.resolve('cow', be.defaultState('cow'));
  const tex = [...bw.texSizes.values()][0];
  assert.ok(tex, 'cow texture size');
  const body = bounds(bw.quads.filter((q) => bw.parts[q.part ?? -1]?.name === 'body'));
  assert.ok(near(body.max[2] - body.min[2], 18) && body.min[1] > 10, JSON.stringify(body));
});

test('Bedrock vanilla: every mob loads, with UVs on its texture and textures of the size its geometry says', { skip: !bedrockReady && 'Bedrock samples not found (set TO_FIXTURES)' }, async () => {
  const be = bedrockEntities();
  const report: string[] = [];
  for (const id of be.ids()) {
    assert.ok(await be.load(id), `${id} loads`);
    const v: EntityView = be.resolve(id, be.defaultState(id));
    assert.ok(v.quads.length, `${id} has faces`);
    for (const q of v.quads) for (const u of q.uvs) assert.ok(u[0] >= -1e-6 && u[0] <= 16 + 1e-6 && u[1] >= -1e-6 && u[1] <= 16 + 1e-6, `${id}: uv ${u} off the texture`);
    for (const [path, [w, h]] of v.texSizes) {
      const png = join(BEDROCK, path);
      if (!path.endsWith('.png') || !existsSync(png)) continue; // .tga textures
      const [pw, ph] = pngSize(new Uint8Array(readFileSync(png)));
      assert.ok(pw * h === ph * w, `${id}: ${path} is ${pw}x${ph}, its geometry expects ${w}x${h}`);
      report.push(id);
    }
  }
  assert.ok(new Set(report).size >= 60, `${new Set(report).size} mobs checked against their textures`);
});
