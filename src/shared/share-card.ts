// Picture cards to post (texture packs, skins): one fixed 1200×675 PNG drawn on a canvas in the
// site's colours, with a small site credit, then offered to the phone's share sheet or downloaded.
// Loaded only when someone asks for a picture (each editor imports its card module on click).

import { sanitizeFilename, saveBlob } from '../core/download';
import { logoSvgMarkup } from '../ui/logo';

/** 16:9, the shape Discord, Reddit and X show whole in a post. */
export const CARD_W = 1200;
export const CARD_H = 675;
export const CARD_PAD = 56;

/** The dark theme's tokens (src/styles/tokens.css): a card looks the same whatever theme made it. */
export const CARD_COLORS = {
  bg: '#0d0f14',
  bgElev: '#12151c',
  surface: '#181c25',
  surface2: '#1f2430',
  surface3: '#282e3c',
  border: '#2a3140',
  borderStrong: '#3a4254',
  text: '#eef1f7',
  text2: '#b4bccb',
  text3: '#8c95a8',
  green: '#5bd35b',
  blue: '#4fb3ff',
} as const;

/**
 * Texel (the site's pixel font: Latin, Greek, Cyrillic) first; anything it lacks (kana, kanji,
 * other scripts, emoji) falls back per character to a system font, as the Japanese pages do.
 */
const FONT_STACK =
  "'Texel', 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'BIZ UDPGothic', 'Yu Gothic UI', 'Yu Gothic', Meiryo, 'Noto Sans JP', 'Noto Sans CJK JP', 'IPAPGothic', 'IPAGothic', system-ui, sans-serif";

export const CREDIT = 'texturepackmaker.com';

/** A canvas font. Texel is drawn on an 8px grid: sizes that are multiples of 8 stay crisp. */
export function cardFont(size: number, bold = false, italic = false): string {
  return `${italic ? 'italic ' : ''}${bold ? 700 : 400} ${size}px ${FONT_STACK}`;
}

/**
 * Waits until the fonts the card uses are here: Texel comes in parts by unicode-range, and a part is
 * only fetched for text that needs it, so each font is loaded with the text it will draw.
 */
export async function loadCardFonts(uses: { font: string; text: string }[]): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  await Promise.all(uses.map((u) => document.fonts.load(u.font, u.text || 'A').catch(() => undefined)));
  await document.fonts.ready;
}

export interface Card {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

export function createCard(): Card {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.imageSmoothingEnabled = false;
  ctx.textBaseline = 'alphabetic';
  return { canvas, ctx };
}

/** Accent colour with an alpha (hex in, rgba out). */
export function withAlpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** The editor's stage: dark ground, a faint pixel grid, a glow in the tool colour behind the hero. */
export function paintBackdrop(ctx: CanvasRenderingContext2D, accent: string, glow: { x: number; y: number; r: number }): void {
  const c = CARD_COLORS;
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  for (let x = 24; x < CARD_W; x += 24) ctx.fillRect(x, 0, 2, CARD_H);
  for (let y = 27; y < CARD_H; y += 24) ctx.fillRect(0, y, CARD_W, 2);
  const g = ctx.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, glow.r);
  g.addColorStop(0, withAlpha(accent, 0.26));
  g.addColorStop(0.55, withAlpha(accent, 0.08));
  g.addColorStop(1, withAlpha(accent, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  // a darker floor so the credit line reads on any glow
  const floor = ctx.createLinearGradient(0, CARD_H - 140, 0, CARD_H);
  floor.addColorStop(0, 'rgba(13, 15, 20, 0)');
  floor.addColorStop(1, 'rgba(13, 15, 20, 0.85)');
  ctx.fillStyle = floor;
  ctx.fillRect(0, CARD_H - 140, CARD_W, 140);
  // a bar of the tool colour along the top edge
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, CARD_W, 6);
}

let logoPolys: { pts: number[]; fill: string }[] | null = null;

/** The site's grass block mark (the same polygons as the favicon), drawn at `size` px. */
export function paintLogo(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  logoPolys ??= [...logoSvgMarkup().matchAll(/points="([^"]+)" fill="([^"]+)"/g)].map((m) => ({ pts: m[1].split(/[ ,]/).map(Number), fill: m[2] }));
  const k = size / 32;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 0.35 * k;
  for (const p of logoPolys) {
    ctx.beginPath();
    for (let i = 0; i < p.pts.length; i += 2) ctx.lineTo(x + p.pts[i] * k, y + p.pts[i + 1] * k);
    ctx.closePath();
    ctx.fillStyle = p.fill;
    ctx.strokeStyle = p.fill;
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** The site credit: the mark and the address, its right edge at `right`, its baseline at `base`. */
export function paintCredit(ctx: CanvasRenderingContext2D, right: number, base: number): void {
  ctx.save();
  ctx.font = cardFont(24);
  ctx.textAlign = 'right';
  ctx.fillStyle = CARD_COLORS.text2;
  ctx.fillText(CREDIT, right, base);
  const w = ctx.measureText(CREDIT).width;
  paintLogo(ctx, right - w - 12 - 32, base - 26, 32);
  ctx.restore();
}

export function fillRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string, line = 2): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = line;
    ctx.strokeStyle = stroke;
    ctx.beginPath();
    ctx.roundRect(x + line / 2, y + line / 2, w - line, h - line, Math.max(0, r - line / 2));
    ctx.stroke();
  }
}

