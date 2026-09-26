import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import type { Progress } from '../../src/core/types';
import { fixturesDir } from '../tools/data/fixtures';

/*
 * Whole Java pipeline against a mocked Mojang: manifest -> version JSON -> jar.
 * The jar host refuses Range requests (as a CDN answering a preflight with 403 would),
 * so the loader must fall back to one full download with progress.
 */

const SCRATCH = fixturesDir();
const JAR = `${SCRATCH}/research-cache/jars/1.12.2.jar`;

test('range failure falls back to a full download; all groups cached', { skip: !existsSync(JAR) && 'jar missing' }, async () => {
  const jar = new Uint8Array(readFileSync(JAR));
  const seen: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const range = new Headers(init?.headers).get('range');
    seen.push(`${url}${range ? ' ' + range : ''}`);
    if (url.includes('version_manifest_v2.json'))
      return Response.json({
        latest: { release: 'mock-1', snapshot: 'mock-1' },
        versions: [{ id: 'mock-1', type: 'release', url: 'https://mock.test/mock-1.json', time: '2017-09-18T08:39:46+00:00', releaseTime: '2017-09-18T08:39:46+00:00', sha1: 'abc' }],
      });
    if (url === 'https://mock.test/mock-1.json') return Response.json({ id: 'mock-1', downloads: { client: { url: 'https://mock.test/client.jar', size: jar.length, sha1: 'def' } } });
    if (url === 'https://mock.test/client.jar') {
      if (range) return new Response('forbidden', { status: 403 });
      return new Response(jar, { status: 200, headers: { 'content-length': String(jar.length) } });
    }
    return new Response('nope', { status: 404 });
  }) as typeof fetch;
  try {
    const { loadJavaAssets, isJavaAssetsCached, readCachedJarText } = await import('../../src/editions/java/assets');
    const progress: Progress[] = [];
    const assets = await loadJavaAssets('mock-1', { onProgress: (p) => progress.push(p) });
    // research/java-packs.md §4.1: 1.12.2 has 1,406 PNGs, 478 of them in blocks/
    assert.equal(assets.textures.length, 1406);
    assert.equal(assets.textures.filter((t) => t.category === 'block').length, 478);
    assert.ok(assets.textures.some((t) => t.id === 'blocks/stone'));
    assert.ok(seen.some((s) => s.endsWith('client.jar')), 'full download happened');
    const full = progress.filter((p) => p.label === 'Downloading Minecraft mock-1');
    assert.ok(full.length > 0 && full.at(-1)!.fraction === 1, 'progress reached 100%');
    assert.equal(full.at(-1)!.loaded, jar.length);
    // Everything was extracted from the full jar: lazy groups need no more requests.
    const before = seen.length;
    const model = await assets.readText('assets/minecraft/models/block/stone.json');
    assert.ok(model.includes('blocks/stone'));
    assert.ok(assets.listFiles('assets/minecraft/shaders/').length > 50);
    assert.ok((await assets.readText('assets/minecraft/lang/en_us.lang')).includes('tile.stone.stone.name'));
    assert.equal(seen.length, before, 'no network for lazy groups');
    assert.equal(await isJavaAssetsCached('mock-1'), true);
    assert.equal(await readCachedJarText('mock-1', 'assets/minecraft/models/block/stone.json'), model);
    // Same promise for concurrent callers.
    assert.equal(loadJavaAssets('mock-1'), loadJavaAssets('mock-1'));
  } finally {
    globalThis.fetch = realFetch;
  }
});
