// Original pixel-art scenes drawn as SVG (target placeholders, preset swatches) and canvas icons.
// No game art is used: everything is flat colour blocks.

import type { ShaderTarget } from '../../../core/types';

type RGB = [number, number, number];

function hex(c: string): RGB {
  const s = c.replace('#', '');
  const f = s.length === 3 ? s.split('').map((x) => x + x).join('') : s.padEnd(6, '0').slice(0, 6);
  return [parseInt(f.slice(0, 2), 16) || 0, parseInt(f.slice(2, 4), 16) || 0, parseInt(f.slice(4, 6), 16) || 0];
}
function css(c: RGB, a = 1): string {
  const [r, g, b] = c.map((x) => Math.round(Math.min(255, Math.max(0, x))));
  return a >= 1 ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${a})`;
}
function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
function shade(c: RGB, k: number): RGB {
  return [c[0] * k, c[1] * k, c[2] * k];
}

export interface SceneStyle {
  skyTop: string;
  skyBottom: string;
  /** Sun (or moon) position in grid units (0..48, 0..30) and colour */
  sun?: { x: number; y: number; color: string; size?: number };
  grass: string;
  dirt: string;
  water: string;
  leaves: string;
  light?: number;
  /** Light rays from the sun (0..1) */
  rays?: number;
  /** Shadow side strength (0..1) */
  shadow?: number;
  vignette?: number;
  stars?: boolean;
  /** Wavy grass tufts */
  tufts?: boolean;
  /** Sparkles on the water */
  glints?: boolean;
  haze?: string;
}

const W = 48;
const H = 30;

// Blocky terrain profile (column heights from the bottom), pond between columns 27 and 37.
const GROUND = [9, 9, 10, 10, 11, 11, 11, 12, 12, 12, 13, 13, 12, 12, 11, 11, 11, 10, 10, 10, 9, 9, 9, 9, 8, 8, 8, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 11, 12, 12];
const HILLS = [15, 15, 16, 16, 17, 17, 17, 16, 16, 15, 15, 14, 14, 14, 15, 15, 16, 17, 18, 18, 18, 17, 16, 16, 15, 15, 14, 14, 15, 15, 16, 16, 17, 17, 16, 16, 15, 15, 15, 16, 16, 17, 17, 18, 18, 17, 17, 16];

let artId = 0;

/** A small side-on pixel landscape. Returns SVG markup (scales to fill its box). */
export function sceneSvg(s: SceneStyle): string {
  const id = `sa${++artId}`;
  const light = s.light ?? 1;
  const grass = shade(hex(s.grass), light);
  const dirt = shade(hex(s.dirt), light);
  const water = hex(s.water);
  const leaves = shade(hex(s.leaves), light);
  const top = hex(s.skyTop);
  const bottom = hex(s.skyBottom);
  const haze = s.haze ? hex(s.haze) : bottom;
  const parts: string[] = [];
  parts.push(
    `<defs><linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${css(top)}"/><stop offset="1" stop-color="${css(bottom)}"/></linearGradient>` +
      `<radialGradient id="${id}v" cx="0.5" cy="0.5" r="0.75"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${(s.vignette ?? 0).toFixed(2)}"/></radialGradient>` +
      (s.sun ? `<radialGradient id="${id}g"><stop offset="0" stop-color="${s.sun.color}" stop-opacity="0.55"/><stop offset="1" stop-color="${s.sun.color}" stop-opacity="0"/></radialGradient>` : '') +
      `</defs>`,
  );
  parts.push(`<rect width="${W}" height="${H}" fill="url(#${id}s)"/>`);
  if (s.stars) {
    const stars = [[4, 3], [11, 6], [17, 2], [23, 5], [30, 3], [36, 7], [42, 2], [45, 9], [8, 10], [27, 9]];
    for (const [x, y] of stars) parts.push(`<rect x="${x}" y="${y}" width="0.5" height="0.5" fill="#fff" opacity="0.8"/>`);
  }
  if (s.sun) {
    const size = s.sun.size ?? 4;
    parts.push(`<circle cx="${s.sun.x}" cy="${s.sun.y}" r="${size * 2.6}" fill="url(#${id}g)"/>`);
    parts.push(`<rect x="${s.sun.x - size / 2}" y="${s.sun.y - size / 2}" width="${size}" height="${size}" fill="${s.sun.color}"/>`);
    if (s.rays) {
      const a = (s.rays * 0.22).toFixed(3);
      for (const [dx, spread] of [[-16, 3], [-6, 2.5], [5, 3], [15, 2.5]] as [number, number][]) {
        parts.push(`<polygon points="${s.sun.x},${s.sun.y} ${s.sun.x + dx - spread},${H} ${s.sun.x + dx + spread},${H}" fill="${s.sun.color}" opacity="${a}"/>`);
      }
    }
  }
  // distant hills
  const hillColor = mix(mix(grass, haze, 0.62), top, 0.12);
  let hill = `M0 ${H}`;
  HILLS.forEach((hh, x) => (hill += ` L${x} ${H - hh} L${x + 1} ${H - hh}`));
  hill += ` L${W} ${H} Z`;
  parts.push(`<path d="${hill}" fill="${css(hillColor)}"/>`);
  // pond
  parts.push(`<rect x="27" y="${H - 7.5}" width="10" height="7.5" fill="${css(water)}"/>`);
  parts.push(`<rect x="27" y="${H - 7.5}" width="10" height="0.75" fill="${css(mix(water, [255, 255, 255], 0.45))}"/>`);
  if (s.glints) {
    for (const [x, y] of [[29, 2.2], [33, 3.4], [35, 1.6]]) parts.push(`<rect x="${x}" y="${H - 7.5 + y}" width="1.5" height="0.5" fill="#fff" opacity="0.75"/>`);
  }
  // ground columns
  GROUND.forEach((gh, x) => {
    if (x >= 27 && x <= 36) {
      parts.push(`<rect x="${x}" y="${H - gh + 6}" width="1" height="${gh}" fill="${css(shade(dirt, 0.8))}"/>`);
      return;
    }
    parts.push(`<rect x="${x}" y="${H - gh}" width="1.02" height="${gh}" fill="${css(dirt)}"/>`);
    parts.push(`<rect x="${x}" y="${H - gh}" width="1.02" height="1.5" fill="${css(grass)}"/>`);
    if ((x * 7) % 5 === 0) parts.push(`<rect x="${x}" y="${H - gh + 3 + (x % 3)}" width="1" height="1" fill="${css(shade(dirt, 0.78))}"/>`);
  });
  // shadow side of the hill
  if (s.shadow) {
    parts.push(`<rect x="12" y="${H - 12}" width="8" height="12" fill="#000" opacity="${(s.shadow * 0.28).toFixed(2)}"/>`);
  }
  // tree
  const tx = 8;
  const base = H - GROUND[tx];
  parts.push(`<rect x="${tx}" y="${base - 6}" width="1.5" height="6" fill="${css(shade(dirt, 0.72))}"/>`);
  parts.push(`<rect x="${tx - 3}" y="${base - 11}" width="7.5" height="5" fill="${css(leaves)}"/>`);
  parts.push(`<rect x="${tx - 1.5}" y="${base - 13}" width="4.5" height="2" fill="${css(leaves)}"/>`);
  parts.push(`<rect x="${tx - 3}" y="${base - 7}" width="7.5" height="1" fill="#000" opacity="0.18"/>`);
  // second tree
  const t2 = 42;
  const b2 = H - GROUND[t2];
  parts.push(`<rect x="${t2}" y="${b2 - 5}" width="1.5" height="5" fill="${css(shade(dirt, 0.72))}"/>`);
  parts.push(`<rect x="${t2 - 2.5}" y="${b2 - 9}" width="6.5" height="4.5" fill="${css(leaves)}"/>`);
  if (s.tufts) {
    for (const x of [3, 15, 20, 24, 39, 45]) {
      const y = H - GROUND[x];
      parts.push(`<rect x="${x + 0.2}" y="${y - 1.2}" width="0.5" height="1.2" fill="${css(mix(grass, [255, 255, 255], 0.15))}"/>`);
      parts.push(`<rect x="${x + 0.8}" y="${y - 0.8}" width="0.5" height="0.8" fill="${css(grass)}"/>`);
    }
  }
  if (s.vignette) parts.push(`<rect width="${W}" height="${H}" fill="url(#${id}v)"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${parts.join('')}</svg>`;
}

