// The editors' translations (src/**/i18n/: the UI kit, the shared editor pieces and each tool):
// every language translates every section, with the same keys and parameters, valid plural forms,
// and no English left in it. Folders are found automatically, so a new tool only needs its files.
//
// In an i18n/ folder: de.ts, es.ts, pt-br.ts and ja.ts are language files (default export: section
// id -> translation), load.ts is the loader, every other file defines English sections. A language
// file may export SAME_AS_ENGLISH, a list of '<section id>:<key.path>' entries whose text is
// rightly the same as the English one (names such as the totem styles).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fmt, messageParams, registeredSections, type TextTree } from '../../src/i18n/editor-text';
import { LOCALE_INFO, TRANSLATED_LOCALES, type TranslatedLocale } from '../../src/i18n/locales';

const ROOT = join(import.meta.dirname, '../..');
const SRC = join(ROOT, 'src');
const LANG_FILES = new Set(TRANSLATED_LOCALES.map((l) => `${l}.ts`));

/** Names and words that are the same in every language. */
const SAME_EVERYWHERE = [
  'Texture Pack Maker',
  'Minecraft Launcher',
  'Minecraft',
  'Java Edition',
  'Bedrock Edition',
  'Java',
  'Bedrock',
  'OptiFine',
  'Mojang',
  'GitHub',
  'bedrock-samples',
  'mc-heads.net',
  'Steve',
  'Alex',
  'Classic',
  'Big head',
  'Full body',
];

function i18nFolders(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (!statSync(p).isDirectory()) continue;
    if (name === 'i18n' && p !== join(SRC, 'i18n')) out.push(p);
    else i18nFolders(p, out);
  }
  return out;
}

const folders = i18nFolders(SRC);

interface LangFile {
  folder: string;
  locale: TranslatedLocale;
  sections: Record<string, TextTree>;
  same: Set<string>;
}

async function load(): Promise<{ english: Map<string, TextTree>; files: LangFile[]; owner: Map<string, string> }> {
  const owner = new Map<string, string>();
  for (const folder of folders) {
    for (const name of readdirSync(folder).sort()) {
      if (!name.endsWith('.ts') || LANG_FILES.has(name) || name === 'load.ts') continue;
      const before = new Set(registeredSections().keys());
      await import(pathToFileURL(join(folder, name)).href);
      for (const id of registeredSections().keys()) if (!before.has(id)) owner.set(id, relative(ROOT, folder));
    }
  }
  const files: LangFile[] = [];
  for (const folder of folders) {
    for (const locale of TRANSLATED_LOCALES) {
      const mod = (await import(pathToFileURL(join(folder, `${locale}.ts`)).href)) as { default: Record<string, TextTree>; SAME_AS_ENGLISH?: string[] };
      files.push({ folder: relative(ROOT, folder), locale, sections: mod.default, same: new Set(mod.SAME_AS_ENGLISH ?? []) });
    }
  }
  return { english: registeredSections(), files, owner };
}

const loaded = load();

function leaves(tree: TextTree, prefix = ''): [string, string][] {
  return Object.entries(tree).flatMap(([k, v]) => (typeof v === 'string' ? [[`${prefix}${k}`, v] as [string, string]] : leaves(v, `${prefix}${k}.`)));
}

/** Parameters shown in the text (plain {x}, or a plural whose branches show #), and those only used to choose a branch. */
function paramUse(msg: string): { shown: Set<string>; all: Set<string> } {
  const all = new Set(messageParams(msg));
  const shown = new Set<string>();
  for (const name of all) {
    if (new RegExp(`\\{\\s*${name}\\s*\\}`).test(msg)) shown.add(name);
    const plural = new RegExp(`\\{\\s*${name}\\s*,\\s*plural\\s*,`).exec(msg);
    if (plural && msg.slice(plural.index).includes('#')) shown.add(name);
  }
  return { shown, all };
}

