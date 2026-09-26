// Export dialog: a step checklist with progress while the pack is built, friendly errors with
// retry, and a success screen with install steps.

import { saveBlob } from '../../../core/download';
import { friendlyError, isAbortError } from '../../../core/net';
import type { OptionValues } from '../../../core/types';
import { button, progressBar } from '../../../ui/components';
import { formatBytes, h } from '../../../ui/dom';
import { icon } from '../../../ui/icons';
import { openModal } from '../../../ui/modal';
import { BuildError, buildPackFiles, buildSteps, type BuildResult, type ShaderTargetInfo } from '../targets';
import { helpLink, installSteps } from './install';
import { zipPack } from './pack-zip';
import type { ShaderProjectData } from './project';

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
    title: `Export “${project.name.trim() || 'My shaders'}”`,
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
    const bar = progressBar({ label: 'Starting…' });
    bar.set({ label: 'Starting…', fraction: null });
    const cancel = button({ label: 'Cancel', variant: 'ghost', onClick: () => modal.close() });
    body.replaceChildren(
      h('div', { class: 'sh-export-head' }, h('span', { class: 'sh-export-icon is-busy' }, icon('package')), h('div', null, h('h3', null, 'Building your pack'), h('p', { class: 'muted' }, 'This only takes a moment. Everything happens in your browser.'))),
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
    const msg = err instanceof BuildError ? err.message : friendlyError(err, "The pack couldn't be exported");
    const kind = err instanceof BuildError ? err.kind : 'other';
    const actions: Node[] = [button({ label: 'Close', variant: 'ghost', onClick: () => modal.close() })];
    if (kind !== 'unsupported') actions.push(button({ label: 'Try again', icon: 'reload', variant: 'primary', onClick: () => void run() }));
    const extra: Node[] = [];
    if (kind === 'assets' && target.id === 'java-vanilla') {
      const input = h('input', { type: 'file', accept: '.jar', class: 'sr-only', 'aria-label': 'Choose a Minecraft .jar file' });
      input.addEventListener('change', () => {
        const f = input.files?.[0];
        if (f) void run(f);
      });
      const pick = button({ label: 'Use my own .jar', icon: 'folder', onClick: () => input.click() });
      extra.push(
        h(
          'div',
          { class: 'sh-export-jar' },
          h('p', { class: 'muted small' }, 'Offline or blocked? Pick the game file from your computer: ', h('code', null, `.minecraft/versions/${project.version}/${project.version}.jar`)),
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
        h('div', null, h('h3', null, kind === 'unsupported' ? "This version can't be used" : 'Export failed'), h('p', { class: 'sh-export-msg' }, msg)),
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
          h('div', { class: 'sh-export-warnings-title' }, icon('warning'), h('span', null, 'Good to know')),
          h('ul', null, res.warnings.map((w) => h('li', null, w))),
        )
      : null;
    const again = button({ label: 'Export again', icon: 'reload', variant: 'ghost', onClick: () => void run() });
    const download = button({
      label: 'Download again',
      icon: 'download',
      onClick: () => {
        if (lastBlob) saveBlob(lastBlob.blob, lastBlob.name);
      },
    });
    const done = button({ label: 'Done', variant: 'primary', onClick: () => modal.close() });
    body.replaceChildren(
      h(
        'div',
        { class: 'sh-export-head is-success' },
        h('span', { class: 'sh-export-icon' }, icon('check')),
        h('div', null, h('h3', null, 'Your pack is ready!'), h('p', { class: 'muted' }, 'It was downloaded to your Downloads folder.')),
      ),
      h(
        'div',
        { class: 'sh-export-file' },
        icon(target.fileExt === '.mcpack' ? 'package' : 'archive'),
        h('span', { class: 'sh-export-file-name truncate' }, res.filename),
        h('span', { class: 'faint small' }, formatBytes(blob.size)),
      ),
      ...(warn ? [warn] : []),
      h('h4', { class: 'section-title' }, icon('book-open'), `Install it (${target.installPlace})`),
      installSteps(target),
      helpLink(target),
      footer(again, download, done),
    );
    done.focus();
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
      ui.bar.set({ label: target.fileExt === '.mcpack' ? 'Packaging the .mcpack' : 'Zipping', fraction: null });
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
