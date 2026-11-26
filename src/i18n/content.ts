// Translated page content, one bundle per language (src/i18n/<lang>/content.ts). The English text
// stays in the page modules (src/tools/*/content.ts, src/app/content/intros/*.ts); each of them
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

import { LOCALE_INFO, type Locale, type TranslatedLocale } from './locales';
import type { HomeText } from '../tools/home/content';
import type { ToolIntroText, IntroTool } from '../app/content/tools';
import type { HelpText } from '../tools/help/content';
import type { AboutText } from '../tools/about/content';
import type { GuideText, GuidesIndexText } from '../tools/guides/content';
import type { PrivacyText } from '../tools/privacy/content';
import type { AllText } from '../tools/all/content';

export interface LocaleContent {
  home?: HomeText;
  tools: Partial<Record<IntroTool, ToolIntroText>>;
  help?: HelpText;
  about?: AboutText;
  guidesIndex?: GuidesIndexText;
  /** By guide slug */
  guides: Partial<Record<string, GuideText>>;
  privacy?: PrivacyText;
  all?: AllText;
}

/**
 * How much of a language's content a page needs: a tool page shows only the tools' introductions,
 * a small part of the language's content (most of it is the guides' and the help page's text).
 */
export type ContentPart = 'all' | 'tools';

const store = new Map<TranslatedLocale, LocaleContent>();
/** Languages whose content is in the store in full (the others may have their tools' part). */
const complete = new Set<TranslatedLocale>();

export function registerContent(locale: TranslatedLocale, content: LocaleContent): void {
  store.set(locale, content);
  complete.add(locale);
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
  ru: () => import('./ru/content'),
  fr: () => import('./fr/content'),
  pl: () => import('./pl/content'),
};

/** The tools' part of each language's content on its own. */
const TOOLS_LOADERS: Record<TranslatedLocale, () => Promise<{ TOOLS: LocaleContent['tools'] }>> = {
  de: () => import('./de/tools'),
  es: () => import('./es/tools'),
  'pt-br': () => import('./pt-br/tools'),
  ja: () => import('./ja/tools'),
  ru: () => import('./ru/tools'),
  fr: () => import('./fr/tools'),
  pl: () => import('./pl/tools'),
};

/**
 * Fetches the pixel font's extension files for a language written with them (Cyrillic, and Polish ą ć ę ł ń ś ź ż), so a page
 * reached in the app does not show its text in the fallback font first (prerendered pages preload
 * them). Gives up after a moment: the text then simply swaps to the pixel font when it arrives.
 */
function loadExtendedFont(locale: Locale): Promise<unknown> {
  if (!LOCALE_INFO[locale].extendedFont || typeof document === 'undefined' || !document.fonts) return Promise.resolve();
  const fonts = Promise.all(['16px Texel', 'bold 16px Texel'].map((f) => document.fonts.load(f, 'Ж'))).catch(() => undefined);
  return Promise.race([fonts, new Promise((r) => setTimeout(r, 1000))]);
}

/**
 * Makes sure a language's content is available (the app calls this before rendering a page): all of
 * it, or only its tools' part (`part`).
 */
export async function loadContent(locale: Locale, part: ContentPart = 'all'): Promise<void> {
  if (locale === 'en') return;
  const l = locale as TranslatedLocale;
  if (complete.has(l) || (part === 'tools' && store.has(l))) return;
  if (part === 'tools') {
    const [mod] = await Promise.all([TOOLS_LOADERS[l](), loadExtendedFont(l)]);
    if (!store.has(l)) store.set(l, { tools: mod.TOOLS, guides: {} });
    return;
  }
  const [mod] = await Promise.all([LOADERS[l](), loadExtendedFont(l)]);
  registerContent(l, mod.CONTENT);
}

/** Source module of each language's tool texts (the build preloads it on that language's tool pages). */
export const TOOLS_CONTENT_MODULES: Record<TranslatedLocale, string> = {
  de: 'src/i18n/de/tools.ts',
  es: 'src/i18n/es/tools.ts',
  'pt-br': 'src/i18n/pt-br/tools.ts',
  ja: 'src/i18n/ja/tools.ts',
  ru: 'src/i18n/ru/tools.ts',
  fr: 'src/i18n/fr/tools.ts',
  pl: 'src/i18n/pl/tools.ts',
};

/** Source module of a language's content (the build preloads it on that language's pages). */
export const CONTENT_MODULES: Record<TranslatedLocale, string> = {
  de: 'src/i18n/de/content.ts',
  es: 'src/i18n/es/content.ts',
  'pt-br': 'src/i18n/pt-br/content.ts',
  ja: 'src/i18n/ja/content.ts',
  ru: 'src/i18n/ru/content.ts',
  fr: 'src/i18n/fr/content.ts',
  pl: 'src/i18n/pl/content.ts',
};
