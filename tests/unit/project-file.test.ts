// Project files (.tpmproject) and backups (.tpmbackup): every tool's project survives a round trip
// through a file, the manifest is checked (damaged, foreign and newer files are refused with the
// right code), older format versions are migrated, and restoring keeps ids, skips or copies
// projects that are already here, and keeps skin packs pointing at their skins.
// Run: npx tsx --test tests/unit/project-file.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8, unzipSync, strFromU8 } from 'fflate';
import { createImageData, encodePng } from '../../src/core/image';
import { getProject, listProjects, saveProject, deleteProject, cacheGet } from '../../src/core/storage';
import type { Project, TexturePackProject } from '../../src/core/types';
import {
  FORMAT_VERSION,
  ProjectFileError,
  backupFileName,
  migrateArchive,
  projectFileName,
  readProjectArchive,
  validateManifest,
  writeProjectArchive,
  type ProjectItem,
} from '../../src/shared/project-file/format';
import { CAPE_ID, FONT_ID, capeItem, collectAll, collectProject, fontItem, readCapeItem, readFontItem, restoreItems } from '../../src/shared/project-file/records';
import { readSavedCape, readCapeSettings } from '../../src/tools/skins/cape/store';
import { readDraftJson } from '../../src/tools/fonts/draft';
import type { SkinProjectData } from '../../src/tools/skins/export';
import type { ImportedPackProject } from '../../src/tools/shaders/packedit/store';
import type { ShaderProjectData } from '../../src/tools/shaders/ui/project';

// localStorage for the cape and font makers' drafts
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
};

function png(w: number, h: number, rgba: [number, number, number, number]): Blob {
  const img = createImageData(w, h);
  for (let i = 0; i < w * h; i++) img.data.set(rgba, i * 4);
  return new Blob([encodePng(img)], { type: 'image/png' });
}
const bytesOf = async (b: Blob) => Array.from(new Uint8Array(await b.arrayBuffer()));

/** A plain copy where every Blob and byte array is replaced by its bytes (for deepEqual). */
async function plainOf(v: unknown): Promise<unknown> {
  if (v instanceof Blob) return { blob: await bytesOf(v), type: v.type };
  if (v instanceof Uint8Array) return { bytes: Array.from(v) };
  if (Array.isArray(v)) return Promise.all(v.map(plainOf));
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) if (x !== undefined) out[k] = await plainOf(x);
    return out;
  }
  return v;
}

async function roundTrip(tool: Parameters<typeof writeProjectArchive>[0], items: ProjectItem[]): Promise<ProjectItem[]> {
  const blob = await writeProjectArchive(tool, items, new Date('2026-10-22T10:00:00Z'));
  const archive = await readProjectArchive(blob);
  assert.equal(archive.manifest.tool, tool);
  assert.equal(archive.manifest.version, FORMAT_VERSION);
  assert.equal(archive.manifest.created, '2026-10-22T10:00:00.000Z');
  return archive.manifest.items.map((it) => archive.load(it));
}

function texturePack(id = 'tex-1'): TexturePackProject {
  return {
    id,
    kind: 'texturepack',
    name: 'Ocean §bBlue',
    createdAt: 100,
    updatedAt: 200,
    edition: 'bedrock',
    version: '26.30',
    description: 'Made with Texture Pack Maker',
    icon: png(16, 16, [10, 20, 30, 255]),
    resolution: 32,
    overrides: {
      'textures/blocks/stone.png': png(32, 32, [120, 120, 120, 255]),
      'textures/blocks/sand.tga': new Blob([new Uint8Array([0, 0, 2, 0, 9])]),
    },
    extraFiles: { 'texts/en_US.lang': new Blob(['pack.name=Ocean'], { type: 'text/plain' }), 'sounds/random/click.ogg': new Blob([strToU8('OggS-fake')], { type: 'audio/ogg' }) },
    effects: [{ id: 'ab12cd34', type: 'hue', enabled: true, params: { shift: 30, keep: true, mode: 'soft' }, categories: ['block'] }],
    bedrockUuids: { header: '11111111-1111-4111-8111-111111111111', module: '22222222-2222-4222-8222-222222222222' },
    packVersion: [1, 0, 3],
    sounds: { 'sounds/random/click.ogg': { source: new Blob([strToU8('RIFF')], { type: 'audio/wav' }), sourceName: 'click.wav', start: 0.1, end: 0.4, gain: 1.2, stereo: false, updatedAt: 5 } },
    pvp: {
      tweaks: {
        lowFire: {
          options: { height: 'low', keepBlocks: true },
          textures: [{ path: 'textures/blocks/fire_0.png', before: null, hash: 'abc' }, { path: 'textures/blocks/fire_1.png', before: png(16, 16, [255, 0, 0, 255]), hash: 'def' }],
          files: [],
          displays: [],
          appliedAt: 7,
        },
      },
    },
  };
}

