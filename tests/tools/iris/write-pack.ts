// Writes a generated Iris / OptiFine shader pack to disk for manual testing.
//   npx tsx tests/tools/iris/write-pack.ts <out-dir> [preset-id] [--zip]
// The folder gets README.txt + shaders/...; with --zip a ready-to-install .zip is written too.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { generateIrisPack, irisPackFileName, presetValues, zipIrisPack, PRESETS } from '../../../src/tools/shaders/iris/index';

const args = process.argv.slice(2);
const outDir = args.find((a) => !a.startsWith('--'));
if (!outDir) {
  console.error(`usage: write-pack.ts <out-dir> [${PRESETS.map((p) => p.id).join('|')}] [--zip]`);
  process.exit(2);
}
const presetId = args.filter((a) => !a.startsWith('--'))[1] ?? 'default';
const preset = PRESETS.find((p) => p.id === presetId);
if (!preset) {
  console.error(`unknown preset ${presetId}`);
  process.exit(2);
}

const name = `Texture Pack Maker ${preset.label}`;
const files = generateIrisPack(presetValues(preset.id), { name, description: preset.description });
const root = resolve(outDir);
for (const [path, content] of Object.entries(files)) {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content as string);
}
console.log(`wrote ${Object.keys(files).length} files to ${root}`);
if (args.includes('--zip')) {
  const zipPath = join(root, irisPackFileName(name));
  writeFileSync(zipPath, zipIrisPack(files));
  console.log(`wrote ${zipPath}`);
}
