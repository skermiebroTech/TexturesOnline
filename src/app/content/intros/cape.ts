// The cape maker's introduction in English, loaded on its own pages only (see ToolIntro
// in src/app/content/tools.ts).

import { el } from '../../markup';
import { code, link, strong } from '../blocks';
import type { ToolIntroBody } from '../tools';

export const INTRO: ToolIntroBody = {
  base: 'skins',
  eyebrow: 'Cape maker',
  heading: 'Minecraft Cape Maker',
  appName: 'Minecraft Cape Maker',
  lead: [
    'Design your own Minecraft cape and elytra: paint the 64×32 cape texture while a 3D player wears it, start from one of twelve designs, then download the ',
    code('.png'),
    ' or an elytra texture pack. Free, in your browser, with nothing uploaded.',
  ],
  featureList: [
    'Paint the 64×32 cape texture: the outside, inside and edges of the cape and both faces of the elytra',
    'Pencil, eraser, fill, eyedropper, lines, shapes, shading, noise, selection and mirror painting, with undo',
    'Live 3D preview on a player, as a cape or as elytra, standing, walking, running or flying',
    'Twelve starter designs, and cape PNGs opened from a file (64×32, HD sizes, OptiFine 46×22)',
    'Copy the cape design onto the elytra in one click',
    'Download the cape PNG for mods and clients that take a cape picture',
    'Elytra texture pack for Java 1.9 and newer (.zip) or Bedrock (.mcpack) that works without mods',
    'Wear the cape in the skin editor’s pose maker and save pictures',
  ],
  features: [
    ['Paint the 64×32 cape texture with part outlines: the outside of the cape (what people see behind you), its inside and edges, and both faces of the elytra.'],
    ['The skin editor’s tools: pencil, eraser, fill, eyedropper, lines, shapes, lighten and darken, noise, selection and mirror painting, with undo.'],
    ['A live 3D player wears it as a cape or as elytra, standing, walking, running or flying. Pick one of your own skins to see them together.'],
    ['Start from twelve designs (stripes, night sky, flames, a heart…) or open a cape ', code('.png'), ': 64×32, HD 128×64 and larger, or OptiFine’s 46×22.'],
    ['Copy the cape onto the elytra in one click, then change it if you like.'],
    ['Download the cape ', code('.png'), ', or an elytra texture pack: a ', code('.zip'), ' for Java 1.9 and newer or a Bedrock ', code('.mcpack'), '.'],
    ['Wear it in the skin editor’s pose maker, pose your skin and save a picture.'],
  ],
  howTitle: 'How to make a cape',
  steps: [
    'Start from a design, or paint the empty template. The big face on the left is the outside of the cape, the one people see behind you.',
    ['Paint the inside and the edges too, then press ', strong('Copy cape onto elytra'), ', or paint the elytra faces yourself.'],
    ['Turn the 3D player around, switch between ', strong('Cape'), ' and ', strong('Elytra'), ' and try the flying animation.'],
    ['Download the ', code('.png'), ' for a cape mod, or the elytra texture pack for Java or Bedrock.'],
  ],
  extra: (sub) => [
    el(
      'div',
      { class: 'tool-intro-card' },
      el(sub, null, 'What custom capes can and can’t do'),
      el('p', null, strong('Java Edition:'), ' the game only shows official capes from Mojang, chosen in the Minecraft Launcher or on minecraft.net. You can’t upload your own picture there. A custom cape needs a mod or client with its own cape service, and only players using the same mod see it.'),
      el('p', null, strong('Bedrock Edition:'), ' capes are Character Creator items you earn or get with official packs. ', code('skins.json'), ' can name a cape, but Mojang’s skin pack guide doesn’t list that field, and Mojang’s own pack checker reports a cape in any skin pack that isn’t Mojang’s as an error. So the ', link('/skin-pack-maker', 'skin pack maker'), ' leaves capes out.'),
      el('p', null, strong('No mods:'), ' a texture pack can change how the elytra looks, on Java 1.9 and newer and on Bedrock. Everyone using the pack sees your design. Players who wear a cape show the cape’s design on their elytra instead.'),
    ),
  ],
  faq: [
    {
      id: 'vanilla',
      q: 'Can I get a custom cape without mods?',
      a: [
        el(
          'p',
          null,
          'Not as a cape: Java Edition only shows official capes from Mojang, and Bedrock capes are Character Creator items. What works without mods is the elytra: download the elytra texture pack and everyone who uses it sees your design.',
        ),
      ],
    },
    {
      id: 'java',
      q: 'How do I wear a custom cape on Java?',
      a: [
        el(
          'p',
          null,
          'With a mod or client that has its own cape service and takes a cape picture: upload the ',
          code('.png'),
          ' there. Only players with the same mod see it. OptiFine capes come with a donation and are designed from banner patterns on OptiFine’s website, so a picture can’t be used for them.',
        ),
      ],
    },
    {
      id: 'bedrock',
      q: 'Can I add a custom cape to a Bedrock skin pack?',
      a: [el('p', null, 'Not one that Mojang supports. ', code('skins.json'), ' can name a cape, but that field is missing from Mojang’s skin pack guide, and Mojang’s own pack checker reports a cape in any skin pack that isn’t Mojang’s as an error. That is why the skin pack maker leaves capes out.')],
    },
    {
      id: 'size',
      q: 'What size is a Minecraft cape?',
      a: [el('p', null, 'A 64×32 PNG. The cape uses the top-left 22×17 pixels (the 10×16 outside and inside, the edges, top and bottom) and the elytra the 24×22 area next to it. HD capes are multiples such as 128×64; OptiFine uses 46×22.')],
    },
    {
      id: 'private',
      q: 'Is my cape uploaded anywhere?',
      a: [el('p', null, 'No. It is painted and saved in your browser, and the files are made on your device.')],
    },
  ],
  guides: ['make-a-skin', 'install-resource-packs', 'make-a-bedrock-skin-pack'],
  cta: 'Make a cape',
};
