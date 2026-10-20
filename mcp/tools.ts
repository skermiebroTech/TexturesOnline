// What the MCP server can do, written against the same modules the website uses: the pages build
// packs in the browser, these functions build the very same packs in Node. Everything here is
// independent of the MCP SDK (server.ts registers it), so the unit tests call it directly.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, extname, isAbsolute, resolve } from 'node:path';
import type { AssetIndex, Edition, EffectLayer, GameVersion, TextureCategory, TextureInfo } from '../src/core/types';
import { createImageData, decodeImage, encodePng, fitToSize, resizeNearest } from '../src/core/image';
import { DEFAULT_JAVA_VERSION } from '../src/editions/versions';
import { describePackForGame } from '../src/editions/java/packmeta';
import { KNOWN_RELEASES, KNOWN_RELEASE_FORMATS, formatPackFormat } from '../src/editions/java/packformats';
import { EFFECTS, EFFECT_PRESETS, applyEffects, applyPreset, createLayer, getEffect, getPreset } from '../src/tools/textures/effects';
import { exportTexturePack } from '../src/tools/textures/export';
import { importPack } from '../src/tools/textures/import';
import { addEffectLayer, categoryForPath, newTextureProject, setOverride, textureRoot } from '../src/tools/textures/project';
import { convertPack, type ConvertMaps } from '../src/tools/convert/convert';
import { SITE_URL } from '../src/app/site';

export interface ToolDeps {
  listVersions(edition: Edition, opts: { includeSnapshots?: boolean }): Promise<GameVersion[]>;
  /** Vanilla assets of a version ('latest' for Bedrock). */
  loadAssets(edition: Edition, version: string): Promise<AssetIndex>;
  loadConvertMaps(): Promise<ConvertMaps>;
  /** Where packs are written when a call doesn't name a folder. */
  outputDir: string;
}

/** Shown with every pack the server makes: the website stays the place to look at and edit it. */
export const EDIT_HINT = `To look at it or keep editing by hand, open ${SITE_URL} and use "Open pack" in the texture pack maker.`;

export function defaultVersion(edition: Edition, version?: string): string {
  return version?.trim() || (edition === 'java' ? DEFAULT_JAVA_VERSION : 'latest');
}

// ---- Versions ----

export async function listVersionsTool(deps: ToolDeps, args: { edition: Edition; include_snapshots?: boolean }) {
  const versions = await deps.listVersions(args.edition, { includeSnapshots: !!args.include_snapshots });
  return {
    edition: args.edition,
    default: defaultVersion(args.edition),
    versions: versions.map((v) => ({
      id: v.id,
      name: v.name,
      type: v.type,
      ...(v.packFormat ? { pack_format: formatPackFormat(v.packFormat) } : {}),
    })),
  };
}

// ---- Textures ----

/**
 * The pack path of a texture from what a caller is likely to write: the full path, the id the site
 * shows ('block/stone'), or a bare name ('stone') when only one texture has it.
 */
export function resolveTexturePath(assets: AssetIndex, ref: string): { path: string; known: boolean } {
  const root = textureRoot(assets.edition);
  const clean = ref.trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/^minecraft:/, '');
  if (assets.hasFile(clean)) return { path: clean, known: true };
  const id = clean.startsWith(root) ? clean.slice(root.length) : clean;
  const stem = id.replace(/\.(png|tga)$/i, '');
  const byId = assets.textures.find((t) => t.id === stem);
  if (byId) return { path: byId.path, known: true };
  const byName = assets.textures.filter((t) => t.name === stem);
  if (byName.length === 1) return { path: byName[0].path, known: true };
  // "stone" means the block (or the item), not the villager badge of the same name.
  const main = byName.filter((t) => /^(block|item)s?\//.test(t.id));
  if (main.length === 1) return { path: main[0].path, known: true };
  if (byName.length > 1) throw new Error(`"${ref}" matches several textures: ${byName.slice(0, 8).map((t) => t.id).join(', ')}. Use the full id.`);
  // A texture the game doesn't have (e.g. for a model): allowed under the texture root only.
  if (clean.startsWith(root) && /\.(png|tga)$/i.test(clean)) return { path: clean, known: false };
  const near = nearTextures(assets.textures, stem).slice(0, 8);
  throw new Error(
    `No texture "${ref}" in ${assets.edition === 'java' ? 'Java' : 'Bedrock'} ${assets.version}.` +
      (near.length ? ` Did you mean: ${near.map((t) => t.id).join(', ')}?` : ' Use list_textures to find it.'),
  );
}

