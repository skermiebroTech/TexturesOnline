// Loads the skin tool's translations (start screen, body parts, editor and exports) for the
// page's language. One file per language: the view loads it before the start screen or the editor.

import { textLoader, type Translation } from '../../../i18n/editor-text';
import type { SkinsText } from './text';
import type { PartText } from './parts';
import type { SkinEditorText } from './editor';
import type { SkinExportText } from './export';
import type { SkinPoseText } from './pose';
import type { SkinCapeText } from './cape';

/** A language file of the skin tool (./<lang>.ts). */
export interface SkinsLanguage {
  skins: Translation<SkinsText>;
  'skins.parts': Translation<PartText>;
  'skins.editor': Translation<SkinEditorText>;
  'skins.export': Translation<SkinExportText>;
  'skins.pose': Translation<SkinPoseText>;
  'skins.cape': Translation<SkinCapeText>;
}

export const loadSkinsText = textLoader<SkinsLanguage>({
  de: () => import('./de'),
  es: () => import('./es'),
  'pt-br': () => import('./pt-br'),
  ja: () => import('./ja'),
  ru: () => import('./ru'),
});
