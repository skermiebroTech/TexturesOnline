// Draws the GUI preview's screens (HUD over a little world, an inventory or container, the title
// screen, a menu, enchanted items) from the pack's textures, the way the game lays them out. Every
// GUI pixel is R × R device pixels (the game's integer GUI scale), drawn without smoothing. What it
// draws is recorded as hit areas, so the preview can tell which texture is under the pointer.

import type { Edition } from '../../../core/types';
import { pieceRect, type ContainerId, type GuiCatalog, type GuiPiece, type GuiScreen, type Rect } from './catalog';
import { colourRuns, type BitmapFont } from './font';
import type { Scaling } from './scaling';

export type HudLook = 'normal' | 'poisoned' | 'withered' | 'frozen' | 'absorbing' | 'hardcore' | 'hunger' | 'underwater' | 'riding';
export const HUD_LOOKS: readonly HudLook[] = ['normal', 'poisoned', 'withered', 'frozen', 'absorbing', 'hardcore', 'hunger', 'underwater', 'riding'];

/** A picture ready to draw: its pixels and a canvas holding them */
export interface GuiImage {
  canvas: CanvasImageSource;
  data: ImageData;
  width: number;
  height: number;
}

export interface RenderSources {
  /** The pack's picture of a texture (null: still loading, or missing) */
  image(path: string): GuiImage | null;
  /** A picture with a colour multiplied in (leaves, the grass) */
  tinted(path: string, rgb: [number, number, number]): CanvasImageSource | null;
  /** An isometric block from a top and a side texture */
  iso(top: string, side: string): CanvasImageSource | null;
  /** The item with the glint over it, at `px` device pixels square */
  glinted(path: string, px: number, time: number): CanvasImageSource | null;
  /** The panorama as seen at a time, `w` × `h` pixels */
  panorama(w: number, h: number, time: number): CanvasImageSource | null;
  scaling(path: string): Scaling | null;
  font(): BitmapFont | null;
  /** The first of these textures the pack or game has (paths under the texture root, no extension) */
  pick(...names: string[]): string | null;
}

/** Text the preview draws inside the game's screens (in the page's language). */
export interface ScreenLabels {
  singleplayer: string;
  multiplayer: string;
  realms: string;
  options: string;
  quit: string;
  play: string;
  settings: string;
  dressingRoom: string;
  crafting: string;
  inventory: string;
  chest: string;
  largeChest: string;
  furnace: string;
  videoSettings: string;
  done: string;
  menuButtons: readonly string[];
}

export interface RenderState {
  screen: GuiScreen;
  container: ContainerId;
  look: HudLook;
  /** Hearts and hunger flash (the open texture is a flashing one) */
  flash: boolean;
  /** Animation time, ms */
  time: number;
  /** Pointer in GUI pixels */
  pointer: { x: number; y: number } | null;
  /** The piece open in the pixel editor */
  focus: string | null;
  /** The splash text shown (null: none) */
  splash: string | null;
  /** Menu screen over the world (in-game) instead of the title screen's background */
  inGame: boolean;
  labels: ScreenLabels;
  versionText: string;
}

export interface Hit extends Rect {
  path: string;
  piece?: GuiPiece;
  /** A texture that isn't a GUI piece (an item, a block) */
  name?: string;
}

const WHITE = 0xffffff;
const GREY = 0x404040;

/** The largest whole GUI scale that fits a screen of at least 320 × 240 GUI pixels (as the game picks it). */
export function guiScale(deviceW: number, deviceH: number, minW = 320, minH = 240): number {
  return Math.max(1, Math.min(Math.floor(deviceW / minW), Math.floor(deviceH / minH)));
}

export function renderGui(ctx: CanvasRenderingContext2D, W: number, H: number, R: number, cat: GuiCatalog, src: RenderSources, st: RenderState): Hit[] {
  const p = new Painter(ctx, R, cat, src, st);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, W * R, H * R);
  switch (st.screen) {
    case 'hud':
      p.scene(W, H);
      p.hud(W, H);
      break;
    case 'inventory':
      p.scene(W, H);
      p.fill(0, 0, W, H, 'rgba(16, 16, 16, 0.72)');
      p.container(W, H);
      break;
    case 'title':
      p.title(W, H);
      break;
    case 'menu':
      p.menu(W, H);
      break;
    case 'glint':
      p.glintScreen(W, H);
      break;
  }
  ctx.restore();
  return p.hits;
}

const hex = (c: number, a = 1) => `rgba(${(c >> 16) & 255}, ${(c >> 8) & 255}, ${c & 255}, ${a})`;

