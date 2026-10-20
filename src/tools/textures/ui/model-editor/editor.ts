// Model editor of the texture pack maker (Java, loaded only when opened): change the shape of a block's
// or item's model. The cube list, a 3D view with move / resize handles, and tabs for the selected cube
// (position, size, rotation), its faces (texture, UV area, rotation, cull face, tint), the display
// transforms (with the model shown in the inventory, in hand, on the ground...) and the model itself
// (start points, lighting, problems, files). Every change is one undo step and is saved into the pack
// (model file, plus an item definition or blockstate when the game needs one).

import type { CustomModel } from '../../../../core/types';
import { h } from '../../../../ui/dom';
import { icon, type IconName } from '../../../../ui/icons';
import { button, iconButton, openMenu, segmented, select, tabs, toggle, tooltip } from '../../../../ui/components';
import { confirmDialog, openModal } from '../../../../ui/modal';
import { toast } from '../../../../ui/toast';
import { saveBlob } from '../../../../core/download';
import { createImageData } from '../../../../core/pixels';
import type { BlockState, ModelEntry } from '../../../../shared/models/index';
import { DIRS, type Dir, type RGB, type Tint, type UV4, type Vec3 } from '../../../../shared/models/geometry';
import {
  JavaModelSet,
  bakeModel,
  blockstatePath,
  itemDefinitionPath,
  itemOptions,
  javaBlockTint,
  javaTexturePath,
  legacyItemTint,
  modelPath,
  parseBlockstate,
  resolveTextureVar,
  variantsForState,
  type DisplayTransform,
  type JsonGet,
} from '../../../../shared/models/java-models';
import type { ModelTextureImage } from '../../../../shared/models/model-mesh';
import {
  addElement,
  cloneModel,
  cloneTransform,
  deleteElement,
  duplicateElement,
  effectiveUv,
  elementLabel,
  modelFromResolved,
  modelText,
  moveElement,
  newElement,
  reorderElement,
  setDisplay,
  setExtent,
  setFace,
  setPositionSize,
  setRotation,
  sizeOf,
  textureVarFor,
  toResolved,
  type EditFace,
  type EditModel,
} from '../../models/doc';
import { allowedAngle, atlasDirsFrom, handSlot, modelRules, slotName, validateModel, ROTATION_STEPS, type ModelIssue } from '../../models/rules';
import { blankModel, cross, fullCube, slab, spriteTo3d, type SpriteLayerInput } from '../../models/presets';
import { blockModelChoices, blocksUsingModel, planBlock, planFiles, planItem, randomSiblings, shortModelName, type BlockModelChoice, type ModelPlan } from '../../models/targets';
import { toBedrockGeometry } from '../../models/bedrock';
import { parseJsonLoose } from '../../project';
import type { TexStore } from '../store';
import type { ModelService } from '../models';
import type { ThumbService } from '../thumbs';
import { paintCanvas } from '../thumbs';
import { firstFrame } from '../models';
import { ModelEditorViewport, type Tool } from './viewport';
import { createUvEditor } from './uv-editor';
import { numField, section, vecFields } from './fields';
import { openTexturePicker } from './texture-picker';
import './model-editor.css';
import { fmt } from '../../../../i18n/editor-text';
import { tm } from '../i18n/model-editor';
import { tr } from '../i18n/model-rules';

export interface ModelEditorOptions {
  store: TexStore;
  models: ModelService;
  thumbs: ThumbService;
  entry: ModelEntry;
  /** The state on show in the preview (blocks: which model; items: `model` = the look) */
  state: BlockState;
  /** Leave the model editor */
  onClose(): void;
  /** Leave and paint a texture */
  paintTexture(path: string): void;
  /** Undo / redo availability changed */
  onHistory(): void;
}

export interface ModelEditor {
  el: HTMLElement;
  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
  /** Saves now */
  flush(): void;
  destroy(): void;
  /** For tests */
  readonly test: {
    doc(): EditModel;
    plan(): ModelPlan;
    select(i: number): void;
    viewport(): ModelEditorViewport;
    issues(): ModelIssue[];
  };
}

type Tab = 'cubes' | 'cube' | 'faces' | 'display' | 'model';
const SNAP_KEY = 'to-model-snap';
const FACE_ORDER: Dir[] = ['up', 'north', 'east', 'down', 'south', 'west'];

