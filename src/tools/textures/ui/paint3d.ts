// Painting textures on the 3D model: turns rays on the model into strokes of the pixel editor. A
// press on a face finds the texture and texel it shows (the model's UVs, rotations, overlays, entity
// box UVs, the animation frame being edited) and paints it with the current tool: pencil, eraser,
// lighten / darken / noise, fill (the matching area of that texture, inside the face's own patch on
// entity sheets) and the colour picker, with the brush size and mirror. A face of another texture opens
// that texture first; a stroke stays on the texture it started on. Every stroke is one undo step in
// that texture's own history, shared with the 2D editor, and both views update while you paint.

import type { ModelPaintHandler, ModelPaintHit, PaintCursor, PaintCursorKind } from '../../../shared/preview/block-preview';
import { brushTexels, mirrorTexels, quadTexelRect, texelAt, texelSteps, type Texel } from '../../../shared/models/model-paint';
import { floodRegion, type RGBA } from '../../../shared/pixel-algorithms';
import type { PixelCanvas, StrokeTool, Tool } from '../../../shared/pixel-canvas';
import { toast } from '../../../ui/toast';
import { TOOLS_3D, type CanvasPanel } from './canvas-panel';
import type { PreviewPanel } from './preview-panel';
import type { TexStore } from './store';
import { te } from './i18n/editor';

export interface Paint3dController {
  /** Painting on the model on / off (the 3D workspace) */
  setEnabled(on: boolean): void;
  enabled(): boolean;
  /** Tool, colour, brush or mirror changed */
  sync(): void;
  /** The pointer is over a texel of the pixel editor (null = off it) */
  canvasHover(p: { x: number; y: number } | null): void;
  /** The open texture or its animation frame changed */
  textureChanged(): void;
  destroy(): void;
}

const STROKE_TOOLS = new Set<Tool>(['pencil', 'eraser', 'lighten', 'darken', 'noise']);

type Mode =
  | { kind: 'opening'; path: string; tool: Tool; secondary: boolean; queue: ModelPaintHit[]; ended: null | 'commit' | 'cancel' }
  | { kind: 'stroke'; path: string; last: { index: number; t: Texel } | null }
  | { kind: 'pick'; path: string }
  | { kind: 'fill' }
  | { kind: 'locked' };

/** Brush preview colour on the model. */
function previewFill(tool: Tool, c: RGBA): [number, number, number, number] | null {
  switch (tool) {
    case 'eraser':
      return [255, 255, 255, 90];
    case 'lighten':
      return [255, 255, 255, 64];
    case 'darken':
      return [0, 0, 0, 90];
    case 'picker':
      return null;
    default:
      return c[3] === 0 ? [255, 255, 255, 90] : [c[0], c[1], c[2], Math.round(c[3] * 0.7)];
  }
}

