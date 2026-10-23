// Loads the translations of biome colours for the page's language (with the editor).

import { textLoader, type Translation } from '../../../../i18n/editor-text';
import type { BiomesText } from './text';

/** A language file of biome colours (./<lang>.ts). */
export interface BiomesLanguage {
  'textures.biomes': Translation<BiomesText>;
}

export const loadBiomesText = textLoader<BiomesLanguage>({
  de: () => import('./de'),
  es: () => import('./es'),
  'pt-br': () => import('./pt-br'),
  ja: () => import('./ja'),
  ru: () => import('./ru'),
});
