// Titles and descriptions of every public (indexable) page, in English and in every language a page
// has been translated into. Kept free of DOM and content imports so the router, the runtime head
// updater and the build-time prerender can all share it.

import { SITE_NAME } from '../site';
import { DEFAULT_LOCALE, LOCALES, TRANSLATED_LOCALES, prefixPath, splitLocale, type Locale, type TranslatedLocale } from '../../i18n/locales';
import { META_DE } from '../../i18n/de/meta';
import { META_ES } from '../../i18n/es/meta';
import { META_PT_BR } from '../../i18n/pt-br/meta';
import { META_JA } from '../../i18n/ja/meta';

export type PageKind = 'home' | 'tool' | 'help' | 'about' | 'guides' | 'guide';
export type PageTool = 'home' | 'textures' | 'convert' | 'merge' | 'skins' | 'shaders' | 'help';

export interface PageMeta {
  /** Page path without trailing slash, including the language folder ('/', '/textures', '/de/guides/make-a-skin') */
  path: string;
  /** Language of the page (English when left out) */
  locale?: Locale;
  /** Route path without the language folder ('/de/textures' -> '/textures'); same as path when left out */
  route?: string;
  kind: PageKind;
  /** Nav section the page belongs to (sets the accent colour and active link) */
  tool: PageTool;
  /** <title>, at most 60 characters */
  title: string;
  /** Meta description, at most 155 characters */
  description: string;
  /** Short name for breadcrumbs and link lists */
  label: string;
}

export interface GuideMeta extends PageMeta {
  kind: 'guide';
  slug: string;
  /** Page heading */
  h1: string;
  /** One short line for guide cards */
  blurb: string;
  /** Icon name for guide cards (pixelarticons) */
  icon: string;
  accent: 'accent-green' | 'accent-blue' | 'accent-purple' | 'accent-gold';
}

export const HOME_META: PageMeta = {
  path: '/',
  kind: 'home',
  tool: 'home',
  title: 'Minecraft Texture Pack Maker & Creator: Free, Java & Bedrock',
  description:
    'Make a Minecraft texture pack in minutes: repaint blocks on real 3D models, apply one-click styles, export a .zip or .mcpack. Free, no sign-up, Java 26.3.',
  label: 'Home',
};

export const TOOL_META: Record<'textures' | 'converter' | 'merge' | 'skins' | 'skinpack' | 'shaders', PageMeta> = {
  textures: {
    path: '/textures',
    kind: 'tool',
    tool: 'textures',
    title: 'Texture Pack Editor & Resource Pack Creator (Java, Bedrock)',
    description:
      'Edit any Minecraft texture: repaint blocks, items and mobs on real 3D models, upload PNGs or restyle the game in one click, then export a .zip or .mcpack.',
    label: 'Texture packs',
  },
  converter: {
    path: '/texture-pack-converter',
    kind: 'tool',
    tool: 'convert',
    title: 'Minecraft Texture Pack Converter — Java to Bedrock & Back',
    description:
      'Convert a Minecraft texture pack from Java to Bedrock, Bedrock to Java or between Java versions, or turn PNGs into an .mcpack. Free, in your browser.',
    label: 'Texture pack converter',
  },
  merge: {
    path: '/merge-texture-packs',
    kind: 'tool',
    tool: 'merge',
    title: 'Merge Minecraft Texture Packs Online — Java & Bedrock',
    description:
      'Combine several Minecraft texture packs into one .zip or .mcpack. Put them in order and the top pack wins, as in the game. Free, in your browser.',
    label: 'Merge texture packs',
  },
  skins: {
    path: '/skins',
    kind: 'tool',
    tool: 'skins',
    title: 'Minecraft Skin Editor & Custom Skin Pack Maker',
    description:
      'Paint a custom Minecraft skin in 2D or 3D, classic or slim arms, then export a Java PNG or bundle your skins into a Bedrock skin pack (.mcpack). Free.',
    label: 'Skins',
  },
  skinpack: {
    path: '/skin-pack-maker',
    kind: 'tool',
    tool: 'skins',
    title: 'Minecraft Skin Pack Maker — Free Bedrock .mcpack Creator',
    description:
      'Make a custom Minecraft skin pack online: paint or upload skins, mix classic and slim arms, and download one Bedrock .mcpack that opens in the game. Free.',
    label: 'Skin pack maker',
  },
  shaders: {
    path: '/shaders',
    kind: 'tool',
    tool: 'shaders',
    title: 'Minecraft Shader Maker — Iris, OptiFine & No-Mod Shaders',
    description:
      'Build Iris or OptiFine shader packs, no-mod vanilla shaders for Java, or Bedrock Vibrant Visuals packs, with presets, sliders and a live 3D preview.',
    label: 'Shaders',
  },
};

export const HELP_META: PageMeta = {
  path: '/help',
  kind: 'help',
  tool: 'help',
  title: 'How to Install Texture Packs, Skins & Shaders in Minecraft',
  description:
    'Add a texture pack, skin or shader in Minecraft Java and Bedrock on PC, Mac, phone and console, find the resourcepacks folder and fix common errors.',
  label: 'Help',
};

