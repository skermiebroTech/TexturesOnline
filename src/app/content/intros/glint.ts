// The enchantment glint maker's introduction in English, loaded on its own pages only (see ToolIntro
// in src/app/content/tools.ts).

import { el } from '../../markup';
import { code, link, strong } from '../blocks';
import type { ToolIntroBody } from '../tools';

export const INTRO: ToolIntroBody = {
  base: 'textures',
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
};
