// Edition-agnostic model library: the blocks and items of a game version, their states, the textures
// each one uses (labelled by role: 'Front', 'Front (lit)', 'Side'...), baked geometry for a chosen state,
// and the reverse index texture -> blocks/items using it. Java reads blockstates/models/items from the
// jar; Bedrock reads blocks.json and the texture atlases. Pure apart from AssetIndex reads.

import type { AssetIndex, ProgressFn } from '../../core/types';
import { parseLenientJson } from '../../editions/bedrock/catalog';
import { BedrockBackend, parseLang } from './bedrock-blocks';
import { JavaBackend, javaModelFiles } from './java-blocks';
import { labelTextures, pretty, propertyLabel, valueLabel, type LabelInput } from './labels';
import type { BakedQuad, Dir } from './geometry';
import type { BlockState, EditionBackend, ModelCategory, ModelEntry, ModelTexture, ModelView, RawView, StateProperty, TextureStates, TextureUsage } from './types';

export * from './types';
export type { BakedQuad, Tint, Dir, Vec3, RGB } from './geometry';

interface Pair {
  prop: string;
  /** property value -> backend block id */
  map: Record<string, string>;
}

interface BlockRecord {
  entry: ModelEntry;
  /** Backend id used when there's no pairing */
  raw: string;
  pair?: Pair;
}

const DIR_RANK: Record<Dir, number> = { north: 0, up: 1, east: 2, west: 2, south: 3, down: 4 };

export class ModelLibrary {
  private readonly blockRecords: BlockRecord[] = [];
  private readonly blockIndex = new Map<string, BlockRecord>();
  private readonly itemEntries: ModelEntry[] = [];
  private readonly itemIndex = new Map<string, ModelEntry>();
  private usageCache: Map<string, TextureUsage> | null = null;
  private readonly categories = new Map<string, ModelCategory>();
  private readonly textureCache = new Map<string, TextureStates[]>();

  constructor(
    readonly edition: 'java' | 'bedrock',
    readonly version: string,
    private readonly backend: EditionBackend | null,
    /** Why there are no models (e.g. Java before 1.8) */
    readonly unavailable?: string,
  ) {
    if (!backend) return;
    const ids = backend.blockIds();
    const idSet = new Set(ids);
    const consumed = new Set<string>();
    const pairs = new Map<string, Pair>();
    const addPair = (base: string, prop: string, map: Record<string, string>) => {
      pairs.set(base, { prop, map });
      for (const v of Object.values(map)) if (v !== base) consumed.add(v);
    };
    for (const id of ids) {
      let m: RegExpExecArray | null;
      if ((m = /^lit_(.+)$/.exec(id)) && idSet.has(m[1]) && m[1] !== 'pumpkin') addPair(m[1], 'lit', { false: m[1], true: id });
      else if ((m = /^unlit_(.+)$/.exec(id)) && idSet.has(m[1])) addPair(m[1], 'lit', { false: id, true: m[1] });
      else if ((m = /^unpowered_(.+)$/.exec(id)) && idSet.has(`powered_${m[1]}`)) addPair(m[1], 'powered', { false: id, true: `powered_${m[1]}` });
      else if ((m = /^(.+)_inverted$/.exec(id)) && idSet.has(m[1])) addPair(m[1], 'inverted', { false: m[1], true: id });
    }
    const names = new Map<string, string>();
    for (const id of ids) {
      if (consumed.has(id)) continue;
      const rec: BlockRecord = { entry: { kind: 'block', id, name: '' }, raw: id };
      names.set(id, backend.blockName(id) ?? '');
      this.blockRecords.push(rec);
    }
    for (const [base, pair] of pairs) {
      let rec = this.blockRecords.find((r) => r.entry.id === base);
      if (!rec) {
        rec = { entry: { kind: 'block', id: base, name: '' }, raw: pair.map.false };
        this.blockRecords.push(rec);
        names.set(base, backend.blockName(pair.map.false) ?? '');
      }
      rec.pair = pair;
    }
    for (const r of this.blockRecords) {
      r.entry.name = names.get(r.entry.id) || pretty(r.entry.id);
      this.blockIndex.set(r.entry.id, r);
    }
    this.blockRecords.sort((a, b) => a.entry.name.localeCompare(b.entry.name));
    for (const id of backend.itemIds()) {
      const e: ModelEntry = { kind: 'item', id, name: backend.itemName(id) || pretty(id) };
      this.itemEntries.push(e);
      this.itemIndex.set(id, e);
    }
    this.itemEntries.sort((a, b) => a.name.localeCompare(b.name));
  }

