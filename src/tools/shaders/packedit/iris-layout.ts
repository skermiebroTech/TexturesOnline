// The option menus of an Iris / OptiFine pack: screens and sub-screens (screen=, screen.NAME=),
// the slider list (sliders=), quality profiles (profile.NAME=) and the English names, tooltips and
// value labels from lang/en_US.lang. Like Iris, the layout keys are read from shaders.properties
// without running its preprocessor (the last definition of a key wins). Pure: no DOM.

import type { IrisOption, IrisOptionSet } from './iris-options';
import { parseProperties, prettifyName, wordList } from './properties';

export type ScreenItem =
  | { type: 'option'; name: string }
  | { type: 'screen'; screen: ScreenNode }
  | { type: 'profile' };

export interface ScreenNode {
  /** '' for the main screen */
  id: string;
  label: string;
  comment: string;
  items: ScreenItem[];
}

export interface ProfileDef {
  id: string;
  label: string;
  /** option name -> value ('true' / 'false' for switches) */
  values: Map<string, string>;
}

export interface IrisLayout {
  main: ScreenNode;
  sliders: Set<string>;
  profiles: ProfileDef[];
  profileComment: string;
  /** Options that no reachable screen shows (the game menu hides them, profiles may still set them) */
  hidden: string[];
  /** Screen ids referenced but never defined */
  missingScreens: string[];
  hasScreenLayout: boolean;
}

export interface LangTable {
  get(key: string): string | undefined;
}

export const EMPTY_LANG: LangTable = { get: () => undefined };

export function parseLang(text: string | undefined): LangTable {
  if (!text) return EMPTY_LANG;
  const map = parseProperties(text);
  return { get: (k) => map.get(k) };
}

