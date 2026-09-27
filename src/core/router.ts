// Path router (History API) with lazily imported views, per-entry scroll restoration and view
// cleanup. Real URLs ("/textures/", "/skins/<id>") under a site base worked out at runtime, so
// the same build runs at a domain root or under a GitHub Pages project path. Old "#/..." links
// are redirected to the matching path. Internal <a href> links are intercepted (no reloads).
// Pure helpers (parseLocation, matchRoute, resolveRoute, toHref, stripBase) have no DOM dependency.

import { appBasePath } from './base';
import { GUIDES, GUIDES_META, HELP_META, HOME_META, TOOL_META } from '../app/seo/meta';
import { SITE_NAME } from '../app/site';

export interface RouteContext {
  params: Record<string, string>;
  query: URLSearchParams;
  path: string;
}

export type ViewModule = {
  default: (root: HTMLElement, ctx: RouteContext) => void | (() => void) | Promise<void | (() => void)>;
};

export type ToolId = 'home' | 'textures' | 'skins' | 'shaders' | 'help' | 'kit';

export interface RouteDef {
  pattern: string;
  load: () => Promise<ViewModule>;
  title: string;
  tool: ToolId;
}

export interface RouteState extends RouteContext {
  tool: ToolId | null;
  pattern: string | null;
}

const APP = SITE_NAME;

const textures = () => import('../tools/textures/view');
const skins = () => import('../tools/skins/view');
const shaders = () => import('../tools/shaders/view');
const guides = () => import('../tools/guides/guides');

export const ROUTES: RouteDef[] = [
  { pattern: '/', load: () => import('../tools/home/home'), title: HOME_META.title, tool: 'home' },
  { pattern: '/textures', load: textures, title: TOOL_META.textures.title, tool: 'textures' },
  { pattern: '/textures/:id', load: textures, title: `Texture packs — ${APP}`, tool: 'textures' },
  { pattern: '/skins', load: skins, title: TOOL_META.skins.title, tool: 'skins' },
  { pattern: '/skins/:id', load: skins, title: `Skin editor — ${APP}`, tool: 'skins' },
  { pattern: '/shaders', load: shaders, title: TOOL_META.shaders.title, tool: 'shaders' },
  { pattern: '/shaders/:id', load: shaders, title: `Shader maker — ${APP}`, tool: 'shaders' },
  { pattern: '/help', load: () => import('../tools/help/help'), title: HELP_META.title, tool: 'help' },
  { pattern: '/guides', load: guides, title: GUIDES_META.title, tool: 'help' },
  ...GUIDES.map((g): RouteDef => ({ pattern: g.path, load: guides, title: g.title, tool: 'help' })),
  { pattern: '/kit', load: () => import('../tools/kit/kit'), title: `UI kit — ${APP}`, tool: 'kit' },
];

/**
 * Route path and query of a location string. Accepts an app path ('/textures/abc?x=1'), a legacy
 * hash ('#/textures/abc?x=1') or a bare path ('help'). A trailing '#fragment' is ignored.
 */
export function parseLocation(input: string): { path: string; query: URLSearchParams } {
  let h = input.startsWith('#') ? input.slice(1) : input;
  const fi = h.indexOf('#');
  if (fi >= 0) h = h.slice(0, fi);
  const qi = h.indexOf('?');
  const queryString = qi >= 0 ? h.slice(qi + 1) : '';
  h = qi >= 0 ? h.slice(0, qi) : h;
  return { path: normalizePath(h), query: new URLSearchParams(queryString) };
}

export function normalizePath(p: string): string {
  let path = p.trim();
  if (!path.startsWith('/')) path = `/${path}`;
  path = path.replace(/\/{2,}/g, '/');
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path;
}

/** Match '/textures/:id' against '/textures/abc' -> { id: 'abc' }; null when it does not match. */
export function matchRoute(pattern: string, path: string): Record<string, string> | null {
  const pp = normalizePath(pattern).split('/').filter(Boolean);
  const sp = normalizePath(path).split('/').filter(Boolean);
  if (pp.length !== sp.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pp.length; i++) {
    const seg = pp[i];
    if (seg.startsWith(':')) {
      let value: string;
      try {
        value = decodeURIComponent(sp[i]);
      } catch {
        return null;
      }
      if (!value) return null;
      params[seg.slice(1)] = value;
    } else if (seg !== sp[i]) {
      return null;
    }
  }
  return params;
}

