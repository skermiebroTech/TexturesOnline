// Skin exports: Java PNG (64x64), Java legacy 64x32 (for 1.7.10 and older), Bedrock skin pack
// (.mcpack with stable uuids per project) and a plain PNG for Bedrock's "Import" skin slot.
// HD 128x128 skins stay HD for Bedrock; Java exports reduce them to 64x64 (Java Edition only shows
// 64x64 skins without mods), unless the HD file is asked for explicitly (for HD skin mods).

import { cloneImageData, encodePng, toLegacySkin } from '../../core/image';
import { sanitizeFilename } from '../../core/download';
import { writeZip } from '../../core/zip';
import { uuidv4 } from '../../core/uuid';
import type { SkinModel, SkinProject } from '../../core/types';
import { buildSkinPackFiles, bumpPackVersion, prepareSkinPngSync } from '../../editions/bedrock/manifest';
import { downscaleSkin, hdDetail } from './hd';
import { convertArms, countBaseHoles, countOuterPixels, faceRects, isHdSkin, mirrorPixel, type SkinPart } from './templates';

/** Skin project with the extra fields the skin tool stores (IndexedDB keeps any shape). */
export interface SkinProjectData extends SkinProject {
  /** Stable Bedrock skin pack uuids, created on the first .mcpack export */
  bedrockUuids?: { header: string; module: string };
  /** Skin pack version, bumped on every .mcpack export */
  packVersion?: [number, number, number];
  /** How the project was started ('template', 'upload', 'username', ...) */
  source?: string;
  /** Other saved skin projects bundled into this project's .mcpack (in pack order) */
  packSkinIds?: string[];
  /** Skin pack name, when it differs from the project name */
  packName?: string;
}

/** A saved skin added to another project's skin pack. */
export type PackSkinSource = Pick<SkinProjectData, 'id' | 'name' | 'model' | 'image'>;

export type ExportKind = 'java' | 'java-legacy' | 'bedrock-pack' | 'bedrock-png';

export interface ExportResult {
  blob: Blob;
  filename: string;
  /** Warnings worth reading before uploading */
  notes: string[];
  /** Short extra detail shown next to the file name */
  meta?: string;
  /** Skins in a .mcpack */
  skinCount?: number;
  /** HD 128x128 skins in a .mcpack */
  hdCount?: number;
}

function pngBlob(img: ImageData): Blob {
  return new Blob([encodePng(img)], { type: 'image/png' });
}

export function baseName(name: string): string {
  return sanitizeFilename((name || 'skin').trim(), 'skin').replace(/\.(png|mcpack)$/i, '');
}

/** Shown wherever an HD skin is reduced for Java. */
export const JAVA_HD_NOTE = 'Java Edition only shows 64×64 skins without mods, so this HD skin was reduced to 64×64.';

/** The 64x64 skin Java Edition reads: HD skins reduced, 64x64 skins as they are. */
export function javaImage(img: ImageData): ImageData {
  return isHdSkin(img) ? downscaleSkin(img) : img;
}

/** Share (0-100) of an HD skin's visible 2x2 blocks that lose detail at 64x64. */
export function hdLossPercent(img: ImageData): number {
  const { changed, visible } = hdDetail(img);
  // Any detail at all counts as at least 1%, so "nothing is lost" is only said when it is true.
  return changed ? Math.max(1, Math.round((changed / visible) * 100)) : 0;
}

/**
 * Java Edition PNG. 64x64 skins are written exactly as painted (straight alpha, PNG); HD skins are
 * reduced to 64x64, or kept at 128x128 with `keepHd` (only HD skin mods read those).
 */
