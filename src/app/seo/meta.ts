// Titles and descriptions of every public (indexable) page. Kept free of DOM and content imports so
// the router, the runtime head updater and the build-time prerender can all share it.

import { SITE_NAME } from '../site';

export type PageKind = 'home' | 'tool' | 'help' | 'guides' | 'guide';
export type PageTool = 'home' | 'textures' | 'skins' | 'shaders' | 'help';

export interface PageMeta {
  /** Route path without trailing slash ('/', '/textures', '/guides/make-a-skin') */
  path: string;
  kind: PageKind;
  /** Nav section the page belongs to (sets the accent colour and active link) */
  tool: PageTool;
  /** <title>, at most 60 characters */
  title: string;
  /** Meta description, at most 155 characters */
  description: string;
  /** Short name for breadcrumbs and link lists */
  label: string;
}

export interface GuideMeta extends PageMeta {
  kind: 'guide';
  slug: string;
  /** Page heading */
  h1: string;
  /** One short line for guide cards */
  blurb: string;
  /** Icon name for guide cards (pixelarticons) */
  icon: string;
  accent: 'accent-green' | 'accent-blue' | 'accent-purple' | 'accent-gold';
}

export const HOME_META: PageMeta = {
  path: '/',
  kind: 'home',
  tool: 'home',
  title: `${SITE_NAME} — Make Minecraft Texture Packs Online`,
  description:
    'Make Minecraft texture packs, skins and shaders in your browser. Free, no sign-up, works offline. Java 26.3, every version since 1.6.1, and Bedrock.',
  label: 'Home',
};

export const TOOL_META: Record<'textures' | 'skins' | 'shaders', PageMeta> = {
  textures: {
    path: '/textures',
    kind: 'tool',
    tool: 'textures',
    title: 'Minecraft Texture Pack Maker Online — Java & Bedrock',
    description:
      'Repaint any block, item or mob, upload your own PNGs or restyle the game in one click, then export a ready-to-use .zip or .mcpack. Free, in your browser.',
    label: 'Texture packs',
  },
  skins: {
    path: '/skins',
    kind: 'tool',
    tool: 'skins',
    title: `Minecraft Skin Editor Online — ${SITE_NAME}`,
    description:
      'Paint a custom Minecraft skin on the 64×64 template with a live 3D preview. Classic or slim arms, both layers, and Java PNG or Bedrock skin pack export.',
    label: 'Skins',
  },
  shaders: {
    path: '/shaders',
    kind: 'tool',
    tool: 'shaders',
    title: `Make Minecraft Shaders Online — ${SITE_NAME}`,
    description:
      'Build Iris or OptiFine shader packs, no-mod vanilla shaders for Java, or Bedrock Vibrant Visuals packs, with presets, sliders and a live 3D preview.',
    label: 'Shaders',
  },
};

export const HELP_META: PageMeta = {
  path: '/help',
  kind: 'help',
  tool: 'help',
  title: `Install Guide & FAQ — ${SITE_NAME}`,
  description:
    'How to install texture packs, skins and shaders in Minecraft Java and Bedrock on PC, phone and console, where the Minecraft folder is, plus a FAQ.',
  label: 'Help',
};

export const GUIDES_META: PageMeta = {
  path: '/guides',
  kind: 'guides',
  tool: 'help',
  title: `Minecraft Pack, Skin & Shader Guides — ${SITE_NAME}`,
  description:
    'Step-by-step guides to making and installing Minecraft texture packs, skins and shaders, plus every Java resource pack format from 1.6.1 to 26.3.',
  label: 'Guides',
};

const guide = (g: Omit<GuideMeta, 'kind' | 'tool' | 'path'>): GuideMeta => ({ ...g, kind: 'guide', tool: 'help', path: `/guides/${g.slug}` });

