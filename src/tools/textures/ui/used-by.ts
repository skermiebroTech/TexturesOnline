// "Used by" chips under the texture header: the blocks and items whose models use the open texture.
// Clicking one shows that block in the model workspace.

import { h } from '../../../ui/dom';
import { icon } from '../../../ui/icons';
import { openPopover, tooltip, type PopoverHandle } from '../../../ui/components';
import type { ModelEntry } from '../../../shared/models/index';
import type { ModelService } from './models';
import { paintCanvas } from './thumbs';
import type { TexStore } from './store';

export interface UsedByApi {
  el: HTMLElement;
  setPath(path: string | null): void;
  /** The block / item on show in the workspace (its chip is marked) */
  setCurrent(entry: ModelEntry | null): void;
  destroy(): void;
}

const MAX_CHIPS = 3;

export function createUsedBy(opts: { store: TexStore; models: ModelService; onPick(entry: ModelEntry): void }): UsedByApi {
  const { models, store } = opts;
  let path: string | null = null;
  let current: ModelEntry | null = null;
  let menu: PopoverHandle | null = null;
  const chips = h('div', { class: 'tx-usedby-chips' });
  const el = h('div', { class: 'tx-usedby', hidden: true, role: 'group', 'aria-label': 'Used by' }, h('span', { class: 'tx-usedby-label' }, icon('link', { size: 16 }), 'Used by'), chips);

  const iconInto = (canvas: HTMLCanvasElement, e: ModelEntry) => {
    const draw = (img: HTMLCanvasElement | ImageData | null) => {
      if (!img) return;
      if (img instanceof HTMLCanvasElement) {
        canvas.width = img.width;
        canvas.height = img.height;
        canvas.getContext('2d')?.drawImage(img, 0, 0);
        canvas.classList.add('smooth');
      } else paintCanvas(canvas, img);
    };
    const hit = models.peekIcon(e, store.effectsActive());
    if (hit) draw(hit);
    else void models.icon(e, store.effectsActive()).then(draw);
  };

  const chip = (e: ModelEntry) => {
    const c = h('canvas', { class: 'tx-usedby-icon', 'aria-hidden': 'true' });
    const b = h('button', { type: 'button', class: 'chip tx-usedby-chip', 'aria-pressed': String(!!current && current.kind === e.kind && current.id === e.id), dataset: { kind: e.kind, id: e.id } }, c, h('span', { class: 'truncate' }, e.name));
    tooltip(b, `Show ${e.name} (${e.kind})`);
    b.addEventListener('click', () => opts.onPick(e));
    iconInto(c, e);
    return b;
  };

  function render() {
    menu?.close();
    const lib = models.lib;
    if (!path || !lib?.available || !lib.usageReady) {
      el.hidden = true;
      return;
    }
    const u = lib.usageOf(path);
    const list = [...u.blocks.map((id) => lib.block(id)), ...u.items.map((id) => lib.item(id))].filter((e): e is ModelEntry => !!e);
    // Items with the same id as a listed block add nothing.
    const seen = new Set<string>();
    const entries = list.filter((e) => {
      if (e.kind === 'item' && seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
    if (!entries.length) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    const shown = entries.slice(0, MAX_CHIPS);
    const rest = entries.slice(MAX_CHIPS);
    const nodes: HTMLElement[] = shown.map(chip);
    if (rest.length) {
      const more = h('button', { type: 'button', class: 'chip tx-usedby-more', 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, `+${rest.length}`);
      tooltip(more, `${rest.length} more`);
      more.addEventListener('click', () => {
        if (menu?.open) return menu.close();
        const listEl = h('div', { class: 'tx-usedby-menu', role: 'menu', 'aria-label': 'Also used by' });
        const buttons = rest.map((e) => {
          const c = h('canvas', { class: 'tx-usedby-icon', 'aria-hidden': 'true' });
          const b = h('button', { type: 'button', class: 'tx-usedby-menuitem', role: 'menuitem', tabIndex: -1 }, c, h('span', { class: 'truncate' }, e.name), h('span', { class: 'tx-usedby-kind' }, e.kind === 'block' ? 'Block' : 'Item'));
          b.addEventListener('click', () => {
            menu?.close();
            opts.onPick(e);
          });
          iconInto(c, e);
          return b;
        });
        listEl.append(...buttons);
        listEl.addEventListener('keydown', (ev) => {
          const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
          const n = ev.key === 'ArrowDown' ? Math.min(buttons.length - 1, i + 1) : ev.key === 'ArrowUp' ? Math.max(0, i - 1) : -1;
          if (n < 0) return;
          ev.preventDefault();
          buttons[n].focus();
        });
        more.setAttribute('aria-expanded', 'true');
        menu = openPopover(more, listEl, { placement: 'bottom-start', role: 'presentation', class: 'tx-usedby-pop', focus: buttons[0], onClose: () => more.setAttribute('aria-expanded', 'false') });
      });
      nodes.push(more);
    }
    chips.replaceChildren(...nodes);
  }

  const offs = [models.events.on('usage', () => render())];

  return {
    el,
    setPath(p) {
      path = p;
      if (p && !models.lib) void models.load();
      render();
    },
    setCurrent(e) {
      current = e;
      for (const b of chips.querySelectorAll<HTMLElement>('.tx-usedby-chip')) b.setAttribute('aria-pressed', String(!!e && b.dataset.kind === e.kind && b.dataset.id === e.id));
    },
    destroy() {
      menu?.close();
      offs.forEach((f) => f());
    },
  };
}
