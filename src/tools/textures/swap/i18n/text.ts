// English text of the colour swap in the texture pack editor: its button by the colours, the swap
// window (../dialog.ts) and the list of textures it changes across the pack. Loaded with the
// editor. Translations: ./<lang>.ts, loaded by ./load.ts.

import { defineText } from '../../../../i18n/editor-text';

export const tw = defineText('textures.swap', {
  /** The button by the colours and the texture's menu */
  button: 'Swap a colour',
  buttonHint: 'Replace a colour with another in this texture, the selection or the whole pack',
  title: 'Swap a colour',
  from: 'Colour to replace',
  to: 'New colour',
  /** Swaps the two colours of the window */
  exchange: 'Swap the two colours',
  /** Under the colours: the texture's own colours */
  pickFrom: 'Pick it from this texture:',
  tolerance: 'Similar colours',
  toleranceHint: 'Takes colours this close too. Each keeps its own small difference, so shading inside stays.',
  ramp: 'Swap the whole shade ramp',
  rampHint: 'Its darker and lighter shades in this texture move along, keeping their hue shift.',
  /** The ramp: {count} colours */
  rampShades: '{count, plural, one {# shade} other {# shades}}',
  where: 'Where',
  scope: {
    texture: 'This texture',
    selection: 'Selection',
    pack: 'Whole pack',
  },
  /** With layers: every unlocked layer changes */
  layersNote: 'Every unlocked layer of the texture changes.',
  selectionNote: 'Only the selected area of the layer you paint changes.',
  before: 'Before',
  after: 'After',
  /** {count} pixels */
  pixels: '{count, plural, =0 {No pixels change} one {# pixel changes} other {# pixels change}}',
  // ---- the whole pack
  packNote: 'Textures of your pack that use the colour:',
  gameToo: 'Also search the game’s textures (slower)',
  searching: 'Looking through {done} of {total} textures…',
  none: 'No texture uses this colour.',
  /** A texture in the list; {count} pixels */
  rowPixels: '{count, plural, one {# pixel} other {# pixels}}',
  include: 'Change {name}',
  /** The main button */
  apply: 'Swap',
  applyCount: '{count, plural, one {Swap in # texture} other {Swap in # textures}}',
  /** Toasts (with "press Ctrl+Z to undo" after them) */
  done: 'Swapped the colour in {name}',
  doneMany: '{count, plural, one {Swapped the colour in # texture} other {Swapped the colour in # textures}}',
  nothing: 'Nothing to swap: no pixel has that colour.',
  locked: 'The layer you paint is locked or hidden.',
});

export type SwapText = typeof tw;
