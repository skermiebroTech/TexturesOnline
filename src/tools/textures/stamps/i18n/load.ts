// Loads the translations of the stamp tool for the page's language (with the editor).

import { textLoader, type Translation } from '../../../../i18n/editor-text';
import type { StampsText } from './text';

/** A language file of the stamp tool (./<lang>.ts). */
export interface StampsLanguage {
  'textures.stamps': Translation<StampsText>;
}

export const loadStampsText = textLoader<StampsLanguage>({
  de: () => import('./de'),
  es: () => import('./es'),
  'pt-br': () => import('./pt-br'),
  ja: () => import('./ja'),
  ru: () => import('./ru'),
});
