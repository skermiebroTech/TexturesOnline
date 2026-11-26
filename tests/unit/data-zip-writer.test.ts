// The time-sliced zip writer (src/core/zip.ts) against the fflate `zip` path it replaced: same entries,
// same contents, same bytes; text deflated, PNGs stored; the page gets turns during a big pack.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zip, strToU8, unzipSync, type AsyncZippable, type AsyncZipOptions } from 'fflate';
import { readZip, writeZip, normalizeZipPath } from '../../src/core/zip';
import { openBytesZip } from '../../src/core/rangezip';
import { zipPack } from '../../src/tools/shaders/ui/pack-zip';
import type { FileMap } from '../../src/core/types';

const MTIME = new Date(2026, 10, 26, 13, 37, 42);
const STORED_EXT = /\.(png|jpe?g|gif|webp|zip|jar|mcpack|mcaddon|mcworld|ogg|mp3|fsb|gz)$/i;

/** The writer as it was: everything handed to fflate's `zip` at once. */
async function oldWriteZip(files: FileMap, mtime: Date): Promise<Uint8Array> {
  const input: AsyncZippable = {};
  for (const [rawPath, value] of Object.entries(files)) {
    const path = normalizeZipPath(rawPath);
    if (!path) continue;
    const bytes = typeof value === 'string' ? strToU8(value) : value instanceof Uint8Array ? value : new Uint8Array(await value.arrayBuffer());
    input[path] = [bytes, { level: STORED_EXT.test(path) ? 0 : 6, mtime }];
  }
  return new Promise((resolve, reject) => zip(input, { level: 6 }, (err, data) => (err ? reject(err) : resolve(data))));
}

/** The shader packs' writer as it was: a tree, so fflate adds folder entries. */
async function oldZipPack(files: FileMap, mtime: Date): Promise<Uint8Array> {
  type Tree = { [name: string]: Tree | [Uint8Array, AsyncZipOptions] };
  const root: Tree = {};
  for (const [path, value] of Object.entries(files)) {
    const bytes = typeof value === 'string' ? strToU8(value) : (value as Uint8Array);
    const parts = path.split('/');
    let node = root;
    for (const dir of parts.slice(0, -1)) {
      const next = node[dir];
      if (!next || Array.isArray(next)) node[dir] = {};
      node = node[dir] as Tree;
    }
    node[parts[parts.length - 1]] = [bytes, { level: /\.(png|jpe?g|webp|zip|ogg)$/i.test(path) ? 0 : 6, mtime }];
  }
  return new Promise((resolve, reject) => zip(root as AsyncZippable, { level: 6, mtime }, (err, data) => (err ? reject(err) : resolve(data))));
}

function rng(seed: number) {
  return () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
}

/** A server-pack-like FileMap: many small JSON files, small PNGs, a big text file and odd names. */
function samplePack(json = 300, png = 160): FileMap {
  const rnd = rng(7);
  const files: FileMap = { 'pack.mcmeta': JSON.stringify({ pack: { pack_format: 46, description: 'Test §a pack' } }) };
  for (let i = 0; i < json; i++) {
    const textures: Record<string, string> = {};
    for (let j = 0; j < 3 + Math.floor(rnd() * 20); j++) textures[`layer${j}`] = `minecraft:block/t_${Math.floor(rnd() * 1e6)}`;
    files[`assets/minecraft/models/block/m${i}.json`] = JSON.stringify({ parent: 'block/cube_all', textures }, null, 2);
  }
  for (let i = 0; i < png; i++) {
    const b = new Uint8Array(100 + Math.floor(rnd() * 1500));
    for (let j = 0; j < b.length; j++) b[j] = (rnd() * 256) | 0;
    b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    files[`assets/minecraft/textures/block/t${i}.png`] = b;
  }
  // big enough for the worker path (fflate deflates 160 kB and up in a worker)
  files['assets/minecraft/lang/en_us.json'] = JSON.stringify(Object.fromEntries(Array.from({ length: 12000 }, (_, i) => [`item.minecraft.thing_${i}`, `Thing number ${i} ${Math.floor(rnd() * 1e9)}`])));
  files['assets/minecraft/sounds/big.ogg'] = new Uint8Array(700_000).map((_, i) => (i * 31) & 255);
  files['assets/minecraft/textures/gui/título_日本.png'] = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
  files['assets/minecraft/texts/empty.txt'] = '';
  files['assets/minecraft/texts/blob.txt'] = new Blob(['from a blob ✓']);
  files['./__MACOSX/._junk'] = 'skipped';
  files['credits\\windows.txt'] = 'backslashes become slashes';
  return files;
}

