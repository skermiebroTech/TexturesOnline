// Left panel: searchable, filterable, virtualized grid of every texture in the pack.

import type { TextureCategory } from '../../../core/types';
import { h, listen } from '../../../ui/dom';
import { icon } from '../../../ui/icons';
import { emptyState, button, openMenu, openPopover, tooltip, type MenuItem, type PopoverHandle } from '../../../ui/components';
import { TEXTURE_CATEGORY_ORDER } from '../../../editions/index';
import { CATEGORY_INFO, searchScore, tokenize, type TextureEntry } from './meta';
import { paintCanvas, type ThumbService } from './thumbs';
import type { TexStore } from './store';

export interface BrowserApi {
  el: HTMLElement;
  setSelected(path: string | null, reveal?: boolean): void;
  focusSearch(): void;
  focusList(): void;
  /** Visible entries in display order (for prev/next navigation) */
  visible(): TextureEntry[];
  destroy(): void;
}

export interface BrowserOptions {
  store: TexStore;
  thumbs: ThumbService;
  onOpen(path: string, how: 'pointer' | 'keyboard' | 'enter'): void;
  onUpload(path: string): void;
  onDownload(path: string): void;
  onReset(path: string): void;
}

const MIN_TILE = 64;
const GAP = 6;
const PAD = 8;
const LIST_ROW = 48;
const OVERSCAN = 3;
const MODE_KEY = 'to-tex-browser-mode';
const nf = new Intl.NumberFormat();

type Cat = TextureCategory | 'all';

