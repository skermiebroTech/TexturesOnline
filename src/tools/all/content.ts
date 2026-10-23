// The "Everything" page: every tool, feature, guide and help page as a card with a short
// description, grouped by what it is for. Prerendered at build time, rendered to DOM by all.ts.
// The English text is ALL_EN; translations fill in the same AllText (src/i18n/<lang>/all.ts).

import type { IconName } from '../../ui/icons';
import { el, ic, type ElNode } from '../../app/markup';
import { breadcrumbs } from '../../app/content/blocks';
import { guideCards } from '../../app/content/guide-cards';
import { ALL_META, pageMeta } from '../../app/seo/meta';
import { REPO_URL } from '../../app/site';
import { LATEST } from '../../app/content/facts';
import type { Locale } from '../../i18n/locales';
import { ui } from '../../i18n/ui';
import { contentOf } from '../../i18n/content';

export type AllSectionId = 'tools' | 'textures' | 'skins' | 'shaders' | 'site' | 'guides' | 'help';

export type AllCardId =
  | 'textures'
  | 'convert'
  | 'merge'
  | 'doctor'
  | 'totem'
  | 'fonts'
  | 'skins'
  | 'skinpack'
  | 'cape'
  | 'shaders'
  | 'pixel'
  | 'layers'
  | 'stamps'
  | 'swap'
  | 'biomes'
  | 'paint3d'
  | 'mobs'
  | 'gear'
  | 'effects'
  | 'animation'
  | 'sounds'
  | 'models'
  | 'pvp'
  | 'gui'
  | 'pbr'
  | 'names'
  | 'openPack'
  | 'versions'
  | 'editions'
  | 'skinEditor'
  | 'hdSkins'
  | 'arms'
  | 'poses'
  | 'username'
  | 'bedrockSkinPack'
  | 'installSkins'
  | 'iris'
  | 'vanilla'
  | 'vibrant'
  | 'presets'
  | 'packEditor'
  | 'app'
  | 'languages'
  | 'privacy'
  | 'backup'
  | 'openSource'
  | 'installGuide'
  | 'faq'
  | 'about';

interface Card {
  id: AllCardId;
  icon: IconName;
  /** Site path (localized), or an outside address */
  to: string;
  external?: boolean;
}

interface Section {
  id: Exclude<AllSectionId, 'guides'>;
  icon: IconName;
  accent: string;
  cards: Card[];
}

/** Every text on the page. */
export interface AllText {
  eyebrow: string;
  title: string;
  lead: string;
  /** Label of the jump links above the sections */
  jumpLabel: string;
  sections: Record<AllSectionId, { title: string; lead: string }>;
  cards: Record<AllCardId, { title: string; desc: string }>;
}

