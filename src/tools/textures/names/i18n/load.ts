// Loads the translations of the name-based textures window for the page's language (with its code).

import { textLoader, type Translation } from '../../../../i18n/editor-text';
import type { NamesText } from './text';

/** A language file of the name-based textures window (./<lang>.ts). */
export interface NamesLanguage {
  'textures.names': Translation<NamesText>;
}

export const loadNamesText = textLoader<NamesLanguage>({
  de: () => import('./de'),
  es: () => import('./es'),
  'pt-br': () => import('./pt-br'),
  ja: () => import('./ja'),
  ru: () => import('./ru'),
});
