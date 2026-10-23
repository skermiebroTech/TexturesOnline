// PBR files of a texture pack: the maps of a material (decoded for the Material tab and the export),
// the files the export writes (Java: labPBR _n / _s next to the textures; Bedrock: texture sets with
// their layers, and the game's texture sets for edited textures so they still show with Vibrant
// Visuals), the game's own Bedrock materials, and an opened pack's PBR files taken into project.pbr.

import type { AssetIndex, PbrMapImage, PbrMaterial, PbrValues, TextureCategory, TexturePackProject } from '../../../core/types';
import { createImageData, decodeImage, encodePng, encodeTga, resizeNearest } from '../../../core/image';
import { PLAIN, bakeMers, bumpMap, frameHeight, normalFromHeight, sameValues, uniformValues } from './material';
import {
  TEXTURE_SET_EXT,
  bedrockNormal,
  buildTextureSet,
  fromBedrockMers,
  fromBedrockNormal,
  fromLabSpecular,
  labColourPath,
  labNormal,
  labPaths,
  labSpecular,
  layerNames,
  layerStems,
  parseTextureSet,
  textureSetPath,
} from './formats';

export const hasMaterials = (project: Pick<TexturePackProject, 'pbr'>): boolean => !!project.pbr && Object.keys(project.pbr).length > 0;

const isTgaBlob = (b: Blob) => b.type === 'image/x-tga';

/**
 * A map image as the editor works with it: metal / glow / roughness / subsurface (RGBA = M, E, R, S)
 * for 'mer' / 'mers' / 'specular', a labPBR-layout normal map for 'normal' / 'heightmap' / 'labpbr'.
 */
export async function decodeMap(m: PbrMapImage, wrap: boolean): Promise<ImageData> {
  const img = await decodeImage(m.image, isTgaBlob(m.image) ? 'tga' : undefined);
  switch (m.layout) {
    case 'mer':
    case 'mers':
      return fromBedrockMers(img, m.layout);
    case 'specular':
      return fromLabSpecular(img);
    case 'normal':
      return fromBedrockNormal(img);
    case 'heightmap': {
      const hf = new Float32Array(img.width * img.height);
      for (let p = 0; p < hf.length; p++) hf[p] = img.data[p * 4] / 255;
      return normalFromHeight(hf, img.width, img.height, 1, wrap, frameHeight(img));
    }
    default:
      return createImageData(img.width, img.height, new Uint8ClampedArray(img.data));
  }
}

export interface MaterialMaps {
  /** RGBA = metal, glow, roughness, subsurface, at the colour texture's size */
  mers: ImageData;
  /** labPBR-layout normal map at the colour texture's size, or null (flat) */
  normal: ImageData | null;
}

/** The maps of a material for a colour texture (its map and normal map decoded and fitted to it). */
export async function materialMaps(colour: ImageData, m: PbrMaterial, wrap: boolean, decoded?: { map?: ImageData | null; normal?: ImageData | null }): Promise<MaterialMaps> {
  const map = decoded?.map !== undefined ? decoded.map : m.map ? await decodeMap(m.map, wrap) : null;
  const mers = bakeMers(colour, m, map);
  let normal: ImageData | null = null;
  if (m.bumps) normal = bumpMap(colour, m.bumps, wrap);
  else if (m.normal) {
    const n = decoded?.normal !== undefined ? decoded.normal : await decodeMap(m.normal, wrap);
    if (n) normal = n.width === colour.width && n.height === colour.height ? n : resizeNearest(n, colour.width, colour.height);
  }
  return { mers, normal };
}

/** Every pixel has the plain values (nothing a shader needs to know). */
export function isPlainMers(mers: ImageData): boolean {
  const d = mers.data;
  for (let i = 0; i < d.length; i += 4) if (d[i] !== PLAIN[0] || d[i + 1] !== PLAIN[1] || d[i + 2] !== PLAIN[2] || d[i + 3] !== PLAIN[3]) return false;
  return true;
}

const hasSubsurface = (mers: ImageData) => {
  for (let i = 3; i < mers.data.length; i += 4) if (mers.data[i] > 0 && mers.data[i - 3] < 128) return true;
  return false;
};

// ---------------------------------------------------------------------------------------------
// The game's own materials (Bedrock)

export interface GameMaterial {
  map?: PbrMapImage;
  normal?: PbrMapImage;
  /** Uniform values of the texture set (when it has no map image) */
  values?: PbrValues;
}

