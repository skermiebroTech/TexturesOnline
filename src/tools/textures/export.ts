import type { AssetIndex, Edition, EffectLayer, PackFormat, ProgressFn, TexturePackProject } from '../../core/types';
import { createImageData, decodeImage, encodePng, encodeTga, fitToSize, isPng } from '../../core/image';
import { normalizeZipPath, writeZip } from '../../core/zip';
import { abortError, isAbortError } from '../../core/net';
import { isUuid } from '../../core/uuid';
import { buildPackMcmeta, buildPackMcmetaForVersions, describePackForGame, getJavaPackFormat, stringifyPretty } from '../../editions/java/packmeta';
import { comparePackFormats, packFormatFromVersionJson } from '../../editions/java/packformats';
import { DEFAULT_MIN_ENGINE, buildResourceManifest, bumpPackVersion } from '../../editions/bedrock/manifest';
import { applyEffects, effectsApply, hasActiveEffects, type EffectContext } from './effects';
import { categoryForPath, extOf, imageDims, newBedrockUuids, packFileName, parseBedrockVersion, parseJsonLoose } from './project';

export interface ExportOptions {
  onProgress?: ProgressFn;
  signal?: AbortSignal;
  /** Vanilla textures are only included when the effects change them (the only mode). */
  includeUnchanged?: 'effects-only';
}

export interface ExportResult {
  blob: Blob;
  filename: string;
  /** Things worth telling the user (textures that failed, settings that were dropped, ...) */
  warnings: string[];
  /** Number of files in the archive */
  fileCount: number;
}

const JAVA_ICON_SIZE = 128;
const BEDROCK_ICON_SIZE = 256;
const CONCURRENCY = 8;
const RESERVED: Record<Edition, Set<string>> = {
  java: new Set(['pack.mcmeta', 'pack.png']),
  bedrock: new Set(['manifest.json', 'pack_icon.png']),
};

export interface AnimationInfo {
  width?: number;
  height?: number;
}
interface McmetaSource {
  text: string;
  /** true when the pack itself (an imported pack) provides this .mcmeta */
  fromPack: boolean;
}
type Dims = { w: number; h: number };

/**
 * Builds the downloadable pack.
 * Java: .zip with pack.mcmeta for the target version (and optional compatibility range), pack.png,
 * edited textures and, when effects are on, every vanilla texture they change (with its .mcmeta).
 * Bedrock: .mcpack with manifest.json (stable uuids, version bumped), pack_icon.png and textures at
 * their vanilla paths and extensions. On success the project's Bedrock uuids/packVersion are
 * updated, so save the project afterwards.
 */
