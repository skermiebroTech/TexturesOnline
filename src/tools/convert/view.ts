// Texture pack converter at /texture-pack-converter: open a pack (or loose PNG textures), pick
// Bedrock or a Java version, convert, then download it or keep editing it in the texture tool.

import './convert.css';
import type { AssetIndex, Edition, TexturePackProject } from '../../core/types';
import type { RouteContext } from '../../core/router';
import { href as routeHref } from '../../core/router';
import { h, formatBytes, uid } from '../../ui/dom';
import { icon, type IconName } from '../../ui/icons';
import { badge, button, progressBar, spinner } from '../../ui/components';
import { dropzone } from '../../ui/dropzone';
import { toast } from '../../ui/toast';
import { versionPicker } from '../../ui/version-picker';
import { saveProject } from '../../core/storage';
import { saveBlob } from '../../core/download';
import { friendlyError, isAbortError } from '../../core/net';
import { imageDataToCanvas, cropImageData } from '../../core/pixels';
import { DEFAULT_JAVA_VERSION, loadAssets } from '../../editions/versions';
import { siteFooter } from '../../app/footer';
import { proceduralTexture, toImageData, type ProceduralTextureName } from '../../shared/preview/procedural-textures';
import { renderIsoCube } from '../textures/iso-cube';
import { BEDROCK_TEXTURE_ROOT, JAVA_TEXTURE_ROOT, packFileName } from '../textures/project';
import { plainText } from '../textures/ui/mc-text';
import type { ConvertReport, ConvertTarget, SkipReason } from './convert';
import { isSameTarget, targetText } from './target';
import { t } from './i18n/text';
import { loadConvertText } from './i18n/load';
import { kit } from '../../ui/i18n/kit';
import { fmt, fmtNodes, num } from '../../i18n/editor-text';
import { buildPairIndex } from './paths';
import { loadConvertMaps } from './data';

// The pack reader, the converter and the exporter (zip, image codecs) load when a pack is opened,
// converted or downloaded.
const packReader = () => import('../textures/import');
const looseReader = () => import('./loose');
const converter = () => import('./convert');
const exporter = () => import('../textures/export');

interface Source {
  project: TexturePackProject;
  warnings: string[];
  fileName: string;
  /** Loose PNGs (no pack.mcmeta): may be "converted" to the same Java version, i.e. packaged */
  loose: boolean;
}

const REASONS: { reason: SkipReason; title: (target: ConvertTarget) => string; hint: () => string }[] = [
  { reason: 'no-counterpart', title: (target) => fmt(t.groups.noCounterpart, { edition: target.edition === 'bedrock' ? kit.edition.bedrock : kit.edition.java }), hint: () => t.groups.noCounterpartHint },
  { reason: 'layout', title: () => t.groups.layout, hint: () => t.groups.layoutHint },
  { reason: 'removed', title: (target) => fmt(t.groups.removed, { version: target.version }), hint: () => t.groups.removedHint },
  { reason: 'missing', title: (target) => fmt(t.groups.missing, { target: targetText(target) }), hint: () => t.groups.missingHint },
  { reason: 'duplicate', title: () => t.groups.duplicate, hint: () => t.groups.duplicateHint },
  { reason: 'unreadable', title: () => t.groups.unreadable, hint: () => t.groups.unreadableHint },
];

const LIST_LIMIT = 400;

/**
 * export.ts yields with scheduler.yield(), whose continuations run ahead of timers and paints in
 * Chrome; while exporting, hide it so the exporter uses its fair fallback (as the export dialog does).
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

function isoCube(top: ProceduralTextureName, side: ProceduralTextureName, size: number): HTMLCanvasElement {
  const sq = (n: ProceduralTextureName) => {
    const img = toImageData(proceduralTexture(n));
    return img.height > img.width ? cropImageData(img, 0, 0, img.width, img.width) : img;
  };
  const c = imageDataToCanvas(renderIsoCube(sq(top), sq(side), size));
  c.classList.add('pixelated');
  return c;
}

function sourceLabel(p: TexturePackProject): string {
  return targetText(p);
}

function relOf(path: string): string {
  if (path.startsWith(JAVA_TEXTURE_ROOT)) return path.slice(JAVA_TEXTURE_ROOT.length);
  if (path.startsWith(BEDROCK_TEXTURE_ROOT)) return path.slice(BEDROCK_TEXTURE_ROOT.length);
  return path;
}

/** `code` of a coded error (the messages are translated, so they can't be matched). */
function codeOf(err: unknown): string | undefined {
  return err && typeof err === 'object' ? (err as { code?: string }).code : undefined;
}

