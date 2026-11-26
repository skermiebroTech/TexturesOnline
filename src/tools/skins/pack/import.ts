// Opening an existing Bedrock skin pack (.mcpack / .zip) in the Skin Pack Maker: manifest.json for
// the name, description, uuids and version; skins.json for the skins, their arm models and
// pictures; texts/*.lang for the names shown in the Dressing Room. No DOM. Files that aren't skin
// packs get an error that says what they are; skins that can't be used are left out with a note.

import type { SkinModel } from '../../../core/types';
import { isPng } from '../../../core/image';
import { readZip } from '../../../core/zip';
import { timeSlicer } from '../../../core/yield';
import { prepareSkinPngSync } from '../../../editions/bedrock/manifest';
import { parseLenientJson } from '../../../editions/bedrock/catalog';
import { fmt } from '../../../i18n/editor-text';
import { packText } from '../i18n/pack';
import { NAME_MAX, DESCRIPTION_MAX } from './pack';

export type SkinPackImportErrorCode = 'not-zip' | 'resource-pack' | 'other-pack' | 'no-skins-json' | 'bad-json' | 'no-skins' | 'no-usable-skins';

/** A file that can't be opened as a skin pack; the message is written for the user. */
export class SkinPackImportError extends Error {
  constructor(
    readonly code: SkinPackImportErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'SkinPackImportError';
  }
}

