// App shell: sticky top bar (logo, main nav, theme toggle, GitHub), mobile menu drawer and
// the page outlet the router renders into. The markup comes from content/chrome.ts, the same tree
// the build prerenders, so the booted shell replaces the static one without any visible change.
// The top bar follows the page's language (it is rebuilt when the language changes).

import { currentLocale, onNavigation, onRouteChange, type RouteState, type ToolId } from '../core/router';
import { h } from '../ui/dom';
import { icon, setIcon } from '../ui/icons';
import { hideTooltip, tooltip } from '../ui/tooltip';
import { getTheme, onThemeChange, toggleTheme } from '../ui/theme';
import { closeAllModals, setScrollLock } from '../ui/modal';
import { closeAllPopovers } from '../ui/popover';
import { syncToastLayer } from '../ui/toast';
import { NAV as NAV_ITEMS, brandLink, githubLink as githubTree, languageSwitcher, navLinks as navTree, skipLink, topbar as topbarTree, type NavItem as ChromeNavItem } from './content/chrome';
import { toDom } from './markup-dom';
import { REPO_URL } from './site';
import { ui } from '../i18n/ui';
import type { Locale } from '../i18n/locales';

export const GITHUB_URL = REPO_URL;

type NavItem = Omit<ChromeNavItem, 'tool'> & { tool: ToolId };

export const NAV: NavItem[] = NAV_ITEMS;

/** Language of the shell's texts (the current page's). */
let shellLocale: Locale = 'en';

/** Adds the theme toggle behaviour to a button (the icon follows the current theme). */
function wireThemeButton(b: HTMLButtonElement): HTMLButtonElement {
  const glyph = b.querySelector<HTMLElement>('.icon') ?? b.appendChild(icon('moon'));
  const locale = shellLocale;
  const paint = () => {
    const dark = getTheme() === 'dark';
    setIcon(glyph, dark ? 'moon' : 'sun');
    const t = ui(locale);
    const label = dark ? t.themeToLight : t.themeToDark;
    b.setAttribute('aria-label', label);
    tooltip(b, label);
  };
  b.addEventListener('click', () => {
    b.classList.remove('spin');
    void b.offsetWidth;
    b.classList.add('spin');
    toggleTheme();
  });
  // The drawer and a language change create short-lived copies of this button: drop their listener once detached.
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
  const a = toDom<HTMLAnchorElement>(githubTree(shellLocale));
  tooltip(a, ui(shellLocale).githubTooltip);
  return a;
}

function navLinks(cls: string, active: ToolId | null): HTMLAnchorElement[] {
  const tool = active === 'kit' ? null : active;
  return navTree(cls, tool, shellLocale).map((n) => toDom<HTMLAnchorElement>(n));
}

function markActive(links: HTMLAnchorElement[], state: RouteState): void {
  for (const a of links) {
    const on = a.dataset.tool === state.tool;
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}

function openDrawer(onNavigate: () => void): void {
  const t = ui(shellLocale);
  const links = navLinks('drawer-link', currentState?.tool ?? null);
  const langs = languageSwitcher(currentState?.path ?? '/', shellLocale, 'lang-switch drawer-langs');
  const dlg = h(
    'dialog',
    { class: 'nav-drawer', 'aria-label': t.menu },
    h(
      'div',
      { class: 'drawer-head' },
      toDom(brandLink()),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': t.closeMenu, on: { click: () => close() } }, icon('close')),
    ),
    h('nav', { class: 'drawer-nav', 'aria-label': t.mainNav }, links),
    langs ? toDom(langs) : null,
    h(
      'div',
      { class: 'drawer-foot' },
      themeButton(),
      githubLink(),
      h('span', { class: 'faint small' }, t.notAffiliatedShort),
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
  [...links, ...Array.from(dlg.querySelectorAll<HTMLAnchorElement>('.drawer-langs a'))].forEach((a) =>
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
  // A prerendered page keeps its content on screen until the router renders the real view: its
  // <main> becomes the outlet where it is (moving the content would make every image choose its
  // file again before the page is laid out, and download a second copy).
  const existing = root.querySelector<HTMLElement>('main#main');
  const reuse = existing?.parentNode === root ? existing : null;
  const outlet = reuse ?? h('main', { id: 'main', class: 'page', tabIndex: -1 });
  if (reuse) {
    reuse.removeAttribute('data-boot');
    reuse.className = 'page';
    reuse.tabIndex = -1;
  } else if (existing) outlet.append(...Array.from(existing.childNodes));

  const tool = (document.documentElement.dataset.tool || null) as ToolId | null;
  shellLocale = currentLocale();
  const navTool = (t: ToolId | null) => (t === 'kit' ? null : (t as ChromeNavItem['tool'] | null));
  const topbar = toDom(topbarTree(navTool(tool), shellLocale));
  let links: HTMLAnchorElement[] = [];
  /** Wires the top bar's buttons (again after a language change rebuilt it). */
  const wireTopbar = () => {
    links = Array.from(topbar.querySelectorAll<HTMLAnchorElement>('.mainnav .nav-link'));
    wireThemeButton(topbar.querySelector<HTMLButtonElement>('.theme-toggle')!);
    const gh = topbar.querySelector<HTMLAnchorElement>('.topbar-actions > a.icon-btn');
    if (gh) tooltip(gh, ui(shellLocale).githubTooltip);
    topbar.querySelector('.menu-btn')?.addEventListener('click', () => openDrawer(() => undefined));
  };
  wireTopbar();

  const skip = toDom<HTMLAnchorElement>(skipLink(shellLocale));
  skip.addEventListener('click', (e) => {
    e.preventDefault();
    outlet.focus();
  });

  if (outlet.parentNode === root) {
    // Everything around the outlet is replaced; the outlet itself stays in place.
    while (outlet.previousSibling) outlet.previousSibling.remove();
    while (outlet.nextSibling) outlet.nextSibling.remove();
    root.insertBefore(skip, outlet);
    root.insertBefore(topbar, outlet);
  } else root.replaceChildren(skip, topbar, outlet);

  // Dialogs, menus and tooltips belong to the page that opened them.
  onNavigation(() => {
    closeAllPopovers();
    closeAllModals();
    hideTooltip();
  });

  const onScroll = () => topbar.classList.toggle('scrolled', window.scrollY > 4);
  window.addEventListener('scroll', onScroll, { passive: true });
  // Not right away: reading the scroll position here would force a layout of the whole page in
  // the middle of booting (the view is rendered next anyway).
  requestAnimationFrame(onScroll);

  onRouteChange((state) => {
    currentState = state;
    if (state.locale !== shellLocale) {
      shellLocale = state.locale;
      const fresh = toDom(topbarTree(navTool(state.tool), shellLocale));
      topbar.replaceChildren(...Array.from(fresh.childNodes));
      wireTopbar();
      skip.textContent = ui(shellLocale).skipLink;
    }
    markActive(links, state);
    document.body.dataset.route = state.tool ?? 'missing';
  });
  return { outlet, topbar };
}
