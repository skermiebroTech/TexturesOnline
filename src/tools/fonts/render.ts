// Text drawn the way Minecraft draws it, for the previews: each character's advance from its
// glyph's pixels (Java's formula), the drop shadow one gui pixel down and right in a quarter of the
// colour, 9-pixel lines. Characters the font doesn't have are drawn in the browser's font and
// marked, since the game would show them in its own font. Scenes: chat, a sign, a book page, the
// title screen with a splash, an item tooltip. Canvases work in glyph pixels (k per gui pixel).

import { BASELINE, CELL_ASCENT, DEFAULT_SPACE, cellH, cellW, glyphAdvance, unit, type GlyphSize, type Mask } from './font';
import { cssFamily } from './raster';

export interface PreviewFont {
  size: GlyphSize;
  glyphs: Map<number, Mask>;
  space: number;
  ttf: { family: string; size: number; shift: [number, number]; chars: Set<number> } | null;
}

export type CharSource = 'glyph' | 'ttf' | 'space' | 'missing';

export const LINE_HEIGHT = 9;

const SPACES = new Set([0x20, 0xa0, 0x3000]);

export function charSource(font: PreviewFont, cp: number): CharSource {
  if (SPACES.has(cp)) return 'space';
  if (font.glyphs.has(cp)) return 'glyph';
  if (font.ttf && font.ttf.chars.has(cp)) return 'ttf';
  return 'missing';
}

let measureCtx: CanvasRenderingContext2D | null = null;
function measure(font: string, ch: string): number {
  measureCtx ??= document.createElement('canvas').getContext('2d')!;
  measureCtx.font = font;
  return measureCtx.measureText(ch).width;
}

const FALLBACK_FONT = (px: number) => `${px}px sans-serif`;

/** Advance of a character in gui pixels. */
export function advance(font: PreviewFont, cp: number): number {
  const src = charSource(font, cp);
  if (src === 'space') return cp === 0x3000 ? 8 : font.space || DEFAULT_SPACE;
  if (src === 'glyph') return glyphAdvance(font.glyphs.get(cp)!, font.size);
  if (src === 'ttf') return Math.max(1, Math.round(measure(`${font.ttf!.size}px ${cssFamily(font.ttf!.family)}`, String.fromCodePoint(cp))));
  return Math.max(2, Math.round(measure(FALLBACK_FONT(8), String.fromCodePoint(cp))) + 1);
}

export function textWidth(font: PreviewFont, text: string): number {
  let w = 0;
  for (const ch of text) w += advance(font, ch.codePointAt(0)!);
  return w;
}

