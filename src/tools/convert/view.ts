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
import { imageDataToCanvas, cropImageData } from '../../core/image';
import { DEFAULT_JAVA_VERSION, loadAssets } from '../../editions/index';
import { siteFooter } from '../../app/footer';
import { proceduralTexture, toImageData, type ProceduralTextureName } from '../../shared/preview/procedural-textures';
import { importPack } from '../textures/import';
import { exportTexturePack, renderIsoCube } from '../textures/export';
import { BEDROCK_TEXTURE_ROOT, JAVA_TEXTURE_ROOT, packFileName } from '../textures/project';
import { plainText } from '../textures/ui/mc-text';
import { convertPack, isSameTarget, targetLabel, vanillaNameSet, type ConvertReport, type ConvertTarget, type SkipReason } from './convert';
import { buildPairIndex } from './paths';
import { loadConvertMaps } from './data';
import { importLoosePngs } from './loose';

interface Source {
  project: TexturePackProject;
  warnings: string[];
  fileName: string;
  /** Loose PNGs (no pack.mcmeta): may be "converted" to the same Java version, i.e. packaged */
  loose: boolean;
}

const REASONS: { reason: SkipReason; title: (t: ConvertTarget) => string; hint: string }[] = [
  { reason: 'no-counterpart', title: (t) => `No ${t.edition === 'bedrock' ? 'Bedrock' : 'Java'} counterpart`, hint: 'The other edition has no texture like these.' },
  { reason: 'layout', title: () => 'Laid out differently', hint: 'Same thing in game, but the picture is arranged another way. Repaint these in the editor.' },
  { reason: 'removed', title: (t) => `Removed by Java ${t.version}`, hint: 'Minecraft dropped these textures.' },
  { reason: 'missing', title: (t) => `Not in ${targetLabel(t)}`, hint: 'These textures were added in a newer version.' },
  { reason: 'duplicate', title: () => 'Already filled by another texture', hint: 'Two textures of the pack map to the same file; the first one is used.' },
  { reason: 'unreadable', title: () => 'Couldn’t be read', hint: 'These files aren’t readable images.' },
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
  return p.edition === 'java' ? `Java ${p.version}` : 'Bedrock';
}

function relOf(path: string): string {
  if (path.startsWith(JAVA_TEXTURE_ROOT)) return path.slice(JAVA_TEXTURE_ROOT.length);
  if (path.startsWith(BEDROCK_TEXTURE_ROOT)) return path.slice(BEDROCK_TEXTURE_ROOT.length);
  return path;
}

