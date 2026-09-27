// Java Edition backend of the model library: blocks from blockstates/, items from items/ (1.21.4+) or
// models/item/, names from the language file. What the game draws with its own code (chests, banners,
// heads, shulker boxes, pots, bells' bodies, books, pre-26.2 beds and signs...) is rebuilt from the
// game's entity model definitions (block-entities.ts); liquids are shown as still blocks and invisible
// blocks (barrier, light, structure void) as their item icon.

import { boxQuads, DIR_VEC, type BakedQuad, type Dir, type Tint, type Vec3 } from './geometry';
import {
  JavaModelSet,
  allVariants,
  bakeModel,
  blockstatePath,
  blockstateProperties,
  defaultState,
  faceTexture,
  itemDefinitionPath,
  itemOptions,
  javaBlockTint,
  javaTexturePath,
  legacyItemTint,
  legacyOverrideModels,
  modelId,
  modelPath,
  parseBlockstate,
  splitId,
  variantsForState,
  type BlockProperty,
  type Blockstate,
  type ItemOption,
  type JsonGet,
  type ResolvedModel,
} from './java-models';
import { DYE_COLORS, SHIELD, TRIDENT, javaEntityBlock, javaEntityItem, legacyEntityItemBlock, type EntityBlock, type EntityTextureSource } from './block-entities';
import { bakeEntityModel, mat4Scale } from './entity-models';
import type { BlockState, EditionBackend, ModelCategory, RawView, SpriteLayer, TextureStates } from './types';

const MC = 'assets/minecraft/';
const HIDDEN_BLOCKS = new Set(['air', 'cave_air', 'void_air', 'moving_piston']);
const ITEM_TEMPLATES = /^(generated|handheld|handheld_rod|handheld_mace|template_.*|.*_in_hand)$/;
const PLANT_PARENTS = /(^|:)block\/(cross|tinted_cross|cross_emissive|flower_pot_cross|tinted_flower_pot_cross|crop|stem_growth\d|stem_fruit|template_seagrass|template_azalea|pointed_dripstone|template_hanging_roots|leaf_litter|flowerbed_\d|cave_vines.*|coral_fan|coral_wall_fan)$/;
/** Blocks that are invisible in the world: shown as their item icon. */
const INVISIBLE = /^(barrier|light|structure_void)$/;
export const INVISIBLE_NOTE = 'Invisible in the world. Shown as its item icon, the texture you can paint.';

export interface JavaSource {
  version: string;
  json: JsonGet;
  hasFile(path: string): boolean;
  listFiles(prefix: string): string[];
  animated: Set<string>;
  lang: Record<string, string>;
}

/** A block the game has but no blockstate file lists (before 1.13 for entity-drawn blocks and liquids). */
interface Synthetic {
  kind: 'entity' | 'liquid' | 'invisible';
  /** Language keys for its name */
  names: string[];
  /** Texture sheets (liquids) */
  textures?: string[];
}

function stem(path: string, prefix: string, ext = '.json'): string {
  return path.slice(prefix.length, -ext.length);
}

const camel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

export class JavaBackend implements EditionBackend {
  readonly models: JavaModelSet;
  private readonly states = new Map<string, Blockstate | null>();
  private readonly blockList: string[];
  private readonly synthetic = new Map<string, Synthetic>();
  private readonly itemList: string[];
  private readonly modern: boolean;
  private readonly flattened: boolean;
  private readonly optionsCache = new Map<string, ItemOption[] | string[]>();
  private readonly entityCache = new Map<string, EntityBlock | null>();
  private readonly propsCache = new Map<string, BlockProperty[]>();
  readonly entitySource: EntityTextureSource;

