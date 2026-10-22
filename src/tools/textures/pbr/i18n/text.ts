// English text of the Material tab of the texture pack editor (../panel.ts), loaded with that tab.
// Translations: ./<lang>.ts, loaded by ./load.ts.

import { defineText } from '../../../../i18n/editor-text';

export const tm = defineText('textures.pbr', {
  /** {name} is the texture's file name, e.g. "diamond_ore.png" */
  forTexture: 'Material of {name}',
  intro: {
    java: 'Shine, glow and bumps for PBR shaders in Iris or OptiFine (labPBR).',
    bedrock: 'Shine, glow and bumps for Vibrant Visuals.',
  },
  /** Under the controls: how to see the materials in game */
  about: {
    java: 'To see them, turn on a shader that reads labPBR maps (in its settings this is often called labPBR or resource pack support). The shaders from this site’s shader maker don’t use them yet.',
    bedrock: 'To see them, set Settings → Video → Graphics Mode to Vibrant Visuals. A pack with materials keeps Vibrant Visuals on; textures you change without giving them a material keep the game’s.',
  },
  empty: { title: 'Open a texture', text: 'Pick a block or item texture to give it a material: how shiny it is, which parts are metal, which parts glow and how bumpy it looks.' },
  flat: 'Materials are for blocks, items and mobs. The game draws this texture flat, so it would ignore one.',
  preview: {
    label: '3D preview of the material: drag to turn the block',
    noGl: 'The 3D preview needs WebGL, which this browser has switched off.',
    light: 'Light',
    lightHint: 'Where the sun shines from',
    move: 'Move the light',
    stop: 'Hold the light still',
    night: 'Night',
    nightHint: 'Dark all around, so glowing parts stand out',
    day: 'Day',
  },
  maps: {
    look: 'Look',
    shine: 'Shine',
    metal: 'Metal',
    glow: 'Glow',
    through: 'Light through',
    bumps: 'Bumps',
    /** Accessible name of the map buttons */
    show: 'Show on the block',
    hints: {
      look: 'The texture with light on it, as a PBR shader or Vibrant Visuals draws it',
      shine: 'The shine map: white is smooth and shiny, black is rough',
      metal: 'The metal map: white parts are metal',
      glow: 'The glow map: white parts give off light',
      through: 'The light-through map: white parts let light shine through, like leaves',
      bumps: 'The bump map (a normal map): which way each pixel faces, so light and shadow show bumps and dents',
    },
  },
  presets: {
    title: 'Quick materials',
    none: 'None',
    noneHint: 'No material: the texture looks as it always does',
    game: 'The game’s',
    gameHint: 'The material Minecraft gives this texture',
    names: {
      metal: 'Metal',
      polished: 'Polished stone',
      rough: 'Rough stone',
      wood: 'Wood',
      glass: 'Glass',
      glow: 'Glowing',
      glowSpots: 'Glowing spots',
      water: 'Water',
      plants: 'Leaves and plants',
    },
    hints: {
      metal: 'Shiny metal that reflects the sky, like iron or gold blocks',
      polished: 'Smooth and a little shiny, like polished granite or quartz',
      rough: 'Matte and bumpy, like stone, cobblestone or dirt',
      wood: 'Mostly matte with soft bumps, like planks and logs',
      glass: 'Very smooth and shiny, like glass or ice',
      glow: 'The whole texture gives off light, like glowstone or a lamp',
      glowSpots: 'Only the colourful spots glow, like the gems in ores',
      water: 'Smooth and shiny with soft waves',
      plants: 'Light shines through, like leaves, grass and flowers',
    },
    /** {name} is a quick material, {texture} a file name */
    applied: '{name} on {texture}',
    removed: 'Material taken off {texture}',
    undo: 'Undo',
  },
  parts: {
    title: 'Fine-tune',
    whole: 'Whole texture',
    /** A part of the texture with its own values: "Part 1" */
    part: 'Part {n}',
    add: 'Add a part',
    addHint: 'Give some pixels their own values, like glowing spots',
    remove: 'Remove this part',
    which: 'Which pixels',
    kinds: {
      colourful: 'Colourful pixels',
      bright: 'Bright pixels',
      dark: 'Dark pixels',
      colour: 'Pixels of some colours',
      area: 'An area you select',
    },
    amount: { colourful: 'How colourful', bright: 'How bright', dark: 'How dark' },
    colours: 'Click the colours this part covers:',
    coloursTouch: 'Tap the colours this part covers:',
    tolerance: 'Similar colours too',
    area: 'Select an area with the select tool (M) in the pixel editor, then use it here.',
    areaTouch: 'Select an area with the select tool in the pixel editor, then use it here.',
    useSelection: 'Use the selected area',
    noSelection: 'Select an area in the pixel editor first.',
    /** {w} × {h} pixels from {x}, {y} */
    areaSize: '{w} × {h} pixels from {x}, {y}',
    covers: '{count, plural, =0 {No pixels} one {# pixel} other {# pixels}}',
    maskHint: 'The pixels this part covers (the others are dimmed)',
    mapNote: 'This texture has a map from the pack or the game. Moving a slider here gives the whole texture one value instead.',
  },
  values: {
    shine: 'Shine',
    shineHint: 'How smooth it is. Low: rough like stone. High: shiny like glass.',
    metal: 'Metal',
    metalHint: 'Metal reflects its own colour. Use 0 or 100: things are metal or not.',
    glow: 'Glow',
    glowHint: 'How much light it gives off, even at night.',
    through: 'Light through',
    throughHint: 'How much light shines through, like through leaves. Only for parts that aren’t metal.',
  },
  bumps: {
    title: 'Bumps',
    make: 'Bumps from the colours',
    makeHint: 'Bright pixels stick out and dark ones sink in, so light and shadow show the shape.',
    strength: 'Strength',
    smooth: 'Smoothing',
    invert: 'Dark parts stick out',
    invertHint: 'For textures whose dark pixels are the raised parts',
    packMap: 'Uses the bump map from the pack or the game. Switch on “Bumps from the colours” to make new ones.',
  },
  similar: {
    button: 'Use on similar textures…',
    title: 'Use this material on similar textures',
    intro: 'The textures you tick get the same values, parts and bumps. Each keeps its own colours, so colourful spots and bumps follow its pixels.',
    /** {name} is a block name such as "furnace" */
    sides: 'The other sides of {name}',
    /** {word} is a word such as "ore" */
    suffix: 'Names ending in “_{word}”',
    prefix: 'Names starting with “{word}_”',
    more: '+{count} more',
    none: 'There are no similar textures in this folder.',
    apply: '{count, plural, =0 {Use on textures} one {Use on # texture} other {Use on # textures}}',
    applied: '{count, plural, one {Material used on # texture} other {Material used on # textures}}',
  },
  remove: 'Take the material off',
  /** Which files the export writes: {files} are file names */
  files: {
    java: 'Exported as {files}, next to the texture.',
    bedrock: 'Exported as {files}.',
  },
});

export type PbrText = typeof tm;
