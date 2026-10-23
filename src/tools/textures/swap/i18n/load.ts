// Loads the translations of the colour swap for the page's language (with the editor).

import { textLoader, type Translation } from '../../../../i18n/editor-text';
import type { SwapText } from './text';

/** A language file of the colour swap (./<lang>.ts). */
export interface SwapLanguage {
  'textures.swap': Translation<SwapText>;
}

export const loadSwapText = textLoader<SwapLanguage>({
  de: () => import('./de'),
  es: () => import('./es'),
  'pt-br': () => import('./pt-br'),
  ja: () => import('./ja'),
  ru: () => import('./ru'),
});