  constructor(private readonly src: JavaSource) {
    this.models = new JavaModelSet(src.json);
    this.flattened = src.hasFile(`${MC}textures/block/stone.png`) || !src.hasFile(`${MC}textures/blocks/stone.png`);
    this.entitySource = {
      edition: 'java',
      find: (...rels) => {
        for (const r of rels) {
          const p = `${MC}textures/${r}.png`;
          if (src.hasFile(p)) return p;
        }
        return null;
      },
      path: (rel) => `${MC}textures/${rel}.png`,
    };
    const bsPrefix = `${MC}blockstates/`;
    const ids = src
      .listFiles(bsPrefix)
      .filter((p) => p.endsWith('.json') && !p.slice(bsPrefix.length).includes('/'))
      .map((p) => stem(p, bsPrefix))
      .filter((id) => !HIDDEN_BLOCKS.has(id));
    // Before 1.13 the entity-drawn blocks, invisible blocks and liquids have no blockstate file.
    if (ids.length && !this.flattened) {
      const idSet = new Set(ids);
      const has = (rel: string) => src.hasFile(`${MC}textures/${rel}.png`);
      const legacy: [string, Synthetic, boolean][] = [
        ['chest', { kind: 'entity', names: ['tile.chest.name'] }, has('entity/chest/normal')],
        ['trapped_chest', { kind: 'entity', names: ['tile.chestTrap.name'] }, has('entity/chest/trapped')],
        ['ender_chest', { kind: 'entity', names: ['tile.enderChest.name'] }, has('entity/chest/ender')],
        ['bed', { kind: 'entity', names: ['tile.bed.name'] }, has('entity/bed/red')],
        ['standing_sign', { kind: 'entity', names: ['tile.sign.name'] }, has('entity/sign')],
        ['wall_sign', { kind: 'entity', names: [] }, has('entity/sign')],
        ['skull', { kind: 'entity', names: ['tile.skull.name'] }, has('entity/skeleton/skeleton')],
        ['standing_banner', { kind: 'entity', names: ['tile.banner.name'] }, has('entity/banner_base')],
        ['wall_banner', { kind: 'entity', names: [] }, has('entity/banner_base')],
        ...DYE_COLORS.map((c): [string, Synthetic, boolean] => {
          const name = c === 'light_gray' ? 'silver' : c;
          return [`${name}_shulker_box`, { kind: 'entity', names: [`tile.shulkerBox${camel(`_${name}`)}.name`] }, has(`entity/shulker/shulker_${name}`)];
        }),
        ['end_portal', { kind: 'entity', names: ['tile.endPortal.name'] }, has('entity/end_portal')],
        ['end_gateway', { kind: 'entity', names: ['tile.endGateway.name'] }, has('entity/end_gateway_beam')],
        ['barrier', { kind: 'invisible', names: ['tile.barrier.name'] }, has('items/barrier')],
        ['structure_void', { kind: 'invisible', names: ['tile.structureVoid.name'] }, has('items/structure_void')],
        ['water', { kind: 'liquid', names: ['tile.water.name'], textures: ['blocks/water_still'] }, has('blocks/water_still')],
        ['lava', { kind: 'liquid', names: ['tile.lava.name'], textures: ['blocks/lava_still'] }, has('blocks/lava_still')],
      ];
      for (const [id, syn, present] of legacy) {
        if (!present || idSet.has(id) || (id === 'standing_sign' && idSet.has('sign'))) continue;
        this.synthetic.set(id, syn);
        ids.push(id);
      }
    }
    this.blockList = ids.sort();
    this.modern = src.listFiles(`${MC}items/`).some((p) => p.endsWith('.json'));
    this.itemList = this.computeItems();
  }

  // ------------------------------------------------------------------ names

  blockIds(): string[] {
    return this.blockList;
  }

  itemIds(): string[] {
    return this.itemList;
  }

  blockName(id: string): string | null {
    const l = this.src.lang;
    if (this.flattened) return l[`block.minecraft.${id}`] ?? null;
    for (const k of this.synthetic.get(id)?.names ?? []) if (l[k]) return l[k];
    return l[`tile.${id}.name`] ?? l[`tile.${camel(id)}.name`] ?? null;
  }

  itemName(id: string): string | null {
    const l = this.src.lang;
    if (this.flattened) return l[`item.minecraft.${id}`] ?? l[`block.minecraft.${id}`] ?? null;
    return l[`item.${id}.name`] ?? l[`tile.${id}.name`] ?? null;
  }

  hasTexture(path: string): boolean {
    return this.src.hasFile(path);
  }

  isAnimated(path: string): boolean {
    return this.src.animated.has(path);
  }

  // ------------------------------------------------------------------ blocks

  blockstate(id: string): Blockstate | null {
    if (!this.states.has(id)) this.states.set(id, parseBlockstate(this.src.json(blockstatePath(id))));
    return this.states.get(id) ?? null;
  }