export function createBrowser(opts: BrowserOptions): BrowserApi {
  const { store, thumbs } = opts;
  let query = '';
  let cat: Cat = 'all';
  let editedOnly = false;
  let items: TextureEntry[] = [];
  let selected: string | null = null;
  let active = -1;
  let cols = 3;
  let tileW = 80;
  let rowH = 104;
  let mode: 'grid' | 'list' = 'grid';
  try {
    if (localStorage.getItem(MODE_KEY) === 'list') mode = 'list';
  } catch {
    /* storage blocked */
  }
  const cleanups: (() => void)[] = [];

  // ---- header ----
  const input = h('input', {
    class: 'input tx-search-input',
    type: 'search',
    placeholder: 'Search textures',
    autocomplete: 'off',
    spellcheck: false,
    'aria-label': 'Search textures',
    enterKeyHint: 'search',
  });
  const clearBtn = h('button', { type: 'button', class: 'icon-btn sm tx-search-clear', 'aria-label': 'Clear search', hidden: true }, icon('close'));
  const search = h('div', { class: 'tx-search' }, icon('search', { class: 'tx-search-icon' }), input, clearBtn, h('kbd', { class: 'kbd tx-search-kbd', 'aria-hidden': 'true' }, '/'));

  const editedBtn = h(
    'button',
    { type: 'button', class: 'chip tx-edited-chip', 'aria-pressed': 'false' },
    icon('pencil'),
    h('span', null, 'Edited'),
    h('span', { class: 'tx-chip-count' }, '0'),
  );
  tooltip(editedBtn, 'Show only the textures you changed');
  const fxBtn = h('button', { type: 'button', class: 'icon-btn sm tx-fx-toggle', 'aria-pressed': 'true', 'aria-label': 'Preview effects in thumbnails' }, icon('sparkles'));
  tooltip(fxBtn, 'Preview effects in thumbnails');

  const gridBtn = h('button', { type: 'button', class: 'icon-btn sm', 'aria-pressed': String(mode === 'grid'), 'aria-label': 'Show as a grid' }, icon('grid-2x2-2'));
  const listBtn = h('button', { type: 'button', class: 'icon-btn sm', 'aria-pressed': String(mode === 'list'), 'aria-label': 'Show as a list with names' }, icon('bulletlist'));
  tooltip(gridBtn, 'Grid');
  tooltip(listBtn, 'List with names');
  const setMode = (m: 'grid' | 'list') => {
    if (m === mode) return;
    mode = m;
    gridBtn.setAttribute('aria-pressed', String(m === 'grid'));
    listBtn.setAttribute('aria-pressed', String(m === 'list'));
    grid.classList.toggle('is-list', m === 'list');
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* storage blocked */
    }
    for (const t of tiles.values()) t.remove();
    tiles.clear();
    lastCols = -1;
    layout();
    if (active >= 0) reveal(active);
  };
  gridBtn.addEventListener('click', () => setMode('grid'));
  listBtn.addEventListener('click', () => setMode('list'));
  const status = h('div', { class: 'tx-browser-status' });
  // Category picker: one compact button (a narrow panel can't show 15 chips with counts), opening a
  // grid of category tiles with their counts.
  const catIcon = h('span', { class: 'tx-catpick-icon' });
  const catLabel = h('span', { class: 'tx-catpick-label truncate' });
  const catCount = h('span', { class: 'tx-chip-count' });
  const catPick = h(
    'button',
    { type: 'button', class: 'chip tx-catpick', 'aria-haspopup': 'menu', 'aria-expanded': 'false' },
    catIcon,
    catLabel,
    catCount,
    icon('chevron-down', { class: 'tx-catpick-chev' }),
  );
  tooltip(catPick, 'Show one kind of texture');
  let catMenu: PopoverHandle | null = null;
  catPick.addEventListener('click', () => {
    if (catMenu?.open) catMenu.close();
    else openCatMenu();
  });
  catPick.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowDown' && !catMenu?.open) {
      ev.preventDefault();
      openCatMenu();
    }
  });
  const grid = h('div', { class: ['tx-grid', mode === 'list' && 'is-list'], role: 'listbox', tabIndex: 0, 'aria-label': 'Textures', 'aria-multiselectable': 'false' });
  const sizer = h('div', { class: 'tx-grid-sizer' });
  const scroller = h('div', { class: 'tx-grid-scroll scroll' }, sizer, grid);
  const empty = h('div', { class: 'tx-grid-empty', hidden: true });
  const count = h('span', { class: 'tx-browser-count' });
  const ctxAnchor = h('span', { class: 'tx-ctx-anchor', 'aria-hidden': 'true' });

  const el = h(
    'section',
    { class: 'panel tx-browser', 'aria-label': 'Texture browser' },
    h('div', { class: 'tx-browser-head' }, search, catPick),
    h('div', { class: 'tx-browser-bar' }, editedBtn, h('span', { class: 'grow' }), fxBtn, h('span', { class: 'tx-seg' }, gridBtn, listBtn)),
    h('div', { class: 'tx-grid-wrap' }, scroller, empty),
    status,
    ctxAnchor,
  );

  // ---- filtering ----
  const counts = (): Map<Cat, number> => {
    const m = new Map<Cat, number>();
    const edited = store.editedPaths();
    const toks = tokenize(query);
    let all = 0;
    for (const e of store.entries) {
      if (editedOnly && !edited.has(e.path)) continue;
      if (toks.length && searchScore(toks, e) < 0) continue;
      all++;
      m.set(e.category, (m.get(e.category) ?? 0) + 1);
    }
    m.set('all', all);
    return m;
  };

  const catName = (c: Cat) => (c === 'all' ? 'All textures' : CATEGORY_INFO[c].label);
  const renderCats = () => {
    const m = counts();
    catIcon.replaceChildren(icon(cat === 'all' ? 'grid' : CATEGORY_INFO[cat].icon));
    catLabel.textContent = catName(cat);
    catCount.textContent = nf.format(m.get(cat) ?? 0);
    catPick.setAttribute('aria-label', `Category: ${catName(cat)}, ${m.get(cat) ?? 0} textures. Change category`);
    catPick.classList.toggle('is-filtered', cat !== 'all');
  };

  function openCatMenu() {
    const m = counts();
    const list = h('div', { class: 'tx-catmenu', role: 'menu', 'aria-label': 'Texture categories' });
    const items: HTMLButtonElement[] = [];
    const mk = (c: Cat) => {
      const on = cat === c;
      const b = h(
        'button',
        { type: 'button', class: 'tx-catmenu-item', role: 'menuitemradio', 'aria-checked': String(on), tabIndex: -1, dataset: { cat: c } },
        icon(c === 'all' ? 'grid' : CATEGORY_INFO[c].icon),
        h('span', { class: 'tx-catmenu-label' }, c === 'all' ? 'All' : CATEGORY_INFO[c].label),
        h('span', { class: 'tx-chip-count' }, nf.format(m.get(c) ?? 0)),
      );
      b.addEventListener('click', () => {
        catMenu?.close();
        cat = c;
        refilter(true);
      });
      items.push(b);
      list.appendChild(b);
    };
    mk('all');
    for (const c of TEXTURE_CATEGORY_ORDER) if ((m.get(c) ?? 0) > 0 || cat === c) mk(c);
    list.addEventListener('keydown', (ev) => {
      const i = items.indexOf(document.activeElement as HTMLButtonElement);
      let n = -1;
      if (ev.key === 'ArrowRight') n = Math.min(items.length - 1, i + 1);
      else if (ev.key === 'ArrowLeft') n = Math.max(0, i - 1);
      else if (ev.key === 'ArrowDown') n = Math.min(items.length - 1, i + 2);
      else if (ev.key === 'ArrowUp') n = Math.max(0, i - 2);
      else if (ev.key === 'Home') n = 0;
      else if (ev.key === 'End') n = items.length - 1;
      else if (ev.key === 'Tab') {
        catMenu?.close();
        return;
      }
      if (n < 0) return;
      ev.preventDefault();
      items[n].focus();
    });
    catPick.setAttribute('aria-expanded', 'true');
    catMenu = openPopover(catPick, list, {
      placement: 'bottom-start',
      role: 'presentation',
      class: 'tx-catmenu-pop',
      focus: items.find((b) => b.getAttribute('aria-checked') === 'true') ?? items[0],
      onClose: () => catPick.setAttribute('aria-expanded', 'false'),
    });
  }

  const computeItems = () => {
    const edited = store.editedPaths();
    const toks = tokenize(query);
    const scored: { e: TextureEntry; s: number; i: number }[] = [];
    store.entries.forEach((e, i) => {
      if (cat !== 'all' && e.category !== cat) return;
      if (editedOnly && !edited.has(e.path)) return;
      const s = toks.length ? searchScore(toks, e) : 0;
      if (s < 0) return;
      scored.push({ e, s, i });
    });
    if (toks.length) scored.sort((a, b) => b.s - a.s || a.i - b.i);
    items = scored.map((x) => x.e);
  };

  const paintMeta = () => {
    const n = store.editedCount();
    editedBtn.querySelector('.tx-chip-count')!.textContent = String(n);
    editedBtn.setAttribute('aria-pressed', String(editedOnly));
    fxBtn.hidden = !store.effectsActive();
    fxBtn.setAttribute('aria-pressed', String(thumbs.showEffects));
    const total = store.entries.length;
    count.textContent = items.length === total ? `${nf.format(total)} textures` : `${nf.format(items.length)} of ${nf.format(total)}`;
    clearBtn.hidden = !query;
  };

  const renderEmpty = () => {
    if (items.length) {
      empty.hidden = true;
      return;
    }
    empty.hidden = false;
    if (editedOnly && !store.editedCount()) {
      empty.replaceChildren(
        emptyState({
          icon: 'pencil',
          title: 'Nothing edited yet',
          text: 'Pick any texture and start painting. Everything you change shows up here.',
          action: button({ label: 'Show all textures', size: 'sm', onClick: () => { editedOnly = false; refilter(true); } }),
        }),
      );
    } else {
      empty.replaceChildren(
        emptyState({
          icon: 'search',
          title: 'No textures found',
          text: query ? `Nothing matches "${query}"${cat !== 'all' ? ` in ${CATEGORY_INFO[cat].label}` : ''}. Try a shorter word, like "stone" or "sword".` : 'This category is empty.',
          action: button({
            label: 'Clear filters',
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
  };

  function refilter(resetScroll: boolean) {
    computeItems();
    renderCats();
    paintMeta();
    renderEmpty();
    active = selected ? items.findIndex((e) => e.path === selected) : -1;
    for (const t of tiles.values()) t.remove();
    tiles.clear();
    if (resetScroll) scroller.scrollTop = 0;
    layout();
  }

  // ---- virtual grid ----
  const tiles = new Map<number, HTMLElement>();
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        io.unobserve(en.target);
        void loadThumb(en.target as HTMLElement);
      }
    },
    { root: scroller, rootMargin: '160px 0px' },
  );

  const tileId = (i: number) => `tx-opt-${i}`;

  const setThumb = (tile: HTMLElement, img: ImageData) => {
    const c = tile.querySelector('canvas')!;
    paintCanvas(c, img);
    const box = mode === 'list' ? 32 : tileW - 12;
    const m = Math.max(img.width, img.height);
    let scale = box / m;
    if (m <= box) scale = Math.max(1, Math.floor(box / m));
    c.style.width = `${Math.round(img.width * scale)}px`;
    c.style.height = `${Math.round(img.height * scale)}px`;
    c.classList.toggle('smooth', m > box);
    tile.classList.add('loaded');
  };

  async function loadThumb(tile: HTMLElement) {
    const i = Number(tile.dataset.index);
    const e = items[i];
    if (!e) return;
    const key = thumbs.key(e);
    tile.dataset.key = key;
    const img = await thumbs.get(e);
    if (!tile.isConnected || tile.dataset.key !== key) return;
    if (img) setThumb(tile, img);
    else tile.classList.add('failed');
  }

  const makeTile = (i: number): HTMLElement => {
    const e = items[i];
    const edited = store.isEdited(e.path);
    const tile = h(
      'div',
      {
        class: ['tx-tile', edited && 'is-edited', e.custom && 'is-custom'],
        role: 'option',
        id: tileId(i),
        'aria-selected': String(e.path === selected),
        'aria-label': `${e.pretty}${edited ? ', edited' : ''}${e.animated ? ', animated' : ''}`,
        dataset: { index: i, path: e.path },
      },
      h('span', { class: 'tx-tile-img' }, h('canvas', { class: 'tx-thumb-canvas', 'aria-hidden': 'true' })),
      h('span', { class: 'tx-tile-text' }, h('span', { class: 'tx-tile-name' }, e.pretty), h('span', { class: 'tx-tile-id' }, e.id)),
      h(
        'span',
        { class: 'tx-tile-badges', 'aria-hidden': 'true' },
        e.animated ? h('span', { class: 'tx-badge-anim', title: 'Animated' }, icon('play', { size: 16 })) : null,
        h('span', { class: 'tx-badge-edit', title: 'Edited' }, icon('pencil', { size: 16 })),
      ),
    );
    const cached = thumbs.peek(e);
    if (cached) {
      tile.dataset.key = thumbs.key(e);
      setThumb(tile, cached);
    } else io.observe(tile);
    return tile;
  };

  const place = (tile: HTMLElement, i: number) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    tile.style.transform = `translate(${PAD + c * (tileW + GAP)}px, ${PAD + r * (rowH + GAP)}px)`;
    tile.style.width = `${tileW}px`;
    tile.style.height = `${rowH}px`;
  };

  function measure() {
    const w = scroller.clientWidth;
    if (!w) return false;
    const inner = w - PAD * 2;
    if (mode === 'list') {
      cols = 1;
      tileW = inner;
      rowH = LIST_ROW;
    } else {
      cols = Math.max(1, Math.floor((inner + GAP) / (MIN_TILE + GAP)));
      tileW = Math.floor((inner - GAP * (cols - 1)) / cols);
      rowH = tileW;
    }
    el.style.setProperty('--tile-w', `${tileW}px`);
    return true;
  }

  let lastCols = -1;
  let lastTileW = -1;
  function layout() {
    if (!measure()) return;
    const rows = Math.ceil(items.length / cols);
    sizer.style.height = `${rows ? PAD * 2 + rows * rowH + (rows - 1) * GAP : 0}px`;
    const relayout = cols !== lastCols || tileW !== lastTileW;
    lastCols = cols;
    lastTileW = tileW;
    const top = scroller.scrollTop;
    const vh = scroller.clientHeight || 600;
    const first = Math.max(0, Math.floor((top - PAD) / (rowH + GAP)) - OVERSCAN);
    const last = Math.min(rows - 1, Math.ceil((top + vh) / (rowH + GAP)) + OVERSCAN);
    const lo = first * cols;
    const hi = Math.min(items.length - 1, (last + 1) * cols - 1);
    for (const [i, t] of tiles) {
      if (i < lo || i > hi) {
        io.unobserve(t);
        t.remove();
        tiles.delete(i);
      } else if (relayout) {
        place(t, i);
        const img = t.classList.contains('loaded') ? items[i] && thumbs.peek(items[i]) : null;
        if (img) setThumb(t, img);
      }
    }
    const frag = document.createDocumentFragment();
    for (let i = lo; i <= hi; i++) {
      if (tiles.has(i)) continue;
      const t = makeTile(i);
      place(t, i);
      tiles.set(i, t);
      frag.appendChild(t);
    }
    grid.appendChild(frag);
    syncActive();
  }

  const showStatus = (e: TextureEntry | undefined) => {
    status.replaceChildren(...(e ? [h('strong', null, e.pretty), h('span', null, e.id)] : [count]));
  };
  grid.addEventListener('pointerover', (ev) => {
    const t = (ev.target as HTMLElement).closest<HTMLElement>('.tx-tile');
    if (t) showStatus(items[Number(t.dataset.index)]);
  });
  grid.addEventListener('pointerleave', () => showStatus(undefined));
  const syncActive = () => {
    showStatus(document.activeElement === grid ? items[active] : undefined);
    if (active >= 0 && tiles.has(active)) grid.setAttribute('aria-activedescendant', tileId(active));
    else grid.removeAttribute('aria-activedescendant');
    for (const [i, t] of tiles) {
      t.classList.toggle('is-active', i === active);
      t.setAttribute('aria-selected', String(items[i]?.path === selected));
    }
  };

  const reveal = (i: number) => {
    if (i < 0) return;
    measure();
    const r = Math.floor(i / cols);
    const y = PAD + r * (rowH + GAP);
    if (y < scroller.scrollTop) scroller.scrollTop = y - PAD;
    else if (y + rowH > scroller.scrollTop + scroller.clientHeight) scroller.scrollTop = y + rowH - scroller.clientHeight + PAD;
    layout();
  };

  // ---- refresh single tiles ----
  const refreshTile = (path: string) => {
    for (const [i, t] of tiles) {
      if (items[i]?.path !== path) continue;
      const e = items[i];
      const edited = store.isEdited(path);
      t.classList.toggle('is-edited', edited);
      t.setAttribute('aria-label', `${e.pretty}${edited ? ', edited' : ''}${e.animated ? ', animated' : ''}`);
      void loadThumb(t);
    }
  };
  const pendingPaths = new Set<string>();
  let tileTimer: ReturnType<typeof setTimeout> | null = null;
  const queueRefresh = (path: string) => {
    pendingPaths.add(path);
    if (tileTimer) return;
    tileTimer = setTimeout(() => {
      tileTimer = null;
      const paths = [...pendingPaths];
      pendingPaths.clear();
      paths.forEach(refreshTile);
      paintMeta();
      if (editedOnly) refilter(false);
    }, 180);
  };

  const refreshAllThumbs = () => {
    for (const t of tiles.values()) void loadThumb(t);
    paintMeta();
  };

  // ---- interaction ----
  const openAt = (i: number, how: 'pointer' | 'keyboard' | 'enter') => {
    const e = items[i];
    if (!e) return;
    active = i;
    selected = e.path;
    syncActive();
    opts.onOpen(e.path, how);
  };

  grid.addEventListener('click', (ev) => {
    const t = (ev.target as HTMLElement).closest<HTMLElement>('.tx-tile');
    if (!t) return;
    openAt(Number(t.dataset.index), 'pointer');
  });

  const showMenu = (i: number, x: number, y: number) => {
    const e = items[i];
    if (!e) return;
    active = i;
    syncActive();
    ctxAnchor.style.left = `${Math.round(x)}px`;
    ctxAnchor.style.top = `${Math.round(y)}px`;
    const edited = store.isEdited(e.path);
    const hasVanilla = store.assets.hasFile(e.path);
    const menu: MenuItem[] = [
      { label: 'Open', icon: 'pencil', onClick: () => openAt(i, 'pointer') },
      { label: 'Replace with upload…', icon: 'upload', onClick: () => opts.onUpload(e.path) },
      { label: 'Download PNG', icon: 'download', onClick: () => opts.onDownload(e.path) },
    ];
    if (edited) menu.push({ label: hasVanilla ? 'Reset to vanilla' : 'Remove from pack', icon: 'reset', danger: true, onClick: () => opts.onReset(e.path) });
    openMenu(ctxAnchor, menu, { placement: 'bottom-start', label: `${e.pretty} actions` });
  };

  grid.addEventListener('contextmenu', (ev) => {
    const t = (ev.target as HTMLElement).closest<HTMLElement>('.tx-tile');
    if (!t) return;
    ev.preventDefault();
    showMenu(Number(t.dataset.index), ev.clientX, ev.clientY);
  });

  // long press on touch opens the menu
  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  grid.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType !== 'touch') return;
    const t = (ev.target as HTMLElement).closest<HTMLElement>('.tx-tile');
    if (!t) return;
    const { clientX, clientY } = ev;
    pressTimer = setTimeout(() => {
      pressTimer = null;
      showMenu(Number(t.dataset.index), clientX, clientY);
    }, 550);
  });
  const cancelPress = () => {
    if (pressTimer) clearTimeout(pressTimer);
    pressTimer = null;
  };
  grid.addEventListener('pointerup', cancelPress);
  grid.addEventListener('pointercancel', cancelPress);
  grid.addEventListener('pointermove', (ev) => {
    if (pressTimer && ev.pointerType === 'touch' && (Math.abs(ev.movementX) > 4 || Math.abs(ev.movementY) > 4)) cancelPress();
  });

  grid.addEventListener('keydown', (ev) => {
    if (!items.length) return;
    let next = active < 0 ? 0 : active;
    const pageRows = Math.max(1, Math.floor(scroller.clientHeight / (rowH + GAP)) - 1);
    switch (ev.key) {
      case 'ArrowRight':
        next = Math.min(items.length - 1, next + (active < 0 ? 0 : 1));
        break;
      case 'ArrowLeft':
        next = Math.max(0, next - 1);
        break;
      case 'ArrowDown':
        next = Math.min(items.length - 1, next + (active < 0 ? 0 : cols));
        break;
      case 'ArrowUp':
        next = Math.max(0, next - cols);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = items.length - 1;
        break;
      case 'PageDown':
        next = Math.min(items.length - 1, next + pageRows * cols);
        break;
      case 'PageUp':
        next = Math.max(0, next - pageRows * cols);
        break;
      case 'Enter':
      case ' ':
        ev.preventDefault();
        if (active >= 0) openAt(active, 'enter');
        return;
      case 'ContextMenu':
        ev.preventDefault();
        if (active >= 0) {
          const t = tiles.get(active);
          const r = t?.getBoundingClientRect();
          showMenu(active, r ? r.left + 12 : 0, r ? r.bottom - 8 : 0);
        }
        return;
      case 'F10':
        if (!ev.shiftKey) return;
        ev.preventDefault();
        if (active >= 0) {
          const r = tiles.get(active)?.getBoundingClientRect();
          showMenu(active, r ? r.left + 12 : 0, r ? r.bottom - 8 : 0);
        }
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

  grid.addEventListener('blur', () => showStatus(undefined));
  grid.addEventListener('focus', () => {
    if (active < 0 && items.length) {
      active = Math.max(0, selected ? items.findIndex((e) => e.path === selected) : 0);
      syncActive();
    }
  });

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
    } else if (ev.key === 'ArrowDown' || ev.key === 'Enter') {
      if (!items.length) return;
      ev.preventDefault();
      grid.focus();
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
  fxBtn.addEventListener('click', () => {
    thumbs.showEffects = !thumbs.showEffects;
    refreshAllThumbs();
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

  cleanups.push(
    store.events.on('overrides', ({ path }) => queueRefresh(path)),
    store.events.on('effects', () => {
      thumbs.updateEffects();
      refreshAllThumbs();
    }),
    store.events.on('entries', () => refilter(false)),
    listen(window, 'resize', () => layout()),
  );

  refilter(true);

  return {
    el,
    setSelected(path, doReveal = true) {
      selected = path;
      active = path ? items.findIndex((e) => e.path === path) : -1;
      if (doReveal && active >= 0) reveal(active);
      else syncActive();
    },
    focusSearch() {
      input.focus();
      input.select();
    },
    focusList() {
      grid.focus();
    },
    visible: () => items,
    destroy() {
      catMenu?.close();
      cleanups.forEach((f) => f());
      io.disconnect();
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      if (tileTimer) clearTimeout(tileTimer);
      if (searchTimer) clearTimeout(searchTimer);
    },
  };
}
