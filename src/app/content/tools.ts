// What each tool does, how to use it and common questions. Prerendered as the content of
// /textures/, /skins/ and /shaders/ (the pages search engines and AI crawlers read) and shown
// below each tool's start screen once the app is running, so both say the same thing.

import type { IconName } from '../../ui/icons';
import { el, ic, type Child, type ElNode } from '../markup';
import { breadcrumbs, code, link, steps, strong, faqList, type FaqItem } from './blocks';
import { guideCards } from './guide-cards';
import { TOOL_META } from '../seo/meta';
import { KNOWN_RELEASE_FORMATS, formatPackFormat } from '../../editions/java/packformats';

export type IntroTool = 'textures' | 'skins' | 'shaders';

export interface ToolIntro {
  tool: IntroTool;
  accent: string;
  icon: IconName;
  eyebrow: string;
  heading: string;
  lead: Child[];
  /** Name used in structured data (WebApplication) */
  appName: string;
  features: Child[];
  /** Plain-text feature list for structured data */
  featureList: string[];
  howTitle: string;
  steps: Child[];
  extra?: Child[];
  faq: FaqItem[];
  guides: string[];
  cta: string;
}

const f263 = formatPackFormat(KNOWN_RELEASE_FORMATS['26.3']);

export const TOOL_INTROS: Record<IntroTool, ToolIntro> = {
  textures: {
    tool: 'textures',
    accent: 'accent-green',
    icon: 'image',
    eyebrow: 'Texture packs',
    heading: 'Make a Minecraft texture pack online',
    appName: 'Minecraft Texture Pack Maker',
    lead: [
      'Repaint any block, item or mob using the real textures of the version you play, then download a pack Minecraft loads straight away. It works for ',
      strong('Java Edition'),
      ' (26.3 and every version back to 1.6.1) and ',
      strong('Bedrock Edition'),
      ', it is free and nothing is uploaded.',
    ],
    featureList: [
      'Browse every vanilla texture of the chosen version, with search and categories',
      'Pixel editor: pencil, eraser, fill, eyedropper, line, shapes, noise, selection, mirror painting, undo and redo',
      'Upload your own PNGs, auto-resized to the texture (16x up to 512x)',
      'Edit animated textures frame by frame',
      'One-click whole-pack effects such as Dark Mode, Pastel, Neon Outline, Retro 8-bit, Autumn, Winter, Noir, Cartoon and Smooth HD',
      'Open an existing .zip or .mcpack pack and keep editing',
      '3D block preview, pack icon, description and Java compatibility range',
      'Exports a .zip with the correct pack.mcmeta for the Java version, or a Bedrock .mcpack',
    ],
    features: [
      ['Every vanilla texture of the version you pick, with search and categories.'],
      ['A full pixel editor: pencil, eraser, fill, eyedropper, line, shapes, noise, selection, mirror painting and undo/redo, with tiled preview and zoom.'],
      ['Upload your own PNGs (auto-resized to the texture, 16x up to 512x) and edit animated textures frame by frame.'],
      ['One-click whole-pack effects such as Dark Mode, Pastel, Neon Outline, Retro 8-bit, Autumn, Winter, Noir, Cartoon and Smooth HD, stacked without changing your own edits.'],
      ['Open an existing ', code('.zip'), ' or ', code('.mcpack'), ' and keep editing.'],
      ['A 3D block preview, pack icon, description and a Java compatibility range.'],
      ['Exports a ', code('.zip'), ' with the exact ', code('pack.mcmeta'), ' rules of your Java version, or a Bedrock ', code('.mcpack'), '.'],
    ],
    howTitle: 'How to make a texture pack here',
    steps: [
      ['Choose ', strong('Java'), ' or ', strong('Bedrock'), ' and a version. Java 26.3 is selected by default.'],
      'Your browser downloads that version’s textures straight from Mojang and keeps them on this device for next time.',
      'Pick a texture from the list and paint it, or upload your own image.',
      'Add effects, a pack icon and a description if you like.',
      ['Export. On Java, put the ', code('.zip'), ' in the ', code('resourcepacks'), ' folder; on Bedrock, open the ', code('.mcpack'), ' to import it.'],
    ],
    faq: [
      {
        id: 'versions',
        q: 'Which Minecraft versions can I make a texture pack for?',
        a: [
          el(
            'p',
            null,
            'Java 26.3 is the default, and every Java release back to 1.6.1 (the first version with resource packs) works, plus snapshots if you switch them on. For Bedrock you can use the latest release, the latest preview and older versions.',
          ),
        ],
      },
      {
        id: 'format',
        q: 'What pack format does Java 26.3 use?',
        a: [
          el(
            'p',
            null,
            `Resource pack format ${f263}. Since 1.21.9 a pack declares `,
            code('min_format'),
            ' and ',
            code('max_format'),
            ' in ',
            code('pack.mcmeta'),
            ' instead of a single number; the maker writes the right fields for the version you choose. ',
            link('/guides/minecraft-pack-format-versions', 'Formats of every version'),
            '.',
          ),
        ],
      },
      {
        id: 'existing',
        q: 'Can I edit a texture pack I already have?',
        a: [el('p', null, 'Yes. Choose ', strong('Open a pack'), ' and pick a Java ', code('.zip'), ' or Bedrock ', code('.mcpack'), '. The edition and version are detected from the pack.')],
      },
      {
        id: 'older',
        q: 'Why does Minecraft say my pack is made for an older or newer version?',
        a: [
          el(
            'p',
            null,
            'Java compares the pack format in ',
            code('pack.mcmeta'),
            ' with its own. Export again for the version you play, or widen the compatibility range. Texture-only packs usually still work if you click Yes. ',
            link('/guides/install-resource-packs', 'Install and troubleshooting guide'),
            '.',
          ),
        ],
      },
    ],
    guides: ['make-a-texture-pack', 'install-resource-packs', 'minecraft-pack-format-versions', 'java-vs-bedrock-packs'],
    cta: 'Start a texture pack',
  },
  skins: {
    tool: 'skins',
    accent: 'accent-blue',
    icon: 'human',
    eyebrow: 'Skins',
    heading: 'Make a custom Minecraft skin online',
    appName: 'Minecraft Skin Editor',
    lead: [
      'Paint your character on the standard skin template while a 3D model updates live, then use it in ',
      strong('Java'),
      ' or ',
      strong('Bedrock'),
      '. Free, with no account needed.',
    ],
    featureList: [
      'Paint on the 64×64 skin template with part outlines and a live 3D preview',
      'Classic (4-pixel arms) and slim (3-pixel arms) models',
      'True body mirroring: paint the left arm and the right arm follows',
      'Per-part locking and separate base and outer layer editing',
      'Start from a blank skin, a colour-coded template, starter characters, an uploaded PNG, a Java player name or the default skins from the game files',
      'Legacy 64×32 skins are converted when you open them',
      'Export a Java PNG (plus legacy 64×32) or a Bedrock skin pack (.mcpack)',
    ],
    features: [
      ['Paint on the 64×64 template with part outlines and a live 3D preview.'],
      ['Classic (4-pixel arms) and slim (3-pixel arms) models.'],
      ['True mirroring: paint the left arm and the right arm follows. Lock body parts and edit the base or outer layer on its own.'],
      ['Start from a blank skin, a colour-coded template, original starter characters, an uploaded PNG, any Java player’s skin by username, or the default skins from the game files.'],
      ['Legacy 64×32 skins are converted to 64×64 when you open them.'],
      ['Export a Java ', code('.png'), ' (plus a legacy 64×32 copy for 1.7.10 and older) or a Bedrock skin pack ', code('.mcpack'), '.'],
    ],
    howTitle: 'How to make a skin here',
    steps: [
      'Pick a starting point and the arm style (classic or slim).',
      'Paint on the template or right onto the 3D model. Use the outer layer for hats, jackets, sleeves and other details that stick out.',
      'Turn the 3D preview around to check every side.',
      ['Export a ', code('.png'), ' for Java or a skin pack ', code('.mcpack'), ' for Bedrock.'],
      ['Java: add it in the Minecraft Launcher under ', strong('Skins'), '. Bedrock: open the ', code('.mcpack'), ', then choose it in the Dressing Room.'],
    ],
    faq: [
      {
        id: 'size',
        q: 'What size is a Minecraft skin?',
        a: [el('p', null, 'A 64×64 pixel PNG. Java 1.7.10 and older use the old 64×32 layout, and Bedrock also accepts 128×128 HD skins.')],
      },
      {
        id: 'slim',
        q: 'What is the difference between classic and slim skins?',
        a: [el('p', null, 'Only the arms: classic (Steve) arms are 4 pixels wide and slim (Alex) arms are 3 pixels wide. Choose the same model when you upload the skin, or the arms will look stretched or cut off.')],
      },
      {
        id: 'bedrock',
        q: 'How do I use my skin on Bedrock?',
        a: [
          el(
            'p',
            null,
            'Export a Bedrock skin pack and open the ',
            code('.mcpack'),
            '; it appears under Classic Skins in the Dressing Room. You can also import a single PNG there. Consoles cannot import skin files. ',
            link('/guides/make-a-skin', 'Full skin guide'),
            '.',
          ),
        ],
      },
      {
        id: 'trusted',
        q: 'Why do my friends see a default skin?',
        a: [el('p', null, 'On Bedrock, players who turn on ', strong('Only Allow Trusted Skins'), ' see custom skins as default ones. It is a setting on their side.')],
      },
    ],
    guides: ['make-a-skin', 'install-resource-packs', 'java-vs-bedrock-packs'],
    cta: 'Start a skin',
  },
  shaders: {
    tool: 'shaders',
    accent: 'accent-purple',
    icon: 'sparkles',
    eyebrow: 'Shaders',
    heading: 'Make Minecraft shaders online',
    appName: 'Minecraft Shader Maker',
    lead: ['Choose where you play, pick a preset, move a few sliders and watch a live 3D preview with a day and night cycle. Then export a pack that is ready to drop into the game.'],
    featureList: [
      'Iris / OptiFine shader packs for Java: shadows, waving plants, water, bloom, god rays, tone mapping and colour grading',
      'Vanilla Java shaders without mods: colour grading, vignette, fog and, on 26.3 and newer, bloom',
      'Bedrock Vibrant Visuals packs: lighting, sky, fog, water and colour grading',
      'Presets, grouped sliders and a live 3D preview with a day/night cycle',
      'Every generated shader is compile-checked',
    ],
    features: [
      [strong('Iris / OptiFine shader packs'), ' (Java, needs the mod): real shadows, waving plants, water, bloom, god rays, tone mapping and colour grading, all adjustable in game too. Iris covers Java 1.16.5 to 26.3; OptiFine goes up to 26.2.'],
      [strong('Vanilla Java, no mods:'), ' a resource pack that patches your version’s own shaders for colour grading, vignette, fog and, on 26.3 and newer, full-screen bloom. Needs Java 1.17 or newer.'],
      [strong('Bedrock Vibrant Visuals:'), ' a settings pack for sunlight, sky, fog, water and colour grading on devices that support Vibrant Visuals.'],
      ['Presets, grouped sliders and a live 3D preview with a day/night cycle. Every generated shader is compile-checked.'],
    ],
    howTitle: 'How to make a shader here',
    steps: [
      'Choose a target: Iris / OptiFine, Vanilla Java or Bedrock Vibrant Visuals.',
      'Pick a preset as a starting point.',
      'Adjust lighting, colour, fog and water with the sliders while the preview updates.',
      ['Export a ', code('.zip'), ' (Java) or ', code('.mcpack'), ' (Bedrock).'],
      'Install it: shader pack folder for Iris or OptiFine, resource pack folder for vanilla shaders, or open the .mcpack on Bedrock.',
    ],
    faq: [
      {
        id: 'mods',
        q: 'Do I need mods to use shaders?',
        a: [
          el(
            'p',
            null,
            'Only for Iris / OptiFine packs. Vanilla Java shader packs are ordinary resource packs (Java 1.17 and newer), and Bedrock Vibrant Visuals packs work in the normal game. ',
            link('/guides/make-shaders-without-mods', 'Shaders without mods'),
            '.',
          ),
        ],
      },
      {
        id: 'update',
        q: 'Why did my vanilla shader pack stop working after an update?',
        a: [el('p', null, 'Mojang changes the shader files often, so a vanilla shader pack only works on the version it was made for. Open your project, pick the new version and export again.')],
      },
      {
        id: 'bedrock',
        q: 'Can Bedrock use real shader packs?',
        a: [
          el(
            'p',
            null,
            'Not with custom shader code: that stopped working when Bedrock moved to the RenderDragon engine. Vibrant Visuals packs instead tune the built-in lighting, sky, fog, water and colour grading. ',
            link('/guides/bedrock-vibrant-visuals-settings', 'Vibrant Visuals settings explained'),
            '.',
          ),
        ],
      },
      {
        id: 'vulkan',
        q: 'Iris says it cannot run with Vulkan. What do I do?',
        a: [el('p', null, 'Java 26.2 and newer can use an experimental Vulkan renderer, but Iris needs OpenGL. Set ', strong('Graphics API'), ' in Minecraft’s options to ', strong('Default'), ' or ', strong('Prefer OpenGL'), '.')],
      },
    ],
    guides: ['make-shaders-without-mods', 'bedrock-vibrant-visuals-settings', 'install-resource-packs'],
    cta: 'Start a shader',
  },
};

