// Export dialog of the pack editor: summary of what changes, an optional settings .txt for the
// original pack (Iris / OptiFine), the licence reminder, then build + zip + download.

import { saveBlob, saveText, sanitizeFilename } from '../../../core/download';
import { friendlyError } from '../../../core/net';
import { button, progressBar, toggle } from '../../../ui/components';
import { formatBytes, h } from '../../../ui/dom';
import { icon } from '../../../ui/icons';
import { openModal } from '../../../ui/modal';
import { targetInfo } from '../targets';
import { helpLink, installSteps } from '../ui/install';
import { zipPack } from '../ui/pack-zip';
import type { ChosenValues } from './iris-rewrite';
import type { Semver } from './json-tools';
import type { ImportedPackProject } from './store';
import type { IrisModel, PackWorkspace } from './workspace';

export function licenseNote(): HTMLElement {
  return h(
    'p',
    { class: 'pe-license' },
    icon('info'),
    h(
      'span',
      null,
      'Shader packs made by other people have their own licenses. Keep edited copies for your own use unless the pack’s license allows sharing them.',
    ),
  );
}

export function exportFileName(p: ImportedPackProject): string {
  const base = sanitizeFilename(p.name.trim() || 'Shader pack', 'Shader pack').replace(/\.(zip|mcpack)$/i, '');
  return `${base}${p.packFormat === 'bedrock' ? '.mcpack' : '.zip'}`;
}

export function settingsFileName(p: ImportedPackProject): string {
  return `${p.sourceName.replace(/[\\/]/g, '_')}.txt`;
}

