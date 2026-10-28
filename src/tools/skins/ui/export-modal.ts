// Export: the format menu, the download itself and a modal that explains where the file goes.

import { convertLegacySkin, decodeImage } from '../../../core/image';
import { listProjects } from '../../../core/storage';
import { href as routeHref } from '../../../core/router';
import { saveBlob } from '../../../core/download';
import type { SkinModel } from '../../../core/types';
import { badge, button, openPopover, textInput, withBusy } from '../../../ui/components';
import type { PopoverHandle } from '../../../ui/popover';
import { h } from '../../../ui/dom';
import { icon, type IconName } from '../../../ui/icons';
import { openModal } from '../../../ui/modal';
import { toast } from '../../../ui/toast';
import {
  exportBedrockPack,
  exportBedrockPng,
  exportJavaLegacy,
  exportJavaPng,
  hdLossPercent,
  javaImage,
  legacyLosses,
  legacySource,
  orderPackSkinIds,
  packNameOf,
  pickPackSkins,
  skinCountLabel,
  type ExportKind,
  type ExportResult,
  type PackSkinSource,
  type SkinProjectData,
} from '../export';
import { isHdSkin } from '../templates';
import { drawFigure } from './figure';
import { fmt, fmtNodes } from '../../../i18n/editor-text';
import { kit } from '../../../ui/i18n/kit';
import { exportText as t } from '../i18n/export';

interface FormatInfo {
  readonly kind: ExportKind;
  readonly title: string;
  readonly sub: string;
  /** Menu line for an HD skin: what the format does with the extra detail */
  readonly hdSub: string;
  readonly icon: IconName;
  readonly edition: 'Java' | 'Bedrock';
}

/** Text is read in the current language each time (getters). */
const format = (kind: ExportKind, icon: IconName, edition: 'Java' | 'Bedrock', key: 'java' | 'bedrockPack' | 'bedrockPng' | 'legacy'): FormatInfo => ({
  kind,
  icon,
  edition,
  get title() {
    return t.menu[key];
  },
  get sub() {
    return t.menu[`${key}Sub`];
  },
  get hdSub() {
    return t.menu[`${key}Hd`];
  },
});

export const EXPORT_FORMATS: readonly FormatInfo[] = [
  format('java', 'monitor', 'Java', 'java'),
  format('bedrock-pack', 'package', 'Bedrock', 'bedrockPack'),
  format('bedrock-png', 'smartphone', 'Bedrock', 'bedrockPng'),
  format('java-legacy', 'clock', 'Java', 'legacy'),
];

/** Extra entry below the formats that does something other than exporting (e.g. make a totem). */
export interface ExportExtra {
  title: string;
  sub: string;
  icon: IconName;
  onPick: () => void;
}

/** Popover listing the export formats, plus optional extra actions after a divider. `hd`: the skin is 128x128. */
export function openExportMenu(anchor: HTMLElement, onPick: (kind: ExportKind) => void, extras: ExportExtra[] = [], opts: { hd?: boolean } = {}): PopoverHandle {
  const item = (cls: string, ic: IconName, title: string, sub: string, kind?: string) =>
    h(
      'button',
      { type: 'button', class: 'sk-export-item', role: 'menuitem', tabIndex: -1, dataset: kind ? { kind } : {} },
      h('span', { class: ['sk-export-icon', cls] }, icon(ic)),
      h('span', { class: 'sk-export-text' }, h('span', { class: 'sk-export-title' }, title), h('span', { class: 'sk-export-sub' }, sub)),
    );
  const formatItems = EXPORT_FORMATS.map((f) => item(f.edition === 'Java' ? 'is-java' : 'is-bedrock', f.icon, f.title, opts.hd ? f.hdSub : f.sub, f.kind));
  const extraItems = extras.map((x) => item('is-extra', x.icon, x.title, x.sub));
  const items = [...formatItems, ...extraItems];
  const list = h(
    'div',
    { class: 'sk-export-menu', role: 'menu', 'aria-label': t.menu.label },
    formatItems,
    extraItems.length ? h('div', { class: 'sk-export-sep', role: 'separator' }) : null,
    extraItems,
  );
  anchor.setAttribute('aria-expanded', 'true');
  const pop = openPopover(anchor, list, {
    placement: 'bottom-end',
    focus: items[0],
    role: 'presentation',
    onClose: () => anchor.setAttribute('aria-expanded', 'false'),
  });
  items.forEach((b, i) => {
    b.addEventListener('click', () => {
      pop.close();
      if (i < EXPORT_FORMATS.length) onPick(EXPORT_FORMATS[i].kind);
      else extras[i - EXPORT_FORMATS.length].onPick();
    });
    b.addEventListener('keydown', (e) => {
      let n = -1;
      if (e.key === 'ArrowDown') n = (i + 1) % items.length;
      else if (e.key === 'ArrowUp') n = (i - 1 + items.length) % items.length;
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = items.length - 1;
      else if (e.key === 'Tab') pop.close();
      if (n >= 0) {
        e.preventDefault();
        items[n].focus();
      }
    });
  });
  return pop;
}

