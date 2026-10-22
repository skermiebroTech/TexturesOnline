// English text of opening and exporting texture packs (src/tools/textures/import.ts and
// export.ts), which the texture editor, the converter and the merger share: errors, the notes
// shown about an opened pack or a download, and export progress. Loads with those modules.
// Translations: src/shared/i18n/<lang>.ts.

import { defineText } from '../../i18n/editor-text';

export const packText = defineText('shared.packs', {
  open: {
    singleImage: 'That is a single image. To use it, open a texture in the editor and upload it there. To open a whole pack, choose its .zip or .mcpack file.',
    jar: "That is a game or mod .jar file, not a resource pack. Choose a pack's .zip or .mcpack file instead.",
    tooLarge: 'This file is larger than 1 GB, which is too big to open in the browser.',
    empty: 'This file is empty.',
    notArchive: "This file isn't a .zip, .mcpack or .mcaddon archive, so it can't be opened as a pack.",
    emptyArchive: 'This archive is empty.',
    innerUnreadable: '"{path}" inside the archive couldn\'t be read and was skipped.',
    skinPack: 'This is a Bedrock skin pack. Open it in the Skins tool instead.',
    behaviorPack: 'This is a behavior pack (it changes how the game plays, not how it looks), so it has no textures to edit.',
    worldTemplate: 'This is a world template, not a resource pack.',
    noPack: "This archive doesn't contain a Minecraft resource pack (there is no pack.mcmeta or manifest.json).",
    /** {count} is 2 or more */
    severalPacks: 'This file contains {count} resource packs. Opened the one in "{folder}"; open the others separately.',
    outside: '{count, plural, one {# file outside the pack\'s "{folder}" folder was left out.} other {# files outside the pack\'s "{folder}" folder were left out.}}',
    noTextures: 'This pack has no textures of its own yet. You can start editing any vanilla texture.',
    noMcmeta: 'The pack has no pack.mcmeta file. A correct one will be created when you export.',
    badMcmeta: "The pack's pack.mcmeta file is damaged. A correct one will be created when you export.",
    formattedDescription: 'The pack description used colours or formatting codes; it was converted to plain text.',
    badPackPng: "The pack icon (pack.png) isn't a valid PNG, so a new icon will be generated.",
    badImages: '{count, plural, one {# texture isn\'t a real PNG image and will be kept as-is but can\'t be edited.} other {# textures aren\'t real PNG images and will be kept as-is but can\'t be edited.}}',
    modTextures: "{count, plural, one {# texture} other {# textures}} for mods (other namespaces) will be kept but can't be edited here.",
    overlays: 'Overlay folders (version-specific extras) are kept as they are; only the main textures are editable.',
    noVersion: "The pack doesn't say which Minecraft version it's for, so it was set to {version}. You can change this in the Pack settings.",
    newerFormat: 'This pack is for a newer Minecraft version than this app knows (pack format {format}). It was set to {version}; check the version in the Pack settings.',
    snapshotFormat: 'This pack was made for a development snapshot (pack format {format}). It was set to the closest release, Minecraft {version}.',
    oldRange: 'The pack claimed support for very old versions together with new ones, which new versions reject. Its range now starts at Minecraft 1.20.',
    badIds: "The pack's IDs in manifest.json are missing or invalid, so it got new ones. It will install as a separate pack.",
    noManifest: 'The pack has no manifest.json. A new one will be created when you export.',
    vibrantVisuals: 'This pack has Vibrant Visuals (PBR) texture sets. They are kept, and in the texture pack maker they open in the Material tab.',
    subpacks: 'This pack has sub-packs (in-game options). Their folders are kept as they are; only the main textures are editable.',
    badPackIcon: "The pack icon (pack_icon.png) isn't a valid PNG, so a new icon will be generated.",
    unrecognisedImages: "{count, plural, one {# texture} other {# textures}} couldn't be recognised as images and will be kept as-is but can't be edited.",
    /** Name of an opened pack whose file name gives none */
    importedName: 'Imported pack',
  },
  export: {
    wrongEdition: 'The loaded game files are for {assets}, but this pack is for {pack}.',
    javaEdition: 'Java Edition',
    bedrockEdition: 'Bedrock Edition',
    preparing: 'Preparing pack…',
    newIds: "The pack's IDs were invalid, so it got new ones. It will install as a separate pack.",
    /** Bedrock manifest name when the pack has none */
    defaultName: 'Texture Pack',
    unchanged: "This pack doesn't change any textures yet, so it won't look different in game. Edit a texture or add an effect first.",
    /** Progress: "Applying effects… 120 / 900" */
    applyingEffects: 'Applying effects… {done} / {total}',
    addingTextures: 'Adding textures… {done} / {total}',
    effectsFailed: "Couldn't load the game's textures to apply the effects. Check your connection and try again.",
    /** {files} lists up to three file names, e.g. "stone.png, dirt.png and 4 more" */
    vanillaFailed: "{count, plural, one {# texture couldn't be loaded, so the effects are missing on it: {files}.} other {# textures couldn't be loaded, so the effects are missing on them: {files}.}}",
    overridesFailed: "{count, plural, one {The effects couldn't be applied to # edited texture, so it was added as-is: {files}.} other {The effects couldn't be applied to # edited textures, so they were added as-is: {files}.}}",
    unreadable: "{count, plural, one {# edited texture couldn't be read from this browser's storage and was left out: {files}.} other {# edited textures couldn't be read from this browser's storage and were left out: {files}.}}",
    lost: "{count, plural, one {# file from the opened pack couldn't be read from this browser's storage and was left out: {files}.} other {# files from the opened pack couldn't be read from this browser's storage and were left out: {files}.}}",
    /** End of a file list: "a.png, b.png, c.png and 4 more" */
    andMore: '{list} and {count} more',
    icon: 'Creating pack icon…',
    materials: 'Adding materials…',
    packInfo: 'Writing pack info…',
    compressing: 'Compressing…',
    done: 'Done',
    widened: "The version range didn't include Minecraft {version}, so it was widened to {from} – {to}.",
    offlineRange: "The version range couldn't be looked up offline, so the pack only declares Minecraft {version}.",
    /** {versions} is "1.19.4" or "1.19.4 and 26.3" */
    incompatible: "{count, plural, one {Minecraft {versions} will list this pack as made for another version (it can still be turned on after a warning). Very old and very new versions can't share one pack; export a separate pack for that version if you need it.} other {Minecraft {versions} will list this pack as made for another version (it can still be turned on after a warning). Very old and very new versions can't share one pack; export a separate pack for those versions if you need it.}}",
    overlaysInactive: 'Overlay folders only work in Minecraft 1.20.2 and newer, so they are kept as files but not active for this version.',
    iconUnreadable: "The pack icon couldn't be read, so a generated icon was used instead.",
    /** {files} lists up to three texture names */
    pbrMissingColour: '{count, plural, one {# material was left out because its texture is in neither the pack nor the game: {files}.} other {# materials were left out because their textures are in neither the pack nor the game: {files}.}}',
    pbrPlainSets: "{count, plural, one {# changed texture gets a plain material for Vibrant Visuals, because the game's material for it couldn't be loaded.} other {# changed textures get a plain material for Vibrant Visuals, because the game's materials for them couldn't be loaded.}}",
  },
});

export type PackText = typeof packText;