test('writeZip: byte for byte what fflate zip wrote before (entries, contents, headers)', async () => {
  const files = samplePack();
  const before = await oldWriteZip(files, MTIME);
  const after = new Uint8Array(await (await writeZip(files, { mtime: MTIME })).arrayBuffer());
  assert.equal(after.length, before.length);
  assert.ok(Buffer.from(after).equals(Buffer.from(before)), 'identical bytes');
});

test('writeZip: same entries and contents; text deflated, PNGs and sounds stored', async () => {
  const files = samplePack(40, 20);
  const blob = await writeZip(files);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const read = await readZip(blob);
  const viaFflate = unzipSync(bytes);
  const expected = Object.keys(files).map(normalizeZipPath).filter(Boolean);
  assert.deepEqual(Object.keys(read), expected);
  assert.deepEqual(Object.keys(viaFflate), expected);
  for (const [raw, value] of Object.entries(files)) {
    const path = normalizeZipPath(raw);
    if (!path) continue;
    const want = typeof value === 'string' ? strToU8(value) : value instanceof Uint8Array ? value : new Uint8Array(await value.arrayBuffer());
    assert.deepEqual(read[path], want, path);
    assert.deepEqual(viaFflate[path], want, path);
  }
  const entries = new Map((await openBytesZip(bytes)).entries.map((e) => [e.name, e]));
  const method = (p: string) => entries.get(p)!.method;
  assert.equal(method('assets/minecraft/models/block/m0.json'), 8);
  assert.equal(method('assets/minecraft/lang/en_us.json'), 8);
  assert.ok(entries.get('assets/minecraft/lang/en_us.json')!.compressedSize < entries.get('assets/minecraft/lang/en_us.json')!.size / 2);
  assert.equal(method('pack.mcmeta'), 8);
  assert.equal(method('assets/minecraft/textures/block/t0.png'), 0);
  assert.equal(method('assets/minecraft/sounds/big.ogg'), 0);
  assert.equal(entries.get('assets/minecraft/textures/gui/título_日本.png')!.flags & 0x800, 0x800, 'UTF-8 name flag');
  assert.equal(blob.type, 'application/zip');
  assert.equal((await writeZip({}, { mimeType: 'application/octet-stream' })).type, 'application/octet-stream');
});

test('writeZip: an empty map is an empty, valid zip as before', async () => {
  const before = await oldWriteZip({}, MTIME);
  const after = new Uint8Array(await (await writeZip({}, { mtime: MTIME })).arrayBuffer());
  assert.deepEqual(after, before);
  assert.deepEqual(unzipSync(after), {});
});

test('zipPack (shader packs): folder entries and bytes as before', async () => {
  const files: FileMap = {
    'shaders/gbuffers_basic.fsh': '#version 330\nvoid main() {}\n',
    'shaders/lib/common.glsl': '// common\n'.repeat(200),
    'shaders/lang/en_us.lang': 'option.X=X\n',
    'shaders/textures/noise.png': new Uint8Array([0x89, 0x50, 0x4e, 0x47, 9, 9, 9]),
    'shaders/shaders.properties': 'sliders=X\n',
    'pack.mcmeta': '{}',
  };
  const before = await oldZipPack(files, MTIME);
  // zipPack takes the time from the clock: compare everything but the four time bytes of each header
  const after = new Uint8Array(await (await zipPack(files)).arrayBuffer());
  assert.equal(after.length, before.length);
  const names = Object.keys(unzipSync(after));
  assert.deepEqual(names, Object.keys(unzipSync(before)));
  assert.ok(names.includes('shaders/') && names.includes('shaders/lib/'));
  const mask = (b: Uint8Array) => {
    const c = b.slice();
    for (let i = 0; i + 4 <= c.length; i++) {
      const sig = c[i] | (c[i + 1] << 8) | (c[i + 2] << 16) | (c[i + 3] << 24);
      if (sig === 0x04034b50) c.fill(0, i + 10, i + 14);
      else if (sig === 0x02014b50) c.fill(0, i + 12, i + 16);
    }
    return c;
  };
  assert.deepEqual(mask(after), mask(before));
});

test('writeZip: a big pack gives the event loop turns while it is written', async () => {
  const files = samplePack(3000, 1600);
  let turns = 0;
  let done = false;
  const tick = () => {
    if (done) return;
    turns++;
    setImmediate(tick);
  };
  setImmediate(tick);
  const blob = await writeZip(files);
  done = true;
  assert.ok(blob.size > 0);
  assert.ok(turns >= 2, `the event loop ran ${turns} times during the export`);
});
