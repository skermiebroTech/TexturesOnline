// Right panel "Preview" tab. For textures that belong to a block, item or mob it is the model workspace:
// the real in-game model in 3D (hover a face to see which texture it is, click it to paint it), a
// state picker (lit, facing, half, age...) and the list of textures the model uses, labelled by role.
// Other textures show on a rotating cube or as a flat sprite. A tiled 3x3 view and the pack's effects
// complete it. In the 3D workspace the 3D view moves to the main editor area to be painted on, and the
// pixel editor takes its place here.

import type { BlockPreview, ModelCameraView, ModelHit, ModelPaintHandler, ModelScene, PaintCursor } from '../../../shared/preview/block-preview';
import type { BlockState, ModelEntry, ModelTexture, ModelView, StateProperty } from '../../../shared/models/index';
import { paletteSwatches } from '../../../shared/models/trims';
import { cloneImageData } from '../../../core/image';
import { h } from '../../../ui/dom';
import { icon } from '../../../ui/icons';
import { badge, emptyState, iconButton, openPopover, segmented, select, spinner, toggle, tooltip, type PopoverHandle } from '../../../ui/components';
import { DEFAULT_FOLIAGE_TINT, DEFAULT_GRASS_TINT, compositeOverlay, tintByAlphaMask, tintImage } from '../../../shared/preview/preview-textures';
import { applyEffects, effectsApply } from '../effects';
import { displayAlphaData, firstSquare, getFrame, planCube, tile3, tintFor, transparentShare, type AnimInfo } from './meta';
import { ICON_KEY, type TexStore } from './store';
import type { OpenTexture } from './canvas-panel';
import type { LiveTexture, ModelService } from './models';
import { paintCanvas } from './thumbs';

export interface PreviewPanel {
  el: HTMLElement;
  setTexture(t: OpenTexture | null): void;
  /** Panel became visible / hidden */
  setVisible(v: boolean): void;
  /** Shows a block or item in the model workspace (null: back to the open texture's own preview) */
  showEntry(entry: ModelEntry | null, state?: BlockState): void;
  /** The block / item on show */
  current(): { entry: ModelEntry; state: BlockState } | null;
  /** Screen point of the most visible face drawn with a texture (tests) */
  facePoint(path: string): { x: number; y: number } | null;
  /**
   * 3D workspace: moves the 3D view into `target` (null: back here) and shows `canvasBox` (the pixel
   * editor) where the 3D view was.
   */
  dock(target: HTMLElement | null, canvasBox: HTMLElement | null): void;
  /** Paint on the model while docked (null: clicking a face opens its texture) */
  setPaintHandler(h: ModelPaintHandler | null): void;
  setPaintCursor(c: PaintCursor | null): void;
  /** What the pointer is over while painting (null: the idle hint) */
  setPaintHint(hint: PaintHint | null): void;
  /** Holds animations still (painting); `path` shows `frame`, null path with frame < 0 plays them again */
  pinFrame(path: string | null, frame: number): void;
  refreshPaintHover(): void;
  /** Role label of a texture of the model on show ('Front', 'Side'...) */
  textureLabel(path: string): string | null;
  /** Body part of a mob quad ('Head', 'Left front leg'...), null for blocks */
  partLabel(part: number | undefined): string | null;
  /** The 3D view (tests) */
  view3d(): BlockPreview | null;
  destroy(): void;
}

export interface PaintHint {
  label: string;
  name: string;
  /** Texel under the pointer */
  x: number;
  y: number;
  /** Colour of that texel (straight RGBA) */
  color?: [number, number, number, number];
  /** Why it can't be painted */
  locked?: string;
}

export interface PreviewHooks {
  /** Open a texture in the pixel editor (clicked on the model or in the list) */
  openTexture(path: string, how: 'face' | 'list'): void;
  /** The block / item on show changed (null = none) */
  onEntry?(entry: ModelEntry | null): void;
  /** Open the model editor for a block / item (shows the "Edit shape" button) */
  onEditModel?(entry: ModelEntry, state: BlockState): void;
}

type Mode = 'auto' | 'cube' | 'flat';