/** The look of each target's start card (shown until a real preview render is ready). */
export const TARGET_SCENES: Record<ShaderTarget, SceneStyle> = {
  iris: {
    skyTop: '#2c3f7a',
    skyBottom: '#ff9d5c',
    sun: { x: 34, y: 15, color: '#ffe0a0', size: 4 },
    grass: '#6f9a3a',
    dirt: '#8a5a36',
    water: '#2f6fa8',
    leaves: '#4c7a2a',
    light: 0.95,
    rays: 1,
    shadow: 1,
    vignette: 0.45,
    tufts: true,
    glints: true,
    haze: '#f0a070',
  },
  'java-vanilla': {
    skyTop: '#6f9cf0',
    skyBottom: '#b8d4ff',
    sun: { x: 12, y: 6, color: '#fff6d8', size: 4 },
    grass: '#6ab04a',
    dirt: '#8d6040',
    water: '#3f76e4',
    leaves: '#4f8f33',
    light: 1,
    vignette: 0.2,
  },
  'bedrock-vibrant': {
    skyTop: '#2f7de0',
    skyBottom: '#a9dcff',
    sun: { x: 38, y: 7, color: '#fffbe8', size: 4 },
    grass: '#58c24a',
    dirt: '#9a6a44',
    water: '#1fb5c9',
    leaves: '#3c9b3a',
    light: 1.05,
    shadow: 0.6,
    glints: true,
    haze: '#c8ecff',
  },
};

