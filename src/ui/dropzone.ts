// File drop target with click/keyboard browsing and accept filtering.

import { h } from './dom';
import { icon, type IconName } from './icons';
import { describeAccept, fileMatchesAccept } from './format';
import { pickers } from '../shared/i18n/pickers';
import { fmt } from '../i18n/editor-text';
import { isProjectFileName } from '../shared/project-file/handoff';

export { fileMatchesAccept } from './format';

export function dropzone(opts: {
  accept: string;
  label: string;
  hint?: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  compact?: boolean;
  icon?: IconName;
}): HTMLElement & { setError(msg: string | null): void } {
  const input = h('input', { type: 'file', accept: opts.accept, multiple: Boolean(opts.multiple), hidden: true, tabIndex: -1 });
  const errorEl = h('div', { class: 'dropzone-error', role: 'alert', hidden: true });
  const el = h(
    'div',
    {
      class: ['dropzone', opts.compact && 'compact'],
      role: 'button',
      tabIndex: 0,
      // named by its visible label and hint (an aria-label without the hint would not match them)
    },
    h('div', { class: 'dropzone-icon' }, icon(opts.icon ?? 'upload')),
    h(
      'div',
      { class: 'dropzone-text' },
      h('div', { class: 'dropzone-label' }, opts.label),
      opts.hint ? h('div', { class: 'dropzone-hint' }, opts.hint) : null,
    ),
    errorEl,
    input,
  ) as unknown as HTMLElement & { setError(msg: string | null): void };

  el.setError = (msg) => {
    errorEl.hidden = !msg;
    errorEl.textContent = msg ?? '';
  };

  const deliver = (list: FileList | File[] | null) => {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    // A project file or backup opens wherever it is dropped: in its own tool, or the restore dialog.
    const project = files.find((f) => isProjectFileName(f.name));
    if (project) {
      el.setError(null);
      void import('../shared/project-file/entry').then((m) => m.openProjectFile(project));
      return;
    }
    const ok = files.filter((f) => fileMatchesAccept(f, opts.accept));
    const picked = opts.multiple ? ok : ok.slice(0, 1);
    if (!ok.length) {
      el.setError(fmt(pickers.drop.wrongType, { name: files[0].name, accept: describeAccept(opts.accept) }));
      return;
    }
    const notes: string[] = [];
    if (ok.length < files.length) notes.push(fmt(pickers.drop.skipped, { count: files.length - ok.length }));
    if (!opts.multiple && ok.length > 1) notes.push(fmt(pickers.drop.oneAtATime, { name: ok[0].name }));
    el.setError(notes.length ? notes.join(' ') : null);
    opts.onFiles(picked);
  };

  el.addEventListener('click', (e) => {
    if (e.target === input) return;
    input.click();
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      input.click();
    }
  });
  input.addEventListener('change', () => {
    deliver(input.files);
    input.value = '';
  });

  let depth = 0;
  el.addEventListener('dragenter', (e) => {
    if (!e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    depth++;
    el.classList.add('dragging');
  });
  el.addEventListener('dragover', (e) => {
    if (!e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  el.addEventListener('dragleave', () => {
    depth = Math.max(0, depth - 1);
    if (depth === 0) el.classList.remove('dragging');
  });
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    depth = 0;
    el.classList.remove('dragging');
    deliver(e.dataTransfer?.files ?? null);
  });
  return el;
}
