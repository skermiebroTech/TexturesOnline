import type { OptionValues, PreviewParams } from '../../../core/types';
import { readSettings } from './options';
import { tintMultiplier, waveParams, MAX_WAVE_AMPLITUDE } from './color';

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
const r6 = (x: number): number => Math.round(x * 1e6) / 1e6;
const v3 = (c: readonly number[]): [number, number, number] => [r6(c[0]), r6(c[1]), r6(c[2])];

// Vanilla overworld colours on a clear day (sky #78a7ff, fog #c0d8ff, water #3f76e4).
const SKY: [number, number, number] = [0.471, 0.655, 1];
const HORIZON: [number, number, number] = [0.753, 0.847, 1];
const WATER: [number, number, number] = [0.247, 0.463, 0.894];
const SUN: [number, number, number] = [1, 0.97, 0.9];

/**
 * Maps the options onto the preview. The grade uses the same order and constants as the generated
 * GLSL: exposure = brightness, temperature + tint = the same white balance and hue tint, then
 * contrast, saturation, gamma, black & white, sepia, posterize and the same lens vignette.
 */
export function toPreviewParams(v: OptionValues): PreviewParams {
  const s = readSettings(v);
  const fogTint = tintMultiplier(s.fogTint, s.fogTintStrength);
  const fogColor = HORIZON.map((c, i) => clamp(c * fogTint[i], 0, 1));
  // Vanilla has light distance fog only; moving its start closer thickens the haze.
  const fogDensity = clamp(0.1 + (1 - s.fogStart) * 0.55, 0, 1);
  const waterClarity = clamp(0.55 * Math.pow(s.fogEnvironment, 0.5), 0.15, 1);
  const wave = waveParams(s);
  return {
    exposure: r6(s.brightness),
    contrast: r6(s.contrast),
    // vibrance scales saturation by (1 - colour spread); 0.6 is a typical spread of Minecraft textures
    saturation: r6(clamp(s.saturation + s.vibrance * 0.4, 0, 3)),
    gamma: r6(s.gamma),
    temperature: r6(s.temperature),
    tint: v3(tintMultiplier(s.tintColor, s.tintStrength)),
    vignette: r6(s.vignette),
    bloom: s.bloom ? r6(s.bloomStrength * clamp(1.6 - s.bloomThreshold, 0.4, 1.3)) : 0,
    // Vanilla has no cast shadows or light shafts.
    shadowStrength: 0,
    sunColor: SUN,
    skyTop: SKY,
    skyHorizon: HORIZON,
    fogColor: v3(fogColor),
    fogDensity: r6(fogDensity),
    waterColor: WATER,
    waterClarity: r6(waterClarity),
    waving: s.waving ? r6(clamp((wave.amplitude / MAX_WAVE_AMPLITUDE) * Math.min(1, 0.5 + 0.5 * s.waveSpeed), 0, 1)) : 0,
    godrays: 0,
    timeOfDay: 6000,
    grayscale: r6(s.grayscale),
    sepia: r6(s.sepia),
    posterize: s.posterize,
  };
}
