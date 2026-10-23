// The Layers button over the canvas and the layers panel it opens: the open texture's layers, top
// first, with show / hide and lock, a thumbnail and the name (double-click or the ⋯ menu renames
// it); opacity and blend mode of the selected layer; new, duplicate, merge down, move, delete, and
// in the ⋯ menu flatten and a new layer from the game's texture. Layers are dragged to a new place
// with a mouse (buttons move them on touch screens); with the list focused, arrows select, Alt+arrows
// move, F2 renames. A texture starts as one layer, and the panel stays closed until it is wanted.

import './layers.css';
import { h } from '../../../ui/dom';
import { icon, setIcon } from '../../../ui/icons';
import { iconButton, openMenu, tooltip } from '../../../ui/components';
import { fmt } from '../../../i18n/editor-text';
import { isTouch } from '../ui/media';
import { tl } from './i18n/text';
import type { LayerSession } from './session';
import {
  LAYER_BLENDS,
  addLayer,
  canMergeDown,
  duplicateLayer,
  flattenStack,
  makeLayer,
  mergeDown,
  moveLayer,
  nextLayerName,
  removeLayer,
  updateLayer,
  type Area,
  type LayerBlend,
  type LayerStack,
  type PaintLayer,
} from './stack';
import { createImageData } from '../../../core/pixels';
import { thumbContext } from '../ui/thumbs';

export interface LayersPanelOptions {
  /** The open texture's layers; `create`: make them (one layer) when the texture has none yet */
  session(create: boolean): LayerSession | null;
  /** The game's texture at the open texture's size, for a layer to trace over (null: none) */
  gameImage(): ImageData | null;
  /** The area of the layers the pixel editor shows (an animation frame) */
  area(): Area;
  /** The texture is animated (the note says layers go through every frame) */
  animated(): boolean;
  /** The open texture's pixels (the thumbnail of its one layer, before it has layers) */
  texture(): ImageData | null;
}

export interface LayersPanel {
  /** The Layers button (goes over the canvas, top right) */
  button: HTMLButtonElement;
  /** The panel (goes over the canvas; a sheet at the bottom on phones) */
  el: HTMLElement;
  /** Another texture or frame is open, or its layers changed: draw them again */
  refresh(): void;
  /** Pixels of the active layer changed: its thumbnail */
  paintActive(): void;
  /** Shown or hidden (the pack icon has no layers) */
  setAvailable(on: boolean): void;
  setOpen(open: boolean): void;
  readonly open: boolean;
}

const OPEN_KEY = 'to-tex-layers-open';
/** Pixels the pointer moves before a press on a layer becomes a drag */
const DRAG_SLOP = 5;