  /**
   * The entity-drawn part of a block: chests, banners... (their block model draws nothing), and the bell
   * body, enchanting table and lectern books (drawn with the block model).
   */
  entityBlock(id: string): EntityBlock | null {
    if (this.entityCache.has(id)) return this.entityCache.get(id)!;
    const syn = this.synthetic.get(id);
    let e: EntityBlock | null = null;
    if (!syn || syn.kind === 'entity') {
      const bs = this.blockstate(id);
      e = javaEntityBlock(id, { src: this.entitySource, hasProperty: (n) => !!bs && blockstateProperties(bs).some((p) => p.name === n), legacy: !this.flattened });
      // From 26.2 signs and beds are block models: nothing left for the entity renderer. (The others
      // keep a placeholder model the game never draws, once even a soul sand cube for skulls.)
      if (e?.becameBlockModel && bs && allVariants(bs).some(({ variant }) => (this.models.resolve(variant.model).elements?.length ?? 0) > 0)) e = null;
    }
    this.entityCache.set(id, e);
    return e;
  }

  blockProperties(id: string): { name: string; values: string[] }[] {
    let out = this.propsCache.get(id);
    if (!out) {
      const bs = this.blockstate(id);
      out = bs ? blockstateProperties(bs) : [];
      const e = this.entityBlock(id);
      if (e) for (const p of e.properties) if (!out.some((b) => b.name === p.name)) out.push({ name: p.name, values: [...p.values] });
      this.propsCache.set(id, out);
    }
    return out;
  }

  defaultBlockState(id: string): BlockState {
    const bs = this.blockstate(id);
    const s = bs ? defaultState(bs) : {};
    const e = this.entityBlock(id);
    if (e) for (const [k, v] of Object.entries(e.defaults)) if (!(k in s)) s[k] = v;
    // Torches before 1.13 keep standing and wall variants in one file: show the standing one.
    if (/torch/.test(id) && s.facing && this.blockProperties(id).some((p) => p.name === 'facing' && p.values.includes('up'))) s.facing = 'up';
    return s;
  }

  /** Door / tall plant halves and bed parts are shown together. */
  combinedProperties(id: string): string[] {
    const props = this.blockProperties(id);
    const out: string[] = [];
    const half = props.find((p) => p.name === 'half');
    if (half && half.values.includes('lower') && half.values.includes('upper')) out.push('half');
    const part = props.find((p) => p.name === 'part');
    if (part && part.values.includes('head') && part.values.includes('foot') && props.some((p) => p.name === 'facing')) out.push('part');
    return out;
  }

  private parts(id: string, state: BlockState): { state: BlockState; offset: Vec3 }[] {
    const combined = this.combinedProperties(id);
    if (combined.includes('half')) {
      return [
        { state: { ...state, half: 'lower' }, offset: [0, 0, 0] },
        { state: { ...state, half: 'upper' }, offset: [0, 1, 0] },
      ];
    }
    if (combined.includes('part')) {
      const f = DIR_VEC[(state.facing as keyof typeof DIR_VEC) ?? 'north'] ?? DIR_VEC.north;
      return [
        { state: { ...state, part: 'foot' }, offset: [0, 0, 0] },
        { state: { ...state, part: 'head' }, offset: [f[0], 0, f[2]] },
      ];
    }
    return [{ state, offset: [0, 0, 0] }];
  }

  resolveBlock(id: string, state: BlockState): RawView {
    const syn = this.synthetic.get(id);
    if (syn?.kind === 'liquid') return this.specialView(id, (syn.textures ?? []).map((r) => `${MC}textures/${r}.png`).filter((p) => this.src.hasFile(p)));
    if (syn?.kind === 'invisible' || INVISIBLE.test(id)) return this.invisibleView(id, state);
    const bs = this.blockstate(id);
    const entity = this.entityBlock(id);
    if (!bs && !entity) return this.specialView(id, []);
    const quads: BakedQuad[] = [];
    const models: ResolvedModel[] = [];
    let partIndex = 0;
    if (bs)
      for (const { state: s, offset } of this.parts(id, state)) {
        for (const v of variantsForState(bs, s)) {
          const model = this.models.resolve(v.model);
          models.push(model);
          quads.push(...bakeModel(model, { x: v.x, y: v.y, uvlock: v.uvlock, offset, part: partIndex++, tint: (i) => javaBlockTint(id, s, i) }));
        }
      }
    if (entity) {
      const eq = entity.quads(state);
      if (entity.mode === 'replace' || !quads.length) return { shape: 'model', quads: eq, sprite: [], category: 'special', note: entity.note };
      quads.push(...eq);
      return { shape: 'model', quads, sprite: [], category: categorize(quads, models), note: entity.note };
    }
    if (!quads.length) {
      const liquid = this.liquidView(id, models);
      if (liquid) return liquid;
      return this.specialView(id, models.map((m) => this.particleOf(m)).filter((p): p is string => !!p));
    }
    return { shape: 'model', quads, sprite: [], category: categorize(quads, models) };
  }

