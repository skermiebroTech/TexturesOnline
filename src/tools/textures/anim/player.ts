// Plays an animation the way the game does: one step per game tick (50 ms), each frame for its
// ticks, blended into the next frame tick by tick when the animation blends. Also gives the frames
// of a GIF of it.

import { blendFrames } from './frames';
import { TICK_MS, ticksToGifDelay, type PlayStep } from './timing';

export interface PlaySource {
  frames: readonly ImageData[];
  steps: readonly PlayStep[];
  interpolate: boolean;
  /** How the game blends (see blendFrames) */
  blend: 'rgba' | 'rgb';
}

/** The picture the game shows `tick` ticks into the loop. */
export function frameAtTick(src: PlaySource, tick: number): ImageData {
  const total = src.steps.reduce((n, s) => n + s.time, 0) || 1;
  let t = ((tick % total) + total) % total;
  for (let i = 0; i < src.steps.length; i++) {
    const s = src.steps[i];
    if (t < s.time) {
      const a = src.frames[s.index];
      if (!src.interpolate || t === 0) return a;
      const b = src.frames[src.steps[(i + 1) % src.steps.length].index];
      return a === b ? a : blendFrames(a, b, t / s.time, src.blend);
    }
    t -= s.time;
  }
  return src.frames[src.steps[0]?.index ?? 0];
}

/** GIF frames (hundredths of a second): one per step, or one per tick when frames blend. */
export function gifFrames(src: PlaySource): { image: ImageData; delay: number }[] {
  if (!src.interpolate) return src.steps.map((s) => ({ image: src.frames[s.index], delay: ticksToGifDelay(s.time) }));
  const total = src.steps.reduce((n, s) => n + s.time, 0);
  return Array.from({ length: total }, (_, t) => ({ image: frameAtTick(src, t), delay: ticksToGifDelay(1) }));
}

export interface Player {
  readonly playing: boolean;
  set(src: PlaySource | null): void;
  play(): void;
  stop(): void;
}

/** A tick clock that paints the current picture with `paint` while it plays. */
export function createPlayer(paint: (img: ImageData) => void, onState?: (playing: boolean) => void): Player {
  let src: PlaySource | null = null;
  let raf = 0;
  let start = 0;
  let last = -1;
  const loop = (now: number) => {
    if (!src) return;
    const tick = Math.floor((now - start) / TICK_MS);
    if (tick !== last) {
      last = tick;
      paint(frameAtTick(src, tick));
    }
    raf = requestAnimationFrame(loop);
  };
  const player: Player = {
    get playing() {
      return raf !== 0;
    },
    set(s) {
      src = s;
      last = -1;
      if (!s && raf) player.stop();
    },
    play() {
      if (!src || raf) return;
      start = performance.now();
      last = -1;
      raf = requestAnimationFrame(loop);
      onState?.(true);
    },
    stop() {
      if (!raf) return;
      cancelAnimationFrame(raf);
      raf = 0;
      onState?.(false);
    },
  };
  return player;
}
