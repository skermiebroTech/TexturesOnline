// Pack Doctor: opens what the visitor dropped (a .zip / .mcpack / .mcaddon, or a folder) without
// hiding anything: unlike the pack reader of the texture tool, it keeps the raw entry names
// (backslashes, Mac junk), the compression method of every entry, ZIP64 and damaged entries, so
// each can be reported. Uses the streaming range reader (core/rangezip): the central directory is
// read first, then the entries in a few large slices, yielding to the page as it goes.

import { BlobSource, MemorySource, RangeZip, parseEocd, type ByteSource } from '../../core/rangezip';
import { isZip } from '../../core/zip';
import { abortError, isAbortError } from '../../core/net';
import type { ProgressFn } from '../../core/types';
import type { PackArchive, RawEntry } from './types';

/** Mac resource forks and Finder / Explorer files. */
const JUNK = /(^|\/)(__MACOSX(\/|$)|\._[^/]*$|\.DS_Store$|Thumbs\.db$|desktop\.ini$)/i;
/** Refuse what would expand to more than this (same limit as the pack reader). */
const MAX_TOTAL = 1024 * 1024 * 1024;

export interface OpenOptions {
  signal?: AbortSignal;
  onProgress?: ProgressFn;
  /** Text for the progress bar */
  label?: string;
}

/** What the first bytes say a non-zip file is. */
export function sniffArchive(head: Uint8Array): 'zip' | 'rar' | '7z' | 'other' {
  if (isZip(head)) return 'zip';
  if (head.length >= 4 && head[0] === 0x52 && head[1] === 0x61 && head[2] === 0x72 && head[3] === 0x21) return 'rar';
  if (head.length >= 4 && head[0] === 0x37 && head[1] === 0x7a && head[2] === 0xbc && head[3] === 0xaf) return '7z';
  return 'other';
}

/** Normalised path of an entry name: forward slashes, no leading ./ or /. '' for folders and unsafe names. */
export function entryPath(name: string): string {
  let p = name.replace(/\\/g, '/');
  while (p.startsWith('./')) p = p.slice(2);
  p = p.replace(/^\/+/, '').replace(/\/{2,}/g, '/');
  if (!p || p.endsWith('/')) return '';
  if (p.split('/').some((s) => s === '..')) return '';
  return p;
}

export function isJunk(path: string): boolean {
  return JUNK.test(path);
}

function emptyArchive(fileName: string, kind: PackArchive['kind']): PackArchive {
  return { fileName, kind, files: new Map(), entries: [], zip64: false, unreadable: [], junk: [], inner: new Map() };
}

/** Opens a zip (a dropped file, or a zip found inside another one). */
export async function openArchive(data: Blob | Uint8Array, fileName: string, opts: OpenOptions = {}, depth = 0): Promise<PackArchive & { notZip?: 'rar' | '7z' | 'other' }> {
  const out = emptyArchive(fileName, 'zip');
  const src: ByteSource = data instanceof Uint8Array ? new MemorySource(data) : new BlobSource(data);
  if (src.size < 4) return { ...out, damaged: true, notZip: 'other' };
  const kind = sniffArchive(await src.read(0, Math.min(8, src.size)));
  if (kind !== 'zip') return { ...out, damaged: true, notZip: kind };
  let zip: RangeZip;
  try {
    zip = await RangeZip.open(src, { signal: opts.signal });
  } catch (err) {
    if (isAbortError(err)) throw err;
    return { ...out, damaged: true };
  }
  try {
    const tailStart = Math.max(0, src.size - (22 + 0xffff));
    out.zip64 = parseEocd(await src.read(tailStart, src.size), tailStart).zip64;
  } catch {
    /* RangeZip found the record; a ZIP64 record outside the tail is still ZIP64 */
    out.zip64 = true;
  }
  const wanted = [];
  let total = 0;
  for (const e of zip.entries) {
    const path = entryPath(e.name);
    const raw: RawEntry = { name: e.name, path, method: e.method, flags: e.flags, size: e.size };
    out.entries.push(raw);
    if (!path) continue;
    if (isJunk(path)) {
      out.junk.push(path);
      continue;
    }
    if (e.flags & 1) out.unreadable.push({ path, reason: 'encrypted' });
    else if (e.method !== 0 && e.method !== 8) out.unreadable.push({ path, reason: 'method', method: e.method });
    else {
      total += e.size;
      if (total > MAX_TOTAL) return { ...out, damaged: true };
      wanted.push(e);
    }
  }
  let read: Map<string, Uint8Array>;
  try {
    read = await zip.readMany(wanted, { signal: opts.signal, onProgress: opts.onProgress, label: opts.label });
  } catch (err) {
    if (isAbortError(err) || opts.signal?.aborted) throw abortError();
    // A damaged entry fails the whole read: read one by one to find which.
    read = new Map();
    let n = 0;
    for (const e of wanted) {
      if (opts.signal?.aborted) throw abortError();
      try {
        read.set(e.name, await zip.read(e.name));
      } catch {
        out.unreadable.push({ path: entryPath(e.name), reason: 'damaged' });
      }
      if (++n % 200 === 0) await new Promise((r) => setTimeout(r, 0));
    }
  }
  for (const e of wanted) {
    const bytes = read.get(e.name);
    if (bytes) out.files.set(entryPath(e.name), bytes);
  }
  if (depth === 0) {
    for (const [path, bytes] of out.files) {
      if (!/\.(zip|mcpack|mcaddon)$/i.test(path) || path.split('/').length > 3 || !isZip(bytes)) continue;
      const inner = await openArchive(bytes, path.slice(path.lastIndexOf('/') + 1), { signal: opts.signal }, 1).catch((err) => {
        if (isAbortError(err)) throw err;
        return null;
      });
      if (inner && !inner.damaged) out.inner.set(path, inner);
    }
  }
  return out;
}

/** A dropped or chosen folder: files with their paths inside it. */
export async function openFolder(list: { path: string; file: Blob }[], folderName: string, opts: OpenOptions = {}): Promise<PackArchive> {
  const out = emptyArchive(folderName, 'folder');
  let total = 0;
  let last = Date.now();
  let done = 0;
  for (const { path: raw, file } of list) {
    if (opts.signal?.aborted) throw abortError();
    const path = entryPath(raw);
    if (!path) continue;
    if (isJunk(path)) {
      out.junk.push(path);
      continue;
    }
    total += file.size;
    if (total > MAX_TOTAL) return { ...out, damaged: true };
    try {
      out.files.set(path, new Uint8Array(await file.arrayBuffer()));
    } catch {
      out.unreadable.push({ path, reason: 'damaged' });
    }
    done++;
    if (Date.now() - last > 30) {
      opts.onProgress?.({ label: opts.label ?? '', fraction: done / list.length });
      await new Promise((r) => setTimeout(r, 0));
      last = Date.now();
    }
  }
  return out;
}

/** A clean archive around files already at the pack's top level (the fixed pack, checked again). */
export function archiveFromFiles(files: Map<string, Uint8Array>, fileName: string): PackArchive {
  const out = emptyArchive(fileName, 'zip');
  for (const [path, bytes] of files) {
    out.files.set(path, bytes);
    out.entries.push({ name: path, path, method: 8, flags: 0, size: bytes.length });
  }
  return out;
}
