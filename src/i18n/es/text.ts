// The Spanish short texts: page titles, interface and app texts, loaded together when the
// app shows a page in Spanish (src/i18n/locale-text.ts).

import type { LocaleText } from '../locale-text';
import { META_ES } from './meta';
import { UI_ES } from './ui';
import { APP_TEXT_ES } from './app';

export const TEXT: LocaleText = { meta: META_ES, ui: UI_ES, app: APP_TEXT_ES };
