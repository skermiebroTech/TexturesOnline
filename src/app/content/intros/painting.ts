// The painting maker's introduction in English, loaded on its own pages only (see ToolIntro
// in src/app/content/tools.ts).

import { el } from '../../markup';
import { code, link, strong } from '../blocks';
import type { ToolIntroBody } from '../tools';

export const INTRO: ToolIntroBody = {
  base: 'textures',
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
};
