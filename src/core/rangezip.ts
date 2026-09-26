import { inflateSync } from 'fflate';
import type { ProgressFn } from './types';
import { NetError, abortError, fetchResponse, hostOf, readBodyWithProgress, throwIfAborted, withRetry, createLimiter } from './net';

/*
 * Random-access zip reader over HTTP Range requests (or a local Blob / bytes).
 * EOCD -> central directory -> coalesced byte ranges -> raw DEFLATE inflate.
 * Only the CORS-safelisted `Range` header is sent (Mojang's CDN answers preflights with 403).
 */

export interface ZipEntry {
  name: string;
  /** 0 = stored, 8 = deflate */
  method: number;
  flags: number;
  crc32: number;
  compressedSize: number;
  size: number;
  /** Offset of the local file header */
  offset: number;
  /** Extra-field length in the central directory (local one may differ) */
  extraLength: number;
}

export interface ReadOptions {
  signal?: AbortSignal;
  onProgress?: ProgressFn;
  label?: string;
}

export interface ByteSource {
  readonly size: number;
  readonly kind: 'http' | 'blob' | 'memory';
  /** Bytes [start, end). */
  read(start: number, end: number, opts?: ReadOptions): Promise<Uint8Array>;
  /** Set when the whole file ended up in memory (e.g. the server ignored Range). */
  readonly full?: Uint8Array;
}

export class MemorySource implements ByteSource {
  readonly kind = 'memory' as const;
  readonly size: number;
  constructor(readonly full: Uint8Array) {
    this.size = full.length;
  }
  async read(start: number, end: number): Promise<Uint8Array> {
    return this.full.subarray(Math.max(0, start), Math.min(this.size, end));
  }
}

export class BlobSource implements ByteSource {
  readonly kind = 'blob' as const;
  readonly size: number;
  constructor(readonly blob: Blob) {
    this.size = blob.size;
  }
  async read(start: number, end: number, opts?: ReadOptions): Promise<Uint8Array> {
    throwIfAborted(opts?.signal);
    try {
      return new Uint8Array(await this.blob.slice(Math.max(0, start), Math.min(this.size, end)).arrayBuffer());
    } catch {
      throw new Error("The file couldn't be read. It may have been moved or deleted; pick it again.");
    }
  }
}

/**
 * HTTP source using `Range: bytes=a-b`. The file size must be known up front (e.g. from Mojang's
 * version JSON) because suffix ranges are not CORS-safelisted. A 200 reply (full body, e.g. from
 * the HTTP cache or a server without range support) is streamed with progress and kept in memory.
 */
export class HttpRangeSource implements ByteSource {
  readonly kind = 'http' as const;
  full?: Uint8Array;
  requests = 0;
  bytesFetched = 0;
  /** A full-body (200) download in progress: parallel reads wait for it instead of downloading the file again. */
  private fullLoad: Promise<Uint8Array> | null = null;
  constructor(readonly url: string, readonly size: number, private readonly fullLabel = 'Downloading') {
    if (!(size > 0)) throw new Error('The file size must be known for range reads.');
  }

  private fullSlice(start: number, end: number): Uint8Array | undefined {
    return this.full?.subarray(start, end);
  }

  private async waitForFull(start: number, end: number, signal?: AbortSignal): Promise<Uint8Array | null> {
    const pending = this.fullLoad;
    if (!pending) return null;
    throwIfAborted(signal);
    let onAbort: (() => void) | undefined;
    try {
      const full = await Promise.race([
        pending.catch(() => null),
        new Promise<never>((_, reject) => {
          onAbort = () => reject(abortError());
          signal?.addEventListener('abort', onAbort, { once: true });
        }),
      ]);
      return full ? full.subarray(start, end) : null;
    } finally {
      if (onAbort) signal?.removeEventListener('abort', onAbort);
    }
  }

