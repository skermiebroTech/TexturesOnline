// The pack merger's introduction in English, loaded on its own pages only (see ToolIntro
// in src/app/content/tools.ts).

import { el } from '../../markup';
import { code, figure, link, strong } from '../blocks';
import { SHOTS } from '../shots';
import type { ToolIntroBody } from '../tools';

export const INTRO: ToolIntroBody = {
  base: 'merge',
  eyebrow: 'Merge packs',
  heading: 'Merge Minecraft Texture Packs',
  appName: 'Minecraft Texture Pack Merger',
  lead: [
    'Combine two to eight texture packs into one. Put them in order and, as in Minecraft’s own pack list, the pack at the top wins wherever two packs change the same texture. It works for ',
    strong('Java'),
    ' and ',
    strong('Bedrock'),
    ' packs, it is free and the packs never leave your device.',
  ],
  featureList: [
    'Combines 2 to 8 Java (.zip) or Bedrock (.mcpack, .mcaddon) texture packs into one',
    'Reorderable pack list: the top pack wins, as in Minecraft',
    'Animations (.mcmeta files and flipbook entries) stay with their textures',
    'Java language files, sounds.json, atlases and fonts merged entry by entry',
    'Bedrock terrain_texture.json, item_texture.json, flipbook_textures.json, blocks.json and sound definitions merged entry by entry',
    'Java packs for different versions get the texture names of one version first',
    'A report of the files each pack added and every conflict',
    'Download the merged pack or open it in the editor',
  ],
  features: [
    ['Up to eight packs at once: Java ', code('.zip'), ' files or Bedrock ', code('.mcpack'), ' and ', code('.mcaddon'), ' files.'],
    ['Drag the packs into order, or use the arrow buttons. The top pack wins, as in the Selected list in Minecraft.'],
    ['A texture keeps its own animation: its ', code('.png.mcmeta'), ' file or flipbook entry always comes from the same pack as the image.'],
    ['Java language files, ', code('sounds.json'), ', atlases and fonts are combined entry by entry instead of one replacing the other.'],
    ['Bedrock ', code('terrain_texture.json'), ', ', code('item_texture.json'), ', ', code('flipbook_textures.json'), ', ', code('blocks.json'), ' and sound definitions are combined the same way.'],
    ['Java packs made for different versions are renamed for the version you pick, so old and new packs fit together.'],
    ['A report shows how many files each pack added and lists every conflict. Open the result in the Texture Pack Maker to keep editing.'],
  ],
  howTitle: 'How to merge texture packs',
  steps: [
    ['Add the packs: two to eight Java ', code('.zip'), ' files, or Bedrock ', code('.mcpack'), ' files.'],
    'Put them in order. The pack at the top wins where two packs change the same file.',
    'Name the merged pack, pick its icon and, for Java, the version you play.',
    'Merge, check the list of conflicts, then download the pack or open it in the editor.',
  ],
  faq: [
    {
      id: 'wins',
      q: 'Which pack wins when two packs change the same texture?',
      a: [
        el(
          'p',
          null,
          'The one higher in the list, the same rule Minecraft uses for the Selected (Java) or active (Bedrock) packs. A texture only one pack changes is always kept. The report lists every file that was in more than one pack and the pack it was taken from.',
        ),
      ],
    },
    {
      id: 'editions',
      q: 'Can I merge Java and Bedrock packs?',
      a: [
        el(
          'p',
          null,
          'Not directly: the two editions use different folders, file names and pack files, so one pack can’t be both. Convert the packs to one edition with the ',
          link('/texture-pack-converter', 'Texture Pack Converter'),
          ' first, then merge them.',
        ),
      ],
    },
    {
      id: 'other',
      q: 'Do shaders, sounds and models merge?',
      a: [
        el(
          'p',
          null,
          'Every file comes along. Where two packs have the same file, such as a model, a block state, a sound or a core shader, the top pack’s copy is used. Files the game reads as lists are combined instead: language files, ',
          code('sounds.json'),
          ', atlases and fonts on Java, and the texture lists, ',
          code('blocks.json'),
          ' and sound definitions on Bedrock. Iris and OptiFine shader packs are not resource packs, so they are not merged here.',
        ),
      ],
    },
    {
      id: 'versions',
      q: 'Can I merge packs made for different versions?',
      a: [
        el(
          'p',
          null,
          'Yes, on Java. Pick the version you play: packs made for older or newer versions get that version’s texture names first, for example the 1.13 renames such as ',
          code('blocks/stone.png'),
          ' to ',
          code('block/stone.png'),
          '. The merged pack gets the ',
          code('pack.mcmeta'),
          ' of that version. ',
          link('/guides/minecraft-pack-format-versions', 'Pack formats of every version'),
          '.',
        ),
      ],
    },
    {
      id: 'upload',
      q: 'Is my pack uploaded?',
      a: [el('p', null, 'No. The packs are read and merged in your browser and stay on your device.')],
    },
    {
      id: 'install',
      q: 'How do I use the merged pack?',
      a: [
        el(
          'p',
          null,
          'Install it like any other pack and turn off the packs it was made from. One pack is also easier to share, or to set as a server’s resource pack. ',
          link('/guides/install-resource-packs', 'How to install resource packs'),
          '.',
        ),
      ],
    },
  ],
  extra: () => [el('div', { class: 'tool-intro-grid' }, figure(SHOTS.mergeSettings), figure(SHOTS.mergeResult))],
  guides: ['merge-texture-packs', 'install-resource-packs', 'texture-pack-not-working', 'minecraft-pack-format-versions'],
  related: ['/pack-doctor', '/texture-pack-converter'],
  cta: 'Merge packs',
};
