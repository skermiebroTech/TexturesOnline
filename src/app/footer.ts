// Site footer shared by the home, help and fallback pages.

import { h } from '../ui/dom';
import { icon } from '../ui/icons';
import { logoMark } from '../ui/logo';
import { GITHUB_URL } from './shell';

export function siteFooter(): HTMLElement {
  const year = new Date().getFullYear();
  return h(
    'footer',
    { class: 'site-footer' },
    h(
      'div',
      { class: 'container footer-inner' },
      h(
        'div',
        { class: 'footer-brand' },
        h('a', { class: 'brand', href: '#/' }, logoMark(32), h('span', { class: 'wordmark' }, 'Textures', h('span', null, 'Online'))),
        h('p', { class: 'muted' }, 'Free, open-source tools for Minecraft creators. Everything runs in your browser.'),
      ),
      h(
        'nav',
        { class: 'footer-links', 'aria-label': 'Footer' },
        h('div', { class: 'footer-col' }, h('div', { class: 'section-title' }, 'Make'), h('a', { href: '#/textures' }, 'Texture packs'), h('a', { href: '#/skins' }, 'Skins'), h('a', { href: '#/shaders' }, 'Shaders')),
        h(
          'div',
          { class: 'footer-col' },
          h('div', { class: 'section-title' }, 'Learn'),
          h('a', { href: '#/help' }, 'Install guide'),
          h('a', { href: '#/help?s=faq' }, 'FAQ'),
          h('a', { href: GITHUB_URL, target: '_blank', rel: 'noopener noreferrer' }, 'GitHub ', icon('external-link', { class: 'ext' })),
        ),
      ),
    ),
    h(
      'div',
      { class: 'container footer-legal' },
      h('p', null, 'Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.'),
      h('p', null, `© ${year} TexturesOnline · MIT licence · UI font: Texel (`, h('a', { href: 'fonts/OFL.txt', target: '_blank', rel: 'noopener' }, 'SIL OFL 1.1'), ')'),
    ),
  );
}
