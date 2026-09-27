// Shader Maker start screen: the "Open a shader pack" card and drag-and-drop of a pack anywhere on
// the page. The import code itself loads on first use.

import { h } from '../../../ui/dom';
import { dropzone, fileMatchesAccept } from '../../../ui/dropzone';
import { icon } from '../../../ui/icons';
import { toast } from '../../../ui/toast';
import { PACK_ACCEPT } from './accept';
import '../packedit/packedit.css';

export function openPackFile(file: File): void {
  void import('./import-flow')
    .then((m) => m.openPackFile(file))
    .catch((err) => {
      console.error(err);
      toast("The pack opener couldn't load. Check your connection and try again.", { tone: 'error' });
    });
}

export function openPackSection(): HTMLElement {
  const dz = dropzone({
    accept: PACK_ACCEPT,
    label: 'Drop a pack here or click to choose',
    hint: '.zip or .mcpack · it stays on your device',
    icon: 'folder',
    onFiles: (files) => {
      if (files[0]) openPackFile(files[0]);
    },
  });
  dz.classList.add('pe-open-drop');
  const kinds = [
    { icon: 'sparkles' as const, text: 'Iris / OptiFine shader packs', sub: 'Change their options with sliders' },
    { icon: 'sun' as const, text: 'Vanilla shader resource packs', sub: 'Edit the shader files' },
    { icon: 'cloud-sun' as const, text: 'Bedrock packs (.mcpack)', sub: 'Edit the JSON settings' },
  ];
  return h(
    'section',
    { class: 'container pe-open', 'aria-labelledby': 'pe-open-title' },
    h(
      'div',
      { class: 'pe-open-card' },
      h(
        'div',
        { class: 'pe-open-text' },
        h('span', { class: 'eyebrow' }, icon('folder'), 'Already have a pack?'),
        h('h2', { id: 'pe-open-title' }, 'Open a shader pack'),
        h('p', { class: 'muted' }, 'Edit a pack you downloaded or made here before. Packs exported from the Shader Maker open with all their settings.'),
        h(
          'ul',
          { class: 'pe-open-kinds' },
          kinds.map((k) => h('li', null, icon(k.icon), h('span', null, h('span', { class: 'pe-open-kind' }, k.text), h('span', { class: 'faint small' }, k.sub)))),
        ),
      ),
      h('div', { class: 'pe-open-zone' }, dz, h('p', { class: 'pe-open-note faint small' }, icon('info'), h('span', null, 'Packs by other people have their own licenses. Edited copies are for your own use unless the license allows sharing.'))),
    ),
  );
}

/** Lets the user drop a pack file anywhere on `target`. Returns a remover. */
export function enablePageDrop(target: HTMLElement): () => void {
  const overlay = h(
    'div',
    { class: 'pe-drop-overlay', hidden: true, 'aria-hidden': 'true' },
    h('div', { class: 'pe-drop-box' }, icon('folder', { size: 48 }), h('strong', null, 'Drop to open this pack'), h('span', { class: 'muted' }, '.zip or .mcpack')),
  );
  document.body.appendChild(overlay);
  let depth = 0;
  const hasFiles = (e: DragEvent) => Boolean(e.dataTransfer?.types.includes('Files'));
  const onEnter = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth++;
    overlay.hidden = false;
  };
  const onOver = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  };
  const onLeave = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    depth = Math.max(0, depth - 1);
    if (depth === 0) overlay.hidden = true;
  };
  const onDrop = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    depth = 0;
    overlay.hidden = true;
    // the card's own drop zone handles drops on itself
    if ((e.target as HTMLElement | null)?.closest?.('.pe-open-drop')) return;
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files ?? []);
    const file = files.find((f) => fileMatchesAccept(f, PACK_ACCEPT));
    if (!file) {
      if (files.length) toast(`“${files[0].name}” isn't a pack. Drop a .zip shader pack or a .mcpack file.`, { tone: 'warn' });
      return;
    }
    openPackFile(file);
  };
  target.addEventListener('dragenter', onEnter);
  target.addEventListener('dragover', onOver);
  target.addEventListener('dragleave', onLeave);
  target.addEventListener('drop', onDrop);
  return () => {
    target.removeEventListener('dragenter', onEnter);
    target.removeEventListener('dragover', onOver);
    target.removeEventListener('dragleave', onLeave);
    target.removeEventListener('drop', onDrop);
    overlay.remove();
  };
}
