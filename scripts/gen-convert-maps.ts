/**
 * Generates the texture mapping data used by the texture pack converter (texture PATHS only; no game
 * images are written anywhere):
 *
 *   src/editions/convert/java-bedrock.json   Java (latest release) <-> Bedrock (latest release) pairs
 *   src/editions/convert/java-renames.json   texture renames between consecutive Java releases
 *
 * Inputs (never stored in the repository):
 *   TO_FIXTURES   folder holding the research fixtures:
 *                   research-cache/jars/<version>.jar   Java client jars (client-26.3.jar also accepted)
 *                   research-cache/convert-jars/        release jars this script downloads when needed
 *                   manifest.json                       Mojang version manifest (to download missing jars)
 *   BEDROCK_SAMPLES (optional) a Mojang/bedrock-samples checkout (its resource_pack/ folder is read).
 *                 Default: $TO_FIXTURES/research-cache/bedrock-samples-v<version>, where <version> is the
 *                 release in public/data/bedrock/index-main.json. When missing it is fetched with a
 *                 blobless sparse git clone of that tag (resource_pack/textures and blocks.json only).
 *
 * Re-run:
 *   TO_FIXTURES=/path/to/fixtures npx tsx scripts/gen-convert-maps.ts [options]
 *     --only bedrock|renames   generate one of the two files
 *     --no-download            never download jars / bedrock-samples (missing intermediate jars are reported)
 *     --report <dir>           also write review reports (every pair with its evidence) to <dir>
 *
 * How pairs are found (java-bedrock.json), most trusted first:
 *   pixel  decoded RGBA identical (transparent pixels compared as transparent). Blank or single-colour
 *          images, and groups of several identical images, are only paired when the names agree.
 *   face   Java block model faces <-> Bedrock blocks.json/terrain_texture.json faces of the same block
 *          (src/shared/models/bedrock-java.ts: javaTargetFor + pickBedrockTexture, as the model viewer)
 *   item   Java item model layer textures <-> Bedrock item_texture.json entry of the same item id
 *   name   same file name after folder mapping (block -> blocks, item -> items...)
 *   near   same size and nearly the same pixels (Bedrock keeps an older revision of the art)
 *   manual OVERRIDES below (well-known renames), each checked like the others
 * Every non-pixel candidate is checked on the images: a different aspect ratio, or (for entity, GUI and
 * other multi-part textures) a different UV layout (opaque-pixel mask / luminance pattern), puts the pair
 * in "layoutDiffers" instead; a grey (tinted in game) texture against a pre-coloured one is dropped.
 *
 * Renames (java-renames.json): consecutive release jars are compared (releases from
 * src/editions/java/packformats.ts). Paths that disappeared are matched to new paths with identical
 * decoded pixels (name similarity settles groups of identical images), then to new paths with a similar
 * name and similar pixels, then RENAME_OVERRIDES. When two consecutive available jars differ and releases
 * between them have no jar, those jars are downloaded first so every step names the exact release.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
import { decodeImageSync } from '../src/core/image';
import { KNOWN_RELEASES } from '../src/editions/java/packformats';
import { bedrockTexturesFromFiles, catalogFromIndex, parseLenientJson, type BedrockIndexFile } from '../src/editions/bedrock/catalog';
import { atlasTextures, faceNames } from '../src/shared/models/bedrock-blocks';
import { JAVA_FORMS, JavaShapes, javaTargetFor, pickBedrockTexture, textureTokens, type TextureCandidate } from '../src/shared/models/bedrock-java';
import { allVariants, faceTexture, splitId, type JsonGet } from '../src/shared/models/java-models';
import { DIRS, type Dir } from '../src/shared/models/geometry';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'src/editions/convert');
const JAVA_LATEST = '26.3';
const JAVA_TEX = 'assets/minecraft/textures/';

// ---------------------------------------------------------------------------------------------
// Options and inputs

const argv = process.argv.slice(2);
const opt = (name: string) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const ONLY = opt('--only');
const NO_DOWNLOAD = argv.includes('--no-download');
const REPORT_DIR = opt('--report') ? resolve(opt('--report')!) : null;

const FX = process.env.TO_FIXTURES;
if (!FX || !existsSync(FX)) {
  console.error('Set TO_FIXTURES to the research fixtures folder (research-cache/jars/<version>.jar, manifest.json).');
  process.exit(1);
}
const JAR_DIR = join(FX, 'research-cache', 'jars');
/** Jars this script downloads (kept apart so other fixture-driven suites see the same jar set) */
const EXTRA_JAR_DIR = join(FX, 'research-cache', 'convert-jars');

function jarPath(version: string): string | null {
  const c = [join(JAR_DIR, `${version}.jar`), join(EXTRA_JAR_DIR, `${version}.jar`)];
  if (version === JAVA_LATEST) c.push(join(FX!, `client-${JAVA_LATEST}.jar`));
  return c.find((p) => existsSync(p)) ?? null;
}

function curl(url: string, out?: string): string {
  const args = ['-sSfL', '--retry', '3', url];
  if (out) args.push('-o', out);
  return execFileSync('curl', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/** Downloads a release client jar from Mojang into research-cache/convert-jars (analysis only). */
function downloadJar(version: string): string | null {
  if (NO_DOWNLOAD) return null;
  const manifestFile = join(FX!, 'manifest.json');
  const manifest = existsSync(manifestFile)
    ? (JSON.parse(readFileSync(manifestFile, 'utf8')) as { versions: { id: string; url: string }[] })
    : (JSON.parse(curl('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json')) as { versions: { id: string; url: string }[] });
  const entry = manifest.versions.find((v) => v.id === version);
  if (!entry) return null;
  const meta = JSON.parse(curl(entry.url)) as { downloads?: { client?: { url: string } } };
  const url = meta.downloads?.client?.url;
  if (!url) return null;
  mkdirSync(EXTRA_JAR_DIR, { recursive: true });
  const dest = join(EXTRA_JAR_DIR, `${version}.jar`);
  console.log(`  downloading ${version} client jar`);
  curl(url, `${dest}.part`);
  renameSync(`${dest}.part`, dest);
  return dest;
}

function readJar(path: string, filter: (name: string) => boolean): Record<string, Uint8Array> {
  return unzipSync(new Uint8Array(readFileSync(path)), { filter: (f) => !f.name.endsWith('/') && filter(f.name) });
}

/** Texture paths (relative to assets/minecraft/textures/, no extension) of a jar, without decoding. */
function jarTextureNames(path: string): string[] {
  const names: string[] = [];
  unzipSync(new Uint8Array(readFileSync(path)), {
    filter: (f) => {
      if (f.name.startsWith(JAVA_TEX) && f.name.endsWith('.png')) names.push(f.name.slice(JAVA_TEX.length, -4));
      return false;
    },
  });
  return names;
}

// ---------------------------------------------------------------------------------------------
// Images

interface Tex {
  path: string;
  w: number;
  h: number;
  /** RGBA with the colour of fully transparent pixels zeroed */
  px: Uint8Array;
  hash: string;
  /** Distinct colours, counted up to 3 */
  colors: number;
  /**
   * Bedrock: the alpha channel is a tint/dye mask, not see-through (grass_side with overlay_color, tame
   * wolf collars, leather armour): the colour under 'transparent' pixels is drawn.
   */
  alphaMask?: boolean;
}

function toTex(path: string, bytes: Uint8Array, ext = 'png'): Tex | null {
  let img: ImageData;
  try {
    img = decodeImageSync(bytes, ext);
  } catch {
    return null;
  }
  const px = new Uint8Array(img.data.length);
  px.set(img.data);
  const seen = new Set<number>();
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) px[i] = px[i + 1] = px[i + 2] = 0;
    if (seen.size < 3) seen.add(((px[i] << 24) | (px[i + 1] << 16) | (px[i + 2] << 8) | px[i + 3]) >>> 0);
  }
  const hash = createHash('sha1').update(`${img.width}x${img.height};`).update(px).digest('hex');
  return { path, w: img.width, h: img.height, px, hash, colors: seen.size };
}

