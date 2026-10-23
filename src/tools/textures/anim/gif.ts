// A small GIF decoder and encoder for animated textures: GIFs open as whole frames (each one drawn
// over the last the way browsers show them), and an animation is written as a looping GIF to share.
// Straight RGBA pixels, no DOM. GIF transparency is on or off: alpha under 128 becomes see-through.

export interface GifFrame {
  /** RGBA, width * height * 4 */
  data: Uint8ClampedArray;
  /** Hundredths of a second */
  delay: number;
}

export interface Gif {
  width: number;
  height: number;
  frames: GifFrame[];
}

export class GifError extends Error {
  constructor(readonly code: 'not-gif' | 'damaged' | 'too-big') {
    super(code);
  }
}

/** Limits that keep a hostile file from taking all the memory */
const MAX_SIDE = 4096;
const MAX_FRAMES = 1024;
const MAX_PIXELS_TOTAL = 256 * 1024 * 1024;

export function isGif(bytes: Uint8Array): boolean {
  return bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38 && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61;
}

// ---------------------------------------------------------------------------------------------
// Decoding

export function decodeGif(bytes: Uint8Array, maxFrames = MAX_FRAMES): Gif {
  if (!isGif(bytes)) throw new GifError('not-gif');
  let p = 6;
  const need = (n: number) => {
    if (p + n > bytes.length) throw new GifError('damaged');
  };
  const u16 = () => {
    need(2);
    const v = bytes[p] | (bytes[p + 1] << 8);
    p += 2;
    return v;
  };
  const byte = () => {
    need(1);
    return bytes[p++];
  };
  const width = u16();
  const height = u16();
  if (!width || !height) throw new GifError('damaged');
  if (width > MAX_SIDE || height > MAX_SIDE) throw new GifError('too-big');
  const packed = byte();
  byte(); // background colour (browsers clear to transparent)
  byte(); // pixel aspect
  let global: Uint8Array | null = null;
  if (packed & 0x80) {
    const n = 3 << ((packed & 7) + 1);
    need(n);
    global = bytes.subarray(p, p + n);
    p += n;
  }
  const canvas = new Uint8ClampedArray(width * height * 4);
  const frames: GifFrame[] = [];
  let gce = { disposal: 0, delay: 0, transparent: -1 };
  let pending: { disposal: number; rect: [number, number, number, number]; saved: Uint8ClampedArray | null } | null = null;

  const subBlocks = (): Uint8Array => {
    const parts: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const n = byte();
      if (!n) break;
      need(n);
      parts.push(bytes.subarray(p, p + n));
      total += n;
      p += n;
    }
    const out = new Uint8Array(total);
    let o = 0;
    for (const part of parts) {
      out.set(part, o);
      o += part.length;
    }
    return out;
  };
  const skipBlocks = () => {
    for (;;) {
      const n = byte();
      if (!n) return;
      need(n);
      p += n;
    }
  };

  while (p < bytes.length && frames.length < maxFrames) {
    const intro = byte();
    if (intro === 0x3b) break;
    if (intro === 0x21) {
      const label = byte();
      if (label === 0xf9) {
        const data = subBlocks();
        if (data.length >= 4) gce = { disposal: (data[0] >> 2) & 7, delay: data[1] | (data[2] << 8), transparent: data[0] & 1 ? data[3] : -1 };
      } else skipBlocks();
      continue;
    }
    if (intro !== 0x2c) {
      // some encoders pad the end: whatever was decoded is kept
      if (frames.length) break;
      throw new GifError('damaged');
    }
    const left = u16();
    const top = u16();
    const w = u16();
    const hh = u16();
    const ip = byte();
    let table = global;
    if (ip & 0x80) {
      const n = 3 << ((ip & 7) + 1);
      need(n);
      table = bytes.subarray(p, p + n);
      p += n;
    }
    const minCode = byte();
    const data = subBlocks();
    if (!table || minCode < 1 || minCode > 11) throw new GifError('damaged');
    if (frames.length && (frames.length + 1) * width * height > MAX_PIXELS_TOTAL) break;

    // the previous frame's disposal, before this one is drawn
    if (pending) {
      const [rx, ry, rw, rh] = pending.rect;
      if (pending.disposal === 2) {
        for (let y = ry; y < ry + rh; y++) canvas.fill(0, (y * width + rx) * 4, (y * width + rx + rw) * 4);
      } else if (pending.disposal === 3 && pending.saved) canvas.set(pending.saved);
    }
    const rect: [number, number, number, number] = [Math.min(left, width), Math.min(top, height), Math.max(0, Math.min(w, width - left)), Math.max(0, Math.min(hh, height - top))];
    const saved = gce.disposal === 3 ? canvas.slice() : null;

    const indices = lzwDecode(data, minCode, w * hh);
    const rows = ip & 0x40 ? interlacedRows(hh) : null;
    for (let r = 0; r < hh; r++) {
      const y = top + (rows ? rows[r] : r);
      if (y >= height) continue;
      for (let x = 0; x < w; x++) {
        const cx = left + x;
        if (cx >= width) break;
        const ci = indices[r * w + x];
        if (ci === gce.transparent || ci * 3 + 2 >= table.length) continue;
        const o = (y * width + cx) * 4;
        canvas[o] = table[ci * 3];
        canvas[o + 1] = table[ci * 3 + 1];
        canvas[o + 2] = table[ci * 3 + 2];
        canvas[o + 3] = 255;
      }
    }
    frames.push({ data: canvas.slice(), delay: gce.delay });
    pending = { disposal: gce.disposal, rect, saved };
    gce = { disposal: 0, delay: 0, transparent: -1 };
  }
  if (!frames.length) throw new GifError('damaged');
  return { width, height, frames };
}

