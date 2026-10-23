// Loads the translations of the animation maker for the page's language (with the editor).

import { textLoader, type Translation } from '../../../../i18n/editor-text';
import type { AnimText } from './text';

/** A language file of the animation maker (./<lang>.ts). */
export interface AnimLanguage {
  'textures.anim': Translation<AnimText>;
}

export const loadAnimText = textLoader<AnimLanguage>({
  de: () => import('./de'),
  es: () => import('./es'),
  'pt-br': () => import('./pt-br'),
  ja: () => import('./ja'),
  ru: () => import('./ru'),
});
