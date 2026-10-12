// Landing page content as a markup tree (prerendered at build time, rendered to DOM by home.ts,
// which then adds the live previews, the 3D block and recent projects).

import type { IconName } from '../../ui/icons';
import { el, ic, logo, type Child, type ElNode } from '../../app/markup';
import { faqList, link, type FaqItem } from '../../app/content/blocks';
import { guideCards } from '../../app/content/guide-cards';
import { SITE_NAME } from '../../app/site';

export type ToolKey = 'textures' | 'skins' | 'shaders';

export interface ToolInfo {
  key: ToolKey;
  title: string;
  icon: IconName;
  accent: string;
  blurb: string;
  features: string[];
  cta: string;
  /** Caption on the live preview ('' = set by the preview itself) */
  previewLabel: string;
}

export const TOOLS: ToolInfo[] = [
  {
    key: 'textures',
    title: 'Texture Packs',
    icon: 'image',
    accent: 'accent-green',
    blurb: 'Repaint any block, item or mob — or restyle the whole game with one click.',
    features: ['Every texture, any version', 'Pixel editor & effects', 'Open existing packs'],
    cta: 'Make a texture pack',
    previewLabel: '',
  },
  {
    key: 'skins',
    title: 'Skins',
    icon: 'human',
    accent: 'accent-blue',
    blurb: 'Paint your player on the 64×64 template while a 3D model updates live.',
    features: ['Classic & slim, both layers', 'Templates or any username', 'Java & Bedrock export'],
    cta: 'Design a skin',
    previewLabel: 'Paint pixel by pixel',
  },
  {
    key: 'shaders',
    title: 'Shaders',
    icon: 'sparkles',
    accent: 'accent-purple',
    blurb: 'Dial in lighting, colour, fog and water with sliders and a live preview.',
    features: ['Iris / OptiFine packs', 'No-mod vanilla shaders', 'Bedrock Vibrant Visuals'],
    cta: 'Build a shader',
    previewLabel: 'Day & night preview',
  },
];

export const HOME_FAQ: FaqItem[] = [
  {
    id: 'how',
    q: 'How do I make a Minecraft texture pack?',
    a: [
      el(
        'p',
        null,
        'Open the ',
        link('/textures', 'texture pack editor'),
        ', choose Java or Bedrock and your game version, then repaint textures, upload your own images or apply a one-click effect. Export a ',
        el('code', null, '.zip'),
        ' (Java) or ',
        el('code', null, '.mcpack'),
        ' (Bedrock) and turn it on in game. ',
        link('/guides/make-a-texture-pack', 'Step-by-step guide'),
        '.',
      ),
    ],
  },
  {
    id: 'what',
    q: `What is ${SITE_NAME}?`,
    a: [
      el(
        'p',
        null,
        `${SITE_NAME} is a free website for making Minecraft texture packs, skins and shaders. Everything runs in your browser: pick a game version, edit with live previews and download a pack that is ready for Java or Bedrock.`,
      ),
    ],
  },
  {
    id: 'free',
    q: 'Is it free? Do I need an account?',
    a: [el('p', null, 'It is free, there is no account or sign-up, and the code is open source under the MIT licence. Your projects stay on your own device.')],
  },
  {
    id: 'bedrock',
    q: 'Does it work for Minecraft Bedrock?',
    a: [
      el(
        'p',
        null,
        'Yes. Texture packs and skins export as ',
        el('code', null, '.mcpack'),
        ' files that Bedrock imports when you open them, and the Shader Maker builds Vibrant Visuals packs. See ',
        link('/guides/java-vs-bedrock-packs', 'how Java and Bedrock packs differ'),
        '.',
      ),
    ],
  },
  {
    id: 'versions',
    q: 'Which Java versions can I make packs for?',
    a: [
      el(
        'p',
        null,
        'Java 26.3 is ready by default, and every release back to 1.6.1 works. Each pack gets the ',
        el('code', null, 'pack.mcmeta'),
        ' rules of the version you choose (26.3 uses resource pack format 97.1). ',
        link('/guides/minecraft-pack-format-versions', 'All pack formats'),
        '.',
      ),
    ],
  },
  {
    id: 'resource',
    q: 'Is a texture pack the same as a resource pack?',
    a: [
      el(
        'p',
        null,
        'Almost. Java Edition calls them resource packs: besides textures they can change models, sounds, fonts and shaders. Bedrock calls them resource packs too and uses ',
        el('code', null, '.mcpack'),
        ' files. This maker builds both.',
      ),
    ],
  },
  {
    id: 'skinpack',
    q: 'Can I make a custom skin pack?',
    a: [
      el(
        'p',
        null,
        'Yes. Paint your skins (classic or slim arms) in the ',
        link('/skins', 'skin editor'),
        ' and export them together as one Bedrock skin pack, or download a PNG for Java. ',
        link('/skin-pack-maker', 'Skin pack maker'),
        '.',
      ),
    ],
  },
  {
    id: 'install',
    q: 'Do I need to install anything?',
    a: [el('p', null, 'No. It runs in a modern browser on a computer, phone or tablet. After the first visit the app keeps working offline.')],
  },
];

