// App shell: sticky top bar (logo, main nav, theme toggle, GitHub), mobile menu drawer and
// the page outlet the router renders into.

import { onRouteChange, type RouteState, type ToolId } from '../core/router';
import { h } from '../ui/dom';
import { icon, setIcon, type IconName } from '../ui/icons';
import { logoMark } from '../ui/logo';
import { tooltip } from '../ui/tooltip';
import { getTheme, onThemeChange, toggleTheme } from '../ui/theme';

export const GITHUB_URL = 'https://github.com/skermiebroTech/TexturesOnline';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  tool: ToolId;
  accent: string;
}

export const NAV: NavItem[] = [
  { path: '/', label: 'Home', icon: 'home', tool: 'home', accent: 'accent-green' },
  { path: '/textures', label: 'Textures', icon: 'image', tool: 'textures', accent: 'accent-green' },
  { path: '/skins', label: 'Skins', icon: 'human', tool: 'skins', accent: 'accent-blue' },
  { path: '/shaders', label: 'Shaders', icon: 'sparkles', tool: 'shaders', accent: 'accent-purple' },
  { path: '/help', label: 'Help', icon: 'circle-question', tool: 'help', accent: 'accent-gold' },
];

function themeButton(): HTMLButtonElement {
  const glyph = icon(getTheme() === 'dark' ? 'moon' : 'sun');
  const b = h('button', { type: 'button', class: 'icon-btn theme-toggle' }, glyph);
  const paint = () => {
    const dark = getTheme() === 'dark';
    setIcon(glyph, dark ? 'moon' : 'sun');
    const label = dark ? 'Switch to light theme' : 'Switch to dark theme';
    b.setAttribute('aria-label', label);
    tooltip(b, label);
  };
  b.addEventListener('click', () => {
    b.classList.remove('spin');
    void b.offsetWidth;
    b.classList.add('spin');
    toggleTheme();
  });
  onThemeChange(paint);
  paint();
  return b;
}

function githubLink(): HTMLAnchorElement {
  const a = h('a', { class: 'icon-btn', href: GITHUB_URL, target: '_blank', rel: 'noopener noreferrer', 'aria-label': 'TexturesOnline on GitHub' }, icon('github'));
  tooltip(a, 'Source code on GitHub');
  return a;
}

function navLinks(cls: string): HTMLAnchorElement[] {
  return NAV.map((item) =>
    h(
      'a',
      { class: [cls, item.accent], href: `#${item.path}`, dataset: { tool: item.tool } },
      icon(item.icon),
      h('span', null, item.label),
    ),
  );
}

function markActive(links: HTMLAnchorElement[], state: RouteState): void {
  for (const a of links) {
    const on = a.dataset.tool === state.tool;
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}

function openDrawer(onNavigate: () => void): void {
  const links = navLinks('drawer-link');
  const state = currentState;
  if (state) markActive(links, state);
  const dlg = h(
    'dialog',
    { class: 'nav-drawer', 'aria-label': 'Menu' },
    h(
      'div',
      { class: 'drawer-head' },
      h('a', { class: 'brand', href: '#/' }, logoMark(32), h('span', { class: 'wordmark' }, 'Textures', h('span', null, 'Online'))),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close menu', on: { click: () => close() } }, icon('close')),
    ),
    h('nav', { class: 'drawer-nav', 'aria-label': 'Main' }, links),
    h(
      'div',
      { class: 'drawer-foot' },
      themeButton(),
      githubLink(),
      h('span', { class: 'faint small' }, 'Not affiliated with Mojang or Microsoft'),
    ),
  );
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    dlg.classList.add('closing');
    const done = () => {
      dlg.close();
      dlg.remove();
      document.documentElement.classList.remove('modal-open');
    };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) done();
    else setTimeout(done, 180);
  };
  links.forEach((a) =>
    a.addEventListener('click', () => {
      onNavigate();
      close();
    }),
  );
  dlg.querySelector('.brand')?.addEventListener('click', close);
  dlg.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) close();
  });
  document.body.appendChild(dlg);
  document.documentElement.classList.add('modal-open');
  dlg.showModal();
  (links.find((a) => a.hasAttribute('aria-current')) ?? links[0])?.focus();
}

let currentState: RouteState | null = null;

export function createShell(root: HTMLElement): { outlet: HTMLElement; topbar: HTMLElement } {
  const outlet = h('main', { id: 'main', class: 'page', tabIndex: -1 });
  const links = navLinks('nav-link');
  const menuBtn = h('button', { type: 'button', class: 'icon-btn menu-btn', 'aria-label': 'Open menu', 'aria-haspopup': 'dialog' }, icon('menu'));
  menuBtn.addEventListener('click', () => openDrawer(() => undefined));

  const skip = h('button', { type: 'button', class: 'skip-link' }, 'Skip to content');
  skip.addEventListener('click', () => outlet.focus());

  const topbar = h(
    'header',
    { class: 'topbar' },
    h(
      'div',
      { class: 'topbar-inner' },
      h('a', { class: 'brand', href: '#/', 'aria-label': 'TexturesOnline home' }, logoMark(32), h('span', { class: 'wordmark', 'aria-hidden': 'true' }, 'Textures', h('span', null, 'Online'))),
      h('nav', { class: 'mainnav', 'aria-label': 'Main' }, links),
      h('div', { class: 'topbar-actions' }, themeButton(), githubLink(), menuBtn),
    ),
  );

  root.replaceChildren(skip, topbar, outlet);

  const onScroll = () => topbar.classList.toggle('scrolled', window.scrollY > 4);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  onRouteChange((state) => {
    currentState = state;
    markActive(links, state);
    document.body.dataset.route = state.tool ?? 'missing';
  });
  return { outlet, topbar };
}
