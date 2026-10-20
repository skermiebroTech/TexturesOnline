// Screenshots as <picture>: AVIF copies (a phone-sized one and a full-size one, written by
// scripts/screenshot-variants.py) with the original JPEG as the fallback. Pure markup, shared by the
// prerendered pages and the runtime DOM.

import { el, type ElNode } from './markup';

/** Smaller copies made for each screenshot (plus one at its own width). Keep in step with the script. */
export const VARIANT_WIDTHS = [640];

/** Screenshots that have AVIF copies. */
const HAS_VARIANTS = /^\/screenshots\/guides\/[^/]+\.jpg$/;

export function variantWidths(width: number): number[] {
  return [...VARIANT_WIDTHS.filter((w) => w < width), width];
}

export function variantPath(src: string, width: number): string {
  return src.replace(/\.jpg$/, `-${width}w.avif`);
}

export interface ImageSpec {
  src: string;
  width: number;
  height: number;
  alt: string;
}

/**
 * Lazy-loaded image sized by its width/height attributes (no layout shift). `sizes` is the
 * fallback for browsers without sizes="auto" (which picks the copy for the laid-out width).
 */
export function responsiveImage(img: ImageSpec, sizes: string): ElNode {
  // loading="lazy" comes before src: an image built by script would otherwise start downloading as
  // soon as its src is set, before it is even on the page
  const tag = el('img', { loading: 'lazy', decoding: 'async', width: img.width, height: img.height, alt: img.alt, src: img.src });
  if (!HAS_VARIANTS.test(img.src)) return tag;
  const srcset = variantWidths(img.width)
    .map((w) => `${variantPath(img.src, w)} ${w}w`)
    .join(', ');
  return el('picture', null, el('source', { type: 'image/avif', srcset, sizes: `auto, ${sizes}` }), tag);
}
