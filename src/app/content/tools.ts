// What each tool does, how to use it and common questions. Prerendered as the content of
// /textures/, /skins/ and /shaders/ (the pages search engines and AI crawlers read) and shown
// below each tool's start screen once the app is running, so both say the same thing.
// English text here; translations fill in ToolIntroText (src/i18n/<lang>/tools.ts).

import type { IconName } from '../../ui/icons';
import { el, ic, type Child, type ElNode } from '../markup';
import { breadcrumbs, code, figure, link, steps, strong, faqList, type FaqItem } from './blocks';
import { SHOTS } from './shots';
import { guideCards } from './guide-cards';
import { discLengths } from './discs';
import { TOOL_META, pageMeta } from '../seo/meta';
import { KNOWN_RELEASE_FORMATS, formatPackFormat } from '../../editions/java/packformats';
import type { Locale } from '../../i18n/locales';
import { ui } from '../../i18n/ui';
import { contentOf, hasContent } from '../../i18n/content';

export type IntroTool = 'textures' | 'painting' | 'gui' | 'disc' | 'glint' | 'converter' | 'merge' | 'doctor' | 'totem' | 'fonts' | 'skins' | 'skinpack' | 'cape' | 'shaders';

export interface ToolIntro {
  tool: IntroTool;
  /** Tool whose start screen the page boots into, when it is not the page's own (skin pack maker → skins) */
  base?: 'textures' | 'convert' | 'merge' | 'doctor' | 'totem' | 'fonts' | 'skins' | 'shaders';
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
  /** Other tools to suggest (route paths), shown as cards below the guides */
  related?: string[];
  cta: string;
}

/** The translatable part of a tool introduction. */
export type ToolIntroText = Pick<ToolIntro, 'eyebrow' | 'heading' | 'lead' | 'appName' | 'features' | 'featureList' | 'howTitle' | 'steps' | 'extra' | 'faq' | 'cta'> & {
  /** Alt text of the page's link-preview screenshot */
  screenshotCaption?: string;
};

