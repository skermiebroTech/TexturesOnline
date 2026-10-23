// English text of biome colours in the texture pack editor: the view of a colour map
// (textures/colormap/*.png) in the Preview tab, the biomes marked on it and on the canvas, and the
// biome picked for the previews' grass, leaves and water. Loaded with the editor. Translations:
// ./<lang>.ts, loaded by ./load.ts.

import { defineText } from '../../../../i18n/editor-text';

export const tb = defineText('textures.biomes', {
  /** The game's names of the biomes (the game's own translations in other languages) */
  names: {
    desert: 'Desert',
    savanna: 'Savanna',
    badlands: 'Badlands',
    jungle: 'Jungle',
    sparse_jungle: 'Sparse Jungle',
    mushroom_fields: 'Mushroom Fields',
    swamp: 'Swamp',
    mangrove_swamp: 'Mangrove Swamp',
    plains: 'Plains',
    forest: 'Forest',
    dark_forest: 'Dark Forest',
    pale_garden: 'Pale Garden',
    birch_forest: 'Birch Forest',
    dappled_forest: 'Dappled Forest',
    cherry_grove: 'Cherry Grove',
    meadow: 'Meadow',
    river: 'River',
    taiga: 'Taiga',
    windswept_hills: 'Windswept Hills',
    snowy_taiga: 'Snowy Taiga',
    snowy_plains: 'Snowy Plains',
  },
  /** The game's names of the blocks shown coloured for the biome */
  blocks: {
    grass: 'Grass Block',
    foliage: 'Oak Leaves',
    dry_foliage: 'Leaf Litter',
    birch: 'Birch Leaves',
    evergreen: 'Spruce Leaves',
    swamp_grass: 'Grass Block',
    swamp_foliage: 'Oak Leaves',
    mangrove_swamp_foliage: 'Mangrove Leaves',
  },
  // ---- the biome picker of the 3D preview
  picker: 'Biome',
  pickerHint: 'Colour grass, leaves and water as in this biome',
  // ---- the colour map view (Preview tab, while a colour map is open)
  title: 'Biome colours',
  /** What the open colour map colours */
  uses: {
    grass: 'Grass blocks, grass, ferns and sugar cane take their colour from this picture.',
    foliage: 'Oak, jungle, acacia, dark oak and mangrove leaves and vines take their colour from this picture.',
    dry_foliage: 'Leaf litter takes its colour from this picture.',
    birch: 'Birch leaves take their colour from this picture.',
    evergreen: 'Spruce leaves take their colour from this picture.',
    swamp_grass: 'Grass in swamps and mangrove swamps takes its colour from this picture.',
    swamp_foliage: 'Leaves in swamps take their colour from this picture.',
    mangrove_swamp_foliage: 'Leaves in mangrove swamps take their colour from this picture.',
  },
  how: 'Each biome reads one pixel: the warmer it is, the further left; the rainier, the higher up.',
  /** Around the map */
  warm: 'Warm',
  cold: 'Cold',
  dry: 'Dry',
  rainy: 'Rainy',
  /** The top-right half of the map */
  unused: 'Not used',
  unusedHint: 'The game never reads the top-right half: rain counts less the colder a place is, so only warm places can be very rainy.',
  mapLabel: 'The colour map with the biomes on it',
  /** The list of biomes */
  biomes: 'Biomes',
  pickHint: 'Click a biome to colour the previews like it.',
  pickHintTouch: 'Tap a biome to colour the previews like it.',
  /** A biome in the list or on the map; {biome}: its name */
  pixel: 'Pixel {x}, {y}',
  colourHere: '{biome}: {hex}',
  /** The picked biome doesn't read the open map */
  ownColour: '{biome} has a colour of its own here: {hex}. This picture doesn’t change it.',
  noiseColour: '{biome}: the game uses {a} or {b} here, changing from place to place. This picture doesn’t change it.',
  mixColour: '{biome}: this picture’s colour mixed half and half with {other}, so {hex}.',
  /** On a marker of biomes that ignore the map */
  ignores: 'doesn’t use this picture',
  /** Above the blocks coloured for the picked biome */
  inBiome: 'In {biome}',
  /** Toggle: draws the biomes over the pixel editor */
  onCanvas: 'Show biomes on the canvas',
  /** A map of another size */
  size: 'The game reads colour maps as 256 × 256 pixels. This one is {width} × {height}, so the game would pick the wrong pixels.',
  /** Where the game doesn't read the map */
  notesTitle: 'Where the game doesn’t use this picture',
  notes: {
    swampNoise: 'Swamp and mangrove swamp grass: two greens of the game’s own that change from place to place.',
    swampMix: 'Swamps mix this colour half and half with dark purple.',
    darkMix: 'Dark forests mix this colour half and half with dark green.',
    darkShaded: 'Dark forests darken this colour.',
    /** {biomes}: a list of biome names */
    fixed: 'Colours of their own: {biomes}.',
    spruceBirch: 'Spruce leaves (#619961) and birch leaves (#80A755) never change colour.',
    inventoryGrass: 'In the inventory, grass blocks take the colour at the middle of the diagonal (warmth 0.5, rain 1).',
    inventoryLeaves: 'In the inventory, leaves are always the same green (#48B518).',
    bedrockSwampGrass: 'Swamps and mangrove swamps read swamp_grass.png instead.',
    bedrockSwampFoliage: 'Swamps read swamp_foliage.png and mangrove swamps mangrove_swamp_foliage.png instead.',
    bedrockLeaves: 'Spruce and birch leaves read evergreen.png and birch.png.',
    water: 'Water has no colour map: the game colours it with each biome’s water colour.',
    waterOld: 'Water has no colour map: its colour is in its own texture (swamps tint it a little).',
  },
  // ---- the biome picker's notes (3D preview)
  previewNotes: {
    swamp: 'The game colours swamp grass with its own two greens, not with grass.png.',
    fixed: '{biome} has colours of its own, so the colour maps don’t change it.',
    dark: 'Dark forests mix the grass colour with dark green.',
  },
});

export type BiomesText = typeof tb;
