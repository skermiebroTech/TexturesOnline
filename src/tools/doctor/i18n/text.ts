// English text of Pack Doctor's page (view.ts: hero, the two step cards). The report and every
// problem's explanation are in ./report.ts, loaded with the checker. Translations: ./<lang>.ts.

import { defineText } from '../../../i18n/editor-text';

export const t = defineText('doctor', {
  hero: {
    eyebrow: 'Pack Doctor',
    /** {pack} is the highlighted words */
    title: 'Fix a broken Minecraft {pack}',
    pack: 'texture pack',
    lead: 'Drop a pack that doesn’t work. Pack Doctor finds what breaks it, explains each problem, fixes what it safely can and gives you the fixed pack. It all happens in your browser: nothing is uploaded.',
    broken: 'Broken',
    fixed: 'Fixed',
  },
  step1: {
    title: 'Your pack',
    text: 'The .zip, .mcpack or .mcaddon that doesn’t work, or its folder.',
    drop: 'Drop your pack here or click to browse',
    dropHint: '.zip · .mcpack · .mcaddon · or a folder',
    folder: 'Choose a folder',
    reading: 'Reading the pack…',
    change: 'Check another',
    changeTitle: 'Check another pack',
    untitled: 'Untitled pack',
    files: '{count, plural, one {# file} other {# files}}',
    textures: '{count, plural, one {# texture} other {# textures}}',
    emptyFolder: 'That folder is empty.',
  },
  step2: {
    title: 'Where you play',
    text: 'What breaks depends on the game, so pick yours.',
    java: 'Java Edition',
    javaDevices: 'PC, Mac and Linux',
    bedrock: 'Bedrock Edition',
    bedrockDevices: 'Phones, tablets, consoles and Windows',
    version: 'Your Java version',
    hint: 'Checked for {target}. Change it to check again.',
    hintNone: 'Add a pack and it is checked right away.',
    reset: 'Fixes for the old choice were undone.',
  },
});

export type DoctorText = typeof t;
