// Reading fonts back: an existing pack (.zip / .mcpack, or a folder's files) or the game's own
// font from the files of a version, into the font maker's glyph cells. Java: font/default.json
// providers (bitmap, ttf, space, reference; filtered providers that only apply with an option on
// are skipped) or textures/font/ascii.png alone; Bedrock: font/default8.png and glyph_XX.png.
// Glyph pixels are placed by their position on screen, so any cell size, `height` and `ascent`
// lands where the game draws it.

import { decodeImage } from '../../core/image';
import { isZip, readZip } from '../../core/zip';
import { parseLenientJson } from '../../editions/bedrock/catalog';
import {
  BASELINE,
  CELL_ASCENT,
  cellH,
  cellW,
  emptyMask,
  isDrawable,
  isEmptyMask,
  legacyCells,
  newFont,
  unit,
  type FontDoc,
  type FontTtf,
  type GlyphSize,
  type Mask,
} from './font';
import { readFontFile } from './sfnt';
import { t } from './i18n/text';
import { fmt } from '../../i18n/editor-text';

export interface FileSource {
  has(path: string): boolean;
  read(path: string): Promise<Uint8Array>;
  list(prefix: string): string[];
}

export interface FontImport {
  doc: FontDoc;
  edition: 'java' | 'bedrock';
  /** Pack name (from pack.mcmeta / manifest.json) */
  name: string | null;
  notes: string[];
}

export class FontImportError extends Error {
  constructor(
    message: string,
    readonly code: 'no-font' | 'not-pack',
  ) {
    super(message);
  }
}

/** A file source over an unzipped archive's entries. */
export function mapSource(files: Record<string, Uint8Array>, prefix = ''): FileSource {
  const keys = Object.keys(files);
  return {
    has: (p) => Object.prototype.hasOwnProperty.call(files, prefix + p),
    read: async (p) => {
      const b = files[prefix + p];
      if (!b) throw new Error(`Missing ${p}`);
      return b;
    },
    list: (pre) => keys.filter((k) => k.startsWith(prefix + pre)).map((k) => k.slice(prefix.length)),
  };
}

