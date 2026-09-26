// Shader Maker: '#/shaders' shows the target chooser, '#/shaders/:id' opens the editor.
import type { RouteContext } from '../../core/router';
import './view.css';

export default async function view(root: HTMLElement, ctx: RouteContext): Promise<() => void> {
  root.classList.add('shaders-view');
  const id = ctx.params.id;
  if (id) {
    root.classList.add('shaders-editing');
    const { mountEditor } = await import('./ui/editor');
    return mountEditor(root, decodeURIComponent(id));
  }
  const { mountStart } = await import('./ui/start');
  return mountStart(root);
}
