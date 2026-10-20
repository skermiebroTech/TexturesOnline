// What a pack resolution means, in one sentence (start screen and Pack tab).

import { fmt } from '../../../i18n/editor-text';
import { t } from '../i18n/start';

export function resolutionSentence(r: number): string {
  if (r <= 16) return t.resolution.classic;
  const detail = r === 32 ? t.resolution.twice : fmt(t.resolution.times, { n: r === 64 ? 4 : r === 128 ? 8 : r === 256 ? 16 : 32 });
  return fmt(t.resolution.hd, { r, detail });
}
