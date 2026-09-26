// Regression tests for defects found in review of the data module.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { zipSync, strToU8 } from 'fflate';
import { NetError, SharedLoader, createLimiter, fetchResponse, isAbortError, readBodyWithProgress } from '../../src/core/net';
import { HttpRangeSource, RangeZip } from '../../src/core/rangezip';
import { readZip } from '../../src/core/zip';
import { cacheSet } from '../../src/core/storage';
import { buildJavaTextureList, refineAnimated } from '../../src/editions/java/textures';
import { listJavaVersions } from '../../src/editions/java/versions';
import { KNOWN_RELEASES } from '../../src/editions/java/packformats';
import { bedrockDisplayVersion, resolveBedrockVersion } from '../../src/editions/bedrock/versions';

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

test('SharedLoader: one caller aborting does not cancel the load for the others', async () => {
  const loader = new SharedLoader<string>();
  let starts = 0;
  let innerSignal: AbortSignal | undefined;
  const start = async (_emit: unknown, signal: AbortSignal) => {
    starts++;
    innerSignal = signal;
    await tick(30);
    if (signal.aborted) throw Object.assign(new Error('cancelled'), { name: 'AbortError' });
    return 'data';
  };
  const a = new AbortController();
  const p1 = loader.load('k', undefined, start, { signal: a.signal });
  const p2 = loader.load('k', undefined, start);
  a.abort();
  await assert.rejects(p1, (e) => isAbortError(e));
  assert.equal(await p2, 'data');
  assert.equal(starts, 1);
  assert.equal(innerSignal?.aborted, false);
  // Finished results are reused.
  assert.equal(await loader.load('k', undefined, start), 'data');
  assert.equal(starts, 1);
});

test('SharedLoader: the work is cancelled once every caller has aborted, and a new caller starts afresh', async () => {
  const loader = new SharedLoader<string>();
  const signals: AbortSignal[] = [];
  const start = async (_emit: unknown, signal: AbortSignal) => {
    signals.push(signal);
    await tick(30);
    if (signal.aborted) throw Object.assign(new Error('cancelled'), { name: 'AbortError' });
    return `run ${signals.length}`;
  };
  const a = new AbortController();
  const b = new AbortController();
  const p1 = loader.load('k', undefined, start, { signal: a.signal });
  const p2 = loader.load('k', undefined, start, { signal: b.signal });
  a.abort();
  assert.equal(signals[0].aborted, false, 'still wanted by the second caller');
  b.abort();
  assert.equal(signals[0].aborted, true, 'nobody waits any more');
  await assert.rejects(p1, (e) => isAbortError(e));
  await assert.rejects(p2, (e) => isAbortError(e));
  // A caller arriving right after gets a fresh run, not the cancelled one.
  assert.equal(await loader.load('k', undefined, start), 'run 2');
  // An already aborted signal is rejected without starting anything.
  await assert.rejects(loader.load('other', undefined, start, { signal: AbortSignal.abort() }), (e) => isAbortError(e));
  assert.equal(signals.length, 2);
});

test('createLimiter releases its slot when a task throws synchronously', async () => {
  const limit = createLimiter(1);
  const bad = limit((() => {
    throw new Error('boom');
  }) as () => Promise<never>);
  const good = limit(async () => 'ok');
  await assert.rejects(bad, /boom/);
  const result = await Promise.race([good, tick(500).then(() => 'hung')]);
  assert.equal(result, 'ok');
});

