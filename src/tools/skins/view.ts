// Skin Maker: '#/skins' shows the start screen, '#/skins/:id' opens the editor.
import type { RouteContext } from '../../core/router';
import './view.css';
import { loadSkinsText } from './i18n/load';
import { mountStart } from './ui/start';

export default async function view(root: HTMLElement, ctx: RouteContext): Promise<() => void> {
  root.classList.add('skins-view');
  // The interface text in the page's language (English needs nothing).
  const text = loadSkinsText(ctx.locale);
  const id = ctx.params.id;
  if (id) {
    root.classList.add('skins-editing');
    // The editor (pixel canvas, 3D preview) loads only when a skin opens.
    const [{ mountEditor }] = await Promise.all([import('./ui/editor'), text]);
    return mountEditor(root, decodeURIComponent(id));
  }
  await text;
  return mountStart(root);
}
