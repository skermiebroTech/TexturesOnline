// Original starter skins, drawn procedurally in code (no game art). Each starter paints the
// 64x64 layout for either arm model, so every one works as classic or slim.

import type { SkinModel } from '../../core/types';
import { boxFaces, FACES, partBox, partOrigin, PART_INFO, type SkinFace, type SkinLayer, type SkinPart } from './templates';

type RGB = readonly [number, number, number];
type RGBA = readonly [number, number, number, number];
type Px = RGB | RGBA | null | undefined;

export interface StarterDef {
  id: string;
  name: string;
  description: string;
  /** Shown as a small badge on the card */
  badge?: string;
  paint(p: Painter): void;
}

interface FaceInfo {
  face: SkinFace;
  /** Pixel inside the face, from its top-left as seen when looking at that face */
  x: number;
  y: number;
  w: number;
  h: number;
  part: SkinPart;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clampByte = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

export function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function shade(c: RGB, k: number): RGB {
  return [clampByte(c[0] * k), clampByte(c[1] * k), clampByte(c[2] * k)];
}

/** Paints parts of a 64x64 skin with small helpers for noise and faces. */
export class Painter {
  readonly img: ImageData;
  readonly model: SkinModel;
  private readonly rng: () => number;

  constructor(img: ImageData, model: SkinModel, seed = 7) {
    this.img = img;
    this.model = model;
    this.rng = mulberry32(seed);
  }

  random(): number {
    return this.rng();
  }

  /** Colour with a little brightness noise, like hand-shaded pixel art. */
  vary(c: RGB, amount = 10): RGB {
    const d = (this.rng() * 2 - 1) * amount;
    return [clampByte(c[0] + d), clampByte(c[1] + d), clampByte(c[2] + d)];
  }

  /** Picks between colours with weights. */
  pick(colors: RGB[], weights?: number[]): RGB {
    const w = weights ?? colors.map(() => 1);
    let t = this.rng() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < colors.length; i++) {
      t -= w[i];
      if (t <= 0) return colors[i];
    }
    return colors[colors.length - 1];
  }

  set(x: number, y: number, c: Px): void {
    if (!c || x < 0 || y < 0 || x >= this.img.width || y >= this.img.height) return;
    const i = (y * this.img.width + x) * 4;
    const d = this.img.data;
    d[i] = clampByte(c[0]);
    d[i + 1] = clampByte(c[1]);
    d[i + 2] = clampByte(c[2]);
    d[i + 3] = c.length > 3 ? clampByte((c as RGBA)[3]) : 255;
  }

  box(part: SkinPart): { w: number; h: number; d: number } {
    return partBox(part, this.model);
  }

  /** Calls fn for every pixel of every face of a part's layer. */
  part(part: SkinPart, layer: SkinLayer, fn: (f: FaceInfo) => Px): void {
    const o = partOrigin(part, layer, this.model);
    if (!o) return;
    const faces = boxFaces(o[0], o[1], partBox(part, this.model));
    for (const face of FACES) {
      const r = faces[face];
      for (let y = 0; y < r.h; y++) {
        for (let x = 0; x < r.w; x++) {
          this.set(r.x + x, r.y + y, fn({ face, x, y, w: r.w, h: r.h, part }));
        }
      }
    }
  }

  parts(parts: SkinPart[], layer: SkinLayer, fn: (f: FaceInfo) => Px): void {
    for (const p of parts) this.part(p, layer, fn);
  }

  /** Writes a small bitmap ('#' = colour) onto a face. */
  glyph(part: SkinPart, layer: SkinLayer, face: SkinFace, rows: readonly string[], x0: number, y0: number, color: RGB | ((ch: string) => Px)): void {
    const o = partOrigin(part, layer, this.model);
    if (!o) return;
    const r = boxFaces(o[0], o[1], partBox(part, this.model))[face];
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        if (x0 + x >= r.w || y0 + y >= r.h || x0 + x < 0 || y0 + y < 0) continue;
        const c = typeof color === 'function' ? color(ch) : color;
        this.set(r.x + x0 + x, r.y + y0 + y, c);
      }
    });
  }
}

const ARMS: SkinPart[] = ['rightArm', 'leftArm'];
const LEGS: SkinPart[] = ['rightLeg', 'leftLeg'];

