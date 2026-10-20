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
  const search = h('input', { class: 'input', type: 'search', placeholder: 'Search textures', 'aria-label': 'Search textures', autocomplete: 'off', spellcheck: false });
  const grid = h('div', { class: 'me-tp-grid', role: 'listbox', 'aria-label': 'Textures' });
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
      store.isEdited(e.path) ? h('span', { class: 'me-tp-dot', title: 'Edited in this pack' }) : null,
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
    more.textContent = list.length > MAX_SHOWN ? `Showing ${MAX_SHOWN} of ${list.length.toLocaleString('en-US')}. Search to find others.` : list.length ? '' : 'No texture matches. Try another word, or make a new texture.';
  };
  search.addEventListener('input', render);

  // a new texture of the pack, made from the face's texture or empty
  const nameInput = h('input', { class: 'input', type: 'text', placeholder: 'ruby_block', 'aria-label': 'New texture name', autocomplete: 'off', spellcheck: false, maxLength: 48 });
  const copyBox = h('input', { type: 'checkbox', checked: !!opts.current, disabled: !opts.current });
  const err = h('p', { class: 'me-tp-err small', role: 'alert' });
  const create = button({
    label: 'Make texture',
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
      err.textContent = 'Give it a name: lower-case letters, numbers and _.';
      nameInput.focus();
      return;
    }
    const path = `assets/minecraft/textures/${opts.newDir}/${name}.png`;
    if (store.byPath.has(path) || store.isEdited(path)) {
      err.textContent = 'There is already a texture with that name. Pick it from the list, or choose another name.';
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
      h('summary', null, icon('plus', { size: 16 }), 'New texture'),
      h('p', { class: 'faint small' }, `Saved in this pack as textures/${opts.newDir}/<name>.png. Paint it afterwards like any other texture.`),
      h('div', { class: 'me-tp-newrow' }, nameInput, create),
      h('label', { class: 'me-tp-copy small' }, copyBox, h('span', null, 'Start from the face’s current texture')),
      err,
    ),
  );
  render();
  handle = openModal({ title: 'Choose a texture', body, width: 640, class: 'me-tp-modal', initialFocus: search });
}
