// Routing helper: '#/shaders/:id' opens the pack editor when the project is an imported pack.
// Kept tiny so the generator editor doesn't load the pack editor code.

import { getProject } from '../../../core/storage';
import { isImportedPack } from './store';

/** Mounts the pack editor for an imported pack; resolves to null (nothing rendered) otherwise. */
export async function mountImportedPack(root: HTMLElement, id: string): Promise<(() => void) | null> {
  let p: unknown;
  try {
    p = await getProject(id);
  } catch {
    return null;
  }
  if (!isImportedPack(p)) return null;
  const { mountPackEditor } = await import('./editor');
  return mountPackEditor(root, p);
}
