// Texture pack merger at /merge-texture-packs: add two to eight packs, put them in order (the top
// pack wins, as in Minecraft's pack list), merge, then download the pack or keep editing it in the
// texture tool. Shares the converter's page layout and report styles (cv-*).

import '../convert/convert.css';
import './merge.css';
import type { Edition, TexturePackProject } from '../../core/types';
import type { RouteContext } from '../../core/router';
import { href as routeHref } from '../../core/router';
import { h, formatBytes, uid } from '../../ui/dom';
import { icon, type IconName } from '../../ui/icons';
import { badge, button, iconButton, progressBar, spinner, textInput } from '../../ui/components';
import { dropzone } from '../../ui/dropzone';
import { toast } from '../../ui/toast';
import { tooltip } from '../../ui/tooltip';
import { versionPicker } from '../../ui/version-picker';
import { saveProject } from '../../core/storage';
import { saveBlob } from '../../core/download';
import { friendlyError, isAbortError } from '../../core/net';
import { imageDataToCanvas, cropImageData } from '../../core/image';
import { loadAssets } from '../../editions/index';
import { siteFooter } from '../../app/footer';
import { proceduralTexture, toImageData, type ProceduralTextureName } from '../../shared/preview/procedural-textures';
import { importPack } from '../textures/import';
import { exportTexturePack, renderIsoCube } from '../textures/export';
import { packFileName } from '../textures/project';
import { plainText } from '../textures/ui/mc-text';
import { compareJavaVersions } from '../convert/paths';
import { loadConvertMaps } from '../convert/data';
import { DEFAULT_MERGED_NAME, MAX_PACKS, MIN_PACKS, defaultMergeVersion, displayPath, editionOf, joinNames, mergeDescription, mergePacks, type MergeReport } from './merge';

interface Entry {
  id: string;
  project: TexturePackProject;
  warnings: string[];
  fileName: string;
  /** Object URL of the pack icon */
  iconUrl: string | null;
  row?: HTMLLIElement;
}

const LIST_LIMIT = 400;

/** See the converter: hide scheduler.yield while exporting so progress paints (export.ts falls back). */
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

function packLabel(p: TexturePackProject): string {
  return p.edition === 'java' ? `Java ${p.version}` : 'Bedrock';
}