function searchTextures(textures: TextureInfo[], query: string): TextureInfo[] {
  const words = query.toLowerCase().split(/[\s/_-]+/).filter(Boolean);
  if (!words.length) return textures;
  return textures.filter((t) => words.every((w) => t.id.toLowerCase().includes(w)));
}

/** Textures sharing the most words with a reference that didn't match (typos, wrong folder). */
function nearTextures(textures: TextureInfo[], ref: string): TextureInfo[] {
  const words = ref.toLowerCase().split(/[\s/_.-]+/).filter((w) => w.length > 2);
  const scored = textures
    .map((t) => {
      const parts = t.id.toLowerCase().split(/[/_]/).filter((x) => x.length > 2);
      return { t, n: words.filter((w) => parts.some((x) => x.includes(w) || w.includes(x))).length };
    })
    .filter((x) => x.n > 0);
  return scored.sort((a, b) => b.n - a.n || a.t.id.length - b.t.id.length).map((x) => x.t);
}

export async function listTexturesTool(
  deps: ToolDeps,
  args: { edition: Edition; version?: string; search?: string; category?: TextureCategory; limit?: number; offset?: number },
) {
  const version = defaultVersion(args.edition, args.version);
  const assets = await deps.loadAssets(args.edition, version);
  let list = searchTextures(assets.textures, args.search ?? '');
  if (args.category) list = list.filter((t) => t.category === args.category);
  const offset = Math.max(0, args.offset ?? 0);
  const limit = Math.min(500, Math.max(1, args.limit ?? 100));
  return {
    edition: args.edition,
    version,
    total: list.length,
    offset,
    textures: list.slice(offset, offset + limit).map((t) => ({ id: t.id, path: t.path, category: t.category, ...(t.animated ? { animated: true } : {}) })),
  };
}

/** A texture as PNG, plus a nearest-neighbour enlargement so 16x pixel art is readable. */
export async function getTextureTool(deps: ToolDeps, args: { edition: Edition; version?: string; texture: string; preview_size?: number }) {
  const version = defaultVersion(args.edition, args.version);
  const assets = await deps.loadAssets(args.edition, version);
  const { path, known } = resolveTexturePath(assets, args.texture);
  if (!known) throw new Error(`${path} is not a texture of the game.`);
  const img = await assets.readImage(path);
  const target = Math.min(1024, Math.max(16, args.preview_size ?? 256));
  const factor = Math.max(1, Math.floor(target / Math.max(img.width, img.height)));
  const preview = factor > 1 ? resizeNearest(img, img.width * factor, img.height * factor) : img;
  return {
    info: { edition: args.edition, version, path, width: img.width, height: img.height, category: categoryForPath(path, args.edition), preview_scale: factor },
    png: encodePng(img),
    preview: encodePng(preview),
  };
}

// ---- Effects ----

export function listEffectsTool() {
  return {
    effects: EFFECTS.map((e) => ({
      type: e.type,
      label: e.label,
      ...(e.description ? { description: e.description } : {}),
      params: e.params.map((o) => ({
        key: o.key,
        type: o.type,
        default: o.default,
        ...(o.min !== undefined ? { min: o.min } : {}),
        ...(o.max !== undefined ? { max: o.max } : {}),
        ...(o.options ? { options: o.options.map((x) => x.value) } : {}),
      })),
    })),
    presets: EFFECT_PRESETS.map((p) => ({ id: p.id, label: p.label, description: p.description })),
  };
}

export interface EffectInput {
  type: string;
  params?: Record<string, number | boolean | string>;
  categories?: TextureCategory[];
}

function toLayer(e: EffectInput): Omit<EffectLayer, 'id'> {
  const def = getEffect(e.type);
  if (!def) throw new Error(`Unknown effect "${e.type}". Effects: ${EFFECTS.map((x) => x.type).join(', ')}.`);
  // The site's settings quietly fall back to defaults; a caller guessing a name should hear about it.
  const keys = def.params.map((o) => o.key);
  const unknown = Object.keys(e.params ?? {}).filter((k) => !keys.includes(k));
  if (unknown.length) throw new Error(`Effect "${e.type}" has no setting ${unknown.map((k) => `"${k}"`).join(', ')}. Its settings: ${keys.join(', ') || 'none'}.`);
  const layer = createLayer(e.type, e.params);
  return e.categories?.length ? { ...layer, categories: [...e.categories] } : layer;
}