/** The image file of a layer: the stem with the extension the game prefers (.tga before .png). */
function imageFile(has: (p: string) => boolean, stem: string): string | null {
  for (const ext of ['tga', 'png', 'jpg', 'jpeg']) if (has(`${stem}.${ext}`)) return `${stem}.${ext}`;
  return null;
}

/** Bedrock's material of a vanilla texture (its texture set in bedrock-samples), or null. */
export async function gameMaterial(assets: AssetIndex, colourPath: string): Promise<GameMaterial | null> {
  if (assets.edition !== 'bedrock') return null;
  const setPath = textureSetPath(colourPath);
  if (!assets.hasFile(setPath)) return null;
  const parsed = parseTextureSet(await assets.readText(setPath));
  if (!parsed) return null;
  const stems = layerStems(setPath, parsed.layers);
  const out: GameMaterial = {};
  const read = async (stem: string | undefined): Promise<Blob | null> => {
    const file = stem ? imageFile((p) => assets.hasFile(p), stem) : null;
    if (!file) return null;
    const bytes = await assets.readFile(file);
    return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: file.endsWith('.tga') ? 'image/x-tga' : 'image/png' });
  };
  const mers = await read(stems.mers ?? stems.mer);
  if (mers) out.map = { image: mers, layout: stems.mers ? 'mers' : 'mer' };
  else {
    const v = parsed.layers.mers ?? parsed.layers.mer;
    if (Array.isArray(v) && v.length >= 3) out.values = [v[0], v[1], v[2], v[3] ?? 0];
  }
  const normal = await read(stems.normal ?? stems.heightmap);
  if (normal) out.normal = { image: normal, layout: stems.normal ? 'normal' : 'heightmap' };
  return out;
}

// ---------------------------------------------------------------------------------------------
// Export

export interface PbrExportContext {
  project: TexturePackProject;
  assets: AssetIndex;
  /** The pack's files so far (colour textures as exported, after effects); PBR files are added */
  files: Record<string, Uint8Array | string>;
  warnings: string[];
  categoryOf(path: string): TextureCategory;
  signal?: AbortSignal;
  /** Most game texture sets copied for edited textures (each needs its layers fetched) */
  maxGameSets?: number;
  /** Text of the warnings (translated by the export) */
  text: { missingColour(files: string[]): string; plainSets(count: number): string };
}

const toBytes = async (b: Blob) => new Uint8Array(await b.arrayBuffer());

/**
 * Writes the PBR files of every material into `files`. Bedrock also gets texture sets for the other
 * textures the pack changes that have one in the game (with the "pbr" capability the game's set would
 * show its own colour texture instead of the pack's).
 */
