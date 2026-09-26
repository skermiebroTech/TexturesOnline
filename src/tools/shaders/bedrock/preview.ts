import type { OptionValues, PreviewParams } from '../../../core/types';
import type { RGB } from './keyframes';
import { clamp, round6, tintMultiplier } from './keyframes';
import { WATER_STYLES, readSettings } from './options';

const unit = (c: RGB): [number, number, number] => [round6(c[0] / 255), round6(c[1] / 255), round6(c[2] / 255)];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const CLASSIC_AIR_FOG: RGB = [171, 210, 255];

/**
 * Approximates the in-game Vibrant Visuals look with the generic preview parameters.
 * Default options map to a neutral-ish preview close to vanilla Vibrant Visuals.
 */
export function toPreviewParams(v: OptionValues): PreviewParams {
  const s = readSettings(v);
  const style = WATER_STYLES[s.waterStyle];

  // Auto-exposure absorbs most of a sun-brightness change; keep only a gentle share of it.
  const exposure = clamp(s.brightness * (1 + 0.12 * Math.log2(s.sunBrightness)), 0.2, 3);
  const contrast = clamp(1 + (s.contrast - 1) * 0.8, 0.3, 2.5);
  const saturation = clamp(s.saturation, 0, 2.5);
  const tone = s.toneMapper === 'aces' ? 1.06 : s.toneMapper === 'hable' ? 1.03 : s.toneMapper.startsWith('reinhard') ? 0.94 : 1;

  let fogDensity = 0.12 * s.fogAmount;
  if (s.classicFog) fogDensity += clamp((1 - s.fogDistance) * 0.6, -0.1, 0.6);

  const waterClarity = style.clarity * (s.classicFog ? clamp(0.75 + 0.25 * s.underwaterVisibility, 0.5, 1.4) : 1);

  return {
    exposure: round6(exposure),
    contrast: round6(clamp(contrast * tone, 0.3, 2.5)),
    saturation: round6(saturation),
    gamma: 1,
    temperature: round6(clamp(s.warmth / 100, -1, 1)),
    tint: tintMultiplier(s.tint, 0.6).map((x) => round6(clamp(x, 0, 2))) as [number, number, number],
    vignette: s.toneMapper === 'aces' || s.toneMapper === 'hable' ? 0.12 : 0,
    bloom: round6(clamp(0.22 + 0.1 * Math.log2(s.sunBrightness) + 0.05 * (s.sunsetGlow - 1), 0, 1)),
    shadowStrength: round6(clamp(0.6 + (1 - s.shadowFill) * 0.45, 0, 1)),
    sunColor: unit(s.daylightColor),
    skyTop: unit(s.skyColor),
    skyHorizon: unit(s.horizonColor),
    fogColor: unit(mix(s.horizonColor, CLASSIC_AIR_FOG, 0.5)),
    fogDensity: round6(clamp(fogDensity, 0, 1)),
    waterColor: unit(style.color),
    waterClarity: round6(clamp(waterClarity, 0, 1)),
    // Bedrock has no foliage sway and packs cannot add it; water waves are drawn by the preview itself.
    waving: 0,
    godrays: round6(clamp(0.25 * s.fogAmount * (1 + s.lightShafts * 1.5), 0, 1)),
    timeOfDay: 6000,
    grayscale: 0,
    sepia: 0,
    posterize: 0,
  };
}
