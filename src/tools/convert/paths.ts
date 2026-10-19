// Texture path mapping for the pack converter: Java version ordering, Java rename chains between
// versions and Java <-> Bedrock texture pairs. Pure functions, no DOM, no I/O.

import type { JavaBedrockMap, JavaRenameStep, JavaRenames } from '../../editions/convert/maps';

export type { JavaBedrockMap, JavaRenameStep, JavaRenames };

// ---------------------------------------------------------------------------------------------
// Java versions

/**
 * First weekly snapshot of each release cycle (snapshots before 26.1 were named YYwWWx). A weekly
 * snapshot sorts just before the release it led to.
 */
const WEEKLY_CYCLES: [string, string][] = [
  ['13w36a', '1.7'], ['14w02a', '1.8'], ['15w31a', '1.9'], ['16w20a', '1.10'], ['16w32a', '1.11'], ['17w06a', '1.12'],
  ['17w43a', '1.13'], ['18w43a', '1.14'], ['19w34a', '1.15'], ['20w06a', '1.16'], ['20w45a', '1.17'], ['21w37a', '1.18'],
  ['22w11a', '1.19'], ['22w42a', '1.19.3'], ['23w03a', '1.19.4'], ['23w12a', '1.20'], ['23w31a', '1.20.2'], ['23w40a', '1.20.3'],
  ['23w51a', '1.20.5'], ['24w18a', '1.21'], ['24w33a', '1.21.2'], ['24w44a', '1.21.4'], ['25w02a', '1.21.5'], ['25w15a', '1.21.6'],
  ['25w31a', '1.21.9'], ['25w41a', '1.21.11'], ['25w99z', '26.1'],
];

/** Sort key of a Java version id: release numbers, with pre-releases/snapshots just before their release. */
export function javaVersionKey(id: string): number[] {
  const v = id.trim().toLowerCase();
  const weekly = /^(\d\d)w(\d\d)([a-z])/.exec(v);
  if (weekly) {
    const code = `${weekly[1]}w${weekly[2]}${weekly[3]}`;
    const cycle = WEEKLY_CYCLES.find(([first], i) => code >= first && (i === WEEKLY_CYCLES.length - 1 || code < WEEKLY_CYCLES[i + 1][0]));
    const release = cycle ? cycle[1] : code < WEEKLY_CYCLES[0][0] ? '1.6.1' : '26.1';
    return [...releaseParts(release), -1];
  }
  const m = /^(\d+)\.(\d+)(?:\.(\d+))?(.*)$/.exec(v);
  if (!m) return [0, 0, 0, 0];
  return [Number(m[1]), Number(m[2]), Number(m[3] ?? 0), m[4] ? -1 : 0];
}

function releaseParts(id: string): number[] {
  const [a, b, c] = id.split('.').map(Number);
  return [a || 0, b || 0, c || 0];
}

