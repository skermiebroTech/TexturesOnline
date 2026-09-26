import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, openAsBlob } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { unzipSync, zipSync } from 'fflate';
import { BlobSource, HttpRangeSource, MemorySource, RangeZip, planRanges, inflateRaw, type ZipEntry } from '../../src/core/rangezip';
import { loadJavaAssets } from '../../src/editions/java/assets';
import type { Progress } from '../../src/core/types';
import { fixturesDir } from '../tools/data/fixtures';

const SCRATCH = fixturesDir();
const JAR = `${SCRATCH}/client-26.3.jar`;
const JAR_1201 = `${SCRATCH}/research-cache/jars/1.20.1.jar`;
const JAR_189 = `${SCRATCH}/research-cache/jars/1.8.9.jar`;
const V263 = `${SCRATCH}/v263.json`;
const hasJar = existsSync(JAR);
const TEX = 'assets/minecraft/textures/';

let localFiles: Record<string, Uint8Array> | null = null;
function local(name: string): Uint8Array {
  localFiles ??= unzipSync(new Uint8Array(readFileSync(JAR)), { filter: (f) => f.name === 'version.json' || f.name.startsWith(TEX + 'block/stone') || f.name.startsWith('assets/minecraft/shaders/core/') });
  const b = localFiles[name];
  assert.ok(b, `local ${name}`);
  return b;
}

test('planRanges coalesces neighbours and caps the request count', () => {
  const e = (offset: number, size: number): ZipEntry => ({ name: `f${offset}`, offset, compressedSize: size, size, method: 0, flags: 0, crc32: 0, extraLength: 0 });
  const entries = [e(0, 100), e(200, 100), e(10_000_000, 50), e(10_000_100, 50), e(50_000_000, 10)];
  const r = planRanges(entries, { maxGap: 1024 });
  assert.equal(r.length, 3);
  assert.equal(r[0].entries.length, 2);
  assert.equal(r[0].start, 0);
  const capped = planRanges(entries, { maxGap: 1024, maxRequests: 2 });
  assert.equal(capped.length, 2);
  assert.equal(capped[0].entries.length, 4);
  assert.equal(planRanges(entries, { maxGap: 1024, limit: 10_000_120 })[1].end, 10_000_120);
});

test('inflateRaw handles small and large payloads', async () => {
  const big = new Uint8Array(300_000).map((_, i) => (i * 7) & 0xff);
  const zipped = zipSync({ a: big, b: new Uint8Array([1, 2, 3]) }, { level: 6 });
  const zip = await RangeZip.open(new MemorySource(zipped));
  const out = await zip.readMany(['a', 'b']);
  assert.deepEqual(out.get('b'), new Uint8Array([1, 2, 3]));
  assert.equal(Buffer.compare(Buffer.from(out.get('a')!), Buffer.from(big)), 0);
  await assert.rejects(inflateRaw(new Uint8Array([0xff, 0xff, 0xff]), 10));
});

test('local 26.3 jar via Blob.slice: CD listing and exact file contents', { skip: !hasJar && 'jar missing' }, async () => {
  const blob = await openAsBlob(JAR);
  const zip = await RangeZip.open(new BlobSource(blob));
  assert.ok(zip.entries.length > 30_000, `${zip.entries.length} entries`);
  const textures = zip.entries.filter((x) => x.name.startsWith(TEX) && !x.name.endsWith('/'));
  assert.ok(textures.length >= 4182 && textures.length < 4400, `${textures.length} texture entries`);
  assert.equal(textures.filter((x) => x.name.endsWith('.png')).length, 3964);
  const vj = JSON.parse(new TextDecoder().decode(await zip.read('version.json')));
  assert.equal(vj.id, '26.3');
  assert.deepEqual([vj.pack_version.resource_major, vj.pack_version.resource_minor], [97, 1]);
  const picks = ['version.json', `${TEX}block/stone.png`, 'assets/minecraft/shaders/core/terrain.vsh'].filter((n) => zip.has(n));
  const got = await zip.readMany(picks);
  for (const n of picks) assert.deepEqual(got.get(n), local(n), n);
  // The textures block is contiguous: one range covers all of it.
  assert.equal(planRanges(textures).length, 1);
  await assert.rejects(zip.read('nope.txt'), /not in the archive/);
});

