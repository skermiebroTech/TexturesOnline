// Renders block / item models from a real game jar (served by the screenshot script) in a grid.
// ?v=26.3&items=0&list=furnace;lit=true,crafting_table,... (state as ;key=value pairs)
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
const view = document.getElementById('view')!;

async function javaAssets(v: string): Promise<AssetIndex> {
  const bytes = new Uint8Array(await (await fetch(`/__jar/${v}.jar`)).arrayBuffer());
  const files = unzipSync(bytes, { filter: (f) => f.name.startsWith('assets/') });
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
  const assets = version === 'bedrock' ? await loadAssets('bedrock', 'latest') : await javaAssets(version);
  const lib = await loadModelLibrary(assets);
  for (const spec of list) {
    const [ref, ...pairs] = spec.split(';');
    const [kind, id] = ref.includes(':') ? (ref.split(':') as ['block' | 'item', string]) : (['block', ref] as const);
    const cell = document.createElement('div');
    cell.className = 'cell';
    const box = document.createElement('div');
    box.className = 'box';
    const label = document.createElement('p');
    cell.append(box, label);
    view.appendChild(cell);
    const entry = lib.get(kind, id);
    if (!entry) {
      label.textContent = `missing ${spec}`;
      continue;
    }
    const state = { ...lib.defaultState(entry), ...Object.fromEntries(pairs.map((p) => p.split('='))) };
    const v: ModelView = lib.resolve(entry, state);
    label.textContent = `${entry.name} ${Object.entries(v.state).map(([k, x]) => `${k}=${x}`).join(' ')}`;
    const pv = createBlockPreview(box, { autoRotate: false });
    const textures = new Map<string, ModelTextureImage>();
    const paths = new Set<string>([...v.quads.map((q) => q.texture).filter((p): p is string => !!p), ...v.sprite.map((s) => s.path)]);
    for (const p of paths) {
      const t = await textureImage(assets, p);
      if (t) textures.set(p, t);
    }
    if (v.shape === 'model') pv.showModel({ quads: v.quads, textures, tint: (t) => tintColor(t) });
    else if (v.shape === 'sprite') {
      const quads = extrudeSprite(v.sprite.filter((s) => textures.has(s.path)).map((s) => ({ ...s, image: textures.get(s.path)!.image })));
      pv.showModel({ quads, textures, tint: (t) => tintColor(t) }, { view: 'item' });
    } else if (v.sprite[0] && textures.get(v.sprite[0].path)) pv.showFlat(textures.get(v.sprite[0].path)!.image);
  }
  (window as unknown as { __ready: boolean }).__ready = true;
})().catch((e) => {
  console.error(e);
  (window as unknown as { __ready: boolean }).__ready = true;
});
