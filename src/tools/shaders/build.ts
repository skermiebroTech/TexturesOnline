// Building the final pack files of a target (the export dialog loads this with the editor, so the
// start screen doesn't carry it).

import type { FileMap, OptionValues, PackFormat, Progress, ShaderTarget } from '../../core/types';
import { DEFAULT_JAVA_VERSION, loadAssets } from '../../editions/versions';
import { buildPackMcmetaForVersions, getJavaPackFormat } from '../../editions/java/packmeta';
import { uuidv4 } from '../../core/uuid';
import { fmt } from '../../i18n/editor-text';
import type { AnyGenerator, BedrockGenerator, IrisGenerator, VanillaGenerator } from './ui/generator';
import type { ShaderProjectData } from './ui/project';
import { targetInfo } from './targets';
import { t } from './i18n/text';
import { et } from './ui/i18n/editor';

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
      { id: 'assets', label: fmt(et.build.assets, { version }) },
      { id: 'patch', label: et.build.patch },
      { id: 'pack', label: et.build.packMcmeta },
      { id: 'zip', label: et.build.zip },
    ];
  }
  if (target === 'bedrock-vibrant') {
    return [
      { id: 'generate', label: et.build.vvSettings },
      { id: 'pack', label: et.build.vvManifest },
      { id: 'zip', label: et.build.vvPackage },
    ];
  }
  return [
    { id: 'generate', label: et.build.irisPrograms },
    { id: 'zip', label: et.build.zip },
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
  return p.name.trim() || t.myShaders;
}

const TEXT_SOURCE = /\.(vsh|fsh|gsh|csh|glsl|json|txt|mcmeta|properties)$/i;

async function buildIris(gen: IrisGenerator, ctx: BuildContext): Promise<BuildResult> {
  ctx.step({ id: 'generate', label: et.build.irisPrograms });
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
    throw new BuildError(et.build.irisFailed, 'generator');
  }
  if (!Object.keys(files).some((k) => k.startsWith('shaders/'))) throw new BuildError(et.build.noShadersFolder, 'generator');
  return {
    files,
    filename: `${packName(ctx.project)}.zip`,
    warnings: [],
  };
}

async function buildVanilla(gen: VanillaGenerator, ctx: BuildContext): Promise<BuildResult> {
  const version = ctx.project.version || DEFAULT_JAVA_VERSION;
  const early = gen.supportedFor?.(version);
  if (early && !early.supported) throw new BuildError(early.notes[0] ?? et.build.noShaders, 'unsupported');

  ctx.step({ id: 'assets', label: fmt(et.build.assets, { version }) });
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
    throw new BuildError(err instanceof Error && err.message ? err.message : fmt(et.build.filesFailed, { version }), 'assets');
  }
  throwIfAborted(ctx.signal);

  ctx.step({ id: 'patch', label: et.build.patch });
  const packFormat: PackFormat | null = await getJavaPackFormat(version).catch(() => null);
  if (!packFormat) throw new BuildError(fmt(et.build.noPackFormat, { version }), 'assets');
  let result: ReturnType<VanillaGenerator['generateVanillaShaderFiles']>;
  try {
    result = gen.generateVanillaShaderFiles(sources, ctx.settings, { versionId: version, packFormat, preset: ctx.project.preset });
  } catch (err) {
    console.error(err);
    throw new BuildError(fmt(et.build.patchFailed, { version }), 'generator');
  }
  if (!result.supported) throw new BuildError(result.warnings[0] ?? et.build.noShadersVersion, 'unsupported');

  ctx.step({ id: 'pack', label: et.build.packMcmeta });
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
  ctx.step({ id: 'generate', label: et.build.vvSettings });
  let files: FileMap;
  try {
    files = { ...gen.generateBedrockVisuals(ctx.settings, { version: ctx.project.version, preset: ctx.project.preset }) };
  } catch (err) {
    console.error(err);
    throw new BuildError(et.build.vvFailed, 'generator');
  }

  ctx.step({ id: 'pack', label: et.build.vvManifest });
  // The manifest writer comes with the image codecs: loaded on export, not with the start screen.
  const { buildResourceManifest, bumpPackVersion } = await import('../../editions/bedrock/manifest');
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
    warnings.push(...problems.slice(0, 5).map((p) => fmt(et.build.check, { problem: p })));
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
    throw new BuildError(err instanceof Error ? err.message : fmt(et.build.makerFailed, { target: info.shortName }), 'generator');
  }
  throwIfAborted(ctx.signal);
  if (gen.kind === 'iris') return buildIris(gen, ctx);
  if (gen.kind === 'java-vanilla') return buildVanilla(gen, ctx);
  return buildBedrock(gen, ctx);
}
