// The font as files: Java (font/default.json with bitmap sheets and an optional ttf provider for
// 1.13+, textures/font/ascii.png before), Bedrock (font/default8.png and glyph_XX.png pages), the
// downloadable .zip / .mcpack and a texture pack project holding the font. Loaded when a pack is
// made (zip writer, PNG encoder).

import type { Edition, FileMap, TexturePackProject } from '../../core/types';
import { encodePng } from '../../core/image';
import { createImageData } from '../../core/pixels';
import { sanitizeFilename } from '../../core/download';
import { writeZip } from '../../core/zip';
import { buildPackMcmetaForVersions } from '../../editions/java/packmeta';
import { buildResourceManifest, bumpPackVersion } from '../../editions/bedrock/manifest';
import { newBedrockUuids, newTextureProject } from '../textures/project';
import {
  CELL_ASCENT,
  CELL_HEIGHT,
  bedrockPages,
  cellH,
  cellW,
  fitBox,
  glyphAdvance,
  javaFontSupport,
  legacyCells,
  targetCovers,
  type FontDoc,
  type FontTarget,
  type GlyphSize,
  type Mask,
} from './font';
import { starterFont } from './starter';
import { t } from './i18n/text';
import { fmt } from '../../i18n/editor-text';

export const JAVA_FONT_JSON = 'assets/minecraft/font/default.json';
export const JAVA_ASCII_PNG = 'assets/minecraft/textures/font/ascii.png';
export const BEDROCK_DEFAULT8 = 'font/default8.png';
export const bedrockPagePath = (page: number, lang?: string): string => `${lang ? `texts/${lang}/` : ''}font/glyph_${page.toString(16).toUpperCase().padStart(2, '0')}.png`;

/** Pages Bedrock's vanilla pack also has per language (bedrock-samples texts/<lang>/font/): ours must replace those too. */
const BEDROCK_LANG_PAGES: Record<string, (page: number) => boolean> = {
  ja_JP: (p) => (p >= 0x2e && p <= 0x9f) || [0xf9, 0xfa, 0xfb, 0xfd, 0xfe, 0xff].includes(p),
  zh_TW: (p) => (p >= 0x2e && p <= 0x9f) || [0xf9, 0xfa, 0xfe, 0xff].includes(p),
};

/** Safe file-name part of a pack name ("My Font!" -> "my_font"). */
export function fontSlug(name: string): string {
  const s = (name || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32)
    .replace(/_+$/, '');
  return s || 'custom_font';
}

