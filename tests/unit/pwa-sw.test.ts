// Service worker decisions (src/pwa/sw-logic.ts), the offline app shell's site-root hint, where
// files opened with the installed app go (src/pwa/route-file.ts) and the install/update helpers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CACHE_PREFIX,
  PRECACHE_PREFIX,
  buildInfo,
  cacheable,
  classifyRequest,
  hashString,
  needsSlashRedirect,
  overLimit,
  pageKey,
  precacheName,
  precacheUrl,
  scopePath,
  shellKey,
  shouldPrecache,
  staleCaches,
  withBaseHint,
  withSlash,
} from '../../src/pwa/sw-logic';
import { isShaderPack, isSkinSize, planLaunch, pngSize } from '../../src/pwa/route-file';
import { platformOf, sameBuild } from '../../src/pwa/detect';
import { render404 } from '../../src/app/seo/build';
import { APP_TEXT_EN, appText } from '../../src/pwa/text';

const ROOT = 'https://texturepackmaker.com/';
const PROJECT = 'https://skermiebrotech.github.io/TexturesOnline/';
const nav = (url: string) => ({ url, method: 'GET', mode: 'navigate' });
const get = (url: string, mode = 'cors') => ({ url, method: 'GET', mode });

test('requests are routed by kind, at the domain root and under a project path', () => {
  for (const scope of [ROOT, PROJECT]) {
    assert.equal(classifyRequest(nav(`${scope}`), scope), 'navigate');
    assert.equal(classifyRequest(nav(`${scope}de/textures/`), scope), 'navigate');
    assert.equal(classifyRequest(nav(`${scope}textures/3f2c-aa`), scope), 'navigate');
    assert.equal(classifyRequest(get(`${scope}assets/index-abc.js`), scope), 'asset');
    assert.equal(classifyRequest(get(`${scope}assets/editor-x.css`), scope), 'asset');
    assert.equal(classifyRequest(get(`${scope}screenshots/textures.jpg`, 'no-cors'), scope), 'static');
    assert.equal(classifyRequest(get(`${scope}icons/icon-192.png`), scope), 'static');
    assert.equal(classifyRequest(get(`${scope}data/bedrock/versions.json`), scope), 'data');
    assert.equal(classifyRequest(get(`${scope}site.webmanifest`), scope), 'data');
    assert.equal(classifyRequest({ url: `${scope}share-target/`, method: 'POST', mode: 'navigate' }, scope), 'share');
    assert.equal(classifyRequest(get(`${scope}sw.js`), scope), 'bypass', 'the worker script is never served from a cache');
    assert.equal(classifyRequest({ ...get(`${scope}assets/x.ogg`), range: true }, scope), 'bypass', 'range requests go to the network');
    assert.equal(classifyRequest({ url: `${scope}textures/`, method: 'POST', mode: 'cors' }, scope), 'bypass');
  }
  // Other sites (Mojang, GitHub) are the app's own business: it caches game files itself.
  assert.equal(classifyRequest(get('https://piston-data.mojang.com/v1/objects/abc/client.jar'), ROOT), 'bypass');
  assert.equal(classifyRequest(get('https://raw.githubusercontent.com/Mojang/bedrock-samples/main/x.png'), ROOT), 'bypass');
  // Outside a project site's folder (another project on the same github.io host)
  assert.equal(classifyRequest(nav('https://skermiebrotech.github.io/OtherRepo/'), PROJECT), 'bypass');
  assert.equal(scopePath('https://skermiebrotech.github.io/TexturesOnline', PROJECT), '');
  assert.equal(scopePath(`${PROJECT}de/help/`, PROJECT), 'de/help/');
  assert.equal(scopePath('https://example.com/de/', PROJECT), null);
});

