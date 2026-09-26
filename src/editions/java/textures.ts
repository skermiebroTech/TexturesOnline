import type { TextureCategory, TextureInfo } from '../../core/types';

export const JAVA_TEXTURE_ROOT = 'assets/minecraft/textures/';
const MC = 'assets/minecraft/';

/** Display order of categories in texture browsers. */
export const TEXTURE_CATEGORY_ORDER: readonly TextureCategory[] = [
  'block', 'item', 'entity', 'armor', 'gui', 'particle', 'environment', 'painting', 'effect', 'font', 'map', 'colormap', 'misc', 'other',
];

const ORDER_INDEX = new Map(TEXTURE_CATEGORY_ORDER.map((c, i) => [c, i]));

export function compareTextures(a: TextureInfo, b: TextureInfo): number {
  return (ORDER_INDEX.get(a.category) ?? 99) - (ORDER_INDEX.get(b.category) ?? 99) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Category from a path relative to the textures root, e.g. 'block/stone.png'. */
export function javaTextureCategory(rel: string): TextureCategory {
  const segs = rel.split('/');
  const first = segs[0];
  switch (first) {
    case 'block':
    case 'blocks':
      return 'block';
    case 'item':
    case 'items':
      return 'item';
    case 'entity':
      return segs[1] === 'equipment' ? 'armor' : 'entity';
    case 'models':
    case 'trims':
      return 'armor';
    case 'palettes':
      return segs[1] === 'trim' || /^trim/.test(segs[1] ?? '') ? 'armor' : 'misc';
    case 'gui':
      return 'gui';
    case 'particle':
      return 'particle';
    case 'environment':
      return 'environment';
    case 'painting':
      return 'painting';
    case 'mob_effect':
    case 'effect':
      return 'effect';
    case 'font':
      return 'font';
    case 'map':
      return 'map';
    case 'misc':
      return 'misc';
    case 'colormap':
      return 'colormap';
    default:
      return 'other';
  }
}

/** Editable textures from a list of jar paths: every PNG under assets/minecraft/textures/. */
export function buildJavaTextureList(paths: Iterable<string>): TextureInfo[] {
  const all = new Set(paths);
  const list: TextureInfo[] = [];
  for (const path of all) {
    if (!path.startsWith(JAVA_TEXTURE_ROOT) || !path.endsWith('.png')) continue;
    const rel = path.slice(JAVA_TEXTURE_ROOT.length);
    const id = rel.slice(0, -4);
    const slash = id.lastIndexOf('/');
    const info: TextureInfo = {
      path,
      name: id.slice(slash + 1),
      id,
      category: javaTextureCategory(rel),
      ext: 'png',
    };
    if (all.has(path + '.mcmeta')) info.animated = true;
    list.push(info);
  }
  return list.sort(compareTextures);
}

const mcmetaDecoder = new TextDecoder();

/**
 * Keeps `animated` only where the .png.mcmeta really has an "animation" section: GUI sprite
 * scaling, villager hats, texture blur/clamp and trim palettes use .mcmeta files too
 * (155 of the 218 in 26.3). Textures whose metadata isn't available yet keep the flag.
 */
export function refineAnimated(textures: TextureInfo[], read: (path: string) => Uint8Array | undefined): void {
  for (const t of textures) {
    if (!t.animated) continue;
    const bytes = read(t.path + '.mcmeta');
    if (!bytes) continue;
    try {
      const text = mcmetaDecoder.decode(bytes);
      const json = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text) as unknown;
      if (!json || typeof json !== 'object' || !('animation' in json)) delete t.animated;
    } catch {
      /* unreadable metadata: keep the flag */
    }
  }
}

/**
 * Download group of a jar path, or null when the path isn't kept (classes, data packs, META-INF).
 * 'core' (textures + version.json) is fetched eagerly; other groups (shaders, models, ...) on demand.
 */
export function javaGroupOf(path: string): string | null {
  if (path.endsWith('/')) return null;
  if (path === 'version.json' || path === 'pack.mcmeta') return 'core';
  if (path === 'pack.png') return 'jar-root';
  if (path.startsWith(MC)) {
    const rest = path.slice(MC.length);
    const slash = rest.indexOf('/');
    if (slash < 0) return 'mc-root';
    const dir = rest.slice(0, slash);
    return dir === 'textures' ? 'core' : dir;
  }
  if (path.startsWith('assets/')) return 'assets-other';
  return null;
}
