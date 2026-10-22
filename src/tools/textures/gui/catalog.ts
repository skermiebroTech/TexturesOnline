// The game's interface textures, grouped the way people think of them (HUD, screens, buttons, menu
// backgrounds, title screen, enchantment glint), resolved to the files of one game version. Pure (no
// DOM, no storage): the GUI library lists it, the GUI preview draws from it.
//
// What the game reads (checked against the client jars 1.6.1 – 26.4 and bedrock-samples):
// - Java up to 1.20.1 draws the HUD and buttons from two 256 × 256 atlases, textures/gui/icons.png
//   (crosshair, hearts, hunger, armour, air, experience bar) and textures/gui/widgets.png (hotbar,
//   selection, off-hand slots, buttons). Areas are at fixed places, scaled with the image in HD packs.
//   Frozen hearts came in 1.17, the off-hand slots in 1.9.
// - Java 1.20.2 and newer read one file per sprite from textures/gui/sprites/** (hud/heart/full.png,
//   widget/button.png ...); buttons there have a .mcmeta saying how they stretch (nine-slice).
// - Containers are whole files in every version (gui/container/*.png, the screen in the top-left
//   176 × 166 of a 256 × 256 image); the furnace's flame and arrow sit right of it until 1.20.1 and
//   are sprites (container/furnace/*) since.
// - Menu backgrounds: gui/options_background.png (dirt) until 1.20.4, gui/menu_background.png and
//   friends from 1.20.5. The title screen panorama is gui/title/background/panorama_0..5.png (front,
//   right, back, left, top, bottom); from 1.15 the client jar only has 1 × 1 stand-ins for them and
//   the real images come with the game's other assets (see editions/java/asset-objects.ts).
// - The enchantment glint is misc/enchanted_item_glint.png until 1.18, then misc/enchanted_glint_item
//   and _entity.png (26.x: _item and _armor).
// - Bedrock draws the HUD from single files in textures/ui (heart.png, hotbar_0..8.png ...), the
//   crosshair from the top-left of textures/gui/icons.png, its classic buttons and container windows
//   from nine-slice files with a .json beside them, and the panorama from textures/ui/panorama_0..5.png.
// - Splash texts: assets/minecraft/texts/splashes.txt (Java, one per line, replaces the game's list)
//   and splashes.json at the root of a Bedrock pack ({ "splashes": [...] }).

import type { Edition } from '../../../core/types';
import { bundledPackFormat, comparePackFormats } from '../../../editions/java/packformats';

export type GuiSectionId = 'hud' | 'screens' | 'widgets' | 'backgrounds' | 'title' | 'glint';
/** The screens of the GUI preview */
export type GuiScreen = 'hud' | 'inventory' | 'title' | 'menu' | 'glint';
export type ContainerId = 'inventory' | 'chest' | 'largeChest' | 'furnace' | 'crafting';

export const GUI_SECTIONS: readonly GuiSectionId[] = ['hud', 'screens', 'widgets', 'backgrounds', 'title', 'glint'];
export const GUI_SCREENS: readonly GuiScreen[] = ['hud', 'inventory', 'title', 'menu', 'glint'];
export const CONTAINERS: readonly ContainerId[] = ['inventory', 'chest', 'largeChest', 'furnace', 'crafting'];

export type GuiPartId =
  | 'hotbar'
  | 'crosshair'
  | 'hearts'
  | 'heartsPoisoned'
  | 'heartsWithered'
  | 'heartsAbsorbing'
  | 'heartsFrozen'
  | 'heartsHardcore'
  | 'heartsMount'
  | 'food'
  | 'foodHunger'
  | 'armor'
  | 'air'
  | 'xp'
  | 'inventory'
  | 'chest'
  | 'furnace'
  | 'crafting'
  | 'window'
  | 'button'
  | 'backgrounds'
  | 'panorama'
  | 'logo'
  | 'splashes'
  | 'glint';

