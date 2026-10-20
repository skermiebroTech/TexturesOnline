// Help page content (install guides for every edition and platform, plus FAQ) as a markup tree.
// Rendered to static HTML at build time and to DOM by help.ts; also feeds the HowTo and FAQPage
// structured data and llms-full.txt. No DOM access here. The English text is in SECTIONS, FAQ and
// HELP_EN; translations fill in the same HelpText (src/i18n/<lang>/help.ts).

import type { IconName } from '../../ui/icons';
import { el, ic, type Child, type ElNode } from '../../app/markup';
import { breadcrumbs, callout, code, ext, faqList, folderTable, link, steps, strong, tabbed, uiPath, type FaqItem } from '../../app/content/blocks';
import { REPO_URL, SITE_NAME } from '../../app/site';
import { F, LATEST, maxFormat, minFormat } from '../../app/content/facts';
import { HELP_META, pageMeta } from '../../app/seo/meta';
import type { Locale } from '../../i18n/locales';
import { ui } from '../../i18n/ui';
import { contentOf } from '../../i18n/content';

export type HelpSectionId = 'java-packs' | 'bedrock-packs' | 'java-skins' | 'bedrock-skins' | 'iris' | 'vanilla-shaders' | 'vibrant-visuals' | 'folders';

export interface HelpSection {
  id: HelpSectionId;
  title: string;
  short: string;
  icon: IconName;
  accent: string;
  edition?: 'Java' | 'Bedrock' | 'Java & Bedrock';
  body: Child[];
  /** Steps shown by default (first tab), for the HowTo structured data */
  howto?: { name: string; steps: Child[] };
}

const JAVA_PACK_STEPS: Child[] = [
  ['Export your pack from the Texture Pack Maker. You get a file like ', code('My Pack.zip'), '.'],
  ['Start Minecraft Java Edition and open ', uiPath('Options…', 'Resource Packs…'), '.'],
  ['Click ', uiPath('Open Pack Folder'), '. This opens the ', code('resourcepacks'), ' folder.'],
  ['Drop the ', code('.zip'), ' into that folder. You can also drag it straight onto the Resource Packs screen.'],
  ['Hover your pack in the ', strong('Available'), ' list and click the arrow to move it to ', strong('Selected'), '. Packs higher in the list win. Click ', strong('Done'), '.'],
];

const BEDROCK_PACK_STEPS: Child[] = [
  ['Export your pack. You get a file like ', code('My Pack.mcpack'), '.'],
  ['Double-click the file. Minecraft opens and shows ', el('em', null, 'Import started…'), ' then ', el('em', null, 'Successfully imported'), '.'],
  ['Go to ', uiPath('Settings', 'Global Resources', 'My Packs'), ', select your pack and press ', strong('Activate'), '.'],
  'Using several packs? Move yours to the top so it wins.',
];

const JAVA_SKIN_STEPS: Child[] = [
  ['Open the Minecraft Launcher and choose ', uiPath('Minecraft: Java Edition', 'Skins'), '.'],
  ['Click ', strong('New skin'), ' (the + card).'],
  ['Name it and pick the player model: ', strong('Classic'), ' or ', strong('Slim'), '.'],
  ['Click ', strong('Browse'), ', choose your PNG, then ', strong('Save & Use'), '.'],
];

const BEDROCK_SKIN_STEPS: Child[] = [
  ['Export as a ', strong('Bedrock skin pack'), '. You get a ', code('.mcpack'), ' file.'],
  'Open the file (double-click on Windows, "Open with Minecraft" on phones and tablets) to import it.',
  ['In Minecraft go to ', uiPath('Dressing Room', 'Classic Skins'), '. Your pack is listed with the imported packs.'],
  ['Pick your skin and press ', strong('Equip'), '.'],
];

const IRIS_STEPS: Child[] = [
  ['Download the Iris Installer from ', ext('https://www.irisshaders.dev/', 'irisshaders.dev'), '. It installs Fabric Loader, Iris and Sodium for your version in one go.'],
  ['Open the Minecraft Launcher, choose the new ', strong('Iris & Sodium'), ' profile and play once.'],
  ['Export your shader pack from the Shader Maker (a ', code('.zip'), ' — keep it zipped).'],
  ['In game open ', uiPath('Options…', 'Video Settings…', 'Shader Packs…'), ' and click ', strong('Open Shader Pack Folder'), '. Drop the zip in.'],
  ['Select your pack and click ', strong('Apply'), '. The ', strong('Shader Pack Settings'), ' button lets you fine-tune options in game.'],
];

