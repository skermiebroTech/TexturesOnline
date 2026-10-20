// Texture pack merger engine: two or more opened packs of one edition (see ../textures/import.ts)
// become one texture project. Packs are listed highest priority first, as in Minecraft's pack list:
// for every file the top pack wins, a texture keeps the animation or sidecar file of the pack it
// came from, and the JSON files the game itself layers across packs (languages, sounds, atlases,
// fonts; Bedrock's texture lists, blocks and sound definitions) are merged entry by entry. Java
// packs made for another version first get the texture names of the target version. No DOM.

import type { Edition, ProgressFn, TexturePackProject } from '../../core/types';
import { abortError } from '../../core/net';
import { stringifyPretty } from '../../editions/java/packmeta';
import { DEFAULT_JAVA_VERSION } from '../../editions/versions';
import { BEDROCK_TEXTURE_ROOT, JAVA_TEXTURE_ROOT, extOf, newTextureProject, parseBedrockVersion, parseJsonLoose } from '../textures/project';
import { compareJavaVersions, renameChain, rewriteModelTextures, type JavaRenames, type RenameChain } from '../convert/paths';

export const MIN_PACKS = 2;
export const MAX_PACKS = 8;
export const DEFAULT_MERGED_NAME = 'Merged Pack';

export interface MergeOptions {
  /** Name of the merged pack (default "Merged Pack") */
  name?: string;
  /** Java: version to merge for (default: the newest pack's version) */
  version?: string;
  /** Pack whose icon to use: its index, null for a generated icon, undefined for the top pack that has one */
  iconFrom?: number | null;
  /** Java texture renames between versions (needed when the packs are for different versions) */
  renames?: JavaRenames | null;
  signal?: AbortSignal;
  onProgress?: ProgressFn;
}

export interface PackSummary {
  name: string;
  edition: Edition;
  version: string;
  /** Files the pack brings (after renaming for the target version; pack info and icon not counted) */
  files: number;
  /** Textures among them */
  textures: number;
  /** Files of this pack that are in the merged pack as they are */
  kept: number;
  /** Merged files this pack added entries to */
  merged: number;
  /** Files replaced by the same file of a pack above it */
  overridden: number;
  /** Textures that got the target version's name */
  renamed: number;
  /** Textures the target version doesn't have */
  removed: number;
}

/** A file several packs have; the winner's copy is used. */
export interface MergeConflict {
  /** Path of the winning file */
  path: string;
  winner: number;
  /** Lower packs whose copy was replaced, top first */
  losers: number[];
}

/** A file whose entries were combined from several packs. */
export interface MergedFile {
  path: string;
  /** Packs that contributed, top first */
  packs: number[];
  /** How, for the report ("key by key, top pack first") */
  how: string;
}

export interface DroppedFile {
  path: string;
  pack: number;
  reason: string;
}

export interface MergeReport {
  edition: Edition;
  version: string;
  packs: PackSummary[];
  conflicts: MergeConflict[];
  merged: MergedFile[];
  dropped: DroppedFile[];
  notes: string[];
  /** Files in the merged pack (pack info and icon not counted) */
  files: number;
  /** Textures among them */
  textures: number;
}

export interface MergeResult {
  project: TexturePackProject;
  report: MergeReport;
}

/** The packs' common edition, or null with the indexes of each edition when they differ. */
export function editionOf(projects: Pick<TexturePackProject, 'edition'>[]): { edition: Edition | null; java: number[]; bedrock: number[] } {
  const java: number[] = [];
  const bedrock: number[] = [];
  projects.forEach((p, i) => (p.edition === 'java' ? java : bedrock).push(i));
  return { edition: java.length && bedrock.length ? null : java.length ? 'java' : bedrock.length ? 'bedrock' : null, java, bedrock };
}

/** Java version to merge for by default: the newest pack's version (26.3 without Java packs). */
export function defaultMergeVersion(projects: Pick<TexturePackProject, 'edition' | 'version'>[]): string {
  let best: string | null = null;
  for (const p of projects) if (p.edition === 'java' && (!best || compareJavaVersions(p.version, best) > 0)) best = p.version;
  return best ?? DEFAULT_JAVA_VERSION;
}

/** "A", "A and B", "A, B and C". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Description of the merged pack: the packs in it, top first. */
export function mergeDescription(names: string[]): string {
  return `Merged from ${joinNames(names.map((n) => n.trim() || 'Untitled pack'))}`;
}

