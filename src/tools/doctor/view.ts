// Pack Doctor at /pack-doctor: drop a pack that doesn't work (.zip, .mcpack, .mcaddon or a folder),
// say where you play, and get every problem explained, with one-click fixes and the fixed pack to
// download. This module is the light start screen; the checker, the fixer and the report
// (report-view.ts and the engine behind it) load when a pack is dropped.

import '../convert/convert.css';
import './doctor.css';
import type { Edition } from '../../core/types';
import type { RouteContext } from '../../core/router';
import { h, uid } from '../../ui/dom';
import { icon, type IconName } from '../../ui/icons';
import { badge, button, spinner } from '../../ui/components';
import { dropzone } from '../../ui/dropzone';
import { versionPicker } from '../../ui/version-picker';
import { friendlyError } from '../../core/net';
import { createImageData, cropImageData, imageDataToCanvas } from '../../core/pixels';
import { DEFAULT_JAVA_VERSION } from '../../editions/versions';
import { siteFooter } from '../../app/footer';
import { proceduralTexture, toImageData, type ProceduralTextureName } from '../../shared/preview/procedural-textures';
import { renderIsoCube } from '../textures/iso-cube';
import { plainText } from '../textures/ui/mc-text';
import { targetText } from '../convert/target';
import { t } from './i18n/text';
import { loadDoctorText } from './i18n/load';
import { kit } from '../../ui/i18n/kit';
import { fmt, fmtNodes } from '../../i18n/editor-text';
import type { PackInfo, ReportHandle, Source } from './report-view';

const reportView = () => import('./report-view');
const VERSION_KEY = 'doctor.javaVersion';

function remembered(): string {
  try {
    return localStorage.getItem(VERSION_KEY) || DEFAULT_JAVA_VERSION;
  } catch {
    return DEFAULT_JAVA_VERSION;
  }
}

function remember(v: string): void {
  try {
    localStorage.setItem(VERSION_KEY, v);
  } catch {
    /* private window */
  }
}

function cube(top: ImageData, side: ImageData, size: number): HTMLCanvasElement {
  const c = imageDataToCanvas(renderIsoCube(top, side, size));
  c.classList.add('pixelated');
  return c;
}

function procedural(n: ProceduralTextureName): ImageData {
  const img = toImageData(proceduralTexture(n));
  return img.height > img.width ? cropImageData(img, 0, 0, img.width, img.width) : img;
}

/** The game's purple and black "missing texture". */
function missingTexture(): ImageData {
  const img = createImageData(16, 16);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const o = (y * 16 + x) * 4;
      const purple = (x < 8) !== (y < 8);
      img.data.set(purple ? [248, 0, 248, 255] : [0, 0, 0, 255], o);
    }
  return img;
}

/** Files of a dropped folder, with their paths inside it. */
async function readEntry(entry: FileSystemEntry, prefix: string, out: { path: string; file: File }[]): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
    out.push({ path: prefix + entry.name, file });
    return;
  }
  if (!entry.isDirectory) return;
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
    if (!batch.length) break;
    for (const e of batch) await readEntry(e, `${prefix}${entry.name}/`, out);
  }
}

