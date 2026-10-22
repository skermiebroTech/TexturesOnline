// Loads the font maker's translations for the page's language.

import { textLoader, type Translation } from '../../../i18n/editor-text';
import type { FontsText } from './text';

/** A language file of the font maker (./<lang>.ts). */
export interface FontsLanguage {
  fonts: Translation<FontsText>;
}

export const loadFontsText = textLoader<FontsLanguage>({
  de: () => import('./de'),
  es: () => import('./es'),
  'pt-br': () => import('./pt-br'),
  ja: () => import('./ja'),
  ru: () => import('./ru'),
});
