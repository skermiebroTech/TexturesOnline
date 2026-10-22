// Files the cape maker downloads: the cape PNG (for mods and clients that take a cape picture) and an
// elytra texture pack, the one place a custom design shows without mods: a Java .zip with
// pack.mcmeta for the chosen version, or a Bedrock .mcpack. Loaded when something is downloaded.

import { encodePng } from '../../../core/image';
import { sanitizeFilename } from '../../../core/download';
import { writeZip } from '../../../core/zip';
import { uuidv4 } from '../../../core/uuid';
import type { Edition } from '../../../core/types';
import { buildPackMcmetaForVersions } from '../../../editions/java/packmeta';
import { buildResourceManifest, bumpPackVersion } from '../../../editions/bedrock/manifest';
import { compareJavaVersions } from '../../convert/paths';
import { BEDROCK_ELYTRA_PATH, CAPE_H, CAPE_W, FIRST_ELYTRA_VERSION, JAVA_ELYTRA_PATH, JAVA_LEGACY_ELYTRA_PATH, regionOf } from './cape';

/** Last release before the elytra (1.9 snapshots sort after it and count as having one). */
const LAST_WITHOUT_ELYTRA = '1.8.9';
/** Last release with the elytra at textures/entity/elytra.png (1.21.2 moved it to equipment/wings). */
const LAST_OLD_ELYTRA_PATH = '1.21.1';

export function javaHasElytra(version: string): boolean {
  return compareJavaVersions(version, LAST_WITHOUT_ELYTRA) > 0;
}

export function elytraTexturePath(edition: Edition, version: string): string {
  if (edition === 'bedrock') return BEDROCK_ELYTRA_PATH;
  return compareJavaVersions(version, LAST_OLD_ELYTRA_PATH) > 0 ? JAVA_ELYTRA_PATH : JAVA_LEGACY_ELYTRA_PATH;
}

function newImage(w: number, h: number): ImageData {
  const Ctor = (globalThis as { ImageData?: typeof ImageData }).ImageData;
  return Ctor ? new Ctor(w, h) : ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4), colorSpace: 'srgb' } as ImageData);
}

/** Only the elytra's part of the texture (the rest left empty), as the game's own elytra.png. */
export function elytraTexture(cape: ImageData): ImageData {
  const out = newImage(CAPE_W, CAPE_H);
  for (let y = 0; y < 22; y++) {
    for (let x = 22; x < 46; x++) {
      const i = (y * cape.width + x) * 4;
      out.data.set(cape.data.subarray(i, i + 4), (y * CAPE_W + x) * 4);
    }
  }
  return out;
}

/** A square pack icon: the cape's outside face, scaled up in whole pixels and centred. */
export function capeIcon(cape: ImageData, size: number): ImageData {
  const face = regionOf('capeOutside');
  const k = Math.max(1, Math.floor(size / face.h));
  const out = newImage(size, size);
  const x0 = Math.floor((size - face.w * k) / 2);
  const y0 = Math.floor((size - face.h * k) / 2);
  for (let y = 0; y < face.h * k; y++) {
    for (let x = 0; x < face.w * k; x++) {
      const si = ((face.y + Math.floor(y / k)) * cape.width + face.x + Math.floor(x / k)) * 4;
      const di = ((y0 + y) * size + x0 + x) * 4;
      out.data.set(cape.data.subarray(si, si + 4), di);
      out.data[di + 3] = 255;
    }
  }
  return out;
}

const asciiJson = (text: string) => text.replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
const baseName = (name: string, fallback: string) => sanitizeFilename(name.trim() || fallback, fallback).replace(/\.(png|zip|mcpack)$/i, '');

export function capePngFile(cape: ImageData, name: string): { blob: Blob; filename: string } {
  return { blob: new Blob([encodePng(cape)], { type: 'image/png' }), filename: `${baseName(name, 'cape')}-cape.png` };
}

export interface ElytraPackOptions {
  name: string;
  description: string;
  edition: Edition;
  /** Java version id; ignored for Bedrock */
  version: string;
  /** Bedrock: keep these so importing again replaces the pack */
  uuids?: { header: string; module: string };
  packVersion?: [number, number, number];
}

export interface ElytraPack {
  blob: Blob;
  filename: string;
  files: string[];
  texturePath: string;
  uuids?: { header: string; module: string };
  packVersion?: [number, number, number];
}

export async function buildElytraPack(cape: ImageData, opts: ElytraPackOptions): Promise<ElytraPack> {
  const name = opts.name.trim() || 'Custom Elytra';
  const files: Record<string, Uint8Array | string> = {};
  const texturePath = elytraTexturePath(opts.edition, opts.version);
  let uuids: ElytraPack['uuids'];
  let packVersion: ElytraPack['packVersion'];
  if (opts.edition === 'java') {
    if (!javaHasElytra(opts.version)) throw Object.assign(new Error(`The elytra came in Java ${FIRST_ELYTRA_VERSION}`), { code: 'no-elytra' });
    files['pack.mcmeta'] = asciiJson(await buildPackMcmetaForVersions(opts.description, opts.version));
    files['pack.png'] = encodePng(capeIcon(cape, 128));
  } else {
    uuids = opts.uuids ?? { header: uuidv4(), module: uuidv4() };
    packVersion = bumpPackVersion(opts.packVersion);
    files['manifest.json'] = buildResourceManifest({ name, description: opts.description, uuids, version: packVersion });
    files['pack_icon.png'] = encodePng(capeIcon(cape, 256));
  }
  files[texturePath] = encodePng(elytraTexture(cape));
  const blob = await writeZip(files, { mimeType: opts.edition === 'bedrock' ? 'application/octet-stream' : 'application/zip' });
  return { blob, filename: `${baseName(name, 'Custom Elytra')}.${opts.edition === 'java' ? 'zip' : 'mcpack'}`, files: Object.keys(files), texturePath, uuids, packVersion };
}