export function compareJavaVersions(a: string, b: string): number {
  const x = javaVersionKey(a);
  const y = javaVersionKey(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

// ---------------------------------------------------------------------------------------------
// Rename chains

export type RenameOutcome =
  /** The texture's names in the target version (one, or several when it was split) */
  | { kind: 'paths'; paths: string[]; renamed: boolean }
  /** It no longer exists in the target version */
  | { kind: 'removed'; version: string };

export interface RenameChain {
  from: string;
  to: string;
  /** 'up' = newer target, 'down' = older target, 'none' = same names */
  direction: 'up' | 'down' | 'none';
  /** Version names apply to after each applied step, in order (for messages) */
  steps: string[];
  map(rel: string): RenameOutcome;
}

const asList = (v: string | string[]): string[] => (Array.isArray(v) ? v : [v]);

/**
 * Maps texture paths (relative to the texture root, no extension) from Java version `from` to
 * Java version `to`. Upgrades apply every step newer than `from` up to `to`; downgrades undo every
 * step newer than `to` up to `from`, newest first. A split (one old texture became several) maps
 * forward to all its parts and back from any part.
 */
export function renameChain(renames: JavaRenames | null | undefined, from: string, to: string): RenameChain {
  const cmp = compareJavaVersions(from, to);
  const direction = cmp < 0 ? 'up' : cmp > 0 ? 'down' : 'none';
  const all = [...(renames?.steps ?? [])].sort((a, b) => compareJavaVersions(a.version, b.version));
  const lo = direction === 'down' ? to : from;
  const hi = direction === 'down' ? from : to;
  const applied = direction === 'none' ? [] : all.filter((s) => compareJavaVersions(s.version, lo) > 0 && compareJavaVersions(s.version, hi) <= 0);

  if (direction !== 'down') {
    const removedSets = applied.map((s) => new Set(s.removed ?? []));
    return {
      from,
      to,
      direction,
      steps: applied.map((s) => s.version),
      map(rel) {
        let cur = [rel];
        let renamed = false;
        for (let i = 0; i < applied.length; i++) {
          const step = applied[i];
          const next: string[] = [];
          for (const p of cur) {
            const r = Object.prototype.hasOwnProperty.call(step.renames, p) ? step.renames[p] : undefined;
            if (r !== undefined) {
              renamed = true;
              next.push(...asList(r));
            } else if (removedSets[i].has(p)) {
              continue;
            } else next.push(p);
          }
          if (!next.length) return { kind: 'removed', version: step.version };
          cur = [...new Set(next)];
        }
        return { kind: 'paths', paths: cur, renamed };
      },
    };
  }

  // Downgrade: undo the steps newest first.
  const undo = [...applied].reverse().map((s) => {
    const inv = new Map<string, string>();
    for (const [oldName, v] of Object.entries(s.renames)) for (const n of asList(v)) if (!inv.has(n)) inv.set(n, oldName);
    return { version: s.version, inv };
  });
  return {
    from,
    to,
    direction,
    steps: undo.map((s) => s.version),
    map(rel) {
      let p = rel;
      let renamed = false;
      for (const s of undo) {
        const old = s.inv.get(p);
        if (old !== undefined) {
          p = old;
          renamed = true;
        }
      }
      return { kind: 'paths', paths: [p], renamed };
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Java <-> Bedrock pairs

export interface PairIndex {
  javaVersion: string;
  /** Java path -> Bedrock paths (in data order) */
  toBedrock: Map<string, string[]>;
  /** Bedrock path -> Java paths (in data order) */
  toJava: Map<string, string[]>;
  /** `${java}\n${bedrock}` of pairs whose layouts differ */
  layoutDiffers: Set<string>;
}

export function pairKey(java: string, bedrock: string): string {
  return `${java}\n${bedrock}`;
}

export function buildPairIndex(map: JavaBedrockMap): PairIndex {
  const toBedrock = new Map<string, string[]>();
  const toJava = new Map<string, string[]>();
  const add = (m: Map<string, string[]>, k: string, v: string) => {
    const list = m.get(k);
    if (!list) m.set(k, [v]);
    else if (!list.includes(v)) list.push(v);
  };
  const layoutDiffers = new Set<string>();
  for (const [j, b] of map.layoutDiffers ?? []) {
    layoutDiffers.add(pairKey(j, b));
    add(toBedrock, j, b);
    add(toJava, b, j);
  }
  for (const [j, b] of map.pairs) {
    add(toBedrock, j, b);
    add(toJava, b, j);
  }
  // Convertible pairs first, so they win over layout-differs ones when both exist.
  const sort = (m: Map<string, string[]>, javaKey: boolean) => {
    for (const [k, list] of m) {
      list.sort((a, b) => Number(layoutDiffers.has(javaKey ? pairKey(k, a) : pairKey(a, k))) - Number(layoutDiffers.has(javaKey ? pairKey(k, b) : pairKey(b, k))));
    }
  };
  sort(toBedrock, true);
  sort(toJava, false);
  return { javaVersion: map.java, toBedrock, toJava, layoutDiffers };
}

// ---------------------------------------------------------------------------------------------
// Model texture references

/**
 * Rewrites the texture references of a Java block/item model ("minecraft:blocks/stone",
 * "blocks/stone", "#side" is left alone) with `mapRef` (path relative to textures/, no
 * extension -> new path, or null to keep). Returns the new JSON text, or null when nothing changed.
 */
export function rewriteModelTextures(text: string, mapRef: (rel: string) => string | null, parse: (t: string) => unknown, stringify: (v: unknown) => string): string | null {
  const json = parse(text) as Record<string, unknown> | null;
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  const textures = json.textures;
  if (!textures || typeof textures !== 'object' || Array.isArray(textures)) return null;
  let changed = false;
  for (const [key, value] of Object.entries(textures as Record<string, unknown>)) {
    let ref: string | null = null;
    let sprite: Record<string, unknown> | null = null;
    if (typeof value === 'string') ref = value;
    else if (value && typeof value === 'object' && typeof (value as { sprite?: unknown }).sprite === 'string') {
      sprite = value as Record<string, unknown>;
      ref = sprite.sprite as string;
    }
    if (!ref || ref.startsWith('#')) continue;
    const colon = ref.indexOf(':');
    const ns = colon >= 0 ? ref.slice(0, colon) : 'minecraft';
    if (ns !== 'minecraft') continue;
    const rel = colon >= 0 ? ref.slice(colon + 1) : ref;
    const next = mapRef(rel);
    if (!next || next === rel) continue;
    const out = (colon >= 0 ? `${ref.slice(0, colon + 1)}` : '') + next;
    if (sprite) sprite.sprite = out;
    else (textures as Record<string, unknown>)[key] = out;
    changed = true;
  }
  return changed ? stringify(json) : null;
}