// ---- Images from a call ----

export interface PixelArt {
  /** One character per colour: '#rgb', '#rrggbb' or '#rrggbbaa'. '.' and ' ' are transparent unless listed. */
  palette: Record<string, string>;
  /** Rows of palette characters, top to bottom, all the same length. */
  rows: string[];
}

export interface ImageInput {
  /** PNG / TGA file on this computer */
  file?: string;
  png_base64?: string;
  pixel_art?: PixelArt;
}

function parseColor(s: string): [number, number, number, number] {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(s.trim());
  if (!m) throw new Error(`"${s}" is not a colour (use #rrggbb or #rrggbbaa).`);
  let h = m[1];
  if (h.length <= 4) h = [...h].map((c) => c + c).join('');
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
  return [n(0), n(2), n(4), h.length === 8 ? n(6) : 255];
}

export function pixelArtToImage(art: PixelArt): ImageData {
  const rows = art.rows;
  if (!rows?.length) throw new Error('pixel_art needs at least one row.');
  const chars = rows.map((r) => [...r]);
  const w = chars[0].length;
  if (!w || chars.some((r) => r.length !== w)) throw new Error('Every pixel_art row must have the same number of characters.');
  if (w > 1024 || rows.length > 1024) throw new Error('pixel_art is limited to 1024x1024.');
  const colors = new Map<string, [number, number, number, number]>([['.', [0, 0, 0, 0]], [' ', [0, 0, 0, 0]]]);
  for (const [k, v] of Object.entries(art.palette ?? {})) {
    if ([...k].length !== 1) throw new Error(`Palette keys are single characters ("${k}" is not).`);
    colors.set(k, parseColor(v));
  }
  const img = createImageData(w, rows.length);
  chars.forEach((row, y) =>
    row.forEach((c, x) => {
      const col = colors.get(c);
      if (!col) throw new Error(`pixel_art uses "${c}" (row ${y + 1}) but the palette doesn't define it.`);
      img.data.set(col, (y * w + x) * 4);
    }),
  );
  return img;
}

async function readImageInput(input: ImageInput, what: string): Promise<ImageData> {
  const given = [input.file, input.png_base64, input.pixel_art].filter((x) => x !== undefined).length;
  if (given > 1) throw new Error(`${what}: give only one of file, png_base64 or pixel_art.`);
  if (input.pixel_art) return pixelArtToImage(input.pixel_art);
  if (input.png_base64) return decodeImage(Buffer.from(input.png_base64.replace(/^data:[^,]*,/, ''), 'base64'), 'png');
  if (input.file) return decodeImage(await readFile(input.file), extname(input.file).slice(1).toLowerCase());
  throw new Error(`${what}: give file, png_base64 or pixel_art.`);
}

// ---- Packs ----

export interface TextureInput extends ImageInput {
  /** Pack path, id ('block/stone') or name ('stone') */
  texture: string;
  /** Applied to this texture only, after the image is read (the vanilla one when no image is given). */
  effects?: EffectInput[];
}

export interface CreatePackArgs {
  edition: Edition;
  version?: string;
  name: string;
  description?: string;
  /** Java: also declare support for this range of versions in pack.mcmeta */
  compat?: { min_version: string; max_version: string };
  preset?: string;
  effects?: EffectInput[];
  textures?: TextureInput[];
  icon?: ImageInput;
  output_dir?: string;
}

async function writeOutput(deps: ToolDeps, dir: string | undefined, filename: string, blob: Blob): Promise<string> {
  const folder = resolve(deps.outputDir, dir ?? '.');
  await mkdir(folder, { recursive: true });
  const out = resolve(folder, filename);
  await writeFile(out, new Uint8Array(await blob.arrayBuffer()));
  return out;
}

