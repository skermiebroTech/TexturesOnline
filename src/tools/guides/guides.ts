// Guides: the /guides/ index and one page per guide. The markup comes from content.ts (the same
// tree is prerendered at build time).

import '../help/help.css';
import '../../app/content/content.css';
import type { RouteContext } from '../../core/router';
import { siteFooter } from '../../app/footer';
import { toDom } from '../../app/markup-dom';
import { wireContent } from '../../app/content/wire';
import { guideBySlug, guidePage, guidesIndexPage } from './content';
import { loadContent } from '../../i18n/content';

export default async function guides(root: HTMLElement, ctx: RouteContext): Promise<() => void> {
  await loadContent(ctx.locale);
  root.classList.add('guides');
  const slug = ctx.path.split('/')[2];
  const guide = slug ? guideBySlug(slug, ctx.locale) : undefined;
  root.append(toDom(guide ? guidePage(guide) : guidesIndexPage(ctx.locale)), siteFooter());
  return wireContent(root);
}
