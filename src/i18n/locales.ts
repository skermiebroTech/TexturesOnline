// The languages of the public pages. English lives at the site root ("/help/"); every other
// language under its own folder ("/de/help/"). Pure helpers, no DOM and no translations here.
//
// Adding a language: add it to LOCALES and LOCALE_INFO, give it a folder in src/i18n/ (ui.ts,
// meta.ts and content.ts) and register those in src/i18n/ui.ts, src/app/seo/meta.ts and
// src/i18n/content.ts (which also explains how a page gets translated).

export const LOCALES = ['en', 'de', 'es', 'pt-br', 'ja', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];
export type TranslatedLocale = Exclude<Locale, 'en'>;

export const DEFAULT_LOCALE: Locale = 'en';
export const TRANSLATED_LOCALES: TranslatedLocale[] = LOCALES.filter((l): l is TranslatedLocale => l !== DEFAULT_LOCALE);

export interface LocaleInfo {
  code: Locale;
  /** <html lang>, hreflang and JSON-LD inLanguage (BCP 47) */
  lang: string;
  /** Open Graph locale */
  ogLocale: string;
  /** The language's own name, as shown in the language switcher */
  name: string;
  /** English name (aria labels and tests) */
  englishName: string;
  /**
   * Its letters live in the pixel font's extension files (texel-*-ext.woff2: Cyrillic, Greek, more
   * Latin), so its pages preload those too instead of showing fallback text first.
   */
  extendedFont?: boolean;
}

export const LOCALE_INFO: Record<Locale, LocaleInfo> = {
  en: { code: 'en', lang: 'en', ogLocale: 'en_US', name: 'English', englishName: 'English' },
  de: { code: 'de', lang: 'de', ogLocale: 'de_DE', name: 'Deutsch', englishName: 'German' },
  es: { code: 'es', lang: 'es', ogLocale: 'es_ES', name: 'Español', englishName: 'Spanish' },
  'pt-br': { code: 'pt-br', lang: 'pt-BR', ogLocale: 'pt_BR', name: 'Português (Brasil)', englishName: 'Portuguese (Brazil)' },
  ja: { code: 'ja', lang: 'ja', ogLocale: 'ja_JP', name: '日本語', englishName: 'Japanese' },
  ru: { code: 'ru', lang: 'ru', ogLocale: 'ru_RU', name: 'Русский', englishName: 'Russian', extendedFont: true },
};

export function isLocale(s: string): s is Locale {
  return (LOCALES as readonly string[]).includes(s);
}

/** Splits '/de/help?s=x' into its language and route path: { locale: 'de', path: '/help?s=x' }. */
export function splitLocale(path: string): { locale: Locale; path: string } {
  const m = /^\/([a-z]{2}(?:-[a-z]{2})?)(?=$|[/?#])(.*)$/.exec(path);
  if (m && m[1] !== DEFAULT_LOCALE && isLocale(m[1])) {
    const rest = m[2] || '/';
    return { locale: m[1], path: rest.startsWith('/') ? rest : `/${rest}` };
  }
  return { locale: DEFAULT_LOCALE, path };
}

/** Route path in a language's folder, without any checks: prefixPath('/help?s=x', 'de') === '/de/help?s=x'. */
export function prefixPath(path: string, locale: Locale): string {
  if (locale === DEFAULT_LOCALE) return path;
  const p = path.startsWith('/') ? path : `/${path}`;
  if (p === '/' || /^\/[?#]/.test(p)) return `/${locale}${p.slice(1) ? `/${p.slice(1)}` : ''}`;
  return `/${locale}${p}`;
}
