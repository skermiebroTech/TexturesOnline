// 2D renderings of a skin: a 3/4 "isometric" figure for thumbnails, flat front/back paper dolls and
// a head avatar. Canvas is used for display only; pixels come straight from the ImageData.

import type { SkinModel } from '../../../core/types';
import { boxFaces, partBox, partOrigin, type SkinFace, type SkinLayer, type SkinPart } from '../templates';

type Vec3 = [number, number, number];

interface PartPlacement {
  part: SkinPart;
  x: [number, number];
  y: [number, number];
  z: [number, number];
}

function placements(model: SkinModel): PartPlacement[] {
  const aw = model === 'slim' ? 3 : 4;
  return [
    { part: 'rightArm', x: [-4 - aw, -4], y: [12, 24], z: [-2, 2] },
    { part: 'rightLeg', x: [-4, 0], y: [0, 12], z: [-2, 2] },
    { part: 'leftLeg', x: [0, 4], y: [0, 12], z: [-2, 2] },
    { part: 'body', x: [-4, 4], y: [12, 24], z: [-2, 2] },
    { part: 'leftArm', x: [4, 4 + aw], y: [12, 24], z: [-2, 2] },
    { part: 'head', x: [-4, 4], y: [24, 32], z: [-4, 4] },
  ];
}

function shadedCanvas(img: ImageData, k: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const out = new ImageData(img.width, img.height);
  const s = img.data;
  const d = out.data;
  for (let i = 0; i < s.length; i += 4) {
    d[i] = Math.min(255, s[i] * k);
    d[i + 1] = Math.min(255, s[i + 1] * k);
    d[i + 2] = Math.min(255, s[i + 2] * k);
    d[i + 3] = s[i + 3];
  }
  c.getContext('2d')!.putImageData(out, 0, 0);
  return c;
}

export interface FigureOptions {
  /** Rotation around the vertical axis in radians (negative shows the left side). Default -0.5 */
  yaw?: number;
  /** Look-down angle in radians. Default 0.32 */
  pitch?: number;
  /** Draw the outer layer. Default true */
  outer?: boolean;
  /** Padding in CSS px. Default 8 */
  padding?: number;
  /** Soft ground shadow. Default true */
  shadow?: boolean;
}

/**
 * Draws a 3/4 view of the player (front, one side and top faces) filling the canvas. Size the canvas
 * with CSS; the backing store is set here for the device pixel ratio.
 */
