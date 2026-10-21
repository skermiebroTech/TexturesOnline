// PvP / FPS tweaks: what each one changes, in which files of which game version, and the pixel and
// model changes themselves. Pure (no DOM, no storage): ./apply.ts writes the results into a pack.
//
// What the game reads (checked against the client jars 1.6.1 – 26.4 and bedrock-samples):
// - Fire on screen: Java draws the burning overlay with the second fire texture only
//   (textures/blocks/fire_layer_1.png before 1.13, textures/block/fire_1.png since). Fire blocks use it
//   too, through their block models: "keep fire blocks" points those models at a copy of the texture.
// - Glass: block/glass.png and the 16 stained glass textures (before 1.13 blocks/glass_<colour>.png,
//   with "silver" for light grey). Panes use the same textures; their edge strip (glass_pane_top) stays.
// - Pumpkin view: textures/misc/pumpkinblur.png in every version and on Bedrock.
// - Crosshair: the top-left 16 × 16 of textures/gui/icons.png until Java 1.20.1 and on Bedrock;
//   textures/gui/sprites/hud/crosshair.png (15 × 15) from Java 1.20.2.
// - Weapons and shield in first person: the item model's display slots, "firstperson" in 1.8 and
//   "firstperson_righthand" / "firstperson_lefthand" from 1.9 (shields came in 1.9; 1.21.4+ reads the
//   model through assets/minecraft/items/<id>.json, a shield's look still takes its slots from
//   item/shield and item/shield_blocking).

import type { Edition } from '../../../core/types';
import { createImageData } from '../../../core/pixels';
import { bundledPackFormat, comparePackFormats } from '../../../editions/java/packformats';
import { legacyOverrideModels, modelId, parseDisplayTransform, type DisplayTransform } from '../../../shared/models/java-models';

export type PvpTweakId = 'lowFire' | 'clearGlass' | 'noPumpkin' | 'crosshair' | 'swords' | 'shield' | 'lowRes' | 'still';

/** The tweaks in the order the panel lists them. */
export const PVP_TWEAKS: readonly PvpTweakId[] = ['lowFire', 'clearGlass', 'noPumpkin', 'crosshair', 'swords', 'shield', 'lowRes', 'still'];
/** Effect-layer tweaks (the whole pack, applied on export); the others write files. */
export const EFFECT_TWEAKS: Readonly<Partial<Record<PvpTweakId, string>>> = { lowRes: 'downscale', still: 'stillFrames' };

export const PVP_GROUPS: readonly { id: 'pvp' | 'fps'; tweaks: readonly PvpTweakId[] }[] = [
  { id: 'pvp', tweaks: ['lowFire', 'clearGlass', 'noPumpkin', 'crosshair', 'swords', 'shield'] },
  { id: 'fps', tweaks: ['lowRes', 'still'] },
];

export const FIRE_HEIGHTS = ['low', 'lower', 'lowest'] as const;
export type FireHeight = (typeof FIRE_HEIGHTS)[number];
/** How far the flames move down, in sixteenths of a frame. */
export const FIRE_SHIFT: Record<FireHeight, number> = { low: 5, lower: 8, lowest: 11 };

export const GLASS_MODES = ['clear', 'tint'] as const;
export type GlassMode = (typeof GLASS_MODES)[number];

export const CROSSHAIRS = ['dot', 'cross', 'gap', 'circle', 'x'] as const;
export type CrosshairDesign = (typeof CROSSHAIRS)[number];

export const SWORD_SIZES = ['small', 'smaller', 'tiny'] as const;
export type SwordSize = (typeof SWORD_SIZES)[number];
export const SWORD_SCALE: Record<SwordSize, number> = { small: 0.8, smaller: 0.65, tiny: 0.5 };
export const WEAPON_SCOPES = ['swords', 'weapons'] as const;
export type WeaponScope = (typeof WEAPON_SCOPES)[number];

export const SHIELD_HEIGHTS = ['low', 'lower'] as const;
export type ShieldHeight = (typeof SHIELD_HEIGHTS)[number];
/** How far the shield moves down in first person (1/16 block). */
export const SHIELD_DROP: Record<ShieldHeight, number> = { low: 3, lower: 6 };

