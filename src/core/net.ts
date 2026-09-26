import type { Progress, ProgressFn } from './types';

export type NetErrorKind =
  | 'offline'
  | 'network'
  | 'not-found'
  | 'forbidden'
  | 'rate-limited'
  | 'http'
  | 'timeout'
  | 'aborted'
  | 'bad-data';

/** Network failure with a message that can be shown to users as-is. */
export class NetError extends Error {
  readonly kind: NetErrorKind;
  readonly url: string;
  readonly status?: number;
  constructor(kind: NetErrorKind, url: string, message: string, status?: number, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'NetError';
    this.kind = kind;
    this.url = url;
    this.status = status;
  }
  /** Worth retrying automatically. */
  get retryable(): boolean {
    return this.kind === 'network' || this.kind === 'timeout' || this.kind === 'rate-limited' ||
      (this.kind === 'http' && (this.status ?? 0) >= 500);
  }
}

export interface FetchOptions {
  signal?: AbortSignal;
  /** Only CORS-safelisted headers (e.g. Range) should be used for Mojang hosts. */
  headers?: Record<string, string>;
  /** Per-attempt timeout for the response headers; 0 disables. Default 30 s (60 s for progress downloads). */
  timeoutMs?: number;
  /** Extra attempts after the first for transient failures. */
  retries?: number;
  cache?: RequestCache;
  /** Human readable progress label */
  label?: string;
  onProgress?: ProgressFn;
  /** Size to use for progress when Content-Length is missing */
  expectedSize?: number;
}

export function hostOf(url: string): string {
  try {
    return new URL(url, 'http://localhost/').host || url;
  } catch {
    return url;
  }
}

function isOffline(): boolean {
  const nav = (globalThis as { navigator?: { onLine?: boolean } }).navigator;
  return !!nav && nav.onLine === false;
}

export function isAbortError(err: unknown): boolean {
  if (err instanceof NetError) return err.kind === 'aborted';
  return !!err && typeof err === 'object' && (err as { name?: string }).name === 'AbortError';
}

