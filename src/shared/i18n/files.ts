// English text of reading and writing files: archives, images and the game files of each edition
// (src/core/{zip,rangezip,image,tga}.ts, src/editions/{java,bedrock}/assets.ts). These modules
// load lazily, so this section does too.
// Translations: src/shared/i18n/<lang>.ts.

import { defineText } from '../../i18n/editor-text';

export const fileText = defineText('shared.files', {
  zip: {
    unsupportedMethod: "This archive uses a compression method that can't be read in the browser. Re-save it as a normal .zip and try again.",
    invalid: "This file isn't a valid .zip archive, or it is damaged.",
    /** {message} is the zip library's own (English) reason */
    unreadable: "Couldn't read the archive: {message}",
    notZip: "This file isn't a .zip archive.",
    tooLarge: 'This archive is too large to open here (over 1 GB when unpacked).',
    fileGone: "The file couldn't be read. It may have been moved or deleted; pick it again.",
    interrupted: 'The download from {host} was interrupted. Try again.',
    incomplete: 'The download was incomplete. Try again.',
    noEndRecord: "This isn't a valid zip/jar file (no end-of-archive record).",
    tooSmall: "This isn't a valid zip/jar file (too small).",
    truncated: 'This zip/jar file is truncated or damaged.',
    noDirectory: 'The zip directory could not be read.',
    entryDamaged: 'A file inside the archive is damaged.',
    /** {name} is a path inside the archive */
    missing: '{name} is not in the archive.',
    encrypted: "{name} is encrypted and can't be read.",
    method: '{name} uses an unsupported compression method ({method}).',
    damagedNear: 'The archive is damaged near {name}.',
    truncatedNear: 'The archive is truncated near {name}.',
    damagedEntry: '{name} inside the archive is damaged.',
  },
  image: {
    /** {reason} is empty or " (<the decoder's English reason>)" */
    pngUnreadable: "This PNG file couldn't be read{reason}.",
    bitDepth: 'This PNG uses an unsupported bit depth.',
    interlaced: 'Interlaced PNGs with fewer than 8 bits per sample are not supported. Re-save the image as a normal PNG.',
    formatUnsupported: 'This image format is not supported here. Use a PNG file.',
    unreadable: "This image couldn't be read. Try saving it as a PNG.",
    empty: 'The image file is empty.',
    notImage: "This file isn't a supported image. Use a PNG file.",
    notPngOrTga: "This file isn't a PNG or TGA image.",
    tgaTruncated: 'This TGA file is truncated.',
    tgaType: 'Unsupported TGA image type {type}.',
    tgaNoPixels: 'This TGA file has no pixels.',
    tgaTooLarge: 'This TGA image is too large.',
    tgaNoPalette: 'This colour-mapped TGA has no palette.',
    tgaIndexSize: 'Unsupported TGA colour-map index size {bits}.',
    tgaGreyDepth: 'Unsupported TGA greyscale depth {bits}.',
    tgaDepth: 'Unsupported TGA pixel depth {bits}.',
  },
  java: {
    notInVersion: "{path} isn't part of Minecraft {version}.",
    notAvailable: "{path} isn't available.",
    notLoaded: "{path} couldn't be loaded.",
    /** {group} is a folder of the game files, such as "models" or "blockstates" */
    downloadingGroup: 'Downloading Minecraft {version} {group}',
    downloading: 'Downloading Minecraft {version}',
    downloadingTextures: 'Downloading Minecraft {version} textures',
    incomplete: 'The Minecraft {version} download was incomplete. Try again.',
    notDownloaded: "These Minecraft {version} files aren't downloaded yet. Connect to the internet or pick the game's .jar file again.",
    /** {what} is one of the wrongJar* texts below */
    wrongJar: 'That jar is {what}, but Minecraft {version} is selected. Pick the {version} jar ({path} in your .minecraft folder) or switch versions.',
    wrongJarVersion: 'Minecraft {version}',
    wrongJarOlder: 'from an older Minecraft version (it has no version.json)',
    wrongJarPre113: 'from Minecraft 1.12.2 or older',
    wrongJarPost113: 'from Minecraft 1.13 or newer',
    readingList: 'Reading the Minecraft {version} file list',
    notClientJar: "That file doesn't look like a Minecraft Java client jar (no textures inside).",
    noTextures: 'The Minecraft {version} download has no textures.',
    savingOffline: 'Saving for offline use',
    finding: 'Finding Minecraft {version}',
  },
  bedrock: {
    notInVersion: "{path} isn't part of this Bedrock version.",
    missing: "{path} doesn't exist in this Bedrock version.",
    listFailed: "Couldn't load the list of Bedrock textures. Check your internet connection and try again.",
    loadingList: 'Loading the Bedrock texture list',
  },
});

export type FileText = typeof fileText;
