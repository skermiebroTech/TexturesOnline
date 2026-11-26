import { deflate, deflateSync, strToU8 } from 'fflate';
import { openBytesZip, type ZipEntry } from './rangezip';
import type { FileMap } from './types';
import { fileText } from '../shared/i18n/files';
import { fmt } from '../i18n/editor-text';
import { timeSlicer } from './yield';

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

/** Refuse archives that would expand to more than this (zip bombs, or not a pack at all). */
export const MAX_UNZIPPED_BYTES = 1024 * 1024 * 1024;

/**
 * Reads a zip (.zip/.jar/.mcpack) into path -> bytes. Directory entries, __MACOSX and
 * path-traversal entries are skipped. `filter` receives the normalised path. The entries are
 * inflated a few at a time with turns for the page in between: a pack of thousands of files
 * doesn't freeze it.
 */
export async function readZip(data: ZipInput, filter?: (path: string) => boolean): Promise<Record<string, Uint8Array>> {
  const bytes = await toBytes(data);
  if (!isZip(bytes)) throw new Error(fileText.zip.notZip);
  try {
    const zip = await openBytesZip(bytes);
    const wanted: { entry: ZipEntry; path: string }[] = [];
    let expanded = 0;
    for (const entry of zip.entries) {
      const path = normalizeZipPath(entry.name);
      if (!path || (filter && !filter(path))) continue;
      expanded += entry.size;
      if (expanded > MAX_UNZIPPED_BYTES) throw new Error(fileText.zip.tooLarge);
      wanted.push({ entry, path });
    }
    const read = await zip.readMany(wanted.map((w) => w.entry));
    const out: Record<string, Uint8Array> = {};
    for (const { entry, path } of wanted) out[path] = read.get(entry.name)!;
    return out;
  } catch (err) {
    // the reader's own errors are worded for people (damaged, encrypted, unsupported method...);
    // anything else (a TypeError or RangeError from bytes that aren't what they claim) is a damaged archive
    throw err instanceof Error && !(err instanceof TypeError || err instanceof RangeError) ? err : zipError(err);
  }
}

export type ZipLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** One entry of a zip being written: a file, or a folder (a path ending in '/' with no bytes). */
export interface ZipItem {
  path: string;
  data: Uint8Array;
  /** 0 = stored; anything else is deflated at that level. */
  level: ZipLevel;
}

/** Files at least this big are deflated in a worker, smaller ones on this thread (fflate's own threshold). */
const WORKER_MIN = 160_000;
/** Bytes checksummed between checks of the time slicer. */
const CRC_PIECE = 256 * 1024;
/** Work between turns for the page while a zip is written. */
const ZIP_SLICE_MS = 10;
/** Bytes copied into each piece of the output Blob. */
const BLOB_PIECE = 512 * 1024;

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

/** Feeds bytes [start, end) of `d` into a running CRC-32 (start with -1, finish with `~c >>> 0`). */
function crcUpdate(c: number, d: Uint8Array, start: number, end: number): number {
  for (let i = start; i < end; i++) c = CRC_TABLE[(c ^ d[i]) & 255] ^ (c >>> 8);
  return c;
}

function deflateInWorker(data: Uint8Array, level: ZipLevel): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    try {
      deflate(data, { level }, (err, out) => (err ? reject(err) : resolve(out)));
    } catch {
      // no workers here: deflate on this thread
      try {
        resolve(deflateSync(data, { level }));
      } catch (err) {
        reject(err);
      }
    }
  });
}

