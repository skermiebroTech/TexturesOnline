// 3D skin preview built on skinview3d: classic/slim, animations, layer toggles, cape, cheap live
// texture updates while painting, part highlighting, screenshots, and painting on the model itself:
// rays from the pointer to skin pixels, pixel outlines drawn on the model, camera views and the
// paint-mode camera controls (right-drag / background drag / two fingers turn, scroll or pinch zooms).

import { FlyingAnimation, IdleAnimation, RunningAnimation, SkinViewer, WalkingAnimation, type PlayerAnimation } from 'skinview3d';
import * as THREE from 'three';
import type { SkinModel } from '../../core/types';
import { createStage, prefersReducedMotion, watchDevicePixelRatio } from '../../shared/preview/viewport';
import { isTypingTarget } from '../../ui/dom';
import { BOX_FACE_ORDER, texelPlace } from './surface';
import { faceRect, PARTS, type LayerSelection, type SkinFace, type SkinLayer, type SkinPart } from './templates';

export type SkinAnimation = 'idle' | 'walk' | 'run' | 'fly' | 'none';
export type SkinPartId = 'head' | 'body' | 'rightArm' | 'leftArm' | 'rightLeg' | 'leftLeg' | 'cape';
export type SkinSource = HTMLCanvasElement | ImageData;
/** Camera directions for setView ('left' looks at the player's left side). */
export type SkinView = 'front' | 'back' | 'left' | 'right' | 'top';

/** Part ids accepted by setHighlight (optionally suffixed with ':inner' / ':outer'). */
export const SKIN_PARTS: readonly { id: SkinPartId; label: string }[] = [
  { id: 'head', label: 'Head' },
  { id: 'body', label: 'Body' },
  { id: 'rightArm', label: 'Right arm' },
  { id: 'leftArm', label: 'Left arm' },
  { id: 'rightLeg', label: 'Right leg' },
  { id: 'leftLeg', label: 'Left leg' },
  { id: 'cape', label: 'Cape' },
];

/** The skin pixel under a point of the 3D view. */
export interface SkinHit {
  x: number;
  y: number;
  /** Fractional image coordinates of the exact point (where a brush centres) */
  fx: number;
  fy: number;
  part: SkinPart;
  face: SkinFace;
  layer: SkinLayer;
  /** Distance from the camera (scene units) */
  distance: number;
}

export type SkinPaintCursor = 'paint' | 'pick' | 'locked';

/** Receives the pointer on the model while the preview is in paint mode. */
export interface SkinPaintHandler {
  /** Layer(s) being painted; decides what a ray can hit. */
  layers(): LayerSelection;
  /** Alpha of an image pixel: painting both layers looks through empty outer-layer pixels. */
  alphaAt(x: number, y: number): number;
  /** A press on the model. Return true to take the drag (a stroke); false lets the drag turn the camera. */
  begin(hit: SkinHit, e: PointerEvent): boolean;
  /** The points the drag walked over since the last call (in-between screen positions are raycast too). */
  extend(hits: SkinHit[]): void;
  /** The drag ended (commit) or was abandoned (a second finger came down, paint mode was left). */
  end(commit: boolean): void;
  /** The pixel under a hovering mouse or pen, or null; returns the cursor to show over it. */
  hover(hit: SkinHit | null): SkinPaintCursor;
  /** Two-finger tap. */
  undo(): void;
}

/** Pixels outlined on the model (a brush footprint, a hovered template pixel...). */
export interface SkinOverlay {
  /** Pixel indices (y * 64 + x) */
  pixels: readonly number[];
  /** Drawn fainter, e.g. the mirror copies */
  echo?: readonly number[];
  /** CSS fill colour, or null for an outline only */
  fill?: string | null;
  tone?: 'normal' | 'locked';
}

export interface SkinPreview {
  setSkin(src: SkinSource): void;
  setModel(m: SkinModel): void;
  setCape(src: SkinSource | null): void;
  setAnimation(a: SkinAnimation): void;
  setLayers(v: { inner: boolean; outer: boolean }): void;
  /** CSS colour, or null for a transparent background */
  setBackground(c: string | null): void;
  /** Dims every other part. Accepts ids like 'head', 'leftArm', 'left_arm', 'head:outer', or null to clear */
  setHighlight(part: string | null): void;
  setAutoRotate(v: boolean): void;
  screenshot(): Promise<Blob>;
  resetCamera(): void;
  /**
   * Paint mode: pointer presses on the model go to `handler`; the camera turns with the right button,
   * a drag on the background, Space or Alt + drag, or two fingers, and zooms with the wheel or a pinch.
   * Animation and auto-rotation pause (still pose). null goes back to viewing.
   */
  setPaintMode(handler: SkinPaintHandler | null): void;
  /** Layer(s) being painted: rays only hit those, and painting the base layer fades the outer one. */
  setPaintLayers(layers: LayerSelection): void;
  /** Outlines pixels on the model; null clears. */
  setOverlay(o: SkinOverlay | null): void;
  /** Turns the camera to face one side of the player (keeps the zoom). */
  setView(v: SkinView): void;
  /**
   * Moves the camera's pivot onto one body part and frames it, so turning (setView, dragging) goes
   * around that part; null goes back to the whole player.
   */
  focusPart(part: SkinPartId | null): void;
  /** The skin pixel at a client (viewport) point, honouring the painted layer(s). */
  hitTest(clientX: number, clientY: number): SkinHit | null;
  /** Client position of a pixel's centre on the model, or null when it faces away or is hidden. */
  pixelToClient(x: number, y: number): [number, number] | null;
  destroy(): void;
}

export interface SkinPreviewOptions {
  model: SkinModel;
  skin?: SkinSource;
  cape?: SkinSource | null;
  animation?: SkinAnimation;
  background?: string | null;
  autoRotate?: boolean;
}

interface Highlight {
  part: SkinPartId;
  layer: 'inner' | 'outer' | 'both';
}

/** Normalises free-form part names ("Left Arm", "left_arm", "arm-left:overlay", "hat", ...). */
export function parseSkinPart(name: string | null | undefined): Highlight | null {
  if (!name) return null;
  const s = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const outer = /outer|overlay|layer2|second|hat|jacket|sleeve|pants|helm/.test(s);
  const inner = /inner|base|layer1|first/.test(s);
  const layer: Highlight['layer'] = outer ? 'outer' : inner ? 'inner' : 'both';
  const side = s.includes('left') ? 'left' : s.includes('right') ? 'right' : null;
  let part: SkinPartId | null = null;
  if (s.includes('cape')) part = 'cape';
  else if (s.includes('head') || s.includes('hat') || s.includes('helm')) part = 'head';
  else if (s.includes('arm') || s.includes('sleeve')) part = side === 'left' ? 'leftArm' : 'rightArm';
  else if (s.includes('leg') || s.includes('pants')) part = side === 'left' ? 'leftLeg' : 'rightLeg';
  else if (s.includes('body') || s.includes('torso') || s.includes('jacket') || s.includes('chest')) part = 'body';
  if (!part) return null;
  if ((part.endsWith('Arm') || part.endsWith('Leg')) && !side) return null;
  return { part, layer };
}

