// What each tool does, how to use it and common questions. Prerendered as the content of
// /textures/, /skins/ and /shaders/ (the pages search engines and AI crawlers read) and shown
// below each tool's start screen once the app is running, so both say the same thing.

import type { IconName } from '../../ui/icons';
import { el, ic, type Child, type ElNode } from '../markup';
import { breadcrumbs, code, figure, link, steps, strong, faqList, type FaqItem } from './blocks';
import { SHOTS } from './shots';
import { guideCards } from './guide-cards';
import { TOOL_META } from '../seo/meta';
import { KNOWN_RELEASE_FORMATS, formatPackFormat } from '../../editions/java/packformats';

export type IntroTool = 'textures' | 'converter' | 'skins' | 'skinpack' | 'shaders';

export interface ToolIntro {
  tool: IntroTool;
  /** Tool whose start screen the page boots into, when it is not the page's own (skin pack maker → skins) */
  base?: 'textures' | 'convert' | 'skins' | 'shaders';
  accent: string;
  icon: IconName;
  eyebrow: string;
  heading: string;
  lead: Child[];
  /** Name used in structured data (WebApplication) */
  appName: string;
  features: Child[];
  /** Plain-text feature list for structured data */
  featureList: string[];
  howTitle: string;
  steps: Child[];
  /** Extra sections between the steps and the questions (sub = heading tag for their titles) */
  extra?: (sub: 'h2' | 'h3') => Child[];
  faq: FaqItem[];
  guides: string[];
  cta: string;
}

const f263 = formatPackFormat(KNOWN_RELEASE_FORMATS['26.3']);

