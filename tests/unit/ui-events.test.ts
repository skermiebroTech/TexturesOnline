import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Emitter, computed, debounce, signal, store, throttle } from '../../src/core/events';

test('Emitter delivers typed payloads, supports once/off and isolates handler errors', () => {
  const em = new Emitter<{ change: number; saved: void }>();
  const got: number[] = [];
  const off = em.on('change', (n) => got.push(n));
  em.once('change', (n) => got.push(n * 10));
  let saved = 0;
  em.on('saved', () => saved++);
  const origError = console.error;
  console.error = () => undefined;
  em.on('change', () => {
    throw new Error('boom');
  });
  em.emit('change', 1);
  em.emit('change', 2);
  console.error = origError;
  em.emit('saved');
  assert.deepEqual(got, [1, 10, 2]);
  assert.equal(saved, 1);
  off();
  assert.equal(em.listenerCount('change'), 1);
  em.clear();
  assert.equal(em.listenerCount(), 0);
});

test('signal notifies on change only, with previous value', () => {
  const s = signal(1);
  const seen: [number, number][] = [];
  const off = s.subscribe((v, prev) => seen.push([v, prev]));
  s.set(1);
  s.set(2);
  s.set((p) => p + 1);
  s.value = 3;
  off();
  s.set(4);
  assert.deepEqual(seen, [
    [2, 1],
    [3, 2],
  ]);
  assert.equal(s.get(), 4);
  let immediate = -1;
  s.subscribe((v) => (immediate = v), { immediate: true });
  assert.equal(immediate, 4);
});

test('computed follows its dependencies and can be disposed', () => {
  const a = signal(2);
  const b = signal(3);
  const sum = computed([a, b], () => a.value + b.value);
  assert.equal(sum.value, 5);
  a.set(10);
  assert.equal(sum.value, 13);
  sum.dispose();
  b.set(100);
  assert.equal(sum.value, 13);
});

test('store.patch merges shallowly and select fires on slice changes', () => {
  const st = store({ tool: 'pencil', size: 1, color: '#fff' });
  const tools: string[] = [];
  st.select((s) => s.tool, (t) => tools.push(t));
  let changes = 0;
  st.subscribe(() => changes++);
  st.patch({ size: 1 });
  assert.equal(changes, 0, 'no-op patch does not notify');
  st.patch({ size: 2 });
  st.patch({ tool: 'fill' });
  assert.deepEqual(tools, ['fill']);
  assert.equal(changes, 2);
  assert.deepEqual(st.value, { tool: 'fill', size: 2, color: '#fff' });
});

test('debounce runs once with the last arguments; flush and cancel work', async () => {
  const calls: number[] = [];
  const d = debounce((n: number) => calls.push(n), 20);
  d(1);
  d(2);
  d(3);
  assert.equal(d.pending(), true);
  await new Promise((r) => setTimeout(r, 40));
  assert.deepEqual(calls, [3]);
  d(4);
  d.flush();
  assert.deepEqual(calls, [3, 4]);
  d(5);
  d.cancel();
  await new Promise((r) => setTimeout(r, 30));
  assert.deepEqual(calls, [3, 4]);
});

test('throttle calls immediately then once more at the trailing edge', async () => {
  const calls: number[] = [];
  const t = throttle((n: number) => calls.push(n), 30);
  t(1);
  t(2);
  t(3);
  assert.deepEqual(calls, [1]);
  await new Promise((r) => setTimeout(r, 50));
  assert.deepEqual(calls, [1, 3]);
  t.cancel();
});
