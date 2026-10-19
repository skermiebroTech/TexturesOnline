// Lazy loading of the converter's mapping data (src/editions/convert/*.json).

import { loadJavaBedrockMap, loadJavaRenames } from '../../editions/convert/maps';
import type { ConvertMaps } from './convert';

let pending: Promise<ConvertMaps> | null = null;

/** Both mapping files (cached). Throws a friendly error when they can't be loaded. */
export function loadConvertMaps(): Promise<ConvertMaps> {
  pending ??= Promise.all([loadJavaBedrockMap(), loadJavaRenames()]).then(
    ([javaBedrock, renames]) => ({ javaBedrock, renames }),
    () => {
      pending = null;
      throw new Error('Couldn’t load the converter’s texture lists. Check your connection and try again.');
    },
  );
  return pending;
}
