// The PNG / TGA codecs (image.ts) on demand. Start screens read or write image files only when
// there is one (a dropped file, a saved project's thumbnail), so they import these instead of
// image.ts and the codecs stay out of their first download.

import type * as Image from './image';

export const loadImageCodecs = (): Promise<typeof Image> => import('./image');

/** image.ts's decodeImage, loading the codecs first. */
export async function decodeImage(...args: Parameters<typeof Image.decodeImage>): Promise<ImageData> {
  return (await loadImageCodecs()).decodeImage(...args);
}