const SECTIONS: Section[] = [
  {
    id: 'tools',
    icon: 'tools',
    accent: 'accent-green',
    cards: [
      { id: 'textures', icon: 'image', to: '/textures' },
      { id: 'convert', icon: 'repeat', to: '/texture-pack-converter' },
      { id: 'merge', icon: 'git-merge', to: '/merge-texture-packs' },
      { id: 'doctor', icon: 'potion', to: '/pack-doctor' },
      { id: 'totem', icon: 'heart', to: '/totem-maker' },
      { id: 'fonts', icon: 'text-start-a', to: '/font-maker' },
      { id: 'skins', icon: 'human', to: '/skins' },
      { id: 'skinpack', icon: 'package', to: '/skin-pack-maker' },
      { id: 'cape', icon: 'bookmark', to: '/cape-maker' },
      { id: 'shaders', icon: 'sparkles', to: '/shaders' },
    ],
  },
  {
    id: 'textures',
    icon: 'image',
    accent: 'accent-green',
    cards: [
      { id: 'pixel', icon: 'pencil', to: '/textures' },
      { id: 'layers', icon: 'images', to: '/textures' },
      { id: 'stamps', icon: 'sticker', to: '/textures' },
      { id: 'swap', icon: 'switch', to: '/textures' },
      { id: 'biomes', icon: 'tree', to: '/textures' },
      { id: 'paint3d', icon: 'box', to: '/help?s=paint-3d' },
      { id: 'mobs', icon: 'users', to: '/help?s=mobs' },
      { id: 'gear', icon: 'sword', to: '/help?s=gear' },
      { id: 'effects', icon: 'wand', to: '/textures' },
      { id: 'animation', icon: 'play', to: '/guides/make-animated-textures' },
      { id: 'sounds', icon: 'music', to: '/help?s=sounds' },
      { id: 'models', icon: 'shapes', to: '/guides/make-3d-items-texture-pack' },
      { id: 'pvp', icon: 'sword', to: '/guides/make-a-pvp-texture-pack' },
      { id: 'gui', icon: 'layout', to: '/textures' },
      { id: 'pbr', icon: 'diamond-gem', to: '/guides/make-a-pbr-texture-pack' },
      { id: 'names', icon: 'label', to: '/guides/rename-items-texture-pack' },
      { id: 'openPack', icon: 'folder', to: '/guides/make-a-texture-pack' },
      { id: 'versions', icon: 'clock', to: '/guides/minecraft-pack-format-versions' },
      { id: 'editions', icon: 'gamepad', to: '/guides/java-vs-bedrock-packs' },
    ],
  },
  {
    id: 'skins',
    icon: 'human',
    accent: 'accent-blue',
    cards: [
      { id: 'skinEditor', icon: 'brush', to: '/skins' },
      { id: 'hdSkins', icon: 'zoom-in', to: '/help?s=hd-skins' },
      { id: 'arms', icon: 'human-arms-up', to: '/guides/make-a-skin' },
      { id: 'poses', icon: 'camera', to: '/help?s=poses' },
      { id: 'username', icon: 'search', to: '/skins' },
      { id: 'bedrockSkinPack', icon: 'package', to: '/guides/make-a-bedrock-skin-pack' },
      { id: 'installSkins', icon: 'shirt', to: '/help?s=java-skins' },
    ],
  },
  {
    id: 'shaders',
    icon: 'sparkles',
    accent: 'accent-purple',
    cards: [
      { id: 'iris', icon: 'sun', to: '/help?s=iris' },
      { id: 'vanilla', icon: 'sparkle', to: '/guides/make-shaders-without-mods' },
      { id: 'vibrant', icon: 'cloud-sun', to: '/guides/bedrock-vibrant-visuals-settings' },
      { id: 'presets', icon: 'sliders', to: '/shaders' },
      { id: 'packEditor', icon: 'code', to: '/shaders' },
    ],
  },
  {
    id: 'site',
    icon: 'globe',
    accent: 'accent-gold',
    cards: [
      { id: 'app', icon: 'download', to: '/help?s=offline' },
      { id: 'languages', icon: 'globe', to: '/about' },
      { id: 'privacy', icon: 'lock', to: '/privacy' },
      { id: 'backup', icon: 'archive', to: '/help?s=backup' },
      { id: 'openSource', icon: 'github', to: REPO_URL, external: true },
    ],
  },
  {
    id: 'help',
    icon: 'circle-question',
    accent: 'accent-gold',
    cards: [
      { id: 'installGuide', icon: 'book-open', to: '/help' },
      { id: 'faq', icon: 'circle-question', to: '/help?s=faq' },
      { id: 'about', icon: 'circle-info', to: '/about' },
    ],
  },
];

/** Section order on the page (the guides come before help). */
const ORDER: AllSectionId[] = ['tools', 'textures', 'skins', 'shaders', 'site', 'guides', 'help'];

