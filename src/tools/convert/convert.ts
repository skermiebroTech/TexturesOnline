// Texture pack converter engine: Java -> Bedrock, Bedrock -> Java and Java version -> Java version.
// Takes an opened pack (see ../textures/import.ts) and returns a new texture project for the target,
// which the texture tool saves, edits and exports like any other. No DOM.

import type { AssetIndex, Edition, ProgressFn, TexturePackProject } from '../../core/types';
import { createImageData, cropImageData, decodeImage, encodePng, encodeTga } from '../../core/image';
import { abortError, isAbortError } from '../../core/net';
import { stringifyPretty } from '../../editions/java/packmeta';
import { BEDROCK_TEXTURE_ROOT, JAVA_TEXTURE_ROOT, extOf, imageDims, newTextureProject, parseJsonLoose } from '../textures/project';
import { flipbookEntries, flipbookToJava, javaFrameSize, javaToFlipbook, parseJavaAnimation, terrainTiles, type FlipbookEntry, type JavaAnimation } from './anim';
import { buildPairIndex, compareJavaVersions, pairKey, renameChain, rewriteModelTextures, type JavaBedrockMap, type JavaRenames, type PairIndex, type RenameChain } from './paths';

export interface ConvertTarget {
  edition: Edition;
  /** Java version id, or the Bedrock version id ('latest') */
  version: string;
}

export interface ConvertMaps {
  javaBedrock?: JavaBedrockMap | null;
  renames?: JavaRenames | null;
}

export type SkipReason = 'no-counterpart' | 'layout' | 'removed' | 'missing' | 'duplicate' | 'unreadable';

export interface SkippedTexture {
  /** Path in the source pack */
  source: string;
  reason: SkipReason;
  /** Sentence for the user, e.g. "Bedrock has no matching texture" */
  detail: string;
  /** Where it would have gone, when known */
  target?: string;
}

export interface ConvertedTexture {
  source: string;
  /** Paths in the new pack (several when one texture became several) */
  targets: string[];
  /** Short notes, e.g. "first frame only" */
  notes: string[];
}

export interface DroppedFile {
  source: string;
  /** What it is: 'Model', 'Sound', 'Font', ... */
  kind: string;
}

export interface ConvertReport {
  from: { edition: Edition; version: string };
  to: ConvertTarget;
  /** Textures in the source pack */
  total: number;
  converted: ConvertedTexture[];
  /** Java -> Java only: textures the target version doesn't use, kept for the pack's own models */
  kept: ConvertedTexture[];
  skipped: SkippedTexture[];
  /** Non-texture files that were left out (cross-edition) */
  dropped: DroppedFile[];
  /** Non-texture files carried over (Java -> Java) */
  carried: number;
  /** Things worth knowing about the result */
  notes: string[];
}

export interface ConvertResult {
  project: TexturePackProject;
  report: ConvertReport;
}

export interface ConvertOptions {
  onProgress?: ProgressFn;
  signal?: AbortSignal;
  /** Allow a Java pack to be "converted" to its own version (loose PNG sources: just packaging) */
  allowSameVersion?: boolean;
}

const CONCURRENCY = 8;
const FLIPBOOK = 'textures/flipbook_textures.json';
const TERRAIN = 'textures/terrain_texture.json';

/** "Bedrock" / "Java 26.3" for names and messages. */
export function targetLabel(t: { edition: Edition; version: string }): string {
  return t.edition === 'bedrock' ? 'Bedrock' : `Java ${t.version}`;
}

/** Whether converting `source` to `target` does anything. */
export function isSameTarget(source: { edition: Edition; version: string }, target: ConvertTarget): boolean {
  if (source.edition !== target.edition) return false;
  return source.edition === 'bedrock' || compareJavaVersions(source.version, target.version) === 0;
}

/** The converted pack's name: "My Pack (Bedrock)", with an older "(…)" suffix replaced. */
export function convertedName(name: string, target: ConvertTarget): string {
  const base = (name || 'Texture pack').replace(/\s*\((?:Bedrock|Java [^)]*)\)\s*$/, '').trim() || 'Texture pack';
  return `${base} (${targetLabel(target)})`;
}

