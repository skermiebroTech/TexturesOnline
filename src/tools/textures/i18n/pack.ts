// English text of the texture pack modules that the converter and the merger load too (project.ts,
// sounds/pack.ts): kept apart from the start screen's text so those pages carry only this.
// Translations: ./<lang>.ts (the texture start screen's language files).

import { defineText } from '../../../i18n/editor-text';

export const tp = defineText('textures.pack', {
  notInGame: '"{file}" isn\'t a texture in {edition, select, java {Minecraft {version}} other {this Bedrock version}}, and this pack has no copy of it.',
  emptyImage: 'The image is empty.',
  /** Export note; {files} lists up to three file names */
  soundsNotOgg: '{count, plural, one {# sound file isn’t Ogg Vorbis, so Java won’t play it: {files}. Replace it in Sounds.} other {# sound files aren’t Ogg Vorbis, so Java won’t play them: {files}. Replace them in Sounds.}}',
});

export type TexturePackText = typeof tp;
