// Shader Maker: '#/shaders' shows the target chooser, '#/shaders/:id' opens the editor (or the pack
// editor for imported packs).
import type { RouteContext } from '../../core/router';
import './view.css';

export default async function view(root: HTMLElement, ctx: RouteContext): Promise<() => void> {
  root.classList.add('shaders-view');
  const id = ctx.params.id;
  if (id) {
    root.classList.add('shaders-editing');
    // packs opened from a file (not made here) get the pack editor instead of the generator editor
    const { mountImportedPack } = await import('./packedit/mount');
    const imported = await mountImportedPack(root, decodeURIComponent(id));
    if (imported) return imported;
    const { mountEditor } = await import('./ui/editor');
    return mountEditor(root, decodeURIComponent(id));
  }
  const { mountStart } = await import('./ui/start');
  return mountStart(root);
}