const VANILLA_SHADER_STEPS: Child[] = [
  ['Export with the ', strong('Vanilla Java'), ' target. You get a ', code('.zip'), ' resource pack.'],
  ['Install it like a texture pack: ', uiPath('Options…', 'Resource Packs…', 'Open Pack Folder'), ', drop the zip in.'],
  'Move it to Selected and click Done. The new look applies straight away.',
];

const VIBRANT_STEPS: Child[] = [
  ['Export your pack (', code('.mcpack'), ') and open the file to import it.'],
  ['Go to ', uiPath('Settings', 'Global Resources', 'My Packs'), ' and activate it.'],
  ['Open ', uiPath('Settings', 'Video'), ' and set ', strong('Graphics Mode'), ' to ', strong('Vibrant Visuals'), '.'],
];

export const SECTIONS: HelpSection[] = [
  {
    id: 'java-packs',
    title: 'Texture packs on Java',
    short: 'Java packs',
    icon: 'image',
    accent: 'accent-green',
    edition: 'Java',
    howto: { name: 'How to install a texture pack (resource pack) in Minecraft Java Edition', steps: JAVA_PACK_STEPS },
    body: [
      el('p', { class: 'guide-intro' }, 'Java Edition calls texture packs ', el('em', null, 'resource packs'), '. Your export is a ', code('.zip'), ' file — keep it zipped.'),
      steps(JAVA_PACK_STEPS),
      callout(
        'info',
        'Seeing "Made for an older (or newer) version"?',
        'Packs are written for the version you pick in the editor. If you play another version, change the target version or the compatibility range in the ',
        strong('Pack'),
        ' tab and export again. Texture-only packs usually still work — you can click ',
        strong('Yes'),
        ' to use it anyway.',
      ),
      el('h3', { class: 'guide-sub' }, 'Where the folder lives'),
      folderTable('resourcepacks'),
    ],
  },
  {
    id: 'bedrock-packs',
    title: 'Texture packs on Bedrock',
    short: 'Bedrock packs',
    icon: 'gamepad',
    accent: 'accent-green',
    edition: 'Bedrock',
    howto: { name: 'How to install a Bedrock texture pack (.mcpack) on Windows', steps: BEDROCK_PACK_STEPS },
    body: [
      el('p', { class: 'guide-intro' }, 'Bedrock packs export as ', code('.mcpack'), ' files. Opening one imports it into Minecraft automatically.'),
      tabbed('bedrock-packs', [
        { value: 'windows', label: 'Windows', icon: 'monitor', content: [steps(BEDROCK_PACK_STEPS)] },
        {
          value: 'mobile',
          label: 'Android & iOS',
          icon: 'smartphone',
          content: [
            steps([
              ['Download the ', code('.mcpack'), ' on your phone or tablet.'],
              [strong('Android: '), 'open it from your Downloads or Files app and choose ', strong('Minecraft'), '. ', strong('iPhone / iPad: '), 'in the Files app tap the file, then ', uiPath('Share', 'Minecraft'), '.'],
              ['Minecraft imports the pack. Then open ', uiPath('Settings', 'Global Resources'), ' and activate it.'],
            ]),
          ],
        },
        {
          value: 'console',
          label: 'Consoles',
          icon: 'gamepad',
          content: [
            el(
              'p',
              { class: 'muted' },
              "Xbox, PlayStation and Switch can't import .mcpack files. Add the pack to a world on a PC or phone and join that world, or play on a Realm or server that includes the pack.",
            ),
          ],
        },
      ]),
      callout('tip', 'Only for one world?', 'Instead of Global Resources, open ', uiPath('Edit world', 'Resource Packs'), ' and activate the pack there.'),
      callout(
        'info',
        'Updating a pack you already imported',
        'Each export keeps the same pack ID and raises its version number, so importing again replaces the old copy instead of adding a duplicate.',
      ),
    ],
  },
  {
    id: 'java-skins',
    title: 'Skins on Java',
    short: 'Java skins',
    icon: 'human',
    accent: 'accent-blue',
    edition: 'Java',
    howto: { name: 'How to change your skin in Minecraft Java Edition', steps: JAVA_SKIN_STEPS },
    body: [
      el('p', { class: 'guide-intro' }, 'Export your skin as a ', code('.png'), '. Remember whether you painted the ', strong('Classic'), ' (4 pixel arms) or ', strong('Slim'), ' (3 pixel arms) model.'),
      tabbed('java-skins', [
        { value: 'launcher', label: 'Minecraft Launcher', icon: 'monitor', content: [steps(JAVA_SKIN_STEPS)] },
        {
          value: 'web',
          label: 'minecraft.net',
          icon: 'globe',
          content: [
            steps([
              ['Sign in at ', ext('https://www.minecraft.net/', 'minecraft.net'), ' and open your profile.'],
              ['In the skin section choose the ', strong('Classic'), ' or ', strong('Slim'), ' model.'],
              ['Upload your PNG and confirm. It shows up in game the next time you join a world or server.'],
            ]),
          ],
        },
      ]),
      callout('info', 'Playing 1.7.10 or older?', 'Those versions only understand the old 64×32 layout. Use the ', strong('Old Java skin (64×32)'), ' export option.'),
    ],
  },
  {
    id: 'bedrock-skins',
    title: 'Skins on Bedrock',
    short: 'Bedrock skins',
    icon: 'shirt',
    accent: 'accent-blue',
    edition: 'Bedrock',
    howto: { name: 'How to install a Bedrock skin pack (.mcpack)', steps: BEDROCK_SKIN_STEPS },
    body: [
      tabbed('bedrock-skins', [
        { value: 'pack', label: 'Skin pack (.mcpack)', icon: 'package', content: [steps(BEDROCK_SKIN_STEPS)] },
        {
          value: 'png',
          label: 'Single PNG',
          icon: 'image',
          content: [
            steps([
              ['Export the skin as a ', code('.png'), '.'],
              ['Open ', uiPath('Dressing Room', 'Classic Skins'), ' and under ', strong('Owned'), ' select the blank ', strong('Import'), ' slot.'],
              ['Choose your PNG, then pick the classic or slim arm model.'],
            ]),
          ],
        },
      ]),
      callout(
        'warn',
        'Friends see a default skin?',
        'Players who have ',
        strong('Only Allow Trusted Skins'),
        ' turned on see custom skins as a default skin. It is their own setting. Consoles cannot import skin files.',
      ),
    ],
  },
  {
    id: 'iris',
    title: 'Shaders with Iris or OptiFine',
    short: 'Iris / OptiFine',
    icon: 'sparkles',
    accent: 'accent-purple',
    edition: 'Java',
    howto: { name: 'How to install a shader pack with Iris', steps: IRIS_STEPS },
    body: [
      el('p', { class: 'guide-intro' }, 'Classic shader packs need a shader mod. ', strong('Iris'), ' is the easiest and fastest; OptiFine works too.'),
      tabbed('iris', [
        { value: 'iris', label: 'Iris (recommended)', icon: 'sparkles', content: [steps(IRIS_STEPS)] },
        {
          value: 'optifine',
          label: 'OptiFine',
          icon: 'gear',
          content: [
            steps([
              ['Install OptiFine for your Minecraft version from ', ext('https://optifine.net/', 'optifine.net'), ' and play the OptiFine profile once.'],
              ['Open ', uiPath('Options…', 'Video Settings…', 'Shaders…'), ' and click ', strong('Shaders Folder'), '.'],
              'Drop your exported zip into the folder, then select it in the list.',
            ]),
          ],
        },
      ]),
      el('h3', { class: 'guide-sub' }, 'Shader pack folder'),
      folderTable('shaderpacks'),
    ],
  },
  {
    id: 'vanilla-shaders',
    title: 'Vanilla shaders (no mods)',
    short: 'Vanilla shaders',
    icon: 'sun',
    accent: 'accent-purple',
    edition: 'Java',
    howto: { name: 'How to install a vanilla (no-mod) shader pack in Minecraft Java', steps: VANILLA_SHADER_STEPS },
    body: [
      el('p', { class: 'guide-intro' }, 'These work in the normal game because they are a ', strong('resource pack'), ' that replaces some of Minecraft’s own shader files.'),
      steps(VANILLA_SHADER_STEPS),
      callout(
        'warn',
        'Made for one exact version',
        'Mojang changes the shader files often, so a vanilla shader pack only works on the version it was made for. After updating Minecraft, open your project, pick the new version and export again.',
      ),
    ],
  },
  {
    id: 'vibrant-visuals',
    title: 'Vibrant Visuals on Bedrock',
    short: 'Vibrant Visuals',
    icon: 'cloud-sun',
    accent: 'accent-purple',
    edition: 'Bedrock',
    howto: { name: 'How to use a Vibrant Visuals pack in Minecraft Bedrock', steps: VIBRANT_STEPS },
    body: [
      el('p', { class: 'guide-intro' }, 'Bedrock "shaders" are Vibrant Visuals settings packs: lighting, sky, colour grading, water and fog.'),
      steps(VIBRANT_STEPS),
      callout(
        'warn',
        "Can't choose Vibrant Visuals?",
        'Minecraft only allows it when every active pack supports it. Classic texture packs (including the ones you make in the Texture Pack Maker) switch it off, so deactivate other packs while you use this one. Some servers also turn it off.',
      ),
      callout(
        'info',
        'Needs a supported device',
        'Vibrant Visuals runs on Windows PCs with DirectX 12, Xbox and PlayStation (on Xbox One and PS4 it starts switched off), iPhone and iPad with an A12 chip or newer, and many recent Android devices. It is not available on the original Nintendo Switch, Chromebooks or Fire tablets. ',
        strong('Customize classic fog'),
        ' also works in the other graphics modes.',
      ),
    ],
  },
  {
    id: 'folders',
    title: 'Finding your Minecraft folder',
    short: 'Folders',
    icon: 'folder',
    accent: 'accent-gold',
    edition: 'Java & Bedrock',
    body: [
      el('p', { class: 'guide-intro' }, 'The quickest way is the ', strong('Open Pack Folder'), ' button in Minecraft. If you need the path:'),
      el(
        'table',
        { class: 'paths-table' },
        el('thead', null, el('tr', null, el('th', { scope: 'col' }, 'What'), el('th', { scope: 'col' }, 'Where'))),
        el(
          'tbody',
          null,
          el('tr', null, el('th', { scope: 'row' }, 'Java on Windows'), el('td', null, code('%APPDATA%\\.minecraft'))),
          el('tr', null, el('th', { scope: 'row' }, 'Java on macOS'), el('td', null, code('~/Library/Application Support/minecraft'))),
          el('tr', null, el('th', { scope: 'row' }, 'Java on Linux'), el('td', null, code('~/.minecraft'))),
          el('tr', null, el('th', { scope: 'row' }, 'Game files (.jar)'), el('td', null, code('.minecraft/versions/<version>/<version>.jar'))),
          el('tr', null, el('th', { scope: 'row' }, 'Bedrock on Windows'), el('td', null, code('%APPDATA%\\Minecraft Bedrock\\users\\shared\\games\\com.mojang'))),
        ),
      ),
      el('p', { class: 'muted small' }, 'On Windows, paste the path into the File Explorer address bar or the Run box (Win + R).'),
    ],
  },
];