/** A checkerboard (what transparent pixels show in the editor), clipped to a rounded box. */
export function paintChecker(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, cell = 8): void {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.clip();
  ctx.fillStyle = '#1d222c';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#2b313e';
  for (let j = 0; j * cell < h; j++) for (let i = j % 2; i * cell < w; i += 2) ctx.fillRect(x + i * cell, y + j * cell, cell, cell);
  ctx.restore();
}

/** Pixel art scaled with hard edges (nearest neighbour), at whole-pixel positions. */
export function drawPixels(ctx: CanvasRenderingContext2D, src: ImageData | CanvasImageSource, x: number, y: number, w: number, h: number): void {
  let source: CanvasImageSource;
  if (src instanceof ImageData) {
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    c.getContext('2d')?.putImageData(src, 0, 0);
    source = c;
  } else source = src;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  ctx.restore();
}

// ---------------------------------------------------------------- text

/** A piece of text in one style (Minecraft § codes become several). */
export interface TextRun {
  text: string;
  color: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
}

interface Piece extends TextRun {
  width: number;
  space: boolean;
}

/**
 * Breaks text into pieces a line may end after: words with their spaces, and single characters of
 * scripts written without spaces (Japanese), so long names wrap in every language.
 */
function tokens(text: string): string[] {
  const Seg = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (Seg) {
    const out: string[] = [];
    for (const s of new Seg(undefined, { granularity: 'word' }).segment(text)) {
      // keep a space with the word before it
      if (/^\s+$/.test(s.segment) && out.length) out[out.length - 1] += s.segment;
      else out.push(s.segment);
    }
    return out;
  }
  return text.match(/[　-鿿＀-￯]|[^\s　-鿿＀-￯]+\s*|\s+/g) ?? [];
}

const graphemes = (s: string): string[] => {
  const Seg = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  return Seg ? [...new Seg(undefined, { granularity: 'grapheme' }).segment(s)].map((g) => g.segment) : Array.from(s);
};

export interface TextBox {
  x: number;
  /** Top of the first line */
  y: number;
  maxWidth: number;
  size: number;
  lineHeight: number;
  maxLines: number;
  bold?: boolean;
  /** Shrinks the size (in 8px steps, not below this) before wrapping more lines */
  minSize?: number;
}

/**
 * Lays out styled text in a box (wrapping, an ellipsis when it runs out of lines). Returns the lines
 * and the size used; `paintText` draws them.
 */
export function layoutText(ctx: CanvasRenderingContext2D, runs: TextRun[], box: TextBox): { lines: Piece[][]; size: number; height: number } {
  let size = box.size;
  for (;;) {
    const res = layoutAt(ctx, runs, box, size);
    const fits = !res.cut;
    if (fits || !box.minSize || size - 8 < box.minSize) return { lines: res.lines, size, height: res.lines.length * Math.round((box.lineHeight * size) / box.size) };
    size -= 8;
  }
}

