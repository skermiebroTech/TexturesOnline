// Interface text of the editors (everything after a tool opens: start screens, panels, dialogs,
// toasts, tooltips, aria-labels, errors) in the page's language. Pure (no DOM), so it also runs in
// Node (unit tests, the build).
//
// How it fits together (docs/translating-editors.md has the how-to):
// - A *section* is a tree of English strings registered with defineText('<id>', {...}). It lives in
//   an i18n/ folder of its owner (a tool, or the shared kit in src/ui/i18n/) and is imported only by
//   the modules that show its text, so the English stays in the chunk that uses it. defineText
//   returns a live object: read it when the text is needed (`t.title`), never copy a string at
//   module load, because the object is rewritten in place when the language changes.
// - A *language file* (<owner>/i18n/de.ts, es.ts, pt-br.ts, ja.ts) translates one or more
//   sections, keyed by section id. Its type is built from the English sections, so a missing or
//   extra key is a TypeScript error.
// - A *loader* (textLoader) fetches the language file of the page's language (dynamic import, so
//   English pages never download a translation). A tool view awaits its loader before rendering;
//   the router loads the kit's own language file before every page.
// - Messages use a small ICU-like syntax, formatted by fmt():
//     {name}                                   a parameter (numbers get the language's grouping)
//     {count, plural, one {# file} other {# files}}   plural categories of Intl.PluralRules
//                                              (plus exact matches like =0); # is the number
//     {edition, select, java {…} bedrock {…} other {…}}   choose by a string value
//   Japanese only needs `other`. Text inside plural/select branches can hold other {params}.

import { LOCALE_INFO, type Locale, type TranslatedLocale } from './locales';

/** English text of a section: strings, grouped in nested objects. */
export interface TextTree {
  readonly [key: string]: string | TextTree;
}

/** What a translation of a section must provide: the same keys, every leaf a string. */
export type Translation<T> = { -readonly [K in keyof T]: T[K] extends string ? string : Translation<T[K]> };

/** A language file: translations of sections, by section id. */
export type LanguageFile = Record<string, TextTree>;

export type LanguageFiles<F extends object = LanguageFile> = Record<TranslatedLocale, () => Promise<{ default: F }>>;

export type Params = Record<string, string | number>;

interface Section {
  en: TextTree;
  live: Record<string, unknown>;
}

const sections = new Map<string, Section>();
/** Loaded translations, by language and section id */
const loaded = new Map<Locale, Map<string, TextTree>>();
let active: Locale = 'en';

function clone(t: TextTree): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(t)) out[k] = typeof v === 'string' ? v : clone(v);
  return out;
}

/** Writes `tr` (or English where it has no string) over the live object, in place. */
function apply(live: Record<string, unknown>, en: TextTree, tr: TextTree | undefined): void {
  for (const [k, v] of Object.entries(en)) {
    const t = tr?.[k];
    if (typeof v === 'string') live[k] = typeof t === 'string' ? t : v;
    else apply(live[k] as Record<string, unknown>, v, t && typeof t === 'object' ? t : undefined);
  }
}

function translationOf(locale: Locale, id: string): TextTree | undefined {
  return locale === 'en' ? undefined : loaded.get(locale)?.get(id);
}

/**
 * Registers a section of English text under a unique id and returns its live object, which holds
 * the current language's text (English until a translation is loaded).
 */
export function defineText<T extends TextTree>(id: string, en: T): T {
  const existing = sections.get(id);
  // A module evaluated again (hot reload) keeps the live object its old copy handed out.
  const live = existing?.live ?? clone(en);
  sections.set(id, { en, live });
  apply(live, en, translationOf(active, id));
  return live as T;
}

/** Language of the editors' text (the router sets it to the page's language). */
export function textLocale(): Locale {
  return active;
}

/** Switches every section to `locale`: its loaded translation, else English. */
export function setTextLocale(locale: Locale): void {
  active = locale;
  for (const [id, s] of sections) apply(s.live, s.en, translationOf(locale, id));
}

/** Adds a language's translations (normally done by a loader). */
export function registerTranslations(locale: TranslatedLocale, file: LanguageFile): void {
  let m = loaded.get(locale);
  if (!m) loaded.set(locale, (m = new Map()));
  for (const [id, tr] of Object.entries(file)) {
    m.set(id, tr);
    const s = sections.get(id);
    if (s && locale === active) apply(s.live, s.en, tr);
  }
}

/** Ids and English text of every registered section (unit tests). */
export function registeredSections(): Map<string, TextTree> {
  return new Map([...sections].map(([id, s]) => [id, s.en]));
}

/**
 * A loader for a set of language files: `await load(locale)` makes their translations available
 * (English needs nothing). A file that fails to load (offline, an old cached page) leaves its text
 * in English instead of breaking the view.
 */
export function textLoader<F extends object>(files: LanguageFiles<F>): (locale: Locale) => Promise<void> {
  const done = new Set<Locale>();
  const pending = new Map<Locale, Promise<void>>();
  return (locale) => {
    if (locale === 'en' || done.has(locale)) return Promise.resolve();
    let p = pending.get(locale);
    if (!p) {
      const l = locale as TranslatedLocale;
      p = files[l]()
        .then((m) => {
          registerTranslations(l, m.default as unknown as LanguageFile);
          done.add(l);
        })
        .catch((err: unknown) => console.warn(`Interface text for "${l}" could not be loaded`, err))
        .finally(() => pending.delete(l));
      pending.set(locale, p);
    }
    return p;
  };
}

// ------------------------------------------------------------------------------------- formatting

