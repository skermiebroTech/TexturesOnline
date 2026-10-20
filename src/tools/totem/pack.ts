// The totem as files: the downloadable Java .zip / Bedrock .mcpack and a texture pack project to
// keep editing it. Kept apart from totem.ts (drawing the totem) so the page loads the zip writer and
// the PNG encoder only when a pack is made.

import type { Edition, TexturePackProject } from '../../core/types';
import { encodePng } from '../../core/image';
import { sanitizeFilename } from '../../core/download';
import { writeZip } from '../../core/zip';
import { buildPackMcmetaForVersions } from '../../editions/java/packmeta';
import { buildResourceManifest, bumpPackVersion } from '../../editions/bedrock/manifest';
import { asciiJson } from '../textures/export';
import { newBedrockUuids, newTextureProject } from '../textures/project';
import { BEDROCK_ICON_SIZE, DEFAULT_PACK_NAME, FIRST_TOTEM_VERSION, JAVA_ICON_SIZE, javaHasTotem, totemDescription, totemIcon, totemTexturePath, type TotemPack, type TotemPackOptions } from './totem';

function png(img: ImageData): Uint8Array<ArrayBuffer> {
  return encodePng(img);
}

/** Builds the downloadable pack: Java .zip with pack.mcmeta for the version, or a Bedrock .mcpack. */
export async function buildTotemPack(totem: ImageData, opts: TotemPackOptions): Promise<TotemPack> {
  const name = opts.name.trim() || DEFAULT_PACK_NAME;
  const description = (opts.description ?? totemDescription(null)).trim();
  const texturePath = opts.path ?? totemTexturePath(opts.edition, opts.version);
  const files: Record<string, Uint8Array | string> = {};
  let uuids: TotemPack['uuids'];
  let packVersion: TotemPack['packVersion'];
  if (opts.edition === 'java') {
    if (!javaHasTotem(opts.version)) throw new Error(`Minecraft ${opts.version} has no Totem of Undying: it was added in Java ${FIRST_TOTEM_VERSION}.`);
    files['pack.mcmeta'] = asciiJson(await buildPackMcmetaForVersions(description, opts.version));
    files['pack.png'] = png(totemIcon(totem, JAVA_ICON_SIZE));
  } else {
    uuids = opts.uuids ?? newBedrockUuids();
    packVersion = bumpPackVersion(opts.packVersion);
    files['manifest.json'] = buildResourceManifest({ name, description, uuids, version: packVersion });
    files['pack_icon.png'] = png(totemIcon(totem, BEDROCK_ICON_SIZE));
  }
  files[texturePath] = png(totem);
  const blob = await writeZip(files, { mimeType: opts.edition === 'bedrock' ? 'application/octet-stream' : 'application/zip' });
  const base = sanitizeFilename(name, 'Custom Totem').replace(/\.(zip|mcpack)$/i, '');
  return { blob, filename: `${base}.${opts.edition === 'java' ? 'zip' : 'mcpack'}`, files: Object.keys(files), texturePath, uuids, packVersion };
}

/** A texture pack project holding the totem, to keep editing it in the texture tool. */
export function totemProject(totem: ImageData, opts: { name: string; description?: string; edition: Edition; version: string; path?: string }): TexturePackProject {
  const project = newTextureProject({ name: opts.name.trim() || DEFAULT_PACK_NAME, edition: opts.edition, version: opts.version, description: opts.description });
  const path = opts.path ?? totemTexturePath(opts.edition, opts.version);
  project.overrides[path] = new Blob([png(totem)], { type: 'image/png' });
  project.icon = new Blob([png(totemIcon(totem, opts.edition === 'java' ? JAVA_ICON_SIZE : BEDROCK_ICON_SIZE))], { type: 'image/png' });
  return project;
}