export const GUIDES: GuideMeta[] = [
  guide({
    slug: 'make-a-texture-pack',
    blurb: 'Pick a version, repaint textures and export a pack Minecraft loads.',
    title: `How to Make a Minecraft Texture Pack — ${SITE_NAME}`,
    h1: 'How to make a Minecraft texture pack',
    description:
      'Make a Minecraft texture pack for Java or Bedrock: pick a version, repaint textures, then export a .zip with the right pack.mcmeta or an .mcpack.',
    label: 'Make a texture pack',
    icon: 'image',
    accent: 'accent-green',
  }),
  guide({
    slug: 'install-resource-packs',
    blurb: 'Java resource packs, Bedrock .mcpack files and shader packs, plus fixes.',
    title: 'How to Install a Minecraft Texture Pack (Java & Bedrock)',
    h1: 'How to install Minecraft texture packs, shaders and .mcpack files',
    description:
      'Install a resource pack on Java, import a Bedrock .mcpack on PC or phone, add a shader pack with Iris or OptiFine, and fix packs that do not show up.',
    label: 'Install packs and shaders',
    icon: 'download',
    accent: 'accent-green',
  }),
  guide({
    slug: 'minecraft-pack-format-versions',
    blurb: 'The pack format of every Java release from 1.6.1 to 26.3.',
    title: 'Minecraft Resource Pack Formats: Every Version to 26.3',
    h1: 'Minecraft resource pack format for every Java version',
    description:
      'Every Minecraft Java release from 1.6.1 to 26.3 and its resource pack format (26.3 uses 97.1), plus how pack.mcmeta has changed over the years.',
    label: 'Pack format versions',
    icon: 'bulletlist',
    accent: 'accent-gold',
  }),
  guide({
    slug: 'make-a-skin',
    blurb: 'Paint the 64×64 template and use it on Java or in a Bedrock skin pack.',
    title: `How to Make a Custom Minecraft Skin — ${SITE_NAME}`,
    h1: 'How to make a custom Minecraft skin',
    description:
      'Design a Minecraft skin online: paint the 64×64 template with a live 3D preview, pick classic or slim arms, then use it on Java or in a Bedrock skin pack.',
    label: 'Make a skin',
    icon: 'human',
    accent: 'accent-blue',
  }),
  guide({
    slug: 'make-shaders-without-mods',
    blurb: 'What vanilla Java shader packs and Bedrock Vibrant Visuals can do.',
    title: 'Minecraft Shaders Without Mods (Java & Bedrock)',
    h1: 'Can you make Minecraft shaders without mods?',
    description:
      'Yes, within limits: Java 1.17+ resource packs can change the game’s own shaders and Bedrock uses Vibrant Visuals packs. What works, what does not, and how.',
    label: 'Shaders without mods',
    icon: 'sun',
    accent: 'accent-purple',
  }),
  guide({
    slug: 'bedrock-vibrant-visuals-settings',
    blurb: 'Sun, sky, fog, water and colour settings, and supported devices.',
    title: `Vibrant Visuals Settings for Bedrock — ${SITE_NAME}`,
    h1: 'Bedrock Vibrant Visuals settings explained',
    description:
      'What a Vibrant Visuals pack can change in Minecraft Bedrock (sun, sky, fog, water, shadows and colour grading), supported devices and how to turn it on.',
    label: 'Vibrant Visuals settings',
    icon: 'cloud-sun',
    accent: 'accent-purple',
  }),
  guide({
    slug: 'java-vs-bedrock-packs',
    blurb: 'Files, folders, formats, shaders and skins compared side by side.',
    title: 'Java vs Bedrock Texture Packs: What Is the Difference?',
    h1: 'Java vs Bedrock packs: what is the difference?',
    description:
      'Java uses .zip packs with pack.mcmeta; Bedrock uses .mcpack files with manifest.json. Paths, image formats, shaders, skins and installing compared.',
    label: 'Java vs Bedrock packs',
    icon: 'gamepad',
    accent: 'accent-blue',
  }),
];

/** Every page that is prerendered, listed in the sitemap and open to search engines. */
export const PUBLIC_PAGES: PageMeta[] = [HOME_META, TOOL_META.textures, TOOL_META.skins, TOOL_META.shaders, HELP_META, GUIDES_META, ...GUIDES];

/** Meta for a route path ('/help', '/help/'), or undefined for private and unknown paths. */
export function publicPageMeta(path: string): PageMeta | undefined {
  const p = path.length > 1 ? path.replace(/\/+$/, '') : path;
  return PUBLIC_PAGES.find((m) => m.path === p);
}
