// The name-based textures window of the texture pack editor (loaded when first opened): the looks an
// item gets from its name (renamed in an anvil), each with its names drawn as the game's tooltip, its
// picture in an inventory slot, Paint, an optional 3D shape (the model editor) and its names; adding one
// (its texture starts as a copy of the item's), changing names and removing one (with Undo). Says what
// the pack's version needs (vanilla 1.21.5+, OptiFine before) and that Bedrock can't do it.

import type { NameVariant } from '../../../core/types';
import { h } from '../../../ui/dom';
import { icon } from '../../../ui/icons';
import { button, iconButton, spinner, tooltip } from '../../../ui/components';
import { confirmDialog, openModal } from '../../../ui/modal';
import { toast } from '../../../ui/toast';
import { kit } from '../../../ui/i18n/kit';
import { createImageData } from '../../../core/pixels';
import { friendlyError } from '../../../core/net';
import { JavaModelSet, javaTexturePath, modelPath, resolveTextureVar } from '../../../shared/models/java-models';
import { fmt, joinList, textLocale } from '../../../i18n/editor-text';
import { prettyJson } from '../models/doc';
import { scaleForResolution } from '../project';
import type { TexStore } from '../ui/store';
import type { ModelService } from '../ui/models';
import { firstSquare } from '../ui/meta';
import { paintCanvas } from '../ui/thumbs';
import { NAME_MAX, cleanName, definitionPath, flatModel, nameRules, slugOf, variantModelId, variantTexturePath } from './names';
import { hasOwnShape, itemBaseModel, nameFilesPlan, newVariantId, packNameRules, variantOfTexture, variantsOf } from './pack';
import { itemName, looksOfTexture } from './strip';
import { loadNamesText } from './i18n/load';
import { tn } from './i18n/text';
import './names.css';

export interface NamesDialogOptions {
  store: TexStore;
  models: ModelService;
  /** The open texture: an item's picture or a look's */
  path: string;
  /** The item, when it is known (the preview's item) */
  item?: string;
  /** Start with the form for a new look open */
  add?: boolean;
  /** Paint a texture (the window closes first) */
  openTexture(path: string): void;
  /** Edit a look's 3D shape in the model editor (the window closes first) */
  editShape(id: string): void;
  /** A look was removed: `item` is the item's own texture (to open instead of the look's) */
  onRemoved?(texture: string, item: string): void;
}

const jsonBlob = (text: string) => new Blob([text], { type: 'application/json' });
const quote = (name: string) => fmt(tn.quoted, { name });
const quotedList = (v: Pick<NameVariant, 'names' | 'match'>) => joinList((v.names.length ? v.names : [v.match ?? '']).map(quote), 'or');

/** The item whose flat picture a texture is ('nolib': the item list couldn't load). */
async function itemOf(store: TexStore, models: ModelService, path: string, item?: string): Promise<{ item: string; texture: string } | 'none' | 'nolib'> {
  const lib = models.lib ?? (await models.load());
  const files = lib?.javaFiles();
  if (!lib || !files) return 'nolib';
  if (item) {
    const t = flatTexture(files, item) ?? variantsOf(store.project, item)[0]?.[1].texture;
    return t ? { item, texture: t } : 'none';
  }
  const own = variantOfTexture(store.project, path);
  if (own) {
    const t = flatTexture(files, own[1].item);
    return { item: own[1].item, texture: t ?? path };
  }
  await lib.usageAsync();
  const file = path.slice(path.lastIndexOf('/') + 1).replace(/\.png$/, '');
  const ids = [...new Set([...(lib.item(file) ? [file] : []), ...lib.usageOf(path).items, ...looksOfTexture(store, models, path).map(([, v]) => v.item)])];
  for (const id of ids) if (flatTexture(files, id) === path) return { item: id, texture: path };
  return 'none';
}