export async function createTexturePackTool(deps: ToolDeps, args: CreatePackArgs) {
  const version = defaultVersion(args.edition, args.version);
  if (args.compat && args.edition !== 'java') throw new Error('compat is a Java setting (pack.mcmeta); Bedrock packs use min_engine_version.');
  if (!args.preset && !args.effects?.length && !args.textures?.length && !args.icon)
    throw new Error('Nothing to put in the pack: give a preset, effects or textures.');
  const assets = await deps.loadAssets(args.edition, version);
  const project = newTextureProject({ name: args.name, edition: args.edition, version, description: args.description });
  if (args.compat) project.compat = { minVersion: args.compat.min_version, maxVersion: args.compat.max_version };
  if (args.preset) {
    if (!getPreset(args.preset)) throw new Error(`Unknown preset "${args.preset}". Presets: ${EFFECT_PRESETS.map((p) => p.id).join(', ')}.`);
    applyPreset(project, args.preset);
  }
  for (const e of args.effects ?? []) addEffectLayer(project, toLayer(e));

  const notes: string[] = [];
  for (const t of args.textures ?? []) {
    const { path, known } = resolveTexturePath(assets, t.texture);
    if (!known) notes.push(`${path} is not a vanilla texture; it is added as a new file.`);
    const hasImage = t.file !== undefined || t.png_base64 !== undefined || t.pixel_art !== undefined;
    if (!hasImage && !t.effects?.length) throw new Error(`${t.texture}: give an image (file, png_base64 or pixel_art) or effects to apply to the vanilla texture.`);
    if (!hasImage && !known) throw new Error(`${t.texture}: a new texture needs an image.`);
    let img = hasImage ? await readImageInput(t, t.texture) : await assets.readImage(path);
    if (t.effects?.length) {
      const layers = t.effects.map((e) => ({ ...toLayer(e), categories: undefined }));
      img = applyEffects(img, layers, { path, category: categoryForPath(path, args.edition) });
    }
    await setOverride(project, path, img);
  }
  if (args.icon) {
    const icon = await readImageInput(args.icon, 'icon');
    const size = args.edition === 'java' ? 128 : 256;
    project.icon = new Blob([encodePng(fitToSize(icon, size, size, 'nearest'))], { type: 'image/png' });
  }

  const res = await exportTexturePack(project, assets);
  const file = await writeOutput(deps, args.output_dir, res.filename, res.blob);
  return {
    file,
    edition: args.edition,
    version,
    files_in_pack: res.fileCount,
    edited_textures: Object.keys(project.overrides).length,
    effects: project.effects.map((l) => l.type),
    warnings: [...notes, ...res.warnings],
    next: EDIT_HINT,
  };
}

async function openPackFile(input: string) {
  const path = isAbsolute(input) ? input : resolve(input);
  const bytes = await readFile(path);
  return importPack(new File([bytes], basename(path)));
}

/** What a pack is and which game versions accept it. */
export async function inspectPackTool(_deps: ToolDeps, args: { file: string }) {
  const { project, warnings } = await openPackFile(args.file);
  const mcmeta = project.extraFiles['pack.mcmeta'];
  let javaVersions: { works_on: string[]; summary: string } | undefined;
  if (project.edition === 'java' && mcmeta) {
    const text = await mcmeta.text();
    const ok = KNOWN_RELEASES.filter((id) => describePackForGame(text, KNOWN_RELEASE_FORMATS[id]) === 'compatible');
    javaVersions = { works_on: ok, summary: ok.length ? (ok.length === 1 ? ok[0] : `${ok[0]} – ${ok[ok.length - 1]} (${ok.length} releases)`) : 'no known release accepts this pack.mcmeta' };
  }
  const textures = Object.keys(project.overrides);
  return {
    name: project.name,
    edition: project.edition,
    version: project.version,
    description: project.description,
    ...(project.compat ? { compat: project.compat } : {}),
    ...(javaVersions ? { java_releases: javaVersions } : {}),
    textures: textures.length,
    texture_sample: textures.slice(0, 20),
    other_files: Object.keys(project.extraFiles).length,
    has_icon: !!project.icon,
    warnings,
  };
}

export async function convertPackTool(deps: ToolDeps, args: { file: string; edition: Edition; version?: string; output_dir?: string }) {
  const { project: source, warnings } = await openPackFile(args.file);
  const target = { edition: args.edition, version: defaultVersion(args.edition, args.version) };
  const [assets, maps] = await Promise.all([deps.loadAssets(target.edition, target.version), deps.loadConvertMaps()]);
  const { project, report } = await convertPack(source, target, assets, maps);
  const res = await exportTexturePack(project, assets);
  const file = await writeOutput(deps, args.output_dir, res.filename, res.blob);
  return {
    file,
    from: report.from,
    to: report.to,
    textures_in_source: report.total,
    converted: report.converted.length,
    skipped: report.skipped.length,
    skipped_sample: report.skipped.slice(0, 20).map((s) => ({ texture: s.source, reason: s.detail })),
    dropped_files: report.dropped.length,
    notes: report.notes,
    warnings: [...warnings, ...res.warnings],
    next: EDIT_HINT,
  };
}
