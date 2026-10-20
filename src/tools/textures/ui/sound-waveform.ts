// Waveform of an edited sound with start / end trim handles (drag them, or focus one and use the
// arrow keys) and a playhead. The waveform is drawn at the chosen volume, so clipping shows in red.

import { h } from '../../../ui/dom';
import { peakOf, waveformPeaks, MIN_LENGTH } from '../sounds/render';
import type { Samples } from '../sounds/audio';
import { fmt as fmtText, num, textLocale } from '../../../i18n/editor-text';
import { ts } from './i18n/sounds';

export interface WaveformApi {
  el: HTMLElement;
  set(s: Samples, start: number, end: number, gain: number): void;
  setRange(start: number, end: number): void;
  setGain(gain: number): void;
  setPlayhead(t: number | null): void;
  destroy(): void;
}

export interface WaveformOptions {
  /** While dragging */
  onInput?(start: number, end: number): void;
  /** Drag released / key pressed */
  onCommit(start: number, end: number): void;
  label: string;
}

/** Seconds with two decimals in the page's language: "2.50 s" / "2,50 s" */
const fmt = (t: number) => fmtText(ts.wave.seconds, { value: textLocale() === 'en' ? t.toFixed(2) : num(t, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) });

export function createWaveform(opts: WaveformOptions): WaveformApi {
  const canvas = h('canvas', { class: 'snd-wave-canvas', 'aria-hidden': 'true' });
  const shadeL = h('div', { class: 'snd-wave-shade is-left' });
  const shadeR = h('div', { class: 'snd-wave-shade is-right' });
  const head = h('div', { class: 'snd-wave-playhead', hidden: true });
  const mkHandle = (which: 'start' | 'end') =>
    h(
      'div',
      {
        class: ['snd-wave-handle', `is-${which}`],
        role: 'slider',
        tabIndex: 0,
        'aria-label': fmtText(which === 'start' ? ts.wave.start : ts.wave.end, { label: opts.label }),
        'aria-orientation': 'horizontal',
        dataset: { which },
      },
      h('span', { class: 'snd-wave-grip', 'aria-hidden': 'true' }),
    );
  const hStart = mkHandle('start');
  const hEnd = mkHandle('end');
  const stage = h('div', { class: 'snd-wave-stage' }, canvas, shadeL, shadeR, head, hStart, hEnd);
  const tStart = h('span', null, fmt(0));
  const tLen = h('strong', null, '');
  const tEnd = h('span', null, '');
  const el = h('div', { class: 'snd-wave' }, stage, h('div', { class: 'snd-wave-times', 'aria-hidden': 'true' }, tStart, tLen, tEnd));

  let samples: Samples | null = null;
  let duration = 1;
  let start = 0;
  let end = 1;
  let gain = 1;
  let peaks: Float32Array | null = null;
  let peaksFor = '';

  const x = (t: number) => `${(t / duration) * 100}%`;

  function paintRange() {
    shadeL.style.width = x(start);
    shadeR.style.left = x(end);
    hStart.style.left = x(start);
    hEnd.style.left = x(end);
    for (const [hd, v, min, max] of [
      [hStart, start, 0, end - MIN_LENGTH],
      [hEnd, end, start + MIN_LENGTH, duration],
    ] as const) {
      hd.setAttribute('aria-valuemin', min.toFixed(2));
      hd.setAttribute('aria-valuemax', max.toFixed(2));
      hd.setAttribute('aria-valuenow', v.toFixed(2));
      hd.setAttribute('aria-valuetext', `${v.toFixed(2)} seconds`);
    }
    tStart.textContent = fmt(start);
    tEnd.textContent = fmt(end);
    tLen.textContent = `${(end - start).toFixed(2)} s of ${duration.toFixed(2)} s`;
  }

  function colors() {
    const cs = getComputedStyle(el);
    return {
      wave: cs.getPropertyValue('--tool-accent').trim() || '#5bd75b',
      dim: cs.getPropertyValue('--text-3').trim() || '#888',
      clip: cs.getPropertyValue('--red').trim() || '#e5484d',
      mid: cs.getPropertyValue('--border').trim() || '#444',
    };
  }

  function draw() {
    const w = Math.max(1, Math.round(canvas.clientWidth * devicePixelRatio));
    const hgt = Math.max(1, Math.round(canvas.clientHeight * devicePixelRatio));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== hgt) canvas.height = hgt;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, hgt);
    const c = colors();
    const mid = hgt / 2;
    ctx.fillStyle = c.mid;
    ctx.fillRect(0, Math.floor(mid), w, Math.max(1, Math.round(devicePixelRatio)));
    if (!samples) return;
    // one bar per 2 device pixels keeps the pixel look and stays fast for long sounds
    const step = Math.max(1, Math.round(2 * devicePixelRatio));
    const cols = Math.ceil(w / step);
    const key = `${cols}`;
    if (!peaks || peaksFor !== key) {
      peaks = waveformPeaks(samples.channels, cols);
      peaksFor = key;
    }
    const a = (start / duration) * w;
    const b = (end / duration) * w;
    for (let i = 0; i < cols; i++) {
      const lo = peaks[i * 2] * gain;
      const hi = peaks[i * 2 + 1] * gain;
      const px = i * step;
      const inside = px + step > a && px < b;
      const clipped = inside && (hi > 1 || lo < -1);
      ctx.fillStyle = clipped ? c.clip : inside ? c.wave : c.dim;
      const top = mid - Math.min(1, hi) * (mid - 1);
      const bot = mid - Math.max(-1, lo) * (mid - 1);
      ctx.fillRect(px, Math.floor(top), Math.max(1, step - Math.round(devicePixelRatio * 0.5)), Math.max(1, Math.ceil(bot - top)));
    }
  }

  // ---- dragging ----
  let drag: { which: 'start' | 'end'; id: number } | null = null;
  const timeAt = (clientX: number) => {
    const r = stage.getBoundingClientRect();
    return Math.max(0, Math.min(duration, ((clientX - r.left) / Math.max(1, r.width)) * duration));
  };
  const move = (which: 'start' | 'end', t: number) => {
    if (which === 'start') start = Math.max(0, Math.min(t, end - MIN_LENGTH));
    else end = Math.min(duration, Math.max(t, start + MIN_LENGTH));
    paintRange();
    draw();
    opts.onInput?.(start, end);
  };
  stage.addEventListener('pointerdown', (e) => {
    if (!samples || e.button !== 0) return;
    const t = timeAt(e.clientX);
    const target = (e.target as HTMLElement).closest<HTMLElement>('.snd-wave-handle');
    const which: 'start' | 'end' = target ? (target.dataset.which as 'start' | 'end') : Math.abs(t - start) <= Math.abs(t - end) ? 'start' : 'end';
    e.preventDefault();
    stage.setPointerCapture(e.pointerId);
    drag = { which, id: e.pointerId };
    (which === 'start' ? hStart : hEnd).focus({ preventScroll: true });
    stage.classList.add('is-dragging');
    if (!target) move(which, t);
  });
  stage.addEventListener('pointermove', (e) => {
    if (drag && e.pointerId === drag.id) move(drag.which, timeAt(e.clientX));
  });
  const release = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    stage.classList.remove('is-dragging');
    opts.onCommit(start, end);
  };
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);

  for (const hd of [hStart, hEnd]) {
    hd.addEventListener('keydown', (e) => {
      if (!samples) return;
      const which = hd.dataset.which as 'start' | 'end';
      const cur = which === 'start' ? start : end;
      const stepT = e.shiftKey ? 0.1 : 0.01;
      let t: number | null = null;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') t = cur - stepT;
      else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') t = cur + stepT;
      else if (e.key === 'PageDown') t = cur - 1;
      else if (e.key === 'PageUp') t = cur + 1;
      else if (e.key === 'Home') t = 0;
      else if (e.key === 'End') t = duration;
      if (t === null) return;
      e.preventDefault();
      e.stopPropagation();
      move(which, t);
      scheduleCommit();
    });
  }
  let commitTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduleCommit = () => {
    if (commitTimer) clearTimeout(commitTimer);
    commitTimer = setTimeout(() => {
      commitTimer = null;
      opts.onCommit(start, end);
    }, 450);
  };

  const ro = new ResizeObserver(() => draw());
  ro.observe(canvas);
  const mo = new MutationObserver(() => draw());
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

  return {
    el,
    set(s, st, en, g) {
      samples = s;
      duration = Math.max(MIN_LENGTH, s.duration);
      start = st;
      end = en;
      gain = g;
      peaks = null;
      el.classList.toggle('is-clipping', peakOf(s.channels, s.sampleRate, st, en) * g > 1.0001);
      paintRange();
      draw();
    },
    setRange(st, en) {
      if (drag) return;
      start = st;
      end = en;
      paintRange();
      draw();
    },
    setGain(g) {
      gain = g;
      draw();
    },
    setPlayhead(t) {
      head.hidden = t === null;
      if (t !== null) head.style.left = x(Math.max(0, Math.min(duration, t)));
    },
    destroy() {
      ro.disconnect();
      mo.disconnect();
      if (commitTimer) clearTimeout(commitTimer);
    },
  };
}
