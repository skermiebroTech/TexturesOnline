// English text of the name-based textures window of the texture pack editor (../dialog.ts), loaded
// with it. Translations: ./<lang>.ts, loaded by ./load.ts.

import { defineText } from '../../../../i18n/editor-text';

export const tn = defineText('textures.names', {
  title: 'Name-based textures',
  /** {item} is the item's name, e.g. "Diamond Sword" */
  intro: 'Rename a {item} in an anvil to one of these names, and it gets its own texture.',
  /** What the pack's version can do */
  edition: {
    vanilla: 'Works in Minecraft 1.21.5 and newer, no mods needed.',
    range: 'Works in Minecraft 1.21.5 and newer, no mods needed. For the older versions in your pack’s range it also adds OptiFine files.',
    optifine: 'Needs OptiFine or the CIT Resewn mod: Minecraft before 1.21.5 can’t do this on its own. Players without one of them see the normal texture.',
    old: 'This needs Java 1.8 or newer. Choose a newer version in the Pack tab.',
    bedrock: 'Bedrock Edition can’t do this: its resource packs can’t change how an item looks by its name. Only Java Edition packs can.',
  },
  /** How names are matched */
  exact: 'The name must match exactly, capital letters too: “Excalibur” and “excalibur” are different names (add both if you like). Names coloured with commands don’t match.',
  notItem: 'This texture isn’t an item’s picture, so it can’t get name-based textures. Open the texture of an item, such as a sword or an apple.',
  noModels: 'The item list couldn’t be loaded, so the item of this texture is unknown. Check your connection and try again.',
  loading: 'Loading the item…',
  /** Heading of the list of names with their textures */
  looks: 'Names and their textures',
  add: 'Add a name-based texture',
  /** {item}: "Diamond Sword" */
  addIntro: 'Type the name you will give the {item} in the anvil. Its new texture starts as a copy of the normal one.',
  nameLabel: 'Name',
  namePlaceholder: 'e.g. Excalibur',
  addName: 'Add name',
  moreNames: 'More names can share the same texture: add them too.',
  /** {name} is quoted, e.g. “Excalibur” */
  removeName: 'Take out {name}',
  create: 'Create and paint',
  paint: 'Paint',
  paintHint: 'Paint the texture for this name',
  shape: '3D shape',
  shapeHint: 'Change the item’s shape for this name in the model editor',
  /** Badge of a look with its own 3D shape */
  shaped: '3D',
  editNames: 'Names',
  editNamesHint: 'Change the names',
  save: 'Save',
  remove: 'Remove',
  removeHint: 'Remove this texture',
  removeTitle: 'Remove this texture?',
  /** {names}: “Excalibur” or “Caliburn” */
  removeText: 'The texture for {names} will be deleted.',
  removed: 'Texture for {names} removed',
  undo: 'Undo',
  /** After making one: {item} "Diamond Sword", {names} “Excalibur” or “Caliburn” */
  created: 'Now paint the new texture. A {item} named {names} shows it.',
  /** One name in quotes */
  quoted: '“{name}”',
  nameEmpty: 'Type a name first.',
  /** {name} is quoted */
  nameTaken: '{name} already has a texture on this item.',
  nameCleaned: 'Colour codes (§) can’t be typed in an anvil, so they were left out.',
  /** A rule of an opened OptiFine pack (ipattern:, regex:) */
  pattern: 'OptiFine rule',
  patternHint: 'From the opened pack: a rule only OptiFine and CIT Resewn understand, so it works only with them.',
  kept: 'Kept from the opened pack',
  keptHint: 'These OptiFine rules do more than pick a name, so they stay as they are.',
  /** Accessible name of a look's picture: {names} “Excalibur” */
  slot: 'Texture for {names}',
  failed: 'The texture couldn’t be made: {error}',
});

export type NamesText = typeof tn;
