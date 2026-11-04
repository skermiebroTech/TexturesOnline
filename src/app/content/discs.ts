// Facts for the music disc maker's page (src/app/content/tools.ts and its translations): how long the
// jukebox plays each disc. Kept apart from the page text so every language's bundle can import it.

import { el, type ElNode } from '../markup';

/**
 * How long the jukebox plays each disc in Java 26.3 (length_in_seconds of the game's
 * data/minecraft/jukebox_song files), longest first. The names are the songs' titles as the game
 * shows them, the same in every language.
 */
export const DISC_LENGTHS: readonly (readonly [string, number])[] = [
  ['blocks', 345], ['Precipice', 299], ['ward', 251], ['wait', 238], ['Bounce', 234], ['Relic', 218], ['mall', 197], ['otherside', 195],
  ['strad', 188], ['cat', 185], ['chirp', 185], ['13', 178], ['5', 178], ['Creator', 176], ['Tears', 175], ['far', 174], ['stal', 150],
  ['Pigstep', 149], ['Lava Chicken', 134], ['mellohi', 96], ['Creator (Music Box)', 73], ['11', 71],
];

/** The disc lengths as a list (in columns where there is room), named for screen readers in the page's language. */
export function discLengths(label: string): ElNode {
  const time = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  return el(
    'ul',
    { class: 'disc-lengths', 'aria-label': label },
    DISC_LENGTHS.map(([name, s]) => el('li', null, el('span', { class: 'disc-name' }, name), ' ', el('span', { class: 'disc-time' }, time(s)))),
  );
}
