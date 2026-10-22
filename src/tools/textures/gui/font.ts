// The game's bitmap font for the GUI preview: glyph places and widths read from the pack's (or the
// game's) font textures the way the game measures them. Pure (no DOM): images are plain RGBA.
//
// Java 1.13+ lists the font's pictures in font/default.json (1.20+: through include/default.json):
// "bitmap" providers with rows of characters, a height (8 by default) and an ascent. Older Java
// versions and Bedrock use one 16 × 16 grid, textures/font/ascii.png (Bedrock: font/default8.png),
// in a fixed code-page order. A glyph is as wide as its rightmost drawn column (+1 px of spacing);
// a space is 4 px.

export interface FontImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface BitmapProvider {
  /** Pack path of the picture */
  path: string;
  /** Rows of characters, one per grid row ('\0' for an empty cell) */
  chars: string[];
  /** Height the glyphs are drawn at (GUI px) */
  height: number;
  /** Pixels above the baseline */
  ascent: number;
}

export interface Glyph {
  path: string;
  /** Cell in the picture, in its pixels */
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** Drawn size in GUI px */
  w: number;
  h: number;
  /** Advance (width + 1) */
  advance: number;
  /** Offset down from the top of the line */
  dy: number;
}

/** The character order of the old 16 × 16 font picture (Java before 1.13, Bedrock's default8.png). */
export const LEGACY_CHARS =
  'ÀÁÂÈÊËÍÓÔÕÚßãõğİ' +
  'ıŒœŞşŴŵžȇ\0\0\0\0\0\0\0' +
  ' !"#$%&\'()*+,-./' +
  '0123456789:;<=>?' +
  '@ABCDEFGHIJKLMNO' +
  'PQRSTUVWXYZ[\\]^_' +
  '`abcdefghijklmno' +
  'pqrstuvwxyz{|}~\0' +
  'ÇüéâäàåçêëèïîìÄÅ' +
  'ÉæÆôöòûùÿÖÜø£Ø×ƒ' +
  'áíóúñÑªº¿®¬½¼¡«»' +
  '░▒▓│┤╡╢╖╕╣║╗╝╜╛┐' +
  '└┴┬├─┼╞╟╚╔╩╦╠═╬╧' +
  '╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀' +
  'αβΓπΣσμτΦΘΩδ∞∅∈∩' +
  '≡±≥≤⌠⌡÷≈°∙·√ⁿ²■\0';

