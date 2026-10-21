// Loads the translations of the pieces every editor shares (version picker, drop zone, download and
// file errors, pack import/export, pixel canvas, skin sources). The router does this before any
// tool page in that language, so tool views only load their own text.

import { textLoader, type Translation } from '../../i18n/editor-text';
import type { PickersText } from './pickers';
import type { ErrorText } from './errors';
import type { FileText } from './files';
import type { PackText } from './packs';
import type { CanvasText } from './canvas';
import type { SkinText } from './skins';

/** A language file of the shared editor pieces (src/shared/i18n/<lang>.ts). */
export interface SharedLanguage {
  'shared.pickers': Translation<PickersText>;
  'shared.errors': Translation<ErrorText>;
  'shared.files': Translation<FileText>;
  'shared.packs': Translation<PackText>;
  'shared.canvas': Translation<CanvasText>;
  'shared.skins': Translation<SkinText>;
}

export const loadSharedText = textLoader<SharedLanguage>({
  de: () => import('./de'),
  es: () => import('./es'),
  'pt-br': () => import('./pt-br'),
  ja: () => import('./ja'),
  ru: () => import('./ru'),
});
