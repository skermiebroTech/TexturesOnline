/**
 * Exports a stacked-preset pack (Smooth HD + Cartoon) from real client jars of several eras and
 * checks pack.mcmeta, .mcmeta companions and timings.
 *
 *   npx tsx tests/tools/texlogic/era-export.ts <jar-dir> 1.8.9 1.12.2 1.20.1 26.3
 *
 * <jar-dir> holds <version>.jar files.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { unzipSync } from 'fflate';
import { loadAssets } from '../../../src/editions/index';
import { newTextureProject, applyPreset } from '../../../src/tools/textures/project';
import { exportTexturePack } from '../../../src/tools/textures/export';

const [dir, ...versions] = process.argv.slice(2);
if (!dir || !versions.length) {
  console.error('usage: era-export.ts <jar-dir> <version>...');
  process.exit(1);
}

for (const v of versions) {
  const jar = new File([readFileSync(join(dir, `${v}.jar`))], 'client.jar');
  const assets = await loadAssets('java', v, { jarFile: jar });
  const p = newTextureProject({ name: `Era ${v}`, edition: 'java', version: v });
  applyPreset(p, 'smooth-hd');
  applyPreset(p, 'cartoon', 'append');
  const t = performance.now();
  const res = await exportTexturePack(p, assets);
  const ms = performance.now() - t;
  const zip = unzipSync(new Uint8Array(await res.blob.arrayBuffer()));
  const names = Object.keys(zip);
  let missing = 0;
  for (const n of names) if (n.endsWith('.png') && assets.hasFile(`${n}.mcmeta`) && !zip[`${n}.mcmeta`]) missing++;
  const meta = new TextDecoder().decode(zip['pack.mcmeta']).replace(/\s+/g, ' ');
  console.log(`${v}: ${assets.textures.length} textures -> ${names.length} files in ${ms.toFixed(0)} ms, missing .mcmeta ${missing}, pack.mcmeta ${meta}`);
  if (res.warnings.length) console.log('  warnings:', res.warnings);
}