type Dims = { w: number; h: number };

interface Plan {
  source: string;
  /** Target texture paths with the extension */
  targets: { path: string; layoutDiffers?: boolean; inCatalogue: boolean }[];
  renamed: boolean;
}

/**
 * Converts an opened pack for another edition or Java version. `assets` is the target's vanilla
 * texture catalogue (it decides file extensions and validates every path). The result is a new,
 * unsaved project plus a report of what happened to every texture.
 */
export async function convertPack(source: TexturePackProject, target: ConvertTarget, assets: AssetIndex, maps: ConvertMaps, opts: ConvertOptions = {}): Promise<ConvertResult> {
  const { signal } = opts;
  const progress = (label: string, fraction: number | null) => {
    try {
      opts.onProgress?.({ label, fraction });
    } catch {
      /* a broken progress UI must not break the conversion */
    }
  };
  check(signal);
  if (assets.edition !== target.edition) throw new Error(`The loaded game files are for ${target.edition === 'java' ? 'Bedrock' : 'Java'}, not ${targetLabel(target)}.`);
  if (isSameTarget(source, target) && !(opts.allowSameVersion && source.edition === 'java')) throw new Error(`This pack is already for ${targetLabel(target)}. Pick another edition or version.`);
  const kind: 'j2b' | 'b2j' | 'j2j' = source.edition === 'java' ? (target.edition === 'bedrock' ? 'j2b' : 'j2j') : 'b2j';
  if (kind !== 'j2j' && !maps.javaBedrock) throw new Error('The Java/Bedrock texture list is missing, so the pack can’t be converted.');

  const project = newTextureProject({ name: convertedName(source.name, target), edition: target.edition, version: target.version, resolution: source.resolution });
  project.description = source.description ?? '';
  if (source.icon) project.icon = source.icon;
  if (kind === 'j2j') project.effects = (source.effects ?? []).map((l) => ({ ...l, params: { ...l.params }, ...(l.categories ? { categories: [...l.categories] } : {}) }));

  const report: ConvertReport = {
    from: { edition: source.edition, version: source.version },
    to: { ...target },
    total: 0,
    converted: [],
    kept: [],
    skipped: [],
    dropped: [],
    carried: 0,
    notes: [],
  };
  progress('Matching texture names…', 0);

  // ---- path mapping ----
  const pairs = maps.javaBedrock ? buildPairIndex(maps.javaBedrock) : null;
  const sourceRoot = source.edition === 'java' ? JAVA_TEXTURE_ROOT : BEDROCK_TEXTURE_ROOT;
  const javaChain: RenameChain | null =
    kind === 'j2j' ? renameChain(maps.renames, source.version, target.version)
    : kind === 'j2b' ? renameChain(maps.renames, source.version, pairs!.javaVersion)
    : renameChain(maps.renames, pairs!.javaVersion, target.version);
  const knownVanilla = kind === 'j2j' ? vanillaNameSet(maps, pairs) : null;

  const sources = Object.keys(source.overrides ?? {}).filter((p) => !!source.overrides[p]);
  report.total = sources.length;
  const plans: Plan[] = [];
  for (const path of sources) {
    const plan = planTexture(path);
    if (plan) plans.push(plan);
  }

  // A texture already at its target name wins over one renamed onto it; Bedrock prefers .tga.
  plans.sort((a, b) => Number(a.renamed) - Number(b.renamed) || (extOf(b.source) === 'tga' ? 1 : 0) - (extOf(a.source) === 'tga' ? 1 : 0) || a.source.localeCompare(b.source));
  const taken = new Map<string, string>();
  for (const plan of plans) {
    const free = plan.targets.filter((t) => !taken.has(t.path));
    if (!free.length) {
      const first = plan.targets[0];
      report.skipped.push({ source: plan.source, reason: 'duplicate', target: first?.path, detail: `${baseName(taken.get(first.path) ?? '')} already fills ${baseName(first.path)}` });
      plan.targets = [];
      continue;
    }
    plan.targets = free;
    for (const t of free) taken.set(t.path, plan.source);
  }
  const work = plans.filter((p) => p.targets.length);

  // ---- vanilla metadata of the target ----
  const vanillaFlip = target.edition === 'bedrock' ? await readJson(assets, FLIPBOOK).then(flipbookEntries) : new Map<string, FlipbookEntry>();
  const tiles = target.edition === 'bedrock' ? await readJson(assets, TERRAIN).then(terrainTiles) : new Map<string, { tile: string; index?: number }>();
  const ownFlip = source.edition === 'bedrock' && source.extraFiles[FLIPBOOK] ? flipbookEntries(parseJsonLoose(await blobText(source.extraFiles[FLIPBOOK]))) : new Map<string, FlipbookEntry>();
  check(signal);

  // ---- textures ----
  const flipOut = new Map<string, FlipbookEntry>();
  let done = 0;
  let readFailures = 0;
  let tgaToPng = 0;
  const results = new Map<string, ConvertedTexture>();
  const keptPaths = new Set<string>();
  await runPool(work, CONCURRENCY, signal, async (plan) => {
    const item = await convertTexture(plan);
    if (item) results.set(plan.source, item);
    done++;
    progress(`Converting textures… ${done.toLocaleString('en-US')} / ${work.length.toLocaleString('en-US')}`, 0.05 + 0.9 * (done / Math.max(1, work.length)));
  });
  check(signal);
  for (const plan of work) {
    const r = results.get(plan.source);
    if (!r) continue;
    if (keptPaths.has(plan.source)) report.kept.push(r);
    else report.converted.push(r);
  }
  const bySource = (a: { source: string }, b: { source: string }) => a.source.localeCompare(b.source);
  report.converted.sort(bySource);
  report.kept.sort(bySource);
  report.skipped.sort(bySource);
  if (readFailures) {
    report.notes.push(`${plural(readFailures, 'vanilla texture')} couldn't be loaded, so ${readFailures === 1 ? 'its size wasn’t' : 'their sizes weren’t'} checked.`);
  }
  if (flipOut.size) project.extraFiles[FLIPBOOK] = jsonBlob([...flipOut.values()].sort((a, b) => a.flipbook_texture.localeCompare(b.flipbook_texture)));

  // ---- other files ----
  progress('Carrying over pack files…', 0.96);
  await convertExtraFiles();
  report.dropped.sort(bySource);

  // ---- notes ----
  if (tgaToPng) report.notes.push(`${plural(tgaToPng, 'TGA image')} ${tgaToPng === 1 ? 'was' : 'were'} saved as PNG, the format Java uses.`);
  if (source.compat && kind === 'j2j') report.notes.push(`The pack's version range (${source.compat.minVersion} – ${source.compat.maxVersion}) was replaced by Java ${target.version} only. You can set a range again in the Pack settings.`);
  if (report.kept.length) {
    report.notes.push(`${plural(report.kept.length, 'texture')} ${report.kept.length === 1 ? "isn't" : "aren't"} part of vanilla Java ${target.version}. ${report.kept.length === 1 ? 'It was' : 'They were'} kept in case the pack's own models use ${report.kept.length === 1 ? 'it' : 'them'}.`);
  }
  progress('Done', 1);
  return { project, report };

  // ------------------------------------------------------------------------------------------

  function planTexture(path: string): Plan | null {
    if (!path.startsWith(sourceRoot)) {
      report.skipped.push({ source: path, reason: 'no-counterpart', detail: 'Not in the textures folder' });
      return null;
    }
    const ext = extOf(path);
    const rel = path.slice(sourceRoot.length, ext ? -(ext.length + 1) : undefined);
    const skip = (reason: SkipReason, detail: string) => {
      report.skipped.push({ source: path, reason, detail });
      return null;
    };
    if (kind === 'j2j') {
      const r = javaChain!.map(rel);
      if (r.kind === 'removed') return skip('removed', `Removed in Java ${r.version}`);
      return {
        source: path,
        renamed: r.renamed,
        targets: r.paths.map((p) => {
          const full = `${JAVA_TEXTURE_ROOT}${p}.png`;
          return { path: full, inCatalogue: assets.hasFile(full) };
        }),
      };
    }
    if (kind === 'j2b') {
      const r = javaChain!.map(rel);
      if (r.kind === 'removed') return skip('removed', `Removed in Java ${r.version}`);
      const stems: { stem: string; java: string }[] = [];
      for (const j of r.paths) for (const b of pairs!.toBedrock.get(j) ?? []) if (!stems.some((s) => s.stem === b)) stems.push({ stem: b, java: j });
      if (!stems.length) return skip('no-counterpart', 'Bedrock has no matching texture');
      const targets: Plan['targets'] = [];
      for (const { stem, java } of stems) {
        const full = bedrockPath(stem);
        if (full) targets.push({ path: full, inCatalogue: true, layoutDiffers: pairs!.layoutDiffers.has(pairKey(java, stem)) });
      }
      if (!targets.length) return skip('no-counterpart', 'Not in this Bedrock version');
      return finishCross(path, targets);
    }
    // b2j
    const javaRels = pairs!.toJava.get(rel) ?? [];
    if (!javaRels.length) return skip('no-counterpart', 'Java has no matching texture');
    const targets: Plan['targets'] = [];
    let removedIn: string | null = null;
    for (const j of javaRels) {
      const r = javaChain!.map(j);
      if (r.kind === 'removed') {
        removedIn ??= r.version;
        continue;
      }
      for (const p of r.paths) {
        const full = `${JAVA_TEXTURE_ROOT}${p}.png`;
        if (targets.some((t) => t.path === full)) continue;
        if (!assets.hasFile(full)) continue;
        targets.push({ path: full, inCatalogue: true, layoutDiffers: pairs!.layoutDiffers.has(pairKey(j, rel)) });
      }
    }
    if (!targets.length) {
      if (removedIn) return skip('removed', `Not in Java ${target.version}`);
      return skip('missing', `Not in Java ${target.version}`);
    }
    return finishCross(path, targets);
  }

  function finishCross(path: string, targets: Plan['targets']): Plan | null {
    const ok = targets.filter((t) => !t.layoutDiffers);
    if (!ok.length) {
      report.skipped.push({ source: path, reason: 'layout', target: targets[0].path, detail: `Laid out differently in ${target.edition === 'bedrock' ? 'Bedrock' : 'Java'}` });
      return null;
    }
    return { source: path, targets: ok, renamed: true };
  }

  function bedrockPath(stem: string): string | null {
    const tga = `${BEDROCK_TEXTURE_ROOT}${stem}.tga`;
    const png = `${BEDROCK_TEXTURE_ROOT}${stem}.png`;
    if (assets.hasFile(tga)) return tga;
    if (assets.hasFile(png)) return png;
    return null;
  }

  async function convertTexture(plan: Plan): Promise<ConvertedTexture | null> {
    const srcExt = extOf(plan.source);
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await source.overrides[plan.source].arrayBuffer());
    } catch {
      report.skipped.push({ source: plan.source, reason: 'unreadable', detail: "Couldn't be read from this browser's storage" });
      return null;
    }
    const dims = imageDims(bytes, srcExt);
    if (!dims) {
      report.skipped.push({ source: plan.source, reason: 'unreadable', detail: 'Not a readable image' });
      return null;
    }
    // Source animation
    let javaAnim: JavaAnimation | null = null;
    let flip: FlipbookEntry | null = null;
    let mcmetaText: string | null = null;
    if (source.edition === 'java') {
      const meta = source.extraFiles[`${plan.source}.mcmeta`];
      if (meta) {
        mcmetaText = await blobText(meta).catch(() => null);
        javaAnim = mcmetaText ? parseJavaAnimation(parseJsonLoose(mcmetaText)) : null;
      }
    } else {
      flip = ownFlip.get(plan.source.replace(/\.(png|tga)$/i, '')) ?? null;
    }
    const ownFrame: Dims | null = javaAnim ? toDims(javaFrameSize(javaAnim, dims.w, dims.h)) : flip ? { w: dims.w, h: dims.w } : null;
    const implicitStrip = !ownFrame && isStrip(dims);

    const item: ConvertedTexture = { source: plan.source, targets: [], notes: [] };
    let decoded: ImageData | null = null;
    const image = async () => (decoded ??= await decodeImage(bytes, srcExt));
    let kept = false;

    for (const t of plan.targets) {
      check(signal);
      const tgtExt = extOf(t.path);
      // Vanilla shape of the target
      let tdims: Dims | null = null;
      let tFrame: Dims | null = null;
      const tStem = t.path.replace(/\.(png|tga)$/i, '');
      if (t.inCatalogue && assets.hasFile(t.path)) {
        try {
          tdims = imageDims(await assets.readFile(t.path), tgtExt);
        } catch (err) {
          if (isAbortError(err)) throw err;
          readFailures++;
        }
      }
      if (tdims) {
        if (target.edition === 'java') {
          const vm = assets.hasFile(`${t.path}.mcmeta`) ? await readJson(assets, `${t.path}.mcmeta`) : null;
          const va = vm ? parseJavaAnimation(vm) : null;
          if (va) tFrame = toDims(javaFrameSize(va, tdims.w, tdims.h));
        } else if (vanillaFlip.has(tStem)) tFrame = { w: tdims.w, h: tdims.w };
        if (!tFrame && isStrip(tdims)) tFrame = { w: tdims.w, h: tdims.w };
      }

      // Layout check: the whole image, or one animation frame, must have the target's proportions.
      let matched: 'plain' | 'frames' | 'unknown' = 'unknown';
      if (tdims) {
        if (sameAspect(dims, tdims)) matched = 'plain';
        else if (sameAspect(ownFrame ?? (implicitStrip ? { w: dims.w, h: dims.w } : dims), tFrame ?? tdims)) matched = 'frames';
        else {
          continue;
        }
      }

      let out: Uint8Array = bytes;
      let outDims = dims;
      const notes: string[] = [];
      const firstFrame = async (frame: Dims, index: number, why: string) => {
        const img = await image();
        const cols = Math.max(1, Math.floor(dims.w / frame.w));
        const x = (index % cols) * frame.w;
        const y = Math.floor(index / cols) * frame.h;
        const crop = x + frame.w <= dims.w && y + frame.h <= dims.h ? cropImageData(img, x, y, frame.w, frame.h) : cropImageData(img, 0, 0, frame.w, frame.h);
        out = encode(crop, tgtExt);
        outDims = frame;
        notes.push(why);
      };

      if (kind === 'j2j') {
        if (mcmetaText !== null) project.extraFiles[`${t.path}.mcmeta`] = textBlob(mcmetaText, 'application/json');
      } else if (kind === 'j2b') {
        const tile = vanillaFlip.get(tStem) ?? null;
        const terrain = tiles.get(tStem) ?? null;
        if (javaAnim && ownFrame) {
          const count = Math.floor(dims.w / ownFrame.w) * Math.floor(dims.h / ownFrame.h);
          if ((tile || terrain) && ownFrame.w === ownFrame.h && count > 1) {
            if (ownFrame.w !== dims.w) {
              out = encode(await restack(await image(), ownFrame, count), tgtExt);
              outDims = { w: ownFrame.w, h: ownFrame.h * count };
            } else if (tgtExt !== srcExt) out = encode(await image(), tgtExt);
            const extra: Partial<FlipbookEntry> = {};
            if (tile) for (const k of ['atlas_index', 'atlas_tile_variant', 'replicate'] as const) if (tile[k] !== undefined) extra[k] = tile[k] as number;
            if (!tile && terrain?.index !== undefined) extra.atlas_index = terrain.index;
            flipOut.set(tStem, javaToFlipbook(javaAnim, count, { stem: tStem, atlasTile: tile?.atlas_tile ?? terrain!.tile, extra }));
            notes.push('animation converted');
          } else if (count > 1) {
            await firstFrame(ownFrame, javaAnim.frames?.[0]?.index ?? 0, 'first frame only: Bedrock can’t animate this texture');
          } else if (tgtExt !== srcExt) out = encode(await image(), tgtExt);
        } else if (implicitStrip && matched === 'frames' && !tile) {
          await firstFrame({ w: dims.w, h: dims.w }, 0, 'first frame only: its animation needs a .mcmeta file');
        } else if (tgtExt !== srcExt) out = encode(await image(), tgtExt);
        // A vanilla flipbook must not point at frames the new image doesn't have.
        if (tile && !flipOut.has(tStem) && Array.isArray(tile.frames)) {
          const count = Math.max(1, Math.floor(outDims.h / outDims.w));
          if (tile.frames.some((f) => typeof f === 'number' && f >= count)) {
            const copy: FlipbookEntry = { ...tile, flipbook_texture: tStem };
            const frames = tile.frames.filter((f) => typeof f === 'number' && f < count);
            if (frames.length > 1) copy.frames = frames;
            else delete copy.frames;
            flipOut.set(tStem, copy);
          }
        }
        if (tgtExt === 'tga' && srcExt !== 'tga') notes.push('saved as TGA');
      } else {
        // b2j
        if (flip) {
          const count = Math.max(1, Math.floor(dims.h / dims.w));
          if (count > 1) {
            project.extraFiles[`${t.path}.mcmeta`] = jsonBlob(flipbookToJava(flip, count));
            notes.push('animation converted');
          }
        } else if (implicitStrip && matched === 'frames' && !assets.hasFile(`${t.path}.mcmeta`)) {
          await firstFrame({ w: dims.w, h: dims.w }, 0, 'first frame only: Java doesn’t animate this texture');
        }
        if (srcExt === 'tga' && out === bytes) {
          out = encode(await image(), 'png');
          tgaToPng++;
        }
      }

      project.overrides[t.path] = new Blob([out as Uint8Array<ArrayBuffer>], { type: tgtExt === 'tga' ? 'image/x-tga' : 'image/png' });
      item.targets.push(t.path);
      for (const n of notes) if (!item.notes.includes(n)) item.notes.push(n);
      if (kind === 'j2j' && !t.inCatalogue) kept = true;
      void outDims;
    }

    if (!item.targets.length) {
      const first = plan.targets[0];
      report.skipped.push({ source: plan.source, reason: 'layout', target: first?.path, detail: `Its size doesn’t fit the ${targetLabel(target)} texture` });
      return null;
    }
    if (kept && plan.targets.every((t) => !t.inCatalogue)) {
      if (knownVanilla && isKnownVanilla(plan.source, knownVanilla)) {
        // A vanilla texture the target version doesn't have.
        for (const t of item.targets) delete project.overrides[t];
        for (const t of item.targets) delete project.extraFiles[`${t}.mcmeta`];
        report.skipped.push({ source: plan.source, reason: 'missing', target: item.targets[0], detail: `Not in Java ${target.version}` });
        return null;
      }
      keptPaths.add(plan.source);
    }
    return item;
  }

  async function convertExtraFiles(): Promise<void> {
    const consumed = new Set<string>();
    if (source.edition === 'java') {
      consumed.add('pack.png');
      for (const p of sources) consumed.add(`${p}.mcmeta`);
    } else {
      for (const p of ['manifest.json', 'pack_icon.png', FLIPBOOK, TERRAIN, 'textures/item_texture.json', 'textures/texture_list.json', 'contents.json', 'textures_list.json']) consumed.add(p);
    }
    let rewritten = 0;
    let hasModels = false;
    const chain = javaChain!;
    for (const [path, blob] of Object.entries(source.extraFiles ?? {})) {
      check(signal);
      if (!blob) continue;
      if (kind === 'j2j') {
        if (consumed.has(path)) continue;
        if (path.startsWith(JAVA_TEXTURE_ROOT) && path.endsWith('.png.mcmeta')) {
          // .mcmeta for a texture the pack doesn't replace (animation tweak of a vanilla texture)
          const rel = path.slice(JAVA_TEXTURE_ROOT.length, -'.png.mcmeta'.length);
          const r = chain.map(rel);
          if (r.kind === 'removed') {
            report.dropped.push({ source: path, kind: `Animation settings (removed in Java ${r.version})` });
            continue;
          }
          for (const p of r.paths) {
            const dest = `${JAVA_TEXTURE_ROOT}${p}.png.mcmeta`;
            if (!project.extraFiles[dest]) project.extraFiles[dest] = blob;
          }
          report.carried++;
          continue;
        }
        if (/^assets\/[^/]+\/(models|blockstates|items)\//.test(path)) hasModels = true;
        if (/^assets\/[^/]+\/models\/.+\.json$/.test(path) && chain.direction !== 'none') {
          const text = await blobText(blob).catch(() => null);
          const next = text === null ? null : rewriteModelTextures(text, (rel) => mapRef(chain, rel), parseJsonLoose, stringifyPretty);
          if (next !== null) {
            project.extraFiles[path] = textBlob(next, 'application/json');
            rewritten++;
            report.carried++;
            continue;
          }
        }
        project.extraFiles[path] = blob;
        report.carried++;
        continue;
      }
      if (consumed.has(path)) continue;
      if (source.edition === 'java' && path === 'pack.mcmeta') continue;
      report.dropped.push({ source: path, kind: fileKind(path, source.edition) });
    }
    if (kind === 'j2j') {
      if (rewritten) report.notes.push(`${plural(rewritten, 'model file')} had ${rewritten === 1 ? 'its' : 'their'} texture names updated.`);
      if (hasModels && (rewritten || work.some((p) => p.renamed))) {
        report.notes.push('Minecraft also renamed some models and block states between these versions. Check that the pack’s custom models still work in game.');
      }
    } else if (report.dropped.length) {
      const other = target.edition === 'bedrock' ? 'Bedrock' : 'Java';
      report.notes.push(`${plural(report.dropped.length, 'other file')} (models, sounds, fonts, texts…) ${report.dropped.length === 1 ? 'was' : 'were'} left out: ${other} uses different formats for ${report.dropped.length === 1 ? 'it' : 'them'}.`);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Helpers

/** New texture name (relative, no extension) for a model reference, or null to keep it. */
function mapRef(chain: RenameChain, rel: string): string | null {
  const r = chain.map(rel);
  return r.kind === 'paths' && r.renamed ? r.paths[0] : null;
}

/** Paths (relative, no extension) any known Java version uses: rename data and the Java side of the pairs. */
export function vanillaNameSet(maps: ConvertMaps, pairs: PairIndex | null): Set<string> {
  const out = new Set<string>();
  for (const s of maps.renames?.steps ?? []) {
    for (const [k, v] of Object.entries(s.renames)) {
      out.add(k);
      for (const n of Array.isArray(v) ? v : [v]) out.add(n);
    }
    for (const r of s.removed ?? []) out.add(r);
  }
  if (pairs) for (const k of pairs.toBedrock.keys()) out.add(k);
  if (maps.javaBedrock && !pairs) for (const [j] of maps.javaBedrock.pairs) out.add(j);
  return out;
}

function isKnownVanilla(path: string, set: Set<string>): boolean {
  if (!path.startsWith(JAVA_TEXTURE_ROOT)) return false;
  return set.has(path.slice(JAVA_TEXTURE_ROOT.length).replace(/\.png$/i, ''));
}

function fileKind(path: string, edition: Edition): string {
  const p = path.toLowerCase();
  if (edition === 'java') {
    if (/^assets\/[^/]+\/models\//.test(p)) return 'Model';
    if (/^assets\/[^/]+\/(blockstates|items)\//.test(p)) return 'Block state or item definition';
    if (/^assets\/[^/]+\/sounds\//.test(p) || p.endsWith('sounds.json') || p.endsWith('.ogg')) return 'Sound';
    if (/^assets\/[^/]+\/font\//.test(p) || /textures\/font\//.test(p)) return 'Font';
    if (/^assets\/[^/]+\/lang\//.test(p)) return 'Language file';
    if (/^assets\/[^/]+\/shaders\//.test(p) || /^assets\/[^/]+\/post_effect\//.test(p)) return 'Shader';
    if (/^assets\/[^/]+\/(optifine|mcpatcher)\//.test(p)) return 'OptiFine file';
    if (/^assets\/[^/]+\/(texts|atlases|particles|equipment|waypoint_style)\//.test(p)) return 'Game data file';
    if (/^assets\/(?!minecraft\/)[^/]+\/textures\//.test(p)) return 'Mod texture';
    if (p.endsWith('.png.mcmeta')) return 'Animation settings';
    if (/^[^/]+\/assets\//.test(p)) return 'Overlay folder file';
    if (/\.(png|tga)$/.test(p)) return 'Image that isn’t a texture';
    return 'Other file';
  }
  if (p.startsWith('subpacks/')) return 'Sub-pack file';
  if (p.endsWith('.texture_set.json') || /_(mers?|normal|heightmap)\.(png|tga)$/.test(p)) return 'Vibrant Visuals (PBR) file';
  if (p.startsWith('models/') || p.startsWith('attachables/') || p.startsWith('entity/') || p.startsWith('render_controllers/') || p.startsWith('animations/') || p.startsWith('animation_controllers/')) return 'Model';
  if (p.startsWith('sounds/') || p === 'sounds.json' || p.endsWith('.ogg') || p.endsWith('.fsb')) return 'Sound';
  if (p.startsWith('font/')) return 'Font';
  if (p.startsWith('texts/')) return 'Language file';
  if (p.startsWith('ui/')) return 'Menu layout';
  if (p.startsWith('particles/')) return 'Particle definition';
  if (p.startsWith('shaders/') || p.startsWith('materials/')) return 'Shader';
  if (p.endsWith('blocks.json') || p.endsWith('biomes_client.json')) return 'Game data file';
  if (/^textures\/.+\.json$/.test(p)) return 'Texture settings';
  if (/\.(png|tga|jpe?g)$/.test(p)) return 'Image that isn’t a texture';
  return 'Other file';
}

function isStrip(d: Dims): boolean {
  return d.h >= d.w * 2 && d.h % d.w === 0;
}

function sameAspect(a: Dims, b: Dims): boolean {
  return a.w * b.h === a.h * b.w;
}

function toDims(f: { fw: number; fh: number }): Dims {
  return { w: f.fw, h: f.fh };
}

/** Frames read left to right, top to bottom, stacked into one column. */
async function restack(img: ImageData, frame: Dims, count: number): Promise<ImageData> {
  const out = createImageData(frame.w, frame.h * count);
  const cols = Math.max(1, Math.floor(img.width / frame.w));
  for (let i = 0; i < count; i++) {
    const sx = (i % cols) * frame.w;
    const sy = Math.floor(i / cols) * frame.h;
    for (let y = 0; y < frame.h; y++) {
      const s = ((sy + y) * img.width + sx) * 4;
      out.data.set(img.data.subarray(s, s + frame.w * 4), ((i * frame.h + y) * frame.w) * 4);
    }
  }
  return out;
}

function encode(img: ImageData, ext: string): Uint8Array {
  return ext === 'tga' ? encodeTga(img) : encodePng(img);
}

async function readJson(assets: AssetIndex, path: string): Promise<unknown> {
  if (!assets.hasFile(path)) return null;
  try {
    return parseJsonLoose(await assets.readText(path));
  } catch (err) {
    if (isAbortError(err)) throw err;
    return null;
  }
}

const utf8 = new TextDecoder('utf-8');
async function blobText(b: Blob): Promise<string> {
  const t = utf8.decode(new Uint8Array(await b.arrayBuffer()));
  return t.charCodeAt(0) === 0xfeff ? t.slice(1) : t;
}

function textBlob(text: string, type = 'text/plain'): Blob {
  return new Blob([text], { type });
}

function jsonBlob(v: unknown): Blob {
  return textBlob(stringifyPretty(v), 'application/json');
}

function baseName(p: string): string {
  return p.slice(p.lastIndexOf('/') + 1);
}

function plural(n: number, word: string): string {
  return `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;
}

function check(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

async function runPool<T>(items: T[], concurrency: number, signal: AbortSignal | undefined, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  let failed = false;
  let last = Date.now();
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
      if (Date.now() - last > 12) {
        await new Promise((r) => setTimeout(r, 0));
        last = Date.now();
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
}

