// Screenshots of the app used on the guides and tool pages (public/screenshots/guides/, made by
// tests/harness/seo/guide-screenshots.cjs). Alt text says exactly what each image shows.

import type { Shot } from './blocks';

const shot = (name: string, width: number, height: number, alt: string, caption: string): Shot => ({
  src: `/screenshots/guides/${name}.jpg`,
  width,
  height,
  alt,
  caption,
});

export const SHOTS = {
  newPack: shot(
    'new-texture-pack',
    1280,
    853,
    'The New texture pack form filled in: name My First Pack, Java edition, version Java 26.3 (pack format 97.1), 32× resolution and a description, next to the Open a pack drop zone.',
    'Name the pack, then pick the edition, game version and resolution.',
  ),
  editor: shot(
    'texture-editor',
    1280,
    800,
    'The texture editor with the furnace front open in the 16×16 pixel editor, orange strokes around the fire opening, and the same paint shown on the furnace’s 3D in-game model in the preview panel.',
    'Painting the furnace front: the 3D preview shows the change on the real block model.',
  ),
  effects: shot(
    'texture-effects',
    1280,
    800,
    'The Effects tab with the Autumn preset applied: before and after strips of re-coloured textures, and moss blocks in the block list turned orange-brown.',
    'One-click effects such as Autumn restyle every texture at once.',
  ),
  packSettings: shot(
    'pack-settings',
    1280,
    800,
    'The Pack tab’s game version card: the pack is made for Java 26.3 (pack format 97.1) and also works from Java 1.21 (pack format 34) to 26.3.',
    'A compatibility range lets one pack load on several Java versions.',
  ),
  export: shot(
    'texture-export',
    960,
    600,
    'The Export your pack dialog for My First Pack.zip: one edited texture, the Autumn effects, made for Java 26.3 with pack format 97.1, works in 1.21 to 26.3, and an Export .zip button.',
    'The export dialog sums up what goes into the pack before you download it.',
  ),
  openPack: shot(
    'open-existing-pack',
    1280,
    800,
    'An existing pack opened from a .zip: the Edited filter lists its three changed textures, its blue-tinted stone texture is in the pixel editor and on a 3D stone block in the preview.',
    'Opening an existing .zip: the pack’s changed textures are listed and ready to edit.',
  ),
  skin2d: shot(
    'skin-editor-2d',
    1280,
    800,
    'The skin editor on the 64×64 template with labelled body-part areas and mirror painting on, blue and yellow strokes on the chest and arms, and the 3D preview of the skin on the right.',
    'Painting on the 64×64 template with mirroring, while the 3D model updates.',
  ),
  skin3d: shot(
    'skin-editor-3d',
    1280,
    800,
    'The skin editor in 3D paint mode: the model is turned slightly, its left arm is hidden with the body-part figure, and red paint is on the chest.',
    'Painting straight onto the 3D model, with one arm hidden to reach the body.',
  ),
  skinPack: shot(
    'skin-pack-export',
    1078,
    674,
    'The Make a skin pack dialog: pack name Adventure Crew with three skins included, Wizard (classic arms, this skin), Robot (slim arms) and Explorer (classic arms), and a Download pack button.',
    'Bundling three skins, classic and slim, into one Bedrock skin pack.',
  ),
  shaderVanilla: shot(
    'shader-vanilla',
    1280,
    800,
    'The Shader Maker for Vanilla Java with colour and tone sliders (brightness, contrast and saturation) next to a live 3D preview of a grass island.',
    'A vanilla Java shader pack: colour sliders with a live preview, no mods needed.',
  ),
  shaderIris: shot(
    'shader-iris',
    1280,
    800,
    'The Shader Maker for Iris and OptiFine at sunset: the preview shows warm low light and long shadows, with presets and a sunlight strength slider.',
    'An Iris / OptiFine shader pack with real shadows, previewed at sunset.',
  ),
  vibrantVisuals: shot(
    'bedrock-vibrant-visuals',
    1280,
    800,
    'The Shader Maker for Bedrock Vibrant Visuals: a bright preview with a blue sky, presets and a sun brightness slider, and badges saying no mods are needed.',
    'Making a Vibrant Visuals pack for Bedrock, with a live preview.',
  ),
  paint3d: shot(
    'texture-3d-paint',
    1280,
    800,
    'The texture editor in 3D mode: a furnace model fills the stage with red strokes painted straight onto its front face, and the flat furnace front texture with the same strokes in the side panel.',
    'Painting straight onto the 3D furnace: each face paints the texture it shows.',
  ),
  mobGear: shot(
    'mob-gear',
    1280,
    733,
    'A horse model in the texture editor wearing a saddle and leather horse armour, with the Coat, Markings, Age, Saddle and Armour choices in the side panel.',
    'Mobs show on their own 3D models, with saddles and armour you can paint too.',
  ),
  mobParts: shot(
    'mob-parts',
    1280,
    800,
    'A zombie wearing iron armour with its chestplate hidden in the Parts list, so its shirt can be painted in 3D.',
    'Hide a part, here the chestplate, to paint what it covers.',
  ),
  convertPack: shot(
    'converter-pack',
    1280,
    800,
    'The Texture Pack Converter with a Java 26.2 pack chosen (6 textures) and Bedrock Edition picked as the target, with a Convert to Bedrock button.',
    'Choose a pack and what to convert it to.',
  ),
  convertResult: shot(
    'converter-result',
    1280,
    800,
    'The converter result: 4 of 6 textures converted from Java 26.2 to Bedrock, with Download .mcpack and Open in editor buttons and lists of skipped textures and their reasons.',
    'The report shows what was converted and why anything was skipped.',
  ),
  mergeSettings: shot(
    'merge-settings',
    1280,
    1016,
    'Merge Texture Packs with three packs in priority order (Top Pack, Extras and a Java 1.12.2 pack), the merged pack name, icon choice and Java 26.3 as the target version.',
    'Put the packs in order; the top pack wins every conflict.',
  ),
  mergeResult: shot(
    'merge-result',
    1280,
    800,
    'The merge result: 3 packs merged into one, with a bar per pack showing files used, merged and not used, and the list of conflicts.',
    'The result shows how much of each pack made it in, and every conflict.',
  ),
  modelEditShape: shot(
    'model-edit-shape',
    1280,
    800,
    'The texture editor with the Diamond Sword picked in the Items list: its 16×16 sprite in the pixel editor and, in the Preview tab, the flat sword with an Edit shape button under it.',
    'Show an item in the Preview tab and press Edit shape to open the model editor.',
  ),
  modelSpriteStart: shot(
    'model-sprite-start',
    1280,
    800,
    'The model editor opened on the Diamond Sword, a flat sprite with no cubes: start points 3D item from sprite, Full cube, Slab, Cross (plant) and Empty, in the 3D view and in the Model tab.',
    'A flat item starts with no cubes: pick 3D item from sprite.',
  ),
  model3dSword: shot(
    'model-3d-sword',
    1280,
    800,
    'The diamond sword as a 3D model of 19 cubes, one pixel deep. Cube 5 is selected in the cube list and shown with move arrows in the 3D view, with its position (9, 11, 7.5) and size (5 × 1 × 1) in the Cube tab.',
    'The sprite becomes 19 cubes. Pick one to move it, resize it or change its faces.',
  ),
  modelDisplay: shot(
    'model-display',
    1280,
    800,
    'The Display tab with Third person picked: the 3D diamond sword held by a player model, and the right-hand rotation (0, -90, 55), position (0, 4, 0.5) and size (0.85) fields.',
    'Display sets how the model is held, worn and shown, each with a preview.',
  ),
  modelFlatInventory: shot(
    'model-flat-inventory',
    1280,
    800,
    'The Model tab with Flat in the inventory switched on, which keeps the flat icon in the inventory, on the ground and in item frames. The header now says item/diamond_sword_3d.json.',
    'Flat in the inventory (1.21.4+) saves the 3D shape as a second model for the hand.',
  ),
  modelBlock: shot(
    'model-block-shape',
    1280,
    800,
    'The stone block’s model reshaped into a step: a 16×8×16 slab cube and a second cube, 16×8×8, placed on top of half of it, with the Cube tab showing its position and size.',
    'Stone reshaped into a step: the Slab start point plus one more cube.',
  ),
  pvpStart: shot(
    'pvp-start',
    1280,
    800,
    'The New texture pack form with PvP / FPS pack chosen under Start with, Also an FPS pack switched on, Java edition and version Java 1.8.9, and the button Create PvP pack.',
    'Pick PvP / FPS pack and the version you play.',
  ),
  pvpTweaks: shot(
    'pvp-tweaks',
    1280,
    800,
    'The texture editor for a Java 1.8.9 PvP pack: fire_layer_1 open in the pixel editor with the flames moved down to the lower half of the frame, and the PvP tab with Low fire switched on, its height set to Lower and Keep fire blocks as they are on.',
    'The PvP tab: every tweak is a switch, with its choices and the files it changes.',
  ),
  pvpCrosshair: shot(
    'pvp-crosshair',
    1280,
    800,
    'icons.png zoomed in, its top-left 16×16 crosshair square selected with a grey diamond crosshair painted in it, next to the hearts and armour icons, and the Custom crosshair card with five designs and a Draw your own button.',
    'Draw your own: up to Java 1.20.1 the crosshair is the top-left corner of icons.png.',
  ),
  pvpBedrock: shot(
    'pvp-bedrock',
    1280,
    800,
    'A Bedrock PvP pack: the red stained glass texture open, clear inside with its border kept, and the PvP tab with Low fire switched off and the reason Bedrock can’t have it, above Clear glass switched on.',
    'On Bedrock the tweaks a pack can’t make are switched off, with the reason.',
  ),
} satisfies Record<string, Shot>;

export type ShotKey = keyof typeof SHOTS;

/** A translation's alt text and caption for every screenshot. */
export type ShotTexts = Record<ShotKey, { alt: string; caption: string }>;

/** The screenshots with a translation's alt texts and captions. */
export function localShots(texts: ShotTexts): Record<ShotKey, Shot> {
  return Object.fromEntries((Object.keys(SHOTS) as ShotKey[]).map((k) => [k, { ...SHOTS[k], ...texts[k] }])) as Record<ShotKey, Shot>;
}
