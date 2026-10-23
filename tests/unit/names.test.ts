// Name-based item textures (src/tools/textures/names): which files each Java version reads, item
// definitions (1.21.5+) wrapped around the pack's own (a model made in the model editor), OptiFine CIT
// properties (writing, reading, escaping, path rules), the export per version and range, and opened
// packs' looks (CIT files and item definitions) taken into the editor, round trip included; the
// guide's examples; project files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import type { NameVariant, TexturePackProject } from '../../src/core/types';
import { encodePng } from '../../src/core/image';
import { exportTexturePack } from '../../src/tools/textures/export';
import { importPack } from '../../src/tools/textures/import';
import { newTextureProject } from '../../src/tools/textures/project';
import {
  citNameValue,
  citProperties,
  cleanName,
  escapeProperty,
  flatModel,
  nameRules,
  namesFromCitValue,
  parseProperties,
  readCitRule,
  readNameSelect,
  resolveCitAsset,
  slugFor,
  withNameCases,
} from '../../src/tools/textures/names/names';
import { adoptPackNames, hasPackNames, itemBaseModel, nameFiles, nameFilesPlan, newVariantId, variantOfTexture } from '../../src/tools/textures/names/pack';
import { NAMES_CIT, NAMES_DEFINITION, NAMES_MODEL } from '../../src/tools/guides/names-files';
import { readProjectArchive, writeProjectArchive } from '../../src/shared/project-file/format';
import { fakeAssets, itemArt, javaSpec, json, solid, text, unzipBlob } from '../tools/texlogic/fixtures';

const J = 'assets/minecraft/textures/';
const SWORD_DEF = { model: { type: 'minecraft:model', model: 'minecraft:item/diamond_sword' } };
const blob = (s: string) => new Blob([s], { type: 'application/json' });
const png = (c: [number, number, number, number]) => new Blob([encodePng(solid(16, 16, c))], { type: 'image/png' });

function swordSpec(version: string) {
  const spec = { ...javaSpec(), [`${J}item/diamond_sword.png`]: itemArt() } as Record<string, ImageData | string>;
  spec['assets/minecraft/models/item/diamond_sword.json'] = JSON.stringify({ parent: 'minecraft:item/handheld', textures: { layer0: 'minecraft:item/diamond_sword' } });
  if (nameRules(version).select || version === '1.21.4') spec['assets/minecraft/items/diamond_sword.json'] = JSON.stringify(SWORD_DEF);
  return spec;
}

/** A project with one look of the diamond sword, as the editor makes it. */
function withLook(version: string, names = ['Excalibur'], extra: Partial<NameVariant> = {}): TexturePackProject {
  const p = newTextureProject({ name: 'Names', edition: 'java', version });
  const id = newVariantId(p, 'diamond_sword', names[0] ?? 'name');
  const slug = id.split('/')[1];
  const texture = `${J}item/names/diamond_sword/${slug}.png`;
  const model = `minecraft:item/names/diamond_sword/${slug}`;
  p.overrides[texture] = png([200, 30, 30, 255]);
  p.extraFiles[`assets/minecraft/models/item/names/diamond_sword/${slug}.json`] = blob(JSON.stringify(flatModel('minecraft:item/diamond_sword', texture)));
  p.nameVariants = { [id]: { item: 'diamond_sword', names, texture, model, updatedAt: 1, ...extra } };
  return p;
}

// ---------------------------------------------------------------------------------------------
// Versions and names

test('which versions read what: 1.21.5+ item definitions, older CIT; ranges add CIT', () => {
  assert.deepEqual(nameRules('1.21.4'), { select: false, components: true, models: true });
  assert.equal(nameRules('1.21.5').select, true);
  assert.equal(nameRules('26.3').select, true);
  assert.equal(nameRules('1.20.4').components, false);
  assert.equal(nameRules('1.20.5').components, true);
  assert.equal(nameRules('1.7.10').models, false);
  assert.equal(nameRules('1.8.9').models, true);
  assert.deepEqual(nameFilesPlan({ version: '26.3' }), { select: true, cit: false, components: true });
  assert.deepEqual(nameFilesPlan({ version: '1.21.4' }), { select: false, cit: true, components: true });
  assert.deepEqual(nameFilesPlan({ version: '1.12.2' }), { select: false, cit: true, components: false });
  // a range down to 1.20.1: both, with the name rule every version reads
  assert.deepEqual(nameFilesPlan({ version: '26.3', compat: { minVersion: '1.20.1', maxVersion: '26.3' } }), { select: true, cit: true, components: false });
  assert.deepEqual(nameFilesPlan({ version: '26.3', compat: { minVersion: '1.21.5', maxVersion: '26.3' } }), { select: true, cit: false, components: true });
});