const strong = (t: string) => h('strong', null, t);
const path = (...parts: string[]) =>
  h('span', { class: 'sk-path' }, parts.map((p, i) => [i ? h('span', { class: 'sk-path-sep', 'aria-hidden': 'true' }, '›') : null, h('span', null, p)]));

function steps(...items: (string | Node | (string | Node)[])[]): HTMLElement {
  return h('ol', { class: 'sk-steps' }, items.map((it) => h('li', null, it)));
}

function modelName(m: SkinModel): string {
  return m === 'slim' ? t.steps.slimModel : t.steps.classicModel;
}

function instructions(kind: ExportKind, model: SkinModel, filename: string, packName: string, skinCount = 1): Node[] {
  const s = t.steps;
  const file = () => h('code', null, filename);
  switch (kind) {
    case 'java':
      return [
        h('h3', { class: 'sk-guide-title' }, icon('monitor'), s.launcherTitle),
        steps(
          fmtNodes(s.launcherOpen, { path: path('Minecraft: Java Edition', s.javaSkins) }),
          fmtNodes(s.launcherNew, { newSkin: strong(s.newSkin), model: strong(modelName(model)) }),
          fmtNodes(s.launcherBrowse, { browse: strong(s.browse), file: file(), save: strong(s.saveUse) }),
        ),
        h('h3', { class: 'sk-guide-title' }, icon('globe'), s.webTitle),
        steps(fmtNodes(s.webSignIn, { model: strong(modelName(model)) }), s.webUpload),
      ];
    case 'java-legacy':
      return [h('p', null, s.legacyText)];
    case 'bedrock-pack':
      return [
        h('h3', { class: 'sk-guide-title' }, icon('package'), s.packTitle),
        steps(
          fmtNodes(s.packOpen, { file: file(), openWith: strong(s.openWith) }),
          s.packImported,
          fmtNodes(s.packFind, { path: path(s.dressingRoom, s.classicSkins), pack: strong(packName) }),
          skinCount > 1 ? fmtNodes(s.packPickOne, { count: strong(String(skinCount)), equip: strong(s.equip) }) : fmtNodes(s.packPickYours, { equip: strong(s.equip) }),
        ),
        h('p', { class: 'sk-note' }, icon('info'), s.packNote),
      ];
    case 'bedrock-png':
      return [
        h('h3', { class: 'sk-guide-title' }, icon('smartphone'), s.pngTitle),
        steps(
          fmtNodes(s.pngOpen, { path: path(s.dressingRoom, s.classicSkins) }),
          fmtNodes(s.pngSlot, { owned: strong(s.owned), import: strong(s.import), choose: strong(s.chooseNew) }),
          fmtNodes(s.pngPick, { file: file(), model: strong(model === 'slim' ? s.pngSlim : s.pngClassic) }),
        ),
      ];
  }
}

async function runExport(kind: ExportKind, project: SkinProjectData, img: ImageData, packSkins: readonly PackSkinSource[] = [], keepHd = false): Promise<ExportResult> {
  switch (kind) {
    case 'java':
      return exportJavaPng(img, project.name, project.model, { keepHd });
    case 'java-legacy':
      return exportJavaLegacy(img, project.name, project.model);
    case 'bedrock-png':
      return exportBedrockPng(img, project.name);
    case 'bedrock-pack':
      return exportBedrockPack(project, img, packSkins);
  }
}

