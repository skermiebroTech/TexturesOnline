// Loads the UI kit's translations (the router does this before every page in that language).

import { textLoader, type Translation } from '../../i18n/editor-text';
import type { KitText } from './kit';

/** A language file of the UI kit (src/ui/i18n/<lang>.ts). */
export interface KitLanguage {
  kit: Translation<KitText>;
}

export const loadKitText = textLoader<KitLanguage>({
  de: () => import('./de'),
  es: () => import('./es'),
  'pt-br': () => import('./pt-br'),
  ja: () => import('./ja'),
});