/** Path shown in reports: texture paths relative to the texture folder. */
export function displayPath(path: string, edition: Edition): string {
  const root = edition === 'java' ? JAVA_TEXTURE_ROOT : BEDROCK_TEXTURE_ROOT;
  return path.startsWith(root) ? path.slice(root.length) : path;
}

// ---------------------------------------------------------------------------------------------

interface Layer {
  index: number;
  /** path -> file, after renaming for the target version */
  files: Map<string, Blob>;
  /** Paths that are editable textures (project overrides) */
  textures: Set<string>;
  /** pack.mcmeta / manifest.json of the source pack */
  meta?: Blob;
  summary: PackSummary;
}

type Spec = '*' | { [key: string]: Spec };

type Rule =
  | { kind: 'keyed'; spec: Spec; how: string }
  | { kind: 'sound-definitions'; how: string }
  | { kind: 'lines'; how: string }
  | { kind: 'concat'; field: 'sources' | 'providers'; topFirst: boolean; how: string }
  | { kind: 'union'; how: string }
  | { kind: 'flipbook'; how: string };

const FLIPBOOK = 'textures/flipbook_textures.json';
const KEYED_HOW = 'key by key, the top pack wins';
const IMAGE = /\.(png|tga|jpe?g)$/i;

/** How a file is merged when several packs have it, or null when the top pack's copy wins. */
function ruleFor(path: string, edition: Edition): Rule | null {
  if (edition === 'java') {
    if (/^assets\/[^/]+\/lang\/[^/]+\.json$/.test(path)) return { kind: 'keyed', spec: '*', how: 'translations key by key, the top pack wins' };
    if (/^assets\/[^/]+\/lang\/[^/]+\.lang$/.test(path)) return { kind: 'lines', how: 'translations key by key, the top pack wins' };
    if (/^assets\/[^/]+\/sounds\.json$/.test(path)) return { kind: 'keyed', spec: '*', how: 'sound events one by one, the top pack wins' };
    if (/^assets\/[^/]+\/atlases\/.+\.json$/.test(path)) return { kind: 'concat', field: 'sources', topFirst: false, how: 'sources of every pack, the top pack’s last so they win' };
    if (/^assets\/[^/]+\/font\/.+\.json$/.test(path)) return { kind: 'concat', field: 'providers', topFirst: true, how: 'font providers of every pack, the top pack’s first' };
    return null;
  }
  switch (path) {
    case 'textures/terrain_texture.json':
    case 'textures/item_texture.json':
      return { kind: 'keyed', spec: { texture_data: '*' }, how: 'texture entries one by one, the top pack wins' };
    case FLIPBOOK:
      return { kind: 'flipbook', how: 'animations one by one, each from the pack its texture comes from' };
    case 'blocks.json':
      return { kind: 'keyed', spec: '*', how: 'blocks one by one, the top pack wins' };
    case 'biomes_client.json':
      return { kind: 'keyed', spec: { biomes: '*' }, how: 'biomes one by one, the top pack wins' };
    case 'sounds/sound_definitions.json':
      return { kind: 'sound-definitions', how: 'sounds one by one, the top pack wins' };
    case 'sounds.json':
      return {
        kind: 'keyed',
        spec: { block_sounds: '*', entity_sounds: { entities: '*' }, individual_event_sounds: { events: '*' }, interactive_sounds: { block_sounds: '*', entity_sounds: { entities: '*' } } },
        how: 'sound events one by one, the top pack wins',
      };
    case 'textures/texture_list.json':
    case 'textures/textures_list.json':
    case 'texts/languages.json':
    case 'texts/language_names.json':
      return { kind: 'union', how: 'entries of every pack' };
  }
  if (/^texts\/[^/]+\.lang$/.test(path)) return { kind: 'lines', how: KEYED_HOW };
  return null;
}

/**
 * Merges packs (highest priority first) into a new, unsaved texture project of their edition.
 * Throws when there are fewer than two packs or they are for different editions.
 */
