// Writes the app icons (web app manifest, Apple touch icon) from the logo artwork in
// src/ui/logo.ts, so they always match the favicon and the in-app logo.
//   public/icons/icon-192.png, icon-512.png      transparent background ("any")
//   public/icons/icon-maskable-512.png          dark background with safe-zone padding ("maskable")
//   public/apple-touch-icon.png                 180x180, dark background
// Run: npx tsx scripts/gen-icons.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { encode } from 'fast-png';
import { logoSvgMarkup } from '../src/ui/logo';

interface Poly {
  pts: [number, number][];
  rgb: [number, number, number];
}

function parseLogo(): Poly[] {
  const polys: Poly[] = [];
  for (const m of logoSvgMarkup().matchAll(/<polygon points="([^"]+)" fill="#([0-9a-f]{6})"/g)) {
    const pts = m[1].split(' ').map((p) => p.split(',').map(Number) as [number, number]);
    const n = parseInt(m[2], 16);
    polys.push({ pts, rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255] });
  }
  return polys;
}

/** Point-in-convex-polygon test (either winding). */
function inside(pts: [number, number][], x: number, y: number): boolean {
  let sign = 0;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    const c = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    if (c === 0) continue;
    const s = c > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/**
 * Renders the 32x32 logo into a size x size RGBA image. `scale` is the logo's share of the image
 * width; the logo is centred. Edges are anti-aliased by 8x8 supersampling.
 */
function render(size: number, scale: number, background: [number, number, number] | null): Uint8Array {
  const polys = parseLogo();
  const SS = 8;
  const out = new Uint8Array(size * size * 4);
  const logoPx = size * scale;
  const unit = logoPx / 32;
  const off = (size - logoPx) / 2;
  // Bounding boxes in pixel space, to skip most tests.
  const boxes = polys.map((p) => {
    const xs = p.pts.map(([x]) => off + x * unit);
    const ys = p.pts.map(([, y]) => off + y * unit);
    return [Math.floor(Math.min(...xs)), Math.floor(Math.min(...ys)), Math.ceil(Math.max(...xs)), Math.ceil(Math.max(...ys))];
  });
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const lx = (px + (sx + 0.5) / SS - off) / unit;
          const ly = (py + (sy + 0.5) / SS - off) / unit;
          let hit: Poly | null = null;
          for (let i = polys.length - 1; i >= 0; i--) {
            const bb = boxes[i];
            if (px < bb[0] - 1 || px > bb[2] || py < bb[1] - 1 || py > bb[3]) continue;
            if (inside(polys[i].pts, lx, ly)) {
              hit = polys[i];
              break;
            }
          }
          if (hit) {
            r += hit.rgb[0];
            g += hit.rgb[1];
            b += hit.rgb[2];
            a += 1;
          } else if (background) {
            r += background[0];
            g += background[1];
            b += background[2];
            a += 1;
          }
        }
      }
      const o = (py * size + px) * 4;
      if (a) {
        out[o] = Math.round(r / a);
        out[o + 1] = Math.round(g / a);
        out[o + 2] = Math.round(b / a);
      }
      out[o + 3] = Math.round((a / (SS * SS)) * 255);
    }
  }
  return out;
}

const DARK: [number, number, number] = [0x0d, 0x0f, 0x14];
const pub = (p: string) => fileURLToPath(new URL(`../public/${p}`, import.meta.url));
mkdirSync(pub('icons'), { recursive: true });

const write = (file: string, size: number, scale: number, bg: [number, number, number] | null) => {
  const png = encode({ width: size, height: size, data: render(size, scale, bg), channels: 4, depth: 8 });
  writeFileSync(pub(file), png);
  console.log(`wrote public/${file} (${png.length} bytes)`);
};

write('icons/icon-192.png', 192, 1, null);
write('icons/icon-512.png', 512, 1, null);
// Maskable icons are cropped to a circle of 80% diameter: keep the block inside it.
write('icons/icon-maskable-512.png', 512, 0.62, DARK);
write('apple-touch-icon.png', 180, 0.78, DARK);