export async function writePbrFiles(ctx: PbrExportContext): Promise<void> {
  const { project, assets, files, signal } = ctx;
  const edition = project.edition;
  const missing: string[] = [];
  const colourBytes = async (path: string): Promise<Uint8Array | null> => {
    const own = files[path];
    if (own instanceof Uint8Array) return own;
    const ov = project.overrides[path];
    if (ov) return toBytes(ov);
    if (assets.hasFile(path)) return assets.readFile(path);
    return null;
  };
  for (const [path, m] of Object.entries(project.pbr ?? {})) {
    signal?.throwIfAborted();
    if (m.original && Object.keys(m.original).length) {
      for (const [p, blob] of Object.entries(m.original)) files[p] = await toBytes(blob);
      // a texture set needs its colour image in the same pack
      if (edition === 'bedrock' && !files[path]) {
        const c = await colourBytes(path);
        if (c) files[path] = c;
      }
      continue;
    }
    const bytes = await colourBytes(path);
    if (!bytes) {
      missing.push(path.slice(path.lastIndexOf('/') + 1));
      continue;
    }
    const colour = await decodeImage(bytes, path.endsWith('.tga') ? 'tga' : undefined);
    const wrap = ctx.categoryOf(path) === 'block';
    const maps = await materialMaps(colour, m, wrap);
    if (edition === 'java') {
      const lab = labPaths(path);
      const written: string[] = [];
      if (!isPlainMers(maps.mers)) {
        files[lab.specular] = encodePng(labSpecular(maps.mers));
        written.push(lab.specular);
      }
      if (maps.normal) {
        files[lab.normal] = encodePng(labNormal(maps.normal));
        written.push(lab.normal);
      }
      // an animated texture's maps are strips with the same frames: they get the same animation
      const meta = files[`${path}.mcmeta`] ?? (assets.hasFile(`${path}.mcmeta`) ? await assets.readText(`${path}.mcmeta`).catch(() => null) : null);
      const metaText = meta instanceof Uint8Array ? new TextDecoder().decode(meta) : meta;
      if (metaText && /"animation"/.test(metaText)) for (const p of written) files[`${p}.mcmeta`] = metaText;
      continue;
    }
    if (!files[path]) files[path] = bytes;
    const taken = (stem: string) => !!imageFile((p) => assets.hasFile(p) || p in files || p in project.overrides, stem);
    const names = layerNames(path, taken);
    const dir = path.slice(0, path.lastIndexOf('/') + 1);
    const colourName = path.slice(dir.length).replace(/\.[^.]+$/, '');
    const uniform = uniformValues(m);
    let mers: string | [number, number, number] | undefined;
    let subsurface = false;
    if (uniform && uniform[3] === 0) {
      // one value for the whole texture: no image needed
      if (!sameValues(uniform, PLAIN)) mers = [uniform[0], uniform[1], uniform[2]];
    } else if (hasSubsurface(maps.mers)) {
      // MERS keeps subsurface in alpha: TGA, as the game's own files, so nothing premultiplies it away
      subsurface = true;
      mers = names.mers;
      files[`${dir}${names.mers}.tga`] = encodeTga(maps.mers);
    } else if (!isPlainMers(maps.mers)) {
      mers = names.mer;
      const mer = createImageData(maps.mers.width, maps.mers.height, new Uint8ClampedArray(maps.mers.data));
      for (let i = 3; i < mer.data.length; i += 4) mer.data[i] = 255;
      files[`${dir}${names.mer}.png`] = encodePng(mer);
    }
    let normal: string | undefined;
    if (maps.normal) {
      normal = names.normal;
      files[`${dir}${names.normal}.png`] = encodePng(bedrockNormal(maps.normal));
    }
    files[textureSetPath(path)] = buildTextureSet({ color: colourName, mers, subsurface, normal });
  }
  if (missing.length) ctx.warnings.push(ctx.text.missingColour(missing));
  if (edition === 'bedrock') await copyGameSets(ctx);
}

/** Bedrock: the game's texture set (and its layer images) for each colour texture the pack changes. */
async function copyGameSets(ctx: PbrExportContext): Promise<void> {
  const { project, assets, files, signal } = ctx;
  const todo: string[] = [];
  for (const path of Object.keys(files)) {
    if (!/^textures\/.+\.(png|tga)$/.test(path) || project.pbr?.[path]) continue;
    const setPath = textureSetPath(path);
    if (setPath in files || !assets.hasFile(setPath)) continue;
    // a layer of one of the game's sets is not a colour texture
    if (/_(mers?|normal|heightmap)\.(png|tga)$/.test(path) && !assets.textures.some((t) => t.path === path)) continue;
    todo.push(path);
  }
  const max = ctx.maxGameSets ?? 400;
  let plain = 0;
  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      signal?.throwIfAborted();
      const i = next++;
      const path = todo[i];
      try {
        if (i < max && (await copyGameSet(path))) continue;
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') throw err;
      }
      // without a set of its own the game's set would show the game's colours: a plain one shows the pack's
      const name = path.slice(path.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '');
      files[textureSetPath(path)] = buildTextureSet({ color: name });
      plain++;
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, todo.length) }, worker));
  if (plain) ctx.warnings.push(ctx.text.plainSets(plain));

  /** Copies the game's set of a texture with its layers; false when it can't be used */
  async function copyGameSet(path: string): Promise<boolean> {
    const setPath = textureSetPath(path);
    const text = await assets.readText(setPath);
    const parsed = parseTextureSet(text);
    if (!parsed) return false;
    const stems = layerStems(setPath, parsed.layers);
    const colourFile = files[path];
    const dims = colourFile instanceof Uint8Array ? await decodeImage(colourFile, path.endsWith('.tga') ? 'tga' : undefined).then((c) => ({ w: c.width, h: c.height })) : null;
    const layers: [string, Uint8Array | string][] = [];
    for (const k of ['mer', 'mers', 'normal', 'heightmap'] as const) {
      const stem = stems[k];
      if (!stem) continue;
      const file = imageFile((p) => assets.hasFile(p), stem);
      if (!file) return false;
      let bytes = await assets.readFile(file);
      // a repainted texture at another size gets its layers at that size (the heightmap is single
      // channel and stays as it is)
      if (dims && k !== 'heightmap') {
        const img = await decodeImage(bytes, file.endsWith('.tga') ? 'tga' : undefined);
        if (img.width !== dims.w || img.height !== dims.h) {
          const fitted = resizeNearest(img, dims.w, dims.h);
          bytes = file.endsWith('.tga') ? encodeTga(fitted) : encodePng(fitted);
        }
      }
      layers.push([file, bytes]);
    }
    for (const [file, bytes] of layers) if (!(file in files)) files[file] = bytes;
    files[setPath] = text;
    return true;
  }
}