const ANIMATIONS: Record<Exclude<SkinAnimation, 'none'>, () => PlayerAnimation> = {
  idle: () => new IdleAnimation(),
  walk: () => new WalkingAnimation(),
  run: () => new RunningAnimation(),
  fly: () => new FlyingAnimation(),
};

const DEFAULT_ANGLE = 0.55;
const DEFAULT_ZOOM = 0.86;
const MAX_PIXEL_RATIO = 2;
/** Overlay texture pixels per skin pixel (the outline's halo and line are two overlay pixels each). */
const OVERLAY_SCALE = 16;
/** Opacity of the outer layer while the base layer is painted. */
const GHOST_OPACITY = 0.22;
/** Where zooming may move the camera's pivot (world units; the player spans about ±8 x 32 x ±4). */
const PIVOT_MIN = new THREE.Vector3(-10, -16, -6);
const PIVOT_MAX = new THREE.Vector3(10, 16, 6);
const VIEW_DIRS: Record<SkinView, [number, number, number]> = {
  front: [0, 0, 1],
  back: [0, 0, -1],
  left: [1, 0, 0],
  right: [-1, 0, 0],
  top: [0, 1, 0.05],
};
const VIEW_LABEL = '3D skin preview. Drag to rotate, scroll to zoom, arrow keys turn the player.';
const PAINT_LABEL = '3D skin preview, paint mode. Drag on the model to paint; right-drag or drag the background to turn; scroll to zoom.';

const pixelRatio = (): number => Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);

let colorProbe: CanvasRenderingContext2D | null | undefined;

/**
 * Resolves any CSS colour (hex, rgb(), hsl(), oklch(), named, var(--token), ...) to sRGB bytes + alpha,
 * relative to `host` so custom properties resolve. Returns null for invalid or fully transparent colours.
 */
export function resolveCssColor(value: string, host: Element): [number, number, number, number] | null {
  let css = value.trim();
  if (!css || css === 'transparent' || css === 'none') return null;
  if (typeof document === 'undefined') return null;
  const probe = document.createElement('span');
  probe.style.backgroundColor = css;
  if (!probe.style.backgroundColor) return null;
  if (host.isConnected && typeof getComputedStyle === 'function') {
    probe.style.cssText += ';position:absolute;width:0;height:0;visibility:hidden;pointer-events:none';
    host.appendChild(probe);
    css = getComputedStyle(probe).backgroundColor || css;
    probe.remove();
  }
  if (colorProbe === undefined) {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    colorProbe = c.getContext('2d', { willReadFrequently: true });
  }
  const ctx = colorProbe;
  if (!ctx) return null;
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = '#000';
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  if (d[3] < 13) return null;
  return [d[0], d[1], d[2], d[3]];
}

type Drag =
  | { kind: 'paint'; id: number; x: number; y: number; distance: number }
  | { kind: 'orbit'; id: number; x: number; y: number }
  | { kind: 'pinch'; ids: [number, number]; mx: number; my: number; d: number; mx0: number; my0: number; d0: number; t0: number; travel: number }
  | { kind: 'ignore'; id: number };

interface OverlayLayer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  material: THREE.MeshBasicMaterial;
  meshes: THREE.Mesh[];
}

const isOverlayMesh = (o: THREE.Object3D): boolean => o.userData.skinOverlay === true;

class SkinPreviewImpl implements SkinPreview {
  private readonly stage: ReturnType<typeof createStage>;
  private readonly viewer: SkinViewer;
  private model: SkinModel;
  private pendingSkin: SkinSource | null = null;
  private raf = 0;
  private renderRaf = 0;
  private scratch: HTMLCanvasElement | null = null;
  private capeScratch: HTMLCanvasElement | null = null;
  private hasSkin = false;
  private highlight: Highlight | null = null;
  private dimmed = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  private ghosts = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  private originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  private ro: ResizeObserver | null = null;
  private io: IntersectionObserver | null = null;
  private readonly unwatchDpr: () => void;
  private onScreen = true;
  private dirty = false;
  private destroyed = false;

  // What the caller asked for; paint mode overrides these while it is on.
  private wantAnimation: SkinAnimation = 'idle';
  private wantAutoRotate = false;
  private wantLayers = { inner: true, outer: true };

  // Painting
  private paint: SkinPaintHandler | null = null;
  private paintLayers: LayerSelection = 'both';
  private ghostOuter = false;
  private readonly meshInfo = new Map<THREE.Object3D, { part: SkinPart; layer: SkinLayer }>();
  private readonly raycaster = new THREE.Raycaster();
  private drag: Drag | null = null;
  private readonly touches = new Map<number, { x: number; y: number }>();
  private pointer: { x: number; y: number; inside: boolean } | null = null;
  private readonly held = { space: false, alt: false };
  private overlay: OverlayLayer | null = null;
  private overlayKey = '';
  private tweenRaf = 0;
  /** Camera distance of the default framing (whole player) */
  private homeDistance = 0;

