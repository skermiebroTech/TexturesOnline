// Guide pages (/guides/ and /guides/<slug>/) as markup trees: prerendered at build time, rendered
// to DOM by guides.ts, and turned into HowTo / FAQPage / TechArticle data and llms-full.txt.
// Facts come from the app's own data (pack formats, version rules) and the project's research
// notes on Java and Bedrock packs, Vibrant Visuals and shader packs.
// The English text is GUIDE_CONTENT; a translation gives a guide the same GuideText
// (src/i18n/<lang>/guides.ts) and its title and description in src/i18n/<lang>/meta.ts.

import type { IconName } from '../../ui/icons';
import { el, ic, type Child, type ElNode } from '../../app/markup';
import { anchor, breadcrumbs, callout, code, ext, faqList, figure, folderTable, gameMessage, link, steps, strong, tabbed, toolCallout, uiPath, type FaqItem, type Shot } from '../../app/content/blocks';
import { SHOTS } from '../../app/content/shots';
import { guideCards } from '../../app/content/guide-cards';
import { GUIDES, GUIDES_META, guideMeta, guidesIn, pageMeta, type GuideMeta } from '../../app/seo/meta';
import { CONTENT_UPDATED, SITE_NAME } from '../../app/site';
import { F, LATEST, MIN_ENGINE, NEXT_SNAPSHOT, formatGroups, formatParts, maxFormat, mcmetaFor, mcmetaLegacy, mcmetaRange, minFormat } from '../../app/content/facts';
import type { Locale } from '../../i18n/locales';
import { ui } from '../../i18n/ui';
import { contentOf, hasContent } from '../../i18n/content';
import { SKIN_PACK_LANG, SKIN_PACK_MANIFEST, SKIN_PACK_SKINS_JSON, SKIN_PACK_TREE } from './skin-pack-files';
import { MODEL_BLOCK_EXAMPLE, MODEL_FILES, MODEL_FLAT_DEFINITION, MODEL_SPRITE_CUBE, MODEL_STONE_BLOCKSTATE } from './model-files';
import { PVP_EXAMPLE_FILES, PVP_SWORD_189, PVP_SWORD_LATEST } from './pvp-files';
import { PBR_MANIFEST, PBR_TEXTURE_SET, PBR_UNIFORM_SET } from './pbr-files';
import { NAMES_CIT, NAMES_DEFINITION, NAMES_MODEL } from './names-files';
import { ANIM_FLIPBOOK, ANIM_MCMETA, ANIM_MCMETA_WIDE } from './anim-files';

export { BEDROCK_MIN_ENGINE, formatGroups } from '../../app/content/facts';

export interface GuideSection {
  id: string;
  title: string;
  body: Child[];
}

export interface Guide {
  meta: GuideMeta;
  /** Opening paragraph: the direct answer */
  intro: Child[];
  /** Main screenshot (link previews and the article's structured data) */
  image?: Shot;
  /** Short numbered answer shown in a box under the intro */
  quick?: { title: string; items: Child[] };
  sections: GuideSection[];
  /** Steps for the HowTo structured data (also shown in one of the sections) */
  howto?: { name: string; steps: Child[] };
  faq?: FaqItem[];
  related: string[];
  cta?: { label: string; to: string; icon: IconName };
}

/** The translatable part of a guide (its title and description are in the meta translations). */
export interface GuideText {
  intro: Child[];
  image?: Shot;
  quick?: Guide['quick'];
  sections: GuideSection[];
  howto?: Guide['howto'];
  faq?: FaqItem[];
  /** Text of the call-to-action button */
  ctaLabel?: string;
}

/** Texts of the /guides/ index. */
export interface GuidesIndexText {
  eyebrow: string;
  title: string;
  lead: string;
  /** Closing line with a link to the help page */
  more: Child[];
}

const meta = (slug: string): GuideMeta => {
  const g = GUIDES.find((x) => x.slug === slug);
  if (!g) throw new Error(`Unknown guide ${slug}`);
  return g;
};

const p = (...c: Child[]): ElNode => el('p', null, ...c);
const ul = (items: Child[]): ElNode => el('ul', { class: 'guide-list' }, items.map((i) => el('li', null, i)));
const pre = (text: string): ElNode => el('pre', { class: 'guide-code' }, el('code', null, text));
const table = (head: string[], rows: Child[][], cls = 'guide-table'): ElNode =>
  el(
    'div',
    { class: 'table-scroll' },
    el(
      'table',
      { class: cls },
      el('thead', null, el('tr', null, head.map((h) => el('th', { scope: 'col' }, h)))),
      el('tbody', null, rows.map((r) => el('tr', null, r.map((c, i) => (i === 0 ? el('th', { scope: 'row' }, c) : el('td', null, c)))))),
    ),
  );


// ---------------------------------------------------------------- guides

const MAKE_PACK_STEPS: Child[] = [
  ['Open the ', link('/textures', 'Texture Pack Maker'), ', name your pack and choose Java or Bedrock, the game version you play and a resolution, then click ', strong('Create pack'), '.'],
  'Find a texture with the search box or the categories and repaint it in the pixel editor, or upload your own PNG.',
  'Optional: restyle the whole pack with one-click effects such as Dark Mode, Pastel or Retro 8-bit.',
  ['Open the ', strong('Pack'), ' tab to set the description and icon, then export a ', code('.zip'), ' (Java) or an ', code('.mcpack'), ' (Bedrock).'],
  ['Install the pack in Minecraft and test it. ', link('/guides/install-resource-packs', 'How to install it'), '.'],
];

const INSTALL_JAVA_STEPS: Child[] = [
  ['Start Minecraft Java Edition and open ', uiPath('Options…', 'Resource Packs…'), '.'],
  ['Click ', uiPath('Open Pack Folder'), '. The ', code('resourcepacks'), ' folder opens.'],
  ['Drop the pack’s ', code('.zip'), ' into the folder (keep it zipped). You can also drag it onto the Resource Packs screen.'],
  ['Move the pack from ', strong('Available'), ' to ', strong('Selected'), ' with the arrow, and put it at the top if you use several packs. Click ', strong('Done'), '.'],
];

const SKIN_STEPS: Child[] = [
  ['Open the ', link('/skins', 'Skin Maker'), ' and pick a starting point: a blank skin, a colour-coded template, a starter character, a PNG you already have, a Java player’s skin by username, or one of the default skins.'],
  'Choose the arm style: classic (4 pixels wide) or slim (3 pixels wide).',
  'Paint on the 64×64 template or switch to 3D and paint right on the model, hiding body parts to reach the sides underneath. Use mirroring to paint both arms or legs at once, and lock parts you have finished.',
  'Add depth with the outer layer: hats, hair, jackets, sleeves and trouser legs sit slightly above the body.',
  ['Export a ', code('.png'), ' for Java (add a legacy 64×32 copy for 1.7.10 and older) or a skin pack ', code('.mcpack'), ' for Bedrock.'],
  'Upload it: in the Minecraft Launcher (Java) or by opening the .mcpack and choosing it in the Dressing Room (Bedrock).',
];

const SKIN_PACK_STEPS: Child[] = [
  ['Open the ', link('/skin-pack-maker', 'Skin Pack Maker'), ' and start a skin: a blank or colour-coded template, a PNG you already have, a Java player’s skin by username, or one of the default skins. Pick classic (4-pixel) or slim (3-pixel) arms.'],
  'Paint it on the 64×64 template or right on the 3D model. Every skin is saved on your device as its own project, and its name is the name players see in the game.',
  'Make the other skins for the pack the same way.',
  ['Open one of them, choose ', strong('Export'), ' › ', strong('Bedrock skin pack (.mcpack)'), ', name the pack, tick the other skins to include and press ', strong('Download pack'), '.'],
  ['Open the ', code('.mcpack'), ' on Windows, Android, iPhone or iPad. Minecraft imports it.'],
  ['In Minecraft go to ', uiPath('Dressing Room', 'Classic Skins'), ', find your pack, pick a skin and press ', strong('Equip'), '.'],
];

const VANILLA_SHADER_STEPS: Child[] = [
  ['Open the ', link('/shaders', 'Shader Maker'), ' and choose ', strong('Vanilla Java'), '.'],
  'Pick the exact Minecraft version you play (Java 1.17 or newer; 26.3 is the default).',
  'Start from a preset and adjust brightness, contrast, colour, vignette and fog while the preview updates.',
  ['Export the ', code('.zip'), ' and install it like any resource pack: ', uiPath('Options…', 'Resource Packs…', 'Open Pack Folder'), '.'],
];

const CONVERT_STEPS: Child[] = [
  ['Open the ', link('/texture-pack-converter', 'Texture Pack Converter'), ' and choose your pack: a Java ', code('.zip'), ', a Bedrock ', code('.mcpack'), ' or PNG textures.'],
  ['Pick what to convert it to: ', strong('Bedrock Edition'), ', or ', strong('Java Edition'), ' and a version.'],
  ['Click ', strong('Convert'), '. Your browser loads the target edition’s texture list and converts every texture it can.'],
  'Read the report: how many textures were converted, and which were skipped and why.',
  ['Download the converted pack, or open it in the editor to repaint the skipped textures first.'],
];

const MERGE_STEPS: Child[] = [
  ['Open ', link('/merge-texture-packs', 'Merge Texture Packs'), ' and add two to eight Java ', code('.zip'), ' or Bedrock ', code('.mcpack'), ' packs.'],
  'Put them in order by dragging, or with the arrow buttons. The pack at the top wins wherever two packs change the same file.',
  'Name the merged pack and pick its icon. For Java, pick the version you play.',
  ['Click ', strong('Merge'), ' and check the list of conflicts.'],
  'Download the merged pack, or open it in the editor to keep working on it.',
];

const VV_STEPS: Child[] = [
  ['Make a pack with the ', link('/shaders', 'Shader Maker'), ' (choose ', strong('Bedrock Vibrant Visuals'), ') and export the ', code('.mcpack'), '.'],
  'Open the file. Minecraft imports it automatically.',
  ['Go to ', uiPath('Settings', 'Global Resources', 'My Packs'), ' and activate the pack. Deactivate classic texture packs that do not support Vibrant Visuals.'],
  ['Open ', uiPath('Settings', 'Video'), ' and set ', strong('Graphics Mode'), ' to ', strong('Vibrant Visuals'), '.'],
];

const MODEL_STEPS: Child[] = [
  ['Open the ', link('/textures', 'Texture Pack Maker'), ' and create a ', strong('Java'), ' pack for the version you play: 1.8 or newer, or 1.21.4 or newer to keep the item flat in the inventory.'],
  ['Switch the list to ', strong('Items'), ' and open the item, for example the diamond sword. In the ', strong('Preview'), ' tab, press ', strong('Edit shape'), '.'],
  ['Pick ', strong('3D item from sprite'), '. Every pixel of the flat picture becomes part of a cube one pixel deep.'],
  ['Change the shape: click a cube in the 3D view or the list, then move it, resize it, copy it or add new ones. Under ', strong('Faces'), ', give a face another texture or another part of one.'],
  ['Open ', strong('Display'), ' and check the model in the inventory, in first and third person, on the ground, in an item frame and on the head. Change the rotation, position or size where it looks wrong.'],
  ['Optional, on 1.21.4 and newer: in the ', strong('Model'), ' tab, turn on ', strong('Flat in the inventory'), ' to keep the flat icon there and show the 3D model in hand.'],
  ['Press ', strong('Done'), ', export the pack as a ', code('.zip'), ', put it in your ', code('resourcepacks'), ' folder and test it in game.'],
];

const PVP_STEPS: Child[] = [
  ['Open the ', link('/textures', 'Texture Pack Maker'), ', name your pack and pick ', strong('PvP / FPS pack'), '. Turn on ', strong('Also an FPS pack'), ' for 8× textures and no animations.'],
  ['Choose Java or Bedrock and the version you play, for example Java 1.8.9 for 1.8 PvP servers, then press ', strong('Create PvP pack'), '.'],
  ['The editor loads that version’s textures and switches on the PvP preset: low fire, clear glass, no pumpkin blur, a cleaner crosshair, smaller swords and a lower shield, where the version has them.'],
  ['In the ', strong('PvP'), ' tab, change what you like: the fire height, the crosshair design, the sword size, the shield height. Every change can be undone from its message.'],
  'Optional: paint anything else, such as clearer wool colours or a shorter sword texture.',
  ['Press ', strong('Export'), ', put the pack in Minecraft and select it above your other packs.'],
];

const PBR_STEPS: Child[] = [
  ['Open the ', link('/textures', 'Texture Pack Maker'), ' and make a pack for Java or Bedrock, or open one you have.'],
  'Pick a block or item texture, for example diamond ore, and open the Material tab next to Preview.',
  ['Choose a quick material such as ', strong('Metal'), ', ', strong('Glass'), ' or ', strong('Glowing spots'), '. The lit 3D block shows it under a moving sun.'],
  ['Fine-tune ', strong('Shine'), ', ', strong('Metal'), ', ', strong('Glow'), ' and ', strong('Light through'), ' for the whole texture, or add a part (colourful, bright or dark pixels, some colours or an area you select) with values of its own.'],
  ['Switch on ', strong('Bumps from the colours'), ' and set the strength, then use ', strong('Use on similar textures'), ' to give every ore, plank or log the same material.'],
  ['Press ', strong('Export'), '. Java gets ', code('_n.png'), ' and ', code('_s.png'), ' next to each texture, Bedrock gets texture sets and the ', code('pbr'), ' capability.'],
];

const NAMES_STEPS: Child[] = [
  ['Open the ', link('/textures', 'Texture Pack Maker'), ' and make a Java pack, or open one you have.'],
  ['Open an item’s texture, for example the diamond sword, and choose ', strong('Name-based textures'), ' in its menu (⋮), or ', strong('Names'), ' under the 3D preview.'],
  ['Type the name, for example ', strong('Excalibur'), '. Add more names if they should share the texture.'],
  ['Press ', strong('Create and paint'), '. The new texture starts as a copy of the item’s, so paint over it. ', strong('3D shape'), ' gives it a model of its own too.'],
  ['Press ', strong('Export'), ', install the pack, rename the item in an anvil to exactly that name, and hold it.'],
];

const ANIM_STEPS: Child[] = [
  ['Open the ', link('/textures', 'Texture Pack Maker'), ' and make a pack, or open one you have.'],
  ['Open a block or item texture and choose ', strong('Make animated'), ' in its menu (⋮). It gets two frames, and a strip of frames appears under the canvas.'],
  ['Paint each frame. ', strong('+'), ' adds a copy of the selected frame; the ⋯ menu duplicates, copies, pastes, moves and deletes frames. Turn on the onion skin to see the frame before faintly while you paint.'],
  ['Press the clock for ', strong('Timing'), ': how many ticks each frame shows (20 ticks are 1 second), times for single frames and ', strong('Blend frames'), '. Press play to watch it at game speed.'],
  ['Press ', strong('Export'), '. Java packs get the strip with its ', code('.png.mcmeta'), ', Bedrock packs a ', code('flipbook_textures.json'), ' entry.'],
];

