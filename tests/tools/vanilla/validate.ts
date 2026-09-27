/**
 * End-to-end validation of the vanilla shader generator against one real game version:
 * structural rules (append-only patches, GUI untouched, program JSON, post effect JSON) and
 * compilation of every shader program touched by a change, the way that version's game compiles it.
 *
 * CLI: npx tsx tests/tools/vanilla/validate.ts [version ...]
 */
import { pathToFileURL } from 'node:url';
import type { OptionValues, PackFormat } from '../../../src/core/types';
import { bundledPackFormat } from '../../../src/editions/java/packformats';
import { OPTIONS, PRESETS, defaults, detectFamily, generateVanillaShaderFiles, presetValues } from '../../../src/tools/shaders/vanilla/index';
import { METADATA_FILE, parsePackMetadata } from '../../../src/tools/shaders/import/metadata';
import type { Family } from '../../../src/tools/shaders/vanilla/index';
import {
  compileGL, compileVulkan, declaredDescriptors, findGlslang, includeExpand, injectDefines, injectDefinesAfterHeader,
  missingVaryings, mojPreprocess, plainUniforms,
} from './glsl';
import type { CompileJob, Define } from './glsl';
import { programsFor } from './programs';
import { listJars, loadVersionShaders } from './sources';
import type { JarRef } from './sources';

export interface OptionSet {
  name: string;
  values: OptionValues;
}

function extreme(which: 'min' | 'max'): OptionValues {
  const v = defaults();
  for (const o of OPTIONS) {
    if (o.type === 'range') v[o.key] = which === 'min' ? (o.min as number) : (o.max as number);
    else if (o.type === 'toggle') v[o.key] = true;
    else if (o.type === 'color') v[o.key] = which === 'min' ? '#000000' : '#ff2040';
  }
  // The minimum of a range is often its neutral value; make sure every effect is active.
  if (which === 'min') Object.assign(v, { posterize: 2, fogStart: 0.05, vignette: 0.01, tintStrength: 0.01, fogTintStrength: 0.01, nightDarkness: 0.01 });
  return v;
}

/** Defaults, every preset, both extremes and single-effect sets (each exercises one code path alone). */
export function optionSets(): OptionSet[] {
  const one = (name: string, values: Partial<OptionValues>): OptionSet => ({ name, values: { ...defaults(), ...values } as OptionValues });
  return [
    { name: 'defaults', values: defaults() },
    ...PRESETS.map((p) => ({ name: `preset:${p.id}`, values: presetValues(p.id) })),
    { name: 'max', values: extreme('max') },
    { name: 'min', values: extreme('min') },
    one('grade-only', { contrast: 1.3 }),
    one('vignette-only', { vignette: 0.6 }),
    one('bloom-only', { bloom: true }),
    one('waving-only', { waving: true }),
    one('fog-start-only', { fogStart: 0.4 }),
    one('fog-env-only', { fogEnvironment: 2 }),
    one('fog-tint-only', { fogTintStrength: 0.7, fogTint: '#80ff80' }),
    one('night-only', { nightDarkness: 0.8 }),
  ];
}

export interface VersionReport {
  version: string;
  packFormat: number;
  family: string;
  supported: boolean;
  programs: number;
  glChecked: number;
  vulkanChecked: number;
  changedFiles: number;
  failures: string[];
  warnings: Record<string, string[]>;
}