  constructor(stage: ReturnType<typeof createStage>, opts: SkinPreviewOptions) {
    this.stage = stage;
    this.model = opts.model;
    // skinview3d switches three.js colour management off globally; restore it for the rest of the app
    // (this preview's own colours do not depend on it, see setBackground).
    const colorManagement = THREE.ColorManagement.enabled;
    try {
      this.viewer = new SkinViewer({
        canvas: this.stage.canvas,
        width: Math.max(1, this.stage.root.clientWidth),
        height: Math.max(1, this.stage.root.clientHeight),
        pixelRatio: pixelRatio(),
        fov: 38,
        zoom: DEFAULT_ZOOM,
        enableControls: true,
        // start paused: updatePaused() below decides whether the render loop needs to run
        renderPaused: true,
      });
    } finally {
      THREE.ColorManagement.enabled = colorManagement;
    }
    const skin = this.viewer.playerObject.skin;
    for (const part of PARTS) {
      this.meshInfo.set(skin[part].innerLayer, { part, layer: 'base' });
      this.meshInfo.set(skin[part].outerLayer, { part, layer: 'outer' });
    }
    this.viewer.controls.enablePan = false;
    this.viewer.controls.addEventListener('change', this.requestRender);
    this.viewer.autoRotateSpeed = 0.7;
    this.setAutoRotate(opts.autoRotate ?? false);
    this.stage.canvas.style.width = '100%';
    this.stage.canvas.style.height = '100%';
    this.stage.root.dataset.mode = 'view';
    this.setCameraAngle();
    this.setAnimation(opts.animation ?? 'idle');
    this.setBackground(opts.background ?? null);
    if (opts.skin) this.applySkin(opts.skin);
    if (opts.cape) this.setCape(opts.cape);

    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(this.stage.root);
    }
    if (typeof IntersectionObserver !== 'undefined') {
      this.io = new IntersectionObserver((entries) => {
        const e = entries[entries.length - 1];
        this.onScreen = e ? e.isIntersecting : true;
        this.updatePaused();
      });
      this.io.observe(this.stage.root);
    }
    this.unwatchDpr = watchDevicePixelRatio(() => this.resize(true));
    document.addEventListener('visibilitychange', this.updatePaused);
    const c = this.stage.canvas;
    c.addEventListener('keydown', this.onKey);
    c.addEventListener('dblclick', this.onDbl);
    c.addEventListener('pointerdown', this.onPaintDown);
    c.addEventListener('pointermove', this.onPaintMove);
    c.addEventListener('pointerup', this.onPaintUp);
    c.addEventListener('pointercancel', this.onPaintUp);
    c.addEventListener('lostpointercapture', this.onLostCapture);
    c.addEventListener('pointerenter', this.onPointerEnter);
    c.addEventListener('pointerleave', this.onPointerLeave);
    c.addEventListener('wheel', this.onWheel, { passive: false });
    c.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('keydown', this.onHeldKey);
    window.addEventListener('keyup', this.onHeldKey);
    window.addEventListener('blur', this.onWindowBlur);
    this.updatePaused();
  }

  private get visible(): boolean {
    return this.onScreen && document.visibilityState !== 'hidden';
  }

  /**
   * The render loop only runs while something moves (an animation or auto-rotation) and the preview is
   * visible; a static pose is re-rendered on demand (edits, camera drags) instead of 60 times a second.
   */
  private updatePaused = (): void => {
    if (this.destroyed) return;
    const run = this.visible && (this.viewer.animation !== null || this.viewer.autoRotate);
    if (this.viewer.renderPaused === run) this.viewer.renderPaused = !run;
    if (!run && this.visible && this.dirty) this.renderNow();
  };

  private renderNow(): void {
    this.dirty = false;
    this.viewer.render();
  }

  /**
   * Redraws once when the loop is paused (running loops pick changes up on their next frame). While
   * painting, redraws are batched to one per frame: a single pointer move can change the texture,
   * the outline and the camera.
   */
  private requestRender = (): void => {
    if (this.destroyed || !this.viewer.renderPaused) return;
    this.dirty = true;
    if (!this.visible) return;
    if (!this.paint) {
      this.renderNow();
      return;
    }
    if (this.renderRaf) return;
    this.renderRaf = requestAnimationFrame(() => {
      this.renderRaf = 0;
      if (this.dirty && !this.destroyed && this.visible && this.viewer.renderPaused) this.renderNow();
    });
  };

  private resize(force = false): void {
    if (this.destroyed) return;
    const w = Math.max(1, this.stage.root.clientWidth);
    const h = Math.max(1, this.stage.root.clientHeight);
    const pr = pixelRatio();
    const prChanged = this.viewer.pixelRatio !== pr;
    if (!force && !prChanged && w === this.viewer.width && h === this.viewer.height) return;
    if (prChanged) this.viewer.pixelRatio = pr;
    this.viewer.setSize(w, h);
    this.stage.canvas.style.width = '100%';
    this.stage.canvas.style.height = '100%';
    this.requestRender();
  }

  private setCameraAngle(): void {
    const cam = this.viewer.camera;
    cam.position.set(Math.sin(DEFAULT_ANGLE), 0.18, Math.cos(DEFAULT_ANGLE));
    cam.rotation.set(0, 0, 0);
    this.viewer.controls.target.set(0, 0, 0);
    this.viewer.adjustCameraDistance();
    cam.lookAt(0, 0, 0);
    this.viewer.controls.update();
    this.homeDistance = cam.position.distanceTo(this.viewer.controls.target);
  }

  private onKey = (e: KeyboardEvent): void => {
    const w = this.viewer.playerWrapper;
    let handled = true;
    switch (e.key) {
      case 'ArrowLeft': w.rotation.y -= 0.2; break;
      case 'ArrowRight': w.rotation.y += 0.2; break;
      case '+': case '=': this.dolly(1 / 1.15); break;
      case '-': case '_': this.dolly(1.15); break;
      case 'Home': case '0': this.resetCamera(); break;
      default: handled = false;
    }
    if (handled) {
      e.preventDefault();
      this.requestRender();
    }
  };

  private onDbl = (): void => {
    if (!this.paint) this.resetCamera();
  };

  /** A canvas holding the source pixels (ImageData goes through a reusable scratch canvas, display only). */
  private toCanvas(src: SkinSource, which: 'skin' | 'cape'): HTMLCanvasElement | null {
    if (typeof HTMLCanvasElement !== 'undefined' && src instanceof HTMLCanvasElement) return src;
    const img = src as { width: number; height: number; data: Uint8ClampedArray };
    if (!img || !img.width || !img.height || !img.data) return null;
    let c = which === 'skin' ? this.scratch : this.capeScratch;
    if (!c) {
      c = document.createElement('canvas');
      if (which === 'skin') this.scratch = c;
      else this.capeScratch = c;
    }
    if (c.width !== img.width || c.height !== img.height) {
      c.width = img.width;
      c.height = img.height;
    }
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    const data = img instanceof ImageData ? img : new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
    ctx.putImageData(data, 0, 0);
    return c;
  }

  private applySkin(src: SkinSource): void {
    const canvas = this.toCanvas(src, 'skin');
    if (!canvas) return;
    const { width: w, height: h } = canvas;
    if (!(w === h || w === h * 2) || w < 8) {
      console.warn(`Skin preview: unsupported skin size ${w}x${h}`);
      return;
    }
    const skinCanvas = this.viewer.skinCanvas;
    const map = this.viewer.playerObject.skin.map;
    if (this.hasSkin && map && w === h && skinCanvas.width === w && skinCanvas.height === h) {
      // Fast path: repaint the existing texture's canvas and re-upload, no new GPU texture. Same result
      // as loadSkin for square skins (which, like the game, keeps opaque overlay pixels opaque).
      const ctx = skinCanvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(canvas, 0, 0);
        map.needsUpdate = true;
        this.requestRender();
        return;
      }
    }
    try {
      this.viewer.loadSkin(canvas, { model: this.model === 'slim' ? 'slim' : 'default', ears: false });
      this.hasSkin = true;
      this.syncDimmedMaps();
      this.requestRender();
    } catch (err) {
      console.warn('Skin preview: could not load skin', err);
    }
  }

  setSkin(src: SkinSource): void {
    if (this.destroyed) return;
    this.pendingSkin = src;
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      const next = this.pendingSkin;
      this.pendingSkin = null;
      if (next && !this.destroyed) this.applySkin(next);
    });
  }

  setModel(m: SkinModel): void {
    if (this.destroyed) return;
    this.model = m;
    this.viewer.playerObject.skin.modelType = m === 'slim' ? 'slim' : 'default';
    this.requestRender();
  }

  setCape(src: SkinSource | null): void {
    if (this.destroyed) return;
    if (!src) {
      this.viewer.loadCape(null);
      this.applyHighlight();
      this.requestRender();
      return;
    }
    const canvas = this.toCanvas(src, 'cape');
    if (!canvas) return;
    try {
      this.viewer.loadCape(canvas, { backEquipment: 'cape' });
      this.syncDimmedMaps();
    } catch (err) {
      console.warn('Skin preview: unsupported cape image', err);
    }
    this.requestRender();
  }

  setAnimation(a: SkinAnimation): void {
    if (this.destroyed) return;
    this.wantAnimation = a;
    this.applyAnimation();
    this.updatePaused();
    this.requestRender();
  }

  /** Paint mode holds a still pose; otherwise the requested animation plays. */
  private applyAnimation(): void {
    const a = this.paint ? 'none' : this.wantAnimation;
    const make = a === 'none' ? null : ANIMATIONS[a];
    if (!make && this.viewer.animation === null) return;
    this.viewer.animation = make ? make() : null;
  }

  setLayers(v: { inner: boolean; outer: boolean }): void {
    if (this.destroyed) return;
    this.wantLayers = { inner: v.inner, outer: v.outer };
    this.applyVisibility();
  }

  /** Layer visibility: as requested, except that paint mode shows both (fading the outer one when painting the base). */
  private applyVisibility(): void {
    const skin = this.viewer.playerObject.skin;
    const painting = !!this.paint;
    skin.setInnerLayerVisible(painting || this.wantLayers.inner);
    skin.setOuterLayerVisible(painting || this.wantLayers.outer);
    const ghost = painting && this.paintLayers === 'base';
    if (ghost !== this.ghostOuter) {
      this.ghostOuter = ghost;
      this.applyHighlight();
    }
    this.requestRender();
  }

  setBackground(c: string | null): void {
    if (this.destroyed) return;
    const rgba = c ? resolveCssColor(c, this.stage.root) : null;
    if (c && !rgba && c !== 'transparent' && c !== 'none') console.warn(`Skin preview: unsupported background colour "${c}"`);
    // The scene renders into a linear render target with no output conversion, so storing the sRGB bytes
    // as "linear" puts exactly this colour on screen, whatever the global colour-management setting.
    this.viewer.background = rgba ? new THREE.Color().setRGB(rgba[0] / 255, rgba[1] / 255, rgba[2] / 255, THREE.LinearSRGBColorSpace) : null;
    this.requestRender();
  }

  setAutoRotate(v: boolean): void {
    if (this.destroyed) return;
    this.wantAutoRotate = v;
    this.viewer.autoRotate = v && !this.paint;
    this.updatePaused();
  }

  // ---- highlight ----

  private partMeshes(part: SkinPartId, layer: Highlight['layer']): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    const collect = (o: THREE.Object3D) => o.traverse((c) => (c as THREE.Mesh).isMesh && !isOverlayMesh(c) && out.push(c as THREE.Mesh));
    const player = this.viewer.playerObject;
    if (part === 'cape') {
      collect(player.cape);
      collect(player.elytra);
      return out;
    }
    const bp = player.skin[part];
    if (layer !== 'outer') collect(bp.innerLayer);
    if (layer !== 'inner') collect(bp.outerLayer);
    return out;
  }

  private allMeshes(): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    this.viewer.playerObject.traverse((c) => (c as THREE.Mesh).isMesh && !isOverlayMesh(c) && out.push(c as THREE.Mesh));
    return out;
  }

  private dimmedFor(m: THREE.Material): THREE.Material {
    const std = m as THREE.MeshStandardMaterial;
    let d = this.dimmed.get(m);
    if (!d) {
      d = std.clone();
      d.color.multiplyScalar(0.3);
      this.dimmed.set(m, d);
    }
    if (d.map !== std.map) {
      // a map appearing or disappearing changes the shader program
      d.map = std.map;
      d.needsUpdate = true;
    }
    return d;
  }

  /** A faded copy of an outer-layer material (painting the base layer looks through it). */
  private ghostFor(m: THREE.Material): THREE.Material {
    const std = m as THREE.MeshStandardMaterial;
    let g = this.ghosts.get(m);
    if (!g) {
      g = std.clone();
      this.ghosts.set(m, g);
    }
    g.transparent = true;
    g.opacity = GHOST_OPACITY;
    g.depthWrite = false;
    if (g.map !== std.map) {
      g.map = std.map;
      g.needsUpdate = true;
    }
    return g;
  }

  private restoreMaterials(): void {
    for (const [mesh, mat] of this.originals) mesh.material = mat;
    this.originals.clear();
  }

  /** Swaps materials for the part highlight (others dimmed) and the faded outer layer, from the originals. */
  private applyHighlight(): void {
    this.restoreMaterials();
    const h = this.highlight;
    const keep = h ? new Set(this.partMeshes(h.part, h.layer)) : null;
    const skin = this.viewer.playerObject.skin;
    const ghost = this.ghostOuter ? new Set<THREE.Object3D>(PARTS.map((p) => skin[p].outerLayer)) : null;
    if (keep || ghost) {
      for (const mesh of this.allMeshes()) {
        const dim = !!keep && !keep.has(mesh);
        const fade = !!ghost && ghost.has(mesh);
        if (!dim && !fade) continue;
        this.originals.set(mesh, mesh.material);
        const swap = (m: THREE.Material): THREE.Material => {
          const base = fade ? this.ghostFor(m) : m;
          return dim ? this.dimmedFor(base) : base;
        };
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
      }
    }
    this.requestRender();
  }

  /** Dimmed and faded clones share the skin texture; keep them pointing at the current one after reloads. */
  private syncDimmedMaps(): void {
    if (!this.highlight && !this.ghostOuter) return;
    this.applyHighlight();
  }

  setHighlight(part: string | null): void {
    if (this.destroyed) return;
    const parsed = parseSkinPart(part);
    if (part && !parsed) console.warn(`Skin preview: unknown part "${part}"`);
    this.highlight = parsed;
    this.applyHighlight();
    this.requestRender();
  }

  // ---- painting: rays to pixels ----

  private isShown(o: THREE.Object3D): boolean {
    for (let n: THREE.Object3D | null = o; n; n = n.parent) if (!n.visible) return false;
    return true;
  }

  private ndcAt(clientX: number, clientY: number): THREE.Vector2 | null {
    const r = this.stage.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const x = ((clientX - r.left) / r.width) * 2 - 1;
    const y = -((clientY - r.top) / r.height) * 2 + 1;
    if (x < -1 || x > 1 || y < -1 || y > 1) return null;
    return new THREE.Vector2(x, y);
  }

  private alphaAt(x: number, y: number): number {
    if (this.paint) return this.paint.alphaAt(x, y);
    const ctx = this.viewer.skinCanvas.getContext('2d', { willReadFrequently: true });
    return ctx ? ctx.getImageData(x, y, 1, 1).data[3] : 255;
  }

  hitTest(clientX: number, clientY: number): SkinHit | null {
    if (this.destroyed || !this.hasSkin) return null;
    const ndc = this.ndcAt(clientX, clientY);
    if (!ndc) return null;
    const layers = this.paintLayers;
    const targets: THREE.Object3D[] = [];
    for (const [mesh, info] of this.meshInfo) {
      if (layers === 'base' && info.layer === 'outer') continue; // faded, and never in the way
      if (this.isShown(mesh)) targets.push(mesh);
    }
    // A cape or elytra in front of the body blocks the ray.
    const player = this.viewer.playerObject;
    for (const o of [player.cape, player.elytra]) {
      if (this.isShown(o)) o.traverse((c) => (c as THREE.Mesh).isMesh && !isOverlayMesh(c) && targets.push(c));
    }
    this.viewer.scene.updateMatrixWorld();
    this.raycaster.setFromCamera(ndc, this.viewer.camera);
    for (const it of this.raycaster.intersectObjects(targets, false)) {
      const info = this.meshInfo.get(it.object);
      if (!info) return null;
      if (layers === 'outer' && info.layer === 'base') return null;
      if (it.faceIndex == null || !it.uv) continue;
      const face = BOX_FACE_ORDER[Math.floor(it.faceIndex / 2)];
      const r = face && faceRect(info.part, face, info.layer, this.model);
      if (!r) continue;
      // Texture v runs up (the texture is flipped on upload); clamp edge hits into this face.
      const fx = Math.min(Math.max(it.uv.x * 64, r.x), r.x + r.w - 1e-3);
      const fy = Math.min(Math.max((1 - it.uv.y) * 64, r.y), r.y + r.h - 1e-3);
      const x = Math.floor(fx);
      const y = Math.floor(fy);
      // Painting both layers: see through empty outer-layer pixels to whatever is behind them.
      if (layers === 'both' && info.layer === 'outer' && this.alphaAt(x, y) === 0) continue;
      return { x, y, fx, fy, part: info.part, face, layer: info.layer, distance: it.distance };
    }
    return null;
  }

  pixelToClient(x: number, y: number): [number, number] | null {
    if (this.destroyed) return null;
    const place = texelPlace(x, y, this.model);
    if (!place) return null;
    const bp = this.viewer.playerObject.skin[place.rect.part];
    const mesh = (place.rect.layer === 'base' ? bp.innerLayer : bp.outerLayer) as THREE.Mesh;
    if (!this.isShown(mesh)) return null;
    const geo = mesh.geometry;
    if (!geo.boundingBox) geo.computeBoundingBox();
    const bb = geo.boundingBox!;
    const { box, center, normal } = place;
    const local = new THREE.Vector3(
      bb.min.x + (center[0] / box.w) * (bb.max.x - bb.min.x),
      bb.min.y + (center[1] / box.h) * (bb.max.y - bb.min.y),
      bb.min.z + (center[2] / box.d) * (bb.max.z - bb.min.z),
    );
    this.viewer.scene.updateMatrixWorld();
    const world = local.applyMatrix4(mesh.matrixWorld);
    const n = new THREE.Vector3(normal[0], normal[1], normal[2]).transformDirection(mesh.matrixWorld);
    const cam = this.viewer.camera;
    if (n.dot(cam.position.clone().sub(world)) <= 0) return null;
    const p = world.clone().project(cam);
    if (p.x < -1 || p.x > 1 || p.y < -1 || p.y > 1 || p.z > 1) return null;
    const r = this.stage.canvas.getBoundingClientRect();
    return [r.left + ((p.x + 1) / 2) * r.width, r.top + ((1 - p.y) / 2) * r.height];
  }

  setPaintLayers(layers: LayerSelection): void {
    if (this.destroyed || layers === this.paintLayers) return;
    this.paintLayers = layers;
    this.applyVisibility();
    this.refreshHover();
  }

  setPaintMode(handler: SkinPaintHandler | null): void {
    if (this.destroyed || handler === this.paint) return;
    this.endDrag(true);
    this.paint?.hover(null);
    this.paint = handler;
    this.touches.clear();
    this.held.space = this.held.alt = false;
    this.viewer.controls.enabled = !handler;
    this.stage.root.dataset.mode = handler ? 'paint' : 'view';
    if (handler) this.stage.root.dataset.cursor = 'grab';
    else {
      delete this.stage.root.dataset.cursor;
      this.setOverlay(null);
    }
    this.stage.canvas.setAttribute('aria-label', handler ? PAINT_LABEL : VIEW_LABEL);
    this.applyAnimation();
    this.viewer.autoRotate = this.wantAutoRotate && !handler;
    this.applyVisibility();
    this.updatePaused();
    this.requestRender();
    if (handler) this.refreshHover();
  }

  // ---- painting: pointer input ----

  private setCursor(c: SkinPaintCursor | 'grab' | 'grabbing'): void {
    if (this.stage.root.dataset.cursor !== c) this.stage.root.dataset.cursor = c;
  }

  private rotating(): boolean {
    return this.held.space || this.held.alt;
  }

  /** Hover feedback for a mouse or pen at a client point. */
  private hoverAt(clientX: number, clientY: number): void {
    const paint = this.paint;
    if (!paint) return;
    const hit = this.rotating() ? null : this.hitTest(clientX, clientY);
    const cursor = paint.hover(hit);
    this.setCursor(this.rotating() || !hit ? 'grab' : cursor);
  }

  private refreshHover(): void {
    if (!this.paint || this.drag) return;
    const p = this.pointer;
    if (p?.inside) this.hoverAt(p.x, p.y);
    else this.setCursor('grab');
  }

  /** CSS pixels per scene unit (about one skin pixel) at a distance from the camera. */
  private pixelsPerTexel(distance: number): number {
    const h = this.stage.canvas.clientHeight || 1;
    const fov = (this.viewer.camera.fov * Math.PI) / 180;
    return h / (2 * Math.tan(fov / 2) * Math.max(1, distance));
  }

  /** Raycasts the screen path from the drag's last position to (x, y) so fast strokes follow the surface. */
  private walk(d: Extract<Drag, { kind: 'paint' }>, x: number, y: number, out: SkinHit[]): void {
    const dx = x - d.x;
    const dy = y - d.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.25) return;
    const step = Math.max(1, this.pixelsPerTexel(d.distance) * 0.4);
    const n = Math.min(128, Math.max(1, Math.ceil(len / step)));
    for (let k = 1; k <= n; k++) {
      const hit = this.hitTest(d.x + (dx * k) / n, d.y + (dy * k) / n);
      if (!hit) continue;
      out.push(hit);
      d.distance = hit.distance;
    }
    d.x = x;
    d.y = y;
  }

  private onPaintDown = (e: PointerEvent): void => {
    const paint = this.paint;
    if (!paint || this.destroyed) return;
    e.preventDefault();
    this.stopTween();
    if (document.activeElement !== this.stage.canvas) this.stage.canvas.focus({ preventScroll: true });
    const touch = e.pointerType === 'touch';
    if (touch) {
      this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.touches.size === 2) {
        // A second finger turns and zooms instead: the first finger's stroke is taken back.
        if (this.drag?.kind === 'paint') paint.end(false);
        this.beginPinch();
        return;
      }
      if (this.touches.size > 2) return;
    } else {
      this.pointer = { x: e.clientX, y: e.clientY, inside: true };
    }
    if (this.drag) return;
    try {
      this.stage.canvas.setPointerCapture(e.pointerId);
    } catch {
      // synthetic events cannot always be captured
    }
    const turn = e.button === 1 || e.button === 2 || this.rotating();
    if (!turn && (e.button === 0 || e.button === 5)) {
      const hit = this.hitTest(e.clientX, e.clientY);
      if (hit && paint.begin(hit, e)) {
        this.drag = { kind: 'paint', id: e.pointerId, x: e.clientX, y: e.clientY, distance: hit.distance };
        this.setCursor(touch ? 'paint' : paint.hover(hit));
        if (touch) paint.hover(null);
        return;
      }
    }
    this.drag = { kind: 'orbit', id: e.pointerId, x: e.clientX, y: e.clientY };
    paint.hover(null);
    this.setCursor('grabbing');
  };

  private onPaintMove = (e: PointerEvent): void => {
    const paint = this.paint;
    if (!paint || this.destroyed) return;
    const touch = e.pointerType === 'touch';
    if (touch) {
      if (this.touches.has(e.pointerId)) this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    } else {
      this.pointer = { x: e.clientX, y: e.clientY, inside: true };
    }
    const d = this.drag;
    if (d?.kind === 'pinch') {
      if (d.ids.includes(e.pointerId)) this.movePinch(d);
      return;
    }
    if (!d || d.id !== e.pointerId) {
      if (!d && !touch) this.hoverAt(e.clientX, e.clientY);
      return;
    }
    if (d.kind === 'orbit') {
      this.orbit(e.clientX - d.x, e.clientY - d.y);
      d.x = e.clientX;
      d.y = e.clientY;
      return;
    }
    if (d.kind !== 'paint') return;
    const coalesced = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    const hits: SkinHit[] = [];
    for (const ev of coalesced.length ? coalesced : [e]) this.walk(d, ev.clientX, ev.clientY, hits);
    if (hits.length) paint.extend(hits);
    if (!touch) {
      const at = hits.length ? hits[hits.length - 1] : this.hitTest(e.clientX, e.clientY);
      this.setCursor(paint.hover(at));
    }
  };

  private onPaintUp = (e: PointerEvent): void => {
    const paint = this.paint;
    if (!paint) return;
    const touch = e.pointerType === 'touch';
    if (touch) this.touches.delete(e.pointerId);
    const d = this.drag;
    if (!d) return;
    if (d.kind === 'pinch') {
      if (d.ids.includes(e.pointerId)) this.endPinch(d, e.pointerId);
      return;
    }
    if (d.id !== e.pointerId) return;
    this.endDrag(true);
    if (!touch && e.type === 'pointerup') this.hoverAt(e.clientX, e.clientY);
    else paint.hover(null);
  };

  private onLostCapture = (e: PointerEvent): void => {
    const d = this.drag;
    if (d && d.kind !== 'pinch' && d.id === e.pointerId && !this.touches.has(e.pointerId)) this.endDrag(true);
  };

  private onPointerEnter = (e: PointerEvent): void => {
    if (e.pointerType !== 'touch') this.pointer = { x: e.clientX, y: e.clientY, inside: true };
  };

  private onPointerLeave = (e: PointerEvent): void => {
    if (e.pointerType === 'touch') return;
    if (this.pointer) this.pointer.inside = false;
    if (this.paint && !this.drag) {
      this.paint.hover(null);
      this.setCursor('grab');
    }
  };

  /** Ends the current drag; a stroke is kept (commit) or taken back. */
  private endDrag(commit: boolean): void {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    if (d.kind === 'paint') this.paint?.end(commit);
    if (d.kind !== 'pinch') {
      try {
        if (this.stage.canvas.hasPointerCapture(d.id)) this.stage.canvas.releasePointerCapture(d.id);
      } catch {
        // ignore
      }
    }
    if (this.paint) this.setCursor('grab');
  }

  private beginPinch(): void {
    const [[a, pa], [b, pb]] = [...this.touches.entries()];
    const mx = (pa.x + pb.x) / 2;
    const my = (pa.y + pb.y) / 2;
    const d = Math.max(1, Math.hypot(pb.x - pa.x, pb.y - pa.y));
    this.drag = { kind: 'pinch', ids: [a, b], mx, my, d, mx0: mx, my0: my, d0: d, t0: performance.now(), travel: 0 };
    this.paint?.hover(null);
    this.setCursor('grabbing');
  }

  private movePinch(g: Extract<Drag, { kind: 'pinch' }>): void {
    const a = this.touches.get(g.ids[0]);
    const b = this.touches.get(g.ids[1]);
    if (!a || !b) return;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const d = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
    this.orbit(mx - g.mx, my - g.my);
    if (Math.abs(d - g.d) > 0.5) this.dolly(g.d / d, mx, my);
    g.travel = Math.max(g.travel, Math.abs(d - g.d0), Math.hypot(mx - g.mx0, my - g.my0));
    g.mx = mx;
    g.my = my;
    g.d = d;
  }

  private endPinch(g: Extract<Drag, { kind: 'pinch' }>, lifted: number): void {
    const other = g.ids[0] === lifted ? g.ids[1] : g.ids[0];
    const tap = performance.now() - g.t0 < 300 && g.travel < 12;
    this.drag = this.touches.has(other) ? { kind: 'ignore', id: other } : null;
    if (!this.drag) this.setCursor('grab');
    if (tap) this.paint?.undo();
  }

  private onWheel = (e: WheelEvent): void => {
    if (!this.paint || this.destroyed) return;
    e.preventDefault();
    this.stopTween();
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 16;
    else if (e.deltaMode === 2) dy *= 400;
    // Trackpad pinches arrive as ctrl + wheel with small deltas.
    const k = e.ctrlKey ? 0.01 : 0.0015;
    this.dolly(Math.exp(Math.max(-400, Math.min(400, dy)) * k), e.clientX, e.clientY);
    if (!this.drag) this.hoverAt(e.clientX, e.clientY);
  };

  private onContextMenu = (e: Event): void => {
    if (this.paint) e.preventDefault();
  };

  /** Space or Alt held over the model: drags turn the camera instead of painting. */
  private onHeldKey = (e: KeyboardEvent): void => {
    if (!this.paint || (e.key !== ' ' && e.key !== 'Alt')) return;
    const key = e.key === ' ' ? 'space' : 'alt';
    const down = e.type === 'keydown';
    const over = !!this.pointer?.inside || document.activeElement === this.stage.canvas;
    if (down) {
      if (!over || e.ctrlKey || e.metaKey || (e.target !== this.stage.canvas && isTypingTarget(e.target))) return;
      e.preventDefault();
    } else {
      if (!this.held[key]) return;
      if (over) e.preventDefault();
    }
    if (this.held[key] === down) return;
    this.held[key] = down;
    this.refreshHover();
  };

  private onWindowBlur = (): void => {
    this.held.space = this.held.alt = false;
    this.refreshHover();
  };

  // ---- camera ----

  /** Turns the camera around its pivot by a pointer movement (same feel as the view-mode drag). */
  private orbit(dx: number, dy: number): void {
    if (!dx && !dy) return;
    const cam = this.viewer.camera;
    const target = this.viewer.controls.target;
    const h = this.stage.canvas.clientHeight || 1;
    const offset = cam.position.clone().sub(target);
    const s = new THREE.Spherical().setFromVector3(offset);
    s.theta -= (2 * Math.PI * dx) / h;
    s.phi = Math.min(Math.PI - 0.02, Math.max(0.02, s.phi - (2 * Math.PI * dy) / h));
    cam.position.copy(target).add(offset.setFromSpherical(s));
    cam.lookAt(target);
    this.viewer.controls.update();
    this.requestRender();
  }

  /**
   * Moves the camera closer (factor < 1) or further away. With a client point, zooming in closes in on
   * that point (it stays under the pointer); zooming out drifts the pivot back to the player's middle.
   */
  private dolly(factor: number, clientX?: number, clientY?: number): void {
    const cam = this.viewer.camera;
    const controls = this.viewer.controls;
    const target = controls.target;
    const dist = cam.position.distanceTo(target);
    if (!(dist > 0)) return;
    const next = Math.min(controls.maxDistance, Math.max(controls.minDistance, dist * factor));
    const s = next / dist;
    if (Math.abs(s - 1) < 1e-4) return;
    let pivot = target.clone();
    const ndc = clientX !== undefined && clientY !== undefined && s < 1 ? this.ndcAt(clientX, clientY) : null;
    if (ndc) {
      cam.updateMatrixWorld();
      this.raycaster.setFromCamera(ndc, cam);
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(cam.getWorldDirection(new THREE.Vector3()), target);
      pivot = this.raycaster.ray.intersectPlane(plane, new THREE.Vector3()) ?? pivot;
    }
    const nextTarget = pivot.clone().add(target.clone().sub(pivot).multiplyScalar(s));
    const nextCam = pivot.clone().add(cam.position.clone().sub(pivot).multiplyScalar(s));
    if (s > 1) {
      // Zooming out recentres gradually.
      const back = nextTarget.clone().multiplyScalar(-Math.min(1, (s - 1) * 1.5));
      nextTarget.add(back);
      nextCam.add(back);
    }
    const clamped = nextTarget.clone().clamp(PIVOT_MIN, PIVOT_MAX);
    nextCam.add(clamped.clone().sub(nextTarget));
    target.copy(clamped);
    cam.position.copy(nextCam);
    cam.lookAt(target);
    controls.update();
    this.requestRender();
  }

  private stopTween(): void {
    if (this.tweenRaf) cancelAnimationFrame(this.tweenRaf);
    this.tweenRaf = 0;
  }

  setView(v: SkinView): void {
    if (this.destroyed) return;
    this.stopTween();
    const cam = this.viewer.camera;
    const target = this.viewer.controls.target;
    const wrapper = this.viewer.playerWrapper;
    const from = new THREE.Spherical().setFromVector3(cam.position.clone().sub(target));
    const to = new THREE.Spherical().setFromVector3(new THREE.Vector3(...VIEW_DIRS[v]).normalize().multiplyScalar(from.radius));
    let dTheta = to.theta - from.theta;
    while (dTheta > Math.PI) dTheta -= 2 * Math.PI;
    while (dTheta < -Math.PI) dTheta += 2 * Math.PI;
    const r0 = Math.atan2(Math.sin(wrapper.rotation.y), Math.cos(wrapper.rotation.y));
    const duration = prefersReducedMotion() ? 0 : 320;
    const t0 = performance.now();
    const step = () => {
      this.tweenRaf = 0;
      if (this.destroyed) return;
      const t = duration ? Math.min(1, (performance.now() - t0) / duration) : 1;
      const k = 1 - Math.pow(1 - t, 3);
      const s = new THREE.Spherical(from.radius, from.phi + (to.phi - from.phi) * k, from.theta + dTheta * k);
      cam.position.copy(target).add(new THREE.Vector3().setFromSpherical(s));
      cam.lookAt(target);
      wrapper.rotation.y = r0 * (1 - k);
      this.viewer.controls.update();
      this.requestRender();
      if (t < 1) this.tweenRaf = requestAnimationFrame(step);
      else this.refreshHover();
    };
    step();
  }

  // ---- painting: pixel outlines on the model ----

  private ensureOverlay(): OverlayLayer | null {
    if (this.overlay) return this.overlay;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64 * OVERLAY_SCALE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      // drawn on top of the surface it outlines
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -8,
    });
    const meshes: THREE.Mesh[] = [];
    for (const [mesh] of this.meshInfo) {
      const m = new THREE.Mesh((mesh as THREE.Mesh).geometry, material);
      m.userData.skinOverlay = true;
      m.renderOrder = 10;
      m.visible = false;
      m.raycast = () => undefined;
      mesh.add(m);
      meshes.push(m);
    }
    this.overlay = { canvas, ctx, texture, material, meshes };
    return this.overlay;
  }

  setOverlay(o: SkinOverlay | null): void {
    if (this.destroyed) return;
    const empty = !o || (!o.pixels.length && !o.echo?.length);
    const key = empty ? '' : `${o.tone ?? ''}|${o.fill ?? ''}|${o.pixels.join(',')}|${(o.echo ?? []).join(',')}`;
    if (key === this.overlayKey) return;
    this.overlayKey = key;
    if (empty) {
      if (this.overlay) for (const m of this.overlay.meshes) m.visible = false;
      this.requestRender();
      return;
    }
    const layer = this.ensureOverlay();
    if (!layer) return;
    const { ctx } = layer;
    ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
    const line = o.tone === 'locked' ? '#ff5b5b' : 'rgba(255, 255, 255, 0.95)';
    if (o.echo?.length) this.drawOutlined(ctx, o.echo, o.fill ?? null, line, 0.55);
    this.drawOutlined(ctx, o.pixels, o.fill ?? null, line, 1);
    layer.texture.needsUpdate = true;
    for (const m of layer.meshes) m.visible = true;
    this.requestRender();
  }

  /** Fills pixels and outlines the edge of the set (dark halo, light line), all inside the pixels. */
  private drawOutlined(ctx: CanvasRenderingContext2D, pixels: readonly number[], fill: string | null, line: string, alpha: number): void {
    const S = OVERLAY_SCALE;
    const set = new Set(pixels);
    ctx.globalAlpha = alpha;
    if (fill) {
      ctx.fillStyle = fill;
      for (const p of set) ctx.fillRect((p % 64) * S, Math.floor(p / 64) * S, S, S);
    }
    const edges = (inset: number, width: number) => {
      for (const p of set) {
        const x = p % 64;
        const y = Math.floor(p / 64);
        const X = x * S;
        const Y = y * S;
        if (y === 0 || !set.has(p - 64)) ctx.fillRect(X, Y + inset, S, width);
        if (y === 63 || !set.has(p + 64)) ctx.fillRect(X, Y + S - inset - width, S, width);
        if (x === 0 || !set.has(p - 1)) ctx.fillRect(X + inset, Y, width, S);
        if (x === 63 || !set.has(p + 1)) ctx.fillRect(X + S - inset - width, Y, width, S);
      }
    };
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    edges(0, 2);
    ctx.fillStyle = line;
    edges(2, 2);
    ctx.globalAlpha = 1;
  }

  // ---- misc ----

  screenshot(): Promise<Blob> {
    if (this.destroyed) return Promise.reject(new Error('The preview has been closed.'));
    const pending = this.pendingSkin;
    if (pending) {
      this.pendingSkin = null;
      this.applySkin(pending);
    }
    // Pictures show the skin, not the paint-mode outline.
    const outlined = this.overlay?.meshes.filter((m) => m.visible) ?? [];
    for (const m of outlined) m.visible = false;
    this.renderNow();
    const shot = new Promise<Blob>((resolve, reject) => {
      this.stage.canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not capture the preview image.'))), 'image/png');
    });
    if (outlined.length) {
      for (const m of outlined) m.visible = true;
      this.dirty = true;
      requestAnimationFrame(() => this.requestRender());
    }
    return shot;
  }

  focusPart(part: SkinPartId | null): void {
    if (this.destroyed) return;
    this.stopTween();
    const cam = this.viewer.camera;
    const controls = this.viewer.controls;
    const target = controls.target;
    const wrapper = this.viewer.playerWrapper;
    // Face the player square-on first so the part's centre stays put when the side buttons turn it.
    const r0 = Math.atan2(Math.sin(wrapper.rotation.y), Math.cos(wrapper.rotation.y));
    wrapper.rotation.y = 0;
    wrapper.updateMatrixWorld(true);
    const skin = this.viewer.playerObject.skin as unknown as Partial<Record<SkinPartId, THREE.Object3D>>;
    const obj = part ? (part === 'cape' ? this.viewer.playerObject.cape : skin[part]) : null;
    let center = new THREE.Vector3(0, 0, 0);
    let dist = this.homeDistance || cam.position.distanceTo(target);
    if (obj) {
      const box = new THREE.Box3().setFromObject(obj);
      if (!box.isEmpty()) {
        center = box.getCenter(new THREE.Vector3());
        const radius = box.getSize(new THREE.Vector3()).length() / 2;
        const fov = (cam.fov * Math.PI) / 180;
        dist = (radius / Math.sin(fov / 2)) * 1.25;
      }
    }
    wrapper.rotation.y = r0;
    center.clamp(PIVOT_MIN, PIVOT_MAX);
    dist = Math.min(controls.maxDistance, Math.max(controls.minDistance, dist));
    const fromTarget = target.clone();
    const fromDist = cam.position.distanceTo(target);
    const dir = cam.position.clone().sub(target).normalize();
    const duration = prefersReducedMotion() ? 0 : 360;
    const t0 = performance.now();
    const step = () => {
      this.tweenRaf = 0;
      if (this.destroyed) return;
      const t = duration ? Math.min(1, (performance.now() - t0) / duration) : 1;
      const k = 1 - Math.pow(1 - t, 3);
      target.lerpVectors(fromTarget, center, k);
      cam.position.copy(target).addScaledVector(dir, fromDist + (dist - fromDist) * k);
      cam.lookAt(target);
      wrapper.rotation.y = r0 * (1 - k);
      controls.update();
      this.requestRender();
      if (t < 1) this.tweenRaf = requestAnimationFrame(step);
      else this.refreshHover();
    };
    step();
  }

  resetCamera(): void {
    if (this.destroyed) return;
    this.stopTween();
    this.viewer.playerWrapper.rotation.set(0, 0, 0);
    this.viewer.zoom = DEFAULT_ZOOM;
    this.setCameraAngle();
    this.requestRender();
    this.refreshHover();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.endDrag(false);
    this.destroyed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this.renderRaf) cancelAnimationFrame(this.renderRaf);
    this.stopTween();
    this.ro?.disconnect();
    this.io?.disconnect();
    this.unwatchDpr();
    this.viewer.controls.removeEventListener('change', this.requestRender);
    document.removeEventListener('visibilitychange', this.updatePaused);
    const c = this.stage.canvas;
    c.removeEventListener('keydown', this.onKey);
    c.removeEventListener('dblclick', this.onDbl);
    c.removeEventListener('pointerdown', this.onPaintDown);
    c.removeEventListener('pointermove', this.onPaintMove);
    c.removeEventListener('pointerup', this.onPaintUp);
    c.removeEventListener('pointercancel', this.onPaintUp);
    c.removeEventListener('lostpointercapture', this.onLostCapture);
    c.removeEventListener('pointerenter', this.onPointerEnter);
    c.removeEventListener('pointerleave', this.onPointerLeave);
    c.removeEventListener('wheel', this.onWheel);
    c.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('keydown', this.onHeldKey);
    window.removeEventListener('keyup', this.onHeldKey);
    window.removeEventListener('blur', this.onWindowBlur);
    this.restoreMaterials();
    for (const d of this.dimmed.values()) d.dispose();
    this.dimmed.clear();
    for (const g of this.ghosts.values()) g.dispose();
    this.ghosts.clear();
    if (this.overlay) {
      for (const m of this.overlay.meshes) m.removeFromParent();
      this.overlay.material.dispose();
      this.overlay.texture.dispose();
      this.overlay = null;
    }
    const renderer = this.viewer.renderer;
    this.viewer.dispose();
    renderer.forceContextLoss();
    this.stage.root.remove();
  }
}

