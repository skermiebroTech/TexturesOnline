// The music disc maker's introduction in English, loaded on its own pages only (see ToolIntro
// in src/app/content/tools.ts).

import { el } from '../../markup';
import { code, link, strong } from '../blocks';
import { discLengths } from '../discs';
import type { ToolIntroBody } from '../tools';

export const INTRO: ToolIntroBody = {
  base: 'textures',
  eyebrow: 'Music disc maker',
  heading: 'Custom Minecraft Music Disc Maker',
  appName: 'Minecraft Music Disc Maker',
  lead: [
    'Put your own song on a Minecraft music disc: pick a disc, upload an audio file or record one with your microphone, trim it on its waveform and repaint the disc if you like. The jukebox then plays your song in ',
    strong('Java Edition'),
    ' and ',
    strong('Bedrock Edition'),
    '. Free, in your browser, with nothing uploaded.',
  ],
  featureList: [
    'Every music disc of the chosen version, listed under Records',
    'Upload MP3, WAV, OGG or M4A audio up to 15 minutes long, or record with the microphone',
    'Trim on the waveform, set the volume, normalise, stereo or mono',
    'Saved as Ogg Vorbis, the format Minecraft plays; Bedrock packs get their sound_definitions.json entries',
    'Repaint the disc item in the pixel editor',
    'Exports a Java .zip or a Bedrock .mcpack',
  ],
  features: [
    ['Every music disc of your version in the Sounds list under ', strong('Records'), ', from 13 and cat to Pigstep, Relic, Precipice and Lava Chicken.'],
    ['Upload your song (MP3, WAV, OGG or M4A, up to 15 minutes) or record it with your microphone. A recording is trimmed and levelled for you.'],
    ['Trim the start and the end on the waveform, set the volume or press ', strong('Normalise'), ', and keep it in stereo or make it mono. Parts that would distort show in red.'],
    ['Saved as Ogg Vorbis, the only format Java plays, under the disc’s own file name. Bedrock packs also get the disc’s entry in ', code('sound_definitions.json'), '.'],
    ['Give the disc a new look: its picture is open in the pixel editor, so switch from Sounds to the textures to repaint it or upload one.'],
    ['Replace any other sound while you are there: mobs, blocks, menu clicks or the background music.'],
  ],
  howTitle: 'How to put your own song on a music disc',
  steps: [
    ['Choose ', strong('Java'), ' or ', strong('Bedrock'), ' and your version, then press ', strong('Create music disc pack'), '. The editor opens on the records, with cat picked.'],
    'Pick the disc to replace. On Java 1.21 and newer, choose one whose song is at least as long as yours (see the lengths below).',
    ['Press ', strong('Replace'), ', then ', strong('Upload a sound file…'), ' or ', strong('Record with the microphone…')],
    'Trim it on the waveform and set the volume, then play it to check.',
    ['Repaint the disc if you like and export. On Java put the ', code('.zip'), ' in the ', code('resourcepacks'), ' folder, on Bedrock open the ', code('.mcpack'), ', then turn the pack on and put the disc in a jukebox.'],
  ],
  extra: (sub) => [
    el(
      'div',
      { class: 'tool-intro-grid' },
      el(
        'div',
        { class: 'tool-intro-card' },
        el(sub, null, 'How long can the song be?'),
        el('p', null, 'In Java 1.21 and newer every disc has a set length: the jukebox stops it one second after the original song would end, even when your file is longer. Pick a disc at least as long as your song. The lengths in Java 26.3:'),
        discLengths('Disc lengths in Java 26.3'),
      ),
      el(
        'div',
        { class: 'tool-intro-card' },
        el(sub, null, 'Good to know'),
        el('p', null, strong('Stereo or mono:'), ' Java plays a stereo sound at the same loudness wherever you stand. Turn ', strong('Stereo'), ' off if your song should come from the jukebox and fade as you walk away.'),
        el('p', null, strong('Where the file goes:'), ' Java reads the song from ', code('assets/minecraft/sounds/records/'), ' (', code('cat.ogg'), ' for cat). Bedrock reads it from the path its ', code('sound_definitions.json'), ' names, and the pack gets that entry too.'),
        el('p', null, strong('The disc’s picture:'), ' Java 1.13 and newer read ', code('textures/item/music_disc_cat.png'), ' and so on; Bedrock reads ', code('textures/items/record_cat.png'), ' for the older discs and ', code('music_disc_relic.png'), ' and the like for the newer ones.'),
      ),
    ),
  ],
  faq: [
    {
      id: 'format',
      q: 'Which audio files can I use?',
      a: [el('p', null, 'MP3, WAV, OGG and M4A work in most browsers, up to 15 minutes long. The editor turns your file into Ogg Vorbis, the format Minecraft needs, so you don’t have to convert it first.')],
    },
    {
      id: 'length',
      q: 'Why does my song stop early?',
      a: [el('p', null, 'In Java 1.21 and newer the jukebox stops a disc one second after the original song’s length, whatever the length of your file. Replace a longer disc: blocks (5:45) and Precipice (4:59) are the longest.')],
    },
    {
      id: 'distance',
      q: 'Why do I hear the disc at the same volume everywhere?',
      a: [el('p', null, 'Your song is in stereo. Java plays stereo sounds without a direction, so they don’t fade with distance. Turn Stereo off for the disc in the editor and it comes from the jukebox again.')],
    },
    {
      id: 'name',
      q: 'Can I change the disc’s name?',
      a: [el('p', null, 'Not here: the disc and the “Now Playing” line keep the original title. They come from the game’s language files, which this tool doesn’t edit.')],
    },
    {
      id: 'new',
      q: 'Can I add a new disc instead of replacing one?',
      a: [el('p', null, 'Not with a resource pack alone. Java 1.21 and newer can add songs with a data pack, which this tool doesn’t make. Replacing a disc works in every version.')],
    },
    {
      id: 'others',
      q: 'Will other players hear my song?',
      a: [el('p', null, 'Only players who have the pack. On a Java server it can be the server’s resource pack; on Bedrock, add it to the world’s resource packs so everyone who joins gets it. ', link('/guides/install-resource-packs', 'How to install packs'), '.')],
    },
  ],
  guides: ['install-resource-packs', 'texture-pack-not-working', 'make-a-texture-pack'],
  related: ['/textures', '/painting-maker'],
  cta: 'Make a music disc pack',
};
