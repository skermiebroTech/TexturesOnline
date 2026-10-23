// Name-based textures in a texture pack project (project.nameVariants): the looks of an item, the
// files the export writes for the pack's versions (item definitions merged with the pack's own, CIT
// properties) and an opened pack's name-based looks taken into the editor (CIT files and 1.21.5+ item
// definitions that pick by name). No DOM.

import type { AssetIndex, NameVariant, TexturePackProject } from '../../../core/types';
import { bundledPackFormat, comparePackFormats } from '../../../editions/java/packformats';
import { itemOptions, javaTexturePath, modelId, modelPath, splitId } from '../../../shared/models/java-models';
import { parseJsonLoose } from '../project';
import { prettyJson } from '../models/doc';
import {
  caseModel,
  citProperties,
  citPropertiesPath,
  decodeLatin1,
  definitionPath,
  flatModel,
  modelIdOfPath,
  nameRules,
  readCitRule,
  readNameSelect,
  resolveCitAsset,
  slugFor,
  slugOf,
  variantId,
  variantModelId,
  variantTexturePath,
  withNameCases,
  withoutNameCases,
  type NameCase,
} from './names';

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const jsonBlob = (text: string) => new Blob([text], { type: 'application/json' });
const TEXTURE_ROOT = 'assets/minecraft/textures/';
/** CIT folders OptiFine reads (mcpatcher/ is the older name) */
const CIT_FILE = /^assets\/minecraft\/(optifine|mcpatcher)\/cit\/.+\.properties$/;
const ITEM_DEFINITION = /^assets\/minecraft\/items\/([^/]+)\.json$/;

export function hasNameVariants(project: TexturePackProject): boolean {
  return project.edition === 'java' && !!project.nameVariants && Object.keys(project.nameVariants).length > 0;
}

/** An item's looks, in the order they were made. */
export function variantsOf(project: TexturePackProject, item: string): [string, NameVariant][] {
  return Object.entries(project.nameVariants ?? {})
    .filter(([, v]) => v.item === item)
    .sort((a, b) => a[0].localeCompare(b[0]));
}

/** The look a texture belongs to (null for other textures). */
export function variantOfTexture(project: TexturePackProject, path: string): [string, NameVariant] | null {
  for (const e of Object.entries(project.nameVariants ?? {})) if (e[1].texture === path) return e;
  return null;
}

/** A new look's id: '<item>/<slug>' from its first name, unique among the item's looks. */
export function newVariantId(project: TexturePackProject, item: string, firstName: string): string {
  const taken = new Set(variantsOf(project, item).map(([id]) => slugOf(id)));
  // a texture or model of that name the pack already has (an opened pack's) is taken too
  for (;;) {
    const slug = slugFor(firstName, taken);
    if (!project.overrides[variantTexturePath(item, slug)] && !project.extraFiles[modelPath(variantModelId(item, slug))]) return variantId(item, slug);
    taken.add(slug);
  }
}

/** The model an item shows (from its 1.21.4+ definition, else item/<id>), for a look's flat model to build on. */
export function itemBaseModel(item: string, def: unknown): string {
  for (const o of itemOptions(def)) for (const l of o.leaves) if (l.leaf.kind === 'model') return modelId(l.leaf.model);
  return `minecraft:item/${item}`;
}

/** The look's model has cubes of its own (made in the model editor): CIT then needs model=. */
export async function hasOwnShape(project: TexturePackProject, v: NameVariant): Promise<boolean> {
  const blob = project.extraFiles[modelPath(v.model)];
  if (!blob) return false;
  const json = parseJsonLoose(await blob.text().catch(() => ''));
  return isObj(json) && Array.isArray(json.elements) && json.elements.length > 0;
}

// ---------------------------------------------------------------------------------------------
// Export

export interface NameFilesPlan {
  /** Item definitions that pick by name (1.21.5+) */
  select: boolean;
  /** OptiFine CIT files (before 1.21.5) */
  cit: boolean;
  /** CIT names the name rule components.custom_name (every version 1.20.5+) */
  components: boolean;
}

/**
 * Which files the pack's versions read: the target version decides, and a compatibility range that
 * reaches below 1.21.5 adds the CIT files for the older versions.
 */
export function nameFilesPlan(project: Pick<TexturePackProject, 'version' | 'compat'>): NameFilesPlan {
  const target = nameRules(project.version);
  let lowest = project.version;
  const range = project.compat;
  if (range?.minVersion && range.maxVersion) {
    for (const v of [range.minVersion, range.maxVersion]) {
      const a = bundledPackFormat(v);
      const b = bundledPackFormat(lowest);
      if (a && b && comparePackFormats(a, b) < 0) lowest = v;
    }
  }
  const low = nameRules(lowest);
  return { select: target.select, cit: !low.select || !target.select, components: low.components };
}

export interface NameFilesResult {
  /** path -> text */
  files: Record<string, string>;
  /** Looks written as CIT files for versions before 1.21.5 */
  cit: number;
  /** Looks an opened pack matched with an OptiFine pattern: no item definition can say it */
  patterns: string[];
}

