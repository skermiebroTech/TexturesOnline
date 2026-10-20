// Shader Maker: '#/shaders' shows the target chooser, '#/shaders/:id' opens the editor (or the pack
// editor for imported packs).
import type { RouteContext } from '../../core/router';
import { loadShadersText } from './i18n/load';
import './view.css';

export default async function view(root: HTMLElement, ctx: RouteContext): Promise<() => void> {
  root.classList.add('shaders-view');
  const id = ctx.params.id;
  if (id) {
    root.classList.add('shaders-editing');
    // the editors' text (English needs no download) loads with the start screen's
    const editorText = Promise.all([import('./ui/i18n/load'), import('./packedit/i18n/load')]).then(([a, b]) =>
      Promise.all([a.loadShadersEditorText(ctx.locale), b.loadPackEditText(ctx.locale)]),
    );
    await Promise.all([loadShadersText(ctx.locale), editorText]);
    // packs opened from a file (not made here) get the pack editor instead of the generator editor
    const { mountImportedPack } = await import('./packedit/mount');
    const imported = await mountImportedPack(root, decodeURIComponent(id));
    if (imported) return imported;
    const { mountEditor } = await import('./ui/editor');
    return mountEditor(root, decodeURIComponent(id));
  }
  const [, { mountStart }] = await Promise.all([loadShadersText(ctx.locale), import('./ui/start')]);
  return mountStart(root);
}
