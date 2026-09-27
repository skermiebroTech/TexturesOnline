// Texture Pack Maker: '#/textures' shows the start screen, '#/textures/:id' the editor.
import './view.css';
import { onRouteChange, type RouteContext } from '../../core/router';
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
  // Any later navigation ends this editor, even one that happens while it is still loading
  // (the router only gets our cleanup once this function returns).
  const life = new AbortController();
  const leave = () => {
    offRoute();
    life.abort();
    document.body.classList.remove('tx-editing');
  };
  const offRoute = onRouteChange((s) => {
    if (s.path !== ctx.path) leave();
  });
  const cleanup = await renderEditor(root, decodeURIComponent(id), life.signal);
  return () => {
    leave();
    cleanup();
  };
}
