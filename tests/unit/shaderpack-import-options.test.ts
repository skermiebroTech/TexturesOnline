// Shader pack editor: option discovery with the Iris / OptiFine rules, on hand-written sources, on
// packs made by the Shader Maker and on real third-party packs (BSL, Complementary and the research
// example pack from $TO_FIXTURES; those tests skip when it is unset).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseIrisOptions, parseOptionLine, resolveInclude, isConstOptionName } from '../../src/tools/shaders/packedit/iris-options';
import { findPacks } from '../../src/tools/shaders/import/detect';
import { decodeText, isTextFile } from '../../src/tools/shaders/import/text';
import { PackWorkspace } from '../../src/tools/shaders/packedit/workspace';
import { defaults, generateIrisPack, presetValues, GAME_OPTIONS } from '../../src/tools/shaders/iris/index';

const FIX = process.env.TO_FIXTURES && existsSync(join(process.env.TO_FIXTURES, 'research-cache', 'iris')) ? join(process.env.TO_FIXTURES, 'research-cache', 'iris') : null;
const NO_FIX = 'set TO_FIXTURES to a folder holding research-cache/iris (BSL, Complementary, example pack)';
const fixture = (rel: string) => (FIX && existsSync(join(FIX, rel)) ? join(FIX, rel) : null);

async function packFromZip(path: string) {
  const list = await findPacks(new Uint8Array(readFileSync(path)), path.split('/').pop()!);
  assert.equal(list.length, 1, 'one pack in the zip');
  assert.equal(list[0].kind, 'iris');
  return list[0];
}

function sourcesOf(files: Record<string, Uint8Array>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [p, b] of Object.entries(files)) if (isTextFile(p, b)) out[p] = decodeText(b).text;
  return out;
}

// ---------------------------------------------------------------- line rules

test('line rules match Iris OptionAnnotatedSource', () => {
  const opt = (l: string) => {
    const r = parseOptionLine(l);
    return r && 'option' in r ? r.option : null;
  };
  assert.deepEqual(opt('#define SHADOWS'), { kind: 'bool', form: 'define', name: 'SHADOWS', value: true, comment: '' });
  assert.deepEqual(opt('  //#define MOTION_BLUR // Blurs movement'), { kind: 'bool', form: 'define', name: 'MOTION_BLUR', value: false, comment: 'Blurs movement' });
  assert.equal(opt('/// #define TRIPLE')?.kind, 'bool', 'extra slashes are part of the comment marker');
  const v = opt('#define SUN 1.00 // [0.50 1.00 2.00] Sunlight');
  assert.equal(v?.kind, 'value');
  assert.deepEqual(v && 'values' in v ? v.values : null, ['0.50', '1.00', '2.00']);
  assert.equal(v?.comment, 'Sunlight');
  // a default missing from the list is appended (StringOption.create)
  const m = opt('#define COLORED 0 //[128 256]');
  assert.deepEqual(m && 'values' in m ? m.values : null, ['128', '256', '0']);
  // words and negative numbers
  assert.equal(opt('#define TONEMAP ACES // [ACES Reinhard]')?.name, 'TONEMAP');
  assert.equal((opt('#define OFFSET -2 // [-4 -2 0]') as { value: string }).value, '-2');
  // no list: not an option; value with a leading comment: not an option
  assert.equal(opt('#define PI 3.14159'), null);
  assert.equal(opt('//#define X 1 // [0 1]'), null);
  assert.equal(opt('#define X(a) a'), null, 'function-like macros are not options');
  // const options: whitelisted names only; bool consts need no list
  assert.equal(opt('const int shadowMapResolution = 2048; // [1024 2048 4096]')?.form, 'const');
  assert.equal(opt('const float shadowDistance = 96.0; //[64.0 96.0]')?.name, 'shadowDistance');
  assert.equal(opt('const float myConst = 1.0; // [0.5 1.0]'), null);
  assert.equal(opt('const int shadowMapResolution = 2048;'), null, 'value consts need a list');
  assert.deepEqual(opt('const bool shadowHardwareFiltering = true;'), { kind: 'bool', form: 'const', name: 'shadowHardwareFiltering', value: true, comment: '' });
  assert.ok(isConstOptionName('shadowcolor1Nearest'));
  // #ifdef references must be bare
  assert.deepEqual(parseOptionLine('  #ifdef SHADOWS  '), { ref: 'SHADOWS' });
  assert.deepEqual(parseOptionLine('#ifndef SHADOWS'), { ref: 'SHADOWS' });
  assert.equal(parseOptionLine('#ifdef SHADOWS // comment'), null);
  assert.equal(parseOptionLine('#if defined SHADOWS'), null);
});

test('includes resolve from the shaders folder or next to the file', () => {
  assert.equal(resolveInclude('shaders/program/a.glsl', '/lib/x.glsl', 'shaders/'), 'shaders/lib/x.glsl');
  assert.equal(resolveInclude('shaders/program/a.glsl', 'x.glsl', 'shaders/'), 'shaders/program/x.glsl');
  assert.equal(resolveInclude('shaders/program/a.glsl', '../lib/x.glsl', 'shaders/'), 'shaders/lib/x.glsl');
  assert.equal(resolveInclude('a.glsl', '../../x', 'shaders/'), null);
});

