// Every prerendered page: its content tree, structured data and the view module it boots into.
// Used at build time (vite.config.ts) and by the unit tests; nothing here touches the DOM.

import type { Child } from '../markup';
import { footer, type NavTool } from '../content/chrome';
import type { Crumb } from '../content/blocks';
import { TOOL_INTROS, toolIntro, type IntroTool } from '../content/tools';
import { absoluteUrl, SITE_NAME, SITE_URL } from '../site';
import { GUIDES, GUIDES_META, HELP_META, HOME_META, TOOL_META, type PageMeta } from './meta';
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
import { HOME_FAQ, TOOLS, homePage } from '../../tools/home/content';
import { FAQ as HELP_FAQ, SECTIONS as HELP_SECTIONS, helpPage } from '../../tools/help/content';
import { GUIDE_CONTENT, guidePage, guidesIndexPage } from '../../tools/guides/content';

export interface PrerenderPage {
  meta: PageMeta;
  /** <html data-tool> and <body data-route> */
  tool: 'home' | 'textures' | 'skins' | 'shaders' | 'help';
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
  skins: { path: 'screenshots/skins.jpg', width: 1280, height: 800, caption: 'Texture Pack Maker skin editor: starter skins, classic or slim arms' },
  shaders: { path: 'screenshots/shaders.jpg', width: 1280, height: 800, caption: 'Texture Pack Maker shader maker: Iris / OptiFine, vanilla Java or Bedrock Vibrant Visuals' },
};

const HOME_FEATURES = [
  'Minecraft texture pack maker for Java Edition (26.3 and every version since 1.6.1) and Bedrock Edition',
  'Minecraft skin editor with a live 3D preview, classic and slim models, Java PNG and Bedrock skin pack export',
  'Shader maker for Iris / OptiFine shader packs, no-mod vanilla Java shaders and Bedrock Vibrant Visuals packs',
  'Exports ready-to-use .zip and .mcpack files with the correct pack.mcmeta or manifest.json',
  'Runs in the browser: no sign-up, nothing uploaded, works offline after the first visit',
];

const TOOL_ROUTE_MODULE: Record<IntroTool, string> = {
  textures: 'src/tools/textures/view.ts',
  skins: 'src/tools/skins/view.ts',
  shaders: 'src/tools/shaders/view.ts',
};

const crumbsFor = (...items: Crumb[]): Crumb[] => [{ label: 'Home', to: '/' }, ...items];

function homeEntry(): PrerenderPage {
  return {
    meta: HOME_META,
    tool: 'home',
    nav: 'home',
    viewClass: 'view view-home home',
    boot: 'keep',
    styles: ['src/tools/home/home.ts'],
    preload: ['src/tools/home/home.ts'],
    body: (year) => [homePage(), footer(year)],
    content: () => homePage(),
    preconnect: false,
    og: { type: 'website', image: SCREENSHOTS.home },
    jsonld: () =>
      graph([
        organization(),
        website(),
        webPage(HOME_META, { about: APP_ID }),
        webApplication({
          id: APP_ID,
          name: SITE_NAME,
          url: SITE_URL,
          description: HOME_META.description,
          featureList: [...HOME_FEATURES, ...TOOLS.map((t) => `${t.title}: ${t.blurb}`)],
          screenshot: SCREENSHOTS.home,
        }),
        faqPage(HOME_META, HOME_FAQ),
      ]),
  };
}