/** Picks the English lang file of a pack: en_us.lang / en_US.lang (any case) in shaders/lang/. */
export function findLangPath(paths: Iterable<string>, shadersDir = 'shaders/'): string | null {
  const dir = `${shadersDir}lang/`;
  let best: string | null = null;
  for (const p of paths) {
    if (!p.startsWith(dir) || p.slice(dir.length).includes('/')) continue;
    const name = p.slice(dir.length).toLowerCase();
    if (name === 'en_us.lang') {
      // OptiFine tries the lower case name first
      if (!best || p.endsWith('en_us.lang')) best = p;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------------------------
// Labels

export function optionLabel(lang: LangTable, name: string): string {
  const l = lang.get(`option.${name}`)?.trim();
  return l || prettifyName(name);
}

export function optionComment(lang: LangTable, opt: IrisOption): string {
  return (lang.get(`option.${opt.name}.comment`) ?? opt.comment ?? '').trim();
}

/** Label of one value: value.NAME.v, else prefix.NAME + v + suffix.NAME. */
export function valueLabel(lang: LangTable, opt: IrisOption, value: string): string {
  if (opt.kind === 'bool') return value === 'true' ? 'On' : 'Off';
  const l = lang.get(`value.${opt.name}.${value}`);
  if (l !== undefined && l.trim()) return l.trim();
  return `${lang.get(`prefix.${opt.name}`) ?? ''}${value}${lang.get(`suffix.${opt.name}`) ?? ''}`;
}

export function screenLabel(lang: LangTable, id: string): string {
  return lang.get(`screen.${id}`)?.trim() || prettifyName(id);
}

// ---------------------------------------------------------------------------------------------
// Layout

const MAX_DEPTH = 24;

export function buildLayout(set: IrisOptionSet, propertiesText: string | undefined, lang: LangTable): IrisLayout {
  const props = parseProperties(propertiesText ?? '');
  const has = (n: string) => set.options.has(n);
  const screens = new Map<string, string[]>();
  let mainTokens: string[] | null = null;
  for (const [key, value] of props) {
    if (key === 'screen') mainTokens = wordList(value);
    else if (key.startsWith('screen.') && !key.endsWith('.columns')) screens.set(key.slice('screen.'.length), wordList(value));
  }
  const hasScreenLayout = mainTokens !== null;
  const sliders = new Set(wordList(props.get('sliders')));

  // options named on any screen line are "used"; a '*' shows every unused option
  const used = new Set<string>();
  for (const tokens of [mainTokens ?? [], ...screens.values()]) for (const t of tokens) if (has(t)) used.add(t);
  const unused = [...set.options.keys()].filter((n) => !used.has(n));

  const missing = new Set<string>();
  const shown = new Set<string>();
  const build = (id: string, tokens: string[], path: string[]): ScreenNode => {
    const node: ScreenNode = {
      id,
      label: id ? screenLabel(lang, id) : 'Main screen',
      comment: id ? (lang.get(`screen.${id}.comment`) ?? '').trim() : '',
      items: [],
    };
    for (const t of tokens) {
      if (t === '<empty>') continue;
      if (t === '<profile>') {
        node.items.push({ type: 'profile' });
        continue;
      }
      if (t === '*') {
        for (const n of unused) {
          node.items.push({ type: 'option', name: n });
          shown.add(n);
        }
        continue;
      }
      if (t.startsWith('[') && t.endsWith(']')) {
        const sub = t.slice(1, -1);
        const subTokens = screens.get(sub);
        if (!subTokens) {
          missing.add(sub);
          continue;
        }
        if (path.includes(sub) || path.length >= MAX_DEPTH) continue;
        node.items.push({ type: 'screen', screen: build(sub, subTokens, [...path, sub]) });
        continue;
      }
      if (has(t)) {
        node.items.push({ type: 'option', name: t });
        shown.add(t);
      }
    }
    return node;
  };
  const main = build('', mainTokens ?? ['*'], []);

  // profiles, with profile.X inheritance
  const rawProfiles = new Map<string, string[]>();
  for (const [key, value] of props) if (key.startsWith('profile.') && key.length > 'profile.'.length) rawProfiles.set(key.slice('profile.'.length), wordList(value));
  const resolve = (id: string, parents: string[]): Map<string, string> => {
    const out = new Map<string, string>();
    for (const tok of rawProfiles.get(id) ?? []) {
      if (tok.startsWith('!program.')) continue;
      if (tok.startsWith('profile.')) {
        const dep = tok.slice('profile.'.length);
        if (parents.includes(dep) || !rawProfiles.has(dep)) continue;
        for (const [k, v] of resolve(dep, [...parents, dep])) out.set(k, v);
      } else if (tok.startsWith('!')) out.set(tok.slice(1), 'false');
      else if (tok.includes('=')) out.set(tok.slice(0, tok.indexOf('=')), tok.slice(tok.indexOf('=') + 1));
      else if (tok.includes(':')) out.set(tok.slice(0, tok.indexOf(':')), tok.slice(tok.indexOf(':') + 1));
      else if (set.options.get(tok)?.kind === 'bool') out.set(tok, 'true');
    }
    return out;
  };
  const profiles: ProfileDef[] = [];
  for (const id of rawProfiles.keys()) {
    const values = new Map<string, string>();
    for (const [k, v] of resolve(id, [id])) {
      const opt = set.options.get(k);
      if (!opt) continue;
      if (opt.kind === 'bool' && v !== 'true' && v !== 'false') continue;
      values.set(k, v);
    }
    profiles.push({ id, label: lang.get(`profile.${id}`)?.trim() || prettifyName(id), values });
  }

  return {
    main,
    sliders,
    profiles,
    profileComment: (lang.get('profile.comment') ?? '').trim(),
    hidden: [...set.options.keys()].filter((n) => !shown.has(n)),
    missingScreens: [...missing].sort(),
    hasScreenLayout,
  };
}

/** The profile whose every value matches `current` (the most specific one when several do). */
export function matchingProfile(profiles: ProfileDef[], current: (name: string) => string | undefined): ProfileDef | null {
  let best: ProfileDef | null = null;
  for (const p of profiles) {
    if (!p.values.size) continue;
    let ok = true;
    for (const [k, v] of p.values) {
      if (current(k) !== v) {
        ok = false;
        break;
      }
    }
    if (ok && (!best || p.values.size > best.values.size)) best = p;
  }
  return best;
}