test('pages are cached by folder URL; offline, a folder path without its slash is redirected first', () => {
  assert.equal(pageKey(`${ROOT}help#faq`), `${ROOT}help/`);
  assert.equal(pageKey(`${ROOT}help?s=faq`), `${ROOT}help/`, 'old ?s= links are the same page');
  assert.equal(pageKey(`${ROOT}help/?s=faq#x`), `${ROOT}help/`);
  assert.equal(pageKey(`${ROOT}de/`), `${ROOT}de/`);
  assert.equal(pageKey(`${ROOT}`), ROOT);
  assert.equal(pageKey(`${ROOT}llms.txt`), `${ROOT}llms.txt`);
  assert.equal(needsSlashRedirect(`${ROOT}help`), true);
  assert.equal(needsSlashRedirect(`${ROOT}help/`), false);
  assert.equal(needsSlashRedirect(`${ROOT}sitemap.xml`), false);
  assert.equal(withSlash(`${PROJECT}de/help?s=iris`), `${PROJECT}de/help/?s=iris`);
  assert.equal(withSlash(`${PROJECT}de/help#iris`), `${PROJECT}de/help/#iris`);
});

test('precache: the app code, fonts, icons, manifest, home page and app shell; not the big or crawler-only files', () => {
  for (const p of ['index.html', '404.html', 'site.webmanifest', 'favicon.svg', 'apple-touch-icon.png', 'assets/index-abc.js', 'assets/editor-x.css', 'assets/ogg-1.wasm', 'assets/art-x.webp', 'fonts/texel-regular.woff2', 'icons/icon-192.png', 'icons/icon-maskable-512.png', 'icons/shortcut-skins.png'])
    assert.ok(shouldPrecache(p), p);
  for (const p of ['de/index.html', 'help/index.html', 'guides/make-a-skin/index.html', 'screenshots/textures.jpg', 'screenshots/app/wide-home.webp', 'og-image.png', 'sitemap.xml', 'robots.txt', 'llms-full.txt', 'CNAME', 'sw.js', 'data/bedrock/versions.json', 'icons/icon-1024.png', 'store/x.png'])
    assert.ok(!shouldPrecache(p), p);
});

test('build info: sorted, versioned by content, unchanged files keep their keys', () => {
  const files = new Map([
    ['index.html', 'aaa'],
    ['assets/index-1.js', 'bbb'],
    ['sitemap.xml', 'ccc'],
    ['404.html', 'ddd'],
  ]);
  const a = buildInfo(files, 'assets/index-1.js');
  assert.deepEqual(a.files.map((f) => f.url), ['404.html', 'assets/index-1.js', 'index.html']);
  assert.equal(a.entry, 'assets/index-1.js');
  assert.match(a.version, /^[0-9a-f]{8}$/);
  assert.equal(buildInfo(new Map(files), 'assets/index-1.js').version, a.version, 'same files, same version');
  const b = buildInfo(new Map([...files, ['index.html', 'changed']]), 'assets/index-1.js');
  assert.notEqual(b.version, a.version, 'a changed page makes a new version');
  assert.equal(buildInfo(new Map([...files, ['sitemap.xml', 'other']]), 'assets/index-1.js').version, a.version, 'files outside the precache do not');
  // Hashed files are cached under their URL; others under URL + revision, so an old copy is reused only when identical.
  assert.equal(precacheUrl(PROJECT, { url: 'assets/index-1.js', revision: 'bbb' }), `${PROJECT}assets/index-1.js`);
  assert.equal(precacheUrl(PROJECT, { url: 'index.html', revision: 'aaa' }), `${PROJECT}index.html?__rev=aaa`);
  assert.equal(shellKey(ROOT, a, '404.html'), `${ROOT}404.html?__rev=ddd`);
  assert.equal(precacheName(a.version), `${PRECACHE_PREFIX}${a.version}`);
  assert.ok(PRECACHE_PREFIX.startsWith(CACHE_PREFIX));
  assert.equal(hashString('abc'), hashString('abc'));
  assert.notEqual(hashString('abc'), hashString('abd'));
});

