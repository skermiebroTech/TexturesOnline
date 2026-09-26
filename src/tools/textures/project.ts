import type { AssetIndex, Edition, EffectLayer, TextureCategory, TexturePackProject } from '../../core/types';
import { createImageData, decodeImage, encodeImage, isPng } from '../../core/image';
import { uuidv4 } from '../../core/uuid';
import { javaTextureCategory } from '../../editions/java/textures';
import { bedrockTextureCategory, parseLenientJson } from '../../editions/bedrock/catalog';
import { EFFECT_PRESETS, type EffectPreset } from './effects';

/** Resolutions offered for texture packs (pixels per block face). */
export const RESOLUTIONS = [16, 32, 64, 128, 256, 512] as const;
export const DEFAULT_DESCRIPTION = 'Made with TexturesOnline';

export const JAVA_TEXTURE_ROOT = 'assets/minecraft/textures/';
export const BEDROCK_TEXTURE_ROOT = 'textures/';

export function textureRoot(edition: Edition): string {
  return edition === 'java' ? JAVA_TEXTURE_ROOT : BEDROCK_TEXTURE_ROOT;
}

/** Nearest supported resolution (never below 16). */
export function normalizeResolution(res: number | undefined): number {
  if (!res || !Number.isFinite(res)) return 16;
  let best: number = RESOLUTIONS[0];
  for (const r of RESOLUTIONS) if (Math.abs(r - res) < Math.abs(best - res)) best = r;
  return best;
}

export function newTextureProject(opts: { name: string; edition: Edition; version: string; resolution?: number; description?: string }): TexturePackProject {
  const now = Date.now();
  const name = (opts.name ?? '').trim() || 'My Texture Pack';
  const project: TexturePackProject = {
    id: uuidv4(),
    kind: 'texturepack',
    name,
    createdAt: now,
    updatedAt: now,
    edition: opts.edition,
    version: opts.version,
    description: opts.description?.trim() || DEFAULT_DESCRIPTION,
    resolution: normalizeResolution(opts.resolution),
    overrides: {},
    extraFiles: {},
    effects: [],
  };
  if (opts.edition === 'bedrock') project.bedrockUuids = newBedrockUuids();
  return project;
}

export function newBedrockUuids(): { header: string; module: string } {
  const header = uuidv4();
  let module = uuidv4();
  while (module === header) module = uuidv4();
  return { header, module };
}

/** Lower-case file extension without the dot ('' when none). */
export function extOf(path: string): string {
  const slash = path.lastIndexOf('/');
  const dot = path.lastIndexOf('.');
  return dot > slash ? path.slice(dot + 1).toLowerCase() : '';
}

export function isEdited(project: TexturePackProject, path: string): boolean {
  return Object.prototype.hasOwnProperty.call(project.overrides, path);
}

/** The pack's version of a texture: the override when there is one, otherwise vanilla. */
export async function getBaseImage(project: TexturePackProject, assets: AssetIndex, path: string): Promise<ImageData> {
  const override = project.overrides[path];
  if (override) {
    try {
      return await decodeImage(override, extOf(path));
    } catch (err) {
      if (!assets.hasFile(path)) throw err;
      // A damaged override falls back to vanilla so the texture stays editable.
    }
  }
  if (!assets.hasFile(path)) {
    const game = assets.edition === 'java' ? `Minecraft ${assets.version}` : 'this Bedrock version';
    throw new Error(`"${path.slice(path.lastIndexOf('/') + 1)}" isn't a texture in ${game}, and this pack has no copy of it.`);
  }
  return assets.readImage(path);
}

/** Stores an edited texture, encoded in the format the path needs (.tga stays TGA for Bedrock). */
export async function setOverride(project: TexturePackProject, path: string, img: ImageData): Promise<void> {
  if (!img || img.width < 1 || img.height < 1) throw new Error('The image is empty.');
  const ext = extOf(path) === 'tga' ? 'tga' : 'png';
  project.overrides[path] = await encodeImage(img, ext);
}

export function removeOverride(project: TexturePackProject, path: string): void {
  delete project.overrides[path];
}

/**
 * Nearest-neighbour upscale of 16x-based art to the pack resolution. A strip's frame width tells
 * its current tile size; anything else is assumed to be vanilla (16x) art. Never downscales.
 */
