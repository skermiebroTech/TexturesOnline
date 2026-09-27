// Options tab of the pack editor: the pack's own menu screens as collapsible sections, switches,
// sliders that snap to the pack's allowed values (with the value names from its lang file),
// drop-downs, quality profiles, search and per-option "reset to pack default".

import { iconButton, tooltip } from '../../../ui/components';
import { h, uid } from '../../../ui/dom';
import { icon } from '../../../ui/icons';
import { formatted } from './fmt';
import { matchingProfile, optionComment, optionLabel, valueLabel, type ProfileDef, type ScreenNode } from './iris-layout';
import type { IrisOption } from './iris-options';
import { listWith } from './iris-rewrite';
import { stripFormatting } from './properties';
import type { IrisModel } from './workspace';

export interface OptionsViewOptions {
  model: IrisModel;
  value(name: string): string;
  onChange(name: string, value: string): void;
  onReset(name: string): void;
  onProfile(p: ProfileDef): void;
  showHelp: boolean;
}

export interface OptionsView {
  el: HTMLElement;
  /** Re-reads the values (all of them after undo, profiles and resets; one after a single change) */
  refresh(name?: string): void;
  /** Filters the options by name, label or description */
  search(query: string): void;
  /** Opens the sections holding the option and scrolls to it */
  reveal(name: string): void;
  setShowHelp(v: boolean): void;
  /** Screen ids that are open (to keep them open after a rebuild) */
  openScreens(): string[];
  restoreOpen(ids: string[]): void;
}

interface Control {
  name: string;
  row: HTMLElement;
  haystack: string;
  set(value: string): void;
}

