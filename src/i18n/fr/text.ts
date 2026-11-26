// The French short texts: page titles, interface and app texts, loaded together when the
// app shows a page in French (src/i18n/locale-text.ts).

import type { LocaleText } from '../locale-text';
import { META_FR } from './meta';
import { UI_FR } from './ui';
import { APP_TEXT_FR } from './app';

export const TEXT: LocaleText = { meta: META_FR, ui: UI_FR, app: APP_TEXT_FR };
