// Loads the translations of the model text (./text.ts) for the page's language. The texture editor
// awaits it before showing models.

import { textLoader, type Translation } from '../../../i18n/editor-text';
import type { ModelsText } from './text';

/** A language file of the model text (./<lang>.ts). */
export interface ModelsLanguage {
  'shared.models': Translation<ModelsText>;
}

export const loadModelsText = textLoader<ModelsLanguage>({
  de: () => import('./de'),
  es: () => import('./es'),
  'pt-br': () => import('./pt-br'),
  ja: () => import('./ja'),
});
