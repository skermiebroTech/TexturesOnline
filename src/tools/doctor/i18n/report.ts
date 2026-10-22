// English text of Pack Doctor's report (report-view.ts): progress, the summary, every problem's
// title, explanation and fix, what changed and what was checked. Loaded with the checker, so the
// start screen doesn't carry it. Translations: ./<lang>.ts (section "doctor.report").
//
// A problem's text can be one string or one string per variant, chosen by a parameter of the
// problem (see VARIANT in report-view.ts): reason, direction, edition, what, type or pack.

import { defineText } from '../../../i18n/editor-text';

export const r = defineText('doctor.report', {
  progress: {
    title: 'Checking your pack…',
    inBrowser: 'Everything happens in your browser.',
    reading: 'Reading the pack',
    gameFiles: 'Getting the file list of {target}',
    checking: 'Checking every file',
    fixing: 'Fixing…',
    round: 'Fixing, round {n}…',
    building: 'Building the fixed pack…',
    cancelled: 'Check cancelled.',
  },
  head: {
    checkedFor: 'Checked for {target}',
    good: 'Looks good',
    goodText: 'No problems found in this pack. If it still doesn’t show up in the game, the guide below lists what else to check.',
    problems: '{count, plural, one {# problem found} other {# problems found}}',
    fixedTitle: 'Fixed pack ready',
    fixedGood: 'Every problem that could be fixed is fixed.',
    fixedLeft: '{count, plural, one {# problem is left: it needs you.} other {# problems are left: they need you.}}',
    notesOnly: '{count, plural, one {# note} other {# notes}} worth knowing',
  },
  severity: {
    error: 'Won’t load',
    broken: 'Partly broken',
    warning: 'Warning',
    info: 'Note',
  },
  groups: {
    error: 'Stops the pack from loading',
    broken: 'Breaks part of the pack',
    warning: 'Can cause trouble',
    info: 'Good to know',
  },
  actions: {
    fixAll: '{count, plural, one {Fix # problem} other {Fix all # problems}}',
    fixAllHint: 'Applies every safe fix, then checks the pack again.',
    nothingToFix: 'None of these can be fixed automatically: see the steps under each one.',
    fix: 'Fix',
    applyAnyway: 'Fix this one',
    download: 'Download {file}',
    again: 'Check another pack',
    undo: 'Undo the fixes',
    files: '{count, plural, one {# file} other {# files}}',
    more: '{count, plural, one {…and # more} other {…and # more}}',
    safe: 'Safe automatic fix',
    unsafe: 'Fix it only if this is what you want',
    manual: 'How to fix it',
    gameSays: 'What the game says',
    working: 'Working…',
    failed: 'Couldn’t fix that: {message}',
  },
  affects: {
    label: 'Affects',
    all: 'Every version of {edition}',
    from: '{edition} {from} and newer',
    upTo: '{edition} {to} and older',
    target: '{edition} {version}',
    mobile: 'Bedrock on Android, iPhone, iPad and consoles',
    some: 'Some devices',
  },
  after: {
    title: 'Before and after',
    before: 'Before',
    after: 'After',
    changes: 'What changed',
    nothing: 'Nothing had to change.',
  },
  change: {
    rebuilt: 'Wrote a clean zip with normal paths',
    extracted: 'Took the pack out of “{file}”',
    junk: '{count, plural, one {Left out # junk file} other {Left out # junk files}}',
    created: 'Created {file}',
    createdMany: '{count, plural, one {Created # file} other {Created # files}}',
    rewritten: 'Rewrote {file}',
    rewrittenMany: '{count, plural, one {Rewrote # file} other {Rewrote # files}}',
    renamed: '{count, plural, one {Renamed # file} other {Renamed # files}}',
    moved: '{count, plural, one {Moved # file} other {Moved # files}}',
    converted: '{count, plural, one {Converted # image to PNG} other {Converted # images to PNG}}',
    uuids: 'Gave the pack new UUIDs',
    refs: '{count, plural, one {Updated the paths in # file} other {Updated the paths in # files}}',
    extension: 'Saved as {ext}',
  },
  checked: {
    title: 'What was checked',
    zip: 'The file opens as a zip',
    layout: 'The pack is at the top of the file',
    mcmeta: 'pack.mcmeta is valid',
    format: 'Made for {target}',
    folders: 'Texture folders and names match {target}',
    names: 'File names that Java accepts',
    images: '{count, plural, one {# image the game can read} other {# images the game can read}}',
    json: '{count, plural, one {# JSON file without errors} other {# JSON files without errors}}',
    refs: '{count, plural, one {# reference between files} other {# references between files}}',
    animations: '{count, plural, one {# animated texture} other {# animated textures}}',
    sounds: '{count, plural, one {# sound file} other {# sound files}}',
    manifest: 'manifest.json is valid',
    uuids: 'The pack’s UUIDs are its own',
    textureLists: '{count, plural, one {# path in the texture lists} other {# paths in the texture lists}}',
    offline: 'The game’s own file list couldn’t be downloaded, so paths to its textures and models weren’t checked.',
  },
  download: {
    java: 'Put the .zip in your resourcepacks folder (Options › Resource Packs › Open Pack Folder), then select it. Don’t unzip it. ',
    bedrock: 'Open the .mcpack on your device: Minecraft imports it. Then activate it in Settings › Global Resources. ',
    help: 'Installing packs',
    saved: '{count, plural, one {# file} other {# files}}',
    failed: 'Couldn’t build the fixed pack.',
  },
  error: {
    title: 'Couldn’t check the pack',
    text: 'Try again, or download the pack again in case the file is damaged.',
  },
  links: {
    converter: 'Open the Texture Pack Converter',
    install: 'How to install packs',
    shadersHelp: 'Installing shader packs',
    formats: 'Pack formats of every version',
    textures: 'Open the Texture Pack Maker',
    sounds: 'About the sound editor',
    skins: 'Open the skin pack maker',
    notWorking: 'More fixes',
    bedrockPacks: 'Installing Bedrock packs',
  },
  issues: {
    'zip-damaged': {
      title: { rar: 'This is a RAR file, not a zip', '7z': 'This is a 7-Zip file, not a zip', other: 'This isn’t a zip file', damaged: 'The zip is damaged' },
      text: {
        rar: 'Minecraft only reads zip files (.zip for Java, .mcpack for Bedrock).',
        '7z': 'Minecraft only reads zip files (.zip for Java, .mcpack for Bedrock).',
        other: 'Minecraft packs are zip files (.zip for Java, .mcpack for Bedrock), and this file is something else.',
        damaged: 'The download was probably cut off, or the file got damaged.',
      },
      steps: 'Download the pack again from where you got it. If it came as a .rar or .7z, unpack it first and check the .zip, .mcpack or folder inside.',
    },
    'zip-method': {
      title: { encrypted: 'Files locked with a password', method: 'Files compressed in a way Minecraft can’t read', damaged: 'Damaged files in the zip' },
      text: {
        encrypted: '{count, plural, one {# file is} other {# files are}} locked with a password, and Minecraft can’t open them.',
        method: '{count, plural, one {# file was} other {# files were}} compressed with a method such as LZMA, BZip2 or Deflate64. Minecraft only reads standard Deflate zips.',
        damaged: '{count, plural, one {# file can’t} other {# files can’t}} be read. The download may have been cut off.',
      },
      steps: 'Unpack the pack and zip the files again with your computer’s own zip tool, or with 7-Zip set to “Deflate” and no password. Then check the new zip here.',
    },
    'zip-backslash': {
      title: 'File paths use backslashes',
      text: 'The zip stores paths such as assets\\minecraft\\textures instead of assets/minecraft/textures. Some zip tools on Windows do this, and Java then can’t find a single file.',
      fix: 'The fixed pack is written with normal forward slashes.',
    },
    zip64: {
      title: 'The zip uses the ZIP64 format',
      text: 'ZIP64 is meant for huge archives. Some devices can’t import a Bedrock pack saved this way.',
      fix: 'The fixed pack is written as a standard zip.',
    },
    junk: {
      title: 'Mac and Windows junk files',
      text: '{count, plural, one {# file} other {# files}} such as __MACOSX, .DS_Store or Thumbs.db came along when the pack was zipped. The game doesn’t need them, and they can make a Bedrock import fail.',
      fix: 'They are left out of the fixed pack.',
    },
    'nested-folder': {
      title: 'The pack is inside an extra folder',
      text: {
        java: 'Everything is inside “{folder}” instead of at the top of the zip. Java only lists a pack when pack.mcmeta is at the top, so this one doesn’t show up.',
        bedrock: 'Everything is inside “{folder}”. manifest.json belongs at the top of the .mcpack, and some devices can’t import the pack otherwise.',
      },
      fix: 'The fixed pack has its files at the top.',
    },
    'nested-archive': {
      title: 'The pack is a zip inside the zip',
      text: {
        java: 'The download holds “{inner}”, which is the pack itself. Java doesn’t look inside a zip in a zip.',
        bedrock: 'The download holds “{inner}”, which is the pack itself. Bedrock needs that file, not the zip around it.',
      },
      fix: 'The fixed pack is the one inside, taken out.',
    },
    'several-packs': {
      title: 'This file holds {count} packs',
      text: 'It looks like a bundle with a pack per version or edition. Pack Doctor checked “{checked}”, the best match for the game you picked, and the fixed download holds only that one.',
    },
    'no-pack': {
      title: 'No pack found',
      text: 'There’s no pack.mcmeta, manifest.json, assets folder or textures folder in this file, so it isn’t a Minecraft resource pack.',
      steps: 'Only have loose PNG textures? The Texture Pack Converter can turn them into a pack. Or make a new pack in the Texture Pack Maker.',
    },
    'shader-pack': {
      title: 'This is a shader pack, not a resource pack',
      text: 'It has a shaders folder like Iris and OptiFine shader packs. Those need the Iris or OptiFine mod and don’t go in the resourcepacks folder.',
      steps: 'Install Iris (or OptiFine), then put the zip in the shaderpacks folder: Options › Video Settings › Shader Packs › Open Shader Pack Folder. Don’t unzip it.',
    },
    'data-pack': {
      title: 'This is a data pack, not a resource pack',
      text: 'It has a data folder and no assets folder. Data packs change recipes, loot and worlds, and are added to a world, not to the resource pack list.',
      steps: 'Put the zip in the world’s datapacks folder (Create New World › More › Data Packs, or saves/<world>/datapacks), then reopen the world.',
    },
    'other-bedrock-pack': {
      title: { behavior: 'This is a behavior pack', skin: 'This is a skin pack', world: 'This is a world template' },
      text: {
        behavior: 'Behavior packs change how the game works (mobs, items, scripts), not its textures, so Pack Doctor has nothing to check here.',
        skin: 'Skin packs add skins to the Dressing Room, so Pack Doctor has nothing to check here. Open the .mcpack to import it.',
        world: 'World templates create new worlds, so Pack Doctor has nothing to check here. Open the file to import it.',
      },
    },
    'bedrock-zip': {
      title: 'A Bedrock pack in a .zip',
      text: 'Phones, tablets and consoles only import Bedrock packs from .mcpack files: tapping a .zip doesn’t open Minecraft.',
      fix: 'The fixed pack is saved as a .mcpack.',
    },
    'java-mcpack': {
      title: 'A Java pack named {ext}',
      text: 'Java only lists .zip files and folders in its resourcepacks folder. A .mcpack is a Bedrock file.',
      fix: 'The fixed pack is saved as a .zip.',
    },
    'wrong-edition': {
      title: { java: 'This is a Java pack, and you play Bedrock', bedrock: 'This is a Bedrock pack, and you play Java' },
      text: {
        java: 'Java and Bedrock packs use different files and folders, so Bedrock can’t use this pack as it is. The Texture Pack Converter turns it into a Bedrock .mcpack.',
        bedrock: 'Java and Bedrock packs use different files and folders, so Java can’t use this pack as it is. The Texture Pack Converter turns it into a Java .zip for your version.',
      },
      steps: 'Convert it with the Texture Pack Converter, or pick the other edition above if that’s the one you play.',
    },
    'mcmeta-missing': {
      title: 'pack.mcmeta is missing',
      text: 'Every Java resource pack needs a pack.mcmeta file at the top. Without it the pack doesn’t show up in the list.',
      fix: 'Creates pack.mcmeta for Java {version}.',
    },
    'mcmeta-name': {
      title: 'pack.mcmeta has the wrong name',
      text: 'It’s called “{file}”. Windows often hides “.txt” at the end of file names, so a file saved in Notepad becomes pack.mcmeta.txt.',
      fix: 'Renames it to pack.mcmeta.',
    },
    'mcmeta-json': {
      title: 'pack.mcmeta isn’t valid JSON',
      text: 'A missing comma, quote or bracket breaks the file, and Java skips the whole pack.',
      fix: 'Writes a new pack.mcmeta for Java {version}, keeping the description.',
    },
    'mcmeta-strict': {
      title: { bom: 'pack.mcmeta starts with an invisible mark', comments: 'pack.mcmeta has comments or extra commas' },
      text: {
        bom: 'The file starts with a byte order mark, which some editors add. Java’s reader stops there and skips the pack.',
        comments: 'Java reads pack.mcmeta strictly: comments, or a comma before a closing bracket, make it skip the pack.',
      },
      fix: 'Writes it again as clean JSON for Java {version}.',
    },
    'mcmeta-invalid': {
      title: 'Java can’t read pack.mcmeta',
      text: 'The file is valid JSON, but its fields break the rules of Java {version}, so the pack shows as broken or doesn’t show up at all.',
      fix: 'Writes pack.mcmeta the way Java {version} expects it, keeping the description.',
    },
    'format-mismatch': {
      title: { old: 'Made for an older version', new: 'Made for a newer version' },
      text: 'The pack says it’s for Java {packVersions} (pack format {packFormats}), but Java {version} uses {format}. The game marks it as incompatible and asks before using it, and textures that were renamed between the versions look wrong.',
      fix: 'Updates pack.mcmeta for Java {version}.',
    },
    'old-folders': {
      title: 'Texture folders from before 1.13',
      text: '{count, plural, one {# texture is} other {# textures are}} in textures/blocks or textures/items. Since 1.13 Java uses textures/block and textures/item, and many files got new names, so Java {version} ignores them.',
      fix: 'Renames them for Java {version} and updates the models that use them.',
      steps: 'Open the pack in the Texture Pack Converter and convert it to Java {version}.',
    },
    'new-folders': {
      title: 'Texture folders from 1.13 and newer',
      text: '{count, plural, one {# texture is} other {# textures are}} in textures/block or textures/item, but Java {version} still uses textures/blocks and textures/items, so it ignores them.',
      fix: 'Renames them for Java {version}.',
      steps: 'Open the pack in the Texture Pack Converter and convert it to Java {version}.',
    },
    'renamed-textures': {
      title: 'Textures with old names',
      text: '{count, plural, one {# texture has} other {# textures have}} the name used in Java {from}. Java {version} uses a different name, so the texture is ignored.',
      fix: 'Renames them for Java {version} and updates the models that use them.',
    },
    'bad-names': {
      title: 'File names Java can’t use',
      text: '{count, plural, one {# file has} other {# files have}} capital letters, spaces or other characters in its path. Java only accepts a–z, 0–9, _ - . and / in file names, and skips the rest.',
      fix: 'Renames them in lowercase, with _ for spaces, and updates the files that point at them.',
      steps: 'Rename the files that are left by hand: lowercase, no spaces.',
    },
    'misplaced-textures': {
      title: 'Textures in the wrong folder',
      text: '{count, plural, one {# texture is} other {# textures are}} outside assets/minecraft/textures, where Java looks for them.',
      fix: 'Moves them into assets/minecraft/textures.',
    },
    'atlas-missing': {
      title: 'Model textures outside the block atlas',
      text: 'Since 1.19.3, models can only use textures from folders that are on the game’s atlas, such as block and item. {count, plural, one {# texture} other {# textures}} in {folders} show up purple and black.',
      fix: 'Adds those folders to the pack’s atlas files.',
    },
    'missing-texture-ref': {
      title: 'Models point at textures that don’t exist',
      text: '{count, plural, one {# texture path isn’t} other {# texture paths aren’t}} in the pack or in Java {version}, so the purple and black missing texture shows instead.',
      fix: 'Points old texture names at their names in Java {version}.',
      steps: 'Check the spelling and folder of each path, or add the missing images.',
    },
    'missing-model-ref': {
      title: 'Models that don’t exist',
      text: '{count, plural, one {# reference points} other {# references point}} at a model that isn’t in the pack or in Java {version}, so the block or item becomes a purple and black cube.',
      steps: 'Check the spelling of each model name, or add the missing model files.',
    },
    'anim-strip': {
      title: 'Animated textures without their .mcmeta',
      text: '{count, plural, one {# texture is} other {# textures are}} a tall strip of frames with no .png.mcmeta next to it, so Java squashes the whole strip onto one face.',
      fix: 'Adds a .png.mcmeta that plays the frames. Only do this if the texture is meant to move.',
    },
    'anim-size': {
      title: 'Animation frames don’t fit the image',
      text: '{count, plural, one {# animated texture has} other {# animated textures have}} a size that isn’t a whole number of frames. Java can’t cut it into frames and shows the missing texture.',
      steps: 'Make the image height a multiple of its width, or of the frame size set in the .mcmeta.',
    },
    'anim-frames': {
      title: 'Animation settings that don’t work',
      text: '{count, plural, one {# .mcmeta file lists} other {# .mcmeta files list}} frames the image doesn’t have, or a frame time below 1.',
      fix: 'Removes the missing frames and sets frame times to at least 1.',
    },
    'sound-format': {
      title: 'Sounds that aren’t Ogg Vorbis',
      text: '{count, plural, one {# sound file is} other {# sound files are}} MP3, WAV or another format, sometimes just renamed to .ogg. Java only plays real Ogg Vorbis files.',
      steps: 'Convert them to .ogg, for example with the sound editor of the Texture Pack Maker, which imports audio and saves Ogg Vorbis.',
    },
    'overlay-missing': {
      title: 'Overlay folders that aren’t there',
      text: 'pack.mcmeta lists {count, plural, one {# overlay folder that isn’t} other {# overlay folders that aren’t}} in the pack. Nothing breaks, but those versions get no overlay.',
      steps: 'Remove those entries from overlays in pack.mcmeta, or add the folders.',
    },
    'core-shaders': {
      title: 'Core shaders for one version',
      text: 'The pack replaces the game’s own shaders ({count, plural, one {# file} other {# files}}). Mojang changes these files often, so they only work on the version they were written for; on another, Java can turn off every resource pack.',
      steps: 'Use the pack on the version it was made for, or make a new shader for your version in the Shader Maker.',
    },
    optifine: {
      title: 'Parts that need OptiFine',
      text: '{count, plural, one {# file is} other {# files are}} in the optifine folder: connected textures, custom item textures or skies. Without OptiFine (or a mod that reads these files) the game ignores them; the rest of the pack still works.',
    },
    'json-strict': {
      title: 'JSON with comments or extra commas',
      text: '{count, plural, one {# file has} other {# files have}} comments, a comma before a closing bracket or an invisible mark at the start. Java’s strict reader can refuse such files.',
      fix: 'Writes them again as clean JSON.',
    },
    'json-syntax': {
      title: 'JSON files with errors',
      text: '{count, plural, one {# file has} other {# files have}} a syntax error, such as a missing comma, quote or bracket. The game skips the file: models go missing, sounds and texts are left out.',
      steps: 'Open the file in a text editor, fix the line shown and check it again.',
    },
    'manifest-missing': {
      title: 'manifest.json is missing',
      text: 'Every Bedrock pack needs a manifest.json at the top with its name, two IDs (UUIDs) and a version. Without it the import fails.',
      fix: 'Creates a manifest.json with new IDs.',
    },
    'manifest-name': {
      title: 'manifest.json has the wrong name',
      text: 'It’s called “{file}”. Bedrock only reads manifest.json, all in lowercase, without “.txt”.',
      fix: 'Renames it to manifest.json.',
    },
    'manifest-json': {
      title: 'manifest.json isn’t valid JSON',
      text: 'A missing comma, quote or bracket breaks the file, so the import fails.',
      fix: 'Writes a new manifest.json, keeping the name, description and IDs it can still read.',
    },
    'manifest-format': {
      title: 'Unknown format_version',
      text: 'manifest.json says format_version {value}. Bedrock understands 1, 2 and 3.',
      fix: 'Sets format_version 2 and repairs the rest of the file.',
    },
    'manifest-header': {
      title: { missing: 'The manifest has no header', version: 'The pack version isn’t valid', name: 'The pack has no name' },
      text: {
        missing: 'The header holds the pack’s name, ID and version. Without it Bedrock can’t import the pack.',
        version: 'header.version must be three whole numbers, such as [1, 0, 0].',
        name: 'Bedrock needs a name to show the pack in its list.',
      },
      fix: 'Repairs manifest.json, keeping everything that is valid.',
    },
    'manifest-uuid': {
      title: { invalid: 'Missing or invalid UUIDs', same: 'The header and the module share a UUID' },
      text: {
        invalid: 'A pack needs two unique IDs (UUIDs), one in the header and one in the module, written like 8f0b5a0e-6c55-4d3b-9b1e-0a4c2f9d7e11.',
        same: 'The two IDs must be different, or Bedrock refuses the pack.',
      },
      fix: 'Adds new UUIDs where they are missing or repeated.',
    },
    'manifest-modules': {
      title: 'No “resources” module',
      text: 'Bedrock recognises a resource pack by a module of type "resources". This one has: {found}.',
      fix: 'Sets the module type to "resources".',
    },
    'manifest-engine': {
      title: { missing: 'No min_engine_version', invalid: 'min_engine_version isn’t valid', new: 'Needs a Minecraft that doesn’t exist yet' },
      text: {
        missing: 'Without it Bedrock treats the pack as made for very old versions and may read some of its files the old way.',
        invalid: 'It must be three numbers, such as [1, 21, 0].',
        new: 'min_engine_version is {value}, newer than any release (the newest is {newest}), so Bedrock says the pack needs a newer game.',
      },
      fix: 'Sets min_engine_version to {engine}.',
    },
    'duplicate-uuid': {
      title: 'Two packs with the same UUID',
      text: '{count} packs in this file have the same ID, like a pack that was copied and changed. Bedrock sees them as one pack: only one shows up, or one replaces the other.',
      fix: 'Gives this pack new UUIDs.',
    },
    'known-uuid': {
      title: 'Same UUID as another pack you checked',
      text: 'This pack has the same ID as “{other}”, which you checked earlier on this device. With both installed, Bedrock treats them as one pack and keeps only one.',
      fix: 'Gives this pack new UUIDs. Worlds that use the old copy then need it added again.',
    },
    'texture-list': {
      title: 'Texture lists Bedrock can’t read',
      text: '{count, plural, one {# texture list has} other {# texture lists have}} no texture_data section, or entries in the wrong shape. The textures they list show as missing.',
      steps: 'Compare the file with the same file in Minecraft’s own resource pack and fix its structure.',
    },
    'bedrock-missing-ref': {
      title: 'Texture lists point at missing images',
      text: '{count, plural, one {# path points} other {# paths point}} at an image that isn’t in the pack or in Bedrock’s own textures, so those blocks or items look missing.',
      steps: 'Check each path (without the file extension, e.g. textures/blocks/stone) or add the images.',
    },
    'bedrock-case': {
      title: { files: 'File names with the wrong capital letters', refs: 'Paths with the wrong capital letters' },
      text: {
        files: '{count, plural, one {# file differs} other {# files differ}} from the game’s own names only in capital letters. Windows doesn’t mind, but Android, iPhone, iPad and consoles look for the exact name, so the texture isn’t replaced there.',
        refs: '{count, plural, one {# path} other {# paths}} in the texture lists only match an image with different capital letters. That works on Windows, not on phones, tablets and consoles.',
      },
      fix: { files: 'Renames the files to the game’s spelling.', refs: 'Changes the paths to the images’ exact names.' },
    },
    'java-in-bedrock': {
      title: 'Java textures in a Bedrock pack',
      text: '{count, plural, one {# texture is} other {# textures are}} in assets/minecraft/textures, the Java folder. Bedrock only reads textures/ and ignores them.',
      steps: 'Convert the Java textures with the Texture Pack Converter, then add them to this pack.',
    },
    'tga-png-pair': {
      title: 'Textures in both .png and .tga',
      text: '{count, plural, one {# texture exists} other {# textures exist}} twice, as .png and .tga. The game uses only one of them, so your change may not show.',
      steps: 'Keep one file per texture (the same type as the game’s own) and delete the other.',
    },
    'subpack-missing': {
      title: 'Sub-pack folders are missing',
      text: 'manifest.json lists {count, plural, one {# sub-pack whose folder isn’t} other {# sub-packs whose folders aren’t}} in subpacks/, so choosing it in the pack settings does nothing.',
      steps: 'Add the folders, or remove those entries from subpacks in manifest.json.',
    },
    'pack-name-key': {
      title: 'The pack name is a language key',
      text: 'The name is “{key}”, a key to look up in texts/en_US.lang, but the pack doesn’t define it, so Bedrock shows the key itself.',
      fix: 'Names the pack “{name}” in manifest.json.',
    },
    'long-paths': {
      title: 'Very long file paths',
      text: '{count, plural, one {# path is} other {# paths are}} longer than 80 characters. Xbox and some other devices can’t load such files (80 is also Microsoft’s limit for Marketplace packs).',
      steps: 'Shorten the folder and file names.',
    },
    'material-bin': {
      title: 'Shader files that need a modified game',
      text: '{count, plural, one {# .material.bin file replaces} other {# .material.bin files replace}} Bedrock’s RenderDragon shaders. They only work with tools such as BetterRenderDragon or a patched game, and break with updates.',
    },
    'not-png': {
      title: 'Images that aren’t really PNGs',
      text: '{count, plural, one {# file is} other {# files are}} named .png but hold a JPEG, WebP, GIF, BMP or TGA image. The game only reads real PNG files there and shows the missing texture.',
      fix: 'Converts them to real PNGs.',
    },
    'wrong-image-type': {
      title: 'Images in a format the game doesn’t read',
      text: {
        java: '{count, plural, one {# texture is} other {# textures are}} .jpg, .webp, .gif, .bmp or .tga. Java only reads .png textures.',
        bedrock: '{count, plural, one {# texture is} other {# textures are}} .webp, .gif or .bmp. Bedrock reads .png and .tga.',
      },
      fix: 'Converts them to .png with the same name.',
    },
    'broken-image': {
      title: 'Damaged images',
      text: '{count, plural, one {# image is} other {# images are}} cut off or damaged and can’t be read.',
      steps: 'Open each one in an image editor and save it again as PNG, or replace it.',
    },
    'png-format': {
      title: '16-bit or interlaced PNGs',
      text: '{count, plural, one {# image is} other {# images are}} saved with 16 bits per channel or with interlacing. The game only needs standard 8-bit images, and some versions and devices show these wrong.',
      fix: 'Saves them as standard 8-bit RGBA PNGs. The pixels stay the same.',
    },
    'not-power-of-two': {
      title: 'Sizes that aren’t powers of two',
      text: '{count, plural, one {# block or item texture isn’t} other {# block and item textures aren’t}} 16, 32, 64, 128… pixels wide. The game can lower the quality of distant blocks (mipmaps) for the whole pack, or show these textures blurry.',
      steps: 'Resize them to a power of two, such as 16×16 or 32×32, with nearest-neighbour scaling.',
    },
    'pack-icon': {
      title: '{file} isn’t a working PNG',
      text: 'The pack’s icon is in another format or damaged, so the pack shows without its picture.',
      fix: 'Converts it to a PNG.',
      steps: 'Save the icon as a square PNG, such as 128×128.',
    },
  },
});

export type ReportText = typeof r;
