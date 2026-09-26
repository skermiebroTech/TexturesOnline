// Export: the format menu, the download itself and a modal that explains where the file goes.

import { convertLegacySkin } from '../../../core/image';
import { saveBlob } from '../../../core/download';
import type { SkinModel } from '../../../core/types';
import { button, openPopover, withBusy } from '../../../ui/components';
import { h } from '../../../ui/dom';
import { icon, type IconName } from '../../../ui/icons';
import { openModal } from '../../../ui/modal';
import { toast } from '../../../ui/toast';
import { exportBedrockPack, exportBedrockPng, exportJavaLegacy, exportJavaPng, legacyLosses, type ExportKind, type ExportResult, type SkinProjectData } from '../export';
import { drawFigure } from './figure';

interface FormatInfo {
  kind: ExportKind;
  title: string;
  sub: string;
  icon: IconName;
  edition: 'Java' | 'Bedrock';
}

export const EXPORT_FORMATS: readonly FormatInfo[] = [
  { kind: 'java', title: 'Java skin (.png)', sub: 'Launcher or minecraft.net · 64×64', icon: 'monitor', edition: 'Java' },
  { kind: 'bedrock-pack', title: 'Bedrock skin pack (.mcpack)', sub: 'Opens straight in Minecraft', icon: 'package', edition: 'Bedrock' },
  { kind: 'bedrock-png', title: 'Bedrock skin (.png)', sub: 'For the Import slot in the Dressing Room', icon: 'smartphone', edition: 'Bedrock' },
  { kind: 'java-legacy', title: 'Old Java skin (64×32)', sub: 'Java 1.7.10 and older only', icon: 'clock', edition: 'Java' },
];

/** Popover listing the export formats. */
export function openExportMenu(anchor: HTMLElement, onPick: (kind: ExportKind) => void): void {
  const items = EXPORT_FORMATS.map((f) =>
    h(
      'button',
      { type: 'button', class: 'sk-export-item', role: 'menuitem', tabIndex: -1, dataset: { kind: f.kind } },
      h('span', { class: ['sk-export-icon', f.edition === 'Java' ? 'is-java' : 'is-bedrock'] }, icon(f.icon)),
      h('span', { class: 'sk-export-text' }, h('span', { class: 'sk-export-title' }, f.title), h('span', { class: 'sk-export-sub' }, `${f.edition} · ${f.sub}`)),
    ),
  );
  const list = h('div', { class: 'sk-export-menu', role: 'menu', 'aria-label': 'Export formats' }, items);
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
      onPick(EXPORT_FORMATS[i].kind);
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

function instructions(kind: ExportKind, model: SkinModel, filename: string, packName: string): Node[] {
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
          ['Pick your skin and press ', strong('Equip'), '.'],
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

async function runExport(kind: ExportKind, project: SkinProjectData, img: ImageData): Promise<ExportResult> {
  switch (kind) {
    case 'java':
      return exportJavaPng(img, project.name, project.model);
    case 'java-legacy':
      return exportJavaLegacy(img, project.name, project.model);
    case 'bedrock-png':
      return exportBedrockPng(img, project.name);
    case 'bedrock-pack':
      return exportBedrockPack(project, img);
  }
}

function figure(img: ImageData, model: SkinModel, label: string): HTMLElement {
  const c = h('canvas', { class: 'sk-figure', 'aria-hidden': 'true' });
  requestAnimationFrame(() => drawFigure(c, img, model));
  return h('figure', { class: 'sk-export-figure' }, h('div', { class: 'sk-export-stage' }, c), h('figcaption', null, label));
}

/**
 * Downloads the chosen format (legacy asks first, since it loses detail) and shows install steps.
 * `onProjectChanged` runs after a .mcpack export updated the stored uuids/version.
 */
export async function exportSkin(kind: ExportKind, project: SkinProjectData, img: ImageData, onProjectChanged: () => void): Promise<void> {
  const info = EXPORT_FORMATS.find((f) => f.kind === kind)!;
  if (kind === 'java-legacy') {
    const losses = legacyLosses(img, project.model);
    const after = convertLegacySkin(exportJavaLegacyImage(img), { forceOpaqueBase: false });
    const body = h(
      'div',
      { class: 'sk-export' },
      h('div', { class: 'sk-export-compare' }, figure(img, project.model, 'Your skin'), h('span', { class: 'sk-export-arrow' }, icon('arrow-right')), figure(after, 'classic', 'In old versions')),
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

  let res: ExportResult;
  try {
    res = await runExport(kind, project, img);
  } catch (err) {
    toast(err instanceof Error ? err.message : 'Export failed.', { tone: 'error' });
    return;
  }
  saveBlob(res.blob, res.filename);
  if (kind === 'bedrock-pack') onProjectChanged();

  const again = button({ label: 'Download again', icon: 'download', variant: 'secondary', size: 'sm' });
  again.addEventListener('click', () =>
    void withBusy(again, async () => {
      const r = kind === 'bedrock-pack' ? res : await runExport(kind, project, img);
      saveBlob(r.blob, r.filename);
    }),
  );
  const help = h('a', { class: 'sk-help-link', href: `#/help?s=${info.edition === 'Java' ? 'java-skins' : 'bedrock-skins'}` }, icon('book-open'), 'Full install guide');
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
        h('span', { class: 'sk-export-ok' }, icon('check'), 'Downloading'),
        h('code', { class: 'sk-export-name' }, res.filename),
        h('span', { class: 'muted small' }, `${info.edition} Edition · ${project.model === 'slim' ? 'Slim' : 'Classic'} arms`),
        h('div', { class: 'row', style: { '--gap': '8px', marginTop: '8px' } }, again),
      ),
    ),
    res.notes.length ? h('ul', { class: 'sk-export-notes' }, res.notes.map((n) => h('li', null, icon('info'), h('span', null, n)))) : null,
    ...instructions(kind, project.model, res.filename, project.name),
    help,
  );
  const m = openModal({ title: `Your ${info.edition} skin is ready`, body, width: 620, actions: [{ label: 'Done', variant: 'primary' }] });
  help.addEventListener('click', () => m.close());
}

function exportJavaLegacyImage(img: ImageData): ImageData {
  // Top half only (what 64x32 keeps); converting it back shows how old versions draw it.
  const out = new ImageData(64, 32);
  out.data.set(img.data.subarray(0, 64 * 32 * 4));
  return out;
}