test('a texture pack project survives a project file exactly', async () => {
  const p = texturePack();
  const [back] = await roundTrip('textures', [{ type: 'texturepack', id: p.id, name: p.name, updatedAt: p.updatedAt, data: { project: p } }]);
  assert.equal(back.type, 'texturepack');
  assert.equal(back.id, 'tex-1');
  assert.deepEqual(await plainOf(back.data.project), await plainOf(p));
  const bp = back.data.project as TexturePackProject;
  assert.ok(bp.overrides['textures/blocks/stone.png'] instanceof Blob);
  assert.equal(bp.overrides['textures/blocks/stone.png'].type, 'image/png');
  assert.equal(bp.pvp!.tweaks.lowFire.textures[0].before, null, 'null stays null');
});

test('textures are PNG files at their pack paths, and the game’s own files are not in the file', async () => {
  const p = texturePack();
  const blob = await writeProjectArchive('textures', [{ type: 'texturepack', id: p.id, name: p.name, data: { project: p } }]);
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  const names = Object.keys(files).sort();
  assert.equal(names[0], 'items/0-texturepack/item.json');
  assert.ok(names.includes('manifest.json'));
  assert.ok(names.includes('items/0-texturepack/project/overrides/textures/blocks/stone.png'));
  assert.ok(names.includes('items/0-texturepack/project/icon.png'), 'a Blob without a name gets an extension from its type');
  assert.ok(names.includes('items/0-texturepack/project/pvp/tweaks/lowFire/textures/1/before.png'));
  assert.ok(names.includes('items/0-texturepack/project/extraFiles/sounds/random/click.ogg'));
  assert.equal(names.length, 9, names.join('\n'));
  const manifest = JSON.parse(strFromU8(files['manifest.json']));
  assert.equal(manifest.format, 'texture-pack-maker');
  assert.equal(manifest.tool, 'textures');
  assert.deepEqual(Object.keys(manifest.app), ['name', 'build', 'url']);
  assert.deepEqual(manifest.items, [{ type: 'texturepack', id: 'tex-1', name: 'Ocean §bBlue', dir: 'items/0-texturepack/' }]);
});

test('keys that look like file markers stay data', async () => {
  const data = { project: { id: 's', kind: 'skin', $file: 'not a file', $$x: 1, nested: { $map: 'text' } } };
  const [back] = await roundTrip('skins', [{ type: 'skin', id: 's', name: '', data }]);
  assert.deepEqual(back.data, data);
});

