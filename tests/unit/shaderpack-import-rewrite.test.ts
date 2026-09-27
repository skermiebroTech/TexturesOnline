// Shader pack editor: writing chosen option values back into the pack. Only the value on each
// option's own line may change; every other byte of every file must stay identical.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseIrisOptions } from '../../src/tools/shaders/packedit/iris-options';
import { applyOptionValues, listWith, parseSettingsFile, rewriteOptionLine, settingsFileText } from '../../src/tools/shaders/packedit/iris-rewrite';
import { PackWorkspace } from '../../src/tools/shaders/packedit/workspace';
import { findPacks } from '../../src/tools/shaders/import/detect';
import { decodeText, encodeText } from '../../src/tools/shaders/import/text';

const FIX = process.env.TO_FIXTURES && existsSync(join(process.env.TO_FIXTURES, 'research-cache', 'iris')) ? join(process.env.TO_FIXTURES, 'research-cache', 'iris') : null;
const NO_FIX = 'set TO_FIXTURES to a folder holding research-cache/iris (BSL, Complementary)';
const fixture = (rel: string) => (FIX && existsSync(join(FIX, rel)) ? join(FIX, rel) : null);

const enc = (s: string) => new TextEncoder().encode(s);

function lineDiff(a: string, b: string): { line: number; before: string; after: string }[] {
  const crlf = (t: string) => t.split('\r\n').length;
  assert.equal(crlf(a), crlf(b), 'line endings unchanged');
  const x = a.split(/\r\n|\n/);
  const y = b.split(/\r\n|\n/);
  assert.equal(x.length, y.length, 'same number of lines');
  const out: { line: number; before: string; after: string }[] = [];
  x.forEach((l, i) => {
    if (l !== y[i]) out.push({ line: i, before: l, after: y[i] });
  });
  return out;
}

test('single lines: value token, const value, switches on and off', () => {
  const set = parseIrisOptions({
    'shaders/final.fsh': [
      '  #define SUN 1.00 //[0.50 1.00 2.00] Sunlight',
      'const float shadowDistance = 96.0; // [64.0 96.0 128.0]',
      '  #define SHADOWS // tooltip',
      '//#define BLOOM',
      'const bool shadowHardwareFiltering = true;',
      '#ifdef SHADOWS',
      '#endif',
      '#ifdef BLOOM',
      '#endif',
      '#ifdef shadowHardwareFiltering',
      '#endif',
    ].join('\n'),
  });
  const o = (n: string) => set.options.get(n)!;
  assert.equal(rewriteOptionLine('  #define SUN 1.00 //[0.50 1.00 2.00] Sunlight', o('SUN'), '2.00'), '  #define SUN 2.00 //[0.50 1.00 2.00] Sunlight');
  assert.equal(rewriteOptionLine('const float shadowDistance = 96.0; // [64.0 96.0 128.0]', o('shadowDistance'), '128.0'), 'const float shadowDistance = 128.0; // [64.0 96.0 128.0]');
  assert.equal(rewriteOptionLine('  #define SHADOWS // tooltip', o('SHADOWS'), 'false'), '  //#define SHADOWS // tooltip');
  assert.equal(rewriteOptionLine('//#define BLOOM', o('BLOOM'), 'true'), '#define BLOOM');
  assert.equal(rewriteOptionLine('const bool shadowHardwareFiltering = true;', o('shadowHardwareFiltering'), 'false'), 'const bool shadowHardwareFiltering = false;');
  // the default itself changes nothing
  assert.equal(rewriteOptionLine('  #define SUN 1.00 //[0.50 1.00 2.00] Sunlight', o('SUN'), '1.00'), '  #define SUN 1.00 //[0.50 1.00 2.00] Sunlight');
  // a value that is not in the list is inserted so the in-game menu keeps working
  assert.equal(rewriteOptionLine('  #define SUN 1.00 //[0.50 1.00 2.00] Sunlight', o('SUN'), '1.50'), '  #define SUN 1.50 //[0.50 1.00 1.50 2.00] Sunlight');
  // switching back from the rewritten line gives the original line again
  const off = rewriteOptionLine('  #define SHADOWS // tooltip', o('SHADOWS'), 'false');
  const setOff = parseIrisOptions({ 'shaders/final.fsh': `${off}\n#ifdef SHADOWS\n#endif` });
  assert.equal(rewriteOptionLine(off, setOff.options.get('SHADOWS')!, 'true'), '  #define SHADOWS // tooltip');
});

