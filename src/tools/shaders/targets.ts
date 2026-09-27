// The three things the Shader Maker can build: what each one is, what it needs, how to install it,
// and how its final pack files are put together.

import type { Edition, FileMap, OptionValues, PackFormat, Progress, ShaderTarget } from '../../core/types';
import type { IconName } from '../../ui/icons';
import {
  DEFAULT_JAVA_VERSION,
  buildPackMcmetaForVersions,
  buildResourceManifest,
  bumpPackVersion,
  getJavaPackFormat,
  loadAssets,
} from '../../editions/index';
import { uuidv4 } from '../../core/uuid';
import { loadGenerator, type AnyGenerator, type BedrockGenerator, type IrisGenerator, type VanillaGenerator } from './ui/generator';
import type { ShaderProjectData } from './ui/project';

export interface InstallStep {
  text: string;
  /** Menu path shown as "A > B > C" */
  path?: string[];
}

export interface ShaderTargetInfo {
  id: ShaderTarget;
  name: string;
  shortName: string;
  edition: Edition;
  needsMods: boolean;
  icon: IconName;
  tagline: string;
  /** Who it is for, one line */
  bestFor: string;
  gets: string[];
  limits: string[];
  install: InstallStep[];
  fileExt: '.zip' | '.mcpack';
  /** Where the file goes, in words */
  installPlace: string;
  /** Section id on the help page */
  helpSection: string;
  /** Preset + time of day used for the start-screen picture */
  showcase: { preset: string; timeOfDay: number };
  /** Label for the "before" side of the compare button */
  compareLabel: string;
  defaultVersion: string;
  load(): Promise<AnyGenerator>;
}

export const TARGETS: readonly ShaderTargetInfo[] = [
  {
    id: 'iris',
    name: 'Iris / OptiFine shader pack',
    shortName: 'Iris / OptiFine',
    edition: 'java',
    needsMods: true,
    icon: 'sparkles',
    tagline: 'The full shader look: real shadows, waving plants, shiny water, bloom and god rays.',
    bestFor: 'Java players who use (or can install) the Iris or OptiFine mod.',
    gets: [
      'Real sun and moon shadows',
      'Waving leaves, grass and crops',
      'Rippling, reflective water',
      'Bloom, god rays and color grading',
      'An in-game settings menu to fine-tune it',
    ],
    limits: [
      'Needs the free Iris mod (recommended) or OptiFine',
      'Iris: Java 1.16.5 to 26.3. OptiFine: up to 26.2',
      'Uses more graphics power than the no-mod options',
    ],
    install: [
      { text: 'Install Iris with the Iris Installer from irisshaders.dev, then play the Iris profile once.' },
      { text: 'Open the shader pack folder and drop the .zip in (keep it zipped).', path: ['Options', 'Video Settings', 'Shader Packs', 'Open Shader Pack Folder'] },
      { text: 'Pick your pack and click Apply. Shader Pack Settings lets you fine-tune it in game.' },
    ],
    fileExt: '.zip',
    installPlace: 'Goes in .minecraft/shaderpacks',
    helpSection: 'iris',
    showcase: { preset: 'golden', timeOfDay: 11600 },
    compareLabel: 'Without shaders',
    defaultVersion: DEFAULT_JAVA_VERSION,
    load: () => loadGenerator('iris'),
  },
  {
    id: 'java-vanilla',
    name: 'Vanilla Java (no mods)',
    shortName: 'Vanilla Java',
    edition: 'java',
    needsMods: false,
    icon: 'sun',
    tagline: "A resource pack that tweaks Minecraft's own shaders. Works in the normal game.",
    bestFor: 'Java players who want a new look without installing anything.',
    gets: [
      'Brightness, contrast, color and warmth',
      'Vignette, black & white, sepia and retro looks',
      'Bloom glow (Java 26.3 and newer)',
      'Misty fog and darker nights',
      'Waving plants on some versions',
    ],
    limits: [
      'Made for one exact version: pick yours (26.3 by default)',
      'No real shadows or reflections (those need Iris)',
      'Needs Java 1.17 or newer',
    ],
    install: [
      { text: 'Open the resource pack folder and drop the .zip in.', path: ['Options', 'Resource Packs', 'Open Pack Folder'] },
      { text: 'Move the pack to Selected and click Done. The new look applies right away.' },
      { text: 'Updated Minecraft? Pick the new version here and export again.' },
    ],
    fileExt: '.zip',
    installPlace: 'Goes in .minecraft/resourcepacks',
    helpSection: 'vanilla-shaders',
    showcase: { preset: 'vivid', timeOfDay: 4200 },
    compareLabel: 'Plain Minecraft',
    defaultVersion: DEFAULT_JAVA_VERSION,
    load: () => loadGenerator('java-vanilla'),
  },
  {
    id: 'bedrock-vibrant',
    name: 'Bedrock Vibrant Visuals',
    shortName: 'Vibrant Visuals',
    edition: 'bedrock',
    needsMods: false,
    icon: 'cloud-sun',
    tagline: "Tune Bedrock's built-in Vibrant Visuals: sunlight, sky, fog, water and color.",
    bestFor: 'Bedrock players on Windows, Xbox, PlayStation or a recent phone or tablet.',
    gets: [
      'Sun, moon and sky colors',
      'Lighting, shadows and colored block light',
      'Fog and atmosphere',
      'Water color, waves and caustics',
      'Film-style color grading',
    ],
    limits: [
      'Needs a device that supports Vibrant Visuals',
      'Classic texture packs switch Vibrant Visuals off',
      "Bedrock doesn't allow custom shader code, so no waving plants",
    ],
    install: [
      { text: 'Open the .mcpack file. Minecraft imports it for you.' },
      { text: 'Activate the pack for every world.', path: ['Settings', 'Global Resources', 'My Packs'] },
      { text: 'Set Graphics Mode to Vibrant Visuals.', path: ['Settings', 'Video', 'Graphics Mode'] },
    ],
    fileExt: '.mcpack',
    installPlace: 'Open it and Minecraft imports it',
    helpSection: 'vibrant-visuals',
    showcase: { preset: 'vivid', timeOfDay: 7400 },
    compareLabel: 'Default Vibrant Visuals',
    defaultVersion: 'latest',
    load: () => loadGenerator('bedrock-vibrant'),
  },
];