test('skins, skin packs, shaders and imported shader packs survive a project file', async () => {
  const skin: SkinProjectData = { id: 'sk-1', kind: 'skin', name: 'Knight', model: 'slim', image: png(64, 64, [1, 2, 3, 255]), createdAt: 1, updatedAt: 2, source: 'template', packSkinIds: ['sk-2'], packName: 'Squad', bedrockUuids: { header: 'h', module: 'm' }, packVersion: [1, 0, 1] };
  const member: SkinProjectData = { id: 'sk-2', kind: 'skin', name: 'Archer', model: 'classic', image: png(128, 128, [9, 9, 9, 255]), createdAt: 1, updatedAt: 3 };
  const pack = await roundTrip('skinpack', [
    { type: 'skin', id: skin.id, name: skin.name, data: { project: skin } },
    { type: 'skin', id: member.id, name: member.name, data: { project: member } },
  ]);
  assert.deepEqual(await plainOf(pack.map((i) => i.data.project)), await plainOf([skin, member]));

  const shader: ShaderProjectData = { id: 'sh-1', kind: 'shader', name: 'Soft', createdAt: 1, updatedAt: 2, target: 'iris', version: '26.3', description: '', settings: { bloom: 0.4, shadows: true, sky: '#88aaff' }, preset: 'cinematic', thumb: png(8, 8, [0, 0, 0, 255]), previewTextures: { kind: 'simple' } };
  const [sh] = await roundTrip('shaders', [{ type: 'shader', id: shader.id, name: shader.name, data: { project: shader } }]);
  assert.deepEqual(await plainOf(sh.data.project), await plainOf(shader));

  const imported = { ...shader, id: 'sh-2', source: 'imported', packFormat: 'iris', fileKey: 'packedit:v1:sh-2', sourceName: 'BSL.zip', fileCount: 2, byteSize: 30 } as ImportedPackProject;
  const files = { 'shaders/final.fsh': strToU8('void main(){}'), 'shaders/shaders.properties': strToU8('sliders=A') };
  const [im] = await roundTrip('shaders', [{ type: 'shader', id: imported.id, name: imported.name, data: { project: imported, files, edits: { 'shaders/final.fsh': '// edited' } } }]);
  assert.deepEqual(await plainOf(im.data), await plainOf({ project: imported, files, edits: { 'shaders/final.fsh': '// edited' } }));
  assert.ok((im.data.files as Record<string, unknown>)['shaders/final.fsh'] instanceof Uint8Array);
});

test('the cape and the font survive a project file with their settings', async () => {
  const capePng = new Uint8Array(await png(64, 32, [200, 30, 40, 255]).arrayBuffer());
  const cape = capeItem({ png: capePng, name: 'Red', t: 5 }, { wear: 'elytra', edition: 'bedrock', uuids: { header: 'a', module: 'b' }, packVersion: [1, 0, 2] })!;
  const [c] = await roundTrip('cape', [cape]);
  const read = await readCapeItem(c);
  assert.deepEqual(Array.from(read.png), Array.from(capePng));
  assert.equal(read.name, 'Red');
  assert.deepEqual(read.settings, { wear: 'elytra', edition: 'bedrock', uuids: { header: 'a', module: 'b' }, packVersion: [1, 0, 2] });

  const draft = { v: 1 as const, size: 8 as const, space: 5, glyphs: { '41': 'AAEC', '416': 'Pz8=' } };
  const ttf = { bytes: new Uint8Array([0, 1, 0, 0, 7, 7]), file: 'Pixel.ttf', size: 9.5, oversample: 4, shift: [0, 1] as [number, number], chars: [65, 66] };
  const font = fontItem({ draft, name: 'Blocky', ttf, settings: { edition: 'java', javaVersion: '1.21.11', packName: 'Blocky font' } })!;
  const [f] = await roundTrip('fonts', [font]);
  const fr = await readFontItem(f);
  assert.deepEqual(fr.draft, draft);
  assert.equal(fr.name, 'Blocky');
  assert.deepEqual({ ...fr.ttf!, bytes: Array.from(fr.ttf!.bytes) }, { ...ttf, bytes: Array.from(ttf.bytes) });
  assert.deepEqual(fr.settings, { edition: 'java', javaVersion: '1.21.11', packName: 'Blocky font' });
});

// ---------------------------------------------------------------------------------------------

const zipOf = (files: Record<string, string>) => zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])));
const manifest = (extra: Record<string, unknown> = {}) => JSON.stringify({ format: 'texture-pack-maker', version: 1, tool: 'skins', created: '2026-01-01T00:00:00Z', items: [{ type: 'skin', id: 'a', name: 'A', dir: 'items/0-skin/' }], ...extra });