export const GUIDE_CONTENT: Guide[] = [
  // ------------------------------------------------------------ make a texture pack
  {
    meta: meta('make-a-texture-pack'),
    image: SHOTS.editor,
    intro: [
      p(
        'A Minecraft texture pack swaps the game’s pictures (blocks, items, mobs, the sky and the menus) for your own. Java Edition calls texture packs ',
        el('em', null, 'resource packs'),
        ': a ',
        code('.zip'),
        ' with a ',
        code('pack.mcmeta'),
        ' file and PNG images at the same paths as the originals. Bedrock uses ',
        code('.mcpack'),
        ' files with a ',
        code('manifest.json'),
        '. You can make either in your browser in a few minutes.',
      ),
    ],
    quick: {
      title: 'The short version',
      items: [
        'Choose Java or Bedrock and the version you play.',
        'Repaint textures, upload your own images or apply a one-click effect.',
        'Export the pack and drop it into Minecraft.',
      ],
    },
    howto: { name: 'How to make a Minecraft texture pack with Texture Pack Maker', steps: MAKE_PACK_STEPS },
    sections: [
      {
        id: 'step-1',
        title: 'Step 1 — Create the pack and pick your version',
        body: [
          p(MAKE_PACK_STEPS[0]),
          ul([
            [strong('Edition: '), 'Java Edition (PC, Mac and Linux from the Minecraft Launcher) or Bedrock Edition (Windows, phones, tablets and consoles). The two need different files, so make one project per edition. ', link('/guides/java-vs-bedrock-packs', 'Which one do I have?')],
            [strong('Version: '), 'Java ', LATEST, ' is selected by default; every release back to 1.6.1 works, so you can make a pack for 1.21.11, 26.2 or 1.8.9 just as easily. The pack gets the right ', code('pack.mcmeta'), ' for that version.'],
            [strong('Resolution: '), '16× is the vanilla look (16×16 pixels per block face). 32× and 64× leave room for more detail; 128× and up are for realistic packs.'],
          ]),
          p('Your browser then downloads that version’s original textures straight from Mojang and keeps them on your device, so the next pack starts instantly.'),
          figure(SHOTS.newPack),
        ],
      },
      {
        id: 'step-2',
        title: 'Step 2 — Find and repaint textures',
        body: [
          p(MAKE_PACK_STEPS[1]),
          p(
            'Every texture is shown on its real 3D model: a furnace shows its front, sides and top, stairs and slabs show their shape, and mobs show their body parts. Paint with the pencil, fill, line, shapes, noise and colour picker, mirror your strokes, and undo anything. The tiled preview shows how a block repeats across the ground, so seams do not show.',
          ),
          p(
            'Prefer to see the block as you paint? Switch the editor to ',
            strong('3D'),
            ' (or press D) and paint straight onto the model: each face paints the texture it shows. Drag the background or use two fingers to turn the block. Mob textures work the same way: choose Mobs in the texture list and hide body parts to reach the sides underneath.',
          ),
          p(
            'On Java you can change shapes too: press ',
            strong('Edit shape'),
            ' in the Preview tab to turn a flat item into a 3D one or reshape a block. ',
            link('/guides/make-3d-items-texture-pack', 'How to make 3D items'),
            '.',
          ),
          p('Making a pack for PvP or more FPS? Pick ', strong('PvP / FPS pack'), ' when you create it, and the editor switches on low fire, clear glass, a cleaner crosshair and smaller swords for you. ', link('/guides/make-a-pvp-texture-pack', 'How to make a PvP texture pack'), '.'),
          ul([
            'Start with blocks you see all the time: grass, dirt, stone, logs and planks.',
            'Grass, leaves, vines and water are stored in grey and coloured by the game per biome. Keep them light grey.',
            'Animated textures, such as water, lava and sea lanterns, can be edited frame by frame.',
          ]),
          figure(SHOTS.editor),
          figure(SHOTS.paint3d),
        ],
      },
      {
        id: 'step-3',
        title: 'Step 3 — Restyle the whole pack in one click (optional)',
        body: [
          p(MAKE_PACK_STEPS[2]),
          p('Effects stack on top of each other and on top of your own painting without changing it, and are applied to every texture when you export. Combine Autumn with Smooth HD, or Dark Mode with a Neon Outline, then keep painting by hand.'),
          figure(SHOTS.effects),
        ],
      },
      {
        id: 'step-4',
        title: 'Step 4 — Add an icon and description, then export',
        body: [
          p(MAKE_PACK_STEPS[3]),
          p(
            'On Java you can also choose a compatibility range, so one pack loads on several versions without the “made for an older version” warning. The export writes every file the game needs: ',
            code('pack.mcmeta'),
            ' and ',
            code('pack.png'),
            ' on Java, or ',
            code('manifest.json'),
            ' with fresh unique IDs and ',
            code('pack_icon.png'),
            ' on Bedrock.',
          ),
          figure(SHOTS.packSettings),
          figure(SHOTS.export),
        ],
      },
      {
        id: 'step-5',
        title: 'Step 5 — Install and test it',
        body: [
          p(MAKE_PACK_STEPS[4]),
          ul([
            ['Java: open ', uiPath('Options…', 'Resource Packs…', 'Open Pack Folder'), ', drop the ', code('.zip'), ' in (keep it zipped) and move the pack to ', strong('Selected'), '. Press F3 + T in game to reload after changes.'],
            ['Bedrock: open the ', code('.mcpack'), ', then activate it under ', uiPath('Settings', 'Global Resources'), '.'],
          ]),
          p('Something looks wrong? ', link('/guides/texture-pack-not-working', 'Texture pack not working: fixes'), '.'),
        ],
      },
      {
        id: 'inside',
        title: 'What is inside a texture pack?',
        body: [
          el('h3', { class: 'guide-sub' }, 'Java Edition (.zip)'),
          ul([
            [code('pack.mcmeta'), ' at the root of the zip (required): the pack’s description and the game versions it is made for.'],
            [code('pack.png'), ' (optional): the icon in the pack list. Minecraft’s own is 128×128 and it is drawn at 32×32.'],
            [code('assets/minecraft/textures/…'), ': your images, with the same folders and file names as the originals, for example ', code('assets/minecraft/textures/block/stone.png'), '. Versions before 1.13 use the folders ', code('blocks'), ' and ', code('items'), ' instead of ', code('block'), ' and ', code('item'), '.'],
            ['Animated textures have a matching ', code('.png.mcmeta'), ' file next to the image.'],
          ]),
          el('h3', { class: 'guide-sub' }, 'Bedrock Edition (.mcpack)'),
          ul([
            [code('manifest.json'), ' at the root (required): the name, two unique IDs, a version number that goes up with every update, and the oldest game version the pack supports (', code(`"min_engine_version": ${MIN_ENGINE}`), ' by default here).'],
            [code('pack_icon.png'), ' (optional): the pack’s icon.'],
            ['Textures under ', code('textures/'), ', for example ', code('textures/blocks/stone.png'), '. Some vanilla textures are ', code('.tga'), ' files; keep the same name and extension as the original.'],
          ]),
          callout('tip', 'File names matter', 'Minecraft only replaces a texture when your file has exactly the same path as the original. On Java, paths must be lowercase (a-z, 0-9, _ - . and /). The Texture Pack Maker handles this for you.'),
          el('h3', { class: 'guide-sub' }, 'Folder layout side by side'),
          pre(
            [
              'Java: MyPack.zip',
              '├── pack.mcmeta',
              '├── pack.png',
              '└── assets/minecraft/textures/',
              '    ├── block/stone.png',
              '    └── item/diamond_sword.png',
              '',
              'Bedrock: MyPack.mcpack',
              '├── manifest.json',
              '├── pack_icon.png',
              '└── textures/',
              '    ├── blocks/stone.png',
              '    └── items/diamond_sword.png',
            ].join('\n'),
          ),
          table(
            ['', 'Java pack.mcmeta', 'Bedrock manifest.json'],
            [
              ['Required', 'Yes, at the top of the zip', 'Yes, at the top of the .mcpack'],
              ['Identifies the pack by', 'Its file or folder name', 'Two unique IDs (UUIDs)'],
              ['Game version', 'Pack format numbers (26.3 uses ' + F(LATEST) + ')', [code('min_engine_version'), ', the oldest game version supported']],
              ['Updates', 'Replace the file', 'Raise the version number, keep the IDs'],
            ],
          ),
        ],
      },
      {
        id: 'mcmeta',
        title: 'The pack.mcmeta file (Java)',
        body: [
          p(
            'This file tells Minecraft which versions the pack is for. The format number changes with almost every update: Java ',
            LATEST,
            ' uses resource pack format ',
            strong(F(LATEST)),
            '. A pack made only for ',
            LATEST,
            ' looks like this:',
          ),
          pre(mcmetaFor(LATEST, `My pack for Minecraft ${LATEST}`)),
          p(
            'Since 1.21.9 packs name a range with ',
            code('min_format'),
            ' and ',
            code('max_format'),
            '. A pack that also has to load on older versions needs ',
            code('pack_format'),
            ' and ',
            code('supported_formats'),
            ' as well. The Texture Pack Maker writes the right combination for the version and range you choose. See ',
            link('/guides/minecraft-pack-format-versions', 'every version’s pack format'),
            '.',
          ),
          callout('warn', 'Missing description?', 'On Java 26.3 a pack whose pack.mcmeta has no description, or is not valid JSON, is not listed at all. Keep pack.mcmeta at the top level of the zip, not inside a folder.'),
        ],
      },
      {
        id: 'by-hand',
        title: 'Making a texture pack by hand',
        body: [
          p('You can also build a pack yourself with any image editor. It takes longer, but it shows how a pack works:'),
          el('h3', { class: 'guide-sub' }, 'Java Edition'),
          steps([
            ['Find the original textures: copy ', code('versions/<version>/<version>.jar'), ' from your ', code('.minecraft'), ' folder, rename the copy to ', code('.zip'), ' and open it. The images are in ', code('assets/minecraft/textures'), '.'],
            ['Make a new folder for your pack with a ', code('pack.mcmeta'), ' (see below) and the same ', code('assets/minecraft/textures/…'), ' folders as the originals.'],
            'Copy in only the PNGs you want to change and edit them, keeping their names and sizes in proportion (16×16, 32×32 and so on).',
            ['Zip the ', strong('contents'), ' of the folder, not the folder itself, so ', code('pack.mcmeta'), ' sits at the top of the zip. Drop the zip into ', code('resourcepacks'), '.'],
          ]),
          el('h3', { class: 'guide-sub' }, 'Bedrock Edition'),
          steps([
            ['Get the original textures from Mojang’s ', ext('https://github.com/Mojang/bedrock-samples', 'bedrock-samples'), ' repository (', code('resource_pack/textures'), ').'],
            ['Make a folder with a ', code('manifest.json'), ' holding two new unique IDs (UUIDs) and your edited images under ', code('textures/'), '.'],
            ['Zip the folder’s contents and rename the file from ', code('.zip'), ' to ', code('.mcpack'), ', then open it to import.'],
          ]),
          callout('tip', 'Skip the busywork', 'The Texture Pack Maker does the copying, folder names, pack.mcmeta, UUIDs and zipping for you, and shows each texture on its 3D model while you paint.'),
        ],
      },
      {
        id: 'tips',
        title: 'Tips for a good pack',
        body: [
          ul([
            'Start small: repaint a few blocks you see all the time (grass, dirt, stone, wood) and test in game before doing everything.',
            'Keep the resolution the same across the pack. Mixing 16× and 64× textures looks uneven.',
            'Use the 3D block preview to check how the sides of a block line up.',
            'Use the tiled preview for blocks that repeat, so seams do not show.',
            'Put your pack at the top of the Selected list. Packs higher in the list win.',
          ]),
        ],
      },
    ],
    faq: [
      {
        id: 'both',
        q: 'Does one texture pack work on Java and Bedrock?',
        a: [p('No. The two editions use different files and folders. Make the pack for one edition, then turn it into the other with the ', link('/texture-pack-converter', 'Texture Pack Converter'), '. ', link('/guides/java-vs-bedrock-packs', 'Java vs Bedrock packs'), '.')],
      },
      {
        id: 'free',
        q: 'Do I need to install any software?',
        a: [p(`No. ${SITE_NAME} runs in your browser on a computer, phone or tablet, and nothing is uploaded.`)],
      },
      {
        id: 'edit',
        q: 'Can I change an existing texture pack?',
        a: [p('Yes. In the Texture Pack Maker choose ', strong('Open a pack'), ' and pick a ', code('.zip'), ' or ', code('.mcpack'), '. You can keep editing it and export again.'), figure(SHOTS.openPack)],
      },
      {
        id: 'code',
        q: 'Do I need to know how to code to make a texture pack?',
        a: [p('No. A texture pack is images plus one small description file, and the Texture Pack Maker writes that file for you. You only need to paint.')],
      },
      {
        id: 'older',
        q: 'How do I make a texture pack for an older version, like 1.21.11 or 1.8.9?',
        a: [p('Pick that version when you create the pack. The maker loads that version’s own textures and folder names and writes its pack format. ', link('/guides/minecraft-pack-format-versions', 'Pack formats of every version'), '.')],
      },
      {
        id: 'originals',
        q: 'Where do I find the original Minecraft textures?',
        a: [p('Inside the game’s ', code('.jar'), ' file for Java (', code('assets/minecraft/textures'), ') and in Mojang’s bedrock-samples repository for Bedrock. The Texture Pack Maker loads them for you from Mojang when you pick a version.')],
      },
      {
        id: 'mobile',
        q: 'Can I make a texture pack on my phone?',
        a: [p('Yes. The Texture Pack Maker works in the browser on Android, iPhone and iPad as well as on computers and Chromebooks. On Bedrock, open the exported ', code('.mcpack'), ' and Minecraft imports it.')],
      },
      {
        id: 'time',
        q: 'How long does it take to make a texture pack?',
        a: [p('A few minutes for a small pack that changes a handful of blocks, or for a whole-pack effect such as Dark Mode. A complete hand-painted pack with hundreds of textures can take weeks; you can export and test it at any point along the way.')],
      },
      {
        id: 'hd',
        q: 'What resolution should my texture pack be?',
        a: [p('16× matches the vanilla game and is the quickest to paint. 32× and 64× leave room for more detail; 128× and up are for realistic packs and need a stronger computer. Keep one resolution across the whole pack.')],
      },
    ],
    related: ['install-resource-packs', 'texture-pack-not-working', 'minecraft-pack-format-versions', 'java-vs-bedrock-packs'],
    cta: { label: 'Open the Texture Pack Maker', to: '/textures', icon: 'image' },
  },

  // ------------------------------------------------------------ troubleshooting
  {
    meta: meta('texture-pack-not-working'),
    image: SHOTS.packSettings,
    intro: [
      p(
        'Most texture pack problems come from three things: the pack’s description file (',
        code('pack.mcmeta'),
        ' on Java, ',
        code('manifest.json'),
        ' on Bedrock) is missing or in the wrong place, the pack was made for a different game version, or a texture is not at exactly the path Minecraft looks for. Find what you see below and apply the fix, or look up the ',
        anchor('error-messages', 'exact error message'),
        '.',
      ),
      toolCallout(
        'Let Pack Doctor find the problem',
        ['Drop the pack into ', link('/pack-doctor', 'Pack Doctor'), ': it checks every file against the version you play, explains each problem it finds and fixes the safe ones in one click, then gives you the fixed pack.'],
        { to: '/pack-doctor', label: 'Check my pack', icon: 'potion' },
      ),
    ],
    quick: {
      title: 'Check these first',
      items: [
        ['Java: the zip opens straight onto ', code('pack.mcmeta'), ' and ', code('assets'), ', not onto a folder.'],
        'The pack was made for the version you play (or its compatibility range includes it).',
        'The pack is in the Selected (Java) or active (Bedrock) list, above packs that change the same textures.',
        'File names and folders match the originals exactly, in lowercase on Java.',
      ],
    },
    sections: [
      {
        id: 'not-listed',
        title: 'The pack is not in the list',
        body: [
          p('Java only lists a pack when it finds a valid ', code('pack.mcmeta'), ' at the top level of the zip or folder.'),
          ul([
            [strong('Nested folder: '), 'zipping the pack folder itself puts everything one level too deep (', code('MyPack.zip/MyPack/pack.mcmeta'), '). Zip the contents of the folder instead.'],
            [strong('Broken pack.mcmeta: '), 'a missing comma or quote makes it invalid JSON. On Java 26.3 a pack with no description is not listed either.'],
            [strong('Wrong folder: '), 'the zip must be in ', code('resourcepacks'), ', not ', code('shaderpacks'), ' or ', code('mods'), '. Use ', uiPath('Options…', 'Resource Packs…', 'Open Pack Folder'), ' to open the right one.'],
            [strong('Still downloading or blocked: '), 'browsers sometimes save a partly downloaded file as ', code('.crdownload'), ' or ', code('.part'), '. Download the pack again.'],
          ]),
        ],
      },
      {
        id: 'version',
        title: '“Made for an older / newer version of Minecraft”',
        body: [
          p(
            'Java compares the pack format in ',
            code('pack.mcmeta'),
            ' with its own (',
            LATEST,
            ' uses ',
            strong(F(LATEST)),
            '). A pack that only changes textures usually still works if you click ',
            strong('Yes'),
            ', but missing or renamed textures can look wrong. The clean fix is to export the pack again for your version, or give it a compatibility range that includes it. For an old pack you did not make, the ',
            link('/texture-pack-converter', 'Texture Pack Converter'),
            ' renames its textures for your version and writes a new pack.mcmeta.',
          ),
          p(
            'From 1.21.9, a pack with only a ',
            code('pack_format'),
            ' number, or with fields that break the new rules, can show as ',
            el('em', null, 'broken or incompatible'),
            '. Newer packs use ',
            code('min_format'),
            ' and ',
            code('max_format'),
            '. ',
            link('/guides/minecraft-pack-format-versions', 'Every version’s pack format'),
            '.',
          ),
          figure(SHOTS.packSettings),
        ],
      },
      {
        id: 'purple',
        title: 'Purple and black blocks',
        body: [
          p(
            'The purple-and-black checkerboard is the “missing texture”. A model asks for an image that does not exist at that path: the file was renamed, put in the wrong folder, or the pack uses folder names from another version. For example, versions before 1.13 use ',
            code('textures/blocks'),
            ' and ',
            code('textures/items'),
            ', while 1.13 and newer use ',
            code('textures/block'),
            ' and ',
            code('textures/item'),
            '.',
          ),
          p('If you added custom models, check every texture path inside them. Packs made with the Texture Pack Maker use the exact paths of the version you picked.'),
        ],
      },
      {
        id: 'some-textures',
        title: 'Only some textures changed',
        body: [
          ul([
            [strong('Name or path is off by a letter: '), 'the file must have exactly the same name and folder as the original. Java ignores paths with capital letters or spaces.'],
            [strong('Another pack wins: '), 'packs higher in the list replace the same textures. Move yours to the top, or combine the packs into one with ', link('/merge-texture-packs', 'Merge Texture Packs'), ', in the order you want.'],
            [strong('Wrong file for that block: '), 'some blocks use several images (the furnace front, side and top; the grass block top, side and side overlay). Edit all of them, or use the 3D preview to see which image goes where.'],
            [strong('Wrong image type on Bedrock: '), 'some vanilla Bedrock textures are ', code('.tga'), ' files. Keep the same name and file type as the original so yours replaces it.'],
          ]),
        ],
      },
      {
        id: 'grey',
        title: 'Grass and leaves look grey',
        body: [
          p(
            'That is normal in the image file. Grass, leaves, vines, water and a few other textures are stored in grey and coloured by the game for each biome, so paint them in light greys and check them in game. Painting them green makes them look much darker or oddly coloured once the game tints them.',
          ),
        ],
      },
      {
        id: 'animation',
        title: 'An animated texture shows as a long strip',
        body: [
          p(
            'Animated textures are a tall image of frames stacked on top of each other, plus a ',
            code('.png.mcmeta'),
            ' file with the same name (for example ',
            code('sea_lantern.png.mcmeta'),
            '). Without that file Java squashes the whole strip into one block. Bedrock lists animated textures in ',
            code('textures/flipbook_textures.json'),
            ' instead. The Texture Pack Maker writes these files when you edit animation frames.',
          ),
        ],
      },
      {
        id: 'all-off',
        title: 'All my resource packs turned off (Java)',
        body: [
          p(
            'When a resource pack contains a shader that does not compile, Java turns off every pack and goes back to the defaults. This happens with vanilla shader packs that were made for a different version, because Mojang changes those shader files often. Remove the pack or export it again for your exact version; every shader the ',
            link('/shaders', 'Shader Maker'),
            ' writes is compile-checked first.',
          ),
        ],
      },
      {
        id: 'bedrock-import',
        title: 'Bedrock: the import failed',
        body: [
          ul([
            [strong('Import failed: '), code('manifest.json'), ' is missing, invalid, or not at the top level of the file. Export the pack again and open the new file.'],
            [strong('Duplicate pack: '), 'a pack with the same IDs and version number is already installed. Raise the version (the Texture Pack Maker does this on every export) or delete the old copy in ', uiPath('Settings', 'Storage'), '.'],
            [strong('Wrong file type: '), 'a Java ', code('.zip'), ' renamed to ', code('.mcpack'), ' does not work; Bedrock needs its own files and folders. Convert it with the ', link('/texture-pack-converter', 'Texture Pack Converter'), ' instead.'],
            [strong('Console: '), 'Xbox, PlayStation and Switch cannot import files at all. Join a world, Realm or server that carries the pack.'],
          ]),
        ],
      },
      {
        id: 'bedrock-nothing',
        title: 'Bedrock: imported, but nothing changes',
        body: [
          ul([
            ['Activate it: ', uiPath('Settings', 'Global Resources', 'My Packs'), ', select the pack and press ', strong('Activate'), '. For one world, use ', uiPath('Edit world', 'Resource Packs'), '.'],
            'Move it above other active packs that change the same textures.',
            ['If the pack needs a newer game than yours, its ', code('min_engine_version'), ' is too high: update Minecraft or export with a lower minimum.'],
            'Packs made for classic graphics can look different, or be turned off, with Vibrant Visuals on. Try switching Graphics Mode.',
          ]),
        ],
      },
      {
        id: 'shaders',
        title: 'A shader pack does not show up',
        body: [
          ul([
            ['Iris and OptiFine shader packs go in the ', code('shaderpacks'), ' folder, opened from ', uiPath('Options…', 'Video Settings…', 'Shader Packs…'), ', not in ', code('resourcepacks'), '.'],
            ['Iris needs OpenGL. On Java 26.2 and newer, set ', strong('Graphics API'), ' to ', strong('Default'), ' or ', strong('Prefer OpenGL'), ' if Iris says it cannot run with Vulkan.'],
            ['Vanilla (no-mod) shader packs are resource packs and only work on the version they were made for. ', link('/guides/make-shaders-without-mods', 'Shaders without mods'), '.'],
          ]),
        ],
      },
      {
        id: 'error-messages',
        title: 'Error messages, word for word',
        body: [
          p(
            'These are the messages Minecraft shows when a resource pack has a problem, copied from the game’s own language files (Java 26.3, Bedrock 1.26.50). Where the game fills in a name or a number, you see “…” here. Search the page (Ctrl + F) for a few words of what your game says.',
          ),
          el('h3', { class: 'guide-sub' }, 'Java Edition'),
          gameMessage(
            ['Incompatible', '(Made for an older version of Minecraft)'],
            'Shown in red when you point at the pack in the Resource Packs list: its pack format is older than your game’s. A pack from a later version says “(Made for a newer version of Minecraft)”, and from 1.21.9 a pack whose versions the game cannot read says “(Broken or incompatible)”. ',
            strong('Fix: '),
            'export the pack again for your version, or update an old pack with the ',
            link('/texture-pack-converter', 'Texture Pack Converter'),
            '. More in ',
            anchor('version', '“Made for an older / newer version”'),
            '.',
          ),
          gameMessage(
            ['Are you sure you want to load this pack?', 'This pack was made for an older version of Minecraft and may no longer work correctly.'],
            'Appears when you move such a pack to Selected. For a newer pack the second line is “This pack was made for a newer version of Minecraft and may not work correctly.”, for a broken one “This pack is broken or made for an unknown version of Minecraft and may not work correctly.” ',
            strong('Yes'),
            ' loads it anyway; a pack that only changes textures often works. ',
            strong('Fix: '),
            link('/pack-doctor', 'Pack Doctor'),
            ' rewrites ',
            code('pack.mcmeta'),
            ' for your version (',
            link('/guides/minecraft-pack-format-versions', 'every version’s pack format'),
            ').',
          ),
          gameMessage(
            ['Non-pack entries', 'The following entries were not valid packs and were not copied:', '…'],
            'After you drag files onto the Resource Packs screen (1.20.2 and newer): Minecraft found no ',
            code('pack.mcmeta'),
            ' at the top of those zips or folders. Shader packs and Bedrock ',
            code('.mcpack'),
            ' files get this too. ',
            strong('Fix: '),
            'see ',
            anchor('not-listed', 'The pack is not in the list'),
            '; the ',
            link('/texture-pack-converter', 'Texture Pack Converter'),
            ' turns a Bedrock pack into a Java one.',
          ),
          gameMessage(
            ['Resource reload failed', 'Resource pack error detected'],
            'A message in the corner: a pack broke while loading, or (with the second line, 1.21.2 and newer) while you played, often a shader in a vanilla shader pack. Minecraft turned off every resource pack and went back to the default look. ',
            strong('Fix: '),
            'see ',
            anchor('all-off', 'All my resource packs turned off'),
            '. ',
            code('logs/latest.log'),
            ' names the file that failed, and ',
            link('/pack-doctor', 'Pack Doctor'),
            ' finds broken JSON and images.',
          ),
          gameMessage(
            ['… out of … pack(s) failed to download'],
            'When you join a server that sends a resource pack (1.20.3 and newer; before 1.21 it says “packs”): the download did not work. ',
            strong('Fix: '),
            'join again. If it is your server, the link in ',
            code('server.properties'),
            ' must download the zip itself (not a web page), the zip must be under 250 MB, and ',
            code('resource-pack-sha1'),
            ' must match the file or be left empty.',
          ),
          el('h3', { class: 'guide-sub' }, 'Bedrock Edition'),
          p(
            'Import problems show at the top of the screen. Messages about ',
            code('manifest.json'),
            ' are written to the content log: open ',
            uiPath('Settings', 'Creator'),
            ' and choose ',
            strong('Content log history'),
            '.',
          ),
          gameMessage(
            ["Failed to import '…'", 'Duplicate pack detected'],
            'A pack with the same UUID and version is already installed, usually an older copy of the same pack. ',
            strong('Fix: '),
            'raise the version in ',
            code('manifest.json'),
            ' (the Texture Pack Maker does this on every export), or delete the old copy in ',
            uiPath('Settings', 'Storage'),
            ' and import again.',
          ),
          gameMessage(
            ["Failed to import '…'", 'See output log for more details'],
            'Bedrock could not read the file as a pack. The second line can also be “Not a valid zip archive”: the file is not a zip, or the download broke. ',
            strong('Fix: '),
            'see ',
            anchor('bedrock-import', 'Bedrock: the import failed'),
            ', and check the file with ',
            link('/pack-doctor', 'Pack Doctor'),
            '.',
          ),
          gameMessage(
            ['Unable to find manifest in pack.'],
            'There is no ',
            code('manifest.json'),
            ' at the top of the pack: it is one folder too deep, or this is a Java pack (those have ',
            code('pack.mcmeta'),
            ' instead). ',
            strong('Fix: '),
            'zip the contents of the pack folder, not the folder itself. Turn a Java pack into a Bedrock one with the ',
            link('/texture-pack-converter', 'Texture Pack Converter'),
            '.',
          ),
          gameMessage(
            ["Provided 'pack.name' element has an invalid value in pack manifest; Defaulting to resource pack."],
            'The game fills in the part in quotes; many players see ',
            code('pack.name'),
            ' there. Bedrock did not recognise the pack type in ',
            code('manifest.json'),
            ' (the ',
            code('"type"'),
            ' under ',
            code('"modules"'),
            '), so it loads the pack as a resource pack. ',
            strong('Fix: '),
            'a resource pack’s module type must be exactly ',
            code('"resources"'),
            ' (a behavior pack’s ',
            code('"data"'),
            ', a skin pack’s ',
            code('"skin_pack"'),
            '). ',
            link('/pack-doctor', 'Pack Doctor'),
            ' checks it.',
          ),
          gameMessage(
            ['Unable to parse pack manifest with stack: …'],
            code('manifest.json'),
            ' is not valid JSON: a missing comma or quote, a comma after the last item, or one bracket too many. ',
            strong('Fix: '),
            link('/pack-doctor', 'Pack Doctor'),
            ' shows the line with the mistake and can write a working manifest.',
          ),
          gameMessage(
            ["Provided UUID '…' element already exists in pack manifest."],
            'Two UUIDs clash: the header and a module share one, or another installed pack already uses it. Every pack needs UUIDs of its own. ',
            strong('Fix: '),
            link('/pack-doctor', 'Pack Doctor'),
            ' gives the pack new ones; delete old copies in ',
            uiPath('Settings', 'Storage'),
            '.',
          ),
          gameMessage(
            ['Missing Dependencies', 'This pack is missing one or more dependencies. Would you like to apply it anyway?'],
            'When you activate a pack whose ',
            code('manifest.json'),
            ' lists other packs under ',
            code('"dependencies"'),
            " that are not installed, usually the other half of an add-on. The content log names them: “Missing dependency with ID '…' and version '…'.” ",
            strong('Fix: '),
            'import the matching behavior or resource pack too. A texture pack on its own needs no dependencies.',
          ),
        ],
      },
    ],
    faq: [
      {
        id: 'why-red',
        q: 'Why is my texture pack red in the Resource Packs list?',
        a: [p('Red means the pack’s format does not match your game version. It may still work; export it again for your version to be sure.')],
      },
      {
        id: 'reload',
        q: 'Do I need to restart Minecraft after changing a pack?',
        a: [p('No. On Java press F3 + T to reload resource packs, or turn the pack off and on. On Bedrock, leave and rejoin the world.')],
      },
      {
        id: 'server',
        q: 'Why does a server change my textures?',
        a: [p('Servers can send their own resource pack, which goes above yours. You can decline it in the server’s settings on the multiplayer screen, but some servers require it.')],
      },
      {
        id: 'pack-name-error',
        q: "What does “Provided 'pack.name' element has an invalid value in pack manifest” mean?",
        a: [
          p(
            'Bedrock did not recognise the pack type in ',
            code('manifest.json'),
            ' and loads the pack as a resource pack instead (“Defaulting to resource pack”). For a texture pack, set the module ',
            code('"type"'),
            ' to ',
            code('"resources"'),
            '; ',
            link('/pack-doctor', 'Pack Doctor'),
            ' checks the manifest.',
          ),
        ],
      },
    ],
    related: ['install-resource-packs', 'make-a-texture-pack', 'minecraft-pack-format-versions'],
    cta: { label: 'Fix my pack with Pack Doctor', to: '/pack-doctor', icon: 'potion' },
  },

  // ------------------------------------------------------------ install
  {
    meta: meta('install-resource-packs'),
    intro: [
      p(
        'On ',
        strong('Java'),
        ', put the pack’s ',
        code('.zip'),
        ' in the ',
        code('resourcepacks'),
        ' folder and turn it on under Options › Resource Packs. On ',
        strong('Bedrock'),
        ', open the ',
        code('.mcpack'),
        ' file and Minecraft imports it; then activate it under Settings › Global Resources. Shader packs for Java need Iris or OptiFine.',
      ),
    ],
    quick: {
      title: 'Quick answer',
      items: [
        ['Java: ', uiPath('Options…', 'Resource Packs…', 'Open Pack Folder'), ', drop the ', code('.zip'), ' in, then move the pack to Selected and click Done.'],
        ['Bedrock: open the ', code('.mcpack'), ' file, then activate it under ', uiPath('Settings', 'Global Resources'), '.'],
        ['Shaders (Java): install Iris or OptiFine and put the shader zip in the ', code('shaderpacks'), ' folder.'],
      ],
    },
    howto: { name: 'How to install a resource pack in Minecraft Java Edition', steps: INSTALL_JAVA_STEPS },
    sections: [
      {
        id: 'java',
        title: 'Install a resource pack on Java',
        body: [steps(INSTALL_JAVA_STEPS), el('h3', { class: 'guide-sub' }, 'Where is the resourcepacks folder?'), folderTable('resourcepacks')],
      },
      {
        id: 'order',
        title: 'Using more than one pack',
        body: [
          p(
            'You can turn on as many packs as you like. When two packs change the same texture, the one higher in the ',
            strong('Selected'),
            ' list (Java) or the active list (Bedrock) wins, and everything it does not change falls through to the packs below it. A common setup is a small pack with your own tweaks at the top and a full pack under it.',
          ),
          p(
            'To turn such a stack into one pack, for sharing or for a server that sends a single resource pack, use ',
            link('/merge-texture-packs', 'Merge Texture Packs'),
            ': it follows the same rule, so the pack at the top of its list wins.',
          ),
          p(
            'Third-party launchers such as Lunar Client and Badlion Client use the same ',
            code('resourcepacks'),
            ' folder in ',
            code('.minecraft'),
            ' by default and have their own Resource Packs menu to turn packs on.',
          ),
        ],
      },
      {
        id: 'bedrock',
        title: 'Install an .mcpack on Bedrock',
        body: [
          tabbed('install-bedrock', [
            {
              value: 'windows',
              label: 'Windows',
              icon: 'monitor',
              content: [
                steps([
                  ['Double-click the ', code('.mcpack'), '. Minecraft opens and shows ', el('em', null, 'Import started…'), ' then ', el('em', null, 'Successfully imported'), '.'],
                  ['Go to ', uiPath('Settings', 'Global Resources', 'My Packs'), ', select the pack and press ', strong('Activate'), '.'],
                ]),
              ],
            },
            {
              value: 'mobile',
              label: 'Android & iOS',
              icon: 'smartphone',
              content: [
                steps([
                  ['Download the ', code('.mcpack'), ' on the phone or tablet.'],
                  [strong('Android: '), 'open it from Downloads or Files and choose Minecraft. ', strong('iPhone / iPad: '), 'tap it in the Files app, then ', uiPath('Share', 'Minecraft'), '.'],
                  ['Activate it under ', uiPath('Settings', 'Global Resources'), '.'],
                ]),
              ],
            },
            {
              value: 'console',
              label: 'Consoles',
              icon: 'gamepad',
              content: [p('Xbox, PlayStation and Switch cannot import files. Add the pack to a world on a PC or phone and join that world, or play on a Realm or server that includes it.')],
            },
          ]),
          callout('tip', 'Just one world?', 'Open ', uiPath('Edit world', 'Resource Packs'), ' and activate the pack there instead of in Global Resources.'),
        ],
      },
      {
        id: 'shaders',
        title: 'Install a shader pack',
        body: [
          ul([
            [strong('Iris (Java):'), ' install Iris with the installer from ', ext('https://www.irisshaders.dev/', 'irisshaders.dev'), ', play the Iris profile once, then open ', uiPath('Options…', 'Video Settings…', 'Shader Packs…'), ', click ', strong('Open Shader Pack Folder'), ' and drop the zip in.'],
            [strong('OptiFine (Java):'), ' ', uiPath('Options…', 'Video Settings…', 'Shaders…'), ', then ', strong('Shaders Folder'), '.'],
            [strong('Vanilla shaders (Java, no mods):'), ' these are resource packs. Install them in the ', code('resourcepacks'), ' folder like any other pack.'],
            [strong('Vibrant Visuals (Bedrock):'), ' open the ', code('.mcpack'), ', activate it, then set ', uiPath('Settings', 'Video', 'Graphics Mode'), ' to Vibrant Visuals.'],
          ]),
          folderTable('shaderpacks'),
        ],
      },
      {
        id: 'skins',
        title: 'Install a skin',
        body: [
          ul([
            [strong('Java:'), ' Minecraft Launcher › Skins › New skin, choose Classic or Slim, browse to the PNG and click Save & Use. Or upload it on your profile at minecraft.net.'],
            [strong('Bedrock:'), ' open a skin pack ', code('.mcpack'), ' and pick the skin under Dressing Room › Classic Skins, or import a single PNG there.'],
          ]),
          p('More detail in ', link('/guides/make-a-skin', 'How to make a custom Minecraft skin'), '.'),
        ],
      },
      {
        id: 'troubleshooting',
        title: 'Pack not working?',
        body: [
          p('The most common problems are below. ', link('/guides/texture-pack-not-working', 'All fixes, with explanations'), '.'),
          table(
            ['What you see', 'Why', 'Fix'],
            [
              ['“Made for an older / newer version of Minecraft”', 'The pack format in pack.mcmeta is not your game’s.', 'Export again for your version, or widen the compatibility range. Texture-only packs usually still work if you click Yes.'],
              ['“Broken or incompatible” (Java 1.21.9+)', 'pack.mcmeta has only pack_format, or its fields break the rules.', 'Re-export from the Texture Pack Maker, which writes min_format and max_format.'],
              ['The pack is not in the list at all', 'pack.mcmeta is missing, not at the top of the zip, not valid JSON, or has no description.', 'Make sure the zip opens straight onto pack.mcmeta and assets, not a folder.'],
              ['Bedrock says the import failed', 'manifest.json is missing, not at the top of the file, or invalid.', 'Export again as .mcpack and open the new file.'],
              ['Bedrock pack changes nothing', 'Another pack above it replaces the same textures.', 'Move your pack to the top of the active list.'],
            ],
          ),
        ],
      },
    ],
    faq: [
      {
        id: 'unzip',
        q: 'Should I unzip a resource pack?',
        a: [p('No. Java loads zipped packs directly. An unzipped folder also works if pack.mcmeta is directly inside it, but keeping the zip is simpler.')],
      },
      {
        id: 'order',
        q: 'Which pack wins when two change the same texture?',
        a: [p('The one higher in the Selected (Java) or active (Bedrock) list. ', link('/merge-texture-packs', 'Merge Texture Packs'), ' uses the same order to combine several packs into one.')],
      },
      {
        id: 'realms',
        q: 'Can console players use custom packs?',
        a: [p('Not by importing files. They can join a world, Realm or server that carries the pack.')],
      },
    ],
    related: ['texture-pack-not-working', 'make-a-texture-pack', 'minecraft-pack-format-versions', 'make-shaders-without-mods'],
    cta: { label: 'Full install guide for every platform', to: '/help', icon: 'book-open' },
  },

  // ------------------------------------------------------------ pack formats
  {
    meta: meta('minecraft-pack-format-versions'),
    intro: [
      p(
        'Every Java Edition resource pack names a ',
        strong('pack format'),
        ' in its ',
        code('pack.mcmeta'),
        ' file, and Minecraft compares it with its own to decide whether the pack fits. ',
        strong(`Minecraft Java ${LATEST} uses resource pack format ${F(LATEST)}.`),
        ' Resource packs started in 1.6.1; older versions used texture packs, which work differently.',
      ),
    ],
    quick: {
      title: `Quick answer: Minecraft ${LATEST}`,
      items: [
        ['Resource pack format: ', strong(F(LATEST)), '.'],
        ['In ', code('pack.mcmeta'), ' write ', code(`"min_format": ${minFormat(LATEST)}`), ' and ', code(`"max_format": ${maxFormat(LATEST)}`), ' (the format is split into a major and a minor number since 1.21.9).'],
        ['A pack for older versions too also needs ', code('pack_format'), ' and ', code('supported_formats'), '. The table below lists every version.'],
      ],
    },
    sections: [
      {
        id: 'table',
        title: 'Resource pack format of every Java release',
        body: [
          p('Every full release from 1.6.1 to ', LATEST, '. Snapshots, pre-releases and release candidates have their own numbers.'),
          table(
            ['Pack format', 'Minecraft Java versions'],
            formatGroups()
              .reverse()
              .map((g) => [g.format, g.versions.join(', ')]),
            'guide-table formats-table',
          ),
          p(
            'Since the 1.21.9 cycle a format can also have a minor number: ',
            F(LATEST),
            ` means major ${formatParts(LATEST).major}, minor ${formatParts(LATEST).minor}. Mojang raises the minor number for additions that do not break older packs. At the time of writing, the first ${NEXT_SNAPSHOT.version} snapshot uses ${NEXT_SNAPSHOT.format}.`,
          ),
        ],
      },
      {
        id: 'eras',
        title: 'How pack.mcmeta changed',
        body: [
          table(
            ['Game versions', 'Fields the game reads'],
            [
              ['1.6.1 – 1.8.7', [code('pack_format'), ' and ', code('description'), '. There is no version check at all, so any number loads.']],
              ['1.8.8 – 1.20.1', [code('pack_format'), ' only. The pack counts as compatible when it equals the game’s own number; otherwise Minecraft warns but lets you use it.']],
              ['1.20.2 – 1.21.8', [code('pack_format'), ' (required) plus an optional ', code('supported_formats'), ' range such as ', code('[15, 64]'), '.']],
              ['1.21.9 – 26.3', [code('min_format'), ' and ', code('max_format'), ' (required together). A pack whose range reaches back to format 64 or lower must also carry ', code('pack_format'), ' and ', code('supported_formats'), '; a pack only for 1.21.9+ must not use ', code('supported_formats'), '.']],
            ],
          ),
        ],
      },
      {
        id: 'examples',
        title: 'Examples',
        body: [
          el('h3', { class: 'guide-sub' }, `Only Java ${LATEST}`),
          pre(mcmetaFor(LATEST, `My pack for Minecraft ${LATEST}`)),
          p('A bare number in ', code('max_format'), ` means “any minor version”, so ${maxFormat(LATEST)} covers ${maxFormat(LATEST)}.0 and ${F(LATEST)}. Writing `, code(`[${maxFormat(LATEST)}, 0]`), ` there would make the pack too old for ${LATEST}.`),
          el('h3', { class: 'guide-sub' }, `From 1.20.1 to ${LATEST}`),
          pre(mcmetaRange('1.20.1', LATEST, `My pack for Minecraft 1.20.1 - ${LATEST}`)),
          p('1.20.1 reads ', code('pack_format'), ', 1.20.2 – 1.21.8 read ', code('supported_formats'), ' and 1.21.9 and newer read ', code('min_format'), ' and ', code('max_format'), '.'),
          el('h3', { class: 'guide-sub' }, 'Only 1.20.1 (and 1.20)'),
          pre(mcmetaLegacy('1.20.1', 'My pack for Minecraft 1.20.1')),
          callout('tip', 'Let the tool do it', 'In the Texture Pack Maker, pick your version and, if you like, a compatibility range in the Pack tab. The export gets exactly the fields each version needs.'),
        ],
      },
      {
        id: 'bedrock',
        title: 'What about Bedrock?',
        body: [
          p(
            'Bedrock packs have no pack format number. Their ',
            code('manifest.json'),
            ' uses ',
            code('"format_version": 2'),
            ' and a ',
            code('min_engine_version'),
            ' such as ',
            code(MIN_ENGINE),
            '. Bedrock version numbers are year-based now (26.0 came out in February 2026), but manifests keep the old style, so 26.50 is written ',
            code('[1, 26, 50]'),
            '.',
          ),
        ],
      },
    ],
    faq: [
      {
        id: 'latest',
        q: `What is the resource pack format for Minecraft ${LATEST}?`,
        a: [p(`${F(LATEST)}. Write "min_format": ${minFormat(LATEST)} and "max_format": ${maxFormat(LATEST)} in pack.mcmeta for a ${LATEST}-only pack.`)],
      },
      {
        id: '1211',
        q: 'What is the pack format for 1.21.1 and 1.20.1?',
        a: [p(`1.21 and 1.21.1 use ${F('1.21.1')}; 1.20 and 1.20.1 use ${F('1.20.1')}. 1.8.9 and older 1.x versions from 1.6.1 use ${F('1.8.9')}.`)],
      },
      {
        id: 'broken',
        q: 'Why does my pack say “Broken or incompatible”?',
        a: [p('On 1.21.9 and newer, a pack with only a high pack_format (above 64) and no min_format / max_format fails the check. It can still be enabled, but it is better to add both fields.')],
      },
    ],
    related: ['make-a-texture-pack', 'install-resource-packs', 'java-vs-bedrock-packs'],
    cta: { label: 'Make a pack with the right format', to: '/textures', icon: 'image' },
  },

  // ------------------------------------------------------------ skin
  {
    meta: meta('make-a-skin'),
    image: SHOTS.skin2d,
    intro: [
      p(
        'A Minecraft skin is a 64×64 pixel PNG image that wraps around the player model; Bedrock also takes HD skins of 128×128 pixels. You can design one in your browser: paint on the template, check it on a 3D model, then upload it in the Minecraft Launcher (Java) or import it as a skin pack (Bedrock).',
      ),
    ],
    quick: {
      title: 'The short version',
      items: ['Open the Skin Maker and pick a template or starting skin.', 'Paint it, watching the 3D preview.', 'Export a PNG for Java or an .mcpack for Bedrock and upload it.'],
    },
    howto: { name: 'How to make a custom Minecraft skin online', steps: SKIN_STEPS },
    sections: [
      { id: 'steps', title: 'Step by step', body: [steps(SKIN_STEPS), figure(SHOTS.skin2d), figure(SHOTS.skin3d)] },
      {
        id: 'template',
        title: 'How the skin template works',
        body: [
          ul([
            ['The image is ', strong('64×64'), ' pixels. Java 1.7.10 and older use the old ', strong('64×32'), ' layout, which has no separate left arm and leg; Bedrock also accepts ', strong('128×128'), ' HD skins.'],
            ['There are two layers. The ', strong('base layer'), ' is the body; the ', strong('outer layer'), ' (hat, jacket, sleeves and trouser legs) floats just above it and can be transparent.'],
            [strong('Classic'), ' (Steve) arms are 4 pixels wide and ', strong('slim'), ' (Alex) arms are 3 pixels wide. Upload the skin with the same model you painted.'],
            'Unused parts of the template should stay fully transparent.',
          ]),
        ],
      },
      {
        id: 'hd-skins',
        title: 'HD 128×128 skins',
        body: [
          p(
            'An HD skin is the same template at twice the resolution: 128×128 pixels instead of 64×64, so every face, sleeve and shoe has four times as many pixels for shading, eyes and fine patterns. Where it works:',
          ),
          ul([
            [strong('Bedrock Edition'), ' (Windows, Android, iPhone and iPad): import the PNG in the Dressing Room, or put it in a skin pack. A pack can mix 64×64 and HD skins.'],
            [strong('Java Edition'), ': the Minecraft Launcher and minecraft.net only accept 64×64 skins. An HD skin needs a mod that loads HD skins, such as CustomSkinLoader.'],
          ]),
          el('h3', { class: 'guide-sub' }, 'Make one in the Skin Maker'),
          steps([
            ['On the start screen, set ', strong('Size'), ' to ', strong('HD 128×128'), ', then pick a starting point. Templates and starting skins are doubled to 128×128, and a 128×128 PNG you upload stays HD.'],
            ['Already painting a 64×64 skin? Switch ', strong('Size'), ' to ', strong('HD 128'), ' in the editor and confirm with ', strong('Make HD'), '. Every pixel becomes a 2×2 block, so the skin looks the same until you paint finer detail. ', strong('Size'), ' › ', strong('64×64'), ' and ', strong('Reduce to 64×64'), ' go back.'],
            ['Export ', strong('Bedrock skin (.png)'), ' to import it in the Dressing Room, or a ', strong('Bedrock skin pack (.mcpack)'), '. Both keep 128×128.'],
            ['For Java, ', strong('Java skin (.png)'), ' downloads a 64×64 copy, with each 2×2 block turned into one pixel; your HD skin stays as it is. Using an HD skin mod? Choose ', strong('128×128 for mods'), ' instead.'],
          ]),
          callout(
            'warn',
            'Limits',
            'Consoles cannot import skin files of any size. Skins larger than 128×128 are not supported. Players who turn on Only Allow Trusted Skins see every custom skin, HD or not, as a default skin.',
          ),
        ],
      },
      {
        id: 'java',
        title: 'Use it on Java',
        body: [
          steps([
            ['Open the Minecraft Launcher and go to ', uiPath('Minecraft: Java Edition', 'Skins'), '.'],
            ['Click ', strong('New skin'), ', name it and choose ', strong('Classic'), ' or ', strong('Slim'), '.'],
            ['Click ', strong('Browse'), ', pick your PNG, then ', strong('Save & Use'), '.'],
          ]),
          p('You can also upload it on your profile at ', ext('https://www.minecraft.net/', 'minecraft.net'), '.'),
        ],
      },
      {
        id: 'bedrock',
        title: 'Make a custom Bedrock skin pack',
        body: [
          p(
            'A skin pack is an ',
            code('.mcpack'),
            ' holding one or more skins. The Skin Maker builds it for you; inside it has a ',
            code('manifest.json'),
            ' (module type ',
            code('skin_pack'),
            '), a ',
            code('skins.json'),
            ' listing each skin with the classic (',
            code('geometry.humanoid.custom'),
            ') or slim (',
            code('geometry.humanoid.customSlim'),
            ') model and ',
            code('"type": "free"'),
            ', the skin PNGs at the top level, and the names in ',
            code('texts/en_US.lang'),
            '.',
          ),
          steps([
            ['Paint each skin as its own project. Classic and slim skins can share one pack.'],
            ['Choose ', strong('Export'), ' › ', strong('Bedrock skin pack'), ', name the pack and tick the other skins to include.'],
            'Open the .mcpack (double-click on Windows, Open with Minecraft on Android, Share › Minecraft on iPhone and iPad).',
            ['In Minecraft go to ', uiPath('Dressing Room', 'Classic Skins'), ', find your pack, choose the skin and press ', strong('Equip'), '.'],
          ]),
          figure(SHOTS.skinPack),
          callout('warn', 'Things to know', 'Consoles cannot import skin files. Players who turn on Only Allow Trusted Skins see custom skins as default ones. Custom models are not allowed in imported skin packs, only classic and slim.'),
          p('Installing, updating and the files inside, step by step: ', link('/guides/make-a-bedrock-skin-pack', 'How to make a Minecraft Bedrock skin pack'), '.'),
        ],
      },
    ],
    faq: [
      { id: 'size', q: 'What size should a Minecraft skin be?', a: [p('64×64 pixels, saved as PNG. Use 64×32 only for Java 1.7.10 and older. Bedrock also takes HD skins of 128×128 pixels.')] },
      {
        id: 'hd',
        q: 'Can I make a 128×128 Minecraft skin?',
        a: [
          p(
            'Yes, for Bedrock Edition. In the Skin Maker, set ',
            strong('Size'),
            ' to ',
            strong('HD 128×128'),
            ' before you start, or switch an existing skin to ',
            strong('HD 128'),
            ', then export a Bedrock PNG or skin pack. Java Edition only shows 64×64 skins without mods, so the Java export makes a 64×64 copy; HD skin mods such as CustomSkinLoader can use the 128×128 file.',
          ),
        ],
      },
      { id: 'username', q: 'Can I start from someone’s skin?', a: [p('Yes. The Skin Maker can load any Java player’s current skin by username, so you can remix it. Please respect other people’s work.')] },
      { id: 'phone', q: 'Can I make a skin on my phone?', a: [p('Yes. The editor works with touch, including pinch-to-zoom.')] },
      {
        id: 'slim-pack',
        q: 'Can a skin pack mix classic and slim skins?',
        a: [p('Yes. Every skin in a pack has its own model, so a custom skin pack can hold classic (4-pixel arms) and slim (3-pixel arms) skins side by side.')],
      },
      {
        id: 'update-pack',
        q: 'How do I update a skin pack I already imported?',
        a: [p('Export it again from the same project and open the new .mcpack. The pack keeps its IDs and gets a higher version number, so Minecraft replaces the old one instead of adding a copy.')],
      },
    ],
    related: ['make-a-bedrock-skin-pack', 'install-resource-packs', 'java-vs-bedrock-packs'],
    cta: { label: 'Open the Skin Maker', to: '/skins', icon: 'human' },
  },

  // ------------------------------------------------------------ bedrock skin pack
  {
    meta: meta('make-a-bedrock-skin-pack'),
    image: SHOTS.skinPack,
    intro: [
      p(
        strong('Yes, you can make your own skin pack for Minecraft Bedrock, for free.'),
        ' A skin pack is an ',
        code('.mcpack'),
        ' file that holds one or more skins and two small description files, ',
        code('manifest.json'),
        ' and ',
        code('skins.json'),
        '. Paint or upload your skins in the ',
        link('/skin-pack-maker', 'Skin Pack Maker'),
        ', download the pack, open it on Windows, Android, iPhone or iPad, and wear your skins from the Dressing Room. Selling a pack on the Minecraft Marketplace is a different thing: only Mojang’s approved Marketplace partners can publish there.',
      ),
    ],
    quick: {
      title: 'The short version',
      items: [
        ['Paint or upload each skin in the ', link('/skin-pack-maker', 'Skin Pack Maker'), ', with classic or slim arms.'],
        ['Choose ', strong('Export'), ' › ', strong('Bedrock skin pack (.mcpack)'), ', name the pack and tick the other skins.'],
        ['Open the ', code('.mcpack'), ' and equip a skin under ', uiPath('Dressing Room', 'Classic Skins'), '.'],
      ],
    },
    howto: { name: 'How to make a Minecraft Bedrock skin pack', steps: SKIN_PACK_STEPS },
    sections: [
      {
        id: 'what',
        title: 'What is inside a skin pack?',
        body: [
          p('A skin pack is a zip file renamed to ', code('.mcpack'), '. These files sit at the top of it:'),
          table(
            ['File', 'What it does'],
            [
              [code('manifest.json'), ['The pack’s name, two unique IDs (UUIDs) and a version number. Its module type ', code('skin_pack'), ' tells Minecraft that this is a skin pack, not a texture pack.']],
              [code('skins.json'), ['The list of skins: for each one its name key, its PNG, the model (', code('geometry.humanoid.custom'), ' for classic arms, ', code('geometry.humanoid.customSlim'), ' for slim arms) and ', code('"type": "free"'), '.']],
              ['Skin images', ['One 64×64 PNG per skin, next to ', code('manifest.json'), '.']],
              [code('texts/en_US.lang'), ['The names shown in the Dressing Room, for the pack and for each skin. ', code('texts/languages.json'), ' lists the language files.']],
            ],
          ),
          p(
            code('"type": "free"'),
            ' means anyone who has the pack can wear the skin. Marketplace packs mark most skins as ',
            code('"paid"'),
            ', which only unlock once the pack is bought, so a pack you make yourself always uses free.',
          ),
        ],
      },
      {
        id: 'steps',
        title: 'Make one with the Skin Pack Maker',
        body: [
          steps(SKIN_PACK_STEPS),
          figure(SHOTS.skinPack),
          p(
            'The maker writes ',
            code('manifest.json'),
            ', ',
            code('skins.json'),
            ' and the language file for you, with new IDs for every pack. Classic and slim skins can share a pack, each skin keeps its own name, and the pack name you type is the heading players see above the skins.',
          ),
          figure(SHOTS.skin3d),
        ],
      },
      {
        id: 'install',
        title: 'Install it on Windows, Android and iOS',
        body: [
          tabbed('install-skin-pack', [
            {
              value: 'windows',
              label: 'Windows',
              icon: 'monitor',
              content: [
                steps([
                  ['Double-click the ', code('.mcpack'), '. Minecraft opens and shows ', el('em', null, 'Import started…'), ' then ', el('em', null, 'Successfully imported'), '.'],
                  ['Open ', uiPath('Dressing Room', 'Classic Skins'), ', pick a skin from your pack and press ', strong('Equip'), '.'],
                ]),
              ],
            },
            {
              value: 'mobile',
              label: 'Android & iOS',
              icon: 'smartphone',
              content: [
                steps([
                  ['Download the ', code('.mcpack'), ' on the phone or tablet.'],
                  [strong('Android: '), 'open it from Downloads or Files and choose Minecraft. ', strong('iPhone / iPad: '), 'tap it in the Files app, then ', uiPath('Share', 'Minecraft'), '.'],
                  ['Open ', uiPath('Dressing Room', 'Classic Skins'), ' and equip a skin from your pack.'],
                ]),
              ],
            },
            {
              value: 'console',
              label: 'Consoles',
              icon: 'gamepad',
              content: [p('Xbox, PlayStation and Switch cannot import skin packs or skin files. On consoles, custom looks come from the Character Creator or from Marketplace skin packs.')],
            },
          ]),
          callout(
            'tip',
            'Just one skin?',
            'You do not need a pack for a single skin: in Classic Skins, open your owned skins, choose Import and pick a 64×64 PNG. A pack is handier for several skins, keeps their names, and installs the same way on every device.',
          ),
        ],
      },
      {
        id: 'update',
        title: 'Update or remove a skin pack',
        body: [
          p(
            'To change a pack you already imported, edit the skins, export the pack again from the same project and open the new file. The maker keeps the pack’s two IDs and raises its version (1.0.0, then 1.0.1 and so on), so Minecraft replaces the installed pack instead of listing it twice.',
          ),
          p(
            'Made the pack by hand? Keep both UUIDs and raise the version in ',
            code('manifest.json'),
            ', in the header and the module. New UUIDs give you a second pack, and the same version again is not imported because that pack is already installed.',
          ),
          p('To delete a pack, go to ', uiPath('Settings', 'Storage'), ', select it and delete it.'),
        ],
      },
      {
        id: 'arms',
        title: 'Classic or slim arms',
        body: [
          p(
            'Every skin in a pack has its own model, so one pack can mix both. ',
            strong('Classic'),
            ' (Steve) arms are 4 pixels wide and use ',
            code('geometry.humanoid.custom'),
            '; ',
            strong('slim'),
            ' (Alex) arms are 3 pixels wide and use ',
            code('geometry.humanoid.customSlim'),
            '. The model has to match the way the skin was painted, or the arms look cut off or get a see-through stripe.',
          ),
          p('Imported packs can only use these two models. Custom shapes, such as an oversized head, are not allowed in a skin pack you import yourself.'),
        ],
      },
      {
        id: 'by-hand',
        title: 'Make a skin pack by hand',
        body: [
          p('You can also write the files yourself in any text editor. A pack with two skins looks like this:'),
          pre(SKIN_PACK_TREE),
          p(
            code('manifest.json'),
            ' needs two different UUIDs. Make your own with any UUID generator instead of copying the ones below, and keep them for later updates:',
          ),
          pre(SKIN_PACK_MANIFEST.trimEnd()),
          p(
            code('skins.json'),
            ' lists the skins. ',
            code('serialize_name'),
            ' and ',
            code('localization_name'),
            ' are the pack’s ID: one word with no spaces that no other pack uses. The Skin Pack Maker adds the start of the pack’s UUID to make sure.',
          ),
          pre(SKIN_PACK_SKINS_JSON.trimEnd()),
          p(code('texts/en_US.lang'), ' holds the names shown in the game, and ', code('texts/languages.json'), ' contains ', code('["en_US"]'), ':'),
          pre(SKIN_PACK_LANG.trimEnd()),
          steps([
            ['Put the files in a folder as shown, with the PNGs next to ', code('manifest.json'), '.'],
            'Select the files inside the folder, not the folder itself, and add them to a zip.',
            ['Rename the zip from ', code('.zip'), ' to ', code('.mcpack'), ' and open it.'],
          ]),
          p(
            'If the import fails, the usual cause is a folder around the files inside the zip, a typo in the JSON, or two equal UUIDs. The ',
            link('/skin-pack-maker', 'Skin Pack Maker'),
            ' writes exactly these files, so you can also export a pack, rename it to ',
            code('.zip'),
            ' and look inside.',
          ),
        ],
      },
      {
        id: 'marketplace',
        title: 'Marketplace packs and personal packs',
        body: [
          p(
            'Want to make a skin pack for the Minecraft Marketplace? Only Marketplace partners can publish there: studios and creators that Mojang has accepted into its partner programme, who submit each pack for review. There is no way to upload a pack to the Marketplace from the game or from a website.',
          ),
          ul([
            [strong('Personal skin pack: '), 'free, made by anyone, imported from an ', code('.mcpack'), ' on Windows, Android, iPhone and iPad. You can share the file with friends.'],
            [strong('Marketplace skin pack: '), 'made by an approved partner, bought with Minecoins or free, available on every device including consoles.'],
          ]),
          p('Only put skins in a pack that you made yourself or are allowed to share.'),
        ],
      },
      {
        id: 'trusted',
        title: 'Why friends may see a default skin',
        body: [
          p(
            'Bedrock has a setting called ',
            strong('Only Allow Trusted Skins'),
            '. Players who turn it on see every custom skin, including the ones from imported packs, as a default skin such as Steve or Alex. It is a setting on their side, so you cannot change it for them. Everyone else sees your skin as you made it.',
          ),
        ],
      },
    ],
    faq: [
      {
        id: 'free',
        q: 'Can you make Minecraft skin packs for Bedrock for free?',
        a: [p('Yes. Personal skin packs are free to make and to use on Windows, Android, iPhone and iPad. The Skin Pack Maker needs no account, and your skins stay on your device.')],
      },
      {
        id: 'java',
        q: 'Do skin packs work on Java Edition?',
        a: [p('No. Skin packs are a Bedrock feature. On Java you wear one skin at a time, uploaded as a PNG in the Minecraft Launcher. ', link('/guides/make-a-skin', 'How to make a skin'), '.')],
      },
      {
        id: 'console',
        q: 'Can I use a custom skin pack on Xbox, PlayStation or Switch?',
        a: [p('No. Consoles cannot import skin packs or skin files. Windows, Android, iPhone and iPad can.')],
      },
      {
        id: 'marketplace',
        q: 'Can I sell my skin pack on the Marketplace?',
        a: [p('Only as an approved Minecraft Marketplace partner. A personal pack can be shared as an .mcpack file, but not sold in the game.')],
      },
      {
        id: 'failed',
        q: 'Why does the import fail?',
        a: [p('Usually the zip has a folder around the files, the JSON has a typo, the two UUIDs are equal, or a pack with the same IDs and version is already installed. Packs exported from the Skin Pack Maker avoid all four.')],
      },
    ],
    related: ['make-a-skin', 'install-resource-packs', 'java-vs-bedrock-packs'],
    cta: { label: 'Open the Skin Pack Maker', to: '/skin-pack-maker', icon: 'package' },
  },

  // ------------------------------------------------------------ shaders without mods
  {
    meta: meta('make-shaders-without-mods'),
    image: SHOTS.shaderVanilla,
    intro: [
      p(
        strong('Yes, within limits.'),
        ' You do not need OptiFine, Iris or any other mod for basic shader effects. On Java 1.17 and newer an ordinary resource pack can replace some of Minecraft’s own shader files, so you get colour grading, a vignette, fog changes and, on 26.3, bloom without installing anything. On Bedrock, custom shader code is not allowed, but a Vibrant Visuals pack tunes the built-in lighting, sky, fog and water. Real shadows and reflections on Java still need Iris or OptiFine.',
      ),
    ],
    howto: { name: 'How to make a Minecraft Java shader pack without mods', steps: VANILLA_SHADER_STEPS },
    sections: [
      {
        id: 'java',
        title: 'Java: shaders in a resource pack',
        body: [
          p('Since 1.17, Minecraft draws the world with shader files a resource pack can override. What a vanilla shader pack can do depends on the version:'),
          table(
            ['Effect', 'Works on'],
            [
              ['Colour grading (brightness, contrast, saturation, warmth, black & white, sepia)', 'Java 1.17 and newer'],
              ['Vignette', 'Java 1.17 and newer'],
              ['Fog distance and colour', 'Java 1.17 and newer'],
              ['Bloom (full-screen glow)', 'Java 26.3 and newer'],
              ['Waving plants', '1.17 – 1.21.4 and 1.21.6 – 1.21.10 only'],
              ['Real shadows, reflections, god rays', 'Not possible without Iris or OptiFine'],
            ],
          ),
          p('Java 26.3 added an always-on full-screen effect hook, which is why bloom and cleaner colour grading work there. Versions 1.16.5 and older have no replaceable world shaders.'),
          callout('warn', 'One exact version', 'Mojang changes these shader files often, so a vanilla shader pack only works on the version it was made for. A broken shader can make Minecraft turn off all your resource packs, which is why every shader the Shader Maker writes is compile-checked first.'),
          el('h3', { class: 'guide-sub' }, 'Make one'),
          steps(VANILLA_SHADER_STEPS),
          figure(SHOTS.shaderVanilla),
        ],
      },
      {
        id: 'bedrock',
        title: 'Bedrock: Vibrant Visuals instead of shaders',
        body: [
          p(
            'Bedrock stopped loading custom shader code when it moved to the RenderDragon engine (1.16.200 on Windows and consoles, 1.18.30 on other devices). Tools that swap the game’s compiled shader files need modified game installs and break with updates.',
          ),
          p(
            'The official way is ',
            strong('Vibrant Visuals'),
            ': Bedrock’s own modern renderer, in the stable game since 1.21.90 (June 2025). A resource pack can change its settings: sun and moon light, sky colours, fog, water, shadows and colour grading, per time of day and per biome. ',
            link('/guides/bedrock-vibrant-visuals-settings', 'Vibrant Visuals settings explained'),
            '.',
          ),
        ],
      },
      {
        id: 'mods',
        title: 'Shaders without OptiFine: use Iris',
        body: [
          p(
            'If “without mods” means “without OptiFine”, the answer is Iris. It loads the same shader packs (real sun shadows, waving leaves, reflective water, god rays), runs alongside the Sodium performance mod, and is available for Java 1.16.5 to 26.3. At the time of writing OptiFine goes up to 26.2.',
          ),
          steps([
            ['Download the Iris installer from ', ext('https://www.irisshaders.dev/', 'irisshaders.dev'), ' and run it. It installs Iris and Sodium for the version you choose.'],
            'Start the game once with the new Iris profile in the Minecraft Launcher.',
            ['Open ', uiPath('Options…', 'Video Settings…', 'Shader Packs…'), ', click ', strong('Open Shader Pack Folder'), ' and drop a shader pack zip into it.'],
            'Pick the pack in the list and click Apply. Lighter packs suit laptops; heavier ones need a strong graphics card.',
          ]),
          figure(SHOTS.shaderIris),
          p(
            'On Forge or NeoForge, look for a port of Iris for that loader. You can also build your own Iris / OptiFine shader pack, with presets and a live preview, in the ',
            link('/shaders', 'Shader Maker'),
            '.',
          ),
        ],
      },
    ],
    faq: [
      { id: 'optifine', q: 'Is OptiFine needed for vanilla shaders?', a: [p('No. Vanilla shader packs are normal resource packs. They work without any mod on the version they were made for.')] },
      { id: 'servers', q: 'Do vanilla shader packs work on servers?', a: [p('Yes. Resource packs are applied by your own game, so they also work when you play on a server.')] },
      { id: 'bedrock', q: 'Can I use Java shaders on Bedrock?', a: [p('No. Bedrock cannot load shader code from packs. Use a Vibrant Visuals pack instead.')] },
    ],
    related: ['bedrock-vibrant-visuals-settings', 'install-resource-packs', 'java-vs-bedrock-packs'],
    cta: { label: 'Open the Shader Maker', to: '/shaders', icon: 'sparkles' },
  },

  // ------------------------------------------------------------ vibrant visuals
  {
    meta: meta('bedrock-vibrant-visuals-settings'),
    image: SHOTS.vibrantVisuals,
    intro: [
      p(
        strong('Vibrant Visuals'),
        ' is Minecraft Bedrock’s modern graphics mode, with directional sunlight, soft shadows, volumetric fog, reflective water and physically based materials. It left the experiments in 1.21.90 (June 2025) and is the default graphics mode on supported devices. A resource pack can adjust its settings; it cannot add new shader code.',
      ),
    ],
    howto: { name: 'How to use a Vibrant Visuals pack in Minecraft Bedrock', steps: VV_STEPS },
    sections: [
      {
        id: 'settings',
        title: 'What a Vibrant Visuals pack can change',
        body: [
          table(
            ['Pack folder', 'What it controls'],
            [
              [code('lighting/'), 'Sun and moon brightness, colour and path tilt, ambient (cave) light, sky light and how colourful glowing blocks are.'],
              [code('atmospherics/'), 'Sky colours overhead and at the horizon, and how light scatters in the air (sky density, sunset glow).'],
              [code('color_grading/'), 'The tone-mapping operator, contrast, saturation, gain, gamma and colour temperature: the film look.'],
              [code('water/'), 'Water colour, waves and caustics (light patterns under water).'],
              [code('shadows/'), 'Blocky or soft shadows.'],
              [code('fogs/'), 'Volumetric fog density and colour, and the classic distance fog.'],
              [code('local_lighting/'), 'The colour of light from blocks such as torches and lanterns.'],
            ],
          ),
          p('Settings can change with the time of day, and Minecraft’s own values differ per biome, so a good pack adjusts every biome instead of replacing one global file.'),
          p(strong('Not adjustable by packs: '), 'bloom, exposure, screen-space reflections, cloud lighting, the tone-mapping curve itself, render distance and anti-aliasing. These live in the game’s renderer, not in resource packs.'),
        ],
      },
      {
        id: 'devices',
        title: 'Which devices support it',
        body: [
          ul([
            'Windows PCs with DirectX 12.',
            'Xbox Series and PlayStation 5; Xbox One and PS4 have it switched off by default.',
            'iPhone and iPad with an A12 chip or newer.',
            'Many recent Android devices.',
          ]),
          p('It is not available on the original Nintendo Switch, Chromebooks or Fire tablets. Servers can turn it off, and split-screen play uses Fancy graphics instead.'),
        ],
      },
      {
        id: 'enable',
        title: 'Turn it on with a pack',
        body: [
          steps(VV_STEPS),
          callout(
            'warn',
            'Vibrant Visuals greyed out?',
            'Minecraft only allows it when every active resource pack supports it. Classic texture packs switch it off, so deactivate them (or use a pack made for Vibrant Visuals). The option also needs a supported device.',
          ),
          figure(SHOTS.vibrantVisuals),
        ],
      },
    ],
    faq: [
      { id: 'what', q: 'What is Vibrant Visuals in Minecraft?', a: [p('Bedrock’s built-in modern graphics mode, released in 1.21.90. It adds directional lighting, shadows, volumetric fog, water reflections and PBR materials without add-ons.')] },
      { id: 'textures', q: 'Does Vibrant Visuals need a special texture pack?', a: [p('No, it works with the default textures. But a classic texture pack that does not declare Vibrant Visuals support switches the mode off while it is active.')] },
      { id: 'classic-fog', q: 'Do fog changes work without Vibrant Visuals?', a: [p('Classic distance fog can be changed in every graphics mode. Volumetric fog and the lighting settings only apply in Vibrant Visuals.')] },
    ],
    related: ['make-shaders-without-mods', 'install-resource-packs', 'java-vs-bedrock-packs'],
    cta: { label: 'Build a Vibrant Visuals pack', to: '/shaders', icon: 'cloud-sun' },
  },

  // ------------------------------------------------------------ java vs bedrock
  {
    meta: meta('java-vs-bedrock-packs'),
    intro: [
      p(
        'Java and Bedrock both have resource packs, but the files are not interchangeable. A ',
        strong('Java'),
        ' pack is a ',
        code('.zip'),
        ' with ',
        code('pack.mcmeta'),
        ' and PNG textures under ',
        code('assets/minecraft/textures/'),
        '. A ',
        strong('Bedrock'),
        ' pack is an ',
        code('.mcpack'),
        ' with ',
        code('manifest.json'),
        ' and textures under ',
        code('textures/'),
        '. To support both, you make the pack twice.',
      ),
    ],
    quick: {
      title: 'Quick answer: do Java texture packs work on Bedrock?',
      items: [
        'No. Bedrock cannot load a Java .zip, and renaming it to .mcpack does not help.',
        'The two editions use different folders, file names and description files.',
        'You can convert a pack by moving and renaming its images and adding a manifest.json, or remake it in a Bedrock project.',
      ],
    },
    sections: [
      {
        id: 'compare',
        title: 'Side by side',
        body: [
          table(
            ['', 'Java Edition', 'Bedrock Edition'],
            [
              ['File', [code('.zip'), ' (or a folder)'], [code('.mcpack'), ' (a renamed zip)']],
              ['Description file', [code('pack.mcmeta')], [code('manifest.json'), ' with two UUIDs and a version number']],
              ['Version targeting', ['A pack format number, e.g. ', F(LATEST), ' for ', LATEST], ['A minimum engine version, e.g. ', code(MIN_ENGINE)]],
              ['Texture path example', [code('assets/minecraft/textures/block/stone.png')], [code('textures/blocks/stone.png')]],
              ['Image formats', 'PNG', 'PNG or TGA (keep the vanilla file’s extension)'],
              ['Icon', [code('pack.png')], [code('pack_icon.png')]],
              ['Installing', ['Drop into the ', code('resourcepacks'), ' folder'], 'Open the file; Minecraft imports it'],
              ['Shaders', 'Iris / OptiFine shader packs, or vanilla shader resource packs (1.17+)', 'No custom shader code; Vibrant Visuals settings packs'],
              ['Skins', 'A PNG uploaded in the launcher or on minecraft.net', 'A skin pack (.mcpack) or a PNG imported in the Dressing Room'],
              ['Consoles', 'Not applicable', 'Cannot import files; use a world, Realm or server that has the pack'],
            ],
          ),
        ],
      },
      {
        id: 'textures',
        title: 'Texture differences to watch for',
        body: [
          ul([
            'File names differ between the editions, for example Java’s block/grass_block_top.png and Bedrock’s blocks/grass_top.png.',
            'Many Bedrock textures use their transparent pixels to store tint or dye masks, so editors must never throw away the colour of invisible pixels. The Texture Pack Maker keeps exact pixels.',
            'Java can mix versions in one pack with a compatibility range; Bedrock packs declare a single minimum version.',
          ]),
        ],
      },
      {
        id: 'convert',
        title: 'Can you convert a Java texture pack to Bedrock?',
        body: [
          p('Yes, but not by renaming the file. A conversion means rebuilding the pack in Bedrock’s layout:'),
          steps([
            ['Copy the images from ', code('assets/minecraft/textures/'), ' into Bedrock’s ', code('textures/'), ' folders (', code('block'), ' → ', code('blocks'), ', ', code('item'), ' → ', code('items'), ').'],
            ['Rename files whose names differ, for example ', code('grass_block_top.png'), ' → ', code('grass_top.png'), '. Textures with no Bedrock counterpart are skipped.'],
            ['Write a ', code('manifest.json'), ' with two new UUIDs, a version and a ', code('min_engine_version'), ', and rename ', code('pack.png'), ' to ', code('pack_icon.png'), '.'],
            ['Check the special cases: Bedrock animations are listed in ', code('textures/flipbook_textures.json'), ' instead of ', code('.png.mcmeta'), ' files, and some textures are ', code('.tga'), ' files that store tint masks in their transparent pixels.'],
            ['Zip the contents and rename the zip to ', code('.mcpack'), '.'],
          ]),
          p(
            'Mojang’s own reference is ',
            ext('https://learn.microsoft.com/en-us/minecraft/creator/documents/convertingtexturepacks', 'Converting Texture Packs from Java Edition to Bedrock Edition'),
            '. The quick route is the ',
            link('/texture-pack-converter', 'Texture Pack Converter'),
            ': it moves and renames every texture, turns animations into flipbook entries, writes the manifest and lists anything it could not convert.',
          ),
        ],
      },
      {
        id: 'mcpack',
        title: 'Is a .mcpack just a zip file?',
        body: [
          p(
            'Yes. An ',
            code('.mcpack'),
            ' is an ordinary zip with a different extension, so Bedrock knows to import it. Rename it to ',
            code('.zip'),
            ' to look inside. What makes it a Bedrock pack is its contents: ',
            code('manifest.json'),
            ' at the top level and Bedrock’s folder layout. ',
            code('.mcaddon'),
            ' files bundle several packs, and ',
            code('.mcworld'),
            ' files hold a whole world.',
          ),
        ],
      },
      {
        id: 'both',
        title: 'Making a pack for both',
        body: [
          steps([
            ['Create a Java project in the ', link('/textures', 'Texture Pack Maker'), ' and paint your textures.'],
            'Create a Bedrock project and repaint (or upload) the same textures there; the file list is Bedrock’s own.',
            'Export each one and share both files.',
          ]),
        ],
      },
    ],
    faq: [
      { id: 'convert', q: 'Can I convert a Java pack to Bedrock?', a: [p('Not by renaming the file. The folders, names and description file differ, so the images have to be moved, renamed and given a manifest.json. The ', link('/texture-pack-converter', 'Texture Pack Converter'), ' does this for you.')] },
      { id: 'back', q: 'Can I convert a Bedrock pack to Java?', a: [p('The same way in reverse: move the images into ', code('assets/minecraft/textures/'), ', rename them to Java’s names, convert any .tga files to PNG and add a ', code('pack.mcmeta'), '.')] },
      { id: 'missing', q: 'Why are some textures missing after converting?', a: [p('Each edition has textures the other does not, and some are split or combined differently (for example chests, paintings and the GUI). Those need repainting for the other edition.')] },
      { id: 'which', q: 'Which edition am I playing?', a: [p('If you play on a console, phone or tablet, or got Minecraft from the Microsoft Store as “Minecraft for Windows”, it is Bedrock. Java runs on Windows, macOS and Linux from the Minecraft Launcher.')] },
    ],
    related: ['convert-java-to-bedrock-texture-pack', 'make-a-texture-pack', 'install-resource-packs'],
    cta: { label: 'Open the Texture Pack Maker', to: '/textures', icon: 'image' },
  },
  // ------------------------------------------------------------ convert java to bedrock
  {
    meta: meta('convert-java-to-bedrock-texture-pack'),
    image: SHOTS.convertResult,
    intro: [
      p(
        'A Java texture pack does not work on Bedrock, and renaming the ',
        code('.zip'),
        ' to ',
        code('.mcpack'),
        ' does not help: the two editions use different folders, file names and description files. To convert a pack, every texture has to be moved to Bedrock’s folder, renamed to Bedrock’s file name and given a ',
        code('manifest.json'),
        '. The free ',
        link('/texture-pack-converter', 'Texture Pack Converter'),
        ' does this in your browser in a few seconds, and works the other way too.',
      ),
    ],
    quick: {
      title: 'The short version',
      items: [
        ['Open the ', link('/texture-pack-converter', 'Texture Pack Converter'), ' and choose your Java ', code('.zip'), '.'],
        ['Pick ', strong('Bedrock Edition'), ' and click ', strong('Convert to Bedrock'), '.'],
        ['Download the ', code('.mcpack'), ' and open it: Minecraft imports it.'],
      ],
    },
    howto: { name: 'How to convert a Java texture pack to Bedrock', steps: CONVERT_STEPS },
    sections: [
      { id: 'steps', title: 'Step by step', body: [steps(CONVERT_STEPS), figure(SHOTS.convertPack), figure(SHOTS.convertResult)] },
      {
        id: 'what',
        title: 'What converts, and what does not',
        body: [
          p('The converter knows which Java texture plays the same part as which Bedrock texture, worked out from the game files of both editions. Most textures have the same picture on both, so they can be copied as they are.'),
          table(
            ['Converts', 'Does not convert'],
            [
              ['Most block and item textures (around four in five)', 'Textures that exist in only one edition'],
              ['Many mob and environment textures (sun, moon, clouds)', 'Textures laid out differently: chests, many mob skins, banners, the menus and particles'],
              ['Animated textures: .png.mcmeta becomes a flipbook entry', 'Models, sounds, fonts, splash texts and shaders'],
              ['The pack icon, name and description', 'OptiFine extras such as connected textures and custom item textures'],
            ],
          ),
          p('Anything skipped is listed in the report with the reason, so you know exactly what to repaint. Open the converted pack in the ', link('/textures', 'Texture Pack Maker'), ' to fix those textures on their 3D models before you download it.'),
          callout('tip', 'Same pack, two editions', 'Keep your Java pack as the original and convert it again after each change. Before importing the new version on Bedrock, remove the old one under Settings › Storage so you do not end up with two copies.'),
        ],
      },
      {
        id: 'bedrock-to-java',
        title: 'Convert a Bedrock pack to Java',
        body: [
          p(
            'Choose a Bedrock ',
            code('.mcpack'),
            ' (or ',
            code('.mcaddon'),
            ') and pick ',
            strong('Java Edition'),
            ' and the version you play. Textures go to Java’s folders and names, ',
            code('.tga'),
            ' images become PNG, flipbook animations become ',
            code('.png.mcmeta'),
            ' files and the pack gets the right ',
            code('pack.mcmeta'),
            ' for that version.',
          ),
        ],
      },
      {
        id: 'old-java',
        title: 'Update an old Java pack to a new version',
        body: [
          p(
            'The same converter updates Java packs between versions. Many textures were renamed over the years, most of all in 1.13, when ',
            code('textures/blocks'),
            ' became ',
            code('textures/block'),
            ' and hundreds of files got new names. Choose the old pack, pick ',
            strong('Java'),
            ' and your version, and every renamed texture moves to its new name. Texture names inside the pack’s own models are updated too.',
          ),
          p('It works backwards as well, for example to make a 26.3 pack for 1.8.9.'),
        ],
      },
      {
        id: 'install',
        title: 'Install the converted pack',
        body: [
          ul([
            ['Bedrock: open the ', code('.mcpack'), ' (double-click on Windows, Open with Minecraft on phones), then activate it under ', uiPath('Settings', 'Global Resources'), '.'],
            ['Java: put the ', code('.zip'), ' in the ', code('resourcepacks'), ' folder and move it to Selected.'],
          ]),
          p('More detail in ', link('/guides/install-resource-packs', 'How to install texture packs'), '. If something looks wrong, see ', link('/guides/texture-pack-not-working', 'Texture pack not working'), '.'),
        ],
      },
    ],
    faq: [
      { id: 'free', q: 'Is the converter free?', a: [p('Yes, with no account and no limits. The pack is converted in your browser and never uploaded.')] },
      { id: 'look', q: 'Will the pack look the same on Bedrock?', a: [p('Converted textures look the same. Textures that are skipped fall back to Bedrock’s own, and Bedrock’s lighting and Vibrant Visuals can make colours look a little different.')] },
      { id: 'shaders', q: 'Can I convert a Java shader pack to Bedrock?', a: [p('No. Bedrock does not load custom shader code. Use a ', link('/guides/bedrock-vibrant-visuals-settings', 'Vibrant Visuals'), ' pack instead, which you can make with the ', link('/shaders', 'Shader Maker'), '.')] },
      { id: 'png', q: 'Can I turn PNG files into an .mcpack?', a: [p('Yes. Choose a PNG, or a zip of PNGs, named like the game’s textures (for example ', code('stone.png'), '), and convert it to Bedrock.')] },
      { id: 'console', q: 'Can I use the converted pack on a console?', a: [p('Consoles cannot import files. Add the pack to a world on a PC or phone and join that world, or use a Realm or server that has it.')] },
    ],
    related: ['java-vs-bedrock-packs', 'install-resource-packs', 'texture-pack-not-working'],
    cta: { label: 'Open the Texture Pack Converter', to: '/texture-pack-converter', icon: 'repeat' },
  },

  // ------------------------------------------------------------ merge packs
  {
    meta: meta('merge-texture-packs'),
    image: SHOTS.mergeResult,
    intro: [
      p(
        'Minecraft can already stack texture packs: turn several on, and the one higher in the list wins wherever two change the same texture. Merging builds one pack from several, with that same order baked in. It is handy for a server or a Realm that takes a single pack, for sharing your favourite combination, or for keeping your pack list short. The free ',
        link('/merge-texture-packs', 'Merge Texture Packs'),
        ' tool does it in your browser.',
      ),
    ],
    quick: {
      title: 'The short version',
      items: [
        ['Open ', link('/merge-texture-packs', 'Merge Texture Packs'), ' and add two to eight packs of the same edition.'],
        'Drag them into order: the top pack wins every conflict.',
        'Click Merge, check the list of conflicts, then download the pack.',
      ],
    },
    howto: { name: 'How to merge Minecraft texture packs', steps: MERGE_STEPS },
    sections: [
      { id: 'steps', title: 'Step by step', body: [steps(MERGE_STEPS), figure(SHOTS.mergeSettings), figure(SHOTS.mergeResult)] },
      {
        id: 'wins',
        title: 'Which pack wins?',
        body: [
          p('The same rule Minecraft uses: for every file, the pack highest in the list wins. A texture and its animation file always travel together, so a lower pack’s animation is never attached to a higher pack’s picture.'),
          p('Some files are combined instead of replaced, so nothing useful is lost:'),
          ul([
            [strong('Java: '), 'language files (key by key), ', code('sounds.json'), ' (sound by sound), texture atlases and fonts.'],
            [strong('Bedrock: '), code('terrain_texture.json'), ', ', code('item_texture.json'), ', ', code('flipbook_textures.json'), ', ', code('blocks.json'), ', sound definitions and language files.'],
          ]),
          p('The result lists every conflict, such as “block/stone.png from Pack A, overriding Pack B”, and how many files each pack added.'),
        ],
      },
      {
        id: 'versions',
        title: 'Packs for different versions',
        body: [
          p(
            'Java packs made for different versions can be merged: pick the version you play and older packs are renamed to its texture names first (the same renames the ',
            link('/texture-pack-converter', 'converter'),
            ' uses), so a 1.12 pack and a 26.3 pack fit together. Java and Bedrock packs cannot be merged directly: convert one of them first.',
          ),
        ],
      },
      {
        id: 'by-hand',
        title: 'Merging packs by hand',
        body: [
          steps([
            'Unzip every pack into its own folder.',
            'Make a new folder and copy in the lowest-priority pack first, then each higher pack on top, replacing files when asked.',
            ['Merge the files that should be combined (', code('sounds.json'), ', language files, atlases) by hand, or the last copy wins.'],
            ['Keep one ', code('pack.mcmeta'), ' (Java) or write a new ', code('manifest.json'), ' with new IDs (Bedrock), then zip the contents.'],
          ]),
          p('The tool does all of this, including the combined files and the right pack format, so manual merging is only worth it for unusual packs.'),
        ],
      },
    ],
    faq: [
      { id: 'how-many', q: 'How many packs can I merge?', a: [p('Two to eight at a time. To combine more, merge the result again with the next packs.')] },
      { id: 'shaders', q: 'Can I merge shader packs?', a: [p('No. Iris and OptiFine shader packs only run one at a time. Vanilla shader resource packs can be merged like any resource pack, but two packs that change the same shader file will not combine their effects.')] },
      { id: 'server', q: 'Can I use a merged pack as a server resource pack?', a: [p('Yes. Upload the merged ', code('.zip'), ' wherever you host server packs and set it in ', code('server.properties'), ' like any other pack.')] },
      { id: 'upload', q: 'Are my packs uploaded?', a: [p('No. The packs are merged in your browser and stay on your device.')] },
    ],
    related: ['install-resource-packs', 'texture-pack-not-working', 'convert-java-to-bedrock-texture-pack'],
    cta: { label: 'Open Merge Texture Packs', to: '/merge-texture-packs', icon: 'git-merge' },
  },

  // ------------------------------------------------------------ 3D items and models
  {
    meta: meta('make-3d-items-texture-pack'),
    image: SHOTS.model3dSword,
    intro: [
      p(
        'The shape of a block or item in Minecraft Java Edition comes from its ',
        strong('model'),
        ': a small JSON file of cubes inside the resource pack. Put a new model in your texture pack and the shape changes, with no mods and no OptiFine: a flat sword becomes a 3D one, a block becomes a slab or a step. The ',
        link('/textures', 'Texture Pack Maker'),
        ' has a model editor that does this in your browser. It turns an item’s flat sprite into 3D cubes in one click, lets you change every cube, and writes the files your game version needs. Bedrock works differently, as explained below.',
      ),
    ],
    quick: {
      title: 'The short version',
      items: [
        ['In the Texture Pack Maker, show the item in the ', strong('Preview'), ' tab and press ', strong('Edit shape'), '.'],
        ['Pick ', strong('3D item from sprite'), ', then fine-tune the cubes and how the item is held.'],
        ['Export the pack. It holds the model in ', code('models/item/'), ' and, on 1.21.4 and newer, an item definition in ', code('items/'), ' when one is needed.'],
      ],
    },
    howto: { name: 'How to make a 3D item in a Minecraft texture pack', steps: MODEL_STEPS },
    sections: [
      {
        id: 'what',
        title: 'What a Minecraft model is',
        body: [
          p('Java Edition 1.8 and newer draws most blocks and items from model files in the resource pack:'),
          ul([
            [code('assets/minecraft/models/block/'), ' holds block models, such as ', code('oak_slab.json'), '. A ', strong('blockstate'), ' file in ', code('blockstates/'), ' says which model a block uses in each state: a slab at the bottom or the top, a log on its side.'],
            [code('assets/minecraft/models/item/'), ' holds item models. Most items use a flat model (', code('item/generated'), '): the game turns the 16×16 sprite into a thin shape by itself. Since 1.21.4, an ', strong('item model definition'), ' in ', code('assets/minecraft/items/'), ' says which model an item shows.'],
          ]),
          p('A model file has four main parts:'),
          ul([
            [code('textures'), ': names for the textures the model uses, such as ', code('"oak_planks": "minecraft:block/oak_planks"'), '. ', code('particle'), ' is the texture of the breaking particles.'],
            [code('elements'), ': the cubes. Each one runs ', code('from'), ' one corner ', code('to'), ' the opposite one, measured in pixels of a 16 × 16 × 16 block, and may reach from -16 to 32 on each axis. A cube can be turned with ', code('rotation'), '.'],
            [code('faces'), ': for each side of a cube (', code('down'), ', ', code('up'), ', ', code('north'), ', ', code('south'), ', ', code('west'), ', ', code('east'), '), the texture it shows, the part of the texture (', code('uv'), '), and ', code('cullface'), ', which skips the face when a full block covers that side.'],
            [code('display'), ': how the model is turned, moved and scaled in the inventory (', code('gui'), '), in the hands, on the ground, in an item frame (', code('fixed'), ') and on the head.'],
          ]),
          p('This is a one-cube model shaped like a slab, laid out the way the model editor writes it. A file made in the editor lists the display of every slot, not only the inventory:'),
          pre(MODEL_BLOCK_EXAMPLE.trimEnd()),
          p(
            'Hand-made models often use ',
            code('"parent"'),
            ' to borrow the textures, cubes or display of another model. The model editor writes self-contained files instead: everything it read from the parent models is copied in, so your file does not depend on another one.',
          ),
          callout('tip', 'Coordinates are pixels', 'One block is 16 units on each axis, so 8 is half a block. The model editor snaps to this grid, or to ½ or ¼ of a pixel, and shows sizes as “16 = one block”.'),
        ],
      },
      {
        id: 'steps',
        title: 'Make a 3D item step by step',
        body: [steps(MODEL_STEPS), figure(SHOTS.modelEditShape), figure(SHOTS.modelSpriteStart), figure(SHOTS.model3dSword)],
      },
      {
        id: 'sprite',
        title: 'How “3D item from sprite” works',
        body: [
          p(
            'A flat item is a single picture, its sprite, usually 16×16 pixels. The start point takes every pixel that is not transparent and builds cubes one pixel deep from them, centred the way the game centres its own flat items (from 7.5 to 8.5 on the z axis). Pixels in a row are joined into one long cube, and equal rows below each other into a rectangle, so the diamond sword becomes 19 cubes instead of one cube per pixel. Faces that a neighbouring pixel hides completely are left out.',
          ),
          p('Each face shows the matching pixels of the sprite. Three pixels in a row, in columns 5 to 7 of row 3, become this cube:'),
          pre(MODEL_SPRITE_CUBE.trimEnd()),
          p(
            'The front (',
            code('south'),
            ') shows the pixels as they are and the back (',
            code('north'),
            ') shows them mirrored, as you see a picture from behind. The cubes keep using the item’s own texture (',
            code('#layer0'),
            '), so repainting the sprite recolours the 3D item. Pixels you add or erase only change the shape when you pick ',
            strong('3D item from sprite'),
            ' again. Items with several layers, such as potions or leather armour, get cubes for every layer, and the game still colours them.',
          ),
          p('Then make it your own:'),
          ul([
            'Make the blade thicker: select its cubes and change their Z position and size, for example from 7.5 and 1 to 7 and 2.',
            ['Add a cube for a guard or a gem with the ', strong('+'), ' button (or N), and give its faces another texture under ', uiPath('Faces', 'Change'), '.'],
            ['Turn a cube under ', strong('Rotation'), '. Before Minecraft 1.21.6 a cube turns on one axis only, by -45°, -22.5°, 0°, 22.5° or 45°; the editor offers what your version accepts.'],
            'Undo any change with Ctrl+Z.',
          ]),
        ],
      },
      {
        id: 'display',
        title: 'Set how it is held: Display',
        body: [
          p(
            'The ',
            strong('Display'),
            ' tab previews the model in six places. Each has a rotation in degrees, a position in pixels (up to ±80) and a size (1 is normal, 4 at most).',
          ),
          table(
            ['In the editor', 'Where it is shown', 'Name in the file'],
            [
              ['Inventory', 'Inventory and hotbar', code('gui')],
              ['First person', 'In your own hand', [code('firstperson_righthand'), ' (the left hand is a mirror image)']],
              ['Third person', 'In the hand of a player you look at, or in F5 view', code('thirdperson_righthand')],
              ['Ground', 'Dropped on the ground', code('ground')],
              ['Item frame', 'In an item frame', code('fixed')],
              ['Head', 'Worn on the head', code('head')],
            ],
          ),
          p(
            strong('3D item from sprite'),
            ' keeps the item’s own display settings, so a 3D sword is held like the flat one. ',
            strong('Game’s default'),
            ' puts a slot back to the game’s values, and ',
            strong('No change'),
            ' removes the setting. Java 1.21.9 added an ',
            code('on_shelf'),
            ' slot for shelves; the editor keeps the value from the game’s model.',
          ),
          figure(SHOTS.modelDisplay),
        ],
      },
      {
        id: 'flat',
        title: 'Keep the flat icon in the inventory (1.21.4+)',
        body: [
          p(
            'Many 3D packs keep the familiar flat icon in the inventory and show the 3D model only in hand. Since Java 1.21.4, an item model definition can choose a model by where the item is shown. Turn on ',
            strong('Flat in the inventory'),
            ' in the ',
            strong('Model'),
            ' tab and the editor:',
          ),
          ul([
            ['saves your shape as a second model, ', code('models/item/diamond_sword_3d.json'), ', and leaves the flat ', code('diamond_sword.json'), ' as it is;'],
            ['writes ', code('items/diamond_sword.json'), ', which shows the flat model in the inventory (', code('gui'), '), on the ground and in item frames (', code('fixed'), '), and the 3D one everywhere else:'],
          ]),
          pre(MODEL_FLAT_DEFINITION.trimEnd()),
          p('Versions before 1.21.4 have no item definitions, so an item shows the same model everywhere and the switch is not offered.'),
          figure(SHOTS.modelFlatInventory),
        ],
      },
      {
        id: 'blocks',
        title: 'Change the shape of a block',
        body: [
          p(
            'Blocks work the same way. Show a block in the Preview tab and press ',
            strong('Edit shape'),
            '. The editor opens the model the block uses in the state you are looking at, and the menu at the top lists its other models, such as the top and double versions of a slab. Keep the game’s model or start from ',
            strong('Full cube'),
            ', ',
            strong('Slab'),
            ', ',
            strong('Cross (plant)'),
            ' or ',
            strong('Empty'),
            ', then add, move and resize cubes. Turning stone into a step takes the Slab start point and one more cube:',
          ),
          figure(SHOTS.modelBlock),
          ul([
            [strong('Shared models: '), 'some blocks use the same model file. When another block uses the model you edit, the editor tells you which; it changes too.'],
            [strong('Items stay separate: '), 'an item that shows a block model, such as a slab in your hand, gets its own item model when you edit the item, so the block keeps its shape.'],
            [strong('Only the look changes: '), 'the hitbox, collision and light come from the game’s code. A stone block shaped like a step still stops you like a full block, and the blocks next to it still hide the faces that touch it, which can leave see-through gaps.'],
            [strong('Blocks drawn by code: '), 'chests, beds, signs, banners and other blocks the game draws itself have no block model, so Edit shape is not offered for them. Items drawn by code, such as the shield, can be given a model, which replaces that look.'],
          ]),
          p(
            'Stone and some other blocks pick between two models at random: stone and a mirrored copy, each also turned around. ',
            strong('Use for every random variant'),
            ' in the Model tab puts your shape on all of them by writing the block’s blockstate file. The ',
            code('"y": 180'),
            ' entry keeps the random turn, and ',
            code('weight'),
            ' sets how often each entry is picked:',
          ),
          pre(MODEL_STONE_BLOCKSTATE.trimEnd()),
        ],
      },
      {
        id: 'files',
        title: 'Which files go in the pack',
        body: [
          table(
            ['What you change', 'Files in the pack'],
            [
              ['A 3D item', code(MODEL_FILES.sword.latest[0])],
              ['A 3D item, flat in the inventory (1.21.4+)', [code(MODEL_FILES.swordFlat.latest[0]), ' and ', code(MODEL_FILES.swordFlat.latest[1])]],
              ['A block’s shape', code(MODEL_FILES.slab.latest[0])],
              ['A block’s shape on every random variant', [code(MODEL_FILES.stoneEvery.latest[0]), ' and ', code(MODEL_FILES.stoneEvery.latest[1])]],
            ],
          ),
          p(
            'Every path is inside ',
            code('assets/minecraft/'),
            '. Every Java version from 1.8 gets the same files; only flat in the inventory needs 1.21.4 or newer. The editor adds an item definition or a blockstate only when the game needs one, and model files already in a pack you open are kept and can be edited. When you export, every model is checked against your game version, and you get a warning for anything that would not load.',
          ),
          el('h3', { class: 'guide-sub' }, 'What changed between versions'),
          table(
            ['Version', 'What changed for models'],
            [
              ['1.8', 'Block and item models became JSON files that resource packs can replace. Cubes turn on one axis by -45°, -22.5°, 0°, 22.5° or 45°.'],
              ['1.13', ['Texture folders renamed from ', code('blocks'), ' and ', code('items'), ' to ', code('block'), ' and ', code('item'), ', so texture names in models changed too.']],
              ['1.15.2', [code('gui_light'), ' sets whether the inventory icon is lit from the side (blocks) or the front (items).']],
              ['1.19.3', ['Model textures must sit in a folder the game’s texture atlases read, such as ', code('textures/block/'), ' or ', code('textures/item/'), '.']],
              ['1.21.4', ['Item model definitions in ', code('items/'), ' choose an item’s model, also by where it is shown.']],
              ['1.21.6', 'Cubes can turn by any angle from -45° to 45°.'],
              ['1.21.9', ['New display slot ', code('on_shelf'), '.']],
              ['1.21.11', 'Cubes can turn on several axes at once, by any angle.'],
            ],
          ),
          p('The model editor follows these rules for the version your pack is made for.'),
        ],
      },
      {
        id: 'install',
        title: 'Install and test it',
        body: [
          steps([
            ['Press ', strong('Done'), ' to leave the model editor, then ', strong('Export'), ' the pack as a ', code('.zip'), '.'],
            ['In Minecraft open ', uiPath('Options…', 'Resource Packs…', 'Open Pack Folder'), ', drop the zip in (keep it zipped) and move the pack to ', strong('Selected'), ', above other packs.'],
            'Hold the item, press F5 for third person, drop it, and put it in an item frame to check every display.',
            'After changing the model, export again, replace the zip and press F3 + T in game to reload the packs.',
          ]),
          p('More help: ', link('/guides/install-resource-packs', 'How to install resource packs'), ' and ', link('/guides/texture-pack-not-working', 'Texture pack not working'), '.'),
        ],
      },
      {
        id: 'bedrock',
        title: 'Bedrock Edition',
        body: [
          p('Bedrock packs work differently, and the model editor makes Java models only:'),
          ul([
            [strong('Blocks: '), 'a Bedrock resource pack cannot change the shape of the game’s blocks. A custom-shaped block is a new block, added by an add-on with a behaviour pack and a geometry file.'],
            [strong('Held items: '), 'Bedrock gives items a 3D model in hand with attachables, resource pack files that use Bedrock geometry and animation. The Texture Pack Maker does not make them; ', ext('https://www.blockbench.net/', 'Blockbench'), ' can.'],
            [strong('A starting point: '), 'in the model editor’s menu, ', strong('Download as Bedrock geometry'), ' saves your model as a ', code('.geo.json'), ' file (format 1.12.0, one bone, all cubes) to import into Blockbench or an add-on. Bedrock geometry uses a single texture, so each face keeps its place on its own texture.'],
          ]),
          p('In a Bedrock pack, ', strong('Edit shape'), ' explains this instead of opening the editor. Painting textures works as usual.'),
        ],
      },
      {
        id: 'problems',
        title: 'Common problems',
        body: [
          ul([
            [strong('Purple and black faces: '), 'a face uses a texture the game cannot find: a name (', code('#…'), ') that is not set under ', code('textures'), ', a file that is not in the game or the pack, or, since 1.19.3, a texture outside the atlas folders. The Model tab lists these problems with the cube they are on.'],
            [strong('A purple and black cube instead of the model: '), 'the file did not load. Usual causes are broken JSON, a cube outside -16 to 32, or a rotation the version does not allow. The game’s log names the file.'],
            [strong('The model does not show at all: '), 'check that the pack is selected and above other packs, that the file has exactly the name and folder of the model it replaces, and, on 1.21.4 and newer, that a new model (such as a ', code('_3d'), ' copy) has an item definition pointing at it.'],
            [strong('Fine in hand, odd in the inventory: '), ['adjust the Inventory display, try the other inventory light (side or front), or turn on ', strong('Flat in the inventory'), '.']],
            [strong('Too many cubes: '), 'every cube adds faces to draw. That hardly matters for an item in your hand, but a block placed thousands of times should stay simple. Keep the joined cubes that 3D item from sprite makes instead of splitting them up.'],
            [strong('An angle is not allowed: '), 'before 1.21.6 a cube turns by 22.5° steps up to 45°, on one axis. For a quarter turn, swap the cube’s size on two axes instead; for other shapes, build them from more cubes.'],
          ]),
          p('More fixes for packs in general: ', link('/guides/texture-pack-not-working', 'Texture pack not working? Fixes'), '.'),
        ],
      },
    ],
    faq: [
      {
        id: 'mods',
        q: 'Do I need OptiFine or a mod for 3D items?',
        a: [p('No. Java resource packs have been able to replace block and item models since 1.8, so a pack with model files works in the normal game. It changes every item of that type.')],
      },
      {
        id: 'renamed',
        q: 'Can only a renamed item be 3D?',
        a: [
          p(
            'Not with a plain model change. Packs that change only renamed items use OptiFine’s custom item textures (CIT) or a mod that reads them. Since 1.21.4, item definitions can also pick a model by ',
            code('custom_model_data'),
            ', which servers and map makers set with commands. The model editor changes every item of a type.',
          ),
        ],
      },
      {
        id: 'bedrock',
        q: 'Can I make 3D items on Bedrock?',
        a: [p('Yes, with attachables in a Bedrock resource pack, made in a tool such as Blockbench. This model editor makes Java models, but it can download a model as Bedrock geometry to start from. Bedrock resource packs cannot change the shape of the game’s blocks.')],
      },
      {
        id: 'blockbench',
        q: 'Can I use models made in Blockbench?',
        a: [p('Yes. Java block and item models exported from Blockbench are ordinary model files. Put them in your pack under the name of the model they replace and open the pack with ', strong('Open a pack'), ': the files are kept, and the model editor can open and change them.')],
      },
      {
        id: 'undo',
        q: 'How do I go back to the original shape?',
        a: [p('In the model editor’s menu, choose ', strong('Put back the original model'), '. Your files for that model are removed from the pack and the game’s model is used again.')],
      },
      {
        id: 'phone',
        q: 'Can I make 3D items on a phone?',
        a: [p('Yes. On a phone the 3D view sits above the panels and you work with touch. The pack still has to be a Java pack, so you play it on a computer.')],
      },
    ],
    related: ['make-a-texture-pack', 'texture-pack-not-working', 'install-resource-packs'],
    cta: { label: 'Open the Texture Pack Maker', to: '/textures', icon: 'shapes' },
  },

  // ------------------------------------------------------------ PvP pack
  {
    meta: meta('make-a-pvp-texture-pack'),
    image: SHOTS.pvpTweaks,
    intro: [
      p(
        'A PvP texture pack changes the things that get in your way in a fight: the fire that covers half the screen while you burn, glass you cannot see through, the dark pumpkin view, a big crosshair and a sword that hides the player you are hitting. FPS packs go further and make textures smaller and still, so weaker computers keep up. All of this is ordinary resource pack files, no mods needed. The ',
        link('/textures', 'Texture Pack Maker'),
        ' makes them in your browser with one switch each, for Java 1.8.9 (the version many PvP servers are built around) up to ',
        LATEST,
        ', and partly for Bedrock.',
      ),
    ],
    quick: {
      title: 'The short version',
      items: [
        ['In the Texture Pack Maker, pick ', strong('PvP / FPS pack'), ' and the Minecraft version you play, then ', strong('Create PvP pack'), '.'],
        ['In the ', strong('PvP'), ' tab, choose the fire height, crosshair, sword size and the FPS options you want.'],
        ['Export the pack and select it in Minecraft above your other packs.'],
      ],
    },
    howto: { name: 'How to make a PvP texture pack with Texture Pack Maker', steps: PVP_STEPS },
    sections: [
      {
        id: 'what',
        title: 'What a PvP pack changes',
        body: [
          p('Most PvP and FPS packs, from Bedwars packs to “FPS boost” packs, are a mix of the same few changes. Each one below is a switch in the editor’s PvP tab:'),
          table(
            ['Change', 'What it does', 'Java', 'Bedrock'],
            [
              ['Low fire', 'The flames on your screen while you burn sit lower.', 'Every version', 'No'],
              ['Clear glass', 'Glass, stained glass and panes are see-through inside and keep their border.', 'Every version', 'Yes'],
              ['No pumpkin blur', 'A carved pumpkin on your head no longer darkens the screen.', 'Every version', 'Yes'],
              ['Custom crosshair', 'A smaller crosshair: a dot, a small cross, a cross with a gap, a circle or an X, or one you draw.', 'Every version', 'Yes'],
              ['Smaller swords', 'Swords, or every weapon, look smaller and lower in first person.', '1.8 and newer', 'No'],
              ['Lower shield', 'The shield sits lower in first person, also while blocking.', '1.9 and newer', 'No'],
              ['8× textures', 'Blocks (and items) at 8 × 8 pixels.', 'Every version', 'Yes'],
              ['No animations', 'Water, lava, fire and portals stand still.', 'Every version', 'No'],
            ],
          ),
          p('Each switch writes normal pack files, so you can still paint over them. Switching one off puts back the files it changed, apart from any you painted or edited since. The table at the end lists the exact files for each version.'),
        ],
      },
      {
        id: 'steps',
        title: 'Make a PvP pack step by step',
        body: [steps(PVP_STEPS), figure(SHOTS.pvpStart), figure(SHOTS.pvpTweaks)],
      },
      {
        id: 'fire',
        title: 'Low fire',
        body: [
          p(
            'Java draws the burning overlay with one texture: ',
            code('textures/block/fire_1.png'),
            ' (',
            code('textures/blocks/fire_layer_1.png'),
            ' before 1.13). It is an animated strip of 32 frames, and Low fire moves the flames in every frame down by 5, 8 or 11 pixels of 16 (',
            strong('Low'),
            ', ',
            strong('Lower'),
            ', ',
            strong('Lowest'),
            '), so the top of your screen stays clear. The animation keeps playing.',
          ),
          p(
            'Fire blocks use the same texture, so a plain low fire pack also makes fire in the world look cut off. With ',
            strong('Keep fire blocks as they are'),
            ' (Java 1.8 and newer), the pack gets a copy of the original texture, ',
            code('fire_1_world.png'),
            ', and the fire block models are pointed at it. Players and mobs on fire still show the lower flames.',
          ),
        ],
      },
      {
        id: 'glass',
        title: 'Clear glass and no pumpkin blur',
        body: [
          p(
            'Clear glass keeps the outer ring of pixels, one pixel at 16× and two at 32×, and makes everything inside it clear. That covers ',
            code('glass.png'),
            ' and the 16 stained glass textures (',
            code('red_stained_glass.png'),
            ' and so on; before 1.13 ',
            code('glass_red.png'),
            ', with ',
            code('glass_silver.png'),
            ' for light grey). Glass panes use the same textures, so they turn clear too. Pick ',
            strong('Light tint'),
            ' to keep a faint colour in stained glass, so teams can still tell the colours apart.',
          ),
          p('No pumpkin blur replaces ', code('textures/misc/pumpkinblur.png'), ', the picture the game lays over your view while you wear a carved pumpkin, with a fully clear one of the same size. On Bedrock the file is ', code('textures/misc/pumpkinblur.png'), ' too.'),
        ],
      },
      {
        id: 'crosshair',
        title: 'Custom crosshair',
        body: [
          p('Where the crosshair lives depends on the version:'),
          ul([
            [strong('Java 1.20.1 and older, and Bedrock: '), 'the top-left 16 × 16 square of ', code('textures/gui/icons.png'), ', a sheet that also holds the hearts, hunger and armour icons. Only that square changes.'],
            [strong('Java 1.20.2 and newer: '), 'its own 15 × 15 file, ', code('textures/gui/sprites/hud/crosshair.png'), '.'],
          ]),
          p(
            'Pick one of five designs, drawn for the editor, or press ',
            strong('Draw your own'),
            ': the editor opens the crosshair texture and, on a sheet, selects the crosshair square for you. Java draws the crosshair inverted over what is behind it, so paint it white or grey; other colours come out changed. The game centres it on the middle pixel, (7, 7).',
          ),
          figure(SHOTS.pvpCrosshair),
        ],
      },
      {
        id: 'swords',
        title: 'Smaller swords and a lower shield',
        body: [
          p(
            'How an item sits in your hand comes from the ',
            code('display'),
            ' part of its model file: a rotation, a position and a size for each place it is shown. Smaller swords sets only the first-person slots, to 80, 65 or 50 % of the size and a little lower, so the grip stays near your hand. Other players, third person and the inventory still show the normal sword. ',
            strong('All weapons'),
            ' does the same for axes, the mace and spears, where your version has them.',
          ),
          p('Java 1.8 has one slot, ', code('firstperson'), ', in each sword’s own file. This is the diamond sword at ', strong('Smaller'), ':'),
          pre(PVP_SWORD_189.trimEnd()),
          p(
            'From 1.9 there are two slots, ',
            code('firstperson_righthand'),
            ' and ',
            code('firstperson_lefthand'),
            ', and swords borrow them from ',
            code('item/handheld'),
            '. The file keeps its parent, so the sword stays a flat item, and gets both slots:',
          ),
          pre(PVP_SWORD_LATEST.trimEnd()),
          p(
            'Lower shield moves the shield down by 3 or 6 pixels in ',
            code('models/item/shield.json'),
            ' and ',
            code('shield_blocking.json'),
            ' (Java 1.9 and newer; from 1.21.4 the game still reads the shield’s hand pose from these files). If you made your own sword or shield model in the ',
            link('/guides/make-3d-items-texture-pack', 'model editor'),
            ', only its first-person slots change and your shape stays.',
          ),
        ],
      },
      {
        id: 'fps',
        title: 'FPS boost: 8× textures and no animations',
        body: [
          p(
            strong('8× textures'),
            ' shrinks block textures, and items if you like, to 8 × 8 pixels when you export. Leaves, glass and plants keep hard edges. ',
            strong('No animations'),
            ' keeps only the first frame of animated textures and drops their animation from the ',
            code('.mcmeta'),
            ' file, so the game no longer updates them every tick (Java; compasses and clocks keep working). Both are effect layers, listed in the Effects tab too, so your own textures are not changed.',
          ),
          callout(
            'info',
            'How much faster?',
            'Smaller and still textures use less video memory and less work per frame, which helps most on older computers and integrated graphics. The biggest FPS gains come from render distance, particles and mods such as Sodium or OptiFine, which a texture pack cannot change.',
          ),
        ],
      },
      {
        id: 'files',
        title: 'Which files go in the pack',
        body: [
          table(
            ['', ...PVP_EXAMPLE_FILES.map((e) => e.label)],
            [
              ['Low fire', ...PVP_EXAMPLE_FILES.map((e) => (e.files.lowFire ? code(e.files.lowFire) : '—'))],
              ['Clear glass', ...PVP_EXAMPLE_FILES.map((e) => code(e.files.glass))],
              ['No pumpkin blur', ...PVP_EXAMPLE_FILES.map((e) => code(e.files.pumpkin))],
              ['Crosshair', ...PVP_EXAMPLE_FILES.map((e) => code(e.files.crosshair))],
              ['Smaller swords', ...PVP_EXAMPLE_FILES.map((e) => (e.files.sword ? code(e.files.sword) : '—'))],
              ['Lower shield', ...PVP_EXAMPLE_FILES.map((e) => (e.files.shield ? code(e.files.shield) : '—'))],
            ],
          ),
          p('Glass stands for every glass texture next to it, and the sword for every sword. The editor works out the paths for the version of your pack, so you do not have to.'),
        ],
      },
      {
        id: 'bedrock',
        title: 'Bedrock Edition',
        body: [
          p('Clear glass, no pumpkin blur, the crosshair and 8× textures work in a Bedrock pack. The others are switched off there, with the reason:'),
          ul([
            [strong('Low fire: '), 'Bedrock draws the fire on your screen in its own way, which a texture pack cannot lower reliably.'],
            [strong('Swords and shield: '), 'Bedrock poses held items with attachable files, as add-ons do, which the editor does not make.'],
            [strong('No animations: '), 'Bedrock plays animated textures from a frame list in ', code('flipbook_textures.json'), ' that a pack cannot take away.'],
          ]),
          figure(SHOTS.pvpBedrock),
        ],
      },
      {
        id: 'install',
        title: 'Install and test it',
        body: [
          steps([
            ['Press ', strong('Export'), ' and download the ', code('.zip'), ' (Java) or ', code('.mcpack'), ' (Bedrock).'],
            ['Java: open ', uiPath('Options…', 'Resource Packs…', 'Open Pack Folder'), ', drop the zip in and move the pack to the top of ', strong('Selected'), '. Bedrock: open the .mcpack and turn the pack on under ', uiPath('Settings', 'Global Resources'), '.'],
            'Set yourself on fire, look through glass, wear a pumpkin and hold a sword and shield to check every change.',
          ]),
          p(
            'Not what you expected? Another pack above yours may replace the same files. More help: ',
            link('/guides/install-resource-packs', 'How to install resource packs'),
            ' and ',
            link('/guides/texture-pack-not-working', 'Texture pack not working'),
            '.',
          ),
        ],
      },
    ],
    faq: [
      {
        id: 'allowed',
        q: 'Are PvP texture packs allowed on servers?',
        a: [p('A texture pack only changes how the game looks, and the changes here (lower fire, clear glass, a smaller sword) are the kind most servers allow. Packs that show things you could not see otherwise, such as ores through stone, are usually banned. Each server has its own rules, so check them.')],
      },
      {
        id: 'fps',
        q: 'Does an FPS pack really give more FPS?',
        a: [p('Some, mostly on weaker computers: 8× textures use less video memory and still textures save work every tick. On a fast PC the difference is small. Render distance, particles and mods like Sodium or OptiFine matter much more.')],
      },
      {
        id: 'version',
        q: 'Which version should I make my PvP pack for?',
        a: [p('The version you play. Many PvP servers run on 1.8.9, and a 1.8.9 pack has different file names from a modern one. To use one pack in several versions, set a range in the ', strong('Pack'), ' tab: the game lists it as compatible, but files only work where the names match.')],
      },
      {
        id: 'short',
        q: 'Can I make a short sword instead of a small one?',
        a: [p('Yes: paint a shorter blade on the sword’s texture, as many 1.8.9 packs do. That changes the sword everywhere, also in the inventory and in other players’ hands. Smaller swords changes only how big it looks in your own hand. You can do both.')],
      },
      {
        id: 'crosshair',
        q: 'Why is my coloured crosshair the wrong colour?',
        a: [p('Java draws the crosshair inverted over what is behind it, so a white crosshair shows dark on bright sky and light on dark ground. Colours mix with the background the same way. Use white or grey.')],
      },
      {
        id: 'mods',
        q: 'Can a texture pack add zoom, an FPS counter or remove fog?',
        a: [p('No. Zoom, FPS and key displays, toggle sprint, removing fog and motion blur need a mod (OptiFine, Sodium and others), a PvP client or the game’s own settings. A pack only changes textures, models, sounds and similar files.')],
      },
    ],
    related: ['make-a-texture-pack', 'make-3d-items-texture-pack', 'install-resource-packs'],
    cta: { label: 'Make a PvP pack', to: '/textures?start=pvp', icon: 'sword' },
  },
  // ------------------------------------------------------------ PBR pack
  {
    meta: meta('make-a-pbr-texture-pack'),
    intro: [
      p(
        'A PBR texture pack gives blocks more than colours: how shiny they are, which parts are metal, which parts glow and how bumpy they look in the light. Minecraft Bedrock’s Vibrant Visuals reads these maps from texture sets, and on Java, PBR shaders for Iris and OptiFine read them in the labPBR format. The ',
        link('/textures', 'Texture Pack Maker'),
        ' makes both in your browser from your textures, with quick materials such as metal, glass and glowing ore spots.',
      ),
    ],
    quick: {
      title: 'The short version',
      items: [
        ['Open a texture and the ', strong('Material'), ' tab.'],
        ['Pick a quick material, then fine-tune shine, metal, glow and bumps on the lit 3D block.'],
        ['Export: the editor writes the right files for your edition, next to the textures.'],
      ],
    },
    howto: { name: 'How to make a PBR texture pack with Texture Pack Maker', steps: PBR_STEPS },
    sections: [
      {
        id: 'maps',
        title: 'What the maps do',
        body: [
          p('Each pixel of a texture gets a few extra numbers. The Material tab calls them by what you see; the table shows where each one goes in the files:'),
          table(
            ['In the editor', 'What it does', 'Java (labPBR)', 'Bedrock (texture set)'],
            [
              ['Shine', 'Smooth surfaces show sharp highlights and reflections, rough ones look matte.', [code('_s'), ' red: smoothness'], ['MER blue: roughness']],
              ['Metal', 'Metal reflects the sky in its own colour, like iron or gold.', [code('_s'), ' green: 230–255'], ['MER red: metalness']],
              ['Glow', 'Gives off light, even at night, like glowstone or ore gems.', [code('_s'), ' alpha: 0–254'], ['MER green: emissive']],
              ['Light through', 'Light shines through thin parts, like leaves.', [code('_s'), ' blue: 65–255'], ['MERS alpha (Vibrant Visuals only)']],
              ['Bumps', 'Light and shadow show bumps and dents on a flat face.', [code('_n'), ' red and green, height in alpha'], ['A normal map']],
            ],
          ),
          p('Without a material a texture looks as it always does. On Java the colour texture stays where it is; the maps sit next to it.'),
        ],
      },
      {
        id: 'steps',
        title: 'Make one step by step',
        body: [steps(PBR_STEPS)],
      },
      {
        id: 'parts',
        title: 'Glowing ore spots and other parts',
        body: [
          p(
            'A part gives some pixels their own values. ',
            strong('Colourful pixels'),
            ' picks out the gems of an ore from the grey stone around them, ',
            strong('Bright pixels'),
            ' the light of a lamp, ',
            strong('Pixels of some colours'),
            ' exactly the colours you click, and ',
            strong('An area you select'),
            ' a rectangle you drew with the select tool. A small picture shows which pixels a part covers.',
          ),
          p(
            strong('Use on similar textures'),
            ' copies the material to the other sides of the same block and to every texture whose name ends or starts with the same word: all ',
            code('*_ore'),
            ' textures, all ',
            code('oak_*'),
            ' ones and so on. Each keeps its own colours, so the parts and bumps follow its pixels.',
          ),
        ],
      },
      {
        id: 'java',
        title: 'Java: labPBR maps for shaders',
        body: [
          p(
            'Java has no PBR of its own: a shader pack in Iris or OptiFine draws it. The editor writes the two labPBR maps next to each texture, for example ',
            code('assets/minecraft/textures/block/stone_n.png'),
            ' and ',
            code('stone_s.png'),
            ' (',
            code('textures/blocks/'),
            ' before 1.13), at the size of the texture as it is exported. Smoothness is perceptual (1 minus the roughness), non-metals get an F0 of about 4 %, and a pixel with no glow has alpha 255 so that images without alpha never glow.',
          ),
          p(
            'Turn on a shader that reads labPBR maps; in its settings this is often called labPBR or resource pack support, and the shader decides how strong reflections and glow are. The shaders from this site’s ',
            link('/shaders', 'shader maker'),
            ' don’t use these maps yet.',
          ),
        ],
      },
      {
        id: 'bedrock',
        title: 'Bedrock: texture sets for Vibrant Visuals',
        body: [
          p('Bedrock reads a texture set next to the colour texture. Glowing spots and bumps are images:'),
          pre(PBR_TEXTURE_SET.trimEnd()),
          p('One value for the whole texture needs no image:'),
          pre(PBR_UNIFORM_SET.trimEnd()),
          p(
            'Light through is the fourth channel of ',
            code('metalness_emissive_roughness_subsurface'),
            ' (format 1.21.30, Vibrant Visuals only), written as a TGA so its alpha stays as it is. A texture set may only name images in the same pack, so the editor adds the colour texture too, even when you did not repaint it. The pack declares the ',
            code('pbr'),
            ' capability, without which Vibrant Visuals stays off:',
          ),
          pre(PBR_MANIFEST.trimEnd()),
          p(
            'The game has texture sets of its own for most blocks. With Vibrant Visuals on, a game set would show the game’s colour texture instead of yours, so every texture you change without a material gets a copy of the game’s set in your pack. ',
            link('/guides/bedrock-vibrant-visuals-settings', 'Vibrant Visuals settings explained'),
            '.',
          ),
        ],
      },
      {
        id: 'open',
        title: 'Open a pack that has PBR maps',
        body: [
          p('Open a Java pack with labPBR maps or a Bedrock pack with texture sets, and its maps show in the Material tab of their textures. They are exported exactly as they were until you change that material.'),
        ],
      },
    ],
    faq: [
      {
        id: 'rtx',
        q: 'Do I need an RTX graphics card?',
        a: [p('No. Vibrant Visuals runs on many PCs, consoles and newer phones, and labPBR shaders run on most graphics cards that can run shaders. Bedrock’s older ray tracing mode reads the same texture sets, except materials that let light through: those use a layer only Vibrant Visuals reads.')],
      },
      {
        id: 'same',
        q: 'Why does my pack look the same in game?',
        a: [p('Bedrock: set the graphics mode to Vibrant Visuals and put the pack at the top of your global resources. Java: turn on a shader with labPBR support and check its material or resource pack setting. Without one of those, Minecraft shows only the colours.')],
      },
      {
        id: 'items',
        q: 'Do materials work on items and mobs?',
        a: [p('Yes, in Vibrant Visuals and in most labPBR shaders. The editor always writes normal maps, never height maps, because Vibrant Visuals can’t use height maps on items.')],
      },
      {
        id: 'metal',
        q: 'Why should metal be 0 or 100?',
        a: [p('Real things are metal or not, and both labPBR and Vibrant Visuals treat a pixel as one or the other. Values in between look grey and dull. For a shiny stone, raise Shine and keep Metal at 0.')],
      },
    ],
    related: ['bedrock-vibrant-visuals-settings', 'make-a-texture-pack', 'install-resource-packs'],
    cta: { label: 'Open the Texture Pack Maker', to: '/textures', icon: 'diamond-gem' },
  },
  // ------------------------------------------------------------ name-based textures
  {
    meta: meta('rename-items-texture-pack'),
    intro: [
      p(
        'In Minecraft you can rename any item in an anvil. A resource pack can give a renamed item a texture of its own: a diamond sword named “Excalibur” can shine gold while every other diamond sword stays the same. Java 1.21.5 and newer do this without mods; older versions need OptiFine or the CIT Resewn mod. The ',
        link('/textures', 'Texture Pack Maker'),
        ' writes the right files for your version.',
      ),
    ],
    quick: {
      title: 'The short version',
      items: [
        ['Open an item’s texture and choose ', strong('Name-based textures'), '.'],
        ['Type the name and paint the new texture.'],
        ['Export, then rename the item in an anvil to exactly that name.'],
      ],
    },
    howto: { name: 'How to give a renamed item its own texture with Texture Pack Maker', steps: NAMES_STEPS },
    sections: [
      {
        id: 'steps',
        title: 'Make one step by step',
        body: [steps(NAMES_STEPS)],
      },
      {
        id: 'names',
        title: 'How names match',
        body: [
          ul([
            ['The name must be exactly the same, capital letters too: ', strong('Excalibur'), ' and ', strong('excalibur'), ' are different names. Add both if you want both to work.'],
            'Several names can share one texture, and one item can have many name-based textures.',
            'An anvil takes names up to 50 characters long, without colour codes. A name given colours or bold with commands doesn’t match a plain name.',
            'It changes the item in the hand, the inventory, on the ground and in item frames. A block placed from a renamed item looks as usual.',
          ]),
        ],
      },
      {
        id: 'vanilla',
        title: 'Java 1.21.5 and newer: no mods',
        body: [
          p(
            'Since 1.21.5 an item definition (',
            code('assets/minecraft/items/<item>.json'),
            ') can pick a model by the item’s name with a ',
            code('minecraft:select'),
            ' on the ',
            code('minecraft:component'),
            ' property and the ',
            code('minecraft:custom_name'),
            ' component. Anything else falls back to the item’s normal model:',
          ),
          pre(NAMES_DEFINITION.trimEnd()),
          p('The named model is the item’s own model with the new picture, so the sword is still held like a sword:'),
          pre(NAMES_MODEL.trimEnd()),
          p(
            'If the pack already changes that item definition, for example with a 3D model made in the model editor, the names go in front of it. Java 1.21.4 has item definitions too, but can’t read an item’s name yet, so it gets the OptiFine files below. ',
            link('/guides/make-3d-items-texture-pack', 'How item definitions and 3D items work'),
            '.',
          ),
        ],
      },
      {
        id: 'optifine',
        title: 'Before 1.21.5: OptiFine or CIT Resewn',
        body: [
          p(
            'Older versions can’t pick a texture by name on their own. OptiFine’s Custom Item Textures (CIT) can, and so can the CIT Resewn mod for Fabric. The editor writes one ',
            code('.properties'),
            ' file per name-based texture in ',
            code('assets/minecraft/optifine/cit/'),
            ':',
          ),
          pre(NAMES_CIT.trimEnd()),
          p(
            'One name is written as it is; several become a ',
            code('regex:'),
            ' rule. From 1.20.5 the editor writes ',
            code('components.custom_name'),
            ' instead of ',
            code('nbt.display.Name'),
            '; both mods read either. A texture with a 3D shape uses ',
            code('model='),
            ' instead of ',
            code('texture='),
            '. A pack whose version range reaches from before 1.21.5 to after it gets both kinds of files.',
          ),
          callout('warn', 'Players need the mod', 'Without OptiFine or CIT Resewn, Minecraft before 1.21.5 shows the normal texture, whatever the item is called.'),
        ],
      },
      {
        id: 'bedrock',
        title: 'Bedrock Edition',
        body: [
          p('Bedrock resource packs can’t change how an item looks by its name. The game’s item names in Molang (such as ', code('query.is_item_name_any'), ') are item ids like ', code('minecraft:diamond_sword'), ', not the names players give them in an anvil, so the editor doesn’t offer name-based textures for Bedrock packs.'),
        ],
      },
      {
        id: 'open',
        title: 'Open a pack that has them',
        body: [
          p(
            'Open a Java pack and its name-based textures show up under the item’s texture and in the window: OptiFine CIT rules for one item with a name and a texture or model, and 1.21.5+ item definitions that pick a model by name. Rules that check more than the name (damage, enchantments, several items) stay in the pack as they are. A rule with an OptiFine pattern such as ',
            code('ipattern:*sword*'),
            ' keeps it, and keeps working only with OptiFine and CIT Resewn.',
          ),
        ],
      },
    ],
    faq: [
      {
        id: 'not-working',
        q: 'My renamed item still looks normal. Why?',
        a: [p('Check that the name is exactly the same, capital letters and spaces too, that the pack is turned on and above other packs, and that you play 1.21.5 or newer, or have OptiFine or CIT Resewn on an older version. An item renamed before you added the pack works too: the name is checked every time the item is drawn.')],
      },
      {
        id: 'case',
        q: 'Can a name ignore capital letters?',
        a: [p('Not in vanilla Minecraft: the name must match exactly. Add each spelling you want as its own name. OptiFine packs can use patterns that ignore capitals; opened packs keep theirs.')],
      },
      {
        id: 'shape',
        q: 'Can a renamed item be 3D?',
        a: [p('Yes. Press 3D shape on a name-based texture to open the model editor for it, and start from a 3D item made from your new picture.')],
      },
      {
        id: 'servers',
        q: 'Do other players see it?',
        a: [p('Players who use your pack see it, on servers too. The name itself is part of the item, so everyone sees the name; only the texture needs the pack.')],
      },
    ],
    related: ['make-3d-items-texture-pack', 'make-a-texture-pack', 'install-resource-packs'],
    cta: { label: 'Open the Texture Pack Maker', to: '/textures', icon: 'label' },
  },
  // ------------------------------------------------------------ animated textures
  {
    meta: meta('make-animated-textures'),
    intro: [
      p(
        'An animated texture is a tall picture of frames, one under the other, that the game shows one after another. Water, lava, fire and portals work this way, and a pack can animate other blocks and items too. The ',
        link('/textures', 'Texture Pack Maker'),
        ' turns any block or item into an animation, plays it at game speed while you paint, imports GIFs and writes the files each edition needs: a ',
        code('.png.mcmeta'),
        ' file for Java and a flipbook entry for Bedrock.',
      ),
    ],
    quick: {
      title: 'The short version',
      items: [
        ['Open a texture and choose ', strong('Make animated'), ' in its menu.'],
        ['Paint the frames, add more with ', strong('+'), ', and set the speed in ticks.'],
        ['Export: the editor writes the animation files for your edition.'],
      ],
    },
    howto: { name: 'How to make an animated texture with Texture Pack Maker', steps: ANIM_STEPS },
    sections: [
      {
        id: 'steps',
        title: 'Make one step by step',
        body: [steps(ANIM_STEPS)],
      },
      {
        id: 'frames',
        title: 'Frames, onion skin and the strip',
        body: [
          ul([
            ['Drag a frame to a new place with the mouse. On a phone or tablet use ', strong('Move earlier'), ' and ', strong('Move later'), ' in the ⋯ menu.'],
            ['After clicking a frame: Alt + arrow keys move it, Delete deletes it, and Ctrl+C and Ctrl+V copy it and paste it as a new frame, into any animation of the pack. The comma and full stop keys step through the frames while you paint.'],
            ['The onion skin shows the frame before faintly over the one you paint, so movement lines up. The ⋯ menu shows the next frame too.'],
            ['Deleting frames down to one, or ', strong('Stop animating'), ', makes the texture still again. Both can be undone.'],
          ]),
        ],
      },
      {
        id: 'ticks',
        title: 'Timing in ticks',
        body: [
          p('Minecraft counts time in ticks: 20 ticks make 1 second, so one tick is 0.05 seconds. Every frame shows for a whole number of ticks:'),
          table(
            ['Ticks per frame', 'Seconds', 'Frames a second'],
            [
              ['1', '0.05 s', '20'],
              ['2', '0.1 s', '10'],
              ['4', '0.2 s', '5'],
              ['10', '0.5 s', '2'],
              ['20', '1 s', '1'],
            ],
          ),
          ul([
            [strong('Each frame shows for'), ' sets the speed of every frame. A new animation starts at 4 ticks.'],
            [strong('Frame times'), ' give single frames a time of their own, for a pause or a quick flash.'],
            [strong('Blend frames'), ' fades each frame into the next tick by tick, like flowing water. It looks best with slow frames.'],
            [strong('Play order'), ' plays frames in any order and as often as you like: ', code('1, 2, 3, 2'), ' bounces back, ', code('1-8'), ' plays a run, and ', code('3:40'), ' holds frame 3 for 40 ticks.'],
          ]),
        ],
      },
      {
        id: 'java',
        title: 'Java Edition: the .png.mcmeta file',
        body: [
          p(
            'Java reads an animation from a file named like the texture plus ',
            code('.mcmeta'),
            ', next to it: ',
            code('stone.png'),
            ' gets ',
            code('stone.png.mcmeta'),
            '. Frames run top to bottom, ',
            code('frametime'),
            ' is the speed in ticks (1 when it is left out) and ',
            code('frames'),
            ' lists the play order, with a ',
            code('time'),
            ' for frames shown longer:',
          ),
          pre(ANIM_MCMETA.trimEnd()),
          p('Frames that aren’t squares need their size, from 1.13 on. The game then reads them in rows, left to right:'),
          pre(ANIM_MCMETA_WIDE.trimEnd()),
          table(
            ['Version', 'What the animation can do'],
            [
              ['1.6.1 – 1.7.10', ['Speed (', code('frametime'), ') and play order with times (', code('frames'), '). Frames are squares as wide as the image.']],
              ['1.8 – 1.12.2', ['Blending (', code('interpolate'), ') too.']],
              ['1.13 and newer', ['Frames of any size (', code('width'), ', ', code('height'), ').']],
              ['1.21.2 and newer', 'Blending fades see-through pixels too. Before, only the colours blend and each frame keeps its own transparency.'],
            ],
          ),
          p(
            'The editor writes what the oldest version of your pack reads and warns you on export when a version in its range can’t play part of it. Java animates the textures it gathers on a texture atlas: blocks and items in every version, particles, paintings and effect icons from 1.14, chests, beds, signs, banners, shields and shulker boxes from 1.15, and the GUI sprites of 1.20.2 and newer. Mob skins, armour, fonts, colour maps and the pack icon are drawn on their own and stay still, so the editor says so instead of animating them.',
          ),
        ],
      },
      {
        id: 'bedrock',
        title: 'Bedrock Edition: flipbook textures',
        body: [
          p(
            'Bedrock lists its animations in ',
            code('textures/flipbook_textures.json'),
            '. Each entry names the texture and the block tile from ',
            code('terrain_texture.json'),
            ' that shows it:',
          ),
          pre(ANIM_FLIPBOOK.trimEnd()),
          table(
            ['Field', 'What it does'],
            [
              [code('flipbook_texture'), 'The texture’s path, without the file extension.'],
              [code('atlas_tile'), ['The block tile in ', code('terrain_texture.json'), ' to animate.']],
              [[code('atlas_index'), ', ', code('atlas_tile_variant')], 'Which texture of a tile with several (from 0).'],
              [code('ticks_per_frame'), 'Ticks each frame shows (20 ticks = 1 second). One speed for every frame.'],
              [code('frames'), 'The play order. A frame shown longer is listed again.'],
              [code('blend_frames'), ['Fades frames into each other; on when left out. The editor writes ', code('false'), ' unless you turn on Blend frames.']],
              [code('replicate'), 'Used by the game’s flowing water and lava; kept as it is.'],
            ],
          ),
          p(
            'Frames are squares as wide as the image, top to bottom. The editor writes the game’s own entries along with yours, so water, lava, fire and the other animated blocks keep moving.',
          ),
          callout(
            'info',
            'Bedrock animates blocks only',
            'Bedrock resource packs have no animations for items: ',
            code('item_texture.json'),
            ' has nothing like a flipbook. The editor says so when you try to animate an item in a Bedrock pack. Java packs can animate items.',
          ),
        ],
      },
      {
        id: 'gif',
        title: 'Import a GIF, save as GIF',
        body: [
          ul([
            [strong('Import GIF or frames…'), ' in the texture’s menu or the ⋯ menu takes an animated GIF, a sprite sheet (frames of the texture’s size side by side, or a strip of squares) or several pictures, in the order of their names. You can also drop a GIF on the canvas.'],
            'Every frame is resized to the texture’s size without smoothing, so pixel art stays sharp.',
            'GIF times are in hundredths of a second: 5 hundredths make a tick, so the GIF’s timing turns into ticks, rounded. You can keep the current speed instead.',
            [strong('Save as GIF…'), ' saves the animation to share, up to 16 times bigger. Blended frames are saved tick by tick, as the game shows them. GIFs have no half-transparent pixels: those become solid or see-through.'],
          ]),
        ],
      },
      {
        id: 'open',
        title: 'Open a pack with animations',
        body: [
          p(
            'Open a Java ',
            code('.zip'),
            ' or a Bedrock ',
            code('.mcpack'),
            ' and its animations play in the editor, ready to change: frames, speed, frame times and blending come from its ',
            code('.png.mcmeta'),
            ' files or its flipbook list. Animations are saved with the project, so project files and backups keep them too.',
          ),
        ],
      },
    ],
    faq: [
      {
        id: 'not-moving',
        q: 'My animation doesn’t move in the game. Why?',
        a: [
          p(
            'In Java, the ',
            code('.png.mcmeta'),
            ' must sit next to the picture with exactly its name plus ',
            code('.mcmeta'),
            ', and the texture must be one the game animates (blocks, items and other atlas textures). In Bedrock, only block textures with a flipbook entry move. Check that the pack is turned on and above other packs that change the same texture.',
          ),
        ],
      },
      {
        id: 'bedrock-items',
        q: 'Can I animate items in Bedrock?',
        a: [p('No. Bedrock resource packs can only animate block textures, through flipbook_textures.json. Java packs can animate items.')],
      },
      {
        id: 'speed',
        q: 'How fast can an animation be?',
        a: [p('The fastest is one frame a tick: 20 frames a second. The editor takes up to 12,000 ticks (10 minutes) for a frame.')],
      },
      {
        id: 'sizes',
        q: 'Do all frames need the same size?',
        a: [p('Yes. The frames are cut out of one picture, so they share its width and the frame height. Pictures you import are resized to the frame size.')],
      },
    ],
    related: ['make-a-texture-pack', 'texture-pack-not-working', 'java-vs-bedrock-packs'],
    cta: { label: 'Open the Texture Pack Maker', to: '/textures', icon: 'play' },
  },
];

