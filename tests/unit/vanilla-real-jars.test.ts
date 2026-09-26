/**
 * Vanilla shader generator against the real shaders of every Minecraft jar available as a fixture
 * (1.6.1 → 26.4 snapshots). Mojang files are read at runtime from the fixture directory and never
 * stored in the repo; the whole suite skips when no jars are present.
 *
 * Per version: defaults, every preset, both extremes and single-effect settings are generated;
 * patches must be append-only, GUI shaders untouched, program/post-effect JSON valid, and every
 * shader program touched by a change must compile the way that version's game compiles it
 * (#moj_import / #include expansion + pipeline defines + glslangValidator in OpenGL or Vulkan mode).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findGlslang, missingVaryings, mojPreprocess, compileGL } from '../tools/vanilla/glsl';
import { listJars, loadVersionShaders } from '../tools/vanilla/sources';
import { expectedPrefix, familyOf, validateVersion } from '../tools/vanilla/validate';
import { generateVanillaShaderFiles, presetValues, defaults } from '../../src/tools/shaders/vanilla/index';

const jars = listJars();
const glslang = findGlslang();
const NO_JARS = 'no Minecraft client jars found (set TO_FIXTURES to a folder containing research-cache/jars/<version>.jar)';
const NO_GLSLANG = 'glslangValidator not found (set GLSLANG_VALIDATOR or add it to PATH); shader compilation is not checked';

if (!glslang && jars.length) test('shader compilation', { skip: NO_GLSLANG }, () => {});

test('real game versions cover every shader family', { skip: jars.length ? false : NO_JARS }, () => {
  const families = new Set(jars.map((j) => familyOf(j)?.id ?? 'none'));
  for (const f of ['none', 'F1', 'F2', 'F3', 'F4', 'F6']) {
    if (!families.has(f)) console.log(`note: no fixture jar for shader family ${f}`);
  }
  assert.ok(families.size >= 2);
});

for (const jar of jars) {
  test(`vanilla shaders for Java ${jar.version}`, async () => {
    const report = await validateVersion(jar, glslang);
    assert.deepEqual(report.failures, [], report.failures.slice(0, 20).join('\n'));
    if (report.supported) {
      assert.ok(report.changedFiles > 0, 'the extreme settings should change files');
      if (glslang) assert.ok(report.glChecked + report.vulkanChecked > 0, 'no shader was compiled');
    }
  });
}

// Negative controls: the checks must catch a broken patch, otherwise passing means nothing.
const control = jars.find((j) => j.version === '1.17.1') ?? jars.find((j) => familyOf(j)?.id === 'F1');
test('validation catches broken patches', { skip: control ? false : NO_JARS }, async () => {
  const vs = loadVersionShaders(control!);
  const pf = vs.packFormat ?? { major: 7, minor: 0 };
  const r = generateVanillaShaderFiles(vs.sources, presetValues('cinematic'), { versionId: control!.version, packFormat: pf });
  const vpath = 'assets/minecraft/shaders/core/rendertype_solid.vsh';
  const fpath = 'assets/minecraft/shaders/core/rendertype_solid.fsh';
  assert.equal(typeof r.files[vpath], 'string');
  const merged: Record<string, string> = { ...vs.sources, ...(r.files as Record<string, string>) };

  // Removing a varying the fragment shader reads must be reported.
  const noVarying = { ...merged, [vpath]: merged[vpath].replace('out float txo_aspect;', '') };
  assert.deepEqual(missingVaryings(mojPreprocess(merged[vpath], merged, vpath), mojPreprocess(merged[fpath], merged, fpath)), []);
  assert.deepEqual(missingVaryings(mojPreprocess(noVarying[vpath], noVarying, vpath), mojPreprocess(noVarying[fpath], noVarying, fpath)), ['txo_aspect']);

  // Editing vanilla code (not just renaming main) must be reported.
  const edited = merged[fpath].replace('uniform sampler2D', 'uniform  sampler2D');
  const vanillaF = vs.sources[fpath];
  assert.notEqual(edited, merged[fpath]);
  assert.ok(merged[fpath].startsWith(expectedPrefix(vanillaF, merged[fpath])));
  assert.ok(!edited.startsWith(expectedPrefix(vanillaF, edited)));

  // A typo in generated code must fail compilation.
  if (glslang) {
    const good = mojPreprocess(merged[fpath], merged, fpath);
    const bad = good.replace('txo_grade(fragColor.rgb)', 'txo_grade(fragColour.rgb)');
    assert.notEqual(bad, good);
    assert.deepEqual(await compileGL(glslang, [{ label: 'good', stage: 'frag', code: good }]), []);
    const failures = await compileGL(glslang, [{ label: 'bad', stage: 'frag', code: bad }]);
    assert.equal(failures.length, 1);
    assert.match(failures[0].log, /fragColour/);
  }
});

test('versions without core shaders are reported as unsupported', { skip: jars.some((j) => familyOf(j) === null) ? false : NO_JARS }, () => {
  for (const jar of jars.filter((j) => familyOf(j) === null)) {
    const vs = loadVersionShaders(jar);
    const r = generateVanillaShaderFiles(vs.sources, defaults(), { versionId: jar.version, packFormat: vs.packFormat ?? { major: 1, minor: 0 } });
    assert.equal(r.supported, false, jar.version);
    assert.deepEqual(r.files, {});
    assert.match(r.warnings.join(' '), /1\.17/);
  }
});
