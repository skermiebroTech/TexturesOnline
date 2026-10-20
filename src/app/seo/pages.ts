// Every prerendered page: its content tree, structured data and the view module it boots into, in
// English and in every language the page has been translated into.
// Used at build time (vite.config.ts) and by the unit tests; nothing here touches the DOM.

import '../../i18n/all-content';
import type { Child } from '../markup';
import { footer, type NavTool } from '../content/chrome';
import type { Crumb } from '../content/blocks';
import { TOOL_INTROS, toolIntro, toolIntroIn, type IntroTool } from '../content/tools';
import { absoluteUrl, SITE_NAME } from '../site';
import { ABOUT_META, ALL_META, GUIDES, GUIDES_META, HELP_META, HOME_META, PRIVACY_META, TOOL_META, guidesIn, metaLocale, metaRoute, pageLocales, pageMeta, type PageMeta } from './meta';
import {
  APP_ID,
  DEFAULT_SCREENSHOT,
  breadcrumbList,
  faqPage,
  graph,
  howTo,
  itemList,
  organization,
  techArticle,
  webApplication,
  webPage,
  website,
  type JsonLd,
  type Screenshot,
} from './jsonld';
import { homePage, homeText, homeTools } from '../../tools/home/content';
import { helpPage, helpSections, helpText } from '../../tools/help/content';
import { guideBySlug, guidePage, guidesIndexPage } from '../../tools/guides/content';
import { aboutPage, aboutText } from '../../tools/about/content';
import { privacyPage } from '../../tools/privacy/content';
import { allPage } from '../../tools/all/content';
import { CONTENT_MODULES, contentOf, hasContent } from '../../i18n/content';
import { TRANSLATED_LOCALES, type Locale } from '../../i18n/locales';
import { ui } from '../../i18n/ui';

export interface PrerenderPage {
  meta: PageMeta;
  locale: Locale;
  /** The same page in every language it exists in (this one included) */
  alternates: { locale: Locale; url: string }[];
  /** <html data-tool> and <body data-route> */
  tool: 'home' | 'textures' | 'convert' | 'merge' | 'totem' | 'skins' | 'shaders' | 'help';
  /** Highlighted main-nav link */
  nav: NavTool;
  /** Classes of the view element (same as the router + view add at runtime) */
  viewClass: string;
  /**
   * 'keep': the prerendered markup is exactly what the view renders, so it stays visible until
   * the swap. 'replace': the tool loads something else first (the prerendered text is hidden
   * while it boots and reappears below the tool's start screen).
   */
  boot: 'keep' | 'replace';
  /** Source modules whose built CSS the prerendered markup needs (linked as stylesheets) */
  styles: string[];
  /** Source modules the page boots into (JS preloaded, CSS fetched early without blocking) */
  preload: string[];
  /** Source files of pictures the booted page shows first (fetched before the script asks for them) */
  preloadImages?: string[];
  /** Main content including the footer */
  body(year: number): Child[];
  /** Content for llms-full.txt (no footer) */
  content(): Child[];
  jsonld(): JsonLd;
  /** Page talks to Mojang / GitHub servers right away (preconnect) */
  preconnect: boolean;
  og: { type: 'website' | 'article'; image: Screenshot };
}

export const SCREENSHOTS: Record<IntroTool | 'home', Screenshot> = {
  home: DEFAULT_SCREENSHOT,
  textures: { path: 'screenshots/textures.jpg', width: 1280, height: 800, caption: 'Texture Pack Maker texture tool: one-click styles and a new pack for Java 26.3 or Bedrock' },
  converter: { path: 'screenshots/textures.jpg', width: 1280, height: 800, caption: 'Texture Pack Maker texture pack converter: Java to Bedrock, Bedrock to Java and Java version updates' },
  merge: { path: 'screenshots/textures.jpg', width: 1280, height: 800, caption: 'Texture Pack Maker pack merger: several Java or Bedrock texture packs combined into one, top pack first' },
  totem: { path: 'screenshots/skins.jpg', width: 1280, height: 800, caption: 'Texture Pack Maker totem maker: a player skin turned into a custom Totem of Undying resource pack' },
  skinpack: { path: 'screenshots/guides/skin-pack-export.jpg', width: 1078, height: 674, caption: 'Texture Pack Maker skin pack maker: three skins, classic and slim, bundled into one Bedrock .mcpack' },
  skins: { path: 'screenshots/skins.jpg', width: 1280, height: 800, caption: 'Texture Pack Maker skin editor: starter skins, classic or slim arms' },
  shaders: { path: 'screenshots/shaders.jpg', width: 1280, height: 800, caption: 'Texture Pack Maker shader maker: Iris / OptiFine, vanilla Java or Bedrock Vibrant Visuals' },
};

