/**
 * Audit: resolves every block (and every state of it) of a Java version or Bedrock and reports the
 * ones that fall back to a flat texture, have no geometry, or reference missing textures.
 * Usage: TO_FIXTURES=<dir> npx tsx tests/tools/models/audit.ts [26.3|bedrock] [--states]
 */
import { loadModelLibrary } from '../../../src/shared/models/index';
import { bedrockAssets, javaJarAssets } from './fixtures';

const which = process.argv[2] ?? '26.3';
const allStates = process.argv.includes('--states');
const assets = which === 'bedrock' ? bedrockAssets() : javaJarAssets(which);
if (!assets) {
  console.error('fixtures missing (set TO_FIXTURES)');
  process.exit(2);
}
const lib = await loadModelLibrary(assets);
const blocks = lib.blocks();
const buckets: Record<string, string[]> = { special: [], sprite: [], empty: [], missingTex: [], approximate: [], stateEmpty: [], ok: [] };
const notes = new Map<string, string>();
for (const e of blocks) {
  const v = lib.resolve(e, lib.defaultState(e));
  if (!v) {
    buckets.empty.push(e.id);
    continue;
  }
  if (v.note) notes.set(e.id, v.note);
  if (v.shape === 'special') buckets.special.push(e.id);
  else if (v.shape === 'sprite') buckets.sprite.push(e.id);
  else if (!v.quads.length) buckets.empty.push(e.id);
  else if (v.quads.some((q) => !q.texture || !assets.hasFile(q.texture))) buckets.missingTex.push(`${e.id} (${[...new Set(v.quads.filter((q) => !q.texture || !assets.hasFile(q.texture)).map((q) => q.texture))].join(', ')})`);
  else if (v.approximate) buckets.approximate.push(e.id);
  else buckets.ok.push(e.id);
  if (allStates && v.shape === 'model') {
    const base = lib.defaultState(e);
    const variants = lib.properties(e).flatMap((prop) => prop.values.map((val) => ({ ...base, [prop.name]: val })));
    for (const st of variants) {
      const s = lib.resolve(e, st);
      if (s && s.shape === 'model' && !s.quads.length) {
        buckets.stateEmpty.push(`${e.id} ${JSON.stringify(st)}`);
        break;
      }
    }
  }
}
console.log(`${which}: ${blocks.length} blocks`);
for (const [k, list] of Object.entries(buckets)) {
  if (k === 'ok') console.log(`ok: ${list.length}`);
  else console.log(`\n${k} (${list.length}):\n  ${list.join('\n  ')}`);
}
const noteGroups = new Map<string, string[]>();
for (const [id, n] of notes) noteGroups.set(n, [...(noteGroups.get(n) ?? []), id]);
console.log('\nnotes:');
for (const [n, ids] of noteGroups) console.log(`  [${ids.length}] ${n}\n     ${ids.slice(0, 12).join(', ')}${ids.length > 12 ? ' ...' : ''}`);