function figure(img: ImageData, model: SkinModel, label: string): HTMLElement {
  const c = h('canvas', { class: 'sk-figure', 'aria-hidden': 'true' });
  requestAnimationFrame(() => drawFigure(c, img, model));
  return h('figure', { class: 'sk-export-figure' }, h('div', { class: 'sk-export-stage' }, c), h('figcaption', null, label));
}

function armsLabel(m: SkinModel): string {
  return m === 'slim' ? t.pack.slimArms : t.pack.classicArms;
}

function packRow(opts: { name: string; model: SkinModel; image: ImageData | Blob; checked: boolean; current?: boolean; id?: string }): HTMLLabelElement {
  const thumb = h('span', { class: 'sk-pack-thumb' });
  const meta = h('span', { class: 'sk-pack-meta' }, armsLabel(opts.model));
  const draw = (img: ImageData) => {
    // 64x64 and HD 128x128 skins mix freely in one pack (each is its own texture).
    if (isHdSkin(img)) meta.textContent = `${armsLabel(opts.model)} · ${t.pack.hd}`;
    else if (img.width !== 64 || img.height !== 64) return;
    const c = h('canvas', { class: 'sk-figure', 'aria-hidden': 'true' });
    thumb.appendChild(c);
    requestAnimationFrame(() => drawFigure(c, img, opts.model));
  };
  if (opts.image instanceof Blob) {
    void decodeImage(opts.image, 'png')
      .then(draw)
      .catch(() => thumb.appendChild(icon('human')));
  } else draw(opts.image);
  const check = h('input', { type: 'checkbox', class: 'sk-pack-check', checked: opts.checked, disabled: !!opts.current, value: opts.id ?? '' });
  return h(
    'label',
    { class: ['sk-pack-skin', opts.current ? 'is-current' : null] },
    check,
    thumb,
    h('span', { class: 'sk-pack-info' }, h('span', { class: 'sk-pack-name truncate' }, opts.name || t.pack.untitled), meta),
    opts.current ? badge(t.pack.thisSkin, 'blue') : null,
  );
}

/**
 * Lets the user add other saved skins to the .mcpack. Resolves to the extra skins (in pack order),
 * or null when cancelled. With no other saved skins it resolves to [] straight away (one click).
 * Stores the choice on `project` (packSkinIds / packName).
 */
