// Guide pages (/guides/ and /guides/<slug>/) as markup trees: prerendered at build time, rendered
// to DOM by guides.ts, and turned into HowTo / FAQPage / TechArticle data and llms-full.txt.
// Facts come from the app's own data (pack formats, version rules) and the project's research
// notes on Java and Bedrock packs, Vibrant Visuals and shader packs.
// The English text is GUIDE_CONTENT; a translation gives a guide the same GuideText
// (src/i18n/<lang>/guides.ts) and its title and description in src/i18n/<lang>/meta.ts.

import type { IconName } from '../../ui/icons';
import { el, ic, type Child, type ElNode } from '../../app/markup';
import { breadcrumbs, callout, code, ext, faqList, figure, folderTable, link, steps, strong, tabbed, uiPath, type FaqItem, type Shot } from '../../app/content/blocks';
import { SHOTS } from '../../app/content/shots';
import { guideCards } from '../../app/content/guide-cards';
import { GUIDES, GUIDES_META, guideMeta, guidesIn, pageMeta, type GuideMeta } from '../../app/seo/meta';
import { CONTENT_UPDATED, SITE_NAME } from '../../app/site';
import { F, LATEST, MIN_ENGINE, NEXT_SNAPSHOT, formatGroups, formatParts, maxFormat, mcmetaFor, mcmetaLegacy, mcmetaRange, minFormat } from '../../app/content/facts';
import type { Locale } from '../../i18n/locales';
import { ui } from '../../i18n/ui';
import { contentOf, hasContent } from '../../i18n/content';

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
        ' on Bedrock) is missing or in the wrong place, the pack was made for a different game version, or a texture is not at exactly the path Minecraft looks for. Find what you see below and apply the fix.',
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
    ],
    related: ['install-resource-packs', 'make-a-texture-pack', 'minecraft-pack-format-versions'],
    cta: { label: 'Open the Texture Pack Maker', to: '/textures', icon: 'image' },
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
        'A Minecraft skin is a 64×64 pixel PNG image that wraps around the player model. You can design one in your browser: paint on the template, check it on a 3D model, then upload it in the Minecraft Launcher (Java) or import it as a skin pack (Bedrock).',
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
        ],
      },
    ],
    faq: [
      { id: 'size', q: 'What size should a Minecraft skin be?', a: [p('64×64 pixels, saved as PNG. Use 64×32 only for Java 1.7.10 and older.')] },
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
    related: ['install-resource-packs', 'java-vs-bedrock-packs', 'make-a-texture-pack'],
    cta: { label: 'Open the Skin Maker', to: '/skins', icon: 'human' },
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
