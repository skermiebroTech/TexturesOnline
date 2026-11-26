// The short texts of a language that the app shell itself shows: page titles and descriptions
// (src/app/seo/meta.ts), the interface texts of the public pages (src/i18n/ui.ts) and of the
// installable-app features (src/pwa/text.ts). English is in the app's main script; every other
// language is a small chunk of its own (src/i18n/<lang>/text.ts), so a page carries only its own
// language's text.
//
// ui() and pageMeta() stay synchronous: the app loads the page's language before it boots
// (src/main.ts; prerendered pages preload that chunk with the main script, so it costs no extra
// round trip) and the router loads a new language before it shows a page in it. The build and the
// unit tests register every language at once (src/i18n/all-content.ts).

import { registerMeta, type MetaTranslation } from '../app/seo/meta';
import { registerUi, type UiText } from './ui';
import { registerAppText, type AppText } from '../pwa/text';
import type { Locale, TranslatedLocale } from './locales';

export interface LocaleText {
  meta: MetaTranslation;
  ui: UiText;
  app: Partial<AppText>;
}

const LOADERS: Record<TranslatedLocale, () => Promise<{ TEXT: LocaleText }>> = {
  de: () => import('./de/text'),
  es: () => import('./es/text'),
  'pt-br': () => import('./pt-br/text'),
  ja: () => import('./ja/text'),
  ru: () => import('./ru/text'),
  fr: () => import('./fr/text'),
  pl: () => import('./pl/text'),
};

/** Source module of each language's text (the build preloads it on that language's pages). */
export const LOCALE_TEXT_MODULES: Record<TranslatedLocale, string> = {
  de: 'src/i18n/de/text.ts',
  es: 'src/i18n/es/text.ts',
  'pt-br': 'src/i18n/pt-br/text.ts',
  ja: 'src/i18n/ja/text.ts',
  ru: 'src/i18n/ru/text.ts',
  fr: 'src/i18n/fr/text.ts',
  pl: 'src/i18n/pl/text.ts',
};

const registered = new Set<Locale>(['en']);
const loading = new Map<TranslatedLocale, Promise<void>>();

export function registerLocaleText(locale: TranslatedLocale, text: LocaleText): void {
  registerMeta(locale, text.meta);
  registerUi(locale, text.ui);
  registerAppText(locale, text.app);
  registered.add(locale);
}

/** Whether a language's text is ready (ui() and pageMeta() give its words). */
export function hasLocaleText(locale: Locale): boolean {
  return registered.has(locale);
}

/** Makes sure a language's text is ready. A failed load can be tried again. */
export function loadLocaleText(locale: Locale): Promise<void> {
  if (registered.has(locale)) return Promise.resolve();
  const l = locale as TranslatedLocale;
  let p = loading.get(l);
  if (!p) {
    p = LOADERS[l]().then(
      (mod) => registerLocaleText(l, mod.TEXT),
      (err: unknown) => {
        loading.delete(l);
        throw err;
      },
    );
    loading.set(l, p);
  }
  return p;
}