export function legacyProvider(path: string): BitmapProvider {
  const chars: string[] = [];
  for (let r = 0; r < 16; r++) chars.push(LEGACY_CHARS.slice(r * 16, r * 16 + 16));
  return { path, chars, height: 8, ascent: 7 };
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Pack path of a font picture named in a font file ('minecraft:font/ascii.png'). */
export function fontTexturePath(file: string): string {
  const [ns, rest] = file.includes(':') ? file.split(':', 2) : ['minecraft', file];
  return `assets/${ns}/textures/${rest}`;
}

/** Pack path of a font file named by a reference provider ('minecraft:include/default'). */
export function fontFilePath(id: string): string {
  const [ns, rest] = id.includes(':') ? id.split(':', 2) : ['minecraft', id];
  return `assets/${ns}/font/${rest}.json`;
}

/**
 * The bitmap providers of a font file, following references (`read` gives a referenced file's JSON,
 * or undefined). Unifont, TrueType and space providers are skipped.
 */
export function bitmapProviders(json: unknown, read: (path: string) => unknown, depth = 0): BitmapProvider[] {
  const out: BitmapProvider[] = [];
  const list = isObj(json) && Array.isArray(json.providers) ? json.providers : [];
  for (const p of list) {
    if (!isObj(p)) continue;
    const type = String(p.type ?? '');
    if (type === 'reference' && typeof p.id === 'string' && depth < 4) {
      out.push(...bitmapProviders(read(fontFilePath(p.id)), read, depth + 1));
    } else if (type === 'bitmap' && typeof p.file === 'string' && Array.isArray(p.chars)) {
      const chars = p.chars.filter((r): r is string => typeof r === 'string');
      if (!chars.length) continue;
      const height = typeof p.height === 'number' && p.height > 0 ? p.height : 8;
      const ascent = typeof p.ascent === 'number' ? p.ascent : 7;
      out.push({ path: fontTexturePath(p.file), chars, height, ascent });
    }
  }
  return out;
}

/** Glyphs of a font, measured on its pictures. */
export class BitmapFont {
  private readonly glyphs = new Map<string, Glyph>();

  constructor(providers: readonly BitmapProvider[], images: (path: string) => FontImage | null) {
    for (const p of providers) {
      const img = images(p.path);
      if (!img) continue;
      const rows = p.chars.length;
      const cols = Math.max(...p.chars.map((r) => [...r].length));
      if (!rows || !cols) continue;
      const cw = Math.floor(img.width / cols);
      const ch = Math.floor(img.height / rows);
      if (cw < 1 || ch < 1) continue;
      const scale = p.height / ch;
      p.chars.forEach((row, ry) => {
        [...row].forEach((c, rx) => {
          if (c === '\0' || c === ' ' || this.glyphs.has(c)) return;
          const width = drawnWidth(img, rx * cw, ry * ch, cw, ch);
          this.glyphs.set(c, {
            path: p.path,
            sx: rx * cw,
            sy: ry * ch,
            sw: cw,
            sh: ch,
            w: cw * scale,
            h: p.height,
            advance: Math.round(width * scale) + 1,
            dy: 7 - p.ascent,
          });
        });
      });
    }
  }

  get empty(): boolean {
    return this.glyphs.size === 0;
  }

  glyph(c: string): Glyph | undefined {
    return this.glyphs.get(c);
  }

  /** Whether every character of a text has a glyph (spaces always do). */
  canDraw(text: string): boolean {
    for (const c of text) if (c !== ' ' && !this.glyphs.has(c)) return false;
    return true;
  }

  /** Width of a text in GUI px (§ codes don't count). */
  width(text: string): number {
    let w = 0;
    const chars = [...text];
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      if (c === '§') {
        i++;
        continue;
      }
      w += c === ' ' ? 4 : (this.glyphs.get(c)?.advance ?? 6);
    }
    return w;
  }
}

/** Columns up to the rightmost one with a drawn pixel. */
function drawnWidth(img: FontImage, x0: number, y0: number, w: number, h: number): number {
  for (let x = w - 1; x >= 0; x--) {
    for (let y = 0; y < h; y++) {
      if (img.data[((y0 + y) * img.width + x0 + x) * 4 + 3] !== 0) return x + 1;
    }
  }
  return 0;
}

/** Text colours of the § codes (0-f). */
export const CODE_COLOURS: Record<string, number> = {
  '0': 0x000000, '1': 0x0000aa, '2': 0x00aa00, '3': 0x00aaaa, '4': 0xaa0000, '5': 0xaa00aa, '6': 0xffaa00, '7': 0xaaaaaa,
  '8': 0x555555, '9': 0x5555ff, a: 0x55ff55, b: 0x55ffff, c: 0xff5555, d: 0xff55ff, e: 0xffff55, f: 0xffffff,
};

/** A text cut into runs of one colour (§ codes applied; other codes dropped). */
export function colourRuns(text: string, colour: number): { text: string; colour: number }[] {
  const out: { text: string; colour: number }[] = [];
  let cur = colour;
  let buf = '';
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (c === '§' && i + 1 < chars.length) {
      const code = chars[++i].toLowerCase();
      if (buf) out.push({ text: buf, colour: cur });
      buf = '';
      if (code in CODE_COLOURS) cur = CODE_COLOURS[code];
      else if (code === 'r') cur = colour;
      continue;
    }
    buf += c;
  }
  if (buf) out.push({ text: buf, colour: cur });
  return out;
}