export function resolveRoute(path: string, routes: RouteDef[] = ROUTES): { route: RouteDef; params: Record<string, string> } | null {
  for (const route of routes) {
    const params = matchRoute(route.pattern, path);
    if (params) return { route, params };
  }
  return null;
}

/** Section pages ('/', '/help', '/guides/x') are folders on the server, so their URLs end in '/'. */
function isFolderPath(path: string, routes: RouteDef[]): boolean {
  if (path === '/') return true;
  const r = resolveRoute(path, routes);
  return !!r && !r.route.pattern.includes(':');
}

/** URL for a route path under a site base: toHref('/help?s=faq', '/Repo/') === '/Repo/help/?s=faq' */
export function toHref(path: string, base = '/', routes: RouteDef[] = ROUTES): string {
  const { path: p, query } = parseLocation(path);
  const qs = query.toString();
  let rel = p === '/' ? '' : p.slice(1);
  if (rel && isFolderPath(p, routes)) rel += '/';
  const b = base.endsWith('/') ? base : `${base}/`;
  return `${b}${rel}${qs ? `?${qs}` : ''}`;
}

/** Route path of a URL pathname under a site base ('/Repo/help/' -> '/help'); null outside the base. */
export function stripBase(pathname: string, base = '/'): string | null {
  const b = base.endsWith('/') ? base : `${base}/`;
  if (pathname === b.slice(0, -1) || pathname === b) return '/';
  if (!pathname.startsWith(b)) return null;
  return normalizePath(pathname.slice(b.length - 1));
}

/** Link target for a route path: href('/help') === '/help/' at a domain root. */
export function href(path: string): string {
  return toHref(path.startsWith('/') || path.startsWith('#') ? path : `/${path}`, appBasePath());
}

// ---------------- Runtime (browser only) ----------------

type Listener = (state: RouteState) => void;
type RenderedListener = (state: RouteState, root: HTMLElement) => void;

let outletEl: HTMLElement | null = null;
let current: RouteState | null = null;
let currentKey = '';
let cleanup: (() => void) | null = null;
let token = 0;
let entryIdx = 0;
let maxIdx = 0;
let firstRender = true;
let started = false;
let pendingFragment = '';
const scrollPositions = new Map<number, number>();
const listeners = new Set<Listener>();
const navListeners = new Set<Listener>();
const renderedListeners = new Set<RenderedListener>();
let liveRegion: HTMLElement | null = null;
let restoring = false;

const SCROLL_KEY = 'to-router-scroll';

/** Current route path + query from the address bar (legacy '#/...' hashes win). */
function readLocation(): { path: string; query: URLSearchParams } {
  if (location.hash.startsWith('#/')) return parseLocation(location.hash);
  const path = stripBase(location.pathname, appBasePath());
  return { path: path ?? normalizePath(location.pathname), query: new URLSearchParams(location.search) };
}

function currentUrl(): string {
  return location.pathname + location.search;
}

export function navigate(path: string, opts: { replace?: boolean } = {}): void {
  const hashAt = path.startsWith('#') ? -1 : path.indexOf('#');
  pendingFragment = hashAt >= 0 ? path.slice(hashAt + 1) : '';
  const target = href(hashAt >= 0 ? path.slice(0, hashAt) : path);
  if (!started) {
    if (opts.replace) location.replace(target);
    else location.assign(target);
    return;
  }
  if (opts.replace) {
    history.replaceState(null, '', target);
    void render();
  } else if (currentUrl() === target && !location.hash) {
    void render(true);
  } else {
    saveScrollMap();
    history.pushState(null, '', target);
    void render();
  }
}

/** Change the URL without re-rendering the view (e.g. after a new project got its id). */
export function replacePath(path: string): void {
  const target = href(path);
  history.replaceState(history.state, '', target);
  const { path: p, query } = parseLocation(path);
  currentKey = `${p}?${query.toString()}`;
  if (current) {
    const match = resolveRoute(p);
    current = { ...current, path: p, query, params: match?.params ?? current.params };
    emit();
  }
}

