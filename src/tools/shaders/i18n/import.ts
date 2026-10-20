// English text of "Open a shader pack": the dialog (../import/import-flow.ts) and the errors and
// labels of reading a pack (../import/detect.ts, pure: also runs in Node). Translations: ./<lang>.ts.

import { defineText } from '../../../i18n/editor-text';

export const it = defineText('shaders.import', {
  kinds: {
    javaResourcePack: 'Java resource pack',
    /** Bedrock module types */
    resourcePack: 'Resource pack',
    behaviorPack: 'Behavior pack',
    skinPack: 'Skin pack',
    /** An unknown Bedrock module type: "world_template pack" */
    otherPack: '{type} pack',
  },
  /** Suffix of an imported pack's name (the edited copy gets its own name) */
  edited: '{name} (edited)',
  title: 'Open a shader pack',
  reading: 'Reading',
  readLocally: '{size} · read on your device, nothing is uploaded',
  chooseAnother: 'Choose another pack file',
  cantOpen: "This file can't be opened here",
  chooseAnotherButton: 'Choose another file',
  texturePack: 'This is a texture pack',
  texturePackText: '“{name}” is a Java resource pack without shaders. The Texture Pack Maker is made for editing its textures.',
  editFiles: 'Edit files here',
  textureMaker: 'Texture Pack Maker',
  topOfArchive: 'Top of the archive',
  /** Pack list row: "120 files" */
  files: '{count} files',
  madeHere: 'Made with Texture Pack Maker',
  noShaders: 'No shaders',
  holds: '“{name}” holds {count} packs. Which one do you want to open?',
  saving: 'Saving to this browser',
  opened: 'Opened “{name}” with all its settings',
  editInstead: 'Edit files instead',
  openFilesFailed: "Couldn't open the files",
  /** {n} is the file count as written (no grouping), {count} picks the plural form */
  openedFiles: 'Opened “{name}” ({count, plural, one {{n} file} other {{n} files}})',
  saveFailed: "The pack couldn't be saved",
  notPackFile: "“{name}” isn't a pack file. Open a .zip shader pack or resource pack, or a Bedrock .mcpack.",
  tooBig: '“{name}” is {size}, which is too big for a pack to open here.',
  readingFile: 'Reading the file',
  unpacking: 'Unpacking',
  looking: 'Looking at the files',
  readFailed: "The file couldn't be read",
  /** Progress while a zip inside the archive is opened */
  openingNested: 'Opening {name}',
  errors: {
    notZip: "“{name}” isn't a .zip or .mcpack file. Shader packs are zip archives; pick the pack file itself, not a single file from it.",
    unreadable: "The archive couldn't be read.",
    empty: '“{name}” is empty.',
    world: '“{name}” is a world, not a pack. Open a shader pack, resource pack or .mcpack instead.',
    mod: '“{name}” looks like a mod or a game file, not a pack. Shader packs have a “shaders” folder inside.',
    noPack: 'No pack was found in “{name}”. A shader pack has a “shaders” folder (Iris / OptiFine), a resource pack has a pack.mcmeta file, and a Bedrock pack has a manifest.json.',
  },
});

export type ShadersImportText = typeof it;
