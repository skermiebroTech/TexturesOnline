// English text of the paint layers of the texture pack editor: the Layers button over the canvas,
// the layers panel (../panel.ts), the eyedropper's option and the messages about locked and hidden
// layers. Loaded with the editor. Translations: ./<lang>.ts, loaded by ./load.ts.

import { defineText } from '../../../../i18n/editor-text';

export const tl = defineText('textures.layers', {
  /** The button over the canvas that opens the panel */
  button: 'Layers',
  /** Tooltip of the button; {name}: the layer being painted */
  buttonHint: 'Layers: paint on separate layers, like in an image editor',
  buttonActive: 'Layers ({count}): painting on “{name}”',
  title: 'Layers',
  close: 'Close',
  /** The list, top layer first */
  list: 'Layers, top first',
  /** Name of a new layer */
  layerName: 'Layer {n}',
  /** Name of the layer made from the game's own texture */
  gameName: 'Game texture',
  /** Name of a copy */
  copyName: '{name} copy',
  add: 'New layer',
  duplicate: 'Duplicate layer',
  delete: 'Delete layer',
  mergeDown: 'Merge down',
  flatten: 'Flatten into one layer',
  moveUp: 'Move up',
  moveDown: 'Move down',
  rename: 'Rename',
  nameLabel: 'Layer name',
  show: 'Show layer',
  hide: 'Hide layer',
  lock: 'Lock layer',
  unlock: 'Unlock layer',
  locked: 'Locked',
  hiddenTag: 'Hidden',
  fromGame: 'New layer from the game’s texture',
  more: 'More layer actions',
  opacity: 'Opacity',
  blend: 'Blend',
  blends: {
    normal: 'Normal',
    multiply: 'Multiply',
    screen: 'Screen',
    lighten: 'Lighten',
    overlay: 'Overlay',
  },
  /** Tooltip of a layer in the list (mouse only) */
  rowHint: 'Double-click to rename, drag to change the order',
  /** Under the list */
  note: 'The pack gets the layers flattened into one picture.',
  /** Animated textures: under the list */
  noteFrames: 'Layers go through every frame. The pack gets them flattened.',
  /** When painting is refused */
  lockedToast: '“{name}” is locked. Unlock it to paint on it.',
  hiddenToast: '“{name}” is hidden. Show it to paint on it.',
  /** The eyedropper's option (only with more than one layer) */
  pickLayer: 'This layer only',
  pickLayerHint: 'Take colours from the layer you paint on instead of what shows',
  /** An upload into a layered texture */
  replacedLayer: 'Replaced the pixels of “{name}”.',
  /** The texture was changed somewhere else, so its layers were no longer its pixels */
  dropped: 'This texture was changed outside the layers, so it is one layer again.',
  /** Importing frames that replace every frame of a layered texture */
  importFlattens: 'The imported frames replace every layer.',
});

export type LayersText = typeof tl;