test('activation keeps the current and the previous build, and leaves other caches alone', () => {
  const keys = ['tpm-precache-1', 'tpm-pages', 'tpm-precache-2', 'other-app', 'tpm-precache-3', 'tpm-runtime'];
  assert.deepEqual(staleCaches(keys, 'tpm-precache-3'), ['tpm-precache-1']);
  assert.deepEqual(staleCaches(keys, 'tpm-precache-3', 1), ['tpm-precache-1', 'tpm-precache-2']);
  assert.deepEqual(staleCaches(['tpm-precache-9'], 'tpm-precache-9'), []);
  assert.deepEqual(staleCaches([], 'tpm-precache-9'), []);
  assert.deepEqual(overLimit([1, 2, 3, 4], 2), [1, 2]);
  assert.deepEqual(overLimit([1], 2), []);
  assert.equal(cacheable({ ok: true, status: 200, type: 'basic' }), true);
  assert.equal(cacheable({ ok: true, status: 206, type: 'basic' }), false);
  assert.equal(cacheable({ ok: false, status: 404, type: 'basic' }), false);
  assert.equal(cacheable({ ok: false, status: 0, type: 'opaqueredirect' }), false);
});

/** Runs the 404.html loader script with a given address and an optional hint; returns the asset URLs it writes. */
function runLoader(html: string, href: string, hint?: string): string[] {
  const script = /<script>\s*(\(function \(\) \{[\s\S]*?\}\)\(\);)\s*<\/script>/.exec(html)?.[1];
  assert.ok(script, 'loader script');
  const written: string[] = [];
  const u = new URL(href);
  const document = { querySelector: (sel: string) => (sel.includes('app-base') && hint ? { content: hint } : null), write: (s: string) => written.push(s) };
  new Function('document', 'location', script)(document, { pathname: u.pathname, hostname: u.hostname });
  return Array.from(written.join('').matchAll(/(?:src|href)="([^"]+)"/g), (m) => m[1]);
}

test('offline, the app shell finds the site root from the hint the worker adds (any host, any path)', () => {
  const template = '<!doctype html><html><head><!--app-head--><link rel="manifest" href="./site.webmanifest" /><script type="module" crossorigin src="./assets/index-abc.js"></script></head><body><div id="app"><!--app-html--></div></body></html>';
  const html = render404({ template, iconSvg: () => '', assetsFor: () => ({ css: [], js: [] }), buildDate: '2026-10-20' });
  // Online at the domain root and on a github.io project site, as before
  assert.ok(runLoader(html, 'https://texturepackmaker.com/textures/abc').every((u) => u.startsWith('/') && !u.startsWith('/textures')));
  assert.ok(runLoader(html, 'https://skermiebrotech.github.io/TexturesOnline/textures/abc').every((u) => u.startsWith('/TexturesOnline/')));
  // Served by the worker under a project path on any host
  const hinted = withBaseHint(html, '/TexturesOnline/');
  assert.ok(hinted.indexOf('<meta name="app-base"') > 0 && hinted.indexOf('<meta name="app-base"') < hinted.indexOf('<script>'), 'the hint comes before the loader');
  assert.equal(withBaseHint(hinted, '/TexturesOnline/'), hinted, 'added once');
  const urls = runLoader(hinted, 'http://127.0.0.1:5000/TexturesOnline/de/help/', '/TexturesOnline/');
  assert.ok(urls.length > 0 && urls.every((u) => u.startsWith('/TexturesOnline/')), urls.join(' '));
  assert.ok(runLoader(html, 'http://127.0.0.1:5000/de/', '"><script>').every((u) => u.startsWith('/') && !u.includes('<')), 'a malformed hint is ignored');
});

