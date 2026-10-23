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
  /**
   * Sounds replaced in the editor: pack path of the sound file -> how it was made. The file that goes
   * into the pack is stored in extraFiles under the same path (so every tool that copies a pack's
   * files keeps it); this only holds what's needed to keep editing it.
   */
  sounds?: Record<string, SoundEdit>;
  /**
   * Java: block and item models made in the model editor, by the pack path of the model they replace.
   * The files themselves (model, item definition, blockstate) are stored in extraFiles; this only holds
   * what's needed to keep editing them or put the pack's own files back.
   */
  customModels?: Record<string, CustomModel>;
  /** PvP / FPS tweaks switched on in the editor, with what each one changed (to put it back) */
  pvp?: PvpState;
  /**
   * PBR materials made in the Material tab, by the pack path of the colour texture they belong to.
   * Their maps (Java labPBR _n / _s, Bedrock texture sets) are made from these on export.
   */
  pbr?: Record<string, PbrMaterial>;
  /**
   * Java: items that look different when they are renamed (in an anvil), by id ('<item>/<slug>'). Their
   * textures are in overrides and their models in extraFiles; the item definitions (1.21.5+) and
   * OptiFine CIT files (older versions) are written from these on export.
   */
  nameVariants?: Record<string, NameVariant>;
  /**
   * Animations made or changed in the editor, by the pack path of their texture (its frames are the
   * texture's pixels, in overrides). Java .png.mcmeta files and Bedrock flipbook_textures.json
   * entries are written from these on export; textures without one keep the pack's or the game's.
   */
  animations?: Record<string, TextureAnimation>;
  /**
   * Paint layers of textures painted on more than one layer (or one hidden, locked, see-through or
   * blended layer), by the pack path of their texture. The texture in overrides is always these
   * layers flattened: the game, the previews and the export only ever use that.
   */
  layers?: Record<string, TextureLayers>;
  /**
   * Stamps saved from selections while editing this pack (src/tools/textures/stamps). Every browser
   * keeps its own stamps; these come along in the pack's project file and join the stamps of the
   * browser that opens it.
   */
  stamps?: TextureStamp[];
}

/** Blend mode of a paint layer (src/tools/textures/layers). */
export type TextureLayerBlend = 'normal' | 'multiply' | 'screen' | 'lighten' | 'overlay';

/** One paint layer of a texture, as stored. */
export interface TextureLayer {
  id: string;
  name: string;
  /** The layer's pixels at the texture's size (every animation frame), PNG */
  image: Blob;
  hidden?: boolean;
  locked?: boolean;
  /** 0..1 (default 1) */
  opacity?: number;
  blend?: TextureLayerBlend;
}

/** A small picture the stamp tool places, saved from a selection. */
export interface TextureStamp {
  id: string;
  name: string;
  width: number;
  height: number;
  /** Straight RGBA, base64 */
  pixels: string;
  updatedAt: number;
}

/** The paint layers of a texture, bottom to top. */
export interface TextureLayers {
  layers: TextureLayer[];
  /** Index of the layer being painted */
  active: number;
  updatedAt: number;
}

/** One step of an animation's play order: a frame, shown for its own number of ticks (else the default). */
export interface AnimationStep {
  index: number;
  time?: number;
}

/** How a texture's frames play (src/tools/textures/anim). Sizes are in the stored image's pixels. */
export interface TextureAnimation {
  /** Size of one frame; frames run left to right, then top to bottom (the game's order) */
  frameWidth: number;
  frameHeight: number;
  /** Game ticks each frame shows (20 ticks = 1 second) */
  frametime: number;
  /** Play order with times of their own (Java's "frames"); none = every frame once, in order */
  frames?: AnimationStep[];
  /** Blend each frame into the next (Java "interpolate", Bedrock "blend_frames") */
  interpolate?: boolean;
  /** Bedrock "replicate", kept from the pack's or the game's flipbook entry */
  replicate?: number;
  updatedAt: number;
}

/** A look an item gets when it has one of some names (src/tools/textures/names). */
export interface NameVariant {
  /** Item id, e.g. 'diamond_sword' */
  item: string;
  /** Names that pick this look, exactly as typed in the anvil */
  names: string[];
  /**
   * An opened OptiFine pack's own match ('ipattern:*sword*', 'regex:...') that plain names can't say:
   * only OptiFine and CIT Resewn understand it
   */
  match?: string;
  /** Pack path of its texture (in overrides) */
  texture: string;
  /** Model id it shows, e.g. 'minecraft:item/names/diamond_sword/excalibur' (in extraFiles) */
  model: string;
  updatedAt: number;
}

/** Metal, glow (emissive), roughness and light through (subsurface), 0-255 each (Bedrock's MERS order). */
export type PbrValues = [number, number, number, number];

