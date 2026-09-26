// Frame strip for animated textures: frame thumbnails, prev/next and a play preview that follows the
// .mcmeta / flipbook timing (1 game tick = 50 ms).

import { h } from '../../../ui/dom';
import { icon, setIcon } from '../../../ui/icons';
import { tooltip } from '../../../ui/components';
import { getFrame, type AnimInfo } from './meta';
import { paintCanvas } from './thumbs';

export interface FrameStrip {
  el: HTMLElement;
  set(full: ImageData | null, anim: AnimInfo | null, index: number): void;
  /** Repaint after an edit of the current frame */
  update(full: ImageData, index: number): void;
  destroy(): void;
}

const TICK_MS = 50;

export function createFrameStrip(onSelect: (i: number) => void): FrameStrip {
  let full: ImageData | null = null;
  let anim: AnimInfo | null = null;
  let current = 0;
  let playing = false;
  let raf = 0;

  const playGlyph = icon('play');
  const playBtn = h('button', { type: 'button', class: 'icon-btn sm tx-frames-play', 'aria-pressed': 'false', 'aria-label': 'Play animation' }, playGlyph);
  tooltip(playBtn, 'Play the animation');
  const preview = h('canvas', { class: 'tx-frames-preview pixelated', 'aria-hidden': 'true' });
  const info = h('span', { class: 'tx-frames-info' });
  const prev = h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': 'Previous frame (,)' }, icon('chevron-left'));
  const next = h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': 'Next frame (.)' }, icon('chevron-right'));
  tooltip(prev, 'Previous frame — ,');
  tooltip(next, 'Next frame — .');
  const list = h('div', { class: 'tx-frames-list', role: 'listbox', 'aria-label': 'Animation frames', 'aria-orientation': 'horizontal' });
  const el = h(
    'div',
    { class: 'tx-frames', hidden: true },
    h('div', { class: 'tx-frames-lead' }, h('div', { class: 'tx-frames-pv checker' }, preview), playBtn, h('div', { class: 'tx-frames-meta' }, h('span', { class: 'tx-frames-title' }, 'Animation'), info)),
    prev,
    list,
    next,
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

  const paintInfo = () => {
    if (!anim) return;
    info.textContent = `Frame ${current + 1} of ${anim.count} · ${anim.frametime} tick${anim.frametime === 1 ? '' : 's'}`;
    list.querySelectorAll<HTMLElement>('.tx-frame').forEach((b, i) => {
      b.setAttribute('aria-selected', String(i === current));
      b.tabIndex = i === current ? 0 : -1;
    });
  };

  const paintPreview = (i: number) => {
    if (!full || !anim) return;
    paintCanvas(preview, getFrame(full, anim, i));
    const m = Math.max(anim.frameW, anim.frameH);
    const s = m <= 40 ? Math.floor(40 / m) : 40 / m;
    preview.style.width = `${Math.round(anim.frameW * s)}px`;
    preview.style.height = `${Math.round(anim.frameH * s)}px`;
  };

  const stop = () => {
    playing = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    setIcon(playGlyph, 'play');
    playBtn.setAttribute('aria-pressed', 'false');
    playBtn.setAttribute('aria-label', 'Play animation');
    paintPreview(current);
  };

  const play = () => {
    if (!anim) return;
    playing = true;
    setIcon(playGlyph, 'pause');
    playBtn.setAttribute('aria-pressed', 'true');
    playBtn.setAttribute('aria-label', 'Pause animation');
    let step = 0;
    let due = performance.now();
    const loop = (t: number) => {
      if (!playing || !anim) return;
      if (t >= due) {
        const s = anim.sequence[step % anim.sequence.length];
        paintPreview(s.index);
        due = t + Math.max(1, s.time) * TICK_MS;
        step++;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  };

  playBtn.addEventListener('click', () => (playing ? stop() : play()));
  prev.addEventListener('click', () => anim && select((current - 1 + anim.count) % anim.count));
  next.addEventListener('click', () => anim && select((current + 1) % anim.count));
  list.addEventListener('keydown', (e) => {
    if (!anim) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const i = (current + (e.key === 'ArrowRight' ? 1 : -1) + anim.count) % anim.count;
      select(i);
      (list.children[i] as HTMLElement | undefined)?.focus();
    }
  });

  function select(i: number) {
    if (!anim || i === current) return;
    current = i;
    paintInfo();
    if (!playing) paintPreview(i);
    (list.children[i] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    onSelect(i);
  }

  return {
    el,
    set(f, a, index) {
      stop();
      full = f;
      anim = a;
      current = index;
      el.hidden = !a || !f;
      list.replaceChildren();
      if (!a || !f) return;
      for (let i = 0; i < a.count; i++) {
        const c = h('canvas', { class: 'pixelated', 'aria-hidden': 'true' });
        paintThumb(c, i);
        const b = h('button', { type: 'button', class: 'tx-frame checker', role: 'option', 'aria-label': `Frame ${i + 1}` }, c, h('span', { class: 'tx-frame-n' }, String(i + 1)));
        b.addEventListener('click', () => select(i));
        list.appendChild(b);
      }
      paintInfo();
      paintPreview(index);
    },
    update(f, index) {
      full = f;
      const b = list.children[index] as HTMLElement | undefined;
      const c = b?.querySelector('canvas');
      if (c) paintThumb(c, index);
      if (!playing) paintPreview(current);
    },
    destroy() {
      stop();
    },
  };
}