export interface ImportedSkinPack {
  name: string;
  description: string;
  skins: { name: string; model: SkinModel; png: Uint8Array }[];
  /** pack_icon.png */
  icon?: Uint8Array;
  /** The pack's own uuids, kept so a new export updates the installed pack */
  uuids?: { header: string; module: string };
  version?: [number, number, number];
  /** Things worth knowing (skins left out, capes dropped...) */
  notes: string[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const str = (x: unknown): string => (typeof x === 'string' ? x : '');
const decoder = new TextDecoder();

function parseJson(bytes: Uint8Array | undefined): unknown {
  if (!bytes) return undefined;
  try {
    return parseLenientJson(decoder.decode(bytes));
  } catch {
    return undefined;
  }
}

/** key=value lines of a .lang file ('##' comments, and '\t#' comments after a value). */
export function parseLang(text: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const raw of text.replace(/^﻿/, '').split(/\r?\n/)) {
    if (!raw.trim() || raw.trimStart().startsWith('##')) continue;
    const eq = raw.indexOf('=');
    if (eq <= 0) continue;
    const key = raw.slice(0, eq).trim();
    let value = raw.slice(eq + 1);
    const comment = value.indexOf('\t#');
    if (comment >= 0) value = value.slice(0, comment);
    out.set(key, value.trim());
  }
  return out;
}

function moduleTypes(manifest: unknown): string[] {
  if (!isObj(manifest) || !Array.isArray(manifest.modules)) return [];
  return manifest.modules.filter(isObj).map((m) => str(m.type));
}

function versionOf(v: unknown): [number, number, number] | undefined {
  const parts = Array.isArray(v) ? v : typeof v === 'string' ? v.split('.') : null;
  if (!parts || parts.length < 3) return undefined;
  const n = parts.slice(0, 3).map((x) => Number(x));
  return n.every((x) => Number.isInteger(x) && x >= 0) ? [n[0], n[1], n[2]] : undefined;
}

/** Arm model of a skins.json geometry: the two standard ones, else by its name (slim or not). */
function modelOf(geometry: string): { model: SkinModel; custom: boolean } {
  if (geometry === 'geometry.humanoid.customSlim') return { model: 'slim', custom: false };
  if (geometry === 'geometry.humanoid.custom') return { model: 'classic', custom: false };
  return { model: /slim/i.test(geometry) ? 'slim' : 'classic', custom: true };
}

const fileBase = (name: string) => name.replace(/^.*[\\/]/, '').replace(/\.(mcpack|zip)$/i, '').trim();

/** Reads a Bedrock skin pack. Throws a SkinPackImportError when the file isn't one. */
export async function readSkinPackFile(data: Blob | Uint8Array, fileName = ''): Promise<ImportedSkinPack> {
  const t = packText.import;
  let files: Record<string, Uint8Array>;
  try {
    files = await readZip(data);
  } catch {
    throw new SkinPackImportError('not-zip', t.notZip);
  }
  const paths = Object.keys(files);
  const notes: string[] = [];

  // The pack's folder: where skins.json is (packs are often zipped inside a folder).
  const lists = paths.filter((p) => /(^|\/)skins\.json$/i.test(p)).sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b));
  if (!lists.length) {
    const types = paths.filter((p) => /(^|\/)manifest\.json$/i.test(p)).flatMap((p) => moduleTypes(parseJson(files[p])));
    if (types.includes('resources')) throw new SkinPackImportError('resource-pack', t.resourcePack);
    if (types.length) throw new SkinPackImportError('other-pack', t.otherPack);
    throw new SkinPackImportError('no-skins-json', t.noSkinsJson);
  }
  if (lists.length > 1) notes.push(t.morePacks);
  const root = lists[0].slice(0, lists[0].length - 'skins.json'.length);
  const byLower = new Map(paths.map((p) => [p.toLowerCase(), p]));
  const file = (rel: string): Uint8Array | undefined => {
    const clean = rel.replace(/\\/g, '/').replace(/^(\.\/|\/)+/, '');
    const p = root + clean;
    return files[p] ?? files[byLower.get(p.toLowerCase()) ?? ''];
  };

  const list = parseJson(files[lists[0]]);
  if (!isObj(list)) throw new SkinPackImportError('bad-json', t.badJson);
  const entries = Array.isArray(list.skins) ? list.skins.filter(isObj) : [];
  if (!entries.length) throw new SkinPackImportError('no-skins', t.noSkins);

  // Names: the English language file first, else any other one.
  const langPaths = paths.filter((p) => p.startsWith(`${root}texts/`) && /\.lang$/i.test(p));
  const langPath = ['en_US', 'en_GB'].map((l) => langPaths.find((p) => p.toLowerCase() === `${root}texts/${l}.lang`.toLowerCase())).find(Boolean) ?? langPaths.sort()[0];
  const lang = langPath ? parseLang(decoder.decode(files[langPath])) : new Map<string, string>();
  const packId = str(list.localization_name) || str(list.serialize_name);

  const manifestBytes = file('manifest.json');
  const manifest = parseJson(manifestBytes);
  const header = isObj(manifest) && isObj(manifest.header) ? manifest.header : {};
  let uuids: ImportedSkinPack['uuids'];
  const moduleUuid = isObj(manifest) && Array.isArray(manifest.modules) ? str(manifest.modules.filter(isObj).find((m) => m.type === 'skin_pack')?.uuid) : '';
  const headerUuid = str(header.uuid);
  if (UUID.test(headerUuid) && UUID.test(moduleUuid) && headerUuid.toLowerCase() !== moduleUuid.toLowerCase()) uuids = { header: headerUuid.toLowerCase(), module: moduleUuid.toLowerCase() };
  else notes.push(t.noManifest);
  const version = uuids ? versionOf(header.version) : undefined;

  const headerName = str(header.name);
  const name = (lang.get(`skinpack.${packId}`) || lang.get(headerName) || headerName || fileBase(fileName) || packText.defaultName).trim().slice(0, NAME_MAX);
  const headerDescription = str(header.description);
  const description = (lang.get(headerDescription) ?? headerDescription).trim().slice(0, DESCRIPTION_MAX);

  const slice = timeSlicer(8);
  const skins: ImportedSkinPack['skins'] = [];
  let custom = 0;
  let capes = 0;
  let firstReason = '';
  for (let i = 0; i < entries.length; i++) {
    const s = entries[i];
    const loc = str(s.localization_name);
    const skinName = (lang.get(`skin.${packId}.${loc}`) || loc || `${packText.add.uploadedName} ${i + 1}`).trim().slice(0, NAME_MAX);
    const texture = str(s.texture);
    const bytes = texture ? (file(texture) ?? (/\.[a-z]+$/i.test(texture) ? undefined : file(`${texture}.png`))) : undefined;
    let reason = '';
    let png: Uint8Array | null = null;
    if (!bytes) reason = fmt(t.missingTexture, { file: texture || '?' });
    else {
      try {
        png = prepareSkinPngSync(bytes);
      } catch (err) {
        reason = err instanceof Error ? err.message : String(err);
      }
    }
    if (!png) {
      firstReason ||= reason;
      notes.push(fmt(t.skipped, { name: skinName, reason }));
    } else {
      const m = modelOf(str(s.geometry));
      if (m.custom) custom++;
      if (s.cape) capes++;
      skins.push({ name: skinName, model: m.model, png });
    }
    await slice();
  }
  if (!skins.length) throw new SkinPackImportError('no-usable-skins', fmt(t.noUsable, { reason: firstReason }));
  if (custom) notes.push(fmt(t.customModel, { count: custom }));
  if (capes) notes.push(t.capes);
  const iconBytes = file('pack_icon.png');
  return { name, description, skins, icon: iconBytes && isPng(iconBytes) ? iconBytes : undefined, uuids, version, notes };
}
