// UI kit: buttons, form controls, surfaces and feedback components.

import type { OptionDef, OptionValue, OptionValues, Progress } from '../core/types';
import { formatBytes, h, uid, type Child } from './dom';
import { icon, setIcon, type IconName } from './icons';
import { tooltip } from './tooltip';
import { openPopover } from './popover';
import { colorPicker } from './color-picker';
import { parseHex, toHex } from './color';

export { tooltip, hideTooltip } from './tooltip';
export { openPopover, openMenu, type MenuItem, type PopoverHandle } from './popover';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

// ---------------------------------------------------------------------------------------------
// Buttons

export function button(opts: {
  label?: string;
  icon?: IconName;
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  title?: string;
  onClick?: (e: MouseEvent) => void;
  disabled?: boolean;
  class?: string;
  /** Icon after the label instead of before */
  iconEnd?: IconName;
  type?: 'button' | 'submit';
}): HTMLButtonElement {
  const variant = opts.variant ?? 'secondary';
  const size = opts.size ?? 'md';
  const iconOnly = !opts.label && Boolean(opts.icon);
  const b = h(
    'button',
    {
      type: opts.type ?? 'button',
      class: ['btn', `btn-${variant}`, size !== 'md' && `btn-${size}`, iconOnly && 'icon-only', opts.class],
      disabled: Boolean(opts.disabled),
    },
    opts.icon ? icon(opts.icon) : null,
    opts.label ? h('span', { class: 'btn-label' }, opts.label) : null,
    opts.iconEnd ? icon(opts.iconEnd) : null,
  );
  if (opts.title) tooltip(b, opts.title);
  else if (iconOnly && opts.icon) b.setAttribute('aria-label', opts.icon);
  if (opts.onClick) b.addEventListener('click', opts.onClick);
  return b;
}

/** Show a spinner inside a button while an async action runs. */
export function setButtonBusy(b: HTMLButtonElement, busy: boolean): void {
  if (busy) {
    if (b.classList.contains('busy')) return;
    b.classList.add('busy');
    b.setAttribute('aria-busy', 'true');
    b.dataset.wasDisabled = String(b.disabled);
    b.disabled = true;
    b.appendChild(spinner(20));
  } else {
    b.classList.remove('busy');
    b.removeAttribute('aria-busy');
    b.querySelector(':scope > .spinner')?.remove();
    b.disabled = b.dataset.wasDisabled === 'true';
  }
}

/** Run an async handler with the button in a busy state. */
export async function withBusy<T>(b: HTMLButtonElement, fn: () => Promise<T>): Promise<T> {
  setButtonBusy(b, true);
  try {
    return await fn();
  } finally {
    setButtonBusy(b, false);
  }
}

export function iconButton(
  name: IconName,
  title: string,
  onClick: () => void,
  opts: { active?: boolean; size?: 'sm' | 'md'; disabled?: boolean; class?: string } = {},
): HTMLButtonElement & { setActive(v: boolean): void; setIcon(n: IconName): void } {
  const glyph = icon(name);
  const b = h(
    'button',
    {
      type: 'button',
      class: ['icon-btn', opts.size === 'sm' && 'sm', opts.class],
      'aria-label': title,
      disabled: Boolean(opts.disabled),
    },
    glyph,
  ) as HTMLButtonElement & { setActive(v: boolean): void; setIcon(n: IconName): void };
  if (opts.active !== undefined) b.setAttribute('aria-pressed', String(opts.active));
  tooltip(b, title);
  b.addEventListener('click', () => onClick());
  b.setActive = (v: boolean) => b.setAttribute('aria-pressed', String(v));
  b.setIcon = (n: IconName) => setIcon(glyph, n);
  return b;
}

// ---------------------------------------------------------------------------------------------
// Form controls

function decimalsOf(step: number): number {
  if (!Number.isFinite(step) || step >= 1) return 0;
  const s = String(step);
  if (s.includes('e-')) return Number(s.split('e-')[1]);
  return (s.split('.')[1] ?? '').length;
}

