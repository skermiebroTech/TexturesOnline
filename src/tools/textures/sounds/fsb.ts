// FMOD sound banks (FSB5), the format of Bedrock's vanilla sounds in Mojang's bedrock-samples.
// Browsers can't play them, so the samples are decoded here. Bedrock's banks hold one sound each,
// coded as FADPCM (FMOD's ADPCM: frames of 0x8C bytes, 256 samples each); 16-bit PCM is read too.
// Header layout and the FADPCM algorithm follow the descriptions in vgmstream (ISC licence).

import { fmt } from '../../../i18n/editor-text';
import { ts } from '../ui/i18n/sounds';

export interface DecodedAudio {
  sampleRate: number;
  /** One Float32Array per channel, -1..1 */
  channels: Float32Array[];
}

const RATES = [4000, 8000, 11000, 11025, 16000, 22050, 24000, 32000, 44100, 48000, 96000];
const CHANNELS = [1, 2, 6, 8];
const MODE_PCM16 = 2;
const MODE_FADPCM = 16;
const FRAME = 0x8c;
const FRAME_SAMPLES = (FRAME - 0x0c) * 2;
const COEFS: [number, number][] = [
  [0, 0],
  [60, 0],
  [122, 60],
  [115, 52],
  [98, 55],
  [0, 0],
  [0, 0],
  [0, 0],
];

export function isFsb5(bytes: Uint8Array): boolean {
  return bytes.length >= 0x3c && bytes[0] === 0x46 && bytes[1] === 0x53 && bytes[2] === 0x42 && bytes[3] === 0x35;
}

/** Decodes the first sound of an FSB5 bank. Throws for codecs other than FADPCM / PCM16. */
export function decodeFsb5(bytes: Uint8Array): DecodedAudio {
  if (!isFsb5(bytes)) throw new Error(ts.errors.notFsb);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = dv.getUint32(4, true);
  const count = dv.getUint32(8, true);
  const headersSize = dv.getUint32(12, true);
  const namesSize = dv.getUint32(16, true);
  const dataSize = dv.getUint32(20, true);
  const mode = dv.getUint32(24, true);
  if (!count) throw new Error(ts.errors.emptyBank);
  const base = version === 0 ? 0x40 : 0x3c;
  const dataStart = base + headersSize + namesSize;

  // Sample header: a 64-bit bitfield, then optional chunks.
  let off = base;
  const lo = dv.getUint32(off, true);
  const hi = dv.getUint32(off + 4, true);
  let hasExtra = (lo & 1) === 1;
  let sampleRate = RATES[(lo >>> 1) & 0xf] ?? 44100;
  let channels = CHANNELS[(lo >>> 5) & 0x3];
  const dataOffset = ((lo >>> 7) + (hi & 0x3) * 0x2000000) * 32;
  const samples = hi >>> 2;
  off += 8;
  while (hasExtra && off + 4 <= base + headersSize) {
    const flag = dv.getUint32(off, true);
    hasExtra = (flag & 1) === 1;
    const size = (flag >>> 1) & 0xffffff;
    const type = (flag >>> 25) & 0x7f;
    if (type === 1 && size >= 1) channels = bytes[off + 4];
    else if (type === 2 && size >= 4) sampleRate = dv.getUint32(off + 4, true);
    off += 4 + size;
  }
  // The sound's data runs to the next sound's offset (or the end of the data block).
  let dataEnd = dataSize;
  if (count > 1) {
    const lo2 = dv.getUint32(off, true);
    const hi2 = dv.getUint32(off + 4, true);
    dataEnd = ((lo2 >>> 7) + (hi2 & 0x3) * 0x2000000) * 32;
  }
  const start = dataStart + dataOffset;
  const end = Math.min(bytes.length, dataStart + Math.max(dataOffset, dataEnd));
  if (!channels || !sampleRate || start >= end) throw new Error(ts.errors.damagedBank);
  const data = bytes.subarray(start, end);
  if (mode === MODE_FADPCM) return { sampleRate, channels: decodeFadpcm(data, channels, samples) };
  if (mode === MODE_PCM16) return { sampleRate, channels: decodePcm16(data, channels, samples) };
  throw new Error(fmt(ts.errors.codec, { mode: String(mode) }));
}

/** FADPCM: per channel, frames of a 12-byte header (coefficient indexes, shifts, history) and 128 bytes of nibbles. */
export function decodeFadpcm(data: Uint8Array, channels: number, samples: number): Float32Array[] {
  const frames = Math.floor(data.length / (FRAME * channels));
  const total = samples > 0 ? Math.min(samples, frames * FRAME_SAMPLES) : frames * FRAME_SAMPLES;
  const out = Array.from({ length: channels }, () => new Float32Array(total));
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  for (let f = 0; f < frames; f++) {
    for (let ch = 0; ch < channels; ch++) {
      const o = (f * channels + ch) * FRAME;
      const coefs = dv.getUint32(o, true);
      const shifts = dv.getUint32(o + 4, true);
      let hist1 = dv.getInt16(o + 8, true);
      let hist2 = dv.getInt16(o + 10, true);
      const dst = out[ch];
      let n = f * FRAME_SAMPLES;
      for (let i = 0; i < 8; i++) {
        const [c1, c2] = COEFS[((coefs >>> (i * 4)) & 0xf) % 7];
        const shift = 22 - ((shifts >>> (i * 4)) & 0xf);
        for (let j = 0; j < 4; j++) {
          const nibbles = dv.getUint32(o + 0x0c + 0x10 * i + 0x04 * j, true);
          for (let k = 0; k < 8; k++, n++) {
            let s = (((nibbles >>> (k * 4)) & 0xf) << 28) >> shift;
            s = (s - hist2 * c2 + hist1 * c1) >> 6;
            if (s > 32767) s = 32767;
            else if (s < -32768) s = -32768;
            if (n < total) dst[n] = s / 32768;
            hist2 = hist1;
            hist1 = s;
          }
        }
      }
    }
  }
  return out;
}

function decodePcm16(data: Uint8Array, channels: number, samples: number): Float32Array[] {
  const frames = Math.floor(data.length / (2 * channels));
  const total = samples > 0 ? Math.min(samples, frames) : frames;
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const out = Array.from({ length: channels }, () => new Float32Array(total));
  for (let i = 0; i < total; i++) for (let ch = 0; ch < channels; ch++) out[ch][i] = dv.getInt16((i * channels + ch) * 2, true) / 32768;
  return out;
}
