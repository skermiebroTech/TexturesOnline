// Top bar, brand and footer as markup trees, shared by the runtime shell and the prerendered pages.

import type { IconName } from '../../ui/icons';
import { el, ic, logo, type ElNode } from '../markup';
import { GUIDES } from '../seo/meta';
import { REPO_URL, SITE_NAME } from '../site';

export type NavTool = 'home' | 'textures' | 'skins' | 'shaders' | 'help';

export interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  tool: NavTool;
  accent: string;
}

export const NAV: NavItem[] = [
  { path: '/', label: 'Home', icon: 'home', tool: 'home', accent: 'accent-green' },
  { path: '/textures', label: 'Textures', icon: 'image', tool: 'textures', accent: 'accent-green' },
  { path: '/skins', label: 'Skins', icon: 'human', tool: 'skins', accent: 'accent-blue' },
  { path: '/shaders', label: 'Shaders', icon: 'sparkles', tool: 'shaders', accent: 'accent-purple' },
  { path: '/help', label: 'Help', icon: 'circle-question', tool: 'help', accent: 'accent-gold' },
];

/** Two-tone wordmark: "TexturePack" + accent "Maker". */
export function wordmark(hidden = false): ElNode {
  return el('span', { class: 'wordmark', 'aria-hidden': hidden ? 'true' : null }, 'TexturePack', el('span', null, 'Maker'));
}

export function brandLink(opts: { label?: boolean } = {}): ElNode {
  return el('a', { class: 'brand', to: '/', 'aria-label': opts.label ? `${SITE_NAME} home` : null }, logo(32), wordmark(opts.label));
}

export function navLinks(cls: string, active: NavTool | null): ElNode[] {
  return NAV.map((item) =>
    el(
      'a',
      { class: [cls, item.accent], to: item.path, 'data-tool': item.tool, 'aria-current': item.tool === active ? 'page' : null },
      ic(item.icon),
      el('span', null, item.label),
    ),
  );
}

export function githubLink(): ElNode {
  return el('a', { class: 'icon-btn', href: REPO_URL, target: '_blank', rel: 'noopener noreferrer', 'aria-label': `${SITE_NAME} on GitHub` }, ic('github'));
}

export function topbar(active: NavTool | null): ElNode {
  return el(
    'header',
    { class: 'topbar' },
    el(
      'div',
      { class: 'topbar-inner' },
      brandLink({ label: true }),
      el('nav', { class: 'mainnav', 'aria-label': 'Main' }, navLinks('nav-link', active)),
      el(
        'div',
        { class: 'topbar-actions' },
        el('button', { type: 'button', class: 'icon-btn theme-toggle', 'aria-label': 'Switch to light theme' }, ic('moon')),
        githubLink(),
        el('button', { type: 'button', class: 'icon-btn menu-btn', 'aria-label': 'Open menu', 'aria-haspopup': 'dialog' }, ic('menu')),
      ),
    ),
  );
}

export function skipLink(): ElNode {
  return el('a', { class: 'skip-link', href: '#main' }, 'Skip to content');
}

/** Guides shown in the footer (the most useful few). */
const FOOTER_GUIDES = ['make-a-texture-pack', 'install-resource-packs', 'minecraft-pack-format-versions', 'make-a-skin', 'make-shaders-without-mods'];

export function footer(year: number): ElNode {
  const guides = FOOTER_GUIDES.map((slug) => GUIDES.find((g) => g.slug === slug)).filter((g) => !!g);
  return el(
    'footer',
    { class: 'site-footer' },
    el(
      'div',
      { class: 'container footer-inner' },
      el(
        'div',
        { class: 'footer-brand' },
        el('a', { class: 'brand', to: '/' }, logo(32), wordmark()),
        el('p', { class: 'muted' }, 'Free, open-source tools for Minecraft creators. Everything runs in your browser.'),
      ),
      el(
        'nav',
        { class: 'footer-links', 'aria-label': 'Footer' },
        el(
          'div',
          { class: 'footer-col' },
          el('div', { class: 'section-title' }, 'Make'),
          el('a', { to: '/textures' }, 'Texture packs'),
          el('a', { to: '/skins' }, 'Skins'),
          el('a', { to: '/shaders' }, 'Shaders'),
        ),
        el(
          'div',
          { class: 'footer-col' },
          el('div', { class: 'section-title' }, 'Guides'),
          guides.map((g) => el('a', { to: g.path }, g.label)),
          el('a', { to: '/guides' }, 'All guides'),
        ),
        el(
          'div',
          { class: 'footer-col' },
          el('div', { class: 'section-title' }, 'Learn'),
          el('a', { to: '/help' }, 'Install guide'),
          el('a', { to: '/help?s=faq' }, 'FAQ'),
          el('a', { href: REPO_URL, target: '_blank', rel: 'noopener noreferrer' }, 'GitHub ', ic('external-link', { class: 'ext' })),
        ),
      ),
    ),
    el(
      'div',
      { class: 'container footer-legal' },
      el('p', null, 'Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.'),
      el('p', null, `© ${year} ${SITE_NAME} · MIT licence · UI font: Texel (`, el('a', { to: '/fonts/OFL.txt', target: '_blank', rel: 'noopener' }, 'SIL OFL 1.1'), ')'),
    ),
  );
}
