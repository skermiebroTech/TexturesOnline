// Shader pack editor: shaders.properties (screens, sliders, profiles) and lang files as Iris reads
// them (java.util.Properties, no preprocessing for the menu keys), § formatting and fallback names.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProperties, formatRuns, stripFormatting, prettifyName, wordList } from '../../src/tools/shaders/packedit/properties';
import { buildLayout, findLangPath, matchingProfile, optionLabel, parseLang, screenLabel, valueLabel, type ScreenNode } from '../../src/tools/shaders/packedit/iris-layout';
import { parseIrisOptions } from '../../src/tools/shaders/packedit/iris-options';

test('java.util.Properties rules: comments, separators, continuations, escapes, last key wins', () => {
  const p = parseProperties(
    [
      '# comment',
      '! also a comment',
      '    profile.LOW        = A=1 !B',
      'key:value',
      'spaced   value here',
      'long=first \\',
      '     second \\',
      '  third',
      'esc=tab\\there \\u0041 back\\\\slash',
      'a\\=b=c',
      '#if X',
      'dup=one',
      '#else',
      'dup=two',
      '#endif',
      'empty=',
    ].join('\r\n'),
  );
  assert.equal(p.get('profile.LOW'), 'A=1 !B');
  assert.equal(p.get('key'), 'value');
  assert.equal(p.get('spaced'), 'value here');
  assert.equal(p.get('long'), 'first second third');
  assert.equal(p.get('esc'), 'tab\there A back\\slash');
  assert.equal(p.get('a=b'), 'c');
  assert.equal(p.get('dup'), 'two', 'no preprocessing: the last definition wins');
  assert.equal(p.get('empty'), '');
  assert.deepEqual([...p.keys()].slice(0, 3), ['profile.LOW', 'key', 'spaced']);
  assert.deepEqual(wordList('  a  b\tc '), ['a', 'b', 'c']);
});

test('lang: names, comments, value labels with prefix/suffix, and the file OptiFine picks', () => {
  const lang = parseLang('option.SUN=Sunlight\noption.SUN.comment=Brightness.\nvalue.MODE.0=\u{a7}cOff\nprefix.DIST=~\nsuffix.DIST=\\ blocks\nscreen.LIGHT=Lighting\n');
  const set = parseIrisOptions({ 'shaders/final.fsh': '#define SUN 1.0 // [0.5 1.0]\n#define MODE 0 // [0 1]\n#define DIST 8 // [8 16]\n#define RAW_NAME 1 // [1 2]\n' });
  assert.equal(optionLabel(lang, 'SUN'), 'Sunlight');
  assert.equal(optionLabel(lang, 'RAW_NAME'), 'Raw Name');
  assert.equal(valueLabel(lang, set.options.get('MODE')!, '0'), '\u{a7}cOff');
  assert.equal(valueLabel(lang, set.options.get('MODE')!, '1'), '1');
  assert.equal(valueLabel(lang, set.options.get('DIST')!, '16'), '~16 blocks');
  assert.equal(screenLabel(lang, 'LIGHT'), 'Lighting');
  assert.equal(screenLabel(lang, 'MORE_FOG'), 'More Fog');
  assert.equal(findLangPath(['shaders/lang/de_DE.lang', 'shaders/lang/en_US.lang']), 'shaders/lang/en_US.lang');
  assert.equal(findLangPath(['shaders/lang/en_US.lang', 'shaders/lang/en_us.lang']), 'shaders/lang/en_us.lang');
  assert.equal(findLangPath(['shaders/lang/sub/en_us.lang']), null);
});

test('§ formatting codes and readable fallback names', () => {
  assert.deepEqual(formatRuns('A \u{a7}e[*]\u{a7}rB \u{a7}lbold\u{a7}r'), [
    { text: 'A ' },
    { text: '[*]', color: 'e' },
    { text: 'B ' },
    { text: 'bold', bold: true },
  ]);
  assert.equal(stripFormatting('\u{a7}cRed\u{a7}r text\u{a7}'), 'Red text');
  assert.equal(prettifyName('shadowMapResolution'), 'Shadow Map Resolution');
  assert.equal(prettifyName('SSAO_QUALI_DEFINE'), 'SSAO Quali Define');
  assert.equal(prettifyName('info0'), 'Info 0');
  assert.equal(prettifyName('TAA'), 'TAA');
});

function ids(node: ScreenNode): unknown[] {
  return node.items.map((i) => (i.type === 'option' ? i.name : i.type === 'profile' ? '<profile>' : { [i.screen.id]: ids(i.screen) }));
}

test('screens: nesting, <empty>, <profile>, * for unplaced options, cycles and unknown names', () => {
  const src = '#define A 1 // [1 2]\n#define B 1 // [1 2]\n#define C 1 // [1 2]\n#define D 1 // [1 2]\n#define E\n#ifdef E\n#endif\n';
  const set = parseIrisOptions({ 'shaders/final.fsh': src });
  const props = [
    'screen=<profile> <empty> [ONE] A UNKNOWN [MISSING]',
    'screen.ONE=B [TWO] <empty>',
    'screen.TWO=C [ONE] *',
    'screen.ONE.columns=2',
    'sliders=A B',
    'profile.LOW=!E A=2 !program.composite',
    'profile.HIGH=profile.LOW E B:2',
    'profile.LOOP=profile.LOOP A=1',
  ].join('\n');
  const layout = buildLayout(set, props, parseLang('screen.ONE=First'));
  assert.deepEqual(ids(layout.main), ['<profile>', { ONE: ['B', { TWO: ['C', 'D', 'E'] }] }, 'A']);
  const one = layout.main.items[1];
  assert.equal(one.type === 'screen' ? one.screen.label : '', 'First');
  assert.deepEqual(layout.missingScreens, ['MISSING']);
  assert.deepEqual([...layout.sliders], ['A', 'B']);
  assert.deepEqual(layout.hidden, []);
  const low = layout.profiles.find((p) => p.id === 'LOW')!;
  assert.deepEqual([...low.values], [['E', 'false'], ['A', '2']]);
  const high = layout.profiles.find((p) => p.id === 'HIGH')!;
  assert.deepEqual(Object.fromEntries(high.values), { E: 'true', A: '2', B: '2' });
  assert.deepEqual(Object.fromEntries(layout.profiles.find((p) => p.id === 'LOOP')!.values), { A: '1' });
  // the most specific matching profile wins; none matching means custom
  const cur: Record<string, string> = { E: 'true', A: '2', B: '2' };
  assert.equal(matchingProfile(layout.profiles, (n) => cur[n])?.id, 'HIGH');
  cur.B = '1';
  assert.equal(matchingProfile(layout.profiles, (n) => cur[n]), null);
});

test('no screen line: every option on the main screen; options off every screen are hidden', () => {
  const set = parseIrisOptions({ 'shaders/final.fsh': '#define A 1 // [1 2]\n#define B 1 // [1 2]\n' });
  const all = buildLayout(set, '', parseLang(''));
  assert.deepEqual(ids(all.main), ['A', 'B']);
  assert.equal(all.hasScreenLayout, false);
  const some = buildLayout(set, 'screen=A', parseLang(''));
  assert.deepEqual(ids(some.main), ['A']);
  assert.deepEqual(some.hidden, ['B']);
});
