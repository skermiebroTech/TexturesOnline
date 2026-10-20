// English text of the Shader Maker's start screen and of what every shader page shares: the three
// targets (cards, install steps, build steps), the "New pack" dialog, the "Open a shader pack" card
// and the recent projects. Translations: ./<lang>.ts, loaded by ./load.ts (the view awaits it on
// every shader page). The editors have their own folders (../ui/i18n, ../packedit/i18n).
// Product names (Iris, OptiFine, Sodium, Vibrant Visuals) and file names stay as they are; in-game
// menu paths use the game's own names in each language.

import { defineText } from '../../../i18n/editor-text';

export const t = defineText('shaders', {
  hero: {
    eyebrow: 'Shader Maker',
    /** "Give Minecraft a whole new {look}", {look} is highlighted */
    title: 'Give Minecraft a whole new {look}',
    look: 'look',
    lead: 'Choose where you play, pick a preset, move a few sliders and watch the live preview. Then export a pack that’s ready to drop into the game.',
  },
  chooser: {
    title: 'Not sure which one?',
    javaMods: 'Java with mods',
    javaNoMods: 'Java, no mods',
  },
  card: {
    needsMod: 'Needs a mod',
    noMods: 'No mods',
    start: 'Start',
    /** aria-label of a card's Start button; {name} is the target's name */
    startLabel: 'Start a {name}',
    gets: 'What you get',
    limits: 'Good to know',
    installGuide: 'Install guide',
  },
  recent: {
    eyebrow: 'Your shader projects',
    title: 'Continue where you left off',
    /** "Edited 5 min ago" ({when} comes from the kit's time words) */
    edited: 'Edited {when}',
    /** Imported pack: "120 files · Edited 5 min ago" */
    files: '{count} files · {when}',
    imported: 'Imported',
    more: 'More actions for {name}',
    open: 'Open',
    rename: 'Rename',
    duplicate: 'Duplicate',
    delete: 'Delete',
    renameTitle: 'Rename pack',
    packName: 'Pack name',
    renamed: 'Pack renamed',
    renameFailed: "Couldn't rename the pack",
    copied: 'Made a copy of “{name}”',
    copyFailed: "Couldn't copy the pack",
    deleteTitle: 'Delete this pack?',
    deleteText: '“{name}” will be removed from this browser. Packs you already exported are not affected.',
    deleted: 'Deleted “{name}”',
    undo: 'Undo',
    restoreFailed: "Couldn't restore the pack.",
    deleteFailed: "Couldn't delete the pack.",
    /** Name of a duplicated project */
    copyName: '{name} (copy)',
  },
  /** Imported packs on the start screen */
  kinds: {
    javaPack: 'Java pack',
    bedrockPack: 'Bedrock pack',
  },
  newPack: {
    /** Dialog title: "New Iris / OptiFine pack" */
    title: 'New {target} pack',
    name: 'Pack name',
    loadingPresets: 'Loading presets…',
    version: 'Minecraft version',
    versionNote: 'Vanilla shaders only work in the exact version they were made for. You can change it later.',
    presets: 'Start from a preset',
    later: 'You can change everything later',
    startingPreset: 'Starting preset',
    create: 'Create pack',
    createFailed: "Couldn't create the project",
    /** Default project names (the user can change them) */
    defaultIris: 'My Shader Pack',
    defaultVanilla: 'My Vanilla Shaders',
    defaultBedrock: 'My Vibrant Visuals',
    /** Default description of a new project; {preset} is the preset's name */
    description: '{preset} shaders made with Texture Pack Maker',
    descriptionCustom: 'Custom shaders made with Texture Pack Maker',
  },
  /** Fallback name of a project without a name (also the export's file name) */
  myShaders: 'My shaders',
  openPack: {
    loadFailed: "The pack opener couldn't load. Check your connection and try again.",
    drop: 'Drop a pack here or click to choose',
    dropHint: '.zip or .mcpack · it stays on your device',
    irisKind: 'Iris / OptiFine shader packs',
    irisSub: 'Change their options with sliders',
    vanillaKind: 'Vanilla shader resource packs',
    vanillaSub: 'Edit the shader files',
    bedrockKind: 'Bedrock packs (.mcpack)',
    bedrockSub: 'Edit the JSON settings',
    eyebrow: 'Already have a pack?',
    title: 'Open a shader pack',
    text: 'Edit a pack you downloaded or made here before. Packs exported from the Shader Maker open with all their settings.',
    license: 'Packs by other people have their own licenses. Edited copies are for your own use unless the license allows sharing.',
    dropToOpen: 'Drop to open this pack',
    notPack: "“{name}” isn't a pack. Drop a .zip shader pack or a .mcpack file.",
  },
  targets: {
    iris: {
      name: 'Iris / OptiFine shader pack',
      shortName: 'Iris / OptiFine',
      tagline: 'The full shader look: real shadows, waving plants, shiny water, bloom and god rays.',
      bestFor: 'Java players who use (or can install) the Iris or OptiFine mod.',
      gets: {
        shadows: 'Real sun and moon shadows',
        waving: 'Waving leaves, grass and crops',
        water: 'Rippling, reflective water',
        bloom: 'Bloom, god rays and color grading',
        menu: 'An in-game settings menu to fine-tune it',
      },
      limits: {
        mod: 'Needs the free Iris mod (recommended) or OptiFine',
        versions: 'Iris: Java 1.16.5 to 26.3. OptiFine: up to 26.2',
        power: 'Uses more graphics power than the no-mod options',
      },
      install: {
        iris: 'Install Iris with the Iris Installer from irisshaders.dev, then play the Iris profile once.',
        folder: 'Open the shader pack folder and drop the .zip in (keep it zipped).',
        apply: 'Pick your pack and click Apply. Shader Pack Settings lets you fine-tune it in game.',
      },
      installPlace: 'Goes in .minecraft/shaderpacks',
      compareLabel: 'Without shaders',
    },
    vanilla: {
      name: 'Vanilla Java (no mods)',
      shortName: 'Vanilla Java',
      tagline: "A resource pack that tweaks Minecraft's own shaders. Works in the normal game.",
      bestFor: 'Java players who want a new look without installing anything.',
      gets: {
        color: 'Brightness, contrast, color and warmth',
        looks: 'Vignette, black & white, sepia and retro looks',
        bloom: 'Bloom glow (Java 26.3 and newer)',
        fog: 'Misty fog and darker nights',
        waving: 'Waving plants on some versions',
      },
      limits: {
        version: 'Made for one exact version: pick yours (26.3 by default)',
        shadows: 'No real shadows or reflections (those need Iris)',
        min: 'Needs Java 1.17 or newer',
      },
      install: {
        folder: 'Open the resource pack folder and drop the .zip in.',
        select: 'Move the pack to Selected and click Done. The new look applies right away.',
        update: 'Updated Minecraft? Pick the new version here and export again.',
      },
      installPlace: 'Goes in .minecraft/resourcepacks',
      compareLabel: 'Plain Minecraft',
    },
    bedrock: {
      name: 'Bedrock Vibrant Visuals',
      shortName: 'Vibrant Visuals',
      tagline: "Tune Bedrock's built-in Vibrant Visuals: sunlight, sky, fog, water and color.",
      bestFor: 'Bedrock players on Windows, Xbox, PlayStation or a recent phone or tablet.',
      gets: {
        sky: 'Sun, moon and sky colors',
        light: 'Lighting, shadows and colored block light',
        fog: 'Fog and atmosphere',
        water: 'Water color, waves and caustics',
        grading: 'Film-style color grading',
      },
      limits: {
        device: 'Needs a device that supports Vibrant Visuals',
        classic: 'Classic texture packs switch Vibrant Visuals off',
        code: "Bedrock doesn't allow custom shader code, so no waving plants",
      },
      install: {
        open: 'Open the .mcpack file. Minecraft imports it for you.',
        activate: 'Activate the pack for every world.',
        mode: 'Set Graphics Mode to Vibrant Visuals.',
      },
      installPlace: 'Open it and Minecraft imports it',
      compareLabel: 'Default Vibrant Visuals',
    },
  },
  /** In-game menu paths, shown as "A > B > C" (the game's own names in each language) */
  paths: {
    shaderFolder: { options: 'Options', video: 'Video Settings', packs: 'Shader Packs', open: 'Open Shader Pack Folder' },
    packFolder: { options: 'Options', packs: 'Resource Packs', open: 'Open Pack Folder' },
    globalPacks: { settings: 'Settings', global: 'Global Resources', mine: 'My Packs' },
    graphicsMode: { settings: 'Settings', video: 'Video', mode: 'Graphics Mode' },
  },
  installGuide: 'Full install guide',
  /** A generator that can't be loaded; {target} is "Iris / OptiFine", "Vanilla Java" or "Vibrant Visuals" */
  maker: {
    missing: "The {target} maker isn't part of this version of the site yet.",
    notReady: "The {target} maker isn't ready in this version of the site (missing {missing}). Please try again later.",
  },
});

export type ShadersText = typeof t;
