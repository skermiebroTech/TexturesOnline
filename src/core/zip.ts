import { zip, strToU8, type AsyncZippable } from 'fflate';
import type { FileMap } from './types';
import { fileText } from '../shared/i18n/files';
import { fmt } from '../i18n/editor-text';
import { openBytesZip, type ZipEntry } from './rangezip';

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
    return new Error(fileText.zip.unsupportedMethod);
  if (/invalid zip|unexpected EOF|invalid/i.test(msg))
    return new Error(fileText.zip.invalid);
  return new Error(fmt(fileText.zip.unreadable, { message: msg }));
}

/**
 * Reads a zip (.zip/.jar/.mcpack) into path -> bytes. Directory entries, __MACOSX and
 * path-traversal entries are skipped. `filter` receives the normalised path.
 */
/** Refuse archives that would expand to more than this (zip bombs, or not a pack at all). */
export const MAX_UNZIPPED_BYTES = 1024 * 1024 * 1024;

export async function readZip(data: ZipInput, filter?: (path: string) => boolean): Promise<Record<string, Uint8Array>> {
  const bytes = await toBytes(data);
  if (!isZip(bytes)) throw new Error(fileText.zip.notZip);
  // The directory first, then the files one after another with a turn for the page every few
  // milliseconds (RangeZip over the bytes): a pack of thousands of textures used to be inflated in
  // one task that held every tap for seconds.
  try {
    const archive = await openBytesZip(bytes);
    const wanted: ZipEntry[] = [];
    const paths = new Map<ZipEntry, string>();
    let expanded = 0;
    for (const e of archive.entries) {
      const p = normalizeZipPath(e.name);
      if (!p || (filter && !filter(p))) continue;
      expanded += e.size;
      if (expanded > MAX_UNZIPPED_BYTES) throw new Error(fileText.zip.tooLarge);
      wanted.push(e);
      paths.set(e, p);
    }
    const read = await archive.readMany(wanted);
    const out: Record<string, Uint8Array> = {};
    for (const e of wanted) out[paths.get(e)!] = read.get(e.name)!;
    return out;
  } catch (err) {
    // the reader's own errors are written for the visitor; anything else is a damaged archive
    throw err instanceof Error && !(err instanceof TypeError || err instanceof RangeError) ? err : zipError(err);
  }
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
