// Router fallback views: loading, not found and load/render errors (in the page's language).

import { currentLocale, navigate, type RouteContext } from '../core/router';
import { h } from '../ui/dom';
import { button, emptyState, spinner } from '../ui/components';
import { siteFooter } from './footer';
import { ui } from '../i18n/ui';

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