export async function exportTexturePack(project: TexturePackProject, assets: AssetIndex, opts: ExportOptions = {}): Promise<ExportResult> {
  const { signal } = opts;
  const edition = project.edition;
  const warnings: string[] = [];
  const progress = progressReporter(opts.onProgress);
  check(signal);
  if (assets.edition !== edition) {
    throw new Error(`The loaded game files are for ${editionName(assets.edition)}, but this pack is for ${editionName(edition)}.`);
  }
  progress('Preparing pack…', 0);

  const layers: EffectLayer[] = (project.effects ?? []).filter((l) => l.enabled);
  const effectsOn = hasActiveEffects(layers);
  const extra = await collectExtraFiles(project, warnings);
  const extraMcmeta = new Map<string, string>();
  for (const [path, bytes] of extra) if (path.endsWith('.mcmeta')) extraMcmeta.set(path, decodeText(bytes));
  const overrides = new Map<string, Blob>();
  for (const [raw, blob] of Object.entries(project.overrides ?? {})) {
    const path = normalizeZipPath(raw);
    if (path && blob) overrides.set(path, blob);
  }
  const index = new Map(assets.textures.map((t) => [t.path, t]));

  // --- pack info first: it can fail (offline version lookup) and should do so before the long part ---
  const files: Record<string, Uint8Array | string> = {};
  let nextUuids: { header: string; module: string } | undefined;
  let nextVersion: [number, number, number] | undefined;
  if (edition === 'java') {
    files['pack.mcmeta'] = await buildJavaMcmeta(project, assets, extra.get('pack.mcmeta'), warnings);
  } else {
    if (validUuids(project.bedrockUuids)) nextUuids = { ...project.bedrockUuids! };
    else {
      nextUuids = newBedrockUuids();
      if (project.bedrockUuids) warnings.push("The pack's IDs were invalid, so it got new ones. It will install as a separate pack.");
    }
    nextVersion = bumpPackVersion(project.packVersion);
    const original = extra.get('manifest.json');
    const extras = original ? manifestExtras(original) : {};
    const manifest = buildResourceManifest({
      name: project.name?.trim() || 'Texture Pack',
      description: project.description ?? '',
      uuids: nextUuids,
      version: nextVersion,
      ...extras,
    });
    files['manifest.json'] = mergeManifest(manifest, original);
  }
  check(signal);

  // --- textures ---
  const jobs: { path: string; override: boolean }[] = [...overrides.keys()].map((path) => ({ path, override: true }));
  let vanillaJobs = 0;
  if (effectsOn) {
    // Bedrock picks .tga over .png for the same name inside a pack, so a pack's own image under
    // another extension must not be shadowed by an effect-processed copy of the vanilla file.
    const packStems = new Set<string>();
    if (edition === 'bedrock') for (const p of [...overrides.keys(), ...extra.keys()]) if (IMAGE_PATH.test(p)) packStems.add(stemOf(p));
    for (const t of assets.textures) {
      if (overrides.has(t.path) || extra.has(t.path) || packStems.has(stemOf(t.path))) continue;
      if (!effectsApply(layers, { path: t.path, category: t.category })) continue;
      jobs.push({ path: t.path, override: false });
      vanillaJobs++;
    }
  }
  if (!jobs.length && !extra.size) {
    warnings.push("This pack doesn't change any textures yet, so it won't look different in game. Edit a texture or add an effect first.");
  }

  const out = new Map<string, Uint8Array>();
  const failedVanilla: string[] = [];
  const failedOverrides: string[] = [];
  const unreadable: string[] = [];
  let done = 0;
  const label = effectsOn ? 'Applying effects' : 'Adding textures';
  const slice = timeSlicer();
  await runPool(jobs, CONCURRENCY, signal, async (job) => {
    await slice();
    check(signal);
    try {
      const written = await processTexture(job.path, job.override);
      if (written) for (const [p, bytes] of written) out.set(p, bytes);
    } catch (err) {
      if (isAbortError(err)) throw err;
      if (job.override) {
        let raw: Uint8Array | null = null;
        try {
          raw = new Uint8Array(await overrides.get(job.path)!.arrayBuffer());
        } catch {
          unreadable.push(job.path);
        }
        if (raw) {
          failedOverrides.push(job.path);
          out.set(job.path, raw);
          // Keep the vanilla metadata (GUI nine-slice, animation) so the texture still works as before.
          if (edition === 'java' && /\.png$/i.test(job.path)) {
            const meta = await findMcmeta(job.path);
            if (meta && !meta.fromPack) out.set(`${job.path}.mcmeta`, encodeText(meta.text));
          }
        }
      } else failedVanilla.push(job.path);
    }
    done++;
    progress(`${label}… ${done.toLocaleString('en-US')} / ${jobs.length.toLocaleString('en-US')}`, 0.02 + 0.84 * (done / Math.max(1, jobs.length)));
  });
  check(signal);
  if (vanillaJobs > 0 && failedVanilla.length === vanillaJobs) {
    throw new Error("Couldn't load the game's textures to apply the effects. Check your connection and try again.");
  }
  if (failedVanilla.length) {
    warnings.push(`${plural(failedVanilla.length, 'texture')} couldn't be loaded, so the effects are missing on ${failedVanilla.length === 1 ? 'it' : 'them'}: ${sample(failedVanilla)}.`);
  }
  if (failedOverrides.length) {
    warnings.push(`The effects couldn't be applied to ${plural(failedOverrides.length, 'edited texture')}, so ${failedOverrides.length === 1 ? 'it was' : 'they were'} added as-is: ${sample(failedOverrides)}.`);
  }
  if (unreadable.length) {
    warnings.push(`${plural(unreadable.length, 'edited texture')} couldn't be read from this browser's storage and ${unreadable.length === 1 ? 'was' : 'were'} left out: ${sample(unreadable)}.`);
  }

  // --- icon ---
  progress('Creating pack icon…', 0.88);
  const icon = await buildIcon(project, assets, layers, overrides, edition === 'java' ? JAVA_ICON_SIZE : BEDROCK_ICON_SIZE, warnings);
  check(signal);

  // --- files ---
  progress('Writing pack info…', 0.9);
  files[edition === 'java' ? 'pack.png' : 'pack_icon.png'] = icon;
  for (const [path, bytes] of extra) if (!RESERVED[edition].has(path)) files[path] = bytes;
  for (const path of [...out.keys()].sort()) files[path] = out.get(path)!;
  check(signal);

  // --- zip ---
  progress('Compressing…', 0.93);
  const blob = await writeZip(files, { mimeType: edition === 'java' ? 'application/zip' : 'application/octet-stream' });
  check(signal);
  if (edition === 'bedrock') {
    project.bedrockUuids = nextUuids;
    project.packVersion = nextVersion;
  }
  progress('Done', 1);
  return { blob, filename: packFileName(project), warnings, fileCount: Object.keys(files).length };

  // ------------------------------------------------------------------------------------------

  /** Files to write for one texture (the image plus metadata that must travel with it), or null to skip. */
  async function processTexture(path: string, isOverride: boolean): Promise<[string, Uint8Array][] | null> {
    const info = index.get(path);
    const category = info?.category ?? categoryForPath(path, edition);
    const ext = extOf(path);
    const isImage = ext === 'png' || ext === 'tga';
    const mcmeta = edition === 'java' && isImage ? await findMcmeta(path) : null;
    const anim = parseAnimation(mcmeta?.text);
    // Java: exactly the textures with an animation .mcmeta. Bedrock: the flipbook list (only guess for unknown paths).
    const animated = edition === 'java' ? !!anim : info ? !!info.animated : undefined;
    const ctx: EffectContext = { path, category, animated };
    const applies = isImage && effectsApply(layers, ctx);
    const nineSlice = edition === 'bedrock' && isNineSliceCandidate(path);

    if (!isOverride) {
      const input = await assets.readImage(path);
      const inDims = { w: input.width, h: input.height };
      setFrames(ctx, anim, inDims, 1);
      const result = applyEffects(input, layers, ctx);
      if (result === input || sameImage(result, input)) return null;
      return [[path, encodeFor(ext, result)], ...(await metadataFor(path, { w: result.width, h: result.height }, inDims, inDims, inDims, anim, mcmeta))];
    }

    const srcBytes = new Uint8Array(await overrides.get(path)!.arrayBuffer());
    if (!isImage) return [[path, srcBytes]];
    const needsVanillaSize = assets.hasFile(path) && (applies || nineSlice || (!!mcmeta && !mcmeta.fromPack));
    const vanillaDims = needsVanillaSize ? imageDims(await assets.readFile(path), ext) : null;
    if (!applies) {
      const dims = imageDims(srcBytes, ext);
      if (!dims) return [[path, srcBytes]];
      const ref = mcmeta?.fromPack ? dims : (vanillaDims ?? dims);
      return [[path, srcBytes], ...(await metadataFor(path, dims, ref, vanillaDims, dims, anim, mcmeta))];
    }
    const input = await decodeImage(srcBytes, ext);
    const inDims = { w: input.width, h: input.height };
    const ref = mcmeta?.fromPack ? inDims : (vanillaDims ?? inDims);
    setFrames(ctx, anim, inDims, inDims.w / ref.w);
    const result = applyEffects(input, layers, ctx);
    const bytes = result === input ? srcBytes : encodeFor(ext, result);
    return [[path, bytes], ...(await metadataFor(path, { w: result.width, h: result.height }, ref, vanillaDims, inDims, anim, mcmeta))];
  }

  async function findMcmeta(path: string): Promise<McmetaSource | null> {
    const own = extraMcmeta.get(`${path}.mcmeta`);
    if (own !== undefined) return { text: own, fromPack: true };
    if (!assets.hasFile(`${path}.mcmeta`)) return null;
    try {
      return { text: await assets.readText(`${path}.mcmeta`), fromPack: false };
    } catch {
      return null;
    }
  }

  /**
   * Java: the texture's .mcmeta (frame sizes scaled for resized textures, frame lists trimmed to the
   * frames that exist). Bedrock UI: nine-slice JSON scaled for resized textures.
   * `ref` = size the .mcmeta values refer to, `vanilla` = size of the vanilla texture,
   * `stored` = size of the image as the project stores it (what the pack's own sidecar files describe).
   */
  async function metadataFor(path: string, dims: Dims, ref: Dims, vanilla: Dims | null, stored: Dims, anim: AnimationInfo | null, mcmeta: McmetaSource | null): Promise<[string, Uint8Array][]> {
    const files: [string, Uint8Array][] = [];
    if (edition === 'java' && mcmeta) {
      const adjusted = adjustMcmeta(mcmeta.text, anim, dims, dims.w / ref.w);
      if (adjusted !== null) files.push([`${path}.mcmeta`, encodeText(adjusted)]);
      else if (!mcmeta.fromPack) files.push([`${path}.mcmeta`, encodeText(mcmeta.text)]);
    }
    if (edition === 'bedrock' && isNineSliceCandidate(path)) {
      const jsonPath = path.replace(/\.[^./]+$/, '.json');
      const own = extra.get(jsonPath);
      const base = own ? stored : vanilla;
      if (base && base.w > 0 && dims.w !== base.w && (own || assets.hasFile(jsonPath))) {
        try {
          const scaled = scaleNineSlice(own ? decodeText(own) : await assets.readText(jsonPath), dims.w / base.w);
          if (scaled) files.push([jsonPath, encodeText(scaled)]);
        } catch {
          // The texture still works; only its UI stretching may look off.
        }
      }
    }
    return files;
  }
}