test('booleans need a bare #ifdef in the same include graph; ambiguous defaults are dropped', () => {
  const src = {
    'shaders/lib/settings.glsl': [
      '#define USED',
      '//#define USED_OFF',
      '#define UNUSED',
      '#define LEVEL 2 // [1 2 3]',
      '#define TWICE 1 // [0 1]',
    ].join('\n'),
    'shaders/final.fsh': '#version 120\n#include "/lib/settings.glsl"\n#ifdef USED\n#endif\n#ifndef USED_OFF\n#endif\n#define TWICE 1 // [0 1]\n',
    'shaders/gbuffers_basic.fsh': '#version 120\n#define CLASH 1 // [1 2]\n',
    'shaders/gbuffers_water.fsh': '#version 120\n#define CLASH 2 // [1 2]\n',
    'shaders/lib/orphan.glsl': '#define NEVER_INCLUDED 1 // [1 2]\n',
    // another component: its #ifdef does not confirm a boolean of the first one
    'shaders/composite.fsh': '#version 120\n#define LONER\n#ifdef UNUSED\n#endif\n',
  };
  const set = parseIrisOptions(src);
  const names = [...set.options.keys()];
  assert.ok(names.includes('USED') && names.includes('USED_OFF'));
  assert.ok(!names.includes('UNUSED'), 'no #ifdef in its own graph');
  assert.ok(!names.includes('LONER'));
  assert.ok(!names.includes('NEVER_INCLUDED'), 'files no program includes are not read');
  assert.deepEqual(set.ambiguous, ['CLASH']);
  assert.equal(set.options.get('USED_OFF')!.defaultValue, 'false');
  assert.deepEqual(set.options.get('TWICE')!.locations.map((l) => l.path).sort(), ['shaders/final.fsh', 'shaders/lib/settings.glsl']);
  assert.equal(set.options.get('LEVEL')!.locations[0].line, 3);
});

// ---------------------------------------------------------------- packs made here

test('a pack from the Shader Maker exposes every game option with its value list', () => {
  const files = generateIrisPack(presetValues('golden'), { name: 'Round', description: '' }) as Record<string, string>;
  const set = parseIrisOptions(files);
  assert.deepEqual(set.ambiguous, []);
  for (const g of GAME_OPTIONS) {
    const o = set.options.get(g.name);
    assert.ok(o, `${g.name} found`);
    assert.equal(o!.kind, g.kind === 'bool' ? 'bool' : 'value', g.name);
  }
  // the metadata file is not a shader source, so it can never declare options
  assert.ok(!set.scanned.some((p) => p.endsWith('.json')));
  const ws = new PackWorkspace('iris', Object.fromEntries(Object.entries(generateIrisPack(defaults(), { name: 'x', description: '' })).map(([k, v]) => [k, new TextEncoder().encode(v as string)])));
  const model = ws.irisModel();
  assert.ok(model.layout.profiles.length >= 3, 'profiles from shaders.properties');
  assert.ok(model.layout.main.items.some((i) => i.type === 'screen'), 'sub screens');
  assert.equal(model.layout.hidden.length, 0, 'every option sits on a screen');
});

// ---------------------------------------------------------------- real packs

