// Loads the shader editor's translations (the editor, the settings and presets, the generators'
// messages) for the page's language: by the view for '#/shaders/:id' and with every generator
// (../generator.ts), so the "New pack" dialog shows its presets translated.

import { textLoader, type Translation } from '../../../../i18n/editor-text';
import type { ShadersEditorText } from './editor';
import type { ShadersOptionsText } from './options';
import type { ShadersMessagesText } from './messages';

/** A language file of the shader editor (./<lang>.ts). */
export interface ShadersEditorLanguage {
  'shaders.editor': Translation<ShadersEditorText>;
  'shaders.options': Translation<ShadersOptionsText>;
  'shaders.messages': Translation<ShadersMessagesText>;
}

export const loadShadersEditorText = textLoader<ShadersEditorLanguage>({
  de: () => import('./de'),
  es: () => import('./es'),
  'pt-br': () => import('./pt-br'),
  ja: () => import('./ja'),
});