// ---------------------------------------------------------------------------------------------
// Pack info

/**
 * The compatibility range to declare: always contains the target version (a range that leaves it
 * out would make the pack "made for an older/newer version" in the very game it was made for).
 */
export async function effectiveCompat(
  version: string,
  compat: { minVersion: string; maxVersion: string } | undefined,
  warnings: string[] = [],
): Promise<{ minVersion: string; maxVersion: string } | undefined> {
  if (!compat?.minVersion || !compat.maxVersion) return undefined;
  let formats: (PackFormat | null)[];
  try {
    formats = await Promise.all([getJavaPackFormat(version), getJavaPackFormat(compat.minVersion), getJavaPackFormat(compat.maxVersion)]);
  } catch {
    return compat;
  }
  const [target, a, b] = formats;
  if (!target || !a || !b) return compat;
  let [lo, loF, hi, hiF] = comparePackFormats(a, b) <= 0 ? [compat.minVersion, a, compat.maxVersion, b] : [compat.maxVersion, b, compat.minVersion, a];
  let widened = false;
  if (comparePackFormats(target, loF) < 0) {
    [lo, loF, widened] = [version, target, true];
  }
  if (comparePackFormats(target, hiF) > 0) {
    [hi, hiF, widened] = [version, target, true];
  }
  if (widened) warnings.push(`The version range didn't include Minecraft ${version}, so it was widened to ${lo} – ${hi}.`);
  if (comparePackFormats(loF, hiF) === 0) return undefined;
  return { minVersion: lo, maxVersion: hi };
}

