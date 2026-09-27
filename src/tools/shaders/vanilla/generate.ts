// "Vanilla Java" shader pack: patches the selected version's own core shaders (read from its jar).
// Only new or changed files are returned; untouched vanilla files keep coming from the game.

import type { FileMap, OptionValues, PackFormat } from '../../../core/types';
import { readSettings } from './options';
import type { Settings } from './options';
import { fogTintMultiplier, hasFogChange, hasGrade, hasVignette } from './color';
import {
  BANNER, CORE, INCLUDE, POST_EFFECT, MAIN_NOTE, POST_SHADERS, PREFIX, SHADERS_ROOT, VANILLA_MAIN,
  declares, expandForAnalysis, fragmentOutputs, glslFloat, glslVec3, mentions, renameMain, uboNames, wrapFunction,
} from './glsl';
import type { FunctionSignature } from './glsl';
import { NO_CORE_SHADERS_MESSAGE, detectFamily, importLine, majorFormat, missingSourcesMessage, wavingTarget } from './support';
import type { Family } from './support';
import {
  POST_NAMES, darknessBody, endOfFrameJson, fogEnvironmentFunction, gradeExpression, postBlurShader, postBrightShader,
  postFinalShader, postInclude, waveBody, waveFunction,
} from './templates';

export interface VanillaShaderResult {
  files: FileMap;
  warnings: string[];
  supported: boolean;
}

export interface VanillaVersionInfo {
  versionId: string;
  packFormat: PackFormat;
}

/** Shaders whose colour output is not the world's final colour (or which run for the GUI only). */
export const GRADE_DENY = /^(blit_screen|blit_depth|lightmap|animate_sprite.*|panorama|gui|rendertype_gui.*|integrate_depth|oit_.*|rendertype_outline|rendertype_water_mask|rendertype_crumbling|glint|rendertype_.*glint.*|screenquad|rendertype_eyes|rendertype_energy_swirl|rendertype_lightning)$/;

const P = PREFIX;
const POST_INCLUDE_FILE = `${P}_post.glsl`;

interface WrapPlan {
  decls: string[];
  /** statements that move the vertex (run first) */
  pre: string[];
  /** statements that read the final result */
  post: string[];
}

class Patcher {
  readonly out: Record<string, string> = {};
  readonly warnings: string[] = [];
  private readonly plans = new Map<string, WrapPlan>();

  constructor(readonly sources: Record<string, string>) {}

  get(path: string): string | undefined {
    return this.out[path] ?? this.sources[path];
  }

  warn(msg: string): void {
    if (!this.warnings.includes(msg)) this.warnings.push(msg);
  }

  plan(path: string): WrapPlan {
    let p = this.plans.get(path);
    if (!p) {
      p = { decls: [], pre: [], post: [] };
      this.plans.set(path, p);
    }
    return p;
  }

  hasPlan(path: string): boolean {
    return this.plans.has(path);
  }

