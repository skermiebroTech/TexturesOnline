// English text of the PvP / FPS tab of the texture pack editor (../panel.ts), loaded with that tab.
// Translations: ./<lang>.ts, loaded by ./load.ts.

import { defineText } from '../../../../i18n/editor-text';

export const tv = defineText('textures.pvp', {
  /** {version} is e.g. "Java 1.8.9" */
  intro: 'What PvP and FPS packs change, one click each, for {version}. Every tweak writes normal files into your pack: you can still paint them, and switching one off puts the files back.',
  preset: {
    button: 'Switch on the PvP preset',
    hint: 'Low fire, clear glass, no pumpkin blur, a cleaner crosshair, smaller swords and a lower shield, where this version has them.',
    applied: 'PvP preset: {count, plural, one {# tweak} other {# tweaks}} switched on',
    none: 'Every tweak of the preset is already on.',
  },
  groups: { pvp: 'PvP', fps: 'FPS' },
  /** Accessible name of a tweak's switch */
  switchLabel: '{name}: on or off',
  changes: 'Changes',
  worksIn: 'Works in',
  /** {count} more files than the ones listed */
  more: '+{count} more',
  tweaks: {
    lowFire: { title: 'Low fire', text: 'The flames on your screen while you burn sit lower, so you can still see the fight.' },
    clearGlass: { title: 'Clear glass', text: 'Glass, stained glass and glass panes are see-through inside and keep their border.' },
    noPumpkin: { title: 'No pumpkin blur', text: 'Wearing a carved pumpkin no longer darkens the screen.' },
    crosshair: { title: 'Custom crosshair', text: 'A smaller, cleaner crosshair. The game draws it inverted over what’s behind it, so white works best.' },
    swords: { title: 'Smaller swords', text: 'Swords (or every weapon) look smaller and lower in your hand in first person. Other players, third person and the inventory stay as they are.' },
    shield: { title: 'Lower shield', text: 'Your shield sits lower on the screen in first person, while blocking too.' },
    lowRes: { title: '8× textures', text: 'Block textures (and items, if you like) at 8 × 8 pixels: a flat, clean look and less video memory. Applied when you export.' },
    still: { title: 'No animations', text: 'Water, lava, fire, portals and other animated textures stand still. Applied when you export.' },
  },
  /** Which versions a tweak works in */
  support: {
    java: 'Java (every version)',
    javaBedrock: 'Java (every version) and Bedrock',
    models: 'Java 1.8 and newer',
    shield: 'Java 1.9 and newer',
  },
  unsupported: {
    bedrockFire: 'Not for Bedrock: Bedrock draws the fire on your screen in its own way, which a texture pack can’t lower reliably.',
    bedrockHeld: 'Not for Bedrock: there, held items are posed by attachable files (as in add-ons), which this editor doesn’t make.',
    bedrockAnimations: 'Not for Bedrock: Bedrock plays animated textures from a frame list that a pack can’t take away.',
    noModels: 'Needs Java 1.8 or newer: older versions have no model files to change.',
    noShield: 'Shields came in Java 1.9.',
  },
  options: {
    height: 'Height',
    low: 'Low',
    lower: 'Lower',
    lowest: 'Lowest',
    keepBlocks: 'Keep fire blocks as they are',
    keepBlocksHint: 'Fire blocks get a copy of the old texture, so only the fire on screen and on burning players is lower.',
    glass: 'Inside',
    clear: 'Clear',
    tint: 'Light tint',
    design: 'Design',
    designs: { dot: 'Dot', cross: 'Small cross', gap: 'Cross with a gap', circle: 'Circle', x: 'X' },
    drawOwn: 'Draw your own',
    size: 'Size',
    small: 'Small',
    smaller: 'Smaller',
    tiny: 'Tiny',
    weapons: 'Which',
    swords: 'Swords',
    allWeapons: 'All weapons',
    allWeaponsHint: 'Swords, axes, the mace and spears, where this version has them.',
    textures: 'Textures',
    blocks: 'Blocks',
    blocksItems: 'Blocks and items',
  },
  draw: {
    sheet: 'The crosshair is the 16 × 16 square in the top-left corner, now selected. Paint inside it.',
    sprite: 'This is the crosshair. Paint it in white: the game inverts it over what’s behind it.',
  },
  toasts: {
    on: '{name} is on',
    updated: '{name}: changed',
    off: '{name} is off',
    kept: '{count, plural, one {# file you changed since was kept.} other {# files you changed since were kept.}}',
    undo: 'Undo',
    undone: 'Undone',
    failed: '{name} couldn’t be changed: {error}',
  },
  mods: {
    title: 'Needs a mod, not a pack',
    text: 'Zoom, an FPS counter, keystrokes, toggle sprint, no fog, motion blur and big FPS gains (fewer chunks, entities and particles drawn) come from mods such as OptiFine or Sodium, PvP clients or the game’s Video Settings. A texture pack can’t change them.',
  },
  guide: 'How to make a PvP texture pack',
});

export type PvpText = typeof tv;