function fieldHead(labelText: string, forId: string, extra?: Child): HTMLElement {
  return h('div', { class: 'field-head' }, h('label', { class: 'field-label', htmlFor: forId }, labelText), extra ?? null);
}

export function slider(opts: {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  unit?: string;
  description?: string;
  onInput: (v: number) => void;
  /** Called once when the user releases the thumb or commits a typed value */
  onChange?: (v: number) => void;
}): HTMLElement & { setValue(v: number): void } {
  const step = opts.step ?? (opts.max - opts.min <= 2 ? 0.01 : 1);
  const decimals = decimalsOf(step);
  const id = uid('slider');
  const descId = opts.description ? uid('desc') : undefined;
  const clamp = (v: number) => Math.min(opts.max, Math.max(opts.min, v));
  const fmt = (v: number) => v.toFixed(decimals);

  const range = h('input', {
    type: 'range',
    class: 'range',
    id,
    min: String(opts.min),
    max: String(opts.max),
    step: String(step),
    'aria-describedby': descId,
  });
  const num = h('input', {
    type: 'number',
    class: 'field-value',
    min: String(opts.min),
    max: String(opts.max),
    step: String(step),
    'aria-label': `${opts.label} value`,
    inputMode: decimals > 0 ? 'decimal' : 'numeric',
  });
  const unit = opts.unit ? h('span', { class: 'faint small' }, opts.unit) : null;

  const el = h(
    'div',
    { class: 'field slider' },
    fieldHead(opts.label, id, h('span', { class: 'row', style: { '--gap': '4px' } }, num, unit)),
    range,
    opts.description ? h('div', { class: 'field-desc', id: descId }, opts.description) : null,
  ) as unknown as HTMLElement & { setValue(v: number): void };

  let value = clamp(opts.value);
  const paint = () => {
    range.value = String(value);
    const pct = opts.max === opts.min ? 0 : ((value - opts.min) / (opts.max - opts.min)) * 100;
    range.style.setProperty('--fill', `${pct}%`);
    range.setAttribute('aria-valuetext', `${fmt(value)}${opts.unit ? ` ${opts.unit}` : ''}`);
    if (document.activeElement !== num) num.value = fmt(value);
  };
  range.addEventListener('input', () => {
    value = Number(range.value);
    paint();
    num.value = fmt(value);
    opts.onInput(value);
  });
  range.addEventListener('change', () => opts.onChange?.(value));
  num.addEventListener('change', () => {
    const n = Number(num.value);
    if (!Number.isFinite(n) || num.value.trim() === '') {
      num.value = fmt(value);
      return;
    }
    value = clamp(Math.round(n / step) * step);
    value = Number(value.toFixed(decimals));
    num.value = fmt(value);
    paint();
    opts.onInput(value);
    opts.onChange?.(value);
  });
  num.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') num.blur();
  });
  el.setValue = (v: number) => {
    value = clamp(v);
    num.value = fmt(value);
    paint();
  };
  paint();
  return el;
}

export function toggle(opts: { label: string; value: boolean; description?: string; onChange: (v: boolean) => void; disabled?: boolean }): HTMLElement & { setValue(v: boolean): void } {
  const id = uid('toggle');
  const descId = opts.description ? uid('desc') : undefined;
  const sw = h('button', {
    type: 'button',
    class: 'switch',
    role: 'switch',
    id,
    'aria-checked': String(opts.value),
    'aria-describedby': descId,
    disabled: Boolean(opts.disabled),
  });
  const el = h(
    'label',
    { class: 'toggle', htmlFor: id },
    h(
      'span',
      { class: 'toggle-text' },
      h('span', { class: 'field-label' }, opts.label),
      opts.description ? h('span', { class: 'field-desc', id: descId }, opts.description) : null,
    ),
    sw,
  ) as unknown as HTMLElement & { setValue(v: boolean): void };
  let value = opts.value;
  sw.addEventListener('click', (e) => {
    e.preventDefault();
    value = !value;
    sw.setAttribute('aria-checked', String(value));
    opts.onChange(value);
  });
  el.setValue = (v: boolean) => {
    value = v;
    sw.setAttribute('aria-checked', String(v));
  };
  return el;
}