async function choosePackSkins(project: SkinProjectData, img: ImageData): Promise<PackSkinSource[] | null> {
  let saved: SkinProjectData[] = [];
  try {
    saved = ((await listProjects('skin')) as SkinProjectData[]).filter((p) => p.id !== project.id && p.image instanceof Blob);
  } catch {
    saved = [];
  }
  if (!saved.length) return [];

  // Skins already in the pack first (pack order), then the rest, most recently edited first.
  const inPack = pickPackSkins(project.packSkinIds, saved, project.id);
  const inPackIds = new Set(inPack.map((p) => p.id));
  const listed = [...inPack, ...saved.filter((p) => !inPackIds.has(p.id))];

  let packName = packNameOf(project);
  const nameField = textInput({
    label: t.pack.name,
    value: packName,
    maxLength: 60,
    description: t.pack.nameHint,
    onInput: (v) => (packName = v),
    onEnter: () => (modal.el.querySelector('.modal-footer .btn-primary') as HTMLButtonElement | null)?.click(),
  });
  const rows = listed.map((p) => packRow({ name: p.name, model: p.model, image: p.image, checked: inPackIds.has(p.id), id: p.id }));
  const boxes = rows.map((r) => r.querySelector('input') as HTMLInputElement);
  const count = h('span', { class: 'badge tone-gray sk-pack-count', 'aria-live': 'polite' });
  const allBtn = h('button', { type: 'button', class: 'btn btn-ghost btn-sm sk-pack-all' }, h('span', { class: 'btn-label' }));
  const sync = () => {
    const n = boxes.filter((b) => b.checked).length;
    count.textContent = skinCountLabel(n + 1);
    const all = n === boxes.length;
    allBtn.querySelector('.btn-label')!.textContent = all ? t.pack.clear : t.pack.selectAll;
  };
  boxes.forEach((b) => b.addEventListener('change', sync));
  allBtn.addEventListener('click', () => {
    const all = boxes.every((b) => b.checked);
    boxes.forEach((b) => (b.checked = !all));
    sync();
  });
  sync();

  const body = h(
    'div',
    { class: 'sk-export sk-pack' },
    nameField,
    h(
      'div',
      { class: 'sk-pack-head' },
      h('h3', { class: 'sk-guide-title' }, icon('package'), t.pack.skins),
      count,
      allBtn,
    ),
    h(
      'div',
      { class: 'sk-pack-list', role: 'group', 'aria-label': t.pack.skins },
      packRow({ name: project.name, model: project.model, image: img, checked: true, current: true }),
      rows,
    ),
    h('p', { class: 'sk-note' }, icon('info'), t.pack.note),
  );

  let result: PackSkinSource[] | null = null;
  let resolveChoice: (v: PackSkinSource[] | null) => void = () => {};
  const choice = new Promise<PackSkinSource[] | null>((resolve) => (resolveChoice = resolve));
  const modal = openModal({
    title: t.pack.title,
    body,
    width: 560,
    initialFocus: nameField.input,
    // Runs once the dialog is gone, so the next dialog returns focus properly.
    onClose: () => resolveChoice(result),
    actions: [
      { label: kit.cancel, variant: 'ghost' },
      {
        label: t.pack.download,
        variant: 'primary',
        onClick: () => {
          const name = packName.trim();
          project.packName = name && name !== (project.name || '').trim() ? name : undefined;
          project.packSkinIds = orderPackSkinIds(project.packSkinIds, boxes.filter((b) => b.checked).map((b) => b.value));
          result = pickPackSkins(project.packSkinIds, saved, project.id);
        },
      },
    ],
  });
  return choice;
}

/**
 * Downloads the chosen format (legacy asks first, since it loses detail) and shows install steps.
 * `onProjectChanged` runs after a .mcpack export updated the stored uuids/version.
 */