async function listen(handler: Parameters<typeof createServer>[1]): Promise<{ url: string; server: Server }> {
  const server = createServer(handler);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/f`, server };
}

test('a stalled response body times out (retryable) instead of hanging forever', async () => {
  const { url, server } = await listen((_req, res) => {
    res.writeHead(200, { 'Content-Length': '1000' });
    res.write(Buffer.alloc(100));
    // ...and never sends the rest.
  });
  try {
    const resp = await fetchResponse(url);
    const err = await readBodyWithProgress(resp, { idleTimeoutMs: 150, url }).then(
      () => null,
      (e: unknown) => e,
    );
    assert.ok(err instanceof NetError, String(err));
    assert.equal(err.kind, 'timeout');
    assert.equal(err.retryable, true);
  } finally {
    server.closeAllConnections();
    server.close();
  }
});

test('HTTP range reader: parallel reads that all get a 200 share one full download', async () => {
  const rand = (n: number, seed: number) => {
    const b = new Uint8Array(n);
    let x = seed;
    for (let i = 0; i < n; i++) b[i] = (x = (x * 1103515245 + 12345) >>> 0) >>> 24;
    return b;
  };
  const MB = 1024 * 1024;
  const files = { a: rand(MB, 1), b: rand(MB, 2), c: rand(MB, 3), d: rand(MB, 4) };
  const zipped = zipSync({ a: [files.a, { level: 0 }], b: [files.b, { level: 0 }], c: [files.c, { level: 0 }], d: [files.d, { level: 0 }] });
  let requests = 0;
  const { url, server } = await listen((req, res) => {
    requests++;
    const m = /^bytes=(\d+)-(\d+)$/.exec(req.headers.range ?? '');
    if (requests === 1 && m) {
      // Only the first (tail) request is honoured; later ones get the whole file, like a cache revalidation.
      const a = Number(m[1]);
      const b = Math.min(zipped.length - 1, Number(m[2]));
      res.writeHead(206, { 'Content-Length': b - a + 1 });
      res.end(Buffer.from(zipped.buffer, zipped.byteOffset + a, b - a + 1));
    } else {
      res.writeHead(200, { 'Content-Length': zipped.length });
      res.end(Buffer.from(zipped.buffer, zipped.byteOffset, zipped.length));
    }
  });
  try {
    const src = new HttpRangeSource(url, zipped.length);
    const zip = await RangeZip.open(src);
    const out = await zip.readMany(['a', 'b', 'c', 'd'], { maxGap: 1024, concurrency: 4 });
    for (const k of ['a', 'b', 'c', 'd'] as const) assert.deepEqual(out.get(k), files[k], k);
    assert.ok(src.full, 'kept the full body');
    assert.ok(src.bytesFetched < zipped.length * 1.5, `downloaded ${src.bytesFetched} bytes for a ${zipped.length} byte file`);
  } finally {
    server.closeAllConnections();
    server.close();
  }
});

test('Java textures: only .mcmeta files with an "animation" section mark a texture animated', () => {
  const root = 'assets/minecraft/textures/';
  const mcmeta: Record<string, string> = {
    [`${root}block/water_still.png.mcmeta`]: '{"animation":{"frametime":2}}',
    [`${root}gui/sprites/widget/button.png.mcmeta`]: '{"gui":{"scaling":{"type":"nine_slice","width":200,"height":20,"border":3}}}',
    [`${root}entity/villager/profession/farmer.png.mcmeta`]: '{"villager":{"hat":"partial"}}',
    [`${root}block/broken.png.mcmeta`]: '{not json',
  };
  const pngs = ['block/water_still', 'gui/sprites/widget/button', 'entity/villager/profession/farmer', 'block/broken', 'block/stone', 'block/lava_still'].map((p) => `${root}${p}.png`);
  const list = buildJavaTextureList([...pngs, ...Object.keys(mcmeta), `${root}block/lava_still.png.mcmeta`]);
  const byId = () => new Map(list.map((t) => [t.id, t.animated ?? false]));
  // From paths alone every .mcmeta counts.
  assert.equal(byId().get('gui/sprites/widget/button'), true);
  refineAnimated(list, (p) => (mcmeta[p] ? strToU8(mcmeta[p]) : undefined));
  const after = byId();
  assert.equal(after.get('block/water_still'), true);
  assert.equal(after.get('gui/sprites/widget/button'), false);
  assert.equal(after.get('entity/villager/profession/farmer'), false);
  assert.equal(after.get('block/broken'), true, 'unreadable metadata keeps the flag');
  assert.equal(after.get('block/lava_still'), true, 'metadata not loaded yet keeps the flag');
  assert.equal(after.get('block/stone'), false);
});

test('readZip refuses archives that claim to unpack to more than 1 GB (zip bombs)', async () => {
  const zipped = zipSync({ 'pack.mcmeta': strToU8('{"pack":{}}'), 'big.bin': new Uint8Array(64) }, { level: 0 });
  // Patch the declared uncompressed size of big.bin in the central directory and local header to 2 GB.
  const view = new DataView(zipped.buffer, zipped.byteOffset, zipped.byteLength);
  const dec = new TextDecoder();
  for (let i = 0; i + 46 < zipped.length; i++) {
    const sig = view.getUint32(i, true);
    if (sig === 0x02014b50 && dec.decode(zipped.subarray(i + 46, i + 46 + view.getUint16(i + 28, true))) === 'big.bin') view.setUint32(i + 24, 0x7fffffff, true);
    if (sig === 0x04034b50 && dec.decode(zipped.subarray(i + 30, i + 30 + view.getUint16(i + 26, true))) === 'big.bin') view.setUint32(i + 22, 0x7fffffff, true);
  }
  await assert.rejects(readZip(zipped), /too large/);
  // A filter that skips the huge entry still works.
  const ok = await readZip(zipped, (p) => p === 'pack.mcmeta');
  assert.deepEqual(Object.keys(ok), ['pack.mcmeta']);
});

test('Java version list falls back to the bundled releases on any Mojang failure (e.g. HTTP 404/5xx)', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response('not here', { status: 404 })) as typeof fetch;
  try {
    const list = await listJavaVersions();
    assert.equal(list.length, KNOWN_RELEASES.length);
    assert.equal(list[0].id, '26.3');
    assert.deepEqual(list[0].packFormat, { major: 97, minor: 1 });
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('Bedrock: display names and resolving the current release by number', async () => {
  assert.equal(bedrockDisplayVersion('1.26.0.2'), '26.0');
  assert.equal(bedrockDisplayVersion('1.26.10.4'), '26.10');
  await cacheSet('bedrock:versions', {
    at: Date.now(),
    src: {
      main: { latest: { version: '1.26.40.5', date: '04-08-2026' }, '1.26.40.5': { version: '1.26.40.5' }, '1.26.30.5': { version: '1.26.30.5' } },
      preview: { latest: { version: '1.26.50.27', date: '01-09-2026', type: 'preview' } },
      tags: ['1.26.50.27-preview', '1.26.40.05', '1.26.30.5'],
    },
  });
  // The latest release is listed as 'latest'; its number still resolves to the real (irregular) tag.
  assert.equal((await resolveBedrockVersion('1.26.40.5')).ref, 'v1.26.40.05');
  assert.equal((await resolveBedrockVersion('1.26.50.27-preview')).ref, 'v1.26.50.27-preview');
  assert.equal((await resolveBedrockVersion('1.26.30.5')).ref, 'v1.26.30.5');
  assert.equal((await resolveBedrockVersion('latest')).ref, 'main');
});
