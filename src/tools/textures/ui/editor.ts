// Texture pack editor at #/textures/:id — loads the project and vanilla assets, then lays out the
// browser, canvas and side panels (3 panes on desktop, 2 on tablets, tabbed on phones), with the
// top bar (name, save state, undo/redo, export), keyboard shortcuts and autosave. The 2D / 3D
// workspace switch swaps the pixel editor and the 3D model between the centre and the side panel.

import type { AssetIndex, TexturePackProject } from '../../../core/types';
import { h, isTypingTarget } from '../../../ui/dom';
import { icon, setIcon, type IconName } from '../../../ui/icons';
import { badge, button, emptyState, iconButton, segmented, spinner, tabs, tooltip } from '../../../ui/components';
import { assetLoadingPanel } from '../../../ui/version-picker';
import { openModal, openShortcutsSheet } from '../../../ui/modal';
import { toast } from '../../../ui/toast';
import { getProject } from '../../../core/storage';
import { friendlyError, isAbortError } from '../../../core/net';
import { navigate, href as routeHref } from '../../../core/router';
import { isAssetsCached, loadAssets } from '../../../editions/index';
import { PIXEL_SHORTCUTS } from '../../../shared/pixel-canvas';
import { TexStore, ICON_KEY, type SaveState } from './store';
import { ThumbService, paintCanvas } from './thumbs';
import { createBrowser } from './browser';
import { createModelBrowser } from './model-browser';
import { ModelService } from './models';
import { createUsedBy } from './used-by';
import type { ModelEntry } from '../../../shared/models/index';
import { createCanvasPanel, type Workspace } from './canvas-panel';
import { createPaint3d } from './paint3d';
import { createPreviewPanel } from './preview-panel';
import { createEffectsPanel } from './effects-panel';
import { createPackPanel } from './pack-panel';
import { openExportDialog } from './export-dialog';
import { plainText } from './mc-text';
import { packIconImage } from './icon';
import type { SoundsMode } from './sounds-mode';
import type { ModelEditor } from './model-editor/editor';
import type { BlockState } from '../../../shared/models/index';
import './sounds-base.css';
import './model-host.css';
import { fmt, textLocale } from '../../../i18n/editor-text';
import type { PvpPanel } from '../pvp/panel';
import type { CrosshairTarget } from '../pvp/tweaks';
import { kit } from '../../../ui/i18n/kit';
import { te } from './i18n/editor';
import { versionLabel } from './start-screen';
import { PHONE_MQ, TABLET_MQ } from './media';
import { projectsText } from '../../../shared/i18n/projects';
import { saveProjectFile } from '../../../shared/project-file/entry';

type Side = 'textures' | 'preview' | 'effects' | 'pvp' | 'pack';
type LibMode = 'blocks' | 'items' | 'mobs' | 'textures' | 'sounds';
const LIB_KEY = 'to-tex-library-mode';
const WS_KEY = 'to-tex-workspace';
type Mobile = 'textures' | 'editor' | 'preview' | 'effects' | 'pvp' | 'pack';

const PHONE = PHONE_MQ;
const TABLET = TABLET_MQ;

const versionText = (p: TexturePackProject): string => versionLabel(p);

