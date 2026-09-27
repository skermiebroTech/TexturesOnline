import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROUTES, href, matchRoute, normalizePath, parseLocation, resolveRoute } from '../../src/core/router';

test('parseLocation splits path and query and normalises the path', () => {
  const a = parseLocation('#/textures/abc?x=1&y=two');
  assert.equal(a.path, '/textures/abc');
  assert.equal(a.query.get('x'), '1');
  assert.equal(a.query.get('y'), 'two');
  assert.equal(parseLocation('').path, '/');
  assert.equal(parseLocation('#').path, '/');
  assert.equal(parseLocation('#/').path, '/');
  assert.equal(parseLocation('#/help/').path, '/help');
  assert.equal(parseLocation('help').path, '/help');
  assert.equal(parseLocation('#/help?s=faq').query.get('s'), 'faq');
});

test('normalizePath collapses slashes and trims the trailing one', () => {
  assert.equal(normalizePath('//skins///x/'), '/skins/x');
  assert.equal(normalizePath('/'), '/');
  assert.equal(normalizePath(''), '/');
});

test('matchRoute extracts and decodes params', () => {
  assert.deepEqual(matchRoute('/textures/:id', '/textures/abc'), { id: 'abc' });
  assert.deepEqual(matchRoute('/textures/:id', '/textures/a%20b'), { id: 'a b' });
  assert.deepEqual(matchRoute('/', '/'), {});
  assert.equal(matchRoute('/textures/:id', '/textures'), null);
  assert.equal(matchRoute('/textures', '/textures/abc'), null);
  assert.equal(matchRoute('/skins/:id', '/textures/abc'), null);
  assert.equal(matchRoute('/textures/:id', '/textures/%E0%A4%A'), null, 'malformed escapes do not match');
});

test('resolveRoute maps every spec route to its tool', () => {
  const cases: [string, string, Record<string, string>][] = [
    ['/', 'home', {}],
    ['/textures', 'textures', {}],
    ['/textures/p1', 'textures', { id: 'p1' }],
    ['/skins', 'skins', {}],
    ['/skins/s1', 'skins', { id: 's1' }],
    ['/shaders', 'shaders', {}],
    ['/shaders/x', 'shaders', { id: 'x' }],
    ['/help', 'help', {}],
    ['/kit', 'kit', {}],
  ];
  for (const [path, tool, params] of cases) {
    const r = resolveRoute(path);
    assert.ok(r, `route for ${path}`);
    assert.equal(r.route.tool, tool);
    assert.deepEqual(r.params, params);
  }
  assert.equal(resolveRoute('/nope'), null);
  assert.equal(resolveRoute('/textures/a/b'), null);
});

test('every route has a title and a lazy loader', () => {
  for (const r of ROUTES) {
    assert.equal(typeof r.load, 'function');
    assert.ok(r.title.length > 0 && r.title.length <= 60, `title of ${r.pattern}: ${r.title}`);
  }
});

test('href builds path links (folders end in a slash, project pages do not)', () => {
  assert.equal(href('/help'), '/help/');
  assert.equal(href('skins/1'), '/skins/1');
  assert.equal(href('#/textures'), '/textures/');
});
