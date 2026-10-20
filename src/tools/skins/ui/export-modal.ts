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
import { drawFigure } from './figure';

interface FormatInfo {
  kind: ExportKind;
  title: string;
  sub: string;
  icon: IconName;
  edition: 'Java' | 'Bedrock';
}

export const EXPORT_FORMATS: readonly FormatInfo[] = [
  { kind: 'java', title: 'Java skin (.png)', sub: 'For the Launcher or minecraft.net', icon: 'monitor', edition: 'Java' },
  { kind: 'bedrock-pack', title: 'Bedrock skin pack (.mcpack)', sub: 'One or more skins, opens in Minecraft', icon: 'package', edition: 'Bedrock' },
  { kind: 'bedrock-png', title: 'Bedrock skin (.png)', sub: 'For the Dressing Room import slot', icon: 'smartphone', edition: 'Bedrock' },
  { kind: 'java-legacy', title: 'Old Java skin (64×32)', sub: 'Java 1.7.10 and older', icon: 'clock', edition: 'Java' },
];

/** Extra entry below the formats that does something other than exporting (e.g. make a totem). */
export interface ExportExtra {
  title: string;
  sub: string;
  icon: IconName;
  onPick: () => void;
}

/** Popover listing the export formats, plus optional extra actions after a divider. */
export function openExportMenu(anchor: HTMLElement, onPick: (kind: ExportKind) => void, extras: ExportExtra[] = []): PopoverHandle {
  const item = (cls: string, ic: IconName, title: string, sub: string, kind?: string) =>
    h(
      'button',
      { type: 'button', class: 'sk-export-item', role: 'menuitem', tabIndex: -1, dataset: kind ? { kind } : {} },
      h('span', { class: ['sk-export-icon', cls] }, icon(ic)),
      h('span', { class: 'sk-export-text' }, h('span', { class: 'sk-export-title' }, title), h('span', { class: 'sk-export-sub' }, sub)),
    );
  const formatItems = EXPORT_FORMATS.map((f) => item(f.edition === 'Java' ? 'is-java' : 'is-bedrock', f.icon, f.title, f.sub, f.kind));
  const extraItems = extras.map((x) => item('is-extra', x.icon, x.title, x.sub));
  const items = [...formatItems, ...extraItems];
  const list = h(
    'div',
    { class: 'sk-export-menu', role: 'menu', 'aria-label': 'Export formats' },
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
  return m === 'slim' ? 'Slim (3-pixel arms)' : 'Classic (4-pixel arms)';
}

function instructions(kind: ExportKind, model: SkinModel, filename: string, packName: string, skinCount = 1): Node[] {
  switch (kind) {
    case 'java':
      return [
        h('h3', { class: 'sk-guide-title' }, icon('monitor'), 'Minecraft Launcher'),
        steps(
          ['Open the Launcher and go to ', path('Minecraft: Java Edition', 'Skins'), '.'],
          ['Click ', strong('New skin'), ', give it a name and choose ', strong(modelName(model)), '.'],
          ['Click ', strong('Browse'), ', pick ', h('code', null, filename), ', then ', strong('Save & Use'), '.'],
        ),
        h('h3', { class: 'sk-guide-title' }, icon('globe'), 'Or on minecraft.net'),
        steps(['Sign in, open your profile and choose ', strong(modelName(model)), '.'], 'Upload the PNG. It shows up next time you join a world.'),
      ];
    case 'java-legacy':
      return [
        h('p', null, 'Use this file only where a 64×32 skin is required: Java 1.7.10 and older, or launchers and servers for those versions. Newer versions read the normal 64×64 skin.'),
      ];
    case 'bedrock-pack':
      return [
        h('h3', { class: 'sk-guide-title' }, icon('package'), 'Install the skin pack'),
        steps(
          ['Open ', h('code', null, filename), ': double-click it on Windows, or tap it and choose ', strong('Open with Minecraft'), ' on phones and tablets.'],
          'Minecraft starts and says the import was successful.',
          ['Go to ', path('Dressing Room', 'Classic Skins'), ' and scroll to the pack ', strong(packName), '.'],
          skinCount > 1 ? ['Pick one of the ', strong(String(skinCount)), ' skins and press ', strong('Equip'), '.'] : ['Pick your skin and press ', strong('Equip'), '.'],
        ),
        h('p', { class: 'sk-note' }, icon('info'), "Consoles can't import skin packs. Friends with “Only Allow Trusted Skins” turned on will see a default skin."),
      ];
    case 'bedrock-png':
      return [
        h('h3', { class: 'sk-guide-title' }, icon('smartphone'), 'Import in the Dressing Room'),
        steps(
          ['Open ', path('Dressing Room', 'Classic Skins'), '.'],
          ['Under ', strong('Owned'), ' select the blank ', strong('Import'), ' slot, then ', strong('Choose New Skin'), '.'],
          ['Pick ', h('code', null, filename), ' and choose the ', strong(model === 'slim' ? 'slim (Alex)' : 'classic (Steve)'), ' arm model.'],
        ),
      ];
  }
}

async function runExport(kind: ExportKind, project: SkinProjectData, img: ImageData, packSkins: readonly PackSkinSource[] = []): Promise<ExportResult> {
  switch (kind) {
    case 'java':
      return exportJavaPng(img, project.name, project.model);
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
  return m === 'slim' ? 'Slim arms' : 'Classic arms';
}

function packRow(opts: { name: string; model: SkinModel; image: ImageData | Blob; checked: boolean; current?: boolean; id?: string }): HTMLLabelElement {
  const thumb = h('span', { class: 'sk-pack-thumb' });
  const draw = (img: ImageData) => {
    if (img.width !== 64 || img.height !== 64) return;
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
    h('span', { class: 'sk-pack-info' }, h('span', { class: 'sk-pack-name truncate' }, opts.name || 'Untitled'), h('span', { class: 'sk-pack-meta' }, armsLabel(opts.model))),
    opts.current ? badge('This skin', 'blue') : null,
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
    label: 'Pack name',
    value: packName,
    maxLength: 60,
    description: 'Shown in the Dressing Room under Classic Skins.',
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
    allBtn.querySelector('.btn-label')!.textContent = all ? 'Clear' : 'Select all';
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
      h('h3', { class: 'sk-guide-title' }, icon('package'), 'Skins in this pack'),
      count,
      allBtn,
    ),
    h(
      'div',
      { class: 'sk-pack-list', role: 'group', 'aria-label': 'Skins in this pack' },
      packRow({ name: project.name, model: project.model, image: img, checked: true, current: true }),
      rows,
    ),
    h('p', { class: 'sk-note' }, icon('info'), 'Each skin keeps its own name and arm model. Exporting again updates the installed pack.'),
  );

  let result: PackSkinSource[] | null = null;
  let resolveChoice: (v: PackSkinSource[] | null) => void = () => {};
  const choice = new Promise<PackSkinSource[] | null>((resolve) => (resolveChoice = resolve));
  const modal = openModal({
    title: 'Make a skin pack',
    body,
    width: 560,
    initialFocus: nameField.input,
    // Runs once the dialog is gone, so the next dialog returns focus properly.
    onClose: () => resolveChoice(result),
    actions: [
      { label: 'Cancel', variant: 'ghost' },
      {
        label: 'Download pack',
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
      h('div', { class: 'sk-export-compare' }, figure(img, project.model, 'Your skin'), h('span', { class: 'sk-export-arrow' }, icon('arrow-right')), figure(after, 'classic', 'Old versions')),
      losses.length
        ? h('div', { class: 'sk-losses' }, h('h3', { class: 'sk-guide-title' }, icon('warning'), 'What changes'), h('ul', null, losses.map((l) => h('li', null, l))))
        : h('p', { class: 'sk-note' }, icon('check'), 'Nothing gets lost: your skin already fits the old layout.'),
      ...instructions(kind, project.model, '', project.name),
    );
    openModal({
      title: 'Export for old Java versions',
      body,
      width: 620,
      actions: [
        { label: 'Cancel', variant: 'ghost' },
        {
          label: 'Download 64×32 PNG',
          variant: 'primary',
          onClick: async () => {
            const res = await runExport(kind, project, img);
            saveBlob(res.blob, res.filename);
            toast(`Downloaded ${res.filename}`, { tone: 'success' });
          },
        },
      ],
    });
    return;
  }

  let packSkins: PackSkinSource[] = [];
  if (kind === 'bedrock-pack') {
    const chosen = await choosePackSkins(project, img);
    if (!chosen || !isOpen()) return;
    packSkins = chosen;
  }

  let res: ExportResult;
  try {
    res = await runExport(kind, project, img, packSkins);
  } catch (err) {
    toast(err instanceof Error ? err.message : 'Export failed.', { tone: 'error' });
    return;
  }
  saveBlob(res.blob, res.filename);
  if (kind === 'bedrock-pack') onProjectChanged();
  // Left the editor while the file was being built: the download still happens, but no dialog.
  if (!isOpen()) return;

  const skinCount = res.skinCount ?? 1;
  const again = button({ label: 'Download again', icon: 'download', variant: 'secondary', size: 'sm' });
  again.addEventListener('click', () =>
    void withBusy(again, async () => {
      const r = kind === 'bedrock-pack' ? res : await runExport(kind, project, img);
      saveBlob(r.blob, r.filename);
    }),
  );
  const help = h('a', { class: 'sk-help-link', href: routeHref(`/help?s=${info.edition === 'Java' ? 'java-skins' : 'bedrock-skins'}`) }, icon('book-open'), 'Full install guide');
  const body = h(
    'div',
    { class: 'sk-export' },
    h(
      'div',
      { class: 'sk-export-done' },
      figure(img, project.model, project.name),
      h(
        'div',
        { class: 'sk-export-file' },
        h('span', { class: 'sk-export-ok' }, icon('check'), 'Download started'),
        h('code', { class: 'sk-export-name' }, res.filename),
        h('span', { class: 'muted small sk-export-meta' }, [`${info.edition} Edition`, skinCount > 1 ? null : armsLabel(project.model), res.meta].filter(Boolean).join(' · ')),
        h('div', { class: 'row', style: { '--gap': '8px', marginTop: '8px' } }, again),
      ),
    ),
    res.notes.length ? h('ul', { class: 'sk-export-notes' }, res.notes.map((n) => h('li', null, icon('info'), h('span', null, n)))) : null,
    ...instructions(kind, project.model, res.filename, kind === 'bedrock-pack' ? packNameOf(project) : project.name, skinCount),
    help,
  );
  const m = openModal({ title: skinCount > 1 ? `Your ${info.edition} skin pack is ready` : `Your ${info.edition} skin is ready`, body, width: 620, actions: [{ label: 'Done', variant: 'primary' }] });
  help.addEventListener('click', () => m.close());
}

function exportJavaLegacyImage(img: ImageData): ImageData {
  // Top half only (what 64x32 keeps); converting it back shows how old versions draw it.
  const out = new ImageData(64, 32);
  out.data.set(img.data.subarray(0, 64 * 32 * 4));
  return out;
}
