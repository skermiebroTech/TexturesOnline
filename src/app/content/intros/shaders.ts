// The shader maker's introduction in English, loaded on its own pages only (see ToolIntro
// in src/app/content/tools.ts).

import { el } from '../../markup';
import { code, figure, link, strong } from '../blocks';
import { SHOTS } from '../shots';
import type { ToolIntroBody } from '../tools';

export const INTRO: ToolIntroBody = {
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
  extra: () => [el('div', { class: 'tool-intro-grid' }, figure(SHOTS.shaderIris), figure(SHOTS.vibrantVisuals))],
  guides: ['make-shaders-without-mods', 'bedrock-vibrant-visuals-settings', 'install-resource-packs'],
  cta: 'Start a shader',
};
