// Changes to an animated texture as a whole: frames added, deleted and moved, a still texture made
// animated, frames imported. Each returns the texture's new pixels (frames stacked top to bottom,
// the way the editor saves animations) with the animation that plays them. No DOM.

import type { TextureAnimation } from '../../../core/types';
import { cloneImageData, createImageData } from '../../../core/pixels';
import { fitFrame, joinFrames, splitFrames } from './frames';
import { clampTicks, frameTime, insertFrames, moveFrame, normalizeFrames, removeFrame } from './timing';

export interface Animated {
  full: ImageData;
  anim: TextureAnimation;
}

/** Most frames an animation made here can have */
export const MAX_FRAMES = 256;
/** Tallest strip made here (the game's atlases hold 16384 px) */
export const MAX_STRIP = 16384;
/** Speed of a new animation: 0.2 s a frame */
export const NEW_FRAMETIME = 4;

/** How many frames of this size fit in a strip. */
export const maxFramesFor = (frameH: number): number => Math.max(1, Math.min(MAX_FRAMES, Math.floor(MAX_STRIP / Math.max(1, frameH))));

export function count(a: Animated): number {
  const { frameWidth: w, frameHeight: h } = a.anim;
  return (a.full.width / w) * (a.full.height / h);
}

export function framesOf(a: Animated): ImageData[] {
  const cols = a.full.width / a.anim.frameWidth;
  return splitFrames(a.full, { frameW: a.anim.frameWidth, frameH: a.anim.frameHeight, cols, count: count(a) });
}

const stamp = (anim: TextureAnimation, frames: TextureAnimation['frames'], n: number): TextureAnimation => {
  const out: TextureAnimation = { ...anim, frames: normalizeFrames(frames, anim.frametime, n), updatedAt: Date.now() };
  if (!out.frames) delete out.frames;
  return out;
};

/** A still picture as an animation of `n` copies of it (or the frames of a strip the game doesn't animate). */
export function makeAnimated(full: ImageData, frameW: number, frameH: number, n = 2): Animated {
  const anim: TextureAnimation = { frameWidth: frameW, frameHeight: frameH, frametime: NEW_FRAMETIME, updatedAt: Date.now() };
  if (full.width === frameW && full.height === frameH) return { full: joinFrames(Array.from({ length: n }, () => full)), anim };
  const cols = full.width / frameW;
  const frames = splitFrames(full, { frameW, frameH, cols, count: cols * (full.height / frameH) });
  return { full: joinFrames(frames), anim };
}

/** `add` frames put in at `at` (resized to the frame size), with times of their own if given. */
export function addFrames(a: Animated, at: number, add: readonly ImageData[], times: (number | undefined)[] = []): Animated {
  const n = count(a);
  const room = maxFramesFor(a.anim.frameHeight) - n;
  const list = add.slice(0, Math.max(0, room)).map((f) => fitFrame(f, a.anim.frameWidth, a.anim.frameHeight));
  if (!list.length) return a;
  const frames = framesOf(a);
  frames.splice(at, 0, ...list);
  return { full: joinFrames(frames), anim: stamp(a.anim, insertFrames(a.anim, n, at, list.length, times.slice(0, list.length).map((t) => (t === undefined ? undefined : clampTicks(t)))), n + list.length) };
}

/** A copy of frame k right after it (with its time). */
export const duplicateFrame = (a: Animated, k: number): Animated => addFrames(a, k + 1, [framesOf(a)[k]], [frameTime(a.anim, k)]);

/** An empty (see-through) frame after frame k. */
export const addEmptyFrame = (a: Animated, k: number): Animated => addFrames(a, k + 1, [createImageData(a.anim.frameWidth, a.anim.frameHeight)]);

/** Frame k deleted. One frame left: null (the texture is still now; `full` of the result is that frame). */
export function deleteFrame(a: Animated, k: number): { next: Animated | null; full: ImageData } {
  const n = count(a);
  const frames = framesOf(a);
  frames.splice(k, 1);
  if (n - 1 < 2) return { next: null, full: cloneImageData(frames[0]) };
  const full = joinFrames(frames);
  return { next: { full, anim: stamp(a.anim, removeFrame(a.anim, n, k), n - 1) }, full };
}

/** The frame at `from` moved to `to`. */
export function moveFrameTo(a: Animated, from: number, to: number): Animated {
  const n = count(a);
  if (from === to || from < 0 || to < 0 || from >= n || to >= n) return a;
  const frames = framesOf(a);
  const [f] = frames.splice(from, 1);
  frames.splice(to, 0, f);
  return { full: joinFrames(frames), anim: stamp(a.anim, moveFrame(a.anim, n, from, to), n) };
}

/** All frames swapped for `frames` (an import), with times of their own if given. */
export function replaceFrames(a: Animated, frames: readonly ImageData[], times?: number[]): Animated {
  const list = frames.slice(0, maxFramesFor(a.anim.frameHeight)).map((f) => fitFrame(f, a.anim.frameWidth, a.anim.frameHeight));
  const n = list.length;
  let anim: TextureAnimation = { ...a.anim, updatedAt: Date.now() };
  delete anim.frames;
  if (times?.length) {
    // the most common time becomes the speed, the others times of their own
    const tally = new Map<number, number>();
    for (const t of times.slice(0, n)) tally.set(clampTicks(t), (tally.get(clampTicks(t)) ?? 0) + 1);
    const ft = [...tally].sort((x, y) => y[1] - x[1] || x[0] - y[0])[0][0];
    anim = stamp({ ...anim, frametime: ft }, list.map((_, i) => ({ index: i, time: clampTicks(times[i] ?? ft) })), n);
  }
  return { full: joinFrames(list), anim };
}