/** The texture an item's flat model shows (layer0 of its model in the game), or null for other items. */
function flatTexture(files: NonNullable<ReturnType<NonNullable<ModelService['lib']>['javaFiles']>>, item: string): string | null {
  const base = itemBaseModel(item, files.vanilla(definitionPath(item)));
  const r = new JavaModelSet(files.vanilla).resolve(base);
  if (r.builtin !== 'generated') return null;
  const ref = resolveTextureVar(r.textures, 'layer0').ref;
  return ref ? javaTexturePath(ref) : null;
}

export async function openNamesDialog(o: NamesDialogOptions): Promise<void> {
  await loadNamesText(textLocale());
  const { store, models } = o;
  const project = store.project;
  const body = h('div', { class: 'nm' }, h('div', { class: 'nm-loading' }, spinner(24), h('span', { class: 'muted' }, tn.loading)));
  let cleanup = () => undefined as void;
  const modal = openModal({ title: tn.title, width: 600, class: 'nm-modal', body, actions: [{ label: kit.close, variant: 'secondary' }], onClose: () => cleanup() });

  const java = project.edition === 'java';
  const rules = nameRules(project.version);
  if (!java || !rules.models) {
    body.replaceChildren(note(java ? tn.edition.old : tn.edition.bedrock, 'warn'));
    return;
  }
  const found = await itemOf(store, models, o.path, o.item);
  if (!modal.el.isConnected) return;
  if (found === 'none' || found === 'nolib') {
    body.replaceChildren(note(found === 'none' ? tn.notItem : tn.noModels, 'warn'));
    return;
  }
  const { item, texture: itemTexture } = found;
  const name = itemName(models, item);
  const plan = nameFilesPlan(project);
  const edition = plan.select ? (plan.cit ? tn.edition.range : tn.edition.vanilla) : tn.edition.optifine;
  let adding = !!o.add || !variantsOf(project, item).length;
  /** The look whose names are being changed */
  let editing: string | null = null;

  const headIcon = h('canvas', { class: 'nm-head-icon pixelated', 'aria-hidden': 'true' });
  void picture(itemTexture).then((img) => img && paintCanvas(headIcon, img));
  const head = h('div', { class: 'nm-head' }, h('span', { class: 'nm-slot' }, headIcon), h('div', { class: 'nm-head-text' }, h('strong', { class: 'nm-head-name' }, name), h('span', { class: 'faint small truncate' }, `minecraft:${item}`)));
  const list = h('ul', { class: 'nm-list', 'aria-label': tn.looks });
  const looksHead = h('h3', { class: 'nm-section' }, icon('label', { size: 16 }), tn.looks);
  const addArea = h('div', { class: 'nm-add' });
  const kept = h('div', { class: 'nm-kept', hidden: true });
  body.replaceChildren(
    head,
    note(edition, plan.select ? 'info' : 'warn'),
    h('p', { class: 'nm-intro' }, fmt(tn.intro, { item: name })),
    looksHead,
    list,
    addArea,
    h('p', { class: 'nm-exact faint small' }, tn.exact),
    kept,
  );
  paintList();
  paintAdd();
  void paintKept();
  cleanup = store.events.on('names', () => {
    if (!editing) paintList();
  });

  // ---------------------------------------------------------------- looks
  function paintList() {
    const looks = variantsOf(project, item);
    looksHead.hidden = list.hidden = !looks.length;
    list.replaceChildren(...looks.map(([id, v]) => lookRow(id, v)));
  }

  function lookRow(id: string, v: NameVariant): HTMLElement {
    const c = h('canvas', { class: 'nm-slot-img pixelated', role: 'img', 'aria-label': fmt(tn.slot, { names: quotedList(v) }) });
    void picture(v.texture).then((img) => img && paintCanvas(c, img));
    const slot = h('span', { class: 'nm-slot' }, c);
    const badge = h('span', { class: 'nm-badge', hidden: true }, tn.shaped);
    void hasOwnShape(project, v).then((yes) => (badge.hidden = !yes));
    const row = h('li', { class: 'nm-look', dataset: { id } });
    if (editing === id) {
      const field = namesField(v.names, (n) => takenBy(n, id));
      const save = button({
        label: tn.save,
        icon: 'check',
        variant: 'primary',
        size: 'sm',
        onClick: () => {
          const names = field.commit();
          if (!names) return;
          editing = null;
          const next: NameVariant = { ...v, names };
          delete next.match;
          store.setNameVariants({ [id]: next });
          paintList();
        },
      });
      const cancel = button({ label: kit.cancel, variant: 'ghost', size: 'sm', onClick: () => ((editing = null), paintList()) });
      row.classList.add('is-editing');
      row.append(slot, h('div', { class: 'nm-look-main' }, v.match ? patternTip(v.match) : null, field.el, h('div', { class: 'nm-row' }, save, cancel)));
      requestAnimationFrame(() => field.focus());
      return row;
    }
    const tips = h('div', { class: 'nm-tips' }, ...(v.names.length ? v.names.map((n) => tip(n)) : []), v.match ? patternTip(v.match) : null, badge);
    const paint = button({ label: tn.paint, icon: 'pencil', variant: 'primary', size: 'sm', class: 'nm-paint', onClick: () => void ensurePicture(v).then(() => go(() => o.openTexture(v.texture))) });
    tooltip(paint, tn.paintHint);
    const shape = button({ label: tn.shape, icon: 'shapes', variant: 'ghost', size: 'sm', class: 'nm-shape', onClick: () => go(() => o.editShape(id)) });
    tooltip(shape, tn.shapeHint);
    const names = button({ label: tn.editNames, icon: 'pen-square', variant: 'ghost', size: 'sm', class: 'nm-names', onClick: () => ((editing = id), paintList()) });
    tooltip(names, tn.editNamesHint);
    const remove = iconButton('trash', tn.removeHint, () => void removeLook(id), { size: 'sm', class: 'nm-remove' });
    row.append(slot, h('div', { class: 'nm-look-main' }, tips, h('div', { class: 'nm-actions' }, paint, shape, names, remove)));
    return row;
  }

  /** A name as the game's tooltip shows a renamed item: italic, in the tooltip's purple frame. */
  function tip(text: string): HTMLElement {
    return h('span', { class: 'nm-tip' }, text);
  }
  function patternTip(match: string): HTMLElement {
    const t = h('span', { class: 'nm-tip is-pattern' }, h('span', { class: 'nm-tip-rule' }, tn.pattern), match);
    tooltip(t, tn.patternHint);
    return t;
  }

  /** Another look of this item already has the name. */
  function takenBy(n: string, except: string | null): boolean {
    return variantsOf(project, item).some(([id, v]) => id !== except && v.names.includes(n));
  }

  function go(fn: () => void) {
    modal.close();
    fn();
  }

  // ---------------------------------------------------------------- adding one
  function paintAdd() {
    addArea.replaceChildren();
    if (!adding) {
      const b = button({ label: tn.add, icon: 'plus', variant: variantsOf(project, item).length ? 'secondary' : 'primary', class: 'nm-add-btn', onClick: () => ((adding = true), paintAdd()) });
      addArea.append(b);
      return;
    }
    const field = namesField([], (n) => takenBy(n, null));
    const create = button({
      label: tn.create,
      icon: 'pencil',
      variant: 'primary',
      class: 'nm-create',
      onClick: () => {
        const names = field.commit();
        if (names) void createLook(names);
      },
    });
    const cancel = variantsOf(project, item).length ? button({ label: kit.cancel, variant: 'ghost', onClick: () => ((adding = false), paintAdd()) }) : null;
    addArea.append(h('div', { class: 'nm-form' }, h('h3', { class: 'nm-section' }, icon('plus', { size: 16 }), tn.add), h('p', { class: 'faint small' }, fmt(tn.addIntro, { item: name })), field.el, h('div', { class: 'nm-row' }, create, cancel)));
    if (o.add || variantsOf(project, item).length) requestAnimationFrame(() => field.focus());
  }

  async function createLook(names: string[]) {
    try {
      const id = newVariantId(project, item, names[0]);
      const slug = slugOf(id);
      const texture = variantTexturePath(item, slug);
      const model = variantModelId(item, slug);
      const meta = await mcmetaOf(itemTexture);
      const files = lib()!;
      const flat = prettyJson(flatModel(itemBaseModel(item, files.vanilla(definitionPath(item))), texture));
      store.setImage(texture, await copyOfItem(!!meta));
      store.setExtraFiles({ [modelPath(model)]: jsonBlob(flat), ...(meta ? { [`${texture}.mcmeta`]: new Blob([meta], { type: 'application/json' }) } : {}) }, [{ kind: 'item', id: item }]);
      store.setNameVariants({ [id]: { item, names, texture, model, updatedAt: Date.now() } });
      go(() => o.openTexture(texture));
      toast(fmt(tn.created, { item: name, names: joinList(names.map(quote), 'or') }), { tone: 'success', duration: 6000 });
    } catch (err) {
      console.error(err);
      toast(fmt(tn.failed, { error: friendlyError(err) }), { tone: 'error' });
    }
  }

  /** The item's picture as the pack has it, at the pack's resolution (as the pixel editor would open it). */
  async function copyOfItem(animated: boolean): Promise<ImageData> {
    const src = await store.getFull(itemTexture);
    const img = createImageData(src.width, src.height, new Uint8ClampedArray(src.data));
    return !store.isEdited(itemTexture) && project.resolution > 16 ? scaleForResolution(img, project.resolution, animated && img.height > img.width) : img;
  }

  /** A look whose picture was removed in the pixel editor starts again from the item's. */
  async function ensurePicture(v: NameVariant): Promise<void> {
    if (store.isEdited(v.texture) || store.assets.hasFile(v.texture)) return;
    store.setImage(v.texture, await copyOfItem(!!(await mcmetaOf(itemTexture))));
  }

  async function removeLook(id: string) {
    const v = project.nameVariants?.[id];
    if (!v) return;
    if (!(await confirmDialog(tn.removeTitle, fmt(tn.removeText, { names: quotedList(v) }), tn.remove, true))) return;
    await store.flush();
    const others = Object.entries(project.nameVariants ?? {}).filter(([k]) => k !== id);
    const before: Record<string, Blob | null> = {};
    const files: Record<string, Blob | null> = {};
    const ownTexture = !store.assets.hasFile(v.texture) && !others.some(([, x]) => x.texture === v.texture);
    const meta = `${v.texture}.mcmeta`;
    if (ownTexture && project.extraFiles[meta]) files[meta] = null;
    // the look's model, when it is one of the files made for looks
    const mp = modelPath(v.model);
    if (/\/models\/item\/names\//.test(mp) && !others.some(([, x]) => x.model === v.model)) files[mp] = null;
    for (const p of Object.keys(files)) before[p] = project.extraFiles[p] ?? null;
    const blob = ownTexture ? (project.overrides[v.texture] ?? null) : null;
    store.setNameVariants({ [id]: null });
    if (ownTexture) store.setOverrideBlob(v.texture, null);
    store.setExtraFiles(files, [{ kind: 'item', id: v.item }]);
    o.onRemoved?.(v.texture, itemTexture);
    paintList();
    paintAdd();
    toast(fmt(tn.removed, { names: quotedList(v) }), {
      action: {
        label: tn.undo,
        onClick: () => {
          if (blob) store.setOverrideBlob(v.texture, blob);
          store.setExtraFiles(before, [{ kind: 'item', id: v.item }]);
          store.setNameVariants({ [id]: v });
        },
      },
    });
  }

  // ---------------------------------------------------------------- the pack's own rules
  async function paintKept() {
    const rules = (await packNameRules(project)).filter((r) => r.items.includes(item));
    kept.hidden = !rules.length;
    if (!rules.length) return;
    const k = h('div', { class: 'nm-kept-list' }, ...rules.map((r) => h('div', { class: 'nm-kept-row' }, tip(r.label), h('span', { class: 'faint small truncate', title: r.path }, r.path.replace(/^.*\/cit\//, '')))));
    kept.replaceChildren(h('h3', { class: 'nm-section' }, icon('file-text', { size: 16 }), tn.kept), h('p', { class: 'faint small' }, tn.keptHint), k);
  }

  // ---------------------------------------------------------------- helpers
  function lib() {
    return models.lib?.javaFiles() ?? null;
  }

  /** First frame of a texture as the pack has it. */
  async function picture(path: string): Promise<ImageData | null> {
    try {
      return firstSquare(await store.getFull(path));
    } catch {
      return null;
    }
  }

  /** The texture's animation file (the pack's, else the game's), copied with it. */
  async function mcmetaOf(path: string): Promise<string | null> {
    const own = project.extraFiles[`${path}.mcmeta`];
    if (own) return own.text();
    if (!store.assets.hasFile(`${path}.mcmeta`)) return null;
    return store.assets.readText(`${path}.mcmeta`).catch(() => null);
  }
}

function note(text: string, tone: 'info' | 'warn'): HTMLElement {
  return h('p', { class: ['tx-inline-note', 'nm-note', tone === 'warn' && 'warn'] }, icon(tone === 'warn' ? 'warning' : 'info'), h('span', null, text));
}

/**
 * Names as removable chips, a box to type one and "Add name". `commit()` takes a name still in the box
 * too and returns the list, or null (with the reason shown) when it can't be used.
 */
function namesField(start: string[], taken: (name: string) => boolean): { el: HTMLElement; focus(): void; commit(): string[] | null } {
  const names = [...start];
  const chips = h('div', { class: 'nm-chips' });
  const input = h('input', { class: 'input nm-input', type: 'text', placeholder: tn.namePlaceholder, maxLength: NAME_MAX, autocomplete: 'off', spellcheck: false, 'aria-label': tn.nameLabel, enterKeyHint: 'done' });
  const addBtn = button({ label: tn.addName, icon: 'plus', variant: 'secondary', size: 'sm', class: 'nm-addname', onClick: () => void add() });
  const msg = h('p', { class: 'nm-msg small', role: 'status', 'aria-live': 'polite' });
  const say = (text: string, bad = true) => {
    msg.textContent = text;
    msg.classList.toggle('is-error', bad);
  };
  const paint = () => {
    chips.replaceChildren(
      ...names.map((n, i) => {
        const x = h('button', { type: 'button', class: 'nm-chip-x', 'aria-label': fmt(tn.removeName, { name: quote(n) }) }, icon('close', { size: 16 }));
        x.addEventListener('click', () => {
          names.splice(i, 1);
          paint();
          input.focus();
        });
        return h('span', { class: 'nm-chip' }, h('span', { class: 'nm-tip' }, n), x);
      }),
    );
    chips.hidden = !names.length;
  };
  /** Adds what is typed; false when it can't be added (the reason is shown) */
  function add(quiet = false): boolean {
    const raw = input.value;
    const n = cleanName(raw);
    if (!n) {
      if (!quiet) say(tn.nameEmpty);
      return false;
    }
    if (names.includes(n) || taken(n)) {
      say(fmt(tn.nameTaken, { name: quote(n) }));
      return false;
    }
    names.push(n);
    input.value = '';
    say(raw.includes('§') ? tn.nameCleaned : names.length === 1 ? tn.moreNames : '', false);
    paint();
    return true;
  }
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    add();
  });
  input.addEventListener('input', () => msg.classList.contains('is-error') && say('', false));
  paint();
  const el = h('div', { class: 'nm-field' }, chips, h('div', { class: 'nm-row nm-entry' }, input, addBtn), msg);
  return {
    el,
    focus: () => input.focus({ preventScroll: false }),
    commit() {
      if (input.value.trim() && !add()) return null;
      if (!names.length) {
        say(tn.nameEmpty);
        input.focus();
        return null;
      }
      return [...names];
    },
  };
}
