// "Textures" control of the preview stage: which block textures the live preview draws. Loads the
// real game textures by default (without blocking: the built-in art shows until they arrive), and
// offers the built-in art, the user's Texture Pack Maker projects and importing a pack (menu or drag
// and drop). Only the preview changes; exports never depend on it.

import type { AssetIndex, Edition, TexturePackProject } from '../../../core/types';
import { friendlyError, isAbortError } from '../../../core/net';
import { getProject, listProjects } from '../../../core/storage';
import { isAssetsCached, loadAssets } from '../../../editions/index';
import { emptyAssetIndex } from '../../../shared/overlay-assets';
import type { PreviewTexturesReport } from '../../../shared/preview/shader-preview';
import { hideTooltip, openPopover, spinner, tooltip, type PopoverHandle } from '../../../ui/components';
import { h } from '../../../ui/dom';
import { fileMatchesAccept } from '../../../ui/format';
import { icon, type IconName } from '../../../ui/icons';
import { toast } from '../../../ui/toast';
import { newPackKey, type PreviewTexturesPref } from './project';
import {
  PACK_ACCEPT,
  editionLabel,
  isTexturePackProject,
  loadStoredPack,
  overlayFromProject,
  overlayFromStored,
  readPreviewPack,
  saveStoredPack,
  sourceLabel,
  vanillaLabel,
  type StoredPreviewPack,
} from './texture-sources';
import { et } from './i18n/editor';
import { fmt, num } from '../../../i18n/editor-text';
import { kit } from '../../../ui/i18n/kit';

export interface TexturePickerOptions {
  edition: Edition;
  /** Game version of the vanilla textures */
  version: string;
  pref: PreviewTexturesPref;
  /** Persist the choice on the shader project */
  onPrefChange(pref: PreviewTexturesPref): void;
  /** Shows textures in the preview (null = built-in art). Resolves with what was shown, or null without a preview. */
  apply(assets: AssetIndex | null): Promise<PreviewTexturesReport | null>;
  /** Element that accepts dropped packs (the preview) */
  dropTarget: HTMLElement;
}

export interface TexturePicker {
  /** Stage button (plus a retry button when the game textures failed) */
  el: HTMLElement;
  /** Shown over the preview while a file is dragged over it */
  dropHint: HTMLElement;
  /** Loads the chosen textures (call once) */
  start(): void;
  /** Another game version (Java vanilla shaders follow the project's version) */
  setBase(edition: Edition, version: string): void;
  openMenu(): void;
  destroy(): void;
}

interface BaseState {
  edition: Edition;
  version: string;
  status: 'idle' | 'loading' | 'ready' | 'error' | 'deferred';
  assets: AssetIndex | null;
  promise: Promise<AssetIndex> | null;
  ctrl: AbortController | null;
  fraction: number | null;
  error: string;
}

function newBase(edition: Edition, version: string): BaseState {
  return { edition, version, status: 'idle', assets: null, promise: null, ctrl: null, fraction: null, error: '' };
}

/** Data saver on (phones): don't start big downloads without asking. */
function saveData(): boolean {
  try {
    return Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
  } catch {
    return false;
  }
}

const T = () => et.textures;

