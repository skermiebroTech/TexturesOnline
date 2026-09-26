// Shared helpers for the Iris shader pack tests: seeded random option values.

import { OPTIONS, toHexColor } from '../../../src/tools/shaders/iris/index';
import type { OptionValues } from '../../../src/core/types';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random web UI values; with `extremes` every range option is at its min or max. */
export function randomOptions(rand: () => number, extremes = false): OptionValues {
  const v: OptionValues = {};
  for (const o of OPTIONS) {
    if (o.type === 'range') {
      const lo = o.min ?? 0;
      const hi = o.max ?? 1;
      v[o.key] = extremes ? (rand() < 0.5 ? lo : hi) : lo + rand() * (hi - lo);
    } else if (o.type === 'toggle') v[o.key] = rand() < 0.5;
    else if (o.type === 'select') v[o.key] = o.options![Math.floor(rand() * o.options!.length)].value;
    else v[o.key] = toHexColor([rand() * 255, rand() * 255, rand() * 255]);
  }
  return v;
}

/** Every range option at its minimum (toggles off) or maximum (toggles on), selects at the ends. */
export function allExtreme(high: boolean): OptionValues {
  const v: OptionValues = {};
  for (const o of OPTIONS) {
    if (o.type === 'range') v[o.key] = high ? o.max! : o.min!;
    else if (o.type === 'toggle') v[o.key] = high;
    else if (o.type === 'select') v[o.key] = o.options![high ? o.options!.length - 1 : 0].value;
    else v[o.key] = high ? '#ffffff' : '#000000';
  }
  return v;
}
