// The German short texts: page titles, interface and app texts, loaded together when the
// app shows a page in German (src/i18n/locale-text.ts).

import type { LocaleText } from '../locale-text';
import { META_DE } from './meta';
import { UI_DE } from './ui';
import { APP_TEXT_DE } from './app';

export const TEXT: LocaleText = { meta: META_DE, ui: UI_DE, app: APP_TEXT_DE };
