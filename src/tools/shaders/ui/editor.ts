// Shader editor ('#/shaders/:id'): presets + options on the left, live preview in the middle, pack
// info and export on the right. Settings have undo/redo and are autosaved to IndexedDB.

import { debounce } from '../../../core/events';
import { navigate } from '../../../core/router';
import { getProject, saveProject } from '../../../core/storage';
import { saveBlob } from '../../../core/download';
import { friendlyError } from '../../../core/net';
import type { OptionValue, OptionValues, PreviewParams } from '../../../core/types';
import { getJavaPackFormat } from '../../../editions/index';
import { defaultPreviewParams } from '../../../shared/preview/shader-preview';
import { button, editorLayout, emptyState, iconButton, spinner, tooltip } from '../../../ui/components';
import { h, isTypingTarget } from '../../../ui/dom';
import { icon } from '../../../ui/icons';
import { openShortcutsSheet, promptDialog } from '../../../ui/modal';
import { toast } from '../../../ui/toast';
import { targetInfo, type ShaderTargetInfo } from '../targets';
import { fallbackIcon, iconFromScreenshot, thumbFromScreenshot } from './art';
import { openExportDialog } from './export-dialog';
import {
  changedKeys,
  matchingPreset,
  normalizeSettings,
  presetSettings,
  settingsEqual,
  type AnyGenerator,
  type VanillaSupportInfo,
} from './generator';
import { SettingsHistory } from './history';
import { optionsPanel } from './options-panel';
import { packPanel } from './pack-panel';
import { presetGallery } from './presets';
import { cleanName, isShaderProject, loadPrefs, normalizePreviewTextures, savePrefs, type ShaderProjectData } from './project';
import { createStage, TIME_PRESETS } from './stage';
import { previewVersionFor } from './texture-sources';

/** Plain Minecraft without shaders, for the Iris compare button. */
function plainMinecraftLook(): PreviewParams {
  return {
    ...defaultPreviewParams(),
    exposure: 1,
    contrast: 1,
    saturation: 1,
    gamma: 1,
    temperature: 0,
    tint: [1, 1, 1],
    vignette: 0,
    bloom: 0,
    shadowStrength: 0,
    godrays: 0,
    waving: 0,
    sunColor: [1, 0.97, 0.9],
    skyTop: [0.471, 0.655, 1],
    skyHorizon: [0.753, 0.847, 1],
    fogColor: [0.753, 0.847, 1],
    fogDensity: 0.1,
    waterColor: [0.247, 0.463, 0.894],
    waterClarity: 0.55,
    grayscale: 0,
    sepia: 0,
    posterize: 0,
  };
}

function messageView(root: HTMLElement, opts: { icon: 'search' | 'warning'; title: string; text: string }): () => void {
  root.replaceChildren(
    h(
      'div',
      { class: 'sh-message container' },
      emptyState({
        icon: opts.icon,
        title: opts.title,
        text: opts.text,
        action: h(
          'div',
          { class: 'row wrap', style: { justifyContent: 'center' } },
          button({ label: 'All shader projects', icon: 'arrow-left', variant: 'primary', onClick: () => navigate('/shaders') }),
          button({ label: 'Help', icon: 'help', variant: 'ghost', onClick: () => navigate('/help') }),
        ),
      }),
    ),
  );
  return () => {};
}

export async function mountEditor(root: HTMLElement, id: string): Promise<() => void> {
  root.replaceChildren(h('div', { class: 'sh-loading' }, spinner(32), h('span', { class: 'muted' }, 'Opening your shader project…')));
  let loaded: unknown;
  try {
    loaded = await getProject(id);
  } catch (err) {
    return messageView(root, { icon: 'warning', title: "Couldn't open the project", text: friendlyError(err) });
  }
  if (!isShaderProject(loaded)) {
    return messageView(root, {
      icon: 'search',
      title: 'Shader project not found',
      text: 'It may have been deleted. Projects are saved in this browser only, so projects made on another device or browser won’t show up here.',
    });
  }
  const project: ShaderProjectData = loaded;
  const target = targetInfo(project.target);
  let gen: AnyGenerator;
  try {
    gen = await target.load();
  } catch (err) {
    return messageView(root, { icon: 'warning', title: `The ${target.shortName} maker couldn't load`, text: friendlyError(err) });
  }
  if (!root.isConnected) return () => {};
  return buildEditor(root, project, target, gen);
}