/** Branch keys of every plural in a message, by parameter. */
function pluralBranches(msg: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const re = /\{\s*([\w]+)\s*,\s*plural\s*,/g;
  for (let m = re.exec(msg); m; m = re.exec(msg)) {
    let i = m.index + m[0].length;
    const keys: string[] = [];
    for (;;) {
      const open = msg.indexOf('{', i);
      const close = msg.indexOf('}', i);
      if (close >= 0 && (open < 0 || close < open)) break;
      if (open < 0) break;
      keys.push(msg.slice(i, open).trim());
      let depth = 0;
      let j = open;
      for (; j < msg.length; j++) {
        if (msg[j] === '{') depth++;
        else if (msg[j] === '}' && --depth === 0) break;
      }
      i = j + 1;
    }
    out.set(m[1], keys);
  }
  return out;
}

/** The text without parameters, code, file names, numbers and names that stay the same. */
function prose(msg: string): string {
  let s = msg;
  // Parameters with their plural/select options removed, keeping the branch text.
  s = s.replace(/\{\s*\w+\s*,\s*(?:plural|select)\s*,/g, ' ').replace(/\b(?:one|other|few|many|two|zero|=\d+)\s*\{/g, ' ').replace(/\{\w+\}/g, ' ').replace(/[{}#]/g, ' ');
  for (const name of SAME_EVERYWHERE) s = s.split(name).join(' ');
  return s.replace(/\S*[./_\\0-9]\S*/g, ' ');
}

/** Words that give English away (not words of German, Spanish or Portuguese; letters around them are any script's). */
const ENGLISH_WORDS = /(?<!\p{L})(the|and|your|with|you|to|of|is|are|this|that|from|can|it|its|were|has|have|not|or|on|by|be|will|which|when|there)(?!\p{L})/iu;

test('every editor section is translated into every language, once', async () => {
  const { english, files, owner } = await loaded;
  assert.ok(folders.length >= 5, `found ${folders.length} i18n folders`);
  assert.ok(english.size >= 8, `found ${english.size} sections`);
  for (const locale of TRANSLATED_LOCALES) {
    const seen = new Map<string, string>();
    for (const f of files.filter((x) => x.locale === locale)) {
      for (const id of Object.keys(f.sections)) {
        assert.ok(english.has(id), `${f.folder}/${locale}.ts translates unknown section "${id}"`);
        assert.ok(!seen.has(id), `section "${id}" is translated in both ${seen.get(id)} and ${f.folder} (${locale})`);
        seen.set(id, f.folder);
      }
    }
    for (const id of english.keys()) assert.ok(seen.has(id), `section "${id}" (${owner.get(id)}) has no ${locale} translation`);
  }
});

test('translations have the same keys and parameters as English, valid plurals, and format', async () => {
  const { english, files } = await loaded;
  const problems: string[] = [];
  for (const f of files) {
    const categories = new Set(new Intl.PluralRules(LOCALE_INFO[f.locale].lang).resolvedOptions().pluralCategories);
    for (const [id, tr] of Object.entries(f.sections)) {
      const en = english.get(id);
      if (!en) continue;
      const enLeaves = new Map(leaves(en));
      const trLeaves = new Map(leaves(tr));
      for (const k of enLeaves.keys()) if (!trLeaves.has(k)) problems.push(`${f.locale} ${id}:${k} is missing`);
      for (const k of trLeaves.keys()) if (!enLeaves.has(k)) problems.push(`${f.locale} ${id}:${k} is not in English`);
      for (const [k, text] of trLeaves) {
        const source = enLeaves.get(k);
        if (source === undefined) continue;
        const where = `${f.locale} ${id}:${k}`;
        if (!text.trim()) problems.push(`${where} is empty`);
        const a = paramUse(source);
        const b = paramUse(text);
        for (const p of b.all) if (!a.all.has(p)) problems.push(`${where} uses {${p}}, which English doesn't have`);
        for (const p of a.shown) if (!b.shown.has(p)) problems.push(`${where} doesn't show {${p}}`);
        for (const [param, keys] of pluralBranches(text)) {
          if (!keys.includes('other')) problems.push(`${where}: plural {${param}} has no "other" form`);
          for (const key of keys) if (!/^=\d+$/.test(key) && !categories.has(key as Intl.LDMLPluralRule)) problems.push(`${where}: plural form "${key}" doesn't exist in ${f.locale}`);
        }
        // Every parameter filled with a few values: nothing may stay in braces.
        for (const n of [0, 1, 2, 5, 1234]) {
          const params = Object.fromEntries([...a.all, ...b.all].map((p) => [p, /count|total|done|used|max|n$|position|packCount|javaCount|bedrockCount/.test(p) ? n : `‹${p}›`]));
          const out = fmt(text, params, f.locale);
          if (/\{[^}]*\}/.test(out)) problems.push(`${where} formats to "${out}"`);
        }
      }
    }
  }
  assert.deepEqual(problems, []);
});

test('translations contain no English left untranslated', async () => {
  const { english, files } = await loaded;
  const problems: string[] = [];
  for (const f of files) {
    for (const [id, tr] of Object.entries(f.sections)) {
      const en = english.get(id);
      if (!en) continue;
      const enLeaves = new Map(leaves(en));
      for (const [k, text] of leaves(tr)) {
        const source = enLeaves.get(k) ?? '';
        const key = `${id}:${k}`;
        if (f.same.has(key)) continue;
        const words = prose(text).match(/[A-Za-z]{2,}/g) ?? [];
        // Identical single-word labels (OK, Zoom, Shader) are fine; identical phrases are not.
        if (text === source && (prose(source).match(/[A-Za-z]{2,}/g) ?? []).length >= 2) problems.push(`${f.locale} ${key} is the English text: "${text}"`);
        else if (f.locale !== 'ja' && ENGLISH_WORDS.test(prose(text))) problems.push(`${f.locale} ${key} looks English: "${text}"`);
        else if (f.locale === 'ja' && words.length >= 2 && !/[぀-ヿ一-鿿]/.test(text)) problems.push(`ja ${key} has no Japanese: "${text}"`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

test('the English detector catches English', () => {
  assert.ok(ENGLISH_WORDS.test(prose('Download the pack')));
  assert.ok(ENGLISH_WORDS.test(prose('{count} files were left out')));
  assert.ok(!ENGLISH_WORDS.test(prose('Dá para juntar até {max} packs')));
  assert.ok(!ENGLISH_WORDS.test(prose('Das Pack ist in Java {version}, was neu ist')));
});

test('formatting: numbers, plurals and lists per language', () => {
  assert.equal(fmt('{count, plural, one {# file} other {# files}}', { count: 1 }, 'en'), '1 file');
  assert.equal(fmt('{count, plural, one {# file} other {# files}}', { count: 1234 }, 'en'), '1,234 files');
  assert.equal(fmt('{count, plural, one {# Datei} other {# Dateien}}', { count: 1234 }, 'de'), '1.234 Dateien');
  assert.equal(fmt('{count, plural, =0 {none} one {# file} other {# files}}', { count: 0 }, 'en'), 'none');
  assert.equal(fmt('ファイル{count}個', { count: 2 }, 'ja'), 'ファイル2個');
  assert.equal(fmt('{m, select, slim {slim arms} other {classic arms}}', { m: 'slim' }, 'en'), 'slim arms');
  assert.equal(fmt('{m, select, slim {slim arms} other {classic arms}}', { m: 'classic' }, 'en'), 'classic arms');
  assert.equal(fmt('{a, plural, one {{name} is} other {{name} are}} here', { a: 2, name: 'X and Y' }, 'en'), 'X and Y are here');
  assert.equal(fmt('{missing} stays', {}, 'en'), '{missing} stays');
  assert.equal(fmt('colour #ff00aa, {n}', { n: 3 }, 'en'), 'colour #ff00aa, 3');
});