test('names as the anvil keeps them, file names from names', () => {
  assert.equal(cleanName('  §cExcalibur\n '), 'cExcalibur');
  assert.equal(cleanName('x'.repeat(60)).length, 50);
  assert.equal(slugFor('Sword of Light!'), 'sword_of_light');
  assert.equal(slugFor('Épée'), 'epee');
  assert.equal(slugFor('エクスカリバー'), 'name');
  assert.equal(slugFor('Excalibur', ['excalibur', 'excalibur_2']), 'excalibur_3');
  const p = withLook('26.3');
  assert.equal(newVariantId(p, 'diamond_sword', 'excalibur'), 'diamond_sword/excalibur_2');
  assert.equal(itemBaseModel('bow', { model: { type: 'minecraft:condition', property: 'minecraft:using_item', on_false: { type: 'minecraft:model', model: 'minecraft:item/bow' }, on_true: { type: 'minecraft:model', model: 'minecraft:item/bow_pulling_0' } } }), 'minecraft:item/bow');
  assert.equal(itemBaseModel('clock', undefined), 'minecraft:item/clock');
});

// ---------------------------------------------------------------------------------------------
// Item definitions

test('item definition: the name select wraps the item’s model, tints and other fields kept', () => {
  const def = { hand_animation_on_swap: false, model: { type: 'minecraft:model', model: 'minecraft:item/leather_helmet', tints: [{ type: 'minecraft:dye', default: -6265536 }] } };
  const out = withNameCases(def, 'leather_helmet', [{ names: ['Crown'], model: { type: 'minecraft:model', model: 'minecraft:item/names/leather_helmet/crown' } }, { names: ['A', 'B'], model: { type: 'minecraft:model', model: 'minecraft:item/x' } }]);
  assert.equal(out.hand_animation_on_swap, false);
  const m = out.model as Record<string, unknown>;
  assert.equal(m.type, 'minecraft:select');
  assert.equal(m.property, 'minecraft:component');
  assert.equal(m.component, 'minecraft:custom_name');
  assert.deepEqual(m.fallback, def.model);
  const cases = m.cases as { when: unknown }[];
  assert.equal(cases[0].when, 'Crown');
  assert.deepEqual(cases[1].when, ['A', 'B']);
  // a definition that already picks by name keeps its cases after ours, a name both have goes to ours
  const again = withNameCases(out, 'leather_helmet', [{ names: ['B', 'C'], model: { type: 'minecraft:model', model: 'minecraft:item/y' } }]);
  const c2 = (again.model as { cases: { when: unknown; model: { model: string } }[] }).cases;
  assert.deepEqual(c2.map((c) => c.when), [['B', 'C'], 'Crown', 'A']);
  // no definition: the item's own model
  assert.deepEqual((withNameCases(undefined, 'apple', [{ names: ['x'], model: {} }]).model as { fallback: unknown }).fallback, { type: 'minecraft:model', model: 'minecraft:item/apple' });
});

test('export 26.3: the definition wraps the pack’s own (a 3D model from the model editor) and the look keeps the tints', async () => {
  const assets = fakeAssets('java', '26.3', swordSpec('26.3'));
  const p = withLook('26.3', ['Excalibur', 'Sword of Light']);
  // the model editor made the sword "flat in the inventory, 3D in hand"
  const own = { model: { type: 'minecraft:select', property: 'minecraft:display_context', cases: [{ when: ['gui', 'ground', 'fixed'], model: SWORD_DEF.model }], fallback: { type: 'minecraft:model', model: 'minecraft:item/diamond_sword_3d' } } };
  p.extraFiles['assets/minecraft/items/diamond_sword.json'] = blob(JSON.stringify(own));
  const res = await exportTexturePack(p, assets);
  const zip = await unzipBlob(res.blob);
  const def = json(zip['assets/minecraft/items/diamond_sword.json']);
  assert.equal(def.model.property, 'minecraft:component');
  assert.deepEqual(def.model.cases, [{ when: ['Excalibur', 'Sword of Light'], model: { type: 'minecraft:model', model: 'minecraft:item/names/diamond_sword/excalibur' } }]);
  assert.deepEqual(def.model.fallback, own.model);
  assert.ok(zip[`${J}item/names/diamond_sword/excalibur.png`], 'the look’s texture');
  assert.deepEqual(json(zip['assets/minecraft/models/item/names/diamond_sword/excalibur.json']), { parent: 'minecraft:item/diamond_sword', textures: { layer0: 'minecraft:item/names/diamond_sword/excalibur' } });
  assert.ok(!Object.keys(zip).some((k) => k.includes('optifine')), 'no CIT for 26.3');
  assert.ok(!res.warnings.some((w) => /OptiFine/.test(w)), res.warnings.join(' | '));
});

