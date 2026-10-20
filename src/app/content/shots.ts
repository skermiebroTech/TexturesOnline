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
} satisfies Record<string, Shot>;

export type ShotKey = keyof typeof SHOTS;

/** A translation's alt text and caption for every screenshot. */
export type ShotTexts = Record<ShotKey, { alt: string; caption: string }>;

/** The screenshots with a translation's alt texts and captions. */
export function localShots(texts: ShotTexts): Record<ShotKey, Shot> {
  return Object.fromEntries((Object.keys(SHOTS) as ShotKey[]).map((k) => [k, { ...SHOTS[k], ...texts[k] }])) as Record<ShotKey, Shot>;
}
