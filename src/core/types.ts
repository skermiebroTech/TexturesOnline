// Shared contracts used across the whole app. Keep this file dependency-free.

export type Edition = 'java' | 'bedrock';

export interface Progress {
  /** Short human readable label, e.g. "Downloading Minecraft 26.3" */
  label: string;
  /** 0..1, or null when indeterminate */
  fraction: number | null;
  loaded?: number;
  total?: number;
}
export type ProgressFn = (p: Progress) => void;

/** A Java resource/data pack format version, e.g. 97.1 */
export interface PackFormat {
  major: number;
  minor: number;
}

export interface GameVersion {
  edition: Edition;
  /** Java: Mojang id ('26.3', '1.21.11', '26.4-snapshot-1'). Bedrock: version string ('1.21.120' / '26.30') */
  id: string;
  /** Display name */
  name: string;
  type: 'release' | 'snapshot' | 'preview';
  releaseTime?: string;
  /** Java only, when known without downloading anything */
  packFormat?: PackFormat;
  /** Bedrock only: git ref in Mojang/bedrock-samples to fetch vanilla assets from */
  ref?: string;
}

export type TextureCategory =
  | 'block' | 'item' | 'entity' | 'gui' | 'particle' | 'environment'
  | 'painting' | 'armor' | 'effect' | 'font' | 'map' | 'misc' | 'colormap' | 'other';

export interface TextureInfo {
  /** Full path inside a pack, e.g. 'assets/minecraft/textures/block/stone.png' (Java) or 'textures/blocks/stone.png' (Bedrock) */
  path: string;
  /** File name without extension, e.g. 'stone' */
  name: string;
  /** Path relative to the textures root without extension, e.g. 'block/stone' or 'blocks/stone' — used for display & search */
  id: string;
  category: TextureCategory;
  ext: 'png' | 'tga';
  /** Java: has a .png.mcmeta animation file. Bedrock: listed in flipbook_textures.json */
  animated?: boolean;
}

/** Read-only view over the vanilla assets of one game version. */
export interface AssetIndex {
  edition: Edition;
  version: string;
  /** All editable textures, sorted by category then id */
  textures: TextureInfo[];
  hasFile(path: string): boolean;
  /** All file paths starting with prefix (no network) */
  listFiles(prefix: string): string[];
  readFile(path: string): Promise<Uint8Array>;
  readText(path: string): Promise<string>;
  /** Decoded RGBA image of a texture (handles PNG and TGA) */
  readImage(path: string): Promise<ImageData>;
}

/** Generic UI option schema used by the shader makers (and anything else with sliders). */
export type OptionValue = number | boolean | string;
export interface OptionDef {
  key: string;
  label: string;
  /** Section heading in the UI, e.g. 'Lighting', 'Color', 'Water' */
  group: string;
  type: 'range' | 'toggle' | 'select' | 'color';
  default: OptionValue;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  /** for 'select' */
  options?: { value: string; label: string }[];
  description?: string;
  /** Only show when another toggle option is on */
  dependsOn?: string;
}
export type OptionValues = Record<string, OptionValue>;

/** Values the in-browser shader preview understands. Every generator maps its options onto these. */
export interface PreviewParams {
  exposure: number;       // 1 = neutral
  contrast: number;       // 1 = neutral
  saturation: number;     // 1 = neutral
  gamma: number;          // 1 = neutral
  temperature: number;    // -1 (cool) .. 1 (warm), 0 neutral
  tint: [number, number, number]; // multiplier, [1,1,1] neutral
  vignette: number;       // 0..1
  bloom: number;          // 0..1
  shadowStrength: number; // 0..1
  sunColor: [number, number, number];
  skyTop: [number, number, number];
  skyHorizon: [number, number, number];
  fogColor: [number, number, number];
  fogDensity: number;     // 0..1
  waterColor: [number, number, number];
  waterClarity: number;   // 0..1
  waving: number;         // 0..1 (foliage sway amount)
  godrays: number;        // 0..1
  timeOfDay: number;      // 0..24000 (Minecraft ticks), 6000 = noon
  grayscale: number;      // 0..1
  sepia: number;          // 0..1
  posterize: number;      // 0 = off, else levels (2..32)
}

/** A file map for a zip: path -> contents */
export type FileMap = Record<string, string | Uint8Array | Blob>;

// ---- Projects (persisted in IndexedDB) ----

export interface ProjectBase {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface TexturePackProject extends ProjectBase {
  kind: 'texturepack';
  edition: Edition;
  /** Target game version id */
  version: string;
  description: string;
  /** pack.png (Java) / pack_icon.png (Bedrock), PNG */
  icon?: Blob;
  /** Target resolution for newly edited textures (16, 32, 64, 128, 256, 512) */
  resolution: number;
  /** Edited / uploaded / imported textures: pack path -> PNG blob */
  overrides: Record<string, Blob>;
  /** Extra files carried over from an imported pack (mcmeta, models, lang...) path -> blob */
  extraFiles: Record<string, Blob>;
  /** Non-destructive whole-pack effects, applied in thumbnails and on export */
  effects: EffectLayer[];
  /** Java: optional compatibility range for pack.mcmeta (version ids) */
  compat?: { minVersion: string; maxVersion: string };
  /** Bedrock: stable uuids so re-exports update the same pack in-game */
  bedrockUuids?: { header: string; module: string };
  /** Semver-like pack version for Bedrock manifest, bumped on each export */
  packVersion?: [number, number, number];
}

export interface EffectLayer {
  id: string;
  /** key into the effects registry, e.g. 'hue', 'saturation', 'outline' */
  type: string;
  enabled: boolean;
  params: Record<string, number | boolean | string>;
  /** Which texture categories it applies to; empty/undefined = all */
  categories?: TextureCategory[];
}

export type SkinModel = 'classic' | 'slim';

export interface SkinProject extends ProjectBase {
  kind: 'skin';
  model: SkinModel;
  /** 64x64 PNG */
  image: Blob;
  /** Optional cape 64x32 PNG */
  cape?: Blob;
}

export type ShaderTarget = 'iris' | 'java-vanilla' | 'bedrock-vibrant';

export interface ShaderProject extends ProjectBase {
  kind: 'shader';
  target: ShaderTarget;
  /** Game version (needed for java-vanilla patching and bedrock manifests) */
  version: string;
  description: string;
  settings: OptionValues;
  /** Preset id this project started from */
  preset?: string;
  bedrockUuids?: { header: string; module: string };
}

export type Project = TexturePackProject | SkinProject | ShaderProject;
