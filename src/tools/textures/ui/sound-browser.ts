// Left panel in Sounds mode: searchable, categorised, virtualized list of the game's sound events,
// each with a play button. Shares the texture browser's look (search, category picker, Edited chip).

import { h, listen } from '../../../ui/dom';
import { icon, setIcon, type IconName } from '../../../ui/icons';
import { button, emptyState, openPopover, spinner, tooltip, type PopoverHandle } from '../../../ui/components';
import { toast } from '../../../ui/toast';
import { friendlyError } from '../../../core/net';
import { SOUND_CATEGORY_ORDER, searchSoundEvents, type SoundCategory, type SoundEvent } from '../sounds/catalog';
import { fmt, num } from '../../../i18n/editor-text';
import { ts } from './i18n/sounds';
import type { SoundState } from './sound-store';

export const SOUND_CATEGORY_ICONS: Record<SoundCategory, IconName> = {
  ambient: 'wind',
  block: 'box',
  entity: 'human',
  item: 'sword',
  music: 'music',
  records: 'album',
  ui: 'pointer',
  weather: 'cloud',
  other: 'more-horizontal',
};

export interface SoundBrowserApi {
  el: HTMLElement;
  /** Starts loading the sound list (first time Sounds is shown) */
  activate(): void;
  setSelected(id: string | null, reveal?: boolean): void;
  focusSearch(): void;
  destroy(): void;
}

export interface SoundBrowserOptions {
  sounds: SoundState;
  top?: HTMLElement;
  onSelect(e: SoundEvent, how: 'pointer' | 'keyboard' | 'enter'): void;
}

const ROW = 48;
const PAD = 6;
const OVERSCAN = 6;
const nf = { format: (n: number) => num(n) };
type Cat = SoundCategory | 'all';

