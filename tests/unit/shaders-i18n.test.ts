// The Shader Maker in other languages: the editor's copy of the settings, presets and notes
// ('shaders.options') says exactly what the generators' own tables say in English, covers every one
// of them, and the exported files stay the same whatever the page's language (only messages to the
// user are translated).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmt, registerTranslations, setTextLocale, type LanguageFile } from '../../src/i18n/editor-text';
import { TRANSLATED_LOCALES } from '../../src/i18n/locales';
import { ot } from '../../src/tools/shaders/ui/i18n/options';
import { mt } from '../../src/tools/shaders/ui/i18n/messages';
import * as iris from '../../src/tools/shaders/iris/index';
import * as vanilla from '../../src/tools/shaders/vanilla/index';
import * as bedrock from '../../src/tools/shaders/bedrock/index';
import { IRIS_NOTES } from '../../src/tools/shaders/iris/notes';
import type { OptionDef, OptionValues } from '../../src/core/types';

interface TargetText {
  groups: Record<string, string>;
  options: Record<string, { label: string; description: string; choices?: Record<string, string> }>;
  presets: Record<string, { label: string; description: string }>;
  notes?: Record<string, { title: string; text: string }>;
}

const TABLES = [
  { name: 'iris', mod: iris, text: ot.iris as unknown as TargetText, notes: IRIS_NOTES.filter((n) => ['settings', 'vulkan', 'performance'].includes(n.id)) },
  { name: 'vanilla', mod: vanilla, text: ot.vanilla as unknown as TargetText, notes: [] },
  { name: 'bedrock', mod: bedrock, text: ot.bedrock as unknown as TargetText, notes: bedrock.BEDROCK_VV_NOTES.filter((n) => n.id !== 'activate') },
] as const;

test("the editor's settings text is the generators' English, for every setting, choice, group, preset and note", () => {
  setTextLocale('en');
  for (const { name, mod, text, notes } of TABLES) {
    assert.deepEqual(Object.values(text.groups), Object.values(mod.GROUPS), `${name} groups`);
    assert.deepEqual(Object.keys(text.options), (mod.OPTIONS as OptionDef[]).map((o) => o.key), `${name} option keys`);
    for (const o of mod.OPTIONS as OptionDef[]) {
      const tr = text.options[o.key];
      assert.equal(tr.label, o.label, `${name}.${o.key} label`);
      assert.equal(tr.description, o.description, `${name}.${o.key} description`);
      assert.equal(Object.values(mod.GROUPS).includes(o.group as never), true, `${name}.${o.key} group`);
      assert.deepEqual(tr.choices ?? null, o.options ? Object.fromEntries(o.options.map((c) => [c.value, c.label])) : null, `${name}.${o.key} choices`);
      if (o.unit && /[a-z]/i.test(o.unit) && o.unit !== 'EV') assert.ok(o.unit in ot.units, `${name}.${o.key}: unit "${o.unit}" has a translation`);
    }
    assert.deepEqual(
      Object.entries(text.presets).map(([id, p]) => [id, p.label, p.description]),
      mod.PRESETS.map((p) => [p.id, p.label, p.description]),
      `${name} presets`,
    );
    assert.deepEqual(
      Object.entries(text.notes ?? {}).map(([id, n]) => [id, n.title, n.text]),
      notes.map((n) => [n.id, n.title, n.text]),
      `${name} notes`,
    );
  }
});

/** Every translation of the shader editors, as the loaders would register them. */
async function registerAll(): Promise<void> {
  for (const locale of TRANSLATED_LOCALES) {
    for (const folder of ['../../src/tools/shaders/i18n', '../../src/tools/shaders/ui/i18n', '../../src/tools/shaders/packedit/i18n']) {
      const mod = (await import(`${folder}/${locale}.ts`)) as { default: LanguageFile };
      registerTranslations(locale, mod.default);
    }
  }
}

test('exported files are the same in every language; only messages are translated', async () => {
  await registerAll();
  const irisValues = iris.presetValues('golden');
  const bedrockValues: OptionValues = { ...bedrock.presetValues('cinematic'), nightBrightness: 0.4, coloredLights: true, classicFog: true, fogDistance: 0.7 };
  const fog = 'vec4 linear_fog(vec4 inColor, float vertexDistance, float fogStart, float fogEnd, vec4 fogColor) {\n    return inColor;\n}\n';
  const sources = { 'assets/minecraft/shaders/include/fog.glsl': fog, 'assets/minecraft/shaders/core/x.vsh': '#version 150\nvoid main() {}\n' };
  const vanillaValues: OptionValues = { ...vanilla.defaults(), fogStart: 0.5, bloom: true };
  const info = { versionId: '1.20.1', packFormat: { major: 15, minor: 0 } };

  setTextLocale('en');
  const en = {
    iris: iris.generateIrisPack(irisValues, { name: 'Pack', description: 'Warm', version: '1.21.4', preset: 'golden' }),
    bedrock: bedrock.generateBedrockVisuals(bedrockValues, { version: 'latest', preset: 'cinematic' }),
    vanilla: vanilla.generateVanillaShaderFiles(sources, vanillaValues, info),
    notes: bedrock.bedrockCompatibilityNotes(bedrockValues),
    support: vanilla.supportedFor('1.16.5'),
  };
  assert.ok(en.vanilla.warnings.some((w) => /Bloom needs Java 26\.3/.test(w)));
  for (const locale of TRANSLATED_LOCALES) {
    setTextLocale(locale);
    try {
      assert.deepEqual(iris.generateIrisPack(irisValues, { name: 'Pack', description: 'Warm', version: '1.21.4', preset: 'golden' }), en.iris, `${locale}: Iris pack`);
      assert.deepEqual(bedrock.generateBedrockVisuals(bedrockValues, { version: 'latest', preset: 'cinematic' }), en.bedrock, `${locale}: Vibrant Visuals pack`);
      const v = vanilla.generateVanillaShaderFiles(sources, vanillaValues, info);
      assert.deepEqual(v.files, en.vanilla.files, `${locale}: vanilla shader files`);
      assert.equal(v.warnings.length, en.vanilla.warnings.length);
      assert.ok(v.warnings.includes(mt.vanilla.warnings.bloomOld), `${locale}: warnings in the page's language`);
      assert.notDeepEqual(v.warnings, en.vanilla.warnings, `${locale}: warnings translated`);
      const notes = bedrock.bedrockCompatibilityNotes(bedrockValues);
      assert.equal(notes.length, en.notes.length);
      assert.equal(notes[1], mt.bedrock.coloredLights);
      assert.equal(vanilla.supportedFor('1.16.5').notes[0], mt.vanilla.noCoreShaders);
      assert.notEqual(mt.vanilla.noCoreShaders, en.support.notes[0]);
      assert.ok(!/\{|\}/.test(notes[0]), `${locale}: ${notes[0]}`);
      assert.ok(fmt(mt.vanilla.missingSources, { version: mt.vanilla.thisVersion }).length > 20);
    } finally {
      setTextLocale('en');
    }
  }
});
