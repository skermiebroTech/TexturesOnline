// Which tool a file opened with the installed app goes to (double-clicked .mcpack, "Open with",
// files shared to the app). Pure: the caller lists the archive's entries and reads PNG sizes.
//   two or more packs                 -> pack merger
//   a shader pack (Iris / OptiFine,   -> shader maker
//     vanilla core shaders, Bedrock
//     Vibrant Visuals)
//   any other pack                    -> texture pack maker ("Open a pack")
//   a 64x64 or 64x32 PNG              -> skin editor ("Bring a skin")
//   any other PNG                     -> texture pack converter (loose textures)

export type LaunchRoute = '/textures' | '/merge-texture-packs' | '/shaders' | '/skins' | '/texture-pack-converter';

export interface LaunchFileFacts {
  name: string;
  /** Entry paths of a zip-based file (.zip, .mcpack, .mcaddon); undefined when it couldn't be read */
  entries?: string[];
  /** Pixel size of a PNG; undefined when it couldn't be read */
  png?: { width: number; height: number };
}

export interface LaunchPlan {
  route: LaunchRoute;
  /** Indexes of the files to hand to that tool, in order */
  files: number[];
}

export const PACK_EXT = /\.(zip|mcpack|mcaddon)$/i;
export const PNG_EXT = /\.png$/i;
/** Most packs the merger takes at once. */
export const MAX_MERGE = 8;

const IRIS_SOURCE = /(^|\/)shaders\/(?:[^/]+\/)*[^/]+\.(vsh|fsh|gsh|csh|glsl)$|(^|\/)shaders\/shaders\.properties$/i;
const JAVA_CORE_SHADERS = /^(?:[^/]+\/)?assets\/[^/]+\/(shaders|post_effect)\//i;
const TEXTURES = /(^|\/)textures\//i;
const VIBRANT = /(^|\/)(lighting|atmospherics|color_grading|water|shadows|point_lights|pbr)\/[^/]+\.json$/i;

/** True when an archive's entries look like a shader pack rather than a texture pack. */
export function isShaderPack(entries: string[]): boolean {
  const files = entries.filter((e) => !e.endsWith('/'));
  const textures = files.some((e) => TEXTURES.test(e) && /\.(png|tga|jpe?g)$/i.test(e));
  // Iris / OptiFine: a shaders/ folder of GLSL sources (not a resource pack's assets/.../shaders/)
  if (files.some((e) => IRIS_SOURCE.test(e) && !/(^|\/)assets\//i.test(e))) return true;
  // Vanilla Java shader pack, or Bedrock Vibrant Visuals: their own files and no textures
  if (!textures && files.some((e) => JAVA_CORE_SHADERS.test(e) || VIBRANT.test(e))) return true;
  return false;
}

export const isSkinSize = (png: { width: number; height: number }): boolean => png.width === 64 && (png.height === 64 || png.height === 32);

/** Where the opened files go; null when none of them can be used. */
export function planLaunch(files: LaunchFileFacts[]): LaunchPlan | null {
  const packs = files.map((f, i) => ({ f, i })).filter(({ f }) => PACK_EXT.test(f.name));
  const pngs = files.map((f, i) => ({ f, i })).filter(({ f }) => PNG_EXT.test(f.name));
  if (packs.length >= 2) return { route: '/merge-texture-packs', files: packs.slice(0, MAX_MERGE).map((p) => p.i) };
  if (packs.length === 1) {
    const [{ f, i }] = packs;
    return { route: f.entries && isShaderPack(f.entries) ? '/shaders' : '/textures', files: [i] };
  }
  if (pngs.length) {
    const skin = pngs.find(({ f }) => f.png && isSkinSize(f.png));
    if (skin) return { route: '/skins', files: [skin.i] };
    return { route: '/texture-pack-converter', files: [pngs[0].i] };
  }
  return null;
}

/** Reads the width and height from a PNG header (IHDR); null when it isn't a PNG. */
export function pngSize(head: Uint8Array): { width: number; height: number } | null {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (head.length < 24 || sig.some((b, i) => head[i] !== b)) return null;
  const u32 = (o: number) => ((head[o] << 24) | (head[o + 1] << 16) | (head[o + 2] << 8) | head[o + 3]) >>> 0;
  return { width: u32(16), height: u32(20) };
}
