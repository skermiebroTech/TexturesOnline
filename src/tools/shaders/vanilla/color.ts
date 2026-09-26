// Colour math shared by the GLSL generator (baked constants) and the preview mapping, so both
// describe exactly the same grade. Colours are display-referred sRGB values in 0..1.

import type { RGB, Settings } from './options';

export type Vec3 = [number, number, number];
export const LUMA: Vec3 = [0.2126, 0.7152, 0.0722];

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
const luma = (c: Vec3): number => c[0] * LUMA[0] + c[1] * LUMA[1] + c[2] * LUMA[2];
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Same white balance curve as the in-browser preview, normalised so brightness is kept. */
export function whiteBalance(temperature: number): Vec3 {
  const t = clamp(temperature, -1, 1);
  const wb: Vec3 = [1 + 0.16 * t, 1 + 0.02 * t, 1 - 0.2 * t];
  const l = luma(wb);
  return [wb[0] / l, wb[1] / l, wb[2] / l];
}

/** Hue-only tint: the colour normalised to luma 1 (kept within 0..4), blended in by strength. */
export function tintMultiplier(color: RGB, strength: number): Vec3 {
  const c: Vec3 = [color[0] / 255, color[1] / 255, color[2] / 255];
  const l = Math.max(luma(c), 0.05);
  const s = clamp(strength, 0, 1);
  return [mix(1, clamp(c[0] / l, 0, 4), s), mix(1, clamp(c[1] / l, 0, 4), s), mix(1, clamp(c[2] / l, 0, 4), s)];
}

/** brightness × white balance × tint, baked into one RGB multiplier. */
export function colorMultiplier(s: Settings): Vec3 {
  const wb = whiteBalance(s.temperature);
  const tint = tintMultiplier(s.tintColor, s.tintStrength);
  return [s.brightness * wb[0] * tint[0], s.brightness * wb[1] * tint[1], s.brightness * wb[2] * tint[2]];
}

export function fogTintMultiplier(s: Settings): Vec3 {
  return tintMultiplier(s.fogTint, s.fogTintStrength);
}

const EPS = 1e-6;
const isOne = (x: number): boolean => Math.abs(x - 1) < EPS;
const isZero = (x: number): boolean => Math.abs(x) < EPS;

/** Which grading steps change anything (steps at neutral values are left out of the GLSL). */
export interface GradeSteps {
  multiply: boolean;
  contrast: boolean;
  saturation: boolean;
  vibrance: boolean;
  gamma: boolean;
  grayscale: boolean;
  sepia: boolean;
  posterize: boolean;
}

export function gradeSteps(s: Settings): GradeSteps {
  const m = colorMultiplier(s);
  return {
    multiply: !(isOne(m[0]) && isOne(m[1]) && isOne(m[2])),
    contrast: !isOne(s.contrast),
    saturation: !isOne(s.saturation) || !isZero(s.vibrance),
    vibrance: !isZero(s.vibrance),
    gamma: !isOne(s.gamma),
    grayscale: s.grayscale > EPS,
    sepia: s.sepia > EPS,
    posterize: s.posterize >= 2,
  };
}

export function hasGrade(s: Settings): boolean {
  return Object.values(gradeSteps(s)).some(Boolean);
}

export function hasVignette(s: Settings): boolean {
  return s.vignette > EPS;
}

export function hasFogChange(s: Settings): { start: boolean; environment: boolean; tint: boolean } {
  const t = fogTintMultiplier(s);
  return {
    start: s.fogStart < 1 - EPS,
    environment: !isOne(s.fogEnvironment),
    tint: !(isOne(t[0]) && isOne(t[1]) && isOne(t[2])),
  };
}

/**
 * Reference implementation of the generated txo_grade() in JavaScript (same order and constants),
 * used by tests and handy for colour swatches.
 */
export function gradeColor(rgb: Vec3, s: Settings): Vec3 {
  const steps = gradeSteps(s);
  let c: Vec3 = [rgb[0], rgb[1], rgb[2]];
  if (steps.multiply) {
    const m = colorMultiplier(s);
    c = [Math.max(c[0], 0) * m[0], Math.max(c[1], 0) * m[1], Math.max(c[2], 0) * m[2]];
  }
  if (steps.contrast) c = c.map((x) => (x - 0.5) * s.contrast + 0.5) as Vec3;
  if (steps.saturation) {
    const l = luma(c);
    const spread = clamp(Math.max(...c) - Math.min(...c), 0, 1);
    const f = s.saturation + s.vibrance * (1 - spread);
    c = c.map((x) => mix(l, x, f)) as Vec3;
  }
  c = c.map((x) => clamp(x, 0, 1)) as Vec3;
  if (steps.gamma) c = c.map((x) => Math.pow(x, 1 / s.gamma)) as Vec3;
  if (steps.grayscale) {
    const l = luma(c);
    c = c.map((x) => mix(x, l, s.grayscale)) as Vec3;
  }
  if (steps.sepia) {
    const sep: Vec3 = [
      Math.min(1, c[0] * 0.393 + c[1] * 0.769 + c[2] * 0.189),
      Math.min(1, c[0] * 0.349 + c[1] * 0.686 + c[2] * 0.168),
      Math.min(1, c[0] * 0.272 + c[1] * 0.534 + c[2] * 0.131),
    ];
    c = [mix(c[0], sep[0], s.sepia), mix(c[1], sep[1], s.sepia), mix(c[2], sep[2], s.sepia)];
  }
  if (steps.posterize) {
    const lv = s.posterize - 1;
    c = c.map((x) => Math.floor(x * lv + 0.5) / lv) as Vec3;
  }
  return c.map((x) => clamp(x, 0, 1)) as Vec3;
}

/**
 * Vignette factor for a point in aspect-corrected screen space (y in -0.5..0.5, x scaled by the
 * aspect ratio, 0 = centre). Identical to the preview's lens vignette.
 */
export function vignetteFactor(p: [number, number], strength: number): number {
  const r = Math.hypot(p[0], p[1]) * 1.25;
  const t = clamp((r - 0.25) / 0.8, 0, 1);
  return 1 - strength * t * t * (3 - 2 * t);
}

/** Minecraft's GameTime uniform wraps once per in-game day (1200 s); waves use whole cycles per day. */
export const GAME_TIME_DAY_SECONDS = 1200;
export const BASE_WAVE_PERIOD = 2;
export const MAX_WAVE_AMPLITUDE = 0.14;

export function waveParams(s: Settings): { amplitude: number; cyclesA: number; cyclesB: number } {
  const period = BASE_WAVE_PERIOD / clamp(s.waveSpeed, 0.05, 20);
  const cyclesA = Math.max(1, Math.round(GAME_TIME_DAY_SECONDS / period));
  const cyclesB = Math.max(1, Math.round(cyclesA * 0.77));
  return { amplitude: MAX_WAVE_AMPLITUDE * clamp(s.waveAmount, 0, 1), cyclesA, cyclesB };
}
