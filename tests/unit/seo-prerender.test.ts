// Build-time prerender output: every public page gets unique head tags, valid structured data that
// matches visible content, correct relative asset and link paths; plus sitemap, robots, llms files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSite, iconNamesUsed, pageFileName, relativeHref, rootPrefix, type SiteFile } from '../../src/app/seo/build';
import { prerenderPages } from '../../src/app/seo/pages';
import { GUIDES, PUBLIC_PAGES } from '../../src/app/seo/meta';
import { SITE_URL, absoluteUrl } from '../../src/app/site';
import { renderHtml, renderMarkdown, renderText, el, ic } from '../../src/app/markup';
import { formatGroups, BEDROCK_MIN_ENGINE } from '../../src/tools/guides/content';
import { DEFAULT_MIN_ENGINE } from '../../src/editions/bedrock/manifest';
import { KNOWN_RELEASE_FORMATS, formatPackFormat } from '../../src/editions/java/packformats';

const TEMPLATE = `<!doctype html>
<html lang="en" class="no-js" data-theme="dark">
  <head>
    <meta charset="UTF-8" />
    <!--app-head-->
    <link rel="icon" type="image/svg+xml" href="./favicon.svg" />
    <link rel="manifest" href="./site.webmanifest" />
    <link rel="preload" href="./fonts/texel-regular.woff2" as="font" type="font/woff2" crossorigin />
    <script type="module" crossorigin src="./assets/index-abc.js"></script>
    <link rel="modulepreload" crossorigin href="./assets/shared-abc.js">
    <link rel="stylesheet" crossorigin href="./assets/index-abc.css">
  </head>
  <body>
    <div id="app"><!--app-html--></div>
  </body>
</html>`;

const BUILD_DATE = '2026-09-27';
const files: SiteFile[] = buildSite({
  template: TEMPLATE,
  iconSvg: (name) => `<path data-name="${name}" d="M0 0h2v2H0z"/>`,
  assetsFor: (mods) => ({ css: mods.map((m) => `assets/${m.split('/').pop()!.replace('.ts', '')}.css`), js: ['assets/shared-abc.js', ...mods.map((m) => `assets/${m.split('/').pop()!.replace('.ts', '')}.js`)] }),
  buildDate: BUILD_DATE,
});
const byName = new Map(files.map((f) => [f.fileName, f.source]));
const pages = prerenderPages();

const one = (html: string, re: RegExp): string => {
  const m = re.exec(html);
  assert.ok(m, `missing ${re}`);
  return m[1];
};
const decode = (s: string) => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const visibleText = (html: string) =>
  decode(
    html
      .replace(/<head>[\s\S]*<\/head>/, ' ')
      .replace(/<script[\s\S]*?<\/script>/g, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/g, '')
      .replace(/<\/?(?:code|strong|em|a|span|b|i|time)\b[^>]*>/g, '')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?)])(?=\s|$)/g, '$1');
const jsonLd = (html: string) => JSON.parse(one(html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/)) as { '@context': string; '@graph': Record<string, unknown>[] };

test('one HTML file per public page, plus 404, sitemap, robots and llms files', () => {
  assert.equal(pages.length, PUBLIC_PAGES.length);
  for (const p of pages) assert.ok(byName.has(pageFileName(p.meta.path)), pageFileName(p.meta.path));
  for (const f of ['404.html', 'sitemap.xml', 'robots.txt', 'llms.txt', 'llms-full.txt']) assert.ok(byName.has(f), f);
  assert.equal(pageFileName('/'), 'index.html');
  assert.equal(pageFileName('/guides/make-a-skin'), 'guides/make-a-skin/index.html');
});

test('titles, descriptions and canonicals are unique, sized and absolute', () => {
  const seen = { title: new Set<string>(), description: new Set<string>(), canonical: new Set<string>() };
  for (const p of pages) {
    const html = byName.get(pageFileName(p.meta.path))!;
    const title = decode(one(html, /<title>([^<]*)<\/title>/));
    const description = decode(one(html, /<meta name="description" content="([^"]*)"/));
    const canonical = one(html, /<link rel="canonical" href="([^"]*)"/);
    assert.ok(title.length >= 20 && title.length <= 60, `title length ${title.length}: ${title}`);
    assert.ok(description.length >= 70 && description.length <= 155, `description length ${description.length}: ${description}`);
    assert.equal(canonical, absoluteUrl(p.meta.path));
    assert.ok(canonical.startsWith(SITE_URL) && canonical.endsWith('/'), canonical);
    assert.equal(one(html, /<meta property="og:url" content="([^"]*)"/), canonical);
    assert.equal(decode(one(html, /<meta property="og:title" content="([^"]*)"/)), title);
    assert.match(one(html, /<meta property="og:image" content="([^"]*)"/), /^https:\/\/.+\.(png|jpg)$/);
    assert.match(one(html, /<meta name="twitter:image" content="([^"]*)"/), /^https:\/\//);
    assert.equal(one(html, /<meta name="twitter:card" content="([^"]*)"/), 'summary_large_image');
    assert.equal(one(html, /<meta name="robots" content="([^"]*)"/), 'index,follow,max-image-preview:large');
    for (const [k, v] of Object.entries({ title, description, canonical })) {
      assert.ok(!seen[k as keyof typeof seen].has(v), `duplicate ${k}: ${v}`);
      seen[k as keyof typeof seen].add(v);
    }
  }
});

