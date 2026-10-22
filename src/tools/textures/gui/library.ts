// Left panel in GUI mode: the game's interface textures by what they are (HUD, inventory and
// containers, buttons, menu backgrounds, title screen, enchantment glint), each piece a small picture
// cut from its texture (an atlas area on Java before 1.20.2). Picking one opens it in the pixel
// editor; "Splash texts" opens the splash text editor.

import { h } from '../../../ui/dom';
import { icon, type IconName } from '../../../ui/icons';
import { emptyState, tooltip } from '../../../ui/components';
import { fmt, num } from '../../../i18n/editor-text';
import { versionLabel } from '../ui/start-screen';
import { GUI_SECTIONS, pieceRect, type GuiCatalog, type GuiPart, type GuiPiece, type GuiSectionId } from './catalog';
import type { GuiSources } from './sources';
import { tg } from './i18n/text';

export interface GuiLibrary {
  el: HTMLElement;
  /** Marks a piece as the open one (null: none); `reveal` scrolls to it */
  setSelected(id: string | null, reveal?: boolean): void;
  /** The splash text row is the open one */
  setSplashSelected(on: boolean): void;
  setSplashCount(n: number | null): void;
  activate(): void;
  focusSearch(): void;
  destroy(): void;
}

export interface GuiLibraryOptions {
  sources: GuiSources;
  cat: GuiCatalog;
  /** The Blocks / Items / Mobs / All / GUI / Sounds switch */
  top: HTMLElement;
  onOpen(piece: GuiPiece, how: 'pointer' | 'keyboard'): void;
  onSplashes(): void;
}

const SECTION_ICONS: Record<GuiSectionId, IconName> = {
  hud: 'heart',
  screens: 'package',
  widgets: 'square',
  backgrounds: 'image',
  title: 'monitor',
  glint: 'sparkles',
};

const THUMB = 40;

/** Name of a piece under its picture. */
export function pieceName(piece: GuiPiece): string {
  const m = /^slot(\d)$/.exec(piece.key);
  return m ? fmt(tg.pieces.slotN, { n: m[1] }) : tg.pieces[piece.key as Exclude<keyof typeof tg.pieces, 'slotN'>];
}

/** "Hearts · Full" */
export function pieceTitle(piece: GuiPiece): string {
  const part = tg.parts[piece.part];
  const name = pieceName(piece);
  const single = ['crosshair', 'window', 'logo'].includes(piece.key) || part === name;
  return single ? part : `${part} · ${name}`;
}

/** Which part of a whole container texture is the window (thumbnails). */
function thumbArea(piece: GuiPiece, img: { width: number; height: number }) {
  if (piece.key === 'window' && img.width === img.height) {
    const k = img.width / 256;
    return { x: 0, y: 0, w: Math.round(176 * k), h: Math.round((piece.part === 'chest' ? 222 : 166) * k) };
  }
  return pieceRect(piece, img);
}

