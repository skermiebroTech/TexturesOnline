// Keyframe, colour and number helpers for Vibrant Visuals JSON.
// Keyframe time t: 0 = noon, 0.25 = sunset, 0.5 = midnight, 0.75 = sunrise, 1 = next noon.

export type RGB = [number, number, number];
export type Curve<T> = ReadonlyArray<readonly [number, T]>;
export type KeyframeObject<T> = Record<string, T>;

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

/** Round to 6 decimals (keeps output tidy and float noise out of the JSON). */
export function round6(x: number): number {
  const r = Math.round(x * 1e6) / 1e6;
  return Object.is(r, -0) ? 0 : r;
}

/** Canonical keyframe key: "0.0", "1.0", otherwise up to 6 decimals ("0.2915"). */
export function formatKey(t: number): string {
  const r = round6(clamp(t, 0, 1));
  if (r === 0) return '0.0';
  if (r === 1) return '1.0';
  let s = r.toFixed(6).replace(/0+$/, '');
  if (s.endsWith('.')) s += '0';
  return s;
}

export const isDay = (t: number): boolean => t <= 0.2 || t >= 0.8;
export const isDusk = (t: number): boolean => (t > 0.2 && t < 0.3) || (t > 0.7 && t < 0.8);
export const isNight = (t: number): boolean => t >= 0.3 && t <= 0.7;

export function mapCurve<T, U>(curve: Curve<T>, fn: (value: T, t: number) => U): Array<[number, U]> {
  return curve.map(([t, v]) => [t, fn(v, t)] as [number, U]);
}

export function flat<T>(value: T): Curve<T> {
  return [[0, value], [1, value]];
}

/**
 * Sorted keyframe object with explicit "0.0" and "1.0" keys. The day cycle wraps, so a missing
 * noon key takes the value of the other end (vanilla curves are written that way).
 */
export function toKeyframes<T>(curve: Curve<T>, fmt: (v: T) => T): KeyframeObject<T> {
  const sorted = [...curve].sort((a, b) => a[0] - b[0]);
  if (sorted.length === 0) throw new Error('Empty keyframe curve');
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const out: Array<readonly [number, T]> = [...sorted];
  if (round6(first[0]) > 0) out.unshift([0, round6(last[0]) >= 1 ? last[1] : first[1]]);
  if (round6(out[out.length - 1][0]) < 1) out.push([1, out[0][1]]);
  const obj: KeyframeObject<T> = {};
  for (const [t, v] of out) obj[formatKey(t)] = fmt(v);
  return obj;
}

export const kfNumber = (curve: Curve<number>): KeyframeObject<number> => toKeyframes(curve, round6);
export const kfColor = (curve: Curve<RGB>): KeyframeObject<RGB> => toKeyframes(curve, cleanRGB);

export function cleanRGB(c: RGB): RGB {
  return [clampByte(c[0]), clampByte(c[1]), clampByte(c[2])];
}

function clampByte(x: number): number {
  return Number.isFinite(x) ? clamp(Math.round(x), 0, 255) : 0;
}

export function parseHexColor(value: unknown): RGB | null {
  if (typeof value !== 'string') return null;
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(value.trim());
  if (!m) return null;
  let hex = m[1];
  if (hex.length === 3) hex = hex.split('').map((ch) => ch + ch).join('');
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toHex(c: RGB): string {
  return '#' + cleanRGB(c).map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** a - b per channel (may be negative). */
export function rgbDelta(a: RGB, b: RGB): RGB {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

/** c + k * delta, clamped to 0..255. */
export function shiftRGB(c: RGB, delta: RGB, k = 1): RGB {
  return cleanRGB([c[0] + delta[0] * k, c[1] + delta[1] * k, c[2] + delta[2] * k]);
}

export const isZeroDelta = (d: RGB): boolean => d[0] === 0 && d[1] === 0 && d[2] === 0;

export function luminance(c: RGB): number {
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/**
 * Luminance-preserving per-channel multiplier for a tint colour: white, grey and black give
 * [1,1,1]; `strength` 1 gives the full hue of the colour at equal brightness. No channel moves
 * further than `maxDeviation` from 1, so saturated picks stay a tint instead of a colour flood.
 */
export function tintMultiplier(c: RGB, strength: number, maxDeviation = 0.5): RGB {
  const lum = luminance(c);
  if (!(lum > 0.5)) return [1, 1, 1];
  const dev = [0, 1, 2].map((i) => (c[i] / lum - 1) * strength);
  const worst = Math.max(...dev.map(Math.abs));
  const k = worst > maxDeviation ? maxDeviation / worst : 1;
  return [1 + dev[0] * k, 1 + dev[1] * k, 1 + dev[2] * k];
}

/**
 * JSON.stringify with 2-space indent, keeping flat arrays of numbers on one line
 * (`[255, 227, 215]`) for readability. The result is strict JSON.
 */
export function stringifyJson(value: unknown): string {
  const text = JSON.stringify(value, null, 2);
  return text.replace(/\[\s*((?:-?[\d.eE+-]+\s*,\s*)*-?[\d.eE+-]+)\s*\]/g, (_m, inner: string) =>
    '[' + inner.split(',').map((s) => s.trim()).join(', ') + ']',
  ) + '\n';
}