export const LOW_RES_SCOPES = ['blocks', 'all'] as const;
export type LowResScope = (typeof LOW_RES_SCOPES)[number];

export interface PvpOptions {
  lowFire: { height: FireHeight; keepBlocks: boolean };
  clearGlass: { mode: GlassMode };
  noPumpkin: Record<string, never>;
  crosshair: { design: CrosshairDesign };
  swords: { size: SwordSize; scope: WeaponScope };
  shield: { height: ShieldHeight };
  lowRes: { scope: LowResScope };
  still: Record<string, never>;
}

export const DEFAULT_OPTIONS: PvpOptions = {
  lowFire: { height: 'lower', keepBlocks: true },
  clearGlass: { mode: 'clear' },
  noPumpkin: {},
  crosshair: { design: 'gap' },
  swords: { size: 'smaller', scope: 'swords' },
  shield: { height: 'low' },
  lowRes: { scope: 'blocks' },
  still: {},
};

/** The tweaks a new PvP pack starts with (the FPS ones when asked). */
export const PRESET_TWEAKS: readonly PvpTweakId[] = ['lowFire', 'clearGlass', 'noPumpkin', 'crosshair', 'swords', 'shield'];
export const PRESET_FPS_TWEAKS: readonly PvpTweakId[] = ['lowRes', 'still'];

/** Merges stored choices over the defaults (unknown values fall back). */
export function optionsFor<K extends PvpTweakId>(id: K, stored: Record<string, unknown> | undefined): PvpOptions[K] {
  const def = DEFAULT_OPTIONS[id] as Record<string, unknown>;
  const out: Record<string, unknown> = { ...def };
  const allowed: Record<string, readonly unknown[]> = {
    height: id === 'shield' ? SHIELD_HEIGHTS : FIRE_HEIGHTS,
    keepBlocks: [true, false],
    mode: GLASS_MODES,
    design: CROSSHAIRS,
    size: SWORD_SIZES,
    scope: id === 'lowRes' ? LOW_RES_SCOPES : WEAPON_SCOPES,
  };
  for (const k of Object.keys(def)) if (stored && allowed[k]?.includes(stored[k])) out[k] = stored[k];
  return out as PvpOptions[K];
}

// ---------------------------------------------------------------------------------------------
// Versions

export interface JavaPvpRules {
  /** Block and item models are JSON files (1.8+) */
  models: boolean;
  /** "firstperson" instead of right / left hand slots (1.8) */
  legacyDisplay: boolean;
  /** Shields exist (1.9+) */
  shield: boolean;
  /** textures/block and textures/item, fire_1, <colour>_stained_glass (1.13+) */
  flattened: boolean;
  /** HUD sprites in textures/gui/sprites (1.20.2+): the crosshair is its own file */
  hudSprites: boolean;
  /** Item model definitions in assets/minecraft/items (1.21.4+) */
  itemDefinitions: boolean;
}

/** Pack format of a release, or null for versions the table doesn't know (newer snapshots: newest rules). */
function atLeast(version: string, release: string): boolean {
  const f = bundledPackFormat(version.trim());
  const r = bundledPackFormat(release)!;
  if (!f) return !/^1\.\d+(\.\d+)?$/.test(version.trim());
  return comparePackFormats(f, r) >= 0;
}

export function javaPvpRules(version: string): JavaPvpRules {
  const legacy = /^1\.(\d+)(\.\d+)?$/.exec(version.trim());
  const minor = legacy ? Number(legacy[1]) : 99;
  return {
    models: minor >= 8,
    legacyDisplay: minor === 8,
    shield: minor >= 9,
    flattened: atLeast(version, '1.13'),
    hudSprites: atLeast(version, '1.20.2'),
    itemDefinitions: atLeast(version, '1.21.4'),
  };
}

/** Why a tweak can't be made for this edition and version (null: it can). */
export type PvpUnsupported = 'bedrockFire' | 'bedrockHeld' | 'bedrockAnimations' | 'noModels' | 'noShield';

