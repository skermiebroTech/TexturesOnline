// Loads the translations of the Material tab for the page's language (with the tab's code).

import { textLoader, type Translation } from '../../../../i18n/editor-text';
import type { PbrText } from './text';

/** A language file of the Material tab (./<lang>.ts). */
export interface PbrLanguage {
  'textures.pbr': Translation<PbrText>;
}

export const loadPbrText = textLoader<PbrLanguage>({
  de: () => import('./de'),
  es: () => import('./es'),
  'pt-br': () => import('./pt-br'),
  ja: () => import('./ja'),
  ru: () => import('./ru'),
});