/**
 * A TGA whose alpha is a dye/tint mask: partly see-through pixels (the mask) over colour that is still
 * there where alpha is 0.
 */
function dyeMask(bytes: Uint8Array): boolean {
  let img: ImageData;
  try {
    img = decodeImageSync(bytes, 'tga');
  } catch {
    return false;
  }
  const d = img.data;
  let hidden = 0;
  let semi = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0 && d[i] | d[i + 1] | d[i + 2]) hidden++;
    else if (d[i + 3] > 0 && d[i + 3] < 255) semi++;
  }
  const n = d.length / 4;
  return hidden > n * 0.05 && semi > n * 0.02;
}

const sameAspect = (a: Tex, b: Tex) => a.w * b.h === a.h * b.w;

/** A square texture turned (o & 3 quarter turns) and mirrored (o & 4). */
function orient(t: Tex, o: number): Tex {
  const n = t.w;
  const px = new Uint8Array(t.px.length);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      let sx = o & 4 ? n - 1 - x : x;
      let sy = y;
      for (let k = 0; k < (o & 3); k++) [sx, sy] = [sy, n - 1 - sx];
      px.set(t.px.subarray((sy * n + sx) * 4, (sy * n + sx) * 4 + 4), (y * n + x) * 4);
    }
  return { ...t, px };
}

/** Pixel at (x, y) of a texture sampled at another size (nearest). */
function sampler(t: Tex, w: number, h: number) {
  return (x: number, y: number) => {
    const sx = Math.floor(((x + 0.5) * t.w) / w);
    const sy = Math.floor(((y + 0.5) * t.h) / h);
    return (sy * t.w + sx) * 4;
  };
}

interface Similarity {
  /** Share of pixels where both are transparent or both visible */
  alpha: number;
  /** Share of pixels (visible in either) whose colours are close */
  close: number;
  /** Luminance correlation over pixels visible in both */
  lum: number;
  /** Mean saturation of visible pixels, each side */
  satA: number;
  satB: number;
  /** Either image has transparent pixels */
  transparent: boolean;
  /** Share of pixels visible in both whose alpha differs by more than 32 */
  alphaDiff: number;
}

/** Compares two images of the same aspect ratio at the smaller of the two sizes. */
function similarity(a: Tex, b: Tex): Similarity {
  const w = Math.min(a.w, b.w);
  const h = Math.min(a.h, b.h);
  const sa = sampler(a, w, h);
  const sb = sampler(b, w, h);
  let alphaSame = 0;
  let any = 0;
  let close = 0;
  let n = 0;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  let satA = 0, satB = 0, na = 0, nb = 0;
  let transparent = false;
  let alphaDiff = 0;
  const sat = (p: Uint8Array, i: number) => {
    const mx = Math.max(p[i], p[i + 1], p[i + 2]);
    const mn = Math.min(p[i], p[i + 1], p[i + 2]);
    return mx ? (mx - mn) / mx : 0;
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = sa(x, y);
      const j = sb(x, y);
      const va = a.px[i + 3] > 0;
      const vb = b.px[j + 3] > 0;
      if (!va || !vb || a.px[i + 3] < 255 || b.px[j + 3] < 255) transparent = transparent || !va || !vb;
      if (va === vb) alphaSame++;
      if (va && vb && Math.abs(a.px[i + 3] - b.px[j + 3]) > 32) alphaDiff++;
      if (va) (satA += sat(a.px, i)), na++;
      if (vb) (satB += sat(b.px, j)), nb++;
      if (!va && !vb) continue;
      any++;
      if (va && vb) {
        const d = Math.max(Math.abs(a.px[i] - b.px[j]), Math.abs(a.px[i + 1] - b.px[j + 1]), Math.abs(a.px[i + 2] - b.px[j + 2]));
        if (d <= 24) close++;
        const la = 0.299 * a.px[i] + 0.587 * a.px[i + 1] + 0.114 * a.px[i + 2];
        const lb = 0.299 * b.px[j] + 0.587 * b.px[j + 1] + 0.114 * b.px[j + 2];
        n++;
        sx += la;
        sy += lb;
        sxx += la * la;
        syy += lb * lb;
        sxy += la * lb;
      }
    }
  const cov = sxy / (n || 1) - (sx / (n || 1)) * (sy / (n || 1));
  const va = sxx / (n || 1) - (sx / (n || 1)) ** 2;
  const vb = syy / (n || 1) - (sy / (n || 1)) ** 2;
  const lum = n > 1 && va > 1e-6 && vb > 1e-6 ? cov / Math.sqrt(va * vb) : n > 1 && va <= 1e-6 && vb <= 1e-6 ? 1 : 0;
  return { alpha: alphaSame / (w * h), close: any ? close / any : 1, lum, satA: na ? satA / na : 0, satB: nb ? satB / nb : 0, transparent, alphaDiff: alphaDiff / (w * h) };
}

// ---------------------------------------------------------------------------------------------
// Names

/** Words of a texture file name: lower case, split at '_', camelCase and digits ('stage0' -> stage, 0). */
function words(path: string): string[] {
  const leaf = path.slice(path.lastIndexOf('/') + 1);
  return leaf
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/([a-z])(\d)/g, '$1_$2')
    .replace(/(\d)([a-z])/g, '$1_$2')
    .split(/[_\s.-]+/)
    .filter(Boolean)
    .map((w) => (/^\d+$/.test(w) ? String(Number(w)) : w));
}

const BEDROCK_WORDS: Record<string, string> = { silver: 'light_gray', big_oak: 'dark_oak', darkoak: 'dark_oak', lightblue: 'light_blue', normal: '', carried: '' };

function wordSet(path: string): Set<string> {
  let leaf = path.slice(path.lastIndexOf('/') + 1).toLowerCase();
  for (const [k, v] of Object.entries(BEDROCK_WORDS)) leaf = leaf.replace(new RegExp(`(^|_)${k}(?=_|$)`, 'g'), v ? `$1${v}` : '$1');
  return new Set(words(leaf));
}