export async function createModelEditor(o: ModelEditorOptions): Promise<ModelEditor> {
  const { store, models, thumbs, entry } = o;
  const project = store.project;
  const lib = models.lib ?? (await models.load());
  if (!lib?.javaFiles()) throw new Error(tm.loadFailed);
  const files = () => lib.javaFiles()!;
  const rules = modelRules(project.version);
  const kind = entry.kind === 'item' ? 'item' : 'block';
  const flattened = store.assets.hasFile('assets/minecraft/textures/block/stone.png') || !store.assets.hasFile('assets/minecraft/textures/blocks/stone.png');
  const newDir = kind === 'item' ? (flattened ? 'item' : 'items') : flattened ? 'block' : 'blocks';
  const existing = (): CustomModel[] => Object.values(project.customModels ?? {}).filter((m) => m.kind === kind && m.id === entry.id);
  /**
   * Files as they were before the model editor wrote them (the pack's own copy, else the game's): an
   * item definition or blockstate the editor made must not be read back as the starting point.
   */
  const originals = new Map<string, unknown>();
  for (const m of Object.values(project.customModels ?? {}))
    for (const [path, blob] of Object.entries(m.originals))
      if (blob && /\.json$/.test(path)) {
        try {
          originals.set(path, parseJsonLoose(await blob.text()) ?? undefined);
        } catch {
          /* unreadable: the game's file is used */
        }
      }
  const baseJson: JsonGet = (path) => {
    const mine = Object.values(project.customModels ?? {}).some((m) => m.files.includes(path));
    if (!mine) return files().json(path);
    return originals.has(path) ? originals.get(path) : files().vanilla(path);
  };

  // ---------------------------------------------------------------- what is edited
  let option = kind === 'item' ? Number(o.state.model ?? 0) || 0 : 0;
  let choices: BlockModelChoice[] = [];
  let chosen = '';
  let siblings: string[] = [];
  if (kind === 'block') {
    const bsJson = baseJson(blockstatePath(entry.id));
    choices = blockModelChoices(bsJson);
    if (!choices.length) throw new Error(tm.noBlockstate);
    const bs = parseBlockstate(bsJson);
    const shown = bs ? variantsForState(bs, o.state)[0]?.model : undefined;
    const mine = existing()[0]?.model;
    chosen = mine ?? (shown ? choices.find((c) => c.model === shortToId(shown))?.model : undefined) ?? choices[0].model;
  } else {
    const mine = existing()[0];
    if (mine?.option !== undefined) option = mine.option;
  }
  let flatGui = existing()[0]?.flatGui ?? false;
  let everyVariant = existing()[0]?.everyVariant ?? true;
  let plan = makePlan();
  function makePlan(): ModelPlan {
    // item definitions and blockstates as they were; models as the pack has them now
    const json: JsonGet = (path) => (/\/models\//.test(path) ? files().json(path) : baseJson(path));
    if (kind === 'item') return planItem({ itemId: entry.id, rules, json, option, flatGui });
    siblings = randomSiblings(baseJson(blockstatePath(entry.id)), chosen);
    return planBlock({ blockId: entry.id, model: chosen, json, everyVariant: everyVariant && siblings.length > 0 });
  }

  /** The model as the game reads it now (the pack's file first, else the game's), ready to edit. */
  function loadDoc(): EditModel {
    const f = files();
    const target = f.json(modelPath(plan.target)) !== undefined ? plan.target : plan.source;
    return modelFromResolved(f.models.resolve(target), f.json(modelPath(target)));
  }
  /** The game's own display transforms (for "Reset"). */
  function gameDisplay(): Record<string, DisplayTransform> {
    return new JavaModelSet(files().vanilla).resolve(plan.source).display ?? {};
  }

  let doc = loadDoc();
  let defaults = gameDisplay();
  let gameHasCubes = gameModelHasCubes();
  let changed = existing().some((m) => m.model === plan.base);
  let sel = doc.elements.length ? 0 : -1;
  let face: Dir = 'north';
  const isPhone = () => matchMedia('(max-width: 760px)').matches;
  const isNarrow = () => matchMedia('(max-width: 1180px)').matches;
  let tab: Tab = doc.elements.length ? 'cube' : 'model';
  let slot = 'gui';
  let snap = 1;
  try {
    const s = Number(localStorage.getItem(SNAP_KEY));
    if ([1, 0.5, 0.25, 0].includes(s) && localStorage.getItem(SNAP_KEY) !== null) snap = s;
  } catch {
    /* storage blocked */
  }
  let tool: Tool = 'move';
  const undoStack: string[] = [];
  const redoStack: string[] = [];
  let coalesce = { key: '', at: 0 };
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let issues: ModelIssue[] = [];
  let atlas: { block: string[] | null; item: string[] | null } = { block: null, item: null };
  let destroyed = false;
  const offs: (() => void)[] = [];

  // ---------------------------------------------------------------- DOM
  const titleName = h('h2', { class: 'me-title-name truncate' }, entry.name);
  const titleSub = h('span', { class: 'me-title-sub truncate' });
  const backBtn = button({ label: tm.done, icon: 'arrow-left', variant: 'ghost', size: 'sm', class: 'me-back', onClick: () => close() });
  tooltip(backBtn, tm.doneHint);
  const choiceBox = h('div', { class: 'me-choice' });
  const statusChip = h('button', { type: 'button', class: 'me-status' });
  statusChip.addEventListener('click', () => setTab('model', true));
  const moreBtn = iconButton('more-vertical', tm.more, () => openMore(), { size: 'sm' });
  const head = h(
    'header',
    { class: 'me-head' },
    backBtn,
    h('div', { class: 'me-title' }, titleName, titleSub),
    choiceBox,
    h('span', { class: 'grow' }),
    statusChip,
    moreBtn,
  );

  // cubes
  const cubeList = h('ul', { class: 'me-cubelist', role: 'listbox', 'aria-label': tm.cubes });
  const cubeCount = h('span', { class: 'me-count' });
  const addBtn = iconButton('plus', tm.addCubeKey, () => addCube(), { size: 'sm' });
  const dupBtn = iconButton('copy', tm.duplicateKey, () => duplicate(), { size: 'sm' });
  const delBtn = iconButton('trash', tm.deleteKey, () => remove(), { size: 'sm' });
  const upBtn = iconButton('arrow-up', tm.moveUp, () => reorder(-1), { size: 'sm' });
  const downBtn = iconButton('arrow-down', tm.moveDown, () => reorder(1), { size: 'sm' });
  const cubesPanel = h(
    'div',
    { class: 'me-cubes panel', dataset: { pane: 'cubes' } },
    h('div', { class: 'me-cubes-head' }, h('h3', { class: 'me-section-title' }, icon('box', { size: 16 }), tm.cubes, cubeCount), h('span', { class: 'grow' }), addBtn),
    h('div', { class: 'me-cubes-scroll scroll' }, cubeList),
    h('div', { class: 'me-cubes-foot' }, dupBtn, delBtn, h('span', { class: 'grow' }), upBtn, downBtn),
  );

  // stage
  const stageBox = h('div', { class: 'me-stage-gl' });
  const toolSeg = segmented<Tool>({
    value: tool,
    size: 'sm',
    label: tm.handles,
    options: [
      { value: 'move', label: tm.move, icon: 'move' },
      { value: 'resize', label: tm.resize, icon: 'expand' },
    ],
    onChange: (v) => {
      tool = v;
      viewport.setTool(v);
    },
  });
  const snapSel = select<string>({
    value: String(snap),
    options: [
      { value: '1', label: tm.snap1 },
      { value: '0.5', label: tm.snapHalf },
      { value: '0.25', label: tm.snapQuarter },
      { value: '0', label: tm.noSnap },
    ],
    onChange: (v) => {
      snap = Number(v);
      try {
        localStorage.setItem(SNAP_KEY, v);
      } catch {
        /* storage blocked */
      }
    },
  });
  snapSel.classList.add('me-snap');
  snapSel.querySelector('select')?.setAttribute('aria-label', tm.snapLabel);
  tooltip(snapSel, tm.snapHint);
  const views = h('div', { class: 'me-views', role: 'group', 'aria-label': tm.cameraViews });
  for (const v of ['front', 'right', 'back', 'left', 'top'] as const) {
    const label = tm.views[v];
    const k = tm.viewKeys[v];
    const b = h('button', { type: 'button', class: 'me-view-btn', 'aria-label': label }, k);
    tooltip(b, label);
    b.addEventListener('click', () => viewport.setCameraView(v));
    views.appendChild(b);
  }
  const stageTools = h('div', { class: 'me-stage-tools' }, toolSeg, snapSel);
  const stageHint = h('p', { class: 'me-stage-hint' });
  const startCard = h('div', { class: 'me-start', hidden: true });
  const slotBar = h('div', { class: 'me-slots', role: 'radiogroup', 'aria-label': tm.slotsLabel, hidden: true });
  const stage = h('div', { class: 'me-stage checker-soft' }, stageBox, stageTools, views, slotBar, stageHint, startCard);

  // side
  const sideTabs = tabs<Tab>({
    value: tab,
    label: tm.panels,
    tabs: [
      { value: 'cubes', label: tm.tabs.cubes },
      { value: 'cube', label: tm.tabs.cube },
      { value: 'faces', label: tm.tabs.faces },
      { value: 'display', label: tm.tabs.display },
      { value: 'model', label: tm.tabs.model },
    ],
    onChange: (v) => setTab(v, true),
  });
  const sideBody = h('div', { class: 'me-side-body scroll', role: 'tabpanel' });
  const side = h('div', { class: 'me-side panel', dataset: { pane: 'side' } }, h('div', { class: 'me-side-tabs' }, sideTabs), sideBody);
  const body = h('div', { class: 'me-body' }, cubesPanel, stage, side);
  const el = h('div', { class: 'me-root', dataset: { tab } }, head, body);

  const viewport = new ModelEditorViewport(stageBox, {
    select: (i, f) => {
      if (i === null) return;
      sel = i;
      if (f) face = f;
      if (tab === 'model' || (tab === 'cubes' && !isNarrow())) setTab('cube');
      syncSelection();
      renderList();
      renderSide();
    },
    dragStart: () => startDrag(),
    drag: (t, axis, sideSign, delta) => dragTo(t, axis, sideSign, delta),
    dragEnd: () => endDrag(),
  });
  viewport.setTool(tool);

  // ---------------------------------------------------------------- textures in 3D
  const texCache = new Map<string, ModelTextureImage | null>();
  const texLoads = new Map<string, Promise<void>>();
  let tintRgb: ((t: Tint) => RGB) | null = null;
  const itemTints = (): ((i: number) => Tint | null) => {
    if (kind === 'block') return (i) => javaBlockTint(entry.id, o.state, i);
    if (!rules.itemDefinitions) return (i) => legacyItemTint(entry.id, i);
    const opts = itemOptions(files().vanilla(itemDefinitionPath(entry.id)));
    const leaf = opts[Math.max(0, Math.min(opts.length - 1, option))]?.leaves.find((l) => l.leaf.kind === 'model')?.leaf;
    return (i) => (leaf?.kind === 'model' ? leaf.tints[i] ?? null : null);
  };
  let tintIndex = itemTints();

  const loadTexture = (path: string): Promise<void> => {
    let p = texLoads.get(path);
    if (!p) {
      p = (async () => {
        if (!store.assets.hasFile(path) && !store.isEdited(path)) {
          texCache.set(path, null);
          return;
        }
        texCache.set(path, await models.texture(path, { fx: false }));
      })();
      texLoads.set(path, p);
    }
    return p;
  };

  let renderToken = 0;
  async function refresh3d() {
    const my = ++renderToken;
    const quads = bakeModel(toResolved(doc), { tint: tintIndex });
    const paths = [...new Set(quads.map((q) => q.texture).filter((p): p is string => !!p))];
    const missing = paths.filter((p) => !texCache.has(p));
    if (missing.length || !tintRgb) {
      await Promise.all([...missing.map(loadTexture), (async () => (tintRgb ??= models.tintFn(await models.biome(false))))()]);
      if (my !== renderToken || destroyed) return;
    }
    const map = new Map<string, ModelTextureImage>();
    for (const p of paths) {
      const t = texCache.get(p);
      if (t) map.set(p, t);
    }
    viewport.setModel(quads, map, tintRgb!);
    syncSelection();
  }

  function syncSelection() {
    const e = sel >= 0 ? doc.elements[sel] : null;
    viewport.setSelection(e ? sel : null, e);
    if (tab === 'faces' && e) {
      // the face's quad among the baked ones: quads follow cube order, then DIRS order
      let idx = 0;
      let found = -1;
      doc.elements.forEach((el, i) => {
        for (const d of DIRS) {
          if (!el.faces[d]) continue;
          if (i === sel && d === face) found = idx;
          idx++;
        }
      });
      viewport.highlightQuad(found);
    } else viewport.highlightQuad(-1);
  }

  // ---------------------------------------------------------------- history and saving
  function pushUndo(key = '') {
    const now = performance.now();
    if (key && key === coalesce.key && now - coalesce.at < 1500) {
      coalesce.at = now;
      return;
    }
    coalesce = { key, at: now };
    undoStack.push(JSON.stringify({ doc, sel }));
    if (undoStack.length > 300) undoStack.shift();
    redoStack.length = 0;
  }

  /** One change: `key` merges quick repeats (typing in a field) into one undo step. */
  function edit(fn: () => void, opts: { key?: string; panel?: boolean } = {}) {
    pushUndo(opts.key);
    fn();
    afterChange(!opts.panel);
  }

  function afterChange(rerenderPanel = true) {
    changed = true;
    if (sel >= doc.elements.length) sel = doc.elements.length - 1;
    if (sel < 0 && doc.elements.length) sel = 0;
    void refresh3d();
    renderList();
    validate();
    if (rerenderPanel) renderSide();
    paintStart();
    scheduleSave();
    o.onHistory();
  }

  function restore(snapshot: string) {
    const s = JSON.parse(snapshot) as { doc: EditModel; sel: number };
    doc = s.doc;
    sel = s.sel;
    coalesce = { key: '', at: 0 };
    afterChange(true);
    if (tab === 'display') viewport.updateDisplay(doc.display[slot] ?? null);
  }

  function undo() {
    const s = undoStack.pop();
    if (!s) return;
    redoStack.push(JSON.stringify({ doc, sel }));
    restore(s);
  }
  function redo() {
    const s = redoStack.pop();
    if (!s) return;
    undoStack.push(JSON.stringify({ doc, sel }));
    restore(s);
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    paintStatus('saving');
    saveTimer = setTimeout(() => save(), 450);
  }

  function info(): Omit<CustomModel, 'files' | 'originals' | 'updatedAt'> {
    return {
      kind,
      id: entry.id,
      model: plan.base,
      saved: plan.target,
      ...(kind === 'item' ? { option } : {}),
      ...(flatGui ? { flatGui: true } : {}),
      ...(kind === 'block' && siblings.length ? { everyVariant } : {}),
    };
  }

  function save() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = null;
    if (!changed || destroyed) {
      paintStatus();
      return;
    }
    store.saveModel(info(), planFiles(plan, modelText(doc)));
    paintStatus();
  }

  // ---------------------------------------------------------------- cube operations
  function addCube() {
    edit(() => {
      const e = newElement(doc);
      if (kind === 'item' && !doc.elements.length) {
        e.from = [6, 6, 7];
        e.to = [10, 10, 9];
      }
      sel = addElement(doc, e, sel + 1);
    });
    if (tab === 'model' || tab === 'display') setTab('cube');
  }
  function duplicate() {
    if (sel < 0) return;
    edit(() => (sel = duplicateElement(doc, sel)));
  }
  function remove() {
    if (sel < 0) return;
    edit(() => {
      deleteElement(doc, sel);
      sel = Math.min(sel, doc.elements.length - 1);
    });
  }
  function reorder(d: number) {
    if (sel < 0) return;
    edit(() => (sel = reorderElement(doc, sel, d)));
  }

  // handle drags: one undo step per drag, applied to a copy taken when it started
  let dragBase: EditModel | null = null;
  let dragRaf = 0;
  function startDrag() {
    if (sel < 0) return;
    pushUndo();
    dragBase = cloneModel(doc);
  }
  const snapTo = (v: number) => (snap > 0 ? Math.round(v / snap) * snap : Math.round(v * 100) / 100);
  function dragTo(t: Tool, axis: 0 | 1 | 2, sideSign: 1 | -1, delta: number) {
    if (!dragBase || sel < 0) return;
    doc = cloneModel(dragBase);
    const base = dragBase.elements[sel];
    if (t === 'move') {
      const d = snapTo(delta);
      const lo = Math.min(base.from[axis], base.to[axis]);
      const hi = Math.max(base.from[axis], base.to[axis]);
      const clamped = Math.max(-16 - lo, Math.min(32 - hi, d));
      const v: Vec3 = [0, 0, 0];
      v[axis] = clamped;
      moveElement(doc, sel, v);
    } else {
      const sideKey = sideSign > 0 ? 'to' : 'from';
      setExtent(doc, sel, axis, sideKey, Math.max(-16, Math.min(32, snapTo(base[sideKey][axis] + delta))));
    }
    changed = true;
    dragRaf ||= requestAnimationFrame(() => {
      dragRaf = 0;
      void refresh3d();
      if (tab === 'cube') renderSide();
      paintDragHint();
    });
  }
  function endDrag() {
    dragBase = null;
    stageHint.textContent = '';
    afterChange(true);
  }
  function paintDragHint() {
    const e = doc.elements[sel];
    if (!e) return;
    const s = sizeOf(e);
    stageHint.textContent = tool === 'move' ? fmt(tm.dragFrom, { values: e.from.map(fmtN).join(', ') }) : fmt(tm.dragSize, { values: s.map(fmtN).join(' × ') });
  }

  // ---------------------------------------------------------------- list
  function renderList() {
    cubeCount.textContent = String(doc.elements.length);
    const has = sel >= 0;
    dupBtn.disabled = !has;
    delBtn.disabled = !has;
    upBtn.disabled = !has || sel === 0;
    downBtn.disabled = !has || sel >= doc.elements.length - 1;
    if (!doc.elements.length) {
      cubeList.replaceChildren(h('li', { class: 'me-cubelist-empty faint small' }, tm.noCubesYet));
      return;
    }
    cubeList.replaceChildren(
      ...doc.elements.map((e, i) => {
        const s = sizeOf(e);
        const li = h(
          'li',
          { class: ['me-cuberow', i === sel && 'is-selected'], role: 'option', 'aria-selected': String(i === sel), tabIndex: i === sel ? 0 : -1, dataset: { index: String(i) } },
          h('span', { class: 'me-cuberow-icon' }, icon(e.rotation && (e.rotation.angle || e.rotation.x || e.rotation.y || e.rotation.z) ? 'reload' : 'box', { size: 16 })),
          h('span', { class: 'me-cuberow-name truncate' }, elementLabel(doc, i)),
          h('span', { class: 'me-cuberow-size' }, s.map(fmtN).join('×')),
        );
        li.addEventListener('click', () => {
          sel = i;
          syncSelection();
          renderList();
          if (tab === 'cubes' && isNarrow()) setTab('cube');
          else renderSide();
        });
        li.addEventListener('keydown', (ev) => {
          if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
            ev.preventDefault();
            sel = Math.max(0, Math.min(doc.elements.length - 1, sel + (ev.key === 'ArrowDown' ? 1 : -1)));
            syncSelection();
            renderList();
            renderSide();
            cubeList.querySelector<HTMLElement>('.is-selected')?.focus();
          }
        });
        return li;
      }),
    );
  }

  // ---------------------------------------------------------------- side panels
  function setTab(t: Tab, user = false) {
    if (t === 'cubes' && !isNarrow()) t = 'cube';
    const was = tab;
    tab = t;
    el.dataset.tab = t;
    sideTabs.setValue(t);
    if (t === 'display') {
      viewport.setDisplay(slotKey(slot), doc.display[slotKey(slot)] ?? null);
      paintSlots();
    } else if (was === 'display') viewport.setDisplay(null);
    slotBar.hidden = t !== 'display';
    views.hidden = t === 'display';
    stageTools.hidden = t === 'display';
    syncSelection();
    renderSide();
    paintStart();
    if (user && isPhone()) sideBody.scrollTop = 0;
  }

  /** Re-renders the open panel, keeping the focused field (and what is typed in it). */
  let rendering = false;
  function renderSide() {
    // a field that loses focus while the panel is replaced commits its value: that edit waits
    if (rendering) {
      queueMicrotask(() => renderSide());
      return;
    }
    rendering = true;
    try {
      renderSideNow();
    } finally {
      rendering = false;
    }
  }
  function renderSideNow() {
    const active = document.activeElement as HTMLInputElement | null;
    const key = active && sideBody.contains(active) ? active.dataset.key : undefined;
    const raw = active?.value;
    const start = active?.selectionStart ?? null;
    const end = active?.selectionEnd ?? null;
    const scroll = sideBody.scrollTop;
    // narrow screens show the cube list as a tab of its own
    if (tab === 'cubes') {
      sideBody.replaceChildren(cubesPanel);
      return;
    }
    if (cubesPanel.parentElement !== body) body.prepend(cubesPanel);
    const content = tab === 'cube' ? cubePanel() : tab === 'faces' ? facesPanel() : tab === 'display' ? displayPanel() : modelPanel();
    sideBody.replaceChildren(content);
    sideBody.scrollTop = scroll;
    if (key) {
      const next = sideBody.querySelector<HTMLInputElement>(`[data-key="${CSS.escape(key)}"]`);
      if (next) {
        if (raw !== undefined) next.value = raw;
        next.focus({ preventScroll: true });
        if (start !== null && end !== null) next.setSelectionRange(start, end);
      }
    }
  }

  const step = () => snap || 0.1;
  const noCube = () =>
    h(
      'div',
      { class: 'me-empty' },
      icon('box', { size: 32 }),
      h('p', null, doc.elements.length ? tm.pickCube : tm.noCubes),
      button({ label: tm.addCube, icon: 'plus', variant: 'secondary', size: 'sm', onClick: () => addCube() }),
    );

  function cubePanel(): HTMLElement {
    const e = doc.elements[sel];
    if (!e) return noCube();
    const i = sel;
    const name = h('input', { class: 'input me-name', type: 'text', value: e.name ?? '', placeholder: fmt(tr.cube, { n: i + 1 }), maxLength: 60, 'aria-label': tm.cubeName, dataset: { key: 'name' } });
    name.addEventListener('input', () => edit(() => (doc.elements[i].name = name.value.trim() || undefined), { key: `name:${i}`, panel: true }));
    const size = sizeOf(e);
    const pos = vecFields({ label: tm.position, hint: tm.positionHint, value: [...e.from], step, min: -16, max: 32, key: 'pos', onInput: (v, done) => edit(() => setPositionSize(doc, i, v, sizeOf(doc.elements[i])), { key: `pos:${i}`, panel: !done }) });
    const sz = vecFields({ label: tm.size, hint: tm.sizeHint, value: size, step, min: 0, max: 48, key: 'size', onInput: (v, done) => edit(() => setPositionSize(doc, i, [...doc.elements[i].from], v), { key: `size:${i}`, panel: !done }) });
    const out = h('div', { class: 'me-panel' }, h('div', { class: 'me-field' }, h('label', { class: 'me-field-label' }, tm.name), name), pos, sz, rotationSection(i));
    const shade = toggle({ label: tm.shading, value: e.shade !== false, description: tm.shadingHint, onChange: (v) => edit(() => (doc.elements[i].shade = v ? undefined : false)) });
    out.appendChild(section(tm.lighting, 'sun', shade));
    return out;
  }

  function rotationSection(i: number): HTMLElement {
    const e = doc.elements[i];
    const r = e.rotation;
    const free = !!r && !r.axis;
    const axisNow = !r ? 'none' : free ? 'free' : r.axis!;
    const axisOptions: { value: string; label: string }[] = [
      { value: 'none', label: tm.none },
      { value: 'x', label: 'X' },
      { value: 'y', label: 'Y' },
      { value: 'z', label: 'Z' },
    ];
    if (rules.rotation === 'free' || free) axisOptions.push({ value: 'free', label: 'XYZ' });
    const centre = (): Vec3 => [0, 1, 2].map((a) => (doc.elements[i].from[a] + doc.elements[i].to[a]) / 2) as Vec3;
    const axisSeg = segmented<string>({
      value: axisNow,
      size: 'sm',
      label: tm.rotationAxis,
      options: axisOptions,
      onChange: (v) =>
        edit(() => {
          const cur = doc.elements[i].rotation;
          const origin = cur?.origin ?? centre();
          if (v === 'none') setRotation(doc, i, null);
          else if (v === 'free') setRotation(doc, i, { origin, x: 0, y: cur?.angle ?? 0, z: 0, rescale: cur?.rescale });
          else setRotation(doc, i, { origin, axis: v as 'x' | 'y' | 'z', angle: allowedAngle(rules, cur?.angle ?? 22.5) || 22.5, rescale: cur?.rescale });
        }),
    });
    const parts: (Node | null)[] = [axisSeg];
    if (r && r.axis) {
      const a = r.angle ?? 0;
      if (rules.rotation === 'steps') {
        const valid = (ROTATION_STEPS as readonly number[]).includes(a);
        const opts = ROTATION_STEPS.map((s) => ({ value: String(s), label: `${s}°` }));
        if (!valid) opts.push({ value: String(a), label: fmt(tm.notAllowed, { angle: fmtN(a) }) });
        const seg = segmented<string>({ value: String(a), size: 'sm', label: tm.angle, options: opts, onChange: (v) => edit(() => (doc.elements[i].rotation!.angle = Number(v))) });
        seg.classList.add('me-angles');
        parts.push(h('div', { class: 'me-field' }, h('span', { class: 'me-field-label' }, tm.angle), seg, h('p', { class: 'me-field-note' }, fmt(tm.stepsNote, { version: project.version }))));
      } else {
        const lim = rules.rotation === 'range' ? 45 : 180;
        const f = numField({ label: '°', aria: tm.angleDegrees, value: a, step: () => (snap >= 1 ? 22.5 : 1), min: -lim, max: lim, key: 'angle', onInput: (v, done) => edit(() => (doc.elements[i].rotation!.angle = v), { key: `angle:${i}`, panel: !done }) });
        const presets = h('div', { class: 'me-chips' }, ...[-45, -22.5, 0, 22.5, 45].map((s) => chip(`${s}°`, a === s, () => edit(() => (doc.elements[i].rotation!.angle = s)))));
        parts.push(h('div', { class: 'me-field' }, h('span', { class: 'me-field-label' }, tm.angle), h('div', { class: 'me-angle-row' }, f, presets), rules.rotation === 'range' ? h('p', { class: 'me-field-note' }, fmt(tm.rangeNote, { version: project.version })) : null));
      }
    } else if (r && free) {
      parts.push(vecFields({ label: tm.angles, hint: tm.anglesHint, value: [r.x ?? 0, r.y ?? 0, r.z ?? 0], step: () => 1, min: -360, max: 360, key: 'euler', onInput: (v, done) => edit(() => Object.assign(doc.elements[i].rotation!, { x: v[0], y: v[1], z: v[2] }), { key: `euler:${i}`, panel: !done }) }));
    }
    if (r) {
      parts.push(
        vecFields({ label: tm.pivot, hint: tm.pivotHint, value: [...r.origin], step, min: -16, max: 32, key: 'origin', onInput: (v, done) => edit(() => (doc.elements[i].rotation!.origin = v), { key: `origin:${i}`, panel: !done }) }),
        h('div', { class: 'me-row' }, button({ label: tm.pivotCube, icon: 'target', variant: 'ghost', size: 'sm', onClick: () => edit(() => (doc.elements[i].rotation!.origin = centre())) }), button({ label: tm.pivotBlock, variant: 'ghost', size: 'sm', onClick: () => edit(() => (doc.elements[i].rotation!.origin = [8, 8, 8])) })),
        toggle({ label: tm.rescale, value: !!r.rescale, description: tm.rescaleHint, onChange: (v) => edit(() => (doc.elements[i].rotation!.rescale = v || undefined)) }),
      );
    }
    return section(tm.rotation, 'reload', ...parts);
  }

  function chip(label: string, on: boolean, fn: () => void): HTMLButtonElement {
    const b = h('button', { type: 'button', class: 'chip me-chip', 'aria-pressed': String(on) }, label);
    b.addEventListener('click', fn);
    return b;
  }

  // ---- faces
  const uvEditor = createUvEditor({
    snap: () => (snap > 0 ? snap : 0),
    onChange: (uv, final) => {
      if (sel < 0) return;
      const i = sel;
      const d = face;
      edit(() => setFace(doc, i, d, { uv: uv.map((v) => Math.round(v * 1000) / 1000) as UV4 }), { key: `uv:${i}:${d}`, panel: !final });
    },
  });
  offs.push(() => uvEditor.destroy());

  function faceTexturePath(f: EditFace | undefined): string | null {
    if (!f) return null;
    const { ref } = resolveTextureVar(doc.textures, f.texture.replace(/^#/, ''));
    return ref ? javaTexturePath(ref) : null;
  }

  async function uvImage(path: string | null): Promise<ImageData | null> {
    if (!path) return null;
    await loadTexture(path);
    const t = texCache.get(path);
    return t ? firstFrame(t) : null;
  }

  function facesPanel(): HTMLElement {
    const e = doc.elements[sel];
    if (!e) return noCube();
    const i = sel;
    const grid = h('div', { class: 'me-facegrid', role: 'radiogroup', 'aria-label': tm.faceLabel });
    for (const d of FACE_ORDER) {
      const b = h('button', { type: 'button', class: ['me-facebtn', !e.faces[d] && 'is-off'], role: 'radio', 'aria-checked': String(d === face), dataset: { face: d } }, tm.faces[d]);
      b.addEventListener('click', () => {
        face = d;
        syncSelection();
        renderSide();
      });
      grid.appendChild(b);
    }
    const f = e.faces[face];
    const out = h('div', { class: 'me-panel' }, grid);
    const on = toggle({
      label: fmt(tm.showFace, { face: tm.faceWords[face] }),
      value: !!f,
      description: f ? undefined : tm.hiddenFaces,
      onChange: (v) => edit(() => setFace(doc, i, face, v ? { texture: Object.values(doc.elements[i].faces).find(Boolean)?.texture ?? '#texture' } : null)),
    });
    out.appendChild(on);
    if (!f) return out;
    const path = faceTexturePath(f);
    const texName = path ? path.replace(/^.*\/textures\//, '').replace(/\.png$/, '') : tm.missingTexture;
    const thumb = h('canvas', { class: 'me-tex-thumb', 'aria-hidden': 'true' });
    const entryOf = path ? store.byPath.get(path) : undefined;
    if (entryOf) void thumbs.get(entryOf).then((img) => img && paintCanvas(thumb, img));
    const change = button({ label: tm.change, icon: 'images', variant: 'secondary', size: 'sm', onClick: () => pickTexture(i, face, path) });
    const paint = button({ label: tm.paint, icon: 'pencil', variant: 'ghost', size: 'sm', disabled: !path || (!store.assets.hasFile(path) && !store.isEdited(path)), onClick: () => path && paintTex(path) });
    tooltip(paint, tm.paintHint);
    out.appendChild(
      section(
        tm.texture,
        'image',
        h('div', { class: 'me-texrow' }, h('span', { class: 'me-tex-thumbbox checker' }, thumb), h('span', { class: 'me-tex-text' }, h('span', { class: 'me-tex-name truncate', title: texName }, texName), h('span', { class: 'me-tex-var' }, fmt(tm.variable, { name: f.texture })))),
        h('div', { class: 'me-row wrap' }, change, paint, button({ label: tm.everyFace, variant: 'ghost', size: 'sm', onClick: () => edit(() => DIRS.forEach((d) => doc.elements[i].faces[d] && setFace(doc, i, d, { texture: f.texture }))) })),
      ),
    );
    // UV
    const uv = effectiveUv(e, face);
    const auto = !f.uv;
    void uvImage(path).then((img) => {
      if (tab === 'faces' && sel === i) uvEditor.set(img, uv, auto);
    });
    uvEditor.set(null, uv, auto);
    const uvFields = h(
      'div',
      { class: 'me-vec me-vec4' },
      ...(['U1', 'V1', 'U2', 'V2'] as const).map((lbl, k) =>
        numField({
          label: lbl,
          aria: fmt(tm.uvLabel, { name: lbl }),
          value: uv[k],
          step,
          min: -16,
          max: 32,
          key: `uv.${k}`,
          onInput: (v, done) =>
            edit(() => {
              const next = [...effectiveUv(doc.elements[i], face)] as UV4;
              next[k] = v;
              setFace(doc, i, face, { uv: next });
            }, { key: `uvf:${i}:${face}`, panel: !done }),
        }),
      ),
    );
    const autoToggle = toggle({ label: tm.follow, value: auto, description: tm.followHint, onChange: (v) => edit(() => setFace(doc, i, face, { uv: v ? undefined : [...effectiveUv(doc.elements[i], face)] as UV4 })) });
    const tools = h(
      'div',
      { class: 'me-row wrap' },
      button({ label: tm.wholeTexture, variant: 'ghost', size: 'sm', onClick: () => edit(() => setFace(doc, i, face, { uv: [0, 0, 16, 16] })) }),
      iconButton('flip-h', tm.flipH, () => edit(() => { const u = effectiveUv(doc.elements[i], face); setFace(doc, i, face, { uv: [u[2], u[1], u[0], u[3]] }); }), { size: 'sm' }),
      iconButton('flip-v', tm.flipV, () => edit(() => { const u = effectiveUv(doc.elements[i], face); setFace(doc, i, face, { uv: [u[0], u[3], u[2], u[1]] }); }), { size: 'sm' }),
    );
    out.appendChild(section(tm.uvSection, 'crop', uvEditor.el, uvFields, tools, autoToggle));
    const rot = segmented<string>({ value: String(f.rotation ?? 0), size: 'sm', label: tm.textureRotation, options: ['0', '90', '180', '270'].map((v) => ({ value: v, label: `${v}°` })), onChange: (v) => edit(() => setFace(doc, i, face, { rotation: (Number(v) || undefined) as EditFace['rotation'] })) });
    const cull = select<string>({
      label: tm.cull,
      value: f.cullface ?? 'none',
      options: [{ value: 'none', label: tm.never }, ...DIRS.map((d) => ({ value: d, label: fmt(tm.whenBlock, { side: tm.faceWords[d] }) }))],
      description: tm.cullHint,
      onChange: (v) => edit(() => setFace(doc, i, face, { cullface: v === 'none' ? undefined : (v as Dir) })),
    });
    const tint = toggle({
      label: tm.tinted,
      value: f.tintindex !== undefined,
      description: kind === 'block' ? tm.tintBlock : tm.tintItem,
      onChange: (v) => edit(() => setFace(doc, i, face, { tintindex: v ? 0 : undefined })),
    });
    const tintIdx = f.tintindex !== undefined ? numField({ label: tm.index, aria: tm.tintIndex, value: f.tintindex, step: () => 1, min: 0, max: 15, key: 'tint', onInput: (v, done) => edit(() => setFace(doc, i, face, { tintindex: Math.round(v) }), { key: `tint:${i}:${face}`, panel: !done }) }) : null;
    out.appendChild(section(tm.faceLabel, 'square', h('div', { class: 'me-field' }, h('span', { class: 'me-field-label' }, tm.rotateTexture), rot), cull, tint, tintIdx));
    return out;
  }

  function pickTexture(i: number, d: Dir, current: string | null) {
    openTexturePicker({
      store,
      thumbs,
      inModel: Object.values(doc.textures).filter((v) => !v.startsWith('#')),
      newDir,
      current,
      onPick: ({ ref, path }) => {
        texCache.delete(path);
        texLoads.delete(path);
        edit(() => {
          const v = textureVarFor(doc, ref);
          setFace(doc, i, d, { texture: v });
        });
      },
    });
  }

  // ---- display
  const SLOTS: { slot: string; readonly label: string; ic: IconName }[] = (
    [
      ['gui', 'gui', 'grid'],
      ['firstperson_righthand', 'first', 'hand'],
      ['thirdperson_righthand', 'third', 'human'],
      ['ground', 'ground', 'leaf'],
      ['fixed', 'fixed', 'frame'],
      ['head', 'head', 'user'],
    ] as [string, keyof typeof tm.slots, IconName][]
  ).map(([slot, k, ic]) => ({
    slot,
    ic,
    get label() {
      return tm.slots[k];
    },
  }));
  const slotKey = (s: string) => (s === 'firstperson_righthand' || s === 'thirdperson_righthand' ? handSlot(rules, s) : s);

  function paintSlots() {
    slotBar.replaceChildren(
      ...SLOTS.map((s) => {
        const b = h('button', { type: 'button', class: 'me-slot', role: 'radio', 'aria-checked': String(s.slot === slot), dataset: { slot: s.slot } }, icon(s.ic, { size: 16 }), h('span', null, s.label));
        b.addEventListener('click', () => {
          slot = s.slot;
          viewport.setDisplay(slotKey(slot), doc.display[slotKey(slot)] ?? null);
          paintSlots();
          renderSide();
        });
        return b;
      }),
    );
  }

  function displayPanel(): HTMLElement {
    const key = slotKey(slot);
    const t = doc.display[key] ?? { rotation: [0, 0, 0], translation: [0, 0, 0], scale: [1, 1, 1] };
    const hand = /righthand$/.test(key);
    const now = () => cloneTransform(doc.display[key] ?? t);
    const apply = (next: DisplayTransform, done: boolean, part: string) =>
      edit(
        () => {
          setDisplay(doc, key, next);
          // the left hand mirrors the right one unless it is set on its own
          if (hand) delete doc.display[key.replace('right', 'left')];
          viewport.updateDisplay(doc.display[key] ?? null);
        },
        { key: `display:${key}:${part}`, panel: !done },
      );
    const out = h('div', { class: 'me-panel' });
    const chooser = h('div', { class: 'me-slotlist', role: 'radiogroup', 'aria-label': tm.displaySlot });
    for (const s of SLOTS) {
      const b = h('button', { type: 'button', class: ['chip', 'me-chip'], 'aria-pressed': String(s.slot === slot) }, icon(s.ic, { size: 16 }), h('span', null, s.label));
      b.addEventListener('click', () => {
        slot = s.slot;
        viewport.setDisplay(slotKey(slot), doc.display[slotKey(slot)] ?? null);
        paintSlots();
        renderSide();
      });
      chooser.appendChild(b);
    }
    out.appendChild(chooser);
    let uniform = t.scale[0] === t.scale[1] && t.scale[1] === t.scale[2];
    out.appendChild(
      section(
        slotName(key).replace(/^./, (c) => c.toUpperCase()),
        null,
        vecFields({ label: tm.rotationLabel, hint: tm.degrees, value: [...t.rotation], step: () => 15, min: -360, max: 360, key: 'drot', onInput: (v, done) => apply({ ...now(), rotation: v }, done, 'rot') }),
        vecFields({ label: tm.position, hint: tm.positionPixels, value: [...t.translation], step: () => (snap || 0.25), min: -80, max: 80, key: 'dpos', onInput: (v, done) => apply({ ...now(), translation: v }, done, 'pos') }),
        vecFields({
          label: tm.size,
          hint: tm.sizeNormal,
          value: [...t.scale],
          step: () => 0.05,
          min: -4,
          max: 4,
          key: 'dscale',
          onInput: (v, done) => {
            const cur = now();
            const changedAxis = v.findIndex((x, k) => x !== cur.scale[k]);
            const next: Vec3 = uniform && changedAxis >= 0 ? [v[changedAxis], v[changedAxis], v[changedAxis]] : v;
            apply({ ...cur, scale: next }, done, 'scale');
          },
        }),
        toggle({ label: tm.proportions, value: uniform, onChange: (v) => (uniform = v) }),
        h(
          'div',
          { class: 'me-row wrap' },
          button({ label: tm.gameDefault, icon: 'reset', variant: 'ghost', size: 'sm', onClick: () => edit(() => { setDisplay(doc, key, defaults[key] ?? null); viewport.updateDisplay(doc.display[key] ?? null); }) }),
          button({ label: tm.noChange, variant: 'ghost', size: 'sm', onClick: () => edit(() => { setDisplay(doc, key, null); viewport.updateDisplay(null); }) }),
        ),
        hand ? h('p', { class: 'me-field-note' }, tm.mirror) : null,
      ),
    );
    if (rules.guiLight && slot === 'gui') {
      out.appendChild(
        section(
          tm.inventoryLight,
          'sun',
          segmented<string>({ value: doc.guiLight ?? 'side', size: 'sm', label: tm.inventoryLight, options: [{ value: 'side', label: tm.fromSide }, { value: 'front', label: tm.fromFront }], onChange: (v) => edit(() => (doc.guiLight = v as 'side' | 'front')) }),
        ),
      );
    }
    return out;
  }

  // ---- model
  type Preset = { id: string; label: string; text: string; ic: IconName; run: () => EditModel | Promise<EditModel | null> };
  function presets(): Preset[] {
    const out: Preset[] = [];
    const layers = Object.keys(doc.textures).filter((k) => /^layer\d+$/.test(k)).sort();
    const p = tm.presets;
    if (kind === 'item' && layers.length) out.push({ id: 'sprite3d', label: p.sprite3d, text: p.sprite3dText, ic: 'sword', run: () => sprite3d(layers) });
    if (gameHasCubes) out.push({ id: 'game', label: p.game, text: p.gameText, ic: 'reset', run: () => gameModel() });
    out.push(
      { id: 'cube', label: p.cube, text: p.cubeText, ic: 'box', run: () => fullCube(doc) },
      { id: 'slab', label: p.slab, text: p.slabText, ic: 'flatten', run: () => slab(doc) },
      { id: 'cross', label: p.cross, text: p.crossText, ic: 'leaf', run: () => cross(doc) },
      { id: 'blank', label: p.blank, text: p.blankText, ic: 'square-dashed-cursor', run: () => blankModel(doc) },
    );
    return out;
  }

  async function sprite3d(layers: string[]): Promise<EditModel | null> {
    const inputs: SpriteLayerInput[] = [];
    for (const [n, k] of layers.entries()) {
      const { ref } = resolveTextureVar(doc.textures, k);
      if (!ref) continue;
      const path = javaTexturePath(ref);
      try {
        const full = await store.getFull(path);
        const frame = createImageData(full.width, Math.min(full.width, full.height));
        frame.data.set(full.data.subarray(0, frame.data.length));
        inputs.push({ texture: `#${k}`, image: frame, tintindex: n });
      } catch {
        /* a layer that can't be read is left out */
      }
    }
    if (!inputs.length) {
      toast(tm.spriteFailed, { tone: 'error' });
      return null;
    }
    const m = spriteTo3d(doc, inputs);
    // the sprite's own tints only matter where the game tints that layer
    return m;
  }

  function gameModelHasCubes(): boolean {
    return !!new JavaModelSet(files().vanilla).resolve(plan.source).elements?.length;
  }

  function gameModel(): EditModel {
    const f = files();
    // the game's own files, without the pack's changes
    const set = new JavaModelSet(f.vanilla);
    return modelFromResolved(set.resolve(plan.source), f.vanilla(modelPath(plan.source)));
  }

  async function applyPreset(p: Preset) {
    const next = await p.run();
    if (!next) return;
    edit(() => {
      doc = next;
      sel = doc.elements.length ? 0 : -1;
    });
    if (doc.elements.length && tab === 'model' && !isPhone()) setTab('cube');
    toast(fmt(tm.presetDone, { name: p.label, count: doc.elements.length }), { tone: 'success', duration: 1800 });
  }

  function presetButtons(compact: boolean): HTMLElement {
    return h(
      'div',
      { class: ['me-presets', compact && 'is-compact'] },
      ...presets().map((p) => {
        const b = h('button', { type: 'button', class: ['me-preset', p.id === 'sprite3d' && 'is-featured'], dataset: { preset: p.id } }, h('span', { class: 'me-preset-icon' }, icon(p.ic)), h('span', { class: 'me-preset-text' }, h('strong', null, p.label), compact ? null : h('span', { class: 'faint small' }, p.text)));
        if (compact) tooltip(b, p.text);
        b.addEventListener('click', () => void applyPreset(p));
        return b;
      }),
    );
  }

  function modelPanel(): HTMLElement {
    const out = h('div', { class: 'me-panel' });
    out.appendChild(section(tm.startFrom, 'magic-edit', presetButtons(false), h('p', { class: 'me-field-note' }, tm.undoable)));
    // in game
    const notes: Node[] = [];
    if (kind === 'item' && rules.itemDefinitions && plan.canFlatGui) {
      notes.push(
        toggle({
          label: tm.flatInventory,
          value: flatGui,
          description: tm.flatInventoryHint,
          onChange: (v) => {
            flatGui = v;
            replan();
          },
        }),
      );
    }
    if (kind === 'block' && siblings.length) {
      notes.push(
        toggle({
          label: tm.everyVariant,
          value: everyVariant,
          description: fmt(tm.everyVariantHint, { models: siblings.map(shortModelName).join(', ') }),
          onChange: (v) => {
            everyVariant = v;
            replan();
          },
        }),
      );
    }
    if (plan.replacesSpecial) notes.push(note('info', tm.replacesSpecial));
    else if (kind === 'item' && plan.source !== plan.base) notes.push(note('info', fmt(tm.showsModel, { model: shortModelName(plan.source) })));
    if (kind === 'block') {
      const others = usersOf(plan.base).filter((b) => b !== entry.id);
      if (others.length) {
        const names = others.slice(0, 4).map((b) => lib!.block(b)?.name ?? b).join(', ');
        notes.push(note('warning', fmt(tm.alsoUsedBy, { blocks: others.length > 4 ? fmt(tm.andMore, { list: names, count: others.length - 4 }) : names })));
      }
    }
    if (!rules.itemDefinitions && kind === 'item' && doc.extra.overrides) notes.push(note('info', tm.overrides));
    if (notes.length) out.appendChild(section(tm.inGame, 'gamepad', ...notes));
    // lighting
    const light: Node[] = [toggle({ label: tm.smoothLighting, value: doc.ambientOcclusion !== false, description: tm.smoothLightingHint, onChange: (v) => edit(() => (doc.ambientOcclusion = v ? undefined : false)) })];
    if (rules.guiLight)
      light.push(
        h(
          'div',
          { class: 'me-field' },
          h('span', { class: 'me-field-label' }, tm.inventoryLightLabel),
          segmented<string>({ value: doc.guiLight ?? 'side', size: 'sm', label: tm.inventoryLightLabel, options: [{ value: 'side', label: tm.side }, { value: 'front', label: tm.front }], onChange: (v) => edit(() => (doc.guiLight = v as 'side' | 'front')) }),
        ),
      );
    out.appendChild(section(tm.lighting, 'sun', ...light));
    // problems
    const list = h('ul', { class: 'me-issues' });
    if (!issues.length) list.appendChild(h('li', { class: 'me-issue is-ok' }, icon('check', { size: 16 }), h('span', null, fmt(tm.noProblems, { version: project.version }))));
    for (const is of issues) {
      const li = h('li', { class: ['me-issue', `is-${is.level}`] }, icon(is.level === 'error' ? 'error' : 'warning', { size: 16 }), h('span', null, is.message));
      if (is.element !== undefined) {
        li.classList.add('is-link');
        li.tabIndex = 0;
        li.setAttribute('role', 'button');
        const go = () => {
          sel = is.element!;
          if (is.face) face = is.face;
          setTab(is.face ? 'faces' : 'cube');
          renderList();
        };
        li.addEventListener('click', go);
        li.addEventListener('keydown', (e) => e.key === 'Enter' && go());
      }
      list.appendChild(li);
    }
    out.appendChild(section(tm.problems, 'warning', list));
    // files
    const fileList = Object.keys(planFiles(plan, ''));
    out.appendChild(
      section(
        tm.files,
        'file',
        h('ul', { class: 'me-files' }, ...fileList.map((p) => h('li', { class: 'truncate', title: p }, icon('file-text', { size: 16 }), h('span', null, p)))),
        h('p', { class: 'me-field-note' }, changed ? tm.savedHere : tm.notChanged),
        h(
          'div',
          { class: 'me-row wrap' },
          button({ label: tm.downloadJson, icon: 'download', variant: 'ghost', size: 'sm', onClick: () => saveBlob(new Blob([modelText(doc)], { type: 'application/json' }), `${shortModelName(plan.target).replace(/^.*\//, '')}.json`) }),
          button({ label: tm.bedrockGeometry, icon: 'download', variant: 'ghost', size: 'sm', onClick: () => downloadBedrock() }),
        ),
        changed ? button({ label: tm.putBack, icon: 'reset', variant: 'ghost', size: 'sm', class: 'me-danger', onClick: () => void resetModel() }) : null,
      ),
    );
    return out;
  }

  function note(ic: IconName, text: string): HTMLElement {
    return h('p', { class: ['tx-inline-note', 'me-note', ic === 'warning' && 'is-warning'] }, icon(ic), h('span', null, text));
  }

  let usersCache: Map<string, string[]> | null = null;
  function usersOf(model: string): string[] {
    usersCache ??= new Map();
    let hit = usersCache.get(model);
    if (!hit) {
      const f = files();
      const states = lib!.blocks().map((b) => [b.id, parseBlockstate(f.json(blockstatePath(b.id)))] as [string, ReturnType<typeof parseBlockstate>]);
      hit = blocksUsingModel(states, model);
      usersCache.set(model, hit);
    }
    return hit;
  }

  function replan() {
    const before = plan;
    plan = makePlan();
    if (before.target !== plan.target || JSON.stringify(before.definition) !== JSON.stringify(plan.definition) || JSON.stringify(before.blockstate) !== JSON.stringify(plan.blockstate)) {
      if (changed || existing().length) {
        changed = true;
        save();
      }
    }
    paintHeader();
    renderSide();
  }

  function downloadBedrock() {
    const geo = toBedrockGeometry(doc, `${entry.id}`);
    saveBlob(new Blob([JSON.stringify(geo, null, 2)], { type: 'application/json' }), `${entry.id}.geo.json`);
    toast(tm.bedrockDone, { duration: 6000 });
  }

  async function resetModel() {
    const ok = await confirmDialog(tm.putBackTitle, fmt(tm.putBackText, { model: shortModelName(plan.base) }), tm.putBackButton, true);
    if (!ok) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = null;
    store.resetModel(plan.base);
    changed = false;
    flatGui = false;
    // the library reads the pack's files again before the model is loaded back
    await new Promise((r) => setTimeout(r, 60));
    plan = makePlan();
    pushUndo();
    doc = gameModel();
    sel = doc.elements.length ? 0 : -1;
    void refresh3d();
    renderList();
    validate();
    renderSide();
    paintStart();
    paintHeader();
    changed = false;
    paintStatus();
    o.onHistory();
  }

  // ---------------------------------------------------------------- header, status, start
  function paintHeader() {
    titleSub.textContent = `${tm.kind[kind]} · ${shortModelName(plan.target)}.json`;
    choiceBox.replaceChildren();
    if (kind === 'block' && choices.length > 1) {
      const s = select<string>({
        value: chosen,
        options: choices.map((c) => ({ value: c.model, label: `${c.label || tm.model} · ${shortModelName(c.model).replace(/^.*\//, '')}` })),
        onChange: (v) => switchModel(() => (chosen = v)),
      });
      s.querySelector('select')?.setAttribute('aria-label', tm.blockModel);
      choiceBox.appendChild(s);
    }
    if (kind === 'item') {
      const looks = lib!.properties(entry).find((p) => p.name === 'model');
      if (looks && looks.values.length > 1) {
        const s = select<string>({ value: String(option), options: looks.values.map((v) => ({ value: v.value, label: v.label })), onChange: (v) => switchModel(() => (option = Number(v))) });
        s.querySelector('select')?.setAttribute('aria-label', tm.itemLook);
        choiceBox.appendChild(s);
      }
    }
  }

  function switchModel(fn: () => void) {
    save();
    fn();
    if (kind === 'item') {
      const mine = existing().find((m) => m.option === option);
      flatGui = mine?.flatGui ?? false;
      tintIndex = itemTints();
    } else everyVariant = existing().find((m) => m.model === chosen)?.everyVariant ?? true;
    plan = makePlan();
    doc = loadDoc();
    defaults = gameDisplay();
    gameHasCubes = gameModelHasCubes();
    changed = existing().some((m) => m.model === plan.base);
    sel = doc.elements.length ? 0 : -1;
    undoStack.length = 0;
    redoStack.length = 0;
    paintHeader();
    void refresh3d();
    renderList();
    validate();
    renderSide();
    paintStart();
    paintStatus();
    o.onHistory();
  }

  function paintStatus(state?: 'saving') {
    const errors = issues.filter((i) => i.level === 'error').length;
    const warnings = issues.length - errors;
    statusChip.className = `me-status ${errors ? 'is-error' : warnings ? 'is-warning' : 'is-ok'}`;
    const st = tm.status;
    const text = errors ? fmt(st.problems, { count: errors }) : warnings ? fmt(st.warnings, { count: warnings }) : state === 'saving' ? st.saving : changed ? st.saved : st.notChanged;
    statusChip.replaceChildren(icon(errors ? 'error' : warnings ? 'warning' : state === 'saving' ? 'clock' : 'check', { size: 16 }), h('span', null, text));
    statusChip.title = errors || warnings ? st.seeProblems : changed ? st.savedHere : st.gameModel;
  }

  function validate() {
    const hasTexture = (p: string) => store.assets.hasFile(p) || store.isEdited(p) || !!project.extraFiles[p];
    issues = validateModel(doc, { rules, hasTexture, atlasDirs: atlas[kind] });
    paintStatus(saveTimer ? 'saving' : undefined);
  }

  function paintStart() {
    const show = !doc.elements.length && tab !== 'display';
    startCard.hidden = !show;
    if (!show) return;
    startCard.replaceChildren(
      h('h3', { class: 'me-start-title' }, kind === 'item' && Object.keys(doc.textures).some((k) => /^layer\d+$/.test(k)) ? tm.flatSprite : tm.noCubesTitle),
      h('p', { class: 'faint small' }, tm.pickStart),
      presetButtons(true),
      button({ label: tm.addCube, icon: 'plus', variant: 'primary', size: 'sm', onClick: () => addCube() }),
    );
  }

  function openMore() {
    openMenu(moreBtn, [
      { label: tm.addCube, icon: 'plus', onClick: () => addCube() },
      { label: tm.downloadModel, icon: 'download', onClick: () => saveBlob(new Blob([modelText(doc)], { type: 'application/json' }), `${shortModelName(plan.target).replace(/^.*\//, '')}.json`) },
      { label: tm.downloadBedrock, icon: 'download', onClick: () => downloadBedrock() },
      { label: tm.keyboard, icon: 'keyboard', onClick: () => shortcuts() },
      { label: tm.putBack, icon: 'reset', danger: true, disabled: !changed, onClick: () => void resetModel() },
    ]);
  }

  function shortcuts() {
    openModal({
      title: tm.keysTitle,
      body: h(
        'dl',
        { class: 'me-keys' },
        ...[
          ['N', tm.keys.add],
          ['Ctrl + D', tm.keys.duplicate],
          [tm.keys.deleteKey, tm.keys.delete],
          ['M / R', tm.keys.handles],
          ['Ctrl + Z', tm.keys.undo],
          ['Ctrl + Shift + Z', tm.keys.redo],
          [tm.keys.fieldKeys, tm.keys.step],
          [tm.keys.dragKey, tm.keys.slide],
        ].flatMap(([k, v]) => [h('dt', null, h('kbd', { class: 'kbd' }, k)), h('dd', null, v)]),
      ),
    });
  }

  function paintTex(path: string) {
    save();
    o.paintTexture(path);
  }

  // ---------------------------------------------------------------- keys
  const onKey = (e: KeyboardEvent) => {
    if (destroyed || !el.isConnected || document.querySelector('dialog[open]')) return;
    const typing = e.target instanceof HTMLElement && !!e.target.closest('input, textarea, select, [contenteditable="true"]');
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (mod && !e.altKey && (k === 'z' || k === 'y')) {
      if (typing) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (k === 'y' || e.shiftKey) redo();
      else undo();
      return;
    }
    if (typing || e.altKey) return;
    if (mod && k === 'd') {
      e.preventDefault();
      duplicate();
    } else if (mod) return;
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (sel < 0) return;
      e.preventDefault();
      remove();
    } else if (k === 'n') {
      e.preventDefault();
      addCube();
    } else if (k === 'm' || k === 'r') {
      tool = k === 'm' ? 'move' : 'resize';
      toolSeg.setValue(tool);
      viewport.setTool(tool);
    }
  };
  window.addEventListener('keydown', onKey, true);
  offs.push(() => window.removeEventListener('keydown', onKey, true));

  // textures painted elsewhere, new textures
  offs.push(
    store.events.on('overrides', ({ path }) => {
      if (!texCache.has(path)) return;
      texCache.delete(path);
      texLoads.delete(path);
      void refresh3d();
    }),
  );
  const mq = matchMedia('(max-width: 1180px)');
  const onMq = () => {
    if (!mq.matches && tab === 'cubes') setTab('cube');
  };
  mq.addEventListener('change', onMq);
  offs.push(() => mq.removeEventListener('change', onMq));

  // atlases: which texture folders models can use (1.19.3+)
  void (async () => {
    const read = async (name: string) => {
      const path = `assets/minecraft/atlases/${name}.json`;
      try {
        if (project.extraFiles[path]) return parseJsonLoose(await project.extraFiles[path].text());
        return store.assets.hasFile(path) ? parseJsonLoose(await store.assets.readText(path)) : null;
      } catch {
        return null;
      }
    };
    const [b, it] = [await read('blocks'), await read('items')];
    atlas = { block: atlasDirsFrom([b]), item: atlasDirsFrom([b, it]) };
    if (!destroyed) {
      validate();
      if (tab === 'model') renderSide();
    }
  })();

  // ---------------------------------------------------------------- start
  paintHeader();
  validate();
  renderList();
  setTab(tab);
  void refresh3d();
  paintStatus();

  function close() {
    save();
    o.onClose();
  }

  return {
    el,
    undo,
    redo,
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    flush: () => save(),
    destroy() {
      if (destroyed) return;
      save();
      destroyed = true;
      if (dragRaf) cancelAnimationFrame(dragRaf);
      offs.forEach((f) => f());
      viewport.destroy();
      el.remove();
    },
    test: {
      doc: () => doc,
      plan: () => plan,
      select: (i: number) => {
        sel = i;
        syncSelection();
        renderList();
        renderSide();
      },
      viewport: () => viewport,
      issues: () => issues,
    },
  };
}

function fmtN(v: number): string {
  return String(Math.round(v * 1000) / 1000);
}

/** Normalised model id of a blockstate's model name (with the block/ folder before 1.13). */
function shortToId(model: string): string {
  const i = model.indexOf(':');
  const [ns, path] = i < 0 ? ['minecraft', model] : [model.slice(0, i) || 'minecraft', model.slice(i + 1)];
  return `${ns}:${path.includes('/') ? path : `block/${path}`}`;
}
