// English text of the Skin Pack Maker (/skin-pack-maker: pack/builder.ts, and opening skin packs in
// pack/import.ts), plus the editor's way back to a pack and the export dialog's hand-off to it.
// Game menu names follow the game's own text in each language (Dressing Room, Classic Skins).
// Translations: ./<lang>.ts.

import { defineText } from '../../../i18n/editor-text';

export const packText = defineText('skins.pack', {
  hero: {
    eyebrow: 'Skin Pack Maker',
    title: 'Make your own skin pack',
    lead: 'Put your skins together in one Bedrock .mcpack: add saved skins, PNGs, starter skins or a player’s skin, give each one a name and an arm style, and download the pack. You can also open a skin pack you already have and change it.',
  },
  /** Name of a new pack (also written into the pack when the name is left empty) */
  defaultName: 'My skin pack',
  details: {
    label: 'Pack details',
    name: 'Pack name',
    nameHint: 'Shown in the Dressing Room under Classic Skins.',
    description: 'Description',
    descriptionHint: 'Optional, kept in the pack’s manifest.',
    icon: 'Pack icon',
    /** The icon button's accessible name */
    iconChange: 'Change the pack icon',
    /** Line under the icon */
    iconFace: 'The first skin’s face',
    iconCustom: 'Your picture',
    iconEmpty: 'Made from the first skin’s face',
    iconUpload: 'Upload a picture',
    iconUseFace: 'Use the first skin’s face',
    iconBad: 'The pack icon must be a PNG or JPEG picture.',
  },
  skins: {
    title: 'Skins in this pack',
    /** "3 skins" */
    count: '{count, plural, one {# skin} other {# skins}}',
    emptyTitle: 'No skins yet',
    emptyText: 'Drop skin PNGs here, or add skins with the buttons above. Each skin keeps its own name and arm style.',
    order: 'Drag a skin by its handle, or use the arrows, to change the order in the Dressing Room.',
  },
  add: {
    label: 'Add skins',
    upload: 'Upload PNGs',
    saved: 'Saved skins',
    starters: 'Starter skins',
    username: 'Player’s skin',
    /** Drop target over the skins while files are dragged in */
    drop: 'Drop skin PNGs or a .mcpack',
    dropHint: '64×64 or HD 128×128 skins, old 64×32 ones are converted. Several at once.',
    /** Toast */
    added: '{count, plural, one {Added # skin} other {Added # skins}}',
    /** A file that could not be added: "steve.png: That file is 32×32…" */
    failed: '{name}: {error}',
    uploadedName: 'Skin',
  },
  card: {
    /** Accessible names of each skin's controls */
    nameLabel: 'Name of skin {n}',
    arms: 'Arm style of {name}',
    classic: 'Classic',
    slim: 'Slim',
    moveUp: 'Move {name} up',
    moveDown: 'Move {name} down',
    edit: 'Paint',
    editLabel: 'Paint {name} in the skin editor',
    remove: 'Remove {name} from the pack',
    drag: 'Drag to change the order',
    /** Shown when the picture was painted for the other arm style */
    looksSlim: 'Painted for slim arms',
    looksClassic: 'Painted for classic arms',
    /** Screen reader announcements */
    moved: '{name} moved to place {place} of {count}',
    removed: 'Removed {name}',
    undo: 'Undo',
  },
  saved: {
    title: 'Add saved skins',
    intro: 'Skins saved in this browser. Painting them in the skin editor later updates them in the pack too.',
    none: 'You have no saved skins yet. Paint one in the skin editor, or add skins another way.',
    openEditor: 'Open the skin editor',
    inPack: 'In this pack',
    /** The dialog's button */
    add: '{count, plural, =0 {Add skins} one {Add # skin} other {Add # skins}}',
  },
  starters: {
    title: 'Add starter skins',
    intro: 'Pick one or more. You can paint them afterwards.',
    arms: 'Arm style',
  },
  username: {
    title: 'Add a player’s skin',
    text: 'The current skin of any Java Edition player. Bedrock gamertags can’t be looked up.',
    label: 'Minecraft Java username',
    placeholder: 'e.g. Notch',
    add: 'Add skin',
  },
  packs: {
    title: 'Your skin packs',
    text: 'Saved in this browser. Download a pack, or save it as a project file, to keep a copy.',
    current: 'Open',
    /** "3 skins · 5 minutes ago" */
    meta: '{count, plural, one {# skin} other {# skins}} · {when}',
    newPack: 'New skin pack',
    open: 'Open a skin pack',
    openHint: 'Change a skin pack you already have: open its .mcpack or .zip.',
    more: 'More actions for this pack',
    duplicate: 'Duplicate pack',
    copyName: '{name} copy',
    copied: 'Made a copy of “{name}”',
    delete: 'Delete pack',
    deleteTitle: 'Delete this skin pack?',
    deleteText: '“{name}” will be removed from this browser. Saved skins it was made from stay in your skins.',
    deleted: 'Skin pack deleted',
    missing: 'That skin pack isn’t in this browser any more.',
    saveFailed: 'Couldn’t save the skin pack: {error}',
  },
  download: {
    button: 'Download .mcpack',
    empty: 'Add a skin to download the pack.',
    failed: 'Couldn’t make the skin pack.',
  },
  import: {
    opening: 'Opening {name}…',
    /** Toast */
    opened: 'Opened “{name}” with {count, plural, one {# skin} other {# skins}}',
    notZip: 'This file isn’t a skin pack. Skin packs are .mcpack or .zip files.',
    resourcePack: 'This is a texture pack, not a skin pack. Open it in the texture pack maker instead.',
    otherPack: 'This is another kind of Bedrock pack (a behavior pack, world or add-on), not a skin pack.',
    noSkinsJson: 'There is no skins.json in this file, so it isn’t a skin pack.',
    badJson: 'The skins.json in this pack is damaged and can’t be read.',
    noSkins: 'This skin pack has no skins listed in its skins.json.',
    noUsable: 'None of the skins in this pack could be opened: {reason}',
    /** A skin left out; {reason} is one of the reasons below or a size error */
    skipped: '“{name}” was left out: {reason}',
    missingTexture: 'its picture {file} isn’t in the pack.',
    customModel: '{count, plural, one {# skin had its own 3D model, so it now uses} other {# skins had their own 3D models, so they now use}} the standard player model.',
    capes: 'Capes were left out: Mojang doesn’t support them in skin packs that aren’t its own.',
    noManifest: 'The pack had no usable manifest.json, so it gets new pack IDs.',
    morePacks: 'This file holds more than one skin pack. The first one was opened.',
  },
  /** The skin editor, opened from a pack */
  editor: {
    back: 'Back to the skin pack',
  },
  /** The editor's Export › Bedrock skin pack dialog */
  handoff: {
    title: 'Open in the Skin Pack Maker',
    text: 'Reorder the skins, set each one’s arms and add a pack icon.',
  },
});

export type SkinPackText = typeof packText;
