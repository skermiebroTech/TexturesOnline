import type { OptionValues } from '../../../core/types';
import { changesClassicFog, needsModernEngine } from './generate';
import { readSettings } from './options';

export interface BedrockNote {
  id: 'what' | 'devices' | 'graphics' | 'activate' | 'stacking' | 'limits' | 'fog';
  title: string;
  text: string;
}

/** Short user-facing explanations for the Bedrock shader maker. */
export const BEDROCK_VV_NOTES: readonly BedrockNote[] = [
  {
    id: 'what',
    title: 'What this makes',
    text: "A Vibrant Visuals pack: it tunes Minecraft's own built-in shader with official settings for sunlight, sky, fog, water, shadows and color grading. No mods needed.",
  },
  {
    id: 'devices',
    title: 'Needs a Vibrant Visuals device',
    text: 'Vibrant Visuals runs on supported Windows PCs, Xbox and PlayStation consoles, and newer phones and tablets (not on Nintendo Switch 1, Chromebooks or Fire tablets). Servers can turn it off.',
  },
  {
    id: 'graphics',
    title: 'Switch the graphics mode',
    text: 'In Settings > Video, set Graphics Mode to Vibrant Visuals. In Simple or Fancy mode only the classic fog changes are visible.',
  },
  {
    id: 'activate',
    title: 'Activate it as a global pack',
    text: 'Open the .mcpack to import it, then turn it on under Settings > Global Resources so it applies to every world.',
  },
  {
    id: 'stacking',
    title: 'Other packs can switch it off',
    text: 'Every active resource pack must support Vibrant Visuals. A regular texture pack in the list turns the graphics mode back to Fancy.',
  },
  {
    id: 'limits',
    title: 'What cannot be changed',
    text: 'Bedrock does not allow custom shader code (GLSL) in packs, so effects like bloom strength, exposure, reflections, clouds or waving leaves stay as Minecraft draws them.',
  },
  {
    id: 'fog',
    title: 'Classic fog works everywhere',
    text: 'Distance fog and underwater visibility changes apply in every graphics mode, not only Vibrant Visuals.',
  },
];

/** Manifest settings for buildResourceManifest: the pack must declare `pbr` to enable Vibrant Visuals. */
export function bedrockManifestOptions(v: OptionValues): { capabilities: string[]; minEngine: [number, number, number] } {
  const s = readSettings(v);
  return {
    capabilities: ['pbr'],
    minEngine: needsModernEngine(s) ? [1, 26, 0] : [1, 21, 120],
  };
}

/** Version and compatibility hints for the current settings (empty when nothing special applies). */
export function bedrockCompatibilityNotes(v: OptionValues): string[] {
  const s = readSettings(v);
  const notes: string[] = [];
  if (s.nightBrightness > 0 || s.biomeWaterColor > 0) {
    const what = [s.nightBrightness > 0 ? 'Brighter nights' : '', s.biomeWaterColor > 0 ? 'Biome water colors' : ''].filter(Boolean).join(' and ');
    notes.push(`${what} need${s.nightBrightness > 0 && s.biomeWaterColor > 0 ? '' : 's'} Minecraft 26.0 or newer, so the pack will not load on older versions.`);
  }
  if (s.coloredLights) notes.push('Colored block light shows on Minecraft 26.10 or newer; older versions ignore it.');
  if (changesClassicFog(s)) notes.push('Your distance and underwater fog changes also apply outside Vibrant Visuals.');
  return notes;
}
