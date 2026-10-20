// Human labels for model textures ("Front", "Front (lit)", "Side 3", "Top") and block state values.

import type { BlockState } from './types';
import { fmt, textLocale } from '../../i18n/editor-text';
import { mt, type ModelsText } from './i18n/text';

type RoleKey = Exclude<keyof ModelsText['roles'], 'layer'>;

const SMALL = new Set(['of', 'on', 'and', 'the', 'a', 'in']);

/** 'grass_block_top' -> 'Grass Block Top' */
export function pretty(name: string): string {
  return name
    .replace(/^minecraft:/, '')
    .replace(/[_\-./]+/g, ' ')
    .replace(/([a-z])(\d)/g, '$1 $2')
    .trim()
    .split(/\s+/)
    .map((w, i) => (i > 0 && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/** Texture roles -> their name in ./i18n/text.ts (roles) */
const ROLE_LABELS: Record<string, RoleKey> = {
  up: 'top',
  top: 'top',
  down: 'bottom',
  bottom: 'bottom',
  north: 'front',
  front: 'front',
  south: 'back',
  back: 'back',
  east: 'side',
  west: 'side',
  side: 'side',
  all: 'all',
  texture: 'all',
  end: 'ends',
  cross: 'plant',
  plant: 'plant',
  crop: 'plant',
  flowerbed: 'flowers',
  torch: 'torch',
  particle: 'particles',
  overlay: 'overlay',
  layer0: 'sprite',
  pattern: 'pattern',
  wool: 'wool',
  rail: 'rail',
  lantern: 'lantern',
  lower: 'lower',
  upper: 'upper',
  fan: 'fan',
  inside: 'inside',
  content: 'contents',
  line: 'line',
  dot: 'dot',
  stem: 'stem',
  upperstem: 'stem',
  pane: 'pane',
  edge: 'edge',
  // Models the game draws with its own code (one texture sheet each)
  chest: 'chest',
  chest_left: 'leftHalf',
  chest_right: 'rightHalf',
  chest_double: 'doubleChest',
  shulker_box: 'shulkerBox',
  banner: 'banner',
  banner_color: 'colourMask',
  head: 'head',
  pot_base: 'potBase',
  pot_side: 'potSide',
  conduit_shell: 'shell',
  bell_body: 'bell',
  book: 'book',
  statue: 'statue',
  sign: 'sign',
  hanging_sign: 'hangingSign',
  bed: 'bed',
  end_portal: 'portal',
  shield: 'shield',
  trident: 'trident',
  sprite: 'itemIcon',
};

/** Roles of entity-drawn models: their texture sheets are named by what they are, not by file name. */
const ENTITY_ROLES = new Set(['chest', 'chest_left', 'chest_right', 'chest_double', 'shulker_box', 'banner', 'banner_color', 'head', 'pot_base', 'pot_side', 'conduit_shell', 'bell_body', 'book', 'statue', 'sign', 'hanging_sign', 'bed', 'end_portal', 'shield', 'trident', 'sprite']);

/** Label for a texture variable / face key when the texture name says nothing about its place. */
export function roleLabel(role: string): string {
  const m = /^layer(\d+)$/.exec(role);
  if (m && m[1] !== '0') return fmt(mt.roles.layer, { n: Number(m[1]) + 1 });
  const key = ROLE_LABELS[role];
  return key ? mt.roles[key] : pretty(role);
}

const GENERIC_ROLES = new Set(['up', 'down', 'north', 'south', 'east', 'west', 'top', 'bottom', 'side', 'front', 'back', 'end', 'all', 'texture', 'particle']);

const DROP_TOKENS = new Set(['on', 'off', 'lit', 'unlit', 'powered', 'active', 'inactive']);
const QUALIFIER_TOKENS: Record<string, string> = { on: 'on', lit: 'lit', powered: 'powered', active: 'active' };

const english = (): boolean => textLocale() === 'en';

/**
 * A texture's name from the words of its file name ('side', '3' -> 'Side 3'): English shows the
 * words as they are; other languages translate them (./i18n/text.ts, words), or keep them when a
 * word isn't known.
 */
function words(tokens: string[]): string {
  if (!english()) {
    const dict = mt.words as Record<string, string>;
    if (tokens.length && tokens.every((t) => /^\d+$/.test(t) || dict[t])) {
      const out = tokens.map((t) => dict[t] ?? t).join(textLocale() === 'ja' ? '' : ' ');
      return out.charAt(0).toUpperCase() + out.slice(1);
    }
  }
  return pretty(tokens.join('_'));
}

function tokens(s: string): string[] {
  return s.toLowerCase().split(/[_\s]+/).filter(Boolean);
}

/**
 * What remains of a texture name after the block's own name, e.g. furnace_front_on for 'furnace' ->
 * ['front', 'on']; oak_planks for 'oak_stairs' -> ['planks']. Null when they share nothing.
 */
export function textureSuffix(blockId: string, textureName: string): string[] | null {
  const b = tokens(blockId.replace(/^(lit|unlit|powered|unpowered)_/, ''));
  const t = tokens(textureName);
  let i = 0;
  while (i < b.length && i < t.length && (t[i] === b[i] || t[i] === `${b[i]}s` || `${t[i]}s` === b[i])) i++;
  if (i === 0) return null;
  return t.slice(i);
}

type ValueName = (prop: string, value: string) => string | null | undefined;

function qualifierFor(prop: string, value: string, name?: ValueName): string | null {
  if (value === 'false' || value === 'none' || value === 'off') return null;
  const named = name?.(prop, value);
  if (named) return named;
  const p = english() ? prop.replace(/_/g, ' ') : propertyLabel(prop);
  if (value === 'true') return p;
  if (/^\d+$/.test(value)) return `${p} ${value}`;
  return english() ? value.replace(/_/g, ' ') : valueLabel(prop, value);
}

export interface LabelInput {
  path: string;
  role: string;
  /** Partial states (variant keys) that use this texture */
  states: BlockState[];
  /** Model faces it covers (up, north, ...) */
  dirs?: string[];
}

/**
 * Labels for every texture of a block. Names come from what the texture file adds to the block name
 * ('_front', '_side3'), else from the texture variable ('top', 'all', 'cross'). Textures that would get
 * the same label are told apart by the state that shows them: 'Front' and 'Front (lit)'.
 */
export function labelTextures(blockId: string, inputs: LabelInput[], allStates: BlockState[], opts: { halves?: boolean; valueName?: ValueName } = {}): Map<string, string> {
  const base = new Map<string, string>();
  for (const inp of inputs) {
    const name = inp.path.slice(inp.path.lastIndexOf('/') + 1).replace(/\.(png|tga)$/i, '');
    const suffix = textureSuffix(blockId, name);
    let label: string;
    const kept = suffix?.filter((t) => !DROP_TOKENS.has(t)) ?? [];
    if (ENTITY_ROLES.has(inp.role)) {
      label = roleLabel(inp.role);
    } else if (suffix && kept.length) {
      if (opts.halves && kept.length === 1 && (kept[0] === 'top' || kept[0] === 'upper')) label = mt.roles.upper;
      else if (opts.halves && kept.length === 1 && (kept[0] === 'bottom' || kept[0] === 'lower')) label = mt.roles.lower;
      else label = words(kept);
    } else if (opts.halves && /^(top|upper|up)$/.test(inp.role)) {
      label = mt.roles.upper;
    } else if (opts.halves && /^(bottom|lower|down)$/.test(inp.role)) {
      label = mt.roles.lower;
    } else if ((inp.dirs?.length ?? 0) >= 5 && GENERIC_ROLES.has(inp.role)) {
      label = mt.roles.all;
    } else {
      label = roleLabel(inp.role);
    }
    base.set(inp.path, label);
  }
  // Disambiguate equal labels with the state that shows each texture.
  const groups = new Map<string, LabelInput[]>();
  for (const inp of inputs) {
    const l = base.get(inp.path)!;
    groups.set(l, [...(groups.get(l) ?? []), inp]);
  }
  const out = new Map(base);
  for (const [label, group] of groups) {
    if (group.length < 2) continue;
    for (const inp of group) {
      const q = distinguishingState(inp.states, allStates, opts.valueName);
      const name = inp.path.slice(inp.path.lastIndexOf('/') + 1).replace(/\.(png|tga)$/i, '');
      const tokenQ = (textureSuffix(blockId, name) ?? []).map((t) => QUALIFIER_TOKENS[t]).find(Boolean);
      if (q) out.set(inp.path, `${label} (${q})`);
      else if (tokenQ) out.set(inp.path, `${label} (${english() ? tokenQ : ((mt.words as Record<string, string>)[tokenQ] ?? tokenQ)})`);
    }
    // Still clashing: fall back to the texture's own name.
    const labels = group.map((g) => out.get(g.path));
    if (new Set(labels).size < labels.length) {
      for (const inp of group) {
        const name = inp.path.slice(inp.path.lastIndexOf('/') + 1).replace(/\.(png|tga)$/i, '');
        const dup = group.filter((g) => out.get(g.path) === out.get(inp.path)).length > 1;
        if (dup) out.set(inp.path, `${label} (${pretty(name)})`);
      }
    }
  }
  return out;
}

/**
 * A property=value shared by every state in `using` that the other states don't have (lit=true for a
 * lit texture), else one that at least some other state lacks.
 */
function distinguishingState(using: BlockState[], all: BlockState[], name?: ValueName): string | null {
  if (!using.length) return null;
  const first = using[0];
  const usingKeys = new Set(using.map((s) => JSON.stringify(s)));
  const others = all.filter((s) => !usingKeys.has(JSON.stringify(s)));
  const shared = Object.entries(first).filter(([k, v]) => using.every((s) => s[k] === v) && all.some((s) => k in s && s[k] !== v));
  const strict = shared.find(([k, v]) => others.length > 0 && !others.some((s) => s[k] === v));
  for (const [k, v] of strict ? [strict] : shared.slice(0, 1)) {
    const q = qualifierFor(k, v, name);
    if (q) return q;
  }
  return null;
}


export function propertyLabel(name: string): string {
  return (mt.props as Record<string, string>)[name] ?? pretty(name);
}

export function valueLabel(prop: string, value: string): string {
  if (value === 'true') return prop === 'lit' ? mt.values.on : mt.values.yes;
  if (value === 'false') return prop === 'lit' ? mt.values.off : mt.values.no;
  return english() ? pretty(value) : words(value.split('_'));
}

/**
 * A label of the model data (mob looks and choices, worn things, item looks: English text) in the
 * page's language, from the table in ./i18n/text.ts (labels); " · "-joined labels part by part.
 * Labels that aren't in the table stay as they are.
 */
export function modelLabel(label: string): string {
  if (english()) return label;
  const dict = mt.labels as Record<string, string>;
  return label
    .split(' · ')
    .map((x) => dict[x] ?? x)
    .join(' · ');
}

/**
 * A mob body part's name in the page's language. `name` is the part's key: a bone name
 * ('left_front_leg') or 'gear:<name>' for a worn thing, whose `label` is its English name.
 */
export function partLabel(name: string, label: string): string {
  if (english()) return label;
  if (name.startsWith('gear:')) {
    const worn = / \(worn\)$/.exec(label);
    return worn ? fmt(mt.parts.worn, { part: modelLabel(label.slice(0, worn.index)) }) : modelLabel(label);
  }
  const nouns = mt.parts.nouns as Record<string, string>;
  const places = mt.parts.places as Record<string, string>;
  const tokens = name
    .toLowerCase()
    .replace(/~\d+$/, '')
    .replace(/([a-z])(\d)/g, '$1_$2')
    .split(/_+/)
    .filter(Boolean);
  const nounAt = tokens.map((t) => !!nouns[t]).lastIndexOf(true);
  if (nounAt < 0) return label;
  const where: string[] = [];
  const nums: string[] = [];
  for (const [i, t] of tokens.entries()) {
    if (i === nounAt) continue;
    if (/^\d+$/.test(t)) nums.push(t);
    else if (places[t]) where.push(places[t]);
    else return label;
  }
  const part = [nouns[tokens[nounAt]], ...nums].join(' ');
  return where.length ? fmt(mt.parts.where, { part, where: where.join(mt.parts.sep) }) : part;
}
