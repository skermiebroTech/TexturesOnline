// Switches PvP / FPS tweaks on and off in an open texture pack. A tweak writes ordinary pack files
// (textures, model files, .mcmeta) through the editor's store, so they can still be painted or edited
// in the model editor, and remembers what the pack had before (project.pvp). Switching it off puts
// back only the files nobody changed since; files painted or edited afterwards are kept. Every change
// can be undone as a whole. The FPS tweaks are effect layers (the whole pack, on export).

import type { EffectLayer, PvpApplied, PvpState, TexturePackProject } from '../../../core/types';
import { createLayer } from '../effects';
import { newLayerId, parseJsonLoose } from '../project';
import { prettyJson } from '../models/doc';
import { JavaModelSet, itemDefinitionPath, modelId, modelPath, type DisplayTransform } from '../../../shared/models/java-models';
import type { TexStore } from '../ui/store';
import {
  EFFECT_TWEAKS,
  PRESET_FPS_TWEAKS,
  PRESET_TWEAKS,
  canKeepFireBlocks,
  clearGlassImage,
  crosshairTarget,
  emptyImage,
  fireModelUsingCopy,
  fireOverlayPath,
  firstPersonModels,
  firstPersonSlots,
  glassTextures,
  imageHash,
  javaPvpRules,
  legacyFirstPersonModels,
  lowFireImage,
  lowerShield,
  optionsFor,
  ownSlot,
  pumpkinPath,
  sameJson,
  smallerHeld,
  transformJson,
  tweakSupport,
  weaponItems,
  withCrosshair,
  withDisplay,
  worldFirePath,
  type PvpOptions,
  type PvpTweakId,
} from './tweaks';

export interface TweakChange {
  /** Textures written or put back */
  textures: string[];
  /** Other files written or put back */
  files: string[];
  /** Files left as they are because they were changed after the tweak wrote them */
  kept: number;
}

const jsonBlob = (text: string) => new Blob([text], { type: 'application/json' });
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** What a change touched, to undo it: the pack's copies of those files, the effects and the tweak list. */
class Transaction {
  private overrides = new Map<string, Blob | null>();
  private extra = new Map<string, Blob | null>();
  private readonly pvp: PvpState | undefined;
  private readonly effects: EffectLayer[];
  readonly change: TweakChange = { textures: [], files: [], kept: 0 };
  readonly entries: { kind: 'block' | 'item'; id: string }[] = [];
  /** The tweaks this change switched or changed (an undo puts back only theirs) */
  readonly ids = new Set<PvpTweakId>();

  constructor(private readonly store: TexStore) {
    const p = store.project;
    this.pvp = p.pvp ? { ...p.pvp, tweaks: { ...p.pvp.tweaks } } : undefined;
    this.effects = p.effects.map((l) => ({ ...l, params: { ...l.params }, ...(l.categories ? { categories: [...l.categories] } : {}) }));
  }

  private get project(): TexturePackProject {
    return this.store.project;
  }

  setImage(path: string, img: ImageData): void {
    if (!this.overrides.has(path)) this.overrides.set(path, this.project.overrides[path] ?? null);
    this.store.setImage(path, img);
    if (!this.change.textures.includes(path)) this.change.textures.push(path);
  }

  setOverride(path: string, blob: Blob | null): void {
    if (!this.overrides.has(path)) this.overrides.set(path, this.project.overrides[path] ?? null);
    this.store.setOverrideBlob(path, blob);
    if (!this.change.textures.includes(path)) this.change.textures.push(path);
  }

  /** Writes (null: removes) a pack file now; the previews hear of all of them at commit(). */
  setFile(path: string, blob: Blob | null): void {
    if (!this.extra.has(path)) this.extra.set(path, this.project.extraFiles[path] ?? null);
    if (blob) this.project.extraFiles[path] = blob;
    else delete this.project.extraFiles[path];
    if (!this.change.files.includes(path)) this.change.files.push(path);
  }

  private effectsChanged(): boolean {
    return JSON.stringify(this.project.effects.map((l) => [l.type, l.enabled, l.params, l.categories])) !== JSON.stringify(this.effects.map((l) => [l.type, l.enabled, l.params, l.categories]));
  }

  /** Saves the change and tells the panels. */
  commit(): void {
    const files: Record<string, Blob | null> = {};
    for (const path of this.extra.keys()) files[path] = this.project.extraFiles[path] ?? null;
    this.store.setExtraFiles(files, this.entries);
    this.store.touch(this.effectsChanged() ? 'effects' : null);
  }

