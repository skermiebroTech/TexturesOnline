// Right panel "Preview" tab. For textures that belong to a block or item it is the model workspace:
// the real in-game model in 3D (hover a face to see which texture it is, click it to paint it), a
// state picker (lit, facing, half, age...) and the list of textures the model uses, labelled by role.
// Other textures show on a rotating cube or as a flat sprite. A tiled 3x3 view and the pack's effects
// complete it.

import type { BlockPreview, ModelHit } from '../../../shared/preview/block-preview';
import type { BlockState, ModelEntry, ModelTexture, ModelView, StateProperty } from '../../../shared/models/index';
import { cloneImageData } from '../../../core/image';
import { h } from '../../../ui/dom';
import { icon } from '../../../ui/icons';
import { badge, emptyState, iconButton, segmented, select, spinner, toggle, tooltip } from '../../../ui/components';
import { DEFAULT_FOLIAGE_TINT, DEFAULT_GRASS_TINT, compositeOverlay, tintByAlphaMask, tintImage } from '../../../shared/preview/preview-textures';
import { applyEffects, effectsApply } from '../effects';
import { displayAlphaData, firstSquare, getFrame, planCube, tile3, tintFor, transparentShare, type AnimInfo } from './meta';
import { ICON_KEY, type TexStore } from './store';
import type { OpenTexture } from './canvas-panel';
import type { LiveTexture, ModelService } from './models';
import { paintCanvas } from './thumbs';

export interface PreviewPanel {
  el: HTMLElement;
  setTexture(t: OpenTexture | null): void;
  /** Panel became visible / hidden */
  setVisible(v: boolean): void;
  /** Shows a block or item in the model workspace (null: back to the open texture's own preview) */
  showEntry(entry: ModelEntry | null, state?: BlockState): void;
  /** The block / item on show */
  current(): { entry: ModelEntry; state: BlockState } | null;
  /** Screen point of the most visible face drawn with a texture (tests) */
  facePoint(path: string): { x: number; y: number } | null;
  destroy(): void;
}

export interface PreviewHooks {
  /** Open a texture in the pixel editor (clicked on the model or in the list) */
  openTexture(path: string, how: 'face' | 'list'): void;
  /** The block / item on show changed (null = none) */
  onEntry?(entry: ModelEntry | null): void;
}

type Mode = 'auto' | 'cube' | 'flat';

