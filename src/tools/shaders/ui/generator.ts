// Typed access to the three shader generator modules. Each one is loaded on demand (its own chunk),
// checked for the exports the view needs, and wrapped so a missing optional export never breaks the UI.

import type { FileMap, OptionDef, OptionValue, OptionValues, PackFormat, PreviewParams, ShaderTarget } from '../../../core/types';

export interface ShaderPresetDef {
  id: string;
  label: string;
  description: string;
  values: Partial<OptionValues>;
  swatch: [string, string];
}

export interface BaseGenerator {
  OPTIONS: OptionDef[];
  PRESETS: ShaderPresetDef[];
  defaults(): OptionValues;
  toPreviewParams(v: OptionValues): PreviewParams;
  normalizeOptions?(v: Partial<OptionValues>): OptionValues;
}

export interface IrisGenerator extends BaseGenerator {
  kind: 'iris';
  generateIrisPack(v: OptionValues, meta: { name: string; description: string }): FileMap;
  IRIS_NOTES?: readonly NoteDef[];
}

/** What the vanilla generator reports about one Java version (subset of its VanillaSupport). */
export interface VanillaSupportInfo {
  supported: boolean;
  known?: boolean;
  packFormat?: number | null;
  family?: string | null;
  features?: Record<string, boolean>;
  options: Record<string, boolean>;
  reasons: Record<string, string>;
  notes: string[];
}

export interface VanillaGenerator extends BaseGenerator {
  kind: 'java-vanilla';
  generateVanillaShaderFiles(
    sources: Record<string, string>,
    v: OptionValues,
    info: { versionId: string; packFormat: PackFormat },
  ): { files: FileMap; warnings: string[]; supported: boolean };
  shaderSourcePrefixes: readonly string[];
  supportedFor?(target: PackFormat | number | string): VanillaSupportInfo;
  supportFromSources?(sources: Record<string, string>, packFormat: PackFormat | number | null | undefined): VanillaSupportInfo;
  vanillaPackDescription?(versionId: string, name?: string): string;
}

export interface NoteDef {
  id: string;
  title: string;
  text: string;
}
export type BedrockNoteDef = NoteDef;

export interface BedrockGenerator extends BaseGenerator {
  kind: 'bedrock-vibrant';
  generateBedrockVisuals(v: OptionValues): FileMap;
  bedrockManifestOptions?(v: OptionValues): { capabilities: string[]; minEngine: [number, number, number] };
  BEDROCK_VV_NOTES?: readonly BedrockNoteDef[];
  bedrockCompatibilityNotes?(v: OptionValues): string[];
  validateBedrockVisuals?(files: FileMap): string[];
}

export type AnyGenerator = IrisGenerator | VanillaGenerator | BedrockGenerator;
export type GeneratorFor<T extends ShaderTarget> = Extract<AnyGenerator, { kind: T }>;

export class GeneratorUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeneratorUnavailableError';
  }
}

// A glob keeps each generator in its own lazily loaded chunk and tolerates a module that is missing
// from a build (the target then shows a friendly "not available" state instead of a crash).
const MODULES = import.meta.glob(['../iris/index.ts', '../vanilla/index.ts', '../bedrock/index.ts']);

const PATHS: Record<ShaderTarget, string> = {
  iris: '../iris/index.ts',
  'java-vanilla': '../vanilla/index.ts',
  'bedrock-vibrant': '../bedrock/index.ts',
};

const NAMES: Record<ShaderTarget, string> = {
  iris: 'Iris / OptiFine',
  'java-vanilla': 'Vanilla Java',
  'bedrock-vibrant': 'Vibrant Visuals',
};

const FALLBACK_PREFIXES = ['assets/minecraft/shaders/', 'assets/minecraft/post_effect/'];

const cache = new Map<ShaderTarget, Promise<AnyGenerator>>();

type Mod = Record<string, unknown>;

const isFn = (x: unknown): x is (...args: never[]) => unknown => typeof x === 'function';

