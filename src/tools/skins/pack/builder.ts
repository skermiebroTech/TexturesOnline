// The Skin Pack Maker (/skin-pack-maker): one screen where the pack is what you work on. Its skins
// as a grid of figures (name, arm style, order, paint in the skin editor, remove), skins added from
// saved skins, PNGs, the starter skins or a player's skin, the pack's name, description and icon,
// opening an existing .mcpack to change it, and the .mcpack download. Packs are stored like other
// projects (IndexedDB, kind 'skinpack') and listed under "Your skin packs".
// Heavy work (reading files, decoding pictures, writing the zip) runs after the tap's own paint
// and gives the page a turn between skins, so adding twenty skins never makes one long task.

import { navigate, replacePath } from '../../../core/router';
import { decodeImage, encodePng } from '../../../core/image';
import { deleteProject, getProject, listProjects, saveProject } from '../../../core/storage';
import type { SkinModel, SkinPackProject, SkinPackSkin } from '../../../core/types';
import { uuidv4 } from '../../../core/uuid';
import { saveBlob } from '../../../core/download';
import { afterNextPaint, yieldToMain } from '../../../core/yield';
import { button, iconButton, openMenu, segmented, setButtonBusy, withBusy } from '../../../ui/components';
import { h, timeAgo, uid } from '../../../ui/dom';
import { dropzone } from '../../../ui/dropzone';
import { icon } from '../../../ui/icons';
import { confirmDialog, openModal } from '../../../ui/modal';
import { toast } from '../../../ui/toast';
import { fmt } from '../../../i18n/editor-text';
import { kit } from '../../../ui/i18n/kit';
import { projectsText } from '../../../shared/i18n/projects';
import { onProjectsChanged } from '../../../shared/project-file/handoff';
import { saveProjectFile } from '../../../shared/project-file/entry';
import type { SkinProjectData } from '../export';
import { createStarterSkin, STARTERS } from '../starters';
import { detectSlim, isHdSkin } from '../templates';
import { drawFigureSoon } from '../ui/figure';
import { fetchSkinByUsername, readSkinFile, SkinSourceError, validateUsername } from '../ui/sources';
import { openPackReady } from '../ui/export-modal';
import { t as startText } from '../i18n/text';
import { packText as t } from '../i18n/pack';
import { exportSkinPack, faceIcon, linkPackSkin, moveItem, newPackSkin, newSkinPack, packNameFor, syncPackSkin, NAME_MAX, DESCRIPTION_MAX } from './pack';
import { readSkinPackFile, SkinPackImportError } from './import';
import './builder.css';

const PAGE = '/skin-pack-maker';
const SKIN_ACCEPT = '.png,image/png';
const PACK_ACCEPT = '.mcpack,.zip';
const isPackFile = (f: File) => /\.(mcpack|zip)$/i.test(f.name);

/** Test hook: the pack on screen. */
export interface PackBuilderTestApi {
  pack(): SkinPackProject;
  flush(): Promise<void>;
}

interface Card {
  skin: SkinPackSkin;
  el: HTMLLIElement;
  num: HTMLElement;
  name: HTMLInputElement;
  arms: ReturnType<typeof segmented<SkinModel>>;
  hint: HTMLElement;
  hd: HTMLElement;
  canvas: HTMLCanvasElement;
  up: HTMLButtonElement;
  down: HTMLButtonElement;
  edit: HTMLButtonElement;
  remove: HTMLButtonElement;
  img: ImageData | null;
}

/** All stored packs, most recently changed first. */
async function storedPacks(): Promise<SkinPackProject[]> {
  try {
    return (await listProjects('skinpack')) as SkinPackProject[];
  } catch {
    return [];
  }
}

/** A picked picture as a square PNG pack icon (at most 256 px; pixel art stays sharp). */
async function iconFromFile(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const size = Math.min(256, side);
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = side > size && side > 64;
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  bmp.close();
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error(t.details.iconBad))), 'image/png'));
}

/** A file picker that is not part of the page (opened from buttons). */
function pickFiles(accept: string, multiple: boolean, onFiles: (files: File[]) => void): void {
  const input = h('input', { type: 'file', accept, multiple, hidden: true });
  input.addEventListener('change', () => {
    const files = [...(input.files ?? [])];
    input.remove();
    if (files.length) onFiles(files);
  });
  input.addEventListener('cancel', () => input.remove());
  document.body.appendChild(input);
  input.click();
}

const skinNameFromFile = (name: string) => name.replace(/\.png$/i, '').replace(/[_-]+/g, ' ').trim().slice(0, NAME_MAX) || t.add.uploadedName;

