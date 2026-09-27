// Pure logic of the Shader Maker view: settings undo/redo and project helpers.
// Run: npx tsx --test tests/e2e/shaders/history.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SettingsHistory } from '../../../src/tools/shaders/ui/history';
import { duplicateShaderProject, isShaderProject, newShaderProject } from '../../../src/tools/shaders/ui/project';

test('slider drags on one option merge into one undo step', () => {
  const h = new SettingsHistory(200, 900);
  let v = { a: 1, b: false };
  for (let i = 1; i <= 5; i++) {
    h.record(v, 'a', 'A', 1000 + i * 50);
    v = { ...v, a: 1 + i / 10 };
  }
  assert.equal(h.canUndo(), true);
  const e = h.undo(v)!;
  assert.deepEqual(e.values, { a: 1, b: false });
  assert.equal(h.canUndo(), false);
  const r = h.redo(e.values)!;
  assert.equal(r.values.a, 1.5);
});

test('different options, pauses and sealed steps are separate', () => {
  const h = new SettingsHistory(200, 900);
  h.record({ a: 1 }, 'a', 'A', 0);
  h.record({ a: 2 }, 'a', 'A', 2000);
  h.record({ a: 3 }, 'b', 'B', 2100);
  h.seal();
  h.record({ a: 4 }, 'b', 'B', 2150);
  let cur = { a: 5 };
  const labels: string[] = [];
  let e;
  while ((e = h.undo(cur))) {
    labels.push(e.label);
    cur = e.values as { a: number };
  }
  assert.deepEqual(labels, ['B', 'B', 'A', 'A']);
  assert.equal(cur.a, 1);
});

test('a new change clears redo; the limit drops the oldest steps', () => {
  const h = new SettingsHistory(3, 0);
  for (let i = 0; i < 5; i++) h.record({ i }, null, `S${i}`, i);
  const e = h.undo({ i: 5 })!;
  assert.equal(e.label, 'S4');
  h.record({ i: 4 }, null, 'X', 10);
  assert.equal(h.canRedo(), false);
  let n = 0;
  while (h.undo({ i: -1 })) n++;
  assert.equal(n, 3);
});

test('new projects: bedrock gets stable uuids, copies get fresh ones', () => {
  const p = newShaderProject({ target: 'bedrock-vibrant', version: 'latest', name: '  My  pack ', description: 'x', settings: { a: 1 } });
  assert.equal(p.name, 'My pack');
  assert.ok(isShaderProject(p));
  assert.match(p.bedrockUuids!.header, /^[0-9a-f-]{36}$/);
  const c = duplicateShaderProject({ ...p, packVersion: [1, 0, 3] });
  assert.notEqual(c.id, p.id);
  assert.notEqual(c.bedrockUuids!.header, p.bedrockUuids!.header);
  assert.equal(c.packVersion, undefined);
  const iris = newShaderProject({ target: 'iris', version: '26.3', name: '', description: '', settings: {} });
  assert.equal(iris.bedrockUuids, undefined);
  assert.equal(iris.name, 'My shaders');
  assert.equal(isShaderProject({ kind: 'skin', id: 'x' }), false);
});
