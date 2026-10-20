// Where an edited model goes in a Java pack, and the other files the game needs to use it:
// - a block's model is edited where its blockstate points; the blockstate is rewritten only when the
//   block picks randomly between several models (stone, deepslate...) and the user wants their shape
//   on all of them;
// - an item's model is edited where its item definition (1.21.4+) or its own model file (older
//   versions, overrides kept) points. When the item shows a block model or a model drawn by the game's
//   code (chests, shields...), the shape goes to item/<id> with an item definition pointing at it.
//   "Flat in the inventory" (1.21.4+) keeps the old model in the inventory, on the ground and in item
//   frames, and the new one (item/<id>_3d) in hand.
// Pure.

import { blockstateProperties, defaultState, itemDefinitionPath, itemOptions, matchesCondition, modelId, modelPath, parseBlockstate, splitId, type Blockstate, type JsonGet } from '../../../shared/models/java-models';
import { propertyLabel, valueLabel } from '../../../shared/models/labels';
import { prettyJson } from './doc';
import type { ModelRules } from './rules';

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** 'minecraft:block/stone' -> 'block/stone' (other namespaces keep theirs). */
export function shortModelName(id: string): string {
  const [ns, path] = splitId(modelId(id));
  return ns === 'minecraft' ? path : `${ns}:${path}`;
}

// ---------------------------------------------------------------------------------------------
// Blocks

export interface BlockModelChoice {
  /** Normalised model id */
  model: string;
  /** When the game uses it, e.g. 'Type: Top' (empty for single-model blocks) */
  label: string;
}

function stateText(when: Record<string, string>): string {
  return Object.entries(when)
    .map(([k, v]) => `${propertyLabel(k)}: ${valueLabel(k, v)}`)
    .join(', ');
}

/** The models a block's blockstate uses, the default state's first. */
export function blockModelChoices(bsJson: unknown): BlockModelChoice[] {
  const bs = parseBlockstate(bsJson);
  if (!bs) return [];
  const state = defaultState(bs, blockstateProperties(bs));
  const out: BlockModelChoice[] = [];
  const add = (model: string, when: Record<string, string>) => {
    const id = modelId(model);
    if (out.some((c) => c.model === id)) return;
    out.push({ model: id, label: stateText(when) });
  };
  if (bs.variants) {
    const first = bs.variants.find((v) => Object.entries(v.when).every(([k, val]) => state[k] === val)) ?? bs.variants[0];
    for (const o of first.options) add(o.model, first.when);
    for (const v of bs.variants) for (const o of v.options) add(o.model, v.when);
  } else {
    for (const p of bs.multipart ?? []) if (matchesCondition(p.when, state)) for (const o of p.apply) add(o.model, {});
    for (const p of bs.multipart ?? []) for (const o of p.apply) add(o.model, isObj(p.when) && !('OR' in p.when) && !('AND' in p.when) ? (p.when as Record<string, string>) : {});
  }
  return out;
}

/** Blocks whose blockstate uses a model (to say what else changes). */
export function blocksUsingModel(blockstates: Iterable<[string, Blockstate | null]>, model: string): string[] {
  const id = modelId(model);
  const out: string[] = [];
  for (const [block, bs] of blockstates) {
    if (!bs) continue;
    const lists = bs.variants ? bs.variants.map((v) => v.options) : (bs.multipart ?? []).map((p) => p.apply);
    if (lists.some((l) => l.some((o) => modelId(o.model) === id))) out.push(block);
  }
  return out;
}

/** Variant lists of a blockstate file (arrays of options), for reading and rewriting. */
function optionLists(json: Record<string, unknown>): { get(): unknown; set(v: unknown): void }[] {
  const out: { get(): unknown; set(v: unknown): void }[] = [];
  if (isObj(json.variants)) {
    const vars = json.variants as Record<string, unknown>;
    for (const k of Object.keys(vars)) out.push({ get: () => vars[k], set: (v) => (vars[k] = v) });
  } else if (Array.isArray(json.multipart)) {
    for (const p of json.multipart) if (isObj(p)) out.push({ get: () => p.apply, set: (v) => (p.apply = v) });
  }
  return out;
}

