// Human labels for model textures ("Front", "Front (lit)", "Side 3", "Top") and block state values.

import type { BlockState } from './types';

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

const ROLE_LABELS: Record<string, string> = {
  up: 'Top',
  top: 'Top',
  down: 'Bottom',
  bottom: 'Bottom',
  north: 'Front',
  front: 'Front',
  south: 'Back',
  back: 'Back',
  east: 'Side',
  west: 'Side',
  side: 'Side',
  all: 'All sides',
  texture: 'All sides',
  end: 'Ends',
  cross: 'Plant',
  plant: 'Plant',
  crop: 'Plant',
  flowerbed: 'Flowers',
  torch: 'Torch',
  particle: 'Particles',
  overlay: 'Overlay',
  layer0: 'Sprite',
  pattern: 'Pattern',
  wool: 'Wool',
  rail: 'Rail',
  lantern: 'Lantern',
  lower: 'Lower half',
  upper: 'Upper half',
  fan: 'Fan',
  inside: 'Inside',
  content: 'Contents',
  line: 'Line',
  dot: 'Dot',
  stem: 'Stem',
  upperstem: 'Stem',
  pane: 'Pane',
  edge: 'Edge',
};

/** Label for a texture variable / face key when the texture name says nothing about its place. */
export function roleLabel(role: string): string {
  const m = /^layer(\d+)$/.exec(role);
  if (m && m[1] !== '0') return `Layer ${Number(m[1]) + 1}`;
  return ROLE_LABELS[role] ?? pretty(role);
}

const GENERIC_ROLES = new Set(['up', 'down', 'north', 'south', 'east', 'west', 'top', 'bottom', 'side', 'front', 'back', 'end', 'all', 'texture', 'particle']);

const DROP_TOKENS = new Set(['on', 'off', 'lit', 'unlit', 'powered', 'active', 'inactive']);
const QUALIFIER_TOKENS: Record<string, string> = { on: 'on', lit: 'lit', powered: 'powered', active: 'active' };

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
  const p = prop.replace(/_/g, ' ');
  if (value === 'true') return p;
  if (/^\d+$/.test(value)) return `${p} ${value}`;
  return value.replace(/_/g, ' ');
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
    if (suffix && kept.length) {
      if (opts.halves && kept.length === 1 && (kept[0] === 'top' || kept[0] === 'upper')) label = 'Upper half';
      else if (opts.halves && kept.length === 1 && (kept[0] === 'bottom' || kept[0] === 'lower')) label = 'Lower half';
      else label = pretty(kept.join('_'));
    } else if (opts.halves && /^(top|upper|up)$/.test(inp.role)) {
      label = 'Upper half';
    } else if (opts.halves && /^(bottom|lower|down)$/.test(inp.role)) {
      label = 'Lower half';
    } else if ((inp.dirs?.length ?? 0) >= 5 && GENERIC_ROLES.has(inp.role)) {
      label = 'All sides';
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
      else if (tokenQ) out.set(inp.path, `${label} (${tokenQ})`);
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

/** A property=value shared by every state in `using` that some other state doesn't have. */
function distinguishingState(using: BlockState[], all: BlockState[], name?: ValueName): string | null {
  if (!using.length) return null;
  const first = using[0];
  for (const [k, v] of Object.entries(first)) {
    if (!using.every((s) => s[k] === v)) continue;
    if (!all.some((s) => k in s && s[k] !== v)) continue;
    const q = qualifierFor(k, v, name);
    if (q) return q;
    return null;
  }
  return null;
}

const PROP_LABELS: Record<string, string> = {
  lit: 'Lit',
  powered: 'Powered',
  facing: 'Facing',
  half: 'Half',
  axis: 'Axis',
  open: 'Open',
  hinge: 'Hinge',
  shape: 'Shape',
  type: 'Type',
  age: 'Age',
  waterlogged: 'Waterlogged',
  snowy: 'Snowy',
  variant: 'Variant',
  look: 'Look',
  north: 'North',
  south: 'South',
  east: 'East',
  west: 'West',
  up: 'Up',
  down: 'Down',
};

export function propertyLabel(name: string): string {
  return PROP_LABELS[name] ?? pretty(name);
}

export function valueLabel(prop: string, value: string): string {
  if (value === 'true') return prop === 'lit' ? 'On' : 'Yes';
  if (value === 'false') return prop === 'lit' ? 'Off' : 'No';
  return pretty(value);
}