/** 0..1 name similarity of two texture paths (file names only). */
function nameScore(a: string, b: string): number {
  const la = a.slice(a.lastIndexOf('/') + 1).toLowerCase();
  const lb = b.slice(b.lastIndexOf('/') + 1).toLowerCase();
  if (la === lb) return 1;
  const ca = la.replace(/[^a-z0-9]/g, '');
  const cb = lb.replace(/[^a-z0-9]/g, '');
  if (ca === cb) return 0.98;
  const A = wordSet(a);
  const B = wordSet(b);
  const shared = [...A].filter((w) => B.has(w)).length;
  let s = shared / (A.size + B.size - shared || 1);
  if (s >= 0.999) return 0.95;
  // One name contains the other as a word ('mason' / 'stonemason', 'absorbing' / 'absorption').
  if (ca.length >= 4 && cb.length >= 4 && (ca.includes(cb) || cb.includes(ca))) s = Math.max(s, 0.6);
  const prefix = (x: string, y: string) => {
    let i = 0;
    while (i < x.length && i < y.length && x[i] === y[i]) i++;
    return i;
  };
  let stem = 0;
  for (const x of A) for (const y of B) if (x !== y && prefix(x, y) >= 6) stem++;
  if (stem) s = Math.max(s, (shared + stem) / (A.size + B.size - shared - stem || 1));
  return s;
}

// ---------------------------------------------------------------------------------------------
// Java <-> Bedrock

const JAVA_TO_BEDROCK_DIRS: Record<string, string[]> = {
  block: ['blocks'],
  item: ['items'],
  entity: ['entity', 'models'],
  trims: ['trims'],
  palettes: ['trims'],
  gui: ['ui', 'gui'],
  mob_effect: ['ui', 'gui'],
  particle: ['particle', 'particles'],
  environment: ['environment'],
  painting: ['painting'],
  map: ['map'],
  misc: ['misc', ''],
  colormap: ['colormap'],
};

const top = (p: string) => (p.includes('/') ? p.slice(0, p.indexOf('/')) : '');
const compatible = (j: string, b: string) => (JAVA_TO_BEDROCK_DIRS[top(j)] ?? []).includes(top(b));
/**
 * Folder check for multi-part textures matched by file name: the Java folder names the Bedrock folder
 * (entity/cow/cow -> entity/cow/cow_cold), or Bedrock keeps it flat and the Java folder is part of the
 * name (entity/bear/polarbear -> entity/polarbear). Keeps banner patterns off shield patterns.
 */
function sameFolder(j: string, b: string): boolean {
  const jd = j.split('/').slice(1, -1);
  const bd = b.split('/').slice(1, -1);
  if (!jd.length) return true;
  const parent = jd[jd.length - 1].replace(/_/g, '');
  const bw = new Set(bd.flatMap((d) => d.split('_')));
  if (jd.some((d) => d.split('_').some((w) => w.length > 2 && bw.has(w)))) return true;
  if (bd.length) return false;
  const leaf = (p: string) => p.slice(p.lastIndexOf('/') + 1).replace(/_/g, '');
  return leaf(j).includes(parent) || leaf(b).includes(parent);
}

/** Words that name another state or look of a texture: both sides must agree on them. */
const QUALIFIERS = ['hardcore', 'baby', 'carried', 'opaque', 'blinking', 'flash', 'open', 'closed', 'powered', 'lit', 'on', 'off', 'overlay', 'angry', 'tame', 'top', 'bottom', 'side', 'front', 'back', 'half', 'full', 'empty'];
function sameQualifiers(j: string, b: string): boolean {
  const ws = (p: string) => new Set(p.split('/').slice(1).flatMap((s) => words(s)));
  const a = ws(j);
  const c = ws(b);
  return QUALIFIERS.every((q) => a.has(q) === c.has(q));
}

/** Textures drawn as one tile (blocks, items, particles...): any same-shaped image fits. */
const isTile = (j: string) => /^(block|item|particle|mob_effect|painting|map\/decorations|gui\/title\/background\/panorama_\d)(\/|$)/.test(j);

/**
 * Well-known renames the automatic passes miss (Java path, Bedrock path). Each is still checked on the
 * images like every other candidate.
 */
const OVERRIDES: [string, string][] = [
  ['block/grass_block_top', 'blocks/grass_top'],
  // The compass icon is the frame pointing north (identical pixels; frame numbers don't name it)
  ['item/compass_19', 'items/compass_item'],
  ['block/grass_block_snow', 'blocks/grass_block_snow'],
  ['block/water_still', 'blocks/water_still_grey'],
  ['block/water_flow', 'blocks/water_flow_grey'],
  ['block/lava_still', 'blocks/lava_still'],
  ['block/lava_flow', 'blocks/lava_flow'],
  ['environment/celestial/sun', 'environment/sun'],
  ['environment/clouds', 'environment/clouds'],
  ['misc/pumpkinblur', 'misc/pumpkinblur'],
  ['misc/powder_snow_outline', 'ui/frozen_effect'],
  ['misc/spyglass_scope', 'ui/spyglass_scope'],
  ['map/map_background', 'map/map_background'],
  ['entity/conduit/cage', 'blocks/conduit_cage'],
  ['entity/conduit/wind', 'blocks/conduit_wind_horizontal'],
  ['entity/conduit/wind_vertical', 'blocks/conduit_wind_vertical'],
  ['entity/strider/strider_cold', 'entity/strider/strider_suffocated'],
  ['entity/cat/cat_red', 'entity/cat/redtabby'],
  ['item/golden_spear_in_hand', 'entity/spear/gold_spear'],
  ['item/wooden_spear_in_hand', 'entity/spear/wood_spear'],
  ['item/glass_bottle', 'items/potion_bottle_empty'],
  ['item/splash_potion', 'items/potion_bottle_splash'],
  ['mob_effect/hero_of_the_village', 'ui/village_hero_effect'],
  ['mob_effect/hero_of_the_village', 'gui/newgui/mob_effects/village_hero_effect'],
  ['gui/sprites/hud/heart/absorbing_full', 'ui/absorption_heart'],
  ['gui/sprites/hud/heart/absorbing_hardcore_full', 'ui/hardcore/absorption_heart'],
  ['gui/sprites/hud/heart/container', 'ui/heart_background'],
  ['gui/sprites/hud/heart/container_blinking', 'ui/heart_blink'],
  ['gui/sprites/hud/heart/frozen_hardcore_full', 'ui/hardcore/freeze_heart'],
  ['gui/sprites/hud/heart/frozen_hardcore_half', 'ui/hardcore/freeze_heart_half'],
  ['entity/lead_knot/lead_knot', 'entity/lead_knot'],
  ['entity/minecart/minecart', 'entity/minecart'],
  ['entity/trident/trident', 'entity/trident'],
  ['entity/projectiles/arrow', 'entity/arrows'],
  ['entity/projectiles/wind_charge', 'entity/wind_charge'],
  ['entity/enderdragon/dragon', 'entity/dragon/dragon'],
  ['entity/enderdragon/dragon_exploding', 'entity/dragon/dragon_exploding'],
  ['entity/enderdragon/dragon_eyes', 'entity/dragon/dragon_eyes'],
  ['entity/armorstand/armorstand', 'entity/armor_stand'],
  ['entity/banner/banner_base', 'entity/banner/banner'],
  ['entity/shield/base', 'entity/shield'],
  ['entity/player/wide/steve', 'entity/steve'],
  ['entity/player/slim/alex', 'entity/alex'],
];

