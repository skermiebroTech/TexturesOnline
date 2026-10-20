// 3D view of the model editor. Edit mode: the model (drawn by the shared ModelMesh from baked quads)
// on a 16 x 16 grid with the block's outline and a north marker, the selected cube outlined, and move
// arrows or resize knobs to drag (the camera turns with a drag elsewhere, the wheel or a pinch zooms).
// Display mode: the model posed by a display transform the way the game poses it (ItemTransform:
// translate, rotate X then Y then Z, scale, then the -0.5 offset) in a small scene for each slot: an
// inventory slot, the first-person view, a player holding it, on the ground, in an item frame, on a head.

import * as THREE from 'three';
import { createStage, OrbitController, ViewportLoop } from '../../../../shared/preview/viewport';
import { ModelMesh, type ModelTextureImage } from '../../../../shared/models/model-mesh';
import { bakeModel, type DisplayTransform, type ResolvedModel } from '../../../../shared/models/java-models';
import type { BakedQuad, Dir, RGB, Tint } from '../../../../shared/models/geometry';
import type { EditElement } from '../../models/doc';
import { tm } from '../i18n/model-editor';

export type Tool = 'move' | 'resize';
export type CameraView = 'front' | 'back' | 'left' | 'right' | 'top';

export interface ViewportHandlers {
  /** A cube (and the face clicked) was picked; null: the background */
  select(element: number | null, face: Dir | null): void;
  /** A handle drag started */
  dragStart(): void;
  /** Handle drag: `delta` is the distance along the axis in model units (1/16 block), not snapped */
  drag(tool: Tool, axis: 0 | 1 | 2, side: 1 | -1, delta: number): void;
  dragEnd(commit: boolean): void;
}

const AXIS_COLORS = [0xff5b5b, 0x5bd35b, 0x4fb3ff];
const EDIT_VIEW = { azimuth: (3 * Math.PI) / 4 + 0.35, elevation: 0.5, distance: 3.2 };
const CLICK_SLOP = 6;

interface HandleInfo {
  tool: Tool;
  axis: 0 | 1 | 2;
  side: 1 | -1;
}

interface Drag {
  id: number;
  info: HandleInfo;
  /** World point the handle sat at and the world axis */
  origin: THREE.Vector3;
  dir: THREE.Vector3;
  start: number;
}

/** Matrix of a display transform as ItemTransform.apply builds it (followed by the -0.5 offset). */
export function displayMatrix(t: DisplayTransform | null | undefined): THREE.Matrix4 {
  const m = new THREE.Matrix4();
  if (t) {
    const c = (v: number, lim: number) => Math.max(-lim, Math.min(lim, v));
    m.makeTranslation(c(t.translation[0] / 16, 5), c(t.translation[1] / 16, 5), c(t.translation[2] / 16, 5));
    const d = Math.PI / 180;
    m.multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(t.rotation[0] * d, t.rotation[1] * d, t.rotation[2] * d, 'XYZ')));
    m.multiply(new THREE.Matrix4().makeScale(c(t.scale[0], 4), c(t.scale[1], 4), c(t.scale[2], 4)));
  }
  return m.multiply(new THREE.Matrix4().makeTranslation(-0.5, -0.5, -0.5));
}

const T = (x: number, y: number, z: number) => new THREE.Matrix4().makeTranslation(x, y, z);
const S = (x: number, y: number, z: number) => new THREE.Matrix4().makeScale(x, y, z);
const RX = (deg: number) => new THREE.Matrix4().makeRotationX((deg * Math.PI) / 180);
const RY = (deg: number) => new THREE.Matrix4().makeRotationY((deg * Math.PI) / 180);
const chain = (...ms: THREE.Matrix4[]) => ms.reduce((a, b) => a.multiply(b), new THREE.Matrix4());

/** ModelPart.translateAndRotate: pivot in pixels, then rotation Z * Y * X (radians). */
const part = (x: number, y: number, z: number, xr = 0, yr = 0, zr = 0) =>
  T(x / 16, y / 16, z / 16).multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(xr, yr, zr, 'ZYX')));

/** A living entity's model space (y down, facing +z in the world), as LivingEntityRenderer sets it up. */
const ENTITY_ROOT = () => chain(RY(180), S(-1, -1, 1), T(0, -1.501, 0));
const RIGHT_ARM_X = -Math.PI / 10;

