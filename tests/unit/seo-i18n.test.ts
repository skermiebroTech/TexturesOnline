// Translated pages: every language version is complete, distinct, linked both ways (hreflang,
// sitemap, language switcher), links stay in the reader's language, facts stay generated from the
// app data, and no English text is left behind.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSite, type SiteFile } from '../../src/app/seo/build';
import { prerenderPages, pagesIn, type PrerenderPage } from '../../src/app/seo/pages';
import { GUIDES, PUBLIC_PAGES, META_TRANSLATIONS, TOOL_META, guideMeta, localizedPath, metaRoute, pageLocales, pageMeta, publicPageMeta, allPublicPages } from '../../src/app/seo/meta';
import { absoluteUrl, SITE_URL } from '../../src/app/site';
import { flatten, type Child } from '../../src/app/markup';
import { LOCALES, LOCALE_INFO, TRANSLATED_LOCALES, prefixPath, splitLocale, type Locale } from '../../src/i18n/locales';
import { contentOf } from '../../src/i18n/content';
import { ui, UI_EN } from '../../src/i18n/ui';
import { TOOL_INTROS, type IntroTool } from '../../src/app/content/tools';
import { FAQ as HELP_FAQ_EN, HELP_EN } from '../../src/tools/help/content';
import { GUIDE_CONTENT } from '../../src/tools/guides/content';
import { HOME_EN } from '../../src/tools/home/content';
import { ABOUT_EN } from '../../src/tools/about/content';
import { F, LATEST, formatGroups } from '../../src/app/content/facts';
import { parseLocation, resolveRoute, stripBase, toHref } from '../../src/core/router';

const TEMPLATE = `<!doctype html>
<html lang="en" class="no-js" data-theme="dark">
  <head>
    <meta charset="UTF-8" />
    <!--app-head-->
    <script type="module" crossorigin src="./assets/index-abc.js"></script>
  </head>
  <body>
    <div id="app"><!--app-html--></div>
  </body>
</html>`;

const files: SiteFile[] = buildSite({
  template: TEMPLATE,
  iconSvg: () => '<path d="M0 0h2v2H0z"/>',
  assetsFor: (mods) => ({ css: [], js: mods.map((m) => `assets/${m.replace(/[^a-z0-9]+/gi, '-')}.js`) }),
  buildDate: '2026-10-20',
});
const byName = new Map(files.map((f) => [f.fileName, f.source]));
const pages = prerenderPages();
const fileOf = (url: string) => {
  const rel = url.slice(SITE_URL.length);
  return rel === '' || rel.endsWith('/') ? `${rel}index.html` : rel;
};
const htmlOf = (p: PrerenderPage) => byName.get(fileOf(absoluteUrl(p.meta.path)))!;
const decode = (s: string) => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const translated = pages.filter((p) => p.locale !== 'en');

/** The pages phase 1 promises in every language. */
const REQUIRED_ROUTES = [
  '/',
  '/textures',
  '/texture-pack-converter',
  '/merge-texture-packs',
  '/skins',
  '/skin-pack-maker',
  '/shaders',
  '/help',
  '/about',
  '/all',
  '/guides',
  '/guides/make-a-texture-pack',
  '/guides/install-resource-packs',
  '/guides/texture-pack-not-working',
  '/guides/java-vs-bedrock-packs',
  '/guides/make-a-skin',
  '/guides/make-shaders-without-mods',
  '/guides/minecraft-pack-format-versions',
  '/totem-maker',
  '/guides/bedrock-vibrant-visuals-settings',
  '/guides/convert-java-to-bedrock-texture-pack',
  '/guides/merge-texture-packs',
  '/guides/make-a-bedrock-skin-pack',
  '/guides/make-3d-items-texture-pack',
];

/** A public page that exists only in English, if there is one (every page is translated otherwise). */
const englishOnly = PUBLIC_PAGES.find((m) => pageLocales(m.path).length === 1);

