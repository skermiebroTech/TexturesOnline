// Loads the translations of the texture pack editor (the editor, the sound editor and the model
// editor share one language file per language) for the page's language.

import { textLoader, type Translation } from '../../../../i18n/editor-text';
import type { EditorText } from './editor';
import type { SoundsText } from './sounds';
import type { ModelRulesText } from './model-rules';
import type { ModelEditorText } from './model-editor';

/** A language file of the texture pack editor (./<lang>.ts). */
export interface EditorLanguage {
  'textures.editor': Translation<EditorText>;
  'textures.sounds': Translation<SoundsText>;
  'textures.modelRules': Translation<ModelRulesText>;
  'textures.modelEditor': Translation<ModelEditorText>;
}

export const loadEditorText = textLoader<EditorLanguage>({
  de: () => import('./de'),
  es: () => import('./es'),
  'pt-br': () => import('./pt-br'),
  ja: () => import('./ja'),
  ru: () => import('./ru'),
});
