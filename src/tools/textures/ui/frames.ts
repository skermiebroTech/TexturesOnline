// Frame strip for animated textures: frame thumbnails, prev/next, a play preview at game speed
// (1 game tick = 50 ms, blended like the game when the animation blends) and the animation maker's
// tools: add a frame, onion skin, timing and a menu of frame actions. Frames are dragged to a new
// place with a mouse (the menu moves them on touch screens); with the list focused, Alt+arrows move
// the selected frame, Delete deletes it and Ctrl+C / Ctrl+V copy and paste frames.

import { h } from '../../../ui/dom';
import { icon, setIcon } from '../../../ui/icons';
import { tooltip } from '../../../ui/components';
import { getFrame, type AnimInfo } from './meta';
import { paintCanvas } from './thumbs';
import { fmt } from '../../../i18n/editor-text';
import { te } from './i18n/editor';
import { ta } from '../anim/i18n/text';
import { createPlayer } from '../anim/player';
import { isTouch } from './media';

export type OnionMode = 'off' | 'prev' | 'both';

export interface FrameStripActions {
  select(i: number): void;
  /** Adds a frame after the selected one (a copy of it) */
  add(): void;
  move(from: number, to: number): void;
  remove(i: number): void;
  copy(i: number): void;
  paste(i: number): void;
  /** Opens the strip's menu of frame actions */
  menu(anchor: HTMLElement): void;
  timing(): void;
  onion(): void;
}

export interface FrameStripOptions {
  /** Frames can be added, moved and timed (false: a strip the game doesn't animate) */
  editable: boolean;
  /** How the game blends frames when the animation blends */
  blend: 'rgba' | 'rgb';
}

export interface FrameStrip {
  el: HTMLElement;
  set(full: ImageData | null, anim: AnimInfo | null, index: number, opts?: FrameStripOptions): void;
  /** Repaint after an edit of the current frame */
  update(full: ImageData, index: number): void;
  setOnion(mode: OnionMode): void;
  destroy(): void;
}

/** Pixels the pointer moves before a press on a frame becomes a drag */
const DRAG_SLOP = 5;

