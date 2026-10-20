/**
 * Things mobs wear: saddles, armour, harnesses and carpets. The Java equipment layers (every worn box on
 * its texture, armour inflated over the body it covers so nothing z-fights, the saddle on the back),
 * the texture paths each version keeps them at (models/armor before 1.21.2, entity/equipment after;
 * saddles in the coat texture before 1.21.5; undead horse armour from 1.21.11), the choices and parts
 * the library offers, where worn textures open ("Used by"), and the Bedrock equivalents from the
 * vanilla files (TO_FIXTURES).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ARMOR_SLOTS, JAVA_MOBS, type MobState } from '../../src/shared/models/mobs-java';
import { mobLayer } from '../../src/shared/models/mob-geometry';
import { bakeEntityModel } from '../../src/shared/models/entity-models';
import { BedrockEntities, MOB_TRANSFORM } from '../../src/shared/models/entities';
import { loadModelLibrary, type ModelLibrary } from '../../src/shared/models/index';
import { parseLenientJson } from '../../src/editions/bedrock/catalog';
import type { BakedQuad } from '../../src/shared/models/geometry';
import { bedrockSamplesDir, javaEntityTextureSizes, javaJarAssets, pngSize } from '../tools/models/fixtures';

const ROOT = new URL('../../', import.meta.url).pathname;
const E = 'assets/minecraft/textures/entity/';

function bounds(qs: BakedQuad[]) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const q of qs) for (const p of q.positions) for (let i = 0; i < 3; i++) (min[i] = Math.min(min[i], p[i] * 16)), (max[i] = Math.max(max[i], p[i] * 16));
  return { min, max };
}
const bake = (name: string, only?: (p: string) => boolean) => bakeEntityModel(mobLayer(name)!, MOB_TRANSFORM, { texture: 't', role: 'r', only });
const contains = (outer: ReturnType<typeof bounds>, inner: ReturnType<typeof bounds>, margin: number) =>
  [0, 1, 2].every((i) => outer.min[i] <= inner.min[i] - margin + 1e-6 && outer.max[i] >= inner.max[i] + margin - 1e-6);

/** Every gear look of every mob: each choice's values on their own, plus the mob's gear states. */
function gearLooks(spec: (typeof JAVA_MOBS)[number]): MobState[] {
  const first = Object.fromEntries(spec.props.map((p) => [p.name, p.values[0].value]));
  const out: MobState[] = [];
  for (const g of spec.gearStates ?? []) out.push({ ...first, ...g }, { ...first, ...g, age: 'baby' });
  for (const p of spec.props.filter((x) => x.gear)) for (const v of p.values.slice(1)) out.push({ ...first, ...p.with, [p.name]: v.value });
  return out;
}

test('Java gear: every worn layer is in the part tables with its boxes on its texture', () => {
  let n = 0;
  for (const spec of JAVA_MOBS) {
    for (const st of gearLooks(spec)) {
      for (const l of spec.layers(st).filter((x) => x.gear)) {
        const m = mobLayer(l.model);
        assert.ok(m, `${spec.id}: no layer ${l.model}`);
        assert.ok(l.part, `${spec.id}: ${l.model} worn layer has a parts-list entry`);
        const [w, h] = m!.texSize;
        for (const q of bakeEntityModel(m!, MOB_TRANSFORM, { texture: 't', role: 'r' })) {
          for (const [u, v] of q.uvs) assert.ok(u >= -1e-6 && u <= 16 + 1e-6 && v >= -1e-6 && v <= 16 + 1e-6, `${spec.id}: ${l.model} maps off its ${w}x${h} texture`);
        }
        n++;
      }
    }
  }
  assert.ok(n > 300, `${n} worn layers checked`);
});

