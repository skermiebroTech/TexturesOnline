// Biome colours: the game's colour-map lookup, which biomes each version has and where their colours
// come from, the markers on the maps, and (with the game files in TO_FIXTURES) the climates and
// colours against the 26.3 biome files, the colour maps each version ships and vanilla colours.
// Run: npx tsx --test tests/unit/biomes.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { decodePngBytes } from '../../src/core/image';
import {
  biomeCell,
  biomeLooks,
  biomesOf,
  biomeTints,
  BIOME_IDS,
  cellUsed,
  colorMapOf,
  colorMapsOf,
  gameBiomeId,
  javaAtLeast,
  lookColor,
  mapCell,
  mapColor,
  mapsRead,
  readsMap,
  rgbHex,
  type MapImage,
} from '../../src/tools/textures/biomes/biomes';
import { mapMarkers, markerAt } from '../../src/tools/textures/biomes/markers';

/** A 256 x 256 map whose every pixel encodes its own position (R = x, G = y). */
function positionMap(size = 256): MapImage {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      data[i] = x;
      data[i + 1] = y;
      data[i + 2] = 7;
      data[i + 3] = 255;
    }
  }
  return { width: size, height: size, data };
}

test('the lookup reads the cell the game reads (floats clamped, rain times warmth, truncated)', () => {
  assert.deepEqual(mapCell(0.8, 0.4), { x: 50, y: 173 }, 'plains');
  assert.deepEqual(mapCell(2, 0), { x: 0, y: 255 }, 'desert: warmth clamps to 1');
  assert.deepEqual(mapCell(0.95, 0.9), { x: 12, y: 36 }, 'jungle');
  assert.deepEqual(mapCell(0.8, 0.9), { x: 50, y: 71 }, 'swamp');
  // (0.8 as a float times 0.25 is a hair over 0.2: 203, not 204, as the game's own arithmetic gives)
  assert.deepEqual(mapCell(0.25, 0.8), { x: 191, y: 203 }, 'taiga');
  assert.deepEqual(mapCell(-0.5, 0.4), { x: 255, y: 255 }, 'snowy taiga: below zero is zero');
  assert.deepEqual(mapCell(0.5, 1), { x: 127, y: 127 }, 'the inventory grass colour sits on the diagonal');
  // the game never reads above the diagonal
  for (const t of [0, 0.1, 0.33, 0.5, 0.77, 1]) for (const d of [0, 0.25, 0.5, 1]) {
    const c = mapCell(t, d);
    assert.ok(cellUsed(c.x, c.y), `${t}/${d} -> ${c.x},${c.y}`);
  }
  const m = positionMap();
  assert.deepEqual(mapColor(m, 0.8, 0.4), [50, 173, 7]);
  // another size: the same place relative to its size
  assert.deepEqual(mapColor(positionMap(128), 0.8, 0.4), [25, 86, 7]);
});

test('versions: colour maps, biomes and the climates that changed', () => {
  assert.deepEqual(colorMapsOf('java', '1.21.4'), ['grass', 'foliage']);
  assert.deepEqual(colorMapsOf('java', '1.21.5'), ['grass', 'foliage', 'dry_foliage']);
  assert.deepEqual(colorMapsOf('java', '26.3'), ['grass', 'foliage', 'dry_foliage']);
  assert.equal(colorMapsOf('bedrock', '1.21.120').length, 8);
  assert.equal(colorMapOf('assets/minecraft/textures/colormap/grass.png', 'java', '26.3'), 'grass');
  assert.equal(colorMapOf('assets/minecraft/textures/colormap/dry_foliage.png', 'java', '1.20.1'), null, 'no dry foliage before 1.21.5');
  assert.equal(colorMapOf('textures/colormap/evergreen.png', 'bedrock', '1.21.120'), 'evergreen');
  assert.equal(colorMapOf('assets/minecraft/textures/block/grass_block_top.png', 'java', '26.3'), null);
  assert.ok(javaAtLeast('26.3', '1.21.5') && javaAtLeast('1.7.10', '1.7') && !javaAtLeast('1.6.4', '1.7') && !javaAtLeast('1.12.2', '1.13'));

  const has = (v: string) => new Set(biomesOf('java', v));
  assert.ok(!has('1.6.4').has('badlands') && has('1.7.10').has('badlands'));
  assert.ok(!has('1.18.2').has('mangrove_swamp') && has('1.19').has('mangrove_swamp'));
  assert.ok(!has('1.19.4').has('cherry_grove') && has('1.20').has('cherry_grove'));
  assert.ok(!has('1.21.3').has('pale_garden') && has('1.21.4').has('pale_garden'));
  assert.ok(!has('26.2').has('dappled_forest') && has('26.3').has('dappled_forest'));
  assert.equal(biomesOf('bedrock', '1.21.120').length, BIOME_IDS.length);
  assert.equal(gameBiomeId('badlands', 'bedrock'), 'mesa');
  assert.equal(gameBiomeId('badlands', 'java'), 'badlands');

  // 1.6 had a cold taiga and a hotter jungle
  assert.deepEqual(biomeLooks('taiga', 'java', '1.6.4')!.climate, { temperature: 0.05, downfall: 0.8 });
  assert.deepEqual(biomeLooks('taiga', 'java', '1.7.10')!.climate, { temperature: 0.25, downfall: 0.8 });
  assert.deepEqual(biomeCell(biomeLooks('jungle', 'java', '1.6.4')!), { x: 0, y: 25 });
  assert.equal(biomeLooks('cherry_grove', 'java', '1.19.4'), null);
});