/** A guide in a language: undefined when it does not exist or is not translated into that language. */
export function guideBySlug(slug: string, locale: Locale = 'en'): Guide | undefined {
  const en = GUIDE_CONTENT.find((g) => g.meta.slug === slug);
  if (!en || locale === 'en') return en;
  const meta = guideMeta(slug, locale);
  const text = hasContent(locale) ? contentOf(locale).guides[slug] : undefined;
  if (!meta || !text) return undefined;
  const { ctaLabel, ...rest } = text;
  return { meta, related: en.related, cta: en.cta && { ...en.cta, label: ctaLabel ?? en.cta.label }, ...rest };
}

/** Every guide available in a language. */
export function guidesContentIn(locale: Locale): Guide[] {
  return GUIDES.map((g) => guideBySlug(g.slug, locale)).filter((g): g is Guide => !!g);
}

/** A whole guide page (without the footer). */
export function guidePage(g: Guide): ElNode {
  const m = g.meta;
  const locale = m.locale ?? 'en';
  const u = ui(locale);
  const index = pageMeta(GUIDES_META.path, locale) ?? GUIDES_META;
  const hasToc = g.sections.length > 2;
  return el(
    'article',
    { class: ['guide-page', 'container', m.accent], 'aria-labelledby': 'guide-title' },
    breadcrumbs([{ label: u.home, to: '/' }, { label: index.label, to: '/guides' }, { label: m.label }], u.breadcrumb),
    el(
      'header',
      { class: 'guide-hero' },
      el('span', { class: 'eyebrow' }, ic(m.icon as IconName), u.guide),
      el('h1', { id: 'guide-title', class: 'pixel-shadow' }, m.h1),
      el('div', { class: 'guide-intro-text lead' }, g.intro),
      el('p', { class: 'guide-meta faint small' }, ic('clock', { size: 24 }), el('span', null, `${u.updated} `, el('time', { datetime: CONTENT_UPDATED }, u.date(CONTENT_UPDATED)))),
    ),
    g.quick
      ? el(
          'aside',
          { class: 'guide-quick', 'aria-label': g.quick.title },
          el('div', { class: 'guide-quick-title' }, ic('zap'), g.quick.title),
          el('ol', null, g.quick.items.map((i) => el('li', null, i))),
        )
      : null,
    el(
      'div',
      { class: ['guide-layout', hasToc ? 'has-toc' : null] },
      hasToc
        ? el(
            'nav',
            { class: 'guide-toc', 'aria-label': u.onThisPage, 'data-md': 'skip' },
            el('div', { class: 'section-title' }, u.onThisPage),
            g.sections.map((s) => el('a', { class: 'toc-link', href: `#${s.id}` }, el('span', null, s.title))),
            g.faq?.length ? el('a', { class: 'toc-link', href: '#questions' }, el('span', null, u.questions)) : null,
          )
        : null,
      el(
        'div',
        { class: 'guide-body' },
        g.sections.map((s) => el('section', { class: 'guide-section', id: s.id, 'aria-labelledby': `${s.id}-title` }, el('h2', { id: `${s.id}-title` }, s.title), s.body)),
        g.faq?.length
          ? el(
              'section',
              { class: 'guide-section', id: 'questions', 'aria-labelledby': 'questions-title' },
              el('h2', { id: 'questions-title' }, u.questions),
              el('div', { class: 'guide-faq accent-gold' }, faqList(g.faq, { idPrefix: `${m.slug}-faq` })),
            )
          : null,
        g.cta
          ? el(
              'div',
              { class: 'guide-cta', 'data-md': 'skip' },
              el('a', { class: 'btn btn-primary btn-lg', to: g.cta.to }, ic(g.cta.icon), el('span', { class: 'btn-label' }, g.cta.label)),
            )
          : null,
      ),
    ),
    el('section', { class: 'guide-related', 'aria-labelledby': 'related-title' }, el('h2', { id: 'related-title' }, u.relatedGuides), guideCards(g.related, 'h3', 3, locale)),
  );
}