export function createOptionsView(opts: OptionsViewOptions): OptionsView {
  const { set, layout, lang } = opts.model;
  const controls: Control[] = [];
  const byName = new Map<string, Control[]>();
  const screens: { details: HTMLDetailsElement; names: Set<string>; count: HTMLElement; id: string }[] = [];
  let query = '';

  const isChanged = (o: IrisOption) => opts.value(o.name) !== o.defaultValue;

  // ------------------------------------------------------------------ controls
  function resetButton(o: IrisOption): HTMLButtonElement {
    const b = iconButton('reload', `Reset “${stripFormatting(optionLabel(lang, o.name))}” to the pack default`, () => opts.onReset(o.name), { size: 'sm', class: 'pe-opt-reset' });
    return b;
  }

  function describe(o: IrisOption): { desc: HTMLElement | null; descId?: string } {
    const text = optionComment(lang, o);
    if (!text) return { desc: null };
    const id = uid('pe-desc');
    return { desc: h('div', { class: 'pe-opt-desc', id }, formatted(text)), descId: id };
  }

  function displayValues(o: IrisOption, current: string): string[] {
    return o.values.includes(current) ? o.values : listWith(o.values, [current]);
  }

  function boolControl(o: IrisOption): Control {
    const swId = uid('pe-sw');
    const labelId = uid('pe-lbl');
    const { desc, descId } = describe(o);
    const sw = h('button', { type: 'button', class: 'switch', role: 'switch', id: swId, 'aria-labelledby': labelId, 'aria-describedby': descId });
    const row = h(
      'div',
      { class: 'pe-opt is-bool', dataset: { option: o.name } },
      h('div', { class: 'pe-opt-text' }, h('label', { class: 'pe-opt-label', id: labelId, htmlFor: swId }, formatted(optionLabel(lang, o.name))), desc),
      resetButton(o),
      sw,
    );
    sw.addEventListener('click', () => opts.onChange(o.name, sw.getAttribute('aria-checked') === 'true' ? 'false' : 'true'));
    const set = (v: string) => {
      sw.setAttribute('aria-checked', String(v === 'true'));
      row.classList.toggle('is-changed', v !== o.defaultValue);
    };
    return { name: o.name, row, haystack: '', set };
  }

  function infoControl(o: IrisOption): Control {
    const { desc } = describe(o);
    const valueEl = h('span', { class: 'pe-opt-value' });
    const row = h(
      'div',
      { class: 'pe-opt is-info', dataset: { option: o.name } },
      h('div', { class: 'pe-opt-head' }, h('span', { class: 'pe-opt-label' }, formatted(optionLabel(lang, o.name))), valueEl),
      desc,
    );
    const set = (v: string) => {
      valueEl.replaceChildren(formatted(valueLabel(lang, o, v)));
      row.classList.toggle('is-changed', v !== o.defaultValue);
    };
    return { name: o.name, row, haystack: '', set };
  }

  function sliderControl(o: IrisOption): Control {
    const id = uid('pe-range');
    const { desc, descId } = describe(o);
    let values = displayValues(o, opts.value(o.name));
    const range = h('input', { type: 'range', class: 'range', id, min: '0', max: String(values.length - 1), step: '1', 'aria-describedby': descId });
    const valueEl = h('output', { class: 'pe-opt-value', htmlFor: id });
    const ticks = h('div', { class: 'pe-ticks', 'aria-hidden': 'true' });
    const row = h(
      'div',
      { class: 'pe-opt is-slider', dataset: { option: o.name } },
      h('div', { class: 'pe-opt-head' }, h('label', { class: 'pe-opt-label', htmlFor: id }, formatted(optionLabel(lang, o.name))), valueEl, resetButton(o)),
      h('div', { class: 'pe-range-wrap' }, range, ticks),
      desc,
    );
    const paintTicks = () => {
      ticks.replaceChildren();
      if (values.length <= 24) for (let i = 0; i < values.length; i++) ticks.appendChild(h('i', { style: { left: `${values.length > 1 ? (i / (values.length - 1)) * 100 : 0}%` } }));
    };
    paintTicks();
    const paint = (v: string) => {
      const next = displayValues(o, v);
      if (next.length !== values.length) {
        values = next;
        range.max = String(values.length - 1);
        paintTicks();
      }
      const i = Math.max(0, values.indexOf(v));
      range.value = String(i);
      range.style.setProperty('--fill', `${values.length > 1 ? (i / (values.length - 1)) * 100 : 0}%`);
      const label = valueLabel(lang, o, v);
      valueEl.replaceChildren(formatted(label));
      range.setAttribute('aria-valuetext', stripFormatting(label));
      row.classList.toggle('is-changed', v !== o.defaultValue);
    };
    range.addEventListener('input', () => {
      const v = values[Number(range.value)];
      if (v === undefined) return;
      paint(v);
      opts.onChange(o.name, v);
    });
    return { name: o.name, row, haystack: '', set: paint };
  }

  function selectControl(o: IrisOption): Control {
    const id = uid('pe-select');
    const { desc, descId } = describe(o);
    const sel = h('select', { class: 'select-input', id, 'aria-describedby': descId });
    let shown: string[] = [];
    const fill = (v: string) => {
      const list = displayValues(o, v);
      if (list.join('\u{0}') === shown.join('\u{0}')) return;
      shown = list;
      sel.replaceChildren(...list.map((x) => h('option', { value: x }, stripFormatting(valueLabel(lang, o, x)))));
    };
    const row = h(
      'div',
      { class: 'pe-opt is-select', dataset: { option: o.name } },
      h('div', { class: 'pe-opt-head' }, h('label', { class: 'pe-opt-label', htmlFor: id }, formatted(optionLabel(lang, o.name))), resetButton(o)),
      h('div', { class: 'select' }, sel, icon('chevron-down', { class: 'select-chevron' })),
      desc,
    );
    sel.addEventListener('change', () => opts.onChange(o.name, sel.value));
    const set = (v: string) => {
      fill(v);
      sel.value = v;
      row.classList.toggle('is-changed', v !== o.defaultValue);
    };
    return { name: o.name, row, haystack: '', set };
  }

  function control(o: IrisOption): Control {
    let c: Control;
    if (o.kind === 'bool') c = boolControl(o);
    else if (o.values.length <= 1) c = infoControl(o);
    else if (layout.sliders.has(o.name)) c = sliderControl(o);
    else c = selectControl(o);
    c.haystack = `${stripFormatting(optionLabel(lang, o.name))} ${o.name} ${stripFormatting(optionComment(lang, o))}`.toLowerCase();
    c.set(opts.value(o.name));
    controls.push(c);
    const list = byName.get(o.name) ?? [];
    list.push(c);
    byName.set(o.name, list);
    return c;
  }

  // ------------------------------------------------------------------ profiles
  const profileButtons = new Map<string, HTMLButtonElement>();
  const customChip = h('span', { class: 'pe-profile-custom', hidden: true }, icon('pencil'), h('span', null, 'Custom'));
  const profileRow = layout.profiles.length
    ? h(
        'div',
        { class: 'pe-profiles', role: 'group', 'aria-label': 'Quality profile' },
        h('span', { class: 'pe-profiles-label' }, icon('speed-fast'), h('span', null, 'Profile')),
        h(
          'div',
          { class: 'pe-profile-list' },
          layout.profiles.map((p) => {
            const b = h('button', { type: 'button', class: 'pe-profile', 'aria-pressed': 'false', dataset: { profile: p.id } }, formatted(p.label));
            b.addEventListener('click', () => opts.onProfile(p));
            profileButtons.set(p.id, b);
            return b;
          }),
          customChip,
        ),
      )
    : null;
  if (profileRow && layout.profileComment) tooltip(profileRow.querySelector('.pe-profiles-label') as HTMLElement, stripFormatting(layout.profileComment));

  function paintProfiles(): void {
    if (!profileRow) return;
    const m = matchingProfile(layout.profiles, (n) => opts.value(n));
    for (const [id, b] of profileButtons) b.setAttribute('aria-pressed', String(m?.id === id));
    customChip.hidden = Boolean(m);
  }

  // ------------------------------------------------------------------ screens
  function renderItems(items: ScreenNode['items'], into: HTMLElement, names: Set<string>[]): void {
    for (const item of items) {
      if (item.type === 'profile') continue; // shown once at the top
      if (item.type === 'option') {
        const o = set.options.get(item.name);
        if (!o) continue;
        into.appendChild(control(o).row);
        for (const s of names) s.add(o.name);
        continue;
      }
      into.appendChild(screenEl(item.screen, names));
    }
  }

  function screenEl(node: ScreenNode, parents: Set<string>[]): HTMLElement {
    const own = new Set<string>();
    const body = h('div', { class: 'pe-screen-body' });
    if (node.comment) body.appendChild(h('p', { class: 'pe-screen-comment' }, formatted(node.comment)));
    const count = h('span', { class: 'pe-count', hidden: true });
    const details = h(
      'details',
      { class: 'pe-screen', dataset: { screen: node.id } },
      h('summary', null, icon('chevron-right', { class: 'pe-chev' }), h('span', { class: 'pe-screen-title truncate' }, formatted(node.label)), count),
      body,
    ) as HTMLDetailsElement;
    renderItems(node.items, body, [...parents, own]);
    screens.push({ details, names: own, count, id: node.id });
    details.addEventListener('toggle', () => {
      if (!query) details.dataset.userOpen = details.open ? '1' : '';
    });
    return details;
  }

  const tree = h('div', { class: 'pe-tree' });
  renderItems(layout.main.items, tree, []);
  if (layout.hidden.length) {
    const hiddenNode: ScreenNode = {
      id: '__hidden',
      label: `Not in the game menu (${layout.hidden.length})`,
      comment: layout.hasScreenLayout
        ? "The pack doesn't show these in its in-game menu. Many are internal switches, so change them only if you know what they do."
        : '',
      items: layout.hidden.map((name) => ({ type: 'option' as const, name })),
    };
    const el = screenEl(hiddenNode, []);
    el.classList.add('is-hidden-options');
    tree.appendChild(el);
  }
  const empty = h('p', { class: 'pe-empty muted', hidden: true });
  if (!set.options.size) {
    empty.hidden = false;
    empty.textContent = "This pack has no options a menu can change. You can still edit its files in the Files tab.";
  }

  const el = h('div', { class: ['pe-options', !opts.showHelp && 'hide-help'] }, profileRow, tree, empty);

  // ------------------------------------------------------------------ state
  function paintCounts(): void {
    for (const s of screens) {
      let n = 0;
      for (const name of s.names) {
        const o = set.options.get(name);
        if (o && isChanged(o)) n++;
      }
      s.count.hidden = n === 0;
      s.count.textContent = String(n);
      s.count.setAttribute('aria-label', `${n} changed`);
    }
  }

  function refresh(name?: string): void {
    for (const c of name ? (byName.get(name) ?? []) : controls) c.set(opts.value(c.name));
    paintCounts();
    paintProfiles();
  }

  function applySearch(): void {
    const q = query.trim().toLowerCase();
    let shown = 0;
    for (const c of controls) {
      const match = !q || c.haystack.includes(q);
      c.row.hidden = !match;
      if (match) shown++;
    }
    // `screens` lists children before their parents, so parents see their children's state
    for (const s of screens) {
      if (!q) {
        s.details.hidden = false;
        s.details.open = s.details.dataset.userOpen === '1';
        continue;
      }
      const any = [...s.details.querySelectorAll<HTMLElement>(':scope > .pe-screen-body > .pe-opt, :scope > .pe-screen-body > .pe-screen')].some((x) => !x.hidden);
      s.details.hidden = !any;
      s.details.open = any;
    }
    if (set.options.size) {
      empty.hidden = !q || shown > 0;
      empty.textContent = shown ? '' : `No options match “${query.trim()}”.`;
    }
    if (profileRow) profileRow.hidden = Boolean(q);
  }

  refresh();

  return {
    el,
    refresh,
    search(q) {
      query = q;
      applySearch();
    },
    reveal(name) {
      const c = byName.get(name)?.find((x) => !x.row.hidden) ?? byName.get(name)?.[0];
      if (!c) return;
      let p: HTMLElement | null = c.row.parentElement;
      while (p && p !== el) {
        if (p instanceof HTMLDetailsElement) {
          p.open = true;
          p.dataset.userOpen = '1';
        }
        p = p.parentElement;
      }
      c.row.scrollIntoView({ block: 'center', behavior: 'smooth' });
      c.row.classList.remove('is-flash');
      void c.row.offsetWidth;
      c.row.classList.add('is-flash');
    },
    setShowHelp(v) {
      el.classList.toggle('hide-help', !v);
    },
    openScreens() {
      return screens.filter((s) => s.details.dataset.userOpen === '1').map((s) => s.id);
    },
    restoreOpen(ids) {
      const want = new Set(ids);
      for (const s of screens) {
        const open = want.has(s.id);
        s.details.dataset.userOpen = open ? '1' : '';
        if (!query) s.details.open = open;
      }
    },
  };
}