export async function mergePacks(projects: TexturePackProject[], opts: MergeOptions = {}): Promise<MergeResult> {
  const { signal } = opts;
  const progress = (label: string, fraction: number | null) => {
    try {
      opts.onProgress?.({ label, fraction });
    } catch {
      /* a broken progress UI must not break the merge */
    }
  };
  check(signal);
  if (projects.length < MIN_PACKS) throw new Error('Add at least two packs to merge.');
  if (projects.length > MAX_PACKS) throw new Error(`Up to ${MAX_PACKS} packs can be merged at once.`);
  const { edition } = editionOf(projects);
  if (!edition) throw new Error('Java and Bedrock packs can’t be merged into one pack. Convert the packs to one edition first.');
  const version = edition === 'java' ? (opts.version?.trim() || defaultMergeVersion(projects)) : projects[0].version;

  const dropped: DroppedFile[] = [];
  const notes: string[] = [];
  progress('Reading packs…', 0);

  // ---- every pack's files, with Java textures renamed for the target version ----
  const layers: Layer[] = [];
  for (let i = 0; i < projects.length; i++) {
    check(signal);
    layers.push(edition === 'java' ? await javaLayer(projects[i], i, version, opts.renames ?? null, dropped) : bedrockLayer(projects[i], i, dropped));
    progress('Reading packs…', 0.3 * ((i + 1) / projects.length));
  }

  // ---- groups: a texture and its sidecar files count as one ----
  const imageStems = new Set<string>();
  if (edition === 'bedrock') for (const l of layers) for (const p of l.files.keys()) if (p.startsWith(BEDROCK_TEXTURE_ROOT) && IMAGE.test(p)) imageStems.add(stemOf(p));
  const groups = new Map<string, { rule: Rule | null; byPack: Map<number, { path: string; side: boolean }[]> }>();
  for (const l of layers) {
    for (const path of l.files.keys()) {
      const rule = ruleFor(path, edition);
      const { key, side } = rule ? { key: path, side: false } : groupKey(path, edition, imageStems);
      let g = groups.get(key);
      if (!g) groups.set(key, (g = { rule, byPack: new Map() }));
      const list = g.byPack.get(l.index) ?? [];
      list.push({ path, side });
      g.byPack.set(l.index, list);
    }
  }

  const project = newTextureProject({ name: opts.name?.trim() || DEFAULT_MERGED_NAME, edition, version, resolution: Math.max(16, ...projects.map((p) => p.resolution || 16)) });
  project.description = mergeDescription(projects.map((p) => p.name));
  const conflicts: MergeConflict[] = [];
  const merged: MergedFile[] = [];
  const imageWinner = new Map<string, number>();
  const put = (l: Layer, path: string) => {
    const blob = l.files.get(path)!;
    if (l.textures.has(path)) project.overrides[path] = blob;
    else project.extraFiles[path] = blob;
  };

  // Plain files and textures first: the flipbook merge needs to know where each texture came from.
  const plain = [...groups].filter(([, g]) => !g.rule).sort(([a], [b]) => a.localeCompare(b));
  for (const [key, g] of plain) {
    const order = [...g.byPack.keys()].sort((a, b) => a - b);
    const winner = order.find((i) => g.byPack.get(i)!.some((f) => !f.side)) ?? order[0];
    const files = g.byPack.get(winner)!;
    for (const f of files) put(layers[winner], f.path);
    layers[winner].summary.kept += files.length;
    if (key.startsWith('img:')) imageWinner.set(key.slice(4), winner);
    const losers = order.filter((i) => i !== winner);
    for (const i of losers) layers[i].summary.overridden += g.byPack.get(i)!.length;
    if (losers.length) conflicts.push({ path: (files.find((f) => !f.side) ?? files[0]).path, winner, losers });
  }
  progress('Merging files…', 0.5);

  // Mergeable JSON and language files
  const mergeable = [...groups].filter(([, g]) => !!g.rule).sort(([a], [b]) => a.localeCompare(b));
  for (const [path, g] of mergeable) {
    check(signal);
    const order = [...g.byPack.keys()].sort((a, b) => a - b);
    if (order.length === 1 && g.rule!.kind !== 'flipbook') {
      put(layers[order[0]], path);
      layers[order[0]].summary.kept++;
      continue;
    }
    const out = await mergeFile(path, g.rule!, order.map((i) => ({ index: i, blob: layers[i].files.get(path)! })), imageWinner, dropped);
    if (!out) {
      // Unreadable: the top pack's copy wins, as for any other file.
      put(layers[order[0]], path);
      layers[order[0]].summary.kept++;
      for (const i of order.slice(1)) layers[i].summary.overridden++;
      if (order.length > 1) conflicts.push({ path, winner: order[0], losers: order.slice(1) });
      notes.push(`${displayPath(path, edition)} couldn’t be read in every pack, so the copy from ${projects[order[0]].name || 'the top pack'} was used as it is.`);
      continue;
    }
    if (out.text === null) continue;
    project.extraFiles[path] = new Blob([out.text], { type: path.endsWith('.json') ? 'application/json' : 'text/plain' });
    if (out.packs.length > 1) {
      merged.push({ path, packs: out.packs, how: g.rule!.how });
      for (const i of out.packs) layers[i].summary.merged++;
    } else {
      for (const i of out.packs) layers[i].summary.kept++;
    }
    for (const i of order) if (!out.packs.includes(i)) layers[i].summary.overridden++;
  }
  progress('Writing pack info…', 0.85);

  // ---- pack info ----
  const metaFile = edition === 'java' ? await mergeJavaPackMeta(layers, project.description) : await mergeBedrockManifest(layers, projects);
  if (metaFile) project.extraFiles[edition === 'java' ? 'pack.mcmeta' : 'manifest.json'] = metaFile;
  const iconFrom = opts.iconFrom === undefined ? projects.findIndex((p) => !!p.icon) : opts.iconFrom;
  if (iconFrom !== null && iconFrom >= 0 && projects[iconFrom]?.icon) project.icon = projects[iconFrom].icon;
  if (edition === 'java') {
    const compat = compatRange(projects, version);
    if (compat) project.compat = compat;
  }

  // ---- notes ----
  const renamedPacks = edition === 'java' ? layers.filter((l) => compareJavaVersions(l.summary.version, version) !== 0) : [];
  if (renamedPacks.length) {
    const n = layers.reduce((s, l) => s + l.summary.renamed, 0);
    notes.push(`${joinNames(renamedPacks.map((l) => l.summary.name))} ${renamedPacks.length === 1 ? 'was' : 'were'} made for another version${n ? `: ${plural(n, 'texture')} got ${n === 1 ? 'its' : 'their'} Java ${version} name` : ''}.`);
  }
  const removed = layers.reduce((s, l) => s + l.summary.removed, 0);
  if (removed) notes.push(`${plural(removed, 'texture')} ${removed === 1 ? 'isn’t' : 'aren’t'} part of Java ${version} and ${removed === 1 ? 'was' : 'were'} left out.`);
  const resolutions = [...new Set(projects.map((p) => p.resolution || 16))].sort((a, b) => a - b);
  if (resolutions.length > 1) notes.push(`The packs use different resolutions (${joinNames(resolutions.map((r) => `${r}×`))}). Every texture keeps its own size, which Minecraft handles fine.`);
  const flipDrops = dropped.filter((d) => d.path === FLIPBOOK).length;
  if (flipDrops) notes.push(`${plural(flipDrops, 'animation entry', 'animation entries')} ${flipDrops === 1 ? 'was' : 'were'} left out because ${flipDrops === 1 ? 'its texture comes' : 'their textures come'} from another pack.`);

  const files = Object.keys(project.overrides).length + Object.keys(project.extraFiles).filter((p) => p !== 'pack.mcmeta' && p !== 'manifest.json').length;
  const textures = Object.keys(project.overrides).length;
  progress('Done', 1);
  return {
    project,
    report: { edition, version, packs: layers.map((l) => l.summary), conflicts, merged, dropped, notes, files, textures },
  };
}

