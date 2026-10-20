// English names of the skin's body parts, faces and layers (templates.ts: the template tags, hover
// names and the parts list). Small on purpose: templates.ts is also part of the totem maker.
// Translations: ./<lang>.ts, loaded by ./load.ts. Names follow the game's skin customisation
// (Hat, Jacket, Left Sleeve, Right Pants Leg...) where the game has them.

import { defineText } from '../../../i18n/editor-text';

/** One body part. `it` and `outerIt` are the names used inside sentences ("Fill {part} with colour"). */
const part = (name: string, outer: string, short: string, outerShort: string, sub: string, it: string, outerIt: string) => ({ name, outer, short, outerShort, sub, it, outerIt });

export const partText = defineText('skins.parts', {
  /**
   * name / outer: the part and its outer-layer piece (template tags, hover names, lists).
   * short / outerShort: the tag on the template when the name doesn't fit.
   * sub: the outer piece under the part in the parts list ("+ sleeve").
   * it / outerIt: inside sentences such as "Fill {part} with colour", "Filled the {part}",
   * "Copy to {part}", "Show only the {part} in 3D" (translations may include an article and the
   * case these sentences need).
   */
  head: part('Head', 'Hat', 'Head', 'Hat', 'hat', 'head', 'hat'),
  body: part('Body', 'Jacket', 'Body', 'Jacket', 'jacket', 'body', 'jacket'),
  rightArm: part('Right Arm', 'Right Sleeve', 'R arm', 'R sleeve', 'sleeve', 'right arm', 'right sleeve'),
  leftArm: part('Left Arm', 'Left Sleeve', 'L arm', 'L sleeve', 'sleeve', 'left arm', 'left sleeve'),
  rightLeg: part('Right Leg', 'Right Pants', 'R leg', 'R pants', 'pants', 'right leg', 'right pants'),
  leftLeg: part('Left Leg', 'Left Pants', 'L leg', 'L pants', 'pants', 'left leg', 'left pants'),
  faces: {
    top: 'Top',
    bottom: 'Bottom',
    right: 'Right side',
    front: 'Front',
    left: 'Left side',
    back: 'Back',
  },
  layers: { base: 'Base layer', outer: 'Outer layer' },
});

export type PartText = typeof partText;