async function codeOf(data: Uint8Array): Promise<string> {
  try {
    await readProjectArchive(data);
    return 'ok';
  } catch (err) {
    assert.ok(err instanceof ProjectFileError, String(err));
    assert.ok(err.message.length > 10);
    return err.code;
  }
}

test('files that are not project files, damaged or newer are refused with a clear reason', async () => {
  assert.equal(await codeOf(strToU8('hello')), 'not-zip');
  assert.equal(await codeOf(zipOf({ 'pack.mcmeta': '{"pack":{}}', 'assets/minecraft/textures/block/stone.png': 'x' })), 'not-project');
  assert.equal(await codeOf(zipOf({ 'manifest.json': '{"format_version":2,"header":{}}' })), 'not-project', 'a Bedrock pack');
  assert.equal(await codeOf(zipOf({ 'manifest.json': '{ broken' })), 'damaged');
  assert.equal(await codeOf(zipOf({ 'manifest.json': manifest({ version: 0 }) })), 'damaged');
  assert.equal(await codeOf(zipOf({ 'manifest.json': manifest({ version: 1.5 }) })), 'damaged');
  assert.equal(await codeOf(zipOf({ 'manifest.json': manifest({ items: 'none' }) })), 'damaged');
  assert.equal(await codeOf(zipOf({ 'manifest.json': manifest({ version: FORMAT_VERSION + 1 }) })), 'newer');
  assert.equal(await codeOf(zipOf({ 'manifest.json': manifest({ items: [] }) })), 'empty');
  assert.equal(await codeOf(zipOf({ 'manifest.json': manifest({ items: [{ type: 'world', id: 'w', name: 'W', dir: 'items/0-world/' }] }) })), 'empty', 'unknown kinds are left out');
  assert.equal(await codeOf(zipOf({ 'manifest.json': manifest({ items: [{ type: 'skin', id: 'a', name: 'A', dir: '../' }] }) })), 'empty', 'folders outside items/ are refused');
  assert.equal(await codeOf(zipOf({ 'manifest.json': manifest() })), 'ok');
  // An item whose data is missing is damaged when it is loaded, not before.
  const archive = await readProjectArchive(zipOf({ 'manifest.json': manifest() }));
  assert.throws(() => archive.load(archive.manifest.items[0]), (e: unknown) => e instanceof ProjectFileError && e.code === 'damaged');
  const missingFile = await readProjectArchive(zipOf({ 'manifest.json': manifest(), 'items/0-skin/item.json': JSON.stringify({ data: { project: { image: { $file: 'image.png' } } } }) }));
  assert.throws(() => missingFile.load(missingFile.manifest.items[0]), (e: unknown) => e instanceof ProjectFileError && e.code === 'damaged');
  const escape = await readProjectArchive(zipOf({ 'manifest.json': manifest(), 'items/0-skin/item.json': JSON.stringify({ data: { project: { image: { $file: '../../manifest.json' } } } }) }));
  assert.throws(() => escape.load(escape.manifest.items[0]), (e: unknown) => e instanceof ProjectFileError && e.code === 'damaged', 'files outside the item folder are never read');
});

test('manifest validation: tool, names and defaults', () => {
  const m = validateManifest({ format: 'texture-pack-maker', version: 1, items: [{ type: 'font', id: 'font', name: 42, dir: 'items/0-font/', updatedAt: 'x' }] });
  assert.equal(m.tool, 'fonts', 'a missing tool comes from the only item');
  assert.equal(m.items[0].name, '');
  assert.equal(m.items[0].updatedAt, undefined);
  const b = validateManifest({ format: 'texture-pack-maker', version: 1, tool: 'nope', items: [{ type: 'skin', id: 'a', dir: 'items/0-skin/' }, { type: 'cape', id: 'cape', dir: 'items/1-cape/' }] });
  assert.equal(b.tool, 'backup');
  assert.throws(() => validateManifest({ format: 'other', version: 1, items: [] }), (e: unknown) => e instanceof ProjectFileError && e.code === 'not-project');
});

