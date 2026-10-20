// Export dialog: a step checklist with progress while the pack is built, friendly errors with
// retry, and a success screen with install steps.

import { saveBlob } from '../../../core/download';
import { friendlyError, isAbortError } from '../../../core/net';
import type { OptionValues } from '../../../core/types';
import { button, progressBar } from '../../../ui/components';
import { formatBytes, h } from '../../../ui/dom';
import { icon } from '../../../ui/icons';
import { openModal } from '../../../ui/modal';
import type { ShaderTargetInfo } from '../targets';
import { BuildError, buildPackFiles, buildSteps, type BuildResult } from '../build';
import { helpLink, installSteps } from './install';
import { zipPack } from './pack-zip';
import type { ShaderProjectData } from './project';
import { et } from './i18n/editor';
import { t } from '../i18n/text';
import { kit } from '../../../ui/i18n/kit';
import { fmt, fmtNodes } from '../../../i18n/editor-text';

export function openExportDialog(opts: {
  project: ShaderProjectData;
  target: ShaderTargetInfo;
  settings: () => OptionValues;
  packIcon: (size: number) => Promise<Uint8Array>;
  onExported: (update: Partial<ShaderProjectData>) => void;
}): { close(): void } {
  const { project, target } = opts;
  let ctrl: AbortController | null = null;
  let lastBlob: { blob: Blob; name: string } | null = null;
  const body = h('div', { class: 'sh-export' });
  const modal = openModal({
    title: fmt(et.exportDialog.title, { name: project.name.trim() || t.myShaders }),
    body,
    width: 600,
    class: 'sh-export-modal',
    onClose: () => ctrl?.abort(),
  });

  const footer = (...nodes: Node[]) => h('div', { class: 'sh-export-footer' }, nodes);

  function renderBuilding(): { mark(id: string): void; bar: ReturnType<typeof progressBar>; done(): void } {
    const steps = buildSteps(project.target, project.version);
    const items = new Map<string, HTMLElement>();
    const list = h(
      'ol',
      { class: 'sh-export-steps' },
      steps.map((s) => {
        const li = h('li', { class: 'sh-export-step', dataset: { step: s.id } }, h('span', { class: 'sh-step-dot', 'aria-hidden': 'true' }), h('span', null, s.label));
        items.set(s.id, li);
        return li;
      }),
    );
    const bar = progressBar({ label: et.exportDialog.starting });
    bar.set({ label: et.exportDialog.starting, fraction: null });
    const cancel = button({ label: kit.cancel, variant: 'ghost', onClick: () => modal.close() });
    body.replaceChildren(
      h('div', { class: 'sh-export-head' }, h('span', { class: 'sh-export-icon is-busy' }, icon('package')), h('div', null, h('h3', null, et.exportDialog.building), h('p', { class: 'muted' }, et.exportDialog.buildingText))),
      list,
      bar,
      footer(cancel),
    );
    let reached = -1;
    return {
      bar,
      mark(id: string) {
        const idx = steps.findIndex((s) => s.id === id);
        if (idx < 0) return;
        reached = Math.max(reached, idx);
        steps.forEach((s, i) => {
          const li = items.get(s.id)!;
          li.classList.toggle('is-done', i < reached);
          li.classList.toggle('is-active', i === reached);
          li.querySelector('.sh-step-dot')!.replaceChildren(i < reached ? icon('check') : i === reached ? icon('loader') : '');
        });
        bar.set({ label: steps[idx].label, fraction: null });
      },
      done() {
        steps.forEach((s) => {
          const li = items.get(s.id)!;
          li.classList.add('is-done');
          li.classList.remove('is-active');
          li.querySelector('.sh-step-dot')!.replaceChildren(icon('check'));
        });
      },
    };
  }

  function renderError(err: unknown): void {
    const msg = err instanceof BuildError ? err.message : friendlyError(err, et.exportDialog.failed);
    const kind = err instanceof BuildError ? err.kind : 'other';
    const actions: Node[] = [button({ label: kit.close, variant: 'ghost', onClick: () => modal.close() })];
    if (kind !== 'unsupported') actions.push(button({ label: kit.tryAgain, icon: 'reload', variant: 'primary', onClick: () => void run() }));
    const extra: Node[] = [];
    if (kind === 'assets' && target.id === 'java-vanilla') {
      const input = h('input', { type: 'file', accept: '.jar', class: 'sr-only', 'aria-label': et.exportDialog.chooseJar });
      input.addEventListener('change', () => {
        const f = input.files?.[0];
        if (f) void run(f);
      });
      const pick = button({ label: et.exportDialog.ownJar, icon: 'folder', onClick: () => input.click() });
      extra.push(
        h(
          'div',
          { class: 'sh-export-jar' },
          h('p', { class: 'muted small' }, fmtNodes(et.exportDialog.offline, { path: h('code', null, `.minecraft/versions/${project.version}/${project.version}.jar`) })),
          pick,
          input,
        ),
      );
    }
    body.replaceChildren(
      h(
        'div',
        { class: 'sh-export-head is-error' },
        h('span', { class: 'sh-export-icon' }, icon(kind === 'unsupported' ? 'warning' : 'error')),
        h('div', null, h('h3', null, kind === 'unsupported' ? et.exportDialog.cantUse : et.exportDialog.exportFailed), h('p', { class: 'sh-export-msg' }, msg)),
      ),
      ...extra,
      footer(...actions),
    );
  }

  function renderSuccess(res: BuildResult, blob: Blob): void {
    const warn = res.warnings.length
      ? h(
          'div',
          { class: 'sh-export-warnings' },
          h('div', { class: 'sh-export-warnings-title' }, icon('warning'), h('span', null, et.exportDialog.goodToKnow)),
          h('ul', null, res.warnings.map((w) => h('li', null, w))),
        )
      : null;
    const again = button({ label: et.exportDialog.again, icon: 'reload', variant: 'ghost', onClick: () => void run() });
    const download = button({
      label: et.exportDialog.downloadAgain,
      icon: 'download',
      onClick: () => {
        if (lastBlob) saveBlob(lastBlob.blob, lastBlob.name);
      },
    });
    const done = button({ label: et.exportDialog.done, variant: 'primary', onClick: () => modal.close() });
    body.replaceChildren(
      h(
        'div',
        { class: 'sh-export-head is-success' },
        h('span', { class: 'sh-export-icon' }, icon('check')),
        h('div', null, h('h3', null, et.exportDialog.ready), h('p', { class: 'muted' }, et.exportDialog.downloaded)),
      ),
      h(
        'div',
        { class: 'sh-export-file' },
        icon(target.fileExt === '.mcpack' ? 'package' : 'archive'),
        h('span', { class: 'sh-export-file-name truncate' }, res.filename),
        h('span', { class: 'faint small' }, formatBytes(blob.size)),
      ),
      ...(warn ? [warn] : []),
      h('h4', { class: 'section-title' }, icon('book-open'), et.exportDialog.howToInstall),
      installSteps(target),
      helpLink(target),
      footer(again, download, done),
    );
    done.focus({ preventScroll: true });
    body.closest('.modal-body')?.scrollTo(0, 0);
  }

  async function run(jarFile?: File): Promise<void> {
    ctrl?.abort();
    const my = new AbortController();
    ctrl = my;
    const ui = renderBuilding();
    try {
      const res = await buildPackFiles({
        project,
        settings: opts.settings(),
        signal: my.signal,
        jarFile,
        step: (s) => ui.mark(s.id),
        progress: (p) => {
          if (p && !my.signal.aborted) ui.bar.set(p);
        },
        packIcon: opts.packIcon,
      });
      if (my.signal.aborted) return;
      ui.mark('zip');
      ui.bar.set({ label: target.fileExt === '.mcpack' ? et.exportDialog.packaging : et.exportDialog.zipping, fraction: null });
      const blob = await zipPack(res.files, target.fileExt === '.mcpack' ? 'application/octet-stream' : 'application/zip');
      if (my.signal.aborted) return;
      ui.done();
      lastBlob = { blob, name: res.filename };
      saveBlob(blob, res.filename);
      opts.onExported({ ...(res.update ?? {}), lastExportAt: Date.now(), exportCount: (project.exportCount ?? 0) + 1 });
      renderSuccess(res, blob);
    } catch (err) {
      if (my.signal.aborted || isAbortError(err)) return;
      console.error(err);
      renderError(err);
    }
  }

  void run();
  return { close: () => modal.close() };
}
