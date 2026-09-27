// "Open a shader pack": reads the file, finds the packs inside, lets the user pick one when there
// are several, then either recreates a Shader Maker project (packs exported here carry
// texturepackmaker.json) or saves the pack as an imported project for the pack editor.

import { navigate } from '../../../core/router';
import { saveProject } from '../../../core/storage';
import { friendlyError } from '../../../core/net';
import { DEFAULT_JAVA_VERSION } from '../../../editions/index';
import { badge, button, progressBar } from '../../../ui/components';
import { formatBytes, h } from '../../../ui/dom';
import { fileMatchesAccept } from '../../../ui/dropzone';
import { icon, type IconName } from '../../../ui/icons';
import { openModal } from '../../../ui/modal';
import { toast } from '../../../ui/toast';
import { targetInfo } from '../targets';
import { normalizeSettings } from '../ui/generator';
import { newImportedProject, saveImportedFiles, sweepOrphanedPackFiles } from '../packedit/store';
import { baseName, findPacks, PACK_ACCEPT, PackImportError, type PackCandidate, type PackKind } from './detect';
import { packTexts, projectFromCandidate } from './restore';
import '../packedit/packedit.css';

/** Bigger archives are refused (a shader pack is a few MB; this is far above any real one). */
const MAX_FILE_BYTES = 768 * 1024 * 1024;

const KIND: Record<PackKind, { label: string; icon: IconName; tone: 'purple' | 'gold' | 'blue' }> = {
  iris: { label: 'Iris / OptiFine', icon: 'sparkles', tone: 'purple' },
  'java-vanilla': { label: 'Java resource pack', icon: 'sun', tone: 'gold' },
  bedrock: { label: 'Bedrock', icon: 'cloud-sun', tone: 'blue' },
};

// ---------------------------------------------------------------------------------------------
// Saving

/** Packs made with Texture Pack Maker become normal projects again (sliders, presets, preview). */
async function openAsProject(c: PackCandidate): Promise<string> {
  const info = targetInfo(c.metadata!.target);
  const gen = await info.load();
  const project = projectFromCandidate(c, {
    normalize: (v) => normalizeSettings(gen, v),
    presetIds: gen.PRESETS.map((p) => p.id),
    defaultVersion: info.defaultVersion,
  });
  await saveProject(project);
  return project.id;
}

async function openAsFiles(c: PackCandidate): Promise<string> {
  const texts = c.kind === 'iris' ? { name: c.name, description: '' } : packTexts({ ...c, metadata: null });
  // Iris shows the zip name in its pack list, so the edited copy gets its own name
  const base = c.kind === 'java-vanilla' ? baseName(c.fileName) : c.name;
  const name = c.kind === 'bedrock' ? texts.name || c.name : /\(edited\)$/i.test(base) ? base : `${base} (edited)`;
  const project = newImportedProject({
    kind: c.kind,
    name,
    description: texts.description,
    sourceName: c.fileName,
    fileCount: Object.keys(c.files).length,
    byteSize: c.byteSize,
    version: c.kind === 'bedrock' ? 'latest' : DEFAULT_JAVA_VERSION,
  });
  // files first: a project without files would open in the "files missing" state
  await saveImportedFiles(project, c.files);
  await saveProject(project);
  return project.id;
}

// ---------------------------------------------------------------------------------------------
// Dialog