export const TOOL_INTROS: Record<IntroTool, ToolIntro> = {
  textures: {
    tool: 'textures',
    accent: 'accent-green',
    icon: 'image',
    eyebrow: 'Texture packs',
    heading: 'Minecraft texture pack editor & resource pack creator',
    appName: 'Minecraft Texture Pack Maker',
    lead: [
      'Make a Minecraft texture pack online: repaint any block, item or mob on its real 3D model using the textures of the version you play, then download a resource pack Minecraft loads straight away. It works for ',
      strong('Java Edition'),
      ' (26.3 and every version back to 1.6.1) and ',
      strong('Bedrock Edition'),
      ', it is free and nothing is uploaded.',
    ],
    featureList: [
      'Browse every vanilla texture of the chosen version, with search and categories',
      'Pixel editor: pencil, eraser, fill, eyedropper, line, shapes, noise, selection, mirror painting, undo and redo',
      'Upload your own PNGs, auto-resized to the texture (16x up to 512x)',
      'Edit animated textures frame by frame',
      'One-click whole-pack effects such as Dark Mode, Pastel, Neon Outline, Retro 8-bit, Autumn, Winter, Noir, Cartoon and Smooth HD',
      'Open an existing .zip or .mcpack pack and keep editing',
      '3D block preview, pack icon, description and Java compatibility range',
      'Exports a .zip with the correct pack.mcmeta for the Java version, or a Bedrock .mcpack',
    ],
    features: [
      ['Every vanilla texture of the version you pick, with search and categories.'],
      ['A full pixel editor: pencil, eraser, fill, eyedropper, line, shapes, noise, selection, mirror painting and undo/redo, with tiled preview and zoom.'],
      ['Upload your own PNGs (auto-resized to the texture, 16x up to 512x) and edit animated textures frame by frame.'],
      ['One-click whole-pack effects such as Dark Mode, Pastel, Neon Outline, Retro 8-bit, Autumn, Winter, Noir, Cartoon and Smooth HD, stacked without changing your own edits.'],
      ['Open an existing ', code('.zip'), ' or ', code('.mcpack'), ' and keep editing.'],
      ['A 3D block preview, pack icon, description and a Java compatibility range.'],
      ['Exports a ', code('.zip'), ' with the exact ', code('pack.mcmeta'), ' rules of your Java version, or a Bedrock ', code('.mcpack'), '.'],
    ],
    howTitle: 'How to make a texture pack here',
    steps: [
      ['Choose ', strong('Java'), ' or ', strong('Bedrock'), ' and a version. Java 26.3 is selected by default.'],
      'Your browser downloads that version’s textures straight from Mojang and keeps them on this device for next time.',
      'Pick a texture from the list and paint it, or upload your own image.',
      'Add effects, a pack icon and a description if you like.',
      ['Export. On Java, put the ', code('.zip'), ' in the ', code('resourcepacks'), ' folder; on Bedrock, open the ', code('.mcpack'), ' to import it.'],
    ],
    faq: [
      {
        id: 'versions',
        q: 'Which Minecraft versions can I make a texture pack for?',
        a: [
          el(
            'p',
            null,
            'Java 26.3 is the default, and every Java release back to 1.6.1 (the first version with resource packs) works, plus snapshots if you switch them on. For Bedrock you can use the latest release, the latest preview and older versions.',
          ),
        ],
      },
      {
        id: 'format',
        q: 'What pack format does Java 26.3 use?',
        a: [
          el(
            'p',
            null,
            `Resource pack format ${f263}. Since 1.21.9 a pack declares `,
            code('min_format'),
            ' and ',
            code('max_format'),
            ' in ',
            code('pack.mcmeta'),
            ' instead of a single number; the maker writes the right fields for the version you choose. ',
            link('/guides/minecraft-pack-format-versions', 'Formats of every version'),
            '.',
          ),
        ],
      },
      {
        id: 'resource',
        q: 'Is a texture pack the same as a resource pack?',
        a: [el('p', null, 'Yes, for textures. Java Edition renamed texture packs to resource packs in 1.6.1, because they can also change models, sounds, fonts and shaders. This editor makes the texture part and writes the files every resource pack needs.')],
      },
      {
        id: 'photoshop',
        q: 'Do I need Photoshop or another image editor?',
        a: [el('p', null, 'No. The pixel editor has everything a texture needs: pencil, fill, shapes, colour picker, noise, selection, mirror painting and animation frames. If you prefer your own editor, upload the PNG instead.')],
      },
      {
        id: 'hd',
        q: 'Can I make an HD texture pack?',
        a: [el('p', null, 'Yes. Pick a resolution from 16× (the vanilla look) up to 512× when you create the pack. Uploaded images are resized to fit, and the one-click Smooth HD effect upscales every texture at once.')],
      },
      {
        id: 'devices',
        q: 'Can I make a texture pack on a phone, tablet or Chromebook?',
        a: [el('p', null, 'Yes. The editor runs in any modern browser, with touch painting and zoom, and nothing to install. Bedrock players on phones can open the exported ', code('.mcpack'), ' straight in Minecraft.')],
      },
      {
        id: 'existing',
        q: 'Can I edit a texture pack I already have?',
        a: [el('p', null, 'Yes. Choose ', strong('Open a pack'), ' and pick a Java ', code('.zip'), ' or Bedrock ', code('.mcpack'), '. The edition and version are detected from the pack.')],
      },
      {
        id: 'purple',
        q: 'Why are some blocks purple and black in my pack?',
        a: [
          el(
            'p',
            null,
            'The purple-and-black checkerboard is Minecraft’s “missing texture”: a model points to an image that is not where it expects. It happens with renamed files, a wrong folder, or a pack made for a different version. Packs exported here keep the exact vanilla paths of the version you picked. ',
            link('/guides/texture-pack-not-working', 'Fix a pack that is not working'),
            '.',
          ),
        ],
      },
      {
        id: 'unzip',
        q: 'Do I need to unzip the download?',
        a: [el('p', null, 'No. On Java, put the ', code('.zip'), ' in the ', code('resourcepacks'), ' folder as it is. On Bedrock, open the ', code('.mcpack'), ' and Minecraft imports it.')],
      },
      {
        id: 'older',
        q: 'Why does Minecraft say my pack is made for an older or newer version?',
        a: [
          el(
            'p',
            null,
            'Java compares the pack format in ',
            code('pack.mcmeta'),
            ' with its own. Export again for the version you play, or widen the compatibility range. Texture-only packs usually still work if you click Yes. ',
            link('/guides/install-resource-packs', 'Install and troubleshooting guide'),
            '.',
          ),
        ],
      },
    ],
    extra: () => [el('div', { class: 'tool-intro-grid' }, figure(SHOTS.editor), figure(SHOTS.effects))],
    guides: ['make-a-texture-pack', 'texture-pack-not-working', 'install-resource-packs', 'java-vs-bedrock-packs'],
    cta: 'Start a texture pack',
  },
  converter: {
    tool: 'converter',
    base: 'convert',
    accent: 'accent-green',
    icon: 'repeat',
    eyebrow: 'Converter',
    heading: 'Minecraft Texture Pack Converter',
    appName: 'Minecraft Texture Pack Converter',
    lead: [
      'Turn a ',
      strong('Java'),
      ' texture pack into a ',
      strong('Bedrock'),
      ' one, a Bedrock pack into a Java one, or an old Java pack into one for the version you play. Free, in your browser, and the pack never leaves your device.',
    ],
    featureList: [
      'Java to Bedrock: textures moved to Bedrock’s folders and names, with a manifest.json',
      'Bedrock to Java: textures moved to Java’s folders and names, with a pack.mcmeta',
      'Java version to Java version, including the 1.13 texture renames',
      'Animations, the pack icon and the description are carried over',
      'A report lists every texture that could not be converted',
      'Open the converted pack in the editor to touch it up',
    ],
    features: [
      ['Java → Bedrock: every texture is moved to Bedrock’s folder and file name and gets a ', code('manifest.json'), '.'],
      ['Bedrock → Java: textures go to Java’s paths, ', code('.tga'), ' images become PNG, and the pack gets a ', code('pack.mcmeta'), '.'],
      ['Old Java → new Java (or back): textures renamed between versions, such as the big 1.13 rename, are fixed for you, and models that use them are updated.'],
      ['PNG → .mcpack: a loose PNG or a zip of PNG textures named like the game’s becomes a ready pack.'],
      ['Animations, the pack icon and the description come along.'],
      ['A report lists anything that could not be converted, so you know what to repaint.'],
      ['Open the result in the Texture Pack Maker to fix the rest, then export.'],
    ],
    howTitle: 'How to convert a texture pack',
    steps: [
      ['Choose your pack: a Java ', code('.zip'), ', a Bedrock ', code('.mcpack'), ', or PNG textures named like the game’s.'],
      'Pick what to convert it to: Bedrock, or Java and a version.',
      'Check the report of converted and skipped textures.',
      ['Download the converted pack, or open it in the editor to touch it up first.'],
    ],
    faq: [
      {
        id: 'rename',
        q: 'Can I convert a Java pack by renaming .zip to .mcpack?',
        a: [el('p', null, 'No. The two editions use different folders, file names and description files, so Bedrock rejects a renamed Java pack. The converter moves and renames each texture and writes a ', code('manifest.json'), '. ', link('/guides/java-vs-bedrock-packs', 'Java vs Bedrock packs'), '.')],
      },
      {
        id: 'everything',
        q: 'Does every texture convert?',
        a: [el('p', null, 'Most block, item and environment textures do. Some textures exist in only one edition, and some, such as many mobs, chests and menus, are laid out differently, so they are listed in the report for you to repaint.')],
      },
      {
        id: 'models',
        q: 'What about custom models, sounds and fonts?',
        a: [el('p', null, 'Between Java and Bedrock only textures are converted: models, sounds, fonts and shaders work differently in each edition, so they are left out and listed in the report. Between Java versions they are kept, and texture names inside models are updated.')],
      },
      {
        id: 'png',
        q: 'Can I turn PNG files into an .mcpack?',
        a: [el('p', null, 'Yes. Choose a PNG, or a zip of PNGs, whose names match the game’s textures (for example ', code('stone.png'), ' or ', code('block/stone.png'), '), then pick Bedrock. Images with names the game does not use are listed so you can rename them.')],
      },
      {
        id: 'old',
        q: 'Can I update an old texture pack to the newest version?',
        a: [el('p', null, 'Yes, and back to an older version too. Choose Java and the version you play. Textures that were renamed in between, such as in 1.13, are moved to their new names, and the pack gets that version’s ', code('pack.mcmeta'), '.')],
      },
      {
        id: 'upload',
        q: 'Is my pack uploaded?',
        a: [el('p', null, 'No. The conversion happens in your browser, so the pack stays on your device.')],
      },
    ],
    guides: ['java-vs-bedrock-packs', 'install-resource-packs', 'texture-pack-not-working'],
    cta: 'Convert a pack',
  },
  skins: {
    tool: 'skins',
    accent: 'accent-blue',
    icon: 'human',
    eyebrow: 'Skins',
    heading: 'Make a custom Minecraft skin or skin pack',
    appName: 'Minecraft Skin Editor',
    lead: [
      'Paint your character on the standard skin template while a 3D model updates live, then use it in ',
      strong('Java'),
      ' or ',
      strong('Bedrock'),
      '. Free, with no account needed.',
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
      ['Export a Java ', code('.png'), ' (plus a legacy 64×32 copy for 1.7.10 and older), or a Bedrock skin pack ', code('.mcpack'), ' holding one skin or a whole set, classic and slim mixed.'],
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
        q: 'How do I make a custom skin pack?',
        a: [
          el(
            'p',
            null,
            'Paint each skin as its own project, then choose ',
            strong('Bedrock skin pack (.mcpack)'),
            ' and tick the other skins to add. Every skin keeps its own name and classic or slim arms, and exporting again updates the installed pack instead of adding a copy. ',
            link('/skin-pack-maker', 'More about the skin pack maker'),
            '.',
          ),
        ],
      },
      {
        id: 'trusted',
        q: 'Why do my friends see a default skin?',
        a: [el('p', null, 'On Bedrock, players who turn on ', strong('Only Allow Trusted Skins'), ' see custom skins as default ones. It is a setting on their side.')],
      },
    ],
    extra: () => [el('div', { class: 'tool-intro-grid' }, figure(SHOTS.skin2d), figure(SHOTS.skin3d))],
    guides: ['make-a-skin', 'install-resource-packs', 'java-vs-bedrock-packs'],
    cta: 'Start a skin',
  },
  skinpack: {
    tool: 'skinpack',
    base: 'skins',
    accent: 'accent-blue',
    icon: 'package',
    eyebrow: 'Skin packs',
    heading: 'Minecraft Skin Pack Maker',
    appName: 'Minecraft Skin Pack Maker',
    lead: [
      'Paint or upload your skins, then download them together as one Bedrock ',
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
    guides: ['make-a-skin', 'install-resource-packs', 'java-vs-bedrock-packs'],
    cta: 'Start a skin pack',
  },
  shaders: {
    tool: 'shaders',
    accent: 'accent-purple',
    icon: 'sparkles',
    eyebrow: 'Shaders',
    heading: 'Make Minecraft shaders online',
    appName: 'Minecraft Shader Maker',
    lead: ['Choose where you play, pick a preset, move a few sliders and watch a live 3D preview with a day and night cycle. Then export a pack that is ready to drop into the game.'],
    featureList: [
      'Iris / OptiFine shader packs for Java: shadows, waving plants, water, bloom, god rays, tone mapping and colour grading',
      'Vanilla Java shaders without mods: colour grading, vignette, fog and, on 26.3 and newer, bloom',
      'Bedrock Vibrant Visuals packs: lighting, sky, fog, water and colour grading',
      'Presets, grouped sliders and a live 3D preview with a day/night cycle',
      'Every generated shader is compile-checked',
    ],
    features: [
      [strong('Iris / OptiFine shader packs'), ' (Java, needs the mod): real shadows, waving plants, water, bloom, god rays, tone mapping and colour grading, all adjustable in game too. Iris covers Java 1.16.5 to 26.3; OptiFine goes up to 26.2.'],
      [strong('Vanilla Java, no mods:'), ' a resource pack that patches your version’s own shaders for colour grading, vignette, fog and, on 26.3 and newer, full-screen bloom. Needs Java 1.17 or newer.'],
      [strong('Bedrock Vibrant Visuals:'), ' a settings pack for sunlight, sky, fog, water and colour grading on devices that support Vibrant Visuals.'],
      ['Presets, grouped sliders and a live 3D preview with a day/night cycle. Every generated shader is compile-checked.'],
    ],
    howTitle: 'How to make a shader here',
    steps: [
      'Choose a target: Iris / OptiFine, Vanilla Java or Bedrock Vibrant Visuals.',
      'Pick a preset as a starting point.',
      'Adjust lighting, colour, fog and water with the sliders while the preview updates.',
      ['Export a ', code('.zip'), ' (Java) or ', code('.mcpack'), ' (Bedrock).'],
      'Install it: shader pack folder for Iris or OptiFine, resource pack folder for vanilla shaders, or open the .mcpack on Bedrock.',
    ],
    faq: [
      {
        id: 'mods',
        q: 'Do I need mods to use shaders?',
        a: [
          el(
            'p',
            null,
            'Only for Iris / OptiFine packs. Vanilla Java shader packs are ordinary resource packs (Java 1.17 and newer), and Bedrock Vibrant Visuals packs work in the normal game. ',
            link('/guides/make-shaders-without-mods', 'Shaders without mods'),
            '.',
          ),
        ],
      },
      {
        id: 'update',
        q: 'Why did my vanilla shader pack stop working after an update?',
        a: [el('p', null, 'Mojang changes the shader files often, so a vanilla shader pack only works on the version it was made for. Open your project, pick the new version and export again.')],
      },
      {
        id: 'bedrock',
        q: 'Can Bedrock use real shader packs?',
        a: [
          el(
            'p',
            null,
            'Not with custom shader code: that stopped working when Bedrock moved to the RenderDragon engine. Vibrant Visuals packs instead tune the built-in lighting, sky, fog, water and colour grading. ',
            link('/guides/bedrock-vibrant-visuals-settings', 'Vibrant Visuals settings explained'),
            '.',
          ),
        ],
      },
      {
        id: 'vulkan',
        q: 'Iris says it cannot run with Vulkan. What do I do?',
        a: [el('p', null, 'Java 26.2 and newer can use an experimental Vulkan renderer, but Iris needs OpenGL. Set ', strong('Graphics API'), ' in Minecraft’s options to ', strong('Default'), ' or ', strong('Prefer OpenGL'), '.')],
      },
    ],
    extra: () => [el('div', { class: 'tool-intro-grid' }, figure(SHOTS.shaderIris), figure(SHOTS.vibrantVisuals))],
    guides: ['make-shaders-without-mods', 'bedrock-vibrant-visuals-settings', 'install-resource-packs'],
    cta: 'Start a shader',
  },
};