test('every language has the promised pages, each with its meta and its content', () => {
  for (const l of TRANSLATED_LOCALES) {
    const routes = pagesIn(l).map((p) => metaRoute(p.meta));
    for (const r of REQUIRED_ROUTES) assert.ok(routes.includes(r), `${l} has ${r}`);
    // A translated title without content (or content without a title) would make a page vanish.
    const t = META_TRANSLATIONS[l];
    const metaRoutes = [...Object.keys(t.pages), ...Object.keys(t.guides).map((s) => `/guides/${s}`)];
    assert.deepEqual([...routes].sort(), metaRoutes.sort(), `${l}: every page with a translated title is built`);
    const c = contentOf(l);
    for (const tool of Object.keys(c.tools)) assert.ok(t.pages[TOOL_META[tool as IntroTool].path], `${l}: tool ${tool} has a title`);
    for (const slug of Object.keys(c.guides)) assert.ok(t.guides[slug], `${l}: guide ${slug} has a title`);
  }
});

test('translated titles and descriptions are unique, sized and not English', () => {
  for (const l of TRANSLATED_LOCALES) {
    const seen = new Set<string>();
    for (const p of pagesIn(l)) {
      const en = pageMeta(metaRoute(p.meta), 'en')!;
      const m = p.meta;
      const [tMax, dMin, dMax] = l === 'ja' ? [45, 50, 120] : [60, 70, 155];
      assert.ok(m.title.length <= tMax, `${m.path} title ${m.title.length}: ${m.title}`);
      assert.ok(m.description.length >= dMin && m.description.length <= dMax, `${m.path} description ${m.description.length}`);
      assert.notEqual(m.title, en.title, `${m.path} title is translated`);
      assert.notEqual(m.description, en.description, `${m.path} description is translated`);
      for (const v of [m.title, m.description]) {
        assert.ok(!seen.has(v), `${l}: duplicate ${v}`);
        seen.add(v);
      }
      if (m.kind === 'guide') assert.notEqual((m as typeof en & { h1: string }).h1, (en as typeof en & { h1: string }).h1, `${m.path} h1`);
    }
  }
});

test('html lang, og:locale, canonical and JSON-LD inLanguage follow the page language', () => {
  for (const p of pages) {
    const html = htmlOf(p);
    const info = LOCALE_INFO[p.locale];
    assert.match(html, new RegExp(`<html lang="${info.lang}"[^>]*>`), `${p.meta.path} lang`);
    assert.ok(html.includes(`<meta property="og:locale" content="${info.ogLocale}" />`), `${p.meta.path} og:locale`);
    assert.ok(html.includes(`<link rel="canonical" href="${absoluteUrl(p.meta.path)}" />`), `${p.meta.path} canonical`);
    const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)![1]) as { '@graph': Record<string, unknown>[] };
    const page = ld['@graph'].find((n) => String(n['@id']).endsWith('#webpage'))!;
    assert.equal(page.inLanguage, info.lang, `${p.meta.path} WebPage inLanguage`);
    assert.equal(page.url, absoluteUrl(p.meta.path));
    for (const n of ld['@graph'].filter((x) => x['@type'] === 'TechArticle' || x['@type'] === 'HowTo')) assert.equal(n.inLanguage, info.lang, `${p.meta.path} ${n['@type']} inLanguage`);
    // Breadcrumbs link the page's own language
    const crumbs = ld['@graph'].find((n) => n['@type'] === 'BreadcrumbList');
    if (crumbs) {
      const items = crumbs.itemListElement as { name: string; item: string }[];
      assert.equal(items[0].name, ui(p.locale).home);
      assert.equal(items[0].item, absoluteUrl(prefixPath('/', p.locale)));
      for (const it of items) assert.equal(splitLocale(new URL(it.item).pathname).locale, p.locale, `${p.meta.path} crumb ${it.item}`);
    }
  }
});

const alternatesIn = (html: string) =>
  Array.from(html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)" \/>/g), (m) => [m[1], m[2]] as [string, string]).sort((a, b) => a[0].localeCompare(b[0]));

