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