/** Row order of an interlaced image: stored row r is image row rows[r]. */
function interlacedRows(h: number): number[] {
  const rows: number[] = [];
  for (const [start, step] of [[0, 8], [4, 8], [2, 4], [1, 2]]) for (let y = start; y < h; y += step) rows.push(y);
  return rows;
}

function lzwDecode(data: Uint8Array, minCode: number, size: number): Uint8Array {
  const out = new Uint8Array(size);
  const clear = 1 << minCode;
  const end = clear + 1;
  const prefix = new Int16Array(4096);
  const suffix = new Uint8Array(4096);
  const first = new Uint8Array(4096);
  const stack = new Uint8Array(4097);
  for (let i = 0; i < clear; i++) {
    prefix[i] = -1;
    suffix[i] = i;
    first[i] = i;
  }
  let codeSize = minCode + 1;
  let next = end + 1;
  let old = -1;
  let bits = 0;
  let acc = 0;
  let o = 0;
  let i = 0;
  while (o < size) {
    while (bits < codeSize) {
      if (i >= data.length) return out;
      acc |= data[i++] << bits;
      bits += 8;
    }
    const code = acc & ((1 << codeSize) - 1);
    acc >>>= codeSize;
    bits -= codeSize;
    if (code === clear) {
      codeSize = minCode + 1;
      next = end + 1;
      old = -1;
      continue;
    }
    if (code === end) break;
    let c = code;
    let sp = 0;
    if (old === -1) {
      if (code >= clear) break;
      out[o++] = code;
      old = code;
      continue;
    }
    if (code > next || code === end) break;
    if (code === next) {
      stack[sp++] = first[old];
      c = old;
    }
    while (c >= clear && sp < 4096) {
      stack[sp++] = suffix[c];
      c = prefix[c];
    }
    stack[sp++] = c;
    if (next < 4096) {
      prefix[next] = old;
      suffix[next] = c;
      first[next] = first[old];
      next++;
      if (next === 1 << codeSize && codeSize < 12) codeSize++;
    }
    while (sp > 0 && o < size) out[o++] = stack[--sp];
    old = code;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Encoding

/** Writes frames (all width x height, RGBA) as a GIF that loops forever. */
export function encodeGif(width: number, height: number, frames: readonly GifFrame[]): Uint8Array {
  const { palette, transparent, indexOf } = buildPalette(frames);
  const bitsNeeded = Math.max(1, Math.ceil(Math.log2(Math.max(2, palette.length / 3))));
  const tableSize = 1 << bitsNeeded;
  const out = new ByteWriter();
  out.bytes([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
  out.u16(width);
  out.u16(height);
  out.byte(0x80 | 0x70 | (bitsNeeded - 1));
  out.byte(0);
  out.byte(0);
  const table = new Uint8Array(tableSize * 3);
  table.set(palette.subarray(0, Math.min(palette.length, table.length)));
  out.bytes(table);
  // NETSCAPE2.0: loop forever
  out.bytes([0x21, 0xff, 0x0b, ...Array.from('NETSCAPE2.0', (c) => c.charCodeAt(0)), 0x03, 0x01, 0x00, 0x00, 0x00]);
  const minCode = Math.max(2, bitsNeeded);
  const idx = new Uint8Array(width * height);
  for (const f of frames) {
    const d = f.data;
    for (let i = 0, k = 0; k < idx.length; i += 4, k++) idx[k] = d[i + 3] < 128 ? transparent : indexOf(d[i], d[i + 1], d[i + 2]);
    // disposal 2 (clear) when there are see-through pixels, so earlier frames don't show through
    const hasT = transparent >= 0;
    out.bytes([0x21, 0xf9, 0x04, ((hasT ? 2 : 1) << 2) | (hasT ? 1 : 0)]);
    out.u16(Math.max(0, Math.min(65535, Math.round(f.delay))));
    out.byte(hasT ? transparent : 0);
    out.byte(0);
    out.byte(0x2c);
    out.u16(0);
    out.u16(0);
    out.u16(width);
    out.u16(height);
    out.byte(0);
    out.byte(minCode);
    const data = lzwEncode(idx, minCode);
    for (let i = 0; i < data.length; i += 255) {
      const n = Math.min(255, data.length - i);
      out.byte(n);
      out.bytes(data.subarray(i, i + n));
    }
    out.byte(0);
  }
  out.byte(0x3b);
  return out.done();
}

class ByteWriter {
  private buf = new Uint8Array(4096);
  private n = 0;
  private grow(k: number) {
    if (this.n + k <= this.buf.length) return;
    let size = this.buf.length * 2;
    while (size < this.n + k) size *= 2;
    const b = new Uint8Array(size);
    b.set(this.buf.subarray(0, this.n));
    this.buf = b;
  }
  byte(v: number) {
    this.grow(1);
    this.buf[this.n++] = v & 255;
  }
  u16(v: number) {
    this.byte(v);
    this.byte(v >> 8);
  }
  bytes(a: ArrayLike<number>) {
    this.grow(a.length);
    this.buf.set(a, this.n);
    this.n += a.length;
  }
  done(): Uint8Array {
    return this.buf.slice(0, this.n);
  }
}

function lzwEncode(indices: Uint8Array, minCode: number): Uint8Array {
  const out = new ByteWriter();
  const clear = 1 << minCode;
  const end = clear + 1;
  let codeSize = minCode + 1;
  let next = end + 1;
  let dict = new Map<number, number>();
  let acc = 0;
  let bits = 0;
  const emit = (code: number) => {
    acc |= code << bits;
    bits += codeSize;
    while (bits >= 8) {
      out.byte(acc & 255);
      acc >>>= 8;
      bits -= 8;
    }
  };
  emit(clear);
  let prefix = indices.length ? indices[0] : 0;
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = prefix * 256 + k;
    const hit = dict.get(key);
    if (hit !== undefined) {
      prefix = hit;
      continue;
    }
    emit(prefix);
    if (next < 4096) {
      dict.set(key, next++);
      if (next > 1 << codeSize && codeSize < 12) codeSize++;
    } else {
      emit(clear);
      dict = new Map();
      codeSize = minCode + 1;
      next = end + 1;
    }
    prefix = k;
  }
  if (indices.length) emit(prefix);
  emit(end);
  if (bits > 0) out.byte(acc & 255);
  return out.done();
}

/**
 * The colours of every frame (RGB bytes), the index of the see-through colour (-1: none) and a
 * colour -> index lookup. More than fits in a GIF: median cut, nearest colour.
 */
function buildPalette(frames: readonly GifFrame[]): { palette: Uint8Array; transparent: number; indexOf: (r: number, g: number, b: number) => number } {
  const counts = new Map<number, number>();
  let hasT = false;
  for (const f of frames) {
    const d = f.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) {
        hasT = true;
        continue;
      }
      const c = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  const room = hasT ? 255 : 256;
  let colours: number[];
  if (counts.size <= room) colours = [...counts.keys()];
  else colours = medianCut(counts, room);
  if (!colours.length) colours = [0];
  const n = colours.length + (hasT ? 1 : 0);
  const palette = new Uint8Array(Math.max(2, n) * 3);
  colours.forEach((c, i) => {
    palette[i * 3] = (c >> 16) & 255;
    palette[i * 3 + 1] = (c >> 8) & 255;
    palette[i * 3 + 2] = c & 255;
  });
  const transparent = hasT ? colours.length : -1;
  const exact = new Map(colours.map((c, i) => [c, i]));
  const cache = new Map<number, number>();
  const indexOf = (r: number, g: number, b: number): number => {
    const c = (r << 16) | (g << 8) | b;
    const e = exact.get(c) ?? cache.get(c);
    if (e !== undefined) return e;
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < colours.length; i++) {
      const dr = ((colours[i] >> 16) & 255) - r;
      const dg = ((colours[i] >> 8) & 255) - g;
      const db = (colours[i] & 255) - b;
      const d = dr * dr * 2 + dg * dg * 4 + db * db * 3;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    cache.set(c, best);
    return best;
  };
  return { palette, transparent, indexOf };
}

function medianCut(counts: Map<number, number>, max: number): number[] {
  type Box = { cols: [number, number][] };
  const boxes: Box[] = [{ cols: [...counts.entries()] }];
  const range = (b: Box, sh: number) => {
    let lo = 255;
    let hi = 0;
    for (const [c] of b.cols) {
      const v = (c >> sh) & 255;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    return hi - lo;
  };
  while (boxes.length < max) {
    let pick = -1;
    let best = 0;
    let shift = 16;
    boxes.forEach((b, i) => {
      if (b.cols.length < 2) return;
      for (const sh of [16, 8, 0]) {
        const r = range(b, sh);
        if (r > best) {
          best = r;
          pick = i;
          shift = sh;
        }
      }
    });
    if (pick < 0) break;
    const b = boxes[pick];
    b.cols.sort((x, y) => ((x[0] >> shift) & 255) - ((y[0] >> shift) & 255));
    const total = b.cols.reduce((n, [, k]) => n + k, 0);
    let acc = 0;
    let cut = 1;
    for (let i = 0; i < b.cols.length - 1; i++) {
      acc += b.cols[i][1];
      if (acc >= total / 2) {
        cut = i + 1;
        break;
      }
      cut = i + 1;
    }
    boxes.splice(pick, 1, { cols: b.cols.slice(0, cut) }, { cols: b.cols.slice(cut) });
  }
  return boxes.map((b) => {
    let r = 0;
    let g = 0;
    let bl = 0;
    let n = 0;
    for (const [c, k] of b.cols) {
      r += ((c >> 16) & 255) * k;
      g += ((c >> 8) & 255) * k;
      bl += (c & 255) * k;
      n += k;
    }
    return (Math.round(r / n) << 16) | (Math.round(g / n) << 8) | Math.round(bl / n);
  });
}
