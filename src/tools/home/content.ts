// Landing page content as a markup tree (prerendered at build time, rendered to DOM by home.ts,
// which then adds the live previews, the 3D block and recent projects). The English text is
// HOME_EN; translations fill in the same HomeText (src/i18n/<lang>/home.ts).

import type { IconName } from '../../ui/icons';
import { el, ic, logo, type Child, type ElNode } from '../../app/markup';
import { faqList, link, type FaqItem } from '../../app/content/blocks';
import { guideCards } from '../../app/content/guide-cards';
import { SITE_NAME } from '../../app/site';
import { F, LATEST } from '../../app/content/facts';
import { differences } from '../about/content';
import type { Locale } from '../../i18n/locales';
import { contentOf } from '../../i18n/content';
import { ui } from '../../i18n/ui';

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

/** The translatable part of a tool card. */
export type ToolCardText = Pick<ToolInfo, 'title' | 'blurb' | 'features' | 'cta' | 'previewLabel'>;

interface Item {
  title: string;
  text: string;
}

type Six<T> = [T, T, T, T, T, T];

/** Every text on the home page. */
export interface HomeText {
  /** Tool cards (a card without a translation keeps its English text; a unit test flags it) */
  tools: Partial<Record<ToolKey, ToolCardText>>;
  faq: FaqItem[];
  /** WebApplication featureList in the structured data (the tools' blurbs are added to it) */
  appFeatures: string[];
  hero: {
    chip: string;
    chipOffline: string;
    /** Title around its accent-coloured word: pre + accent + post */
    title: { pre?: string; accent: string; post?: string };
    lead: string;
    start: string;
    install: string;
    /** Link to the page with every tool, feature and guide */
    everything: string;
    editionsLabel: string;
    chips: [string, string, string];
    blockLabel: string;
    dragHint: string;
  };
  toolsSection: { eyebrow: string; title: string; lead: string };
  converter: { title: string; text: string; cta: string };
  features: { eyebrow: string; title: string; lead: string; titles: Six<string>; items: Six<Child[]> };
  why: { eyebrow: string; title: string; lead: Child[] };
  how: { eyebrow: string; title: string; steps: [Item, Item, Item]; values: [Item, Item, Item] };
  guides: { eyebrow: string; title: string; lead: string; all: string };
  faqHead: { eyebrow: string; title: string };
  cta: { title: string; text: string; button: string };
  startDialog: string;
}