test('files opened with the app go to the right tool', () => {
  const pack = (name: string, entries: string[]) => ({ name, entries });
  const javaPack = ['pack.mcmeta', 'pack.png', 'assets/minecraft/textures/block/stone.png'];
  assert.deepEqual(planLaunch([pack('Ocean.zip', javaPack)]), { route: '/textures', files: [0] });
  assert.deepEqual(planLaunch([pack('Ocean.mcpack', ['manifest.json', 'textures/blocks/stone.png'])]), { route: '/textures', files: [0] });
  assert.deepEqual(planLaunch([{ name: 'Broken.zip' }]), { route: '/textures', files: [0] }, 'unreadable archives still go to the importer, which explains the problem');
  assert.deepEqual(planLaunch([pack('BSL_v10.zip', ['shaders/composite.fsh', 'shaders/shaders.properties'])]), { route: '/shaders', files: [0] });
  assert.deepEqual(planLaunch([pack('Wrapped.zip', ['BSL/shaders/final.vsh'])]), { route: '/shaders', files: [0] });
  assert.deepEqual(planLaunch([pack('Vanilla.zip', ['pack.mcmeta', 'assets/minecraft/shaders/core/terrain.fsh'])]), { route: '/shaders', files: [0] });
  assert.deepEqual(planLaunch([pack('Vibrant.mcpack', ['manifest.json', 'lighting/global.json', 'atmospherics/atmospherics.json'])]), { route: '/shaders', files: [0] });
  assert.deepEqual(
    planLaunch([pack('Textures+shaders.zip', ['pack.mcmeta', 'assets/minecraft/shaders/core/x.fsh', 'assets/minecraft/textures/block/stone.png'])]),
    { route: '/textures', files: [0] },
    'a texture pack that also changes shaders opens as a texture pack',
  );
  assert.deepEqual(planLaunch([pack('a.zip', javaPack), { name: 'skin.png' }, pack('b.mcpack', [])]), { route: '/merge-texture-packs', files: [0, 2] });
  assert.equal(planLaunch(Array.from({ length: 10 }, (_, i) => pack(`${i}.zip`, javaPack)))?.files.length, 8);
  assert.deepEqual(planLaunch([{ name: 'Steve.png', png: { width: 64, height: 64 } }]), { route: '/skins', files: [0] });
  assert.deepEqual(planLaunch([{ name: 'old.PNG', png: { width: 64, height: 32 } }]), { route: '/skins', files: [0] });
  assert.deepEqual(planLaunch([{ name: 'stone.png', png: { width: 16, height: 16 } }]), { route: '/texture-pack-converter', files: [0] });
  assert.equal(planLaunch([{ name: 'notes.txt' }]), null);
  assert.equal(planLaunch([]), null);
  assert.equal(isShaderPack([]), false);
  assert.equal(isSkinSize({ width: 128, height: 128 }), false);
});

test('PNG size from the header', () => {
  const head = new Uint8Array(24);
  head.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 64, 0, 0, 0, 32]);
  assert.deepEqual(pngSize(head), { width: 64, height: 32 });
  assert.equal(pngSize(new Uint8Array(24)), null);
  assert.equal(pngSize(new Uint8Array(4)), null);
});

test('install help by platform: the prompt where browsers have one, steps for Safari, nothing elsewhere', () => {
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  const ipad = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
  const macChrome = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
  const oldSafari = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15';
  const firefox = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0';
  assert.equal(platformOf(iphone), 'ios');
  assert.equal(platformOf(ipad, 5), 'ios', 'an iPad asks for the desktop site but has touch');
  assert.equal(platformOf(ipad, 0), 'mac-safari');
  assert.equal(platformOf(oldSafari), null, 'Add to Dock needs Safari 17');
  assert.equal(platformOf(macChrome), null, 'Chrome uses its own prompt');
  assert.equal(platformOf(firefox), null);
});

test('a page already running the new build switches workers without asking', () => {
  const base = 'https://texturepackmaker.com/';
  assert.equal(sameBuild({ version: 'x', entry: 'assets/index-new.js' }, 'https://texturepackmaker.com/assets/index-new.js', base), true);
  assert.equal(sameBuild({ version: 'x', entry: 'assets/index-new.js' }, 'https://texturepackmaker.com/assets/index-old.js', base), false);
  assert.equal(sameBuild({ version: 'x', entry: 'assets/index-a.js' }, `${PROJECT}assets/index-a.js`, PROJECT), true);
  assert.equal(sameBuild(null, 'https://texturepackmaker.com/assets/index-new.js', base), false);
});

test('app texts: English is complete; translations fall back to it', () => {
  for (const [k, v] of Object.entries(APP_TEXT_EN)) assert.ok(Array.isArray(v) ? v.length > 0 : v.length > 0, k);
  assert.deepEqual(appText('de'), { ...APP_TEXT_EN, ...appText('de') });
  assert.ok(APP_TEXT_EN.cantOpen.includes('{name}'));
});