test('export 26.3 without a pack definition reads the game’s; a range to 1.20.1 adds CIT', async () => {
  const assets = fakeAssets('java', '26.3', swordSpec('26.3'));
  const p = withLook('26.3');
  p.compat = { minVersion: '1.20.1', maxVersion: '26.3' };
  const res = await exportTexturePack(p, assets);
  const zip = await unzipBlob(res.blob);
  assert.deepEqual(json(zip['assets/minecraft/items/diamond_sword.json']).model.fallback, SWORD_DEF.model);
  const props = text(zip['assets/minecraft/optifine/cit/names/diamond_sword/excalibur.properties'])!;
  assert.match(props, /^nbt\.display\.Name=Excalibur$/m);
  assert.ok(res.warnings.some((w) => /OptiFine or the CIT Resewn mod/.test(w)));
});

// ---------------------------------------------------------------------------------------------
// CIT

test('CIT properties: plain name, several names as a regex, escaping, components from 1.20.5', () => {
  const v: NameVariant = { item: 'diamond_sword', names: ['Excalibur'], texture: `${J}item/names/diamond_sword/excalibur.png`, model: 'minecraft:item/names/diamond_sword/excalibur', updatedAt: 0 };
  const a = citProperties(v, { components: false, model: false });
  assert.match(a, /^type=item$/m);
  assert.match(a, /^items=diamond_sword$/m);
  assert.match(a, /^texture=textures\/item\/names\/diamond_sword\/excalibur\.png$/m);
  assert.match(a, /^nbt\.display\.Name=Excalibur$/m);
  const b = citProperties({ ...v, names: ['Sword (1.0)', 'Épée', 'a\\b'] }, { components: true, model: true });
  assert.match(b, /^model=item\/names\/diamond_sword\/excalibur$/m);
  assert.ok(!/^texture=/m.test(b));
  // regex escapes, then .properties doubles the backslashes and escapes past ASCII
  assert.match(b, /^components\.custom_name=regex:\(Sword \\\\\(1\\\\\.0\\\\\)\|\\u00c9p\\u00e9e\|a\\\\\\\\b\)$/m);
  assert.ok([...b].every((c) => c.charCodeAt(0) < 128), 'ASCII only');
  // read back the way Java reads .properties
  const props = parseProperties(b);
  assert.equal(props.get('components.custom_name'), 'regex:(Sword \\(1\\.0\\)|Épée|a\\\\b)');
  assert.deepEqual(namesFromCitValue(props.get('components.custom_name')!), ['Sword (1.0)', 'Épée', 'a\\b']);
  // a name that looks like an OptiFine rule is written as a regex
  assert.equal(citNameValue(['!nope']), 'regex:(!nope)');
  assert.equal(citNameValue(['ipattern:x']), 'regex:(ipattern:x)');
  assert.equal(escapeProperty(' lead'), '\\ lead');
});

test('CIT reading: name rules, patterns, other rules, continuation lines', () => {
  const r = readCitRule('# comment\ntype=item\nitems=minecraft:diamond_sword\ntexture=excalibur\nnbt.display.Name=ipattern:*excalibur*\n')!;
  assert.deepEqual(r.items, ['diamond_sword']);
  assert.equal(r.names, null);
  assert.equal(r.match, 'ipattern:*excalibur*');
  assert.equal(r.texture, 'excalibur');
  assert.deepEqual(r.other, []);
  assert.deepEqual(readCitRule('items=stick\ncomponents.minecraft\\:custom_name=Magic Wand')!.names, ['Magic Wand']);
  assert.deepEqual(readCitRule('items = bow \\\n  crossbow\nnbt.display.Name: regex:(A|B)\ndamage=1')!, { items: ['bow', 'crossbow'], names: ['A', 'B'], match: 'regex:(A|B)', texture: undefined, model: undefined, other: ['damage'] });
  assert.equal(readCitRule('type=enchantment\nnbt.display.Name=X'), null);
  assert.equal(readCitRule('items=stick\ndamage=3'), null);
  assert.equal(namesFromCitValue('regex:Letter (to|from) .*'), null);
  assert.equal(namesFromCitValue('pattern:Letter to *'), null);
  assert.deepEqual(namesFromCitValue('regex:Excalibur'), ['Excalibur']);
});

