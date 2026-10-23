// Animation timing of the texture pack editor (project.animations): game ticks and seconds, GIF delays,
// the play order (Java's "frames" list) as frames are added, removed and moved, the order typed as
// text, and Bedrock flipbooks, which have one speed for every frame (other times become repeated
// frames). No DOM.

import type { AnimationStep, TextureAnimation } from '../../../core/types';

/** The game runs 20 ticks a second */
export const TICKS_PER_SECOND = 20;
export const TICK_MS = 1000 / TICKS_PER_SECOND;
/** Longest time a frame can be given in the editor (10 minutes) */
export const MAX_TICKS = 12000;

/** A step with its time worked out */
export interface PlayStep {
  index: number;
  time: number;
}

type Timing = Pick<TextureAnimation, 'frametime' | 'frames'>;

export const clampTicks = (t: number): number => (Number.isFinite(t) ? Math.min(MAX_TICKS, Math.max(1, Math.round(t))) : 1);

export const ticksToSeconds = (t: number): number => t / TICKS_PER_SECOND;

/** GIF delays are in hundredths of a second; 0 and 1 play as 10 in browsers. */
export function gifDelayToTicks(cs: number): number {
  const d = !Number.isFinite(cs) || cs <= 1 ? 10 : cs;
  return clampTicks(d / 5);
}

export const ticksToGifDelay = (t: number): number => Math.max(1, Math.round(t)) * 5;

// ---------------------------------------------------------------------------------------------
// Play order

/** The steps the game plays: the listed ones (frames that exist), else every frame in order. */
export function playSteps(anim: Timing, count: number): PlayStep[] {
  const ft = clampTicks(anim.frametime);
  const out: PlayStep[] = [];
  for (const s of anim.frames ?? []) if (Number.isInteger(s.index) && s.index >= 0 && s.index < count) out.push({ index: s.index, time: s.time ? clampTicks(s.time) : ft });
  if (!out.length) for (let i = 0; i < count; i++) out.push({ index: i, time: ft });
  return out;
}

/** Ticks one loop takes. */
export const loopTicks = (anim: Timing, count: number): number => playSteps(anim, count).reduce((n, s) => n + s.time, 0);

/** Every frame once, in order (times may differ): the list follows the frames when they move. */
export function isPlainOrder(frames: readonly AnimationStep[] | undefined, count: number): boolean {
  return !frames || !frames.length || (frames.length === count && frames.every((s, i) => s.index === i));
}

/**
 * The shortest list that plays the same: times equal to the default are left out, and every frame
 * once in order at the default speed needs no list.
 */
export function normalizeFrames(frames: readonly AnimationStep[] | undefined, frametime: number, count: number): AnimationStep[] | undefined {
  if (!frames?.length) return undefined;
  const ft = clampTicks(frametime);
  const out = frames.filter((s) => Number.isInteger(s.index) && s.index >= 0 && s.index < count).map((s) => (s.time && clampTicks(s.time) !== ft ? { index: s.index, time: clampTicks(s.time) } : { index: s.index }));
  if (!out.length) return undefined;
  if (isPlainOrder(out, count) && out.every((s) => s.time === undefined)) return undefined;
  return out;
}

/** Ticks frame i shows for (the first time it plays; the default when the list skips it). */
export function frameTime(anim: Timing, i: number): number {
  const s = anim.frames?.find((x) => x.index === i);
  return clampTicks(s?.time ?? anim.frametime);
}

/** Whether some frame has a time of its own. */
export const hasOwnTimes = (anim: Timing): boolean => !!anim.frames?.some((s) => s.time !== undefined && clampTicks(s.time) !== clampTicks(anim.frametime));

/** The list with frame i shown for `time` ticks (every time it plays). */
export function withFrameTime(anim: Timing, count: number, i: number, time: number): AnimationStep[] | undefined {
  const t = clampTicks(time);
  const base = anim.frames?.length ? anim.frames.map((s) => ({ ...s })) : Array.from({ length: count }, (_, k) => ({ index: k }) as AnimationStep);
  for (const s of base) if (s.index === i) s.time = t;
  return normalizeFrames(base, anim.frametime, count);
}

/** The list after `n` frames were put in at `at` (the frames from `at` on move up). `times`: theirs. */
export function insertFrames(anim: Timing, count: number, at: number, n: number, times: (number | undefined)[] = []): AnimationStep[] | undefined {
  if (!anim.frames?.length) {
    if (!times.some((t) => t !== undefined)) return undefined;
    const plain: AnimationStep[] = Array.from({ length: count }, (_, k) => ({ index: k }));
    return insertFrames({ ...anim, frames: plain }, count, at, n, times);
  }
  const fresh = Array.from({ length: n }, (_, k) => (times[k] !== undefined ? { index: at + k, time: times[k] } : { index: at + k }) as AnimationStep);
  if (isPlainOrder(anim.frames, count)) {
    const out = anim.frames.map((s) => ({ ...s }));
    out.splice(at, 0, ...fresh);
    return normalizeFrames(out.map((s, k) => ({ ...s, index: k })), anim.frametime, count + n);
  }
  // a list of its own: the new frames play after the last time the frame before them plays
  const shifted = anim.frames.map((s) => ({ ...s, index: s.index >= at ? s.index + n : s.index }));
  let pos = shifted.length;
  if (at > 0) {
    const last = shifted.map((s) => s.index).lastIndexOf(at - 1);
    if (last >= 0) pos = last + 1;
  } else pos = 0;
  shifted.splice(pos, 0, ...fresh);
  return normalizeFrames(shifted, anim.frametime, count + n);
}

