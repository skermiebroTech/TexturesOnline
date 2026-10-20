// Loads the merger's translations for the page's language.

import { textLoader, type Translation } from '../../../i18n/editor-text';
import type { MergeText } from './text';

/** A language file of the merger (./<lang>.ts). */
export interface MergeLanguage {
  merge: Translation<MergeText>;
}

export const loadMergeText = textLoader<MergeLanguage>({
  de: () => import('./de'),
  es: () => import('./es'),
  'pt-br': () => import('./pt-br'),
  ja: () => import('./ja'),
});
