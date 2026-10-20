// Sound events of a game version, read from Java's sounds.json or Bedrock's sound_definitions.json
// (or, when neither is available, from the plain list of sound files). Pure functions: no network,
// no DOM, so they run in unit tests.

import type { Edition } from '../../../core/types';

export type SoundCategory = 'ambient' | 'block' | 'entity' | 'item' | 'music' | 'records' | 'ui' | 'weather' | 'other';

export const SOUND_CATEGORY_ORDER: SoundCategory[] = ['ambient', 'block', 'entity', 'item', 'music', 'records', 'ui', 'weather', 'other'];

// (Category names shown in the editor: ui/i18n/sounds.ts, categories.)

export const JAVA_SOUND_ROOT = 'assets/minecraft/sounds/';
export const BEDROCK_SOUND_ROOT = 'sounds/';
export const BEDROCK_DEFINITIONS = 'sounds/sound_definitions.json';
/** File types Bedrock plays from a pack, in the order it looks for them */
export const BEDROCK_SOUND_EXTS = ['ogg', 'wav', 'fsb'] as const;

/** One file an event can play (the game picks one of an event's variants at random, by weight). */
export interface SoundVariant {
  /** Name as the game writes it: 'block/stone/break1' (Java) or 'sounds/dig/stone1' (Bedrock) */
  name: string;
  /** Path of the file in a pack, without the extension: 'assets/minecraft/sounds/block/stone/break1' */
  stem: string;
  /** Path the editor writes: stem + '.ogg' */
  path: string;
  volume?: number;
  pitch?: number;
  weight?: number;
  /** Streamed from disk (music, records) */
  stream?: boolean;
}

export interface SoundEvent {
  /** 'block.stone.break' */
  id: string;
  /** 'Stone Break' */
  name: string;
  category: SoundCategory;
  variants: SoundVariant[];
  /** Java: other events this one plays (entries with "type": "event") */
  refs?: string[];
  /** Lower-case words for searching */
  words: string;
}

export interface SoundCatalog {
  edition: Edition;
  version: string;
  /** Where the event list came from */
  source: 'sounds.json' | 'files' | 'definitions';
  events: SoundEvent[];
  byId: Map<string, SoundEvent>;
  /** file stem -> ids of the events that play it */
  users: Map<string, string[]>;
  /** Bedrock: the game's definitions (for writing entries next to edited files) */
  definitions?: Record<string, unknown>;
  formatVersion?: string;
}

// ---------------------------------------------------------------------------------------------
// Names and categories

const DROP_PREFIX = new Set(['block', 'entity', 'item', 'ambient', 'mob', 'ui', 'music', 'music_disc', 'record', 'weather']);