export function select<T extends string>(opts: {
  label?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  description?: string;
}): HTMLElement & { setValue(v: T): void; setOptions(o: { value: T; label: string }[]): void } {
  const id = uid('select');
  const sel = h('select', { class: 'select-input', id, 'aria-label': opts.label ? undefined : 'Choose an option' });
  const fill = (options: { value: T; label: string }[]) => {
    sel.replaceChildren(...options.map((o) => h('option', { value: o.value }, o.label)));
  };
  fill(opts.options);
  sel.value = opts.value;
  sel.addEventListener('change', () => opts.onChange(sel.value as T));
  const el = h(
    'div',
    { class: 'field' },
    opts.label ? fieldHead(opts.label, id) : null,
    h('div', { class: 'select' }, sel, icon('chevron-down', { class: 'select-chevron' })),
    opts.description ? h('div', { class: 'field-desc' }, opts.description) : null,
  ) as unknown as HTMLElement & { setValue(v: T): void; setOptions(o: { value: T; label: string }[]): void };
  el.setValue = (v: T) => {
    sel.value = v;
  };
  el.setOptions = (o) => {
    const cur = sel.value;
    fill(o);
    sel.value = cur;
  };
  return el;
}

/** Arrow-key navigation for a radio-like group of buttons. */
function rovingGroup(buttons: HTMLButtonElement[], getIndex: () => number, activate: (i: number) => void, vertical = false): void {
  buttons.forEach((b) => {
    b.addEventListener('keydown', (e) => {
      const i = buttons.indexOf(b);
      let next = -1;
      if (e.key === 'ArrowRight' || (vertical && e.key === 'ArrowDown')) next = (i + 1) % buttons.length;
      else if (e.key === 'ArrowLeft' || (vertical && e.key === 'ArrowUp')) next = (i - 1 + buttons.length) % buttons.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = buttons.length - 1;
      if (next < 0) return;
      e.preventDefault();
      activate(next);
      buttons[next].focus();
    });
  });
  const sync = () => buttons.forEach((b, i) => (b.tabIndex = i === getIndex() ? 0 : -1));
  sync();
  buttons.forEach((b) => b.addEventListener('focus', sync));
}

export function segmented<T extends string>(opts: {
  value: T;
  options: { value: T; label: string; icon?: IconName }[];
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  label?: string;
}): HTMLElement & { setValue(v: T): void } {
  let value = opts.value;
  const buttons = opts.options.map((o) =>
    h(
      'button',
      { type: 'button', class: 'segmented-item', role: 'radio', 'aria-checked': String(o.value === value), dataset: { value: o.value } },
      o.icon ? icon(o.icon) : null,
      o.label ? h('span', null, o.label) : null,
    ),
  );
  opts.options.forEach((o, i) => {
    if (!o.label && o.icon) buttons[i].setAttribute('aria-label', o.icon);
  });
  const el = h('div', { class: ['segmented', opts.size === 'sm' && 'sm'], role: 'radiogroup', 'aria-label': opts.label }, buttons) as unknown as HTMLElement & {
    setValue(v: T): void;
  };
  const paint = () => {
    buttons.forEach((b, i) => {
      const on = opts.options[i].value === value;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    });
  };
  const choose = (i: number) => {
    const v = opts.options[i].value;
    if (v === value) return;
    value = v;
    paint();
    opts.onChange(v);
  };
  buttons.forEach((b, i) => b.addEventListener('click', () => choose(i)));
  rovingGroup(buttons, () => Math.max(0, opts.options.findIndex((o) => o.value === value)), choose);
  el.setValue = (v: T) => {
    value = v;
    paint();
  };
  paint();
  return el;
}

