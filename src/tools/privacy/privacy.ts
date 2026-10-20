// Privacy policy page. The markup comes from content.ts (the same tree is prerendered at build time).

import '../help/help.css';
import '../../app/content/content.css';
import type { RouteContext } from '../../core/router';
import { siteFooter } from '../../app/footer';
import { toDom } from '../../app/markup-dom';
import { wireContent } from '../../app/content/wire';
import { privacyPage } from './content';

export default function privacy(root: HTMLElement, ctx: RouteContext): () => void {
  root.classList.add('guides');
  root.append(toDom(privacyPage(ctx.locale)), siteFooter());
  return wireContent(root);
}
