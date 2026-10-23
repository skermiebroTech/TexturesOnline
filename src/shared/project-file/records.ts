// What goes into project files and backups, read from this browser's storage, and putting it back:
// - texture packs, skins and shaders are project records (IndexedDB), stored in the file as they
//   are (edited textures, sounds, models and the pack's own files are already Blobs in them);
// - a skin with other skins in its Bedrock pack brings those skins along (a skin pack);
// - an imported shader pack brings its files and the edits made to them (kept beside the record);
// - the cape and font makers each keep one design in localStorage.
// Restoring keeps a project's id unless this browser already has a project with it: then it is
// skipped, or added as a copy with a new id (and new Bedrock uuids, so both packs can be installed).

import type { Project, SkinProject, TexturePackProject } from '../../core/types';
import { getProject, listProjects, saveProject } from '../../core/storage';
import { uuidv4 } from '../../core/uuid';
import { fmt } from '../../i18n/editor-text';
import type { SkinProjectData } from '../../tools/skins/export';
import { isShaderProject, type ShaderProjectData } from '../../tools/shaders/ui/project';
import { FILE_KEY_PREFIX, isImportedPack, loadEdits, loadImportedFiles, saveEdits, saveImportedFiles, type ImportedPackProject } from '../../tools/shaders/packedit/store';
import { readCapeSettings, readSavedCape, writeCapeSettings, writeSavedCape, type CapeSettings } from '../../tools/skins/cape/store';
import { readDraftJson, writeDraftJson } from '../../tools/fonts/draft';
import type { FontDraft } from '../../tools/fonts/font';
import { checkLayerRecords } from '../../tools/textures/layers/record';
import { checkStampRecords } from '../../tools/textures/stamps/stamps';
import { ProjectFileError, type ItemType, type ProjectItem, type ProjectTool } from './format';
import { pf } from './i18n/text';

/** Ids of the single designs of the cape and font makers */
export const CAPE_ID = 'cape';
export const FONT_ID = 'font';

const damaged = () => new ProjectFileError('damaged', pf.errors.damaged);
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

function projectItem(p: Project, data: Record<string, unknown>): ProjectItem {
  const type: ItemType = p.kind === 'texturepack' ? 'texturepack' : p.kind === 'skin' ? 'skin' : 'shader';
  return { type, id: p.id, name: p.name ?? '', updatedAt: p.updatedAt, data };
}

/** A shader project's item: an imported pack brings its files and edits. */
async function shaderItem(p: ShaderProjectData): Promise<ProjectItem> {
  if (!isImportedPack(p)) return projectItem(p, { project: p });
  const files = await loadImportedFiles(p);
  if (!files) throw damaged();
  const edits = await loadEdits(p);
  return projectItem(p, { project: p, files, edits });
}

// ---------------------------------------------------------------------------------------------
// Collecting

/** One saved project as a file's items, and the tool it opens in. */
export async function collectProject(id: string): Promise<{ tool: ProjectTool; items: ProjectItem[] }> {
  const p = await getProject(id);
  if (!p) throw damaged();
  if (p.kind === 'texturepack') return { tool: 'textures', items: [projectItem(p, { project: p })] };
  if (p.kind === 'shader') return { tool: 'shaders', items: [await shaderItem(p as ShaderProjectData)] };
  const skin = p as SkinProjectData;
  const members: ProjectItem[] = [];
  for (const mid of skin.packSkinIds ?? []) {
    const m = await getProject(mid).catch(() => undefined);
    if (m?.kind === 'skin' && m.id !== skin.id) members.push(projectItem(m, { project: m }));
  }
  return { tool: members.length ? 'skinpack' : 'skins', items: [projectItem(skin, { project: skin }), ...members] };
}

/** The cape maker's cape as an item (the page passes what it shows; else the stored one). */
export function capeItem(cape?: { png: Uint8Array; name: string; t: number }, settings: CapeSettings = readCapeSettings()): ProjectItem | null {
  const c = cape ?? readSavedCape();
  if (!c) return null;
  const image = new Blob([c.png.slice() as Uint8Array<ArrayBuffer>], { type: 'image/png' });
  return { type: 'cape', id: CAPE_ID, name: c.name, updatedAt: c.t || undefined, data: { cape: { image, name: c.name, t: c.t }, settings: { ...settings } } };
}

