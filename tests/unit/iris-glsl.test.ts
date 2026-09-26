// Compiles every program of generated Iris / OptiFine shader packs with glslangValidator, the way
// the loaders prepare them: #include expansion, in-game option overrides, the standard macros
// (MC_VERSION, IRIS_TAG_SUPPORT, MC_RENDER_STAGE_*...) injected after #version, and the GLSL 1.20
// -> 330 core rewrite done on Minecraft 1.17+. Covers the defaults, every preset, all-min / all-max
// and random option combinations, plus in-game toggles of every boolean and every tone mapper.
//
// glslangValidator is taken from $GLSLANG_VALIDATOR, then PATH, then the local tools folder; the
// tests are skipped when it is not available.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PRESETS, defaults, generateIrisPack, presetValues, IRIS_PROGRAMS } from '../../src/tools/shaders/iris/index';
import type { OptionValues } from '../../src/core/types';
import {
  ENVIRONMENTS, applyOverrides, checkVaryings, compileAll, expandIncludes, findGlslang, injectMacros, linkPair, parsePackOptions,
  toCore, type CompileJob, type LoaderEnv,
} from '../tools/iris/glsl-check';
import { allExtreme, mulberry32, randomOptions } from '../tools/iris/fixtures';

const GLSLANG = findGlslang();
const SKIP = GLSLANG ? false : 'glslangValidator not found: set GLSLANG_VALIDATOR or put it on PATH to compile the generated GLSL';

interface Variant {
  name: string;
  files: Record<string, string>;
  overrides: Record<string, string | boolean>;
}

function relFiles(v: OptionValues): Record<string, string> {
  const rel: Record<string, string> = {};
  for (const [p, c] of Object.entries(generateIrisPack(v, { name: 'Compile Test', description: 'Compiled in tests.' }))) {
    if (p.startsWith('shaders/')) rel[p.slice('shaders/'.length)] = c as string;
  }
  return rel;
}

function buildVariants(): Variant[] {
  const out: Variant[] = [];
  const web: Array<[string, OptionValues]> = [['defaults', defaults()]];
  for (const p of PRESETS) web.push([`preset:${p.id}`, presetValues(p.id)]);
  web.push(['all-min', allExtreme(false)], ['all-max', allExtreme(true)]);
  const rand = mulberry32(99);
  for (let i = 0; i < 4; i++) web.push([`random:${i}`, randomOptions(rand, i < 2)]);
  for (const [name, v] of web) out.push({ name, files: relFiles(v), overrides: {} });

  // In-game changes on top of the default pack, like the Shader Options menu makes them.
  const base = relFiles(defaults());
  const opts = parsePackOptions(Object.fromEntries(Object.entries(base).map(([k, c]) => [`shaders/${k}`, c])));
  const bools = [...opts.bools.keys()];
  out.push({ name: 'ingame:all-on', files: base, overrides: Object.fromEntries(bools.map((b) => [b, true])) });
  out.push({ name: 'ingame:all-off', files: base, overrides: Object.fromEntries(bools.map((b) => [b, false])) });
  for (const t of ['0', '1', '3']) out.push({ name: `ingame:TONEMAP=${t}`, files: base, overrides: { TONEMAP: t } });
  const last = (n: string): string => opts.values.get(n)!.list.slice(-1)[0];
  const first = (n: string): string => opts.values.get(n)!.list[0];
  out.push({
    name: 'ingame:extreme-values', files: base,
    overrides: { SHADOW_SAMPLES: last('SHADOW_SAMPLES'), GODRAYS_SAMPLES: last('GODRAYS_SAMPLES'), SHADOW_SOFTNESS: first('SHADOW_SOFTNESS'),
      BLOOM_THRESHOLD: first('BLOOM_THRESHOLD'), EXPOSURE: first('EXPOSURE'), GAMMA: first('GAMMA') },
  });
  return out;
}

function prepare(files: Record<string, string>, path: string, overrides: Record<string, string | boolean>, env: LoaderEnv): string {
  return injectMacros(applyOverrides(expandIncludes(files, path), overrides), env.macros) + '\n';
}

const VARIANTS = GLSLANG ? buildVariants() : [];

