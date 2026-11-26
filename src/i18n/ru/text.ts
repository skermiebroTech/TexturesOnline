// The Russian short texts: page titles, interface and app texts, loaded together when the
// app shows a page in Russian (src/i18n/locale-text.ts).

import type { LocaleText } from '../locale-text';
import { META_RU } from './meta';
import { UI_RU } from './ui';
import { APP_TEXT_RU } from './app';

export const TEXT: LocaleText = { meta: META_RU, ui: UI_RU, app: APP_TEXT_RU };