test('CIT paths: same name, ./, ~/, full paths and bare names, as OptiFine and CIT Resewn look them up', () => {
  const files = new Set(['assets/minecraft/optifine/cit/swords/excalibur.png', 'assets/minecraft/optifine/cit/swords/other.png', 'assets/minecraft/textures/item/x.png', 'assets/minecraft/optifine/tex.png', 'assets/minecraft/models/item/y.json']);
  const has = (p: string) => files.has(p);
  const props = 'assets/minecraft/optifine/cit/swords/excalibur.properties';
  assert.equal(resolveCitAsset(props, undefined, '.png', has), 'assets/minecraft/optifine/cit/swords/excalibur.png');
  assert.equal(resolveCitAsset(props, 'other', '.png', has), 'assets/minecraft/optifine/cit/swords/other.png');
  assert.equal(resolveCitAsset(props, './other.png', '.png', has), 'assets/minecraft/optifine/cit/swords/other.png');
  assert.equal(resolveCitAsset(props, 'textures/item/x.png', '.png', has), 'assets/minecraft/textures/item/x.png');
  assert.equal(resolveCitAsset(props, '~/tex', '.png', has), 'assets/minecraft/optifine/tex.png');
  assert.equal(resolveCitAsset(props, 'item/y', '.json', has), 'assets/minecraft/models/item/y.json');
  assert.equal(resolveCitAsset(props, 'missing', '.png', has), null);
});

test('export 1.21.4 and 1.12.2: CIT files, no item definitions; a 3D look uses model=', async () => {
  for (const version of ['1.21.4', '1.12.2']) {
    const assets = fakeAssets('java', version, swordSpec(version));
    const p = withLook(version, ['Excalibur', 'excalibur']);
    const res = await exportTexturePack(p, assets);
    const zip = await unzipBlob(res.blob);
    assert.equal(zip['assets/minecraft/items/diamond_sword.json'], undefined, `${version}: no definition`);
    const props = text(zip['assets/minecraft/optifine/cit/names/diamond_sword/excalibur.properties'])!;
    assert.match(props, version === '1.21.4' ? /^components\.custom_name=regex:\(Excalibur\|excalibur\)$/m : /^nbt\.display\.Name=regex:\(Excalibur\|excalibur\)$/m);
    assert.match(props, /^texture=textures\/item\/names\/diamond_sword\/excalibur\.png$/m);
    assert.ok(zip[`${J}item/names/diamond_sword/excalibur.png`]);
    assert.ok(res.warnings.some((w) => /1 name-based texture needs OptiFine/.test(w)), res.warnings.join(' | '));
  }
  const p = withLook('1.20.1');
  p.extraFiles['assets/minecraft/models/item/names/diamond_sword/excalibur.json'] = blob(JSON.stringify({ textures: { layer0: 'minecraft:item/names/diamond_sword/excalibur' }, elements: [{ from: [0, 0, 7], to: [16, 16, 9], faces: { north: { texture: '#layer0' } } }] }));
  const files = await nameFiles(p, async () => undefined);
  assert.match(files.files['assets/minecraft/optifine/cit/names/diamond_sword/excalibur.properties'], /^model=item\/names\/diamond_sword\/excalibur$/m);
});

test('an opened pack’s OptiFine pattern stays CIT in every version and is named on 1.21.5+', async () => {
  const p = withLook('26.3', [], { match: 'ipattern:*excalibur*' });
  const res = await nameFiles(p, async () => SWORD_DEF);
  assert.equal(res.files['assets/minecraft/items/diamond_sword.json'], undefined);
  assert.match(res.files['assets/minecraft/optifine/cit/names/diamond_sword/name.properties'], /^components\.custom_name=ipattern:\*excalibur\*$/m);
  assert.deepEqual(res.patterns, ['*excalibur*']);
});

// ---------------------------------------------------------------------------------------------
// Opened packs

