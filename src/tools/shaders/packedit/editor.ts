// Shader pack editor ('#/shaders/:id' for imported packs). Iris / OptiFine packs get an Options tab
// (the pack's own menus as sliders and switches) and a Files tab; vanilla resource packs and
// Bedrock packs open in the Files tab. Choices and edits are saved in this browser.

import { debounce } from '../../../core/events';
import { href, navigate } from '../../../core/router';
import { saveProject } from '../../../core/storage';
import { friendlyError } from '../../../core/net';
import type { OptionValues } from '../../../core/types';
import { badge, button, emptyState, iconButton, spinner, tabs, tooltip } from '../../../ui/components';
import { dropzone } from '../../../ui/dropzone';
import { formatBytes, h, isTypingTarget } from '../../../ui/dom';
import { icon, type IconName } from '../../../ui/icons';
import { confirmDialog, openShortcutsSheet, promptDialog } from '../../../ui/modal';
import { toast } from '../../../ui/toast';
import { findPacks, PACK_ACCEPT, type PackKind } from '../import/detect';
import { createCodeView, type CodeView } from './code-view';
import { exportFileName, licenseNote, openPackExportDialog, settingsFileName } from './export-dialog';
import { formatted } from './fmt';
import { optionLabel, valueLabel, type ProfileDef } from './iris-layout';
import { optionValueString } from './iris-options';
import type { ChosenValues } from './iris-rewrite';
import { createOptionsView, type OptionsView } from './options-view';
import { stripFormatting } from './properties';
import { loadEdits, loadImportedFiles, saveEdits, saveImportedFiles, type ImportedPackProject } from './store';
import { PackWorkspace, type IrisModel } from './workspace';
import './packedit.css';

type Pane = 'options' | 'files' | 'pack';

const KIND_INFO: Record<PackKind, { label: string; icon: IconName; short: string }> = {
  iris: { label: 'Iris / OptiFine shader pack', icon: 'sparkles', short: 'Iris / OptiFine' },
  'java-vanilla': { label: 'Java resource pack', icon: 'sun', short: 'Java resource pack' },
  bedrock: { label: 'Bedrock pack', icon: 'cloud-sun', short: 'Bedrock pack' },
};

const PREFS_KEY = 'to-packedit-prefs';
interface Prefs {
  showHelp: boolean;
  open: Record<string, string[]>;
}
function loadPrefs(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as Partial<Prefs>;
    return { showHelp: p.showHelp !== false, open: p.open && typeof p.open === 'object' ? p.open : {} };
  } catch {
    return { showHelp: true, open: {} };
  }
}
function savePrefs(p: Prefs): void {
  try {
    const ids = Object.keys(p.open);
    if (ids.length > 30) for (const k of ids.slice(0, ids.length - 30)) delete p.open[k];
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* optional */
  }
}

function loadingView(root: HTMLElement, text: string): void {
  root.replaceChildren(h('div', { class: 'sh-loading' }, spinner(32), h('span', { class: 'muted' }, text)));
}

export async function mountPackEditor(root: HTMLElement, project: ImportedPackProject): Promise<() => void> {
  loadingView(root, `Opening “${project.name}”…`);
  let files: Record<string, Uint8Array> | null;
  let edits: Record<string, string>;
  try {
    [files, edits] = await Promise.all([loadImportedFiles(project), loadEdits(project)]);
  } catch (err) {
    root.replaceChildren(
      h(
        'div',
        { class: 'sh-message container' },
        emptyState({ icon: 'warning', title: "Couldn't open the pack", text: friendlyError(err), action: button({ label: 'All shader projects', icon: 'arrow-left', variant: 'primary', onClick: () => navigate('/shaders') }) }),
      ),
    );
    return () => {};
  }
  if (!root.isConnected) return () => {};
  if (!files) return missingFilesView(root, project);
  return buildPackEditor(root, project, new PackWorkspace(project.packFormat, files, edits));
}