export async function exportSkin(kind: ExportKind, project: SkinProjectData, img: ImageData, onProjectChanged: () => void, isOpen: () => boolean = () => true): Promise<void> {
  const info = EXPORT_FORMATS.find((f) => f.kind === kind)!;
  if (kind === 'java-legacy') {
    const losses = legacyLosses(img, project.model);
    const after = convertLegacySkin(exportJavaLegacyImage(legacySource(img, project.model)), { forceOpaqueBase: false });
    const body = h(
      'div',
      { class: 'sk-export' },
      h('div', { class: 'sk-export-compare' }, figure(img, project.model, t.legacy.yourSkin), h('span', { class: 'sk-export-arrow' }, icon('arrow-right')), figure(after, 'classic', t.legacy.oldVersions)),
      losses.length
        ? h('div', { class: 'sk-losses' }, h('h3', { class: 'sk-guide-title' }, icon('warning'), t.legacy.changes), h('ul', null, losses.map((l) => h('li', null, l))))
        : h('p', { class: 'sk-note' }, icon('check'), t.legacy.nothingLost),
      ...instructions(kind, project.model, '', project.name),
    );
    openModal({
      title: t.legacy.title,
      body,
      width: 620,
      actions: [
        { label: kit.cancel, variant: 'ghost' },
        {
          label: t.legacy.download,
          variant: 'primary',
          onClick: async () => {
            const res = await runExport(kind, project, img);
            saveBlob(res.blob, res.filename);
            toast(fmt(t.done.downloaded, { file: res.filename }), { tone: 'success' });
          },
        },
      ],
    });
    return;
  }

  // HD skins on Java: a 64x64 copy (what the game shows), or the HD file for HD skin mods.
  let keepHd = false;
  if (kind === 'java' && isHdSkin(img)) {
    const choice = await chooseJavaSize(img, project.model);
    if (!choice || !isOpen()) return;
    keepHd = choice === 'hd';
  }

  let packSkins: PackSkinSource[] = [];
  if (kind === 'bedrock-pack') {
    const chosen = await choosePackSkins(project, img);
    if (!chosen || !isOpen()) return;
    packSkins = chosen;
  }

  let res: ExportResult;
  try {
    res = await runExport(kind, project, img, packSkins, keepHd);
  } catch (err) {
    toast(err instanceof Error ? err.message : t.done.failed, { tone: 'error' });
    return;
  }
  saveBlob(res.blob, res.filename);
  if (kind === 'bedrock-pack') onProjectChanged();
  // Left the editor while the file was being built: the download still happens, but no dialog.
  if (!isOpen()) return;

  const skinCount = res.skinCount ?? 1;
  const again = button({ label: t.done.again, icon: 'download', variant: 'secondary', size: 'sm' });
  again.addEventListener('click', () =>
    void withBusy(again, async () => {
      const r = kind === 'bedrock-pack' ? res : await runExport(kind, project, img, [], keepHd);
      saveBlob(r.blob, r.filename);
    }),
  );
  const help = h('a', { class: 'sk-help-link', href: routeHref(`/help#${info.edition === 'Java' ? 'java-skins' : 'bedrock-skins'}`) }, icon('book-open'), t.done.guide);
  const body = h(
    'div',
    { class: 'sk-export' },
    h(
      'div',
      { class: 'sk-export-done' },
      figure(kind === 'java' && !keepHd ? javaImage(img) : img, project.model, project.name),
      h(
        'div',
        { class: 'sk-export-file' },
        h('span', { class: 'sk-export-ok' }, icon('check'), t.done.started),
        h('code', { class: 'sk-export-name' }, res.filename),
        h('span', { class: 'muted small sk-export-meta' }, [info.edition === 'Java' ? t.done.javaEdition : t.done.bedrockEdition, skinCount > 1 ? null : armsLabel(project.model), res.meta].filter(Boolean).join(' · ')),
        h('div', { class: 'row', style: { '--gap': '8px', marginTop: '8px' } }, again),
      ),
    ),
    res.notes.length ? h('ul', { class: 'sk-export-notes' }, res.notes.map((n) => h('li', null, icon('info'), h('span', null, n)))) : null,
    ...instructions(kind, project.model, res.filename, kind === 'bedrock-pack' ? packNameOf(project) : project.name, skinCount),
    help,
  );
  const title = skinCount > 1 ? t.done.packReady : info.edition === 'Java' ? t.done.javaReady : t.done.bedrockReady;
  const m = openModal({ title, body, width: 620, actions: [{ label: t.done.finished, variant: 'primary' }] });
  help.addEventListener('click', () => m.close());
}

/** Asks how to export an HD skin for Java: reduced to 64x64 (default) or the HD file for mods. */
function chooseJavaSize(img: ImageData, model: SkinModel): Promise<'64' | 'hd' | null> {
  return new Promise((resolve) => {
    let answer: '64' | 'hd' | null = null;
    const lost = hdLossPercent(img);
    const body = h(
      'div',
      { class: 'sk-export' },
      h('div', { class: 'sk-export-compare' }, figure(img, model, t.hd.yourSkin), h('span', { class: 'sk-export-arrow' }, icon('arrow-right')), figure(javaImage(img), model, t.hd.java)),
      h('p', { class: 'sk-note is-warn sk-java-hd-note' }, icon('warning'), h('span', null, h('strong', null, t.hd.strong), t.hd.text)),
      lost ? h('p', { class: 'muted small' }, fmt(t.hd.lost, { percent: lost })) : h('p', { class: 'muted small' }, t.hd.nothingLost),
      h('p', { class: 'muted small' }, t.hd.mods),
    );
    openModal({
      title: t.hd.title,
      body,
      width: 620,
      onClose: () => resolve(answer),
      actions: [
        { label: kit.cancel, variant: 'ghost' },
        { label: t.hd.forMods, variant: 'secondary', onClick: () => void (answer = 'hd') },
        { label: t.hd.download64, variant: 'primary', onClick: () => void (answer = '64') },
      ],
    });
  });
}

function exportJavaLegacyImage(img: ImageData): ImageData {
  // Top half only (what 64x32 keeps); converting it back shows how old versions draw it.
  const out = new ImageData(64, 32);
  out.data.set(img.data.subarray(0, 64 * 32 * 4));
  return out;
}