test('Java armour: each piece is inflated over the body part it covers, leggings inside the chestplate', () => {
  for (const mob of ['zombie', 'husk', 'skeleton', 'stray', 'wither_skeleton', 'piglin', 'piglin_brute', 'zombified_piglin', 'armor_stand', 'drowned', 'giant', 'zombie_baby', 'piglin_baby']) {
    const head = bounds(bake(mob, (p) => /head$/.test(p)));
    const helmet = bounds(bake(`${mob}#helmet`, (p) => /head$/.test(p)));
    // (the piglin's helmet is its 10-wide head plus a hair)
    assert.ok(contains(helmet, head, mob === 'armor_stand' ? 0 : 0.01), `${mob}: helmet ${JSON.stringify(helmet)} over head ${JSON.stringify(head)}`);
    const chest = bounds(bake(`${mob}#chestplate`, (p) => /body$/.test(p)));
    const waist = bounds(bake(`${mob}#leggings`, (p) => /body$/.test(p)));
    if (!mob.endsWith('_baby')) assert.ok(contains(chest, waist, 0.2), `${mob}: the chestplate is outside the leggings' waist`);
    const legs = bounds(bake(`${mob}#leggings`, (p) => /_leg$/.test(p)));
    const boots = bounds(bake(`${mob}#boots`));
    assert.ok(boots.min[1] < legs.min[1] && boots.max[0] > legs.max[0] - 1e-6, `${mob}: boots outside the leggings ${JSON.stringify({ legs, boots })}`);
  }
});

test('Java saddles sit on the back, a little bigger than the body they lie on', () => {
  const pig = bounds(bake('pig', (p) => /body$/.test(p)));
  const pigSaddle = bounds(bake('pig#saddle', (p) => /body$/.test(p)));
  assert.ok(contains(pigSaddle, pig, 0.4), 'pig saddle around the body');
  const horse = bounds(bake('horse', (p) => /root\/body$/.test(p)));
  const saddle = bounds(bake('horse#saddle', (p) => /saddle$/.test(p) && !/head/.test(p)));
  assert.ok(saddle.max[1] > horse.max[1] && saddle.min[2] > horse.min[2] && saddle.max[2] < horse.max[2], `horse saddle on the middle of the back ${JSON.stringify({ horse, saddle })}`);
  // the saddle layer leaves out the reins (only drawn with a rider)
  assert.ok(!JSON.stringify(mobLayer('horse#saddle')).includes('saddle_line'));
});

const sizes263 = javaEntityTextureSizes('26.3');
test('Java 26.3: every worn texture exists with the size its layer maps', { skip: !sizes263.size && 'Java 26.3 client jar not found (set TO_FIXTURES)' }, () => {
  let n = 0;
  for (const spec of JAVA_MOBS) {
    for (const st of gearLooks(spec)) {
      for (const l of spec.layers(st).filter((x) => x.gear)) {
        const first = (Array.isArray(l.texture) ? l.texture : [l.texture])[0];
        // (trims live outside entity/: relative to textures/ with a leading '/')
        const path = first.startsWith('/') ? `assets/minecraft/textures${first}.png` : `${E}${first}.png`;
        const size = sizes263.get(path);
        assert.ok(size, `${spec.id}: ${path} in the 26.3 jar`);
        const [w, h] = mobLayer(l.model)!.texSize;
        assert.ok(size![0] * h === size![1] * w, `${spec.id}: ${path} is ${size!.join('x')}, ${l.model} maps ${w}x${h}`);
        n++;
      }
    }
  }
  assert.ok(n > 300, `${n} checked`);
});

const libs = new Map<string, Promise<ModelLibrary | null>>();
function lib(version: string): Promise<ModelLibrary | null> {
  let p = libs.get(version);
  if (!p) {
    const a = javaJarAssets(version);
    p = a ? loadModelLibrary(a) : Promise.resolve(null);
    libs.set(version, p);
  }
  return p;
}
async function view(version: string, id: string, state: Record<string, string>) {
  const l = (await lib(version))!;
  const e = l.entity(id)!;
  assert.ok(e, `${id} in ${version}`);
  await l.prepare(e);
  return { lib: l, entry: e, v: l.resolve(e, { ...l.defaultState(e), ...state }) };
}
const worn = (v: { textures: { path: string; faces: number }[] }) => v.textures.filter((t) => t.faces > 0).map((t) => t.path.replace('assets/minecraft/textures/', ''));
const SET = (m: string) => Object.fromEntries(ARMOR_SLOTS.map(([s]) => [s, m]));
const has = (v: string) => !!javaJarAssets(v);

