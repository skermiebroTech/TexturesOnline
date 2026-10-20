// About page. The markup comes from content.ts (the same tree is prerendered at build time).

import '../help/help.css';
import '../../app/content/content.css';
import type { ViewContext } from '../../core/router';
import { siteFooter } from '../../app/footer';
import { toDom } from '../../app/markup-dom';
import { wireContent } from '../../app/content/wire';
import { aboutPage } from './content';
import { loadContent } from '../../i18n/content';

/** The page is the prerendered markup: on a first visit the router hands it over as it is. */
export const hydratable = true;

export default async function about(root: HTMLElement, ctx: ViewContext): Promise<() => void> {
  await loadContent(ctx.locale);
  root.classList.add('guides');
  if (!ctx.hydrate) root.append(toDom(aboutPage(ctx.locale)), siteFooter());
  return wireContent(root);
}