  /** Puts everything this change touched back as it was. */
  undo(): void {
    const p = this.project;
    for (const [path, blob] of this.overrides) this.store.setOverrideBlob(path, blob);
    if (this.extra.size) this.store.setExtraFiles(Object.fromEntries(this.extra), this.entries);
    // only this change's tweaks go back (later changes to other tweaks stay as they are)
    const tweaks = { ...(p.pvp?.tweaks ?? {}) };
    for (const id of this.ids) {
      const old = this.pvp?.tweaks[id];
      if (old) tweaks[id] = old;
      else delete tweaks[id];
    }
    if (Object.keys(tweaks).length || p.pvp?.pending) p.pvp = { ...(p.pvp ?? {}), tweaks };
    else delete p.pvp;
    const types = [...this.ids].map((id) => EFFECT_TWEAKS[id]).filter((t): t is string => !!t);
    const clone = (l: EffectLayer): EffectLayer => ({ ...l, params: { ...l.params }, ...(l.categories ? { categories: [...l.categories] } : {}) });
    const before = JSON.stringify(p.effects);
    if (types.length) p.effects = [...p.effects.filter((l) => !types.includes(l.type)), ...this.effects.filter((l) => types.includes(l.type)).map(clone)];
    this.store.touch(JSON.stringify(p.effects) !== before ? 'effects' : null);
  }
}

export interface PvpEngine {
  /** Whether a tweak is on in this pack */
  isOn(id: PvpTweakId): boolean;
  /** The tweak's choices (stored ones, else the defaults) */
  options<K extends PvpTweakId>(id: K): PvpOptions[K];
  /** Switches a tweak on (again, with new choices) or off. Resolves with what changed and an undo. */
  set<K extends PvpTweakId>(id: K, on: boolean, options?: Partial<PvpOptions[K]>): Promise<{ change: TweakChange; undo(): void }>;
  /** Switches on every supported tweak of the PvP preset (and the FPS ones) that is off. */
  applyPreset(fps: boolean): Promise<{ change: TweakChange; tweaks: PvpTweakId[]; undo(): void }>;
}

