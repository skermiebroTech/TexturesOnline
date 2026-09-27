// Right panel "Preview" tab: the open texture on a rotating 3D block (with its sibling faces and biome
// tint), or as a flat sprite, plus a tiled 3x3 "in context" view. Effects can be previewed on top.

import type { BlockPreview } from '../../../shared/preview/block-preview';
import { cloneImageData } from '../../../core/image';
import { h } from '../../../ui/dom';
import { icon } from '../../../ui/icons';
import { emptyState, iconButton, segmented, toggle } from '../../../ui/components';
import { DEFAULT_FOLIAGE_TINT, DEFAULT_GRASS_TINT, compositeOverlay, tintByAlphaMask, tintImage } from '../../../shared/preview/preview-textures';
import { applyEffects, effectsApply } from '../effects';
import { displayAlphaData, firstSquare, getFrame, planCube, tile3, tintFor, transparentShare, type AnimInfo } from './meta';
import { ICON_KEY, type TexStore } from './store';
import type { OpenTexture } from './canvas-panel';
import { paintCanvas } from './thumbs';

export interface PreviewPanel {
  el: HTMLElement;
  setTexture(t: OpenTexture | null): void;
  /** Panel became visible / hidden */
  setVisible(v: boolean): void;
  destroy(): void;
}

type Mode = 'auto' | 'cube' | 'flat';

export function createPreviewPanel(store: TexStore): PreviewPanel {
  const project = store.project;
  let preview: BlockPreview | null = null;
  let creating: Promise<BlockPreview | null> | null = null;
  let visible = false;
  let tex: OpenTexture | null = null;
  let mode: Mode = 'auto';
  let showFx = true;
  let autoRotate = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let token = 0;

  const stage = h('div', { class: 'tx-pv-stage' });
  const stageLabel = h('span', { class: 'tx-pv-label' });
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
  const rotateBtn = iconButton('reload', 'Spin automatically', () => {
    autoRotate = !autoRotate;
    rotateBtn.setActive(autoRotate);
    preview?.setAutoRotate(autoRotate);
  }, { size: 'sm', active: autoRotate });
  const resetBtn = iconButton('aspect-ratio', 'Reset the view', () => preview?.resetView(), { size: 'sm' });
  const fxToggle = toggle({
    label: 'Show effects',
    value: showFx,
    description: 'See the pack’s effects on top of your pixels.',
    onChange: (v) => {
      showFx = v;
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
  const empty = emptyState({ icon: 'cube', title: 'Nothing to preview', text: 'Open a texture to see it on a block.' });

  const body = h(
    'div',
    { class: 'tx-pv' },
    h('div', { class: 'tx-pv-hero checker-soft' }, stage, stageLabel, h('div', { class: 'tx-pv-float' }, rotateBtn, resetBtn)),
    h('div', { class: 'tx-pv-controls' }, modeSeg),
    fxToggle,
    tiledSection,
  );
  const el = h('div', { class: 'tx-pv-wrap' }, body, empty);

  const ensure = async (): Promise<BlockPreview | null> => {
    if (preview) return preview;
    if (!creating) {
      creating = import('../../../shared/preview/block-preview')
        .then((m) => {
          preview = m.createBlockPreview(stage, { autoRotate });
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

  /** Face image for a texture id, with effects and tint, using live pixels for the open texture. */
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
    const read = async (name: string, fb: [number, number, number]) => {
      const p = `${root}colormap/${name}.png`;
      if (!store.assets.hasFile(p)) return fb;
      try {
        const { sampleColormap } = await import('../../../shared/preview/preview-textures');
        return sampleColormap(withFx(await store.getFull(p), p, false), 0.8, 0.4) ?? fb;
      } catch {
        return fb;
      }
    };
    tints = { grass: await read('grass', DEFAULT_GRASS_TINT), foliage: await read('foliage', DEFAULT_FOLIAGE_TINT) };
  }

  async function render() {
    const my = ++token;
    const t = tex;
    body.hidden = !t;
    empty.hidden = !!t;
    if (!t) return;
    // tiled view (first/current frame, effects applied)
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

    if (!visible) return;
    const pv = await ensure();
    if (!pv || my !== token) return;
    await loadTints();
    if (my !== token) return;
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
    const [up, down, side, front] = await Promise.all([
      plan.up === e.id ? mainShown : faceImage(plan.up, t),
      plan.down === e.id ? mainShown : faceImage(plan.down, t),
      plan.side === e.id ? mainShown : faceImage(plan.side, t),
      plan.front ? (plan.front === e.id ? mainShown : faceImage(plan.front, t)) : Promise.resolve(null),
    ]);
    if (my !== token) return;
    const sideImg = side ?? mainShown;
    pv.showCube(
      { up: up ?? mainShown, down: down ?? up ?? mainShown, north: sideImg, east: sideImg, west: sideImg, south: front ?? sideImg },
      frametime ? { frametime } : undefined,
    );
    stageLabel.textContent = 'Block';
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  const soon = (ms = 120) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void render();
    }, ms);
  };

  const offs = [
    store.events.on('image', ({ path }) => {
      if (tex && path === tex.key) soon(90);
    }),
    store.events.on('effects', () => {
      tints = null;
      soon(160);
    }),
    store.events.on('overrides', ({ path }) => {
      if (tex && path !== tex.key) soon(200);
    }),
  ];

  return {
    el,
    setTexture(t) {
      tex = t;
      void render();
    },
    setVisible(v) {
      visible = v;
      if (v) void render();
    },
    destroy() {
      offs.forEach((f) => f());
      if (timer) clearTimeout(timer);
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