export function tweakSupport(id: PvpTweakId, edition: Edition, version: string): PvpUnsupported | null {
  if (edition === 'bedrock') {
    if (id === 'lowFire') return 'bedrockFire';
    if (id === 'swords' || id === 'shield') return 'bedrockHeld';
    if (id === 'still') return 'bedrockAnimations';
    return null;
  }
  const r = javaPvpRules(version);
  if ((id === 'swords' || id === 'shield') && !r.models) return 'noModels';
  if (id === 'shield' && !r.shield) return 'noShield';
  return null;
}

/** Whether the "keep fire blocks as they are" choice works (it needs block models: Java 1.8+). */
export function canKeepFireBlocks(edition: Edition, version: string): boolean {
  return edition === 'java' && javaPvpRules(version).models;
}

// ---------------------------------------------------------------------------------------------
// Files

const JAVA_TEX = 'assets/minecraft/textures/';
const JAVA_MODELS = 'assets/minecraft/models/';

/** Dye colours in the order the game lists them (file names: modern, then before the 1.13 rename). */
export const GLASS_COLOURS: readonly [string, string][] = [
  ['white', 'white'], ['orange', 'orange'], ['magenta', 'magenta'], ['light_blue', 'light_blue'], ['yellow', 'yellow'], ['lime', 'lime'],
  ['pink', 'pink'], ['gray', 'gray'], ['light_gray', 'silver'], ['cyan', 'cyan'], ['purple', 'purple'], ['blue', 'blue'],
  ['brown', 'brown'], ['green', 'green'], ['red', 'red'], ['black', 'black'],
];

export interface GlassTexture {
  path: string;
  stained: boolean;
}

/** Glass textures of a version (filter with the game's file list: stained glass came in 1.7.2). */
export function glassTextures(edition: Edition, version: string): GlassTexture[] {
  if (edition === 'bedrock') {
    return [{ path: 'textures/blocks/glass.png', stained: false }, ...GLASS_COLOURS.map(([, old]) => ({ path: `textures/blocks/glass_${old}.png`, stained: true }))];
  }
  if (javaPvpRules(version).flattened) {
    return [{ path: `${JAVA_TEX}block/glass.png`, stained: false }, ...GLASS_COLOURS.map(([c]) => ({ path: `${JAVA_TEX}block/${c}_stained_glass.png`, stained: true }))];
  }
  return [{ path: `${JAVA_TEX}blocks/glass.png`, stained: false }, ...GLASS_COLOURS.map(([, old]) => ({ path: `${JAVA_TEX}blocks/glass_${old}.png`, stained: true }))];
}

/** The fire texture the game draws over the screen while burning (Java). */
export function fireOverlayPath(version: string): string {
  return javaPvpRules(version).flattened ? `${JAVA_TEX}block/fire_1.png` : `${JAVA_TEX}blocks/fire_layer_1.png`;
}

/** The copy of the fire texture that fire blocks are pointed at when they keep their flames. */
export function worldFirePath(version: string): string {
  return fireOverlayPath(version).replace(/\.png$/, '_world.png');
}

export function pumpkinPath(edition: Edition): string {
  return edition === 'java' ? `${JAVA_TEX}misc/pumpkinblur.png` : 'textures/misc/pumpkinblur.png';
}

export interface CrosshairTarget {
  path: string;
  /**
   * 'sheet': the crosshair is the top-left 16 × 16 of a 256 × 256 sheet (scaled with the sheet);
   * 'sprite': the whole 15 × 15 sprite is the crosshair
   */
  kind: 'sheet' | 'sprite';
}

export function crosshairTarget(edition: Edition, version: string): CrosshairTarget {
  if (edition === 'bedrock') return { path: 'textures/gui/icons.png', kind: 'sheet' };
  return javaPvpRules(version).hudSprites ? { path: `${JAVA_TEX}gui/sprites/hud/crosshair.png`, kind: 'sprite' } : { path: `${JAVA_TEX}gui/icons.png`, kind: 'sheet' };
}

