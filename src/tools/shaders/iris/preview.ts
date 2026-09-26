// Maps the Iris pack options onto the generic in-browser preview parameters so the preview
// resembles what the pack renders in game.

import type { OptionValues, PreviewParams } from '../../../core/types';
import { readSettings, type RGB, type Tonemap } from './options';

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
const round = (x: number): number => Math.round(x * 1e6) / 1e6;
const unit = (c: RGB): [number, number, number] => [round(c[0] / 255), round(c[1] / 255), round(c[2] / 255)];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const scale = (c: [number, number, number], k: number): [number, number, number] =>
  [round(clamp(c[0] * k, 0, 4)), round(clamp(c[1] * k, 0, 4)), round(clamp(c[2] * k, 0, 4))];

// Vanilla plains colours the pack blends with (customSky = 0 shows these).
const VANILLA_SKY: RGB = [120, 167, 255];
const VANILLA_HORIZON: RGB = [192, 216, 255];

// Mid-tone brightness and contrast of each tone mapper relative to ACES (what the preview uses).
const TONEMAP_LOOK: Record<Tonemap, { exposure: number; contrast: number }> = {
  aces: { exposure: 1, contrast: 1 },
  filmic: { exposure: 0.97, contrast: 0.96 },
  reinhard: { exposure: 1.02, contrast: 0.88 },
  none: { exposure: 1.08, contrast: 1.06 },
};

export function toPreviewParams(v: OptionValues): PreviewParams {
  const s = readSettings(v);
  const look = TONEMAP_LOOK[s.tonemap];
  const sky = mix(VANILLA_SKY, s.skyColor, s.customSky);
  const horizon = mix(VANILLA_HORIZON, s.horizonColor, s.customSky);

  // Sunlit areas scale with the sun; ambient-only areas with the ambient light.
  const light = 0.62 * (0.35 + 0.65 * s.sunStrength) + 0.38 * s.ambientStrength;
  const exposure = Math.pow(2, s.exposure) * look.exposure * Math.pow(light, 0.6);

  const satBoost = 1 + 0.35 * s.vibrance;
  const waving = s.wavingLeaves || s.wavingPlants || s.wavingCrops || s.wavingVines
    ? clamp(0.5 * s.wavingAmount * (0.7 + 0.3 * Math.min(s.wavingSpeed, 2)), 0, 1)
    : 0;

  // White balance as in final.fsh, normalised to keep brightness.
  const wb: [number, number, number] = [1 + 0.15 * s.tint, 1 - 0.15 * s.tint, 1 + 0.15 * s.tint];
  const wbLuma = 0.2126 * wb[0] + 0.7152 * wb[1] + 0.0722 * wb[2];

  return {
    exposure: round(clamp(exposure, 0.1, 8)),
    contrast: round(clamp(s.contrast * look.contrast, 0.3, 2.5)),
    saturation: round(clamp(s.saturation * satBoost, 0, 3)),
    gamma: round(clamp(s.gamma, 0.5, 2)),
    temperature: round(clamp(s.temperature * 0.8, -1, 1)),
    tint: [round(wb[0] / wbLuma), round(wb[1] / wbLuma), round(wb[2] / wbLuma)],
    vignette: round(clamp(s.vignette, 0, 1)),
    bloom: round(clamp(s.bloomStrength * 1.6 * (1.25 - 0.25 * clamp(s.bloomThreshold, 0, 3)), 0, 1)),
    shadowStrength: s.shadows ? round(clamp(0.95 * (1 - s.shadowBrightness) * (1.05 - 0.15 * s.ambientStrength), 0, 1)) : 0,
    sunColor: scale(unit(s.sunColor), clamp(0.5 + 0.5 * s.sunStrength, 0, 2)),
    skyTop: unit(sky),
    skyHorizon: unit(horizon),
    fogColor: unit(mix(horizon, sky, 0.15)),
    fogDensity: round(clamp(0.12 * s.fogDensity, 0, 1)),
    waterColor: unit(s.waterColor),
    waterClarity: round(clamp(s.waterTransparency, 0, 1)),
    waving: round(waving),
    godrays: round(clamp(s.godrays * 0.55, 0, 1)),
    timeOfDay: 4800,
    grayscale: s.saturation <= 0.02 ? 1 : 0,
    sepia: 0,
    posterize: 0,
  };
}