export async function mountPackBuilder(root: HTMLElement, opts: { packId?: string | null } = {}): Promise<() => void> {
  let destroyed = false;
  let packs = await storedPacks();
  let pack: SkinPackProject;
  let stored = false;
  const wanted = opts.packId ? packs.find((p) => p.id === opts.packId) : undefined;
  if (opts.packId && !wanted) toast(t.packs.missing, { tone: 'warn' });
  if (wanted ?? packs[0]) {
    pack = wanted ?? packs[0];
    stored = true;
  } else pack = newSkinPack();
  normalize(pack);

  function normalize(p: SkinPackProject): void {
    if (!Array.isArray(p.skins)) p.skins = [];
    if (typeof p.description !== 'string') p.description = '';
  }

  /** Edits made in the skin editor to saved skins this pack uses. */
  async function syncFromSaved(): Promise<boolean> {
    let changed = false;
    for (const s of pack.skins) {
      if (!s.skinId) continue;
      const saved = await getProject<SkinProjectData>(s.skinId).catch(() => undefined);
      if (saved?.kind === 'skin' && syncPackSkin(s, saved)) changed = true;
    }
    if (changed && stored) await persist();
    return changed;
  }

  // ---- saving ----
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let saving: Promise<void> | null = null;
  let dirty = false;
  async function persist(): Promise<void> {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = null;
    while (saving) await saving;
    dirty = false;
    const p = pack;
    saving = saveProject(p)
      .then(() => {
        if (p !== pack) return;
        const first = !stored;
        stored = true;
        if (first && !destroyed) replacePath(`${PAGE}?pack=${encodeURIComponent(p.id)}`);
        if (!destroyed) void refreshPacks();
      })
      .catch((err: unknown) => {
        toast(fmt(t.packs.saveFailed, { error: err instanceof Error ? err.message : String(err) }), { tone: 'error' });
      })
      .finally(() => (saving = null));
    await saving;
  }
  const changed = () => {
    dirty = true;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void persist(), 400);
  };
  const flush = async () => {
    if (dirty || saveTimer) await persist();
    while (saving) await saving;
  };
  // what was painted in the skin editor since the pack was last open
  await syncFromSaved();

  // ---- live region ----
  const live = h('p', { class: 'sr-only skp-live', 'aria-live': 'polite' });
  const announce = (msg: string) => {
    live.textContent = '';
    requestAnimationFrame(() => (live.textContent = msg));
  };

  // =============================================================================================
  // Hero

  const newBtn = button({ label: t.packs.newPack, icon: 'plus', variant: 'secondary', class: 'skp-new' });
  const openBtn = button({ label: t.packs.open, icon: 'upload', variant: 'secondary', class: 'skp-open', title: t.packs.openHint });
  const hero = h(
    'header',
    { class: 'sk-hero skp-hero' },
    h(
      'div',
      { class: 'sk-hero-text' },
      h('span', { class: 'eyebrow' }, icon('package'), t.hero.eyebrow),
      h('h1', { class: 'pixel-shadow' }, t.hero.title),
      h('p', { class: 'lead' }, t.hero.lead),
    ),
    h('div', { class: 'skp-hero-actions' }, newBtn, openBtn),
  );

  // =============================================================================================
  // Pack details: icon, name, description, download

  const iconCanvas = h('canvas', { class: 'skp-icon-canvas pixelated', width: 128, height: 128, 'aria-hidden': 'true' });
  const iconImg = h('img', { class: 'skp-icon-img', alt: '', hidden: true });
  const iconBtn = h('button', { type: 'button', class: 'skp-icon', 'aria-label': t.details.iconChange, 'aria-haspopup': 'menu' }, iconCanvas, iconImg, h('span', { class: 'skp-icon-edit' }, icon('pencil')));
  const iconNote = h('span', { class: 'skp-icon-note faint small' });
  let iconUrl: string | null = null;

  const nameId = uid('skp-name');
  const descId = uid('skp-desc');
  const nameInput = h('input', { class: 'input skp-name', id: nameId, type: 'text', maxLength: NAME_MAX, autocomplete: 'off', spellcheck: false, value: pack.name });
  const descInput = h('textarea', { class: 'textarea skp-desc', id: descId, rows: 2, maxLength: DESCRIPTION_MAX });
  descInput.value = pack.description;
  const countEl = h('span', { class: 'skp-count badge tone-blue', 'aria-live': 'polite' });
  const downloadBtn = button({ label: t.download.button, icon: 'download', variant: 'primary', size: 'lg', class: 'skp-download' });
  const downloadNote = h('span', { class: 'skp-download-note faint small' });
  const moreBtn = iconButton('more-vertical', t.packs.more, () => openMoreMenu(), { class: 'skp-more' });
  moreBtn.setAttribute('aria-haspopup', 'menu');

  const details = h(
    'section',
    { class: 'skp-details', 'aria-label': t.details.label },
    h('div', { class: 'skp-icon-wrap' }, iconBtn, h('span', { class: 'skp-icon-label small' }, t.details.icon), iconNote),
    h(
      'div',
      { class: 'skp-fields' },
      h('div', { class: 'field' }, h('div', { class: 'field-head' }, h('label', { class: 'field-label', htmlFor: nameId }, t.details.name)), nameInput, h('div', { class: 'field-desc' }, t.details.nameHint)),
      h('div', { class: 'field' }, h('div', { class: 'field-head' }, h('label', { class: 'field-label', htmlFor: descId }, t.details.description)), descInput, h('div', { class: 'field-desc' }, t.details.descriptionHint)),
    ),
    h('div', { class: 'skp-export' }, h('div', { class: 'skp-export-top' }, countEl, moreBtn), downloadBtn, downloadNote),
  );

  nameInput.addEventListener('input', () => {
    pack.name = nameInput.value;
    changed();
  });
  nameInput.addEventListener('blur', () => {
    if (!nameInput.value.trim()) {
      nameInput.value = pack.name = t.defaultName;
      changed();
    }
  });
  descInput.addEventListener('input', () => {
    pack.description = descInput.value;
    changed();
  });

  function paintIcon(): void {
    if (iconUrl) URL.revokeObjectURL(iconUrl);
    iconUrl = null;
    if (pack.icon) {
      iconUrl = URL.createObjectURL(pack.icon);
      iconImg.src = iconUrl;
      iconImg.hidden = false;
      iconCanvas.hidden = true;
      iconNote.textContent = t.details.iconCustom;
      return;
    }
    iconImg.hidden = true;
    iconCanvas.hidden = false;
    const first = pack.skins[0] ? cards.get(pack.skins[0].id)?.img : null;
    const ctx = iconCanvas.getContext('2d');
    ctx?.clearRect(0, 0, 128, 128);
    if (first && ctx) ctx.putImageData(faceIcon(first, 128), 0, 0);
    iconNote.textContent = first ? t.details.iconFace : t.details.iconEmpty;
  }

  iconBtn.addEventListener('click', () => {
    const upload = () =>
      pickFiles('.png,.jpg,.jpeg,image/png,image/jpeg', false, ([file]) => {
        void iconFromFile(file)
          .then((blob) => {
            pack.icon = blob;
            paintIcon();
            changed();
          })
          .catch(() => toast(t.details.iconBad, { tone: 'error' }));
      });
    openMenu(iconBtn, [
      { label: t.details.iconUpload, icon: 'upload', onClick: upload },
      {
        label: t.details.iconUseFace,
        icon: 'human',
        disabled: !pack.icon,
        onClick: () => {
          delete pack.icon;
          paintIcon();
          changed();
        },
      },
    ]);
  });

  // =============================================================================================
  // Skins

  const cards = new Map<string, Card>();
  const grid = h('ol', { class: 'skp-grid', 'aria-labelledby': 'skp-skins-title' });
  const uploadBtn = button({ label: t.add.upload, icon: 'upload', variant: 'secondary', class: 'skp-add-upload' });
  const savedBtn = button({ label: t.add.saved, icon: 'human', variant: 'secondary', class: 'skp-add-saved' });
  const starterBtn = button({ label: t.add.starters, icon: 'users', variant: 'secondary', class: 'skp-add-starters' });
  const userBtn = button({ label: t.add.username, icon: 'user', variant: 'secondary', class: 'skp-add-username' });
  const addBar = h('div', { class: 'skp-add', role: 'group', 'aria-label': t.add.label }, uploadBtn, savedBtn, starterBtn, userBtn);
  const empty = dropzone({
    accept: `${SKIN_ACCEPT},${PACK_ACCEPT}`,
    multiple: true,
    label: t.skins.emptyTitle,
    hint: t.skins.emptyText,
    icon: 'package',
    onFiles: (files) => void addFiles(files),
  });
  empty.classList.add('skp-empty');
  const orderHint = h('p', { class: 'skp-order-hint faint small' }, icon('drag-and-drop'), h('span', null, t.skins.order));
  const dropCover = h('div', { class: 'skp-drop-cover', 'aria-hidden': 'true' }, icon('upload'), h('strong', null, t.add.drop), h('span', { class: 'small' }, t.add.dropHint));
  const skinsSection = h(
    'section',
    { class: 'skp-skins', 'aria-labelledby': 'skp-skins-title' },
    h('div', { class: 'sk-section-head skp-skins-head' }, h('h2', { id: 'skp-skins-title' }, t.skins.title), addBar),
    orderHint,
    grid,
    empty,
    dropCover,
  );

  uploadBtn.addEventListener('click', () => pickFiles(`${SKIN_ACCEPT},${PACK_ACCEPT}`, true, (files) => void addFiles(files)));
  savedBtn.addEventListener('click', () => void openSavedDialog());
  starterBtn.addEventListener('click', () => openStarterDialog());
  userBtn.addEventListener('click', () => openUsernameDialog());
  openBtn.addEventListener('click', () => pickFiles(PACK_ACCEPT, false, ([f]) => void importPack(f)));
  newBtn.addEventListener('click', () => void switchTo(newSkinPack()));

  function setNumbers(): void {
    const n = pack.skins.length;
    pack.skins.forEach((s, i) => {
      const c = cards.get(s.id);
      if (!c) return;
      c.num.textContent = String(i + 1);
      c.name.setAttribute('aria-label', fmt(t.card.nameLabel, { n: i + 1 }));
      c.up.disabled = i === 0;
      c.down.disabled = i === n - 1;
    });
    countEl.textContent = fmt(t.skins.count, { count: n });
    empty.hidden = n > 0;
    grid.hidden = n === 0;
    orderHint.hidden = n < 2;
    downloadBtn.disabled = n === 0;
    downloadNote.textContent = n ? '' : t.download.empty;
    downloadNote.hidden = n > 0;
  }

  const label = (s: SkinPackSkin) => s.name.trim() || `${t.add.uploadedName} ${pack.skins.indexOf(s) + 1}`;

  function paintHint(c: Card): void {
    if (!c.img) return;
    const slim = detectSlim(c.img);
    const off = slim !== (c.skin.model === 'slim');
    c.hint.hidden = !off;
    c.hint.querySelector('.skp-hint-text')!.textContent = slim ? t.card.looksSlim : t.card.looksClassic;
    c.hd.hidden = !isHdSkin(c.img);
  }

  function drawCard(c: Card): void {
    if (!c.img) return;
    drawFigureSoon(c.canvas, c.img, c.skin.model);
    paintHint(c);
  }

  // Pictures are decoded one per task, in the order the cards show.
  const decodeQueue: Card[] = [];
  let decoding = false;
  function queueDecode(c: Card): void {
    decodeQueue.push(c);
    if (decoding) return;
    decoding = true;
    void (async () => {
      try {
        while (decodeQueue.length && !destroyed) {
          const card = decodeQueue.shift()!;
          const image = card.skin.image;
          try {
            const img = await decodeImage(image, 'png');
            if (card.skin.image !== image) continue; // replaced meanwhile: queued again
            card.img = img;
            drawCard(card);
            if (pack.skins[0] === card.skin && !pack.icon) paintIcon();
          } catch {
            card.canvas.replaceWith(icon('human'));
          }
          await yieldToMain();
        }
      } finally {
        decoding = false;
      }
    })();
  }

  function makeCard(skin: SkinPackSkin): Card {
    const num = h('span', { class: 'skp-num', 'aria-hidden': 'true' });
    const canvas = h('canvas', { class: 'sk-figure', 'aria-hidden': 'true' });
    const handle = h('span', { class: 'skp-handle', title: t.card.drag, 'aria-hidden': 'true' }, icon('drag-and-drop'));
    const hd = h('span', { class: 'sk-hd-tag skp-hd', hidden: true, 'aria-hidden': 'true' }, 'HD');
    const name = h('input', { class: 'input skp-skin-name', type: 'text', maxLength: NAME_MAX, autocomplete: 'off', spellcheck: false, value: skin.name });
    const arms = segmented<SkinModel>({
      value: skin.model,
      size: 'sm',
      label: fmt(t.card.arms, { name: skin.name }),
      options: [
        { value: 'classic', label: t.card.classic },
        { value: 'slim', label: t.card.slim },
      ],
      onChange: (v) => {
        skin.model = v;
        drawCard(card);
        changed();
      },
    });
    arms.classList.add('skp-arms');
    const hint = h('p', { class: 'skp-hint', hidden: true }, icon('info'), h('span', { class: 'skp-hint-text' }));
    const up = iconButton('arrow-up', fmt(t.card.moveUp, { name: skin.name }), () => moveBy(card, -1), { size: 'sm', class: 'skp-up' });
    const down = iconButton('arrow-down', fmt(t.card.moveDown, { name: skin.name }), () => moveBy(card, 1), { size: 'sm', class: 'skp-down' });
    const edit = button({ label: t.card.edit, icon: 'brush', variant: 'ghost', size: 'sm', class: 'skp-edit' });
    edit.setAttribute('aria-label', fmt(t.card.editLabel, { name: skin.name }));
    const remove = iconButton('trash', fmt(t.card.remove, { name: skin.name }), () => removeCard(card), { size: 'sm', class: 'skp-remove' });
    const el = h(
      'li',
      { class: 'skp-skin', dataset: { id: skin.id } },
      h('div', { class: 'skp-stage' }, canvas, num, handle, hd),
      h('div', { class: 'skp-body' }, name, arms, hint, h('div', { class: 'skp-actions' }, up, down, h('span', { class: 'grow' }), edit, remove)),
    );
    const card: Card = { skin, el, num, name, arms, hint, hd, canvas, up, down, edit, remove, img: null };
    const relabel = () => {
      const n = label(skin);
      arms.setAttribute('aria-label', fmt(t.card.arms, { name: n }));
      up.setAttribute('aria-label', fmt(t.card.moveUp, { name: n }));
      down.setAttribute('aria-label', fmt(t.card.moveDown, { name: n }));
      edit.setAttribute('aria-label', fmt(t.card.editLabel, { name: n }));
      remove.setAttribute('aria-label', fmt(t.card.remove, { name: n }));
    };
    name.addEventListener('input', () => {
      skin.name = name.value;
      relabel();
      changed();
    });
    edit.addEventListener('click', () => void withBusy(edit, () => editSkin(card)));
    // Dragging starts from the handle only (the fields inside stay selectable).
    handle.addEventListener('pointerdown', () => (el.draggable = true));
    el.addEventListener('pointerup', () => (el.draggable = false));
    el.addEventListener('dragstart', (e) => {
      if (!el.draggable) return;
      dragging = card;
      e.dataTransfer?.setData('text/plain', skin.name);
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      requestAnimationFrame(() => el.classList.add('is-dragging'));
    });
    el.addEventListener('dragend', () => {
      el.draggable = false;
      el.classList.remove('is-dragging');
      clearDropMarks();
      dragging = null;
    });
    cards.set(skin.id, card);
    queueDecode(card);
    return card;
  }

  function renderGrid(): void {
    const els = pack.skins.map((s) => (cards.get(s.id) ?? makeCard(s)).el);
    for (const [id, c] of cards) if (!pack.skins.some((s) => s.id === id)) cards.delete(id) && c.el.remove();
    grid.replaceChildren(...els);
    setNumbers();
  }

  /** Puts the skins in a new order, keeping the focused control focused. */
  function reorder(next: SkinPackSkin[], moved: Card): void {
    const focused = document.activeElement;
    pack.skins = next;
    grid.append(...next.map((s) => cards.get(s.id)!.el));
    setNumbers();
    if (focused instanceof HTMLElement && moved.el.contains(focused)) {
      const target = focused.matches(':disabled') ? (focused === moved.up ? moved.down : moved.up) : focused;
      target.focus();
    }
    announce(fmt(t.card.moved, { name: label(moved.skin), place: next.indexOf(moved.skin) + 1, count: next.length }));
    paintIcon();
    changed();
  }

  function moveBy(card: Card, by: number): void {
    const i = pack.skins.indexOf(card.skin);
    const j = i + by;
    if (i < 0 || j < 0 || j >= pack.skins.length) return;
    reorder(moveItem(pack.skins, i, j), card);
  }

  function removeCard(card: Card): void {
    const i = pack.skins.indexOf(card.skin);
    if (i < 0) return;
    const hadFocus = card.el.contains(document.activeElement);
    pack.skins = pack.skins.filter((s) => s !== card.skin);
    renderGrid();
    paintIcon();
    changed();
    const name = label(card.skin);
    announce(fmt(t.card.removed, { name }));
    if (hadFocus) {
      const next = pack.skins[Math.min(i, pack.skins.length - 1)];
      (next ? cards.get(next.id)!.remove : uploadBtn).focus();
    }
    const removedFrom = pack;
    toast(fmt(t.card.removed, { name }), {
      action: {
        label: t.card.undo,
        onClick: () => {
          if (pack !== removedFrom || pack.skins.includes(card.skin)) return;
          pack.skins.splice(Math.min(i, pack.skins.length), 0, card.skin);
          renderGrid();
          paintIcon();
          changed();
          card.remove.focus();
        },
      },
    });
  }

  // ---- drag and drop: reordering cards, and files dropped anywhere on the skins ----
  let dragging: Card | null = null;
  let dropAt: { card: Card; after: boolean } | null = null;
  const clearDropMarks = () => {
    grid.querySelectorAll('.drop-before, .drop-after').forEach((el) => el.classList.remove('drop-before', 'drop-after'));
    dropAt = null;
  };
  grid.addEventListener('dragover', (e) => {
    if (!dragging) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    const li = (e.target as Element).closest?.('.skp-skin') as HTMLLIElement | null;
    const card = li ? [...cards.values()].find((c) => c.el === li) : null;
    if (!card || card === dragging) return clearDropMarks();
    const r = li!.getBoundingClientRect();
    // cards in a row (wide screens) or a column (phones)
    const column = grid.clientWidth - r.width < r.width / 2;
    const after = column ? e.clientY > r.top + r.height / 2 : e.clientX > r.left + r.width / 2;
    if (dropAt?.card === card && dropAt.after === after) return;
    clearDropMarks();
    dropAt = { card, after };
    li!.classList.add(after ? 'drop-after' : 'drop-before');
  });
  grid.addEventListener('drop', (e) => {
    if (!dragging || !dropAt) return;
    e.preventDefault();
    const from = pack.skins.indexOf(dragging.skin);
    let to = pack.skins.indexOf(dropAt.card.skin) + (dropAt.after ? 1 : 0);
    if (from < to) to--;
    const moved = dragging;
    clearDropMarks();
    if (from !== to) reorder(moveItem(pack.skins, from, to), moved);
  });

  let fileDepth = 0;
  const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files');
  skinsSection.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    fileDepth++;
    skinsSection.classList.add('is-file-over');
  });
  skinsSection.addEventListener('dragover', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  });
  skinsSection.addEventListener('dragleave', (e) => {
    if (!hasFiles(e)) return;
    fileDepth = Math.max(0, fileDepth - 1);
    if (!fileDepth) skinsSection.classList.remove('is-file-over');
  });
  skinsSection.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.stopPropagation();
    fileDepth = 0;
    skinsSection.classList.remove('is-file-over');
    // the empty drop zone handles its own drops
    if (empty.contains(e.target as Node)) return;
    void addFiles([...(e.dataTransfer?.files ?? [])]);
  });

  // =============================================================================================
  // Adding skins

  /** Adds skins to the pack on screen, a few per task, and announces how many came in. */
  async function addSkins(list: SkinPackSkin[]): Promise<void> {
    if (!list.length) return;
    for (let i = 0; i < list.length; i++) {
      pack.skins.push(list[i]);
      grid.appendChild(makeCard(list[i]).el);
      if (i % 4 === 3) await yieldToMain();
    }
    setNumbers();
    if (pack.skins.length === list.length) paintIcon();
    changed();
    await persist();
    // the new cards are the visible answer; screen readers hear it
    announce(fmt(t.add.added, { count: list.length }));
  }

  async function addFiles(files: File[]): Promise<void> {
    const packFile = files.find(isPackFile);
    if (packFile) {
      await importPack(packFile);
      files = files.filter((f) => f !== packFile);
    }
    files = files.filter((f) => !isPackFile(f));
    if (!files.length) return;
    setButtonBusy(uploadBtn, true);
    await afterNextPaint();
    const added: SkinPackSkin[] = [];
    const errors: string[] = [];
    try {
      for (const file of files) {
        try {
          const loaded = await readSkinFile(file);
          const bytes = encodePng(loaded.image);
          added.push(newPackSkin({ name: skinNameFromFile(file.name), model: loaded.model, image: new Blob([bytes], { type: 'image/png' }) }));
        } catch (err) {
          errors.push(fmt(t.add.failed, { name: file.name, error: err instanceof SkinSourceError ? err.message : startText.bring.uploadFailed }));
        }
        await yieldToMain();
      }
      await addSkins(added);
    } finally {
      if (uploadBtn.isConnected) setButtonBusy(uploadBtn, false);
    }
    if (errors.length) toast(errors.slice(0, 3).join('\n') + (errors.length > 3 ? '\n…' : ''), { tone: 'error', duration: 10000 });
  }

  async function openSavedDialog(): Promise<void> {
    const saved = ((await listProjects('skin').catch(() => [])) as SkinProjectData[]).filter((p) => p.image instanceof Blob);
    const inPack = new Set(pack.skins.map((s) => s.skinId).filter(Boolean));
    const boxes: HTMLInputElement[] = [];
    const addBtnLabel = () => fmt(t.saved.add, { count: boxes.filter((b) => b.checked && !b.disabled).length });
    const rows = saved.map((p) => {
      const thumb = h('span', { class: 'sk-pack-thumb' });
      void decodeImage(p.image, 'png')
        .then((img) => {
          const c = h('canvas', { class: 'sk-figure', 'aria-hidden': 'true' });
          thumb.appendChild(c);
          drawFigureSoon(c, img, p.model);
        })
        .catch(() => thumb.appendChild(icon('human')));
      const already = inPack.has(p.id);
      const box = h('input', { type: 'checkbox', class: 'sk-pack-check', value: p.id, checked: already, disabled: already });
      boxes.push(box);
      return h(
        'label',
        { class: 'sk-pack-skin' },
        box,
        thumb,
        h('span', { class: 'sk-pack-info' }, h('span', { class: 'sk-pack-name truncate' }, p.name || startText.untitled), h('span', { class: 'sk-pack-meta' }, `${p.model === 'slim' ? startText.recent.slim : startText.recent.classic} · ${timeAgo(p.updatedAt || p.createdAt)}`)),
        already ? h('span', { class: 'badge tone-blue' }, t.saved.inPack) : null,
      );
    });
    const body = saved.length
      ? h('div', { class: 'sk-pack skp-saved' }, h('p', { class: 'muted' }, t.saved.intro), h('div', { class: 'sk-pack-list', role: 'group', 'aria-label': t.saved.title }, rows))
      : h('div', { class: 'skp-saved-none' }, h('p', { class: 'muted' }, t.saved.none), h('a', { class: 'btn btn-secondary', href: '#', on: { click: (e: Event) => (e.preventDefault(), m.close(), navigate('/skins')) } }, icon('brush'), h('span', { class: 'btn-label' }, t.saved.openEditor)));
    const m = openModal({
      title: t.saved.title,
      body,
      width: 560,
      afterPaint: true,
      actions: saved.length
        ? [
            { label: kit.cancel, variant: 'ghost' },
            {
              label: addBtnLabel(),
              variant: 'primary',
              onClick: () => {
                const chosen = boxes.filter((b) => b.checked && !b.disabled).map((b) => saved.find((p) => p.id === b.value)!);
                void addSkins(chosen.map((p) => newPackSkin({ name: p.name || startText.untitled, model: p.model, image: p.image, from: p })));
              },
            },
          ]
        : undefined,
    });
    const primary = m.el.querySelector<HTMLButtonElement>('.modal-footer .btn-primary');
    const sync = () => {
      if (!primary) return;
      (primary.querySelector('.btn-label') ?? primary).textContent = addBtnLabel();
      primary.disabled = !boxes.some((b) => b.checked && !b.disabled);
    };
    boxes.forEach((b) => b.addEventListener('change', sync));
    sync();
  }

  function openStarterDialog(): void {
    let model: SkinModel = 'classic';
    const picked = new Set<string>();
    const cardsEl = h('div', { class: 'skp-starters' });
    const render = () =>
      cardsEl.replaceChildren(
        ...STARTERS.map((s) => {
          const text = startText.starters[s.id];
          const c = h('canvas', { class: 'sk-figure', 'aria-hidden': 'true' });
          const b = h('button', { type: 'button', class: 'skp-starter', 'aria-pressed': String(picked.has(s.id)), dataset: { starter: s.id } }, h('span', { class: 'skp-starter-stage' }, c, h('span', { class: 'skp-starter-check' }, icon('check'))), h('span', { class: 'skp-starter-name' }, text.name));
          drawFigureSoon(c, () => createStarterSkin(s.id, model), model);
          b.addEventListener('click', () => {
            if (picked.has(s.id)) picked.delete(s.id);
            else picked.add(s.id);
            b.setAttribute('aria-pressed', String(picked.has(s.id)));
            sync();
          });
          return b;
        }),
      );
    const arms = segmented<SkinModel>({
      value: model,
      size: 'sm',
      label: t.starters.arms,
      options: [
        { value: 'classic', label: t.card.classic },
        { value: 'slim', label: t.card.slim },
      ],
      onChange: (v) => {
        model = v;
        render();
      },
    });
    render();
    const m = openModal({
      title: t.starters.title,
      width: 640,
      afterPaint: true,
      body: h('div', { class: 'skp-starter-dialog' }, h('div', { class: 'skp-starter-head' }, h('p', { class: 'muted' }, t.starters.intro), h('div', { class: 'skp-starter-arms' }, h('span', { class: 'small muted' }, t.starters.arms), arms)), cardsEl),
      actions: [
        { label: kit.cancel, variant: 'ghost' },
        {
          label: fmt(t.saved.add, { count: 0 }),
          variant: 'primary',
          onClick: () => {
            const list = STARTERS.filter((s) => picked.has(s.id)).map((s) =>
              newPackSkin({ name: startText.starters[s.id].name, model, image: new Blob([encodePng(createStarterSkin(s.id, model))], { type: 'image/png' }) }),
            );
            void addSkins(list);
          },
        },
      ],
    });
    const primary = m.el.querySelector<HTMLButtonElement>('.modal-footer .btn-primary');
    const sync = () => {
      if (!primary) return;
      const labelEl = primary.querySelector('.btn-label') ?? primary;
      labelEl.textContent = fmt(t.saved.add, { count: picked.size });
      primary.disabled = !picked.size;
    };
    sync();
  }

  function openUsernameDialog(): void {
    const inputId = uid('skp-user');
    const input = h('input', { class: 'input', id: inputId, type: 'text', placeholder: t.username.placeholder, autocomplete: 'off', spellcheck: false, maxLength: 36 });
    const error = h('p', { class: 'sk-field-error', role: 'alert', hidden: true });
    const lookup = new AbortController();
    const submit = async (): Promise<boolean> => {
      const invalid = validateUsername(input.value);
      error.hidden = !invalid;
      error.textContent = invalid ?? '';
      if (invalid) {
        input.focus();
        return false;
      }
      try {
        const loaded = await fetchSkinByUsername(input.value, lookup.signal);
        for (const n of loaded.notes) toast(n, { tone: 'info', duration: 7000 });
        void addSkins([newPackSkin({ name: loaded.username, model: loaded.model, image: new Blob([encodePng(loaded.image)], { type: 'image/png' }) })]);
        return true;
      } catch (err) {
        if (lookup.signal.aborted) return false;
        error.hidden = false;
        error.textContent = err instanceof SkinSourceError ? err.message : startText.bring.lookupFailed;
        input.focus();
        return false;
      }
    };
    input.addEventListener('input', () => (error.hidden = true));
    const m = openModal({
      title: t.username.title,
      width: 480,
      afterPaint: true,
      initialFocus: input,
      onClose: () => lookup.abort(),
      body: h('div', { class: 'stack skp-user-dialog', style: { '--gap': '12px' } }, h('p', { class: 'muted' }, t.username.text), h('div', { class: 'field' }, h('div', { class: 'field-head' }, h('label', { class: 'field-label', htmlFor: inputId }, t.username.label)), h('div', { class: 'input-with-icon' }, icon('user'), input)), error),
      actions: [
        { label: kit.cancel, variant: 'ghost' },
        { label: t.username.add, variant: 'primary', onClick: submit },
      ],
    });
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      m.el.querySelector<HTMLButtonElement>('.modal-footer .btn-primary')?.click();
    });
  }

  // =============================================================================================
  // Painting a skin in the skin editor, and back

  async function editSkin(card: Card): Promise<void> {
    const s = card.skin;
    let project = s.skinId ? await getProject<SkinProjectData>(s.skinId).catch(() => undefined) : undefined;
    if (project?.kind !== 'skin') project = undefined;
    if (!project) {
      const now = Date.now();
      project = { id: uuidv4(), kind: 'skin', name: s.name.trim() || startText.defaultName, model: s.model, image: s.image, createdAt: now, updatedAt: now, source: 'pack' };
      await saveProject(project);
    } else if (project.model !== s.model || s.syncedAt !== project.updatedAt) {
      // the editor opens the skin as it is in this pack
      project.model = s.model;
      project.image = s.image;
      await saveProject(project);
    }
    linkPackSkin(s, project);
    changed();
    await flush();
    navigate(`/skins/${encodeURIComponent(project.id)}?pack=${encodeURIComponent(pack.id)}`);
  }

  // =============================================================================================
  // Download

  downloadBtn.addEventListener('click', () => void download());
  async function download(): Promise<void> {
    if (!pack.skins.length) return;
    setButtonBusy(downloadBtn, true);
    await afterNextPaint();
    try {
      const p = pack;
      const res = await exportSkinPack(p);
      saveBlob(res.blob, res.filename);
      if (p === pack) changed();
      await flush();
      const first = p.skins[0];
      const img = cards.get(first.id)?.img ?? (await decodeImage(first.image, 'png'));
      if (destroyed) return;
      openPackReady({
        res,
        packName: packNameFor(p),
        skinName: first.name.trim() || `${t.add.uploadedName} 1`,
        image: img,
        model: first.model,
        again: () => saveBlob(res.blob, res.filename),
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : t.download.failed, { tone: 'error' });
    } finally {
      if (downloadBtn.isConnected) setButtonBusy(downloadBtn, false);
    }
  }

  // =============================================================================================
  // Opening an existing skin pack

  async function importPack(file: File): Promise<void> {
    setButtonBusy(openBtn, true);
    const note = toast(fmt(t.import.opening, { name: file.name }), { duration: 60000 });
    await afterNextPaint();
    try {
      const got = await readSkinPackFile(file, file.name);
      const p = newSkinPack(got.name);
      p.description = got.description;
      if (got.icon) p.icon = new Blob([got.icon.slice() as Uint8Array<ArrayBuffer>], { type: 'image/png' });
      if (got.uuids) {
        // an opened pack keeps its ids, so the next download updates the installed copy
        const taken = packs.some((x) => x.bedrockUuids?.header === got.uuids!.header);
        if (!taken) {
          p.bedrockUuids = got.uuids;
          p.packVersion = got.version;
        }
      }
      p.skins = got.skins.map((s) => newPackSkin({ name: s.name, model: s.model, image: new Blob([s.png.slice() as Uint8Array<ArrayBuffer>], { type: 'image/png' }) }));
      note.close();
      await switchTo(p, true);
      toast(fmt(t.import.opened, { name: p.name, count: p.skins.length }), { tone: 'success' });
      if (got.notes.length) toast(got.notes.join('\n'), { tone: 'warn', duration: 12000 });
    } catch (err) {
      note.close();
      toast(err instanceof SkinPackImportError ? err.message : err instanceof Error ? err.message : t.import.notZip, { tone: 'error', duration: 10000 });
    } finally {
      if (openBtn.isConnected) setButtonBusy(openBtn, false);
    }
  }

  // =============================================================================================
  // Your skin packs

  const packList = h('div', { class: 'sk-recent-grid skp-packs-grid' });
  const packsSection = h(
    'section',
    { class: 'sk-section skp-packs', 'aria-labelledby': 'skp-packs-title', hidden: true },
    h('div', { class: 'sk-section-head' }, h('div', { class: 'stack', style: { '--gap': '4px' } }, h('h2', { id: 'skp-packs-title' }, t.packs.title), h('p', { class: 'muted' }, t.packs.text))),
    packList,
  );

  async function refreshPacks(): Promise<void> {
    packs = await storedPacks();
    if (destroyed) return;
    renderPacks();
  }

  function renderPacks(): void {
    packsSection.hidden = packs.length === 0 || (packs.length === 1 && packs[0].id === pack.id);
    packList.replaceChildren(
      ...packs.map((p) => {
        const current = p.id === pack.id;
        const thumb = h('span', { class: 'sk-recent-thumb' });
        const first = p.skins?.[0];
        if (first?.image instanceof Blob) {
          void decodeImage(first.image, 'png')
            .then((img) => {
              const c = h('canvas', { class: 'sk-figure sk-figure-sm', 'aria-hidden': 'true' });
              thumb.appendChild(c);
              drawFigureSoon(c, img, first.model);
            })
            .catch(() => thumb.appendChild(icon('package')));
        } else thumb.appendChild(icon('package'));
        const b = h(
          'button',
          { type: 'button', class: ['sk-recent-link', 'skp-pack-link', current ? 'is-current' : null], 'aria-current': current ? 'true' : null, dataset: { pack: p.id } },
          thumb,
          h(
            'span',
            { class: 'sk-recent-info' },
            h('span', { class: 'sk-recent-name truncate' }, p.name || t.defaultName),
            h('span', { class: 'sk-recent-meta truncate' }, fmt(t.packs.meta, { count: p.skins?.length ?? 0, when: timeAgo(p.updatedAt || p.createdAt) })),
          ),
          current ? h('span', { class: 'badge tone-blue skp-current' }, t.packs.current) : null,
        );
        b.addEventListener('click', () => {
          if (current) {
            nameInput.focus();
            return;
          }
          void getProject<SkinPackProject>(p.id).then((fresh) => (fresh ? switchTo(fresh).then(() => details.scrollIntoView({ block: 'start', behavior: 'smooth' })) : refreshPacks()));
        });
        return h('div', { class: 'sk-recent' }, b);
      }),
    );
  }

  function openMoreMenu(): void {
    openMenu(moreBtn, [
      { label: projectsText.save, icon: 'save', disabled: !pack.skins.length, onClick: () => void flush().then(() => saveProjectFile({ id: pack.id, flush })) },
      {
        label: t.packs.duplicate,
        icon: 'copy',
        disabled: !pack.skins.length,
        onClick: () => {
          const now = Date.now();
          const copy: SkinPackProject = { ...pack, id: uuidv4(), name: fmt(t.packs.copyName, { name: packNameFor(pack) }).slice(0, NAME_MAX), skins: pack.skins.map((s) => ({ ...s, id: uuidv4() })), createdAt: now, updatedAt: now, bedrockUuids: undefined, packVersion: undefined };
          const from = packNameFor(pack);
          void switchTo(copy, true).then(() => toast(fmt(t.packs.copied, { name: from }), { tone: 'success' }));
        },
      },
      {
        label: t.packs.delete,
        icon: 'trash',
        danger: true,
        onClick: async () => {
          const ok = await confirmDialog(t.packs.deleteTitle, fmt(t.packs.deleteText, { name: packNameFor(pack) }), t.packs.delete, true);
          if (!ok) return;
          if (saveTimer) clearTimeout(saveTimer);
          saveTimer = null;
          dirty = false;
          while (saving) await saving;
          if (stored) await deleteProject(pack.id);
          packs = await storedPacks();
          toast(t.packs.deleted, { tone: 'success' });
          stored = false;
          await switchTo(packs[0] ?? newSkinPack());
        },
      },
    ]);
  }

  // =============================================================================================
  // Switching packs

  /** Shows another pack (saving the one on screen first). `store`: save the new one right away. */
  async function switchTo(next: SkinPackProject, store = false): Promise<void> {
    await flush();
    if (destroyed) return;
    normalize(next);
    pack = next;
    stored = packs.some((p) => p.id === next.id);
    if (stored) await syncFromSaved();
    cards.clear();
    decodeQueue.length = 0;
    grid.replaceChildren();
    nameInput.value = pack.name;
    descInput.value = pack.description;
    renderGrid();
    paintIcon();
    if (store) await persist();
    else if (stored) replacePath(`${PAGE}?pack=${encodeURIComponent(pack.id)}`);
    else replacePath(PAGE);
    renderPacks();
    if (!store && !stored) nameInput.focus();
  }

  // =============================================================================================
  // Page

  const page = h('div', { class: ['sk-start', 'container', 'skp'] }, hero, details, skinsSection, packsSection, live);
  root.append(page);
  (page as HTMLElement & { __packBuilder?: PackBuilderTestApi }).__packBuilder = { pack: () => pack, flush };
  renderGrid();
  paintIcon();
  renderPacks();
  if (stored && opts.packId !== pack.id) replacePath(`${PAGE}?pack=${encodeURIComponent(pack.id)}`);
  const offProjects = onProjectsChanged(() => void refreshPacks());
  // saved before the tab goes away
  const onHide = () => {
    if (document.visibilityState === 'hidden' && (dirty || saveTimer)) void persist();
  };
  document.addEventListener('visibilitychange', onHide);

  return () => {
    destroyed = true;
    offProjects();
    document.removeEventListener('visibilitychange', onHide);
    if (dirty || saveTimer) void persist();
    if (iconUrl) URL.revokeObjectURL(iconUrl);
  };
}
