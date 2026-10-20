// Small form pieces of the model editor: number fields that take typing, arrow keys and a drag on their
// label (like Blockbench), grouped X / Y / Z rows, and section headings.

import { h, uid } from '../../../../ui/dom';
import { icon, type IconName } from '../../../../ui/icons';
import { tidy } from '../../models/doc';

export interface NumField extends HTMLElement {
  setValue(v: number): void;
  input: HTMLInputElement;
}

export interface NumOptions {
  label: string;
  /** Accessible name when the label is a single letter */
  aria?: string;
  value: number;
  step: () => number;
  min?: number;
  max?: number;
  /** Stable id so focus survives a re-render */
  key: string;
  /** Live change (typing, arrows, label drag); `done` when the change is finished (blur, Enter, drag end) */
  onInput(v: number, done: boolean): void;
  /** Axis colour: 0 x, 1 y, 2 z */
  axis?: number;
}

const fmt = (v: number) => String(tidy(v));

export function numField(o: NumOptions): NumField {
  const id = uid('num');
  const input = h('input', { class: 'me-num-input', id, type: 'text', inputMode: 'decimal', autocomplete: 'off', spellcheck: false, value: fmt(o.value), dataset: { key: o.key } });
  input.setAttribute('aria-label', o.aria ?? o.label);
  const label = h('label', { class: ['me-num-label', o.axis !== undefined && `axis-${o.axis}`], htmlFor: id }, o.label);
  const el = h('div', { class: 'me-num' }, label, input) as unknown as NumField;
  el.input = input;
  let value = o.value;
  const clamp = (v: number) => Math.max(o.min ?? -Infinity, Math.min(o.max ?? Infinity, v));
  const set = (v: number, done: boolean) => {
    if (!Number.isFinite(v)) return;
    value = tidy(clamp(v));
    o.onInput(value, done);
  };
  input.addEventListener('input', () => {
    const v = Number(input.value.replace(',', '.'));
    if (input.value.trim() !== '' && Number.isFinite(v)) set(v, false);
  });
  /** The typed value is final (Enter, or leaving the field): one 'done' change, none when nothing changed. */
  let committed = o.value;
  const commit = () => {
    const v = Number(input.value.replace(',', '.'));
    if (input.value.trim() === '' || !Number.isFinite(v)) input.value = fmt(value);
    else if (tidy(clamp(v)) !== committed || value !== committed) {
      set(v, true);
      committed = value;
      input.value = fmt(value);
    }
  };
  input.addEventListener('change', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      commit();
      input.select();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const step = o.step() * (e.shiftKey ? 4 : 1) || 1;
      const base = Number(input.value.replace(',', '.'));
      set((Number.isFinite(base) ? base : value) + (e.key === 'ArrowUp' ? step : -step), true);
      input.value = fmt(value);
    }
  });
  // drag the label sideways to scrub the value
  let scrub: { id: number; x: number; start: number; moved: boolean } | null = null;
  label.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    scrub = { id: e.pointerId, x: e.clientX, start: value, moved: false };
    try {
      label.setPointerCapture(e.pointerId);
    } catch {
      /* best effort */
    }
  });
  label.addEventListener('pointermove', (e) => {
    if (!scrub || e.pointerId !== scrub.id) return;
    const dx = e.clientX - scrub.x;
    if (!scrub.moved && Math.abs(dx) < 3) return;
    scrub.moved = true;
    const step = o.step() || 0.25;
    set(scrub.start + Math.round(dx / 6) * step, false);
    input.value = fmt(value);
  });
  const endScrub = (e: PointerEvent) => {
    if (!scrub || e.pointerId !== scrub.id) return;
    const moved = scrub.moved;
    scrub = null;
    if (moved) set(value, true);
    else input.focus();
  };
  label.addEventListener('pointerup', endScrub);
  label.addEventListener('pointercancel', endScrub);
  el.setValue = (v: number) => {
    value = v;
    if (document.activeElement !== input) input.value = fmt(v);
  };
  return el;
}

/** Three number fields in a row (X, Y, Z). */
export function vecFields(o: { label: string; value: [number, number, number]; step: () => number; min?: number; max?: number; key: string; onInput(v: [number, number, number], done: boolean): void; hint?: string }): HTMLElement {
  const cur: [number, number, number] = [...o.value];
  const names = ['X', 'Y', 'Z'];
  const fields = [0, 1, 2].map((a) =>
    numField({
      label: names[a],
      aria: `${o.label} ${names[a]}`,
      value: cur[a],
      step: o.step,
      min: o.min,
      max: o.max,
      key: `${o.key}.${a}`,
      axis: a,
      onInput: (v, done) => {
        cur[a] = v;
        o.onInput([...cur], done);
      },
    }),
  );
  return h('div', { class: 'me-field' }, h('div', { class: 'me-field-head' }, h('span', { class: 'me-field-label' }, o.label), o.hint ? h('span', { class: 'me-field-hint' }, o.hint) : null), h('div', { class: 'me-vec' }, fields));
}

export function section(title: string, ic: IconName | null, ...children: (Node | null | false)[]): HTMLElement {
  return h('section', { class: 'me-section' }, h('h3', { class: 'me-section-title' }, ic ? icon(ic, { size: 16 }) : null, title), ...children.filter((c): c is Node => !!c));
}
