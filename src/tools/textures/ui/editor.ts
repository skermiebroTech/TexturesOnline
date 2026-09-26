// Texture pack editor at #/textures/:id — loads the project and vanilla assets, then lays out the
// browser, canvas and side panels (3 panes on desktop, 2 on tablets, tabbed on phones), with the
// top bar (name, save state, undo/redo, export), keyboard shortcuts and autosave.

import type { AssetIndex, TexturePackProject } from '../../../core/types';
import { h, isTypingTarget } from '../../../ui/dom';
import { icon, type IconName } from '../../../ui/icons';
import { badge, button, emptyState, iconButton, spinner, tabs, tooltip } from '../../../ui/components';
import { assetLoadingPanel } from '../../../ui/version-picker';
import { openShortcutsSheet } from '../../../ui/modal';
import { toast } from '../../../ui/toast';
import { getProject } from '../../../core/storage';
import { friendlyError, isAbortError } from '../../../core/net';
import { navigate } from '../../../core/router';
import { bedrockDisplayVersion, isAssetsCached, loadAssets } from '../../../editions/index';
import { PIXEL_SHORTCUTS } from '../../../shared/pixel-canvas';
import { TexStore, ICON_KEY, type SaveState } from './store';
import { ThumbService, paintCanvas } from './thumbs';
import { createBrowser } from './browser';
import { createCanvasPanel } from './canvas-panel';
import { createPreviewPanel } from './preview-panel';
import { createEffectsPanel } from './effects-panel';
import { createPackPanel } from './pack-panel';
import { openExportDialog } from './export-dialog';
import { plainText } from './mc-text';

type Side = 'textures' | 'preview' | 'effects' | 'pack';
type Mobile = 'textures' | 'editor' | 'preview' | 'effects' | 'pack';

const PHONE = '(max-width: 760px)';
const TABLET = '(max-width: 1180px)';

function versionText(p: TexturePackProject): string {
  return p.edition === 'java' ? `Java ${p.version}` : `Bedrock ${p.version === 'latest' ? 'latest' : p.version === 'preview' ? 'preview' : bedrockDisplayVersion(p.version)}`;
}

