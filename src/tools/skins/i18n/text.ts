// English text of the skin start screen (ui/start.ts: new skin cards and starters, arm style and
// size, uploads, username import, the default skins dialog, your saved skins). The editor has its
// own sections (./editor.ts, ./export.ts), so this screen doesn't carry their text.
// Translations: ./<lang>.ts, loaded by ./load.ts.

import { defineText } from '../../../i18n/editor-text';

export const t = defineText('skins', {
  hero: {
    eyebrow: 'Skin Maker',
    title: 'Design your own skin',
    lead: 'Paint on the skin template or right onto the 3D model, and watch your character come to life. Export for Java or Bedrock when you are done.',
  },
  /** Name of a new skin project (also used when the name field is left empty) */
  defaultName: 'My skin',
  untitled: 'Untitled',
  pick: {
    armStyle: 'Arm style',
    armStyleLabel: 'Arm style for new skins',
    classic: 'Classic · 4px',
    slim: 'Slim · 3px',
    size: 'Size',
    sizeLabel: 'Size for new skins',
    hd: 'HD 128×128',
    /** The note under Size; the strong part comes first */
    hdStrong: 'HD skin, Bedrock only: ',
    hdText: 'twice the detail. Java exports are reduced to 64×64.',
    standardStrong: 'Standard size: ',
    standardText: 'works in Java and Bedrock.',
    /** Toast when a 64x64 skin is opened while HD is picked */
    doubled: 'Doubled to an HD 128×128 skin, as picked under Size. It looks the same until you paint finer detail.',
  },
  start: {
    title: 'Start a new skin',
    text: 'Pick a starting point. You can change everything.',
    createFailed: 'Could not create the skin.',
  },
  /** Starter cards. Names of characters are translated like other words. */
  starters: {
    blank: { name: 'Blank', description: 'A plain mannequin to paint from scratch.' },
    template: { name: 'Template', description: 'Every body part in its own colour, with each face labelled.', badge: 'Start here' },
    explorer: { name: 'Explorer', description: 'Safari hat, vest, backpack and boots.' },
    knight: { name: 'Knight', description: 'Helmet with plume, tabard and chainmail.' },
    robot: { name: 'Robot', description: 'Metal panels, glowing eyes and chest lights.' },
    hoodie: { name: 'Creeper Hoodie', description: 'A green hoodie with the hood up.' },
    ninja: { name: 'Ninja', description: 'Dark suit, red headband and wrapped arms.' },
    wizard: { name: 'Wizard', description: 'Starry robe, long beard and a gold-banded hat.' },
  },
  bring: {
    title: 'Bring a skin',
    text: 'Open an existing skin and make it yours.',
    uploadTitle: 'Upload a PNG',
    uploadText: 'Keep editing a skin you already have.',
    drop: 'Drop a skin PNG here or click to browse',
    dropHint: '64×64 or HD 128×128 skins, or old 64×32 ones (converted for you).',
    uploadedName: 'Uploaded skin',
    uploadFailed: 'That file could not be opened as a skin.',
    userTitle: 'Import by username',
    userText: "Grab any Java player's current skin.",
    placeholder: 'e.g. Notch',
    usernameLabel: 'Minecraft Java username',
    import: 'Import',
    try: 'Try',
    userNote: 'Java Edition names only. Bedrock gamertags can’t be looked up.',
    /** Name of a skin imported by username */
    playerSkin: "{name}'s skin",
    lookupFailed: "Couldn't load that skin. Check your connection and try again.",
    gameTitle: 'Steve, Alex & friends',
    gameText: 'The nine default skins from the Minecraft {version} game files, in classic or slim.',
    gameNote: 'Downloaded once from Mojang’s servers (about 6 MB), then kept on this device.',
    chooseDefault: 'Choose a default skin',
    totemTitle: 'Make a custom totem',
    totemText: 'Turn any skin into a Totem of Undying resource pack for Java or Bedrock',
  },
  defaults: {
    title: 'Default skins from Minecraft',
    intro: 'Start from one of the nine default characters in Minecraft Java {version}. They come straight from the official game files.',
    none: "These game files don't contain the default skins.",
    /** A default skin's button: "Steve (classic arms)" */
    skinArms: '{name} ({model, select, slim {slim arms} other {classic arms}})',
    armStyle: 'Arm style',
    classic: 'Classic arms',
    slim: 'Slim arms',
    checking: 'Checking game files…',
    downloadFailed: 'Could not download the game files.',
    openFailed: 'Could not open that skin.',
  },
  recent: {
    title: 'Your skins',
    text: 'Saved in this browser. Export them to keep a copy.',
    classic: 'Classic',
    slim: 'Slim',
    moreActions: 'More actions for {name}',
    open: 'Open',
    rename: 'Rename',
    duplicate: 'Duplicate',
    delete: 'Delete',
    renameTitle: 'Rename skin',
    name: 'Name',
    /** Name of a duplicated skin */
    copyName: '{name} copy',
    copied: 'Made a copy of "{name}"',
    deleteTitle: 'Delete this skin?',
    deleteText: '"{name}" will be removed from this browser. Export it first if you want to keep a copy.',
    deleted: 'Skin deleted',
  },
});

export type SkinsText = typeof t;
