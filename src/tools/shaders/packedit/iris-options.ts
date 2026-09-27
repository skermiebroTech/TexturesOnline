// Finds the configurable options of an Iris / OptiFine shader pack exactly the way the loaders do
// (Iris OptionAnnotatedSource / StringOption / ParsedString, which match OptiFine):
//   #define NAME            boolean, on          //#define NAME   boolean, off
//   #define NAME 1.0 // [0.5 1.0 2.0]           value option (the list is split on single spaces)
//   const int shadowMapResolution = 2048; // [1024 2048]   const option (whitelisted names only)
// A boolean only counts when a bare "#ifdef NAME" / "#ifndef NAME" line exists in the same
// include graph. Options are read from every program source and the files they #include.
// Pure: no DOM.

import { splitLines } from '../import/text';

export type IrisOptionKind = 'bool' | 'value';

export interface OptionLocation {
  /** Pack path, e.g. 'shaders/lib/settings.glsl' */
  path: string;
  /** 0-based line index */
  line: number;
}

export interface IrisOption {
  name: string;
  kind: IrisOptionKind;
  form: 'define' | 'const';
  /** Default as written in the source: 'true' / 'false' for booleans, the exact token for values */
  defaultValue: string;
  /** Allowed values in loader order (the default is appended when the list lacks it) */
  values: string[];
  /** Comment text after the declaration (without the value list) */
  comment: string;
  locations: OptionLocation[];
}

export interface IrisOptionSet {
  /** In source order (file path, then line) */
  options: Map<string, IrisOption>;
  /** Names declared with different defaults in different places (the loaders ignore these) */
  ambiguous: string[];
  /** Files that were read for options */
  scanned: string[];
}

const VALID_CONST_OPTION_NAMES = new Set<string>([
  'shadowMapResolution', 'shadowDistance', 'voxelDistance', 'shadowDistanceRenderMul', 'entityShadowDistanceMul', 'shadowIntervalSize',
  'generateShadowMipmap', 'generateShadowColorMipmap', 'shadowHardwareFiltering', 'shadowtex0Mipmap', 'shadowtexMipmap', 'shadowtex1Mipmap',
  'shadowtex0Nearest', 'shadowtexNearest', 'shadow0MinMagNearest', 'shadowtex1Nearest', 'shadow1MinMagNearest', 'wetnessHalflife',
  'drynessHalflife', 'eyeBrightnessHalflife', 'centerDepthHalflife', 'sunPathRotation', 'ambientOcclusionLevel', 'superSamplingLevel',
  'noiseTextureResolution',
]);
for (let i = 0; i < 8; i++) {
  for (const n of [`shadowcolor${i}Mipmap`, `shadowColor${i}Mipmap`, `shadowcolor${i}Nearest`, `shadowColor${i}Nearest`, `shadowcolor${i}MinMagNearest`,
    `shadowColor${i}MinMagNearest`, `shadowHardwareFiltering${i}`]) VALID_CONST_OPTION_NAMES.add(n);
}

export function isConstOptionName(name: string): boolean {
  return VALID_CONST_OPTION_NAMES.has(name);
}

export const PROGRAM_EXT = /\.(vsh|fsh|gsh|csh|tcs|tes)$/i;
export const SOURCE_EXT = /\.(vsh|fsh|gsh|csh|tcs|tes|glsl|inc|h)$/i;

// ---------------------------------------------------------------------------------------------
// ParsedString (port of net.irisshaders.iris.shaderpack.parsing.ParsedString)

/** Java's String.trim(): strips code points <= U+0020 from both ends. */
export function javaTrim(s: string): string {
  let a = 0;
  let b = s.length;
  while (a < b && s.charCodeAt(a) <= 0x20) a++;
  while (b > a && s.charCodeAt(b - 1) <= 0x20) b--;
  return s.slice(a, b);
}

const isJavaWhitespace = (c: string) => /[\t\n\v\f\r\x1c-\x1f \u{1680}\u{2000}-\u{2006}\u{2008}-\u{200a}\u{2028}\u{2029}\u{205f}\u{3000}]/u.test(c);
const isDigit = (c: string | undefined) => c !== undefined && /\p{Nd}/u.test(c);
const isWordChar = (c: string) => c === '_' || /[\p{Nd}\p{Alphabetic}]/u.test(c);

