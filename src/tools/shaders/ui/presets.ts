// Preset gallery: one card per preset with a little pixel scene in its swatch colours.

import { h } from '../../../ui/dom';
import { icon } from '../../../ui/icons';
import { tooltip } from '../../../ui/components';
import { presetSceneSvg } from './art';
import type { ShaderPresetDef } from './generator';

export interface PresetGallery {
  el: HTMLElement;
  setActive(id: string | null): void;
}

export function presetCardArt(p: ShaderPresetDef, height = 21): HTMLElement {
  const art = h('span', { class: 'sh-preset-art', 'aria-hidden': 'true' });
  art.innerHTML = presetSceneSvg(p.swatch, height);
  art.appendChild(h('span', { class: 'sh-preset-check' }, icon('check')));
  return art;
}

export function presetGallery(opts: {
  presets: ShaderPresetDef[];
  active: string | null;
  onPick: (id: string) => void;
  /** 'apply' buttons act immediately; 'choose' behaves like radio buttons */
  mode?: 'apply' | 'choose';
  label?: string;
}): PresetGallery {
  const mode = opts.mode ?? 'apply';
  const buttons = new Map<string, HTMLButtonElement>();
  const grid = h('div', { class: ['sh-presets', mode === 'choose' && 'is-choice'], role: mode === 'choose' ? 'radiogroup' : 'group', 'aria-label': opts.label ?? 'Presets' });
  for (const p of opts.presets) {
    const b = h(
      'button',
      {
        type: 'button',
        class: 'sh-preset',
        dataset: { preset: p.id },
        role: mode === 'choose' ? 'radio' : undefined,
        'aria-describedby': undefined,
      },
      presetCardArt(p, mode === 'choose' ? 21 : 10),
      h('span', { class: 'sh-preset-name' }, p.label),
      mode === 'choose' && p.description ? h('span', { class: 'sh-preset-desc' }, p.description) : null,
    );
    if (mode === 'apply' && p.description) tooltip(b, p.description);
    b.addEventListener('click', () => opts.onPick(p.id));
    buttons.set(p.id, b);
    grid.appendChild(b);
  }
  if (mode === 'choose') {
    const list = [...buttons.values()];
    grid.addEventListener('keydown', (e) => {
      const i = list.indexOf(document.activeElement as HTMLButtonElement);
      if (i < 0) return;
      const cols = Math.max(1, Math.round(grid.clientWidth / Math.max(1, list[0].offsetWidth)));
      let next = -1;
      if (e.key === 'ArrowRight') next = Math.min(list.length - 1, i + 1);
      else if (e.key === 'ArrowLeft') next = Math.max(0, i - 1);
      else if (e.key === 'ArrowDown') next = Math.min(list.length - 1, i + cols);
      else if (e.key === 'ArrowUp') next = Math.max(0, i - cols);
      if (next < 0 || next === i) return;
      e.preventDefault();
      list[next].focus();
      list[next].click();
    });
  }
  const setActive = (id: string | null) => {
    for (const [pid, b] of buttons) {
      const on = pid === id;
      b.classList.toggle('is-active', on);
      if (mode === 'choose') {
        b.setAttribute('aria-checked', String(on));
        b.tabIndex = on || (!id && pid === opts.presets[0]?.id) ? 0 : -1;
      } else b.setAttribute('aria-pressed', String(on));
    }
  };
  setActive(opts.active);
  return { el: grid, setActive };
}