// ---------------------------------------------------------------------------------------------
// Opened packs

/**
 * Takes an opened pack's PBR files out of its textures and extra files into project.pbr (once, when
 * the editor opens it): Java labPBR _n / _s next to textures the pack or the game has, Bedrock texture
 * sets whose colour image is in the pack, with their layer images. They are exported unchanged until
 * their material is edited. Returns the number of materials taken in.
 */
export async function adoptPackPbr(project: TexturePackProject, assets: AssetIndex): Promise<number> {
  let count = 0;
  const pbr = (project.pbr ??= {});
  if (project.edition === 'java') {
    for (const path of Object.keys(project.overrides)) {
      const lab = labColourPath(path);
      // the game's own *_n / *_s textures (the enchanting glyphs, particle/sga_n.png) are textures
      if (!lab || assets.hasFile(path)) continue;
      if (pbr[lab.colour] && !pbr[lab.colour].original) continue;
      if (!project.overrides[lab.colour] && !assets.hasFile(lab.colour)) continue;
      const m = (pbr[lab.colour] ??= { base: [...PLAIN], spots: [], bumps: null, original: {}, updatedAt: Date.now() });
      if (!m.original) continue;
      if (!Object.keys(m.original).length) count++;
      const blob = project.overrides[path];
      m.original[path] = blob;
      if (lab.kind === 'normal') m.normal = { image: blob, layout: 'labpbr' };
      else m.map = { image: blob, layout: 'specular' };
      delete project.overrides[path];
      const meta = project.extraFiles[`${path}.mcmeta`];
      if (meta) {
        m.original[`${path}.mcmeta`] = meta;
        delete project.extraFiles[`${path}.mcmeta`];
      }
    }
  } else {
    const all = { ...project.extraFiles, ...project.overrides };
    const has = (p: string) => p in all;
    for (const setPath of Object.keys(project.extraFiles)) {
      if (!setPath.startsWith('textures/') || !setPath.endsWith(TEXTURE_SET_EXT)) continue;
      const parsed = parseTextureSet(await project.extraFiles[setPath].text().catch(() => ''));
      if (!parsed) continue;
      const stems = layerStems(setPath, parsed.layers);
      const colourFile = stems.color ? imageFile((p) => p in project.overrides, stems.color) : null;
      if (!colourFile || pbr[colourFile]) continue;
      const original: Record<string, Blob> = { [setPath]: project.extraFiles[setPath] };
      const m: PbrMaterial = { base: [...PLAIN], spots: [], bumps: null, original, updatedAt: Date.now() };
      const take = (stem: string | undefined): Blob | null => {
        const file = stem ? imageFile(has, stem) : null;
        if (!file) return null;
        original[file] = all[file];
        return all[file];
      };
      const merStem = stems.mers ?? stems.mer;
      const map = take(merStem);
      if (map) m.map = { image: map, layout: stems.mers ? 'mers' : 'mer' };
      else {
        const v = parsed.layers.mers ?? parsed.layers.mer;
        if (Array.isArray(v) && v.length >= 3) m.base = [v[0], v[1], v[2], v[3] ?? 0];
      }
      const normal = take(stems.normal ?? stems.heightmap);
      if (normal) m.normal = { image: normal, layout: stems.normal ? 'normal' : 'heightmap' };
      for (const file of Object.keys(original)) {
        delete project.extraFiles[file];
        // a layer never stays a colour texture of its own
        if (file !== colourFile) delete project.overrides[file];
      }
      pbr[colourFile] = m;
      count++;
    }
  }
  if (!Object.keys(pbr).length) delete project.pbr;
  return count;
}