export const GUIDES_INDEX_EN: GuidesIndexText = {
  eyebrow: 'Guides',
  title: 'Minecraft pack, skin and shader guides',
  lead: 'Clear, fact-checked answers for Minecraft creators: how to make and install texture packs, skins and shaders on Java and Bedrock, and which pack format each Java version needs.',
  more: ['Looking for step-by-step install instructions for every platform? See the ', link('/help', 'install guide & FAQ'), '.'],
};

/** The /guides/ index page (without the footer). */
export function guidesIndexPage(locale: Locale = 'en'): ElNode {
  const t = locale === 'en' ? GUIDES_INDEX_EN : (contentOf(locale).guidesIndex ?? GUIDES_INDEX_EN);
  const u = ui(locale);
  const meta = pageMeta(GUIDES_META.path, locale) ?? GUIDES_META;
  const partial = guidesIn(locale).length < GUIDES.length;
  return el(
    'div',
    { class: 'guides-index container' },
    breadcrumbs([{ label: u.home, to: '/' }, { label: meta.label }], u.breadcrumb),
    el('header', { class: 'guide-hero' }, el('span', { class: 'eyebrow' }, ic('book-open'), t.eyebrow), el('h1', { class: 'pixel-shadow' }, t.title), el('p', { class: 'lead' }, t.lead)),
    guideCards(undefined, 'h2', 2, locale),
    el('p', { class: 'guides-more muted' }, t.more),
    // Guides not translated yet are listed on the English index.
    partial ? el('p', { class: 'guides-more muted' }, el('a', { to: GUIDES_META.path, hreflang: 'en' }, u.englishOnly)) : null,
  );
}
