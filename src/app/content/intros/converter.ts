// The pack converter's introduction in English, loaded on its own pages only (see ToolIntro
// in src/app/content/tools.ts).

import { el } from '../../markup';
import { code, figure, link, strong } from '../blocks';
import { SHOTS } from '../shots';
import type { ToolIntroBody } from '../tools';

export const INTRO: ToolIntroBody = {
  base: 'convert',
  eyebrow: 'Converter',
  heading: 'Minecraft Texture Pack Converter',
  appName: 'Minecraft Texture Pack Converter',
  lead: [
    'Turn a ',
    strong('Java'),
    ' texture pack into a ',
    strong('Bedrock'),
    ' one, a Bedrock pack into a Java one, or an old Java pack into one for the version you play. Free, in your browser, and the pack never leaves your device.',
  ],
  featureList: [
    'Java to Bedrock: textures moved to Bedrock’s folders and names, with a manifest.json',
    'Bedrock to Java: textures moved to Java’s folders and names, with a pack.mcmeta',
    'Java version to Java version, including the 1.13 texture renames',
    'Animations, the pack icon and the description are carried over',
    'A report lists every texture that could not be converted',
    'Open the converted pack in the editor to touch it up',
  ],
  features: [
    ['Java → Bedrock: every texture is moved to Bedrock’s folder and file name and gets a ', code('manifest.json'), '.'],
    ['Bedrock → Java: textures go to Java’s paths, ', code('.tga'), ' images become PNG, and the pack gets a ', code('pack.mcmeta'), '.'],
    ['Old Java → new Java (or back): textures renamed between versions, such as the big 1.13 rename, are fixed for you, and models that use them are updated.'],
    ['PNG → .mcpack: a loose PNG or a zip of PNG textures named like the game’s becomes a ready pack.'],
    ['Animations, the pack icon and the description come along.'],
    ['A report lists anything that could not be converted, so you know what to repaint.'],
    ['Open the result in the Texture Pack Maker to fix the rest, then export.'],
  ],
  howTitle: 'How to convert a texture pack',
  steps: [
    ['Choose your pack: a Java ', code('.zip'), ', a Bedrock ', code('.mcpack'), ', or PNG textures named like the game’s.'],
    'Pick what to convert it to: Bedrock, or Java and a version.',
    'Check the report of converted and skipped textures.',
    ['Download the converted pack, or open it in the editor to touch it up first.'],
  ],
  faq: [
    {
      id: 'rename',
      q: 'Can I convert a Java pack by renaming .zip to .mcpack?',
      a: [el('p', null, 'No. The two editions use different folders, file names and description files, so Bedrock rejects a renamed Java pack. The converter moves and renames each texture and writes a ', code('manifest.json'), '. ', link('/guides/java-vs-bedrock-packs', 'Java vs Bedrock packs'), '.')],
    },
    {
      id: 'everything',
      q: 'Does every texture convert?',
      a: [el('p', null, 'Most block, item and environment textures do. Some textures exist in only one edition, and some, such as many mobs, chests and menus, are laid out differently, so they are listed in the report for you to repaint.')],
    },
    {
      id: 'models',
      q: 'What about custom models, sounds and fonts?',
      a: [el('p', null, 'Between Java and Bedrock only textures are converted: models, sounds, fonts and shaders work differently in each edition, so they are left out and listed in the report. Between Java versions they are kept, and texture names inside models are updated.')],
    },
    {
      id: 'png',
      q: 'Can I turn PNG files into an .mcpack?',
      a: [el('p', null, 'Yes. Choose a PNG, or a zip of PNGs, whose names match the game’s textures (for example ', code('stone.png'), ' or ', code('block/stone.png'), '), then pick Bedrock. Images with names the game does not use are listed so you can rename them.')],
    },
    {
      id: 'old',
      q: 'Can I update an old texture pack to the newest version?',
      a: [el('p', null, 'Yes, and back to an older version too. Choose Java and the version you play. Textures that were renamed in between, such as in 1.13, are moved to their new names, and the pack gets that version’s ', code('pack.mcmeta'), '.')],
    },
    {
      id: 'upload',
      q: 'Is my pack uploaded?',
      a: [el('p', null, 'No. The conversion happens in your browser, so the pack stays on your device.')],
    },
  ],
  extra: () => [el('div', { class: 'tool-intro-grid' }, figure(SHOTS.convertPack), figure(SHOTS.convertResult))],
  guides: ['convert-java-to-bedrock-texture-pack', 'java-vs-bedrock-packs', 'install-resource-packs', 'texture-pack-not-working'],
  related: ['/pack-doctor', '/merge-texture-packs'],
  cta: 'Convert a pack',
};