function checkBase(target: ShaderTarget, mod: Mod, extra: string): void {
  const missing: string[] = [];
  if (!Array.isArray(mod.OPTIONS) || !mod.OPTIONS.length) missing.push('OPTIONS');
  if (!isFn(mod.defaults)) missing.push('defaults');
  if (!isFn(mod.toPreviewParams)) missing.push('toPreviewParams');
  if (!isFn(mod[extra])) missing.push(extra);
  if (missing.length) {
    throw new GeneratorUnavailableError(`The ${NAMES[target]} maker isn't ready in this version of the site (missing ${missing.join(', ')}). Please try again later.`);
  }
}

function presetsOf(mod: Mod): ShaderPresetDef[] {
  const raw = Array.isArray(mod.PRESETS) ? (mod.PRESETS as unknown[]) : [];
  const out: ShaderPresetDef[] = [];
  for (const p of raw) {
    if (!p || typeof p !== 'object') continue;
    const r = p as Partial<ShaderPresetDef>;
    if (typeof r.id !== 'string' || typeof r.label !== 'string') continue;
    const swatch: [string, string] =
      Array.isArray(r.swatch) && typeof r.swatch[0] === 'string' && typeof r.swatch[1] === 'string' ? [r.swatch[0], r.swatch[1]] : ['#5b6b8c', '#b07cff'];
    out.push({ id: r.id, label: r.label, description: typeof r.description === 'string' ? r.description : '', values: (r.values ?? {}) as Partial<OptionValues>, swatch });
  }
  if (!out.some((p) => p.id === 'default')) out.unshift({ id: 'default', label: 'Default', description: 'The standard look. A clean starting point.', values: {}, swatch: ['#5b6b8c', '#9fb6d9'] });
  return out;
}

function notesOf(x: unknown): NoteDef[] | undefined {
  if (!Array.isArray(x)) return undefined;
  return x.filter((n): n is NoteDef => !!n && typeof n === 'object' && typeof (n as NoteDef).text === 'string' && typeof (n as NoteDef).title === 'string');
}

function wrap(target: ShaderTarget, mod: Mod): AnyGenerator {
  const base: BaseGenerator = {
    OPTIONS: mod.OPTIONS as OptionDef[],
    PRESETS: presetsOf(mod),
    defaults: mod.defaults as () => OptionValues,
    toPreviewParams: mod.toPreviewParams as (v: OptionValues) => PreviewParams,
    normalizeOptions: isFn(mod.normalizeOptions) ? (mod.normalizeOptions as (v: Partial<OptionValues>) => OptionValues) : undefined,
  };
  if (target === 'iris') {
    checkBase(target, mod, 'generateIrisPack');
    return { ...base, kind: 'iris', generateIrisPack: mod.generateIrisPack as IrisGenerator['generateIrisPack'], IRIS_NOTES: notesOf(mod.IRIS_NOTES) };
  }
  if (target === 'java-vanilla') {
    checkBase(target, mod, 'generateVanillaShaderFiles');
    const prefixes = Array.isArray(mod.shaderSourcePrefixes) && mod.shaderSourcePrefixes.length ? (mod.shaderSourcePrefixes as string[]) : FALLBACK_PREFIXES;
    return {
      ...base,
      kind: 'java-vanilla',
      generateVanillaShaderFiles: mod.generateVanillaShaderFiles as VanillaGenerator['generateVanillaShaderFiles'],
      shaderSourcePrefixes: prefixes,
      supportedFor: isFn(mod.supportedFor) ? (mod.supportedFor as VanillaGenerator['supportedFor']) : undefined,
      supportFromSources: isFn(mod.supportFromSources) ? (mod.supportFromSources as VanillaGenerator['supportFromSources']) : undefined,
      vanillaPackDescription: isFn(mod.vanillaPackDescription) ? (mod.vanillaPackDescription as VanillaGenerator['vanillaPackDescription']) : undefined,
    };
  }
  checkBase(target, mod, 'generateBedrockVisuals');
  const notes = notesOf(mod.BEDROCK_VV_NOTES);
  return {
    ...base,
    kind: 'bedrock-vibrant',
    generateBedrockVisuals: mod.generateBedrockVisuals as BedrockGenerator['generateBedrockVisuals'],
    bedrockManifestOptions: isFn(mod.bedrockManifestOptions) ? (mod.bedrockManifestOptions as BedrockGenerator['bedrockManifestOptions']) : undefined,
    BEDROCK_VV_NOTES: notes,
    bedrockCompatibilityNotes: isFn(mod.bedrockCompatibilityNotes) ? (mod.bedrockCompatibilityNotes as BedrockGenerator['bedrockCompatibilityNotes']) : undefined,
    validateBedrockVisuals: isFn(mod.validateBedrockVisuals) ? (mod.validateBedrockVisuals as BedrockGenerator['validateBedrockVisuals']) : undefined,
  };
}