/** The list after frame k was deleted (its steps go, the frames after it move down). */
export function removeFrame(anim: Timing, count: number, k: number): AnimationStep[] | undefined {
  if (!anim.frames?.length) return undefined;
  const out = anim.frames.filter((s) => s.index !== k).map((s) => ({ ...s, index: s.index > k ? s.index - 1 : s.index }));
  return normalizeFrames(out.length ? out : undefined, anim.frametime, count - 1);
}

/**
 * The list after the frame at `from` moved to `to`. Every frame once in order: the list follows the
 * frames (their times move with them). A list of its own plays places, so it stays as it is.
 */
export function moveFrame(anim: Timing, count: number, from: number, to: number): AnimationStep[] | undefined {
  if (!anim.frames?.length || !isPlainOrder(anim.frames, count)) return anim.frames?.map((s) => ({ ...s }));
  const out = anim.frames.map((s) => ({ ...s }));
  const [s] = out.splice(from, 1);
  out.splice(to, 0, s);
  return normalizeFrames(out.map((x, k) => ({ ...x, index: k })), anim.frametime, count);
}

/** Where each frame goes when the frame at `from` moves to `to` (old index -> new index). */
export function movedIndex(i: number, from: number, to: number): number {
  if (i === from) return to;
  if (from < to && i > from && i <= to) return i - 1;
  if (to < from && i >= to && i < from) return i + 1;
  return i;
}

// ---------------------------------------------------------------------------------------------
// The play order as text: frame numbers from 1, "3:40" gives a time, "1-8" a run of frames

/** "1, 2, 3:40, 2" (empty: every frame in order). */
export function formatOrder(frames: readonly AnimationStep[] | undefined, frametime: number, count: number): string {
  const list = normalizeFrames(frames, frametime, count);
  if (!list) return '';
  return list.map((s) => `${s.index + 1}${s.time !== undefined ? `:${s.time}` : ''}`).join(', ');
}

export type OrderError = { error: 'syntax' | 'range'; token: string };

/** Reads a typed play order. Empty text: every frame once, in order. */
export function parseOrder(text: string, count: number): AnimationStep[] | OrderError {
  const tokens = text.split(/[\s,;]+/).filter(Boolean);
  const out: AnimationStep[] = [];
  for (const tok of tokens) {
    const m = /^(\d+)(?:\s*[-–]\s*(\d+))?(?:[:×x*](\d+))?$/i.exec(tok);
    if (!m) return { error: 'syntax', token: tok };
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    const time = m[3] ? clampTicks(Number(m[3])) : undefined;
    if (a < 1 || b < 1 || a > count || b > count) return { error: 'range', token: tok };
    const step = a <= b ? 1 : -1;
    for (let n = a; ; n += step) {
      out.push(time !== undefined ? { index: n - 1, time } : { index: n - 1 });
      if (n === b) break;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Bedrock flipbooks: one ticks_per_frame for all frames, a frame shown longer is listed again

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
/** Longest frames list written (a frame of 10 minutes at a 1-tick step would be 12000 entries) */
const MAX_FLIPBOOK_FRAMES = 4096;

/** ticks_per_frame and frames that play like the steps (frames left out when every frame plays once, in order). */
export function flipbookTiming(anim: Timing, count: number): { ticks: number; frames?: number[] } {
  const steps = playSteps(anim, count);
  let ticks = steps.reduce((g, s) => gcd(g, s.time), 0) || 1;
  const plain = isPlainOrder(normalizeFrames(anim.frames, anim.frametime, count), count);
  if (plain && steps.every((s) => s.time === steps[0].time)) return { ticks: steps[0].time };
  let total = steps.reduce((n, s) => n + s.time / ticks, 0);
  // too many repeats: round times to a coarser step (the loop stays about as long)
  while (total > MAX_FLIPBOOK_FRAMES) {
    ticks *= 2;
    total = steps.reduce((n, s) => n + Math.max(1, Math.round(s.time / ticks)), 0);
  }
  const frames: number[] = [];
  for (const s of steps) for (let k = Math.max(1, Math.round(s.time / ticks)); k > 0; k--) frames.push(s.index);
  return { ticks, frames };
}

/** A flipbook's timing as frametime + play order (repeats of a frame in a row become its time). */
export function timingFromFlipbook(ticks: number | undefined, frames: readonly unknown[] | undefined, count: number): { frametime: number; frames?: AnimationStep[] } {
  const ft = clampTicks(ticks ?? 1);
  const list = (frames ?? []).filter((f): f is number => typeof f === 'number' && Number.isInteger(f) && f >= 0 && f < count);
  if (!list.length) return { frametime: ft };
  const steps: AnimationStep[] = [];
  for (const f of list) {
    const last = steps[steps.length - 1];
    if (last && last.index === f) last.time = (last.time ?? ft) + ft;
    else steps.push({ index: f });
  }
  return { frametime: ft, frames: normalizeFrames(steps, ft, count) };
}