export function targetInfo(id: ShaderTarget): ShaderTargetInfo {
  return TARGETS.find((t) => t.id === id) ?? TARGETS[0];
}

// ---------------------------------------------------------------------------------------------
// Building the final pack files

export interface BuildStep {
  id: string;
  label: string;
}

export interface BuildContext {
  project: ShaderProjectData;
  settings: OptionValues;
  signal?: AbortSignal;
  /** Moves to a new step (shown as a checklist) */
  step(s: BuildStep): void;
  /** Progress of the current step */
  progress(p: Progress | null): void;
  /** PNG bytes for the pack icon at the given size */
  packIcon(size: number): Promise<Uint8Array>;
  /** A client jar the user picked (vanilla, offline or when downloads fail) */
  jarFile?: File;
}

export interface BuildResult {
  files: FileMap;
  filename: string;
  warnings: string[];
  /** Project fields to store after a successful export (e.g. the bumped Bedrock version) */
  update?: Partial<ShaderProjectData>;
}

/** Steps each target goes through, so the dialog can show the whole checklist up front. */
export function buildSteps(target: ShaderTarget, version: string): BuildStep[] {
  if (target === 'java-vanilla') {
    return [
      { id: 'assets', label: `Get the Minecraft ${version} shader files` },
      { id: 'patch', label: 'Apply your settings to the shaders' },
      { id: 'pack', label: 'Add pack.mcmeta and icon' },
      { id: 'zip', label: 'Zip it up' },
    ];
  }
  if (target === 'bedrock-vibrant') {
    return [
      { id: 'generate', label: 'Write the Vibrant Visuals settings' },
      { id: 'pack', label: 'Add manifest and icon' },
      { id: 'zip', label: 'Package the .mcpack' },
    ];
  }
  return [
    { id: 'generate', label: 'Write the shader programs' },
    { id: 'zip', label: 'Zip it up' },
  ];
}

