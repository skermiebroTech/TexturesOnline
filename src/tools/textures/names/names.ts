// Name-based item textures (an item renamed in an anvil looks different): the files each Java
// version reads, written from project.nameVariants, and an opened pack's own files read back. Pure.
//
// - 1.21.5+ (vanilla): the item definition, assets/minecraft/items/<item>.json, wraps the item's model
//   in a "minecraft:select" on the "minecraft:component" property with "component":
//   "minecraft:custom_name" (that property is new in 1.21.5: 1.21.4 has item definitions but can't
//   read components). The game looks the item's name component up among the cases: a "when" string
//   is a plain text name, the anvil stores the typed name as plain text, so it matches exactly,
//   capital letters included. Names with colours or formatting (from commands) don't match.
// - Before 1.21.5: OptiFine's Custom Item Textures (CIT, also read by the CIT Resewn mod), one
//   optifine/cit/names/<item>/<slug>.properties per look: type=item, items=<item>, texture=<path from
//   assets/minecraft> (model= for a 3D model) and the name rule, nbt.display.Name (1.20.5+:
//   components.custom_name; both mods read either) with the plain name, or regex:(A|B) for several.
//   .properties files are ISO-8859-1 with \uXXXX escapes, and backslashes are doubled.

import type { NameVariant } from '../../../core/types';
import { bundledPackFormat, comparePackFormats } from '../../../editions/java/packformats';
import { itemDefinitionPath, modelId, splitId } from '../../../shared/models/java-models';

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** The anvil's longest name. */
export const NAME_MAX = 50;
/** Folder of the files this feature writes (textures, models, CIT properties) */
export const NAMES_DIR = 'names';
export const CIT_DIR = 'assets/minecraft/optifine/cit/';

export interface NameRules {
  /** Item definitions can pick a model by the item's name (1.21.5+) */
  select: boolean;
  /** Items have components: CIT names it components.custom_name (1.20.5+) */
  components: boolean;
  /** Item models are JSON files (1.8+): the only versions the editor offers this for */
  models: boolean;
}

export function nameRules(version: string): NameRules {
  const f = bundledPackFormat(version.trim());
  const atLeast = (id: string) => !f || comparePackFormats(f, bundledPackFormat(id)!) >= 0;
  const legacy = /^1\.(\d+)(\.\d+)?$/.exec(version.trim());
  return { select: atLeast('1.21.5'), components: atLeast('1.20.5'), models: (legacy ? Number(legacy[1]) : 99) >= 8 };
}

/**
 * A name as the anvil keeps it: no colour codes (§) or control characters, at most 50 characters.
 * Spaces around it are dropped (they are easy to type by accident and hard to see).
 */
export function cleanName(name: string): string {
  return name
    .replace(/[\u0000-\u001f\u007f§]/g, '')
    .trim()
    .slice(0, NAME_MAX)
    .trim();
}

/** A file name for a look: from its first name, lower case a-z 0-9 _, unique among `taken`. */
export function slugFor(name: string, taken: Iterable<string> = []): string {
  const used = new Set(taken);
  const base =
    name
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 32)
      .replace(/_+$/, '') || 'name';
  let slug = base;
  for (let i = 2; used.has(slug); i++) slug = `${base}_${i}`;
  return slug;
}

export const variantId = (item: string, slug: string): string => `${item}/${slug}`;
export const slugOf = (id: string): string => id.slice(id.lastIndexOf('/') + 1);
/** Where a new look's texture goes: under textures/item/ in every version (the 1.19.3+ atlases take it from there) */
export const variantTexturePath = (item: string, slug: string): string => `assets/minecraft/textures/item/${NAMES_DIR}/${item}/${slug}.png`;
export const variantModelId = (item: string, slug: string): string => `minecraft:item/${NAMES_DIR}/${item}/${slug}`;
export const citPropertiesPath = (id: string): string => `${CIT_DIR}${NAMES_DIR}/${id}.properties`;

/** 'assets/minecraft/textures/item/x.png' -> 'minecraft:item/x' (null outside a textures folder). */
export function textureRef(path: string): string | null {
  const m = /^assets\/([^/]+)\/textures\/(.+)\.png$/.exec(path);
  return m ? `${m[1]}:${m[2]}` : null;
}

/** The flat model of a look: the item's own model with the look's texture as its picture. */
export function flatModel(parent: string, texture: string): Record<string, unknown> {
  return { parent: modelId(parent), textures: { layer0: textureRef(texture) ?? texture } };
}

// ---------------------------------------------------------------------------------------------
// Item definitions (1.21.5+)

export interface NameCase {
  names: string[];
  model: unknown;
}

