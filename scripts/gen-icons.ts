// Writes the app icons (web app manifest, Apple touch icon) from the logo artwork in
// src/ui/logo.ts, so they always match the favicon and the in-app logo.
//   public/icons/icon-192.png, -512.png, -1024.png  transparent background ("any"; the Store
//                                                packager builds the Windows tiles from the largest)
//   public/icons/icon-maskable-192.png, -512.png dark background with safe-zone padding ("maskable")
//   public/icons/icon-monochrome-512.png         one-colour silhouette ("monochrome": Android themed
//                                                icons and notification badges)
//   public/icons/shortcut-*.png                  96x96 app shortcut icons (pixelarticons glyphs)
//   public/apple-touch-icon.png                  180x180, dark background
//   docs/store/store-logo-300.png, box-art-1080.png  Microsoft Store listing logos
// Run: npx tsx scripts/gen-icons.ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
const repo = (p: string) => fileURLToPath(new URL(`../${p}`, import.meta.url));
mkdirSync(repo('public/icons'), { recursive: true });
mkdirSync(repo('docs/store'), { recursive: true });

const save = (file: string, size: number, data: Uint8Array) => {
  const png = encode({ width: size, height: size, data, channels: 4, depth: 8 });
  writeFileSync(repo(file), png);
  console.log(`wrote ${file} (${png.length} bytes)`);
};
const write = (file: string, size: number, scale: number, bg: [number, number, number] | null) => save(file, size, render(size, scale, bg));

/**
 * One-colour version: black, with the logo's shading kept in the alpha channel (lighter faces are
 * more opaque), so the block still reads as a block when the system tints it.
 */
function monochrome(size: number, scale: number): Uint8Array {
  const img = render(size, scale, null);
  for (let i = 0; i < img.length; i += 4) {
    const lum = (0.2126 * img[i] + 0.7152 * img[i + 1] + 0.0722 * img[i + 2]) / 255;
    const k = Math.min(1, 0.4 + lum * 1.1);
    img[i] = img[i + 1] = img[i + 2] = 0;
    img[i + 3] = Math.round(img[i + 3] * k);
  }
  return img;
}

/** Cells of the 24x24 grid a pixelarticons glyph covers (every subpath is an axis-aligned rectangle). */
function glyphCells(name: string): boolean[] {
  const svg = readFileSync(repo(`node_modules/pixelarticons/svg/${name}.svg`), 'utf8');
  const cells = new Array<boolean>(24 * 24).fill(false);
  for (const [, d] of svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)) {
    let x = 0;
    let y = 0;
    let pts: [number, number][] = [];
    const flush = () => {
      if (pts.length >= 3) {
        const xs = pts.map((p) => p[0]);
        const ys = pts.map((p) => p[1]);
        for (let cy = Math.min(...ys); cy < Math.max(...ys); cy++) for (let cx = Math.min(...xs); cx < Math.max(...xs); cx++) cells[cy * 24 + cx] = true;
      }
      pts = [];
    };
    for (const [, cmd, args] of d.matchAll(/([MmHhVvLlZz])([^MmHhVvLlZz]*)/g)) {
      const n = (args.match(/-?\d*\.?\d+/g) ?? []).map(Number);
      const rel = cmd === cmd.toLowerCase();
      switch (cmd.toLowerCase()) {
        case 'm':
          flush();
          x = rel ? x + n[0] : n[0];
          y = rel ? y + n[1] : n[1];
          pts.push([x, y]);
          break;
        case 'h':
          x = rel ? x + n[0] : n[0];
          pts.push([x, y]);
          break;
        case 'v':
          y = rel ? y + n[0] : n[0];
          pts.push([x, y]);
          break;
        case 'l':
          x = rel ? x + n[0] : n[0];
          y = rel ? y + n[1] : n[1];
          pts.push([x, y]);
          break;
        default: {
          // z: the pen goes back to the subpath's start
          const start = pts[0];
          flush();
          if (start) [x, y] = start;
        }
      }
    }
    flush();
  }
  return cells;
}

/** 96x96 shortcut icon: the glyph (3px per cell) in the page background colour on a rounded accent tile. */
function shortcutIcon(name: string, accent: [number, number, number]): Uint8Array {
  const S = 96;
  const R = 22;
  const unit = 3;
  const off = (S - 24 * unit) / 2;
  const cells = glyphCells(name);
  const out = new Uint8Array(S * S * 4);
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      // rounded corners, anti-aliased by 4x4 supersampling
      let cover = 0;
      for (let sy = 0; sy < 4; sy++)
        for (let sx = 0; sx < 4; sx++) {
          const x = px + (sx + 0.5) / 4;
          const y = py + (sy + 0.5) / 4;
          const dx = Math.max(R - x, 0, x - (S - R));
          const dy = Math.max(R - y, 0, y - (S - R));
          if (dx * dx + dy * dy <= R * R) cover++;
        }
      const gx = Math.floor((px - off) / unit);
      const gy = Math.floor((py - off) / unit);
      const ink = gx >= 0 && gy >= 0 && gx < 24 && gy < 24 && cells[gy * 24 + gx];
      const c = ink ? DARK : accent;
      const o = (py * S + px) * 4;
      out[o] = c[0];
      out[o + 1] = c[1];
      out[o + 2] = c[2];
      out[o + 3] = Math.round((cover / 16) * 255);
    }
  }
  return out;
}

write('public/icons/icon-192.png', 192, 1, null);
write('public/icons/icon-512.png', 512, 1, null);
write('public/icons/icon-1024.png', 1024, 1, null);
// Maskable icons are cropped to a circle of 80% diameter: keep the block inside it.
write('public/icons/icon-maskable-192.png', 192, 0.62, DARK);
write('public/icons/icon-maskable-512.png', 512, 0.62, DARK);
save('public/icons/icon-monochrome-512.png', 512, monochrome(512, 0.62));
write('public/apple-touch-icon.png', 180, 0.78, DARK);

const GREEN: [number, number, number] = [0x5b, 0xd3, 0x5b];
const BLUE: [number, number, number] = [0x4f, 0xb3, 0xff];
const PURPLE: [number, number, number] = [0xb0, 0x7c, 0xff];
save('public/icons/shortcut-textures.png', 96, shortcutIcon('image', GREEN));
save('public/icons/shortcut-converter.png', 96, shortcutIcon('repeat', GREEN));
save('public/icons/shortcut-skins.png', 96, shortcutIcon('human', BLUE));
save('public/icons/shortcut-shaders.png', 96, shortcutIcon('sparkles', PURPLE));

// Microsoft Store listing: 1:1 app tile icon (300x300) and 1:1 box art (1080x1080), logo on the dark background.
write('docs/store/store-logo-300.png', 300, 0.72, DARK);
write('docs/store/box-art-1080.png', 1080, 0.6, DARK);