export function createTexturePicker(opts: TexturePickerOptions): TexturePicker {
  let pref: PreviewTexturesPref = { ...opts.pref };
  let base = newBase(opts.edition, opts.version);
  let started = false;
  let destroyed = false;
  let token = 0;
  let applying = false;
  let importing = false;
  /** Shown vanilla-less (offline): the pack over the built-in art */
  let partial = false;
  let projectStamp = 0;
  let menu: PopoverHandle | null = null;
  /** Icon object URLs while the menu is open (kept across re-renders so images don't reload) */
  const menuUrls = new Map<Blob, string>();
  let projects: TexturePackProject[] | null = null;
  let loadedPack: { key: string; pack: StoredPreviewPack } | null = null;
  /** Recently shown packs (the preview keeps their decoded textures per index), so switching back is instant */
  const recent = new Map<string, AssetIndex>();
  const remember = (key: string, make: () => AssetIndex): AssetIndex => {
    const hit = recent.get(key) ?? make();
    recent.delete(key);
    recent.set(key, hit);
    while (recent.size > 3) recent.delete(recent.keys().next().value!);
    return hit;
  };

  // ------------------------------------------------------------------ view
  const labelEl = h('span', { class: 'sh-tex-label' });
  const statusEl = h('span', { class: 'sh-tex-status' });
  const btn = h(
    'button',
    { type: 'button', class: 'sh-stage-chip sh-tex-btn', 'aria-haspopup': 'menu', 'aria-expanded': 'false' },
    icon('image'),
    h('span', { class: 'sh-tex-prefix', 'aria-hidden': 'true' }, T().prefix),
    labelEl,
    statusEl,
    icon('chevron-up', { class: 'sh-tex-caret' }),
  );
  btn.addEventListener('click', () => toggleMenu());
  const retryBtn = h('button', { type: 'button', class: 'sh-stage-chip sh-tex-retry', hidden: true }, icon('reload'), h('span', null, T().retry));
  retryBtn.addEventListener('click', () => retry());
  const el = h('div', { class: 'sh-tex' }, btn, retryBtn);

  const fileInput = h('input', { type: 'file', accept: PACK_ACCEPT, hidden: true, tabIndex: -1, class: 'sh-tex-input', 'aria-hidden': 'true' });
  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    fileInput.value = '';
    if (f) void importFile(f);
  });
  el.append(fileInput);

  const packHint = () => (opts.edition === 'java' ? T().javaPack : T().bedrockPack);
  const dropHint = h(
    'div',
    { class: 'sh-drop', hidden: true, 'aria-hidden': 'true' },
    h('div', { class: 'sh-drop-box' }, icon('upload', { size: 48 }), h('strong', null, T().dropTitle), h('span', null, fmt(T().dropHint, { kind: packHint() }))),
  );

  const label = () => sourceLabel(pref, base.edition, base.version);
  const baseFailed = () => pref.kind !== 'simple' && (base.status === 'error' || base.status === 'deferred');

  /** Download progress of the game textures ("45%"), while they load for the chosen textures */
  function percent(): string | null {
    if (importing || !applying || base.status !== 'loading' || pref.kind === 'simple') return null;
    return base.fraction !== null && base.fraction > 0 ? num(Math.round(base.fraction * 100) / 100, { style: 'percent' }) : null;
  }

  function statusText(): string {
    if (importing) return T().opening;
    const pct = percent();
    if (pct) return fmt(T().downloading, { percent: pct });
    if (applying) return T().loading;
    return '';
  }

  /** Why the game textures aren't there, in one short sentence ("You're offline.", "Couldn't reach x.com."). */
  function reason(): string {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return T().offline;
    const first = /^.*?(?:[.!?](\s|$)|。)/.exec(base.error)?.[0].trim() ?? base.error.trim();
    return first || T().downloadFailed;
  }

  function problem(): string {
    if (!baseFailed()) return '';
    const what = vanillaLabel(base.edition, base.version);
    if (base.status === 'deferred') return fmt(T().deferred, { what });
    return fmt(partial ? T().failedPartial : T().failed, { what, reason: reason() });
  }

  function paint(): void {
    if (destroyed) return;
    const text = label();
    labelEl.textContent = text;
    const busy = applying || importing;
    const warn = !busy && baseFailed();
    btn.dataset.source = pref.kind;
    btn.dataset.state = busy ? 'loading' : warn ? 'warn' : 'ready';
    statusEl.replaceChildren();
    const st = statusText();
    if (busy) {
      statusEl.append(spinner(16));
      const pct = percent();
      if (pct) statusEl.append(h('span', { class: 'sh-tex-pct' }, pct));
    } else if (warn) {
      statusEl.append(icon('warning-diamond', { class: 'sh-tex-warn' }));
    }
    const state = busy ? st.replace(/…$/, '') : warn ? (base.status === 'deferred' ? T().notDownloaded : T().notLoaded) : '';
    btn.setAttribute('aria-label', state ? fmt(T().labelState, { source: text, state }) : fmt(T().label, { source: text }));
    // no tooltip over the open menu (focus comes back to the button with focus-visible)
    tooltip(
      btn,
      menu?.open
        ? ''
        : warn
          ? fmt(T().problemTip, { problem: problem() })
          : fmt(T().tip, { source: text }),
    );
    retryBtn.hidden = !warn;
    const retryLabel = fmt(base.status === 'deferred' ? T().download : T().tryAgainFor, { what: vanillaLabel(base.edition, base.version) });
    retryBtn.setAttribute('aria-label', retryLabel);
    retryBtn.querySelector('span:not(.icon)')!.textContent = base.status === 'deferred' ? T().load : T().retry;
    tooltip(retryBtn, retryLabel);
    if (menu?.open) renderMenu();
  }

  // ------------------------------------------------------------------ loading
  function ensureBase(): Promise<AssetIndex> {
    const b = base;
    if (b.assets) return Promise.resolve(b.assets);
    if (b.promise) return b.promise;
    const ctrl = new AbortController();
    b.status = 'loading';
    b.fraction = null;
    b.error = '';
    b.ctrl = ctrl;
    b.promise = loadAssets(b.edition, b.version, {
      signal: ctrl.signal,
      onProgress: (p) => {
        if (b !== base || ctrl.signal.aborted) return;
        b.fraction = p.fraction;
        paint();
      },
    })
      .then((a) => {
        b.assets = a;
        b.status = 'ready';
        return a;
      })
      .catch((err: unknown) => {
        b.status = 'error';
        b.error = isAbortError(err) ? '' : friendlyError(err);
        b.promise = null;
        throw err;
      })
      .finally(() => {
        b.ctrl = null;
      });
    paint();
    return b.promise;
  }

  function setPref(next: PreviewTexturesPref): void {
    pref = next;
    opts.onPrefChange({ ...pref });
    paint();
  }

  /** The chosen project / imported pack is gone: back to the game textures. */
  function lost(message: string, t: number): void {
    if (t !== token) return;
    toast(fmt(T().lost, { message }), { tone: 'warn', duration: 7000 });
    const { imported } = pref;
    setPref({ kind: 'vanilla', ...(pref.kind === 'imported' || !imported ? {} : { imported }) });
    void applyChoice(false);
  }

  async function applyChoice(user: boolean): Promise<void> {
    const t = ++token;
    const want = pref;
    applying = true;
    partial = false;
    paint();
    try {
      if (want.kind === 'simple') {
        const report = await opts.apply(null);
        if (report && t === token) {
          btn.dataset.slots = `0/${report.total}`;
          btn.dataset.packSlots = '0';
        }
        return;
      }
      // With data saver on, only use game textures already on this device (until the user asks).
      if (user && base.status === 'deferred') base.status = 'idle';
      if (base.status === 'idle' && !user && saveData() && !(await isAssetsCached(base.edition, base.version))) {
        if (t !== token) return;
        base.status = 'deferred';
      }
      const basePromise: Promise<AssetIndex | null> = base.status === 'deferred' ? Promise.resolve(null) : ensureBase().catch(() => null);
      let layer: ((b: AssetIndex) => AssetIndex) | null = null;
      let layerKey = '';
      let packName = '';
      if (want.kind === 'project') {
        const p = await getProject(want.projectId ?? '').catch(() => undefined);
        if (t !== token) return;
        if (!isTexturePackProject(p)) return lost(fmt(T().deleted, { name: want.name || T().yourPack }), t);
        projectStamp = p.updatedAt || 0;
        packName = p.name;
        if (p.name !== want.name) setPref({ ...pref, name: p.name });
        layer = (b) => overlayFromProject(b, p);
        layerKey = `project:${p.id}:${projectStamp}`;
        if (user && !Object.keys(p.overrides).length && !p.effects?.some((l) => l.enabled)) {
          toast(fmt(T().noEdits, { name: p.name }), { tone: 'info' });
        }
      } else if (want.kind === 'imported' && want.imported) {
        const imp = want.imported;
        // an import never changes under its key: keep the last one loaded
        let stored = loadedPack?.key === imp.key ? loadedPack.pack : null;
        if (!stored) {
          stored = await loadStoredPack(imp.key).catch(() => null);
          if (t !== token) return;
          if (!stored) return lost(fmt(T().importGone, { name: imp.name }), t);
          loadedPack = { key: imp.key, pack: stored };
        }
        const pack = stored;
        packName = pack.name;
        layer = (b) => overlayFromStored(b, pack);
        layerKey = `imported:${imp.key}`;
      }
      const vanilla = await basePromise;
      if (t !== token) return;
      const under = vanilla ?? emptyAssetIndex(base.edition, base.version);
      const make = layer;
      const assets = make ? remember(`${layerKey}|${base.edition}:${base.version}:${vanilla ? 'game' : 'none'}`, () => make(under)) : vanilla;
      partial = !!layer && !vanilla;
      const report = await opts.apply(assets);
      if (t !== token) return;
      if (report) {
        // what the preview shows, for tests and debugging
        btn.dataset.slots = `${report.fromAssets}/${report.total}`;
        btn.dataset.packSlots = String(report.fromPack);
      }
      if (user && layer && report?.applied && report.total && !report.fromPack) {
        toast(fmt(T().noBlocks, { name: packName }), { tone: 'info', duration: 6000 });
      }
      if (user && !vanilla && base.status === 'error') {
        toast(problem(), { tone: 'warn', duration: 8000, action: { label: T().retry, onClick: () => retry() } });
      }
    } finally {
      if (t === token) {
        applying = false;
        paint();
      }
    }
  }

  function retry(): void {
    if (base.status === 'loading') return;
    if (base.status === 'error' || base.status === 'deferred') base.status = 'idle';
    void applyChoice(true);
  }

  function choose(next: PreviewTexturesPref): void {
    menu?.close();
    const same = next.kind === pref.kind && next.projectId === pref.projectId && (next.kind !== 'imported' || next.imported?.key === pref.imported?.key);
    if (same && !baseFailed()) return;
    setPref(next);
    void applyChoice(true);
  }

  // ------------------------------------------------------------------ importing
  async function importFile(file: File): Promise<void> {
    if (importing || destroyed) return;
    if (!fileMatchesAccept(file, PACK_ACCEPT)) {
      toast(fmt(T().notTexturePack, { name: file.name, ext: opts.edition === 'java' ? '.zip' : '.mcpack or .zip' }), { tone: 'error' });
      return;
    }
    importing = true;
    paint();
    try {
      const pack = await readPreviewPack(file);
      if (destroyed) return;
      const imported = await saveStoredPack(newPackKey(), pack);
      if (destroyed) return;
      importing = false;
      setPref({ kind: 'imported', name: pack.name, imported });
      const notes: string[] = [];
      if (pack.edition !== base.edition) {
        notes.push(fmt(T().otherEdition, { pack: editionLabel(pack.edition), edition: editionLabel(base.edition) }));
      } else if (pack.legacyNames) {
        notes.push(fmt(T().legacy, { what: vanillaLabel(base.edition, base.version) }));
      }
      toast(fmt(T().previewing, { name: pack.name }), { tone: 'success', duration: 3000 });
      for (const n of notes) toast(n, { tone: 'warn', duration: 9000 });
      await applyChoice(true);
    } catch (err) {
      if (!destroyed) toast(friendlyError(err, T().openFailed), { tone: 'error', duration: 9000 });
    } finally {
      importing = false;
      paint();
    }
  }

  function pickFile(): void {
    menu?.close();
    fileInput.click();
  }

  // drag and drop onto the preview
  let depth = 0;
  const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files');
  const onDragEnter = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth++;
    dropHint.hidden = false;
  };
  const onDragOver = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  };
  const onDragLeave = () => {
    depth = Math.max(0, depth - 1);
    if (!depth) dropHint.hidden = true;
  };
  const onDrop = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth = 0;
    dropHint.hidden = true;
    const f = e.dataTransfer?.files?.[0];
    if (f) void importFile(f);
  };
  const target = opts.dropTarget;
  target.addEventListener('dragenter', onDragEnter);
  target.addEventListener('dragover', onDragOver);
  target.addEventListener('dragleave', onDragLeave);
  target.addEventListener('drop', onDrop);

  // ------------------------------------------------------------------ menu
  function item(o: {
    key: string;
    title: string;
    sub?: string;
    icon?: IconName;
    art?: Node;
    checked?: boolean;
    radio?: boolean;
    tone?: 'warn' | 'danger';
    onClick: () => void;
  }): HTMLButtonElement {
    const b = h(
      'button',
      {
        type: 'button',
        class: ['sh-tex-item', o.tone && `is-${o.tone}`],
        role: o.radio ? 'menuitemradio' : 'menuitem',
        tabIndex: -1,
        dataset: { key: o.key },
        ...(o.radio ? { 'aria-checked': String(!!o.checked) } : {}),
      },
      h('span', { class: 'sh-tex-art' }, o.art ?? icon(o.icon ?? 'image')),
      h('span', { class: 'sh-tex-text' }, h('span', { class: 'sh-tex-title' }, o.title), o.sub ? h('span', { class: 'sh-tex-sub' }, o.sub) : null),
      o.radio ? h('span', { class: 'sh-tex-check' }, o.checked ? icon('check') : null) : null,
    );
    b.addEventListener('click', o.onClick);
    return b;
  }

  function projectArt(p: TexturePackProject): Node {
    if (p.icon instanceof Blob && p.icon.size) {
      let url = menuUrls.get(p.icon);
      if (!url) {
        url = URL.createObjectURL(p.icon);
        menuUrls.set(p.icon, url);
      }
      return h('img', { src: url, alt: '', class: 'pixelated', width: 32, height: 32, decoding: 'async' });
    }
    return icon('package');
  }

  function vanillaSub(): string {
    const what = base.edition === 'java' ? fmt(kit.edition.javaVersion, { version: base.version }) : kit.edition.bedrock;
    if (pref.kind !== 'simple' && base.status === 'loading') {
      return base.fraction ? fmt(T().menuDownloading, { what, percent: num(Math.round(base.fraction * 100) / 100, { style: 'percent' }) }) : fmt(T().menuLoading, { what });
    }
    if (base.status === 'error') return fmt(T().menuNotLoaded, { reason: reason() });
    if (base.status === 'deferred') return T().menuDeferred;
    return base.edition === 'java' ? fmt(T().realJava, { version: base.version }) : T().realBedrock;
  }

  function renderMenu(): void {
    if (!menu) return;
    const focusedKey = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('.sh-tex-item')?.dataset.key;
    const list = menu.el.querySelector('.sh-tex-menu-list')!;
    const rows: Node[] = [];
    rows.push(
      item({
        key: 'vanilla',
        radio: true,
        checked: pref.kind === 'vanilla',
        icon: 'cube',
        title: T().vanilla,
        sub: vanillaSub(),
        tone: base.status === 'error' ? 'warn' : undefined,
        onClick: () => choose({ kind: 'vanilla', ...(pref.imported ? { imported: pref.imported } : {}) }),
      }),
    );
    if (baseFailed()) {
      rows.push(
        item({
          key: 'retry',
          icon: 'reload',
          title: base.status === 'deferred' ? T().downloadGame : T().tryAgain,
          sub: T().needsInternet,
          onClick: () => {
            menu?.close();
            retry();
          },
        }),
      );
    }
    rows.push(
      item({
        key: 'simple',
        radio: true,
        checked: pref.kind === 'simple',
        icon: 'grid-2x2-2',
        title: T().simple,
        sub: T().simpleSub,
        onClick: () => choose({ kind: 'simple', ...(pref.imported ? { imported: pref.imported } : {}) }),
      }),
    );
    rows.push(h('div', { class: 'sh-tex-heading', role: 'presentation' }, fmt(T().myPacks, { edition: editionLabel(opts.edition) })));
    const packs = h('div', { class: 'sh-tex-packs', role: 'group', 'aria-label': T().myPacksLabel });
    if (projects === null) {
      packs.append(h('div', { class: 'sh-tex-empty', role: 'presentation' }, spinner(16), h('span', null, T().loadingPacks)));
    } else {
      for (const p of projects) {
        const edited = Object.keys(p.overrides ?? {}).length;
        const fx = (p.effects ?? []).filter((l) => l.enabled).length;
        const bits = [
          p.edition === 'java' ? fmt(kit.edition.javaVersion, { version: p.version }) : kit.edition.bedrock,
          edited ? fmt(T().texturesCount, { count: edited, n: String(edited) }) : '',
          fx ? fmt(T().effectsCount, { count: fx, n: String(fx) }) : '',
        ].filter(Boolean);
        packs.append(
          item({
            key: `project:${p.id}`,
            radio: true,
            checked: pref.kind === 'project' && pref.projectId === p.id,
            art: projectArt(p),
            title: p.name || T().untitled,
            sub: bits.join(' · '),
            onClick: () => choose({ kind: 'project', projectId: p.id, name: p.name, ...(pref.imported ? { imported: pref.imported } : {}) }),
          }),
        );
      }
      const imp = pref.imported;
      if (imp) {
        const other = imp.edition !== opts.edition ? fmt(T().otherEditionPack, { edition: editionLabel(imp.edition) }) : '';
        packs.append(
          item({
            key: 'imported',
            radio: true,
            checked: pref.kind === 'imported',
            icon: 'archive',
            title: imp.name,
            sub: fmt(T().importedSub, { other }),
            onClick: () => choose({ kind: 'imported', name: imp.name, imported: imp }),
          }),
        );
      }
      if (!projects.length && !imp) {
        packs.append(h('p', { class: 'sh-tex-empty', role: 'presentation' }, T().emptyPacks));
      }
    }
    rows.push(packs);
    rows.push(
      item({
        key: 'import',
        icon: 'upload',
        title: T().import,
        sub: fmt(T().importSub, { ext: opts.edition === 'java' ? '.zip' : '.mcpack' }),
        onClick: () => pickFile(),
      }),
    );
    if (pref.imported) {
      const imp = pref.imported;
      rows.push(
        item({
          key: 'remove',
          icon: 'trash',
          tone: 'danger',
          title: T().remove,
          sub: imp.name,
          onClick: () => {
            const wasShown = pref.kind === 'imported';
            const next: PreviewTexturesPref = wasShown ? { kind: 'vanilla' } : { ...pref };
            delete next.imported;
            menu?.close();
            setPref(next);
            if (wasShown) void applyChoice(true);
            toast(fmt(T().removed, { name: imp.name }));
          },
        }),
      );
    }
    list.replaceChildren(...rows);
    const again = focusedKey ? list.querySelector<HTMLElement>(`.sh-tex-item[data-key="${CSS.escape(focusedKey)}"]`) : null;
    again?.focus({ preventScroll: true });
  }

  function onMenuKey(e: KeyboardEvent): void {
    const items = [...(menu?.el.querySelectorAll<HTMLButtonElement>('.sh-tex-item:not(:disabled)') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    let next = -1;
    if (e.key === 'ArrowDown') next = (i + 1) % items.length;
    else if (e.key === 'ArrowUp') next = (i - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    else if (e.key === 'Tab') {
      menu?.close();
      return;
    }
    if (next >= 0) {
      e.preventDefault();
      items[next]?.focus();
      items[next]?.scrollIntoView({ block: 'nearest' });
    }
  }

  function openMenu(): void {
    if (menu?.open) return;
    projects = null;
    const content = h(
      'div',
      { class: 'sh-tex-menu', role: 'menu', 'aria-label': T().menu },
      h('div', { class: 'sh-tex-menu-head', role: 'presentation' }, icon('image'), h('span', null, T().menu)),
      h('div', { class: 'sh-tex-menu-list' }),
      h('p', { class: 'sh-tex-note', role: 'presentation' }, icon('info'), h('span', null, T().note)),
    );
    content.addEventListener('keydown', onMenuKey);
    hideTooltip();
    menu = openPopover(btn, content, {
      placement: 'top-start',
      offset: 8,
      class: 'sh-tex-pop',
      role: 'presentation',
      onClose: () => {
        btn.setAttribute('aria-expanded', 'false');
        for (const u of menuUrls.values()) URL.revokeObjectURL(u);
        menuUrls.clear();
        menu = null;
        paint();
      },
    });
    btn.setAttribute('aria-expanded', 'true');
    tooltip(btn, '');
    renderMenu();
    requestAnimationFrame(() => {
      const checked = menu?.el.querySelector<HTMLElement>('.sh-tex-item[aria-checked="true"]') ?? menu?.el.querySelector<HTMLElement>('.sh-tex-item');
      checked?.focus({ preventScroll: true });
    });
    void listProjects('texturepack')
      .then((all) => all.filter((p): p is TexturePackProject => isTexturePackProject(p) && p.edition === opts.edition))
      .catch(() => [] as TexturePackProject[])
      .then((list) => {
        if (!menu?.open) return;
        projects = list;
        renderMenu();
        menu.reposition();
      });
  }

  function toggleMenu(): void {
    if (menu?.open) menu.close();
    else openMenu();
  }

  // ------------------------------------------------------------------ keeping up to date
  let lastCheck = 0;
  const refreshProject = () => {
    if (destroyed || document.hidden || pref.kind !== 'project' || applying) return;
    const now = Date.now();
    if (now - lastCheck < 1500) return;
    lastCheck = now;
    const t = token;
    void getProject(pref.projectId ?? '')
      .then((p) => {
        if (t !== token || pref.kind !== 'project') return;
        // edited in the Texture Pack Maker (another tab) since it was loaded
        if (!isTexturePackProject(p) || (p.updatedAt || 0) !== projectStamp) void applyChoice(false);
      })
      .catch(() => undefined);
  };
  const onOnline = () => {
    if (base.status === 'error' && pref.kind !== 'simple') retry();
  };
  window.addEventListener('focus', refreshProject);
  document.addEventListener('visibilitychange', refreshProject);
  window.addEventListener('online', onOnline);

  paint();

  return {
    el,
    dropHint,
    start() {
      if (started || destroyed) return;
      started = true;
      void applyChoice(false);
    },
    setBase(edition, version) {
      if (edition === base.edition && version === base.version) return;
      base.ctrl?.abort();
      base = newBase(edition, version);
      paint();
      if (started && pref.kind !== 'simple') void applyChoice(false);
    },
    openMenu,
    destroy() {
      destroyed = true;
      token++;
      base.ctrl?.abort();
      menu?.close();
      recent.clear();
      loadedPack = null;
      target.removeEventListener('dragenter', onDragEnter);
      target.removeEventListener('dragover', onDragOver);
      target.removeEventListener('dragleave', onDragLeave);
      target.removeEventListener('drop', onDrop);
      window.removeEventListener('focus', refreshProject);
      document.removeEventListener('visibilitychange', refreshProject);
      window.removeEventListener('online', onOnline);
    },
  };
}