export function createPreviewPanel(store: TexStore, models: ModelService, hooks: PreviewHooks): PreviewPanel {
  const project = store.project;
  let preview: BlockPreview | null = null;
  let creating: Promise<BlockPreview | null> | null = null;
  let visible = false;
  let tex: OpenTexture | null = null;
  let mode: Mode = 'auto';
  let showFx = true;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let spinTexture = !reduced;
  let spinModel = false;
  let itemFlat = false;
  let token = 0;
  let destroyed = false;
  // model workspace
  let entry: ModelEntry | null = null;
  let state: BlockState = {};
  let view: ModelView | null = null;
  let pinned = false;
  /** The user picked the state of this block: opening textures doesn't change it any more */
  let userState = false;
  let shownKey = '';
  let hoverPath: string | null = null;

  // ---------------------------------------------------------------- DOM
  const stage = h('div', { class: 'tx-pv-stage' });
  const stageLabel = h('span', { class: 'tx-pv-label' });
  const hoverTag = h('span', { class: 'tx-pv-hover', hidden: true });
  const modeSeg = segmented<Mode>({
    value: mode,
    size: 'sm',
    label: 'Preview shape',
    options: [
      { value: 'auto', label: 'Auto' },
      { value: 'cube', label: 'Block' },
      { value: 'flat', label: 'Flat' },
    ],
    onChange: (v) => {
      mode = v;
      void render();
    },
  });
  const itemSeg = segmented<'3d' | 'flat'>({
    value: '3d',
    size: 'sm',
    label: 'Item preview',
    options: [
      { value: '3d', label: '3D' },
      { value: 'flat', label: 'Flat' },
    ],
    onChange: (v) => {
      itemFlat = v === 'flat';
      void render();
    },
  });
  const rotateBtn = iconButton('reload', 'Spin automatically', () => {
    if (entry) spinModel = !spinModel;
    else spinTexture = !spinTexture;
    syncSpin();
  }, { size: 'sm', active: spinTexture });
  const resetBtn = iconButton('aspect-ratio', 'Reset the view', () => preview?.resetView(), { size: 'sm' });
  const syncSpin = () => {
    const on = entry ? spinModel : spinTexture;
    rotateBtn.setActive(on);
    preview?.setAutoRotate(on);
  };
  const fxToggle = toggle({
    label: 'Show effects',
    value: showFx,
    description: 'See the pack’s effects on top of your pixels.',
    onChange: (v) => {
      showFx = v;
      models.resetBiome();
      void render();
    },
  });
  const tileCanvas = h('canvas', { class: 'tx-pv-tiled pixelated', 'aria-label': 'Texture tiled 3 by 3', role: 'img' });
  const tiledBox = h('div', { class: 'tx-pv-tiledbox checker' }, tileCanvas);
  const tiledSection = h(
    'section',
    { class: 'tx-pv-section' },
    h('h3', { class: 'section-title' }, icon('grid-2x2-2'), 'Tiled 3×3'),
    h('p', { class: 'faint small' }, 'How it looks when placed next to itself. Seams jump out here.'),
    tiledBox,
  );
  const empty = emptyState({ icon: 'cube', title: 'Nothing to preview', text: 'Pick a block or open a texture to see it in 3D.' });

  // model header
  const headIcon = h('canvas', { class: 'tx-pv-headicon', 'aria-hidden': 'true' });
  const headName = h('h2', { class: 'tx-pv-name truncate' });
  const headSub = h('span', { class: 'tx-pv-sub truncate' });
  const closeBtn = iconButton('close', 'Back to the texture on its own', () => {
    pinned = true;
    setEntry(null);
    void render();
  }, { size: 'sm' });
  const head = h(
    'header',
    { class: 'tx-pv-head', hidden: true },
    h('span', { class: 'tx-pv-headbox checker-soft' }, headIcon),
    h('span', { class: 'tx-pv-headtext' }, headName, headSub),
    closeBtn,
  );
  const note = h('p', { class: 'tx-inline-note tx-pv-note', hidden: true });
  const statesEl = h('div', { class: 'tx-pv-states', role: 'group', 'aria-label': 'Block state', hidden: true });
  const texList = h('ul', { class: 'tx-pv-texlist', role: 'list', 'aria-label': 'Textures of this model' });
  const texHint = h('p', { class: 'faint small tx-pv-texhint' });
  const texCount = h('span', { class: 'tx-pv-texcount' });
  const texSection = h(
    'section',
    { class: 'tx-pv-section tx-pv-texsection', hidden: true },
    h('h3', { class: 'section-title' }, icon('layers'), 'Textures', texCount),
    texHint,
    texList,
  );
  const hero = h('div', { class: 'tx-pv-hero checker-soft' }, stage, stageLabel, hoverTag, h('div', { class: 'tx-pv-float' }, rotateBtn, resetBtn));
  const controls = h('div', { class: 'tx-pv-controls' }, modeSeg, itemSeg);
  const body = h('div', { class: 'tx-pv' }, head, hero, note, statesEl, controls, texSection, fxToggle, tiledSection);
  const loadingModel = h('div', { class: 'tx-pv-busy', hidden: true }, spinner(16), h('span', null, 'Loading the model…'));
  hero.appendChild(loadingModel);
  const el = h('div', { class: 'tx-pv-wrap' }, body, empty);

  // ---------------------------------------------------------------- 3D view
  const ensure = async (): Promise<BlockPreview | null> => {
    if (preview) return preview;
    if (!creating) {
      creating = import('../../../shared/preview/block-preview')
        .then((m) => {
          // the panel may be gone by the time the 3D code arrives: don't open a WebGL context then
          if (destroyed) return null;
          preview = m.createBlockPreview(stage, { autoRotate: entry ? spinModel : spinTexture });
          preview.setModelHandlers({
            hover: (hit) => onHover(hit),
            pick: (hit) => onPick(hit),
          });
          return preview;
        })
        .catch((err) => {
          console.error(err);
          stage.replaceChildren(h('p', { class: 'faint small tx-pv-nogl' }, '3D preview is not available in this browser.'));
          return null;
        });
    }
    return creating;
  };

  const fxOn = () => showFx && store.effectsActive();

  const withFx = (img: ImageData, path: string, anim: boolean): ImageData => {
    if (!fxOn()) return img;
    const e = store.byPath.get(path);
    const ctx = { path, category: e?.category ?? 'block', animated: anim };
    if (!effectsApply(project.effects, ctx)) return img;
    try {
      return applyEffects(img, project.effects, ctx);
    } catch {
      return img;
    }
  };

  // ---------------------------------------------------------------- model workspace
  const live = (): LiveTexture | null => (tex && tex.key !== ICON_KEY ? { path: tex.key, full: tex.full, anim: tex.anim } : null);

  function setEntry(e: ModelEntry | null, s?: BlockState) {
    const changed = e?.id !== entry?.id || e?.kind !== entry?.kind;
    entry = e;
    const lib = models.lib;
    state = e && lib ? { ...lib.defaultState(e), ...(s ?? {}) } : {};
    if (changed) {
      shownKey = '';
      userState = false;
      hooks.onEntry?.(e);
      syncSpin();
    }
  }

  /** Best block or item to show for the open texture: keep the current one if it uses the texture. */
  function autoEntry(path: string): { entry: ModelEntry; state?: BlockState } | null {
    const lib = models.lib;
    if (!lib?.available) return null;
    if (entry) {
      const t = lib.textureStates(entry).find((x) => x.path === path);
      if (t) return { entry, state: userState ? state : statesShowing(entry, state, path) };
    }
    if (!lib.usageReady) return null;
    const u = lib.usageOf(path);
    const pick = (u.blocks[0] && lib.block(u.blocks[0])) || (u.items[0] && lib.item(u.items[0])) || null;
    return pick ? { entry: pick, state: statesShowing(pick, lib.defaultState(pick), path) } : null;
  }

  /** The state closest to `cur` in which `path` is visible. */
  function statesShowing(e: ModelEntry, cur: BlockState, path: string): BlockState {
    const lib = models.lib!;
    const v = lib.resolve(e, cur);
    const t = v.textures.find((x) => x.path === path);
    return t && t.faces === 0 && t.state ? t.state : cur;
  }

  function paintHead() {
    if (!entry || !view) return;
    headName.textContent = entry.name;
    headSub.textContent = `${entry.kind === 'block' ? 'Block' : 'Item'} · ${entry.id}`;
    head.title = entry.id;
    const cached = models.peekIcon(entry, fxOn());
    const draw = (img: HTMLCanvasElement | ImageData) => {
      if (img instanceof HTMLCanvasElement) {
        headIcon.width = img.width;
        headIcon.height = img.height;
        headIcon.getContext('2d')?.drawImage(img, 0, 0);
        headIcon.classList.add('smooth');
      } else {
        paintCanvas(headIcon, img);
        headIcon.classList.remove('smooth');
      }
    };
    if (cached) draw(cached);
    else {
      const e = entry;
      void models.icon(e, fxOn()).then((img) => {
        if (img && entry === e) draw(img);
      });
    }
  }

  function paintNote() {
    const text = view?.note;
    note.hidden = !text;
    if (text) note.replaceChildren(icon('info'), h('span', null, text));
  }

  function paintStates() {
    const lib = models.lib;
    if (!entry || !lib) {
      statesEl.hidden = true;
      return;
    }
    const props: StateProperty[] = lib.properties(entry);
    statesEl.hidden = !props.length;
    statesEl.replaceChildren(
      ...props.map((p) => {
        const value = state[p.name] ?? p.values[0]?.value ?? '';
        const setValue = (v: string) => {
          state = { ...state, [p.name]: v };
          userState = true;
          void render({ keepView: true });
        };
        const short = p.values.length <= 4 && p.values.reduce((a, v) => a + v.label.length, 0) <= 14;
        const control = short
          ? segmented<string>({ value, size: 'sm', label: p.label, options: p.values.map((v) => ({ value: v.value, label: v.label })), onChange: setValue })
          : select<string>({ value, options: p.values.map((v) => ({ value: v.value, label: v.label })), onChange: setValue });
        if (!short) control.querySelector('select')?.setAttribute('aria-label', p.label);
        return h('div', { class: 'tx-pv-state', dataset: { prop: p.name } }, h('span', { class: 'tx-pv-state-label' }, p.label), control);
      }),
    );
  }

  const rowFor = (path: string) => texList.querySelector<HTMLElement>(`li[data-path="${CSS.escape(path)}"]`);

  function paintTextures() {
    if (!view || !entry) {
      texSection.hidden = true;
      return;
    }
    // Textures the game generates (armor trim colours) have no file: list them only where they show.
    const list = view.textures.filter((t) => !t.missing || t.faces > 0 || store.isEdited(t.path));
    texSection.hidden = list.length === 0;
    const inState = list.filter((t) => t.faces > 0 || view!.shape !== 'model');
    const other = list.length - inState.length;
    texCount.textContent = String(list.length);
    texHint.textContent =
      view.shape === 'special'
        ? 'Click the texture sheet to paint it.'
        : view.shape === 'sprite'
          ? 'Click a layer to paint it.'
          : other
            ? 'Click a face or a texture to paint it. Dimmed: other states.'
            : 'Click a face or a texture to paint it.';
    texList.replaceChildren(...list.map((t) => textureRow(t)));
    syncRows();
  }

  function textureRow(t: ModelTexture): HTMLElement {
    const thumb = h('canvas', { class: 'tx-pv-texthumb', 'aria-hidden': 'true' });
    const e = store.byPath.get(t.path);
    const name = e?.id ?? t.path.slice(t.path.lastIndexOf('/') + 1).replace(/\.(png|tga)$/i, '');
    const other = t.faces === 0 && view?.shape === 'model';
    const edited = store.isEdited(t.path);
    const btn = h(
      'button',
      { type: 'button', class: 'tx-pv-texbtn' },
      h('span', { class: 'tx-pv-texthumbbox checker' }, thumb),
      h('span', { class: 'tx-pv-textext' }, h('span', { class: 'tx-pv-texlabel' }, t.label), h('span', { class: 'tx-pv-texname truncate' }, name)),
      h(
        'span',
        { class: 'tx-pv-texbadges' },
        t.missing ? badge('Missing', 'red') : null,
        edited ? h('span', { class: 'tx-pv-texedit', title: 'Edited' }, icon('pencil', { size: 16 })) : null,
        t.animated ? h('span', { class: 'tx-pv-texanim', title: 'Animated' }, icon('play', { size: 16 })) : null,
      ),
    );
    const li = h('li', { class: ['tx-pv-texrow', other && 'is-other'], dataset: { path: t.path } }, btn);
    btn.setAttribute('aria-label', `${t.label}: ${name}${other ? ' (another state)' : ''}${edited ? ', edited' : ''}`);
    tooltip(btn, other ? `Shown when ${stateText(t.state)} — click to switch and paint it` : `Paint ${name}`);
    btn.addEventListener('click', () => {
      if (other && t.state) {
        state = { ...t.state };
        userState = true;
        void render({ keepView: true });
      }
      if (!t.missing || store.isEdited(t.path)) hooks.openTexture(t.path, 'list');
    });
    btn.addEventListener('pointerenter', () => {
      if (!other) preview?.highlightTexture(t.path);
    });
    btn.addEventListener('pointerleave', () => preview?.highlightTexture(null));
    btn.addEventListener('focus', () => {
      if (!other) preview?.highlightTexture(t.path);
    });
    btn.addEventListener('blur', () => preview?.highlightTexture(null));
    void store
      .getFull(t.path)
      .then((img) => {
        let f = firstSquare(img);
        if (/\.tga$/i.test(t.path)) f = displayAlphaData(f, e?.category ?? 'block');
        paintCanvas(thumb, f);
      })
      .catch(() => thumb.classList.add('failed'));
    return li;
  }

  function stateText(s: BlockState | undefined): string {
    const lib = models.lib;
    if (!s || !entry || !lib) return 'another state';
    const props = lib.properties(entry);
    const parts: string[] = [];
    for (const p of props) {
      if (s[p.name] === undefined || s[p.name] === state[p.name]) continue;
      const v = p.values.find((x) => x.value === s[p.name]);
      parts.push(`${p.label}: ${v?.label ?? s[p.name]}`);
    }
    return parts.join(', ') || 'another state';
  }

  function syncRows() {
    for (const li of texList.querySelectorAll<HTMLElement>('li')) {
      const p = li.dataset.path!;
      li.classList.toggle('is-open', !!tex && tex.key === p);
      li.classList.toggle('is-hover', hoverPath === p);
      li.querySelector('button')?.setAttribute('aria-current', String(!!tex && tex.key === p));
    }
  }

  function onHover(hit: ModelHit | null) {
    hoverPath = hit?.texture ?? null;
    const t = hit?.texture ? view?.textures.find((x) => x.path === hit.texture) : null;
    if (t) {
      const name = store.byPath.get(t.path)?.name ?? t.path.slice(t.path.lastIndexOf('/') + 1).replace(/\.(png|tga)$/i, '');
      hoverTag.replaceChildren(h('strong', null, t.label), h('span', null, name));
      hoverTag.hidden = false;
      stageLabel.hidden = true;
    } else {
      hoverTag.hidden = true;
      stageLabel.hidden = false;
    }
    syncRows();
  }

  function onPick(hit: ModelHit) {
    if (!hit.texture) return;
    if (!store.assets.hasFile(hit.texture) && !store.isEdited(hit.texture)) return;
    hooks.openTexture(hit.texture, 'face');
  }

  // ---------------------------------------------------------------- render
  let tints: { grass: [number, number, number]; foliage: [number, number, number] } | null = null;
  const tinted = (img: ImageData, id: string, path: string): ImageData => {
    const t = tintFor(id, project.edition);
    if (!t) return img;
    const color = t.tint === 'fixed' ? t.color! : t.tint === 'grass' ? tints?.grass ?? DEFAULT_GRASS_TINT : tints?.foliage ?? DEFAULT_FOLIAGE_TINT;
    if (project.edition === 'bedrock' && /grass_side\.tga$/.test(path)) return toImage(tintByAlphaMask(img, color));
    return toImage(tintImage(img, color));
  };

  const root = project.edition === 'java' ? 'assets/minecraft/textures/' : 'textures/';
  const pathOfId = (id: string): string | null => {
    for (const ext of ['.png', '.tga']) if (store.byPath.has(root + id + ext)) return root + id + ext;
    return null;
  };

  const faceImage = async (id: string, current: OpenTexture): Promise<ImageData | null> => {
    const path = pathOfId(id);
    if (!path) return null;
    let img: ImageData;
    let anim = false;
    if (path === current.key) {
      img = current.full;
      anim = !!current.anim;
      if (current.anim) img = getFrame(img, current.anim, current.frame);
    } else {
      try {
        img = firstSquare(await store.getFull(path));
      } catch {
        return null;
      }
    }
    img = withFx(img, path, anim);
    const name = id.slice(id.lastIndexOf('/') + 1);
    if (project.edition === 'java' && name === 'grass_block_side') {
      const ov = pathOfId(id + '_overlay');
      if (ov) {
        try {
          const overlay = withFx(firstSquare(await store.getFull(ov)), ov, false);
          return toImage(compositeOverlay(img, overlay, tints?.grass ?? DEFAULT_GRASS_TINT));
        } catch {
          /* plain side */
        }
      }
    }
    return tinted(img, id, path);
  };

  async function loadTints() {
    if (tints) return;
    const b = await models.biome(showFx);
    tints = { grass: b.grass ?? DEFAULT_GRASS_TINT, foliage: b.foliage ?? DEFAULT_FOLIAGE_TINT };
  }

  function paintTiled(t: OpenTexture) {
    const frame = t.anim ? getFrame(t.full, t.anim, t.frame) : t.full;
    const cat = t.entry?.category ?? 'block';
    const shown = (img: ImageData) => (t.alphaData ? displayAlphaData(t.entry ? tinted(img, t.entry.id, t.key) : img, cat) : img);
    const tileSrc = shown(withFx(frame, t.key, !!t.anim));
    paintCanvas(tileCanvas, tile3(tileSrc));
    const tw = tileSrc.width * 3;
    const th = tileSrc.height * 3;
    const box = 240;
    const s = Math.max(tw, th) <= box ? Math.floor(box / Math.max(tw, th)) : box / Math.max(tw, th);
    tileCanvas.style.width = `${Math.round(tw * s)}px`;
    tileCanvas.style.height = `${Math.round(th * s)}px`;
    tileCanvas.classList.toggle('pixelated', s >= 1);
    tiledSection.hidden = t.key === ICON_KEY;
  }

  /** Follows the open texture to a block / item that uses it (keeps the current one when it does). */
  function follow(): boolean {
    const t = tex;
    const lib = models.lib;
    if (t?.key === ICON_KEY && entry) {
      setEntry(null);
      return false;
    }
    if (!t || t.key === ICON_KEY || !lib?.available || pinned) return false;
    const auto = autoEntry(t.key);
    if (auto && (auto.entry !== entry || JSON.stringify(auto.state ?? {}) !== JSON.stringify(state))) {
      const same = auto.entry === entry;
      setEntry(auto.entry, auto.state);
      return same;
    }
    if (!auto && entry) setEntry(null);
    return false;
  }

  async function render(opts: { keepView?: boolean } = {}) {
    const my = ++token;
    const t = tex;
    const lib = models.lib;
    if (entry && lib) {
      try {
        view = lib.resolve(entry, state);
        state = view.state;
      } catch (err) {
        console.error(err);
        view = null;
      }
    } else view = null;
    const modelMode = !!(entry && view);
    body.classList.toggle('is-model', modelMode);
    body.hidden = !t && !modelMode;
    empty.hidden = !!t || modelMode;
    head.hidden = !modelMode;
    modeSeg.hidden = modelMode;
    itemSeg.hidden = !(modelMode && view?.shape === 'sprite');
    controls.hidden = modelMode && itemSeg.hidden;
    rotateBtn.setActive(modelMode ? spinModel : spinTexture);
    if (modelMode) {
      paintHead();
      paintNote();
      paintStates();
      paintTextures();
    } else {
      note.hidden = true;
      statesEl.hidden = true;
      texSection.hidden = true;
      hoverTag.hidden = true;
    }
    if (t) paintTiled(t);
    else tiledSection.hidden = true;
    fxToggle.hidden = !store.effectsActive();

    if (!visible) return;
    const pv = await ensure();
    if (!pv || my !== token) return;
    pv.setAutoRotate(modelMode ? spinModel : spinTexture);
    if (modelMode) {
      await renderModel(pv, my, !!opts.keepView);
      return;
    }
    if (!t) return;
    await loadTints();
    if (my !== token) return;
    renderTexture(pv, t, my);
  }

  async function renderModel(pv: BlockPreview, my: number, keepView: boolean) {
    const v = view!;
    const e = entry!;
    const key = `${e.kind}:${e.id}`;
    const slow = setTimeout(() => {
      if (my === token) loadingModel.hidden = false;
    }, 200);
    const built = await models.scene(v, { fx: fxOn(), live: live() });
    clearTimeout(slow);
    loadingModel.hidden = true;
    if (my !== token) return;
    const again = shownKey === key;
    shownKey = key;
    if (!built) {
      pv.showFlat(new ImageData(1, 1));
      stageLabel.textContent = 'No texture';
      return;
    }
    if (built.flat) {
      pv.showFlat(built.flat);
      stageLabel.textContent = 'Texture sheet';
    } else if (v.shape === 'sprite' && itemFlat) {
      const first = built.scene.textures.get(v.sprite[0]?.path ?? '');
      if (first) pv.showFlat(first.image, first.frames > 1 ? { frametime: first.frametime } : undefined);
      stageLabel.textContent = 'Item';
    } else {
      pv.showModel(built.scene, { view: built.view, keepView: keepView && again });
      stageLabel.textContent = v.approximate ? 'Approximate shape' : e.kind === 'item' ? 'Item' : v.category === 'special' ? 'Drawn by the game' : 'In-game model';
    }
    if (hoverPath) preview?.highlightTexture(hoverPath);
  }

  function renderTexture(pv: BlockPreview, t: OpenTexture, my: number) {
    const frame = t.anim ? getFrame(t.full, t.anim, t.frame) : t.full;
    const cat = t.entry?.category ?? 'block';
    const e = t.entry;
    const isBlockish = !!e && e.category === 'block';
    const cutout = !t.alphaData && transparentShare(frame) > 0.3;
    const cube = mode === 'cube' || (mode === 'auto' && isBlockish && !cutout && t.key !== ICON_KEY);
    const frametime = t.anim ? t.anim.frametime : undefined;
    if (!cube) {
      const img = t.anim ? stripForPreview(withFx(t.full, t.key, true), t.anim) : withFx(t.full, t.key, false);
      const tintedImg = e ? tinted(img, e.id, t.key) : img;
      pv.showFlat(t.alphaData ? displayAlphaData(tintedImg, cat) : tintedImg, frametime && t.anim ? { frametime } : undefined);
      stageLabel.textContent = t.key === ICON_KEY ? 'Pack icon' : e?.category === 'block' ? 'Cut-out block' : 'Sprite';
      return;
    }
    const plan = e ? planCube(e.id, (id) => pathOfId(id) !== null, project.edition) : null;
    const mainFull = withFx(t.anim ? stripForPreview(t.full, t.anim) : t.full, t.key, !!t.anim);
    const main = e ? tinted(mainFull, e.id, t.key) : mainFull;
    const mainShown = t.alphaData ? displayAlphaData(main, cat) : main;
    if (!plan || !e) {
      pv.showCube({ all: mainShown }, frametime ? { frametime } : undefined);
      stageLabel.textContent = 'Block';
      return;
    }
    void Promise.all([
      plan.up === e.id ? mainShown : faceImage(plan.up, t),
      plan.down === e.id ? mainShown : faceImage(plan.down, t),
      plan.side === e.id ? mainShown : faceImage(plan.side, t),
      plan.front ? (plan.front === e.id ? mainShown : faceImage(plan.front, t)) : Promise.resolve(null),
    ]).then(([up, down, side, front]) => {
      if (my !== token) return;
      const sideImg = side ?? mainShown;
      pv.showCube(
        // Minecraft puts a block's front on north, which the preview camera faces by default.
        { up: up ?? mainShown, down: down ?? up ?? mainShown, north: front ?? sideImg, east: sideImg, west: sideImg, south: sideImg },
        frametime ? { frametime } : undefined,
      );
      stageLabel.textContent = 'Block';
    });
  }

  // ---------------------------------------------------------------- live updates
  let timer: ReturnType<typeof setTimeout> | null = null;
  const soon = (ms = 120, opts: { keepView?: boolean } = { keepView: true }) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void render(opts);
    }, ms);
  };

  let liveRaf = 0;
  let livePending: { path: string; full: ImageData } | null = null;
  const pushLive = () => {
    liveRaf = 0;
    const p = livePending;
    livePending = null;
    if (!p || !preview || !view || !entry) return;
    const q = view.quads.find((x) => x.texture === p.path);
    const anim: AnimInfo | null = tex && tex.key === p.path ? tex.anim : null;
    const img = models.textureFromPixels(p.path, p.full, anim, { fx: fxOn(), mask: !!q?.tintMask });
    preview.updateModelTexture(p.path, img);
  };

  const offs = [
    store.events.on('image', ({ path, full }) => {
      if (!tex || path !== tex.key) return;
      paintTiled(tex);
      if (entry && view) {
        if (view.shape === 'model' && view.quads.some((q) => q.texture === path)) {
          // Fast path: swap the pixels of that texture on the model.
          livePending = { path, full };
          liveRaf ||= requestAnimationFrame(pushLive);
          if (texList.querySelector(`li[data-path="${CSS.escape(path)}"]`)) refreshRowThumb(path);
          return;
        }
        soon(150);
        return;
      }
      soon(90);
    }),
    store.events.on('effects', () => {
      tints = null;
      models.resetBiome();
      soon(160);
    }),
    store.events.on('overrides', ({ path }) => {
      if (/colormap\//.test(path)) {
        tints = null;
        models.resetBiome();
      }
      if (tex && path === tex.key) return;
      if (view?.textures.some((t) => t.path === path) || !entry) soon(200);
    }),
    models.events.on('ready', () => {
      follow();
      soon(0, {});
    }),
    models.events.on('usage', () => {
      // Now the block using the open texture is known.
      if (entry) return;
      follow();
      if (entry) soon(0, {});
    }),
  ];

  let thumbTimer: ReturnType<typeof setTimeout> | null = null;
  function refreshRowThumb(path: string) {
    if (thumbTimer) return;
    thumbTimer = setTimeout(() => {
      thumbTimer = null;
      const li = rowFor(path);
      const c = li?.querySelector('canvas');
      if (!c || !tex || tex.key !== path) return;
      const f = firstSquare(tex.anim ? getFrame(tex.full, tex.anim, 0) : tex.full);
      paintCanvas(c, /\.tga$/i.test(path) ? displayAlphaData(f, tex.entry?.category ?? 'block') : f);
      li!.querySelector('.tx-pv-texbadges')?.replaceChildren(h('span', { class: 'tx-pv-texedit', title: 'Edited' }, icon('pencil', { size: 16 })));
    }, 250);
  }

  return {
    el,
    setTexture(t) {
      const changed = t?.key !== tex?.key;
      tex = t;
      // "Texture on its own" (the close button) lasts until another texture opens.
      if (changed) pinned = false;
      if (changed) follow();
      syncRows();
      void render({ keepView: true });
    },
    setVisible(v) {
      visible = v;
      if (v) void render({ keepView: true });
    },
    showEntry(e, s) {
      pinned = false;
      setEntry(e, s);
      if (e && tex && models.lib) {
        // keep the open texture visible when the new block uses it
        const has = models.lib.textureStates(e).some((x) => x.path === tex!.key);
        if (has && !s) state = statesShowing(e, state, tex.key);
      }
      void render();
    },
    current: () => (entry ? { entry, state: { ...state } } : null),
    facePoint: (path) => preview?.facePoint(path) ?? null,
    destroy() {
      destroyed = true;
      token++;
      offs.forEach((f) => f());
      if (timer) clearTimeout(timer);
      if (thumbTimer) clearTimeout(thumbTimer);
      if (liveRaf) cancelAnimationFrame(liveRaf);
      preview?.destroy();
      preview = null;
    },
  };
}

function toImage(img: { width: number; height: number; data: Uint8ClampedArray }): ImageData {
  if (img instanceof ImageData) return img;
  return new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
}

/** The block preview animates vertical strips of square frames; re-pack other layouts. */
function stripForPreview(full: ImageData, a: AnimInfo): ImageData {
  if (a.cols === 1 && a.frameW === full.width && a.frameH === a.frameW) return full;
  const out = new ImageData(a.frameW, a.frameH * a.count);
  for (let i = 0; i < a.count; i++) {
    const f = getFrame(full, a, i);
    out.data.set(f.data, i * f.data.length);
  }
  return a.frameW === a.frameH ? out : cloneImageData(getFrame(full, a, 0));
}
