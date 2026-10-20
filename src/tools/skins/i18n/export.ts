// English text of the skin exports (export.ts: file notes and pack details; ui/export-modal.ts: the
// format menu, the skin pack maker dialog, the HD and old-Java dialogs and the install steps).
// Imported only by the editor. Game menu names in the install steps follow the game's own text in
// each language (Dressing Room, Classic Skins, Equip...). Translations: ./<lang>.ts.

import { defineText } from '../../../i18n/editor-text';

export const exportText = defineText('skins.export', {
  menu: {
    label: 'Export formats',
    java: 'Java skin (.png)',
    javaSub: 'For the Launcher or minecraft.net',
    bedrockPack: 'Bedrock skin pack (.mcpack)',
    bedrockPackSub: 'One or more skins, opens in Minecraft',
    bedrockPng: 'Bedrock skin (.png)',
    bedrockPngSub: 'For the Dressing Room import slot',
    legacy: 'Old Java skin (64×32)',
    legacySub: 'Java 1.7.10 and older',
    /** What each format does with an HD skin */
    javaHd: 'Reduced to 64×64: Java has no HD skins',
    bedrockPackHd: 'Keeps HD 128×128, opens in Minecraft',
    bedrockPngHd: 'HD 128×128 for the Dressing Room import',
    legacyHd: 'Java 1.7.10 and older, reduced to 64×32',
  },
  /** Install steps. {path} pieces are the game's menus, {file} the file name, shown as code. */
  steps: {
    classicModel: 'Classic (4-pixel arms)',
    slimModel: 'Slim (3-pixel arms)',
    launcherTitle: 'Minecraft Launcher',
    launcherOpen: 'Open the Launcher and go to {path}.',
    /** The game's menu names, joined into a path by the code */
    javaSkins: 'Skins',
    launcherNew: 'Click {newSkin}, give it a name and choose {model}.',
    newSkin: 'New skin',
    launcherBrowse: 'Click {browse}, pick {file}, then {save}.',
    browse: 'Browse',
    saveUse: 'Save & Use',
    webTitle: 'Or on minecraft.net',
    webSignIn: 'Sign in, open your profile and choose {model}.',
    webUpload: 'Upload the PNG. It shows up next time you join a world.',
    legacyText: 'Use this file only where a 64×32 skin is required: Java 1.7.10 and older, or launchers and servers for those versions. Newer versions read the normal 64×64 skin.',
    packTitle: 'Install the skin pack',
    packOpen: 'Open {file}: double-click it on Windows, or tap it and choose {openWith} on phones and tablets.',
    openWith: 'Open with Minecraft',
    packImported: 'Minecraft starts and says the import was successful.',
    packFind: 'Go to {path} and scroll to the pack {pack}.',
    dressingRoom: 'Dressing Room',
    classicSkins: 'Classic Skins',
    packPickOne: 'Pick one of the {count} skins and press {equip}.',
    packPickYours: 'Pick your skin and press {equip}.',
    equip: 'Equip',
    packNote: 'Consoles can\'t import skin packs. Friends with “Only Allow Trusted Skins” turned on will see a default skin.',
    pngTitle: 'Import in the Dressing Room',
    pngOpen: 'Open {path}.',
    pngSlot: 'Under {owned} select the blank {import} slot, then {choose}.',
    owned: 'Owned',
    import: 'Import',
    chooseNew: 'Choose New Skin',
    pngPick: 'Pick {file} and choose the {model} arm model.',
    pngClassic: 'classic (Steve)',
    pngSlim: 'slim (Alex)',
  },
  pack: {
    title: 'Make a skin pack',
    name: 'Pack name',
    nameHint: 'Shown in the Dressing Room under Classic Skins.',
    skins: 'Skins in this pack',
    clear: 'Clear',
    selectAll: 'Select all',
    thisSkin: 'This skin',
    /** A skin's size in the list */
    hd: 'HD 128×128',
    classicArms: 'Classic arms',
    slimArms: 'Slim arms',
    untitled: 'Untitled',
    note: 'Each skin keeps its own name, arm model and size (64×64 and HD 128×128 skins can share a pack). Exporting again updates the installed pack.',
    download: 'Download pack',
    /** "3 skins" (the pack's skin count and the file details) */
    count: '{count, plural, one {# skin} other {# skins}}',
    /** File details of a .mcpack: "Pack v1.0.2" */
    version: 'Pack v{version}',
    /** Several HD skins in a pack: "2 HD" */
    hdCount: '{count} HD',
    /** Written into the pack when a skin or pack has no name */
    defaultName: 'My Skin',
    skinName: 'Skin',
    addFailed: '"{name}" could not be added to the pack: {error}',
    unreadable: 'the image is unreadable.',
  },
  legacy: {
    title: 'Export for old Java versions',
    yourSkin: 'Your skin',
    oldVersions: 'Old versions',
    changes: 'What changes',
    nothingLost: 'Nothing gets lost: your skin already fits the old layout.',
    download: 'Download 64×32 PNG',
    leftArm: 'The left arm becomes a mirror copy of the right arm.',
    leftLeg: 'The left leg becomes a mirror copy of the right leg.',
    outer: 'Jacket, sleeves and pants (the outer layer below the head) are dropped. Only the hat layer is kept.',
    slim: 'Old versions only have classic 4-pixel arms, so the slim arms are widened by repeating the column next to the body.',
  },
  hd: {
    title: 'Export an HD skin for Java',
    yourSkin: 'Your HD skin',
    java: 'Java 64×64',
    strong: 'Java Edition only shows 64×64 skins without mods. ',
    text: 'The Launcher and minecraft.net refuse bigger files, so your skin is reduced: each 2×2 block becomes one pixel.',
    lost: 'About {percent}% of the painted areas have finer HD detail that gets simplified. Your HD skin stays as it is for Bedrock.',
    nothingLost: 'This skin has no finer HD detail yet, so nothing is lost.',
    mods: 'Using an HD skin mod (such as CustomSkinLoader)? Download the 128×128 file instead.',
    forMods: '128×128 for mods',
    download64: 'Download 64×64',
  },
  /** Notes shown with the downloaded file */
  notes: {
    javaHd: 'Java Edition only shows 64×64 skins without mods, so this HD skin was reduced to 64×64.',
    javaHdLost: 'About {percent}% of the painted areas had finer detail, which is simplified.',
    javaHdNothing: 'Nothing is lost: it has no finer HD detail yet.',
    hdFile: 'This is the 128×128 HD file. The Minecraft Launcher and minecraft.net only accept 64×64 skins: use it with an HD skin mod only.',
    /** {n} is the number of pixels; count chooses the form */
    holes: '{count, plural, one {{n} pixel is} other {{n} pixels are}} see-through on the base layer. Java shows those as solid colour (often black). Only the outer layer can be transparent.',
    faint: '{count, plural, one {{n} nearly invisible pixel} other {{n} nearly invisible pixels}} (10% opacity or less) will not show on Bedrock.',
    /** File details */
    hdMeta: '128×128 HD',
    reducedMeta: '64×64, reduced from HD',
  },
  done: {
    started: 'Download started',
    again: 'Download again',
    guide: 'Full install guide',
    /** "Java Edition · Classic arms · …" */
    javaEdition: 'Java Edition',
    bedrockEdition: 'Bedrock Edition',
    javaReady: 'Your Java skin is ready',
    bedrockReady: 'Your Bedrock skin is ready',
    packReady: 'Your Bedrock skin pack is ready',
    finished: 'Done',
    downloaded: 'Downloaded {file}',
    failed: 'Export failed.',
  },
});

export type SkinExportText = typeof exportText;
