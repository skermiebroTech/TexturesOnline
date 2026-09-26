// Minimal AssetIndex over the extracted fixture files (served by the Vite dev server).
import { convertIndexedToRgb, decode } from 'fast-png';
import type { AssetIndex, Edition, TextureInfo } from '../../../src/core/types';

const HERE = import.meta.url.split('?')[0];
const BASE = HERE.slice(0, HERE.lastIndexOf('/') + 1) + 'fixtures/';

function toRGBA(png: ReturnType<typeof decode>): ImageData {
  const { width, height } = png;
  const out = new Uint8ClampedArray(width * height * 4);
  let src: ArrayLike<number> = png.data;
  let channels = png.channels;
  let depth: number = png.depth;
  if (png.palette) {
    src = convertIndexedToRgb(png);
    channels = png.palette[0]?.length === 4 || png.transparency ? 4 : 3;
    depth = 8;
    if (src.length === width * height * 4) channels = 4;
    else if (src.length === width * height * 3) channels = 3;
  }
  const scale = depth === 16 ? 1 / 257 : 1;
  for (let i = 0; i < width * height; i++) {
    const s = i * channels;
    let r: number, g: number, b: number, a: number;
    if (channels === 1) { r = g = b = src[s] * scale; a = 255; }
    else if (channels === 2) { r = g = b = src[s] * scale; a = src[s + 1] * scale; }
    else if (channels === 3) { r = src[s] * scale; g = src[s + 1] * scale; b = src[s + 2] * scale; a = 255; }
    else { r = src[s] * scale; g = src[s + 1] * scale; b = src[s + 2] * scale; a = src[s + 3] * scale; }
    const key = !png.palette ? png.transparency : undefined;
    if (key && channels === 1 && src[s] === key[0]) a = 0;
    if (key && channels === 3 && src[s] === key[0] && src[s + 1] === key[1] && src[s + 2] === key[2]) a = 0;
    out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = a;
  }
  return new ImageData(out, width, height);
}

/** Uncompressed / RLE truecolor TGA (enough for the Bedrock fixtures). */
function decodeTga(buf: Uint8Array): ImageData {
  const idLen = buf[0];
  const type = buf[2];
  const w = buf[12] | (buf[13] << 8);
  const h = buf[14] | (buf[15] << 8);
  const bpp = buf[16] / 8;
  const topDown = (buf[17] & 0x20) !== 0;
  let p = 18 + idLen + (buf[1] ? (buf[5] | (buf[6] << 8)) * (buf[7] / 8) : 0);
  const px = new Uint8ClampedArray(w * h * 4);
  const put = (i: number, o: number) => {
    px[i * 4] = buf[o + 2]; px[i * 4 + 1] = buf[o + 1]; px[i * 4 + 2] = buf[o];
    px[i * 4 + 3] = bpp === 4 ? buf[o + 3] : 255;
  };
  let i = 0;
  if (type === 2) {
    for (; i < w * h; i++, p += bpp) put(i, p);
  } else if (type === 10) {
    while (i < w * h) {
      const hdr = buf[p++];
      const n = (hdr & 0x7f) + 1;
      if (hdr & 0x80) { for (let k = 0; k < n; k++) put(i++, p); p += bpp; }
      else for (let k = 0; k < n; k++, p += bpp) put(i++, p);
    }
  } else throw new Error(`Unsupported TGA type ${type}`);
  if (!topDown) {
    const row = w * 4;
    const tmp = new Uint8ClampedArray(row);
    for (let y = 0; y < h / 2; y++) {
      const a = y * row, b = (h - 1 - y) * row;
      tmp.set(px.subarray(a, a + row)); px.copyWithin(a, b, b + row); px.set(tmp, b);
    }
  }
  return new ImageData(px, w, h);
}

export async function loadFixtureIndex(): Promise<{ java: string[]; bedrock: string[] }> {
  const res = await fetch(BASE + 'index.json');
  if (!res.ok) throw new Error('Fixtures missing: run node tests/harness/preview/extract-fixtures.mjs <client.jar> --bedrock');
  return res.json();
}

export async function fixtureAssets(edition: Edition): Promise<AssetIndex> {
  const index = await loadFixtureIndex();
  const files = edition === 'java' ? index.java : index.bedrock;
  const set = new Set(files);
  const prefix = edition === 'java' ? 'java/' : 'bedrock/';
  const readFile = async (path: string) => {
    if (!set.has(path)) throw new Error(`Not in fixtures: ${path}`);
    const res = await fetch(BASE + prefix + path);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
    return new Uint8Array(await res.arrayBuffer());
  };
  const root = edition === 'java' ? 'assets/minecraft/textures/' : 'textures/';
  const textures: TextureInfo[] = files
    .filter((f) => f.endsWith('.png') || f.endsWith('.tga'))
    .map((path) => {
      const id = path.slice(root.length).replace(/\.(png|tga)$/, '');
      return { path, id, name: id.split('/').pop() ?? id, category: 'block', ext: path.endsWith('.tga') ? 'tga' : 'png' } as TextureInfo;
    });
  return {
    edition,
    version: edition === 'java' ? '26.3' : 'main',
    textures,
    hasFile: (p) => set.has(p),
    listFiles: (prefix2) => files.filter((f) => f.startsWith(prefix2)),
    readFile,
    readText: async (p) => new TextDecoder().decode(await readFile(p)),
    readImage: async (p) => {
      const bytes = await readFile(p);
      return p.endsWith('.tga') ? decodeTga(bytes) : toRGBA(decode(bytes));
    },
  };
}