class Painter {
  readonly hits: Hit[] = [];
  private readonly edition: Edition;
  private readonly tintCache = new Map<string, HTMLCanvasElement>();

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly R: number,
    private readonly cat: GuiCatalog,
    private readonly src: RenderSources,
    private readonly st: RenderState,
  ) {
    this.edition = cat.edition;
  }

  // ---------------------------------------------------------------- primitives
  fill(x: number, y: number, w: number, h: number, colour: string): void {
    this.ctx.fillStyle = colour;
    this.ctx.fillRect(x * this.R, y * this.R, w * this.R, h * this.R);
  }

  private blit(img: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, x: number, y: number, w: number, h: number): void {
    if (sw <= 0 || sh <= 0 || w <= 0 || h <= 0) return;
    const R = this.R;
    this.ctx.drawImage(img, sx, sy, sw, sh, Math.round(x * R), Math.round(y * R), Math.round(w * R), Math.round(h * R));
  }

  private hit(x: number, y: number, w: number, h: number, path: string, piece?: GuiPiece, name?: string): void {
    this.hits.push({ x, y, w, h, path, ...(piece ? { piece } : {}), ...(name ? { name } : {}) });
  }

  /** A piece drawn whole into a GUI rectangle. */
  piece(id: string, x: number, y: number, w: number, h: number, opts: { hit?: boolean } = {}): boolean {
    const piece = this.cat.piece(id);
    if (!piece) return false;
    const img = this.src.image(piece.path);
    if (opts.hit !== false) this.hit(x, y, w, h, piece.path, piece);
    if (!img) return true;
    const r = pieceRect(piece, img);
    this.blit(img.canvas, r.x, r.y, r.w, r.h, x, y, w, h);
    return true;
  }

  /** Part of a piece: (sx, sy, sw, sh) in the piece's own GUI pixels (it is lw × lh), drawn at (x, y). */
  pieceSub(id: string, lw: number, lh: number, sx: number, sy: number, sw: number, sh: number, x: number, y: number): void {
    const piece = this.cat.piece(id);
    if (!piece || sw <= 0 || sh <= 0) return;
    const img = this.src.image(piece.path);
    this.hit(x, y, sw, sh, piece.path, piece);
    if (!img) return;
    const r = pieceRect(piece, img);
    const kx = r.w / lw;
    const ky = r.h / lh;
    this.blit(img.canvas, r.x + sx * kx, r.y + sy * ky, sw * kx, sh * ky, x, y, sw, sh);
  }

  /** The first of several pieces the version has. */
  any(ids: string[], x: number, y: number, w: number, h: number): void {
    for (const id of ids) if (this.piece(id, x, y, w, h)) return;
  }

  /** A sprite stretched to a size its own way: nine-slice (Java 1.20.2+, Bedrock), halves (old Java buttons), or plainly. */
  nine(id: string, x: number, y: number, w: number, h: number, base: { w: number; h: number }): void {
    const piece = this.cat.piece(id);
    if (!piece) return;
    const img = this.src.image(piece.path);
    this.hit(x, y, w, h, piece.path, piece);
    if (!img) return;
    const r = pieceRect(piece, img);
    const sc = this.src.scaling(piece.path);
    if (piece.region) {
      // the old atlases: the left half and the right half of the 200 × 20 button
      const kx = r.w / base.w;
      const half = Math.floor(w / 2);
      this.blit(img.canvas, r.x, r.y, half * kx, r.h, x, y, half, h);
      this.blit(img.canvas, r.x + (base.w - (w - half)) * kx, r.y, (w - half) * kx, r.h, x + half, y, w - half, h);
      return;
    }
    if (!sc || sc.type === 'stretch') {
      this.blit(img.canvas, r.x, r.y, r.w, r.h, x, y, w, h);
      return;
    }
    if (sc.type === 'tile') {
      const kx = r.w / sc.width;
      const ky = r.h / sc.height;
      for (let ty = 0; ty < h; ty += sc.height) for (let tx = 0; tx < w; tx += sc.width) this.blit(img.canvas, r.x, r.y, Math.min(sc.width, w - tx) * kx, Math.min(sc.height, h - ty) * ky, x + tx, y + ty, Math.min(sc.width, w - tx), Math.min(sc.height, h - ty));
      return;
    }
    const kx = r.w / sc.width;
    const ky = r.h / sc.height;
    const [bl, bt, br, bb] = sc.border.map((b, i) => Math.min(b, (i % 2 ? h : w) / 2)) as [number, number, number, number];
    const cols: [number, number, number, number][] = [
      [0, bl, 0, bl],
      [bl, sc.width - bl - br, bl, w - bl - br],
      [sc.width - br, br, w - br, br],
    ];
    const rows: [number, number, number, number][] = [
      [0, bt, 0, bt],
      [bt, sc.height - bt - bb, bt, h - bt - bb],
      [sc.height - bb, bb, h - bb, bb],
    ];
    for (const [sy, sh, dy, dh] of rows) {
      for (const [sx, sw, dx, dw] of cols) {
        if (dw <= 0 || dh <= 0 || sw <= 0 || sh <= 0) continue;
        if (sc.stretch || (sw >= dw && sh >= dh)) {
          // fits: the start of that strip (the game repeats it, which shows the same at these sizes)
          const cw = sc.stretch ? sw : Math.min(sw, dw);
          const ch = sc.stretch ? sh : Math.min(sh, dh);
          this.blit(img.canvas, r.x + sx * kx, r.y + sy * ky, cw * kx, ch * ky, x + dx, y + dy, dw, dh);
          continue;
        }
        for (let ty = 0; ty < dh; ty += sh) {
          for (let tx = 0; tx < dw; tx += sw) {
            const cw = Math.min(sw, dw - tx);
            const ch = Math.min(sh, dh - ty);
            this.blit(img.canvas, r.x + sx * kx, r.y + sy * ky, cw * kx, ch * ky, x + dx + tx, y + dy + ty, cw, ch);
          }
        }
      }
    }
  }

  /** A texture repeated over an area, `tw` × `th` GUI pixels per repeat, multiplied by a grey (0..1). */
  tiled(path: string, x: number, y: number, w: number, h: number, tw: number, th: number, shade = 1, piece?: GuiPiece): void {
    const img = this.src.image(path);
    if (piece) this.hit(x, y, w, h, path, piece);
    if (!img) return;
    const src = shade < 1 ? this.shaded(path, img, shade) : img.canvas;
    for (let ty = 0; ty < h; ty += th) {
      for (let tx = 0; tx < w; tx += tw) {
        const cw = Math.min(tw, w - tx);
        const ch = Math.min(th, h - ty);
        this.blit(src, 0, 0, (img.width * cw) / tw, (img.height * ch) / th, x + tx, y + ty, cw, ch);
      }
    }
  }

  private shaded(path: string, img: GuiImage, shade: number): HTMLCanvasElement {
    const key = `${path}|${shade}|${img.width}x${img.height}`;
    let c = this.tintCache.get(key);
    if (!c) {
      c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext('2d')!;
      g.drawImage(img.canvas, 0, 0);
      g.globalCompositeOperation = 'multiply';
      const v = Math.round(shade * 255);
      g.fillStyle = `rgb(${v}, ${v}, ${v})`;
      g.fillRect(0, 0, c.width, c.height);
      g.globalCompositeOperation = 'destination-in';
      g.drawImage(img.canvas, 0, 0);
      this.tintCache.set(key, c);
    }
    return c;
  }

  // ---------------------------------------------------------------- text
  /** Width of a text in GUI px. */
  textWidth(s: string): number {
    const f = this.src.font();
    if (f && f.canDraw(s.replace(/§./g, ''))) return f.width(s);
    this.ctx.font = this.fallbackFont();
    return Math.ceil(this.ctx.measureText(s.replace(/§./g, '')).width / this.R);
  }

  private fallbackFont(): string {
    return `${8 * this.R}px system-ui, sans-serif`;
  }

  text(s: string, x: number, y: number, colour = WHITE, shadow = true): void {
    if (shadow) this.textRaw(s, x + 1, y + 1, colour, true);
    this.textRaw(s, x, y, colour, false);
  }

  centered(s: string, cx: number, y: number, colour = WHITE, shadow = true): void {
    this.text(s, Math.round(cx - this.textWidth(s) / 2), y, colour, shadow);
  }

  private textRaw(s: string, x: number, y: number, colour: number, shadow: boolean): void {
    const f = this.src.font();
    const plain = s.replace(/§./g, '');
    const R = this.R;
    if (!f || !f.canDraw(plain)) {
      this.ctx.font = this.fallbackFont();
      this.ctx.textBaseline = 'top';
      let cx = x;
      for (const run of colourRuns(s, colour)) {
        this.ctx.fillStyle = hex(shadow ? (run.colour >> 2) & 0x3f3f3f : run.colour);
        this.ctx.fillText(run.text, cx * R, y * R);
        cx += this.ctx.measureText(run.text).width / R;
      }
      return;
    }
    let cx = x;
    for (const run of colourRuns(s, colour)) {
      const c = shadow ? (run.colour >> 2) & 0x3f3f3f : run.colour;
      for (const ch of run.text) {
        if (ch === ' ') {
          cx += 4;
          continue;
        }
        const g = f.glyph(ch);
        if (!g) continue;
        const sheet = this.glyphSheet(g.path, c);
        if (sheet) this.blit(sheet, g.sx, g.sy, g.sw, g.sh, cx, y + g.dy, g.w, g.h);
        cx += g.advance;
      }
    }
  }

  /** A font picture in one colour. */
  private glyphSheet(path: string, colour: number): HTMLCanvasElement | null {
    const img = this.src.image(path);
    if (!img) return null;
    const key = `font|${path}|${colour}|${img.width}x${img.height}`;
    let c = this.tintCache.get(key);
    if (!c) {
      c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext('2d')!;
      g.drawImage(img.canvas, 0, 0);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = hex(colour);
      g.fillRect(0, 0, c.width, c.height);
      this.tintCache.set(key, c);
    }
    return c;
  }

  // ---------------------------------------------------------------- items
  private tex(...names: string[]): string | null {
    return this.src.pick(...names);
  }

  item(names: string[], x: number, y: number, opts: { glint?: boolean; count?: number } = {}): void {
    const path = this.tex(...names);
    if (!path) return;
    const img = this.src.image(path);
    this.hit(x, y, 16, 16, path, undefined, names[0]);
    if (!img) return;
    if (opts.glint) {
      const g = this.src.glinted(path, 16 * this.R, this.st.time);
      if (g) this.ctx.drawImage(g, x * this.R, y * this.R, 16 * this.R, 16 * this.R);
    } else {
      // first frame of an animated strip
      this.blit(img.canvas, 0, 0, img.width, Math.min(img.height, img.width), x, y, 16, 16);
    }
    if (opts.count && opts.count > 1) {
      const s = String(opts.count);
      this.text(s, x + 19 - 2 - this.textWidth(s), y + 6 + 3);
    }
  }

  block(top: string[], side: string[], x: number, y: number, count?: number): void {
    const t = this.tex(...top);
    const s = this.tex(...side) ?? t;
    if (!t || !s) return;
    this.hit(x, y, 16, 16, s, undefined, side[0]);
    const iso = this.src.iso(t, s);
    if (iso) this.ctx.drawImage(iso, x * this.R, y * this.R, 16 * this.R, 16 * this.R);
    if (count && count > 1) {
      const c = String(count);
      this.text(c, x + 19 - 2 - this.textWidth(c), y + 6 + 3);
    }
  }

  // ---------------------------------------------------------------- the world behind the HUD
  scene(W: number, H: number): void {
    const R = this.R;
    const g = this.ctx.createLinearGradient(0, 0, 0, H * R);
    g.addColorStop(0, '#78a7ff');
    g.addColorStop(0.65, '#bcd4ff');
    g.addColorStop(1, '#c8dcff');
    this.ctx.fillStyle = g;
    this.ctx.fillRect(0, 0, W * R, H * R);
    // clouds
    for (const [cx, cy, cw] of [[0.12, 0.12, 44], [0.55, 0.07, 64], [0.84, 0.18, 36]] as const) {
      const x = ((cx * W + this.st.time / 400) % (W + cw)) - cw;
      this.fill(x, cy * H, cw, 8, 'rgba(255, 255, 255, 0.92)');
      this.fill(x + 8, cy * H + 8, cw - 16, 4, 'rgba(245, 245, 250, 0.9)');
    }
    const grass = this.tex('block/grass_block_side', 'blocks/grass_side_carried', 'blocks/grass_side');
    const dirt = this.tex('block/dirt', 'blocks/dirt');
    const stone = this.tex('block/stone', 'blocks/stone');
    const log = this.tex('block/oak_log', 'blocks/log_oak');
    const leaves = this.tex('block/oak_leaves', 'blocks/leaves_oak', 'blocks/leaves_oak_carried');
    const B = 16;
    const cols = Math.ceil(W / B) + 1;
    const ground = (i: number) => Math.round(2.6 + Math.sin(i * 0.55) * 0.9 + Math.sin(i * 1.7 + 1) * 0.5);
    for (let i = 0; i < cols; i++) {
      const top = ground(i);
      const x = i * B;
      for (let j = 0; j < top + 2; j++) {
        const y = H - (top - j) * B - 20;
        const path = j === 0 ? grass : j < 3 ? dirt : stone;
        const img = path ? this.src.image(path) : null;
        if (img) this.blit(img.canvas, 0, 0, img.width, Math.min(img.width, img.height), x, y, B, B);
        else this.fill(x, y, B, B, j === 0 ? '#5d9b3a' : j < 3 ? '#86603e' : '#7d7d7d');
      }
    }
    // a tree
    const ti = Math.max(2, Math.floor(cols * 0.72));
    const tx = ti * B;
    const tTop = H - ground(ti) * B - 20;
    const logImg = log ? this.src.image(log) : null;
    for (let k = 1; k <= 4; k++) {
      if (logImg) this.blit(logImg.canvas, 0, 0, logImg.width, Math.min(logImg.width, logImg.height), tx, tTop - k * B, B, B);
      else this.fill(tx, tTop - k * B, B, B, '#6b5132');
    }
    const lv = leaves ? this.src.tinted(leaves, [0x77, 0xab, 0x2f]) : null;
    const leafImg = leaves ? this.src.image(leaves) : null;
    for (const [dx, dy] of [[-2, 4], [-1, 4], [0, 5], [1, 4], [2, 4], [-1, 5], [1, 5], [0, 6], [-2, 3], [2, 3], [-1, 3], [1, 3]] as const) {
      if (lv && leafImg) this.blit(lv, 0, 0, leafImg.width, Math.min(leafImg.width, leafImg.height), tx + dx * B, tTop - dy * B, B, B);
      else this.fill(tx + dx * B, tTop - dy * B, B, B, '#4c8a25');
    }
  }

  // ---------------------------------------------------------------- HUD
  hud(W: number, H: number): void {
    const st = this.st;
    const bedrock = this.edition === 'bedrock';
    const left = Math.floor(W / 2) - 91;
    const right = Math.floor(W / 2) + 91;
    // crosshair, drawn inverted over what's behind it (white shows as the opposite colour)
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'difference';
    this.piece('crosshair.crosshair', Math.floor(W / 2) - 7, Math.floor(H / 2) - 7, 15, 15);
    this.ctx.restore();

    // hotbar
    const sel = 0;
    if (bedrock) {
      this.piece('hotbar.startCap', left, H - 22, 1, 22);
      for (let i = 0; i < 9; i++) this.piece(`hotbar.slot${i + 1}`, left + 1 + i * 20, H - 22, 20, 22);
      this.piece('hotbar.endCap', right - 1, H - 22, 1, 22);
    } else this.piece('hotbar.bar', left, H - 22, 182, 22);
    const items: (() => void)[] = HOTBAR.map((it, i) => () => {
      const x = left + 3 + i * 20;
      const y = H - 19;
      if (it.block) this.block(it.block[0], it.block[1], x, y, it.count);
      else this.item(it.item!, x, y, { glint: it.glint, count: it.count });
    });
    items.forEach((f) => f());
    const selPiece = this.cat.piece('hotbar.selected');
    if (selPiece) this.piece('hotbar.selected', left - 1 + sel * 20, H - 23, 24, selPiece.region || bedrock ? 24 : 23);
    if (this.cat.piece('hotbar.offhandLeft')) {
      this.piece('hotbar.offhandLeft', left - 29, H - 23, 29, 24);
      this.item(['block/torch', 'blocks/torch_on'], left - 26, H - 19);
    }

    // experience bar and level
    const xpY = H - 29;
    const progress = Math.round(182 * 0.62);
    if (bedrock) {
      this.nine('xp.empty', left, xpY, 182, 5, { w: 13, h: 5 });
      this.nine('xp.full', left, xpY, progress, 5, { w: 13, h: 5 });
      this.piece('xp.nub', left + progress - 6, xpY, 11, 5);
    } else {
      this.piece('xp.empty', left, xpY, 182, 5);
      this.pieceSub('xp.full', 182, 5, 0, 0, progress, 5, left, xpY);
    }
    const level = '30';
    const lx = Math.round(W / 2 - this.textWidth(level) / 2);
    const ly = H - 35;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) this.text(level, lx + dx, ly + dy, 0, false);
    this.text(level, lx, ly, 0x80ff20, false);

    // hearts
    const heartY = H - 39;
    const look = st.look;
    const fl = (k: string) => (st.flash ? `${k}Flash` : k);
    const heartPart = look === 'poisoned' ? 'heartsPoisoned' : look === 'withered' ? 'heartsWithered' : look === 'frozen' ? 'heartsFrozen' : look === 'hardcore' ? 'heartsHardcore' : 'hearts';
    const health = 17;
    for (let i = 0; i < 10; i++) {
      const x = left + i * 8;
      const y = heartY;
      this.any([`${heartPart}.${fl('empty')}`, `${heartPart}.empty`, `hearts.${fl('empty')}`, 'hearts.empty'], x, y, 9, 9);
      const key = i * 2 + 1 < health ? 'full' : i * 2 + 1 === health ? 'half' : null;
      if (key) this.any([`${heartPart}.${fl(key)}`, `${heartPart}.${key}`], x, y, 9, 9);
    }
    let rowY = heartY - 10;
    if (look === 'absorbing') {
      for (let i = 0; i < 4; i++) {
        const x = left + i * 8;
        this.any([`hearts.${fl('empty')}`, 'hearts.empty'], x, rowY, 9, 9);
        this.any([`heartsAbsorbing.${fl(i === 3 ? 'half' : 'full')}`, `heartsAbsorbing.${i === 3 ? 'half' : 'full'}`], x, rowY, 9, 9);
      }
      rowY -= 10;
    }
    // armour
    const armor = 13;
    for (let i = 0; i < 10; i++) {
      const key = i * 2 + 1 < armor ? 'full' : i * 2 + 1 === armor ? 'half' : 'empty';
      this.piece(`armor.${key}`, left + i * 8, rowY, 9, 9);
    }
    // hunger, or the mount's health while riding
    if (look === 'riding') {
      const mount = 15;
      for (let i = 0; i < 10; i++) {
        const x = right - i * 8 - 9;
        this.any(['heartsMount.empty', 'hearts.empty'], x, heartY, 9, 9);
        const key = i * 2 + 1 < mount ? 'full' : i * 2 + 1 === mount ? 'half' : null;
        if (key) this.any([`heartsMount.${fl(key)}`, `heartsMount.${key}`], x, heartY, 9, 9);
      }
    } else {
      const part = look === 'hunger' ? 'foodHunger' : 'food';
      const food = 15;
      for (let i = 0; i < 10; i++) {
        const x = right - i * 8 - 9;
        this.any([`${part}.${fl('empty')}`, `${part}.empty`], x, heartY, 9, 9);
        const key = i * 2 + 1 < food ? 'full' : i * 2 + 1 === food ? 'half' : null;
        if (key) this.any([`${part}.${fl(key)}`, `${part}.${key}`], x, heartY, 9, 9);
      }
    }
    if (look === 'underwater') {
      for (let i = 0; i < 10; i++) {
        const x = right - i * 8 - 9;
        const key = i < 7 ? 'full' : i === 7 ? 'popping' : 'empty';
        this.piece(`air.${key}`, x, heartY - 10, 9, 9);
      }
    }
  }

  // ---------------------------------------------------------------- containers
  container(W: number, H: number): void {
    const c = this.st.container;
    const L = this.st.labels;
    const bedrock = this.edition === 'bedrock';
    const rows = c === 'largeChest' ? 6 : 3;
    const h = c === 'chest' || c === 'largeChest' ? rows * 18 + 17 + 96 : 166;
    const x = Math.floor((W - 176) / 2);
    const y = Math.floor((H - h) / 2);
    const slots: [number, number][] = [];
    const slot = (sx: number, sy: number) => slots.push([x + sx, y + sy]);
    // the player's inventory, at the bottom of every screen
    const invTop = c === 'chest' || c === 'largeChest' ? rows * 18 + 31 : 84;
    for (let r = 0; r < 3; r++) for (let k = 0; k < 9; k++) slot(8 + k * 18, invTop + r * 18);
    for (let k = 0; k < 9; k++) slot(8 + k * 18, invTop + 58);

    if (bedrock) {
      this.nine('window.panel', x, y, 176, h, { w: 16, h: 16 });
    } else {
      const file = { inventory: 'inventory', chest: 'chest', largeChest: 'chest', furnace: 'furnace', crafting: 'crafting' }[c];
      const id = `${file}.window`;
      if (c === 'chest' || c === 'largeChest') {
        this.pieceAt(id, 0, 0, 176, rows * 18 + 17, x, y);
        this.pieceAt(id, 0, 126, 176, 96, x, y + rows * 18 + 17);
      } else this.pieceAt(id, 0, 0, 176, 166, x, y);
    }

    const t = this.st.time;
    switch (c) {
      case 'inventory': {
        for (let i = 0; i < 4; i++) slot(8, 8 + i * 18);
        for (let r = 0; r < 2; r++) for (let k = 0; k < 2; k++) slot(98 + k * 18, 18 + r * 18);
        slot(154, 28);
        if (!bedrock) this.text(L.crafting, x + 97, y + 8, GREY, false);
        this.player(x + 51, y + 12);
        break;
      }
      case 'chest':
      case 'largeChest':
        for (let r = 0; r < rows; r++) for (let k = 0; k < 9; k++) slot(8 + k * 18, 18 + r * 18);
        this.text(c === 'chest' ? L.chest : L.largeChest, x + 8, y + 6, GREY, false);
        this.text(L.inventory, x + 8, y + rows * 18 + 19, GREY, false);
        break;
      case 'furnace': {
        slot(56, 17);
        slot(56, 53);
        slot(116, 35);
        this.centered(L.furnace, x + 88, y + 6, GREY, false);
        this.text(L.inventory, x + 8, y + 72, GREY, false);
        const burn = 1 - (t % 8000) / 8000;
        const lit = Math.ceil(burn * 13) + 1;
        this.pieceSub('furnace.flame', 14, 14, 0, 14 - lit, 14, lit, x + 56, y + 36 + 14 - lit);
        const arrow = this.cat.piece('furnace.arrow');
        const ah = arrow?.region ? 17 : 16;
        this.pieceSub('furnace.arrow', 24, ah, 0, 0, Math.round(((t % 4000) / 4000) * 24) + 1, ah, x + 79, y + 34);
        break;
      }
      case 'crafting':
        for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) slot(30 + k * 18, 17 + r * 18);
        slot(124, 35);
        this.text(L.crafting, x + 29, y + 6, GREY, false);
        this.text(L.inventory, x + 8, y + 72, GREY, false);
        break;
    }
    if (bedrock) {
      for (const [sx, sy] of slots) this.nine('window.slot', sx - 1, sy - 1, 18, 18, { w: 5, h: 5 });
      if (c === 'inventory') this.player(x + 51, y + 12);
    }
    // items
    const at = (i: number) => slots[i];
    HOTBAR.forEach((it, i) => {
      const [sx, sy] = at(27 + i);
      if (it.block) this.block(it.block[0], it.block[1], sx, sy, it.count);
      else this.item(it.item!, sx, sy, { glint: it.glint, count: it.count });
    });
    INVENTORY.forEach((it) => {
      const [sx, sy] = at(it.slot);
      if (it.block) this.block(it.block[0], it.block[1], sx, sy, it.count);
      else this.item(it.item!, sx, sy, { count: it.count, glint: it.glint });
    });
    const extra = 36;
    if (c === 'furnace') {
      this.block(['block/cobblestone', 'blocks/cobblestone'], ['block/cobblestone', 'blocks/cobblestone'], ...at(extra), 12);
      this.item(['item/coal', 'items/coal'], ...at(extra + 1), { count: 7 });
      this.block(['block/stone', 'blocks/stone'], ['block/stone', 'blocks/stone'], ...at(extra + 2), 4);
    } else if (c === 'crafting') {
      for (const k of [0, 1, 3, 4]) this.block(PLANKS, PLANKS, ...at(extra + k));
      this.block(['block/crafting_table_top', 'blocks/crafting_table_top'], ['block/crafting_table_front', 'blocks/crafting_table_front'], ...at(extra + 9));
    } else if (c === 'chest' || c === 'largeChest') {
      const loot = [
        { slot: 1, item: ['item/diamond', 'items/diamond'], count: 5 },
        { slot: 4, item: ['item/gold_ingot', 'items/gold_ingot'], count: 9 },
        { slot: 10, item: ['item/emerald', 'items/emerald'], count: 3 },
        { slot: 15, item: ['item/name_tag', 'items/name_tag'] },
        { slot: 20, item: ['item/saddle', 'items/saddle'] },
      ];
      for (const l of loot) this.item(l.item, ...at(extra + l.slot), { count: l.count });
    }
  }

  /** Part of a whole container texture (in its 256 × 256 pixels) at a GUI place. */
  private pieceAt(id: string, sx: number, sy: number, sw: number, sh: number, x: number, y: number): void {
    const piece = this.cat.piece(id);
    if (!piece) return;
    const img = this.src.image(piece.path);
    this.hit(x, y, sw, sh, piece.path, piece);
    if (!img) return;
    const k = img.width / 256;
    this.blit(img.canvas, sx * k, sy * k, sw * k, sh * k, x, y, sw, sh);
  }

  /** The player seen from the front in the inventory's box (top centre at x, y). */
  private player(x: number, y: number): void {
    const path = this.tex('entity/player/wide/steve', 'entity/steve');
    const img = path ? this.src.image(path) : null;
    if (!path || !img) return;
    const k = img.width / 64;
    const tall = img.height >= img.width;
    const part = (sx: number, sy: number, sw: number, sh: number, dx: number, dy: number) => this.blit(img.canvas, sx * k, sy * k, sw * k, sh * k, x + dx, y + dy, sw * 2, sh * 2);
    part(8, 8, 8, 8, -8, 0);
    part(20, 20, 8, 12, -8, 16);
    part(44, 20, 4, 12, -16, 16);
    if (tall) part(36, 52, 4, 12, 8, 16);
    else part(44, 20, 4, 12, 8, 16);
    part(4, 20, 4, 12, -8, 40);
    if (tall) part(20, 52, 4, 12, 0, 40);
    else part(4, 20, 4, 12, 0, 40);
    // hat layer
    part(40, 8, 8, 8, -8, 0);
    this.hit(x - 16, y, 32, 64, path, undefined, 'steve');
  }

  // ---------------------------------------------------------------- title screen
  private panoramaBackground(W: number, H: number, dim = 0): void {
    const pano = this.src.panorama(W, H, this.st.time);
    const R = this.R;
    if (pano) {
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.drawImage(pano, 0, 0, W * R, H * R);
      this.ctx.imageSmoothingEnabled = false;
    } else this.fill(0, 0, W, H, '#1d2230');
    const overlay = this.cat.piece('panorama.overlay');
    if (overlay) {
      const img = this.src.image(overlay.path);
      if (img && img.width > 2) {
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.drawImage(img.canvas, 0, 0, W * R, H * R);
        this.ctx.imageSmoothingEnabled = false;
      }
    }
    if (dim) this.fill(0, 0, W, H, `rgba(0, 0, 0, ${dim})`);
    // the faces are hit-tested by the preview (where the panorama shows)
  }

  title(W: number, H: number): void {
    const st = this.st;
    const L = st.labels;
    this.panoramaBackground(W, H);
    const bedrock = this.edition === 'bedrock';
    // logo
    const logoY = 30;
    if (bedrock) {
      const logo = this.cat.piece('logo.logo');
      const img = logo ? this.src.image(logo.path) : null;
      const w = Math.min(W - 40, 260);
      const h = img ? Math.round((w * img.height) / img.width) : 45;
      const lx = Math.floor((W - w) / 2);
      if (logo) this.hit(lx, logoY - 6, w, h, logo.path, logo);
      if (img) {
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.drawImage(img.canvas, lx * this.R, (logoY - 6) * this.R, w * this.R, h * this.R);
        this.ctx.imageSmoothingEnabled = false;
      }
    } else {
      const logo = this.cat.piece('logo.logo');
      const img = logo ? this.src.image(logo.path) : null;
      if (logo && img) {
        if (img.width === img.height) {
          // up to 1.19: two halves of a 256 × 256 picture side by side
          const k = img.width / 256;
          const lx = Math.floor(W / 2) - 137;
          this.blit(img.canvas, 0, 0, 155 * k, 44 * k, lx, logoY, 155, 44);
          this.blit(img.canvas, 0, 45 * k, 155 * k, 44 * k, lx + 155, logoY, 155, 44);
          this.hit(lx, logoY, 274, 44, logo.path, logo);
        } else {
          const k = img.width / 256;
          const lx = Math.floor(W / 2) - 128;
          this.blit(img.canvas, 0, 0, 256 * k, 44 * k, lx, logoY, 256, 44);
          this.hit(lx, logoY, 256, 44, logo.path, logo);
        }
      }
      const ed = this.cat.piece('logo.edition');
      const eimg = ed ? this.src.image(ed.path) : null;
      if (ed && eimg) {
        const k = eimg.width / 128;
        const modern = img ? img.width !== img.height : true;
        const ex = modern ? Math.floor(W / 2) - 64 : Math.floor(W / 2) - 137 + 88;
        const ey = modern ? logoY + 44 - 7 : 67;
        const ew = modern ? 128 : 98;
        this.blit(eimg.canvas, 0, 0, ew * k, 14 * k, ex, ey, ew, 14);
        this.hit(ex, ey, ew, 14, ed.path, ed);
      }
    }
    // splash
    if (st.splash) {
      const s = st.splash;
      const R = this.R;
      const pulse = 1.8 - Math.abs(Math.sin(((st.time % 1000) / 1000) * Math.PI * 2) * 0.1);
      const scale = (pulse * 100) / (this.textWidth(s) + 32);
      this.ctx.save();
      this.ctx.translate((W / 2 + 90) * R, 70 * R);
      this.ctx.rotate((-20 * Math.PI) / 180);
      this.ctx.scale(scale, scale);
      this.ctx.translate(-(W / 2 + 90) * R, -70 * R);
      this.centered(s, W / 2 + 90, 70 - 8, 0xffff00);
      this.ctx.restore();
    }
    // buttons
    const y0 = Math.floor(H / 4) + 48;
    const cx = Math.floor(W / 2);
    const disabled = st.focus === 'button.disabled' || st.focus === 'button.pressed';
    const buttons: [string, number, number, number, boolean][] = bedrock
      ? [
          [L.play, cx - 100, y0, 200, false],
          [L.settings, cx - 100, y0 + 24, 200, false],
          [L.dressingRoom, cx - 100, y0 + 48, 200, disabled],
        ]
      : [
          [L.singleplayer, cx - 100, y0, 200, false],
          [L.multiplayer, cx - 100, y0 + 24, 200, false],
          [L.realms, cx - 100, y0 + 48, 200, disabled],
          [L.options, cx - 100, y0 + 84, 98, false],
          [L.quit, cx + 2, y0 + 84, 98, false],
        ];
    this.buttons(buttons, 1);
    if (!bedrock) this.text(st.versionText, 2, H - 10);
  }

  /** Buttons: [label, x, y, width, disabled]; the one under the pointer (or `hoverIndex`) is highlighted. */
  private buttons(list: [string, number, number, number, boolean][], hoverIndex: number): void {
    const p = this.st.pointer;
    const under = p ? list.findIndex(([, x, y, w]) => p.x >= x && p.x < x + w && p.y >= y && p.y < y + 20) : -1;
    const hov = p ? under : hoverIndex;
    const bedrock = this.edition === 'bedrock';
    list.forEach(([label, x, y, w, off], i) => {
      const state = off ? (bedrock ? 'pressed' : 'disabled') : i === hov ? 'hover' : 'normal';
      this.nine(`button.${state}`, x, y, w, 20, { w: bedrock ? 5 : 200, h: bedrock ? 5 : 20 });
      this.centered(label, x + w / 2, y + 6, off ? 0xa0a0a0 : i === hov ? 0xffffa0 : WHITE);
    });
  }

  // ---------------------------------------------------------------- menu (a list screen, like Video Settings)
  menu(W: number, H: number): void {
    const st = this.st;
    const L = st.labels;
    const modern = !!this.cat.piece('backgrounds.menu');
    const top = 32;
    const bottom = H - 32;
    if (modern) {
      if (st.inGame) this.scene(W, H);
      else this.panoramaBackground(W, H);
      const bg = this.cat.piece(st.inGame ? 'backgrounds.inworldMenu' : 'backgrounds.menu') ?? this.cat.piece('backgrounds.menu');
      if (bg) this.tiled(bg.path, 0, 0, W, H, 32, 32, 1, bg);
      const list = this.cat.piece(st.inGame ? 'backgrounds.inworldList' : 'backgrounds.list') ?? this.cat.piece('backgrounds.list');
      if (list) this.tiled(list.path, 0, top, W, bottom - top, 32, 32, 1, list);
      const hs = this.cat.piece('backgrounds.headerSeparator');
      const fs = this.cat.piece('backgrounds.footerSeparator');
      if (hs) this.tiled(hs.path, 0, top - 2, W, 2, 32, 2, 1, hs);
      if (fs) this.tiled(fs.path, 0, bottom, W, 2, 32, 2, 1, fs);
    } else {
      const dirt = this.cat.piece('backgrounds.dirt');
      if (st.inGame) {
        this.scene(W, H);
        this.fill(0, 0, W, H, 'rgba(16, 16, 16, 0.75)');
      } else if (dirt) this.tiled(dirt.path, 0, 0, W, H, 32, 32, 64 / 255, dirt);
      else this.fill(0, 0, W, H, '#2a2a2a');
      if (dirt && !st.inGame) {
        // the list: darker, with soft shadows at its edges
        this.tiled(dirt.path, 0, top, W, bottom - top, 32, 32, 32 / 255);
        const g = this.ctx.createLinearGradient(0, top * this.R, 0, (top + 4) * this.R);
        g.addColorStop(0, 'rgba(0, 0, 0, 1)');
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        this.ctx.fillStyle = g;
        this.ctx.fillRect(0, top * this.R, W * this.R, 4 * this.R);
        const g2 = this.ctx.createLinearGradient(0, (bottom - 4) * this.R, 0, bottom * this.R);
        g2.addColorStop(0, 'rgba(0, 0, 0, 0)');
        g2.addColorStop(1, 'rgba(0, 0, 0, 1)');
        this.ctx.fillStyle = g2;
        this.ctx.fillRect(0, (bottom - 4) * this.R, W * this.R, 4 * this.R);
      }
    }
    this.centered(L.videoSettings, W / 2, 12);
    const cx = Math.floor(W / 2);
    const bw = Math.min(150, Math.floor((W - 30) / 2));
    const list: [string, number, number, number, boolean][] = [];
    L.menuButtons.forEach((label, i) => {
      const y = top + 6 + Math.floor(i / 2) * 24;
      if (y + 20 > bottom - 2) return;
      list.push([label, i % 2 ? cx + 5 : cx - 5 - bw, y, bw, i === 3]);
    });
    list.push([L.done, cx - 100, bottom + 6, 200, false]);
    this.buttons(list, -1);
  }

  // ---------------------------------------------------------------- enchanted items
  glintScreen(W: number, H: number): void {
    const bg = this.ctx.createLinearGradient(0, 0, 0, H * this.R);
    bg.addColorStop(0, '#2b2238');
    bg.addColorStop(1, '#141019');
    this.ctx.fillStyle = bg;
    this.ctx.fillRect(0, 0, W * this.R, H * this.R);
    const size = Math.max(32, Math.min(64, Math.floor((W - 40) / 3 / 16) * 16));
    const gap = Math.round(size / 3);
    const total = size * 3 + gap * 2;
    const x0 = Math.floor((W - total) / 2);
    const y0 = Math.floor((H - size) / 2) - 8;
    GLINT_ITEMS.forEach((names, i) => {
      const path = this.tex(...names);
      if (!path) return;
      const x = x0 + i * (size + gap);
      this.fill(x - 4, y0 - 4, size + 8, size + 8, 'rgba(255, 255, 255, 0.06)');
      const g = this.src.glinted(path, size * this.R, this.st.time);
      if (g) this.ctx.drawImage(g, x * this.R, y0 * this.R, size * this.R, size * this.R);
      this.hit(x, y0, size, size, path, undefined, names[0]);
    });
    // the glint texture itself, scrolling under the items
    const item = this.cat.piece('glint.item');
    if (item) {
      const img = this.src.image(item.path);
      const sy = y0 + size + 18;
      const sh = Math.min(24, H - sy - 6);
      if (img && sh > 4) {
        const off = ((this.st.time / 40) % img.width) | 0;
        for (let x = -off; x < W; x += Math.max(1, Math.round((img.width * sh) / img.height))) {
          this.blit(img.canvas, 0, 0, img.width, img.height, x, sy, Math.round((img.width * sh) / img.height), sh);
        }
        this.hit(0, sy, W, sh, item.path, item);
      }
    }
  }
}