/**
 * The introduction as a page section. `prerender` renders it as the whole page content (h1, and a
 * link to the tool itself); otherwise it sits below the tool's own start screen (h2).
 */
export function toolIntro(tool: IntroTool, opts: { prerender: boolean }): ElNode {
  const t = TOOL_INTROS[tool];
  const meta = TOOL_META[tool];
  const H = opts.prerender ? 'h1' : 'h2';
  const sub = opts.prerender ? 'h2' : 'h3';
  return el(
    'section',
    { class: ['tool-intro', 'container', t.accent, opts.prerender ? null : 'is-below'], 'aria-labelledby': `intro-${tool}-title`, 'data-tool-intro': tool },
    breadcrumbs([{ label: 'Home', to: '/' }, { label: meta.label }]),
    el(
      'header',
      { class: 'tool-intro-head' },
      el('span', { class: 'eyebrow' }, ic(t.icon), t.eyebrow),
      el(H, { id: `intro-${tool}-title`, class: opts.prerender ? 'pixel-shadow' : null }, t.heading),
      el('p', { class: 'lead' }, t.lead),
      opts.prerender
        ? el(
            'noscript',
            null,
            el('p', { class: 'tool-intro-noscript' }, 'The editor needs JavaScript. Turn it on to start making; the guides on this page work without it.'),
          )
        : null,
    ),
    el(
      'div',
      { class: 'tool-intro-grid' },
      el(
        'div',
        { class: 'tool-intro-card' },
        el(sub, null, 'What you can do'),
        el(
          'ul',
          { class: 'tool-intro-list' },
          t.features.map((f) => el('li', null, ic('check'), el('span', null, f))),
        ),
      ),
      el('div', { class: 'tool-intro-card' }, el(sub, null, t.howTitle), steps(t.steps)),
    ),
    t.extra ?? null,
    el('div', { class: 'tool-intro-faq' }, el(sub, null, 'Questions'), el('div', { class: 'tool-intro-card flush' }, faqList(t.faq, { idPrefix: `${tool}-faq` }))),
    el('div', { class: 'tool-intro-guides' }, el(sub, null, 'Guides'), guideCards(t.guides, opts.prerender ? 'h3' : 'h4', 2)),
  );
}
