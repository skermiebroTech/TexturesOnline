// Renders block / item models from a real game jar (served by the screenshot script) in a grid.
// ?v=26.3&size=240&cols=4&list=furnace;lit=true,item:chest,chest@az=0.3@el=0.2,...
//   state as ;key=value pairs, camera angle as @az=<radians>@el=<radians> (azimuth 0 looks at the south face)
// v=bedrock loads the Bedrock vanilla pack from the network; the Java model data for its shapes comes
// from /__jar/<javaModels>.jar (default 26.3) so no mirror download is needed (javaModels=mirror uses the
// app's download, javaModels=none the offline fallback).
import { unzipSync } from 'fflate';
import type { AssetIndex } from '../../../src/core/types';
import { decodeImage } from '../../../src/core/image';
import { buildJavaTextureList } from '../../../src/editions/java/textures';
import { loadModelLibrary, type ModelView } from '../../../src/shared/models/index';
import { extrudeSprite } from '../../../src/shared/models/sprite';
import { tintColor } from '../../../src/shared/models/tints';
import { createBlockPreview } from '../../../src/shared/preview/block-preview';
import type { ModelTextureImage } from '../../../src/shared/models/model-mesh';
import { loadAssets } from '../../../src/editions/index';

const params = new URLSearchParams(location.search);
const version = params.get('v') ?? '26.3';
const list = (params.get('list') ?? 'furnace').split(',').filter(Boolean);
const size = Number(params.get('size') ?? 240);
const cols = Number(params.get('cols') ?? 4);
const view = document.getElementById('view')!;
view.style.gridTemplateColumns = `repeat(${cols}, ${size}px)`;

async function jarFiles(v: string, filter: (name: string) => boolean): Promise<Record<string, Uint8Array>> {
  const bytes = new Uint8Array(await (await fetch(`/__jar/${v}.jar`)).arrayBuffer());
  return unzipSync(bytes, { filter: (f) => filter(f.name) });
}

async function javaAssets(v: string): Promise<AssetIndex> {
  const files = await jarFiles(v, (n) => n.startsWith('assets/'));
  const names = Object.keys(files).filter((n) => !n.endsWith('/')).sort();
  const set = new Set(names);
  const read = async (p: string) => {
    const b = files[p];
    if (!b) throw new Error(`missing ${p}`);
    return b;
  };
  return {
    edition: 'java',
    version: v,
    textures: buildJavaTextureList(names),
    hasFile: (p) => set.has(p),
    listFiles: (prefix) => names.filter((n) => n.startsWith(prefix)),
    readFile: read,
    readText: async (p) => new TextDecoder().decode(await read(p)),
    readImage: async (p) => decodeImage(await read(p), 'png'),
  };
}

/** Java blockstates and models of a jar as a JSON lookup (what the Bedrock backend borrows shapes from). */
async function javaModelJson(v: string): Promise<(path: string) => unknown> {
  const files = await jarFiles(v, (n) => /^assets\/minecraft\/(blockstates|models)\/.*\.json$/.test(n));
  const cache = new Map<string, unknown>();
  return (path) => {
    if (cache.has(path)) return cache.get(path);
    const b = files[path];
    let out: unknown;
    try {
      out = b ? JSON.parse(new TextDecoder().decode(b)) : undefined;
    } catch {
      out = undefined;
    }
    cache.set(path, out);
    return out;
  };
}

async function textureImage(assets: AssetIndex, path: string): Promise<ModelTextureImage | null> {
  try {
    const img = await assets.readImage(path);
    const frames = img.height > img.width && img.height % img.width === 0 ? img.height / img.width : 1;
    return { image: img, frames, frametime: 0 };
  } catch {
    return null;
  }
}

(async () => {
  const bedrock = version === 'bedrock';
  const assets = bedrock ? await loadAssets('bedrock', 'latest') : await javaAssets(version);
  // javaModels=<version> (default 26.3): from that jar; =none: offline fallback; =mirror: the app's own download.
  const jm = params.get('javaModels') ?? '26.3';
  const javaModels = bedrock && jm !== 'none' && jm !== 'mirror' ? await javaModelJson(jm) : null;
  const lib = await loadModelLibrary(assets, bedrock && jm !== 'mirror' ? { javaModels: async () => javaModels } : {});
  for (const spec of list) {
    const [main, ...angles] = spec.split('@');
    const [ref, ...pairs] = main.split(';');
    const [kind, id] = ref.includes(':') ? (ref.split(':') as ['block' | 'item', string]) : (['block', ref] as const);
    const angle: { azimuth?: number; elevation?: number } = {};
    for (const a of angles) {
      const [k, val] = a.split('=');
      if (k === 'az') angle.azimuth = Number(val);
      if (k === 'el') angle.elevation = Number(val);
    }
    const cell = document.createElement('div');
    cell.className = 'cell';
    const box = document.createElement('div');
    box.className = 'box';
    box.style.width = `${size}px`;
    box.style.height = `${Math.round(size * 0.92)}px`;
    const label = document.createElement('p');
    label.style.maxWidth = `${size - 16}px`;
    cell.append(box, label);
    view.appendChild(cell);
    const entry = lib.get(kind, id);
    if (!entry) {
      label.textContent = `missing ${spec}`;
      continue;
    }
    const state = { ...lib.defaultState(entry), ...Object.fromEntries(pairs.map((p) => p.split('='))) };
    const v: ModelView = lib.resolve(entry, state);
    label.textContent = `${entry.name} ${Object.entries(v.state).map(([k, x]) => `${k}=${x}`).join(' ')}${v.approximate ? ' (approx)' : ''}`;
    label.title = `${label.textContent} | ${v.textures.filter((t) => t.faces > 0).map((t) => `${t.label}: ${t.path}`).join(' | ')}`;
    const pv = createBlockPreview(box, { autoRotate: false });
    const textures = new Map<string, ModelTextureImage>();
    const paths = new Set<string>([...v.quads.map((q) => q.texture).filter((p): p is string => !!p), ...v.sprite.map((s) => s.path)]);
    for (const p of paths) {
      const t = await textureImage(assets, p);
      if (t) textures.set(p, t);
    }
    if (v.shape === 'model') pv.showModel({ quads: v.quads, textures, tint: (t) => tintColor(t) }, { view: entry.kind === 'item' ? 'item' : 'block', angle });
    else if (v.shape === 'sprite') {
      const quads = extrudeSprite(v.sprite.filter((s) => textures.has(s.path)).map((s) => ({ ...s, image: textures.get(s.path)!.image })));
      pv.showModel({ quads, textures, tint: (t) => tintColor(t) }, { view: 'item', angle });
    } else if (v.sprite[0] && textures.get(v.sprite[0].path)) pv.showFlat(textures.get(v.sprite[0].path)!.image);
  }
  (window as unknown as { __ready: boolean }).__ready = true;
})().catch((e) => {
  console.error(e);
  (window as unknown as { __ready: boolean }).__ready = true;
});
