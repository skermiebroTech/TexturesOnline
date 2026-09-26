/**
 * Loads real Bedrock vanilla assets (bedrock-samples over the network), applies an effect to one
 * category, exports a .mcpack and checks the manifest, icon, extensions and alpha masks.
 *
 *   npx tsx tests/tools/texlogic/bedrock-export.ts [category=environment] [presetId=dark-mode] [out.mcpack]
 */
import { writeFileSync } from 'node:fs';
import { unzipSync } from 'fflate';
import { loadAssets } from '../../../src/editions/index';
import { newTextureProject, applyPreset } from '../../../src/tools/textures/project';
import { exportTexturePack } from '../../../src/tools/textures/export';
import { decodeImage } from '../../../src/core/image';
import type { TextureCategory } from '../../../src/core/types';

const [category = 'environment', presetId = 'dark-mode', outPath] = process.argv.slice(2);
const t0 = performance.now();
const assets = await loadAssets('bedrock', 'latest');
const counts = new Map<string, number>();
for (const t of assets.textures) counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
console.log(`catalogue: ${assets.textures.length} textures in ${(performance.now() - t0).toFixed(0)} ms`, Object.fromEntries(counts));

const p = newTextureProject({ name: 'Bedrock Check', edition: 'bedrock', version: 'latest' });
applyPreset(p, presetId);
for (const l of p.effects) l.categories = [category as TextureCategory];
const t1 = performance.now();
const res = await exportTexturePack(p, assets);
const zip = unzipSync(new Uint8Array(await res.blob.arrayBuffer()));
const names = Object.keys(zip);
console.log(`exported ${names.length} files in ${(performance.now() - t1).toFixed(0)} ms as ${res.filename}`);
console.log('manifest:', new TextDecoder().decode(zip['manifest.json']).replace(/\s+/g, ' '));
const icon = await decodeImage(zip['pack_icon.png']);
console.log(`icon ${icon.width}x${icon.height}`);
let extMismatch = 0;
let alphaChanged = 0;
for (const n of names) {
  if (!n.startsWith('textures/')) continue;
  if (!assets.hasFile(n)) extMismatch++;
  else if (/\.(png|tga)$/.test(n)) {
    const a = await assets.readImage(n);
    const b = await decodeImage(zip[n], n.split('.').pop());
    if (a.width === b.width && a.height === b.height) for (let i = 3; i < a.data.length; i += 4) if (a.data[i] !== b.data[i]) { alphaChanged++; break; }
  }
}
console.log(`textures not at a vanilla path: ${extMismatch}; textures whose alpha changed: ${alphaChanged}`);
if (res.warnings.length) console.log('warnings:', res.warnings);
if (outPath) writeFileSync(outPath, new Uint8Array(await res.blob.arrayBuffer()));
