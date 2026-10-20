// What each Java version accepts in a model file, and checks that tell the user (in plain words) when a
// model would fail to load or look wrong in game. Pure.

import { bundledPackFormat, comparePackFormats } from '../../../editions/java/packformats';
import type { PackFormat } from '../../../core/types';
import { DIRS, type Dir } from '../../../shared/models/geometry';
import { javaTexturePath, resolveTextureVar } from '../../../shared/models/java-models';
import type { EditModel } from './doc';

export interface ModelRules {
  /** Models are JSON files (1.8+); older versions draw blocks with code */
  models: boolean;
  /**
   * Cube rotation: 'steps' = one axis, -45 / -22.5 / 0 / 22.5 / 45 (1.8 - 1.21.5); 'range' = one axis,
   * any angle from -45 to 45 (1.21.6 - 1.21.10); 'free' = any angle, or x / y / z together (1.21.11+)
   */
  rotation: 'steps' | 'range' | 'free';
  /** 1.8 names its hand slots "thirdperson" / "firstperson" (no left / right) */
  legacyDisplay: boolean;
  /** "gui_light" (1.15+) */
  guiLight: boolean;
  /** Item model definitions in assets/minecraft/items (1.21.4+) */
  itemDefinitions: boolean;
  /** The "on_shelf" display slot (1.21.9+) */
  onShelf: boolean;
}

export const ROTATION_STEPS = [-45, -22.5, 0, 22.5, 45] as const;

const F = (id: string): PackFormat => bundledPackFormat(id)!;

/** Pack format of a version (null when unknown, e.g. a newer snapshot: newest rules then). */
function formatOf(version: string): PackFormat | null {
  return bundledPackFormat(version.trim());
}

export function modelRules(version: string): ModelRules {
  const f = formatOf(version);
  const atLeast = (id: string) => !f || comparePackFormats(f, F(id)) >= 0;
  const legacy = /^1\.(\d+)(\.\d+)?$/.exec(version.trim());
  const minor = legacy ? Number(legacy[1]) : 99;
  return {
    models: minor >= 8,
    rotation: atLeast('1.21.11') ? 'free' : atLeast('1.21.6') ? 'range' : 'steps',
    legacyDisplay: minor === 8,
    guiLight: atLeast('1.15'),
    itemDefinitions: atLeast('1.21.4'),
    onShelf: atLeast('1.21.9'),
  };
}

/** Nearest angle the version allows (for 'steps' the nearest of the five). */
export function allowedAngle(rules: ModelRules, angle: number): number {
  if (!Number.isFinite(angle)) return 0;
  if (rules.rotation === 'steps') {
    let best = 0;
    for (const s of ROTATION_STEPS) if (Math.abs(s - angle) < Math.abs(best - angle)) best = s;
    return best;
  }
  if (rules.rotation === 'range') return Math.max(-45, Math.min(45, angle));
  return angle;
}

/** Display slot names for the hands in this version. */
export function handSlot(rules: ModelRules, slot: 'thirdperson_righthand' | 'firstperson_righthand'): string {
  return rules.legacyDisplay ? slot.replace('_righthand', '') : slot;
}

export interface ModelIssue {
  level: 'error' | 'warning';
  message: string;
  /** Cube it is about (index) */
  element?: number;
  face?: Dir;
}

export interface ValidateContext {
  rules: ModelRules;
  /** The pack or the game has this texture file (pack path) */
  hasTexture(path: string): boolean;
  /**
   * Texture folders the game's atlases take model textures from ('block/', 'item/'...), null when every
   * texture works (before 1.19.3)
   */
  atlasDirs?: string[] | null;
}

const MIN = -16;
const MAX = 32;

/**
 * Problems that stop the game loading the model (errors) or make it look wrong (warnings), worded for
 * people, with the cube they are about.
 */
