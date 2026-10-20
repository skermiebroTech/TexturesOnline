// The service worker's decisions as pure functions (no Cache API, no fetch), shared by the worker
// (src/pwa/sw.ts), the build step that writes its precache list (src/pwa/build.ts) and the unit
// tests. Every path is relative to the worker's scope, which is the site root: "/" on
// texturepackmaker.com, "/TexturesOnline/" on a GitHub Pages project site.
// No imports: this module is bundled into the worker on its own.

/** Cache names start with this; anything else under the origin is left alone. */
export const CACHE_PREFIX = 'tpm-';
/** Build files cached when the worker installs (one cache per build: `tpm-precache-<version>`). */
export const PRECACHE_PREFIX = `${CACHE_PREFIX}precache-`;
/** Pages fetched while browsing (network first, so a deploy shows up on the next visit). */
export const PAGES_CACHE = `${CACHE_PREFIX}pages`;
/** Same-site files that are not in the precache (screenshots, data files, older hashed assets). */
export const RUNTIME_CACHE = `${CACHE_PREFIX}runtime`;
/** Files shared to the installed app, waiting for the page to pick them up. */
export const SHARE_CACHE = `${CACHE_PREFIX}share`;
/** Route that receives the Web Share Target POST (manifest share_target.action). */
export const SHARE_TARGET_PATH = 'share-target/';
/** Query parameter the page gets after a share ("?share-target=<id>"). */
export const SHARE_PARAM = 'share-target';
/** Pages kept in PAGES_CACHE (oldest dropped first). */
export const MAX_PAGES = 60;
/** Entries kept in RUNTIME_CACHE. */
export const MAX_RUNTIME = 120;
/** How long a page request may take before a cached copy is shown instead (slow connections). */
export const NAV_TIMEOUT_MS = 4000;
/**
 * How long a refresh in the background (a page or file already answered from the cache) may keep
 * the worker busy. An update can't activate while the old worker is busy, and the page reloading
 * into it waits meanwhile, so a stalled connection must not hold it up; the download itself goes on.
 */
export const BACKGROUND_MS = 10000;
/** Precache generations kept: the current one and the one before it, for tabs still running the previous build. */
export const KEEP_PRECACHES = 2;

/** One build's precache: file paths relative to the site root with a content hash each. */
export interface BuildInfo {
  /** Hash of every precached path and revision: changes whenever any of them does */
  version: string;
  /** The app's entry script ("assets/index-<hash>.js"): tells a page which build it is running */
  entry: string;
  files: { url: string; revision: string }[];
}

// ------------------------------------------------------------------------------- build time

/**
 * Files cached at install, so every page opens offline after the first visit: the app code and
 * styles (hashed, under assets/), the fonts and icons, the manifest, the home page and 404.html
 * (which boots the app on any route). Other pages are cached as they are visited; until then the
 * 404.html shell renders them offline. Large or rarely needed files (screenshots, social images,
 * data files, text files for crawlers, store artwork) are left to the runtime cache.
 */
export function shouldPrecache(path: string): boolean {
  const p = path.replace(/^\/+/, '');
  if (p === 'index.html' || p === '404.html' || p === 'site.webmanifest' || p === 'favicon.svg' || p === 'apple-touch-icon.png') return true;
  if (/^assets\/[^/]+\.(js|css|wasm|woff2|webp|avif|png|svg)$/.test(p)) return true;
  if (/^fonts\/[^/]+\.woff2$/.test(p)) return true;
  if (/^icons\/(icon-(192|512|maskable-192|maskable-512)|shortcut-[a-z]+)\.png$/.test(p)) return true;
  return false;
}

/** Short stable hash (FNV-1a, 32-bit, hex) of a string: build versions and revisions. */
export function hashString(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Builds the precache description from the build's files (path -> content hash). */
export function buildInfo(files: Map<string, string>, entry: string): BuildInfo {
  const list = [...files]
    .filter(([path]) => shouldPrecache(path))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([url, revision]) => ({ url, revision }));
  const version = hashString(list.map((f) => `${f.url}@${f.revision}`).join('\n'));
  return { version, entry, files: list };
}

/** The worker's own cache name for a build. */
export const precacheName = (version: string): string => `${PRECACHE_PREFIX}${version}`;

/** Cache key of a precached file: its URL, with the revision for files whose name is not hashed. */
export function precacheUrl(scope: string, file: { url: string; revision: string }): string {
  const hashed = /^assets\//.test(file.url);
  return new URL(hashed ? file.url : `${file.url}?__rev=${file.revision}`, scope).href;
}

// ------------------------------------------------------------------------------- runtime