test('Java versions: armour, saddles and horse armour come from where each version keeps them', { skip: !(has('26.3') && has('1.21.4') && has('1.20.4')) && 'jars not found (set TO_FIXTURES)' }, async () => {
  // 26.3: equipment folders, baby armour of its own
  let r = await view('26.3', 'zombie', SET('iron'));
  assert.deepEqual(worn(r.v).slice(1).sort(), ['entity/equipment/humanoid/iron.png', 'entity/equipment/humanoid_leggings/iron.png']);
  r = await view('26.3', 'zombie', { ...SET('iron'), age: 'baby' });
  assert.deepEqual(worn(r.v).slice(1), ['entity/equipment/humanoid_baby/iron.png']);
  // 1.21.4: equipment folders, no baby armour textures (babies wear nothing here)
  r = await view('1.21.4', 'zombie', SET('gold'));
  assert.ok(worn(r.v).includes('entity/equipment/humanoid/gold.png'), worn(r.v).join());
  // 1.20.4: models/armor layers, turtle shell, no copper
  r = await view('1.20.4', 'zombie', { ...SET('diamond'), helmet: 'turtle_scute' });
  assert.deepEqual(worn(r.v).slice(1).sort(), ['models/armor/diamond_layer_1.png', 'models/armor/diamond_layer_2.png', 'models/armor/turtle_layer_1.png']);
  const helmet = r.lib.properties(r.entry).find((p) => p.name === 'helmet')!;
  assert.ok(!helmet.values.some((v) => v.value === 'copper'), 'no copper armour in 1.20.4');
  assert.ok((await view('26.3', 'zombie', {})).lib.properties((await view('26.3', 'zombie', {})).entry).find((p) => p.name === 'helmet')!.values.some((v) => v.value === 'copper'));
  // leather: dyed (brown undyed) with an undyed overlay
  r = await view('26.3', 'armor_stand', { ...SET('leather'), dye: 'red' });
  const leather = r.v.quads.find((q) => q.texture?.endsWith('humanoid/leather.png'))!;
  assert.deepEqual(leather.tint, { kind: 'fixed', rgb: [0xb0, 0x2e, 0x26] });
  assert.ok(r.v.quads.some((q) => q.texture?.endsWith('humanoid/leather_overlay.png') && !q.tint));
  r = await view('26.3', 'armor_stand', SET('leather'));
  assert.deepEqual(r.v.quads.find((q) => q.texture?.endsWith('humanoid/leather.png'))!.tint, { kind: 'fixed', rgb: [0xa0, 0x65, 0x40] });
  // saddles: their own texture from 1.21.5, the coat before
  r = await view('26.3', 'horse', { saddle: 'on', coat: 'black' });
  assert.ok(worn(r.v).includes('entity/equipment/horse_saddle/saddle.png'));
  r = await view('1.21.4', 'horse', { saddle: 'on', coat: 'black' });
  assert.deepEqual(worn(r.v), ['entity/horse/horse_black.png']);
  assert.ok(r.v.parts!.some((p) => p.label === 'Saddle'), 'saddle part drawn with the coat');
  r = await view('1.20.4', 'horse', { armor: 'iron' });
  assert.ok(worn(r.v).includes('entity/horse/armor/horse_armor_iron.png'), worn(r.v).join());
});

test('Java versions: undead horse armour from 1.21.11, wolf armour from 1.20.5', { skip: !(has('1.21.10') && has('1.21.11') && has('1.20.5') && has('1.20.4')) && 'jars not found (set TO_FIXTURES)' }, async () => {
  const props = async (v: string, id: string) => {
    const l = (await lib(v))!;
    const e = l.entity(id)!;
    return l.properties(e).map((p) => p.name);
  };
  assert.ok(!(await props('1.21.10', 'zombie_horse')).includes('armor'));
  assert.ok(!(await props('1.21.10', 'zombie_horse')).includes('dye'));
  assert.ok((await props('1.21.11', 'zombie_horse')).includes('armor'));
  assert.ok((await props('1.21.10', 'horse')).includes('armor'));
  assert.ok(!(await props('1.20.4', 'wolf')).includes('armor'));
  const r = await view('1.20.5', 'wolf', { armor: 'armadillo_scute', dye: 'blue', cracks: 'low' });
  assert.deepEqual(worn(r.v).slice(1), ['entity/wolf/wolf_armor.png', 'entity/wolf/wolf_armor_overlay.png', 'entity/wolf/wolf_armor_crackiness_low.png']);
});