/** A tool introduction in a language (English when that language has no text for it). */
export function toolIntroIn(tool: IntroTool, locale: Locale): ToolIntro & { locale: Locale; screenshotCaption?: string } {
  const text = locale !== 'en' && hasContent(locale) ? contentOf(locale).tools[tool] : undefined;
  return text ? { ...TOOL_INTROS[tool], ...text, locale } : { ...TOOL_INTROS[tool], locale: 'en' };
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
      'Paint layers: add, hide, lock, reorder and merge layers with opacity and blend modes (multiply, screen, lighten, overlay), or trace over the game’s texture; the pack gets them flattened',
      'Stamp tool: ore spots, cracks, moss, dither and sparkles in your colours, or a selection saved as a stamp, turned and flipped',
      'Colour swap: replace a colour, similar colours or a whole shade ramp in a texture, a selection or every texture of the pack, with one undo',
      'Biome colours: edit the grass, foliage and dry foliage colour maps with the biomes marked on them, and preview grass and leaves in any biome',
      'Paint straight onto the 3D block model: each face paints the texture it shows, including multi-texture blocks, stairs, slabs and chests',
      'Edit mob textures on 3D mob models (over 80 mobs, Java and Bedrock) with variants and part toggles',
      'Saddles, horse and wolf armour, llama carpets, and humanoid armour with trims, shown and painted on the mobs that wear them',
      'Model editor for Java blocks and items: cubes, rotation, face textures and UVs, how they sit in hand, and 3D items made from the flat sprite',
      'Replace the game’s sounds with your own uploads or microphone recordings, trimmed and exported as Ogg Vorbis',
      'Upload your own PNGs, auto-resized to the texture (16x up to 512x)',
      'Animation maker: animate any block or item with frames, onion skin and timing in ticks, import and save GIFs, and get Java .mcmeta files or Bedrock flipbooks',
      'PvP and FPS packs: low fire, clear glass, a custom crosshair, smaller swords and 8× textures in one click',
      'GUI editor: the hotbar, hearts, hunger, armour, the inventory and containers, buttons, menu backgrounds, the title screen panorama, splash texts and the enchantment glint, with a live in-game preview',
      'PBR materials: shine, metal, glow, light through and bumps (normal maps made from the colours) for Bedrock Vibrant Visuals and Java labPBR shaders, with a lit 3D preview',
      'Name-based textures: a renamed item gets its own texture and model, as item definitions for Java 1.21.5+ (no mods) or OptiFine CIT files for older versions',
      'One-click whole-pack effects such as Dark Mode, Pastel, Neon Outline, Retro 8-bit, Autumn, Winter, Noir, Cartoon and Smooth HD',
      'Open an existing .zip or .mcpack pack and keep editing',
      '3D block preview, pack icon, description and Java compatibility range',
      'Exports a .zip with the correct pack.mcmeta for the Java version, or a Bedrock .mcpack',
    ],
    features: [
      ['Every vanilla texture of the version you pick, with search and categories.'],
      ['A full pixel editor: pencil, eraser, fill, eyedropper, line, shapes, noise, selection, mirror painting and undo/redo, with tiled preview and zoom.'],
      ['Paint layers: open Layers over the canvas to paint on separate layers, like in an image editor. Add, duplicate, rename, hide, lock, drag and merge them, set their opacity and blend mode (multiply, screen, lighten, overlay), or put the game’s texture on a locked layer to trace over. Layers go through every animation frame, undo takes back layer changes too, and Minecraft gets the layers flattened into one PNG.'],
      ['Stamps: pick the stamp tool (S) to place ore spots, cracks, moss, a dither patch or sparkles in shades of your colour, or save a selection as a stamp of your own. Turn it with R, flip it with H, see it under the pointer before you click, and tap to place it on a phone. Stamps paint the layer you are on and undo like any stroke.'],
      ['Colour swap: replace one colour with another, take similar colours along with a tolerance, or move a colour’s whole shade ramp so its darker and lighter shades keep their hue shift. Swap in the open texture, the selection or every texture of your pack that uses the colour, picked from a list with before and after pictures, and take it all back with one undo.'],
      ['Biome colours: open the grass, foliage or (1.21.5+) dry foliage colour map to see where each biome takes its colour, with warm to cold and dry to rainy explained and biomes such as plains, jungle, swamp and cherry grove marked. A grass block and leaves show the colour as you paint, and the 3D previews colour grass and leaves for the biome you pick. The editor says where the game uses its own colours instead, such as swamp grass, badlands and spruce and birch leaves.'],
      ['Paint in 3D: switch the editor to 3D (or press D) and paint right on the block model. Each face paints the texture it shows, so a furnace’s front, sides and top, or the grass side overlay, are edited where you see them.'],
      ['Mobs in 3D: over 80 mobs, from creepers to villagers, show on their own models and paint like blocks. Hide a body part to reach what it covers, switch variants, ages or wool colours, and dress mobs in saddles and armour to paint those too.'],
      ['Change shapes (Java): edit a block’s or item’s model cube by cube, with its textures, UVs and the way it sits in hand, or turn a flat item into a 3D one. The model files go into the pack for your version. ', link('/guides/make-3d-items-texture-pack', 'How to make 3D items'), '.'],
      ['PvP and FPS packs: low fire, clear glass, no pumpkin blur, a custom crosshair, smaller swords and a lower shield, plus 8× textures and no animations, each one switch that writes the right files for your version. ', link('/guides/make-a-pvp-texture-pack', 'How to make a PvP pack'), '.'],
      ['Restyle the interface: the hotbar, hearts in every state, hunger, armour, air, the experience bar, the crosshair, the inventory, chests, furnace and crafting table, buttons and menu backgrounds, in the pixel editor, with a live preview of the HUD, the inventory, the title screen with its turning panorama and buttons, and enchanted items. Edit the title screen’s splash texts too. Older Java versions keep the HUD in two big pictures: picking a heart selects just its area.'],
      ['PBR materials: in the Material tab, give a texture a quick material (metal, polished or rough stone, wood, glass, glowing, glowing ore spots, water, leaves) or set its shine, metal, glow and light through for the whole texture or parts of it, with bumps made from its colours, on a lit 3D block under a moving sun. Bedrock gets texture sets for Vibrant Visuals; Java gets labPBR ', code('_n'), ' and ', code('_s'), ' maps for PBR shaders in Iris or OptiFine. ', link('/guides/make-a-pbr-texture-pack', 'How to make a PBR pack'), '.'],
      ['Name-based textures (Java): give an item its own texture when it is renamed in an anvil, like a diamond sword named “Excalibur”. Type one or more names, paint the new texture from a copy of the item’s and give it a 3D shape if you like. Java 1.21.5 and newer need no mods; older versions get OptiFine CIT files. ', link('/guides/rename-items-texture-pack', 'How to rename items to change their texture'), '.'],
      ['Animated textures: make any block or item animated, or change water, lava and fire. Add, drag, copy and delete frames, paint with an onion skin, set the speed in ticks (20 ticks are 1 second) with times for single frames and blending, and watch it at game speed. Import a GIF or a sprite sheet as frames and save the animation as a GIF. Java packs get ', code('.png.mcmeta'), ' files, Bedrock packs flipbook entries (blocks only). ', link('/guides/make-animated-textures', 'How to make animated textures'), '.'],
      ['Upload your own PNGs (auto-resized to the texture, 16x up to 512x).'],
      ['Change sounds: play any game sound, then replace it with your own file or a microphone recording, trimmed on its waveform. Sounds are saved as Ogg Vorbis, the format Minecraft plays.'],
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
        id: 'gui',
        q: 'Can I change the hotbar, hearts, menus and the title screen?',
        a: [el('p', null, 'Yes. Choose the GUI button above the texture list: it lists the HUD, the inventory and containers, buttons, menu backgrounds, the panorama, the splash texts and the enchantment glint of your version, and the Preview tab shows them in place as you paint. Java before 1.20.2 keeps the HUD and buttons in gui/icons.png and gui/widgets.png; the editor selects the right area for you.')],
      },
      {
        id: 'pbr',
        q: 'Can I make a PBR pack for Vibrant Visuals or shaders?',
        a: [el('p', null, 'Yes. Open a texture and choose the Material tab: pick a quick material such as metal, glass or glowing ore spots, or set shine, metal, glow and bumps yourself. Bedrock packs get texture sets and keep Vibrant Visuals on; Java packs get labPBR _n and _s maps, which PBR shaders for Iris and OptiFine read.')],
      },
      {
        id: 'names',
        q: 'Can a renamed item get its own texture?',
        a: [el('p', null, 'Yes, in Java packs. Open an item’s texture, choose Name-based textures in its menu (or Names under the preview), type the name and paint the new texture. Minecraft 1.21.5 and newer show it without mods when the item is renamed in an anvil to exactly that name; older versions need OptiFine or the CIT Resewn mod. Bedrock resource packs can’t do this.')],
      },
      {
        id: 'animation',
        q: 'Can I make my own animated textures?',
        a: [el('p', null, 'Yes. Open a block or item texture and choose Make animated in its menu, paint the frames, add more with + and set the speed in the Timing window, where 20 ticks are 1 second. You can also import a GIF. Java packs get a .png.mcmeta file for each animation; Bedrock packs get flipbook entries, which only blocks have, so Bedrock items stay still.')],
      },
      {
        id: 'biomes',
        q: 'How do I change the colour of grass and leaves?',
        a: [el('p', null, 'Grass, leaves and vines are grey in the pack and coloured by the game for each biome, from the colour maps ', code('colormap/grass.png'), ' and ', code('foliage.png'), ' (and ', code('dry_foliage.png'), ' for leaf litter from 1.21.5). Open one to see where each biome reads its colour and paint those areas, or paint the grass texture itself in colour. A few biomes ignore the maps: swamps, badlands, cherry groves and pale gardens have colours of their own, and on Java spruce and birch leaves never change colour.')],
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
    extra: () => [el('div', { class: 'tool-intro-grid' }, figure(SHOTS.paint3d), figure(SHOTS.mobGear)), el('div', { class: 'tool-intro-grid' }, figure(SHOTS.editor), figure(SHOTS.effects))],
    guides: ['make-a-texture-pack', 'make-3d-items-texture-pack', 'make-a-pvp-texture-pack', 'make-a-pbr-texture-pack', 'rename-items-texture-pack', 'make-animated-textures', 'texture-pack-not-working', 'install-resource-packs', 'java-vs-bedrock-packs', 'minecraft-pack-format-versions'],
    related: ['/painting-maker', '/gui-maker', '/music-disc-maker', '/enchantment-glint-maker'],
    cta: 'Start a texture pack',
  },
  painting: {
    tool: 'painting',
    base: 'textures',
    accent: 'accent-green',
    icon: 'image',
    eyebrow: 'Painting maker',
    heading: 'Minecraft Custom Painting Maker',
    appName: 'Minecraft Painting Maker',
    lead: [
      'Put your own pictures on Minecraft’s walls: pick one of the game’s paintings, upload a photo or a drawing (it is resized to fit) or paint it pixel by pixel, then download a resource pack. For ',
      strong('Java Edition'),
      ' and ',
      strong('Bedrock Edition'),
      ', free, and nothing is uploaded.',
    ],
    featureList: [
      'Every painting of the chosen Java or Bedrock version, opened at its own size',
      'Upload any picture: resized to the painting, stretched, fitted or filled, with sharp or smooth pixels',
      'Pixel editor with layers, stamps, colour swap and mirror painting',
      'HD paintings at 32×, 64× or 128×',
      'Animated paintings for Java 1.14 and newer, with the .png.mcmeta written for you',
      'Exports a Java .zip or a Bedrock .mcpack',
    ],
    features: [
      ['Every painting of your version in one list, each opening at its own size: a 1×1 painting is 16×16 pixels at 16×, a 4×4 one 64×64.'],
      ['Upload a photo, a drawing or a screenshot (PNG, JPG, GIF, WebP or TGA). It is resized to the painting: choose ', strong('Stretch'), ', ', strong('Fit'), ' or ', strong('Fill'), ', sharp pixels or smooth, and see the result before it replaces anything.'],
      ['Touch it up with the full pixel editor: layers, stamps, colour swap, shapes, fill and mirror painting, with undo.'],
      ['HD paintings: make the pack at 32×, 64× or 128× and every painting opens with that many pixels per block, so your picture keeps its detail. The painting maker starts at 64×.'],
      ['Animated paintings (Java 1.14 and newer): choose ', strong('Make animated'), ' in the painting’s menu, paint the frames or import a GIF, and set the timing. The pack gets the painting’s ', code('.png.mcmeta'), '.'],
      ['Download a ', code('.zip'), ' for Java or a ', code('.mcpack'), ' for Bedrock, with every painting in the folder the game reads it from.'],
    ],
    howTitle: 'How to make a custom painting',
    steps: [
      ['Choose ', strong('Java'), ' or ', strong('Bedrock'), ', your version and a resolution, then press ', strong('Create painting pack'), '. The editor opens on the paintings.'],
      'Pick the painting to replace. Its size in blocks stays the same, so choose one with the shape of your picture: wide, tall or square.',
      ['Press ', strong('Upload'), ' (the arrow above the canvas), choose your picture and how it fits, then ', strong('Replace texture'), '.'],
      'Touch it up in the pixel editor if you like, and do the same for more paintings.',
      ['Export, then put the ', code('.zip'), ' in the ', code('resourcepacks'), ' folder (Java) or open the ', code('.mcpack'), ' (Bedrock), turn the pack on and hang the painting.'],
    ],
    extra: (sub) => [
      el(
        'div',
        { class: 'tool-intro-grid' },
        el(
          'div',
          { class: 'tool-intro-card' },
          el(sub, null, 'Where each version keeps its paintings'),
          el('p', null, strong('Java 1.14 and newer:'), ' every painting is a file of its own in ', code('textures/painting/'), ', named after it (', code('kebab.png'), ', ', code('wither.png'), ', ', code('meditative.png'), '…), and ', code('back.png'), ' is the back of them all. The game stretches each picture over the painting’s blocks, so any resolution works as long as the shape stays: a 2×1 painting needs a picture twice as wide as it is tall.'),
          el('p', null, strong('Java 1.6.1 to 1.13.2:'), ' all paintings share one sheet, ', code('textures/painting/paintings_kristoffer_zetterstrand.png'), '. Paint each one where it sits on the sheet.'),
          el('p', null, strong('Bedrock:'), ' the original paintings and their back share one sheet, ', code('textures/painting/kz.png'), ', and the paintings added in 1.21 have files of their own (', code('backyard.png'), ', ', code('meditative.png'), '…). On the sheet, paint each painting in its own spot, or paste a picture already at the right size (Ctrl+V) and move it into place.'),
        ),
        el(
          'div',
          { class: 'tool-intro-card' },
          el(sub, null, 'Replacing a painting, not adding one'),
          el('p', null, 'A resource pack changes how the game’s paintings look; how many there are and their sizes stay the same. Java 1.21 and newer can add brand-new paintings with a data pack (a ', code('painting_variant'), ' file for each one), which this tool doesn’t make. So pick the painting whose size matches your picture and replace it: everyone who uses the pack sees your art wherever that painting hangs.'),
        ),
      ),
    ],
    faq: [
      {
        id: 'size',
        q: 'What size should my picture be?',
        a: [el('p', null, 'Any size with the shape of the painting: the editor resizes it for you. At 16× a painting has 16 pixels per block (a 2×1 painting is 32×16), at 64× it has 64 (128×64). For photos and detailed art, pick a higher resolution when you create the pack.')],
      },
      {
        id: 'new',
        q: 'Can I add a new painting instead of replacing one?',
        a: [el('p', null, 'Not with a resource pack: it only repaints the paintings the game has. Java 1.21 and newer can add paintings with a data pack, which this tool doesn’t make. Replace a painting of the same size instead.')],
      },
      {
        id: 'place',
        q: 'How do I get my painting on a wall?',
        a: [el('p', null, 'Place a painting as usual. The game picks one that fits the free space, so leave a gap exactly the size of yours (a 2×1 painting needs a space 2 blocks wide and 1 high), or keep placing until yours comes up.')],
      },
      {
        id: 'animated',
        q: 'Can a painting be animated?',
        a: [el('p', null, 'Yes, on Java 1.14 and newer: open the painting, choose Make animated in its menu, paint the frames and set the timing, and the pack gets a .png.mcmeta for it. Bedrock only animates block textures, so its paintings stay still. ', link('/guides/make-animated-textures', 'How to make animated textures'), '.')],
      },
      {
        id: 'others',
        q: 'Will other players see my painting?',
        a: [el('p', null, 'Only players who use the pack, since a resource pack changes what each player sees. On a Java server it can be the server’s resource pack; on Bedrock, add it to the world’s resource packs so everyone who joins gets it.')],
      },
    ],
    guides: ['make-animated-textures', 'install-resource-packs', 'texture-pack-not-working', 'make-a-texture-pack'],
    related: ['/textures', '/gui-maker'],
    cta: 'Make a painting pack',
  },
  gui: {
    tool: 'gui',
    base: 'textures',
    accent: 'accent-green',
    icon: 'layout',
    eyebrow: 'GUI maker',
    heading: 'Minecraft GUI & HUD Maker',
    appName: 'Minecraft GUI Maker',
    lead: [
      'Make a custom Minecraft GUI: repaint the hotbar, hearts, hunger, crosshair, inventory, buttons and menu backgrounds while a live preview shows them in place, as in the game. For ',
      strong('Java Edition'),
      ' (1.6.1 to 26.3) and ',
      strong('Bedrock Edition'),
      ', free and in your browser.',
    ],
    featureList: [
      'The HUD: hotbar, selected slot, crosshair, hearts in every state, hunger, armour, air bubbles and the experience bar',
      'Inventory, chest, large chest, furnace and crafting table windows',
      'Buttons, menu backgrounds, the title screen logo and its turning panorama',
      'Your own splash texts on the title screen',
      'Live preview of the HUD, the inventory and containers, the title screen and menus, at any GUI scale',
      'Java before 1.20.2: each piece selected on gui/icons.png or gui/widgets.png for you',
      'Exports a Java .zip or a Bedrock .mcpack',
    ],
    features: [
      ['The HUD, piece by piece: the hotbar, its selected slot and the off-hand slot, the crosshair, hearts (normal, poisoned, withered, frozen, absorption, hardcore and a mount’s), hunger, armour, air bubbles and the experience bar.'],
      ['Inventory and containers: the inventory, the chest and large chest, the furnace with its flame and arrow, and the crafting table.'],
      ['Buttons as they look normally, pointed at and greyed out, the menu backgrounds, the Minecraft logo and the six pictures of the title screen panorama.'],
      ['A live preview on the Preview tab: the HUD, the inventory and containers, the title screen with its turning panorama, and the menus. Show poisoned, frozen or hardcore hearts, the HUD under water or riding, change the GUI scale, and click any part to paint it.'],
      ['Splash texts: write the yellow lines of the title screen yourself or, on Java, start from the game’s list and change it.'],
      ['The pixel editor with layers, stamps, colour swap and HD resolutions. On Java before 1.20.2, where the HUD and buttons share ', code('gui/icons.png'), ' and ', code('gui/widgets.png'), ', picking a heart selects just its area.'],
    ],
    howTitle: 'How to make a custom GUI',
    steps: [
      ['Choose ', strong('Java'), ' or ', strong('Bedrock'), ' and your version, then press ', strong('Create GUI pack'), '. The editor opens on the GUI list with the hotbar.'],
      'Pick a part in the list (the hotbar, hearts, the inventory…) and paint it, or upload a picture for it.',
      'Watch the Preview tab: it shows the part in place and follows what you open. Click a part of the preview to paint that one.',
      'Add your splash texts and a menu background if you like.',
      ['Export a ', code('.zip'), ' (Java) or an ', code('.mcpack'), ' (Bedrock) and turn the pack on in the game.'],
    ],
    extra: (sub) => [
      el(
        'div',
        { class: 'tool-intro-card' },
        el(sub, null, 'Where the GUI lives in each version'),
        el('p', null, strong('Java 1.20.2 and newer:'), ' every HUD icon and button is a sprite of its own in ', code('textures/gui/sprites/'), ' (', code('hud/hotbar.png'), ', ', code('hud/heart/full.png'), ', ', code('widget/button.png'), '…). Buttons come with a ', code('.mcmeta'), ' that says how they stretch, so keep their borders where they are.'),
        el('p', null, strong('Java 1.6.1 to 1.20.1:'), ' the HUD is one 256×256 picture, ', code('textures/gui/icons.png'), ', and the hotbar and buttons another, ', code('textures/gui/widgets.png'), '. Each piece sits at a fixed spot; the editor selects it when you pick it.'),
        el('p', null, strong('Containers'), ' are whole pictures in every Java version (', code('gui/container/inventory.png'), ', ', code('generic_54.png'), ' for chests…), with the window in the top-left corner of a 256×256 image.'),
        el('p', null, strong('Bedrock:'), ' the HUD is single files in ', code('textures/ui/'), ' (', code('heart.png'), ', ', code('hotbar_0.png'), ' to ', code('hotbar_8.png'), '…), the crosshair is the top-left corner of ', code('textures/gui/icons.png'), ', and the classic buttons and windows are small pictures the game stretches.'),
        el('p', null, 'A texture pack changes how the GUI looks, not where things are: slots, bars and buttons stay where the game puts them. (Bedrock’s JSON UI files can move things; this tool doesn’t edit them.)'),
      ),
    ],
    faq: [
      {
        id: 'crosshair',
        q: 'Can I make a custom crosshair?',
        a: [el('p', null, 'Yes. Pick Crosshair under HUD and paint it: Java 1.20.2 and newer use ', code('gui/sprites/hud/crosshair.png'), ', older Java versions and Bedrock the top-left 15×15 pixels of ', code('gui/icons.png'), '. Java draws it by inverting the colours behind it, so white shows best. The PvP tab has ready-made crosshairs too. ', link('/guides/make-a-pvp-texture-pack', 'How to make a PvP pack'), '.')],
      },
      {
        id: 'hd',
        q: 'Can the GUI be HD?',
        a: [el('p', null, 'Yes. Create the pack at 32× or more and every GUI texture opens with more pixels, while the game still draws it at the same size on screen. Keep each picture’s shape: the 182×22 hotbar becomes 364×44 at 32×.')],
      },
      {
        id: 'layout',
        q: 'Can I move the hotbar or change the inventory layout?',
        a: [el('p', null, 'No. A texture pack changes the pictures, not the layout: slots, bars and buttons stay where the game puts them, so paint your design around them.')],
      },
      {
        id: 'atlas',
        q: 'Why is the whole HUD one picture in my version?',
        a: [el('p', null, 'Java before 1.20.2 keeps the HUD in ', code('gui/icons.png'), ' and the hotbar and buttons in ', code('gui/widgets.png'), '. Pick a piece in the GUI list and the editor selects its area, so you only paint that part.')],
      },
      {
        id: 'title',
        q: 'Can I change the title screen?',
        a: [el('p', null, 'Yes: the Minecraft logo, the six panorama pictures behind it (front, right, back, left, top and bottom), the buttons and the yellow splash texts. The preview turns the panorama like the game does.')],
      },
    ],
    guides: ['make-a-pvp-texture-pack', 'make-a-texture-pack', 'install-resource-packs', 'texture-pack-not-working'],
    related: ['/enchantment-glint-maker', '/font-maker'],
    cta: 'Make a GUI pack',
  },
  disc: {
    tool: 'disc',
    base: 'textures',
    accent: 'accent-green',
    icon: 'music',
    eyebrow: 'Music disc maker',
    heading: 'Custom Minecraft Music Disc Maker',
    appName: 'Minecraft Music Disc Maker',
    lead: [
      'Put your own song on a Minecraft music disc: pick a disc, upload an audio file or record one with your microphone, trim it on its waveform and repaint the disc if you like. The jukebox then plays your song in ',
      strong('Java Edition'),
      ' and ',
      strong('Bedrock Edition'),
      '. Free, in your browser, with nothing uploaded.',
    ],
    featureList: [
      'Every music disc of the chosen version, listed under Records',
      'Upload MP3, WAV, OGG or M4A audio up to 15 minutes long, or record with the microphone',
      'Trim on the waveform, set the volume, normalise, stereo or mono',
      'Saved as Ogg Vorbis, the format Minecraft plays; Bedrock packs get their sound_definitions.json entries',
      'Repaint the disc item in the pixel editor',
      'Exports a Java .zip or a Bedrock .mcpack',
    ],
    features: [
      ['Every music disc of your version in the Sounds list under ', strong('Records'), ', from 13 and cat to Pigstep, Relic, Precipice and Lava Chicken.'],
      ['Upload your song (MP3, WAV, OGG or M4A, up to 15 minutes) or record it with your microphone. A recording is trimmed and levelled for you.'],
      ['Trim the start and the end on the waveform, set the volume or press ', strong('Normalise'), ', and keep it in stereo or make it mono. Parts that would distort show in red.'],
      ['Saved as Ogg Vorbis, the only format Java plays, under the disc’s own file name. Bedrock packs also get the disc’s entry in ', code('sound_definitions.json'), '.'],
      ['Give the disc a new look: its picture is open in the pixel editor, so switch from Sounds to the textures to repaint it or upload one.'],
      ['Replace any other sound while you are there: mobs, blocks, menu clicks or the background music.'],
    ],
    howTitle: 'How to put your own song on a music disc',
    steps: [
      ['Choose ', strong('Java'), ' or ', strong('Bedrock'), ' and your version, then press ', strong('Create music disc pack'), '. The editor opens on the records, with cat picked.'],
      'Pick the disc to replace. On Java 1.21 and newer, choose one whose song is at least as long as yours (see the lengths below).',
      ['Press ', strong('Replace'), ', then ', strong('Upload a sound file…'), ' or ', strong('Record with the microphone…')],
      'Trim it on the waveform and set the volume, then play it to check.',
      ['Repaint the disc if you like and export. On Java put the ', code('.zip'), ' in the ', code('resourcepacks'), ' folder, on Bedrock open the ', code('.mcpack'), ', then turn the pack on and put the disc in a jukebox.'],
    ],
    extra: (sub) => [
      el(
        'div',
        { class: 'tool-intro-grid' },
        el(
          'div',
          { class: 'tool-intro-card' },
          el(sub, null, 'How long can the song be?'),
          el('p', null, 'In Java 1.21 and newer every disc has a set length: the jukebox stops it one second after the original song would end, even when your file is longer. Pick a disc at least as long as your song. The lengths in Java 26.3:'),
          discLengths('Disc lengths in Java 26.3'),
        ),
        el(
          'div',
          { class: 'tool-intro-card' },
          el(sub, null, 'Good to know'),
          el('p', null, strong('Stereo or mono:'), ' Java plays a stereo sound at the same loudness wherever you stand. Turn ', strong('Stereo'), ' off if your song should come from the jukebox and fade as you walk away.'),
          el('p', null, strong('Where the file goes:'), ' Java reads the song from ', code('assets/minecraft/sounds/records/'), ' (', code('cat.ogg'), ' for cat). Bedrock reads it from the path its ', code('sound_definitions.json'), ' names, and the pack gets that entry too.'),
          el('p', null, strong('The disc’s picture:'), ' Java 1.13 and newer read ', code('textures/item/music_disc_cat.png'), ' and so on; Bedrock reads ', code('textures/items/record_cat.png'), ' for the older discs and ', code('music_disc_relic.png'), ' and the like for the newer ones.'),
        ),
      ),
    ],
    faq: [
      {
        id: 'format',
        q: 'Which audio files can I use?',
        a: [el('p', null, 'MP3, WAV, OGG and M4A work in most browsers, up to 15 minutes long. The editor turns your file into Ogg Vorbis, the format Minecraft needs, so you don’t have to convert it first.')],
      },
      {
        id: 'length',
        q: 'Why does my song stop early?',
        a: [el('p', null, 'In Java 1.21 and newer the jukebox stops a disc one second after the original song’s length, whatever the length of your file. Replace a longer disc: blocks (5:45) and Precipice (4:59) are the longest.')],
      },
      {
        id: 'distance',
        q: 'Why do I hear the disc at the same volume everywhere?',
        a: [el('p', null, 'Your song is in stereo. Java plays stereo sounds without a direction, so they don’t fade with distance. Turn Stereo off for the disc in the editor and it comes from the jukebox again.')],
      },
      {
        id: 'name',
        q: 'Can I change the disc’s name?',
        a: [el('p', null, 'Not here: the disc and the “Now Playing” line keep the original title. They come from the game’s language files, which this tool doesn’t edit.')],
      },
      {
        id: 'new',
        q: 'Can I add a new disc instead of replacing one?',
        a: [el('p', null, 'Not with a resource pack alone. Java 1.21 and newer can add songs with a data pack, which this tool doesn’t make. Replacing a disc works in every version.')],
      },
      {
        id: 'others',
        q: 'Will other players hear my song?',
        a: [el('p', null, 'Only players who have the pack. On a Java server it can be the server’s resource pack; on Bedrock, add it to the world’s resource packs so everyone who joins gets it. ', link('/guides/install-resource-packs', 'How to install packs'), '.')],
      },
    ],
    guides: ['install-resource-packs', 'texture-pack-not-working', 'make-a-texture-pack'],
    related: ['/textures', '/painting-maker'],
    cta: 'Make a music disc pack',
  },
  glint: {
    tool: 'glint',
    base: 'textures',
    accent: 'accent-green',
    icon: 'sparkles',
    eyebrow: 'Enchantment glint',
    heading: 'Custom Enchantment Glint Maker',
    appName: 'Minecraft Enchantment Glint Maker',
    lead: [
      'Change the purple shimmer on enchanted swords, tools, books and armour: recolour the glint texture or paint your own, and watch it move over enchanted items as you work. For ',
      strong('Java Edition'),
      ' and ',
      strong('Bedrock Edition'),
      ', free and in your browser.',
    ],
    featureList: [
      'The glint textures of your version: for items, and for armour where the version has its own',
      'Moving preview of the glint over an enchanted sword, book and pickaxe, blended the way the game blends it',
      'Colour swap: move the glint’s whole shade ramp to a new colour in one step',
      'Pixel editor with layers, stamps and HD resolutions',
      'Java before 1.15 previewed with its two-layer glint',
      'Exports a Java .zip or a Bedrock .mcpack',
    ],
    features: [
      ['The glint texture of your version opens straight away, with the armour glint next to it in the GUI list where your version has one.'],
      ['A moving preview on the ', strong('Glint'), ' screen: an enchanted sword, book and pickaxe with your glint scrolling over them, blended like the game blends it, and the texture itself sliding underneath. The hotbar and inventory previews show it too.'],
      ['Recolour it in one step: ', strong('Swap a colour'), ' can move the glint’s whole shade ramp to a new colour, so a red, gold or green glint keeps its light and dark streaks.'],
      ['Or paint your own pattern with the pixel editor: layers, stamps such as sparkles, and HD resolutions.'],
      ['Java before 1.15 drew two glint layers sliding sideways; the preview shows that too when you make a pack for those versions.'],
      ['Download a ', code('.zip'), ' for Java or a ', code('.mcpack'), ' for Bedrock. Every enchanted item gets your glint, for everyone who uses the pack.'],
    ],
    howTitle: 'How to change the enchantment glint',
    steps: [
      ['Choose ', strong('Java'), ' or ', strong('Bedrock'), ' and your version, then press ', strong('Create glint pack'), '. The editor opens on the glint with its preview.'],
      ['Recolour it with ', strong('Swap a colour'), ' (tick the whole shade ramp), or paint over it.'],
      'Watch the preview: bright colours shine, dark ones fade and black adds nothing.',
      'Do the same for the armour glint if your version has one.',
      ['Export, turn the pack on in the game and look at an enchanted item. ', link('/guides/install-resource-packs', 'How to install packs'), '.'],
    ],
    extra: (sub) => [
      el(
        'div',
        { class: 'tool-intro-card' },
        el(sub, null, 'How the glint works'),
        el('p', null, 'The game doesn’t paint the glint on: it adds the light of the glint picture on top of the item, tilted, scrolling and repeated. So bright colours shine, dark ones barely show, and black adds nothing. One flat colour gives an even shine; streaks give the moving stripes.'),
        el('p', null, strong('Java, older versions:'), ' one picture for everything, ', code('textures/misc/enchanted_item_glint.png'), '.'),
        el('p', null, strong('Java, newer versions:'), ' ', code('misc/enchanted_glint_item.png'), ' for items, and a second picture for armour: ', code('misc/enchanted_glint_entity.png'), ', or ', code('misc/enchanted_glint_armor.png'), ' in 26.3.'),
        el('p', null, strong('Bedrock:'), ' ', code('textures/misc/enchanted_item_glint.png'), ' for items and ', code('textures/misc/enchanted_actor_glint.png'), ' for armour and mobs.'),
        el('p', null, 'The editor opens whichever your version has. On Java 1.19 and newer, players can also slow the glint down or dim it with Glint Speed and Glint Strength in Accessibility Settings.'),
      ),
    ],
    faq: [
      {
        id: 'colour',
        q: 'How do I change the glint colour?',
        a: [el('p', null, 'Open the glint (the glint maker does that for you), choose Swap a colour, pick one of its purples and your new colour, and tick the whole shade ramp. Bright colours work best: the game adds the glint’s light to the item, so dark colours look faint.')],
      },
      {
        id: 'each',
        q: 'Can each enchantment or item have its own glint?',
        a: [el('p', null, 'Not with a vanilla pack: one picture is used for every enchanted item, and one for armour where the version has it. Mods such as OptiFine can do more, but this tool doesn’t make their files.')],
      },
      {
        id: 'remove',
        q: 'Can I remove the glint?',
        a: [el('p', null, 'Paint the glint texture black: the game then adds nothing, and enchanted items look plain. On Java 1.19 and newer you can also turn Glint Strength down in Accessibility Settings, for yourself only.')],
      },
      {
        id: 'armour',
        q: 'Does it change enchanted armour too?',
        a: [el('p', null, 'In older Java versions the one glint covers everything. Newer Java versions and Bedrock have a second picture for armour (on Bedrock also for mobs), listed next to the item glint in the GUI list, so you can change them together or apart.')],
      },
      {
        id: 'speed',
        q: 'Can I change how fast it moves?',
        a: [el('p', null, 'Not in the pack: the game scrolls the glint itself. Players on Java 1.19 and newer can change Glint Speed in Accessibility Settings.')],
      },
    ],
    guides: ['install-resource-packs', 'make-a-texture-pack', 'texture-pack-not-working'],
    related: ['/gui-maker', '/textures'],
    cta: 'Make a glint pack',
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
    extra: () => [el('div', { class: 'tool-intro-grid' }, figure(SHOTS.convertPack), figure(SHOTS.convertResult))],
    guides: ['convert-java-to-bedrock-texture-pack', 'java-vs-bedrock-packs', 'install-resource-packs', 'texture-pack-not-working'],
    related: ['/pack-doctor', '/merge-texture-packs'],
    cta: 'Convert a pack',
  },
  merge: {
    tool: 'merge',
    base: 'merge',
    accent: 'accent-green',
    icon: 'git-merge',
    eyebrow: 'Merge packs',
    heading: 'Merge Minecraft Texture Packs',
    appName: 'Minecraft Texture Pack Merger',
    lead: [
      'Combine two to eight texture packs into one. Put them in order and, as in Minecraft’s own pack list, the pack at the top wins wherever two packs change the same texture. It works for ',
      strong('Java'),
      ' and ',
      strong('Bedrock'),
      ' packs, it is free and the packs never leave your device.',
    ],
    featureList: [
      'Combines 2 to 8 Java (.zip) or Bedrock (.mcpack, .mcaddon) texture packs into one',
      'Reorderable pack list: the top pack wins, as in Minecraft',
      'Animations (.mcmeta files and flipbook entries) stay with their textures',
      'Java language files, sounds.json, atlases and fonts merged entry by entry',
      'Bedrock terrain_texture.json, item_texture.json, flipbook_textures.json, blocks.json and sound definitions merged entry by entry',
      'Java packs for different versions get the texture names of one version first',
      'A report of the files each pack added and every conflict',
      'Download the merged pack or open it in the editor',
    ],
    features: [
      ['Up to eight packs at once: Java ', code('.zip'), ' files or Bedrock ', code('.mcpack'), ' and ', code('.mcaddon'), ' files.'],
      ['Drag the packs into order, or use the arrow buttons. The top pack wins, as in the Selected list in Minecraft.'],
      ['A texture keeps its own animation: its ', code('.png.mcmeta'), ' file or flipbook entry always comes from the same pack as the image.'],
      ['Java language files, ', code('sounds.json'), ', atlases and fonts are combined entry by entry instead of one replacing the other.'],
      ['Bedrock ', code('terrain_texture.json'), ', ', code('item_texture.json'), ', ', code('flipbook_textures.json'), ', ', code('blocks.json'), ' and sound definitions are combined the same way.'],
      ['Java packs made for different versions are renamed for the version you pick, so old and new packs fit together.'],
      ['A report shows how many files each pack added and lists every conflict. Open the result in the Texture Pack Maker to keep editing.'],
    ],
    howTitle: 'How to merge texture packs',
    steps: [
      ['Add the packs: two to eight Java ', code('.zip'), ' files, or Bedrock ', code('.mcpack'), ' files.'],
      'Put them in order. The pack at the top wins where two packs change the same file.',
      'Name the merged pack, pick its icon and, for Java, the version you play.',
      'Merge, check the list of conflicts, then download the pack or open it in the editor.',
    ],
    faq: [
      {
        id: 'wins',
        q: 'Which pack wins when two packs change the same texture?',
        a: [
          el(
            'p',
            null,
            'The one higher in the list, the same rule Minecraft uses for the Selected (Java) or active (Bedrock) packs. A texture only one pack changes is always kept. The report lists every file that was in more than one pack and the pack it was taken from.',
          ),
        ],
      },
      {
        id: 'editions',
        q: 'Can I merge Java and Bedrock packs?',
        a: [
          el(
            'p',
            null,
            'Not directly: the two editions use different folders, file names and pack files, so one pack can’t be both. Convert the packs to one edition with the ',
            link('/texture-pack-converter', 'Texture Pack Converter'),
            ' first, then merge them.',
          ),
        ],
      },
      {
        id: 'other',
        q: 'Do shaders, sounds and models merge?',
        a: [
          el(
            'p',
            null,
            'Every file comes along. Where two packs have the same file, such as a model, a block state, a sound or a core shader, the top pack’s copy is used. Files the game reads as lists are combined instead: language files, ',
            code('sounds.json'),
            ', atlases and fonts on Java, and the texture lists, ',
            code('blocks.json'),
            ' and sound definitions on Bedrock. Iris and OptiFine shader packs are not resource packs, so they are not merged here.',
          ),
        ],
      },
      {
        id: 'versions',
        q: 'Can I merge packs made for different versions?',
        a: [
          el(
            'p',
            null,
            'Yes, on Java. Pick the version you play: packs made for older or newer versions get that version’s texture names first, for example the 1.13 renames such as ',
            code('blocks/stone.png'),
            ' to ',
            code('block/stone.png'),
            '. The merged pack gets the ',
            code('pack.mcmeta'),
            ' of that version. ',
            link('/guides/minecraft-pack-format-versions', 'Pack formats of every version'),
            '.',
          ),
        ],
      },
      {
        id: 'upload',
        q: 'Is my pack uploaded?',
        a: [el('p', null, 'No. The packs are read and merged in your browser and stay on your device.')],
      },
      {
        id: 'install',
        q: 'How do I use the merged pack?',
        a: [
          el(
            'p',
            null,
            'Install it like any other pack and turn off the packs it was made from. One pack is also easier to share, or to set as a server’s resource pack. ',
            link('/guides/install-resource-packs', 'How to install resource packs'),
            '.',
          ),
        ],
      },
    ],
    extra: () => [el('div', { class: 'tool-intro-grid' }, figure(SHOTS.mergeSettings), figure(SHOTS.mergeResult))],
    guides: ['merge-texture-packs', 'install-resource-packs', 'texture-pack-not-working', 'minecraft-pack-format-versions'],
    related: ['/pack-doctor', '/texture-pack-converter'],
    cta: 'Merge packs',
  },
  doctor: {
    tool: 'doctor',
    base: 'doctor',
    accent: 'accent-green',
    icon: 'potion',
    eyebrow: 'Pack Doctor',
    heading: 'Fix a broken Minecraft texture pack',
    appName: 'Minecraft Pack Doctor',
    lead: [
      'Find out why a texture pack doesn’t work, then fix it. Pack Doctor reads ',
      strong('Java'),
      ' and ',
      strong('Bedrock'),
      ' packs, checks every file against the rules of the version you play, explains each problem and fixes what it safely can. It is free and the pack never leaves your device.',
    ],
    featureList: [
      'Checks Java (.zip) and Bedrock (.mcpack, .mcaddon) resource packs, or a folder',
      'Finds packs in an extra folder or a zip inside the zip, Mac junk files, damaged or unreadable zips',
      'Checks pack.mcmeta against the rules of the chosen Java version, from pack_format to min_format and max_format',
      'Finds texture folders and names from another version (blocks/ before 1.13, later renames) and renames them',
      'Finds file names with capital letters or spaces, JSON syntax errors, missing textures and models, and textures outside the atlas',
      'Checks images (fake PNGs, damaged, 16-bit, sizes), animations and sounds',
      'Checks Bedrock manifest.json (format, UUIDs, modules, min_engine_version), duplicate UUIDs and texture lists',
      'Tells shader packs and data packs apart from resource packs',
      'Fix all applies the safe fixes, shows a before and after, and downloads the fixed .zip or .mcpack',
    ],
    features: [
      ['Drop a Java ', code('.zip'), ', a Bedrock ', code('.mcpack'), ' or ', code('.mcaddon'), ', or the pack’s folder. Big packs stay smooth: everything runs in your browser.'],
      ['Every problem says how bad it is (won’t load, partly broken or a warning), which versions or devices it affects, and how to fix it.'],
      ['Java: a pack in an extra folder, a missing or broken ', code('pack.mcmeta'), ', the wrong pack format for your version, pre-1.13 folders like ', code('textures/blocks'), ', later renames, capital letters and spaces, JSON errors, missing textures and models.'],
      ['Bedrock: ', code('manifest.json'), ' (format, UUIDs, modules, engine version), copied packs with the same UUID, texture lists, letters in the wrong case for phones, and a ', code('.zip'), ' that should be a ', code('.mcpack'), '.'],
      ['Images that aren’t real PNGs, damaged or 16-bit images, sizes that aren’t powers of two, animations without their ', code('.mcmeta'), ', and sounds that aren’t Ogg Vorbis.'],
      ['Shader packs and data packs dropped in by mistake are recognised, and a Java pack used on Bedrock (or the other way round) leads to the converter.'],
      [strong('Fix all'), ' applies every safe fix, checks the pack again and shows what changed. Then download the fixed pack.'],
    ],
    howTitle: 'How to fix a texture pack',
    steps: [
      ['Drop the pack that doesn’t work: a ', code('.zip'), ', ', code('.mcpack'), ', ', code('.mcaddon'), ' or a folder.'],
      'Pick where you play: Java and your version, or Bedrock.',
      'Read the report. Each problem says how bad it is, which versions it affects and how to fix it.',
      [strong('Fix all'), ' applies the safe fixes and checks again. Download the fixed pack and install it.'],
    ],
    faq: [
      {
        id: 'what',
        q: 'What does Pack Doctor check?',
        a: [
          el(
            'p',
            null,
            'Everything that commonly stops a pack from working: where the pack sits in the zip, the zip itself, ',
            code('pack.mcmeta'),
            ' or ',
            code('manifest.json'),
            ', the pack format for your version, folder and file names, every JSON file, the paths between models and textures, images, animations and sounds. A healthy pack gets a “Looks good” with the list of what was checked.',
          ),
        ],
      },
      {
        id: 'safe',
        q: 'Is it safe to let it fix my pack?',
        a: [
          el(
            'p',
            null,
            'Yes. Fix all only applies fixes that can’t change how the pack looks, such as moving files out of an extra folder, writing a correct ',
            code('pack.mcmeta'),
            ' or renaming textures for your version. Fixes that are a choice, such as animating a texture or giving a Bedrock pack new UUIDs, have their own button. Your original file is never changed: you download a fixed copy.',
          ),
        ],
      },
      {
        id: 'not-listed',
        q: 'Why doesn’t my pack show up in Minecraft?',
        a: [
          el(
            'p',
            null,
            'Usually because ',
            code('pack.mcmeta'),
            ' (Java) or ',
            code('manifest.json'),
            ' (Bedrock) isn’t at the top of the zip, is missing, or isn’t valid. Pack Doctor finds and fixes all three. ',
            link('/guides/texture-pack-not-working', 'More fixes for packs that don’t work'),
            '.',
          ),
        ],
      },
      {
        id: 'purple',
        q: 'Why are some blocks purple and black?',
        a: [
          el(
            'p',
            null,
            'That is the missing texture: a model asks for an image that isn’t there, often because the pack uses folder or file names from another version, capital letters, or a folder the game doesn’t put on its atlas. The report lists every such path and renames what it can.',
          ),
        ],
      },
      {
        id: 'convert',
        q: 'Can it make a Java pack work on Bedrock?',
        a: [
          el(
            'p',
            null,
            'It tells you when a pack is for the other edition. Converting it is a job for the ',
            link('/texture-pack-converter', 'Texture Pack Converter'),
            ', which turns Java packs into Bedrock packs and back.',
          ),
        ],
      },
      {
        id: 'upload',
        q: 'Is my pack uploaded?',
        a: [el('p', null, 'No. The pack is read, checked and fixed in your browser. Only the game’s list of its own file names is downloaded, from Mojang, to check paths to vanilla textures.')],
      },
    ],
    guides: ['texture-pack-not-working', 'install-resource-packs', 'minecraft-pack-format-versions', 'convert-java-to-bedrock-texture-pack'],
    related: ['/texture-pack-converter', '/merge-texture-packs', '/textures'],
    cta: 'Check a pack',
  },
  totem: {
    tool: 'totem',
    base: 'totem',
    accent: 'accent-gold',
    icon: 'human-arms-up',
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
    guides: ['install-resource-packs', 'make-a-skin', 'texture-pack-not-working'],
    cta: 'Make a totem',
  },
  fonts: {
    tool: 'fonts',
    base: 'fonts',
    accent: 'accent-green',
    icon: 'text-start-a',
    eyebrow: 'Font maker',
    heading: 'Minecraft Font Maker',
    appName: 'Minecraft Font Maker',
    lead: [
      'Change the letters of Minecraft’s chat, signs, books and menus: draw your own pixel font on the game’s glyph grid or turn any font file into one, check it in the game’s own layout, then download a resource pack. It works for ',
      strong('Java'),
      ' (every version back to 1.6.1) and ',
      strong('Bedrock'),
      ', it is free and your font never leaves your device.',
    ],
    featureList: [
      'Draw each character pixel by pixel on the game’s glyph grid, with the baseline, accent rows and character width shown',
      'Built-in starter styles (Classic, Bold, Italic) covering Basic Latin, accented Latin, Cyrillic and symbols, or a blank grid',
      'Import a TTF, OTF, WOFF or WOFF2 font, or a font on your device, and turn it into pixels at the size and threshold you choose',
      'Java 1.13+: optionally put a TrueType font in the pack as a "ttf" provider with size, oversample and shift',
      'Open an existing font pack (.zip or .mcpack) or start from the game’s own font of any Java version',
      'Live preview in chat, on a sign, in a book, on the title screen splash and in an item tooltip, with character widths and shadow as the game draws them',
      'Characters the font doesn’t have are marked, since the game shows them in its own font',
      'Java resource pack (.zip) with the right pack.mcmeta and font files for 1.6.1 to 26.3, or a Bedrock .mcpack',
      'Add the font to a texture pack you are making in the Texture Pack Maker',
    ],
    features: [
      ['Start from a ', strong('starter style'), ' drawn for this tool, a blank grid, a ', code('.ttf'), ' / ', code('.otf'), ' / ', code('.woff'), ' font file, a pack you already have or the game’s own font.'],
      ['Draw on the same grid the game uses: 8 pixels per character (or 16 and 32 for HD fonts), with room above for accents on capitals. The width each character takes in a line is worked out from its pixels, exactly as Minecraft does it.'],
      ['Basic Latin, accented letters for German, Spanish, Portuguese and more, Cyrillic, Japanese kana and symbols each have their own list, and you can add any other character.'],
      ['See your text in chat, on a sign, in a book, as the yellow title screen splash and in a tooltip. Type your own sample to test any word.'],
      ['Download a Java ', code('.zip'), ' with the right ', code('pack.mcmeta'), ' for your version or a Bedrock ', code('.mcpack'), '. Characters you don’t draw keep the game’s own look.'],
    ],
    howTitle: 'How to make a custom Minecraft font',
    steps: [
      'Choose what to start from: a starter style, a font file, an existing pack or the game’s font.',
      'Pick a character and click or drag on its pixels. Move, mirror, copy and undo as you go.',
      'Check the preview in chat, on signs, in books, on the title screen and in tooltips.',
      ['Choose Java and the version you play, or Bedrock, then download the ', code('.zip'), ' or ', code('.mcpack'), '.'],
      'Install it like any resource pack and move it above other packs.',
    ],
    extra: (sub) => [
      el(
        'div',
        { class: 'tool-intro-card' },
        el(sub, null, 'How Minecraft reads fonts'),
        el(
          'p',
          null,
          'Java 1.13 and newer read ',
          code('assets/minecraft/font/default.json'),
          ': a list of providers, where a pack’s come before the game’s own. The pack lists only the characters you drew (in ',
          code('bitmap'),
          ' sheets), so every other character still comes from the game. A TrueType font can be added as a ',
          code('ttf'),
          ' provider, and Java 1.19+ also takes a ',
          code('space'),
          ' provider for the width of the space. Java 1.6.1 to 1.12.2 read a single 16 × 16 grid, ',
          code('assets/minecraft/textures/font/ascii.png'),
          ', with every character 8 pixels tall. Bedrock reads ',
          code('font/default8.png'),
          ' (the same grid) and ',
          code('font/glyph_XX.png'),
          ' pages of 256 characters each.',
        ),
      ),
    ],
    faq: [
      {
        id: 'versions',
        q: 'Which versions does it work with?',
        a: [
          el(
            'p',
            null,
            'Every Java version from 1.6.1 to 26.3 and Bedrock. Pick your version and the pack gets the files that version reads: ',
            code('font/default.json'),
            ' for 1.13 and newer, ',
            code('textures/font/ascii.png'),
            ' before. ',
            link('/guides/minecraft-pack-format-versions', 'Pack formats of every version'),
            '.',
          ),
        ],
      },
      {
        id: 'ttf',
        q: 'Can I use a TTF or OTF font?',
        a: [
          el(
            'p',
            null,
            'Yes. Drop the font file and it is turned into pixels at the size and threshold you choose, then you can touch up any letter. For Java 1.13 and newer you can also put a TrueType ',
            code('.ttf'),
            ' file in the pack itself, so the game draws it smooth. Minecraft can’t load OpenType (CFF) or WOFF2 files, so those are always turned into pixels. Only use fonts whose licence allows it.',
          ),
        ],
      },
      {
        id: 'bedrock',
        q: 'Does it work on Bedrock?',
        a: [
          el(
            'p',
            null,
            'Yes. Choose Bedrock and open the ',
            code('.mcpack'),
            ', then turn it on under ',
            strong('Settings › Global Resources'),
            '. If the letters don’t change, restart the game and check that the chat font in the chat settings is Mojangles. Bedrock draws every character 8 pixels tall, so accents on capitals are squeezed.',
          ),
        ],
      },
      {
        id: 'languages',
        q: 'What about Cyrillic, accents or Japanese?',
        a: [
          el(
            'p',
            null,
            'Accented Latin letters and Cyrillic are in the starter styles and have their own lists to edit. Japanese kana can be drawn or taken from a Japanese font file. Kanji and other scripts keep the game’s own font (GNU Unifont), as do all characters you leave empty.',
          ),
        ],
      },
      {
        id: 'normal',
        q: 'Why does my text still look normal?',
        a: [
          el(
            'p',
            null,
            'Check that ',
            strong('Force Unicode Font'),
            ' (Options › Language) is off: with it on, Java uses its Unicode font instead. Then move your pack above any other pack that changes the font, and make sure you picked the version you play. ',
            link('/guides/texture-pack-not-working', 'More fixes'),
            '.',
          ),
        ],
      },
      {
        id: 'edit',
        q: 'Can I edit a font pack I already have?',
        a: [el('p', null, 'Yes. Open its ', code('.zip'), ' or ', code('.mcpack'), ' under Open a pack: its bitmap sheets are read back into characters you can edit, and a TrueType file in it is kept.')],
      },
      {
        id: 'upload',
        q: 'Is my font uploaded?',
        a: [el('p', null, 'No. Drawing, reading font files and building the pack all happen in your browser. Only the game’s font, when you ask for it, is downloaded from Mojang.')],
      },
    ],
    guides: ['install-resource-packs', 'make-a-texture-pack', 'texture-pack-not-working'],
    cta: 'Make a font',
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
    guides: ['make-a-bedrock-skin-pack', 'make-a-skin', 'install-resource-packs', 'java-vs-bedrock-packs'],
    cta: 'Start a skin pack',
  },
  cape: {
    tool: 'cape',
    base: 'skins',
    accent: 'accent-blue',
    icon: 'bookmark',
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
export function toolIntro(tool: IntroTool, opts: { prerender: boolean; locale?: Locale }): ElNode {
  const t = toolIntroIn(tool, opts.locale ?? 'en');
  const u = ui(t.locale);
  const meta = pageMeta(TOOL_META[tool].path, t.locale) ?? TOOL_META[tool];
  const H = opts.prerender ? 'h1' : 'h2';
  const sub = opts.prerender ? 'h2' : 'h3';
  return el(
    'section',
    { class: ['tool-intro', 'container', t.accent, opts.prerender ? null : 'is-below'], 'aria-labelledby': `intro-${tool}-title`, 'data-tool-intro': tool },
    breadcrumbs([{ label: u.home, to: '/' }, { label: meta.label }], u.breadcrumb),
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
            el('p', { class: 'tool-intro-noscript' }, u.toolIntro.noscript),
          )
        : null,
    ),
    el(
      'div',
      { class: 'tool-intro-grid' },
      el(
        'div',
        { class: 'tool-intro-card' },
        el(sub, null, u.toolIntro.whatYouCanDo),
        el(
          'ul',
          { class: 'tool-intro-list' },
          t.features.map((f) => el('li', null, ic('check'), el('span', null, f))),
        ),
      ),
      el('div', { class: 'tool-intro-card' }, el(sub, null, t.howTitle), steps(t.steps)),
    ),
    t.extra ? t.extra(sub) : null,
    el('div', { class: 'tool-intro-faq' }, el(sub, null, u.toolIntro.questions), el('div', { class: 'tool-intro-card flush' }, faqList(t.faq, { idPrefix: `${tool}-faq` }))),
    el('div', { class: 'tool-intro-guides' }, el(sub, null, u.toolIntro.guides), guideCards(t.guides, opts.prerender ? 'h3' : 'h4', 2, t.locale)),
    t.related?.length
      ? el('div', { class: 'tool-intro-guides tool-intro-related' }, el(sub, null, u.toolIntro.related), relatedTools(t.related, opts.prerender ? 'h3' : 'h4', t.locale))
      : null,
  );
}

/** Cards for other tools (route paths), named and described by their page meta in the language. */
function relatedTools(paths: string[], headingTag: string, locale: Locale): ElNode {
  const cards = paths.map((path) => {
    const meta = pageMeta(path, locale) ?? pageMeta(path, 'en');
    const intro = Object.values(TOOL_INTROS).find((x) => TOOL_META[x.tool].path === path);
    if (!meta) return null;
    return el(
      'a',
      { class: ['guide-card', intro?.accent ?? 'accent-green'], to: path },
      el('span', { class: 'guide-card-icon' }, ic(intro?.icon ?? 'tools')),
      el('span', { class: 'guide-card-text' }, el(headingTag, { class: 'guide-card-title' }, meta.label), el('span', { class: 'guide-card-desc' }, meta.description)),
      ic('arrow-right', { class: 'guide-card-go' }),
    );
  });
  return el('div', { class: ['guide-grid', 'cols-2'] }, cards.filter((c): c is ElNode => !!c));
}
