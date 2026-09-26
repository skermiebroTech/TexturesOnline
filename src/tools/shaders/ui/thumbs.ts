// Real preview renders for the start screen: one hidden preview renders every picture in turn,
// then goes away. Results are kept for the session and in the local cache.

import { cacheGet, cacheSet } from '../../../core/storage';
import type { PreviewParams } from '../../../core/types';
import { thumbFromScreenshot } from './art';

export interface RenderJob {
  key: string;
  params: PreviewParams;
}

const memory = new Map<string, Blob>();
const CACHE_PREFIX = 'shader-thumbs:v1:';

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/** Cache key that changes whenever the look changes. */
export function jobKey(name: string, params: PreviewParams): string {
  return `${name}:${hash(JSON.stringify(params))}`;
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * Renders each job (or takes it from the cache) and calls `onImage` as soon as each one is ready.
 * Quietly gives up when WebGL is unavailable: callers keep their placeholder art.
 */
export async function renderPreviewImages(
  jobs: RenderJob[],
  onImage: (key: string, blob: Blob) => void,
  opts: { width?: number; height?: number; signal?: AbortSignal } = {},
): Promise<void> {
  const todo: RenderJob[] = [];
  for (const job of jobs) {
    const hit = memory.get(job.key) ?? (await cacheGet<Blob>(CACHE_PREFIX + job.key).catch(() => undefined));
    if (opts.signal?.aborted) return;
    if (hit instanceof Blob && hit.size > 0) {
      memory.set(job.key, hit);
      onImage(job.key, hit);
    } else todo.push(job);
  }
  if (!todo.length || !webglAvailable()) return;

  const width = opts.width ?? 480;
  const height = opts.height ?? 300;
  const { createShaderPreview } = await import('../../../shared/preview/shader-preview');
  if (opts.signal?.aborted) return;
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = `position:fixed;left:-${width + 4000}px;top:0;width:${width}px;height:${height}px;pointer-events:none;visibility:hidden;`;
  document.body.appendChild(host);
  const preview = createShaderPreview(host, { autoRotate: false, pixelRatio: 1, params: todo[0].params });
  try {
    await preview.setAssets(null);
    for (const job of todo) {
      if (opts.signal?.aborted) return;
      preview.setParams(job.params);
      // let the browser breathe between renders (they are heavy on slow GPUs)
      await new Promise((r) => setTimeout(r, 30));
      if (opts.signal?.aborted) return;
      const shot = await preview.screenshot();
      const small = await thumbFromScreenshot(shot, width, height).catch(() => shot);
      memory.set(job.key, small);
      void cacheSet(CACHE_PREFIX + job.key, small).catch(() => undefined);
      onImage(job.key, small);
    }
  } catch {
    /* no preview on this device: keep the placeholders */
  } finally {
    preview.destroy();
    host.remove();
  }
}