async function buildJavaMcmeta(project: TexturePackProject, assets: AssetIndex, original: Uint8Array | undefined, warnings: string[]): Promise<string> {
  const description = project.description ?? '';
  let text: string;
  const compat = await effectiveCompat(project.version, project.compat, warnings);
  try {
    text = await buildPackMcmetaForVersions(description, project.version, compat);
    await warnIncompatible(text, [project.version, ...(compat ? [compat.minVersion, compat.maxVersion] : [])], warnings);
  } catch (err) {
    // Offline: the loaded game files know their own pack format.
    let local: string | null = null;
    if (assets.version === project.version && assets.hasFile('version.json')) {
      try {
        const f = packFormatFromVersionJson(JSON.parse(await assets.readText('version.json')));
        if (f) local = buildPackMcmeta({ description, target: f });
      } catch {
        local = null;
      }
    }
    if (!local) throw err instanceof Error ? err : new Error(String(err));
    if (project.compat) warnings.push(`The version range couldn't be looked up offline, so the pack only declares Minecraft ${project.version}.`);
    text = local;
  }
  return asciiJson(original ? mergePackMcmeta(text, decodeText(original), warnings) : text);
}

/**
 * Names the chosen versions that won't list the pack as compatible. One zip can't be compatible with
 * both 1.19.4-or-older and 1.21.9+ (the newer games reject multi-version packs below format 15).
 */
async function warnIncompatible(text: string, versions: string[], warnings: string[]): Promise<void> {
  const off: string[] = [];
  for (const v of new Set(versions)) {
    const f = await getJavaPackFormat(v).catch(() => null);
    if (f && describePackForGame(text, f) !== 'compatible') off.push(v);
  }
  if (off.length) {
    warnings.push(
      `Minecraft ${off.join(' and ')} will list this pack as made for another version (it can still be turned on after a warning). ` +
        `Very old and very new versions can't share one pack; export a separate pack for ${off.length === 1 ? 'that version' : 'those versions'} if you need it.`,
    );
  }
}