// ---------------------------------------------------------------------------------------------
// Layers

function summaryOf(p: TexturePackProject): PackSummary {
  return { name: p.name || 'Untitled pack', edition: p.edition, version: p.version, files: 0, textures: 0, kept: 0, merged: 0, overridden: 0, renamed: 0, removed: 0 };
}

function entriesOf(p: TexturePackProject): { path: string; blob: Blob; texture: boolean }[] {
  const out: { path: string; blob: Blob; texture: boolean }[] = [];
  for (const [path, blob] of Object.entries(p.overrides ?? {})) if (blob) out.push({ path, blob, texture: true });
  for (const [path, blob] of Object.entries(p.extraFiles ?? {})) if (blob && !Object.prototype.hasOwnProperty.call(p.overrides ?? {}, path)) out.push({ path, blob, texture: false });
  return out;
}

async function javaLayer(p: TexturePackProject, index: number, target: string, renames: JavaRenames | null, dropped: DroppedFile[]): Promise<Layer> {
  const layer: Layer = { index, files: new Map(), textures: new Set(), summary: summaryOf(p) };
  const chain: RenameChain | null = compareJavaVersions(p.version, target) === 0 ? null : renameChain(renames, p.version, target);
  const items: { source: string; targets: string[]; blob: Blob; texture: boolean; renamed: boolean }[] = [];
  for (const e of entriesOf(p)) {
    if (e.path === 'pack.mcmeta') {
      layer.meta = e.blob;
      continue;
    }
    if (e.path === 'pack.png') continue;
    if (!chain || chain.direction === 'none') {
      items.push({ source: e.path, targets: [e.path], blob: e.blob, texture: e.texture, renamed: false });
      continue;
    }
    const meta = e.path.endsWith('.png.mcmeta');
    if (e.path.startsWith(JAVA_TEXTURE_ROOT) && (meta || /\.png$/i.test(e.path))) {
      const rel = e.path.slice(JAVA_TEXTURE_ROOT.length, -(meta ? '.png.mcmeta' : '.png').length);
      const r = chain.map(rel);
      if (r.kind === 'removed') {
        dropped.push({ path: e.path, pack: index, reason: `Not in Java ${target} (removed in ${r.version})` });
        if (!meta) layer.summary.removed++;
        continue;
      }
      items.push({ source: e.path, targets: r.paths.map((x) => `${JAVA_TEXTURE_ROOT}${x}${meta ? '.png.mcmeta' : '.png'}`), blob: e.blob, texture: e.texture, renamed: r.renamed });
      continue;
    }
    let blob = e.blob;
    if (/^assets\/[^/]+\/models\/.+\.json$/.test(e.path)) {
      const text = await blobText(e.blob).catch(() => null);
      const next = text === null ? null : rewriteModelTextures(text, (rel) => mapRef(chain, rel), parseJsonLoose, stringifyPretty);
      if (next !== null) blob = new Blob([next], { type: 'application/json' });
    }
    items.push({ source: e.path, targets: [e.path], blob, texture: e.texture, renamed: false });
  }
  // A file already at its target name wins over one renamed onto it.
  items.sort((a, b) => Number(a.renamed) - Number(b.renamed));
  for (const it of items) {
    const free = it.targets.filter((t) => !layer.files.has(t));
    if (!free.length) {
      dropped.push({ path: it.source, pack: index, reason: `Same file as ${it.targets[0].slice(it.targets[0].lastIndexOf('/') + 1)} after renaming` });
      continue;
    }
    for (const t of free) {
      layer.files.set(t, it.blob);
      if (it.texture) layer.textures.add(t);
    }
    if (it.renamed && it.texture) layer.summary.renamed++;
  }
  layer.summary.files = layer.files.size;
  layer.summary.textures = layer.textures.size;
  return layer;
}