/** Placeholder for the 3D block: the logo block is shown when JavaScript is off. */
const heroArt = (): ElNode =>
  el(
    'div',
    { class: 'hero-art' },
    el(
      'div',
      { class: 'hero-block', role: 'img', 'aria-label': 'A pixel-art grass block', 'data-hero-block': '' },
      el('div', { class: 'hb-glow' }),
      el('div', { class: 'hb-stage hb-static' }, logo(32)),
      el('div', { class: 'hb-shadow' }),
    ),
    el('p', { class: 'hero-art-hint faint small', 'aria-hidden': 'true' }, ic('hand', { size: 24 }), 'Drag to spin'),
  );

function toolCard(t: ToolInfo): ElNode {
  return el(
    'a',
    { class: ['tool-card', t.accent], to: `/${t.key}`, 'data-tool-card': t.key },
    el(
      'div',
      { class: `tool-preview preview-${t.key}`, 'data-md': 'skip' },
      el('canvas', { class: 'pixelated', 'aria-hidden': 'true' }),
      el('span', { class: 'tool-preview-label' }, t.previewLabel),
    ),
    el(
      'div',
      { class: 'tool-card-body' },
      el('h3', { class: 'tool-card-title' }, el('span', { class: 'tool-card-icon' }, ic(t.icon)), t.title),
      el('p', { class: 'muted' }, t.blurb),
      el(
        'ul',
        { class: 'tool-features' },
        t.features.map((f) => el('li', null, ic('check'), el('span', null, f))),
      ),
      el('span', { class: 'tool-card-cta', 'data-md': 'skip' }, t.cta, ic('arrow-right')),
    ),
  );
}

const STEPS: { title: string; text: string; icon: IconName }[] = [
  { title: 'Pick your game', text: 'Java 26.3 is ready by default — or choose any Java version back to 1.6.1, or Bedrock.', icon: 'gamepad' },
  { title: 'Create', text: 'Paint pixels, stack one-click effects or move shader sliders, with live 3D previews as you go.', icon: 'brush' },
  { title: 'Export & play', text: 'Download a ready-to-use .zip or .mcpack, then follow the install guide to use it in game.', icon: 'download' },
];

const VALUES: { icon: IconName; title: string; text: string }[] = [
  { icon: 'lock', title: 'Private by design', text: 'Your work never leaves your device. Game files are fetched from Mojang by your own browser.' },
  { icon: 'cloud', title: 'Works offline', text: 'After the first visit the app and downloaded game files are kept on this device.' },
  { icon: 'check-double', title: 'The right format, always', text: 'Pack files are written for the exact version you pick, so Minecraft loads them without complaints.' },
];

/** What the texture pack maker does, in the words people search with. */
const FEATURES: { icon: IconName; title: string; text: Child[] }[] = [
  {
    icon: 'box',
    title: 'Texture pack editor with 3D models',
    text: ['Paint every block, item and mob of the version you play, on its real 3D model: furnaces, chests, stairs and every side of a block.'],
  },
  {
    icon: 'wand',
    title: 'One-click texture pack generator',
    text: ['Restyle the whole game at once with effects such as Dark Mode, Pastel, Retro 8-bit, Autumn or Smooth HD, then fine-tune by hand.'],
  },
  {
    icon: 'upload',
    title: 'Open and edit existing packs',
    text: ['Load any Java ', el('code', null, '.zip'), ' or Bedrock ', el('code', null, '.mcpack'), ', change what you like and export it again, or upload your own PNGs.'],
  },
  {
    icon: 'file-text',
    title: 'Java and Bedrock resource packs',
    text: ['A resource pack builder that writes the exact ', el('code', null, 'pack.mcmeta'), ' for Java 26.3 back to 1.6.1, or a Bedrock ', el('code', null, 'manifest.json'), '.'],
  },
  {
    icon: 'human',
    title: 'Skin editor and skin pack maker',
    text: ['Design skins in 2D or 3D with classic or slim arms, and bundle them with the ', link('/skin-pack-maker', 'skin pack maker'), ' into one Bedrock .mcpack.'],
  },
  {
    icon: 'sparkles',
    title: 'Shader maker, with or without mods',
    text: ['Build Iris and OptiFine shader packs, vanilla Java shaders that need no mods, or Bedrock Vibrant Visuals packs.'],
  },
];

const sectionHead = (eyebrowIcon: IconName, eyebrow: string, id: string, title: string, lead?: Child): ElNode =>
  el(
    'div',
    { class: 'section-head center' },
    el('span', { class: 'eyebrow' }, ic(eyebrowIcon), eyebrow),
    el('h2', { id }, title),
    lead ? el('p', { class: 'lead' }, lead) : null,
  );