export const FAQ: FaqItem[] = [
  {
    id: 'vanilla-source',
    q: 'Where do the vanilla textures come from?',
    a: [
      el(
        'p',
        null,
        "When you start a Java project, your browser downloads the official game file for that version straight from Mojang's servers and keeps only the textures, models and shaders on this device. Bedrock textures come from Mojang's official ",
        ext('https://github.com/Mojang/bedrock-samples', 'bedrock-samples'),
        ' repository on GitHub.',
      ),
      el('p', null, `Nothing from Mojang is stored in ${SITE_NAME} itself — it is a static website with no servers of its own.`),
    ],
  },
  {
    id: 'paint-3d',
    q: 'Can I paint on the 3D model instead of the flat texture?',
    a: [
      el(
        'p',
        null,
        'Yes. In the texture editor use the ',
        strong('2D / 3D'),
        ' switch above the canvas (or press D). Each face paints the exact pixel it shows, including rotated faces, overlays like the grass side, lit and unlit states, chests and beds. Pencil, eraser, fill, colour picker (or Alt-click), brush size and mirror all work, and each texture keeps its own undo. Right-drag or two fingers turn the model, scroll or pinch zooms, and F, B, L, R and T jump to a side.',
      ),
    ],
  },
  {
    id: 'mobs',
    q: 'Can I edit mob textures?',
    a: [
      el(
        'p',
        null,
        'Yes. Choose ',
        strong('Mobs'),
        ' in the texture list (Blocks · Items · Mobs · All), or open any texture from the entity folder. The mob appears in 3D and paints like a block. Use the choices next to it (variant, age, wool colour, profession and so on) to reach every texture it uses; overlays such as sheep wool, glowing eyes and villager clothes paint on their own textures. In the Parts list, click a part to hide it and paint what it covers, double-click to show only that part, and use Show all to bring everything back. Bedrock mobs use Bedrock’s own models, and the tint masks hidden in their transparent pixels are kept.',
      ),
    ],
  },
  {
    id: 'gear',
    q: 'Can I edit saddles, armour and horse armour?',
    a: [
      el(
        'p',
        null,
        'Yes. Mobs that wear things show a ',
        strong('Wearing'),
        ' group in their choices: put a saddle on a pig, strider, horse, camel or nautilus; dress zombies, skeletons, piglins and the armour stand in armour (pick a material for the whole set, then switch single pieces on or off, and dye leather with ',
        strong('Dye'),
        '); give horses, wolves and nautiluses their armour, llamas a carpet and the happy ghast a harness. Each worn item paints on its own texture and has its own entry under ',
        strong('Parts'),
        ', so you can hide it to paint the mob underneath. Opening an armour, saddle or carpet texture shows it being worn, and ',
        strong('Used by'),
        ' lists every mob that wears it. Older versions use the armour and saddle textures they had.',
      ),
      el(
        'p',
        null,
        strong('Armour trims: '),
        'with humanoid armour on, pick a ',
        strong('Trim'),
        ' pattern and a ',
        strong('Material'),
        ' under Wearing (Java 1.20 and newer, and Bedrock). The game colours the grey pattern with the material’s palette, and uses a darker palette when the trim matches the armour, like an iron trim on iron armour. Paint the trim on the model or open its pattern: the eight greys take the trim’s colour and any other colour stays as you paint it. Edit a material’s palette to recolour that material on every trim, and hide ',
        strong('Trim'),
        ' under Parts to reach the armour underneath.',
      ),
    ],
  },
  {
    id: 'models',
    q: 'Can I change the shape of blocks and items, like a 3D sword?',
    a: [
      el(
        'p',
        null,
        'Yes, in Java packs (Minecraft 1.8 and newer). Show a block or item in the preview and press ',
        strong('Edit shape'),
        '. The model editor opens the model the game uses, worked out from its parent models. Add, copy and delete cubes, type their position and size or drag the arrows and knobs in 3D, snapping to the 16 × 16 grid or finer, and turn a cube on one axis (in steps of 22.5° before Minecraft 1.21.6). Under ',
        strong('Faces'),
        ' give each face a texture from your pack, or a new one you paint later, and drag the part of the texture it shows; set its rotation, when it is hidden and whether it is tinted. ',
        strong('Display'),
        ' sets how the model sits in the inventory, in first and third person, on the ground, in an item frame and on a head, each with a preview. Every change can be undone.',
      ),
      el(
        'p',
        null,
        'To start, take the game’s model, an empty one, a full cube, a slab, a cross like flowers or, for items, ',
        strong('3D item from sprite'),
        ', which turns the flat picture into 1-pixel-deep cubes joined into as few as possible. From 1.21.4, ',
        strong('Flat in the inventory'),
        ' keeps the flat icon in the inventory and shows the 3D model in hand. The pack gets the model file, plus an item definition or blockstate only when the game needs one; export checks the models against your version, and model files in packs you open are kept and can be edited. On Bedrock, new block shapes need an add-on and 3D held items need attachable files, which the editor doesn’t make; you can download a model as Bedrock geometry to start from. Step by step: ',
        link('/guides/make-3d-items-texture-pack', 'How to make 3D items'),
        '.',
      ),
    ],
  },
  {
    id: 'sounds',
    q: 'Can I change sounds in my pack?',
    a: [
      el(
        'p',
        null,
        'Yes. In the texture pack editor, press the music note at the end of the Blocks · Items · Mobs · All switch. Find a sound by name or category and press play to hear it. Open it, then ',
        strong('Replace'),
        ' a file with your own audio (MP3, WAV, OGG, M4A and more) or record one with your microphone. Drag the handles on the waveform to trim it, set the volume or press ',
        strong('Normalise'),
        ', and use Reset to go back to the game’s sound. Replaced sounds are saved as Ogg Vorbis and exported with your pack: Java packs put them in ',
        code('assets/minecraft/sounds'),
        ', Bedrock packs in ',
        code('sounds/'),
        ' with matching ',
        code('sound_definitions.json'),
        ' entries.',
      ),
      el(
        'p',
        null,
        'Recording asks for microphone access only when you press Start; if it is blocked, allow the microphone for this site from the icon in the address bar. Recordings never leave your device. Keep most sounds mono so they come from where they happen in the world, and use stereo for music and menu sounds. Java’s own sounds play straight from Mojang’s servers, which do not let web pages read the audio, so you can listen to them but only trim the sounds you upload or record. Sound editing works for Java 1.7.10 and newer and for Bedrock.',
      ),
    ],
  },
  {
    id: 'hd-skins',
    q: 'Can I make an HD 128×128 skin?',
    a: [
      el(
        'p',
        null,
        'Yes, for Bedrock Edition. HD skins have twice the pixels of a normal skin (128×128 instead of 64×64), so faces, shading and patterns can be finer. When you start a skin in the skin maker, pick ',
        strong('HD 128×128'),
        ' under ',
        strong('Size'),
        ', or switch an existing skin with ',
        strong('Size'),
        ' › ',
        strong('HD 128'),
        ' in the editor: every pixel is doubled, so it looks the same until you add detail. Export ',
        strong('Bedrock skin (.png)'),
        ' to import it in the Dressing Room, or a ',
        strong('Bedrock skin pack (.mcpack)'),
        '. A skin pack can mix normal and HD skins.',
      ),
      el(
        'p',
        null,
        'Java Edition only accepts 64×64 skins without mods, so the Java export makes a 64×64 copy (each 2×2 block becomes one pixel) and keeps your HD original. With an HD skin mod such as CustomSkinLoader, choose ',
        strong('128×128 for mods'),
        ' instead. Consoles cannot import skin files, and sizes above 128×128 are not supported. HD skins also work in the totem maker.',
      ),
    ],
  },
  {
    id: 'upload',
    q: 'Is anything uploaded?',
    a: [
      el(
        'p',
        null,
        'No. Your projects, images and exported packs never leave your device. The app only downloads things: game files from Mojang, the list of versions, and skins you look up by username.',
      ),
    ],
  },
  {
    id: 'offline',
    q: 'Does it work offline?',
    a: [
      el(
        'p',
        null,
        "Yes, after the first load. The app and every version you have already opened stay on this device, so you can keep editing without internet. A version you haven't used yet needs a connection — or choose ",
        strong('Use my own .jar'),
        ' and pick it from your ',
        code('.minecraft/versions'),
        ' folder.',
      ),
    ],
  },
  {
    id: 'storage',
    q: 'Where are my projects saved?',
    a: [
      el(
        'p',
        null,
        "In your browser's storage on this device. They stay until you delete them or clear this site's data. To back up a project or move it to another computer, export it and open the file there with ",
        strong('Open a pack'),
        '.',
      ),
    ],
  },
  {
    id: 'versions',
    q: 'Which Minecraft versions are supported?',
    a: [
      el(
        'p',
        null,
        `Java ${LATEST} is the default, and every Java release back to 1.6.1 (when resource packs were introduced) works — snapshots too if you switch them on. For Bedrock you can use the latest release, the latest preview and older versions.`,
      ),
    ],
  },
  {
    id: 'pack-format',
    q: `What is the resource pack format for Minecraft Java ${LATEST}?`,
    a: [
      el(
        'p',
        null,
        `Java ${LATEST} uses resource pack format ${F(LATEST)}. A pack made only for ${LATEST} declares `,
        code(`"min_format": ${minFormat(LATEST)}`),
        ' and ',
        code(`"max_format": ${maxFormat(LATEST)}`),
        ' in its ',
        code('pack.mcmeta'),
        '. The Texture Pack Maker writes these fields for you. See ',
        link('/guides/minecraft-pack-format-versions', 'the format of every Java version'),
        '.',
      ),
    ],
  },
  {
    id: 'java-vs-bedrock',
    q: 'What is the difference between Java and Bedrock packs?',
    a: [
      el(
        'p',
        null,
        'A Java pack is a ',
        code('.zip'),
        ' with a ',
        code('pack.mcmeta'),
        ' file and PNG textures under ',
        code('assets/minecraft/textures/'),
        '. A Bedrock pack is an ',
        code('.mcpack'),
        ' with a ',
        code('manifest.json'),
        ' and textures under ',
        code('textures/'),
        ' (PNG or TGA). Neither edition can load the other’s packs. ',
        link('/guides/java-vs-bedrock-packs', 'Full comparison'),
        '.',
      ),
    ],
  },
  {
    id: 'no-mods',
    q: 'Can I make shaders without mods?',
    a: [
      el(
        'p',
        null,
        'Yes. On Java 1.17 and newer a resource pack can change Minecraft’s own shaders (colour, vignette, fog, and bloom on 26.3). On Bedrock a Vibrant Visuals pack changes the built-in lighting, sky, fog and water. Real shadows and reflections on Java still need Iris or OptiFine. ',
        link('/guides/make-shaders-without-mods', 'How it works'),
        '.',
      ),
    ],
  },
  {
    id: 'phone',
    q: 'Can I use it on a phone or tablet?',
    a: [el('p', null, 'Yes. Every tool works with touch, including pinch-to-zoom in the pixel editors. A bigger screen is more comfortable for detailed pixel art.')],
  },
  {
    id: 'official',
    q: 'Is this free? Is it official?',
    a: [
      el('p', null, 'It is free and open source under the MIT licence.'),
      el('p', null, `${SITE_NAME} is not an official Minecraft product and is not approved by or associated with Mojang or Microsoft.`),
    ],
  },
  {
    id: 'bug',
    q: 'Something went wrong. How do I report it?',
    a: [el('p', null, 'Please open an issue on ', ext(`${REPO_URL}/issues`, 'GitHub'), ' with your browser, the game version and what you were doing. Screenshots help a lot.')],
  },
];