export function createSoundBrowser(opts: SoundBrowserOptions): SoundBrowserApi {
  const { sounds } = opts;
  let query = '';
  let cat: Cat = 'all';
  let editedOnly = false;
  let items: SoundEvent[] = [];
  let selected: string | null = null;
  let active = -1;
  const cleanups: (() => void)[] = [];

  const input = h('input', {
    class: 'input tx-search-input',
    type: 'search',
    placeholder: ts.browser.search,
    autocomplete: 'off',
    spellcheck: false,
    'aria-label': ts.browser.search,
    enterKeyHint: 'search',
  });
  const clearBtn = h('button', { type: 'button', class: 'icon-btn sm tx-search-clear', 'aria-label': ts.browser.clearSearch, hidden: true }, icon('close'));
  const search = h('div', { class: 'tx-search' }, icon('search', { class: 'tx-search-icon' }), input, clearBtn, h('kbd', { class: 'kbd tx-search-kbd', 'aria-hidden': 'true' }, '/'));

  const catIcon = h('span', { class: 'tx-catpick-icon' });
  const catLabel = h('span', { class: 'tx-catpick-label truncate' });
  const catCount = h('span', { class: 'tx-chip-count' });
  const catPick = h('button', { type: 'button', class: 'chip tx-catpick', 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, catIcon, catLabel, catCount, icon('chevron-down', { class: 'tx-catpick-chev' }));
  tooltip(catPick, ts.browser.kindHint);
  const editedBtn = h('button', { type: 'button', class: 'chip tx-edited-chip', 'aria-pressed': 'false' }, icon('pencil'), h('span', null, ts.browser.edited), h('span', { class: 'tx-chip-count' }, '0'));
  tooltip(editedBtn, ts.browser.editedHint);
  const count = h('span', { class: 'tx-browser-count' });

  const list = h('div', { class: 'snd-list', role: 'listbox', tabIndex: 0, 'aria-label': ts.browser.sounds });
  const sizer = h('div', { class: 'tx-grid-sizer' });
  const scroller = h('div', { class: 'tx-grid-scroll scroll' }, sizer, list);
  const empty = h('div', { class: 'tx-grid-empty', hidden: true });
  const status = h('div', { class: 'tx-browser-status' });

  const el = h(
    'section',
    { class: 'panel tx-browser snd-browser', 'aria-label': ts.browser.label, hidden: true },
    opts.top ?? null,
    h('div', { class: 'tx-browser-head' }, search, catPick),
    h('div', { class: 'tx-browser-bar' }, editedBtn, h('span', { class: 'grow' }), count),
    h('div', { class: 'tx-grid-wrap' }, scroller, empty),
    status,
  );

  // ---- filtering ----
  const all = () => sounds.catalog?.events ?? [];
  const counts = () => {
    const m = new Map<Cat, number>();
    let n = 0;
    for (const e of query ? searchSoundEvents(all(), query) : all()) {
      if (editedOnly && !sounds.isEdited(e)) continue;
      n++;
      m.set(e.category, (m.get(e.category) ?? 0) + 1);
    }
    m.set('all', n);
    return m;
  };
  const catName = (c: Cat) => (c === 'all' ? ts.browser.allSounds : ts.categories[c]);

  function paintHead() {
    const m = counts();
    catIcon.replaceChildren(icon(cat === 'all' ? 'music' : SOUND_CATEGORY_ICONS[cat]));
    catLabel.textContent = catName(cat);
    catCount.textContent = nf.format(m.get(cat) ?? 0);
    catPick.setAttribute('aria-label', fmt(ts.browser.categoryButton, { category: catName(cat), count: m.get(cat) ?? 0 }));
    catPick.classList.toggle('is-filtered', cat !== 'all');
    editedBtn.querySelector('.tx-chip-count')!.textContent = nf.format(sounds.editedEventCount());
    editedBtn.setAttribute('aria-pressed', String(editedOnly));
    const total = all().length;
    count.textContent = items.length === total ? fmt(ts.browser.count, { count: total }) : fmt(ts.browser.countOf, { count: items.length, total });
    clearBtn.hidden = !query;
  }

  let catMenu: PopoverHandle | null = null;
  function openCatMenu() {
    const m = counts();
    const menu = h('div', { class: 'tx-catmenu', role: 'menu', 'aria-label': ts.browser.categories });
    const btns: HTMLButtonElement[] = [];
    const mk = (c: Cat) => {
      const b = h(
        'button',
        { type: 'button', class: 'tx-catmenu-item', role: 'menuitemradio', 'aria-checked': String(cat === c), tabIndex: -1, dataset: { cat: c } },
        icon(c === 'all' ? 'music' : SOUND_CATEGORY_ICONS[c]),
        h('span', { class: 'tx-catmenu-label' }, c === 'all' ? ts.browser.all : ts.categories[c]),
        h('span', { class: 'tx-chip-count' }, nf.format(m.get(c) ?? 0)),
      );
      b.addEventListener('click', () => {
        catMenu?.close();
        cat = c;
        refilter(true);
      });
      btns.push(b);
      menu.appendChild(b);
    };
    mk('all');
    for (const c of SOUND_CATEGORY_ORDER) if ((m.get(c) ?? 0) > 0 || cat === c) mk(c);
    menu.addEventListener('keydown', (ev) => {
      const i = btns.indexOf(document.activeElement as HTMLButtonElement);
      let n = -1;
      if (ev.key === 'ArrowRight') n = Math.min(btns.length - 1, i + 1);
      else if (ev.key === 'ArrowLeft') n = Math.max(0, i - 1);
      else if (ev.key === 'ArrowDown') n = Math.min(btns.length - 1, i + 2);
      else if (ev.key === 'ArrowUp') n = Math.max(0, i - 2);
      else if (ev.key === 'Home') n = 0;
      else if (ev.key === 'End') n = btns.length - 1;
      else if (ev.key === 'Tab') return catMenu?.close();
      if (n < 0) return;
      ev.preventDefault();
      btns[n].focus();
    });
    catPick.setAttribute('aria-expanded', 'true');
    catMenu = openPopover(catPick, menu, {
      placement: 'bottom-start',
      role: 'presentation',
      class: 'tx-catmenu-pop',
      focus: btns.find((b) => b.getAttribute('aria-checked') === 'true') ?? btns[0],
      onClose: () => catPick.setAttribute('aria-expanded', 'false'),
    });
  }
  catPick.addEventListener('click', () => (catMenu?.open ? catMenu.close() : openCatMenu()));
  catPick.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowDown' && !catMenu?.open) {
      ev.preventDefault();
      openCatMenu();
    }
  });

  function computeItems() {
    const base = query ? searchSoundEvents(all(), query) : all();
    items = base.filter((e) => (cat === 'all' || e.category === cat) && (!editedOnly || sounds.isEdited(e)));
  }

  function renderEmpty() {
    const st = sounds.status;
    if (st === 'loading' || st === 'idle') {
      empty.hidden = false;
      empty.replaceChildren(h('div', { class: 'snd-loading' }, spinner(28), h('span', { class: 'muted' }, ts.browser.loading)));
      return;
    }
    if (st === 'error' || st === 'unsupported') {
      empty.hidden = false;
      empty.replaceChildren(
        emptyState({
          icon: st === 'error' ? 'wifi' : 'volume-x',
          title: st === 'error' ? ts.browser.loadFailed : ts.browser.unsupported,
          text: sounds.error || undefined,
          action: st === 'error' ? button({ label: ts.browser.tryAgain, icon: 'reload', size: 'sm', onClick: () => void sounds.load() }) : undefined,
        }),
      );
      return;
    }
    if (items.length) {
      empty.hidden = true;
      return;
    }
    empty.hidden = false;
    if (editedOnly && !sounds.editedEventCount()) {
      empty.replaceChildren(
        emptyState({
          icon: 'music',
          title: ts.browser.noneReplacedTitle,
          text: ts.browser.noneReplacedText,
          action: button({ label: ts.browser.showAll, size: 'sm', onClick: () => ((editedOnly = false), refilter(true)) }),
        }),
      );
    } else {
      empty.replaceChildren(
        emptyState({
          icon: 'search',
          title: ts.browser.noneFound,
          text: query ? fmt(ts.browser.noMatch, { query }) : ts.browser.emptyCategory,
          action: button({
            label: ts.browser.clearFilters,
            size: 'sm',
            onClick: () => {
              query = '';
              input.value = '';
              cat = 'all';
              editedOnly = false;
              refilter(true);
            },
          }),
        }),
      );
    }
  }

  function refilter(resetScroll: boolean) {
    computeItems();
    paintHead();
    renderEmpty();
    active = selected ? items.findIndex((e) => e.id === selected) : -1;
    for (const r of rows.values()) r.remove();
    rows.clear();
    if (resetScroll) scroller.scrollTop = 0;
    layout();
  }

  // ---- virtual list ----
  const rows = new Map<number, HTMLElement>();
  const rowId = (i: number) => `snd-opt-${i}`;
  const playKey = (e: SoundEvent) => `event:${e.id}`;

  function makeRow(i: number): HTMLElement {
    const e = items[i];
    const edited = sounds.isEdited(e);
    const playing = sounds.player.key === playKey(e);
    const play = h('span', { class: 'snd-row-play', dataset: { play: '1' }, 'aria-hidden': 'true' }, icon(playing ? 'stop' : 'play', { size: 16 }));
    const n = e.variants.length;
    return h(
      'div',
      {
        class: ['tx-tile', 'snd-row', edited && 'is-edited', playing && 'is-playing'],
        role: 'option',
        id: rowId(i),
        'aria-selected': String(e.id === selected),
        'aria-label': fmt(ts.browser.row, { name: e.name, replaced: edited ? ts.browser.replacedSuffix : '', count: n }),
        dataset: { index: i },
      },
      play,
      h('span', { class: 'tx-tile-text' }, h('span', { class: 'tx-tile-name' }, e.name), h('span', { class: 'tx-tile-id' }, e.id)),
      h('span', { class: 'snd-row-meta', 'aria-hidden': 'true' }, n > 1 ? h('span', { class: 'snd-row-count' }, `×${n}`) : null, h('span', { class: 'tx-badge-edit', title: ts.browser.replaced }, icon('pencil', { size: 16 }))),
    );
  }

  function layout() {
    const rowsN = items.length;
    sizer.style.height = `${rowsN ? PAD * 2 + rowsN * ROW : 0}px`;
    const top = scroller.scrollTop;
    const vh = scroller.clientHeight || 600;
    const lo = Math.max(0, Math.floor((top - PAD) / ROW) - OVERSCAN);
    const hi = Math.min(rowsN - 1, Math.ceil((top + vh) / ROW) + OVERSCAN);
    for (const [i, r] of rows) {
      if (i < lo || i > hi) {
        r.remove();
        rows.delete(i);
      }
    }
    const frag = document.createDocumentFragment();
    for (let i = lo; i <= hi; i++) {
      if (rows.has(i)) continue;
      const r = makeRow(i);
      r.style.transform = `translateY(${PAD + i * ROW}px)`;
      rows.set(i, r);
      frag.appendChild(r);
    }
    list.appendChild(frag);
    syncActive();
  }

  function syncActive() {
    if (active >= 0 && rows.has(active)) list.setAttribute('aria-activedescendant', rowId(active));
    else list.removeAttribute('aria-activedescendant');
    for (const [i, r] of rows) {
      r.classList.toggle('is-active', i === active);
      r.setAttribute('aria-selected', String(items[i]?.id === selected));
    }
    const e = document.activeElement === list ? items[active] : undefined;
    status.replaceChildren(...(e ? [h('strong', null, e.name), h('span', null, e.id)] : [h('span', null, sounds.status === 'ready' ? ts.browser.spacePlays : '')]));
  }

  function reveal(i: number) {
    if (i < 0) return;
    const y = PAD + i * ROW;
    if (y < scroller.scrollTop) scroller.scrollTop = y - PAD;
    else if (y + ROW > scroller.scrollTop + scroller.clientHeight) scroller.scrollTop = y + ROW - scroller.clientHeight + PAD;
    layout();
  }

  function repaintRows() {
    for (const [i, r] of rows) {
      const e = items[i];
      if (!e) continue;
      const edited = sounds.isEdited(e);
      const playing = sounds.player.key === playKey(e);
      r.classList.toggle('is-edited', edited);
      r.classList.toggle('is-playing', playing);
      const ic = r.querySelector<HTMLElement>('.snd-row-play .icon');
      if (ic) setIcon(ic, playing ? 'stop' : 'play');
    }
  }

  const play = (e: SoundEvent) => {
    sounds.playEvent(e).catch((err) => toast(friendlyError(err), { tone: 'error' }));
  };

  const openAt = (i: number, how: 'pointer' | 'keyboard' | 'enter') => {
    const e = items[i];
    if (!e) return;
    active = i;
    selected = e.id;
    syncActive();
    opts.onSelect(e, how);
  };

  list.addEventListener('click', (ev) => {
    const r = (ev.target as HTMLElement).closest<HTMLElement>('.snd-row');
    if (!r) return;
    const i = Number(r.dataset.index);
    if ((ev.target as HTMLElement).closest('[data-play]')) {
      // select it too (as a keyboard move: phones stay on the list), then play
      if (selected !== items[i]?.id) openAt(i, 'keyboard');
      active = i;
      syncActive();
      play(items[i]);
      return;
    }
    openAt(i, 'pointer');
  });
  list.addEventListener('keydown', (ev) => {
    if (!items.length) return;
    let next = active < 0 ? 0 : active;
    const page = Math.max(1, Math.floor(scroller.clientHeight / ROW) - 1);
    switch (ev.key) {
      case 'ArrowDown':
        next = Math.min(items.length - 1, next + (active < 0 ? 0 : 1));
        break;
      case 'ArrowUp':
        next = Math.max(0, next - 1);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = items.length - 1;
        break;
      case 'PageDown':
        next = Math.min(items.length - 1, next + page);
        break;
      case 'PageUp':
        next = Math.max(0, next - page);
        break;
      case 'Enter':
        ev.preventDefault();
        if (active >= 0) openAt(active, 'enter');
        return;
      case ' ':
        ev.preventDefault();
        if (active >= 0) play(items[active]);
        return;
      default:
        return;
    }
    ev.preventDefault();
    if (next !== active) {
      reveal(next);
      openAt(next, 'keyboard');
    }
  });
  list.addEventListener('focus', () => {
    if (active < 0 && items.length) active = Math.max(0, selected ? items.findIndex((e) => e.id === selected) : 0);
    syncActive();
  });
  list.addEventListener('blur', () => syncActive());

  let searchTimer: ReturnType<typeof setTimeout> | null = null;
  input.addEventListener('input', () => {
    clearBtn.hidden = !input.value;
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      query = input.value.trim();
      refilter(true);
    }, 110);
  });
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && input.value) {
      ev.preventDefault();
      ev.stopPropagation();
      input.value = '';
      query = '';
      refilter(true);
    } else if ((ev.key === 'ArrowDown' || ev.key === 'Enter') && items.length) {
      ev.preventDefault();
      list.focus();
      if (ev.key === 'Enter') {
        reveal(0);
        openAt(0, 'keyboard');
      }
    }
  });
  clearBtn.addEventListener('click', () => {
    input.value = '';
    query = '';
    refilter(true);
    input.focus();
  });
  editedBtn.addEventListener('click', () => {
    editedOnly = !editedOnly;
    refilter(true);
  });

  let raf = 0;
  scroller.addEventListener(
    'scroll',
    () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        layout();
      });
    },
    { passive: true },
  );
  const ro = new ResizeObserver(() => layout());
  ro.observe(scroller);

  let editTimer: ReturnType<typeof setTimeout> | null = null;
  cleanups.push(
    sounds.events.on('status', () => refilter(true)),
    sounds.events.on('edited', () => {
      if (editTimer) return;
      editTimer = setTimeout(() => {
        editTimer = null;
        if (editedOnly) refilter(false);
        else {
          paintHead();
          repaintRows();
        }
      }, 120);
    }),
    sounds.player.events.on('change', () => repaintRows()),
    listen(window, 'resize', () => layout()),
  );

  refilter(true);

  return {
    el,
    activate() {
      void sounds.load();
    },
    setSelected(id, doReveal = true) {
      selected = id;
      active = id ? items.findIndex((e) => e.id === id) : -1;
      if (doReveal && active >= 0) reveal(active);
      else syncActive();
    },
    focusSearch() {
      input.focus();
      input.select();
    },
    destroy() {
      catMenu?.close();
      cleanups.forEach((f) => f());
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      if (searchTimer) clearTimeout(searchTimer);
      if (editTimer) clearTimeout(editTimer);
    },
  };
}