test('research example pack: all options, screens, sliders and profiles', { skip: fixture('TexturesOnline-Example-Shaders.zip') ? false : NO_FIX }, async () => {
  const c = await packFromZip(fixture('TexturesOnline-Example-Shaders.zip')!);
  const ws = new PackWorkspace('iris', c.files);
  const { set, layout, lang } = ws.irisModel();
  assert.deepEqual(set.ambiguous, []);
  const settings = decodeText(c.files['shaders/lib/settings.glsl']).text;
  // every #define / const option line of settings.glsl that has a list or is a referenced switch
  const declared = settings.split('\n').filter((l) => /^(\/\/)?#define \w+( [^/]+ \/\/ ?\[|\s*(\/\/|$))|^const (int|float) \w+ = [^;]+; \/\/ ?\[/.test(l)).length;
  assert.ok(set.options.size >= declared - 2, `${set.options.size} options for ${declared} declarations`);
  assert.equal(set.options.get('SUN_STRENGTH')?.defaultValue, '1.00');
  assert.deepEqual(set.options.get('SHADOW_SAMPLES')?.values, ['4', '8', '12', '16', '24']);
  assert.equal(set.options.get('shadowMapResolution')?.form, 'const');
  assert.equal(set.options.get('SHADOWS')?.kind, 'bool');
  assert.deepEqual(layout.profiles.map((p) => p.id), ['LOW', 'MEDIUM', 'HIGH']);
  assert.equal(layout.profiles[0].values.get('SHADOWS'), 'false');
  assert.equal(layout.profiles[0].values.get('shadowMapResolution'), '1024');
  assert.ok(layout.sliders.has('SUN_STRENGTH'));
  assert.equal(lang.get('option.SUN_STRENGTH'), 'Sunlight');
  assert.deepEqual(layout.hidden, []);
});

test('BSL: hundreds of options with nested screens, lang names and profiles', { skip: fixture('packs/BSL_v10.1.8.zip') ? false : NO_FIX }, async () => {
  const t0 = performance.now();
  const c = await packFromZip(fixture('packs/BSL_v10.1.8.zip')!);
  const ws = new PackWorkspace('iris', c.files);
  const { set, layout, lang } = ws.irisModel();
  const ms = performance.now() - t0;
  assert.ok(set.options.size > 300, `${set.options.size} options`);
  assert.deepEqual(set.ambiguous, []);
  assert.ok(ms < 5000, `opened and parsed in ${ms.toFixed(0)} ms`);
  // settings.glsl lines use two-space indentation and '//#define' for off switches
  assert.equal(set.options.get('SHADOW')?.defaultValue, 'true');
  assert.equal(set.options.get('SHADOW_CLOUD')?.defaultValue, 'false');
  assert.equal(set.options.get('shadowMapResolution')?.defaultValue, '2048');
  assert.deepEqual(set.options.get('shadowMapResolution')?.values, ['512', '1024', '1536', '2048', '3072', '4096', '8192']);
  assert.equal(set.options.get('sunPathRotation')?.defaultValue, '-40.0');
  assert.equal(set.options.get('DYNAMIC_HANDLIGHT')?.values.length, 3);
  // layout: main screen links to sub screens that link further
  const top = layout.main.items.filter((i) => i.type === 'screen').map((i) => (i.type === 'screen' ? i.screen.id : ''));
  assert.ok(top.includes('LIGHTING') && top.includes('COLOR'));
  const lighting = layout.main.items.find((i) => i.type === 'screen' && i.screen.id === 'LIGHTING');
  assert.ok(lighting && lighting.type === 'screen' && lighting.screen.items.some((i) => i.type === 'screen' && i.screen.id === 'SHADOW'), 'nested screen');
  assert.equal(lighting && lighting.type === 'screen' ? lighting.screen.label : '', 'Lighting');
  assert.ok(layout.main.items.some((i) => i.type === 'profile'));
  assert.deepEqual(layout.profiles.map((p) => p.id), ['MINIMUM', 'LOW', 'MEDIUM', 'HIGH', 'ULTRA']);
  // profile.LOW=profile.MINIMUM SHADOW ...: inherited values, later tokens win
  const low = layout.profiles.find((p) => p.id === 'LOW')!;
  assert.equal(low.values.get('SHADOW'), 'true');
  assert.equal(low.values.get('AO'), 'false');
  assert.equal(low.values.get('shadowMapResolution'), '1024');
  assert.ok(layout.sliders.has('shadowMapResolution'));
  assert.equal(lang.get('value.DYNAMIC_HANDLIGHT.0'), '\u{a7}cOff');
  assert.equal(lang.get('option.SHADOW'), 'Realtime Shadows');
  // options only used internally are not on any screen
  assert.ok(layout.hidden.includes('OVERWORLD'));
  assert.ok(!layout.hidden.includes('SHADOW'));
});

test('Complementary: pack in the zip root next to extra files, indented properties keys', { skip: fixture('packs/ComplementaryReimagined_r5.9.3.zip') ? false : NO_FIX }, async () => {
  const c = await packFromZip(fixture('packs/ComplementaryReimagined_r5.9.3.zip')!);
  assert.ok(c.files['License.txt'], 'root files stay with the pack');
  const ws = new PackWorkspace('iris', c.files);
  const { set, layout } = ws.irisModel();
  assert.ok(set.options.size > 300, `${set.options.size} options`);
  assert.deepEqual(set.ambiguous, []);
  // '    profile.POTATO        = SHADOW_QUALITY=-1 ...' (leading spaces, spaces around '=')
  assert.deepEqual(layout.profiles.map((p) => p.id), ['POTATO', 'VERYLOW', 'LOW', 'MEDIUM', 'HIGH', 'VERYHIGH', 'ULTRA', 'COMPLEMENTARY']);
  assert.equal(layout.profiles[0].values.get('SHADOW_QUALITY'), '-1');
  assert.equal(set.options.get('SHADOW_QUALITY')?.defaultValue, '2');
  // '#define COLORED_LIGHTING 0 //[128 ...]': the default is appended to the list
  assert.equal(set.options.get('COLORED_LIGHTING')?.values.at(-1), '0');
  assert.ok(layout.sliders.has('shadowDistance'));
  const sub = layout.main.items.find((i) => i.type === 'screen' && i.screen.id === 'PERFORMANCE_SETTINGS');
  assert.ok(sub && sub.type === 'screen' && sub.screen.items.some((i) => i.type === 'option' && i.name === 'SHADOW_QUALITY'));
  // every source file decodes
  assert.ok(Object.keys(sourcesOf(c.files)).length > 300);
});