export function createLayersPanel(opts: LayersPanelOptions): LayersPanel {
  let open = false;
  let available = true;
  let renaming: { id: string; input: HTMLInputElement } | null = null;

  // ---------------------------------------------------------------- button
  const btnLabel = h('span', { class: 'tx-pl-btn-label truncate' }, tl.button);
  const btnCount = h('span', { class: 'tx-pl-btn-count', hidden: true });
  const button = h('button', { type: 'button', class: 'tx-pl-btn', 'aria-expanded': 'false', 'aria-label': tl.button }, icon('layers'), btnLabel, btnCount) as HTMLButtonElement;
  tooltip(button, tl.buttonHint);
  button.addEventListener('click', () => setOpen(!open));

  // ---------------------------------------------------------------- panel
  const addBtn = iconButton('plus', tl.add, () => add(), { size: 'sm', class: 'tx-pl-add' });
  const closeBtn = iconButton('close', tl.close, () => setOpen(false), { size: 'sm', class: 'tx-pl-close' });
  const list = h('div', { class: 'tx-pl-list', role: 'listbox', 'aria-label': tl.list });
  const marker = h('span', { class: 'tx-pl-drop', 'aria-hidden': 'true', hidden: true });
  const listBox = h('div', { class: 'tx-pl-listbox' }, list, marker);

  const opacity = h('input', { type: 'range', class: 'range tx-mini-range tx-pl-opacity', min: 0, max: 100, step: 1, value: 100, 'aria-label': tl.opacity });
  const opacityVal = h('output', { class: 'tx-pl-opacity-val' }, '100%');
  const blend = h('select', { class: 'select-input tx-pl-blend', 'aria-label': tl.blend });
  tooltip(opacity, tl.opacity);
  tooltip(blend, tl.blend);
  // one row: blend mode, then opacity (the slider and its value say what they are)
  const props = h('div', { class: 'tx-pl-props' }, h('span', { class: 'select tx-pl-select' }, blend, icon('chevron-down', { class: 'select-chevron' })), opacity, opacityVal);

  const dupBtn = iconButton('copy', tl.duplicate, () => duplicate(), { size: 'sm' });
  const mergeBtn = iconButton('git-merge', tl.mergeDown, () => merge(), { size: 'sm', class: 'tx-pl-merge' });
  const upBtn = iconButton('arrow-up', tl.moveUp, () => move(1), { size: 'sm' });
  const downBtn = iconButton('arrow-down', tl.moveDown, () => move(-1), { size: 'sm' });
  const delBtn = iconButton('trash', tl.delete, () => remove(), { size: 'sm', class: 'tx-pl-delete' });
  const moreBtn = iconButton('more-horizontal', tl.more, () => menu(), { size: 'sm', class: 'tx-pl-more' });
  moreBtn.setAttribute('aria-haspopup', 'menu');
  const note = h('p', { class: 'tx-pl-note' });

  const el = h(
    'section',
    { class: 'tx-pl', hidden: true, 'aria-label': tl.title },
    h('header', { class: 'tx-pl-head' }, h('h3', { class: 'tx-pl-title' }, icon('layers', { size: 16 }), tl.title), addBtn, closeBtn),
    listBox,
    props,
    h('div', { class: 'tx-pl-foot', role: 'toolbar', 'aria-label': tl.more }, dupBtn, mergeBtn, upBtn, downBtn, delBtn, h('span', { class: 'grow' }), moreBtn),
    note,
  );
  // Painting shortcuts stay with the canvas; the panel's own keys are handled here.
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !renaming && !document.querySelector('.menu')) {
      e.stopPropagation();
      setOpen(false);
      button.focus();
    }
  });

  try {
    open = localStorage.getItem(OPEN_KEY) === '1';
  } catch {
    /* storage blocked */
  }

  // ---------------------------------------------------------------- actions
  const session = () => opts.session(false);
  const stack = (): LayerStack | null => session()?.stack ?? null;
  /** Index in the stack of the n-th row (rows are top first) */
  const indexOfRow = (s: LayerStack, row: number) => s.layers.length - 1 - row;
  const baseName = (n: number) => fmt(tl.layerName, { n });

  function add() {
    const se = opts.session(true);
    if (!se) return;
    const s = se.stack;
    const { width, height } = s.layers[0].image;
    se.apply(addLayer(s, makeLayer(nextLayerName(s, baseName), createImageData(width, height)), s.active + 1));
    setOpen(true);
  }
  function duplicate() {
    const se = opts.session(true);
    if (!se) return;
    const s = se.stack;
    se.apply(duplicateLayer(s, s.active, fmt(tl.copyName, { name: s.layers[s.active].name }).slice(0, 80)));
  }
  function merge() {
    const se = session();
    if (!se || !canMergeDown(se.stack, se.stack.active)) return;
    se.apply(mergeDown(se.stack, se.stack.active));
  }
  function move(d: 1 | -1) {
    const se = session();
    if (!se) return;
    const i = se.stack.active;
    if (i + d < 0 || i + d >= se.stack.layers.length) return;
    se.apply(moveLayer(se.stack, i, i + d));
  }
  function remove() {
    const se = session();
    if (!se || se.stack.layers.length < 2) return;
    se.apply(removeLayer(se.stack, se.stack.active));
  }
  function patch(i: number, p: Parameters<typeof updateLayer>[2]) {
    const se = opts.session(true);
    if (!se) return;
    se.apply(updateLayer(se.stack, i, p));
  }
  function fromGame() {
    const se = opts.session(true);
    const img = opts.gameImage();
    if (!se || !img) return;
    // at the bottom, locked: something to trace over that is never painted by mistake
    se.apply(addLayer(se.stack, makeLayer(tl.gameName, img, { locked: true }), 0, true));
    setOpen(true);
  }
  function flatten() {
    const se = session();
    if (!se || se.stack.layers.length < 2) return;
    se.apply(flattenStack(se.stack, baseName(1)));
  }
  function menu() {
    const s = stack();
    const n = s?.layers.length ?? 1;
    const i = s?.active ?? 0;
    const a = s?.layers[i];
    openMenu(
      moreBtn,
      [
        { label: tl.rename, icon: 'pen-square', onClick: () => startRename(a?.id ?? null) },
        { label: a?.locked ? tl.unlock : tl.lock, icon: a?.locked ? 'unlock' : 'lock', onClick: () => patch(i, { locked: !a?.locked }) },
        { label: tl.fromGame, icon: 'image', disabled: !opts.gameImage(), onClick: () => fromGame() },
        { label: tl.flatten, icon: 'flatten', disabled: n < 2, onClick: () => flatten() },
      ],
      { label: tl.more, placement: 'top-end' },
    );
  }

  // ---------------------------------------------------------------- renaming
  function startRename(id: string | null) {
    if (!id) {
      // a texture with no layers yet: its one layer gets a record first
      const se = opts.session(true);
      id = se?.stack.layers[0].id ?? null;
      render();
    }
    const row = list.querySelector<HTMLElement>(`.tx-plr[data-id="${id}"]`);
    const name = row?.querySelector<HTMLElement>('.tx-plr-name');
    const s = stack();
    const layer = s?.layers.find((l) => l.id === id);
    if (!row || !name || !layer) return;
    const input = h('input', { type: 'text', class: 'input tx-plr-input', value: layer.name, maxLength: 80, 'aria-label': tl.nameLabel, spellcheck: false });
    renaming = { id: layer.id, input };
    name.replaceWith(input);
    input.focus();
    input.select();
    let done = false;
    const finish = (keep: boolean) => {
      if (done) return;
      done = true;
      renaming = null;
      const v = input.value.trim().slice(0, 80);
      const se = session();
      const k = se?.stack.layers.findIndex((l) => l.id === layer.id) ?? -1;
      if (keep && se && k >= 0 && v && v !== se.stack.layers[k].name) se.apply(updateLayer(se.stack, k, { name: v }));
      else render();
      list.querySelector<HTMLElement>(`.tx-plr[data-id="${layer.id}"]`)?.focus();
    };
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') finish(true);
      else if (e.key === 'Escape') finish(false);
    });
    input.addEventListener('blur', () => finish(true));
    input.addEventListener('pointerdown', (e) => e.stopPropagation());
    input.addEventListener('click', (e) => e.stopPropagation());
  }

  // ---------------------------------------------------------------- opacity and blend
  let slideFrom: LayerStack | null = null;
  opacity.addEventListener('input', () => {
    const se = opts.session(true);
    if (!se) return;
    slideFrom ??= se.stack;
    const v = Number(opacity.value) / 100;
    paintOpacity(v);
    se.apply(updateLayer(slideFrom, slideFrom.active, { opacity: v }), { live: true });
  });
  opacity.addEventListener('change', () => {
    const se = session();
    const from = slideFrom;
    slideFrom = null;
    if (!se || !from) return;
    se.apply(updateLayer(from, from.active, { opacity: Number(opacity.value) / 100 }), { from });
  });
  const paintOpacity = (v: number) => {
    opacityVal.textContent = `${Math.round(v * 100)}%`;
    opacity.style.setProperty('--fill', `${v * 100}%`);
  };
  blend.addEventListener('change', () => {
    const s = stack() ?? opts.session(true)?.stack;
    if (s) patch(s.active, { blend: blend.value as LayerBlend });
  });

  // ---------------------------------------------------------------- the list
  const thumbs = new Map<string, HTMLCanvasElement>();

  function paintThumb(c: HTMLCanvasElement, l: Pick<PaintLayer, 'image'>) {
    const a = opts.area();
    if (c.width !== a.w) c.width = a.w;
    if (c.height !== a.h) c.height = a.h;
    const ctx = thumbContext(c);
    if (!ctx) return;
    ctx.clearRect(0, 0, a.w, a.h);
    // (only the frame being painted, without copying it out)
    ctx.putImageData(l.image, -a.x, -a.y, a.x, a.y, a.w, a.h);
    const m = Math.max(a.w, a.h);
    const s = m <= 32 ? Math.floor(32 / m) : 32 / m;
    c.style.width = `${Math.max(1, Math.round(a.w * s))}px`;
    c.style.height = `${Math.max(1, Math.round(a.h * s))}px`;
  }

  /** The texture's one layer, before it has layers of its own */
  function plainRows(): { layers: Pick<PaintLayer, 'id' | 'name' | 'hidden' | 'locked' | 'opacity' | 'blend'>[]; active: number } {
    return { layers: [{ id: '', name: baseName(1), hidden: false, locked: false, opacity: 1, blend: 'normal' }], active: 0 };
  }

  function tagsOf(l: Pick<PaintLayer, 'hidden' | 'locked' | 'opacity' | 'blend'>): string {
    const parts: string[] = [];
    if (l.blend !== 'normal') parts.push(tl.blends[l.blend]);
    if (l.opacity < 1) parts.push(`${Math.round(l.opacity * 100)}%`);
    return parts.join(' · ');
  }

  function render() {
    if (!available) return;
    const s = stack();
    const view = s ?? plainRows();
    const n = view.layers.length;
    const active = view.layers[view.active];
    // button
    btnCount.hidden = n < 2;
    btnCount.textContent = n < 2 ? '' : String(n);
    btnLabel.textContent = n < 2 ? tl.button : active.name;
    button.classList.toggle('has-layers', n > 1);
    const hint = n < 2 ? tl.buttonHint : fmt(tl.buttonActive, { count: n, name: active.name });
    button.setAttribute('aria-label', n < 2 ? tl.button : hint);
    tooltip(button, hint);
    if (!open) return;
    // rows, top first
    const touch = isTouch();
    thumbs.clear();
    const rows: HTMLElement[] = [];
    for (let row = 0; row < n; row++) {
      const i = n - 1 - row;
      const l = view.layers[i];
      const selected = i === view.active;
      const eye = h('button', { type: 'button', class: 'icon-btn sm tx-plr-eye', 'aria-pressed': String(!l.hidden), 'aria-label': l.hidden ? tl.show : tl.hide }, icon(l.hidden ? 'eye-off' : 'eye'));
      tooltip(eye, l.hidden ? tl.show : tl.hide);
      eye.addEventListener('click', (e) => {
        e.stopPropagation();
        patch(i, { hidden: !l.hidden });
      });
      const lock = h('button', { type: 'button', class: ['icon-btn sm tx-plr-lock', l.locked && 'is-on'], 'aria-pressed': String(l.locked), 'aria-label': l.locked ? tl.unlock : tl.lock }, icon(l.locked ? 'lock' : 'unlock'));
      tooltip(lock, l.locked ? tl.unlock : tl.lock);
      lock.addEventListener('click', (e) => {
        e.stopPropagation();
        patch(i, { locked: !l.locked });
      });
      const c = h('canvas', { class: 'pixelated', 'aria-hidden': 'true' });
      const layer = s?.layers[i];
      if (layer) {
        paintThumb(c, layer);
        thumbs.set(layer.id, c);
      } else {
        const img = opts.texture();
        if (img) paintThumb(c, { image: img });
      }
      const tags = tagsOf(l);
      const item = h(
        'div',
        {
          class: ['tx-plr', selected && 'is-active', l.hidden && 'is-hidden'],
          role: 'option',
          'aria-selected': String(selected),
          tabIndex: selected ? 0 : -1,
          dataset: { i: String(i), id: l.id },
          title: touch ? undefined : tl.rowHint,
        },
        eye,
        h('span', { class: 'tx-plr-thumb checker' }, c),
        h('span', { class: 'tx-plr-text' }, h('span', { class: 'tx-plr-name truncate' }, l.name), tags || l.hidden ? h('span', { class: 'tx-plr-tags' }, [l.hidden ? tl.hiddenTag : '', tags].filter(Boolean).join(' · ')) : null),
        lock,
      );
      item.addEventListener('click', () => select(i));
      item.addEventListener('dblclick', (e) => {
        if ((e.target as HTMLElement).closest('button')) return;
        startRename(l.id || null);
      });
      rows.push(item);
    }
    list.replaceChildren(...rows);
    // selected layer's settings and actions
    const a = view.layers[view.active];
    if (slideFrom === null) {
      opacity.value = String(Math.round(a.opacity * 100));
      paintOpacity(a.opacity);
    }
    blend.replaceChildren(...LAYER_BLENDS.map((b) => h('option', { value: b }, tl.blends[b])));
    blend.value = a.blend;
    const i = view.active;
    dupBtn.disabled = false;
    mergeBtn.disabled = !s || !canMergeDown(s, i);
    upBtn.disabled = i >= n - 1;
    downBtn.disabled = i <= 0;
    delBtn.disabled = n < 2;
    // (what layers become, while there's room for it: one layer)
    note.hidden = n > 1;
    note.textContent = opts.animated() ? tl.noteFrames : tl.note;
  }

  function select(i: number) {
    const se = session();
    if (!se) return;
    se.select(i);
    list.querySelector<HTMLElement>(`.tx-plr[data-i="${i}"]`)?.focus();
  }

  list.addEventListener('keydown', (e) => {
    const s = stack();
    if (!s || renaming) return;
    const i = s.active;
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.altKey) {
      e.preventDefault();
      move(e.key === 'ArrowUp' ? 1 : -1);
      list.querySelector<HTMLElement>('.tx-plr.is-active')?.focus();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const k = i + (e.key === 'ArrowUp' ? 1 : -1);
      if (k >= 0 && k < s.layers.length) select(k);
    } else if (e.key === 'F2') {
      e.preventDefault();
      startRename(s.layers[i].id);
    }
  });

  // ---------------------------------------------------------------- dragging layers (mouse)
  let drag: { from: number; y0: number; on: boolean; to: number; id: number } | null = null;
  /** Row slot a layer dropped at clientY goes to (0 = above the top row) */
  const dropSlot = (y: number): number => {
    const items = [...list.querySelectorAll<HTMLElement>('.tx-plr')];
    for (let r = 0; r < items.length; r++) {
      const b = items[r].getBoundingClientRect();
      if (y < b.top + b.height / 2) return r;
    }
    return items.length;
  };
  const showMarker = (slot: number) => {
    const items = [...list.querySelectorAll<HTMLElement>('.tx-plr')];
    const ref = items[Math.min(slot, items.length - 1)];
    if (!ref) return;
    const r = ref.getBoundingClientRect();
    const y = slot >= items.length ? r.bottom : r.top;
    marker.style.top = `${y - listBox.getBoundingClientRect().top - 1}px`;
    marker.hidden = false;
  };
  list.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || renaming) return;
    const t = e.target as HTMLElement;
    const b = t.closest<HTMLElement>('.tx-plr');
    if (!b || t.closest('button, input')) return;
    drag = { from: Number(b.dataset.i), y0: e.clientY, on: false, to: -1, id: e.pointerId };
  });
  list.addEventListener('pointermove', (e) => {
    const s = stack();
    if (!drag || e.pointerId !== drag.id || !s) return;
    if (!drag.on) {
      if (Math.abs(e.clientY - drag.y0) < DRAG_SLOP) return;
      drag.on = true;
      list.setPointerCapture(e.pointerId);
      list.classList.add('is-dragging');
      list.querySelector<HTMLElement>(`.tx-plr[data-i="${drag.from}"]`)?.classList.add('is-dragged');
    }
    const slot = dropSlot(e.clientY);
    const fromRow = s.layers.length - 1 - drag.from;
    const toRow = slot > fromRow ? slot - 1 : slot;
    drag.to = indexOfRow(s, toRow);
    showMarker(slot);
    const lr = list.getBoundingClientRect();
    if (e.clientY < lr.top + 20) list.scrollTop -= 8;
    else if (e.clientY > lr.bottom - 20) list.scrollTop += 8;
  });
  const endDrag = (commit: boolean) => {
    const d = drag;
    drag = null;
    marker.hidden = true;
    list.classList.remove('is-dragging');
    list.querySelector('.is-dragged')?.classList.remove('is-dragged');
    const se = session();
    if (d?.on && commit && se && d.to >= 0 && d.to !== d.from) se.apply(moveLayer(se.stack, d.from, d.to));
    return !!d?.on;
  };
  list.addEventListener('pointerup', () => {
    if (!endDrag(true)) return;
    // a drag isn't a click on the layer (the click, if any, comes right after this event)
    const swallow = (ev: Event) => ev.stopPropagation();
    list.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => list.removeEventListener('click', swallow, { capture: true }), 0);
  });
  list.addEventListener('pointercancel', () => endDrag(false));

  // ---------------------------------------------------------------- open / close
  function setOpen(v: boolean) {
    open = v && available;
    el.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    button.classList.toggle('is-open', open);
    setIcon(button.querySelector<HTMLElement>('.icon')!, 'layers');
    try {
      localStorage.setItem(OPEN_KEY, open ? '1' : '0');
    } catch {
      /* storage blocked */
    }
    if (open) {
      render();
      requestAnimationFrame(() => list.querySelector<HTMLElement>('.tx-plr.is-active')?.scrollIntoView({ block: 'nearest' }));
    }
  }

  let thumbRaf = 0;
  return {
    button,
    el,
    refresh: () => {
      if (renaming) return;
      render();
    },
    paintActive() {
      if (!open || thumbRaf) return;
      thumbRaf = requestAnimationFrame(() => {
        thumbRaf = 0;
        const a = session()?.active;
        const c = a ? thumbs.get(a.id) : list.querySelector<HTMLCanvasElement>('.tx-plr canvas');
        const img = a?.image ?? opts.texture();
        if (c && img) paintThumb(c, { image: img });
      });
    },
    setAvailable(on) {
      available = on;
      button.hidden = !on;
      if (!on) el.hidden = true;
      else setOpen(open);
    },
    setOpen,
    get open() {
      return open;
    },
  };
}