export interface FontTtfData {
  bytes: Uint8Array;
  file: string;
  size: number;
  oversample: number;
  shift: [number, number];
  chars: number[];
}

export interface FontSettings {
  edition?: 'java' | 'bedrock';
  javaVersion?: string;
  packName?: string;
  uuids?: { header: string; module: string };
  packVersion?: [number, number, number];
}

/** The font maker's font as an item (the page passes what it shows; else the stored draft). */
export function fontItem(font?: { draft: FontDraft; name: string; ttf?: FontTtfData | null; settings?: FontSettings }): ProjectItem | null {
  const draft = font?.draft ?? readDraftJson();
  if (!draft || !Object.keys(draft.glyphs ?? {}).length) return null;
  const name = font?.name ?? '';
  const data: Record<string, unknown> = { font: draft, name };
  if (font?.ttf) {
    const { bytes, ...rest } = font.ttf;
    data.ttf = { ...rest, data: new Blob([bytes.slice() as Uint8Array<ArrayBuffer>], { type: 'font/ttf' }) };
  }
  if (font?.settings) data.settings = { ...font.settings };
  return { type: 'font', id: FONT_ID, name, updatedAt: Date.now(), data };
}

/** Every project in this browser, then the cape and the font, for a backup. */
export async function collectAll(): Promise<ProjectItem[]> {
  const items: ProjectItem[] = [];
  for (const p of await listProjects()) {
    if (p.kind === 'texturepack' || p.kind === 'skin') items.push(projectItem(p, { project: p }));
    else if (isShaderProject(p)) {
      // an imported pack whose files are gone can't be opened anyway
      items.push(await shaderItem(p).catch(() => projectItem(p, { project: p })));
    }
  }
  const cape = capeItem();
  if (cape) items.push(cape);
  const font = fontItem();
  if (font) items.push(font);
  return items;
}

// ---------------------------------------------------------------------------------------------
// Checking what comes back (records saved by older versions of a tool get their defaults)

function blobs(x: unknown): Record<string, Blob> {
  const out: Record<string, Blob> = {};
  if (isObj(x)) for (const [k, v] of Object.entries(x)) if (v instanceof Blob) out[k] = v;
  return out;
}

const str = (x: unknown, fallback = ''): string => (typeof x === 'string' ? x : fallback);

function checkTexturePack(x: unknown): TexturePackProject {
  if (!isObj(x) || x.kind !== 'texturepack' || (x.edition !== 'java' && x.edition !== 'bedrock') || typeof x.version !== 'string') throw damaged();
  const p = x as unknown as TexturePackProject;
  const layers = checkLayerRecords(x.layers);
  const out: TexturePackProject = {
    ...p,
    name: str(x.name),
    description: str(x.description),
    resolution: typeof x.resolution === 'number' && x.resolution > 0 ? x.resolution : 16,
    overrides: blobs(x.overrides),
    extraFiles: blobs(x.extraFiles),
    effects: Array.isArray(x.effects) ? (x.effects as unknown[]).filter(isObj) as unknown as TexturePackProject['effects'] : [],
    icon: x.icon instanceof Blob ? x.icon : undefined,
  };
  // paint layers that can't be read are dropped (the texture itself is in overrides)
  if (layers) out.layers = layers;
  else delete out.layers;
  // so are stamps that can't be read
  const stamps = checkStampRecords(x.stamps);
  if (stamps) out.stamps = stamps;
  else delete out.stamps;
  return out;
}

function checkSkin(x: unknown): SkinProjectData {
  if (!isObj(x) || x.kind !== 'skin' || !(x.image instanceof Blob)) throw damaged();
  const p = x as unknown as SkinProjectData;
  return {
    ...p,
    name: str(x.name),
    model: x.model === 'slim' ? 'slim' : 'classic',
    packSkinIds: Array.isArray(x.packSkinIds) ? (x.packSkinIds as unknown[]).filter((v): v is string => typeof v === 'string') : undefined,
    cape: x.cape instanceof Blob ? x.cape : undefined,
  };
}

