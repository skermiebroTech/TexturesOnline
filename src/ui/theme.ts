// Light/dark theme: persisted choice, otherwise follows the OS setting.

export type Theme = 'dark' | 'light';

const KEY = 'to-theme';
const listeners = new Set<(t: Theme) => void>();
let systemQuery: MediaQueryList | null = null;

function stored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'dark' || v === 'light' ? v : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function getTheme(): Theme {
  const t = document.documentElement.dataset.theme;
  return t === 'light' ? 'light' : 'dark';
}

function apply(t: Theme): void {
  document.documentElement.dataset.theme = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t === 'light' ? '#eef1f6' : '#0d0f14');
  listeners.forEach((fn) => fn(t));
}

export function setTheme(t: Theme, persist = true): void {
  if (persist) {
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* ignore */
    }
  }
  apply(t);
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

export function onThemeChange(cb: (t: Theme) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Apply the saved (or system) theme and keep following the OS until the user picks one. */
export function initTheme(): void {
  apply(stored() ?? systemTheme());
  if (typeof matchMedia !== 'function' || systemQuery) return;
  systemQuery = matchMedia('(prefers-color-scheme: light)');
  systemQuery.addEventListener('change', () => {
    if (!stored()) apply(systemTheme());
  });
}
