import type { FileMap, SkinModel } from '../../core/types';
import { convertLegacySkin, decodeImage, decodeImageSync, encodePng, isPng } from '../../core/image';

/*
 * Bedrock manifest.json / skin pack builders: format_version 2 with array versions,
 * stable uuids per project, no `pbr` capability unless asked for.
 */

export const DEFAULT_MIN_ENGINE: [number, number, number] = [1, 21, 0];
/** Vibrant Visuals packs (capability "pbr") need at least this engine version. */
export const PBR_MIN_ENGINE: [number, number, number] = [1, 21, 120];
export const GENERATOR_NAME = 'texturesonline';
export const GENERATOR_VERSION = '1.0.0';

type Vec3 = [number, number, number];

function cmpVec(a: Vec3, b: Vec3): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

function vec(v: readonly number[], fallback: Vec3): Vec3 {
  if (!Array.isArray(v) || v.length < 3) return [...fallback];
  const out = v.slice(0, 3).map((x) => Math.max(0, Math.floor(Number(x) || 0)));
  return [out[0], out[1], out[2]];
}

function checkUuids(uuids: { header: string; module: string }): void {
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!re.test(uuids.header) || !re.test(uuids.module)) throw new Error('The pack IDs are invalid. Create the pack again to get new ones.');
  if (uuids.header.toLowerCase() === uuids.module.toLowerCase()) throw new Error('The pack header and module IDs must be different.');
}

/** JSON with two-space indent and number arrays on one line (UTF-8, no BOM when encoded). */
function stringify(value: unknown): string {
  const walk = (v: unknown, indent: string): string => {
    if (Array.isArray(v)) {
      if (v.every((x) => typeof x === 'number')) return `[${v.join(', ')}]`;
      if (!v.length) return '[]';
      const inner = indent + '  ';
      return `[\n${v.map((x) => inner + walk(x, inner)).join(',\n')}\n${indent}]`;
    }
    if (v && typeof v === 'object') {
      const entries = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined);
      if (!entries.length) return '{}';
      const inner = indent + '  ';
      return `{\n${entries.map(([k, x]) => `${inner}${JSON.stringify(k)}: ${walk(x, inner)}`).join(',\n')}\n${indent}}`;
    }
    return JSON.stringify(v);
  };
  return walk(value, '') + '\n';
}

function singleLine(s: string, max: number): string {
  return (s ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, max);
}

/**
 * Resource pack manifest.json. `capabilities` is omitted unless given (never add "pbr" to plain
 * texture packs); with "pbr" the min engine version is raised to at least 1.21.120.
 */
export function buildResourceManifest(opts: {
  name: string;
  description: string;
  uuids: { header: string; module: string };
  version: [number, number, number];
  minEngine?: [number, number, number];
  capabilities?: string[];
  authors?: string[];
}): string {
  checkUuids(opts.uuids);
  const version = vec(opts.version, [1, 0, 0]);
  let minEngine = vec(opts.minEngine ?? DEFAULT_MIN_ENGINE, DEFAULT_MIN_ENGINE);
  const capabilities = [...new Set((opts.capabilities ?? []).filter((c) => typeof c === 'string' && c.trim()).map((c) => c.trim()))];
  if (capabilities.includes('pbr') && cmpVec(minEngine, PBR_MIN_ENGINE) < 0) minEngine = [...PBR_MIN_ENGINE];
  const authors = (opts.authors ?? []).map((a) => singleLine(a, 100)).filter(Boolean);
  const manifest: Record<string, unknown> = {
    format_version: 2,
    header: {
      name: singleLine(opts.name, 100) || 'My Pack',
      description: (opts.description ?? '').replace(/\r\n?/g, '\n').trim(),
      uuid: opts.uuids.header.toLowerCase(),
      version,
      min_engine_version: minEngine,
    },
    modules: [{ type: 'resources', uuid: opts.uuids.module.toLowerCase(), version }],
  };
  if (capabilities.length) manifest.capabilities = capabilities;
  manifest.metadata = {
    ...(authors.length ? { authors } : {}),
    generated_with: { [GENERATOR_NAME]: [GENERATOR_VERSION] },
  };
  return stringify(manifest);
}

/** Bumps the patch number (with carry) for the next export, so it replaces the installed copy. */
export function bumpPackVersion(v: [number, number, number] | undefined): [number, number, number] {
  if (!v) return [1, 0, 0];
  const [a, b, c] = vec(v, [1, 0, 0]);
  return [a, b, c + 1];
}

// ---- Skin packs ----

