// Colours for model tints: the default biome colours (plains, like the texture previews) unless a
// pack's own colour maps have been sampled.

import type { RGB, Tint } from './geometry';

export type BiomeColors = Record<'grass' | 'foliage' | 'dry_foliage' | 'birch' | 'evergreen' | 'water', RGB>;

/**
 * Plains grass and foliage (temperature 0.8, downfall 0.4), vanilla water, a warm dry-foliage brown,
 * and Java's birch and spruce leaf colours (Bedrock reads those from colour maps of their own).
 */
export const DEFAULT_BIOME_COLORS: BiomeColors = {
  grass: [0x91, 0xbd, 0x59],
  foliage: [0x77, 0xab, 0x2f],
  dry_foliage: [0xa3, 0x7a, 0x4a],
  birch: [0x80, 0xa7, 0x55],
  evergreen: [0x61, 0x99, 0x61],
  water: [0x3f, 0x76, 0xe4],
};

export function tintColor(t: Tint, biome: Partial<BiomeColors> = {}): RGB {
  if (t.kind === 'fixed') return t.rgb;
  return biome[t.kind] ?? DEFAULT_BIOME_COLORS[t.kind];
}