function checkShader(x: unknown): ShaderProjectData {
  if (!isShaderProject(x)) throw damaged();
  const p: ShaderProjectData = { ...x, name: str(x.name), description: str(x.description), version: str(x.version), settings: isObj(x.settings) ? { ...x.settings } as ShaderProjectData['settings'] : {} };
  // A pack imported only for the preview stays in the browser that imported it.
  if (p.previewTextures?.imported) {
    const { imported: _gone, ...rest } = p.previewTextures;
    p.previewTextures = rest.kind === 'imported' ? { kind: 'vanilla' } : rest;
  }
  return p;
}

// ---------------------------------------------------------------------------------------------
// Restoring

export type ExistingChoice = 'skip' | 'copy';

export interface RestoreResult {
  item: ProjectItem;
  /** 'added' (new here), 'copy' (added beside one with the same id), 'skipped', 'replaced' (cape, font) */
  status: 'added' | 'copy' | 'skipped' | 'replaced';
  /** Id of the project in this browser */
  id: string;
  error?: unknown;
}

const PROJECT_TYPES: ItemType[] = ['texturepack', 'skin', 'shader'];

/** True when this browser already has the item (a project with its id, or a cape / font). */
export async function existsHere(item: { type: ItemType; id: string }): Promise<boolean> {
  if (item.type === 'cape') return !!readSavedCape();
  if (item.type === 'font') return !!readDraftJson();
  return !!(await getProject(item.id).catch(() => undefined));
}

function newUuids(): { header: string; module: string } {
  const header = uuidv4();
  let module = uuidv4();
  while (module === header) module = uuidv4();
  return { header, module };
}

/** The record to store for a project item, under `id` (a copy when it differs from the item's). */
async function projectRecord(item: ProjectItem, id: string, idMap: Map<string, string>): Promise<Project> {
  const copy = id !== item.id;
  const raw = item.data.project;
  const name = (n: string) => (copy ? fmt(pf.copyName, { name: n || pf.untitled }).slice(0, 80) : n);
  if (item.type === 'texturepack') {
    const p = checkTexturePack(raw);
    const out: TexturePackProject = { ...p, id, name: name(p.name) };
    if (copy && out.edition === 'bedrock') {
      out.bedrockUuids = newUuids();
      delete out.packVersion;
    }
    return out;
  }
  if (item.type === 'skin') {
    const p = checkSkin(raw);
    const out: SkinProjectData = { ...p, id, name: name(p.name) };
    if (p.packSkinIds) out.packSkinIds = p.packSkinIds.map((m) => idMap.get(m) ?? m);
    if (copy) {
      delete out.bedrockUuids;
      delete out.packVersion;
    }
    return out as SkinProject;
  }
  const p = checkShader(raw);
  const out: ShaderProjectData = { ...p, id, name: name(p.name) };
  if (copy) {
    delete out.packVersion;
    delete out.exportCount;
    delete out.lastExportAt;
    if (out.target === 'bedrock-vibrant') out.bedrockUuids = newUuids();
  }
  if (isImportedPack(out)) {
    const files = item.data.files;
    if (!isObj(files) || !Object.values(files).every((v) => v instanceof Uint8Array)) throw damaged();
    (out as ImportedPackProject).fileKey = `${FILE_KEY_PREFIX}${id}`;
    const edits: Record<string, string> = {};
    if (isObj(item.data.edits)) for (const [k, v] of Object.entries(item.data.edits)) if (typeof v === 'string') edits[k] = v;
    await saveImportedFiles(out, files as Record<string, Uint8Array>);
    if (Object.keys(edits).length) await saveEdits(out, edits);
  }
  return out;
}

/** The cape's PNG bytes, name and settings out of an item. */
export async function readCapeItem(item: ProjectItem): Promise<{ png: Uint8Array; name: string; settings: CapeSettings }> {
  const c = isObj(item.data.cape) ? item.data.cape : null;
  if (!c || !(c.image instanceof Blob)) throw damaged();
  const png = new Uint8Array(await c.image.arrayBuffer());
  const s = isObj(item.data.settings) ? item.data.settings : {};
  const settings: CapeSettings = {};
  if (s.wear === 'cape' || s.wear === 'elytra') settings.wear = s.wear;
  if (s.edition === 'java' || s.edition === 'bedrock') settings.edition = s.edition;
  if (typeof s.javaVersion === 'string' && s.javaVersion) settings.javaVersion = s.javaVersion;
  if (isObj(s.uuids) && typeof s.uuids.header === 'string' && typeof s.uuids.module === 'string') settings.uuids = { header: s.uuids.header, module: s.uuids.module };
  if (Array.isArray(s.packVersion) && s.packVersion.length === 3 && s.packVersion.every((n) => Number.isInteger(n))) settings.packVersion = s.packVersion as [number, number, number];
  return { png, name: str(c.name).trim() || str(item.name), settings };
}