/** What Java's Float.parseFloat accepts (decimal forms; hex floats are not used by packs). */
function javaParsesFloat(s: string): boolean {
  return /^[+-]?(NaN|Infinity|(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?[fFdD]?)$/.test(javaTrim(s));
}

class Parsed {
  constructor(public text: string) {}
  takeLiteral(t: string): boolean {
    if (!this.text.startsWith(t)) return false;
    this.text = this.text.slice(t.length);
    return true;
  }
  takeSomeWhitespace(): boolean {
    if (!this.text || !isJavaWhitespace(this.text[0])) return false;
    this.text = javaTrim(this.text);
    return true;
  }
  takeComments(): boolean {
    if (!this.text.startsWith('//')) return false;
    this.text = this.text.slice(2);
    while (this.text.startsWith('/')) this.text = this.text.slice(1);
    return true;
  }
  isEnd(): boolean {
    return this.text.length === 0;
  }
  takeWord(): string | null {
    let p = 0;
    for (const ch of this.text) {
      if (!isWordChar(ch)) break;
      p += ch.length;
    }
    if (p === 0) return null;
    const w = this.text.slice(0, p);
    this.text = this.text.slice(p);
    return w;
  }
  takeNumber(): string | null {
    const t = this.text;
    if (!t) return null;
    let p = 0;
    while (p < t.length) {
      if (p + 1 < t.length) {
        if (!isDigit(t[p]) && !isDigit(t[p + 1])) break;
      } else if (!isDigit(t[p])) break;
      p++;
    }
    if (p > 0 && p + 1 < t.length && (t[p] === 'f' || t[p] === 'F')) p++;
    const n = t.slice(0, p);
    if (!javaParsesFloat(n)) return null;
    this.text = t.slice(p);
    return n;
  }
  takeWordOrNumber(): string | null {
    return this.takeNumber() ?? this.takeWord();
  }
}

// ---------------------------------------------------------------------------------------------
// One line

export type LineOption =
  | { kind: 'bool'; form: 'define' | 'const'; name: string; value: boolean; comment: string }
  | { kind: 'value'; form: 'define' | 'const'; name: string; value: string; values: string[]; comment: string };

export type LineInfo = { option: LineOption } | { ref: string } | null;

/** Splits "[a b c] text" out of a comment; null when there is no list (StringOption.create). */
function valueList(comment: string, value: string): { values: string[]; comment: string } | null {
  const open = comment.indexOf('[');
  if (open < 0) return null;
  const close = comment.indexOf(']', open);
  if (close < 0) return null;
  const values = comment.slice(open + 1, close).split(' ');
  if (!values.includes(value)) values.push(value);
  return { values, comment: javaTrim(comment.slice(0, open) + comment.slice(close + 1)) };
}

/** Parses one source line the way Iris does. */
export function parseOptionLine(lineText: string): LineInfo {
  if (!lineText.includes('#define') && !lineText.includes('const') && !lineText.includes('#ifdef') && !lineText.includes('#ifndef')) return null;
  const line = new Parsed(javaTrim(lineText));
  if (line.takeLiteral('#ifdef') || line.takeLiteral('#ifndef')) {
    if (!line.takeSomeWhitespace()) return null;
    const name = line.takeWord();
    line.takeSomeWhitespace();
    if (name === null || !line.isEnd()) return null;
    return { ref: name };
  }
  if (line.takeLiteral('const')) return parseConst(line);
  if (line.text.includes('#define')) return parseDefine(line);
  return null;
}

function parseConst(line: Parsed): LineInfo {
  if (!line.takeSomeWhitespace()) return null;
  let isString: boolean;
  if (line.takeLiteral('int') || line.takeLiteral('float')) isString = true;
  else if (line.takeLiteral('bool')) isString = false;
  else return null;
  if (!line.takeSomeWhitespace()) return null;
  const name = line.takeWord();
  if (name === null) return null;
  line.takeSomeWhitespace();
  if (!line.takeLiteral('=')) return null;
  line.takeSomeWhitespace();
  const value = line.takeWordOrNumber();
  if (value === null) return null;
  line.takeSomeWhitespace();
  if (!line.takeLiteral(';')) return null;
  line.takeSomeWhitespace();
  let comment: string | null;
  if (line.takeComments()) comment = javaTrim(line.text);
  else if (!line.isEnd()) return null;
  else comment = null;
  if (!VALID_CONST_OPTION_NAMES.has(name)) return null;
  if (!isString) {
    if (value !== 'true' && value !== 'false') return null;
    return { option: { kind: 'bool', form: 'const', name, value: value === 'true', comment: comment ?? '' } };
  }
  if (comment === null) return null;
  const list = valueList(comment, value);
  if (!list) return null;
  return { option: { kind: 'value', form: 'const', name, value, values: list.values, comment: list.comment } };
}

function parseDefine(line: Parsed): LineInfo {
  const leadingComment = line.takeComments();
  line.takeSomeWhitespace();
  if (!line.takeLiteral('#define')) return null;
  if (!line.takeSomeWhitespace()) return null;
  const name = line.takeWord();
  if (name === null) return null;
  let tookWs = line.takeSomeWhitespace();
  if (line.isEnd()) return { option: { kind: 'bool', form: 'define', name, value: !leadingComment, comment: '' } };
  if (line.takeComments()) return { option: { kind: 'bool', form: 'define', name, value: !leadingComment, comment: javaTrim(line.text) } };
  if (!tookWs) return null;
  if (leadingComment) return null;
  const value = line.takeWordOrNumber();
  if (value === null) return null;
  tookWs = line.takeSomeWhitespace();
  if (line.isEnd()) return null;
  if (!tookWs) {
    if (!line.takeComments()) return null;
  } else if (!line.takeComments()) return null;
  const list = valueList(javaTrim(line.text), value);
  if (!list) return null;
  return { option: { kind: 'value', form: 'define', name, value, values: list.values, comment: list.comment } };
}

// ---------------------------------------------------------------------------------------------
// Include graph

const INCLUDE_RE = /^\s*#include\s+"([^"]+)"/;

function dirOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i >= 0 ? path.slice(0, i + 1) : '';
}