const TOOL_LIST: ToolInfo[] = [
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

const HOME_FAQ_EN: FaqItem[] = [
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
        `Java ${LATEST} is ready by default, and every release back to 1.6.1 works. Each pack gets the `,
        el('code', null, 'pack.mcmeta'),
        ` rules of the version you choose (${LATEST} uses resource pack format ${F(LATEST)}). `,
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

const STEP_ICONS: [IconName, IconName, IconName] = ['gamepad', 'brush', 'download'];
const VALUE_ICONS: [IconName, IconName, IconName] = ['lock', 'cloud', 'check-double'];
const FEATURE_ICONS: Six<IconName> = ['box', 'wand', 'upload', 'file-text', 'human', 'sparkles'];

export const HOME_EN: HomeText = {
  tools: Object.fromEntries(TOOL_LIST.map((t) => [t.key, { title: t.title, blurb: t.blurb, features: t.features, cta: t.cta, previewLabel: t.previewLabel }])) as Record<ToolKey, ToolCardText>,
  faq: HOME_FAQ_EN,
  appFeatures: [
    `Minecraft texture pack maker for Java Edition (${LATEST} and every version since 1.6.1) and Bedrock Edition`,
    'Minecraft skin editor with a live 3D preview, classic and slim models, Java PNG and Bedrock skin pack export',
    'Shader maker for Iris / OptiFine shader packs, no-mod vanilla Java shaders and Bedrock Vibrant Visuals packs',
    'Exports ready-to-use .zip and .mcpack files with the correct pack.mcmeta or manifest.json',
    'Runs in the browser: no sign-up, nothing uploaded, works offline after the first visit',
  ],
  hero: {
    chip: 'Free · No sign-up',
    chipOffline: ' · Works offline',
    title: { accent: 'Minecraft', post: ' Texture Pack Maker' },
    lead: 'Create your own texture packs, skins and shaders right in your browser — a free resource pack creator for Java and Bedrock, with downloads ready to drop into the game.',
    start: 'Start creating',
    install: 'How to install',
    everything: 'See everything you can make',
    editionsLabel: 'Supported editions',
    chips: [`Java ${LATEST}`, 'All versions 1.6.1+', 'Bedrock'],
    blockLabel: 'A pixel-art grass block',
    dragHint: 'Drag to spin',
  },
  toolsSection: {
    eyebrow: 'Three tools, one place',
    title: 'What do you want to make?',
    lead: 'Everything you need to give Minecraft your own style. No installs, no accounts — just open a tool and start.',
  },
  converter: {
    title: 'Texture Pack Converter',
    text: `Turn a Java pack into a Bedrock one or back, update an old pack to ${LATEST}, or turn PNGs into an .mcpack.`,
    cta: 'Convert a pack',
  },
  features: {
    eyebrow: 'Free texture pack creator',
    title: 'Everything a texture pack maker needs',
    lead: 'From a single repainted sword to a full HD resource pack, made and exported without leaving the browser.',
    titles: [
      'Texture pack editor with 3D models',
      'One-click texture pack generator',
      'Open and edit existing packs',
      'Java and Bedrock resource packs',
      'Skin editor and skin pack maker',
      'Shader maker, with or without mods',
    ],
    items: [
      ['Paint every block, item and mob of the version you play, right on its real 3D model: furnaces, chests, stairs, and over 80 mobs from creepers to villagers.'],
      ['Restyle the whole game at once with effects such as Dark Mode, Pastel, Retro 8-bit, Autumn or Smooth HD, then fine-tune by hand.'],
      ['Load any Java ', el('code', null, '.zip'), ' or Bedrock ', el('code', null, '.mcpack'), ' and keep editing, or switch it to the other edition with the ', link('/texture-pack-converter', 'pack converter'), '.'],
      ['A resource pack builder that writes the exact ', el('code', null, 'pack.mcmeta'), ` for Java ${LATEST} back to 1.6.1, or a Bedrock `, el('code', null, 'manifest.json'), '.'],
      ['Design skins in 2D or 3D with classic or slim arms, and bundle them with the ', link('/skin-pack-maker', 'skin pack maker'), ' into one Bedrock .mcpack.'],
      ['Build Iris and OptiFine shader packs, vanilla Java shaders that need no mods, or Bedrock Vibrant Visuals packs.'],
    ],
  },
  why: {
    eyebrow: 'Why it’s different',
    title: `Why ${SITE_NAME}?`,
    lead: ['Free, open source and private, with every Java version since 1.6.1, Bedrock and seven tools in one place. ', link('/about', 'About the project'), '.'],
  },
  how: {
    eyebrow: 'How it works',
    title: 'From idea to in-game in minutes',
    steps: [
      { title: 'Pick your game', text: `Java ${LATEST} is ready by default — or choose any Java version back to 1.6.1, or Bedrock.` },
      { title: 'Create', text: 'Paint pixels, stack one-click effects or move shader sliders, with live 3D previews as you go.' },
      { title: 'Export & play', text: 'Download a ready-to-use .zip or .mcpack, then follow the install guide to use it in game.' },
    ],
    values: [
      { title: 'Private by design', text: 'Your work never leaves your device. Game files are fetched from Mojang by your own browser.' },
      { title: 'Works offline', text: 'After the first visit the app and downloaded game files are kept on this device.' },
      { title: 'The right format, always', text: 'Pack files are written for the exact version you pick, so Minecraft loads them without complaints.' },
    ],
  },
  guides: { eyebrow: 'Guides', title: 'Learn the ropes', lead: 'Short, fact-checked guides for making and installing packs, skins and shaders.', all: 'All guides' },
  faqHead: { eyebrow: 'Questions', title: 'Good to know' },
  cta: { title: 'Ready to build something?', text: 'Pick a tool and your first pack can be in game in a few minutes.', button: 'Start creating' },
  startDialog: 'What do you want to make?',
};

/** The home page texts of a language. */
export function homeText(locale: Locale = 'en'): HomeText {
  return locale === 'en' ? HOME_EN : (contentOf(locale).home ?? HOME_EN);
}

/** The three tool cards in a language. */
export function homeTools(locale: Locale = 'en'): ToolInfo[] {
  const t = homeText(locale);
  return TOOL_LIST.map((tool) => ({ ...tool, ...(t.tools[tool.key] ?? HOME_EN.tools[tool.key]) }));
}

/** English tool cards and questions. */
export const TOOLS: ToolInfo[] = TOOL_LIST;
export const HOME_FAQ: FaqItem[] = HOME_FAQ_EN;

/** Placeholder for the 3D block: the logo block is shown when JavaScript is off. */
const heroArt = (t: HomeText): ElNode =>
  el(
    'div',
    { class: 'hero-art' },
    el(
      'div',
      { class: 'hero-block', role: 'img', 'aria-label': t.hero.blockLabel, 'data-hero-block': '' },
      el('div', { class: 'hb-glow' }),
      el('div', { class: 'hb-stage hb-static' }, logo(32)),
      el('div', { class: 'hb-shadow' }),
    ),
    el('p', { class: 'hero-art-hint faint small', 'aria-hidden': 'true' }, ic('hand', { size: 24 }), t.hero.dragHint),
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

const sectionHead = (eyebrowIcon: IconName, eyebrow: string, id: string, title: string, lead?: Child): ElNode =>
  el(
    'div',
    { class: 'section-head center' },
    el('span', { class: 'eyebrow' }, ic(eyebrowIcon), eyebrow),
    el('h2', { id }, title),
    lead ? el('p', { class: 'lead' }, lead) : null,
  );

const value = (icon: IconName, title: string, text: Child): ElNode =>
  el('div', { class: 'value' }, el('span', { class: 'value-icon' }, ic(icon)), el('div', null, el('h3', null, title), el('p', { class: 'muted' }, text)));

/** Hero, tools, how it works, guides, questions and the final call to action (no footer). */
export function homePage(locale: Locale = 'en'): ElNode[] {
  const t = homeText(locale);
  const hero = el(
    'section',
    { class: 'hero container' },
    el(
      'div',
      { class: 'hero-copy' },
      el('span', { class: 'hero-chip' }, ic('sparkle'), t.hero.chip, el('span', { class: 'hide-sm' }, t.hero.chipOffline)),
      el('h1', { class: 'hero-title' }, t.hero.title.pre, el('span', { class: 'hero-accent' }, t.hero.title.accent), t.hero.title.post),
      el('p', { class: 'hero-lead' }, t.hero.lead),
      el(
        'div',
        { class: 'hero-cta', 'data-md': 'skip' },
        el('a', { class: 'btn btn-primary btn-lg', to: '/textures', 'data-action': 'start' }, ic('magic-edit'), el('span', { class: 'btn-label' }, t.hero.start)),
        el('a', { class: 'btn btn-secondary btn-lg', to: '/help' }, ic('book-open'), el('span', { class: 'btn-label' }, t.hero.install)),
      ),
      el('p', { class: 'hero-all', 'data-md': 'skip' }, el('a', { to: '/all' }, ic('grid-2x2-2'), el('span', null, t.hero.everything), ic('arrow-right'))),
      el(
        'ul',
        { class: 'edition-chips', 'aria-label': t.hero.editionsLabel },
        el('li', { class: 'chip' }, ic('laptop'), t.hero.chips[0]),
        el('li', { class: 'chip' }, ic('clock'), t.hero.chips[1]),
        el('li', { class: 'chip' }, ic('gamepad'), t.hero.chips[2]),
      ),
    ),
    heroArt(t),
  );

  const tools = el(
    'section',
    { class: 'section tools container', 'aria-labelledby': 'tools-title' },
    sectionHead('tools', t.toolsSection.eyebrow, 'tools-title', t.toolsSection.title, t.toolsSection.lead),
    el('div', { class: 'tool-grid' }, homeTools(locale).map(toolCard)),
    el(
      'a',
      { class: 'convert-banner accent-green', to: '/texture-pack-converter' },
      el('span', { class: 'convert-banner-icon' }, ic('repeat')),
      el('span', { class: 'convert-banner-text' }, el('strong', { class: 'convert-banner-title' }, t.converter.title), el('span', { class: 'muted' }, t.converter.text)),
      el('span', { class: 'convert-banner-cta', 'data-md': 'skip' }, t.converter.cta, ic('arrow-right')),
    ),
  );

  const features = el(
    'section',
    { class: 'section home-features container', 'aria-labelledby': 'features-title' },
    sectionHead('check-double', t.features.eyebrow, 'features-title', t.features.title, t.features.lead),
    el(
      'div',
      { class: 'values feature-grid' },
      FEATURE_ICONS.map((icon, i) => value(icon, t.features.titles[i], t.features.items[i])),
    ),
  );

  const why = el(
    'section',
    { class: 'section home-why container', 'aria-labelledby': 'why-title' },
    sectionHead('star', t.why.eyebrow, 'why-title', t.why.title, t.why.lead),
    differences('h3', locale),
  );

  const how = el(
    'section',
    { class: 'section how container', 'aria-labelledby': 'how-title' },
    sectionHead('bulletlist', t.how.eyebrow, 'how-title', t.how.title),
    el(
      'ol',
      { class: 'steps' },
      t.how.steps.map((s, i) =>
        el(
          'li',
          { class: 'step' },
          el('span', { class: 'step-num', 'aria-hidden': 'true' }, String(i + 1)),
          el('div', { class: 'step-body' }, el('h3', null, ic(STEP_ICONS[i]), s.title), el('p', { class: 'muted' }, s.text)),
        ),
      ),
    ),
    el(
      'div',
      { class: 'values' },
      t.how.values.map((v, i) => value(VALUE_ICONS[i], v.title, v.text)),
    ),
  );

  const guides = el(
    'section',
    { class: 'section home-guides container', 'aria-labelledby': 'guides-title' },
    sectionHead('book-open', t.guides.eyebrow, 'guides-title', t.guides.title, t.guides.lead),
    guideCards(['make-a-texture-pack', 'install-resource-packs', 'texture-pack-not-working', 'make-a-skin', 'make-shaders-without-mods', 'java-vs-bedrock-packs'], 'h3', 3, locale),
    el('p', { class: 'home-guides-more' }, link('/guides', t.guides.all, ic('arrow-right')), link('/all', ui(locale).footer.everything, ic('arrow-right'))),
  );

  const faq = el(
    'section',
    { class: 'section home-faq container', 'aria-labelledby': 'home-faq-title' },
    sectionHead('circle-question', t.faqHead.eyebrow, 'home-faq-title', t.faqHead.title),
    el('div', { class: 'home-faq-box accent-gold' }, faqList(t.faq, { idPrefix: 'home-faq' })),
  );

  const cta = el(
    'section',
    { class: 'section final-cta container' },
    el(
      'div',
      { class: 'final-cta-box' },
      el('div', { class: 'stack', style: '--gap: 8px;' }, el('h2', null, t.cta.title), el('p', { class: 'muted' }, t.cta.text)),
      el('div', { class: 'row wrap', 'data-md': 'skip' }, el('a', { class: 'btn btn-primary btn-lg', to: '/textures', 'data-action': 'start' }, ic('magic-edit'), el('span', { class: 'btn-label' }, t.cta.button))),
    ),
  );

  return [hero, tools, features, why, how, guides, faq, cta];
}