/** Names of the pieces of a part (labels in the GUI library's text). */
export type GuiPieceKey =
  | 'bar' | 'selected' | 'offhandLeft' | 'offhandRight' | 'startCap' | 'endCap'
  | 'slot1' | 'slot2' | 'slot3' | 'slot4' | 'slot5' | 'slot6' | 'slot7' | 'slot8' | 'slot9'
  | 'crosshair'
  | 'empty' | 'full' | 'half' | 'emptyFlash' | 'fullFlash' | 'halfFlash' | 'popping' | 'nub'
  | 'window' | 'flame' | 'arrow' | 'panel' | 'slot'
  | 'normal' | 'hover' | 'disabled' | 'pressed'
  | 'dirt' | 'lightDirt' | 'menu' | 'inworldMenu' | 'list' | 'inworldList' | 'headerSeparator' | 'footerSeparator'
  | 'front' | 'right' | 'back' | 'left' | 'top' | 'bottom' | 'overlay'
  | 'logo' | 'edition'
  | 'item' | 'entity' | 'armor';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GuiPiece {
  /** '<part>.<key>', e.g. 'hearts.full' */
  id: string;
  part: GuiPartId;
  key: GuiPieceKey;
  /** Pack path of the texture */
  path: string;
  /** Area of an atlas in its vanilla pixels (absent: the whole texture) */
  region?: Rect;
  /** Vanilla width of that atlas (areas scale with the image: an HD copy has bigger ones) */
  atlas?: number;
}

export interface GuiPart {
  id: GuiPartId;
  section: GuiSectionId;
  /** The preview screen that shows it */
  screen: GuiScreen;
  /** For screen parts: the container to show */
  container?: ContainerId;
  pieces: GuiPiece[];
}

export interface GuiCatalog {
  edition: Edition;
  version: string;
  /** Java before 1.20.2: the HUD and buttons are areas of gui/icons.png and gui/widgets.png */
  atlases: boolean;
  parts: GuiPart[];
  /** Screens the preview can show for this version */
  screens: GuiScreen[];
  /** Where the pack's splash texts go */
  splashPath: string;
  piece(id: string): GuiPiece | undefined;
  /** Pieces drawn from a texture */
  piecesOf(path: string): GuiPiece[];
  part(id: GuiPartId): GuiPart | undefined;
}

// ---------------------------------------------------------------------------------------------
// Versions

/** Whether a Java version is the given release or newer (unknown ids: snapshots and newer, true). */
export function javaAtLeast(version: string, release: string): boolean {
  const f = bundledPackFormat(version.trim());
  const r = bundledPackFormat(release);
  if (!r) return true;
  if (!f) return !/^1\.\d+(\.\d+)?$/.test(version.trim());
  return comparePackFormats(f, r) >= 0;
}

// ---------------------------------------------------------------------------------------------
// Tables

/** An area of a Java atlas: file under textures/gui/, x, y, w, h (in its 256 × 256 pixels) */
type AtlasRef = [file: string, x: number, y: number, w: number, h: number];

interface PieceDef {
  key: GuiPieceKey;
  /** Java 1.20.2+: path under textures/gui/sprites/ without .png */
  sprite?: string;
  /** Java before 1.20.2 */
  atlas?: AtlasRef;
  /** The atlas area exists from this release */
  since?: string;
  /** A whole texture: paths under the texture root (the first one the version has) */
  file?: string | string[];
}

interface PartDef {
  id: GuiPartId;
  section: GuiSectionId;
  screen: GuiScreen;
  container?: ContainerId;
  pieces: PieceDef[];
}

const icons = (x: number, y: number, w = 9, h = 9): AtlasRef => ['icons.png', x, y, w, h];
const widgets = (x: number, y: number, w: number, h: number): AtlasRef => ['widgets.png', x, y, w, h];
const heart = (key: GuiPieceKey, sprite: string, x?: number, y = 0, since?: string): PieceDef => ({ key, sprite: `hud/heart/${sprite}`, ...(x === undefined ? {} : { atlas: icons(x, y) }), ...(since ? { since } : {}) });

