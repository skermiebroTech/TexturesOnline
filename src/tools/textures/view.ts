// Texture Pack Maker: '#/textures' shows the start screen, '#/textures/:id' the editor.
import './view.css';
import { onRouteChange, type RouteContext } from '../../core/router';
import { renderStartScreen } from './ui/start-screen';
import { loadTexturesText } from './i18n/load';
import { loadEditorText } from './ui/i18n/load';
import { loadModelsText } from '../../shared/models/i18n/load';

export default async function view(root: HTMLElement, ctx: RouteContext): Promise<() => void> {
  const id = ctx.params.id;
  if (!id) {
    await loadTexturesText(ctx.locale);
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
  // The editor (pixel canvas, 3D preview, panels) loads only when a project opens, so the start
  // screen does not wait for it; its text loads alongside.
  const [{ renderEditor }] = await Promise.all([import('./ui/editor'), loadTexturesText(ctx.locale), loadEditorText(ctx.locale), loadModelsText(ctx.locale)]);
  const cleanup = await renderEditor(root, decodeURIComponent(id), life.signal);
  return () => {
    leave();
    cleanup();
  };
}
