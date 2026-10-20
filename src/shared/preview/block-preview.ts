// Rotating 3D block preview (per-face textures, Minecraft UV orientation) with a crisp flat mode for
// items / GUI textures, and a paint mode for models: rays from the pointer to texels of the model's
// textures, a brush outline on the model, camera views, and camera controls that leave the left button
// (or one finger) to the brush. Transparent background.

import * as THREE from 'three';
import { alphaMode, makePixelTexture, stripFrames, type PixelImage } from './three-utils';
import { createStage, OrbitController, prefersReducedMotion, ViewportLoop } from './viewport';
import { ModelMesh, type ModelHit, type ModelTextureImage, type PaintCursor } from '../models/model-mesh';
import type { BakedQuad, RGB, Tint, Vec3 } from '../models/geometry';
import { liftedPositions, pointForUv, quadTexelRect, raycastQuads } from '../models/model-paint';
import { mt } from '../models/i18n/text';

export type { ModelHit, ModelTextureImage, PaintCursor } from '../models/model-mesh';

/** Baked model quads plus the (pack) images of every texture they use. */
export interface ModelScene {
  quads: BakedQuad[];
  textures: Map<string, ModelTextureImage>;
  /** Colour of a biome / fixed tint */
  tint: (t: Tint) => RGB;
}

export interface ModelShowOptions {
  /**
   * 'block' looks at the north-east corner like the inventory; 'item' at the front (south) of a flat
   * item; 'mob' at a mob's face from its front left (mobs face south)
   */
  view?: 'block' | 'item' | 'mob';
  /** Keep the camera where the user left it (e.g. when only the block state changed) */
  keepView?: boolean;
  /** Start from another angle than the view's standard one (radians; azimuth 0 looks at the south face) */
  angle?: { azimuth?: number; elevation?: number };
  /** Azimuth that looks at the model's front, for the camera views (default: north for blocks, south for items) */
  front?: number;
  /** Faces to frame instead of the shown ones (a mob with parts hidden keeps its place and size) */
  frame?: readonly BakedQuad[];
}

/** A ray from the pointer onto a face of the model (paint mode). */
export interface ModelPaintHit {
  /** Index into the quads of the shown model */
  index: number;
  quad: BakedQuad;
  /** Pack path (null = missing texture) */
  texture: string | null;
  /** Texture point within one frame (0..1, v down) */
  uv: [number, number];
  /** Size of one frame of the texture as the model draws it (null = missing texture) */
  frame: [number, number] | null;
  /** Distance from the camera, in scene units */
  distance: number;
}

export type PaintCursorKind = 'paint' | 'pick' | 'locked';

/** Receives the pointer on the model while the preview is in paint mode. */
export interface ModelPaintHandler {
  /** A press on the model; return true to take the drag (a stroke). `pick` is true while Alt is held. */
  begin(hit: ModelPaintHit, e: PointerEvent, pick: boolean): boolean;
  /** More points of the drag, in order (fast drags are sampled along the way) */
  extend(hits: ModelPaintHit[]): void;
  /** The drag ended (commit) or was taken back (a second finger came down, paint mode was left) */
  end(commit: boolean): void;
  /** What is under a mouse or pen (null = off the model); returns the cursor to show */
  hover(hit: ModelPaintHit | null, pick: boolean): PaintCursorKind;
  /** Two-finger tap */
  undo(): void;
}

/** Standard camera angles around a model (relative to its front). */
export type ModelCameraView = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';

export interface ModelHandlers {
  /** Pointer moved onto another face (null = off the model) */
  hover?(hit: ModelHit | null): void;
  /** A face was clicked or tapped (not dragged) */
  pick?(hit: ModelHit): void;
}

export type CubeFace = 'up' | 'down' | 'north' | 'south' | 'east' | 'west';
export type CubeFaces = Partial<Record<CubeFace, ImageData | PixelImage>> & { all?: ImageData | PixelImage };

export interface BlockViewOptions {
  /**
   * Game ticks per frame (Java .mcmeta `frametime`, Bedrock `ticks_per_frame`). When given, vertical
   * animation strips play. Without it a cube face shows frame 0 of a strip, while showFlat shows the whole
   * image (tall non-animated textures such as 1x2 paintings are valid images).
   */
  frametime?: number;
}

export interface BlockPreview {
  showCube(faces: CubeFaces, opts?: BlockViewOptions): void;
  showFlat(img: ImageData | PixelImage, opts?: BlockViewOptions): void;
  /** Full block / item model (see ModelScene); faces can be hovered and clicked. */
  showModel(scene: ModelScene, opts?: ModelShowOptions): void;
  /** Live pixels for one texture of the shown model (painting) */
  updateModelTexture(path: string, tex: ModelTextureImage): void;
  setModelHandlers(h: ModelHandlers | null): void;
  /** Highlights the faces drawn with a texture (null = none) */
  highlightTexture(path: string | null): void;
  /** Where the most visible face drawn with `path` is on screen (client CSS pixels), or null */
  facePoint(path: string): { x: number; y: number } | null;
  /**
   * Paint mode (models only): presses on the model go to `handler`; the camera turns with the right or
   * middle button, a drag off the model, Space + drag or two fingers; the wheel or a pinch zooms. null
   * goes back to viewing (click a face to pick it).
   */
  setPaintMode(handler: ModelPaintHandler | null): void;
  readonly painting: boolean;
  /** Outlines the texels a brush would paint (null clears) */
  setPaintCursor(c: PaintCursor | null): void;
  /** Holds animations still, showing these frames (null: play them) */
  pinFrames(frames: Map<string, number> | null): void;
  /** Turns the camera to a standard view of the model */
  setCameraView(v: ModelCameraView): void;
  /** Asks the paint handler for the hover again (the tool or the brush changed) */
  refreshPaintHover(): void;
  /** What a press at a client point would paint (paint rays), or null */
  paintHitAt(clientX: number, clientY: number): ModelPaintHit | null;
  /**
   * Screen point (client CSS pixels) where texel (x, y) of a texture shows on the model, facing the
   * camera and not covered, for a frame of `width` x `height`; null when it can't be seen.
   */
  texelPoint(path: string, x: number, y: number, width: number, height: number): { x: number; y: number } | null;
  readonly mode: 'empty' | 'cube' | 'flat' | 'model';
  setAutoRotate(v: boolean): void;
  /** Back to the standard inventory angle */
  resetView(): void;
  destroy(): void;
}