/** Other models the game picks at random instead of `model` (stone_mirrored for stone...). */
export function randomSiblings(bsJson: unknown, model: string): string[] {
  if (!isObj(bsJson)) return [];
  const id = modelId(model);
  const out = new Set<string>();
  for (const l of optionLists(structuredClone(bsJson))) {
    const v = l.get();
    if (!Array.isArray(v)) continue;
    const ids = v.filter(isObj).map((o) => (typeof o.model === 'string' ? modelId(o.model) : ''));
    if (!ids.includes(id)) continue;
    for (const x of ids) if (x && x !== id) out.add(x);
  }
  return [...out];
}

/**
 * The blockstate with every random alternative of `model` replaced by it (rotations and weights kept,
 * repeats merged; the model is named the way the file names it, as versions before 1.13 name models
 * relative to block/), or null when nothing needs to change.
 */
export function blockstateUsingEverywhere(bsJson: unknown, model: string): Record<string, unknown> | null {
  if (!isObj(bsJson)) return null;
  const id = modelId(model);
  const out = structuredClone(bsJson);
  let changed = false;
  for (const l of optionLists(out)) {
    const v = l.get();
    const list = Array.isArray(v) ? v : [v];
    const ids = list.filter(isObj).map((o) => (typeof o.model === 'string' ? modelId(o.model) : ''));
    if (!ids.includes(id) || ids.every((x) => x === id)) continue;
    const target = (list.filter(isObj).find((o) => typeof o.model === 'string' && modelId(o.model) === id)!.model as string);
    const seen = new Set<string>();
    const next: Record<string, unknown>[] = [];
    for (const o of list) {
      if (!isObj(o)) continue;
      const n = { ...o, model: target };
      const key = JSON.stringify(n);
      if (seen.has(key)) {
        // a repeat adds its weight to the one kept
        const prev = next.find((x) => JSON.stringify(x) === key);
        if (prev) prev.weight = (typeof prev.weight === 'number' ? prev.weight : 1) + (typeof o.weight === 'number' ? o.weight : 1);
        continue;
      }
      seen.add(key);
      next.push(n);
    }
    // a weight on the merged copy changes its key: tidy weights of 1
    for (const n of next) if (n.weight === 1) delete n.weight;
    l.set(next.length === 1 ? next[0] : next);
    changed = true;
  }
  return changed ? out : null;
}

// ---------------------------------------------------------------------------------------------
// Items

interface LeafMatch {
  kind: 'model' | 'special';
  model?: string;
}

/** A copy of an item definition node with the matching leaves pointing at `target`. */
export function replaceLeaves(node: unknown, match: LeafMatch, target: string): { node: unknown; replaced: number } {
  let replaced = 0;
  const walk = (n: unknown): unknown => {
    if (!isObj(n) || typeof n.type !== 'string') return n;
    const type = n.type.replace(/^minecraft:/, '');
    const o: Record<string, unknown> = { ...n };
    switch (type) {
      case 'model':
        if (match.kind === 'model' && typeof n.model === 'string' && modelId(n.model) === modelId(match.model!)) {
          replaced++;
          o.model = target;
        }
        return o;
      case 'special':
        // the game's code draws every special look (a Christmas chest too): the model replaces them all
        if (match.kind === 'special') {
          replaced++;
          return { type: 'minecraft:model', model: target };
        }
        return o;
      case 'condition':
        o.on_true = walk(n.on_true);
        o.on_false = walk(n.on_false);
        return o;
      case 'select':
        if (Array.isArray(n.cases)) o.cases = n.cases.map((c) => (isObj(c) ? { ...c, model: walk(c.model) } : c));
        if (n.fallback !== undefined) o.fallback = walk(n.fallback);
        return o;
      case 'range_dispatch':
        if (Array.isArray(n.entries)) o.entries = n.entries.map((e) => (isObj(e) ? { ...e, model: walk(e.model) } : e));
        if (n.fallback !== undefined) o.fallback = walk(n.fallback);
        return o;
      case 'composite':
        if (Array.isArray(n.models)) o.models = n.models.map(walk);
        return o;
      default:
        return o;
    }
  };
  return { node: walk(node), replaced };
}

export interface ItemPlanInput {
  itemId: string;
  rules: ModelRules;
  /** Pack files over the game's */
  json: JsonGet;
  /** Which look of the item (index into its options, as the library lists them) */
  option?: number;
  /** 1.21.4+: keep the flat model in the inventory, on the ground and in frames */
  flatGui?: boolean;
}

