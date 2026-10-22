// English text of the pose maker (ui/pose-studio.ts): preset poses, the part sliders, the camera,
// backgrounds and saving a picture. Loaded with the editor; translations: ./<lang>.ts.

import { defineText } from '../../../i18n/editor-text';

export const poseText = defineText('skins.pose', {
  /** Row label and button in the editor's 3D controls */
  row: 'Pose',
  open: 'Pose & picture',
  openTip: 'Pose your skin, pick a camera angle and save a picture',
  title: 'Pose maker',
  /** aria-label of the 3D view */
  stage: '3D pose preview. Drag to turn the camera, scroll or pinch to zoom.',
  tabs: { poses: 'Poses', adjust: 'Adjust', scene: 'Scene' },
  presetsLabel: 'Preset poses',
  presets: {
    standing: 'Standing',
    walking: 'Walking',
    running: 'Running',
    waving: 'Waving',
    sitting: 'Sitting',
    crouching: 'Crouching',
    flying: 'Flying',
    tpose: 'T-pose',
    victory: 'Victory',
    dab: 'Dab',
    fighting: 'Fighting',
    pointing: 'Pointing',
  },
  /** Shown instead of a preset name once a part was moved */
  custom: 'Your own pose',
  mirror: 'Mirror',
  mirrorTip: 'Swap left and right',
  resetAll: 'Reset pose',
  /** Part picker of the Adjust tab */
  partLabel: 'Part to move',
  whole: 'Whole',
  axes: {
    nod: 'Nod',
    turn: 'Turn',
    tilt: 'Tilt',
    lean: 'Lean',
    twist: 'Twist',
    bend: 'Bend sideways',
    raise: 'Raise',
    out: 'Out to the side',
    roll: 'Roll',
    swing: 'Swing',
  },
  bodyTilt: 'Lean whole body',
  wings: 'Open the wings',
  capeLift: 'Lift the cape',
  /** {part} is a body part name (skins.parts) */
  resetPart: 'Reset {part}',
  resetWhole: 'Reset',
  /** Copies an arm's or leg's angles to the other side; {part} is the other side's name */
  copyTo: 'Copy to {part}',
  adjustHint: 'Or drag the model to turn the camera. The sliders move one part at a time.',
  camera: 'Camera',
  views: {
    front: 'Front',
    angle: 'Three-quarter',
    side: 'Side',
    back: 'Back',
    low: 'Low angle',
    high: 'From above',
    face: 'Close-up',
  },
  zoom: 'Zoom',
  background: 'Background',
  backgrounds: { studio: 'Studio', sky: 'Sky', night: 'Night', paper: 'Light', transparent: 'Transparent' },
  /** aria-label: "Background: Sky" */
  backgroundName: 'Background: {name}',
  onBack: 'On the back',
  back: { none: 'Nothing', cape: 'Cape', elytra: 'Elytra' },
  /** {link} is a link with the capeMaker text */
  noCape: 'No cape yet: {link} to make one, then it shows here.',
  capeMaker: 'open the cape maker',
  pictureSize: 'Picture size',
  /** Size choice, e.g. "2× · 1280 × 960" */
  sizeOption: '{scale}× · {width} × {height}',
  save: 'Save picture',
  saved: 'Saved {file}',
  failed: 'Could not make the picture.',
  /** {size} is a number of pixels */
  reduced: 'This device can make pictures up to {size} px, so the picture was made a little smaller.',
  /** Default file name part ("knight-pose.png") */
  fileSuffix: 'pose',
});

export type SkinPoseText = typeof poseText;