function bedrockLayer(p: TexturePackProject, index: number, dropped: DroppedFile[]): Layer {
  const layer: Layer = { index, files: new Map(), textures: new Set(), summary: summaryOf(p) };
  for (const e of entriesOf(p)) {
    if (e.path === 'manifest.json') {
      layer.meta = e.blob;
      continue;
    }
    if (e.path === 'pack_icon.png') continue;
    if (e.path === 'contents.json') {
      dropped.push({ path: e.path, pack: index, reason: 'Lists the files of the original pack only' });
      continue;
    }
    layer.files.set(e.path, e.blob);
    if (e.texture) layer.textures.add(e.path);
  }
  layer.summary.files = layer.files.size;
  layer.summary.textures = layer.textures.size;
  return layer;
}

/** A texture and its sidecars (Java .png.mcmeta; Bedrock .png/.tga of one name and its UI .json) share a key. */
function groupKey(path: string, edition: Edition, imageStems: Set<string>): { key: string; side: boolean } {
  if (edition === 'java') {
    if (path.endsWith('.png.mcmeta')) return { key: path.slice(0, -'.mcmeta'.length), side: true };
    return { key: path, side: false };
  }
  if (path.startsWith(BEDROCK_TEXTURE_ROOT)) {
    if (IMAGE.test(path)) return { key: `img:${stemOf(path)}`, side: false };
    if (extOf(path) === 'json' && imageStems.has(stemOf(path))) return { key: `img:${stemOf(path)}`, side: true };
  }
  return { key: path, side: false };
}

function mapRef(chain: RenameChain, rel: string): string | null {
  const r = chain.map(rel);
  return r.kind === 'paths' && r.renamed ? r.paths[0] : null;
}

// ---------------------------------------------------------------------------------------------
// File merges

/**
 * Merged text of a file several packs have (top first). Returns the packs that contributed, or
 * null when a copy can't be read. `text` is null when nothing is left (all flipbook entries dropped).
 */
