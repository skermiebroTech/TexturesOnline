// English text of what the generators tell the user: which effects work in a Java version
// (../../vanilla/support.ts), the warnings of a vanilla export (../../vanilla/generate.ts) and the
// Bedrock version hints (../../bedrock/notes.ts). The generators are pure (they also run in Node,
// where this stays English) and format these when they run, never at load. Nothing here goes into
// the exported files. Translations: ./<lang>.ts.

import { defineText } from '../../../../i18n/editor-text';

export const mt = defineText('shaders.messages', {
  vanilla: {
    /** {version} is "Java 26.3" or thisVersion */
    missingSources: 'The shader files of {version} could not be read, so nothing was changed. Load the game files again (or pick the client .jar again) and export once more.',
    thisVersion: 'this version',
    noCoreShaders: 'Vanilla shaders need Java Edition 1.17 or newer. Older versions have no core shaders a resource pack can change. Pick 1.17+ or use the Iris / OptiFine target instead.',
    reasons: {
      bloom: 'Bloom needs Java 26.3 or newer (the first version with an always-on full-screen effect).',
      waving: 'Waving plants work in Java 1.17 – 1.21.4 and 1.21.6 – 1.21.10.',
      fogEnvironment: 'Separate water and weather fog exists from Java 1.21.6 on.',
      nightDarkness: 'The light map became a shader in Java 1.21.2.',
      fog: 'This version has an unfamiliar fog shader, so fog cannot be changed.',
      snapshot: 'This snapshot uses the new shader compiler but has no full-screen effect hook yet, so colors cannot be changed safely.',
      wavingNoTime: 'Java 1.21.5 does not give the terrain shader a game time, so plants cannot move.',
      /** {order} is empty or wavingOrder */
      wavingMerged: 'From Java 1.21.11 on, plants share one render layer with grass blocks and leaves{order}, so waving would bend whole blocks.',
      wavingOrder: ' and vertex order is no longer predictable',
      wavingNoShader: 'This version has no recognisable terrain vertex shader.',
      wavingNoTerrain: 'This version has no terrain vertex shader.',
      wavingLayer: 'In this version plants share one render layer with grass blocks and leaves, so waving would bend whole blocks.',
    },
    notes: {
      exact: 'The pack only works in the exact version it was made for. Shaders change between versions, so make a new pack for each version.',
      perObject: 'Colors are adjusted per object (world, sky, hand and entities) rather than on the finished image. Menus, the hotbar and items in the inventory keep their normal look.',
      finished: 'Colors, vignette and bloom run on the finished image before menus and the hotbar are drawn, so the interface keeps its normal look.',
      unknown: 'This version could not be identified exactly; availability is checked again when its game files load.',
    },
    /** Export warnings; {file} is a shader file such as core/terrain.vsh */
    warnings: {
      noMain: 'Skipped {file}: it does not have exactly one main() function.',
      noMainVertex: 'Skipped {file}: {vertex}.vsh does not have exactly one main() function.',
      noWorldShader: 'Colors and vignette skipped: no world shader in this version matched the expected layout.',
      noPostShaders: 'Colors, vignette and bloom skipped: this version is missing the full-screen shaders they build on.',
      fogUnfamiliar: 'Fog settings skipped: this version has an unfamiliar fog shader.',
      /** {problem} is a technical detail such as "linear_fog() has 6 parameters instead of 5" */
      fogPart: 'Fog: {problem} in include/fog.glsl, so part of the fog settings is skipped.',
      fogEnvironment: 'Water & weather fog distance needs Java 1.21.6 or newer; it was left at vanilla.',
      /** {reason} is one of the waving reasons above */
      wavingSkipped: 'Waving plants skipped: {reason}',
      wavingUnexpected: 'Waving plants skipped: unexpected terrain vertex shader.',
      wavingNoInput: 'Waving plants skipped: the terrain shader has no {name} input.',
      wavingMatrices: 'Waving plants skipped: the terrain shader does not use the usual matrices.',
      wavingNoTime: 'Waving plants skipped: game time is not available to the terrain shader.',
      wavingJson: 'Waving plants: could not read {file}; plants drawn with it will not move.',
      nightsOld: 'Darker nights skipped: the light map became a shader in Java 1.21.2.',
      nightsUnexpected: 'Darker nights skipped: unexpected light map shader.',
      bloomOld: 'Bloom needs Java 26.3 or newer; it was left out for this version.',
      noHook: 'Colors and vignette skipped: this version uses the new shader compiler without the full-screen effect hook.',
      unchanged: 'Every setting matches vanilla, so this pack does not change how the game looks.',
    },
  },
  bedrock: {
    brighterNights: 'Brighter nights',
    biomeWater: 'Biome water colors',
    /** {what} is brighterNights, biomeWater or both joined with "and"; {count} is how many */
    needs26: '{what} {count, plural, one {needs} other {need}} Minecraft 26.0 or newer, so the pack will not load on older versions.',
    coloredLights: 'Colored block light shows on Minecraft 26.10 or newer; older versions ignore it.',
    classicFog: 'Your distance and underwater fog changes also apply outside Vibrant Visuals.',
  },
});

export type ShadersMessagesText = typeof mt;
