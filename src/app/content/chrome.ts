// Top bar, brand, footer and language switcher as markup trees, shared by the runtime shell and the
// prerendered pages. Texts come from src/i18n/ui.ts; internal links are written as English route
// paths and lead to the page in the reader's language when it exists there.

import type { IconName } from '../../ui/icons';
import { el, ic, logo, type ElNode } from '../markup';
import { guideMeta, localizedPath, pageMeta, publicPageMeta } from '../seo/meta';
import { REPO_URL, SITE_NAME } from '../site';
import { LOCALES, LOCALE_INFO, prefixPath, type Locale } from '../../i18n/locales';
import { ui, type UiText } from '../../i18n/ui';
import { appText } from '../../pwa/text';

/** 'merge' and 'totem' have no menu item of their own (the menu is full); their pages highlight none. */
export type NavTool = 'home' | 'textures' | 'convert' | 'merge' | 'totem' | 'skins' | 'shaders' | 'help';

export interface NavItem {
  path: string;
  key: keyof UiText['nav'];
  icon: IconName;
  tool: NavTool;
  accent: string;
}

export const NAV: NavItem[] = [
  { path: '/', key: 'home', icon: 'home', tool: 'home', accent: 'accent-green' },
  { path: '/textures', key: 'textures', icon: 'image', tool: 'textures', accent: 'accent-green' },
  { path: '/texture-pack-converter', key: 'convert', icon: 'repeat', tool: 'convert', accent: 'accent-green' },
  { path: '/skins', key: 'skins', icon: 'human', tool: 'skins', accent: 'accent-blue' },
  { path: '/shaders', key: 'shaders', icon: 'sparkles', tool: 'shaders', accent: 'accent-purple' },
  { path: '/help', key: 'help', icon: 'circle-question', tool: 'help', accent: 'accent-gold' },
];

/** Two-tone wordmark: "TexturePack" + accent "Maker". */
export function wordmark(hidden = false): ElNode {
  return el('span', { class: 'wordmark', 'aria-hidden': hidden ? 'true' : null }, 'TexturePack', el('span', null, 'Maker'));
}

export function brandLink(opts: { label?: boolean; locale?: Locale } = {}): ElNode {
  // The spoken name is in hidden text rather than an aria-label: a label that does not contain the
  // visible wordmark ("TexturePackMaker") fails the label-in-name check.
  return el('a', { class: 'brand', to: '/' }, logo(32), wordmark(opts.label), opts.label ? el('span', { class: 'sr-only' }, ui(opts.locale ?? 'en').brandHome) : null);
}

export function navLinks(cls: string, active: NavTool | null, locale: Locale = 'en'): ElNode[] {
  const t = ui(locale).nav;
  return NAV.map((item) =>
    el(
      'a',
      { class: [cls, item.accent], to: item.path, 'data-tool': item.tool, 'aria-current': item.tool === active ? 'page' : null },
      ic(item.icon),
      el('span', null, t[item.key]),
    ),
  );
}

export function githubLink(locale: Locale = 'en'): ElNode {
  return el('a', { class: 'icon-btn', href: REPO_URL, target: '_blank', rel: 'noopener noreferrer', 'aria-label': ui(locale).githubLabel }, ic('github'));
}

export function topbar(active: NavTool | null, locale: Locale = 'en'): ElNode {
  const t = ui(locale);
  return el(
    'header',
    { class: 'topbar' },
    el(
      'div',
      { class: 'topbar-inner' },
      brandLink({ label: true, locale }),
      el('nav', { class: 'mainnav', 'aria-label': t.mainNav }, navLinks('nav-link', active, locale)),
      el(
        'div',
        { class: 'topbar-actions' },
        el('button', { type: 'button', class: 'icon-btn theme-toggle', 'aria-label': t.themeToLight }, ic('moon')),
        githubLink(locale),
        el('button', { type: 'button', class: 'icon-btn menu-btn', 'aria-label': t.openMenu, 'aria-haspopup': 'dialog' }, ic('menu')),
      ),
    ),
  );
}

export function skipLink(locale: Locale = 'en'): ElNode {
  return el('a', { class: 'skip-link', href: '#main' }, ui(locale).skipLink);
}

