// Where the site lives, worked out at runtime so the same build runs at a domain root
// ("https://texturepackmaker.com/"), under a GitHub Pages project path ("/TexturesOnline/") or on
// the Vite dev server, without any build-time setting.

let cached: string | null = null;

function detect(): string | null {
  const env = import.meta.env as ImportMetaEnv | undefined;
  const loc = typeof location === 'undefined' ? undefined : location;
  if (!env || !loc) return null;
  try {
    // Dev server: always served from Vite's base.
    if (env.DEV) return new URL(env.BASE_URL || '/', loc.href).href;
    // Built site: every chunk sits in "<site root>/assets/", so the root is two segments up from
    // this module's own URL (this works on every page, including the 404 fallback).
    const self = new URL(import.meta.url);
    return self.origin + self.pathname.replace(/[^/]+\/[^/]*$/, '');
  } catch {
    return null;
  }
}

/** Absolute URL of the site root, always ending in "/". */
export function appBaseUrl(): string {
  if (cached) return cached;
  const found = detect();
  if (found) {
    cached = found;
    return found;
  }
  // Tests and other non-Vite contexts: fall back to the document's own base URL.
  const doc = typeof document === 'undefined' ? undefined : document.baseURI;
  const fallback = doc ?? (typeof location === 'undefined' ? undefined : location.href);
  if (!fallback) throw new Error('No document base URL.');
  return fallback;
}

/** Path of the site root, e.g. "/" or "/TexturesOnline/" ("/" when it cannot be known). */
export function appBasePath(): string {
  try {
    const p = new URL(appBaseUrl()).pathname;
    return p.endsWith('/') ? p : p.replace(/[^/]*$/, '');
  } catch {
    return '/';
  }
}