test('opened pack: CIT rules for one item become looks; textures move into textures/, other rules stay files', async () => {
  const assets = fakeAssets('java', '1.20.1', swordSpec('1.20.1'));
  const p = newTextureProject({ name: 'Imported', edition: 'java', version: '1.20.1' });
  const C = 'assets/minecraft/optifine/cit/';
  p.extraFiles[`${C}swords/excalibur.properties`] = blob('type=item\nitems=diamond_sword\nnbt.display.Name=Excalibur\n');
  p.extraFiles[`${C}swords/excalibur.png`] = png([1, 2, 3, 255]);
  p.extraFiles[`${C}swords/excalibur.png.mcmeta`] = blob('{"animation":{}}');
  p.extraFiles[`${C}swords/any.properties`] = blob('items=iron_sword\ntexture=textures/item/fancy.png\nnbt.display.Name=ipattern:*fancy*\n');
  p.overrides[`${J}item/fancy.png`] = png([4, 5, 6, 255]);
  p.extraFiles[`${C}swords/hurt.properties`] = blob('items=diamond_sword\ntexture=excalibur\ndamage=50%\nnbt.display.Name=Excalibur\n');
  p.extraFiles[`${C}cit.properties`] = blob('useGlint=false\n');
  assert.ok(hasPackNames(p));
  assert.equal(await adoptPackNames(p, assets), 2);
  const looks = Object.entries(p.nameVariants!).sort();
  assert.deepEqual(looks.map(([id, v]) => [id, v.item, v.names, v.match ?? null, v.texture]), [
    ['diamond_sword/excalibur', 'diamond_sword', ['Excalibur'], null, `${J}item/names/diamond_sword/excalibur.png`],
    ['iron_sword/any', 'iron_sword', [], 'ipattern:*fancy*', `${J}item/fancy.png`],
  ]);
  // the png is still used by the damage rule, which stays a file: copied, not moved
  assert.ok(p.extraFiles[`${C}swords/excalibur.png`]);
  assert.ok(p.overrides[`${J}item/names/diamond_sword/excalibur.png`]);
  assert.ok(p.extraFiles[`${J}item/names/diamond_sword/excalibur.png.mcmeta`]);
  assert.ok(p.extraFiles[`${C}swords/hurt.properties`] && p.extraFiles[`${C}cit.properties`]);
  assert.equal(p.extraFiles[`${C}swords/excalibur.properties`], undefined);
  // the look's flat model builds on the item's own
  assert.deepEqual(JSON.parse(await p.extraFiles['assets/minecraft/models/item/names/diamond_sword/excalibur.json'].text()), { parent: 'minecraft:item/diamond_sword', textures: { layer0: 'minecraft:item/names/diamond_sword/excalibur' } });
  assert.deepEqual(variantOfTexture(p, `${J}item/fancy.png`)?.[0], 'iron_sword/any');
  // nothing left to take in the second time
  assert.equal(await adoptPackNames(p, assets), 0);
});

test('opened pack: a 1.21.5+ definition’s name cases become looks, the rest of the definition stays', async () => {
  const assets = fakeAssets('java', '26.3', swordSpec('26.3'));
  const p = newTextureProject({ name: 'Imported', edition: 'java', version: '26.3' });
  p.extraFiles['assets/minecraft/items/diamond_sword.json'] = blob(
    JSON.stringify({
      model: {
        type: 'minecraft:select',
        property: 'minecraft:component',
        component: 'minecraft:custom_name',
        cases: [
          { when: ['Excalibur', { text: 'Caliburn' }], model: { type: 'minecraft:model', model: 'minecraft:item/excalibur' } },
          { when: { text: 'Red', color: 'red' }, model: { type: 'minecraft:model', model: 'minecraft:item/red' } },
          { when: 'Vanilla', model: { type: 'minecraft:model', model: 'minecraft:item/iron_sword' } },
        ],
        fallback: SWORD_DEF.model,
      },
    }),
  );
  p.extraFiles['assets/minecraft/models/item/excalibur.json'] = blob(JSON.stringify({ parent: 'item/handheld', textures: { layer0: 'item/excalibur' } }));
  p.overrides[`${J}item/excalibur.png`] = png([9, 9, 9, 255]);
  assert.equal(await adoptPackNames(p, assets), 1);
  const [id, v] = Object.entries(p.nameVariants!)[0];
  assert.equal(id, 'diamond_sword/excalibur');
  assert.deepEqual(v.names, ['Excalibur', 'Caliburn']);
  assert.equal(v.model, 'minecraft:item/excalibur');
  assert.equal(v.texture, `${J}item/excalibur.png`);
  // the formatted name and the case showing a game model stay in the definition
  const left = JSON.parse(await p.extraFiles['assets/minecraft/items/diamond_sword.json'].text());
  assert.deepEqual(readNameSelect(left)!.kept.length, 1);
  assert.deepEqual(readNameSelect(left)!.cases.map((c) => c.names), [['Vanilla']]);
  // and the export puts the look back in front of them
  const zip = await unzipBlob((await exportTexturePack(p, assets)).blob);
  const cases = json(zip['assets/minecraft/items/diamond_sword.json']).model.cases;
  assert.deepEqual(cases.map((c: { when: unknown }) => c.when), [['Excalibur', 'Caliburn'], 'Vanilla', { text: 'Red', color: 'red' }]);
});

