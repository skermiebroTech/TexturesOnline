// The biomes marked on a colour map: one marker per pixel the game reads (biomes with the same
// climate share it), drawn over the biome colours view and over the pixel editor while a colour
// map is open, with the half of the map the game never reads shaded. Whether the pixel editor
// shows them is remembered in this browser.

import type { Edition } from '../../../core/types';
import { biomeCell, biomeLooks, biomesOf, readsMap, type BiomeId, type ColorMap } from './biomes';

export interface Marker {
  /** The pixel of a 256 x 256 map */
  x: number;
  y: number;
  /** The biomes reading it, and whether each reads this map (false: a colour of its own) */
  biomes: { id: BiomeId; reads: boolean }[];
}

/** The markers of a map, in the order of the biome list. */
export function mapMarkers(edition: Edition, version: string, map: ColorMap): Marker[] {
  const out: Marker[] = [];
  for (const id of biomesOf(edition, version)) {
    const looks = biomeLooks(id, edition, version);
    if (!looks) continue;
    const { x, y } = biomeCell(looks);
    const reads = readsMap(looks, map);
    const m = out.find((k) => k.x === x && k.y === y);
    if (m) m.biomes.push({ id, reads });
    else out.push({ x, y, biomes: [{ id, reads }] });
  }
  return out;
}

/** The marker nearest a map pixel within `radius` map pixels (null: none). */
export function markerAt(markers: readonly Marker[], x: number, y: number, radius: number): Marker | null {
  let best: Marker | null = null;
  let bestD = radius * radius;
  for (const m of markers) {
    const d = (m.x + 0.5 - x) ** 2 + (m.y + 0.5 - y) ** 2;
    if (d <= bestD) {
      best = m;
      bestD = d;
    }
  }
  return best;
}

/**
 * Draws the markers (and shades the unused half) in screen space: `at` turns a map position (0..256,
 * fractions allowed) into canvas coordinates, `cell` is the size of one map pixel on screen.
 */
export function drawMarkers(
  ctx: CanvasRenderingContext2D,
  at: (x: number, y: number) => [number, number],
  cell: number,
  markers: readonly Marker[],
  selected: BiomeId | null,
  opts: { shadeUnused?: boolean; size?: number } = {},
): void {
  ctx.save();
  if (opts.shadeUnused !== false) {
    // the top-right half (above the diagonal) is never read
    const [ax, ay] = at(0, 0);
    const [bx, by] = at(256, 0);
    const [cx, cy] = at(256, 256);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.lineTo(cx, cy);
    ctx.closePath();
    ctx.fillStyle = 'rgba(12, 14, 20, 0.42)';
    ctx.fill();
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.moveTo(Math.round(ax) + 0.5, Math.round(ay) + 0.5);
    ctx.lineTo(Math.round(cx) + 0.5, Math.round(cy) + 0.5);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  const r = opts.size ?? Math.max(4, Math.min(8, cell * 2.5));
  // markers on the edges (deserts, snowy plains) stay whole inside the map
  const [x0, y0] = at(0, 0);
  const [x1, y1] = at(256, 256);
  const inside = (v: number, lo: number, hi: number) => (hi - lo > 4 * r ? Math.min(hi - r - 2, Math.max(lo + r + 2, v)) : v);
  const draw = (m: Marker, on: boolean) => {
    const [px, py] = at(m.x + 0.5, m.y + 0.5);
    const x = inside(px, x0, x1);
    const y = inside(py, y0, y1);
    const reads = m.biomes.some((b) => b.reads);
    const rr = on ? r + 2 : r;
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = on ? '#ffd84a' : '#ffffff';
    // biomes that don't read the map: a dashed ring
    if (!reads) ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    if (on) {
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd84a';
      ctx.fill();
    }
  };
  let sel: Marker | null = null;
  for (const m of markers) {
    if (selected && m.biomes.some((b) => b.id === selected)) sel = m;
    else draw(m, false);
  }
  // the selected one on top
  if (sel) draw(sel, true);
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// Whether the pixel editor shows them

const SHOW_KEY = 'to-tex-biome-markers';
const listeners = new Set<() => void>();

export function markersOnCanvas(): boolean {
  try {
    return localStorage.getItem(SHOW_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setMarkersOnCanvas(on: boolean): void {
  try {
    localStorage.setItem(SHOW_KEY, on ? 'on' : 'off');
  } catch {
    /* storage blocked */
  }
  for (const fn of [...listeners]) fn();
}

/** Called when the setting changes; returns the unsubscribe. */
export function onMarkersOnCanvas(fn: () => void): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