export function createGuiLibrary(opts: GuiLibraryOptions): GuiLibrary {
  const { sources, cat } = opts;
  const { store } = sources;
  let query = '';
  let selected: string | null = null;
  const offs: (() => void)[] = [];
  const tiles = new Map<string, HTMLButtonElement>();

  const input = h('input', { class: 'input tx-search-input', type: 'search', placeholder: tg.search, autocomplete: 'off', spellcheck: false, 'aria-label': tg.search, enterKeyHint: 'search' });
  const clearBtn = h('button', { type: 'button', class: 'icon-btn sm tx-search-clear', 'aria-label': tg.clearSearch, hidden: true }, icon('close'));
  const search = h('div', { class: 'tx-search' }, icon('search', { class: 'tx-search-icon' }), input, clearBtn);
  const list = h('div', { class: 'gui-lib-list' });
  const scroller = h('div', { class: 'gui-lib-scroll scroll' }, list);
  const empty = h('div', { class: 'gui-lib-empty', hidden: true });
  const el = h('section', { class: 'panel tx-browser gui-lib', 'aria-label': tg.switchLabel }, opts.top, h('div', { class: 'tx-browser-head' }, search), scroller, empty);

  const splashCount = h('span', { class: 'gui-splash-count' });
  const splashBtn = h(
    'button',
    { type: 'button', class: 'gui-splash-row', dataset: { part: 'splashes' } },
    h('span', { class: 'gui-splash-icon', 'aria-hidden': 'true' }, icon('notes')),
    h('span', { class: 'gui-splash-text' }, h('span', { class: 'gui-splash-name' }, tg.parts.splashes), splashCount),
    icon('chevron-right', { class: 'gui-splash-go' }),
  );
  splashBtn.addEventListener('click', () => opts.onSplashes());

  function note(): HTMLElement {
    const text = cat.edition === 'bedrock' ? tg.bedrockNote : cat.atlases ? fmt(tg.atlasNote, { version: versionLabel(store.project) }) : tg.spriteNote;
    return h('p', { class: 'gui-lib-note' }, icon('circle-info', { size: 16 }), h('span', null, text));
  }

  /** The piece's name next to its part's name while it is pointed at, focused or open. */
  function caption(part: string, piece: GuiPiece | null) {
    const cap = list.querySelector<HTMLElement>(`.gui-part[data-part="${part}"] .gui-part-piece`);
    if (!cap) return;
    const p = piece ?? (selected ? cat.piece(selected) : null);
    const show = p && p.part === part && cat.part(p.part)!.pieces.length > 1 ? pieceName(p) : '';
    cap.textContent = show;
    cap.hidden = !show;
  }

  function tile(piece: GuiPiece): HTMLButtonElement {
    const c = h('canvas', { class: 'gui-tile-img', width: THUMB, height: THUMB, 'aria-hidden': 'true' });
    const b = h(
      'button',
      { type: 'button', class: ['gui-tile', 'checker', piece.part === 'crosshair' && 'is-dark'], dataset: { piece: piece.id, path: piece.path }, 'aria-pressed': String(piece.id === selected), 'aria-label': pieceTitle(piece) },
      c,
      h('span', { class: 'gui-tile-edit', 'aria-hidden': 'true' }, icon('pencil', { size: 16 })),
    );
    tooltip(b, `${pieceTitle(piece)} · ${piece.path.replace(/^assets\/minecraft\/textures\/|^textures\//, '')}`);
    b.addEventListener('click', () => opts.onOpen(piece, 'pointer'));
    b.addEventListener('pointerenter', () => caption(piece.part, piece));
    b.addEventListener('focus', () => caption(piece.part, piece));
    b.addEventListener('pointerleave', () => caption(piece.part, null));
    b.addEventListener('blur', () => caption(piece.part, null));
    b.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const all = [...list.querySelectorAll<HTMLButtonElement>('.gui-tile:not([hidden])')].filter((t) => t.offsetParent);
      const i = all.indexOf(b);
      const grid = b.parentElement!;
      const cols = Math.max(1, Math.round(grid.clientWidth / (b.offsetWidth + 6)));
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' ? cols : -cols;
      const next = all[Math.max(0, Math.min(all.length - 1, i + d))];
      if (!next || next === b) return;
      e.preventDefault();
      next.focus();
      const p = cat.piece(next.dataset.piece!);
      if (p) opts.onOpen(p, 'keyboard');
    });
    tiles.set(piece.id, b);
    return b;
  }

  function partEl(part: GuiPart): HTMLElement {
    if (part.id === 'splashes') return h('div', { class: 'gui-part', dataset: { part: part.id } }, splashBtn);
    // a part named like its section (Buttons, Enchantment glint) needs no name of its own
    const same = tg.parts[part.id] === tg.sections[part.section];
    return h(
      'div',
      { class: 'gui-part', dataset: { part: part.id } },
      h(
        'h4',
        { class: ['gui-part-name', same && 'is-quiet'] },
        same ? null : h('span', null, tg.parts[part.id]),
        h('span', { class: 'gui-part-piece', hidden: true }),
        h('span', { class: 'gui-part-edited', hidden: true }),
      ),
      h('div', { class: 'gui-tiles' }, part.pieces.map(tile)),
    );
  }

  function build() {
    tiles.clear();
    const sections = GUI_SECTIONS.map((s) => {
      const parts = cat.parts.filter((p) => p.section === s);
      if (!parts.length) return null;
      return h(
        'section',
        { class: 'gui-sec', dataset: { section: s }, 'aria-labelledby': `gui-sec-${s}` },
        h('h3', { class: 'gui-sec-title', id: `gui-sec-${s}` }, icon(SECTION_ICONS[s], { size: 16 }), h('span', null, tg.sections[s])),
        parts.map(partEl),
      );
    });
    list.replaceChildren(note(), ...sections.filter((x): x is HTMLElement => !!x));
  }

  // ---------------------------------------------------------------- thumbnails
  const vanillaSame = new Map<string, boolean>();
  async function paintTile(piece: GuiPiece) {
    const b = tiles.get(piece.id);
    if (!b) return;
    const img = await sources.load(piece.path);
    const c = b.querySelector('canvas')!;
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, THUMB, THUMB);
    if (!img) return;
    const r = thumbArea(piece, img);
    const k = Math.min(THUMB / r.w, THUMB / r.h);
    const s = k >= 1 ? Math.floor(k) : k;
    const w = Math.max(1, Math.round(r.w * s));
    const hh = Math.max(1, Math.round(r.h * s));
    g.imageSmoothingEnabled = s < 1;
    g.drawImage(img.canvas, r.x, r.y, r.w, r.h, Math.round((THUMB - w) / 2), Math.round((THUMB - hh) / 2), w, hh);
    b.classList.toggle('is-edited', await pieceEdited(piece));
    paintCounts();
  }

  /** Whether the pack changed a piece (on an atlas: its own area, not just the file). */
  async function pieceEdited(piece: GuiPiece): Promise<boolean> {
    if (!store.isEdited(piece.path)) return false;
    if (!piece.region) return true;
    const key = `${piece.id}|${store.stamp(piece.path)}`;
    const known = vanillaSame.get(key);
    if (known !== undefined) return !known;
    const [mine, game] = await Promise.all([store.getFull(piece.path).catch(() => null), store.getVanilla(piece.path)]);
    let same = false;
    if (mine && game && mine.width === game.width && mine.height === game.height) {
      const r = pieceRect(piece, mine);
      same = true;
      for (let y = r.y; y < r.y + r.h && same; y++) {
        const a = (y * mine.width + r.x) * 4;
        for (let i = a; i < a + r.w * 4; i++) {
          if (mine.data[i] !== game.data[i]) {
            same = false;
            break;
          }
        }
      }
    }
    vanillaSame.set(key, same);
    return !same;
  }

  function paintCounts() {
    for (const partEl of list.querySelectorAll<HTMLElement>('.gui-part')) {
      const n = partEl.querySelectorAll('.gui-tile.is-edited').length;
      const badge = partEl.querySelector<HTMLElement>('.gui-part-edited');
      if (!badge) continue;
      badge.hidden = !n;
      badge.textContent = fmt(tg.editedCount, { count: num(n) });
    }
  }

  let io: IntersectionObserver | null = null;
  function observe() {
    io?.disconnect();
    io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (!en.isIntersecting) continue;
          io!.unobserve(en.target);
          const p = cat.piece((en.target as HTMLElement).dataset.piece!);
          if (p) void paintTile(p);
        }
      },
      { root: scroller, rootMargin: '200px 0px' },
    );
    for (const t of tiles.values()) io.observe(t);
  }

  function refilter() {
    const toks = query.toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const sec of list.querySelectorAll<HTMLElement>('.gui-sec')) {
      const secName = tg.sections[sec.dataset.section as GuiSectionId].toLowerCase();
      let secShown = 0;
      for (const partEl of sec.querySelectorAll<HTMLElement>('.gui-part')) {
        const part = cat.part(partEl.dataset.part as GuiPart['id']);
        const partName = `${secName} ${part ? tg.parts[part.id] : ''}`.toLowerCase();
        let partShown = 0;
        if (part?.id === 'splashes') {
          partShown = toks.every((t) => partName.includes(t) || 'splashes.txt splashes.json'.includes(t)) ? 1 : 0;
        }
        for (const t of partEl.querySelectorAll<HTMLElement>('.gui-tile')) {
          const p = cat.piece(t.dataset.piece!);
          const hay = `${partName} ${p ? pieceName(p) : ''} ${t.dataset.path}`.toLowerCase();
          const ok = toks.every((k) => hay.includes(k));
          t.hidden = !ok;
          if (ok) partShown++;
        }
        partEl.hidden = !partShown;
        secShown += partShown;
      }
      sec.hidden = !secShown;
      shown += secShown;
    }
    list.querySelector<HTMLElement>('.gui-lib-note')!.hidden = !!toks.length;
    empty.hidden = shown > 0;
    if (!shown) empty.replaceChildren(emptyState({ icon: 'search', title: fmt(tg.noMatch, { query }) }));
    clearBtn.hidden = !query;
  }

  let searchTimer: ReturnType<typeof setTimeout> | null = null;
  input.addEventListener('input', () => {
    clearBtn.hidden = !input.value;
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      query = input.value.trim();
      refilter();
    }, 100);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && input.value) {
      e.preventDefault();
      e.stopPropagation();
      input.value = '';
      query = '';
      refilter();
    } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
      const first = list.querySelector<HTMLElement>('.gui-tile:not([hidden]), .gui-splash-row');
      if (!first || !first.offsetParent) return;
      e.preventDefault();
      first.focus();
    }
  });
  clearBtn.addEventListener('click', () => {
    input.value = '';
    query = '';
    refilter();
    input.focus();
  });

  // repaint a texture's pieces when it changes
  const pending = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const queue = (path: string) => {
    if (!cat.piecesOf(path).length) return;
    pending.add(path);
    timer ??= setTimeout(() => {
      timer = null;
      for (const p of pending) for (const piece of cat.piecesOf(p)) void paintTile(piece);
      pending.clear();
    }, 250);
  };
  offs.push(
    store.events.on('overrides', ({ path }) => queue(path)),
    store.events.on('effects', () => {
      for (const t of tiles.values()) {
        const p = cat.piece(t.dataset.piece!);
        if (p) void paintTile(p);
      }
    }),
  );

  build();
  let started = false;

  return {
    el,
    setSelected(id, reveal = false) {
      selected = id;
      for (const [k, t] of tiles) t.setAttribute('aria-pressed', String(k === id));
      for (const part of cat.parts) caption(part.id, null);
      splashBtn.setAttribute('aria-pressed', 'false');
      if (id && reveal) tiles.get(id)?.scrollIntoView({ block: 'nearest' });
    },
    setSplashSelected(on) {
      splashBtn.setAttribute('aria-pressed', String(on));
      if (on) for (const t of tiles.values()) t.setAttribute('aria-pressed', 'false');
    },
    setSplashCount(n) {
      splashCount.textContent = n === null ? tg.splashGame : fmt(tg.splashRow, { count: n });
    },
    activate() {
      if (started) return;
      started = true;
      observe();
    },
    focusSearch() {
      input.focus();
      input.select();
    },
    destroy() {
      offs.forEach((f) => f());
      io?.disconnect();
      if (timer) clearTimeout(timer);
      if (searchTimer) clearTimeout(searchTimer);
    },
  };
}