/**
 * The introduction as a page section. `prerender` renders it as the whole page content (h1, and a
 * link to the tool itself); otherwise it sits below the tool's own start screen (h2).
 */
export function toolIntro(tool: IntroTool, opts: { prerender: boolean }): ElNode {
  const t = TOOL_INTROS[tool];
  const meta = TOOL_META[tool];
  const H = opts.prerender ? 'h1' : 'h2';
  const sub = opts.prerender ? 'h2' : 'h3';
  return el(
    'section',
    { class: ['tool-intro', 'container', t.accent, opts.prerender ? null : 'is-below'], 'aria-labelledby': `intro-${tool}-title`, 'data-tool-intro': tool },
    breadcrumbs([{ label: 'Home', to: '/' }, { label: meta.label }]),
    el(
      'header',
      { class: 'tool-intro-head' },
      el('span', { class: 'eyebrow' }, ic(t.icon), t.eyebrow),
      el(H, { id: `intro-${tool}-title`, class: opts.prerender ? 'pixel-shadow' : null }, t.heading),
      el('p', { class: 'lead' }, t.lead),
      opts.prerender
        ? el(
            'noscript',
            null,
            el('p', { class: 'tool-intro-noscript' }, 'The editor needs JavaScript. Turn it on to start making; the guides on this page work without it.'),
          )
        : null,
    ),
    el(
      'div',
      { class: 'tool-intro-grid' },
      el(
        'div',
        { class: 'tool-intro-card' },
        el(sub, null, 'What you can do'),
        el(
          'ul',
          { class: 'tool-intro-list' },
          t.features.map((f) => el('li', null, ic('check'), el('span', null, f))),
        ),
      ),
      el('div', { class: 'tool-intro-card' }, el(sub, null, t.howTitle), steps(t.steps)),
    ),
    t.extra ? t.extra(sub) : null,
    el('div', { class: 'tool-intro-faq' }, el(sub, null, 'Questions'), el('div', { class: 'tool-intro-card flush' }, faqList(t.faq, { idPrefix: `${tool}-faq` }))),
    el('div', { class: 'tool-intro-guides' }, el(sub, null, 'Guides'), guideCards(t.guides, opts.prerender ? 'h3' : 'h4', 2)),
  );
}
