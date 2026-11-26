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
    'Make a custom skin pack for Minecraft Bedrock on one screen: add your saved skins, PNGs, starter skins or a Java player’s skin, give each one a name and classic or slim arms, put them in order, then download them together as one ',
    code('.mcpack'),
    ' that Minecraft imports when you open it. You can also open a skin pack you already have and edit it. Free, with no account and nothing uploaded.',
  ],
  featureList: [
    'Build a Bedrock skin pack (.mcpack) on one screen, with a 3D figure of every skin',
    'Add saved skins, several PNGs at once (64×64, HD 128×128 or old 64×32), starter skins or a Java player’s skin',
    'A name and classic (4-pixel) or slim (3-pixel) arms for every skin, with the arms detected from the PNG',
    'Reorder skins by dragging or with the arrow buttons, and paint any of them in the skin editor',
    'Open an existing skin pack (.mcpack or .zip) to edit it',
    'Writes manifest.json, skins.json, the language file and a pack icon; downloading again updates the installed pack',
  ],
  features: [
    ['The pack is what you work on: every skin as a 3D figure, with its name, its arms and its place in the ', code('.mcpack'), '.'],
    ['Add saved skins, several PNGs at once (64×64, HD 128×128, or old 64×32 ones, converted for you), starter skins or any Java player’s skin by username.'],
    ['Mix classic (Steve, 4-pixel arms) and slim (Alex, 3-pixel arms) skins in one pack. For uploaded PNGs the arms are read from the picture.'],
    ['Drag skins into the order you want in the Dressing Room (or use the arrow buttons on a phone), and press Paint to change a skin in the skin editor.'],
    ['Open a skin pack you already have, from this site or anywhere else, and change it: its skins, names, arms, description and icon come in.'],
    [code('manifest.json'), ', ', code('skins.json'), ', the language file and a pack icon are written for you. Download again after a change and the installed pack updates instead of appearing twice.'],
  ],
  howTitle: 'How to make a skin pack',
  steps: [
    ['Add skins: ', strong('Upload PNGs'), ' (several at once), ', strong('Saved skins'), ', ', strong('Starter skins'), ' or a ', strong('Player’s skin'), ' by username. To change a pack you already have, choose ', strong('Open a skin pack'), ' and pick its ', code('.mcpack'), '.'],
    'Give every skin its name and pick Classic or Slim arms. Drag the skins, or use the arrows, into the order you want in the Dressing Room.',
    ['To change how a skin looks, press ', strong('Paint'), ': it opens in the skin editor, and ', strong('Back to the skin pack'), ' brings it back with your changes.'],
    ['Name the pack, add a description or pack icon if you like, and press ', strong('Download .mcpack'), '.'],
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
      id: 'edit',
      q: 'Can I edit an existing skin pack?',
      a: [el('p', null, 'Yes. Choose ', strong('Open a skin pack'), ' and pick its ', code('.mcpack'), ' or ', code('.zip'), '. Its skins come in with their names, arms, description and icon, ready to add, remove, rename, reorder or repaint. Download it again and the pack keeps its IDs with a higher version, so it replaces the installed copy.')],
    },
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
      a: [el('p', null, 'Yes. Pick Classic or Slim for every skin. For an uploaded PNG the maker reads which arms it was painted for, and points it out when the two don’t match.')],
    },
    {
      id: 'hd',
      q: 'Can a skin pack hold HD 128×128 skins?',
      a: [el('p', null, 'Yes. 64×64 and HD 128×128 skins can share a pack, and each one keeps its size. Upload an HD PNG, or switch a skin to HD in the skin editor.')],
    },
    {
      id: 'update',
      q: 'How do I update a skin pack I already imported?',
      a: [el('p', null, 'Change the pack in the Skin Pack Maker, download it again and open the new file. The pack keeps its IDs and gets a higher version number, so Minecraft replaces the old copy.')],
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