  get available(): boolean {
    return !!this.backend && this.blockRecords.length > 0;
  }

  blocks(): ModelEntry[] {
    return this.blockRecords.map((r) => r.entry);
  }

  items(): ModelEntry[] {
    return this.itemEntries;
  }

  block(id: string): ModelEntry | undefined {
    return this.blockIndex.get(id)?.entry;
  }

  item(id: string): ModelEntry | undefined {
    return this.itemIndex.get(id);
  }

  get(kind: 'block' | 'item', id: string): ModelEntry | undefined {
    return kind === 'block' ? this.block(id) : this.item(id);
  }

  // ------------------------------------------------------------------ states

  private rawFor(rec: BlockRecord, state: BlockState): { raw: string; state: BlockState } {
    if (!rec.pair) return { raw: rec.raw, state };
    const v = state[rec.pair.prop] ?? 'false';
    const raw = rec.pair.map[v] ?? rec.raw;
    const rest = { ...state };
    delete rest[rec.pair.prop];
    return { raw, state: rest };
  }

  /** Properties with values a user can pick (combined ones such as door halves are left out). */
  properties(entry: ModelEntry): StateProperty[] {
    const b = this.backend;
    if (!b) return [];
    if (entry.kind === 'item') {
      const opts = b.itemOptions(entry.id);
      return opts.length > 1 ? [{ name: 'model', label: 'Look', values: opts.map((l, i) => ({ value: String(i), label: l })) }] : [];
    }
    const rec = this.blockIndex.get(entry.id);
    if (!rec) return [];
    const hidden = new Set(b.combinedProperties?.(rec.raw) ?? []);
    const props = b.blockProperties(rec.raw).filter((p) => !hidden.has(p.name));
    const out: StateProperty[] = props.map((p) => ({
      name: p.name,
      label: propertyLabel(p.name),
      values: p.values.map((v) => ({ value: v, label: p.name === 'variant' && b instanceof BedrockBackend ? b.variantLabels(rec.raw)[Number(v)] ?? v : valueLabel(p.name, v) })),
    }));
    if (rec.pair) out.unshift({ name: rec.pair.prop, label: propertyLabel(rec.pair.prop), values: ['false', 'true'].map((v) => ({ value: v, label: valueLabel(rec.pair!.prop, v) })) });
    return out;
  }

  defaultState(entry: ModelEntry): BlockState {
    const b = this.backend;
    if (!b) return {};
    if (entry.kind === 'item') return b.itemOptions(entry.id).length > 1 ? { model: '0' } : {};
    const rec = this.blockIndex.get(entry.id);
    if (!rec) return {};
    const s = { ...b.defaultBlockState(rec.raw) };
    for (const p of b.combinedProperties?.(rec.raw) ?? []) delete s[p];
    if (rec.pair) s[rec.pair.prop] = 'false';
    return s;
  }

  // ------------------------------------------------------------------ views

  private rawView(entry: ModelEntry, state: BlockState): RawView {
    const b = this.backend!;
    if (entry.kind === 'item') return b.resolveItem(entry.id, Number(state.model ?? 0) || 0);
    const rec = this.blockIndex.get(entry.id)!;
    const { raw, state: s } = this.rawFor(rec, state);
    return b.resolveBlock(raw, s);
  }

  /** Quads, textures (labelled, current state first) and notes for an entry in a state. */
  resolve(entry: ModelEntry, state: BlockState = this.defaultState(entry)): ModelView {
    if (!this.backend) return { entry, state, shape: 'special', quads: [], sprite: [], textures: [], category: 'special', note: this.unavailable };
    const raw = this.rawView(entry, state);
    const faces = new Map<string, { n: number; rank: number; role: string }>();
    for (const q of raw.quads) {
      if (!q.texture) continue;
      const rank = q.worldDir ? DIR_RANK[q.worldDir] : 0;
      const hit = faces.get(q.texture);
      if (hit) {
        hit.n++;
        hit.rank = Math.min(hit.rank, rank);
      } else faces.set(q.texture, { n: 1, rank, role: q.role });
    }
    raw.sprite.forEach((s, i) => {
      if (!faces.has(s.path)) faces.set(s.path, { n: 1, rank: i, role: s.role });
    });
    const all = this.textureStates(entry);
    const labels = this.labels(entry, all);
    const textures: ModelTexture[] = [];
    const seen = new Set<string>();
    const cur = [...faces.entries()].sort((a, b) => a[1].rank - b[1].rank || b[1].n - a[1].n);
    for (const [path, f] of cur) {
      seen.add(path);
      textures.push({ path, label: labels.get(path) ?? pretty(f.role), role: f.role, faces: f.n, missing: !this.backend.hasTexture(path) || undefined, animated: this.backend.isAnimated(path) || undefined });
    }
    for (const t of all) {
      if (seen.has(t.path)) continue;
      seen.add(t.path);
      textures.push({
        path: t.path,
        label: labels.get(t.path) ?? pretty(t.role),
        role: t.role,
        faces: 0,
        state: { ...state, ...closestState(t.states, state) },
        missing: !this.backend.hasTexture(t.path) || undefined,
        animated: this.backend.isAnimated(t.path) || undefined,
      });
    }
    this.categories.set(`${entry.kind}:${entry.id}`, raw.category);
    return { entry, state, shape: raw.shape, quads: raw.quads, sprite: raw.sprite, textures, note: raw.note, displayYaw: raw.displayYaw, category: raw.category, approximate: raw.approximate };
  }