/** Column of a limb face counted from the body side outwards (0 = next to the body). */
function innerCol(f: FaceInfo): number {
  const rightSide = f.part === 'rightArm' || f.part === 'rightLeg';
  if (f.face === 'back') return rightSide ? f.x : f.w - 1 - f.x;
  return rightSide ? f.w - 1 - f.x : f.x;
}

interface FaceStyle {
  skin: RGB;
  hair: RGB;
  eyes: RGB;
  mouth?: RGB;
  /** Rows of hair on the front (default 2) */
  fringe?: number;
  /** Rows of hair on the back (default 6) */
  backHair?: number;
  brows?: RGB;
  seed?: number;
}

/** A friendly original face and haircut on the base head layer. */
function paintHead(p: Painter, s: FaceStyle): void {
  const fringe = s.fringe ?? 2;
  const back = s.backHair ?? 6;
  const skinShade = shade(s.skin, 0.9);
  const hair = (x = 0) => p.vary(s.hair, 9 + x);
  p.part('head', 'base', (f) => {
    switch (f.face) {
      case 'top':
        return hair();
      case 'bottom':
        return skinShade;
      case 'back':
        return f.y < back ? hair() : p.vary(skinShade, 3);
      case 'right':
      case 'left': {
        // Hair over the top rows and at the back half; an ear in the middle.
        const backCol = f.face === 'right' ? f.x < 3 : f.x > f.w - 4;
        if (f.y < fringe + 1 || (backCol && f.y < back)) return hair();
        if (f.y === 4 && (f.face === 'right' ? f.x === 4 : f.x === 3)) return shade(s.skin, 0.82);
        return p.vary(s.skin, 3);
      }
      default: {
        if (f.y < fringe) return hair();
        if (f.y === fringe && (f.x === 0 || f.x === 7 || f.x === 1 || f.x === 6)) return f.x === 0 || f.x === 7 ? hair() : p.vary(s.skin, 3);
        if (f.y === 3 && s.brows && (f.x === 1 || f.x === 2 || f.x === 5 || f.x === 6)) return s.brows;
        if (f.y === 4) {
          if (f.x === 1 || f.x === 6) return [245, 245, 248];
          if (f.x === 2 || f.x === 5) return s.eyes;
        }
        if (f.y === 5 && (f.x === 3 || f.x === 4)) return shade(s.skin, 0.88);
        if (f.y === 6 && f.x >= 2 && f.x <= 5) return f.x === 2 || f.x === 5 ? shade(s.skin, 0.86) : (s.mouth ?? shade(s.skin, 0.62));
        return p.vary(s.skin, 3);
      }
    }
  });
}

