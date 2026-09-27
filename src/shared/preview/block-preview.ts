// Rotating 3D block preview (per-face textures, Minecraft UV orientation) with a crisp flat mode for
// items / GUI textures. Transparent background.

import * as THREE from 'three';
import { alphaMode, makePixelTexture, stripFrames, type PixelImage } from './three-utils';
import { createStage, OrbitController, prefersReducedMotion, ViewportLoop } from './viewport';
import { ModelMesh, type ModelHit, type ModelTextureImage } from '../models/model-mesh';
import type { BakedQuad, RGB, Tint } from '../models/geometry';

export type { ModelHit, ModelTextureImage } from '../models/model-mesh';

/** Baked model quads plus the (pack) images of every texture they use. */
export interface ModelScene {
  quads: BakedQuad[];
  textures: Map<string, ModelTextureImage>;
  /** Colour of a biome / fixed tint */
  tint: (t: Tint) => RGB;
}

export interface ModelShowOptions {
  /** 'block' looks at the north-east corner like the inventory; 'item' at the front (south) of a flat item */
  view?: 'block' | 'item';
  /** Keep the camera where the user left it (e.g. when only the block state changed) */
  keepView?: boolean;
}

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
const CLICK_SLOP = 6;

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

  constructor(container: HTMLElement, opts: BlockPreviewOptions) {
    this.stage = createStage(container, 'Block preview. Drag or use the arrow keys to rotate, scroll to zoom, double-click or press Home to reset.');
    this.stage.root.style.minHeight = '80px';
    this.flat = document.createElement('canvas');
    this.flat.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:none;pointer-events:none;';
    this.flat.setAttribute('role', 'img');
    this.flat.setAttribute('aria-label', 'Texture preview');
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
    if (this.mode !== 'model') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
  };

  private onPointerUp = (e: PointerEvent): void => {
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

  private onPointerLeave = (): void => {
    this.lastPointer = null;
    if (this.mode === 'model') this.setHover(null);
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
    // Frame the model like a unit cube: centred, scaled down when it spans more than one block.
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const q of scene.quads)
      for (const p of q.positions)
        for (let i = 0; i < 3; i++) {
          min[i] = Math.min(min[i], p[i]);
          max[i] = Math.max(max[i], p[i]);
        }
    if (!scene.quads.length) {
      min.fill(0);
      max.fill(1);
    }
    // Always frame at least the block cell(s) the model sits in, so small models keep their size.
    // (elements may poke a little outside their block, like a wall torch's base: that isn't another block)
    const cellMin = min.map((v, i) => Math.min(Math.floor(v + 0.3), Math.floor(max[i] - 1e-4)));
    const cellMax = max.map((v, i) => Math.max(cellMin[i] + 1, Math.ceil(v - 0.3)));
    const fmin = cellMin.map((v, i) => Math.min(v, min[i]));
    const fmax = cellMax.map((v, i) => Math.max(v, max[i]));
    const center = fmin.map((v, i) => (v + fmax[i]) / 2);
    const extent = Math.max(fmax[0] - fmin[0], fmax[1] - fmin[1], fmax[2] - fmin[2]);
    const scale = 1 / Math.max(1, extent);
    const pivot = new THREE.Group();
    mesh.group.position.set(-center[0], -center[1], -center[2]);
    pivot.add(mesh.group);
    pivot.scale.setScalar(scale);
    // Faint outline of the block cells when the model doesn't fill them (torches, flowers, fences...).
    const fills = scene.quads.length > 0 && [0, 1, 2].every((i) => Math.abs(min[i] - cellMin[i]) < 1e-3 && Math.abs(max[i] - cellMax[i]) < 1e-3);
    if (!fills && opts.view !== 'item') {
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
    if (!opts.keepView) this.orbit.setHome(opts.view === 'item' ? ITEM_VIEW : DEFAULT_VIEW);
    this.loop.invalidate();
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