  async read(start: number, end: number, opts: ReadOptions = {}): Promise<Uint8Array> {
    start = Math.max(0, start);
    end = Math.min(this.size, end);
    if (end <= start) return new Uint8Array(0);
    if (this.full) return this.full.subarray(start, end);
    return withRetry(
      async () => {
        if (this.full) return this.full.subarray(start, end);
        const shared = await this.waitForFull(start, end, opts.signal);
        if (shared) return shared;
        const resp = await fetchResponse(this.url, {
          signal: opts.signal,
          headers: { Range: `bytes=${start}-${end - 1}` },
          // Chromium's cache turns a second range request for a partially cached URL into an
          // If-Range revalidation that the CDN answers with the full 40 MB body. We cache in IDB anyway.
          cache: 'no-store',
          timeoutMs: 60_000,
        });
        this.requests++;
        if (resp.status === 200) {
          if (this.full || this.fullLoad) {
            // Another read is already receiving the whole file: drop this copy and share that one.
            resp.body?.cancel().catch(() => {});
            const again = this.fullSlice(start, end) ?? (await this.waitForFull(start, end, opts.signal));
            if (again) return again;
            throw new NetError('network', this.url, `The download from ${hostOf(this.url)} was interrupted. Try again.`);
          }
          const load = readBodyWithProgress(resp, {
            onProgress: opts.onProgress,
            label: this.fullLabel,
            expectedSize: this.size,
            signal: opts.signal,
            url: this.url,
          }).then((body) => {
            if (body.length !== this.size) throw new NetError('bad-data', this.url, 'The download was incomplete. Try again.');
            this.bytesFetched += body.length;
            this.full = body;
            return body as Uint8Array;
          });
          this.fullLoad = load;
          try {
            return (await load).subarray(start, end);
          } finally {
            if (this.fullLoad === load) this.fullLoad = null;
          }
        }
        if (resp.status !== 206) throw new NetError('http', this.url, `Unexpected reply (HTTP ${resp.status}) to a range request.`, resp.status);
        const want = end - start;
        // Small ranges skip progress reports; the reader still turns dropped connections into retryable errors.
        const body = await readBodyWithProgress(resp, {
          onProgress: want > 256 * 1024 ? opts.onProgress : undefined,
          label: opts.label,
          expectedSize: want,
          signal: opts.signal,
          url: this.url,
        });
        if (body.length !== want) throw new NetError('bad-data', this.url, `Range reply had ${body.length} bytes, expected ${want}.`);
        this.bytesFetched += body.length;
        return body;
      },
      { retries: 2, signal: opts.signal },
    );
  }
}

// ---- Parsing ----

const SIG_EOCD = 0x06054b50;
const SIG_EOCD64 = 0x06064b50;
const SIG_EOCD64_LOC = 0x07064b50;
const SIG_CD = 0x02014b50;
const SIG_LOCAL = 0x04034b50;
const MAX_TAIL = 22 + 0xffff;

const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
const u64 = (b: Uint8Array, o: number) => u32(b, o) + u32(b, o + 4) * 0x100000000;

export interface EocdInfo {
  count: number;
  cdOffset: number;
  cdSize: number;
  /** Absolute offset of the EOCD record */
  eocdOffset: number;
  zip64: boolean;
}

/** Finds and parses the end-of-central-directory record in the last bytes of a file. */
export function parseEocd(tail: Uint8Array, tailStart: number, readAt?: (abs: number, len: number) => Uint8Array | null): EocdInfo {
  let p = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tail[i] === 0x50 && tail[i + 1] === 0x4b && u32(tail, i) === SIG_EOCD) {
      p = i;
      break;
    }
  }
  if (p < 0) throw new Error("This isn't a valid zip/jar file (no end-of-archive record).");
  let count = u16(tail, p + 10);
  let cdSize = u32(tail, p + 12);
  let cdOffset = u32(tail, p + 16);
  let zip64 = false;
  if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    const loc = p - 20;
    if (loc >= 0 && u32(tail, loc) === SIG_EOCD64_LOC) {
      const recAbs = u64(tail, loc + 8);
      const rec = recAbs >= tailStart && recAbs + 56 <= tailStart + tail.length ? tail.subarray(recAbs - tailStart, recAbs - tailStart + 56) : readAt?.(recAbs, 56) ?? null;
      if (!rec || u32(rec, 0) !== SIG_EOCD64) throw new Error('Unsupported ZIP64 archive layout.');
      count = u64(rec, 32);
      cdSize = u64(rec, 40);
      cdOffset = u64(rec, 48);
      zip64 = true;
    }
  }
  return { count, cdOffset, cdSize, eocdOffset: tailStart + p, zip64 };
}

const utf8 = new TextDecoder('utf-8');

