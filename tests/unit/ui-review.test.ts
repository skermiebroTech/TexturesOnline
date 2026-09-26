// Regression tests for the ui review fixes: version grouping, colour input, crisp-text CSS rules,
// colour contrast and font licensing files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describeAccept, fileMatchesAccept, groupVersions, listVersionName, shortVersionName } from '../../src/ui/format';
import { parseHexWhileTyping } from '../../src/ui/color';
import { isRestoringScroll } from '../../src/core/router';
import type { GameVersion } from '../../src/core/types';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (p: string) => readFileSync(root + p, 'utf8');

const java = (id: string, type: GameVersion['type'] = 'release', name = id, releaseTime?: string): GameVersion => ({ edition: 'java', id, name, type, releaseTime });

test('groupVersions shows each heading once and keeps newest-first order inside groups', () => {
  // real interleaving from Mojang's manifest: weekly snapshots sit between hotfix releases
  const list: GameVersion[] = [
    java('26.4-snapshot-1', 'snapshot', '26.4 Snapshot 1', '2026-09-20T10:00:00Z'),
    java('26.3', 'release', '26.3', '2026-09-01T10:00:00Z'),
    java('26.3-rc-1', 'snapshot', '26.3 Release Candidate 1', '2026-08-25T10:00:00Z'),
    java('26w14a', 'snapshot', '26w14a', '2026-04-01T10:00:00Z'),
    java('1.21.11', 'release', '1.21.11', '2025-12-09T10:00:00Z'),
    java('25w45a', 'snapshot', '25w45a', '2025-11-04T10:00:00Z'),
    java('1.21.10', 'release', '1.21.10', '2025-10-07T10:00:00Z'),
    java('25w41a', 'snapshot', '25w41a', '2025-10-08T10:00:00Z'),
    java('1.21.9', 'release', '1.21.9', '2025-09-30T10:00:00Z'),
    java('1.20.6', 'release', '1.20.6', '2024-04-29T10:00:00Z'),
    java('24w14a', 'snapshot', '24w14a', '2024-04-03T10:00:00Z'),
    java('1.20.4', 'release', '1.20.4', '2023-12-07T10:00:00Z'),
  ];
  const groups = groupVersions(list);
  const labels = groups.map((g) => g.label);
  assert.deepEqual(labels, ['26.x', 'Snapshots 2026', '1.21', 'Snapshots 2025', '1.20', 'Snapshots 2024']);
  assert.equal(new Set(labels).size, labels.length, 'no repeated headings');
  assert.deepEqual(groups.flatMap((g) => g.items).length, list.length, 'nothing dropped');
  assert.deepEqual(groups[2].items.map((v) => v.id), ['1.21.11', '1.21.10', '1.21.9']);
  assert.deepEqual(groups[3].items.map((v) => v.id), ['25w45a', '25w41a']);
  assert.deepEqual(groupVersions([]), []);
});

test('groupVersions splits Bedrock releases and previews', () => {
  const b = (id: string, type: GameVersion['type'], name: string): GameVersion => ({ edition: 'bedrock', id, name, type });
  const groups = groupVersions([b('latest', 'release', 'Latest release (26.50)'), b('preview', 'preview', 'Latest preview (26.60.28)'), b('1.26.40.5', 'release', '26.40')]);
  assert.deepEqual(
    groups.map((g) => [g.label, g.items.map((v) => v.id)]),
    [
      ['Releases', ['latest', '1.26.40.5']],
      ['Previews', ['preview']],
    ],
  );
});

test('listVersionName keeps snapshot rows short and unambiguous', () => {
  assert.equal(listVersionName(java('26.3-rc-3', 'snapshot', '26.3 Release Candidate 3')), '26.3-rc-3');
  assert.equal(listVersionName(java('24w14a', 'snapshot', '24w14a')), '24w14a');
  assert.equal(listVersionName(java('26.3')), '26.3');
  const bedrock: GameVersion = { edition: 'bedrock', id: 'latest', name: 'Latest release (26.50)', type: 'release' };
  assert.equal(listVersionName(bedrock), 'Latest release (26.50)');
  assert.equal(shortVersionName(listVersionName(bedrock)), '26.50 (latest)');
});

test('parseHexWhileTyping only applies complete colours', () => {
  assert.equal(parseHexWhileTyping('#1', true), null);
  assert.equal(parseHexWhileTyping('#123', true), null, '#123 is also the start of #123456');
  assert.equal(parseHexWhileTyping('#1234', true), null);
  assert.equal(parseHexWhileTyping('#12345', true), null);
  assert.deepEqual(parseHexWhileTyping('#123456', true), [0x12, 0x34, 0x56, 255]);
  assert.deepEqual(parseHexWhileTyping(' 12345680 ', true), [0x12, 0x34, 0x56, 0x80]);
  assert.equal(parseHexWhileTyping('#12345680', false), null, 'no alpha digits without alpha');
  assert.deepEqual(parseHexWhileTyping('#abcdef', false), [0xab, 0xcd, 0xef, 255]);
  assert.equal(parseHexWhileTyping('#12345g', true), null);
});

test('file accept checks fall back to the extension when the browser gives no type', () => {
  assert.ok(fileMatchesAccept({ name: 'skin.PNG', type: '' }, 'image/png'));
  assert.ok(fileMatchesAccept({ name: 'photo.jpeg', type: '' }, 'image/*'));
  assert.ok(!fileMatchesAccept({ name: 'notes.txt', type: '' }, 'image/*'));
  assert.ok(!fileMatchesAccept({ name: 'noext', type: '' }, 'image/png'));
  assert.ok(fileMatchesAccept({ name: 'client.jar', type: '' }, '.jar,application/java-archive'));
  assert.equal(describeAccept('image/png'), 'a PNG image');
  assert.equal(describeAccept('image/*'), 'an image');
  assert.equal(describeAccept('image/png,image/jpeg'), 'a PNG image or a JPEG image');
  assert.equal(describeAccept('application/x-unknown'), 'a supported file');
  assert.equal(describeAccept('.zip,.mcpack'), '.zip or .mcpack files');
});

