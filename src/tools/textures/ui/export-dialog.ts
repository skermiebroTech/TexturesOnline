// Export modal: summary -> progress (cancellable) -> download + install steps, with friendly errors.

import { h, formatBytes } from '../../../ui/dom';
import { icon } from '../../../ui/icons';
import { button, progressBar } from '../../../ui/components';
import { openModal } from '../../../ui/modal';
import { saveBlob } from '../../../core/download';
import { friendlyError, isAbortError } from '../../../core/net';
import { href } from '../../../core/router';
import { bedrockDisplayVersion, getJavaPackFormat } from '../../../editions/index';
import { formatPackFormat } from '../../../ui/format';
import { getEffect } from '../effects';
import { exportTexturePack, type ExportResult } from '../export';
import { packFileName } from '../project';
import { plainText } from './mc-text';
import { paintCanvas } from './thumbs';
import type { TexStore } from './store';
import { packIconImage } from './icon';
import { matchingPreset } from './effects-panel';

export function openExportDialog(store: TexStore): void {
  const project = store.project;
  const java = project.edition === 'java';
  let controller: AbortController | null = null;
  let result: ExportResult | null = null;

  const body = h('div', { class: 'tx-export' });
  const footer = h('div', { class: 'modal-footer tx-export-foot' });
  const modal = openModal({
    title: 'Export your pack',
    body,
    width: 560,
    class: 'tx-export-modal',
    onClose: () => controller?.abort(),
  });
  modal.el.appendChild(footer);
  const title = modal.el.querySelector('.modal-title') as HTMLElement;

  const iconCanvas = h('canvas', { class: 'tx-exp-icon pixelated' });
  void packIconImage(store).then(({ img }) => paintCanvas(iconCanvas, img));

  const packHead = () =>
    h(
      'div',
      { class: 'tx-exp-pack' },
      h('div', { class: 'tx-exp-iconbox checker' }, iconCanvas),
      h('div', { class: 'stack', style: { '--gap': '2px', minWidth: '0' } }, h('strong', { class: 'truncate' }, plainText(project.name)), h('span', { class: 'faint small truncate' }, packFileName(project))),
    );

  // ---------------------------------------------------------------- summary
  async function summary() {
    title.textContent = 'Export your pack';
    const edited = store.editedCount();
    const fx = project.effects.filter((l) => l.enabled && getEffect(l.type));
    const preset = matchingPreset(project.effects);
    const target = h('span', null, java ? `Java ${project.version}` : `Bedrock ${project.version === 'latest' ? 'latest' : bedrockDisplayVersion(project.version)}`);
    if (java) {
      void getJavaPackFormat(project.version)
        .then((f) => {
          if (f) target.textContent = `Java ${project.version} · pack format ${formatPackFormat(f)}`;
        })
        .catch(() => undefined);
    }
    const row = (ic: Parameters<typeof icon>[0], label: string, value: Node | string) =>
      h('div', { class: 'tx-exp-row' }, icon(ic), h('span', { class: 'tx-exp-k' }, label), h('span', { class: 'tx-exp-v' }, value));
    const rows = [
      row('pencil', 'Edited textures', String(edited)),
      row('sparkles', 'Effects', fx.length ? (preset ? `${preset.label} (${fx.length} effect${fx.length === 1 ? '' : 's'})` : fx.map((l) => getEffect(l.type)!.label).slice(0, 3).join(', ') + (fx.length > 3 ? ` +${fx.length - 3}` : '')) : 'None'),
      row(java ? 'laptop' : 'gamepad', 'Made for', target),
      project.compat && java ? row('arrows-horizontal', 'Also works in', `${project.compat.minVersion} – ${project.compat.maxVersion}`) : null,
      row('grid', 'Resolution', `${project.resolution}×`),
    ];
    const notes: Node[] = [];
    if (!edited && !fx.length && !Object.keys(project.extraFiles).length) {
      notes.push(h('p', { class: 'tx-inline-note warn' }, icon('warning-diamond'), 'Nothing is changed yet, so the pack would look like vanilla. Paint a texture or add an effect first — or export anyway.'));
    }
    if (fx.length && !java) {
      notes.push(h('p', { class: 'tx-inline-note' }, icon('info'), 'Effects re-colour every vanilla texture, so the first Bedrock export downloads them all. That can take a minute.'));
    }
    body.replaceChildren(packHead(), h('div', { class: 'tx-exp-rows' }, rows), ...notes);
    footer.replaceChildren(
      button({ label: 'Cancel', variant: 'secondary', onClick: () => modal.close() }),
      button({ label: `Export ${java ? '.zip' : '.mcpack'}`, icon: 'download', variant: 'primary', onClick: () => void run() }),
    );
    (footer.lastElementChild as HTMLElement).focus();
  }

  // ---------------------------------------------------------------- progress
  async function run() {
    title.textContent = 'Building your pack…';
    controller = new AbortController();
    const bar = progressBar({ label: 'Preparing…' });
    bar.set({ label: 'Preparing…', fraction: null });
    body.replaceChildren(packHead(), h('div', { class: 'tx-exp-progress' }, bar, h('p', { class: 'faint small' }, 'Keep this tab open. Everything happens on your device.')));
    const cancel = button({ label: 'Cancel', variant: 'secondary', onClick: () => controller?.abort() });
    footer.replaceChildren(cancel);
    cancel.focus();
    try {
      await store.flush();
      result = await exportTexturePack(project, store.assets, { signal: controller.signal, onProgress: (p) => bar.set(p) });
      controller = null;
      store.touch('meta');
      void store.flush();
      saveBlob(result.blob, result.filename);
      success(result);
    } catch (err) {
      controller = null;
      if (isAbortError(err)) {
        if (modal.el.isConnected) void summary();
        return;
      }
      console.error(err);
      failure(err);
    }
  }

  // ---------------------------------------------------------------- done
  function success(r: ExportResult) {
    title.textContent = 'Your pack is ready!';
    const steps = java
      ? [
          ['Open Minecraft Java Edition and go to ', h('strong', null, 'Options → Resource Packs'), '.'],
          ['Click ', h('strong', null, 'Open Pack Folder'), ' and drop ', h('code', null, r.filename), ' into it. Don’t unzip it.'],
          ['Back in the game, click the arrow on your pack to move it to ', h('strong', null, 'Selected'), ', then ', h('strong', null, 'Done'), '.'],
        ]
      : [
          ['Open ', h('code', null, r.filename), ' from your downloads. Minecraft starts and imports it.'],
          ['Go to ', h('strong', null, 'Settings → Global Resources → My Packs'), '.'],
          ['Select your pack and press ', h('strong', null, 'Activate'), '.'],
        ];
    const warnings = r.warnings.length
      ? h(
          'details',
          { class: 'tx-exp-warnings' },
          h('summary', null, icon('warning-diamond', { size: 16 }), `${r.warnings.length} note${r.warnings.length === 1 ? '' : 's'} about this export`),
          h('ul', null, r.warnings.map((w) => h('li', null, w))),
        )
      : null;
    body.replaceChildren(
      h(
        'div',
        { class: 'tx-exp-done' },
        h('div', { class: 'tx-exp-done-icon' }, icon('check', { size: 48 })),
        h('div', { class: 'stack', style: { '--gap': '4px', minWidth: '0' } }, h('strong', { class: 'truncate' }, r.filename), h('span', { class: 'faint small' }, `${formatBytes(r.blob.size)} · ${r.fileCount} files · downloading now`)),
        button({ icon: 'download', size: 'sm', variant: 'ghost', title: 'Download again', onClick: () => saveBlob(r.blob, r.filename) }),
      ),
      ...(warnings ? [warnings] : []),
      h('h3', { class: 'section-title' }, icon('book-open'), 'How to install'),
      h('ol', { class: 'tx-steps' }, steps.map((s) => h('li', null, s))),
      h('a', { class: 'tx-help-link', href: href(`/help?s=${java ? 'java-packs' : 'bedrock-packs'}`) }, icon('circle-question', { size: 16 }), 'More help with installing'),
    );
    body.querySelector('.tx-help-link')?.addEventListener('click', () => modal.close());
    footer.replaceChildren(
      button({ label: 'Export again', icon: 'reload', variant: 'secondary', onClick: () => void summary() }),
      button({ label: 'Done', variant: 'primary', onClick: () => modal.close() }),
    );
    (footer.lastElementChild as HTMLElement).focus();
  }

  function failure(err: unknown) {
    title.textContent = 'The export didn’t finish';
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    body.replaceChildren(
      h(
        'div',
        { class: 'tx-exp-fail' },
        h('div', { class: 'tx-exp-fail-icon' }, icon('warning-diamond', { size: 48 })),
        h(
          'div',
          { class: 'stack', style: { '--gap': '6px' } },
          h('p', null, friendlyError(err)),
          h('p', { class: 'faint small' }, offline ? 'You seem to be offline. Reconnect and try again.' : 'Your work is saved. You can try again right away.'),
        ),
      ),
    );
    footer.replaceChildren(
      button({ label: 'Close', variant: 'secondary', onClick: () => modal.close() }),
      button({ label: 'Try again', icon: 'reload', variant: 'primary', onClick: () => void run() }),
    );
  }

  void summary();
}