export function exportJavaPng(img: ImageData, name: string, model: SkinModel, opts: { keepHd?: boolean } = {}): ExportResult {
  const notes: string[] = [];
  const hd = isHdSkin(img);
  const keep = hd && !!opts.keepHd;
  const out = keep ? img : javaImage(img);
  if (hd && !keep) {
    const lost = hdLossPercent(img);
    notes.push(lost ? `${JAVA_HD_NOTE} About ${lost}% of the painted areas had finer detail, which is simplified.` : `${JAVA_HD_NOTE} Nothing is lost: it has no finer HD detail yet.`);
  }
  if (keep) notes.push('This is the 128×128 HD file. The Minecraft Launcher and minecraft.net only accept 64×64 skins: use it with an HD skin mod only.');
  const holes = countBaseHoles(out, model);
  if (holes > 0) {
    notes.push(`${holes} pixel${holes === 1 ? ' is' : 's are'} see-through on the base layer. Java shows those as solid colour (often black). Only the outer layer can be transparent.`);
  }
  return { blob: pngBlob(out), filename: `${baseName(name)}${keep ? '-hd' : ''}.png`, notes, meta: keep ? '128×128 HD' : hd ? '64×64, reduced from HD' : undefined };
}

/** What gets lost when saving in the old 64x32 layout (HD skins are reduced to 64x64 first). */
export function legacyLosses(img: ImageData, model: SkinModel): string[] {
  img = javaImage(img);
  const lost: string[] = [];
  const d = img.data;
  // Left limbs: 1.7 and older mirror the right arm and leg; custom left limbs are lost.
  const differs = (part: SkinPart) => {
    for (const r of faceRects(model)) {
      if (r.part !== part || r.layer !== 'base') continue;
      for (let y = r.y; y < r.y + r.h; y++) {
        for (let x = r.x; x < r.x + r.w; x++) {
          const m = mirrorPixel(x, y, model);
          if (!m) continue;
          const a = (y * 64 + x) * 4;
          const b = (m[1] * 64 + m[0]) * 4;
          if (d[a] !== d[b] || d[a + 1] !== d[b + 1] || d[a + 2] !== d[b + 2] || d[a + 3] !== d[b + 3]) return true;
        }
      }
    }
    return false;
  };
  if (differs('leftArm')) lost.push('The left arm becomes a mirror copy of the right arm.');
  if (differs('leftLeg')) lost.push('The left leg becomes a mirror copy of the right leg.');
  const outer = countOuterPixels(img, model);
  const hatOnly = countOuterPixels(img, 'legacy');
  if (outer - hatOnly > 0) lost.push('Jacket, sleeves and pants (the outer layer below the head) are dropped. Only the hat layer is kept.');
  if (model === 'slim') lost.push('Old versions only have classic 4-pixel arms, so the slim arms are widened by repeating the column next to the body.');
  return lost;
}

/** The 64x64 skin as old versions will read it: HD reduced to 64x64, slim arms widened to classic. */
export function legacySource(img: ImageData, model: SkinModel): ImageData {
  img = javaImage(img);
  return model === 'slim' ? convertArms(img, 'slim', 'classic') : img;
}

/** Legacy 64x32 PNG for Java 1.7.10 and older (the top half of the modern layout, classic arms). */
export function exportJavaLegacy(img: ImageData, name: string, model: SkinModel): ExportResult {
  const legacy = toLegacySkin(legacySource(img, model));
  return { blob: pngBlob(legacy), filename: `${baseName(name)}-64x32.png`, notes: legacyLosses(img, model) };
}

/** A plain 64x64 or HD 128x128 PNG for Bedrock's Classic Skins → Owned → Import slot. */
export function exportBedrockPng(img: ImageData, name: string): ExportResult {
  const notes: string[] = [];
  // Bedrock hides pixels with opacity of about 10% or less.
  let faint = 0;
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i] > 0 && img.data[i] <= 25) faint++;
  if (faint) notes.push(`${faint} nearly invisible pixel${faint === 1 ? '' : 's'} (10% opacity or less) will not show on Bedrock.`);
  const hd = isHdSkin(img);
  return { blob: pngBlob(img), filename: `${baseName(name)}-bedrock.png`, notes, meta: hd ? '128×128 HD' : undefined };
}

