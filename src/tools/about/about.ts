// About page. The markup comes from content.ts (the same tree is prerendered at build time).

import '../help/help.css';
import '../../app/content/content.css';
import type { RouteContext } from '../../core/router';
import { siteFooter } from '../../app/footer';
import { toDom } from '../../app/markup-dom';
import { wireContent } from '../../app/content/wire';
import { aboutPage } from './content';
import { loadContent } from '../../i18n/content';

export default async function about(root: HTMLElement, ctx: RouteContext): Promise<() => void> {
  await loadContent(ctx.locale);
  root.classList.add('guides');
  root.append(toDom(aboutPage(ctx.locale)), siteFooter());
  return wireContent(root);
}