for (const env of ENVIRONMENTS) {
  test(`every program compiles for ${env.name}${env.core ? ' (+ core-profile rewrite)' : ''}`, { skip: SKIP }, async () => {
    const jobs: CompileJob[] = [];
    const varyingProblems: string[] = [];
    for (const variant of VARIANTS) {
      for (const prog of IRIS_PROGRAMS) {
        const srcs: Partial<Record<'vert' | 'frag', string>> = {};
        for (const [ext, stage] of [['vsh', 'vert'], ['fsh', 'frag']] as const) {
          const src = prepare(variant.files, `${prog}.${ext}`, variant.overrides, env);
          srcs[stage] = src;
          jobs.push({ label: `${env.name} ${variant.name} ${prog}.${ext}`, stage, source: src });
          if (env.core) jobs.push({ label: `${env.name} ${variant.name} ${prog}.${ext} [core]`, stage, source: toCore(src, stage) });
        }
        for (const p of checkVaryings(srcs.vert!, srcs.frag!)) varyingProblems.push(`${variant.name} ${prog}: ${p}`);
      }
    }
    assert.deepEqual(varyingProblems, []);
    const stats = await compileAll(GLSLANG!, jobs);
    const report = stats.failures.slice(0, 5).map((f) => `${f.label}\n${f.output}`).join('\n\n');
    assert.equal(stats.failures.length, 0, `${stats.failures.length} of ${stats.unique} unique sources failed:\n${report}`);
    assert.ok(stats.jobs >= VARIANTS.length * IRIS_PROGRAMS.length * 2);
    if (process.env.IRIS_GLSL_VERBOSE) console.log(`${env.name}: ${stats.jobs} compiles, ${stats.unique} unique sources`);
  });
}

test('vertex and fragment shaders link for every environment', { skip: SKIP }, async () => {
  const failures: string[] = [];
  const picks = VARIANTS.filter((v) => ['defaults', 'ingame:all-on', 'ingame:all-off'].includes(v.name));
  for (const env of ENVIRONMENTS) {
    for (const variant of picks) {
      await Promise.all(IRIS_PROGRAMS.map(async (prog) => {
        const out = await linkPair(GLSLANG!, prepare(variant.files, `${prog}.vsh`, variant.overrides, env),
          prepare(variant.files, `${prog}.fsh`, variant.overrides, env));
        if (out) failures.push(`${env.name} ${variant.name} ${prog}\n${out}`);
      }));
    }
  }
  assert.deepEqual(failures, []);
});

test('the compile check catches broken GLSL', { skip: SKIP }, async () => {
  const files = relFiles(defaults());
  const env = ENVIRONMENTS[0];
  const good = prepare(files, 'final.fsh', {}, env);
  const jobs: CompileJob[] = [
    { label: 'good', stage: 'frag', source: good },
    { label: 'missing semicolon', stage: 'frag', source: good.replace('vec3 c = max(', 'vec3 c = max(').replace('c *= whiteBalance();', 'c *= whiteBalance()') },
    { label: 'texture() in 120', stage: 'frag', source: good.replace('texture2D(colortex0', 'texture(colortex0') },
    { label: 'integer max in 120', stage: 'frag', source: good.replace('void main() {', 'void main() {\n\tint k = max(1, 2);') },
  ];
  const stats = await compileAll(GLSLANG!, jobs, { batchSize: 2 });
  assert.deepEqual(stats.failures.map((f) => f.label).sort(), ['integer max in 120', 'missing semicolon', 'texture() in 120']);
  // One bad file inside a large batch is attributed to exactly that file.
  const many: CompileJob[] = [];
  for (let i = 0; i < 150; i++) many.push({ label: `ok ${i}`, stage: 'frag', source: `${good}\n// ${i}\n` });
  many.splice(77, 0, { label: 'bad one', stage: 'frag', source: good.replace('gl_FragData[0] = vec4(', 'gl_FragData[0] = vec5(') });
  const big = await compileAll(GLSLANG!, many);
  assert.equal(big.unique, 151);
  assert.deepEqual(big.failures.map((f) => f.label), ['bad one']);
  assert.match(big.failures[0].output, /ERROR/);
  // A varying the vertex shader does not write is reported.
  const vsh = prepare(files, 'final.vsh', {}, env);
  const fsh = prepare(files, 'final.fsh', {}, env).replace('varying vec2 texcoord;', 'varying vec2 texcoord;\nvarying vec3 extra;');
  assert.equal(checkVaryings(vsh, fsh).length, 1);
});
