// Guides: the /guides/ index and one page per guide. The markup comes from content.ts (the same
// tree is prerendered at build time).

import '../help/help.css';
import '../../app/content/content.css';
import type { RouteContext } from '../../core/router';
import { siteFooter } from '../../app/footer';
import { toDom } from '../../app/markup-dom';
import { wireContent } from '../../app/content/wire';
import { guideBySlug, guidePage, guidesIndexPage } from './content';

export default function guides(root: HTMLElement, ctx: RouteContext): () => void {
  root.classList.add('guides');
  const slug = ctx.path.split('/')[2];
  const guide = slug ? guideBySlug(slug) : undefined;
  root.append(toDom(guide ? guidePage(guide) : guidesIndexPage()), siteFooter());
  return wireContent(root);
}