const JAVA_PARTS: PartDef[] = [
  {
    id: 'hotbar',
    section: 'hud',
    screen: 'hud',
    pieces: [
      { key: 'bar', sprite: 'hud/hotbar', atlas: widgets(0, 0, 182, 22) },
      { key: 'selected', sprite: 'hud/hotbar_selection', atlas: widgets(0, 22, 24, 24) },
      { key: 'offhandLeft', sprite: 'hud/hotbar_offhand_left', atlas: widgets(24, 22, 29, 24), since: '1.9' },
      { key: 'offhandRight', sprite: 'hud/hotbar_offhand_right', atlas: widgets(53, 22, 29, 24), since: '1.9' },
    ],
  },
  { id: 'crosshair', section: 'hud', screen: 'hud', pieces: [{ key: 'crosshair', sprite: 'hud/crosshair', atlas: icons(0, 0, 15, 15) }] },
  {
    id: 'hearts',
    section: 'hud',
    screen: 'hud',
    pieces: [heart('full', 'full', 52), heart('half', 'half', 61), heart('empty', 'container', 16), heart('fullFlash', 'full_blinking', 70), heart('halfFlash', 'half_blinking', 79), heart('emptyFlash', 'container_blinking', 25)],
  },
  { id: 'heartsPoisoned', section: 'hud', screen: 'hud', pieces: [heart('full', 'poisoned_full', 88), heart('half', 'poisoned_half', 97), heart('fullFlash', 'poisoned_full_blinking', 106), heart('halfFlash', 'poisoned_half_blinking', 115)] },
  { id: 'heartsWithered', section: 'hud', screen: 'hud', pieces: [heart('full', 'withered_full', 124), heart('half', 'withered_half', 133), heart('fullFlash', 'withered_full_blinking', 142), heart('halfFlash', 'withered_half_blinking', 151)] },
  { id: 'heartsAbsorbing', section: 'hud', screen: 'hud', pieces: [heart('full', 'absorbing_full', 160), heart('half', 'absorbing_half', 169), heart('fullFlash', 'absorbing_full_blinking'), heart('halfFlash', 'absorbing_half_blinking')] },
  {
    id: 'heartsFrozen',
    section: 'hud',
    screen: 'hud',
    pieces: [heart('full', 'frozen_full', 178, 0, '1.17'), heart('half', 'frozen_half', 187, 0, '1.17'), heart('fullFlash', 'frozen_full_blinking'), heart('halfFlash', 'frozen_half_blinking')],
  },
  {
    id: 'heartsHardcore',
    section: 'hud',
    screen: 'hud',
    pieces: [
      heart('full', 'hardcore_full', 52, 45),
      heart('half', 'hardcore_half', 61, 45),
      heart('empty', 'container_hardcore', 16, 45),
      heart('fullFlash', 'hardcore_full_blinking', 70, 45),
      heart('halfFlash', 'hardcore_half_blinking', 79, 45),
      heart('emptyFlash', 'container_hardcore_blinking', 25, 45),
    ],
  },
  { id: 'heartsMount', section: 'hud', screen: 'hud', pieces: [heart('full', 'vehicle_full', 88, 9), heart('half', 'vehicle_half', 97, 9), heart('empty', 'vehicle_container', 52, 9)] },
  {
    id: 'food',
    section: 'hud',
    screen: 'hud',
    pieces: [
      { key: 'full', sprite: 'hud/food_full', atlas: icons(52, 27) },
      { key: 'half', sprite: 'hud/food_half', atlas: icons(61, 27) },
      { key: 'empty', sprite: 'hud/food_empty', atlas: icons(16, 27) },
    ],
  },
  {
    id: 'foodHunger',
    section: 'hud',
    screen: 'hud',
    pieces: [
      { key: 'full', sprite: 'hud/food_full_hunger', atlas: icons(88, 27) },
      { key: 'half', sprite: 'hud/food_half_hunger', atlas: icons(97, 27) },
      { key: 'empty', sprite: 'hud/food_empty_hunger', atlas: icons(133, 27) },
    ],
  },
  {
    id: 'armor',
    section: 'hud',
    screen: 'hud',
    pieces: [
      { key: 'full', sprite: 'hud/armor_full', atlas: icons(34, 9) },
      { key: 'half', sprite: 'hud/armor_half', atlas: icons(25, 9) },
      { key: 'empty', sprite: 'hud/armor_empty', atlas: icons(16, 9) },
    ],
  },
  {
    id: 'air',
    section: 'hud',
    screen: 'hud',
    pieces: [
      { key: 'full', sprite: 'hud/air', atlas: icons(16, 18) },
      { key: 'popping', sprite: 'hud/air_bursting', atlas: icons(25, 18) },
      { key: 'empty', sprite: 'hud/air_empty' },
    ],
  },
  {
    id: 'xp',
    section: 'hud',
    screen: 'hud',
    pieces: [
      { key: 'empty', sprite: 'hud/experience_bar_background', atlas: icons(0, 64, 182, 5) },
      { key: 'full', sprite: 'hud/experience_bar_progress', atlas: icons(0, 69, 182, 5) },
    ],
  },
  { id: 'inventory', section: 'screens', screen: 'inventory', container: 'inventory', pieces: [{ key: 'window', file: 'gui/container/inventory.png' }] },
  { id: 'chest', section: 'screens', screen: 'inventory', container: 'chest', pieces: [{ key: 'window', file: 'gui/container/generic_54.png' }] },
  {
    id: 'furnace',
    section: 'screens',
    screen: 'inventory',
    container: 'furnace',
    pieces: [
      { key: 'window', file: 'gui/container/furnace.png' },
      { key: 'flame', sprite: 'container/furnace/lit_progress', atlas: ['container/furnace.png', 176, 0, 14, 14] },
      { key: 'arrow', sprite: 'container/furnace/burn_progress', atlas: ['container/furnace.png', 176, 14, 24, 17] },
    ],
  },
  { id: 'crafting', section: 'screens', screen: 'inventory', container: 'crafting', pieces: [{ key: 'window', file: 'gui/container/crafting_table.png' }] },
  {
    id: 'button',
    section: 'widgets',
    screen: 'title',
    pieces: [
      { key: 'normal', sprite: 'widget/button', atlas: widgets(0, 66, 200, 20) },
      { key: 'hover', sprite: 'widget/button_highlighted', atlas: widgets(0, 86, 200, 20) },
      { key: 'disabled', sprite: 'widget/button_disabled', atlas: widgets(0, 46, 200, 20) },
    ],
  },
  {
    id: 'backgrounds',
    section: 'backgrounds',
    screen: 'menu',
    pieces: [
      { key: 'menu', file: 'gui/menu_background.png' },
      { key: 'inworldMenu', file: 'gui/inworld_menu_background.png' },
      { key: 'list', file: 'gui/menu_list_background.png' },
      { key: 'inworldList', file: 'gui/inworld_menu_list_background.png' },
      { key: 'dirt', file: 'gui/options_background.png' },
      { key: 'lightDirt', file: 'gui/light_dirt_background.png' },
      { key: 'headerSeparator', file: 'gui/header_separator.png' },
      { key: 'footerSeparator', file: 'gui/footer_separator.png' },
    ],
  },
  {
    id: 'panorama',
    section: 'title',
    screen: 'title',
    pieces: (['front', 'right', 'back', 'left', 'top', 'bottom'] as const)
      .map((key, i): PieceDef => ({ key, file: `gui/title/background/panorama_${i}.png` }))
      .concat([{ key: 'overlay', file: 'gui/title/background/panorama_overlay.png' }]),
  },
  { id: 'logo', section: 'title', screen: 'title', pieces: [{ key: 'logo', file: 'gui/title/minecraft.png' }, { key: 'edition', file: 'gui/title/edition.png' }] },
  { id: 'splashes', section: 'title', screen: 'title', pieces: [] },
  {
    id: 'glint',
    section: 'glint',
    screen: 'glint',
    pieces: [
      { key: 'item', file: ['misc/enchanted_glint_item.png', 'misc/enchanted_item_glint.png'] },
      { key: 'entity', file: 'misc/enchanted_glint_entity.png' },
      { key: 'armor', file: 'misc/enchanted_glint_armor.png' },
    ],
  },
];