export function scaleForResolution(img: ImageData, resolution: number, isAnimatedStrip = false): ImageData {
  const res = normalizeResolution(resolution);
  const base = isAnimatedStrip && img.width >= 16 ? img.width : 16;
  const factor = Math.max(1, Math.round(res / base));
  const src = img.data;
  if (factor === 1) return createImageData(img.width, img.height, new Uint8ClampedArray(src));
  const w = img.width * factor;
  const h = img.height * factor;
  const out = createImageData(w, h);
  const dst = out.data;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const s = (y * img.width + x) * 4;
      const r = src[s], g = src[s + 1], b = src[s + 2], a = src[s + 3];
      for (let dy = 0; dy < factor; dy++) {
        let o = ((y * factor + dy) * w + x * factor) * 4;
        for (let dx = 0; dx < factor; dx++, o += 4) {
          dst[o] = r;
          dst[o + 1] = g;
          dst[o + 2] = b;
          dst[o + 3] = a;
        }
      }
    }
  }
  return out;
}

// ---- Effect layers ----

export function newLayerId(): string {
  return uuidv4().slice(0, 8);
}

export function addEffectLayer(project: TexturePackProject, layer: Omit<EffectLayer, 'id'>): EffectLayer {
  const full: EffectLayer = { ...layer, params: { ...layer.params }, ...(layer.categories ? { categories: [...layer.categories] } : {}), id: newLayerId() };
  project.effects.push(full);
  return full;
}

/** Applies a one-click preset: replaces the effect stack (default) or appends to it. */
export function applyPreset(project: TexturePackProject, preset: EffectPreset | string, mode: 'replace' | 'append' = 'replace'): EffectLayer[] {
  const p = typeof preset === 'string' ? EFFECT_PRESETS.find((x) => x.id === preset) : preset;
  if (!p) throw new Error(`Unknown preset "${String(preset)}".`);
  if (mode === 'replace') project.effects = [];
  return p.layers.map((l) => addEffectLayer(project, l));
}

// ---- Paths & categories ----

/** Category of a texture path, for textures that aren't in the vanilla index (imported/custom). */
export function categoryForPath(path: string, edition: Edition): TextureCategory {
  const root = textureRoot(edition);
  const rel = path.startsWith(root) ? path.slice(root.length) : path;
  return edition === 'java' ? javaTextureCategory(rel) : bedrockTextureCategory(rel);
}

/** JSON.parse that tolerates a BOM, comments and trailing commas; null when it still can't be read. */
export function parseJsonLoose(text: string): unknown {
  try {
    return parseLenientJson(text);
  } catch {
    return null;
  }
}

/** [major, minor, patch] from a Bedrock version array or "1.2.3" string (format 3 manifests). */
export function parseBedrockVersion(v: unknown): [number, number, number] | null {
  let parts: unknown[] | null = null;
  if (Array.isArray(v)) parts = v;
  else if (typeof v === 'string' && /^\d+(\.\d+){0,2}$/.test(v.trim())) parts = v.trim().split('.').map(Number);
  if (!parts || !parts.length || parts.length > 3 || !parts.every((x) => typeof x === 'number' && Number.isInteger(x) && x >= 0)) return null;
  const n = parts as number[];
  return [n[0], n[1] ?? 0, n[2] ?? 0];
}

/** A safe download name for the pack, with the edition's extension. */
export function packFileName(project: Pick<TexturePackProject, 'name' | 'edition'>): string {
  const base = (project.name || '')
    .normalize('NFC')
    .replace(/§./g, '')
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s_]+|[.\s_]+$/g, '')
    .slice(0, 80)
    .trim();
  const safe = !base || /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(base) ? 'texture-pack' : base;
  return `${safe}.${project.edition === 'bedrock' ? 'mcpack' : 'zip'}`;
}

/** Width/height from a PNG or TGA header without decoding. */
export function imageDims(bytes: Uint8Array, ext?: string): { w: number; h: number } | null {
  if (isPng(bytes) && bytes.length >= 24) {
    const w = ((bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19]) >>> 0;
    const h = ((bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23]) >>> 0;
    return w && h ? { w, h } : null;
  }
  if ((ext ?? '').toLowerCase() === 'tga' && bytes.length >= 18) {
    const w = bytes[12] | (bytes[13] << 8);
    const h = bytes[14] | (bytes[15] << 8);
    return w && h ? { w, h } : null;
  }
  return null;
}
