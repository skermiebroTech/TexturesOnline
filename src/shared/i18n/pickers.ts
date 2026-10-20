// English text of the version picker, the game-file download panel and the file drop zone
// (src/ui/version-picker.ts, src/ui/dropzone.ts). Translations: src/shared/i18n/<lang>.ts.

import { defineText } from '../../i18n/editor-text';

export const pickers = defineText('shared.pickers', {
  version: {
    edition: 'Edition',
    /** Picker button before the version list has loaded, for the newest Bedrock version */
    latest: 'Latest',
    choose: 'Choose a version',
    /** Under the version on the picker button: "pack 34" (the Java pack format) */
    packFormat: 'pack {format}',
    snapshot: 'snapshot',
    preview: 'preview',
    /** aria-label of the picker button; {details} is empty or ", pack 34, snapshot" */
    buttonLabel: 'Minecraft {edition} {version}{details}. Change version',
    searchJava: 'Search versions, e.g. 1.20',
    search: 'Search versions',
    showSnapshots: 'Show snapshots',
    showPreviews: 'Show previews',
    versions: 'Versions',
    noMatch: 'No versions match "{query}"',
    none: 'No versions available',
    badgeDefault: 'Default',
    badgeLatest: 'Latest',
    /** Read out after a snapshot's name in the list */
    snapshotSuffix: ', snapshot',
    loading: 'Loading versions…',
    loadFailed: "Couldn't load the version list.",
    offline: "You're offline, so the version list can't be loaded.",
    dialog: 'Choose a game version',
  },
  assets: {
    titleBedrock: 'Getting Bedrock textures',
    titleJava: 'Getting Minecraft textures',
    titleJavaVersion: 'Getting Minecraft {version} textures',
    oneTime: 'One-time download — next time it opens instantly.',
    starting: 'Starting…',
    noteJava: "Your browser downloads the official game files straight from Mojang's servers and keeps only the textures, models and shaders on this device. Nothing is uploaded.",
    noteBedrock: "Textures come straight from Mojang's official bedrock-samples repository on GitHub and are cached on this device as you browse. Nothing is uploaded.",
    note: 'Your browser downloads the official game files straight from Mojang and keeps them on this device. Nothing is uploaded.',
    useJar: 'Use my own .jar',
    /** {path} is ".minecraft/versions/26.3/26.3.jar" */
    jarHelp: 'Your Minecraft folder has it: {path}. Play that version once in the Minecraft Launcher so the file exists.',
    ready: 'Ready',
    allSet: 'All set.',
    filesReady: 'Game files ready.',
    downloading: 'Downloading game files…',
    failed: "Couldn't get the game files.",
  },
  drop: {
    /** {accept} is e.g. "a .zip file" or ".zip, .mcpack or .mcaddon files" */
    wrongType: '"{name}" can\'t be used here. Please choose {accept}.',
    skipped: 'Skipped {count, plural, one {# unsupported file} other {# unsupported files}}.',
    oneAtATime: 'One file at a time: using "{name}".',
  },
});

export type PickersText = typeof pickers;