const SHADERS = 'assets/minecraft/shaders/';
const CORE = `${SHADERS}core/`;
const INCLUDE = `${SHADERS}include/`;
const GL_BUILTIN_BLOCKS = ['Projection', 'Lighting', 'Fog', 'Globals'];
/** Shaders that only draw menus, screen blits or the title panorama. */
const GUI_SHADERS = /^(gui|rendertype_gui.*|panorama|blit_screen|screenquad)\.(vsh|fsh|json)$/;
const WORLD_GATE = /if \((txo_aspect > 0\.0001|abs\(ProjMat\[2\]\[3\]\) > 0\.0001)\) \{\n\s+\w+\.rgb = /;

function packFormatOf(version: string, fromJar: PackFormat | null): PackFormat {
  return fromJar ?? bundledPackFormat(version) ?? { major: 0, minor: 0 };
}

/** Vanilla text with only the renames the generator is allowed to do. */
export function expectedPrefix(vanilla: string, patched: string): string {
  let e = vanilla;
  if (patched.includes('txo_vanilla_main()')) e = e.replace(/\bvoid\s+main\s*\(\s*(?:void\s*)?\)/, 'void txo_vanilla_main()');
  for (const m of patched.matchAll(/\b(?:float|vec[234])\s+txo_vanilla_(\w+)\s*\(/g)) {
    const name = m[1];
    if (name === 'main') continue;
    const re = new RegExp(`^([ \\t]*)(float|vec[234])\\s+${name}\\s*\\(([^)]*)\\)\\s*\\{`, 'm');
    e = e.replace(re, (_a, ind: string, ret: string, params: string) => {
      const list = params.split(',').map((p) => p.trim()).filter(Boolean).join(', ');
      return `${ind}${ret} ${name}(${list});\n${ind}${ret} txo_vanilla_${name}(${list}) {`;
    });
  }
  return e;
}

function checkPostEffect(files: Record<string, string>, merged: Record<string, string>, fail: (m: string) => void, vkJobs: CompileJob[]): void {
  const text = files['assets/minecraft/post_effect/end_of_frame.json'];
  let j: { targets?: Record<string, unknown>; passes?: unknown[] };
  try {
    j = JSON.parse(text);
  } catch (e) {
    fail(`end_of_frame.json is not valid JSON: ${(e as Error).message}`);
    return;
  }
  const targets = new Set(Object.keys(j.targets ?? {}).map((t) => (t.includes(':') ? t : `minecraft:${t}`)));
  targets.add('minecraft:main');
  if (!Array.isArray(j.passes) || !j.passes.length) {
    fail('end_of_frame.json has no passes');
    return;
  }
  const last = j.passes[j.passes.length - 1] as { output?: string };
  if (last.output !== 'minecraft:main') fail('end_of_frame.json: the last pass must write minecraft:main');
  for (const [i, raw] of j.passes.entries()) {
    const ps = raw as { vertex_shader: string; fragment_shader: string; inputs?: { sampler_name: string; target: string }[]; output: string; uniforms?: Record<string, { type: string; value: unknown }[]> };
    const where = `end_of_frame pass ${i} (${ps.fragment_shader})`;
    const shaderPath = (id: string, ext: string): string => {
      const [ns, p] = id.includes(':') ? id.split(':') : ['minecraft', id];
      return `assets/${ns}/shaders/${p}.${ext}`;
    };
    const vsp = shaderPath(ps.vertex_shader, 'vsh');
    const fsp = shaderPath(ps.fragment_shader, 'fsh');
    if (merged[vsp] === undefined) fail(`${where}: vertex shader ${vsp} does not exist`);
    if (merged[fsp] === undefined) {
      fail(`${where}: fragment shader ${fsp} does not exist`);
      continue;
    }
    const inputs = ps.inputs ?? [];
    const names = inputs.map((x) => x.sampler_name);
    if (new Set(names).size !== names.length) fail(`${where}: repeated sampler name`);
    const output = ps.output.includes(':') ? ps.output : `minecraft:${ps.output}`;
    if (!targets.has(output)) fail(`${where}: unknown output target ${ps.output}`);
    for (const x of inputs) {
      const t = x.target.includes(':') ? x.target : `minecraft:${x.target}`;
      if (!targets.has(t)) fail(`${where}: unknown input target ${x.target}`);
      if (t === output) fail(`${where}: reads and writes ${x.target} in one pass`);
    }
    const fs = merged[fsp];
    const allowed = new Set([...names.map((n) => `${n}Sampler`), 'SamplerInfo', 'Globals', ...Object.keys(ps.uniforms ?? {})]);
    for (const d of declaredDescriptors(fs)) if (!allowed.has(d)) fail(`${where}: shader declares ${d}, which the pass does not provide`);
    for (const [block, list] of Object.entries(ps.uniforms ?? {})) {
      const m = new RegExp(`uniform\\s+${block}\\s*\\{([^}]*)\\}`).exec(fs);
      if (!m) {
        fail(`${where}: uniform block ${block} is not declared by the shader`);
        continue;
      }
      const members = [...m[1].matchAll(/\b(float|int|vec[234]|ivec3|mat4)\s+\w+\s*;/g)].map((x) => x[1]);
      const types = list.map((u) => (u.type === 'matrix4x4' ? 'mat4' : u.type));
      if (members.join(',') !== types.join(',')) fail(`${where}: ${block} members (${members}) do not match the JSON values (${types})`);
    }
    const info = /uniform\s+SamplerInfo\s*\{([^}]*)\}/.exec(fs);
    if (info) {
      const n = [...info[1].matchAll(/\bvec2\s+\w+\s*;/g)].length;
      if (n !== 1 + inputs.length) fail(`${where}: SamplerInfo must hold OutSize plus one size per input`);
    }
    const vouts = new Set([...merged[vsp].matchAll(/layout\s*\(\s*location\s*=\s*(\d+)\s*\)\s*out\b/g)].map((x) => x[1]));
    for (const x of fs.matchAll(/layout\s*\(\s*location\s*=\s*(\d+)\s*\)\s*in\b/g)) {
      if (!vouts.has(x[1])) fail(`${where}: fragment input location ${x[1]} is not written by the vertex shader`);
    }
    if (fsp.includes('/post/txo_')) vkJobs.push({ label: `post ${fsp}`, stage: 'frag', code: includeExpand(fs, merged, fsp) });
  }
}

/** Validates the generator for one jar over the given option sets. Needs glslang for the compile step. */
export async function validateVersion(jar: JarRef, glslang: string | null, sets: OptionSet[] = optionSets()): Promise<VersionReport> {
  const vs = loadVersionShaders(jar);
  const pf = packFormatOf(jar.version, vs.packFormat);
  const sources = vs.sources;
  const fam = detectFamily(sources, pf);
  const report: VersionReport = {
    version: jar.version, packFormat: pf.major, family: fam?.id ?? 'none', supported: !!fam, programs: 0,
    glChecked: 0, vulkanChecked: 0, changedFiles: 0, failures: [], warnings: {},
  };
  if (!fam) {
    for (const set of sets) {
      const r = generateVanillaShaderFiles(sources, set.values, { versionId: jar.version, packFormat: pf });
      if (r.supported) report.failures.push(`[${set.name}] expected supported:false for a version without core shaders`);
      if (Object.keys(r.files).length) report.failures.push(`[${set.name}] files generated for a version without core shaders`);
      if (!r.warnings.length) report.failures.push(`[${set.name}] no explanation for the missing support`);
    }
    return report;
  }
  const { programs } = programsFor(jar.version, sources);
  report.programs = programs.length;
  const glJobs = new Map<string, CompileJob>();
  const vkJobs = new Map<string, CompileJob>();
  const vk262Jobs = new Map<string, CompileJob>();
  const addJob = (map: Map<string, CompileJob>, job: CompileJob): void => {
    const key = `${job.stage}\n${job.code}`;
    if (!map.has(key)) map.set(key, job);
  };
  const preCache = new Map<string, string>();
  const expand = (files: Record<string, string>, path: string, isVanilla: boolean): string => {
    const key = `${isVanilla ? 'v' : 'm'}:${path}:${files[path]}`;
    let r = isVanilla ? preCache.get(key) : undefined;
    if (r === undefined) {
      r = fam.import === 'include' ? includeExpand(files[path], files, path) : mojPreprocess(files[path], files, path);
      if (isVanilla) preCache.set(key, r);
    }
    return r;
  };
  const vulkan262 = fam.id === 'F4' && pf.major >= 88;

  for (const set of sets) {
    const fail = (m: string): void => void report.failures.push(`[${set.name}] ${m}`);
    const r = generateVanillaShaderFiles(sources, set.values, { versionId: jar.version, packFormat: pf });
    report.warnings[set.name] = r.warnings;
    if (!r.supported) fail('generator reported supported:false');
    const files: Record<string, string> = {};
    for (const [k, v] of Object.entries(r.files)) {
      if (typeof v !== 'string') fail(`${k} is not text`);
      else files[k] = v;
    }
    // texturepackmaker.json (settings for opening the pack again, ignored by the game) is always there
    const meta = parsePackMetadata(files[METADATA_FILE]);
    if (!meta || meta.target !== 'java-vanilla' || meta.version !== jar.version) fail(`${METADATA_FILE} missing or wrong`);
    delete files[METADATA_FILE];
    report.changedFiles = Math.max(report.changedFiles, Object.keys(files).length);
    if (set.name === 'defaults' || set.name === 'preset:default') {
      if (Object.keys(files).length) fail('default settings must not change any file');
    }

    // ---- structure
    for (const [k, text] of Object.entries(files)) {
      if (!k.startsWith(SHADERS) && !k.startsWith('assets/minecraft/post_effect/')) fail(`unexpected output path ${k}`);
      if (/Made with (?!Texture Pack Maker)/.test(text)) fail(`${k} credits something other than Texture Pack Maker`);
      const name = k.slice(k.lastIndexOf('/') + 1);
      if (k.startsWith(CORE) && GUI_SHADERS.test(name)) fail(`GUI shader ${k} was changed`);
      const vanilla = sources[k];
      if (vanilla === undefined) {
        if (!/\/txo_\w+\.(glsl|fsh|vsh)$/.test(k) && k !== 'assets/minecraft/post_effect/end_of_frame.json') fail(`unexpected new file ${k}`);
        continue;
      }
      if (k.endsWith('.json')) {
        try {
          const a = JSON.parse(vanilla) as { uniforms?: { name: string }[] };
          const b = JSON.parse(text) as { uniforms?: { name: string }[] };
          const added = (b.uniforms ?? []).slice((a.uniforms ?? []).length);
          const rest = { ...b, uniforms: (b.uniforms ?? []).slice(0, (a.uniforms ?? []).length) };
          if (JSON.stringify(rest) !== JSON.stringify({ ...a, uniforms: a.uniforms ?? [] })) fail(`${k}: program JSON changed beyond appended uniforms`);
          if (added.some((u) => u.name !== 'GameTime')) fail(`${k}: unexpected uniforms appended`);
        } catch (e) {
          fail(`${k}: invalid JSON (${(e as Error).message})`);
        }
        continue;
      }
      const prefix = expectedPrefix(vanilla, text);
      if (!text.startsWith(prefix)) fail(`${k}: vanilla code was edited beyond renaming main/fog functions`);
      else {
        const tail = text.slice(prefix.length);
        if (/#\s*(version|extension)\b/.test(tail)) fail(`${k}: appended code contains #version/#extension`);
        if (!tail.trim()) fail(`${k}: listed as changed but nothing was appended`);
      }
      if (k.startsWith(CORE) && k.endsWith('.fsh') && !k.endsWith('/lightmap.fsh') && !WORLD_GATE.test(text)) {
        fail(`${k}: colour change is not limited to the world (GUI test missing)`);
      }
    }
    if (fam.id === 'F6') {
      for (const k of Object.keys(files)) {
        if (k.startsWith(CORE) && k !== `${CORE}lightmap.fsh`) fail(`26.3+ must not patch core shader ${k}`);
        if (k.startsWith(INCLUDE) && k !== `${INCLUDE}fog.glsl`) fail(`26.3+ must not add include ${k}`);
      }
    }
    const wavingOn = set.values.waving === true;
    const hasWave = Object.values(files).some((t) => t.includes('txo_wave('));
    const pfm = pf.major;
    const waveAllowed = (pfm >= 7 && pfm <= 46) || (pfm >= 63 && pfm <= 69);
    if (wavingOn && waveAllowed && !hasWave) fail('waving plants were requested and supported but not generated');
    if (hasWave && !waveAllowed) fail(`waving plants generated for pack format ${pfm}`);
    if (wavingOn && !waveAllowed && !r.warnings.some((w) => /Waving/.test(w))) fail('missing warning for unavailable waving plants');
    if (set.values.bloom === true && !fam.endOfFrame && !r.warnings.some((w) => /Bloom/.test(w))) fail('missing warning for unavailable bloom');
    if (files['assets/minecraft/post_effect/end_of_frame.json'] !== undefined && !fam.endOfFrame) fail('end_of_frame.json written for a version that ignores it');
    // The environmental fog multiplier must never reach Blindness, Darkness, lava or powder snow fog.
    const envSet = typeof set.values.fogEnvironment === 'number' && set.values.fogEnvironment !== 1;
    const fogOut = files[`${INCLUDE}fog.glsl`];
    if (envSet && fam.fogApi === 'v2') {
      if (!fogOut) fail('water & weather fog distance was requested but include/fog.glsl was not changed');
      else if (!/\benvironmentalStart \* txo_fog_env\(environmantalEnd\), environmantalEnd \* txo_fog_env\(environmantalEnd\)/.test(fogOut)
        || !/float txo_fog_env\(float envEnd\) \{\n\s+return mix\(1\.0, [\d.]+, smoothstep\(16\.0, 32\.0, envEnd\)\);/.test(fogOut)) {
        fail('environmental fog is scaled without the txo_fog_env gate that keeps status-effect fog vanilla');
      }
    }
    if (Object.values(files).some((t) => /\btxo_wave\(/.test(t) && !t.includes('Color.g > Color.r * 0.5'))) fail('waving plants without the redstone / grey exclusion');

    // ---- compile every program touched by the change
    const merged: Record<string, string> = { ...sources, ...files };
    const vkPost: CompileJob[] = [];
    if (files['assets/minecraft/post_effect/end_of_frame.json'] !== undefined) checkPostEffect(files, merged, fail, vkPost);
    for (const j of vkPost) addJob(vkJobs, j);
    if (!Object.keys(files).length) continue;
    for (const prog of programs) {
      const vp = `${SHADERS}${prog.vsh}.vsh`;
      const fp = `${SHADERS}${prog.fsh}.fsh`;
      if (merged[vp] === undefined || merged[fp] === undefined) continue;
      const vV = expand(sources, vp, true);
      const fV = expand(sources, fp, true);
      const vM = expand(merged, vp, false);
      const fM = expand(merged, fp, false);
      if (vV === vM && fV === fM) continue;
      const defs: Define[] = prog.defines;
      const label = (stage: string): string => `${prog.label} ${stage} [${defs.map((d) => d.join('=')).join(' ')}]`;
      if (fam.import === 'include') {
        addJob(vkJobs, { label: label('vertex'), stage: 'vert', code: injectDefinesAfterHeader(vM, defs) });
        addJob(vkJobs, { label: label('fragment'), stage: 'frag', code: injectDefinesAfterHeader(fM, defs) });
      } else {
        const vc = injectDefines(vM, defs);
        const fc = injectDefines(fM, defs);
        addJob(glJobs, { label: label('vertex'), stage: 'vert', code: vc });
        addJob(glJobs, { label: label('fragment'), stage: 'frag', code: fc });
        const before = new Set(missingVaryings(injectDefines(vV, defs), injectDefines(fV, defs)));
        const missing = missingVaryings(vc, fc).filter((n) => !before.has(n));
        if (missing.length) fail(`${prog.label}: fragment inputs ${missing.join(', ')} are not written by ${prog.vsh}`);
        if (vulkan262) {
          const vk: Define[] = [...defs, ['gl_VertexID', 'gl_VertexIndex'], ['gl_InstanceID', 'gl_InstanceIndex']];
          addJob(vk262Jobs, { label: label('vertex (Vulkan)'), stage: 'vert', code: injectDefines(vM, vk) });
          addJob(vk262Jobs, { label: label('fragment (Vulkan)'), stage: 'frag', code: injectDefines(fM, vk) });
        }
      }
      // ---- uniforms: nothing may appear that the pipeline / program does not provide
      for (const [before, after, stage] of [[vV, vM, 'vertex'], [fV, fM, 'fragment']] as const) {
        const added = [...declaredDescriptors(after)].filter((d) => !declaredDescriptors(before).has(d));
        const addedPlain = [...plainUniforms(after)].filter((d) => !plainUniforms(before).has(d));
        if (prog.layout) {
          const allowed = new Set([...prog.layout, ...(fam.id === 'F4' && !vulkan262 ? GL_BUILTIN_BLOCKS : [])]);
          for (const d of [...added, ...addedPlain]) if (!allowed.has(d)) fail(`${prog.label} ${stage}: declares ${d}, which the pipeline does not provide`);
        } else if (fam.id === 'F6' && added.length) {
          fail(`${prog.label} ${stage}: new descriptors ${added.join(', ')} (26.3+ pipelines reject them)`);
        }
        if (prog.jsonUniforms) {
          const jsonPath = `${CORE}${prog.label}`;
          const list = new Set(prog.jsonUniforms);
          try {
            for (const u of (JSON.parse(merged[jsonPath]) as { uniforms?: { name: string }[] }).uniforms ?? []) list.add(u.name);
          } catch {
            /* reported above */
          }
          for (const d of addedPlain) if (!list.has(d)) fail(`${prog.label} ${stage}: uniform ${d} is not listed in the program JSON, so it is never set`);
        }
        if (fam.id === 'F3' && addedPlain.length) fail(`${prog.label} ${stage}: 1.21.5 cannot receive new uniforms (${addedPlain.join(', ')})`);
      }
    }
  }

  if (glslang) {
    const gl = [...glJobs.values()];
    const vk = [...vkJobs.values()];
    const vk262 = [...vk262Jobs.values()];
    report.glChecked = gl.length;
    report.vulkanChecked = vk.length + vk262.length;
    for (const f of await compileGL(glslang, gl)) report.failures.push(`GLSL (OpenGL) ${f.label}: ${f.log}`);
    for (const f of await compileVulkan(glslang, vk)) report.failures.push(`GLSL (Vulkan/shaderc) ${f.label}: ${f.log}`);
    for (const f of await compileVulkan(glslang, vk262, ['--auto-map-locations'])) report.failures.push(`GLSL (26.2 Vulkan backend) ${f.label}: ${f.log}`);
  }
  return report;
}

export function familyOf(jar: JarRef): Family | null {
  const vs = loadVersionShaders(jar);
  return detectFamily(vs.sources, packFormatOf(jar.version, vs.packFormat));
}

async function main(): Promise<void> {
  const want = process.argv.slice(2);
  const jars = listJars().filter((j) => !want.length || want.includes(j.version));
  const glslang = findGlslang();
  if (!glslang) console.log('glslangValidator not found: structural checks only.');
  let failed = 0;
  for (const jar of jars) {
    const t = Date.now();
    const r = await validateVersion(jar, glslang);
    failed += r.failures.length;
    console.log(`${r.version.padEnd(16)} pf ${String(r.packFormat).padStart(3)} ${r.family.padEnd(4)} programs ${String(r.programs).padStart(3)} files ${String(r.changedFiles).padStart(3)} ` +
      `GL ${String(r.glChecked).padStart(4)} VK ${String(r.vulkanChecked).padStart(4)} failures ${r.failures.length} (${Date.now() - t} ms)`);
    for (const f of r.failures.slice(0, 12)) console.log('   FAIL', f);
    if (r.failures.length > 12) console.log(`   ... ${r.failures.length - 12} more`);
  }
  process.exitCode = failed ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main();
