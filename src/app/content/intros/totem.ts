// The totem maker's introduction in English, loaded on its own pages only (see ToolIntro
// in src/app/content/tools.ts).

import { el } from '../../markup';
import { code, link, strong } from '../blocks';
import type { ToolIntroBody } from '../tools';

export const INTRO: ToolIntroBody = {
  base: 'totem',
  eyebrow: 'Totem maker',
  heading: 'Custom Totem of Undying Maker',
  appName: 'Custom Totem of Undying Maker',
  lead: [
    'Make a Totem of Undying that looks like you, or any player: the maker turns a Minecraft skin into the 16×16 totem item and packs it as a resource pack. It works for ',
    strong('Java'),
    ' (1.11 and newer) and ',
    strong('Bedrock'),
    ', it is free and the skin never leaves your device.',
  ],
  featureList: [
    'Turns a Minecraft skin into a 16×16 Totem of Undying texture',
    'Skin from an uploaded PNG (64×64 or legacy 64×32), a Java player’s username, a saved skin project or the default skins',
    'Three styles: Classic, Big head and Full body, with or without the outer layer',
    'Optional gold outline and wings taken from the vanilla totem of the chosen version',
    'Live preview of the texture, the totem pop animation and the hotbar',
    'Pixel editor for touch-ups',
    'Java resource pack (.zip) with the correct pack.mcmeta for 1.11 to 26.3, or a Bedrock .mcpack',
    'Download the PNG on its own or open the totem in the Texture Pack Maker',
  ],
  features: [
    ['Use any skin: upload a ', code('.png'), ' (64×64, or the old 64×32 layout), type a Java player’s username, pick one of your saved skins or a default character such as Steve or Alex.'],
    [strong('Classic'), ' puts the full face on top with the arms spread like the totem’s wings, ', strong('Big head'), ' gives an oversized head and ', strong('Full body'), ' shows the whole player standing.'],
    ['Keep or drop the outer layer (hat, jacket, sleeves, trousers), and keep the vanilla totem’s gold outline or wings if you like the golden look.'],
    ['See the result at full size, in the pop when a totem saves you, and in a hotbar. Touch up single pixels in the built-in editor.'],
    ['Download a Java ', code('.zip'), ' with the right ', code('pack.mcmeta'), ' for your version or a Bedrock ', code('.mcpack'), ', with the totem as the pack icon. The PNG is there too, or open it in the Texture Pack Maker to add more textures.'],
  ],
  howTitle: 'How to make a custom totem',
  steps: [
    'Choose a skin: upload a PNG, type a Java username, pick one of your saved skins or a default character.',
    'Pick a style (Classic, Big head or Full body) and whether to keep the outer layer, the gold outline or the gold wings.',
    ['Check the previews. Use ', strong('Edit pixels'), ' to change anything by hand.'],
    ['Choose Java and the version you play, or Bedrock, then download the ', code('.zip'), ' or ', code('.mcpack'), '.'],
    'Install it like any resource pack and move it to the top of your pack list.',
  ],
  extra: (sub) => [
    el(
      'div',
      { class: 'tool-intro-card' },
      el(sub, null, 'What is inside the pack?'),
      el(
        'p',
        null,
        'One texture and the files every pack needs. Java: ',
        code('pack.mcmeta'),
        ', ',
        code('pack.png'),
        ' and ',
        code('assets/minecraft/textures/item/totem_of_undying.png'),
        ' (',
        code('items/totem.png'),
        ' for 1.11 to 1.12.2, before the 1.13 rename). Bedrock: ',
        code('manifest.json'),
        ', ',
        code('pack_icon.png'),
        ' and ',
        code('textures/items/totem.png'),
        '. Because only the totem changes, the pack works next to any other pack: put it above the others.',
      ),
    ),
  ],
  faq: [
    {
      id: 'bedrock',
      q: 'Does it work on Bedrock?',
      a: [
        el(
          'p',
          null,
          'Yes. Choose Bedrock and open the ',
          code('.mcpack'),
          ': Minecraft imports it, then turn it on under ',
          strong('Settings › Global Resources'),
          '. It replaces ',
          code('textures/items/totem.png'),
          '. Windows, Android, iPhone and iPad can import pack files; Xbox, PlayStation and Switch can’t.',
        ),
      ],
    },
    {
      id: 'versions',
      q: 'Which versions have totems?',
      a: [
        el(
          'p',
          null,
          'Java 1.11 and newer, and every current Bedrock version. Java 1.11 to 1.12.2 name the texture ',
          code('items/totem.png'),
          '; 1.13 renamed it to ',
          code('item/totem_of_undying.png'),
          '. Pick your version and the pack uses the right name and ',
          code('pack.mcmeta'),
          '. ',
          link('/guides/minecraft-pack-format-versions', 'Pack formats of every version'),
          '.',
        ),
      ],
    },
    {
      id: 'friend',
      q: 'Can I use my friend’s skin?',
      a: [
        el(
          'p',
          null,
          'Yes. Type their Java username and their current skin is fetched, or upload their skin file. Bedrock gamertags can’t be looked up, so ask a Bedrock friend for the PNG. The totem only changes in your game.',
        ),
      ],
    },
    {
      id: 'install',
      q: 'How do I install it?',
      a: [
        el(
          'p',
          null,
          'Java: put the ',
          code('.zip'),
          ' in your ',
          code('resourcepacks'),
          ' folder (Options › Resource Packs › Open Pack Folder), don’t unzip it, and move it to the top of the Selected list. Bedrock: open the ',
          code('.mcpack'),
          ' and activate it in Global Resources. ',
          link('/guides/install-resource-packs', 'How to install resource packs'),
          '.',
        ),
      ],
    },
    {
      id: 'others',
      q: 'Will other players see my custom totem?',
      a: [
        el(
          'p',
          null,
          'No. Resource packs only change what you see, so other players see the normal totem unless they install the same pack. The exception is a server that sends it to everyone as its server resource pack (Java) or required pack (Bedrock).',
        ),
      ],
    },
    {
      id: 'normal',
      q: 'Why does my totem still look normal?',
      a: [
        el(
          'p',
          null,
          'Another pack above it probably changes the totem too: move yours to the top. Also check that you picked the version you play, since the file name changed in 1.13. ',
          link('/guides/texture-pack-not-working', 'More fixes'),
          '.',
        ),
      ],
    },
    {
      id: 'upload',
      q: 'Is my skin uploaded?',
      a: [el('p', null, 'No. The totem and the pack are made in your browser. Only a username lookup asks a skin server for that player’s skin.')],
    },
  ],
  guides: ['make-a-custom-totem', 'install-resource-packs', 'make-a-skin', 'texture-pack-not-working'],
  cta: 'Make a totem',
};