/** Pairs the automatic passes would make but that are wrong (different role despite the name/model). */
const REJECT: [string, string][] = [
  // Bedrock's 'stonecutter' textures are the old (pre-1.14) stonecutter; the current one is stonecutter2_*
  ['block/stonecutter_top', 'blocks/stonecutter_top'],
  ['block/stonecutter_bottom', 'blocks/stonecutter_bottom'],
  ['block/stonecutter_side', 'blocks/stonecutter_side'],
  // Bedrock's Steve is the wide (4 px arm) skin and Alex the slim (3 px arm) one
  ['entity/player/slim/steve', 'entity/steve'],
  ['entity/player/wide/alex', 'entity/alex'],
];

/**
 * Same part, but the image is arranged differently even where the pixels look alike: Java 1.15+ chests
 * have the lid and base flipped compared to Bedrock; double chests are two halves on Java and one image
 * on Bedrock; Bedrock's pig saddle and weather sheet; a shield base vs Bedrock's full shield; Bedrock's
 * grass side is one TGA whose alpha marks the tinted fringe (Java: side + grey overlay); atlases
 * (moon phases, particles, paintings, map icons) where Java has one image per sprite.
 */
const LAYOUT_DIFFERS: [string, string][] = [
  ['block/grass_block_side', 'blocks/grass_side'],
  ['block/grass_block_side_overlay', 'blocks/grass_side'],
  ['entity/conduit/base', 'blocks/conduit_base'],
  ['entity/conduit/open_eye', 'blocks/conduit_open'],
  ['entity/conduit/closed_eye', 'blocks/conduit_closed'],
  ['map/decorations/player', 'map/map_icons'],
  ['entity/chest/normal', 'entity/chest/normal'],
  ['entity/chest/normal_left', 'entity/chest/double_normal'],
  ['entity/chest/normal_right', 'entity/chest/double_normal'],
  ['entity/chest/trapped', 'entity/chest/trapped'],
  ['entity/chest/trapped_left', 'entity/chest/trapped_double'],
  ['entity/chest/trapped_right', 'entity/chest/trapped_double'],
  ['entity/chest/ender', 'entity/chest/ender'],
  ['entity/chest/copper', 'entity/chest/copper_default'],
  ['entity/chest/copper_exposed', 'entity/chest/copper_exposed'],
  ['entity/chest/copper_weathered', 'entity/chest/copper_weathered'],
  ['entity/chest/copper_oxidized', 'entity/chest/copper_oxidized'],
  ['entity/equipment/pig_saddle/saddle', 'entity/saddle'],
  ['entity/shield/base', 'entity/shield'],
  ['entity/banner/banner_base', 'entity/banner/banner'],
  ['environment/rain', 'environment/weather'],
  ['environment/snow', 'environment/weather'],
  ['environment/celestial/moon/full_moon', 'environment/moon_phases'],
  ['particle/flame', 'particle/particles'],
  ['particle/generic_0', 'particle/particles'],
  ['painting/kebab', 'painting/kz'],
  ['painting/back', 'painting/kz'],
  ['item/firework_star', 'items/fireworks_charge'],
  // Java draws beds and signs as block models with per-face textures (26.2/26.3); Bedrock keeps one
  // entity texture each.
  ...['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'].flatMap(
    (c): [string, string][] => [
      [`block/${c}_bed_head_up`, `entity/bed/${c === 'light_gray' ? 'silver' : c}`],
      [`block/${c}_bed_foot_up`, `entity/bed/${c === 'light_gray' ? 'silver' : c}`],
    ],
  ),
  ...['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry', 'pale_oak', 'bamboo', 'crimson', 'warped', 'poplar'].flatMap((w): [string, string][] => [
    [`block/${w}_sign`, w === 'oak' ? 'entity/sign' : ['spruce', 'birch', 'jungle', 'acacia', 'crimson', 'warped'].includes(w) ? `entity/sign_${w}` : w === 'dark_oak' ? 'entity/sign_darkoak' : `entity/${w}_sign`],
    [`block/${w}_hanging_sign`, `entity/${w}_hanging_sign`],
  ]),
];

type Source = 'pixel' | 'face' | 'item' | 'name' | 'near' | 'manual';
interface Pair {
  java: string;
  bedrock: string;
  source: Source;
  note?: string;
}

interface BedrockData {
  version: string;
  commit: string;
  textures: Map<string, Tex>;
  blocks: Record<string, unknown>;
  terrain: Record<string, unknown>;
  items: Record<string, unknown>;
}

function bedrockIndex(): BedrockIndexFile {
  return JSON.parse(readFileSync(join(ROOT, 'public/data/bedrock/index-main.json'), 'utf8')) as BedrockIndexFile;
}

/** The bedrock-samples checkout, fetched (sparse, blobless) when missing. */
function bedrockSamples(index: BedrockIndexFile): string {
  const dir = process.env.BEDROCK_SAMPLES ?? join(FX!, 'research-cache', `bedrock-samples-v${index.version}`);
  if (existsSync(join(dir, 'resource_pack', 'textures', 'terrain_texture.json'))) return dir;
  if (NO_DOWNLOAD) throw new Error(`bedrock-samples not found at ${dir} (set BEDROCK_SAMPLES)`);
  console.log(`  fetching bedrock-samples v${index.version} into ${dir}`);
  const git = (args: string[], cwd?: string) => execFileSync('git', args, { cwd, stdio: ['ignore', 'inherit', 'inherit'] });
  git(['clone', '--filter=blob:none', '--no-checkout', '--depth', '1', '--branch', `v${index.version}`, 'https://github.com/Mojang/bedrock-samples.git', dir]);
  git(['sparse-checkout', 'set', '--no-cone', 'resource_pack/textures/', 'resource_pack/blocks.json'], dir);
  git(['checkout'], dir);
  return dir;
}

function loadBedrock(): BedrockData {
  const index = bedrockIndex();
  const dir = join(bedrockSamples(index), 'resource_pack');
  const files: string[] = [];
  const walk = (d: string, rel: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p, `${rel}${n}/`);
      else files.push(`${rel}${n}`);
    }
  };
  walk(join(dir, 'textures'), 'textures/');
  // Only textures the app's catalogue lists (the bundled index of the same release).
  const listed = new Set(bedrockTexturesFromFiles(catalogFromIndex(index).files).map((t) => t.id));
  const textures = new Map<string, Tex>();
  const json = (p: string) => parseLenientJson<Record<string, unknown>>(readFileSync(join(dir, p), 'utf8'));
  const td = (a: Record<string, unknown>) => (a.texture_data ?? {}) as Record<string, unknown>;
  const terrain = td(json('textures/terrain_texture.json'));
  // Atlas entries with overlay_color tint only where alpha says so (grass_side): alpha is a mask there.
  const overlay = new Set<string>();
  for (const entry of Object.values(terrain)) for (const t of atlasTextures(entry)) if (t.overlay) overlay.add(stripTex(t.path));
  for (const t of bedrockTexturesFromFiles(files)) {
    if (!listed.has(t.id)) continue;
    const bytes = new Uint8Array(readFileSync(join(dir, t.path)));
    const tex = toTex(t.id, bytes, t.ext);
    if (tex && (overlay.has(t.id) || (t.ext === 'tga' && dyeMask(bytes)))) {
      tex.alphaMask = true;
      tex.hash = `mask:${tex.hash}`;
    }
    if (tex) textures.set(t.id, tex);
  }
  return {
    version: index.version,
    commit: index.commit ?? '',
    textures,
    blocks: json('blocks.json'),
    terrain,
    items: td(json('textures/item_texture.json')),
  };
}

