// Extracts the handful of vanilla textures the preview harness pages use into ./fixtures/
// (git-ignored — game files are never committed).
//
//   node tests/harness/preview/extract-fixtures.mjs [path/to/client.jar] [--bedrock] [--legacy path/to/1.12.2.jar]
//
// --bedrock additionally downloads a few Bedrock textures from Mojang/bedrock-samples.
// --legacy extracts the pre-1.13 names (blocks/grass_top, blue water, ...) from an old client jar.
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'fixtures');
const args = process.argv.slice(2);
const wantBedrock = args.includes('--bedrock');
const legacyAt = args.indexOf('--legacy');
const legacyJar = legacyAt >= 0 ? args[legacyAt + 1] : undefined;
const jarArg = args.find((a, i) => !a.startsWith('--') && i !== legacyAt + 1);
const jarPath = jarArg ?? process.env.MC_JAR;

const JAVA_TEXTURES = [
  'block/grass_block_top', 'block/grass_block_side', 'block/grass_block_side_overlay', 'block/dirt',
  'block/stone', 'block/cobblestone', 'block/mossy_cobblestone', 'block/andesite', 'block/gravel', 'block/sand',
  'block/water_still', 'block/oak_log', 'block/oak_log_top', 'block/oak_leaves', 'block/short_grass',
  'block/poppy', 'block/dandelion', 'block/cornflower', 'block/oxeye_daisy', 'block/torch', 'block/oak_planks',
  'block/diamond_ore', 'block/furnace_front', 'block/furnace_side', 'block/furnace_top', 'block/glass',
  'item/diamond_sword', 'item/apple', 'colormap/grass', 'colormap/foliage',
  'entity/player/wide/steve', 'entity/player/slim/alex',
];

const BEDROCK_TEXTURES = [
  'blocks/grass_top.png', 'blocks/grass_side.tga', 'blocks/grass_side_carried.png', 'blocks/dirt.png',
  'blocks/stone.png', 'blocks/cobblestone.png', 'blocks/gravel.png', 'blocks/sand.png', 'blocks/water_still_grey.png',
  'blocks/log_oak.png', 'blocks/log_oak_top.png', 'blocks/leaves_oak.tga', 'blocks/tallgrass.tga', 'blocks/tallgrass.png',
  'blocks/flower_rose.png', 'blocks/flower_dandelion.png', 'blocks/flower_cornflower.png', 'blocks/torch_on.png',
  'colormap/grass.png', 'colormap/foliage.png',
];

function write(rel, data) {
  const file = join(out, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, data);
}

const LEGACY_TEXTURES = [
  'blocks/grass_top', 'blocks/grass_side', 'blocks/grass_side_overlay', 'blocks/dirt', 'blocks/stone', 'blocks/cobblestone',
  'blocks/gravel', 'blocks/sand', 'blocks/water_still', 'blocks/log_oak', 'blocks/log_oak_top', 'blocks/leaves_oak',
  'blocks/tallgrass', 'blocks/flower_rose', 'blocks/flower_dandelion', 'blocks/flower_blue_orchid', 'blocks/torch_on',
  'colormap/grass', 'colormap/foliage',
];

const index = { java: [], bedrock: [], legacy: [] };

if (jarPath) {
  if (!existsSync(jarPath)) {
    console.error(`Jar not found: ${jarPath}`);
    process.exit(1);
  }
  const wanted = new Set();
  for (const t of JAVA_TEXTURES) {
    wanted.add(`assets/minecraft/textures/${t}.png`);
    wanted.add(`assets/minecraft/textures/${t}.png.mcmeta`);
  }
  const files = unzipSync(readFileSync(jarPath), { filter: (f) => wanted.has(f.name) });
  for (const [name, data] of Object.entries(files)) {
    write(`java/${name}`, data);
    index.java.push(name);
  }
  console.log(`Extracted ${Object.keys(files).length} Java files from ${jarPath}`);
} else {
  console.log('No jar given: skipping Java textures (pass the client jar path or set MC_JAR).');
}

if (wantBedrock) {
  const base = 'https://raw.githubusercontent.com/Mojang/bedrock-samples/main/resource_pack/textures/';
  for (const t of BEDROCK_TEXTURES) {
    const res = await fetch(base + t);
    if (!res.ok) {
      console.warn(`  skip ${t}: HTTP ${res.status}`);
      continue;
    }
    write(`bedrock/textures/${t}`, new Uint8Array(await res.arrayBuffer()));
    index.bedrock.push(`textures/${t}`);
  }
  console.log(`Downloaded ${index.bedrock.length} Bedrock textures`);
}

if (legacyJar) {
  if (!existsSync(legacyJar)) {
    console.error(`Legacy jar not found: ${legacyJar}`);
    process.exit(1);
  }
  const wanted = new Set();
  for (const t of LEGACY_TEXTURES) {
    wanted.add(`assets/minecraft/textures/${t}.png`);
    wanted.add(`assets/minecraft/textures/${t}.png.mcmeta`);
  }
  const files = unzipSync(readFileSync(legacyJar), { filter: (f) => wanted.has(f.name) });
  for (const [name, data] of Object.entries(files)) {
    write(`legacy/${name}`, data);
    index.legacy.push(name);
  }
  console.log(`Extracted ${Object.keys(files).length} legacy Java files from ${legacyJar}`);
}

index.java.sort();
index.bedrock.sort();
index.legacy.sort();
write('index.json', JSON.stringify(index, null, 2));
