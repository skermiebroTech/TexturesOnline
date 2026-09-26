// Offline checks for generated Iris / OptiFine shader packs (used by tests/unit/iris-*.test.ts).
// Emulates what the loaders do before a program reaches the driver: #include expansion from the
// shaders/ root, option overrides, standard macros injected after #version, and (for Iris and
// OptiFine on Minecraft 1.17+) the rewrite of GLSL 1.20 into 330 core. Every file is then compiled
// with glslangValidator; files are batched into few processes that run in parallel.

import { execFile } from 'node:child_process';
import { accessSync, constants, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { createHash } from 'node:crypto';

export type Stage = 'vert' | 'frag';

const FALLBACK_GLSLANG = 'glslangValidator';

function isExecutable(p: string): boolean {
  try {
    accessSync(p, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** glslangValidator from $GLSLANG_VALIDATOR, then PATH, then the local tools folder; null when absent. */
export function findGlslang(): string | null {
  const fromEnv = process.env.GLSLANG_VALIDATOR;
  if (fromEnv && isExecutable(fromEnv)) return fromEnv;
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    if (!dir) continue;
    for (const name of ['glslangValidator', 'glslangValidator.exe']) {
      const p = join(dir, name);
      if (existsSync(p) && isExecutable(p)) return p;
    }
  }
  return existsSync(FALLBACK_GLSLANG) && isExecutable(FALLBACK_GLSLANG) ? FALLBACK_GLSLANG : null;
}

// ------------------------------------------------------------------ loader environments

const IRIS_STAGES = ['NONE', 'SKY', 'SUNSET', 'CUSTOM_SKY', 'SUN', 'MOON', 'STARS', 'VOID', 'TERRAIN_SOLID', 'TERRAIN_CUTOUT_MIPPED',
  'TERRAIN_CUTOUT', 'ENTITIES', 'BLOCK_ENTITIES', 'DESTROY', 'OUTLINE', 'DEBUG', 'HAND_SOLID', 'TERRAIN_TRANSLUCENT', 'TRIPWIRE',
  'PARTICLES', 'CLOUDS', 'RAIN_SNOW', 'WORLD_BORDER', 'HAND_TRANSLUCENT'];
const OPTIFINE_STAGES = IRIS_STAGES.filter((s) => s !== 'TERRAIN_CUTOUT_MIPPED');
const stages = (list: string[]): Record<string, string> => Object.fromEntries(list.map((s, i) => [`MC_RENDER_STAGE_${s}`, String(i)]));

export interface LoaderEnv {
  name: string;
  macros: Record<string, string>;
  /** Minecraft 1.17+: the loader rewrites the pack's GLSL 1.20 into 330 core */
  core: boolean;
}

export const ENVIRONMENTS: LoaderEnv[] = [
  {
    name: 'iris-26.3',
    core: true,
    macros: {
      MC_VERSION: '260300', IRIS_VERSION: '11106', IS_IRIS: '', IRIS_TAG_SUPPORT: '2', MC_GL_VERSION: '460', MC_GLSL_VERSION: '460',
      MC_OS_LINUX: '', MC_GL_VENDOR_NVIDIA: '', MC_GL_RENDERER_GEFORCE: '', MC_NORMAL_MAP: '', MC_SPECULAR_MAP: '',
      MC_RENDER_QUALITY: '1.0', MC_SHADOW_QUALITY: '1.0', MC_HAND_DEPTH: '0.125', MAX_COLOR_BUFFERS: '32', ...stages(IRIS_STAGES),
    },
  },
  {
    name: 'iris-1.16.5',
    core: false,
    macros: { MC_VERSION: '11605', IRIS_VERSION: '10000', IS_IRIS: '', MC_GL_VERSION: '460', MC_GLSL_VERSION: '460', MC_OS_WINDOWS: '', MC_GL_VENDOR_AMD: '' },
  },
  {
    name: 'optifine-1.21.11',
    core: true,
    macros: { MC_VERSION: '12111', MC_GL_VERSION: '320', MC_GLSL_VERSION: '150', MC_OS_WINDOWS: '', MC_GL_VENDOR_INTEL: '', ...stages(OPTIFINE_STAGES) },
  },
  {
    name: 'optifine-1.12.2',
    core: false,
    macros: { MC_VERSION: '11202', MC_GL_VERSION: '210', MC_GLSL_VERSION: '120', MC_OS_MAC: '', MC_GL_VENDOR_ATI: '' },
  },
  {
    name: 'optifine-1.8.9',
    core: false,
    macros: { MC_VERSION: '10809', MC_GL_VERSION: '210', MC_GLSL_VERSION: '120', MC_OS_WINDOWS: '', MC_GL_VENDOR_INTEL: '' },
  },
  { name: 'bare', core: false, macros: {} },
];

// ------------------------------------------------------------------ source transforms

const INCLUDE_RE = /^\s*#include\s+"([^"]+)"\s*$/;

/** Expands #include like the loaders: "/x" is relative to shaders/, "x" to the including file. */
export function expandIncludes(files: Record<string, string>, path: string, depth = 0): string {
  if (depth > 10) throw new Error(`include depth > 10 at ${path}`);
  const src = files[path];
  if (src === undefined) throw new Error(`missing file ${path}`);
  const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
  return src
    .split(/\r?\n/)
    .map((line) => {
      const m = INCLUDE_RE.exec(line);
      if (!m) return line;
      const target = m[1].startsWith('/') ? m[1].slice(1) : dir + m[1];
      if (files[target] === undefined) throw new Error(`missing include ${m[1]} (from ${path})`);
      return expandIncludes(files, target, depth + 1);
    })
    .join('\n');
}

const DEFINE_RE = /^(\s*)(\/\/\s*)?#define\s+(\w+)(\s+([^\s/]+))?(.*)$/;

/** Rewrites #define lines like the in-game option menu does (true/false toggle booleans). */
export function applyOverrides(src: string, overrides: Record<string, string | boolean>): string {
  return src
    .split('\n')
    .map((line) => {
      const m = DEFINE_RE.exec(line);
      if (!m || !(m[3] in overrides)) return line;
      const v = overrides[m[3]];
      if (v === true) return `#define ${m[3]}`;
      if (v === false) return `//#define ${m[3]}`;
      return `#define ${m[3]} ${v}`;
    })
    .join('\n');
}

export function injectMacros(src: string, macros: Record<string, string>): string {
  const lines = src.split('\n');
  const i = lines.findIndex((l) => l.trim().startsWith('#version'));
  if (i < 0) throw new Error('no #version line');
  const extra = Object.entries(macros).map(([k, v]) => `#define ${k} ${v}`.trimEnd());
  return [...lines.slice(0, i + 1), ...extra, ...lines.slice(i + 1)].join('\n');
}

function wrapCalls(s: string, fname: string, wrap: (args: string) => string): string {
  const re = new RegExp(`\\b${fname}\\s*\\(`, 'g');
  let out = '';
  let i = 0;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    out += s.slice(i, m.index);
    let depth = 1;
    let j = m.index + m[0].length;
    while (depth && j < s.length) {
      if (s[j] === '(') depth++;
      else if (s[j] === ')') depth--;
      j++;
    }
    out += wrap(s.slice(m.index + m[0].length, j - 1));
    i = j;
    re.lastIndex = j;
  }
  return out + s.slice(i);
}

/**
 * Rough emulation of the GLSL 1.20 -> 330 core rewrite done by Iris (glsl-transformer) and
 * OptiFine (ShadersCompatibility) on Minecraft 1.17+. Catches identifiers that become keywords
 * and functions that do not exist in core GLSL.
 */
export function toCore(src: string, stage: Stage): string {
  let s = src.replace(/#version\s+\d+(\s+\w+)?/, '#version 330 core');
  s = s.replace(/\battribute\b/g, 'in').replace(/\bvarying\b/g, stage === 'vert' ? 'out' : 'in');
  s = wrapCalls(s, 'shadow2D', (a) => `vec4(texture(${a}))`);
  s = s.replace(/\btexture2DLod\b/g, 'textureLod').replace(/\btexture2D\b/g, 'texture').replace(/\btexture3D\b/g, 'texture');
  s = s.split('ftransform()').join('(projectionMatrix * modelViewMatrix * vec4(vaPosition, 1.0))');
  s = s.split('gl_ModelViewProjectionMatrix').join('(projectionMatrix * modelViewMatrix)');
  s = s.split('gl_ModelViewMatrix').join('modelViewMatrix').split('gl_ProjectionMatrix').join('projectionMatrix');
  s = s.split('gl_NormalMatrix').join('normalMatrix').split('gl_TextureMatrix[0]').join('textureMatrix');
  s = s.split('gl_TextureMatrix[1]').join('TEXTURE_MATRIX_2');
  s = s.split('gl_Vertex').join('vec4(vaPosition, 1.0)').split('gl_Color').join('vaColor').split('gl_Normal').join('vaNormal');
  s = s.split('gl_MultiTexCoord0').join('vec4(vaUV0, 0.0, 1.0)').split('gl_MultiTexCoord1').join('vec4(vec2(vaUV2), 0.0, 1.0)');
  const pre: string[] = [];
  if (stage === 'vert') {
    pre.push('in vec3 vaPosition;', 'in vec4 vaColor;', 'in vec2 vaUV0;', 'in ivec2 vaUV2;', 'in vec3 vaNormal;',
      'uniform mat4 modelViewMatrix;', 'uniform mat4 projectionMatrix;', 'uniform mat3 normalMatrix;', 'uniform mat4 textureMatrix;',
      'const mat4 TEXTURE_MATRIX_2 = mat4(vec4(0.00390625, 0.0, 0.0, 0.0), vec4(0.0, 0.00390625, 0.0, 0.0), vec4(0.0, 0.0, 0.00390625, 0.0), vec4(0.03125, 0.03125, 0.03125, 1.0));');
  } else {
    const idx = new Set([...s.matchAll(/gl_FragData\[(\d+)\]/g)].map((m) => Number(m[1])));
    if (s.includes('gl_FragColor')) idx.add(0);
    for (const i of [...idx].sort((a, b) => a - b)) {
      pre.push(`layout(location = ${i}) out vec4 outColor${i};`);
      s = s.split(`gl_FragData[${i}]`).join(`outColor${i}`);
    }
    s = s.split('gl_FragColor').join('outColor0');
  }
  const lines = s.split('\n');
  return [lines[0], ...pre, ...lines.slice(1)].join('\n');
}

// ------------------------------------------------------------------ compiling

export interface CompileJob {
  /** Label used in failure reports */
  label: string;
  stage: Stage;
  source: string;
}

export interface CompileFailure {
  label: string;
  output: string;
}

function run(cmd: string, args: string[]): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
      const code = err ? (typeof (err as { code?: unknown }).code === 'number' ? ((err as { code: number }).code) : 1) : 0;
      resolve({ code, out: `${stdout}${stderr}` });
    });
  });
}