export class BuildError extends Error {
  constructor(
    message: string,
    readonly kind: 'unsupported' | 'assets' | 'generator' | 'other' = 'other',
  ) {
    super(message);
    this.name = 'BuildError';
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
}

function packName(p: ShaderProjectData): string {
  return p.name.trim() || 'My shaders';
}

const TEXT_SOURCE = /\.(vsh|fsh|gsh|csh|glsl|json|txt|mcmeta|properties)$/i;

async function buildIris(gen: IrisGenerator, ctx: BuildContext): Promise<BuildResult> {
  ctx.step({ id: 'generate', label: 'Write the shader programs' });
  let files: FileMap;
  try {
    files = gen.generateIrisPack(ctx.settings, {
      name: packName(ctx.project),
      description: ctx.project.description.trim(),
      version: ctx.project.version,
      preset: ctx.project.preset,
    });
  } catch (err) {
    console.error(err);
    throw new BuildError("The shader pack couldn't be generated with these settings. Try a preset, then export again.", 'generator');
  }
  if (!Object.keys(files).some((k) => k.startsWith('shaders/'))) throw new BuildError('The generated pack has no shaders folder.', 'generator');
  return {
    files,
    filename: `${packName(ctx.project)}.zip`,
    warnings: [],
  };
}

async function buildVanilla(gen: VanillaGenerator, ctx: BuildContext): Promise<BuildResult> {
  const version = ctx.project.version || DEFAULT_JAVA_VERSION;
  const early = gen.supportedFor?.(version);
  if (early && !early.supported) throw new BuildError(early.notes[0] ?? 'This Minecraft version has no shaders a resource pack can change.', 'unsupported');

  ctx.step({ id: 'assets', label: `Get the Minecraft ${version} shader files` });
  let sources: Record<string, string>;
  try {
    const assets = await loadAssets('java', version, { onProgress: ctx.progress, signal: ctx.signal, jarFile: ctx.jarFile });
    throwIfAborted(ctx.signal);
    const javaAssets = await import('../../editions/java/assets');
    const groups = [...new Set(gen.shaderSourcePrefixes.map((p) => javaAssets.javaGroupOf(`${p}x`)).filter((g): g is string => !!g))];
    await javaAssets.prefetchJavaGroups(assets, groups, { onProgress: ctx.progress, signal: ctx.signal });
    sources = {};
    for (const prefix of gen.shaderSourcePrefixes) {
      for (const path of assets.listFiles(prefix)) {
        if (TEXT_SOURCE.test(path)) sources[path] = await assets.readText(path);
      }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new BuildError(err instanceof Error && err.message ? err.message : `Couldn't get the Minecraft ${version} files.`, 'assets');
  }
  throwIfAborted(ctx.signal);

  ctx.step({ id: 'patch', label: 'Apply your settings to the shaders' });
  const packFormat: PackFormat | null = await getJavaPackFormat(version).catch(() => null);
  if (!packFormat) throw new BuildError(`Couldn't find the pack format for Minecraft ${version}. Check your connection and try again.`, 'assets');
  let result: ReturnType<VanillaGenerator['generateVanillaShaderFiles']>;
  try {
    result = gen.generateVanillaShaderFiles(sources, ctx.settings, { versionId: version, packFormat, preset: ctx.project.preset });
  } catch (err) {
    console.error(err);
    throw new BuildError(`The shaders of Minecraft ${version} couldn't be patched. Try another version, or report it so we can fix it.`, 'generator');
  }
  if (!result.supported) throw new BuildError(result.warnings[0] ?? 'This version has no shaders a resource pack can change.', 'unsupported');

  ctx.step({ id: 'pack', label: 'Add pack.mcmeta and icon' });
  const files: FileMap = { ...result.files };
  const desc = ctx.project.description.trim();
  const description = desc
    ? desc.includes(version)
      ? desc
      : `${desc} (Java ${version} only)`
    : (gen.vanillaPackDescription?.(version) ?? `Shaders for Java ${version} only. Made with Texture Pack Maker`);
  files['pack.mcmeta'] = await buildPackMcmetaForVersions(description, version);
  files['pack.png'] = await ctx.packIcon(128);
  return { files, filename: `${packName(ctx.project)}.zip`, warnings: result.warnings };
}

async function buildBedrock(gen: BedrockGenerator, ctx: BuildContext): Promise<BuildResult> {
  ctx.step({ id: 'generate', label: 'Write the Vibrant Visuals settings' });
  let files: FileMap;
  try {
    files = { ...gen.generateBedrockVisuals(ctx.settings, { version: ctx.project.version, preset: ctx.project.preset }) };
  } catch (err) {
    console.error(err);
    throw new BuildError("The Vibrant Visuals files couldn't be generated with these settings. Try a preset, then export again.", 'generator');
  }

  ctx.step({ id: 'pack', label: 'Add manifest and icon' });
  const uuids = ctx.project.bedrockUuids ?? { header: uuidv4(), module: uuidv4() };
  const version = bumpPackVersion(ctx.project.packVersion);
  const opts = gen.bedrockManifestOptions?.(ctx.settings) ?? { capabilities: ['pbr'], minEngine: [1, 21, 120] as [number, number, number] };
  const capabilities = opts.capabilities.includes('pbr') ? opts.capabilities : [...opts.capabilities, 'pbr'];
  files['manifest.json'] = buildResourceManifest({
    name: packName(ctx.project),
    description: ctx.project.description.trim() || 'Vibrant Visuals settings made with Texture Pack Maker',
    uuids,
    version,
    minEngine: opts.minEngine,
    capabilities,
  });
  files['pack_icon.png'] = await ctx.packIcon(256);
  const warnings: string[] = [];
  const problems = gen.validateBedrockVisuals?.(files) ?? [];
  if (problems.length) {
    console.warn('Vibrant Visuals validation', problems);
    warnings.push(...problems.slice(0, 5).map((p) => `Check: ${p}`));
  }
  return {
    files,
    filename: `${packName(ctx.project)}.mcpack`,
    warnings,
    update: { bedrockUuids: uuids, packVersion: version },
  };
}

/** Generates every file of the final pack (not zipped yet). */
export async function buildPackFiles(ctx: BuildContext): Promise<BuildResult> {
  const info = targetInfo(ctx.project.target);
  let gen: AnyGenerator;
  try {
    gen = await info.load();
  } catch (err) {
    throw new BuildError(err instanceof Error ? err.message : `The ${info.shortName} maker couldn't load.`, 'generator');
  }
  throwIfAborted(ctx.signal);
  if (gen.kind === 'iris') return buildIris(gen, ctx);
  if (gen.kind === 'java-vanilla') return buildVanilla(gen, ctx);
  return buildBedrock(gen, ctx);
}
