// Path routing: URL <-> route path under any site base, legacy hash links, public page routes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROUTES, fragmentOf, parseLocation, resolveRoute, stripBase, toHref } from '../../src/core/router';
import { PUBLIC_PAGES, GUIDES, publicPageMeta } from '../../src/app/seo/meta';

const BASES = ['/', '/TexturesOnline/'];

test('toHref: public pages are folders, project pages are not, queries and fragments are kept', () => {
  const b = '/TexturesOnline/';
  assert.equal(toHref('/', '/'), '/');
  assert.equal(toHref('/', b), '/TexturesOnline/');
  assert.equal(toHref('/textures', b), '/TexturesOnline/textures/');
  assert.equal(toHref('/textures/', b), '/TexturesOnline/textures/');
  assert.equal(toHref('/textures/abc', b), '/TexturesOnline/textures/abc');
  assert.equal(toHref('/skins/abc/', '/'), '/skins/abc');
  assert.equal(toHref('/help#faq', b), '/TexturesOnline/help/#faq');
  assert.equal(toHref('/help#faq', '/'), '/help/#faq');
  assert.equal(toHref('/help?x=1#faq', '/'), '/help/?x=1#faq');
  assert.equal(toHref('/help?s=faq', b), '/TexturesOnline/help/?s=faq', 'old links keep their query');
  assert.equal(toHref('/guides/make-a-skin', '/'), '/guides/make-a-skin/');
  assert.equal(toHref('/kit', '/'), '/kit/');
  assert.equal(toHref('/nope/x', '/'), '/nope/x');
  assert.equal(toHref('/fonts/OFL.txt', b), '/TexturesOnline/fonts/OFL.txt');
  assert.equal(toHref('/help', 'TexturesOnline'), 'TexturesOnline/help/', 'a base without a slash still joins');
});

test('toHref turns legacy hash locations into paths', () => {
  assert.equal(toHref('#/textures/abc?x=1', '/'), '/textures/abc?x=1');
  assert.equal(toHref('#/', '/TexturesOnline/'), '/TexturesOnline/');
  assert.equal(toHref('#/help?s=java-packs', '/'), '/help/?s=java-packs');
  assert.equal(toHref('#/help#java-packs', '/'), '/help/#java-packs');
});

test('stripBase maps a URL path back to the route path', () => {
  const b = '/TexturesOnline/';
  assert.equal(stripBase('/TexturesOnline/', b), '/');
  assert.equal(stripBase('/TexturesOnline', b), '/');
  assert.equal(stripBase('/TexturesOnline/textures/', b), '/textures');
  assert.equal(stripBase('/TexturesOnline/textures/abc', b), '/textures/abc');
  assert.equal(stripBase('/other/textures/', b), null);
  assert.equal(stripBase('/textures/abc/', '/'), '/textures/abc');
  assert.equal(stripBase('/', '/'), '/');
});

test('every route path survives a round trip through a URL under each base', () => {
  const paths = ['/', '/textures', '/textures/p1', '/skins', '/skins/s-1', '/shaders', '/shaders/3f2c', '/help', '/kit', '/guides', ...GUIDES.map((g) => g.path)];
  for (const base of BASES) {
    for (const p of paths) {
      const url = toHref(p, base);
      assert.equal(stripBase(url.split('?')[0], base), p, `${p} via ${url}`);
      assert.ok(resolveRoute(p), `route for ${p}`);
    }
  }
});

test('parseLocation accepts paths, legacy hashes and ignores fragments', () => {
  assert.equal(parseLocation('/help#faq').path, '/help');
  assert.equal(parseLocation('/help#faq').query.toString(), '');
  assert.equal(fragmentOf('/help#faq'), 'faq');
  assert.equal(fragmentOf('/de/help?x=1#iris'), 'iris');
  assert.equal(fragmentOf('/help'), '');
  assert.equal(fragmentOf('#/help'), '', 'a legacy hash is the path, not a fragment');
  assert.equal(fragmentOf('#/help#faq'), 'faq');
  assert.equal(parseLocation('/help?s=faq#top').query.get('s'), 'faq');
  assert.equal(parseLocation('/help?s=faq#top').path, '/help');
  assert.equal(parseLocation('#/textures/abc?x=1').path, '/textures/abc');
  assert.equal(parseLocation('#/textures/abc?x=1').query.get('x'), '1');
  assert.equal(parseLocation('/guides/make-a-skin/').path, '/guides/make-a-skin');
});

test('public pages resolve to routes with the same title; private routes are not public', () => {
  for (const m of PUBLIC_PAGES) {
    const r = resolveRoute(m.path);
    assert.ok(r, `route for ${m.path}`);
    assert.equal(r.route.title, m.title, `title of ${m.path}`);
    assert.ok(!r.route.pattern.includes(':'), `${m.path} is a folder route`);
  }
  for (const p of ['/textures/abc', '/skins/x', '/shaders/y', '/kit', '/nope']) assert.equal(publicPageMeta(p), undefined, p);
  assert.equal(publicPageMeta('/help/')?.path, '/help');
  assert.equal(resolveRoute('/guides/nope'), null);
  assert.equal(resolveRoute('/guides/make-a-skin')?.route.tool, 'help');
  const patterns = ROUTES.map((r) => r.pattern);
  assert.equal(new Set(patterns).size, patterns.length, 'route patterns are unique');
});