function shadedBox(w: number, h: number, d: number, color: number): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  const n = geo.getAttribute('normal');
  const colors = new Float32Array(n.count * 3);
  const base = new THREE.Color(color);
  for (let i = 0; i < n.count; i++) {
    const x = n.getX(i);
    const y = n.getY(i);
    const z = n.getZ(i);
    const k = x * x * 0.6 + z * z * 0.8 + y * y * (y > 0 ? 1 : 0.5);
    colors.set([base.r * k, base.g * k, base.b * k], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }));
}

/** A box in entity pixels (from + size) under a part's pose. */
function entityBox(pose: THREE.Matrix4, from: [number, number, number], size: [number, number, number], color: number): THREE.Mesh {
  const m = shadedBox(size[0] / 16, size[1] / 16, size[2] / 16, color);
  m.matrixAutoUpdate = false;
  m.matrix.copy(pose).multiply(T((from[0] + size[0] / 2) / 16, (from[1] + size[1] / 2) / 16, (from[2] + size[2] / 2) / 16));
  return m;
}

function slotTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 18;
  c.height = 18;
  const g = c.getContext('2d')!;
  g.fillStyle = '#c6c6c6';
  g.fillRect(0, 0, 18, 18);
  g.fillStyle = '#373737';
  g.fillRect(0, 0, 17, 1);
  g.fillRect(0, 0, 1, 17);
  g.fillStyle = '#ffffff';
  g.fillRect(1, 17, 17, 1);
  g.fillRect(17, 1, 1, 17);
  g.fillStyle = '#8b8b8b';
  g.fillRect(1, 1, 16, 16);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  return t;
}

function labelTexture(text: string, color: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.font = 'bold 44px Texel, ui-monospace, monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = color;
  g.fillText(text, 32, 34);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  return t;
}

export class ModelEditorViewport {
  readonly root: HTMLDivElement;
  private readonly stage: ReturnType<typeof createStage>;
  private readonly renderer: THREE.WebGLRenderer | null;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(32, 1, 0.02, 80);
  private readonly ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
  private readonly loop: ViewportLoop;
  private readonly orbit: OrbitController;
  private readonly mesh = new ModelMesh();
  /** Model space (block units, 0..1) placed so the block's centre is the world origin */
  private readonly modelRoot = new THREE.Group();
  private readonly editRoot = new THREE.Group();
  private readonly displayRoot = new THREE.Group();
  private readonly selection = new THREE.Group();
  private readonly handles = new THREE.Group();
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private readonly disposables: { dispose(): void }[] = [];
  private tool: Tool = 'move';
  private selected: { index: number; el: EditElement } | null = null;
  private drag: Drag | null = null;
  private down: { x: number; y: number; id: number } | null = null;
  private hoverHandle: THREE.Object3D | null = null;
  private display: { slot: string; t: DisplayTransform | null } | null = null;
  private animTime = 0;
  private destroyed = false;
  private cssW = 1;
  private cssH = 1;
  private readonly handlers: ViewportHandlers;