export function createPreviewPanel(store: TexStore, models: ModelService, hooks: PreviewHooks): PreviewPanel {
  const project = store.project;
  let preview: BlockPreview | null = null;
  let creating: Promise<BlockPreview | null> | null = null;
  let visible = false;
  let tex: OpenTexture | null = null;
  let mode: Mode = 'auto';
  let showFx = true;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let spinTexture = !reduced;
  let spinModel = false;
  let itemFlat = false;
  let token = 0;
  let destroyed = false;
  // model workspace
  let entry: ModelEntry | null = null;
  let state: BlockState = {};
  let view: ModelView | null = null;
  let pinned = false;
  /** The user picked the state of this block: opening textures doesn't change it any more */
  let userState = false;
  let shownKey = '';
  let hoverPath: string | null = null;
  // 3D workspace
  let docked = false;
  let paintHandler: ModelPaintHandler | null = null;
  let pin: { path: string | null; frame: number } | null = null;
  /** Entry, state and options of the scene on show (setTexture skips rebuilding the same scene) */
  let sceneKey = '';
  /** Mob body parts hidden in 3D, per mob (to reach the sides they cover) */
  const hiddenParts = new Map<string, Set<string>>();
  let partsPop: PopoverHandle | null = null;
  /** Texture whose mob is being looked up (Bedrock reads entity files to know) */
  let entityLookup = '';

  // ---------------------------------------------------------------- DOM
  const stage = h('div', { class: 'tx-pv-stage' });
  const stageLabel = h('span', { class: 'tx-pv-label' });
  const hoverTag = h('span', { class: 'tx-pv-hover', hidden: true });
  const modeSeg = segmented<Mode>({
    value: mode,
    size: 'sm',
    label: 'Preview shape',
    options: [
      { value: 'auto', label: 'Auto' },
      { value: 'cube', label: 'Block' },
      { value: 'flat', label: 'Flat' },
    ],
    onChange: (v) => {
      mode = v;
      void render();
    },
  });
  const itemSeg = segmented<'3d' | 'flat'>({
    value: '3d',
    size: 'sm',
    label: 'Item preview',
    options: [
      { value: '3d', label: '3D' },
      { value: 'flat', label: 'Flat' },
    ],
    onChange: (v) => {
      itemFlat = v === 'flat';
      void render();
    },
  });
  const rotateBtn = iconButton('reload', 'Spin automatically', () => {
    if (entry) spinModel = !spinModel;
    else spinTexture = !spinTexture;
    syncSpin();
  }, { size: 'sm', active: spinTexture });
  const resetBtn = iconButton('aspect-ratio', 'Reset the view', () => preview?.resetView(), { size: 'sm' });
  const syncSpin = () => {
    const on = !docked && (entry ? spinModel : spinTexture);
    rotateBtn.setActive(on);
    preview?.setAutoRotate(on);
  };
  const pinMap = (): Map<string, number> | null => (pin ? new Map(pin.path ? [[pin.path, pin.frame]] : []) : null);
  const fxToggle = toggle({
    label: 'Show effects',
    value: showFx,
    description: 'See the pack’s effects on top of your pixels.',
    onChange: (v) => {
      showFx = v;
      models.resetBiome();
      void render();
    },
  });
  const tileCanvas = h('canvas', { class: 'tx-pv-tiled pixelated', 'aria-label': 'Texture tiled 3 by 3', role: 'img' });
  const tiledBox = h('div', { class: 'tx-pv-tiledbox checker' }, tileCanvas);
  const tiledSection = h(
    'section',
    { class: 'tx-pv-section' },
    h('h3', { class: 'section-title' }, icon('grid-2x2-2'), 'Tiled 3×3'),
    h('p', { class: 'faint small' }, 'How it looks when placed next to itself. Seams jump out here.'),
    tiledBox,
  );
  const empty = emptyState({ icon: 'cube', title: 'Nothing to preview', text: 'Pick a block or open a texture to see it in 3D.' });

  // model header
  const headIcon = h('canvas', { class: 'tx-pv-headicon', 'aria-hidden': 'true' });
  const headName = h('h2', { class: 'tx-pv-name truncate' });
  const headSub = h('span', { class: 'tx-pv-sub truncate' });
  const closeBtn = iconButton('close', 'Back to the texture on its own', () => {
    pinned = true;
    setEntry(null);
    void render();
  }, { size: 'sm' });
  const head = h(
    'header',
    { class: 'tx-pv-head', hidden: true },
    h('span', { class: 'tx-pv-headbox checker-soft' }, headIcon),
    h('span', { class: 'tx-pv-headtext' }, headName, headSub),
    closeBtn,
  );
  const note = h('p', { class: 'tx-inline-note tx-pv-note', hidden: true });
  const trimNote = h('div', { class: 'tx-inline-note tx-pv-note tx-pv-trimnote', hidden: true, role: 'note' });
  const statesEl = h('div', { class: 'tx-pv-states', role: 'group', 'aria-label': 'Block state', hidden: true });
  const texList = h('ul', { class: 'tx-pv-texlist', role: 'list', 'aria-label': 'Textures of this model' });
  const texHint = h('p', { class: 'faint small tx-pv-texhint' });
  const texCount = h('span', { class: 'tx-pv-texcount' });
  const texSection = h(
    'section',
    { class: 'tx-pv-section tx-pv-texsection', hidden: true },
    h('h3', { class: 'section-title' }, icon('layers'), 'Textures', texCount),
    texHint,
    texList,
  );
  const views = h('div', { class: 'tx-pv-views', role: 'group', 'aria-label': 'Camera views', hidden: true });
  for (const [v, key, label] of [
    ['front', 'F', 'Front view'],
    ['back', 'B', 'Back view'],
    ['left', 'L', 'Left side view'],
    ['right', 'R', 'Right side view'],
    ['top', 'T', 'Top view'],
  ] as [ModelCameraView, string, string][]) {
    const b = h('button', { type: 'button', class: 'tx-pv-view-btn', dataset: { view: v }, 'aria-label': label }, key);
    tooltip(b, label);
    b.addEventListener('click', () => preview?.setCameraView(v));
    views.appendChild(b);
  }
  const paintHintDot = h('span', { class: 'tx-pv-hint-dot', 'aria-hidden': 'true' });
  const paintHintText = h('span', { class: 'tx-pv-hint-text' });
  const paintHint = h('div', { class: 'tx-pv-hint is-idle', hidden: true }, paintHintDot, paintHintText);
  const noModel = h('div', { class: 'tx-pv-nomodel', hidden: true }, icon('info'), h('span', null, 'No 3D model to paint for this texture. Paint it in 2D, or pick a block that uses it.'));
  const hero = h('div', { class: 'tx-pv-hero checker-soft' }, stage, stageLabel, hoverTag, paintHint, noModel, views, h('div', { class: 'tx-pv-float' }, rotateBtn, resetBtn));
  const canvasSlot = h('div', { class: 'tx-pv-canvasslot', hidden: true });
  const partsList = h('div', { class: 'tx-pv-parts', role: 'group', 'aria-label': 'Body parts shown in 3D' });
  const partsAll = h('button', { type: 'button', class: 'btn btn-ghost btn-sm tx-pv-parts-all' }, icon('eye', { size: 16 }), h('span', { class: 'btn-label' }, 'Show all'));
  partsAll.addEventListener('click', () => showAllParts());
  const partsSection = h(
    'section',
    { class: 'tx-pv-section tx-pv-partsection', hidden: true },
    h('div', { class: 'tx-pv-parthead' }, h('h3', { class: 'section-title' }, icon('human'), 'Parts'), partsAll),
    h('p', { class: 'faint small' }, 'Hide a part to reach what it covers. Double-click to show only that part.'),
    partsList,
  );
  const partsBtn = h('button', { type: 'button', class: 'tx-pv-partsbtn', hidden: true, 'aria-haspopup': 'dialog', 'aria-expanded': 'false' }, icon('human', { size: 16 }), h('span', null, 'Parts'));
  tooltip(partsBtn, 'Show or hide body parts');
  partsBtn.addEventListener('click', () => togglePartsPopover());
  hero.appendChild(partsBtn);
  const controls = h('div', { class: 'tx-pv-controls' }, modeSeg, itemSeg);
  const editShapeBtn = h(
    'button',
    { type: 'button', class: 'btn btn-secondary btn-sm tx-pv-shapebtn', hidden: true },
    icon('shapes'),
    h('span', { class: 'btn-label' }, 'Edit shape'),
    h('span', { class: 'tx-pv-shapebadge', hidden: true }, 'Custom'),
  );
  tooltip(editShapeBtn, 'Change the cubes this model is made of');
  editShapeBtn.addEventListener('click', () => {
    if (entry && entry.kind !== 'entity') hooks.onEditModel?.(entry, { ...state });
  });
  const body = h('div', { class: 'tx-pv' }, head, hero, editShapeBtn, canvasSlot, note, trimNote, statesEl, partsSection, controls, texSection, fxToggle, tiledSection);
  const loadingModel = h('div', { class: 'tx-pv-busy', hidden: true }, spinner(16), h('span', null, 'Loading the model…'));
  hero.appendChild(loadingModel);
  const el = h('div', { class: 'tx-pv-wrap' }, body, empty);

  // ---------------------------------------------------------------- 3D view
  const ensure = async (): Promise<BlockPreview | null> => {
    if (preview) return preview;
    if (!creating) {
      creating = import('../../../shared/preview/block-preview')
        .then((m) => {
          // the panel may be gone by the time the 3D code arrives: don't open a WebGL context then
          if (destroyed) return null;
          preview = m.createBlockPreview(stage, { autoRotate: !docked && (entry ? spinModel : spinTexture) });
          preview.setModelHandlers({
            hover: (hit) => onHover(hit),
            pick: (hit) => onPick(hit),
          });
          if (docked && paintHandler) preview.setPaintMode(paintHandler);
          if (pin) preview.pinFrames(pinMap());
          return preview;
        })
        .catch((err) => {
          console.error(err);
          stage.replaceChildren(h('p', { class: 'faint small tx-pv-nogl' }, '3D preview is not available in this browser.'));
          return null;
        });
    }
    return creating;
  };

  const fxOn = () => showFx && store.effectsActive();

  const withFx = (img: ImageData, path: string, anim: boolean): ImageData => {
    if (!fxOn()) return img;
    const e = store.byPath.get(path);
    const ctx = { path, category: e?.category ?? 'block', animated: anim };
    if (!effectsApply(project.effects, ctx)) return img;
    try {
      return applyEffects(img, project.effects, ctx);
    } catch {
      return img;
    }
  };

  // ---------------------------------------------------------------- model workspace
  const live = (): LiveTexture | null => (tex && tex.key !== ICON_KEY ? { path: tex.key, full: tex.full, anim: tex.anim } : null);

  function setEntry(e: ModelEntry | null, s?: BlockState) {
    const changed = e?.id !== entry?.id || e?.kind !== entry?.kind;
    entry = e;
    const lib = models.lib;
    state = e && lib ? { ...lib.defaultState(e), ...(s ?? {}) } : {};
    if (changed) {
      shownKey = '';
      userState = false;
      hooks.onEntry?.(e);
      syncSpin();
    }
  }

  /** Best block or item to show for the open texture: keep the current one if it uses the texture. */
  function autoEntry(path: string): { entry: ModelEntry; state?: BlockState } | null {
    const lib = models.lib;
    if (!lib?.available) return null;
    if (entry) {
      const t = lib.textureStates(entry).find((x) => x.path === path);
      if (t) return { entry, state: userState ? state : statesShowing(entry, state, path) };
    }
    if (!lib.usageReady) return null;
    const u = lib.usageOf(path);
    // A mob's own texture shows on the mob (a creeper's on the creeper, not its head block).
    const mob = u.entities[0] && lib.entity(u.entities[0]);
    if (mob && lib.ready(mob)) return { entry: mob, state: statesShowing(mob, lib.defaultState(mob), path) };
    if (mob) {
      lookUpEntity(path);
      if (!u.blocks.length && !u.items.length) return null;
    }
    const pick = (u.blocks[0] && lib.block(u.blocks[0])) || (u.items[0] && lib.item(u.items[0])) || null;
    return pick ? { entry: pick, state: statesShowing(pick, lib.defaultState(pick), path) } : null;
  }

  /** Loads the mob of a texture, then shows it if that texture is still open. */
  function lookUpEntity(path: string) {
    if (entityLookup === path) return;
    entityLookup = path;
    void models.entityFor(path).then((e) => {
      if (entityLookup === path) entityLookup = '';
      if (!e || !tex || tex.key !== path || pinned || (entry?.kind === 'entity' && entry.id === e.id)) return;
      const lib = models.lib!;
      setEntry(e, statesShowing(e, lib.defaultState(e), path));
      void render();
    });
  }

  const partsKey = () => (entry ? `${entry.kind}:${entry.id}` : '');
  const hidden = (): Set<string> => {
    let s = hiddenParts.get(partsKey());
    if (!s) hiddenParts.set(partsKey(), (s = new Set()));
    return s;
  };

  function togglePart(name: string) {
    const s = hidden();
    if (s.has(name)) s.delete(name);
    else s.add(name);
    const all = view?.parts ?? [];
    // hiding every part shows them all again
    if (all.length && all.every((p) => s.has(p.name))) s.clear();
    afterParts();
  }

  function soloPart(name: string) {
    const s = hidden();
    s.clear();
    for (const p of view?.parts ?? []) if (p.name !== name) s.add(p.name);
    afterParts();
  }

  function showAllParts() {
    hidden().clear();
    afterParts();
  }

  function afterParts() {
    paintParts();
    void render({ keepView: true });
  }

  function partChips(): HTMLElement[] {
    const s = hidden();
    return (view?.parts ?? []).map((p) => {
      const on = !s.has(p.name);
      const b = h('button', { type: 'button', class: 'chip tx-pv-part', 'aria-pressed': String(on), dataset: { part: p.name } }, icon(on ? 'eye' : 'eye-off', { size: 16 }), h('span', null, p.label));
      b.addEventListener('click', (e) => {
        if (e.detail >= 2 || e.shiftKey) soloPart(p.name);
        else togglePart(p.name);
      });
      return b;
    });
  }

  function paintParts() {
    const parts = view?.parts ?? [];
    const show = !!entry && parts.length > 1;
    partsSection.hidden = !show;
    partsBtn.hidden = !show || !docked;
    if (!show) {
      partsPop?.close();
      return;
    }
    partsList.replaceChildren(...partChips());
    const n = hidden().size;
    partsAll.hidden = n === 0;
    partsBtn.classList.toggle('is-filtered', n > 0);
    partsBtn.querySelector('span:not(.icon)')!.textContent = n ? `Parts · ${parts.length - n} of ${parts.length}` : 'Parts';
    if (partsPop?.open) {
      const list = partsPop.el.querySelector('.tx-pv-parts');
      list?.replaceChildren(...partChips());
      partsPop.el.querySelector<HTMLElement>('.tx-pv-parts-all')!.hidden = n === 0;
    }
  }

  function togglePartsPopover() {
    if (partsPop?.open) {
      partsPop.close();
      return;
    }
    const all = h('button', { type: 'button', class: 'btn btn-ghost btn-sm tx-pv-parts-all', hidden: hidden().size === 0 }, icon('eye', { size: 16 }), h('span', { class: 'btn-label' }, 'Show all'));
    all.addEventListener('click', () => showAllParts());
    const content = h(
      'div',
      { class: 'tx-pv-partspop' },
      h('div', { class: 'tx-pv-parthead' }, h('strong', null, 'Body parts'), all),
      h('div', { class: 'tx-pv-parts', role: 'group', 'aria-label': 'Body parts shown in 3D' }, partChips()),
      h('p', { class: 'faint small' }, 'Double-click a part to show only it.'),
    );
    partsBtn.setAttribute('aria-expanded', 'true');
    partsPop = openPopover(partsBtn, content, { placement: 'bottom-start', label: 'Body parts', class: 'tx-pv-partspop-wrap', onClose: () => partsBtn.setAttribute('aria-expanded', 'false') });
  }

  /** The state closest to `cur` in which `path` is visible. */
  function statesShowing(e: ModelEntry, cur: BlockState, path: string): BlockState {
    const lib = models.lib!;
    const v = lib.resolve(e, cur);
    const t = v.textures.find((x) => x.path === path);
    return t && t.faces === 0 && t.state ? t.state : cur;
  }

  function paintHead() {
    if (!entry || !view) return;
    headName.textContent = entry.name;
    headSub.textContent = `${entry.kind === 'block' ? 'Block' : entry.kind === 'item' ? 'Item' : 'Mob'} · ${entry.id}`;
    head.title = entry.id;
    const cached = models.peekIcon(entry, fxOn());
    const draw = (img: HTMLCanvasElement | ImageData) => {
      if (img instanceof HTMLCanvasElement) {
        headIcon.width = img.width;
        headIcon.height = img.height;
        headIcon.getContext('2d')?.drawImage(img, 0, 0);
        headIcon.classList.add('smooth');
      } else {
        paintCanvas(headIcon, img);
        headIcon.classList.remove('smooth');
      }
    };
    if (cached) draw(cached);
    else {
      const e = entry;
      void models.icon(e, fxOn()).then((img) => {
        if (img && entry === e) draw(img);
      });
    }
  }

  /** "Edit shape" for blocks and items with a model the game reads from files (not mobs, not chests). */
  function paintShapeButton() {
    const can = !!hooks.onEditModel && !!entry && !!view && entry.kind !== 'entity' && (entry.kind === 'item' || view.category !== 'special');
    editShapeBtn.hidden = !can;
    if (!can || !entry) return;
    const custom = Object.values(project.customModels ?? {}).some((m) => m.id === entry!.id && (m.kind === entry!.kind || (entry!.kind === 'item' && m.kind === 'block')));
    editShapeBtn.querySelector<HTMLElement>('.tx-pv-shapebadge')!.hidden = !custom;
  }

  function paintNote() {
    const text = view?.note;
    note.hidden = !text;
    if (text) note.replaceChildren(icon('info'), h('span', null, text));
  }

  function paintStates() {
    const lib = models.lib;
    if (!entry || !lib) {
      statesEl.hidden = true;
      return;
    }
    // choices that apply to the look on show (a saddle on adults, a dye colour with leather on)
    const props: StateProperty[] = lib.properties(entry).filter((p) => !p.showIf || p.showIf(state));
    const set = (patch: BlockState) => {
      state = { ...state, ...patch };
      userState = true;
      void render({ keepView: true });
    };
    const row = (p: StateProperty) => {
      const value = state[p.name] ?? p.values[0]?.value ?? '';
      const short = p.values.length <= 4 && p.values.reduce((a, v) => a + v.label.length, 0) <= 14;
      const control = short
        ? segmented<string>({ value, size: 'sm', label: p.label, options: p.values.map((v) => ({ value: v.value, label: v.label })), onChange: (v) => set({ [p.name]: v }) })
        : select<string>({ value, options: p.values.map((v) => ({ value: v.value, label: v.label })), onChange: (v) => set({ [p.name]: v }) });
      if (!short) control.querySelector('select')?.setAttribute('aria-label', p.label);
      // (the trim's material sits under the trim: "Material" is enough there)
      const shown = p.name === 'trim_material' ? 'Material' : p.label;
      return h('div', { class: 'tx-pv-state', dataset: { prop: p.name } }, h('span', { class: 'tx-pv-state-label' }, shown), control);
    };
    const nodes: HTMLElement[] = props.filter((p) => !p.gear).map(row);
    // things the mob wears, under their own heading (an armour trim after the armour and its dye)
    const isTrim = (p: StateProperty) => p.name === 'trim' || p.name === 'trim_material';
    const gear = props.filter((p) => p.gear).sort((a, b) => Number(isTrim(a)) - Number(isTrim(b)));
    if (gear.length) {
      nodes.push(h('div', { class: 'tx-pv-gearhead', role: 'presentation' }, icon('shirt', { size: 16 }), h('span', null, 'Wearing')));
      const armor = gear.filter((p) => p.group === 'armor');
      for (const p of gear) {
        if (p.group !== 'armor') nodes.push(row(p));
        else if (p === armor[0]) nodes.push(...armorRows(armor, set));
      }
    }
    statesEl.hidden = !nodes.length;
    statesEl.replaceChildren(...nodes);
  }

  /** Material last picked for armour (a piece put back on gets it) */
  let armorMaterial = '';

  /**
   * Humanoid armour as one choice: a material for the whole set ("Mixed" when the pieces differ) and,
   * with armour on, a toggle per piece.
   */
  function armorRows(slots: StateProperty[], set: (patch: BlockState) => void): HTMLElement[] {
    const worn = slots.filter((p) => (state[p.name] ?? 'none') !== 'none');
    const mats = [...new Set(worn.map((p) => state[p.name]))];
    const current = !worn.length ? 'none' : mats.length === 1 ? mats[0] : 'mixed';
    const options: { value: string; label: string }[] = [];
    for (const p of slots) for (const v of p.values) if (!options.some((o) => o.value === v.value)) options.push({ value: v.value, label: v.label });
    if (current === 'mixed') options.push({ value: 'mixed', label: 'Mixed' });
    const fits = (p: StateProperty, m: string) => p.values.some((v) => v.value === m);
    const control = select<string>({
      value: current,
      options,
      onChange: (m) => {
        if (m === 'mixed') return;
        if (m !== 'none') armorMaterial = m;
        set(Object.fromEntries(slots.map((p) => [p.name, fits(p, m) ? m : 'none'])));
      },
    });
    control.querySelector('select')?.setAttribute('aria-label', 'Armour');
    const out = [h('div', { class: 'tx-pv-state', dataset: { prop: 'armor' } }, h('span', { class: 'tx-pv-state-label' }, 'Armour'), control)];
    if (current === 'none') return out;
    // a piece put on takes the set's material (the last one picked when they differ)
    const material = current !== 'mixed' ? current : armorMaterial && mats.includes(armorMaterial) ? armorMaterial : mats[0];
    const chips = slots.map((p) => {
      const on = (state[p.name] ?? 'none') !== 'none';
      const can = on || fits(p, material);
      const b = h(
        'button',
        { type: 'button', class: 'chip tx-pv-piece', 'aria-pressed': String(on), disabled: !can, dataset: { piece: p.name } },
        h('span', { class: 'truncate' }, p.label),
      );
      tooltip(b, on ? `Take off the ${p.label.toLowerCase()}` : can ? `Put on a ${p.label.toLowerCase()}` : `No ${p.label.toLowerCase()} in this material`);
      b.addEventListener('click', () => set({ [p.name]: on ? 'none' : material }));
      return b;
    });
    out.push(
      h(
        'div',
        { class: 'tx-pv-state tx-pv-pieces-row', dataset: { prop: 'pieces' } },
        h('span', { class: 'tx-pv-state-label' }, 'Pieces'),
        h('div', { class: 'tx-pv-pieces', role: 'group', 'aria-label': 'Armour pieces worn' }, chips),
      ),
    );
    return out;
  }

  const rowFor = (path: string) => texList.querySelector<HTMLElement>(`li[data-path="${CSS.escape(path)}"]`);

  function paintTextures() {
    if (!view || !entry) {
      texSection.hidden = true;
      return;
    }
    // Textures the game generates (armor trim colours) have no file: list them only where they show.
    // Worn things (armour, saddles...) are listed while worn, not as other states of the mob.
    const list = view.textures.filter((t) => (!t.missing || t.faces > 0 || store.isEdited(t.path)) && !(t.gear && t.faces === 0));
    texSection.hidden = list.length === 0;
    const inState = list.filter((t) => t.faces > 0 || view!.shape !== 'model');
    const other = list.length - inState.length;
    texCount.textContent = String(list.length);
    texHint.textContent = docked
      ? view.shape === 'special'
        ? 'Paint the texture sheet in 2D.'
        : 'Paint on the model, or pick a texture here to open it.'
      : view.shape === 'special'
        ? 'Click the texture sheet to paint it.'
        : view.shape === 'sprite'
          ? 'Click a layer to paint it.'
          : other
            ? 'Click a face or a texture to paint it. Dimmed: other states.'
            : 'Click a face or a texture to paint it.';
    texList.replaceChildren(...list.map((t) => textureRow(t)));
    syncRows();
  }

  function textureRow(t: ModelTexture): HTMLElement {
    const thumb = h('canvas', { class: 'tx-pv-texthumb', 'aria-hidden': 'true' });
    const e = store.byPath.get(t.path);
    const name = e?.id ?? t.path.slice(t.path.lastIndexOf('/') + 1).replace(/\.(png|tga)$/i, '');
    const other = t.faces === 0 && view?.shape === 'model';
    const edited = store.isEdited(t.path);
    const btn = h(
      'button',
      { type: 'button', class: 'tx-pv-texbtn' },
      h('span', { class: 'tx-pv-texthumbbox checker' }, thumb),
      h('span', { class: 'tx-pv-textext' }, h('span', { class: 'tx-pv-texlabel' }, t.label), h('span', { class: 'tx-pv-texname truncate' }, name)),
      h(
        'span',
        { class: 'tx-pv-texbadges' },
        t.missing ? badge('Missing', 'red') : null,
        edited ? h('span', { class: 'tx-pv-texedit', title: 'Edited' }, icon('pencil', { size: 16 })) : null,
        t.animated ? h('span', { class: 'tx-pv-texanim', title: 'Animated' }, icon('play', { size: 16 })) : null,
      ),
    );
    const li = h('li', { class: ['tx-pv-texrow', other && 'is-other'], dataset: { path: t.path } }, btn);
    btn.setAttribute('aria-label', `${t.label}: ${name}${other ? ' (another state)' : ''}${edited ? ', edited' : ''}`);
    tooltip(btn, other ? `Shown when ${stateText(t.state)} — click to switch and paint it` : `Paint ${name}`);
    btn.addEventListener('click', () => {
      if (other && t.state) {
        state = { ...t.state };
        userState = true;
        void render({ keepView: true });
      }
      if (!t.missing || store.isEdited(t.path)) hooks.openTexture(t.path, 'list');
    });
    btn.addEventListener('pointerenter', () => {
      if (!other) preview?.highlightTexture(t.path);
    });
    btn.addEventListener('pointerleave', () => preview?.highlightTexture(null));
    btn.addEventListener('focus', () => {
      if (!other) preview?.highlightTexture(t.path);
    });
    btn.addEventListener('blur', () => preview?.highlightTexture(null));
    void store
      .getFull(t.path)
      .then((img) => {
        let f = firstSquare(img);
        if (/\.tga$/i.test(t.path)) f = displayAlphaData(f, e?.category ?? 'block');
        paintCanvas(thumb, f);
      })
      .catch(() => thumb.classList.add('failed'));
    return li;
  }

  function stateText(s: BlockState | undefined): string {
    const lib = models.lib;
    if (!s || !entry || !lib) return 'another state';
    const props = lib.properties(entry);
    const parts: string[] = [];
    for (const p of props) {
      if (s[p.name] === undefined || s[p.name] === state[p.name]) continue;
      const v = p.values.find((x) => x.value === s[p.name]);
      parts.push(`${p.label}: ${v?.label ?? s[p.name]}`);
    }
    return parts.join(', ') || 'another state';
  }

  function syncRows() {
    for (const li of texList.querySelectorAll<HTMLElement>('li')) {
      const p = li.dataset.path!;
      li.classList.toggle('is-open', !!tex && tex.key === p);
      li.classList.toggle('is-hover', hoverPath === p);
      li.querySelector('button')?.setAttribute('aria-current', String(!!tex && tex.key === p));
    }
  }

  function onHover(hit: ModelHit | null) {
    hoverPath = hit?.texture ?? null;
    const t = hit?.texture ? view?.textures.find((x) => x.path === hit.texture) : null;
    if (t) {
      const name = store.byPath.get(t.path)?.name ?? t.path.slice(t.path.lastIndexOf('/') + 1).replace(/\.(png|tga)$/i, '');
      hoverTag.replaceChildren(h('strong', null, t.label), h('span', null, name));
      hoverTag.hidden = false;
      stageLabel.hidden = true;
    } else {
      hoverTag.hidden = true;
      stageLabel.hidden = false;
    }
    syncRows();
  }

  function onPick(hit: ModelHit) {
    if (!hit.texture) return;
    if (!store.assets.hasFile(hit.texture) && !store.isEdited(hit.texture)) return;
    hooks.openTexture(hit.texture, 'face');
  }

  // ---------------------------------------------------------------- render
  let tints: { grass: [number, number, number]; foliage: [number, number, number] } | null = null;
  const tinted = (img: ImageData, id: string, path: string): ImageData => {
    const t = tintFor(id, project.edition);
    if (!t) return img;
    const color = t.tint === 'fixed' ? t.color! : t.tint === 'grass' ? tints?.grass ?? DEFAULT_GRASS_TINT : tints?.foliage ?? DEFAULT_FOLIAGE_TINT;
    if (project.edition === 'bedrock' && /grass_side\.tga$/.test(path)) return toImage(tintByAlphaMask(img, color));
    return toImage(tintImage(img, color));
  };

  const root = project.edition === 'java' ? 'assets/minecraft/textures/' : 'textures/';
  const pathOfId = (id: string): string | null => {
    for (const ext of ['.png', '.tga']) if (store.byPath.has(root + id + ext)) return root + id + ext;
    return null;
  };

  const faceImage = async (id: string, current: OpenTexture): Promise<ImageData | null> => {
    const path = pathOfId(id);
    if (!path) return null;
    let img: ImageData;
    let anim = false;
    if (path === current.key) {
      img = current.full;
      anim = !!current.anim;
      if (current.anim) img = getFrame(img, current.anim, current.frame);
    } else {
      try {
        img = firstSquare(await store.getFull(path));
      } catch {
        return null;
      }
    }
    img = withFx(img, path, anim);
    const name = id.slice(id.lastIndexOf('/') + 1);
    if (project.edition === 'java' && name === 'grass_block_side') {
      const ov = pathOfId(id + '_overlay');
      if (ov) {
        try {
          const overlay = withFx(firstSquare(await store.getFull(ov)), ov, false);
          return toImage(compositeOverlay(img, overlay, tints?.grass ?? DEFAULT_GRASS_TINT));
        } catch {
          /* plain side */
        }
      }
    }
    return tinted(img, id, path);
  };

  async function loadTints() {
    if (tints) return;
    const b = await models.biome(showFx);
    tints = { grass: b.grass ?? DEFAULT_GRASS_TINT, foliage: b.foliage ?? DEFAULT_FOLIAGE_TINT };
  }

  function paintTiled(t: OpenTexture) {
    const frame = t.anim ? getFrame(t.full, t.anim, t.frame) : t.full;
    const cat = t.entry?.category ?? 'block';
    const shown = (img: ImageData) => (t.alphaData ? displayAlphaData(t.entry ? tinted(img, t.entry.id, t.key) : img, cat) : img);
    const tileSrc = shown(withFx(frame, t.key, !!t.anim));
    paintCanvas(tileCanvas, tile3(tileSrc));
    const tw = tileSrc.width * 3;
    const th = tileSrc.height * 3;
    const box = 240;
    const s = Math.max(tw, th) <= box ? Math.floor(box / Math.max(tw, th)) : box / Math.max(tw, th);
    tileCanvas.style.width = `${Math.round(tw * s)}px`;
    tileCanvas.style.height = `${Math.round(th * s)}px`;
    tileCanvas.classList.toggle('pixelated', s >= 1);
    tiledSection.hidden = t.key === ICON_KEY;
  }

  /** Follows the open texture to a block / item that uses it (keeps the current one when it does). */
  function follow(): boolean {
    const t = tex;
    const lib = models.lib;
    if (t?.key === ICON_KEY && entry) {
      setEntry(null);
      return false;
    }
    if (!t || t.key === ICON_KEY || !lib?.available || pinned) return false;
    const auto = autoEntry(t.key);
    if (auto && (auto.entry !== entry || JSON.stringify(auto.state ?? {}) !== JSON.stringify(state))) {
      const same = auto.entry === entry;
      setEntry(auto.entry, auto.state);
      return same;
    }
    if (!auto && entry) setEntry(null);
    return false;
  }

  function syncNoModel(pv: BlockPreview | null) {
    noModel.hidden = !docked || !tex || (!!pv && pv.mode === 'model' && !!entry);
  }

  async function render(opts: { keepView?: boolean; sameScene?: boolean } = {}) {
    const my = ++token;
    const t = tex;
    const lib = models.lib;
    if (entry && lib && !lib.ready(entry)) {
      // a mob's model loads on first use
      const e = entry;
      loadingModel.hidden = false;
      const ok = await models.prepare(e);
      if (my !== token || entry !== e) return;
      loadingModel.hidden = true;
      if (ok) {
        // its looks are known now: pick the one showing the open texture
        if (!userState && t) state = statesShowing(e, { ...lib.defaultState(e), ...state }, t.key);
        void render(opts);
        return;
      }
    }
    if (entry && lib) {
      try {
        view = lib.resolve(entry, state);
        state = view.state;
      } catch (err) {
        console.error(err);
        view = null;
      }
    } else view = null;
    const modelMode = !!(entry && view);
    body.classList.toggle('is-model', modelMode);
    body.hidden = !t && !modelMode;
    empty.hidden = !!t || modelMode;
    head.hidden = !modelMode;
    modeSeg.hidden = modelMode;
    itemSeg.hidden = !(modelMode && view?.shape === 'sprite');
    controls.hidden = modelMode && itemSeg.hidden;
    rotateBtn.setActive(!docked && (modelMode ? spinModel : spinTexture));
    if (modelMode) {
      paintHead();
      paintShapeButton();
      paintNote();
      paintTrimNote();
      paintStates();
      paintTextures();
      paintParts();
    } else {
      partsSection.hidden = true;
      partsBtn.hidden = true;
      editShapeBtn.hidden = true;
      note.hidden = true;
      trimNote.hidden = true;
      trimNoteKey = '';
      statesEl.hidden = true;
      texSection.hidden = true;
      hoverTag.hidden = true;
    }
    if (t) paintTiled(t);
    else tiledSection.hidden = true;
    fxToggle.hidden = !store.effectsActive();

    if (!visible) return;
    const pv = await ensure();
    if (!pv || my !== token) return;
    pv.setAutoRotate(!docked && (modelMode ? spinModel : spinTexture));
    if (modelMode) {
      const key = `${entry!.kind}:${entry!.id}|${JSON.stringify(state)}|${fxOn()}|${itemFlat}|${fxOn() ? models.effectsKey : ''}|${[...hidden()].join(',')}`;
      // The open texture changed but the model on show didn't: its faces already show the pack's pixels.
      if (opts.sameScene && key === sceneKey && pv.mode === 'model') {
        syncNoModel(pv);
        return;
      }
      await renderModel(pv, my, !!opts.keepView);
      if (my === token) sceneKey = key;
      syncNoModel(pv);
      return;
    }
    sceneKey = '';
    syncNoModel(pv);
    if (!t) return;
    await loadTints();
    if (my !== token) return;
    renderTexture(pv, t, my);
  }

  async function renderModel(pv: BlockPreview, my: number, keepView: boolean) {
    const v = view!;
    const e = entry!;
    const key = `${e.kind}:${e.id}`;
    const slow = setTimeout(() => {
      if (my === token) loadingModel.hidden = false;
    }, 200);
    const off = v.parts ? hidden() : null;
    const shown = off?.size ? { ...v, quads: v.quads.filter((q) => !off.has(v.parts![q.part]?.name ?? '')) } : v;
    const built = await models.scene(shown, { fx: fxOn(), live: live() });
    if (built && !built.flat) await addPalettes(built.scene, shown);
    clearTimeout(slow);
    loadingModel.hidden = true;
    if (my !== token) return;
    const again = shownKey === key;
    shownKey = key;
    if (!built) {
      pv.showFlat(new ImageData(1, 1));
      stageLabel.textContent = 'No texture';
      return;
    }
    if (built.flat) {
      pv.showFlat(built.flat);
      stageLabel.textContent = 'Texture sheet';
    } else if (v.shape === 'sprite' && itemFlat) {
      const first = built.scene.textures.get(v.sprite[0]?.path ?? '');
      if (first) pv.showFlat(first.image, first.frames > 1 ? { frametime: first.frametime } : undefined);
      stageLabel.textContent = 'Item';
    } else {
      // with parts hidden the mob keeps the place and size it has whole
      pv.showModel(built.scene, { view: built.view, keepView: keepView && again, frame: off?.size ? v.quads : undefined });
      stageLabel.textContent = v.approximate ? 'Approximate shape' : e.kind === 'item' ? 'Item' : v.shape === 'sprite' ? 'Item icon' : v.category === 'mob' ? 'Mob model' : v.category === 'special' ? 'Drawn by the game' : 'In-game model';
      if (built.misfit?.length) {
        note.hidden = false;
        note.replaceChildren(icon('info'), h('span', null, `${built.misfit.length === 1 ? 'A texture doesn’t' : 'Some textures don’t'} have the shape this mob’s model maps, so ${built.misfit.length === 1 ? 'it is' : 'they are'} left off the model. Paint ${built.misfit.length === 1 ? 'it' : 'them'} in 2D.`));
      }
    }
    if (hoverPath) preview?.highlightTexture(hoverPath);
  }

  /** Palettes of the trims on show (the pack's pixels), so the model colours them as the game does. */
  async function addPalettes(scene: ModelScene, v: ModelView) {
    const paths = new Set<string>();
    for (const q of v.quads) if (q.palette) paths.add(q.palette.key).add(q.palette.values);
    await Promise.all(
      [...paths].map(async (p) => {
        if (scene.textures.has(p) || (!store.assets.hasFile(p) && !store.isEdited(p))) return;
        const t = await models.texture(p, { fx: fxOn(), live: live(), whole: true });
        if (t) scene.textures.set(p, t);
      }),
    );
  }

  /** The trim palettes of the model on show that colour a pattern (null: it isn't a coloured trim). */
  const trimPalettesOf = (path: string): { key: string; values: string } | null => view?.quads.find((q) => q.texture === path && q.palette)?.palette ?? null;
  const usesPalette = (path: string) => !!view?.quads.some((q) => q.palette && (q.palette.key === path || q.palette.values === path));

  /**
   * How the game colours a trim: shown while a trim pattern (or a trim palette) of the model on show is
   * open. Patterns are painted as they are; the swatches show which greys take the trim's colours.
   */
  let trimNoteKey = '';
  function paintTrimNote() {
    const path = tex?.key ?? '';
    const pal = entry?.kind === 'entity' && path ? trimPalettesOf(path) : null;
    const isPalette = !pal && entry?.kind === 'entity' && !!path && usesPalette(path);
    const key = pal ? `p|${path}|${pal.key}|${pal.values}|${store.stamp(pal.key)}|${store.stamp(pal.values)}` : isPalette ? `k|${path}` : '';
    if (key === trimNoteKey) return;
    trimNoteKey = key;
    if (!pal && !isPalette) {
      trimNote.hidden = true;
      trimNote.replaceChildren();
      return;
    }
    if (isPalette) {
      const isKey = !!view?.quads.some((q) => q.palette?.key === path);
      trimNote.replaceChildren(
        icon('palette'),
        h(
          'span',
          null,
          isKey
            ? 'Trim colour key: the grey shades trim patterns are drawn in, lightest first. The game gives each pattern pixel of one of these greys the colour at the same place in the trim material’s palette.'
            : 'Trim colours: the colour each grey shade of every trim pattern becomes for this material, lightest first. Repaint a pixel to recolour that shade on every trim.',
        ),
      );
      trimNote.hidden = false;
      return;
    }
    const text = h('span', null, 'The game colours this trim: each of these greys becomes the trim material’s colour shown under it. Paint with them to keep the trim’s colour; any other colour shows as painted on every material.');
    const row = h('span', { class: 'tx-pv-trimkeys', style: 'display:flex;flex-wrap:wrap;gap:4px;margin-top:6px' });
    trimNote.replaceChildren(icon('palette'), h('span', { style: 'display:flex;flex-direction:column;min-width:0' }, text, row));
    trimNote.hidden = false;
    const my = trimNoteKey;
    void Promise.all([store.getFull(pal!.key), store.getFull(pal!.values)])
      .then(([k, vals]) => {
        if (trimNoteKey !== my) return;
        const hex = (c: number[]) => `#${c.slice(0, 3).map((x) => x.toString(16).padStart(2, '0')).join('')}`;
        for (const s of paletteSwatches(k, vals)) {
          const sw = h(
            'span',
            { style: 'display:inline-flex;flex-direction:column;width:22px;height:30px;border-radius:4px;overflow:hidden;box-shadow:0 0 0 1px var(--border, rgba(127,127,127,.4))' },
            h('span', { style: `flex:1;background:${hex(s.key)}` }),
            h('span', { style: `flex:1;background:${s.value ? hex(s.value) : 'transparent'}` }),
          );
          const label = `${hex(s.key)} becomes ${s.value ? hex(s.value) : 'no colour'}`;
          sw.setAttribute('role', 'img');
          sw.setAttribute('aria-label', label);
          tooltip(sw, label);
          row.appendChild(sw);
        }
      })
      .catch(() => undefined);
  }

  function renderTexture(pv: BlockPreview, t: OpenTexture, my: number) {
    const frame = t.anim ? getFrame(t.full, t.anim, t.frame) : t.full;
    const cat = t.entry?.category ?? 'block';
    const e = t.entry;
    const isBlockish = !!e && e.category === 'block';
    const cutout = !t.alphaData && transparentShare(frame) > 0.3;
    const cube = mode === 'cube' || (mode === 'auto' && isBlockish && !cutout && t.key !== ICON_KEY);
    const frametime = t.anim ? t.anim.frametime : undefined;
    if (!cube) {
      const img = t.anim ? stripForPreview(withFx(t.full, t.key, true), t.anim) : withFx(t.full, t.key, false);
      const tintedImg = e ? tinted(img, e.id, t.key) : img;
      pv.showFlat(t.alphaData ? displayAlphaData(tintedImg, cat) : tintedImg, frametime && t.anim ? { frametime } : undefined);
      stageLabel.textContent = t.key === ICON_KEY ? 'Pack icon' : e?.category === 'block' ? 'Cut-out block' : 'Sprite';
      return;
    }
    const plan = e ? planCube(e.id, (id) => pathOfId(id) !== null, project.edition) : null;
    const mainFull = withFx(t.anim ? stripForPreview(t.full, t.anim) : t.full, t.key, !!t.anim);
    const main = e ? tinted(mainFull, e.id, t.key) : mainFull;
    const mainShown = t.alphaData ? displayAlphaData(main, cat) : main;
    if (!plan || !e) {
      pv.showCube({ all: mainShown }, frametime ? { frametime } : undefined);
      stageLabel.textContent = 'Block';
      return;
    }
    void Promise.all([
      plan.up === e.id ? mainShown : faceImage(plan.up, t),
      plan.down === e.id ? mainShown : faceImage(plan.down, t),
      plan.side === e.id ? mainShown : faceImage(plan.side, t),
      plan.front ? (plan.front === e.id ? mainShown : faceImage(plan.front, t)) : Promise.resolve(null),
    ]).then(([up, down, side, front]) => {
      if (my !== token) return;
      const sideImg = side ?? mainShown;
      pv.showCube(
        // Minecraft puts a block's front on north, which the preview camera faces by default.
        { up: up ?? mainShown, down: down ?? up ?? mainShown, north: front ?? sideImg, east: sideImg, west: sideImg, south: sideImg },
        frametime ? { frametime } : undefined,
      );
      stageLabel.textContent = 'Block';
    });
  }

  // ---------------------------------------------------------------- live updates
  let timer: ReturnType<typeof setTimeout> | null = null;
  const soon = (ms = 120, opts: { keepView?: boolean } = { keepView: true }) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void render(opts);
    }, ms);
  };

  let liveRaf = 0;
  let livePending: { path: string; full: ImageData } | null = null;
  const pushLive = () => {
    liveRaf = 0;
    const p = livePending;
    livePending = null;
    if (!p || !preview || !view || !entry) return;
    const q = view.quads.find((x) => x.texture === p.path);
    const anim: AnimInfo | null = tex && tex.key === p.path ? tex.anim : null;
    const img = models.textureFromPixels(p.path, p.full, anim, { fx: fxOn(), mask: !!q?.tintMask, whole: !!view.texSizes?.has(p.path) });
    preview.updateModelTexture(p.path, img);
  };

  const offs = [
    store.events.on('image', ({ path, full }) => {
      if (!tex || path !== tex.key) return;
      paintTiled(tex);
      if (entry && view) {
        // (a trim palette recolours the trims using it)
        if (view.shape === 'model' && (view.quads.some((q) => q.texture === path) || usesPalette(path))) {
          // Fast path: swap the pixels of that texture on the model.
          livePending = { path, full };
          liveRaf ||= requestAnimationFrame(pushLive);
          if (texList.querySelector(`li[data-path="${CSS.escape(path)}"]`)) refreshRowThumb(path);
          return;
        }
        soon(150);
        return;
      }
      soon(90);
    }),
    store.events.on('effects', () => {
      tints = null;
      models.resetBiome();
      soon(160);
    }),
    store.events.on('overrides', ({ path }) => {
      if (/colormap\//.test(path)) {
        tints = null;
        models.resetBiome();
      }
      if (tex && path === tex.key) return;
      if (view?.textures.some((t) => t.path === path) || !entry) soon(200);
    }),
    models.events.on('ready', () => {
      follow();
      soon(0, {});
    }),
    // a model changed in the model editor: show its new shape
    models.events.on('models', (changed) => {
      if (entry && changed.some((c) => c.id === entry!.id)) soon(0);
    }),
    models.events.on('usage', () => {
      // Now the block using the open texture is known.
      if (entry) return;
      follow();
      if (entry) soon(0, {});
    }),
  ];

  let thumbTimer: ReturnType<typeof setTimeout> | null = null;
  function refreshRowThumb(path: string) {
    if (thumbTimer) return;
    thumbTimer = setTimeout(() => {
      thumbTimer = null;
      const li = rowFor(path);
      const c = li?.querySelector('canvas');
      if (!c || !tex || tex.key !== path) return;
      const f = firstSquare(tex.anim ? getFrame(tex.full, tex.anim, 0) : tex.full);
      paintCanvas(c, /\.tga$/i.test(path) ? displayAlphaData(f, tex.entry?.category ?? 'block') : f);
      li!.querySelector('.tx-pv-texbadges')?.replaceChildren(h('span', { class: 'tx-pv-texedit', title: 'Edited' }, icon('pencil', { size: 16 })));
    }, 250);
  }

  return {
    el,
    setTexture(t) {
      const changed = t?.key !== tex?.key;
      tex = t;
      // "Texture on its own" (the close button) lasts until another texture opens.
      if (changed) pinned = false;
      const before = entry;
      const beforeState = JSON.stringify(state);
      if (changed) follow();
      syncRows();
      void render({ keepView: true, sameScene: entry === before && JSON.stringify(state) === beforeState });
    },
    setVisible(v) {
      visible = v;
      if (v) void render({ keepView: true });
    },
    showEntry(e, s) {
      pinned = false;
      setEntry(e, s);
      if (e && tex && models.lib) {
        // keep the open texture visible when the new block uses it
        const has = models.lib.textureStates(e).some((x) => x.path === tex!.key);
        if (has && !s) state = statesShowing(e, state, tex.key);
      }
      void render();
    },
    current: () => (entry ? { entry, state: { ...state } } : null),
    facePoint: (path) => preview?.facePoint(path) ?? null,
    dock(target, canvasBox) {
      const on = !!target;
      if (on === docked && (!on || hero.parentElement === target)) return;
      docked = on;
      body.classList.toggle('is-docked', on);
      if (on) {
        target!.appendChild(hero);
        if (canvasBox) canvasSlot.appendChild(canvasBox);
        canvasSlot.hidden = false;
      } else {
        canvasSlot.hidden = true;
        if (hero.parentElement !== body) head.after(hero);
      }
      hero.classList.toggle('is-docked', on);
      views.hidden = !on;
      if (!on) partsPop?.close();
      partsBtn.hidden = !on || partsSection.hidden;
      paintHint.hidden = !on || !paintHandler;
      hoverTag.hidden = true;
      hoverPath = null;
      syncRows();
      syncSpin();
      preview?.setPaintMode(on ? paintHandler : null);
      syncNoModel(preview);
      void render({ keepView: true });
    },
    setPaintHandler(hd) {
      paintHandler = hd;
      paintHint.hidden = !docked || !hd;
      preview?.setPaintMode(docked ? hd : null);
    },
    setPaintCursor: (c) => preview?.setPaintCursor(c),
    setPaintHint(hint) {
      paintHint.classList.toggle('is-idle', !hint);
      paintHint.classList.toggle('is-locked', !!hint?.locked);
      if (!hint) {
        paintHintDot.style.background = '';
        paintHintText.textContent = matchMedia('(pointer: coarse)').matches ? 'One finger paints · two fingers turn' : 'Drag to paint · right-drag to turn · scroll to zoom';
        return;
      }
      const c = hint.color;
      paintHintDot.style.background = c ? `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${(c[3] / 255).toFixed(3)})` : '';
      paintHintText.replaceChildren(h('strong', null, hint.label), h('span', null, hint.locked ? ` · ${hint.locked}` : ` · ${hint.name} · ${hint.x}, ${hint.y}`));
    },
    pinFrame(path, frame) {
      pin = path === null && frame < 0 ? null : { path, frame };
      preview?.pinFrames(pinMap());
    },
    refreshPaintHover: () => preview?.refreshPaintHover(),
    textureLabel: (path) => view?.textures.find((t) => t.path === path)?.label ?? null,
    partLabel: (part) => (part === undefined ? null : (view?.parts?.[part]?.label ?? null)),
    view3d: () => preview,
    destroy() {
      destroyed = true;
      partsPop?.close();
      token++;
      offs.forEach((f) => f());
      if (timer) clearTimeout(timer);
      if (thumbTimer) clearTimeout(thumbTimer);
      if (liveRaf) cancelAnimationFrame(liveRaf);
      preview?.destroy();
      preview = null;
    },
  };
}

function toImage(img: { width: number; height: number; data: Uint8ClampedArray }): ImageData {
  if (img instanceof ImageData) return img;
  return new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
}

/** The block preview animates vertical strips of square frames; re-pack other layouts. */
function stripForPreview(full: ImageData, a: AnimInfo): ImageData {
  if (a.cols === 1 && a.frameW === full.width && a.frameH === a.frameW) return full;
  const out = new ImageData(a.frameW, a.frameH * a.count);
  for (let i = 0; i < a.count; i++) {
    const f = getFrame(full, a, i);
    out.data.set(f.data, i * f.data.length);
  }
  return a.frameW === a.frameH ? out : cloneImageData(getFrame(full, a, 0));
}