function toolEntry(tool: IntroTool): PrerenderPage {
  const meta = TOOL_META[tool];
  const intro = TOOL_INTROS[tool];
  const url = absoluteUrl(meta.path);
  const crumbs = crumbsFor({ label: meta.label });
  return {
    meta,
    tool,
    nav: tool,
    viewClass: `view view-${tool}`,
    boot: 'replace',
    styles: ['src/app/tool-intro.ts'],
    preload: [TOOL_ROUTE_MODULE[tool], 'src/app/tool-intro.ts'],
    body: (year) => [toolIntro(tool, { prerender: true }), footer(year)],
    content: () => [toolIntro(tool, { prerender: true })],
    preconnect: true,
    og: { type: 'website', image: SCREENSHOTS[tool] },
    jsonld: () =>
      graph([
        organization(),
        website(),
        webPage(meta, { breadcrumb: true, about: `${url}#app` }),
        breadcrumbList(meta, crumbs),
        webApplication({ id: `${url}#app`, name: intro.appName, url, description: meta.description, featureList: intro.featureList, screenshot: SCREENSHOTS[tool] }),
        faqPage(meta, intro.faq),
      ]),
  };
}

function helpEntry(): PrerenderPage {
  return {
    meta: HELP_META,
    tool: 'help',
    nav: 'help',
    viewClass: 'view view-help help',
    boot: 'keep',
    styles: ['src/tools/help/help.ts'],
    preload: ['src/tools/help/help.ts'],
    body: (year) => [helpPage(), footer(year)],
    content: () => helpPage(),
    preconnect: false,
    og: { type: 'website', image: SCREENSHOTS.home },
    jsonld: () =>
      graph([
        organization(),
        website(),
        webPage(HELP_META, { breadcrumb: true }),
        breadcrumbList(HELP_META, crumbsFor({ label: HELP_META.label })),
        faqPage(HELP_META, HELP_FAQ),
        ...HELP_SECTIONS.filter((s) => s.howto).map((s) => howTo(HELP_META, s.id, s.howto!.name, s.howto!.steps)),
      ]),
  };
}

function guidesIndexEntry(): PrerenderPage {
  const url = absoluteUrl(GUIDES_META.path);
  return {
    meta: GUIDES_META,
    tool: 'help',
    nav: 'help',
    viewClass: 'view view-help guides',
    boot: 'keep',
    styles: ['src/tools/guides/guides.ts'],
    preload: ['src/tools/guides/guides.ts'],
    body: (year) => [guidesIndexPage(), footer(year)],
    content: () => [guidesIndexPage()],
    preconnect: false,
    og: { type: 'website', image: SCREENSHOTS.home },
    jsonld: () =>
      graph([
        organization(),
        website(),
        { ...webPage(GUIDES_META, { type: 'CollectionPage', breadcrumb: true }), mainEntity: { '@id': `${url}#list` } },
        breadcrumbList(GUIDES_META, crumbsFor({ label: GUIDES_META.label })),
        itemList(
          `${url}#list`,
          GUIDES.map((g) => ({ name: g.h1, url: absoluteUrl(g.path) })),
        ),
      ]),
  };
}

function guideEntry(slug: string): PrerenderPage {
  const g = GUIDE_CONTENT.find((x) => x.meta.slug === slug)!;
  const meta = g.meta;
  return {
    meta,
    tool: 'help',
    nav: 'help',
    viewClass: 'view view-help guides',
    boot: 'keep',
    styles: ['src/tools/guides/guides.ts'],
    preload: ['src/tools/guides/guides.ts'],
    body: (year) => [guidePage(g), footer(year)],
    content: () => [guidePage(g)],
    preconnect: false,
    og: { type: 'article', image: SCREENSHOTS.home },
    jsonld: () =>
      graph([
        organization(),
        website(),
        webPage(meta, { breadcrumb: true }),
        breadcrumbList(meta, crumbsFor({ label: GUIDES_META.label, to: GUIDES_META.path }, { label: meta.label })),
        techArticle(meta),
        ...(g.howto ? [howTo(meta, 'steps', g.howto.name, g.howto.steps)] : []),
        ...(g.faq?.length ? [faqPage(meta, g.faq)] : []),
      ]),
  };
}

/** All prerendered pages, in sitemap order. */
export function prerenderPages(): PrerenderPage[] {
  return [homeEntry(), toolEntry('textures'), toolEntry('skins'), toolEntry('shaders'), helpEntry(), guidesIndexEntry(), ...GUIDES.map((g) => guideEntry(g.slug))];
}