export function textInput(opts: {
  label?: string;
  value: string;
  placeholder?: string;
  onInput: (v: string) => void;
  multiline?: boolean;
  description?: string;
  maxLength?: number;
  icon?: IconName;
  type?: 'text' | 'search' | 'url';
  onEnter?: (v: string) => void;
}): HTMLElement & { input: HTMLInputElement | HTMLTextAreaElement; setValue(v: string): void } {
  const id = uid('text');
  const input = opts.multiline
    ? h('textarea', { class: 'textarea', id, placeholder: opts.placeholder ?? '', rows: 3 })
    : h('input', { class: 'input', id, type: opts.type ?? 'text', placeholder: opts.placeholder ?? '', autocomplete: 'off', spellcheck: false });
  if (opts.maxLength) input.maxLength = opts.maxLength;
  if (!opts.label) input.setAttribute('aria-label', opts.placeholder ?? 'Text');
  input.value = opts.value;
  input.addEventListener('input', () => opts.onInput(input.value));
  if (opts.onEnter && input instanceof HTMLInputElement) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') opts.onEnter?.(input.value);
    });
  }
  const control = opts.icon ? h('div', { class: 'input-with-icon' }, icon(opts.icon), input) : input;
  const el = h(
    'div',
    { class: 'field' },
    opts.label ? fieldHead(opts.label, id) : null,
    control,
    opts.description ? h('div', { class: 'field-desc' }, opts.description) : null,
  ) as unknown as HTMLElement & { input: HTMLInputElement | HTMLTextAreaElement; setValue(v: string): void };
  el.input = input;
  el.setValue = (v: string) => {
    input.value = v;
  };
  return el;
}