test('where colours come from: swamp noise, dark forest mix, fixed colours, Bedrock maps', () => {
  const m = positionMap();
  const maps = { grass: m, foliage: m, dry_foliage: m };
  const swamp = biomeLooks('swamp', 'java', '26.3')!;
  assert.equal(swamp.grass.kind, 'noise');
  assert.equal(rgbHex(lookColor(swamp.grass, swamp.climate, maps)), '#6A7039');
  assert.equal(rgbHex(lookColor(swamp.foliage, swamp.climate, maps)), '#6A7039');
  assert.ok(!readsMap(swamp, 'grass') && !readsMap(swamp, 'foliage') && !readsMap(swamp, 'dry_foliage'));
  // 1.6: the map's colour mixed with 0x4E0E4E
  const old = biomeLooks('swamp', 'java', '1.6.4')!;
  assert.equal(old.grass.kind, 'mix');
  assert.deepEqual(lookColor(old.grass, old.climate, maps), [((50 & 0xfe) + 0x4e) >> 1, ((71 & 0xfe) + 0x0e) >> 1, ((7 & 0xfe) + 0x4e) >> 1]);
  // dark forest: ((colour & 0xFEFEFE) + 0x28340A) >> 1 (BiomeSpecialEffects.GrassColorModifier.DARK_FOREST)
  const dark = biomeLooks('dark_forest', 'java', '26.3')!;
  const c = mapCell(0.7, 0.8);
  assert.deepEqual(lookColor(dark.grass, dark.climate, maps), [((c.x & 0xfe) + 0x28) >> 1, ((c.y & 0xfe) + 0x34) >> 1, ((7 & 0xfe) + 0x0a) >> 1]);
  assert.ok(readsMap(dark, 'grass') && readsMap(dark, 'foliage'));
  const t = biomeTints(biomeLooks('plains', 'java', '26.3')!, maps);
  assert.deepEqual(t.grass, [50, 173, 7]);
  assert.equal(rgbHex(t.birch), '#80A755', 'Java birch leaves are a fixed colour');
  assert.equal(rgbHex(t.evergreen), '#619961');
  assert.equal(rgbHex(t.water), '#3F76E4');
  assert.equal(rgbHex(biomeTints(biomeLooks('plains', 'java', '1.12.2')!, maps).water), '#FFFFFF', 'before 1.13 the water texture holds the colour');
  assert.equal(rgbHex(biomeTints(biomeLooks('swamp', 'java', '1.12.2')!, maps).water), '#E0FFAE');
  assert.equal(biomeLooks('plains', 'java', '1.21.4')!.dry, null);
  for (const id of ['badlands', 'cherry_grove', 'pale_garden', 'dappled_forest'] as const) {
    const l = biomeLooks(id, 'java', '26.3')!;
    assert.equal(l.grass.kind, 'fixed', id);
    assert.deepEqual(mapsRead(l).filter((x) => x === 'grass'), [], id);
  }
  // Bedrock: swamps read their own maps, birch and spruce leaves read theirs
  const bs = biomeLooks('swamp', 'bedrock', '1.21.120')!;
  assert.deepEqual(bs.grass, { kind: 'map', map: 'swamp_grass' });
  assert.deepEqual(bs.foliage, { kind: 'map', map: 'swamp_foliage' });
  assert.deepEqual(biomeLooks('mangrove_swamp', 'bedrock', '1.21.120')!.foliage, { kind: 'map', map: 'mangrove_swamp_foliage' });
  assert.deepEqual(biomeLooks('plains', 'bedrock', '1.21.120')!.birch, { kind: 'map', map: 'birch' });
  assert.deepEqual(biomeLooks('cherry_grove', 'bedrock', '1.21.120')!.climate, { temperature: 0.3, downfall: 0.8 });
});

test('markers: one per cell, biomes that ignore the map flagged, nearest marker found', () => {
  const ms = mapMarkers('java', '26.3', 'grass');
  const corner = ms.find((m) => m.x === 0 && m.y === 255)!;
  assert.deepEqual(corner.biomes.map((b) => b.id), ['desert', 'savanna', 'badlands']);
  assert.deepEqual(corner.biomes.map((b) => b.reads), [true, true, false]);
  const cold = ms.find((m) => m.x === 255 && m.y === 255)!;
  assert.deepEqual(cold.biomes.map((b) => b.id), ['snowy_taiga', 'snowy_plains']);
  const cells = new Set(ms.map((m) => `${m.x},${m.y}`));
  assert.equal(cells.size, ms.length);
  assert.equal(markerAt(ms, 51, 174, 4)?.biomes[0].id, 'plains');
  assert.equal(markerAt(ms, 200, 20, 4), null);
});

