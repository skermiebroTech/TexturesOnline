// The TexturesOnline mark: an isometric pixel grass block (original artwork, generated).
// logoSvgMarkup() is pure so it can also generate public/favicon.svg at build time.

type Pt = [number, number];

const GRASS = ['#74d64e', '#63c843', '#58b83b', '#82e05c', '#6acc47'];
const DIRT = ['#8d5d3b', '#7b5033', '#9b6a45', '#6f472d', '#86583a'];

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * k))));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

const fmt = (n: number) => String(Math.round(n * 100) / 100);

function quad(o: Pt, u: Pt, v: Pt, i: number, j: number, n: number): string {
  const p = (a: number, b: number): Pt => [o[0] + (u[0] * a) / n + (v[0] * b) / n, o[1] + (u[1] * a) / n + (v[1] * b) / n];
  const pts = [p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1)];
  return pts.map((q) => `${fmt(q[0])},${fmt(q[1])}`).join(' ');
}

/** SVG markup of the logo block on a 32x32 view box. */
export function logoSvgMarkup(opts: { cells?: number; seed?: number; title?: string } = {}): string {
  const n = opts.cells ?? 4;
  const rnd = mulberry(opts.seed ?? 11);
  const pick = (arr: string[]) => arr[Math.floor(rnd() * arr.length)];
  const T: Pt = [16, 2];
  const R: Pt = [30, 9];
  const B: Pt = [16, 16];
  const L: Pt = [2, 9];
  const down: Pt = [0, 14];
  const polys: string[] = [];
  const cell = (pts: string, fill: string) => polys.push(`<polygon points="${pts}" fill="${fill}" stroke="${fill}" stroke-width=".35" stroke-linejoin="round"/>`);

  // top face
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) cell(quad(T, [R[0] - T[0], R[1] - T[1]], [L[0] - T[0], L[1] - T[1]], i, j, n), pick(GRASS));

  // side faces: grass lip on the first row with random drips on the second
  const drips = Array.from({ length: n * 2 }, () => rnd() < 0.45);
  const side = (o: Pt, u: Pt, k: number, face: number) => {
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const grassy = j === 0 || (j === 1 && drips[face * n + i]);
        cell(quad(o, u, down, i, j, n), shade(pick(grassy ? GRASS : DIRT), k));
      }
    }
  };
  side(L, [B[0] - L[0], B[1] - L[1]], 0.86, 0);
  side(B, [R[0] - B[0], R[1] - B[1]], 0.68, 1);

  const title = opts.title ? `<title>${opts.title}</title>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${title}${polys.join('')}</svg>`;
}

let cached: string | null = null;

/** Inline SVG logo element (decorative unless a label is given). */
export function logoMark(size = 32, label?: string): SVGSVGElement {
  cached ??= logoSvgMarkup();
  const holder = document.createElement('div');
  holder.innerHTML = cached;
  const svg = holder.firstElementChild as SVGSVGElement;
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.classList.add('logo-mark');
  if (label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  } else {
    svg.setAttribute('aria-hidden', 'true');
  }
  return svg;
}