class UnavailableSkinPreview implements SkinPreview {
  constructor(private readonly stage: ReturnType<typeof createStage>) {}
  setSkin(): void {}
  setModel(): void {}
  setCape(): void {}
  setAnimation(): void {}
  setLayers(): void {}
  setBackground(): void {}
  setHighlight(): void {}
  setAutoRotate(): void {}
  resetCamera(): void {}
  setPaintMode(): void {}
  setPaintLayers(): void {}
  setOverlay(): void {}
  setView(): void {}
  focusPart(): void {}
  hitTest(): SkinHit | null {
    return null;
  }
  pixelToClient(): [number, number] | null {
    return null;
  }
  screenshot(): Promise<Blob> {
    return Promise.reject(new Error('The 3D preview is not available in this browser.'));
  }
  destroy(): void {
    this.stage.root.remove();
  }
}

/** Creates the 3D skin preview inside `container` (fills it; give the container a size). */
export function createSkinPreview(container: HTMLElement, opts: SkinPreviewOptions): SkinPreview {
  const stage = createStage(container, VIEW_LABEL);
  try {
    return new SkinPreviewImpl(stage, opts);
  } catch (err) {
    console.warn('Skin preview unavailable', err);
    stage.message('The 3D preview needs WebGL, which is turned off or not supported in this browser. You can still paint and export your skin.');
    return new UnavailableSkinPreview(stage);
  }
}
