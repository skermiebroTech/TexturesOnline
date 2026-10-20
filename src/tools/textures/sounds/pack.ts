// Edited sounds inside a texture pack project. The file that ships is stored in extraFiles at its
// pack path (assets/minecraft/sounds/....ogg for Java, sounds/....ogg|wav|fsb for Bedrock), so packs
// opened with sounds show them as edited and every tool that copies a pack's files keeps them;
// project.sounds holds what the editor needs to keep editing (the upload, trim and volume).

import type { Edition, SoundEdit, TexturePackProject } from '../../../core/types';
import { parseJsonLoose } from '../project';
import { BEDROCK_DEFINITIONS, BEDROCK_SOUND_EXTS, soundStemOfPath, type SoundCatalog, type SoundEvent } from './catalog';
import { fmt } from '../../../i18n/editor-text';
import { tp } from '../i18n/pack';

/** Format version written when the pack has no sound_definitions.json of its own. */
export const BEDROCK_DEFINITIONS_FORMAT = '1.14.0';

/** Stems (pack paths without extension) of every sound file the pack has. */
export function editedSoundStems(project: Pick<TexturePackProject, 'edition' | 'extraFiles'>): Set<string> {
  const out = new Set<string>();
  for (const path of Object.keys(project.extraFiles ?? {})) {
    const stem = soundStemOfPath(project.edition, path);
    if (stem) out.add(stem);
  }
  return out;
}

/** The pack's file for a sound (Bedrock: .ogg before .wav before .fsb, like the game). */
export function soundFileOf(project: Pick<TexturePackProject, 'edition' | 'extraFiles'>, stem: string): { path: string; blob: Blob } | null {
  const exts = project.edition === 'java' ? ['ogg'] : BEDROCK_SOUND_EXTS;
  for (const ext of exts) {
    const path = `${stem}.${ext}`;
    const blob = project.extraFiles?.[path];
    if (blob) return { path, blob };
  }
  return null;
}

function otherPaths(edition: Edition, stem: string): string[] {
  return edition === 'java' ? [`${stem}.ogg`] : BEDROCK_SOUND_EXTS.map((e) => `${stem}.${e}`);
}

/** Puts an encoded sound into the pack, replacing any file the pack had for it. */
export function setSoundFile(project: TexturePackProject, stem: string, ogg: Blob, edit: SoundEdit | null): string {
  const path = `${stem}.ogg`;
  for (const p of otherPaths(project.edition, stem)) {
    delete project.extraFiles[p];
    if (project.sounds) delete project.sounds[p];
  }
  project.extraFiles[path] = ogg;
  if (edit) (project.sounds ??= {})[path] = edit;
  return path;
}

/** Back to the game's sound: removes the pack's file and its editing state. */
export function removeSoundFile(project: TexturePackProject, stem: string): boolean {
  let had = false;
  for (const p of otherPaths(project.edition, stem)) {
    if (project.extraFiles[p]) had = true;
    delete project.extraFiles[p];
    if (project.sounds) delete project.sounds[p];
  }
  return had;
}

export function soundEditOf(project: Pick<TexturePackProject, 'sounds'>, path: string): SoundEdit | undefined {
  return project.sounds?.[path];
}

/** True when any file of the event is the pack's own. */
export function isEventEdited(event: SoundEvent, stems: Set<string>): boolean {
  return event.variants.some((v) => stems.has(v.stem));
}

/** Bedrock: the game's definitions of every event that plays this file (to write next to it). */
export function definitionsForStem(catalog: SoundCatalog, stem: string): Record<string, unknown> | undefined {
  if (catalog.edition !== 'bedrock' || !catalog.definitions) return undefined;
  const out: Record<string, unknown> = {};
  for (const id of catalog.users.get(stem) ?? []) {
    const def = catalog.definitions[id];
    if (def !== undefined) out[id] = structuredClone(def);
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Bedrock export: sound_definitions.json with entries for the events that play edited sounds. The
 * pack's own entries win (an opened pack keeps its definitions); entries are only added. Returns
 * null when nothing needs to change.
 */
export function mergeBedrockDefinitions(existing: string | null, edits: (SoundEdit | undefined)[]): string | null {
  const add: Record<string, unknown> = {};
  for (const e of edits) if (e?.definitions) for (const [id, def] of Object.entries(e.definitions)) add[id] ??= def;
  if (!Object.keys(add).length) return null;
  let root: Record<string, unknown> | null = null;
  if (existing !== null) {
    const parsed = parseJsonLoose(existing);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) root = parsed as Record<string, unknown>;
    // A pack file we can't read is kept as it is.
    if (!root) return null;
  }
  root ??= { format_version: BEDROCK_DEFINITIONS_FORMAT, sound_definitions: {} };
  // Old packs use a flat map (no format_version wrapper).
  const modern = root.sound_definitions && typeof root.sound_definitions === 'object' && !Array.isArray(root.sound_definitions);
  const defs = (modern ? root.sound_definitions : root) as Record<string, unknown>;
  let changed = false;
  for (const [id, def] of Object.entries(add)) {
    if (Object.prototype.hasOwnProperty.call(defs, id)) continue;
    defs[id] = def;
    changed = true;
  }
  return changed ? JSON.stringify(root, null, 2) : null;
}

/** Java sound files in the pack that Java can't play (it only plays Ogg Vorbis: not Opus, MP3 or WAV). */
export async function unplayableJavaSounds(project: Pick<TexturePackProject, 'edition' | 'extraFiles'>): Promise<string[]> {
  if (project.edition !== 'java') return [];
  const bad: string[] = [];
  for (const [path, blob] of Object.entries(project.extraFiles ?? {})) {
    if (!soundStemOfPath('java', path) || !blob) continue;
    try {
      if (!isOggVorbisStart(new Uint8Array(await blob.slice(0, 512).arrayBuffer()))) bad.push(path);
    } catch {
      /* unreadable: reported elsewhere */
    }
  }
  return bad;
}

/** The file starts with an Ogg page whose first packet is a Vorbis identification header. */
export function isOggVorbisStart(b: Uint8Array): boolean {
  if (!(b.length >= 28 && b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53)) return false;
  const p = 27 + b[26];
  return b.length >= p + 7 && b[p] === 1 && String.fromCharCode(...b.subarray(p + 1, p + 7)) === 'vorbis';
}

/**
 * Export step for sounds (the files themselves travel with the pack's other files): Bedrock gets
 * sound_definitions.json entries for the events that play edited sounds; Java warns about files it
 * can't play.
 */
export async function prepareSoundExport(project: TexturePackProject, files: Map<string, Uint8Array>, warnings: string[]): Promise<void> {
  if (project.edition === 'bedrock') {
    const edits = Object.entries(project.sounds ?? {})
      .filter(([path]) => files.has(path))
      .map(([, e]) => e);
    const existing = files.get(BEDROCK_DEFINITIONS);
    const text = mergeBedrockDefinitions(existing ? new TextDecoder().decode(existing) : null, edits);
    if (text) files.set(BEDROCK_DEFINITIONS, new TextEncoder().encode(text));
    return;
  }
  const bad = await unplayableJavaSounds(project);
  if (bad.length) {
    const names = bad.slice(0, 3).map((p) => p.slice(p.lastIndexOf('/') + 1)).join(', ');
    warnings.push(fmt(tp.soundsNotOgg, { count: bad.length, files: `${names}${bad.length > 3 ? '…' : ''}` }));
  }
}

export { BEDROCK_DEFINITIONS };
