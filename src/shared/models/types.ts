// Edition-agnostic shapes of the model library (blocks and items, their states and textures).

import type { BakedQuad, Tint, Vec3 } from './geometry';

export type BlockState = Record<string, string>;
export type EntryKind = 'block' | 'item';
/** Rough grouping for the block browser */
export type ModelCategory = 'cube' | 'plant' | 'shape' | 'special' | 'item';

export interface ModelEntry {
  kind: EntryKind;
  /** Unique within its kind, e.g. 'furnace', 'oak_door' (Bedrock: blocks.json / item atlas key) */
  id: string;
  /** Display name, from the game's language file when available */
  name: string;
}

export interface StateValue {
  value: string;
  label: string;
}

export interface StateProperty {
  name: string;
  label: string;
  values: StateValue[];
}

export interface ModelTexture {
  /** Pack path, e.g. 'assets/minecraft/textures/block/furnace_front_on.png' */
  path: string;
  /** Where it goes on the model, e.g. 'Front (lit)', 'Side', 'Top' */
  label: string;
  /** Texture variable / face key that picked it */
  role: string;
  /** Faces using it in the current state (0 = only used in other states) */
  faces: number;
  /** A state that shows this texture (for textures of other states) */
  state?: BlockState;
  /** The version doesn't have this file (the game shows its missing texture) */
  missing?: boolean;
  /** Animated (Java .mcmeta / Bedrock flipbook) */
  animated?: boolean;
}

/** A flat texture layer (generated item sprites, special-block fallbacks). */
export interface SpriteLayer {
  path: string;
  role: string;
  tint: Tint | null;
}

export interface ModelView {
  entry: ModelEntry;
  state: BlockState;
  /**
   * 'model': quads to draw. 'sprite': a flat item made of layers (extruded like the game's generated
   * items). 'special': the game draws it with its own code; `sprite` holds its texture sheet(s).
   */
  shape: 'model' | 'sprite' | 'special';
  quads: BakedQuad[];
  sprite: SpriteLayer[];
  /** Every texture of the block/item across its states (the current state's first) */
  textures: ModelTexture[];
  /** Explains a fallback, e.g. how the game draws chests */
  note?: string;
  /** Extra display yaw (degrees) so the model's front faces the default camera */
  displayYaw?: number;
  category: ModelCategory;
  /** Bedrock: the block's shape is drawn by the game and only approximated here */
  approximate?: boolean;
}

export interface TextureUsage {
  blocks: string[];
  items: string[];
}

/** One edition's backend; index.ts adds names, pairing and caching on top. */
export interface EditionBackend {
  blockIds(): string[];
  itemIds(): string[];
  blockName(id: string): string | null;
  itemName(id: string): string | null;
  blockProperties(id: string): { name: string; values: string[] }[];
  defaultBlockState(id: string): BlockState;
  /** Quads and textures of a block in a state (no labels yet) */
  resolveBlock(id: string, state: BlockState): RawView;
  /** Every texture a block can show, with the (partial) states that show it and the faces it covers */
  blockTextureStates(id: string): TextureStates[];
  itemOptions(id: string): string[];
  resolveItem(id: string, option: number): RawView;
  /** Every texture an item can show */
  itemTexturePaths(id: string): string[];
  hasTexture(path: string): boolean;
  isAnimated(path: string): boolean;
  /** Properties to hide from the picker because the view shows every value at once (door halves) */
  combinedProperties?(id: string): string[];
}

export interface TextureStates {
  path: string;
  role: string;
  states: BlockState[];
  dirs: string[];
}

export interface RawView {
  shape: ModelView['shape'];
  quads: BakedQuad[];
  sprite: SpriteLayer[];
  note?: string;
  displayYaw?: number;
  category: ModelCategory;
  approximate?: boolean;
  /** Multi-block offsets applied (e.g. both door halves) */
  offsets?: Vec3[];
}
