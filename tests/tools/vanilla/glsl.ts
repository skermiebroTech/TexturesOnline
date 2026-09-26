/**
 * GLSL validation helpers for the vanilla shader tests: the game's include handling
 * (GlslPreprocessor for ≤ 26.2, textual #include for 26.3+), define injection, batched
 * glslangValidator runs and a vertex→fragment varying check (GL matches varyings by name).
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, posix } from 'node:path';
import { fixturesDir } from './sources';

/** glslangValidator from $GLSLANG_VALIDATOR, then PATH, then the fixture tools; null when missing. */
export function findGlslang(): string | null {
  const env = process.env.GLSLANG_VALIDATOR;
  if (env && existsSync(env)) return env;
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    if (!dir) continue;
    for (const name of ['glslangValidator', 'glslangValidator.exe']) {
      const p = join(dir, name);
      if (existsSync(p)) return p;
    }
  }
  const fx = fixturesDir();
  if (fx) {
    const p = join(fx, 'tools', 'bin', 'glslangValidator');
    if (existsSync(p)) return p;
  }
  return null;
}

export type Define = [string, string];

// ---------------------------------------------------------------- Mojang GlslPreprocessor (1.17 – 26.2)

const RE_IMP = /^[ \t]*#[ \t]*moj_import[ \t]*(?:"(.*)"|<(.*)>)/gm;
const RE_VER = /#[ \t]*version[ \t]+(\d+)/;

function includePath(target: string): string {
  const colon = target.indexOf(':');
  const ns = colon >= 0 ? target.slice(0, colon) : 'minecraft';
  return `assets/${ns}/shaders/include/${colon >= 0 ? target.slice(colon + 1) : target}`;
}

/** Expands #moj_import the way the game does: each file once per shader, #version merged, #line markers. */
export function mojPreprocess(code: string, files: Record<string, string>, fromPath: string): string {
  const ctx = { ver: 0, id: 0, seen: new Set<string>() };
  const run = (src: string, parentDir: string): string[] => {
    const thisId = ctx.id;
    const out: string[] = [];
    let prev = 0;
    let lineMacro = '';
    for (const m of src.matchAll(RE_IMP)) {
      const path = m[1] !== undefined ? posix.normalize(parentDir + m[1]) : includePath(m[2].trim());
      const before = src.slice(prev, m.index);
      let content: string | null = null;
      if (!ctx.seen.has(path)) {
        ctx.seen.add(path);
        content = files[path] ?? `#error missing import ${path}\n`;
      }
      if (content) {
        if (!content.endsWith('\n')) content += '\n';
        const impId = ++ctx.id;
        const sub = run(content, posix.dirname(path) + '/');
        const vm = RE_VER.exec(sub[0] ?? '');
        if (vm && sub.length) {
          ctx.ver = Math.max(ctx.ver, Number(vm[1]));
          sub[0] = sub[0].slice(0, vm.index) + '/*' + vm[0] + '*/' + sub[0].slice(vm.index + vm[0].length);
        }
        if (sub.length) sub[0] = `#line 0 ${impId}\n${sub[0]}`;
        if (before.trim()) out.push(lineMacro + before);
        out.push(...sub);
      } else {
        out.push(lineMacro + before + `/*#moj_import <${path}>*/`);
      }
      lineMacro = `#line ${src.slice(0, (m.index ?? 0) + m[0].length).split('\n').length} ${thisId}`;
      prev = (m.index ?? 0) + m[0].length;
    }
    const rest = src.slice(prev);
    if (rest.trim()) out.push(lineMacro + rest);
    return out;
  };
  const parts = run(code, posix.dirname(fromPath) + '/');
  const vm = RE_VER.exec(parts[0] ?? '');
  if (vm) {
    const start = vm.index + vm[0].length - vm[1].length;
    parts[0] = parts[0].slice(0, start) + String(Math.max(ctx.ver, Number(vm[1]))) + parts[0].slice(vm.index + vm[0].length);
  }
  return parts.join('');
}

/** ShaderDefines injection: right after the first line (which must be #version). */
export function injectDefines(code: string, defines: Define[]): string {
  if (!defines.length) return code;
  const i = code.indexOf('\n') + 1;
  const d = defines.map(([k, v]) => (v !== '' ? `#define ${k} ${v}\n` : `#define ${k}\n`)).join('');
  return code.slice(0, i) + d + '#line 1 0\n' + code.slice(i);
}

// ---------------------------------------------------------------- 26.3+: textual #include (shaderc callback)

const RE_INC = /^[ \t]*#[ \t]*include[ \t]*(?:"([^"\n]+)"|<([^>\n]+)>)[^\n]*$/gm;

