// Text primitives for patching vanilla GLSL. Vanilla code is never edited except for renaming
// main()/fog functions in place; everything else is appended at the end of a file.

export const PREFIX = 'txo';
export const SHADERS_ROOT = 'assets/minecraft/shaders/';
export const CORE = `${SHADERS_ROOT}core/`;
export const INCLUDE = `${SHADERS_ROOT}include/`;
export const POST_SHADERS = `${SHADERS_ROOT}post/`;
export const POST_EFFECT = 'assets/minecraft/post_effect/';

export const VANILLA_MAIN = `${PREFIX}_vanilla_main`;
export const BANNER = '// Made with Texture Pack Maker: generated code below.';
export const MAIN_NOTE = `// The original main() above now runs as ${VANILLA_MAIN}().`;

/** GLSL float literal that always has a decimal point (GLSL 1.50 has no implicit int to float in all places). */
export function glslFloat(x: number): string {
  if (!Number.isFinite(x)) throw new Error(`Cannot write ${x} as a GLSL float`);
  if (Math.abs(x) < 5e-7) return '0.0';
  let s = x.toFixed(6).replace(/0+$/, '');
  if (s.endsWith('.')) s += '0';
  return s;
}

export function glslVec3(v: readonly number[]): string {
  return `vec3(${glslFloat(v[0])}, ${glslFloat(v[1])}, ${glslFloat(v[2])})`;
}

/** Same length as the input with every comment replaced by spaces (newlines kept), so regex indices map 1:1. */
export function maskComments(code: string): string {
  let out = '';
  let i = 0;
  const n = code.length;
  while (i < n) {
    const c = code[i];
    const d = code[i + 1];
    if (c === '/' && d === '/') {
      while (i < n && code[i] !== '\n') {
        out += ' ';
        i++;
      }
    } else if (c === '/' && d === '*') {
      const end = code.indexOf('*/', i + 2);
      const stop = end < 0 ? n : end + 2;
      for (; i < stop; i++) out += code[i] === '\n' ? '\n' : ' ';
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

function allMatches(masked: string, re: RegExp): RegExpExecArray[] {
  const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
  const g = new RegExp(re.source, flags);
  const out: RegExpExecArray[] = [];
  for (let m = g.exec(masked); m; m = g.exec(masked)) {
    out.push(m);
    if (m[0].length === 0) g.lastIndex++;
  }
  return out;
}

const RE_MAIN = /\bvoid\s+main\s*\(\s*(?:void\s*)?\)/;

/** Number of main() definitions/declarations outside comments. */
export function countMain(code: string): number {
  return allMatches(maskComments(code), RE_MAIN).length;
}

/** Renames the single `void main()` to txo_vanilla_main(); null when there is not exactly one. */
export function renameMain(code: string): string | null {
  const m = allMatches(maskComments(code), RE_MAIN);
  if (m.length !== 1) return null;
  return code.slice(0, m[0].index) + `void ${VANILLA_MAIN}()` + code.slice(m[0].index + m[0][0].length);
}

const RE_OUT_VEC4 = /^[ \t]*(?:layout\s*\([^)]*\)\s*)?out\s+vec4\s+(\w+)\s*;/m;

/** Names of `out vec4 x;` declarations (fragment colour outputs) outside comments. */
export function fragmentOutputs(code: string): string[] {
  return allMatches(maskComments(code), RE_OUT_VEC4).map((m) => m[1]);
}

/** true when `name` is used as an identifier outside comments. */
export function mentions(code: string, name: string): boolean {
  return new RegExp(`\\b${name}\\b`).test(maskComments(code));
}

/** true when the code declares a variable/uniform/block member `type name;`. */
export function declares(code: string, type: string, name: string): boolean {
  return new RegExp(`\\b${type}\\s+${name}\\s*(?:\\[[^\\]]*\\])?\\s*;`).test(maskComments(code));
}

export function uboNames(code: string): Set<string> {
  return new Set(allMatches(maskComments(code), /layout\s*\([^)]*\bstd140\b[^)]*\)\s*uniform\s+(\w+)/).map((m) => m[1]));
}

const RE_IMPORT = /^[ \t]*#[ \t]*(?:moj_import|include)[ \t]*(?:<([^>\n]+)>|"([^"\n]+)")/;

