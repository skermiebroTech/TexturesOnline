// Zips a pack with explicit folder entries (OptiFine looks for real "shaders/" directory entries).

import { strToU8 } from 'fflate';
import type { FileMap } from '../../../core/types';
import { zipParts, type ZipItem } from '../../../core/zip';

const STORED = /\.(png|jpe?g|webp|zip|ogg)$/i;

type Tree = Map<string, Tree | Uint8Array>;

export async function zipPack(files: FileMap, mimeType = 'application/zip'): Promise<Blob> {
  const root: Tree = new Map();
  for (const [raw, value] of Object.entries(files)) {
    const path = raw.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!path || path.endsWith('/') || path.split('/').includes('..')) continue;
    const bytes = typeof value === 'string' ? strToU8(value) : value instanceof Uint8Array ? value : new Uint8Array(await value.arrayBuffer());
    const parts = path.split('/');
    let node = root;
    for (const dir of parts.slice(0, -1)) {
      let next = node.get(dir);
      if (!(next instanceof Map)) node.set(dir, (next = new Map()));
      node = next;
    }
    node.set(parts[parts.length - 1], bytes);
  }
  // each folder's entry comes before what is in it (folder entries are deflated, empty, as fflate did)
  const items: ZipItem[] = [];
  const walk = (node: Tree, prefix: string) => {
    for (const [name, value] of node) {
      if (value instanceof Map) {
        items.push({ path: `${prefix}${name}/`, data: new Uint8Array(0), level: 6 });
        walk(value, `${prefix}${name}/`);
      } else items.push({ path: prefix + name, data: value, level: STORED.test(name) ? 0 : 6 });
    }
  };
  walk(root, '');
  return new Blob(await zipParts(items), { type: mimeType });
}