/** Parses central directory records. `shift` corrects archives with prepended data. */
export function parseCentralDirectory(cd: Uint8Array, shift = 0): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let p = 0;
  while (p + 46 <= cd.length && u32(cd, p) === SIG_CD) {
    const flags = u16(cd, p + 8);
    const method = u16(cd, p + 10);
    const crc32 = u32(cd, p + 16);
    let compressedSize = u32(cd, p + 20);
    let size = u32(cd, p + 24);
    const nameLen = u16(cd, p + 28);
    const extraLen = u16(cd, p + 30);
    const commentLen = u16(cd, p + 32);
    let offset = u32(cd, p + 42);
    const name = utf8.decode(cd.subarray(p + 46, p + 46 + nameLen));
    if (size === 0xffffffff || compressedSize === 0xffffffff || offset === 0xffffffff) {
      let e = p + 46 + nameLen;
      const eEnd = e + extraLen;
      while (e + 4 <= eEnd) {
        const id = u16(cd, e);
        const len = u16(cd, e + 2);
        if (id === 0x0001) {
          let q = e + 4;
          if (size === 0xffffffff) { size = u64(cd, q); q += 8; }
          if (compressedSize === 0xffffffff) { compressedSize = u64(cd, q); q += 8; }
          if (offset === 0xffffffff) { offset = u64(cd, q); q += 8; }
          break;
        }
        e += 4 + len;
      }
    }
    entries.push({ name, method, flags, crc32, compressedSize, size, offset: offset + shift, extraLength: extraLen });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

export interface ByteRange {
  start: number;
  end: number;
  entries: ZipEntry[];
}

/** Local header + name + (CD) extra + data, plus slack for a longer local extra field. */
const LOCAL_SLACK = 128;
const encoder = new TextEncoder();
function entrySpan(e: ZipEntry): [number, number] {
  const nameBytes = encoder.encode(e.name).length;
  return [e.offset, e.offset + 30 + nameBytes + e.extraLength + e.compressedSize + LOCAL_SLACK];
}

/**
 * Groups entries into as few byte ranges as reasonable: neighbours closer than maxGap are
 * merged, then the closest ranges are merged until at most maxRequests remain.
 */
export function planRanges(entries: ZipEntry[], opts: { maxGap?: number; maxRequests?: number; limit?: number } = {}): ByteRange[] {
  const maxGap = opts.maxGap ?? 512 * 1024;
  const maxRequests = Math.max(1, opts.maxRequests ?? 16);
  const sorted = [...entries].sort((a, b) => a.offset - b.offset);
  const ranges: ByteRange[] = [];
  for (const e of sorted) {
    const [s, rawEnd] = entrySpan(e);
    const end = opts.limit ? Math.min(opts.limit, rawEnd) : rawEnd;
    const last = ranges[ranges.length - 1];
    if (last && s - last.end <= maxGap) {
      last.end = Math.max(last.end, end);
      last.entries.push(e);
    } else ranges.push({ start: s, end, entries: [e] });
  }
  while (ranges.length > maxRequests) {
    let best = 0;
    let bestGap = Infinity;
    for (let i = 0; i + 1 < ranges.length; i++) {
      const gap = ranges[i + 1].start - ranges[i].end;
      if (gap < bestGap) {
        bestGap = gap;
        best = i;
      }
    }
    const a = ranges[best];
    const b = ranges[best + 1];
    ranges.splice(best, 2, { start: a.start, end: Math.max(a.end, b.end), entries: a.entries.concat(b.entries) });
  }
  return ranges;
}

export function plannedBytes(ranges: ByteRange[]): number {
  return ranges.reduce((n, r) => n + (r.end - r.start), 0);
}

// ---- Inflate ----

const STREAM_MIN = 64 * 1024;
let streamSupported: boolean | null = null;

function hasDeflateRawStream(): boolean {
  if (streamSupported !== null) return streamSupported;
  try {
    new DecompressionStream('deflate-raw');
    streamSupported = true;
  } catch {
    streamSupported = false;
  }
  return streamSupported;
}

async function inflateWithStream(data: Uint8Array, size: number): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  const done = writer.write(data as Uint8Array<ArrayBuffer>).then(() => writer.close());
  done.catch(() => {});
  const reader = ds.readable.getReader();
  const out = new Uint8Array(size);
  let off = 0;
  for (;;) {
    const { done: end, value } = await reader.read();
    if (end) break;
    if (off + value.length > size) throw new Error('Inflated data is larger than expected.');
    out.set(value, off);
    off += value.length;
  }
  await done;
  if (off !== size) throw new Error('Inflated data is smaller than expected.');
  return out;
}