test('older format versions are migrated step by step, and a missing step is refused', async () => {
  // A future format 3 that renamed "items" to "projects" in version 2 and the tool "skins" to "skin" in 3.
  const steps = {
    1: (a: { manifest: Record<string, unknown> & { version: number }; files: Record<string, Uint8Array> }) => ({ ...a, manifest: { ...a.manifest, projects: a.manifest.items } }),
    2: (a: { manifest: Record<string, unknown> & { version: number }; files: Record<string, Uint8Array> }) => {
      const { projects, ...rest } = a.manifest;
      return { ...a, manifest: { ...rest, items: projects, tool: 'skins' } };
    },
  };
  const raw = { manifest: { format: 'texture-pack-maker', version: 1, tool: 'skins', items: [{ type: 'skin', id: 'a', name: 'A', dir: 'items/0-skin/' }] }, files: {} };
  const out = migrateArchive(raw, 3, steps);
  assert.equal(out.manifest.version, 3);
  assert.deepEqual(validateManifest(out.manifest, { target: 3 }).items.map((i) => i.id), ['a']);
  assert.throws(() => migrateArchive({ ...raw, manifest: { ...raw.manifest, version: 1 } }, 3, { 1: steps[1] }), (e: unknown) => e instanceof ProjectFileError && e.code === 'damaged');
  // Through readProjectArchive: a version 1 file read by a version 2 reader
  const file = zipOf({ 'manifest.json': manifest(), 'items/0-skin/item.json': JSON.stringify({ data: { project: { kind: 'skin' } } }) });
  const archive = await readProjectArchive(file, { target: 2, migrations: { 1: (a) => ({ ...a, manifest: { ...a.manifest, tool: 'skinpack' } }) } });
  assert.equal(archive.manifest.version, 2);
  assert.equal(archive.manifest.tool, 'skinpack');
  assert.equal(await codeOf(zipOf({ 'manifest.json': manifest({ version: 2 }) })), 'newer', 'this version still refuses format 2');
});

test('file names', () => {
  assert.equal(projectFileName('My Pack'), 'My Pack.tpmproject');
  assert.equal(projectFileName('§aGreen: pack?'), 'Green_ pack_.tpmproject');
  assert.equal(projectFileName(''), 'project.tpmproject');
  assert.equal(projectFileName('x.tpmproject'), 'x.tpmproject');
  assert.equal(backupFileName(new Date(2026, 9, 2)), 'Texture Pack Maker backup 2026-10-02.tpmbackup');
});

// ---------------------------------------------------------------------------------------------
// Restoring into this browser (in Node the storage lives in memory)

async function clearProjects(): Promise<void> {
  for (const p of await listProjects()) await deleteProject(p.id);
  store.clear();
}

test('restoring a texture pack keeps its id and time, and is identical to what was saved', async () => {
  await clearProjects();
  const p = texturePack('tex-r');
  await saveProject(p, { keepTime: true });
  const { tool, items } = await collectProject('tex-r');
  assert.equal(tool, 'textures');
  const blob = await writeProjectArchive(tool, items);
  await clearProjects();
  const archive = await readProjectArchive(blob);
  const [r] = await restoreItems(archive.manifest.items.map((i) => archive.load(i)), { existing: 'copy' });
  assert.equal(r.status, 'added');
  assert.equal(r.id, 'tex-r');
  const back = await getProject<TexturePackProject>('tex-r');
  assert.deepEqual(await plainOf(back), await plainOf(p));
});

test('projects already here are skipped, or copied with new ids and new Bedrock uuids', async () => {
  await clearProjects();
  const p = texturePack('tex-d');
  await saveProject(p, { keepTime: true });
  const item: ProjectItem = { type: 'texturepack', id: p.id, name: p.name, data: { project: p } };
  const [skipped] = await restoreItems([item], { existing: 'skip' });
  assert.equal(skipped.status, 'skipped');
  assert.equal((await listProjects()).length, 1);
  const [copy] = await restoreItems([item], { existing: 'copy' });
  assert.equal(copy.status, 'copy');
  assert.notEqual(copy.id, 'tex-d');
  const c = (await getProject<TexturePackProject>(copy.id))!;
  assert.equal(c.name, 'Ocean §bBlue (copy)');
  assert.notDeepEqual(c.bedrockUuids, p.bedrockUuids);
  assert.equal(c.packVersion, undefined);
  assert.equal(Object.keys(c.overrides).length, 2);
  assert.ok(c.updatedAt >= Date.now() - 5000, 'a copy is new');
  assert.equal((await getProject<TexturePackProject>('tex-d'))!.name, 'Ocean §bBlue', 'the one here is unchanged');
});