/** Words that fit in `max` gui pixels per line (long words are split). */
export function wrapText(font: PreviewFont, text: string, max: number): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    const words = para.split(/(\s+)/);
    let line = '';
    for (const word of words) {
      if (!word) continue;
      const tryLine = line + word;
      if (textWidth(font, tryLine.trimEnd()) <= max || !line.trim()) {
        line = tryLine;
        // a single word wider than the line is cut into pieces
        while (textWidth(font, line.trimEnd()) > max && [...line].length > 1) {
          const chars = [...line];
          let cut = chars.length - 1;
          while (cut > 1 && textWidth(font, chars.slice(0, cut).join('')) > max) cut--;
          lines.push(chars.slice(0, cut).join(''));
          line = chars.slice(cut).join('');
        }
      } else {
        lines.push(line.trimEnd());
        line = /^\s+$/.test(word) ? '' : word;
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

export interface DrawOptions {
  color: string;
  shadow?: boolean;
  /** Mark characters the font doesn't have (default true) */
  markMissing?: boolean;
}

/** Shadow colour: the text colour with its red, green and blue at a quarter, as the game does. */
export function shadowColor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const q = (v: number) => Math.floor(v / 4);
  return `rgb(${q((n >> 16) & 255)},${q((n >> 8) & 255)},${q(n & 255)})`;
}

function drawGlyph(ctx: CanvasRenderingContext2D, m: Mask, size: GlyphSize, x: number, y: number): void {
  const w = cellW(size);
  const h = cellH(size);
  const k = unit(size);
  // cell top is 3 gui pixels above the line's top
  const top = y + (BASELINE - CELL_ASCENT) * k;
  for (let gy = 0; gy < h; gy++) {
    let run = -1;
    for (let gx = 0; gx <= w; gx++) {
      const on = gx < w && m[gy * w + gx];
      if (on && run < 0) run = gx;
      if (!on && run >= 0) {
        ctx.fillRect(x + run, top + gy, gx - run, 1);
        run = -1;
      }
    }
  }
}

/** Draws one line of text; (x, y) is the line's top-left in gui pixels. Returns the end x. */
export function drawText(ctx: CanvasRenderingContext2D, font: PreviewFont, text: string, x: number, y: number, opts: DrawOptions): number {
  const k = unit(font.size);
  const pass = (color: string, off: number, marks: boolean) => {
    let cx = x;
    for (const ch of text) {
      const cp = ch.codePointAt(0)!;
      const src = charSource(font, cp);
      const adv = advance(font, cp);
      ctx.fillStyle = color;
      if (src === 'glyph') drawGlyph(ctx, font.glyphs.get(cp)!, font.size, (cx + off) * k, (y + off) * k);
      else if (src === 'ttf') {
        const f = font.ttf!;
        ctx.font = `${f.size * k}px ${cssFamily(f.family)}`;
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(ch, (cx + off + f.shift[0]) * k, (y + off + BASELINE + f.shift[1]) * k);
      } else if (src === 'missing') {
        ctx.font = FALLBACK_FONT(8 * k);
        ctx.textBaseline = 'alphabetic';
        if (marks) ctx.fillStyle = '#ff55ff';
        ctx.fillText(ch, (cx + off) * k, (y + off + BASELINE) * k);
        if (marks && !off) {
          ctx.fillStyle = 'rgba(255,85,255,0.9)';
          for (let dx = 0; dx < adv - 1; dx += 2) ctx.fillRect((cx + dx) * k, (y + LINE_HEIGHT - 0.5) * k, k, Math.max(1, k / 2));
        }
      }
      cx += adv;
    }
    return cx;
  };
  if (opts.shadow) pass(shadowColor(opts.color), 1, false);
  return pass(opts.color, 0, opts.markMissing !== false);
}

// ---------------------------------------------------------------------------------------------
// Scenes

export type SceneId = 'chat' | 'sign' | 'book' | 'title' | 'tooltip';
export const SCENES: readonly SceneId[] = ['chat', 'sign', 'book', 'title', 'tooltip'];

export interface SceneText {
  sample: string;
  player: string;
  friend: string;
  joined: string;
  reply: string;
  page: string;
  singleplayer: string;
  multiplayer: string;
  options: string;
  itemName: string;
  mainHand: string;
  damage: string;
  speed: string;
}

export interface Scene {
  /** Size in gui pixels */
  w: number;
  h: number;
  draw(ctx: CanvasRenderingContext2D, k: number, time: number): void;
  animated?: boolean;
}

function fill(ctx: CanvasRenderingContext2D, k: number, color: string, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = color;
  ctx.fillRect(x * k, y * k, w * k, h * k);
}

function chatScene(font: PreviewFont, tx: SceneText, max: number): Scene {
  const W = Math.max(120, Math.min(320, max));
  const lines: { text: string; color: string }[] = [];
  lines.push({ text: tx.joined, color: '#FFFF55' });
  for (const l of wrapText(font, `<${tx.player}> ${tx.sample}`, W - 4)) lines.push({ text: l, color: '#FFFFFF' });
  for (const l of wrapText(font, `<${tx.friend}> ${tx.reply}`, W - 4)) lines.push({ text: l, color: '#FFFFFF' });
  const H = lines.length * LINE_HEIGHT + 24;
  return {
    w: W,
    h: H,
    draw(ctx, k) {
      fill(ctx, k, '#4a6b3a', 0, 0, W, H);
      fill(ctx, k, '#5d8a47', 0, H - 24, W, 24);
      lines.forEach((l, i) => {
        const y = 4 + i * LINE_HEIGHT;
        fill(ctx, k, 'rgba(0,0,0,0.5)', 0, y, W, LINE_HEIGHT);
        drawText(ctx, font, l.text, 2, y + 1, { color: l.color, shadow: true });
      });
      // the chat box being typed in
      fill(ctx, k, 'rgba(0,0,0,0.5)', 2, H - 14, W - 4, 12);
      drawText(ctx, font, '_', 4, H - 12, { color: '#FFFFFF', shadow: true });
    },
  };
}

function signScene(font: PreviewFont, tx: SceneText): Scene {
  const W = 112;
  const H = 76;
  const lines = wrapText(font, tx.sample, 90).slice(0, 4);
  while (lines.length < 4) lines.push('');
  return {
    w: W,
    h: H,
    draw(ctx, k) {
      fill(ctx, k, '#7fa9d6', 0, 0, W, H);
      fill(ctx, k, '#5d4a2d', 52, 56, 8, 20);
      fill(ctx, k, '#3f2f1b', 4, 4, W - 8, 52);
      fill(ctx, k, '#b8945f', 5, 5, W - 10, 50);
      for (let y = 5; y < 55; y += 10) fill(ctx, k, '#a88553', 5, y + 9, W - 10, 1);
      lines.forEach((l, i) => {
        const tw = textWidth(font, l);
        drawText(ctx, font, l, Math.floor((W - tw) / 2), 9 + i * 10, { color: '#000000' });
      });
    },
  };
}

function bookScene(font: PreviewFont, tx: SceneText): Scene {
  const W = 146;
  const H = 164;
  const lines = wrapText(font, tx.sample, 114).slice(0, 14);
  return {
    w: W,
    h: H,
    draw(ctx, k) {
      fill(ctx, k, '#3b2a1a', 0, 0, W, H);
      fill(ctx, k, '#e9dcb8', 4, 4, W - 8, H - 8);
      fill(ctx, k, '#d9c99f', 4, H - 8, W - 8, 4);
      const header = tx.page;
      drawText(ctx, font, header, W - 16 - textWidth(font, header), 14, { color: '#000000' });
      lines.forEach((l, i) => drawText(ctx, font, l, 16, 30 + i * LINE_HEIGHT, { color: '#000000' }));
    },
  };
}

function button(ctx: CanvasRenderingContext2D, k: number, font: PreviewFont, label: string, x: number, y: number, w: number): void {
  fill(ctx, k, '#000000', x, y, w, 20);
  fill(ctx, k, '#6f6f6f', x + 1, y + 1, w - 2, 18);
  fill(ctx, k, '#8b8b8b', x + 1, y + 1, w - 2, 1);
  fill(ctx, k, '#565656', x + 1, y + 18, w - 2, 1);
  const tw = textWidth(font, label);
  drawText(ctx, font, label, x + Math.floor((w - tw) / 2), y + 6, { color: '#FFFFFF', shadow: true });
}

function titleScene(font: PreviewFont, tx: SceneText, max: number): Scene {
  const W = Math.max(220, Math.min(300, max));
  const H = 170;
  const splash = tx.sample.length > 40 ? `${[...tx.sample].slice(0, 38).join('')}…` : tx.sample;
  return {
    w: W,
    h: H,
    animated: true,
    draw(ctx, k, time) {
      // a code-drawn landscape (not the game's panorama)
      const sky = ctx.createLinearGradient(0, 0, 0, H * k);
      sky.addColorStop(0, '#2d4f86');
      sky.addColorStop(1, '#8cb2d9');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W * k, H * k);
      for (let x = 0; x < W; x += 10) {
        const hill = 120 + Math.round(10 * Math.sin(x / 37) + 6 * Math.sin(x / 13));
        fill(ctx, k, '#4c7a35', x, hill, 10, H - hill);
        fill(ctx, k, '#6b4a2c', x, hill + 6, 10, H - hill - 6);
      }
      // title stand-in: a dark plate; the splash sits on its right like the game's
      const bx = Math.round(W / 2 - 100);
      fill(ctx, k, 'rgba(0,0,0,0.35)', bx, 22, 200, 36);
      button(ctx, k, font, tx.singleplayer, bx, 88, 200);
      button(ctx, k, font, tx.multiplayer, bx, 112, 200);
      button(ctx, k, font, tx.options, bx, 136, 98);
      button(ctx, k, font, '', bx + 102, 136, 98);
      // splash: yellow, turned 20 degrees, pulsing (SplashRenderer)
      const tw = textWidth(font, splash);
      const phase = 1.8 - Math.abs(Math.sin(((time % 1000) / 1000) * Math.PI * 2)) * 0.1;
      const scale = (phase * 100) / (tw + 32);
      ctx.save();
      ctx.translate((W / 2 + Math.min(90, W * 0.28)) * k, 54 * k);
      ctx.rotate(-Math.PI / 9);
      ctx.scale(scale, scale);
      drawText(ctx, font, splash, -tw / 2, -8, { color: '#FFFF00', shadow: true });
      ctx.restore();
    },
  };
}

