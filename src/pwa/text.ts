// Texts of the installable-app features (install entry, update notice, opening files) and the
// privacy link. English is complete; a translation fills in the same keys for its language
// (anything left out falls back to English). Kept apart from src/i18n/ui.ts so these features can
// ship before their translations do.

import type { Locale } from '../i18n/locales';

export interface AppText {
  /** Footer link and phone menu item */
  installApp: string;
  /** Install dialog title (iPhone/iPad and Safari on Mac, which have no install prompt) */
  installTitle: string;
  /** Why install, one line (dialog and the one-time hint) */
  installWhy: string;
  /** iPhone / iPad steps */
  installIos: string[];
  /** Safari on macOS steps */
  installMacSafari: string[];
  /** Dialog close button */
  gotIt: string;
  /** Toast after the app has been installed */
  installed: string;
  /** One-time hint after the first export */
  exportHint: string;
  /** Action button on the hint */
  install: string;
  /** Update notice */
  updateReady: string;
  /** Update notice action */
  reload: string;
  /** A file opened with the app (or shared to it) that it can't use; {name} is the file name */
  cantOpen: string;
  /** Footer link to the privacy page */
  privacy: string;
}

export const APP_TEXT_EN: AppText = {
  installApp: 'Install app',
  installTitle: 'Install Texture Pack Maker',
  installWhy: 'Open it from your home screen or desktop like any other app. It works offline too.',
  installIos: ['Tap the Share button in Safari’s toolbar.', 'Choose “Add to Home Screen”.', 'Tap “Add”.'],
  installMacSafari: ['In Safari’s menu bar, choose File › Add to Dock.', 'Click “Add”.'],
  gotIt: 'Got it',
  installed: 'Texture Pack Maker is installed. You’ll find it with your other apps.',
  exportHint: 'Tip: install Texture Pack Maker as an app to open it from your desktop or home screen, even offline.',
  install: 'Install',
  updateReady: 'A new version of Texture Pack Maker is ready.',
  reload: 'Reload',
  cantOpen: 'Texture Pack Maker can’t open “{name}”. Choose a .zip, .mcpack or .mcaddon pack, or a .png skin or texture.',
  privacy: 'Privacy',
};

/** Translations, by language (partial: missing keys use English). */
export const APP_TEXT: Partial<Record<Locale, Partial<AppText>>> = {};

export function appText(locale: Locale = 'en'): AppText {
  return { ...APP_TEXT_EN, ...(APP_TEXT[locale] ?? {}) };
}
