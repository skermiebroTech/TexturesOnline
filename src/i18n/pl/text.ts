// The Polish short texts: page titles, interface and app texts, loaded together when the
// app shows a page in Polish (src/i18n/locale-text.ts).

import type { LocaleText } from '../locale-text';
import { META_PL } from './meta';
import { UI_PL } from './ui';
import { APP_TEXT_PL } from './app';

export const TEXT: LocaleText = { meta: META_PL, ui: UI_PL, app: APP_TEXT_PL };
