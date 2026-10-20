// Translated page content, one bundle per language (src/i18n/<lang>/content.ts). The English text
// stays in the page modules (src/tools/*/content.ts, src/app/content/tools.ts); each of them
// describes its text as an interface, and a translation fills in the same interface.
//
// How a page gets translated
// 1. Its title, description and short name go in src/i18n/<lang>/meta.ts (pages by route path,
//    guides by slug).
// 2. Its text goes in the language's content bundle (home, help, about, guides index, tools by
//    tool id, guides by slug). TypeScript checks every field is there.
// From then on the build writes /<lang>/<page>/, hreflang links and sitemap entries, links on
// translated pages lead to it, and the language switcher offers it. Pages without both stay
// English only: links from translated pages simply go to the English page.
//
// The build and the unit tests register every language at once (src/i18n/all-content.ts); the
// running app loads only the language it shows (loadContent).

import type { Locale, TranslatedLocale } from './locales';
import type { HomeText } from '../tools/home/content';
import type { ToolIntroText, IntroTool } from '../app/content/tools';
import type { HelpText } from '../tools/help/content';
import type { AboutText } from '../tools/about/content';
import type { GuideText, GuidesIndexText } from '../tools/guides/content';
import type { PrivacyText } from '../tools/privacy/content';

export interface LocaleContent {
  home?: HomeText;
  tools: Partial<Record<IntroTool, ToolIntroText>>;
  help?: HelpText;
  about?: AboutText;
  guidesIndex?: GuidesIndexText;
  /** By guide slug */
  guides: Partial<Record<string, GuideText>>;
  privacy?: PrivacyText;
}

const store = new Map<TranslatedLocale, LocaleContent>();

export function registerContent(locale: TranslatedLocale, content: LocaleContent): void {
  store.set(locale, content);
}

/** The loaded content of a language (throws when it has not been loaded). */
export function contentOf(locale: TranslatedLocale): LocaleContent {
  const c = store.get(locale);
  if (!c) throw new Error(`Content for "${locale}" is not loaded`);
  return c;
}

export function hasContent(locale: Locale): boolean {
  return locale === 'en' || store.has(locale);
}

const LOADERS: Record<TranslatedLocale, () => Promise<{ CONTENT: LocaleContent }>> = {
  de: () => import('./de/content'),
  es: () => import('./es/content'),
  'pt-br': () => import('./pt-br/content'),
  ja: () => import('./ja/content'),
};

/** Makes sure a language's content is available (the app calls this before rendering a page). */
export async function loadContent(locale: Locale): Promise<void> {
  if (hasContent(locale)) return;
  const l = locale as TranslatedLocale;
  const mod = await LOADERS[l]();
  registerContent(l, mod.CONTENT);
}

/** Source module of a language's content (the build preloads it on that language's pages). */
export const CONTENT_MODULES: Record<TranslatedLocale, string> = {
  de: 'src/i18n/de/content.ts',
  es: 'src/i18n/es/content.ts',
  'pt-br': 'src/i18n/pt-br/content.ts',
  ja: 'src/i18n/ja/content.ts',
};
