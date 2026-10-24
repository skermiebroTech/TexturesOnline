// Left panel: searchable, filterable, virtualized grid of every texture in the pack.

import type { TextureCategory } from '../../../core/types';
import { h, listen } from '../../../ui/dom';
import { icon } from '../../../ui/icons';
import { emptyState, button, openMenu, openPopover, tooltip, type MenuItem, type PopoverHandle } from '../../../ui/components';
import { TEXTURE_CATEGORY_ORDER } from '../../../editions/index';
import { CATEGORY_INFO, searchScore, tokenize, type TextureEntry } from './meta';
import { afterNextPaint } from '../../../core/yield';
import { thumbUrl, type ThumbService } from './thumbs';
import type { TexStore } from './store';
import { fmt, num } from '../../../i18n/editor-text';
import { te } from './i18n/editor';

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
  /** Shown above the search (the Blocks / Items / Mobs / Textures switch) */
  top?: HTMLElement;
}

const MIN_TILE = 64;
const GAP = 6;
const PAD = 8;
const LIST_ROW = 48;
const OVERSCAN = 3;
const MODE_KEY = 'to-tex-browser-mode';
const nf = { format: (n: number) => num(n) };

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
    placeholder: te.browser.search,
    autocomplete: 'off',
    spellcheck: false,
    'aria-label': te.browser.search,
    enterKeyHint: 'search',
  });
  const clearBtn = h('button', { type: 'button', class: 'icon-btn sm tx-search-clear', 'aria-label': te.browser.clearSearch, hidden: true }, icon('close'));
  const search = h('div', { class: 'tx-search' }, icon('search', { class: 'tx-search-icon' }), input, clearBtn, h('kbd', { class: 'kbd tx-search-kbd', 'aria-hidden': 'true' }, '/'));

  const editedBtn = h(
    'button',
    { type: 'button', class: 'chip tx-edited-chip', 'aria-pressed': 'false' },
    icon('pencil'),
    h('span', null, te.browser.edited),
    h('span', { class: 'tx-chip-count' }, '0'),
  );
  tooltip(editedBtn, te.browser.editedHint);
  const fxBtn = h('button', { type: 'button', class: 'icon-btn sm tx-fx-toggle', 'aria-pressed': 'true', 'aria-label': te.browser.fxThumbs }, icon('sparkles'));
  tooltip(fxBtn, te.browser.fxThumbs);

  const gridBtn = h('button', { type: 'button', class: 'icon-btn sm', 'aria-pressed': String(mode === 'grid'), 'aria-label': te.browser.showGrid }, icon('grid-2x2-2'));
  const listBtn = h('button', { type: 'button', class: 'icon-btn sm', 'aria-pressed': String(mode === 'list'), 'aria-label': te.browser.showList }, icon('bulletlist'));
  tooltip(gridBtn, te.browser.grid);
  tooltip(listBtn, te.browser.list);
  const setMode = (m: 'grid' | 'list') => {
    if (m === mode) return;
    // the list's box before the switch restyles every tile (see readBox)
    readBox();
    mode = m;
    gridBtn.setAttribute('aria-pressed', String(m === 'grid'));
    listBtn.setAttribute('aria-pressed', String(m === 'list'));
    grid.classList.toggle('is-list', m === 'list');
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* storage blocked */
    }
    recycleTiles();
    lastCols = -1;
    leanLayout(() => {
      layout();
      if (active >= 0) reveal(active);
    });
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
  tooltip(catPick, te.browser.kindHint);
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
  const grid = h('div', { class: ['tx-grid', mode === 'list' && 'is-list'], role: 'listbox', tabIndex: 0, 'aria-label': te.browser.textures, 'aria-multiselectable': 'false' });
  const sizer = h('div', { class: 'tx-grid-sizer' });
  const scroller = h('div', { class: 'tx-grid-scroll scroll' }, sizer, grid);
  const empty = h('div', { class: 'tx-grid-empty', hidden: true });
  const count = h('span', { class: 'tx-browser-count' });
  const ctxAnchor = h('span', { class: 'tx-ctx-anchor', 'aria-hidden': 'true' });

  const el = h(
    'section',
    { class: 'panel tx-browser', 'aria-label': te.browser.label },
    opts.top ?? null,
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

  const catName = (c: Cat) => (c === 'all' ? te.lib.allTextures : CATEGORY_INFO[c].label);
  const renderCats = () => {
    const m = counts();
    catIcon.replaceChildren(icon(cat === 'all' ? 'grid' : CATEGORY_INFO[cat].icon));
    catLabel.textContent = catName(cat);
    catCount.textContent = nf.format(m.get(cat) ?? 0);
    catPick.setAttribute('aria-label', fmt(te.browser.categoryButton, { category: catName(cat), count: m.get(cat) ?? 0 }));
    catPick.classList.toggle('is-filtered', cat !== 'all');
  };

  function openCatMenu() {
    const m = counts();
    const list = h('div', { class: 'tx-catmenu', role: 'menu', 'aria-label': te.browser.categories });
    const items: HTMLButtonElement[] = [];
    const mk = (c: Cat) => {
      const on = cat === c;
      const b = h(
        'button',
        { type: 'button', class: 'tx-catmenu-item', role: 'menuitemradio', 'aria-checked': String(on), tabIndex: -1, dataset: { cat: c } },
        icon(c === 'all' ? 'grid' : CATEGORY_INFO[c].icon),
        h('span', { class: 'tx-catmenu-label' }, c === 'all' ? te.browser.all : CATEGORY_INFO[c].label),
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
    count.textContent = items.length === total ? fmt(te.browser.count, { count: total }) : fmt(te.browser.countOf, { count: items.length, total });
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
          title: te.browser.nothingEditedTitle,
          text: te.browser.nothingEditedText,
          action: button({ label: te.browser.showAll, size: 'sm', onClick: () => { editedOnly = false; refilter(true); } }),
        }),
      );
    } else {
      empty.replaceChildren(
        emptyState({
          icon: 'search',
          title: te.browser.noneFoundTitle,
          text: query ? (cat !== 'all' ? fmt(te.browser.noMatchIn, { query, category: CATEGORY_INFO[cat].label }) : fmt(te.browser.noMatch, { query })) : te.browser.emptyCategory,
          action: button({
            label: te.browser.clearFilters,
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

  /** `lean`: a tap changed the list (see leanLayout); typing in the search box isn't one. */
  function refilter(resetScroll: boolean, lean = true) {
    computeItems();
    renderCats();
    paintMeta();
    renderEmpty();
    active = selected ? items.findIndex((e) => e.path === selected) : -1;
    recycleTiles();
    if (resetScroll) scrollListTo(0);
    if (lean) leanLayout(layout);
    else layout();
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

  /**
   * Sizes a tile's thumbnail for the view (grid tile width or list row) from its picture's size. The
   * picture is an <img> (see thumbUrl): dozens of new tiles then cost no GPU texture each.
   */
  const fitThumb = (c: HTMLImageElement) => {
    const w = Number(c.dataset.w) || 1;
    const hgt = Number(c.dataset.h) || 1;
    const box = mode === 'list' ? 32 : tileW - 12;
    const m = Math.max(w, hgt);
    let scale = box / m;
    if (m <= box) scale = Math.max(1, Math.floor(box / m));
    c.style.width = `${Math.round(w * scale)}px`;
    c.style.height = `${Math.round(hgt * scale)}px`;
    c.classList.toggle('smooth', m > box);
  };
  const setThumb = (tile: HTMLElement, img: ImageData) => {
    const c = tile.querySelector('img')!;
    c.dataset.w = String(img.width);
    c.dataset.h = String(img.height);
    c.src = thumbUrl(img);
    fitThumb(c);
    tile.classList.add('loaded');
  };

  // Tiles of the last layout, by texture, after the list changed (filter, search, grid / list): the
  // next layout reuses the ones it still shows instead of building them (and their canvases) again.
  const tileEntry = new WeakMap<HTMLElement, TextureEntry>();
  const spare = new Map<string, HTMLElement>();
  const recycleTiles = () => {
    for (const t of tiles.values()) {
      const e = tileEntry.get(t);
      if (e) spare.set(e.path, t);
      else t.remove();
    }
    tiles.clear();
  };
  const reuseTile = (i: number): HTMLElement | null => {
    const e = items[i];
    const t = e ? spare.get(e.path) : undefined;
    if (!t || tileEntry.get(t) !== e) return null;
    spare.delete(e.path);
    t.id = tileId(i);
    t.dataset.index = String(i);
    if (t.classList.contains('loaded')) fitThumb(t.querySelector('img')!);
    return t;
  };
  const dropSpare = () => {
    for (const t of spare.values()) {
      io.unobserve(t);
      t.remove();
    }
    spare.clear();
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
        'aria-label': `${e.pretty}${edited ? te.browser.editedSuffix : ''}${e.animated ? te.browser.animatedSuffix : ''}`,
        dataset: { index: i, path: e.path },
      },
      h('span', { class: 'tx-tile-img' }, h('img', { class: 'tx-thumb-canvas', alt: '', 'aria-hidden': 'true', decoding: 'sync', draggable: false })),
      h('span', { class: 'tx-tile-text' }, h('span', { class: 'tx-tile-name' }, e.pretty), h('span', { class: 'tx-tile-id' }, e.id)),
      h(
        'span',
        { class: 'tx-tile-badges', 'aria-hidden': 'true' },
        e.animated ? h('span', { class: 'tx-badge-anim', title: te.browser.animated }, icon('play', { size: 16 })) : null,
        h('span', { class: 'tx-badge-edit', title: te.browser.edited }, icon('pencil', { size: 16 })),
      ),
    );
    tileEntry.set(tile, e);
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
    // left / top rather than a transform: a transform per tile splits the page's painting into a
    // piece per tile, which every frame then has to sort into layers
    tile.style.left = `${PAD + c * (tileW + GAP)}px`;
    tile.style.top = `${PAD + r * (rowH + GAP)}px`;
    tile.style.width = `${tileW}px`;
    tile.style.height = `${rowH}px`;
  };

  /**
   * The list's box (client size, scroll position), read once per task: reading it again after the
   * tiles changed (a second layout, a reveal) would lay the page out an extra time before the paint.
   */
  let box: { w: number; h: number; top: number } | null = null;
  function readBox(): { w: number; h: number; top: number } {
    if (!box) {
      box = { w: scroller.clientWidth, h: scroller.clientHeight, top: scroller.scrollTop };
      queueMicrotask(() => (box = null));
    }
    return box;
  }
  function scrollListTo(top: number) {
    const b = readBox();
    if (b.top === top) return;
    scroller.scrollTop = top;
    b.top = top;
  }

  let tileVar = '';
  function measure() {
    const w = readBox().w;
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
    if (tileVar !== `${tileW}px`) {
      tileVar = `${tileW}px`;
      el.style.setProperty('--tile-w', tileVar);
    }
    return true;
  }

  let lastCols = -1;
  let lastTileW = -1;
  /**
   * After a tap that changes the list (filter, search, grid / list), only the rows on screen are built
   * before the next paint; the rows just outside it (for smooth scrolling) follow right after.
   */
  let lean = false;
  let fillPending = false;
  function leanLayout(run: () => void) {
    lean = true;
    try {
      run();
    } finally {
      lean = false;
    }
    if (fillPending) return;
    fillPending = true;
    void afterNextPaint().then(() => {
      fillPending = false;
      layout();
    });
  }

  function layout() {
    if (!measure()) {
      dropSpare();
      return;
    }
    const rows = Math.ceil(items.length / cols);
    sizer.style.height = `${rows ? PAD * 2 + rows * rowH + (rows - 1) * GAP : 0}px`;
    const relayout = cols !== lastCols || tileW !== lastTileW;
    lastCols = cols;
    lastTileW = tileW;
    const { top, h: vh0 } = readBox();
    const vh = vh0 || 600;
    const over = lean ? 0 : OVERSCAN;
    const first = Math.max(0, Math.floor((top - PAD) / (rowH + GAP)) - over);
    const last = Math.min(rows - 1, Math.ceil((top + vh) / (rowH + GAP)) + over);
    const lo = first * cols;
    const hi = Math.min(items.length - 1, (last + 1) * cols - 1);
    // tiles already built just outside the screen stay (a lean layout only builds fewer)
    const keepLo = Math.max(0, Math.floor((top - PAD) / (rowH + GAP)) - OVERSCAN) * cols;
    const keepHi = Math.min(items.length - 1, (Math.min(rows - 1, Math.ceil((top + vh) / (rowH + GAP)) + OVERSCAN) + 1) * cols - 1);
    for (const [i, t] of tiles) {
      if (i < keepLo || i > keepHi) {
        io.unobserve(t);
        t.remove();
        tiles.delete(i);
      } else if (relayout) {
        place(t, i);
        if (t.classList.contains('loaded')) fitThumb(t.querySelector('img')!);
      }
    }
    const frag = document.createDocumentFragment();
    for (let i = lo; i <= hi; i++) {
      if (tiles.has(i)) continue;
      const reused = reuseTile(i);
      const t = reused ?? makeTile(i);
      place(t, i);
      tiles.set(i, t);
      if (!reused) frag.appendChild(t);
    }
    dropSpare();
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
    const b = readBox();
    if (y < b.top) scrollListTo(y - PAD);
    else if (y + rowH > b.top + b.h) scrollListTo(y + rowH - b.h + PAD);
    layout();
  };

  // ---- refresh single tiles ----
  const refreshTile = (path: string) => {
    for (const [i, t] of tiles) {
      if (items[i]?.path !== path) continue;
      const e = items[i];
      const edited = store.isEdited(path);
      t.classList.toggle('is-edited', edited);
      t.setAttribute('aria-label', `${e.pretty}${edited ? te.browser.editedSuffix : ''}${e.animated ? te.browser.animatedSuffix : ''}`);
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
      { label: te.browser.open, icon: 'pencil', onClick: () => openAt(i, 'pointer') },
      { label: te.browser.replace, icon: 'upload', onClick: () => opts.onUpload(e.path) },
      { label: te.browser.downloadPng, icon: 'download', onClick: () => opts.onDownload(e.path) },
    ];
    if (edited) menu.push({ label: hasVanilla ? te.browser.resetVanilla : te.browser.removeFromPack, icon: 'reset', danger: true, onClick: () => opts.onReset(e.path) });
    openMenu(ctxAnchor, menu, { placement: 'bottom-start', label: fmt(te.browser.actions, { name: e.pretty }) });
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
      refilter(true, false);
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
    // focus first, while the layout is still clean (after the new list it would lay out the page)
    input.focus();
    refilter(true);
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
  // Hidden (another library mode, another tab on phones): nothing to lay out, and no layout to read.
  // Shown again: the rows on screen first, the rest after the paint (as after a tap).
  let shown = false;
  const ro = new ResizeObserver((entries) => {
    const box = entries[entries.length - 1]?.contentRect;
    if (!box || (!box.width && !box.height)) {
      shown = false;
      dropSpare();
      return;
    }
    if (shown) layout();
    else {
      shown = true;
      leanLayout(layout);
    }
  });
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