export function openPackExportDialog(opts: {
  project: ImportedPackProject;
  ws: PackWorkspace;
  model: IrisModel | null;
  values: ChosenValues;
  onExported: (update: { packVersion?: Semver }) => void;
}): void {
  const { project, ws, model } = opts;
  const changed = model ? Object.keys(opts.values).filter((k) => model.set.options.get(k) && opts.values[k] !== model.set.options.get(k)!.defaultValue) : [];
  const edited = ws.editedPaths();
  const filename = exportFileName(project);
  const txtName = settingsFileName(project);
  let alsoTxt = false;
  let lastBlob: Blob | null = null;

  const body = h('div', { class: 'sh-export pe-export' });
  const modal = openModal({ title: `Export “${project.name}”`, body, width: 620, class: 'sh-export-modal' });
  const footer = (...nodes: Node[]) => h('div', { class: 'sh-export-footer' }, nodes);

  function summaryRow(ic: Parameters<typeof icon>[0], text: string, sub?: string): HTMLElement {
    return h('li', null, icon(ic), h('span', null, h('span', null, text), sub ? h('span', { class: 'faint small pe-export-sub' }, sub) : null));
  }

  function renderStart(): void {
    const rows: HTMLElement[] = [];
    if (model) {
      rows.push(
        summaryRow(
          'sliders',
          changed.length ? `${changed.length} option${changed.length === 1 ? '' : 's'} become the pack’s new defaults` : 'No options changed',
          changed.length ? 'Only the value on each option’s own line changes. Everything else stays byte for byte the same.' : undefined,
        ),
      );
    }
    rows.push(summaryRow('file-text', edited.length ? `${edited.length} edited file${edited.length === 1 ? '' : 's'}` : 'No files edited'));
    if (project.packFormat === 'bedrock') rows.push(summaryRow('package', 'The pack version goes up by one', 'The pack keeps its uuids, so Minecraft replaces the copy you already have.'));

    const txtToggle =
      model && changed.length
        ? toggle({
            label: 'Also download a settings file',
            value: alsoTxt,
            description: `${txtName}: put it next to ${project.sourceName} in your shaderpacks folder to use the same options with the original, untouched pack.`,
            onChange: (v) => (alsoTxt = v),
          })
        : null;

    const exportBtn = button({ label: `Export ${filename.endsWith('.mcpack') ? '.mcpack' : '.zip'}`, icon: 'download', variant: 'primary', onClick: () => void run() });
    const txtOnly =
      model && changed.length
        ? button({
            label: 'Settings file only',
            icon: 'file-text',
            variant: 'ghost',
            onClick: () => {
              saveText(ws.settingsFile(model.set, opts.values, project.sourceName), txtName);
              renderTxtDone();
            },
          })
        : null;
    body.replaceChildren(
      h(
        'div',
        { class: 'sh-export-file' },
        icon(filename.endsWith('.mcpack') ? 'package' : 'archive'),
        h('span', { class: 'sh-export-file-name truncate' }, filename),
        h('span', { class: 'faint small' }, `${ws.paths.length} files`),
      ),
      h('ul', { class: 'pe-export-summary' }, rows),
      ...(txtToggle ? [h('div', { class: 'pe-export-toggle' }, txtToggle)] : []),
      licenseNote(),
      footer(button({ label: 'Cancel', variant: 'ghost', onClick: () => modal.close() }), ...(txtOnly ? [txtOnly] : []), exportBtn),
    );
    exportBtn.focus({ preventScroll: true });
  }

  function renderTxtDone(): void {
    body.replaceChildren(
      h(
        'div',
        { class: 'sh-export-head is-success' },
        h('span', { class: 'sh-export-icon' }, icon('check')),
        h(
          'div',
          null,
          h('h3', null, 'Settings file downloaded'),
          h('p', { class: 'muted' }, `Move ${txtName} into .minecraft/shaderpacks, next to ${project.sourceName}. The game reads it when you select the pack.`),
        ),
      ),
      h('p', { class: 'muted small' }, 'If the game is running, pick another shader pack and then this one again so it reloads the settings.'),
      footer(button({ label: 'Done', variant: 'primary', onClick: () => modal.close() })),
    );
  }

  async function run(): Promise<void> {
    const bar = progressBar({ label: 'Preparing' });
    bar.set({ label: 'Writing your changes', fraction: null });
    body.replaceChildren(
      h('div', { class: 'sh-export-head' }, h('span', { class: 'sh-export-icon is-busy' }, icon('package')), h('div', null, h('h3', null, 'Building your pack'), h('p', { class: 'muted' }, `${ws.paths.length} files. Everything happens in your browser.`))),
      bar,
    );
    try {
      await new Promise((r) => setTimeout(r, 30));
      const build = ws.buildExport({ iris: model ? { set: model.set, values: opts.values } : undefined, bedrockAtLeast: project.packVersion });
      bar.set({ label: project.packFormat === 'bedrock' ? 'Packaging the .mcpack' : 'Zipping', fraction: null });
      const blob = await zipPack(build.files, project.packFormat === 'bedrock' ? 'application/octet-stream' : 'application/zip');
      lastBlob = blob;
      saveBlob(blob, filename);
      if (alsoTxt && model) saveText(ws.settingsFile(model.set, opts.values, project.sourceName), txtName);
      opts.onExported({ packVersion: build.version });
      renderDone(blob, build.warnings, build.version);
    } catch (err) {
      console.error(err);
      body.replaceChildren(
        h(
          'div',
          { class: 'sh-export-head is-error' },
          h('span', { class: 'sh-export-icon' }, icon('error')),
          h('div', null, h('h3', null, 'Export failed'), h('p', { class: 'sh-export-msg' }, friendlyError(err, "The pack couldn't be exported"))),
        ),
        footer(button({ label: 'Close', variant: 'ghost', onClick: () => modal.close() }), button({ label: 'Try again', icon: 'reload', variant: 'primary', onClick: () => void run() })),
      );
    }
  }

  function renderDone(blob: Blob, warnings: string[], version?: Semver): void {
    const where =
      project.packFormat === 'iris'
        ? [installSteps(targetInfo('iris'), { compact: true }), helpLink(targetInfo('iris'))]
        : project.packFormat === 'java-vanilla'
          ? [installSteps(targetInfo('java-vanilla'), { compact: true }), helpLink(targetInfo('java-vanilla'))]
          : [
              h(
                'ol',
                { class: 'sh-steps is-compact' },
                h('li', null, h('span', null, 'Open the .mcpack file. Minecraft imports it for you.')),
                h('li', null, h('span', null, 'Turn it on in Settings > Global Resources (resource packs) or in the world’s settings (behavior packs).')),
              ),
            ];
    const done = button({ label: 'Done', variant: 'primary', onClick: () => modal.close() });
    body.replaceChildren(
      h(
        'div',
        { class: 'sh-export-head is-success' },
        h('span', { class: 'sh-export-icon' }, icon('check')),
        h('div', null, h('h3', null, 'Your pack is ready!'), h('p', { class: 'muted' }, alsoTxt ? 'The pack and its settings file were downloaded.' : 'It was downloaded to your Downloads folder.')),
      ),
      h(
        'div',
        { class: 'sh-export-file' },
        icon(filename.endsWith('.mcpack') ? 'package' : 'archive'),
        h('span', { class: 'sh-export-file-name truncate' }, filename),
        h('span', { class: 'faint small' }, `${version ? `v${version.join('.')} · ` : ''}${formatBytes(blob.size)}`),
      ),
      ...(warnings.length
        ? [h('div', { class: 'sh-export-warnings' }, h('div', { class: 'sh-export-warnings-title' }, icon('warning'), h('span', null, 'Good to know')), h('ul', null, warnings.map((w) => h('li', null, w))))]
        : []),
      h('h4', { class: 'section-title' }, icon('book-open'), 'How to install'),
      ...where,
      footer(
        button({ label: 'Download again', icon: 'download', onClick: () => lastBlob && saveBlob(lastBlob, filename) }),
        done,
      ),
    );
    done.focus({ preventScroll: true });
  }

  renderStart();
}