export function createPaint3d(deps: { store: TexStore; canvas: CanvasPanel; preview: PreviewPanel }): Paint3dController {
  const { store, canvas, preview } = deps;
  let on = false;
  let mode: Mode | null = null;
  let hoverHit: ModelPaintHit | null = null;
  let hoverPick = false;
  let hoverKey = '';
  let lockWarned = false;

  const pc = (): PixelCanvas | null => canvas.canvas();
  const openKey = (): string | null => canvas.current()?.key ?? null;
  const editable = (path: string) => store.assets.hasFile(path) || store.isEdited(path);
  const nameOf = (path: string) => store.byPath.get(path)?.id ?? path.slice(path.lastIndexOf('/') + 1).replace(/\.(png|tga)$/i, '');

  /**
   * Texel grid of a hit: the open texture's frame as the pixel editor holds it (an HD pack may hold more
   * texels than the model draws), else the frame the model draws.
   */
  function gridOf(hit: ModelPaintHit): [number, number] | null {
    if (!hit.texture || !hit.frame) return null;
    const p = pc();
    if (p && hit.texture === openKey()) {
      // The model shows the top square of tall still textures: keep its aspect.
      const h = Math.max(1, Math.round((p.width * hit.frame[1]) / hit.frame[0]));
      return [p.width, Math.min(p.height, h)];
    }
    return hit.frame;
  }

  function texelOf(hit: ModelPaintHit): Texel | null {
    const g = gridOf(hit);
    return g ? texelAt(hit.quad, hit.uv, g[0], g[1]) : null;
  }

  /** Texels the brush covers at a hit (entity sheets: inside the face's own patch). */
  function footprint(hit: ModelPaintHit, at: { fx: number; fy: number }): number[] {
    const g = gridOf(hit)!;
    const p = pc();
    const clip = hit.quad.boxUv ? quadTexelRect(hit.quad, g[0], g[1]) : null;
    return brushTexels(at.fx, at.fy, p?.brushSize ?? 1, p?.brushShape === 'round', g[0], g[1], clip);
  }

  const toPoints = (pixels: readonly number[], w: number): [number, number][] => pixels.map((q) => [q % w, Math.floor(q / w)]);

  /** The area a fill at a texel covers (the open texture only). */
  function fillRegion(hit: ModelPaintHit, t: Texel): number[] {
    const p = pc();
    const g = gridOf(hit);
    if (!p || !g || hit.texture !== openKey()) return [t.y * (g?.[0] ?? 1) + t.x];
    const img = p.getImage();
    const bounds = hit.quad.boxUv ? quadTexelRect(hit.quad, g[0], g[1]) : { x: 0, y: 0, w: g[0], h: g[1] };
    const region = floodRegion(img, t.x, t.y, { tolerance: p.fillTolerance, contiguous: p.fillContiguous, channels: p.channelMode, bounds });
    if (!region) return [];
    const out: number[] = [];
    for (let y = bounds.y; y < bounds.y + bounds.h; y++) for (let x = bounds.x; x < bounds.x + bounds.w; x++) if (region[y * img.width + x]) out.push(y * g[0] + x);
    return out;
  }

  // ---- strokes ----

  function stamp(hit: ModelPaintHit, at: { fx: number; fy: number }) {
    const p = pc();
    const g = gridOf(hit);
    if (!p || !g) return;
    const pixels = footprint(hit, at);
    if (pixels.length) p.setPixels(toPoints(pixels, g[0]));
  }

  function strokeToolFor(tool: Tool): StrokeTool {
    if (STROKE_TOOLS.has(tool)) return tool as StrokeTool;
    return 'pencil';
  }

  /** Starts what a press does, on the open texture. Returns false when nothing happens. */
  function start(hit: ModelPaintHit, tool: Tool, secondary: boolean): boolean {
    const p = pc();
    const path = hit.texture;
    if (!p || !path || path !== openKey()) return false;
    const t = texelOf(hit);
    if (!t) return false;
    if (tool === 'picker') {
      p.setColor(p.getPixel(t.x, t.y));
      mode = { kind: 'pick', path };
      return true;
    }
    if (tool === 'fill') {
      const region = fillRegion(hit, t);
      mode = { kind: 'fill' };
      if (!region.length) return true;
      if (p.getSelection()) p.deselect();
      const g = gridOf(hit)!;
      p.beginStroke({ secondary });
      p.setPixels(toPoints(region, g[0]), secondary ? p.secondaryColor : p.color);
      p.endStroke();
      return true;
    }
    if (!TOOLS_3D.has(tool)) {
      p.setTool('pencil');
      tool = 'pencil';
    }
    if (p.getSelection()) p.deselect();
    p.beginStroke({ tool: strokeToolFor(tool), secondary });
    mode = { kind: 'stroke', path, last: { index: hit.index, t } };
    stamp(hit, t);
    canvas.live();
    return true;
  }

  function extendStroke(hits: ModelPaintHit[]) {
    const m = mode;
    if (m?.kind !== 'stroke') return;
    const p = pc();
    if (!p?.stroking) return;
    for (const hit of hits) {
      if (hit.texture !== m.path) continue;
      const t = texelOf(hit);
      if (!t) continue;
      // On one face, fill the gap between samples; across an edge the walked rays already did.
      if (m.last && m.last.index === hit.index) for (const [fx, fy] of texelSteps(m.last.t, t)) stamp(hit, { fx, fy });
      else stamp(hit, t);
      m.last = { index: hit.index, t };
    }
    canvas.live();
  }

  const handler: ModelPaintHandler = {
    begin(hit, e, pick) {
      const path = hit.texture;
      if (!path) return false;
      if (!editable(path)) {
        mode = { kind: 'locked' };
        if (!lockWarned) {
          lockWarned = true;
          toast(te.paint3d.missingFace, { duration: 4000 });
        }
        return true;
      }
      const p = pc();
      const tool: Tool = pick ? 'picker' : e.button === 5 ? 'eraser' : (p?.tool ?? 'pencil');
      const secondary = false;
      if (path === openKey() && p) return start(hit, tool, secondary) || ((mode = { kind: 'locked' }), true);
      // Another texture: open it in the pixel editor, then paint what the pointer did meanwhile.
      const m: Extract<Mode, { kind: 'opening' }> = { kind: 'opening', path, tool, secondary, queue: [], ended: null };
      mode = m;
      void canvas.open(path).then(() => {
        if (mode !== m) return;
        mode = null;
        if (m.ended === 'cancel' || openKey() !== path || !start(hit, m.tool, m.secondary)) return;
        if (m.queue.length) handler.extend(m.queue);
        if (m.ended) finish(m.ended === 'commit');
      });
      return true;
    },
    extend(hits) {
      const m = mode;
      if (!m) return;
      if (m.kind === 'opening') {
        m.queue.push(...hits);
        return;
      }
      if (m.kind === 'pick') {
        const last = [...hits].reverse().find((x) => x.texture === m.path);
        const t = last && texelOf(last);
        const p = pc();
        if (t && p) p.setColor(p.getPixel(t.x, t.y));
        return;
      }
      extendStroke(hits);
    },
    end(commit) {
      const m = mode;
      // The press ended before its texture opened: it still paints (a click) once open, unless taken back.
      if (m?.kind === 'opening') m.ended = commit ? 'commit' : 'cancel';
      else finish(commit);
    },
    hover(hit, pick) {
      hoverHit = hit;
      hoverPick = pick;
      return paintHover();
    },
    undo() {
      canvas.undo();
    },
  };

  function finish(commit: boolean) {
    if (mode?.kind === 'stroke') {
      const p = pc();
      if (p?.stroking) {
        if (commit) p.endStroke();
        else {
          p.cancelStroke();
          canvas.live();
        }
      }
    }
    mode = null;
    hoverKey = '';
    paintHover();
  }

  /** Outlines what a press would paint at the hovered point and names it. */
  function paintHover(): PaintCursorKind {
    const hit = hoverHit;
    const p = pc();
    if (!hit || !hit.texture || !p) {
      if (hoverKey !== '') {
        hoverKey = '';
        preview.setPaintCursor(null);
        preview.setPaintHint(null);
        canvas.showHover(null);
        if (canvasPoint) showCanvasHover();
      }
      return 'paint';
    }
    const path = hit.texture;
    const g = gridOf(hit);
    const t = texelOf(hit);
    if (!g || !t) return 'paint';
    const at = t.y * g[0] + t.x;
    const tool: Tool = hoverPick || mode?.kind === 'pick' ? 'picker' : p.tool;
    const locked = !editable(path) ? te.paint3d.missing : mode?.kind === 'stroke' && mode.path !== path ? te.paint3d.otherTexture : null;
    let pixels: number[];
    let echo: number[] = [];
    let kind: PaintCursorKind = 'paint';
    if (locked) {
      pixels = [at];
      kind = 'locked';
    } else if (tool === 'picker') {
      pixels = [at];
      kind = 'pick';
    } else if (tool === 'fill') {
      pixels = path === openKey() ? fillRegion(hit, t) : [at];
      if (!pixels.length) pixels = [at];
      echo = mirrorTexels(pixels, g[0], g[1], p.mirrorX, p.mirrorY);
    } else {
      pixels = footprint(hit, t);
      echo = mirrorTexels(pixels, g[0], g[1], p.mirrorX, p.mirrorY);
    }
    const fill = locked ? null : previewFill(tool === 'fill' ? 'pencil' : tool, p.color);
    const key = `${path}|${g[0]}x${g[1]}|${at}|${locked ?? ''}|${tool}|${fill?.join(',') ?? ''}|${pixels.length}:${pixels[0]}:${pixels[pixels.length - 1]}|${echo.length}`;
    if (key !== hoverKey) {
      hoverKey = key;
      const cursor: PaintCursor = { texture: path, width: g[0], height: g[1], pixels, echo, fill, tone: locked ? 'locked' : 'normal' };
      preview.setPaintCursor(cursor);
      canvas.showHover(path === openKey() ? { pixels, echo } : null);
      const color = path === openKey() ? (p.getPixel(t.x, t.y) as [number, number, number, number]) : undefined;
      preview.setPaintHint({ label: preview.partLabel(hit.quad.part) ?? preview.textureLabel(path) ?? te.paint3d.texture, name: nameOf(path), x: t.x, y: t.y, color, locked: locked ?? undefined });
    }
    return kind;
  }

  /** The pointer on the flat texture: outline the brush there on the model too. */
  let canvasPoint: { x: number; y: number } | null = null;
  function showCanvasHover() {
    const p = pc();
    const t = canvas.current();
    if (!on || hoverHit || mode || !p || !t) return;
    if (!canvasPoint) {
      preview.setPaintCursor(null);
      return;
    }
    const tool = p.tool;
    const W = p.width;
    const H = p.height;
    const pixels = tool === 'picker' || tool === 'fill' || !TOOLS_3D.has(tool) ? [canvasPoint.y * W + canvasPoint.x] : brushTexels(canvasPoint.x + 0.5, canvasPoint.y + 0.5, p.brushSize, p.brushShape === 'round', W, H);
    const echo = tool === 'picker' ? [] : mirrorTexels(pixels, W, H, p.mirrorX, p.mirrorY);
    preview.setPaintCursor({ texture: t.key, width: W, height: H, pixels, echo, fill: tool === 'fill' ? null : previewFill(tool, p.color) });
  }

  function pinOpenFrame() {
    const t = canvas.current();
    preview.pinFrame(t && t.anim ? t.key : null, t?.frame ?? 0);
  }

  const controller: Paint3dController = {
    setEnabled(v) {
      if (v === on) return;
      on = v;
      if (!on) {
        handler.end(false);
        hoverHit = null;
        hoverKey = '';
        preview.setPaintCursor(null);
        preview.setPaintHint(null);
        canvas.showHover(null);
        preview.setPaintHandler(null);
        preview.pinFrame(null, -1);
        return;
      }
      preview.setPaintHandler(handler);
      preview.setPaintHint(null);
      pinOpenFrame();
    },
    enabled: () => on,
    canvasHover(pt) {
      canvasPoint = pt;
      showCanvasHover();
    },
    sync() {
      if (!on) return;
      hoverKey = '';
      if (hoverHit && !mode) paintHover();
      else if (canvasPoint) showCanvasHover();
      preview.refreshPaintHover();
    },
    textureChanged() {
      // another texture opened during a stroke (the pixel editor took the stroke back)
      if (mode?.kind === 'stroke' && mode.path !== openKey()) mode = null;
      if (!on) return;
      pinOpenFrame();
      hoverKey = '';
      preview.refreshPaintHover();
    },
    destroy() {
      controller.setEnabled(false);
    },
  };
  return controller;
}