  /** Renames main() of every planned shader and appends the declarations and the new main(). */
  flush(): void {
    for (const [path, plan] of [...this.plans.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const original = this.get(path);
      if (original === undefined) continue;
      const renamed = renameMain(original);
      if (renamed === null) {
        this.warn(`Skipped ${short(path)}: it does not have exactly one main() function.`);
        continue;
      }
      const decls = [...new Set(plan.decls)];
      const body = [...plan.pre, ...plan.post].map((l) => (l.startsWith('#') ? l : '    ' + l));
      this.out[path] = [
        renamed.endsWith('\n') ? renamed : renamed + '\n',
        BANNER,
        MAIN_NOTE,
        ...decls,
        'void main() {',
        `    ${VANILLA_MAIN}();`,
        ...body,
        '}',
        '',
      ].join('\n');
    }
    this.plans.clear();
  }
}

function short(path: string): string {
  return path.replace(/^assets\/minecraft\/shaders\//, '');
}

function base(id: string): string {
  const path = id.includes(':') ? id.slice(id.indexOf(':') + 1) : id;
  return path.slice(path.lastIndexOf('/') + 1);
}

interface ProgramPair {
  vsh: string;
  fsh: string;
  json: string | null;
}

/** Which vertex shader feeds which fragment shader (program JSON up to 1.21.4, same basename after). */
function programPairs(sources: Record<string, string>, fam: Family): ProgramPair[] {
  const pairs: ProgramPair[] = [];
  if (fam.json) {
    for (const [k, text] of Object.entries(sources)) {
      if (!k.startsWith(CORE) || !k.endsWith('.json')) continue;
      let j: unknown;
      try {
        j = JSON.parse(text);
      } catch {
        continue;
      }
      const o = j as { vertex?: unknown; fragment?: unknown };
      if (typeof o?.vertex === 'string' && typeof o.fragment === 'string') pairs.push({ vsh: base(o.vertex), fsh: base(o.fragment), json: k });
    }
  } else {
    for (const k of Object.keys(sources)) {
      if (!k.startsWith(CORE) || !k.endsWith('.fsh')) continue;
      const b = k.slice(CORE.length, -4);
      if (b.includes('/')) continue;
      if (sources[`${CORE}${b}.vsh`] !== undefined) pairs.push({ vsh: b, fsh: b, json: null });
    }
  }
  return pairs.sort((a, b) => (a.fsh + a.vsh).localeCompare(b.fsh + b.vsh));
}

// ---------------------------------------------------------------- (a)+(b) grading and vignette, 1.17 – 26.2

function patchWorldFragments(pt: Patcher, fam: Family, s: Settings, withGrade: boolean, withVignette: boolean): void {
  const src = pt.sources;
  const byFsh = new Map<string, ProgramPair[]>();
  for (const p of programPairs(src, fam)) {
    const list = byFsh.get(p.fsh) ?? [];
    list.push(p);
    byFsh.set(p.fsh, list);
  }
  const varyings = !fam.ubo;
  const vertexShaders = new Set<string>();
  let patched = 0;
  const hasInclude = (f: string): boolean => src[INCLUDE + f] !== undefined;
  for (const [fsh, partners] of byFsh) {
    if (GRADE_DENY.test(fsh)) continue;
    const fpath = `${CORE}${fsh}.fsh`;
    const code = src[fpath];
    if (code === undefined) continue;
    const outs = fragmentOutputs(code);
    if (outs.length !== 1) continue;
    const outVar = outs[0];
    const plan: string[] = [];
    let cond: string;
    let point: string;
    if (varyings) {
      // Every vertex shader feeding this fragment shader must know ProjMat for the world/GUI test.
      const ok = partners.every((p) => {
        const vpath = `${CORE}${p.vsh}.vsh`;
        const v = src[vpath];
        return v !== undefined && mentions(expandForAnalysis(v, src, vpath), 'ProjMat');
      });
      if (!ok) continue;
      plan.push(`in vec4 ${P}_clipPos;`, `in float ${P}_aspect;`, importLine(fam, POST_INCLUDE_FILE));
      cond = `${P}_aspect > 0.0001`;
      point = `(${P}_clipPos.xy / ${P}_clipPos.w) * 0.5 * vec2(${P}_aspect, 1.0)`;
    } else {
      const expanded = expandForAnalysis(code, src, fpath);
      const ubos = uboNames(expanded);
      // Projection and Globals are bound automatically when a shader declares them (built-in blocks).
      if (!declares(expanded, 'mat4', 'ProjMat')) {
        if (ubos.has('Projection') || !hasInclude('projection.glsl')) continue;
        plan.push(importLine(fam, 'projection.glsl'));
      }
      if (withVignette && !declares(expanded, 'vec2', 'ScreenSize')) {
        if (ubos.has('Globals') || !hasInclude('globals.glsl')) continue;
        plan.push(importLine(fam, 'globals.glsl'));
      }
      plan.push(importLine(fam, POST_INCLUDE_FILE));
      cond = 'abs(ProjMat[2][3]) > 0.0001';
      point = `(gl_FragCoord.xy / ScreenSize - 0.5) * vec2(ScreenSize.x / ScreenSize.y, 1.0)`;
    }
    if (renameMain(code) === null) {
      pt.warn(`Skipped ${short(fpath)}: it does not have exactly one main() function.`);
      continue;
    }
    if (varyings) {
      const bad = partners.find((p) => renameMain(src[`${CORE}${p.vsh}.vsh`] ?? '') === null);
      if (bad) {
        pt.warn(`Skipped ${short(fpath)}: ${bad.vsh}.vsh does not have exactly one main() function.`);
        continue;
      }
      for (const p of partners) vertexShaders.add(p.vsh);
    }
    const fp = pt.plan(fpath);
    fp.decls.push(...plan);
    // Additive/emissive overlays (1.21.2+ entity eyes and energy swirl) must stay ungraded: a brightness
    // lift would turn their transparent black texels into a glow over the whole model.
    fp.post.push(
      '#if !(defined(EMISSIVE) && defined(NO_OVERLAY))',
      `if (${cond}) {`,
      `    ${outVar}.rgb = ${gradeExpression(outVar, withGrade, withVignette, point)};`,
      '}',
      '#endif',
    );
    patched++;
  }
  for (const vsh of vertexShaders) {
    const vp = pt.plan(`${CORE}${vsh}.vsh`);
    vp.decls.push(`out vec4 ${P}_clipPos;`, `out float ${P}_aspect;`);
    // Perspective projection = world (value = aspect ratio); orthographic = GUI and items in the GUI.
    // The title-screen panorama (≤ 1.21.5) is perspective too but has a 10-block far plane
    // (ProjMat[2][2] ≈ -1.01; the world's far plane is ≥ 128 blocks, ≈ -1.0008), so it counts as GUI.
    vp.post.push(
      `${P}_aspect = abs(ProjMat[2][3]) > 0.0001 && ProjMat[2][2] > -1.005 ? abs(ProjMat[1][1] / ProjMat[0][0]) : 0.0;`,
      `${P}_clipPos = gl_Position;`,
    );
  }
  if (patched === 0) {
    pt.warn('Colors and vignette skipped: no world shader in this version matched the expected layout.');
    return;
  }
  pt.out[`${INCLUDE}${POST_INCLUDE_FILE}`] = postInclude(s, withGrade, withVignette);
}

// ---------------------------------------------------------------- (a)+(b) 26.3+: end_of_frame post effect

function endOfFrameFiles(pt: Patcher, s: Settings, withGrade: boolean, withVignette: boolean, bloom: boolean): void {
  const src = pt.sources;
  if (src[`${CORE}screenquad.vsh`] === undefined || src[`${POST_SHADERS}blit.fsh`] === undefined) {
    pt.warn('Colors, vignette and bloom skipped: this version is missing the full-screen shaders they build on.');
    return;
  }
  pt.out[`${POST_SHADERS}${POST_NAMES.final}.fsh`] = postFinalShader(s, withGrade, withVignette, bloom);
  if (bloom) {
    pt.out[`${POST_SHADERS}${POST_NAMES.bright}.fsh`] = postBrightShader(s);
    pt.out[`${POST_SHADERS}${POST_NAMES.blur}.fsh`] = postBlurShader();
  }
  pt.out[`${POST_EFFECT}end_of_frame.json`] = endOfFrameJson(bloom);
}

// ---------------------------------------------------------------- (d) fog: include/fog.glsl

/** Vanilla fog API signatures the wrappers depend on (v1: 1.17 – 1.21.5, v2: 1.21.6+). */
export const FOG_SIGNATURES: Record<'linear_fog' | 'linear_fog_fade' | 'total_fog_value' | 'apply_fog', FunctionSignature> = {
  linear_fog: { ret: 'vec4', params: ['vec4', 'float', 'float', 'float', 'vec4'] },
  linear_fog_fade: { ret: 'float', params: ['float', 'float', 'float'] },
  total_fog_value: { ret: 'float', params: ['float', 'float', 'float', 'float', 'float', 'float'] },
  apply_fog: { ret: 'vec4', params: ['vec4', 'float', 'float', 'float', 'float', 'float', 'float', 'vec4'] },
};

function patchFog(pt: Patcher, fam: Family, s: Settings): void {
  const path = `${INCLUDE}fog.glsl`;
  let code = pt.get(path);
  const change = hasFogChange(s);
  if (code === undefined || fam.fogApi === null) {
    pt.warn('Fog settings skipped: this version has an unfamiliar fog shader.');
    return;
  }
  const k = glslFloat(s.fogStart);
  const tint = glslVec3(fogTintMultiplier(s));
  // Pull the start closer, never move the end: render-distance fog hides the chunk border.
  // start > end means "no fog" (e.g. Float.MAX_VALUE, 0) and must stay untouched.
  const start = (st: string, end: string): string => (change.start ? `(${st} <= ${end} ? min(${st}, ${end} * ${k}) : ${st})` : st);
  const color = (c: string): string => (change.tint ? `vec4(${c}.rgb * ${tint}, ${c}.a)` : c);
  const helpers: string[] = [];
  const wrappers: string[] = [];
  const wrap = (name: string, signature: FunctionSignature, build: (a: string[]) => string[]): boolean => {
    const r = wrapFunction(code as string, name, signature, build);
    if (typeof r === 'string') {
      pt.warn(`Fog: ${r} in include/fog.glsl, so part of the fog settings is skipped.`);
      return false;
    }
    code = r.code;
    wrappers.push(r.wrapper);
    return true;
  };
  if (fam.fogApi === 'v1') {
    if (change.start || change.tint) wrap('linear_fog', FOG_SIGNATURES.linear_fog, (a) => [a[0], a[1], start(a[2], a[3]), a[3], color(a[4])]);
    if (change.start) wrap('linear_fog_fade', FOG_SIGNATURES.linear_fog_fade, (a) => [a[0], start(a[1], a[2]), a[2]]);
    if (change.environment) pt.warn('Water & weather fog distance needs Java 1.21.6 or newer; it was left at vanilla.');
  } else {
    // Environmental fog is scaled by txo_fog_env(end), which leaves Blindness, Darkness, lava and
    // powder snow at their vanilla distances (see ENV_FOG_PROTECT_END).
    const envScale = (x: string, end: string): string => (change.environment ? `${x} * ${P}_fog_env(${end})` : x);
    if (change.start || change.environment) {
      const ok = wrap('total_fog_value', FOG_SIGNATURES.total_fog_value,
        (a) => [a[0], a[1], envScale(a[2], a[3]), envScale(a[3], a[3]), start(a[4], a[5]), a[5]]);
      if (ok && change.environment) helpers.push(fogEnvironmentFunction(s.fogEnvironment));
    }
    if (change.tint) wrap('apply_fog', FOG_SIGNATURES.apply_fog, (a) => [...a.slice(0, 7), color(a[7])]);
  }
  if (wrappers.length === 0) return;
  const text = code as string;
  pt.out[path] = `${text.endsWith('\n') ? text : text + '\n'}\n${BANNER}\n` +
    `#ifndef TXO_FOG_WRAPPERS\n#define TXO_FOG_WRAPPERS\n${[...helpers, ...wrappers].join('\n')}#endif\n`;
}

// ---------------------------------------------------------------- (c) waving plants

interface ProgramUniform {
  name: string;
  type: string;
  count: number;
  values: number[];
}

function uniformLine(u: ProgramUniform): string {
  const values = u.values.map((x) => glslFloat(x)).join(', ');
  return `{ "name": "${u.name}", "type": "${u.type}", "count": ${u.count}, "values": [ ${values} ] }`;
}

/** Index of the bracket closing the one at `open`, skipping strings; -1 when unbalanced. */
function matchingBracket(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      for (i++; i < text.length && text[i] !== '"'; i++) if (text[i] === '\\') i++;
    } else if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Adds a uniform to a program JSON (1.17 – 1.21.4), keeping the vanilla text and appending one line
 * to its "uniforms" list. Returns the text unchanged when the uniform exists, null when unreadable.
 */
export function addProgramUniform(text: string, u: ProgramUniform): string | null {
  let parsed: { uniforms?: unknown };
  try {
    parsed = JSON.parse(text) as { uniforms?: unknown };
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const list = parsed.uniforms;
  if (list !== undefined && !Array.isArray(list)) return null;
  if (Array.isArray(list) && list.some((x) => (x as { name?: unknown })?.name === u.name)) return text;
  const expected = JSON.stringify({ ...parsed, uniforms: [...(list ?? []), u] });
  let out: string | null = null;
  const key = /"uniforms"\s*:\s*\[/.exec(text);
  if (key && Array.isArray(list)) {
    const open = key.index + key[0].length - 1;
    const close = matchingBracket(text, open);
    if (close > open) {
      const inner = text.slice(open + 1, close);
      const indent = /\n([ \t]*)\{/.exec(inner)?.[1] ?? '        ';
      const trimmedEnd = inner.replace(/\s*$/, '');
      const tail = inner.slice(trimmedEnd.length);
      const glue = list.length ? ',' : '';
      out = text.slice(0, open + 1) + trimmedEnd + `${glue}\n${indent}${uniformLine(u)}` + (tail.includes('\n') ? tail : '\n' + tail) + text.slice(close);
    }
  }
  const same = (t: string | null): boolean => {
    if (t === null) return false;
    try {
      return JSON.stringify(JSON.parse(t)) === expected;
    } catch {
      return false;
    }
  };
  if (same(out)) return out as string;
  return JSON.stringify({ ...parsed, uniforms: [...(list ?? []), u] }, null, 4) + '\n';
}

function patchWaving(pt: Patcher, fam: Family, s: Settings): void {
  const src = pt.sources;
  const target = wavingTarget(src, fam);
  if ('reason' in target) {
    pt.warn(`Waving plants skipped: ${target.reason}`);
    return;
  }
  const { path, mode } = target;
  const code = src[path];
  if (code === undefined || renameMain(code) === null) {
    pt.warn('Waving plants skipped: unexpected terrain vertex shader.');
    return;
  }
  const expanded = expandForAnalysis(code, src, path);
  const needs: [string, string][] = [['vec3', 'Position'], ['vec4', 'Color'], ['vec3', 'Normal']];
  for (const [type, name] of needs) {
    if (!new RegExp(`\\bin\\s+${type}\\s+${name}\\s*;`).test(expanded)) {
      pt.warn(`Waving plants skipped: the terrain shader has no ${name} input.`);
      return;
    }
  }
  if (!declares(expanded, 'mat4', 'ProjMat') || !declares(expanded, 'mat4', 'ModelViewMat')) {
    pt.warn('Waving plants skipped: the terrain shader does not use the usual matrices.');
    return;
  }
  const decls: string[] = [];
  if (mode === 'F4') {
    if (!declares(expanded, 'float', 'GameTime')) {
      if (uboNames(expanded).has('Globals') || src[`${INCLUDE}globals.glsl`] === undefined) {
        pt.warn('Waving plants skipped: game time is not available to the terrain shader.');
        return;
      }
      decls.push(importLine(fam, 'globals.glsl'));
    }
  } else if (!declares(expanded, 'float', 'GameTime')) {
    decls.push('uniform float GameTime;');
  }
  // Program JSON (≤ 1.21.4): a uniform is only uploaded when the program lists it.
  if (fam.json) {
    const vsBase = path.slice(CORE.length, -4);
    for (const pair of programPairs(src, fam)) {
      if (pair.vsh !== vsBase || !pair.json) continue;
      const text = pt.get(pair.json) as string;
      const updated = addProgramUniform(text, { name: 'GameTime', type: 'float', count: 1, values: [0] });
      if (updated === null) pt.warn(`Waving plants: could not read ${short(pair.json)}; plants drawn with it will not move.`);
      else if (updated !== text) pt.out[pair.json] = updated;
    }
  }
  decls.push(waveFunction(s));
  const plan = pt.plan(path);
  plan.decls.push(...decls);
  plan.pre.push(...waveBody(mode !== 'F1'));
}

// ---------------------------------------------------------------- darker nights: core/lightmap.fsh

function patchLightmap(pt: Patcher, s: Settings): void {
  const path = `${CORE}lightmap.fsh`;
  const code = pt.sources[path];
  if (code === undefined) {
    pt.warn('Darker nights skipped: the light map became a shader in Java 1.21.2.');
    return;
  }
  const outs = fragmentOutputs(code);
  if (outs.length !== 1 || renameMain(code) === null) {
    pt.warn('Darker nights skipped: unexpected light map shader.');
    return;
  }
  pt.plan(path).post.push(...darknessBody(outs[0], s.nightDarkness));
}

// ---------------------------------------------------------------- entry point

/**
 * Builds the changed shader files for one Java version.
 * `sources`: every file under assets/minecraft/shaders/ and assets/minecraft/post_effect/ of that version's jar.
 * Returns resource-pack paths (pack.mcmeta / pack.png are added by the caller).
 */
export function generateVanillaShaderFiles(
  sources: Record<string, string>,
  v: OptionValues,
  info: VanillaVersionInfo,
): VanillaShaderResult {
  const fam = detectFamily(sources, info?.packFormat);
  if (!fam) {
    // No shader files at all for a 1.17+ pack format means the game files were not read, not that
    // the version is too old.
    const noFiles = !Object.keys(sources ?? {}).some((k) => k.startsWith(SHADERS_ROOT));
    const message = noFiles && majorFormat(info?.packFormat) >= 7 ? missingSourcesMessage(info.versionId) : NO_CORE_SHADERS_MESSAGE;
    return { files: {}, warnings: [message], supported: false };
  }
  const s = readSettings(v);
  const pt = new Patcher(sources);

  const grade = hasGrade(s);
  const vignette = hasVignette(s);
  if (fam.endOfFrame) {
    if (grade || vignette || s.bloom) endOfFrameFiles(pt, s, grade, vignette, s.bloom);
  } else {
    if (s.bloom) pt.warn('Bloom needs Java 26.3 or newer; it was left out for this version.');
    if (fam.id === 'F6') {
      if (grade || vignette) pt.warn('Colors and vignette skipped: this version uses the new shader compiler without the full-screen effect hook.');
    } else if (grade || vignette) {
      patchWorldFragments(pt, fam, s, grade, vignette);
    }
  }

  const fog = hasFogChange(s);
  if (fog.start || fog.environment || fog.tint) patchFog(pt, fam, s);
  if (s.waving) patchWaving(pt, fam, s);
  if (s.nightDarkness > 0) patchLightmap(pt, s);
  pt.flush();

  const files: FileMap = {};
  for (const k of Object.keys(pt.out).sort()) files[k] = pt.out[k];
  const warnings = [...pt.warnings];
  if (Object.keys(files).length === 0 && warnings.length === 0) {
    warnings.push('Every setting matches vanilla, so this pack does not change how the game looks.');
  }
  return { files, warnings, supported: true };
}

/** Suggested pack.mcmeta description: the pack only works in the version it was made for. */
export function vanillaPackDescription(versionId: string, name?: string): string {
  const title = name?.trim() ? `${name.trim()} · ` : '';
  return `${title}Shaders for Java ${versionId} only. Made with TexturesOnline`;
}
