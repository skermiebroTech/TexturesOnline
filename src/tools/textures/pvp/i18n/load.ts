// Loads the translations of the PvP / FPS tab for the page's language (with the tab's code).

import { textLoader, type Translation } from '../../../../i18n/editor-text';
import type { PvpText } from './text';

/** A language file of the PvP / FPS tab (./<lang>.ts). */
export interface PvpLanguage {
  'textures.pvp': Translation<PvpText>;
}

export const loadPvpText = textLoader<PvpLanguage>({
  de: () => import('./de'),
  es: () => import('./es'),
  'pt-br': () => import('./pt-br'),
  ja: () => import('./ja'),
  ru: () => import('./ru'),
});