/** Identifier for skins.json / lang keys: letters, digits and underscores only. */
export function toSkinIdentifier(s: string, fallback: string): string {
  const words = (s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  let id = words.map((w) => w[0].toUpperCase() + w.slice(1)).join('');
  if (!id) id = fallback;
  if (/^[0-9]/.test(id)) id = `_${id}`;
  return id.slice(0, 48);
}

function skinFileName(s: string, fallback: string): string {
  const base = (s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return base || fallback;
}

function langValue(s: string): string {
  return singleLine(s, 200).replace(/\t/g, ' ');
}

export interface SkinPackSkin {
  name: string;
  model: SkinModel;
  /** 64x64 or 128x128 PNG (64x32 legacy skins are converted) */
  png: Blob | Uint8Array;
}

/**
 * PNG bytes ready for a skin pack: validates the size and converts legacy 64x32 skins to 64x64
 * with Java's algorithm. Only 64x64, 128x128 and 64x32 are accepted.
 */
export function prepareSkinPngSync(png: Uint8Array): Uint8Array {
  if (!isPng(png)) throw new Error('Skins must be PNG images.');
  const img = decodeImageSync(png, 'png');
  return prepareSkinImage(img, png);
}

function prepareSkinImage(img: ImageData, original: Uint8Array | null): Uint8Array {
  const { width: w, height: h } = img;
  if (w === 64 && h === 32) return encodePng(convertLegacySkin(img));
  if ((w === 64 && h === 64) || (w === 128 && h === 128)) return original ?? encodePng(img);
  throw new Error(`Skins must be 64x64 or 128x128 pixels (this one is ${w}x${h}).`);
}

export async function prepareSkinPng(png: Blob | Uint8Array): Promise<Uint8Array> {
  const bytes = png instanceof Uint8Array ? png : new Uint8Array(await png.arrayBuffer());
  if (isPng(bytes)) return prepareSkinPngSync(bytes);
  return prepareSkinImage(await decodeImage(bytes), null);
}

/**
 * Skin pack files (zip root): manifest.json, skins.json, texts/en_US.lang, texts/languages.json
 * and one PNG per skin. serialize_name == localization_name, so either reading of the lang keys works.
 * Uint8Array skins are validated/converted here; Blob skins are included as given (use
 * buildSkinPackFilesAsync to validate them too).
 */
export function buildSkinPackFiles(opts: {
  name: string;
  skins: SkinPackSkin[];
  uuids: { header: string; module: string };
  version: [number, number, number];
  author?: string;
}): FileMap {
  checkUuids(opts.uuids);
  if (!opts.skins.length) throw new Error('Add at least one skin to the pack.');
  const version = vec(opts.version, [1, 0, 0]);
  const packName = singleLine(opts.name, 100) || 'My Skins';
  // Unique across installed packs: the name plus a slice of the pack uuid.
  const packId = `${toSkinIdentifier(packName, 'Skins')}_${opts.uuids.header.replace(/-/g, '').slice(0, 8)}`;
  const files: FileMap = {};
  const usedIds = new Set<string>();
  const usedFiles = new Set<string>();
  const skinsJson: { localization_name: string; geometry: string; texture: string; type: string }[] = [];
  const lang: string[] = [`skinpack.${packId}=${langValue(packName)}`];
  if (opts.author?.trim()) lang.push(`skinpack.${packId}.by=${langValue(opts.author)}`);

  opts.skins.forEach((skin, i) => {
    const display = singleLine(skin.name, 100) || `Skin ${i + 1}`;
    let id = toSkinIdentifier(display, `Skin${i + 1}`);
    for (let n = 2; usedIds.has(id); n++) id = `${toSkinIdentifier(display, `Skin${i + 1}`)}${n}`;
    usedIds.add(id);
    let file = skinFileName(display, `skin_${i + 1}`);
    for (let n = 2; usedFiles.has(file); n++) file = `${skinFileName(display, `skin_${i + 1}`)}_${n}`;
    usedFiles.add(file);
    const texture = `${file}.png`;
    files[texture] = skin.png instanceof Uint8Array ? prepareSkinPngSync(skin.png) : skin.png;
    skinsJson.push({
      localization_name: id,
      geometry: skin.model === 'slim' ? 'geometry.humanoid.customSlim' : 'geometry.humanoid.custom',
      texture,
      type: 'free',
    });
    lang.push(`skin.${packId}.${id}=${langValue(display)}`);
  });

  files['manifest.json'] = stringify({
    format_version: 2,
    header: { name: packName, uuid: opts.uuids.header.toLowerCase(), version },
    modules: [{ type: 'skin_pack', uuid: opts.uuids.module.toLowerCase(), version }],
  });
  files['skins.json'] = stringify({ serialize_name: packId, localization_name: packId, skins: skinsJson });
  files['texts/en_US.lang'] = lang.join('\n') + '\n';
  files['texts/languages.json'] = stringify(['en_US']);
  return files;
}

/** Like buildSkinPackFiles, but reads Blob skins so every skin is validated and legacy ones converted. */
export async function buildSkinPackFilesAsync(opts: Parameters<typeof buildSkinPackFiles>[0]): Promise<FileMap> {
  const skins = await Promise.all(opts.skins.map(async (s) => ({ ...s, png: await prepareSkinPng(s.png) })));
  return buildSkinPackFiles({ ...opts, skins });
}
