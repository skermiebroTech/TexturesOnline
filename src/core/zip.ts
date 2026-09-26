import { unzip, zip, strToU8, type Unzipped, type AsyncZippable } from 'fflate';
import type { FileMap } from './types';

export type ZipInput = Blob | Uint8Array | ArrayBuffer;

/** Already-compressed formats are stored instead of deflated (fast, no size gain lost). */
const STORED_EXT = /\.(png|jpe?g|gif|webp|zip|jar|mcpack|mcaddon|mcworld|ogg|mp3|fsb|gz)$/i;

async function toBytes(data: ZipInput): Promise<Uint8Array> {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return new Uint8Array(await data.arrayBuffer());
}

export function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 3 || bytes[2] === 5) && (bytes[3] === 4 || bytes[3] === 6);
}

/** Normalises an entry name: forward slashes, no leading ./ or /. Returns '' for entries to skip. */
export function normalizeZipPath(name: string): string {
  let p = name.replace(/\\/g, '/');
  while (p.startsWith('./')) p = p.slice(2);
  p = p.replace(/^\/+/, '');
  if (!p || p.endsWith('/')) return '';
  if (p.startsWith('__MACOSX/') || /(^|\/)\.DS_Store$/.test(p) || /(^|\/)Thumbs\.db$/i.test(p)) return '';
  if (p.split('/').some((seg) => seg === '..')) return '';
  return p;
}

function zipError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  if (/unknown compression type|compression/i.test(msg))
    return new Error("This archive uses a compression method that can't be read in the browser. Re-save it as a normal .zip and try again.");
  if (/invalid zip|unexpected EOF|invalid/i.test(msg))
    return new Error("This file isn't a valid .zip archive, or it is damaged.");
  return new Error(`Couldn't read the archive: ${msg}`);
}

/**
 * Reads a zip (.zip/.jar/.mcpack) into path -> bytes. Directory entries, __MACOSX and
 * path-traversal entries are skipped. `filter` receives the normalised path.
 */
/** Refuse archives that would expand to more than this (zip bombs, or not a pack at all). */
export const MAX_UNZIPPED_BYTES = 1024 * 1024 * 1024;

export async function readZip(data: ZipInput, filter?: (path: string) => boolean): Promise<Record<string, Uint8Array>> {
  const bytes = await toBytes(data);
  if (!isZip(bytes)) throw new Error("This file isn't a .zip archive.");
  const renamed = new Map<string, string>();
  let expanded = 0;
  let tooBig = false;
  const files = await new Promise<Unzipped>((resolve, reject) => {
    try {
      unzip(
        bytes,
        {
          filter(f) {
            if (tooBig) return false;
            const p = normalizeZipPath(f.name);
            if (!p) return false;
            if (filter && !filter(p)) return false;
            expanded += f.originalSize;
            if (expanded > MAX_UNZIPPED_BYTES) {
              tooBig = true;
              return false;
            }
            if (p !== f.name) renamed.set(f.name, p);
            return true;
          },
        },
        (err, out) => (err ? reject(zipError(err)) : resolve(out)),
      );
    } catch (err) {
      reject(zipError(err));
    }
  });
  if (tooBig) throw new Error('This archive is too large to open here (over 1 GB when unpacked).');
  if (!renamed.size) return files;
  const out: Record<string, Uint8Array> = {};
  for (const [name, content] of Object.entries(files)) out[renamed.get(name) ?? name] = content;
  return out;
}

/** Builds a zip Blob from a FileMap. PNG and other compressed data is stored, text is deflated. */
export async function writeZip(files: FileMap, opts: { level?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9; mimeType?: string } = {}): Promise<Blob> {
  const input: AsyncZippable = {};
  const mtime = new Date();
  for (const [rawPath, value] of Object.entries(files)) {
    const path = normalizeZipPath(rawPath);
    if (!path) continue;
    let bytes: Uint8Array;
    if (typeof value === 'string') bytes = strToU8(value);
    else if (value instanceof Uint8Array) bytes = value;
    else bytes = new Uint8Array(await value.arrayBuffer());
    const level = STORED_EXT.test(path) ? 0 : (opts.level ?? 6);
    input[path] = [bytes, { level, mtime }];
  }
  const out = await new Promise<Uint8Array>((resolve, reject) => {
    zip(input, { level: opts.level ?? 6 }, (err, data) => (err ? reject(zipError(err)) : resolve(data)));
  });
  return new Blob([out as Uint8Array<ArrayBuffer>], { type: opts.mimeType ?? 'application/zip' });
}