test('value lists: sorted insertion for ascending numbers, append otherwise; old defaults stay selectable', () => {
  assert.deepEqual(listWith(['1', '2', '4'], ['3']), ['1', '2', '3', '4']);
  assert.deepEqual(listWith(['4', '2', '1'], ['3']), ['4', '2', '1', '3']);
  assert.deepEqual(listWith(['ACES', 'Reinhard'], ['Hable']), ['ACES', 'Reinhard', 'Hable']);
  assert.deepEqual(listWith(['0.5', '1.0'], ['2.0']), ['0.5', '1.0', '2.0']);
  // '#define COLORED 0 //[128 256]': the loaders showed 0 at the end; picking 256 keeps 0 in the list
  const set = parseIrisOptions({ 'shaders/final.fsh': '#define COLORED 0 //[128 256]' });
  assert.equal(rewriteOptionLine('#define COLORED 0 //[128 256]', set.options.get('COLORED')!, '256'), '#define COLORED 256 //[0 128 256]');
});

test('applyOptionValues rewrites every location and keeps line endings and other bytes', () => {
  const crlf = '// header \u{e9}\r\n#define A 1 // [1 2 3]\r\n#ifdef B\r\n#endif\r\n//#define B // switch\r\nvoid main() {}\r\n';
  const sources = {
    'shaders/lib/settings.glsl': crlf,
    'shaders/final.fsh': '#include "/lib/settings.glsl"\n#define A 1 // [1 2 3]\n',
  };
  const set = parseIrisOptions(sources);
  const res = applyOptionValues(sources, set, { A: '3', B: 'true', UNKNOWN: '1' });
  assert.deepEqual(Object.keys(res.files).sort(), ['shaders/final.fsh', 'shaders/lib/settings.glsl']);
  assert.equal(res.files['shaders/lib/settings.glsl'], '// header \u{e9}\r\n#define A 3 // [1 2 3]\r\n#ifdef B\r\n#endif\r\n#define B // switch\r\nvoid main() {}\r\n');
  assert.equal(res.files['shaders/final.fsh'], '#include "/lib/settings.glsl"\n#define A 3 // [1 2 3]\n');
  assert.deepEqual(res.skipped, []);
  // defaults produce no changes at all
  assert.deepEqual(applyOptionValues(sources, set, { A: '1', B: 'false' }).files, {});
});

test('bytes of files that are not valid UTF-8 survive a rewrite (read as ISO-8859-1)', () => {
  const bytes = new Uint8Array([...enc('// caf'), 0xe9, 0x0a, ...enc('#define A 1 // [1 2]\n'), 0xff, 0xfe, 0x0a]);
  const ws = new PackWorkspace('iris', { 'shaders/final.fsh': bytes });
  assert.equal(ws.encodingOf('shaders/final.fsh'), 'latin1');
  const model = ws.irisModel();
  const out = ws.buildExport({ iris: { set: model.set, values: { A: '2' } } });
  const expected = new Uint8Array([...enc('// caf'), 0xe9, 0x0a, ...enc('#define A 2 // [1 2]\n'), 0xff, 0xfe, 0x0a]);
  assert.deepEqual(out.files['shaders/final.fsh'], expected);
  // a UTF-8 BOM is kept too
  const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...enc('#define A 1 // [1 2]\n')]);
  const d = decodeText(bom);
  assert.equal(d.encoding, 'utf-8');
  assert.deepEqual(encodeText(d.text, d.encoding), bom);
});

