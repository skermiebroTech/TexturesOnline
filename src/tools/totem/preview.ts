// In-game style previews of the totem: the "pop" when a totem saves you (the item flies at the
// camera, spinning, with green and gold particles) and the item in a hotbar and the off-hand slot.
// Everything is drawn procedurally on a 2D canvas; no game art.

import { h } from '../../ui/dom';
import { imageDataToCanvas } from '../../core/pixels';
import { popFrame } from './totem';
import { t } from './i18n/text';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
}

const DURATION = 2000;

function particleColor(r: () => number): string {
  // The game's totem particles: gold-yellow or green, randomly mixed.
  const t = r();
  if (r() < 0.6) return `rgb(${Math.round((0.6 + t * 0.2) * 255)}, ${Math.round((0.6 + t * 0.3) * 255)}, ${Math.round(t * 0.2 * 255)})`;
  return `rgb(${Math.round((0.1 + t * 0.2) * 255)}, ${Math.round((0.4 + t * 0.3) * 255)}, ${Math.round(t * 0.2 * 255)})`;
}

export interface PopPreview {
  el: HTMLElement;
  setImage(img: ImageData | null): void;
  play(): void;
  destroy(): void;
}

/** The totem pop on a small "game" stage, with a replay button. */
export function popPreview(): PopPreview {
  const canvas = h('canvas', { class: 'tt-pop-canvas', 'aria-hidden': 'true' });
  const replay = h('button', { type: 'button', class: 'tt-pop-play', 'aria-label': t.preview.playLabel });
  const el = h('div', { class: 'tt-pop' }, canvas, replay);
  let item: HTMLCanvasElement | null = null;
  let raf = 0;
  let start = 0;
  let particles: Particle[] = [];
  let seed = 1;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  function size(): { w: number; h: number; dpr: number } {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(120, canvas.clientWidth || 240);
    const hh = Math.max(120, canvas.clientHeight || 240);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(hh * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(hh * dpr);
    }
    return { w, h: hh, dpr };
  }

  function drawItem(ctx: CanvasRenderingContext2D, cx: number, cy: number, px: number, spin: number, tilt: number) {
    if (!item) return;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tilt);
    ctx.scale(spin, 1);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(item, -px / 2, -px / 2, px, px);
    ctx.restore();
  }

  /** Resting frame: the item in the middle of the stage. */
  function still() {
    const { w, h: hh, dpr } = size();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hh);
    drawItem(ctx, w / 2, hh / 2, Math.floor(Math.min(w, hh) * 0.5 / 16) * 16, 1, 0);
  }

  function frame(now: number) {
    const { w, h: hh, dpr } = size();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const t = (now - start) / DURATION;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hh);
    const dt = 1 / 60;
    // Particles burst during the first third, behind and in front of the item.
    if (t < 0.35) {
      for (let i = 0; i < 6; i++) {
        const ang = rnd() * Math.PI * 2;
        const sp = 40 + rnd() * 140;
        particles.push({ x: w / 2, y: hh * 0.55, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 90, life: 0, max: 0.8 + rnd() * 0.9, size: 2 + Math.floor(rnd() * 3), color: particleColor(rnd) });
      }
    }
    particles = particles.filter((p) => p.life < p.max);
    for (const p of particles) {
      p.life += dt;
      p.vy += 160 * dt;
      p.vx *= 0.98;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
    if (t < 1) {
      const fr = popFrame(Math.max(0, t));
      // The item fills about 90% of the stage at its closest.
      const px = Math.min(w, hh) * 0.9 * fr.scale;
      drawItem(ctx, w / 2, hh / 2, px, fr.spin, fr.tilt);
    }
    if (t < 1 || particles.length) raf = requestAnimationFrame(frame);
    else {
      raf = 0;
      el.classList.remove('is-playing');
      still();
    }
  }

  function play() {
    if (!item) return;
    cancelAnimationFrame(raf);
    if (reduced()) {
      still();
      return;
    }
    particles = [];
    seed = 7;
    start = performance.now();
    el.classList.add('is-playing');
    raf = requestAnimationFrame(frame);
  }

  replay.addEventListener('click', () => play());
  let ro: ResizeObserver | null = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => {
      if (!raf) still();
    });
    ro.observe(canvas);
  }

  return {
    el,
    setImage(img) {
      item = img ? imageDataToCanvas(img) : null;
      if (!raf) still();
    },
    play,
    destroy() {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    },
  };
}

/** A hotbar with the totem in the off-hand slot and the selected slot. */
export function hotbarPreview(): { el: HTMLElement; setImage(img: ImageData | null): void } {
  const slot = (cls: string) => h('span', { class: ['tt-slot', cls] });
  const off = slot('tt-slot-off');
  const slots = Array.from({ length: 9 }, (_, i) => slot(i === 0 ? 'is-selected' : ''));
  const el = h('div', { class: 'tt-hotbar', 'aria-hidden': 'true' }, off, h('span', { class: 'tt-hotbar-bar' }, slots));
  return {
    el,
    setImage(img) {
      for (const s of [off, slots[0]]) {
        s.replaceChildren();
        if (img) {
          const c = imageDataToCanvas(img);
          c.classList.add('pixelated');
          s.appendChild(c);
        }
      }
    },
  };
}
