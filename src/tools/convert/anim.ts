// Animation conversion between Java (.png.mcmeta) and Bedrock (textures/flipbook_textures.json).
// Pure functions, no DOM.

/** The parts of a Java "animation" section the converter understands. */
export interface JavaAnimation {
  frametime: number;
  interpolate: boolean;
  /** Explicit frame size (pixels), when given */
  width?: number;
  height?: number;
  /** Frame order with per-frame times in ticks, when the .mcmeta lists frames */
  frames?: { index: number; time: number }[];
}

/** One entry of Bedrock's flipbook_textures.json. */
export interface FlipbookEntry {
  flipbook_texture: string;
  atlas_tile: string;
  atlas_index?: number;
  atlas_tile_variant?: number;
  ticks_per_frame?: number;
  frames?: number[];
  blend_frames?: boolean;
  replicate?: number;
  [key: string]: unknown;
}

const posInt = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : undefined);

/** The animation section of a Java .mcmeta (null when there is none). */
export function parseJavaAnimation(json: unknown): JavaAnimation | null {
  const a = (json as { animation?: unknown } | null)?.animation;
  if (!a || typeof a !== 'object' || Array.isArray(a)) return null;
  const o = a as Record<string, unknown>;
  const frametime = posInt(o.frametime) ?? 1;
  const out: JavaAnimation = { frametime, interpolate: o.interpolate === true };
  const w = posInt(o.width);
  const h = posInt(o.height);
  if (w) out.width = w;
  if (h) out.height = h;
  if (Array.isArray(o.frames)) {
    const frames: { index: number; time: number }[] = [];
    for (const f of o.frames) {
      if (typeof f === 'number' && Number.isInteger(f) && f >= 0) frames.push({ index: f, time: frametime });
      else if (f && typeof f === 'object') {
        const idx = (f as { index?: unknown }).index;
        if (typeof idx === 'number' && Number.isInteger(idx) && idx >= 0) frames.push({ index: idx, time: posInt((f as { time?: unknown }).time) ?? frametime });
      }
    }
    if (frames.length) out.frames = frames;
  }
  return out;
}

/** Frame size of an animated Java texture exactly as the game computes it. */
export function javaFrameSize(anim: Pick<JavaAnimation, 'width' | 'height'>, w: number, h: number): { fw: number; fh: number } {
  if (anim.width && anim.height) return { fw: anim.width, fh: anim.height };
  if (anim.width) return { fw: anim.width, fh: h };
  if (anim.height) return { fw: w, fh: anim.height };
  const m = Math.min(w, h);
  return { fw: m, fh: m };
}

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}

/**
 * A Bedrock flipbook entry for a Java animation. Bedrock has one speed per texture, so per-frame
 * times become repeated frames at the common tick rate. Bedrock blends frames by default; Java
 * only with "interpolate", so blend_frames is always written.
 */
export function javaToFlipbook(anim: JavaAnimation, frameCount: number, target: { stem: string; atlasTile: string; extra?: Partial<FlipbookEntry> }): FlipbookEntry {
  const entry: FlipbookEntry = { flipbook_texture: target.stem, atlas_tile: target.atlasTile, ...(target.extra ?? {}) };
  const frames = (anim.frames ?? []).filter((f) => f.index < frameCount);
  let ticks = anim.frametime;
  let order: number[] | undefined;
  if (frames.length) {
    ticks = frames.reduce((g, f) => gcd(g, f.time), frames[0].time);
    order = frames.flatMap((f) => Array<number>(Math.max(1, Math.round(f.time / ticks))).fill(f.index));
    const sequential = order.length === frameCount && order.every((v, i) => v === i);
    if (sequential) order = undefined;
  }
  entry.ticks_per_frame = Math.max(1, ticks);
  if (order) entry.frames = order;
  else delete entry.frames;
  entry.blend_frames = anim.interpolate;
  return entry;
}

/**
 * A Java .mcmeta "animation" object for a Bedrock flipbook entry. Runs of a repeated frame become
 * one frame with a longer time.
 */
export function flipbookToJava(entry: Pick<FlipbookEntry, 'ticks_per_frame' | 'frames' | 'blend_frames'>, frameCount: number): { animation: Record<string, unknown> } {
  const ticks = posInt(entry.ticks_per_frame) ?? 1;
  const animation: Record<string, unknown> = { frametime: ticks };
  if (entry.blend_frames !== false) animation.interpolate = true;
  const raw = Array.isArray(entry.frames) ? entry.frames.filter((f): f is number => typeof f === 'number' && Number.isInteger(f) && f >= 0 && f < frameCount) : [];
  if (raw.length) {
    const runs: { index: number; n: number }[] = [];
    for (const f of raw) {
      const last = runs[runs.length - 1];
      if (last && last.index === f) last.n++;
      else runs.push({ index: f, n: 1 });
    }
    const sequential = runs.length === frameCount && runs.every((r, i) => r.index === i && r.n === 1);
    if (!sequential) animation.frames = runs.map((r) => (r.n === 1 ? r.index : { index: r.index, time: r.n * ticks }));
  }
  return { animation };
}

/** Flipbook entries from a flipbook_textures.json value, keyed by texture stem ('textures/blocks/fire_0'). */
export function flipbookEntries(json: unknown): Map<string, FlipbookEntry> {
  const out = new Map<string, FlipbookEntry>();
  if (!Array.isArray(json)) return out;
  for (const e of json) {
    if (!e || typeof e !== 'object') continue;
    const tex = (e as { flipbook_texture?: unknown }).flipbook_texture;
    const tile = (e as { atlas_tile?: unknown }).atlas_tile;
    if (typeof tex !== 'string' || typeof tile !== 'string') continue;
    const stem = tex.replace(/\.(png|tga)$/i, '');
    if (!out.has(stem)) out.set(stem, { ...(e as FlipbookEntry), flipbook_texture: stem });
  }
  return out;
}

/**
 * Terrain atlas tiles from terrain_texture.json: texture stem -> tile name (and its index when the
 * tile lists several textures). Only block textures in this atlas can be flipbooks.
 */
export function terrainTiles(json: unknown): Map<string, { tile: string; index?: number }> {
  const out = new Map<string, { tile: string; index?: number }>();
  const data = (json as { texture_data?: unknown } | null)?.texture_data;
  if (!data || typeof data !== 'object') return out;
  const pathOf = (v: unknown): string | null => (typeof v === 'string' ? v : v && typeof v === 'object' && typeof (v as { path?: unknown }).path === 'string' ? (v as { path: string }).path : null);
  for (const [tile, def] of Object.entries(data as Record<string, unknown>)) {
    const t = (def as { textures?: unknown } | null)?.textures;
    const list = Array.isArray(t) ? t : [t];
    list.forEach((v, i) => {
      const p = pathOf(v);
      if (!p) return;
      const stem = p.replace(/\.(png|tga)$/i, '');
      if (!out.has(stem)) out.set(stem, Array.isArray(t) && t.length > 1 ? { tile, index: i } : { tile });
    });
  }
  return out;
}