export function colorSwatch(opts: { value: string; label?: string; onChange: (hex: string) => void; description?: string }): HTMLElement & { setValue(hex: string): void } {
  let value = normalizeHex(opts.value);
  const chip = h('span', { class: 'swatch-chip' });
  const text = h('span', null);
  const btn = h('button', { type: 'button', class: 'swatch-btn', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' }, chip, text);
  const paint = () => {
    chip.style.background = value;
    text.textContent = value;
    btn.setAttribute('aria-label', `${opts.label ?? 'Colour'}: ${value}`);
  };
  let pop: ReturnType<typeof openPopover> | null = null;
  btn.addEventListener('click', () => {
    if (pop?.open) {
      pop.close();
      return;
    }
    const rgba = parseHex(value) ?? [0, 0, 0, 255];
    const picker = colorPicker({
      value: rgba,
      alpha: false,
      onChange: (c) => {
        value = toHex(c);
        paint();
        opts.onChange(value);
      },
    });
    btn.setAttribute('aria-expanded', 'true');
    pop = openPopover(btn, picker, { label: opts.label ?? 'Colour', focus: true, onClose: () => btn.setAttribute('aria-expanded', 'false') });
  });
  const el = h(
    'div',
    { class: 'field' },
    h(
      'div',
      { class: 'swatch-field' },
      btn,
      opts.label ? h('span', { class: 'field-label grow', 'aria-hidden': 'true' }, opts.label) : null,
    ),
    opts.description ? h('div', { class: 'field-desc' }, opts.description) : null,
  ) as unknown as HTMLElement & { setValue(hex: string): void };
  el.setValue = (hex: string) => {
    value = normalizeHex(hex);
    paint();
  };
  paint();
  return el;
}

function normalizeHex(hex: string): string {
  const c = parseHex(hex);
  return c ? toHex(c) : '#000000';
}

/** Renders any OptionDef as the matching control. */
export function optionControl(def: OptionDef, value: OptionValue, onChange: (v: OptionValue) => void): HTMLElement & { setValue(v: OptionValue): void } {
  let el: HTMLElement & { setValue(v: never): void };
  switch (def.type) {
    case 'range':
      el = slider({
        label: def.label,
        min: def.min ?? 0,
        max: def.max ?? 1,
        step: def.step,
        unit: def.unit,
        value: Number(value),
        description: def.description,
        onInput: (v) => onChange(v),
      });
      break;
    case 'toggle':
      el = toggle({ label: def.label, value: Boolean(value), description: def.description, onChange: (v) => onChange(v) });
      break;
    case 'select':
      el = select({
        label: def.label,
        value: String(value),
        options: def.options ?? [],
        description: def.description,
        onChange: (v) => onChange(v),
      });
      break;
    case 'color':
      el = colorSwatch({ label: def.label, value: String(value), description: def.description, onChange: (v) => onChange(v) });
      break;
    default:
      el = textInput({ label: def.label, value: String(value), onInput: (v) => onChange(v) }) as unknown as HTMLElement & { setValue(v: never): void };
  }
  el.dataset.option = def.key;
  const out = el as unknown as HTMLElement & { setValue(v: OptionValue): void };
  const inner = el.setValue.bind(el) as (v: OptionValue) => void;
  out.setValue = (v: OptionValue) => {
    if (def.type === 'range') inner(Number(v));
    else if (def.type === 'toggle') inner(Boolean(v));
    else inner(String(v));
  };
  return out;
}

/**
 * Grouped form for a list of OptionDefs (collapsible groups with a reset button, `dependsOn`
 * visibility and text filtering).
 */
export function optionsForm(opts: {
  defs: OptionDef[];
  values: OptionValues;
  onChange: (key: string, value: OptionValue, all: OptionValues) => void;
  /** Groups start collapsed except the first (default false = all open) */
  collapsed?: boolean;
}): HTMLElement & { setValues(v: OptionValues): void; getValues(): OptionValues; filter(query: string): number } {
  const values: OptionValues = { ...opts.values };
  const controls = new Map<string, HTMLElement & { setValue(v: OptionValue): void }>();
  const groups = new Map<string, OptionDef[]>();
  for (const d of opts.defs) {
    if (!groups.has(d.group)) groups.set(d.group, []);
    groups.get(d.group)!.push(d);
    if (!(d.key in values)) values[d.key] = d.default;
  }
  const root = h('div', { class: 'options-form' }) as unknown as HTMLElement & {
    setValues(v: OptionValues): void;
    getValues(): OptionValues;
    filter(query: string): number;
  };

  const updateDeps = () => {
    for (const d of opts.defs) {
      if (!d.dependsOn) continue;
      const c = controls.get(d.key);
      if (c) c.hidden = !values[d.dependsOn] || c.dataset.filtered === 'true';
    }
  };
  const set = (key: string, v: OptionValue) => {
    values[key] = v;
    updateDeps();
    opts.onChange(key, v, { ...values });
  };

  let first = true;
  for (const [group, defs] of groups) {
    const body = h('div', { class: 'options-group-body' });
    for (const d of defs) {
      const c = optionControl(d, values[d.key], (v) => set(d.key, v));
      controls.set(d.key, c);
      body.appendChild(c);
    }
    const reset = iconButton('reload', `Reset ${group}`, () => {
      for (const d of defs) {
        if (values[d.key] !== d.default) {
          controls.get(d.key)?.setValue(d.default);
          set(d.key, d.default);
        }
      }
    }, { size: 'sm' });
    reset.addEventListener('click', (e) => e.preventDefault());
    const details = h(
      'details',
      { class: 'options-group', open: !opts.collapsed || first, dataset: { group } },
      h('summary', null, h('span', { class: 'grow' }, group), reset, icon('chevron-down', { class: 'chev' })),
      body,
    );
    first = false;
    root.appendChild(details);
  }
  updateDeps();

  root.setValues = (v: OptionValues) => {
    for (const [k, val] of Object.entries(v)) {
      values[k] = val;
      controls.get(k)?.setValue(val);
    }
    updateDeps();
  };
  root.getValues = () => ({ ...values });
  root.filter = (query: string) => {
    const q = query.trim().toLowerCase();
    let shown = 0;
    root.querySelectorAll<HTMLDetailsElement>('.options-group').forEach((det) => {
      let any = 0;
      for (const d of groups.get(det.dataset.group ?? '') ?? []) {
        const c = controls.get(d.key)!;
        const match = !q || `${d.label} ${d.description ?? ''} ${d.group}`.toLowerCase().includes(q);
        c.dataset.filtered = String(!match);
        c.hidden = !match || (d.dependsOn ? !values[d.dependsOn] : false);
        if (match) any++;
      }
      det.hidden = any === 0;
      if (q && any) det.open = true;
      shown += any;
    });
    return shown;
  };
  return root;
}

// ---------------------------------------------------------------------------------------------
// Surfaces

export function card(opts: { title?: string; icon?: IconName; actions?: Node[]; body: Node | Node[]; class?: string }): HTMLElement {
  const header =
    opts.title || opts.icon || opts.actions?.length
      ? h(
          'div',
          { class: 'card-header' },
          opts.icon ? icon(opts.icon) : null,
          h('h3', { class: 'card-title' }, opts.title ?? ''),
          opts.actions?.length ? h('div', { class: 'card-actions' }, opts.actions) : null,
        )
      : null;
  return h('section', { class: ['card', opts.class] }, header, h('div', { class: 'card-body' }, opts.body));
}

export function tabs<T extends string>(opts: {
  value: T;
  tabs: { value: T; label: string; icon?: IconName }[];
  onChange: (v: T) => void;
  label?: string;
}): HTMLElement & { setValue(v: T): void } {
  let value = opts.value;
  const buttons = opts.tabs.map((t) =>
    h(
      'button',
      { type: 'button', class: 'tab', role: 'tab', 'aria-selected': String(t.value === value), dataset: { value: t.value } },
      t.icon ? icon(t.icon) : null,
      h('span', null, t.label),
    ),
  );
  const el = h('div', { class: 'tabs', role: 'tablist', 'aria-label': opts.label }, buttons) as unknown as HTMLElement & { setValue(v: T): void };
  const paint = () =>
    buttons.forEach((b, i) => {
      const on = opts.tabs[i].value === value;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
  const choose = (i: number) => {
    const v = opts.tabs[i].value;
    if (v === value) return;
    value = v;
    paint();
    opts.onChange(v);
  };
  buttons.forEach((b, i) => b.addEventListener('click', () => choose(i)));
  rovingGroup(buttons, () => Math.max(0, opts.tabs.findIndex((t) => t.value === value)), choose);
  el.setValue = (v: T) => {
    value = v;
    paint();
  };
  paint();
  return el;
}

// ---------------------------------------------------------------------------------------------
// Feedback

export function progressBar(opts: { label?: string } = {}): HTMLElement & { set(p: Progress | null): void } {
  const label = h('span', { class: 'progress-label' }, opts.label ?? '');
  const meta = h('span', { class: 'progress-meta small' });
  const bar = h('div', { class: 'progress-bar' });
  const track = h('div', { class: 'progress-track', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100 }, bar);
  const el = h('div', { class: 'progress' }, h('div', { class: 'progress-head' }, label, meta), track) as unknown as HTMLElement & {
    set(p: Progress | null): void;
  };
  el.set = (p: Progress | null) => {
    if (!p) {
      el.classList.remove('indeterminate');
      bar.style.width = '0%';
      label.textContent = opts.label ?? '';
      meta.textContent = '';
      track.removeAttribute('aria-valuenow');
      return;
    }
    label.textContent = p.label;
    track.setAttribute('aria-label', p.label);
    const bytes = p.loaded !== undefined ? (p.total ? `${formatBytes(p.loaded)} / ${formatBytes(p.total)}` : formatBytes(p.loaded)) : '';
    if (p.fraction === null || !Number.isFinite(p.fraction)) {
      el.classList.add('indeterminate');
      bar.style.width = '';
      track.removeAttribute('aria-valuenow');
      meta.textContent = bytes;
    } else {
      el.classList.remove('indeterminate');
      const pct = Math.max(0, Math.min(1, p.fraction)) * 100;
      bar.style.width = `${pct}%`;
      track.setAttribute('aria-valuenow', String(Math.round(pct)));
      meta.textContent = bytes ? `${bytes} · ${Math.floor(pct)}%` : `${Math.floor(pct)}%`;
    }
  };
  return el;
}

export function spinner(size = 24): HTMLElement {
  const el = h('span', { class: 'spinner', role: 'status', 'aria-label': 'Loading' });
  // whole-pixel cells keep the 3x3 ring crisp at any size
  const cell = Math.max(3, Math.round(size * 0.3));
  const step = Math.max(cell + 1, Math.round(size * 0.35));
  el.style.setProperty('--c', `${cell}px`);
  el.style.setProperty('--st', `${step}px`);
  el.style.setProperty('--sz', `${step * 2 + cell}px`);
  for (let i = 0; i < 8; i++) el.appendChild(document.createElement('i'));
  return el;
}

export function emptyState(opts: { icon: IconName; title: string; text?: string; action?: Node }): HTMLElement {
  return h(
    'div',
    { class: 'empty-state' },
    h('div', { class: 'empty-icon' }, icon(opts.icon, { size: 48 })),
    h('h3', null, opts.title),
    opts.text ? h('p', null, opts.text) : null,
    opts.action ? h('div', { class: 'empty-action' }, opts.action) : null,
  );
}

export function badge(text: string, tone: 'green' | 'blue' | 'purple' | 'gold' | 'red' | 'gray' = 'gray'): HTMLElement {
  return h('span', { class: ['badge', `tone-${tone}`] }, text);
}

/** Small keyboard key label, e.g. kbd('Ctrl'), kbd('Z') */
export function kbd(key: string): HTMLElement {
  return h('kbd', { class: 'kbd' }, key);
}

// ---------------------------------------------------------------------------------------------
// Editor layout (3 columns on desktop, 2 on tablet, tabbed single column on phones)

export type EditorPanel = 'left' | 'center' | 'right';

export function editorLayout(opts: {
  left?: HTMLElement;
  center: HTMLElement;
  right?: HTMLElement;
  labels?: Partial<Record<EditorPanel, string>>;
  icons?: Partial<Record<EditorPanel, IconName>>;
  /** Initially visible panel on phones (default 'center') */
  initial?: EditorPanel;
  onPanelChange?: (p: EditorPanel) => void;
}): HTMLElement & { show(panel: EditorPanel): void; current(): EditorPanel } {
  const labels = { left: 'Browse', center: 'Canvas', right: 'Preview', ...opts.labels };
  const icons: Record<EditorPanel, IconName> = { left: 'bulletlist', center: 'pencil', right: 'eye', ...opts.icons };
  const panels = (['left', 'center', 'right'] as EditorPanel[]).filter((p) => p === 'center' || opts[p]);
  const wrap = (p: EditorPanel, node: HTMLElement) => h('div', { class: `editor-${p}`, dataset: { panel: p } }, node);

  const sideOptions = panels.filter((p) => p !== 'center').map((p) => ({ value: p, label: labels[p], icon: icons[p] }));
  const sideTabs =
    sideOptions.length > 1
      ? segmented<EditorPanel>({ value: sideOptions[0].value, options: sideOptions, size: 'sm', onChange: (v) => setSide(v), label: 'Side panel' })
      : null;
  const bar = h('nav', { class: 'editor-tabbar', 'aria-label': 'Editor panels' });
  const barButtons = new Map<EditorPanel, HTMLButtonElement>();
  for (const p of panels) {
    const b = h('button', { type: 'button', class: 'editor-tab', dataset: { panel: p } }, icon(icons[p]), h('span', null, labels[p]));
    b.addEventListener('click', () => el.show(p));
    barButtons.set(p, b);
    bar.appendChild(b);
  }

  const el = h(
    'div',
    { class: ['editor-layout', 'has-tabs', !opts.left && 'no-left', !opts.right && 'no-right'] },
    sideTabs ? h('div', { class: 'editor-sidetabs' }, sideTabs) : null,
    opts.left ? wrap('left', opts.left) : null,
    wrap('center', opts.center),
    opts.right ? wrap('right', opts.right) : null,
    bar,
  ) as unknown as HTMLElement & { show(panel: EditorPanel): void; current(): EditorPanel };

  let current: EditorPanel = opts.initial ?? 'center';
  function setSide(p: EditorPanel) {
    el.dataset.side = p;
  }
  el.dataset.side = sideOptions[0]?.value ?? 'right';
  el.show = (p: EditorPanel) => {
    current = p;
    el.dataset.panel = p;
    if (p !== 'center') {
      setSide(p);
      sideTabs?.setValue(p);
    }
    barButtons.forEach((b, key) => b.setAttribute('aria-current', key === p ? 'true' : 'false'));
    opts.onPanelChange?.(p);
  };
  el.current = () => current;
  el.show(current);
  return el;
}
