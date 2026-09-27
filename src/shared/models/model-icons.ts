// Inventory-style icons of block models: one shared off-screen WebGL renderer draws a model with an
// orthographic camera at the game's inventory angle (30 degrees down, north-east corner) and hands back
// a small 2D canvas. Returns null when WebGL isn't available (callers fall back to a flat texture).

import * as THREE from 'three';
import { ModelMesh } from './model-mesh';
import type { ModelScene } from '../preview/block-preview';

export class ModelIconRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer | null;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
  private readonly mesh = new ModelMesh();
  private readonly pivot = new THREE.Group();
  private disposed = false;

  constructor(readonly size = 96) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = size;
    this.canvas.height = size;
    let r: THREE.WebGLRenderer | null = null;
    try {
      r = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true, preserveDrawingBuffer: true, premultipliedAlpha: true });
      r.setClearColor(0x000000, 0);
      r.toneMapping = THREE.NoToneMapping;
      r.setPixelRatio(1);
      r.setSize(size, size, false);
    } catch {
      r = null;
    }
    this.renderer = r;
    this.pivot.add(this.mesh.group);
    this.scene.add(this.pivot);
  }

  get available(): boolean {
    return !!this.renderer && !this.disposed;
  }

  /** Draws a model and returns a copy of the picture (null without WebGL or quads). */
  render(model: ModelScene): HTMLCanvasElement | null {
    const r = this.renderer;
    if (!r || this.disposed || !model.quads.length) return null;
    if (r.getContext().isContextLost()) return null;
    this.mesh.build(model.quads, model.textures, model.tint);
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const q of model.quads)
      for (const p of q.positions)
        for (let i = 0; i < 3; i++) {
          min[i] = Math.min(min[i], p[i]);
          max[i] = Math.max(max[i], p[i]);
        }
    const c = min.map((v, i) => (v + max[i]) / 2);
    this.mesh.group.position.set(-c[0], -c[1], -c[2]);
    // Fit the bounding box (projected at the inventory angle) with a small margin, like a full block.
    const ext = Math.max(1, max[0] - min[0], max[1] - min[1], max[2] - min[2]);
    const half = 0.9 * ext;
    this.camera.left = -half;
    this.camera.right = half;
    this.camera.top = half;
    this.camera.bottom = -half;
    const az = (3 * Math.PI) / 4;
    const el = Math.PI / 6;
    const d = 6;
    this.camera.position.set(Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
    r.render(this.scene, this.camera);
    const out = document.createElement('canvas');
    out.width = this.size;
    out.height = this.size;
    out.getContext('2d')?.drawImage(this.canvas, 0, 0);
    this.mesh.clear();
    return out;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mesh.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
  }
}