export function abortError(): Error {
  const e = new Error('The operation was cancelled.');
  e.name = 'AbortError';
  return e;
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(abortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Combines an optional caller signal with a timeout for the response headers. The caller's
 * signal stays linked after the headers arrive so aborting also stops reading the body.
 */
function linkedSignal(signal: AbortSignal | undefined, timeoutMs: number): { signal?: AbortSignal; headersDone(): void; failed(): void; timedOut(): boolean } {
  if (!timeoutMs) return { signal, headersDone() {}, failed() {}, timedOut: () => false };
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, timeoutMs);
  const onAbort = () => ctrl.abort();
  if (signal) {
    if (signal.aborted) ctrl.abort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  return {
    signal: ctrl.signal,
    headersDone() {
      clearTimeout(timer);
    },
    failed() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    },
    timedOut: () => timedOut,
  };
}

function httpError(url: string, status: number, statusText: string): NetError {
  const host = hostOf(url);
  if (status === 404 || status === 410)
    return new NetError('not-found', url, `The file wasn't found on ${host} (HTTP ${status}).`, status);
  if (status === 429)
    return new NetError('rate-limited', url, `${host} is limiting requests right now. Wait a minute and try again.`, status);
  if (status === 401 || status === 403)
    return new NetError('forbidden', url, `${host} refused the request (HTTP ${status}).`, status);
  return new NetError('http', url, `${host} returned an error (HTTP ${status}${statusText ? ' ' + statusText : ''}). Try again in a moment.`, status);
}

function wrapFetchError(url: string, err: unknown, timedOut: boolean, signal?: AbortSignal): unknown {
  if (err instanceof NetError) return err;
  if (timedOut) return new NetError('timeout', url, `The request to ${hostOf(url)} timed out. Check your connection and try again.`, undefined, err);
  if (signal?.aborted || isAbortError(err)) return abortError();
  if (isOffline())
    return new NetError('offline', url, 'You appear to be offline. Check your internet connection and try again.', undefined, err);
  return new NetError(
    'network',
    url,
    `Couldn't reach ${hostOf(url)}. The server may be down, or a firewall or browser extension may be blocking it.`,
    undefined,
    err,
  );
}

function retryAfterMs(resp: Response | undefined): number | null {
  const h = resp?.headers.get('retry-after');
  if (!h) return null;
  const s = Number(h);
  if (Number.isFinite(s)) return Math.min(s * 1000, 20_000);
  const d = Date.parse(h);
  return Number.isFinite(d) ? Math.min(Math.max(0, d - Date.now()), 20_000) : null;
}

/**
 * Runs fn with retries and exponential backoff for transient network errors.
 * Aborts and non-retryable errors (404, 403, bad data) are rethrown immediately.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: { retries?: number; signal?: AbortSignal; baseDelayMs?: number } = {},
): Promise<T> {
  const retries = opts.retries ?? 2;
  const base = opts.baseDelayMs ?? 400;
  for (let attempt = 0; ; attempt++) {
    throwIfAborted(opts.signal);
    try {
      return await fn(attempt);
    } catch (err) {
      if (isAbortError(err)) throw err;
      const retryable = err instanceof NetError ? err.retryable : false;
      if (!retryable || attempt >= retries) throw err;
      const wait = (err as NetError & { retryAfter?: number }).retryAfter ?? base * 2 ** attempt + Math.random() * base;
      await sleep(wait, opts.signal);
    }
  }
}

/** Single fetch attempt returning an OK response or throwing a NetError. */
export async function fetchResponse(url: string, opts: FetchOptions = {}): Promise<Response> {
  throwIfAborted(opts.signal);
  const link = linkedSignal(opts.signal, opts.timeoutMs ?? 30_000);
  let resp: Response;
  try {
    resp = await fetch(url, { signal: link.signal, headers: opts.headers, cache: opts.cache, credentials: 'omit' });
  } catch (err) {
    link.failed();
    throw wrapFetchError(url, err, link.timedOut(), opts.signal);
  }
  link.headersDone();
  if (!resp.ok) {
    link.failed();
    const e = httpError(url, resp.status, resp.statusText) as NetError & { retryAfter?: number };
    const ra = retryAfterMs(resp);
    if (ra !== null) e.retryAfter = ra;
    try {
      await resp.body?.cancel();
    } catch {
      /* ignore */
    }
    throw e;
  }
  return resp;
}

function concatChunks(chunks: Uint8Array[], total: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

/** A stalled body (no bytes for this long) is treated as a timeout, which callers may retry. */
const BODY_IDLE_MS = 60_000;

/** Reads a response body while reporting progress. */
export async function readBodyWithProgress(
  resp: Response,
  opts: { onProgress?: ProgressFn; label?: string; expectedSize?: number; signal?: AbortSignal; url?: string; idleTimeoutMs?: number } = {},
): Promise<Uint8Array<ArrayBuffer>> {
  const label = opts.label ?? 'Downloading';
  const encoded = !!resp.headers.get('content-encoding') && resp.headers.get('content-encoding') !== 'identity';
  const len = Number(resp.headers.get('content-length'));
  const total = !encoded && Number.isFinite(len) && len > 0 ? len : opts.expectedSize && opts.expectedSize > 0 ? opts.expectedSize : 0;
  const onProgress = opts.onProgress;
  if (!resp.body) {
    const buf = new Uint8Array(await resp.arrayBuffer());
    onProgress?.({ label, fraction: 1, loaded: buf.length, total: buf.length });
    return buf;
  }
  const reader = resp.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  let lastReport = 0;
  onProgress?.({ label, fraction: total ? 0 : null, loaded: 0, total: total || undefined });
  const onAbort = () => {
    reader.cancel().catch(() => {});
  };
  opts.signal?.addEventListener('abort', onAbort, { once: true });
  const idleMs = opts.idleTimeoutMs ?? BODY_IDLE_MS;
  let stalled = false;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const armIdle = () => {
    if (!idleMs) return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      stalled = true;
      reader.cancel().catch(() => {});
    }, idleMs);
  };
  try {
    armIdle();
    for (;;) {
      const { done, value } = await reader.read();
      if (stalled) throw new Error('stalled');
      if (done) break;
      if (opts.signal?.aborted) throw abortError();
      armIdle();
      chunks.push(value);
      loaded += value.length;
      const now = Date.now();
      if (onProgress && now - lastReport > 60) {
        lastReport = now;
        onProgress({ label, fraction: total ? Math.min(1, loaded / total) : null, loaded, total: total || undefined });
      }
    }
  } catch (err) {
    if (opts.signal?.aborted) throw abortError();
    throw wrapFetchError(opts.url ?? resp.url, err, stalled, opts.signal);
  } finally {
    clearTimeout(idleTimer);
    opts.signal?.removeEventListener('abort', onAbort);
  }
  onProgress?.({ label, fraction: 1, loaded, total: loaded });
  return concatChunks(chunks, loaded);
}