test('router is not restoring scroll outside a render', () => {
  assert.equal(isRestoringScroll(), false);
});

// ---------------------------------------------------------------------------------------------
// Crisp pixel font: the CSS must keep glyphs on the font's 8px-per-em grid.

const cssFiles = [
  ...readdirSync(root + 'src/styles').map((f) => `src/styles/${f}`),
  'src/tools/home/home.css',
  'src/tools/help/help.css',
  'src/tools/kit/kit.css',
].filter((f) => f.endsWith('.css'));

function declarations(prop: string): { file: string; value: string }[] {
  const out: { file: string; value: string }[] = [];
  for (const file of cssFiles) {
    const css = read(file).replace(/\/\*[\s\S]*?\*\//g, '');
    const re = new RegExp(`(?:^|[;{\\s])${prop}\\s*:\\s*([^;}]+)`, 'g');
    for (const m of css.matchAll(re)) out.push({ file, value: m[1].trim() });
  }
  return out;
}

test('letter-spacing is zero or whole font pixels (0.125em steps)', () => {
  const bad = declarations('letter-spacing').filter(({ value }) => {
    if (['0', 'normal', 'inherit'].includes(value)) return false;
    const m = /^(-?\d*\.?\d+)em$/.exec(value);
    return !m || Math.abs(Number(m[1]) / 0.125 - Math.round(Number(m[1]) / 0.125)) > 1e-9;
  });
  assert.deepEqual(bad, []);
});

test('literal font sizes are multiples of 8px', () => {
  const bad = declarations('font-size').filter(({ value }) => {
    const m = /^(\d+(?:\.\d+)?)px$/.exec(value);
    return m ? Number(m[1]) % 8 !== 0 : false;
  });
  assert.deepEqual(bad, []);
});

test('text shadows are measured in font pixels, not fixed px', () => {
  const bad = declarations('text-shadow').filter(({ value }) => value !== 'none' && /\dpx/.test(value.split(/rgba?\(/)[0]));
  assert.deepEqual(bad, []);
});

test('page containers centre on whole pixels', () => {
  const layout = read('src/styles/layout.css');
  const block = layout.slice(layout.indexOf('.container {'), layout.indexOf('}', layout.indexOf('.container {')));
  assert.match(block, /margin-left:\s*max\(0px,\s*round\(down,/);
  // equal columns snap to whole pixels where round() exists, keeping the fr fallback elsewhere
  const home = read('src/tools/home/home.css');
  assert.match(home, /\.tool-grid \{\s*display: grid;\s*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(home, /@supports \(width: round\(down, 1px, 1px\)\) \{[^@]*\.tool-grid,[^}]*repeat\(3, round\(down, \(100% - 40px\) \/ 3, 1px\)\)/);
  assert.ok(home.indexOf('@supports') < home.indexOf('/* ---------- Responsive'), 'breakpoints still override the snapped columns');
});

// ---------------------------------------------------------------------------------------------
// Colour contrast (WCAG AA 4.5:1 for normal text)

function tokens(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)) out[m[1]] = m[2];
  return out;
}
function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrast = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

test('text and accent tokens meet WCAG AA in both themes', () => {
  const css = read('src/styles/tokens.css');
  const darkStart = css.indexOf(':root {');
  const lightStart = css.indexOf(":root[data-theme='light'] {");
  const dark = tokens(css.slice(darkStart, css.indexOf('\n}', darkStart)));
  const light = { ...dark, ...tokens(css.slice(lightStart, css.indexOf('\n}', lightStart))) };
  const failures: string[] = [];
  for (const [theme, t] of [['dark', dark], ['light', light]] as const) {
    for (const fg of ['text', 'text-2', 'text-3']) {
      for (const bg of ['bg', 'bg-elev', 'surface', 'surface-2', 'surface-3']) {
        const r = contrast(t[fg], t[bg]);
        if (r < 4.5) failures.push(`${theme} ${fg} on ${bg}: ${r.toFixed(2)}`);
      }
    }
    for (const fg of ['green', 'blue', 'purple', 'gold', 'red']) {
      for (const bg of ['bg', 'surface', 'surface-2']) {
        const r = contrast(t[fg], t[bg]);
        if (r < 4.5) failures.push(`${theme} ${fg} on ${bg}: ${r.toFixed(2)}`);
      }
    }
  }
  assert.deepEqual(failures, []);
});

// ---------------------------------------------------------------------------------------------
// Font files and licence

test('the UI font ships as woff2 with its OFL licence and credits', () => {
  for (const f of ['texel-regular.woff2', 'texel-bold.woff2']) {
    const buf = readFileSync(root + `public/fonts/${f}`);
    assert.equal(buf.subarray(0, 4).toString('latin1'), 'wOF2', `${f} is woff2`);
  }
  const ofl = read('public/fonts/OFL.txt');
  assert.match(ofl, /IdreesInc\/Minecraft-Font/);
  assert.match(ofl, /IdreesInc\/Monocraft/);
  assert.match(ofl, /SIL OPEN FONT LICENSE Version 1\.1/i);
  const tokensCss = read('src/styles/tokens.css');
  assert.equal((tokensCss.match(/font-display: swap/g) ?? []).length, 2);
});
