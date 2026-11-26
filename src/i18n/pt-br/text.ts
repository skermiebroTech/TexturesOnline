// The Brazilian Portuguese short texts: page titles, interface and app texts, loaded together
// when the app shows a page in Brazilian Portuguese (src/i18n/locale-text.ts).

import type { LocaleText } from '../locale-text';
import { META_PT_BR } from './meta';
import { UI_PT_BR } from './ui';
import { APP_TEXT_PT_BR } from './app';

export const TEXT: LocaleText = { meta: META_PT_BR, ui: UI_PT_BR, app: APP_TEXT_PT_BR };