export interface BlockPreviewOptions {
  /** Default true unless the user prefers reduced motion */
  autoRotate?: boolean;
}

// three.js BoxGeometry material group order: +x, -x, +y, -y, +z, -z (Minecraft: +x east, +y up, +z south).
// With rows flipped like flipY (makePixelTexture) this reproduces the game's default face UVs exactly.
export const BOX_FACE_ORDER: readonly CubeFace[] = ['east', 'west', 'up', 'down', 'south', 'north'];
const BOX_ORDER = BOX_FACE_ORDER;
const FACE_SET = new Set<string>(BOX_ORDER);

const VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormal;
void main() {
  vUv = uv;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uFrames;
uniform float uFrame;
uniform float uAlphaTest;
uniform float uBlend;
varying vec2 vUv;
varying vec3 vNormal;
void main() {
  vec2 uv = vec2(vUv.x, (vUv.y + (uFrames - 1.0 - uFrame)) / uFrames);
  vec4 t = texture2D(uMap, uv);
  if (t.a < uAlphaTest) discard;
  vec3 n = normalize(vNormal);
  float light = 0.58 + 0.42 * max(dot(n, normalize(vec3(0.35, 1.0, 0.55))), 0.0);
  light = mix(light, 1.0, 0.18 * max(n.y, 0.0));
  gl_FragColor = vec4(t.rgb * light, uBlend > 0.5 ? t.a : 1.0);
}
`;

const SHADOW_FRAG = /* glsl */ `
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  gl_FragColor = vec4(0.0, 0.0, 0.0, 0.28 * (1.0 - smoothstep(0.2, 1.0, d)));
}
`;

const DEFAULT_VIEW = { azimuth: (3 * Math.PI) / 4, elevation: 0.52, distance: 3.6 };
const ITEM_VIEW = { azimuth: 0.42, elevation: 0.24, distance: 3.3 };
const MOB_VIEW = { azimuth: 0.6, elevation: 0.3, distance: 3.4 };
const CLICK_SLOP = 6;

type PaintDrag =
  | { kind: 'paint'; id: number; x: number; y: number; distance: number }
  | { kind: 'orbit'; id: number; x: number; y: number }
  | { kind: 'pinch'; ids: [number, number]; mx: number; my: number; d: number; mx0: number; my0: number; d0: number; t0: number; travel: number }
  | { kind: 'ignore'; id: number };

function asPixelImage(img: ImageData | PixelImage): PixelImage {
  return { width: img.width, height: img.height, data: img.data };
}

function validImage(img: ImageData | PixelImage | undefined | null): img is ImageData | PixelImage {
  return !!img && img.width > 0 && img.height > 0 && img.data.length >= img.width * img.height * 4;
}

interface FaceState {
  material: THREE.ShaderMaterial;
  frames: number;
}

class BlockPreviewImpl implements BlockPreview {
  private readonly stage: ReturnType<typeof createStage>;
  private readonly flat: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer | null;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  private readonly group = new THREE.Group();
  private readonly shadow: THREE.Mesh | null = null;
  private readonly loop: ViewportLoop;
  private readonly orbit: OrbitController;
  private readonly geometry = new THREE.BoxGeometry(1, 1, 1);
  private meshes: THREE.Mesh[] = [];
  private textures: THREE.Texture[] = [];
  private faces: FaceState[] = [];
  private extraMaterials: THREE.Material[] = [];
  mode: 'empty' | 'cube' | 'flat' | 'model' = 'empty';
  private model: ModelMesh | null = null;
  private modelPivot: THREE.Group | null = null;
  private modelCells: THREE.LineSegments | null = null;
  private handlers: ModelHandlers | null = null;
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private hoverRaf = 0;
  private hoverKey = '';
  private down: { x: number; y: number; t: number; id: number } | null = null;
  private lastPointer: { x: number; y: number } | null = null;
  private flatImage: PixelImage | null = null;
  private flatCanvas: HTMLCanvasElement | null = null;
  private cubeFallback: Partial<Record<CubeFace, HTMLCanvasElement>> | null = null;
  private frametime = 0;
  private animTime = 0;
  private lastFrame = -1;
  private cssW = 1;
  private destroyed = false;
  // paint mode
  private paint: ModelPaintHandler | null = null;
  private paintDrag: PaintDrag | null = null;
  private readonly touches = new Map<number, { x: number; y: number }>();
  private paintPointer: { x: number; y: number; inside: boolean } | null = null;
  private paintHoverRaf = 0;
  private spaceHeld = false;
  private altHeld = false;
  private paintCursor: PaintCursor | null = null;
  private pins: Map<string, number> | null = null;
  private lifted: Vec3[][] | null = null;
  private front = Math.PI;
  private readonly invMatrix = new THREE.Matrix4();

  constructor(container: HTMLElement, opts: BlockPreviewOptions) {
    this.stage = createStage(container, mt.stage.view);
    this.stage.root.style.minHeight = '80px';
    this.flat = document.createElement('canvas');
    this.flat.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:none;pointer-events:none;';
    this.flat.setAttribute('role', 'img');
    this.flat.setAttribute('aria-label', mt.stage.flat);
    this.stage.root.appendChild(this.flat);

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: this.stage.canvas, alpha: true, antialias: true, premultipliedAlpha: true });
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.NoToneMapping;
    } catch {
      renderer = null;
    }
    this.renderer = renderer;
    if (renderer) {
      this.scene.add(this.group);
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(1.9, 1.9),
        new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: SHADOW_FRAG, transparent: true, depthWrite: false }),
      );
      plane.rotation.x = -Math.PI / 2;
      plane.position.y = -0.62;
      plane.renderOrder = -1;
      this.scene.add(plane);
      this.shadow = plane;
      this.stage.canvas.addEventListener('webglcontextlost', this.onLost);
      this.stage.canvas.addEventListener('webglcontextrestored', this.onRestored);
    }

    const reduced = prefersReducedMotion();
    this.orbit = new OrbitController(this.stage.canvas, {
      ...DEFAULT_VIEW,
      minDistance: 2.2,
      maxDistance: 7,
      minElevation: -1.2,
      maxElevation: 1.35,
      autoRotate: opts.autoRotate ?? !reduced,
      autoRotateSpeed: 0.6,
      onChange: () => this.loop?.invalidate(),
    });
    this.loop = new ViewportLoop(this.stage.root, {
      frame: (dt) => this.frame(dt),
      resize: (w, h) => this.resize(w, h),
    });
    const c = this.stage.canvas;
    c.addEventListener('pointermove', this.onPointerMove);
    c.addEventListener('pointerdown', this.onPointerDown);
    c.addEventListener('pointerup', this.onPointerUp);
    c.addEventListener('pointerleave', this.onPointerLeave);
    c.addEventListener('pointercancel', this.onPaintUp);
    c.addEventListener('lostpointercapture', this.onLostCapture);
    c.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('keydown', this.onHeldKey);
    window.addEventListener('keyup', this.onHeldKey);
    window.addEventListener('blur', this.onWindowBlur);
  }

  // ---- model picking ----

  private setNdc(clientX: number, clientY: number): boolean {
    const r = this.stage.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    this.ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    return true;
  }

  private pickAt(clientX: number, clientY: number): ModelHit | null {
    if (this.mode !== 'model' || !this.model || !this.renderer) return null;
    if (!this.setNdc(clientX, clientY)) return null;
    this.syncCamera();
    this.scene.updateMatrixWorld(true);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    return this.model.pick(this.raycaster);
  }

  private setHover(hit: ModelHit | null): void {
    const key = hit ? `${hit.index}` : '';
    if (key === this.hoverKey) return;
    this.hoverKey = key;
    this.model?.highlight(hit?.texture ?? null, hit ? hit.index : -1);
    this.stage.canvas.style.cursor = hit ? 'pointer' : 'grab';
    this.handlers?.hover?.(hit);
    this.loop.invalidate();
  }

  private onPointerMove = (e: PointerEvent): void => {
    if (this.paint) {
      this.onPaintMove(e);
      return;
    }
    if (this.mode !== 'model') return;
    this.lastPointer = { x: e.clientX, y: e.clientY };
    if (this.down && Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > CLICK_SLOP) {
      this.setHover(null);
      return;
    }
    if (e.pointerType === 'touch' || this.hoverRaf) return;
    this.hoverRaf = requestAnimationFrame(() => {
      this.hoverRaf = 0;
      if (this.destroyed || !this.lastPointer || this.orbit.interacting) return;
      this.setHover(this.pickAt(this.lastPointer.x, this.lastPointer.y));
    });
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (this.paint) {
      this.onPaintDown(e);
      return;
    }
    if (this.mode !== 'model') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (this.paint) {
      this.onPaintUp(e);
      return;
    }
    const d = this.down;
    this.down = null;
    if (!d || d.id !== e.pointerId || this.mode !== 'model') return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > CLICK_SLOP || performance.now() - d.t > 700) return;
    const hit = this.pickAt(e.clientX, e.clientY);
    if (!hit) return;
    if (e.pointerType !== 'mouse') {
      this.hoverKey = '';
      this.setHover(hit);
    }
    this.handlers?.pick?.(hit);
  };

  private onPointerLeave = (e: PointerEvent): void => {
    if (this.paint) {
      if (e.pointerType === 'touch') return;
      if (this.paintPointer) this.paintPointer.inside = false;
      if (!this.paintDrag) {
        this.paint.hover(null, false);
        this.setPaintCursorStyle('grab');
      }
      return;
    }
    this.lastPointer = null;
    if (this.mode === 'model') this.setHover(null);
  };

  // ---- paint mode ----

  get painting(): boolean {
    return !!this.paint;
  }

  setPaintMode(handler: ModelPaintHandler | null): void {
    if (this.destroyed || handler === this.paint) return;
    this.endPaintDrag(false);
    this.paint?.hover(null, false);
    if (this.hoverRaf) cancelAnimationFrame(this.hoverRaf);
    this.hoverRaf = 0;
    this.down = null;
    this.setHover(null);
    this.paint = handler;
    this.touches.clear();
    this.spaceHeld = this.altHeld = false;
    this.orbit.pointerEnabled = !handler;
    this.stage.root.dataset.mode = handler ? 'paint' : 'view';
    this.stage.canvas.setAttribute('aria-label', handler ? mt.stage.paint : mt.stage.view);
    if (!handler) {
      this.setPaintCursor(null);
      delete this.stage.root.dataset.cursor;
      this.stage.canvas.style.cursor = 'grab';
    } else this.setPaintCursorStyle('grab');
    this.loop.invalidate();
  }

  setPaintCursor(c: PaintCursor | null): void {
    this.paintCursor = c;
    if (this.model) {
      this.model.setCursor(c);
      this.loop.invalidate();
    }
  }

  pinFrames(frames: Map<string, number> | null): void {
    this.pins = frames ? new Map(frames) : null;
    if (this.model) {
      this.model.pinFrames(this.pins);
      this.loop.invalidate();
    }
  }

  setCameraView(v: ModelCameraView): void {
    const f = this.front;
    const az = v === 'front' ? f : v === 'back' ? f + Math.PI : v === 'left' ? f - Math.PI / 2 : v === 'right' ? f + Math.PI / 2 : this.orbit.azimuth;
    // the orbit limits keep the camera a little off the poles
    const el = v === 'top' ? 1.35 : v === 'bottom' ? -1.2 : 0.12;
    this.orbit.autoRotate = false;
    this.orbit.turnTo(az, el);
    this.loop.invalidate();
  }

  private setPaintCursorStyle(c: PaintCursorKind | 'grab' | 'grabbing'): void {
    if (this.stage.root.dataset.cursor !== c) this.stage.root.dataset.cursor = c;
    this.stage.canvas.style.cursor = c === 'paint' ? 'crosshair' : c === 'pick' ? 'copy' : c === 'locked' ? 'not-allowed' : c;
  }

  /** `prepared`: the camera and matrices are already up to date (several rays in a row). */
  paintHitAt(clientX: number, clientY: number, prepared?: { rect: DOMRect }): ModelPaintHit | null {
    if (this.mode !== 'model' || !this.model || !this.renderer || !this.modelPivot) return null;
    const r = prepared?.rect ?? this.stage.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const nx = ((clientX - r.left) / r.width) * 2 - 1;
    const ny = -((clientY - r.top) / r.height) * 2 + 1;
    if (nx < -1 || nx > 1 || ny < -1 || ny > 1) return null;
    this.ndc.set(nx, ny);
    if (!prepared) {
      this.syncCamera();
      this.scene.updateMatrixWorld(true);
    }
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const model = this.model;
    this.invMatrix.copy(model.group.matrixWorld).invert();
    const local = this.raycaster.ray.clone().applyMatrix4(this.invMatrix);
    const quads = model.quadList();
    this.lifted ??= liftedPositions(quads);
    const o: Vec3 = [local.origin.x, local.origin.y, local.origin.z];
    const d: Vec3 = [local.direction.x, local.direction.y, local.direction.z];
    // A see-through texel lets the ray through to what is behind; with nothing behind, it takes paint.
    const hit =
      raycastQuads(quads, o, d, { accept: (h, q) => !q.texture || model.alphaAt(q.texture, h.uv, h.index) > 0 }, this.lifted) ?? raycastQuads(quads, o, d, {}, this.lifted);
    if (!hit) return null;
    const q = quads[hit.index];
    const p = new THREE.Vector3(hit.point[0], hit.point[1], hit.point[2]).applyMatrix4(model.group.matrixWorld);
    const frame = q.texture ? model.frameSize(q.texture) : null;
    return { index: hit.index, quad: q, texture: frame ? q.texture : null, uv: hit.uv, frame, distance: p.distanceTo(this.camera.position) };
  }

  texelPoint(path: string, x: number, y: number, width: number, height: number): { x: number; y: number } | null {
    if (this.mode !== 'model' || !this.model) return null;
    this.syncCamera();
    this.scene.updateMatrixWorld(true);
    const model = this.model;
    const quads = model.quadList();
    const lifted = (this.lifted ??= liftedPositions(quads));
    const uv: [number, number] = [(x + 0.5) / width, (y + 0.5) / height];
    const r = this.stage.canvas.getBoundingClientRect();
    const cam = this.camera.position;
    const candidates: { x: number; y: number; score: number }[] = [];
    quads.forEach((q, i) => {
      if (q.texture !== path) return;
      const t = quadTexelRect(q, width, height);
      if (x < t.x || y < t.y || x >= t.x + t.w || y >= t.y + t.h) return;
      const pt = pointForUv(q, uv, lifted[i]);
      if (!pt) return;
      const world = new THREE.Vector3(pt[0], pt[1], pt[2]).applyMatrix4(model.group.matrixWorld);
      const n = new THREE.Vector3(q.normal[0], q.normal[1], q.normal[2]).transformDirection(model.group.matrixWorld);
      const score = cam.clone().sub(world).normalize().dot(n);
      if (score <= 0.05) return;
      const ndc = world.clone().project(this.camera);
      if (ndc.x < -1 || ndc.x > 1 || ndc.y < -1 || ndc.y > 1) return;
      candidates.push({ x: r.left + ((ndc.x + 1) / 2) * r.width, y: r.top + ((1 - ndc.y) / 2) * r.height, score });
    });
    candidates.sort((a, b) => b.score - a.score);
    for (const c of candidates) {
      const hit = this.paintHitAt(c.x, c.y);
      if (!hit || hit.texture !== path) continue;
      if (Math.floor(hit.uv[0] * width + 1e-6) === x && Math.floor(hit.uv[1] * height + 1e-6) === y) return { x: c.x, y: c.y };
    }
    return null;
  }

  /** CSS pixels per scene unit at a distance from the camera. */
  private pixelsPerUnit(distance: number): number {
    const h = this.stage.canvas.clientHeight || 1;
    const fov = (this.camera.fov * Math.PI) / 180;
    return h / (2 * Math.tan(fov / 2) * Math.max(0.05, distance));
  }

  /** Raycasts the screen path from the drag's last position to (x, y), so fast strokes follow the surface. */
  private walk(d: Extract<PaintDrag, { kind: 'paint' }>, x: number, y: number, out: ModelPaintHit[]): void {
    const dx = x - d.x;
    const dy = y - d.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.25) return;
    // about a third of a texel of a 16x block texture per step
    const scale = this.modelPivot?.scale.x || 1;
    const step = Math.max(1, ((this.pixelsPerUnit(d.distance) * scale) / 16) * 0.35);
    const n = Math.min(160, Math.max(1, Math.ceil(len / step)));
    this.syncCamera();
    this.scene.updateMatrixWorld(true);
    const prepared = { rect: this.stage.canvas.getBoundingClientRect() };
    for (let k = 1; k <= n; k++) {
      const hit = this.paintHitAt(d.x + (dx * k) / n, d.y + (dy * k) / n, prepared);
      if (!hit) continue;
      out.push(hit);
      d.distance = hit.distance;
    }
    d.x = x;
    d.y = y;
  }

  private paintHoverAt(clientX: number, clientY: number): void {
    const paint = this.paint;
    if (!paint) return;
    const hit = this.spaceHeld ? null : this.paintHitAt(clientX, clientY);
    const cursor = paint.hover(hit, this.altHeld);
    this.setPaintCursorStyle(this.spaceHeld || !hit ? 'grab' : cursor);
  }

  private schedulePaintHover(): void {
    if (this.paintHoverRaf) return;
    this.paintHoverRaf = requestAnimationFrame(() => {
      this.paintHoverRaf = 0;
      const p = this.paintPointer;
      if (this.destroyed || !this.paint || this.paintDrag || !p?.inside) return;
      this.paintHoverAt(p.x, p.y);
    });
  }

  /** Brings the hover up to date (after the model, the tool or a held key changed). */
  refreshPaintHover(): void {
    if (!this.paint || this.paintDrag) return;
    if (this.paintPointer?.inside) this.schedulePaintHover();
    else this.setPaintCursorStyle('grab');
  }

  private onPaintDown(e: PointerEvent): void {
    const paint = this.paint;
    if (!paint || this.destroyed) return;
    e.preventDefault();
    if (document.activeElement !== this.stage.canvas) this.stage.canvas.focus({ preventScroll: true });
    const touch = e.pointerType === 'touch';
    if (touch) {
      this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.touches.size === 2) {
        // A second finger turns and zooms instead: the first finger's stroke is taken back.
        if (this.paintDrag?.kind === 'paint') paint.end(false);
        this.beginPinch();
        return;
      }
      if (this.touches.size > 2) return;
    } else {
      this.paintPointer = { x: e.clientX, y: e.clientY, inside: true };
    }
    if (this.paintDrag) return;
    try {
      this.stage.canvas.setPointerCapture(e.pointerId);
    } catch {
      // synthetic events cannot always be captured
    }
    this.orbit.autoRotate = false;
    const pick = e.altKey || this.altHeld;
    const turn = e.button === 1 || e.button === 2 || this.spaceHeld;
    if (!turn && (e.button === 0 || e.button === 5)) {
      const hit = this.paintHitAt(e.clientX, e.clientY);
      if (hit && paint.begin(hit, e, pick)) {
        this.paintDrag = { kind: 'paint', id: e.pointerId, x: e.clientX, y: e.clientY, distance: hit.distance };
        this.setPaintCursorStyle(touch ? 'paint' : paint.hover(hit, pick));
        if (touch) paint.hover(null, false);
        return;
      }
    }
    this.paintDrag = { kind: 'orbit', id: e.pointerId, x: e.clientX, y: e.clientY };
    paint.hover(null, false);
    this.setPaintCursorStyle('grabbing');
  }

  private onPaintMove(e: PointerEvent): void {
    const paint = this.paint;
    if (!paint || this.destroyed) return;
    const touch = e.pointerType === 'touch';
    if (touch) {
      if (this.touches.has(e.pointerId)) this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    } else {
      this.paintPointer = { x: e.clientX, y: e.clientY, inside: true };
    }
    const d = this.paintDrag;
    if (d?.kind === 'pinch') {
      if (d.ids.includes(e.pointerId)) this.movePinch(d);
      return;
    }
    if (!d || d.id !== e.pointerId) {
      if (!d && !touch) this.schedulePaintHover();
      return;
    }
    if (d.kind === 'orbit') {
      this.orbit.rotateBy(e.clientX - d.x, e.clientY - d.y);
      d.x = e.clientX;
      d.y = e.clientY;
      this.loop.invalidate();
      return;
    }
    if (d.kind !== 'paint') return;
    const coalesced = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    const hits: ModelPaintHit[] = [];
    for (const ev of coalesced.length ? coalesced : [e]) this.walk(d, ev.clientX, ev.clientY, hits);
    if (hits.length) paint.extend(hits);
    if (!touch) {
      const at = hits.length ? hits[hits.length - 1] : this.paintHitAt(e.clientX, e.clientY);
      this.setPaintCursorStyle(paint.hover(at, this.altHeld));
    }
  }

  private onPaintUp = (e: PointerEvent): void => {
    const paint = this.paint;
    if (!paint) return;
    const touch = e.pointerType === 'touch';
    if (touch) this.touches.delete(e.pointerId);
    const d = this.paintDrag;
    if (!d) return;
    if (d.kind === 'pinch') {
      if (d.ids.includes(e.pointerId)) this.endPinch(d, e.pointerId);
      return;
    }
    if (d.id !== e.pointerId) return;
    this.endPaintDrag(true);
    if (!touch && e.type === 'pointerup') this.paintHoverAt(e.clientX, e.clientY);
    else paint.hover(null, false);
  };

  private onLostCapture = (e: PointerEvent): void => {
    const d = this.paintDrag;
    if (d && d.kind !== 'pinch' && d.id === e.pointerId && !this.touches.has(e.pointerId)) this.endPaintDrag(true);
  };

  /** Ends the current drag; a stroke is kept (commit) or taken back. */
  private endPaintDrag(commit: boolean): void {
    const d = this.paintDrag;
    if (!d) return;
    this.paintDrag = null;
    if (d.kind === 'paint') this.paint?.end(commit);
    if (d.kind !== 'pinch') {
      try {
        if (this.stage.canvas.hasPointerCapture(d.id)) this.stage.canvas.releasePointerCapture(d.id);
      } catch {
        // ignore
      }
    }
    if (this.paint) this.setPaintCursorStyle('grab');
  }

  private beginPinch(): void {
    const [[a, pa], [b, pb]] = [...this.touches.entries()];
    const mx = (pa.x + pb.x) / 2;
    const my = (pa.y + pb.y) / 2;
    const d = Math.max(1, Math.hypot(pb.x - pa.x, pb.y - pa.y));
    this.paintDrag = { kind: 'pinch', ids: [a, b], mx, my, d, mx0: mx, my0: my, d0: d, t0: performance.now(), travel: 0 };
    this.paint?.hover(null, false);
    this.setPaintCursorStyle('grabbing');
  }

  private movePinch(g: Extract<PaintDrag, { kind: 'pinch' }>): void {
    const a = this.touches.get(g.ids[0]);
    const b = this.touches.get(g.ids[1]);
    if (!a || !b) return;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const d = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
    this.orbit.rotateBy(mx - g.mx, my - g.my);
    if (Math.abs(d - g.d) > 0.5) this.orbit.zoomBy(g.d / d);
    g.travel = Math.max(g.travel, Math.abs(d - g.d0), Math.hypot(mx - g.mx0, my - g.my0));
    g.mx = mx;
    g.my = my;
    g.d = d;
    this.loop.invalidate();
  }

  private endPinch(g: Extract<PaintDrag, { kind: 'pinch' }>, lifted: number): void {
    const other = g.ids[0] === lifted ? g.ids[1] : g.ids[0];
    const tap = performance.now() - g.t0 < 300 && g.travel < 12;
    this.paintDrag = this.touches.has(other) ? { kind: 'ignore', id: other } : null;
    if (!this.paintDrag) this.setPaintCursorStyle('grab');
    if (tap) this.paint?.undo();
  }

  private onContextMenu = (e: Event): void => {
    if (this.paint) e.preventDefault();
  };

  /** Space held over the model: drags turn the camera. Alt held: presses pick colours. */
  private onHeldKey = (e: KeyboardEvent): void => {
    if (!this.paint || (e.key !== ' ' && e.key !== 'Alt')) return;
    const down = e.type === 'keydown';
    const over = !!this.paintPointer?.inside || document.activeElement === this.stage.canvas;
    if (down) {
      if (!over || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t && t !== this.stage.canvas && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(t.tagName))) return;
      e.preventDefault();
    }
    if (e.key === ' ') {
      if (this.spaceHeld === down) return;
      this.spaceHeld = down;
    } else {
      if (this.altHeld === down) return;
      this.altHeld = down;
    }
    this.refreshPaintHover();
  };

  private onWindowBlur = (): void => {
    this.spaceHeld = this.altHeld = false;
    this.refreshPaintHover();
  };

  private onLost = (e: Event): void => {
    e.preventDefault();
  };

  private onRestored = (): void => {
    this.loop.invalidate();
  };

  private resize(w: number, h: number): void {
    this.cssW = w;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (this.renderer) {
      this.renderer.setPixelRatio(dpr);
      this.renderer.setSize(w, h, false);
    }
    this.camera.aspect = w / h;
    // keep the whole cube in view on narrow containers
    this.camera.fov = w < h ? Math.min(70, (2 * Math.atan(Math.tan(Math.PI / 12) * (h / w)) * 180) / Math.PI) : 30;
    this.camera.updateProjectionMatrix();
    this.flat.width = Math.round(w * dpr);
    this.flat.height = Math.round(h * dpr);
    this.drawFlat();
  }

  private clearModel(): void {
    if (this.hoverRaf) cancelAnimationFrame(this.hoverRaf);
    this.hoverRaf = 0;
    this.hoverKey = '';
    if (this.modelPivot) this.group.remove(this.modelPivot);
    this.model?.dispose();
    this.model = null;
    this.modelPivot = null;
    this.lifted = null;
    if (this.modelCells) {
      this.modelCells.geometry.dispose();
      (this.modelCells.material as THREE.Material).dispose();
      this.modelCells = null;
    }
    if (this.shadow) {
      this.shadow.position.y = -0.62;
      this.shadow.scale.setScalar(1);
    }
    this.stage.canvas.style.cursor = 'grab';
  }

  private clearCube(): void {
    this.clearModel();
    for (const m of this.meshes) this.group.remove(m);
    for (const f of this.faces) f.material.dispose();
    for (const m of this.extraMaterials) m.dispose();
    this.extraMaterials = [];
    for (const t of this.textures) t.dispose();
    this.meshes = [];
    this.faces = [];
    this.textures = [];
    this.cubeFallback = null;
  }

  private frame(dt: number): boolean {
    if (this.destroyed) return false;
    this.animTime += dt;
    if (!this.renderer) {
      // 2D fallback: the static isometric drawing only changes when a flat strip animates
      if (this.mode === 'cube') {
        this.drawIsoFallback();
        return false;
      }
    } else if ((this.mode === 'cube' || this.mode === 'model') && this.renderer.getContext().isContextLost()) {
      return false; // resumes from onRestored
    }
    if (this.mode === 'model') {
      if (!this.renderer) return false;
      const moving = this.orbit.update(dt);
      const anim = this.model?.animate(this.animTime) ?? false;
      this.renderCube();
      return moving || anim || this.orbit.animating;
    }
    const orbitMoving = this.mode === 'cube' && this.orbit.update(dt);
    let animating = false;
    if (this.frametime > 0) {
      const frameIndex = Math.floor((this.animTime * 20) / this.frametime);
      if (this.mode === 'cube') {
        for (const f of this.faces) f.material.uniforms.uFrame.value = f.frames > 1 ? frameIndex % f.frames : 0;
        animating = this.faces.some((f) => f.frames > 1);
      } else if (this.mode === 'flat' && this.flatImage && stripFrames(this.flatImage) > 1) {
        animating = true;
        if (frameIndex !== this.lastFrame) {
          this.lastFrame = frameIndex;
          this.drawFlat();
        }
      }
    }
    if (this.mode === 'cube') this.renderCube();
    return orbitMoving || animating || (this.mode === 'cube' && this.orbit.animating);
  }

  private syncCamera(): void {
    const off = this.orbit.offset();
    this.camera.position.set(off[0], off[1], off[2]);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld();
  }

  private renderCube(): void {
    if (!this.renderer) return;
    this.syncCamera();
    this.renderer.render(this.scene, this.camera);
  }

  showModel(scene: ModelScene, opts: ModelShowOptions = {}): void {
    if (this.destroyed) return;
    this.clearCube();
    this.mode = 'model';
    this.flatImage = null;
    this.frametime = 0;
    this.animTime = 0;
    if (!this.renderer) {
      // No WebGL: show the first texture flat.
      const first = scene.quads.find((q) => q.texture && scene.textures.has(q.texture));
      const img = first?.texture ? scene.textures.get(first.texture)!.image : null;
      this.mode = 'flat';
      this.flatImage = img ? asPixelImage(img) : null;
      this.flatCanvas = null;
      this.stage.canvas.style.visibility = 'hidden';
      this.flat.style.display = 'block';
      this.drawFlat();
      return;
    }
    this.flat.style.display = 'none';
    this.stage.canvas.style.visibility = 'visible';
    const mesh = new ModelMesh();
    mesh.build(scene.quads, scene.textures, scene.tint);
    const accent = getComputedStyle(this.stage.root).getPropertyValue('--tool-accent').trim();
    if (accent) mesh.setAccent(accent);
    if (this.pins) mesh.pinFrames(this.pins);
    if (this.paintCursor) mesh.setCursor(this.paintCursor);
    this.front = opts.front ?? (opts.view === 'item' || opts.view === 'mob' ? 0 : Math.PI);
    // Frame the model like a unit cube: centred, scaled down when it spans more than one block.
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    const framed = opts.frame?.length ? opts.frame : scene.quads;
    for (const q of framed)
      for (const p of q.positions)
        for (let i = 0; i < 3; i++) {
          min[i] = Math.min(min[i], p[i]);
          max[i] = Math.max(max[i], p[i]);
        }
    if (!framed.length) {
      min.fill(0);
      max.fill(1);
    }
    // Always frame at least the block cell(s) the model sits in, so small models keep their size.
    // (elements may poke a little outside their block, like a wall torch's base: that isn't another block)
    const cellMin = min.map((v, i) => Math.min(Math.floor(v + 0.3), Math.floor(max[i] - 1e-4)));
    const cellMax = max.map((v, i) => Math.max(cellMin[i] + 1, Math.ceil(v - 0.3)));
    // Mobs are framed by their own size (a chicken as large as a cow), never blown up past twice their size.
    const mob = opts.view === 'mob';
    const fmin = mob ? min : cellMin.map((v, i) => Math.min(v, min[i]));
    const fmax = mob ? max : cellMax.map((v, i) => Math.max(v, max[i]));
    const center = fmin.map((v, i) => (v + fmax[i]) / 2);
    const extent = Math.max(fmax[0] - fmin[0], fmax[1] - fmin[1], fmax[2] - fmin[2]);
    const scale = mob ? 1.15 / Math.max(0.55, extent) : 1 / Math.max(1, extent);
    const pivot = new THREE.Group();
    mesh.group.position.set(-center[0], -center[1], -center[2]);
    pivot.add(mesh.group);
    pivot.scale.setScalar(scale);
    // Faint outline of the block cells when the model doesn't fill them (torches, flowers, fences...).
    const fills = scene.quads.length > 0 && [0, 1, 2].every((i) => Math.abs(min[i] - cellMin[i]) < 1e-3 && Math.abs(max[i] - cellMax[i]) < 1e-3);
    if (!fills && opts.view !== 'item' && opts.view !== 'mob') {
      const w = cellMax[0] - cellMin[0];
      const hgt = cellMax[1] - cellMin[1];
      const d = cellMax[2] - cellMin[2];
      const box = new THREE.EdgesGeometry(new THREE.BoxGeometry(w, hgt, d));
      const lines = new THREE.LineSegments(box, new THREE.LineBasicMaterial({ color: 0x8a93a6, transparent: true, opacity: 0.35, depthWrite: false }));
      lines.position.set((cellMin[0] + cellMax[0]) / 2 - center[0], (cellMin[1] + cellMax[1]) / 2 - center[1], (cellMin[2] + cellMax[2]) / 2 - center[2]);
      pivot.add(lines);
      this.modelCells = lines;
    }
    this.group.add(pivot);
    this.model = mesh;
    this.modelPivot = pivot;
    if (this.shadow) {
      this.shadow.visible = opts.view !== 'item' && scene.quads.length > 0;
      this.shadow.position.y = (fmin[1] - center[1]) * scale - 0.1;
      this.shadow.scale.setScalar(Math.max(0.6, Math.max(fmax[0] - fmin[0], fmax[2] - fmin[2]) * scale));
    }
    if (!opts.keepView) {
      const home = opts.view === 'item' ? ITEM_VIEW : opts.view === 'mob' ? MOB_VIEW : DEFAULT_VIEW;
      this.orbit.setHome({ ...home, azimuth: opts.angle?.azimuth ?? home.azimuth, elevation: opts.angle?.elevation ?? home.elevation });
    }
    this.loop.invalidate();
    if (this.paint) this.refreshPaintHover();
  }

  updateModelTexture(path: string, tex: ModelTextureImage): void {
    if (this.mode !== 'model' || !this.model) return;
    if (this.model.updateTexture(path, tex)) this.loop.invalidate();
  }

  setModelHandlers(h: ModelHandlers | null): void {
    this.handlers = h;
  }

  highlightTexture(path: string | null): void {
    if (!this.model) return;
    const cur = this.model.highlighted;
    if (cur.texture === path && cur.face < 0) return;
    this.hoverKey = '';
    this.model.highlight(path, -1);
    this.loop.invalidate();
  }

  facePoint(path: string): { x: number; y: number } | null {
    if (this.mode !== 'model' || !this.model || !this.modelPivot) return null;
    this.syncCamera();
    this.scene.updateMatrixWorld(true);
    const cam = this.camera.position;
    const quads = this.model.quadList();
    const candidates: { i: number; score: number; world: THREE.Vector3 }[] = [];
    quads.forEach((q, i) => {
      if (q.texture !== path) return;
      const c = this.model!.quadCenter(i)!;
      const world = c.applyMatrix4(this.model!.group.matrixWorld);
      const toCam = cam.clone().sub(world).normalize();
      const score = toCam.dot(new THREE.Vector3(q.normal[0], q.normal[1], q.normal[2]));
      if (score > 0.05) candidates.push({ i, score, world });
    });
    candidates.sort((a, b) => b.score - a.score);
    const r = this.stage.canvas.getBoundingClientRect();
    for (const c of candidates) {
      const ndc = c.world.clone().project(this.camera);
      const x = r.left + ((ndc.x + 1) / 2) * r.width;
      const y = r.top + ((1 - ndc.y) / 2) * r.height;
      const hit = this.pickAt(x, y);
      if (hit && hit.texture === path) return { x, y };
    }
    return null;
  }

  showCube(faces: CubeFaces, opts: BlockViewOptions = {}): void {
    if (this.destroyed) return;
    this.clearCube();
    const resolved: Partial<Record<CubeFace, PixelImage>> = {};
    for (const f of BOX_ORDER) {
      const img = faces[f] ?? faces.all;
      if (validImage(img)) resolved[f] = asPixelImage(img);
    }
    for (const k of Object.keys(faces)) {
      if (k !== 'all' && !FACE_SET.has(k)) console.warn(`Unknown cube face "${k}"`);
    }
    this.mode = 'cube';
    this.flatImage = null;
    this.orbit.setHome(DEFAULT_VIEW, false);
    this.frametime = opts.frametime && opts.frametime > 0 ? opts.frametime : 0;
    this.animTime = 0;
    this.flat.style.display = 'none';
    this.stage.canvas.style.visibility = 'visible';

    if (!this.renderer) {
      this.cubeFallback = {};
      for (const f of ['up', 'east', 'north'] as CubeFace[]) {
        const img = resolved[f];
        if (img) this.cubeFallback[f] = this.firstFrameCanvas(img);
      }
      this.flat.style.display = 'block';
      this.drawIsoFallback();
      return;
    }

    const modes = Object.values(resolved).map((img) => alphaMode(img!));
    const translucent = modes.includes('translucent');
    const cutout = modes.includes('cutout');
    const materials: THREE.ShaderMaterial[] = [];
    for (const f of BOX_ORDER) {
      const img = resolved[f];
      const tex = img ? makePixelTexture(img, { mipmaps: false }) : null;
      if (tex) this.textures.push(tex);
      const frames = img ? stripFrames(img) : 1;
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uMap: { value: tex },
          uFrames: { value: frames },
          uFrame: { value: 0 },
          uAlphaTest: { value: translucent ? 0.004 : cutout ? 0.1 : 0 },
          uBlend: { value: translucent ? 1 : 0 },
        },
        transparent: translucent,
        depthWrite: !translucent,
        side: translucent || cutout ? THREE.DoubleSide : THREE.FrontSide,
        visible: !!tex,
      });
      materials.push(mat);
      this.faces.push({ material: mat, frames });
    }
    if (translucent) {
      // back faces first, then front faces, for stable blending of glass-like blocks
      const back = materials.map((m) => {
        const c = m.clone();
        c.side = THREE.BackSide;
        c.uniforms = m.uniforms;
        return c;
      });
      for (const m of materials) m.side = THREE.FrontSide;
      const backMesh = new THREE.Mesh(this.geometry, back);
      backMesh.renderOrder = 1;
      const frontMesh = new THREE.Mesh(this.geometry, materials);
      frontMesh.renderOrder = 2;
      this.meshes.push(backMesh, frontMesh);
      this.extraMaterials.push(...back);
    } else {
      this.meshes.push(new THREE.Mesh(this.geometry, materials));
    }
    for (const m of this.meshes) this.group.add(m);
    if (this.shadow) this.shadow.visible = Object.keys(resolved).length > 0;
    this.loop.invalidate();
  }

  showFlat(img: ImageData | PixelImage, opts: BlockViewOptions = {}): void {
    if (this.destroyed) return;
    this.clearCube();
    this.mode = 'flat';
    this.frametime = opts.frametime && opts.frametime > 0 ? opts.frametime : 0;
    this.animTime = 0;
    this.lastFrame = -1;
    this.flatImage = validImage(img) ? asPixelImage(img) : null;
    this.flatCanvas = null;
    this.stage.canvas.style.visibility = 'hidden';
    this.flat.style.display = 'block';
    if (this.renderer) this.renderer.clear();
    this.drawFlat();
    this.loop.invalidate();
  }

  private sourceCanvas(img: PixelImage): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d');
    if (ctx) ctx.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
    return c;
  }

  private firstFrameCanvas(img: PixelImage): HTMLCanvasElement {
    const size = Math.min(img.width, img.height);
    const src = this.sourceCanvas(img);
    if (size === img.height && size === img.width) return src;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    c.getContext('2d')?.drawImage(src, 0, 0, size, size, 0, 0, size, size);
    return c;
  }

  private drawChecker(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cell: number): void {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    for (let yy = 0; yy * cell < h; yy++) {
      for (let xx = 0; xx * cell < w; xx++) {
        ctx.fillStyle = (xx + yy) % 2 ? 'rgba(128,128,128,0.22)' : 'rgba(128,128,128,0.10)';
        ctx.fillRect(x + xx * cell, y + yy * cell, cell, cell);
      }
    }
    ctx.restore();
  }

  private drawFlat(): void {
    if (this.mode !== 'flat') {
      if (this.cubeFallback) this.drawIsoFallback();
      return;
    }
    const ctx = this.flat.getContext('2d');
    if (!ctx) return;
    const W = this.flat.width;
    const H = this.flat.height;
    ctx.clearRect(0, 0, W, H);
    const img = this.flatImage;
    if (!img) return;
    if (!this.flatCanvas) this.flatCanvas = this.sourceCanvas(img);
    const frames = this.frametime > 0 ? stripFrames(img) : 1;
    const fw = img.width;
    const fh = frames > 1 ? img.width : img.height;
    const frame = frames > 1 ? Math.max(0, this.lastFrame) % frames : 0;
    let scale = Math.min((W * 0.84) / fw, (H * 0.84) / fh);
    if (scale >= 1) scale = Math.floor(scale);
    const dw = Math.max(1, Math.round(fw * scale));
    const dh = Math.max(1, Math.round(fh * scale));
    const x = Math.round((W - dw) / 2);
    const y = Math.round((H - dh) / 2);
    const dpr = W / Math.max(1, this.cssW);
    this.drawChecker(ctx, x, y, dw, dh, Math.max(4, Math.round(8 * dpr)));
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.flatCanvas, 0, frame * fh, fw, fh, x, y, dw, dh);
  }

  /** 2D isometric cube used when WebGL is unavailable; same faces and orientation as the default 3D view. */
  private drawIsoFallback(): void {
    const faces = this.cubeFallback;
    const ctx = this.flat.getContext('2d');
    if (!faces || !ctx) return;
    const W = this.flat.width;
    const H = this.flat.height;
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    const s = Math.min(W, H) * 0.3;
    const cx = W / 2;
    const cy = H / 2;
    const draw = (c: HTMLCanvasElement | undefined, a: number, b: number, cc: number, d: number, e: number, f: number, shade = 0) => {
      if (!c) return;
      ctx.save();
      ctx.setTransform(a / c.width, b / c.width, cc / c.height, d / c.height, e, f);
      ctx.drawImage(c, 0, 0);
      if (shade > 0) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = `rgba(0,0,0,${shade})`;
        ctx.fillRect(0, 0, c.width, c.height);
      }
      ctx.restore();
    };
    const hx = s * 0.866;
    const hy = s * 0.5;
    // Default view looks from north-east: east face on the left, north face on the right, and the top
    // texture's north-west corner at the right-hand vertex.
    draw(faces.up, -hx, hy, -hx, -hy, cx + hx, cy - hy);
    draw(faces.east, hx, hy, 0, s, cx - hx, cy - hy, 0.2);
    draw(faces.north, hx, -hy, 0, s, cx, cy, 0.35);
  }

  setAutoRotate(v: boolean): void {
    this.orbit.autoRotate = v;
    this.loop.invalidate();
  }

  resetView(): void {
    this.orbit.reset();
    this.loop.invalidate();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    const c = this.stage.canvas;
    c.removeEventListener('pointermove', this.onPointerMove);
    c.removeEventListener('pointerdown', this.onPointerDown);
    c.removeEventListener('pointerup', this.onPointerUp);
    c.removeEventListener('pointerleave', this.onPointerLeave);
    c.removeEventListener('pointercancel', this.onPaintUp);
    c.removeEventListener('lostpointercapture', this.onLostCapture);
    c.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('keydown', this.onHeldKey);
    window.removeEventListener('keyup', this.onHeldKey);
    window.removeEventListener('blur', this.onWindowBlur);
    if (this.paintHoverRaf) cancelAnimationFrame(this.paintHoverRaf);
    this.loop.dispose();
    this.orbit.dispose();
    this.clearCube();
    this.geometry.dispose();
    if (this.shadow) {
      this.shadow.geometry.dispose();
      (this.shadow.material as THREE.Material).dispose();
    }
    if (this.renderer) {
      this.stage.canvas.removeEventListener('webglcontextlost', this.onLost);
      this.stage.canvas.removeEventListener('webglcontextrestored', this.onRestored);
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    }
    this.stage.root.remove();
  }
}

/** Creates the preview inside `container` (fills it; give the container a size). */
export function createBlockPreview(container: HTMLElement, opts: BlockPreviewOptions = {}): BlockPreview {
  return new BlockPreviewImpl(container, opts);
}
