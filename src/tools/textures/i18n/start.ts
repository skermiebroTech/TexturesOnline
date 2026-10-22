// English text of the Texture Pack Maker's start screen (ui/start-screen.ts) and of the small pieces
// the start screen and the editor share: version badges, texture categories (ui/meta.ts), the
// resolution sentence (ui/resolution.ts) and project errors (project.ts). Translations:
// ./<lang>.ts, loaded by ./load.ts. The editor's own text is in ../ui/i18n/.

import { defineText } from '../../../i18n/editor-text';

export const t = defineText('textures', {
  /** Badge and subtitle of a pack's game version */
  version: {
    /** "Bedrock latest": the newest Bedrock release */
    bedrockLatest: 'Bedrock latest',
    bedrockPreview: 'Bedrock preview',
    bedrock: 'Bedrock {version}',
  },
  hero: {
    eyebrow: 'Texture Pack Maker',
    /** {your} is the highlighted word below */
    title: 'Make Minecraft look {your} way',
    your: 'your',
    lead: 'Repaint any block, item or mob, upload your own pictures, or restyle everything with one click. Works for Java and Bedrock.',
    /** Followed by the bold link text "Convert it" */
    otherEdition: 'Pack for the other edition? ',
    convertIt: 'Convert it',
    /** Captions of the sample blocks (names of effect styles) */
    original: 'Original',
  },
  create: {
    title: 'New texture pack',
    text: 'Start from the vanilla textures and make them yours.',
    name: 'Pack name',
    namePlaceholder: 'My Awesome Pack',
    edition: 'Edition',
    javaHint: 'For Minecraft on Windows, Mac and Linux computers.',
    bedrockHint: 'For phones, tablets, consoles and Windows (the version with Marketplace).',
    gameVersion: 'Game version',
    resolution: 'Resolution',
    description: 'Description (optional)',
    descriptionPlaceholder: 'Made with Texture Pack Maker',
    button: 'Create pack',
    /** Name of a new pack when the name field is empty */
    defaultName: 'My Texture Pack',
    startWith: 'Start with',
    blank: 'Vanilla textures',
    blankHint: 'Every texture as it is in the game',
    pvp: 'PvP / FPS pack',
    pvpHint: 'Low fire, clear glass, a clean crosshair, smaller swords',
    fps: 'Also an FPS pack',
    fpsHint: '8 × 8 block textures and no animations (Java), for weaker computers.',
    pvpButton: 'Create PvP pack',
    /** Name of a new PvP pack when the name field is empty */
    pvpName: 'My PvP Pack',
    failed: "Couldn't create the pack",
  },
  open: {
    title: 'Open a pack',
    text: 'Keep editing a pack you made here or anywhere else.',
    opening: 'Opening pack…',
    drop: 'Drop a pack here or click to browse',
    /** drop on touch screens */
    dropTouch: 'Tap to choose a pack',
    dropHint: '.zip for Java · .mcpack or .mcaddon for Bedrock',
    convert: 'Convert a pack',
    convertHint: 'Java to Bedrock, Bedrock to Java, or another Java version',
    merge: 'Merge packs',
    mergeHint: 'Combine several packs into one, top pack first',
    openedTitle: 'Pack opened',
    /** {version} is "Java 1.21.11" or "Bedrock latest" */
    openedText: '“{name}” is ready to edit ({version}, {count, plural, one {# texture} other {# textures}}). A few things to know:',
    openInEditor: 'Open in editor',
    opened: 'Opened “{name}”',
  },
  howto: {
    title: 'How it works',
    pick: 'Pick',
    pickText: 'Browse every vanilla texture — blocks, items, mobs, GUI and more.',
    paint: 'Paint',
    paintText: 'Draw pixels, upload pictures or add one-click effects to everything.',
    export: 'Export',
    exportText: 'Get a ready-to-install pack for Java or Bedrock.',
  },
  recent: {
    title: 'Your texture packs',
    savedHere: 'Saved in this browser only',
    emptyTitle: 'No packs yet',
    emptyText: 'Packs you create or open show up here, so you can pick up where you left off.',
    moreActions: 'More actions for {name}',
    open: 'Open',
    rename: 'Rename',
    duplicate: 'Duplicate',
    delete: 'Delete',
    untitled: 'Untitled',
    edited: '{count} edited',
    effects: '{count, plural, one {# effect} other {# effects}}',
    /** {time} is "5 min ago", "yesterday"… */
    editedAgo: 'Edited {time}',
    renameTitle: 'Rename pack',
    renamed: 'Pack renamed',
    renameFailed: "Couldn't rename the pack",
    /** Name of a copy: "My pack (copy)" */
    copyName: '{name} (copy)',
    copied: 'Made a copy of “{name}”',
    copyFailed: "Couldn't copy the pack",
    deleteTitle: 'Delete this pack?',
    deleteText: '“{name}” will be removed from this browser.',
    deleted: 'Deleted “{name}”',
    undo: 'Undo',
    restoreFailed: "Couldn't restore the pack.",
    deleteFailed: "Couldn't delete the pack.",
  },
  /** Texture categories: label in lists, short in the texture header */
  categories: {
    block: { label: 'Blocks', short: 'Block' },
    item: { label: 'Items', short: 'Item' },
    entity: { label: 'Mobs', short: 'Mob' },
    armor: { label: 'Armor', short: 'Armor' },
    gui: { label: 'GUI', short: 'GUI' },
    particle: { label: 'Particles', short: 'Particle' },
    environment: { label: 'Sky', short: 'Sky' },
    painting: { label: 'Paintings', short: 'Painting' },
    effect: { label: 'Effects', short: 'Effect icon' },
    font: { label: 'Fonts', short: 'Font' },
    map: { label: 'Maps', short: 'Map' },
    colormap: { label: 'Colour maps', short: 'Colour map' },
    misc: { label: 'Misc', short: 'Misc' },
    other: { label: 'Other', short: 'Other' },
  },
  resolution: {
    classic: '16× is the classic Minecraft look: every block face is 16×16 pixels, just like the original game.',
    /** {detail} is one of the "times" texts below */
    hd: '{r}× gives each block face {r}×{r} pixels — {detail} the detail. Textures are scaled up when you start editing them, so you can add finer details.',
    twice: 'twice',
    times: '{n} times',
  },
});

export type TexturesText = typeof t;
