// Grid of guide cards (home page, guides index, tool pages).

import type { IconName } from '../../ui/icons';
import { el, ic, type ElNode } from '../markup';
import { GUIDES, type GuideMeta } from '../seo/meta';

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
export function guideCards(slugs?: string[], headingTag = 'h3', columns: 2 | 3 = 3): ElNode {
  const list = slugs ? slugs.map((s) => GUIDES.find((g) => g.slug === s)).filter((g): g is GuideMeta => !!g) : GUIDES;
  return el('div', { class: ['guide-grid', columns === 2 ? 'cols-2' : null] }, list.map((g) => guideCard(g, headingTag)));
}