function plural(n: number, word: string, many = `${word}s`): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? word : many}`;
}

export default async function view(root: HTMLElement, _ctx: RouteContext): Promise<() => void> {
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
  const busy = h('div', { class: 'cv-busy', hidden: true }, spinner(32), h('span', null, 'Reading pack…'));
  const dz = dropzone({
    accept: '.zip,.mcpack,.mcaddon,.png',
    label: 'Drop a pack here or click to browse',
    hint: '.zip for Java · .mcpack or .mcaddon for Bedrock · or PNG textures',
    icon: 'folder',
    onFiles: (files) => void openFile(files[0]),
  });
  dz.classList.add('cv-dz');
  const dzWrap = h('div', { class: 'cv-dz-wrap' }, dz, busy);
  const packBox = h('div', { class: 'cv-pack', hidden: true });
  const step1 = stepCard(1, 'Choose a pack', 'A Java .zip, a Bedrock .mcpack, or PNG textures named like the game’s.', 'folder', h('div', { class: 'cv-step-body' }, dzWrap, packBox));

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
      const maps = await loadConvertMaps();
      const known = vanillaNameSet(maps, maps.javaBedrock ? buildPairIndex(maps.javaBedrock) : null);
      const r = await importLoosePngs(file, known, maps.javaBedrock?.java ?? DEFAULT_JAVA_VERSION);
      return { project: r.project, warnings: r.warnings, fileName: file.name, loose: true };
    };
    if (/\.png$/i.test(file.name)) return loose();
    try {
      const r = await importPack(file);
      return { project: r.project, warnings: r.warnings, fileName: file.name, loose: false };
    } catch (err) {
      // A zip of images without pack.mcmeta / manifest.json: try them as loose textures.
      if (err instanceof Error && /doesn't contain a Minecraft resource pack/.test(err.message)) {
        try {
          return await loose();
        } catch (looseErr) {
          if (looseErr instanceof Error && /named like Minecraft textures/.test(looseErr.message)) throw looseErr;
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
          h('summary', null, icon('circle-info', { size: 16 }), plural(source.warnings.length, 'note'), ' about this pack'),
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
          h('strong', { class: 'cv-pack-name truncate', title: plainText(p.name) }, plainText(p.name) || 'Untitled pack'),
          h(
            'span',
            { class: 'cv-pack-badges' },
            badge(source.loose ? 'PNG textures' : sourceLabel(p), p.edition === 'java' ? 'green' : 'blue'),
            p.resolution > 16 ? badge(`${p.resolution}×`, 'gray') : null,
          ),
          h('span', { class: 'faint small' }, `${plural(textures, 'texture')}${others ? ` · ${plural(others, 'other file')}` : ''}`),
        ),
        button({ label: 'Change', icon: 'folder', variant: 'ghost', size: 'sm', class: 'cv-change', title: 'Choose another pack', onClick: () => (dz.querySelector('input[type=file]') as HTMLInputElement | null)?.click() }),
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
        h('strong', null, e === 'java' ? 'Java Edition' : 'Bedrock Edition'),
        h('span', { class: 'faint small' }, e === 'java' ? 'Windows, Mac and Linux computers' : 'Phones, tablets, consoles and Windows'),
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
  const editionGroup = h('div', { class: 'cv-eds', role: 'radiogroup', 'aria-label': 'Convert to' }, editionCards);
  const picker = versionPicker({
    edition: 'java',
    value: javaVersion,
    label: 'Java version',
    onChange: (_e, v) => {
      javaVersion = v;
      paintTarget();
      clearResult();
    },
  });
  const pickerWrap = h('div', { class: 'cv-version' }, picker);
  const targetHint = h('p', { class: 'cv-hint', role: 'status' });
  const convertBtn = button({ label: 'Convert pack', icon: 'repeat', variant: 'primary', size: 'lg', class: 'cv-go', onClick: () => void run() });
  const step2 = stepCard(2, 'Convert to', 'Pick the edition, and for Java the version you play.', 'repeat', h('div', { class: 'cv-step-body' }, editionGroup, pickerWrap, targetHint, convertBtn));

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
    const t = currentTarget();
    let hint = '';
    let ok = !!source && !running;
    if (!source) hint = 'Choose a pack first.';
    if (source && isSameTarget(source.project, t) && !source.loose) {
      ok = false;
      hint = `This pack is already for ${targetLabel(t)}. Pick another ${t.edition === 'java' ? 'version' : 'edition'}.`;
    }
    if (source && ok) {
      hint =
        t.edition === 'bedrock'
          ? 'You’ll get a .mcpack file for Bedrock.'
          : source.project.edition === 'bedrock'
            ? `You’ll get a .zip pack for Java ${t.version}.`
            : source.loose && isSameTarget(source.project, t)
              ? `Your textures will be packed into a .zip for Java ${t.version}.`
              : `Textures renamed between Java ${source.project.version} and ${t.version} get their new names.`;
    }
    targetHint.textContent = hint;
    convertBtn.disabled = !ok;
    const label = convertBtn.querySelector('.btn-label');
    if (label) label.textContent = source?.loose && source.project.edition === 'java' && t.edition === 'java' && isSameTarget(source.project, t) ? 'Make pack' : `Convert to ${t.edition === 'bedrock' ? 'Bedrock' : `Java ${t.version}`}`;
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
      { id: 'maps', label: 'Loading the texture lists' },
      { id: 'assets', label: `Getting the ${targetLabel(target)} game files` },
      { id: 'convert', label: 'Converting textures' },
      { id: 'save', label: 'Saving to your packs' },
    ];
    const stepEls = steps.map((s) => h('li', { class: 'cv-prog-step', dataset: { state: 'todo' } }, h('span', { class: 'cv-prog-dot' }), h('span', null, s.label)));
    const bar = progressBar({ label: 'Starting…' });
    bar.set({ label: 'Starting…', fraction: null });
    const setStep = (i: number) => stepEls.forEach((el, j) => (el.dataset.state = j < i ? 'done' : j === i ? 'active' : 'todo'));
    result.hidden = false;
    result.replaceChildren(
      h(
        'div',
        { class: 'cv-res-head' },
        h('span', { class: 'cv-res-icon is-busy' }, spinner(28)),
        h('div', { class: 'cv-res-titles' }, h('h2', { id: resultTitleId }, `Converting to ${targetLabel(target)}…`), h('p', { class: 'muted' }, 'Everything happens in your browser. Keep this tab open.')),
      ),
      h('div', { class: 'cv-progress' }, h('ol', { class: 'cv-prog-steps' }, stepEls), bar),
      h('div', { class: 'cv-actions' }, button({ label: 'Cancel', variant: 'secondary', onClick: () => controller.abort() })),
    );
    result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const signal = controller.signal;
    try {
      setStep(0);
      const maps = await loadConvertMaps();
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      setStep(1);
      bar.set({ label: 'Starting download…', fraction: null });
      const assets = await loadAssets(target.edition, target.version, { signal, onProgress: (p) => bar.set(p) });
      setStep(2);
      const { project, report } = await convertPack(src.project, target, assets, maps, { signal, onProgress: (p) => bar.set(p), allowSameVersion: src.loose });
      setStep(3);
      bar.set({ label: 'Saving…', fraction: null });
      await saveProject(project);
      running = null;
      if (!alive) return;
      showResult(project, report, assets);
    } catch (err) {
      running = null;
      if (!alive) return;
      if (isAbortError(err) || signal.aborted) {
        clearResult();
        toast('Conversion cancelled');
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
          h('h2', { id: resultTitleId }, 'The conversion didn’t finish'),
          h('p', null, friendlyError(err)),
          h('p', { class: 'faint small' }, offline ? 'You seem to be offline: the game files for the new version need a connection the first time.' : `Converting to ${targetLabel(target)} needs that version’s game files. You can try again right away.`),
        ),
      ),
      h('div', { class: 'cv-actions' }, button({ label: 'Try again', icon: 'reload', variant: 'primary', onClick: () => void run() })),
    );
  }

  function showResult(project: TexturePackProject, report: ConvertReport, assets: AssetIndex) {
    const target = report.to;
    const done = report.converted.length;
    const total = report.total;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const ext = target.edition === 'bedrock' ? '.mcpack' : '.zip';
    const meter = h('div', { class: 'cv-meter', role: 'img', 'aria-label': `${done} of ${total} textures converted` }, h('span', { class: 'cv-meter-fill', style: { width: `${pct}%` } }));
    const stat = (n: number, label: string, tone: string) => h('div', { class: ['cv-stat', `tone-${tone}`] }, h('strong', null, n.toLocaleString('en-US')), h('span', { class: 'faint small' }, label));

    const dlBar = progressBar({ label: 'Building your pack…' });
    const dlBox = h('div', { class: 'cv-dl', hidden: true }, dlBar);
    const installBox = h('div', { class: 'cv-install', hidden: true });
    const dlBtn = button({ label: `Download ${ext}`, icon: 'download', variant: 'primary', size: 'lg', class: 'cv-dl-btn', onClick: () => void download() });
    const openBtn = h('a', { class: 'btn btn-secondary btn-lg cv-open-btn', href: routeHref(`/textures/${encodeURIComponent(project.id)}`) }, icon('pencil'), h('span', { class: 'btn-label' }, 'Open in editor'));
    const againBtn = button({ label: 'Convert another', icon: 'reload', variant: 'ghost', class: 'cv-again', onClick: () => resetAll() });

    async function download() {
      dlBtn.disabled = true;
      dlBox.hidden = false;
      dlBar.set({ label: 'Building your pack…', fraction: null });
      try {
        const r = await withFairYield(() => exportTexturePack(project, assets, { onProgress: (p) => dlBar.set(p) }));
        await saveProject(project).catch(() => undefined);
        if (!alive) return;
        saveBlob(r.blob, r.filename);
        dlBox.hidden = true;
        installBox.hidden = false;
        installBox.replaceChildren(
          h('div', { class: 'cv-file' }, icon('check', { size: 20 }), h('strong', null, r.filename), h('span', { class: 'faint small' }, `${formatBytes(r.blob.size)} · ${plural(r.fileCount, 'file')}`)),
          h(
            'p',
            { class: 'small muted' },
            target.edition === 'bedrock'
              ? 'Open the .mcpack file: Minecraft starts and imports it. Then turn it on in Settings → Global Resources. '
              : 'Put the .zip in your resourcepacks folder (Options → Resource Packs → Open Pack Folder), don’t unzip it, then select it in game. ',
            h('a', { href: routeHref(`/help?s=${target.edition === 'bedrock' ? 'bedrock-packs' : 'java-packs'}`) }, 'Installing help'),
          ),
        );
        if (r.warnings.length) {
          installBox.append(h('details', { class: 'cv-notes' }, h('summary', null, icon('circle-info', { size: 16 }), plural(r.warnings.length, 'note'), ' about the download'), h('ul', null, r.warnings.map((w) => h('li', null, w)))));
        }
      } catch (err) {
        console.error(err);
        dlBox.hidden = true;
        toast(friendlyError(err, 'Couldn’t build the pack'), { tone: 'error' });
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
        group(r.title(target), items.length, r.reason === 'layout' || r.reason === 'no-counterpart' ? 'warn' : 'muted', r.hint, items.map((s) => listRow(relOf(s.source), s.target ? relOf(s.target) : null, shared ? null : s.detail))),
      );
    }
    if (report.kept.length) {
      sections.push(group('Kept as custom textures', report.kept.length, 'muted', `Not used by vanilla Java ${target.version}; kept for the pack’s own models.`, report.kept.map((c) => listRow(relOf(c.source), c.targets.map(relOf).join(', '), null))));
    }
    if (report.dropped.length) {
      const kinds = new Map<string, string[]>();
      for (const d of report.dropped) kinds.set(d.kind, [...(kinds.get(d.kind) ?? []), d.source]);
      sections.push(
        group(
          'Other files left out',
          report.dropped.length,
          'muted',
          `${target.edition === 'bedrock' ? 'Bedrock' : 'Java'} uses different formats for these.`,
          [...kinds].sort((a, b) => b[1].length - a[1].length).map(([k, list]) => listRow(`${k} (${list.length})`, null, list.slice(0, 3).map((p) => p.slice(p.lastIndexOf('/') + 1)).join(', ') + (list.length > 3 ? ', …' : ''))),
        ),
      );
    }
    if (done) {
      sections.push(
        group('Converted textures', done, 'ok', null, report.converted.map((c) => listRow(relOf(c.source), c.targets.map(relOf).join(', '), c.notes.join(' · ') || null))),
      );
    }

    const headline = total
      ? done === total
        ? `All ${plural(total, 'texture')} converted`
        : `${done.toLocaleString('en-US')} of ${plural(total, 'texture')} converted`
      : 'The pack has no textures to convert';
    result.replaceChildren(
      h(
        'div',
        { class: 'cv-res-head' },
        h('span', { class: ['cv-res-icon', done ? 'is-ok' : 'is-warn'] }, icon(done ? 'check' : 'warning-diamond', { size: 32 })),
        h(
          'div',
          { class: 'cv-res-titles' },
          h('span', { class: 'eyebrow' }, `${targetLabel(report.from)} → ${targetLabel(target)}`),
          h('h2', { id: resultTitleId }, headline),
          h('p', { class: 'muted cv-saved' }, `Saved as “${plainText(project.name)}” in your texture packs · ${packFileName(project)}`),
        ),
      ),
      h(
        'div',
        { class: 'cv-summary' },
        meter,
        h(
          'div',
          { class: 'cv-stats' },
          stat(done, 'converted', 'ok'),
          stat(report.skipped.length, 'skipped', report.skipped.length ? 'warn' : 'muted'),
          report.kept.length ? stat(report.kept.length, 'kept as custom', 'muted') : null,
          report.from.edition !== target.edition ? stat(report.dropped.length, 'other files left out', 'muted') : stat(report.carried, 'other files carried over', 'muted'),
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
      h('summary', null, h('span', { class: 'cv-group-title' }, title), h('span', { class: 'cv-count' }, count.toLocaleString('en-US')), icon('chevron-down', { size: 16 })),
      hint ? h('p', { class: 'faint small cv-group-hint' }, hint) : null,
      h('ul', { class: 'cv-list' }, shown),
      rows.length > shown.length ? h('p', { class: 'faint small cv-more' }, `and ${(rows.length - shown.length).toLocaleString('en-US')} more`) : null,
    );
  }

  function listRow(from: string, to: string | null, detail: string | null): HTMLElement {
    return h(
      'li',
      null,
      h('code', { class: 'cv-from' }, from),
      to ? h('span', { class: 'cv-arrow', 'aria-label': 'becomes' }, '→') : null,
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
    h('figure', null, isoCube('grass_top', 'grass_side', 96), h('figcaption', null, icon('laptop', { size: 16 }), 'Java')),
    h('span', { class: 'cv-hero-arrows' }, icon('arrows-horizontal', { size: 32 })),
    h('figure', null, isoCube('oak_log_top', 'oak_log', 96), h('figcaption', null, icon('gamepad', { size: 16 }), 'Bedrock')),
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
        h('span', { class: 'eyebrow' }, icon('repeat'), 'Texture Pack Converter'),
        h('h1', { class: 'pixel-shadow' }, 'Convert texture packs between ', h('span', { class: 'accent' }, 'Java'), ' and ', h('span', { class: 'accent' }, 'Bedrock')),
        h('p', { class: 'lead' }, 'Turn a Java pack into a Bedrock .mcpack, a Bedrock pack into a Java .zip, or update an old Java pack to the version you play. Everything stays in your browser.'),
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
