// Loads the converter's translations (the page and the engine) for the page's language.

import { textLoader, type Translation } from '../../../i18n/editor-text';
import type { ConvertText } from './text';
import type { ConvertEngineText } from './engine';

/** A language file of the converter (./<lang>.ts). */
export interface ConvertLanguage {
  convert: Translation<ConvertText>;
  'convert.engine': Translation<ConvertEngineText>;
}

export const loadConvertText = textLoader<ConvertLanguage>({
  de: () => import('./de'),
  es: () => import('./es'),
  'pt-br': () => import('./pt-br'),
  ja: () => import('./ja'),
  ru: () => import('./ru'),
});