/** Item ids whose first-person pose the weapons tweak changes, from the version's item model files. */
export function weaponItems(modelFiles: Iterable<string>, scope: WeaponScope): string[] {
  const out: string[] = [];
  const pick = scope === 'swords' ? /^(wooden|stone|copper|iron|golden|diamond|netherite)_sword$/ : /^((wooden|stone|copper|iron|golden|diamond|netherite)_(sword|axe|spear)|mace)$/;
  for (const f of modelFiles) {
    const m = /^assets\/minecraft\/models\/item\/([a-z0-9_]+)\.json$/.exec(f);
    if (m && pick.test(m[1])) out.push(m[1]);
  }
  return [...new Set(out)].sort();
}

export function itemModelPath(id: string): string {
  return `${JAVA_MODELS}item/${id}.json`;
}

/** Display slots the game uses for the hand in first person. */
export function firstPersonSlots(version: string): string[] {
  return javaPvpRules(version).legacyDisplay ? ['firstperson'] : ['firstperson_righthand', 'firstperson_lefthand'];
}

// ---------------------------------------------------------------------------------------------
// Models

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Models an item definition (1.21.4+) shows in first person: the cases of a display-context select
 * that list first person (else its fallback), both sides of conditions, every entry of the rest, and
 * the base model of a look the game's code draws (a shield's transforms come from it).
 */
export function firstPersonModels(def: unknown): string[] {
  const out: string[] = [];
  const add = (m: unknown) => {
    if (typeof m === 'string' && !out.includes(modelId(m))) out.push(modelId(m));
  };
  const walk = (n: unknown, depth = 0): void => {
    if (!isObj(n) || typeof n.type !== 'string' || depth > 24) return;
    switch (n.type.replace(/^minecraft:/, '')) {
      case 'model':
        add(n.model);
        return;
      case 'special':
        add(n.base);
        return;
      case 'condition':
        walk(n.on_true, depth + 1);
        walk(n.on_false, depth + 1);
        return;
      case 'select': {
        const cases = Array.isArray(n.cases) ? n.cases.filter(isObj) : [];
        if (String(n.property).replace(/^minecraft:/, '') === 'display_context') {
          const fp = cases.filter((c) => [c.when].flat().some((w) => w === 'firstperson_righthand' || w === 'firstperson_lefthand'));
          if (fp.length) fp.forEach((c) => walk(c.model, depth + 1));
          else walk(n.fallback, depth + 1);
          return;
        }
        cases.forEach((c) => walk(c.model, depth + 1));
        walk(n.fallback, depth + 1);
        return;
      }
      case 'range_dispatch':
        if (Array.isArray(n.entries)) n.entries.filter(isObj).forEach((e) => walk(e.model, depth + 1));
        walk(n.fallback, depth + 1);
        return;
      case 'composite':
        if (Array.isArray(n.models)) n.models.forEach((m) => walk(m, depth + 1));
        return;
      default:
        return;
    }
  };
  walk(isObj(def) ? def.model : undefined);
  return out;
}

/** Models an item shows in first person before 1.21.4: its own model and the ones its overrides switch to. */
export function legacyFirstPersonModels(itemId: string, ownJson: unknown): string[] {
  const own = modelId(`minecraft:item/${itemId}`);
  return [own, ...legacyOverrideModels(ownJson).map(modelId).filter((m) => m !== own)];
}

const round = (n: number): number => {
  const r = Math.round(n * 10000) / 10000;
  return Object.is(r, -0) ? 0 : r;
};

/** The game's limits on a display transform: translation ±80 (1.8: ±24) sixteenths, scale up to 4. */
function clampTransform(t: DisplayTransform, legacy: boolean): DisplayTransform {
  const lim = legacy ? 24 : 80;
  return {
    rotation: t.rotation.map(round) as DisplayTransform['rotation'],
    translation: t.translation.map((v) => round(Math.max(-lim, Math.min(lim, v)))) as DisplayTransform['translation'],
    scale: t.scale.map((v) => round(Math.max(-4, Math.min(4, v)))) as DisplayTransform['scale'],
  };
}

