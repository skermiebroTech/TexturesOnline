// Pose maker: a dialog with its own 3D view of the skin. Pick a preset pose or move each part with
// sliders, choose a camera angle, zoom, a background and a cape or elytra, then save a PNG at 1×, 2×
// or 4× (transparent if you like). Loaded only when the dialog opens.

import './pose-studio.css';
import { decodeImage } from '../../../core/image';
import { sanitizeFilename, saveBlob } from '../../../core/download';
import type { SkinModel } from '../../../core/types';
import { href as routeHref } from '../../../core/router';
import { button, segmented, slider } from '../../../ui/components';
import { h, prefersReducedMotion } from '../../../ui/dom';
import { icon } from '../../../ui/icons';
import { openModal } from '../../../ui/modal';
import { toast } from '../../../ui/toast';
import { fmt, fmtNodes } from '../../../i18n/editor-text';
import { createSkinPreview, type BackEquipment, type SkinOrbit, type SkinPreview } from '../skin-preview';
import {
  CAPE_RANGE,
  JOINT_AXES,
  NEUTRAL_POSE,
  POSE_PRESETS,
  TILT_RANGE,
  WINGS_RANGE,
  clonePose,
  limbDirection,
  mirrorLimb,
  mirrorPose,
  parsePose,
  poseTransforms,
  presetOf,
  presetPose,
  serializePose,
  type Pose,
  type PoseJoint,
  type PosePresetId,
} from '../pose';
import { readSavedCape } from '../cape/store';
import { poseText as t } from '../i18n/pose';
import { partText } from '../i18n/parts';

type Tab = 'poses' | 'adjust' | 'scene';
type Background = 'studio' | 'sky' | 'night' | 'paper' | 'transparent';
type ViewId = keyof typeof t.views;
type Wear = 'none' | BackEquipment;
type PartChoice = PoseJoint | 'whole';

/** The longer side of a picture at 1× (2× and 4× multiply it). */
export const PICTURE_BASE = 640;
const SCALES = [1, 2, 4] as const;
type Scale = (typeof SCALES)[number];

export const CAMERA_VIEWS: Record<ViewId, SkinOrbit> = {
  front: { yaw: 0, pitch: 4, zoom: 0.8, focusY: 0 },
  angle: { yaw: 32, pitch: 10, zoom: 0.8, focusY: 0 },
  side: { yaw: 90, pitch: 4, zoom: 0.8, focusY: 0 },
  back: { yaw: 180, pitch: 8, zoom: 0.8, focusY: 0 },
  low: { yaw: 28, pitch: -22, zoom: 0.85, focusY: 0 },
  high: { yaw: 28, pitch: 46, zoom: 0.8, focusY: 0 },
  face: { yaw: 22, pitch: 6, zoom: 2.2, focusY: 12 },
};
const VIEW_IDS = Object.keys(CAMERA_VIEWS) as ViewId[];
/** Presets that read better from another side: flying is seen from behind, where the wings are. */
const PRESET_ORBIT: Partial<Record<PosePresetId, SkinOrbit>> = {
  flying: { yaw: 125, pitch: 22, zoom: 0.55, focusY: 0 },
};
const BACKGROUNDS: { id: Background; swatch: string }[] = [
  { id: 'studio', swatch: '' },
  { id: 'sky', swatch: 'linear-gradient(#6fb2ff, #b9dcff)' },
  { id: 'night', swatch: '#11141c' },
  { id: 'paper', swatch: '#eef1f6' },
  { id: 'transparent', swatch: '' },
];

interface Prefs {
  pose: string;
  view: ViewId;
  background: Background;
  wear: Wear;
  scale: Scale;
  tab: Tab;
}

const PREFS_KEY = 'to-skin-pose';
const DEFAULT_PREFS: Prefs = { pose: serializePose(NEUTRAL_POSE), view: 'angle', background: 'studio', wear: 'cape', scale: 2, tab: 'poses' };

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    const p = { ...DEFAULT_PREFS, ...(raw ? (JSON.parse(raw) as Partial<Prefs>) : {}) };
    if (!parsePose(p.pose)) p.pose = DEFAULT_PREFS.pose;
    if (!VIEW_IDS.includes(p.view)) p.view = DEFAULT_PREFS.view;
    if (!BACKGROUNDS.some((b) => b.id === p.background)) p.background = DEFAULT_PREFS.background;
    if (!['none', 'cape', 'elytra'].includes(p.wear)) p.wear = DEFAULT_PREFS.wear;
    if (!SCALES.includes(p.scale)) p.scale = DEFAULT_PREFS.scale;
    if (!['poses', 'adjust', 'scene'].includes(p.tab)) p.tab = DEFAULT_PREFS.tab;
    return p;
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function savePrefs(p: Prefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* private mode */
  }
}

