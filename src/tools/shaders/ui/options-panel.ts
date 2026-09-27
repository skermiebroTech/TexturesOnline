// Grouped option controls: collapsible groups with a per-group reset, search, `dependsOn`
// visibility, "changed" markers and controls that are unavailable for the chosen game version.

import type { OptionDef, OptionValue, OptionValues } from '../../../core/types';
import { iconButton, optionControl, textInput, tooltip } from '../../../ui/components';
import { h } from '../../../ui/dom';
import { icon } from '../../../ui/icons';
import { valuesEqual, type BaseGenerator } from './generator';

export interface Availability {
  options: Record<string, boolean>;
  reasons: Record<string, string>;
}

export interface OptionsPanel {
  el: HTMLElement;
  /** Replace all values (undo, presets); does not call onChange */
  setValues(v: OptionValues): void;
  setAvailability(a: Availability | null): void;
  setShowHelp(v: boolean): void;
  focusSearch(): void;
  /** Opens the group containing `key` and scrolls the control into view */
  reveal(key: string): void;
}

type Control = HTMLElement & { setValue(v: OptionValue): void };

export function optionsPanel(opts: {
  gen: BaseGenerator;
  values: OptionValues;
  onChange: (key: string, value: OptionValue) => void;
  onResetGroup: (group: string, keys: string[]) => void;
  collapsed: string[];
  onCollapsedChange: (groups: string[]) => void;
  showHelp: boolean;
}): OptionsPanel {
  const { gen } = opts;
  const defaults = gen.defaults();
  let values: OptionValues = { ...opts.values };
  let availability: Availability | null = null;
  let query = '';
  const controls = new Map<string, Control>();
  const groups = new Map<string, OptionDef[]>();
  for (const d of gen.OPTIONS) {
    if (!groups.has(d.group)) groups.set(d.group, []);
    groups.get(d.group)!.push(d);
  }
  const collapsed = new Set(opts.collapsed);
  const groupEls = new Map<string, { details: HTMLDetailsElement; count: HTMLElement; reset: HTMLButtonElement }>();

  const search = textInput({
    value: '',
    placeholder: 'Search settings',
    icon: 'search',
    type: 'search',
    onInput: (v) => {
      query = v;
      applyVisibility();
    },
  });
  search.classList.add('sh-search');
  search.input.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Escape' && search.input.value) {
      e.stopPropagation();
      search.input.value = '';
      query = '';
      applyVisibility();
    }
  });
  const empty = h('p', { class: 'sh-options-empty muted', hidden: true });
  const list = h('div', { class: 'sh-options' });

  for (const [group, defs] of groups) {
    const body = h('div', { class: 'options-group-body' });
    for (const d of defs) {
      const c = optionControl(d, values[d.key] ?? d.default, (v) => {
        values[d.key] = v;
        markChanged(d.key);
        if (defs.some((x) => x.dependsOn === d.key)) applyVisibility();
        opts.onChange(d.key, v);
      }) as Control;
      c.classList.add('sh-option');
      c.dataset.type = d.type;
      if (d.description) {
        const label = c.querySelector<HTMLElement>('.field-label');
        if (label) {
          label.dataset.help = d.description;
        }
      }
      if (d.dependsOn) c.classList.add('sh-dependent');
      controls.set(d.key, c);
      body.appendChild(c);
    }
    const count = h('span', { class: 'sh-group-count', hidden: true });
    const reset = iconButton('reload', `Reset ${group} to default`, () => opts.onResetGroup(group, defs.map((d) => d.key)), { size: 'sm' });
    reset.classList.add('sh-group-reset');
    reset.addEventListener('click', (e) => e.preventDefault());
    const details = h(
      'details',
      { class: 'options-group sh-group', open: !collapsed.has(group), dataset: { group } },
      h('summary', null, h('span', { class: 'grow truncate' }, group), count, reset, icon('chevron-down', { class: 'chev' })),
      body,
    ) as HTMLDetailsElement;
    details.addEventListener('toggle', () => {
      if (query) return;
      if (details.open) collapsed.delete(group);
      else collapsed.add(group);
      opts.onCollapsedChange([...collapsed]);
    });
    groupEls.set(group, { details, count, reset });
    list.appendChild(details);
  }

  const el = h('div', { class: 'sh-options-wrap' }, h('div', { class: 'sh-options-search' }, search), empty, list);

  function isChanged(key: string): boolean {
    return !valuesEqual(values[key], defaults[key]);
  }

  function markChanged(key: string): void {
    controls.get(key)?.classList.toggle('is-changed', isChanged(key));
    const def = gen.OPTIONS.find((d) => d.key === key);
    if (def) paintGroup(def.group);
  }

  function paintGroup(group: string): void {
    const g = groupEls.get(group);
    if (!g) return;
    const n = (groups.get(group) ?? []).filter((d) => isChanged(d.key)).length;
    g.count.hidden = n === 0;
    g.count.textContent = String(n);
    g.count.setAttribute('aria-label', `${n} changed`);
    tooltip(g.count, `${n} setting${n === 1 ? '' : 's'} changed from the default`);
    g.reset.disabled = n === 0;
  }

  function matches(d: OptionDef, q: string): boolean {
    if (!q) return true;
    return `${d.label} ${d.description ?? ''} ${d.group} ${d.key}`.toLowerCase().includes(q);
  }

  function applyVisibility(): void {
    const q = query.trim().toLowerCase();
    let shown = 0;
    for (const [group, defs] of groups) {
      let any = 0;
      for (const d of defs) {
        const c = controls.get(d.key)!;
        const parentOn = !d.dependsOn || Boolean(values[d.dependsOn]);
        const match = matches(d, q) || (d.dependsOn ? matches(gen.OPTIONS.find((x) => x.key === d.dependsOn) ?? d, q) && parentOn : false);
        c.hidden = !match || !parentOn;
        if (!c.hidden) any++;
      }
      const g = groupEls.get(group)!;
      g.details.hidden = any === 0;
      if (q && any) g.details.open = true;
      else if (!q) g.details.open = !collapsed.has(group);
      shown += any;
    }
    empty.hidden = shown > 0;
    empty.textContent = shown ? '' : `No settings match “${query.trim()}”.`;
  }

  function applyAvailability(): void {
    for (const d of gen.OPTIONS) {
      const c = controls.get(d.key)!;
      const ok = !availability || availability.options[d.key] !== false;
      c.classList.toggle('is-unavailable', !ok);
      c.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>('input, button, select').forEach((x) => (x.disabled = !ok));
      // toggles are a row (text + switch): the note goes under the text
      const host = c.querySelector<HTMLElement>(':scope > .toggle-text') ?? c;
      let note = host.querySelector<HTMLElement>(':scope > .sh-unavailable');
      // a dependent control of an unavailable toggle doesn't repeat the same reason
      const parentOff = Boolean(d.dependsOn && availability && availability.options[d.dependsOn] === false);
      if (!ok && !parentOff) {
        const reason = availability?.reasons[d.key] || 'Not available for this Minecraft version.';
        if (!note) {
          note = h('div', { class: 'sh-unavailable' }, icon('lock'), h('span', { class: 'sh-unavailable-text' }));
          host.appendChild(note);
        }
        note.querySelector('.sh-unavailable-text')!.textContent = reason;
      } else note?.remove();
    }
  }

  for (const d of gen.OPTIONS) controls.get(d.key)?.classList.toggle('is-changed', isChanged(d.key));
  for (const g of groups.keys()) paintGroup(g);
  applyVisibility();

  // Tooltips carry the help text while descriptions are hidden.
  const labels = [...el.querySelectorAll<HTMLElement>('.field-label[data-help]')];
  labels.forEach((label) => tooltip(label, label.dataset.help!));
  const syncHelp = (show: boolean) => {
    el.classList.toggle('hide-help', !show);
    for (const label of labels) {
      if (show) delete label.dataset.tooltip;
      else label.dataset.tooltip = label.dataset.help!;
    }
  };
  syncHelp(opts.showHelp);

  return {
    el,
    setValues(v) {
      values = { ...v };
      for (const d of gen.OPTIONS) {
        const c = controls.get(d.key);
        if (c && v[d.key] !== undefined) c.setValue(v[d.key]);
        c?.classList.toggle('is-changed', isChanged(d.key));
      }
      for (const g of groups.keys()) paintGroup(g);
      applyVisibility();
      applyAvailability();
    },
    setAvailability(a) {
      availability = a;
      applyAvailability();
    },
    setShowHelp(v) {
      syncHelp(v);
    },
    focusSearch() {
      search.input.focus();
      search.input.select();
    },
    reveal(key) {
      const c = controls.get(key);
      if (!c) return;
      const def = gen.OPTIONS.find((d) => d.key === key);
      if (def) groupEls.get(def.group)!.details.open = true;
      c.scrollIntoView({ block: 'center', behavior: 'smooth' });
    },
  };
}