export function currentRoute(): RouteState | null {
  return current;
}

/**
 * True while a view renders for a back/forward visit whose scroll position is about to be
 * restored; views should then skip their own "scroll to the deep-linked section" behaviour.
 */
export function isRestoringScroll(): boolean {
  return restoring;
}

export function onRouteChange(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Called once per real navigation (not for replacePath), before the new view renders. */
export function onNavigation(cb: Listener): () => void {
  navListeners.add(cb);
  return () => navListeners.delete(cb);
}

/** Called after a view has rendered into its root element. */
export function onViewRendered(cb: RenderedListener): () => void {
  renderedListeners.add(cb);
  return () => renderedListeners.delete(cb);
}

function emit(set: Set<Listener> = listeners): void {
  if (!current) return;
  for (const cb of Array.from(set)) {
    try {
      cb(current);
    } catch (err) {
      console.error(err);
    }
  }
}

function loadScrollMap(): void {
  try {
    const raw = sessionStorage.getItem(SCROLL_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw) as { max?: number; pos?: Record<string, number> };
    maxIdx = obj.max ?? 0;
    for (const [k, v] of Object.entries(obj.pos ?? {})) scrollPositions.set(Number(k), v);
  } catch {
    /* ignore */
  }
}

function saveScrollMap(): void {
  try {
    const pos: Record<string, number> = {};
    for (const [k, v] of scrollPositions) pos[k] = v;
    sessionStorage.setItem(SCROLL_KEY, JSON.stringify({ max: maxIdx, pos }));
  } catch {
    /* ignore */
  }
}

/** Identify the history entry; returns the scroll position to restore (0 for new entries). */
function trackEntry(): number {
  const state = history.state as { toIdx?: number } | null;
  if (state && typeof state.toIdx === 'number') {
    entryIdx = state.toIdx;
    maxIdx = Math.max(maxIdx, entryIdx);
    return scrollPositions.get(entryIdx) ?? 0;
  }
  maxIdx += 1;
  entryIdx = maxIdx;
  try {
    history.replaceState({ ...(state ?? {}), toIdx: entryIdx }, '');
  } catch {
    /* ignore */
  }
  return 0;
}

/** Rewrites legacy '#/x' URLs and non-canonical paths ('/help' -> '/help/') in place. */
function canonicalizeUrl(): void {
  const { path, query } = readLocation();
  const qs = query.toString();
  const target = href(qs ? `${path}?${qs}` : path);
  const legacy = location.hash.startsWith('#/');
  const inBase = stripBase(location.pathname, appBasePath()) !== null;
  if (!inBase && !legacy) return;
  if (legacy || currentUrl() !== target) {
    try {
      history.replaceState(history.state, '', legacy ? target : target + location.hash);
    } catch {
      /* ignore */
    }
  }
}

async function render(force = false): Promise<void> {
  const outlet = outletEl;
  if (!outlet) return;
  canonicalizeUrl();
  const { path, query } = readLocation();
  const key = `${path}?${query.toString()}`;
  const restoreY = trackEntry();
  if (!force && key === currentKey && !firstRender && outlet.firstChild) return;
  currentKey = key;
  const my = ++token;
  const match = resolveRoute(path);
  // Pages rendered at build time stay on screen until the real view replaces them.
  const prerendered = firstRender && outlet.hasChildNodes();

  if (cleanup) {
    const fn = cleanup;
    cleanup = null;
    try {
      fn();
    } catch (err) {
      console.error('View cleanup failed', err);
    }
  }

  const tool = match?.route.tool ?? null;
  document.documentElement.dataset.tool = tool ?? '';
  current = { params: match?.params ?? {}, query, path, tool, pattern: match?.route.pattern ?? null };
  emit(navListeners);
  emit();

  const pages = await import('../app/pages');
  if (my !== token) return;

  const loadingTimer = prerendered
    ? 0
    : setTimeout(() => {
        if (my === token) outlet.replaceChildren(pages.loadingView());
      }, 150);

  let mod: ViewModule;
  try {
    mod = match ? await match.route.load() : { default: pages.notFoundView };
  } catch (err) {
    clearTimeout(loadingTimer);
    if (my !== token) return;
    console.error('Failed to load view', err);
    outlet.replaceChildren(pages.loadErrorView(err));
    document.title = `Something went wrong — ${APP}`;
    return;
  }
  clearTimeout(loadingTimer);
  if (my !== token) return;

  const root = document.createElement('div');
  root.className = `view view-${tool ?? 'missing'}`;
  outlet.replaceChildren(root);
  document.title = match ? match.route.title : `Page not found — ${APP}`;
  restoring = restoreY > 0;

  try {
    const result = await mod.default(root, { params: current.params, query, path });
    if (my !== token) {
      if (typeof result === 'function') result();
      return;
    }
    cleanup = typeof result === 'function' ? result : null;
    for (const cb of Array.from(renderedListeners)) {
      try {
        cb(current, root);
      } catch (err) {
        console.error(err);
      }
    }
  } catch (err) {
    if (my !== token) return;
    console.error('View failed to render', err);
    outlet.replaceChildren(pages.loadErrorView(err));
  }

  const wasFirst = firstRender;
  firstRender = false;
  const fragment = pendingFragment;
  pendingFragment = '';
  requestAnimationFrame(() => {
    if (my !== token) return;
    restoring = false;
    const target = fragment ? document.getElementById(decodeURIComponent(fragment)) : null;
    if (target) target.scrollIntoView({ block: 'start' });
    // The first view keeps whatever scroll the visitor already has on the prerendered page.
    else if (!wasFirst || restoreY > 0) window.scrollTo({ top: restoreY, left: 0, behavior: 'instant' as ScrollBehavior });
    if (!wasFirst) {
      outlet.focus({ preventScroll: true });
      if (liveRegion) liveRegion.textContent = document.title;
    }
  });
}

const FILE_RE = /\.[a-z0-9]{1,8}$/i;

/** Same-site links to app pages navigate without a reload; files, new tabs and other sites are left alone. */
function onDocumentClick(e: MouseEvent): void {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = (e.target as Element | null)?.closest?.('a[href]');
  if (!(a instanceof HTMLAnchorElement)) return;
  if ((a.target && a.target !== '_self') || a.hasAttribute('download') || /\bexternal\b/.test(a.rel)) return;
  const raw = a.getAttribute('href') ?? '';
  if (raw.startsWith('#/')) {
    e.preventDefault();
    navigate(raw.slice(1));
    return;
  }
  if (raw.startsWith('#')) return;
  let url: URL;
  try {
    url = new URL(a.href, location.href);
  } catch {
    return;
  }
  if (url.origin !== location.origin) return;
  const path = stripBase(url.pathname, appBasePath());
  if (path === null || FILE_RE.test(path)) return;
  if (url.hash && url.pathname === location.pathname && url.search === location.search) return;
  e.preventDefault();
  navigate(path + url.search + url.hash);
}

export function startRouter(outlet: HTMLElement): void {
  outletEl = outlet;
  started = true;
  if (!outlet.hasAttribute('tabindex')) outlet.setAttribute('tabindex', '-1');
  try {
    history.scrollRestoration = 'manual';
  } catch {
    /* ignore */
  }
  loadScrollMap();

  liveRegion = document.createElement('div');
  liveRegion.className = 'sr-only';
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');
  document.body.appendChild(liveRegion);

  let scrollRaf = 0;
  window.addEventListener(
    'scroll',
    () => {
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(() => {
        scrollRaf = 0;
        // ignore scrolls while a new history entry is being set up
        const st = history.state as { toIdx?: number } | null;
        if (st?.toIdx === entryIdx) scrollPositions.set(entryIdx, window.scrollY);
      });
    },
    { passive: true },
  );
  window.addEventListener('pagehide', saveScrollMap);
  window.addEventListener('popstate', () => {
    saveScrollMap();
    void render();
  });
  // Old '#/...' links typed or pasted into the address bar of an open page.
  window.addEventListener('hashchange', () => {
    if (!location.hash.startsWith('#/')) return;
    saveScrollMap();
    void render();
  });
  document.addEventListener('click', onDocumentClick);

  void render();
}