/** 'block.stone.break' -> 'Stone Break', 'music_disc.13' -> '13' */
export function soundEventName(id: string): string {
  const parts = id.split(/[.:]/).filter(Boolean);
  if (parts.length > 1 && DROP_PREFIX.has(parts[0])) parts.shift();
  return parts
    .join(' ')
    .replace(/[_/-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const JAVA_PREFIX: Record<string, SoundCategory> = {
  ambient: 'ambient',
  block: 'block',
  entity: 'entity',
  item: 'item',
  music: 'music',
  music_disc: 'records',
  ui: 'ui',
  weather: 'weather',
};

const BEDROCK_PREFIX: Record<string, SoundCategory> = {
  ambient: 'ambient',
  block: 'block',
  dig: 'block',
  step: 'block',
  hit: 'block',
  fall: 'block',
  land: 'block',
  place: 'block',
  use: 'block',
  jump: 'block',
  tile: 'block',
  break: 'block',
  fire: 'block',
  liquid: 'block',
  bucket: 'item',
  item: 'item',
  armor: 'item',
  bottle: 'item',
  crossbow: 'item',
  trident: 'item',
  mob: 'entity',
  entity: 'entity',
  music: 'music',
  record: 'records',
  ui: 'ui',
  weather: 'weather',
};

const BEDROCK_DEF_CATEGORY: Record<string, SoundCategory> = {
  ambient: 'ambient',
  weather: 'weather',
  block: 'block',
  hostile: 'entity',
  neutral: 'entity',
  player: 'entity',
  record: 'records',
  music: 'music',
  ui: 'ui',
  bottle: 'item',
};

export function soundCategory(edition: Edition, id: string, defCategory?: string): SoundCategory {
  const first = id.split('.')[0];
  if (edition === 'java') return JAVA_PREFIX[first] ?? 'other';
  return BEDROCK_PREFIX[first] ?? (defCategory ? BEDROCK_DEF_CATEGORY[defCategory] : undefined) ?? 'other';
}

// ---------------------------------------------------------------------------------------------
// Paths

/** Java: 'minecraft:block/stone/break1' -> 'assets/minecraft/sounds/block/stone/break1' */
export function javaSoundStem(name: string): string {
  const colon = name.indexOf(':');
  const ns = colon > 0 ? name.slice(0, colon) : 'minecraft';
  const rel = colon > 0 ? name.slice(colon + 1) : name;
  return `assets/${ns}/sounds/${rel.replace(/^\/+/, '')}`;
}

/** Bedrock names are pack paths already ('sounds/dig/stone1'); strip a stray extension. */
export function bedrockSoundStem(name: string): string {
  return name.replace(/^\/+/, '').replace(/\.(ogg|wav|fsb)$/i, '');
}

/** Pack path of a sound file without its extension, or null when it isn't an audio file of the edition's sound folders. */
export function soundStemOfPath(edition: Edition, path: string): string | null {
  if (edition === 'java') {
    const m = /^(assets\/[^/]+\/sounds\/.+)\.ogg$/i.exec(path);
    return m ? m[1] : null;
  }
  const m = /^(sounds\/.+)\.(ogg|wav|fsb)$/i.exec(path);
  return m ? m[1] : null;
}

function variant(edition: Edition, name: string, props: Record<string, unknown> = {}): SoundVariant {
  const stem = edition === 'java' ? javaSoundStem(name) : bedrockSoundStem(name);
  const v: SoundVariant = { name, stem, path: `${stem}.ogg` };
  const num = (k: string) => (typeof props[k] === 'number' && Number.isFinite(props[k]) ? (props[k] as number) : undefined);
  const volume = num('volume');
  const pitch = num('pitch');
  const weight = num('weight');
  if (volume !== undefined) v.volume = volume;
  if (pitch !== undefined) v.pitch = pitch;
  if (weight !== undefined) v.weight = weight;
  if (props.stream === true) v.stream = true;
  return v;
}

function words(id: string, name: string, variants: SoundVariant[]): string {
  return `${id} ${name} ${variants.map((v) => v.name).join(' ')}`.toLowerCase().replace(/[._/:-]+/g, ' ');
}

function finish(edition: Edition, version: string, source: SoundCatalog['source'], events: SoundEvent[]): SoundCatalog {
  events.sort((a, b) => SOUND_CATEGORY_ORDER.indexOf(a.category) - SOUND_CATEGORY_ORDER.indexOf(b.category) || a.id.localeCompare(b.id));
  const byId = new Map(events.map((e) => [e.id, e]));
  const users = new Map<string, string[]>();
  for (const e of events) {
    for (const v of e.variants) {
      const list = users.get(v.stem);
      if (!list) users.set(v.stem, [e.id]);
      else if (!list.includes(e.id)) list.push(e.id);
    }
  }
  return { edition, version, source, events, byId, users };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

// ---------------------------------------------------------------------------------------------
// Java

/**
 * Events from Java's sounds.json. Entries of "type": "event" point at another event: its files are
 * listed too (one level deep), so every event shows what it really plays.
 */
export function parseJavaSoundsJson(json: unknown, version: string): SoundCatalog {
  if (!isObj(json)) throw new Error('sounds.json is not an object');
  const own = new Map<string, { variants: SoundVariant[]; refs: string[] }>();
  for (const [id, def] of Object.entries(json)) {
    if (!isObj(def)) continue;
    const variants: SoundVariant[] = [];
    const refs: string[] = [];
    for (const s of Array.isArray(def.sounds) ? def.sounds : []) {
      if (typeof s === 'string') variants.push(variant('java', s));
      else if (isObj(s) && typeof s.name === 'string') {
        if (s.type === 'event') refs.push(s.name.replace(/^minecraft:/, ''));
        else variants.push(variant('java', s.name, s));
      }
    }
    own.set(id, { variants, refs });
  }
  const events: SoundEvent[] = [];
  for (const [id, { variants, refs }] of own) {
    const all = [...variants];
    for (const r of refs) for (const v of own.get(r)?.variants ?? []) if (!all.some((x) => x.stem === v.stem)) all.push(v);
    if (!all.length) continue;
    const name = soundEventName(id);
    const e: SoundEvent = { id, name, category: soundCategory('java', id), variants: all, words: words(id, name, all) };
    if (refs.length) e.refs = refs;
    events.push(e);
  }
  return finish('java', version, 'sounds.json', events);
}

/**
 * Without sounds.json (versions before 1.14): one entry per group of numbered files, named after
 * the folder ('block/stone/break1..4' -> 'block.stone.break').
 */
export function javaCatalogFromFiles(files: string[], version: string): SoundCatalog {
  const groups = new Map<string, SoundVariant[]>();
  for (const f of files) {
    const rel = f.replace(/^minecraft\/sounds\//, '').replace(/\.ogg$/i, '');
    if (!rel || rel === f) continue;
    const id = rel.replace(/\d+$/, '').replace(/[_-]$/, '').replace(/\//g, '.') || rel.replace(/\//g, '.');
    const list = groups.get(id) ?? [];
    list.push(variant('java', rel));
    groups.set(id, list);
  }
  const events: SoundEvent[] = [];
  for (const [id, variants] of groups) {
    variants.sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
    const name = soundEventName(id);
    // Folder names of old versions: 'mob/...' are mobs, 'dig' / 'step' blocks, 'random' misc.
    const top = id.split('.')[0];
    const category = soundCategory('java', id) !== 'other' ? soundCategory('java', id) : (BEDROCK_PREFIX[top] ?? (top === 'records' ? 'records' : 'other'));
    events.push({ id, name, category, variants, words: words(id, name, variants) });
  }
  return finish('java', version, 'files', events);
}

// ---------------------------------------------------------------------------------------------
// Bedrock

/** Bedrock's sound_definitions.json (format 1.14+ wrapper or the old flat map). */
export function parseBedrockDefinitions(json: unknown, version: string): SoundCatalog {
  if (!isObj(json)) throw new Error('sound_definitions.json is not an object');
  const defs = isObj(json.sound_definitions) ? json.sound_definitions : json;
  const events: SoundEvent[] = [];
  for (const [id, def] of Object.entries(defs)) {
    if (!isObj(def) || id === 'format_version') continue;
    const variants: SoundVariant[] = [];
    for (const s of Array.isArray(def.sounds) ? def.sounds : []) {
      if (typeof s === 'string' && s) variants.push(variant('bedrock', s));
      else if (isObj(s) && typeof s.name === 'string' && s.name) variants.push(variant('bedrock', s.name, s));
    }
    // Several entries can name the same file (with other volumes): list each file once.
    const unique = variants.filter((v, i) => variants.findIndex((x) => x.stem === v.stem) === i);
    if (!unique.length) continue;
    const name = soundEventName(id);
    const category = soundCategory('bedrock', id, typeof def.category === 'string' ? def.category : undefined);
    events.push({ id, name, category, variants: unique, words: words(id, name, unique) });
  }
  const cat = finish('bedrock', version, 'definitions', events);
  cat.definitions = defs as Record<string, unknown>;
  cat.formatVersion = typeof json.format_version === 'string' ? json.format_version : undefined;
  return cat;
}

// ---------------------------------------------------------------------------------------------
// Search

/** Events matching every word of the query, best matches first (id/name hits beat file-name hits). */
export function searchSoundEvents(events: SoundEvent[], query: string): SoundEvent[] {
  const toks = query.toLowerCase().replace(/[._/:-]+/g, ' ').split(/\s+/).filter(Boolean);
  if (!toks.length) return events;
  const scored: { e: SoundEvent; s: number; i: number }[] = [];
  events.forEach((e, i) => {
    let s = 0;
    const id = e.id.toLowerCase();
    const name = e.name.toLowerCase();
    for (const t of toks) {
      if (!e.words.includes(t)) return;
      if (id === t || name === t) s += 8;
      else if (name.split(' ').includes(t)) s += 4;
      else if (id.includes(t) || name.includes(t)) s += 2;
      else s += 1;
    }
    scored.push({ e, s, i });
  });
  scored.sort((a, b) => b.s - a.s || a.i - b.i);
  return scored.map((x) => x.e);
}
