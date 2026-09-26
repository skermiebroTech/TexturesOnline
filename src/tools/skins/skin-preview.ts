// 3D skin preview built on skinview3d: classic/slim, animations, layer toggles, cape, cheap live
// texture updates while painting, part highlighting, screenshots.

import { FlyingAnimation, IdleAnimation, RunningAnimation, SkinViewer, WalkingAnimation, type PlayerAnimation } from 'skinview3d';
import * as THREE from 'three';
import type { SkinModel } from '../../core/types';
import { createStage, watchDevicePixelRatio } from '../../shared/preview/viewport';

export type SkinAnimation = 'idle' | 'walk' | 'run' | 'fly' | 'none';
export type SkinPartId = 'head' | 'body' | 'rightArm' | 'leftArm' | 'rightLeg' | 'leftLeg' | 'cape';
export type SkinSource = HTMLCanvasElement | ImageData;

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
const MAX_PIXEL_RATIO = 2;

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

class SkinPreviewImpl implements SkinPreview {
  private readonly stage: ReturnType<typeof createStage>;
  private readonly viewer: SkinViewer;
  private model: SkinModel;
  private pendingSkin: SkinSource | null = null;
  private raf = 0;
  private scratch: HTMLCanvasElement | null = null;
  private capeScratch: HTMLCanvasElement | null = null;
  private hasSkin = false;
  private highlight: Highlight | null = null;
  private dimmed = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  private originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  private ro: ResizeObserver | null = null;
  private io: IntersectionObserver | null = null;
  private readonly unwatchDpr: () => void;
  private onScreen = true;
  private dirty = false;
  private destroyed = false;

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
        zoom: 0.86,
        enableControls: true,
        // start paused: updatePaused() below decides whether the render loop needs to run
        renderPaused: true,
      });
    } finally {
      THREE.ColorManagement.enabled = colorManagement;
    }
    this.viewer.controls.enablePan = false;
    this.viewer.controls.addEventListener('change', this.requestRender);
    this.viewer.autoRotateSpeed = 0.7;
    this.viewer.autoRotate = opts.autoRotate ?? false;
    this.stage.canvas.style.width = '100%';
    this.stage.canvas.style.height = '100%';
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
    this.stage.canvas.addEventListener('keydown', this.onKey);
    this.stage.canvas.addEventListener('dblclick', this.onDbl);
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

  /** Redraws once when the loop is paused (running loops pick changes up on their next frame). */
  private requestRender = (): void => {
    if (this.destroyed || !this.viewer.renderPaused) return;
    this.dirty = true;
    if (this.visible) this.renderNow();
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
  }

  private onKey = (e: KeyboardEvent): void => {
    const w = this.viewer.playerWrapper;
    let handled = true;
    switch (e.key) {
      case 'ArrowLeft': w.rotation.y -= 0.2; break;
      case 'ArrowRight': w.rotation.y += 0.2; break;
      case '+': case '=': this.viewer.zoom = Math.min(2, this.viewer.zoom * 1.1); break;
      case '-': case '_': this.viewer.zoom = Math.max(0.4, this.viewer.zoom / 1.1); break;
      case 'Home': case '0': this.resetCamera(); break;
      default: handled = false;
    }
    if (handled) {
      e.preventDefault();
      this.requestRender();
    }
  };

  private onDbl = (): void => this.resetCamera();

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
    const make = a === 'none' ? null : ANIMATIONS[a];
    this.viewer.animation = make ? make() : null;
    this.updatePaused();
    this.requestRender();
  }

  setLayers(v: { inner: boolean; outer: boolean }): void {
    if (this.destroyed) return;
    this.viewer.playerObject.skin.setInnerLayerVisible(v.inner);
    this.viewer.playerObject.skin.setOuterLayerVisible(v.outer);
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
    this.viewer.autoRotate = v;
    this.updatePaused();
  }

  // ---- highlight ----

  private partMeshes(part: SkinPartId, layer: Highlight['layer']): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    const collect = (o: THREE.Object3D) => o.traverse((c) => (c as THREE.Mesh).isMesh && out.push(c as THREE.Mesh));
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
    this.viewer.playerObject.traverse((c) => (c as THREE.Mesh).isMesh && out.push(c as THREE.Mesh));
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

  private restoreMaterials(): void {
    for (const [mesh, mat] of this.originals) mesh.material = mat;
    this.originals.clear();
  }

  private applyHighlight(): void {
    this.restoreMaterials();
    const h = this.highlight;
    if (!h) return;
    const keep = new Set(this.partMeshes(h.part, h.layer));
    for (const mesh of this.allMeshes()) {
      if (keep.has(mesh)) continue;
      this.originals.set(mesh, mesh.material);
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => this.dimmedFor(m)) : this.dimmedFor(mesh.material);
    }
    this.requestRender();
  }

  /** Dimmed clones share the skin texture; keep them pointing at the current one after reloads. */
  private syncDimmedMaps(): void {
    if (!this.highlight) return;
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

  // ---- misc ----

  screenshot(): Promise<Blob> {
    if (this.destroyed) return Promise.reject(new Error('The preview has been closed.'));
    const pending = this.pendingSkin;
    if (pending) {
      this.pendingSkin = null;
      this.applySkin(pending);
    }
    this.renderNow();
    return new Promise((resolve, reject) => {
      this.stage.canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not capture the preview image.'))), 'image/png');
    });
  }

  resetCamera(): void {
    if (this.destroyed) return;
    this.viewer.playerWrapper.rotation.set(0, 0, 0);
    this.viewer.zoom = 0.86;
    this.setCameraAngle();
    this.requestRender();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.io?.disconnect();
    this.unwatchDpr();
    this.viewer.controls.removeEventListener('change', this.requestRender);
    document.removeEventListener('visibilitychange', this.updatePaused);
    this.stage.canvas.removeEventListener('keydown', this.onKey);
    this.stage.canvas.removeEventListener('dblclick', this.onDbl);
    this.restoreMaterials();
    for (const d of this.dimmed.values()) d.dispose();
    this.dimmed.clear();
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
  screenshot(): Promise<Blob> {
    return Promise.reject(new Error('The 3D preview is not available in this browser.'));
  }
  destroy(): void {
    this.stage.root.remove();
  }
}

/** Creates the 3D skin preview inside `container` (fills it; give the container a size). */
export function createSkinPreview(container: HTMLElement, opts: SkinPreviewOptions): SkinPreview {
  const stage = createStage(container, '3D skin preview. Drag to rotate, scroll to zoom, arrow keys turn the player.');
  try {
    return new SkinPreviewImpl(stage, opts);
  } catch (err) {
    console.warn('Skin preview unavailable', err);
    stage.message('The 3D preview needs WebGL, which is turned off or not supported in this browser. You can still paint and export your skin.');
    return new UnavailableSkinPreview(stage);
  }
}