function buildEditor(root: HTMLElement, project: ShaderProjectData, target: ShaderTargetInfo, gen: AnyGenerator): () => void {
  const disposers: (() => void)[] = [];
  const prefs = loadPrefs();
  const history = new SettingsHistory();
  let settings: OptionValues = normalizeSettings(gen, project.settings);
  if (!project.version) project.version = target.defaultVersion;
  let destroyed = false;

  // ---------------------------------------------------------------- saving
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
  let errorToastShown = false;
  const saveNow = async (): Promise<void> => {
    if (saving) {
      again = true;
      return saving;
    }
    paintSave('saving');
    project.settings = { ...settings };
    project.name = cleanName(project.name) || 'My shaders';
    saving = saveProject(project)
      .then(() => {
        errorToastShown = false;
        if (!destroyed) paintSave(again ? 'dirty' : 'saved');
      })
      .catch((err) => {
        if (!destroyed) paintSave('error');
        if (!errorToastShown) {
          errorToastShown = true;
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
  const scheduleSave = debounce(() => void saveNow(), 600);
  const markDirty = () => {
    paintSave('dirty');
    scheduleSave();
  };

  // ---------------------------------------------------------------- preview stage
  const vanillaBase = gen.kind === 'iris' ? plainMinecraftLook() : gen.toPreviewParams(gen.defaults());
  const safeParams = (): PreviewParams => {
    try {
      return gen.toPreviewParams(settings);
    } catch (err) {
      console.error(err);
      return defaultPreviewParams();
    }
  };
  const stage = createStage({
    params: safeParams,
    compareParams: () => vanillaBase,
    compareLabel: target.compareLabel,
    edition: target.edition,
    version: previewVersionFor(target, project.version),
    textures: normalizePreviewTextures(project.previewTextures),
    // preview-only choice: saved with the project, not an undo step, never part of the export
    onTexturesChange: (pref) => {
      project.previewTextures = pref;
      if (!destroyed) void saveNow();
    },
    prefs,
    onPrefsChange: () => savePrefs(prefs),
    screenshotName: () => project.name.trim() || 'Shaders',
    onScreenshot: (blob, name) => {
      saveBlob(blob, name);
      toast('Screenshot saved to your downloads', { tone: 'success' });
    },
  });
  disposers.push(() => stage.destroy());

  // ---------------------------------------------------------------- presets + options (left)
  const presetById = (pid: string) => gen.PRESETS.find((p) => p.id === pid);
  const customNote = h('p', { class: 'sh-custom-note', hidden: true });
  const gallery = presetGallery({ presets: gen.PRESETS, active: matchingPreset(gen, settings), onPick: (pid) => applyPreset(pid) });
  const paintPresets = () => {
    const match = matchingPreset(gen, settings);
    gallery.setActive(match);
    customNote.hidden = Boolean(match);
    const base = project.preset ? presetById(project.preset) : undefined;
    const n = changedKeys(gen, settings).size;
    customNote.replaceChildren(icon('pencil'), h('span', null, base && base.id !== 'default' ? `Custom look, based on ${base.label}` : `Custom look · ${n} setting${n === 1 ? '' : 's'} changed`));
  };

  const optPanel = optionsPanel({
    gen,
    values: settings,
    onChange: (key, value) => change(key, value),
    onResetGroup: (group, keys) => resetKeys(keys, `Reset ${group}`),
    collapsed: prefs.collapsed[target.id] ?? [],
    onCollapsedChange: (list) => {
      prefs.collapsed[target.id] = list;
      savePrefs(prefs);
    },
    showHelp: prefs.showHelp,
  });
  const helpBtn = iconButton('circle-question', 'Show help text under each setting', () => {
    prefs.showHelp = !prefs.showHelp;
    savePrefs(prefs);
    helpBtn.setActive(prefs.showHelp);
    optPanel.setShowHelp(prefs.showHelp);
  }, { active: prefs.showHelp, size: 'sm' });
  const resetAllBtn = iconButton('recycle', 'Reset every setting', () => resetKeys(gen.OPTIONS.map((o) => o.key), 'Reset all settings'), { size: 'sm' });

  const left = h(
    'section',
    { class: 'panel sh-settings', 'aria-label': 'Look settings' },
    h('div', { class: 'panel-header' }, icon('sliders'), h('h2', null, 'Look')),
    h(
      'div',
      { class: 'panel-body scroll sh-settings-body' },
      h(
        'div',
        { class: 'sh-block' },
        h('div', { class: 'sh-block-head' }, h('h3', { class: 'section-title' }, icon('sparkles'), 'Presets')),
        gallery.el,
        customNote,
      ),
      h(
        'div',
        { class: 'sh-block' },
        h('div', { class: 'sh-block-head' }, h('h3', { class: 'section-title' }, icon('sliders'), 'Fine-tune'), h('span', { class: 'grow' }), helpBtn, resetAllBtn),
        optPanel.el,
      ),
    ),
  );

  // ---------------------------------------------------------------- pack (right)
  const header = h('h1', { class: 'sh-title truncate' }, project.name);
  const pack = packPanel({
    project,
    target,
    gen,
    settings,
    onName: (v) => {
      project.name = v;
      header.textContent = v.trim() || 'My shaders';
      pack.setName(v);
      setTitle();
      markDirty();
    },
    onDescription: (v) => {
      project.description = v;
      markDirty();
    },
    onVersion: (v) => changeVersion(v),
    onExport: () => doExport(),
  });

  // ---------------------------------------------------------------- header bar
  const undoBtn = iconButton('undo', 'Undo (Ctrl+Z)', () => undo());
  const redoBtn = iconButton('redo', 'Redo (Ctrl+Shift+Z)', () => redo());
  const keysBtn = iconButton('keyboard', 'Keyboard shortcuts (?)', () => showShortcuts());
  keysBtn.classList.add('sh-keys-btn');
  const renameBtn = iconButton('pencil', 'Rename', () => void rename(), { size: 'sm' });
  const exportBtn = button({ label: 'Export', icon: 'download', variant: 'primary', class: 'sh-bar-export', onClick: () => doExport() });
  tooltip(exportBtn, `Export ${target.fileExt} (Ctrl+E)`);
  const back = h('a', { class: 'btn btn-ghost btn-sm sh-back', href: '#/shaders', 'aria-label': 'All shader projects' }, icon('arrow-left'), h('span', { class: 'btn-label' }, 'Shaders'));
  const bar = h(
    'header',
    { class: 'sh-bar' },
    back,
    h('div', { class: 'sh-bar-title' }, h('span', { class: 'sh-bar-icon' }, icon(target.icon)), h('div', { class: 'sh-bar-names' }, header, h('span', { class: 'sh-bar-sub' }, target.shortName)), renameBtn),
    saveEl,
    h('div', { class: 'sh-bar-actions' }, undoBtn, redoBtn, keysBtn, exportBtn),
  );
  const live = h('div', { class: 'sr-only', 'aria-live': 'polite' });

  const layout = editorLayout({
    left,
    center: stage.el,
    right: pack.el,
    labels: { left: 'Settings', center: 'Preview', right: 'Pack' },
    icons: { left: 'sliders', center: 'eye', right: 'package' },
    initial: 'center',
  });
  const editor = h('div', { class: ['sh-editor', `is-${target.id}`] }, bar, layout, live);
  root.replaceChildren(editor);
  const setTitle = () => (document.title = `${project.name.trim() || 'My shaders'} · Shader Maker — Texture Pack Maker`);
  setTitle();

  // ---------------------------------------------------------------- state changes
  const paintHistory = () => {
    undoBtn.disabled = !history.canUndo();
    redoBtn.disabled = !history.canRedo();
    const u = history.peekUndoLabel();
    const r = history.peekRedoLabel();
    tooltip(undoBtn, u ? `Undo ${u} (Ctrl+Z)` : 'Undo (Ctrl+Z)');
    tooltip(redoBtn, r ? `Redo ${r} (Ctrl+Shift+Z)` : 'Redo (Ctrl+Shift+Z)');
  };

  const thumbTimer = debounce(() => void captureThumb(), 4000);
  const afterChange = () => {
    project.settings = { ...settings };
    paintPresets();
    stage.update();
    pack.refresh(settings);
    paintHistory();
    markDirty();
    thumbTimer();
  };

  const labelOf = (key: string) => gen.OPTIONS.find((o) => o.key === key)?.label ?? key;

  function change(key: string, value: OptionValue): void {
    const before = { ...settings };
    settings = { ...settings, [key]: value };
    history.record(before, key, labelOf(key));
    afterChange();
  }

  function replaceAll(next: OptionValues, label: string): OptionValues {
    const before = { ...settings };
    const normalized = normalizeSettings(gen, next);
    if (settingsEqual(gen, before, normalized)) return before;
    history.record(before, null, label);
    history.seal();
    settings = normalized;
    optPanel.setValues(settings);
    afterChange();
    return before;
  }

  function applyPreset(pid: string): void {
    const p = presetById(pid);
    if (!p) return;
    const label = `Preset: ${p.label}`;
    const before = replaceAll(presetSettings(gen, pid), label);
    project.preset = pid;
    paintPresets();
    if (settingsEqual(gen, before, settings)) return;
    toast(`Applied the “${p.label}” preset`, {
      tone: 'success',
      action: {
        label: 'Undo',
        onClick: () => {
          if (history.peekUndoLabel() === label && settingsEqual(gen, settings, presetSettings(gen, pid))) undo();
          else replaceAll(before, `Undo ${p.label}`);
        },
      },
    });
  }

  function resetKeys(keys: string[], label: string): void {
    const d = gen.defaults();
    const next = { ...settings };
    for (const k of keys) next[k] = d[k];
    const before = replaceAll(next, label);
    if (settingsEqual(gen, before, settings)) return;
    toast(`${label}`, { action: { label: 'Undo', onClick: () => replaceAll(before, `Undo ${label.toLowerCase()}`) } });
  }

  function undo(): void {
    const e = history.undo(settings);
    if (!e) return;
    settings = normalizeSettings(gen, e.values);
    optPanel.setValues(settings);
    afterChange();
    live.textContent = `Undid ${e.label}`;
  }

  function redo(): void {
    const e = history.redo(settings);
    if (!e) return;
    settings = normalizeSettings(gen, e.values);
    optPanel.setValues(settings);
    afterChange();
    live.textContent = `Redid ${e.label}`;
  }

  async function rename(): Promise<void> {
    const n = await promptDialog('Rename pack', 'Pack name', project.name, { confirmLabel: 'Rename', maxLength: 80 });
    if (n === null || destroyed) return;
    project.name = cleanName(n) || project.name;
    header.textContent = project.name;
    pack.setName(project.name);
    setTitle();
    void saveNow();
  }

  // ---------------------------------------------------------------- version (Java targets)
  let supportToken = 0;
  function refreshSupport(): void {
    if (gen.kind !== 'java-vanilla' || !gen.supportedFor) return;
    const v = project.version;
    const token = ++supportToken;
    const apply = (s: VanillaSupportInfo) => {
      if (token !== supportToken || destroyed) return;
      optPanel.setAvailability(s);
      pack.setSupport(s);
      exportAllowed = s.supported;
      const why = s.notes[0] ?? 'This Minecraft version is not supported.';
      pack.setExportAvailable(s.supported, why);
      exportBtn.disabled = !s.supported;
      tooltip(exportBtn, s.supported ? `Export ${target.fileExt} (Ctrl+E)` : why);
    };
    const sf = gen.supportedFor;
    apply(sf(v));
    void getJavaPackFormat(v)
      .then((pf) => {
        if (pf) apply(sf(pf));
      })
      .catch(() => undefined);
  }

  function changeVersion(v: string): void {
    if (!v || v === project.version) return;
    project.version = v;
    pack.setVersion(v);
    stage.setTexturesSource(target.edition, previewVersionFor(target, v));
    refreshSupport();
    void saveNow();
    if (gen.kind === 'java-vanilla') toast(`Now making shaders for Minecraft Java ${v}`, { tone: 'info', duration: 2500 });
  }

  // ---------------------------------------------------------------- images
  async function packIcon(size: number): Promise<Uint8Array> {
    const shot = (await stage.capture()) ?? (project.thumb instanceof Blob && project.thumb.size ? project.thumb : null);
    if (shot) {
      try {
        return await iconFromScreenshot(shot, size);
      } catch {
        /* fall through */
      }
    }
    const p = presetById(project.preset ?? 'default') ?? gen.PRESETS[0];
    return fallbackIcon(p?.swatch ?? ['#3a2566', '#b07cff'], size);
  }

  async function captureThumb(): Promise<void> {
    if (destroyed || document.hidden) return;
    const shot = await stage.capture();
    if (!shot || destroyed) return;
    try {
      project.thumb = await thumbFromScreenshot(shot);
      scheduleSave();
    } catch {
      /* optional */
    }
  }

  // ---------------------------------------------------------------- export
  let exportAllowed = true;
  function doExport(): void {
    scheduleSave.flush();
    if (!exportAllowed) {
      toast('Pick Minecraft 1.17 or newer to export vanilla shaders.', { tone: 'warn' });
      return;
    }
    openExportDialog({
      project,
      target,
      settings: () => ({ ...settings }),
      packIcon,
      onExported: (update) => {
        Object.assign(project, update);
        pack.refresh(settings);
        void saveNow();
        void captureThumb();
      },
    });
  }

  // ---------------------------------------------------------------- shortcuts
  function showShortcuts(): void {
    openShortcutsSheet([
      {
        title: 'Editing',
        items: [
          { keys: ['Mod', 'Z'], label: 'Undo' },
          { keys: ['Mod', 'Shift', 'Z'], label: 'Redo' },
          { keys: ['Mod', 'Y'], label: 'Redo' },
          { keys: ['/'], label: 'Search settings' },
          { keys: ['Mod', 'S'], label: 'Save now' },
          { keys: ['Mod', 'E'], label: 'Export the pack' },
        ],
      },
      {
        title: 'Preview',
        items: [
          { keys: ['C'], label: `Hold to compare (${target.compareLabel})` },
          ...TIME_PRESETS.map((t) => ({ keys: [t.key], label: t.label })),
          { keys: ['D'], label: 'Play or pause the day cycle' },
          { keys: ['R'], label: 'Auto-rotate on or off' },
          { keys: ['P'], label: 'Save a screenshot' },
          { keys: ['T'], label: 'Preview textures' },
          { keys: ['Arrows'], label: 'Rotate (preview focused)' },
          { keys: ['+'], label: 'Zoom in (preview focused)' },
          { keys: ['-'], label: 'Zoom out (preview focused)' },
          { keys: ['Home'], label: 'Reset the view' },
        ],
      },
      { title: 'Help', items: [{ keys: ['?'], label: 'Show this list' }] },
    ]);
  }

  let cHeld = false;
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
      if (typing) return;
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
    } else if (e.key === '/') {
      e.preventDefault();
      if (layout.current() !== 'left' && window.matchMedia('(max-width: 1180px)').matches) layout.show('left');
      optPanel.focusSearch();
    } else if (k === 'c' && !e.repeat) {
      cHeld = true;
      stage.setCompare(true);
    } else if (k === 'r' && !e.repeat) stage.toggleAutoRotate();
    else if (k === 'd' && !e.repeat) stage.toggleDayAnimation();
    else if (k === 'p' && !e.repeat) void stage.saveScreenshot();
    else if (k === 't' && !e.repeat) {
      e.preventDefault();
      if (layout.current() !== 'center' && window.matchMedia('(max-width: 720px)').matches) layout.show('center');
      stage.openTexturesMenu();
    }
    else {
      const t = TIME_PRESETS.find((x) => x.key === e.key);
      if (t) {
        stage.setDayAnimation(false);
        stage.setTime(t.tick);
      }
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key.toLowerCase() === 'c' && cHeld) {
      cHeld = false;
      stage.setCompare(false);
    }
  };
  const onBlur = () => {
    if (cHeld) {
      cHeld = false;
      stage.setCompare(false);
    }
  };
  const flushAll = () => {
    if (scheduleSave.pending()) {
      scheduleSave.flush();
    }
  };
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') flushAll();
  };
  // A save started while the page unloads may not finish, so ask the browser to confirm leaving.
  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (!scheduleSave.pending() && !saving) return;
    flushAll();
    e.preventDefault();
    e.returnValue = '';
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  window.addEventListener('pagehide', flushAll);
  window.addEventListener('beforeunload', onBeforeUnload);
  document.addEventListener('visibilitychange', onVisibility);
  disposers.push(() => {
    window.removeEventListener('beforeunload', onBeforeUnload);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('pagehide', flushAll);
    document.removeEventListener('visibilitychange', onVisibility);
  });

  // ---------------------------------------------------------------- go
  paintPresets();
  paintHistory();
  refreshSupport();
  void stage.mount().then(() => {
    if (!project.thumb) setTimeout(() => void captureThumb(), 2500);
  });

  return () => {
    destroyed = true;
    thumbTimer.cancel();
    if (scheduleSave.pending()) {
      scheduleSave.cancel();
      project.settings = { ...settings };
      void saveProject(project).catch(() => undefined);
    }
    for (const d of disposers.splice(0)) {
      try {
        d();
      } catch (err) {
        console.error(err);
      }
    }
  };
}
