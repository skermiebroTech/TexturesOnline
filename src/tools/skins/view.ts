// Skin Maker: '#/skins' shows the start screen, '#/skins/:id' opens the editor.
import type { RouteContext } from '../../core/router';
import './view.css';
import { mountStart } from './ui/start';

export default async function view(root: HTMLElement, ctx: RouteContext): Promise<() => void> {
  root.classList.add('skins-view');
  const id = ctx.params.id;
  if (id) {
    root.classList.add('skins-editing');
    // The editor (pixel canvas, 3D preview) loads only when a skin opens.
    const { mountEditor } = await import('./ui/editor');
    return mountEditor(root, decodeURIComponent(id));
  }
  return mountStart(root);
}