/** MS-DOS date and time (local), as zip headers store them; years outside 1980–2107 are clamped. */
function dosDateTime(d: Date): number {
  const y = Math.min(127, Math.max(0, d.getFullYear() - 1980));
  return ((y << 25) | ((d.getMonth() + 1) << 21) | (d.getDate() << 16) | (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) >>> 0;
}

type PendingEntry = { name: Uint8Array; utf8: boolean; method: number; crc: number; size: number; data: Uint8Array | Promise<Uint8Array> };

/**
 * The fields a local file header and a central directory record share, from "version needed" on.
 * `b` is where they start: 4 in a local header, 6 in a central record.
 */
function writeCommon(v: DataView, b: number, e: PendingEntry, compressed: number, dos: number): void {
  v.setUint16(b, 20, true); // version needed: 2.0
  v.setUint16(b + 2, e.utf8 ? 0x800 : 0, true);
  v.setUint16(b + 4, e.method, true);
  v.setUint32(b + 6, dos, true);
  v.setUint32(b + 10, e.crc, true);
  v.setUint32(b + 14, compressed, true);
  v.setUint32(b + 18, e.size, true);
  v.setUint16(b + 22, e.name.length, true);
  // b + 24: extra field length, 0
}

/**
 * Writes a zip of `items`, in order, as Blob parts. The layout is fflate's `zip` / `zipSync` one byte
 * for byte (sizes and CRC in the local headers, no data descriptors, no extra fields, the UTF-8 flag
 * for non-ASCII names), but the work is spread over tasks: the page gets a turn about every 10 ms, so
 * a pack of thousands of files doesn't freeze it, and big files are deflated in a worker meanwhile.
 */
export async function zipParts(items: readonly ZipItem[], opts: { mtime?: Date } = {}): Promise<BlobPart[]> {
  const slice = timeSlicer(ZIP_SLICE_MS);
  const dos = dosDateTime(opts.mtime ?? new Date());
  const encoder = new TextEncoder();
  const entries: PendingEntry[] = [];
  for (const item of items) {
    const name = encoder.encode(item.path);
    if (name.length > 65535) throw zipError(new Error('filename too long'));
    const method = item.level === 0 ? 0 : 8;
    const bytes = item.data;
    let data: Uint8Array | Promise<Uint8Array> = bytes;
    if (method && bytes.length >= WORKER_MIN) {
      data = deflateInWorker(bytes, item.level);
      data.catch(() => {}); // awaited (and reported) below, after the other files
    } else if (method) data = deflateSync(bytes, { level: item.level });
    let crc = -1;
    for (let start = 0; start < bytes.length; start += CRC_PIECE) {
      crc = crcUpdate(crc, bytes, start, Math.min(bytes.length, start + CRC_PIECE));
      const turn = slice();
      if (turn) await turn;
    }
    entries.push({ name, utf8: name.length !== item.path.length, method, crc: ~crc >>> 0, size: bytes.length, data });
    const turn = slice();
    if (turn) await turn;
  }

  // The output is a Blob of Blobs of about BLOB_PIECE each: making a Blob copies its bytes, and one
  // Blob of a whole big pack would be one long copy. A Blob made of Blobs copies nothing.
  const blobs: Blob[] = [];
  let group: Uint8Array<ArrayBuffer>[] = [];
  let groupBytes = 0;
  const flush = () => {
    if (!group.length) return;
    blobs.push(new Blob(group));
    group = [];
    groupBytes = 0;
  };
  /** Queues bytes for the output, in pieces of at most BLOB_PIECE, with turns for the page in between. */
  const add = async (bytes: Uint8Array) => {
    for (let i = 0; i < bytes.length; i += BLOB_PIECE) {
      const piece = bytes.length <= BLOB_PIECE ? bytes : bytes.subarray(i, i + BLOB_PIECE);
      group.push(piece as Uint8Array<ArrayBuffer>);
      groupBytes += piece.length;
      if (groupBytes < BLOB_PIECE && group.length < 1024) continue;
      flush();
      const turn = slice();
      if (turn) await turn;
    }
  };

  const offsets: number[] = [];
  const sizes: number[] = [];
  let offset = 0;
  let central = 0;
  for (const e of entries) {
    let data: Uint8Array;
    try {
      data = e.data instanceof Uint8Array ? e.data : await e.data;
    } catch (err) {
      throw zipError(err);
    }
    const head = new Uint8Array(30 + e.name.length);
    const view = new DataView(head.buffer);
    view.setUint32(0, 0x04034b50, true);
    writeCommon(view, 4, e, data.length, dos);
    head.set(e.name, 30);
    // (awaiting only when there is something to wait for: thousands of awaits add up)
    if (groupBytes + head.length + data.length < BLOB_PIECE && group.length + 2 < 1024) {
      group.push(head, data as Uint8Array<ArrayBuffer>);
      groupBytes += head.length + data.length;
    } else {
      await add(head);
      await add(data);
    }
    offsets.push(offset);
    sizes.push(data.length);
    offset += head.length + data.length;
    central += 46 + e.name.length;
  }

  const cd = new Uint8Array(central + 22);
  const view = new DataView(cd.buffer);
  let at = 0;
  entries.forEach((e, i) => {
    view.setUint32(at, 0x02014b50, true);
    view.setUint8(at + 4, 20); // made by: 2.0, MS-DOS (no attributes), as fflate writes it
    writeCommon(view, at + 6, e, sizes[i], dos);
    // at + 32 comment length, + 34 disk, + 36 internal and + 38 external attributes: all 0
    view.setUint32(at + 42, offsets[i], true);
    cd.set(e.name, at + 46);
    at += 46 + e.name.length;
  });
  view.setUint32(at, 0x06054b50, true);
  view.setUint16(at + 8, entries.length, true);
  view.setUint16(at + 10, entries.length, true);
  view.setUint32(at + 12, central, true);
  view.setUint32(at + 16, offset, true);
  await add(cd);
  await flush();
  return blobs;
}

/** Builds a zip Blob from a FileMap. PNG and other compressed data is stored, text is deflated. */
export async function writeZip(files: FileMap, opts: { level?: ZipLevel; mimeType?: string; mtime?: Date } = {}): Promise<Blob> {
  const items: ZipItem[] = [];
  const slice = timeSlicer(ZIP_SLICE_MS);
  for (const [rawPath, value] of Object.entries(files)) {
    const path = normalizeZipPath(rawPath);
    if (!path) continue;
    let bytes: Uint8Array;
    if (typeof value === 'string') bytes = strToU8(value);
    else if (value instanceof Uint8Array) bytes = value;
    else bytes = new Uint8Array(await value.arrayBuffer());
    items.push({ path, data: bytes, level: STORED_EXT.test(path) ? 0 : (opts.level ?? 6) });
    const turn = slice();
    if (turn) await turn;
  }
  return new Blob(await zipParts(items, { mtime: opts.mtime }), { type: opts.mimeType ?? 'application/zip' });
}
