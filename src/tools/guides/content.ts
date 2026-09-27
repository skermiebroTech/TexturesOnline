// Guide pages (/guides/ and /guides/<slug>/) as markup trees: prerendered at build time, rendered
// to DOM by guides.ts, and turned into HowTo / FAQPage / TechArticle data and llms-full.txt.
// Facts come from the app's own data (pack formats, version rules) and the project's research
// notes on Java and Bedrock packs, Vibrant Visuals and shader packs.

import type { IconName } from '../../ui/icons';
import { el, ic, type Child, type ElNode } from '../../app/markup';
import { breadcrumbs, callout, code, ext, faqList, folderTable, link, steps, strong, tabbed, uiPath, type FaqItem } from '../../app/content/blocks';
import { guideCards } from '../../app/content/guide-cards';
import { GUIDES, GUIDES_META, type GuideMeta } from '../../app/seo/meta';
import { CONTENT_UPDATED, SITE_NAME } from '../../app/site';
import { KNOWN_RELEASES, KNOWN_RELEASE_FORMATS, formatPackFormat } from '../../editions/java/packformats';

export interface GuideSection {
  id: string;
  title: string;
  body: Child[];
}

export interface Guide {
  meta: GuideMeta;
  /** Opening paragraph: the direct answer */
  intro: Child[];
  /** Short numbered answer shown in a box under the intro */
  quick?: { title: string; items: Child[] };
  sections: GuideSection[];
  /** Steps for the HowTo structured data (also shown in one of the sections) */
  howto?: { name: string; steps: Child[] };
  faq?: FaqItem[];
  related: string[];
  cta?: { label: string; to: string; icon: IconName };
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

const F = (id: string): string => formatPackFormat(KNOWN_RELEASE_FORMATS[id]);
const LATEST = '26.3';
/** Default Bedrock min_engine_version of exported packs (editions/bedrock/manifest.ts, checked by a unit test). */
export const BEDROCK_MIN_ENGINE: [number, number, number] = [1, 21, 0];
const MIN_ENGINE = `[${BEDROCK_MIN_ENGINE.join(', ')}]`;

// ---------------------------------------------------------------- pack format table (app data)

/** Releases grouped by resource pack format, oldest first: [format, [first, ..., last]] */
export function formatGroups(): { format: string; versions: string[] }[] {
  const groups: { format: string; versions: string[] }[] = [];
  for (const id of KNOWN_RELEASES) {
    const f = formatPackFormat(KNOWN_RELEASE_FORMATS[id]);
    const last = groups[groups.length - 1];
    if (last && last.format === f) last.versions.push(id);
    else groups.push({ format: f, versions: [id] });
  }
  return groups;
}

// ---------------------------------------------------------------- guides

const MAKE_PACK_STEPS: Child[] = [
  ['Open the ', link('/textures', 'Texture Pack Maker'), ' and fill in the ', strong('New texture pack'), ' card: a pack name, the edition (Java or Bedrock) and the game version. Java 26.3 is selected by default.'],
  ['Choose a resolution. 16× is the classic look, where every block face is 16×16 pixels; higher resolutions give you room for finer detail. Click ', strong('Create pack'), '.'],
  'Wait a moment while your browser downloads that version’s textures straight from Mojang. They are kept on your device, so the next pack starts instantly.',
  'Find a texture with the search box or the categories and paint it in the pixel editor, or upload your own PNG (it is resized to fit the texture).',
  'Optional: add whole-pack effects such as Dark Mode, Pastel or Retro 8-bit. They stack without changing your own edits and are applied when you export.',
  ['Open the ', strong('Pack'), ' tab to set the description and icon. On Java you can also choose a compatibility range so one pack works on several versions.'],
  ['Export. Java gives you a ', code('.zip'), ' and Bedrock an ', code('.mcpack'), '. Then ', link('/guides/install-resource-packs', 'install it'), '.'],
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
  'Paint on the 64×64 template while the 3D preview updates. Use mirroring to paint both arms or legs at once, and lock parts you have finished.',
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
        id: 'steps',
        title: 'Step by step',
        body: [steps(MAKE_PACK_STEPS)],
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
          pre(`{\n  "pack": {\n    "description": "My pack for Minecraft 26.3",\n    "min_format": [97, 1],\n    "max_format": 97\n  }\n}`),
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
        a: [p('No. The two editions use different files and folders. Make one project for each edition; you can export the same artwork twice. ', link('/guides/java-vs-bedrock-packs', 'Java vs Bedrock packs'), '.')],
      },
      {
        id: 'free',
        q: 'Do I need to install any software?',
        a: [p(`No. ${SITE_NAME} runs in your browser on a computer, phone or tablet, and nothing is uploaded.`)],
      },
      {
        id: 'edit',
        q: 'Can I change an existing texture pack?',
        a: [p('Yes. In the Texture Pack Maker choose ', strong('Open a pack'), ' and pick a ', code('.zip'), ' or ', code('.mcpack'), '. You can keep editing it and export again.')],
      },
    ],
    related: ['install-resource-packs', 'minecraft-pack-format-versions', 'java-vs-bedrock-packs'],
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
    howto: { name: 'How to install a resource pack in Minecraft Java Edition', steps: INSTALL_JAVA_STEPS },
    sections: [
      {
        id: 'java',
        title: 'Install a resource pack on Java',
        body: [steps(INSTALL_JAVA_STEPS), el('h3', { class: 'guide-sub' }, 'Where the folder is'), folderTable('resourcepacks')],
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
        a: [p('The one higher in the Selected (Java) or active (Bedrock) list.')],
      },
      {
        id: 'realms',
        q: 'Can console players use custom packs?',
        a: [p('Not by importing files. They can join a world, Realm or server that carries the pack.')],
      },
    ],
    related: ['make-a-texture-pack', 'minecraft-pack-format-versions', 'make-shaders-without-mods'],
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
            ' means major 97, minor 1. Mojang raises the minor number for additions that do not break older packs. At the time of writing, the first 26.4 snapshot uses 98.0.',
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
          pre(`{\n  "pack": {\n    "description": "My pack for Minecraft 26.3",\n    "min_format": [97, 1],\n    "max_format": 97\n  }\n}`),
          p('A bare number in ', code('max_format'), ' means “any minor version”, so 97 covers 97.0 and 97.1. Writing ', code('[97, 0]'), ' there would make the pack too old for 26.3.'),
          el('h3', { class: 'guide-sub' }, `From 1.20.1 to ${LATEST}`),
          pre(`{\n  "pack": {\n    "description": "My pack for Minecraft 1.20.1 - 26.3",\n    "pack_format": 15,\n    "supported_formats": [15, 97],\n    "min_format": 15,\n    "max_format": 97\n  }\n}`),
          p('1.20.1 reads ', code('pack_format'), ', 1.20.2 – 1.21.8 read ', code('supported_formats'), ' and 1.21.9 and newer read ', code('min_format'), ' and ', code('max_format'), '.'),
          el('h3', { class: 'guide-sub' }, 'Only 1.20.1 (and 1.20)'),
          pre(`{\n  "pack": {\n    "pack_format": 15,\n    "description": "My pack for Minecraft 1.20.1"\n  }\n}`),
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
        a: [p(`${F(LATEST)}. Write "min_format": [97, 1] and "max_format": 97 in pack.mcmeta for a ${LATEST}-only pack.`)],
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
      { id: 'steps', title: 'Step by step', body: [steps(SKIN_STEPS)] },
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
        title: 'Make a Bedrock skin pack',
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
            ['Export as a ', strong('Bedrock skin pack'), '.'],
            'Open the .mcpack (double-click on Windows, Open with Minecraft on Android, Share › Minecraft on iPhone and iPad).',
            ['In Minecraft go to ', uiPath('Dressing Room', 'Classic Skins'), ', find your pack, choose the skin and press ', strong('Equip'), '.'],
          ]),
          callout('warn', 'Things to know', 'Consoles cannot import skin files. Players who turn on Only Allow Trusted Skins see custom skins as default ones. Custom models are not allowed in imported skin packs, only classic and slim.'),
        ],
      },
    ],
    faq: [
      { id: 'size', q: 'What size should a Minecraft skin be?', a: [p('64×64 pixels, saved as PNG. Use 64×32 only for Java 1.7.10 and older.')] },
      { id: 'username', q: 'Can I start from someone’s skin?', a: [p('Yes. The Skin Maker can load any Java player’s current skin by username, so you can remix it. Please respect other people’s work.')] },
      { id: 'phone', q: 'Can I make a skin on my phone?', a: [p('Yes. The editor works with touch, including pinch-to-zoom.')] },
    ],
    related: ['install-resource-packs', 'java-vs-bedrock-packs', 'make-a-texture-pack'],
    cta: { label: 'Open the Skin Maker', to: '/skins', icon: 'human' },
  },

  // ------------------------------------------------------------ shaders without mods
  {
    meta: meta('make-shaders-without-mods'),
    intro: [
      p(
        strong('Yes, within limits.'),
        ' On Java 1.17 and newer an ordinary resource pack can replace some of Minecraft’s own shader files, so you get colour grading, a vignette, fog changes and, on 26.3, bloom without installing anything. On Bedrock, custom shader code is not allowed, but a Vibrant Visuals pack tunes the built-in lighting, sky, fog and water. Real shadows and reflections on Java still need Iris or OptiFine.',
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
        title: 'When you do want mods',
        body: [
          p(
            'For the classic shader look (real sun shadows, waving leaves, reflective water, god rays) use an Iris or OptiFine shader pack. Iris is available for Java 1.16.5 to 26.3 and is the easiest to install; at the time of writing OptiFine goes up to 26.2. The ',
            link('/shaders', 'Shader Maker'),
            ' builds these packs too.',
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
      { id: 'convert', q: 'Can I convert a Java pack to Bedrock?', a: [p('Not by renaming the file. The folders, names and description file differ. Open the Java pack for reference and repaint the textures in a Bedrock project.')] },
      { id: 'which', q: 'Which edition am I playing?', a: [p('If you play on a console, phone or tablet, or got Minecraft from the Microsoft Store as “Minecraft for Windows”, it is Bedrock. Java runs on Windows, macOS and Linux from the Minecraft Launcher.')] },
    ],
    related: ['make-a-texture-pack', 'install-resource-packs', 'minecraft-pack-format-versions'],
    cta: { label: 'Open the Texture Pack Maker', to: '/textures', icon: 'image' },
  },
];

export function guideBySlug(slug: string): Guide | undefined {
  return GUIDE_CONTENT.find((g) => g.meta.slug === slug);
}

function dateText(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${d} ${months[m - 1]} ${y}`;
}

/** A whole guide page (without the footer). */
export function guidePage(g: Guide): ElNode {
  const m = g.meta;
  const hasToc = g.sections.length > 2;
  return el(
    'article',
    { class: ['guide-page', 'container', m.accent], 'aria-labelledby': 'guide-title' },
    breadcrumbs([{ label: 'Home', to: '/' }, { label: 'Guides', to: '/guides' }, { label: m.label }]),
    el(
      'header',
      { class: 'guide-hero' },
      el('span', { class: 'eyebrow' }, ic(m.icon as IconName), 'Guide'),
      el('h1', { id: 'guide-title', class: 'pixel-shadow' }, m.h1),
      el('div', { class: 'guide-intro-text lead' }, g.intro),
      el('p', { class: 'guide-meta faint small' }, ic('clock', { size: 24 }), el('span', null, 'Updated ', el('time', { datetime: CONTENT_UPDATED }, dateText(CONTENT_UPDATED)))),
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
            { class: 'guide-toc', 'aria-label': 'On this page', 'data-md': 'skip' },
            el('div', { class: 'section-title' }, 'On this page'),
            g.sections.map((s) => el('a', { class: 'toc-link', href: `#${s.id}` }, el('span', null, s.title))),
            g.faq?.length ? el('a', { class: 'toc-link', href: '#questions' }, el('span', null, 'Questions')) : null,
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
              el('h2', { id: 'questions-title' }, 'Questions'),
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
    el('section', { class: 'guide-related', 'aria-labelledby': 'related-title' }, el('h2', { id: 'related-title' }, 'Related guides'), guideCards(g.related, 'h3', 3)),
  );
}

/** The /guides/ index page (without the footer). */
export function guidesIndexPage(): ElNode {
  return el(
    'div',
    { class: 'guides-index container' },
    breadcrumbs([{ label: 'Home', to: '/' }, { label: GUIDES_META.label }]),
    el(
      'header',
      { class: 'guide-hero' },
      el('span', { class: 'eyebrow' }, ic('book-open'), 'Guides'),
      el('h1', { class: 'pixel-shadow' }, 'Minecraft pack, skin and shader guides'),
      el('p', { class: 'lead' }, 'Clear, fact-checked answers for Minecraft creators: how to make and install texture packs, skins and shaders on Java and Bedrock, and which pack format each Java version needs.'),
    ),
    guideCards(undefined, 'h2', 2),
    el(
      'p',
      { class: 'guides-more muted' },
      'Looking for step-by-step install instructions for every platform? See the ',
      link('/help', 'install guide & FAQ'),
      '.',
    ),
  );
}