const PLANKS = ['block/oak_planks', 'blocks/planks_oak'];

interface Stack {
  item?: string[];
  block?: [string[], string[]];
  count?: number;
  glint?: boolean;
}

/** What the hotbar holds (texture names across versions, newest first). */
const HOTBAR: Stack[] = [
  { item: ['item/diamond_sword', 'items/diamond_sword'], glint: true },
  { item: ['item/iron_pickaxe', 'items/iron_pickaxe'] },
  { item: ['item/bow', 'items/bow_standby'] },
  { block: [['block/cobblestone', 'blocks/cobblestone'], ['block/cobblestone', 'blocks/cobblestone']], count: 64 },
  { block: [PLANKS, PLANKS], count: 32 },
  { item: ['item/apple', 'items/apple'], count: 5 },
  { item: ['item/bread', 'items/bread'], count: 12 },
  { item: ['block/torch', 'blocks/torch_on'], count: 48 },
  { item: ['item/water_bucket', 'items/bucket_water'] },
];

/** A few things in the main inventory (slot index: 0–26). */
const INVENTORY: (Stack & { slot: number })[] = [
  { slot: 0, item: ['item/iron_ingot', 'items/iron_ingot'], count: 23 },
  { slot: 2, item: ['item/coal', 'items/coal'], count: 40 },
  { slot: 9, item: ['item/enchanted_book', 'items/book_enchanted'], glint: true },
  { slot: 13, block: [['block/dirt', 'blocks/dirt'], ['block/dirt', 'blocks/dirt']], count: 64 },
  { slot: 21, item: ['item/arrow', 'items/arrow'], count: 64 },
];

const GLINT_ITEMS: string[][] = [
  ['item/diamond_sword', 'items/diamond_sword'],
  ['item/enchanted_book', 'items/book_enchanted'],
  ['item/diamond_pickaxe', 'items/diamond_pickaxe'],
];
