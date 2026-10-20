// Keeps the document head in step with in-app navigation: language, description, canonical and
// hreflang links, robots and social tags for public pages; "noindex" for private project pages and
// the UI kit. (Search engines get the same values in the prerendered HTML; this matters once
// someone navigates inside the app.)

import { onRouteChange } from '../core/router';
import { pageLocales, pageMeta } from './seo/meta';
import { absoluteUrl } from './site';
import { LOCALE_INFO } from '../i18n/locales';

export const ROBOTS_PUBLIC = 'index,follow,max-image-preview:large';
export const ROBOTS_PRIVATE = 'noindex,follow';

function metaEl(attr: 'name' | 'property', key: string): HTMLMetaElement {
  let m = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!m) {
    m = document.createElement('meta');
    m.setAttribute(attr, key);
    document.head.appendChild(m);
  }
  return m;
}

function setMeta(attr: 'name' | 'property', key: string, value: string): void {
  const m = metaEl(attr, key);
  if (m.content !== value) m.content = value;
}

function setCanonical(url: string | null): void {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!url) {
    link?.remove();
    return;
  }
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  if (link.href !== url) link.href = url;
}

/** Replaces the hreflang links (and og:locale:alternate tags) with the given set. */
function setAlternates(links: { hreflang: string; href: string }[], ogAlternates: string[]): void {
  document.head.querySelectorAll('link[rel="alternate"][hreflang], meta[property="og:locale:alternate"]').forEach((n) => n.remove());
  const anchor = document.head.querySelector('link[rel="canonical"]');
  const nodes: Element[] = [
    ...links.map((l) => Object.assign(document.createElement('link'), { rel: 'alternate', hreflang: l.hreflang, href: l.href })),
    ...ogAlternates.map((o) => {
      const m = document.createElement('meta');
      m.setAttribute('property', 'og:locale:alternate');
      m.content = o;
      return m;
    }),
  ];
  if (anchor) anchor.after(...nodes);
  else document.head.append(...nodes);
}

export function initHead(): void {
  onRouteChange((state) => {
    const lang = LOCALE_INFO[state.locale].lang;
    if (document.documentElement.lang !== lang) document.documentElement.lang = lang;
    const meta = pageMeta(state.path, state.locale);
    setMeta('name', 'robots', meta ? ROBOTS_PUBLIC : ROBOTS_PRIVATE);
    if (!meta) {
      setCanonical(null);
      setAlternates([], []);
      return;
    }
    const url = absoluteUrl(meta.path);
    setCanonical(url);
    const locales = pageLocales(state.path);
    const links = locales.map((l) => ({ hreflang: LOCALE_INFO[l].lang, href: absoluteUrl(pageMeta(state.path, l)!.path) }));
    setAlternates(
      [...links, { hreflang: 'x-default', href: absoluteUrl(pageMeta(state.path, 'en')!.path) }],
      locales.filter((l) => l !== state.locale).map((l) => LOCALE_INFO[l].ogLocale),
    );
    setMeta('property', 'og:locale', LOCALE_INFO[state.locale].ogLocale);
    setMeta('name', 'description', meta.description);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:title', meta.title);
    setMeta('property', 'og:description', meta.description);
    setMeta('name', 'twitter:title', meta.title);
    setMeta('name', 'twitter:description', meta.description);
  });
}