export function createPvpEngine(store: TexStore): PvpEngine {
  const project = store.project;
  const { edition, version } = project;
  const assets = store.assets;

  // ---------------------------------------------------------------- reading the pack over the game
  const jsonCache = new Map<string, unknown>();
  async function readJson(path: string): Promise<unknown> {
    const own = project.extraFiles[path];
    if (own) {
      try {
        return parseJsonLoose(await own.text()) ?? undefined;
      } catch {
        return undefined;
      }
    }
    if (jsonCache.has(path)) return structuredClone(jsonCache.get(path));
    let v: unknown;
    try {
      v = assets.hasFile(path) ? (parseJsonLoose(await assets.readText(path)) ?? undefined) : undefined;
    } catch {
      v = undefined;
    }
    jsonCache.set(path, v);
    return structuredClone(v);
  }

  async function readText(path: string): Promise<string | null> {
    const own = project.extraFiles[path];
    if (own) return own.text().catch(() => null);
    if (!assets.hasFile(path)) return null;
    return assets.readText(path).catch(() => null);
  }

  /** The model with its parents read, resolved the way the game merges them. */
  async function resolveModel(id: string) {
    const files = new Map<string, unknown>();
    let cur: string | null = modelId(id);
    for (let n = 0; cur && n < 32; n++) {
      if (cur.split(':')[1]?.startsWith('builtin/')) break;
      const path = modelPath(cur);
      if (files.has(path)) break;
      const j = await readJson(path);
      files.set(path, j);
      cur = isObj(j) && typeof j.parent === 'string' ? modelId(j.parent) : null;
    }
    return new JavaModelSet((p) => files.get(p)).resolve(id);
  }

  const hasTexture = (path: string) => !!project.overrides[path] || assets.hasFile(path);

  // ---------------------------------------------------------------- state
  const state = (): PvpState => (project.pvp ??= { tweaks: {} });
  const effectLayers = (id: PvpTweakId) => project.effects.filter((l) => l.type === EFFECT_TWEAKS[id]);

  function isOn(id: PvpTweakId): boolean {
    if (EFFECT_TWEAKS[id]) return effectLayers(id).some((l) => l.enabled);
    return !!project.pvp?.tweaks[id];
  }

  function options<K extends PvpTweakId>(id: K): PvpOptions[K] {
    if (id === 'lowRes') {
      const l = effectLayers(id)[0];
      if (l) return optionsFor(id, { scope: l.categories?.includes('item') ? 'all' : 'blocks' });
    }
    return optionsFor(id, project.pvp?.tweaks[id]?.options);
  }

  // ---------------------------------------------------------------- switching off
  async function revert(id: PvpTweakId, tx: Transaction): Promise<void> {
    if (EFFECT_TWEAKS[id]) {
      project.effects = project.effects.filter((l) => l.type !== EFFECT_TWEAKS[id]);
      return;
    }
    const rec = project.pvp?.tweaks[id];
    if (!rec) return;
    for (const t of rec.textures) {
      let hash: string | null = null;
      try {
        hash = imageHash(await store.getFull(t.path));
      } catch {
        hash = null;
      }
      if (hash === t.hash) tx.setOverride(t.path, t.before);
      else tx.change.kept++;
    }
    for (const f of rec.files) {
      const cur = project.extraFiles[f.path];
      const text = cur ? await cur.text().catch(() => null) : null;
      if (text === f.text) tx.setFile(f.path, f.before);
      else tx.change.kept++;
    }
    for (const d of rec.displays) {
      const cur = project.extraFiles[d.path];
      const text = cur ? await cur.text().catch(() => null) : null;
      if (text === null) {
        tx.change.kept++;
        continue;
      }
      if (text === d.text) {
        tx.setFile(d.path, d.before);
        continue;
      }
      // edited since (the model editor): only the slots still as the tweak set them go back
      const json = parseJsonLoose(text);
      if (!isObj(json)) {
        tx.change.kept++;
        continue;
      }
      const back: Record<string, unknown> = {};
      for (const [slot, v] of Object.entries(d.slots)) if (sameJson(ownSlot(json, slot), v)) back[slot] = d.prev[slot] ?? null;
      if (!Object.keys(back).length) {
        tx.change.kept++;
        continue;
      }
      tx.setFile(d.path, jsonBlob(prettyJson(withDisplay(json, back))));
    }
    const tweaks = state().tweaks;
    delete tweaks[id];
  }

  // ---------------------------------------------------------------- switching on
  async function paint(rec: PvpApplied, tx: Transaction, path: string, make: (img: ImageData) => ImageData): Promise<boolean> {
    if (!hasTexture(path)) return false;
    const img = make(await store.getFull(path));
    rec.textures.push({ path, before: project.overrides[path] ?? null, hash: imageHash(img) });
    tx.setImage(path, img);
    return true;
  }

  function writeFile(rec: PvpApplied, tx: Transaction, path: string, text: string): void {
    rec.files.push({ path, before: project.extraFiles[path] ?? null, text });
    tx.setFile(path, jsonBlob(text));
  }

  /** Display slots of the models an item shows in first person, changed by `fn`. */
  async function changeHeld(rec: PvpApplied, tx: Transaction, items: string[], fn: (t: DisplayTransform) => DisplayTransform): Promise<void> {
    const rules = javaPvpRules(version);
    const slots = firstPersonSlots(version);
    const done = new Set<string>();
    for (const item of items) {
      const models = rules.itemDefinitions
        ? firstPersonModels(await readJson(itemDefinitionPath(item)))
        : legacyFirstPersonModels(item, await readJson(modelPath(`minecraft:item/${item}`)));
      for (const m of models) {
        const path = modelPath(m);
        if (done.has(path)) continue;
        done.add(path);
        const file = await readJson(path);
        if (!isObj(file)) continue;
        const resolved = await resolveModel(m);
        const written: Record<string, unknown> = {};
        const prev: Record<string, unknown> = {};
        for (const slot of slots) {
          const cur = resolved.display?.[slot];
          if (!cur) continue;
          written[slot] = transformJson(fn(cur));
          prev[slot] = ownSlot(file, slot);
        }
        if (!Object.keys(written).length) continue;
        const text = prettyJson(withDisplay(file, written));
        rec.displays.push({ path, before: project.extraFiles[path] ?? null, prev, slots: written, text });
        tx.entries.push({ kind: 'item', id: item });
        tx.setFile(path, jsonBlob(text));
      }
    }
  }

  async function apply<K extends PvpTweakId>(id: K, opts: PvpOptions[K], tx: Transaction): Promise<void> {
    const effect = EFFECT_TWEAKS[id];
    if (effect) {
      const o = opts as PvpOptions['lowRes'];
      const layer = createLayer(effect, effect === 'downscale' ? { size: '8' } : {});
      if (effect === 'downscale') layer.categories = o.scope === 'all' ? ['block', 'item'] : ['block'];
      project.effects = [...project.effects.filter((l) => l.type !== effect), { ...layer, id: newLayerId() }];
      return;
    }
    const rec: PvpApplied = { options: { ...(opts as Record<string, string | boolean>) }, textures: [], files: [], displays: [], appliedAt: Date.now() };
    switch (id) {
      case 'lowFire': {
        const o = opts as PvpOptions['lowFire'];
        const overlay = fireOverlayPath(version);
        if (!hasTexture(overlay)) break;
        if (o.keepBlocks && canKeepFireBlocks(edition, version)) {
          // fire blocks keep their flames: their models use a copy of the texture as it was
          const world = worldFirePath(version);
          const base = await store.getFull(overlay);
          rec.textures.push({ path: world, before: project.overrides[world] ?? null, hash: imageHash(base) });
          tx.setImage(world, base);
          const meta = await readText(`${overlay}.mcmeta`);
          if (meta !== null) writeFile(rec, tx, `${world}.mcmeta`, meta);
          tx.entries.push({ kind: 'block', id: 'fire' });
          const dir = 'assets/minecraft/models/block/';
          const names = new Set([...assets.listFiles(dir), ...Object.keys(project.extraFiles).filter((p) => p.startsWith(dir))]);
          for (const path of [...names].sort()) {
            if (!/\/fire_[a-z0-9_]*\.json$/.test(path)) continue;
            const next = fireModelUsingCopy(await readJson(path));
            if (next) writeFile(rec, tx, path, prettyJson(next));
          }
        }
        await paint(rec, tx, overlay, (img) => lowFireImage(img, o.height));
        break;
      }
      case 'clearGlass': {
        const o = opts as PvpOptions['clearGlass'];
        for (const g of glassTextures(edition, version)) await paint(rec, tx, g.path, (img) => clearGlassImage(img, g.stained, o.mode));
        break;
      }
      case 'noPumpkin':
        await paint(rec, tx, pumpkinPath(edition), emptyImage);
        break;
      case 'crosshair': {
        const o = opts as PvpOptions['crosshair'];
        const t = crosshairTarget(edition, version);
        await paint(rec, tx, t.path, (img) => withCrosshair(img, t.kind, o.design));
        break;
      }
      case 'swords': {
        const o = opts as PvpOptions['swords'];
        const dir = 'assets/minecraft/models/item/';
        const files = [...assets.listFiles(dir), ...Object.keys(project.extraFiles).filter((p) => p.startsWith(dir))];
        const legacy = javaPvpRules(version).legacyDisplay;
        await changeHeld(rec, tx, weaponItems(files, o.scope), (t) => smallerHeld(t, o.size, legacy));
        break;
      }
      case 'shield': {
        const o = opts as PvpOptions['shield'];
        await changeHeld(rec, tx, ['shield'], (t) => lowerShield(t, o.height));
        break;
      }
    }
    state().tweaks[id] = rec;
  }

  async function run(work: (tx: Transaction) => Promise<void>): Promise<{ change: TweakChange; undo(): void }> {
    await store.flush();
    const tx = new Transaction(store);
    try {
      await work(tx);
    } catch (err) {
      tx.undo();
      throw err;
    }
    if (project.pvp && !Object.keys(project.pvp.tweaks).length && !project.pvp.pending) delete project.pvp;
    tx.commit();
    return { change: tx.change, undo: () => tx.undo() };
  }

  return {
    isOn,
    options,
    set(id, on, opts) {
      return run(async (tx) => {
        if (tweakSupport(id, edition, version)) throw new Error(`The ${id} tweak isn't available for this version.`);
        tx.ids.add(id);
        const next = optionsFor(id, { ...(options(id) as Record<string, unknown>), ...(opts ?? {}) });
        await revert(id, tx);
        if (on) await apply(id, next, tx);
      });
    },
    async applyPreset(fps) {
      const tweaks: PvpTweakId[] = [];
      const res = await run(async (tx) => {
        for (const id of [...PRESET_TWEAKS, ...(fps ? PRESET_FPS_TWEAKS : [])]) {
          if (tweakSupport(id, edition, version) || isOn(id)) continue;
          tx.ids.add(id);
          await apply(id, optionsFor(id, undefined), tx);
          tweaks.push(id);
        }
        if (project.pvp) delete project.pvp.pending;
      });
      return { ...res, tweaks };
    },
  };
}