async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}

export interface CompileStats {
  jobs: number;
  unique: number;
  failures: CompileFailure[];
}

/**
 * Compiles every job with glslangValidator. Identical sources are compiled once; files are
 * batched into a few processes that run in parallel.
 */
export async function compileAll(glslang: string, jobs: CompileJob[], opts: { batchSize?: number; concurrency?: number } = {}): Promise<CompileStats> {
  const dir = mkdtempSync(join(tmpdir(), 'iris-glsl-'));
  try {
    const byHash = new Map<string, { file: string; labels: string[] }>();
    for (const job of jobs) {
      const hash = createHash('sha1').update(job.stage).update('\0').update(job.source).digest('hex');
      const entry = byHash.get(hash);
      if (entry) {
        entry.labels.push(job.label);
        continue;
      }
      const file = join(dir, `${hash}.${job.stage}`);
      writeFileSync(file, job.source);
      byHash.set(hash, { file, labels: [job.label] });
    }
    const entries = [...byHash.values()];
    const size = opts.batchSize ?? 120;
    const batches: Array<typeof entries> = [];
    for (let i = 0; i < entries.length; i += size) batches.push(entries.slice(i, i + size));
    const failures: CompileFailure[] = [];
    await pool(batches, opts.concurrency ?? 4, async (batch) => {
      const { code, out } = await run(glslang, batch.map((e) => e.file));
      if (code === 0) return;
      const byFile = new Map(batch.map((e) => [e.file, e]));
      let current = batch.length === 1 ? batch[0] : undefined;
      const text = new Map<typeof current, string[]>();
      for (const line of out.split(/\r?\n/)) {
        const hit = byFile.get(line.trim());
        if (hit) {
          current = hit;
          continue;
        }
        if (!current) continue;
        const list = text.get(current) ?? [];
        list.push(line);
        text.set(current, list);
      }
      let attributed = false;
      for (const [entry, lines] of text) {
        if (!entry || !lines.some((l) => /ERROR/.test(l))) continue;
        attributed = true;
        failures.push({ label: entry.labels.join(', '), output: lines.join('\n').trim() });
      }
      if (!attributed) failures.push({ label: `batch of ${batch.length} files`, output: out.trim() });
    });
    return { jobs: jobs.length, unique: entries.length, failures };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Links a vertex + fragment pair (glslangValidator -l). Returns null when it links. */
export async function linkPair(glslang: string, vsrc: string, fsrc: string): Promise<string | null> {
  const dir = mkdtempSync(join(tmpdir(), 'iris-link-'));
  try {
    const v = join(dir, 'p.vert');
    const f = join(dir, 'p.frag');
    writeFileSync(v, vsrc);
    writeFileSync(f, fsrc);
    const { code, out } = await run(glslang, ['-l', v, f]);
    return code === 0 ? null : out.trim();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ------------------------------------------------------------------ interface checks

/**
 * Varyings declared in a (macro-injected, include-expanded) source. Throws when a varying is
 * declared inside a preprocessor conditional, which this textual check cannot evaluate.
 */
export function varyings(src: string): Map<string, string> {
  const out = new Map<string, string>();
  let depth = 0;
  let inBlock = false;
  for (const raw of src.split('\n')) {
    let line = raw;
    if (inBlock) {
      const end = line.indexOf('*/');
      if (end < 0) continue;
      line = line.slice(end + 2);
      inBlock = false;
    }
    line = line.replace(/\/\*.*?\*\//g, '');
    const open = line.indexOf('/*');
    if (open >= 0) {
      line = line.slice(0, open);
      inBlock = true;
    }
    line = line.replace(/\/\/.*$/, '').trim();
    if (/^#\s*(if|ifdef|ifndef)\b/.test(line)) depth++;
    else if (/^#\s*endif\b/.test(line)) depth--;
    const m = /^varying\s+(\w+)\s+([\w\s,]+);$/.exec(line);
    if (!m) continue;
    if (depth > 0) throw new Error(`varying declared inside a conditional: ${line}`);
    for (const name of m[2].split(',').map((n) => n.trim()).filter(Boolean)) out.set(name, m[1]);
  }
  return out;
}

/** Problems between a vertex and fragment shader's varyings (every fragment input must be written with the same type). */
export function checkVaryings(vsrc: string, fsrc: string): string[] {
  const vout = varyings(vsrc);
  const problems: string[] = [];
  for (const [name, type] of varyings(fsrc)) {
    const vt = vout.get(name);
    if (!vt) problems.push(`fragment input '${name}' is not written by the vertex shader`);
    else if (vt !== type) problems.push(`type mismatch for '${name}': vertex ${vt}, fragment ${type}`);
    else if (!new RegExp(`\\b${name}\\s*(\\.\\w+)?\\s*=[^=]`).test(vsrc)) problems.push(`vertex shader never assigns '${name}'`);
  }
  return problems;
}

// ------------------------------------------------------------------ option parsing & properties lint

const BOOL_RE = /^\s*(\/\/\s*)?#define\s+(\w+)\s*(\/\/.*)?$/;
const VALUE_RE = /^\s*#define\s+(\w+)\s+(\S+)\s*\/\/\s*\[([^\]]*)\]/;
const CONST_OPT_RE = /^\s*const\s+(?:int|float)\s+(\w+)\s*=\s*([^;\s]+)\s*;\s*\/\/\s*\[([^\]]*)\]/;
const IFDEF_RE = /^\s*#if(n?)def\s+(\w+)\s*$/;

export interface PackOptions {
  bools: Map<string, boolean>;
  values: Map<string, { value: string; list: string[] }>;
  /** Boolean defines referenced by #ifdef / #ifndef in the include-expanded program sources */
  referenced: Set<string>;
  problems: string[];
}

/** Options the loaders would find, read like OptiFine / Iris read them. */
export function parsePackOptions(files: Record<string, string>, root = 'shaders/'): PackOptions {
  const bools = new Map<string, boolean>();
  const values = new Map<string, { value: string; list: string[] }>();
  const problems: string[] = [];
  const referenced = new Set<string>();
  for (const [path, src] of Object.entries(files)) {
    if (!path.startsWith(root) || !/\.(glsl|vsh|fsh)$/.test(path)) continue;
    for (const line of src.split('\n')) {
      let m = BOOL_RE.exec(line);
      if (m) {
        const on = !m[1];
        if (bools.has(m[2]) && bools.get(m[2]) !== on) problems.push(`${m[2]}: boolean declared with different defaults`);
        bools.set(m[2], on);
        continue;
      }
      m = VALUE_RE.exec(line) ?? CONST_OPT_RE.exec(line);
      if (m) {
        const list = m[3].split(' ');
        if (list.includes('')) problems.push(`${m[1]}: value list has an empty entry (double space?)`);
        if (!list.includes(m[2])) problems.push(`${m[1]}: default ${m[2]} is not in its value list`);
        if (new Set(list).size !== list.length) problems.push(`${m[1]}: value list has duplicates`);
        const prev = values.get(m[1]);
        if (prev && prev.value !== m[2]) problems.push(`${m[1]}: declared with different defaults (ambiguous)`);
        values.set(m[1], { value: m[2], list });
      }
    }
  }
  const rel: Record<string, string> = {};
  for (const [path, src] of Object.entries(files)) if (path.startsWith(root)) rel[path.slice(root.length)] = src;
  for (const path of Object.keys(rel)) {
    if (!/\.(vsh|fsh)$/.test(path)) continue;
    const expanded = expandIncludes(rel, path);
    for (const line of expanded.split('\n')) {
      const m = IFDEF_RE.exec(line);
      if (m) referenced.add(m[2]);
    }
  }
  for (const name of bools.keys()) if (!referenced.has(name)) problems.push(`${name}: boolean never referenced by #ifdef/#ifndef (not shown as an option)`);
  return { bools, values, referenced, problems };
}

/** Parses a .properties text into key -> value, ignoring comments and preprocessor lines. */
export function propertyLines(text: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    out.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]);
  }
  return out;
}

/** shaders.properties checked against the options declared in the GLSL (port of the research validator). */
export function lintShadersProperties(text: string, opts: PackOptions): string[] {
  const problems: string[] = [];
  const known = new Set([...opts.bools.keys(), ...opts.values.keys()]);
  const defined = new Set<string>();
  const linked = new Set<string>();
  const placed = new Map<string, number>();
  for (const [key, val] of propertyLines(text)) {
    const items = val.split(/\s+/).filter(Boolean);
    if (key === 'screen' || (key.startsWith('screen.') && !key.endsWith('.columns'))) {
      if (key !== 'screen') defined.add(key.slice('screen.'.length));
      for (const it of items) {
        if (it === '<empty>' || it === '<profile>' || it === '*') continue;
        if (it.startsWith('[') && it.endsWith(']')) {
          linked.add(it.slice(1, -1));
          continue;
        }
        if (!known.has(it)) problems.push(`${key}: unknown option ${it}`);
        placed.set(it, (placed.get(it) ?? 0) + 1);
      }
    } else if (key.endsWith('.columns')) {
      if (!/^[1-9]\d*$/.test(val)) problems.push(`${key}: columns must be a positive integer`);
    } else if (key === 'sliders') {
      for (const it of items) if (!opts.values.has(it)) problems.push(`sliders: ${it} is not a value option`);
    } else if (key.startsWith('profile.')) {
      for (const it of items) {
        if (it.startsWith('profile.') || it.startsWith('!program.')) continue;
        const eq = it.search(/[=:]/);
        if (eq >= 0) {
          const n = it.slice(0, eq);
          const v = it.slice(eq + 1);
          const opt = opts.values.get(n);
          if (!opt) problems.push(`${key}: ${n} is not a value option`);
          else if (!opt.list.includes(v)) problems.push(`${key}: ${n}=${v} not in allowed values`);
        } else if (!opts.bools.has(it.replace(/^!/, ''))) {
          problems.push(`${key}: ${it} is not a boolean option`);
        }
      }
    } else if (key.startsWith('program.') && key.endsWith('.enabled')) {
      for (const name of val.split(/[^A-Za-z0-9_]+/).filter(Boolean)) {
        if (!opts.bools.has(name)) problems.push(`${key}: ${name} is not a boolean option`);
      }
    }
  }
  for (const s of linked) if (!defined.has(s)) problems.push(`screen link [${s}] has no screen.${s}`);
  for (const s of defined) if (!linked.has(s)) problems.push(`screen.${s} is never linked`);
  for (const [name, n] of placed) if (n > 1) problems.push(`${name} is placed on ${n} screens`);
  return problems;
}