test('round trip: a 26.3 pack with a range to 1.20.1 opens with its looks once (not twice)', async () => {
  const assets = fakeAssets('java', '26.3', swordSpec('26.3'));
  const p = withLook('26.3', ['Excalibur', 'Sword of Light']);
  p.compat = { minVersion: '1.20.1', maxVersion: '26.3' };
  const res = await exportTexturePack(p, assets);
  const { project: q } = await importPack(new File([res.blob], 'names.zip'));
  q.version = '26.3';
  assert.ok(hasPackNames(q));
  assert.equal(await adoptPackNames(q, assets), 1);
  const looks = Object.values(q.nameVariants!);
  assert.equal(looks.length, 1);
  assert.deepEqual(looks[0].names, ['Excalibur', 'Sword of Light']);
  assert.equal(looks[0].texture, `${J}item/names/diamond_sword/excalibur.png`);
  assert.ok(!Object.keys(q.extraFiles).some((k) => k.endsWith('.properties')), 'the CIT copy is dropped');
  // the definition is the game's again: no file of the pack's own
  assert.equal(q.extraFiles['assets/minecraft/items/diamond_sword.json'], undefined);
});

test('round trip: a 1.12.2 pack with CIT opens with its looks', async () => {
  const assets = fakeAssets('java', '1.12.2', swordSpec('1.12.2'));
  const p = withLook('1.12.2', ['Excalibur']);
  const zip = zipSync({
    'pack.mcmeta': strToU8(JSON.stringify({ pack: { pack_format: 3, description: 'x' } })),
    ...Object.fromEntries(Object.entries(await unzipBlob((await exportTexturePack(p, assets)).blob)).filter(([k]) => k !== 'pack.mcmeta')),
  });
  const { project: q } = await importPack(new File([zip], 'old.zip'));
  assert.equal(await adoptPackNames(q, assets), 1);
  assert.deepEqual(Object.values(q.nameVariants!)[0].names, ['Excalibur']);
});

test('the guide’s example files are what the export writes', async () => {
  const p = withLook('26.3', ['Excalibur', 'Sword of Light']);
  p.compat = { minVersion: '1.20.1', maxVersion: '26.3' };
  const res = await nameFiles(p, async () => SWORD_DEF);
  assert.equal(res.files['assets/minecraft/items/diamond_sword.json'], NAMES_DEFINITION);
  assert.equal(res.files['assets/minecraft/optifine/cit/names/diamond_sword/excalibur.properties'], NAMES_CIT);
  const model = JSON.parse(await p.extraFiles['assets/minecraft/models/item/names/diamond_sword/excalibur.json'].text());
  assert.equal(`${JSON.stringify(model, null, 2)}\n`, NAMES_MODEL);
});

test('a project file keeps the looks with their textures and models', async () => {
  const p = withLook('26.3', ['Excalibur']);
  const blob = await writeProjectArchive('textures', [{ type: 'texturepack', id: p.id, name: p.name, updatedAt: p.updatedAt, data: { project: p } }]);
  const archive = await readProjectArchive(blob);
  const q = (archive.load(archive.manifest.items[0]).data as { project: TexturePackProject }).project;
  assert.deepEqual(q.nameVariants, p.nameVariants);
  const v = Object.values(q.nameVariants!)[0];
  assert.ok(q.overrides[v.texture], 'the texture');
  assert.ok(q.extraFiles['assets/minecraft/models/item/names/diamond_sword/excalibur.json'], 'the model');
});