test('hreflang links are complete and reciprocal, with x-default pointing to English', () => {
  for (const p of pages) {
    const alts = alternatesIn(htmlOf(p));
    const route = metaRoute(p.meta);
    const expected = pageLocales(route).map((l) => [LOCALE_INFO[l].lang, absoluteUrl(pageMeta(route, l)!.path)] as [string, string]);
    expected.push(['x-default', absoluteUrl(route)]);
    assert.deepEqual(alts, expected.sort((a, b) => a[0].localeCompare(b[0])), `${p.meta.path} alternates`);
    assert.ok(alts.some(([, href]) => href === absoluteUrl(p.meta.path)), `${p.meta.path} lists itself`);
    // Every alternate lists exactly the same set back.
    for (const [, href] of alts) assert.deepEqual(alternatesIn(byName.get(fileOf(href))!), alts, `${href} points back to ${p.meta.path}`);
  }
  // A page only in English still names itself and x-default.
  if (englishOnly) {
    const alts = alternatesIn(byName.get(fileOf(absoluteUrl(englishOnly.path)))!);
    assert.deepEqual(
      alts.map(([h]) => h),
      ['en', 'x-default'],
    );
  }
});

test('the sitemap lists every language version with matching xhtml:link alternates', () => {
  const xml = byName.get('sitemap.xml')!;
  const entries = Array.from(xml.matchAll(/<url>([\s\S]*?)<\/url>/g), (m) => m[1]);
  assert.equal(entries.length, allPublicPages().length);
  for (const p of pages) {
    const loc = absoluteUrl(p.meta.path);
    const entry = entries.find((e) => e.includes(`<loc>${loc}</loc>`));
    assert.ok(entry, `sitemap has ${loc}`);
    const links = Array.from(entry.matchAll(/<xhtml:link rel="alternate" hreflang="([^"]+)" href="([^"]+)"\/>/g), (m) => [m[1], m[2]] as [string, string]).sort((a, b) => a[0].localeCompare(b[0]));
    const html = alternatesIn(htmlOf(p));
    if (p.alternates.length > 1) assert.deepEqual(links, html, `${loc} sitemap alternates match the page`);
    else assert.equal(links.length, 0, `${loc} has no other languages`);
  }
});

