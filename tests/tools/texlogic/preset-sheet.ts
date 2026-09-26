/**
 * Renders every effect preset (rows) over a set of real textures (columns) into one PNG contact
 * sheet, for eyeballing how the presets look.
 *
 *   npx tsx tests/tools/texlogic/preset-sheet.ts <extracted-jar-dir> <out.png> [scale]
 *
 * <extracted-jar-dir> is a folder containing assets/minecraft/textures/** from a client jar.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { decode, encode, convertIndexedToRgb } from 'fast-png';
import { EFFECT_PRESETS, applyEffects, type EffectContext } from '../../../src/tools/textures/effects';
import type { TextureCategory } from '../../../src/core/types';

const [root, outFile, scaleArg] = process.argv.slice(2);
if (!root || !outFile) {
  console.error('usage: preset-sheet.ts <extracted-jar-dir> <out.png> [scale]');
  process.exit(1);
}
const SCALE = Number(scaleArg) || 4;
const TEX = join(root, 'assets/minecraft/textures');

type Img = { width: number; height: number; data: Uint8ClampedArray<ArrayBuffer> };

function load(rel: string): Img {
  const png = decode(readFileSync(join(TEX, rel)));
  const w = png.width;
  const h = png.height;
  const out = new Uint8ClampedArray(w * h * 4);
  const src = png.palette ? convertIndexedToRgb(png) : png.data;
  const ch = png.palette ? (png.palette[0].length === 4 ? 4 : 3) : png.channels;
  const div = png.depth === 16 ? 257 : 1;
  for (let i = 0; i < w * h; i++) {
    const v = (c: number) => (src as ArrayLike<number>)[i * ch + c] / div;
    if (ch >= 3) {
      out[i * 4] = v(0);
      out[i * 4 + 1] = v(1);
      out[i * 4 + 2] = v(2);
      out[i * 4 + 3] = ch === 4 ? v(3) : 255;
    } else {
      out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = v(0);
      out[i * 4 + 3] = ch === 2 ? v(1) : 255;
    }
  }
  return { width: w, height: h, data: out };
}

interface Col { path: string; category: TextureCategory; tint?: 'grass' | 'foliage' | 'water'; frame?: boolean }
const COLS: Col[] = [
  { path: 'block/grass_block_side.png', category: 'block' },
  { path: 'block/grass_block_top.png', category: 'block', tint: 'grass' },
  { path: 'block/oak_leaves.png', category: 'block', tint: 'foliage' },
  { path: 'block/stone.png', category: 'block' },
  { path: 'block/cobblestone.png', category: 'block' },
  { path: 'block/oak_planks.png', category: 'block' },
  { path: 'block/oak_log.png', category: 'block' },
  { path: 'block/diamond_ore.png', category: 'block' },
  { path: 'block/bricks.png', category: 'block' },
  { path: 'block/sand.png', category: 'block' },
  { path: 'block/glass.png', category: 'block' },
  { path: 'block/poppy.png', category: 'block' },
  { path: 'block/torch.png', category: 'block' },
  { path: 'block/water_still.png', category: 'block', tint: 'water', frame: true },
  { path: 'item/diamond_sword.png', category: 'item' },
  { path: 'item/apple.png', category: 'item' },
  { path: 'item/golden_apple.png', category: 'item' },
  { path: 'item/iron_pickaxe.png', category: 'item' },
  { path: 'item/emerald.png', category: 'item' },
  { path: 'item/redstone.png', category: 'item' },
].filter((c) => existsSync(join(TEX, c.path)));

const grassMap = load('colormap/grass.png');
const foliageMap = load('colormap/foliage.png');

function mapColor(map: Img, layers: typeof EFFECT_PRESETS[number]['layers'], path: string): [number, number, number] {
  const img = applyEffects(map as unknown as ImageData, layers, { path: `assets/minecraft/textures/${path}`, category: 'colormap' });
  // plains: temperature 0.8, downfall 0.4
  const t = 0.8;
  const r = 0.4 * t;
  const x = Math.floor((1 - t) * 255);
  const y = Math.floor((1 - r) * 255);
  const i = (y * 256 + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
}

const rows: { label: string; layers: typeof EFFECT_PRESETS[number]['layers'] }[] = [{ label: 'original', layers: [] }, ...EFFECT_PRESETS.map((p) => ({ label: p.id, layers: p.layers }))];
const CELL = 16 * 2 * SCALE + 4; // room for 2x upscaled textures
const W = COLS.length * CELL;
const H = rows.length * CELL;
const sheet = new Uint8ClampedArray(W * H * 4);
for (let i = 0; i < W * H; i++) {
  const x = i % W;
  const y = Math.floor(i / W);
  const c = ((x >> 3) + (y >> 3)) & 1 ? 60 : 44;
  sheet[i * 4] = sheet[i * 4 + 1] = sheet[i * 4 + 2] = c;
  sheet[i * 4 + 3] = 255;
}

const t0 = performance.now();
rows.forEach((row, ri) => {
  const grass = mapColor(grassMap, row.layers, 'colormap/grass.png');
  const foliage = mapColor(foliageMap, row.layers, 'colormap/foliage.png');
  COLS.forEach((col, ci) => {
    const src = load(col.path);
    const ctx: EffectContext = { path: `assets/minecraft/textures/${col.path}`, category: col.category, animated: !!col.frame };
    let img = applyEffects(src as unknown as ImageData, row.layers, ctx) as unknown as Img;
    if (col.frame) img = { width: img.width, height: img.width, data: img.data.slice(0, img.width * img.width * 4) };
    const tint = col.tint === 'grass' ? grass : col.tint === 'foliage' ? foliage : col.tint === 'water' ? [63, 118, 228] : null;
    const s = Math.max(1, Math.floor((CELL - 4) / Math.max(img.width, img.height)));
    for (let y = 0; y < img.height * s; y++) {
      for (let x = 0; x < img.width * s; x++) {
        const si = (Math.floor(y / s) * img.width + Math.floor(x / s)) * 4;
        const a = img.data[si + 3] / 255;
        if (!a) continue;
        const di = ((ri * CELL + 2 + y) * W + ci * CELL + 2 + x) * 4;
        for (let c = 0; c < 3; c++) {
          const v = tint ? (img.data[si + c] * tint[c]) / 255 : img.data[si + c];
          sheet[di + c] = sheet[di + c] * (1 - a) + v * a;
        }
      }
    }
  });
});
console.log(`rendered ${rows.length} rows x ${COLS.length} textures in ${(performance.now() - t0).toFixed(0)} ms`);
console.log(rows.map((r, i) => `${i}: ${r.label}`).join('\n'));
writeFileSync(outFile, encode({ width: W, height: H, data: sheet, channels: 4, depth: 8 }));
