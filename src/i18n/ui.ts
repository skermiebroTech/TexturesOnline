// Short interface texts of the public pages (top bar, footer, breadcrumbs, shared headings and the
// fallback views) in every language. Small enough to ship with the app shell; the long page content
// is loaded per language (src/i18n/content.ts).

import { OG_IMAGE, SITE_NAME } from '../app/site';
import type { Locale } from './locales';
import { UI_DE } from './de/ui';
import { UI_ES } from './es/ui';
import { UI_PT_BR } from './pt-br/ui';
import { UI_JA } from './ja/ui';

export interface UiText {
  nav: { home: string; textures: string; convert: string; skins: string; shaders: string; help: string };
  /** aria-label of the main navigation */
  mainNav: string;
  skipLink: string;
  brandHome: string;
  githubLabel: string;
  githubTooltip: string;
  themeToLight: string;
  themeToDark: string;
  openMenu: string;
  closeMenu: string;
  menu: string;
  notAffiliatedShort: string;
  footer: {
    label: string;
    tagline: string;
    make: string;
    guides: string;
    learn: string;
    textures: string;
    converter: string;
    merge: string;
    skins: string;
    skinpack: string;
    totem: string;
    shaders: string;
    allGuides: string;
    /** Link to the page listing every tool, feature and guide */
    everything: string;
    installGuide: string;
    faq: string;
    about: string;
    notOfficial: string;
    licence: string;
    uiFont: string;
  };
  /** Heading / aria-label of the language switcher */
  language: string;
  breadcrumb: string;
  home: string;
  guides: string;
  onThisPage: string;
  questions: string;
  relatedGuides: string;
  /** Eyebrow above a guide's title */
  guide: string;
  updated: string;
  /** '2026-10-12' -> '12 October 2026' */
  date(iso: string): string;
  /** aria-label of platform tabs */
  platform: string;
  folderTable: { system: string; folder: string };
  toolIntro: { whatYouCanDo: string; questions: string; guides: string; noscript: string };
  /** Shown on translated pages that link to guides only available in English */
  englishOnly: string;
  loading: string;
  notFound: { title: string; text(path: string): string; goHome: string; help: string; pageTitle: string };
  loadError: { title: string; offline: string; newVersion: string; generic: string; reload: string; details: string; pageTitle: string };
  recent: { eyebrow: string; title: string; note: string; showAll(n: number): string; showFewer: string; open: string; rename: string; delete: string };
  /** Alt text of the site's default link-preview image (the home page) */
  ogImageAlt: string;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const UI_EN: UiText = {
  nav: { home: 'Home', textures: 'Textures', convert: 'Convert', skins: 'Skins', shaders: 'Shaders', help: 'Help' },
  mainNav: 'Main',
  skipLink: 'Skip to content',
  brandHome: `${SITE_NAME} home`,
  githubLabel: `${SITE_NAME} on GitHub`,
  githubTooltip: 'Source code on GitHub',
  themeToLight: 'Switch to light theme',
  themeToDark: 'Switch to dark theme',
  openMenu: 'Open menu',
  closeMenu: 'Close menu',
  menu: 'Menu',
  notAffiliatedShort: 'Not affiliated with Mojang or Microsoft',
  footer: {
    label: 'Footer',
    tagline: 'Free, open-source tools for Minecraft creators. Everything runs in your browser.',
    make: 'Make',
    guides: 'Guides',
    learn: 'Learn',
    textures: 'Texture pack editor',
    converter: 'Pack converter',
    merge: 'Merge packs',
    skins: 'Skin editor',
    skinpack: 'Skin pack maker',
    totem: 'Totem maker',
    shaders: 'Shader maker',
    allGuides: 'All guides',
    everything: 'Everything on the site',
    installGuide: 'Install guide',
    faq: 'FAQ',
    about: 'About',
    notOfficial: 'Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.',
    licence: 'MIT licence',
    uiFont: 'UI font: Texel',
  },
  language: 'Language',
  breadcrumb: 'Breadcrumb',
  home: 'Home',
  guides: 'Guides',
  onThisPage: 'On this page',
  questions: 'Questions',
  relatedGuides: 'Related guides',
  guide: 'Guide',
  updated: 'Updated',
  date: (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return `${d} ${MONTHS[m - 1]} ${y}`;
  },
  platform: 'Platform',
  folderTable: { system: 'System', folder: 'Folder' },
  toolIntro: {
    whatYouCanDo: 'What you can do',
    questions: 'Questions',
    guides: 'Guides',
    noscript: 'The editor needs JavaScript. Turn it on to start making; the guides on this page work without it.',
  },
  englishOnly: 'More guides in English',
  loading: 'Loading…',
  notFound: {
    title: 'This page wandered off',
    text: (path) => `There's nothing at "${path}". It may have been moved, or the link is mistyped.`,
    goHome: 'Go home',
    help: 'Help',
    pageTitle: `Page not found — ${SITE_NAME}`,
  },
  loadError: {
    title: "This page couldn't be opened",
    offline: "You're offline and this part of the app hasn't been saved on this device yet. Reconnect and try again.",
    newVersion: `A newer version of ${SITE_NAME} may have been published. Reloading the page usually fixes this.`,
    generic: 'Something went wrong while opening this page. Your projects are safe — try reloading.',
    reload: 'Reload',
    details: 'Technical details',
    pageTitle: `Something went wrong — ${SITE_NAME}`,
  },
  recent: {
    eyebrow: 'Your projects',
    title: 'Continue where you left off',
    note: 'Projects are saved in this browser only. Export them to keep a copy.',
    showAll: (n) => (n ? `Show all ${n}` : 'Show all'),
    showFewer: 'Show fewer',
    open: 'Open',
    rename: 'Rename',
    delete: 'Delete',
  },
  ogImageAlt: OG_IMAGE.alt,
};

const UI: Record<Locale, UiText> = { en: UI_EN, de: UI_DE, es: UI_ES, 'pt-br': UI_PT_BR, ja: UI_JA };

/** Interface texts for a language. */
export function ui(locale: Locale): UiText {
  return UI[locale];
}
