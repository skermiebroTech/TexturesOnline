// Font files as far as the font maker needs them: the format (TrueType, OpenType/CFF, WOFF,
// WOFF2), WOFF 1.0 unpacked back to a plain .ttf/.otf, the characters a font has (its cmap) and
// its name. Minecraft's "ttf" provider loads TrueType outlines only: 1.20.5+ (FreeType) rejects
// anything FT_Get_Font_Format does not call "TrueType", so OpenType/CFF fonts are rasterised
// instead of embedded. Pure (fflate for WOFF's zlib streams), unit tested.

import { unzlibSync } from 'fflate';

export type FontFormat = 'ttf' | 'otf' | 'woff' | 'woff2' | 'collection' | 'unknown';

const tag = (b: Uint8Array, o: number) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);

export function sniffFont(b: Uint8Array): FontFormat {
  if (b.length < 12) return 'unknown';
  const t = tag(b, 0);
  if (t === '\0\x01\0\0' || t === 'true') return 'ttf';
  if (t === 'OTTO') return 'otf';
  if (t === 'wOFF') return 'woff';
  if (t === 'wOF2') return 'woff2';
  if (t === 'ttcf') return 'collection';
  return 'unknown';
}

/** The sfnt flavour of a WOFF file ('ttf' for TrueType outlines, 'otf' for CFF). */
export function woffFlavor(b: Uint8Array): 'ttf' | 'otf' | 'unknown' {
  if (b.length < 8) return 'unknown';
  const f = tag(b, 4);
  return f === '\0\x01\0\0' || f === 'true' ? 'ttf' : f === 'OTTO' ? 'otf' : 'unknown';
}

/** Unpacks a WOFF 1.0 file into the sfnt (.ttf or .otf) it was made from. */
export function woffToSfnt(b: Uint8Array): Uint8Array {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (tag(b, 0) !== 'wOFF') throw new Error('Not a WOFF file');
  const numTables = dv.getUint16(12);
  const tables: { tag: string; data: Uint8Array; checksum: number }[] = [];
  for (let i = 0; i < numTables; i++) {
    const o = 44 + i * 20;
    const t = tag(b, o);
    const offset = dv.getUint32(o + 4);
    const compLength = dv.getUint32(o + 8);
    const origLength = dv.getUint32(o + 12);
    const checksum = dv.getUint32(o + 16);
    const raw = b.subarray(offset, offset + compLength);
    const data = compLength < origLength ? unzlibSync(raw) : raw;
    if (data.length !== origLength) throw new Error('Damaged WOFF table');
    tables.push({ tag: t, data, checksum });
  }
  tables.sort((x, y) => (x.tag < y.tag ? -1 : x.tag > y.tag ? 1 : 0));
  let size = 12 + numTables * 16;
  for (const t of tables) size += (t.data.length + 3) & ~3;
  const out = new Uint8Array(size);
  const ov = new DataView(out.buffer);
  ov.setUint32(0, dv.getUint32(4));
  ov.setUint16(4, numTables);
  let pow = 1;
  let log = 0;
  while (pow * 2 <= numTables) {
    pow *= 2;
    log++;
  }
  ov.setUint16(6, pow * 16);
  ov.setUint16(8, log);
  ov.setUint16(10, numTables * 16 - pow * 16);
  let offset = 12 + numTables * 16;
  tables.forEach((t, i) => {
    const o = 12 + i * 16;
    for (let k = 0; k < 4; k++) out[o + k] = t.tag.charCodeAt(k);
    ov.setUint32(o + 4, t.checksum);
    ov.setUint32(o + 8, offset);
    ov.setUint32(o + 12, t.data.length);
    out.set(t.data, offset);
    offset += (t.data.length + 3) & ~3;
  });
  return out;
}

/** A plain sfnt for a file: TTF/OTF as they are, WOFF unpacked; null for WOFF2 and collections. */
export function toSfnt(b: Uint8Array): Uint8Array | null {
  const f = sniffFont(b);
  if (f === 'ttf' || f === 'otf') return b;
  if (f === 'woff') return woffToSfnt(b);
  return null;
}

function tableOf(b: Uint8Array, name: string): Uint8Array | null {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const n = dv.getUint16(4);
  for (let i = 0; i < n; i++) {
    const o = 12 + i * 16;
    if (o + 16 > b.length) return null;
    if (tag(b, o) === name) {
      const off = dv.getUint32(o + 8);
      const len = dv.getUint32(o + 12);
      if (off + len > b.length) return null;
      return b.subarray(off, off + len);
    }
  }
  return null;
}