function resolveImport(target: string, quoted: boolean, fromPath: string): string {
  if (quoted) {
    const dir = fromPath.slice(0, fromPath.lastIndexOf('/') + 1);
    const parts = (dir + target).split('/');
    const stack: string[] = [];
    for (const p of parts) {
      if (p === '..') stack.pop();
      else if (p !== '.' && p !== '') stack.push(p);
    }
    return stack.join('/');
  }
  const colon = target.indexOf(':');
  const ns = colon >= 0 ? target.slice(0, colon) : 'minecraft';
  const path = colon >= 0 ? target.slice(colon + 1) : target;
  return `assets/${ns}/shaders/include/${path}`;
}

/**
 * Recursively inlines #moj_import / #include (each file once) for analysis only
 * ("is UBO X / identifier Y visible here"). Never ship the result.
 */
export function expandForAnalysis(code: string, sources: Record<string, string>, fromPath: string, seen: Set<string> = new Set()): string {
  const masked = maskComments(code);
  const lines = code.split('\n');
  const maskedLines = masked.split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = RE_IMPORT.exec(maskedLines[i]);
    if (!m) {
      out.push(lines[i]);
      continue;
    }
    const path = resolveImport((m[1] ?? m[2]).trim(), m[2] !== undefined, fromPath);
    if (seen.has(path)) continue;
    seen.add(path);
    const inc = sources[path];
    if (inc !== undefined) out.push(expandForAnalysis(inc, sources, path, seen));
  }
  return out.join('\n');
}

export interface WrapResult {
  code: string;
  wrapper: string;
}

/** Expected shape of a wrapped function: return type and parameter types in order. */
export interface FunctionSignature {
  ret: 'float' | 'vec2' | 'vec3' | 'vec4';
  params: readonly string[];
}

/**
 * Renames the definition of `RET name(PARAMS) {` to `RET txo_vanilla_name(PARAMS) {`, adds a prototype
 * `RET name(PARAMS);` right before it (vanilla code later in the file keeps calling `name`) and
 * returns a wrapper `RET name(PARAMS) { return txo_vanilla_name(buildArgs(paramNames)); }` to be
 * appended by the caller. The definition must match `signature` exactly (return type, parameter
 * count and types), otherwise a string reason is returned and nothing is changed.
 */
export function wrapFunction(
  code: string,
  name: string,
  signature: FunctionSignature,
  buildArgs: (names: string[]) => string[],
): WrapResult | string {
  const re = new RegExp(`^([ \\t]*)(float|vec[234])\\s+(${name})\\s*\\(([^)]*)\\)\\s*\\{`, 'mg');
  const masked = maskComments(code);
  const matches = allMatches(masked, re);
  if (matches.length === 0) return `${name}() was not found`;
  if (matches.length > 1) return `${name}() is defined more than once`;
  const m = matches[0];
  if (m[2] !== signature.ret) return `${name}() returns ${m[2]} instead of ${signature.ret}`;
  const params = m[4].split(',').map((p) => p.trim()).filter(Boolean);
  const expectedParams = signature.params.length;
  if (params.length !== expectedParams) return `${name}() has ${params.length} parameters instead of ${expectedParams}`;
  const names: string[] = [];
  for (const [i, p] of params.entries()) {
    const pm = /^(?:(?:in|const|highp|mediump|lowp)\s+)*(\w+)\s+(\w+)$/.exec(p);
    if (!pm) return `${name}() has an unexpected parameter "${p}"`;
    if (pm[1] !== signature.params[i]) return `${name}() parameter ${i + 1} is ${pm[1]} instead of ${signature.params[i]}`;
    names.push(pm[2]);
  }
  const ret = m[2];
  const indent = m[1];
  const list = params.join(', ');
  const head = `${indent}${ret} ${name}(${list});\n${indent}${ret} ${PREFIX}_vanilla_${name}(${list}) {`;
  const patched = code.slice(0, m.index) + head + code.slice(m.index + m[0].length);
  const wrapper = `${ret} ${name}(${list}) {\n    return ${PREFIX}_vanilla_${name}(${buildArgs(names).join(', ')});\n}\n`;
  return { code: patched, wrapper };
}
