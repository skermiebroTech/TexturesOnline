// Saving and opening project files, and the backup and restore dialogs. Loaded on first use
// (./entry.ts): an editor's "Save project file", "Open a project file", a project file dropped on
// any drop zone, a file the installed app was opened with, the home page and the help page.

import './project-file.css';
import { saveBlob } from '../../core/download';
import { friendlyError } from '../../core/net';
import { listProjects } from '../../core/storage';
import { navigate } from '../../core/router';
import { h, timeAgo } from '../../ui/dom';
import { icon, type IconName } from '../../ui/icons';
import { badge, segmented, spinner } from '../../ui/components';
import { openModal } from '../../ui/modal';
import { toast } from '../../ui/toast';
import { kit } from '../../ui/i18n/kit';
import { fmt, intlLocale, textLocale } from '../../i18n/editor-text';
import { pf } from './i18n/text';
import { loadProjectFileText } from './i18n/load';
import { backupFileName, projectFileName, readProjectArchive, writeProjectArchive, ProjectFileError, type ItemType, type ManifestItem, type ProjectArchive, type ProjectItem, type ProjectTool } from './format';
import { collectAll, collectProject, existsHere, readCapeItem, restoreItems, type ExistingChoice } from './records';
import { markBackedUp, openerFor, projectsChanged, setPending } from './handoff';

/** A saved project by id (saved first with `flush`), or a design the page passes as an item. */
export type SaveRequest = { id: string; flush?: () => Promise<unknown> } | { tool: ProjectTool; item: ProjectItem };

const ROUTE: Record<ItemType, string> = { texturepack: '/textures', skin: '/skins', shader: '/shaders', cape: '/cape-maker', font: '/font-maker' };
const TYPE_ICON: Record<ItemType, IconName> = { texturepack: 'image', skin: 'human', shader: 'sparkles', cape: 'bookmark', font: 'text-start-a' };
const TYPE_ACCENT: Record<ItemType, string> = { texturepack: 'accent-green', skin: 'accent-blue', shader: 'accent-purple', cape: 'accent-blue', font: 'accent-green' };
const TYPE_ORDER: ItemType[] = ['texturepack', 'skin', 'shader', 'cape', 'font'];

const loadText = () => loadProjectFileText(textLocale());

function errorText(err: unknown, context?: string): string {
  if (err instanceof ProjectFileError) return err.message;
  return friendlyError(err, context);
}

const plain = (name: string) => name.replace(/§./g, '').trim() || pf.untitled;

// ---------------------------------------------------------------------------------------------
// Saving

/** Downloads a .tpmproject file. Resolves false (after saying why) when it couldn't be made. */
export async function saveProjectFile(req: SaveRequest): Promise<boolean> {
  await loadText();
  try {
    if ('id' in req) await req.flush?.();
    const { tool, items } = 'id' in req ? await collectProject(req.id) : { tool: req.tool, items: [req.item] };
    const blob = await writeProjectArchive(tool, items);
    const file = projectFileName(plain(items[0].name));
    saveBlob(blob, file);
    toast(fmt(pf.saved, { file }), { tone: 'success', duration: 6000 });
    return true;
  } catch (err) {
    console.error(err);
    toast(errorText(err, pf.saveFailed), { tone: 'error', duration: 8000 });
    return false;
  }
}

// ---------------------------------------------------------------------------------------------
// Opening

/** Opens a project file (in its tool, as a new project) or a backup (the restore dialog). */
export async function openProjectFile(file: File): Promise<void> {
  await loadText();
  let archive: ProjectArchive;
  try {
    archive = await readProjectArchive(file);
  } catch (err) {
    console.warn(err);
    toast(errorText(err), { tone: 'error', duration: 9000 });
    return;
  }
  if (archive.manifest.tool === 'backup') openRestoreDialog(archive);
  else await openItems(archive);
}