test('a skin pack opened as a copy points at the copies of its skins', async () => {
  await clearProjects();
  const img = png(64, 64, [5, 5, 5, 255]);
  const main: SkinProjectData = { id: 'm', kind: 'skin', name: 'Main', model: 'classic', image: img, createdAt: 1, updatedAt: 1, packSkinIds: ['k1', 'k2', 'gone'] };
  const k1: SkinProjectData = { id: 'k1', kind: 'skin', name: 'One', model: 'slim', image: img, createdAt: 1, updatedAt: 1 };
  const k2: SkinProjectData = { id: 'k2', kind: 'skin', name: 'Two', model: 'classic', image: img, createdAt: 1, updatedAt: 1 };
  for (const s of [main, k1, k2]) await saveProject(s as Project, { keepTime: true });
  const { tool, items } = await collectProject('m');
  assert.equal(tool, 'skinpack');
  assert.deepEqual(items.map((i) => i.id), ['m', 'k1', 'k2'], 'a skin that was deleted stays out');
  const results = await restoreItems(items, { existing: 'copy' });
  const ids = results.map((r) => r.id);
  assert.ok(ids.every((id, i) => id !== items[i].id));
  const restored = (await getProject<SkinProjectData>(ids[0]))!;
  assert.deepEqual(restored.packSkinIds, [ids[1], ids[2], 'gone']);
  // On a fresh browser the ids stay as they were.
  await clearProjects();
  const fresh = await restoreItems(items, { existing: 'copy' });
  assert.deepEqual(fresh.map((r) => r.id), ['m', 'k1', 'k2']);
  assert.deepEqual((await getProject<SkinProjectData>('m'))!.packSkinIds, ['k1', 'k2', 'gone']);
});

test('an imported shader pack brings its files back, under its new id when copied', async () => {
  await clearProjects();
  const p = { id: 'imp', kind: 'shader', name: 'BSL', createdAt: 1, updatedAt: 1, target: 'iris', version: '26.3', description: '', settings: { A: 1 }, source: 'imported', packFormat: 'iris', fileKey: 'packedit:v1:imp', sourceName: 'BSL.zip', fileCount: 1, byteSize: 4, previewTextures: { kind: 'imported', imported: { key: 'shader-preview-pack:v1:x', name: 'Faithful', edition: 'java', size: 9, at: 1 } } };
  const item: ProjectItem = { type: 'shader', id: 'imp', name: 'BSL', data: { project: p, files: { 'shaders/final.fsh': strToU8('main') }, edits: { 'shaders/final.fsh': 'edited' } } };
  const [a] = await restoreItems([item], { existing: 'copy' });
  assert.equal(a.status, 'added');
  const stored = (await getProject<ImportedPackProject>('imp'))!;
  assert.equal(stored.fileKey, 'packedit:v1:imp');
  assert.deepEqual(stored.previewTextures, { kind: 'vanilla' }, 'a preview pack from the other browser is not carried over');
  const files = await cacheGet<{ files: Record<string, Uint8Array> }>('packedit:v1:imp:files');
  assert.equal(strFromU8(files!.files['shaders/final.fsh']), 'main');
  assert.deepEqual((await cacheGet<{ edits: Record<string, string> }>('packedit:v1:imp:edits'))!.edits, { 'shaders/final.fsh': 'edited' });
  const [b] = await restoreItems([item], { existing: 'copy' });
  const copy = (await getProject<ImportedPackProject>(b.id))!;
  assert.equal(copy.fileKey, `packedit:v1:${b.id}`);
  assert.ok(await cacheGet(`packedit:v1:${b.id}:files`));
  // collected again, it brings the same files
  const { items } = await collectProject(b.id);
  assert.equal(strFromU8((items[0].data.files as Record<string, Uint8Array>)['shaders/final.fsh']), 'main');
});

