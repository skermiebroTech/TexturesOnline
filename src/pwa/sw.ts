// Service worker: the site opens offline after the first visit, on every route and in every
// language, and a deploy never strands an open tab.
//
// - Install: caches this build's app files (the list and hashes are written into sw.js at build
//   time, see src/pwa/build.ts). Unchanged files are copied from the previous build's cache instead
//   of being downloaded again.
// - Pages: network first (a slow network falls back to the cached copy after a few seconds),
//   then the page as last seen, then the 404.html app shell, which renders any route.
// - Hashed build files: cache first. The previous build's cache is kept, so a tab still running
//   the previous build can load its lazy chunks after a deploy.
// - Updates: a new build waits until the page asks it to take over (the "New version" toast), or
//   until every tab is closed.
// The decisions themselves are pure functions in sw-logic.ts (unit tested).

import {
  MAX_PAGES,
  MAX_RUNTIME,
  BACKGROUND_MS,
  NAV_TIMEOUT_MS,
  PAGES_CACHE,
  RUNTIME_CACHE,
  SHARE_CACHE,
  SHARE_PARAM,
  SHARE_TARGET_PATH,
  cacheable,
  classifyRequest,
  needsSlashRedirect,
  overLimit,
  pageKey,
  precacheName,
  precacheUrl,
  scopePath,
  shellKey,
  staleCaches,
  withBaseHint,
  withSlash,
  type BuildInfo,
  type ClientMessage,
  type WorkerInfo,
} from './sw-logic';

const sw = self as unknown as ServiceWorkerGlobalScope & { __TPM_SW_BUILD__?: BuildInfo };
const BUILD: BuildInfo = sw.__TPM_SW_BUILD__ ?? { version: 'dev', entry: '', files: [] };
const SCOPE = sw.registration.scope;
const CURRENT = precacheName(BUILD.version);
/** Precache key of each file by its path ("assets/x.js", "site.webmanifest"). */
const KEYS = new Map(BUILD.files.map((f) => [f.url, precacheUrl(SCOPE, f)]));

const isHashed = (url: string) => url.startsWith('assets/');

async function precache(): Promise<void> {
  const cache = await caches.open(CURRENT);
  const have = new Set((await cache.keys()).map((r) => r.url));
  const queue = BUILD.files.filter((f) => !have.has(KEYS.get(f.url)!));
  const worker = async () => {
    for (let f = queue.shift(); f; f = queue.shift()) {
      const key = KEYS.get(f.url)!;
      // The same file from an earlier build (same name and revision): no download.
      const old = await caches.match(key);
      if (old) {
        await cache.put(key, old);
        continue;
      }
      const res = await fetch(new Request(new URL(f.url, SCOPE).href, { cache: isHashed(f.url) ? 'default' : 'no-cache', credentials: 'same-origin' }));
      if (!res.ok) throw new Error(`Precache: ${f.url} answered ${res.status}`);
      await cache.put(key, res);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
}

sw.addEventListener('install', (event) => {
  event.waitUntil(precache());
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(staleCaches(keys, CURRENT).map((k) => caches.delete(k)));
      // Page requests start while the worker boots (it may have been stopped).
      await sw.registration.navigationPreload?.enable().catch(() => undefined);
      await sw.clients.claim();
    })(),
  );
});

sw.addEventListener('message', (event) => {
  const msg = event.data as ClientMessage | null;
  if (msg?.type === 'SKIP_WAITING') void sw.skipWaiting();
  else if (msg?.type === 'GET_INFO') {
    const info: WorkerInfo = { version: BUILD.version, entry: BUILD.entry };
    event.ports[0]?.postMessage(info);
  }
});

sw.addEventListener('fetch', (event) => {
  const req = event.request;
  const kind = classifyRequest({ url: req.url, method: req.method, mode: req.mode, range: req.headers.has('range') }, SCOPE);
  switch (kind) {
    case 'navigate':
      return event.respondWith(navigate(event));
    case 'asset':
      return event.respondWith(cacheFirst(req));
    case 'static':
      return event.respondWith(staleWhileRevalidate(event));
    case 'data':
      return event.respondWith(networkFirst(req));
    case 'share':
      return event.respondWith(receiveShare(req));
    default:
      return undefined;
  }
});

// ------------------------------------------------------------------------------- strategies

/** A precached copy of a site file by URL (any build's cache), or undefined. */
async function fromPrecache(url: string): Promise<Response | undefined> {
  const rel = scopePath(url, SCOPE);
  const key = rel === null ? undefined : KEYS.get(rel);
  return key ? caches.match(key) : undefined;
}

async function trim(name: string, max: number): Promise<void> {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  await Promise.all(overLimit(keys, max).map((k) => cache.delete(k)));
}