export interface ModelPlan {
  kind: 'block' | 'item';
  id: string;
  /** The model the game showed before (where editing starts) */
  source: string;
  /** Where the shape is saved */
  target: string;
  /** The model whose place the shape takes (target without the _3d of "flat in the inventory") */
  base: string;
  /** Item definition to write (1.21.4+), or null */
  definition: Record<string, unknown> | null;
  /** Blockstate to write, or null */
  blockstate: Record<string, unknown> | null;
  /** The item's look comes from the game's code (chest, shield...): the new model replaces it */
  replacesSpecial?: boolean;
  /** Can keep the flat icon in the inventory (1.21.4+) */
  canFlatGui: boolean;
}

/** Where an item's edited model goes and the item definition it needs. */
export function planItem(input: ItemPlanInput): ModelPlan {
  const { itemId, rules, json } = input;
  const own = `minecraft:item/${itemId}`;
  if (!rules.itemDefinitions) {
    // models/item/<id>.json and the models its overrides switch to
    const file = json(modelPath(own));
    const models = [own];
    if (isObj(file) && Array.isArray(file.overrides)) for (const o of file.overrides) if (isObj(o) && typeof o.model === 'string' && !models.includes(modelId(o.model))) models.push(modelId(o.model));
    const pick = models[Math.max(0, Math.min(models.length - 1, input.option ?? 0))];
    return { kind: 'item', id: itemId, source: pick, target: pick, base: pick, definition: null, blockstate: null, canFlatGui: false };
  }
  const defPath = itemDefinitionPath(itemId);
  const def = json(defPath);
  const options = itemOptions(def);
  const opt = options[Math.max(0, Math.min(options.length - 1, input.option ?? 0))];
  const leaf = opt?.leaves.find((l) => l.leaf.kind === 'model' || l.leaf.kind === 'special')?.leaf;
  let source = own;
  let match: LeafMatch | null = null;
  let inPlace = false;
  if (leaf?.kind === 'model') {
    source = modelId(leaf.model);
    match = { kind: 'model', model: leaf.model };
    inPlace = splitId(source)[1].startsWith('item/');
  } else if (leaf?.kind === 'special') {
    source = leaf.base ? modelId(leaf.base) : own;
    match = { kind: 'special' };
  }
  const base = inPlace ? source : own;
  const flat = !!input.flatGui;
  const target = flat ? `${base}_3d` : base;
  let definition: Record<string, unknown> | null = null;
  if (!inPlace || flat) {
    const root = isObj(def) ? def.model : undefined;
    const rest = isObj(def) ? { ...def } : {};
    delete rest.model;
    let replaced: unknown = { type: 'minecraft:model', model: target };
    if (root !== undefined && match) {
      const r = replaceLeaves(root, match, target);
      if (r.replaced) replaced = r.node;
    }
    const model = flat && root !== undefined ? { type: 'minecraft:select', property: 'minecraft:display_context', cases: [{ when: ['gui', 'ground', 'fixed'], model: root }], fallback: replaced } : replaced;
    definition = { model, ...rest };
  }
  return { kind: 'item', id: itemId, source, target, base, definition, blockstate: null, replacesSpecial: leaf?.kind === 'special', canFlatGui: true };
}

export interface BlockPlanInput {
  blockId: string;
  /** The model picked (one of blockModelChoices) */
  model: string;
  json: JsonGet;
  /** Put the shape on every random variant of the model */
  everyVariant?: boolean;
}

export function planBlock(input: BlockPlanInput): ModelPlan {
  const model = modelId(input.model);
  let blockstate: Record<string, unknown> | null = null;
  if (input.everyVariant) blockstate = blockstateUsingEverywhere(input.json(`assets/minecraft/blockstates/${input.blockId}.json`), model);
  return { kind: 'block', id: input.blockId, source: model, target: model, base: model, definition: null, blockstate, canFlatGui: false };
}

/** Pack files (path -> text) for a plan and the model text. */
export function planFiles(plan: ModelPlan, modelText: string): Record<string, string> {
  const files: Record<string, string> = { [modelPath(plan.target)]: modelText };
  if (plan.definition) files[itemDefinitionPath(plan.id)] = prettyJson(plan.definition);
  if (plan.blockstate) files[`assets/minecraft/blockstates/${plan.id}.json`] = prettyJson(plan.blockstate);
  return files;
}