/** Escapes non-ASCII characters as \uXXXX: games before 1.19.3 don't read pack.mcmeta as UTF-8. */
export function asciiJson(text: string): string {
  return text.replace(/[\u007f-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

/** Keeps the language, filter and overlay sections of an imported pack.mcmeta (rewritten for the target era). */
export function mergePackMcmeta(generated: string, original: string, warnings: string[] = []): string {
  const gen = parseJsonLoose(generated) as Record<string, unknown> | null;
  const orig = parseJsonLoose(original) as Record<string, unknown> | null;
  if (!gen || !orig || typeof orig !== 'object') return generated;
  let changed = false;
  for (const key of ['language', 'filter']) {
    const v = orig[key];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      gen[key] = v;
      changed = true;
    }
  }
  const entries = (orig.overlays as { entries?: unknown } | undefined)?.entries;
  if (Array.isArray(entries) && entries.length) {
    const ov = normalizeOverlays(entries, (gen.pack ?? {}) as Record<string, unknown>, warnings);
    if (ov) {
      gen.overlays = { entries: ov };
      changed = true;
    }
  }
  return changed ? stringifyPretty(gen) : generated;
}

type Fmt = { major: number; minor: number };

function parseFmt(v: unknown): Fmt | null {
  if (typeof v === 'number' && Number.isInteger(v) && v >= 0) return { major: v, minor: 0 };
  if (Array.isArray(v) && v.length >= 1 && typeof v[0] === 'number') return { major: v[0], minor: typeof v[1] === 'number' ? v[1] : 0 };
  return null;
}

function parseInterval(v: unknown): { min: number; max: number } | null {
  if (typeof v === 'number' && Number.isInteger(v)) return { min: v, max: v };
  if (Array.isArray(v) && v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number' && v[0] <= v[1]) return { min: v[0], max: v[1] };
  if (v && typeof v === 'object') {
    const o = v as { min_inclusive?: unknown; max_inclusive?: unknown };
    if (typeof o.min_inclusive === 'number' && typeof o.max_inclusive === 'number' && o.min_inclusive <= o.max_inclusive) return { min: o.min_inclusive, max: o.max_inclusive };
  }
  return null;
}

/** First resource format that reads overlays (23w31a, on the way to 1.20.2). */
const FIRST_OVERLAY_FORMAT = 16;

/** Overlay entries in the exact shape the target era's parser accepts (see pack.mcmeta rules). */
function normalizeOverlays(entries: unknown[], pack: Record<string, unknown>, warnings: string[]): Record<string, unknown>[] | null {
  // Newest format any game in the declared range has: overlays work when that game reads them.
  const sup = parseInterval(pack.supported_formats);
  const newest = Math.max(typeof pack.pack_format === 'number' ? pack.pack_format : 0, sup?.max ?? 0);
  const era = 'min_format' in pack ? 'new' : newest >= FIRST_OVERLAY_FORMAT ? 'mid' : 'old';
  const parsed: { dir: string; min: Fmt; max: number }[] = [];
  for (const e of entries) {
    if (!e || typeof e !== 'object') continue;
    const o = e as Record<string, unknown>;
    if (typeof o.directory !== 'string' || !/^[-_a-zA-Z0-9.]+$/.test(o.directory)) continue;
    const min = parseFmt(o.min_format);
    const max = parseFmt(o.max_format);
    if (min && max) {
      // An inverted range makes 1.21.9+ reject the whole pack.
      if (min.major <= max.major) parsed.push({ dir: o.directory, min, max: max.major });
      continue;
    }
    const r = parseInterval(o.formats);
    if (r) parsed.push({ dir: o.directory, min: { major: r.min, minor: 0 }, max: r.max });
  }
  if (!parsed.length) return null;
  if (era === 'old') {
    warnings.push('Overlay folders only work in Minecraft 1.20.2 and newer, so they are kept as files but not active for this version.');
    return null;
  }
  if (era === 'mid') return parsed.map((p) => ({ directory: p.dir, formats: [p.min.major, p.max] }));
  const anyOld = parsed.some((p) => p.min.major <= 64);
  return parsed.map((p) => ({
    directory: p.dir,
    ...(anyOld ? { formats: [p.min.major, p.max] } : {}),
    min_format: p.min.minor > 0 ? [p.min.major, p.min.minor] : p.min.major,
    max_format: p.max,
  }));
}

/**
 * What to keep from an imported manifest.json header: authors, a newer min_engine_version (the
 * pack's JSON may rely on it) and capabilities other than "pbr" (that one would hide the edits).
 */
function manifestExtras(original: Uint8Array): { authors?: string[]; minEngine?: [number, number, number]; capabilities?: string[] } {
  const m = parseJsonLoose(decodeText(original)) as { header?: { min_engine_version?: unknown }; metadata?: { authors?: unknown }; capabilities?: unknown } | null;
  if (!m || typeof m !== 'object') return {};
  const out: { authors?: string[]; minEngine?: [number, number, number]; capabilities?: string[] } = {};
  const authors = m.metadata?.authors;
  if (Array.isArray(authors)) out.authors = authors.filter((a): a is string => typeof a === 'string');
  const engine = parseBedrockVersion(m.header?.min_engine_version);
  if (engine && (engine[0] - DEFAULT_MIN_ENGINE[0] || engine[1] - DEFAULT_MIN_ENGINE[1] || engine[2] - DEFAULT_MIN_ENGINE[2]) > 0) out.minEngine = engine;
  if (Array.isArray(m.capabilities)) {
    const caps = m.capabilities.filter((c): c is string => typeof c === 'string' && c.trim() !== '' && c.trim() !== 'pbr');
    if (caps.length) out.capabilities = caps;
  }
  return out;
}

/** Carries sub-packs and dependencies over from an imported manifest.json. */
export function mergeManifest(generated: string, original: Uint8Array | undefined): string {
  if (!original) return generated;
  const gen = parseJsonLoose(generated) as Record<string, unknown> | null;
  const orig = parseJsonLoose(decodeText(original)) as Record<string, unknown> | null;
  if (!gen || !orig) return generated;
  let changed = false;
  if (Array.isArray(orig.subpacks)) {
    const subs = orig.subpacks
      .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object' && typeof (s as Record<string, unknown>).folder_name === 'string')
      .map((s) => ({
        folder_name: s.folder_name as string,
        name: typeof s.name === 'string' ? s.name : (s.folder_name as string),
        memory_tier: typeof s.memory_tier === 'number' ? s.memory_tier : typeof s.memory_performance_tier === 'number' ? s.memory_performance_tier : 0,
      }));
    if (subs.length) {
      gen.subpacks = subs;
      changed = true;
    }
  }
  if (Array.isArray(orig.dependencies)) {
    const header = (gen.header as { uuid?: string } | undefined)?.uuid;
    const deps = orig.dependencies
      .filter((d): d is Record<string, unknown> => !!d && typeof d === 'object' && isUuid((d as Record<string, unknown>).uuid) && (d as Record<string, unknown>).uuid !== header)
      .map((d) => ({ uuid: d.uuid as string, version: parseBedrockVersion(d.version) ?? [1, 0, 0] }));
    if (deps.length) {
      gen.dependencies = deps;
      changed = true;
    }
  }
  return changed ? stringifyPretty(gen) : generated;
}

function validUuids(u: { header: string; module: string } | undefined): boolean {
  return !!u && isUuid(u.header) && isUuid(u.module) && u.header.toLowerCase() !== u.module.toLowerCase();
}

// ---------------------------------------------------------------------------------------------
// Texture metadata

function parseAnimation(text: string | undefined): AnimationInfo | null {
  if (!text) return null;
  const json = parseJsonLoose(text) as { animation?: unknown } | null;
  const a = json?.animation;
  if (!a || typeof a !== 'object') return null;
  const o = a as Record<string, unknown>;
  const pos = (v: unknown) => (typeof v === 'number' && v > 0 ? Math.floor(v) : undefined);
  return { width: pos(o.width), height: pos(o.height) };
}

/** Frame size exactly as Java computes it (explicit width/height, else a square of the short side). */
function frameSize(anim: AnimationInfo, dims: Dims, scale: number): { fw: number; fh: number } {
  const fw = anim.width ? Math.max(1, Math.round(anim.width * scale)) : undefined;
  const fh = anim.height ? Math.max(1, Math.round(anim.height * scale)) : undefined;
  if (fw && fh) return { fw, fh };
  if (fw) return { fw, fh: dims.h };
  if (fh) return { fw: dims.w, fh };
  const m = Math.min(dims.w, dims.h);
  return { fw: m, fh: m };
}

function setFrames(ctx: EffectContext, anim: AnimationInfo | null, dims: Dims, scale: number): void {
  if (!anim) return;
  const { fw, fh } = frameSize(anim, dims, Number.isFinite(scale) && scale > 0 ? scale : 1);
  if (dims.w % fw === 0 && dims.h % fh === 0) {
    ctx.frameWidth = fw;
    ctx.frameHeight = fh;
  }
}

/**
 * Rewrites an animation .mcmeta for a texture of size `dims` whose frame values must be scaled by
 * `scale`. Returns null when the original text is still correct.
 */
export function adjustMcmeta(text: string, anim: AnimationInfo | null, dims: Dims, scale: number): string | null {
  if (!anim) return null;
  const json = parseJsonLoose(text) as Record<string, unknown> | null;
  const a = json?.animation as Record<string, unknown> | undefined;
  if (!json || !a || typeof a !== 'object') return null;
  let changed = false;
  if (Number.isFinite(scale) && scale > 0 && Math.abs(scale - 1) > 1e-9) {
    for (const k of ['width', 'height']) {
      if (typeof a[k] === 'number') {
        const v = Math.max(1, Math.round((a[k] as number) * scale));
        if (v !== a[k]) {
          a[k] = v;
          changed = true;
        }
      }
    }
  }
  const posInt = (v: unknown) => (typeof v === 'number' && v > 0 ? Math.floor(v) : undefined);
  let { fw, fh } = frameSize({ width: posInt(a.width), height: posInt(a.height) }, dims, 1);
  if (dims.w % fw !== 0 || dims.h % fh !== 0) {
    delete a.width;
    delete a.height;
    changed = true;
    fw = fh = Math.min(dims.w, dims.h);
  }
  const count = Math.floor(dims.w / fw) * Math.floor(dims.h / fh);
  if (Array.isArray(a.frames)) {
    const index = (f: unknown) => (typeof f === 'number' ? f : f && typeof f === 'object' ? Number((f as { index?: unknown }).index) : NaN);
    const kept = a.frames.filter((f) => {
      const i = index(f);
      return Number.isInteger(i) && i >= 0 && i < count;
    });
    if (kept.length !== a.frames.length) {
      if (kept.length) a.frames = kept;
      else delete a.frames;
      changed = true;
    }
  }
  return changed ? stringifyPretty(json) : null;
}

function isNineSliceCandidate(path: string): boolean {
  return /^textures\/(ui|gui)\//.test(path);
}

/** Scales Bedrock UI nine-slice values for a texture resized by `scale`. */
export function scaleNineSlice(text: string, scale: number): string | null {
  const json = parseJsonLoose(text) as Record<string, unknown> | null;
  if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
  const sc = (v: unknown) => (typeof v === 'number' ? Math.max(0, Math.round(v * scale)) : v);
  let changed = false;
  if (typeof json.nineslice_size === 'number' || Array.isArray(json.nineslice_size)) {
    json.nineslice_size = Array.isArray(json.nineslice_size) ? json.nineslice_size.map(sc) : sc(json.nineslice_size);
    changed = true;
  }
  if (Array.isArray(json.base_size)) {
    json.base_size = json.base_size.map(sc);
    changed = true;
  }
  return changed ? stringifyPretty(json) : null;
}

// ---------------------------------------------------------------------------------------------
// Pack icon

const ICON_SOURCES: Record<Edition, { top: string[]; side: string[]; fallback: string[]; grassMap: string }> = {
  java: {
    top: ['assets/minecraft/textures/block/grass_block_top.png', 'assets/minecraft/textures/blocks/grass_top.png'],
    side: ['assets/minecraft/textures/block/grass_block_side.png', 'assets/minecraft/textures/blocks/grass_side.png'],
    fallback: ['assets/minecraft/textures/block/stone.png', 'assets/minecraft/textures/blocks/stone.png'],
    grassMap: 'assets/minecraft/textures/colormap/grass.png',
  },
  bedrock: {
    top: ['textures/blocks/grass_carried.png', 'textures/blocks/grass_top.png'],
    side: ['textures/blocks/grass_side_carried.png', 'textures/blocks/grass_side.tga'],
    fallback: ['textures/blocks/stone.png'],
    grassMap: 'textures/colormap/grass.png',
  },
};

async function buildIcon(project: TexturePackProject, assets: AssetIndex, layers: EffectLayer[], overrides: Map<string, Blob>, size: number, warnings: string[]): Promise<Uint8Array> {
  if (project.icon) {
    try {
      const bytes = new Uint8Array(await project.icon.arrayBuffer());
      const img = await decodeImage(bytes);
      if (isPng(bytes) && img.width === img.height && img.width >= 16 && img.width <= 1024) return bytes;
      return encodePng(fitToSize(img, size, size, img.width > size || img.height > size ? 'smooth' : 'nearest', 'contain'));
    } catch {
      warnings.push("The pack icon couldn't be read, so a generated icon was used instead.");
    }
  }
  try {
    return encodePng(await generateIcon(project.edition, assets, layers, overrides, size));
  } catch {
    return encodePng(renderIsoCube(proceduralTexture('top'), proceduralTexture('side'), size));
  }
}

/** An isometric grass block (or stone) drawn from the pack's own textures, effects included. */
async function generateIcon(edition: Edition, assets: AssetIndex, layers: EffectLayer[], overrides: Map<string, Blob>, size: number): Promise<ImageData> {
  const src = ICON_SOURCES[edition];
  const load = async (paths: string[]): Promise<{ img: ImageData; gray: boolean } | null> => {
    // Known files first; the rest are still tried because a catalogue rebuilt from atlas files can miss some.
    const known = (p: string) => overrides.has(p) || assets.hasFile(p);
    for (const path of [...paths.filter(known), ...paths.filter((p) => !known(p))]) {
      try {
        const ov = overrides.get(path);
        const img = ov ? await decodeImage(ov, extOf(path)) : await assets.readImage(path);
        // Grayscale art is tinted by the biome colour in game; decide before effects recolour it.
        const gray = isGrayscale(img);
        const shown = applyEffects(img, layers, { path, category: 'block', animated: img.height > img.width });
        return { img: firstFrameOpaque(shown, extOf(path) === 'tga'), gray };
      } catch {
        // try the next candidate
      }
    }
    return null;
  };
  const top = await load(src.top);
  const side = await load(src.side);
  if (top && side) {
    const grass = applyEffects(createImageData(1, 1, new Uint8ClampedArray([124, 189, 107, 255])), layers, { path: src.grassMap, category: 'colormap' }).data;
    return renderIsoCube(top.gray ? multiply(top.img, [grass[0], grass[1], grass[2]]) : top.img, side.img, size);
  }
  const stone = await load(src.fallback);
  if (stone) return renderIsoCube(stone.img, stone.img, size);
  return renderIsoCube(proceduralTexture('top'), proceduralTexture('side'), size);
}

function firstFrameOpaque(img: ImageData, forceOpaque: boolean): ImageData {
  const w = img.width;
  const h = Math.min(img.height, img.width);
  const out = createImageData(w, h, new Uint8ClampedArray(img.data.subarray(0, w * h * 4)));
  if (forceOpaque) for (let i = 3; i < out.data.length; i += 4) out.data[i] = 255;
  return out;
}

function isGrayscale(img: ImageData): boolean {
  const d = img.data;
  let sat = 0;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    const max = Math.max(d[i], d[i + 1], d[i + 2]);
    const min = Math.min(d[i], d[i + 1], d[i + 2]);
    sat += max ? (max - min) / max : 0;
    n++;
  }
  return n > 0 && sat / n <= 0.12;
}

function multiply(img: ImageData, tint: [number, number, number]): ImageData {
  const out = createImageData(img.width, img.height, new Uint8ClampedArray(img.data));
  for (let i = 0; i < out.data.length; i += 4) {
    out.data[i] = (out.data[i] * tint[0]) / 255;
    out.data[i + 1] = (out.data[i + 1] * tint[1]) / 255;
    out.data[i + 2] = (out.data[i + 2] * tint[2]) / 255;
  }
  return out;
}

/** Nearest-sampled isometric cube: top face full light, left 80%, right 62%. */
export function renderIsoCube(top: ImageData, side: ImageData, size: number): ImageData {
  const out = createImageData(size, size);
  const d = out.data;
  const margin = Math.max(1, Math.round(size * 0.04));
  const hw = (size - 2 * margin) / (2 * 1.1547); // half width; total height = 2.3094 * hw
  const hh = hw * 0.57735;
  const v = hw * 1.1547;
  const cx = size / 2;
  const y0 = (size - (2 * hh + v)) / 2;
  const sample = (img: ImageData, s: number, t: number, shade: number, o: number) => {
    const x = Math.min(img.width - 1, Math.max(0, Math.floor(s * img.width)));
    const y = Math.min(img.height - 1, Math.max(0, Math.floor(t * img.height)));
    const i = (y * img.width + x) * 4;
    const a = img.data[i + 3];
    if (!a) return;
    d[o] = img.data[i] * shade;
    d[o + 1] = img.data[i + 1] * shade;
    d[o + 2] = img.data[i + 2] * shade;
    d[o + 3] = a;
  };
  const inside = (x: number) => x >= 0 && x < 1;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = px + 0.5;
      const y = py + 0.5;
      const o = (py * size + px) * 4;
      // top face: T0 (cx, y0) + u*(hw, hh) + w*(-hw, hh)
      const dx = x - cx;
      const dy = y - y0;
      const u = (dx / hw + dy / hh) / 2;
      const w = (dy / hh - dx / hw) / 2;
      if (inside(u) && inside(w)) {
        sample(top, u, w, 1, o);
        continue;
      }
      const ly = y - (y0 + hh);
      if (x < cx) {
        // left face from (cx - hw, y0 + hh) towards (cx, y0 + 2hh), down by v
        const s = (x - (cx - hw)) / hw;
        const t = (ly - s * hh) / v;
        if (inside(s) && inside(t)) sample(side, s, t, 0.8, o);
      } else {
        // right face from (cx, y0 + 2hh) towards (cx + hw, y0 + hh), down by v
        const s = (x - cx) / hw;
        const t = (ly - hh + s * hh) / v;
        if (inside(s) && inside(t)) sample(side, s, t, 0.62, o);
      }
    }
  }
  return out;
}