const TOOL_ROUTE_MODULE: Record<IntroTool, string> = {
  textures: 'src/tools/textures/view.ts',
  skins: 'src/tools/skins/view.ts',
  skinpack: 'src/tools/skins/view.ts',
  converter: 'src/tools/convert/view.ts',
  merge: 'src/tools/merge/view.ts',
  totem: 'src/tools/totem/view.ts',
  shaders: 'src/tools/shaders/view.ts',
};

/**
 * The picture a start screen shows first (its largest element) when the view loads that start
 * screen in a second step: fetched with the page, so it is ready when the start screen appears.
 * (Preloading the start screen's scripts as well would compete with the first paint.)
 */
const TOOL_START_IMAGE: Partial<Record<IntroTool, string>> = {
  shaders: 'src/tools/shaders/ui/showcase/iris.webp',
};

/** A page's screenshot with its caption in the page's language. */
function shotIn(locale: Locale, key: IntroTool | 'home'): Screenshot {
  if (locale === 'en') return SCREENSHOTS[key];
  const caption = key === 'home' ? ui(locale).ogImageAlt : (toolIntroIn(key, locale).screenshotCaption ?? ui(locale).ogImageAlt);
  return { ...SCREENSHOTS[key], caption };
}

/** Breadcrumbs from the language's home page. */
const crumbsFor = (locale: Locale, ...items: Crumb[]): Crumb[] => [{ label: ui(locale).home, to: '/' }, ...items];

/** Fields every page shares: language, alternates, footer and the language's content module. */
function base(meta: PageMeta, preload: string[]): Pick<PrerenderPage, 'meta' | 'locale' | 'alternates' | 'preload'> {
  const locale = metaLocale(meta);
  const route = metaRoute(meta);
  return {
    meta,
    locale,
    alternates: pageLocales(route).map((l) => ({ locale: l, url: absoluteUrl(pageMeta(route, l)!.path) })),
    // The view waits for its language's text before replacing the prerendered page.
    preload: locale === 'en' ? preload : [...preload, CONTENT_MODULES[locale]],
  };
}

const footerFor = (meta: PageMeta) => (year: number) => footer(year, metaLocale(meta), metaRoute(meta));

/** Absolute URL of a breadcrumb or link path in a language (English route paths are localized). */
const urlIn = (locale: Locale) => (to: string) => absoluteUrl(pageMeta(to, locale)?.path ?? to);

function homeEntry(locale: Locale): PrerenderPage | null {
  const meta = pageMeta(HOME_META.path, locale);
  if (!meta || !hasText(locale, (c) => c.home)) return null;
  const t = homeText(locale);
  const url = absoluteUrl(meta.path);
  const appId = locale === 'en' ? APP_ID : `${url}#app`;
  return {
    ...base(meta, ['src/tools/home/home.ts']),
    tool: 'home',
    nav: 'home',
    viewClass: 'view view-home home',
    boot: 'keep',
    styles: ['src/tools/home/home.ts'],
    body: (year) => [homePage(locale), footerFor(meta)(year)],
    content: () => homePage(locale),
    preconnect: false,
    og: { type: 'website', image: shotIn(locale, 'home') },
    jsonld: () =>
      graph([
        organization(),
        website(),
        webPage(meta, { about: appId }),
        webApplication({
          id: appId,
          name: SITE_NAME,
          url,
          description: meta.description,
          featureList: [...t.appFeatures, ...homeTools(locale).map((tool) => `${tool.title}: ${tool.blurb}`)],
          screenshot: shotIn(locale, 'home'),
        }),
        faqPage(meta, t.faq),
      ]),
  };
}