/** Folder of an archive that holds the pack (archives often wrap it in a folder). */
export function packRoot(paths: string[]): { prefix: string; edition: 'java' | 'bedrock' | null } {
  const depth = (p: string) => p.split('/').length;
  const best = (re: RegExp) => paths.filter((p) => re.test(p)).sort((a, b) => depth(a) - depth(b))[0];
  const mcmeta = best(/(^|\/)pack\.mcmeta$/);
  const manifest = best(/(^|\/)manifest\.json$/);
  if (mcmeta && (!manifest || depth(mcmeta) <= depth(manifest))) return { prefix: mcmeta.slice(0, -'pack.mcmeta'.length), edition: 'java' };
  if (manifest) return { prefix: manifest.slice(0, -'manifest.json'.length), edition: 'bedrock' };
  const assets = paths.find((p) => /(^|\/)assets\/minecraft\//.test(p));
  if (assets) return { prefix: assets.slice(0, assets.indexOf('assets/minecraft/')), edition: 'java' };
  const font = paths.find((p) => /(^|\/)font\/(default8|glyph_[0-9a-f]{2})\.png$/i.test(p));
  if (font) return { prefix: font.slice(0, font.search(/font\/[^/]+$/)), edition: 'bedrock' };
  return { prefix: '', edition: null };
}

// ---------------------------------------------------------------------------------------------
// Cells

/** Whether a pixel of a glyph sheet is ink: its alpha, or its brightness on sheets without transparency. */
function inkTest(img: ImageData): (x: number, y: number) => boolean {
  const d = img.data;
  let opaque = true;
  for (let i = 3; i < d.length; i += 4)
    if (d[i] < 255) {
      opaque = false;
      break;
    }
  if (opaque) return (x, y) => {
    const o = (y * img.width + x) * 4;
    return d[o] + d[o + 1] + d[o + 2] >= 384;
  };
  return (x, y) => d[(y * img.width + x) * 4 + 3] >= 128;
}

/**
 * One glyph of a sheet into a cell: the source cell (x0, y0, gw × gh pixels) is drawn `guiHeight`
 * pixels tall with its top `top` gui pixels below the line's top, as the game draws it.
 */
export function readCell(
  ink: (x: number, y: number) => boolean,
  x0: number,
  y0: number,
  gw: number,
  gh: number,
  guiHeight: number,
  top: number,
  size: GlyphSize,
): Mask {
  const out = emptyMask(size);
  const w = cellW(size);
  const h = cellH(size);
  const k = unit(size);
  const scale = guiHeight / gh;
  const cellTop = BASELINE - CELL_ASCENT;
  for (let y = 0; y < h; y++) {
    const gy = cellTop + (y + 0.5) / k;
    const sy = Math.floor((gy - top) / scale);
    if (sy < 0 || sy >= gh) continue;
    for (let x = 0; x < w; x++) {
      const sx = Math.floor((x + 0.5) / k / scale);
      if (sx >= gw) break;
      if (ink(x0 + sx, y0 + sy)) out[y * w + x] = 1;
    }
  }
  return out;
}

function put(doc: FontDoc, cp: number, m: Mask): boolean {
  if (!isDrawable(cp) || doc.glyphs.has(cp) || isEmptyMask(m)) return false;
  doc.glyphs.set(cp, m);
  return true;
}

// ---------------------------------------------------------------------------------------------
// Java

const resourcePath = (id: string, folder: string): string => {
  const [ns, path] = id.includes(':') ? id.split(':', 2) : ['minecraft', id];
  return `assets/${ns}/${folder}/${path}`;
};

interface Provider {
  type?: string;
  file?: string;
  id?: string;
  height?: number;
  ascent?: number;
  chars?: string[];
  advances?: Record<string, number>;
  size?: number;
  oversample?: number;
  shift?: [number, number];
  filter?: Record<string, boolean>;
}

async function readJson<T>(src: FileSource, path: string): Promise<T | null> {
  if (!src.has(path)) return null;
  try {
    return parseLenientJson<T>(new TextDecoder().decode(await src.read(path)));
  } catch {
    return null;
  }
}

/** Providers of a font file with its references resolved (missing ones are skipped). */
async function javaProviders(src: FileSource, path: string, seen = new Set<string>()): Promise<Provider[]> {
  if (seen.has(path)) return [];
  seen.add(path);
  const json = await readJson<{ providers?: Provider[] }>(src, path);
  const out: Provider[] = [];
  for (const p of json?.providers ?? []) {
    if (!p || typeof p !== 'object') continue;
    // Providers that only apply with an option switched on (Force Unicode Font, Japanese glyph variants)
    if (p.filter && Object.values(p.filter).some((v) => v === true)) continue;
    if (p.type === 'reference' && typeof p.id === 'string') out.push(...(await javaProviders(src, `${resourcePath(p.id, 'font')}.json`, seen)));
    else out.push(p);
  }
  return out;
}

/** Characters of each ascii.png cell for 1.13+ packs that only replace the image: rows 2-7 are the same in every version. */
const MODERN_ASCII_ROWS = (cp: number, i: number) => (i >= 32 && i < 128 ? cp : 0);

/** Reads the font of a Java pack (or the game's files). */
export async function importJavaFont(src: FileSource, size: GlyphSize, opts: { modern?: boolean } = {}): Promise<{ doc: FontDoc; notes: string[] }> {
  const doc = newFont(size);
  const notes: string[] = [];
  const providers = await javaProviders(src, 'assets/minecraft/font/default.json');
  let skipped = 0;
  for (const p of providers) {
    if (p.type === 'bitmap' && typeof p.file === 'string' && Array.isArray(p.chars) && p.chars.length) {
      const path = resourcePath(p.file, 'textures');
      if (!src.has(path)) continue;
      let img: ImageData;
      try {
        img = await decodeImage(await src.read(path), 'png');
      } catch {
        continue;
      }
      const rows = p.chars.map((r) => [...String(r)]);
      const cols = rows[0].length;
      const gw = Math.floor(img.width / cols);
      const gh = Math.floor(img.height / rows.length);
      if (!gw || !gh) continue;
      const height = typeof p.height === 'number' ? p.height : 8;
      const ascent = typeof p.ascent === 'number' ? p.ascent : 7;
      const ink = inkTest(img);
      rows.forEach((row, r) =>
        row.forEach((ch, c) => {
          const cp = ch.codePointAt(0)!;
          if (cp === 0) return;
          put(doc, cp, readCell(ink, c * gw, r * gh, gw, gh, height, BASELINE - ascent, size));
        }),
      );
    } else if (p.type === 'ttf' && typeof p.file === 'string' && !doc.ttf) {
      const path = resourcePath(p.file, 'font');
      if (!src.has(path)) continue;
      const info = readFontFile(await src.read(path));
      if (!info.truetype) continue;
      const ttf: FontTtf = {
        bytes: info.truetype,
        file: path.slice(path.lastIndexOf('/') + 1),
        size: typeof p.size === 'number' ? p.size : 11,
        oversample: typeof p.oversample === 'number' ? p.oversample : 1,
        shift: Array.isArray(p.shift) && p.shift.length === 2 ? [Number(p.shift[0]) || 0, Number(p.shift[1]) || 0] : [0, 0],
        chars: info.chars ?? new Set(),
      };
      doc.ttf = ttf;
      notes.push(fmt(t.import.ttfKept, { file: ttf.file }));
    } else if (p.type === 'space' && p.advances && typeof p.advances[' '] === 'number') {
      if (doc.space === 4) doc.space = Math.max(0, Math.min(16, Math.round(p.advances[' '])));
    } else if (p.type === 'unihex' || p.type === 'legacy_unicode') {
      skipped++;
    }
  }
  if (skipped) notes.push(t.import.unicodeSkipped);
  // ascii.png on its own (packs before 1.13, or packs that only replace the image)
  const ascii = 'assets/minecraft/textures/font/ascii.png';
  if (!providers.length && src.has(ascii)) {
    const img = await decodeImage(await src.read(ascii), 'png');
    const g = Math.floor(img.width / 16);
    const ink = inkTest(img);
    legacyCells('java').forEach((cp, i) => {
      const c = opts.modern ? MODERN_ASCII_ROWS(cp, i) : cp;
      if (c) put(doc, c, readCell(ink, (i % 16) * g, Math.floor(i / 16) * g, g, g, 8, 0, size));
    });
  }
  return { doc, notes };
}

// ---------------------------------------------------------------------------------------------
// Bedrock

export async function importBedrockFont(src: FileSource, size: GlyphSize): Promise<{ doc: FontDoc; notes: string[] }> {
  const doc = newFont(size);
  const notes: string[] = [];
  if (src.has('font/default8.png')) {
    const img = await decodeImage(await src.read('font/default8.png'), 'png');
    const g = Math.floor(img.width / 16);
    const ink = inkTest(img);
    legacyCells('bedrock').forEach((cp, i) => {
      if (cp) put(doc, cp, readCell(ink, (i % 16) * g, Math.floor(i / 16) * g, g, g, 8, 0, size));
    });
  }
  const pages = src
    .list('font/')
    .map((path) => ({ path, m: /^font\/glyph_([0-9a-f]{2})\.png$/i.exec(path) }))
    .filter((x): x is { path: string; m: RegExpExecArray } => !!x.m)
    .map((x) => ({ path: x.path, page: parseInt(x.m[1], 16) }))
    .filter((x) => x.page < 0xe0 || x.page > 0xf8) // private use pages are coloured icons
    .sort((a, b) => a.page - b.page);
  for (const { path, page } of pages) {
    let img: ImageData;
    try {
      img = await decodeImage(await src.read(path), 'png');
    } catch {
      continue;
    }
    const g = Math.floor(img.width / 16);
    if (!g) continue;
    const ink = inkTest(img);
    for (let i = 0; i < 256; i++) put(doc, (page << 8) | i, readCell(ink, (i % 16) * g, Math.floor(i / 16) * g, g, g, 8, 0, size));
  }
  return { doc, notes };
}

// ---------------------------------------------------------------------------------------------
// Pack files

function packName(files: Record<string, Uint8Array>, prefix: string, edition: 'java' | 'bedrock'): string | null {
  try {
    if (edition === 'bedrock') {
      const m = parseLenientJson<{ header?: { name?: string } }>(new TextDecoder().decode(files[`${prefix}manifest.json`]));
      return typeof m.header?.name === 'string' ? m.header.name.replace(/§./g, '').trim() || null : null;
    }
  } catch {
    /* no name */
  }
  return null;
}

function packFormat(files: Record<string, Uint8Array>, prefix: string): number | null {
  const b = files[`${prefix}pack.mcmeta`];
  if (!b) return null;
  try {
    const j = parseLenientJson<{ pack?: { pack_format?: number; min_format?: number | number[] } }>(new TextDecoder().decode(b));
    const f = j.pack?.pack_format ?? (Array.isArray(j.pack?.min_format) ? j.pack.min_format[0] : j.pack?.min_format);
    return typeof f === 'number' ? f : null;
  } catch {
    return null;
  }
}

/** Reads the font of a pack file (.zip or .mcpack). */
export async function importFontPack(file: Blob & { name?: string }, size: GlyphSize): Promise<FontImport> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isZip(bytes)) throw new FontImportError(t.import.notPack, 'not-pack');
  const files = await readZip(bytes, (p) => /\.(png|json|mcmeta|ttf|otf)$/i.test(p));
  const { prefix, edition } = packRoot(Object.keys(files));
  if (!edition) throw new FontImportError(t.import.notPack, 'not-pack');
  const src = mapSource(files, prefix);
  // pack_format 4 is 1.13
  const format = packFormat(files, prefix);
  const r = edition === 'java' ? await importJavaFont(src, size, { modern: format !== null && format >= 4 }) : await importBedrockFont(src, size);
  if (!r.doc.glyphs.size && !r.doc.ttf) throw new FontImportError(t.import.noFont, 'no-font');
  return { doc: r.doc, edition, name: packName(files, prefix, edition), notes: r.notes };
}