const ui = (key: GuiPieceKey, name: string): PieceDef => ({ key, file: `ui/${name}.png` });

const BEDROCK_PARTS: PartDef[] = [
  {
    id: 'hotbar',
    section: 'hud',
    screen: 'hud',
    pieces: [
      ...(['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'slot6', 'slot7', 'slot8', 'slot9'] as const).map((key, i) => ui(key, `hotbar_${i}`)),
      ui('selected', 'selected_hotbar_slot'),
      ui('startCap', 'hotbar_start_cap'),
      ui('endCap', 'hotbar_end_cap'),
    ],
  },
  { id: 'crosshair', section: 'hud', screen: 'hud', pieces: [{ key: 'crosshair', atlas: ['icons.png', 0, 0, 15, 15] }] },
  { id: 'hearts', section: 'hud', screen: 'hud', pieces: [ui('full', 'heart'), ui('half', 'heart_half'), ui('empty', 'heart_background'), ui('fullFlash', 'heart_flash'), ui('halfFlash', 'heart_flash_half'), ui('emptyFlash', 'heart_blink')] },
  { id: 'heartsPoisoned', section: 'hud', screen: 'hud', pieces: [ui('full', 'poison_heart'), ui('half', 'poison_heart_half'), ui('fullFlash', 'poison_heart_flash'), ui('halfFlash', 'poison_heart_flash_half')] },
  { id: 'heartsWithered', section: 'hud', screen: 'hud', pieces: [ui('full', 'wither_heart'), ui('half', 'wither_heart_half'), ui('fullFlash', 'wither_heart_flash'), ui('halfFlash', 'wither_heart_flash_half')] },
  { id: 'heartsAbsorbing', section: 'hud', screen: 'hud', pieces: [ui('full', 'absorption_heart'), ui('half', 'absorption_heart_half')] },
  { id: 'heartsFrozen', section: 'hud', screen: 'hud', pieces: [ui('full', 'freeze_heart'), ui('half', 'freeze_heart_half'), ui('fullFlash', 'freeze_heart_flash'), ui('halfFlash', 'freeze_heart_flash_half')] },
  { id: 'heartsHardcore', section: 'hud', screen: 'hud', pieces: [ui('full', 'hardcore/heart'), ui('half', 'hardcore/heart_half'), ui('fullFlash', 'hardcore/heart_flash'), ui('halfFlash', 'hardcore/heart_flash_half')] },
  { id: 'heartsMount', section: 'hud', screen: 'hud', pieces: [ui('full', 'horse_heart'), ui('half', 'horse_heart_half'), ui('fullFlash', 'horse_heart_flash'), ui('halfFlash', 'horse_heart_flash_half')] },
  { id: 'food', section: 'hud', screen: 'hud', pieces: [ui('full', 'hunger_full'), ui('half', 'hunger_half'), ui('empty', 'hunger_background'), ui('fullFlash', 'hunger_flash_full'), ui('halfFlash', 'hunger_flash_half'), ui('emptyFlash', 'hunger_blink')] },
  { id: 'foodHunger', section: 'hud', screen: 'hud', pieces: [ui('full', 'hunger_effect_full'), ui('half', 'hunger_effect_half'), ui('empty', 'hunger_effect_background')] },
  { id: 'armor', section: 'hud', screen: 'hud', pieces: [ui('full', 'armor_full'), ui('half', 'armor_half'), ui('empty', 'armor_empty')] },
  { id: 'air', section: 'hud', screen: 'hud', pieces: [ui('full', 'bubble'), ui('popping', 'bubble_pop'), ui('empty', 'bubble_empty')] },
  { id: 'xp', section: 'hud', screen: 'hud', pieces: [ui('empty', 'experiencebarempty'), ui('full', 'experiencebarfull'), ui('nub', 'experiencenub')] },
  { id: 'window', section: 'screens', screen: 'inventory', container: 'inventory', pieces: [ui('panel', 'dialog_background_opaque'), ui('slot', 'cell_image')] },
  { id: 'button', section: 'widgets', screen: 'title', pieces: [ui('normal', 'classic-button'), ui('hover', 'classic-button-hover'), ui('pressed', 'classic-button-pressed')] },
  {
    id: 'panorama',
    section: 'title',
    screen: 'title',
    pieces: (['front', 'right', 'back', 'left', 'top', 'bottom'] as const).map((key, i) => ui(key, `panorama_${i}`)).concat([ui('overlay', 'panorama_overlay')]),
  },
  { id: 'logo', section: 'title', screen: 'title', pieces: [ui('logo', 'title')] },
  { id: 'splashes', section: 'title', screen: 'title', pieces: [] },
  { id: 'glint', section: 'glint', screen: 'glint', pieces: [{ key: 'item', file: 'misc/enchanted_item_glint.png' }, { key: 'entity', file: 'misc/enchanted_actor_glint.png' }] },
];

// ---------------------------------------------------------------------------------------------
// Resolving

export const JAVA_TEXTURES = 'assets/minecraft/textures/';
export const BEDROCK_TEXTURES = 'textures/';
export const JAVA_SPLASHES = 'assets/minecraft/texts/splashes.txt';
export const BEDROCK_SPLASHES = 'splashes.json';

/** Whether a Java version reads single sprite files (1.20.2+) rather than the icons / widgets atlases. */
export function javaUsesSprites(has: (path: string) => boolean): boolean {
  return has(`${JAVA_TEXTURES}gui/sprites/hud/hotbar.png`) || !has(`${JAVA_TEXTURES}gui/widgets.png`);
}

/**
 * The interface textures of one game version. `has` tells whether the version (or the pack) has a
 * file: parts and pieces it doesn't have are left out.
 */
export function guiCatalog(edition: Edition, version: string, has: (path: string) => boolean): GuiCatalog {
  const root = edition === 'java' ? JAVA_TEXTURES : BEDROCK_TEXTURES;
  const sprites = edition === 'java' && javaUsesSprites(has);
  const parts: GuiPart[] = [];
  for (const def of edition === 'java' ? JAVA_PARTS : BEDROCK_PARTS) {
    const pieces: GuiPiece[] = [];
    for (const p of def.pieces) {
      const piece = resolvePiece(def.id, p, root, sprites, edition, version, has);
      if (piece) pieces.push(piece);
    }
    if (pieces.length || def.id === 'splashes') parts.push({ id: def.id, section: def.section, screen: def.screen, ...(def.container ? { container: def.container } : {}), pieces });
  }
  const byId = new Map(parts.flatMap((p) => p.pieces.map((x) => [x.id, x] as const)));
  const byPath = new Map<string, GuiPiece[]>();
  for (const p of byId.values()) byPath.set(p.path, [...(byPath.get(p.path) ?? []), p]);
  const screens = GUI_SCREENS.filter((s) => s === 'title' || parts.some((p) => p.screen === s));
  return {
    edition,
    version,
    atlases: edition === 'java' && !sprites,
    parts,
    screens,
    splashPath: edition === 'java' ? JAVA_SPLASHES : BEDROCK_SPLASHES,
    piece: (id) => byId.get(id),
    piecesOf: (path) => byPath.get(path) ?? [],
    part: (id) => parts.find((p) => p.id === id),
  };
}

function resolvePiece(part: GuiPartId, p: PieceDef, root: string, sprites: boolean, edition: Edition, version: string, has: (path: string) => boolean): GuiPiece | null {
  const id = `${part}.${p.key}`;
  if (p.file) {
    for (const f of [p.file].flat()) if (has(root + f)) return { id, part, key: p.key, path: root + f };
    return null;
  }
  if (edition === 'java' && sprites && p.sprite) {
    const path = `${root}gui/sprites/${p.sprite}.png`;
    return has(path) ? { id, part, key: p.key, path } : null;
  }
  if (p.atlas && (edition === 'bedrock' || !sprites) && (!p.since || edition === 'bedrock' || javaAtLeast(version, p.since))) {
    const [file, x, y, w, h] = p.atlas;
    const path = `${root}gui/${file}`;
    return has(path) ? { id, part, key: p.key, path, region: { x, y, w, h }, atlas: 256 } : null;
  }
  return null;
}

/** A piece's area in an image of the texture as it is (HD copies of an atlas have bigger areas). */
export function pieceRect(piece: Pick<GuiPiece, 'region' | 'atlas'>, img: { width: number; height: number }): Rect {
  if (!piece.region) return { x: 0, y: 0, w: img.width, h: img.height };
  const s = img.width / (piece.atlas ?? img.width);
  const r = piece.region;
  const x = Math.round(r.x * s);
  const y = Math.round(r.y * s);
  return { x, y, w: Math.max(1, Math.min(img.width - x, Math.round(r.w * s))), h: Math.max(1, Math.min(img.height - y, Math.round(r.h * s))) };
}

/** The part a texture belongs to, for following the open texture in the preview (null: not a GUI texture). */
export function partOfPath(cat: GuiCatalog, path: string): GuiPart | null {
  const pieces = cat.piecesOf(path);
  if (!pieces.length) return null;
  return cat.part(pieces[0].part) ?? null;
}