function tooltipScene(font: PreviewFont, tx: SceneText, max: number): Scene {
  const lines: { text: string; color: string }[] = [
    { text: tx.itemName, color: '#55FFFF' },
    ...wrapText(font, tx.sample, Math.max(80, Math.min(160, max - 48))).map((text) => ({ text, color: '#AA00AA' })),
    { text: '', color: '#FFFFFF' },
    { text: tx.mainHand, color: '#AAAAAA' },
    { text: ` ${tx.damage}`, color: '#00AA00' },
    { text: ` ${tx.speed}`, color: '#00AA00' },
  ];
  const inner = Math.max(...lines.map((l) => textWidth(font, l.text)), 40);
  const boxH = lines.length * 10 + 4;
  const W = inner + 40;
  const H = boxH + 28;
  return {
    w: W,
    h: H,
    draw(ctx, k) {
      // a slot grid behind the tooltip
      fill(ctx, k, '#c6c6c6', 0, 0, W, H);
      for (let x = 2; x < W; x += 18) for (let y = 2; y < H; y += 18) {
        fill(ctx, k, '#8b8b8b', x, y, 16, 16);
        fill(ctx, k, '#373737', x, y, 16, 1);
        fill(ctx, k, '#373737', x, y, 1, 16);
      }
      const bx = 14;
      const by = 14;
      const bw = inner + 8;
      fill(ctx, k, 'rgba(16,0,16,0.94)', bx - 1, by, bw + 2, boxH);
      fill(ctx, k, 'rgba(16,0,16,0.94)', bx, by - 1, bw, boxH + 2);
      fill(ctx, k, '#5000ff', bx, by, bw, 1);
      fill(ctx, k, '#28007f', bx, by + boxH - 1, bw, 1);
      fill(ctx, k, '#3c00bf', bx, by, 1, boxH);
      fill(ctx, k, '#3c00bf', bx + bw - 1, by, 1, boxH);
      lines.forEach((l, i) => {
        // the name line has a 2-pixel gap below it, like the game's tooltips
        const y = by + 3 + i * 10 + (i > 0 ? 2 : 0);
        if (l.text) drawText(ctx, font, l.text, bx + 4, y, { color: l.color, shadow: true });
      });
    },
  };
}