  /** Every texture the entry can show, with the (partial) states that show it. */
  textureStates(entry: ModelEntry): TextureStates[] {
    const key = `${entry.kind}:${entry.id}`;
    const hit = this.textureCache.get(key);
    if (hit) return hit;
    const b = this.backend;
    let out: TextureStates[] = [];
    if (b && entry.kind === 'item') {
      const n = Math.max(1, b.itemOptions(entry.id).length);
      const byPath = new Map<string, TextureStates>();
      const add = (path: string, role: string, state: BlockState, dir: string | null) => {
        let t = byPath.get(path);
        if (!t) byPath.set(path, (t = { path, role, states: [], dirs: [] }));
        if (!t.states.some((x) => x.model === state.model)) t.states.push(state);
        if (dir && !t.dirs.includes(dir)) t.dirs.push(dir);
      };
      for (let i = 0; i < n; i++) {
        const v = b.resolveItem(entry.id, i);
        const state: BlockState = n > 1 ? { model: String(i) } : {};
        for (const q of v.quads) if (q.texture) add(q.texture, q.role, state, q.dir);
        for (const sp of v.sprite) add(sp.path, sp.role, state, null);
      }
      out = [...byPath.values()];
    } else if (b) {
      const rec = this.blockIndex.get(entry.id);
      if (rec?.pair) {
        const byPath = new Map<string, TextureStates>();
        for (const [v, raw] of Object.entries(rec.pair.map))
          for (const t of b.blockTextureStates(raw)) {
            const states = t.states.map((st) => ({ ...st, [rec.pair!.prop]: v }));
            const hit = byPath.get(t.path);
            if (hit) {
              hit.states.push(...states);
              for (const d of t.dirs) if (!hit.dirs.includes(d)) hit.dirs.push(d);
            } else byPath.set(t.path, { ...t, states });
          }
        out = [...byPath.values()];
      } else if (rec) out = b.blockTextureStates(rec.raw);
    }
    this.textureCache.set(key, out);
    return out;
  }

  private labels(entry: ModelEntry, all: TextureStates[]): Map<string, string> {
    const inputs: LabelInput[] = all.map((t) => ({ path: t.path, role: t.role, states: t.states, dirs: t.dirs }));
    const halves = entry.kind === 'block' && !!this.backend?.combinedProperties?.(this.blockIndex.get(entry.id)?.raw ?? entry.id).includes('half');
    const b = this.backend;
    const raw = this.blockIndex.get(entry.id)?.raw ?? entry.id;
    const valueName = (prop: string, value: string) => {
      if (prop === 'variant' && b instanceof BedrockBackend) return b.variantLabels(raw)[Number(value)];
      if (prop === 'look') return value === 'inventory' ? 'in inventory' : null;
      if (prop === 'model' && entry.kind === 'item') return b?.itemOptions(entry.id)[Number(value)]?.toLowerCase();
      return null;
    };
    return labelTextures(entry.id, inputs, all.flatMap((t) => t.states), { halves, valueName });
  }

  /** Browser grouping; resolves the default state the first time. */
  category(entry: ModelEntry): ModelCategory {
    if (entry.kind === 'item') return 'item';
    const key = `${entry.kind}:${entry.id}`;
    let c = this.categories.get(key);
    if (!c) {
      try {
        c = this.rawView(entry, this.defaultState(entry)).category;
      } catch {
        c = 'special';
      }
      this.categories.set(key, c);
    }
    return c;
  }

