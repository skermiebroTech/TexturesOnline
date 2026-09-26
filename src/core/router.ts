// Hash router with lazily imported views, per-entry scroll restoration and view cleanup.
// Pure helpers (parseLocation, matchRoute, resolveRoute) have no DOM dependency.

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

const APP = 'TexturesOnline';

const textures = () => import('../tools/textures/view');
const skins = () => import('../tools/skins/view');
const shaders = () => import('../tools/shaders/view');

export const ROUTES: RouteDef[] = [
  { pattern: '/', load: () => import('../tools/home/home'), title: `${APP} — Minecraft texture pack, skin & shader maker`, tool: 'home' },
  { pattern: '/textures', load: textures, title: `Texture Pack Maker — ${APP}`, tool: 'textures' },
  { pattern: '/textures/:id', load: textures, title: `Texture Pack Maker — ${APP}`, tool: 'textures' },
  { pattern: '/skins', load: skins, title: `Skin Editor — ${APP}`, tool: 'skins' },
  { pattern: '/skins/:id', load: skins, title: `Skin Editor — ${APP}`, tool: 'skins' },
  { pattern: '/shaders', load: shaders, title: `Shader Maker — ${APP}`, tool: 'shaders' },
  { pattern: '/shaders/:id', load: shaders, title: `Shader Maker — ${APP}`, tool: 'shaders' },
  { pattern: '/help', load: () => import('../tools/help/help'), title: `Install guide & help — ${APP}`, tool: 'help' },
  { pattern: '/kit', load: () => import('../tools/kit/kit'), title: `UI kit — ${APP}`, tool: 'kit' },
];

/** '#/textures/abc?x=1' -> { path: '/textures/abc', query } */
export function parseLocation(hash: string): { path: string; query: URLSearchParams } {
  let h = hash.startsWith('#') ? hash.slice(1) : hash;
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

/** Link target for a route path: href('/help') === '#/help' */
export function href(path: string): string {
  return `#${path.startsWith('/') ? path : `/${path}`}`;
}

// ---------------- Runtime (browser only) ----------------

type Listener = (state: RouteState) => void;

let outletEl: HTMLElement | null = null;
let current: RouteState | null = null;
let currentKey = '';
let cleanup: (() => void) | null = null;
let token = 0;
let entryIdx = 0;
let maxIdx = 0;
let firstRender = true;
const scrollPositions = new Map<number, number>();
const listeners = new Set<Listener>();
let liveRegion: HTMLElement | null = null;

const SCROLL_KEY = 'to-router-scroll';

export function navigate(path: string, opts: { replace?: boolean } = {}): void {
  const target = href(path);
  if (opts.replace) {
    location.replace(target);
  } else if (location.hash === target) {
    void render(true);
  } else {
    location.hash = target;
  }
}

/** Change the URL without re-rendering the view (e.g. after a new project got its id). */
export function replacePath(path: string): void {
  const target = href(path);
  history.replaceState(history.state, '', target);
  const { path: p, query } = parseLocation(target);
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

export function onRouteChange(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit(): void {
  if (!current) return;
  for (const cb of Array.from(listeners)) {
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

async function render(force = false): Promise<void> {
  const outlet = outletEl;
  if (!outlet) return;
  const { path, query } = parseLocation(location.hash);
  const key = `${path}?${query.toString()}`;
  const restoreY = trackEntry();
  if (!force && key === currentKey && !firstRender && outlet.firstChild) return;
  currentKey = key;
  const my = ++token;
  const match = resolveRoute(path);

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
  emit();

  const pages = await import('../app/pages');
  if (my !== token) return;

  const loadingTimer = setTimeout(() => {
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

  try {
    const result = await mod.default(root, { params: current.params, query, path });
    if (my !== token) {
      if (typeof result === 'function') result();
      return;
    }
    cleanup = typeof result === 'function' ? result : null;
  } catch (err) {
    if (my !== token) return;
    console.error('View failed to render', err);
    outlet.replaceChildren(pages.loadErrorView(err));
  }

  const wasFirst = firstRender;
  firstRender = false;
  requestAnimationFrame(() => {
    if (my !== token) return;
    window.scrollTo({ top: restoreY, left: 0, behavior: 'instant' as ScrollBehavior });
    if (!wasFirst) {
      outlet.focus({ preventScroll: true });
      if (liveRegion) liveRegion.textContent = document.title;
    }
  });
}

export function startRouter(outlet: HTMLElement): void {
  outletEl = outlet;
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
  window.addEventListener('hashchange', () => {
    saveScrollMap();
    void render();
  });

  if (!location.hash || location.hash === '#') {
    history.replaceState(history.state, '', '#/');
  }
  void render();
}