function toolEntry(tool: IntroTool, locale: Locale): PrerenderPage | null {
  const meta = pageMeta(TOOL_META[tool].path, locale);
  if (!meta || !hasText(locale, (c) => c.tools[tool])) return null;
  const intro = toolIntroIn(tool, locale);
  const url = absoluteUrl(meta.path);
  const crumbs = crumbsFor(locale, { label: meta.label });
  const tb = TOOL_INTROS[tool].base ?? (tool as Exclude<IntroTool, 'skinpack' | 'converter' | 'merge' | 'totem'>);
  const startImage = TOOL_START_IMAGE[tool];
  return {
    ...base(meta, [TOOL_ROUTE_MODULE[tool], 'src/app/tool-intro.ts']),
    ...(startImage ? { preloadImages: [startImage] } : {}),
    tool: tb,
    nav: tb,
    viewClass: `view view-${tb}`,
    boot: 'replace',
    styles: ['src/app/tool-intro.ts'],
    body: (year) => [toolIntro(tool, { prerender: true, locale }), footerFor(meta)(year)],
    content: () => [toolIntro(tool, { prerender: true, locale })],
    preconnect: true,
    og: { type: 'website', image: shotIn(locale, tool) },
    jsonld: () =>
      graph([
        organization(),
        website(),
        webPage(meta, { breadcrumb: true, about: `${url}#app` }),
        breadcrumbList(meta, crumbs, urlIn(locale)),
        webApplication({ id: `${url}#app`, name: intro.appName, url, description: meta.description, featureList: intro.featureList, screenshot: shotIn(locale, tool) }),
        faqPage(meta, intro.faq),
      ]),
  };
}

function helpEntry(locale: Locale): PrerenderPage | null {
  const meta = pageMeta(HELP_META.path, locale);
  if (!meta || !hasText(locale, (c) => c.help)) return null;
  return {
    ...base(meta, ['src/tools/help/help.ts']),
    tool: 'help',
    nav: 'help',
    viewClass: 'view view-help help',
    boot: 'keep',
    styles: ['src/tools/help/help.ts'],
    body: (year) => [helpPage(locale), footerFor(meta)(year)],
    content: () => helpPage(locale),
    preconnect: false,
    og: { type: 'website', image: shotIn(locale, 'home') },
    jsonld: () =>
      graph([
        organization(),
        website(),
        webPage(meta, { breadcrumb: true }),
        breadcrumbList(meta, crumbsFor(locale, { label: meta.label }), urlIn(locale)),
        faqPage(meta, helpText(locale).faq),
        ...helpSections(locale)
          .filter((s) => s.howto)
          .map((s) => howTo(meta, s.id, s.howto!.name, s.howto!.steps)),
      ]),
  };
}

function aboutEntry(locale: Locale): PrerenderPage | null {
  const meta = pageMeta(ABOUT_META.path, locale);
  if (!meta || !hasText(locale, (c) => c.about)) return null;
  return {
    ...base(meta, ['src/tools/about/about.ts']),
    tool: 'help',
    nav: 'help',
    viewClass: 'view view-help guides',
    boot: 'keep',
    styles: ['src/tools/about/about.ts'],
    body: (year) => [aboutPage(locale), footerFor(meta)(year)],
    content: () => [aboutPage(locale)],
    preconnect: false,
    og: { type: 'website', image: shotIn(locale, 'home') },
    jsonld: () =>
      graph([
        organization(),
        website(),
        { ...webPage(meta, { type: 'AboutPage', breadcrumb: true }), mainEntity: { '@id': APP_ID } },
        breadcrumbList(meta, crumbsFor(locale, { label: meta.label }), urlIn(locale)),
        faqPage(meta, aboutText(locale).faq),
      ]),
  };
}

function allEntry(locale: Locale): PrerenderPage | null {
  const meta = pageMeta(ALL_META.path, locale);
  if (!meta || !hasText(locale, (c) => c.all)) return null;
  return {
    ...base(meta, ['src/tools/all/all.ts']),
    tool: 'help',
    nav: 'help',
    viewClass: 'view view-help guides',
    boot: 'keep',
    styles: ['src/tools/all/all.ts'],
    body: (year) => [allPage(locale), footerFor(meta)(year)],
    content: () => [allPage(locale)],
    preconnect: false,
    og: { type: 'website', image: shotIn(locale, 'home') },
    jsonld: () => graph([organization(), website(), webPage(meta, { type: 'CollectionPage', breadcrumb: true }), breadcrumbList(meta, crumbsFor(locale, { label: meta.label }), urlIn(locale))]),
  };
}