/** Width and height from a PNG's header (0 x 0 when it is not a PNG). */
export function pngSize(bytes: Uint8Array): { width: number; height: number } {
  if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50) return { width: 0, height: 0 };
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: v.getUint32(16), height: v.getUint32(20) };
}

/** Name shown for the pack in the Dressing Room: the stored pack name, else the project name. */
export function packNameOf(project: Pick<SkinProjectData, 'name' | 'packName'>): string {
  return project.packName?.trim() || project.name?.trim() || 'My Skin';
}

/**
 * The saved skins to bundle with `selfId`, in `ids` order: duplicates, the project itself and ids
 * whose project was deleted are skipped.
 */
export function pickPackSkins<T extends { id: string }>(ids: readonly string[] | undefined, available: readonly T[], selfId: string): T[] {
  const byId = new Map(available.map((p) => [p.id, p]));
  const seen = new Set<string>([selfId]);
  const out: T[] = [];
  for (const id of ids ?? []) {
    const p = byId.get(id);
    if (!p || seen.has(id)) continue;
    seen.add(id);
    out.push(p);
  }
  return out;
}

/**
 * Pack order after the user changed the checklist: skins already in the pack keep their place,
 * newly ticked ones go after them in the order they are listed.
 */
export function orderPackSkinIds(previous: readonly string[] | undefined, checkedInListOrder: readonly string[]): string[] {
  const checked = new Set(checkedInListOrder);
  const kept = [...new Set((previous ?? []).filter((id) => checked.has(id)))];
  const keptSet = new Set(kept);
  return [...kept, ...[...checked].filter((id) => !keptSet.has(id))];
}

export function skinCountLabel(n: number): string {
  return `${n} skin${n === 1 ? '' : 's'}`;
}

/**
 * Bedrock skin pack (.mcpack) with this skin first, then `extras` (other saved skins), each with
 * its own name and arm model. Uuids are created once per project and kept, and the pack version
 * goes up on every export so re-importing updates the installed pack. Mutates `project`
 * (bedrockUuids / packVersion) — save it afterwards.
 */
export async function exportBedrockPack(project: SkinProjectData, img: ImageData, extras: readonly PackSkinSource[] = []): Promise<ExportResult> {
  const skinName = (project.name || 'My Skin').trim() || 'My Skin';
  const packName = packNameOf(project);
  const others = await Promise.all(
    extras.map(async (p) => {
      const name = (p.name || 'Skin').trim() || 'Skin';
      try {
        return { name, model: p.model, png: prepareSkinPngSync(new Uint8Array(await p.image.arrayBuffer())) };
      } catch (err) {
        throw new Error(`"${name}" could not be added to the pack: ${err instanceof Error ? err.message : 'the image is unreadable.'}`);
      }
    }),
  );
  if (!project.bedrockUuids) project.bedrockUuids = { header: uuidv4(), module: uuidv4() };
  project.packVersion = bumpPackVersion(project.packVersion);
  const skins = [{ name: skinName, model: project.model, png: encodePng(cloneImageData(img)) }, ...others];
  const files = buildSkinPackFiles({ name: packName, skins, uuids: project.bedrockUuids, version: project.packVersion });
  const blob = await writeZip(files, { mimeType: 'application/octet-stream' });
  // HD and 64x64 skins mix freely: every skin is its own texture on the same model.
  const hdCount = skins.filter((sk) => pngSize(sk.png).width === 128).length;
  const hdLabel = hdCount ? (skins.length === 1 ? '128×128 HD' : `${hdCount} HD`) : null;
  return {
    blob,
    filename: `${baseName(packName)}.mcpack`,
    notes: [],
    meta: [`Pack v${project.packVersion.join('.')}`, skinCountLabel(skins.length), hdLabel].filter(Boolean).join(' · '),
    skinCount: skins.length,
    hdCount,
  };
}
