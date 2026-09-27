// schema.org structured data (JSON-LD) builders. Every node describes content that is visible on
// the page it is embedded in.

import { renderText, type Child } from '../markup';
import type { Crumb, FaqItem } from '../content/blocks';
import { CONTENT_UPDATED, OG_IMAGE, PUBLISHER, REPO_URL, SITE_ALT_NAME, SITE_NAME, SITE_SUMMARY, SITE_URL, absoluteUrl } from '../site';
import type { PageMeta } from './meta';

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
    sameAs: [PUBLISHER.url, REPO_URL],
    logo: { '@type': 'ImageObject', url: absoluteUrl('icons/icon-512.png'), width: 512, height: 512 },
  };
}

export function website(): JsonLd {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: SITE_URL,
    name: SITE_NAME,
    alternateName: [SITE_ALT_NAME],
    description: SITE_SUMMARY,
    inLanguage: 'en',
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
    inLanguage: 'en',
    primaryImageOfPage: image(DEFAULT_SCREENSHOT),
    ...(opts.about ? { about: { '@id': opts.about } } : {}),
    ...(opts.breadcrumb ? { breadcrumb: { '@id': `${url}#breadcrumb` } } : {}),
  };
}

export function breadcrumbList(meta: PageMeta, crumbs: Crumb[]): JsonLd {
  const url = absoluteUrl(meta.path);
  return {
    '@type': 'BreadcrumbList',
    '@id': `${url}#breadcrumb`,
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.label,
      item: absoluteUrl(c.to ?? meta.path),
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
    inLanguage: 'en',
    step: steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, text: renderText(s) })),
  };
}

export function techArticle(meta: PageMeta & { h1: string }): JsonLd {
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
    image: image(DEFAULT_SCREENSHOT),
    inLanguage: 'en',
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