/** Code points in a font's cmap (formats 4 and 12 of the Unicode subtables). */
export function sfntChars(sfnt: Uint8Array): Set<number> {
  const out = new Set<number>();
  const cmap = tableOf(sfnt, 'cmap');
  if (!cmap) return out;
  const dv = new DataView(cmap.buffer, cmap.byteOffset, cmap.byteLength);
  const n = dv.getUint16(2);
  const subtables: { pid: number; eid: number; off: number }[] = [];
  for (let i = 0; i < n; i++) subtables.push({ pid: dv.getUint16(4 + i * 8), eid: dv.getUint16(6 + i * 8), off: dv.getUint32(8 + i * 8) });
  const unicode = subtables.filter((s) => s.pid === 0 || (s.pid === 3 && (s.eid === 1 || s.eid === 10)));
  for (const s of unicode) {
    if (s.off + 4 > cmap.length) continue;
    const format = dv.getUint16(s.off);
    if (format === 4) {
      const segX2 = dv.getUint16(s.off + 6);
      const ends = s.off + 14;
      const starts = ends + segX2 + 2;
      const deltas = starts + segX2;
      const ranges = deltas + segX2;
      for (let i = 0; i < segX2 / 2; i++) {
        const end = dv.getUint16(ends + i * 2);
        const start = dv.getUint16(starts + i * 2);
        const delta = dv.getInt16(deltas + i * 2);
        const ro = dv.getUint16(ranges + i * 2);
        for (let c = start; c <= end && c !== 0xffff; c++) {
          let gid: number;
          if (ro === 0) gid = (c + delta) & 0xffff;
          else {
            const at = ranges + i * 2 + ro + (c - start) * 2;
            gid = at + 2 <= cmap.length ? dv.getUint16(at) : 0;
            if (gid) gid = (gid + delta) & 0xffff;
          }
          if (gid) out.add(c);
        }
      }
    } else if (format === 12) {
      const groups = dv.getUint32(s.off + 12);
      for (let i = 0; i < groups; i++) {
        const o = s.off + 16 + i * 12;
        if (o + 12 > cmap.length) break;
        const start = dv.getUint32(o);
        const end = Math.min(dv.getUint32(o + 4), start + 0x20000);
        const gid = dv.getUint32(o + 8);
        for (let c = start; c <= end; c++) if (gid + (c - start)) out.add(c);
      }
    }
  }
  return out;
}

/** The font's full name (or family) from its name table. */
export function sfntName(sfnt: Uint8Array): string | null {
  const t = tableOf(sfnt, 'name');
  if (!t) return null;
  const dv = new DataView(t.buffer, t.byteOffset, t.byteLength);
  const count = dv.getUint16(2);
  const strings = dv.getUint16(4);
  const found = new Map<number, string>();
  for (let i = 0; i < count; i++) {
    const o = 6 + i * 12;
    if (o + 12 > t.length) break;
    const pid = dv.getUint16(o);
    const nameId = dv.getUint16(o + 6);
    const len = dv.getUint16(o + 8);
    const off = strings + dv.getUint16(o + 10);
    if ((nameId !== 4 && nameId !== 1) || found.has(nameId) || off + len > t.length) continue;
    const bytes = t.subarray(off, off + len);
    let s = '';
    if (pid === 3 || pid === 0) for (let k = 0; k + 1 < bytes.length; k += 2) s += String.fromCharCode((bytes[k] << 8) | bytes[k + 1]);
    else if (pid === 1) s = String.fromCharCode(...bytes);
    s = s.replace(/[\0-\x1f]/g, '').trim();
    if (s) found.set(nameId, s);
  }
  return found.get(4) ?? found.get(1) ?? null;
}

export interface FontFileInfo {
  format: FontFormat;
  /** Plain TrueType bytes Minecraft's ttf provider can load, or null */
  truetype: Uint8Array | null;
  /** Characters of the font, or null when they can't be read (WOFF2) */
  chars: Set<number> | null;
  name: string | null;
}

/** Reads what the font maker needs from a font file. Throws for files that are not fonts. */
export function readFontFile(b: Uint8Array): FontFileInfo {
  const format = sniffFont(b);
  if (format === 'unknown' || format === 'collection') return { format, truetype: null, chars: null, name: null };
  if (format === 'woff2') return { format, truetype: null, chars: null, name: null };
  const sfnt = toSfnt(b)!;
  const isTrueType = sniffFont(sfnt) === 'ttf' && !!tableOf(sfnt, 'glyf');
  return { format, truetype: isTrueType ? sfnt : null, chars: sfntChars(sfnt), name: sfntName(sfnt) };
}
