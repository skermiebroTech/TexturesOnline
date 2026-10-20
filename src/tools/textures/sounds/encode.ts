// Main-thread side of the Ogg Vorbis encoder: one lazily started worker, one job at a time.

import type { EncodeReply, EncodeRequest } from './vorbis.worker';

/** libvorbis quality (0..10): 4 is about 128 kbps stereo / 80 kbps mono, close to the game's own files. */
export const VORBIS_QUALITY = 4;

let worker: Worker | null = null;
let nextId = 1;
const waiting = new Map<number, { resolve(b: Uint8Array): void; reject(e: Error): void }>();

function getWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(new URL('./vorbis.worker.ts', import.meta.url), { type: 'module', name: 'ogg-vorbis-encoder' });
  w.onmessage = (e: MessageEvent<EncodeReply>) => {
    const job = waiting.get(e.data.id);
    if (!job) return;
    waiting.delete(e.data.id);
    if ('bytes' in e.data) job.resolve(e.data.bytes);
    else job.reject(new Error(e.data.error));
  };
  w.onerror = (e) => {
    e.preventDefault();
    const err = new Error("The sound encoder couldn't start. Reload the page and try again.");
    for (const job of waiting.values()) job.reject(err);
    waiting.clear();
    w.terminate();
    if (worker === w) worker = null;
  };
  worker = w;
  return w;
}

/** Encodes mono or stereo samples as an Ogg Vorbis file. The arrays are transferred (don't reuse them). */
export function encodeOggVorbis(channels: Float32Array[], sampleRate: number, quality = VORBIS_QUALITY): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    waiting.set(id, { resolve, reject });
    const req: EncodeRequest = { id, channels, sampleRate, quality };
    try {
      getWorker().postMessage(req, channels.map((c) => c.buffer as ArrayBuffer));
    } catch (err) {
      waiting.delete(id);
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

/** Stops the worker (frees the encoder's memory); it starts again on the next encode. */
export function stopEncoder(): void {
  worker?.terminate();
  worker = null;
  const err = new Error('Cancelled.');
  err.name = 'AbortError';
  for (const job of waiting.values()) job.reject(err);
  waiting.clear();
}
