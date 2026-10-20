// Picks the texture of a face: the textures the model already uses, then every block and item texture of
// the pack (its own new ones too), searchable; or a new texture the user names (a copy of the face's
// texture, or empty) to paint later.

import { h } from '../../../../ui/dom';
import { icon } from '../../../../ui/icons';
import { button } from '../../../../ui/components';
import { openModal } from '../../../../ui/modal';
import { createImageData } from '../../../../core/pixels';
import { javaTexturePath } from '../../../../shared/models/java-models';
import { searchScore, type TextureEntry } from '../meta';
import type { TexStore } from '../store';
import type { ThumbService } from '../thumbs';
import { paintCanvas } from '../thumbs';
import { fmt } from '../../../../i18n/editor-text';
import { tm } from '../i18n/model-editor';

export interface PickedTexture {
  /** Texture ref for the model ('minecraft:block/stone') */
  ref: string;
  path: string;
}

const MAX_SHOWN = 96;

/** Model texture ref of a pack path (null for paths outside a textures folder). */
export function refOfPath(path: string): string | null {
  const m = /^assets\/([^/]+)\/textures\/(.+)\.png$/.exec(path);
  return m ? `${m[1]}:${m[2]}` : null;
}

export function openTexturePicker(opts: {
  store: TexStore;
  thumbs: ThumbService;
  /** Texture refs the model uses now, shown first */
  inModel: string[];
  /** Folder for new textures ('block' / 'item'; 'blocks' / 'items' before 1.13) */
  newDir: string;
  /** The face's texture, offered as the start of a new one */
  current: string | null;
  onPick(t: PickedTexture): void;
}): void {
  const { store, thumbs } = opts;
  const usable = (e: TextureEntry) => /^assets\/[^/]+\/textures\/.+\.png$/.test(e.path) && (e.category === 'block' || e.category === 'item' || e.custom);
  const all = store.entries.filter(usable);
  const search = h('input', { class: 'input', type: 'search', placeholder: tm.picker.search, 'aria-label': tm.picker.search, autocomplete: 'off', spellcheck: false });
  const grid = h('div', { class: 'me-tp-grid', role: 'listbox', 'aria-label': tm.picker.textures });
  const more = h('p', { class: 'faint small me-tp-more' });
  let handle: { close(): void } | null = null;

  const tile = (e: TextureEntry) => {
    const c = h('canvas', { class: 'me-tp-thumb', 'aria-hidden': 'true' });
    const peek = thumbs.peek(e);
    if (peek) paintCanvas(c, peek);
    else void thumbs.get(e).then((img) => img && paintCanvas(c, img));
    const b = h(
      'button',
      { type: 'button', class: 'me-tp-tile', role: 'option', title: e.id, dataset: { path: e.path } },
      h('span', { class: 'me-tp-thumbbox checker' }, c),
      h('span', { class: 'me-tp-name truncate' }, e.name),
      store.isEdited(e.path) ? h('span', { class: 'me-tp-dot', title: tm.picker.edited }) : null,
    );
    b.addEventListener('click', () => {
      const ref = refOfPath(e.path);
      if (!ref) return;
      opts.onPick({ ref, path: e.path });
      handle?.close();
    });
    return b;
  };

  const render = () => {
    const q = search.value.trim().toLowerCase();
    let list: TextureEntry[];
    if (q) {
      const tokens = q.split(/\s+/);
      list = all
        .map((e) => ({ e, s: searchScore(tokens, e) }))
        .filter((x) => x.s >= 0)
        .sort((a, b) => b.s - a.s)
        .map((x) => x.e);
    } else {
      const used = new Set(opts.inModel.map((r) => javaTexturePath(r)));
      const first = all.filter((e) => used.has(e.path));
      const own = all.filter((e) => !used.has(e.path) && (e.custom || store.isEdited(e.path)));
      const rest = all.filter((e) => !used.has(e.path) && !e.custom && !store.isEdited(e.path));
      list = [...first, ...own, ...rest];
    }
    grid.replaceChildren(...list.slice(0, MAX_SHOWN).map(tile));
    more.textContent = list.length > MAX_SHOWN ? fmt(tm.picker.showing, { shown: MAX_SHOWN, total: list.length }) : list.length ? '' : tm.picker.noMatch;
  };
  search.addEventListener('input', render);

  // a new texture of the pack, made from the face's texture or empty
  const nameInput = h('input', { class: 'input', type: 'text', placeholder: 'ruby_block', 'aria-label': tm.picker.newName, autocomplete: 'off', spellcheck: false, maxLength: 48 });
  const copyBox = h('input', { type: 'checkbox', checked: !!opts.current, disabled: !opts.current });
  const err = h('p', { class: 'me-tp-err small', role: 'alert' });
  const create = button({
    label: tm.picker.make,
    icon: 'plus',
    variant: 'secondary',
    onClick: () => void make(),
  });
  async function make() {
    const name = nameInput.value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_.-]/g, '');
    if (!name) {
      err.textContent = tm.picker.nameHint;
      nameInput.focus();
      return;
    }
    const path = `assets/minecraft/textures/${opts.newDir}/${name}.png`;
    if (store.byPath.has(path) || store.isEdited(path)) {
      err.textContent = tm.picker.exists;
      return;
    }
    let img: ImageData;
    try {
      img = copyBox.checked && opts.current ? await store.getFull(opts.current) : createImageData(store.project.resolution, store.project.resolution);
    } catch {
      img = createImageData(store.project.resolution, store.project.resolution);
    }
    store.setImage(path, img);
    store.rebuildEntries();
    const ref = refOfPath(path)!;
    opts.onPick({ ref, path });
    handle?.close();
  }
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') void make();
  });

  const body = h(
    'div',
    { class: 'me-tp' },
    h('div', { class: 'input-with-icon' }, icon('search'), search),
    grid,
    more,
    h(
      'details',
      { class: 'me-tp-new' },
      h('summary', null, icon('plus', { size: 16 }), tm.picker.newTexture),
      h('p', { class: 'faint small' }, fmt(tm.picker.savedAs, { path: `textures/${opts.newDir}/<name>.png` })),
      h('div', { class: 'me-tp-newrow' }, nameInput, create),
      h('label', { class: 'me-tp-copy small' }, copyBox, h('span', null, tm.picker.copy)),
      err,
    ),
  );
  render();
  handle = openModal({ title: tm.picker.title, body, width: 640, class: 'me-tp-modal', initialFocus: search });
}
