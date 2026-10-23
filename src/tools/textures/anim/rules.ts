// Which textures the game animates. Java animates the textures it stitches into an atlas: from 1.19.3
// the version's own assets/minecraft/atlases/*.json (and a pack's) list them; older versions by the
// code's rules: blocks and items always, particles, mob effects and paintings from 1.14 (their
// atlases), chests, beds, shulker boxes, signs, banners, shields, the conduit, bell and enchanting
// table book from 1.15 (texture sheets). GUI sprites (gui/sprites, 1.20.2+) come with the atlases.
// Bedrock only animates block textures: a flipbook entry names a terrain_texture.json tile, and item
// textures (item_texture.json) have no flipbooks. No DOM.

import type { AssetIndex, TexturePackProject } from '../../../core/types';
import { parseJsonLoose } from '../project';
import { FLIPBOOK_PATH, javaAnimRules, mergeTerrain, parseFlipbooks, terrainTilesOf } from './pack';

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const JAVA_ROOT = 'assets/minecraft/textures/';
const TERRAIN = 'textures/terrain_texture.json';

/** Why a texture can't be animated (null: it can). */
export type AnimBlock =
  /** the pack icon */
  | 'icon'
  /** Java: the game draws it without an atlas (mob skins, the old GUI, fonts, colour maps...) */
  | 'javaNoAtlas'
  /** Java before 1.13: frames are squares, and this texture isn't */
  | 'javaSquare'
  /** Bedrock: an item's picture */
  | 'bedrockItem'
  /** Bedrock: a block texture no terrain tile uses */
  | 'bedrockUnused'
  /** Bedrock: not a block texture */
  | 'bedrockOther'
  /** Bedrock: flipbook frames are squares */
  | 'bedrockSquare';

const OLD_ATLAS: [RegExp, string][] = [
  [/^(block|blocks|item|items)\//, '1.6'],
  [/^(particle|mob_effect|painting)\//, '1.14'],
  [/^entity\/(chest|bed|shulker|signs|banner|shield|conduit)\//, '1.15'],
  [/^entity\/(bell\/bell_body|enchanting_table_book)$/, '1.15'],
];

/** Sprite ids (relative to textures/, no extension) and folders an atlas definition takes in. */
function atlasSources(json: unknown, dirs: string[], singles: Set<string>): void {
  const sources = isObj(json) && Array.isArray(json.sources) ? json.sources : [];
  for (const s of sources) {
    if (!isObj(s)) continue;
    const type = String(s.type ?? '').replace(/^minecraft:/, '');
    if (type === 'directory' && typeof s.source === 'string') dirs.push(s.source.replace(/\/+$/, '') + '/');
    else if (type === 'single' && typeof s.resource === 'string') singles.add(s.resource.replace(/^minecraft:/, ''));
  }
}

const atlasCache = new WeakMap<AssetIndex, Promise<{ dirs: string[]; singles: Set<string> } | null>>();

/** The game's atlas definitions (1.19.3+), or null for versions without them. */
function gameAtlases(assets: AssetIndex): Promise<{ dirs: string[]; singles: Set<string> } | null> {
  let p = atlasCache.get(assets);
  if (!p) {
    p = (async () => {
      const files = assets.listFiles('assets/minecraft/atlases/').filter((f) => f.endsWith('.json'));
      if (!files.length) return null;
      const dirs: string[] = [];
      const singles = new Set<string>();
      for (const f of files) {
        try {
          atlasSources(parseJsonLoose(await assets.readText(f)), dirs, singles);
        } catch {
          /* unreadable: skipped */
        }
      }
      return { dirs, singles };
    })();
    atlasCache.set(assets, p);
  }
  return p;
}

/** Whether Java stitches the texture into an atlas (and so can animate it). */
export async function javaAnimates(path: string, project: TexturePackProject, assets: AssetIndex): Promise<boolean> {
  if (!path.startsWith(JAVA_ROOT) || !/\.png$/i.test(path)) return false;
  const id = path.slice(JAVA_ROOT.length).replace(/\.png$/i, '');
  const game = await gameAtlases(assets).catch(() => null);
  if (game) {
    const dirs = [...game.dirs];
    const singles = new Set(game.singles);
    // a pack can add folders and sprites to the atlases
    for (const [p, blob] of Object.entries(project.extraFiles)) {
      if (!/^assets\/minecraft\/atlases\/[^/]+\.json$/.test(p)) continue;
      try {
        atlasSources(parseJsonLoose(await blob.text()), dirs, singles);
      } catch {
        /* skipped */
      }
    }
    return singles.has(id) || dirs.some((d) => id.startsWith(d));
  }
  const rules = (release: string) => {
    if (release === '1.6') return true;
    const m = /^1\.(\d+)/.exec(project.version.trim());
    return !m || Number(m[1]) >= Number(release.split('.')[1]);
  };
  return OLD_ATLAS.some(([re, from]) => re.test(id) && rules(from));
}

const terrainCache = new WeakMap<AssetIndex, Promise<unknown>>();

/** The game's terrain_texture.json under the pack's own. */
export async function bedrockTerrain(project: TexturePackProject, assets: AssetIndex): Promise<unknown> {
  let p = terrainCache.get(assets);
  if (!p) {
    p = assets.hasFile(TERRAIN) ? assets.readText(TERRAIN).then((t) => parseJsonLoose(t), () => null) : Promise.resolve(null);
    terrainCache.set(assets, p);
  }
  const game = await p;
  const own = project.extraFiles[TERRAIN];
  const pack = own ? parseJsonLoose(await own.text().catch(() => '')) : null;
  return mergeTerrain(game, pack);
}

/** Why the texture at `path` (w x h, frames fw x fh) can't be animated, or null when it can. */
export async function animBlock(path: string, frame: { w: number; h: number }, project: TexturePackProject, assets: AssetIndex): Promise<AnimBlock | null> {
  if (project.edition === 'java') {
    if (!(await javaAnimates(path, project, assets))) return 'javaNoAtlas';
    if (!javaAnimRules(project.version).layout && frame.w !== frame.h) return 'javaSquare';
    return null;
  }
  const stem = path.replace(/\.(png|tga)$/i, '');
  const tiles = terrainTilesOf(await bedrockTerrain(project, assets), stem);
  // the pack's own flipbook list can name it too
  const own = project.extraFiles[FLIPBOOK_PATH];
  const listed = own ? parseFlipbooks(await own.text().catch(() => '')).some((e) => e.flipbook_texture.replace(/\.(png|tga)$/i, '') === stem) : false;
  if (!tiles.length && !listed) {
    if (/^textures\/items\//.test(path)) return 'bedrockItem';
    return /^textures\/blocks\//.test(path) ? 'bedrockUnused' : 'bedrockOther';
  }
  if (frame.w !== frame.h) return 'bedrockSquare';
  return null;
}