async function mergeFile(
  path: string,
  rule: Rule,
  copies: { index: number; blob: Blob }[],
  imageWinner: Map<string, number>,
  dropped: DroppedFile[],
): Promise<{ text: string | null; packs: number[] } | null> {
  const texts: string[] = [];
  for (const c of copies) {
    const t = await blobText(c.blob).catch(() => null);
    if (t === null) return null;
    texts.push(t);
  }
  const all = copies.map((c) => c.index);
  if (rule.kind === 'lines') {
    const r = mergeLangText(texts);
    return { text: r.text, packs: r.used.map((i) => all[i]) };
  }
  const values = texts.map((t) => parseJsonLoose(t));
  if (values.some((v) => v === null || typeof v !== 'object')) return null;
  switch (rule.kind) {
    case 'keyed': {
      if (!values.every(isObject)) return null;
      const r = mergeKeyed(values, rule.spec);
      return { text: stringifyPretty(r.value), packs: r.used.map((i) => all[i]) };
    }
    case 'sound-definitions': {
      if (!values.every(isObject)) return null;
      const modern = values.some((v) => isObject((v as Record<string, unknown>).sound_definitions));
      const wrapped = modern ? values.map((v) => (isObject((v as Record<string, unknown>).sound_definitions) ? v : { format_version: '1.14.0', sound_definitions: v })) : values;
      const r = mergeKeyed(wrapped, modern ? { sound_definitions: '*' } : '*');
      return { text: stringifyPretty(r.value), packs: r.used.map((i) => all[i]) };
    }
    case 'concat': {
      const r = mergeConcat(values, rule.field, rule.topFirst);
      return r && { text: stringifyPretty(r.value), packs: r.used.map((i) => all[i]) };
    }
    case 'union': {
      if (!values.every(Array.isArray)) return null;
      const r = unionArrays(values as unknown[][]);
      return { text: stringifyPretty(r.value), packs: r.used.map((i) => all[i]) };
    }
    case 'flipbook': {
      if (!values.every(Array.isArray)) return null;
      const r = mergeFlipbooks(
        values as unknown[][],
        all,
        (stem) => imageWinner.get(stem),
      );
      for (const d of r.dropped) dropped.push({ path, pack: d.pack, reason: `Animation of ${d.stem.replace(/^textures\//, '')}, whose texture comes from another pack` });
      return { text: r.value.length ? stringifyPretty(r.value) : null, packs: r.used.map((i) => all[i]) };
    }
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function setKey(o: Record<string, unknown>, k: string, v: unknown): void {
  Object.defineProperty(o, k, { value: v, enumerable: true, writable: true, configurable: true });
}

const has = (o: Record<string, unknown>, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/**
 * Objects (top first) merged key by key: a key's value comes from the top object that has it. Keys
 * named in `spec` are merged the same way one level down ('*' = whole entries from there on).
 * `used` lists the objects that gave at least one value.
 */
export function mergeKeyed(values: unknown[], spec: Spec): { value: unknown; used: number[] } {
  if (!values.length) return { value: undefined, used: [] };
  if (!values.every(isObject)) return { value: values[0], used: [0] };
  const objs = values as Record<string, unknown>[];
  const out: Record<string, unknown> = {};
  const used = new Set<number>();
  objs.forEach((o, i) => {
    for (const k of Object.keys(o)) {
      if (has(out, k)) continue;
      const sub = spec === '*' ? undefined : has(spec, k) ? spec[k] : undefined;
      if (sub === undefined) {
        setKey(out, k, o[k]);
        used.add(i);
        continue;
      }
      const holders = objs.map((x, j) => (has(x, k) ? j : -1)).filter((j) => j >= 0);
      const r = mergeKeyed(holders.map((j) => objs[j][k]), sub);
      setKey(out, k, r.value);
      for (const u of r.used) used.add(holders[u]);
    }
  });
  return { value: out, used: [...used].sort((a, b) => a - b) };
}

/** Lists in `field` of every object, top first or bottom first, without exact duplicates. */
export function mergeConcat(values: unknown[], field: string, topFirst: boolean): { value: unknown; used: number[] } | null {
  if (!values.every((v) => isObject(v) && Array.isArray(v[field]))) return null;
  const objs = values as Record<string, unknown>[];
  const order = objs.map((_, i) => i);
  if (!topFirst) order.reverse();
  const seen = new Set<string>();
  const list: unknown[] = [];
  const used = new Set<number>();
  for (const i of order) {
    for (const item of objs[i][field] as unknown[]) {
      const k = JSON.stringify(item);
      if (seen.has(k)) continue;
      seen.add(k);
      list.push(item);
      used.add(i);
    }
  }
  const out: Record<string, unknown> = {};
  // Other fields come from the top pack's copy.
  for (const [k, v] of Object.entries(objs[0])) setKey(out, k, k === field ? list : v);
  return { value: out, used: [...used].sort((a, b) => a - b) };
}

/** Arrays (top first) joined without exact duplicates. */
export function unionArrays(values: unknown[][]): { value: unknown[]; used: number[] } {
  const seen = new Set<string>();
  const out: unknown[] = [];
  const used = new Set<number>();
  values.forEach((arr, i) => {
    for (const item of arr) {
      const k = JSON.stringify(item);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(item);
      used.add(i);
    }
  });
  return { value: out, used: [...used].sort((a, b) => a - b) };
}

/**
 * Bedrock flipbook entries (top first). An animation describes the frames of one image, so an entry
 * is taken from the pack the texture itself comes from; when that pack has no entry, the game's own
 * applies. Entries for textures no pack replaces: the top pack wins.
 */
export function mergeFlipbooks(
  lists: unknown[][],
  packs: number[],
  winnerOf: (stem: string) => number | undefined,
): { value: unknown[]; used: number[]; dropped: { pack: number; stem: string }[] } {
  const keyOf = (e: unknown) => (isObject(e) && typeof e.flipbook_texture === 'string' ? e.flipbook_texture : null);
  const byList = lists.map((l) => {
    const m = new Map<string, unknown>();
    for (const e of l) {
      const k = keyOf(e);
      if (k !== null && !m.has(k)) m.set(k, e);
    }
    return m;
  });
  const out: unknown[] = [];
  const seen = new Set<string>();
  const used = new Set<number>();
  const dropped: { pack: number; stem: string }[] = [];
  lists.forEach((l, i) => {
    for (const e of l) {
      const k = keyOf(e);
      if (k === null || seen.has(k)) continue;
      seen.add(k);
      const w = winnerOf(k);
      const from = w === undefined ? i : packs.indexOf(w);
      if (w !== undefined && (from < 0 || !byList[from].has(k))) {
        // The texture's pack has no animation for it (or no flipbook file at all).
        byList.forEach((m, j) => {
          if (m.has(k)) dropped.push({ pack: packs[j], stem: k });
        });
        continue;
      }
      out.push(byList[from].get(k));
      used.add(from);
    }
  });
  return { value: out, used: [...used].sort((a, b) => a - b), dropped };
}

/** .lang files (top first): the top file as it is, plus the keys only lower files have. */
export function mergeLangText(texts: string[]): { text: string; used: number[] } {
  const keyOf = (line: string) => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return null;
    const eq = line.indexOf('=');
    return eq > 0 ? line.slice(0, eq).trim() : null;
  };
  const lines = texts[0].replace(/\r\n?/g, '\n').split('\n');
  const keys = new Set(lines.map(keyOf).filter((k): k is string => k !== null));
  const used = [0];
  for (let i = 1; i < texts.length; i++) {
    const add: string[] = [];
    for (const line of texts[i].replace(/\r\n?/g, '\n').split('\n')) {
      const k = keyOf(line);
      if (k === null || keys.has(k)) continue;
      keys.add(k);
      add.push(line);
    }
    if (!add.length) continue;
    while (lines.length && lines[lines.length - 1] === '') lines.pop();
    lines.push(...add);
    used.push(i);
  }
  let text = lines.join('\n');
  if (used.length > 1 && !text.endsWith('\n')) text += '\n';
  return { text, used };
}

// ---------------------------------------------------------------------------------------------
// Pack info

/**
 * Java: the language, filter and overlay sections of every pack.mcmeta (the exporter writes the
 * pack section itself). Null when no pack has any.
 */
async function mergeJavaPackMeta(layers: Layer[], description: string): Promise<Blob | null> {
  const metas: Record<string, unknown>[] = [];
  for (const l of layers) {
    const v = l.meta ? parseJsonLoose(await blobText(l.meta).catch(() => '')) : null;
    if (isObject(v)) metas.push(v);
  }
  const out: Record<string, unknown> = { pack: { description } };
  let any = false;
  const languages = metas.map((m) => m.language).filter(isObject);
  if (languages.length) {
    out.language = mergeKeyed(languages, '*').value;
    any = true;
  }
  const blocks = metas.map((m) => (isObject(m.filter) && Array.isArray(m.filter.block) ? (m.filter.block as unknown[]) : null)).filter((b): b is unknown[] => !!b);
  if (blocks.length) {
    out.filter = { block: unionArrays(blocks).value };
    any = true;
  }
  const entries: unknown[] = [];
  const dirs = new Set<string>();
  for (const m of metas) {
    const list = isObject(m.overlays) && Array.isArray(m.overlays.entries) ? (m.overlays.entries as unknown[]) : [];
    for (const e of list) {
      const dir = isObject(e) && typeof e.directory === 'string' ? e.directory : null;
      if (!dir || dirs.has(dir)) continue;
      dirs.add(dir);
      entries.push(e);
    }
  }
  if (entries.length) {
    out.overlays = { entries };
    any = true;
  }
  return any ? new Blob([stringifyPretty(out)], { type: 'application/json' }) : null;
}

/**
 * Bedrock: what the exporter keeps from a manifest.json (sub-packs, dependencies, authors,
 * capabilities and the newest min_engine_version), combined from every pack. The merged pack gets
 * fresh uuids of its own.
 */
async function mergeBedrockManifest(layers: Layer[], projects: TexturePackProject[]): Promise<Blob | null> {
  const ms: Record<string, unknown>[] = [];
  for (const l of layers) {
    const v = l.meta ? parseJsonLoose(await blobText(l.meta).catch(() => '')) : null;
    if (isObject(v)) ms.push(v);
  }
  if (!ms.length) return null;
  const ownIds = new Set(projects.map((p) => p.bedrockUuids?.header?.toLowerCase()).filter(Boolean));
  const subpacks: unknown[] = [];
  const folders = new Set<string>();
  const deps: unknown[] = [];
  const depIds = new Set<string>();
  const authors: string[] = [];
  const caps: string[] = [];
  let engine: [number, number, number] | null = null;
  for (const m of ms) {
    for (const s of Array.isArray(m.subpacks) ? m.subpacks : []) {
      const f = isObject(s) && typeof s.folder_name === 'string' ? s.folder_name : null;
      if (f && !folders.has(f)) {
        folders.add(f);
        subpacks.push(s);
      }
    }
    for (const d of Array.isArray(m.dependencies) ? m.dependencies : []) {
      const id = isObject(d) && typeof d.uuid === 'string' ? d.uuid.toLowerCase() : null;
      if (id && !depIds.has(id) && !ownIds.has(id)) {
        depIds.add(id);
        deps.push(d);
      }
    }
    const a = isObject(m.metadata) && Array.isArray(m.metadata.authors) ? m.metadata.authors : [];
    for (const x of a) if (typeof x === 'string' && x.trim() && !authors.includes(x)) authors.push(x);
    for (const c of Array.isArray(m.capabilities) ? m.capabilities : []) if (typeof c === 'string' && c.trim() && !caps.includes(c)) caps.push(c);
    const e = isObject(m.header) ? parseBedrockVersion(m.header.min_engine_version) : null;
    if (e && (!engine || (e[0] - engine[0] || e[1] - engine[1] || e[2] - engine[2]) > 0)) engine = e;
  }
  const out: Record<string, unknown> = { format_version: 2, header: engine ? { min_engine_version: engine } : {}, modules: [] };
  if (authors.length) out.metadata = { authors };
  if (caps.length) out.capabilities = caps;
  if (subpacks.length) out.subpacks = subpacks;
  if (deps.length) out.dependencies = deps;
  return new Blob([stringifyPretty(out)], { type: 'application/json' });
}

/**
 * Java compatibility range of the merged pack: the versions every pack supports. A pack renamed
 * for the target version counts as made for that version only. Undefined for a single version.
 */
export function compatRange(projects: Pick<TexturePackProject, 'version' | 'compat'>[], target: string): { minVersion: string; maxVersion: string } | undefined {
  let lo = target;
  let hi = target;
  let first = true;
  for (const p of projects) {
    let min = p.compat?.minVersion ?? p.version;
    let max = p.compat?.maxVersion ?? p.version;
    if (compareJavaVersions(min, max) > 0) [min, max] = [max, min];
    if (compareJavaVersions(min, target) > 0 || compareJavaVersions(max, target) < 0) [min, max] = [target, target];
    if (first) {
      [lo, hi, first] = [min, max, false];
      continue;
    }
    if (compareJavaVersions(min, lo) > 0) lo = min;
    if (compareJavaVersions(max, hi) < 0) hi = max;
  }
  return compareJavaVersions(lo, hi) < 0 ? { minVersion: lo, maxVersion: hi } : undefined;
}

// ---------------------------------------------------------------------------------------------
// Helpers

function stemOf(path: string): string {
  const dot = path.lastIndexOf('.');
  return dot > path.lastIndexOf('/') ? path.slice(0, dot) : path;
}

const utf8 = new TextDecoder('utf-8');
async function blobText(b: Blob): Promise<string> {
  const t = utf8.decode(new Uint8Array(await b.arrayBuffer()));
  return t.charCodeAt(0) === 0xfeff ? t.slice(1) : t;
}

function plural(n: number, word: string, many = `${word}s`): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? word : many}`;
}

function check(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}