/**
 * Inflates raw DEFLATE data of known size. Large payloads go through the native
 * DecompressionStream('deflate-raw'); small ones (and any stream failure) use fflate,
 * which is much faster than setting up a stream per tiny file.
 */
export async function inflateRaw(data: Uint8Array, size: number): Promise<Uint8Array> {
  if (size >= STREAM_MIN && hasDeflateRawStream()) {
    try {
      return await inflateWithStream(data, size);
    } catch {
      /* fall through to fflate */
    }
  }
  return inflateRawSync(data, size);
}

export function inflateRawSync(data: Uint8Array, size: number): Uint8Array {
  const out = inflateSync(data, { out: new Uint8Array(size) });
  if (out.length !== size) throw new Error('A file inside the archive is damaged.');
  return out;
}

// ---- Reader ----

export interface ReadManyOptions extends ReadOptions {
  maxGap?: number;
  maxRequests?: number;
  concurrency?: number;
}

const yieldToEventLoop = () => new Promise<void>((r) => setTimeout(r, 0));

export class RangeZip {
  private readonly byName = new Map<string, ZipEntry>();
  /** Offset where file data ends (start of the central directory). */
  readonly dataEnd: number;

  constructor(readonly source: ByteSource, readonly entries: ZipEntry[], dataEnd?: number) {
    for (const e of entries) this.byName.set(e.name, e);
    this.dataEnd = dataEnd ?? source.size;
  }

  /** Reads the EOCD and central directory. */
  static async open(source: ByteSource, opts: ReadOptions = {}): Promise<RangeZip> {
    const size = source.size;
    if (size < 22) throw new Error("This isn't a valid zip/jar file (too small).");
    const tailStart = Math.max(0, size - MAX_TAIL);
    const tail = await source.read(tailStart, size, { signal: opts.signal, onProgress: opts.onProgress });
    const extra = new Map<number, Uint8Array>();
    let eocd: EocdInfo;
    try {
      eocd = parseEocd(tail, tailStart, (abs, len) => extra.get(abs)?.subarray(0, len) ?? null);
    } catch (err) {
      // A ZIP64 record outside the tail: fetch it and retry once.
      const loc = findZip64Locator(tail);
      if (loc === null) throw err;
      extra.set(loc, await source.read(loc, loc + 56, { signal: opts.signal }));
      eocd = parseEocd(tail, tailStart, (abs, len) => extra.get(abs)?.subarray(0, len) ?? null);
    }
    let { cdOffset } = eocd;
    const { cdSize } = eocd;
    // Data prepended to the archive shifts every stored offset.
    let shift = 0;
    if (!eocd.zip64) {
      const expected = eocd.eocdOffset - cdSize;
      if (expected > cdOffset) {
        shift = expected - cdOffset;
        cdOffset = expected;
      }
    }
    if (cdOffset + cdSize > size) throw new Error('This zip/jar file is truncated or damaged.');
    let cd: Uint8Array;
    if (cdOffset >= tailStart) cd = tail.subarray(cdOffset - tailStart, cdOffset - tailStart + cdSize);
    else {
      const before = await source.read(cdOffset, Math.min(tailStart, cdOffset + cdSize), opts);
      cd = cdOffset + cdSize <= tailStart ? before : concat(before, tail.subarray(0, cdOffset + cdSize - tailStart));
    }
    const entries = parseCentralDirectory(cd, shift);
    if (!entries.length && eocd.count) throw new Error('The zip directory could not be read.');
    return new RangeZip(source, entries, cdOffset);
  }

  get(name: string): ZipEntry | undefined {
    return this.byName.get(name);
  }

  has(name: string): boolean {
    return this.byName.has(name);
  }

  names(): string[] {
    return this.entries.map((e) => e.name);
  }

