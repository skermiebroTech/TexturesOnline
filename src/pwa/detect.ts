// Pure helpers for the install and update code (no DOM, unit tested).

/** How a browser installs web apps when it has no install prompt of its own (from its user agent). */
export function platformOf(ua: string, touchPoints = 0): 'ios' | 'mac-safari' | null {
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1);
  if (ios) return 'ios';
  const safari = /Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|CriOS|Edg|Firefox|FxiOS|OPR|Brave/.test(ua);
  const version = Number(/Version\/(\d+)/.exec(ua)?.[1] ?? 0);
  // "Add to Dock" arrived with Safari 17 (macOS Sonoma).
  return safari && version >= 17 ? 'mac-safari' : null;
}

/** Which build a service worker serves (its reply to GET_INFO, see src/pwa/sw-logic.ts). */
export interface WorkerInfo {
  version: string;
  entry: string;
}

/** True when the page's own entry script is the one the worker was built with. */
export function sameBuild(info: WorkerInfo | null, entryUrl: string, base: string): boolean {
  if (!info?.entry) return false;
  try {
    return new URL(info.entry, base).pathname === new URL(entryUrl).pathname;
  } catch {
    return false;
  }
}