export const ABOUT_META: PageMeta = {
  path: '/about',
  kind: 'about',
  tool: 'help',
  title: 'About Texture Pack Maker — Free, Open-Source Minecraft Tools',
  description:
    'Who makes Texture Pack Maker, what sets it apart (every Java version since 1.6.1, Bedrock, a converter, open source) and how it keeps your work private.',
  label: 'About',
};

export const GUIDES_META: PageMeta = {
  path: '/guides',
  kind: 'guides',
  tool: 'help',
  title: `Minecraft Pack, Skin & Shader Guides — ${SITE_NAME}`,
  description:
    'Step-by-step guides to making and installing Minecraft texture packs, skins and shaders, plus every Java resource pack format from 1.6.1 to 26.3.',
  label: 'Guides',
};

const guide = (g: Omit<GuideMeta, 'kind' | 'tool' | 'path'>): GuideMeta => ({ ...g, kind: 'guide', tool: 'help', path: `/guides/${g.slug}` });

export const GUIDES: GuideMeta[] = [
  guide({
    slug: 'make-a-texture-pack',
    blurb: 'Pick a version, repaint textures and export a pack Minecraft loads.',
    title: 'How to Make a Minecraft Texture Pack (Java & Bedrock)',
    h1: 'How to make a Minecraft texture pack',
    description:
      'Make your own Minecraft texture pack for free: pick a version, repaint textures, export a .zip with pack.mcmeta (Java) or .mcpack (Bedrock), then install.',
    label: 'Make a texture pack',
    icon: 'image',
    accent: 'accent-green',
  }),
  guide({
    slug: 'install-resource-packs',
    blurb: 'Java resource packs, Bedrock .mcpack files and shader packs, plus fixes.',
    title: 'How to Install a Minecraft Texture Pack (Java & Bedrock)',
    h1: 'How to install Minecraft texture packs, shaders and .mcpack files',
    description:
      'Install a resource pack on Java, import a Bedrock .mcpack on PC or phone, add a shader pack with Iris or OptiFine, and fix packs that do not show up.',
    label: 'Install packs and shaders',
    icon: 'download',
    accent: 'accent-green',
  }),
  guide({
    slug: 'texture-pack-not-working',
    blurb: 'Missing packs, version warnings, purple-and-black blocks and other fixes.',
    title: 'Minecraft Texture Pack Not Working? Fixes for Java & Bedrock',
    h1: 'Minecraft texture pack not working? How to fix it',
    description:
      'Pack not in the list, “made for an older version”, purple and black blocks, grey grass, failed .mcpack imports: what each problem means and how to fix it.',
    label: 'Pack not working? Fixes',
    icon: 'warning-diamond',
    accent: 'accent-gold',
  }),
  guide({
    slug: 'minecraft-pack-format-versions',
    blurb: 'The pack format of every Java release from 1.6.1 to 26.3.',
    title: 'Minecraft Pack Format 26.3 (97.1) and Every Java Version',
    h1: 'Minecraft pack format for every Java version (26.3 uses 97.1)',
    description:
      'Every Minecraft Java release from 1.6.1 to 26.3 and its resource pack format (26.3 uses 97.1), plus how pack.mcmeta has changed over the years.',
    label: 'Pack format versions',
    icon: 'bulletlist',
    accent: 'accent-gold',
  }),
  guide({
    slug: 'make-a-skin',
    blurb: 'Paint the 64×64 template and use it on Java or in a Bedrock skin pack.',
    title: 'How to Make a Custom Minecraft Skin (Java & Bedrock)',
    h1: 'How to make a custom Minecraft skin',
    description:
      'Make a Minecraft skin free online: paint the 64×64 template in 2D or 3D, pick classic or slim arms, then upload it on Java or import a Bedrock skin pack.',
    label: 'Make a skin',
    icon: 'human',
    accent: 'accent-blue',
  }),
  guide({
    slug: 'make-shaders-without-mods',
    blurb: 'What vanilla Java shader packs and Bedrock Vibrant Visuals can do.',
    title: 'Minecraft Shaders Without Mods or OptiFine (Java & Bedrock)',
    h1: 'Can you get Minecraft shaders without mods?',
    description:
      'Yes: Java 1.17+ resource packs can replace the game’s own shaders (no OptiFine or Iris) and Bedrock has Vibrant Visuals. What works, the limits, and how.',
    label: 'Shaders without mods',
    icon: 'sun',
    accent: 'accent-purple',
  }),
  guide({
    slug: 'bedrock-vibrant-visuals-settings',
    blurb: 'Sun, sky, fog, water and colour settings, and supported devices.',
    title: 'Minecraft Bedrock Vibrant Visuals Settings Explained',
    h1: 'Bedrock Vibrant Visuals settings explained',
    description:
      'What a Vibrant Visuals pack can change in Minecraft Bedrock (sun, sky, fog, water, shadows and colour grading), supported devices and how to turn it on.',
    label: 'Vibrant Visuals settings',
    icon: 'cloud-sun',
    accent: 'accent-purple',
  }),
  guide({
    slug: 'java-vs-bedrock-packs',
    blurb: 'Files, folders, formats, shaders and skins compared side by side.',
    title: 'Java vs Bedrock Texture Packs: Differences & Compatibility',
    h1: 'Java vs Bedrock texture packs: differences and how to convert',
    description:
      'Do Java texture packs work on Bedrock? No: Java uses .zip + pack.mcmeta, Bedrock .mcpack + manifest.json. Folders, file names, shaders and skins compared.',
    label: 'Java vs Bedrock packs',
    icon: 'gamepad',
    accent: 'accent-blue',
  }),
];