test('each page has exactly one h1 and real content inside #app', () => {
  for (const p of pages) {
    const html = byName.get(pageFileName(p.meta.path))!;
    const main = one(html, /<main id="main"[^>]*>([\s\S]*)<\/main>/);
    assert.equal((main.match(/<h1[\s>]/g) ?? []).length, 1, `${p.meta.path} h1 count`);
    assert.ok(visibleText(main).length > 800, `${p.meta.path} has substantial text`);
    assert.match(html, /<footer class="site-footer">/);
    assert.match(html, /<header class="topbar">/);
  }
});

test('no page contains undefined values, stray markers, project data or the old name in text', () => {
  for (const f of files) {
    assert.ok(!/\bundefined\b|\bNaN\b|\[object Object\]/.test(f.source), `${f.fileName} contains undefined/NaN`);
    assert.ok(!f.source.includes('<!--app-'), `${f.fileName} still has a template marker`);
    if (f.fileName.endsWith('.html')) {
      assert.ok(!/class="(recent|sk-recent|tx-rc|sh-recent)/.test(f.source), `${f.fileName} has project lists`);
      assert.ok(!/\/(textures|skins|shaders)\/[0-9a-f-]{8,}/i.test(f.source), `${f.fileName} links a project`);
      assert.ok(!visibleText(f.source).includes('TexturesOnline'), `${f.fileName} shows the old name`);
    }
  }
});

type Node = Record<string, unknown>;
const ofType = (graph: Node[], type: string) => graph.filter((n) => n['@type'] === type);

test('structured data parses and has the required properties', () => {
  for (const p of pages) {
    const html = byName.get(pageFileName(p.meta.path))!;
    const text = visibleText(html);
    const ld = jsonLd(html);
    assert.equal(ld['@context'], 'https://schema.org');
    const g = ld['@graph'];
    assert.ok(Array.isArray(g) && g.length >= 3);
    const ids = g.map((n) => n['@id']).filter(Boolean);
    assert.equal(new Set(ids).size, ids.length, 'unique @ids');

    const [org] = ofType(g, 'Organization');
    assert.equal(org.name, 'Skermiebro Tech Tips');
    assert.match(String(org.url), /^https:\/\/github\.com\//);
    const [site] = ofType(g, 'WebSite');
    assert.equal(site.name, 'Texture Pack Maker');
    assert.deepEqual(site.alternateName, ['TexturePackMaker']);
    assert.equal(site.url, SITE_URL);

    for (const app of ofType(g, 'WebApplication')) {
      assert.ok(app.name && app.url && app.description);
      assert.equal(app.applicationCategory, 'DesignApplication');
      assert.equal(app.operatingSystem, 'Web browser');
      assert.deepEqual(app.offers, { '@type': 'Offer', price: '0', priceCurrency: 'USD' });
      assert.ok(Array.isArray(app.featureList) && (app.featureList as unknown[]).length >= 3);
      assert.match(String((app.screenshot as Node).url), /^https:\/\//);
    }
    for (const faq of ofType(g, 'FAQPage')) {
      const qs = faq.mainEntity as Node[];
      assert.ok(qs.length >= 2);
      for (const q of qs) {
        assert.equal(q['@type'], 'Question');
        const answer = String((q.acceptedAnswer as Node).text);
        assert.ok(answer.length > 20);
        assert.ok(text.includes(String(q.name)), `FAQ question visible: ${q.name}`);
        assert.ok(text.includes(answer.slice(0, 40)), `FAQ answer visible: ${answer.slice(0, 40)}`);
      }
    }
    for (const how of ofType(g, 'HowTo')) {
      assert.ok(how.name);
      const steps = how.step as Node[];
      assert.ok(steps.length >= 2);
      steps.forEach((s, i) => {
        assert.equal(s['@type'], 'HowToStep');
        assert.equal(s.position, i + 1);
        assert.ok(text.includes(String(s.text)), `HowTo step visible: ${s.text}`);
      });
    }
    const crumbs = ofType(g, 'BreadcrumbList');
    if (p.meta.path !== '/') {
      assert.equal(crumbs.length, 1, `${p.meta.path} has breadcrumbs`);
      const items = crumbs[0].itemListElement as Node[];
      items.forEach((it, i) => {
        assert.equal(it.position, i + 1);
        assert.match(String(it.item), /^https:\/\//);
        assert.ok(text.includes(String(it.name)), `breadcrumb visible: ${it.name}`);
      });
      assert.equal(items[items.length - 1].item, absoluteUrl(p.meta.path));
    }
    for (const a of ofType(g, 'TechArticle')) {
      assert.ok(a.headline && a.datePublished && a.dateModified);
      assert.ok(text.includes(String(a.headline)));
    }
  }
});

test('page kinds carry the expected structured data', () => {
  const types = (path: string) => jsonLd(byName.get(pageFileName(path))!)['@graph'].map((n) => n['@type']);
  assert.ok(types('/').includes('WebApplication') && types('/').includes('FAQPage'));
  for (const t of ['/textures', '/skins', '/shaders']) assert.ok(types(t).includes('WebApplication') && types(t).includes('FAQPage'), t);
  assert.ok(types('/help').includes('FAQPage') && types('/help').filter((x) => x === 'HowTo').length >= 5);
  assert.ok(types('/guides').includes('CollectionPage') && types('/guides').includes('ItemList'));
  for (const g of GUIDES) assert.ok(types(g.path).includes('TechArticle'), g.path);
  assert.ok(types('/guides/make-a-texture-pack').includes('HowTo'));
  assert.ok(types('/guides/install-resource-packs').includes('HowTo'));
});

test('asset URLs and internal links are correct for the page depth', () => {
  const known = new Set(files.map((f) => f.fileName));
  const publicFiles = new Set(['favicon.svg', 'site.webmanifest', 'fonts/texel-regular.woff2', 'fonts/OFL.txt', 'og-image.png']);
  for (const p of pages) {
    const file = pageFileName(p.meta.path);
    const html = byName.get(file)!;
    const pageUrl = new URL(file.replace(/index\.html$/, ''), 'https://x.test/base/');
    const prefix = rootPrefix(p.meta.path);
    assert.ok(html.includes(`src="${prefix}assets/index-abc.js"`), `${file} entry script`);
    assert.ok(html.includes(`href="${prefix}assets/index-abc.css"`), `${file} main css`);
    for (const m of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
      const ref = decode(m[1]);
      if (/^(https?:|#|mailto:)/.test(ref)) continue;
      const u = new URL(ref, pageUrl);
      assert.ok(u.pathname.startsWith('/base/'), `${file}: ${ref} leaves the site`);
      const rel = u.pathname.slice('/base/'.length);
      if (rel.startsWith('assets/')) continue;
      const target = rel === '' || rel.endsWith('/') ? `${rel}index.html` : rel;
      assert.ok(known.has(target) || publicFiles.has(target), `${file}: ${ref} -> ${target} exists`);
    }
    // shared chunk from the template is not preloaded twice
    assert.equal((html.match(/assets\/shared-abc\.js/g) ?? []).length, 1, `${file} dedupes preloads`);
  }
  assert.equal(relativeHref('/help?s=faq', '../'), '../help/?s=faq');
  assert.equal(relativeHref('/', './'), './');
  assert.equal(relativeHref('/fonts/OFL.txt', '../../'), '../../fonts/OFL.txt');
});

test('tool pages hide the prerendered text while booting and preconnect to game-file hosts', () => {
  for (const t of ['/textures', '/skins', '/shaders']) {
    const html = byName.get(pageFileName(t))!;
    assert.match(html, /<main id="main" class="page" tabindex="-1" data-boot="replace">/);
    assert.match(html, /<link rel="preconnect" href="https:\/\/piston-data\.mojang\.com" crossorigin/);
    assert.match(html, /<html[^>]*data-tool="[a-z]+"/);
  }
  const home = byName.get('index.html')!;
  assert.match(home, /<main id="main" class="page" tabindex="-1">/);
  assert.match(home, /<link rel="dns-prefetch" href="https:\/\/piston-meta\.mojang\.com"/);
});

test('404.html boots the app from the site root and is not indexed', () => {
  const html = byName.get('404.html')!;
  assert.match(html, /<meta name="robots" content="noindex"/);
  assert.ok(!html.includes('rel="canonical"'));
  assert.ok(!/\s(?:href|src)="\.\//.test(html.replace(/<script>[\s\S]*?<\/script>/g, '')), 'no relative asset tags left');
  assert.match(html, /document\.write\(/);
  assert.match(html, /github\\\.io/);
  assert.ok(html.includes('\\u003cscript type=\\"module\\"'), 'module script is written by the loader');
});

test('sitemap lists every public page with the build date', () => {
  const xml = byName.get('sitemap.xml')!;
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  const locs = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g), (m) => m[1]);
  assert.deepEqual(locs.sort(), pages.map((p) => absoluteUrl(p.meta.path)).sort());
  assert.equal((xml.match(/<lastmod>2026-09-27<\/lastmod>/g) ?? []).length, pages.length);
});

test('robots.txt allows everyone, names AI crawlers and points to the sitemap', () => {
  const txt = byName.get('robots.txt')!;
  assert.match(txt, /User-agent: \*\nAllow: \//);
  for (const ua of ['GPTBot', 'PerplexityBot', 'Google-Extended', 'CCBot']) assert.ok(txt.includes(`User-agent: ${ua}`), ua);
  assert.ok(!/Disallow/.test(txt));
  assert.ok(txt.includes(`Sitemap: ${SITE_URL}sitemap.xml`));
});

test('llms.txt follows the llmstxt.org layout and every link resolves', () => {
  const txt = byName.get('llms.txt')!;
  const lines = txt.split('\n');
  assert.equal(lines[0], '# Texture Pack Maker');
  assert.ok(lines.some((l) => l.startsWith('> ')), 'blockquote summary');
  assert.ok(lines.filter((l) => l.startsWith('## ')).length >= 3, 'sections');
  const links = Array.from(txt.matchAll(/\]\((https?:[^)]+)\)/g), (m) => m[1]);
  assert.ok(links.length >= PUBLIC_PAGES.length - 1);
  for (const url of links) {
    if (!url.startsWith(SITE_URL)) continue;
    const rel = url.slice(SITE_URL.length);
    const target = rel === '' || rel.endsWith('/') ? `${rel}index.html` : rel;
    assert.ok(byName.has(target), `llms.txt link ${url} -> ${target}`);
  }
  for (const g of GUIDES) assert.ok(txt.includes(absoluteUrl(g.path)), g.path);
});

test('llms-full.txt has the text of every public page', () => {
  const md = byName.get('llms-full.txt')!;
  for (const p of pages) {
    const h1 = decode(one(byName.get(pageFileName(p.meta.path))!, /<h1[^>]*>([\s\S]*?)<\/h1>/).replace(/<[^>]+>/g, ''));
    assert.ok(md.includes(`# ${h1}`), `llms-full has "${h1}"`);
    assert.ok(md.includes(`Source: ${absoluteUrl(p.meta.path)}`));
  }
  assert.ok(!md.includes('<svg'), 'no markup');
  assert.match(md, /\| Pack format \| Minecraft Java versions \|/);
});

test('facts come from the app data', () => {
  assert.equal(formatPackFormat(KNOWN_RELEASE_FORMATS['26.3']), '97.1');
  const groups = formatGroups();
  assert.equal(groups[0].format, '1');
  assert.equal(groups[0].versions[0], '1.6.1');
  assert.equal(groups[groups.length - 1].format, '97.1');
  assert.deepEqual(groups[groups.length - 1].versions, ['26.3']);
  assert.deepEqual(BEDROCK_MIN_ENGINE, DEFAULT_MIN_ENGINE);
  const formats = byName.get('guides/minecraft-pack-format-versions/index.html')!;
  assert.match(formats, /<th scope="row">97\.1<\/th><td>26\.3<\/td>/);
  assert.match(formats, /<th scope="row">1<\/th><td>1\.6\.1, 1\.6\.2/);
});

test('every icon used by the prerendered pages is a pixelarticons name', () => {
  for (const name of iconNamesUsed()) assert.match(name, /^[a-z0-9-]+$/);
});

test('markup renderers escape and convert', () => {
  const tree = el('div', null, el('h2', null, 'A & B'), el('p', { class: ['x', false, 'y'], title: 'say "hi"' }, 'one ', el('code', null, '<tag>'), ' ', el('a', { to: '/help' }, 'help')), el('ul', null, el('li', null, 'first'), el('li', null, 'second')), ic('check'));
  const html = renderHtml(tree, { iconSvg: () => '<path/>', logoSvg: () => '<svg></svg>', link: (to) => `.${to}/` });
  assert.ok(html.includes('<h2>A &amp; B</h2>'));
  assert.ok(html.includes('<p class="x y" title="say &quot;hi&quot;">'));
  assert.ok(html.includes('<code>&lt;tag&gt;</code>'));
  assert.ok(html.includes('<a href="./help/">help</a>'));
  assert.ok(html.includes('data-icon="check" aria-hidden="true"'));
  assert.equal(renderText(tree), 'A & B one <tag> help first second');
  const md = renderMarkdown(tree, { link: (to) => `https://example.test${to}/` });
  assert.equal(md, '## A & B\n\none `<tag>` [help](https://example.test/help/)\n\n- first\n- second');
});
