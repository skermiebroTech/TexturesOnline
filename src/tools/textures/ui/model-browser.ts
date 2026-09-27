// Left panel in Blocks / Items mode: a searchable, filterable, virtualized list of the version's blocks
// or items with inventory-style icons. Picking one opens it in the model workspace.

import { h, listen } from '../../../ui/dom';
import { icon, type IconName } from '../../../ui/icons';
import { button, emptyState, openPopover, progressBar, spinner, tooltip, type PopoverHandle } from '../../../ui/components';
import type { ModelCategory, ModelEntry, ModelLibrary } from '../../../shared/models/index';
import { paintCanvas } from './thumbs';
import type { ModelService } from './models';
import type { TexStore } from './store';

export type LibraryKind = 'block' | 'item';

export interface ModelBrowserApi {
  el: HTMLElement;
  setKind(kind: LibraryKind): void;
  setSelected(kind: LibraryKind, id: string | null, reveal?: boolean): void;
  focusSearch(): void;
  /** The list is visible (starts loading the library) */
  activate(): void;
  destroy(): void;
}

export interface ModelBrowserOptions {
  store: TexStore;
  models: ModelService;
  /** Mode switch shown at the top */
  top: HTMLElement;
  onOpen(entry: ModelEntry, how: 'pointer' | 'keyboard' | 'enter'): void;
  onShowTextures(): void;
}

type Cat = 'all' | ModelCategory | 'sprite' | 'blockitem';

/** label: on the picker button; short: in the menu (two narrow columns) */
const CATS: Record<LibraryKind, { value: Cat; label: string; short: string; icon: IconName; hint: string }[]> = {
  block: [
    { value: 'all', label: 'All blocks', short: 'All', icon: 'grid', hint: 'Every block' },
    { value: 'cube', label: 'Full blocks', short: 'Cubes', icon: 'cube', hint: 'Whole-block cubes' },
    { value: 'shape', label: 'Shaped blocks', short: 'Shaped', icon: 'shapes', hint: 'Stairs, slabs, doors, fences and other shapes' },
    { value: 'plant', label: 'Plants', short: 'Plants', icon: 'leaf', hint: 'Flowers, crops and other crossed planes' },
    { value: 'special', label: 'Drawn by the game', short: 'Special', icon: 'sparkles', hint: 'Chests, banners, heads, liquids: drawn by the game’s own code' },
  ],
  item: [
    { value: 'all', label: 'All items', short: 'All', icon: 'grid', hint: 'Every item' },
    { value: 'sprite', label: 'Flat items', short: 'Flat', icon: 'sword', hint: 'Items drawn from a flat sprite' },
    { value: 'blockitem', label: 'Block items', short: 'Blocks', icon: 'cube', hint: 'Items shown as their block' },
    { value: 'special', label: 'Drawn by the game', short: 'Special', icon: 'sparkles', hint: 'Shields, chests, banners...: drawn by the game’s own code' },
  ],
};

const MIN_TILE = 72;
const GAP = 6;
const PAD = 8;
const LIST_ROW = 48;
const OVERSCAN = 3;
const VIEW_KEY = 'to-tex-model-view';
const nf = new Intl.NumberFormat();