/** Every page that is prerendered, listed in the sitemap and open to search engines. */
export const PUBLIC_PAGES: PageMeta[] = [HOME_META, TOOL_META.textures, TOOL_META.converter, TOOL_META.merge, TOOL_META.skins, TOOL_META.skinpack, TOOL_META.shaders, HELP_META, ABOUT_META, GUIDES_META, ...GUIDES];

// ---------------------------------------------------------------- translations

/** Translated title, description and short name of one page. */
export interface PageText {
  title: string;
  description: string;
  label: string;
}

export interface GuidePageText extends PageText {
  h1: string;
  blurb: string;
}

/**
 * One language's page texts. A page counts as translated (and gets its own URL, hreflang links and
 * sitemap entry) once it has an entry here and its content in src/i18n/<lang>/content.ts.
 */
export interface MetaTranslation {
  /** By English route path: '/', '/textures', '/help', '/guides'... */
  pages: Partial<Record<string, PageText>>;
  /** By guide slug */
  guides: Partial<Record<string, GuidePageText>>;
}

export const META_TRANSLATIONS: Record<TranslatedLocale, MetaTranslation> = { de: META_DE, es: META_ES, 'pt-br': META_PT_BR, ja: META_JA };

const trimSlash = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : p);

/** Language of a page (English when not set). */
export const metaLocale = (m: PageMeta): Locale => m.locale ?? DEFAULT_LOCALE;
/** Route path of a page without its language folder. */
export const metaRoute = (m: PageMeta): string => m.route ?? m.path;

/** English meta of a public route path ('/help'), or undefined. */
function englishMeta(route: string): PageMeta | undefined {
  const p = trimSlash(route);
  return PUBLIC_PAGES.find((m) => m.path === p);
}

/** Meta of a public page in one language ('/textures', 'de'); undefined when it is not public or not translated. */
export function pageMeta(route: string, locale: Locale): PageMeta | undefined {
  const en = englishMeta(route);
  if (!en || locale === 'en') return en;
  const t = META_TRANSLATIONS[locale];
  const text = en.kind === 'guide' ? t.guides[(en as GuideMeta).slug] : t.pages[en.path];
  if (!text) return undefined;
  return { ...en, ...text, locale, route: en.path, path: prefixPath(en.path, locale) };
}

/** A guide's meta in one language, or undefined when it is not translated. */
export function guideMeta(slug: string, locale: Locale): GuideMeta | undefined {
  const en = GUIDES.find((g) => g.slug === slug);
  return en ? (pageMeta(en.path, locale) as GuideMeta | undefined) : undefined;
}

/** The guides available in a language, in the English order. */
export function guidesIn(locale: Locale): GuideMeta[] {
  return GUIDES.map((g) => guideMeta(g.slug, locale)).filter((g): g is GuideMeta => !!g);
}

/** Every language a public route path is available in (English first). */
export function pageLocales(route: string): Locale[] {
  return LOCALES.filter((l) => !!pageMeta(route, l));
}

/** Translated pages of one language, in sitemap order. */
export function translatedPages(locale: TranslatedLocale): PageMeta[] {
  return PUBLIC_PAGES.map((m) => pageMeta(m.path, locale)).filter((m): m is PageMeta => !!m);
}

/** Every public page in every language: English first, then each translation. */
export function allPublicPages(): PageMeta[] {
  return [...PUBLIC_PAGES, ...TRANSLATED_LOCALES.flatMap(translatedPages)];
}

/**
 * Route path in a language's folder when that page exists there ('/help?s=faq', 'de' ->
 * '/de/help?s=faq'). Public pages without a translation stay English; app pages (projects, the UI
 * kit) always follow the language. Paths that already name a language folder are kept.
 */
export function localizedPath(path: string, locale: Locale): string {
  const m = /^([^?#]*)(.*)$/.exec(path)!;
  const route = m[1] || '/';
  if (locale === DEFAULT_LOCALE || splitLocale(route).locale !== DEFAULT_LOCALE) return path;
  if (/\.[a-z0-9]{1,8}$/i.test(route)) return path; // site files
  if (englishMeta(route) && !pageMeta(route, locale)) return path;
  return prefixPath(path, locale);
}

/** Meta for a page path in any language ('/help', '/help/', '/de/help'), or undefined for private and unknown paths. */
export function publicPageMeta(path: string): PageMeta | undefined {
  const { locale, path: route } = splitLocale(trimSlash(path));
  return pageMeta(route, locale);
}
