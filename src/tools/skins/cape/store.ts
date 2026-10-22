// The cape being made in the cape maker, kept in this browser (a 64x32 PNG is a few kilobytes) so
// it is still there next visit and the skin editor's pose maker can put it on the player.

const KEY = 'to-cape-maker';

export interface SavedCape {
  /** The 64x32 PNG */
  png: Uint8Array;
  name: string;
  /** Last change (ms) */
  t: number;
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function readSavedCape(): SavedCape | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { png?: unknown; name?: unknown; t?: unknown };
    if (typeof v.png !== 'string' || !v.png) return null;
    return { png: fromBase64(v.png), name: typeof v.name === 'string' ? v.name : '', t: typeof v.t === 'number' ? v.t : 0 };
  } catch {
    return null;
  }
}

/** Returns false when the browser would not store it (private mode, storage full). */
export function writeSavedCape(c: SavedCape): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify({ png: toBase64(c.png), name: c.name, t: c.t }));
    return true;
  } catch {
    return false;
  }
}

export function clearSavedCape(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
}

/** localStorage key of the cape maker's settings (cape/view.ts) */
export const CAPE_PREFS_KEY = 'to-cape-maker-prefs';

/** The settings that belong to the cape rather than to the browser (they travel with project files). */
export interface CapeSettings {
  wear?: 'cape' | 'elytra';
  edition?: 'java' | 'bedrock';
  javaVersion?: string;
  /** Bedrock elytra pack: kept so importing it again replaces the pack */
  uuids?: { header: string; module: string };
  packVersion?: [number, number, number];
}

const SETTINGS: (keyof CapeSettings)[] = ['wear', 'edition', 'javaVersion', 'uuids', 'packVersion'];

/** The cape's settings out of the stored preferences (absent ones stay out). */
export function readCapeSettings(): CapeSettings {
  try {
    const p = JSON.parse(localStorage.getItem(CAPE_PREFS_KEY) ?? '{}') as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of SETTINGS) if (p[k] !== undefined) out[k] = p[k];
    return out as CapeSettings;
  } catch {
    return {};
  }
}

/** Writes the cape's settings into the stored preferences (the page checks them when it reads them). */
export function writeCapeSettings(s: CapeSettings): void {
  try {
    const p = JSON.parse(localStorage.getItem(CAPE_PREFS_KEY) ?? '{}') as Record<string, unknown>;
    for (const k of SETTINGS) {
      if (s[k] !== undefined) p[k] = s[k];
      else if (k === 'uuids' || k === 'packVersion') delete p[k];
    }
    localStorage.setItem(CAPE_PREFS_KEY, JSON.stringify(p));
  } catch {
    /* private mode */
  }
}
