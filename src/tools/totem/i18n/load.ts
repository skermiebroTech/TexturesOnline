// Loads the totem maker's translations for the page's language.

import { textLoader, type Translation } from '../../../i18n/editor-text';
import type { TotemText } from './text';

/** A language file of the totem maker (./<lang>.ts). */
export interface TotemLanguage {
  totem: Translation<TotemText>;
}

export const loadTotemText = textLoader<TotemLanguage>({
  de: () => import('./de'),
  es: () => import('./es'),
  'pt-br': () => import('./pt-br'),
  ja: () => import('./ja'),
});
