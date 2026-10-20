// English text of the converter engine (convert.ts, loose.ts): errors, progress, the report's notes
// and the reason given for each texture. Loads with the engine. Translations: ./<lang>.ts.

import { defineText } from '../../../i18n/editor-text';

export const engineText = defineText('convert.engine', {
  /** {loaded} and {target} are "Bedrock" or "Java 26.3" */
  wrongAssets: 'The loaded game files are for {loaded}, not {target}.',
  sameTarget: 'This pack is already for {target}. Pick another edition or version.',
  noMaps: 'The Java/Bedrock texture list is missing, so the pack can’t be converted.',
  matching: 'Matching texture names…',
  /** Progress: "Converting textures… 120 / 900" */
  converting: 'Converting textures… {done} / {total}',
  carrying: 'Carrying over pack files…',
  notes: {
    readFailures: "{count, plural, one {# vanilla texture couldn't be loaded, so its size wasn’t checked.} other {# vanilla textures couldn't be loaded, so their sizes weren’t checked.}}",
    tgaToPng: '{count, plural, one {# TGA image was saved as PNG, the format Java uses.} other {# TGA images were saved as PNG, the format Java uses.}}',
    rangeReplaced: "The pack's version range ({from} – {to}) was replaced by Java {version} only. You can set a range again in the Pack settings.",
    kept: "{count, plural, one {# texture isn't part of vanilla Java {version}. It was kept in case the pack's own models use it.} other {# textures aren't part of vanilla Java {version}. They were kept in case the pack's own models use them.}}",
    modelsRewritten: '{count, plural, one {# model file had its texture names updated.} other {# model files had their texture names updated.}}',
    modelsRenamed: 'Minecraft also renamed some models and block states between these versions. Check that the pack’s custom models still work in game.',
    /** {edition} is "Java" or "Bedrock" */
    dropped: '{count, plural, one {# other file (models, sounds, fonts, texts…) was left out: {edition} uses different formats for it.} other {# other files (models, sounds, fonts, texts…) were left out: {edition} uses different formats for them.}}',
  },
  /** Why a texture was skipped (one line per texture in the report) */
  skip: {
    duplicate: '{name} already fills {target}',
    notTextures: 'Not in the textures folder',
    removedIn: 'Removed in Java {version}',
    noBedrock: 'Bedrock has no matching texture',
    notInBedrock: 'Not in this Bedrock version',
    noJava: 'Java has no matching texture',
    notInJava: 'Not in Java {version}',
    /** {edition} is "Java" or "Bedrock" */
    layout: 'Laid out differently in {edition}',
    storage: "Couldn't be read from this browser's storage",
    notImage: 'Not a readable image',
    /** {target} is "Bedrock" or "Java 26.3" */
    size: 'Its size doesn’t fit the {target} texture',
  },
  /** Short notes on a converted texture */
  converted: {
    animation: 'animation converted',
    bedrockStill: 'first frame only: Bedrock can’t animate this texture',
    needsMcmeta: 'first frame only: its animation needs a .mcmeta file',
    savedAsTga: 'saved as TGA',
    javaStill: 'first frame only: Java doesn’t animate this texture',
  },
  /** Kinds of files left out of a converted pack */
  kind: {
    model: 'Model',
    blockState: 'Block state or item definition',
    sound: 'Sound',
    font: 'Font',
    lang: 'Language file',
    shader: 'Shader',
    optifine: 'OptiFine file',
    gameData: 'Game data file',
    modTexture: 'Mod texture',
    animation: 'Animation settings',
    animationRemoved: 'Animation settings (removed in Java {version})',
    overlay: 'Overlay folder file',
    image: 'Image that isn’t a texture',
    other: 'Other file',
    subpack: 'Sub-pack file',
    pbr: 'Vibrant Visuals (PBR) file',
    menu: 'Menu layout',
    particle: 'Particle definition',
    textureSettings: 'Texture settings',
  },
  loose: {
    choose: 'Choose a .zip, .mcpack or .mcaddon pack, or PNG textures.',
    noMatch: 'None of the images are named like Minecraft textures. Name them after the texture they replace, for example stone.png or block/stone.png.',
    nothing: "This archive doesn't contain a resource pack or any PNG textures.",
    /** {files} lists up to three file names */
    unmatched: "{count, plural, one {# image didn't match a texture name and was left out: {files}.} other {# images didn't match a texture name and were left out: {files}.}}",
    /** {files} followed by "and 4 more" */
    andMore: '{files} and {count} more',
  },
});

export type ConvertEngineText = typeof engineText;
