// English text of where skins come from (src/tools/skins/ui/sources.ts: uploaded PNGs, Java
// usernames, the game's default skins), shared by the skin editor and the totem maker.
// Translations: src/shared/i18n/<lang>.ts.

import { defineText } from '../../i18n/editor-text';

export const skinText = defineText('shared.skins', {
  hdKept: 'This is an HD 128×128 skin, so it stays HD. Bedrock shows every pixel; Java exports are reduced to 64×64.',
  legacy: 'This is an old 64×32 skin, so it was converted to the modern 64×64 layout. The left arm and leg start as mirror copies of the right ones.',
  /** {hint} is one of the two hints below */
  wrongSize: 'This image is {width}×{height} pixels. Minecraft skins are exactly 64×64 pixels, 128×128 for HD Bedrock skins, or the old 64×32 size.{hint}',
  enlargedHint: ' It looks like a {factor}× enlarged skin; use the original 64×64 (or HD 128×128) file instead.',
  screenshotHint: ' Make sure you picked the skin file itself, not a screenshot or a render of it.',
  invisible: 'This skin is completely see-through, so there is nothing to see yet. Paint away!',
  tooBig: 'That file is too big to be a skin. Skins are small 64×64 (or HD 128×128) PNG images, usually well under 50 KB.',
  jpeg: 'This is a JPEG photo. Skins must be PNG files, because they need see-through pixels. Save your skin as .png and try again.',
  notPng: '"{name}" is not a PNG image. Skins are 64×64 .png files.',
  thisFile: 'This file',
  damaged: 'This PNG file seems to be damaged and could not be opened.',
  typeName: 'Type a Minecraft Java username.',
  badName: 'Java usernames are 3 to 16 letters, numbers or underscores (no spaces).',
  noPlayer: 'No Java Edition player is called "{name}". Check the spelling. (Bedrock gamertags can\'t be looked up.)',
  defaultSkin: '{name} uses one of the default skins.',
  fallback: 'The player lookup service did not answer, so the skin came from mc-heads.net. The arm model was guessed from the pixels.',
  badAnswer: "The skin servers answered, but didn't send a usable skin. Try again in a minute.",
  unreachable: "Couldn't reach the skin servers. Check your internet connection and try again.",
});

export type SkinText = typeof skinText;