export default async function view(root: HTMLElement, ctx: RouteContext): Promise<() => void> {
  await loadConvertText(ctx.locale);
  root.classList.add('convert-view');
  let alive = true;
  let source: Source | null = null;
  let targetEdition: Edition = 'bedrock';
  let javaVersion = DEFAULT_JAVA_VERSION;
  let running: AbortController | null = null;
  const urls: string[] = [];
  // Prefetch the mapping data; the loose-PNG fallback needs it.
  void loadConvertMaps().catch(() => undefined);

  // ---------------------------------------------------------------- step 1: the pack
  const busy = h('div', { class: 'cv-busy', hidden: true }, spinner(32), h('span', null, t.step1.reading));
  const dz = dropzone({
    accept: '.zip,.mcpack,.mcaddon,.png',
    label: t.step1.drop,
    hint: t.step1.dropHint,
    icon: 'folder',
    onFiles: (files) => void openFile(files[0]),
  });
  dz.classList.add('cv-dz');
  const dzWrap = h('div', { class: 'cv-dz-wrap' }, dz, busy);
  const packBox = h('div', { class: 'cv-pack', hidden: true });
  const step1 = stepCard(1, t.step1.title, t.step1.text, 'folder', h('div', { class: 'cv-step-body' }, dzWrap, packBox));

  async function openFile(file: File | undefined) {
    if (!file) return;
    dz.setError(null);
    busy.hidden = false;
    dz.classList.add('is-busy');
    try {
      const next = await readSource(file);
      if (!alive) return;
      source = next;
      if (source.project.edition === 'bedrock') targetEdition = 'java';
      else if (!source.loose && targetEdition === 'java' && isSameTarget(source.project, { edition: 'java', version: javaVersion })) targetEdition = 'bedrock';
      paintPack();
      paintTarget();
      clearResult();
    } catch (err) {
      console.error(err);
      dz.setError(friendlyError(err));
    } finally {
      busy.hidden = true;
      dz.classList.remove('is-busy');
    }
  }

  async function readSource(file: File): Promise<Source> {
    const loose = async (): Promise<Source> => {
      const [maps, { vanillaNameSet }, { importLoosePngs }] = await Promise.all([loadConvertMaps(), converter(), looseReader()]);
      const known = vanillaNameSet(maps, maps.javaBedrock ? buildPairIndex(maps.javaBedrock) : null);
      const r = await importLoosePngs(file, known, maps.javaBedrock?.java ?? DEFAULT_JAVA_VERSION);
      return { project: r.project, warnings: r.warnings, fileName: file.name, loose: true };
    };
    if (/\.png$/i.test(file.name)) return loose();
    try {
      const { importPack } = await packReader();
      const r = await importPack(file);
      return { project: r.project, warnings: r.warnings, fileName: file.name, loose: false };
    } catch (err) {
      // A zip of images without pack.mcmeta / manifest.json: try them as loose textures.
      if (codeOf(err) === 'no-pack') {
        try {
          return await loose();
        } catch (looseErr) {
          if (codeOf(looseErr) === 'no-match') throw looseErr;
        }
      }
      throw err;
    }
  }

  function paintPack() {
    urls.splice(0).forEach((u) => URL.revokeObjectURL(u));
    if (!source) {
      packBox.hidden = true;
      dzWrap.hidden = false;
      return;
    }
    const p = source.project;
    const thumb = h('div', { class: 'cv-pack-icon checker' });
    if (p.icon) {
      const url = URL.createObjectURL(p.icon);
      urls.push(url);
      const img = h('img', { src: url, alt: '', class: 'pixelated' });
      img.addEventListener('error', () => thumb.replaceChildren(isoCube('grass_top', 'grass_side', 64)));
      thumb.appendChild(img);
    } else thumb.appendChild(isoCube('grass_top', 'grass_side', 64));
    const textures = Object.keys(p.overrides).length;
    const others = Object.keys(p.extraFiles).length;
    const warnings = source.warnings.length
      ? h(
          'details',
          { class: 'cv-notes' },
          h('summary', null, icon('circle-info', { size: 16 }), fmt(t.step1.packNotes, { count: source.warnings.length })),
          h('ul', null, source.warnings.map((w) => h('li', null, w))),
        )
      : null;
    packBox.replaceChildren(
      h(
        'div',
        { class: 'cv-pack-row' },
        thumb,
        h(
          'div',
          { class: 'cv-pack-info' },
          h('strong', { class: 'cv-pack-name truncate', title: plainText(p.name) }, plainText(p.name) || t.step1.untitled),
          h(
            'span',
            { class: 'cv-pack-badges' },
            badge(source.loose ? t.step1.pngTextures : sourceLabel(p), p.edition === 'java' ? 'green' : 'blue'),
            p.resolution > 16 ? badge(`${p.resolution}×`, 'gray') : null,
          ),
          h('span', { class: 'faint small' }, `${fmt(t.result.textures, { count: textures })}${others ? ` · ${fmt(t.result.otherFiles, { count: others })}` : ''}`),
        ),
        button({ label: t.step1.change, icon: 'folder', variant: 'ghost', size: 'sm', class: 'cv-change', title: t.step1.changeTitle, onClick: () => (dz.querySelector('input[type=file]') as HTMLInputElement | null)?.click() }),
      ),
      ...(p.description && !source.loose ? [h('p', { class: 'faint small cv-pack-desc' }, plainText(p.description))] : []),
      ...(warnings ? [warnings] : []),
    );
    packBox.hidden = false;
    dzWrap.hidden = true;
  }

  // ---------------------------------------------------------------- step 2: the target
  const editionCards = (['bedrock', 'java'] as Edition[]).map((e) => {
    const b = h(
      'button',
      { type: 'button', class: 'cv-ed', role: 'radio', dataset: { value: e } },
      h('span', { class: 'cv-ed-icon' }, icon(e === 'java' ? 'laptop' : 'gamepad')),
      h(
        'span',
        { class: 'cv-ed-text' },
        h('strong', null, e === 'java' ? t.step2.java : t.step2.bedrock),
        h('span', { class: 'faint small' }, e === 'java' ? t.step2.javaDevices : t.step2.bedrockDevices),
      ),
      h('span', { class: 'cv-ed-check' }, icon('check', { size: 16 })),
    );
    b.addEventListener('click', () => chooseEdition(e));
    b.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp' || ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
        ev.preventDefault();
        const other = e === 'java' ? 'bedrock' : 'java';
        if (!isDisabled(other)) {
          chooseEdition(other);
          (editionGroup.querySelector(`[data-value="${other}"]`) as HTMLElement | null)?.focus();
        }
      }
    });
    return b;
  });
  const editionGroup = h('div', { class: 'cv-eds', role: 'radiogroup', 'aria-label': t.step2.title }, editionCards);
  const picker = versionPicker({
    edition: 'java',
    value: javaVersion,
    label: t.step2.javaVersion,
    onChange: (_e, v) => {
      javaVersion = v;
      paintTarget();
      clearResult();
    },
  });
  const pickerWrap = h('div', { class: 'cv-version' }, picker);
  const targetHint = h('p', { class: 'cv-hint', role: 'status' });
  const convertBtn = button({ label: t.step2.convert, icon: 'repeat', variant: 'primary', size: 'lg', class: 'cv-go', onClick: () => void run() });
  const step2 = stepCard(2, t.step2.title, t.step2.text, 'repeat', h('div', { class: 'cv-step-body' }, editionGroup, pickerWrap, targetHint, convertBtn));

  function isDisabled(e: Edition): boolean {
    return e === 'bedrock' && source?.project.edition === 'bedrock';
  }

  function chooseEdition(e: Edition) {
    if (isDisabled(e) || e === targetEdition) return;
    targetEdition = e;
    paintTarget();
    clearResult();
  }

  function currentTarget(): ConvertTarget {
    return targetEdition === 'bedrock' ? { edition: 'bedrock', version: 'latest' } : { edition: 'java', version: javaVersion };
  }

  function paintTarget() {
    for (const b of editionCards) {
      const e = b.dataset.value as Edition;
      const on = e === targetEdition;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
      const off = isDisabled(e);
      b.disabled = off;
      b.classList.toggle('is-disabled', off);
    }
    pickerWrap.hidden = targetEdition !== 'java';
    const target = currentTarget();
    let hint = '';
    let ok = !!source && !running;
    if (!source) hint = t.step2.chooseFirst;
    if (source && isSameTarget(source.project, target) && !source.loose) {
      ok = false;
      hint = fmt(target.edition === 'java' ? t.step2.alreadyVersion : t.step2.alreadyEdition, { target: targetText(target) });
    }
    if (source && ok) {
      hint =
        target.edition === 'bedrock'
          ? t.step2.getMcpack
          : source.project.edition === 'bedrock'
            ? fmt(t.step2.getZip, { version: target.version })
            : source.loose && isSameTarget(source.project, target)
              ? fmt(t.step2.packLoose, { version: target.version })
              : fmt(t.step2.renamed, { from: source.project.version, to: target.version });
    }
    targetHint.textContent = hint;
    convertBtn.disabled = !ok;
    const label = convertBtn.querySelector('.btn-label');
    if (label) label.textContent = source?.loose && source.project.edition === 'java' && target.edition === 'java' && isSameTarget(source.project, target) ? t.step2.makePack : fmt(t.step2.convertTo, { target: targetText(target) });
  }

  // ---------------------------------------------------------------- step 3: progress & result
  const result = h('section', { class: 'card cv-result', hidden: true, 'aria-live': 'polite', 'aria-labelledby': uid('cv-res') });
  const resultTitleId = result.getAttribute('aria-labelledby')!;

  function clearResult() {
    if (running) return;
    result.hidden = true;
    result.replaceChildren();
  }

  async function run() {
    if (!source || running || convertBtn.disabled) return;
    const src = source;
    const target = currentTarget();
    const controller = new AbortController();
    running = controller;
    paintTarget();
    const steps = [
      { id: 'maps', label: t.progress.maps },
      { id: 'assets', label: fmt(t.progress.assets, { target: targetText(target) }) },
      { id: 'convert', label: t.progress.convert },
      { id: 'save', label: t.progress.save },
    ];
    const stepEls = steps.map((s) => h('li', { class: 'cv-prog-step', dataset: { state: 'todo' } }, h('span', { class: 'cv-prog-dot' }), h('span', null, s.label)));
    const bar = progressBar({ label: t.progress.starting });
    bar.set({ label: t.progress.starting, fraction: null });
    const setStep = (i: number) => stepEls.forEach((el, j) => (el.dataset.state = j < i ? 'done' : j === i ? 'active' : 'todo'));
    result.hidden = false;
    result.replaceChildren(
      h(
        'div',
        { class: 'cv-res-head' },
        h('span', { class: 'cv-res-icon is-busy' }, spinner(28)),
        h('div', { class: 'cv-res-titles' }, h('h2', { id: resultTitleId }, fmt(t.progress.title, { target: targetText(target) })), h('p', { class: 'muted' }, t.progress.inBrowser)),
      ),
      h('div', { class: 'cv-progress' }, h('ol', { class: 'cv-prog-steps' }, stepEls), bar),
      h('div', { class: 'cv-actions' }, button({ label: kit.cancel, variant: 'secondary', onClick: () => controller.abort() })),
    );
    result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const signal = controller.signal;
    try {
      setStep(0);
      const maps = await loadConvertMaps();
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      setStep(1);
      bar.set({ label: t.progress.startingDownload, fraction: null });
      const assets = await loadAssets(target.edition, target.version, { signal, onProgress: (p) => bar.set(p) });
      setStep(2);
      const { convertPack } = await converter();
      const { project, report } = await convertPack(src.project, target, assets, maps, { signal, onProgress: (p) => bar.set(p), allowSameVersion: src.loose });
      setStep(3);
      bar.set({ label: t.progress.saving, fraction: null });
      await saveProject(project);
      running = null;
      if (!alive) return;
      showResult(project, report, assets);
    } catch (err) {
      running = null;
      if (!alive) return;
      if (isAbortError(err) || signal.aborted) {
        clearResult();
        toast(t.progress.cancelled);
      } else {
        console.error(err);
        showError(err, target);
      }
    } finally {
      if (alive) paintTarget();
    }
  }

  function showError(err: unknown, target: ConvertTarget) {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    result.replaceChildren(
      h(
        'div',
        { class: 'cv-res-head' },
        h('span', { class: 'cv-res-icon is-error' }, icon('warning-diamond', { size: 32 })),
        h(
          'div',
          { class: 'cv-res-titles' },
          h('h2', { id: resultTitleId }, t.error.title),
          h('p', null, friendlyError(err)),
          h('p', { class: 'faint small' }, offline ? t.error.offline : fmt(t.error.retry, { target: targetText(target) })),
        ),
      ),
      h('div', { class: 'cv-actions' }, button({ label: kit.tryAgain, icon: 'reload', variant: 'primary', onClick: () => void run() })),
    );
  }

  function showResult(project: TexturePackProject, report: ConvertReport, assets: AssetIndex) {
    const target = report.to;
    const done = report.converted.length;
    const total = report.total;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const ext = target.edition === 'bedrock' ? '.mcpack' : '.zip';
    const meter = h('div', { class: 'cv-meter', role: 'img', 'aria-label': fmt(t.result.meter, { done: String(done), total: String(total) }) }, h('span', { class: 'cv-meter-fill', style: { width: `${pct}%` } }));
    const stat = (n: number, label: string, tone: string) => h('div', { class: ['cv-stat', `tone-${tone}`] }, h('strong', null, num(n)), h('span', { class: 'faint small' }, label));

    const dlBar = progressBar({ label: t.result.building });
    const dlBox = h('div', { class: 'cv-dl', hidden: true }, dlBar);
    const installBox = h('div', { class: 'cv-install', hidden: true });
    const dlBtn = button({ label: fmt(t.result.download, { ext }), icon: 'download', variant: 'primary', size: 'lg', class: 'cv-dl-btn', onClick: () => void download() });
    const openBtn = h('a', { class: 'btn btn-secondary btn-lg cv-open-btn', href: routeHref(`/textures/${encodeURIComponent(project.id)}`) }, icon('pencil'), h('span', { class: 'btn-label' }, t.result.openEditor));
    const againBtn = button({ label: t.result.again, icon: 'reload', variant: 'ghost', class: 'cv-again', onClick: () => resetAll() });

    async function download() {
      dlBtn.disabled = true;
      dlBox.hidden = false;
      dlBar.set({ label: t.result.building, fraction: null });
      try {
        const { exportTexturePack } = await exporter();
        const r = await withFairYield(() => exportTexturePack(project, assets, { onProgress: (p) => dlBar.set(p) }));
        await saveProject(project).catch(() => undefined);
        if (!alive) return;
        saveBlob(r.blob, r.filename);
        dlBox.hidden = true;
        installBox.hidden = false;
        installBox.replaceChildren(
          h('div', { class: 'cv-file' }, icon('check', { size: 20 }), h('strong', null, r.filename), h('span', { class: 'faint small' }, `${formatBytes(r.blob.size)} · ${fmt(t.result.files, { count: r.fileCount })}`)),
          h(
            'p',
            { class: 'small muted' },
            target.edition === 'bedrock' ? t.result.installBedrock : t.result.installJava,
            h('a', { href: routeHref(`/help?s=${target.edition === 'bedrock' ? 'bedrock-packs' : 'java-packs'}`) }, t.result.installHelp),
          ),
        );
        if (r.warnings.length) {
          installBox.append(h('details', { class: 'cv-notes' }, h('summary', null, icon('circle-info', { size: 16 }), fmt(t.result.downloadNotes, { count: r.warnings.length })), h('ul', null, r.warnings.map((w) => h('li', null, w)))));
        }
      } catch (err) {
        console.error(err);
        dlBox.hidden = true;
        toast(friendlyError(err, t.result.buildFailed), { tone: 'error' });
      } finally {
        dlBtn.disabled = false;
      }
    }

    const sections: Node[] = [];
    if (report.notes.length) sections.push(h('ul', { class: 'cv-note-list' }, report.notes.map((n) => h('li', null, icon('circle-info', { size: 16 }), h('span', null, n)))));

    for (const r of REASONS) {
      const items = report.skipped.filter((s) => s.reason === r.reason);
      if (!items.length) continue;
      // A detail every row shares only repeats the group's title.
      const shared = new Set(items.map((s) => s.detail)).size === 1;
      sections.push(
        group(r.title(target), items.length, r.reason === 'layout' || r.reason === 'no-counterpart' ? 'warn' : 'muted', r.hint(), items.map((s) => listRow(relOf(s.source), s.target ? relOf(s.target) : null, shared ? null : s.detail))),
      );
    }
    if (report.kept.length) {
      sections.push(group(t.groups.kept, report.kept.length, 'muted', fmt(t.groups.keptHint, { version: target.version }), report.kept.map((c) => listRow(relOf(c.source), c.targets.map(relOf).join(', '), null))));
    }
    if (report.dropped.length) {
      const kinds = new Map<string, string[]>();
      for (const d of report.dropped) kinds.set(d.kind, [...(kinds.get(d.kind) ?? []), d.source]);
      sections.push(
        group(
          t.groups.dropped,
          report.dropped.length,
          'muted',
          fmt(t.groups.droppedHint, { edition: target.edition === 'bedrock' ? kit.edition.bedrock : kit.edition.java }),
          [...kinds].sort((a, b) => b[1].length - a[1].length).map(([k, list]) => listRow(`${k} (${list.length})`, null, list.slice(0, 3).map((p) => p.slice(p.lastIndexOf('/') + 1)).join(', ') + (list.length > 3 ? ', …' : ''))),
        ),
      );
    }
    if (done) {
      sections.push(
        group(t.groups.converted, done, 'ok', null, report.converted.map((c) => listRow(relOf(c.source), c.targets.map(relOf).join(', '), c.notes.join(' · ') || null))),
      );
    }

    const headline = total
      ? done === total
        ? fmt(t.result.allConverted, { count: total })
        : fmt(t.result.someConverted, { done, total })
      : t.result.noTextures;
    result.replaceChildren(
      h(
        'div',
        { class: 'cv-res-head' },
        h('span', { class: ['cv-res-icon', done ? 'is-ok' : 'is-warn'] }, icon(done ? 'check' : 'warning-diamond', { size: 32 })),
        h(
          'div',
          { class: 'cv-res-titles' },
          h('span', { class: 'eyebrow' }, `${targetText(report.from)} → ${targetText(target)}`),
          h('h2', { id: resultTitleId }, headline),
          h('p', { class: 'muted cv-saved' }, fmt(t.result.saved, { name: plainText(project.name), file: packFileName(project) })),
        ),
      ),
      h(
        'div',
        { class: 'cv-summary' },
        meter,
        h(
          'div',
          { class: 'cv-stats' },
          stat(done, t.result.statConverted, 'ok'),
          stat(report.skipped.length, t.result.statSkipped, report.skipped.length ? 'warn' : 'muted'),
          report.kept.length ? stat(report.kept.length, t.result.statKept, 'muted') : null,
          report.from.edition !== target.edition ? stat(report.dropped.length, t.result.statDropped, 'muted') : stat(report.carried, t.result.statCarried, 'muted'),
        ),
      ),
      h('div', { class: 'cv-actions' }, dlBtn, openBtn, againBtn),
      dlBox,
      installBox,
      ...sections,
    );
    result.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function group(title: string, count: number, tone: 'ok' | 'warn' | 'muted', hint: string | null, rows: HTMLElement[]): HTMLElement {
    const shown = rows.slice(0, LIST_LIMIT);
    return h(
      'details',
      { class: ['cv-group', `tone-${tone}`] },
      h('summary', null, h('span', { class: 'cv-group-title' }, title), h('span', { class: 'cv-count' }, num(count)), icon('chevron-down', { size: 16 })),
      hint ? h('p', { class: 'faint small cv-group-hint' }, hint) : null,
      h('ul', { class: 'cv-list' }, shown),
      rows.length > shown.length ? h('p', { class: 'faint small cv-more' }, fmt(t.result.more, { count: rows.length - shown.length })) : null,
    );
  }

  function listRow(from: string, to: string | null, detail: string | null): HTMLElement {
    return h(
      'li',
      null,
      h('code', { class: 'cv-from' }, from),
      to ? h('span', { class: 'cv-arrow', 'aria-label': t.result.becomes }, '→') : null,
      to ? h('code', { class: 'cv-to' }, to) : null,
      detail ? h('span', { class: 'cv-detail faint small' }, detail) : null,
    );
  }

  function resetAll() {
    source = null;
    paintPack();
    clearResult();
    paintTarget();
    step1.scrollIntoView({ behavior: 'smooth', block: 'center' });
    dz.focus();
  }

  // ---------------------------------------------------------------- page
  const art = h(
    'div',
    { class: 'cv-hero-art', 'aria-hidden': 'true' },
    h('figure', null, isoCube('grass_top', 'grass_side', 96), h('figcaption', null, icon('laptop', { size: 16 }), kit.edition.java)),
    h('span', { class: 'cv-hero-arrows' }, icon('arrows-horizontal', { size: 32 })),
    h('figure', null, isoCube('oak_log_top', 'oak_log', 96), h('figcaption', null, icon('gamepad', { size: 16 }), kit.edition.bedrock)),
  );
  const page = h(
    'div',
    { class: 'cv-page accent-green' },
    h(
      'header',
      { class: 'container cv-hero' },
      h(
        'div',
        { class: 'cv-hero-text' },
        h('span', { class: 'eyebrow' }, icon('repeat'), t.hero.eyebrow),
        h('h1', { class: 'pixel-shadow' }, fmtNodes(t.hero.title, { java: h('span', { class: 'accent' }, kit.edition.java), bedrock: h('span', { class: 'accent' }, kit.edition.bedrock) })),
        h('p', { class: 'lead' }, t.hero.lead),
      ),
      art,
    ),
    h('div', { class: 'container cv-grid' }, step1, step2, result),
    siteFooter(),
  );
  root.appendChild(page);
  paintTarget();

  return () => {
    alive = false;
    running?.abort();
    urls.forEach((u) => URL.revokeObjectURL(u));
  };
}

function stepCard(n: number, title: string, text: string, ic: IconName, body: HTMLElement): HTMLElement {
  const id = uid('cv-step');
  return h(
    'section',
    { class: 'card cv-step', 'aria-labelledby': id, dataset: { step: String(n) } },
    h('div', { class: 'cv-step-head' }, h('span', { class: 'cv-step-n', 'aria-hidden': 'true' }, String(n)), h('div', null, h('h2', { id }, title), h('p', { class: 'muted' }, text)), h('span', { class: 'cv-step-icon', 'aria-hidden': 'true' }, icon(ic))),
    body,
  );
}