/** Every internal link of a page, resolved against the site root. */
function internalLinks(p: PrerenderPage): { path: string; hreflang: string | null }[] {
  const html = htmlOf(p).replace(/<head>[\s\S]*<\/head>/, '');
  const pageUrl = new URL(fileOf(absoluteUrl(p.meta.path)).replace(/index\.html$/, ''), 'https://x.test/');
  return Array.from(html.matchAll(/<a\b([^>]*)>/g))
    .map((m) => ({ href: /\shref="([^"]+)"/.exec(m[1])?.[1], hreflang: /\shreflang="([^"]+)"/.exec(m[1])?.[1] ?? null }))
    .filter((a): a is { href: string; hreflang: string | null } => !!a.href && !/^(https?:|#|mailto:)/.test(a.href))
    .map((a) => ({ path: new URL(decode(a.href), pageUrl).pathname, hreflang: a.hreflang }));
}

test('links on translated pages stay in their language wherever the target page exists', () => {
  for (const p of translated) {
    for (const { path, hreflang } of internalLinks(p)) {
      if (/\.[a-z0-9]+$/i.test(path)) continue; // files (fonts licence, screenshots)
      const route = path.replace(/\/$/, '') || '/';
      const { locale } = splitLocale(route);
      const target = publicPageMeta(route);
      assert.ok(target, `${p.meta.path} links a public page: ${path}`);
      if (hreflang) {
        assert.equal(LOCALE_INFO[locale].lang, hreflang, `${p.meta.path}: hreflang of ${path}`);
        continue;
      }
      if (locale === 'en') assert.ok(!pageMeta(route, p.locale), `${p.meta.path} links English ${path} although a ${p.locale} version exists`);
      else assert.equal(locale, p.locale, `${p.meta.path} links another language: ${path}`);
    }
  }
});

test('the language switcher offers every language of the page and marks the current one', () => {
  for (const p of pages) {
    const html = htmlOf(p);
    const nav = /<nav class="lang-switch"[^>]*>([\s\S]*?)<\/nav>/.exec(html);
    assert.ok(nav, `${p.meta.path} has a language switcher`);
    const links = Array.from(nav[1].matchAll(/<a href="([^"]+)" hreflang="([^"]+)" lang="[^"]+"( aria-current="true")?>([^<]+)<\/a>/g));
    assert.equal(links.length, LOCALES.length, `${p.meta.path}: one link per language`);
    const current = links.filter((m) => m[3]);
    assert.equal(current.length, 1);
    assert.equal(current[0][2], LOCALE_INFO[p.locale].lang);
    assert.deepEqual(
      links.map((m) => m[4]),
      LOCALES.map((l) => LOCALE_INFO[l].name),
    );
    const route = metaRoute(p.meta);
    for (const m of links) {
      const l = LOCALES.find((x) => LOCALE_INFO[x].lang === m[2])!;
      const expected = pageMeta(route, l)?.path ?? prefixPath('/', l);
      const pageUrl = new URL(fileOf(absoluteUrl(p.meta.path)).replace(/index\.html$/, ''), 'https://x.test/');
      assert.equal(new URL(decode(m[1]), pageUrl).pathname.replace(/\/$/, '') || '/', expected, `${p.meta.path} -> ${l}`);
    }
  }
});

test('translated content keeps every question, section and step of the English pages', () => {
  const ids = (items: { id: string }[] | undefined) => (items ?? []).map((i) => i.id);
  for (const l of TRANSLATED_LOCALES) {
    const c = contentOf(l);
    assert.deepEqual(ids(c.home!.faq), ids(HOME_EN.faq), `${l} home FAQ`);
    assert.deepEqual(ids(c.help!.faq), ids(HELP_FAQ_EN), `${l} help FAQ (ids are used in /help?s= links)`);
    assert.deepEqual(ids(c.about!.faq), ids(ABOUT_EN.faq), `${l} about FAQ`);
    assert.deepEqual(Object.keys(c.home!.tools).sort(), Object.keys(HOME_EN.tools).sort(), `${l} home tool cards`);
    for (const [k, s] of Object.entries(HELP_EN.sections)) {
      const t = c.help!.sections[k as keyof typeof HELP_EN.sections];
      assert.ok(t, `${l} help section ${k}`);
      if (!t || !s) continue;
      assert.equal(!!t.howto, !!s.howto, `${l} help ${k} HowTo`);
      if (s.howto) assert.equal(t.howto!.steps.length, s.howto.steps.length, `${l} help ${k} steps`);
    }
    for (const [tool, text] of Object.entries(c.tools)) {
      const en = TOOL_INTROS[tool as IntroTool];
      assert.deepEqual(ids(text!.faq), ids(en.faq), `${l} ${tool} FAQ`);
      assert.equal(text!.steps.length, en.steps.length, `${l} ${tool} steps`);
      assert.equal(text!.features.length, en.features.length, `${l} ${tool} features`);
      assert.equal(text!.featureList.length, en.featureList.length, `${l} ${tool} featureList`);
      assert.equal(!!text!.extra, !!en.extra, `${l} ${tool} extra`);
    }
    for (const [slug, text] of Object.entries(c.guides)) {
      const en = GUIDE_CONTENT.find((g) => g.meta.slug === slug)!;
      assert.deepEqual(ids(text!.sections), ids(en.sections), `${l} ${slug} sections`);
      assert.deepEqual(ids(text!.faq), ids(en.faq), `${l} ${slug} FAQ`);
      assert.equal(text!.quick?.items.length, en.quick?.items.length, `${l} ${slug} quick answer`);
      assert.equal(text!.howto?.steps.length, en.howto?.steps.length, `${l} ${slug} HowTo`);
      assert.equal(!!text!.image, !!en.image, `${l} ${slug} image`);
      assert.equal(text!.image?.src, en.image?.src, `${l} ${slug} same screenshot`);
    }
  }
});

test('facts on translated pages come from the app data', () => {
  const rows = (html: string) => Array.from(html.matchAll(/<tr><th scope="row">([^<]+)<\/th><td>([^<]+)<\/td><\/tr>/g), (m) => `${m[1]}=${m[2]}`);
  const enTable = rows(byName.get('guides/minecraft-pack-format-versions/index.html')!);
  assert.equal(enTable.length, formatGroups().length);
  for (const l of TRANSLATED_LOCALES) {
    const html = byName.get(`${l}/guides/minecraft-pack-format-versions/index.html`)!;
    assert.deepEqual(rows(html), enTable, `${l} format table`);
    assert.ok(html.includes(F(LATEST)) && html.includes(LATEST), `${l} names ${LATEST} and ${F(LATEST)}`);
    assert.ok(html.includes(`&quot;min_format&quot;: [${F(LATEST).replace('.', ', ')}]`) || html.includes(`"min_format": [${F(LATEST).replace('.', ', ')}]`), `${l} pack.mcmeta example`);
    const meta = guideMeta('minecraft-pack-format-versions', l)!;
    assert.ok(meta.title.includes(F(LATEST)), `${l} title names the format`);
  }
});

// ---------------------------------------------------------------- untranslated English

/** English words that do not occur in German, Spanish, Portuguese or Japanese prose. */
const ENGLISH = new Set(['the', 'and', 'with', 'your', 'you', 'this', 'that', 'from', 'which', 'what', 'how', 'when', 'into', 'are', 'can', 'not', 'it', 'its', 'of', 'to', 'is', 'for', 'or', 'on', 'be', 'by', 'if', 'at', 'then', 'there', 'they', 'their', 'have', 'has', 'does', 'only', 'every', 'each', 'more', 'than', 'after', 'before', 'about', 'one', 'two', 'make', 'made', 'open', 'click', 'choose', 'pick']);
/** Names the editors show in English (quoted as they appear), product names and file names. */
const ALLOWED = [
  'Open a pack',
  'Use my own .jar',
  'Create pack',
  'Export .zip',
  'Bedrock skin pack (.mcpack)',
  'Bedrock skin pack',
  'Make a skin pack',
  'New texture pack',
  'Download pack',
  'Show all',
  'Used by',
  'Legacy 64×32',
  'Texture Pack Maker',
  'Minecraft: Java Edition',
  'Minecraft Texture Pack Maker',
  'Minecraft Texture Pack Merger',
  'Minecraft Shader Maker',
  'Minecraft Skin Editor',
  'Converting Texture Packs from Java Edition to Bedrock Edition',
  'Iris & Sodium',
  'Skermiebro Tech Tips',
  'My First Pack',
  'Adventure Crew',
  'Dark Mode',
  'Neon Outline',
  'Retro 8-bit',
  'Smooth HD',
  'Blocks · Items · Mobs · All',
  'Only Allow Trusted Skins',
  'Use for every random variant',
  'Open with Minecraft',
  'Edited',
  'Open Source',
  'Open-Source',
];

/** Text runs of a content tree outside code, with alt texts and labels. */
function texts(node: Child, out: string[] = []): string[] {
  for (const c of flatten([node])) {
    if (typeof c === 'string') out.push(c);
    else if (c.kind === 'el') {
      if (['code', 'pre', 'kbd', 'svg', 'script'].includes(c.tag)) continue;
      for (const k of ['alt', 'aria-label', 'title']) if (typeof c.attrs[k] === 'string') out.push(c.attrs[k] as string);
      texts(c.children, out);
    } else if (c.label) out.push(c.label);
  }
  return out;
}

function englishRuns(text: string): string[] {
  let t = text;
  for (const a of ALLOWED) t = t.split(a).join(' ');
  // file names, paths and version numbers are not prose
  t = t.replace(/\S*[./\\]\S*/g, ' ');
  const words = t.toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) ?? [];
  const hits = words.filter((w) => ENGLISH.has(w));
  return hits.length >= 2 ? [text] : [];
}

test('no English prose is left on translated pages (heuristic)', () => {
  for (const p of translated) {
    const found = [...texts(p.body(2026)), p.meta.title, p.meta.description].flatMap(englishRuns);
    assert.deepEqual(found, [], `${p.meta.path} has English text`);
  }
  // The check does catch English
  assert.equal(englishRuns('Open the pack and click Done.').length, 1);
  assert.equal(englishRuns('Öffne das Pack mit Open a pack.').length, 0);
});

test('interface texts exist for every language and differ from English', () => {
  const flat = (o: unknown, prefix = ''): [string, string][] =>
    Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => (typeof v === 'object' && v ? flat(v, `${prefix}${k}.`) : typeof v === 'function' ? [[`${prefix}${k}`, String((v as (x: never) => string)('2026-10-12' as never))]] : [[`${prefix}${k}`, String(v)]]));
  const en = new Map(flat(UI_EN));
  const SAME_OK = /^(nav\.(skins|shaders)|footer\.faq|notFound\.help|nav\.help|menu|guides|footer\.guides|toolIntro\.guides|guide|folderTable\.system)$/;
  for (const l of TRANSLATED_LOCALES) {
    const t = new Map(flat(ui(l)));
    assert.deepEqual([...t.keys()].sort(), [...en.keys()].sort(), `${l} has every key`);
    const same = [...t].filter(([k, v]) => v === en.get(k) && !SAME_OK.test(k) && /[a-z]{4}/i.test(v)).map(([k]) => k);
    assert.deepEqual(same, [], `${l} interface texts left in English`);
  }
});

// ---------------------------------------------------------------- routing

test('localized paths: language folders only where the page exists, app pages follow the language', () => {
  assert.equal(localizedPath('/help?s=faq', 'de'), '/de/help?s=faq');
  assert.equal(localizedPath('/', 'ja'), '/ja');
  if (englishOnly) assert.equal(localizedPath(englishOnly.path, 'es'), englishOnly.path, 'untranslated page stays English');
  assert.equal(localizedPath('/guides/make-a-bedrock-skin-pack', 'es'), '/es/guides/make-a-bedrock-skin-pack');
  assert.equal(localizedPath('/textures/abc', 'pt-br'), '/pt-br/textures/abc', 'a project follows the language');
  assert.equal(localizedPath('/fonts/OFL.txt', 'de'), '/fonts/OFL.txt', 'files are not localized');
  assert.equal(localizedPath('/de/help', 'es'), '/de/help', 'an explicit language is kept');
  assert.equal(localizedPath('/help', 'en'), '/help');
  assert.deepEqual(splitLocale('/pt-br/guides/make-a-skin'), { locale: 'pt-br', path: '/guides/make-a-skin' });
  assert.deepEqual(splitLocale('/de'), { locale: 'de', path: '/' });
  assert.deepEqual(splitLocale('/en/help'), { locale: 'en', path: '/en/help' }, 'English has no folder');
  assert.deepEqual(splitLocale('/design'), { locale: 'en', path: '/design' });
  assert.equal(prefixPath('/', 'es'), '/es');
  assert.equal(prefixPath('/?x=1', 'es'), '/es/?x=1');
  assert.equal(publicPageMeta('/de/help/')?.title, META_TRANSLATIONS.de.pages['/help']!.title);
  if (englishOnly) assert.equal(publicPageMeta(prefixPath(englishOnly.path, 'de')), undefined, 'no German version, not public');
  assert.equal(publicPageMeta('/de/guides/not-a-guide'), undefined, 'unknown guide, not public');
  assert.equal(publicPageMeta('/ja/textures/abc'), undefined);
});

test('every localized page and project URL survives a round trip under each base', () => {
  const routes = [...PUBLIC_PAGES.map((m) => m.path), ...GUIDES.map((g) => g.path), '/textures/p1', '/skins/s-1', '/shaders/3f2c', '/kit'];
  for (const base of ['/', '/TexturesOnline/']) {
    for (const l of LOCALES) {
      for (const r of routes) {
        const full = localizedPath(r, l);
        const url = toHref(full, base);
        if (!r.includes('/p1') && !r.includes('/s-1') && !r.includes('/3f2c') && r !== '/kit' && full === prefixPath(r, l)) assert.ok(url.endsWith('/'), `${url} is a folder URL`);
        const back = stripBase(url.split('?')[0], base);
        assert.equal(back, full, `${full} via ${url}`);
        const split = splitLocale(back!);
        assert.equal(split.locale, full === r ? 'en' : l);
        assert.equal(split.path, r);
        assert.ok(resolveRoute(split.path), `route for ${r}`);
      }
    }
    assert.equal(toHref('/de/help?s=faq', base), `${base}de/help/?s=faq`);
    assert.equal(toHref('/ja', base), `${base}ja/`);
    assert.equal(stripBase(`${base}ja/`, base), '/ja');
  }
  assert.equal(parseLocation('/es/help?s=iris#x').path, '/es/help');
});