export const HELP_SECTION_IDS = [...SECTIONS.map((s) => s.id), 'faq'];

type QuickId = 'java-packs' | 'java-skins' | 'iris' | 'faq';

const QUICK: { id: QuickId; icon: IconName; accent: string }[] = [
  { id: 'java-packs', icon: 'image', accent: 'accent-green' },
  { id: 'java-skins', icon: 'human', accent: 'accent-blue' },
  { id: 'iris', icon: 'sparkles', accent: 'accent-purple' },
  { id: 'faq', icon: 'circle-question', accent: 'accent-gold' },
];

/** The translatable part of a help section. */
export type HelpSectionText = Pick<HelpSection, 'title' | 'short' | 'body' | 'howto'>;

/** Every text on the help page. */
export interface HelpText {
  /** By section id (a section without a translation keeps its English text; a unit test flags it) */
  sections: Partial<Record<HelpSectionId, HelpSectionText>>;
  /** Same ids as the English FAQ (links such as /help?s=offline open them) */
  faq: FaqItem[];
  quick: Record<QuickId, string>;
  toc: {
    title: string;
    textures: string;
    skins: string;
    shaders: string;
    more: string;
    irisOptifine: string;
    vanilla: string;
    vibrant: string;
    folders: string;
    faq: string;
    allGuides: string;
  };
  /** Edition badge for sections about both editions */
  bothEditions: string;
  eyebrow: string;
  title: string;
  lead: string;
  faqTitle: string;
}

