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
import { getProject, saveProject } from '../../../core/storage';
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
import '../gui/gui-base.css';
import './model-host.css';
import { fmt, textLocale } from '../../../i18n/editor-text';
import type { PvpPanel } from '../pvp/panel';
import type { CrosshairTarget } from '../pvp/tweaks';
import type { GuiMode } from '../gui/gui-mode';
import type { GuiPiece } from '../gui/catalog';
import type { MaterialPanel } from '../pbr/panel';
import { createNamesStrip } from '../names/strip';
import { adoptPackNames, hasPackNames, itemBaseModel, variantOfTexture } from '../names/pack';
import { definitionPath, flatModel } from '../names/names';
import { prettyJson } from '../models/doc';
import { kit } from '../../../ui/i18n/kit';
import { te } from './i18n/editor';
import { versionLabel } from './start-screen';
import { PHONE_MQ, TABLET_MQ } from './media';
import { projectsText } from '../../../shared/i18n/projects';
import { saveProjectFile } from '../../../shared/project-file/entry';

type Side = 'textures' | 'preview' | 'material' | 'effects' | 'pvp' | 'pack';
type LibMode = 'blocks' | 'items' | 'mobs' | 'textures' | 'gui' | 'sounds';
const LIB_KEY = 'to-tex-library-mode';
const WS_KEY = 'to-tex-workspace';
type Mobile = 'textures' | 'editor' | 'preview' | 'material' | 'effects' | 'pvp' | 'pack';

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

  // An opened pack's PBR maps and texture sets belong to their textures' materials (the Material tab).
  if (hasPackPbr(proj)) {
    try {
      const { adoptPackPbr } = await import('../pbr/pack');
      if ((await adoptPackPbr(proj, assets)) > 0) await saveProject(proj);
    } catch (err) {
      console.error(err);
    }
    if (life.aborted) return () => cleanups.forEach((f) => f());
  }
  // An opened pack's name-based textures (OptiFine CIT files, 1.21.5+ item definitions) become looks.
  if (hasPackNames(proj)) {
    try {
      if ((await adoptPackNames(proj, assets)) > 0) await saveProject(proj);
    } catch (err) {
      console.error(err);
    }
    if (life.aborted) return () => cleanups.forEach((f) => f());
  }

  // ---------------------------------------------------------------- state + panels
  const store = new TexStore(proj, assets);
  const thumbs = new ThumbService(store);
  const models = new ModelService(store);
  let libMode: LibMode = 'blocks';
  try {
    const saved = localStorage.getItem(LIB_KEY);
    if (saved === 'blocks' || saved === 'items' || saved === 'mobs' || saved === 'textures' || saved === 'gui' || saved === 'sounds') libMode = saved;
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
        { value: 'gui', label: '', icon: 'layout' },
        { value: 'sounds', label: '', icon: 'music' },
      ],
      onChange: (v) => setLibMode(v, true),
    });
    // "All" keeps four labels apart in the narrow side panel; say in full what it lists
    const all = sw.querySelector<HTMLElement>('[data-value="textures"]');
    all?.setAttribute('title', te.lib.allTextures);
    all?.setAttribute('aria-label', te.lib.allTextures);
    // GUI is a window icon next to the note
    const gui = sw.querySelector<HTMLElement>('[data-value="gui"]');
    gui?.setAttribute('title', te.lib.gui);
    gui?.setAttribute('aria-label', te.lib.gui);
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

  const namesStrip = createNamesStrip({
    store,
    models,
    openTexture: (path) => {
      void canvas.open(path);
      if (isPhone()) showMobile('editor');
    },
    openNames: (path, add) => void openNames({ path, add }),
    onChange: () => usedBy.refresh(),
  });
  const usedBy = createUsedBy({ store, models, onPick: (e) => showEntry(e, 'chip'), extra: namesStrip.el });
  const canvas = createCanvasPanel({
    store,
    belowHeader: usedBy.el,
    onOpened: (t) => {
      preview.setTexture(t);
      browser.setSelected(t && t.key !== ICON_KEY ? t.key : null, true);
      usedBy.setPath(t && t.key !== ICON_KEY ? t.key : null);
      namesStrip.setPath(t && t.key !== ICON_KEY ? t.key : null);
      paint3d.textureChanged();
      guiMode?.textureOpened(t && t.key !== ICON_KEY ? t.key : null);
      materialPanel?.setTexture(t);
    },
    onHistory: () => paintHistory(),
    onBrowse: () => showMobile('textures', true),
    onWorkspace: (v) => setWorkspace(v, true),
    onFrame: () => paint3d.textureChanged(),
    onSettings: () => paint3d.sync(),
    onCanvasHover: (p) => paint3d.canvasHover(p),
    // Phones show the preview on its own tab: its "Edit shape" is in the texture's menu too.
    menuItems: () => {
      const cur = canvas.current();
      return [
        ...(isPhone() && preview.canEditShape() ? [{ label: te.preview.editShape, icon: 'shapes' as const, onClick: () => preview.editShape() }] : []),
        // an item's picture (or one of its looks'): textures picked by the item's name
        ...(cur && cur.key !== ICON_KEY && (cur.entry?.category === 'item' || variantOfTexture(proj, cur.key)) ? [{ label: te.names.menu, icon: 'label' as const, onClick: () => void openNames({ path: cur.key }) }] : []),
      ];
    },
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
    onNames: (e) => void openNames({ item: e.id, path: canvas.current()?.key ?? '' }),
  });

  const paint3d = createPaint3d({ store, canvas, preview });
  let workspace: Workspace = '2d';
  /** 2D: the pixel editor in the centre. 3D: the model in the centre, painted directly; the pixel editor in the side panel. */
  function setWorkspace(ws: Workspace, user = false) {
    // the GUI is flat: GUI mode keeps the pixel editor
    if (ws === '3d' && libMode === 'gui') {
      canvas.setWorkspace(workspace);
      return;
    }
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
    fitTabbar();
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
    const isGui = v === 'gui';
    const models3d = v !== 'textures' && !isSounds && !isGui;
    browser.el.hidden = v !== 'textures';
    modelBrowser.el.hidden = !models3d;
    if (models3d) {
      modelBrowser.setKind(v === 'blocks' ? 'block' : v === 'items' ? 'item' : 'entity');
      modelBrowser.activate();
    }
    shell.dataset.lib = isSounds ? 'sounds' : isGui ? 'gui' : '';
    setSoundsShown(isSounds, user);
    setGuiShown(isGui, user);
    if (user && !isSounds && !isGui) requestAnimationFrame(() => (models3d ? modelBrowser.focusSearch() : browser.focusSearch()));
  }

  // ---------------------------------------------------------------- GUI (loaded on first use)
  const guiLeft = h('div', { class: 'gui-host', hidden: true }, h('div', { class: 'snd-host-loading' }, spinner(28)));
  const guiCenter = h('div', { class: 'gui-host gui-host-center', hidden: true });
  const guiPreview = h('div', { class: 'gui-pv-host', hidden: true });
  let guiMode: GuiMode | null = null;
  let guiLoad: Promise<GuiMode | null> | null = null;
  function ensureGui(): Promise<GuiMode | null> {
    guiLoad ??= Promise.all([import('../gui/gui-mode'), import('../gui/i18n/load').then((m) => m.loadGuiText(textLocale()))])
      .then(([{ createGuiMode }]) => {
        if (life.aborted) return null;
        guiMode = createGuiMode({
          store,
          top: makeSwitch(),
          openPiece: (piece, how) => void openGuiPiece(piece, how),
          openTexture: (path) => {
            guiMode?.hideSplashes();
            void canvas.open(path);
            if (isPhone()) showMobile('editor');
          },
          onCentre: (splashes) => {
            shell.dataset.gui = splashes ? 'splash' : '';
            guiCenter.hidden = !splashes;
            paintTabbar();
            if (splashes && isPhone()) showMobile('editor');
            notifyVisibility();
          },
          onBrowse: () => showMobile('textures', true),
        });
        guiLeft.replaceChildren(guiMode.libraryEl);
        guiCenter.replaceChildren(guiMode.splashEl);
        guiPreview.replaceChildren(guiMode.previewEl);
        const cur = canvas.current();
        guiMode.textureOpened(cur && cur.key !== ICON_KEY ? cur.key : null);
        return guiMode;
      })
      .catch((err) => {
        guiLoad = null;
        console.error(err);
        toast(te.guiFailed, { tone: 'error' });
        return null;
      });
    return guiLoad;
  }
  function setGuiShown(on: boolean, user: boolean) {
    guiLeft.hidden = !on;
    guiPreview.hidden = !on;
    guiCenter.hidden = !on || !guiMode?.splashesShown();
    if (!on) {
      guiMode?.deactivate();
      notifyVisibility();
      return;
    }
    // the GUI is flat: the pixel editor in the centre
    if (workspace === '3d') setWorkspace('2d');
    notifyVisibility();
    void ensureGui().then((m) => {
      if (!m || libMode !== 'gui') return;
      m.activate();
      notifyVisibility();
      // something to look at straight away: the hotbar
      const first = m.cat.piece('hotbar.bar') ?? m.cat.piece('hotbar.slot1');
      if (user && first && !canvas.current() && !m.splashesShown()) void openGuiPiece(first, 'keyboard');
      if (user && !isPhone()) requestAnimationFrame(() => m.focusSearch());
    });
  }
  /** Opens a GUI piece in the pixel editor, its area of an atlas selected and zoomed to. */
  async function openGuiPiece(piece: GuiPiece, how: 'pointer' | 'keyboard' | 'preview') {
    guiMode?.hideSplashes();
    if (workspace === '3d') setWorkspace('2d');
    if (canvas.current()?.key !== piece.path) await canvas.open(piece.path);
    const pc = canvas.canvas();
    const t = canvas.current();
    if (pc && t && t.key === piece.path) {
      if (piece.region) {
        const { pieceRect } = await import('../gui/catalog');
        const r = pieceRect(piece, t.full);
        pc.setSelection(r);
        requestAnimationFrame(() => requestAnimationFrame(() => pc.zoomToRect(r)));
      } else if (pc.getSelection()) pc.deselect();
    }
    guiMode?.textureOpened(piece.path);
    if (isPhone() && how !== 'keyboard') showMobile('editor');
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

  // ---------------------------------------------------------------- Material (PBR, loaded on first use)
  const materialBody = h('div', { class: 'tx-side-body scroll', dataset: { tab: 'material' }, role: 'tabpanel', 'aria-label': te.tabs.material }, h('div', { class: 'tx-boot' }, spinner(28)));
  let materialPanel: MaterialPanel | null = null;
  let materialLoad: Promise<MaterialPanel | null> | null = null;
  function ensureMaterial(): Promise<MaterialPanel | null> {
    materialLoad ??= Promise.all([import('../pbr/panel'), import('../pbr/i18n/load').then((m) => m.loadPbrText(textLocale()))])
      .then(([{ createMaterialPanel }]) => {
        if (life.aborted) return null;
        materialPanel = createMaterialPanel({ store, selection: () => canvas.canvas()?.getSelection() ?? null });
        materialPanel.setTexture(canvas.current());
        materialBody.replaceChildren(materialPanel.el);
        notifyVisibility();
        return materialPanel;
      })
      .catch((err) => {
        materialLoad = null;
        console.error(err);
        toast(te.pbrFailed, { tone: 'error' });
        return null;
      });
    return materialLoad;
  }
  cleanups.push(() => materialPanel?.destroy());

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

  // ---------------------------------------------------------------- name-based textures (loaded on first use)
  /** The window of an item's name-based textures: for the item whose picture `path` is (or `item`). */
  async function openNames(o: { path: string; item?: string; add?: boolean }) {
    try {
      const { openNamesDialog } = await import('../names/dialog');
      if (life.aborted) return;
      await openNamesDialog({
        store,
        models,
        ...o,
        openTexture: (path) => {
          if (libMode === 'sounds' || libMode === 'gui') setLibMode('textures', true);
          void canvas.open(path, { focus: true });
          if (isPhone()) showMobile('editor');
        },
        editShape: (id) => void openLookShape(id),
        // the look's texture is gone: show the item's
        onRemoved: (texture, item) => {
          if (canvas.current()?.key === texture) void canvas.open(item);
        },
      });
    } catch (err) {
      console.error(err);
      toast(te.names.failed, { tone: 'error' });
    }
  }
  /** A look's own 3D shape in the model editor (its model file; "put back" makes it flat again). */
  async function openLookShape(id: string) {
    const v = proj.nameVariants?.[id];
    const lib = models.lib ?? (await models.load());
    const e = v && lib?.item(v.item);
    if (!v || !e) return;
    const label = v.names.map((n) => fmt(te.names.quoted, { name: n })).join(', ') || v.match || id;
    const base = itemBaseModel(v.item, lib!.javaFiles()?.vanilla(definitionPath(v.item)));
    await openModelEditor(e, {}, { model: v.model, label, flat: () => prettyJson(flatModel(base, v.texture)) });
  }

  // ---------------------------------------------------------------- model editor (loaded on first use)
  const modelHost = h('div', { class: 'tx-modelhost', hidden: true });
  async function openModelEditor(e: ModelEntry, st: BlockState, look?: { model: string; label: string; flat(): string }) {
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
        look,
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
      { value: 'material', label: te.tabs.material, icon: 'diamond-gem' },
      { value: 'effects', label: te.tabs.effects, icon: 'sparkles' },
      { value: 'pvp', label: te.tabs.pvp, icon: 'sword' },
      { value: 'pack', label: te.tabs.pack, icon: 'settings' },
    ],
    onChange: (v) => setSide(v),
  });
  const bodies: Record<Exclude<Side, 'textures'>, HTMLElement> = {
    preview: h('div', { class: 'tx-side-body scroll', dataset: { tab: 'preview' }, role: 'tabpanel', 'aria-label': te.tabs.preview }, preview.el, guiPreview),
    material: materialBody,
    effects: h('div', { class: 'tx-side-body scroll', dataset: { tab: 'effects' }, role: 'tabpanel', 'aria-label': te.tabs.effects }, effects.el),
    pvp: pvpBody,
    pack: h('div', { class: 'tx-side-body scroll', dataset: { tab: 'pack' }, role: 'tabpanel', 'aria-label': te.packSettings }, pack.el),
  };

  const tabbarItems: { v: Mobile; label: string; ic: IconName }[] = [
    { v: 'textures', label: te.tabs.textures, ic: 'bulletlist' },
    { v: 'editor', label: te.tabs.paint, ic: 'pencil' },
    { v: 'preview', label: te.tabs.preview, ic: 'cube' },
    { v: 'material', label: te.tabs.material, ic: 'diamond-gem' },
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
    // the splash texts are edited, not painted
    const splashes = libMode === 'gui' && !!guiMode?.splashesShown();
    if (label) label.textContent = sounds || splashes ? te.tabs.edit : te.tabs.paint;
    if (ic) setIcon(ic, sounds ? 'volume-2' : splashes ? 'notes' : 'pencil');
    fitTabbar();
  }
  /**
   * Seven names don't fit every phone in every language (Russian at 3x): then only the open tab
   * shows its name, the others their icon (the names stay for screen readers).
   */
  function fitTabbar() {
    fitSideTabs();
    if (!tabbar.isConnected || !isPhone()) {
      tabbar.classList.remove('is-tight');
      return;
    }
    tabbar.classList.remove('is-tight');
    // cut off, or (names under their icons) so wide that they run into the next one
    const tight = [...tabbar.querySelectorAll<HTMLElement>('.tx-tabbar-btn span:not(.icon)')].some((sp) => {
      const btn = sp.parentElement as HTMLElement;
      return sp.scrollWidth > sp.clientWidth + 1 || (getComputedStyle(btn).flexDirection === 'column' && sp.scrollWidth > btn.clientWidth - 8);
    });
    tabbar.classList.toggle('is-tight', tight);
  }
  /**
   * Five names can fill the side panel's tabs edge to edge (Preview, Material, Effects ...): then
   * they get the smaller size, and where even that runs together, icons and the open tab's name.
   */
  function fitSideTabs() {
    const col = sideTabs.parentElement;
    if (!col?.isConnected) return;
    col.classList.remove('is-snug', 'is-tight');
    // phones have the tab bar; tablets already show icons and the open tab's name
    const ic = sideTabs.querySelector<HTMLElement>('.tab .icon');
    if (!col.offsetWidth || isPhone() || (ic && getComputedStyle(ic).display !== 'none')) return;
    const crowded = () =>
      [...sideTabs.querySelectorAll<HTMLElement>('.tab')].some((tab) => {
        const sp = tab.querySelector<HTMLElement>('span:not(.icon)');
        return tab.offsetWidth > 0 && !!sp && sp.scrollWidth > tab.clientWidth - 12;
      });
    if (!crowded()) return;
    col.classList.add('is-snug');
    if (crowded()) col.classList.replace('is-snug', 'is-tight');
  }

  const main = h(
    'div',
    { class: 'tx-main' },
    h('div', { class: 'tx-col-left' }, browser.el, modelBrowser.el, guiLeft, soundLeft),
    h('div', { class: 'tx-col-center' }, canvas.el, guiCenter, soundCenter),
    h('div', { class: 'tx-col-tabs' }, sideTabs),
    h('div', { class: 'tx-col-right panel' }, bodies.preview, bodies.material, bodies.effects, bodies.pvp, bodies.pack),
  );
  shell.replaceChildren(bar, main, modelHost, tabbar);
  sizeName();
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => fitTabbar());
    ro.observe(tabbar);
    if (sideTabs.parentElement) ro.observe(sideTabs.parentElement);
    cleanups.push(() => ro.disconnect());
  }
  void document.fonts?.ready.then(() => fitTabbar());
  void document.fonts?.ready.then(() => sizeName());

  function notifyVisibility() {
    const phone = isPhone();
    const vis = (t: Side) => (phone ? mobile === t : side === t);
    // In the 3D workspace the model is in the centre, which is on screen unless a phone shows another tab.
    // In GUI mode the Preview tab shows the GUI preview instead.
    const gui = libMode === 'gui';
    preview.setVisible(!gui && (vis('preview') || (workspace === '3d' && libMode !== 'sounds' && (!phone || mobile === 'editor'))));
    guiMode?.setPreviewVisible(gui && vis('preview'));
    effects.setVisible(vis('effects'));
    pack.setVisible(vis('pack'));
    if (vis('pvp')) {
      if (pvpPanel) pvpPanel.setVisible(true);
      else void ensurePvp();
    } else pvpPanel?.setVisible(false);
    if (vis('material')) {
      if (materialPanel) materialPanel.setVisible(true);
      else void ensureMaterial();
    } else materialPanel?.setVisible(false);
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
  const focusSearch_ = () =>
    libMode === 'sounds' ? soundsMode?.focusSearch() : libMode === 'gui' ? guiMode?.focusSearch() : libMode === 'textures' ? browser.focusSearch() : modelBrowser.focusSearch();

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
      if (models.lib && !models.lib.available && libMode !== 'textures' && libMode !== 'sounds' && libMode !== 'gui') setLibMode('textures');
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
      if (e.shiftKey || !canvas.current() || libMode === 'gui') return;
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
      names: (path?: string, add = false) => openNames({ path: path ?? canvas.current()?.key ?? '', add }),
      lookShape: (id: string) => openLookShape(id),
      pvp: () => ensurePvp(),
      material: () => ensureMaterial(),
      showSide: (v: Side) => (isPhone() ? showMobile(v as Mobile) : setSide(v)),
      gui: () => ensureGui(),
      guiMode: () => guiMode,
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
    guiMode?.destroy();
    usedBy.destroy();
    namesStrip.destroy();
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

/** The project still has an opened pack's PBR files among its textures (labPBR maps, texture sets). */
function hasPackPbr(p: TexturePackProject): boolean {
  if (p.edition === 'java') return Object.keys(p.overrides).some((k) => /_(n|s)\.png$/.test(k));
  return Object.keys(p.extraFiles).some((k) => k.startsWith('textures/') && k.endsWith('.texture_set.json'));
}
