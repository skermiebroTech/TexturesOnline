// Turns a picked sound (decoded samples) into what goes into the pack: trimmed, levelled, mono or
// stereo, with tiny fades so cut points don't click. Pure functions on Float32Arrays.

export interface RenderParams {
  /** Seconds */
  start: number;
  end: number;
  /** Linear volume */
  gain: number;
  stereo: boolean;
}

/** Sample rate every picked sound is decoded to (and saved at). */
export const SOUND_RATE = 44100;
/** Fade at each cut, in seconds */
const FADE = 0.004;
/** Peak level "Normalise" aims for (about -0.5 dBFS) */
export const NORMAL_PEAK = 0.944;
export const MIN_LENGTH = 0.02;

export function clampParams(p: RenderParams, duration: number): RenderParams {
  let start = Math.max(0, Math.min(p.start, duration));
  let end = Math.max(0, Math.min(p.end, duration));
  if (end - start < MIN_LENGTH) {
    end = Math.min(duration, start + MIN_LENGTH);
    start = Math.max(0, end - MIN_LENGTH);
  }
  const gain = Number.isFinite(p.gain) ? Math.max(0, Math.min(4, p.gain)) : 1;
  return { start, end, gain, stereo: p.stereo };
}

/** Samples to save: the trimmed range, scaled by gain, faded in/out, clipped to -1..1. */
export function renderSamples(channels: Float32Array[], sampleRate: number, params: RenderParams): Float32Array[] {
  const length = channels[0]?.length ?? 0;
  const duration = length / sampleRate;
  const p = clampParams(params, duration);
  const a = Math.round(p.start * sampleRate);
  const b = Math.max(a + 1, Math.round(p.end * sampleRate));
  const n = Math.min(length, b) - a;
  const src = p.stereo && channels.length >= 2 ? [channels[0], channels[1]] : [mix(channels)];
  const fade = Math.min(Math.floor(n / 4), Math.round(FADE * sampleRate));
  return src.map((ch) => {
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let g = p.gain;
      if (i < fade) g *= i / fade;
      else if (n - 1 - i < fade) g *= (n - 1 - i) / fade;
      const v = ch[a + i] * g;
      out[i] = v > 1 ? 1 : v < -1 ? -1 : v;
    }
    return out;
  });
}

/** Average of all channels (the whole length). */
export function mix(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0];
  const n = channels[0].length;
  const out = new Float32Array(n);
  for (const ch of channels) for (let i = 0; i < n; i++) out[i] += ch[i];
  const k = 1 / channels.length;
  for (let i = 0; i < n; i++) out[i] *= k;
  return out;
}

/** Highest absolute sample between start and end (seconds), over all channels. */
export function peakOf(channels: Float32Array[], sampleRate: number, start = 0, end = Infinity): number {
  let peak = 0;
  for (const ch of channels) {
    const a = Math.max(0, Math.floor(start * sampleRate));
    const b = Math.min(ch.length, Math.ceil(end * sampleRate));
    for (let i = a; i < b; i++) {
      const v = Math.abs(ch[i]);
      if (v > peak) peak = v;
    }
  }
  return peak;
}

/** Volume that brings the loudest sample of the range to NORMAL_PEAK (1 for silence). */
export function normaliseGain(channels: Float32Array[], sampleRate: number, start: number, end: number): number {
  const peak = peakOf(channels, sampleRate, start, end);
  if (peak < 1e-4) return 1;
  return Math.min(4, Math.round((NORMAL_PEAK / peak) * 100) / 100);
}

/**
 * Start and end (seconds) without the quiet lead-in and tail: the first and last moments louder than
 * `threshold` (default about -46 dBFS), with a little air kept around them.
 */
export function soundRange(channels: Float32Array[], sampleRate: number, threshold = 0.005, pad = 0.03): { start: number; end: number } {
  const n = channels[0]?.length ?? 0;
  const loud = (i: number) => channels.some((ch) => Math.abs(ch[i]) > threshold);
  let a = 0;
  while (a < n && !loud(a)) a++;
  if (a >= n) return { start: 0, end: n / sampleRate };
  let b = n - 1;
  while (b > a && !loud(b)) b--;
  return { start: Math.max(0, a / sampleRate - pad), end: Math.min(n / sampleRate, (b + 1) / sampleRate + pad) };
}

/**
 * Min/max pairs for drawing a waveform `columns` wide (all channels together):
 * out[2i] = min, out[2i + 1] = max of column i.
 */
export function waveformPeaks(channels: Float32Array[], columns: number): Float32Array {
  const n = channels[0]?.length ?? 0;
  const out = new Float32Array(Math.max(0, columns) * 2);
  if (!n || columns <= 0) return out;
  for (let c = 0; c < columns; c++) {
    const a = Math.floor((c * n) / columns);
    const b = Math.max(a + 1, Math.floor(((c + 1) * n) / columns));
    let lo = 0;
    let hi = 0;
    for (const ch of channels) {
      for (let i = a; i < b && i < n; i++) {
        const v = ch[i];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    out[c * 2] = lo;
    out[c * 2 + 1] = hi;
  }
  return out;
}
