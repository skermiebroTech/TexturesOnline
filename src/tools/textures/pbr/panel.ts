// Right panel "Material" tab of the texture pack editor (loaded when the tab first opens): the PBR
// material of the open texture. A lit 3D preview (each map can be shown on its own), quick materials,
// values for the whole texture and for parts of it (colourful, bright or dark pixels, some colours, an
// area selected in the pixel editor), bumps made from the colours, and "Use on similar textures".
// Materials live in project.pbr (./material.ts); the export writes the edition's files (./pack.ts).
// Bedrock textures start from the game's own material (its texture set in bedrock-samples).

import type { PbrMapImage, PbrMaterial, PbrSpot, PbrValues, PbrWhere, TextureCategory } from '../../../core/types';
import { createImageData } from '../../../core/pixels';
import { h } from '../../../ui/dom';
import { icon } from '../../../ui/icons';
import { button, iconButton, select, slider, spinner, toggle, tooltip } from '../../../ui/components';
import { openModal } from '../../../ui/modal';
import { toast } from '../../../ui/toast';
import { kit } from '../../../ui/i18n/kit';
import { fmt, joinList, num } from '../../../i18n/editor-text';
import { categoryForPath } from '../project';
import { ICON_KEY, type TexStore } from '../ui/store';
import type { OpenTexture } from '../ui/canvas-panel';
import { byPointer } from '../ui/media';
import { tintFor, tintRgb } from '../ui/meta';
import { tintByAlphaMask, tintImage } from '../../../shared/preview/preview-textures';
import {
  DEFAULT_AMOUNT,
  DEFAULT_BUMPS,
  DEFAULT_TOLERANCE,
  PBR_CATEGORIES,
  PBR_PRESETS,
  PLAIN,
  bakeMers,
  bumpMap,
  cloneMaterial,
  copyForTexture,
  maskFor,
  materialFromPreset,
  paletteOf,
  presetById,
  similarGroups,
  wrapsFor,
  type PbrPresetId,
} from './material';
import { decodeMap, gameMaterial, isPlainMers, type GameMaterial } from './pack';
import { labPaths, layerNames, textureSetPath } from './formats';
import { createMaterialPreview, type MapView, type MaterialPreview } from './preview';
import { tm } from './i18n/text';
import './pbr.css';

export interface MaterialPanel {
  el: HTMLElement;
  setTexture(t: OpenTexture | null): void;
  setVisible(v: boolean): void;
  destroy(): void;
}

export interface MaterialPanelOptions {
  store: TexStore;
  /** The pixel editor's selection on the open texture (null: none) */
  selection(): { x: number; y: number; w: number; h: number } | null;
}

const VIEWS: MapView[] = ['look', 'shine', 'metal', 'glow', 'through', 'bumps'];
type ValueKey = 'shine' | 'metal' | 'glow' | 'through';
const VALUE_KEYS: ValueKey[] = ['shine', 'metal', 'glow', 'through'];
const VALUE_HINTS: Record<ValueKey, () => string> = { shine: () => tm.values.shineHint, metal: () => tm.values.metalHint, glow: () => tm.values.glowHint, through: () => tm.values.throughHint };
type WhereKind = PbrWhere['kind'];
const WHERE_KINDS: WhereKind[] = ['colourful', 'bright', 'dark', 'colour', 'area'];

/** 0-100 on the sliders <-> 0-255 in the maps; shine is the opposite of roughness. */
const toPct = (v: number) => Math.round((v / 255) * 100);
const fromPct = (p: number) => Math.round((Math.max(0, Math.min(100, p)) / 100) * 255);
function valueOf(v: PbrValues, k: ValueKey): number {
  return k === 'shine' ? 100 - toPct(v[2]) : k === 'metal' ? toPct(v[0]) : k === 'glow' ? toPct(v[1]) : toPct(v[3]);
}
function withValue(v: PbrValues, k: ValueKey, pct: number): PbrValues {
  const out: PbrValues = [...v];
  if (k === 'shine') out[2] = fromPct(100 - pct);
  else if (k === 'metal') out[0] = fromPct(pct);
  else if (k === 'glow') out[1] = fromPct(pct);
  else out[3] = fromPct(pct);
  return out;
}

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
const fileName = (p: string) => p.slice(p.lastIndexOf('/') + 1);