const NAME_PROPERTY = 'component';
const CUSTOM_NAME = 'custom_name';
const short = (v: unknown) => (typeof v === 'string' ? v.replace(/^minecraft:/, '') : '');

/** A "select" on the item's name. */
export function isNameSelect(node: unknown): node is Record<string, unknown> {
  return isObj(node) && short(node.type) === 'select' && short(node.property) === NAME_PROPERTY && short(node.component) === CUSTOM_NAME;
}

/** Plain text of a case value: a string, or a text component that is only text (null otherwise). */
function plainName(v: unknown): string | null {
  if (typeof v === 'string') return v;
  if (isObj(v) && typeof v.text === 'string' && Object.keys(v).every((k) => k === 'text' || k === 'type')) return v.text;
  return null;
}

/** The first plain model of a definition node (its tints are copied onto the looks). */
function firstModelLeaf(node: unknown): Record<string, unknown> | null {
  if (!isObj(node)) return null;
  const type = short(node.type);
  if (type === 'model') return node;
  const kids: unknown[] =
    type === 'condition' ? [node.on_false, node.on_true] : type === 'select' ? [node.fallback, ...(Array.isArray(node.cases) ? node.cases.map((c) => (isObj(c) ? c.model : null)) : [])] : type === 'range_dispatch' ? [node.fallback, ...(Array.isArray(node.entries) ? node.entries.map((e) => (isObj(e) ? e.model : null)) : [])] : type === 'composite' && Array.isArray(node.models) ? node.models : [];
  for (const k of kids) {
    const leaf = firstModelLeaf(k);
    if (leaf) return leaf;
  }
  return null;
}

/** A case's "when": one name as a string, several as a list. */
const whenOf = (names: string[]): string | string[] => (names.length === 1 ? names[0] : [...names]);

/** A look's model leaf, with the tints the item's own model has (dyed leather, potions...). */
export function caseModel(model: string, base: unknown): Record<string, unknown> {
  const leaf = firstModelLeaf(base);
  const tints = leaf && Array.isArray(leaf.tints) ? { tints: structuredClone(leaf.tints) } : {};
  return { type: 'minecraft:model', model: modelId(model), ...tints };
}

/**
 * The item definition with the looks picked by name in front of whatever it shows now (the game's
 * definition, or the pack's: a model made in the model editor, PvP display changes). A definition that
 * already picks by name keeps its own cases after these (a name both have goes to these).
 */
export function withNameCases(def: unknown, itemId: string, cases: NameCase[]): Record<string, unknown> {
  const rest: Record<string, unknown> = isObj(def) ? { ...def } : {};
  const root = rest.model ?? { type: 'minecraft:model', model: `minecraft:item/${itemId}` };
  delete rest.model;
  const ours = cases.filter((c) => c.names.length).map((c) => ({ when: whenOf(c.names), model: c.model }));
  const taken = new Set(cases.flatMap((c) => c.names));
  let model: Record<string, unknown>;
  if (isNameSelect(root)) {
    const theirs = (Array.isArray(root.cases) ? root.cases : []).flatMap((c) => {
      if (!isObj(c)) return [];
      const when = Array.isArray(c.when) ? c.when : [c.when];
      const left = when.filter((w) => {
        const n = plainName(w);
        return n === null || !taken.has(n);
      });
      return left.length ? [{ ...c, when: left.length === 1 ? left[0] : left }] : [];
    });
    model = { ...root, cases: [...ours, ...theirs] };
  } else {
    model = { type: 'minecraft:select', property: `minecraft:${NAME_PROPERTY}`, component: `minecraft:${CUSTOM_NAME}`, cases: ours, fallback: root };
  }
  return { model, ...rest };
}

export interface ReadNameSelect {
  /** Cases with plain names */
  cases: { names: string[]; model: unknown }[];
  /** Cases this can't show (formatted names...), kept in the definition */
  kept: unknown[];
  fallback: unknown;
}

/** An opened pack's item definition that picks by name (only at its top). */
export function readNameSelect(def: unknown): ReadNameSelect | null {
  if (!isObj(def) || !isNameSelect(def.model)) return null;
  const root = def.model;
  const out: ReadNameSelect = { cases: [], kept: [], fallback: root.fallback };
  for (const c of Array.isArray(root.cases) ? root.cases : []) {
    if (!isObj(c)) continue;
    const when = Array.isArray(c.when) ? c.when : [c.when];
    const names = when.map(plainName);
    if (names.length && names.every((n): n is string => n !== null && n.length > 0)) out.cases.push({ names: [...new Set(names)], model: c.model });
    else out.kept.push(c);
  }
  return out;
}

