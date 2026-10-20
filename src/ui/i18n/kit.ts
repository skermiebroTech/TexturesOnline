// English text of the shared UI kit that ships with the app shell (buttons, fields, dialogs,
// toasts, colour picker, formatting helpers). Translations: src/ui/i18n/<lang>.ts (loaded by the
// router before every page in that language).

import { defineText } from '../../i18n/editor-text';

export const kit = defineText('kit', {
  ok: 'OK',
  cancel: 'Cancel',
  confirm: 'Confirm',
  close: 'Close',
  tryAgain: 'Try again',
  loading: 'Loading',
  edition: {
    java: 'Java',
    bedrock: 'Bedrock',
    /** Short label of a Java pack or game version: "Java 1.21.11" */
    javaVersion: 'Java {version}',
  },
  /** aria-label of a slider's number box; {label} is the slider's name */
  sliderValue: '{label} value',
  chooseOption: 'Choose an option',
  text: 'Text',
  colour: 'Colour',
  /** Colour swatch button: "Colour: #ff00aa" */
  colourValue: '{label}: {value}',
  /** Options panel: reset a group of settings */
  resetGroup: 'Reset {group}',
  sidePanel: 'Side panel',
  editorPanels: 'Editor panels',
  panel: { left: 'Browse', center: 'Canvas', right: 'Preview' },
  closeDialog: 'Close dialog',
  keyboardShortcuts: 'Keyboard shortcuts',
  notifications: 'Notifications',
  dismissNotification: 'Dismiss notification',
  /** Toast when an action fails without its own message */
  actionFailed: 'Something went wrong. Please try again.',
  /** Last-resort error toast; {message} is the error's own text */
  errorWithMessage: 'Something went wrong: {message}',
  errorGeneric: 'Something went wrong. If it keeps happening, try reloading the page.',
  /** The browser's storage for the site is full (src/core/storage.ts, also used by the home page) */
  storageFull: 'Your browser is out of storage space for this site. Clear cached game files in Settings or free up disk space.',
  picker: {
    saturationBrightness: 'Saturation and brightness',
    saturationValue: 'Saturation {saturation}%, brightness {brightness}%',
    hue: 'Hue',
    opacity: 'Opacity',
    previous: 'Previous',
    new: 'New',
    hex: 'Hex colour',
    opacityPercent: 'Opacity percent',
    pickFromScreen: 'Pick a colour from the screen',
    eyedropper: 'Eyedropper',
    recent: 'Recent',
    palette: 'Palette',
  },
  time: {
    justNow: 'just now',
    minutes: '{n} min ago',
    hours: '{n} h ago',
    yesterday: 'yesterday',
    days: '{n} days ago',
  },
  versions: {
    releases: 'Releases',
    previews: 'Previews',
    snapshotsOf: 'Snapshots {year}',
    other: 'Other',
    latestRelease: 'Latest release',
    latestPreview: 'Latest preview',
    /** Version list: "Latest release (26.50)" */
    latestReleaseOf: 'Latest release ({version})',
    latestPreviewOf: 'Latest preview ({version})',
    /** Picker button: "26.50 (latest)" */
    latestShort: '{version} (latest)',
    previewShort: '{version} (preview)',
  },
  /** What a file picker accepts, used in "Please choose …" */
  accept: {
    image: 'an image',
    png: 'a PNG image',
    jpeg: 'a JPEG image',
    zip: 'a .zip file',
    json: 'a .json file',
    any: 'a supported file',
    oneExt: 'a {ext} file',
    /** {list} is ".zip, .mcpack or .mcaddon" */
    exts: '{list} files',
  },
});

export type KitText = typeof kit;
