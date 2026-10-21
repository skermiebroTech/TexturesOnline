// Loads the Shader Maker's start-screen translations (start screen, targets, "Open a shader pack")
// for the page's language. The editors load their own (../ui/i18n, ../packedit/i18n).

import { textLoader, type Translation } from '../../../i18n/editor-text';
import type { ShadersText } from './text';
import type { ShadersImportText } from './import';

/** A language file of the Shader Maker's start screen (./<lang>.ts). */
export interface ShadersLanguage {
  shaders: Translation<ShadersText>;
  'shaders.import': Translation<ShadersImportText>;
}

export const loadShadersText = textLoader<ShadersLanguage>({
  de: () => import('./de'),
  es: () => import('./es'),
  'pt-br': () => import('./pt-br'),
  ja: () => import('./ja'),
  ru: () => import('./ru'),
});
