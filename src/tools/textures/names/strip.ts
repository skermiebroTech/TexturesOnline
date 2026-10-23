// The names of an item's name-based textures, in the row under the texture header (next to "Used by"):
// on an item's texture its looks (a click paints one) and "+"; on a look's texture which item and names
// it is for. Small and loaded with the editor; the window that edits them is ./dialog.ts.

import { h } from '../../../ui/dom';
import { icon } from '../../../ui/icons';
import { iconButton, tooltip } from '../../../ui/components';
import { fmt, joinList } from '../../../i18n/editor-text';
import type { NameVariant } from '../../../core/types';
import type { TexStore } from '../ui/store';
import type { ModelService } from '../ui/models';
import { firstSquare, prettyName } from '../ui/meta';
import { paintCanvas } from '../ui/thumbs';
import { te } from '../ui/i18n/editor';
import { variantOfTexture } from './pack';

export interface NamesStrip {
  el: HTMLElement;
  setPath(path: string | null): void;
  destroy(): void;
}

/** "“Excalibur” or “Caliburn”" */
export function quotedNames(v: Pick<NameVariant, 'names' | 'match'>, quoted = te.names.quoted): string {
  const names = v.names.length ? v.names : [v.match ?? ''];
  return joinList(names.map((name) => fmt(quoted, { name })), 'or');
}

/** An item's name as the editor shows it ("Diamond Sword"). */
export function itemName(models: ModelService, item: string): string {
  return models.lib?.item(item)?.name ?? prettyName(item);
}

/** The looks of the item whose picture `path` is (by the models that use it, else by its file name). */
export function looksOfTexture(store: TexStore, models: ModelService, path: string): [string, NameVariant][] {
  const all = Object.entries(store.project.nameVariants ?? {});
  if (!all.length) return [];
  const lib = models.lib;
  const users = lib?.usageReady ? new Set(lib.usageOf(path).items) : null;
  const file = path.slice(path.lastIndexOf('/') + 1).replace(/\.png$/, '');
  return all.filter(([, v]) => v.texture !== path && (v.item === file || !!users?.has(v.item))).sort((a, b) => a[0].localeCompare(b[0]));
}

export function createNamesStrip(o: { store: TexStore; models: ModelService; openTexture(path: string): void; openNames(path: string, add?: boolean): void; onChange(): void }): NamesStrip {
  const { store, models } = o;
  let path: string | null = null;
  const el = h('span', { class: 'tx-names', hidden: true, role: 'group', 'aria-label': te.names.label });

  const thumb = (v: NameVariant) => {
    const c = h('canvas', { class: 'tx-usedby-icon', 'aria-hidden': 'true' });
    void store
      .getFull(v.texture)
      .then((img) => paintCanvas(c, firstSquare(img)))
      .catch(() => undefined);
    return c;
  };

  function render() {
    const was = el.hidden;
    el.replaceChildren();
    el.classList.remove('is-look');
    el.hidden = true;
    if (path && store.project.edition === 'java') {
      const own = variantOfTexture(store.project, path);
      if (own) {
        const [, v] = own;
        const edit = h('button', { type: 'button', class: 'btn btn-ghost btn-sm tx-names-edit' }, icon('pen-square', { size: 16 }), h('span', { class: 'btn-label' }, te.names.manage));
        edit.addEventListener('click', () => path && o.openNames(path));
        const text = fmt(te.names.lookOf, { item: itemName(models, v.item), names: quotedNames(v) });
        el.append(h('span', { class: 'tx-usedby-label tx-names-for', title: text }, icon('label', { size: 16 }), h('span', { class: 'tx-names-text' }, text)), edit);
        el.classList.add('is-look');
        el.hidden = false;
      } else {
        const looks = looksOfTexture(store, models, path);
        if (looks.length) {
          const chips = looks.map(([id, v]) => {
            const first = fmt(te.names.quoted, { name: v.names[0] ?? v.match ?? '' });
            const b = h('button', { type: 'button', class: 'chip tx-usedby-chip tx-names-chip', dataset: { id } }, thumb(v), h('span', { class: 'truncate' }, v.names[0] ?? v.match ?? ''));
            tooltip(b, fmt(te.names.paintLook, { name: first }));
            b.addEventListener('click', () => (store.isEdited(v.texture) || store.assets.hasFile(v.texture) ? o.openTexture(v.texture) : path && o.openNames(path)));
            return b;
          });
          const add = iconButton('plus', te.names.add, () => path && o.openNames(path, true), { size: 'sm', class: 'tx-names-add' });
          el.append(h('span', { class: 'tx-usedby-label' }, icon('label', { size: 16 }), te.names.label), ...chips, add);
          el.hidden = false;
        }
      }
    }
    if (was !== el.hidden || !el.hidden) o.onChange();
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  const later = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      render();
    }, 120);
  };
  const offs = [
    store.events.on('names', () => render()),
    store.events.on('overrides', ({ path: p }) => {
      if (Object.values(store.project.nameVariants ?? {}).some((v) => v.texture === p)) later();
    }),
    models.events.on('usage', () => render()),
  ];

  return {
    el,
    setPath(p) {
      path = p;
      render();
    },
    destroy() {
      if (timer) clearTimeout(timer);
      offs.forEach((f) => f());
    },
  };
}
