// The stamp tool's options in the options bar: the stamp being placed (a button that opens the list
// of presets and saved stamps), turning and flipping it, and "Save selection as stamp" (also shown
// with the select tool). The picked stamp and how it is turned are remembered in this browser.

import './stamps.css';
import type { PixelCanvas, StampKey } from '../../../shared/pixel-canvas';
import { h } from '../../../ui/dom';
import { icon } from '../../../ui/icons';
import { iconButton, openPopover, tooltip, type PopoverHandle } from '../../../ui/components';
import { toast } from '../../../ui/toast';
import { fmt } from '../../../i18n/editor-text';
import { paintCanvas } from '../ui/thumbs';
import { createImageData } from '../../../core/pixels';
import { byPointer } from '../ui/media';
import type { StampLibrary } from './library';
import { NO_TRANSFORM, PRESET_IDS, presetImage, stepTransform, transformStamp, trimStamp, STAMP_MAX, type PresetId, type RGBA, type StampTransform } from './stamps';
import { ts } from './i18n/text';

export interface StampControls {
  /** The stamp tool's options (the options bar shows it while the tool is on) */
  el: HTMLElement;
  /** "Save selection as stamp" for the select tool */
  saveChip: HTMLElement;
  /** The canvas was made (or its main colour changed): give it the stamp */
  sync(): void;
  /** R / H on the canvas with the stamp tool */
  step(k: StampKey): void;
  /** Saves the canvas's selection as a stamp (true when saved) */
  saveSelection(): boolean;
  destroy(): void;
}

type Pick = { kind: 'preset'; id: PresetId } | { kind: 'saved'; id: string };

const PICK_KEY = 'to-tex-stamp';

function readPick(): { pick: Pick; t: StampTransform } {
  try {
    const v = JSON.parse(localStorage.getItem(PICK_KEY) ?? 'null') as { pick?: Pick; t?: StampTransform } | null;
    const pick = v?.pick && (v.pick.kind === 'saved' ? typeof v.pick.id === 'string' : PRESET_IDS.includes(v.pick.id as PresetId)) ? v.pick : null;
    const t = v?.t && Number.isInteger(v.t.turns) ? { turns: v.t.turns, flipX: !!v.t.flipX, flipY: !!v.t.flipY } : NO_TRANSFORM;
    if (pick) return { pick, t };
  } catch {
    /* storage blocked */
  }
  return { pick: { kind: 'preset', id: 'ore' }, t: NO_TRANSFORM };
}

