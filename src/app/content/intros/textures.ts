// The texture pack editor's introduction in English, loaded on its own pages only (see ToolIntro
// in src/app/content/tools.ts).

import { el } from '../../markup';
import { code, figure, link, strong } from '../blocks';
import { SHOTS } from '../shots';
import { KNOWN_RELEASE_FORMATS, formatPackFormat } from '../../../editions/java/packformats';
import { F, LATEST } from '../facts';
import type { ToolIntroBody } from '../tools';

const f263 = formatPackFormat(KNOWN_RELEASE_FORMATS['26.3']);

export const INTRO: ToolIntroBody = {
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
      a: [el('p', null, 'Yes, for textures. Java Edition renamed texture packs to resource packs in 1.6.1, because they can also change models, sounds, fonts and shaders, so this texture pack editor is a resource pack maker too: it makes the texture part and writes the files every resource pack needs.')],
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
  // What the editor is, which versions it covers and how to start: prose for readers and search
  // engines, between the feature lists and the questions (also below the start screen).
  extra: (sub) => [
    el(
      'div',
      { class: 'tool-intro-card' },
      el(sub, null, 'What the texture editor does'),
      el('p', null, 'A texture pack (Java calls it a resource pack) swaps the pictures Minecraft draws: blocks, items, mobs, armour, particles, the sky and the interface. The editor downloads the real textures of the version you pick from Mojang’s servers, so you start from exactly what the game shows, and the pack it exports holds only the files you changed, at the paths and in the format that version reads.'),
      el('p', null, 'It all runs in your browser. Your pack is saved on this device as you work, nothing is uploaded, and the download is an ordinary pack: install it, share it, open it here again later or keep working on it in any other image editor.'),
      el('p', null, 'New to texture packs? ', link('/guides/make-a-texture-pack', 'How to make a texture pack'), ' walks you through a first pack, and ', link('/guides/texture-pack-not-working', 'the fixes for packs that do not load'), ' explain every error message.'),
    ),
    el(
      'div',
      { class: 'tool-intro-grid' },
      el(
        'div',
        { class: 'tool-intro-card' },
        el(sub, null, 'Versions and editions'),
        el('ul', { class: 'guide-list' }, [
          el('li', null, strong('Java Edition'), `: every release from 1.6.1 to ${LATEST}, plus snapshots if you switch them on. The pack gets the pack format of your version (${F(LATEST)} for ${LATEST}) and, if you like, a range of versions it works on.`),
          el('li', null, strong('Bedrock Edition'), ': the latest release, the latest preview and older versions. The pack is an ', code('.mcpack'), ' that Minecraft imports when you open it.'),
          el('li', null, 'Any resolution from 16× (the vanilla look) to 512×.'),
          el('li', null, 'A pack for the other edition? The ', link('/texture-pack-converter', 'texture pack converter'), ' turns Java packs into Bedrock packs and back.'),
        ]),
      ),
      el(
        'div',
        { class: 'tool-intro-card' },
        el(sub, null, 'Ways to start'),
        el('ul', { class: 'guide-list' }, [
          el('li', null, strong('A new pack'), ': name it, pick the edition, version and resolution, and choose ', strong('Create pack'), '. Then search for a texture or browse the blocks, items and mobs.'),
          el('li', null, strong('A PvP pack'), ': start from low fire, clear glass, smaller swords and a custom crosshair, with an FPS option. ', link('/guides/make-a-pvp-texture-pack', 'PvP pack guide'), '.'),
          el('li', null, strong('A pack you have'), ': choose ', strong('Open a pack'), ' and drop in a ', code('.zip'), ' or ', code('.mcpack'), '. The edition and version are read from the pack.'),
          el('li', null, strong('One part of the game'), ': the ', link('/painting-maker', 'painting maker'), ', ', link('/gui-maker', 'GUI maker'), ', ', link('/music-disc-maker', 'music disc maker'), ' and ', link('/enchantment-glint-maker', 'glint maker'), ' open a new pack right on it.'),
        ]),
      ),
    ),
    el('div', { class: 'tool-intro-grid' }, figure(SHOTS.paint3d), figure(SHOTS.mobGear)),
    el('div', { class: 'tool-intro-grid' }, figure(SHOTS.editor), figure(SHOTS.effects)),
  ],
  guides: ['make-a-texture-pack', 'make-3d-items-texture-pack', 'make-a-pvp-texture-pack', 'make-a-pbr-texture-pack', 'rename-items-texture-pack', 'make-animated-textures', 'texture-pack-not-working', 'install-resource-packs', 'java-vs-bedrock-packs', 'minecraft-pack-format-versions'],
  related: ['/painting-maker', '/gui-maker', '/music-disc-maker', '/enchantment-glint-maker'],
  cta: 'Start a texture pack',
};
