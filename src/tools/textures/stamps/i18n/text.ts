// English text of the stamp tool in the texture pack editor: the stamp button and its options in the
// options bar, the list of stamps (../picker.ts) and saving a selection as a stamp. Loaded with the
// editor. Translations: ./<lang>.ts, loaded by ./load.ts.

import { defineText } from '../../../../i18n/editor-text';

export const ts = defineText('textures.stamps', {
  /** The options bar's button that opens the list; {name}: the stamp */
  choose: 'Choose a stamp',
  current: 'Stamp: {name}',
  title: 'Stamps',
  presets: 'Presets',
  /** Under the presets */
  presetsHint: 'Presets are drawn in shades of your main colour.',
  yours: 'Your stamps',
  none: 'No stamps of your own yet. Select an area and save it as a stamp.',
  /** The presets' names */
  names: {
    ore: 'Ore spots',
    cracks: 'Cracks',
    moss: 'Moss',
    dither: 'Dither patch',
    sparkles: 'Sparkles',
    pebbles: 'Pebbles',
  },
  /** Name of a stamp saved from a selection */
  stampName: 'Stamp {n}',
  /** {width} × {height} */
  size: '{width} × {height}',
  save: 'Save selection as stamp',
  saveHint: 'Select an area first (up to 32 × 32 pixels)',
  saved: 'Saved “{name}” as a stamp.',
  tooBig: 'Stamps can be up to 32 × 32 pixels. Select a smaller area.',
  empty: 'The selection has no pixels to make a stamp of.',
  delete: 'Delete “{name}”',
  deleted: 'Deleted “{name}”.',
  undo: 'Undo',
  rotate: 'Turn the stamp (R)',
  rotateTouch: 'Turn the stamp',
  flipH: 'Flip the stamp left to right (H)',
  flipHTouch: 'Flip the stamp left to right',
  flipV: 'Flip the stamp upside down (Shift + H)',
  flipVTouch: 'Flip the stamp upside down',
  /** In the list */
  hint: 'Click to stamp. Hold and drag to place it first, then let go. Right-click stamps its shape in the second colour.',
  hintTouch: 'Tap to stamp. Hold and drag to place it first, then lift your finger.',
  /** Saved in this browser; the pack's own come along in its project file */
  kept: 'Your stamps are kept in this browser, and the ones saved in this pack go with its project file.',
});

export type StampsText = typeof ts;