/** Loads (once) the generator for a target. Rejects with a friendly message when it can't be used. */
export function loadGenerator<T extends ShaderTarget>(target: T): Promise<GeneratorFor<T>> {
  let p = cache.get(target);
  if (!p) {
    const loader = MODULES[PATHS[target]];
    p = loader
      ? loader().then((m) => wrap(target, m as Mod))
      : Promise.reject(new GeneratorUnavailableError(`The ${NAMES[target]} maker isn't part of this version of the site yet.`));
    p.catch(() => cache.delete(target));
    cache.set(target, p);
  }
  return p as Promise<GeneratorFor<T>>;
}

export function isGeneratorAvailable(target: ShaderTarget): boolean {
  return Boolean(MODULES[PATHS[target]]);
}

// ---------------------------------------------------------------------------------------------
// Settings helpers

function sameKind(def: OptionDef, v: OptionValue): boolean {
  if (def.type === 'range') return typeof v === 'number' && Number.isFinite(v);
  if (def.type === 'toggle') return typeof v === 'boolean';
  if (def.type === 'color') return typeof v === 'string' && /^#?[0-9a-f]{3}([0-9a-f]{3})?$/i.test(v.trim());
  if (def.type === 'select') return typeof v === 'string' && (!def.options || def.options.some((o) => o.value === v));
  return typeof v === typeof def.default;
}

/** Every option present with a valid value (defaults fill gaps, e.g. options added after the project was saved). */
export function normalizeSettings(gen: BaseGenerator, v: Partial<OptionValues> | null | undefined): OptionValues {
  const out = gen.defaults();
  if (v && typeof v === 'object') {
    for (const def of gen.OPTIONS) {
      const val = v[def.key];
      if (val !== undefined && sameKind(def, val)) {
        out[def.key] = def.type === 'range' ? Math.min(def.max ?? Infinity, Math.max(def.min ?? -Infinity, val as number)) : val;
      }
    }
  }
  if (gen.normalizeOptions) {
    try {
      return { ...out, ...gen.normalizeOptions(out) };
    } catch {
      /* keep our own normalisation */
    }
  }
  return out;
}

/** Defaults with one preset applied. */
export function presetSettings(gen: BaseGenerator, presetId: string): OptionValues {
  const p = gen.PRESETS.find((x) => x.id === presetId);
  const base: Partial<OptionValues> = { ...gen.defaults() };
  if (p) for (const [k, v] of Object.entries(p.values)) if (v !== undefined) base[k] = v;
  return normalizeSettings(gen, base);
}

export function valuesEqual(a: OptionValue | undefined, b: OptionValue | undefined): boolean {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-9;
  if (typeof a === 'string' && typeof b === 'string') return a.toLowerCase() === b.toLowerCase();
  return a === b;
}

export function settingsEqual(gen: BaseGenerator, a: OptionValues, b: OptionValues): boolean {
  return gen.OPTIONS.every((d) => valuesEqual(a[d.key], b[d.key]));
}

/** Id of the preset the settings match exactly, or null when customised. */
export function matchingPreset(gen: BaseGenerator, v: OptionValues): string | null {
  for (const p of gen.PRESETS) if (settingsEqual(gen, v, presetSettings(gen, p.id))) return p.id;
  return null;
}

/** Keys whose value differs from the generator default. */
export function changedKeys(gen: BaseGenerator, v: OptionValues): Set<string> {
  const d = gen.defaults();
  return new Set(gen.OPTIONS.filter((o) => !valuesEqual(v[o.key], d[o.key])).map((o) => o.key));
}