export function createMaterialPanel(opts: MaterialPanelOptions): MaterialPanel {
  const { store } = opts;
  const project = store.project;
  const edition = project.edition;
  const offs: (() => void)[] = [];
  let visible = false;
  let destroyed = false;
  let tex: OpenTexture | null = null;
  let colour: ImageData | null = null;
  /** The game's material of the open texture (Bedrock): undefined while loading, null when it has none */
  let game: GameMaterial | null | undefined = null;
  let gameToken = 0;
  /** -1: the whole texture, else the index of the part being edited */
  let editing = -1;
  let view: MapView = 'look';
  let lightDeg = 40;
  let night = false;
  let dirty = true;
  /** This panel is writing to the store (its own 'pbr' events are already drawn) */
  let writing = false;
  const decoded = new WeakMap<PbrMapImage, Promise<ImageData | null>>();

  // ---------------------------------------------------------------- DOM
  const title = h('h3', { class: 'tx-h pbr-title' });
  const intro = h('div', { class: 'tx-note pbr-intro' }, icon('info'), h('p', null, edition === 'java' ? tm.intro.java : tm.intro.bedrock));
  const empty = h('div', { class: 'pbr-empty' }, icon('sparkles', { size: 48 }), h('h3', { class: 'tx-h' }, tm.empty.title), h('p', { class: 'muted' }, tm.empty.text));
  const flatNote = h('div', { class: 'tx-inline-note pbr-flat' }, icon('info'), h('span', null, tm.flat));

  // preview
  const preview: MaterialPreview = createMaterialPreview({
    label: tm.preview.label,
    noGl: tm.preview.noGl,
    onLight: (deg) => {
      lightDeg = deg;
      lightSlider.setValue(Math.round(deg));
    },
  });
  const hero = h('div', { class: 'pbr-hero' }, preview.el);
  const busy = h('div', { class: 'pbr-busy', hidden: true }, spinner(20));
  hero.appendChild(busy);
  const mapButtons = new Map<MapView, { btn: HTMLButtonElement; canvas: HTMLCanvasElement }>();
  const mapStrip = h('div', { class: 'pbr-maps', role: 'group', 'aria-label': tm.maps.show });
  for (const v of VIEWS) {
    const canvas = h('canvas', { class: 'pbr-map-thumb pixelated', width: 16, height: 16 });
    const btn = h('button', { type: 'button', class: 'pbr-map checker', dataset: { view: v }, 'aria-pressed': String(v === view), 'aria-label': tm.maps[v] }, canvas);
    tooltip(btn, tm.maps[v]);
    btn.addEventListener('click', () => setView(v));
    mapButtons.set(v, { btn, canvas });
    mapStrip.appendChild(btn);
  }
  /** What the block shows, in words (the map buttons are pictures) */
  const caption = h('p', { class: 'pbr-caption', 'aria-live': 'polite' });
  const viewTag = h('span', { class: 'pbr-view-tag' });
  hero.appendChild(viewTag);
  const paintCaption = () => {
    caption.textContent = tm.maps.hints[view];
    viewTag.textContent = tm.maps[view];
  };
  paintCaption();
  const lightSlider = slider({
    label: tm.preview.light,
    min: 0,
    max: 359,
    step: 1,
    value: lightDeg,
    unit: '°',
    onInput: (v) => {
      lightDeg = v;
      setMoving(false);
      preview.setLight(v);
    },
  });
  tooltip(lightSlider.querySelector('.field-label') as HTMLElement, tm.preview.lightHint);
  let moving = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const moveBtn = iconButton(moving ? 'pause' : 'play', moving ? tm.preview.stop : tm.preview.move, () => setMoving(!moving), { active: moving, class: 'pbr-move' });
  const nightBtn = iconButton('moon', tm.preview.night, () => setNight(!night), { active: false, class: 'pbr-night' });
  tooltip(nightBtn, tm.preview.nightHint);
  const lightRow = h('div', { class: 'pbr-light' }, lightSlider, h('div', { class: 'pbr-light-btns' }, moveBtn, nightBtn));

  // quick materials
  const presetGrid = h('div', { class: 'pbr-presets' });
  const presetButtons = new Map<string, HTMLButtonElement>();
  const presetBtn = (id: string, name: string, hint: string, swatch: string) => {
    const b = h('button', { type: 'button', class: 'pbr-preset', dataset: { preset: id }, 'aria-pressed': 'false' }, h('span', { class: 'pbr-swatch', style: { background: swatch } }), h('span', { class: 'pbr-preset-name' }, name));
    tooltip(b, hint);
    b.addEventListener('click', () => pickPreset(id));
    presetButtons.set(id, b);
    return b;
  };
  presetGrid.append(presetBtn('none', tm.presets.none, tm.presets.noneHint, 'repeating-conic-gradient(var(--surface-3) 0 25%, var(--bg-elev) 0 50%) 0 0 / 8px 8px'));
  const gameBtn = presetBtn('game', tm.presets.game, tm.presets.gameHint, 'linear-gradient(135deg, #5d9b3a, #8b6a43 55%, #7c7c7c)');
  presetGrid.append(gameBtn);
  for (const p of PBR_PRESETS) presetGrid.append(presetBtn(p.id, tm.presets.names[p.id], tm.presets.hints[p.id], p.swatch));
  const presetsSection = h('section', { class: 'tx-fx-section' }, h('div', { class: 'tx-fx-head' }, h('h3', { class: 'tx-h' }, tm.presets.title)), presetGrid);

  // fine-tune: parts and values
  const partChips = h('div', { class: 'pbr-parts', role: 'group', 'aria-label': tm.parts.title });
  const whereBox = h('div', { class: 'pbr-where' });
  const mapNote = h('div', { class: 'tx-inline-note pbr-mapnote', hidden: true }, icon('info'), h('span', null, tm.parts.mapNote));
  const valueSliders = new Map<ValueKey, ReturnType<typeof slider>>();
  const valuesBox = h('div', { class: 'pbr-values' });
  for (const k of VALUE_KEYS) {
    const s = slider({
      label: tm.values[k],
      min: 0,
      max: 100,
      step: 1,
      value: 0,
      unit: '%',
      description: VALUE_HINTS[k](),
      onInput: (v) => setValue(k, v),
    });
    s.dataset.value = k;
    valueSliders.set(k, s);
    valuesBox.appendChild(s);
  }
  const tuneSection = h('section', { class: 'tx-fx-section' }, h('div', { class: 'tx-fx-head' }, h('h3', { class: 'tx-h' }, tm.parts.title)), partChips, whereBox, mapNote, valuesBox);

  // bumps
  const bumpToggle = toggle({ label: tm.bumps.make, description: tm.bumps.makeHint, value: false, onChange: (v) => setBumps(v ? { ...DEFAULT_BUMPS } : null) });
  const strength = slider({ label: tm.bumps.strength, min: 0, max: 3, step: 0.1, value: 1, onInput: (v) => editBumps({ strength: v }) });
  const smooth = slider({ label: tm.bumps.smooth, min: 0, max: 3, step: 1, value: 0, onInput: (v) => editBumps({ blur: v }) });
  const invert = toggle({ label: tm.bumps.invert, description: tm.bumps.invertHint, value: false, onChange: (v) => editBumps({ invert: v }) });
  const bumpOpts = h('div', { class: 'pbr-bump-opts' }, strength, smooth, invert);
  const packMapNote = h('div', { class: 'tx-inline-note', hidden: true }, icon('info'), h('span', null, tm.bumps.packMap));
  const bumpsSection = h('section', { class: 'tx-fx-section pbr-bumps' }, h('div', { class: 'tx-fx-head' }, h('h3', { class: 'tx-h' }, tm.bumps.title)), bumpToggle, packMapNote, bumpOpts);

  // actions
  const filesLine = h('p', { class: 'pbr-files muted small' });
  const similarBtn = button({ label: tm.similar.button, icon: 'copy', variant: 'secondary', class: 'pbr-similar-btn', onClick: () => openSimilar() });
  const removeBtn = button({ label: tm.remove, icon: 'trash', variant: 'ghost', class: 'pbr-remove-btn', onClick: () => removeMaterial() });
  const about = h('div', { class: 'tx-inline-note pbr-about' }, icon(edition === 'java' ? 'sparkles' : 'sun'), h('span', null, edition === 'java' ? tm.about.java : tm.about.bedrock));
  const actions = h('section', { class: 'pbr-actions' }, about, filesLine, similarBtn, removeBtn);

  const body = h('div', { class: 'pbr-body' }, h('div', { class: 'pbr-preview' }, hero, mapStrip, caption, lightRow), presetsSection, tuneSection, bumpsSection, actions);
  const el = h('div', { class: 'pbr' }, title, intro, empty, flatNote, body);

  // ---------------------------------------------------------------- state
  const path = () => (tex && tex.key !== ICON_KEY ? tex.key : null);
  const categoryOf = (p: string): TextureCategory => store.byPath.get(p)?.category ?? categoryForPath(p, edition);
  const own = () => {
    const p = path();
    return p ? store.material(p) : undefined;
  };
  /** The game's material as one (Bedrock), so the panel can show and start from it */
  const gameAsMaterial = (): PbrMaterial | null =>
    game ? { base: game.values ? [...game.values] : [...PLAIN], spots: [], bumps: null, ...(game.map ? { map: game.map } : {}), ...(game.normal ? { normal: game.normal } : {}), updatedAt: 0 } : null;
  /** What the texture looks like now: its own material, else the game's, else none */
  const effective = (): PbrMaterial | null => own() ?? gameAsMaterial();

  /** A copy to change: the texture's own material, the game's or a plain one. Edited materials leave the pack's files behind. */
  function editable(): PbrMaterial {
    const cur = effective();
    const m = cur ? cloneMaterial(cur) : materialFromPreset(null);
    delete m.original;
    return m;
  }

  function commit(next: PbrMaterial | null) {
    const p = path();
    if (!p) return;
    writing = true;
    try {
      store.setMaterials({ [p]: next });
    } finally {
      writing = false;
    }
    schedule();
    paint();
  }

  // ---------------------------------------------------------------- actions
  function pickPreset(id: string) {
    const p = path();
    if (!p) return;
    const before = own() ?? null;
    let next: PbrMaterial | null;
    if (id === 'game') next = null;
    else if (id === 'none') next = edition === 'bedrock' && game ? { ...materialFromPreset(null), preset: 'none' } : null;
    else next = materialFromPreset(presetById(id) ?? null);
    editing = -1;
    commit(next);
    const name = id === 'none' ? tm.presets.none : id === 'game' ? tm.presets.game : tm.presets.names[id as PbrPresetId];
    toast(fmt(tm.presets.applied, { name, texture: fileName(p) }), { tone: 'success', action: { label: tm.presets.undo, onClick: () => restore(p, before) } });
  }

  function restore(p: string, m: PbrMaterial | null) {
    writing = true;
    try {
      store.setMaterials({ [p]: m });
    } finally {
      writing = false;
    }
    if (p === path()) {
      editing = Math.min(editing, (m?.spots.length ?? 0) - 1);
      schedule();
      paint();
    }
  }

  function removeMaterial() {
    const p = path();
    const before = own() ?? null;
    if (!p || !before) return;
    editing = -1;
    commit(null);
    toast(fmt(tm.presets.removed, { texture: fileName(p) }), { action: { label: tm.presets.undo, onClick: () => restore(p, before) } });
  }

  function setValue(k: ValueKey, pct: number) {
    const m = editable();
    if (editing >= 0 && m.spots[editing]) m.spots[editing].values = withValue(m.spots[editing].values, k, pct);
    else {
      // the whole texture gets one value: a map from the pack or the game gives way to it
      if (m.map) {
        m.base = mapAverage ?? m.base;
        delete m.map;
      }
      m.base = withValue(m.base, k, pct);
    }
    delete m.preset;
    commit(m);
  }

  function setBumps(b: PbrMaterial['bumps']) {
    const m = editable();
    m.bumps = b;
    commit(m);
  }

  function editBumps(change: Partial<NonNullable<PbrMaterial['bumps']>>) {
    const m = editable();
    m.bumps = { ...(m.bumps ?? DEFAULT_BUMPS), ...change };
    commit(m);
  }

  function addPart() {
    const m = editable();
    const values: PbrValues = [...(m.map ? (mapAverage ?? m.base) : m.base)];
    // a new part glows by default: what parts are most often for
    values[1] = 255;
    m.spots.push({ where: { kind: 'colourful', amount: DEFAULT_AMOUNT.colourful }, values });
    delete m.preset;
    editing = m.spots.length - 1;
    commit(m);
  }

  function removePart(i: number) {
    const m = editable();
    m.spots.splice(i, 1);
    editing = -1;
    commit(m);
  }

  function setWhere(where: PbrWhere) {
    const m = editable();
    const spot = m.spots[editing];
    if (!spot) return;
    spot.where = where;
    delete m.preset;
    commit(m);
  }

  function setView(v: MapView) {
    view = v;
    preview.setView(v);
    mapButtons.forEach(({ btn }, k) => btn.setAttribute('aria-pressed', String(k === v)));
    paintCaption();
  }

  function setMoving(on: boolean) {
    moving = on;
    preview.setMoving(on);
    moveBtn.setActive(on);
    moveBtn.setIcon(on ? 'pause' : 'play');
    moveBtn.setAttribute('aria-label', on ? tm.preview.stop : tm.preview.move);
  }

  function setNight(on: boolean) {
    night = on;
    preview.setNight(on);
    nightBtn.setActive(on);
    nightBtn.setIcon(on ? 'sun' : 'moon');
    nightBtn.setAttribute('aria-label', on ? tm.preview.day : tm.preview.night);
    hero.classList.toggle('is-night', on);
  }

  // ---------------------------------------------------------------- similar textures
  function openSimilar() {
    const p = path();
    const src = effective();
    if (!p || !src) return;
    const groups = similarGroups(p, store.entries);
    const chosen = new Set<number>();
    const count = () => new Set(groups.flatMap((g, i) => (chosen.has(i) ? g.paths : []))).size;
    const nameOf = (q: string) => fileName(q).replace(/\.[^.]+$/, '');
    let applyBtn: HTMLButtonElement | null = null;
    const paintApply = () => {
      if (!applyBtn) return;
      applyBtn.disabled = count() === 0;
      const label = applyBtn.querySelector('.btn-label');
      if (label) label.textContent = fmt(tm.similar.apply, { count: count() });
    };
    const list = h('div', { class: 'pbr-sim-list' });
    groups.forEach((g, i) => {
      const label = g.kind === 'sides' ? fmt(tm.similar.sides, { name: g.word }) : fmt(g.kind === 'suffix' ? tm.similar.suffix : tm.similar.prefix, { word: g.word });
      const shown = g.paths.slice(0, 8).map(nameOf).join(', ');
      const desc = g.paths.length > 8 ? `${shown} ${fmt(tm.similar.more, { count: g.paths.length - 8 })}` : shown;
      const row = toggle({
        label: `${label} (${num(g.paths.length)})`,
        description: desc,
        value: false,
        onChange: (v) => {
          if (v) chosen.add(i);
          else chosen.delete(i);
          paintApply();
        },
      });
      row.classList.add('pbr-sim-row');
      row.dataset.kind = g.kind;
      list.appendChild(row);
    });
    const modal = openModal({
      title: tm.similar.title,
      width: 520,
      class: 'pbr-sim-modal',
      body: h('div', { class: 'stack' }, h('p', { class: 'muted' }, tm.similar.intro), groups.length ? list : h('p', { class: 'pbr-sim-none' }, tm.similar.none)),
      actions: [
        { label: kit.cancel, variant: 'ghost' },
        ...(groups.length
          ? [
              {
                label: fmt(tm.similar.apply, { count: 0 }),
                variant: 'primary' as const,
                onClick: () => {
                  const targets = [...new Set(groups.flatMap((g, i) => (chosen.has(i) ? g.paths : [])))];
                  if (!targets.length) return false;
                  const before: Record<string, PbrMaterial | null> = {};
                  const changes: Record<string, PbrMaterial | null> = {};
                  for (const t of targets) {
                    before[t] = store.material(t) ?? null;
                    changes[t] = copyForTexture(src);
                  }
                  store.setMaterials(changes);
                  toast(fmt(tm.similar.applied, { count: targets.length }), { tone: 'success', action: { label: tm.presets.undo, onClick: () => store.setMaterials(before) } });
                },
              },
            ]
          : []),
      ],
    });
    applyBtn = modal.el.querySelector<HTMLButtonElement>('.btn-primary');
    paintApply();
  }

  // ---------------------------------------------------------------- painting the controls
  function paintParts(m: PbrMaterial | null) {
    const spots = m?.spots ?? [];
    if (editing >= spots.length) editing = -1;
    const chip = (label: string, i: number) => {
      const b = h('button', { type: 'button', class: 'pbr-part', 'aria-pressed': String(editing === i), dataset: { part: String(i) } }, label);
      b.addEventListener('click', () => {
        editing = i;
        paint();
      });
      return b;
    };
    const add = button({ label: tm.parts.add, icon: 'plus', size: 'sm', variant: 'ghost', class: 'pbr-part-add', title: tm.parts.addHint, onClick: () => addPart() });
    partChips.replaceChildren(chip(tm.parts.whole, -1), ...spots.map((_s, i) => chip(fmt(tm.parts.part, { n: i + 1 }), i)), add);
  }

  let whereKey = '';
  function paintWhere(m: PbrMaterial | null) {
    const spot: PbrSpot | undefined = editing >= 0 ? m?.spots[editing] : undefined;
    if (!spot || !colour) {
      whereBox.replaceChildren();
      whereBox.hidden = true;
      whereKey = '';
      return;
    }
    whereBox.hidden = false;
    // rebuilt only when the part or its kind changes (sliders keep their drag)
    const key = `${path()}|${editing}|${spot.where.kind}|${spot.where.kind === 'colour' ? spot.where.colours.join(',') : ''}|${spot.where.kind === 'area' ? spot.where.rect.join(',') : ''}`;
    if (key !== whereKey) {
      whereKey = key;
      whereBox.replaceChildren(...whereControls(spot));
    }
    paintMask(spot);
  }

  const maskCanvas = h('canvas', { class: 'pbr-mask pixelated', width: 16, height: 16 });
  const maskCount = h('span', { class: 'pbr-mask-count muted small' });
  const maskBox = h('div', { class: 'pbr-mask-box' }, h('span', { class: 'pbr-mask-frame checker' }, maskCanvas), maskCount);
  tooltip(maskCanvas, tm.parts.maskHint);

  function whereControls(spot: PbrSpot): Node[] {
    const w = spot.where;
    const kindSel = select<WhereKind>({
      label: tm.parts.which,
      value: w.kind,
      options: WHERE_KINDS.map((k) => ({ value: k, label: tm.parts.kinds[k] })),
      onChange: (k) => setWhere(defaultWhere(k)),
    });
    kindSel.classList.add('pbr-kind');
    const out: Node[] = [kindSel];
    if (w.kind === 'colourful' || w.kind === 'bright' || w.kind === 'dark') {
      const kind = w.kind;
      out.push(slider({ label: tm.parts.amount[kind], min: 0, max: 100, step: 1, unit: '%', value: w.amount, onInput: (v) => setWhere({ kind, amount: v }) }));
    } else if (w.kind === 'colour') {
      const picked = new Set(w.colours);
      const swatches = h('div', { class: 'pbr-swatches' });
      for (const c of paletteOf(colour!)) {
        const b = h('button', { type: 'button', class: 'pbr-colour', 'aria-pressed': String(picked.has(c)), 'aria-label': hex(c), style: { background: hex(c) } });
        b.addEventListener('click', () => {
          if (picked.has(c)) picked.delete(c);
          else picked.add(c);
          setWhere({ kind: 'colour', colours: [...picked], tolerance: w.tolerance });
        });
        swatches.appendChild(b);
      }
      out.push(h('p', { class: 'field-label' }, byPointer(tm.parts.colours, tm.parts.coloursTouch)), swatches);
      out.push(slider({ label: tm.parts.tolerance, min: 0, max: 60, step: 1, unit: '%', value: w.tolerance, onInput: (v) => setWhere({ kind: 'colour', colours: [...picked], tolerance: v }) }));
    } else if (w.kind === 'area') {
      const [x, y, aw, ah] = w.rect;
      out.push(
        h('p', { class: 'muted small' }, byPointer(tm.parts.area, tm.parts.areaTouch)),
        h(
          'div',
          { class: 'pbr-area-row' },
          button({
            label: tm.parts.useSelection,
            icon: 'select',
            size: 'sm',
            onClick: () => {
              const sel = opts.selection();
              if (!sel || !colour) {
                toast(tm.parts.noSelection, { tone: 'info' });
                return;
              }
              setWhere({ kind: 'area', rect: [sel.x, sel.y, sel.w, sel.h], size: [colour.width, colour.height] });
            },
          }),
          aw > 0 && ah > 0 ? h('span', { class: 'muted small' }, fmt(tm.parts.areaSize, { w: String(aw), h: String(ah), x: String(x), y: String(y) })) : null,
        ),
      );
    }
    const removeBtn = button({ label: tm.parts.remove, icon: 'trash', size: 'sm', variant: 'ghost', class: 'pbr-part-remove', onClick: () => removePart(editing) });
    out.push(h('div', { class: 'pbr-where-foot' }, maskBox, removeBtn));
    return out;
  }

  function defaultWhere(kind: WhereKind): PbrWhere {
    if (kind === 'colour') return { kind, colours: colour ? paletteOf(colour, 1) : [], tolerance: DEFAULT_TOLERANCE };
    if (kind === 'area') {
      const sel = opts.selection();
      const w = colour?.width ?? 16;
      const hh = colour?.height ?? 16;
      return { kind, rect: sel ? [sel.x, sel.y, sel.w, sel.h] : [0, 0, 0, 0], size: [w, hh] };
    }
    return { kind, amount: DEFAULT_AMOUNT[kind] };
  }

  function paintMask(spot: PbrSpot) {
    if (!colour) return;
    const mask = maskFor(colour, spot.where);
    const img = createImageData(colour.width, colour.height, new Uint8ClampedArray(colour.data));
    let n = 0;
    for (let p = 0; p < mask.length; p++) {
      if (mask[p]) n++;
      else img.data[p * 4 + 3] = Math.round(img.data[p * 4 + 3] * 0.18);
    }
    drawInto(maskCanvas, img);
    maskCount.textContent = fmt(tm.parts.covers, { count: n });
  }

  function paint() {
    const p = path();
    const supported = !!p && PBR_CATEGORIES.has(categoryOf(p));
    empty.hidden = !!p;
    flatNote.hidden = !p || supported;
    body.hidden = !supported;
    intro.hidden = !p;
    title.textContent = p ? fmt(tm.forTexture, { name: fileName(p) }) : '';
    title.hidden = !p;
    if (!supported) return;
    const m = effective();
    const mine = own();
    // quick materials
    const active = mine ? (mine.preset ?? '') : game ? 'game' : 'none';
    presetButtons.forEach((b, id) => b.setAttribute('aria-pressed', String(id === active)));
    gameBtn.hidden = !(edition === 'bedrock' && game);
    // parts and values
    paintParts(m);
    paintWhere(m);
    const values: PbrValues = editing >= 0 && m?.spots[editing] ? m.spots[editing].values : m?.map ? (mapAverage ?? m.base) : (m?.base ?? PLAIN);
    valueSliders.forEach((s, k) => s.setValue(valueOf(values, k)));
    mapNote.hidden = !(editing < 0 && m?.map);
    // bumps
    const bumps = m?.bumps ?? null;
    bumpToggle.setValue(!!bumps);
    bumpOpts.hidden = !bumps;
    packMapNote.hidden = !!bumps || !m?.normal;
    if (bumps) {
      strength.setValue(bumps.strength);
      smooth.setValue(bumps.blur);
      invert.setValue(bumps.invert);
    }
    removeBtn.hidden = !mine;
    similarBtn.disabled = !m;
  }

  // ---------------------------------------------------------------- maps and preview
  /** Most common values of the material's map (what "whole texture" starts from when the map goes) */
  let mapAverage: PbrValues | null = null;
  let raf = 0;
  let renderToken = 0;
  function schedule() {
    dirty = true;
    if (!visible || raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      void render();
    });
  }

  function decode(m: PbrMapImage | undefined, wrap: boolean): Promise<ImageData | null> {
    if (!m) return Promise.resolve(null);
    let p = decoded.get(m);
    if (!p) {
      p = decodeMap(m, wrap).catch((err) => {
        console.error(err);
        return null;
      });
      decoded.set(m, p);
    }
    return p;
  }

  async function render() {
    dirty = false;
    const p = path();
    if (!p || !colour || !PBR_CATEGORIES.has(categoryOf(p))) return;
    const my = ++renderToken;
    const m = effective();
    const wrap = wrapsFor(categoryOf(p));
    const cur = colour;
    const needs = (m?.map && !decoded.has(m.map)) || (m?.normal && !m.bumps && !decoded.has(m.normal));
    if (needs) busy.hidden = false;
    const [map, normalImg] = await Promise.all([decode(m?.map, wrap), m?.bumps ? Promise.resolve(null) : decode(m?.normal, wrap)]);
    if (my !== renderToken || destroyed) return;
    busy.hidden = true;
    mapAverage = map ? commonValues(map) : null;
    const mers = bakeMers(cur, m ?? { base: PLAIN, spots: [] }, map);
    let normal: ImageData | null = null;
    if (m?.bumps) normal = bumpMap(cur, m.bumps, wrap);
    else if (normalImg) normal = normalImg;
    const shown = tinted(cur, p);
    preview.set({ colour: shown, mers, normal: normal && (normal.width !== cur.width || normal.height !== cur.height) ? null : normal, shape: categoryOf(p) === 'block' ? 'cube' : 'flat' });
    paintThumbs(shown, mers, normal);
    paintFiles(p, m, mers, normal);
    if (editing >= 0 && m?.spots[editing]) paintMask(m.spots[editing]);
    // the slider of a map's whole texture shows its most common values
    if (editing < 0 && m?.map) valueSliders.forEach((s, k) => s.setValue(valueOf(mapAverage ?? m.base, k)));
  }

  function paintThumbs(c: ImageData, mers: ImageData, normal: ImageData | null) {
    const channel = (pick: (d: Uint8ClampedArray, i: number) => number) => {
      const out = createImageData(c.width, c.height);
      for (let i = 0; i < out.data.length; i += 4) {
        const v = pick(mers.data, i);
        out.data[i] = out.data[i + 1] = out.data[i + 2] = v;
        out.data[i + 3] = c.data[i + 3] ? 255 : 0;
      }
      return out;
    };
    const bumps = createImageData(c.width, c.height);
    for (let i = 0; i < bumps.data.length; i += 4) {
      bumps.data[i] = normal ? normal.data[i] : 128;
      bumps.data[i + 1] = normal ? normal.data[i + 1] : 128;
      bumps.data[i + 2] = 255;
      bumps.data[i + 3] = c.data[i + 3] ? 255 : 0;
    }
    const imgs: Record<MapView, ImageData> = {
      look: c,
      shine: channel((d, i) => 255 - d[i + 2]),
      metal: channel((d, i) => d[i]),
      glow: channel((d, i) => d[i + 1]),
      through: channel((d, i) => (d[i] >= 128 ? 0 : d[i + 3])),
      bumps,
    };
    for (const v of VIEWS) drawInto(mapButtons.get(v)!.canvas, firstSquareOf(imgs[v]));
  }

  function paintFiles(p: string, m: PbrMaterial | null, mers: ImageData, normal: ImageData | null) {
    const mine = own();
    if (!mine) {
      filesLine.hidden = true;
      return;
    }
    let names: string[];
    if (mine.original && Object.keys(mine.original).length) names = Object.keys(mine.original).map(fileName);
    else if (edition === 'java') {
      const lab = labPaths(p);
      names = [...(normal ? [fileName(lab.normal)] : []), ...(isPlainMers(mers) ? [] : [fileName(lab.specular)])];
    } else {
      const taken = (stem: string) => ['tga', 'png'].some((e) => store.assets.hasFile(`${stem}.${e}`) || `${stem}.${e}` in project.overrides);
      const layers = layerNames(p, taken);
      const uniform = !m?.map && !m?.spots.length;
      let sub = false;
      for (let i = 3; i < mers.data.length; i += 4) if (mers.data[i] > 0 && mers.data[i - 3] < 128) sub = true;
      names = [fileName(textureSetPath(p))];
      if (sub) names.push(`${layers.mers}.tga`);
      else if (!uniform && !isPlainMers(mers)) names.push(`${layers.mer}.png`);
      if (normal) names.push(`${layers.normal}.png`);
    }
    filesLine.hidden = !names.length;
    filesLine.textContent = names.length ? fmt(edition === 'java' ? tm.files.java : tm.files.bedrock, { files: joinList(names) }) : '';
  }

  /** Grass, leaves and water are grey in the pack: the game colours them (so does the preview) */
  function tinted(img: ImageData, p: string): ImageData {
    const id = store.byPath.get(p)?.id ?? p;
    const t = tintFor(id, edition);
    if (!t) return img;
    const c = tintRgb(t);
    const out = edition === 'bedrock' && /grass_side\.tga$/.test(p) ? tintByAlphaMask(img, c) : tintImage(img, c);
    return createImageData(out.width, out.height, new Uint8ClampedArray(out.data));
  }

  // ---------------------------------------------------------------- the open texture
  function loadGame(p: string) {
    game = null;
    if (edition !== 'bedrock' || !store.assets.hasFile(textureSetPath(p))) return;
    const my = ++gameToken;
    game = undefined;
    void gameMaterial(store.assets, p)
      .catch(() => null)
      .then((g) => {
        if (my !== gameToken || destroyed) return;
        game = g;
        paint();
        schedule();
      });
  }

  offs.push(
    store.events.on('image', ({ path: p, full }) => {
      if (p !== path()) return;
      colour = full;
      schedule();
    }),
    store.events.on('pbr', ({ paths }) => {
      if (writing || !path() || !paths.includes(path()!)) return;
      paint();
      schedule();
    }),
  );

  paint();

  return {
    el,
    setTexture(t) {
      const before = path();
      tex = t;
      colour = t ? t.full : null;
      const p = path();
      if (p !== before) {
        editing = -1;
        whereKey = '';
        if (p) loadGame(p);
      }
      paint();
      schedule();
    },
    setVisible(v) {
      visible = v;
      if (v && dirty) schedule();
    },
    destroy() {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      offs.forEach((f) => f());
      preview.destroy();
    },
  };
}

/** The most common metal / glow / roughness / subsurface of a map. */
function commonValues(map: ImageData): PbrValues {
  const counts = new Map<number, number>();
  const d = map.data;
  let best = 0;
  let bestN = 0;
  for (let i = 0; i < d.length; i += 4) {
    const k = ((d[i] << 24) | (d[i + 1] << 16) | (d[i + 2] << 8) | d[i + 3]) >>> 0;
    const n = (counts.get(k) ?? 0) + 1;
    counts.set(k, n);
    if (n > bestN) [best, bestN] = [k, n];
  }
  return [(best >>> 24) & 255, (best >>> 16) & 255, (best >>> 8) & 255, best & 255];
}

function firstSquareOf(img: ImageData): ImageData {
  if (img.height <= img.width) return img;
  const out = createImageData(img.width, img.width);
  out.data.set(img.data.subarray(0, img.width * img.width * 4));
  return out;
}

function drawInto(canvas: HTMLCanvasElement, img: ImageData) {
  if (canvas.width !== img.width || canvas.height !== img.height) {
    canvas.width = img.width;
    canvas.height = img.height;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
}