test('Java 26.3 library: worn things are parts of their own, choices only where they apply, textures open on a sensible mob', { skip: !has('26.3') && 'Java 26.3 client jar not found (set TO_FIXTURES)' }, async () => {
  const r = await view('26.3', 'zombie', SET('iron'));
  const labels = r.v.parts!.map((p) => p.label);
  for (const l of ['Helmet', 'Chestplate', 'Leggings', 'Boots']) assert.ok(labels.includes(l), labels.join());
  const chest = r.v.parts!.findIndex((p) => p.label === 'Chestplate');
  assert.ok(r.v.quads.filter((q) => q.part === chest).every((q) => q.texture!.endsWith('humanoid/iron.png')));
  // armour pieces are one group, the dye only with leather on
  const props = r.lib.properties(r.entry);
  assert.deepEqual(props.filter((p) => p.group === 'armor').map((p) => p.name), ['helmet', 'chestplate', 'leggings', 'boots']);
  const dye = props.find((p) => p.name === 'dye')!;
  assert.ok(!dye.showIf!({ helmet: 'iron' }) && dye.showIf!({ helmet: 'leather' }));
  // mobs that wear nothing get no gear choices
  const creeper = r.lib.entity('creeper')!;
  assert.ok(!r.lib.properties(creeper).some((p) => p.gear));
  // a saddle only on adults
  const pig = r.lib.entity('pig')!;
  const saddle = r.lib.properties(pig).find((p) => p.name === 'saddle')!;
  assert.ok(saddle.showIf!({ age: 'adult' }) && !saddle.showIf!({ age: 'baby' }));
  // worn textures of other looks are marked (the panel lists them only while worn)
  const plain = r.lib.resolve(r.entry, r.lib.defaultState(r.entry));
  assert.ok(plain.textures.filter((t) => t.faces === 0 && t.path.includes('/equipment/')).every((t) => t.gear));
  // "Used by": the armour stand first for armour, the zombie for baby armour, the horse for horse armour
  r.lib.usage();
  const first = (p: string) => r.lib.usageOf(`${E}${p}`).entities[0];
  assert.equal(first('equipment/humanoid/iron.png'), 'armor_stand');
  assert.equal(first('equipment/humanoid_leggings/diamond.png'), 'armor_stand');
  assert.equal(first('equipment/humanoid_baby/gold.png'), 'zombie');
  assert.equal(first('equipment/horse_body/gold.png'), 'horse');
  assert.equal(first('equipment/pig_saddle/saddle.png'), 'pig');
  assert.equal(first('equipment/llama_body/red.png'), 'llama');
  assert.equal(first('equipment/happy_ghast_body/red_harness.png'), 'happy_ghast');
  assert.equal(first('equipment/nautilus_body/iron.png'), 'nautilus');
  assert.ok(r.lib.usageOf(`${E}equipment/humanoid/iron.png`).entities.length >= 13);
  // opening a worn texture shows it worn
  const stand = r.lib.entity('armor_stand')!;
  const t = r.lib.resolve(stand, r.lib.defaultState(stand)).textures.find((x) => x.path.endsWith('equipment/humanoid/netherite.png'))!;
  assert.deepEqual([t.state!.helmet, t.state!.chestplate, t.state!.boots], ['netherite', 'netherite', 'netherite']);
});

// ------------------------------------------------------------------------------------------ Bedrock

const BEDROCK = bedrockSamplesDir() ?? '/nonexistent';
const bedrockReady = existsSync(join(BEDROCK, 'render_controllers', 'saddle.render_controllers.json')) && existsSync(join(BEDROCK, 'attachables'));