/** The font's draft, name, embedded TrueType file and settings out of an item. */
export async function readFontItem(item: ProjectItem): Promise<{ draft: FontDraft; name: string; ttf: FontTtfData | null; settings: FontSettings }> {
  const d = item.data.font;
  if (!isObj(d) || d.v !== 1 || !isObj(d.glyphs)) throw damaged();
  let ttf: FontTtfData | null = null;
  const t = item.data.ttf;
  if (isObj(t) && t.data instanceof Blob) {
    ttf = {
      bytes: new Uint8Array(await t.data.arrayBuffer()),
      file: str(t.file, 'font.ttf'),
      size: typeof t.size === 'number' ? t.size : 9,
      oversample: typeof t.oversample === 'number' ? t.oversample : 4,
      shift: Array.isArray(t.shift) && t.shift.length === 2 ? [Number(t.shift[0]) || 0, Number(t.shift[1]) || 0] : [0, 1],
      chars: Array.isArray(t.chars) ? (t.chars as unknown[]).filter((c): c is number => Number.isInteger(c)) : [],
    };
  }
  const s = isObj(item.data.settings) ? item.data.settings : {};
  const settings: FontSettings = {};
  if (s.edition === 'java' || s.edition === 'bedrock') settings.edition = s.edition;
  if (typeof s.javaVersion === 'string' && s.javaVersion) settings.javaVersion = s.javaVersion;
  if (typeof s.packName === 'string') settings.packName = s.packName;
  if (isObj(s.uuids) && typeof s.uuids.header === 'string' && typeof s.uuids.module === 'string') settings.uuids = { header: s.uuids.header, module: s.uuids.module };
  if (Array.isArray(s.packVersion) && s.packVersion.length === 3) settings.packVersion = s.packVersion as [number, number, number];
  return { draft: d as unknown as FontDraft, name: str(item.data.name) || item.name, ttf, settings };
}

/**
 * Puts items into this browser's storage. Projects that are already here are skipped or added as
 * copies (`existing`); a skin pack's skins keep pointing at each other. The cape and font replace
 * the stored ones (the pages ask first when they are open). One item failing doesn't stop the rest.
 */
export async function restoreItems(items: ProjectItem[], opts: { existing: ExistingChoice }): Promise<RestoreResult[]> {
  // First every project's id here, so skin packs can point at their skins' new ids.
  const idMap = new Map<string, string>();
  const status = new Map<ProjectItem, RestoreResult['status']>();
  for (const it of items) {
    if (!PROJECT_TYPES.includes(it.type)) continue;
    const here = await existsHere(it);
    if (!here) {
      idMap.set(it.id, it.id);
      status.set(it, 'added');
    } else if (opts.existing === 'skip') {
      idMap.set(it.id, it.id);
      status.set(it, 'skipped');
    } else {
      idMap.set(it.id, uuidv4());
      status.set(it, 'copy');
    }
  }
  const out: RestoreResult[] = [];
  for (const it of items) {
    try {
      if (it.type === 'cape') {
        const c = await readCapeItem(it);
        if (!writeSavedCape({ png: c.png, name: c.name, t: it.updatedAt ?? Date.now() })) throw new Error('storage');
        writeCapeSettings(c.settings);
        out.push({ item: it, status: 'replaced', id: CAPE_ID });
        continue;
      }
      if (it.type === 'font') {
        const f = await readFontItem(it);
        if (!writeDraftJson(f.draft)) throw new Error('storage');
        out.push({ item: it, status: 'replaced', id: FONT_ID });
        continue;
      }
      const st = status.get(it)!;
      const id = idMap.get(it.id)!;
      if (st === 'skipped') {
        out.push({ item: it, status: st, id });
        continue;
      }
      const record = await projectRecord(it, id, idMap);
      await saveProject(record, { keepTime: st === 'added' });
      out.push({ item: it, status: st, id });
    } catch (error) {
      out.push({ item: it, status: 'skipped', id: it.id, error });
    }
  }
  return out;
}