export function createStampControls(getCanvas: () => PixelCanvas | null, library: StampLibrary): StampControls {
  let { pick, t } = readPick();
  let pop: PopoverHandle | null = null;
  let lastColor = '';

  const remember = () => {
    try {
      localStorage.setItem(PICK_KEY, JSON.stringify({ pick, t }));
    } catch {
      /* storage blocked */
    }
  };

  const mainColor = (): RGBA => (getCanvas()?.color as RGBA | undefined) ?? [91, 211, 91, 255];
  /** The picked stamp as it is saved (null: a saved stamp that is gone) */
  const baseImage = (p: Pick): ImageData | null => (p.kind === 'preset' ? presetImage(p.id, mainColor()) : library.image(p.id));
  const nameOf = (p: Pick): string => (p.kind === 'preset' ? ts.names[p.id] : (library.get(p.id)?.name ?? ''));

  // ---------------------------------------------------------------- the options bar
  const thumb = h('canvas', { class: 'tx-st-thumb pixelated', 'aria-hidden': 'true' });
  const label = h('span', { class: 'tx-st-label truncate' });
  const btn = h('button', { type: 'button', class: 'chip tx-opt-chip tx-st-btn', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' }, h('span', { class: 'tx-st-thumbbox checker' }, thumb), label, icon('chevron-down', { size: 16 }));
  tooltip(btn, ts.choose);
  btn.addEventListener('click', () => togglePanel());
  const rotate = iconButton('rotate', byPointer(ts.rotate, ts.rotateTouch), () => step('rotate'), { size: 'sm' });
  const flipH = iconButton('flip-h', byPointer(ts.flipH, ts.flipHTouch), () => step('flipH'), { size: 'sm' });
  const flipV = iconButton('flip-v', byPointer(ts.flipV, ts.flipVTouch), () => step('flipV'), { size: 'sm' });
  const el = h('div', { class: 'tx-opt tx-st-opts', hidden: true }, btn, rotate, flipH, flipV);

  const saveChip = h('button', { type: 'button', class: 'chip tx-opt-chip tx-st-savechip', hidden: true }, icon('sticker', { size: 16 }), h('span', null, ts.save));
  tooltip(saveChip, ts.saveHint);
  saveChip.addEventListener('click', () => saveSelection());

  /** Gives the canvas the picked stamp, turned as it is, and shows it on the button. */
  function apply() {
    let base = baseImage(pick);
    if (!base) {
      pick = { kind: 'preset', id: 'ore' };
      t = NO_TRANSFORM;
      base = baseImage(pick)!;
    }
    const img = transformStamp(base, t);
    getCanvas()?.setStamp(img);
    paintCanvas(thumb, img);
    label.textContent = nameOf(pick);
    btn.setAttribute('aria-label', fmt(ts.current, { name: nameOf(pick) }));
    lastColor = mainColor().join(',');
  }

  function step(k: StampKey) {
    t = stepTransform(t, k);
    remember();
    apply();
  }

  function choose(p: Pick) {
    pick = p;
    t = NO_TRANSFORM;
    remember();
    apply();
    pop?.close();
    const pc = getCanvas();
    if (pc) {
      pc.setTool('stamp');
      pc.focus();
    }
  }

  function saveSelection(): boolean {
    const pc = getCanvas();
    const sel = pc?.getSelection();
    if (!pc || !sel) {
      toast(ts.saveHint, { tone: 'info' });
      return false;
    }
    if (sel.w > STAMP_MAX || sel.h > STAMP_MAX) {
      toast(ts.tooBig, { tone: 'warn' });
      return false;
    }
    // what shows there (every layer), cut to its pixels
    const crop = createImageData(sel.w, sel.h);
    for (let y = 0; y < sel.h; y++) for (let x = 0; x < sel.w; x++) crop.data.set(pc.getShownPixel(sel.x + x, sel.y + y), (y * sel.w + x) * 4);
    const img = trimStamp(crop);
    if (!img) {
      toast(ts.empty, { tone: 'info' });
      return false;
    }
    const rec = library.add(img, fmt(ts.stampName, { n: library.all().length + 1 }));
    toast(fmt(ts.saved, { name: rec.name }), { tone: 'success' });
    pick = { kind: 'saved', id: rec.id };
    t = NO_TRANSFORM;
    remember();
    apply();
    // (a selection would keep the stamp inside it)
    pc.deselect();
    pc.setTool('stamp');
    return true;
  }

  // ---------------------------------------------------------------- the list
  function tile(p: Pick, img: ImageData | null, name: string, extra?: HTMLElement): HTMLElement {
    const c = h('canvas', { class: 'tx-st-tileimg pixelated', 'aria-hidden': 'true' });
    if (img) paintCanvas(c, img);
    // big enough to see, whole pixels where they fit
    const fit = img ? Math.max(1, Math.floor(40 / Math.max(img.width, img.height))) : 1;
    if (img) {
      c.style.width = `${img.width * fit}px`;
      c.style.height = `${img.height * fit}px`;
    }
    const on = p.kind === pick.kind && p.id === pick.id;
    const b = h('button', { type: 'button', class: 'tx-st-tile', 'aria-pressed': String(on), dataset: { stamp: `${p.kind}:${p.id}` } }, h('span', { class: 'tx-st-tilebox checker' }, c), h('span', { class: 'tx-st-tilename' }, name));
    if (img) tooltip(b, `${name} · ${fmt(ts.size, { width: img.width, height: img.height })}`);
    b.addEventListener('click', () => choose(p));
    return h('div', { class: 'tx-st-cell' }, b, extra ?? null);
  }

  function panel(): HTMLElement {
    const color = mainColor();
    const presets = h('div', { class: 'tx-st-grid' }, PRESET_IDS.map((id) => tile({ kind: 'preset', id }, presetImage(id, color), ts.names[id])));
    const saved = library.all().map((r) => {
      const del = h('button', { type: 'button', class: 'tx-st-del', 'aria-label': fmt(ts.delete, { name: r.name }) }, icon('close', { size: 16 }));
      tooltip(del, fmt(ts.delete, { name: r.name }));
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        const gone = library.remove(r.id);
        if (!gone) return;
        if (pick.kind === 'saved' && pick.id === r.id) {
          pick = { kind: 'preset', id: 'ore' };
          t = NO_TRANSFORM;
          remember();
          apply();
        }
        refresh();
        toast(fmt(ts.deleted, { name: r.name }), { tone: 'success', action: { label: ts.undo, onClick: () => { library.restore(gone); refresh(); } } });
      });
      return tile({ kind: 'saved', id: r.id }, library.image(r.id), r.name, del);
    });
    const sel = getCanvas()?.getSelection();
    const save = h('button', { type: 'button', class: 'btn btn-secondary btn-sm tx-st-save', disabled: !sel }, icon('sticker'), h('span', { class: 'btn-label' }, ts.save));
    if (!sel) tooltip(save, ts.saveHint);
    save.addEventListener('click', () => {
      if (saveSelection()) pop?.close();
    });
    return h(
      'div',
      { class: 'tx-st-panel' },
      h('h3', { class: 'tx-st-head' }, ts.presets),
      presets,
      h('p', { class: 'faint small tx-st-note' }, ts.presetsHint),
      h('h3', { class: 'tx-st-head' }, ts.yours),
      saved.length ? h('div', { class: 'tx-st-grid' }, saved) : h('p', { class: 'faint small tx-st-note' }, ts.none),
      save,
      h('p', { class: 'tx-st-hint' }, byPointer(ts.hint, ts.hintTouch)),
      h('p', { class: 'faint small tx-st-note' }, ts.kept),
    );
  }

  function refresh() {
    if (!pop?.open) return;
    const body = pop.el.querySelector('.tx-st-panel');
    body?.replaceWith(panel());
  }

  function togglePanel() {
    if (pop?.open) {
      pop.close();
      return;
    }
    btn.setAttribute('aria-expanded', 'true');
    pop = openPopover(btn, panel(), { placement: 'top-start', label: ts.title, class: 'tx-st-pop', focus: true, onClose: () => btn.setAttribute('aria-expanded', 'false') });
  }

  const offLib = library.events.on('change', () => {
    if (pick.kind === 'saved' && !library.get(pick.id)) apply();
  });

  return {
    el,
    saveChip,
    sync() {
      // presets follow the main colour
      if (pick.kind === 'preset' && mainColor().join(',') !== lastColor) apply();
      else if (!getCanvas()?.stamp) apply();
    },
    step,
    saveSelection,
    destroy() {
      pop?.close();
      offLib();
    },
  };
}
