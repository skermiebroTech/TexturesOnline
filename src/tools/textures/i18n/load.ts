// Loads the translations of the Texture Pack Maker's start screen, the shared texture pieces and
// the effects for the page's language (the editor's own text has its loader in ../ui/i18n/).

import { textLoader, type Translation } from '../../../i18n/editor-text';
import type { TexturesText } from './start';
import type { EffectsText } from './effects';
import type { TexturePackText } from './pack';

/** A language file of the texture start screen (./<lang>.ts). */
export interface TexturesLanguage {
  textures: Translation<TexturesText>;
  'textures.effects': Translation<EffectsText>;
  'textures.pack': Translation<TexturePackText>;
}

export const loadTexturesText = textLoader<TexturesLanguage>({
  de: () => import('./de'),
  es: () => import('./es'),
  'pt-br': () => import('./pt-br'),
  ja: () => import('./ja'),
});
