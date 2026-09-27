// Writes chosen option values into the pack as its new defaults. Only the value on each option's
// own declaration line changes; every other byte of every file stays as it was:
//   #define NAME 1.00 // [...]      -> the value token is replaced
//   const float x = 96.0; // [...]  -> the value after '=' is replaced
//   //#define NAME  <->  #define NAME   (the leading '//' is removed or added)
// When a value is not in the option's [list] it is inserted, so the in-game menu keeps working.
// Also builds the settings file Iris and OptiFine keep next to a pack (shaderpacks/<pack>.zip.txt).
// Pure: no DOM.

import { splitLinesKeepEnds } from '../import/text';
import type { IrisOption, IrisOptionSet } from './iris-options';

export type ChosenValues = Record<string, string>;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const numeric = (s: string) => /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?[fF]?$/.test(s);
const num = (s: string) => Number(s.replace(/[fF]$/, ''));

/** The allowed values after adding `extra` (sorted position in an ascending numeric list, else at the end). */
export function listWith(list: string[], extra: string[]): string[] {
  const out = [...list];
  for (const v of extra) {
    if (out.includes(v)) continue;
    const sorted = out.length > 1 && out.every(numeric) && out.every((x, i) => i === 0 || num(out[i - 1]) <= num(x));
    if (sorted && numeric(v)) {
      const n = num(v);
      const at = out.findIndex((x) => num(x) > n);
      if (at < 0) out.push(v);
      else out.splice(at, 0, v);
    } else out.push(v);
  }
  return out;
}

/** Rewrites the value list "[a b c]" in the comment part of a line, keeping everything else. */
function rewriteList(rest: string, required: string[]): string {
  const open = rest.indexOf('[');
  if (open < 0) return rest;
  const close = rest.indexOf(']', open);
  if (close < 0) return rest;
  const list = rest.slice(open + 1, close).split(' ');
  const next = listWith(list, required.filter((v) => !list.includes(v)));
  if (next.length === list.length) return rest;
  return `${rest.slice(0, open + 1)}${next.join(' ')}${rest.slice(close)}`;
}

/**
 * Rewrites one declaration line of `opt` so its default becomes `value`. Returns the line unchanged
 * when the value already is the default or the line does not look like the declaration.
 */
export function rewriteOptionLine(line: string, opt: IrisOption, value: string): string {
  if (value === opt.defaultValue) return line;
  const name = escapeRe(opt.name);
  if (opt.kind === 'bool' && opt.form === 'define') {
    if (value === 'true') {
      // '//#define X' -> '#define X' (only the slashes go; indentation and spacing stay)
      const m = /^(\s*)\/\/+/.exec(line);
      return m ? m[1] + line.slice(m[0].length) : line;
    }
    const m = new RegExp(`^(\\s*)#define(\\s+${name})`).exec(line);
    return m ? `${m[1]}//${line.slice(m[1].length)}` : line;
  }
  const head =
    opt.form === 'const'
      ? new RegExp(`^(\\s*const\\s+(?:int|float|bool)\\s+${name}\\s*=\\s*)`)
      : new RegExp(`^(\\s*#define\\s+${name}\\s+)`);
  const m = head.exec(line);
  if (!m || !line.startsWith(opt.defaultValue, m[0].length)) return line;
  const before = line.slice(0, m[0].length);
  let rest = line.slice(m[0].length + opt.defaultValue.length);
  // the new value must be in the list, and an old default the list never had (the loaders added it
  // for display) stays selectable
  if (opt.kind === 'value') rest = rewriteList(rest, [opt.defaultValue, value]);
  return before + value + rest;
}

export interface ApplyResult {
  /** Changed files only: path -> new text */
  files: Record<string, string>;
  /** Options whose declaration line could not be rewritten */
  skipped: string[];
}

/**
 * Applies `values` (option name -> value string) to `sources`. Values equal to the pack default and
 * unknown option names are ignored.
 */
export function applyOptionValues(sources: Record<string, string>, set: IrisOptionSet, values: ChosenValues): ApplyResult {
  const byFile = new Map<string, Map<number, { opt: IrisOption; value: string }>>();
  for (const [name, value] of Object.entries(values)) {
    const opt = set.options.get(name);
    if (!opt || value === opt.defaultValue) continue;
    if (opt.kind === 'bool' && value !== 'true' && value !== 'false') continue;
    if (opt.kind === 'value' && (!value || /\s|[\]\[]/.test(value))) continue;
    for (const loc of opt.locations) {
      let m = byFile.get(loc.path);
      if (!m) byFile.set(loc.path, (m = new Map()));
      m.set(loc.line, { opt, value });
    }
  }
  const files: Record<string, string> = {};
  const skipped = new Set<string>();
  for (const [path, edits] of byFile) {
    const text = sources[path];
    if (text === undefined) continue;
    const lines = splitLinesKeepEnds(text);
    let changed = false;
    for (const [index, { opt, value }] of edits) {
      const entry = lines[index];
      if (!entry) {
        skipped.add(opt.name);
        continue;
      }
      const next = rewriteOptionLine(entry.line, opt, value);
      if (next === entry.line) {
        skipped.add(opt.name);
        continue;
      }
      entry.line = next;
      changed = true;
    }
    if (changed) files[path] = lines.map((l) => l.line + l.end).join('');
  }
  return { files, skipped: [...skipped].sort() };
}

/**
 * The per-pack settings file both loaders read from shaderpacks/<pack file name>.txt: one
 * NAME=value line per option that differs from the pack's default.
 */
export function settingsFileText(set: IrisOptionSet, values: ChosenValues, packFileName: string): string {
  const lines = [`# Shader options for ${packFileName.replace(/[\r\n]/g, ' ')}. Made with Texture Pack Maker.`];
  for (const opt of set.options.values()) {
    const v = values[opt.name];
    if (v === undefined || v === opt.defaultValue) continue;
    lines.push(`${opt.name}=${v}`);
  }
  return `${lines.join('\n')}\n`;
}

/** Reads a settings .txt (NAME=value lines) back into chosen values for known options. */
export function parseSettingsFile(text: string, set: IrisOptionSet): ChosenValues {
  const out: ChosenValues = {};
  for (const raw of text.split(/\r\n|\n|\r/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('!')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const name = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    const opt = set.options.get(name);
    if (!opt) continue;
    if (opt.kind === 'bool' && value !== 'true' && value !== 'false') continue;
    out[name] = value;
  }
  return out;
}
