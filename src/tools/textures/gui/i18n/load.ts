// Loads the translations of the GUI section for the page's language (with the section's code).

import { textLoader, type Translation } from '../../../../i18n/editor-text';
import type { GuiText } from './text';

/** A language file of the GUI section (./<lang>.ts). */
export interface GuiLanguage {
  'textures.gui': Translation<GuiText>;
}

export const loadGuiText = textLoader<GuiLanguage>({
  de: () => import('./de'),
  es: () => import('./es'),
  'pt-br': () => import('./pt-br'),
  ja: () => import('./ja'),
  ru: () => import('./ru'),
});
