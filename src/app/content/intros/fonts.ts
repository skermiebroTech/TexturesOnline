// The font maker's introduction in English, loaded on its own pages only (see ToolIntro
// in src/app/content/tools.ts).

import { el } from '../../markup';
import { code, link, strong } from '../blocks';
import type { ToolIntroBody } from '../tools';

export const INTRO: ToolIntroBody = {
  base: 'fonts',
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
};
