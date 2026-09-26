// Router fallback views: loading, not found and load/render errors.

import type { RouteContext } from '../core/router';
import { h } from '../ui/dom';
import { button, emptyState, spinner } from '../ui/components';
import { siteFooter } from './footer';

export function loadingView(): HTMLElement {
  return h('div', { class: 'route-loading', role: 'status' }, spinner(32), h('span', { class: 'muted' }, 'Loading…'));
}

export function notFoundView(root: HTMLElement, ctx: RouteContext): void {
  root.classList.add('fallback-page');
  root.append(
    h(
      'div',
      { class: 'container fallback-body' },
      emptyState({
        icon: 'map',
        title: 'This page wandered off',
        text: `There's nothing at "${ctx.path}". It may have been moved, or the link is mistyped.`,
        action: h(
          'div',
          { class: 'row wrap', style: { justifyContent: 'center' } },
          button({ label: 'Go home', icon: 'home', variant: 'primary', onClick: () => (location.hash = '#/') }),
          button({ label: 'Help', icon: 'circle-question', onClick: () => (location.hash = '#/help') }),
        ),
      }),
    ),
    siteFooter(),
  );
}

export function loadErrorView(err: unknown): HTMLElement {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const chunk = err instanceof Error && /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(err.message);
  const text = offline
    ? "You're offline and this part of the app hasn't been saved on this device yet. Reconnect and try again."
    : chunk
      ? 'A newer version of TexturesOnline may have been published. Reloading the page usually fixes this.'
      : 'Something went wrong while opening this page. Your projects are safe — try reloading.';
  const detail = err instanceof Error ? err.message : String(err ?? '');
  return h(
    'div',
    { class: 'container fallback-body' },
    emptyState({
      icon: 'warning-diamond',
      title: "This page couldn't be opened",
      text,
      action: h(
        'div',
        { class: 'stack', style: { alignItems: 'center' } },
        h(
          'div',
          { class: 'row wrap', style: { justifyContent: 'center' } },
          button({ label: 'Reload', icon: 'reload', variant: 'primary', onClick: () => location.reload() }),
          button({ label: 'Go home', icon: 'home', onClick: () => (location.hash = '#/') }),
        ),
        detail ? h('details', { class: 'error-detail' }, h('summary', null, 'Technical details'), h('code', null, detail)) : null,
      ),
    }),
  );
}