export async function renderEditor(root: HTMLElement, id: string, life: AbortSignal): Promise<() => void> {
  const cleanups: (() => void)[] = [];
  const shell = h('div', { class: 'tx-editor accent-green' });
  root.appendChild(shell);

  const loadingView = h('div', { class: 'tx-boot' }, spinner(32), h('span', { class: 'muted' }, te.opening));
  shell.appendChild(loadingView);

  let project: TexturePackProject | undefined;
  try {
    const p = await getProject(id);
    project = p && p.kind === 'texturepack' ? (p as TexturePackProject) : undefined;
  } catch {
    project = undefined;
  }
  if (life.aborted) return () => undefined;
  if (!project) {
    shell.replaceChildren(
      h(
        'div',
        { class: 'tx-missing' },
        emptyState({
          icon: 'map',
          title: te.missingTitle,
          text: te.missingText,
          action: h(
            'div',
            { class: 'row wrap', style: { justifyContent: 'center' } },
            button({ label: te.allPacks, icon: 'arrow-left', onClick: () => navigate('/textures') }),
            button({ label: te.newPack, icon: 'plus', variant: 'primary', onClick: () => navigate('/textures') }),
          ),
        }),
      ),
    );
    return () => undefined;
  }
  const proj = project;
  document.title = `${plainText(proj.name)} — Texture Pack Maker`;

  // ---------------------------------------------------------------- vanilla assets
  const controller = new AbortController();
  const onLeave = () => controller.abort();
  life.addEventListener('abort', onLeave);
  cleanups.push(() => {
    life.removeEventListener('abort', onLeave);
    controller.abort();
  });
  const assets = await loadVanilla(proj, shell, loadingView, controller.signal);
  if (!assets || life.aborted) {
    return () => cleanups.forEach((f) => f());
  }

  // ---------------------------------------------------------------- state + panels
  const store = new TexStore(proj, assets);
  const thumbs = new ThumbService(store);
  const models = new ModelService(store);
  let libMode: LibMode = 'blocks';
  try {
    const saved = localStorage.getItem(LIB_KEY);
    if (saved === 'blocks' || saved === 'items' || saved === 'mobs' || saved === 'textures' || saved === 'sounds') libMode = saved;
  } catch {
    /* storage blocked */
  }
  const switches: (HTMLElement & { setValue(v: LibMode): void })[] = [];
  const makeSwitch = () => {
    const sw = segmented<LibMode>({
      value: libMode,
      size: 'sm',
      label: te.browseBy,
      options: [
        { value: 'blocks', label: te.lib.blocks },
        { value: 'items', label: te.lib.items },
        { value: 'mobs', label: te.lib.mobs },
        { value: 'textures', label: te.lib.all },
        { value: 'sounds', label: '', icon: 'music' },
      ],
      onChange: (v) => setLibMode(v, true),
    });
    // "All" keeps four labels apart in the narrow side panel; say in full what it lists
    const all = sw.querySelector<HTMLElement>('[data-value="textures"]');
    all?.setAttribute('title', te.lib.allTextures);
    all?.setAttribute('aria-label', te.lib.allTextures);
    // Sounds is a note icon at the end of the switch
    const snd = sw.querySelector<HTMLElement>('[data-value="sounds"]');
    snd?.setAttribute('title', te.lib.sounds);
    snd?.setAttribute('aria-label', te.lib.sounds);
    switches.push(sw);
    return h('div', { class: 'tx-libbar' }, sw);
  };
  let side: Side = 'preview';
  let mobile: Mobile = 'editor';
  /** The model editor while it is open (it takes the place of the panels) */
  let modelEditor: ModelEditor | null = null;
  let modelOpening = false;
  const isPhone = () => matchMedia(PHONE).matches;
  const isTablet = () => matchMedia(TABLET).matches && !isPhone();

  const usedBy = createUsedBy({ store, models, onPick: (e) => showEntry(e, 'chip') });
  const canvas = createCanvasPanel({
    store,
    belowHeader: usedBy.el,
    onOpened: (t) => {
      preview.setTexture(t);
      browser.setSelected(t && t.key !== ICON_KEY ? t.key : null, true);
      usedBy.setPath(t && t.key !== ICON_KEY ? t.key : null);
      paint3d.textureChanged();
    },
    onHistory: () => paintHistory(),
    onBrowse: () => showMobile('textures', true),
    onWorkspace: (v) => setWorkspace(v, true),
    onFrame: () => paint3d.textureChanged(),
    onSettings: () => paint3d.sync(),
    onCanvasHover: (p) => paint3d.canvasHover(p),
    // Phones show the preview on its own tab: its "Edit shape" is in the texture's menu too.
    menuItems: () => (isPhone() && preview.canEditShape() ? [{ label: te.preview.editShape, icon: 'shapes', onClick: () => preview.editShape() }] : []),
  });
  const browser = createBrowser({
    store,
    thumbs,
    onOpen: (path, how) => {
      void canvas.open(path, { focus: how === 'enter' });
      if (isPhone() && how !== 'keyboard') showMobile('editor');
    },
    onUpload: (path) => {
      void canvas.open(path).then(() => canvas.upload(path));
    },
    onDownload: (path) => void canvas.download(path),
    onReset: (path) => void canvas.reset(path),
    top: makeSwitch(),
  });
  const modelBrowser = createModelBrowser({
    store,
    models,
    top: makeSwitch(),
    onOpen: (e, how) => showEntry(e, how),
    onShowTextures: () => setLibMode('textures', true),
  });
  const preview = createPreviewPanel(store, models, {
    openTexture: (path) => {
      void canvas.open(path);
      // Phones show one panel at a time: go paint it.
      if (isPhone()) showMobile('editor');
    },
    onEntry: (e) => {
      if (e) modelBrowser.setSelected(e.kind, e.id, false);
      usedBy.setCurrent(e);
    },
    onEditModel: (e, st) => void openModelEditor(e, st),
  });

  const paint3d = createPaint3d({ store, canvas, preview });
  let workspace: Workspace = '2d';
  /** 2D: the pixel editor in the centre. 3D: the model in the centre, painted directly; the pixel editor in the side panel. */
  function setWorkspace(ws: Workspace, user = false) {
    if (ws === workspace) return;
    workspace = ws;
    shell.dataset.workspace = ws;
    if (user) {
      try {
        localStorage.setItem(WS_KEY, ws);
      } catch {
        /* storage blocked */
      }
    }
    canvas.setWorkspace(ws);
    if (ws === '3d') {
      preview.dock(canvas.stage3d, canvas.canvasBox);
      paint3d.setEnabled(true);
    } else {
      paint3d.setEnabled(false);
      preview.dock(null, null);
    }
    // The Preview tab holds the flat texture in 3D.
    for (const tab of [tabbarButtons.get('preview'), sideTabs.querySelector<HTMLElement>('.tab[data-value="preview"]')]) {
      const label = tab?.querySelector('span:not(.icon)');
      const ic = tab?.querySelector<HTMLElement>('.icon');
      if (label) label.textContent = ws === '3d' ? te.tabs.texture : te.tabs.preview;
      if (ic) setIcon(ic, ws === '3d' ? 'grid' : 'cube');
    }
    notifyVisibility();
    if (user && isPhone() && mobile !== 'editor') showMobile('editor');
  }

  /** Shows a block / item in the model workspace and opens its main texture (unless one of its textures is open). */
  function showEntry(e: ModelEntry, how: 'pointer' | 'keyboard' | 'enter' | 'chip') {
    preview.showEntry(e);
    modelBrowser.setSelected(e.kind, e.id, how === 'chip');
    const lib = models.lib;
    if (lib && how !== 'chip') {
      const openMain = () => {
        const cur = canvas.current();
        const view = lib.resolve(e, preview.current()?.state);
        if (!cur || !view.textures.some((t) => t.path === cur.key)) {
          const first = view.textures.find((t) => t.faces > 0 && !t.missing) ?? view.textures.find((t) => !t.missing);
          if (first) void canvas.open(first.path, { focus: how === 'enter' });
        }
      };
      // a mob's model loads on first use
      if (lib.ready(e)) openMain();
      else void models.prepare(e).then((ok) => ok && preview.current()?.entry === e && openMain());
    }
    if (how === 'keyboard') return;
    // Phones: a block or mob picked in the list opens on the Paint tab (Preview is one tap away);
    // a "Used by" chip, tapped on the Paint tab, shows that model.
    if (isPhone()) showMobile(how === 'chip' ? 'preview' : 'editor');
    else if (!isTablet() || how !== 'enter') setSide('preview');
  }

  function setLibMode(v: LibMode, user = false) {
    libMode = v;
    switches.forEach((sw) => sw.setValue(v));
    if (user) {
      try {
        localStorage.setItem(LIB_KEY, v);
      } catch {
        /* storage blocked */
      }
    }
    const isSounds = v === 'sounds';
    const models3d = v !== 'textures' && !isSounds;
    browser.el.hidden = v !== 'textures';
    modelBrowser.el.hidden = !models3d;
    if (models3d) {
      modelBrowser.setKind(v === 'blocks' ? 'block' : v === 'items' ? 'item' : 'entity');
      modelBrowser.activate();
    }
    setSoundsShown(isSounds, user);
    if (user && !isSounds) requestAnimationFrame(() => (models3d ? modelBrowser.focusSearch() : browser.focusSearch()));
  }

  // ---------------------------------------------------------------- sounds (loaded on first use)
  const soundLeft = h('div', { class: 'snd-host', hidden: true }, h('div', { class: 'snd-host-loading' }, spinner(28)));
  const soundCenter = h('div', { class: 'snd-host', hidden: true });
  let soundsMode: SoundsMode | null = null;
  let soundsLoad: Promise<SoundsMode | null> | null = null;
  function ensureSounds(): Promise<SoundsMode | null> {
    soundsLoad ??= import('./sounds-mode')
      .then(({ createSoundsMode }) => {
        if (life.aborted) return null;
        soundsMode = createSoundsMode({
          store,
          top: makeSwitch(),
          onSelect: (how) => {
            if (isPhone() && how !== 'keyboard') showMobile('editor');
          },
          onBrowse: () => showMobile('textures', true),
        });
        soundLeft.replaceChildren(soundsMode.browserEl);
        soundCenter.replaceChildren(soundsMode.panelEl);
        return soundsMode;
      })
      .catch((err) => {
        soundsLoad = null;
        console.error(err);
        toast(te.soundsFailed, { tone: 'error' });
        return null;
      });
    return soundsLoad;
  }
  function setSoundsShown(on: boolean, user: boolean) {
    shell.dataset.lib = on ? 'sounds' : '';
    soundLeft.hidden = !on;
    soundCenter.hidden = !on;
    paintTabbar();
    if (!on) {
      soundsMode?.deactivate();
      notifyVisibility();
      return;
    }
    notifyVisibility();
    void ensureSounds().then((m) => {
      if (!m || libMode !== 'sounds') return;
      m.activate();
      if (user) requestAnimationFrame(() => m.focusSearch());
    });
  }
  const effects = createEffectsPanel(store);
  const pack = createPackPanel({
    store,
    current: () => canvas.current(),
    paintIcon: () => {
      void canvas.open(ICON_KEY);
      showMobile('editor');
    },
    reload: () => navigate(`/textures/${proj.id}`),
  });

  // ---------------------------------------------------------------- PvP / FPS tweaks (loaded on first use)
  const pvpBody = h('div', { class: 'tx-side-body scroll', dataset: { tab: 'pvp' }, role: 'tabpanel', 'aria-label': te.tabs.pvp }, h('div', { class: 'tx-boot' }, spinner(28)));
  let pvpPanel: PvpPanel | null = null;
  let pvpLoad: Promise<PvpPanel | null> | null = null;
  function ensurePvp(): Promise<PvpPanel | null> {
    pvpLoad ??= Promise.all([import('../pvp/panel'), import('../pvp/i18n/load').then((m) => m.loadPvpText(textLocale()))])
      .then(([{ createPvpPanel }]) => {
        if (life.aborted) return null;
        pvpPanel = createPvpPanel({
          store,
          onTextures: (paths) => {
            const cur = canvas.current();
            if (cur && paths.includes(cur.key)) void canvas.open(cur.key);
          },
          drawCrosshair: (target) => void drawCrosshair(target),
        });
        pvpBody.replaceChildren(pvpPanel.el);
        notifyVisibility();
        return pvpPanel;
      })
      .catch((err) => {
        pvpLoad = null;
        console.error(err);
        toast(te.pvpFailed, { tone: 'error' });
        return null;
      });
    return pvpLoad;
  }
  /** "Draw your own" crosshair: the texture in the pixel editor, a sheet's crosshair square selected. */
  async function drawCrosshair(target: CrosshairTarget) {
    if (libMode === 'sounds') setLibMode('textures', true);
    setWorkspace('2d', true);
    await canvas.open(target.path, { focus: true });
    const pc = canvas.canvas();
    const t = canvas.current();
    if (!pc || !t || t.key !== target.path) return;
    const { crosshairCell } = await import('../pvp/tweaks');
    const { tv } = await import('../pvp/i18n/text');
    if (target.kind === 'sheet') {
      const cell = crosshairCell(t.full, 'sheet');
      pc.setSelection({ x: cell.x, y: cell.y, w: cell.w, h: cell.h });
    }
    toast(target.kind === 'sheet' ? tv.draw.sheet : tv.draw.sprite, { tone: 'info', duration: 7000 });
    if (isPhone()) showMobile('editor');
  }
  cleanups.push(() => pvpPanel?.destroy());

  // ---------------------------------------------------------------- top bar
  const barIcon = h('canvas', { class: 'tx-bar-icon pixelated', width: 32, height: 32 });
  let iconTimer: ReturnType<typeof setTimeout> | null = null;
  const paintBarIcon = () => {
    if (iconTimer) clearTimeout(iconTimer);
    iconTimer = setTimeout(() => {
      iconTimer = null;
      void packIconImage(store).then(({ img }) => paintCanvas(barIcon, img));
    }, 250);
  };
  cleanups.push(() => iconTimer && clearTimeout(iconTimer));
  const nameInput = h('input', { class: 'tx-name-input', value: plainText(proj.name), maxLength: 80, 'aria-label': te.packName, spellcheck: false, autocomplete: 'off' });
  nameInput.addEventListener('focus', () => {
    if (nameInput.value !== proj.name) nameInput.value = proj.name;
  });
  const measurer = h('span', { class: 'tx-name-measure', 'aria-hidden': 'true' });
  const sizeName = () => {
    measurer.textContent = nameInput.value || te.untitled;
    if (measurer.isConnected) nameInput.style.width = `${Math.ceil(measurer.getBoundingClientRect().width) + 20}px`;
  };
  sizeName();
  nameInput.addEventListener('input', () => {
    proj.name = nameInput.value;
    sizeName();
    store.touch('meta');
  });
  nameInput.addEventListener('blur', () => {
    if (!nameInput.value.trim()) {
      proj.name = te.untitled;
      store.touch('meta');
    }
    nameInput.value = plainText(proj.name);
    sizeName();
    document.title = `${plainText(proj.name)} — Texture Pack Maker`;
  });
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault();
      nameInput.blur();
    }
  });
  tooltip(nameInput, te.renameHint);

  const saveEl = h('button', { type: 'button', class: 'tx-save', 'aria-live': 'polite' });
  const paintSave = (s: SaveState) => {
    saveEl.dataset.state = s;
    saveEl.disabled = s !== 'error';
    const map: Record<SaveState, [IconName, string]> = {
      saved: ['check', te.save.saved],
      dirty: ['clock', te.save.saving],
      saving: ['clock', te.save.saving],
      error: ['warning-diamond', te.save.error],
    };
    const [ic, label] = map[s];
    saveEl.replaceChildren(s === 'saving' ? spinner(16) : icon(ic, { size: 16 }), h('span', null, label));
    saveEl.title = s === 'error' ? store.lastError : s === 'saved' ? te.save.savedHint : '';
  };
  saveEl.addEventListener('click', () => void store.flush());
  paintSave(store.saveState);

  const undoBtn = iconButton('undo', te.undo, () => (modelEditor ? modelEditor.undo() : canvas.undo()), { disabled: true });
  const redoBtn = iconButton('redo', te.redo, () => (modelEditor ? modelEditor.redo() : canvas.redo()), { disabled: true });
  const helpBtn = iconButton('keyboard', te.shortcutsButton, () => showShortcuts());
  helpBtn.classList.add('tx-keys-btn');
  // a .tpmproject file of the whole project (src/shared/project-file/)
  const fileBtn = iconButton('save', projectsText.save, () => void saveProjectFile({ id: proj.id, flush: () => store.flush() }), { class: 'tx-file-btn' });
  const exportBtn = button({ label: te.exportButton, icon: 'download', variant: 'primary', class: 'tx-export-btn', onClick: () => openExportDialog(store) });
  function paintHistory() {
    undoBtn.disabled = modelEditor ? !modelEditor.canUndo() : !canvas.canUndo();
    redoBtn.disabled = modelEditor ? !modelEditor.canRedo() : !canvas.canRedo();
  }

  // ---------------------------------------------------------------- model editor (loaded on first use)
  const modelHost = h('div', { class: 'tx-modelhost', hidden: true });
  async function openModelEditor(e: ModelEntry, st: BlockState) {
    if (modelEditor || modelOpening) return;
    if (proj.edition === 'bedrock') {
      bedrockShapeNote();
      return;
    }
    modelOpening = true;
    modelHost.hidden = false;
    modelHost.replaceChildren(h('div', { class: 'tx-boot' }, spinner(28), h('span', { class: 'muted' }, te.openingModelEditor)));
    shell.dataset.mode = 'model';
    try {
      const { createModelEditor } = await import('./model-editor/editor');
      if (life.aborted) return;
      const me = await createModelEditor({
        store,
        models,
        thumbs,
        entry: e,
        state: st,
        onClose: () => closeModelEditor(),
        paintTexture: (path) => {
          closeModelEditor();
          void canvas.open(path);
          if (isPhone()) showMobile('editor');
        },
        onHistory: () => paintHistory(),
      });
      if (life.aborted) {
        me.destroy();
        return;
      }
      modelEditor = me;
      modelHost.replaceChildren(me.el);
      paintHistory();
    } catch (err) {
      console.error(err);
      closeModelEditor();
      toast(err instanceof Error && err.message ? err.message : te.modelEditorFailed, { tone: 'error' });
    } finally {
      modelOpening = false;
    }
  }
  function closeModelEditor() {
    modelEditor?.destroy();
    modelEditor = null;
    modelHost.replaceChildren();
    modelHost.hidden = true;
    delete shell.dataset.mode;
    paintHistory();
    notifyVisibility();
  }
  function bedrockShapeNote() {
    openModal({
      title: te.bedrockShapes.title,
      width: 520,
      body: h(
        'div',
        { class: 'stack' },
        h('p', null, te.bedrockShapes.text),
        h('p', { class: 'muted' }, te.bedrockShapes.note),
      ),
      actions: [{ label: kit.ok, variant: 'primary' }],
    });
  }
  cleanups.push(() => modelEditor?.destroy());

  const bar = h(
    'header',
    { class: 'tx-bar' },
    h('a', { class: 'icon-btn tx-back', href: routeHref('/textures'), 'aria-label': te.allPacks }, icon('arrow-left')),
    h('div', { class: 'tx-bar-iconbox checker' }, barIcon),
    h('div', { class: 'tx-bar-title' }, nameInput, measurer, h('span', { class: 'tx-bar-sub' }, badge(versionText(proj), proj.edition === 'java' ? 'green' : 'blue'), saveEl)),
    h('span', { class: 'grow' }),
    h('div', { class: 'tx-bar-actions' }, undoBtn, redoBtn, h('span', { class: 'toolbar-sep' }), helpBtn, fileBtn, exportBtn),
  );
  tooltip(bar.querySelector('.tx-back') as HTMLElement, te.allPacks);
  paintBarIcon();

  // ---------------------------------------------------------------- side panel + layout
  const sideTabs = tabs<Side>({
    value: side,
    label: kit.sidePanel,
    tabs: [
      { value: 'textures', label: te.tabs.textures, icon: 'bulletlist' },
      { value: 'preview', label: te.tabs.preview, icon: 'cube' },
      { value: 'effects', label: te.tabs.effects, icon: 'sparkles' },
      { value: 'pvp', label: te.tabs.pvp, icon: 'sword' },
      { value: 'pack', label: te.tabs.pack, icon: 'settings' },
    ],
    onChange: (v) => setSide(v),
  });
  const bodies: Record<Exclude<Side, 'textures'>, HTMLElement> = {
    preview: h('div', { class: 'tx-side-body scroll', dataset: { tab: 'preview' }, role: 'tabpanel', 'aria-label': te.tabs.preview }, preview.el),
    effects: h('div', { class: 'tx-side-body scroll', dataset: { tab: 'effects' }, role: 'tabpanel', 'aria-label': te.tabs.effects }, effects.el),
    pvp: pvpBody,
    pack: h('div', { class: 'tx-side-body scroll', dataset: { tab: 'pack' }, role: 'tabpanel', 'aria-label': te.packSettings }, pack.el),
  };

  const tabbarItems: { v: Mobile; label: string; ic: IconName }[] = [
    { v: 'textures', label: te.tabs.textures, ic: 'bulletlist' },
    { v: 'editor', label: te.tabs.paint, ic: 'pencil' },
    { v: 'preview', label: te.tabs.preview, ic: 'cube' },
    { v: 'effects', label: te.tabs.effects, ic: 'sparkles' },
    { v: 'pvp', label: te.tabs.pvp, ic: 'sword' },
    { v: 'pack', label: te.tabs.pack, ic: 'settings' },
  ];
  const tabbarButtons = new Map<Mobile, HTMLButtonElement>();
  const tabbar = h('nav', { class: 'tx-tabbar', 'aria-label': te.sections });
  for (const t of tabbarItems) {
    const b = h('button', { type: 'button', class: 'tx-tabbar-btn', dataset: { v: t.v } }, icon(t.ic), h('span', null, t.label));
    b.addEventListener('click', () => showMobile(t.v));
    tabbarButtons.set(t.v, b);
    tabbar.appendChild(b);
  }
  /** In Sounds mode the list and editor tabs are about sounds. */
  function paintTabbar() {
    const sounds = libMode === 'sounds';
    for (const tab of [tabbarButtons.get('textures'), sideTabs.querySelector<HTMLElement>('.tab[data-value="textures"]')]) {
      const label = tab?.querySelector('span:not(.icon)');
      const ic = tab?.querySelector<HTMLElement>('.icon');
      if (label) label.textContent = sounds ? te.tabs.sounds : te.tabs.textures;
      if (ic) setIcon(ic, sounds ? 'music' : 'bulletlist');
    }
    const ed = tabbarButtons.get('editor');
    const label = ed?.querySelector('span:not(.icon)');
    const ic = ed?.querySelector<HTMLElement>('.icon');
    if (label) label.textContent = sounds ? te.tabs.edit : te.tabs.paint;
    if (ic) setIcon(ic, sounds ? 'volume-2' : 'pencil');
  }

  const main = h(
    'div',
    { class: 'tx-main' },
    h('div', { class: 'tx-col-left' }, browser.el, modelBrowser.el, soundLeft),
    h('div', { class: 'tx-col-center' }, canvas.el, soundCenter),
    h('div', { class: 'tx-col-tabs' }, sideTabs),
    h('div', { class: 'tx-col-right panel' }, bodies.preview, bodies.effects, bodies.pvp, bodies.pack),
  );
  shell.replaceChildren(bar, main, modelHost, tabbar);
  sizeName();
  void document.fonts?.ready.then(() => sizeName());

  function notifyVisibility() {
    const phone = isPhone();
    const vis = (t: Side) => (phone ? mobile === t : side === t);
    // In the 3D workspace the model is in the centre, which is on screen unless a phone shows another tab.
    preview.setVisible(vis('preview') || (workspace === '3d' && libMode !== 'sounds' && (!phone || mobile === 'editor')));
    effects.setVisible(vis('effects'));
    pack.setVisible(vis('pack'));
    if (vis('pvp')) {
      if (pvpPanel) pvpPanel.setVisible(true);
      else void ensurePvp();
    } else pvpPanel?.setVisible(false);
  }

  function setSide(v: Side) {
    if (v === 'textures' && !isTablet() && !isPhone()) v = 'preview';
    side = v;
    shell.dataset.side = v;
    sideTabs.setValue(v);
    notifyVisibility();
  }

  function showMobile(v: Mobile, focusSearch = false) {
    mobile = v;
    shell.dataset.mobile = v;
    tabbarButtons.forEach((b, k) => b.setAttribute('aria-current', k === v ? 'page' : 'false'));
    if (v !== 'editor') setSide(v);
    else notifyVisibility();
    if (!isPhone() && !isTablet() && v === 'textures') setSide('preview');
    if (isTablet() && v === 'textures') setSide('textures');
    if (focusSearch) requestAnimationFrame(() => focusSearch_());
  }
  const focusSearch_ = () => (libMode === 'sounds' ? soundsMode?.focusSearch() : libMode === 'textures' ? browser.focusSearch() : modelBrowser.focusSearch());

  setSide(side);
  showMobile('editor');
  setLibMode(libMode);
  try {
    if (localStorage.getItem(WS_KEY) === '3d') setWorkspace('3d');
  } catch {
    /* storage blocked */
  }
  // The "Used by" chips need the model library: fetch it shortly after opening.
  const libTimer = setTimeout(() => void models.load(), 700);
  cleanups.push(
    () => clearTimeout(libTimer),
    // Versions without block models (Java before 1.8) start in All textures.
    models.events.on('ready', () => {
      if (models.lib && !models.lib.available && libMode !== 'textures' && libMode !== 'sounds') setLibMode('textures');
    }),
  );
  const mqs = [matchMedia(PHONE), matchMedia(TABLET)];
  const onMq = () => {
    if (!isTablet() && !isPhone() && side === 'textures') setSide('preview');
    notifyVisibility();
  };
  mqs.forEach((m) => m.addEventListener('change', onMq));
  cleanups.push(() => mqs.forEach((m) => m.removeEventListener('change', onMq)));

  // ---------------------------------------------------------------- store events
  cleanups.push(
    store.events.on('save', (s) => paintSave(s)),
    store.events.on('effects', () => paintBarIcon()),
    store.events.on('overrides', ({ path }) => {
      if (/grass|stone/.test(path)) paintBarIcon();
    }),
    store.events.on('meta', () => {
      paintBarIcon();
      if (document.activeElement !== nameInput && nameInput.value !== plainText(proj.name)) {
        nameInput.value = plainText(proj.name);
        sizeName();
      }
    }),
  );

  // ---------------------------------------------------------------- shortcuts
  function showShortcuts() {
    const k = te.shortcuts;
    const split = (k: string) =>
      k
        .replace('Ctrl/Cmd', 'Mod')
        .split(/\s*,\s*/)[0]
        .split(/\s*\+\s*/)
        .filter(Boolean);
    openShortcutsSheet([
      {
        title: k.editor,
        items: [
          { keys: ['?'], label: k.showList },
          { keys: ['Mod', 'S'], label: k.saveNow },
          { keys: ['/'], label: k.search },
          { keys: ['C'], label: k.compare },
          { keys: [','], label: k.prevFrame },
          { keys: ['.'], label: k.nextFrame },
          { keys: ['Mod', 'Z'], label: k.undo },
          { keys: ['Mod', 'Shift', 'Z'], label: k.redo },
        ],
      },
      {
        title: k.model,
        items: [
          { keys: ['D'], label: k.toggle3d },
          { keys: [k.drag], label: k.paintTool },
          { keys: ['Alt', k.click], label: k.pickColour },
          { keys: [k.rightDrag], label: k.turnOrDrag },
          { keys: [k.space, k.drag], label: k.turn },
          { keys: [k.wheel], label: k.zoom },
          { keys: [k.arrows], label: k.turn },
        ],
      },
      {
        title: k.list,
        items: [
          { keys: [k.click], label: k.clickFace },
          { keys: [k.arrows], label: k.moveTextures },
          { keys: ['Enter'], label: k.openPaint },
          { keys: ['Shift', 'F10'], label: k.more },
          { keys: ['Esc'], label: k.clearSearch },
        ],
      },
      {
        title: k.painting,
        items: PIXEL_SHORTCUTS.filter((s) => !/undo|redo/i.test(s.id)).map((s) => ({ keys: split(s.keys), label: s.action })),
      },
      {
        title: k.sounds,
        items: [
          { keys: [k.space], label: k.playStop },
          { keys: [k.arrows], label: k.moveSounds },
          { keys: ['Enter'], label: k.openSound },
          { keys: ['←', '→'], label: k.trimSmall },
          { keys: ['Shift', '←'], label: k.trimBig },
        ],
      },
    ]);
  }

  const onKey = (e: KeyboardEvent) => {
    if (document.querySelector('dialog[open]')) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      void store.flush().then(() => {
        if (store.saveState === 'saved') toast(te.save.saved, { tone: 'success', duration: 1400 });
      });
      return;
    }
    if (modelEditor || modelOpening) return;
    if (isTypingTarget(e.target) || mod || e.altKey) return;
    if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
      e.preventDefault();
      showShortcuts();
    } else if (e.key === '/') {
      e.preventDefault();
      if (isPhone()) showMobile('textures');
      else if (isTablet()) setSide('textures');
      requestAnimationFrame(() => focusSearch_());
    } else if (libMode === 'sounds') {
      return;
    } else if (e.key === 'd' || e.key === 'D') {
      if (e.shiftKey || !canvas.current()) return;
      e.preventDefault();
      setWorkspace(workspace === '3d' ? '2d' : '3d', true);
    } else if (e.key === ',' || e.key === '.') {
      if ((e.target as HTMLElement | null)?.closest?.('[role="listbox"],[role="menu"]')) return;
      e.preventDefault();
      canvas.stepFrame(e.key === ',' ? -1 : 1);
    }
  };
  window.addEventListener('keydown', onKey);
  cleanups.push(() => window.removeEventListener('keydown', onKey));

  // ---------------------------------------------------------------- autosave safety nets
  const onBeforeUnload = (e: BeforeUnloadEvent) => {
    if (!store.hasUnsaved()) return;
    void store.flush();
    e.preventDefault();
    e.returnValue = '';
  };
  const onHide = () => {
    if (document.visibilityState === 'hidden') void store.flush();
  };
  window.addEventListener('beforeunload', onBeforeUnload);
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', onHide);
  cleanups.push(() => {
    window.removeEventListener('beforeunload', onBeforeUnload);
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', onHide);
  });

  // ---------------------------------------------------------------- first texture
  let last: string | null = null;
  try {
    last = localStorage.getItem(`to-tex-last:${proj.id}`);
  } catch {
    last = null;
  }
  if (last && store.byPath.has(last)) void canvas.open(last);

  // A new PvP pack: its tweaks go on once the game files are here, then the PvP tab shows them.
  const pending = proj.pvp?.pending;
  if (pending) {
    if (isPhone()) showMobile('pvp');
    else setSide('pvp');
    void ensurePvp().then((p) => p?.applyPreset(pending.fps));
  }

  if (import.meta.env.DEV) {
    (window as unknown as { __tx?: unknown }).__tx = {
      store,
      canvas,
      models,
      preview,
      setLibraryMode: (m: LibMode) => setLibMode(m),
      sounds: () => ensureSounds(),
      soundState: () => soundsMode?.state ?? null,
      setWorkspace: (ws: Workspace) => setWorkspace(ws, true),
      workspace: () => workspace,
      showBlock: (id: string) => {
        const e = models.lib?.block(id);
        if (e) showEntry(e, 'pointer');
        return !!e;
      },
      modelEditor: () => modelEditor,
      pvp: () => ensurePvp(),
      editModel: (kind: 'block' | 'item', id: string, st: BlockState = {}) => {
        const e = kind === 'block' ? models.lib?.block(id) : models.lib?.item(id);
        if (e) void openModelEditor(e, st);
        return !!e;
      },
      showMob: (id: string) => {
        const e = models.lib?.entity(id);
        if (e) showEntry(e, 'pointer');
        return !!e;
      },
      open: (p: string) => canvas.open(p),
      pixel: (x: number, y: number) => {
        const t = canvas.current();
        if (!t) return null;
        const i = (y * t.full.width + x) * 4;
        return Array.from(t.full.data.slice(i, i + 4));
      },
    };
  }

  return () => {
    void store.flush();
    cleanups.forEach((f) => f());
    browser.destroy();
    modelBrowser.destroy();
    soundsMode?.destroy();
    usedBy.destroy();
    paint3d.destroy();
    canvas.destroy();
    preview.destroy();
    models.dispose();
    effects.destroy();
    pack.destroy();
    thumbs.clear();
  };

  // ---------------------------------------------------------------- helpers
  async function loadVanilla(p: TexturePackProject, host: HTMLElement, placeholder: HTMLElement, signal: AbortSignal): Promise<AssetIndex | null> {
    const cached = await isAssetsCached(p.edition, p.version).catch(() => false);
    let panel: ReturnType<typeof assetLoadingPanel> | null = null;
    const wrap = h('div', { class: 'tx-assets' });
    const showPanel = () => {
      if (panel) return;
      panel = assetLoadingPanel({
        edition: p.edition,
        version: p.edition === 'java' ? p.version : undefined,
        onPickJar: (f) => void attempt(f),
        onCancel: () => navigate('/textures'),
      });
      wrap.replaceChildren(
        h(
          'div',
          { class: 'tx-assets-head' },
          h('span', { class: 'eyebrow' }, icon('image'), te.texturePack),
          h('h1', { class: 'tx-assets-name truncate' }, plainText(p.name) || te.untitled),
          h('p', { class: 'muted' }, `${versionText(p)} · ${p.resolution}×`),
        ),
        panel,
        h('a', { class: 'btn btn-ghost btn-sm tx-assets-back', href: routeHref('/textures') }, icon('arrow-left'), h('span', { class: 'btn-label' }, te.allPacks)),
      );
      host.replaceChildren(wrap);
    };
    let timer: ReturnType<typeof setTimeout> | null = cached ? setTimeout(showPanel, 600) : null;
    if (!cached) showPanel();
    else placeholder.querySelector('span')!.textContent = te.loadingTextures;

    let resolveDone!: (a: AssetIndex | null) => void;
    const done = new Promise<AssetIndex | null>((r) => (resolveDone = r));
    // Leaving the page (even from the error state, where nothing is loading) ends the wait.
    signal.addEventListener('abort', () => resolveDone(null), { once: true });
    let attemptId = 0;
    async function attempt(jarFile?: File) {
      const my = ++attemptId;
      if (jarFile) showPanel();
      panel?.set({ label: jarFile ? fmt(te.readingJar, { name: jarFile.name }) : te.starting, fraction: null });
      try {
        const a = await loadAssets(p.edition, p.version, {
          jarFile,
          signal,
          onProgress: (pr) => {
            if (!root.isConnected) controller.abort();
            else if (my === attemptId) panel?.set(pr);
          },
        });
        if (my !== attemptId) return;
        if (timer) clearTimeout(timer);
        resolveDone(a);
      } catch (err) {
        if (my !== attemptId) return;
        if (timer) clearTimeout(timer);
        if (isAbortError(err) || signal.aborted) {
          resolveDone(null);
          return;
        }
        console.error(err);
        showPanel();
        panel?.error(friendlyError(err), () => void attempt(), p.edition === 'java' ? (f) => void attempt(f) : undefined);
      }
    }
    void attempt();
    return done;
  }
}