  /** The texture that best represents an entry (front face, else top, else its sprite). */
  thumbnail(entry: ModelEntry): string | null {
    let v: RawView;
    try {
      v = this.rawView(entry, this.defaultState(entry));
    } catch {
      return null;
    }
    const pick = (qs: BakedQuad[]) => qs.find((q) => q.texture && this.backend!.hasTexture(q.texture))?.texture ?? null;
    return pick(v.quads.filter((q) => q.worldDir === 'north' && q.tintindex < 0)) ?? pick(v.quads.filter((q) => q.worldDir === 'north')) ?? pick(v.quads.filter((q) => q.worldDir === 'up')) ?? pick(v.quads) ?? v.sprite[0]?.path ?? null;
  }

  // ------------------------------------------------------------------ reverse index

  /** texture path -> blocks and items that use it (ids, most specific first). */
  usage(): Map<string, TextureUsage> {
    if (this.usageCache) return this.usageCache;
    const job = this.usageJob();
    while (!job.next().done) {
      /* run to the end */
    }
    return this.usageCache!;
  }

  /** Same as usage(), built in slices that yield to the page between them. */
  async usageAsync(): Promise<Map<string, TextureUsage>> {
    if (this.usageCache) return this.usageCache;
    const job = this.usageJob();
    while (!job.next().done) await new Promise((r) => setTimeout(r, 0));
    return this.usageCache!;
  }

  get usageReady(): boolean {
    return !!this.usageCache;
  }

  private *usageJob(): Generator<void, void, void> {
    const map = new Map<string, TextureUsage>();
    const add = (path: string, kind: 'blocks' | 'items', id: string) => {
      let u = map.get(path);
      if (!u) map.set(path, (u = { blocks: [], items: [] }));
      if (!u[kind].includes(id)) u[kind].push(id);
    };
    let n = 0;
    for (const e of this.blocks()) {
      try {
        for (const t of this.textureStates(e)) add(t.path, 'blocks', e.id);
      } catch {
        /* a broken blockstate shouldn't hide the rest */
      }
      if (++n % 120 === 0) yield;
    }
    if (this.backend)
      for (const e of this.itemEntries) {
        try {
          for (const p of this.backend.itemTexturePaths(e.id)) add(p, 'items', e.id);
        } catch {
          /* skip */
        }
        if (++n % 120 === 0) yield;
      }
    for (const [path, u] of map) {
      const name = path.slice(path.lastIndexOf('/') + 1).replace(/\.(png|tga)$/i, '');
      const rank = (id: string) => (name === id ? 0 : name.startsWith(`${id}_`) ? 1 : id.startsWith(name) ? 2 : name.includes(id) || id.includes(name) ? 3 : 4);
      const byName = (kind: 'block' | 'item') => (a: string, b: string) => rank(a) - rank(b) || (this.get(kind, a)?.name ?? a).localeCompare(this.get(kind, b)?.name ?? b);
      u.blocks.sort(byName('block'));
      u.items.sort(byName('item'));
    }
    if (!this.usageCache) this.usageCache = map;
  }

  usageOf(path: string): TextureUsage {
    return this.usage().get(path) ?? { blocks: [], items: [] };
  }
}

