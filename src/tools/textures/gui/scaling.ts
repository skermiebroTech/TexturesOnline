// How a GUI sprite stretches to other sizes. Pure (no DOM).
//
// Java 1.20.2+ says it in the sprite's .png.mcmeta: "gui": { "scaling": { "type": "stretch" | "tile" |
// "nine_slice", "width", "height", "border" (a number or left/top/right/bottom), "stretch_inner" } }.
// A nine-slice keeps its corners, repeats its edges and middle (or stretches them with
// stretch_inner). Bedrock UI textures have a .json beside them: { "nineslice_size": n | [l, t, r, b],
// "base_size": [w, h] }, and stretch their edges and middle.

export type Scaling =
  | { type: 'stretch' }
  | { type: 'tile'; width: number; height: number }
  | { type: 'nine'; width: number; height: number; border: [left: number, top: number, right: number, bottom: number]; stretch?: boolean };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** The stretch rule of a Java sprite's .png.mcmeta (null: none, drawn plainly). */
export function javaScaling(json: unknown): Scaling | null {
  const s = isObj(json) && isObj(json.gui) && isObj(json.gui.scaling) ? json.gui.scaling : null;
  if (!s) return null;
  const type = String(s.type ?? '').replace(/^minecraft:/, '');
  const w = typeof s.width === 'number' ? s.width : 0;
  const h = typeof s.height === 'number' ? s.height : 0;
  if (type === 'tile' && w > 0 && h > 0) return { type: 'tile', width: w, height: h };
  if (type === 'nine_slice' && w > 0 && h > 0) {
    const b = s.border;
    const n = (v: unknown) => (typeof v === 'number' && v >= 0 ? v : 0);
    const border: [number, number, number, number] = typeof b === 'number' ? [b, b, b, b] : isObj(b) ? [n(b.left), n(b.top), n(b.right), n(b.bottom)] : [0, 0, 0, 0];
    return { type: 'nine', width: w, height: h, border, ...(s.stretch_inner === true ? { stretch: true } : {}) };
  }
  return type === 'stretch' ? { type: 'stretch' } : null;
}

/** The stretch rule of a Bedrock UI texture's .json (null: none). */
export function bedrockScaling(json: unknown, img: { width: number; height: number }): Scaling | null {
  if (!isObj(json)) return null;
  const n = json.nineslice_size;
  const base = Array.isArray(json.base_size) && json.base_size.length === 2 ? (json.base_size as unknown[]).map(Number) : [img.width, img.height];
  const border: number[] | null = typeof n === 'number' ? [n, n, n, n] : Array.isArray(n) && n.length === 4 ? n.map(Number) : null;
  if (!border || border.some((v) => !Number.isFinite(v) || v < 0) || !(base[0] > 0) || !(base[1] > 0)) return null;
  return { type: 'nine', width: base[0], height: base[1], border: border as [number, number, number, number], stretch: true };
}