function privacyEntry(locale: Locale): PrerenderPage | null {
  const meta = pageMeta(PRIVACY_META.path, locale);
  if (!meta) return null;
  return {
    ...base(meta, ['src/tools/privacy/privacy.ts']),
    tool: 'help',
    nav: 'help',
    viewClass: 'view view-help guides',
    boot: 'keep',
    styles: ['src/tools/privacy/privacy.ts'],
    body: (year) => [privacyPage(locale), footerFor(meta)(year)],
    content: () => [privacyPage(locale)],
    preconnect: false,
    og: { type: 'website', image: shotIn(locale, 'home') },
    jsonld: () =>
      graph([
        organization(),
        website(),
        webPage(meta, { breadcrumb: true }),
        breadcrumbList(meta, crumbsFor(locale, { label: meta.label }), urlIn(locale)),
      ]),
  };
}

function guidesIndexEntry(locale: Locale): PrerenderPage | null {
  const meta = pageMeta(GUIDES_META.path, locale);
  if (!meta || !hasText(locale, (c) => c.guidesIndex)) return null;
  const url = absoluteUrl(meta.path);
  return {
    ...base(meta, ['src/tools/guides/guides.ts']),
    tool: 'help',
    nav: 'help',
    viewClass: 'view view-help guides',
    boot: 'keep',
    styles: ['src/tools/guides/guides.ts'],
    body: (year) => [guidesIndexPage(locale), footerFor(meta)(year)],
    content: () => [guidesIndexPage(locale)],
    preconnect: false,
    og: { type: 'website', image: shotIn(locale, 'home') },
    jsonld: () =>
      graph([
        organization(),
        website(),
        { ...webPage(meta, { type: 'CollectionPage', breadcrumb: true }), mainEntity: { '@id': `${url}#list` } },
        breadcrumbList(meta, crumbsFor(locale, { label: meta.label }), urlIn(locale)),
        itemList(
          `${url}#list`,
          guidesIn(locale).map((g) => ({ name: g.h1, url: absoluteUrl(g.path) })),
        ),
      ]),
  };
}

function guideEntry(slug: string, locale: Locale): PrerenderPage | null {
  const g = guideBySlug(slug, locale);
  if (!g) return null;
  const meta = g.meta;
  const index = pageMeta(GUIDES_META.path, locale) ?? GUIDES_META;
  // The guide's main screenshot, when it has one, for link previews and the article image
  const shot: Screenshot = g.image ? { path: g.image.src.replace(/^\//, ''), width: g.image.width, height: g.image.height, caption: g.image.alt } : shotIn(locale, 'home');
  return {
    ...base(meta, ['src/tools/guides/guides.ts']),
    tool: 'help',
    nav: 'help',
    viewClass: 'view view-help guides',
    boot: 'keep',
    styles: ['src/tools/guides/guides.ts'],
    body: (year) => [guidePage(g), footerFor(meta)(year)],
    content: () => [guidePage(g)],
    preconnect: false,
    og: { type: 'article', image: shot },
    jsonld: () =>
      graph([
        organization(),
        website(),
        webPage(meta, { breadcrumb: true }),
        breadcrumbList(meta, crumbsFor(locale, { label: index.label, to: GUIDES_META.path }, { label: meta.label }), urlIn(locale)),
        techArticle(meta, shot),
        ...(g.howto ? [howTo(meta, 'steps', g.howto.name, g.howto.steps)] : []),
        ...(g.faq?.length ? [faqPage(meta, g.faq)] : []),
      ]),
  };
}

/** True for English, or when the language's content bundle has this page's text. */
function hasText(locale: Locale, pick: (c: ReturnType<typeof contentOf>) => unknown): boolean {
  return locale === 'en' || (hasContent(locale) && !!pick(contentOf(locale)));
}

/** Every page of one language, in sitemap order (pages it has no translation for are left out). */
export function pagesIn(locale: Locale): PrerenderPage[] {
  const tools: IntroTool[] = ['textures', 'converter', 'merge', 'totem', 'skins', 'skinpack', 'shaders'];
  return [homeEntry(locale), ...tools.map((t) => toolEntry(t, locale)), helpEntry(locale), aboutEntry(locale), allEntry(locale), guidesIndexEntry(locale), ...GUIDES.map((g) => guideEntry(g.slug, locale)), privacyEntry(locale)].filter(
    (p): p is PrerenderPage => !!p,
  );
}

/** All prerendered pages, in sitemap order: English first, then each translation. */
export function prerenderPages(): PrerenderPage[] {
  return [...pagesIn('en'), ...TRANSLATED_LOCALES.flatMap(pagesIn)];
}
