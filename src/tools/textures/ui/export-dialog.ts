// Export modal: summary -> progress (cancellable) -> download + install steps, with friendly errors.

import { h, formatBytes } from '../../../ui/dom';
import { icon } from '../../../ui/icons';
import { button, progressBar } from '../../../ui/components';
import { openModal } from '../../../ui/modal';
import { saveBlob } from '../../../core/download';
import { friendlyError, isAbortError } from '../../../core/net';
import { href } from '../../../core/router';
import { getJavaPackFormat } from '../../../editions/index';
import { formatPackFormat } from '../../../ui/format';
import { getEffect } from '../effects';
import { exportTexturePack, type ExportResult } from '../export';
import { packFileName } from '../project';
import { editedSoundStems } from '../sounds/pack';
import { plainText } from './mc-text';
import { paintCanvas } from './thumbs';
import type { TexStore } from './store';
import { packIconImage } from './icon';
import { matchingPreset } from './effects-panel';
import { fmt, fmtNodes } from '../../../i18n/editor-text';
import { te } from './i18n/editor';
import { versionLabel } from './start-screen';
import { projectsText } from '../../../shared/i18n/projects';
import { saveProjectFile } from '../../../shared/project-file/entry';

/**
 * export.ts yields with scheduler.yield(), and Chrome runs those continuations ahead of every other
 * queued task, so timers, toasts and even navigation (hashchange) wait until the whole export is
 * done. While exporting, hide scheduler.yield so the exporter uses its fair MessageChannel fallback.
 */
async function withFairYield<T>(fn: () => Promise<T>): Promise<T> {
  const sched = (globalThis as { scheduler?: object }).scheduler;
  let patched = false;
  if (sched && typeof (sched as { yield?: unknown }).yield === 'function') {
    try {
      Object.defineProperty(sched, 'yield', { value: undefined, configurable: true, writable: true });
      patched = true;
    } catch {
      /* read-only: keep the native one */
    }
  }
  try {
    return await fn();
  } finally {
    if (patched) delete (sched as { yield?: unknown }).yield;
  }
}

