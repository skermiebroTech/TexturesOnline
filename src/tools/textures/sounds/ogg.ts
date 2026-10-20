// Ogg container reader: walks the pages (checking each CRC), rebuilds the packets and reads the
// codec headers. Used to check that encoded sounds are valid Ogg Vorbis, and to spot imported files
// Java can't play (Ogg Opus).

export interface OggInfo {
  codec: 'vorbis' | 'opus' | 'flac' | 'unknown';
  channels: number;
  sampleRate: number;
  /** Granule position of the last page: samples per channel for Vorbis */
  samples: number;
  duration: number;
  pages: number;
  packets: number;
  /** Every page checksum is right */
  crcOk: boolean;
  /** First page marked beginning-of-stream, last one end-of-stream */
  bos: boolean;
  eos: boolean;
  /** Vorbis: identification, comment and setup headers present in order */
  vorbisHeaders: boolean;
  vendor?: string;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let r = i << 24;
    for (let j = 0; j < 8; j++) r = r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1;
    t[i] = r >>> 0;
  }
  return t;
})();

/** Ogg's CRC-32 (polynomial 0x04c11db7, not reflected), with the page's checksum field read as zero. */
export function oggCrc(page: Uint8Array): number {
  let crc = 0;
  for (let i = 0; i < page.length; i++) {
    const b = i >= 22 && i < 26 ? 0 : page[i];
    crc = ((crc << 8) ^ CRC_TABLE[((crc >>> 24) & 0xff) ^ b]) >>> 0;
  }
  return crc >>> 0;
}

export function isOgg(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53;
}

const ascii = (b: Uint8Array, from: number, len: number) => String.fromCharCode(...b.subarray(from, from + len));

/** Reads an Ogg file; null when it isn't one (or is cut short). Only the first logical stream is read. */
export function inspectOgg(bytes: Uint8Array): OggInfo | null {
  if (!isOgg(bytes)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const packets: Uint8Array[] = [];
  let partial: Uint8Array[] = [];
  let pos = 0;
  let pages = 0;
  let crcOk = true;
  let bos = false;
  let eos = false;
  let serial: number | null = null;
  let granule = 0;
  while (pos + 27 <= bytes.length) {
    if (!(bytes[pos] === 0x4f && bytes[pos + 1] === 0x67 && bytes[pos + 2] === 0x67 && bytes[pos + 3] === 0x53)) return null;
    if (bytes[pos + 4] !== 0) return null;
    const flags = bytes[pos + 5];
    const gran = Number(view.getBigInt64(pos + 6, true));
    const ser = view.getUint32(pos + 14, true);
    const crc = view.getUint32(pos + 22, true);
    const nseg = bytes[pos + 26];
    if (pos + 27 + nseg > bytes.length) return null;
    const lacing = bytes.subarray(pos + 27, pos + 27 + nseg);
    let bodyLen = 0;
    for (const l of lacing) bodyLen += l;
    const end = pos + 27 + nseg + bodyLen;
    if (end > bytes.length) return null;
    if (serial === null) serial = ser;
    if (ser === serial) {
      if (pages === 0) bos = (flags & 2) !== 0;
      eos = (flags & 4) !== 0;
      if (oggCrc(bytes.subarray(pos, end)) !== crc) crcOk = false;
      if (gran >= 0) granule = gran;
      let off = pos + 27 + nseg;
      for (const l of lacing) {
        partial.push(bytes.subarray(off, off + l));
        off += l;
        if (l < 255) {
          packets.push(concat(partial));
          partial = [];
        }
      }
      pages++;
    }
    pos = end;
  }
  if (!pages) return null;
  const info: OggInfo = { codec: 'unknown', channels: 0, sampleRate: 0, samples: granule, duration: 0, pages, packets: packets.length, crcOk, bos, eos, vorbisHeaders: false };
  const id = packets[0];
  if (id && id.length >= 30 && id[0] === 1 && ascii(id, 1, 6) === 'vorbis') {
    const dv = new DataView(id.buffer, id.byteOffset, id.byteLength);
    info.codec = 'vorbis';
    info.channels = id[11];
    info.sampleRate = dv.getUint32(12, true);
    const c = packets[1];
    const s = packets[2];
    info.vorbisHeaders = dv.getUint32(7, true) === 0 && (id[29] & 1) === 1 && !!c && c[0] === 3 && ascii(c, 1, 6) === 'vorbis' && !!s && s[0] === 5 && ascii(s, 1, 6) === 'vorbis';
    if (c && c.length >= 11) {
      const n = new DataView(c.buffer, c.byteOffset, c.byteLength).getUint32(7, true);
      if (11 + n <= c.length) info.vendor = new TextDecoder().decode(c.subarray(11, 11 + n));
    }
  } else if (id && id.length >= 19 && ascii(id, 0, 8) === 'OpusHead') {
    info.codec = 'opus';
    info.channels = id[9];
    info.sampleRate = 48000; // Opus granules always count 48 kHz samples
    info.samples = Math.max(0, granule - new DataView(id.buffer, id.byteOffset, id.byteLength).getUint16(10, true));
  } else if (id && id.length >= 5 && id[0] === 0x7f && ascii(id, 1, 4) === 'FLAC') {
    info.codec = 'flac';
  }
  if (info.sampleRate) info.duration = info.samples / info.sampleRate;
  return info;
}

function concat(parts: Uint8Array[]): Uint8Array {
  if (parts.length === 1) return parts[0];
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
