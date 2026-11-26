// The skin editor's introduction in English, loaded on its own pages only (see ToolIntro
// in src/app/content/tools.ts).

import { el } from '../../markup';
import { code, figure, link, strong, toolCallout } from '../blocks';
import { SHOTS } from '../shots';
import type { ToolIntroBody } from '../tools';

export const INTRO: ToolIntroBody = {
  eyebrow: 'Skins',
  heading: 'Minecraft skin editor: make your own skin',
  appName: 'Minecraft Skin Editor',
  lead: [
    'Paint your character on the standard skin template while a 3D model updates live, then use it in ',
    strong('Java'),
    ' or ',
    strong('Bedrock'),
    '. Free, with no account needed. Making several skins for Bedrock? The ',
    link('/skin-pack-maker', 'skin pack maker'),
    ' puts them in one ',
    code('.mcpack'),
    '.',
  ],
  featureList: [
    'Paint on the 64×64 skin template with part outlines and a live 3D preview',
    'Classic (4-pixel arms) and slim (3-pixel arms) models',
    'True body mirroring: paint the left arm and the right arm follows',
    'Per-part locking and separate base and outer layer editing',
    'Start from a blank skin, a colour-coded template, starter characters, an uploaded PNG, a Java player name or the default skins from the game files',
    'Legacy 64×32 skins are converted when you open them',
    'Export a Java PNG (plus legacy 64×32) or a Bedrock skin pack (.mcpack) with one or more skins',
    'Paint in 2D on the template or directly on the 3D model, with body part toggles',
  ],
  features: [
    ['Paint on the 64×64 template with part outlines and a live 3D preview.'],
    ['Classic (4-pixel arms) and slim (3-pixel arms) models.'],
    ['True mirroring: paint the left arm and the right arm follows. Lock body parts and edit the base or outer layer on its own.'],
    ['Paint on the flat template or straight onto the 3D model, and hide body parts to reach every side.'],
    ['Start from a blank skin, a colour-coded template, original starter characters, an uploaded PNG, any Java player’s skin by username, or the default skins from the game files.'],
    ['Legacy 64×32 skins are converted to 64×64 when you open them.'],
    ['Export a Java ', code('.png'), ' (plus a legacy 64×32 copy for 1.7.10 and older), a Bedrock ', code('.png'), ' for the Dressing Room, or a whole set of skins as one ', code('.mcpack'), ' with the ', link('/skin-pack-maker', 'skin pack maker'), '.'],
  ],
  howTitle: 'How to make a skin here',
  steps: [
    'Pick a starting point and the arm style (classic or slim).',
    'Paint on the template or right onto the 3D model. Use the outer layer for hats, jackets, sleeves and other details that stick out.',
    'Turn the 3D preview around to check every side.',
    ['Export a ', code('.png'), ' for Java or a skin pack ', code('.mcpack'), ' for Bedrock.'],
    ['Java: add it in the Minecraft Launcher under ', strong('Skins'), '. Bedrock: open the ', code('.mcpack'), ', then choose it in the Dressing Room.'],
  ],
  faq: [
    {
      id: 'size',
      q: 'What size is a Minecraft skin?',
      a: [el('p', null, 'A 64×64 pixel PNG. Java 1.7.10 and older use the old 64×32 layout, and Bedrock also accepts 128×128 HD skins.')],
    },
    {
      id: 'slim',
      q: 'What is the difference between classic and slim skins?',
      a: [el('p', null, 'Only the arms: classic (Steve) arms are 4 pixels wide and slim (Alex) arms are 3 pixels wide. Choose the same model when you upload the skin, or the arms will look stretched or cut off.')],
    },
    {
      id: 'bedrock',
      q: 'How do I use my skin on Bedrock?',
      a: [
        el(
          'p',
          null,
          'Export a Bedrock skin pack and open the ',
          code('.mcpack'),
          '; it appears under Classic Skins in the Dressing Room. You can also import a single PNG there. Consoles cannot import skin files. ',
          link('/guides/make-a-skin', 'Full skin guide'),
          '.',
        ),
      ],
    },
    {
      id: 'pack',
      q: 'Can I put several skins in one Bedrock pack?',
      a: [
        el(
          'p',
          null,
          'Yes, with the ',
          link('/skin-pack-maker', 'Skin Pack Maker'),
          ': paint each skin as its own project, then choose ',
          strong('Bedrock skin pack (.mcpack)'),
          ' and tick the other skins to add. Every skin keeps its own name and classic or slim arms, and exporting again updates the installed pack instead of adding a copy.',
        ),
      ],
    },
    {
      id: 'trusted',
      q: 'Why do my friends see a default skin?',
      a: [el('p', null, 'On Bedrock, players who turn on ', strong('Only Allow Trusted Skins'), ' see custom skins as default ones. It is a setting on their side.')],
    },
  ],
  extra: () => [
    toolCallout('Making a skin pack?', ['Put several skins in one Bedrock ', code('.mcpack'), ', each with its own name, classic and slim mixed: the Skin Pack Maker builds it from the skins you paint here.'], { to: '/skin-pack-maker', label: 'Open the Skin Pack Maker', icon: 'package' }),
    el('div', { class: 'tool-intro-grid' }, figure(SHOTS.skin2d), figure(SHOTS.skin3d)),
  ],
  guides: ['make-a-skin', 'install-resource-packs', 'java-vs-bedrock-packs'],
  related: ['/skin-pack-maker', '/cape-maker', '/totem-maker'],
  cta: 'Start a skin',
};
