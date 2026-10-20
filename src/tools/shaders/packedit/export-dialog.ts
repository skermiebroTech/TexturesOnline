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
import { pt } from './i18n/text';
import { kit } from '../../../ui/i18n/kit';
import { fmt } from '../../../i18n/editor-text';

export function licenseNote(): HTMLElement {
  return h(
    'p',
    { class: 'pe-license' },
    icon('info'),
    h('span', null, pt.exportDialog.license),
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
  const modal = openModal({ title: fmt(pt.exportDialog.title, { name: project.name }), body, width: 620, class: 'sh-export-modal' });
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
          changed.length ? fmt(pt.exportDialog.optionsChanged, { count: changed.length, n: String(changed.length) }) : pt.exportDialog.noOptions,
          changed.length ? pt.exportDialog.optionsSub : undefined,
        ),
      );
    }
    rows.push(summaryRow('file-text', edited.length ? fmt(pt.exportDialog.editedFiles, { count: edited.length, n: String(edited.length) }) : pt.exportDialog.noFiles));
    if (project.packFormat === 'bedrock') rows.push(summaryRow('package', pt.exportDialog.version, pt.exportDialog.versionSub));

    const txtToggle =
      model && changed.length
        ? toggle({
            label: pt.exportDialog.alsoTxt,
            value: alsoTxt,
            description: fmt(pt.exportDialog.txtHint, { txt: txtName, file: project.sourceName }),
            onChange: (v) => (alsoTxt = v),
          })
        : null;

    const exportBtn = button({ label: fmt(pt.exportExt, { ext: filename.endsWith('.mcpack') ? '.mcpack' : '.zip' }), icon: 'download', variant: 'primary', onClick: () => void run() });
    const txtOnly =
      model && changed.length
        ? button({
            label: pt.exportDialog.txtOnly,
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
        h('span', { class: 'faint small' }, fmt(pt.exportDialog.files, { count: String(ws.paths.length) })),
      ),
      h('ul', { class: 'pe-export-summary' }, rows),
      ...(txtToggle ? [h('div', { class: 'pe-export-toggle' }, txtToggle)] : []),
      licenseNote(),
      footer(button({ label: kit.cancel, variant: 'ghost', onClick: () => modal.close() }), ...(txtOnly ? [txtOnly] : []), exportBtn),
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
          h('h3', null, pt.exportDialog.txtDone),
          h('p', { class: 'muted' }, fmt(pt.exportDialog.txtMove, { txt: txtName, file: project.sourceName })),
        ),
      ),
      h('p', { class: 'muted small' }, pt.exportDialog.txtReload),
      footer(button({ label: pt.exportDialog.done, variant: 'primary', onClick: () => modal.close() })),
    );
  }

  async function run(): Promise<void> {
    const bar = progressBar({ label: pt.exportDialog.preparing });
    bar.set({ label: pt.exportDialog.writing, fraction: null });
    body.replaceChildren(
      h('div', { class: 'sh-export-head' }, h('span', { class: 'sh-export-icon is-busy' }, icon('package')), h('div', null, h('h3', null, pt.exportDialog.building), h('p', { class: 'muted' }, fmt(pt.exportDialog.buildingText, { count: String(ws.paths.length) })))),
      bar,
    );
    try {
      await new Promise((r) => setTimeout(r, 30));
      const build = ws.buildExport({ iris: model ? { set: model.set, values: opts.values } : undefined, bedrockAtLeast: project.packVersion });
      bar.set({ label: project.packFormat === 'bedrock' ? pt.exportDialog.packaging : pt.exportDialog.zipping, fraction: null });
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
          h('div', null, h('h3', null, pt.exportDialog.failedTitle), h('p', { class: 'sh-export-msg' }, friendlyError(err, pt.exportDialog.failed))),
        ),
        footer(button({ label: kit.close, variant: 'ghost', onClick: () => modal.close() }), button({ label: kit.tryAgain, icon: 'reload', variant: 'primary', onClick: () => void run() })),
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
                h('li', null, h('span', null, pt.exportDialog.bedrockOpen)),
                h('li', null, h('span', null, pt.exportDialog.bedrockOn)),
              ),
            ];
    const done = button({ label: pt.exportDialog.done, variant: 'primary', onClick: () => modal.close() });
    body.replaceChildren(
      h(
        'div',
        { class: 'sh-export-head is-success' },
        h('span', { class: 'sh-export-icon' }, icon('check')),
        h('div', null, h('h3', null, pt.exportDialog.ready), h('p', { class: 'muted' }, alsoTxt ? pt.exportDialog.bothDownloaded : pt.exportDialog.downloaded)),
      ),
      h(
        'div',
        { class: 'sh-export-file' },
        icon(filename.endsWith('.mcpack') ? 'package' : 'archive'),
        h('span', { class: 'sh-export-file-name truncate' }, filename),
        h('span', { class: 'faint small' }, `${version ? `v${version.join('.')} · ` : ''}${formatBytes(blob.size)}`),
      ),
      ...(warnings.length
        ? [h('div', { class: 'sh-export-warnings' }, h('div', { class: 'sh-export-warnings-title' }, icon('warning'), h('span', null, pt.exportDialog.goodToKnow)), h('ul', null, warnings.map((w) => h('li', null, w))))]
        : []),
      h('h4', { class: 'section-title' }, icon('book-open'), pt.exportDialog.howToInstall),
      ...where,
      footer(
        button({ label: pt.exportDialog.downloadAgain, icon: 'download', onClick: () => lastBlob && saveBlob(lastBlob, filename) }),
        done,
      ),
    );
    done.focus({ preventScroll: true });
  }

  renderStart();
}
