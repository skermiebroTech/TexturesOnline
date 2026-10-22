// Files the Java client jar only carries as stand-ins. From 1.15 the jar's title screen panorama
// (textures/gui/title/background/panorama_0..5.png and panorama_overlay.png) is a 1 × 1 image; the
// game takes the real pictures from its other assets (the version's asset index, served by
// resources.download.minecraft.net, which scripts can't read). misode/mcmeta keeps a copy of each
// version's assets (1.14+) on GitHub, which browsers can read: the real images are fetched from
// there the first time they are needed and kept with the other cached game files.

import { cacheGet, cacheSet } from '../../core/storage';
import { fetchBytes, fetchFirst } from '../../core/net';

const STAND_IN = /^assets\/minecraft\/textures\/gui\/title\/background\/panorama_(\d|overlay)\.png$/;
const MCMETA_RAW = 'https://raw.githubusercontent.com/misode/mcmeta';
const MCMETA_CDN = 'https://cdn.jsdelivr.net/gh/misode/mcmeta';
const FORMAT = 1;

/** PNG width and height from its header (null: not a PNG). */
function pngSize(bytes: Uint8Array): { w: number; h: number } | null {
  if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50) return null;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { w: v.getUint32(16), h: v.getUint32(20) };
}

/** Whether a jar file is a stand-in for a picture the game keeps elsewhere. */
export function isStandIn(path: string, bytes: Uint8Array): boolean {
  if (!STAND_IN.test(path)) return false;
  const s = pngSize(bytes);
  return !!s && s.w <= 2 && s.h <= 2;
}

/** The same check on a decoded image (export: a stand-in is never written into a pack). */
export function isStandInImage(path: string, img: { width: number; height: number }): boolean {
  return STAND_IN.test(path) && img.width <= 2 && img.height <= 2;
}

export function assetObjectUrls(versionId: string, path: string): string[] {
  const tag = encodeURIComponent(`${versionId}-assets`);
  return [`${MCMETA_RAW}/${tag}/${path}`, `${MCMETA_CDN}@${tag}/${path}`];
}

const loads = new Map<string, Promise<Uint8Array | null>>();

/**
 * The real file behind a stand-in (cached on this device), or null when it can't be had (offline
 * on a first visit, or a version the mirror doesn't have): the stand-in is used then.
 */
export function realAssetObject(versionId: string, path: string, signal?: AbortSignal): Promise<Uint8Array | null> {
  const key = `java-object:v${FORMAT}:${versionId}:${path}`;
  let p = loads.get(key);
  if (!p) {
    p = (async () => {
      const cached = await cacheGet<Uint8Array>(key).catch(() => undefined);
      if (cached instanceof Uint8Array && pngSize(cached)) return cached;
      try {
        const bytes = await fetchFirst(assetObjectUrls(versionId, path), (u) => fetchBytes(u, { retries: 1, timeoutMs: 30_000, signal }));
        const size = pngSize(bytes);
        if (!size || (size.w <= 2 && size.h <= 2)) return null;
        cacheSet(key, bytes).catch(() => {});
        return bytes;
      } catch (err) {
        console.warn(`${path} of ${versionId} isn't available:`, err);
        return null;
      }
    })();
    loads.set(key, p);
    // a failure is tried again the next time
    void p.then((b) => b || loads.delete(key));
  }
  return p;
}
