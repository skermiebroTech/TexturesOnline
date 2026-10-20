// Loads the pack editor's translations for the page's language (the view awaits it for
// '#/shaders/:id').

import { textLoader, type Translation } from '../../../../i18n/editor-text';
import type { PackEditText } from './text';

/** A language file of the pack editor (./<lang>.ts). */
export interface PackEditLanguage {
  'shaders.packedit': Translation<PackEditText>;
}

export const loadPackEditText = textLoader<PackEditLanguage>({
  de: () => import('./de'),
  es: () => import('./es'),
  'pt-br': () => import('./pt-br'),
  ja: () => import('./ja'),
});