test('unchanged export is byte-identical, including binary files', () => {
  const files = {
    'shaders/final.fsh': enc('#define A 1 // [1 2]\r\nvoid main(){}'),
    'shaders/tex/noise.png': new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3, 255]),
    'README.txt': enc('hello'),
  };
  const ws = new PackWorkspace('iris', files);
  const out = ws.buildExport({ iris: { set: ws.irisModel().set, values: {} } });
  for (const [p, b] of Object.entries(files)) assert.deepEqual(out.files[p], b, p);
  // edits from the Files tab are exported, other files stay the same
  ws.setText('README.txt', 'changed');
  const out2 = ws.buildExport();
  assert.deepEqual(out2.files['README.txt'], enc('changed'));
  assert.deepEqual(out2.files['shaders/tex/noise.png'], files['shaders/tex/noise.png']);
  // reverting by typing the original text back is not an edit
  ws.setText('README.txt', 'hello');
  assert.deepEqual(ws.editedPaths(), []);
});

test('settings file: NAME=value for changed options only, read back the same way', () => {
  const sources = { 'shaders/final.fsh': '#define A 1 // [1 2]\n#define B\n#ifdef B\n#endif\n#define C 5 // [5 6]\n' };
  const set = parseIrisOptions(sources);
  const txt = settingsFileText(set, { A: '2', B: 'false', C: '5' }, 'My Pack.zip');
  assert.equal(txt, '# Shader options for My Pack.zip. Made with Texture Pack Maker.\nA=2\nB=false\n');
  assert.deepEqual(parseSettingsFile(txt, set), { A: '2', B: 'false' });
});

test('BSL: changing two options rewrites exactly those two lines', { skip: fixture('packs/BSL_v10.1.8.zip') ? false : NO_FIX }, async () => {
  const [c] = await findPacks(new Uint8Array(readFileSync(fixture('packs/BSL_v10.1.8.zip')!)), 'BSL_v10.1.8.zip');
  const ws = new PackWorkspace('iris', c.files);
  const model = ws.irisModel();
  const out = ws.buildExport({ iris: { set: model.set, values: { SHADOW: 'false', shadowMapResolution: '4096' } } });
  const changed = Object.keys(c.files).filter((p) => {
    const a = c.files[p];
    const b = out.files[p] as Uint8Array;
    return a.length !== b.length || a.some((x, i) => x !== b[i]);
  });
  assert.deepEqual(changed, ['shaders/lib/settings.glsl']);
  const diff = lineDiff(decodeText(c.files['shaders/lib/settings.glsl']).text, decodeText(out.files['shaders/lib/settings.glsl'] as Uint8Array).text);
  assert.deepEqual(
    diff.map((d) => d.after),
    ['  //#define SHADOW', '  const int shadowMapResolution = 4096; //[512 1024 1536 2048 3072 4096 8192]'],
  );
  assert.deepEqual(diff.map((d) => d.before), ['  #define SHADOW', '  const int shadowMapResolution = 2048; //[512 1024 1536 2048 3072 4096 8192]']);
  // the exported pack parses to the new defaults
  const again = new PackWorkspace('iris', out.files as Record<string, Uint8Array>).irisModel();
  assert.equal(again.set.options.get('SHADOW')?.defaultValue, 'false');
  assert.equal(again.set.options.get('shadowMapResolution')?.defaultValue, '4096');
  assert.equal(again.set.options.size, model.set.options.size);
});

test('Complementary: every option can be set to every allowed value without breaking the menus', { skip: fixture('packs/ComplementaryReimagined_r5.9.3.zip') ? false : NO_FIX }, async () => {
  const [c] = await findPacks(new Uint8Array(readFileSync(fixture('packs/ComplementaryReimagined_r5.9.3.zip')!)), 'Complementary.zip');
  const ws = new PackWorkspace('iris', c.files);
  const { set } = ws.irisModel();
  // pick the last allowed value of every option (booleans flipped)
  const values: Record<string, string> = {};
  for (const o of set.options.values()) values[o.name] = o.kind === 'bool' ? String(o.defaultValue !== 'true') : o.values[o.values.length - 1];
  const out = ws.buildExport({ iris: { set, values } });
  assert.deepEqual(out.skipped, []);
  const next = new PackWorkspace('iris', out.files as Record<string, Uint8Array>).irisModel().set;
  assert.equal(next.options.size, set.options.size, 'same options after the rewrite');
  assert.deepEqual(next.ambiguous, []);
  for (const o of set.options.values()) assert.equal(next.options.get(o.name)?.defaultValue, values[o.name], o.name);
});