/**
 * Where each language's link in the switcher goes from a route path: the same page in that
 * language, or that language's home page when the page has not been translated into it.
 * Languages without a home page yet are not offered.
 */
export function languageTargets(route: string): { locale: Locale; path: string }[] {
  const isPublic = !!publicPageMeta(route);
  return LOCALES.filter((l) => !!pageMeta('/', l)).map((l) => ({ locale: l, path: isPublic ? (pageMeta(route, l)?.path ?? prefixPath('/', l)) : localizedPath(route, l) }));
}

/** Links to the current page in every language (the current one marked); null while there is only English. */
export function languageSwitcher(route: string, current: Locale, cls = 'lang-switch'): ElNode | null {
  const targets = languageTargets(route);
  if (targets.length < 2) return null;
  return el(
    'nav',
    { class: cls, 'aria-label': ui(current).language, 'data-md': 'skip' },
    ic('globe'),
    el(
      'ul',
      null,
      targets.map(({ locale, path }) =>
        el(
          'li',
          null,
          el('a', { to: path, hreflang: LOCALE_INFO[locale].lang, lang: LOCALE_INFO[locale].lang, 'aria-current': locale === current ? 'true' : null }, LOCALE_INFO[locale].name),
        ),
      ),
    ),
  );
}

/** Guides shown in the footer (the most useful few). */
const FOOTER_GUIDES = ['make-a-texture-pack', 'install-resource-packs', 'minecraft-pack-format-versions', 'convert-java-to-bedrock-texture-pack', 'make-a-skin', 'make-shaders-without-mods'];

/** Site footer; `route` is the current page's route path (the language switcher links its translations). */
export function footer(year: number, locale: Locale = 'en', route = '/'): ElNode {
  const t = ui(locale);
  const f = t.footer;
  const guides = FOOTER_GUIDES.map((slug) => guideMeta(slug, locale)).filter((g) => !!g);
  return el(
    'footer',
    { class: 'site-footer' },
    el(
      'div',
      { class: 'container footer-inner' },
      el('div', { class: 'footer-brand' }, el('a', { class: 'brand', to: '/' }, logo(32), wordmark()), el('p', { class: 'muted' }, f.tagline)),
      el(
        'nav',
        { class: 'footer-links', 'aria-label': f.label },
        el(
          'div',
          { class: 'footer-col' },
          el('div', { class: 'section-title' }, f.make),
          el('a', { to: '/textures' }, f.textures),
          el('a', { to: '/texture-pack-converter' }, f.converter),
          el('a', { to: '/merge-texture-packs' }, f.merge),
          el('a', { to: '/skins' }, f.skins),
          el('a', { to: '/skin-pack-maker' }, f.skinpack),
          el('a', { to: '/totem-maker' }, f.totem),
          el('a', { to: '/shaders' }, f.shaders),
        ),
        el(
          'div',
          { class: 'footer-col' },
          el('div', { class: 'section-title' }, f.guides),
          guides.map((g) => el('a', { to: g.route ?? g.path }, g.label)),
          el('a', { to: '/guides' }, f.allGuides),
        ),
        el(
          'div',
          { class: 'footer-col' },
          el('div', { class: 'section-title' }, f.learn),
          el('a', { to: '/help' }, f.installGuide),
          el('a', { to: '/help?s=faq' }, f.faq),
          el('a', { to: '/about' }, f.about),
          el('a', { to: '/privacy' }, appText(locale).privacy),
          el('a', { href: REPO_URL, target: '_blank', rel: 'noopener noreferrer' }, 'GitHub ', ic('external-link', { class: 'ext' })),
        ),
      ),
    ),
    languageTargets(route).length > 1 ? el('div', { class: 'container footer-langs' }, languageSwitcher(route, locale)) : null,
    el(
      'div',
      { class: 'container footer-legal' },
      el('p', null, f.notOfficial),
      el('p', null, `© ${year} ${SITE_NAME} · ${f.licence} · ${f.uiFont} (`, el('a', { to: '/fonts/OFL.txt', target: '_blank', rel: 'noopener' }, 'SIL OFL 1.1'), ')'),
    ),
  );
}