/** Original 16x16 grass art for when no game textures are available. */
function proceduralTexture(face: 'top' | 'side'): ImageData {
  const img = createImageData(16, 16);
  const d = img.data;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const n = ((Math.imul(x * 374761393 + y * 668265263, 1274126177) >>> 0) % 1000) / 1000;
      const o = (y * 16 + x) * 4;
      const fringe = face === 'side' && y < 3 + ((x * 7) % 3 === 0 ? 1 : 0);
      const [r, g, b] = face === 'top' || fringe ? [92, 158, 58] : [134, 96, 67];
      const k = 0.82 + n * 0.3;
      d[o] = r * k;
      d[o + 1] = g * k;
      d[o + 2] = b * k;
      d[o + 3] = 255;
    }
  }
  return img;
}

// ---------------------------------------------------------------------------------------------
// Helpers

async function collectExtraFiles(project: TexturePackProject, warnings: string[]): Promise<Map<string, Uint8Array>> {
  const out = new Map<string, Uint8Array>();
  const lost: string[] = [];
  for (const [raw, blob] of Object.entries(project.extraFiles ?? {})) {
    const path = normalizeZipPath(raw);
    if (!path || !blob) continue;
    try {
      out.set(path, new Uint8Array(await blob.arrayBuffer()));
    } catch {
      lost.push(path);
    }
  }
  if (lost.length) warnings.push(`${plural(lost.length, 'file')} from the opened pack couldn't be read from this browser's storage and ${lost.length === 1 ? 'was' : 'were'} left out: ${sample(lost)}.`);
  return out;
}