/** A scene; `max` is the widest it may be in gui pixels (chat and tooltips wrap to it). */
export function makeScene(id: SceneId, font: PreviewFont, text: SceneText, max = 320): Scene {
  switch (id) {
    case 'chat':
      return chatScene(font, text, max);
    case 'sign':
      return signScene(font, text);
    case 'book':
      return bookScene(font, text);
    case 'title':
      return titleScene(font, text, max);
    default:
      return tooltipScene(font, text, max);
  }
}

/** Characters of a text the font doesn't have (in order, once each). */
export function missingChars(font: PreviewFont, text: string): number[] {
  const out: number[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x20 || out.includes(cp)) continue;
    if (charSource(font, cp) === 'missing') out.push(cp);
  }
  return out;
}

/** A small strip of text on a canvas (start screen samples, the glyph list). */
export function textStrip(font: PreviewFont, text: string, opts: { color?: string; shadow?: boolean; pad?: number } = {}): HTMLCanvasElement {
  const k = unit(font.size);
  const pad = opts.pad ?? 2;
  const w = Math.max(1, textWidth(font, text) + pad * 2 + 1);
  const h = LINE_HEIGHT + 3 + pad * 2;
  const c = document.createElement('canvas');
  c.width = w * k;
  c.height = h * k;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  drawText(ctx, font, text, pad, pad + 2, { color: opts.color ?? '#FFFFFF', shadow: opts.shadow ?? true, markMissing: false });
  c.style.setProperty('--w', String(w));
  c.style.setProperty('--h', String(h));
  return c;
}