  private particleOf(m: ResolvedModel): string | null {
    const ref = resolveRef(m.textures, 'particle');
    if (!ref || ref === 'minecraft:missingno') return null;
    const p = javaTexturePath(ref);
    return this.src.hasFile(p) ? p : null;
  }

  /** Item icon of an invisible block: the model's particle (26.x points it at the item texture) or the item texture. */
  private invisibleTexture(id: string, state: BlockState): string | null {
    const bs = this.blockstate(id);
    if (bs)
      for (const v of variantsForState(bs, state)) {
        const p = this.particleOf(this.models.resolve(v.model));
        if (p && /\/items?\//.test(p)) return p;
      }
    const level = String(Math.max(0, Math.min(15, Number(state.level ?? 15) || 0))).padStart(2, '0');
    const name = id === 'light' ? `light_${level}` : id;
    return this.entitySource.find(`item/${name}`, `items/${name}`, `item/${id}`);
  }

  private invisibleView(id: string, state: BlockState): RawView {
    const p = this.invisibleTexture(id, state);
    return { shape: 'sprite', quads: [], sprite: p ? [{ path: p, role: 'sprite', tint: null }] : [], category: 'special', note: INVISIBLE_NOTE };
  }

  private liquidView(id: string, models: ResolvedModel[]): RawView | null {
    const liquid = /^(water|lava|bubble_column|flowing_water|flowing_lava)$/.exec(id);
    if (!liquid) return null;
    const still = models.map((m) => this.particleOf(m)).find(Boolean) ?? this.tex(id.includes('lava') ? 'lava_still' : 'water_still');
    if (!still) return null;
    const flow = this.tex(id.includes('lava') ? 'lava_flow' : 'water_flow');
    const tint: Tint | null = id.includes('lava') ? null : { kind: 'water' };
    const face = (p: string) => ({ texture: p, ref: p, role: p === still ? 'still' : 'flow', tint });
    const quads = boxQuads([0, 0, 0], [16, 14, 16], {
      up: face(still),
      down: face(still),
      north: face(flow ?? still),
      south: face(flow ?? still),
      east: face(flow ?? still),
      west: face(flow ?? still),
    });
    return {
      shape: 'model',
      quads,
      sprite: [],
      category: 'special',
      note: `${id.includes('lava') ? 'Lava' : 'Water'} is drawn by the game from its still and flowing textures, shown here as a still source block.`,
    };
  }

  private tex(name: string): string | null {
    for (const dir of ['block', 'blocks']) {
      const p = `${MC}textures/${dir}/${name}.png`;
      if (this.src.hasFile(p)) return p;
    }
    return null;
  }

  private specialView(id: string, fallback: string[]): RawView {
    const textures = specialTextures(id, (rel) => {
      const p = `${MC}textures/${rel}.png`;
      return this.src.hasFile(p) ? p : null;
    });
    const liquid = /^(water|lava)$/.test(id) && (textures[0] ?? fallback[0]) ? this.liquidFromPaths(id, textures[0] ?? fallback[0]) : null;
    if (liquid) return liquid;
    const paths = textures.length ? textures : fallback;
    return {
      shape: 'special',
      quads: [],
      sprite: paths.map((p) => ({ path: p, role: 'entity', tint: null })),
      category: 'special',
      note: paths.length
        ? `The game draws this block with its own code instead of a block model. Its texture sheet${paths.length > 1 ? 's are' : ' is'} shown flat.`
        : 'The game draws this block with its own code and it has no texture of its own.',
    };
  }

  private liquidFromPaths(id: string, still: string): RawView {
    const tint: Tint | null = id === 'water' ? { kind: 'water' } : null;
    const face = { texture: still, ref: still, role: 'still', tint };
    return {
      shape: 'model',
      quads: boxQuads([0, 0, 0], [16, 14, 16], { up: face, down: face, north: face, south: face, east: face, west: face }),
      sprite: [],
      category: 'special',
      note: `${id === 'lava' ? 'Lava' : 'Water'} is drawn by the game, shown here as a still source block.`,
    };
  }

  blockTextureStates(id: string): TextureStates[] {
    const syn = this.synthetic.get(id);
    const bs = this.blockstate(id);
    const out = new Map<string, { path: string; role: string; states: BlockState[]; keys: Set<string>; dirs: Set<string> }>();
    const add = (path: string, role: string, state: BlockState, dir: string | null) => {
      let hit = out.get(path);
      if (!hit) out.set(path, (hit = { path, role, states: [], keys: new Set(), dirs: new Set() }));
      const k = JSON.stringify(state);
      if (!hit.keys.has(k)) {
        hit.keys.add(k);
        hit.states.push(state);
      }
      if (dir) hit.dirs.add(dir);
    };
    if (syn?.kind === 'invisible' || INVISIBLE.test(id)) {
      const levels = this.blockProperties(id).find((p) => p.name === 'level')?.values;
      for (const level of levels ?? [null]) {
        const st: BlockState = level === null ? {} : { level };
        const p = this.invisibleTexture(id, st);
        if (p) add(p, 'sprite', st, null);
      }
      return [...out.values()].map((v) => ({ path: v.path, role: v.role, states: v.states, dirs: [] }));
    }
    const entity = this.entityBlock(id);
    if (!syn && bs && (!entity || entity.mode === 'add')) {
      for (const { variant, when } of allVariants(bs)) {
        const model = this.models.resolve(variant.model);
        for (const t of modelFaceTextures(model)) add(t.path, t.role, when, t.dir);
      }
    }
    if (entity) {
      const base = this.defaultBlockState(id);
      const states: BlockState[] = [base];
      for (const p of entity.properties) for (const v of p.values) if (base[p.name] !== v) states.push({ ...base, [p.name]: v });
      for (const st of states) for (const q of entity.quads(st)) if (q.texture) add(q.texture, q.role, st, q.dir);
    }
    if (!out.size) {
      const v = this.resolveBlock(id, this.defaultBlockState(id));
      for (const q of v.quads) if (q.texture) add(q.texture, q.role, {}, q.dir);
      for (const s of v.sprite) add(s.path, s.role, {}, null);
    }
    return [...out.values()].map((v) => ({ path: v.path, role: v.role, states: v.states, dirs: [...v.dirs] }));
  }

  // ------------------------------------------------------------------ items

  private computeItems(): string[] {
    if (this.modern) {
      const prefix = `${MC}items/`;
      return this.src
        .listFiles(prefix)
        .filter((p) => p.endsWith('.json') && !p.slice(prefix.length).includes('/'))
        .map((p) => stem(p, prefix))
        .filter((id) => id !== 'air')
        .sort();
    }
    const prefix = `${MC}models/item/`;
    const all = this.src
      .listFiles(prefix)
      .filter((p) => p.endsWith('.json') && !p.slice(prefix.length).includes('/'))
      .map((p) => stem(p, prefix));
    const variantsOnly = new Set<string>();
    const parents = new Set<string>();
    for (const id of all) {
      const json = this.src.json(`${prefix}${id}.json`);
      for (const m of legacyOverrideModels(json)) variantsOnly.add(splitId(modelId(m))[1].replace(/^item\//, ''));
      const parent = json && typeof json === 'object' ? (json as { parent?: unknown }).parent : undefined;
      if (typeof parent === 'string') parents.add(splitId(modelId(parent))[1].replace(/^item\//, ''));
    }
    // Shared parents with nothing to draw of their own (amethyst_bud) are templates, not items.
    const template = (id: string) => {
      if (!parents.has(id)) return false;
      const m = this.models.resolve(`minecraft:item/${id}`);
      return !m.elements && !resolveRef(m.textures, 'layer0') && m.builtin !== 'entity';
    };
    return all.filter((id) => id !== 'air' && !variantsOnly.has(id) && !ITEM_TEMPLATES.test(id) && !template(id)).sort();
  }

  private options(id: string): ItemOption[] | string[] {
    let o = this.optionsCache.get(id);
    if (!o) {
      if (this.modern) o = itemOptions(this.src.json(itemDefinitionPath(id)));
      else {
        const json = this.src.json(`${MC}models/item/${id}.json`);
        o = [`minecraft:item/${id}`, ...legacyOverrideModels(json)].filter((m, i, a) => a.indexOf(m) === i);
      }
      this.optionsCache.set(id, o);
    }
    return o;
  }

  itemOptions(id: string): string[] {
    const o = this.options(id);
    if (!o.length) return [];
    if (typeof o[0] === 'string') {
      return (o as string[]).map((m, i) => (i === 0 ? 'Default' : prettyVariant(id, m)));
    }
    return (o as ItemOption[]).map((x, i) => x.label || (i === 0 ? 'Default' : prettyVariant(id, leafModel(x) ?? `${i}`)));
  }

  resolveItem(id: string, option: number): RawView {
    const o = this.options(id);
    if (!o.length) return { shape: 'special', quads: [], sprite: [], category: 'item', note: 'This item has no model.' };
    const i = Math.max(0, Math.min(o.length - 1, option));
    if (typeof o[0] === 'string') {
      const model = this.models.resolve((o as string[])[i]);
      return this.itemModelView(id, model, (t) => legacyItemTint(id, t), [0, 0, 0]);
    }
    const opt = (o as ItemOption[])[i];
    const views = opt.leaves.map(({ leaf, offset }) => {
      if (leaf.kind === 'model') return this.itemModelView(id, this.models.resolve(leaf.model), (t) => leaf.tints[t] ?? null, offset);
      if (leaf.kind === 'special') return this.specialItemView(id, leaf.type, leaf.texture, leaf.base, leaf.props);
      return { shape: 'special', quads: [], sprite: [], category: 'item', note: 'Nothing is drawn for this state.' } as RawView;
    });
    if (views.length === 1) return views[0];
    const quads = views.flatMap((v) => v.quads);
    if (quads.length) return { shape: 'model', quads, sprite: [], category: 'item', note: views.find((v) => v.note)?.note };
    return views[0];
  }

  private itemModelView(id: string, model: ResolvedModel, tint: (i: number) => Tint | null, offset: Vec3): RawView {
    if (model.elements) {
      const quads = bakeModel(model, { offset, tint });
      return { shape: 'model', quads, sprite: [], category: 'item' };
    }
    if (model.builtin === 'generated') {
      const sprite: SpriteLayer[] = [];
      for (let i = 0; i < 16; i++) {
        const ref = resolveRef(model.textures, `layer${i}`);
        if (!ref) break;
        sprite.push({ path: javaTexturePath(ref), role: `layer${i}`, tint: tint(i) });
      }
      if (sprite.length) return { shape: 'sprite', quads: [], sprite, category: 'item' };
    }
    if (model.builtin === 'entity') {
      const quads = this.legacyEntityItemQuads(id);
      if (quads?.length) return { shape: 'model', quads, sprite: [], category: 'item', note: ITEM_ENTITY_NOTE };
    }
    return this.specialItemView(id, '', undefined, model.id, {});
  }

  /** Items drawn by the game before item definitions (builtin/entity): the block they stand for, or the shield / trident. */
  private legacyEntityItemQuads(id: string): BakedQuad[] | null {
    if (id === 'shield') return bakeEntityModel(SHIELD, mat4Scale(1, -1, -1), { texture: this.entitySource.find('entity/shield_base_nopattern', 'entity/shield/shield_base_nopattern') ?? this.entitySource.path('entity/shield_base_nopattern'), role: 'shield' });
    if (id === 'trident') return bakeEntityModel(TRIDENT, mat4Scale(1, -1, -1), { texture: this.entitySource.find('entity/trident', 'entity/trident/trident') ?? this.entitySource.path('entity/trident'), role: 'trident' });
    const skull = /^skull_(skeleton|wither|zombie|char|creeper|dragon)$/.exec(id);
    const target = skull
      ? { block: 'skull', state: { type: ({ wither: 'wither_skeleton', char: 'player' } as Record<string, string>)[skull[1]] ?? skull[1], facing: 'up', rotation: '8' } }
      : legacyEntityItemBlock(id);
    if (!target) return null;
    const e = this.entityBlock(target.block);
    if (!e) return null;
    return e.quads({ ...e.defaults, ...target.state });
  }

  private specialItemView(id: string, type: string, texture: string | undefined, base: string | null, props: Record<string, unknown>): RawView {
    if (type) {
      const quads = javaEntityItem(type, props, id, this.entitySource);
      if (quads) return { shape: 'model', quads, sprite: [], category: 'item', note: ITEM_ENTITY_NOTE };
    }
    const has = (rel: string) => {
      const p = `${MC}textures/${rel}.png`;
      return this.src.hasFile(p) ? p : null;
    };
    let paths: string[] = [];
    if (type === 'chest' && texture) paths = [has(`entity/chest/${splitId(texture)[1]}`)].filter((p): p is string => !!p);
    if (!paths.length) paths = specialTextures(type && type !== 'special' ? type : id, has);
    if (!paths.length) paths = specialTextures(id, has);
    if (!paths.length && base) {
      const m = this.models.resolve(base);
      const p = this.particleOf(m);
      if (p) paths = [p];
    }
    return {
      shape: 'special',
      quads: [],
      sprite: paths.map((p) => ({ path: p, role: 'entity', tint: null })),
      category: 'item',
      note: 'The game draws this item with its own model code. Its texture sheet is shown flat.',
    };
  }

  itemTexturePaths(id: string): string[] {
    const out = new Set<string>();
    const o = this.options(id);
    const fromModel = (ref: string) => {
      const m = this.models.resolve(ref);
      if (m.elements) for (const t of modelFaceTextures(m)) out.add(t.path);
      else if (m.builtin === 'generated') {
        for (let i = 0; i < 16; i++) {
          const r = resolveRef(m.textures, `layer${i}`);
          if (!r) break;
          out.add(javaTexturePath(r));
        }
      } else if (m.builtin === 'entity') for (const q of this.legacyEntityItemQuads(id) ?? []) if (q.texture) out.add(q.texture);
    };
    if (o.length && typeof o[0] === 'string') (o as string[]).forEach(fromModel);
    else
      for (const opt of o as ItemOption[])
        for (const { leaf } of opt.leaves) {
          if (leaf.kind === 'model') fromModel(leaf.model);
          else if (leaf.kind === 'special') {
            const v = this.specialItemView(id, leaf.type, leaf.texture, leaf.base, leaf.props);
            for (const q of v.quads) if (q.texture) out.add(q.texture);
            for (const s of v.sprite) out.add(s.path);
          }
        }
    if (!out.size) {
      const v = this.resolveItem(id, 0);
      for (const q of v.quads) if (q.texture) out.add(q.texture);
      for (const s of v.sprite) out.add(s.path);
    }
    return [...out];
  }
}

const ITEM_ENTITY_NOTE = 'The game draws this item with its own model code. Shown with the same shapes and texture sheet.';

/** Texture paths, roles and faces of a model's elements (no geometry). */
function modelFaceTextures(model: ResolvedModel): { path: string; role: string; dir: string }[] {
  const out: { path: string; role: string; dir: string }[] = [];
  for (const el of model.elements ?? [])
    for (const [dir, f] of Object.entries(el.faces)) {
      if (!f) continue;
      const { ref, role } = faceTexture(model, f.texture, dir as Dir);
      if (ref) out.push({ path: javaTexturePath(ref), role, dir });
    }
  return out;
}

function leafModel(o: ItemOption): string | null {
  for (const l of o.leaves) if (l.leaf.kind === 'model') return l.leaf.model;
  return null;
}

function prettyVariant(itemId: string, model: string): string {
  const name = splitId(model)[1].replace(/^(item|block)\//, '');
  const rest = name.startsWith(`${itemId}_`) ? name.slice(itemId.length + 1) : name;
  return rest.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

function resolveRef(textures: Record<string, string>, key: string): string | null {
  let v: string | undefined = textures[key];
  for (let i = 0; i < 16 && v?.startsWith('#'); i++) v = textures[v.slice(1)];
  return v && !v.startsWith('#') ? v : null;
}

function categorize(quads: BakedQuad[], models: ResolvedModel[]): ModelCategory {
  if (models.some((m) => m.chain.some((c) => PLANT_PARENTS.test(c)))) return 'plant';
  if (quads.length && quads.every((q) => q.worldDir === null || q.worldDir === 'up' || q.worldDir === 'down') && quads.some((q) => q.worldDir === null)) return 'plant';
  const full = quads.every((q) => q.positions.every((p) => p.every((c) => c === 0 || c === 1)));
  if (full && quads.length >= 6) return 'cube';
  return 'shape';
}

const COLORS = DYE_COLORS as readonly string[];

/**
 * Texture sheets of blocks and items the game draws with its own model code (entity-style), newest
 * paths first. `has` maps a path relative to textures/ (no extension) to a pack path, or null. Used
 * when no entity model is known for them.
 */
export function specialTextures(id: string, has: (rel: string) => string | null): string[] {
  const pick = (...rels: string[]): string[] => {
    for (const r of rels) {
      const p = has(r);
      if (p) return [p];
    }
    return [];
  };
  let m: RegExpExecArray | null;
  if (id === 'chest' || id === 'normal') return pick('entity/chest/normal');
  if (id === 'trapped_chest' || id === 'trapped') return pick('entity/chest/trapped');
  if (id === 'ender_chest' || id === 'ender') return pick('entity/chest/ender');
  if ((m = /^(?:waxed_)?(exposed_|weathered_|oxidized_)?copper_chest$/.exec(id))) return pick(`entity/chest/copper${m[1] ? `_${m[1].slice(0, -1)}` : ''}`);
  if ((m = /^(?:waxed_)?(exposed_|weathered_|oxidized_)?copper_golem_statue$/.exec(id)) || id === 'copper_golem_statue')
    return pick(`entity/copper_golem/copper_golem${m?.[1] ? `_${m[1].slice(0, -1)}` : ''}`);
  if ((m = /^(\w+)_shulker_box$/.exec(id))) return pick(`entity/shulker/shulker_${m[1]}`, `entity/shulker/shulker_${m[1] === 'light_gray' ? 'silver' : m[1]}`, 'entity/shulker/shulker');
  if (id === 'shulker_box') return pick('entity/shulker/shulker', 'entity/shulker/shulker_purple');
  if (/(^|_)(wall_)?banner$/.test(id) || id === 'banner') return pick('entity/banner/banner_base', 'entity/banner_base');
  if (/^(wither_)?skeleton_(wall_)?skull$/.test(id)) return pick(id.startsWith('wither') ? 'entity/skeleton/wither_skeleton' : 'entity/skeleton/skeleton');
  if (/^zombie_(wall_)?head$/.test(id)) return pick('entity/zombie/zombie');
  if (/^creeper_(wall_)?head$/.test(id)) return pick('entity/creeper/creeper');
  if (/^dragon_(wall_)?head$/.test(id)) return pick('entity/enderdragon/dragon');
  if (/^piglin_(wall_)?head$/.test(id)) return pick('entity/piglin/piglin');
  if (/^player_(wall_)?head$/.test(id) || id === 'player_head') return pick('entity/player/wide/steve', 'entity/steve');
  if (id === 'skull' || id === 'head') return pick('entity/skeleton/skeleton');
  if (id === 'conduit') return pick('entity/conduit/base');
  if (id === 'decorated_pot') return [...pick('entity/decorated_pot/decorated_pot_base'), ...pick('entity/decorated_pot/decorated_pot_side')];
  if (id === 'end_portal' || id === 'end_gateway') return pick('entity/end_portal/end_portal', 'entity/end_portal');
  if ((m = /^(\w+)_bed$/.exec(id)) && COLORS.includes(m[1])) return pick(`entity/bed/${m[1]}`);
  if (id === 'bed') return pick('entity/bed/red');
  if ((m = /^(\w+?)_(?:wall_)?hanging_sign$/.exec(id))) return pick(`entity/signs/hanging/${m[1]}`);
  if ((m = /^(\w+?)_(?:wall_)?sign$/.exec(id))) return pick(`entity/signs/${m[1]}`, 'entity/sign');
  if (id === 'standing_sign' || id === 'wall_sign' || id === 'sign') return pick('entity/sign', 'entity/signs/oak');
  if (id === 'shield') return pick('entity/shield/shield_base_nopattern', 'entity/shield_base_nopattern');
  if (id === 'trident') return pick('entity/trident/trident', 'entity/trident');
  if (id === 'bell') return pick('entity/bell/bell_body');
  if (id === 'water' || id === 'flowing_water' || id === 'bubble_column') return pick('block/water_still', 'blocks/water_still');
  if (id === 'lava' || id === 'flowing_lava') return pick('block/lava_still', 'blocks/lava_still');
  return [];
}

/** Model JSON paths a Java library needs (blockstates, block/item models, item definitions). */
export function javaModelFiles(listFiles: (prefix: string) => string[]): string[] {
  return [`${MC}blockstates/`, `${MC}models/`, `${MC}items/`].flatMap((p) => listFiles(p).filter((f) => f.endsWith('.json')));
}

export { modelPath };