export function includeExpand(code: string, files: Record<string, string>, fromPath: string, depth = 0): string {
  if (depth > 32) throw new Error(`#include nesting too deep in ${fromPath}`);
  return code.replace(RE_INC, (_all, rel: string | undefined, abs: string | undefined) => {
    let path = rel !== undefined ? posix.normalize(posix.dirname(fromPath) + '/' + rel) : includePath(abs!.trim());
    if (!path.endsWith('.glsl') && files[path] === undefined && files[path + '.glsl'] !== undefined) path += '.glsl';
    const inc = files[path];
    if (inc === undefined) return `#error missing include ${path}`;
    return includeExpand(inc, files, path, depth + 1);
  });
}

/** Defines after the leading #version / #extension lines (as shaderc's -D would behave). */
export function injectDefinesAfterHeader(code: string, defines: Define[]): string {
  if (!defines.length) return code;
  const lines = code.split('\n');
  let i = 0;
  while (i < lines.length && /^\s*(#\s*(version|extension)\b.*)?$/.test(lines[i])) i++;
  const d = defines.map(([k, v]) => (v !== '' ? `#define ${k} ${v}` : `#define ${k}`));
  return [...lines.slice(0, i), ...d, ...lines.slice(i)].join('\n');
}

// ---------------------------------------------------------------- glslangValidator

export interface CompileJob {
  /** unique label, used in failure messages */
  label: string;
  stage: 'vert' | 'frag';
  code: string;
}

export interface CompileFailure {
  label: string;
  log: string;
}

function run(bin: string, args: string[], cwd: string): Promise<{ code: number; out: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { cwd });
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (out += d));
    p.on('error', reject);
    p.on('close', (code) => resolve({ code: code ?? 1, out }));
  });
}

async function pool<T>(items: T[], limit: number, fn: (t: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) await fn(items[next++]);
  });
  await Promise.all(workers);
}

const PARALLEL = 4;

/**
 * Remembers sources that compiled successfully (keyed by compiler, mode and exact text) so repeated
 * runs only compile what changed. Stored next to the extracted game files; VANILLA_NO_COMPILE_CACHE=1 disables it.
 */
class SuccessCache {
  private readonly file: string | null;
  private readonly ok = new Set<string>();
  private dirty = false;

  constructor(private readonly toolId: string) {
    const fx = process.env.VANILLA_NO_COMPILE_CACHE ? null : fixturesDir();
    this.file = fx ? join(fx, 'vanilla-shader-cache', 'compile-ok.json') : null;
    if (this.file && existsSync(this.file)) {
      try {
        for (const k of JSON.parse(readFileSync(this.file, 'utf8')) as string[]) this.ok.add(k);
      } catch {
        /* start over */
      }
    }
  }

  key(mode: string, job: CompileJob): string {
    return createHash('sha1').update(`${this.toolId}\0${mode}\0${job.stage}\0${job.code}`).digest('hex');
  }

  has(k: string): boolean {
    return this.ok.has(k);
  }

  add(k: string): void {
    this.ok.add(k);
    this.dirty = true;
  }

  save(): void {
    if (!this.file || !this.dirty) return;
    try {
      mkdirSync(join(this.file, '..'), { recursive: true });
      writeFileSync(this.file, JSON.stringify([...this.ok]));
    } catch {
      /* optional */
    }
  }
}

function toolId(bin: string): string {
  try {
    return `${bin}:${statSync(bin).size}`;
  } catch {
    return bin;
  }
}

/**
 * OpenGL-mode validation, many files per process (files of one run are compiled separately, not linked).
 * Returns the failures (empty = every job compiled).
 */
