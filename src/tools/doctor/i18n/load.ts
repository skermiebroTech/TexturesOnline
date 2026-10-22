// Loads Pack Doctor's translations (both sections: the page and the report) for the page's language.

import { textLoader, type Translation } from '../../../i18n/editor-text';
import type { DoctorText } from './text';
import type { ReportText } from './report';

/** A language file of Pack Doctor (./<lang>.ts). */
export interface DoctorLanguage {
  doctor: Translation<DoctorText>;
  'doctor.report': Translation<ReportText>;
}

export const loadDoctorText = textLoader<DoctorLanguage>({
  de: () => import('./de'),
  es: () => import('./es'),
  'pt-br': () => import('./pt-br'),
  ja: () => import('./ja'),
  ru: () => import('./ru'),
});