function plural(n: number, word: string, many = `${word}s`): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? word : many}`;
}

function nameOf(p: TexturePackProject): string {
  return plainText(p.name) || 'Untitled pack';
}

export default async function view(root: HTMLElement, _ctx: RouteContext): Promise<() => void> {
  root.classList.add('merge-view');
  let alive = true;
  let entries: Entry[] = [];
  let mergedName = DEFAULT_MERGED_NAME;
  /** Entry id whose icon is used, 'auto' (top pack with one) or 'none' (generated) */
  let iconChoice: string = 'auto';
  let javaVersion = defaultMergeVersion([]);
  let versionTouched = false;
  let running: AbortController | null = null;
  let reading = 0;
  const resultUrls: string[] = [];
  // Prefetch the rename data used for packs of other Java versions.
  void loadConvertMaps().catch(() => undefined);

  // ---------------------------------------------------------------- step 1: the packs
  const live = h('p', { class: 'sr-only', 'aria-live': 'polite' });
  const busy = h('div', { class: 'cv-busy', hidden: true }, spinner(32), h('span', { class: 'mg-busy-label' }, 'Reading pack…'));
  const dz = dropzone({
    accept: '.zip,.mcpack,.mcaddon',
    label: 'Drop packs here or click to browse',
    hint: 'Two to eight packs · .zip for Java · .mcpack or .mcaddon for Bedrock',
    icon: 'folder-plus',
    multiple: true,
    onFiles: (files) => void addFiles(files),
  });
  dz.classList.add('cv-dz', 'mg-dz');
  const dzWrap = h('div', { class: 'cv-dz-wrap mg-dz-wrap' }, dz, busy);
  const full = h('p', { class: 'mg-full faint small', hidden: true }, icon('circle-info', { size: 16 }), h('span', null, `That’s the most one merge can take (${MAX_PACKS} packs). Remove one to add another.`));
  const list = h('ol', { class: 'mg-list', 'aria-label': 'Packs, highest priority first' });
  const listBox = h(
    'div',
    { class: 'mg-list-box', hidden: true },
    h('div', { class: 'mg-end mg-end-top' }, icon('arrow-up', { size: 16 }), h('span', null, 'Highest priority: wins every conflict')),
    list,
    h('div', { class: 'mg-end' }, icon('arrow-down', { size: 16 }), h('span', null, 'Lowest priority')),
  );
  const step1 = stepCard(
    1,
    'Add your packs',
    'Drag them into order. As in Minecraft’s pack list, the pack at the top wins where two packs change the same file.',
    'files',
    h('div', { class: 'cv-step-body' }, listBox, dzWrap, full, live),
  );

  async function addFiles(files: File[]) {
    if (!files.length || running) return;
    const room = MAX_PACKS - entries.length;
    const take = files.slice(0, Math.max(0, room));
    const errors: string[] = [];
    if (files.length > take.length) errors.push(`Up to ${MAX_PACKS} packs can be merged: ${plural(files.length - take.length, 'file')} ${files.length - take.length === 1 ? 'wasn’t' : 'weren’t'} added.`);
    dz.setError(null);
    busy.hidden = false;
    dz.classList.add('is-busy');
    reading++;
    paintSettings();
    try {
      for (let i = 0; i < take.length; i++) {
        const file = take[i];
        const label = busy.querySelector('.mg-busy-label');
        if (label) label.textContent = take.length > 1 ? `Reading pack ${i + 1} of ${take.length}…` : 'Reading pack…';
        try {
          const r = await importPack(file);
          if (!alive) return;
          const entry: Entry = { id: uid('mg-pack'), project: r.project, warnings: r.warnings, fileName: file.name, iconUrl: r.project.icon ? URL.createObjectURL(r.project.icon) : null };
          entries.push(entry);
          announce(`${nameOf(r.project)} added at position ${entries.length} of ${entries.length}.`);
          changed();
        } catch (err) {
          console.error(err);
          errors.push(`${file.name}: ${friendlyError(err)}`);
        }
      }
    } finally {
      reading--;
      busy.hidden = true;
      dz.classList.remove('is-busy');
      if (alive) {
        dz.setError(errors.length ? errors.join(' ') : null);
        paintSettings();
      }
    }
  }

  function announce(text: string) {
    live.textContent = '';
    requestAnimationFrame(() => (live.textContent = text));
  }

  /** The pack list changed: update every part of the page that depends on it. */
  function changed() {
    if (!versionTouched) {
      const v = defaultMergeVersion(entries.map((e) => e.project));
      if (v !== javaVersion) {
        javaVersion = v;
        picker.setValue('java', v);
      }
    }
    if (iconChoice !== 'auto' && iconChoice !== 'none' && !entries.some((e) => e.id === iconChoice)) iconChoice = 'auto';
    paintList();
    paintSettings();
    clearResult();
  }

  function move(entry: Entry, to: number, focus?: 'handle' | 'up' | 'down') {
    const from = entries.indexOf(entry);
    const dest = Math.max(0, Math.min(entries.length - 1, to));
    if (from < 0 || from === dest) return;
    entries.splice(from, 1);
    entries.splice(dest, 0, entry);
    changed();
    announce(`${nameOf(entry.project)} moved to position ${dest + 1} of ${entries.length}.`);
    if (focus && entry.row) {
      let target = entry.row.querySelector<HTMLElement>(`.mg-${focus}`);
      if (target && (target as HTMLButtonElement).disabled) target = entry.row.querySelector<HTMLElement>('.mg-handle');
      target?.focus();
    }
  }

  function remove(entry: Entry) {
    const i = entries.indexOf(entry);
    if (i < 0) return;
    entries.splice(i, 1);
    if (entry.iconUrl) URL.revokeObjectURL(entry.iconUrl);
    changed();
    announce(`${nameOf(entry.project)} removed.`);
    const next = entries[Math.min(i, entries.length - 1)];
    (next?.row?.querySelector<HTMLElement>('.mg-remove') ?? dz).focus();
  }

  function rowOf(entry: Entry): HTMLLIElement {
    if (entry.row) return entry.row;
    const p = entry.project;
    const thumb = h('div', { class: 'mg-thumb checker' });
    if (entry.iconUrl) {
      const img = h('img', { src: entry.iconUrl, alt: '', class: 'pixelated' });
      img.addEventListener('error', () => thumb.replaceChildren(isoCube('grass_top', 'grass_side', 48)));
      thumb.appendChild(img);
    } else thumb.appendChild(isoCube('grass_top', 'grass_side', 48));
    const textures = Object.keys(p.overrides).length;
    const others = Object.keys(p.extraFiles).length;
    const handle = h(
      'button',
      { type: 'button', class: 'mg-handle', 'aria-label': `Move ${nameOf(p)}` },
      icon('grip'),
    );
    tooltip(handle, 'Drag, or use the arrow keys, to reorder');
    handle.addEventListener('pointerdown', (ev) => startDrag(entry, ev));
    handle.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
        ev.preventDefault();
        move(entry, entries.indexOf(entry) + (ev.key === 'ArrowUp' ? -1 : 1), 'handle');
      } else if (ev.key === 'Home' || ev.key === 'End') {
        ev.preventDefault();
        move(entry, ev.key === 'Home' ? 0 : entries.length - 1, 'handle');
      }
    });
    const up = iconButton('arrow-up', 'Move up', () => move(entry, entries.indexOf(entry) - 1, 'up'), { size: 'sm', class: 'mg-up' });
    const down = iconButton('arrow-down', 'Move down', () => move(entry, entries.indexOf(entry) + 1, 'down'), { size: 'sm', class: 'mg-down' });
    const del = iconButton('close', 'Remove', () => remove(entry), { size: 'sm', class: 'mg-remove' });
    up.setAttribute('aria-label', `Move ${nameOf(p)} up`);
    down.setAttribute('aria-label', `Move ${nameOf(p)} down`);
    del.setAttribute('aria-label', `Remove ${nameOf(p)}`);
    const notes = entry.warnings.length
      ? h('details', { class: 'cv-notes mg-notes' }, h('summary', null, icon('circle-info', { size: 16 }), plural(entry.warnings.length, 'note')), h('ul', null, entry.warnings.map((w) => h('li', null, w))))
      : null;
    const row = h(
      'li',
      { class: 'mg-row', dataset: { id: entry.id, edition: p.edition } },
      handle,
      h('span', { class: 'mg-rank', 'aria-hidden': 'true' }),
      thumb,
      h(
        'div',
        { class: 'mg-info' },
        h('strong', { class: 'mg-name truncate', title: `${nameOf(p)} (${entry.fileName})` }, nameOf(p)),
        h('span', { class: 'mg-badges' }, badge(packLabel(p), p.edition === 'java' ? 'green' : 'blue'), p.resolution > 16 ? badge(`${p.resolution}×`, 'gray') : null, h('span', { class: 'mg-top-badge' })),
        h('span', { class: 'faint small mg-counts' }, `${plural(textures, 'texture')}${others ? ` · ${plural(others, 'other file')}` : ''}`),
        notes,
      ),
      h('div', { class: 'mg-row-actions' }, up, down, del),
    );
    entry.row = row;
    return row;
  }

  function paintList() {
    const rows = entries.map(rowOf);
    list.replaceChildren(...rows);
    const { edition } = editionOf(entries.map((e) => e.project));
    entries.forEach((e, i) => {
      const row = e.row!;
      (row.querySelector('.mg-rank') as HTMLElement).textContent = String(i + 1);
      (row.querySelector('.mg-up') as HTMLButtonElement).disabled = i === 0 || !!running;
      (row.querySelector('.mg-down') as HTMLButtonElement).disabled = i === entries.length - 1 || !!running;
      (row.querySelector('.mg-remove') as HTMLButtonElement).disabled = !!running;
      (row.querySelector('.mg-handle') as HTMLButtonElement).disabled = entries.length < 2 || !!running;
      const top = row.querySelector('.mg-top-badge') as HTMLElement;
      top.replaceChildren(...(i === 0 && entries.length > 1 ? [badge('Wins conflicts', 'gold')] : []));
      row.classList.toggle('is-odd-edition', !edition && entries.length > 1 && e.project.edition !== majorityEdition());
    });
    listBox.hidden = !entries.length;
    const isFull = entries.length >= MAX_PACKS;
    dzWrap.hidden = isFull;
    full.hidden = !isFull;
    dz.classList.toggle('compact', entries.length > 0);
    const label = dz.querySelector('.dropzone-label');
    if (label) label.textContent = entries.length ? 'Add more packs' : 'Drop packs here or click to browse';
    dz.setAttribute('aria-label', entries.length ? 'Add more packs' : 'Drop packs here or click to browse');
  }

  function majorityEdition(): Edition {
    const { java, bedrock } = editionOf(entries.map((e) => e.project));
    return java.length >= bedrock.length ? 'java' : 'bedrock';
  }

  // Pointer dragging (mouse, pen and touch) by the handle. The dragged row stays in place in the
  // DOM (so it keeps the pointer capture) and its neighbours move around it.
  function startDrag(entry: Entry, ev: PointerEvent) {
    if (ev.button !== 0 || entries.length < 2 || running) return;
    const row = entry.row!;
    const handle = ev.currentTarget as HTMLElement;
    ev.preventDefault();
    try {
      handle.setPointerCapture(ev.pointerId);
    } catch {
      /* synthetic events */
    }
    handle.focus({ preventScroll: true });
    const startY = ev.clientY;
    const startTop = row.offsetTop;
    const startIndex = entries.indexOf(entry);
    row.classList.add('is-dragging');
    list.classList.add('is-sorting');
    const slide = (el: HTMLElement, before: number) => {
      const dy = before - el.offsetTop;
      if (!dy || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 140, easing: 'ease-out' });
    };
    const onMove = (e: PointerEvent) => {
      const y = e.clientY;
      for (;;) {
        const prev = row.previousElementSibling as HTMLElement | null;
        if (!prev) break;
        const r = prev.getBoundingClientRect();
        if (y >= r.top + r.height / 2) break;
        const before = prev.offsetTop;
        row.after(prev);
        slide(prev, before);
      }
      for (;;) {
        const next = row.nextElementSibling as HTMLElement | null;
        if (!next) break;
        const r = next.getBoundingClientRect();
        if (y <= r.top + r.height / 2) break;
        const before = next.offsetTop;
        row.before(next);
        slide(next, before);
      }
      row.style.transform = `translateY(${y - startY - (row.offsetTop - startTop)}px)`;
    };
    const onEnd = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onEnd);
      handle.removeEventListener('pointercancel', onEnd);
      row.classList.remove('is-dragging');
      list.classList.remove('is-sorting');
      row.style.transform = '';
      const order = [...list.children].map((li) => entries.find((x) => x.id === (li as HTMLElement).dataset.id)).filter((x): x is Entry => !!x);
      if (order.length === entries.length) entries = order;
      const now = entries.indexOf(entry);
      if (now !== startIndex) {
        changed();
        announce(`${nameOf(entry.project)} moved to position ${now + 1} of ${entries.length}.`);
      }
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onEnd);
    handle.addEventListener('pointercancel', onEnd);
  }

  // ---------------------------------------------------------------- step 2: settings
  const nameField = textInput({
    label: 'Name of the merged pack',
    value: mergedName,
    maxLength: 64,
    placeholder: DEFAULT_MERGED_NAME,
    onInput: (v) => {
      mergedName = v;
      paintSettings();
      clearResult();
    },
  });
  nameField.classList.add('mg-name-field');
  const descPreview = h('p', { class: 'faint small mg-desc' });
  const iconGroup = h('div', { class: 'mg-icons', role: 'radiogroup', 'aria-label': 'Pack icon' });
  const iconField = h('div', { class: 'field mg-icon-field' }, h('div', { class: 'field-label' }, 'Pack icon'), iconGroup);
  const picker = versionPicker({
    edition: 'java',
    value: javaVersion,
    label: 'Java version',
    onChange: (_e, v) => {
      javaVersion = v;
      versionTouched = true;
      paintSettings();
      clearResult();
    },
  });
  const pickerWrap = h('div', { class: 'cv-version mg-version' }, picker);
  const hint = h('div', { class: 'cv-hint mg-hint', role: 'status' });
  const mergeBtn = button({ label: 'Merge packs', icon: 'git-merge', variant: 'primary', size: 'lg', class: 'cv-go mg-go', onClick: () => void run() });
  const step2 = stepCard(2, 'Merge settings', 'Name the new pack and choose its icon. Java packs also get a version.', 'sliders', h('div', { class: 'cv-step-body' }, nameField, descPreview, iconField, pickerWrap, hint, mergeBtn));

  function iconSource(): Entry | null {
    if (iconChoice === 'none') return null;
    if (iconChoice === 'auto') return entries.find((e) => e.iconUrl) ?? null;
    return entries.find((e) => e.id === iconChoice) ?? null;
  }

  function paintIcons() {
    const withIcon = entries.filter((e) => e.iconUrl);
    const chosen = iconSource();
    const opts: { id: string; label: string; node: Node; on: boolean }[] = withIcon.map((e) => ({
      id: e.id,
      label: nameOf(e.project),
      node: h('img', { src: e.iconUrl!, alt: '', class: 'pixelated' }),
      on: chosen === e,
    }));
    opts.push({ id: 'none', label: 'Generated from the merged textures', node: isoCube('grass_top', 'grass_side', 40), on: !chosen });
    const buttons = opts.map((o) => {
      const b = h('button', { type: 'button', class: 'mg-icon-opt checker', role: 'radio', 'aria-checked': String(o.on), 'aria-label': o.label, tabIndex: o.on ? 0 : -1, dataset: { value: o.id } }, o.node, h('span', { class: 'mg-icon-check' }, icon('check', { size: 16 })));
      tooltip(b, o.label);
      b.addEventListener('click', () => {
        iconChoice = o.id;
        paintIcons();
        clearResult();
      });
      b.addEventListener('keydown', (ev) => {
        const i = opts.indexOf(o);
        const d = ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? 1 : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? -1 : 0;
        if (!d) return;
        ev.preventDefault();
        const next = opts[(i + d + opts.length) % opts.length];
        iconChoice = next.id;
        paintIcons();
        clearResult();
        (iconGroup.querySelector(`[data-value="${next.id}"]`) as HTMLElement | null)?.focus();
      });
      return b;
    });
    iconGroup.replaceChildren(...buttons);
    iconField.hidden = !entries.length;
  }

  function paintSettings() {
    const projects = entries.map((e) => e.project);
    const { edition, java, bedrock } = editionOf(projects);
    descPreview.textContent = entries.length ? `Description: ${mergeDescription(projects.map(nameOf))}` : '';
    descPreview.hidden = !entries.length;
    pickerWrap.hidden = edition !== 'java';
    paintIcons();
    let ok = !running && !reading;
    hint.classList.remove('is-alert');
    if (entries.length < MIN_PACKS) {
      ok = false;
      hint.replaceChildren(entries.length ? 'Add at least one more pack to merge.' : 'Add two or more packs first.');
    } else if (!edition) {
      ok = false;
      hint.classList.add('is-alert');
      const names = (ids: number[]) => joinNames(ids.map((i) => `“${nameOf(projects[i])}”`));
      hint.replaceChildren(
        icon('warning-diamond', { size: 20 }),
        h(
          'span',
          null,
          h('strong', null, 'Java and Bedrock packs can’t be merged together. '),
          `${names(java)} ${java.length === 1 ? 'is a Java pack' : 'are Java packs'} and ${names(bedrock)} ${bedrock.length === 1 ? 'is for' : 'are for'} Bedrock: the editions use different files and folders. Convert the packs to one edition first with the `,
          h('a', { href: routeHref('/texture-pack-converter') }, 'Texture Pack Converter'),
          ', then merge them here.',
        ),
      );
    } else if (edition === 'bedrock') {
      hint.replaceChildren(`You’ll get one .mcpack for Bedrock with ${plural(entries.length, 'pack')} in it.`);
    } else {
      const other = entries.filter((e) => compareJavaVersions(e.project.version, javaVersion) !== 0);
      hint.replaceChildren(
        other.length
          ? `${joinNames(other.map((e) => `${nameOf(e.project)} (Java ${e.project.version})`))} will get the texture names of Java ${javaVersion}.`
          : `All packs are for Java ${javaVersion}. You’ll get one .zip.`,
      );
    }
    mergeBtn.disabled = !ok;
    const label = mergeBtn.querySelector('.btn-label');
    if (label) label.textContent = entries.length >= MIN_PACKS ? `Merge ${entries.length} packs` : 'Merge packs';
  }

  // ---------------------------------------------------------------- step 3: progress & result
  const result = h('section', { class: 'card cv-result mg-result', hidden: true, 'aria-live': 'polite', 'aria-labelledby': uid('mg-res') });
  const resultTitleId = result.getAttribute('aria-labelledby')!;

  function clearResult() {
    if (running) return;
    result.hidden = true;
    result.replaceChildren();
    resultUrls.splice(0).forEach((u) => URL.revokeObjectURL(u));
  }

  async function run() {
    if (running || mergeBtn.disabled) return;
    const projects = entries.map((e) => e.project);
    const { edition } = editionOf(projects);
    if (!edition) return;
    const controller = new AbortController();
    running = controller;
    paintList();
    paintSettings();
    const needsRenames = edition === 'java' && projects.some((p) => compareJavaVersions(p.version, javaVersion) !== 0);
    const steps = [...(needsRenames ? [{ id: 'maps', label: 'Loading the texture names' }] : []), { id: 'merge', label: 'Merging files' }, { id: 'save', label: 'Saving to your packs' }];
    const stepEls = steps.map((s) => h('li', { class: 'cv-prog-step', dataset: { state: 'todo' } }, h('span', { class: 'cv-prog-dot' }), h('span', null, s.label)));
    const bar = progressBar({ label: 'Starting…' });
    bar.set({ label: 'Starting…', fraction: null });
    const setStep = (id: string) => {
      const i = steps.findIndex((s) => s.id === id);
      stepEls.forEach((el, j) => (el.dataset.state = j < i ? 'done' : j === i ? 'active' : 'todo'));
    };
    result.hidden = false;
    result.replaceChildren(
      h(
        'div',
        { class: 'cv-res-head' },
        h('span', { class: 'cv-res-icon is-busy' }, spinner(28)),
        h('div', { class: 'cv-res-titles' }, h('h2', { id: resultTitleId }, `Merging ${plural(projects.length, 'pack')}…`), h('p', { class: 'muted' }, 'Everything happens in your browser. Keep this tab open.')),
      ),
      h('div', { class: 'cv-progress' }, h('ol', { class: 'cv-prog-steps mg-prog-steps', style: { '--steps': String(steps.length) } }, stepEls), bar),
      h('div', { class: 'cv-actions' }, button({ label: 'Cancel', variant: 'secondary', onClick: () => controller.abort() })),
    );
    result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const signal = controller.signal;
    const source = iconSource();
    try {
      let renames = null;
      if (needsRenames) {
        setStep('maps');
        renames = (await loadConvertMaps()).renames ?? null;
        if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      }
      setStep('merge');
      const { project, report } = await mergePacks(projects, {
        name: mergedName,
        version: edition === 'java' ? javaVersion : undefined,
        iconFrom: source ? entries.indexOf(source) : null,
        renames,
        signal,
        onProgress: (p) => bar.set(p),
      });
      setStep('save');
      bar.set({ label: 'Saving…', fraction: null });
      await saveProject(project);
      running = null;
      if (!alive) return;
      showResult(project, report, projects);
    } catch (err) {
      running = null;
      if (!alive) return;
      if (isAbortError(err) || signal.aborted) {
        clearResult();
        toast('Merge cancelled');
      } else {
        console.error(err);
        showError(err);
      }
    } finally {
      if (alive) {
        paintList();
        paintSettings();
      }
    }
  }

  function showError(err: unknown) {
    result.replaceChildren(
      h(
        'div',
        { class: 'cv-res-head' },
        h('span', { class: 'cv-res-icon is-error' }, icon('warning-diamond', { size: 32 })),
        h('div', { class: 'cv-res-titles' }, h('h2', { id: resultTitleId }, 'The merge didn’t finish'), h('p', null, friendlyError(err)), h('p', { class: 'faint small' }, 'Your packs are still here. You can try again right away.')),
      ),
      h('div', { class: 'cv-actions' }, button({ label: 'Try again', icon: 'reload', variant: 'primary', onClick: () => void run() })),
    );
  }

  function showResult(project: TexturePackProject, report: MergeReport, projects: TexturePackProject[]) {
    const edition = report.edition;
    const names = projects.map(nameOf);
    const stat = (n: number, label: string, tone: string) => h('div', { class: ['cv-stat', `tone-${tone}`] }, h('strong', null, n.toLocaleString('en-US')), h('span', { class: 'faint small' }, label));

    const dlBar = progressBar({ label: 'Building your pack…' });
    const dlBox = h('div', { class: 'cv-dl', hidden: true }, dlBar);
    const installBox = h('div', { class: 'cv-install', hidden: true });
    const dlBtn = button({ label: 'Download merged pack', icon: 'download', variant: 'primary', size: 'lg', class: 'cv-dl-btn mg-dl-btn', onClick: () => void download() });
    const openBtn = h('a', { class: 'btn btn-secondary btn-lg cv-open-btn mg-open-btn', href: routeHref(`/textures/${encodeURIComponent(project.id)}`) }, icon('pencil'), h('span', { class: 'btn-label' }, 'Open in editor'));
    const againBtn = button({ label: 'Start over', icon: 'reload', variant: 'ghost', class: 'cv-again mg-again', onClick: () => resetAll() });

    async function download() {
      dlBtn.disabled = true;
      dlBox.hidden = false;
      dlBar.set({ label: `Getting the ${edition === 'java' ? `Java ${report.version}` : 'Bedrock'} game files…`, fraction: null });
      try {
        const assets = await loadAssets(edition, report.version, { onProgress: (p) => dlBar.set(p) });
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
            edition === 'bedrock'
              ? 'Open the .mcpack file: Minecraft starts and imports it. Turn it on in Settings → Global Resources, and turn off the packs it was made from. '
              : 'Put the .zip in your resourcepacks folder (Options → Resource Packs → Open Pack Folder), don’t unzip it, then select it in game instead of the packs it was made from. ',
            h('a', { href: routeHref(`/help?s=${edition === 'bedrock' ? 'bedrock-packs' : 'java-packs'}`) }, 'Installing help'),
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

    // Files from each pack
    const contrib = h(
      'ol',
      { class: 'mg-contrib', 'aria-label': 'Files from each pack' },
      report.packs.map((s, i) => {
        const total = Math.max(1, s.files);
        const seg = (n: number, cls: string) => (n ? h('span', { class: ['mg-seg', cls], style: { width: `${(n / total) * 100}%` } }) : null);
        const parts = [
          `${plural(s.kept, 'file')} as is`,
          s.merged ? `${s.merged} merged` : null,
          s.overridden ? `${s.overridden} not used` : null,
          s.renamed ? `${plural(s.renamed, 'texture')} renamed` : null,
          s.removed ? `${s.removed} not in Java ${report.version}` : null,
        ].filter(Boolean);
        const thumb = h('span', { class: 'mg-contrib-thumb checker' });
        const icn = projects[i]?.icon;
        if (icn) {
          const url = URL.createObjectURL(icn);
          resultUrls.push(url);
          thumb.appendChild(h('img', { src: url, alt: '', class: 'pixelated' }));
        } else thumb.appendChild(isoCube('grass_top', 'grass_side', 32));
        return h(
          'li',
          { class: 'mg-contrib-row' },
          h('span', { class: 'mg-rank', 'aria-hidden': 'true' }, String(i + 1)),
          thumb,
          h(
            'div',
            { class: 'mg-contrib-info' },
            h('div', { class: 'mg-contrib-head' }, h('strong', { class: 'truncate' }, s.name), h('span', { class: 'faint small' }, `${(s.kept + s.merged).toLocaleString('en-US')} of ${plural(s.files, 'file')}`)),
            h('div', { class: 'mg-bar', role: 'img', 'aria-label': `${s.kept} used, ${s.merged} merged, ${s.overridden} replaced, of ${s.files} files` }, seg(s.kept, 'is-kept'), seg(s.merged, 'is-merged'), seg(s.overridden, 'is-lost')),
            h('span', { class: 'faint small' }, parts.join(' · ')),
          ),
        );
      }),
    );
    const legend = h(
      'div',
      { class: 'mg-legend faint small', 'aria-hidden': 'true' },
      h('span', null, h('i', { class: 'mg-seg is-kept' }), 'Used as is'),
      h('span', null, h('i', { class: 'mg-seg is-merged' }), 'Merged with other packs'),
      h('span', null, h('i', { class: 'mg-seg is-lost' }), 'Not used: another pack’s copy wins'),
    );

    const sections: Node[] = [];
    if (report.notes.length) sections.push(h('ul', { class: 'cv-note-list' }, report.notes.map((n) => h('li', null, icon('circle-info', { size: 16 }), h('span', null, n)))));
    if (report.conflicts.length) {
      sections.push(
        group(
          'Conflicts',
          report.conflicts.length,
          'warn',
          'Files more than one pack has. The highest pack’s copy is used, together with its own animation file.',
          report.conflicts.map((c) =>
            row(
              displayPath(c.path, edition),
              h('span', { class: 'mg-from' }, 'from ', h('strong', null, names[c.winner]), ', overriding ', joinNames(c.losers.map((i) => names[i]))),
            ),
          ),
          'mg-conflicts',
        ),
      );
    }
    if (report.merged.length) {
      sections.push(
        group(
          'Merged files',
          report.merged.length,
          'ok',
          'Files the game reads entry by entry, combined from every pack that has them.',
          report.merged.map((m) => row(displayPath(m.path, edition), h('span', { class: 'mg-from' }, joinNames(m.packs.map((i) => names[i])), ': ', m.how))),
          'mg-merged',
        ),
      );
    }
    if (report.dropped.length) {
      sections.push(
        group(
          'Left out',
          report.dropped.length,
          'muted',
          null,
          report.dropped.map((d) => row(displayPath(d.path, edition), h('span', { class: 'mg-from' }, names[d.pack], ': ', d.reason))),
          'mg-dropped',
        ),
      );
    }

    const versions = new Set(projects.map(packLabel));
    result.replaceChildren(
      h(
        'div',
        { class: 'cv-res-head' },
        h('span', { class: 'cv-res-icon is-ok' }, icon('check', { size: 32 })),
        h(
          'div',
          { class: 'cv-res-titles' },
          h('span', { class: 'eyebrow' }, `${plural(projects.length, 'pack')}${versions.size === 1 ? ` · ${[...versions][0]}` : ''} → ${edition === 'java' ? `Java ${report.version}` : 'Bedrock'}`),
          h('h2', { id: resultTitleId }, `${plural(projects.length, 'pack')} merged into “${plainText(project.name)}”`),
          h('p', { class: 'muted cv-saved' }, `Saved in your texture packs · ${packFileName(project)}`),
        ),
      ),
      h(
        'div',
        { class: 'cv-summary' },
        h('div', { class: 'cv-stats' }, stat(report.files, report.files === 1 ? 'file' : 'files', 'ok'), stat(report.textures, report.textures === 1 ? 'texture' : 'textures', 'muted'), stat(report.conflicts.length, report.conflicts.length === 1 ? 'conflict' : 'conflicts', report.conflicts.length ? 'warn' : 'muted'), stat(report.merged.length, report.merged.length === 1 ? 'merged file' : 'merged files', 'muted')),
      ),
      h('div', { class: 'mg-contrib-box' }, h('h3', { class: 'mg-sub' }, 'Files from each pack'), contrib, legend),
      h('div', { class: 'cv-actions' }, dlBtn, openBtn, againBtn),
      dlBox,
      installBox,
      ...sections,
    );
    result.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function group(title: string, count: number, tone: 'ok' | 'warn' | 'muted', hintText: string | null, rows: HTMLElement[], cls: string): HTMLElement {
    const shown = rows.slice(0, LIST_LIMIT);
    return h(
      'details',
      { class: ['cv-group', `tone-${tone}`, cls] },
      h('summary', null, h('span', { class: 'cv-group-title' }, title), h('span', { class: 'cv-count' }, count.toLocaleString('en-US')), icon('chevron-down', { size: 16 })),
      hintText ? h('p', { class: 'faint small cv-group-hint' }, hintText) : null,
      h('ul', { class: 'cv-list' }, shown),
      rows.length > shown.length ? h('p', { class: 'faint small cv-more' }, `and ${(rows.length - shown.length).toLocaleString('en-US')} more`) : null,
    );
  }

  function row(path: string, detail: Node): HTMLElement {
    return h('li', null, h('code', { class: 'cv-from' }, path), h('span', { class: 'cv-detail faint small' }, detail));
  }

  function resetAll() {
    for (const e of entries) if (e.iconUrl) URL.revokeObjectURL(e.iconUrl);
    entries = [];
    iconChoice = 'auto';
    versionTouched = false;
    changed();
    step1.scrollIntoView({ behavior: 'smooth', block: 'center' });
    dz.focus();
  }

  // ---------------------------------------------------------------- page
  const stack = h('div', { class: 'mg-hero-stack' }, isoCube('oak_planks', 'oak_planks', 80), isoCube('stone', 'stone', 80), isoCube('grass_top', 'grass_side', 80));
  const art = h(
    'div',
    { class: 'cv-hero-art mg-hero-art', 'aria-hidden': 'true' },
    h('figure', null, stack, h('figcaption', null, icon('files', { size: 16 }), 'Your packs')),
    h('span', { class: 'cv-hero-arrows' }, icon('arrow-right', { size: 32 })),
    h('figure', null, isoCube('grass_top', 'oak_log', 96), h('figcaption', null, icon('package', { size: 16 }), 'One pack')),
  );
  const page = h(
    'div',
    { class: 'cv-page mg-page accent-green' },
    h(
      'header',
      { class: 'container cv-hero' },
      h(
        'div',
        { class: 'cv-hero-text' },
        h('span', { class: 'eyebrow' }, icon('git-merge'), 'Merge Texture Packs'),
        h('h1', { class: 'pixel-shadow' }, 'Merge Minecraft texture packs into ', h('span', { class: 'accent' }, 'one')),
        h('p', { class: 'lead' }, 'Add two to eight Java or Bedrock packs and put them in order. Where two packs change the same texture, the one at the top wins, just like in the game. Everything stays in your browser.'),
      ),
      art,
    ),
    h('div', { class: 'container cv-grid mg-grid' }, step1, step2, result),
    siteFooter(),
  );
  root.appendChild(page);
  paintList();
  paintSettings();

  return () => {
    alive = false;
    running?.abort();
    for (const e of entries) if (e.iconUrl) URL.revokeObjectURL(e.iconUrl);
    resultUrls.forEach((u) => URL.revokeObjectURL(u));
  };
}

function stepCard(n: number, title: string, text: string, ic: IconName, body: HTMLElement): HTMLElement {
  const id = uid('mg-step');
  return h(
    'section',
    { class: 'card cv-step mg-step', 'aria-labelledby': id, dataset: { step: String(n) } },
    h('div', { class: 'cv-step-head' }, h('span', { class: 'cv-step-n', 'aria-hidden': 'true' }, String(n)), h('div', null, h('h2', { id }, title), h('p', { class: 'muted' }, text)), h('span', { class: 'cv-step-icon', 'aria-hidden': 'true' }, icon(ic))),
    body,
  );
}
