// Japanese page content (loaded on Japanese pages only; see src/i18n/content.ts).

import type { LocaleContent } from '../content';
import { HOME } from './home';
import { TOOLS } from './tools';
import { HELP } from './help';
import { ABOUT } from './about';
import { GUIDES, GUIDES_INDEX } from './guides';
import { PRIVACY } from './privacy';

export const CONTENT: LocaleContent = { home: HOME, tools: TOOLS, help: HELP, about: ABOUT, guidesIndex: GUIDES_INDEX, guides: GUIDES, privacy: PRIVACY };
