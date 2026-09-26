import { listVersions, loadAssets, isAssetsCached, getDefaultVersion, getJavaPackFormat, buildPackMcmetaForVersions } from '../../../src/editions/index';
import { prefetchJavaGroups } from '../../../src/editions/java/assets';
import { bedrockCatalogSource, bedrockRefOf } from '../../../src/editions/bedrock/assets';
import { imageDataToDataUrl, encodeImage, decodeImage, imageDataToCanvas, fitToSize } from '../../../src/core/image';
import { saveBlob } from '../../../src/core/download';
import { saveProject, listProjects, getProject, deleteProject, cacheKeys, estimateUsage, clearAssetCache } from '../../../src/core/storage';
import { writeZip, readZip } from '../../../src/core/zip';
import type { Progress, TexturePackProject } from '../../../src/core/types';

const log = (s: string) => {
  document.getElementById('log')!.textContent += s + '\n';
};
const show = (img: ImageData, title: string) => {
  const el = document.createElement('img');
  el.src = imageDataToDataUrl(img);
  el.title = title;
  document.getElementById('imgs')!.appendChild(el);
};

const steps: Record<string, (arg?: unknown) => Promise<unknown>> = {
  async versions() {
    const java = await listVersions('java');
    const javaSnap = await listVersions('java', { includeSnapshots: true });
    const bedrock = await listVersions('bedrock');
    const bedrockAll = await listVersions('bedrock', { includeSnapshots: true });
    return {
      java: java.length,
      javaFirst: java[0],
      javaSnap: javaSnap.length,
      javaOldest: java.at(-1)?.id,
      default: await getDefaultVersion('java'),
      bedrock: bedrock.length,
      bedrockFirst: bedrock.slice(0, 3),
      bedrockAll: bedrockAll.length,
      bedrockDefault: await getDefaultVersion('bedrock'),
      snapshotFormat: await getJavaPackFormat('26.4-snapshot-1'),
      preReleaseFormat: await getJavaPackFormat('1.14.2 Pre-Release 1'),
      aprilFoolsFormat: await getJavaPackFormat('20w14infinite'),
      mcmeta: await buildPackMcmetaForVersions('Hello', '26.3', { minVersion: '1.20.1', maxVersion: '26.3' }),
    };
  },
  async java(arg) {
    const version = (arg as string) ?? '26.3';
    const labels: string[] = [];
    let last: Progress | null = null;
    const t0 = performance.now();
    const cachedBefore = await isAssetsCached('java', version);
    const assets = await loadAssets('java', version, {
      onProgress: (p) => {
        last = p;
        if (!labels.includes(p.label)) labels.push(p.label);
      },
    });
    const ms = Math.round(performance.now() - t0);
    const stone = assets.textures.find((t) => t.id === 'block/stone' || t.id === 'blocks/stone')!;
    const img = await assets.readImage(stone.path);
    show(img, stone.id);
    for (const id of ['block/grass_block_side', 'item/diamond_sword', 'entity/player/wide/steve', 'block/water_still']) {
      const t = assets.textures.find((x) => x.id === id);
      if (t) show(await assets.readImage(t.path), id);
    }
    return {
      ms,
      cachedBefore,
      cachedAfter: await isAssetsCached('java', version),
      textures: assets.textures.length,
      animated: assets.textures.filter((t) => t.animated).length,
      labels,
      last,
      stone: [img.width, img.height],
      shaderFiles: assets.listFiles('assets/minecraft/shaders/').length,
    };
  },
  async javaLazy(arg) {
    const version = (arg as string) ?? '26.3';
    const assets = await loadAssets('java', version);
    const t0 = performance.now();
    const shaders = assets.listFiles('assets/minecraft/shaders/core/');
    const first = await assets.readText(shaders.find((s) => s.endsWith('.vsh')) ?? shaders[0]);
    const posts = assets.listFiles('assets/minecraft/post_effect/');
    const post = posts.length ? await assets.readText(posts[0]) : '';
    const lang = await assets.readText('assets/minecraft/lang/en_us.json').catch((e) => String(e));
    const labels: string[] = [];
    await prefetchJavaGroups(assets, ['models', 'blockstates', 'items', 'atlases'], { onProgress: (p) => !labels.includes(p.label) && labels.push(p.label) });
    const model = await assets.readText('assets/minecraft/models/block/stone.json');
    return { ms: Math.round(performance.now() - t0), shaders: shaders.length, vshLen: first.length, post: post.slice(0, 40), langHasStone: lang.includes('block.minecraft.stone'), model, labels };
  },
  async bedrock(arg) {
    const version = (arg as string) ?? 'latest';
    const t0 = performance.now();
    const assets = await loadAssets('bedrock', version);
    const listMs = Math.round(performance.now() - t0);
    const t1 = performance.now();
    const results: Record<string, unknown> = {};
    for (const id of ['blocks/stone', 'blocks/leaves_oak', 'blocks/grass_side', 'entity/sheep/sheep', 'items/apple', 'blocks/tallgrass']) {
      const t = assets.textures.find((x) => x.id === id);
      if (!t) {
        results[id] = 'missing';
        continue;
      }
      const img = await assets.readImage(t.path);
      show(img, id);
      let hidden = 0;
      for (let i = 0; i < img.data.length; i += 4) if (img.data[i + 3] === 0 && (img.data[i] || img.data[i + 1] || img.data[i + 2])) hidden++;
      results[id] = { ext: t.ext, size: [img.width, img.height], alpha0WithColour: hidden };
    }
    const manifest = assets.hasFile('manifest.json') ? JSON.parse(await assets.readText('manifest.json')) : { header: {} };
    return {
      listMs,
      readMs: Math.round(performance.now() - t1),
      textures: assets.textures.length,
      animated: assets.textures.filter((t) => t.animated).length,
      results,
      minEngine: manifest.header.min_engine_version,
      ref: bedrockRefOf(assets),
      source: bedrockCatalogSource(assets),
      cached: await isAssetsCached('bedrock', version),
    };
  },
  async bedrockThumbs() {
    const assets = await loadAssets('bedrock', 'latest');
    const t0 = performance.now();
    const blocks = assets.textures.filter((t) => t.category === 'block').slice(0, 120);
    await Promise.all(blocks.map((t) => assets.readImage(t.path)));
    return { n: blocks.length, ms: Math.round(performance.now() - t0) };
  },
  async storage() {
    const p: TexturePackProject = {
      kind: 'texturepack', id: 'harness-1', name: 'Harness', createdAt: 0, updatedAt: 0, edition: 'java', version: '26.3', description: 'd',
      resolution: 16, overrides: { 'assets/minecraft/textures/block/stone.png': new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }) }, extraFiles: {}, effects: [],
    };
    await saveProject(p);
    const listed = await listProjects('texturepack');
    const got = await getProject<TexturePackProject>('harness-1');
    const blobBytes = got ? [...new Uint8Array(await got.overrides['assets/minecraft/textures/block/stone.png'].arrayBuffer())] : null;
    await deleteProject('harness-1');
    const after = await listProjects();
    return { listed: listed.map((x) => x.id), updatedAt: got?.updatedAt ? 'set' : 'unset', blobBytes, afterDelete: after.filter((x) => x.id === 'harness-1').length, cacheKeys: (await cacheKeys('java-assets:')).length, usage: await estimateUsage() };
  },
  async zipAndDownload() {
    const img = new ImageData(new Uint8ClampedArray([255, 0, 0, 0, 0, 255, 0, 128, 0, 0, 255, 255, 9, 9, 9, 0]), 2, 2);
    const blob = await writeZip({ 'manifest.json': '{"a":1}', 'textures/blocks/x.png': await encodeImage(img, 'png'), 'textures/blocks/y.tga': await encodeImage(img, 'tga') });
    const back = await readZip(blob);
    saveBlob(blob, 'My Pack: v1?.mcpack');
    return { entries: Object.keys(back).sort(), size: blob.size };
  },
  async formats() {
    const c = document.createElement('canvas');
    c.width = 20;
    c.height = 10;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, 10, 10);
    ctx.fillStyle = '#0000ff';
    ctx.fillRect(10, 0, 10, 10);
    const out: Record<string, unknown> = {};
    for (const type of ['image/jpeg', 'image/webp', 'image/png']) {
      const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), type, 0.95));
      const img = await decodeImage(blob);
      out[type] = { size: [img.width, img.height], left: [...img.data.subarray(0, 4)], right: [...img.data.subarray(15 * 4, 15 * 4 + 4)] };
    }
    const fitted = fitToSize(await decodeImage(await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/png'))), 16, 16, 'nearest');
    const canvas = imageDataToCanvas(fitted);
    out.canvas = [canvas.width, canvas.height, [...canvas.getContext('2d')!.getImageData(0, 8, 1, 1).data]];
    return out;
  },
  async clear() {
    await clearAssetCache();
    return { keys: (await cacheKeys()).length };
  },
};

(window as unknown as { run: (name: string, arg?: unknown) => Promise<unknown> }).run = async (name, arg) => {
  try {
    const r = await steps[name](arg);
    log(`${name}: ${JSON.stringify(r)}`);
    return r;
  } catch (err) {
    log(`${name} FAILED: ${err instanceof Error ? err.message : String(err)}`);
    throw err;
  }
};
(window as unknown as { ready: boolean }).ready = true;
