// About page. The markup comes from content.ts (the same tree is prerendered at build time).

import '../help/help.css';
import '../../app/content/content.css';
import type { RouteContext } from '../../core/router';
import { siteFooter } from '../../app/footer';
import { toDom } from '../../app/markup-dom';
import { wireContent } from '../../app/content/wire';
import { aboutPage } from './content';

export default function about(root: HTMLElement, _ctx: RouteContext): () => void {
  root.classList.add('guides');
  root.append(toDom(aboutPage()), siteFooter());
  return wireContent(root);
}