/** Hero, tools, how it works, guides, questions and the final call to action (no footer). */
export function homePage(): ElNode[] {
  const hero = el(
    'section',
    { class: 'hero container' },
    el(
      'div',
      { class: 'hero-copy' },
      el('span', { class: 'hero-chip' }, ic('sparkle'), 'Free · No sign-up', el('span', { class: 'hide-sm' }, ' · Works offline')),
      el('h1', { class: 'hero-title' }, el('span', { class: 'hero-accent' }, 'Minecraft'), ' Texture Pack Maker'),
      el(
        'p',
        { class: 'hero-lead' },
        'Create your own texture packs, skins and shaders right in your browser — a free resource pack creator for Java and Bedrock, with downloads ready to drop into the game.',
      ),
      el(
        'div',
        { class: 'hero-cta', 'data-md': 'skip' },
        el('a', { class: 'btn btn-primary btn-lg', to: '/textures', 'data-action': 'start' }, ic('magic-edit'), el('span', { class: 'btn-label' }, 'Start creating')),
        el('a', { class: 'btn btn-secondary btn-lg', to: '/help' }, ic('book-open'), el('span', { class: 'btn-label' }, 'How to install')),
      ),
      el(
        'ul',
        { class: 'edition-chips', 'aria-label': 'Supported editions' },
        el('li', { class: 'chip' }, ic('laptop'), 'Java 26.3'),
        el('li', { class: 'chip' }, ic('clock'), 'All versions 1.6.1+'),
        el('li', { class: 'chip' }, ic('gamepad'), 'Bedrock'),
      ),
    ),
    heroArt(),
  );

  const tools = el(
    'section',
    { class: 'section tools container', 'aria-labelledby': 'tools-title' },
    sectionHead('tools', 'Three tools, one place', 'tools-title', 'What do you want to make?', 'Everything you need to give Minecraft your own style. No installs, no accounts — just open a tool and start.'),
    el('div', { class: 'tool-grid' }, TOOLS.map(toolCard)),
  );

  const features = el(
    'section',
    { class: 'section home-features container', 'aria-labelledby': 'features-title' },
    sectionHead(
      'check-double',
      'Free texture pack creator',
      'features-title',
      'Everything a texture pack maker needs',
      'From a single repainted sword to a full HD resource pack, made and exported without leaving the browser.',
    ),
    el(
      'div',
      { class: 'values feature-grid' },
      FEATURES.map((v) => el('div', { class: 'value' }, el('span', { class: 'value-icon' }, ic(v.icon)), el('div', null, el('h3', null, v.title), el('p', { class: 'muted' }, v.text)))),
    ),
  );

  const how = el(
    'section',
    { class: 'section how container', 'aria-labelledby': 'how-title' },
    sectionHead('bulletlist', 'How it works', 'how-title', 'From idea to in-game in minutes'),
    el(
      'ol',
      { class: 'steps' },
      STEPS.map((s, i) =>
        el(
          'li',
          { class: 'step' },
          el('span', { class: 'step-num', 'aria-hidden': 'true' }, String(i + 1)),
          el('div', { class: 'step-body' }, el('h3', null, ic(s.icon), s.title), el('p', { class: 'muted' }, s.text)),
        ),
      ),
    ),
    el(
      'div',
      { class: 'values' },
      VALUES.map((v) => el('div', { class: 'value' }, el('span', { class: 'value-icon' }, ic(v.icon)), el('div', null, el('h3', null, v.title), el('p', { class: 'muted' }, v.text)))),
    ),
  );

  const guides = el(
    'section',
    { class: 'section home-guides container', 'aria-labelledby': 'guides-title' },
    sectionHead('book-open', 'Guides', 'guides-title', 'Learn the ropes', 'Short, fact-checked guides for making and installing packs, skins and shaders.'),
    guideCards(['make-a-texture-pack', 'install-resource-packs', 'texture-pack-not-working', 'make-a-skin', 'make-shaders-without-mods', 'java-vs-bedrock-packs']),
    el('p', { class: 'home-guides-more' }, link('/guides', 'All guides', ic('arrow-right'))),
  );

  const faq = el(
    'section',
    { class: 'section home-faq container', 'aria-labelledby': 'home-faq-title' },
    sectionHead('circle-question', 'Questions', 'home-faq-title', 'Good to know'),
    el('div', { class: 'home-faq-box accent-gold' }, faqList(HOME_FAQ, { idPrefix: 'home-faq' })),
  );

  const cta = el(
    'section',
    { class: 'section final-cta container' },
    el(
      'div',
      { class: 'final-cta-box' },
      el('div', { class: 'stack', style: '--gap: 8px;' }, el('h2', null, 'Ready to build something?'), el('p', { class: 'muted' }, 'Pick a tool and your first pack can be in game in a few minutes.')),
      el('div', { class: 'row wrap', 'data-md': 'skip' }, el('a', { class: 'btn btn-primary btn-lg', to: '/textures', 'data-action': 'start' }, ic('magic-edit'), el('span', { class: 'btn-label' }, 'Start creating'))),
    ),
  );

  return [hero, tools, features, how, guides, faq, cta];
}