  /** Reads and inflates the given entries with as few requests as possible. */
  async readMany(which: (string | ZipEntry)[], opts: ReadManyOptions = {}): Promise<Map<string, Uint8Array>> {
    const wanted: ZipEntry[] = [];
    for (const w of which) {
      const e = typeof w === 'string' ? this.byName.get(w) : w;
      if (!e) throw new Error(`${typeof w === 'string' ? w : w.name} is not in the archive.`);
      if (!e.name.endsWith('/')) wanted.push(e);
    }
    const out = new Map<string, Uint8Array>();
    if (!wanted.length) return out;
    const source = this.source;
    const ranges = planRanges(wanted, { maxGap: opts.maxGap, maxRequests: opts.maxRequests, limit: this.dataEnd });
    const total = plannedBytes(ranges);
    let loaded = 0;
    const label = opts.label ?? 'Downloading';
    const report = () => opts.onProgress?.({ label, fraction: total ? Math.min(1, loaded / total) : null, loaded, total });
    report();
    const limit = createLimiter(source.kind === 'http' ? (opts.concurrency ?? 4) : 1);
    let processed = 0;

    const handleRange = async (r: ByteRange) => {
      let rangeLoaded = 0;
      const buf = await source.read(r.start, r.end, {
        signal: opts.signal,
        label,
        onProgress: (p) => {
          // A full-body reply reports against the whole file: pass it through as is.
          if (p.total && p.total !== r.end - r.start) {
            opts.onProgress?.({ label: p.label, fraction: p.fraction, loaded: p.loaded, total: p.total });
            return;
          }
          const now = p.loaded ?? 0;
          loaded += now - rangeLoaded;
          rangeLoaded = now;
          report();
        },
      });
      loaded += r.end - r.start - rangeLoaded;
      report();
      for (const e of r.entries) {
        throwIfAborted(opts.signal);
        out.set(e.name, await this.extract(e, buf, r.start, opts.signal));
        if (++processed % 250 === 0) await yieldToEventLoop();
      }
    };
    await Promise.all(ranges.map((r) => limit(() => handleRange(r))));
    if (opts.signal?.aborted) throw abortError();
    return out;
  }

  async read(name: string, opts: ReadOptions = {}): Promise<Uint8Array> {
    const m = await this.readMany([name], opts);
    const v = m.get(name);
    if (!v) throw new Error(`${name} is not in the archive.`);
    return v;
  }

  private async extract(e: ZipEntry, buf: Uint8Array, bufStart: number, signal?: AbortSignal): Promise<Uint8Array> {
    if (e.flags & 1) throw new Error(`${e.name} is encrypted and can't be read.`);
    if (e.method !== 0 && e.method !== 8) throw new Error(`${e.name} uses an unsupported compression method (${e.method}).`);
    let rel = e.offset - bufStart;
    let local = buf;
    if (rel < 0 || rel + 30 > local.length) {
      local = await this.source.read(e.offset, e.offset + 30 + 1024, { signal });
      rel = 0;
    }
    if (u32(local, rel) !== SIG_LOCAL) throw new Error(`The archive is damaged near ${e.name}.`);
    const dataStart = rel + 30 + u16(local, rel + 26) + u16(local, rel + 28);
    let comp: Uint8Array;
    if (dataStart + e.compressedSize <= local.length) comp = local.subarray(dataStart, dataStart + e.compressedSize);
    else {
      const abs = (local === buf ? bufStart : e.offset) + dataStart;
      comp = await this.source.read(abs, abs + e.compressedSize, { signal });
      if (comp.length !== e.compressedSize) throw new Error(`The archive is truncated near ${e.name}.`);
    }
    if (e.method === 0) {
      if (e.compressedSize !== e.size) throw new Error(`The archive is damaged near ${e.name}.`);
      return comp.slice();
    }
    try {
      return await inflateRaw(comp, e.size);
    } catch {
      throw new Error(`${e.name} inside the archive is damaged.`);
    }
  }
}

function findZip64Locator(tail: Uint8Array): number | null {
  for (let i = tail.length - 22; i >= 20; i--) {
    if (u32(tail, i) === SIG_EOCD && u32(tail, i - 20) === SIG_EOCD64_LOC) return u64(tail, i - 12);
  }
  return null;
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/** Convenience: open a remote zip of known size via Range requests. */
export function openHttpZip(url: string, size: number, opts: ReadOptions & { fullLabel?: string } = {}): Promise<RangeZip> {
  return RangeZip.open(new HttpRangeSource(url, size, opts.fullLabel), opts);
}

export function openBlobZip(blob: Blob, opts: ReadOptions = {}): Promise<RangeZip> {
  return RangeZip.open(new BlobSource(blob), opts);
}

export function openBytesZip(bytes: Uint8Array, opts: ReadOptions = {}): Promise<RangeZip> {
  return RangeZip.open(new MemorySource(bytes), opts);
}
