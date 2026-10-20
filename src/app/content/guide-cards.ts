// Grid of guide cards (home page, guides index, tool pages). Translated pages only list the guides
// that exist in their language.

import type { IconName } from '../../ui/icons';
import { el, ic, type ElNode } from '../markup';
import { guideMeta, guidesIn, type GuideMeta } from '../seo/meta';
import type { Locale } from '../../i18n/locales';

export function guideCard(g: GuideMeta, headingTag = 'h3'): ElNode {
  return el(
    'a',
    { class: ['guide-card', g.accent], to: g.path },
    el('span', { class: 'guide-card-icon' }, ic(g.icon as IconName)),
    el('span', { class: 'guide-card-text' }, el(headingTag, { class: 'guide-card-title' }, g.label), el('span', { class: 'guide-card-desc' }, g.blurb)),
    ic('arrow-right', { class: 'guide-card-go' }),
  );
}

/** Cards for the given guide slugs (all guides when omitted); `columns` 2 or 3 on wide screens. */
export function guideCards(slugs?: string[], headingTag = 'h3', columns: 2 | 3 = 3, locale: Locale = 'en'): ElNode {
  const list = slugs ? slugs.map((s) => guideMeta(s, locale)).filter((g): g is GuideMeta => !!g) : guidesIn(locale);
  return el('div', { class: ['guide-grid', columns === 2 ? 'cols-2' : null] }, list.map((g) => guideCard(g, headingTag)));
}