// ---- Template glyphs (3x5 letters, 3x4 arrows) ----
const GLYPHS: Record<string, readonly string[]> = {
  F: ['###', '#..', '##.', '#..', '#..'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  up: ['.#.', '###', '.#.', '.#.'],
  down: ['.#.', '.#.', '###', '.#.'],
};

const FACE_GLYPH: Record<SkinFace, string> = { front: 'F', back: 'B', right: 'R', left: 'L', top: 'up', bottom: 'down' };
const FACE_SHADE: Record<SkinFace, number> = { top: 1.12, front: 1, right: 0.88, left: 0.88, back: 0.76, bottom: 0.66 };

const TEMPLATE_COLORS: Record<SkinPart, RGB> = {
  head: [236, 186, 60],
  body: [64, 150, 230],
  rightArm: [78, 190, 78],
  leftArm: [40, 186, 168],
  rightLeg: [150, 104, 230],
  leftLeg: [236, 104, 164],
};

function paintTemplate(p: Painter): void {
  for (const part of Object.keys(TEMPLATE_COLORS) as SkinPart[]) {
    const base = TEMPLATE_COLORS[part];
    p.part(part, 'base', (f) => {
      const c = shade(base, FACE_SHADE[f.face]);
      // A faint checker helps count pixels.
      return (f.x + f.y) % 2 ? shade(c, 0.96) : c;
    });
    const o = partOrigin(part, 'base', p.model)!;
    const faces = boxFaces(o[0], o[1], partBox(part, p.model));
    for (const face of FACES) {
      if (part === 'head' && face === 'front') continue;
      const r = faces[face];
      const g = GLYPHS[FACE_GLYPH[face]];
      const gw = 3;
      const gh = g.length;
      if (r.w < gw || r.h < gh) continue;
      const x0 = Math.floor((r.w - gw) / 2);
      const y0 = Math.floor((r.h - gh) / 2);
      p.glyph(part, 'base', face, g, x0, y0, shade(base, FACE_SHADE[face] * 0.5));
    }
  }
  // Friendly face on the head front shows which way is forward.
  const head = TEMPLATE_COLORS.head;
  const dark = shade(head, 0.42);
  p.glyph('head', 'base', 'front', ['........', '........', '........', '.##..##.', '.##..##.', '........', '.#....#.', '..####..'], 0, 0, (ch) => (ch === '#' ? dark : null));
  p.glyph('head', 'base', 'front', ['.#....#.'], 0, 3, [255, 255, 255]);
}

// ---- Characters ----

const WHITE: RGB = [245, 245, 248];

function paintExplorer(p: Painter): void {
  const skin: RGB = [206, 144, 104];
  const hair: RGB = [96, 60, 36];
  paintHead(p, { skin, hair, eyes: [62, 120, 76], brows: shade(hair, 0.9), fringe: 2, backHair: 5 });
  const shirt: RGB = [220, 198, 146];
  const vest: RGB = [98, 118, 62];
  const strap: RGB = [84, 54, 32];
  const belt: RGB = [70, 44, 28];
  const gold: RGB = [232, 188, 72];
  const khaki: RGB = [178, 152, 102];
  const boot: RGB = [80, 52, 34];
  p.part('body', 'base', (f) => {
    if (f.face === 'top') return p.vary(shirt, 6);
    if (f.face === 'bottom') return p.vary(khaki, 5);
    if (f.y === 10) return f.face === 'front' && (f.x === 3 || f.x === 4) ? gold : belt;
    if (f.y === 11) return p.vary(khaki, 6);
    if (f.face === 'front') {
      if (f.x === 1 || f.x === 6) return f.y < 10 ? p.vary(strap, 6) : null;
      if (f.x === 0 || f.x === 7) return p.vary(vest, 8);
      if (f.y === 0 && (f.x === 2 || f.x === 5)) return shade(shirt, 0.8);
      if (f.x >= 2 && f.x <= 5 && f.y < 10) {
        if (f.y === 0 && (f.x === 3 || f.x === 4)) return shade(skin, 0.92);
        if ((f.x === 3 || f.x === 4) && f.y === 1) return shade(skin, 0.92);
        if (f.x === 4 && f.y > 1 && f.y % 3 === 0) return shade(shirt, 0.72);
        if ((f.x === 2 || f.x === 5) && f.y >= 5 && f.y <= 6) return shade(vest, 0.8);
        return p.vary(shirt, 5);
      }
      return p.vary(vest, 8);
    }
    if (f.face === 'back') {
      // Backpack
      if (f.x >= 1 && f.x <= 6 && f.y >= 1 && f.y <= 9) {
        if (f.y <= 3) return p.vary(shade(strap, 1.25), 6);
        if (f.y === 4 && (f.x === 3 || f.x === 4)) return gold;
        return p.vary(shade(strap, 1.45), 7);
      }
      return p.vary(vest, 8);
    }
    return p.vary(vest, 8);
  });
  p.parts(ARMS, 'base', (f) => {
    if (f.face === 'top') return p.vary(shirt, 5);
    if (f.face === 'bottom') return shade(skin, 0.85);
    if (f.y <= 3) return p.vary(shirt, 5);
    if (f.y === 4) return shade(shirt, 0.82);
    if (f.part === 'leftArm' && f.y === 8) return f.face === 'front' && innerCol(f) === 1 ? gold : [52, 44, 40];
    if (f.y >= 10) return p.vary(shade(skin, 0.94), 3);
    return p.vary(skin, 4);
  });
  p.parts(LEGS, 'base', (f) => {
    if (f.face === 'top') return khaki;
    if (f.face === 'bottom') return shade(boot, 0.6);
    if (f.y >= 9) {
      if (f.y === 9 && f.face === 'front' && (f.x === 1 || f.x === 2)) return shade(boot, 1.5);
      return p.vary(boot, 6);
    }
    // Side pockets
    const outerSide = (f.part === 'rightLeg' && f.face === 'right') || (f.part === 'leftLeg' && f.face === 'left');
    if (outerSide && f.y >= 2 && f.y <= 5 && f.x >= 1 && f.x <= 2) return shade(khaki, f.y === 2 ? 0.72 : 0.86);
    return p.vary(khaki, 6);
  });
  // Outer layer: a safari hat.
  const hat: RGB = [200, 168, 110];
  const band: RGB = [96, 62, 38];
  p.part('head', 'outer', (f) => {
    if (f.face === 'top') return p.vary(hat, 7);
    if (f.face === 'bottom') return null;
    if (f.y <= 1) return p.vary(hat, 7);
    if (f.y === 2) return band;
    if (f.y === 3 && f.face !== 'front') return shade(hat, 0.86);
    return null;
  });
}

function paintKnight(p: Painter): void {
  const skin: RGB = [222, 170, 128];
  paintHead(p, { skin, hair: [62, 44, 30], eyes: [70, 120, 200], brows: [62, 44, 30] });
  const steel: RGB = [170, 178, 192];
  const steelDark: RGB = [118, 126, 142];
  const steelLight: RGB = [210, 216, 226];
  const mail: RGB = [128, 134, 146];
  const blue: RGB = [44, 78, 164];
  const gold: RGB = [236, 192, 70];
  const red: RGB = [188, 40, 44];
  const chain = (f: FaceInfo): RGB => ((f.x + f.y) % 2 ? p.vary(mail, 6) : p.vary(shade(mail, 0.78), 6));
  const plate = (f: FaceInfo): RGB => (f.y === 0 ? steelLight : f.x === 0 ? steelDark : p.vary(steel, 6));
  p.part('body', 'base', chain);
  p.parts(ARMS, 'base', (f) => (f.y >= 10 || f.face === 'bottom' ? p.vary(steelDark, 6) : chain(f)));
  p.parts(LEGS, 'base', (f) => {
    if (f.face === 'bottom') return shade(steelDark, 0.7);
    if (f.y >= 10) return p.vary(shade(steelDark, 0.85), 5);
    if (f.y >= 6) return plate({ ...f, y: f.y - 6 });
    return chain(f);
  });
  // Helmet with a see-through visor slit, and a red plume.
  p.part('head', 'outer', (f) => {
    if (f.face === 'bottom') return null;
    if (f.face === 'top') return f.x === 3 || f.x === 4 ? p.vary(red, 10) : p.vary(steel, 7);
    if (f.face === 'back' && (f.x === 3 || f.x === 4) && f.y <= 2) return p.vary(red, 10);
    if (f.face === 'front') {
      if ((f.y === 3 || f.y === 4) && f.x >= 1 && f.x <= 6) return null;
      if (f.y === 6 && (f.x === 2 || f.x === 5)) return shade(steelDark, 0.6);
      if (f.x === 3 || f.x === 4) return f.y < 3 ? steelLight : p.vary(steel, 5);
      return p.vary(steel, 7);
    }
    if (f.y === 4 && (f.x === 2 || f.x === 5)) return steelLight;
    return f.y === 7 ? steelDark : p.vary(steel, 7);
  });
  // Tabard over the chainmail.
  p.part('body', 'outer', (f) => {
    if (f.face === 'top' || f.face === 'bottom') return null;
    if (f.face === 'front' || f.face === 'back') {
      if (f.x === 0 || f.x === 7) return null;
      if (f.y === 9) return f.face === 'front' && (f.x === 3 || f.x === 4) ? gold : [72, 48, 32];
      if (f.y === 0 || f.x === 1 || f.x === 6) return gold;
      if (f.face === 'front') {
        const cx = Math.abs(f.x - 3.5);
        const cy = Math.abs(f.y - 4.5);
        if (cx + cy <= 2) return cx + cy <= 1 ? [250, 226, 120] : gold;
      }
      return p.vary(blue, 6);
    }
    return null;
  });
  // Pauldrons and gauntlets.
  p.parts(ARMS, 'outer', (f) => {
    if (f.face === 'bottom') return null;
    if (f.face === 'top') return p.vary(steel, 6);
    if (f.y <= 2) return f.y === 0 ? steelLight : p.vary(steel, 6);
    if (f.y === 3) return steelDark;
    if (f.y >= 9 && f.y <= 10) return p.vary(steel, 6);
    return null;
  });
  p.parts(LEGS, 'outer', (f) => (f.face !== 'top' && f.face !== 'bottom' && f.y === 6 && f.face === 'front' ? steelLight : null));
}

function paintRobot(p: Painter): void {
  const metal: RGB = [150, 162, 180];
  const dark: RGB = [86, 96, 112];
  const darker: RGB = [48, 54, 66];
  const light: RGB = [202, 210, 222];
  const cyan: RGB = [64, 228, 255];
  const glow: RGB = [196, 250, 255];
  const panel = (f: FaceInfo): RGB => {
    const edge = f.x === 0 || f.y === 0 || f.x === f.w - 1 || f.y === f.h - 1;
    if (edge) return f.x === 0 || f.y === 0 ? light : dark;
    return p.vary(metal, 5);
  };
  p.part('head', 'base', (f) => {
    if (f.face === 'front') {
      if (f.y >= 2 && f.y <= 5 && f.x >= 1 && f.x <= 6) {
        if ((f.y === 3 || f.y === 4) && (f.x === 1 || f.x === 2 || f.x === 5 || f.x === 6)) return f.y === 3 && (f.x === 2 || f.x === 5) ? glow : cyan;
        return [26, 30, 40];
      }
      if (f.y === 6 && f.x >= 2 && f.x <= 5) return f.x % 2 ? darker : light;
      return panel(f);
    }
    if (f.face === 'right' || f.face === 'left') {
      if ((f.x === 3 || f.x === 4) && (f.y === 3 || f.y === 4)) return f.x === 3 && f.y === 3 ? cyan : darker;
      return panel(f);
    }
    if (f.face === 'back' && f.y >= 2 && f.y <= 6 && f.y % 2 === 0 && f.x >= 1 && f.x <= 6) return darker;
    if (f.face === 'top' && (f.x === 3 || f.x === 4) && (f.y === 3 || f.y === 4)) return f.x === 3 && f.y === 3 ? [255, 90, 90] : darker;
    return panel(f);
  });
  p.part('body', 'base', (f) => {
    if (f.face === 'front') {
      if (f.y >= 2 && f.y <= 7 && f.x >= 2 && f.x <= 5) {
        if (f.y === 3) return ([[255, 84, 84], [255, 208, 64], [96, 230, 112], [64, 228, 255]] as RGB[])[f.x - 2];
        if (f.y === 5 && f.x <= 4) return cyan;
        return [30, 34, 44];
      }
      if (f.y === 9) return darker;
      if ((f.x === 0 || f.x === 7) && (f.y === 1 || f.y === 7)) return darker;
    }
    if (f.face === 'back' && f.x >= 2 && f.x <= 5 && f.y >= 2 && f.y <= 8 && f.y % 2 === 0) return darker;
    if (f.face !== 'top' && f.face !== 'bottom' && f.y === 9) return darker;
    return p.vary(metal, 5);
  });
  p.parts(ARMS, 'base', (f) => {
    if (f.face === 'top') return light;
    if (f.face === 'bottom') return darker;
    if (f.y === 4) return darker;
    if (f.y === 5 && f.face === 'front' && innerCol(f) === 1) return cyan;
    if (f.y >= 10) return p.vary(dark, 5);
    if (f.y <= 3) return f.y === 0 ? light : p.vary(shade(metal, 1.08), 5);
    return p.vary(metal, 5);
  });
  p.parts(LEGS, 'base', (f) => {
    if (f.face === 'top') return metal;
    if (f.face === 'bottom') return darker;
    if (f.y === 6) return f.face === 'front' && innerCol(f) === 1 ? cyan : darker;
    if (f.y >= 10) return p.vary(dark, 5);
    return p.vary(metal, 5);
  });
  // Glass dome highlight on the outer layer.
  p.part('head', 'outer', (f) => (f.face === 'front' && f.y === 2 && f.x >= 2 && f.x <= 3 ? [255, 255, 255, 110] : null));
}

function paintHoodie(p: Painter): void {
  const skin: RGB = [240, 200, 164];
  paintHead(p, { skin, hair: [110, 72, 40], eyes: [88, 58, 34], brows: [90, 58, 32] });
  const greens: RGB[] = [[76, 164, 60], [94, 186, 72], [62, 140, 50], [116, 204, 88]];
  const cloth = () => p.pick(greens, [4, 3, 3, 1]);
  const print: RGB = [30, 46, 30];
  const face = ['.XX..XX.', '.XX..XX.', '...XX...', '..XXXX..', '..X..X..'];
  p.part('body', 'base', (f) => {
    if (f.face === 'front') {
      const row = face[f.y - 2];
      if (row && row[f.x] === 'X') return print;
      if (f.y <= 2 && (f.x === 3 || f.x === 4)) return f.y === 2 ? null : [226, 226, 232];
      if (f.y >= 8 && f.y <= 10 && f.x >= 1 && f.x <= 6) return shade(cloth(), f.y === 8 ? 0.72 : 0.84);
    }
    if (f.face !== 'top' && f.face !== 'bottom' && f.y === 11) return shade(greens[2], 0.8);
    return cloth();
  });
  // Re-draw the chest print cells that the drawstrings skipped.
  p.glyph('body', 'base', 'front', ['...XX...'], 0, 2, (ch) => (ch === 'X' ? print : null));
  p.parts(ARMS, 'base', (f) => {
    if (f.face === 'bottom') return shade(skin, 0.85);
    if (f.y === 11) return p.vary(skin, 3);
    if (f.y === 10) return shade(greens[2], 0.8);
    return cloth();
  });
  const jeans: RGB = [48, 62, 98];
  p.parts(LEGS, 'base', (f) => {
    if (f.face === 'top') return jeans;
    if (f.face === 'bottom') return [70, 72, 80];
    if (f.y >= 10) {
      if (f.y === 10 && f.face !== 'back') return f.x % 3 === 1 ? greens[1] : [236, 236, 240];
      return f.y === 11 ? [200, 200, 208] : [236, 236, 240];
    }
    return p.vary(jeans, 7);
  });
  // The hood (outer head layer): frames the face, covers the top, sides and back.
  p.part('head', 'outer', (f) => {
    if (f.face === 'bottom') return null;
    if (f.face === 'front') {
      if (f.y === 0 || f.x === 0 || f.x === 7) return cloth();
      if (f.y === 1 && (f.x === 1 || f.x === 6)) return shade(greens[2], 0.85);
      return null;
    }
    return cloth();
  });
}

function paintNinja(p: Painter): void {
  const suit: RGB = [34, 36, 46];
  const suitLight: RGB = [52, 56, 70];
  const red: RGB = [204, 44, 56];
  const skin: RGB = [226, 176, 132];
  const cloth = () => (p.random() < 0.18 ? suitLight : p.vary(suit, 4));
  p.part('head', 'base', (f) => {
    if (f.y === 1 && f.face !== 'top' && f.face !== 'bottom') return p.vary(red, 8);
    if (f.face === 'back' && f.y >= 2 && f.y <= 4 && (f.x === 3 || f.x === 4)) return p.vary(red, 8);
    if (f.face === 'front' && (f.y === 3 || f.y === 4) && f.x >= 1 && f.x <= 6) {
      if (f.y === 4 && (f.x === 2 || f.x === 5)) return [20, 20, 24];
      if (f.y === 4 && (f.x === 1 || f.x === 6)) return WHITE;
      if (f.y === 3 && f.x >= 1 && f.x <= 6 && (f.x === 1 || f.x === 2 || f.x === 5 || f.x === 6)) return shade(skin, 0.7);
      return p.vary(skin, 3);
    }
    return cloth();
  });
  p.part('body', 'base', (f) => {
    if (f.face !== 'top' && f.face !== 'bottom' && (f.y === 8 || f.y === 9)) return f.face === 'front' && f.x === 5 && f.y === 9 ? shade(red, 0.75) : p.vary(red, 8);
    if (f.face === 'front' && f.y < 8 && f.x === 7 - f.y) return suitLight;
    if (f.face === 'front' && f.y < 8 && f.x === 6 - f.y) return shade(suitLight, 1.2);
    return cloth();
  });
  p.parts(ARMS, 'base', (f) => {
    if (f.face !== 'top' && f.face !== 'bottom' && f.y >= 6 && f.y <= 10) return f.y % 2 ? [72, 74, 86] : [58, 60, 72];
    return cloth();
  });
  p.parts(LEGS, 'base', (f) => {
    if (f.face === 'bottom') return [14, 14, 18];
    if (f.face !== 'top' && f.y >= 10) return [18, 18, 22];
    if (f.face !== 'top' && f.y >= 6 && f.y <= 9) return f.y % 2 ? [72, 74, 86] : [58, 60, 72];
    return cloth();
  });
  // Headband tails flutter off the back of the head (outer layer).
  p.part('head', 'outer', (f) => (f.face === 'back' && f.y >= 2 && f.y <= 6 && (f.x === 3 || f.x === 4) && f.y - 2 <= (f.x === 3 ? 4 : 3) ? p.vary(red, 10) : null));
}

function paintWizard(p: Painter): void {
  const skin: RGB = [232, 190, 156];
  const beard: RGB = [236, 236, 242];
  const beardShade: RGB = [196, 198, 210];
  const robe: RGB = [96, 60, 168];
  const robeDark: RGB = [68, 42, 128];
  const gold: RGB = [255, 212, 90];
  paintHead(p, { skin, hair: beard, eyes: [70, 130, 220], brows: beardShade, fringe: 1, backHair: 8 });
  // Beard and moustache over the lower face.
  p.glyph('head', 'base', 'front', ['..####..', '.######.', '########'], 0, 5, (ch) => (ch === '#' ? (p.random() < 0.3 ? beardShade : beard) : null));
  p.glyph('head', 'base', 'front', ['.#....#.'], 0, 5, beard);
  const starry = (c: RGB): RGB => (p.random() < 0.06 ? gold : p.vary(c, 6));
  p.part('body', 'base', (f) => {
    if (f.face === 'front') {
      const beardW = f.y <= 2 ? 3 : f.y <= 4 ? 2 : f.y <= 5 ? 1 : 0;
      if (beardW && Math.abs(f.x - 3.5) < beardW) return p.random() < 0.3 ? beardShade : beard;
      if (f.y === 8) return f.x === 3 ? shade(gold, 0.8) : gold;
      if (f.y > 8 && (f.x === 3 || f.x === 4)) return robeDark;
    }
    if (f.face !== 'top' && f.face !== 'bottom' && f.y === 8) return gold;
    return starry(robe);
  });
  p.parts(ARMS, 'base', (f) => {
    if (f.face === 'bottom') return shade(skin, 0.85);
    if (f.y === 11) return p.vary(skin, 3);
    if (f.y === 9 || f.y === 10) return f.y === 9 ? gold : robeDark;
    return starry(robe);
  });
  p.parts(LEGS, 'base', (f) => {
    if (f.face === 'bottom') return [60, 40, 30];
    if (f.face !== 'top' && f.y === 11) return [72, 48, 34];
    if (f.face !== 'top' && f.y === 10) return gold;
    return starry(robeDark);
  });
  // Pointed-cap brim with a gold band and gem.
  p.part('head', 'outer', (f) => {
    if (f.face === 'bottom') return null;
    if (f.face === 'top') return starry(robe);
    if (f.y <= 1) return starry(robe);
    if (f.y === 2) return f.face === 'front' && (f.x === 3 || f.x === 4) ? [120, 220, 255] : gold;
    return null;
  });
}

function paintBlank(p: Painter): void {
  const c: RGB = [206, 211, 220];
  for (const part of Object.keys(PART_INFO) as SkinPart[]) p.part(part, 'base', () => c);
}

export const STARTERS: readonly StarterDef[] = [
  { id: 'blank', name: 'Blank', description: 'A plain mannequin to paint from scratch.', paint: paintBlank },
  {
    id: 'template',
    name: 'Template',
    description: 'Every body part in its own colour, with each face labelled.',
    badge: 'Beginner friendly',
    paint: paintTemplate,
  },
  { id: 'explorer', name: 'Explorer', description: 'Safari hat, vest, backpack and boots.', paint: paintExplorer },
  { id: 'knight', name: 'Knight', description: 'Helmet with plume, tabard and chainmail.', paint: paintKnight },
  { id: 'robot', name: 'Robot', description: 'Metal panels, glowing eyes and chest lights.', paint: paintRobot },
  { id: 'hoodie', name: 'Creeper Hoodie', description: 'A green hoodie with the hood up.', paint: paintHoodie },
  { id: 'ninja', name: 'Ninja', description: 'Dark suit, red headband and wrapped arms.', paint: paintNinja },
  { id: 'wizard', name: 'Wizard', description: 'Starry robe, long beard and a gold-banded hat.', paint: paintWizard },
];

/** A new 64x64 skin painted by a starter. */
export function createStarterSkin(id: string, model: SkinModel): ImageData {
  const def = STARTERS.find((s) => s.id === id) ?? STARTERS[0];
  const Ctor = (globalThis as { ImageData?: typeof ImageData }).ImageData;
  const img = Ctor ? new Ctor(64, 64) : ({ width: 64, height: 64, data: new Uint8ClampedArray(64 * 64 * 4), colorSpace: 'srgb' } as ImageData);
  let seed = 0;
  for (const ch of def.id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  def.paint(new Painter(img, model, seed || 1));
  return img;
}

