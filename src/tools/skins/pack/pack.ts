// Skin packs of the Skin Pack Maker (/skin-pack-maker): the stored pack, keeping skins in step with
// the saved skins they came from, the default pack icon and the .mcpack export. No DOM: the builder
// (./builder.ts) shows and edits packs, ./import.ts reads existing skin packs.
// The files are written by the same code as the skin editor's Bedrock skin pack export
// (buildSkinPackFiles in src/editions/bedrock/manifest.ts).

import type { FileMap, SkinModel, SkinPackProject, SkinPackSkin, SkinProject } from '../../../core/types';
import { createImageData, decodePngBytes, encodePng, isPng } from '../../../core/image';
import { uuidv4 } from '../../../core/uuid';
import { writeZip } from '../../../core/zip';
import { timeSlicer } from '../../../core/yield';
import { buildSkinPackFiles, bumpPackVersion, prepareSkinPngSync } from '../../../editions/bedrock/manifest';
import { errorText } from '../../../shared/i18n/errors';
import { fmt } from '../../../i18n/editor-text';
import { baseName, pngSize, skinCountLabel, type ExportResult } from '../export';
import { scaleOf } from '../templates';
import { exportText } from '../i18n/export';
import { packText } from '../i18n/pack';

/** Longest pack and skin names kept (the game shows far fewer characters). */
export const NAME_MAX = 60;
export const DESCRIPTION_MAX = 300;

/** A new, empty pack (not stored yet). */
export function newSkinPack(name = packText.defaultName): SkinPackProject {
  const now = Date.now();
  return { id: uuidv4(), kind: 'skinpack', name, description: '', skins: [], createdAt: now, updatedAt: now };
}

/** A skin for a pack. `from`: the saved skin project it comes from (its later edits follow it). */
export function newPackSkin(opts: { name: string; model: SkinModel; image: Blob; from?: Pick<SkinProject, 'id' | 'updatedAt' | 'model'> }): SkinPackSkin {
  const skin: SkinPackSkin = { id: uuidv4(), name: opts.name.trim().slice(0, NAME_MAX), model: opts.model, image: opts.image };
  if (opts.from) linkPackSkin(skin, opts.from);
  return skin;
}

/** Ties a pack skin to a saved skin project as it is now. */
export function linkPackSkin(skin: SkinPackSkin, project: Pick<SkinProject, 'id' | 'updatedAt' | 'model'>): void {
  skin.skinId = project.id;
  skin.syncedAt = project.updatedAt || 0;
  skin.syncedModel = project.model;
}

/**
 * Brings a saved skin's later edits into the pack: its picture when the project was saved since the
 * last look, and its arm model only when that was changed there (an arm style picked in the pack is
 * kept otherwise). True when the pack skin changed.
 */
export function syncPackSkin(skin: SkinPackSkin, project: Pick<SkinProject, 'image' | 'model' | 'updatedAt'> | undefined): boolean {
  if (!project || !(project.image instanceof Blob)) return false;
  const at = project.updatedAt || 0;
  if (at <= (skin.syncedAt ?? 0)) return false;
  skin.image = project.image;
  if (skin.syncedModel && project.model !== skin.syncedModel) skin.model = project.model;
  skin.syncedAt = at;
  skin.syncedModel = project.model;
  return true;
}

