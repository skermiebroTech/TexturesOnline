// Loose PNGs as a converter source: a single texture image, or a .zip of images named like Java
// textures (stone.png, block/stone.png, blocks/stone.png, textures/item/apple.png) without a
// pack.mcmeta. They become a Java texture project the converter can turn into a .mcpack or a .zip.

import type { TexturePackProject } from '../../core/types';
import { isPng } from '../../core/pixels';
import { isZip, readZip } from '../../core/zip';
import { JAVA_TEXTURE_ROOT, imageDims, newTextureProject, normalizeResolution } from '../textures/project';

export interface LooseImport {
  project: TexturePackProject;
  warnings: string[];
  /** Image paths that didn't match a texture name */
  unmatched: string[];
}

/** Java texture folders that were renamed in 1.13 (their old names mark a pre-1.13 pack). */
const LEGACY_DIR = /^(blocks|items)\//;
const PREFERRED_DIRS = ['block/', 'item/', 'blocks/', 'items/'];

/**
 * Matches each image to a Java texture name from `known` (paths relative to textures/, without
 * extension: '26.3' names plus older names). Throws when nothing matches.
 */
export async function importLoosePngs(file: File, known: Set<string>, latestJava: string): Promise<LooseImport> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let files: Record<string, Uint8Array>;
  if (isPng(bytes)) files = { [file.name || 'texture.png']: bytes };
  else if (isZip(bytes)) files = await readZip(bytes);
  else throw new Error('Choose a .zip, .mcpack or .mcaddon pack, or PNG textures.');

  const byBase = new Map<string, string[]>();
  for (const k of known) {
    const base = k.slice(k.lastIndexOf('/') + 1);
    const list = byBase.get(base);
    if (list) list.push(k);
    else byBase.set(base, [k]);
  }
  const resolve = (path: string): string | null => {
    const stem = path.replace(/\.png$/i, '').toLowerCase();
    const t = stem.lastIndexOf('textures/');
    const segs = (t >= 0 ? stem.slice(t + 'textures/'.length) : stem).split('/');
    for (let i = 0; i < segs.length; i++) {
      const cand = segs.slice(i).join('/');
      if (cand.includes('/') && known.has(cand)) return cand;
    }
    const base = segs[segs.length - 1].replace(/\s*\(\d+\)$/, '').replace(/[\s-]+/g, '_');
    const list = byBase.get(base);
    if (!list?.length) return null;
    for (const dir of PREFERRED_DIRS) {
      const hit = list.find((k) => k === dir + base);
      if (hit) return hit;
    }
    return list.length === 1 ? list[0] : null;
  };

  const matched = new Map<string, { rel: string; data: Uint8Array; path: string }>();
  const unmatched: string[] = [];
  let icon: Uint8Array | undefined;
  for (const [path, data] of Object.entries(files)) {
    if (!/\.png$/i.test(path)) continue;
    const base = path.slice(path.lastIndexOf('/') + 1).toLowerCase();
    if (base === 'pack.png' || base === 'pack_icon.png') {
      if (isPng(data)) icon = data;
      continue;
    }
    const rel = isPng(data) ? resolve(path) : null;
    if (!rel) {
      unmatched.push(path);
      continue;
    }
    if (!matched.has(rel)) matched.set(rel, { rel, data, path });
  }
  if (!matched.size) {
    throw new Error(
      unmatched.length
        ? 'None of the images are named like Minecraft textures. Name them after the texture they replace, for example stone.png or block/stone.png.'
        : "This archive doesn't contain a resource pack or any PNG textures.",
    );
  }

  const legacy = [...matched.keys()].filter((r) => LEGACY_DIR.test(r)).length;
  const version = legacy > matched.size / 2 ? '1.12.2' : latestJava;
  const project = newTextureProject({ name: nameFromFile(file.name), edition: 'java', version, resolution: guessResolution([...matched.values()].map((m) => m.data)) });
  for (const m of matched.values()) {
    project.overrides[`${JAVA_TEXTURE_ROOT}${m.rel}.png`] = new Blob([m.data as Uint8Array<ArrayBuffer>], { type: 'image/png' });
    const meta = files[`${m.path}.mcmeta`];
    if (meta) project.extraFiles[`${JAVA_TEXTURE_ROOT}${m.rel}.png.mcmeta`] = new Blob([meta as Uint8Array<ArrayBuffer>], { type: 'application/json' });
  }
  if (icon) project.icon = new Blob([icon as Uint8Array<ArrayBuffer>], { type: 'image/png' });
  const warnings: string[] = [];
  if (unmatched.length) {
    const names = unmatched.slice(0, 3).map((p) => p.slice(p.lastIndexOf('/') + 1));
    warnings.push(`${unmatched.length} image${unmatched.length === 1 ? '' : 's'} didn't match a texture name and ${unmatched.length === 1 ? 'was' : 'were'} left out: ${names.join(', ')}${unmatched.length > 3 ? ` and ${unmatched.length - 3} more` : ''}.`);
  }
  return { project, warnings, unmatched };
}

function guessResolution(images: Uint8Array[]): number {
  const counts = new Map<number, number>();
  for (const b of images) {
    const d = imageDims(b, 'png');
    if (d && d.w >= 8) counts.set(d.w, (counts.get(d.w) ?? 0) + 1);
  }
  let best = 16;
  let n = 0;
  for (const [w, c] of counts) if (c > n) [best, n] = [w, c];
  return normalizeResolution(Math.max(16, best));
}

function nameFromFile(name: string): string {
  const base = (name.split(/[\\/]/).pop() ?? name).replace(/\.(zip|png)$/i, '').replace(/[_+]+/g, ' ').trim();
  return base || 'My textures';
}
