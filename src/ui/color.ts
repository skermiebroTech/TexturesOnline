// Pure colour conversions used by the colour picker (safe under Node).

export type RGBA = [number, number, number, number];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const hex2 = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');

/** '#rgb', '#rgba', '#rrggbb' or '#rrggbbaa' (hash optional) -> RGBA, or null when invalid. */
export function parseHex(input: string): RGBA | null {
  let s = input.trim().replace(/^#/, '').toLowerCase();
  if (!/^[0-9a-f]+$/.test(s)) return null;
  if (s.length === 3 || s.length === 4) s = s.split('').map((c) => c + c).join('');
  if (s.length !== 6 && s.length !== 8) return null;
  const n = (i: number) => parseInt(s.slice(i, i + 2), 16);
  return [n(0), n(2), n(4), s.length === 8 ? n(6) : 255];
}

/**
 * Hex typed into a colour field, applied while the user is still typing: only complete
 * '#rrggbb' (or '#rrggbbaa' with alpha) values count, because '#123' is also the start of '#123456'.
 */
export function parseHexWhileTyping(input: string, withAlpha: boolean): RGBA | null {
  const digits = input.trim().replace(/^#/, '').length;
  if (digits !== 6 && !(withAlpha && digits === 8)) return null;
  const c = parseHex(input);
  if (c && !withAlpha) c[3] = 255;
  return c;
}

/** RGBA -> '#rrggbb' (alpha omitted) or '#rrggbbaa' when withAlpha and alpha < 255. */
export function toHex(c: RGBA | [number, number, number], withAlpha = false): string {
  const base = `#${hex2(c[0])}${hex2(c[1])}${hex2(c[2])}`;
  const a = c.length > 3 ? (c as RGBA)[3] : 255;
  return withAlpha && a < 255 ? base + hex2(a) : base;
}

/** r,g,b 0-255 -> h 0-360, s 0-1, v 0-1 */
export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let hue = 0;
  if (d !== 0) {
    if (max === rn) hue = ((gn - bn) / d) % 6;
    else if (max === gn) hue = (bn - rn) / d + 2;
    else hue = (rn - gn) / d + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return [hue, s, max];
}

/** h 0-360, s 0-1, v 0-1 -> r,g,b 0-255 (rounded) */
export function hsvToRgb(hue: number, s: number, v: number): [number, number, number] {
  const hh = (((hue % 360) + 360) % 360) / 60;
  const c = v * s;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 1) [r, g, b] = [c, x, 0];
  else if (hh < 2) [r, g, b] = [x, c, 0];
  else if (hh < 3) [r, g, b] = [0, c, x];
  else if (hh < 4) [r, g, b] = [0, x, c];
  else if (hh < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

export function rgbaEqual(a: RGBA, b: RGBA): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}

/** CSS color string for an RGBA value */
export function rgbaCss(c: RGBA): string {
  return c[3] >= 255 ? toHex(c) : `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${+(c[3] / 255).toFixed(3)})`;
}

/** Relative luminance (sRGB) 0-1 */
export function luminance(r: number, g: number, b: number): number {
  const f = (v: number) => {
    const n = v / 255;
    return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** A small default palette with Minecraft-ish material colours. */
export const DEFAULT_PALETTE: string[] = [
  '#000000', '#3f3f3f', '#7f7f7f', '#bfbfbf', '#ffffff', '#5c3a1e', '#8b5a2b', '#c28e5c',
  '#e0c29b', '#7a1f1f', '#d23c3c', '#ff8a4a', '#ffcf4a', '#f4f0a0', '#3f7a2a', '#5bd35b',
  '#a4e36a', '#1f6f6a', '#38c2b0', '#4fb3ff', '#2a4fa0', '#6a4ae0', '#b07cff', '#e060c0',
];
