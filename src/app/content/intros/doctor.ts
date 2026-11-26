// The Pack Doctor's introduction in English, loaded on its own pages only (see ToolIntro
// in src/app/content/tools.ts).

import { el } from '../../markup';
import { code, link, strong } from '../blocks';
import type { ToolIntroBody } from '../tools';

export const INTRO: ToolIntroBody = {
  base: 'doctor',
  eyebrow: 'Pack Doctor',
  heading: 'Fix a broken Minecraft texture pack',
  appName: 'Minecraft Pack Doctor',
  lead: [
    'Find out why a texture pack doesn’t work, then fix it. Pack Doctor reads ',
    strong('Java'),
    ' and ',
    strong('Bedrock'),
    ' packs, checks every file against the rules of the version you play, explains each problem and fixes what it safely can. It is free and the pack never leaves your device.',
  ],
  featureList: [
    'Checks Java (.zip) and Bedrock (.mcpack, .mcaddon) resource packs, or a folder',
    'Finds packs in an extra folder or a zip inside the zip, Mac junk files, damaged or unreadable zips',
    'Checks pack.mcmeta against the rules of the chosen Java version, from pack_format to min_format and max_format',
    'Finds texture folders and names from another version (blocks/ before 1.13, later renames) and renames them',
    'Finds file names with capital letters or spaces, JSON syntax errors, missing textures and models, and textures outside the atlas',
    'Checks images (fake PNGs, damaged, 16-bit, sizes), animations and sounds',
    'Checks Bedrock manifest.json (format, UUIDs, modules, min_engine_version), duplicate UUIDs and texture lists',
    'Tells shader packs and data packs apart from resource packs',
    'Fix all applies the safe fixes, shows a before and after, and downloads the fixed .zip or .mcpack',
  ],
  features: [
    ['Drop a Java ', code('.zip'), ', a Bedrock ', code('.mcpack'), ' or ', code('.mcaddon'), ', or the pack’s folder. Big packs stay smooth: everything runs in your browser.'],
    ['Every problem says how bad it is (won’t load, partly broken or a warning), which versions or devices it affects, and how to fix it.'],
    ['Java: a pack in an extra folder, a missing or broken ', code('pack.mcmeta'), ', the wrong pack format for your version, pre-1.13 folders like ', code('textures/blocks'), ', later renames, capital letters and spaces, JSON errors, missing textures and models.'],
    ['Bedrock: ', code('manifest.json'), ' (format, UUIDs, modules, engine version), copied packs with the same UUID, texture lists, letters in the wrong case for phones, and a ', code('.zip'), ' that should be a ', code('.mcpack'), '.'],
    ['Images that aren’t real PNGs, damaged or 16-bit images, sizes that aren’t powers of two, animations without their ', code('.mcmeta'), ', and sounds that aren’t Ogg Vorbis.'],
    ['Shader packs and data packs dropped in by mistake are recognised, and a Java pack used on Bedrock (or the other way round) leads to the converter.'],
    [strong('Fix all'), ' applies every safe fix, checks the pack again and shows what changed. Then download the fixed pack.'],
  ],
  howTitle: 'How to fix a texture pack',
  steps: [
    ['Drop the pack that doesn’t work: a ', code('.zip'), ', ', code('.mcpack'), ', ', code('.mcaddon'), ' or a folder.'],
    'Pick where you play: Java and your version, or Bedrock.',
    'Read the report. Each problem says how bad it is, which versions it affects and how to fix it.',
    [strong('Fix all'), ' applies the safe fixes and checks again. Download the fixed pack and install it.'],
  ],
  faq: [
    {
      id: 'what',
      q: 'What does Pack Doctor check?',
      a: [
        el(
          'p',
          null,
          'Everything that commonly stops a pack from working: where the pack sits in the zip, the zip itself, ',
          code('pack.mcmeta'),
          ' or ',
          code('manifest.json'),
          ', the pack format for your version, folder and file names, every JSON file, the paths between models and textures, images, animations and sounds. A healthy pack gets a “Looks good” with the list of what was checked.',
        ),
      ],
    },
    {
      id: 'safe',
      q: 'Is it safe to let it fix my pack?',
      a: [
        el(
          'p',
          null,
          'Yes. Fix all only applies fixes that can’t change how the pack looks, such as moving files out of an extra folder, writing a correct ',
          code('pack.mcmeta'),
          ' or renaming textures for your version. Fixes that are a choice, such as animating a texture or giving a Bedrock pack new UUIDs, have their own button. Your original file is never changed: you download a fixed copy.',
        ),
      ],
    },
    {
      id: 'not-listed',
      q: 'Why doesn’t my pack show up in Minecraft?',
      a: [
        el(
          'p',
          null,
          'Usually because ',
          code('pack.mcmeta'),
          ' (Java) or ',
          code('manifest.json'),
          ' (Bedrock) isn’t at the top of the zip, is missing, or isn’t valid. Pack Doctor finds and fixes all three. ',
          link('/guides/texture-pack-not-working', 'More fixes for packs that don’t work'),
          '.',
        ),
      ],
    },
    {
      id: 'purple',
      q: 'Why are some blocks purple and black?',
      a: [
        el(
          'p',
          null,
          'That is the missing texture: a model asks for an image that isn’t there, often because the pack uses folder or file names from another version, capital letters, or a folder the game doesn’t put on its atlas. The report lists every such path and renames what it can.',
        ),
      ],
    },
    {
      id: 'convert',
      q: 'Can it make a Java pack work on Bedrock?',
      a: [
        el(
          'p',
          null,
          'It tells you when a pack is for the other edition. Converting it is a job for the ',
          link('/texture-pack-converter', 'Texture Pack Converter'),
          ', which turns Java packs into Bedrock packs and back.',
        ),
      ],
    },
    {
      id: 'upload',
      q: 'Is my pack uploaded?',
      a: [el('p', null, 'No. The pack is read, checked and fixed in your browser. Only the game’s list of its own file names is downloaded, from Mojang, to check paths to vanilla textures.')],
    },
  ],
  guides: ['texture-pack-not-working', 'install-resource-packs', 'minecraft-pack-format-versions', 'convert-java-to-bedrock-texture-pack'],
  related: ['/texture-pack-converter', '/merge-texture-packs', '/textures'],
  cta: 'Check a pack',
};