/** The definition without its name select (or with only the cases it keeps); null when nothing changes. */
export function withoutNameCases(def: unknown, kept: unknown[]): Record<string, unknown> | null {
  if (!isObj(def) || !isNameSelect(def.model)) return null;
  const root = def.model;
  const rest = { ...def };
  delete rest.model;
  const fallback = root.fallback ?? { type: 'minecraft:empty' };
  return { model: kept.length ? { ...root, cases: kept } : fallback, ...rest };
}

// ---------------------------------------------------------------------------------------------
// .properties files (OptiFine)

/** A .properties value: \ doubled, a leading space escaped, everything past ASCII as \uXXXX. */
export function escapeProperty(value: string, key = false): string {
  let out = '';
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    const code = value.charCodeAt(i);
    if (c === '\\') out += '\\\\';
    else if (c === ' ' && (i === 0 || key)) out += '\\ ';
    else if (key && (c === ':' || c === '=' || c === '#' || c === '!')) out += `\\${c}`;
    else if (code < 0x20 || code > 0x7e) out += `\\u${code.toString(16).padStart(4, '0')}`;
    else out += c;
  }
  return out;
}

/** Keys and values of a .properties file as Java reads them (ISO-8859-1 bytes decoded by the caller). */
export function parseProperties(text: string): Map<string, string> {
  const out = new Map<string, string>();
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].replace(/^[ \t\f]+/, '');
    if (!line || line[0] === '#' || line[0] === '!') continue;
    // a line ending in an odd number of backslashes goes on
    while (/(^|[^\\])(\\\\)*\\$/.test(line) && i + 1 < lines.length) line = line.slice(0, -1) + lines[++i].replace(/^[ \t\f]+/, '');
    let k = 0;
    let key = '';
    while (k < line.length) {
      const c = line[k];
      if (c === '\\' && k + 1 < line.length) {
        key += line.slice(k, k + 2);
        k += 2;
        continue;
      }
      if (c === '=' || c === ':' || c === ' ' || c === '\t' || c === '\f') break;
      key += c;
      k++;
    }
    let rest = line.slice(k).replace(/^[ \t\f]+/, '');
    if (rest[0] === '=' || rest[0] === ':') rest = rest.slice(1).replace(/^[ \t\f]+/, '');
    out.set(unescapeProperty(key), unescapeProperty(rest));
  }
  return out;
}

function unescapeProperty(s: string): string {
  return s.replace(/\\(u[0-9a-fA-F]{4}|.)/g, (_m, e: string) => {
    if (e.length === 5) return String.fromCharCode(parseInt(e.slice(1), 16));
    return e === 't' ? '\t' : e === 'n' ? '\n' : e === 'r' ? '\r' : e === 'f' ? '\f' : e;
  });
}

/** .properties bytes are ISO-8859-1 (what OptiFine reads); the \u escapes carry the rest. */
export function decodeLatin1(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return s;
}

// ---------------------------------------------------------------------------------------------
// OptiFine CIT

/** Value prefixes OptiFine reads as something other than plain text (and "!" = not). */
const PREFIXED = /^(!|pattern:|ipattern:|regex:|iregex:|range:|exists:|raw:)/;
const REGEX_SPECIAL = /[\\^$.|?*+()[\]{}]/g;

/** The name rule's value: the plain name, or regex:(A|B) for several (or for a name that looks like a rule). */
export function citNameValue(names: string[]): string {
  if (names.length === 1 && !PREFIXED.test(names[0])) return names[0];
  return `regex:(${names.map((n) => n.replace(REGEX_SPECIAL, '\\$&')).join('|')})`;
}

/** Names from a name rule's value, or null when it is a pattern plain names can't say. */
export function namesFromCitValue(value: string): string[] | null {
  if (!PREFIXED.test(value)) return value ? [value] : null;
  const m = /^regex:\((.*)\)$/s.exec(value) ?? /^regex:(.*)$/s.exec(value);
  if (!m) return null;
  const names: string[] = [];
  let cur = '';
  const body = m[1];
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '\\' && i + 1 < body.length) {
      const n = body[++i];
      if (!/[\\^$.|?*+()[\]{}]/.test(n)) return null;
      cur += n;
    } else if (c === '|') {
      names.push(cur);
      cur = '';
    } else if (/[\^$.|?*+()[\]{}]/.test(c)) return null;
    else cur += c;
  }
  names.push(cur);
  return names.every(Boolean) ? [...new Set(names)] : null;
}

/** Name rule keys OptiFine and CIT Resewn read (the legacy NBT one and the 1.20.5+ component). */
const NAME_KEYS = ['nbt.display.Name', 'components.custom_name', 'components.minecraft:custom_name', 'components.~custom_name', 'component.custom_name', 'component.minecraft:custom_name'];
/** Keys a look made here can keep without changing what it does */
const KNOWN_KEYS = new Set(['type', 'items', 'matchItems', 'texture', 'model', 'weight', ...NAME_KEYS]);