export function openExportDialog(store: TexStore): void {
  const project = store.project;
  const java = project.edition === 'java';
  let controller: AbortController | null = null;
  let result: ExportResult | null = null;
  let dismissed = false;
  const stop = () => {
    dismissed = true;
    controller?.abort();
  };

  const body = h('div', { class: 'tx-export' });
  const footer = h('div', { class: 'modal-footer tx-export-foot' });
  const modal = openModal({
    title: te.export.title,
    body,
    width: 560,
    class: 'tx-export-modal',
    onClose: stop,
  });
  modal.el.appendChild(footer);
  // The dialog finishes closing on a timer, and a running export can hold timers back until it ends.
  // Stop the export as soon as the dialog starts closing (Esc, close button, backdrop, navigation).
  const closing = new MutationObserver(() => {
    if (modal.el.classList.contains('closing') || !modal.el.isConnected) {
      closing.disconnect();
      stop();
    }
  });
  closing.observe(modal.el, { attributes: true, attributeFilter: ['class'] });
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
    title.textContent = te.export.title;
    const edited = store.editedCount();
    const fx = project.effects.filter((l) => l.enabled && getEffect(l.type));
    const preset = matchingPreset(project.effects);
    const target = h('span', null, versionLabel(project));
    if (java) {
      void getJavaPackFormat(project.version)
        .then((f) => {
          if (f) target.textContent = fmt(te.export.packFormat, { version: versionLabel(project), format: formatPackFormat(f) });
        })
        .catch(() => undefined);
    }
    const row = (ic: Parameters<typeof icon>[0], label: string, value: Node | string) =>
      h('div', { class: 'tx-exp-row' }, icon(ic), h('span', { class: 'tx-exp-k' }, label), h('span', { class: 'tx-exp-v' }, value));
    const sounds = editedSoundStems(project).size;
    const shapes = java ? Object.keys(project.customModels ?? {}).length : 0;
    const rows = [
      row('pencil', te.export.editedTextures, String(edited)),
      shapes ? row('shapes', te.export.customModels, String(shapes)) : null,
      sounds ? row('music', te.export.replacedSounds, String(sounds)) : null,
      row('sparkles', te.export.effects, fx.length ? (preset ? fmt(te.export.preset, { name: preset.label, count: fx.length }) : fx.map((l) => getEffect(l.type)!.label).slice(0, 3).join(te.effects.listSep) + (fx.length > 3 ? ` +${fx.length - 3}` : '')) : te.export.none),
      row(java ? 'laptop' : 'gamepad', te.export.madeFor, target),
      project.compat && java ? row('arrows-horizontal', te.export.alsoWorksIn, `${project.compat.minVersion} – ${project.compat.maxVersion}`) : null,
      row('grid', te.export.resolution, `${project.resolution}×`),
    ];
    const notes: Node[] = [];
    if (!edited && !fx.length && !Object.keys(project.extraFiles).length) {
      notes.push(h('p', { class: 'tx-inline-note warn' }, icon('warning-diamond'), te.export.unchanged));
    }
    if (fx.length && !java) {
      notes.push(h('p', { class: 'tx-inline-note' }, icon('info'), te.export.bedrockEffects));
    }
    body.replaceChildren(packHead(), h('div', { class: 'tx-exp-rows' }, rows), ...notes);
    footer.replaceChildren(
      // the whole project as a .tpmproject file (to keep editing it), next to the pack for the game
      button({ label: projectsText.save, icon: 'save', variant: 'ghost', class: 'tx-exp-file-btn', title: projectsText.saveTip, onClick: () => void saveProjectFile({ id: project.id, flush: () => store.flush() }) }),
      button({ label: te.export.cancel, variant: 'secondary', onClick: () => modal.close() }),
      button({ label: fmt(te.export.exportButton, { ext: java ? '.zip' : '.mcpack' }), icon: 'download', variant: 'primary', onClick: () => void run() }),
    );
    (footer.lastElementChild as HTMLElement).focus();
  }

  // ---------------------------------------------------------------- progress
  async function run() {
    title.textContent = te.export.building;
    controller = new AbortController();
    const bar = progressBar({ label: te.export.preparing });
    bar.set({ label: te.export.preparing, fraction: null });
    body.replaceChildren(packHead(), h('div', { class: 'tx-exp-progress' }, bar, h('p', { class: 'faint small' }, te.export.keepOpen)));
    const cancel = button({ label: te.export.cancel, variant: 'secondary', onClick: () => controller?.abort() });
    footer.replaceChildren(cancel);
    cancel.focus();
    const signal = controller.signal;
    try {
      await store.flush();
      if (signal.aborted) throw new DOMException('Export cancelled', 'AbortError');
      result = await withFairYield(() => exportTexturePack(project, store.assets, { signal, onProgress: (p) => bar.set(p) }));
      controller = null;
      // Bedrock exports bump the pack version: keep it
      store.touch('meta');
      void store.flush();
      if (dismissed) return;
      saveBlob(result.blob, result.filename);
      success(result);
    } catch (err) {
      controller = null;
      if (dismissed) return;
      if (isAbortError(err) || signal.aborted) {
        void summary();
        return;
      }
      console.error(err);
      failure(err);
    }
  }

  // ---------------------------------------------------------------- done
  function success(r: ExportResult) {
    title.textContent = te.export.ready;
    const x = te.export;
    const strong = (s: string) => h('strong', null, s);
    const file = () => h('code', null, r.filename);
    const steps = java
      ? [
          fmtNodes(x.javaStep1, { menu: strong(x.javaMenu) }),
          fmtNodes(x.javaStep2, { button: strong(x.javaFolder), file: file() }),
          fmtNodes(x.javaStep3, { selected: strong(x.javaSelected), done: strong(x.javaDone) }),
        ]
      : [fmtNodes(x.bedrockStep1, { file: file() }), fmtNodes(x.bedrockStep2, { menu: strong(x.bedrockMenu) }), fmtNodes(x.bedrockStep3, { activate: strong(x.bedrockActivate) })];
    const warnings = r.warnings.length
      ? h(
          'details',
          { class: 'tx-exp-warnings' },
          h('summary', null, icon('warning-diamond', { size: 16 }), fmt(te.export.notes, { count: r.warnings.length })),
          h('ul', null, r.warnings.map((w) => h('li', null, w))),
        )
      : null;
    body.replaceChildren(
      h(
        'div',
        { class: 'tx-exp-done' },
        h('div', { class: 'tx-exp-done-icon' }, icon('check', { size: 48 })),
        h('div', { class: 'stack', style: { '--gap': '4px', minWidth: '0' } }, h('strong', { class: 'truncate' }, r.filename), h('span', { class: 'faint small' }, fmt(te.export.fileInfo, { size: formatBytes(r.blob.size), count: r.fileCount }))),
        button({ icon: 'download', size: 'sm', variant: 'ghost', title: te.export.downloadAgain, onClick: () => saveBlob(r.blob, r.filename) }),
      ),
      ...(warnings ? [warnings] : []),
      h('h3', { class: 'section-title' }, icon('book-open'), te.export.howToInstall),
      h('ol', { class: 'tx-steps' }, steps.map((s) => h('li', null, s))),
      h('a', { class: 'tx-help-link', href: href(`/help#${java ? 'java-packs' : 'bedrock-packs'}`) }, icon('circle-question', { size: 16 }), te.export.moreHelp),
    );
    body.querySelector('.tx-help-link')?.addEventListener('click', () => modal.close());
    footer.replaceChildren(
      button({ label: te.export.again, icon: 'reload', variant: 'secondary', onClick: () => void summary() }),
      button({ label: te.export.done, variant: 'primary', onClick: () => modal.close() }),
    );
    (footer.lastElementChild as HTMLElement).focus();
  }

  function failure(err: unknown) {
    title.textContent = te.export.failed;
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
          h('p', { class: 'faint small' }, offline ? te.export.offline : te.export.saved),
        ),
      ),
    );
    footer.replaceChildren(
      button({ label: te.export.close, variant: 'secondary', onClick: () => modal.close() }),
      button({ label: te.export.tryAgain, icon: 'reload', variant: 'primary', onClick: () => void run() }),
    );
  }

  void summary();
}