/** A copy of `list` with the item at `from` moved to `to` (both clamped to the list). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const out = [...list];
  if (from < 0 || from >= out.length) return out;
  const dest = Math.max(0, Math.min(out.length - 1, to));
  const [item] = out.splice(from, 1);
  out.splice(dest, 0, item);
  return out;
}

/** The skin's face (base and hat layer) as a square picture of `size` pixels: the default pack icon. */
export function faceIcon(img: ImageData, size = 128): ImageData {
  const k = scaleOf(img.width);
  const face = 8 * k;
  const out = createImageData(size, size);
  const s = img.data;
  const d = out.data;
  for (let y = 0; y < size; y++) {
    const fy = 8 * k + Math.floor((y * face) / size);
    for (let x = 0; x < size; x++) {
      const fx = Math.floor((x * face) / size);
      const b = (fy * img.width + 8 * k + fx) * 4;
      const o = (fy * img.width + 40 * k + fx) * 4;
      const a = s[o + 3] / 255;
      const i = (y * size + x) * 4;
      // the hat over the face; the face itself is drawn opaque, as the game does
      d[i] = Math.round(s[o] * a + s[b] * (1 - a));
      d[i + 1] = Math.round(s[o + 1] * a + s[b + 1] * (1 - a));
      d[i + 2] = Math.round(s[o + 2] * a + s[b + 2] * (1 - a));
      d[i + 3] = 255;
    }
  }
  return out;
}

/** Name written into the pack. */
export function packNameFor(pack: Pick<SkinPackProject, 'name'>): string {
  return pack.name.trim().slice(0, NAME_MAX) || packText.defaultName;
}

export interface SkinPackExport extends ExportResult {
  /** The pack's files, as written into the .mcpack */
  files: FileMap;
}

/**
 * The pack as a Bedrock skin pack (.mcpack), skins in pack order with their own names and arm
 * models, the pack icon (the user's picture, else the first skin's face) and description. Uuids are
 * made once per pack and kept, and the version goes up on every export, so opening the new file
 * updates the installed pack. Mutates `pack` (bedrockUuids / packVersion): save it afterwards.
 */
export async function exportSkinPack(pack: SkinPackProject): Promise<SkinPackExport> {
  if (!pack.skins.length) throw new Error(errorText.noSkins);
  const slice = timeSlicer(8);
  const skins: { name: string; model: SkinModel; png: Uint8Array }[] = [];
  for (let i = 0; i < pack.skins.length; i++) {
    const s = pack.skins[i];
    const name = s.name.trim() || `${exportText.pack.skinName} ${i + 1}`;
    try {
      // checks the size and converts old 64x32 skins (each PNG is read once, here)
      skins.push({ name, model: s.model, png: prepareSkinPngSync(new Uint8Array(await s.image.arrayBuffer())) });
    } catch (err) {
      throw new Error(fmt(exportText.pack.addFailed, { name, error: err instanceof Error ? err.message : exportText.pack.unreadable }));
    }
    await slice();
  }
  let icon: Uint8Array | undefined;
  if (pack.icon) {
    const bytes = new Uint8Array(await pack.icon.arrayBuffer());
    if (isPng(bytes)) icon = bytes;
  }
  if (!icon) icon = encodePng(faceIcon(decodePngBytes(skins[0].png)));
  const uuids = pack.bedrockUuids ?? { header: uuidv4(), module: uuidv4() };
  const version = bumpPackVersion(pack.packVersion);
  const name = packNameFor(pack);
  // Blobs: the PNGs were checked above and go in as they are
  const files = buildSkinPackFiles({
    name,
    description: pack.description,
    icon,
    skins: skins.map((s) => ({ name: s.name, model: s.model, png: new Blob([s.png.slice() as Uint8Array<ArrayBuffer>], { type: 'image/png' }) })),
    uuids,
    version,
  });
  const blob = await writeZip(files, { mimeType: 'application/octet-stream' });
  pack.bedrockUuids = uuids;
  pack.packVersion = version;
  const hdCount = skins.filter((s) => pngSize(s.png).width === 128).length;
  return {
    blob,
    files,
    filename: `${baseName(name)}.mcpack`,
    notes: [],
    meta: [fmt(exportText.pack.version, { version: version.join('.') }), skinCountLabel(skins.length), hdCount ? fmt(exportText.pack.hdCount, { count: hdCount }) : null].filter(Boolean).join(' · '),
    skinCount: skins.length,
    hdCount,
  };
}
