import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/i18n/all-content';
import { ALL_LINKS, allPage, allText } from '../../src/tools/all/content';
import { PUBLIC_PAGES } from '../../src/app/seo/meta';
import { FAQ, HELP_SECTION_IDS } from '../../src/tools/help/content';
import { flatten, type Child } from '../../src/app/markup';
import { TRANSLATED_LOCALES } from '../../src/i18n/locales';

test('every card on the Everything page leads to a page or help answer that exists', () => {
  const pages = new Set(PUBLIC_PAGES.map((m) => m.path));
  for (const to of ALL_LINKS) {
    const url = new URL(to, 'https://example.com');
    assert.ok(pages.has(url.pathname), `${to}: no such page`);
    assert.equal(url.search, '', `${to}: help sections are fragments (/help#id), not queries`);
    const s = url.hash.slice(1);
    if (s) assert.ok(HELP_SECTION_IDS.includes(s) || FAQ.some((f) => f.id === s), `${to}: no help section or answer "${s}"`);
  }
});

test('the Everything page has every card and section in every language', () => {
  const en = allText('en');
  for (const l of TRANSLATED_LOCALES) {
    const t = allText(l);
    assert.notEqual(t, en, `${l} is translated`);
    for (const id of Object.keys(en.cards) as (keyof typeof en.cards)[]) {
      assert.ok(t.cards[id].title && t.cards[id].desc, `${l}: card ${id}`);
      assert.notEqual(t.cards[id].desc, en.cards[id].desc, `${l}: card ${id} is translated`);
    }
    for (const id of Object.keys(en.sections) as (keyof typeof en.sections)[]) assert.ok(t.sections[id].title, `${l}: section ${id}`);
  }
  // One heading per section
  const count = (nodes: Child[], tag: string): number =>
    flatten(nodes).reduce<number>((n, c) => (typeof c === 'object' && c.kind === 'el' ? n + (c.tag === tag ? 1 : 0) + count(c.children, tag) : n), 0);
  assert.equal(count([allPage('en')], 'h2'), Object.keys(en.sections).length);
});
