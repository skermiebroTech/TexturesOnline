// Skin exports: Java PNG (64x64), Java legacy 64x32 (for 1.7.10 and older), Bedrock skin pack
// (.mcpack with stable uuids per project) and a plain PNG for Bedrock's "Import" skin slot.

import { cloneImageData, encodePng, toLegacySkin } from '../../core/image';
import { sanitizeFilename } from '../../core/download';
import { writeZip } from '../../core/zip';
import { uuidv4 } from '../../core/uuid';
import type { SkinModel, SkinProject } from '../../core/types';
import { buildSkinPackFiles, bumpPackVersion } from '../../editions/bedrock/manifest';
import { convertArms, countBaseHoles, countOuterPixels, faceRects, mirrorPixel, type SkinPart } from './templates';

/** Skin project with the extra fields the skin tool stores (IndexedDB keeps any shape). */
export interface SkinProjectData extends SkinProject {
  /** Stable Bedrock skin pack uuids, created on the first .mcpack export */
  bedrockUuids?: { header: string; module: string };
  /** Skin pack version, bumped on every .mcpack export */
  packVersion?: [number, number, number];
  /** How the project was started ('template', 'upload', 'username', ...) */
  source?: string;
}

export type ExportKind = 'java' | 'java-legacy' | 'bedrock-pack' | 'bedrock-png';

export interface ExportResult {
  blob: Blob;
  filename: string;
  /** Warnings worth reading before uploading */
  notes: string[];
  /** Short extra detail shown next to the file name */
  meta?: string;
}

function pngBlob(img: ImageData): Blob {
  return new Blob([encodePng(img)], { type: 'image/png' });
}

export function baseName(name: string): string {
  return sanitizeFilename((name || 'skin').trim(), 'skin').replace(/\.(png|mcpack)$/i, '');
}

/** Java Edition PNG. The image is written exactly as painted (straight alpha, PNG). */
export function exportJavaPng(img: ImageData, name: string, model: SkinModel): ExportResult {
  const notes: string[] = [];
  const holes = countBaseHoles(img, model);
  if (holes > 0) {
    notes.push(`${holes} pixel${holes === 1 ? ' is' : 's are'} see-through on the base layer. Java shows those as solid colour (often black). Only the outer layer can be transparent.`);
  }
  return { blob: pngBlob(img), filename: `${baseName(name)}.png`, notes };
}

/** What gets lost when saving in the old 64x32 layout. */
export function legacyLosses(img: ImageData, model: SkinModel): string[] {
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

/** The 64x64 skin as old versions will read it: slim arms widened to classic first. */
export function legacySource(img: ImageData, model: SkinModel): ImageData {
  return model === 'slim' ? convertArms(img, 'slim', 'classic') : img;
}

/** Legacy 64x32 PNG for Java 1.7.10 and older (the top half of the modern layout, classic arms). */
export function exportJavaLegacy(img: ImageData, name: string, model: SkinModel): ExportResult {
  const legacy = toLegacySkin(legacySource(img, model));
  return { blob: pngBlob(legacy), filename: `${baseName(name)}-64x32.png`, notes: legacyLosses(img, model) };
}

/** A plain 64x64 PNG for Bedrock's Classic Skins → Owned → Import slot. */
export function exportBedrockPng(img: ImageData, name: string): ExportResult {
  const notes: string[] = [];
  // Bedrock hides pixels with opacity of about 10% or less.
  let faint = 0;
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i] > 0 && img.data[i] <= 25) faint++;
  if (faint) notes.push(`${faint} nearly invisible pixel${faint === 1 ? '' : 's'} (10% opacity or less) will not show on Bedrock.`);
  return { blob: pngBlob(img), filename: `${baseName(name)}-bedrock.png`, notes };
}

/**
 * Bedrock skin pack (.mcpack). Uuids are created once per project and kept, and the pack version
 * goes up on every export so re-importing updates the installed pack. Mutates `project`
 * (bedrockUuids / packVersion) — save it afterwards.
 */
export async function exportBedrockPack(project: SkinProjectData, img: ImageData): Promise<ExportResult> {
  if (!project.bedrockUuids) project.bedrockUuids = { header: uuidv4(), module: uuidv4() };
  project.packVersion = bumpPackVersion(project.packVersion);
  const name = (project.name || 'My Skin').trim() || 'My Skin';
  const files = buildSkinPackFiles({
    name,
    skins: [{ name, model: project.model, png: encodePng(cloneImageData(img)) }],
    uuids: project.bedrockUuids,
    version: project.packVersion,
  });
  const blob = await writeZip(files, { mimeType: 'application/octet-stream' });
  return {
    blob,
    filename: `${baseName(name)}.mcpack`,
    notes: [],
    meta: `Pack v${project.packVersion.join('.')}`,
  };
}