export const HELP_EN: HelpText = {
  sections: Object.fromEntries(SECTIONS.map((s) => [s.id, { title: s.title, short: s.short, body: s.body, howto: s.howto }])) as Record<HelpSectionId, HelpSectionText>,
  faq: FAQ,
  quick: { 'java-packs': 'Install a texture pack', 'java-skins': 'Change your skin', iris: 'Use a shader pack', faq: 'Questions' },
  toc: {
    title: 'On this page',
    textures: 'Texture packs',
    skins: 'Skins',
    shaders: 'Shaders',
    more: 'More',
    irisOptifine: 'Iris / OptiFine',
    vanilla: 'Vanilla (no mods)',
    vibrant: 'Vibrant Visuals',
    folders: 'Folders',
    faq: 'FAQ',
    allGuides: 'All guides',
  },
  bothEditions: 'Java & Bedrock',
  eyebrow: 'Install guide & help',
  title: 'How to install texture packs, skins and shaders',
  lead: 'Get your creations into Minecraft: step-by-step guides for Java and Bedrock on PC, Mac, phones and consoles, plus answers to common questions.',
  faqTitle: 'Frequently asked questions',
};

/** The help page texts of a language. */
export function helpText(locale: Locale = 'en'): HelpText {
  return locale === 'en' ? HELP_EN : (contentOf(locale).help ?? HELP_EN);
}