/** Of the states that show a texture, the one sharing most values with the current state. */
function closestState(states: BlockState[], current: BlockState): BlockState {
  let best = states[0] ?? {};
  let score = -1;
  for (const s of states) {
    let n = 0;
    for (const [k, v] of Object.entries(s)) if (current[k] === v) n++;
    n -= Object.keys(s).length * 0.001;
    if (n > score) {
      score = n;
      best = s;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------------------------
// Loading

export interface LoadOptions {
  onProgress?: ProgressFn;
  signal?: AbortSignal;
  /** Downloads Java jar groups ahead of reading them (reports progress); optional */
  prefetch?: (groups: string[], opts: { onProgress?: ProgressFn; signal?: AbortSignal }) => Promise<void>;
}

const libraries = new WeakMap<AssetIndex, Promise<ModelLibrary>>();

/** The model library of an asset index (shared per index; failed loads are retried next time). */
export function loadModelLibrary(assets: AssetIndex, opts: LoadOptions = {}): Promise<ModelLibrary> {
  let p = libraries.get(assets);
  if (!p) {
    p = (assets.edition === 'java' ? loadJava(assets, opts) : loadBedrock(assets)).catch((err) => {
      libraries.delete(assets);
      throw err;
    });
    libraries.set(assets, p);
  }
  return p;
}

/** Already loaded (no waiting), else null. */
export function peekModelLibrary(assets: AssetIndex): Promise<ModelLibrary> | null {
  return libraries.get(assets) ?? null;
}

function animatedSet(assets: AssetIndex): Set<string> {
  return new Set(assets.textures.filter((t) => t.animated).map((t) => t.path));
}

async function loadJava(assets: AssetIndex, opts: LoadOptions): Promise<ModelLibrary> {
  const files = javaModelFiles((p) => assets.listFiles(p));
  if (!files.some((f) => f.includes('/blockstates/'))) {
    return new ModelLibrary('java', assets.version, null, `Minecraft ${assets.version} draws blocks with its own code: block model files arrived in 1.8. Use All textures to edit them.`);
  }
  if (opts.prefetch) await opts.prefetch(['blockstates', 'models', 'items', 'lang'], { onProgress: opts.onProgress, signal: opts.signal });
  const texts = new Map<string, string>();
  await Promise.all(
    files.map(async (f) => {
      try {
        texts.set(f, await assets.readText(f));
      } catch {
        /* unreadable file: treated as missing */
      }
    }),
  );
  const parsed = new Map<string, unknown>();
  const json = (path: string): unknown => {
    if (parsed.has(path)) return parsed.get(path);
    const t = texts.get(path);
    let v: unknown;
    if (t !== undefined) {
      try {
        v = JSON.parse(t.charCodeAt(0) === 0xfeff ? t.slice(1) : t);
      } catch {
        try {
          v = parseLenientJson(t);
        } catch {
          v = undefined;
        }
      }
    }
    parsed.set(path, v);
    return v;
  };
  const lang = await readJavaLang(assets);
  const backend = new JavaBackend({ version: assets.version, json, hasFile: (p) => assets.hasFile(p), listFiles: (p) => assets.listFiles(p), animated: animatedSet(assets), lang });
  return new ModelLibrary('java', assets.version, backend);
}

async function readJavaLang(assets: AssetIndex): Promise<Record<string, string>> {
  for (const p of ['assets/minecraft/lang/en_us.json', 'assets/minecraft/lang/en_us.lang', 'assets/minecraft/lang/en_US.lang']) {
    if (!assets.hasFile(p)) continue;
    try {
      const text = await assets.readText(p);
      if (p.endsWith('.json')) return JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text) as Record<string, string>;
      return parseLang(text);
    } catch {
      /* try the next one */
    }
  }
  return {};
}

async function loadBedrock(assets: AssetIndex): Promise<ModelLibrary> {
  const read = async (p: string, lenient = true): Promise<unknown> => {
    try {
      const t = await assets.readText(p);
      return lenient ? parseLenientJson(t) : JSON.parse(t);
    } catch {
      return undefined;
    }
  };
  const [blocks, terrain, items, langText] = await Promise.all([
    read('blocks.json'),
    read('textures/terrain_texture.json'),
    read('textures/item_texture.json'),
    assets.hasFile('texts/en_US.lang') ? assets.readText('texts/en_US.lang').catch(() => '') : Promise.resolve(''),
  ]);
  if (!blocks || !terrain) {
    return new ModelLibrary('bedrock', assets.version, null, "The block list for this Bedrock version couldn't be loaded. Check your connection, or use All textures.");
  }
  const backend = new BedrockBackend({ blocks, terrain, items, lang: parseLang(langText), hasFile: (p) => assets.hasFile(p), animated: animatedSet(assets) });
  return new ModelLibrary('bedrock', assets.version, backend);
}

// ---------------------------------------------------------------------------------------------
// Convenience API

export async function listBlocks(assets: AssetIndex): Promise<ModelEntry[]> {
  return (await loadModelLibrary(assets)).blocks();
}

export async function listItems(assets: AssetIndex): Promise<ModelEntry[]> {
  return (await loadModelLibrary(assets)).items();
}

export async function getBlockStates(assets: AssetIndex, blockId: string): Promise<StateProperty[]> {
  const lib = await loadModelLibrary(assets);
  const e = lib.block(blockId);
  return e ? lib.properties(e) : [];
}

export async function resolveBlock(assets: AssetIndex, blockId: string, state?: BlockState): Promise<ModelView | null> {
  const lib = await loadModelLibrary(assets);
  const e = lib.block(blockId);
  return e ? lib.resolve(e, state ? { ...lib.defaultState(e), ...state } : undefined) : null;
}

export async function textureUsage(assets: AssetIndex): Promise<Map<string, TextureUsage>> {
  return (await loadModelLibrary(assets)).usage();
}
