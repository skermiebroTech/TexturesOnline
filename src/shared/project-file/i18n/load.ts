// Loads the translations of the project file dialogs for the page's language.

import { textLoader, type Translation } from '../../../i18n/editor-text';
import type { ProjectFileText } from './text';

/** A language file of the project file dialogs (./<lang>.ts). */
export interface ProjectFileLanguage {
  'shared.projectFile': Translation<ProjectFileText>;
}

export const loadProjectFileText = textLoader<ProjectFileLanguage>({
  de: () => import('./de'),
  es: () => import('./es'),
  'pt-br': () => import('./pt-br'),
  ja: () => import('./ja'),
  ru: () => import('./ru'),
});