/** BCP 47 tag for Intl ('en-US' for English, matching the app's English number style). */
export function intlLocale(locale: Locale = active): string {
  return locale === 'en' ? 'en-US' : LOCALE_INFO[locale].lang;
}

const numberFormats = new Map<string, Intl.NumberFormat>();
const pluralRules = new Map<string, Intl.PluralRules>();

/** A number in the text's language: 1,234 / 1.234 / 1 234. */
export function num(n: number, opts?: Intl.NumberFormatOptions, locale: Locale = active): string {
  const key = `${locale}|${opts ? JSON.stringify(opts) : ''}`;
  let f = numberFormats.get(key);
  if (!f) numberFormats.set(key, (f = new Intl.NumberFormat(intlLocale(locale), opts)));
  return f.format(n);
}

function pluralCategory(n: number, locale: Locale): string {
  let r = pluralRules.get(locale);
  if (!r) pluralRules.set(locale, (r = new Intl.PluralRules(intlLocale(locale))));
  return r.select(n);
}

/** Index of the '}' closing the '{' at `open` (-1 when unbalanced). */
function closing(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}' && --depth === 0) return i;
  }
  return -1;
}

/** `one {…} other {…}` -> { one: '…', other: '…' } */
function cases(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  while (i < s.length) {
    const open = s.indexOf('{', i);
    if (open < 0) break;
    const key = s.slice(i, open).trim();
    const end = closing(s, open);
    if (end < 0) break;
    out[key] = s.slice(open + 1, end);
    i = end + 1;
  }
  return out;
}

function format(msg: string, params: Params, locale: Locale, pound: string | null): string {
  let out = '';
  let i = 0;
  while (i < msg.length) {
    const open = msg.indexOf('{', i);
    const hash = pound === null ? -1 : msg.indexOf('#', i);
    if (hash >= 0 && (open < 0 || hash < open)) {
      out += msg.slice(i, hash) + pound;
      i = hash + 1;
      continue;
    }
    if (open < 0) {
      out += msg.slice(i);
      break;
    }
    out += msg.slice(i, open);
    const end = closing(msg, open);
    if (end < 0) {
      out += msg.slice(open);
      break;
    }
    out += argument(msg.slice(open + 1, end), params, locale);
    i = end + 1;
  }
  return out;
}

function argument(body: string, params: Params, locale: Locale): string {
  const c1 = body.indexOf(',');
  if (c1 < 0) {
    const v = params[body.trim()];
    if (v === undefined) return `{${body}}`;
    return typeof v === 'number' ? num(v, undefined, locale) : v;
  }
  const name = body.slice(0, c1).trim();
  const c2 = body.indexOf(',', c1 + 1);
  const kind = body.slice(c1 + 1, c2 < 0 ? undefined : c2).trim();
  const options = cases(c2 < 0 ? '' : body.slice(c2 + 1));
  const v = params[name];
  if (kind === 'plural') {
    const n = typeof v === 'number' ? v : Number(v);
    const branch = options[`=${n}`] ?? options[pluralCategory(n, locale)] ?? options.other ?? '';
    return format(branch, params, locale, num(n, undefined, locale));
  }
  if (kind === 'select') return format(options[String(v)] ?? options.other ?? '', params, locale, null);
  return `{${body}}`;
}

/** Fills a message's {params}, plurals and selects in the text's language. */
export function fmt(msg: string, params: Params = {}, locale: Locale = active): string {
  return msg.includes('{') ? format(msg, params, locale, null) : msg;
}

/**
 * Like fmt, for sentences with elements in them (a link, a <code> path): parameters may be DOM
 * nodes, and the result is a list of strings and those nodes, ready for h(...) or append(...).
 */
export function fmtNodes<N extends object>(msg: string, params: Record<string, string | number | N>, locale: Locale = active): (string | N)[] {
  const nodes: N[] = [];
  const flat: Params = {};
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'object') {
      flat[k] = `\u0000${nodes.length}\u0000`;
      nodes.push(v);
    } else flat[k] = v;
  }
  const out: (string | N)[] = [];
  fmt(msg, flat, locale)
    .split('\u0000')
    .forEach((part, i) => {
      if (i % 2) out.push(nodes[Number(part)]);
      else if (part) out.push(part);
    });
  return out;
}

/** Names of the parameters a message uses (unit tests compare them across languages). */
export function messageParams(msg: string): string[] {
  const names = new Set<string>();
  const walk = (s: string) => {
    let i = 0;
    while (i < s.length) {
      const open = s.indexOf('{', i);
      if (open < 0) return;
      const end = closing(s, open);
      if (end < 0) return;
      const body = s.slice(open + 1, end);
      const c1 = body.indexOf(',');
      names.add((c1 < 0 ? body : body.slice(0, c1)).trim());
      if (c1 >= 0) {
        const c2 = body.indexOf(',', c1 + 1);
        if (c2 >= 0) for (const branch of Object.values(cases(body.slice(c2 + 1)))) walk(branch);
      }
      i = end + 1;
    }
  };
  walk(msg);
  return [...names].sort();
}

/** "a, b and c" / "a, b or c" in the text's language. */
export function joinList(items: string[], type: 'and' | 'or' = 'and', locale: Locale = active): string {
  if (locale === 'en') {
    // The app's English style: no serial comma.
    if (items.length < 2) return items[0] ?? '';
    return `${items.slice(0, -1).join(', ')} ${type} ${items[items.length - 1]}`;
  }
  return new Intl.ListFormat(intlLocale(locale), { type: type === 'and' ? 'conjunction' : 'disjunction' }).format(items);
}