export function drawFigure(canvas: HTMLCanvasElement, img: ImageData, model: SkinModel, opts: FigureOptions = {}): void {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const cssW = canvas.clientWidth || Number(canvas.getAttribute('width')) || 120;
  const cssH = canvas.clientHeight || Number(canvas.getAttribute('height')) || 160;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx || img.width !== 64 || img.height !== 64) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;

  const yaw = opts.yaw ?? -0.5;
  const pitch = opts.pitch ?? 0.32;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const proj = (v: Vec3): [number, number] => {
    const x = v[0] * cy + v[2] * sy;
    const z = -v[0] * sy + v[2] * cy;
    return [x, -v[1] * cp + z * sp];
  };

  const light = { front: shadedCanvas(img, 0.95), side: shadedCanvas(img, 0.72), top: shadedCanvas(img, 1.08) };
  const showOuter = opts.outer !== false;
  const parts = placements(model);

  // Fit the whole figure (outer layer included) into the canvas.
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of parts) {
    const g = p.part === 'head' ? 0.5 : 0.25;
    for (const x of [p.x[0] - g, p.x[1] + g]) {
      for (const y of [p.y[0] - g, p.y[1] + g]) {
        for (const z of [p.z[0] - g, p.z[1] + g]) {
          const [px, py] = proj([x, y, z]);
          minX = Math.min(minX, px);
          maxX = Math.max(maxX, px);
          minY = Math.min(minY, py);
          maxY = Math.max(maxY, py);
        }
      }
    }
  }
  const pad = (opts.padding ?? 8) * dpr;
  const shadowH = opts.shadow === false ? 0 : 3;
  const scale = Math.min((canvas.width - pad * 2) / (maxX - minX), (canvas.height - pad * 2) / (maxY - minY + shadowH));
  const offX = (canvas.width - (maxX - minX) * scale) / 2 - minX * scale;
  const offY = (canvas.height - (maxY - minY + shadowH) * scale) / 2 - minY * scale;

  if (opts.shadow !== false) {
    const [gx, gy] = proj([0, 0, 0]);
    ctx.save();
    ctx.translate(offX + gx * scale, offY + gy * scale + 1.5 * scale);
    ctx.scale(1, 0.32);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 9 * scale);
    grad.addColorStop(0, 'rgba(0,0,0,0.38)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 9 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const drawFace = (src: HTMLCanvasElement, rect: { x: number; y: number; w: number; h: number }, origin: Vec3, u: Vec3, v: Vec3) => {
    const [ox, oy] = proj(origin);
    const [ux, uy] = proj(u);
    const [vx, vy] = proj(v);
    ctx.setTransform(ux * scale, uy * scale, vx * scale, vy * scale, offX + ox * scale, offY + oy * scale);
    // A hair of overlap hides seams between faces.
    ctx.drawImage(src, rect.x, rect.y, rect.w, rect.h, -0.02, -0.02, rect.w + 0.04, rect.h + 0.04);
  };

  const drawBox = (p: PartPlacement, layer: SkinLayer) => {
    const o = partOrigin(p.part, layer, model);
    if (!o) return;
    const b = partBox(p.part, model);
    const f = boxFaces(o[0], o[1], b);
    const g = layer === 'outer' ? (p.part === 'head' ? 0.5 : 0.25) : 0;
    const x0 = p.x[0] - g;
    const x1 = p.x[1] + g;
    const y0 = p.y[0] - g;
    const y1 = p.y[1] + g;
    const z0 = p.z[0] - g;
    const z1 = p.z[1] + g;
    const du: Vec3 = [(x1 - x0) / b.w, 0, 0];
    const dv: Vec3 = [0, -(y1 - y0) / b.h, 0];
    const dz = (z1 - z0) / b.d;
    const faces: Partial<Record<SkinFace, () => void>> = {
      front: () => drawFace(light.front, f.front, [x0, y1, z1], du, dv),
      top: () => drawFace(light.top, f.top, [x0, y1, z0], du, [0, 0, dz]),
    };
    if (yaw < 0) faces.left = () => drawFace(light.side, f.left, [x1, y1, z1], [0, 0, -dz], dv);
    else faces.right = () => drawFace(light.side, f.right, [x0, y1, z0], [0, 0, dz], dv);
    faces.left?.();
    faces.right?.();
    faces.top?.();
    faces.front?.();
  };

  const order = yaw < 0 ? parts : [...parts].reverse().sort((a, b) => (a.part === 'head' ? 1 : b.part === 'head' ? -1 : 0));
  for (const p of order) {
    drawBox(p, 'base');
    if (showOuter) drawBox(p, 'outer');
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function flatSource(img: ImageData): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  c.getContext('2d')!.putImageData(img, 0, 0);
  return c;
}

/**
 * Flat front or back view (16x32 figure) scaled by whole pixels, outer layer drawn on top.
 * The canvas gets an exact backing size of 16*s x 32*s.
 */
export function drawPaperDoll(canvas: HTMLCanvasElement, img: ImageData, model: SkinModel, side: 'front' | 'back', s: number, outer = true): void {
  canvas.width = 16 * s;
  canvas.height = 32 * s;
  const ctx = canvas.getContext('2d');
  if (!ctx || img.width !== 64 || img.height !== 64) return;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const src = flatSource(img);
  const aw = model === 'slim' ? 3 : 4;
  // Screen columns (in figure pixels) of each part, as seen from the front.
  const front: Record<SkinPart, [number, number]> = {
    rightArm: [4 - aw, 8],
    body: [4, 8],
    leftArm: [12, 8],
    head: [4, 0],
    rightLeg: [4, 20],
    leftLeg: [8, 20],
  };
  const back: Record<SkinPart, [number, number]> = {
    leftArm: [4 - aw, 8],
    body: [4, 8],
    rightArm: [12, 8],
    head: [4, 0],
    leftLeg: [4, 20],
    rightLeg: [8, 20],
  };
  const pos = side === 'front' ? front : back;
  for (const layer of (outer ? ['base', 'outer'] : ['base']) as SkinLayer[]) {
    for (const part of Object.keys(pos) as SkinPart[]) {
      const o = partOrigin(part, layer, model);
      if (!o) continue;
      const r = boxFaces(o[0], o[1], partBox(part, model))[side];
      const [x, y] = pos[part];
      ctx.drawImage(src, r.x, r.y, r.w, r.h, x * s, y * s, r.w * s, r.h * s);
    }
  }
}

/** 8x8 face (base + hat) drawn at `size` CSS px. */
export function drawHead(canvas: HTMLCanvasElement, img: ImageData, size: number): void {
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const px = Math.max(1, Math.round((size * dpr) / 8));
  canvas.width = px * 8;
  canvas.height = px * 8;
  const ctx = canvas.getContext('2d');
  if (!ctx || img.width !== 64) return;
  ctx.imageSmoothingEnabled = false;
  const src = flatSource(img);
  ctx.drawImage(src, 8, 8, 8, 8, 0, 0, px * 8, px * 8);
  ctx.drawImage(src, 40, 8, 8, 8, 0, 0, px * 8, px * 8);
}
