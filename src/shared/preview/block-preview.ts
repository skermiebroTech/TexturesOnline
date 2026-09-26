// Rotating 3D block preview (per-face textures, Minecraft UV orientation) with a crisp flat mode for
// items / GUI textures. Transparent background.

import * as THREE from 'three';
import { alphaMode, makePixelTexture, stripFrames, type PixelImage } from './three-utils';
import { createStage, OrbitController, prefersReducedMotion, ViewportLoop } from './viewport';

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
  private mode: 'empty' | 'cube' | 'flat' = 'empty';
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
  }

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

  private clearCube(): void {
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
    } else if (this.mode === 'cube' && this.renderer.getContext().isContextLost()) {
      return false; // resumes from onRestored
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

  private renderCube(): void {
    if (!this.renderer) return;
    const off = this.orbit.offset();
    this.camera.position.set(off[0], off[1], off[2]);
    this.camera.lookAt(0, 0, 0);
    this.renderer.render(this.scene, this.camera);
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
