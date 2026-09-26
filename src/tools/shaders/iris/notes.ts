// Short explanations the shader maker view can show next to the Iris / OptiFine export.

export interface IrisNote {
  id: 'what' | 'loaders' | 'install' | 'settings' | 'vulkan' | 'performance';
  title: string;
  text: string;
}

export const IRIS_NOTES: readonly IrisNote[] = [
  {
    id: 'what',
    title: 'What you get',
    text: 'A shader pack .zip with soft shadows, waving plants, water waves and reflections, fog, bloom, god rays and color grading. Every slider you set here is also adjustable in game.',
  },
  {
    id: 'loaders',
    title: 'Works with',
    text: 'Iris (with Sodium) for Minecraft 1.16.5 and newer, including 26.x, and OptiFine for Minecraft 1.8.9 up to the newest version it supports.',
  },
  {
    id: 'install',
    title: 'Install',
    text: 'Open Options > Video Settings > Shader Packs, click "Open Shader Pack Folder", drop the .zip in (do not unzip it) and select the pack.',
  },
  {
    id: 'settings',
    title: 'Changing settings later',
    text: 'Use Shader Options in game. Settings changed in game are kept for the same file name; press Reset there to use the defaults of a newly exported version.',
  },
  {
    id: 'vulkan',
    title: 'Minecraft 26.2 and newer',
    text: 'Shader packs need the OpenGL renderer: set Video Settings > Graphics API to "Default" or "Prefer OpenGL".',
  },
  {
    id: 'performance',
    title: 'Frame rate',
    text: 'Shadows cost the most. Use the Performance preset here, or the Low profile in game, on slower computers.',
  },
];

/** Minimum game versions per loader, for version pickers and hints. */
export const IRIS_SUPPORT = {
  iris: { minVersion: '1.16.5' },
  optifine: { minVersion: '1.8.9' },
} as const;