export function validateModel(m: EditModel, ctx: ValidateContext): ModelIssue[] {
  const out: ModelIssue[] = [];
  const { rules } = ctx;
  const cube = (i: number) => m.elements[i]?.name ? `“${m.elements[i].name}”` : `Cube ${i + 1}`;
  if (!m.elements.length) out.push({ level: 'warning', message: 'This model has no cubes, so it is invisible in game.' });
  const missingVars = new Set<string>();
  const missingFiles = new Set<string>();
  const outsideAtlas = new Set<string>();
  m.elements.forEach((e, i) => {
    const coords = [...e.from, ...e.to];
    if (coords.some((v) => !Number.isFinite(v))) out.push({ level: 'error', element: i, message: `${cube(i)} has a position that isn't a number.` });
    else if (coords.some((v) => v < MIN || v > MAX)) out.push({ level: 'error', element: i, message: `${cube(i)} reaches outside the space the game allows (-16 to 32 on each axis), so the model won't load.` });
    const faces = DIRS.filter((d) => e.faces[d]);
    if (!faces.length) out.push({ level: 'error', element: i, message: `${cube(i)} has no faces. The game only loads cubes with at least one face.` });
    const r = e.rotation;
    if (r) {
      if (!r.axis) {
        if (rules.rotation !== 'free') out.push({ level: 'error', element: i, message: `${cube(i)} turns on more than one axis, which needs Minecraft 1.21.11 or newer.` });
      } else {
        const a = r.angle ?? 0;
        if (rules.rotation === 'steps' && !(ROTATION_STEPS as readonly number[]).includes(a))
          out.push({ level: 'error', element: i, message: `${cube(i)} is turned ${a}°. This version only allows -45, -22.5, 0, 22.5 or 45.` });
        else if (rules.rotation === 'range' && (a < -45 || a > 45)) out.push({ level: 'error', element: i, message: `${cube(i)} is turned ${a}°. This version allows -45° to 45°.` });
      }
      if (r.origin.some((v) => !Number.isFinite(v))) out.push({ level: 'error', element: i, message: `${cube(i)} has a rotation centre that isn't a number.` });
    }
    for (const d of faces) {
      const f = e.faces[d]!;
      const name = f.texture.startsWith('#') ? f.texture.slice(1) : f.texture;
      const { ref } = resolveTextureVar(m.textures, name);
      if (!ref) {
        missingVars.add(name);
        continue;
      }
      if (ref === 'minecraft:missingno' || ref === 'missingno') continue;
      const path = javaTexturePath(ref);
      if (!ctx.hasTexture(path)) missingFiles.add(ref);
      else if (ctx.atlasDirs && !inAtlas(path, ctx.atlasDirs)) outsideAtlas.add(ref);
      if (f.uv && f.uv.some((v) => v < 0 || v > 16)) out.push({ level: 'warning', element: i, face: d, message: `The ${d} face of ${cube(i)} reaches outside its texture (UV 0 to 16), which shows stretched or repeated pixels.` });
    }
  });
  for (const v of missingVars) out.push({ level: 'error', message: `A face uses the texture “#${v}”, which isn't set. It shows as the magenta and black missing texture.` });
  for (const ref of missingFiles) out.push({ level: 'warning', message: `The texture “${ref}” isn't in the game or this pack. Faces using it show as magenta and black.` });
  for (const ref of outsideAtlas) out.push({ level: 'warning', message: `The texture “${ref}” isn't in a folder the game uses for models (${ctx.atlasDirs!.join(', ')}), so it shows as missing.` });
  for (const [slot, t] of Object.entries(m.display)) {
    if (t.translation.some((v) => Math.abs(v) > 80)) out.push({ level: 'warning', message: `The ${slotName(slot)} position goes past ±80, the most the game uses.` });
    if (t.scale.some((v) => Math.abs(v) > 4)) out.push({ level: 'warning', message: `The ${slotName(slot)} size goes past 4, the most the game uses.` });
  }
  return out;
}

function inAtlas(path: string, dirs: string[]): boolean {
  const rel = path.replace(/^assets\/[^/]+\/textures\//, '');
  return dirs.some((d) => (d.endsWith('/') ? rel.startsWith(d) : rel === `${d}.png` || rel === d));
}

/**
 * Model texture folders of a version's atlases (atlases/blocks.json and items.json: "directory"
 * sources as 'block/', "single" ones as a path), or null when the version has no atlas files.
 */
export function atlasDirsFrom(files: unknown[]): string[] | null {
  const out = new Set<string>();
  let any = false;
  for (const f of files) {
    if (!f || typeof f !== 'object' || !Array.isArray((f as { sources?: unknown }).sources)) continue;
    any = true;
    for (const s of (f as { sources: unknown[] }).sources) {
      if (!s || typeof s !== 'object') continue;
      const o = s as Record<string, unknown>;
      const type = typeof o.type === 'string' ? o.type.replace(/^minecraft:/, '') : '';
      if (type === 'directory' && typeof o.source === 'string') out.add(`${o.source.replace(/\/$/, '')}/`);
      else if (type === 'single' && typeof o.resource === 'string') out.add(o.resource.replace(/^minecraft:/, ''));
    }
  }
  return any ? [...out] : null;
}

const SLOT_NAMES: Record<string, string> = {
  gui: 'inventory',
  ground: 'on the ground',
  fixed: 'item frame',
  head: 'on the head',
  thirdperson_righthand: 'third person (right hand)',
  thirdperson_lefthand: 'third person (left hand)',
  firstperson_righthand: 'first person (right hand)',
  firstperson_lefthand: 'first person (left hand)',
  thirdperson: 'third person',
  firstperson: 'first person',
  on_shelf: 'on a shelf',
};

export function slotName(slot: string): string {
  return SLOT_NAMES[slot] ?? slot.replace(/_/g, ' ');
}