async function openItems(archive: ProjectArchive): Promise<void> {
  let items: ProjectItem[];
  try {
    items = archive.manifest.items.map((it) => archive.load(it));
  } catch (err) {
    toast(errorText(err), { tone: 'error', duration: 9000 });
    return;
  }
  const main = items[0];
  // The cape and font makers keep one design: the open page takes it (and asks before replacing).
  if (main.type === 'cape' || main.type === 'font') {
    const opener = openerFor(main.type);
    if (opener) await opener(main);
    else {
      setPending(main);
      navigate(ROUTE[main.type]);
    }
    return;
  }
  const results = await restoreItems(items, { existing: 'copy' });
  const first = results[0];
  if (first.error) {
    console.error(first.error);
    toast(errorText(first.error, pf.saveFailed), { tone: 'error', duration: 9000 });
    return;
  }
  projectsChanged();
  toast(fmt(first.status === 'copy' ? pf.openedCopy : pf.opened, { name: plain(main.name) }), { tone: 'success' });
  const broken = results.find((r) => r.error);
  if (broken) toast(fmt(pf.errors.item, { name: plain(broken.item.name) }), { tone: 'warn', duration: 8000 });
  navigate(`${ROUTE[main.type]}/${encodeURIComponent(first.id)}`);
}

/** Asks before a cape from a file replaces the cape maker's cape; `saveCurrent` keeps it first. */
export async function confirmReplaceCape(name: string, saveCurrent: () => Promise<boolean>): Promise<boolean> {
  await loadText();
  return new Promise((resolve) => {
    let answer = false;
    openModal({
      title: pf.replace.capeTitle,
      width: 560,
      class: 'pf-modal',
      body: h('p', null, fmt(pf.replace.capeText, { name: plain(name) })),
      onClose: () => resolve(answer),
      actions: [
        { label: kit.cancel, variant: 'ghost' },
        {
          label: pf.replace.saveFirst,
          variant: 'secondary',
          onClick: async () => {
            answer = await saveCurrent();
            return answer;
          },
        },
        { label: pf.replace.replace, variant: 'primary', onClick: () => void (answer = true) },
      ],
    });
  });
}

/** The cape item's image, name and settings (for the cape maker). */
export { readCapeItem };

// ---------------------------------------------------------------------------------------------
// Backup

const typeCount = (type: ItemType, count: number) => fmt(pf.counts[type], { count });

/** The backup dialog: what is in this browser, and a button that downloads all of it as one file. */
export async function openBackupDialog(): Promise<void> {
  await loadText();
  const list = h('ul', { class: 'pf-summary' }, h('li', { class: 'pf-summary-loading' }, spinner(20)));
  const contains = h('h3', { class: 'pf-subtitle' }, pf.backup.contains);
  const body = h(
    'div',
    { class: 'pf-backup' },
    h('p', null, pf.backup.intro),
    contains,
    list,
    h('p', { class: 'pf-note' }, icon('info', { size: 16 }), h('span', null, pf.backup.gameFiles)),
  );
  const modal = openModal({
    title: pf.backup.title,
    width: 520,
    class: 'pf-modal',
    body,
    actions: [
      { label: kit.cancel, variant: 'ghost' },
      {
        label: pf.backup.download,
        variant: 'primary',
        onClick: async () => {
          try {
            const items = await collectAll();
            if (!items.length) {
              toast(pf.backup.none, { tone: 'info' });
              return false;
            }
            const blob = await writeProjectArchive('backup', items);
            const file = backupFileName();
            saveBlob(blob, file);
            markBackedUp();
            toast(fmt(pf.backup.done, { file }), { tone: 'success', duration: 6000 });
            return true;
          } catch (err) {
            console.error(err);
            toast(errorText(err, pf.backup.failed), { tone: 'error', duration: 8000 });
            return false;
          }
        },
      },
    ],
  });
  const download = modal.el.querySelector<HTMLButtonElement>('.modal-footer .btn-primary');
  try {
    const projects = await listProjects();
    const counts = new Map<ItemType, number>();
    for (const p of projects) {
      const type: ItemType = p.kind === 'texturepack' ? 'texturepack' : p.kind === 'skin' ? 'skin' : 'shader';
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    if (await existsHere({ type: 'cape', id: 'cape' })) counts.set('cape', 1);
    if (await existsHere({ type: 'font', id: 'font' })) counts.set('font', 1);
    const rows = TYPE_ORDER.filter((t) => counts.get(t)).map((t) =>
      h('li', { class: TYPE_ACCENT[t] }, h('span', { class: 'pf-type-icon' }, icon(TYPE_ICON[t])), h('span', null, typeCount(t, counts.get(t)!))),
    );
    list.replaceChildren(...(rows.length ? rows : [h('li', { class: 'pf-summary-empty muted' }, pf.backup.none)]));
    contains.hidden = !rows.length;
    if (download) download.disabled = !rows.length;
  } catch {
    list.replaceChildren(h('li', { class: 'pf-summary-empty muted' }, pf.backup.none));
  }
}

// ---------------------------------------------------------------------------------------------
// Restore

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(intlLocale(), { dateStyle: 'long', timeStyle: 'short' }).format(d);
  } catch {
    return d.toISOString().slice(0, 16).replace('T', ' ');
  }
}

