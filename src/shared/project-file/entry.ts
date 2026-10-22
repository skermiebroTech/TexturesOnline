// What the editors put on the page for project files: an "Open a project file" button, and calls
// that load the reading, writing and dialogs (./ui.ts) when they are first used.

import './entry.css';
import { button } from '../../ui/components';
import { toast } from '../../ui/toast';
import { kit } from '../../ui/i18n/kit';
import { projectsText } from '../i18n/projects';
import { PROJECT_ACCEPT } from './handoff';
import type { SaveRequest } from './ui';

const ui = () => import('./ui');

function loadFailed(err: unknown): void {
  console.error(err);
  toast(kit.actionFailed, { tone: 'error' });
}

/** Opens a project file or backup: the project opens in its tool, a backup offers what to restore. */
export function openProjectFile(file: File): void {
  void ui()
    .then((m) => m.openProjectFile(file))
    .catch(loadFailed);
}

/** Downloads a project (or the cape / font) as a .tpmproject file. Resolves false when it failed. */
export function saveProjectFile(req: SaveRequest): Promise<boolean> {
  return ui()
    .then((m) => m.saveProjectFile(req))
    .catch((err) => {
      loadFailed(err);
      return false;
    });
}

/** The backup dialog (every project at once). */
export function openBackupDialog(): void {
  void ui()
    .then((m) => m.openBackupDialog())
    .catch(loadFailed);
}

/** Lets the user pick a project file or backup and opens it. */
export function pickProjectFile(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = PROJECT_ACCEPT;
  input.hidden = true;
  input.addEventListener('change', () => {
    const f = input.files?.[0];
    input.remove();
    if (f) openProjectFile(f);
  });
  input.addEventListener('cancel', () => input.remove());
  // Some browsers only open the picker for an input that is in the document.
  document.body.appendChild(input);
  input.click();
}

/** The "Open a project file" button of start screens and open cards. */
export function openProjectButton(opts: { size?: 'sm' | 'md'; variant?: 'secondary' | 'ghost'; class?: string } = {}): HTMLButtonElement {
  const b = button({ label: projectsText.open, icon: 'archive', variant: opts.variant ?? 'ghost', size: opts.size ?? 'sm', title: projectsText.openHint, class: ['pf-open-btn', opts.class].filter(Boolean).join(' '), onClick: () => pickProjectFile() });
  b.dataset.projectFile = 'open';
  return b;
}