/** Sections with the texts of a language (structured data). */
export function helpSections(locale: Locale = 'en'): HelpSection[] {
  const t = helpText(locale);
  return SECTIONS.map((s) => ({ ...s, ...(t.sections[s.id] ?? HELP_EN.sections[s.id]) }));
}

const tocItem = (id: string, label: string, icon: IconName, accent: string, active: boolean) =>
  el('a', { class: ['toc-link', accent], to: `/help?s=${id}`, 'data-section': id, 'aria-current': active ? 'true' : null }, ic(icon), el('span', null, label));

const BADGE_TONE: Record<NonNullable<HelpSection['edition']>, string> = { Java: 'green', Bedrock: 'blue', 'Java & Bedrock': 'gold' };

/** The whole help page (without the footer). */
export function helpPage(locale: Locale = 'en'): ElNode[] {
  const t = helpText(locale);
  const u = ui(locale);
  const meta = pageMeta(HELP_META.path, locale) ?? HELP_META;
  const toc = el(
    'nav',
    { class: 'help-toc', 'aria-label': t.toc.title, 'data-md': 'skip' },
    el('div', { class: 'section-title' }, t.toc.title),
    el('div', { class: 'toc-group' }, el('span', { class: 'toc-label' }, t.toc.textures), tocItem('java-packs', 'Java', 'image', 'accent-green', true), tocItem('bedrock-packs', 'Bedrock', 'gamepad', 'accent-green', false)),
    el('div', { class: 'toc-group' }, el('span', { class: 'toc-label' }, t.toc.skins), tocItem('java-skins', 'Java', 'human', 'accent-blue', false), tocItem('bedrock-skins', 'Bedrock', 'shirt', 'accent-blue', false)),
    el(
      'div',
      { class: 'toc-group' },
      el('span', { class: 'toc-label' }, t.toc.shaders),
      tocItem('iris', t.toc.irisOptifine, 'sparkles', 'accent-purple', false),
      tocItem('vanilla-shaders', t.toc.vanilla, 'sun', 'accent-purple', false),
      tocItem('vibrant-visuals', t.toc.vibrant, 'cloud-sun', 'accent-purple', false),
    ),
    el(
      'div',
      { class: 'toc-group' },
      el('span', { class: 'toc-label' }, t.toc.more),
      tocItem('folders', t.toc.folders, 'folder', 'accent-gold', false),
      tocItem('faq', t.toc.faq, 'circle-question', 'accent-gold', false),
      el('a', { class: ['toc-link', 'accent-gold'], to: '/guides' }, ic('book-open'), el('span', null, t.toc.allGuides)),
    ),
  );

  const sections = helpSections(locale).map((s) =>
    el(
      'section',
      { class: ['help-section', s.accent], id: `help-${s.id}`, tabindex: '-1', 'aria-labelledby': `help-${s.id}-title` },
      el(
        'header',
        { class: 'help-section-head' },
        el('span', { class: 'help-section-icon' }, ic(s.icon)),
        el('h2', { id: `help-${s.id}-title` }, s.title),
        s.edition ? el('span', { class: ['badge', `tone-${BADGE_TONE[s.edition]}`], 'data-md': 'skip' }, s.edition === 'Java & Bedrock' ? t.bothEditions : s.edition) : null,
      ),
      el('div', { class: 'help-section-body' }, s.body),
    ),
  );

  const faq = el(
    'section',
    { class: 'help-section accent-gold', id: 'help-faq', tabindex: '-1', 'aria-labelledby': 'help-faq-title' },
    el('header', { class: 'help-section-head' }, el('span', { class: 'help-section-icon' }, ic('circle-question')), el('h2', { id: 'help-faq-title' }, t.faqTitle)),
    faqList(t.faq),
  );

  return [
    el(
      'header',
      { class: 'help-hero container' },
      breadcrumbs([{ label: u.home, to: '/' }, { label: meta.label }], u.breadcrumb),
      el('span', { class: 'eyebrow' }, ic('book-open'), t.eyebrow),
      el('h1', { class: 'pixel-shadow' }, t.title),
      el('p', { class: 'lead' }, t.lead),
      el(
        'div',
        { class: 'help-quick', 'data-md': 'skip' },
        QUICK.map((q) =>
          el(
            'a',
            { class: ['help-quick-card', q.accent], to: `/help?s=${q.id}`, 'data-section': q.id },
            el('span', { class: 'help-quick-icon' }, ic(q.icon)),
            el('span', null, t.quick[q.id]),
            ic('arrow-right', { class: 'help-quick-go' }),
          ),
        ),
      ),
    ),
    el('div', { class: 'container help-layout' }, toc, el('div', { class: 'help-content' }, sections, faq)),
  ];
}