/** Preset card art from its two swatch colours. */
export function presetSceneSvg(swatch: [string, string]): string {
  const a = hex(swatch[0]);
  const b = hex(swatch[1]);
  const lum = (c: RGB) => (c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11) / 255;
  const dark = lum(a) < 0.18 && lum(b) < 0.5;
  const ground = mix(a, [20, 24, 30], 0.55);
  return sceneSvg({
    skyTop: css(a),
    skyBottom: css(b),
    sun: { x: 36, y: 9, color: css(mix(b, [255, 255, 255], 0.55)), size: 4 },
    grass: css(mix(mix(b, a, 0.35), [40, 140, 60], 0.35)),
    dirt: css(ground),
    water: css(mix(a, [40, 110, 200], 0.4)),
    leaves: css(mix(mix(b, a, 0.5), [30, 110, 50], 0.3)),
    light: dark ? 0.8 : 0.92,
    stars: dark,
  });
}

// ---------------------------------------------------------------------------------------------
// Canvas helpers (display / icon only; never used for texture data)

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available.');
  return [c, ctx];
}

function toPng(c: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    c.toBlob((b) => {
      if (!b) {
        reject(new Error('Could not create the pack icon.'));
        return;
      }
      b.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)), reject);
    }, 'image/png');
  });
}

/** Square icon cut from the middle of a preview screenshot. */
export async function iconFromScreenshot(shot: Blob, size: number): Promise<Uint8Array> {
  const bmp = await createImageBitmap(shot);
  try {
    const side = Math.min(bmp.width, bmp.height) * 0.78;
    const sx = (bmp.width - side) / 2;
    const sy = (bmp.height - side) / 2 + side * 0.04;
    const [c, ctx] = canvas(size);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, sx, sy, side, side, 0, 0, size, size);
    return await toPng(c);
  } finally {
    bmp.close();
  }
}

/** Pixel-art icon (sky gradient, sun, hills) for when no preview render is available. */
export async function fallbackIcon(swatch: [string, string], size: number): Promise<Uint8Array> {
  const [c, ctx] = canvas(size);
  const px = size / 16;
  const a = hex(swatch[0]);
  const b = hex(swatch[1]);
  for (let y = 0; y < 16; y++) {
    ctx.fillStyle = css(mix(a, b, y / 15));
    ctx.fillRect(0, Math.floor(y * px), size, Math.ceil(px));
  }
  ctx.fillStyle = css(mix(b, [255, 255, 255], 0.7));
  ctx.fillRect(10 * px, 3 * px, 3 * px, 3 * px);
  const hills = [11, 11, 10, 10, 9, 9, 10, 10, 11, 12, 12, 11, 11, 10, 10, 11];
  hills.forEach((top, x) => {
    ctx.fillStyle = css(mix(a, [40, 150, 60], 0.55));
    ctx.fillRect(x * px, top * px, Math.ceil(px), px);
    ctx.fillStyle = css(mix(a, [110, 70, 40], 0.6));
    ctx.fillRect(x * px, (top + 1) * px, Math.ceil(px), (16 - top - 1) * px);
  });
  return toPng(c);
}

/** Small thumbnail (WebP when supported) from a preview screenshot, for the recent projects grid. */
export async function thumbFromScreenshot(shot: Blob, width = 320, height = 200): Promise<Blob> {
  const bmp = await createImageBitmap(shot);
  try {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available.');
    const scale = Math.max(width / bmp.width, height / bmp.height);
    const w = bmp.width * scale;
    const h = bmp.height * scale;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, (width - w) / 2, (height - h) / 2, w, h);
    return await new Promise<Blob>((resolve, reject) =>
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create a thumbnail.'))), 'image/webp', 0.86),
    );
  } finally {
    bmp.close();
  }
}
