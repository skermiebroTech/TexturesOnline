// The Japanese short texts: page titles, interface and app texts, loaded together when the
// app shows a page in Japanese (src/i18n/locale-text.ts).

import type { LocaleText } from '../locale-text';
import { META_JA } from './meta';
import { UI_JA } from './ui';
import { APP_TEXT_JA } from './app';

export const TEXT: LocaleText = { meta: META_JA, ui: UI_JA, app: APP_TEXT_JA };