async function serve(bytes: Uint8Array, mode: 'range' | 'ignore-range'): Promise<{ url: string; server: Server; hits: string[] }> {
  const hits: string[] = [];
  const server = createServer((req, res) => {
    const range = req.headers.range;
    hits.push(range ?? 'full');
    res.setHeader('Access-Control-Allow-Origin', '*');
    const m = range && /^bytes=(\d+)-(\d+)$/.exec(range);
    if (mode === 'range' && m) {
      const a = Number(m[1]);
      const b = Math.min(bytes.length - 1, Number(m[2]));
      res.writeHead(206, { 'Content-Length': b - a + 1, 'Content-Range': `bytes ${a}-${b}/${bytes.length}` });
      res.end(Buffer.from(bytes.buffer, bytes.byteOffset + a, b - a + 1));
    } else {
      res.writeHead(200, { 'Content-Length': bytes.length });
      res.end(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.length));
    }
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}/client.jar`, server, hits };
}

test('HTTP range reader: few requests for all textures', { skip: !hasJar && 'jar missing' }, async () => {
  const bytes = new Uint8Array(readFileSync(JAR));
  const { url, server, hits } = await serve(bytes, 'range');
  try {
    const src = new HttpRangeSource(url, bytes.length);
    const zip = await RangeZip.open(src);
    const tex = zip.entries.filter((x) => x.name.startsWith(TEX) && !x.name.endsWith('/'));
    const progress: Progress[] = [];
    const files = await zip.readMany([...tex, zip.get('version.json')!], { onProgress: (p) => progress.push(p), label: 'Textures' });
    assert.equal(files.size, tex.length + 1);
    assert.deepEqual(files.get(`${TEX}block/stone.png`), local(`${TEX}block/stone.png`));
    assert.ok(hits.every((h) => h.startsWith('bytes=')), 'only range requests');
    assert.ok(hits.length <= 5, `requests: ${hits.length}`);
    assert.ok(src.bytesFetched < 8 * 1024 * 1024, `fetched ${src.bytesFetched}`);
    assert.equal(progress.at(-1)?.fraction, 1);
    assert.equal(progress.at(-1)?.label, 'Textures');
  } finally {
    server.close();
  }
});

test('HTTP range reader: a 200 full-body reply is accepted and reused', { skip: !hasJar && 'jar missing' }, async () => {
  const bytes = new Uint8Array(readFileSync(JAR));
  const { url, server, hits } = await serve(bytes, 'ignore-range');
  try {
    const src = new HttpRangeSource(url, bytes.length, 'Full download');
    const labels = new Set<string>();
    const zip = await RangeZip.open(src, { onProgress: (p) => labels.add(p.label) });
    assert.ok(src.full, 'kept full body');
    const got = await zip.readMany(['version.json', `${TEX}block/stone.png`]);
    assert.deepEqual(got.get('version.json'), local('version.json'));
    assert.equal(hits.length, 1, 'no further requests after a full body');
  } finally {
    server.close();
  }
});

test('Java loader with a user-provided jar (File): textures, lazy groups, version check', { skip: !hasJar && 'jar missing' }, async () => {
  const blob = await openAsBlob(JAR);
  const file = new File([blob], '26.3.jar');
  const labels: string[] = [];
  const assets = await loadJavaAssets('26.3', { jarFile: file, onProgress: (p) => labels.push(p.label) });
  assert.equal(assets.edition, 'java');
  assert.equal(assets.textures.length, 3964);
  const stone = assets.textures.find((t) => t.id === 'block/stone')!;
  assert.equal(stone.path, `${TEX}block/stone.png`);
  assert.ok(assets.textures.find((t) => t.id === 'block/water_still')?.animated);
  // 218 textures have a .png.mcmeta in 26.3, but only 63 of those are animations.
  assert.equal(assets.textures.filter((t) => t.animated).length, 63);
  assert.ok(!assets.textures.find((t) => t.id === 'gui/sprites/widget/button')?.animated, 'nine-slice metadata is not an animation');
  const img = await assets.readImage(stone.path);
  assert.equal(img.width, 16);
  assert.equal(img.height, 16);
  assert.ok(assets.hasFile('version.json'));
  const shaders = assets.listFiles('assets/minecraft/shaders/');
  assert.ok(shaders.length > 50, `${shaders.length} shader files`);
  assert.ok(shaders.every((s) => s.startsWith('assets/minecraft/shaders/')));
  assert.equal(await assets.readText('assets/minecraft/shaders/core/terrain.vsh'), new TextDecoder().decode(local('assets/minecraft/shaders/core/terrain.vsh')));
  assert.ok(assets.listFiles('assets/minecraft/models/block/').length > 2000);
  assert.ok((await assets.readText('assets/minecraft/lang/en_us.json')).includes('"block.minecraft.stone"'));
  assert.ok(!assets.hasFile('net/minecraft/client/Minecraft.class'));
  await assert.rejects(assets.readFile('assets/minecraft/textures/block/nope.png'), /isn't part of/);
  assert.ok(labels.some((l) => /26\.3/.test(l)));
});

test('Java loader rejects a jar of another version', { skip: !existsSync(JAR_1201) && 'jar missing' }, async () => {
  const file = new File([await openAsBlob(JAR_1201)], '1.20.1.jar');
  await assert.rejects(loadJavaAssets('26.3-mismatch-test', { jarFile: file }), /That jar is Minecraft 1\.20\.1/);
  await assert.rejects(loadJavaAssets('26.3', { jarFile: new File([new Uint8Array(100)], 'x.jar') }), /valid zip/);
});

test('Java loader rejects an old jar (no version.json) picked for another version', { skip: !existsSync(JAR_189) && 'jar missing' }, async () => {
  const file = new File([await openAsBlob(JAR_189)], '1.8.9.jar');
  await assert.rejects(loadJavaAssets('1.20.1', { jarFile: file }), /older Minecraft version/);
  await assert.rejects(loadJavaAssets('1.13.2', { jarFile: file }), /1\.12\.2 or older/);
  const ok = await loadJavaAssets('1.8.9', { jarFile: file });
  assert.ok(ok.textures.some((t) => t.id === 'blocks/stone'));
});

// ---- Live Mojang CDN (skipped when offline) ----

async function online(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { headers: { Range: 'bytes=0-0' }, signal: AbortSignal.timeout(8000) });
    await r.body?.cancel();
    return r.status === 206 || r.status === 200;
  } catch {
    return false;
  }
}

test('LIVE: range-read the real 26.3 client jar from piston-data', { skip: !existsSync(V263) && 'v263.json missing', timeout: 180_000 }, async (t) => {
  const client = JSON.parse(readFileSync(V263, 'utf8')).downloads.client as { url: string; size: number; sha1: string };
  if (!(await online(client.url))) {
    t.skip('Mojang CDN unreachable');
    return;
  }
  const src = new HttpRangeSource(client.url, client.size);
  const zip = await RangeZip.open(src);
  assert.ok(zip.entries.length > 30_000);
  const vj = JSON.parse(new TextDecoder().decode(await zip.read('version.json')));
  assert.equal(vj.id, '26.3');
  assert.deepEqual([vj.pack_version.resource_major, vj.pack_version.resource_minor], [97, 1]);
  const tex = zip.entries.filter((x) => x.name.startsWith(TEX) && x.name.endsWith('.png'));
  assert.equal(tex.length, 3964);
  const files = await zip.readMany(tex);
  assert.equal(files.size, 3964);
  if (hasJar) {
    assert.deepEqual(files.get(`${TEX}block/stone.png`), local(`${TEX}block/stone.png`));
    assert.deepEqual(new TextDecoder().decode(await zip.read('version.json')), new TextDecoder().decode(local('version.json')));
  }
  assert.equal(src.full, undefined, 'served as ranges, not a full download');
  assert.ok(src.bytesFetched < 8 * 1024 * 1024, `fetched ${(src.bytesFetched / 1048576).toFixed(1)} MiB of ${(client.size / 1048576).toFixed(1)} MiB`);
  assert.ok(src.requests <= 6, `${src.requests} requests`);
});
