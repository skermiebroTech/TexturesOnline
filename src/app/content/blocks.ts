// Reusable content pieces (numbered steps, menu paths, callouts, tabs, FAQ lists, breadcrumbs)
// shared by the help page, the guides and the tool introductions. Styles live in help.css.

import type { IconName } from '../../ui/icons';
import { el, ic, type Child, type ElNode } from '../markup';

export interface FaqItem {
  id: string;
  q: string;
  a: Child[];
}

export interface Crumb {
  label: string;
  /** Route path; the last crumb (current page) has none */
  to?: string;
}

/** A menu path in the game, shown as key caps: Options… › Resource Packs… */
export const uiPath = (...parts: string[]): ElNode =>
  el(
    'span',
    { class: 'ui-path' },
    parts.map((p, i) => [i > 0 ? [ic('chevron-right', { class: 'ui-path-sep' }), el('span', { class: 'sr-only' }, ' > ')] : null, el('span', { class: 'ui-path-item' }, p)]),
  );

/** Numbered steps. */
export const steps = (items: Child[]): ElNode => el('ol', { class: 'guide-steps' }, items.map((it) => el('li', null, el('div', { class: 'guide-step-body' }, it))));

export const callout = (tone: 'info' | 'warn' | 'tip', title: string, ...text: Child[]): ElNode =>
  el(
    'aside',
    { class: ['callout', `callout-${tone}`] },
    ic(tone === 'warn' ? 'warning-diamond' : tone === 'tip' ? 'sparkle' : 'circle-info'),
    el('div', null, el('div', { class: 'callout-title' }, title), el('p', null, ...text)),
  );

/** Link to another website (opens in a new tab). */
export const ext = (href: string, label: string): ElNode => el('a', { href, target: '_blank', rel: 'noopener noreferrer' }, label);

/** Link to a page of this site. */
export const link = (to: string, ...label: Child[]): ElNode => el('a', { to }, ...label);

export const code = (text: string): ElNode => el('code', null, text);
export const strong = (...text: Child[]): ElNode => el('strong', null, ...text);

export interface TabOption {
  value: string;
  label: string;
  icon?: IconName;
  content: Child[];
}

/**
 * Tab set with every panel in the markup (only the first is shown); the runtime wires the tab
 * buttons, and without JavaScript all panels are listed one after another.
 */
export function tabbed(id: string, options: TabOption[], label = 'Platform'): ElNode {
  return el(
    'div',
    { class: 'guide-tabs', 'data-tabs': id },
    el(
      'div',
      { class: 'tabs', role: 'tablist', 'aria-label': label, 'data-md': 'skip' },
      options.map((o, i) =>
        el(
          'button',
          {
            type: 'button',
            class: 'tab',
            role: 'tab',
            id: `${id}-tab-${o.value}`,
            'aria-selected': String(i === 0),
            'aria-controls': `${id}-panel-${o.value}`,
            tabindex: i === 0 ? '0' : '-1',
            'data-value': o.value,
          },
          o.icon ? ic(o.icon) : null,
          el('span', null, o.label),
        ),
      ),
    ),
    options.map((o, i) =>
      el(
        'div',
        {
          class: 'guide-tabpanel',
          role: 'tabpanel',
          id: `${id}-panel-${o.value}`,
          'aria-labelledby': `${id}-tab-${o.value}`,
          tabindex: '0',
          hidden: i !== 0,
          'data-md-heading': o.label,
        },
        o.content,
      ),
    ),
  );
}

/** Folder table for Windows / macOS / Linux. */
export const folderTable = (sub: string): ElNode =>
  el(
    'table',
    { class: 'paths-table' },
    el('thead', null, el('tr', null, el('th', { scope: 'col' }, 'System'), el('th', { scope: 'col' }, 'Folder'))),
    el(
      'tbody',
      null,
      el('tr', null, el('th', { scope: 'row' }, 'Windows'), el('td', null, code(`%APPDATA%\\.minecraft\\${sub}`))),
      el('tr', null, el('th', { scope: 'row' }, 'macOS'), el('td', null, code(`~/Library/Application Support/minecraft/${sub}`))),
      el('tr', null, el('th', { scope: 'row' }, 'Linux'), el('td', null, code(`~/.minecraft/${sub}`))),
    ),
  );

/** Expandable questions; the first one starts open. */
export function faqList(items: FaqItem[], opts: { idPrefix?: string; openFirst?: boolean } = {}): ElNode {
  const prefix = opts.idPrefix ?? 'faq';
  return el(
    'div',
    { class: 'faq-list' },
    items.map((f, i) =>
      el(
        'details',
        { class: 'faq-item', id: `${prefix}-${f.id}`, open: (opts.openFirst ?? true) && i === 0 },
        el('summary', null, el('span', null, f.q), ic('chevron-down', { class: 'faq-chev' })),
        el('div', { class: 'faq-answer' }, f.a),
      ),
    ),
  );
}

/** Visible breadcrumb trail (matches the BreadcrumbList structured data). */
export function breadcrumbs(items: Crumb[]): ElNode {
  return el(
    'nav',
    { class: 'crumbs', 'aria-label': 'Breadcrumb', 'data-md': 'skip' },
    el(
      'ol',
      null,
      items.map((c, i) =>
        el(
          'li',
          null,
          i > 0 ? ic('chevron-right', { class: 'crumbs-sep' }) : null,
          c.to ? el('a', { to: c.to }, c.label) : el('span', { 'aria-current': 'page' }, c.label),
        ),
      ),
    ),
  );
}