export async function renderEditor(root: HTMLElement, id: string): Promise<() => void> {
  const cleanups: (() => void)[] = [];
  let alive = true;
  const shell = h('div', { class: 'tx-editor accent-green' });
  root.appendChild(shell);

  const loadingView = h('div', { class: 'tx-boot' }, spinner(32), h('span', { class: 'muted' }, 'Opening pack…'));
  shell.appendChild(loadingView);

  let project: TexturePackProject | undefined;
  try {
    const p = await getProject(id);
    project = p && p.kind === 'texturepack' ? (p as TexturePackProject) : undefined;
  } catch {
    project = undefined;
  }
  if (!alive) return () => undefined;
  if (!project) {
    shell.replaceChildren(
      h(
        'div',
        { class: 'tx-missing' },
        emptyState({
          icon: 'map',
          title: 'This pack isn’t here',
          text: 'It may have been deleted, or it was made in another browser. Projects are saved in the browser you made them in.',
          action: h(
            'div',
            { class: 'row wrap', style: { justifyContent: 'center' } },
            button({ label: 'All texture packs', icon: 'arrow-left', onClick: () => navigate('/textures') }),
            button({ label: 'New pack', icon: 'plus', variant: 'primary', onClick: () => navigate('/textures') }),
          ),
        }),
      ),
    );
    return () => undefined;
  }
  const proj = project;
  document.title = `${plainText(proj.name)} — Texture Pack Maker — TexturesOnline`;

  // ---------------------------------------------------------------- vanilla assets
  const controller = new AbortController();
  cleanups.push(() => controller.abort());
  const assets = await loadVanilla(proj, shell, loadingView, controller.signal);
  if (!assets || !alive) {
    return () => {
      alive = false;
      cleanups.forEach((f) => f());
    };
  }

  // ---------------------------------------------------------------- state + panels
  const store = new TexStore(proj, assets);
  const thumbs = new ThumbService(store);
  let side: Side = 'preview';
  let mobile: Mobile = 'editor';
  const isPhone = () => matchMedia(PHONE).matches;
  const isTablet = () => matchMedia(TABLET).matches && !isPhone();

  const canvas = createCanvasPanel({
    store,
    onOpened: (t) => {
      preview.setTexture(t);
      browser.setSelected(t && t.key !== ICON_KEY ? t.key : null, true);
    },
    onHistory: () => paintHistory(),
    onBrowse: () => showMobile('textures', true),
  });
  const browser = createBrowser({
    store,
    thumbs,
    onOpen: (path, how) => {
      void canvas.open(path, { focus: how === 'enter' });
      if (isPhone() && how !== 'keyboard') showMobile('editor');
      if (isTablet() && side === 'textures' && how === 'pointer') {
        /* keep the list open on tablets so browsing stays quick */
      }
    },
    onUpload: (path) => {
      void canvas.open(path).then(() => canvas.upload(path));
    },
    onDownload: (path) => void canvas.download(path),
    onReset: (path) => void canvas.reset(path),
  });
  const preview = createPreviewPanel(store);
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

  // ---------------------------------------------------------------- top bar
  const barIcon = h('canvas', { class: 'tx-bar-icon pixelated', width: 32, height: 32 });
  const paintBarIcon = () => {
    void store
      .getFull(ICON_KEY)
      .then((img) => {
        paintCanvas(barIcon, img);
        barIcon.parentElement?.classList.remove('is-auto');
      })
      .catch(() => barIcon.parentElement?.classList.add('is-auto'));
  };
  const nameInput = h('input', { class: 'tx-name-input', value: proj.name, maxLength: 80, 'aria-label': 'Pack name', spellcheck: false, autocomplete: 'off' });
  const sizeName = () => nameInput.style.setProperty('--chars', String(Math.max(6, Math.min(32, nameInput.value.length + 1))));
  sizeName();
  nameInput.addEventListener('input', () => {
    proj.name = nameInput.value;
    sizeName();
    store.touch('meta');
  });
  nameInput.addEventListener('blur', () => {
    if (!nameInput.value.trim()) {
      nameInput.value = proj.name = 'Untitled pack';
      sizeName();
      store.touch('meta');
    }
    document.title = `${plainText(proj.name)} — Texture Pack Maker — TexturesOnline`;
  });
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault();
      nameInput.blur();
    }
  });
  tooltip(nameInput, 'Rename your pack');

  const saveEl = h('button', { type: 'button', class: 'tx-save', 'aria-live': 'polite' });
  const paintSave = (s: SaveState) => {
    saveEl.dataset.state = s;
    saveEl.disabled = s !== 'error';
    const map: Record<SaveState, [IconName, string]> = {
      saved: ['check', 'Saved'],
      dirty: ['clock', 'Saving…'],
      saving: ['clock', 'Saving…'],
      error: ['warning-diamond', 'Not saved — retry'],
    };
    const [ic, label] = map[s];
    saveEl.replaceChildren(s === 'saving' ? spinner(16) : icon(ic, { size: 16 }), h('span', null, label));
    saveEl.title = s === 'error' ? store.lastError : s === 'saved' ? 'Every change is saved in this browser' : '';
  };
  saveEl.addEventListener('click', () => void store.flush());
  paintSave(store.saveState);

  const undoBtn = iconButton('undo', 'Undo — Ctrl+Z', () => canvas.undo(), { disabled: true });
  const redoBtn = iconButton('redo', 'Redo — Ctrl+Shift+Z', () => canvas.redo(), { disabled: true });
  const helpBtn = iconButton('keyboard', 'Keyboard shortcuts — ?', () => showShortcuts());
  const exportBtn = button({ label: 'Export', icon: 'download', variant: 'primary', class: 'tx-export-btn', onClick: () => openExportDialog(store) });
  function paintHistory() {
    undoBtn.disabled = !canvas.canUndo();
    redoBtn.disabled = !canvas.canRedo();
  }

  const bar = h(
    'header',
    { class: 'tx-bar' },
    h('a', { class: 'icon-btn tx-back', href: '#/textures', 'aria-label': 'All texture packs' }, icon('arrow-left')),
    h('div', { class: 'tx-bar-iconbox checker' }, barIcon, icon('image', { class: 'tx-bar-fallback', size: 16 })),
    h('div', { class: 'tx-bar-title' }, nameInput, h('span', { class: 'tx-bar-sub' }, badge(versionText(proj), proj.edition === 'java' ? 'green' : 'blue'), saveEl)),
    h('span', { class: 'grow' }),
    h('div', { class: 'tx-bar-actions' }, undoBtn, redoBtn, h('span', { class: 'toolbar-sep' }), helpBtn, exportBtn),
  );
  tooltip(bar.querySelector('.tx-back') as HTMLElement, 'All texture packs');
  paintBarIcon();

  // ---------------------------------------------------------------- side panel + layout
  const sideTabs = tabs<Side>({
    value: side,
    label: 'Side panel',
    tabs: [
      { value: 'textures', label: 'Textures', icon: 'bulletlist' },
      { value: 'preview', label: 'Preview', icon: 'cube' },
      { value: 'effects', label: 'Effects', icon: 'sparkles' },
      { value: 'pack', label: 'Pack', icon: 'settings' },
    ],
    onChange: (v) => setSide(v),
  });
  const bodies: Record<Exclude<Side, 'textures'>, HTMLElement> = {
    preview: h('div', { class: 'tx-side-body scroll', dataset: { tab: 'preview' }, role: 'tabpanel', 'aria-label': 'Preview' }, preview.el),
    effects: h('div', { class: 'tx-side-body scroll', dataset: { tab: 'effects' }, role: 'tabpanel', 'aria-label': 'Effects' }, effects.el),
    pack: h('div', { class: 'tx-side-body scroll', dataset: { tab: 'pack' }, role: 'tabpanel', 'aria-label': 'Pack settings' }, pack.el),
  };

  const tabbarItems: { v: Mobile; label: string; ic: IconName }[] = [
    { v: 'textures', label: 'Textures', ic: 'bulletlist' },
    { v: 'editor', label: 'Editor', ic: 'pencil' },
    { v: 'preview', label: 'Preview', ic: 'cube' },
    { v: 'effects', label: 'Effects', ic: 'sparkles' },
    { v: 'pack', label: 'Pack', ic: 'settings' },
  ];
  const tabbarButtons = new Map<Mobile, HTMLButtonElement>();
  const tabbar = h('nav', { class: 'tx-tabbar', 'aria-label': 'Editor sections' });
  for (const t of tabbarItems) {
    const b = h('button', { type: 'button', class: 'tx-tabbar-btn', dataset: { v: t.v } }, icon(t.ic), h('span', null, t.label));
    b.addEventListener('click', () => showMobile(t.v));
    tabbarButtons.set(t.v, b);
    tabbar.appendChild(b);
  }

  const main = h(
    'div',
    { class: 'tx-main' },
    h('div', { class: 'tx-col-left' }, browser.el),
    h('div', { class: 'tx-col-center' }, canvas.el),
    h('div', { class: 'tx-col-tabs' }, sideTabs),
    h('div', { class: 'tx-col-right panel' }, bodies.preview, bodies.effects, bodies.pack),
  );
  shell.replaceChildren(bar, main, tabbar);

  function notifyVisibility() {
    const phone = isPhone();
    const vis = (t: Side) => (phone ? mobile === t : side === t);
    preview.setVisible(vis('preview'));
    effects.setVisible(vis('effects'));
    pack.setVisible(vis('pack'));
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
    if (focusSearch) requestAnimationFrame(() => browser.focusSearch());
  }

  setSide(side);
  showMobile('editor');
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
    store.events.on('meta', () => {
      paintBarIcon();
      if (document.activeElement !== nameInput && nameInput.value !== proj.name) {
        nameInput.value = proj.name;
        sizeName();
      }
    }),
  );

  // ---------------------------------------------------------------- shortcuts
  function showShortcuts() {
    const split = (k: string) =>
      k
        .replace('Ctrl/Cmd', 'Mod')
        .split(/\s*,\s*/)[0]
        .split(/\s*\+\s*/)
        .filter(Boolean);
    openShortcutsSheet([
      {
        title: 'Editor',
        items: [
          { keys: ['?'], label: 'Show this list' },
          { keys: ['Mod', 'S'], label: 'Save now (it also saves by itself)' },
          { keys: ['/'], label: 'Search textures' },
          { keys: ['C'], label: 'Hold to compare with the original' },
          { keys: [','], label: 'Previous animation frame' },
          { keys: ['.'], label: 'Next animation frame' },
          { keys: ['Mod', 'Z'], label: 'Undo' },
          { keys: ['Mod', 'Shift', 'Z'], label: 'Redo' },
        ],
      },
      {
        title: 'Texture list',
        items: [
          { keys: ['↑', '↓', '←', '→'], label: 'Move between textures' },
          { keys: ['Enter'], label: 'Open and start painting' },
          { keys: ['Shift', 'F10'], label: 'More actions' },
          { keys: ['Esc'], label: 'Clear the search' },
        ],
      },
      {
        title: 'Painting',
        items: PIXEL_SHORTCUTS.filter((s) => !/Undo|Redo/.test(s.action)).map((s) => ({ keys: split(s.keys), label: s.action })),
      },
    ]);
  }

  const onKey = (e: KeyboardEvent) => {
    if (document.querySelector('dialog[open]')) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      void store.flush().then(() => {
        if (store.saveState === 'saved') toast('Saved', { tone: 'success', duration: 1400 });
      });
      return;
    }
    if (isTypingTarget(e.target) || mod || e.altKey) return;
    if (e.key === '?') {
      e.preventDefault();
      showShortcuts();
    } else if (e.key === '/') {
      e.preventDefault();
      if (isPhone()) showMobile('textures');
      else if (isTablet()) setSide('textures');
      requestAnimationFrame(() => browser.focusSearch());
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

  if (import.meta.env.DEV) {
    (window as unknown as { __tx?: unknown }).__tx = {
      store,
      canvas,
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
    alive = false;
    void store.flush();
    cleanups.forEach((f) => f());
    browser.destroy();
    canvas.destroy();
    preview.destroy();
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
        h('div', { class: 'tx-assets-head' }, h('span', { class: 'eyebrow' }, icon('image'), plainText(p.name)), h('p', { class: 'muted' }, `${versionText(p)} · ${p.resolution}×`)),
        panel,
      );
      host.replaceChildren(wrap);
    };
    let timer: ReturnType<typeof setTimeout> | null = cached ? setTimeout(showPanel, 600) : null;
    if (!cached) showPanel();
    else placeholder.querySelector('span')!.textContent = 'Loading textures…';

    let resolveDone!: (a: AssetIndex | null) => void;
    const done = new Promise<AssetIndex | null>((r) => (resolveDone = r));
    let attemptId = 0;
    async function attempt(jarFile?: File) {
      const my = ++attemptId;
      if (jarFile) showPanel();
      panel?.set({ label: jarFile ? `Reading ${jarFile.name}…` : 'Starting…', fraction: null });
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