function layoutAt(ctx: CanvasRenderingContext2D, runs: TextRun[], box: TextBox, size: number): { lines: Piece[][]; cut: boolean } {
  const fontOf = (r: TextRun) => cardFont(size, box.bold || r.bold, r.italic);
  const measure = (r: TextRun, s: string) => {
    ctx.font = fontOf(r);
    return ctx.measureText(s).width;
  };
  const lines: Piece[][] = [[]];
  let width = 0;
  let cut = false;
  const push = (p: Piece) => {
    lines[lines.length - 1].push(p);
    width += p.width;
  };
  const newLine = () => {
    // a line doesn't end on spaces
    const line = lines[lines.length - 1];
    const last = line[line.length - 1];
    if (last) {
      const trimmed = last.text.replace(/\s+$/, '');
      if (trimmed !== last.text) {
        last.width = measure(last, trimmed);
        last.text = trimmed;
      }
    }
    lines.push([]);
    width = 0;
  };
  outer: for (const run of runs) {
    for (const part of run.text.split('\n').flatMap((s, i) => (i ? ['\n', s] : [s]))) {
      if (part === '\n') {
        if (lines.length >= box.maxLines) {
          cut = true;
          break outer;
        }
        newLine();
        continue;
      }
      for (let tok of tokens(part)) {
        if (!width && /^\s+$/.test(tok)) continue;
        let w = measure(run, tok);
        if (width + w > box.maxWidth && width > 0) {
          if (/^\s+$/.test(tok)) continue;
          if (lines.length >= box.maxLines) {
            cut = true;
            break outer;
          }
          newLine();
          tok = tok.replace(/^\s+/, '');
          w = measure(run, tok);
        }
        if (w > box.maxWidth) {
          // a word longer than the line: break it between characters
          let buf = '';
          for (const g of graphemes(tok)) {
            const bw = measure(run, buf + g);
            if (width + bw > box.maxWidth && buf) {
              push({ ...run, text: buf, width: measure(run, buf), space: false });
              if (lines.length >= box.maxLines) {
                cut = true;
                break outer;
              }
              newLine();
              buf = g;
            } else buf += g;
          }
          if (buf) push({ ...run, text: buf, width: measure(run, buf), space: /\s$/.test(buf) });
          continue;
        }
        push({ ...run, text: tok, width: w, space: /\s$/.test(tok) });
      }
    }
  }
  if (cut) {
    // the last line ends in an ellipsis that fits
    const line = lines[lines.length - 1];
    const last = line[line.length - 1] ?? { ...runs[0], text: '', width: 0, space: false };
    if (!line.length) line.push(last);
    const ell = '…';
    let total = line.reduce((s, p) => s + p.width, 0);
    while (total + measure(last, ell) > box.maxWidth && line.length) {
      const p = line[line.length - 1];
      const gs = graphemes(p.text);
      gs.pop();
      p.text = gs.join('');
      p.width = measure(p, p.text);
      if (!p.text) line.pop();
      total = line.reduce((s, q) => s + q.width, 0);
    }
    const tail = line[line.length - 1] ?? last;
    if (!line.length) line.push(tail);
    tail.text = tail.text.replace(/\s+$/, '') + ell;
    tail.width = measure(tail, tail.text);
  }
  return { lines: lines.filter((l, i) => l.length || i === 0), cut };
}

/** Draws laid-out text: the first baseline sits `ascent` below the box top. */
export function paintText(ctx: CanvasRenderingContext2D, layout: ReturnType<typeof layoutText>, box: TextBox, opts: { shadow?: boolean } = {}): void {
  const size = layout.size;
  const lh = Math.round((box.lineHeight * size) / box.size);
  ctx.save();
  ctx.textAlign = 'left';
  layout.lines.forEach((line, i) => {
    let x = box.x;
    // Texel's em box is its line box: the baseline sits about 7/8 down
    const base = box.y + i * lh + Math.round((lh - size) / 2) + Math.round(size * 0.875);
    for (const p of line) {
      ctx.font = cardFont(size, box.bold || p.bold, p.italic);
      if (opts.shadow) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fillText(p.text, x + size / 16, base + size / 16);
      }
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, x, base);
      const line = Math.max(2, Math.round(size / 16));
      if (p.underline) ctx.fillRect(x, base + line, p.width, line);
      if (p.strike) ctx.fillRect(x, base - Math.round(size * 0.3), p.width, line);
      x += p.width;
    }
  });
  ctx.restore();
}

/** A small rounded label ("Java 1.21.4", "Slim arms"); returns its width. */
export function paintChip(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string): number {
  ctx.save();
  ctx.font = cardFont(16);
  const w = Math.ceil(ctx.measureText(text).width) + 24;
  fillRoundRect(ctx, x, y, w, 32, 6, withAlpha(color, 0.14), withAlpha(color, 0.45));
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.fillText(text, x + 12, y + 22);
  ctx.restore();
  return w;
}

// ---------------------------------------------------------------- delivery

export function cardBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))), 'image/png'));
}

/** The file name for a card: the thing's name plus a suffix, safe on every OS. */
export function cardFileName(name: string, suffix: string, fallback: string): string {
  return `${sanitizeFilename(name.trim() || fallback, fallback).replace(/\.png$/i, '')}-${suffix}.png`;
}

/**
 * Hands the picture to the phone's share sheet when the browser can share files and the device is
 * touch-first (on a computer a file is what goes into Discord or a post), else downloads it.
 * 'cancelled': the share sheet was closed without sharing.
 */
export async function deliverCard(blob: Blob, filename: string, title: string): Promise<'shared' | 'saved' | 'cancelled'> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  if (touch && typeof nav.share === 'function' && typeof nav.canShare === 'function' && typeof File === 'function') {
    const file = new File([blob], filename, { type: 'image/png' });
    let can = false;
    try {
      can = nav.canShare({ files: [file] });
    } catch {
      can = false;
    }
    if (can) {
      try {
        await nav.share({ files: [file], title });
        return 'shared';
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
        // NotAllowedError (the tap is too long ago) and the like: download instead
      }
    }
  }
  saveBlob(blob, filename);
  return 'saved';
}