export function createModelBrowser(opts: ModelBrowserOptions): ModelBrowserApi {
  const { store, models } = opts;
  let kind: LibraryKind = 'block';
  let query = '';
  let cat: Cat = 'all';
  let editedOnly = false;
  let items: ModelEntry[] = [];
  let selected: { kind: LibraryKind; id: string } | null = null;
  let active = -1;
  let cols = 1;
  let tileW = 80;
  let rowH = LIST_ROW;
  let view: 'grid' | 'list' = 'list';
  try {
    if (localStorage.getItem(VIEW_KEY) === 'grid') view = 'grid';
  } catch {
    /* storage blocked */
  }
  const cleanups: (() => void)[] = [];
  const categories = new Map<string, Cat>();
  let catsReady = false;
  let catJob = 0;

  // ---- header ----
  const input = h('input', { class: 'input tx-search-input', type: 'search', placeholder: 'Search blocks', autocomplete: 'off', spellcheck: false, 'aria-label': 'Search blocks', enterKeyHint: 'search' });
  const clearBtn = h('button', { type: 'button', class: 'icon-btn sm tx-search-clear', 'aria-label': 'Clear search', hidden: true }, icon('close'));
  const search = h('div', { class: 'tx-search' }, icon('search', { class: 'tx-search-icon' }), input, clearBtn, h('kbd', { class: 'kbd tx-search-kbd', 'aria-hidden': 'true' }, '/'));

  const catIcon = h('span', { class: 'tx-catpick-icon' });
  const catLabel = h('span', { class: 'tx-catpick-label truncate' });
  const catCount = h('span', { class: 'tx-chip-count' });
  const catPick = h('button', { type: 'button', class: 'chip tx-catpick', 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, catIcon, catLabel, catCount, icon('chevron-down', { class: 'tx-catpick-chev' }));
  let catMenu: PopoverHandle | null = null;

  const editedBtn = h('button', { type: 'button', class: 'chip tx-edited-chip', 'aria-pressed': 'false' }, icon('pencil'), h('span', null, 'Edited'), h('span', { class: 'tx-chip-count' }, '0'));
  tooltip(editedBtn, 'Only blocks that use a texture you changed');
  const gridBtn = h('button', { type: 'button', class: 'icon-btn sm', 'aria-pressed': String(view === 'grid'), 'aria-label': 'Show as a grid' }, icon('grid-2x2-2'));
  const listBtn = h('button', { type: 'button', class: 'icon-btn sm', 'aria-pressed': String(view === 'list'), 'aria-label': 'Show as a list with names' }, icon('bulletlist'));
  tooltip(gridBtn, 'Grid');
  tooltip(listBtn, 'List with names');

  const grid = h('div', { class: ['tx-grid', 'tx-mb-grid', view === 'list' && 'is-list'], role: 'listbox', tabIndex: 0, 'aria-label': 'Blocks' });
  const sizer = h('div', { class: 'tx-grid-sizer' });
  const scroller = h('div', { class: 'tx-grid-scroll scroll' }, sizer, grid);
  const overlay = h('div', { class: 'tx-grid-empty', hidden: true });
  const status = h('div', { class: 'tx-browser-status' });
  const count = h('span', { class: 'tx-browser-count' });

  const el = h(
    'section',
    { class: 'panel tx-browser tx-mb', 'aria-label': 'Block browser' },
    opts.top,
    h('div', { class: 'tx-browser-head' }, search, catPick),
    h('div', { class: 'tx-browser-bar' }, editedBtn, h('span', { class: 'grow' }), h('span', { class: 'tx-seg' }, gridBtn, listBtn)),
    h('div', { class: 'tx-grid-wrap' }, scroller, overlay),
    status,
  );

  const lib = (): ModelLibrary | null => models.lib;
  const all = (): ModelEntry[] => {
    const l = lib();
    if (!l) return [];
    return kind === 'block' ? l.blocks() : l.items();
  };
  const noun = () => (kind === 'block' ? 'blocks' : 'items');

  // ---- categories (computed in small slices so the list shows at once) ----
  const catOf = (e: ModelEntry): Cat | undefined => categories.get(`${e.kind}:${e.id}`);
  function computeCategories() {
    const l = lib();
    if (!l) return;
    const job = ++catJob;
    const list = [...l.blocks(), ...l.items()];
    let i = 0;
    const step = () => {
      if (job !== catJob) return;
      const end = Math.min(list.length, i + 120);
      for (; i < end; i++) {
        const e = list[i];
        const key = `${e.kind}:${e.id}`;
        if (categories.has(key)) continue;
        try {
          if (e.kind === 'block') categories.set(key, l.category(e));
          else {
            const v = l.resolve(e);
            categories.set(key, v.shape === 'sprite' ? 'sprite' : v.shape === 'model' ? 'blockitem' : 'special');
          }
        } catch {
          categories.set(key, 'special');
        }
      }
      if (i < list.length) setTimeout(step, 0);
      else {
        catsReady = true;
        renderCats();
        if (cat !== 'all') refilter(false);
      }
    };
    step();
  }

  const editedEntries = (): Set<string> => {
    const out = new Set<string>();
    const l = lib();
    if (!l?.usageReady) return out;
    for (const p of store.editedPaths()) {
      const u = l.usageOf(p);
      for (const id of kind === 'block' ? u.blocks : u.items) out.add(id);
    }
    return out;
  };

  const tokens = (q: string) => q.toLowerCase().replace(/[_/]+/g, ' ').split(/\s+/).filter(Boolean);
  function score(toks: string[], e: ModelEntry): number {
    let s = 0;
    const name = e.name.toLowerCase();
    const id = e.id.toLowerCase().replace(/_/g, ' ');
    for (const t of toks) {
      if (name === t) s += 120;
      else if (name.startsWith(t)) s += 70;
      else if (new RegExp(`(^|\\s)${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(name)) s += 55;
      else if (name.includes(t)) s += 40;
      else if (id.includes(t)) s += 22;
      else return -1;
    }
    return s - name.length * 0.3;
  }

  function counts(): Map<Cat, number> {
    const m = new Map<Cat, number>();
    const toks = tokens(query);
    const edited = editedOnly ? editedEntries() : null;
    let n = 0;
    for (const e of all()) {
      if (edited && !edited.has(e.id)) continue;
      if (toks.length && score(toks, e) < 0) continue;
      n++;
      const c = catOf(e);
      if (c) m.set(c, (m.get(c) ?? 0) + 1);
    }
    m.set('all', n);
    return m;
  }

  function renderCats() {
    const def = CATS[kind].find((c) => c.value === cat) ?? CATS[kind][0];
    const m = counts();
    catIcon.replaceChildren(icon(def.icon));
    catLabel.textContent = def.label;
    catCount.textContent = cat === 'all' || catsReady ? nf.format(m.get(cat) ?? 0) : '…';
    catPick.classList.toggle('is-filtered', cat !== 'all');
    catPick.setAttribute('aria-label', `Show: ${def.label}. Change`);
  }

  function openCatMenu() {
    const m = counts();
    const list = h('div', { class: 'tx-catmenu', role: 'menu', 'aria-label': `Kinds of ${noun()}` });
    const buttons: HTMLButtonElement[] = [];
    for (const c of CATS[kind]) {
      const b = h(
        'button',
        { type: 'button', class: 'tx-catmenu-item', role: 'menuitemradio', 'aria-checked': String(cat === c.value), tabIndex: -1, dataset: { cat: c.value } },
        icon(c.icon),
        h('span', { class: 'tx-catmenu-label' }, c.short),
        h('span', { class: 'tx-chip-count' }, c.value === 'all' || catsReady ? nf.format(m.get(c.value) ?? 0) : '…'),
      );
      b.title = c.hint;
      b.addEventListener('click', () => {
        catMenu?.close();
        cat = c.value;
        refilter(true);
      });
      buttons.push(b);
      list.appendChild(b);
    }
    list.addEventListener('keydown', (ev) => {
      const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
      let n = -1;
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') n = Math.min(buttons.length - 1, i + 1);
      else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') n = Math.max(0, i - 1);
      if (n < 0) return;
      ev.preventDefault();
      buttons[n].focus();
    });
    catPick.setAttribute('aria-expanded', 'true');
    catMenu = openPopover(catPick, list, {
      placement: 'bottom-start',
      role: 'presentation',
      class: 'tx-catmenu-pop',
      focus: buttons.find((b) => b.getAttribute('aria-checked') === 'true') ?? buttons[0],
      onClose: () => catPick.setAttribute('aria-expanded', 'false'),
    });
  }
  catPick.addEventListener('click', () => (catMenu?.open ? catMenu.close() : openCatMenu()));

  // ---- filtering ----
  function computeItems() {
    const toks = tokens(query);
    const edited = editedOnly ? editedEntries() : null;
    const scored: { e: ModelEntry; s: number; i: number }[] = [];
    all().forEach((e, i) => {
      if (cat !== 'all' && catOf(e) !== cat) return;
      if (edited && !edited.has(e.id)) return;
      const s = toks.length ? score(toks, e) : 0;
      if (s < 0) return;
      scored.push({ e, s, i });
    });
    if (toks.length) scored.sort((a, b) => b.s - a.s || a.i - b.i);
    items = scored.map((x) => x.e);
  }

  function paintMeta() {
    const l = lib();
    const edited = l ? editedEntries().size : 0;
    editedBtn.querySelector('.tx-chip-count')!.textContent = String(edited);
    editedBtn.setAttribute('aria-pressed', String(editedOnly));
    tooltip(editedBtn, kind === 'block' ? 'Only blocks that use a texture you changed' : 'Only items that use a texture you changed');
    const total = all().length;
    count.textContent = items.length === total ? `${nf.format(total)} ${noun()}` : `${nf.format(items.length)} of ${nf.format(total)}`;
    clearBtn.hidden = !query;
    if (!status.querySelector('strong')) status.replaceChildren(count);
  }

  function renderOverlay() {
    const l = lib();
    if (!l) {
      overlay.hidden = false;
      if (models.error) {
        overlay.replaceChildren(
          emptyState({
            icon: 'warning-diamond',
            title: "Couldn't load the block models",
            text: models.error,
            action: h(
              'div',
              { class: 'row wrap', style: { justifyContent: 'center' } },
              button({ label: 'Try again', icon: 'reload', size: 'sm', onClick: () => void models.load() }),
              button({ label: 'All textures', size: 'sm', variant: 'ghost', onClick: () => opts.onShowTextures() }),
            ),
          }),
        );
      } else if (!overlay.querySelector('.tx-mb-loading')) {
        const bar = progressBar({ label: 'Loading block models…' });
        overlay.replaceChildren(h('div', { class: 'tx-mb-loading' }, spinner(32), bar));
        loadingBar = bar;
      }
      return;
    }
    if (!l.available) {
      overlay.hidden = false;
      overlay.replaceChildren(
        emptyState({
          icon: 'cube',
          title: 'No block models in this version',
          text: l.unavailable ?? 'This version has no model files.',
          action: button({ label: 'Show all textures', size: 'sm', onClick: () => opts.onShowTextures() }),
        }),
      );
      return;
    }
    if (items.length) {
      overlay.hidden = true;
      return;
    }
    overlay.hidden = false;
    overlay.replaceChildren(
      emptyState({
        icon: editedOnly ? 'pencil' : 'search',
        title: editedOnly && !query ? `No edited ${noun()} yet` : `No ${noun()} found`,
        text: query ? `Nothing matches "${query}". Try a shorter word, like "stone" or "door".` : editedOnly ? `Paint a texture and the ${noun()} using it show up here.` : 'This group is empty.',
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
  let loadingBar: ReturnType<typeof progressBar> | null = null;

  function refilter(resetScroll: boolean) {
    computeItems();
    renderCats();
    paintMeta();
    renderOverlay();
    active = selected && selected.kind === kind ? items.findIndex((e) => e.id === selected!.id) : -1;
    for (const t of tiles.values()) t.remove();
    tiles.clear();
    if (resetScroll) scroller.scrollTop = 0;
    layout();
  }

  // ---- virtual list ----
  const tiles = new Map<number, HTMLElement>();
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        io.unobserve(en.target);
        void loadIcon(en.target as HTMLElement);
      }
    },
    { root: scroller, rootMargin: '160px 0px' },
  );
  const fx = () => store.effectsActive();

  function drawIcon(tile: HTMLElement, img: HTMLCanvasElement | ImageData) {
    const c = tile.querySelector('canvas')!;
    if (img instanceof HTMLCanvasElement) {
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d');
      ctx?.clearRect(0, 0, c.width, c.height);
      ctx?.drawImage(img, 0, 0);
      c.classList.add('smooth');
    } else {
      paintCanvas(c, img);
      c.classList.remove('smooth');
    }
    const box = view === 'list' ? 36 : tileW - 16;
    const m = Math.max(c.width, c.height);
    let s = box / m;
    if (!(img instanceof HTMLCanvasElement) && m <= box) s = Math.max(1, Math.floor(box / m));
    c.style.width = `${Math.round(c.width * s)}px`;
    c.style.height = `${Math.round(c.height * s)}px`;
    tile.classList.add('loaded');
  }

  async function loadIcon(tile: HTMLElement) {
    const e = items[Number(tile.dataset.index)];
    if (!e) return;
    const key = models.iconKey(e, fx());
    tile.dataset.key = key;
    const img = await models.icon(e, fx()).catch(() => null);
    if (!tile.isConnected || tile.dataset.key !== key) return;
    if (img) drawIcon(tile, img);
    else tile.classList.add('failed');
  }

  const tileId = (i: number) => `tx-mb-opt-${i}`;
  function makeTile(i: number): HTMLElement {
    const e = items[i];
    const isSel = !!selected && selected.kind === e.kind && selected.id === e.id;
    const tile = h(
      'div',
      { class: 'tx-tile tx-mb-tile', role: 'option', id: tileId(i), 'aria-selected': String(isSel), 'aria-label': e.name, dataset: { index: i, id: e.id } },
      h('span', { class: 'tx-tile-img' }, h('canvas', { class: 'tx-thumb-canvas', 'aria-hidden': 'true' })),
      h('span', { class: 'tx-tile-text' }, h('span', { class: 'tx-tile-name' }, e.name), h('span', { class: 'tx-tile-id' }, e.id)),
    );
    const cached = models.peekIcon(e, fx());
    if (cached) {
      tile.dataset.key = models.iconKey(e, fx());
      drawIcon(tile, cached);
    } else io.observe(tile);
    return tile;
  }

  const place = (tile: HTMLElement, i: number) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    tile.style.transform = `translate(${PAD + c * (tileW + GAP)}px, ${PAD + r * (rowH + GAP)}px)`;
    tile.style.width = `${tileW}px`;
    tile.style.height = `${rowH}px`;
  };

  function measure(): boolean {
    const w = scroller.clientWidth;
    if (!w) return false;
    const inner = w - PAD * 2;
    if (view === 'list') {
      cols = 1;
      tileW = inner;
      rowH = LIST_ROW;
    } else {
      cols = Math.max(1, Math.floor((inner + GAP) / (MIN_TILE + GAP)));
      tileW = Math.floor((inner - GAP * (cols - 1)) / cols);
      rowH = tileW;
    }
    return true;
  }

  let lastCols = -1;
  let lastW = -1;
  function layout() {
    if (!measure()) return;
    const rows = Math.ceil(items.length / cols);
    sizer.style.height = `${rows ? PAD * 2 + rows * rowH + (rows - 1) * GAP : 0}px`;
    const relayout = cols !== lastCols || tileW !== lastW;
    lastCols = cols;
    lastW = tileW;
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
      } else if (relayout) place(t, i);
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

  const showStatus = (e: ModelEntry | undefined) => status.replaceChildren(...(e ? [h('strong', null, e.name), h('span', null, e.id)] : [count]));
  function syncActive() {
    if (active >= 0 && tiles.has(active)) grid.setAttribute('aria-activedescendant', tileId(active));
    else grid.removeAttribute('aria-activedescendant');
    for (const [i, t] of tiles) {
      const e = items[i];
      t.classList.toggle('is-active', i === active);
      t.setAttribute('aria-selected', String(!!selected && !!e && selected.kind === e.kind && selected.id === e.id));
    }
  }

  function reveal(i: number) {
    if (i < 0) return;
    measure();
    const r = Math.floor(i / cols);
    const y = PAD + r * (rowH + GAP);
    if (y < scroller.scrollTop) scroller.scrollTop = y - PAD;
    else if (y + rowH > scroller.scrollTop + scroller.clientHeight) scroller.scrollTop = y + rowH - scroller.clientHeight + PAD;
    layout();
  }

  function openAt(i: number, how: 'pointer' | 'keyboard' | 'enter') {
    const e = items[i];
    if (!e) return;
    active = i;
    selected = { kind: e.kind, id: e.id };
    syncActive();
    opts.onOpen(e, how);
  }

  grid.addEventListener('click', (ev) => {
    const t = (ev.target as HTMLElement).closest<HTMLElement>('.tx-tile');
    if (t) openAt(Number(t.dataset.index), 'pointer');
  });
  grid.addEventListener('pointerover', (ev) => {
    const t = (ev.target as HTMLElement).closest<HTMLElement>('.tx-tile');
    if (t) showStatus(items[Number(t.dataset.index)]);
  });
  grid.addEventListener('pointerleave', () => showStatus(undefined));
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
      default:
        return;
    }
    ev.preventDefault();
    if (next !== active) {
      reveal(next);
      openAt(next, 'keyboard');
    }
  });
  grid.addEventListener('focus', () => {
    if (active < 0 && items.length) {
      active = 0;
      syncActive();
    }
    showStatus(items[active]);
  });
  grid.addEventListener('blur', () => showStatus(undefined));

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
  const setView = (v: 'grid' | 'list') => {
    if (v === view) return;
    view = v;
    gridBtn.setAttribute('aria-pressed', String(v === 'grid'));
    listBtn.setAttribute('aria-pressed', String(v === 'list'));
    grid.classList.toggle('is-list', v === 'list');
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* storage blocked */
    }
    for (const t of tiles.values()) t.remove();
    tiles.clear();
    lastCols = -1;
    layout();
    if (active >= 0) reveal(active);
  };
  gridBtn.addEventListener('click', () => setView('grid'));
  listBtn.addEventListener('click', () => setView('list'));

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

  // ---- store / library events ----
  const pending = new Set<string>();
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  const refreshIcons = () => {
    refreshTimer = null;
    const ids = new Set<string>();
    for (const p of pending) for (const e of models.entriesUsing(p)) if (e.kind === kind) ids.add(e.id);
    pending.clear();
    for (const t of tiles.values()) if (ids.has(t.dataset.id ?? '')) void loadIcon(t);
    paintMeta();
    if (editedOnly) refilter(false);
  };
  cleanups.push(
    store.events.on('overrides', ({ path }) => {
      pending.add(path);
      refreshTimer ??= setTimeout(refreshIcons, 400);
    }),
    store.events.on('effects', () => {
      for (const t of tiles.values()) void loadIcon(t);
    }),
    models.events.on('progress', (p) => loadingBar?.set(p)),
    models.events.on('ready', () => {
      renderCats();
      refilter(false);
      computeCategories();
      if (selected) api.setSelected(selected.kind, selected.id, true);
    }),
    models.events.on('failed', () => renderOverlay()),
    models.events.on('usage', () => (editedOnly ? refilter(false) : paintMeta())),
    listen(window, 'resize', () => layout()),
  );

  let activated = false;
  const api: ModelBrowserApi = {
    el,
    setKind(k) {
      if (k === kind) return;
      kind = k;
      cat = 'all';
      input.placeholder = k === 'block' ? 'Search blocks' : 'Search items';
      input.setAttribute('aria-label', input.placeholder);
      grid.setAttribute('aria-label', k === 'block' ? 'Blocks' : 'Items');
      el.setAttribute('aria-label', k === 'block' ? 'Block browser' : 'Item browser');
      refilter(true);
    },
    setSelected(k, id, doReveal = true) {
      selected = id ? { kind: k, id } : null;
      active = selected && k === kind ? items.findIndex((e) => e.id === id) : -1;
      if (doReveal && active >= 0) reveal(active);
      else syncActive();
    },
    focusSearch() {
      input.focus();
      input.select();
    },
    activate() {
      if (!activated) {
        activated = true;
        void models.load();
      }
      requestAnimationFrame(() => layout());
    },
    destroy() {
      catJob++;
      catMenu?.close();
      cleanups.forEach((f) => f());
      io.disconnect();
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      if (searchTimer) clearTimeout(searchTimer);
      if (refreshTimer) clearTimeout(refreshTimer);
    },
  };
  if (models.lib) computeCategories();
  refilter(true);
  return api;
}
