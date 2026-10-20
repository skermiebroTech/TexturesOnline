// Router fallback views: loading, not found and load/render errors (in the page's language).

import { currentLocale, navigate, type RouteContext } from '../core/router';
import { h } from '../ui/dom';
import { button, emptyState, spinner } from '../ui/components';
import { siteFooter } from './footer';
import { PRERENDERED_ATTR, PRERENDERED_YEAR_ATTR, prerenderedKey } from './hydrate-attrs';
import { ui } from '../i18n/ui';
import type { Locale } from '../i18n/locales';

/**
 * The prerendered view in the outlet when it was built for exactly this page, made identical to a
 * freshly rendered one (build marks removed, the footer's year brought up to date); null otherwise.
 */
export function adoptPrerenderedView(outlet: HTMLElement, locale: Locale, path: string): HTMLElement | null {
  const view = outlet.firstChild;
  if (outlet.childNodes.length !== 1 || !(view instanceof HTMLDivElement) || !view.classList.contains('view')) return null;
  if (view.getAttribute(PRERENDERED_ATTR) !== prerenderedKey(locale, path)) return null;
  const year = view.getAttribute(PRERENDERED_YEAR_ATTR);
  view.removeAttribute(PRERENDERED_ATTR);
  view.removeAttribute(PRERENDERED_YEAR_ATTR);
  if (year !== String(new Date().getFullYear())) view.querySelector(':scope > .site-footer')?.replaceWith(siteFooter());
  return view;
}

/**
 * Empties the images of prerendered content the app is about to replace. Taken off the page, an
 * image whose file is chosen by its laid-out width (sizes="auto") would choose again without a
 * width and download its largest copy, which nothing shows.
 */
export function releasePrerendered(outlet: HTMLElement): void {
  outlet.querySelectorAll('img').forEach((img) => {
    img.removeAttribute('srcset');
    img.removeAttribute('src');
  });
  outlet.querySelectorAll('source').forEach((s) => s.removeAttribute('srcset'));
}

export function loadingView(): HTMLElement {
  return h('div', { class: 'route-loading', role: 'status' }, spinner(32), h('span', { class: 'muted' }, ui(currentLocale()).loading));
}

export function notFoundView(root: HTMLElement, ctx: RouteContext): void {
  const t = ui(ctx.locale).notFound;
  root.classList.add('fallback-page');
  root.append(
    h(
      'div',
      { class: 'container fallback-body' },
      emptyState({
        icon: 'map',
        title: t.title,
        text: t.text(ctx.path),
        action: h(
          'div',
          { class: 'row wrap', style: { justifyContent: 'center' } },
          button({ label: t.goHome, icon: 'home', variant: 'primary', onClick: () => navigate('/') }),
          button({ label: t.help, icon: 'circle-question', onClick: () => navigate('/help') }),
        ),
      }),
    ),
    siteFooter(),
  );
}

export function loadErrorView(err: unknown): HTMLElement {
  const u = ui(currentLocale());
  const t = u.loadError;
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const chunk = err instanceof Error && /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(err.message);
  const text = offline ? t.offline : chunk ? t.newVersion : t.generic;
  const detail = err instanceof Error ? err.message : String(err ?? '');
  return h(
    'div',
    { class: 'container fallback-body' },
    emptyState({
      icon: 'warning-diamond',
      title: t.title,
      text,
      action: h(
        'div',
        { class: 'stack', style: { alignItems: 'center' } },
        h(
          'div',
          { class: 'row wrap', style: { justifyContent: 'center' } },
          button({ label: t.reload, icon: 'reload', variant: 'primary', onClick: () => location.reload() }),
          button({ label: u.notFound.goHome, icon: 'home', onClick: () => navigate('/') }),
        ),
        detail ? h('details', { class: 'error-detail' }, h('summary', null, t.details), h('code', null, detail)) : null,
      ),
    }),
  );
}