function normalizePath(p: string): string | null {
  const out: string[] = [];
  for (const seg of p.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') {
      if (!out.length) return null;
      out.pop();
    } else out.push(seg);
  }
  return out.join('/');
}

/** Resolves an #include target: "/lib/x.glsl" from the shaders folder, "x.glsl" next to the file. */
export function resolveInclude(from: string, target: string, shadersDir: string): string | null {
  const t = target.trim();
  if (!t) return null;
  return normalizePath(t.startsWith('/') ? shadersDir + t.slice(1) : dirOf(from) + t);
}

export interface ParseOptions {
  /** Folder that holds the pack ('shaders/') */
  shadersDir?: string;
}

/**
 * Discovers every option of the pack. `sources` maps pack paths to their text; only the program
 * sources under `shadersDir` and the files they include (recursively) are read.
 */
export function parseIrisOptions(sources: Record<string, string>, opts: ParseOptions = {}): IrisOptionSet {
  const shadersDir = opts.shadersDir ?? 'shaders/';
  const linesOf = new Map<string, string[]>();
  const getLines = (p: string) => {
    let l = linesOf.get(p);
    if (!l) {
      l = splitLines(sources[p] ?? '');
      linesOf.set(p, l);
    }
    return l;
  };

  // nodes reachable from the programs, with union-find over include edges
  const starts = Object.keys(sources)
    .filter((p) => p.startsWith(shadersDir) && PROGRAM_EXT.test(p))
    .sort();
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    let c = x;
    while (parent.get(c) !== r) {
      const n = parent.get(c)!;
      parent.set(c, r);
      c = n;
    }
    return r;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  const queue: string[] = [];
  for (const s of starts) {
    parent.set(s, s);
    queue.push(s);
  }
  const seen = new Set(starts);
  while (queue.length) {
    const p = queue.shift()!;
    for (const line of getLines(p)) {
      if (!line.includes('#include')) continue;
      const m = INCLUDE_RE.exec(line);
      if (!m) continue;
      const target = resolveInclude(p, m[1], shadersDir);
      if (!target || sources[target] === undefined) continue;
      if (!seen.has(target)) {
        seen.add(target);
        parent.set(target, target);
        queue.push(target);
      }
      union(p, target);
    }
  }

  const nodes = [...seen].sort();
  // pass 1: parse lines, collect #ifdef references per component
  const parsed = new Map<string, { index: number; option: LineOption }[]>();
  const refs = new Map<string, Set<string>>();
  for (const p of nodes) {
    const list: { index: number; option: LineOption }[] = [];
    const comp = find(p);
    let r = refs.get(comp);
    if (!r) refs.set(comp, (r = new Set()));
    getLines(p).forEach((text, index) => {
      const info = parseOptionLine(text);
      if (!info) return;
      if ('ref' in info) r!.add(info.ref);
      else list.push({ index, option: info.option });
    });
    parsed.set(p, list);
  }

  // pass 2: register options (booleans only when referenced) and merge duplicates
  const options = new Map<string, IrisOption>();
  const ambiguous = new Set<string>();
  for (const p of nodes) {
    const compRefs = refs.get(find(p))!;
    for (const { index, option } of parsed.get(p)!) {
      if (option.kind === 'bool' && !compRefs.has(option.name)) continue;
      const name = option.name;
      if (ambiguous.has(name)) continue;
      const defaultValue = option.kind === 'bool' ? String(option.value) : option.value;
      const existing = options.get(name);
      if (existing) {
        // a name used both as a switch and as a value: the first kind wins
        if (existing.kind !== option.kind) continue;
        if (existing.defaultValue !== defaultValue) {
          options.delete(name);
          ambiguous.add(name);
          continue;
        }
        existing.locations.push({ path: p, line: index });
        if (!existing.comment && option.comment) existing.comment = option.comment;
        continue;
      }
      options.set(name, {
        name,
        kind: option.kind,
        form: option.form,
        defaultValue,
        values: option.kind === 'value' ? option.values : ['true', 'false'],
        comment: option.comment,
        locations: [{ path: p, line: index }],
      });
    }
  }
  return { options, ambiguous: [...ambiguous].sort(), scanned: nodes };
}

/** Normalises a stored choice for an option: booleans as true/false, values as their exact token. */
export function optionValueString(opt: IrisOption, v: unknown): string | null {
  if (opt.kind === 'bool') {
    if (typeof v === 'boolean') return String(v);
    if (v === 'true' || v === 'false') return v;
    return null;
  }
  if (typeof v === 'string' && v && !/\s/.test(v)) return v;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
}
