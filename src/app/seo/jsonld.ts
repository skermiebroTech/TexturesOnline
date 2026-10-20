// schema.org structured data (JSON-LD) builders. Every node describes content that is visible on
// the page it is embedded in.

import { renderText, type Child } from '../markup';
import type { Crumb, FaqItem } from '../content/blocks';
import { CONTENT_UPDATED, OG_IMAGE, PUBLISHER, REPO_URL, SITE_ALT_NAME, SITE_NAME, SITE_SUMMARY, SITE_URL, SOCIAL_PROFILES, absoluteUrl } from '../site';
import { metaLocale, type PageMeta } from './meta';
import { LOCALES, LOCALE_INFO } from '../../i18n/locales';
import { ui } from '../../i18n/ui';

/** BCP 47 language of a page (JSON-LD inLanguage). */
const langOf = (meta: PageMeta): string => LOCALE_INFO[metaLocale(meta)].lang;

export type JsonLd = Record<string, unknown>;

export const ORG_ID = `${SITE_URL}#publisher`;
export const WEBSITE_ID = `${SITE_URL}#website`;
export const APP_ID = `${SITE_URL}#app`;

export interface Screenshot {
  path: string;
  width: number;
  height: number;
  caption: string;
}

export const DEFAULT_SCREENSHOT: Screenshot = { path: OG_IMAGE.path, width: OG_IMAGE.width, height: OG_IMAGE.height, caption: OG_IMAGE.alt };

const image = (s: Screenshot): JsonLd => ({ '@type': 'ImageObject', url: absoluteUrl(s.path), width: s.width, height: s.height, caption: s.caption });

export function organization(): JsonLd {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: PUBLISHER.name,
    url: PUBLISHER.url,
    sameAs: [PUBLISHER.url, REPO_URL, ...SOCIAL_PROFILES.map((p) => p.url)],
    logo: { '@type': 'ImageObject', url: absoluteUrl('icons/icon-512.png'), width: 512, height: 512 },
  };
}

export function website(): JsonLd {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: SITE_URL,
    name: SITE_NAME,
    alternateName: [SITE_ALT_NAME, `Minecraft ${SITE_NAME}`],
    description: SITE_SUMMARY,
    // The public pages are written in these languages (the editors themselves are English).
    inLanguage: LOCALES.map((l) => LOCALE_INFO[l].lang),
    publisher: { '@id': ORG_ID },
  };
}

export function webPage(meta: PageMeta, opts: { type?: string; breadcrumb?: boolean; about?: string } = {}): JsonLd {
  const url = absoluteUrl(meta.path);
  return {
    '@type': opts.type ?? 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: meta.title,
    description: meta.description,
    isPartOf: { '@id': WEBSITE_ID },
    inLanguage: langOf(meta),
    primaryImageOfPage: image({ ...DEFAULT_SCREENSHOT, caption: ui(metaLocale(meta)).ogImageAlt }),
    ...(opts.about ? { about: { '@id': opts.about } } : {}),
    ...(opts.breadcrumb ? { breadcrumb: { '@id': `${url}#breadcrumb` } } : {}),
  };
}

/** `urlOf` turns a crumb's route path into its absolute URL (translated pages link their own language). */
export function breadcrumbList(meta: PageMeta, crumbs: Crumb[], urlOf: (to: string) => string = absoluteUrl): JsonLd {
  const url = absoluteUrl(meta.path);
  return {
    '@type': 'BreadcrumbList',
    '@id': `${url}#breadcrumb`,
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.label,
      item: c.to ? urlOf(c.to) : url,
    })),
  };
}

export function webApplication(opts: { id: string; name: string; url: string; description: string; featureList: string[]; screenshot: Screenshot }): JsonLd {
  return {
    '@type': 'WebApplication',
    '@id': opts.id,
    name: opts.name,
    url: opts.url,
    description: opts.description,
    applicationCategory: 'DesignApplication',
    applicationSubCategory: 'Minecraft texture pack, skin and shader editor',
    operatingSystem: 'Web browser',
    browserRequirements: 'Requires JavaScript and a modern web browser (Chrome, Edge, Firefox or Safari).',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    featureList: opts.featureList,
    screenshot: image(opts.screenshot),
    // The editor's own interface is English on every page for now.
    inLanguage: 'en',
    publisher: { '@id': ORG_ID },
    isPartOf: { '@id': WEBSITE_ID },
  };
}

export function faqPage(meta: PageMeta, items: FaqItem[], id = 'faq'): JsonLd {
  const url = absoluteUrl(meta.path);
  return {
    '@type': 'FAQPage',
    '@id': `${url}#${id}`,
    url,
    isPartOf: { '@id': `${url}#webpage` },
    mainEntity: items.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: renderText(f.a) },
    })),
  };
}

export function howTo(meta: PageMeta, id: string, name: string, steps: Child[]): JsonLd {
  const url = absoluteUrl(meta.path);
  return {
    '@type': 'HowTo',
    '@id': `${url}#howto-${id}`,
    name,
    inLanguage: langOf(meta),
    step: steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, text: renderText(s) })),
  };
}

export function techArticle(meta: PageMeta & { h1: string }, shot: Screenshot = DEFAULT_SCREENSHOT): JsonLd {
  const url = absoluteUrl(meta.path);
  return {
    '@type': 'TechArticle',
    '@id': `${url}#article`,
    headline: meta.h1,
    description: meta.description,
    url,
    mainEntityOfPage: { '@id': `${url}#webpage` },
    datePublished: CONTENT_UPDATED,
    dateModified: CONTENT_UPDATED,
    author: { '@id': ORG_ID },
    publisher: { '@id': ORG_ID },
    image: image(shot),
    inLanguage: langOf(meta),
    isPartOf: { '@id': WEBSITE_ID },
  };
}

export function itemList(id: string, items: { name: string; url: string }[]): JsonLd {
  return {
    '@type': 'ItemList',
    '@id': id,
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, url: it.url })),
  };
}

export function graph(nodes: JsonLd[]): JsonLd {
  return { '@context': 'https://schema.org', '@graph': nodes };
}