/** A held weapon made smaller around its middle and moved down so the grip stays near the hand. */
export function smallerHeld(t: DisplayTransform, size: SwordSize, legacy: boolean): DisplayTransform {
  const f = SWORD_SCALE[size];
  return clampTransform({ rotation: [...t.rotation], translation: [t.translation[0], t.translation[1] - (1 - f) * 4, t.translation[2]], scale: t.scale.map((v) => v * f) as DisplayTransform['scale'] }, legacy);
}

/** A shield moved down the screen in first person. */
export function lowerShield(t: DisplayTransform, height: ShieldHeight): DisplayTransform {
  return clampTransform({ rotation: [...t.rotation], translation: [t.translation[0], t.translation[1] - SHIELD_DROP[height], t.translation[2]], scale: [...t.scale] }, false);
}

export function transformJson(t: DisplayTransform): Record<string, number[]> {
  return { rotation: t.rotation.map(round), translation: t.translation.map(round), scale: t.scale.map(round) };
}

/** A copy of a model file with display slots set (null: the slot is taken out). Other keys stay as they are. */
export function withDisplay(json: Record<string, unknown>, slots: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...json };
  const display: Record<string, unknown> = isObj(json.display) ? { ...json.display } : {};
  for (const [k, v] of Object.entries(slots)) {
    if (v === null || v === undefined) delete display[k];
    else display[k] = v;
  }
  if (Object.keys(display).length) out.display = display;
  else delete out.display;
  return out;
}

/** The display slot as the file itself has it (null when the file doesn't set it). */
export function ownSlot(json: unknown, slot: string): unknown {
  const d = isObj(json) && isObj(json.display) ? json.display[slot] : undefined;
  return d === undefined ? null : structuredClone(d);
}

export function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export { parseDisplayTransform };

/** Texture refs that name the fire overlay texture ('blocks/fire_layer_1', 'minecraft:block/fire_1'). */
export function isOverlayFireRef(ref: unknown): boolean {
  return typeof ref === 'string' && /^(minecraft:)?(block|blocks)\/fire(_layer)?_1$/.test(ref);
}

/**
 * A fire block model pointed at the copy of the fire texture, or null when it doesn't use the overlay
 * texture itself. The "particle" texture keeps naming the overlay texture: before 1.13 the game puts
 * only the textures block models name (particle included) into its texture atlas, and the screen
 * overlay needs the original one there.
 */
export function fireModelUsingCopy(json: unknown): Record<string, unknown> | null {
  if (!isObj(json) || !isObj(json.textures)) return null;
  let changed = false;
  const textures: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(json.textures)) {
    if (k !== 'particle' && isOverlayFireRef(v)) {
      textures[k] = `${v}_world`;
      changed = true;
    } else textures[k] = v;
  }
  return changed ? { ...json, textures } : null;
}

// ---------------------------------------------------------------------------------------------
// Pixels

type Img = ImageData;

function copy(img: Img): Img {
  return createImageData(img.width, img.height, new Uint8ClampedArray(img.data));
}

/** Moves every frame's flames down by `FIRE_SHIFT` sixteenths (frames are squares the width of the strip). */
export function lowFireImage(img: Img, height: FireHeight): Img {
  const w = img.width;
  const fh = img.height % w === 0 ? w : img.height;
  const shift = Math.round((fh * FIRE_SHIFT[height]) / 16);
  const out = createImageData(w, img.height);
  const s = img.data;
  const d = out.data;
  for (let f = 0; f < img.height / fh; f++) {
    for (let y = shift; y < fh; y++) {
      const src = (f * fh + y - shift) * w * 4;
      d.set(s.subarray(src, src + w * 4), (f * fh + y) * w * 4);
    }
  }
  return out;
}

/** Clear glass: the border ring stays, the inside goes clear (stained glass may keep a faint tint). */
export function clearGlassImage(img: Img, stained: boolean, mode: GlassMode): Img {
  const out = copy(img);
  const { width: w, height: h } = img;
  const ring = Math.max(1, Math.round(w / 16));
  const d = out.data;
  for (let y = ring; y < h - ring; y++) {
    for (let x = ring; x < w - ring; x++) {
      const i = (y * w + x) * 4 + 3;
      d[i] = stained && mode === 'tint' ? Math.round(d[i] * 0.3) : 0;
    }
  }
  return out;
}

