// The skin pack maker's introduction in English, loaded on its own pages only (see ToolIntro
// in src/app/content/tools.ts).

import { el } from '../../markup';
import { code, figure, link, strong } from '../blocks';
import { SHOTS } from '../shots';
import type { ToolIntroBody } from '../tools';

export const INTRO: ToolIntroBody = {
  base: 'skins',
  eyebrow: 'Skin packs',
  heading: 'Minecraft Custom Skin Pack Maker',
  appName: 'Minecraft Skin Pack Maker',
  lead: [
    'Make a custom skin pack for Minecraft Bedrock: paint or upload as many skins as you like, then download them together as one ',
    code('.mcpack'),
    ' that Minecraft imports when you open it. Classic and slim skins can share a pack, and it is free, with no account and nothing uploaded.',
  ],
  featureList: [
    'Bundle one or more skins into a single Bedrock skin pack (.mcpack)',
    'Classic (4-pixel arms) and slim (3-pixel arms) skins in the same pack',
    'Paint skins on the 64×64 template or directly on the 3D model',
    'Start from a template, an uploaded PNG, a Java player name or the default skins',
    'Writes manifest.json, skins.json and the language file for you',
    'Re-exporting keeps the pack IDs and raises the version, so the installed pack updates',
  ],
  features: [
    ['Put one skin or a whole set in a single ', code('.mcpack'), ', each with its own name.'],
    ['Mix classic (Steve, 4-pixel arms) and slim (Alex, 3-pixel arms) skins in one pack.'],
    ['Paint on the 64×64 template or right on the 3D model, with mirroring, part locks and both layers.'],
    ['Start from a blank or colour-coded template, an uploaded PNG (64×64 or legacy 64×32), any Java player’s skin by username, or the default skins.'],
    [code('manifest.json'), ', ', code('skins.json'), ' and the language file are written for you, with fresh unique IDs.'],
    ['Export again after a change and the installed pack updates instead of appearing twice.'],
  ],
  howTitle: 'How to make a skin pack',
  steps: [
    'Create a skin: pick a starting point and the arm style, then paint it. Every skin is saved on this device as its own project.',
    'Make the other skins you want in the pack the same way.',
    ['Open one of them, choose ', strong('Export'), ' › ', strong('Bedrock skin pack (.mcpack)'), ', name the pack and tick the other skins to include.'],
    ['Open the downloaded ', code('.mcpack'), ': double-click it on Windows, or tap it and choose Minecraft on Android, iPhone and iPad.'],
    ['In Minecraft go to ', strong('Dressing Room'), ' › ', strong('Classic Skins'), ', find your pack, pick a skin and press ', strong('Equip'), '.'],
  ],
  extra: (sub) => [
    el('div', { class: 'tool-intro-grid' }, figure(SHOTS.skinPack), figure(SHOTS.skin3d)),
    el(
      'div',
      { class: 'tool-intro-card' },
      el(sub, null, 'What is inside a Bedrock skin pack?'),
      el(
        'p',
        null,
        'A skin pack is a zip file renamed to ',
        code('.mcpack'),
        '. It holds a ',
        code('manifest.json'),
        ' (module type ',
        code('skin_pack'),
        '), a ',
        code('skins.json'),
        ' that lists every skin with the classic (',
        code('geometry.humanoid.custom'),
        ') or slim (',
        code('geometry.humanoid.customSlim'),
        ') model, the skin PNGs, and ',
        code('texts/en_US.lang'),
        ' with the pack and skin names. ',
        link('/guides/make-a-skin', 'More about skins and the template'),
        '.',
      ),
    ),
  ],
  faq: [
    {
      id: 'java',
      q: 'Do skin packs work on Java Edition?',
      a: [el('p', null, 'No. Skin packs are a Bedrock feature. On Java you use one skin at a time: export it as a ', code('.png'), ' from the ', link('/skins', 'skin editor'), ' and add it in the Minecraft Launcher.')],
    },
    {
      id: 'console',
      q: 'Can I use a custom skin pack on Xbox, PlayStation or Switch?',
      a: [el('p', null, 'No. Consoles cannot import skin packs or skin files. Windows, Android, iPhone and iPad can.')],
    },
    {
      id: 'slim',
      q: 'Can one pack hold classic and slim skins?',
      a: [el('p', null, 'Yes. Every skin keeps the arm model it was painted with, so classic and slim skins sit side by side in the same pack.')],
    },
    {
      id: 'hd',
      q: 'Can a skin pack hold HD 128×128 skins?',
      a: [el('p', null, 'Yes. 64×64 and HD 128×128 skins can share a pack, and each one keeps its size. Set Size to HD 128×128 before you start a skin, or switch an existing skin to HD in the editor.')],
    },
    {
      id: 'update',
      q: 'How do I update a skin pack I already imported?',
      a: [el('p', null, 'Change the skins and export the pack again, then open the new file. The pack keeps its IDs and gets a higher version number, so Minecraft replaces the old copy.')],
    },
    {
      id: 'where',
      q: 'Where do I find my skin pack in Minecraft?',
      a: [el('p', null, 'In the Dressing Room under Classic Skins, listed by the pack name you chose. If it is missing, open the ', code('.mcpack'), ' again and wait for the “Successfully imported” message.')],
    },
    {
      id: 'trusted',
      q: 'Why do my friends see a default skin?',
      a: [el('p', null, 'Players who turn on ', strong('Only Allow Trusted Skins'), ' see custom skins as default ones. It is a setting on their side.')],
    },
    {
      id: 'private',
      q: 'Are my skins uploaded anywhere?',
      a: [el('p', null, 'No. The skins and the pack are made in your browser and stay on your device until you share the file.')],
    },
  ],
  guides: ['make-a-bedrock-skin-pack', 'make-a-skin', 'install-resource-packs', 'java-vs-bedrock-packs'],
  related: ['/skins', '/cape-maker', '/totem-maker'],
  cta: 'Start a skin pack',
};
