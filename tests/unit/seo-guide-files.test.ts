// The example skin pack files in the "make a Bedrock skin pack" guide are what the app writes.
// Run: npx tsx --test tests/unit/seo-guide-files.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSkinPackFiles } from '../../src/editions/bedrock/manifest';
import { SKIN_PACK_EXAMPLE, SKIN_PACK_LANG, SKIN_PACK_LANGUAGES, SKIN_PACK_MANIFEST, SKIN_PACK_SKINS_JSON, SKIN_PACK_TREE } from '../../src/tools/guides/skin-pack-files';

test('the skin pack guide shows the files the Skin Pack Maker writes', () => {
  const e = SKIN_PACK_EXAMPLE;
  const files = buildSkinPackFiles({
    name: e.name,
    uuids: e.uuids,
    version: e.version,
    skins: e.skins.map((s) => ({ ...s, png: new Blob([new Uint8Array(1)], { type: 'image/png' }) })),
  });
  assert.equal(files['manifest.json'], SKIN_PACK_MANIFEST);
  assert.equal(files['skins.json'], SKIN_PACK_SKINS_JSON);
  assert.equal(files['texts/en_US.lang'], SKIN_PACK_LANG);
  assert.equal(files['texts/languages.json'], SKIN_PACK_LANGUAGES);
  // Every file of the pack is in the folder tree, and nothing else.
  const names = Object.keys(files).map((f) => f.split('/').pop()!).sort();
  const tree = SKIN_PACK_TREE.split('\n')
    .slice(1)
    .map((l) => l.replace(/^[│├└─\s]+/, ''))
    .filter((l) => !l.endsWith('/'))
    .sort();
  assert.deepEqual(tree, names);
});
