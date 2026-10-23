// Loads the translations of the paint layers for the page's language (with the editor).

import { textLoader, type Translation } from '../../../../i18n/editor-text';
import type { LayersText } from './text';

/** A language file of the paint layers (./<lang>.ts). */
export interface LayersLanguage {
  'textures.layers': Translation<LayersText>;
}

export const loadLayersText = textLoader<LayersLanguage>({
  de: () => import('./de'),
  es: () => import('./es'),
  'pt-br': () => import('./pt-br'),
  ja: () => import('./ja'),
  ru: () => import('./ru'),
});