/** The files were removed from this browser (storage cleared): let the user open the pack again. */
function missingFilesView(root: HTMLElement, project: ImportedPackProject): () => void {
  let disposed = false;
  let inner: (() => void) | null = null;
  const dz = dropzone({
    accept: PACK_ACCEPT,
    label: `Open ${project.sourceName} again`,
    hint: 'Your option changes are still saved and come back with it.',
    icon: 'folder',
    onFiles: (list) => void reattach(list[0]),
  });
  async function reattach(file: File | undefined): Promise<void> {
    if (!file) return;
    dz.setError(null);
    try {
      const found = (await findPacks(new Uint8Array(await file.arrayBuffer()), file.name)).filter((c) => c.kind === project.packFormat);
      if (!found.length) {
        dz.setError(`No ${KIND_INFO[project.packFormat].label.toLowerCase()} was found in “${file.name}”.`);
        return;
      }
      const pick = found.find((c) => c.fileName === project.sourceName) ?? found[0];
      await saveImportedFiles(project, pick.files);
      project.fileCount = Object.keys(pick.files).length;
      project.byteSize = pick.byteSize;
      await saveProject(project);
      if (disposed) return;
      toast('Pack files restored', { tone: 'success' });
      const edits = await loadEdits(project);
      inner = buildPackEditor(root, project, new PackWorkspace(project.packFormat, pick.files, edits));
    } catch (err) {
      dz.setError(friendlyError(err));
    }
  }
  root.replaceChildren(
    h(
      'div',
      { class: 'sh-message container' },
      h(
        'div',
        { class: 'pe-missing' },
        emptyState({
          icon: 'warning',
          title: 'The pack files are missing',
          text: `“${project.name}” is still in your projects, but its files were removed from this browser’s storage.`,
        }),
        dz,
        h('div', { class: 'row wrap', style: { justifyContent: 'center' } }, button({ label: 'All shader projects', icon: 'arrow-left', variant: 'ghost', onClick: () => navigate('/shaders') })),
      ),
    ),
  );
  return () => {
    disposed = true;
    inner?.();
  };
}