function loadJavaTextures(jar: string): Map<string, Tex> {
  const out = new Map<string, Tex>();
  for (const [name, bytes] of Object.entries(readJar(jar, (n) => n.startsWith(JAVA_TEX) && n.endsWith('.png')))) {
    const t = toTex(name.slice(JAVA_TEX.length, -4), bytes);
    if (t) out.set(t.path, t);
  }
  return out;
}

const stripTex = (stem: string) => stem.replace(/^textures\//, '');
const javaRefPath = (ref: string) => splitId(ref)[1];

/** Face-by-face pairs from the block models (Java) and blocks.json (Bedrock). */
function facePairs(java: JsonGet, bd: BedrockData): { java: string; bedrock: string; how: string }[] {
  const shapes = new JavaShapes(java);
  const globalTextures = new Map<string, string>();
  const globalKeys = new Map<string, string>();
  for (const [key, entry] of Object.entries(bd.terrain))
    atlasTextures(entry).forEach((t, i) => {
      const name = t.path.slice(t.path.lastIndexOf('/') + 1);
      if (!globalTextures.has(name)) globalTextures.set(name, t.path);
      if (i === 0 && !globalKeys.has(key)) globalKeys.set(key, t.path);
    });
  const exists = (stem: string) => bd.textures.has(stripTex(stem));
  // Same lookup as BedrockBackend.globalStem: block textures by file name, or by atlas key with the same words.
  const globalStem = (name: string): string | null => {
    const g = globalTextures.get(name);
    if (g && g.startsWith('textures/blocks/') && exists(g)) return g;
    const k = globalKeys.get(name);
    if (k && k.startsWith('textures/blocks/') && exists(k)) {
      const ws = new Set(textureTokens(k));
      if (textureTokens(name).every((t) => ws.has(t))) return k;
    }
    return null;
  };
  const out: { java: string; bedrock: string; how: string }[] = [];
  for (const [id, entry] of Object.entries(bd.blocks)) {
    if (id === 'format_version' || !entry || typeof entry !== 'object') continue;
    const faces = faceNames((entry as Record<string, unknown>).textures);
    if (!faces) continue;
    const own: TextureCandidate[] = [];
    for (const dir of DIRS)
      atlasTextures(bd.terrain[faces[dir]]).forEach((t, index) => own.push({ dir, key: faces[dir], stem: t.path, index }));
    const forms = JAVA_FORMS[id];
    const target = javaTargetFor(id, (j) => shapes.has(j));
    const ids = forms ? [...new Set(Object.values(forms.values).map((v) => v.id))].filter((j) => shapes.has(j)) : target && !target.model ? [target.id] : [];
    const models: string[] = [];
    for (const jid of ids) {
      const bs = shapes.blockstate(jid);
      if (bs) for (const { variant } of allVariants(bs)) models.push(variant.model);
    }
    if (target?.model) models.push(target.model);
    const seen = new Set<string>();
    for (const m of new Set(models)) {
      const model = shapes.models.resolve(m);
      for (const el of model.elements ?? [])
        for (const [dir, face] of Object.entries(el.faces)) {
          if (!face) continue;
          const ref = faceTexture(model, face.texture, dir as Dir).ref;
          if (!ref || seen.has(`${ref}|${dir}`)) continue;
          seen.add(`${ref}|${dir}`);
          const pick = pickBedrockTexture(ref, dir as Dir, own, globalStem, target?.variants ?? false);
          if (pick?.stem && exists(pick.stem)) out.push({ java: javaRefPath(ref), bedrock: stripTex(pick.stem), how: pick.how });
        }
    }
  }
  return out;
}

/** Java item id -> its flat item textures (layer0, layer1...) from the item models. */
function itemPairs(java: JsonGet, files: string[], bd: BedrockData): { java: string; bedrock: string }[] {
  const shapes = new JavaShapes(java);
  const out: { java: string; bedrock: string }[] = [];
  for (const f of files) {
    const m = /^assets\/minecraft\/models\/item\/([^/]+)\.json$/.exec(f);
    if (!m) continue;
    const id = m[1];
    const entry = bd.items[id];
    if (!entry) continue;
    const list = atlasTextures(entry);
    if (list.length !== 1) continue;
    const model = shapes.models.resolve(`minecraft:item/${id}`);
    const layer0 = model.textures.layer0;
    if (!layer0 || layer0.startsWith('#')) continue;
    out.push({ java: javaRefPath(layer0), bedrock: stripTex(list[0].path) });
  }
  return out;
}

interface Verdict {
  ok: boolean;
  layout: boolean;
  why: string;
}

/** Can the Java image be copied as-is into the Bedrock slot (and back)? */
function check(j: Tex, b: Tex): Verdict {
  if (b.alphaMask) return { ok: false, layout: true, why: 'Bedrock alpha is a tint/dye mask' };
  if (!sameAspect(j, b)) return { ok: false, layout: true, why: `aspect ${j.w}x${j.h} vs ${b.w}x${b.h}` };
  const s = similarity(j, b);
  const why = `alpha ${s.alpha.toFixed(2)} close ${s.close.toFixed(2)} lum ${s.lum.toFixed(2)} sat ${s.satA.toFixed(2)}/${s.satB.toFixed(2)}`;
  // Grey textures are tinted by the game; a pre-coloured counterpart (Bedrock *_carried, item icons) is another look.
  const grey = (x: number) => x < 0.06;
  // Multi-part textures whose alpha means something else (emissive or dye masks); tiles only differ in
  // how see-through they are (water), which copies fine.
  if (s.alphaDiff > 0.02 && !isTile(j.path)) return { ok: false, layout: true, why: `alpha channel used differently: ${why}` };
  if ((grey(s.satA) && s.satB > 0.2) || (grey(s.satB) && s.satA > 0.2)) return { ok: false, layout: false, why: `tint differs: ${why}` };
  // Tiles: the art may be redrawn, but where pixels are see-through the shape must match (a pane edge
  // drawn along the other axis, a fence gate laid out differently).
  // Drawn turned or mirrored (a loom top, a rail): another arrangement of the same art.
  if (s.close < 0.5 && j.w * b.h === j.h * b.w && j.w === j.h) {
    for (const o of [1, 2, 3, 4, 5, 6, 7]) {
      const r = similarity(orient(j, o), b);
      if (r.alpha >= 0.95 && r.close >= 0.8) return { ok: false, layout: true, why: `turned/mirrored (${o}): ${why}` };
    }
  }
  if (isTile(j.path)) return !s.transparent || s.alpha >= 0.9 ? { ok: true, layout: false, why } : { ok: false, layout: true, why: `UV layout differs: ${why}` };
  // Multi-part textures: the visible-pixel mask and the shading must line up.
  if ((s.transparent ? s.alpha >= 0.9 : true) && (s.lum >= 0.5 || s.close >= 0.9)) return { ok: true, layout: false, why };
  return { ok: false, layout: true, why: `UV layout differs: ${why}` };
}

function javaBedrock(report: (name: string, text: string) => void): { pairs: [string, string][]; layoutDiffers: [string, string][]; version: string } {
  const jar = jarPath(JAVA_LATEST);
  if (!jar) throw new Error(`Java ${JAVA_LATEST} jar not found`);
  console.log(`Java ${JAVA_LATEST} <-> Bedrock`);
  const jt = loadJavaTextures(jar);
  const bd = loadBedrock();
  const bt = bd.textures;
  console.log(`  ${jt.size} Java textures, ${bt.size} Bedrock textures (bedrock-samples v${bd.version})`);

  const pairs = new Map<string, Pair>();
  const layout = new Map<string, Pair & { why: string }>();
  const rejected: string[] = [];
  const pairedJ = new Map<string, number>();
  const pairedB = new Map<string, number>();
  const rejectSet = new Set(REJECT.map(([a, b]) => `${a}|${b}`));
  const add = (p: Pair) => {
    const k = `${p.java}|${p.bedrock}`;
    if (pairs.has(k) || rejectSet.has(k)) return;
    pairs.set(k, p);
    layout.delete(k);
    pairedJ.set(p.java, (pairedJ.get(p.java) ?? 0) + 1);
    pairedB.set(p.bedrock, (pairedB.get(p.bedrock) ?? 0) + 1);
  };

  // (a) identical pixels
  const groups = new Map<string, { j: string[]; b: string[] }>();
  for (const t of jt.values()) {
    const g = groups.get(t.hash) ?? { j: [], b: [] };
    g.j.push(t.path);
    groups.set(t.hash, g);
  }
  for (const t of bt.values()) groups.get(t.hash)?.b.push(t.path);
  for (const g of groups.values()) {
    if (!g.j.length || !g.b.length) continue;
    const degenerate = jt.get(g.j[0])!.colors <= 1;
    if (g.j.length === 1 && g.b.length === 1 && !degenerate) {
      const [j, b] = [g.j[0], g.b[0]];
      if (compatible(j, b) || nameScore(j, b) >= 0.5) add({ java: j, bedrock: b, source: 'pixel' });
      else rejected.push(`pixel-unrelated\t${j}\t${b}`);
      continue;
    }
    // Several identical images: pair the ones whose names agree best (each side's best match).
    const score = (j: string, b: string) => (compatible(j, b) ? nameScore(j, b) : 0);
    const min = degenerate ? 0.9 : 0.5;
    const ok = new Set<string>();
    for (const j of g.j) {
      const best = Math.max(...g.b.map((b) => score(j, b)));
      if (best >= min) for (const b of g.b) if (score(j, b) === best) ok.add(`${j}|${b}`);
    }
    for (const b of g.b) {
      const best = Math.max(...g.j.map((j) => score(j, b)));
      if (best >= min) for (const j of g.j) if (score(j, b) === best) ok.add(`${j}|${b}`);
    }
    for (const j of g.j)
      for (const b of g.b) {
        if (ok.has(`${j}|${b}`)) add({ java: j, bedrock: b, source: 'pixel' });
        else rejected.push(`pixel-group\t${j}\t${b}\tscore ${score(j, b).toFixed(2)}`);
      }
  }

  // Non-identical candidates: checked on the images; used when one side has no pair yet.
  const consider = (java: string, bedrock: string, source: Source, note = '', needUnpaired = true) => {
    const j = jt.get(java);
    const b = bt.get(bedrock);
    const k = `${java}|${bedrock}`;
    if (!j || !b || pairs.has(k) || rejectSet.has(k)) return;
    if (needUnpaired && pairedJ.has(java) && pairedB.has(bedrock)) return;
    const v = check(j, b);
    if (v.ok) add({ java, bedrock, source, note: `${note} ${v.why}`.trim() });
    else if (v.layout && !pairedJ.has(java) && !pairedB.has(bedrock)) layout.set(k, { java, bedrock, source, why: v.why });
    else rejected.push(`${source}\t${java}\t${bedrock}\t${note} ${v.why}`);
  };

  // (e) the hand-written list first: these names are known to play the same part
  for (const [j, b] of OVERRIDES) {
    if (!jt.has(j) || !bt.has(b)) {
      rejected.push(`manual-missing\t${j}\t${b}`);
      continue;
    }
    consider(j, b, 'manual', '', false);
  }

  for (const [java, bedrock] of LAYOUT_DIFFERS) {
    if (jt.has(java) && bt.has(bedrock)) layout.set(`${java}|${bedrock}`, { java, bedrock, source: 'manual', why: 'listed' });
    else rejected.push(`layout-missing\t${java}\t${bedrock}`);
    rejectSet.add(`${java}|${bedrock}`);
  }

  // (b) block model faces
  const jsonFiles = readJar(jar, (n) => /^assets\/minecraft\/(blockstates|models)\/.*\.json$/.test(n));
  const parsed = new Map<string, unknown>();
  const javaJson: JsonGet = (p) => {
    if (!parsed.has(p)) {
      const b = jsonFiles[p];
      parsed.set(p, b ? JSON.parse(new TextDecoder().decode(b)) : undefined);
    }
    return parsed.get(p);
  };
  const allNames: string[] = [];
  unzipSync(new Uint8Array(readFileSync(jar)), {
    filter: (f) => {
      allNames.push(f.name);
      return false;
    },
  });
  const STRONG = new Set(['exact', 'alias', 'name', 'global']);
  for (const f of facePairs(javaJson, bd)) {
    const strong = STRONG.has(f.how);
    // Weak picks (a lone texture or the face's texture) only when the pixels agree too.
    if (!strong) {
      const j = jt.get(f.java);
      const b = bt.get(f.bedrock);
      if (!j || !b || !sameAspect(j, b)) continue;
      const s = similarity(j, b);
      if (s.close < 0.5 && s.lum < 0.6) {
        rejected.push(`face-weak\t${f.java}\t${f.bedrock}\t${f.how}`);
        continue;
      }
    }
    consider(f.java, f.bedrock, 'face', f.how);
  }

  // (c) items by id
  for (const p of itemPairs(javaJson, allNames, bd)) consider(p.java, p.bedrock, 'item');

  // (d) same file name after folder mapping
  const bedrockByLeaf = new Map<string, string[]>();
  for (const b of bt.keys()) {
    const leaf = b.slice(b.lastIndexOf('/') + 1);
    bedrockByLeaf.set(leaf, [...(bedrockByLeaf.get(leaf) ?? []), b]);
  }
  for (const j of jt.keys()) {
    const leaf = j.slice(j.lastIndexOf('/') + 1);
    const cands = (bedrockByLeaf.get(leaf) ?? []).filter((b) => compatible(j, b));
    const sub = cands.length > 1 ? cands.filter((b) => b.split('/').slice(1).join('/') === j.split('/').slice(1).join('/')) : cands;
    const folder = cands.filter((b) => sameFolder(j, b));
    const pick = sub.length === 1 ? sub[0] : folder.length === 1 ? folder[0] : undefined;
    if (pick && (isTile(j) || sameFolder(j, pick))) consider(j, pick, 'name');
  }

  // (near) nearly the same pixels, same size, names that share a word
  const bySize = new Map<string, Tex[]>();
  for (const t of bt.values()) {
    const k = `${t.w}x${t.h}`;
    bySize.set(k, [...(bySize.get(k) ?? []), t]);
  }
  for (const j of jt.values()) {
    if (pairedJ.has(j.path) || j.colors <= 1) continue;
    let best: { b: Tex; close: number } | null = null;
    let second = 0;
    for (const b of bySize.get(`${j.w}x${j.h}`) ?? []) {
      if (!compatible(j.path, b.path) || pairedB.has(b.path) || b.colors <= 1) continue;
      if (nameScore(j.path, b.path) < 0.2 || !sameQualifiers(j.path, b.path)) continue;
      const s = similarity(j, b);
      if (s.alpha < 0.97 || (s.lum < 0.6 && s.close < 0.9)) continue;
      if (!best || s.close > best.close) {
        second = best?.close ?? second;
        best = { b, close: s.close };
      } else if (s.close > second) second = s.close;
    }
    if (best && best.close >= 0.85 && best.close - second >= 0.1) consider(j.path, best.b.path, 'near', `close ${best.close.toFixed(2)}`);
  }

  const out = [...pairs.values()].sort((a, b) => (a.java < b.java ? -1 : a.java > b.java ? 1 : a.bedrock < b.bedrock ? -1 : 1));
  const lay = [...layout.values()].filter((p) => !pairedJ.has(p.java) || !pairedB.has(p.bedrock)).sort((a, b) => (a.java < b.java ? -1 : 1));
  report('java-bedrock-pairs.tsv', out.map((p) => `${p.source}\t${p.java}\t${p.bedrock}\t${p.note ?? ''}`).join('\n'));
  report('java-bedrock-layout.tsv', lay.map((p) => `${p.source}\t${p.java}\t${p.bedrock}\t${p.why}`).join('\n'));
  report('java-bedrock-rejected.tsv', rejected.join('\n'));
  report('java-unpaired.txt', [...jt.keys()].filter((p) => !pairedJ.has(p)).sort().map((p) => `${p} ${jt.get(p)!.w}x${jt.get(p)!.h}`).join('\n'));
  report('bedrock-unpaired.txt', [...bt.keys()].filter((p) => !pairedB.has(p)).sort().map((p) => `${p} ${bt.get(p)!.w}x${bt.get(p)!.h}`).join('\n'));
  const bySource: Record<string, number> = {};
  for (const p of out) bySource[p.source] = (bySource[p.source] ?? 0) + 1;
  console.log(`  ${out.length} pairs`, bySource, `${lay.length} layout differs`);
  return { pairs: out.map((p) => [p.java, p.bedrock]), layoutDiffers: lay.map((p) => [p.java, p.bedrock]), version: bd.version };
}

// ---------------------------------------------------------------------------------------------
// Java renames

/**
 * Renames the automatic passes can't see (art redrawn in the same release), as old -> new per release.
 * Each one is checked: the old path must disappear in that release and the new one appear.
 */
const RENAME_OVERRIDES: Record<string, Record<string, string | string[]>> = {
  '1.9': {
    'items/boat': 'items/oak_boat',
  },
  '1.13': {
    'items/fish_cod_raw': 'item/cod',
    'items/fish_salmon_raw': 'item/salmon',
    'items/fish_salmon_cooked': 'item/cooked_salmon',
    'items/fish_clownfish_raw': 'item/tropical_fish',
    'items/fish_pufferfish_raw': 'item/pufferfish',
    'items/potion_bottle_empty': 'item/glass_bottle',
  },
  '1.14': {
    'item/sign': 'item/oak_sign',
    'block/stone_slab_top': 'block/smooth_stone',
    'item/cactus_green': 'item/green_dye',
    'item/dandelion_yellow': 'item/yellow_dye',
    'item/rose_red': 'item/red_dye',
  },
  '1.21.5': {
    'entity/sheep/sheep_fur': 'entity/sheep/sheep_wool',
  },
};

/** Pixel-identical pairs that are not renames (unrelated textures that happen to look the same). */
const RENAME_REJECT: Record<string, string[]> = {};

interface Step {
  version: string;
  renames: Record<string, string | string[]>;
  removed?: string[];
}

function javaRenames(report: (name: string, text: string) => void): Step[] {
  console.log('Java renames');
  // Releases with a jar; fill gaps that hide changes with downloaded intermediate jars.
  let avail = KNOWN_RELEASES.filter((v) => jarPath(v));
  const names = new Map<string, Set<string>>();
  const namesOf = (v: string) => {
    if (!names.has(v)) names.set(v, new Set(jarTextureNames(jarPath(v)!)));
    return names.get(v)!;
  };
  for (let i = 1; i < avail.length; i++) {
    const a = avail[i - 1];
    const c = avail[i];
    const between = KNOWN_RELEASES.slice(KNOWN_RELEASES.indexOf(a) + 1, KNOWN_RELEASES.indexOf(c));
    if (!between.length) continue;
    const prev = namesOf(a);
    const removed = [...prev].some((p) => !namesOf(c).has(p));
    if (!removed) continue;
    for (const v of between) if (!jarPath(v) && !downloadJar(v)) console.warn(`  warning: no jar for ${v}; changes between ${a} and ${c} are credited to ${c}`);
  }
  avail = KNOWN_RELEASES.filter((v) => jarPath(v));

  const steps: Step[] = [];
  const lines: string[] = [];
  let prevV = avail[0];
  let prevTex: Map<string, Tex> | null = null;
  for (const v of avail.slice(1)) {
    const before = namesOf(prevV);
    const after = namesOf(v);
    const R = [...before].filter((p) => !after.has(p)).sort();
    if (!R.length) {
      prevV = v;
      prevTex = null;
      continue;
    }
    const A = [...after].filter((p) => !before.has(p)).sort();
    const old = prevTex ?? loadJavaTextures(jarPath(prevV)!);
    const cur = loadJavaTextures(jarPath(v)!);
    const renames: Record<string, string | string[]> = {};
    const reject = new Set(RENAME_REJECT[v] ?? []);
    const taken = new Set<string>();
    const set = (r: string, to: string[], why: string) => {
      const list = to.filter((t) => !reject.has(`${r}>${t}`));
      if (!list.length) return;
      renames[r] = list.length === 1 ? list[0] : list.sort();
      list.forEach((t) => taken.add(t));
      lines.push(`${v}\t${why}\t${r}\t${list.join(',')}`);
    };

    // Identical pixels: groups of removed and added paths sharing an image.
    const groups = new Map<string, { r: string[]; a: string[] }>();
    for (const r of R) {
      const t = old.get(r);
      if (!t) continue;
      const g = groups.get(t.hash) ?? { r: [], a: [] };
      g.r.push(r);
      groups.set(t.hash, g);
    }
    for (const a of A) {
      const t = cur.get(a);
      if (t) groups.get(t.hash)?.a.push(a);
    }
    for (const g of groups.values()) {
      if (!g.a.length) continue;
      const degenerate = old.get(g.r[0])!.colors <= 1;
      if (g.r.length === 1 && g.a.length === 1) {
        if (!degenerate || nameScore(g.r[0], g.a[0]) >= 0.5) set(g.r[0], g.a, 'pixel');
        continue;
      }
      // Assign by name: each removed path to the added path(s) with the best name score, best pairs first.
      const cand: { r: string; a: string; s: number }[] = [];
      for (const r of g.r) for (const a of g.a) cand.push({ r, a, s: nameScore(r, a) });
      cand.sort((x, y) => y.s - x.s || (x.r < y.r ? -1 : 1));
      const doneR = new Map<string, number>();
      const usedA = new Set<string>();
      const got = new Map<string, string[]>();
      for (const c of cand) {
        if (c.s < (degenerate ? 0.9 : 0.3)) break;
        const rs = doneR.get(c.r);
        if (rs !== undefined && c.s < rs) continue;
        if (usedA.has(c.a)) continue;
        doneR.set(c.r, c.s);
        usedA.add(c.a);
        got.set(c.r, [...(got.get(c.r) ?? []), c.a]);
      }
      // A single removed image whose copies all went unclaimed was split into all of them.
      if (g.r.length === 1 && !degenerate && !got.size) got.set(g.r[0], g.a);
      for (const [r, as] of got) set(r, as, g.r.length === 1 ? 'pixel-split' : 'pixel-group');
    }

    // Overrides
    for (const [r, to] of Object.entries(RENAME_OVERRIDES[v] ?? {})) {
      const list = Array.isArray(to) ? to : [to];
      if (!before.has(r) || after.has(r) || list.some((t) => !after.has(t))) throw new Error(`rename override ${v}: ${r} -> ${list.join(',')} does not match the jars`);
      const t = old.get(r);
      for (const to of list) {
        const u = cur.get(to);
        if (!t || !u || !sameAspect(t, u)) throw new Error(`rename override ${v}: ${r} -> ${to}: the images have different shapes`);
        const sim = similarity(t, u);
        lines.push(`${v}\tcheck\t${r}\t${to}\talpha ${sim.alpha.toFixed(2)} close ${sim.close.toFixed(2)} lum ${sim.lum.toFixed(2)}`);
      }
      set(r, list, 'manual');
    }

    // Similar names with similar pixels (moved and slightly redrawn). Same size, alpha mask alike.
    for (const r of R) {
      if (renames[r]) continue;
      const t = old.get(r);
      if (!t) continue;
      let best: { a: string; s: number; close: number } | null = null;
      let tie = false;
      for (const a of A) {
        if (taken.has(a)) continue;
        const u = cur.get(a);
        if (!u || !sameAspect(t, u)) continue;
        const ns = nameScore(r, a);
        if (ns < 0.5) continue;
        const sim = similarity(t, u);
        if (sim.alpha < 0.9 || (sim.close < 0.5 && sim.lum < 0.6)) continue;
        const s = ns + sim.close * 0.5;
        if (!best || s > best.s + 1e-9) (best = { a, s, close: sim.close }), (tie = false);
        else if (Math.abs(s - best.s) < 1e-9) tie = true;
      }
      if (best && !tie) set(r, [best.a], `similar(${best.close.toFixed(2)})`);
    }

    // Merged into a path that already existed (same image, similar name): entity/arrow -> entity/projectiles/arrow
    const byHash = new Map<string, string[]>();
    for (const [p, t] of cur) if (before.has(p)) byHash.set(t.hash, [...(byHash.get(t.hash) ?? []), p]);
    for (const r of R) {
      const t = old.get(r);
      if (renames[r] || !t || t.colors <= 1) continue;
      const cands = (byHash.get(t.hash) ?? []).map((p) => ({ p, s: nameScore(r, p) })).filter((c) => c.s >= 0.5).sort((a, b) => b.s - a.s);
      if (cands.length && (cands.length === 1 || cands[0].s > cands[1].s)) set(r, [cands[0].p], 'merged');
    }

    const removed = R.filter((r) => !renames[r]);
    for (const r of removed) lines.push(`${v}\tremoved\t${r}\t`);
    const step: Step = { version: v, renames: Object.fromEntries(Object.entries(renames).sort(([a], [b]) => (a < b ? -1 : 1))) };
    if (removed.length) step.removed = removed;
    steps.push(step);
    console.log(`  ${v}: ${Object.keys(renames).length} renamed, ${removed.length} removed`);
    prevV = v;
    prevTex = cur;
  }
  report('java-renames.tsv', lines.join('\n'));
  return steps;
}

// ---------------------------------------------------------------------------------------------
// Output

function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  if (REPORT_DIR) mkdirSync(REPORT_DIR, { recursive: true });
  const report = (name: string, text: string) => {
    if (REPORT_DIR) writeFileSync(join(REPORT_DIR, name), text + '\n');
  };
  const line = (v: unknown) => JSON.stringify(v);
  if (ONLY !== 'renames') {
    const r = javaBedrock(report);
    const body = [
      '{',
      `"format": 1,`,
      `"java": ${line(JAVA_LATEST)},`,
      `"bedrock": ${line(r.version)},`,
      `"pairs": [`,
      r.pairs.map(line).join(',\n'),
      `],`,
      `"layoutDiffers": [`,
      r.layoutDiffers.map(line).join(',\n'),
      `]`,
      '}',
    ].join('\n');
    writeFileSync(join(OUT_DIR, 'java-bedrock.json'), body + '\n');
  }
  if (ONLY !== 'bedrock') {
    const steps = javaRenames(report);
    const body = [
      '{',
      `"format": 1,`,
      `"steps": [`,
      steps
        .map((s) => {
          const entries = Object.entries(s.renames).map(([k, v]) => `  ${line(k)}: ${line(v)}`);
          let out = `{"version": ${line(s.version)}, "renames": ${entries.length ? `{\n${entries.join(',\n')}\n}` : '{}'}`;
          if (s.removed) out += `, "removed": [\n${s.removed.map((r) => `  ${line(r)}`).join(',\n')}\n]`;
          return `${out}}`;
        })
        .join(',\n'),
      `]`,
      '}',
    ].join('\n');
    writeFileSync(join(OUT_DIR, 'java-renames.json'), body + '\n');
  }
  for (const f of ['java-bedrock.json', 'java-renames.json']) {
    const p = join(OUT_DIR, f);
    if (existsSync(p)) console.log(`${p}: ${(statSync(p).size / 1024).toFixed(1)} KiB`);
  }
}

main();