export type RequestKind =
  /** Page load: network first, then the cached page, then the app shell */
  | 'navigate'
  /** Hashed build file: cache first (it never changes) */
  | 'asset'
  /** Other same-site file (images, manifest, icons): cached copy at once, refreshed in the background */
  | 'static'
  /** Same-site data file (JSON lists that change between deploys): network first, cached copy offline */
  | 'data'
  /** The Web Share Target POST */
  | 'share'
  /** Not ours to handle (other sites, POSTs, range requests, the worker script itself) */
  | 'bypass';

export interface RequestFacts {
  url: string;
  method: string;
  mode: string;
  /** The request has a Range header (media, the game jar) */
  range?: boolean;
}

/** Path of a URL relative to the scope ("assets/x.js", "de/help/"), or null when it is outside it. */
export function scopePath(url: string, scope: string): string | null {
  const u = new URL(url);
  const s = new URL(scope);
  if (u.origin !== s.origin) return null;
  if (u.pathname === s.pathname.replace(/\/$/, '')) return '';
  if (!u.pathname.startsWith(s.pathname)) return null;
  return u.pathname.slice(s.pathname.length);
}

export function classifyRequest(req: RequestFacts, scope: string): RequestKind {
  const rel = scopePath(req.url, scope);
  if (rel === null) return 'bypass';
  if (req.method === 'POST' && rel === SHARE_TARGET_PATH) return 'share';
  if (req.method !== 'GET' || req.range) return 'bypass';
  if (rel === 'sw.js') return 'bypass';
  if (req.mode === 'navigate') return 'navigate';
  if (/^assets\//.test(rel)) return 'asset';
  if (/\.(json|txt|xml|webmanifest)$/i.test(rel)) return 'data';
  return 'static';
}

/**
 * Where a page lives in the caches: its folder URL without query or fragment ("/help" and
 * "/help/?s=faq" are both "/help/"; files keep their name).
 */
export function pageKey(url: string): string {
  const u = new URL(url);
  u.search = '';
  u.hash = '';
  if (!u.pathname.endsWith('/') && !/\.[a-z0-9]{1,8}$/i.test(u.pathname)) u.pathname += '/';
  return u.href;
}

/** URL of the precached home page or app shell (index.html / 404.html), as a cache key. */
export function shellKey(scope: string, info: BuildInfo, name: 'index.html' | '404.html'): string | null {
  const f = info.files.find((x) => x.url === name);
  return f ? precacheUrl(scope, f) : null;
}

/**
 * True when a navigation that failed offline needs a redirect to its folder URL first ("/help" ->
 * "/help/"), as the server would: relative links in the cached page only work from there.
 */
export function needsSlashRedirect(url: string): boolean {
  const { pathname } = new URL(url);
  return !pathname.endsWith('/') && !/\.[a-z0-9]{1,8}$/i.test(pathname);
}

/** The folder URL of a page, keeping its query ("/help?s=faq" -> "/help/?s=faq"). */
export function withSlash(url: string): string {
  const u = new URL(url);
  if (needsSlashRedirect(url)) u.pathname += '/';
  return u.href;
}

/**
 * The 404.html app shell finds the site root from the address on github.io; offline it is told
 * outright (any host, any base path) by a meta tag the loader reads.
 */
export function withBaseHint(html: string, scopePathname: string): string {
  const tag = `<meta name="app-base" content="${scopePathname.replace(/[&"<>]/g, '')}" />`;
  return html.includes('<meta name="app-base"') ? html : html.replace(/<head>/i, (m) => `${m}\n    ${tag}`);
}

/**
 * Precache caches to delete when a build activates: all but the current one and the newest
 * `keep - 1` others (cache names come back in creation order), so a tab still running the
 * previous build can load its code-split chunks after a deploy.
 */
export function staleCaches(keys: string[], current: string, keep = KEEP_PRECACHES): string[] {
  const others = keys.filter((k) => k.startsWith(PRECACHE_PREFIX) && k !== current);
  return keep > 1 ? others.slice(0, Math.max(0, others.length - (keep - 1))) : others;
}

/** Entries to drop from a size-limited cache (oldest first). */
export function overLimit<T>(entries: readonly T[], max: number): T[] {
  return entries.length > max ? entries.slice(0, entries.length - max) : [];
}

/** Whether a response may be stored: a complete, successful same-site response. */
export function cacheable(res: { ok: boolean; status: number; type: string }): boolean {
  return res.ok && res.status === 200 && (res.type === 'basic' || res.type === 'default');
}

// ------------------------------------------------------------------------------- messages

/** Page -> worker */
export type ClientMessage = { type: 'SKIP_WAITING' } | { type: 'GET_INFO' };
/** Worker -> page (reply to GET_INFO) */
export interface WorkerInfo {
  version: string;
  entry: string;
}