/** A fully transparent copy (the pumpkin view). */
export function emptyImage(img: Img): Img {
  return createImageData(img.width, img.height);
}

/** The design's pixels in a 15 × 15 grid centred on (7, 7), as the game centres the crosshair. */
export function crosshairPixels(design: CrosshairDesign): [number, number][] {
  const px: [number, number][] = [];
  const c = 7;
  const add = (x: number, y: number) => px.push([c + x, c + y]);
  switch (design) {
    case 'dot':
      add(0, 0);
      add(1, 0);
      add(-1, 0);
      add(0, 1);
      add(0, -1);
      break;
    case 'cross':
      for (let i = -3; i <= 3; i++) {
        add(i, 0);
        if (i) add(0, i);
      }
      break;
    case 'gap':
      add(0, 0);
      for (let i = 2; i <= 5; i++) {
        add(i, 0);
        add(-i, 0);
        add(0, i);
        add(0, -i);
      }
      break;
    case 'circle': {
      add(0, 0);
      const ring: [number, number][] = [[0, 4], [1, 4], [2, 3], [3, 2], [4, 1], [4, 0]];
      for (const [a, b] of ring) for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) add(a * sx, b * sy);
      break;
    }
    case 'x':
      add(0, 0);
      for (let i = 2; i <= 4; i++) {
        add(i, i);
        add(-i, i);
        add(i, -i);
        add(-i, -i);
      }
      break;
  }
  const seen = new Set<string>();
  return px.filter(([x, y]) => {
    const k = `${x},${y}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** A 15 × 15 picture of a design (white on clear), for the panel. */
export function crosshairImage(design: CrosshairDesign, scale = 1): Img {
  const out = createImageData(15 * scale, 15 * scale);
  paintCrosshair(out, crosshairPixels(design), 0, 0, scale);
  return out;
}

function paintCrosshair(img: Img, px: [number, number][], ox: number, oy: number, scale: number): void {
  const d = img.data;
  for (const [x, y] of px) {
    for (let dy = 0; dy < scale; dy++) {
      for (let dx = 0; dx < scale; dx++) {
        const X = ox + x * scale + dx;
        const Y = oy + y * scale + dy;
        if (X < 0 || Y < 0 || X >= img.width || Y >= img.height) continue;
        const i = (Y * img.width + X) * 4;
        d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 255;
      }
    }
  }
}

/** The crosshair's area in the texture (pixels of the texture as it is, HD packs included). */
export function crosshairCell(img: Pick<Img, 'width' | 'height'>, kind: CrosshairTarget['kind']): { x: number; y: number; w: number; h: number; scale: number } {
  if (kind === 'sprite') {
    const scale = Math.max(1, Math.floor(img.width / 15));
    return { x: 0, y: 0, w: img.width, h: img.height, scale };
  }
  const scale = Math.max(1, Math.round(img.width / 256));
  return { x: 0, y: 0, w: 16 * scale, h: 16 * scale, scale };
}

/** The texture with its crosshair replaced by a design (the rest of a sheet stays). */
export function withCrosshair(img: Img, kind: CrosshairTarget['kind'], design: CrosshairDesign): Img {
  const out = copy(img);
  const cell = crosshairCell(img, kind);
  const d = out.data;
  for (let y = cell.y; y < Math.min(img.height, cell.y + cell.h); y++) d.fill(0, (y * img.width + cell.x) * 4, (y * img.width + Math.min(img.width, cell.x + cell.w)) * 4);
  paintCrosshair(out, crosshairPixels(design), cell.x, cell.y, cell.scale);
  return out;
}

/** A short hash of an image's pixels (tells whether a texture was painted after a tweak wrote it). */
export function imageHash(img: Img): string {
  let h = 0x811c9dc5 ^ img.width ^ (img.height << 16);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    // the colour under a clear pixel doesn't count (encoders may drop it)
    const clear = d[i + 3] === 0;
    for (let k = 0; k < 4; k++) {
      h ^= clear ? 0 : d[i + k];
      h = Math.imul(h, 0x01000193);
    }
  }
  return `${img.width}x${img.height}:${(h >>> 0).toString(16)}`;
}
