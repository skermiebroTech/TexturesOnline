// Encodes sounds as Ogg Vorbis off the main thread (long music would otherwise freeze the page).

import wasmUrl from 'wasm-media-encoders/wasm/ogg.wasm?url';
import { encodeVorbis } from './vorbis';

export interface EncodeRequest {
  id: number;
  channels: Float32Array[];
  sampleRate: number;
  quality: number;
}
export type EncodeReply = { id: number; bytes: Uint8Array } | { id: number; error: string };

let wasm: Promise<ArrayBuffer> | null = null;
/** Fetched as bytes so a server sending the wrong MIME type for .wasm doesn't matter. */
function loadWasm(): Promise<ArrayBuffer> {
  wasm ??= fetch(wasmUrl)
    .then((r) => {
      if (!r.ok) throw new Error(`The sound encoder couldn't be loaded (HTTP ${r.status}).`);
      return r.arrayBuffer();
    })
    .catch((err) => {
      wasm = null;
      throw err;
    });
  return wasm;
}

const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.onmessage = async (e: MessageEvent<EncodeRequest>) => {
  const { id, channels, sampleRate, quality } = e.data;
  try {
    const bytes = await encodeVorbis(channels, sampleRate, await loadWasm(), quality);
    scope.postMessage({ id, bytes } satisfies EncodeReply, [bytes.buffer]);
  } catch (err) {
    scope.postMessage({ id, error: err instanceof Error ? err.message : String(err) } satisfies EncodeReply);
  }
};