/** Picture size for a stage shape: the longer side is PICTURE_BASE × scale, capped at `max`. */
export function pictureSize(aspect: number, scale: number, max = 4096): { width: number; height: number; reduced: boolean } {
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  let long = PICTURE_BASE * scale;
  const reduced = long > max;
  long = Math.min(long, max);
  return a >= 1 ? { width: long, height: Math.max(1, Math.round(long / a)), reduced } : { width: Math.max(1, Math.round(long * a)), height: long, reduced };
}

/** A small stick figure of a pose (front, slightly from the side) for the preset buttons. */
function drawPoseIcon(c: HTMLCanvasElement, pose: Pose): void {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const W = 44;
  const H = 52;
  c.width = W * dpr;
  c.height = H * dpr;
  const ctx = c.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  const tr = poseTransforms(pose);
  // Oblique projection of skin space (y up, z towards the viewer); the whole-body tilt about the middle.
  const tilt = (pose.tilt * Math.PI) / 180;
  const proj = (v: readonly number[]): [number, number] => {
    const y = v[1] + 8;
    const z = v[2];
    const ty = y * Math.cos(tilt) - z * Math.sin(tilt);
    const tz = y * Math.sin(tilt) + z * Math.cos(tilt);
    return [W / 2 + (v[0] + tz * 0.35) * 1.2, H / 2 - 2 - (ty - tz * 0.2) * 1.2];
  };
  const add = (a: readonly number[], d: readonly number[], k: number) => a.map((v, i) => v + d[i] * k);
  const style = getComputedStyle(c);
  ctx.strokeStyle = style.color || '#888';
  ctx.fillStyle = style.color || '#888';
  ctx.lineCap = 'round';
  ctx.lineWidth = 3.2;
  const line = (a: readonly number[], b: readonly number[]) => {
    const [x1, y1] = proj(a);
    const [x2, y2] = proj(b);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  const body = tr.parts.body;
  const neck = tr.parts.head.position;
  const hips = add(body.position, [neck[0] - body.position[0], neck[1] - body.position[1], neck[2] - body.position[2]], -1);
  line(neck, hips);
  for (const j of ['rightArm', 'leftArm'] as const) {
    const at = tr.parts[j].position;
    line(neck.map((v, i) => (i === 0 ? v : v + (at[i] - neck[i]) * 0.9)), add(at, limbDirection(tr, j), 10));
  }
  for (const j of ['rightLeg', 'leftLeg'] as const) {
    const at = tr.parts[j].position;
    line(at, add(at, limbDirection(tr, j), 11));
  }
  // Head: a dot a little above the neck, along the body's up direction.
  const up = [neck[0] - hips[0], neck[1] - hips[1], neck[2] - hips[2]].map((v) => v / 12);
  const [hx, hy] = proj(add(neck, up, 4.5));
  ctx.beginPath();
  ctx.arc(hx, hy, 5, 0, Math.PI * 2);
  ctx.fill();
}

export interface PoseStudioOptions {
  image: ImageData;
  model: SkinModel;
  name: string;
}

export function openPoseStudio(opts: PoseStudioOptions): { close(): void } {
  const prefs = loadPrefs();
  const set = <K extends keyof Prefs>(k: K, v: Prefs[K]) => {
    prefs[k] = v;
    savePrefs(prefs);
  };
  let pose = parsePose(prefs.pose) ?? clonePose(NEUTRAL_POSE);
  let preview: SkinPreview | null = null;
  let cape: ImageData | null = null;
  let part: PartChoice = 'rightArm';
  const cleanups: (() => void)[] = [];

  // ---- stage
  const host = h('div', { class: 'sk-pose-view' });
  const stage = h('div', { class: 'sk-pose-stage', dataset: { bg: prefs.background } }, host);

  // ---- poses tab
  const presetButtons = new Map<PosePresetId, HTMLButtonElement>();
  const presetGrid = h('div', { class: 'sk-pose-presets', role: 'group', 'aria-label': t.presetsLabel });
  for (const p of POSE_PRESETS) {
    const pic = h('canvas', { class: 'sk-pose-icon', 'aria-hidden': 'true' });
    const b = h('button', { type: 'button', class: 'sk-pose-preset', dataset: { pose: p.id }, 'aria-pressed': 'false' }, pic, h('span', null, t.presets[p.id]));
    b.addEventListener('click', () => {
      applyPose(presetPose(p.id));
      const orbit = PRESET_ORBIT[p.id];
      if (orbit) {
        preview?.setOrbit(orbit);
        viewButtons.forEach((x) => x.setAttribute('aria-pressed', 'false'));
      }
    });
    presetButtons.set(p.id, b);
    presetGrid.appendChild(b);
    requestAnimationFrame(() => drawPoseIcon(pic, p.pose));
  }
  const poseName = h('p', { class: 'sk-pose-name', 'aria-live': 'polite' });
  const mirrorBtn = button({ label: t.mirror, icon: 'flip-h', size: 'sm', variant: 'secondary', title: t.mirrorTip, onClick: () => applyPose(mirrorPose(pose)) });
  const resetBtn = button({ label: t.resetAll, icon: 'reset', size: 'sm', variant: 'ghost', onClick: () => applyPose(presetPose('standing')) });
  const posesPane = h('div', { class: 'sk-pose-pane', dataset: { tab: 'poses' } }, presetGrid, h('div', { class: 'sk-pose-row' }, poseName, h('span', { class: 'grow' }), mirrorBtn, resetBtn));

  // ---- adjust tab
  const partNames: Record<PartChoice, () => string> = {
    head: () => partText.head.name,
    body: () => partText.body.name,
    rightArm: () => partText.rightArm.name,
    leftArm: () => partText.leftArm.name,
    rightLeg: () => partText.rightLeg.name,
    leftLeg: () => partText.leftLeg.name,
    whole: () => t.whole,
  };
  const partChoices: PartChoice[] = ['head', 'body', 'rightArm', 'leftArm', 'rightLeg', 'leftLeg', 'whole'];
  const partChips = h('div', { class: 'sk-chips sk-pose-parts', role: 'radiogroup', 'aria-label': t.partLabel });
  const chipFor = new Map<PartChoice, HTMLButtonElement>();
  for (const c of partChoices) {
    const b = h('button', { type: 'button', class: 'sk-chip', role: 'radio', 'aria-checked': 'false', dataset: { part: c } }, partNames[c]());
    b.addEventListener('click', () => choosePart(c));
    b.addEventListener('keydown', (e) => {
      const i = partChoices.indexOf(c);
      const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      const next = partChoices[(i + d + partChoices.length) % partChoices.length];
      choosePart(next);
      chipFor.get(next)?.focus();
    });
    chipFor.set(c, b);
    partChips.appendChild(b);
  }
  const sliders = h('div', { class: 'sk-pose-sliders' });
  const partActions = h('div', { class: 'sk-pose-row' });
  const adjustPane = h('div', { class: 'sk-pose-pane', dataset: { tab: 'adjust' } }, partChips, sliders, partActions, h('p', { class: 'muted small sk-pose-hint' }, t.adjustHint));
  let sliderSetters: (() => void)[] = [];

  function buildSliders(): void {
    sliderSetters = [];
    const rows: HTMLElement[] = [];
    if (part === 'whole') {
      const mk = (label: string, range: { min: number; max: number }, unit: string, get: () => number, put: (v: number) => void) => {
        const s = slider({ label, min: range.min, max: range.max, step: 1, value: get(), unit, onInput: (v) => {
          put(v);
          poseChanged();
        } });
        sliderSetters.push(() => s.setValue(get()));
        rows.push(s);
      };
      mk(t.bodyTilt, TILT_RANGE, '°', () => pose.tilt, (v) => (pose.tilt = v));
      mk(t.wings, WINGS_RANGE, '%', () => pose.wings, (v) => (pose.wings = v));
      mk(t.capeLift, CAPE_RANGE, '°', () => pose.cape, (v) => (pose.cape = v));
    } else {
      const j = part;
      JOINT_AXES[j].forEach((ax, i) => {
        const s = slider({
          label: t.axes[ax.axis],
          min: ax.min,
          max: ax.max,
          step: 1,
          value: pose[j][i],
          unit: '°',
          onInput: (v) => {
            const next = [...pose[j]] as [number, number, number];
            next[i] = v;
            pose[j] = next;
            poseChanged();
          },
        });
        s.dataset.axis = ax.axis;
        sliderSetters.push(() => s.setValue(pose[j][i]));
        rows.push(s);
      });
    }
    sliders.replaceChildren(...rows);
    const actions: HTMLElement[] = [];
    actions.push(
      button({
        label: part === 'whole' ? t.resetWhole : fmt(t.resetPart, { part: partNames[part]() }),
        icon: 'reset',
        size: 'sm',
        variant: 'ghost',
        onClick: () => {
          if (part === 'whole') {
            pose.tilt = NEUTRAL_POSE.tilt;
            pose.wings = NEUTRAL_POSE.wings;
            pose.cape = NEUTRAL_POSE.cape;
          } else pose[part] = [...NEUTRAL_POSE[part]];
          poseChanged(true);
        },
      }),
    );
    const other: Partial<Record<PartChoice, PoseJoint>> = { rightArm: 'leftArm', leftArm: 'rightArm', rightLeg: 'leftLeg', leftLeg: 'rightLeg' };
    const to = other[part];
    if (to) {
      const from = part as PoseJoint;
      actions.push(button({ label: fmt(t.copyTo, { part: partNames[to]() }), icon: 'mirror', size: 'sm', variant: 'secondary', onClick: () => applyPose(mirrorLimb(pose, from)) }));
    }
    partActions.replaceChildren(...actions);
  }

  function choosePart(c: PartChoice): void {
    part = c;
    chipFor.forEach((b, k) => {
      b.setAttribute('aria-checked', String(k === c));
      b.setAttribute('aria-pressed', String(k === c));
      b.tabIndex = k === c ? 0 : -1;
    });
    buildSliders();
  }

  // ---- scene tab
  const viewButtons = new Map<ViewId, HTMLButtonElement>();
  const viewChips = h('div', { class: 'sk-chips sk-pose-views', role: 'group', 'aria-label': t.camera });
  for (const v of VIEW_IDS) {
    const b = h('button', { type: 'button', class: 'sk-chip', 'aria-pressed': String(prefs.view === v), dataset: { view: v } }, t.views[v]);
    b.addEventListener('click', () => {
      set('view', v);
      viewButtons.forEach((x, k) => x.setAttribute('aria-pressed', String(k === v)));
      preview?.setOrbit(CAMERA_VIEWS[v]);
    });
    viewButtons.set(v, b);
    viewChips.appendChild(b);
  }
  let zoomBusy = false;
  const zoomSlider = slider({
    label: t.zoom,
    min: 50,
    max: 300,
    step: 5,
    value: Math.round(CAMERA_VIEWS[prefs.view].zoom * 100),
    unit: '%',
    onInput: (v) => {
      zoomBusy = true;
      preview?.setOrbit({ zoom: v / 100 }, true);
      zoomBusy = false;
    },
  });
  zoomSlider.classList.add('sk-pose-zoom');
  const bgButtons = BACKGROUNDS.map((b) => {
    const name = t.backgrounds[b.id];
    const el = h('button', { type: 'button', class: 'sk-backdrop sk-pose-bg', 'aria-label': fmt(t.backgroundName, { name }), title: name, 'aria-pressed': String(prefs.background === b.id), dataset: { id: b.id }, style: b.swatch ? { '--sw': b.swatch } : {} });
    el.addEventListener('click', () => {
      set('background', b.id);
      stage.dataset.bg = b.id;
      bgButtons.forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.id === b.id)));
      bgName.textContent = name;
    });
    return el;
  });
  const bgName = h('span', { class: 'muted small' }, t.backgrounds[prefs.background]);
  const wearSeg = segmented<Wear>({
    value: prefs.wear,
    size: 'sm',
    label: t.onBack,
    options: [
      { value: 'none', label: t.back.none },
      { value: 'cape', label: t.back.cape },
      { value: 'elytra', label: t.back.elytra },
    ],
    onChange: (v) => {
      set('wear', v);
      applyWear();
    },
  });
  const capeLink = h('a', { href: routeHref('/cape-maker') }, t.capeMaker);
  const noCapeNote = h('p', { class: 'sk-note sk-pose-nocape', hidden: true }, icon('info'), h('span', null, fmtNodes(t.noCape, { link: capeLink })));
  const block = (title: string, ...children: (Node | null)[]) => h('section', { class: 'sk-pose-block' }, h('h3', { class: 'section-title' }, title), ...children);
  const scenePane = h(
    'div',
    { class: 'sk-pose-pane', dataset: { tab: 'scene' } },
    block(t.camera, viewChips, zoomSlider),
    block(t.background, h('div', { class: 'sk-pose-bgs' }, h('div', { class: 'sk-backdrops' }, bgButtons), bgName)),
    block(t.onBack, wearSeg, noCapeNote),
  );

  // ---- tabs and footer
  const panes: Record<Tab, HTMLElement> = { poses: posesPane, adjust: adjustPane, scene: scenePane };
  const tabSeg = segmented<Tab>({
    value: prefs.tab,
    label: t.title,
    options: [
      { value: 'poses', label: t.tabs.poses, icon: 'human-arms-up' },
      { value: 'adjust', label: t.tabs.adjust, icon: 'sliders' },
      { value: 'scene', label: t.tabs.scene, icon: 'camera' },
    ],
    onChange: (v) => showTab(v),
  });
  tabSeg.classList.add('sk-pose-tabs');
  const showTab = (v: Tab) => {
    set('tab', v);
    tabSeg.setValue(v);
    for (const [k, el] of Object.entries(panes)) el.hidden = k !== v;
  };

  const sizeText = h('span', { class: 'muted small sk-pose-dims' });
  const scaleSeg = segmented<string>({
    value: String(prefs.scale),
    size: 'sm',
    label: t.pictureSize,
    options: SCALES.map((s) => ({ value: String(s), label: `${s}×` })),
    onChange: (v) => {
      set('scale', Number(v) as Scale);
      paintSize();
    },
  });
  scaleSeg.classList.add('sk-pose-scale');
  const saveBtn = button({ label: t.save, icon: 'download', variant: 'primary', class: 'sk-pose-save', onClick: () => void savePicture() });
  const foot = h('div', { class: 'sk-pose-foot' }, h('div', { class: 'sk-pose-size' }, scaleSeg, sizeText), saveBtn);
  const panel = h('div', { class: 'sk-pose-panel' }, tabSeg, posesPane, adjustPane, scenePane, foot);
  const body = h('div', { class: 'sk-pose' }, stage, panel);

  const stageAspect = () => (stage.clientWidth && stage.clientHeight ? stage.clientWidth / stage.clientHeight : 1);
  const paintSize = () => {
    const s = pictureSize(stageAspect(), prefs.scale, preview?.maxImageSize() || 4096);
    sizeText.textContent = fmt(t.sizeOption, { scale: String(prefs.scale), width: String(s.width), height: String(s.height) });
  };

  // ---- state
  function syncPoseUi(): void {
    const id = presetOf(pose);
    presetButtons.forEach((b, k) => b.setAttribute('aria-pressed', String(k === id)));
    poseName.textContent = id ? t.presets[id] : t.custom;
    for (const s of sliderSetters) s();
  }
  let poseRaf = 0;
  function poseChanged(rebuild = false): void {
    set('pose', serializePose(pose));
    if (rebuild) for (const s of sliderSetters) s();
    syncPoseUi();
    if (poseRaf) return;
    poseRaf = requestAnimationFrame(() => {
      poseRaf = 0;
      preview?.setPose(poseTransforms(pose));
    });
  }
  function applyPose(p: Pose): void {
    pose = clonePose(p);
    poseChanged(true);
    // Flying: open the elytra when there is a cape to show them.
    if (p.wings > 0 && cape && prefs.wear === 'cape') {
      set('wear', 'elytra');
      wearSeg.setValue('elytra');
      applyWear();
    }
  }
  function applyWear(): void {
    noCapeNote.hidden = !!cape || prefs.wear === 'none';
    if (!preview) return;
    if (cape && prefs.wear !== 'none') preview.setCape(cape, prefs.wear);
    else preview.setCape(null);
  }

  async function savePicture(): Promise<void> {
    if (!preview) return;
    try {
      const s = pictureSize(stageAspect(), prefs.scale, preview.maxImageSize());
      const shot = preview.renderImage(s.width, s.height);
      if (!shot) throw new Error(t.failed);
      const out = document.createElement('canvas');
      out.width = s.width;
      out.height = s.height;
      const ctx = out.getContext('2d');
      if (!ctx) throw new Error(t.failed);
      paintBackground(ctx, prefs.background, s.width, s.height, s.width / Math.max(1, stage.clientWidth));
      ctx.drawImage(shot, 0, 0);
      const blob = await new Promise<Blob>((resolve, reject) => out.toBlob((b) => (b ? resolve(b) : reject(new Error(t.failed))), 'image/png'));
      const file = `${sanitizeFilename(opts.name.trim() || 'skin', 'skin').replace(/\.png$/i, '')}-${t.fileSuffix}.png`;
      saveBlob(blob, file);
      toast(fmt(t.saved, { file }), { tone: 'success' });
      if (s.reduced) toast(fmt(t.reduced, { size: preview.maxImageSize() }), { tone: 'info', duration: 6000 });
    } catch (err) {
      toast(err instanceof Error ? err.message : t.failed, { tone: 'error' });
    }
  }

  /** The chosen background, as the stage shows it (`k`: picture pixels per CSS pixel of the stage). */
  function paintBackground(ctx: CanvasRenderingContext2D, bg: Background, w: number, hgt: number, k: number): void {
    if (bg === 'transparent') return;
    if (bg === 'night' || bg === 'paper') {
      ctx.fillStyle = bg === 'night' ? '#11141c' : '#eef1f6';
      ctx.fillRect(0, 0, w, hgt);
      return;
    }
    if (bg === 'sky') {
      const g = ctx.createLinearGradient(0, 0, 0, hgt);
      g.addColorStop(0, '#6fb2ff');
      g.addColorStop(1, '#b9dcff');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, hgt);
      return;
    }
    // Studio: the editor's stage (grid lines and a soft glow in the tool colour).
    const css = getComputedStyle(stage);
    const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
    ctx.fillStyle = v('--bg-elev', '#12151c');
    ctx.fillRect(0, 0, w, hgt);
    ctx.fillStyle = v('--grid-line', 'rgba(255,255,255,0.04)');
    const step = 16 * k;
    const line = Math.max(1, 2 * k);
    for (let x = 0; x < w; x += step) ctx.fillRect(Math.round(x), 0, Math.round(line), hgt);
    for (let y = 0; y < hgt; y += step) ctx.fillRect(0, Math.round(y), w, Math.round(line));
    const cx = w / 2;
    const cy = hgt * 0.42;
    const r = Math.hypot(Math.max(cx, w - cx), Math.max(cy, hgt - cy));
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, v('--tool-accent-soft', 'rgba(79,179,255,0.14)'));
    g.addColorStop(0.68, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, hgt);
  }

  // ---- dialog
  const modal = openModal({
    title: t.title,
    body,
    width: 1080,
    class: 'sk-pose-modal',
    initialFocus: tabSeg.querySelector<HTMLElement>('[aria-checked="true"]') ?? undefined,
    onClose: () => {
      cancelAnimationFrame(poseRaf);
      for (const c of cleanups.splice(0)) c();
      preview?.destroy();
      preview = null;
    },
  });

  showTab(prefs.tab);
  choosePart(part);
  syncPoseUi();

  // The 3D view starts once the dialog has its size.
  requestAnimationFrame(() => {
    if (!body.isConnected) return;
    preview = createSkinPreview(host, { model: opts.model, skin: opts.image, animation: 'none', background: null });
    host.querySelector('canvas')?.setAttribute('aria-label', t.stage);
    preview.setPose(poseTransforms(pose));
    preview.setOrbit(CAMERA_VIEWS[prefs.view], true);
    zoomSlider.setValue(Math.round(preview.getOrbit().zoom * 100));
    cleanups.push(
      preview.onCameraChange(() => {
        if (zoomBusy || !preview) return;
        zoomSlider.setValue(Math.round(preview.getOrbit().zoom * 100));
      }),
    );
    paintSize();
    applyWear();
    const ro = new ResizeObserver(() => paintSize());
    ro.observe(stage);
    cleanups.push(() => ro.disconnect());
  });

  // The cape from the cape maker, if one was made on this device.
  const saved = readSavedCape();
  if (saved) {
    void decodeImage(saved.png, 'png')
      .then((img) => {
        if (img.width !== 64 || img.height !== 32) return;
        cape = img;
        applyWear();
      })
      .catch(() => undefined);
  }
  applyWear();
  if (prefersReducedMotion()) stage.dataset.motion = 'reduced';

  const api = {
    close: () => modal.close(),
    /** Test hook: the pose and the picture size now */
    state: () => ({ pose: serializePose(pose), preset: presetOf(pose), size: pictureSize(stageAspect(), prefs.scale, preview?.maxImageSize() || 4096), wear: prefs.wear, hasCape: !!cape, background: prefs.background }),
  };
  Object.defineProperty(body, '__poseStudio', { value: api });
  return api;
}
