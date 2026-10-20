// English text of the custom model checks (../../models/rules.ts, doc.ts, pack.ts): the problems the
// model editor lists and the export notes about custom models. Kept apart from the model editor's
// own text because the editor's pack store and the export load these modules too.
// Translations: ./<lang>.ts (the editor's language files).

import { defineText } from '../../../../i18n/editor-text';

export const tr = defineText('textures.modelRules', {
  /** Default name of a cube: "Cube 3" */
  cube: 'Cube {n}',
  /** A named cube in a sentence: “arm” */
  named: '“{name}”',
  noCubes: 'This model has no cubes, so it is invisible in game.',
  notNumber: '{cube} has a position that isn\'t a number.',
  outside: "{cube} reaches outside the space the game allows (-16 to 32 on each axis), so the model won't load.",
  noFaces: '{cube} has no faces. The game only loads cubes with at least one face.',
  multiAxis: '{cube} turns on more than one axis, which needs Minecraft 1.21.11 or newer.',
  steps: '{cube} is turned {angle}°. This version only allows -45, -22.5, 0, 22.5 or 45.',
  range: '{cube} is turned {angle}°. This version allows -45° to 45°.',
  pivot: "{cube} has a rotation centre that isn't a number.",
  /** {face} is one of the face names below */
  uv: 'The {face} face of {cube} reaches outside its texture (UV 0 to 16), which shows stretched or repeated pixels.',
  faces: { up: 'up', down: 'down', north: 'north', south: 'south', east: 'east', west: 'west' },
  missingVar: 'A face uses the texture “#{name}”, which isn\'t set. It shows as the magenta and black missing texture.',
  missingFile: 'The texture “{ref}” isn\'t in the game or this pack. Faces using it show as magenta and black.',
  outsideAtlas: 'The texture “{ref}” isn\'t in a folder the game uses for models ({dirs}), so it shows as missing.',
  /** {slot} is one of the display slots below */
  position: 'The {slot} position goes past ±80, the most the game uses.',
  size: 'The {slot} size goes past 4, the most the game uses.',
  /** Where the model is shown (display slots), as written inside a sentence */
  slots: {
    gui: 'inventory',
    ground: 'on the ground',
    fixed: 'item frame',
    head: 'on the head',
    thirdperson_righthand: 'third person (right hand)',
    thirdperson_lefthand: 'third person (left hand)',
    firstperson_righthand: 'first person (right hand)',
    firstperson_lefthand: 'first person (left hand)',
    thirdperson: 'third person',
    firstperson: 'first person',
    on_shelf: 'on a shelf',
  },
  // models/pack.ts: export notes
  missingModel: 'The model {name} is missing from the pack.',
  badJson: "The model {name} isn't valid JSON, so the game can't read it.",
  noModels: 'Minecraft {version} has no model files, so the model {name} does nothing there.',
  /** "Model block/stone: Cube 1 has no faces…" */
  problem: 'Model {name}: {message}',
  moreProblems: ' ({count, plural, one {# more problem} other {# more problems}} — open it in the model editor to see them)',
});

export type ModelRulesText = typeof tr;
