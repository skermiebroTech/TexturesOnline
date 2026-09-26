/**
 * End-to-end check against a real client jar: loads the jar through the data layer, applies a
 * preset to the whole pack, exports it and validates the archive. Prints timings.
 *
 *   npx tsx tests/tools/texlogic/real-export.ts <client.jar> [presetId] [out.zip]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { unzipSync } from 'fflate';
import { loadAssets } from '../../../src/editions/index';
import { newTextureProject, applyPreset, setOverride } from '../../../src/tools/textures/project';
import { exportTexturePack } from '../../../src/tools/textures/export';
import { importPack } from '../../../src/tools/textures/import';
import { decodeImage } from '../../../src/core/image';

const [jarPath, presetId = 'autumn', outPath] = process.argv.slice(2);
if (!jarPath) {
  console.error('usage: real-export.ts <client.jar> [presetId] [out.zip]');
  process.exit(1);
}

const t0 = performance.now();
const jar = new File([readFileSync(jarPath)], 'client.jar');
const assets = await loadAssets('java', '26.3', { jarFile: jar });
const t1 = performance.now();
console.log(`loaded ${assets.textures.length} textures in ${(t1 - t0).toFixed(0)} ms`);

const project = newTextureProject({ name: `Real ${presetId}`, edition: 'java', version: '26.3' });
applyPreset(project, presetId);
const stone = await assets.readImage('assets/minecraft/textures/block/stone.png');
await setOverride(project, 'assets/minecraft/textures/block/stone.png', stone);

let lastLabel = '';
const res = await exportTexturePack(project, assets, {
  onProgress: (p) => {
    const phase = p.label.split('…')[0];
    if (phase !== lastLabel) console.log(`  ${p.label} (${Math.round((p.fraction ?? 0) * 100)}%)`);
    lastLabel = phase;
  },
});
const t2 = performance.now();
const zip = unzipSync(new Uint8Array(await res.blob.arrayBuffer()));
const names = Object.keys(zip);
const pngs = names.filter((n) => n.endsWith('.png'));
const metas = names.filter((n) => n.endsWith('.png.mcmeta'));
console.log(`exported ${names.length} files (${pngs.length} png, ${metas.length} mcmeta, ${(res.blob.size / 1048576).toFixed(1)} MiB) in ${(t2 - t1).toFixed(0)} ms`);
console.log('pack.mcmeta:', new TextDecoder().decode(zip['pack.mcmeta']).replace(/\s+/g, ' '));
if (res.warnings.length) console.log('warnings:', res.warnings);

// every texture that has vanilla metadata must carry it
let missing = 0;
for (const png of pngs) if (assets.hasFile(`${png}.mcmeta`) && !zip[`${png}.mcmeta`]) missing++;
console.log(`textures missing their .mcmeta: ${missing}`);
// decode everything back
let bad = 0;
for (const png of pngs) {
  try {
    await decodeImage(zip[png]);
  } catch {
    bad++;
  }
}
console.log(`undecodable PNGs: ${bad}`);
const fonts = pngs.filter((n) => n.includes('/textures/font/')).length;
console.log(`font textures touched: ${fonts}`);

const t3 = performance.now();
const back = await importPack(new File([res.blob], res.filename));
console.log(`re-imported: ${Object.keys(back.project.overrides).length} overrides, version ${back.project.version}, ${back.warnings.length} warnings in ${(performance.now() - t3).toFixed(0)} ms`);
if (outPath) writeFileSync(outPath, new Uint8Array(await res.blob.arrayBuffer()));