/** Which pixels of a texture a part of a material covers (src/tools/textures/pbr). */
export type PbrWhere =
  /** Pixels at least this colourful / bright, or at most this bright (0-100) */
  | { kind: 'colourful' | 'bright' | 'dark'; amount: number }
  /** Pixels close to one of these colours (0xRRGGBB), within `tolerance` (0-100) */
  | { kind: 'colour'; colours: number[]; tolerance: number }
  /** A rectangle [x, y, w, h] of a texture that was `size` [w, h] big (scaled with the texture) */
  | { kind: 'area'; rect: [number, number, number, number]; size: [number, number] };

/** A part of a texture with its own material values. */
export interface PbrSpot {
  where: PbrWhere;
  values: PbrValues;
}

/** Bumps made from the colour texture: the brightness is the height. */
export interface PbrBumps {
  /** 0-3 (1 = normal) */
  strength: number;
  /** Dark parts stick out instead of bright ones */
  invert: boolean;
  /** Smoothing radius in pixels, 0-3 */
  blur: number;
}

/** A map image of an opened pack or of the game (PNG or TGA bytes) and how its channels are laid out. */
export interface PbrMapImage {
  image: Blob;
  /**
   * 'mers' / 'mer': Bedrock RGBA = metal, emissive, roughness, subsurface (MER: no subsurface);
   * 'specular': labPBR _s; 'normal': Bedrock RGB normal (DirectX); 'heightmap': Bedrock grey height;
   * 'labpbr': labPBR _n (RG normal (DirectX), B ambient occlusion, A height)
   */
  layout: 'mers' | 'mer' | 'specular' | 'normal' | 'heightmap' | 'labpbr';
}

/** The PBR material of one texture: how it shines, glows and how bumpy it looks. */
export interface PbrMaterial {
  /** Values of the whole texture (when there is no `map`) */
  base: PbrValues;
  /** Parts with their own values, painted over the base in order */
  spots: PbrSpot[];
  /** Bumps made from the colours (null: flat, or the pack's own `normal`) */
  bumps: PbrBumps | null;
  /** Per-pixel metal / glow / roughness / subsurface from a pack or the game (instead of `base`) */
  map?: PbrMapImage;
  /** The pack's own normal or height map (used while `bumps` is null) */
  normal?: PbrMapImage;
  /** Quick material last chosen (the Material tab's highlight) */
  preset?: string;
  /** Files of an opened pack (pack path -> file), exported as they were until the material changes */
  original?: Record<string, Blob>;
  updatedAt: number;
}

/** The PvP tweaks of a texture pack (src/tools/textures/pvp). */
export interface PvpState {
  tweaks: Record<string, PvpApplied>;
  /** A new PvP pack: the editor applies the preset once the game files are loaded */
  pending?: { fps: boolean };
}

/** One PvP tweak as applied: its choices and every file it wrote, with the pack's copy from before. */
export interface PvpApplied {
  options: Record<string, string | boolean>;
  /** Textures it painted: hash of the pixels it wrote (a texture painted since is left alone) */
  textures: { path: string; before: Blob | null; hash: string }[];
  /** Whole files it wrote (models, .mcmeta): the text it wrote */
  files: { path: string; before: Blob | null; text: string }[];
  /** Model files whose display slots it changed: what each slot was in the file before (null: not in it) */
  displays: { path: string; before: Blob | null; prev: Record<string, unknown>; slots: Record<string, unknown>; text: string }[];
  appliedAt: number;
  /** The game version the files were written for */
  version?: string;
}

/** A block or item model changed in the model editor (Java). */
export interface CustomModel {
  kind: 'block' | 'item';
  /** Block or item id */
  id: string;
  /** Model id whose shape is replaced, e.g. 'minecraft:item/diamond_sword' */
  model: string;
  /** Model id the shape is saved as (model, or another one, e.g. item/<id>_3d) */
  saved: string;
  /** Which look of the item (index of its options) */
  option?: number;
  /** 1.21.4+: the inventory, ground and item frames keep the old model */
  flatGui?: boolean;
  /** The blockstate is rewritten so every random variant of the model uses the shape */
  everyVariant?: boolean;
  /** Files the editor wrote */
  files: string[];
  /** The pack's own copies of those files before the editor wrote them (null: there was none) */
  originals: Record<string, Blob | null>;
  updatedAt: number;
}

/** An edited sound file: the user's own audio, trimmed and levelled, saved as Ogg Vorbis. */
export interface SoundEdit {
  /** The uploaded / recorded audio as it was picked (absent when it was too large to keep) */
  source?: Blob;
  /** File name of the upload, or 'Recording' */
  sourceName?: string;
  /** Trim start and end in seconds of the source */
  start: number;
  end: number;
  /** Linear volume (1 = unchanged) */
  gain: number;
  /** Keep two channels (only when the source has them) */
  stereo: boolean;
  updatedAt: number;
  /** Bedrock: sound_definitions.json entries (copied from the game) for the events that play this file */
  definitions?: Record<string, unknown>;
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