interface Row {
  item: ManifestItem;
  here: boolean;
  box: HTMLInputElement;
  note: HTMLElement;
  el: HTMLElement;
}

/** Lets the user choose what to bring back from a backup, then restores it. */
export function openRestoreDialog(archive: ProjectArchive): void {
  const m = archive.manifest;
  let existing: ExistingChoice = 'skip';
  const rows: Row[] = [];
  const listEl = h('div', { class: 'pf-list', role: 'group', 'aria-label': pf.restore.choose });
  const sorted = [...m.items].sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type));
  for (const item of sorted) {
    const box = h('input', { type: 'checkbox', class: 'pf-check', checked: true }) as HTMLInputElement;
    const note = h('span', { class: 'pf-row-note', hidden: true });
    const tag = h('span', { class: 'pf-row-tag', hidden: true }, badge(pf.restore.already, 'gold'));
    const meta = [pf.types[item.type], item.updatedAt ? fmt(pf.restore.edited, { date: timeAgo(item.updatedAt) }) : ''].filter(Boolean).join(' · ');
    const el = h(
      'label',
      { class: ['pf-row', TYPE_ACCENT[item.type]], dataset: { type: item.type, id: item.id } },
      box,
      h('span', { class: 'pf-type-icon' }, icon(TYPE_ICON[item.type])),
      h('span', { class: 'pf-row-text' }, h('span', { class: 'pf-row-title' }, h('span', { class: 'pf-row-name truncate' }, plain(item.name)), tag), h('span', { class: 'pf-row-meta truncate' }, meta), note),
    );
    const row: Row = { item, here: false, box, note, el };
    rows.push(row);
    listEl.appendChild(el);
    box.addEventListener('change', sync);
    void existsHere(item).then((here) => {
      row.here = here;
      tag.hidden = !here;
      // the cape and font replace the ones here, so they wait to be picked
      if (here && (item.type === 'cape' || item.type === 'font')) box.checked = false;
      sync();
    });
  }

  const existingSeg = segmented<ExistingChoice>({
    value: existing,
    size: 'sm',
    label: pf.restore.existing,
    options: [
      { value: 'skip', label: pf.restore.skip },
      { value: 'copy', label: pf.restore.keepBoth },
    ],
    onChange: (v) => {
      existing = v;
      for (const r of rows) if (r.here && r.item.type !== 'cape' && r.item.type !== 'font') r.box.checked = v === 'copy';
      sync();
    },
  });
  const existingRow = h('div', { class: 'pf-existing', hidden: true }, h('span', { class: 'pf-existing-label' }, pf.restore.existing), existingSeg);
  const allBtn = h('button', { type: 'button', class: 'btn btn-ghost btn-sm pf-all' }, h('span', { class: 'btn-label' }, pf.restore.selectAll));
  allBtn.addEventListener('click', () => {
    const open = rows.filter((r) => !r.box.disabled);
    const all = open.every((r) => r.box.checked);
    for (const r of open) r.box.checked = !all;
    sync();
  });

  const created = formatDate(m.created);
  const body = h(
    'div',
    { class: 'pf-restore' },
    created ? h('p', null, fmt(pf.restore.intro, { date: created })) : null,
    existingRow,
    h('div', { class: 'pf-list-head' }, h('h3', { class: 'pf-subtitle' }, pf.restore.choose), h('span', { class: 'badge tone-gray pf-count' }), allBtn),
    listEl,
  );

  let restoreBtn: HTMLButtonElement | null = null;
  function chosen(): Row[] {
    return rows.filter((r) => r.box.checked && !r.box.disabled);
  }
  function sync(): void {
    const anyHere = rows.some((r) => r.here && r.item.type !== 'cape' && r.item.type !== 'font');
    existingRow.hidden = !anyHere;
    for (const r of rows) {
      const single = r.item.type === 'cape' || r.item.type === 'font';
      r.box.disabled = r.here && !single && existing === 'skip';
      if (r.box.disabled) r.box.checked = false;
      r.el.classList.toggle('is-off', r.box.disabled);
      const text = !r.here ? '' : single ? pf.restore.replaceNote : existing === 'skip' ? pf.restore.skipNote : pf.restore.copyNote;
      r.note.hidden = !text;
      r.note.textContent = text;
    }
    const n = chosen().length;
    const open = rows.filter((r) => !r.box.disabled);
    allBtn.querySelector('.btn-label')!.textContent = open.length && open.every((r) => r.box.checked) ? pf.restore.selectNone : pf.restore.selectAll;
    body.querySelector('.pf-count')!.textContent = String(n);
    if (restoreBtn) {
      restoreBtn.querySelector('.btn-label')!.textContent = fmt(pf.restore.restore, { count: n });
      restoreBtn.disabled = !n;
    }
  }

  const modal = openModal({
    title: pf.restore.title,
    width: 600,
    class: 'pf-modal pf-restore-modal',
    body,
    actions: [
      { label: kit.cancel, variant: 'ghost' },
      {
        label: fmt(pf.restore.restore, { count: rows.length }),
        variant: 'primary',
        onClick: async () => {
          await restore(chosen().map((r) => r.item));
          return true;
        },
      },
    ],
  });
  restoreBtn = modal.el.querySelector<HTMLButtonElement>('.modal-footer .btn-primary');
  sync();

  async function restore(picked: ManifestItem[]): Promise<void> {
    const items: ProjectItem[] = [];
    const failed: string[] = [];
    for (const it of picked) {
      try {
        items.push(archive.load(it));
      } catch {
        failed.push(plain(it.name));
      }
    }
    // An open cape or font maker takes its design itself (it shows it straight away).
    const toStore: ProjectItem[] = [];
    let done = 0;
    for (const it of items) {
      const opener = it.type === 'cape' || it.type === 'font' ? openerFor(it.type) : undefined;
      if (!opener) toStore.push(it);
      else {
        await opener(it);
        done++;
      }
    }
    const results = await restoreItems(toStore, { existing });
    for (const r of results) {
      if (r.error) {
        console.error(r.error);
        failed.push(plain(r.item.name));
      } else if (r.status !== 'skipped') done++;
    }
    projectsChanged();
    if (done) toast(fmt(pf.restore.done, { count: done }), { tone: 'success' });
    if (failed.length) toast(fmt(pf.restore.failed, { name: failed[0] }), { tone: 'warn', duration: 8000 });
  }
}