export async function compileGL(bin: string, allJobs: CompileJob[]): Promise<CompileFailure[]> {
  const cache = new SuccessCache(toolId(bin));
  const jobs = allJobs.filter((j) => !cache.has(cache.key('gl', j)));
  const dir = mkdtempSync(join(tmpdir(), 'txo-glsl-'));
  const failures: CompileFailure[] = [];
  try {
    const named = jobs.map((j, i) => ({ ...j, file: `s${i}.${j.stage}` }));
    for (const j of named) writeFileSync(join(dir, j.file), j.code);
    const chunks: (typeof named)[] = [];
    for (let i = 0; i < named.length; i += 60) chunks.push(named.slice(i, i + 60));
    await pool(chunks, PARALLEL, async (chunk) => {
      const r = await run(bin, chunk.map((c) => c.file), dir);
      if (r.code === 0) {
        for (const c of chunk) cache.add(cache.key('gl', c));
        return;
      }
      const before = failures.length;
      // Output: each file name on its own line followed by its messages.
      const byFile = new Map<string, string[]>();
      let cur = '';
      for (const line of r.out.split('\n')) {
        const t = line.trim();
        if (chunk.some((c) => c.file === t)) {
          cur = t;
          byFile.set(cur, []);
        } else if (cur) byFile.get(cur)!.push(line);
      }
      for (const c of chunk) {
        const log = (byFile.get(c.file) ?? []).join('\n');
        if (/\bERROR\b/.test(log)) failures.push({ label: c.label, log: log.trim().slice(0, 1500) });
        else cache.add(cache.key('gl', c));
      }
      if (failures.length === before) failures.push({ label: chunk.map((c) => c.label).join(', '), log: r.out.slice(0, 1500) });
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
    cache.save();
  }
  return failures;
}

/** Vulkan-mode (SPIR-V, like shaderc in the game) validation, one file per process, in parallel. */
export async function compileVulkan(bin: string, allJobs: CompileJob[], extraArgs: string[] = []): Promise<CompileFailure[]> {
  const cache = new SuccessCache(toolId(bin));
  const mode = `vk ${extraArgs.join(' ')}`;
  const jobs = allJobs.filter((j) => !cache.has(cache.key(mode, j)));
  const dir = mkdtempSync(join(tmpdir(), 'txo-spv-'));
  const failures: CompileFailure[] = [];
  try {
    let n = 0;
    await pool(jobs, PARALLEL, async (j) => {
      const file = `v${n++}.${j.stage}`;
      writeFileSync(join(dir, file), j.code);
      const r = await run(bin, ['-V', '--target-env', 'vulkan1.2', '--auto-map-bindings', ...extraArgs, '-o', `${file}.spv`, file], dir);
      if (r.code !== 0) failures.push({ label: j.label, log: r.out.trim().slice(0, 1500) });
      else cache.add(cache.key(mode, j));
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
    cache.save();
  }
  return failures;
}

// ---------------------------------------------------------------- GL varying check

/** Tiny #ifdef evaluator so that in/out lists reflect the active branch (enough for vanilla shaders). */
export function stripInactive(code: string): string {
  const defined = new Set([...code.matchAll(/^\s*#\s*define\s+(\w+)/gm)].map((m) => m[1]));
  const out: string[] = [];
  const stack: [boolean, boolean][] = [];
  for (const line of code.split('\n')) {
    const s = line.trim();
    let m = /^#\s*(ifdef|ifndef)\s+(\w+)/.exec(s);
    if (m) {
      const cond = defined.has(m[2]) === (m[1] === 'ifdef');
      stack.push([cond, cond]);
      continue;
    }
    m = /^#\s*if\s+(.*)/.exec(s);
    if (m) {
      const e = m[1];
      let cond = true;
      const mm = /^(!?)\s*defined\s*\(?\s*(\w+)/.exec(e);
      if (mm) cond = defined.has(mm[2]) !== (mm[1] === '!');
      stack.push([cond, cond]);
      continue;
    }
    if (/^#\s*else/.test(s) && stack.length) {
      stack[stack.length - 1][0] = !stack[stack.length - 1][1];
      continue;
    }
    if (/^#\s*elif/.test(s) && stack.length) {
      stack[stack.length - 1][0] = false;
      continue;
    }
    if (/^#\s*endif/.test(s) && stack.length) {
      stack.pop();
      continue;
    }
    if (stack.every((c) => c[0])) out.push(line);
  }
  return out.join('\n');
}

function ioNames(code: string, kw: 'in' | 'out'): Set<string> {
  const re = new RegExp(`^\\s*(?:flat\\s+|smooth\\s+|noperspective\\s+)?${kw}\\s+\\w+\\s+(\\w+)\\s*(?:\\[[^\\]]*\\])?\\s*;`, 'gm');
  return new Set([...code.matchAll(re)].map((m) => m[1]));
}

/** Statically used fragment inputs that the vertex shader does not write (GL links varyings by name). */
export function missingVaryings(vertex: string, fragment: string): string[] {
  const f = stripInactive(fragment.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ''));
  const v = stripInactive(vertex.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ''));
  const fin = ioNames(f, 'in');
  const vout = ioNames(v, 'out');
  return [...fin].filter((n) => !vout.has(n) && (f.match(new RegExp(`\\b${n}\\b`, 'g')) ?? []).length > 1);
}

/** Names of uniform blocks and opaque uniforms (samplers/images) declared in a shader. */
export function declaredDescriptors(code: string): Set<string> {
  const clean = code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, '');
  const out = new Set<string>();
  for (const m of clean.matchAll(/\buniform\s+(\w+)\s*\{/g)) out.add(m[1]);
  for (const m of clean.matchAll(/\buniform\s+(?:(?:lowp|mediump|highp)\s+)?([iu]?(?:sampler|image)\w*)\s+(\w+)\s*;/g)) out.add(m[2]);
  return out;
}

/** Plain (non-block, non-opaque) uniform names, e.g. `uniform float GameTime;`. */
export function plainUniforms(code: string): Set<string> {
  const clean = code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, '');
  const out = new Set<string>();
  for (const m of clean.matchAll(/\buniform\s+(?:(?:lowp|mediump|highp)\s+)?(\w+)\s+(\w+)\s*(?:\[[^\]]*\])?\s*;/g)) {
    if (!/sampler|image/.test(m[1])) out.add(m[2]);
  }
  return out;
}