/**
 * The files of the pack's name-based looks. `readJson` gives the item definition the pack has now
 * (its own, else the game's; undefined when there is none).
 */
export async function nameFiles(project: TexturePackProject, readJson: (path: string) => Promise<unknown>, plan = nameFilesPlan(project)): Promise<NameFilesResult> {
  const out: NameFilesResult = { files: {}, cit: 0, patterns: [] };
  if (!hasNameVariants(project)) return out;
  const byItem = new Map<string, [string, NameVariant][]>();
  // a look whose picture is gone (removed in the pixel editor) would show the missing texture: left out
  for (const e of Object.entries(project.nameVariants!)) if (project.overrides[e[1].texture]) byItem.set(e[1].item, [...(byItem.get(e[1].item) ?? []), e]);
  for (const [item, looks] of [...byItem].sort((a, b) => a[0].localeCompare(b[0]))) {
    looks.sort((a, b) => a[0].localeCompare(b[0]));
    if (plan.select) {
      const path = definitionPath(item);
      const def = await readJson(path);
      const root = isObj(def) ? def.model : undefined;
      const cases: NameCase[] = looks.filter(([, v]) => !v.match && v.names.length).map(([, v]) => ({ names: v.names, model: caseModel(v.model, root) }));
      if (cases.length) out.files[path] = prettyJson(withNameCases(def, item, cases));
    }
    for (const [id, v] of looks) {
      if (v.match && plan.select) out.patterns.push(v.match.replace(/^[a-z]+:/, ''));
      if (!plan.cit && !v.match) continue;
      if (!v.names.length && !v.match) continue;
      out.files[citPropertiesPath(id)] = citProperties(v, { components: plan.components, model: await hasOwnShape(project, v) });
      out.cit++;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Opened packs

/** The project has files an opened pack may pick looks by name with (CIT, item definitions). */
export function hasPackNames(project: TexturePackProject): boolean {
  return project.edition === 'java' && Object.keys(project.extraFiles).some((p) => CIT_FILE.test(p) || ITEM_DEFINITION.test(p));
}

/** A CIT name rule of the pack that stays a file (shown in the editor as it is). */
export interface PackNameRule {
  path: string;
  items: string[];
  /** The names, or the rule as written */
  label: string;
}

/** The pack's own CIT name rules the editor keeps as files (rules that do more than names). */
export async function packNameRules(project: TexturePackProject): Promise<PackNameRule[]> {
  const out: PackNameRule[] = [];
  for (const path of Object.keys(project.extraFiles).filter((p) => CIT_FILE.test(p)).sort()) {
    const rule = readCitRule(decodeLatin1(new Uint8Array(await project.extraFiles[path].arrayBuffer().catch(() => new ArrayBuffer(0)))));
    if (rule) out.push({ path, items: rule.items, label: rule.names ? rule.names.join(', ') : rule.match });
  }
  return out;
}

/**
 * Takes an opened pack's name-based looks into project.nameVariants (once, when the editor opens it):
 * 1.21.5+ item definitions that pick a model by name (cases whose model is a pack file showing a
 * texture of the pack's own; their definition keeps only what is left) and OptiFine CIT files that
 * pick one item by name and give it a texture (or a model of the pack's). Their textures become
 * editable (a CIT texture outside textures/ moves to textures/item/names/), and the files are
 * written again on export for the pack's versions. Rules that do more (damage, enchantments, several
 * items) stay as files. Returns the number of looks taken in.
 */
export async function adoptPackNames(project: TexturePackProject, assets: AssetIndex): Promise<number> {
  if (project.edition !== 'java') return 0;
  const variants = (project.nameVariants ??= {});
  let count = 0;
  const readText = async (blob: Blob | undefined) => (blob ? await blob.text().catch(() => '') : '');
  const gameJson = async (path: string): Promise<unknown> => (assets.hasFile(path) ? parseJsonLoose(await assets.readText(path).catch(() => '')) : undefined);
  const ownTexture = (path: string) => !!project.overrides[path] && !assets.hasFile(path);
  const add = async (id: string, names: string[], match: string | undefined, texture: string, model: string | null): Promise<void> => {
    const item = id.slice(0, id.indexOf('/'));
    let m = model;
    if (!m) {
      m = variantModelId(item, slugOf(id));
      project.extraFiles[modelPath(m)] = jsonBlob(prettyJson(flatModel(itemBaseModel(item, await gameJson(definitionPath(item))), texture)));
    }
    variants[id] = { item, names, ...(match ? { match } : {}), texture, model: m, updatedAt: Date.now() };
    count++;
  };

  // ---- 1.21.5+ item definitions
  for (const path of Object.keys(project.extraFiles).filter((p) => ITEM_DEFINITION.test(p)).sort()) {
    const item = ITEM_DEFINITION.exec(path)![1];
    const def = parseJsonLoose(await readText(project.extraFiles[path]));
    const read = readNameSelect(def);
    if (!read) continue;
    const kept: unknown[] = [];
    let taken = 0;
    for (const c of read.cases) {
      const texture = await caseTexture(c.model);
      if (!texture) {
        kept.push({ when: c.names.length === 1 ? c.names[0] : c.names, model: c.model });
        continue;
      }
      await add(newVariantId(project, item, c.names[0]), c.names, undefined, texture, modelId((c.model as { model: string }).model));
      taken++;
    }
    if (!taken) continue;
    kept.push(...read.kept);
    const rest = withoutNameCases(def, kept);
    if (!rest) continue;
    const game = await gameJson(path);
    // nothing of the pack's own left: the game's definition shows again
    if (!kept.length && game !== undefined && JSON.stringify(rest) === JSON.stringify(game)) delete project.extraFiles[path];
    else project.extraFiles[path] = jsonBlob(prettyJson(rest));
  }

  // ---- OptiFine CIT
  const rules: { path: string; rule: NonNullable<ReturnType<typeof readCitRule>>; texture: string | null; model: string | null }[] = [];
  const has = (p: string) => !!project.extraFiles[p] || !!project.overrides[p];
  for (const path of Object.keys(project.extraFiles).filter((p) => CIT_FILE.test(p)).sort()) {
    const rule = readCitRule(decodeLatin1(new Uint8Array(await project.extraFiles[path].arrayBuffer().catch(() => new ArrayBuffer(0)))));
    if (!rule) continue;
    const modelFile = rule.model !== undefined ? resolveCitAsset(path, rule.model, '.json', has) : null;
    let texture = rule.texture !== undefined || rule.model === undefined ? resolveCitAsset(path, rule.texture, '.png', has) : null;
    // a model of the pack's own: its picture is the texture to paint
    if (!texture && modelFile) texture = await modelTexture(modelFile);
    rules.push({ path, rule, texture, model: modelFile });
  }
  /** Rules (adopted or not) using each texture: a texture moves only when every one of them is taken in */
  const users = new Map<string, number>();
  for (const r of rules) if (r.texture) users.set(r.texture, (users.get(r.texture) ?? 0) + 1);
  const known = (item: string, names: string[]) => Object.values(variants).some((v) => v.item === item && v.names.length === names.length && v.names.every((n) => names.includes(n)));
  for (const r of rules) {
    const { rule } = r;
    const modelId_ = r.model ? modelIdOfPath(r.model) : null;
    const adoptable = rule.items.length === 1 && !rule.other.length && !!r.texture && (rule.model === undefined || !!modelId_);
    if (!adoptable) continue;
    const item = rule.items[0];
    // the same look written both ways (a pack made here for a range of versions): keep one
    if (rule.names && known(item, rule.names)) {
      delete project.extraFiles[r.path];
      users.set(r.texture!, users.get(r.texture!)! - 1);
      continue;
    }
    const id = newVariantId(project, item, rule.names?.[0] ?? r.path.replace(/^.*\/|\.properties$/g, ''));
    let texture = r.texture!;
    if (!texture.startsWith(TEXTURE_ROOT)) {
      const target = variantTexturePath(item, slugOf(id));
      const blob = project.overrides[texture] ?? project.extraFiles[texture];
      project.overrides[target] = blob;
      const meta = project.extraFiles[`${texture}.mcmeta`];
      if (meta) project.extraFiles[`${target}.mcmeta`] = meta;
      const left = users.get(texture)! - 1;
      users.set(texture, left);
      if (!left) {
        delete project.extraFiles[texture];
        delete project.overrides[texture];
        delete project.extraFiles[`${texture}.mcmeta`];
      }
      texture = target;
    } else if (!project.overrides[texture]) {
      project.overrides[texture] = project.extraFiles[texture];
      delete project.extraFiles[texture];
    }
    await add(id, rule.names ?? [], rule.names ? undefined : rule.match, texture, modelId_);
    delete project.extraFiles[r.path];
  }
  if (!Object.keys(variants).length) delete project.nameVariants;
  return count;

  /** A case's texture to paint: a plain model of the pack's whose picture is a texture of the pack's own. */
  async function caseTexture(node: unknown): Promise<string | null> {
    if (!isObj(node) || typeof node.type !== 'string' || node.type.replace(/^minecraft:/, '') !== 'model' || typeof node.model !== 'string') return null;
    const path = modelPath(modelId(node.model));
    if (!project.extraFiles[path]) return null;
    const tex = await modelTexture(path);
    return tex && ownTexture(tex) ? tex : null;
  }

  /** The main picture of a model file of the pack's (layer0, else its first texture). */
  async function modelTexture(path: string): Promise<string | null> {
    const json = parseJsonLoose(await readText(project.extraFiles[path]));
    if (!isObj(json) || !isObj(json.textures)) return null;
    const t = json.textures as Record<string, unknown>;
    const ref = typeof t.layer0 === 'string' ? t.layer0 : Object.values(t).find((v): v is string => typeof v === 'string' && !v.startsWith('#'));
    if (!ref || ref.startsWith('#')) return null;
    const [ns, p] = splitId(ref);
    const file = javaTexturePath(`${ns}:${p}`);
    return project.overrides[file] || project.extraFiles[file] ? file : null;
  }
}