function buildPackEditor(root: HTMLElement, project: ImportedPackProject, ws: PackWorkspace): () => void {
  const kind = KIND_INFO[project.packFormat];
  const isIris = project.packFormat === 'iris';
  const prefs = loadPrefs();
  const disposers: (() => void)[] = [];
  let destroyed = false;

  // values: option name -> chosen value (only options that differ from the pack's default)
  let values: ChosenValues = {};
  for (const [k, v] of Object.entries(project.settings ?? {})) if (typeof v === 'string' || typeof v === 'boolean' || typeof v === 'number') values[k] = String(v);

  let model: IrisModel | null = isIris ? ws.irisModel() : null;
  let modelDirty = false;
  const pruneValues = () => {
    if (!model) return;
    const next: ChosenValues = {};
    for (const [k, v] of Object.entries(values)) {
      const o = model.set.options.get(k);
      if (!o) {
        next[k] = v; // kept while the option is missing (e.g. a half-finished edit)
        continue;
      }
      const s = optionValueString(o, v);
      if (s !== null && s !== o.defaultValue) next[k] = s;
    }
    values = next;
  };
  pruneValues();

  const valueOf = (name: string): string => {
    const o = model?.set.options.get(name);
    return values[name] ?? o?.defaultValue ?? '';
  };
  const changedNames = (): string[] => (model ? [...model.set.options.values()].filter((o) => values[o.name] !== undefined && values[o.name] !== o.defaultValue).map((o) => o.name) : []);

  // ------------------------------------------------------------------ saving
  type SaveState = 'saved' | 'saving' | 'dirty' | 'error';
  const saveEl = h('span', { class: 'sh-save', role: 'status', 'aria-live': 'polite' });
  const paintSave = (s: SaveState) => {
    if (saveEl.dataset.state === s) return;
    saveEl.dataset.state = s;
    const [ic, text] =
      s === 'saving' ? (['loader', 'Saving…'] as const) : s === 'dirty' ? (['clock', 'Unsaved changes'] as const) : s === 'error' ? (['warning', 'Not saved'] as const) : (['check', 'Saved'] as const);
    saveEl.replaceChildren(icon(ic), h('span', { class: 'sh-save-text' }, text));
  };
  paintSave('saved');
  let saving: Promise<void> | null = null;
  let again = false;
  let editsDirty = false;
  let errorShown = false;
  const saveNow = async (): Promise<void> => {
    if (saving) {
      again = true;
      return saving;
    }
    paintSave('saving');
    const settings: OptionValues = {};
    for (const [k, v] of Object.entries(values)) settings[k] = v;
    project.settings = settings;
    project.editedFiles = ws.editedPaths().length;
    const writeEdits = editsDirty;
    editsDirty = false;
    saving = Promise.all([saveProject(project), writeEdits ? saveEdits(project, { ...ws.edits }) : Promise.resolve()])
      .then(() => {
        errorShown = false;
        if (!destroyed) paintSave(again ? 'dirty' : 'saved');
      })
      .catch((err) => {
        if (writeEdits) editsDirty = true;
        if (!destroyed) paintSave('error');
        if (!errorShown) {
          errorShown = true;
          toast(friendlyError(err, "Your changes couldn't be saved"), { tone: 'error', duration: 8000, action: { label: 'Retry', onClick: () => void saveNow() } });
        }
      })
      .finally(() => {
        saving = null;
        if (again) {
          again = false;
          void saveNow();
        }
      });
    return saving;
  };
  const scheduleSave = debounce(() => void saveNow(), 700);
  const markDirty = () => {
    paintSave('dirty');
    scheduleSave();
  };

  // ------------------------------------------------------------------ history (option values)
  const undoStack: { values: ChosenValues; label: string; key: string | null; at: number }[] = [];
  const redoStack: { values: ChosenValues; label: string }[] = [];
  function record(label: string, key: string | null): void {
    const top = undoStack[undoStack.length - 1];
    const now = Date.now();
    if (top && key && top.key === key && now - top.at < 900) {
      top.at = now;
      return;
    }
    undoStack.push({ values: { ...values }, label, key, at: now });
    if (undoStack.length > 200) undoStack.shift();
    redoStack.length = 0;
  }

  // ------------------------------------------------------------------ header
  const title = h('h1', { class: 'sh-title truncate' }, project.name);
  const renameBtn = iconButton('pencil', 'Rename', () => void rename(), { size: 'sm' });
  const undoBtn = iconButton('undo', 'Undo (Ctrl+Z)', () => undo());
  const redoBtn = iconButton('redo', 'Redo (Ctrl+Shift+Z)', () => redo());
  const keysBtn = iconButton('keyboard', 'Keyboard shortcuts (?)', () => showShortcuts());
  keysBtn.classList.add('sh-keys-btn');
  const exportBtn = button({ label: 'Export', icon: 'download', variant: 'primary', class: 'sh-bar-export', onClick: () => doExport() });
  tooltip(exportBtn, `Export ${exportFileName(project)} (Ctrl+E)`);
  const back = h('a', { class: 'btn btn-ghost btn-sm sh-back', href: href('/shaders'), 'aria-label': 'All shader projects' }, icon('arrow-left'), h('span', { class: 'btn-label' }, 'Shaders'));
  const paneTabs = tabs<Pane>({
    value: isIris ? 'options' : 'files',
    tabs: isIris
      ? [
          { value: 'options', label: 'Options', icon: 'sliders' },
          { value: 'files', label: 'Files', icon: 'files' },
        ]
      : [
          { value: 'files', label: 'Files', icon: 'files' },
          { value: 'pack', label: 'Pack', icon: 'package' },
        ],
    onChange: (v) => show(v),
    label: 'Editor view',
  });
  paneTabs.classList.add('pe-tabs');
  const bar = h(
    'header',
    { class: 'sh-bar pe-bar' },
    back,
    h(
      'div',
      { class: 'sh-bar-title' },
      h('span', { class: 'sh-bar-icon' }, icon(kind.icon)),
      h('div', { class: 'sh-bar-names' }, title, h('span', { class: 'sh-bar-sub truncate' }, `${kind.short} · ${project.sourceName}`)),
      renameBtn,
    ),
    saveEl,
    paneTabs,
    h('div', { class: 'sh-bar-actions' }, ...(isIris ? [undoBtn, redoBtn] : []), keysBtn, exportBtn),
  );

  // ------------------------------------------------------------------ side panel (pack info, changes, export)
  const changesList = h('div', { class: 'pe-changes' });
  const editsList = h('div', { class: 'pe-changes' });
  const changesCount = h('span', { class: 'pe-count' });
  const editsCount = h('span', { class: 'pe-count' });
  const resetAllBtn = iconButton('recycle', 'Reset every option to the pack default', () => resetAll(), { size: 'sm' });
  const revertAllBtn = iconButton('undo', 'Revert every edited file', () => void revertAllFiles(), { size: 'sm' });

  function sideContent(): HTMLElement {
    const stats = [`${ws.paths.length} files`, formatBytes(project.byteSize)];
    if (model) stats.unshift(`${model.set.options.size} options`);
    const exportMain = button({ label: `Export ${exportFileName(project).endsWith('.mcpack') ? '.mcpack' : '.zip'}`, icon: 'download', variant: 'primary', class: 'pe-export-btn', onClick: () => doExport() });
    return h(
      'div',
      { class: 'pe-side-body' },
      h(
        'div',
        { class: 'pe-pack-card' },
        h('span', { class: 'pe-pack-icon' }, icon(kind.icon)),
        h(
          'div',
          { class: 'pe-pack-info' },
          h('span', { class: 'pe-pack-name' }, project.name),
          h('span', { class: 'pe-pack-file truncate', title: project.sourceName }, project.sourceName),
          h('span', { class: 'pe-pack-badges' }, badge(kind.short, project.packFormat === 'bedrock' ? 'blue' : project.packFormat === 'iris' ? 'purple' : 'gold'), badge('Imported', 'gray')),
          h('span', { class: 'faint small' }, stats.join(' · ')),
        ),
      ),
      project.description ? h('p', { class: 'pe-pack-desc small muted' }, formatted(project.description)) : null,
      model
        ? h(
            'section',
            { class: 'pe-side-section', 'aria-labelledby': 'pe-changes-title' },
            h('div', { class: 'pe-side-head' }, h('h3', { class: 'section-title', id: 'pe-changes-title' }, icon('sliders'), 'Changed options'), changesCount, h('span', { class: 'grow' }), resetAllBtn),
            changesList,
          )
        : null,
      h(
        'section',
        { class: 'pe-side-section', 'aria-labelledby': 'pe-edits-title' },
        h('div', { class: 'pe-side-head' }, h('h3', { class: 'section-title', id: 'pe-edits-title' }, icon('file-text'), 'Edited files'), editsCount, h('span', { class: 'grow' }), revertAllBtn),
        editsList,
      ),
      h(
        'section',
        { class: 'pe-side-section pe-side-export' },
        exportMain,
        model ? h('p', { class: 'faint small' }, `Or download ${settingsFileName(project)} from the export window to keep the original pack untouched.`) : null,
        licenseNote(),
      ),
    );
  }

  function paintChanges(): void {
    if (model) {
      const names = changedNames();
      changesCount.textContent = String(names.length);
      changesCount.hidden = names.length === 0;
      resetAllBtn.disabled = names.length === 0;
      if (!names.length) {
        changesList.replaceChildren(h('p', { class: 'pe-side-empty faint small' }, 'Nothing changed yet. The pack uses its own defaults.'));
      } else {
        changesList.replaceChildren(
          ...names.map((n) => {
            const o = model!.set.options.get(n)!;
            const label = stripFormatting(optionLabel(model!.lang, n));
            const reveal = h(
              'button',
              { type: 'button', class: 'pe-change-main', title: `Show ${label}` },
              h('span', { class: 'pe-change-name truncate' }, label),
              h(
                'span',
                { class: 'pe-change-values small' },
                h('span', { class: 'pe-change-old' }, stripFormatting(valueLabel(model!.lang, o, o.defaultValue))),
                icon('arrow-right'),
                h('span', { class: 'pe-change-new' }, stripFormatting(valueLabel(model!.lang, o, values[n]))),
              ),
            );
            reveal.addEventListener('click', () => revealOption(n));
            const reset = iconButton('reload', `Reset ${label}`, () => resetOption(n), { size: 'sm' });
            return h('div', { class: 'pe-change', dataset: { option: n } }, reveal, reset);
          }),
        );
      }
    }
    const edited = ws.editedPaths();
    editsCount.textContent = String(edited.length);
    editsCount.hidden = edited.length === 0;
    revertAllBtn.disabled = edited.length === 0;
    editsList.replaceChildren(
      ...(edited.length
        ? edited.map((p) => {
            const b = h('button', { type: 'button', class: 'pe-change-main', title: p }, icon('file-text'), h('span', { class: 'pe-change-name truncate' }, p));
            b.addEventListener('click', () => {
              show('files');
              codeView?.open(p);
            });
            return h('div', { class: 'pe-change is-file' }, b);
          })
        : [h('p', { class: 'pe-side-empty faint small' }, isIris ? 'No files edited. Advanced edits happen in the Files tab.' : 'No files edited yet.')]),
    );
  }

  // ------------------------------------------------------------------ options pane (Iris)
  let optionsView: OptionsView | null = null;
  const optionsHost = h('div', { class: 'pe-options-host' });
  const search = h('input', { class: 'input', type: 'search', placeholder: 'Search options', 'aria-label': 'Search options', autocomplete: 'off', spellcheck: false });
  search.addEventListener('input', () => optionsView?.search(search.value));
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && search.value) {
      e.stopPropagation();
      search.value = '';
      optionsView?.search('');
    }
  });
  const helpBtn = iconButton('circle-question', 'Show descriptions under each option', () => {
    prefs.showHelp = !prefs.showHelp;
    savePrefs(prefs);
    helpBtn.setActive(prefs.showHelp);
    optionsView?.setShowHelp(prefs.showHelp);
  }, { active: prefs.showHelp, size: 'sm' });
  const resetAllIcon = iconButton('recycle', 'Reset every option to the pack default', () => resetAll(), { size: 'sm' });
  const optionCount = h('span', { class: 'pe-count-plain faint small' });

  function buildOptionsView(): void {
    if (!model) return;
    const keepOpen = optionsView ? optionsView.openScreens() : (prefs.open[project.id] ?? []);
    optionsView = createOptionsView({
      model,
      value: valueOf,
      onChange: (name, v) => setValue(name, v),
      onReset: (name) => resetOption(name),
      onProfile: (p) => applyProfile(p),
      showHelp: prefs.showHelp,
    });
    optionsView.restoreOpen(keepOpen);
    optionsView.el.addEventListener('toggle', () => rememberOpen(), true);
    if (search.value) optionsView.search(search.value);
    optionsHost.replaceChildren(optionsView.el);
    optionCount.textContent = `${model.set.options.size} options`;
  }
  const rememberOpen = debounce(() => {
    if (!optionsView) return;
    prefs.open[project.id] = optionsView.openScreens();
    savePrefs(prefs);
  }, 500);

  const optionsPane = isIris
    ? h(
        'div',
        { class: 'pe-pane pe-options-layout', dataset: { pane: 'options' } },
        h(
          'section',
          { class: 'panel pe-options-panel', 'aria-label': 'Shader options' },
          h('div', { class: 'panel-header' }, icon('sliders'), h('h2', null, 'Options'), optionCount, h('span', { class: 'grow' }), helpBtn, resetAllIcon),
          h('div', { class: 'pe-options-tools' }, h('div', { class: 'input-with-icon' }, icon('search'), search)),
          h('div', { class: 'panel-body scroll pe-options-body' }, optionsHost),
        ),
        h('aside', { class: 'panel pe-side', 'aria-label': 'Pack' }, h('div', { class: 'panel-header' }, icon('package'), h('h2', null, 'Pack')), h('div', { class: 'scroll pe-side-scroll' }, sideContent())),
      )
    : null;

  // ------------------------------------------------------------------ files pane
  let codeView: CodeView | null = null;
  const filesPane = h('div', { class: 'pe-pane', dataset: { pane: 'files' } });
  const saveEditsSoon = debounce(() => {
    editsDirty = true;
    markDirty();
  }, 300);
  function ensureCodeView(): CodeView {
    if (!codeView) {
      const initial =
        ws.editedPaths()[0] ??
        (isIris
          ? ['shaders/shaders.properties', 'shaders/lib/settings.glsl'].find((p) => ws.has(p))
          : project.packFormat === 'bedrock'
            ? 'manifest.json'
            : (ws.paths.find((p) => /^assets\/[^/]+\/shaders\/.+\.(fsh|vsh|glsl)$/.test(p)) ?? ws.paths.find((p) => /^assets\/[^/]+\/post_effect\//.test(p)) ?? 'pack.mcmeta'));
      codeView = createCodeView({
        ws,
        initial,
        onEdit: (p) => fileEdited(p),
        onRevert: (p) => fileEdited(p),
      });
      filesPane.appendChild(codeView.el);
      disposers.push(() => codeView?.destroy());
    }
    return codeView;
  }
  function fileEdited(p: string): void {
    editsDirty = true;
    saveEditsSoon();
    paintChanges();
    if (isIris && PackWorkspace.affectsOptions(p)) modelDirty = true;
  }
  async function revertAllFiles(): Promise<void> {
    const edited = ws.editedPaths();
    if (!edited.length) return;
    const ok = await confirmDialog('Revert every edited file?', `${edited.length} file${edited.length === 1 ? '' : 's'} go back to how they are in ${project.sourceName}.`, 'Revert all', true);
    if (!ok) return;
    const affects = edited.some((p) => PackWorkspace.affectsOptions(p));
    for (const p of edited) ws.revert(p);
    codeView?.refresh();
    editsDirty = true;
    markDirty();
    paintChanges();
    if (isIris && affects) {
      modelDirty = true;
      if (current === 'options') refreshModel();
    }
    toast('All files reverted', { tone: 'success' });
  }

  // ------------------------------------------------------------------ pack pane (non-Iris)
  const packPane = !isIris
    ? h('div', { class: 'pe-pane pe-pack-page', dataset: { pane: 'pack' } }, h('div', { class: 'panel pe-side is-page' }, h('div', { class: 'panel-header' }, icon('package'), h('h2', null, 'Pack')), sideContent()))
    : null;

  const body = h('div', { class: 'pe-body' }, optionsPane, filesPane, packPane);
  for (const el of body.querySelectorAll<HTMLElement>(':scope > .pe-pane')) {
    el.setAttribute('role', 'tabpanel');
    el.setAttribute('aria-label', el.dataset.pane === 'options' ? 'Options' : el.dataset.pane === 'files' ? 'Files' : 'Pack');
  }
  const live = h('div', { class: 'sr-only', 'aria-live': 'polite' });
  const editor = h('div', { class: ['pe-editor', `is-${project.packFormat}`] }, bar, body, live);
  root.replaceChildren(editor);
  const setTitle = () => (document.title = `${project.name.trim() || 'Shader pack'} · Shader Maker — Texture Pack Maker`);
  setTitle();

  // ------------------------------------------------------------------ panes
  let current: Pane = isIris ? 'options' : 'files';
  function show(p: Pane): void {
    current = p;
    paneTabs.setValue(p);
    editor.dataset.pane = p;
    for (const el of body.querySelectorAll<HTMLElement>(':scope > .pe-pane')) el.hidden = el.dataset.pane !== p;
    if (p === 'files') ensureCodeView();
    if (p === 'options' && modelDirty) refreshModel();
    if (p !== 'files') paintChanges();
  }

  function refreshModel(): void {
    modelDirty = false;
    if (!isIris) return;
    const before = model?.set.options.size ?? 0;
    model = ws.irisModel();
    pruneValues();
    buildOptionsView();
    paintAll();
    const after = model.set.options.size;
    if (after !== before) toast(`Options updated from your file edits (${after} options).`, { duration: 3000 });
  }

  // ------------------------------------------------------------------ value changes
  const paintHistory = () => {
    undoBtn.disabled = !undoStack.length;
    redoBtn.disabled = !redoStack.length;
  };
  function paintAll(): void {
    optionsView?.refresh();
    paintChanges();
    paintHistory();
  }

  function labelOf(name: string): string {
    return model ? stripFormatting(optionLabel(model.lang, name)) : name;
  }

  function setValue(name: string, v: string): void {
    const o = model?.set.options.get(name);
    if (!o) return;
    record(labelOf(name), name);
    if (v === o.defaultValue) delete values[name];
    else values[name] = v;
    optionsView?.refresh(name);
    paintChanges();
    paintHistory();
    markDirty();
  }

  function replaceValues(next: ChosenValues, label: string): ChosenValues {
    const before = { ...values };
    record(label, null);
    values = next;
    pruneValues();
    paintAll();
    markDirty();
    return before;
  }

  function resetOption(name: string): void {
    if (values[name] === undefined) return;
    record(`Reset ${labelOf(name)}`, null);
    delete values[name];
    paintAll();
    markDirty();
  }

  function resetAll(): void {
    const n = changedNames().length;
    if (!n) return;
    const before = replaceValues({}, 'Reset all options');
    toast(`Reset ${n} option${n === 1 ? '' : 's'} to the pack defaults`, { action: { label: 'Undo', onClick: () => replaceValues(before, 'Undo reset') } });
  }

  function applyProfile(p: ProfileDef): void {
    if (!model) return;
    const next: ChosenValues = { ...values };
    for (const [k, v] of p.values) {
      const o = model.set.options.get(k);
      if (!o) continue;
      if (v === o.defaultValue) delete next[k];
      else next[k] = v;
    }
    const before = replaceValues(next, `Profile ${stripFormatting(p.label)}`);
    live.textContent = `Profile ${stripFormatting(p.label)} applied`;
    toast(`Applied the ${stripFormatting(p.label)} profile`, { tone: 'success', action: { label: 'Undo', onClick: () => replaceValues(before, 'Undo profile') } });
  }

  function undo(): void {
    const e = undoStack.pop();
    if (!e) return;
    redoStack.push({ values: { ...values }, label: e.label });
    values = e.values;
    paintAll();
    markDirty();
    live.textContent = `Undid ${e.label}`;
  }

  function redo(): void {
    const e = redoStack.pop();
    if (!e) return;
    undoStack.push({ values: { ...values }, label: e.label, key: null, at: 0 });
    values = e.values;
    paintAll();
    markDirty();
    live.textContent = `Redid ${e.label}`;
  }

  function revealOption(name: string): void {
    if (current !== 'options') show('options');
    if (search.value) {
      search.value = '';
      optionsView?.search('');
    }
    optionsView?.reveal(name);
  }

  async function rename(): Promise<void> {
    const n = await promptDialog('Rename pack', 'Pack name', project.name, { confirmLabel: 'Rename', maxLength: 80 });
    if (n === null || destroyed) return;
    project.name = n.replace(/[\x00-\x1f\x7f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) || project.name;
    title.textContent = project.name;
    tooltip(exportBtn, `Export ${exportFileName(project)} (Ctrl+E)`);
    for (const el of editor.querySelectorAll('.pe-pack-name')) el.textContent = project.name;
    setTitle();
    void saveNow();
  }

  // ------------------------------------------------------------------ export
  function doExport(): void {
    codeView?.flush();
    scheduleSave.flush();
    if (modelDirty) refreshModel();
    openPackExportDialog({
      project,
      ws,
      model,
      values: { ...values },
      onExported: (update) => {
        if (update.packVersion) project.packVersion = update.packVersion;
        project.exportCount = (project.exportCount ?? 0) + 1;
        project.lastExportAt = Date.now();
        void saveNow();
      },
    });
  }

  // ------------------------------------------------------------------ shortcuts
  function showShortcuts(): void {
    openShortcutsSheet([
      {
        title: 'Editing',
        items: [
          ...(isIris
            ? [
                { keys: ['Mod', 'Z'], label: 'Undo an option change' },
                { keys: ['Mod', 'Shift', 'Z'], label: 'Redo' },
                { keys: ['/'], label: 'Search options' },
              ]
            : []),
          { keys: ['Mod', 'F'], label: 'Find in the open file (Files tab)' },
          { keys: ['Tab'], label: 'Indent in the file editor' },
          { keys: ['Esc'], label: 'Leave the file editor' },
          { keys: ['Mod', 'S'], label: 'Save now' },
          { keys: ['Mod', 'E'], label: 'Export the pack' },
        ],
      },
      { title: 'Help', items: [{ keys: ['?'], label: 'Show this list' }] },
    ]);
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (destroyed || e.defaultPrevented) return;
    if (document.querySelector('dialog[open]')) return;
    const mod = e.ctrlKey || e.metaKey;
    const typing = isTypingTarget(e.target);
    const k = e.key.toLowerCase();
    if (mod && !e.altKey) {
      if (k === 's') {
        e.preventDefault();
        scheduleSave.flush();
        void saveNow().then(() => toast('Saved', { tone: 'success', duration: 1500 }));
        return;
      }
      if (k === 'e') {
        e.preventDefault();
        doExport();
        return;
      }
      if (k === 'f' && current === 'files') {
        e.preventDefault();
        codeView?.focusFind();
        return;
      }
      if (typing || !isIris) return;
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((k === 'z' && e.shiftKey) || k === 'y') {
        e.preventDefault();
        redo();
      }
      return;
    }
    if (typing || e.altKey) return;
    if (e.key === '?') {
      e.preventDefault();
      showShortcuts();
    } else if (e.key === '/' && isIris) {
      e.preventDefault();
      if (current !== 'options') show('options');
      search.focus();
      search.select();
    }
  };
  const flush = () => {
    if (scheduleSave.pending()) scheduleSave.flush();
    if (saveEditsSoon.pending()) saveEditsSoon.flush();
  };
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') flush();
  };
  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (!scheduleSave.pending() && !saveEditsSoon.pending() && !saving) return;
    flush();
    e.preventDefault();
    e.returnValue = '';
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', onBeforeUnload);
  document.addEventListener('visibilitychange', onVisibility);
  disposers.push(() => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('pagehide', flush);
    window.removeEventListener('beforeunload', onBeforeUnload);
    document.removeEventListener('visibilitychange', onVisibility);
  });

  // ------------------------------------------------------------------ go
  buildOptionsView();
  show(current);
  paintAll();

  return () => {
    destroyed = true;
    rememberOpen.flush();
    for (const d of disposers.splice(0)) {
      try {
        d();
      } catch (err) {
        console.error(err);
      }
    }
    if (scheduleSave.pending() || saveEditsSoon.pending() || editsDirty) {
      scheduleSave.cancel();
      saveEditsSoon.cancel();
      const settings: OptionValues = {};
      for (const [k, v] of Object.entries(values)) settings[k] = v;
      project.settings = settings;
      project.editedFiles = ws.editedPaths().length;
      void saveProject(project).catch(() => undefined);
      void saveEdits(project, { ...ws.edits }).catch(() => undefined);
    }
  };
}