  constructor(container: HTMLElement, handlers: ViewportHandlers) {
    this.handlers = handlers;
    this.stage = createStage(container, tm.stage3d);
    this.root = this.stage.root;
    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: this.stage.canvas, alpha: true, antialias: true, premultipliedAlpha: true });
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.NoToneMapping;
      // colours as given (the model's shader writes them as they are too)
      renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    } catch {
      renderer = null;
    }
    this.renderer = renderer;
    if (!renderer) this.stage.message('3D isn’t available in this browser, so the model can’t be shown. You can still edit it with the fields.');
    this.scene.add(this.editRoot, this.displayRoot);
    this.modelRoot.add(this.mesh.group);
    this.modelRoot.position.set(-0.5, -0.5, -0.5);
    this.editRoot.add(this.modelRoot);
    this.modelRoot.add(this.selection);
    this.scene.add(this.handles);
    this.buildGrid();
    const c = this.stage.canvas;
    // Handles take the press before the orbit controller sees it (registered first).
    c.addEventListener('pointerdown', this.onDown);
    c.addEventListener('pointermove', this.onMove);
    c.addEventListener('pointerup', this.onUp);
    c.addEventListener('pointercancel', this.onCancel);
    c.addEventListener('lostpointercapture', this.onCancel);
    c.addEventListener('pointerleave', this.onLeave);
    this.orbit = new OrbitController(c, { ...EDIT_VIEW, minDistance: 0.6, maxDistance: 12, minElevation: -1.45, maxElevation: 1.45, autoRotate: false, onChange: () => this.loop?.invalidate() });
    this.loop = new ViewportLoop(this.root, { frame: (dt) => this.frame(dt), resize: (w, h) => this.resize(w, h) });
    if (renderer) {
      c.addEventListener('webglcontextlost', this.onLost);
      c.addEventListener('webglcontextrestored', this.onRestored);
    }
  }

  // ------------------------------------------------------------------ scene

  private buildGrid(): void {
    const fine: number[] = [];
    for (let i = 0; i <= 16; i++) {
      const v = i / 16;
      fine.push(v, 0, 0, v, 0, 1, 0, 0, v, 1, 0, v);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(fine, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0x8a93a6, transparent: true, opacity: 0.22, depthWrite: false });
    const grid = new THREE.LineSegments(geo, mat);
    // the 3 x 3 blocks around, fainter
    const wide: number[] = [];
    for (let i = -1; i <= 2; i++) wide.push(i, 0, -1, i, 0, 2, -1, 0, i, 2, 0, i);
    const geo2 = new THREE.BufferGeometry();
    geo2.setAttribute('position', new THREE.Float32BufferAttribute(wide, 3));
    const mat2 = new THREE.LineBasicMaterial({ color: 0x8a93a6, transparent: true, opacity: 0.12, depthWrite: false });
    const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: 0x8a93a6, transparent: true, opacity: 0.3, depthWrite: false }));
    box.position.set(0.5, 0.5, 0.5);
    const northTex = labelTexture('N', '#8a93a6');
    const north = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), new THREE.MeshBasicMaterial({ map: northTex, transparent: true, depthWrite: false }));
    north.rotation.set(-Math.PI / 2, 0, Math.PI);
    north.position.set(0.5, 0.001, -0.12);
    const grids = new THREE.Group();
    grids.add(grid, new THREE.LineSegments(geo2, mat2), box, north);
    grids.renderOrder = -1;
    this.modelRoot.add(grids);
    this.disposables.push(geo, mat, geo2, mat2, box.geometry, box.material as THREE.Material, northTex, north.geometry, north.material as THREE.Material);
  }

  /** Shows baked quads with their textures. */
  setModel(quads: BakedQuad[], textures: Map<string, ModelTextureImage>, tint: (t: Tint) => RGB): void {
    this.mesh.build(quads, textures, tint);
    const accent = getComputedStyle(this.root).getPropertyValue('--tool-accent').trim();
    if (accent) this.mesh.setAccent(accent);
    this.loop.invalidate();
  }

  updateTexture(path: string, tex: ModelTextureImage): void {
    if (this.mesh.updateTexture(path, tex)) this.loop.invalidate();
  }

  setTool(t: Tool): void {
    this.tool = t;
    this.buildHandles();
  }

  /** Outlines a cube and puts the handles on it (null: none). */
  setSelection(index: number | null, el: EditElement | null): void {
    this.selected = index !== null && el ? { index, el } : null;
    this.buildSelection();
    this.buildHandles();
  }

  /** Highlights a face of the selected cube (by its baked quad index; -1 none). */
  highlightQuad(index: number): void {
    this.mesh.highlight(null, index);
    this.loop.invalidate();
  }

  private clearGroup(g: THREE.Group): void {
    for (const ch of [...g.children]) {
      g.remove(ch);
      ch.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
    }
  }

  private buildSelection(): void {
    this.clearGroup(this.selection);
    const s = this.selected;
    if (!s) {
      this.loop.invalidate();
      return;
    }
    // the cube's own corners through the same baking as the model (rotation and rescale included)
    const faces = Object.fromEntries((['down', 'up', 'north', 'south', 'west', 'east'] as Dir[]).map((d) => [d, { texture: '#x' }]));
    const model: ResolvedModel = { id: 'sel', chain: [], textures: { x: 'x' }, translucent: [], elements: [{ from: s.el.from, to: s.el.to, rotation: s.el.rotation, faces }], builtin: null, ambientOcclusion: true, missing: [] };
    const quads = bakeModel(model, { texturePath: (r) => r });
    const pts: number[] = [];
    for (const q of quads)
      for (let i = 0; i < 4; i++) {
        const a = q.positions[i];
        const b = q.positions[(i + 1) % 4];
        pts.push(...a, ...b);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const accent = getComputedStyle(this.root).getPropertyValue('--tool-accent').trim() || '#5bd35b';
    const front = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: new THREE.Color(accent), depthTest: true }));
    const behind = new THREE.LineSegments(geo.clone(), new THREE.LineBasicMaterial({ color: new THREE.Color(accent), transparent: true, opacity: 0.35, depthTest: false }));
    behind.renderOrder = 5;
    this.selection.add(front, behind);
    this.loop.invalidate();
  }

  private handleAnchor(info: HandleInfo): THREE.Vector3 | null {
    const s = this.selected;
    if (!s) return null;
    const c = [0, 1, 2].map((a) => (s.el.from[a] + s.el.to[a]) / 32);
    if (info.tool === 'resize') c[info.axis] = (info.side > 0 ? s.el.to[info.axis] : s.el.from[info.axis]) / 16;
    return new THREE.Vector3(c[0] - 0.5, c[1] - 0.5, c[2] - 0.5);
  }

  private buildHandles(): void {
    this.clearGroup(this.handles);
    this.hoverHandle = null;
    if (!this.selected || this.display) {
      this.loop.invalidate();
      return;
    }
    const mk = (info: HandleInfo, geo: THREE.BufferGeometry, color: number, at: THREE.Vector3, rot?: THREE.Euler) => {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.95 }));
      m.position.copy(at);
      if (rot) m.rotation.copy(rot);
      m.renderOrder = 10;
      m.userData.handle = info;
      m.userData.color = color;
      this.handles.add(m);
      return m;
    };
    for (const axis of [0, 1, 2] as const) {
      const color = AXIS_COLORS[axis];
      if (this.tool === 'move') {
        const info: HandleInfo = { tool: 'move', axis, side: 1 };
        const at = this.handleAnchor(info)!;
        // shaft + head along +axis, sized each frame to stay the same on screen
        const g = new THREE.Group();
        g.position.copy(at);
        g.userData.scaled = true;
        const dir = new THREE.Vector3(axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, axis === 2 ? 1 : 0);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.36, 8), new THREE.MeshBasicMaterial({ color, depthTest: false }));
        shaft.position.copy(dir.clone().multiplyScalar(0.18 + 0.06));
        shaft.quaternion.copy(q);
        const head = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 12), new THREE.MeshBasicMaterial({ color, depthTest: false }));
        head.position.copy(dir.clone().multiplyScalar(0.48));
        head.quaternion.copy(q);
        // a thicker invisible grip makes it easy to catch
        const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8), new THREE.MeshBasicMaterial({ visible: false }));
        grip.position.copy(dir.clone().multiplyScalar(0.3));
        grip.quaternion.copy(q);
        for (const m of [shaft, head, grip]) {
          m.renderOrder = 10;
          m.userData.handle = info;
          m.userData.color = color;
        }
        g.add(shaft, head, grip);
        this.handles.add(g);
      } else {
        for (const side of [1, -1] as const) {
          const info: HandleInfo = { tool: 'resize', axis, side };
          const m = mk(info, new THREE.BoxGeometry(0.07, 0.07, 0.07), color, this.handleAnchor(info)!);
          m.userData.scaled = true;
        }
      }
    }
    this.loop.invalidate();
  }

  /** Keeps handles the same size on screen. */
  private scaleHandles(): void {
    const d = this.orbit.distance;
    const k = Math.max(0.25, d / 3.2);
    for (const h of this.handles.children) if (h.userData.scaled) h.scale.setScalar(k);
  }

  // ------------------------------------------------------------------ display mode

  /**
   * Poses the model as the game shows it in a display slot ('gui', 'firstperson_righthand',
   * 'thirdperson_righthand', 'ground', 'fixed', 'head'; 1.8's 'firstperson' / 'thirdperson' too), or
   * back to editing (null).
   */
  setDisplay(slot: string | null, t: DisplayTransform | null = null): void {
    const was = this.display?.slot ?? null;
    this.display = slot ? { slot, t } : null;
    // the model goes back home before the slot's props are thrown away
    this.modelRoot.add(this.mesh.group);
    this.clearGroup(this.displayRoot);
    if (!slot) {
      this.mesh.group.matrixAutoUpdate = true;
      this.mesh.group.position.set(0, 0, 0);
      this.mesh.group.updateMatrix();
      this.editRoot.visible = true;
      this.orbit.pointerEnabled = true;
      if (was) this.orbit.setHome(EDIT_VIEW);
      this.buildHandles();
      return;
    }
    this.editRoot.visible = false;
    this.buildHandles();
    const holder = new THREE.Group();
    holder.matrixAutoUpdate = false;
    this.displayRoot.add(holder);
    holder.add(this.mesh.group);
    this.mesh.group.matrixAutoUpdate = false;
    this.mesh.group.matrix.identity();
    const kind = slot.replace(/_(right|left)hand$/, '');
    if (kind === 'thirdperson' || kind === 'head') this.addPlayer(kind === 'thirdperson');
    if (kind === 'ground') {
      // the top of a grass block
      const top = shadedBox(1, 0.12, 1, 0x6aa84f);
      top.position.set(0, -0.06, 0);
      const soil = shadedBox(1, 0.5, 1, 0x86603e);
      soil.position.set(0, -0.37, 0);
      this.displayRoot.add(top, soil);
    }
    if (kind === 'fixed') {
      const wall = shadedBox(1.6, 1.6, 0.05, 0x8d7b63);
      wall.position.set(0, 0, -0.025);
      const frame = shadedBox(12 / 16, 12 / 16, 1 / 16, 0xa0774a);
      frame.position.set(0, 0, 1 / 32);
      const inner = shadedBox(10 / 16, 10 / 16, 1 / 16, 0x6f4f2c);
      inner.position.set(0, 0, 1 / 32 + 0.002);
      this.displayRoot.add(wall, frame, inner);
    }
    if (kind === 'gui') {
      const tex = slotTexture();
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(18 / 16, 18 / 16), new THREE.MeshBasicMaterial({ map: tex }));
      plane.position.z = -20;
      this.displayRoot.add(plane);
      this.disposables.push(tex);
    }
    this.orbit.pointerEnabled = kind !== 'gui' && kind !== 'firstperson';
    if (was?.replace(/_(right|left)hand$/, '') !== kind) {
      const home =
        kind === 'thirdperson'
          ? { azimuth: -0.75, elevation: 0.2, distance: 3.6 }
          : kind === 'head'
            ? { azimuth: 0.6, elevation: 0.3, distance: 2.4 }
            : kind === 'ground'
              ? { azimuth: 0.6, elevation: 0.5, distance: 2.6 }
              : kind === 'fixed'
                ? { azimuth: 0.35, elevation: 0.15, distance: 1.9 }
                : EDIT_VIEW;
      this.orbit.setHome(home);
    }
    this.poseDisplay();
  }

  /** A blocky player (Steve's colours) in entity space. */
  private addPlayer(full: boolean): void {
    const root = ENTITY_ROOT();
    const skin = 0xc69c7a;
    const shirt = 0x2fa6a6;
    const pants = 0x3b3f9a;
    const hair = 0x4a3222;
    const add = (pose: THREE.Matrix4, from: [number, number, number], size: [number, number, number], color: number) => this.displayRoot.add(entityBox(pose, from, size, color));
    const head = root.clone().multiply(part(0, 0, 0));
    add(head, [-4, -8, -4], [8, 8, 8], skin);
    add(head, [-4.05, -8.05, -1], [8.1, 3, 5.1], hair);
    add(root.clone().multiply(part(0, 0, 0)), [-4, 0, -2], [8, 12, 4], shirt);
    if (!full) return;
    add(root.clone().multiply(part(-5, 2, 0, RIGHT_ARM_X)), [-3, -2, -2], [4, 12, 4], skin);
    add(root.clone().multiply(part(-5, 2, 0, RIGHT_ARM_X)), [-3.05, -2.05, -2.05], [4.1, 5, 4.1], shirt);
    add(root.clone().multiply(part(5, 2, 0)), [-1, -2, -2], [4, 12, 4], skin);
    add(root.clone().multiply(part(5, 2, 0)), [-1.05, -2.05, -2.05], [4.1, 5, 4.1], shirt);
    add(root.clone().multiply(part(-1.9, 12, 0)), [-2, 0, -2], [4, 12, 4], pants);
    add(root.clone().multiply(part(1.9, 12, 0)), [-2, 0, -2], [4, 12, 4], pants);
  }

  /** Where the model sits for the slot on show (ground items spin and bob). */
  private poseDisplay(fromFrame = false): void {
    const d = this.display;
    if (!d) return;
    const holder = this.mesh.group.parent;
    if (!holder) return;
    const kind = d.slot.replace(/_(right|left)hand$/, '');
    const item = displayMatrix(d.t);
    let m: THREE.Matrix4;
    switch (kind) {
      case 'firstperson':
        // ItemInHandRenderer.applyItemArmTransform (right hand, fully raised)
        m = chain(T(0.56, -0.52, -0.72), item);
        break;
      case 'thirdperson':
        // the right arm, then ItemInHandLayer: X -90, Y 180, (1/16, 2/16, -10/16)
        m = chain(ENTITY_ROOT(), part(-5, 2, 0, RIGHT_ARM_X), RX(-90), RY(180), T(1 / 16, 2 / 16, -10 / 16), item);
        break;
      case 'head':
        // CustomHeadLayer.translateToHead
        m = chain(ENTITY_ROOT(), part(0, 0, 0), T(0, -0.25, 0), RY(180), S(0.625, -0.625, -0.625), item);
        break;
      case 'ground': {
        const bob = Math.sin(this.animTime * 2) * 0.1 + 0.1;
        const sy = d.t ? Math.max(-4, Math.min(4, d.t.scale[1])) : 1;
        m = chain(T(0, bob + 0.25 * sy, 0), new THREE.Matrix4().makeRotationY(this.animTime * 0.9), item);
        break;
      }
      case 'fixed':
        m = chain(T(0, 0, 1 / 16 + 0.01), RY(180), S(0.5, 0.5, 0.5), item);
        break;
      default:
        m = item;
    }
    holder.matrix.copy(m);
    holder.matrixWorldNeedsUpdate = true;
    if (!fromFrame) this.loop.invalidate();
  }

  updateDisplay(t: DisplayTransform | null): void {
    if (!this.display) return;
    this.display.t = t;
    this.poseDisplay();
  }

  // ------------------------------------------------------------------ camera

  setCameraView(v: CameraView): void {
    const el = v === 'top' ? 1.4 : 0.12;
    const az = v === 'front' ? Math.PI : v === 'back' ? 0 : v === 'left' ? -Math.PI / 2 : v === 'right' ? Math.PI / 2 : this.orbit.azimuth;
    this.orbit.turnTo(az, el);
  }

  resetView(): void {
    this.orbit.reset();
  }

  // ------------------------------------------------------------------ pointer

  private setNdc(x: number, y: number): boolean {
    const r = this.stage.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    this.ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    return true;
  }

  private ray(x: number, y: number): boolean {
    if (!this.setNdc(x, y)) return false;
    this.syncCamera();
    this.scene.updateMatrixWorld(true);
    this.raycaster.setFromCamera(this.ndc, this.activeCamera());
    return true;
  }

  private handleAt(x: number, y: number): THREE.Object3D | null {
    if (!this.handles.children.length || !this.ray(x, y)) return null;
    const hits = this.raycaster.intersectObjects(this.handles.children, true);
    return hits.find((h) => h.object.userData.handle)?.object ?? null;
  }

  private onDown = (e: PointerEvent): void => {
    if (this.display || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const h = this.handleAt(e.clientX, e.clientY);
    if (h) {
      e.stopImmediatePropagation();
      e.preventDefault();
      const info = h.userData.handle as HandleInfo;
      const anchor = this.handleAnchor(info)!;
      const dir = new THREE.Vector3(info.axis === 0 ? 1 : 0, info.axis === 1 ? 1 : 0, info.axis === 2 ? 1 : 0);
      this.drag = { id: e.pointerId, info, origin: anchor, dir, start: 0 };
      this.drag.start = this.axisParam(e.clientX, e.clientY) ?? 0;
      try {
        this.stage.canvas.setPointerCapture(e.pointerId);
      } catch {
        /* best effort */
      }
      this.stage.canvas.style.cursor = 'grabbing';
      this.handlers.dragStart();
      return;
    }
    this.down = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };

  /** Where the pointer ray passes closest to the drag axis (distance along it from the anchor, world units). */
  private axisParam(x: number, y: number): number | null {
    const d = this.drag;
    if (!d || !this.ray(x, y)) return null;
    const r = this.raycaster.ray;
    const w0 = d.origin.clone().sub(r.origin);
    const a = d.dir.dot(d.dir);
    const b = d.dir.dot(r.direction);
    const c = r.direction.dot(r.direction);
    const dd = d.dir.dot(w0);
    const ee = r.direction.dot(w0);
    const den = a * c - b * b;
    if (Math.abs(den) < 1e-6) return null;
    return (b * ee - c * dd) / den;
  }

  private onMove = (e: PointerEvent): void => {
    const d = this.drag;
    if (d && e.pointerId === d.id) {
      const t = this.axisParam(e.clientX, e.clientY);
      if (t !== null) this.handlers.drag(d.info.tool, d.info.axis, d.info.side, (t - d.start) * 16);
      return;
    }
    if (e.pointerType === 'touch' || this.display) return;
    const h = this.down ? null : this.handleAt(e.clientX, e.clientY);
    if (h !== this.hoverHandle) {
      this.hoverHandle = h;
      for (const o of this.handles.children) o.traverse((m) => {
        const mat = (m as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
        if (mat && m.userData.color !== undefined && mat.visible !== false) mat.color.setHex(h && h.userData.handle === m.userData.handle ? 0xffffff : m.userData.color);
      });
      this.stage.canvas.style.cursor = h ? 'pointer' : 'grab';
      this.loop.invalidate();
    }
  };

  private onUp = (e: PointerEvent): void => {
    const d = this.drag;
    if (d && e.pointerId === d.id) {
      this.drag = null;
      this.stage.canvas.style.cursor = 'grab';
      this.handlers.dragEnd(true);
      return;
    }
    const dn = this.down;
    this.down = null;
    if (!dn || dn.id !== e.pointerId || this.display) return;
    if (Math.hypot(e.clientX - dn.x, e.clientY - dn.y) > CLICK_SLOP) return;
    if (!this.ray(e.clientX, e.clientY)) return;
    const hit = this.mesh.pick(this.raycaster);
    this.handlers.select(hit ? hit.quad.element : null, hit ? hit.quad.dir : null);
  };

  private onCancel = (e: PointerEvent): void => {
    const d = this.drag;
    if (d && e.pointerId === d.id) {
      this.drag = null;
      this.handlers.dragEnd(true);
    }
    if (this.down?.id === e.pointerId) this.down = null;
  };

  private onLeave = (): void => {
    if (this.hoverHandle && !this.drag) {
      this.hoverHandle = null;
      this.buildHandles();
    }
  };

  // ------------------------------------------------------------------ loop

  private activeCamera(): THREE.Camera {
    return this.display?.slot === 'gui' ? this.ortho : this.camera;
  }

  private syncCamera(): void {
    const kind = this.display?.slot.replace(/_(right|left)hand$/, '');
    if (kind === 'gui') {
      this.ortho.position.set(0, 0, 50);
      this.ortho.lookAt(0, 0, 0);
      this.ortho.updateMatrixWorld();
      return;
    }
    if (kind === 'firstperson') {
      this.camera.fov = 70;
      this.camera.aspect = 16 / 9;
      this.camera.updateProjectionMatrix();
      this.camera.position.set(0, 0, 0);
      this.camera.lookAt(0, 0, -1);
      this.camera.updateMatrixWorld();
      return;
    }
    const target = kind === 'thirdperson' ? new THREE.Vector3(-0.2, 1.05, 0) : kind === 'head' ? new THREE.Vector3(0, 1.45, 0) : kind === 'ground' ? new THREE.Vector3(0, 0.2, 0) : new THREE.Vector3(0, 0, 0);
    this.camera.fov = this.cssW < this.cssH ? Math.min(60, (2 * Math.atan(Math.tan((16 * Math.PI) / 180) * (this.cssH / this.cssW)) * 180) / Math.PI) : 32;
    this.camera.aspect = this.cssW / this.cssH;
    this.camera.updateProjectionMatrix();
    const off = this.orbit.offset();
    this.camera.position.set(target.x + off[0], target.y + off[1], target.z + off[2]);
    this.camera.lookAt(target);
    this.camera.updateMatrixWorld();
  }

  private resize(w: number, h: number): void {
    this.cssW = w;
    this.cssH = h;
    if (this.renderer) {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setSize(w, h, false);
    }
    // the inventory slot fills about two thirds of the view
    const k = 0.78 / Math.min(1, w / h);
    const aspect = w / h;
    const half = Math.max(0.9, k);
    this.ortho.left = -half * Math.max(1, aspect);
    this.ortho.right = half * Math.max(1, aspect);
    this.ortho.top = half * Math.max(1, 1 / aspect);
    this.ortho.bottom = -half * Math.max(1, 1 / aspect);
    this.ortho.updateProjectionMatrix();
  }

  private frame(dt: number): boolean {
    if (this.destroyed || !this.renderer) return false;
    if (this.renderer.getContext().isContextLost()) return false;
    const moving = this.orbit.update(dt);
    this.animTime += dt;
    const spinning = this.display?.slot === 'ground';
    if (spinning) this.poseDisplay(true);
    const anim = this.mesh.animate(this.animTime);
    this.scaleHandles();
    this.syncCamera();
    const r = this.renderer;
    if (this.display?.slot.startsWith('firstperson')) {
      // the game's 16:9 screen, letterboxed, with sky behind
      const w = this.cssW;
      const h = this.cssH;
      const sw = Math.min(w, (h * 16) / 9);
      const sh = (sw * 9) / 16;
      const x = (w - sw) / 2;
      const y = (h - sh) / 2;
      r.setScissorTest(false);
      r.setViewport(0, 0, w, h);
      r.clear();
      r.setScissorTest(true);
      r.setScissor(x, y, sw, sh);
      r.setViewport(x, y, sw, sh);
      r.setClearColor(0x7ba4ff, 1);
      r.clear();
      r.render(this.scene, this.camera);
      r.setClearColor(0x000000, 0);
      r.setScissorTest(false);
      r.setViewport(0, 0, w, h);
    } else {
      r.render(this.scene, this.activeCamera());
    }
    return moving || anim || spinning || this.orbit.animating || !!this.drag;
  }

  private onLost = (e: Event): void => e.preventDefault();
  private onRestored = (): void => this.loop.invalidate();

  /** Screen point of a model-space point (block units), for tests. */
  screenPoint(p: [number, number, number]): { x: number; y: number } | null {
    if (!this.renderer) return null;
    this.syncCamera();
    this.scene.updateMatrixWorld(true);
    const v = new THREE.Vector3(...p).applyMatrix4(this.mesh.group.matrixWorld).project(this.activeCamera());
    const r = this.stage.canvas.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  }

  /** Screen point of a handle's tip (tests). */
  handlePoint(tool: Tool, axis: 0 | 1 | 2, side: 1 | -1 = 1): { x: number; y: number } | null {
    const anchor = this.handleAnchor({ tool, axis, side });
    if (!anchor || !this.renderer) return null;
    this.syncCamera();
    this.scaleHandles();
    this.scene.updateMatrixWorld(true);
    const k = Math.max(0.25, this.orbit.distance / 3.2);
    const p = anchor.clone();
    if (tool === 'move') p.setComponent(axis, p.getComponent(axis) + 0.42 * k);
    const v = p.project(this.camera);
    const r = this.stage.canvas.getBoundingClientRect();
    return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    const c = this.stage.canvas;
    c.removeEventListener('pointerdown', this.onDown);
    c.removeEventListener('pointermove', this.onMove);
    c.removeEventListener('pointerup', this.onUp);
    c.removeEventListener('pointercancel', this.onCancel);
    c.removeEventListener('lostpointercapture', this.onCancel);
    c.removeEventListener('pointerleave', this.onLeave);
    this.loop.dispose();
    this.orbit.dispose();
    this.modelRoot.add(this.mesh.group);
    this.clearGroup(this.handles);
    this.clearGroup(this.selection);
    this.clearGroup(this.displayRoot);
    this.mesh.dispose();
    for (const d of this.disposables) d.dispose();
    if (this.renderer) {
      c.removeEventListener('webglcontextlost', this.onLost);
      c.removeEventListener('webglcontextrestored', this.onRestored);
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    }
    this.root.remove();
  }
}
