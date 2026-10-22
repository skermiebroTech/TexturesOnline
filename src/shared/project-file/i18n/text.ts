// English text of project files and backups: saving and opening them, the backup and restore
// dialogs and their errors (src/shared/project-file/). Loaded with those dialogs.
// Translations: ./<lang>.ts.

import { defineText } from '../../../i18n/editor-text';

export const pf = defineText('shared.projectFile', {
  /** Toast after a project file was downloaded; {file} is its name */
  saved: 'Saved {file}. Open it here any time to keep editing.',
  saveFailed: "Couldn't save the project file.",
  /** Toast after a project file was opened */
  opened: 'Opened “{name}”',
  /** The same project was already in this browser, so the file opened as a second one */
  openedCopy: 'Opened “{name}” as a copy. The one you already had is unchanged.',
  /** Name of a project restored next to one with the same id */
  copyName: '{name} (copy)',
  untitled: 'Untitled',
  errors: {
    notZip: "This isn't a project file. Project files end in .tpmproject or .tpmbackup.",
    notProject: "This isn't a Texture Pack Maker project file. To open a pack, use “Open a pack” in the texture pack maker.",
    damaged: "This project file is damaged and can't be opened.",
    /** {version} is the file's format number */
    newer: 'This file was saved by a newer version of Texture Pack Maker (format {version}). Reload the page to update, then open it again.',
    empty: 'This file has no projects in it.',
    /** One project in a backup could not be read */
    item: '“{name}” is damaged and was left out.',
  },
  /** Kinds of project, in lists */
  types: {
    texturepack: 'Texture pack',
    skin: 'Skin',
    shader: 'Shader',
    cape: 'Cape',
    font: 'Font',
  },
  /** Counts in the backup summary */
  counts: {
    texturepack: '{count, plural, one {# texture pack} other {# texture packs}}',
    skin: '{count, plural, one {# skin} other {# skins}}',
    shader: '{count, plural, one {# shader} other {# shaders}}',
    cape: 'Your cape',
    font: 'Your font',
  },
  backup: {
    title: 'Back up your projects',
    intro: 'One file with every project in this browser. Keep it somewhere safe, or open it in another browser or on another device to bring everything over.',
    none: 'There are no projects in this browser yet.',
    contains: 'In the backup',
    gameFiles: "The game's own files aren't included: they download again from Mojang when you open a project.",
    download: 'Download backup',
    /** Toast; {file} is the file name */
    done: 'Backup saved: {file}',
    failed: "Couldn't make the backup.",
  },
  restore: {
    title: 'Restore a backup',
    /** {date} is when the backup was made */
    intro: 'Saved on {date}. Choose what to bring back into this browser.',
    choose: 'Projects',
    /** Badge on a project that is already in this browser */
    already: 'Already here',
    /** Label of the choice for projects that are already here */
    existing: 'Already in this browser',
    skip: 'Skip',
    keepBoth: 'Keep both',
    /** Line under a project that is already here */
    skipNote: 'Kept as it is in this browser',
    copyNote: 'Restored as a copy next to yours',
    replaceNote: 'Replaces the one in this browser',
    selectAll: 'Select all',
    selectNone: 'Select none',
    restore: '{count, plural, =0 {Restore} one {Restore # project} other {Restore # projects}}',
    done: '{count, plural, one {Restored # project} other {Restored # projects}}',
    failed: "Couldn't restore “{name}”.",
    edited: 'Edited {date}',
  },
  replace: {
    /** Asked before a cape file replaces the cape maker's one cape */
    capeTitle: 'Replace your cape?',
    capeText: 'The cape maker keeps one cape at a time, so opening “{name}” replaces the one you’re working on. Save it as a project file first if you want to keep it.',
    saveFirst: 'Save current first',
    replace: 'Replace',
  },
});

export type ProjectFileText = typeof pf;
