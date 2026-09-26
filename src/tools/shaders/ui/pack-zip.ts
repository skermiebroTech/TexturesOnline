// Zips a pack with explicit folder entries (OptiFine looks for real "shaders/" directory entries).

import { strToU8, zip, type AsyncZippable, type AsyncZipOptions } from 'fflate';
import type { FileMap } from '../../../core/types';

const STORED = /\.(png|jpe?g|webp|zip|ogg)$/i;

type Tree = { [name: string]: Tree | [Uint8Array, AsyncZipOptions] };

export async function zipPack(files: FileMap, mimeType = 'application/zip'): Promise<Blob> {
  const root: Tree = {};
  const mtime = new Date();
  for (const [raw, value] of Object.entries(files)) {
    const path = raw.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!path || path.endsWith('/') || path.split('/').includes('..')) continue;
    const bytes = typeof value === 'string' ? strToU8(value) : value instanceof Uint8Array ? value : new Uint8Array(await value.arrayBuffer());
    const parts = path.split('/');
    let node = root;
    for (const dir of parts.slice(0, -1)) {
      const next = node[dir];
      if (!next || Array.isArray(next)) node[dir] = {};
      node = node[dir] as Tree;
    }
    node[parts[parts.length - 1]] = [bytes, { level: STORED.test(path) ? 0 : 6, mtime }];
  }
  const out = await new Promise<Uint8Array>((resolve, reject) => {
    zip(root as AsyncZippable, { level: 6, mtime }, (err, data) => (err ? reject(err) : resolve(data)));
  });
  return new Blob([out as Uint8Array<ArrayBuffer>], { type: mimeType });
}