/**
 * Downloads a URL to bytes, streaming the body to report progress. The timeout applies to the
 * response headers only (a stalled body times out separately); transient failures restart the download.
 */
export async function fetchWithProgress(url: string, opts: FetchOptions = {}): Promise<Uint8Array<ArrayBuffer>> {
  return withRetry(
    async () => {
      const resp = await fetchResponse(url, { ...opts, timeoutMs: opts.timeoutMs ?? 60_000 });
      return readBodyWithProgress(resp, { onProgress: opts.onProgress, label: opts.label, expectedSize: opts.expectedSize, signal: opts.signal, url });
    },
    { retries: opts.retries ?? 2, signal: opts.signal },
  );
}

export async function fetchBytes(url: string, opts: FetchOptions = {}): Promise<Uint8Array<ArrayBuffer>> {
  return withRetry(
    async () => {
      const resp = await fetchResponse(url, opts);
      // Streamed so a stalled body times out instead of holding a connection (and a limiter slot) forever.
      return readBodyWithProgress(resp, { signal: opts.signal, url, idleTimeoutMs: opts.timeoutMs ?? 30_000 });
    },
    { retries: opts.retries ?? 2, signal: opts.signal },
  );
}

export async function fetchText(url: string, opts: FetchOptions = {}): Promise<string> {
  const bytes = await fetchBytes(url, opts);
  return new TextDecoder().decode(bytes);
}

/** Fetches and parses JSON (retries with backoff; tolerant of a UTF-8 BOM). */
export async function fetchJson<T = unknown>(url: string, opts: FetchOptions = {}): Promise<T> {
  const text = await fetchText(url, opts);
  try {
    return JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text) as T;
  } catch (err) {
    throw new NetError('bad-data', url, `${hostOf(url)} sent data that couldn't be read. Try again later.`, undefined, err);
  }
}

/** Tries each URL in order (mirrors); rethrows the most useful error if all fail. Stops early on abort. */
export async function fetchFirst<T>(urls: string[], fn: (url: string) => Promise<T>): Promise<T> {
  let first: unknown;
  for (const url of urls) {
    try {
      return await fn(url);
    } catch (err) {
      if (isAbortError(err)) throw err;
      if (first === undefined || (first instanceof NetError && first.kind === 'network' && err instanceof NetError && err.kind !== 'network')) first = err;
    }
  }
  throw first ?? new Error('No URL to fetch');
}

/** Limits how many async tasks run at the same time. */
export function createLimiter(concurrency: number): <T>(task: () => Promise<T>) => Promise<T> {
  let active = 0;
  const queue: (() => void)[] = [];
  const next = () => {
    if (active >= concurrency) return;
    const run = queue.shift();
    if (run) run();
  };
  return <T>(task: () => Promise<T>) =>
    new Promise<T>((resolve, reject) => {
      queue.push(() => {
        active++;
        // new Promise(...) also turns a synchronous throw into a rejection, so the slot is always released.
        new Promise<T>((res) => res(task())).then(resolve, reject).finally(() => {
          active--;
          next();
        });
      });
      next();
    });
}

