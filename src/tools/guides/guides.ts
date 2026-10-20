// Guides: the /guides/ index and one page per guide. The markup comes from content.ts (the same
// tree is prerendered at build time).

import '../help/help.css';
import '../../app/content/content.css';
import type { ViewContext } from '../../core/router';
import { siteFooter, wireFooter } from '../../app/footer';
import { toDom } from '../../app/markup-dom';
import { wireContent } from '../../app/content/wire';
import { guideBySlug, guidePage, guidesIndexPage } from './content';
import { loadContent } from '../../i18n/content';

/** The page is the prerendered markup: on a first visit the router hands it over as it is. */
export const hydratable = true;

export default async function guides(root: HTMLElement, ctx: ViewContext): Promise<() => void> {
  await loadContent(ctx.locale);
  root.classList.add('guides');
  if (!ctx.hydrate) {
    const slug = ctx.path.split('/')[2];
    const guide = slug ? guideBySlug(slug, ctx.locale) : undefined;
    root.append(toDom(guide ? guidePage(guide) : guidesIndexPage(ctx.locale)), siteFooter());
  } else wireFooter(root, ctx.locale);
  return wireContent(root);
}