export function createFrameStrip(actions: FrameStripActions): FrameStrip {
  let full: ImageData | null = null;
  let anim: AnimInfo | null = null;
  let current = 0;
  let opts: FrameStripOptions = { editable: false, blend: 'rgba' };
  let frames: ImageData[] = [];

  const playGlyph = icon('play');
  const playBtn = h('button', { type: 'button', class: 'icon-btn sm tx-frames-play', 'aria-pressed': 'false', 'aria-label': te.canvas.play }, playGlyph);
  tooltip(playBtn, te.canvas.playHint);
  const preview = h('canvas', { class: 'tx-frames-preview pixelated', 'aria-hidden': 'true' });
  const info = h('span', { class: 'tx-frames-info' });
  const prev = h('button', { type: 'button', class: 'icon-btn sm tx-frames-step tx-frames-prev', 'aria-label': te.canvas.prevFrame }, icon('chevron-left'));
  const next = h('button', { type: 'button', class: 'icon-btn sm tx-frames-step tx-frames-next', 'aria-label': te.canvas.nextFrame }, icon('chevron-right'));
  tooltip(prev, te.canvas.prevFrameKey);
  tooltip(next, te.canvas.nextFrameKey);
  const list = h('div', { class: 'tx-frames-list', role: 'listbox', 'aria-label': te.canvas.animationFrames, 'aria-orientation': 'horizontal' });
  const title = h('span', { class: 'tx-frames-title' }, te.canvas.animation);

  const addBtn = h('button', { type: 'button', class: 'tx-frame-add', 'aria-label': ta.strip.add }, icon('plus'));
  tooltip(addBtn, ta.strip.addHint);
  addBtn.addEventListener('click', () => actions.add());
  const onionBtn = h('button', { type: 'button', class: 'icon-btn sm tx-frames-onion', 'aria-pressed': 'false', 'aria-label': ta.strip.onion }, icon('images'));
  tooltip(onionBtn, ta.strip.onionHint);
  onionBtn.addEventListener('click', () => actions.onion());
  const timingBtn = h('button', { type: 'button', class: 'icon-btn sm tx-frames-timing', 'aria-label': ta.strip.timing }, icon('clock'));
  tooltip(timingBtn, ta.strip.timingHint);
  timingBtn.addEventListener('click', () => actions.timing());
  const moreBtn = h('button', { type: 'button', class: 'icon-btn sm tx-frames-more', 'aria-label': ta.strip.more, 'aria-haspopup': 'menu' }, icon('more-horizontal'));
  tooltip(moreBtn, ta.strip.more);
  moreBtn.addEventListener('click', () => actions.menu(moreBtn));
  const tools = h('div', { class: 'tx-frames-tools' }, onionBtn, timingBtn, moreBtn);
  /** Where a dragged frame would go */
  const marker = h('span', { class: 'tx-frames-drop', 'aria-hidden': 'true', hidden: true });
  const track = h('div', { class: 'tx-frames-track' }, list, addBtn, marker);

  const el = h(
    'div',
    { class: 'tx-frames', hidden: true },
    h('div', { class: 'tx-frames-lead' }, h('div', { class: 'tx-frames-pv checker' }, preview), playBtn, h('div', { class: 'tx-frames-meta' }, title, info)),
    prev,
    track,
    next,
    tools,
  );

  const thumbSize = (a: AnimInfo) => {
    const m = Math.max(a.frameW, a.frameH);
    return m <= 32 ? Math.floor(32 / m) : 32 / m;
  };

  const paintThumb = (c: HTMLCanvasElement, i: number) => {
    if (!full || !anim) return;
    paintCanvas(c, getFrame(full, anim, i));
    const s = thumbSize(anim);
    c.style.width = `${Math.round(anim.frameW * s)}px`;
    c.style.height = `${Math.round(anim.frameH * s)}px`;
  };

  /** Ticks frame i shows for (the first time it plays) */
  const timeOf = (i: number) => anim?.sequence.find((s) => s.index === i)?.time ?? anim?.frametime ?? 1;

  const paintInfo = () => {
    if (!anim) return;
    info.textContent = anim.still ? fmt(te.canvas.frameOf, { n: current + 1, count: anim.count }) : fmt(te.canvas.frameOfTicks, { n: current + 1, count: anim.count, ticks: timeOf(current) });
    list.querySelectorAll<HTMLElement>('.tx-frame').forEach((b, i) => {
      b.setAttribute('aria-selected', String(i === current));
      b.tabIndex = i === current ? 0 : -1;
    });
  };

  const sizePreview = () => {
    if (!anim) return;
    const m = Math.max(anim.frameW, anim.frameH);
    const s = m <= 40 ? Math.floor(40 / m) : 40 / m;
    preview.style.width = `${Math.round(anim.frameW * s)}px`;
    preview.style.height = `${Math.round(anim.frameH * s)}px`;
  };
  const paintPreview = (i: number) => {
    if (!full || !anim) return;
    paintCanvas(preview, getFrame(full, anim, i));
    sizePreview();
  };

  const player = createPlayer(
    (img) => paintCanvas(preview, img),
    (on) => {
      setIcon(playGlyph, on ? 'pause' : 'play');
      playBtn.setAttribute('aria-pressed', String(on));
      playBtn.setAttribute('aria-label', on ? te.canvas.pause : te.canvas.play);
      if (!on) paintPreview(current);
    },
  );
  const source = () => (anim && full ? { frames, steps: anim.sequence, interpolate: !!anim.interpolate && !anim.still, blend: opts.blend } : null);

  playBtn.addEventListener('click', () => {
    if (player.playing) player.stop();
    else {
      player.set(source());
      player.play();
    }
  });
  prev.addEventListener('click', () => anim && select((current - 1 + anim.count) % anim.count));
  next.addEventListener('click', () => anim && select((current + 1) % anim.count));
  list.addEventListener('keydown', (e) => {
    if (!anim) return;
    const mod = e.ctrlKey || e.metaKey;
    if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && e.altKey && opts.editable) {
      e.preventDefault();
      const to = current + (e.key === 'ArrowRight' ? 1 : -1);
      if (to >= 0 && to < anim.count) actions.move(current, to);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const i = (current + (e.key === 'ArrowRight' ? 1 : -1) + anim.count) % anim.count;
      select(i);
      (list.children[i] as HTMLElement | undefined)?.focus();
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && opts.editable) {
      e.preventDefault();
      actions.remove(current);
    } else if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'c' && opts.editable) {
      e.preventDefault();
      e.stopPropagation();
      actions.copy(current);
    } else if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'v' && opts.editable) {
      e.preventDefault();
      e.stopPropagation();
      actions.paste(current);
    }
  });

  function select(i: number) {
    if (!anim || i === current) return;
    current = i;
    paintInfo();
    if (!player.playing) paintPreview(i);
    (list.children[i] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    actions.select(i);
  }

  // ---------------------------------------------------------------- dragging frames (mouse)
  let drag: { from: number; x0: number; y0: number; on: boolean; to: number; id: number } | null = null;
  /** Place a frame dropped at clientX goes to */
  const dropIndex = (x: number): number => {
    const items = [...list.querySelectorAll<HTMLElement>('.tx-frame')];
    let slot = items.length;
    for (let i = 0; i < items.length; i++) {
      const r = items[i].getBoundingClientRect();
      if (x < r.left + r.width / 2) {
        slot = i;
        break;
      }
    }
    return slot;
  };
  const showMarker = (slot: number) => {
    const items = [...list.querySelectorAll<HTMLElement>('.tx-frame')];
    const ref = items[Math.min(slot, items.length - 1)];
    if (!ref) return;
    const r = ref.getBoundingClientRect();
    const x = slot >= items.length ? r.right + 2 : r.left - 3;
    marker.style.left = `${x - track.getBoundingClientRect().left}px`;
    marker.hidden = false;
  };
  list.addEventListener('pointerdown', (e) => {
    if (!opts.editable || e.pointerType !== 'mouse' || e.button !== 0) return;
    const b = (e.target as HTMLElement).closest<HTMLElement>('.tx-frame');
    if (!b) return;
    drag = { from: Number(b.dataset.i), x0: e.clientX, y0: e.clientY, on: false, to: -1, id: e.pointerId };
  });
  list.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.on) {
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < DRAG_SLOP) return;
      drag.on = true;
      list.setPointerCapture(e.pointerId);
      list.classList.add('is-dragging');
      list.querySelector<HTMLElement>(`.tx-frame[data-i="${drag.from}"]`)?.classList.add('is-dragged');
    }
    const slot = dropIndex(e.clientX);
    drag.to = slot > drag.from ? slot - 1 : slot;
    showMarker(slot);
    // near the ends: scroll the list along
    const lr = list.getBoundingClientRect();
    if (e.clientX < lr.left + 24) list.scrollLeft -= 8;
    else if (e.clientX > lr.right - 24) list.scrollLeft += 8;
  });
  const endDrag = (commit: boolean) => {
    const d = drag;
    drag = null;
    marker.hidden = true;
    list.classList.remove('is-dragging');
    list.querySelector('.is-dragged')?.classList.remove('is-dragged');
    if (d?.on && commit && d.to >= 0 && d.to !== d.from) actions.move(d.from, d.to);
    return !!d?.on;
  };
  list.addEventListener('pointerup', () => {
    // a drag isn't a click on the frame
    if (endDrag(true)) list.addEventListener('click', (ev) => ev.stopPropagation(), { capture: true, once: true });
  });
  list.addEventListener('pointercancel', () => endDrag(false));

  return {
    el,
    set(f, a, index, o) {
      player.stop();
      full = f;
      anim = a;
      current = index;
      if (o) opts = o;
      if (a?.still) opts = { ...opts, editable: false };
      el.hidden = !a || !f;
      el.classList.toggle('is-editable', opts.editable);
      tools.hidden = !opts.editable;
      addBtn.hidden = !opts.editable;
      list.replaceChildren();
      frames = [];
      if (!a || !f) return;
      frames = Array.from({ length: a.count }, (_, i) => getFrame(f, a, i));
      title.textContent = a.still ? te.canvas.framesTitle : te.canvas.animation;
      const own = (i: number) => {
        const t = timeOf(i);
        return t !== a.frametime ? t : null;
      };
      const touch = isTouch();
      for (let i = 0; i < a.count; i++) {
        const c = h('canvas', { class: 'pixelated', 'aria-hidden': 'true' });
        paintThumb(c, i);
        const t = opts.editable ? own(i) : null;
        const badge = t !== null ? h('span', { class: 'tx-frame-time', title: fmt(ta.strip.ownTime, { ticks: t }) }, String(t)) : null;
        const b = h(
          'button',
          { type: 'button', class: 'tx-frame checker', role: 'option', 'aria-label': fmt(te.canvas.frame, { n: i + 1 }), dataset: { i: String(i) }, title: opts.editable && !touch ? fmt(ta.strip.frameDrag, { n: i + 1 }) : undefined },
          c,
          h('span', { class: 'tx-frame-n' }, String(i + 1)),
          badge,
        );
        b.addEventListener('click', () => select(i));
        list.appendChild(b);
      }
      paintInfo();
      paintPreview(index);
      requestAnimationFrame(() => (list.children[index] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
    },
    update(f, index) {
      full = f;
      const b = list.querySelector<HTMLElement>(`.tx-frame[data-i="${index}"]`);
      const c = b?.querySelector('canvas');
      if (c) paintThumb(c, index);
      if (anim) frames[index] = getFrame(f, anim, index);
      if (player.playing) player.set(source());
      else paintPreview(current);
    },
    setOnion(mode) {
      onionBtn.setAttribute('aria-pressed', String(mode !== 'off'));
      onionBtn.classList.toggle('is-both', mode === 'both');
    },
    destroy() {
      player.stop();
    },
  };
}