export function openPackFile(file: File): void {
  let cancelled = false;
  const body = h('div', { class: 'sh-export pe-import' });
  const modal = openModal({
    title: 'Open a shader pack',
    body,
    width: 620,
    class: 'sh-export-modal pe-import-modal',
    onClose: () => (cancelled = true),
  });
  const footer = (...nodes: Node[]) => h('div', { class: 'sh-export-footer' }, nodes);
  const bar = progressBar({ label: 'Reading' });

  function renderBusy(label: string, fraction: number | null): void {
    if (!body.querySelector('.progress')) {
      body.replaceChildren(
        h(
          'div',
          { class: 'sh-export-head' },
          h('span', { class: 'sh-export-icon is-busy' }, icon('package')),
          h('div', null, h('h3', { class: 'truncate' }, file.name), h('p', { class: 'muted' }, `${formatBytes(file.size)} · read on your device, nothing is uploaded`)),
        ),
        bar,
        footer(button({ label: 'Cancel', variant: 'ghost', onClick: () => modal.close() })),
      );
    }
    bar.set({ label, fraction });
  }

  function renderError(message: string): void {
    const input = h('input', { type: 'file', accept: PACK_ACCEPT, class: 'sr-only', 'aria-label': 'Choose another pack file' });
    input.addEventListener('change', () => {
      const f = input.files?.[0];
      if (!f) return;
      modal.close();
      openPackFile(f);
    });
    body.replaceChildren(
      h(
        'div',
        { class: 'sh-export-head is-error' },
        h('span', { class: 'sh-export-icon' }, icon('warning')),
        h('div', null, h('h3', null, "This file can't be opened here"), h('p', { class: 'sh-export-msg' }, message)),
      ),
      input,
      footer(button({ label: 'Close', variant: 'ghost', onClick: () => modal.close() }), button({ label: 'Choose another file', icon: 'folder', variant: 'primary', onClick: () => input.click() })),
    );
  }

  function renderTexturePack(c: PackCandidate): void {
    body.replaceChildren(
      h(
        'div',
        { class: 'sh-export-head' },
        h('span', { class: 'sh-export-icon' }, icon('blocks')),
        h(
          'div',
          null,
          h('h3', null, 'This is a texture pack'),
          h('p', { class: 'sh-export-msg' }, `“${c.name}” is a Java resource pack without shaders. The Texture Pack Maker is made for editing its textures.`),
        ),
      ),
      footer(
        button({ label: 'Edit files here', icon: 'file-text', variant: 'ghost', onClick: () => void finish(c, true) }),
        button({
          label: 'Texture Pack Maker',
          iconEnd: 'arrow-right',
          variant: 'primary',
          onClick: () => {
            modal.close();
            navigate('/textures');
          },
        }),
      ),
    );
  }

  function renderPicker(list: PackCandidate[]): void {
    const rows = list.map((c) => {
      const k = KIND[c.kind];
      const b = h(
        'button',
        { type: 'button', class: 'pe-pick', dataset: { candidate: c.id } },
        h('span', { class: 'pe-pick-icon' }, icon(k.icon)),
        h(
          'span',
          { class: 'pe-pick-text' },
          h('span', { class: 'pe-pick-name truncate' }, c.name),
          h('span', { class: 'pe-pick-meta truncate' }, [c.location || 'Top of the archive', `${Object.keys(c.files).length} files`, formatBytes(c.byteSize)].join(' · ')),
          h(
            'span',
            { class: 'pe-pick-badges' },
            badge(k.label, k.tone),
            c.note ? badge(c.note, 'gray') : null,
            c.metadata ? badge('Made with Texture Pack Maker', 'green') : null,
            c.kind === 'java-vanilla' && !c.hasShaders ? badge('No shaders', 'gray') : null,
          ),
        ),
        icon('arrow-right', { class: 'pe-pick-go' }),
      );
      b.addEventListener('click', () => void choose(c));
      return b;
    });
    body.replaceChildren(
      h('p', { class: 'muted' }, `“${file.name}” holds ${list.length} packs. Which one do you want to open?`),
      h('div', { class: 'pe-pick-list' }, rows),
      footer(button({ label: 'Cancel', variant: 'ghost', onClick: () => modal.close() })),
    );
    rows[0]?.focus();
  }

  async function choose(c: PackCandidate): Promise<void> {
    if (c.kind === 'java-vanilla' && !c.hasShaders && !c.metadata) {
      renderTexturePack(c);
      return;
    }
    await finish(c, false);
  }

  async function finish(c: PackCandidate, forceFiles: boolean): Promise<void> {
    renderBusy('Saving to this browser', 0.9);
    try {
      const asProject = Boolean(c.metadata) && !forceFiles;
      const id = asProject ? await openAsProject(c) : await openAsFiles(c);
      if (cancelled) return;
      modal.close();
      navigate(`/shaders/${id}`);
      if (asProject) {
        toast(`Opened “${packTexts(c).name}” with all its settings`, {
          tone: 'success',
          action: {
            label: 'Edit files instead',
            onClick: () =>
              void openAsFiles(c)
                .then((fid) => navigate(`/shaders/${fid}`))
                .catch((err) => toast(friendlyError(err, "Couldn't open the files"), { tone: 'error' })),
          },
        });
      } else {
        const n = Object.keys(c.files).length;
        toast(`Opened “${c.name}” (${n} file${n === 1 ? '' : 's'})`, { tone: 'success' });
      }
      sweepOrphanedPackFiles();
    } catch (err) {
      if (cancelled) return;
      console.error(err);
      renderError(friendlyError(err, "The pack couldn't be saved"));
    }
  }

  async function run(): Promise<void> {
    if (!fileMatchesAccept(file, PACK_ACCEPT)) {
      renderError(`“${file.name}” isn't a pack file. Open a .zip shader pack or resource pack, or a Bedrock .mcpack.`);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      renderError(`“${file.name}” is ${formatBytes(file.size)}, which is too big for a pack to open here.`);
      return;
    }
    renderBusy('Reading the file', 0.1);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (cancelled) return;
      renderBusy('Unpacking', 0.35);
      const list = await findPacks(bytes, file.name, (label) => {
        if (!cancelled) renderBusy(label, 0.6);
      });
      if (cancelled) return;
      renderBusy('Looking at the files', 0.8);
      if (list.length > 1) renderPicker(list);
      else await choose(list[0]);
    } catch (err) {
      if (cancelled) return;
      renderError(err instanceof PackImportError ? err.message : friendlyError(err, "The file couldn't be read"));
    }
  }

  void run();
}