export const ALL_EN: AllText = {
  eyebrow: 'Everything',
  title: 'Everything on Texture Pack Maker',
  lead: 'Every tool, feature, guide and help page in one place. Pick a card to go straight to it. Everything is free and runs in your browser.',
  jumpLabel: 'Jump to',
  sections: {
    tools: { title: 'Tools', lead: 'Ten free tools for Minecraft Java and Bedrock.' },
    textures: { title: 'Texture packs', lead: 'What you can do in the texture pack maker.' },
    skins: { title: 'Skins', lead: 'Make a skin, an HD skin or a whole Bedrock skin pack.' },
    shaders: { title: 'Shaders', lead: 'Make shaders for Iris and OptiFine, vanilla Java or Bedrock.' },
    site: { title: 'Free, private and everywhere', lead: 'How the site works.' },
    guides: { title: 'Guides', lead: 'Step-by-step guides with screenshots.' },
    help: { title: 'Help', lead: 'Installing, questions and who makes the site.' },
  },
  cards: {
    textures: { title: 'Texture pack maker', desc: 'Repaint any block, item or mob and download a ready .zip for Java or .mcpack for Bedrock.' },
    convert: { title: 'Texture pack converter', desc: 'Turn a Java pack into a Bedrock pack or back, or update an old Java pack to a newer version.' },
    merge: { title: 'Merge texture packs', desc: 'Combine several packs into one, with the top pack winning where they overlap, just like in the game.' },
    doctor: { title: 'Pack Doctor', desc: 'Find out why a pack doesn’t work in the game, and fix it in one click.' },
    totem: { title: 'Custom totem maker', desc: 'Turn your own skin, or any player’s, into a Totem of Undying pack.' },
    fonts: { title: 'Font maker', desc: 'Draw your own pixel font or convert a font file, then change the letters of chat, signs and books.' },
    skins: { title: 'Skin editor', desc: 'Paint a Minecraft skin in 2D or right on the 3D model, then download it for Java or Bedrock.' },
    skinpack: { title: 'Skin pack maker', desc: 'Put several skins into one Bedrock .mcpack you can install with a tap.' },
    cape: { title: 'Cape maker', desc: 'Paint a cape and elytra on the 64×32 template in 3D, then get the PNG or an elytra texture pack.' },
    shaders: { title: 'Shader maker', desc: 'Design your own shaders with sliders and a live preview, with or without mods.' },
    pixel: { title: 'Pixel editor', desc: 'Pencil, fill, lines, shapes, selection and mirror, with undo, at 16× up to 512× resolution.' },
    layers: { title: 'Paint layers', desc: 'Paint on layers like in an image editor, with blend modes and opacity, or trace over the game’s texture. The pack gets them flattened.' },
    stamps: { title: 'Stamp tool', desc: 'Stamp ore spots, cracks, moss, dither or sparkles in your colours, or save a selection as a stamp. Turn it, flip it, tap it on a phone.' },
    swap: { title: 'Colour swap', desc: 'Replace a colour, similar colours or a whole shade ramp in a texture, the selection or every texture of the pack, with one undo.' },
    biomes: { title: 'Biome colours', desc: 'Edit the grass, leaf and leaf-litter colour maps with the biomes marked on them, and see grass and leaves in any biome.' },
    paint3d: { title: 'Paint in 3D', desc: 'Paint straight onto a block’s 3D model and watch every face it uses change at once.' },
    mobs: { title: 'Mobs and entities', desc: 'Repaint mobs on their real 3D models, one body part at a time.' },
    gear: { title: 'Saddles, armour and trims', desc: 'See saddles, horse armour, armour sets and armour trims on the mob that wears them.' },
    effects: { title: 'One-click effects', desc: 'Restyle the whole pack at once: colour, contrast, outlines, pastel, retro and more.' },
    animation: { title: 'Animated textures', desc: 'Animate any block or item: paint frames with an onion skin, set the speed in ticks, import or save GIFs.' },
    sounds: { title: 'Sound editor', desc: 'Replace any game sound with your own audio or a recording, then trim and adjust it.' },
    models: { title: '3D items and block shapes', desc: 'Change the shape of blocks and items, or turn a flat item into a 3D model.' },
    pvp: { title: 'PvP and FPS packs', desc: 'Low fire, clear glass, a custom crosshair, smaller swords and 8× textures, one switch each.' },
    gui: { title: 'GUI and menus', desc: 'Hotbar, hearts, inventory, buttons, the title screen, splash texts and the glint, with a live in-game preview.' },
    pbr: { title: 'PBR materials', desc: 'Shine, metal, glow and bumps for Bedrock Vibrant Visuals and Java labPBR shaders, on a lit 3D block.' },
    names: { title: 'Name-based textures', desc: 'Rename an item in an anvil and it gets its own texture, like a sword named “Excalibur”.' },
    openPack: { title: 'Open any pack', desc: 'Start from scratch or open an existing .zip or .mcpack and keep working on it.' },
    versions: { title: `Every Java version from 1.6.1 to ${LATEST}`, desc: 'Each version gets its own textures and the right pack format.' },
    editions: { title: 'Java and Bedrock', desc: 'Make packs for either edition and learn how the two differ.' },
    skinEditor: { title: 'Paint on 2D or 3D', desc: 'Use the skin template or paint the 3D model, with layers, mirror and part locks.' },
    hdSkins: { title: 'HD 128×128 skins', desc: 'Twice the detail for Bedrock, with a 64×64 copy made for Java.' },
    arms: { title: 'Classic and slim arms', desc: 'Pick 4-pixel or 3-pixel arms and switch a skin between them.' },
    poses: { title: 'Poses and pictures', desc: 'Pose your skin, pick a camera and background, and save a PNG up to 4× size.' },
    username: { title: 'Start from a player’s skin', desc: 'Load any Java player’s skin by username, or upload a PNG, and edit it.' },
    bedrockSkinPack: { title: 'Bedrock skin packs', desc: 'How a skin pack is built and how to install it on PC and phones.' },
    installSkins: { title: 'Use your skin in the game', desc: 'Step by step for the Minecraft Launcher and the Bedrock Dressing Room.' },
    iris: { title: 'Iris and OptiFine', desc: 'Shadows, waving plants, shiny water, bloom and light rays for Java with Iris or OptiFine.' },
    vanilla: { title: 'Shaders without mods', desc: 'Change the look of vanilla Java 1.17 and newer with a plain resource pack.' },
    vibrant: { title: 'Bedrock Vibrant Visuals', desc: 'Tune the lighting, sky, fog and water of Bedrock’s Vibrant Visuals.' },
    presets: { title: 'Presets and live preview', desc: 'Start from a look such as Cinematic or Noir and see every change straight away.' },
    packEditor: { title: 'Edit a shader pack', desc: 'Open an existing shader pack, change its options or files and download it again.' },
    app: { title: 'Install it as an app', desc: 'Add it to your home screen or desktop and use it offline.' },
    languages: { title: 'In six languages', desc: 'English, German, Spanish, Portuguese, Japanese and Russian, editors included.' },
    privacy: { title: 'Nothing is uploaded', desc: 'No accounts, ads or tracking. Your work stays on your device.' },
    backup: { title: 'Back up your projects', desc: 'Save one project or all of them as a file, and open it in another browser or on another device.' },
    openSource: { title: 'Open source', desc: 'The code is public on GitHub, where you can report problems and suggest ideas.' },
    installGuide: { title: 'Install guide', desc: 'Install texture packs, skins and shaders on Java and Bedrock, on any device.' },
    faq: { title: 'Questions and answers', desc: 'Short answers to the most common questions.' },
    about: { title: 'About', desc: 'Who makes Texture Pack Maker and what makes it different.' },
  },
};