async function remember(name: string, max: number, key: string, res: Response): Promise<void> {
  const cache = await caches.open(name);
  await cache.put(key, res);
  await trim(name, max);
}

const timeout = (ms: number) => new Promise<null>((resolve) => setTimeout(() => resolve(null), ms));

/** Keeps the worker alive for background work, but no longer than BACKGROUND_MS. */
const background = (event: ExtendableEvent, work: Promise<unknown>): void =>
  event.waitUntil(Promise.race([work.then(() => undefined, () => undefined), timeout(BACKGROUND_MS)]));

async function navigate(event: FetchEvent): Promise<Response> {
  const req = event.request;
  const key = pageKey(req.url);
  const cachedPage = async () => (await caches.match(key, { cacheName: PAGES_CACHE })) ?? (key === SCOPE ? await shell('index.html') : undefined);

  const network = (async () => {
    const preloaded = (await event.preloadResponse.catch(() => undefined)) as Response | undefined;
    const res = preloaded ?? (await fetch(req));
    if (cacheable(res) && (res.headers.get('content-type') ?? '').includes('text/html') && !res.redirected) {
      background(event, remember(PAGES_CACHE, MAX_PAGES, key, res.clone()));
    }
    return res;
  })();
  background(event, network);

  try {
    const cached = await cachedPage();
    if (!cached) return await network;
    // A slow network: show the page as last seen; the fresh copy is stored for next time.
    const first = await Promise.race([network, timeout(NAV_TIMEOUT_MS)]);
    return first ?? cached;
  } catch {
    return offlinePage(req.url);
  }
}

/** A precached copy of index.html or 404.html. */
async function shell(name: 'index.html' | '404.html'): Promise<Response | undefined> {
  const k = shellKey(SCOPE, BUILD, name);
  return k ? caches.match(k) : undefined;
}

/** The page as last seen, else the app shell (404.html), which boots the app on any route. */
async function offlinePage(url: string): Promise<Response> {
  if (needsSlashRedirect(url)) {
    const folder = withSlash(url);
    if (pageKey(folder) === SCOPE || (await caches.match(pageKey(folder), { cacheName: PAGES_CACHE }))) return Response.redirect(folder, 301);
  }
  const key = pageKey(url);
  const page = (await caches.match(key, { cacheName: PAGES_CACHE })) ?? (key === SCOPE ? await shell('index.html') : undefined);
  if (page) return page;
  const fallback = await shell('404.html');
  if (!fallback) return new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } });
  const html = withBaseHint(await fallback.text(), new URL(SCOPE).pathname);
  return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

async function cacheFirst(req: Request): Promise<Response> {
  const hit = (await caches.match(req.url)) ?? (await fromPrecache(req.url));
  if (hit) return hit;
  const res = await fetch(req);
  if (cacheable(res)) await remember(RUNTIME_CACHE, MAX_RUNTIME, req.url, res.clone()).catch(() => undefined);
  return res;
}

async function staleWhileRevalidate(event: FetchEvent): Promise<Response> {
  const req = event.request;
  const hit = (await fromPrecache(req.url)) ?? (await caches.match(req.url, { cacheName: RUNTIME_CACHE }));
  const refresh = fetch(req).then(async (res) => {
    if (cacheable(res)) await remember(RUNTIME_CACHE, MAX_RUNTIME, req.url, res.clone());
    return res;
  });
  if (hit) {
    background(event, refresh);
    return hit;
  }
  return refresh;
}

async function networkFirst(req: Request): Promise<Response> {
  try {
    const res = await fetch(req);
    if (cacheable(res)) await remember(RUNTIME_CACHE, MAX_RUNTIME, req.url, res.clone()).catch(() => undefined);
    return res;
  } catch (err) {
    const hit = (await caches.match(req.url, { cacheName: RUNTIME_CACHE })) ?? (await fromPrecache(req.url));
    if (hit) return hit;
    throw err;
  }
}

/** Web Share Target: keeps the shared files for the page and opens the app with their id. */
async function receiveShare(req: Request): Promise<Response> {
  const id = Date.now().toString(36);
  try {
    const form = await req.formData();
    const files = form.getAll('files').filter((f): f is File => typeof f !== 'string');
    const cache = await caches.open(SHARE_CACHE);
    await Promise.all(
      files.map((f, i) =>
        cache.put(new URL(`${SHARE_TARGET_PATH}${id}/${i}`, SCOPE).href, new Response(f, { headers: { 'content-type': f.type || 'application/octet-stream', 'x-file-name': encodeURIComponent(f.name) } })),
      ),
    );
  } catch (err) {
    console.warn('Share target: could not read the shared files', err);
  }
  return Response.redirect(new URL(`./?${SHARE_PARAM}=${id}`, SCOPE).href, 303);
}
