import * as THREE from 'three';

/** Anything shaped like ImageData (straight RGBA, top row first). */
export interface PixelImage {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

/**
 * Uploads straight RGBA as a DataTexture with pixel-art filtering. Rows are flipped on the CPU so that
 * uv (0,0) is the bottom-left of the image, the same convention as three's default image textures.
 */
export function makePixelTexture(img: PixelImage, opts: { mipmaps?: boolean } = {}): THREE.DataTexture {
  const { width: w, height: h } = img;
  const data = new Uint8Array(w * h * 4);
  const row = w * 4;
  for (let y = 0; y < h; y++) data.set(img.data.subarray(y * row, (y + 1) * row), (h - 1 - y) * row);
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
  const pot = (n: number) => (n & (n - 1)) === 0;
  tex.magFilter = THREE.NearestFilter;
  if ((opts.mipmaps ?? true) && pot(w) && pot(h)) {
    tex.generateMipmaps = true;
    tex.minFilter = THREE.NearestMipmapLinearFilter;
  } else {
    tex.generateMipmaps = false;
    tex.minFilter = THREE.NearestFilter;
  }
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

/** Number of square frames in a vertical animation strip (1 when the image is not a strip). */
export function stripFrames(img: { width: number; height: number }): number {
  return img.height > img.width && img.width > 0 && img.height % img.width === 0 ? img.height / img.width : 1;
}

/** 'opaque' | 'cutout' (only fully transparent holes) | 'translucent' (has partial alpha) */
export function alphaMode(img: PixelImage): 'opaque' | 'cutout' | 'translucent' {
  let zero = 0;
  let partial = 0;
  const d = img.data;
  for (let i = 3; i < d.length; i += 4) {
    const a = d[i];
    if (a === 0) zero++;
    else if (a < 250) partial++;
  }
  const n = d.length / 4;
  if (partial > n * 0.02) return 'translucent';
  if (zero > 0 || partial > 0) return 'cutout';
  return 'opaque';
}