/** JSON with every character outside ASCII written as \uXXXX (Minecraft reads either; this survives any editor). */
export function asciiJson(value: unknown): string {
  return JSON.stringify(value, null, 2).replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`) + '\n';
}

function png(img: ImageData): Uint8Array<ArrayBuffer> {
  return encodePng(img);
}

/** Draws a mask (w × h) into an RGBA image at (x0, y0), each pixel as a `scale` block of white. */
function blit(img: ImageData, mask: Uint8Array, w: number, h: number, x0: number, y0: number, scale = 1): void {
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      for (let sy = 0; sy < scale; sy++)
        for (let sx = 0; sx < scale; sx++) {
          const o = ((y0 + y * scale + sy) * img.width + x0 + x * scale + sx) * 4;
          img.data[o] = img.data[o + 1] = img.data[o + 2] = img.data[o + 3] = 255;
        }
    }
}

export interface FontFiles {
  files: Record<string, Uint8Array | string>;
  /** Things the player should know about this target (translated) */
  notes: string[];
  /** Characters of the font that this target can't use */
  dropped: number[];
}

// ---------------------------------------------------------------------------------------------
// Java

export interface BitmapSheet {
  path: string;
  /** Resource location for the provider's "file" */
  file: string;
  chars: string[];
  image: ImageData;
}

/** Glyphs laid out in 16-column sheets of at most 256 characters, in code point order. */
export function javaSheets(glyphs: Map<number, Mask>, size: GlyphSize, slug: string): BitmapSheet[] {
  const cps = [...glyphs.keys()].sort((a, b) => a - b);
  const sheets: BitmapSheet[] = [];
  const w = cellW(size);
  const h = cellH(size);
  for (let s = 0; s * 256 < cps.length; s++) {
    const part = cps.slice(s * 256, s * 256 + 256);
    const rows = Math.ceil(part.length / 16);
    const image = createImageData(16 * w, rows * h);
    const chars: string[] = [];
    for (let r = 0; r < rows; r++) {
      let line = '';
      for (let c = 0; c < 16; c++) {
        const cp = part[r * 16 + c];
        line += cp === undefined ? '\0' : String.fromCodePoint(cp);
        if (cp !== undefined) blit(image, glyphs.get(cp)!, w, h, c * w, r * h);
      }
      chars.push(line);
    }
    const name = `${slug}/glyphs_${s}.png`;
    sheets.push({ path: `assets/minecraft/textures/font/${name}`, file: `minecraft:font/${name}`, chars, image });
  }
  return sheets;
}

/** The provider list of font/default.json for Java 1.13+. */
export function javaProviders(doc: FontDoc, version: string, sheets: BitmapSheet[], ttfFile: string | null): Record<string, unknown>[] {
  const support = javaFontSupport(version);
  // Like the game's own glyphs, ours step aside when Force Unicode Font is on (1.20.5+ filters).
  const filter = support.filters ? { filter: { uniform: false } } : {};
  const providers: Record<string, unknown>[] = [];
  if (support.space && doc.space !== 4) providers.push({ type: 'space', advances: { ' ': doc.space, '‌': 0 } });
  for (const s of sheets) providers.push({ type: 'bitmap', file: s.file, height: CELL_HEIGHT, ascent: CELL_ASCENT, chars: s.chars, ...filter });
  if (ttfFile && doc.ttf) {
    const shift = doc.ttf.shift.map((v) => Math.round(v * 100) / 100);
    providers.push({ type: 'ttf', file: ttfFile, size: doc.ttf.size, oversample: doc.ttf.oversample, shift, ...filter });
  }
  return providers;
}

/** Font files of a Java pack for a version. */
export function javaFontFiles(doc: FontDoc, version: string, opts: { slug: string; fill?: FontDoc | null }): FontFiles {
  const support = javaFontSupport(version);
  const files: Record<string, Uint8Array | string> = {};
  const notes: string[] = [];
  const dropped: number[] = [];
  const target: FontTarget = { edition: 'java', version };
  if (support.json) {
    const glyphs = new Map<number, Mask>();
    for (const [cp, m] of doc.glyphs) {
      // Characters outside the Basic Multilingual Plane are read from "chars" since 1.16.
      if (cp > 0xffff && !support.astral) dropped.push(cp);
      else glyphs.set(cp, m);
    }
    const sheets = javaSheets(glyphs, doc.size, opts.slug);
    for (const s of sheets) files[s.path] = png(s.image);
    let ttfFile: string | null = null;
    if (doc.ttf && support.ttf) {
      files[`assets/minecraft/font/${opts.slug}.ttf`] = doc.ttf.bytes;
      ttfFile = `minecraft:${opts.slug}.ttf`;
    }
    const providers = javaProviders(doc, version, sheets, ttfFile);
    if (providers.length) files[JAVA_FONT_JSON] = asciiJson({ providers });
    if (!support.space && doc.space !== 4) notes.push(fmt(t.pack.noSpace, { version }));
    return { files, notes, dropped };
  }
  // Before 1.13: one ascii.png in the game's fixed order; every cell needs a glyph.
  const cells = legacyCells('java');
  const size = doc.size;
  const w = cellW(size);
  const image = createImageData(16 * w, 16 * w);
  let filled = 0;
  cells.forEach((cp, i) => {
    if (!cp) return;
    let m = doc.glyphs.get(cp);
    if (!m && opts.fill) {
      m = opts.fill.glyphs.get(cp);
      if (m) filled++;
    }
    if (m) blit(image, fitBox(m, size), w, w, (i % 16) * w, Math.floor(i / 16) * w);
  });
  files[JAVA_ASCII_PNG] = png(image);
  for (const cp of doc.glyphs.keys()) if (!targetCovers(target, cp)) dropped.push(cp);
  notes.push(fmt(t.pack.legacyBox, { version }));
  if (filled) notes.push(fmt(t.pack.filled, { count: filled }));
  if (doc.ttf) notes.push(fmt(t.pack.noTtf, { version }));
  if (doc.space !== 4) notes.push(fmt(t.pack.noSpace, { version }));
  return { files, notes, dropped };
}

// ---------------------------------------------------------------------------------------------
// Bedrock

/** Font files of a Bedrock pack: default8.png and the glyph pages the font needs. */
export function bedrockFontFiles(doc: FontDoc, opts: { fill?: FontDoc | null }): FontFiles {
  const files: Record<string, Uint8Array | string> = {};
  const notes: string[] = [];
  const dropped: number[] = [];
  const size = doc.size;
  const w = cellW(size);
  const glyphOf = (cp: number): { m: Mask; own: boolean } | null => {
    const own = doc.glyphs.get(cp);
    if (own) return { m: own, own: true };
    const f = opts.fill?.glyphs.get(cp);
    return f ? { m: f, own: false } : null;
  };
  // default8.png: the Java 1.12.2 grid (rows 0-1 are control codes on Bedrock)
  const cells = legacyCells('bedrock');
  const image = createImageData(16 * w, 16 * w);
  let filled = 0;
  cells.forEach((cp, i) => {
    if (!cp) return;
    const g = glyphOf(cp);
    if (!g) return;
    if (!g.own) filled++;
    blit(image, fitBox(g.m, size), w, w, (i % 16) * w, Math.floor(i / 16) * w);
  });
  files[BEDROCK_DEFAULT8] = png(image);
  // Pages for every other character: 16 × 16 cells of 16 pixels (8 on screen), 32 for 32-pixel glyphs.
  for (const cp of doc.glyphs.keys()) if (cp > 0xffff) dropped.push(cp);
  const pages = bedrockPages(doc.glyphs.keys());
  const cell = Math.max(16, size);
  const scale = cell / size;
  for (const page of pages) {
    const img = createImageData(16 * cell, 16 * cell);
    for (let i = 0; i < 256; i++) {
      const g = glyphOf((page << 8) | i);
      if (!g) continue;
      if (!g.own) filled++;
      blit(img, fitBox(g.m, size), w, w, (i % 16) * cell, Math.floor(i / 16) * cell, scale);
    }
    const bytes = png(img);
    files[bedrockPagePath(page)] = bytes;
    for (const [lang, has] of Object.entries(BEDROCK_LANG_PAGES)) if (has(page)) files[bedrockPagePath(page, lang)] = bytes;
  }
  notes.push(t.pack.bedrockBox);
  if (pages.length) notes.push(fmt(t.pack.bedrockPages, { pages: pages.map((p) => p.toString(16).toUpperCase().padStart(2, '0')).join(', ') }));
  if (filled) notes.push(fmt(t.pack.filled, { count: filled }));
  if (doc.ttf) notes.push(t.pack.noTtfBedrock);
  return { files, notes, dropped };
}

// ---------------------------------------------------------------------------------------------
// Pack icon: "Aa" in the font, white with the game's shadow, on a dark tile

export function fontIcon(doc: FontDoc, px: number): ImageData {
  const img = createImageData(px, px);
  for (let i = 0; i < px * px; i++) img.data.set([30, 30, 36, 255], i * 4);
  const sample = [...'Aa'].map((c) => c.codePointAt(0)!).filter((cp) => doc.glyphs.has(cp));
  const glyphs = sample.length ? sample : [...doc.glyphs.keys()].slice(0, 2);
  if (!glyphs.length) return img;
  const size = doc.size;
  const w = cellW(size);
  const h = cellH(size);
  const k = size / 8;
  const width = glyphs.reduce((s, cp) => s + glyphAdvance(doc.glyphs.get(cp)!, size), 0) + 1;
  const scale = Math.max(1, Math.floor((px * 0.8) / Math.max(width * k, CELL_HEIGHT * k)));
  const unitPx = scale;
  const totalW = width * k * unitPx;
  let x = Math.floor((px - totalW) / 2);
  const y0 = Math.floor((px - h * unitPx) / 2);
  const draw = (m: Mask, gx: number, color: [number, number, number], off: number) => {
    for (let y = 0; y < h; y++)
      for (let xx = 0; xx < w; xx++) {
        if (!m[y * w + xx]) continue;
        for (let sy = 0; sy < unitPx; sy++)
          for (let sx = 0; sx < unitPx; sx++) {
            const X = gx + xx * unitPx + sx + off;
            const Y = y0 + y * unitPx + sy + off;
            if (X >= 0 && Y >= 0 && X < px && Y < px) img.data.set([...color, 255], (Y * px + X) * 4);
          }
      }
  };
  const shadow = k * unitPx;
  for (const cp of glyphs) {
    const m = doc.glyphs.get(cp)!;
    draw(m, x, [63, 63, 63], shadow);
    draw(m, x, [255, 255, 255], 0);
    x += glyphAdvance(m, size) * k * unitPx;
  }
  return img;
}

// ---------------------------------------------------------------------------------------------
// Packs

export interface FontPackOptions {
  name: string;
  description: string;
  edition: Edition;
  version: string;
  uuids?: { header: string; module: string };
  packVersion?: [number, number, number];
}

export interface FontPack {
  blob: Blob;
  filename: string;
  files: string[];
  notes: string[];
  dropped: number[];
  uuids?: { header: string; module: string };
  packVersion?: [number, number, number];
}

/** Just the font's files for a target (what a texture pack project gets). */
export function fontFilesFor(doc: FontDoc, target: FontTarget, slug: string): FontFiles {
  const fill = starterFont('classic', doc.size);
  return target.edition === 'java' ? javaFontFiles(doc, target.version, { slug, fill }) : bedrockFontFiles(doc, { fill });
}

export async function buildFontPack(doc: FontDoc, opts: FontPackOptions): Promise<FontPack> {
  const name = opts.name.trim() || t.pack.defaultName;
  const description = opts.description.trim();
  const font = fontFilesFor(doc, { edition: opts.edition, version: opts.version }, fontSlug(name));
  const files: FileMap = {};
  let uuids: FontPack['uuids'];
  let packVersion: FontPack['packVersion'];
  if (opts.edition === 'java') {
    files['pack.mcmeta'] = asciiJson(JSON.parse(await buildPackMcmetaForVersions(description, opts.version)));
    files['pack.png'] = png(fontIcon(doc, 128));
  } else {
    uuids = opts.uuids ?? newBedrockUuids();
    packVersion = bumpPackVersion(opts.packVersion);
    files['manifest.json'] = buildResourceManifest({ name, description, uuids, version: packVersion });
    files['pack_icon.png'] = png(fontIcon(doc, 256));
  }
  Object.assign(files, font.files);
  const blob = await writeZip(files, { mimeType: opts.edition === 'bedrock' ? 'application/octet-stream' : 'application/zip' });
  const base = sanitizeFilename(name, t.pack.defaultName).replace(/\.(zip|mcpack)$/i, '');
  return { blob, filename: `${base}.${opts.edition === 'java' ? 'zip' : 'mcpack'}`, files: Object.keys(files), notes: font.notes, dropped: font.dropped, uuids, packVersion };
}

/**
 * Puts the font into a texture pack project (an existing one or a new one): the font's files go
 * into the project's extra files, replacing any font the project had.
 */
export function addFontToProject(project: TexturePackProject, doc: FontDoc, slug: string): { project: TexturePackProject; replaced: boolean } {
  const target: FontTarget = { edition: project.edition, version: project.version };
  const font = fontFilesFor(doc, target, slug);
  const extra = { ...(project.extraFiles ?? {}) };
  const overrides = { ...project.overrides };
  const isFontFile = (p: string) => project.edition === 'java' ? /^assets\/[^/]+\/(font\/|textures\/font\/)/.test(p) : /^(texts\/[^/]+\/)?font\//.test(p);
  let replaced = false;
  for (const p of Object.keys(extra))
    if (isFontFile(p)) {
      delete extra[p];
      replaced = true;
    }
  for (const p of Object.keys(overrides))
    if (isFontFile(p)) {
      delete overrides[p];
      replaced = true;
    }
  for (const [p, v] of Object.entries(font.files)) extra[p] = new Blob([typeof v === 'string' ? v : (v as Uint8Array<ArrayBuffer>)], { type: p.endsWith('.png') ? 'image/png' : p.endsWith('.json') ? 'application/json' : 'application/octet-stream' });
  return { project: { ...project, extraFiles: extra, overrides, updatedAt: Date.now() }, replaced };
}

export function newFontProject(doc: FontDoc, opts: { name: string; description: string; edition: Edition; version: string }): TexturePackProject {
  const project = newTextureProject({ name: opts.name.trim() || t.pack.defaultName, edition: opts.edition, version: opts.version, description: opts.description });
  project.icon = new Blob([png(fontIcon(doc, opts.edition === 'java' ? 128 : 256))], { type: 'image/png' });
  return addFontToProject(project, doc, fontSlug(project.name)).project;
}
