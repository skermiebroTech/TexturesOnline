// Texture Pack Maker: '#/textures' shows the start screen, '#/textures/:id' the editor.
import './view.css';
import type { RouteContext } from '../../core/router';
import { renderStartScreen } from './ui/start-screen';
import { renderEditor } from './ui/editor';

export default async function view(root: HTMLElement, ctx: RouteContext): Promise<() => void> {
  const id = ctx.params.id;
  if (!id) {
    root.classList.add('tx-view-start');
    return renderStartScreen(root, ctx);
  }
  root.classList.add('tx-view-editor');
  document.body.classList.add('tx-editing');
  const cleanup = await renderEditor(root, decodeURIComponent(id));
  return () => {
    document.body.classList.remove('tx-editing');
    cleanup();
  };
}
