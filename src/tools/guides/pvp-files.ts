// The files a PvP pack changes, per game version, as the PvP guide lists them. Written out by hand
// (they are what people search for); tests/unit/pvp.test.ts checks every path against the PvP
// tweaks' own code, so the guide and the editor can't disagree.

import type { Edition } from '../../core/types';

export interface PvpExample {
  /** Column heading: the versions the row is true for */
  label: string;
  edition: Edition;
  /** A version the paths are checked with */
  version: string;
  files: {
    /** The fire drawn on the screen (Java) */
    lowFire?: string;
    /** Clear glass (the first of the glass textures; stained glass sits next to it) */
    glass: string;
    pumpkin: string;
    crosshair: string;
    /** Smaller swords: the sword's model file */
    sword?: string;
    /** Lower shield */
    shield?: string;
  };
}

export const PVP_EXAMPLE_FILES: PvpExample[] = [
  {
    label: 'Java 1.8.9',
    edition: 'java',
    version: '1.8.9',
    files: {
      lowFire: 'assets/minecraft/textures/blocks/fire_layer_1.png',
      glass: 'assets/minecraft/textures/blocks/glass.png',
      pumpkin: 'assets/minecraft/textures/misc/pumpkinblur.png',
      crosshair: 'assets/minecraft/textures/gui/icons.png',
      sword: 'assets/minecraft/models/item/diamond_sword.json',
    },
  },
  {
    label: 'Java 1.9 – 1.12.2',
    edition: 'java',
    version: '1.12.2',
    files: {
      lowFire: 'assets/minecraft/textures/blocks/fire_layer_1.png',
      glass: 'assets/minecraft/textures/blocks/glass.png',
      pumpkin: 'assets/minecraft/textures/misc/pumpkinblur.png',
      crosshair: 'assets/minecraft/textures/gui/icons.png',
      sword: 'assets/minecraft/models/item/diamond_sword.json',
      shield: 'assets/minecraft/models/item/shield.json',
    },
  },
  {
    label: 'Java 1.13 – 1.20.1',
    edition: 'java',
    version: '1.20.1',
    files: {
      lowFire: 'assets/minecraft/textures/block/fire_1.png',
      glass: 'assets/minecraft/textures/block/glass.png',
      pumpkin: 'assets/minecraft/textures/misc/pumpkinblur.png',
      crosshair: 'assets/minecraft/textures/gui/icons.png',
      sword: 'assets/minecraft/models/item/diamond_sword.json',
      shield: 'assets/minecraft/models/item/shield.json',
    },
  },
  {
    label: 'Java 1.20.2 – 26.3',
    edition: 'java',
    version: '26.3',
    files: {
      lowFire: 'assets/minecraft/textures/block/fire_1.png',
      glass: 'assets/minecraft/textures/block/glass.png',
      pumpkin: 'assets/minecraft/textures/misc/pumpkinblur.png',
      crosshair: 'assets/minecraft/textures/gui/sprites/hud/crosshair.png',
      sword: 'assets/minecraft/models/item/diamond_sword.json',
      shield: 'assets/minecraft/models/item/shield.json',
    },
  },
  {
    label: 'Bedrock',
    edition: 'bedrock',
    version: 'latest',
    files: {
      glass: 'textures/blocks/glass.png',
      pumpkin: 'textures/misc/pumpkinblur.png',
      crosshair: 'textures/gui/icons.png',
    },
  },
];

/**
 * The diamond sword's model file as "Smaller swords" (size Smaller) writes it for Java 1.8.9: the game's
 * file with the "firstperson" slot shrunk and moved down; third person stays as the game has it.
 */
export const PVP_SWORD_189 = `{
  "parent": "builtin/generated",
  "textures": {
    "layer0": "items/diamond_sword"
  },
  "display": {
    "thirdperson": {
      "rotation": [0, 90, -35],
      "translation": [0, 1.25, -3.5],
      "scale": [0.85, 0.85, 0.85]
    },
    "firstperson": {
      "rotation": [0, -135, 25],
      "translation": [0, 2.6, 2],
      "scale": [1.105, 1.105, 1.105]
    }
  }
}
`;

/**
 * The same for Java 1.9 and newer (here 26.3): the sword takes its hand poses from item/handheld, so
 * the file gets both first-person slots, worked out from handheld's.
 */
export const PVP_SWORD_LATEST = `{
  "parent": "minecraft:item/handheld",
  "textures": {
    "layer0": "minecraft:item/diamond_sword"
  },
  "display": {
    "firstperson_righthand": {
      "rotation": [0, -90, 25],
      "translation": [1.13, 1.8, 1.13],
      "scale": [0.442, 0.442, 0.442]
    },
    "firstperson_lefthand": {
      "rotation": [0, 90, -25],
      "translation": [1.13, 1.8, 1.13],
      "scale": [0.442, 0.442, 0.442]
    }
  }
}
`;