test('a damaged project in a backup is reported and the others are restored', async () => {
  await clearProjects();
  const good: ProjectItem = { type: 'skin', id: 'g', name: 'Good', data: { project: { id: 'g', kind: 'skin', name: 'Good', model: 'slim', image: png(64, 64, [1, 1, 1, 255]), createdAt: 1, updatedAt: 1 } } };
  const bad: ProjectItem = { type: 'texturepack', id: 'b', name: 'Bad', data: { project: { kind: 'texturepack' } } };
  const res = await restoreItems([bad, good], { existing: 'skip' });
  assert.ok(res[0].error instanceof ProjectFileError);
  assert.equal(res[1].status, 'added');
  assert.equal((await listProjects()).length, 1);
});

test('backup of everything: projects, the cape and the font, and back again', async () => {
  await clearProjects();
  const tex = texturePack('t1');
  const skin: SkinProjectData = { id: 's1', kind: 'skin', name: 'Skin', model: 'classic', image: png(64, 64, [3, 3, 3, 255]), createdAt: 1, updatedAt: 9 };
  await saveProject(tex, { keepTime: true });
  await saveProject(skin as Project, { keepTime: true });
  const capePng = new Uint8Array(await png(64, 32, [9, 8, 7, 255]).arrayBuffer());
  store.set('to-cape-maker', JSON.stringify({ png: Buffer.from(capePng).toString('base64'), name: 'Mine', t: 4 }));
  store.set('to-cape-maker-prefs', JSON.stringify({ wear: 'elytra', animation: 'run', edition: 'java', javaVersion: '1.20.1' }));
  store.set('to-font-maker-draft', JSON.stringify({ v: 1, size: 8, space: 4, glyphs: { '41': 'AAEC' } }));
  const items = await collectAll();
  assert.deepEqual(items.map((i) => i.type).sort(), ['cape', 'font', 'skin', 'texturepack']);
  assert.deepEqual(items.find((i) => i.type === 'cape')!.data.settings, { wear: 'elytra', edition: 'java', javaVersion: '1.20.1' }, 'only the cape’s own settings travel');
  const blob = await writeProjectArchive('backup', items);
  await clearProjects();
  const archive = await readProjectArchive(blob);
  assert.equal(archive.manifest.tool, 'backup');
  const res = await restoreItems(archive.manifest.items.map((i) => archive.load(i)), { existing: 'skip' });
  assert.ok(res.every((r) => !r.error), JSON.stringify(res.map((r) => String(r.error ?? ''))));
  assert.deepEqual(await plainOf(await getProject('t1')), await plainOf(tex));
  assert.deepEqual(await plainOf(await getProject('s1')), await plainOf(skin));
  const cape = readSavedCape()!;
  assert.deepEqual(Array.from(cape.png), Array.from(capePng));
  assert.equal(cape.name, 'Mine');
  assert.deepEqual(readCapeSettings(), { wear: 'elytra', edition: 'java', javaVersion: '1.20.1' });
  assert.deepEqual(readDraftJson(), { v: 1, size: 8, space: 4, glyphs: { '41': 'AAEC' } });
  assert.equal(res.find((r) => r.item.type === 'cape')!.id, CAPE_ID);
  assert.equal(res.find((r) => r.item.type === 'font')!.id, FONT_ID);
  // Restoring the same backup again skips everything that is already here.
  const again = await restoreItems(archive.manifest.items.filter((i) => i.type !== 'cape' && i.type !== 'font').map((i) => archive.load(i)), { existing: 'skip' });
  assert.deepEqual(again.map((r) => r.status), ['skipped', 'skipped']);
  assert.equal((await listProjects()).length, 2);
});