/** A user-facing message for any error thrown by the data layer. */
export function friendlyError(err: unknown, context?: string): string {
  let msg: string;
  if (isAbortError(err)) msg = 'Cancelled.';
  else if (err instanceof NetError) msg = err.message;
  else if (err instanceof Error && (err.name === 'QuotaExceededError' || /quota/i.test(err.message)))
    msg = 'Your browser is out of storage space for this site. Free some space (e.g. clear cached game files) and try again.';
  else if (err instanceof Error && err.message) msg = err.message;
  else msg = 'Something went wrong.';
  return context ? `${context}: ${msg}` : msg;
}

/** Fans one task's progress out to every caller waiting on it (late joiners get the latest state). */
export class ProgressHub {
  private readonly listeners = new Set<ProgressFn>();
  private last: Progress | null = null;

  add(fn?: ProgressFn): () => void {
    if (!fn) return () => {};
    this.listeners.add(fn);
    if (this.last) fn(this.last);
    return () => this.listeners.delete(fn);
  }

  readonly emit = (p: Progress): void => {
    this.last = p;
    for (const fn of this.listeners) {
      try {
        fn(p);
      } catch {
        /* a broken listener must not break the download */
      }
    }
  };
}

interface SharedRun<T> {
  promise: Promise<T>;
  hub: ProgressHub;
  ctrl: AbortController;
  /** Callers still waiting (callers without a signal never leave). */
  waiters: number;
}

/**
 * Deduplicates loads by key: concurrent callers share one promise and all receive progress;
 * finished results are reused; failed loads are forgotten so they can be retried.
 * Each caller may pass its own AbortSignal: aborting rejects only that caller, and the shared
 * work is cancelled once every caller has gone.
 */
export class SharedLoader<T> {
  private readonly running = new Map<string, SharedRun<T>>();
  private readonly done = new Map<string, Promise<T>>();

  load(
    key: string,
    onProgress: ProgressFn | undefined,
    start: (emit: ProgressFn, signal: AbortSignal) => Promise<T>,
    opts: { fresh?: boolean; signal?: AbortSignal } = {},
  ): Promise<T> {
    if (opts.signal?.aborted) return Promise.reject(abortError());
    if (!opts.fresh) {
      const hit = this.done.get(key);
      if (hit) return hit;
    }
    let run = opts.fresh ? undefined : this.running.get(key);
    if (!run) {
      const hub = new ProgressHub();
      const ctrl = new AbortController();
      const promise = new Promise<T>((res) => res(start(hub.emit, ctrl.signal)));
      const entry: SharedRun<T> = { promise, hub, ctrl, waiters: 0 };
      this.running.set(key, entry);
      promise.then(
        () => {
          if (this.running.get(key) === entry) {
            this.running.delete(key);
            this.done.set(key, promise);
          }
        },
        () => {
          if (this.running.get(key) === entry) this.running.delete(key);
        },
      );
      run = entry;
    }
    return this.join(key, run, onProgress, opts.signal);
  }

  private join(key: string, run: SharedRun<T>, onProgress: ProgressFn | undefined, signal: AbortSignal | undefined): Promise<T> {
    run.waiters++;
    const off = run.hub.add(onProgress);
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const finish = () => {
        settled = true;
        off();
        signal?.removeEventListener('abort', onAbort);
      };
      const onAbort = () => {
        if (settled) return;
        finish();
        if (--run.waiters <= 0) {
          // Nobody wants the result any more: stop the work and let the next caller start afresh.
          if (this.running.get(key) === run) this.running.delete(key);
          run.ctrl.abort();
        }
        reject(abortError());
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      run.promise.then(
        (v) => {
          if (settled) return;
          finish();
          resolve(v);
        },
        (err) => {
          if (settled) return;
          finish();
          reject(err);
        },
      );
    });
  }

  /** The finished or in-flight result for key, if any. */
  peek(key: string): Promise<T> | undefined {
    return this.done.get(key) ?? this.running.get(key)?.promise;
  }

  forget(key: string): void {
    this.done.delete(key);
    this.running.delete(key);
  }

  clear(): void {
    this.done.clear();
    this.running.clear();
  }
}
