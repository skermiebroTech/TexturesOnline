// Pixels of animated textures: a texture's frames cut out of its image and joined back into a strip,
// frames blended the way the game interpolates them, and pictures cut into frames (sprite sheets).
// No DOM.

import { createImageData, cropImageData, resizeNearest } from '../../../core/pixels';

/** Where the frames are in an image: frames run left to right, then top to bottom (the game's order). */
export interface FrameLayout {
  frameW: number;
  frameH: number;
  cols: number;
  count: number;
}

export function frameAt(full: ImageData, l: FrameLayout, i: number): ImageData {
  return cropImageData(full, (i % l.cols) * l.frameW, Math.floor(i / l.cols) * l.frameH, l.frameW, l.frameH);
}

export function splitFrames(full: ImageData, l: FrameLayout): ImageData[] {
  return Array.from({ length: l.count }, (_, i) => frameAt(full, l, i));
}

/** Frames of one size as a strip from top to bottom (how the editor saves animations). */
export function joinFrames(frames: readonly ImageData[]): ImageData {
  const w = frames[0].width;
  const fh = frames[0].height;
  const out = createImageData(w, fh * frames.length);
  frames.forEach((f, i) => {
    const src = f.width === w && f.height === fh ? f : resizeNearest(f, w, fh);
    out.data.set(src.data, i * w * fh * 4);
  });
  return out;
}

/**
 * Frame `a` blended `t` (0-1) of the way to frame `b`, as the game interpolates: Java 1.21.2 and newer
 * (and Bedrock) blend every channel; older Java blends the colour and keeps the first frame's alpha.
 */
export function blendFrames(a: ImageData, b: ImageData, t: number, mode: 'rgba' | 'rgb'): ImageData {
  const out = createImageData(a.width, a.height);
  const x = a.data;
  const y = b.data;
  const o = out.data;
  const k = Math.min(1, Math.max(0, t));
  for (let i = 0; i < o.length; i += 4) {
    o[i] = x[i] + (y[i] - x[i]) * k;
    o[i + 1] = x[i + 1] + (y[i + 1] - x[i + 1]) * k;
    o[i + 2] = x[i + 2] + (y[i + 2] - x[i + 2]) * k;
    o[i + 3] = mode === 'rgba' ? x[i + 3] + (y[i + 3] - x[i + 3]) * k : x[i + 3];
  }
  return out;
}

/** A picture as a texture frame: resized to the frame size, sharp (nearest neighbour). */
export const fitFrame = (img: ImageData, w: number, h: number): ImageData => (img.width === w && img.height === h ? img : resizeNearest(img, w, h));

/**
 * A single picture cut into frames: a sheet of whole frames of the texture's size, else a strip of
 * squares (as tall or as wide as the picture's short side), else the picture is one frame.
 */
export function sliceSheet(img: ImageData, frameW: number, frameH: number, max = 512): ImageData[] {
  const cut = (fw: number, fh: number) => {
    const cols = img.width / fw;
    const rows = img.height / fh;
    const n = Math.min(max, cols * rows);
    return splitFrames(img, { frameW: fw, frameH: fh, cols, count: n });
  };
  if (img.width % frameW === 0 && img.height % frameH === 0 && (img.width / frameW) * (img.height / frameH) > 1) return cut(frameW, frameH);
  const side = Math.min(img.width, img.height);
  const long = Math.max(img.width, img.height);
  if (frameW === frameH && long > side && long % side === 0) return cut(side, side);
  return [img];
}