function bedrock(): BedrockEntities {
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
const pathsOf = (v: { labels: Map<string, string> }) => [...v.labels.keys()];
const partLabels = (v: { parts: { label: string }[] }) => v.parts.map((p) => p.label);

test('Bedrock gear: saddles, horse armour, carpets, harness, wolf and humanoid armour from the vanilla files', { skip: !bedrockReady && 'Bedrock samples with render controllers not found (set TO_FIXTURES)' }, async () => {
  const be = bedrock();
  const at = async (id: string, state: Record<string, string>) => {
    assert.ok(await be.load(id), id);
    return be.resolve(id, { ...be.defaultState(id), ...state });
  };
  // the pig's saddle: its own controller, the body bone only, on the saddle texture
  let v = await at('pig', { saddle: 'on' });
  assert.ok(partLabels(v).includes('Saddle') && pathsOf(v).includes('textures/entity/saddle_v2.png'), pathsOf(v).join());
  // horses: saddle bones drawn with the coat; armour as another texture of the horse
  v = await at('horse', { saddle: 'on', armor: 'diamond' });
  assert.ok(partLabels(v).includes('Saddle') && partLabels(v).includes('Horse armour'), partLabels(v).join());
  assert.ok(pathsOf(v).includes('textures/entity/horse2/armor/horse_armor_diamond.png'));
  const props = be.properties('horse');
  assert.ok(props.find((p) => p.name === 'armor')!.values.some((p) => p.value === 'netherite'));
  // leather horse armour is dyed through its alpha mask
  v = await at('horse', { armor: 'leather', dye: 'blue' });
  const lq = v.quads.find((q) => q.texture?.endsWith('horse_armor_leather.tga'))!;
  assert.equal(lq.tintMask, 'armor');
  // skeleton horses never show a saddle on Bedrock
  await be.load('skeleton_horse');
  assert.ok(!be.properties('skeleton_horse').some((p) => p.name === 'saddle'));
  // strider: the saddled texture in place of its own
  v = await at('strider', { saddle: 'on' });
  assert.ok(pathsOf(v).includes('textures/entity/strider/strider_saddled.png'));
  // camel, llama, harness, nautilus, wolf
  assert.ok(partLabels(await at('camel', { saddle: 'on' })).includes('Saddle'));
  assert.ok(pathsOf(await at('llama', { decor: 'light_gray' })).includes('textures/entity/llama/decor/decor_silver.png'));
  assert.ok(pathsOf(await at('trader_llama', {})).includes('textures/entity/llama/decor/trader_llama_decor.png'));
  assert.ok(pathsOf(await at('happy_ghast', { look: 'happy_ghast', harness: 'red' })).includes('textures/entity/harness/harness_red.png'));
  v = await at('nautilus', { armor: 'iron', saddle: 'on' });
  assert.ok(partLabels(v).includes('Armour') && partLabels(v).includes('Saddle') && !partLabels(v).includes('Head'), partLabels(v).join());
  v = await at('wolf', { armor: 'armadillo_scute', dye: 'red', cracks: 'medium' });
  assert.deepEqual(pathsOf(v).slice(1), ['textures/entity/wolf/wolf_armor_dyed.tga', 'textures/entity/wolf/wolf_armor_cracked_medium.png']);
  // humanoid armour: the attachables' geometry and textures, babies with their own
  v = await at('zombie', { helmet: 'iron', chestplate: 'iron', leggings: 'iron', boots: 'iron' });
  for (const l of ['Helmet', 'Chestplate', 'Leggings', 'Boots']) assert.ok(partLabels(v).includes(l), partLabels(v).join());
  assert.deepEqual(pathsOf(v).slice(1).sort(), ['textures/models/armor/iron_1.png', 'textures/models/armor/iron_2.png']);
  const head = bounds(v.quads.filter((q) => v.parts[q.part ?? 0]?.name === 'head'));
  const helmet = bounds(v.quads.filter((q) => v.parts[q.part ?? 0]?.label === 'Helmet'));
  assert.ok(contains(helmet, head, 0.5), JSON.stringify({ head, helmet }));
  v = await at('zombie', { look: 'baby', helmet: 'gold' });
  assert.ok(pathsOf(v).includes('textures/models/armor/gold_baby.png'), pathsOf(v).join());
  v = await at('armor_stand', { chestplate: 'leather', dye: 'red' });
  assert.equal(v.quads.find((q) => q.texture?.endsWith('leather_1.tga'))!.tintMask, 'armor');
  // worn textures open on the armour stand / horse first
  assert.ok(be.textureStates('armor_stand').some((t) => t.path === 'textures/models/armor/diamond_1.png' && t.gear && t.home));
  for (const [path, w, h] of [['textures/models/armor/iron_1.png', 64, 32], ['textures/entity/saddle_v2.png', 64, 64]] as const) {
    const f = join(BEDROCK, path);
    if (existsSync(f)) assert.deepEqual(pngSize(new Uint8Array(readFileSync(f))), [w, h]);
  }
});
