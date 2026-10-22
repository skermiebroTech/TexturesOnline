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
