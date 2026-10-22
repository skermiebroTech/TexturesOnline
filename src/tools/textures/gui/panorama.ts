// The title screen panorama: six pictures on the inside of a cube around the camera, slowly turning.
// Pure (no DOM): renders into an ImageData by casting a ray per pixel, and tells which face (and
// which pixel of it) a point of the screen shows.
//
// Faces as the game draws them (Java CubeMap, the same on Bedrock): 0 front, 1 right, 2 back,
// 3 left, 4 top (its bottom edge meets the front), 5 bottom (its top edge meets the front). Seen
// from inside, each side face's left edge meets the face before it.

export interface PanoramaView {
  /** Turn around the vertical axis, degrees (grows to the right) */
  yaw: number;
  /** Degrees up (+) or down (−) */
  pitch: number;
  /** Vertical field of view, degrees (the game uses 85) */
  fov: number;
}

export interface FaceHit {
  face: number;
  /** 0..1 across and down the face */
  u: number;
  v: number;
}

/** Yaw of the game's panorama at a time (about a turn every 2 minutes). */
export function panoramaYaw(ms: number): number {
  return ((ms / 1000) * 3) % 360;
}

/** Which face a direction (camera looking along −z, x right, y up) hits, and where. */
export function faceOf(x: number, y: number, z: number): FaceHit {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const az = Math.abs(z);
  if (az >= ax && az >= ay) {
    // front (z = −1) or back (z = +1)
    const k = 1 / az;
    return z < 0 ? { face: 0, u: (x * k + 1) / 2, v: (1 - y * k) / 2 } : { face: 2, u: (1 - x * k) / 2, v: (1 - y * k) / 2 };
  }
  if (ax >= ay) {
    const k = 1 / ax;
    return x > 0 ? { face: 1, u: (z * k + 1) / 2, v: (1 - y * k) / 2 } : { face: 3, u: (1 - z * k) / 2, v: (1 - y * k) / 2 };
  }
  const k = 1 / ay;
  return y > 0 ? { face: 4, u: (x * k + 1) / 2, v: (1 - z * k) / 2 } : { face: 5, u: (x * k + 1) / 2, v: (z * k + 1) / 2 };
}

/** The view direction of a screen point (0..1 across and down) turned by the camera. */
export function rayAt(sx: number, sy: number, aspect: number, view: PanoramaView): [number, number, number] {
  const t = Math.tan((view.fov * Math.PI) / 360);
  const cx = (sx * 2 - 1) * t * aspect;
  const cy = (1 - sy * 2) * t;
  const p = (view.pitch * Math.PI) / 180;
  const yw = (view.yaw * Math.PI) / 180;
  // pitch (around x), then yaw (around y)
  const y1 = cy * Math.cos(p) + Math.sin(p);
  const z1 = cy * Math.sin(p) - Math.cos(p);
  const x2 = cx * Math.cos(yw) - z1 * Math.sin(yw);
  const z2 = cx * Math.sin(yw) + z1 * Math.cos(yw);
  return [x2, y1, z2];
}

/** The face and pixel under a screen point (0..1). */
export function panoramaHit(sx: number, sy: number, aspect: number, view: PanoramaView): FaceHit {
  const [x, y, z] = rayAt(sx, sy, aspect, view);
  const hit = faceOf(x, y, z);
  return { face: hit.face, u: Math.min(1, Math.max(0, hit.u)), v: Math.min(1, Math.max(0, hit.v)) };
}

/** Draws the panorama into `out` (missing faces stay dark). */
export function renderPanorama(out: ImageData, faces: readonly (ImageData | null)[], view: PanoramaView): void {
  const { width: w, height: h } = out;
  const d = out.data;
  const aspect = w / h;
  const t = Math.tan((view.fov * Math.PI) / 360);
  const p = (view.pitch * Math.PI) / 180;
  const yw = (view.yaw * Math.PI) / 180;
  const cp = Math.cos(p);
  const sp = Math.sin(p);
  const cyw = Math.cos(yw);
  const syw = Math.sin(yw);
  for (let j = 0; j < h; j++) {
    const cy = (1 - ((j + 0.5) / h) * 2) * t;
    const y1 = cy * cp + sp;
    const z1 = cy * sp - cp;
    for (let i = 0; i < w; i++) {
      const cx = (((i + 0.5) / w) * 2 - 1) * t * aspect;
      const x = cx * cyw - z1 * syw;
      const z = cx * syw + z1 * cyw;
      const hit = faceOf(x, y1, z);
      const f = faces[hit.face];
      const o = (j * w + i) * 4;
      if (!f) {
        d[o] = 24;
        d[o + 1] = 26;
        d[o + 2] = 32;
        d[o + 3] = 255;
        continue;
      }
      const fx = Math.min(f.width - 1, Math.max(0, (hit.u * f.width) | 0));
      const fy = Math.min(f.height - 1, Math.max(0, (hit.v * f.height) | 0));
      const s = (fy * f.width + fx) * 4;
      d[o] = f.data[s];
      d[o + 1] = f.data[s + 1];
      d[o + 2] = f.data[s + 2];
      d[o + 3] = 255;
    }
  }
}
