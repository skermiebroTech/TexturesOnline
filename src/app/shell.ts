// App shell: sticky top bar (logo, main nav, theme toggle, GitHub), mobile menu drawer and
// the page outlet the router renders into. The markup comes from content/chrome.ts, the same tree
// the build prerenders, so the booted shell replaces the static one without any visible change.

import { onNavigation, onRouteChange, type RouteState, type ToolId } from '../core/router';
import { h } from '../ui/dom';
import { icon, setIcon } from '../ui/icons';
import { hideTooltip, tooltip } from '../ui/tooltip';
import { getTheme, onThemeChange, toggleTheme } from '../ui/theme';
import { closeAllModals, setScrollLock } from '../ui/modal';
import { closeAllPopovers } from '../ui/popover';
import { syncToastLayer } from '../ui/toast';
import { NAV as NAV_ITEMS, brandLink, githubLink as githubTree, navLinks as navTree, skipLink, topbar as topbarTree, type NavItem as ChromeNavItem } from './content/chrome';
import { toDom } from './markup-dom';
import { REPO_URL, SITE_NAME } from './site';

export const GITHUB_URL = REPO_URL;

type NavItem = Omit<ChromeNavItem, 'tool'> & { tool: ToolId };

export const NAV: NavItem[] = NAV_ITEMS;

/** Adds the theme toggle behaviour to a button (the icon follows the current theme). */
function wireThemeButton(b: HTMLButtonElement): HTMLButtonElement {
  const glyph = b.querySelector<HTMLElement>('.icon') ?? b.appendChild(icon('moon'));
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
  // The drawer creates short-lived copies of this button: drop their listener once detached.
  let attached = false;
  const off = onThemeChange(() => {
    if (b.isConnected) attached = true;
    else if (attached) {
      off();
      return;
    }
    paint();
  });
  paint();
  return b;
}

function themeButton(): HTMLButtonElement {
  return wireThemeButton(h('button', { type: 'button', class: 'icon-btn theme-toggle' }, icon('moon')));
}

function githubLink(): HTMLAnchorElement {
  const a = toDom<HTMLAnchorElement>(githubTree());
  tooltip(a, 'Source code on GitHub');
  return a;
}

function navLinks(cls: string, active: ToolId | null): HTMLAnchorElement[] {
  const tool = active === 'kit' ? null : active;
  return navTree(cls, tool).map((n) => toDom<HTMLAnchorElement>(n));
}

function markActive(links: HTMLAnchorElement[], state: RouteState): void {
  for (const a of links) {
    const on = a.dataset.tool === state.tool;
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}

function openDrawer(onNavigate: () => void): void {
  const links = navLinks('drawer-link', currentState?.tool ?? null);
  const dlg = h(
    'dialog',
    { class: 'nav-drawer', 'aria-label': 'Menu' },
    h(
      'div',
      { class: 'drawer-head' },
      toDom(brandLink()),
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
  const offNav = onNavigation(() => close());
  const close = () => {
    if (closed) return;
    closed = true;
    offNav();
    dlg.classList.add('closing');
    const done = () => {
      dlg.close();
      syncToastLayer();
      dlg.remove();
      setScrollLock(false);
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
  dlg.addEventListener('close', () => close());
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) close();
  });
  document.body.appendChild(dlg);
  setScrollLock(true);
  dlg.showModal();
  syncToastLayer();
  (links.find((a) => a.hasAttribute('aria-current')) ?? links[0])?.focus();
}

let currentState: RouteState | null = null;

export function createShell(root: HTMLElement): { outlet: HTMLElement; topbar: HTMLElement } {
  // A prerendered page keeps its content on screen until the router renders the real view.
  const prerendered = Array.from(root.querySelector('main#main')?.childNodes ?? []);
  const outlet = h('main', { id: 'main', class: 'page', tabIndex: -1 });
  outlet.append(...prerendered);

  const tool = (document.documentElement.dataset.tool || null) as ToolId | null;
  const topbar = toDom(topbarTree(tool === 'kit' ? null : (tool as ChromeNavItem['tool'] | null)));
  const links = Array.from(topbar.querySelectorAll<HTMLAnchorElement>('.mainnav .nav-link'));
  wireThemeButton(topbar.querySelector<HTMLButtonElement>('.theme-toggle')!);
  const gh = topbar.querySelector<HTMLAnchorElement>('.topbar-actions > a.icon-btn');
  if (gh) tooltip(gh, 'Source code on GitHub');
  topbar.querySelector('.menu-btn')?.addEventListener('click', () => openDrawer(() => undefined));
  topbar.querySelector('.brand')?.setAttribute('aria-label', `${SITE_NAME} home`);

  const skip = toDom<HTMLAnchorElement>(skipLink());
  skip.addEventListener('click', (e) => {
    e.preventDefault();
    outlet.focus();
  });

  root.replaceChildren(skip, topbar, outlet);

  // Dialogs, menus and tooltips belong to the page that opened them.
  onNavigation(() => {
    closeAllPopovers();
    closeAllModals();
    hideTooltip();
  });

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