export interface CitRule {
  items: string[];
  /** Plain names (null when the rule is a pattern) */
  names: string[] | null;
  /** The name rule's value as written */
  match: string;
  texture?: string;
  model?: string;
  /** Other keys: what this rule does besides names (damage, enchantments, texture.<name>...) */
  other: string[];
}

/** A CIT rule that picks items by name, or null (another type, no name rule). */
export function readCitRule(text: string): CitRule | null {
  const p = parseProperties(text);
  const type = p.get('type') ?? 'item';
  if (type !== 'item') return null;
  const key = NAME_KEYS.find((k) => p.has(k));
  if (!key) return null;
  const match = p.get(key)!;
  const items = (p.get('items') ?? p.get('matchItems') ?? '')
    .split(/\s+/)
    .map((s) => s.replace(/^minecraft:/, ''))
    .filter(Boolean);
  return {
    items,
    names: namesFromCitValue(match),
    match,
    texture: p.get('texture'),
    model: p.get('model'),
    other: [...p.keys()].filter((k) => !KNOWN_KEYS.has(k)),
  };
}

/** texture= / model= of a pack path: relative to assets/minecraft (other namespaces as ns:path). */
export function citPathValue(path: string): string {
  const m = /^assets\/([^/]+)\/(.+)$/.exec(path);
  if (!m) return path;
  return m[1] === 'minecraft' ? m[2] : `${m[1]}:${m[2]}`;
}

/** model= of a model id: relative to models/ ('minecraft:item/x' -> 'item/x'). */
export function citModelValue(model: string): string {
  const [ns, path] = splitId(modelId(model));
  return ns === 'minecraft' ? path : `${ns}:${path}`;
}

export interface CitWriteOptions {
  /** components.custom_name (1.20.5+) instead of nbt.display.Name */
  components: boolean;
  /** The look has a model of its own (3D): model= instead of texture= */
  model: boolean;
}

/** The .properties file of a look. */
export function citProperties(v: NameVariant, opts: CitWriteOptions): string {
  const lines = [
    `# ${escapeProperty(v.match ?? v.names.join(', '))}: needs OptiFine or the CIT Resewn mod`,
    'type=item',
    `items=${escapeProperty(v.item)}`,
    opts.model ? `model=${escapeProperty(citModelValue(v.model))}` : `texture=${escapeProperty(citPathValue(v.texture))}`,
    `${opts.components ? 'components.custom_name' : 'nbt.display.Name'}=${escapeProperty(v.match ?? citNameValue(v.names))}`,
  ];
  return `${lines.join('\n')}\n`;
}

/**
 * The pack file a CIT texture= / model= value names, the way OptiFine and CIT Resewn look for it: no
 * value = the properties file's own name; './x' = next to it; '~/x' = in optifine/; a path with a
 * folder = from assets/minecraft (models also from models/, textures from textures/); a bare name =
 * next to it. `exists` tells which pack files there are.
 */
export function resolveCitAsset(propsPath: string, value: string | undefined, ext: '.png' | '.json', exists: (path: string) => boolean): string | null {
  const dir = propsPath.slice(0, propsPath.lastIndexOf('/') + 1);
  const withExt = (p: string) => (p.endsWith(ext) ? p : `${p}${ext}`);
  const tries: string[] = [];
  if (value === undefined || value === '') tries.push(withExt(propsPath.replace(/\.properties$/, '')));
  else {
    const v = value.replace(/\\/g, '/');
    if (v.startsWith('./')) tries.push(withExt(dir + v.slice(2)));
    else if (v.startsWith('~/')) tries.push(withExt(`assets/minecraft/optifine/${v.slice(2)}`));
    else {
      const [ns, path] = v.includes(':') ? splitId(v) : ['minecraft', v];
      if (path.startsWith('assets/')) tries.push(withExt(path));
      tries.push(withExt(`assets/${ns}/${path}`), withExt(`assets/${ns}/${ext === '.json' ? 'models' : 'textures'}/${path}`), withExt(dir + path));
    }
  }
  return tries.find(exists) ?? null;
}

/** Model id of a pack path under models/ ('assets/minecraft/models/item/x.json' -> 'minecraft:item/x'). */
export function modelIdOfPath(path: string): string | null {
  const m = /^assets\/([^/]+)\/models\/(.+)\.json$/.exec(path);
  return m ? `${m[1]}:${m[2]}` : null;
}

/** Item definition path of an item id (re-exported for the pack code). */
export const definitionPath = (item: string): string => itemDefinitionPath(item);