export default async function view(root: HTMLElement, ctx: RouteContext): Promise<() => void> {
  await loadDoctorText(ctx.locale);
  root.classList.add('doctor-view');
  let alive = true;
  let edition: Edition = 'java';
  let editionTouched = false;
  let javaVersion = remembered();
  let report: ReportHandle | null = null;
  let busyCount = 0;
  const urls: string[] = [];

  // ---------------------------------------------------------------- step 1: the pack
  const busy = h('div', { class: 'cv-busy', hidden: true }, spinner(32), h('span', null, t.step1.reading));
  const dz = dropzone({
    accept: '.zip,.mcpack,.mcaddon',
    label: t.step1.drop,
    hint: t.step1.dropHint,
    icon: 'folder',
    onFiles: (files) => void start({ kind: 'file', file: files[0] }),
  });
  dz.classList.add('cv-dz', 'dr-dz');
  // A dropped folder: read it ourselves (the drop zone only takes files).
  dz.addEventListener(
    'drop',
    (e) => {
      const item = e.dataTransfer?.items?.[0];
      const entry = item && typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null;
      if (!entry?.isDirectory) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      dz.classList.remove('dragging');
      const list: { path: string; file: File }[] = [];
      void (async () => {
        try {
          for (const child of await new Promise<FileSystemEntry[]>((res, rej) => (entry as FileSystemDirectoryEntry).createReader().readEntries(res, rej))) await readEntry(child, '', list);
        } catch (err) {
          dz.setError(friendlyError(err));
          return;
        }
        await start({ kind: 'folder', name: entry.name, list });
      })();
    },
    { capture: true },
  );
  const folderInput = h('input', { type: 'file', hidden: true, tabIndex: -1, attrs: { webkitdirectory: '', directory: '' } });
  folderInput.addEventListener('change', () => {
    const files = Array.from(folderInput.files ?? []);
    folderInput.value = '';
    if (!files.length) return;
    const top = (files[0].webkitRelativePath || files[0].name).split('/')[0];
    const list = files.map((f) => ({ path: (f.webkitRelativePath || f.name).split('/').slice(1).join('/') || f.name, file: f }));
    void start({ kind: 'folder', name: top, list });
  });
  const folderBtn = button({ label: t.step1.folder, icon: 'folder-plus', variant: 'ghost', size: 'sm', class: 'dr-folder-btn', onClick: () => folderInput.click() });
  const dzWrap = h('div', { class: 'cv-dz-wrap' }, dz, busy);
  const packBox = h('div', { class: 'cv-pack dr-pack', hidden: true });
  const step1 = stepCard(1, t.step1.title, t.step1.text, 'folder', h('div', { class: 'cv-step-body' }, dzWrap, h('div', { class: 'dr-folder-row' }, folderBtn, folderInput), packBox));

  function setBusy(on: boolean) {
    busyCount = Math.max(0, busyCount + (on ? 1 : -1));
    const b = busyCount > 0;
    busy.hidden = !b || dzWrap.hidden;
    dz.classList.toggle('is-busy', b);
    for (const c of editionCards) c.toggleAttribute('aria-disabled', b);
  }

  async function start(source: Source) {
    if (source.kind === 'folder' && !source.list.length) {
      dz.setError(t.step1.emptyFolder);
      return;
    }
    dz.setError(null);
    setBusy(true);
    try {
      const mod = await reportView();
      if (!alive) return;
      report ??= mod.createReport({
        root: result,
        locale: ctx.locale,
        target: chooseTarget,
        onPack: paintPack,
        onBusy: setBusy,
        onAgain: resetAll,
      });
      editionTouched = false;
      await report.check(source);
    } catch (err) {
      console.error(err);
      dz.setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  /** The game to check for: the visitor's choice, else the edition of the pack. */
  function chooseTarget(detected: Edition | null) {
    if (!editionTouched && detected && detected !== edition) {
      edition = detected;
      paintTarget();
    }
    return edition === 'bedrock' ? { edition, version: 'latest' } : { edition, version: javaVersion };
  }

  function paintPack(info: PackInfo | null) {
    urls.splice(0).forEach((u) => URL.revokeObjectURL(u));
    if (!info) {
      packBox.hidden = true;
      dzWrap.hidden = false;
      paintTarget();
      return;
    }
    const thumb = h('div', { class: 'cv-pack-icon checker' });
    if (info.icon) {
      const url = URL.createObjectURL(info.icon);
      urls.push(url);
      const img = h('img', { src: url, alt: '', class: 'pixelated' });
      img.addEventListener('error', () => thumb.replaceChildren(cube(procedural('grass_top'), procedural('grass_side'), 64)));
      thumb.appendChild(img);
    } else thumb.appendChild(cube(missingTexture(), missingTexture(), 64));
    const name = plainText(info.name) || t.step1.untitled;
    packBox.replaceChildren(
      h(
        'div',
        { class: 'cv-pack-row' },
        thumb,
        h(
          'div',
          { class: 'cv-pack-info' },
          h('strong', { class: 'cv-pack-name truncate', title: `${name} (${info.fileName})` }, name),
          h(
            'span',
            { class: 'cv-pack-badges' },
            info.edition ? badge(info.edition === 'java' ? (info.packVersion ? fmt(kit.edition.javaVersion, { version: info.packVersion }) : kit.edition.java) : kit.edition.bedrock, info.edition === 'java' ? 'green' : 'blue') : null,
          ),
          h('span', { class: 'faint small dr-pack-counts' }, [fmt(t.step1.files, { count: info.files }), info.textures ? fmt(t.step1.textures, { count: info.textures }) : null].filter(Boolean).join(' · ')),
        ),
        button({ label: t.step1.change, icon: 'folder', variant: 'ghost', size: 'sm', class: 'cv-change', title: t.step1.changeTitle, onClick: () => (dz.querySelector('input[type=file]') as HTMLInputElement | null)?.click() }),
      ),
      ...(info.description ? [h('p', { class: 'faint small cv-pack-desc' }, plainText(info.description))] : []),
    );
    packBox.hidden = false;
    dzWrap.hidden = true;
    busy.hidden = true;
    paintTarget();
  }

  // ---------------------------------------------------------------- step 2: the game
  const editionCards = (['java', 'bedrock'] as Edition[]).map((e) => {
    const b = h(
      'button',
      { type: 'button', class: 'cv-ed', role: 'radio', dataset: { value: e } },
      h('span', { class: 'cv-ed-icon' }, icon(e === 'java' ? 'laptop' : 'gamepad')),
      h('span', { class: 'cv-ed-text' }, h('strong', null, e === 'java' ? t.step2.java : t.step2.bedrock), h('span', { class: 'faint small' }, e === 'java' ? t.step2.javaDevices : t.step2.bedrockDevices)),
      h('span', { class: 'cv-ed-check' }, icon('check', { size: 16 })),
    );
    b.addEventListener('click', () => chooseEdition(e));
    b.addEventListener('keydown', (ev) => {
      if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(ev.key)) {
        ev.preventDefault();
        const other: Edition = e === 'java' ? 'bedrock' : 'java';
        chooseEdition(other);
        (editionGroup.querySelector(`[data-value="${other}"]`) as HTMLElement | null)?.focus();
      }
    });
    return b;
  });
  const editionGroup = h('div', { class: 'cv-eds', role: 'radiogroup', 'aria-label': t.step2.title }, editionCards);
  const picker = versionPicker({
    edition: 'java',
    value: javaVersion,
    label: t.step2.version,
    onChange: (_e, v) => {
      javaVersion = v;
      remember(v);
      paintTarget();
      void recheck();
    },
  });
  const pickerWrap = h('div', { class: 'cv-version dr-version' }, picker);
  const targetHint = h('p', { class: 'cv-hint dr-hint', role: 'status' });
  const step2 = stepCard(2, t.step2.title, t.step2.text, 'gamepad', h('div', { class: 'cv-step-body' }, editionGroup, pickerWrap, targetHint));

  function chooseEdition(e: Edition) {
    if (e === edition || busyCount) return;
    edition = e;
    editionTouched = true;
    paintTarget();
    void recheck();
  }

  async function recheck() {
    if (!report?.hasPack()) return;
    const reset = report.hasFixes();
    await report.recheck();
    if (reset && alive) targetHint.textContent = `${targetHint.textContent} ${t.step2.reset}`;
  }

  function paintTarget() {
    for (const b of editionCards) {
      const on = b.dataset.value === edition;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    }
    pickerWrap.hidden = edition !== 'java';
    const target = edition === 'bedrock' ? { edition, version: 'latest' } : { edition, version: javaVersion };
    targetHint.textContent = report?.hasPack() ? fmt(t.step2.hint, { target: targetText(target) }) : t.step2.hintNone;
  }

  // ---------------------------------------------------------------- result
  const result = h('section', { class: 'card cv-result dr-result', hidden: true, 'aria-live': 'polite', 'aria-labelledby': uid('dr-res') });

  function resetAll() {
    report?.clear();
    paintPack(null);
    step1.scrollIntoView({ behavior: 'smooth', block: 'center' });
    dz.focus();
  }

  // ---------------------------------------------------------------- page
  const art = h(
    'div',
    { class: 'cv-hero-art dr-hero-art', 'aria-hidden': 'true' },
    h('figure', null, cube(missingTexture(), missingTexture(), 96), h('figcaption', null, icon('warning-diamond', { size: 16 }), t.hero.broken)),
    h('span', { class: 'cv-hero-arrows' }, icon('potion', { size: 32 })),
    h('figure', null, cube(procedural('grass_top'), procedural('grass_side'), 96), h('figcaption', null, icon('check', { size: 16 }), t.hero.fixed)),
  );
  const page = h(
    'div',
    { class: 'cv-page dr-page accent-green' },
    h(
      'header',
      { class: 'container cv-hero' },
      h(
        'div',
        { class: 'cv-hero-text' },
        h('span', { class: 'eyebrow' }, icon('potion'), t.hero.eyebrow),
        h('h1', { class: 'pixel-shadow' }, fmtNodes(t.hero.title, { pack: h('span', { class: 'accent' }, t.hero.pack) })),
        h('p', { class: 'lead' }, t.hero.lead),
      ),
      art,
    ),
    h('div', { class: 'container cv-grid dr-grid' }, step1, step2, result),
    siteFooter(),
  );
  root.appendChild(page);
  paintTarget();

  return () => {
    alive = false;
    report?.destroy();
    urls.forEach((u) => URL.revokeObjectURL(u));
  };
}

function stepCard(n: number, title: string, text: string, ic: IconName, body: HTMLElement): HTMLElement {
  const id = uid('dr-step');
  return h(
    'section',
    { class: 'card cv-step dr-step', 'aria-labelledby': id, dataset: { step: String(n) } },
    h('div', { class: 'cv-step-head' }, h('span', { class: 'cv-step-n', 'aria-hidden': 'true' }, String(n)), h('div', null, h('h2', { id }, title), h('p', { class: 'muted' }, text)), h('span', { class: 'cv-step-icon', 'aria-hidden': 'true' }, icon(ic))),
    body,
  );
}