const IMAGE_PATH = /\.(png|tga|jpe?g)$/i;

/** Path without its file extension. */
function stemOf(path: string): string {
  const dot = path.lastIndexOf('.');
  return dot > path.lastIndexOf('/') ? path.slice(0, dot) : path;
}

function encodeFor(ext: string, img: ImageData): Uint8Array {
  return ext === 'tga' ? encodeTga(img) : encodePng(img);
}

function sameImage(a: ImageData, b: ImageData): boolean {
  if (a.width !== b.width || a.height !== b.height) return false;
  const x = a.data;
  const y = b.data;
  if (x.length !== y.length) return false;
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
}

const utf8 = new TextDecoder('utf-8');
function decodeText(bytes: Uint8Array): string {
  const t = utf8.decode(bytes);
  return t.charCodeAt(0) === 0xfeff ? t.slice(1) : t;
}
function encodeText(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function check(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

function editionName(e: Edition): string {
  return e === 'java' ? 'Java Edition' : 'Bedrock Edition';
}

function plural(n: number, word: string): string {
  return `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;
}

function sample(paths: string[]): string {
  const names = paths.slice(0, 3).map((p) => p.split('/').pop());
  return names.join(', ') + (paths.length > 3 ? ` and ${paths.length - 3} more` : '');
}

function progressReporter(fn?: ProgressFn): (label: string, fraction: number | null) => void {
  let last = 0;
  let lastPhase = '';
  return (label, fraction) => {
    if (!fn) return;
    const now = Date.now();
    const phase = label.split('…')[0];
    if (phase === lastPhase && fraction !== 1 && now - last < 40) return;
    last = now;
    lastPhase = phase;
    try {
      fn({ label, fraction });
    } catch {
      // a broken progress UI must not break the export
    }
  };
}

function yieldToEventLoop(): Promise<void> {
  const sched = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (sched?.yield) return sched.yield();
  if (typeof MessageChannel !== 'undefined') {
    return new Promise((resolve) => {
      const ch = new MessageChannel();
      ch.port1.onmessage = () => {
        ch.port1.close();
        resolve();
      };
      ch.port2.postMessage(null);
    });
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Yields to the event loop at most every ~12 ms of work, keeping the page responsive. */
function timeSlicer(): () => Promise<void> {
  let last = Date.now();
  return async () => {
    if (Date.now() - last < 12) return;
    await yieldToEventLoop();
    last = Date.now();
  };
}

/** Runs fn over items with limited concurrency; stops scheduling new work after the first error. */
async function runPool<T>(items: T[], concurrency: number, signal: AbortSignal | undefined, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  let failed = false;
  const worker = async () => {
    while (!failed && next < items.length) {
      if (signal?.aborted) {
        failed = true;
        throw abortError();
      }
      const item = items[next++];
      try {
        await fn(item);
      } catch (err) {
        failed = true;
        throw err;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
}