// ---------------------------------------------------------------------------------------------
// Against the game files

const FX = (() => {
  const d = process.env.TO_FIXTURES;
  return d && existsSync(join(d, 'client-26.3.jar')) ? d : null;
})();
const skip = FX ? false : 'set TO_FIXTURES to a folder with client-26.3.jar (and research-cache/jars/<version>.jar)';

test('26.3: climates and colours match the game’s biome files, and vanilla colours', { skip }, () => {
  const files = unzipSync(new Uint8Array(readFileSync(join(FX!, 'client-26.3.jar'))), {
    filter: (f) => f.name.startsWith('data/minecraft/worldgen/biome/') || f.name.startsWith('assets/minecraft/textures/colormap/'),
  });
  const hexOf = (v: unknown): string | null => (typeof v === 'string' ? v.toUpperCase() : typeof v === 'number' ? rgbHex([(v >> 16) & 255, (v >> 8) & 255, v & 255]) : null);
  const grass = decodePngBytes(files['assets/minecraft/textures/colormap/grass.png']);
  const foliage = decodePngBytes(files['assets/minecraft/textures/colormap/foliage.png']);
  const dry = decodePngBytes(files['assets/minecraft/textures/colormap/dry_foliage.png']);
  const maps = { grass, foliage, dry_foliage: dry };
  for (const id of biomesOf('java', '26.3')) {
    const raw = files[`data/minecraft/worldgen/biome/${id}.json`];
    assert.ok(raw, `${id} is a biome of 26.3`);
    const b = JSON.parse(strFromU8(raw)) as { temperature: number; downfall: number; effects: Record<string, unknown> };
    const l = biomeLooks(id, 'java', '26.3')!;
    assert.equal(l.climate.temperature, b.temperature, `${id} temperature`);
    assert.equal(l.climate.downfall, b.downfall, `${id} downfall`);
    const e = b.effects;
    const check = (look: typeof l.grass | null, key: string) => {
      const fixed = hexOf(e[key]);
      if (fixed) assert.deepEqual(look && look.kind === 'fixed' && rgbHex(look.rgb), fixed, `${id} ${key}`);
      else assert.ok(look && look.kind !== 'fixed', `${id} ${key} is read from the map (or noise)`);
    };
    if (e.grass_color_modifier === 'swamp') assert.equal(l.grass.kind, 'noise', `${id} swamp grass`);
    else if (e.grass_color_modifier === 'dark_forest') assert.equal(l.grass.kind, 'mix', `${id} dark forest grass`);
    else check(l.grass, 'grass_color');
    check(l.foliage, 'foliage_color');
    check(l.dry, 'dry_foliage_color');
    assert.equal(rgbHex(l.water), hexOf(e.water_color), `${id} water`);
  }
  // vanilla colours: plains as the previews always showed them
  const plains = biomeTints(biomeLooks('plains', 'java', '26.3')!, maps);
  assert.equal(rgbHex(plains.grass), '#91BD59');
  assert.equal(rgbHex(plains.foliage), '#77AB2F');
  assert.equal(grass.width, 256);
  assert.equal(grass.height, 256);
});

test('every Java version: the colour maps it ships, the biomes it has (1.19+ biome files)', { skip }, () => {
  const dir = join(FX!, 'research-cache', 'jars');
  if (!existsSync(dir)) return;
  const jars = readdirSync(dir).filter((f) => /^(1\.\d+(\.\d+)?|2\d\.\d+(\.\d+)?)\.jar$/.test(f));
  assert.ok(jars.length >= 5);
  for (const f of jars) {
    const v = f.replace(/\.jar$/, '');
    const names: string[] = [];
    unzipSync(new Uint8Array(readFileSync(join(dir, f))), {
      filter: (e) => {
        names.push(e.name);
        return false;
      },
    });
    const maps = names.filter((n) => /^assets\/minecraft\/textures\/colormap\/[a-z_]+\.png$/.test(n)).map((n) => n.slice(n.lastIndexOf('/') + 1, -4)).sort();
    assert.deepEqual(maps, [...colorMapsOf('java', v)].sort(), `${v} colour maps`);
    const biomes = names.filter((n) => /^data\/minecraft\/worldgen\/biome\/[a-z_]+\.json$/.test(n)).map((n) => n.slice(n.lastIndexOf('/') + 1, -5));
    if (!biomes.length) continue;
    const ours = biomesOf('java', v);
    for (const id of BIOME_IDS) assert.equal(ours.includes(id), biomes.includes(id), `${v}: ${id}`);
  }
});
