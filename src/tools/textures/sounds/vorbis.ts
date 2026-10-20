// Ogg Vorbis encoding with libvorbis compiled to WebAssembly (wasm-media-encoders, MIT; libogg and
// libvorbis are BSD). Only the encoder API is imported, never the package's inline copies of the
// binaries, so the .wasm is fetched separately and only when a sound is saved.

import { createEncoder, type WasmMediaEncoder } from 'wasm-media-encoders/esnext';

export type WasmSource = string | ArrayBuffer | Uint8Array | WebAssembly.Module;

/** Samples handed to the encoder per call (keeps the encoder's output buffer small). */
const CHUNK = 16384;

let cached: { source: WasmSource; encoder: Promise<WasmMediaEncoder<'audio/ogg'>> } | null = null;

function encoderFor(wasm: WasmSource): Promise<WasmMediaEncoder<'audio/ogg'>> {
  if (cached && cached.source === wasm) return cached.encoder;
  const encoder = createEncoder('audio/ogg', wasm);
  cached = { source: wasm, encoder };
  encoder.catch(() => {
    if (cached?.encoder === encoder) cached = null;
  });
  return encoder;
}

/**
 * Encodes 1 or 2 channels of float samples (-1..1) as Ogg Vorbis.
 * quality: libvorbis VBR quality on a 0..10 scale (4 is about 128 kbps for stereo at 44.1 kHz).
 */
export async function encodeVorbis(channels: Float32Array[], sampleRate: number, wasm: WasmSource, quality = 4, serial?: number): Promise<Uint8Array> {
  if (channels.length !== 1 && channels.length !== 2) throw new Error('Only mono or stereo sounds can be encoded.');
  if (!(sampleRate >= 8000 && sampleRate <= 192000)) throw new Error(`Unsupported sample rate ${sampleRate}.`);
  const length = channels[0].length;
  if (channels.some((c) => c.length !== length)) throw new Error('Channels have different lengths.');
  const encoder = await encoderFor(wasm);
  encoder.configure({ channels: channels.length as 1 | 2, sampleRate, vbrQuality: quality, ...(serial !== undefined ? { oggSerialNo: serial } : {}) });
  const parts: Uint8Array[] = [];
  let total = 0;
  const keep = (b: Uint8Array) => {
    if (!b.length) return;
    // The encoder owns (and reuses) its output buffer: copy it.
    parts.push(b.slice());
    total += b.length;
  };
  for (let i = 0; i < length; i += CHUNK) {
    keep(encoder.encode(channels.map((c) => c.subarray(i, Math.min(length, i + CHUNK)))));
  }
  keep(encoder.finalize());
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