/** The page's texts in a language. */
export function allText(locale: Locale = 'en'): AllText {
  return locale === 'en' ? ALL_EN : (contentOf(locale).all ?? ALL_EN);
}

function card(c: Card, accent: string, t: AllText): ElNode {
  const text = t.cards[c.id];
  const attrs = c.external ? { href: c.to, target: '_blank', rel: 'noopener noreferrer' } : { to: c.to };
  return el(
    'a',
    { class: ['guide-card', 'all-card', accent], ...attrs },
    el('span', { class: 'guide-card-icon' }, ic(c.icon)),
    el('span', { class: 'guide-card-text' }, el('h3', { class: 'guide-card-title' }, text.title), el('span', { class: 'guide-card-desc' }, text.desc)),
    ic(c.external ? 'external-link' : 'arrow-right', { class: 'guide-card-go' }),
  );
}

const SECTION_ICONS: Record<AllSectionId, IconName> = { ...Object.fromEntries(SECTIONS.map((s) => [s.id, s.icon])), guides: 'book-open' } as Record<AllSectionId, IconName>;
const SECTION_ACCENTS: Record<AllSectionId, string> = { ...Object.fromEntries(SECTIONS.map((s) => [s.id, s.accent])), guides: 'accent-gold' } as Record<AllSectionId, string>;

function section(id: AllSectionId, t: AllText, locale: Locale): ElNode {
  const s = t.sections[id];
  const def = SECTIONS.find((x) => x.id === id);
  return el(
    'section',
    { class: ['all-section', SECTION_ACCENTS[id]], id, 'aria-labelledby': `${id}-title` },
    el(
      'header',
      { class: 'all-section-head' },
      el('span', { class: 'all-section-icon' }, ic(SECTION_ICONS[id])),
      el('div', null, el('h2', { id: `${id}-title` }, s.title), el('p', { class: 'muted' }, s.lead)),
    ),
    def ? el('div', { class: 'guide-grid' }, def.cards.map((c) => card(c, def.accent, t))) : guideCards(undefined, 'h3', 3, locale),
  );
}

export function allPage(locale: Locale = 'en'): ElNode {
  const t = allText(locale);
  const u = ui(locale);
  const meta = pageMeta(ALL_META.path, locale) ?? ALL_META;
  return el(
    'div',
    { class: ['all-page', 'container'] },
    breadcrumbs([{ label: u.home, to: '/' }, { label: meta.label }], u.breadcrumb),
    el(
      'header',
      { class: 'guide-hero' },
      el('span', { class: 'eyebrow' }, ic('grid-2x2-2'), t.eyebrow),
      el('h1', { id: 'all-title', class: 'pixel-shadow' }, t.title),
      el('p', { class: 'lead' }, t.lead),
    ),
    el(
      'nav',
      { class: 'all-jump', 'aria-label': t.jumpLabel },
      ORDER.map((id) => el('a', { class: ['all-jump-link', SECTION_ACCENTS[id]], href: `#${id}` }, ic(SECTION_ICONS[id]), el('span', null, t.sections[id].title))),
    ),
    ORDER.map((id) => section(id, t, locale)),
  );
}

/** Every site path the page links to (tests check each one exists). */
export const ALL_LINKS: string[] = SECTIONS.flatMap((s) => s.cards.filter((c) => !c.external).map((c) => c.to));
