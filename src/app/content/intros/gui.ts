// The GUI maker's introduction in English, loaded on its own pages only (see ToolIntro
// in src/app/content/tools.ts).

import { el } from '../../markup';
import { code, link, strong } from '../blocks';
import type { ToolIntroBody } from '../tools';

export const INTRO: ToolIntroBody = {
  base: 'textures',
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
};
